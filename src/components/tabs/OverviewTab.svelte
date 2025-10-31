<script lang="ts">
	// This component is now "dumb". It just receives props.
	import CardComponent from '../CardComponent.svelte';
	import ChartComponent from '../ChartComponent.svelte';
	import type { ChartConfiguration } from 'chart.js/auto';

	// Props received from the parent view
	export let isLoading: boolean = true;
	export let error: string | null = null;
	export let netWorth: string = '0.00 USD';
	export let monthlyIncome: string = '0.00 USD';
	export let monthlyExpenses: string = '0.00 USD';
	export let savingsRate: string = '0%';
	export let chartConfig: ChartConfiguration | null = null;
	export let chartError: string | null = null;

	// All onMount, runQuery, and helper functions are GONE.
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
	.beancount-overview { padding: var(--size-4-4); }
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--size-4-4);
	}
	.error-message { color: var(--text-error); }
	.chart-container {
		margin-top: var(--size-4-8);
		height: 300px;
		position: relative;
	}
	.chart-container h4 {
		text-align: center;
		margin-bottom: var(--size-4-4);
		color: var(--text-muted);
	}
</style>