// src/utils/index.ts
import { exec } from 'child_process';
import type { ExecException } from 'child_process';
import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main'; // Needed for settings type

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
