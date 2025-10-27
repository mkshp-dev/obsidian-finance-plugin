<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice } from 'obsidian';
	import CardComponent from './CardComponent.svelte';
	// --- ADD IMPORTS ---
	import * as queries from './queries';
	import { parseAmount } from './utils'; // Import parseAmount

	export let runQuery: (query: string) => Promise<string>;
	export let parseSingleValue: (csv: string) => string;

	// State
	let isLoading = true;
	let error: string | null = null;
	let netWorth = '0.00 USD';
	let monthlyIncome = '0.00 USD';
	let monthlyExpenses = '0.00 USD';
	let savingsRate = '0%';

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
			const [ assetsResult, liabilitiesResult, incomeResult, expensesResult ] = await Promise.all([
				runQuery(queries.getTotalAssetsQuery()),
				runQuery(queries.getTotalLiabilitiesQuery()),
				runQuery(queries.getMonthlyIncomeQuery(monthRange.start, monthRange.end)),
				runQuery(queries.getMonthlyExpensesQuery(monthRange.start, monthRange.end))
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

		} catch (e) { console.error("Error loading overview data:", e); error = `Failed to load data: ${e.message}`; new Notice(`Error loading overview: ${e.message}`, 0);
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
    {/if}
</div>

<style>
	/* Styles remain unchanged */
	.beancount-overview { padding: var(--size-4-4); }
	.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--size-4-4); }
	.error-message { color: var(--text-error); }
</style>