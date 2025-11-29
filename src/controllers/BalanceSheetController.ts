// src/controllers/BalanceSheetController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { extractConvertedAmount, extractNonReportingCurrencies } from '../utils/index';

/**
 * Interface representing a node in the balance sheet hierarchy.
 */
export interface AccountItem {
	/** Full account path (e.g., "Assets:Bank"). */
	account: string;
	/** Display name (e.g., "Bank"). */
	displayName: string;
	/** Hierarchy depth level (0-based). */
	level: number;
	/** Formatted amount string. */
	amount: string;
	/** Numeric amount value. */
	amountNumber: number;
	/** String representation of other currencies held. */
	otherCurrencies: string;
	/** True if this is a parent category, false if a leaf account. */
	isCategory: boolean;
	/** Child accounts/categories. */
	children?: AccountItem[];
}

/**
 * Interface representing the state of the Balance Sheet view.
 */
export interface BalanceSheetState {
	/** Whether data is loading. */
	isLoading: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Tree of Asset accounts. */
	assets: AccountItem[];
	/** Tree of Liability accounts. */
	liabilities: AccountItem[];
	/** Tree of Equity accounts. */
	equity: AccountItem[];
	/** Total numeric value of Assets. */
	totalAssets: number;
	/** Total numeric value of Liabilities. */
	totalLiabilities: number;
	/** Total numeric value of Equity. */
	totalEquity: number;
	/** Total numeric value of Liabilities + Equity. */
	totalLiabEquity: number;
	/** The reporting currency used. */
	currency: string;
	/** Whether multi-currency entries were detected. */
	hasUnconvertedCommodities: boolean;
	/** Warning message for unconverted commodities. */
	unconvertedWarning: string | null;
	/** Current valuation method used. */
	valuationMethod: 'convert' | 'cost' | 'units';
}

/**
 * BalanceSheetController
 *
 * Manages the data fetching and state for the Balance Sheet tab.
 * Responsible for querying account balances, building the hierarchy,
 * calculating totals, and handling different valuation methods.
 */
export class BalanceSheetController {
	private plugin: BeancountPlugin;
	public state: Writable<BalanceSheetState>;

