<script lang="ts">
	import CardComponent from '../CardComponent.svelte';
	import ChartComponent from '../ChartComponent.svelte';
	import type { OverviewController } from '../../controllers/OverviewController';
	import type { ChartConfiguration } from 'chart.js/auto';
	import { writable, type Writable } from 'svelte/store'; // Import writable
	import type { OverviewState } from '../../controllers/OverviewController'; // Import the State type

	// --- Receive the controller ---
	export let controller: OverviewController;

	// --- THIS IS THE FIX ---
	// 1. Create a local, placeholder store with default values.
	//    This ensures $stateStore is always a valid store.
	const placeholderState: Writable<OverviewState> = writable({
		isLoading: true,
		error: null,
		netWorth: '0.00 USD',
		monthlyIncome: '0.00 USD',
		monthlyExpenses: '0.00 USD',
		savingsRate: '0%',
		chartConfig: null,
		chartError: null,
		currency: 'USD',
	});

	// 2. Use a reactive statement ($:) to update the local store variable
	//    *after* the 'controller' prop is passed in.
	$: stateStore = controller ? controller.state : placeholderState;
	
	// 3. Now, '$stateStore' will safely subscribe, starting with the
	//    placeholder and then automatically switching to the real store.
	$: state = $stateStore;
	// -----------------------
</script>
<div class="beancount-overview">
	{#if state.isLoading}
		<p>Loading overview data...</p>
	{:else if state.error}
		<p class="error-message">Error: {state.error}</p>
	{:else}
		<div class="kpi-grid">
			<CardComponent label="Total Balance" value={state.netWorth} />
			<CardComponent label="Monthly Income" value={state.monthlyIncome} />
			<CardComponent label="Monthly Expenses" value={state.monthlyExpenses} />
			<CardComponent label="Savings Rate" value={state.savingsRate} />
		</div>
		
		<div class="chart-container">
			{#if state.chartError}
				<p class="error-message">Chart Error: {state.chartError}</p>
			{:else if state.chartConfig}
				<h4>Net Worth Over Time</h4>
				<ChartComponent config={state.chartConfig} height="300px"/>
			{:else if !state.isLoading}
				<p>Not enough data to display chart.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Styles remain unchanged */
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