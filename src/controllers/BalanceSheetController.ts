// src/controllers/BalanceSheetController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';

// Define the shape of our state
export interface BalanceSheetState {
	isLoading: boolean;
	error: string | null;
	assets: [string, string][];
	liabilities: [string, string][];
	equity: [string, string][];
	totalAssets: number;
	totalLiabilities: number;
	totalEquity: number;
	totalLiabEquity: number;
	currency: string;
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
		});
	}

	// The main data-fetching method
	async loadData() {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));
		const reportingCurrency = this.plugin.settings.reportingCurrency;
		if (!reportingCurrency) {
			this.state.update(s => ({ ...s, isLoading: false, error: "Reporting Currency not set." }));
			return;
		}

		try {
			const query = queries.getBalanceSheetQuery(reportingCurrency);
			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true });

			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('account');
			const rows = firstRowIsHeader ? records.slice(1) : records;

			let tempAssets: [string, string][] = [];
			let tempLiab: [string, string][] = [];
			let tempEquity: [string, string][] = [];
			let runningTotalAssets = 0;
			let runningTotalLiab = 0;
			let runningTotalEquity = 0;
			let newCurrency = reportingCurrency;

			for (const row of rows) {
				if (row.length < 2) continue;
				const [account, amountStr] = row;
				const amountNum = parseFloat(amountStr.split(' ')[0].replace(/,/g, '')) || 0;
				newCurrency = amountStr.split(' ')[1] || reportingCurrency;

				const lastColonIndex = account.lastIndexOf(':');
				const trimmedName = lastColonIndex > -1 ? account.substring(lastColonIndex + 1) : account;
				
				const formattedRow: [string, string] = [trimmedName, amountStr];

				if (account.startsWith('Assets')) {
					tempAssets.push(formattedRow);
					runningTotalAssets += amountNum;
				} else if (account.startsWith('Liabilities')) {
					tempLiab.push(formattedRow);
					runningTotalLiab += amountNum;
				} else if (account.startsWith('Equity')) {
					tempEquity.push(formattedRow);
					runningTotalEquity += amountNum;
				}
			}

			// Update the store with all new data
			this.state.set({
				isLoading: false,
				error: null,
				assets: tempAssets,
				liabilities: tempLiab,
				equity: tempEquity,
				totalAssets: runningTotalAssets,
				totalLiabilities: runningTotalLiab,
				totalEquity: runningTotalEquity,
				totalLiabEquity: runningTotalLiab + runningTotalEquity,
				currency: newCurrency
			});

		} catch (e) {
			console.error("Error loading balance sheet:", e);
			this.state.update(s => ({ ...s, isLoading: false, error: e.message }));
		}
	}
}