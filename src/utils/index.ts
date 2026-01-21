// src/utils/index.ts
import { exec } from 'child_process';
import type { ExecException } from 'child_process';
import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main'; // Needed for settings type
import { readFile, writeFile, copyFile } from 'fs/promises';
import { existsSync, unlinkSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';

// --- QUERY RUNNER ---

/**
 * Executes a Beancount query (BQL) against the configured ledger file.
 *
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @param {string} query - The BQL query string.
 * @returns {Promise<string>} The CSV output of the query.
 * @throws {Error} If the query fails or command/path is not set.
 */
export function runQuery(plugin: BeancountPlugin, query: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const filePath = plugin.settings.beancountFilePath;
		const commandName = plugin.settings.beancountCommand;
		if (!filePath) return reject(new Error('File path not set.'));
		if (!commandName) return reject(new Error('Command not set.'));
		const command = `${commandName} -q -f csv "${filePath}" "${query}"`;
		
		// Increase maxBuffer to handle large query results (50MB limit)
		exec(command, { maxBuffer: 50 * 1024 * 1024 }, (error: ExecException | null, stdout: string, stderr: string) => {
			if (error) return reject(error);
			if (stderr) return reject(new Error(stderr));
			
			// Clean the output to remove any potential query echoes
			let cleanOutput = stdout;
			const lines = stdout.split('\n');
			
			// Remove lines that look like query echoes
			const filteredLines = lines.filter(line => {
				const trimmed = line.trim();
				// Skip empty lines
				if (!trimmed) return false;
				// Skip lines that contain query fragments
				if (trimmed.includes('SELECT') || 
					trimmed.includes('WHERE') || 
					trimmed.includes('convert(') || 
					trimmed.includes('sum(') ||
					trimmed === query.trim()) {
					return false;
				}
				return true;
			});
			
			// If we filtered out some lines, use the filtered result
			if (filteredLines.length < lines.length && filteredLines.length > 0) {
				cleanOutput = filteredLines.join('\n');
			}
			
			resolve(cleanOutput);
		});
	});
}

// --- VALIDATION UTILITIES ---

/**
 * Validates a price source by executing bean-price command.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @param {string} priceMetadata - The price source string (e.g., "yahoo/AAPL").
 * @returns {Promise<{success: boolean, output?: string, error?: string}>} Validation result.
 */
export function validatePriceSource(plugin: BeancountPlugin, priceMetadata: string): Promise<{success: boolean, output?: string, error?: string}> {
	return new Promise((resolve) => {
		if (!priceMetadata || typeof priceMetadata !== 'string' || priceMetadata.trim() === '') {
			return resolve({ success: false, error: 'Empty price metadata' });
		}

		const commandName = plugin.settings.beancountCommand;
		if (!commandName) {
			return resolve({ success: false, error: 'Beancount command not set' });
		}

		// Replace bean-query with bean-price in the command
		const beanPriceCommand = commandName.replace(/bean-query(\.exe)?$/, 'bean-price$1');
		const command = `${beanPriceCommand} -e "${priceMetadata}"`;

		exec(command, { timeout: 10000, maxBuffer: 1024 * 1024 }, (error: ExecException | null, stdout: string, stderr: string) => {
			// Success if exit code 0 and stdout has content
			if (!error && stdout && stdout.trim()) {
				return resolve({ success: true, output: stdout.trim() });
			}

			// Failed validation
			const errorMsg = error?.message || stderr || 'bean-price validation failed';
			resolve({ success: false, error: errorMsg });
		});
	});
}

/**
 * Validates a logo URL by checking if it returns an image content-type.
 * 
 * @param {string} url - The URL to validate.
 * @returns {Promise<{success: boolean, contentType?: string, error?: string}>} Validation result.
 */
export async function validateLogoUrl(url: string): Promise<{success: boolean, contentType?: string, error?: string}> {
	try {
		if (!url || typeof url !== 'string' || url.trim() === '') {
			return { success: false, error: 'Empty URL' };
		}

		const response = await fetch(url, { 
			method: 'HEAD',
			headers: {
				'User-Agent': 'Obsidian-Finance-Plugin/1.0'
			},
			signal: AbortSignal.timeout(10000) // 10 second timeout
		});

		const contentType = response.headers.get('Content-Type') || '';
		
		if (contentType.startsWith('image/')) {
			return { success: true, contentType };
		} else {
			return { success: false, error: `URL did not return image (Content-Type: ${contentType})` };
		}
	} catch (error) {
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return { success: false, error: 'Network error or invalid URL' };
		}
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Validates that a filename and line number point to a commodity declaration for the given symbol.
 * Reads the file and checks if the specified line contains "commodity" and the symbol.
 * 
 * @param {string} filename - The absolute path to the Beancount file.
 * @param {number} lineno - The line number (1-based).
 * @param {string} symbol - The commodity symbol to verify.
 * @returns {Promise<{success: boolean, error?: string}>} Validation result.
 */
export async function validateCommodityLocation(filename: string, lineno: number, symbol: string): Promise<{success: boolean, error?: string}> {
	try {
		if (!filename || !lineno || !symbol) {
			return { success: false, error: 'Missing filename, lineno, or symbol' };
		}

		// Read the file content
		const content = await readFile(filename, 'utf-8');
		const lines = content.split('\n');

		// Convert to 0-based index
		const lineIndex = lineno - 1;

		if (lineIndex < 0 || lineIndex >= lines.length) {
			return { success: false, error: `Line number ${lineno} out of range (file has ${lines.length} lines)` };
		}

		const line = lines[lineIndex].trim();

		// Check if line contains "commodity" and the symbol
		// Expected format: "YYYY-MM-DD commodity SYMBOL" or just "commodity SYMBOL"
		if (!line.includes('commodity')) {
			return { success: false, error: `Line ${lineno} does not contain 'commodity' keyword` };
		}

		if (!line.includes(symbol)) {
			return { success: false, error: `Line ${lineno} does not contain symbol '${symbol}'` };
		}

		// More strict check: ensure it's actually a commodity declaration
		const commodityPattern = new RegExp(`\\bcommodity\\s+${symbol}\\b`);
		if (!commodityPattern.test(line)) {
			return { success: false, error: `Line ${lineno} does not match commodity declaration pattern for '${symbol}'` };
		}

		return { success: true };
	} catch (error) {
		if ((error as any).code === 'ENOENT') {
			return { success: false, error: `File not found: ${filename}` };
		}
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

// --- CSV PARSER HELPER ---

/**
 * Parses a single value from a CSV response (typically from a simple SELECT query).
 *
 * @param {string} csv - The raw CSV string.
 * @returns {string} The parsed single value (e.g. "100.00 USD") or "0 USD" on failure.
 */
export function parseSingleValue(csv: string): string {
	try {
		// First, try to clean and process the raw CSV data
		const lines = csv.split('\n').map(line => line.trim()).filter(line => line.length > 0);
		
		// If we have lines, try to find the data line (skip query echo if present)
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Skip lines that look like query echoes (contain SELECT, WHERE, etc.)
			if (line.includes('SELECT') || line.includes('WHERE') || line.includes('convert(') || line.includes('sum(')) {
				continue;
			}
			
			// If line starts with a quote and contains data, extract the content
			if (line.startsWith('"') && line.length > 2) {
				// Remove leading/trailing quotes and return the content
				let content = line.substring(1);
				if (content.endsWith('"')) {
					content = content.substring(0, content.length - 1);
				}
				return content.trim();
			}
			
			// If line doesn't start with quote but contains data, return as-is
			if (line.length > 0 && !line.startsWith('"')) {
				return line.trim();
			}
		}
		
		// Fallback: try traditional CSV parsing
		const records: string[][] = parseCsv(csv, { columns: false, skip_empty_lines: true, relax_column_count: true });
		if (records.length > 1 && records[1].length > 0 && records[1][0] && records[1][0].trim() !== '') {
			return records[1][0].trim();
		}
		
		console.warn("parseSingleValue: No valid data found, returning '0 USD'. CSV:", csv);
		return '0 USD';
	} catch (e) {
		console.error("Error parsing single value CSV:", e, "CSV:", csv);
		
		// Emergency fallback: try to extract any quoted content manually
		try {
			const lines = csv.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith('"') && trimmed.length > 2) {
					let content = trimmed.substring(1);
					if (content.endsWith('"')) {
						content = content.substring(0, content.length - 1);
					}
					if (content.trim().length > 0) {
						return content.trim();
					}
				}
			}
		} catch (fallbackError) {
			console.error("Fallback parsing also failed:", fallbackError);
		}
		
		return '0 USD';
	}
}

