<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Notice } from 'obsidian'; // Ensure Notice is imported

	export let isLoading = true;
	export let assets = "0 USD";
	export let liabilities = "0 USD";
	export let netWorth = "0.00 USD";
	export let hasUnconvertedCommodities = false;
	export let kpiError: string | null = null;
	export let fileStatus: "checking" | "ok" | "error" = "checking";
	export let fileStatusMessage: string | null = "";
	export let errorCount = 0;
	export let errorList: string[] = [];

	const dispatch = createEventDispatcher();

	function handleRefresh() {
		dispatch('refresh');
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
				<span>❌ {errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
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

{#if hasUnconvertedCommodities && !kpiError}
	<div class="conversion-warning">
		<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
			<path d="M12 9v4"/>
			<path d="m12 17 .01 0"/>
		</svg>
		<span>Some commodities lack price data and are excluded from totals</span>
	</div>
{/if}

{#if fileStatus === 'error' && errorList.length > 0}
	<hr class="error-separator">
	<div class="error-section">
		<h4>Errors ({errorCount})</h4>
		<div class="error-list">
			{#each errorList as error}
				<div class="error-item">
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<path d="m15 9-6 6"/>
						<path d="m9 9 6 6"/>
					</svg>
					<span class="error-text">{error}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

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

	/* --- KPI Styles --- */
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
	
	/* --- Error Message Styles --- */
	.beancount-error-message { 
		color: var(--text-error); 
		font-size: var(--font-ui-small); 
		padding: 10px; 
		background-color: var(--background-secondary-alt); 
		border-radius: 6px; 
		border: 1px solid var(--background-modifier-border); 
		grid-column: 1 / -1; 
		word-break: break-all; 
		white-space: pre-wrap; 
	}

	/* --- Conversion Warning Styles --- */
	.conversion-warning {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-ui-small);
		color: var(--text-warning);
		background-color: var(--background-modifier-warning);
		padding: 8px 10px;
		border-radius: 4px;
		border: 1px solid var(--color-warning);
		margin-top: 10px;
	}
	.conversion-warning svg {
		flex-shrink: 0;
		color: var(--text-warning);
	}
	.conversion-warning span {
		line-height: 1.3;
	}

	/* --- Error Section Styles --- */
	.error-separator {
		border: none;
		border-top: 1px solid var(--background-modifier-border);
		margin: 15px 0 10px 0;
	}
	
	.error-section h4 {
		color: var(--text-error);
		margin: 0 0 10px 0;
		font-size: var(--font-ui-medium);
	}
	
	.error-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	
	.error-item {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 6px 8px;
		background-color: var(--background-secondary);
		border-radius: 4px;
		border-left: 3px solid var(--text-error);
	}
	
	.error-item svg {
		flex-shrink: 0;
		color: var(--text-error);
		margin-top: 2px;
	}
	
	.error-text {
		font-size: var(--font-ui-small);
		color: var(--text-normal);
		line-height: 1.4;
		word-break: break-all;
		font-family: var(--font-monospace);
	}
</style>