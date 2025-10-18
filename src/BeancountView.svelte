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
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 10px;
	}

	/* ... kpi and nav styles are unchanged ... */
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
	.beancount-error-message {
		color: var(--text-error);
		font-size: var(--font-ui-small);
		padding: 10px;
		background-color: var(--background-secondary-alt);
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		grid-column: 1 / -1;
	}

	/* --- NEW TABLE STYLES --- */
	.beancount-table {
		width: 100%;
		border-collapse: collapse; /* Cleaner lines */
	}
	
	/* Style the table header */
	.beancount-table th {
		text-align: left;
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-muted);
		padding: 8px 6px;
		border-bottom: 1px solid var(--background-modifier-border);
		text-transform: capitalize; /* Make headers like "account" -> "Account" */
	}
	
	/* Style the table cells */
	.beancount-table td {
		padding: 6px;
		border-bottom: 1px solid var(--background-secondary);
	}
	
	/* Add "zebra striping" for readability */
	.beancount-table tbody tr:nth-child(even) {
		background-color: var(--background-secondary);
	}

	/* Utility class to align text to the right */
	.class_right {
		text-align: right;
		font-family: var(--font-monospace); /* Monospace font for numbers */
	}
</style>