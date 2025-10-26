<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice } from 'obsidian';
	// --- Import the new CardComponent ---
	import CardComponent from './CardComponent.svelte';
	// ------------------------------------

	// Props
	export let runQuery: (query: string) => Promise<string>;
	export let parseSingleValue: (csv: string) => string | null;

	// State
	let isLoading = true;
	let error: string | null = null;
	let netWorth = '0.00 USD';
	let monthlyIncome = '0.00 USD';
	let monthlyExpenses = '0.00 USD';
	let savingsRate = '0%';
	// currency is derived, not needed as separate state here

	onMount(async () => {
		isLoading = true; error = null;
		try {
			const monthRange = getCurrentMonthRange();
			const assetsQuery = `SELECT sum(position) WHERE account ~ '^Assets'`;
			const liabilitiesQuery = `SELECT sum(position) WHERE account ~ '^Liabilities'`;
			const incomeQuery = `SELECT sum(position) WHERE account ~ '^Income' AND date >= ${monthRange.start} AND date <= ${monthRange.end}`;
			const expensesQuery = `SELECT sum(position) WHERE account ~ '^Expenses' AND date >= ${monthRange.start} AND date <= ${monthRange.end}`;

			const [ assetsResult, liabilitiesResult, incomeResult, expensesResult ] = await Promise.all([
				runQuery(assetsQuery), runQuery(liabilitiesQuery), runQuery(incomeQuery), runQuery(expensesQuery)
			]);

			const assetsStr = parseSingleValue(assetsResult) || '0 USD';
			const liabilitiesStr = parseSingleValue(liabilitiesResult) || '0 USD';
			const incomeStr = parseSingleValue(incomeResult) || '0 USD';
			const expensesStr = parseSingleValue(expensesResult) || '0 USD';
            console.log("Overview Data:", { assetsStr, liabilitiesStr, incomeStr, expensesStr });
            const parseAmount = (s: string): { amount: number, currency: string } => {
                const match = s.match(/(-?[\d,]+\.?\d*)\s*(\S+)/);
                return {
                    amount: match ? parseFloat(match[1].replace(/,/g, '')) : 0,
                    currency: match ? match[2] : 'USD'
                };
            };

			const assetsData = parseAmount(assetsStr);
			const liabilitiesData = parseAmount(liabilitiesStr);
			const incomeData = parseAmount(incomeStr);
			const expensesData = parseAmount(expensesStr);
			const expensesAbs = Math.abs(expensesData.amount);
			const currency = assetsData.currency; // Determine currency
            console.log("Parsed Amounts:", { assetsData, liabilitiesData, incomeData, expensesData });
			const netWorthNum = assetsData.amount - liabilitiesData.amount;
			const savingsNum = incomeData.amount - expensesAbs;

			// Update state variables directly
			netWorth = `${netWorthNum.toFixed(2)} ${currency}`;
			monthlyIncome = `${incomeData.amount.toFixed(2)} ${currency}`;
			monthlyExpenses = `${expensesAbs.toFixed(2)} ${currency}`;
			savingsRate = incomeData.amount > 0 ? `${((savingsNum / incomeData.amount) * 100).toFixed(0)}%` : 'N/A';

		} catch (e) { console.error("Error loading overview data:", e); error = `Failed to load data: ${e.message}`; new Notice(`Error loading overview: ${e.message}`, 0);
		} finally { isLoading = false; }
	});

	// --- getCurrentMonthRange helper function ---
	function getCurrentMonthRange(): { start: string, end: string } {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		const formatDate = (date: Date) => date.toISOString().slice(0, 10);
		return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) };
	}
	// --- parseAmount helper function ---
	const parseAmount = (s: string): { amount: number, currency: string } => {
		const match = s.match(/(-?[\d,]+\.?\d*)\s*(\S+)/);
		return {
			amount: match ? parseFloat(match[1].replace(/,/g, '')) : 0,
			currency: match ? match[2] : 'USD'
		};
	};

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
	/* Styles are simpler now, mostly grid layout */
	.beancount-overview {
		padding: var(--size-4-4);
	}
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* Responsive grid */
		gap: var(--size-4-4);
	}
	.error-message {
		color: var(--text-error);
	}
</style>