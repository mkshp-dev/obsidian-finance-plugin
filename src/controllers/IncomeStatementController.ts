// src/controllers/IncomeStatementController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { extractConvertedAmount, extractNonReportingCurrencies, parseAmount } from '../utils/index';
import type { ChartConfiguration } from 'chart.js/auto';
import { Logger } from '../utils/logger';
// Re-export AccountItem so IncomeStatementTab can import from here
export type { AccountItem } from './BalanceSheetController';
import type { AccountItem } from './BalanceSheetController';

/**
 * Interface representing the state of the Income Statement view.
 */
export interface IncomeStatementState {
	/** Whether data is loading. */
	isLoading: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Tree of Income accounts. */
	income: AccountItem[];
	/** Tree of Expense accounts. */
	expenses: AccountItem[];
	/** Total numeric value of Income (absolute, positive). */
	totalIncome: number;
	/** Total numeric value of Expenses. */
	totalExpenses: number;
	/** Net profit (totalIncome - totalExpenses). */
	netProfit: number;
	/** The reporting currency used. */
	currency: string;
	/** Whether multi-currency entries were detected. */
	hasUnconvertedCommodities: boolean;
	/** Warning message for unconverted commodities. */
	unconvertedWarning: string | null;
	/** Current valuation method used. */
	valuationMethod: 'convert' | 'cost' | 'units';
	/** Chart.js configuration object for the net profit trend chart. */
	chartConfig: ChartConfiguration | null;
	/** Error specific to chart data loading. */
	chartError: string | null;
	/** Whether chart data is being reloaded. */
	chartLoading: boolean;
	/** The active chart interval granularity. */
	chartInterval: 'month' | 'week';
	/** The active trend type shown in the Trends chart. */
	chartTrendType: 'netprofit' | 'income' | 'expense';
}

/**
 * IncomeStatementController
 *
 * Manages the data fetching and state for the Income Statement tab.
 * Responsible for querying income/expense account balances, building the hierarchy,
 * calculating totals, net profit, and handling different valuation methods.
 */
