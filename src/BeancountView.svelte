<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// --- PROPS ARE UPDATED ---
	export let isLoading = true;
	export let assets = "0 USD";
	export let liabilities = "0 USD";
	export let netWorth = "0.00 USD";
	export let kpiError: string | null = null;
	export let reportError: string | null = null;
	// 'reportHtml' is gone
	export let reportHeaders: string[] = []; // <-- NEW
	export let reportRows: string[][] = [];    // <-- NEW
	export let fileStatus: "checking" | "ok" | "error" = "checking";
	export let fileStatusMessage: string | null = "";
	// --------------------------

	const dispatch = createEventDispatcher();
	
	function handleRefresh() {
		dispatch('refresh');
	}
	function handleReport(type: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses') {
		dispatch('renderReport', type);
	}

</script>

<div class="beancount-header">
	<h2>Snapshot</h2>

	<div class="beancount-status-container" class:status-ok={fileStatus === 'ok'} class:status-error={fileStatus === 'error'}>
		{#if fileStatus === 'checking'}
			<span>Checking...</span>
		{:else if fileStatus === 'ok'}
			<span>✅ OK</span>
		{:else if fileStatus === 'error'}
			<span>❌ Error</span> 
		{/if}
	</div>
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
	<button on:click={() => handleReport('assets')} disabled={isLoading}>Assets</button>
	<button on:click={() => handleReport('liabilities')} disabled={isLoading}>Liabilities</button>
	<button on:click={() => handleReport('equity')} disabled={isLoading}>Equity</button>
	<button on:click={() => handleReport('income')} disabled={isLoading}>Income</button>
	<button on:click={() => handleReport('expenses')} disabled={isLoading}>Expenses</button>
</div>

<div class="beancount-report-container">
	{#if reportError}
		<div class="beancount-error-message">{reportError}</div>
	{:else if reportRows.length > 0}
		<table class="beancount-table">
			<thead>
				<tr>
					{#each reportHeaders as header}
						<th>{header}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each reportRows as row}
					<tr>
						{#each row as cell, i}
							<td class_right={i > 0}>{cell}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{:else if !isLoading}
		<p>No data returned for this report.</p>
	{/if}
</div>

<style>
	.beancount-header {
		display: flex; /* Use flexbox for alignment */
		justify-content: space-between; /* Space items out */
		align-items: center; /* Vertically align items */
		padding-bottom: 10px;
		gap: 10px; /* Add space between header items */
	}

	/* Keep title on the left */
/* Replace the old .beancount-header style with this */
	.beancount-header {
		display: flex;
		justify-content: flex-start; /* Align items to the start */
		align-items: center;
		padding-bottom: 10px;
		gap: 10px; /* This creates space between the items */
	}
	/* This is the magic: it pushes the status and button to the right */
	.beancount-header h2 {
		margin-right: auto; 
	}

	/* New Status Styles - Match Button Size */
	.beancount-status-container {
		/* Inherit font size from parent (should match button) */
		font-size: inherit;
		/* Add padding similar to buttons (adjust top/bottom as needed) */
		padding: var(--size-4-1) var(--size-4-3); /* Match button padding variables */
		line-height: var(--line-height-normal); /* Match button line height */
		background-color: transparent;
		border: none;
		color: var(--text-muted);
		white-space: nowrap;
		/* Ensure vertical alignment with button */
		display: inline-flex;
		align-items: center;
	}
	/* Style the spans directly for color */
	.beancount-status-container span {
		font-weight: 500; /* Normal button weight */
	}
	.beancount-status-container.status-ok span {
		color: var(--text-success);
	}
	.beancount-status-container.status-error span {
		color: var(--text-error);
	}
	.beancount-status-container pre {
		display: none;
	}

	/* --- Other styles are unchanged --- */
	.beancount-kpi-container {
		display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;
	}
	.kpi-metric {
		display: flex; flex-direction: column; padding: 10px 12px;
		background-color: var(--background-secondary); border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
	}
	.kpi-label { font-size: var(--font-ui-small); color: var(--text-muted); margin-bottom: 4px; }
	.kpi-value { font-size: 1.25em; font-weight: 600; }
	.net-worth { font-size: 1.4em; color: var(--text-accent); }
	.kpi-metric:first-child { grid-column: 1 / -1; }
	.beancount-nav { display: flex; gap: 8px; margin-bottom: 15px; }
	.beancount-report-container :global(table) { width: 100%; }
	.beancount-table { width: 100%; border-collapse: collapse; }
	.beancount-table th {
		text-align: left; font-size: var(--font-ui-small); font-weight: 600;
		color: var(--text-muted); padding: 8px 6px;
		border-bottom: 1px solid var(--background-modifier-border); text-transform: capitalize;
	}
	.beancount-table td { padding: 6px; border-bottom: 1px solid var(--background-secondary); }
	.beancount-table tbody tr:nth-child(even) { background-color: var(--background-secondary); }
	.class_right { text-align: right; font-family: var(--font-monospace); }
	.beancount-error-message { /* General error styling */
		color: var(--text-error); font-size: var(--font-ui-small); padding: 10px;
		background-color: var(--background-secondary-alt); border-radius: 6px;
		border: 1px solid var(--background-modifier-border); grid-column: 1 / -1;
		word-break: break-all; white-space: pre-wrap;
	}
</style>