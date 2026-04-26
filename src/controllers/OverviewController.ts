// src/controllers/OverviewController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseSingleValue } from '../utils/index'; // Import helpers
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
			const [netWorthResult, incomeResult, expensesResult, savingsResult] = await Promise.all([
				this.plugin.runQuery(queries.getTotalWorthQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getThisMonthIncomeQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getThisMonthExpensesQuery(reportingCurrency, 2)),
				this.plugin.runQuery(queries.getThisMonthSavingsQuery(reportingCurrency, 2)),
			]);

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

			// Update the store with KPI data
			this.state.update(s => ({ ...s, ...newState, isLoading: false, error: null }));

		} catch (e) {
			Logger.error("Error loading overview data:", e);
			this.state.update(s => ({ ...s, isLoading: false, error: `Failed to load data: ${e.message}` }));
		}
	}
}
