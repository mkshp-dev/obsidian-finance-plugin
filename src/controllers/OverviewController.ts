// src/controllers/OverviewController.ts

import { writable, type Writable, get } from 'svelte/store';
import type { ChartConfiguration } from 'chart.js/auto';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseAmount, extractConvertedAmount, getCurrentMonthRange } from '../utils/index'; // Import helpers
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../utils/logger';

/**
 * Interface representing the state of the Overview dashboard.
 */
export interface OverviewState {
	/** Whether data is loading. */
	isLoading: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Net worth string (e.g. "1,000.00 USD"). */
	netWorth: string;
	/** Monthly income string. */
	monthlyIncome: string;
	/** Monthly expenses string. */
	monthlyExpenses: string;
	/** Savings rate percentage string (e.g. "20%"). */
	savingsRate: string;
	/** Chart.js configuration object for the net worth chart. */
	chartConfig: ChartConfiguration | null;
	/** Error specific to chart data loading. */
	chartError: string | null;
	/** The reporting currency. */
	currency: string;
}

/**
 * OverviewController
 *
 * Manages the state and logic for the Overview tab.
 * Fetches high-level financial metrics (Net Worth, Income, Expenses) and
 * prepares data for the Net Worth over time chart.
 */
export class OverviewController {
	private plugin: BeancountPlugin;
	
	// Create a Svelte store to hold the state
	public state: Writable<OverviewState>;

