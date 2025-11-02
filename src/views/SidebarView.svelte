<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Notice } from 'obsidian'; // Ensure Notice is imported

	export let isLoading = true;
	export let assets = "0 USD";
	export let liabilities = "0 USD";
	export let netWorth = "0.00 USD";
	export let kpiError: string | null = null;
	export let reportError: string | null = null;
	export let reportHeaders: string[] = [];
	export let reportRows: string[][] = [];
	export let fileStatus: "checking" | "ok" | "error" = "checking";
	export let fileStatusMessage: string | null = "";

	const dispatch = createEventDispatcher();

	function handleRefresh() {
		dispatch('refresh');
	}

	// Renders balance reports in the sidebar
	function handleReport(type: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses') {
		dispatch('renderReport', type);
	}

	function handleStatusClick() {
		if (fileStatus === 'error' && fileStatusMessage) {
			new Notice(fileStatusMessage, 0); // Show persistent notice
		}
	}
	function handleEditFile() {
		dispatch('editFile');
	}

</script>

<div class="beancount-header">
	<h2>Snapshot</h2>

	<div class="header-controls">
		<button
			type="button" class="beancount-status-button" class:status-ok={fileStatus === 'ok'}
			class:status-error={fileStatus === 'error'}
			on:click={handleStatusClick}
			title={fileStatus === 'error' ? 'Click to see error details' : 'File Status'}
			disabled={fileStatus === 'checking'} >
			{#if fileStatus === 'checking'}
				<span>Checking...</span>
			{:else if fileStatus === 'ok'}
				<span>✅ OK</span>
			{:else if fileStatus === 'error'}
				<span>❌ Error</span>
			{/if}
		</button>

		<button
			class="clickable-icon" aria-label="Edit Ledger File" title="Edit Ledger File"
			on:click={handleEditFile}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
		</button>

		<button on:click={handleRefresh} disabled={isLoading} class="refresh-button">
			{#if isLoading}
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
							<td class:align-right={i > 0}>{cell}</td>
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
	/* Styles adjusted slightly */
	.beancount-header {
		display: flex;
		justify-content: space-between; /* Space title and controls */
		align-items: center;
		padding-bottom: 10px;
		gap: 10px;
	}
	.beancount-header h2 {
		margin-right: 0; /* Let controls push right */
	}
	.header-controls { /* Wrapper for right-aligned controls */
		display: flex;
		align-items: center;
		gap: 8px; /* Consistent gap */
	}

	.beancount-status-button {
		font-size: inherit;
		padding: var(--size-4-1) var(--size-4-3);
		line-height: var(--line-height-normal);
		background-color: transparent;
		border: none;
		color: var(--text-muted);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		cursor: default;
	}
	.beancount-status-button.status-error { cursor: pointer; }
	.beancount-status-button:not(.status-error):hover { background-color: transparent; }
	.beancount-status-button span { font-weight: 500; }
	.beancount-status-button.status-ok span { color: var(--text-success); }
	.beancount-status-button.status-error span { color: var(--text-error); }

	.clickable-icon { /* Style for icon buttons */
		padding: 4px;
		cursor: pointer;
		background: none;
		border: none;
		color: var(--icon-color);
		display: inline-flex; /* Helps alignment */
		align-items: center;
	}
	.clickable-icon:hover { color: var(--icon-color-hover); }
	.clickable-icon svg { width: var(--icon-xs); height: var(--icon-xs); vertical-align: middle; }

	/* Refresh button and loading spinner */
	.refresh-button {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.loading-spinner {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* --- Other styles remain the same --- */
	.beancount-kpi-container { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
	.kpi-metric { display: flex; flex-direction: column; padding: 10px 12px; background-color: var(--background-secondary); border-radius: 6px; border: 1px solid var(--background-modifier-border); }
	.kpi-label { font-size: var(--font-ui-small); color: var(--text-muted); margin-bottom: 4px; }
	.kpi-value { font-size: 1.25em; font-weight: 600; }
	.net-worth { font-size: 1.4em; color: var(--text-accent); }
	.kpi-metric:first-child { grid-column: 1 / -1; }
	.beancount-nav { display: flex; gap: 8px; margin-bottom: 15px; }
	.beancount-report-container :global(table) { width: 100%; }
	.beancount-table { width: 100%; border-collapse: collapse; }
	.beancount-table th { text-align: left; font-size: var(--font-ui-small); font-weight: 600; color: var(--text-muted); padding: 8px 6px; border-bottom: 1px solid var(--background-modifier-border); text-transform: capitalize; }
	.beancount-table td { padding: 6px; border-bottom: 1px solid var(--background-secondary); }
	.beancount-table tbody tr:nth-child(even) { background-color: var(--background-secondary); }
	.align-right { text-align: right; font-family: var(--font-monospace); }
	.beancount-error-message { color: var(--text-error); font-size: var(--font-ui-small); padding: 10px; background-color: var(--background-secondary-alt); border-radius: 6px; border: 1px solid var(--background-modifier-border); grid-column: 1 / -1; word-break: break-all; white-space: pre-wrap; }
	/* Add these styles inside the <style> block */

	/* Target the last row in the table body */
	.beancount-table tbody tr:last-child {
		font-weight: 600; /* Make text bold */
		border-top: 2px solid var(--background-modifier-border); /* Add a top border */
		background-color: var(--background-secondary); /* Ensure background matches zebra striping */
	}

	/* Optional: Style the 'Total' label cell differently */
	.beancount-table tbody tr:last-child td:first-child {
		color: var(--text-muted);
	}
</style>