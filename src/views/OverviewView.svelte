<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice } from 'obsidian';
	import CardComponent from '../components/CardComponent.svelte';
	import * as queries from '../queries/index';
	import { parseAmount } from '../utils/index'; 
	import ChartComponent from '../components/ChartComponent.svelte';
	import { parse as parseCsv } from 'csv-parse/sync';
	import type { ChartConfiguration } from 'chart.js/auto';
	export let runQuery: (query: string) => Promise<string>;
	export let parseSingleValue: (csv: string) => string;

	// State
	let isLoading = true;
	let error: string | null = null;
	let netWorth = '0.00 USD';
	let monthlyIncome = '0.00 USD';
	let monthlyExpenses = '0.00 USD';
	let savingsRate = '0%';
	let chartConfig: ChartConfiguration | null = null;
	let chartError: string | null = null;

	// --- getCurrentMonthRange helper function (kept local) ---
	function getCurrentMonthRange(): { start: string, end: string } {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		const formatDate = (date: Date) => date.toISOString().slice(0, 10);
		return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) };
	}
	// ----------------------------------------------------

	onMount(async () => {
		isLoading = true; error = null;
		try {
			const monthRange = getCurrentMonthRange();

			// --- Use Imported Query Functions ---
			const [ assetsResult, liabilitiesResult, incomeResult, expensesResult, historicalResult ] = await Promise.all([
				runQuery(queries.getTotalAssetsQuery()),
				runQuery(queries.getTotalLiabilitiesQuery()),
				runQuery(queries.getMonthlyIncomeQuery(monthRange.start, monthRange.end)),
				runQuery(queries.getMonthlyExpensesQuery(monthRange.start, monthRange.end)),
				runQuery(queries.getHistoricalNetWorthDataQuery('month'))
			]);
			// ------------------------------------

			// --- Use Imported parseSingleValue (IF NEEDED) or parseAmount ---
			// Assuming parseSingleValue is still passed as a prop for consistency
			// If not using parseSingleValue anymore, you can remove it as a prop
			// and use parseAmount directly on the raw CSV if the format matches.
			// For sums, parseSingleValue is likely correct.
			const assetsStr = parseSingleValue ? parseSingleValue(assetsResult) : parseAmount(assetsResult).amount + ' ' + parseAmount(assetsResult).currency; // Adjust based on whether parseSingleValue prop exists
			const liabilitiesStr = parseSingleValue ? parseSingleValue(liabilitiesResult) : parseAmount(liabilitiesResult).amount + ' ' + parseAmount(liabilitiesResult).currency;
			const incomeStr = parseSingleValue ? parseSingleValue(incomeResult) : parseAmount(incomeResult).amount + ' ' + parseAmount(incomeResult).currency;
			const expensesStr = parseSingleValue ? parseSingleValue(expensesResult) : parseAmount(expensesResult).amount + ' ' + parseAmount(expensesResult).currency;
			console.log("Overview Data:", { assetsStr, liabilitiesStr, incomeStr, expensesStr });

			// --- Use Imported parseAmount ---
			const assetsData = parseAmount(assetsStr);
			const liabilitiesData = parseAmount(liabilitiesStr);
			const incomeData = parseAmount(incomeStr);
			const expensesData = parseAmount(expensesStr);
			const expensesAbs = Math.abs(expensesData.amount);
			const currency = assetsData.currency;
			console.log("Parsed Amounts:", { assetsData, liabilitiesData, incomeData, expensesData });

			const netWorthNum = assetsData.amount - liabilitiesData.amount;
			const savingsNum = incomeData.amount - expensesAbs;

			netWorth = `${netWorthNum.toFixed(2)} ${currency}`;
			monthlyIncome = `${incomeData.amount.toFixed(2)} ${currency}`;
			monthlyExpenses = `${expensesAbs.toFixed(2)} ${currency}`;
			savingsRate = incomeData.amount > 0 ? `${((savingsNum / incomeData.amount) * 100).toFixed(0)}%` : 'N/A';


			try {
				const cleanHistoricalStdout = historicalResult.replace(/\r/g, "").trim();
				// Expecting month, account, sum_position columns
				const historicalRecords: string[][] = parseCsv(cleanHistoricalStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });

				if (historicalRecords.length < 2) { throw new Error("Not enough data for chart."); }

				const firstRowIsHeader = historicalRecords[0][0]?.toLowerCase().includes('month') && // Check for month
				                         historicalRecords[0][2]?.toLowerCase().includes('sum');    // Check for sum
				const dataRows = firstRowIsHeader ? historicalRecords.slice(1) : historicalRecords;

				// Process into monthly changes, then calculate cumulative
				const monthlyChanges: { [month: string]: { assets: number, liabilities: number } } = {};
				let chartCurrency = currency; // Use currency from KPIs

				for (const row of dataRows) {
					if (row.length < 3) continue;
					const month = row[0]; // e.g., "2025-10"
					const account = row[1];
					const sumStr = row[2];
					const sumData = parseAmount(sumStr);

					if (!chartCurrency) chartCurrency = sumData.currency; // Backup currency detection
					if (!monthlyChanges[month]) monthlyChanges[month] = { assets: 0, liabilities: 0 };

					if (account.startsWith('Assets')) {
						monthlyChanges[month].assets += sumData.amount;
					} else if (account.startsWith('Liabilities')) {
						// Liability positions often have opposite sign in Beancount balance calculation
						// Depending on how SUM handles it, we might need to adjust. Let's assume SUM is direct for now.
						monthlyChanges[month].liabilities += sumData.amount;
					}
				}

				// Calculate cumulative net worth
				const labels: string[] = [];
				const dataPoints: number[] = [];
				let cumulativeNetWorth = 0;
				const sortedMonths = Object.keys(monthlyChanges).sort();

				for (const month of sortedMonths) {
					const change = monthlyChanges[month];
					// Net Worth = Assets - Liabilities. Liability sum might be positive or negative depending on context.
					// Assuming sum(position) for Liab is positive for increase in liab, negative for decrease.
					// Net Worth Change = Asset Change - Liability Change
					cumulativeNetWorth += (change.assets - change.liabilities);
					labels.push(month); // Use month as label
					dataPoints.push(cumulativeNetWorth);
				}
					// --- Create Chart.js Configuration ---
					chartConfig = {
						type: 'line',
						data: {
							labels: labels,
							datasets: [{
								label: `Net Worth (${currency})`, data: dataPoints,
								borderColor: 'rgb(75, 192, 192)', tension: 0.1
							}]
						},
						options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
					};
					chartError = null; // Clear previous chart error on success
			} catch (chartDataError) {
				console.error("Error processing chart data:", chartDataError);
				chartError = `Failed to process chart data: ${chartDataError.message}`;
				chartConfig = null;
			}
		} catch (e) { 
			console.error("Error loading overview data:", e); 
			error = `Failed to load data: ${e.message}`; 
			chartError = "Could not load chart data due to main error.";
			new Notice(`Error loading overview: ${e.message}`, 0);
		} finally { isLoading = false; }
	});

	// --- REMOVED parseAmount definition ---

</script>

<div class="beancount-overview">
    {#if isLoading}
        <p>Loading overview data...</p>
    {:else if error}
        <p class="error-message">Error: {error}</p>
    {:else}
        <div class="kpi-grid">
            <CardComponent label="Total Balance" value={netWorth} />
            <CardComponent label="Monthly Income" value={monthlyIncome} />
            <CardComponent label="Monthly Expenses" value={monthlyExpenses} />
            <CardComponent label="Savings Rate" value={savingsRate} />
        </div>
		<div class="chart-container">
			{#if chartError}
				<p class="error-message">Chart Error: {chartError}</p>
			{:else if chartConfig}
				<h4>Net Worth Over Time</h4>
				<ChartComponent config={chartConfig} height="300px"/>
			{:else if !isLoading}
				<p>Not enough data to display chart.</p>
			{/if}
		</div>
    {/if}
</div>

<style>
	/* Styles remain unchanged */
	.beancount-overview { padding: var(--size-4-4); }
	.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--size-4-4); }
	.error-message { color: var(--text-error); }
	.chart-container { margin-top: var(--size-4-8); height: 300px; position: relative; }
	.chart-container h4 { text-align: center; margin-bottom: var(--size-4-4); color: var(--text-muted); }
</style>