	/**
	 * Creates an instance of OverviewController.
	 * @param {BeancountPlugin} plugin - The main plugin instance.
	 */
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
			currency: plugin.settings.operatingCurrency || 'USD',
		});
	}

	/**
	 * Loads all overview data from Beancount.
	 * Fetches total assets, liabilities, monthly income/expenses, and historical data for the chart.
	 */
	async loadData() {
		this.state.update(s => ({ ...s, isLoading: true, error: null, chartError: null }));

		const reportingCurrency = this.plugin.settings.operatingCurrency;
		if (!reportingCurrency) {
			this.state.set({
				...get(this.state), // Svelte 4/5 way to get current value
				isLoading: false,
				error: "Operating currency is not set in plugin settings.",
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
		Logger.log("OverviewController: Historical Result:", historicalResult);			// Process KPI Data
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
			
			// In Beancount:
			// - Income accounts have negative balances (we want positive for display)
			// - Expense accounts have positive balances (already positive)
			// - Liability accounts have negative balances (we want positive for display)
			const incomeAmount = Math.abs(incomeData.amount); // Convert negative income to positive
			const expensesAmount = expensesData.amount; // Expenses are already positive
			const liabilitiesAmount = Math.abs(liabilitiesData.amount); // Convert negative liabilities to positive
			
			// Calculate financial metrics
			const netWorthNum = assetsData.amount - liabilitiesAmount;
			const savingsNum = incomeAmount - expensesAmount;



			const newState: Partial<OverviewState> = {
				netWorth: `${netWorthNum.toFixed(2)} ${reportingCurrency}`,
				monthlyIncome: `${incomeAmount.toFixed(2)} ${reportingCurrency}`,
				monthlyExpenses: `${expensesAmount.toFixed(2)} ${reportingCurrency}`,
				savingsRate: incomeAmount > 0 ? `${((savingsNum / incomeAmount) * 100).toFixed(0)}%` : 'N/A',
				currency: reportingCurrency,
			};



			// Process Historical Data for Chart
			try {
				const cleanHistoricalStdout = historicalResult.replace(/\r/g, "").trim();
				Logger.log("OverviewController: Clean Historical Stdout:", cleanHistoricalStdout);
				const historicalRecords: string[][] = parseCsv(cleanHistoricalStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
				Logger.log("OverviewController: Parsed Historical Records:", historicalRecords);
				if (historicalRecords.length === 0) { throw new Error("No data available for chart."); }

				// New query format: [year, month_number, net_worth_value]
				// Example: ["2024", "5", "362701.06 INR"]
				
				// Parse and collect actual data points
				const dataMap = new Map<string, number>();
				let minYear = Infinity;
				let maxYear = -Infinity;
				let minMonth = Infinity;
				let maxMonth = -Infinity;
				
				for (const row of historicalRecords) {
					if (row.length < 3) continue;
					
					const year = parseInt(row[0].trim());
					const monthNum = parseInt(row[1].trim());
					const valueStr = row[2].trim();
					
					// Extract net worth value
					const netWorthStr = extractConvertedAmount(valueStr, reportingCurrency);
					const netWorthData = parseAmount(netWorthStr);
					
					const sortKey = `${year}-${monthNum.toString().padStart(2, '0')}`;
					dataMap.set(sortKey, netWorthData.amount);
					
					// Track date range
					if (year < minYear || (year === minYear && monthNum < minMonth)) {
						minYear = year;
						minMonth = monthNum;
					}
					if (year > maxYear || (year === maxYear && monthNum > maxMonth)) {
						maxYear = year;
						maxMonth = monthNum;
					}
				}
				
				Logger.log("OverviewController: Data Map:", dataMap);
				Logger.log("OverviewController: Date Range:", { minYear, minMonth, maxYear, maxMonth });
				
				// Fill in all months between min and max date
				const labels: string[] = []; 
				const dataPoints: (number | null)[] = [];
				
				let currentYear = minYear;
				let currentMonth = minMonth;
				
				while (currentYear < maxYear || (currentYear === maxYear && currentMonth <= maxMonth)) {
					const sortKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
					const date = new Date(currentYear, currentMonth - 1);
					const displayLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).toUpperCase();
					
					labels.push(displayLabel);
					
					// Add actual data point if exists, otherwise null (creates gap in line chart)
					if (dataMap.has(sortKey)) {
						dataPoints.push(dataMap.get(sortKey)!);
					} else {
						dataPoints.push(null);
					}
					
					// Move to next month
					currentMonth++;
					if (currentMonth > 12) {
						currentMonth = 1;
						currentYear++;
					}
				}
				
				Logger.log("OverviewController: Final Chart Labels:", labels);
				Logger.log("OverviewController: Final Chart Data Points:", dataPoints);

				newState.chartConfig = {
					type: 'line',
					data: {
						labels: labels,
						datasets: [{
							label: `Net Worth (${reportingCurrency})`, 
							data: dataPoints,
							borderColor: 'rgb(75, 192, 192)', 
							backgroundColor: 'rgba(75, 192, 192, 0.1)',
							tension: 0.3,
							fill: true,
							pointRadius: 4,
							pointHoverRadius: 6,
							spanGaps: true // Connect points across null values (gaps)
						}]
					},
					options: { 
						responsive: true, 
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: `Net Worth Trend (${reportingCurrency})`,
								font: { size: 16 }
							},
							legend: {
								display: true,
								position: 'top'
							},
							tooltip: {
								mode: 'index',
								intersect: false,
								callbacks: {
									label: function(context: any) {
										const value = context.parsed.y;
										return `Net Worth: ${value.toLocaleString()} ${reportingCurrency}`;
									}
								}
							}
						},
						scales: { 
							x: {
								display: true,
								title: {
									display: true,
									text: 'Month'
								},
								grid: {
									display: true,
									color: 'rgba(0, 0, 0, 0.1)'
								}
							},
							y: { 
								display: true,
								title: {
									display: true,
									text: `Amount (${reportingCurrency})`
								},
								grid: {
									display: true,
									color: 'rgba(0, 0, 0, 0.1)'
								},
								ticks: {
									callback: function(value: any) {
										return value.toLocaleString();
									}
								}
							}
						},
						interaction: {
							mode: 'nearest',
							axis: 'x',
							intersect: false
						}
					}
				};
				newState.chartError = null;

			} catch (chartDataError) {
				Logger.error("Error processing chart data:", chartDataError);
				newState.chartError = `Failed to process chart data: ${chartDataError.message}`;
				newState.chartConfig = null;
			}
			
			// Update the store with all new data
			this.state.update(s => ({ ...s, ...newState, isLoading: false, error: null }));

		} catch (e) { 
			Logger.error("Error loading overview data:", e); 
			this.state.update(s => ({ ...s, isLoading: false, error: `Failed to load data: ${e.message}` }));
		}
	}
}
