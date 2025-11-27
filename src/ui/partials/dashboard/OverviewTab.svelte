<script lang="ts">
	import CardComponent from '../../common/CardComponent.svelte';
	import ChartComponent from '../../common/ChartComponent.svelte';
	import type { OverviewController } from '../../../controllers/OverviewController';
	import type { ChartConfiguration } from 'chart.js/auto';
	import { writable, type Writable } from 'svelte/store'; // Import writable
	import type { OverviewState } from '../../../controllers/OverviewController'; // Import the State type

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
	
	// Add refresh functionality
	function handleRefresh() {
		if (controller) {
			controller.loadData();
		}
	}
	// -----------------------
</script>
<div class="beancount-overview">
	<div class="overview-header">
		<h3>Financial Overview</h3>
		<button 
			on:click={handleRefresh} 
			disabled={state.isLoading} 
			class="refresh-button"
			title="Refresh overview data"
		>
			{#if state.isLoading}
				<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12a9 9 0 11-6.219-8.56"/>
				</svg>
				Refreshing...
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 013.5-7.1"/>
					<path d="M20.5 5.5a9 9 0 01.5 6.5"/>
					<path d="M3 12a9 9 0 016.5 8.1"/>
					<path d="M20.5 18.5a9 9 0 01-6.5-5.5"/>
				</svg>
				Refresh
			{/if}
		</button>
	</div>

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
	
	.overview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-4);
		padding-bottom: var(--size-4-2);
		border-bottom: 1px solid var(--background-modifier-border);
	}
	
	.overview-header h3 {
		margin: 0;
		color: var(--text-normal);
		font-size: var(--font-ui-larger);
	}
	
	.refresh-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: var(--size-4-1) var(--size-4-3);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: background-color 0.2s;
	}
	
	.refresh-button:hover:not(:disabled) {
		background: var(--interactive-hover);
	}
	
	.refresh-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	
	.loading-spinner {
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	
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