// --- PATH CONVERTER ---

/**
 * Converts a WSL path (/mnt/c/...) to a Windows path (C:\...).
 *
 * @param {string} wslPath - The WSL path.
 * @returns {string} The corresponding Windows path.
 */
export function convertWslPathToWindows(wslPath: string): string {
	const match = wslPath.match(/^\/mnt\/([a-zA-Z])\//);
	if (match) {
		const driveLetter = match[1].toUpperCase();
		return wslPath.replace(/^\/mnt\/[a-zA-Z]\//, `${driveLetter}:\\`).replace(/\//g, '\\');
	}
	return wslPath;
}
/**
 * Performs an atomic file write operation using temp file + rename strategy.
 * On Windows, handles the requirement to delete target file before rename.
 * 
 * @param {string} filePath - The target file path to write to.
 * @param {string} content - The content to write.
 * @returns {Promise<void>}
 */
async function atomicFileWrite(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.tmp`;
	await writeFile(tempPath, content, 'utf-8');
	
	try {
		// On Windows, we need to delete the target file first before renaming
		if (existsSync(filePath)) {
			unlinkSync(filePath);
		}
		renameSync(tempPath, filePath);
	} catch (renameError) {
		// Fallback: just overwrite directly
		await writeFile(filePath, content, 'utf-8');
		// Clean up temp file if it still exists
		if (existsSync(tempPath)) {
			unlinkSync(tempPath);
		}
	}
}

/**
 * Creates a backup of a file if requested.
 * 
 * @param {string} filePath - The file path to back up.
 * @param {boolean} createBackup - Whether to create the backup.
 * @param {string} functionName - The calling function name for logging.
 * @returns {Promise<void>}
 */
async function createBackupFile(filePath: string, createBackup: boolean, functionName: string): Promise<void> {
	if (!createBackup) return;
	
	const backupPath = `${filePath}.bak`;
	try {
		await copyFile(filePath, backupPath);
		console.debug(`[${functionName}] Created backup: ${backupPath}`);
	} catch (backupError) {
		console.warn(`[${functionName}] Failed to create backup:`, backupError);
		// Continue anyway - backup failure shouldn't block save
	}
}

// --- ACCOUNT TREE BUILDER ---
import type { AccountNode } from '../models/account';

/**
 * Builds a hierarchical tree of accounts from a flat list of account names.
 *
 * @param {string[]} accounts - List of account strings (e.g. "Assets:Bank:Checking").
 * @returns {AccountNode[]} The root level nodes of the account tree.
 */
export function buildAccountTree(accounts: string[]): AccountNode[] {
	const root: AccountNode = { name: 'Root', fullName: '', children: [] };
	accounts.sort();
	for (const account of accounts) {
		if (!account) continue;
		const parts = account.split(':'); let currentNode = root;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]; const fullName = parts.slice(0, i + 1).join(':');
			let childNode = currentNode.children.find(child => child.name === part);
			if (!childNode) { childNode = { name: part, fullName: fullName, children: [] }; currentNode.children.push(childNode); }
			currentNode = childNode;
		}
	}
	return root.children;
}

// --- DEBOUNCE UTILITY ---

/**
 * Creates a debounced version of a function.
 *
 * @template T
 * @param {T} func - The function to debounce.
 * @param {number} wait - The wait time in milliseconds.
 * @returns {(...args: Parameters<T>) => void} The debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			timeout = null;
			func(...args);
		};
		if (timeout !== null) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
}

// src/utils/index.ts
// ... (at the end of the file, after the debounce function)

// --- DATE HELPER ---

/**
 * Gets the start and end dates of the current month.
 *
 * @returns {{start: string, end: string}} Object with 'start' and 'end' date strings (YYYY-MM-DD).
 */
export function getCurrentMonthRange(): { start: string, end: string } {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	
	// Format date without timezone conversion to avoid date shifting
	const formatDate = (date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};
	
	return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) };
}

/**
 * Parses a string amount into a numeric value and currency.
 *
 * @param {string} amountString - The string to parse (e.g. "1,234.56 USD").
 * @returns {{amount: number, currency: string}} The parsed amount and currency.
 */
export function parseAmount(amountString: string): { amount: number; currency: string } {
	// Default values
	const defaultValue = { amount: 0, currency: 'USD' };
	if (!amountString || typeof amountString !== 'string') {
		return defaultValue;
	}

	const match = amountString.match(/(-?[\d,]+(?:\.\d+)?)\s*(\S+)/);
	if (match) {
		try {
			const amount = parseFloat(match[1].replace(/,/g, ''));
			const currency = match[2];
			return { amount: isNaN(amount) ? 0 : amount, currency: currency || 'USD' };
		} catch (e) {
			console.error("Error parsing amount:", e, "String:", amountString);
			return defaultValue;
		}
	}
	console.warn("Could not parse amount string:", amountString);
	return defaultValue;
}

/**
 * Extracts the amount for a specific currency from an inventory string.
 *
 * @param {string} inventoryString - The multi-currency inventory string.
 * @param {string} targetCurrency - The currency to extract.
 * @returns {string} The extracted amount string with currency.
 */
export function extractConvertedAmount(inventoryString: string, targetCurrency: string): string {
	// Regex to find the number associated with the *specific* target currency
	const regex = new RegExp(`(-?[\\d,]+\\.?\\d*)\\s*${targetCurrency}`);
	const match = inventoryString.match(regex);

	if (match) {
		// Found it, return the number and currency
		return `${match[1]} ${targetCurrency}`;
	}
	// If currency not found, it means the total was 0
	return `0.00 ${targetCurrency}`;
}

/**
 * Extracts amounts for all currencies EXCEPT the operating currency.
 *
 * @param {string} inventoryString - The inventory string.
 * @param {string} operatingCurrency - The currency to exclude.
 * @returns {string} Newline-separated list of other currency amounts.
 */
export function extractNonReportingCurrencies(inventoryString: string, operatingCurrency: string): string {
	// Extract all currency amounts from the inventory string
	const currencyRegex = /(-?[\d,]+\.?\d*)\s*([A-Z]{3,4})/g;
	const matches = [];
	let match;
	
	// Find all currency amounts
	while ((match = currencyRegex.exec(inventoryString)) !== null) {
		const amount = match[1];
		const currency = match[2];
		
		// Skip the operating currency - we only want other currencies
		if (currency !== operatingCurrency) {
			// Only include non-zero amounts
			const numAmount = parseFloat(amount.replace(/,/g, ''));
			if (numAmount !== 0) {
				matches.push(`${amount} ${currency}`);
			}
		}
	}
	
	// Return newline-separated list of non-reporting currencies for better multi-line display
	return matches.join('\n');
}

// --- CURRENCY FORMATTER ---

/**
 * Formats a number as a currency string.
 *
 * @param {number} amount - The numeric amount.
 * @param {string} currency - The currency symbol.
 * @returns {string} Formatted string (e.g. "1,234.56 USD").
 */
export function formatCurrency(amount: number, currency: string): string {
	if (isNaN(amount)) {
		return `0.00 ${currency}`;
	}
	
	return `${amount.toLocaleString(undefined, { 
		minimumFractionDigits: 2, 
		maximumFractionDigits: 4 
	})} ${currency}`;
}

// ----------------------------
// --- COMMODITIES CSV PARSERS ---

/**
 * Parses BQL metadata dictionary string (e.g. "{'key': 'value', 'key2': 'value2'}") into plain object.
 * Handles empty dictionaries "{}" and malformed strings gracefully.
 * 
 * @param {string} metaStr - The metadata string from BQL.
 * @returns {Record<string, any>} Parsed metadata object or empty object on failure.
 */
export function parseMetadataString(metaStr: string): Record<string, any> {
	try {
		if (!metaStr || metaStr.trim() === '{}' || metaStr.trim() === '') {
			return {};
		}
		
		// Convert BQL format {'key': 'value'} to JSON format {"key": "value"}
		const jsonStr = metaStr
			.replace(/'/g, '"')  // Replace single quotes with double quotes
			.trim();
		
		return JSON.parse(jsonStr);
	} catch (e) {
		console.warn('Failed to parse metadata string:', metaStr, e);
		return {};
	}
}

/**
 * Parses CSV from getAllCommoditiesQuery into array of commodity symbols.
 * 
 * @param {string} csv - Raw CSV output from Query 1.
 * @returns {string[]} Array of commodity symbols (e.g. ['USD', 'BTC', 'AAPL']).
 */
export function parseCommoditiesListCSV(csv: string): string[] {
	try {
		const cleanCsv = csv.replace(/\r/g, "").trim();
		if (!cleanCsv) {
			return [];
		}
		
		const records: string[][] = parseCsv(cleanCsv, { 
			columns: false, 
			skip_empty_lines: true, 
			relax_column_count: true 
		});
		
		// Skip header row, extract first column
		const symbols = records.slice(1)
			.map(row => row[0]?.trim())
			.filter(symbol => symbol && symbol.length > 0);
		
		return symbols;
	} catch (e) {
		console.error('Error parsing commodities list CSV:', e, 'CSV:', csv);
		return [];
	}
}

/**
 * Parses CSV from getCommoditiesPriceDataQuery into map of price data keyed by symbol.
 * 
 * @param {string} csv - Raw CSV output from Query 2.
 * @returns {Map<string, {price: string | null, logo: string | null, date: string | null, isLatest: boolean}>}
 */
export function parseCommoditiesPriceDataCSV(csv: string): Map<string, {
	price: string | null;
	logo: string | null;
	date: string | null;
	isLatest: boolean;
}> {
	const priceDataMap = new Map();
	
	try {
		const cleanCsv = csv.replace(/\r/g, "").trim();
		if (!cleanCsv) {
			return priceDataMap;
		}
		
		const records: string[][] = parseCsv(cleanCsv, { 
			columns: false, 
			skip_empty_lines: true, 
			relax_column_count: true 
		});
		
		// Skip header row, parse data rows
		// Format: [date_, currency_, price_, logo_, islatest_]
		for (let i = 1; i < records.length; i++) {
			const row = records[i];
			if (row.length < 5) continue;
			
			const date = row[0]?.trim() || null;
			const currency = row[1]?.trim() || null;
			const price = row[2]?.trim() || null;
			const logo = row[3]?.trim() || null;
			const isLatestStr = row[4]?.trim().toLowerCase() || 'false';
			const isLatest = isLatestStr === 'true' || isLatestStr === '1';
			
			if (currency) {
				priceDataMap.set(currency, { price, logo, date, isLatest });
			}
		}
		
		return priceDataMap;
	} catch (e) {
		console.error('Error parsing commodities price data CSV:', e, 'CSV:', csv);
		return priceDataMap;
	}
}

/**
 * Parses CSV from getCommodityDetailsQuery into single commodity detail object.
 * 
 * @param {string} csv - Raw CSV output from Query 3.
 * @returns {{symbol: string, metadata: Record<string, any>, logo: string | null, priceMetadata: string | null, filename: string | null, lineno: number | null}}
 */
export function parseCommodityDetailsCSV(csv: string): {
	symbol: string;
	metadata: Record<string, any>;
	logo: string | null;
	priceMetadata: string | null;
	filename: string | null;
	lineno: number | null;
} {
	const defaultResult = { symbol: '', metadata: {}, logo: null, priceMetadata: null, filename: null, lineno: null };
	
	try {
		const cleanCsv = csv.replace(/\r/g, "").trim();
		if (!cleanCsv) {
			return defaultResult;
		}
		
		const records: string[][] = parseCsv(cleanCsv, { 
			columns: false, 
			skip_empty_lines: true, 
			relax_column_count: true 
		});
		
		// Should have 2 rows: header + data
		if (records.length < 2) {
			return defaultResult;
		}
		
		const row = records[1];
		// Format: [name_, meta_, logo_, pricemetadata_, filename_, lineno_]
		if (row.length < 6) {
			return defaultResult;
		}
		
		const symbol = row[0]?.trim() || '';
		const metaStr = row[1]?.trim() || '{}';
		const logo = row[2]?.trim() || null;
		const priceMetadata = row[3]?.trim() || null;
		const filename = row[4]?.trim() || null;
		const linenoStr = row[5]?.trim() || null;
		
		const metadata = parseMetadataString(metaStr);
		const parsedLineno = linenoStr ? parseInt(linenoStr, 10) : Number.NaN;
		const lineno = Number.isNaN(parsedLineno) ? null : parsedLineno;
		
		return { symbol, metadata, logo, priceMetadata, filename, lineno };
	} catch (e) {
		console.error('Error parsing commodity details CSV:', e, 'CSV:', csv);
		return defaultResult;
	}
}

/**
 * Saves metadata for a commodity directive using native TypeScript file operations.
 * Provides identical functionality to the backend PUT endpoint without requiring Flask.
 * 
 * @param {string} symbol - The commodity symbol (e.g. "USD", "AAPL").
 * @param {Record<string, any>} metadata - The metadata key-value pairs to save.
 * @param {string} filename - The beancount file containing the commodity directive.
 * @param {number} lineno - The line number (1-based) where the commodity directive starts.
 * @param {boolean} createBackup - Whether to create a backup before modifying the file.
 * @returns {Promise<{success: boolean, error?: string}>} The result of the save operation.
 */
export async function saveCommodityMetadata(
	symbol: string,
	metadata: Record<string, any>,
	filename: string,
	lineno: number,
	createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
	try {
		// Step 0: Convert WSL path to Windows path if needed
		const normalizedPath = convertWslPathToWindows(filename);
		console.debug(`[saveCommodityMetadata] Path conversion: ${filename} -> ${normalizedPath}`);
		
		// Step 1: Validate that the location points to the correct commodity
		const locationValid = await validateCommodityLocation(normalizedPath, lineno, symbol);
		if (!locationValid.success) {
			return { success: false, error: `Invalid location: ${locationValid.error}` };
		}

		// Step 2: Read the entire file
		const content = await readFile(normalizedPath, 'utf-8');
		const lines = content.split('\n');

		// Step 3: Find the commodity declaration block
		const startIndex = lineno - 1; // Convert to 0-based
		if (startIndex < 0 || startIndex >= lines.length) {
			return { success: false, error: 'Line number out of range' };
		}

		// Extract date from existing commodity directive (if present)
		const commodityLine = lines[startIndex];
		const dateMatch = commodityLine.match(/^(\d{4}-\d{2}-\d{2})\s+commodity/);
		const datePrefix = dateMatch ? `${dateMatch[1]} ` : '';
		
		// Find end of commodity block (lines with indentation are metadata)
		let endIndex = startIndex;
		for (let i = startIndex + 1; i < lines.length; i++) {
			const line = lines[i];
			// If line starts with whitespace/tab, it's part of metadata
			if (line.match(/^\s+\S/)) {
				endIndex = i;
			} else {
				// Found non-indented line, end of block
				break;
			}
		}

		// Step 4: Build new commodity declaration with updated metadata
		const metadataLines: string[] = [];
		for (const [key, value] of Object.entries(metadata)) {
			if (value !== undefined && value !== null) {
				// Format metadata line with proper indentation
				metadataLines.push(`  ${key}: "${String(value)}"`);
			}
		}

		const newDeclaration = [`${datePrefix}commodity ${symbol}`, ...metadataLines];

		// Step 5: Replace the old block with new declaration
		const newLines = [
			...lines.slice(0, startIndex),
			...newDeclaration,
			...lines.slice(endIndex + 1)
		];

		const newContent = newLines.join('\n');

		// Step 6: Create backup if requested
		await createBackupFile(normalizedPath, createBackup, 'saveCommodityMetadata');

		// Step 7: Atomic write (write to temp file, then rename)
		await atomicFileWrite(normalizedPath, newContent);

		console.debug(`[saveCommodityMetadata] Successfully saved metadata for ${symbol}`);
		return { success: true };

	} catch (error) {
		console.error('[saveCommodityMetadata] Error:', error);
		return { 
			success: false, 
			error: error instanceof Error ? error.message : String(error) 
		};
	}
}

// --- ACCOUNT MANAGEMENT ---

/**
 * Gets all open accounts using BQL query.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @returns {Promise<string[]>} Array of open account names.
 */
export async function getOpenAccounts(plugin: BeancountPlugin): Promise<string[]> {
	try {
		const query = `SELECT account FROM #accounts WHERE NOT bool(close)`;
		const csv = await runQuery(plugin, query);
		
		// Parse CSV to extract account names
		const records = parseCsv(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});
		
		return records.map((row: any) => row.account).filter((acc: string) => acc);
	} catch (error) {
		console.error('[getOpenAccounts] Error:', error);
		throw new Error(`Failed to fetch open accounts: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Fetches all distinct payees from the Beancount ledger using BQL.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @returns {Promise<string[]>} Array of distinct payee names.
 */
export async function getPayees(plugin: BeancountPlugin): Promise<string[]> {
	try {
		const query = `SELECT DISTINCT payee`;
		const csv = await runQuery(plugin, query);
		
		// Parse CSV to extract payee names
		const records = parseCsv(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});
		
		return records
			.map((row: any) => row.payee)
			.filter((payee: string) => payee && payee.trim() !== '')
			.sort();
	} catch (error) {
		console.error('[getPayees] Error:', error);
		// Return empty array on error to maintain compatibility
		return [];
	}
}

/**
 * Fetches all distinct tags from the Beancount ledger using BQL.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @returns {Promise<string[]>} Array of distinct tag names.
 */
export async function getTags(plugin: BeancountPlugin): Promise<string[]> {
	try {
		const query = `SELECT DISTINCT joinstr(tags) FROM entries WHERE tags IS NOT NULL`;
		const csv = await runQuery(plugin, query);
		
		// Parse CSV to extract tags
		const records = parseCsv(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});
		
		// The query returns unique sets of tags as comma-separated strings
		// e.g., "trip,food", "groceries", "trip,flight"
		// We need to split each set and flatten to get individual distinct tags
		const allTags = new Set<string>();
		
		records.forEach((row: any) => {
			// The column name from BQL is 'joinstr(tags)' or might be the first property
			const tagSet = row['joinstr(tags)'] || row.tags || Object.values(row)[0];
			
			if (tagSet && typeof tagSet === 'string') {
				// Split the comma-separated tags and clean each one
				const tags = tagSet.split(',').map((t: string) => t.trim().replace(/^#/, ''));
				tags.forEach((tag: string) => {
					if (tag) allTags.add(tag);
				});
			}
		});
		
		return Array.from(allTags).sort();
	} catch (error) {
		console.error('[getTags] Error:', error);
		// Return empty array on error to maintain compatibility
		return [];
	}
}

/**
 * Fetches all distinct commodities from the Beancount ledger using BQL.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @returns {Promise<Array<{name: string}>>} Array of commodity objects with name property.
 */
export async function getCommodities(plugin: BeancountPlugin): Promise<Array<{name: string}>> {
	try {
		const query = `SELECT name AS name_ FROM #commodities GROUP BY name`;
		const csv = await runQuery(plugin, query);
		
		// Parse CSV to extract commodity names
		const records = parseCsv(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});
		
		// Map to the expected format: array of objects with 'name' property
		return records
			.map((row: any) => ({ name: row.name_ || row.name || Object.values(row)[0] as string }))
			.filter((commodity: {name: string}) => commodity.name && commodity.name.trim() !== '')
			.sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name));
	} catch (error) {
		console.error('[getCommodities] Error:', error);
		// Return empty array on error to maintain compatibility
		return [];
	}
}

