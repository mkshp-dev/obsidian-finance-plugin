// src/utils.ts
import { exec } from 'child_process';
import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from './main'; // Needed for settings type

// --- QUERY RUNNER ---
// Pass the plugin instance to access settings
export function runQuery(plugin: BeancountPlugin, query: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const filePath = plugin.settings.beancountFilePath;
		const commandName = plugin.settings.beancountCommand;
		if (!filePath) return reject(new Error('File path not set.'));
		if (!commandName) return reject(new Error('Command not set.'));
		const command = `${commandName} -f csv "${filePath}" "${query}"`;
		exec(command, (error, stdout, stderr) => {
			if (error) return reject(error);
			if (stderr) return reject(new Error(stderr));
			resolve(stdout);
		});
	});
}

// --- CSV PARSER HELPER ---
export function parseSingleValue(csv: string): string {
	try {
		const records: string[][] = parseCsv(csv, { columns: false, skip_empty_lines: true });
		if (records.length > 1 && records[1].length > 0 && records[1][0] && records[1][0].trim() !== '') {
			return records[1][0].trim();
		}
		console.warn("parseSingleValue: No valid data found, returning '0 USD'. CSV:", csv);
		return '0 USD';
	} catch (e) {
		console.error("Error parsing single value CSV:", e, "CSV:", csv);
		return '0 USD';
	}
}

// --- PATH CONVERTER ---
export function convertWslPathToWindows(wslPath: string): string {
	const match = wslPath.match(/^\/mnt\/([a-zA-Z])\//);
	if (match) {
		const driveLetter = match[1].toUpperCase();
		return wslPath.replace(/^\/mnt\/[a-zA-Z]\//, `${driveLetter}:\\`).replace(/\//g, '\\');
	}
	return wslPath;
}

// --- ACCOUNT TREE BUILDER ---
export interface AccountNode {
	name: string;
	fullName: string | null;
	children: AccountNode[];
}
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

// src/utils.ts
// ... (other functions)

// --- AMOUNT PARSER HELPER ---
export function parseAmount(amountString: string): { amount: number; currency: string } {
    // Default values
    const defaultValue = { amount: 0, currency: 'USD' }; // Or determine default currency elsewhere

    if (!amountString || typeof amountString !== 'string') {
        return defaultValue;
    }

    // Regex to capture number (with optional sign, commas) and currency symbol
    const match = amountString.match(/(-?[\d,]+(?:\.\d+)?)\s*(\S+)/);
    if (match) {
        try {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            const currency = match[2];
            return { amount: isNaN(amount) ? 0 : amount, currency: currency || 'USD' };
        } catch (e) {
            console.error("Error parsing amount:", e, "String:", amountString);
            return defaultValue; // Return default on parsing error
        }
    }
    console.warn("Could not parse amount string:", amountString);
    return defaultValue; // Return default if regex doesn't match
}
// ----------------------------

// ... (rest of utils.ts)