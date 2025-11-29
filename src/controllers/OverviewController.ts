// src/controllers/OverviewController.ts

import { writable, type Writable, get } from 'svelte/store';
import type { ChartConfiguration } from 'chart.js/auto';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseAmount, extractConvertedAmount, getCurrentMonthRange } from '../utils/index'; // Import helpers
import { parse as parseCsv } from 'csv-parse/sync';

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
				const historicalRecords: string[][] = parseCsv(cleanHistoricalStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
				if (historicalRecords.length < 2) { throw new Error("Not enough data for chart."); }

				const firstRowIsHeader = historicalRecords[0][0]?.toLowerCase().includes('month') && historicalRecords[0][2]?.toLowerCase().includes('sum');
				const dataRows = firstRowIsHeader ? historicalRecords.slice(1) : historicalRecords;

				const monthlyChanges: { [month: string]: { assets: number, liabilities: number } } = {};
				
				for (const row of dataRows) {
					if (row.length < 3) continue;
					const month = row[0]; 
					const account = row[1];
					const sumStr = extractConvertedAmount(row[2], reportingCurrency);
					const sumData = parseAmount(sumStr);
					if (!monthlyChanges[month]) monthlyChanges[month] = { assets: 0, liabilities: 0 };
					if (account.startsWith('Assets')) { 
						monthlyChanges[month].assets += sumData.amount; 
					} else if (account.startsWith('Liabilities')) { 
						// Correct Beancount accounting: liabilities are negative, convert to positive for net worth calculation
						monthlyChanges[month].liabilities += Math.abs(sumData.amount); 
					}
				}

				// Format month labels and sort properly
				const formatMonthLabel = (monthStr: string): { sortKey: string, displayLabel: string } => {
					// Handle different month formats from Beancount
					if (monthStr.includes('-')) {
						// Format: "2024-01" or "2024-1"
						const [year, month] = monthStr.split('-');
						const monthNum = parseInt(month);
						const date = new Date(parseInt(year), monthNum - 1);
						return {
							sortKey: `${year}-${month.padStart(2, '0')}`,
							displayLabel: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
						};
					} else if (monthStr.length <= 2) {
						// Format: "1", "12" (just month number, assume current year)
						const currentYear = new Date().getFullYear();
						const monthNum = parseInt(monthStr);
						const date = new Date(currentYear, monthNum - 1);
						return {
							sortKey: `${currentYear}-${monthStr.padStart(2, '0')}`,
							displayLabel: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
						};
					} else {
						// Fallback: use as-is
						return {
							sortKey: monthStr,
							displayLabel: monthStr
						};
					}
				};

				const labels: string[] = []; 
				const dataPoints: number[] = [];
				let cumulativeNetWorth = 0;
				
				// Sort months properly by creating sort keys
				const monthEntries = Object.entries(monthlyChanges).map(([month, data]) => ({
					...formatMonthLabel(month),
					data
				}));
				
				monthEntries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

				for (const entry of monthEntries) {
					const change = entry.data;
					cumulativeNetWorth += (change.assets - change.liabilities);
					labels.push(entry.displayLabel); 
					dataPoints.push(cumulativeNetWorth);
				}



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
							pointHoverRadius: 6
						}]
					},
					options: { 
						responsive: true, 
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: `Net Worth Over Time (${reportingCurrency})`,
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