/**
 * Appends an Open directive to the end of the Beancount file.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @param {string} date - The date in YYYY-MM-DD format.
 * @param {string} account - The account name (e.g., Assets:Bank:Checking).
 * @param {string[]} [currencies] - Optional array of currencies.
 * @param {string} [booking] - Optional booking method.
 * @param {boolean} createBackup - Whether to create a backup before modifying the file.
 * @returns {Promise<{success: boolean, error?: string}>} The result of the operation.
 */
export async function saveOpenDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	currencies?: string[],
	booking?: string,
	createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = plugin.settings.beancountFilePath;
		if (!filePath) {
			return { success: false, error: 'Beancount file path not set' };
		}

		// Step 1: Normalize path (handle WSL)
		const normalizedPath = convertWslPathToWindows(filePath);

		// Step 2: Generate directive text
		const parts = [date, 'open', account];
		if (currencies && currencies.length > 0) {
			parts.push(currencies.join(','));
		}
		if (booking) {
			parts.push(`"${booking}"`);
		}
		const directiveText = parts.join(' ');

		// Step 3: Create backup if requested
		await createBackupFile(normalizedPath, createBackup, 'saveOpenDirective');

		// Step 4: Read file and append directive
		const content = await readFile(normalizedPath, 'utf-8');
		const newContent = content.endsWith('\n') 
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;

		// Step 5: Atomic write (write to temp file, then rename)
		await atomicFileWrite(normalizedPath, newContent);

		console.debug(`[saveOpenDirective] Successfully saved open directive for ${account}`);
		return { success: true };

	} catch (error) {
		console.error(`[saveOpenDirective] Error:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Appends a Balance assertion to the end of the Beancount file.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @param {string} date - The date in YYYY-MM-DD format.
 * @param {string} account - The account name (e.g., Assets:Bank:Checking).
 * @param {string} amount - The amount (e.g., "1000.00").
 * @param {string} currency - The currency (e.g., "USD").
 * @param {string} [tolerance] - Optional tolerance (e.g., "0.01").
 * @param {boolean} createBackup - Whether to create a backup before modifying the file.
 * @returns {Promise<{success: boolean, error?: string}>} The result of the operation.
 */
export async function createBalanceAssertion(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	amount: string,
	currency: string,
	tolerance?: string,
	createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = plugin.settings.beancountFilePath;
		if (!filePath) {
			return { success: false, error: 'Beancount file path not set' };
		}

		// Step 1: Normalize path (handle WSL)
		const normalizedPath = convertWslPathToWindows(filePath);

		// Step 2: Generate directive text
		// Format: YYYY-MM-DD balance Account Amount Currency ~ Tolerance
		let directiveText = `${date} balance ${account}  ${amount} ${currency}`;
		if (tolerance) {
			directiveText += ` ~ ${tolerance}`;
		}

		// Step 3: Create backup if requested
		await createBackupFile(normalizedPath, createBackup, 'createBalanceAssertion');

		// Step 4: Read file and append directive
		const content = await readFile(normalizedPath, 'utf-8');
		const newContent = content.endsWith('\n') 
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;

		// Step 5: Atomic write (write to temp file, then rename)
		await atomicFileWrite(normalizedPath, newContent);

		console.debug(`[createBalanceAssertion] Successfully saved balance assertion for ${account}`);
		return { success: true };

	} catch (error) {
		console.error(`[createBalanceAssertion] Error:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Appends a Note directive to the end of the Beancount file.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @param {string} date - The date in YYYY-MM-DD format.
 * @param {string} account - The account name (e.g., Assets:Bank:Checking).
 * @param {string} comment - The note comment text.
 * @param {string[]} [tags] - Optional array of tags.
 * @param {string[]} [links] - Optional array of links.
 * @param {boolean} createBackup - Whether to create a backup before modifying the file.
 * @returns {Promise<{success: boolean, error?: string}>} The result of the operation.
 */
export async function createNote(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	comment: string,
	tags?: string[],
	links?: string[],
	createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = plugin.settings.beancountFilePath;
		if (!filePath) {
			return { success: false, error: 'Beancount file path not set' };
		}

		// Step 1: Normalize path (handle WSL)
		const normalizedPath = convertWslPathToWindows(filePath);

		// Step 2: Generate directive text
		// Format: YYYY-MM-DD note Account "Comment text" #tag1 #tag2 ^link1 ^link2
		const parts = [date, 'note', account, `"${comment}"`];
		
		// Add tags (with # prefix)
		if (tags && tags.length > 0) {
			for (const tag of tags) {
				const cleanTag = tag.replace(/^#/, '');
				if (cleanTag) {
					parts.push(`#${cleanTag}`);
				}
			}
		}
		
		// Add links (with ^ prefix)
		if (links && links.length > 0) {
			for (const link of links) {
				parts.push(`^${link}`);
			}
		}
		
		const directiveText = parts.join(' ');

		// Step 3: Create backup if requested
		await createBackupFile(normalizedPath, createBackup, 'createNote');

		// Step 4: Read file and append directive
		const content = await readFile(normalizedPath, 'utf-8');
		const newContent = content.endsWith('\n') 
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;

		// Step 5: Atomic write (write to temp file, then rename)
		await atomicFileWrite(normalizedPath, newContent);

		console.debug(`[createNote] Successfully saved note for ${account}`);
		return { success: true };

	} catch (error) {
		console.error(`[createNote] Error:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Fetches balance entries from Beancount using BQL query.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @param {any} filters - Filters object (startDate, endDate, account).
 * @param {number} page - Page number (1-indexed).
 * @param {number} pageSize - Number of entries per page.
 * @returns {Promise<any>} JournalApiResponse with entries, total_count, etc.
 */
export async function getBalanceEntries(
	plugin: BeancountPlugin,
	filters: any = {},
	page: number = 1,
	pageSize: number = 200
): Promise<any> {
	try {
		console.debug('[getBalanceEntries] Fetching with filters:', filters);

		// Build BQL query with filters
		let whereConditions: string[] = [];
		
		if (filters.startDate) {
			whereConditions.push(`date >= ${filters.startDate}`);
		}
		if (filters.endDate) {
			whereConditions.push(`date <= ${filters.endDate}`);
		}
		if (filters.account) {
			whereConditions.push(`account ~ "${filters.account}"`);
		}

		const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
		
		// Query to get all balance assertions
		const query = `SELECT date, account, amount, tolerance, discrepancy FROM #balances ${whereClause} ORDER BY date DESC, account`;

		console.debug('[getBalanceEntries] Running BQL query:', query);
		const csv = await runQuery(plugin, query);

		// Parse CSV
		const parser = require('csv-parse/sync');
		const records = parser.parse(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});

		console.debug(`[getBalanceEntries] Parsed ${records.length} balance rows`);

		// Convert to JournalBalance objects
		let balances: any[] = [];

		for (const row of records) {
			// Parse amount - format is "100.00 USD"
			const amountStr = row['amount'] || '';
			let amount = '';
			let currency = '';
			
			if (amountStr && amountStr.trim()) {
				const amountParts = amountStr.trim().split(/\s+/);
				if (amountParts.length >= 2) {
					amount = amountParts[0];
					currency = amountParts[1];
				}
			}

			// Generate a simple ID from date + account
			const id = `balance_${row['date']}_${row['account'].replace(/:/g, '_')}`;

			const balance = {
				id,
				type: 'balance',
				date: row['date'],
				account: row['account'],
				amount,
				currency,
				tolerance: row['tolerance'] || null,
				diff_amount: row['discrepancy'] || null,
				metadata: {}
			};

			balances.push(balance);
		}

		// Apply search term filter (in-memory)
		if (filters.searchTerm) {
			const searchLower = filters.searchTerm.toLowerCase();
			balances = balances.filter((bal: any) => {
				const accountMatch = bal.account?.toLowerCase().includes(searchLower);
				return accountMatch;
			});
		}

		// Sort by date descending
		balances.sort((a: any, b: any) => {
			const dateCompare = b.date.localeCompare(a.date);
			if (dateCompare !== 0) return dateCompare;
			return a.account.localeCompare(b.account);
		});

		// Calculate pagination
		const totalCount = balances.length;
		const offset = (page - 1) * pageSize;
		const paginatedBalances = balances.slice(offset, offset + pageSize);
		const hasMore = offset + paginatedBalances.length < totalCount;

		console.debug(`[getBalanceEntries] Returning ${paginatedBalances.length} of ${totalCount} balances`);

		return {
			entries: paginatedBalances,
			total_count: totalCount,
			returned_count: paginatedBalances.length,
			offset,
			limit: pageSize,
			has_more: hasMore
		};

	} catch (error) {
		console.error('[getBalanceEntries] Error:', error);
		throw error;
	}
}

/**
 * Fetches note entries from Beancount using BQL query.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @param {any} filters - Filters object (startDate, endDate, account).
 * @param {number} page - Page number (1-indexed).
 * @param {number} pageSize - Number of entries per page.
 * @returns {Promise<any>} JournalApiResponse with entries, total_count, etc.
 */
export async function getNoteEntries(
	plugin: BeancountPlugin,
	filters: any = {},
	page: number = 1,
	pageSize: number = 200
): Promise<any> {
	try {
		console.debug('[getNoteEntries] Fetching with filters:', filters);

		// Build BQL query with filters
		let whereConditions: string[] = [];
		
		if (filters.startDate) {
			whereConditions.push(`date >= ${filters.startDate}`);
		}
		if (filters.endDate) {
			whereConditions.push(`date <= ${filters.endDate}`);
		}
		if (filters.account) {
			whereConditions.push(`account ~ "${filters.account}"`);
		}

		const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
		
		// Query to get all notes
		const query = `SELECT date, account, comment, tags, links, meta FROM #notes ${whereClause} ORDER BY date DESC, account`;

		console.debug('[getNoteEntries] Running BQL query:', query);
		const csv = await runQuery(plugin, query);

		// Parse CSV
		const parser = require('csv-parse/sync');
		const records = parser.parse(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});

		console.debug(`[getNoteEntries] Parsed ${records.length} note rows`);

		// Convert to JournalNote objects
		let notes: any[] = [];

		for (const row of records) {
			// Generate a simple ID from date + account
			const id = `note_${row['date']}_${row['account'].replace(/:/g, '_')}`;

			// Parse metadata
			const metaStr = row['meta'] || '{}';
			let metadata: Record<string, any> = {};
			try {
				metadata = JSON.parse(metaStr);
			} catch {
				metadata = { raw: metaStr };
			}

			const note = {
				id,
				type: 'note',
				date: row['date'],
				account: row['account'],
				comment: row['comment'] || '',
				metadata
			};

			notes.push(note);
		}

		// Apply search term filter (in-memory)
		if (filters.searchTerm) {
			const searchLower = filters.searchTerm.toLowerCase();
			notes = notes.filter((note: any) => {
				const accountMatch = note.account?.toLowerCase().includes(searchLower);
				const commentMatch = note.comment?.toLowerCase().includes(searchLower);
				return accountMatch || commentMatch;
			});
		}

		// Sort by date descending
		notes.sort((a: any, b: any) => {
			const dateCompare = b.date.localeCompare(a.date);
			if (dateCompare !== 0) return dateCompare;
			return a.account.localeCompare(b.account);
		});

		// Calculate pagination
		const totalCount = notes.length;
		const offset = (page - 1) * pageSize;
		const paginatedNotes = notes.slice(offset, offset + pageSize);
		const hasMore = offset + paginatedNotes.length < totalCount;

		console.debug(`[getNoteEntries] Returning ${paginatedNotes.length} of ${totalCount} notes`);

		return {
			entries: paginatedNotes,
			total_count: totalCount,
			returned_count: paginatedNotes.length,
			offset,
			limit: pageSize,
			has_more: hasMore
		};

	} catch (error) {
		console.error('[getNoteEntries] Error:', error);
		throw error;
	}
}

// --- Transaction Creation ---

/**
 * Generates properly formatted Beancount transaction text from a JournalTransaction object.
 * 
 * @param {any} transactionData - The transaction data object.
 * @returns {string} Formatted Beancount transaction text.
 */
export function generateTransactionText(transactionData: any): string {
	const date = transactionData.date;
	const flag = transactionData.flag || '*';
	const payee = transactionData.payee || '';
	const narration = transactionData.narration || '';
	const tags = transactionData.tags || [];
	const links = transactionData.links || [];
	
	// Format payee and narration
	let payeeNarration = '';
	if (payee && narration) {
		payeeNarration = `"${payee}" "${narration}"`;
	} else if (payee) {
		payeeNarration = `"${payee}" ""`;
	} else if (narration) {
		payeeNarration = `"${narration}"`;
	} else {
		payeeNarration = '""';
	}
	
	// Build the transaction header with tags and links
	const headerParts = [date, flag, payeeNarration];
	
	// Add tags (with # prefix, strip any existing # to avoid double prefixes)
	if (tags && tags.length > 0) {
		for (const tag of tags) {
			const cleanTag = tag.replace(/^#/, '');
			if (cleanTag) {
				headerParts.push(`#${cleanTag}`);
			}
		}
	}
	
	// Add links (with ^ prefix)
	if (links && links.length > 0) {
		for (const link of links) {
			headerParts.push(`^${link}`);
		}
	}
	
	// Start with the transaction line
	const lines = [headerParts.join(' ')];
	
	// Add transaction-level metadata if present
	const txnMetadata = transactionData.metadata || {};
	for (const [key, value] of Object.entries(txnMetadata)) {
		if (key !== 'filename' && key !== 'lineno') { // Skip internal metadata
			lines.push(`  ${key}: "${value}"`);
		}
	}
	
	// Add postings
	const postings = transactionData.postings || [];
	for (const posting of postings) {
		const account = posting.account;
		const amount = posting.amount;
		const currency = posting.currency;
		const cost = posting.cost;
		const price = posting.price;
		const postingFlag = posting.flag;
		const postingComment = posting.comment;
		const postingMetadata = posting.metadata || {};
		
		// Start posting line with optional flag
		let postingLine = '  ';
		if (postingFlag) {
			postingLine += `${postingFlag} `;
		}
		postingLine += account;
		
		if (amount && currency) {
			postingLine += `  ${amount} ${currency}`;
			
			// Add cost if present (e.g., {100.00 USD} or {{100.00 USD}} for total cost)
			if (cost) {
				const costNumber = cost.number;
				const costCurrency = cost.currency;
				const costDate = cost.date;
				const costLabel = cost.label;
				const isTotal = cost.isTotal || false;
				
				if (costNumber && costCurrency) {
					const openBrace = isTotal ? '{{' : '{';
					const closeBrace = isTotal ? '}}' : '}';
					
					postingLine += ` ${openBrace}${costNumber} ${costCurrency}`;
					
					if (costDate) {
						postingLine += `, ${costDate}`;
					}
					
					if (costLabel) {
						postingLine += `, "${costLabel}"`;
					}
					
					postingLine += closeBrace;
				} else if (costDate) {
					postingLine += ` {${costDate}}`;
				} else if (costLabel) {
					postingLine += ` {"${costLabel}"}`;
				}
			}
			
			// Add price if present (e.g., @ 100.00 USD or @@ 1000.00 USD for total price)
			if (price && price.amount && price.currency) {
				const priceSymbol = price.isTotal ? '@@' : '@';
				postingLine += ` ${priceSymbol} ${price.amount} ${price.currency}`;
			}
		}
		
		// Add inline comment if present
		if (postingComment) {
			postingLine += `  ; ${postingComment}`;
		}
		
		lines.push(postingLine);
		
		// Add posting-level metadata if present (indented 4 spaces total)
		for (const [key, value] of Object.entries(postingMetadata)) {
			lines.push(`    ${key}: "${value}"`);
		}
	}
	
	return lines.join('\n');
}

/**
 * Creates a new transaction in the Beancount file.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @param {any} transactionData - The transaction data.
 * @returns {Promise<{success: boolean, error?: string}>} Result object.
 */
export async function createTransaction(
	plugin: BeancountPlugin,
	transactionData: any
): Promise<{success: boolean, error?: string}> {
	try {
		const beancountFilePath = plugin.settings.beancountFilePath;
		if (!beancountFilePath) {
			return { success: false, error: 'Beancount file path not configured' };
		}

		// Convert WSL path if necessary
		const normalizedPath = convertWslPathToWindows(beancountFilePath);
		console.debug(`[createTransaction] Path conversion: ${beancountFilePath} -> ${normalizedPath}`);

		// Create backup if enabled
		const createBackup = plugin.settings.createBackups ?? true;
		await createBackupFile(normalizedPath, createBackup, 'createTransaction');

		// Generate transaction text
		const transactionText = generateTransactionText(transactionData);
		
		// Read current file content
		const currentContent = await readFile(normalizedPath, 'utf-8');
		
		// Append transaction with proper newlines
		const newContent = currentContent + '\n' + transactionText + '\n';
		
		// Write to temp file then rename (atomic operation)
		const tempPath = normalizedPath + '.tmp';
		await writeFile(tempPath, newContent, 'utf-8');
		renameSync(tempPath, normalizedPath);
		
		console.debug(`[createTransaction] Successfully created transaction in ${normalizedPath}`);
		
		return { success: true };
	} catch (error) {
		console.error('[createTransaction] Error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Updates an existing transaction in the Beancount file by finding it via its ID (hash)
 * and replacing it with updated content.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @param {string} transactionId - The transaction ID (hash from BQL).
 * @param {any} transactionData - The updated transaction data.
 * @returns {Promise<{success: boolean, error?: string}>} Result object.
 */
export async function updateTransaction(
	plugin: BeancountPlugin,
	transactionId: string,
	transactionData: any
): Promise<{success: boolean, error?: string}> {
	try {
		const beancountFilePath = plugin.settings.beancountFilePath;
		if (!beancountFilePath) {
			return { success: false, error: 'Beancount file path not configured' };
		}

		// Convert WSL path if necessary
		const normalizedPath = convertWslPathToWindows(beancountFilePath);
		console.debug(`[updateTransaction] Path conversion: ${beancountFilePath} -> ${normalizedPath}`);

		// Create backup if enabled
		const createBackup = plugin.settings.createBackups ?? true;
		await createBackupFile(normalizedPath, createBackup, 'updateTransaction');

		// Read current file content
		const currentContent = await readFile(normalizedPath, 'utf-8');
		const lines = currentContent.split('\n');

		// First, find the transaction using BQL query to get filename and lineno
		// Use escaped quotes for shell command
		const query = `SELECT filename, lineno FROM postings WHERE id = \\"${transactionId}\\" LIMIT 1`;
		const csv = await runQuery(plugin, query);
		
		const parser = require('csv-parse/sync');
		const records = parser.parse(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});

		if (records.length === 0) {
			return { success: false, error: `Transaction with ID ${transactionId} not found` };
		}

		const lineno = parseInt(records[0]['lineno']);
		if (isNaN(lineno) || lineno < 1 || lineno > lines.length) {
			return { success: false, error: `Invalid line number ${records[0]['lineno']} for transaction` };
		}

		// Convert to 0-based index
		const lineIndex = lineno - 1;

		// Find the start and end of the transaction block
		let startIndex = lineIndex;
		let endIndex = lineIndex;

		// Scan forward to find the end of the transaction (next non-indented line or blank line followed by non-indented)
		for (let i = lineIndex + 1; i < lines.length; i++) {
			const line = lines[i];
			
			// Empty line
			if (line.trim() === '') {
				// Check if next non-empty line is indented or not
				let foundNonEmpty = false;
				for (let j = i + 1; j < lines.length; j++) {
					if (lines[j].trim() !== '') {
						if (lines[j].startsWith(' ') || lines[j].startsWith('\t')) {
							// Still part of transaction
							endIndex = j;
						} else {
							// New entry starts
							foundNonEmpty = true;
						}
						break;
					}
				}
				if (foundNonEmpty) {
					endIndex = i - 1;
					break;
				}
				// If no non-empty line found after blank, include the blank
				endIndex = i;
			}
			// Indented line (posting or metadata)
			else if (line.startsWith(' ') || line.startsWith('\t')) {
				endIndex = i;
			}
			// Non-indented non-empty line (new entry)
			else {
				endIndex = i - 1;
				break;
			}
		}

		// If we reached end of file
		if (endIndex === lineIndex) {
			// Scan forward to find last line of transaction
			for (let i = lineIndex + 1; i < lines.length; i++) {
				const line = lines[i];
				if (line.trim() === '' || (!line.startsWith(' ') && !line.startsWith('\t'))) {
					endIndex = i - 1;
					break;
				}
				endIndex = i;
			}
		}

		console.debug(`[updateTransaction] Found transaction at lines ${startIndex + 1}-${endIndex + 1}`);

		// Generate new transaction text
		const newTransactionText = generateTransactionText(transactionData);

		// Replace the transaction lines
		const beforeTransaction = lines.slice(0, startIndex);
		const afterTransaction = lines.slice(endIndex + 1);
		const newLines = [
			...beforeTransaction,
			newTransactionText,
			...afterTransaction
		];

		const newContent = newLines.join('\n');

		// Write to temp file then rename (atomic operation)
		const tempPath = normalizedPath + '.tmp';
		await writeFile(tempPath, newContent, 'utf-8');
		renameSync(tempPath, normalizedPath);
		
		console.debug(`[updateTransaction] Successfully updated transaction ${transactionId} in ${normalizedPath}`);
		
		return { success: true };
	} catch (error) {
		console.error('[updateTransaction] Error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Deletes a transaction from the Beancount file by finding it via its ID (hash).
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @param {string} transactionId - The transaction ID (hash from BQL).
 * @returns {Promise<{success: boolean, error?: string}>} Result object.
 */
export async function deleteTransaction(
	plugin: BeancountPlugin,
	transactionId: string
): Promise<{success: boolean, error?: string}> {
	try {
		const beancountFilePath = plugin.settings.beancountFilePath;
		if (!beancountFilePath) {
			return { success: false, error: 'Beancount file path not configured' };
		}

		// Convert WSL path if necessary
		const normalizedPath = convertWslPathToWindows(beancountFilePath);
		console.debug(`[deleteTransaction] Path conversion: ${beancountFilePath} -> ${normalizedPath}`);

		// Create backup if enabled
		const createBackup = plugin.settings.createBackups ?? true;
		await createBackupFile(normalizedPath, createBackup, 'deleteTransaction');

		// Read current file content
		const currentContent = await readFile(normalizedPath, 'utf-8');
		const lines = currentContent.split('\n');

		// First, find the transaction using BQL query to get filename and lineno
		// Use escaped quotes for shell command
		const query = `SELECT filename, lineno FROM postings WHERE id = \\"${transactionId}\\" LIMIT 1`;
		const csv = await runQuery(plugin, query);
		
		const parser = require('csv-parse/sync');
		const records = parser.parse(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});

		if (records.length === 0) {
			return { success: false, error: `Transaction with ID ${transactionId} not found` };
		}

		const lineno = parseInt(records[0]['lineno']);
		if (isNaN(lineno) || lineno < 1 || lineno > lines.length) {
			return { success: false, error: `Invalid line number ${records[0]['lineno']} for transaction` };
		}

		// Convert to 0-based index
		const lineIndex = lineno - 1;

		// Find the start and end of the transaction block
		let startIndex = lineIndex;
		let endIndex = lineIndex;

		// Scan forward to find the end of the transaction (next non-indented line or blank line followed by non-indented)
		for (let i = lineIndex + 1; i < lines.length; i++) {
			const line = lines[i];
			
			// Empty line
			if (line.trim() === '') {
				// Check if next non-empty line is indented or not
				let foundNonEmpty = false;
				for (let j = i + 1; j < lines.length; j++) {
					if (lines[j].trim() !== '') {
						if (lines[j].startsWith(' ') || lines[j].startsWith('\t')) {
							// Still part of transaction
							endIndex = j;
						} else {
							// New entry starts
							foundNonEmpty = true;
						}
						break;
					}
				}
				if (foundNonEmpty) {
					endIndex = i - 1;
					break;
				}
				// If no non-empty line found after blank, include the blank
				endIndex = i;
			}
			// Indented line (posting or metadata)
			else if (line.startsWith(' ') || line.startsWith('\t')) {
				endIndex = i;
			}
			// Non-indented non-empty line (new entry)
			else {
				endIndex = i - 1;
				break;
			}
		}

		// If we reached end of file
		if (endIndex === lineIndex) {
			// Scan forward to find last line of transaction
			for (let i = lineIndex + 1; i < lines.length; i++) {
				const line = lines[i];
				if (line.trim() === '' || (!line.startsWith(' ') && !line.startsWith('\t'))) {
					endIndex = i - 1;
					break;
				}
				endIndex = i;
			}
		}

		// Also remove trailing blank line if present
		if (endIndex + 1 < lines.length && lines[endIndex + 1].trim() === '') {
			endIndex++;
		}

		console.debug(`[deleteTransaction] Found transaction at lines ${startIndex + 1}-${endIndex + 1}`);

		// Remove the transaction lines
		const beforeTransaction = lines.slice(0, startIndex);
		const afterTransaction = lines.slice(endIndex + 1);
		const newLines = [
			...beforeTransaction,
			...afterTransaction
		];

		const newContent = newLines.join('\n');

		// Write to temp file then rename (atomic operation)
		const tempPath = normalizedPath + '.tmp';
		await writeFile(tempPath, newContent, 'utf-8');
		renameSync(tempPath, normalizedPath);
		
		console.debug(`[deleteTransaction] Successfully deleted transaction ${transactionId} from ${normalizedPath}`);
		
		return { success: true };
	} catch (error) {
		console.error('[deleteTransaction] Error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Appends a Close directive to the end of the Beancount file.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance (for settings).
 * @param {string} date - The date in YYYY-MM-DD format.
 * @param {string} account - The account name (e.g., Assets:Bank:Checking).
 * @param {boolean} createBackup - Whether to create a backup before modifying the file.
 * @returns {Promise<{success: boolean, error?: string}>} The result of the operation.
 */
export async function saveCloseDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = plugin.settings.beancountFilePath;
		if (!filePath) {
			return { success: false, error: 'Beancount file path not set' };
		}

		// Step 1: Normalize path (handle WSL)
		const normalizedPath = convertWslPathToWindows(filePath);

		// Step 2: Generate directive text
		const directiveText = `${date} close ${account}`;

		// Step 3: Create backup if requested
		await createBackupFile(normalizedPath, createBackup, 'saveCloseDirective');

		// Step 4: Read file and append directive
		const content = await readFile(normalizedPath, 'utf-8');
		const newContent = content.endsWith('\n') 
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;

		// Step 5: Atomic write (write to temp file, then rename)
		await atomicFileWrite(normalizedPath, newContent);

		console.debug(`[saveCloseDirective] Successfully saved close directive for ${account}`);
		return { success: true };

	} catch (error) {
		console.error(`[saveCloseDirective] Error:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

// --- JOURNAL ENTRIES FETCHING ---

/**
 * Fetches transaction entries from Beancount using BQL query.
 * Groups postings by transaction ID and reconstructs JournalTransaction objects.
 * 
 * @param {BeancountPlugin} plugin - The plugin instance.
 * @param {any} filters - Filters object (startDate, endDate, account, payee, tag, searchTerm).
 * @param {number} page - Page number (1-indexed).
 * @param {number} pageSize - Number of entries per page.
 * @returns {Promise<any>} JournalApiResponse with entries, total_count, etc.
 */
export async function getTransactionEntries(
	plugin: BeancountPlugin,
	filters: any = {},
	page: number = 1,
	pageSize: number = 200
): Promise<any> {
	try {
		console.debug('[getTransactionEntries] Fetching with filters:', filters);

		// Build BQL query with filters
		let whereConditions: string[] = [];
		
		if (filters.startDate) {
			whereConditions.push(`date >= ${filters.startDate}`);
		}
		if (filters.endDate) {
			whereConditions.push(`date <= ${filters.endDate}`);
		}
		if (filters.account) {
			whereConditions.push(`account ~ "${filters.account}"`);
		}
		if (filters.payee) {
			whereConditions.push(`payee ~ "${filters.payee}"`);
		}
		if (filters.tag) {
			// Tag filter - check if tag is in the tags set
			whereConditions.push(`"${filters.tag}" IN tags`);
		}

		const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
		
		// Query to get all postings with transaction-level data
		// Note: Single line to avoid shell escaping issues with newlines
		const query = `SELECT id, date, flag, payee, narration, tags, links, filename, lineno, account, number, currency, cost_number, cost_currency, cost_date, price, entry.meta as entry_meta FROM postings ${whereClause} ORDER BY date DESC, id, account`;

		console.debug('[getTransactionEntries] Running BQL query:', query);
		const csv = await runQuery(plugin, query);

		// Parse CSV
		const parser = require('csv-parse/sync');
		const records = parser.parse(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});

		console.debug(`[getTransactionEntries] Parsed ${records.length} posting rows`);

		// Group postings by transaction ID
		const transactionsMap = new Map<string, any>();

		for (const row of records) {
			const txnId = row['id'];
			
			if (!transactionsMap.has(txnId)) {
				// Create new transaction object
				const tagsStr = row['tags'] || '';
				const linksStr = row['links'] || '';
				
				// Parse tags - comes as quoted CSV like "Test,Work"
				let tags: string[] = [];
				if (tagsStr && tagsStr.trim()) {
					tags = tagsStr.split(',').map((t: string) => t.trim()).filter((t: string) => t);
				}

				// Parse links - comma-separated plain text
				let links: string[] = [];
				if (linksStr && linksStr.trim()) {
					links = linksStr.split(',').map((l: string) => l.trim()).filter((l: string) => l);
				}

				// Parse entry metadata - comes as key-value pairs or {}
				const entryMetaStr = row['entry_meta'] || '{}';
				let metadata: Record<string, any> = {};
				try {
					// Try to parse as JSON
					metadata = JSON.parse(entryMetaStr);
				} catch {
					// If parsing fails, store as raw string
					metadata = { raw: entryMetaStr };
				}

				// Add filename and lineno to metadata
				if (row['filename']) {
					metadata['filename'] = row['filename'];
				}
				if (row['lineno']) {
					const lineno = parseInt(row['lineno']);
					if (!isNaN(lineno)) {
						metadata['lineno'] = lineno;
					}
				}

				transactionsMap.set(txnId, {
					id: txnId,
					type: 'transaction',
					date: row['date'],
					flag: row['flag'] || '*',
					payee: row['payee'] || null,
					narration: row['narration'] || '',
					tags,
					links,
					metadata,
					postings: []
				});
			}

			// Add posting to transaction
			const transaction = transactionsMap.get(txnId);
			const posting: any = {
				account: row['account'],
				amount: row['number'] || null,
				currency: row['currency'] || null,
				flag: null,
				comment: null,
				metadata: {}
			};

			// Add cost if present
			if (row['cost_number'] || row['cost_currency']) {
				posting.cost = {
					number: row['cost_number'] || null,
					currency: row['cost_currency'] || null,
					date: row['cost_date'] || null,
					label: null,
					isTotal: false
				};
			}

			// Add price if present - price is returned as "amount currency" string
			const priceStr = row['price'];
			if (priceStr && priceStr.trim()) {
				// Parse "100.00 USD" format
				const priceParts = priceStr.trim().split(/\s+/);
				if (priceParts.length >= 2) {
					posting.price = {
						amount: priceParts[0],
						currency: priceParts[1],
						isTotal: false
					};
				}
			}

			transaction.postings.push(posting);
		}

		// Convert map to array
		let transactions = Array.from(transactionsMap.values());

		// Apply search term filter (in-memory)
		if (filters.searchTerm) {
			const searchLower = filters.searchTerm.toLowerCase();
			transactions = transactions.filter((txn: any) => {
				const narrationMatch = txn.narration?.toLowerCase().includes(searchLower);
				const payeeMatch = txn.payee?.toLowerCase().includes(searchLower);
				const accountMatch = txn.postings.some((p: any) => 
					p.account?.toLowerCase().includes(searchLower)
				);
				return narrationMatch || payeeMatch || accountMatch;
			});
		}

		// Transactions are already sorted by BQL query (date DESC, id, account)
		// Just ensure consistent ordering
		transactions.sort((a: any, b: any) => {
			const dateCompare = b.date.localeCompare(a.date);
			if (dateCompare !== 0) return dateCompare;
			return a.id.localeCompare(b.id);
		});

		// Calculate pagination
		const totalCount = transactions.length;
		const offset = (page - 1) * pageSize;
		const paginatedTransactions = transactions.slice(offset, offset + pageSize);
		const hasMore = offset + paginatedTransactions.length < totalCount;

		console.debug(`[getTransactionEntries] Returning ${paginatedTransactions.length} of ${totalCount} transactions`);

		return {
			entries: paginatedTransactions,
			total_count: totalCount,
			returned_count: paginatedTransactions.length,
			offset,
			limit: pageSize,
			has_more: hasMore
		};

	} catch (error) {
		console.error('[getTransactionEntries] Error:', error);
		throw error;
	}
}