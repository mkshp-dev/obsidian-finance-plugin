<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// These are the simple, safe props passed from view.ts
	export let isLoading = true;
	export let assets = "0 USD";
	export let liabilities = "0 USD";
	export let netWorth = "0.00 USD";
	export let kpiError: string | null = null;
	export let reportError: string | null = null;
	export let reportHtml: string = "Loading...";

	// Create a function to send events *up* to the parent
	const dispatch = createEventDispatcher();
	
	function handleRefresh() {
		dispatch('refresh');
	}
	
	function handleReport(type: 'balance' | 'income' | 'expenses') {
		dispatch('renderReport', type);
	}

</script>

<div class="beancount-header">
	<h2>Snapshot</h2>
	<button on:click={handleRefresh} disabled={isLoading}>
		{isLoading ? "Refreshing..." : "Refresh"}
	</button>
</div>

<h4>Key Metrics</h4>
<div class="beancount-kpi-container">
	{#if kpiError}
		<div class="beancount-error-message">{kpiError}</div>
	{:else}
		<div class="kpi-metric">
			<span class="kpi-label">Net Worth</span>
			<span class="kpi-value net-worth">{netWorth}</span>
		</div>
		<div class="kpi-metric">
			<span class="kpi-label">Assets</span>
			<span class="kpi-value">{assets}</span>
		</div>
		<div class="kpi-metric">
			<span class="kpi-label">Liabilities</span>
			<span class="kpi-value">{liabilities}</span>
		</div>
	{/if}
</div>

<div class="beancount-nav">
	<button on:click={() => handleReport('balance')} disabled={isLoading}>Balance</button>
	<button on:click={() => handleReport('income')} disabled={isLoading}>Income</button>
	<button on:click={() => handleReport('expenses')} disabled={isLoading}>Expenses</button>
</div>

<div class="beancount-report-container">
	{#if reportError}
		<div class="beancount-error-message">{reportError}</div>
	{:else}
		{@html reportHtml}
	{/if}
</div>


<style>
	.beancount-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 10px;
	}

	.beancount-kpi-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 15px;
	}

	.kpi-metric {
		display: flex;
		flex-direction: column;
		padding: 10px 12px;
		background-color: var(--background-secondary);
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
	}

	.kpi-label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	.kpi-value {
		font-size: 1.25em;
		font-weight: 600;
	}

	.net-worth {
		font-size: 1.4em;
		color: var(--text-accent);
	}

	.kpi-metric:first-child {
		grid-column: 1 / -1;
	}

	.beancount-nav {
		display: flex;
		gap: 8px;
		margin-bottom: 15px;
	}
	
	/* :global() lets us style the table rendered by MarkdownRenderer */
	.beancount-report-container :global(table) {
		width: 100%;
	}

	.beancount-error-message {
		color: var(--text-error);
		font-size: var(--font-ui-small);
		padding: 10px;
		background-color: var(--background-secondary-alt);
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		grid-column: 1 / -1;
	}
</style>