	/**
	 * Creates an instance of BalanceSheetController.
	 * @param {BeancountPlugin} plugin - The main plugin instance.
	 */
	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		this.state = writable({
			isLoading: true,
			error: null,
			assets: [],
			liabilities: [],
			equity: [],
			totalAssets: 0,
			totalLiabilities: 0,
			totalEquity: 0,
			totalLiabEquity: 0,
			currency: plugin.settings.operatingCurrency || 'USD',
			hasUnconvertedCommodities: false,
			unconvertedWarning: null,
			valuationMethod: 'convert' as const,
		});
	}

	/**
	 * Builds a hierarchical structure from flat account entries.
	 * @param {[string, string][]} accounts - List of [accountName, rawAmount] tuples.
	 * @param {string} accountType - The root account type (e.g. 'Assets').
	 * @param {'convert' | 'cost' | 'units'} [valuationMethod='convert'] - The valuation method.
	 * @returns {AccountItem[]} The list of root account items.
	 */
	private buildAccountHierarchy(accounts: [string, string][], accountType: string, valuationMethod: 'convert' | 'cost' | 'units' = 'convert'): AccountItem[] {
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		const accountMap = new Map<string, AccountItem>();
		const rootAccounts: AccountItem[] = [];

		// Group accounts by their hierarchy levels
		for (const [fullAccount, rawAmount] of accounts) {
			let convertedAmount: string;
			let otherCurrencies: string;
			
			if (valuationMethod === 'convert') {
				// Use extractConvertedAmount to handle multi-currency results
				convertedAmount = extractConvertedAmount(rawAmount, reportingCurrency);
				otherCurrencies = extractNonReportingCurrencies(rawAmount, reportingCurrency);
			} else {
				// For cost and units, use the raw amount as-is (no currency extraction needed)
				convertedAmount = rawAmount;
				otherCurrencies = '';
			}
			
			const amountNumber = parseFloat(convertedAmount.split(' ')[0].replace(/,/g, '')) || 0;

			const parts = fullAccount.split(':');
			let currentPath = '';

			// Build hierarchy from root to leaf
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const parentPath = currentPath;
				currentPath = currentPath ? `${currentPath}:${part}` : part;
				
				if (!accountMap.has(currentPath)) {
					const defaultCurrency = valuationMethod === 'convert' ? reportingCurrency : '';
					const item: AccountItem = {
						account: currentPath,
						displayName: part,
						level: i,
						amount: i === parts.length - 1 ? convertedAmount : `0.00 ${defaultCurrency}`,
						amountNumber: i === parts.length - 1 ? amountNumber : 0,
						otherCurrencies: i === parts.length - 1 ? otherCurrencies : '',
						isCategory: i < parts.length - 1,
						children: []
					};

					accountMap.set(currentPath, item);

					// Add to parent's children or root
					if (parentPath && accountMap.has(parentPath)) {
						accountMap.get(parentPath)!.children!.push(item);
					} else if (i === 0) {
						rootAccounts.push(item);
					}
				} else if (i === parts.length - 1) {
					// Update leaf account amount and other currencies
					const existing = accountMap.get(currentPath)!;
					existing.amount = convertedAmount;
					existing.amountNumber = amountNumber;
					existing.otherCurrencies = otherCurrencies;
				}
			}
		}

		// Calculate category totals (bottom-up)
		const displayCurrency = valuationMethod === 'convert' ? reportingCurrency : '';
		this.calculateCategoryTotals(rootAccounts, displayCurrency);

		return rootAccounts;
	}

	/**
	 * Recursively calculates totals for category nodes based on children.
	 * @param {AccountItem[]} accounts - The account nodes to process.
	 * @param {string} currency - The reporting currency.
	 * @returns {number} The sum of amounts.
	 */
	private calculateCategoryTotals(accounts: AccountItem[], currency: string): number {
		let total = 0;
		for (const account of accounts) {
			if (account.children && account.children.length > 0) {
				const childTotal = this.calculateCategoryTotals(account.children, currency);
				account.amountNumber = childTotal;
				
				// For units or cost view, show aggregated info differently
				const currentState = get(this.state);
				if (currentState.valuationMethod === 'units') {
					account.amount = `${childTotal.toFixed(2)} units`;
				} else if (currentState.valuationMethod === 'cost') {
					account.amount = `${childTotal.toFixed(2)} ${currency}`;
				} else {
					account.amount = `${childTotal.toFixed(2)} ${currency}`;
				}
				
				// Aggregate other currencies from children - collect unique currencies
				const childOtherCurrencies = account.children
					.map(child => child.otherCurrencies)
					.filter(curr => curr && curr.trim() !== '')
					.flatMap(curr => curr.split(/[,\n]/).map(c => c.trim()))
					.filter((curr, index, arr) => arr.indexOf(curr) === index && curr !== '') // Remove duplicates and empty strings
					.join('\n'); // Use newlines for better multi-line display
				account.otherCurrencies = childOtherCurrencies;
				
				total += childTotal;
			} else {
				total += account.amountNumber;
			}
		}
		return total;
	}

	/**
	 * Sets the valuation method (market value, at cost, or units) and reloads data.
	 * @param {'convert' | 'cost' | 'units'} method - The valuation method.
	 */
	async setValuationMethod(method: 'convert' | 'cost' | 'units') {
		await this.loadData(method);
	}

	/**
	 * Flattens the hierarchy for a linear list display if needed (but keeps children property).
	 * Useful for ensuring all nodes are traversable in a list.
	 * @param {AccountItem[]} accounts - The root nodes.
	 * @returns {AccountItem[]} Flattened list of all nodes.
	 */
	private flattenHierarchy(accounts: AccountItem[]): AccountItem[] {
		const result: AccountItem[] = [];
		
		const flatten = (items: AccountItem[]) => {
			for (const item of items) {
				result.push(item);
				if (item.children && item.children.length > 0) {
					flatten(item.children);
				}
			}
		};
		
		flatten(accounts);
		return result;
	}

	/**
	 * Main data fetching method.
	 * Runs Beancount queries based on the valuation method and updates state.
	 * @param {'convert' | 'cost' | 'units'} [valuationMethod='convert'] - The valuation method to use.
	 */
	async loadData(valuationMethod: 'convert' | 'cost' | 'units' = 'convert') {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		
		if (valuationMethod === 'convert' && !reportingCurrency) {
			this.state.update(s => ({ ...s, isLoading: false, error: "Operating currency not set." }));
			return;
		}

		try {
			let query: string;
			switch (valuationMethod) {
				case 'convert':
					query = queries.getBalanceSheetQuery(reportingCurrency);
					break;
				case 'cost':
					query = queries.getBalanceSheetQueryByCost();
					break;
				case 'units':
					query = queries.getBalanceSheetQueryByUnits();
					break;
			}

			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true });

			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('account');
			const rows = firstRowIsHeader ? records.slice(1) : records;

			let tempAssets: [string, string][] = [];
			let tempLiab: [string, string][] = [];
			let tempEquity: [string, string][] = [];
			let hasUnconvertedCommodities = false;
			const unconvertedAccounts: string[] = [];

			for (const row of rows) {
				if (row.length < 2) continue;
				const [account, amountStr] = row;

				// Check for multi-currency results (only relevant for convert method)
				if (valuationMethod === 'convert' && amountStr.includes(',')) {
					hasUnconvertedCommodities = true;
					unconvertedAccounts.push(account);
				}

				if (account.startsWith('Assets')) {
					tempAssets.push([account, amountStr]);
				} else if (account.startsWith('Liabilities')) {
					tempLiab.push([account, amountStr]);
				} else if (account.startsWith('Equity')) {
					tempEquity.push([account, amountStr]);
				}
			}

			// Build hierarchical structures
			const assetsHierarchy = this.buildAccountHierarchy(tempAssets, 'Assets', valuationMethod);
			const liabilitiesHierarchy = this.buildAccountHierarchy(tempLiab, 'Liabilities', valuationMethod);
			const equityHierarchy = this.buildAccountHierarchy(tempEquity, 'Equity', valuationMethod);

			// Calculate totals
			const displayCurrency = valuationMethod === 'convert' ? reportingCurrency : '';
			const totalAssets = this.calculateCategoryTotals(assetsHierarchy, displayCurrency);
			const totalLiabilities = this.calculateCategoryTotals(liabilitiesHierarchy, displayCurrency);
			const totalEquity = this.calculateCategoryTotals(equityHierarchy, displayCurrency);

			// Create warning message
			let unconvertedWarning = null;
			if (hasUnconvertedCommodities) {
				unconvertedWarning = `Multi-currency accounts detected. ${reportingCurrency} amounts are shown in the first column, other currencies are displayed separately in the second column. Only ${reportingCurrency} amounts are included in totals.`;
			}

			// Update the store with all new data
			this.state.set({
				isLoading: false,
				error: null,
				assets: this.flattenHierarchy(assetsHierarchy),
				liabilities: this.flattenHierarchy(liabilitiesHierarchy),
				equity: this.flattenHierarchy(equityHierarchy),
				totalAssets,
				totalLiabilities,
				totalEquity,
				totalLiabEquity: totalLiabilities + totalEquity,
				currency: displayCurrency || 'Mixed',
				hasUnconvertedCommodities,
				unconvertedWarning,
				valuationMethod
			});

		} catch (e) {
			console.error("Error loading balance sheet:", e);
			this.state.update(s => ({ ...s, isLoading: false, error: e.message }));
		}
	}
}
