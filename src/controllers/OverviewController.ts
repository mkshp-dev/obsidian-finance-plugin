// src/controllers/OverviewController.ts

import { writable, type Writable, get } from 'svelte/store';
import type { ChartConfiguration } from 'chart.js/auto';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseAmount, extractConvertedAmount, getCurrentMonthRange, parseSingleValue } from '../utils/index'; // Import helpers
import { parse as parseCsv } from 'csv-parse/sync';

// Define the shape of our state
export interface OverviewState {
	isLoading: boolean;
	error: string | null;
	netWorth: string;
	monthlyIncome: string;
	monthlyExpenses: string;
	savingsRate: string;
	chartConfig: ChartConfiguration | null;
	chartError: string | null;
	currency: string;
}

export class OverviewController {
	private plugin: BeancountPlugin;
	
	// Create a Svelte store to hold the state
	public state: Writable<OverviewState>;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		// Initialize the store with default values
		this.state = writable({
			isLoading: true,
			error: null,
			netWorth: '0.00 USD',
			monthlyIncome: '0.00 USD',
			monthlyExpenses: '0.00 USD',
			savingsRate: '0%',
			chartConfig: null,
			chartError: null,
			currency: plugin.settings.reportingCurrency || 'USD',
		});
	}

	// The main data-fetching method
	async loadData() {
		this.state.update(s => ({ ...s, isLoading: true, error: null, chartError: null }));

		const reportingCurrency = this.plugin.settings.reportingCurrency;
		if (!reportingCurrency) {
			this.state.set({
				...get(this.state), // Svelte 4/5 way to get current value
				isLoading: false,
				error: "Reporting Currency is not set in plugin settings.",
			});
			return;
		}

		try {
			const monthRange = getCurrentMonthRange();
			
			const [ assetsResult, liabilitiesResult, incomeResult, expensesResult, historicalResult ] = await Promise.all([
				this.plugin.runQuery(queries.getTotalAssetsCostQuery(reportingCurrency)),
				this.plugin.runQuery(queries.getTotalLiabilitiesCostQuery(reportingCurrency)),
				this.plugin.runQuery(queries.getMonthlyIncomeQuery(monthRange.start, monthRange.end, reportingCurrency)),
				this.plugin.runQuery(queries.getMonthlyExpensesQuery(monthRange.start, monthRange.end, reportingCurrency)),
				this.plugin.runQuery(queries.getHistoricalNetWorthDataQuery('month', reportingCurrency))
			]);

			// Process KPI Data
			const assetsInventoryStr = this.plugin.parseSingleValue(assetsResult);
			const liabilitiesInventoryStr = this.plugin.parseSingleValue(liabilitiesResult);
			const incomeInventoryStr = this.plugin.parseSingleValue(incomeResult);
			const expensesInventoryStr = this.plugin.parseSingleValue(expensesResult);

			const assetsStr = extractConvertedAmount(assetsInventoryStr, reportingCurrency);
			const liabilitiesStr = extractConvertedAmount(liabilitiesInventoryStr, reportingCurrency);
			const incomeStr = extractConvertedAmount(incomeInventoryStr, reportingCurrency);
			const expensesStr = extractConvertedAmount(expensesInventoryStr, reportingCurrency);
			
			const assetsData = parseAmount(assetsStr);
			const liabilitiesData = parseAmount(liabilitiesStr);
			const incomeData = parseAmount(incomeStr);
			const expensesData = parseAmount(expensesStr);
			const expensesAbs = Math.abs(expensesData.amount);
			
			const netWorthNum = assetsData.amount - liabilitiesData.amount;
			const savingsNum = incomeData.amount - expensesAbs;

			const newState: Partial<OverviewState> = {
				netWorth: `${netWorthNum.toFixed(2)} ${reportingCurrency}`,
				monthlyIncome: `${incomeData.amount.toFixed(2)} ${reportingCurrency}`,
				monthlyExpenses: `${expensesAbs.toFixed(2)} ${reportingCurrency}`,
				savingsRate: incomeData.amount > 0 ? `${((savingsNum / incomeData.amount) * 100).toFixed(0)}%` : 'N/A',
				currency: reportingCurrency,
			};

			// Process Historical Data for Chart
			try {
				const cleanHistoricalStdout = historicalResult.replace(/\r/g, "").trim();
				const historicalRecords: string[][] = parseCsv(cleanHistoricalStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
				if (historicalRecords.length < 2) { throw new Error("Not enough data for chart."); }

				const firstRowIsHeader = historicalRecords[0][0]?.toLowerCase().includes('month') && historicalRecords[0][2]?.toLowerCase().includes('sum');
				const dataRows = firstRowIsHeader ? historicalRecords.slice(1) : historicalRecords;

				const monthlyChanges: { [month: string]: { assets: number, liabilities: number } } = {};
				
				for (const row of dataRows) {
					if (row.length < 3) continue;
					const month = row[0]; const account = row[1];
					const sumStr = extractConvertedAmount(row[2], reportingCurrency);
					const sumData = parseAmount(sumStr);
					if (!monthlyChanges[month]) monthlyChanges[month] = { assets: 0, liabilities: 0 };
					if (account.startsWith('Assets')) { monthlyChanges[month].assets += sumData.amount; }
					else if (account.startsWith('Liabilities')) { monthlyChanges[month].liabilities += sumData.amount; }
				}

				const labels: string[] = []; const dataPoints: number[] = [];
				let cumulativeNetWorth = 0;
				const sortedMonths = Object.keys(monthlyChanges).sort();
				for (const month of sortedMonths) {
					const change = monthlyChanges[month];
					cumulativeNetWorth += (change.assets - change.liabilities);
					labels.push(month); dataPoints.push(cumulativeNetWorth);
				}

				newState.chartConfig = {
					type: 'line',
					data: {
						labels: labels,
						datasets: [{
							label: `Net Worth (${reportingCurrency})`, data: dataPoints,
							borderColor: 'rgb(75, 192, 192)', tension: 0.1
						}]
					},
					options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
				};
				newState.chartError = null;

			} catch (chartDataError) {
				console.error("Error processing chart data:", chartDataError);
				newState.chartError = `Failed to process chart data: ${chartDataError.message}`;
				newState.chartConfig = null;
			}
			
			// Update the store with all new data
			this.state.update(s => ({ ...s, ...newState, isLoading: false, error: null }));

		} catch (e) { 
			console.error("Error loading overview data:", e); 
			this.state.update(s => ({ ...s, isLoading: false, error: `Failed to load data: ${e.message}` }));
		}
	}
}