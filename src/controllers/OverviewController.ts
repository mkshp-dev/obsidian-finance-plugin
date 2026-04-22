// src/controllers/OverviewController.ts

import { writable, type Writable, get } from 'svelte/store';
import type { ChartConfiguration } from 'chart.js/auto';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseAmount, extractConvertedAmount, parseSingleValue } from '../utils/index'; // Import helpers
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
	/** Whether chart data is being reloaded (e.g. on interval toggle). */
	chartLoading: boolean;
	/** The active chart interval granularity. */
	chartInterval: 'month' | 'week';
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
			chartLoading: false,
			chartInterval: 'month',
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

		const currentInterval = get(this.state).chartInterval;

		try {
			const [netWorthResult, incomeResult, expensesResult, savingsResult, historicalResult] = await Promise.all([
				this.plugin.runQuery(queries.getTotalWorthQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getThisMonthIncomeQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getThisMonthExpensesQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getThisMonthSavingsQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getHistoricalNetWorthDataQuery(currentInterval, reportingCurrency))
			]);
			Logger.log("OverviewController: Historical Result:", historicalResult);

			// Process KPI Data
			Logger.log("OverviewController: Net Worth Result:", netWorthResult);
			const netWorthNum = parseFloat(parseSingleValue(netWorthResult)) || 0;
			Logger.log("OverviewController: Parsed Net Worth:", netWorthNum);

			const incomeAmount = parseFloat(parseSingleValue(incomeResult)) || 0;
			const expensesAmount = parseFloat(parseSingleValue(expensesResult)) || 0;
			const savingsNum = parseFloat(parseSingleValue(savingsResult)) || 0;

			const newState: Partial<OverviewState> = {
				netWorth: `${netWorthNum.toFixed(2)} ${reportingCurrency}`,
				monthlyIncome: `${incomeAmount.toFixed(2)} ${reportingCurrency}`,
				monthlyExpenses: `${expensesAmount.toFixed(2)} ${reportingCurrency}`,
				savingsRate: incomeAmount > 0 ? `${((savingsNum / incomeAmount) * 100).toFixed(0)}%` : 'N/A',
				currency: reportingCurrency,
			};

			// Update the store with KPI data, then process chart
			this.state.update(s => ({ ...s, ...newState, isLoading: false, error: null }));
			this._processChartData(historicalResult, currentInterval, reportingCurrency);

		} catch (e) {
			Logger.error("Error loading overview data:", e);
			this.state.update(s => ({ ...s, isLoading: false, error: `Failed to load data: ${e.message}` }));
		}
	}

	/**
	 * Changes the chart interval granularity and reloads only the chart data.
	 */
	async setChartInterval(interval: 'month' | 'week') {
		if (get(this.state).chartInterval === interval) return;
		this.state.update(s => ({ ...s, chartInterval: interval, chartConfig: null, chartError: null, chartLoading: true }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		try {
			const result = await this.plugin.runQuery(queries.getHistoricalNetWorthDataQuery(interval, reportingCurrency));
			this._processChartData(result, interval, reportingCurrency);
		} catch (e) {
			Logger.error("Error loading chart data:", e);
			this.state.update(s => ({ ...s, chartLoading: false, chartError: `Failed to load chart: ${e.message}` }));
		}
	}

	/**
	 * Parses raw BQL result into chart config and updates the store.
	 * Handles both monthly (3-col) and weekly (2-col) formats.
	 */
	private _processChartData(rawResult: string, interval: 'month' | 'week', reportingCurrency: string) {
		try {
			const clean = rawResult.replace(/\r/g, "").trim();
			Logger.log("OverviewController: _processChartData raw:", clean);
			const records: string[][] = parseCsv(clean, { columns: false, skip_empty_lines: true, relax_column_count: true });
			if (records.length === 0) throw new Error("No data available for chart.");

			const dataMap = new Map<string, number>();
			const labels: string[] = [];
			const dataPoints: (number | null)[] = [];

			if (interval === 'month') {
				// cols: [year, month, value]
				let minYear = Infinity, maxYear = -Infinity, minMonth = Infinity, maxMonth = -Infinity;
				for (const row of records) {
					if (row.length < 3) continue;
					const year = parseInt(row[0].trim());
					const monthNum = parseInt(row[1].trim());
					const nw = parseAmount(extractConvertedAmount(row[2].trim(), reportingCurrency));
					dataMap.set(`${year}-${monthNum.toString().padStart(2, '0')}`, nw.amount);
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
				// cols: [week_end_date, value]  e.g. ["2025-12-22", " 614838.59 INR"]
				const dates: Date[] = [];
				for (const row of records) {
					if (row.length < 2) continue;
					const dateStr = row[0].trim();
					const d = new Date(dateStr + 'T00:00:00');
					if (isNaN(d.getTime())) continue; // skip header row
					const nw = parseAmount(extractConvertedAmount(row[1].trim(), reportingCurrency));
					dataMap.set(dateStr, nw.amount);
					dates.push(d);
				}
				if (dates.length === 0) throw new Error("No weekly data.");
				const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
				const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
				const cur = new Date(minDate);
				while (cur <= maxDate) {
					// Use local date components to avoid UTC day-shift in non-UTC timezones (e.g. IST)
					const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
					labels.push(cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }));
					dataPoints.push(dataMap.get(key) ?? null);
					cur.setDate(cur.getDate() + 7);
				}
			}

			Logger.log("OverviewController: Chart labels:", labels);
			Logger.log("OverviewController: Chart data points:", dataPoints);

			const xAxisTitle = interval === 'month' ? 'Month' : 'Week ending (Sunday)';
			this.state.update(s => ({ ...s, chartConfig: this._buildChartConfig(labels, dataPoints, reportingCurrency, xAxisTitle), chartError: null, chartLoading: false }));
		} catch (err) {
			Logger.error("Error processing chart data:", err);
			this.state.update(s => ({ ...s, chartConfig: null, chartError: `Failed to process chart data: ${err.message}`, chartLoading: false }));
		}
	}

	/**
	 * Builds a Chart.js line chart configuration.
	 */
	private _buildChartConfig(labels: string[], dataPoints: (number | null)[], currency: string, xAxisTitle: string): ChartConfiguration {
		return {
			type: 'line',
			data: {
				labels,
				datasets: [{
					label: `Net Worth (${currency})`,
					data: dataPoints,
					borderColor: 'rgb(75, 192, 192)',
					backgroundColor: 'rgba(75, 192, 192, 0.1)',
					tension: 0.3,
					fill: true,
					pointRadius: 4,
					pointHoverRadius: 6,
					spanGaps: true
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `Net Worth Trend (${currency})`,
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
							label: (context: any) => `Net Worth: ${context.parsed.y.toLocaleString()} ${currency}`
						}
					}
				},
				scales: {
					x: {
						display: true,
						title: { display: true, text: xAxisTitle },
						grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' }
					},
					y: {
						display: true,
						title: { display: true, text: `Amount (${currency})` },
						grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' },
						ticks: { callback: (value: any) => value.toLocaleString() }
					}
				},
				interaction: { mode: 'nearest', axis: 'x', intersect: false }
			}
		};
	}
}