export class IncomeStatementController {
	public plugin: BeancountPlugin;
	public state: Writable<IncomeStatementState>;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		this.state = writable({
			isLoading: true,
			error: null,
			income: [],
			expenses: [],
			totalIncome: 0,
			totalExpenses: 0,
			netProfit: 0,
			currency: plugin.settings.operatingCurrency || 'USD',
			hasUnconvertedCommodities: false,
			unconvertedWarning: null,
			valuationMethod: 'convert' as const,
			chartConfig: null,
			chartError: null,
			chartLoading: false,
			chartInterval: 'month' as const,
			chartTrendType: 'netprofit' as const,
		});
	}

	/**
	 * Builds a hierarchical structure from flat account entries.
	 * Income account amounts are negated for display (they are stored as negative in beancount).
	 */
	private buildAccountHierarchy(
		accounts: [string, string][],
		accountType: 'Income' | 'Expenses',
		valuationMethod: 'convert' | 'cost' | 'units' = 'convert'
	): AccountItem[] {
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		const accountMap = new Map<string, AccountItem>();
		const rootAccounts: AccountItem[] = [];

		for (const [fullAccount, rawAmount] of accounts) {
			const convertedAmount = extractConvertedAmount(rawAmount, reportingCurrency);
			const otherCurrencies = extractNonReportingCurrencies(rawAmount, reportingCurrency);

			// Keep raw beancount sign: income is negative (credit), expenses are positive (debit)
			const amountNumber = parseFloat(convertedAmount.split(' ')[0].replace(/,/g, '')) || 0;

			const parts = fullAccount.split(':');
			let currentPath = '';

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const parentPath = currentPath;
				currentPath = currentPath ? `${currentPath}:${part}` : part;

				if (!accountMap.has(currentPath)) {
					const displayAmountNumber = i === parts.length - 1 ? amountNumber : 0;
					const displayAmount = i === parts.length - 1
						? `${amountNumber.toFixed(2)} ${reportingCurrency}`
						: `0.00 ${reportingCurrency}`;

					const item: AccountItem = {
						account: currentPath,
						displayName: part,
						level: i,
						amount: displayAmount,
						amountNumber: displayAmountNumber,
						otherCurrencies: i === parts.length - 1 ? otherCurrencies : '',
						isCategory: i < parts.length - 1,
						children: [],
					};

					accountMap.set(currentPath, item);

					if (parentPath && accountMap.has(parentPath)) {
						accountMap.get(parentPath)!.children!.push(item);
					} else if (i === 0) {
						rootAccounts.push(item);
					}
				} else if (i === parts.length - 1) {
					const existing = accountMap.get(currentPath)!;
					existing.amount = `${amountNumber.toFixed(2)} ${reportingCurrency}`;
					existing.amountNumber = amountNumber;
					existing.otherCurrencies = otherCurrencies;
				}
			}
		}

		this.calculateCategoryTotals(rootAccounts, reportingCurrency);
		return rootAccounts;
	}

	/**
	 * Recursively calculates totals for category nodes based on children.
	 */
	private calculateCategoryTotals(accounts: AccountItem[], currency: string): number {
		let total = 0;
		for (const account of accounts) {
			if (account.children && account.children.length > 0) {
				const childTotal = this.calculateCategoryTotals(account.children, currency);
				account.amountNumber = childTotal;
				account.amount = `${childTotal.toFixed(2)} ${currency}`;

				const childOtherCurrencies = account.children
					.map(child => child.otherCurrencies)
					.filter(curr => curr && curr.trim() !== '')
					.flatMap(curr => curr.split(/[,\n]/).map(c => c.trim()))
					.filter((curr, index, arr) => arr.indexOf(curr) === index && curr !== '')
					.join('\n');
				account.otherCurrencies = childOtherCurrencies;

				total += childTotal;
			} else {
				total += account.amountNumber;
			}
		}
		return total;
	}

	/**
	 * Flattens the hierarchy for rendering in a linear list.
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
	 * Sets the valuation method and reloads data.
	 */
	async setValuationMethod(method: 'convert' | 'cost' | 'units') {
		await this.loadData(method);
	}

	/**
	 * Returns the appropriate query for the given interval and trend type.
	 */
	private _getChartQuery(interval: 'month' | 'week', trendType: 'netprofit' | 'income' | 'expense', currency: string): string {
		switch (trendType) {
			case 'income': return queries.getHistoricalIncomeDataQuery(interval, currency);
			case 'expense': return queries.getHistoricalExpenseDataQuery(interval, currency);
			default: return queries.getHistoricalNetProfitDataQuery(interval, currency);
		}
	}

	/**
	 * Changes the trend type and reloads only the chart data.
	 */
	async setChartTrendType(trendType: 'netprofit' | 'income' | 'expense') {
		if (get(this.state).chartTrendType === trendType) return;
		const { chartInterval } = get(this.state);
		this.state.update(s => ({ ...s, chartTrendType: trendType, chartConfig: null, chartError: null, chartLoading: true }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		try {
			const result = await this.plugin.runQuery(this._getChartQuery(chartInterval, trendType, reportingCurrency));
			this._processChartData(result, chartInterval, reportingCurrency, trendType);
		} catch (e) {
			Logger.error('Error loading income chart data:', e);
			this.state.update(s => ({ ...s, chartLoading: false, chartError: `Failed to load chart: ${e.message}` }));
		}
	}

	/**
	 * Changes the chart interval granularity and reloads only the chart data.
	 */
	async setChartInterval(interval: 'month' | 'week') {
		if (get(this.state).chartInterval === interval) return;
		const { chartTrendType } = get(this.state);
		this.state.update(s => ({ ...s, chartInterval: interval, chartConfig: null, chartError: null, chartLoading: true }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		try {
			const result = await this.plugin.runQuery(this._getChartQuery(interval, chartTrendType, reportingCurrency));
			this._processChartData(result, interval, reportingCurrency, chartTrendType);
		} catch (e) {
			Logger.error('Error loading income chart data:', e);
			this.state.update(s => ({ ...s, chartLoading: false, chartError: `Failed to load chart: ${e.message}` }));
		}
	}

	/**
	 * Parses raw BQL result into a bar chart config and updates the store.
	 * Handles both monthly (3-col) and weekly (2-col) formats.
	 * Net profit = raw sign (negative when profitable). Income is negated (stored negative → show positive).
	 * Expenses are kept as-is (positive).
	 */
	private _processChartData(rawResult: string, interval: 'month' | 'week', reportingCurrency: string, trendType: 'netprofit' | 'income' | 'expense' = 'netprofit') {
		try {
			const clean = rawResult.replace(/\r/g, '').trim();
			const records: string[][] = parseCsv(clean, { columns: false, skip_empty_lines: true, relax_column_count: true });
			if (records.length === 0) throw new Error('No data available for chart.');

			const dataMap = new Map<string, number>();
			const labels: string[] = [];
			const dataPoints: (number | null)[] = [];

			if (interval === 'month') {
				let minYear = Infinity, maxYear = -Infinity, minMonth = Infinity, maxMonth = -Infinity;
				for (const row of records) {
					if (row.length < 3) continue;
					const year = parseInt(row[0].trim());
					const monthNum = parseInt(row[1].trim());
					const rawVal = parseAmount(extractConvertedAmount(row[2].trim(), reportingCurrency));
					// Income is stored negative in beancount; negate for positive display
					const displayVal = trendType === 'income' ? -rawVal.amount : rawVal.amount;
					dataMap.set(`${year}-${monthNum.toString().padStart(2, '0')}`, displayVal);
					if (year < minYear || (year === minYear && monthNum < minMonth)) { minYear = year; minMonth = monthNum; }
					if (year > maxYear || (year === maxYear && monthNum > maxMonth)) { maxYear = year; maxMonth = monthNum; }
				}
				let cy = minYear, cm = minMonth;
				while (cy < maxYear || (cy === maxYear && cm <= maxMonth)) {
					const key = `${cy}-${cm.toString().padStart(2, '0')}`;
					labels.push(new Date(cy, cm - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).toUpperCase());
					dataPoints.push(dataMap.get(key) ?? null);
					if (++cm > 12) { cm = 1; cy++; }
				}
			} else {
				const dates: Date[] = [];
				for (const row of records) {
					if (row.length < 2) continue;
					const dateStr = row[0].trim();
					const d = new Date(dateStr + 'T00:00:00');
					if (isNaN(d.getTime())) continue;
					const rawVal = parseAmount(extractConvertedAmount(row[1].trim(), reportingCurrency));
					// Income is stored negative in beancount; negate for positive display
					const displayVal = trendType === 'income' ? -rawVal.amount : rawVal.amount;
					dataMap.set(dateStr, displayVal);
					dates.push(d);
				}
				if (dates.length === 0) throw new Error('No weekly data.');
				const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
				const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
				const cur = new Date(minDate);
				while (cur <= maxDate) {
					const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
					labels.push(cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }));
					dataPoints.push(dataMap.get(key) ?? null);
					cur.setDate(cur.getDate() + 7);
				}
			}

			const xAxisTitle = interval === 'month' ? 'Month' : 'Week ending (Sunday)';
			this.state.update(s => ({
				...s,
				chartConfig: this._buildBarChartConfig(labels, dataPoints, reportingCurrency, xAxisTitle, trendType),
				chartError: null,
				chartLoading: false,
			}));
		} catch (err) {
			Logger.error('Error processing income chart data:', err);
			this.state.update(s => ({ ...s, chartConfig: null, chartError: `Failed to process chart data: ${err.message}`, chartLoading: false }));
		}
	}

	/**
	 * Builds a Chart.js bar chart configuration for the Trends chart.
	 */
	private _buildBarChartConfig(labels: string[], dataPoints: (number | null)[], currency: string, xAxisTitle: string, trendType: 'netprofit' | 'income' | 'expense' = 'netprofit'): ChartConfiguration {
		const labelMap = { netprofit: 'Net Profit', income: 'Income', expense: 'Expense' };
		const displayLabel = labelMap[trendType];
		const bgColor = trendType === 'income'
			? (v: number | null) => v === null ? 'rgba(180,180,180,0.4)' : 'rgba(75, 192, 130, 0.7)'
			: trendType === 'expense'
			? (v: number | null) => v === null ? 'rgba(180,180,180,0.4)' : 'rgba(255, 99, 99, 0.7)'
			: (v: number | null) => v === null ? 'rgba(180,180,180,0.4)' : v <= 0 ? 'rgba(75, 192, 130, 0.7)' : 'rgba(255, 99, 99, 0.7)';
		const borderColor = trendType === 'income'
			? (v: number | null) => v === null ? 'rgba(180,180,180,0.6)' : 'rgba(75, 192, 130, 1)'
			: trendType === 'expense'
			? (v: number | null) => v === null ? 'rgba(180,180,180,0.6)' : 'rgba(255, 99, 99, 1)'
			: (v: number | null) => v === null ? 'rgba(180,180,180,0.6)' : v <= 0 ? 'rgba(75, 192, 130, 1)' : 'rgba(255, 99, 99, 1)';
		return {
			type: 'bar',
			data: {
				labels,
				datasets: [{
					label: `${displayLabel} (${currency})`,
					data: dataPoints,
					backgroundColor: dataPoints.map(bgColor),
					borderColor: dataPoints.map(borderColor),
					borderWidth: 1,
				}],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `${displayLabel} Trend (${currency})`,
						font: { size: 16 },
					},
					legend: { display: false },
					tooltip: {
						mode: 'index',
						intersect: false,
						callbacks: {
							label: (context: any) => `${displayLabel}: ${context.parsed.y.toLocaleString()} ${currency}`,
						},
					},
				},
				scales: {
					x: {
						display: true,
						title: { display: true, text: xAxisTitle },
						grid: { display: false },
					},
					y: {
						display: true,
						title: { display: true, text: `Amount (${currency})` },
						grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' },
						ticks: { callback: (value: any) => value.toLocaleString() },
					},
				},
				interaction: { mode: 'nearest', axis: 'x', intersect: false },
			},
		};
	}

	/**
	 * Main data fetching method.
	 * Runs Beancount queries and updates the Income Statement state.
	 */
	async loadData(valuationMethod: 'convert' | 'cost' | 'units' = 'convert') {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;

		if (valuationMethod === 'convert' && !reportingCurrency) {
			this.state.update(s => ({ ...s, isLoading: false, error: 'Operating currency not set.' }));
			return;
		}

		try {
			let query: string;
			switch (valuationMethod) {
				case 'convert':
					query = queries.getIncomeStatementQuery(reportingCurrency);
					break;
				case 'cost':
					query = queries.getIncomeStatementQueryByCost();
					break;
				case 'units':
					query = queries.getIncomeStatementQueryByUnits();
					break;
			}

			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, '').trim();
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true });

			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('account');
			const rows = firstRowIsHeader ? records.slice(1) : records;

			let tempIncome: [string, string][] = [];
			let tempExpenses: [string, string][] = [];
			let hasUnconvertedCommodities = false;
			const unconvertedAccounts: string[] = [];

			for (const row of rows) {
				if (row.length < 2) continue;
				const [account, amountStr] = row;

				if (valuationMethod === 'convert' && amountStr.includes(',')) {
					hasUnconvertedCommodities = true;
					unconvertedAccounts.push(account);
				}

				if (account.startsWith('Income')) {
					tempIncome.push([account, amountStr]);
				} else if (account.startsWith('Expenses')) {
					tempExpenses.push([account, amountStr]);
				}
			}

			const incomeHierarchy = this.buildAccountHierarchy(tempIncome, 'Income', valuationMethod);
			const expensesHierarchy = this.buildAccountHierarchy(tempExpenses, 'Expenses', valuationMethod);

			const totalIncome = this.calculateCategoryTotals(incomeHierarchy, reportingCurrency);
			const totalExpenses = this.calculateCategoryTotals(expensesHierarchy, reportingCurrency);
			// totalIncome is negative in beancount (credit accounts); compute conventional profit
			const netProfit = -(totalIncome + totalExpenses);

			let unconvertedWarning: string | null = null;
			if (hasUnconvertedCommodities) {
				unconvertedWarning = `Multi-currency accounts detected. ${reportingCurrency} amounts are shown in the first column, other currencies are displayed separately. Only ${reportingCurrency} amounts are included in totals.`;
			}

			const currentState = get(this.state);

			this.state.set({
				isLoading: false,
				error: null,
				income: this.flattenHierarchy(incomeHierarchy),
				expenses: this.flattenHierarchy(expensesHierarchy),
				totalIncome,
				totalExpenses,
				netProfit,
				currency: reportingCurrency,
				hasUnconvertedCommodities,
				unconvertedWarning,
				valuationMethod,
				chartConfig: currentState.chartConfig,
				chartError: currentState.chartError,
				chartLoading: true,
				chartInterval: currentState.chartInterval,
				chartTrendType: currentState.chartTrendType,
			});

			// Load chart data
			try {
				const chartResult = await this.plugin.runQuery(
					this._getChartQuery(currentState.chartInterval, currentState.chartTrendType, reportingCurrency)
				);
				this._processChartData(chartResult, currentState.chartInterval, reportingCurrency, currentState.chartTrendType);
			} catch (chartErr) {
				Logger.error('Error loading income chart data in loadData:', chartErr);
				this.state.update(s => ({ ...s, chartLoading: false, chartError: `Failed to load chart: ${chartErr.message}` }));
			}

		} catch (e) {
			console.error('Error loading income statement:', e);
			this.state.update(s => ({ ...s, isLoading: false, error: e.message }));
		}
	}
}
