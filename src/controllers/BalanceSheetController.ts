// src/controllers/BalanceSheetController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { extractConvertedAmount, extractNonReportingCurrencies } from '../utils/index';

// Define account hierarchy item
export interface AccountItem {
	account: string;
	displayName: string;
	level: number;
	amount: string;
	amountNumber: number;
	otherCurrencies: string;
	isCategory: boolean;
	children?: AccountItem[];
}

// Define the shape of our state
export interface BalanceSheetState {
	isLoading: boolean;
	error: string | null;
	assets: AccountItem[];
	liabilities: AccountItem[];
	equity: AccountItem[];
	totalAssets: number;
	totalLiabilities: number;
	totalEquity: number;
	totalLiabEquity: number;
	currency: string;
	hasUnconvertedCommodities: boolean;
	unconvertedWarning: string | null;
	valuationMethod: 'convert' | 'cost' | 'units';
}

export class BalanceSheetController {
	private plugin: BeancountPlugin;
	public state: Writable<BalanceSheetState>;

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
			currency: plugin.settings.reportingCurrency || 'USD',
			hasUnconvertedCommodities: false,
			unconvertedWarning: null,
			valuationMethod: 'convert' as const,
		});
	}

	// Helper method to build hierarchical account structure
	private buildAccountHierarchy(accounts: [string, string][], accountType: string, valuationMethod: 'convert' | 'cost' | 'units' = 'convert'): AccountItem[] {
		const reportingCurrency = this.plugin.settings.reportingCurrency;
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

	// Recursively calculate totals for category accounts
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

	// Method to change valuation method and reload data
	async setValuationMethod(method: 'convert' | 'cost' | 'units') {
		await this.loadData(method);
	}

	// Flatten hierarchy for display with proper indentation
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

	// The main data-fetching method
	async loadData(valuationMethod: 'convert' | 'cost' | 'units' = 'convert') {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));
		const reportingCurrency = this.plugin.settings.reportingCurrency;
		
		if (valuationMethod === 'convert' && !reportingCurrency) {
			this.state.update(s => ({ ...s, isLoading: false, error: "Reporting Currency not set." }));
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