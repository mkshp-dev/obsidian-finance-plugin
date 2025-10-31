// src/views/unified-dashboard-view.ts

import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type BeancountPlugin from '../main';
import UnifiedDashboardComponent from './UnifiedDashboardView.svelte'; // Import the Svelte shell
import * as queries from '../queries/index'; // Import query functions
import { parse as parseCsv } from 'csv-parse/sync'; // Import parser
import type { ChartConfiguration } from 'chart.js';
import { parseAmount, extractConvertedAmount, getCurrentMonthRange } from '../utils/index';
export const UNIFIED_DASHBOARD_VIEW_TYPE = "beancount-unified-dashboard";

export class UnifiedDashboardView extends ItemView {
	plugin: BeancountPlugin;
	component: UnifiedDashboardComponent;

    private overviewState = {
            isLoading: true,
            error: null as string | null,
            netWorth: '0.00 USD',
            monthlyIncome: '0.00 USD',
            monthlyExpenses: '0.00 USD',
            savingsRate: '0%',
            chartConfig: null as ChartConfiguration | null,
            chartError: null as string | null,
            currency: 'USD' as string
        };

	// --- State for the Transaction Tab lives here ---
	private transactionState = {
		currentFilters: {} as queries.TransactionFilters,
		currentTransactions: [] as string[][],
		isLoading: true, // Start in loading state
		error: null as string | null
	};
	// ---------------------------------------------

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return UNIFIED_DASHBOARD_VIEW_TYPE; }
	getDisplayText(): string { return "Beancount Dashboard"; }
	getIcon(): string { return "layout-dashboard"; }

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		// Mount the main Svelte shell component
		this.component = new UnifiedDashboardComponent({
			target: container,
			props: {
				plugin: this.plugin, // Pass plugin instance to all tabs
				// Pass the initial transaction state down
				transactionState: this.transactionState,
				overviewState: this.overviewState
			}
		});

		// Listen for the 'filtersChange' event dispatched by the Svelte component
		this.component.$on('filtersChange', (e) => this.handleFilterChange(e.detail));
		
		// Run an initial fetch for the transaction tab
		this.handleFilterChange({}); // Fetch with empty filters
        this.loadOverviewData();
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

// src/views/unified-dashboard-view.ts

	// --- Replace this entire method ---
	async handleFilterChange(filters: queries.TransactionFilters) {
		// 1. Set new state immutably (create a new object)
		this.transactionState = {
			...this.transactionState, // Keep old data (like filters)
			isLoading: true,
			error: null
		};
		this.updateSvelteProps(); // Send loading state to Svelte

		let newTransactions: string[][] = [];
		let newError: string | null = null;

		try {
			// 2. Fetch data
			const query = queries.getTransactionsQuery(filters); // Use fresh filters
			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });

			const defaultHeaders = ['date', 'payee', 'narration', 'position'];
			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('date');
			const dataRows = firstRowIsHeader ? records.slice(1) : records;

			newTransactions = dataRows.map(row => {
				const completeRow = [...row];
				while(completeRow.length < defaultHeaders.length) completeRow.push('');
				return completeRow;
			});

		} catch (e) {
			console.error("Error fetching transactions:", e);
			newError = `Failed to load transactions: ${e.message}`;
			newTransactions = []; // Clear data on error
		} finally {
			// 3. Set final state immutably (create another new object)
			this.transactionState = {
				...this.transactionState, // Keep current filters
				isLoading: false,
				error: newError,
				currentTransactions: newTransactions
			};
			this.updateSvelteProps(); // Send final data/error state to Svelte
		}
	}
	// ---------------------------------
async loadOverviewData() {
		this.overviewState = { ...this.overviewState, isLoading: true, error: null, chartError: null };
		this.updateSvelteProps();

		const reportingCurrency = this.plugin.settings.reportingCurrency;
		if (!reportingCurrency) {
			this.overviewState = { ...this.overviewState, error: "Reporting Currency is not set.", isLoading: false };
			this.updateSvelteProps();
			return;
		}

		let newState: Partial<typeof this.overviewState> = { currency: reportingCurrency };

		try {
			const monthRange = getCurrentMonthRange();
			
			const [ assetsResult, liabilitiesResult, incomeResult, expensesResult, historicalResult ] = await Promise.all([
				this.plugin.runQuery(queries.getTotalAssetsCostQuery(reportingCurrency)),
				this.plugin.runQuery(queries.getTotalLiabilitiesCostQuery(reportingCurrency)),
				this.plugin.runQuery(queries.getMonthlyIncomeQuery(monthRange.start, monthRange.end, reportingCurrency)),
				this.plugin.runQuery(queries.getMonthlyExpensesQuery(monthRange.start, monthRange.end, reportingCurrency)),
				this.plugin.runQuery(queries.getHistoricalNetWorthDataQuery('month', reportingCurrency))
			]);

			// --- Process KPI Data ---
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

			newState.netWorth = `${netWorthNum.toFixed(2)} ${reportingCurrency}`;
			newState.monthlyIncome = `${incomeData.amount.toFixed(2)} ${reportingCurrency}`;
			newState.monthlyExpenses = `${expensesAbs.toFixed(2)} ${reportingCurrency}`;
			newState.savingsRate = incomeData.amount > 0 ? `${((savingsNum / incomeData.amount) * 100).toFixed(0)}%` : 'N/A';
			
			// --- Process Historical Data for Chart ---
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
			
			this.overviewState = { ...this.overviewState, ...newState, error: null };

		} catch (e) { 
			console.error("Error loading overview data:", e); 
			this.overviewState = { ...this.overviewState, error: `Failed to load data: ${e.message}` };
			new Notice(`Error loading overview: ${e.message}`, 0);
		} finally { 
			this.overviewState = { ...this.overviewState, isLoading: false };
			this.updateSvelteProps();
		}
	}
	// ----------------------------------------------------
	// Helper to push state updates to the Svelte component
	private updateSvelteProps() {
		if (this.component) {
			this.component.$set({
				// Pass the new state object down
				transactionState: this.transactionState,
				overviewState: this.overviewState
			});
		}
	}
}