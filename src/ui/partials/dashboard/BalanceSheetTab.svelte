<script lang="ts">
	// --- REMOVED onMount, parseCsv, queries, plugin imports ---
	import { writable, type Writable } from 'svelte/store';
	import type { BalanceSheetController, BalanceSheetState, AccountItem } from '../../../controllers/BalanceSheetController';
	import { Logger } from '../../../utils/logger';
	import { AccountManagementModal } from '../../modals/AccountManagementModal';
	import SunburstChart from '../../common/SunburstChart.svelte';
	import ChartComponent from '../../common/ChartComponent.svelte';

	// Chart selector: which chart is shown in the chart area
	let selectedChart: 'trend' | 'balances' = 'trend';
	// Sub-selector for Balances view
	let selectedBalanceSection: 'assets' | 'liabilities' | 'equity' = 'assets';

	// --- Receive the controller ---
	export let controller: BalanceSheetController;

	// --- Set up a placeholder and subscribe to the store ---
	const placeholderState: Writable<BalanceSheetState> = writable({
		isLoading: true, error: null, assets: [], liabilities: [], equity: [],
		totalAssets: 0, totalLiabilities: 0, totalEquity: 0, currency: 'INR',
		hasUnconvertedCommodities: false, unconvertedWarning: null, valuationMethod: 'convert',
		chartConfig: null, chartError: null, chartLoading: false, chartInterval: 'month'
	});
	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;
	// ------------------------------------------------------

	// Helper function to generate indentation based on account level
	function getIndentation(level: number): string {
		return '\u00A0'.repeat(level * 4); // Non-breaking spaces for proper indentation
	}

	// Helper function to get CSS class based on account level
	function getAccountClass(item: AccountItem): string {
		const baseClass = 'account-row';
		const levelClass = `level-${item.level}`;
		const typeClass = item.isCategory ? 'category' : 'leaf';
		return `${baseClass} ${levelClass} ${typeClass}`;
	}

	// Helper function to determine if other currencies column should be visible
	function hasOtherCurrencies(accounts: AccountItem[]): boolean {
		return accounts.some(item => item.otherCurrencies && item.otherCurrencies.trim() !== '');
	}

	// Always show other currencies column for all valuation methods if any section has them
	$: showOtherCurrenciesColumn = state.assets && state.liabilities && state.equity && 
		(hasOtherCurrencies(state.assets) || hasOtherCurrencies(state.liabilities) || hasOtherCurrencies(state.equity));

	// Handle valuation method change
	async function handleValuationMethodChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const method = target.value as 'convert' | 'cost' | 'units';
		if (controller) {
			await controller.setValuationMethod(method);
		}
	}

	// Get display label for the current valuation method
	function getValuationMethodLabel(method: string): string {
		switch (method) {
			case 'convert': return 'Market Value';
			case 'cost': return 'At Cost';
			case 'units': return 'Units';
			default: return 'Market Value';
		}
	}

	// Collapsible hierarchy state
	let collapsedAccounts = new Set<string>();

	function toggleCollapse(account: string, event?: MouseEvent) {
		if (event) {
			event.stopPropagation();
		}
		Logger.log('Toggle collapse for:', account, 'Currently collapsed?', collapsedAccounts.has(account));
		const newSet = new Set(collapsedAccounts);
		if (newSet.has(account)) {
			newSet.delete(account);
		} else {
			newSet.add(account);
		}
		collapsedAccounts = newSet; // Trigger reactivity with new Set instance
		Logger.log('New collapsed state:', Array.from(collapsedAccounts));
	}

	function isCollapsed(account: string): boolean {
		return collapsedAccounts.has(account);
	}

	function shouldShowRow(item: AccountItem, collapsed: Set<string>): boolean {
		// Always show root level items
		if (item.level === 0) return true;
		
		// Check if any parent is collapsed
		const accountParts = item.account.split(':');
		for (let i = 1; i < accountParts.length; i++) {
			const parentPath = accountParts.slice(0, i).join(':');
			if (collapsed.has(parentPath)) {
				return false;
			}
		}
		return true;
	}

	// Create reactive filtered lists that depend on collapsedAccounts
	$: visibleAssets = state.assets ? state.assets.filter(item => shouldShowRow(item, collapsedAccounts)) : [];
	$: visibleLiabilities = state.liabilities ? state.liabilities.filter(item => shouldShowRow(item, collapsedAccounts)) : [];
	$: visibleEquity = state.equity ? state.equity.filter(item => shouldShowRow(item, collapsedAccounts)) : [];

	// Account management functions
	function handleOpenAccount() {
		const plugin = controller.plugin;
		const modal = new AccountManagementModal(
			plugin.app,
			plugin,
			'open',
			async () => {
				// Refresh callback
				await controller.loadData();
			}
		);
		modal.open();
	}

	function handleCloseAccount() {
		const plugin = controller.plugin;
		const modal = new AccountManagementModal(
			plugin.app,
			plugin,
			'close',
			async () => {
				// Refresh callback
				await controller.loadData();
			}
		);
		modal.open();
	}

	function handleRefresh() {
		if (controller) {
			controller.loadData();
		}
	}

	function handleIntervalChange(interval: 'month' | 'week') {
		if (controller && state.chartInterval !== interval) {
			controller.setChartInterval(interval);
		}
	}
</script>

<div class="balance-sheet-container">
	<!-- Header: Title + Account Management buttons + Refresh -->
	<div class="balance-sheet-header">
		<h2>Accounts and Balances</h2>
		<div class="header-controls">
			<div class="account-management-section">
				<button class="account-action-btn open-account-btn" on:click={handleOpenAccount}>
					➕ Open Account
				</button>
				<button class="account-action-btn close-account-btn" on:click={handleCloseAccount}>
					❌ Close Account
				</button>
			</div>
			<button
				on:click={handleRefresh}
				disabled={state.isLoading}
				class="refresh-button"
				title="Refresh data"
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
						<path d="M3 12a9 9 0 006.5 8.1"/>
						<path d="M20.5 18.5a9 9 0 01-6.5-5.5"/>
					</svg>
					Refresh
				{/if}
			</button>
		</div>
	</div>

	{#if state.isLoading}
		<p>Loading data...</p>
	{:else if state.error}
		<p class="error-message">{state.error}</p>
	{:else}
		<!-- Multi-currency warning -->
		{#if state.hasUnconvertedCommodities && state.unconvertedWarning}
			<div class="warning-banner">
				<span class="warning-icon">⚠️</span>
				<span class="warning-text">{state.unconvertedWarning}</span>
			</div>
		{/if}

		<!-- Chart Area -->
		<div class="chart-area">
			<div class="chart-area-header">
				<div class="chart-selector" role="group" aria-label="Select chart">
					<button
						class="chart-selector-btn"
						class:active={selectedChart === 'trend'}
						on:click={() => (selectedChart = 'trend')}
						aria-pressed={selectedChart === 'trend'}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
						</svg>
						Net Worth Trend
					</button>
					<button
						class="chart-selector-btn"
						class:active={selectedChart === 'balances'}
						on:click={() => (selectedChart = 'balances')}
						aria-pressed={selectedChart === 'balances'}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="3"/>
							<circle cx="12" cy="12" r="7"/>
							<circle cx="12" cy="12" r="11"/>
						</svg>
						Balances
					</button>
				</div>
				{#if selectedChart === 'trend'}
					<div class="interval-toggle">
						<button
							class:active={state.chartInterval === 'month'}
							on:click={() => handleIntervalChange('month')}
							disabled={state.chartLoading}
						>Monthly</button>
						<button
							class:active={state.chartInterval === 'week'}
							on:click={() => handleIntervalChange('week')}
							disabled={state.chartLoading}
						>Weekly</button>
					</div>
				{:else if selectedChart === 'balances'}
					<div class="balance-section-toggle">
						<button
							class:active={selectedBalanceSection === 'assets'}
							on:click={() => (selectedBalanceSection = 'assets')}
						>Assets</button>
						<button
							class:active={selectedBalanceSection === 'liabilities'}
							on:click={() => (selectedBalanceSection = 'liabilities')}
						>Liabilities</button>
						<button
							class:active={selectedBalanceSection === 'equity'}
							on:click={() => (selectedBalanceSection = 'equity')}
						>Equity</button>
					</div>
				{/if}
			</div>

			{#if selectedChart === 'trend'}
				<div class="trend-chart-container">
					{#if state.chartError}
						<p class="error-message">Chart Error: {state.chartError}</p>
					{:else if state.chartLoading}
						<p class="chart-loading">Loading chart...</p>
					{:else if state.chartConfig}
						<ChartComponent config={state.chartConfig} height="300px"/>
					{:else}
						<p class="chart-loading">Not enough data to display chart.</p>
					{/if}
				</div>
			{:else if selectedChart === 'balances'}
				{#if selectedBalanceSection === 'assets'}
					<SunburstChart
						title="Assets"
						assets={state.assets}
						liabilities={[]}
						equity={[]}
						currency={state.currency}
						totalAssets={state.totalAssets}
						totalLiabilities={0}
						totalEquity={0}
					/>
				{:else if selectedBalanceSection === 'liabilities'}
					<SunburstChart
						title="Liabilities"
						assets={[]}
						liabilities={state.liabilities}
						equity={[]}
						currency={state.currency}
						totalAssets={0}
						totalLiabilities={state.totalLiabilities}
						totalEquity={0}
					/>
				{:else}
					<SunburstChart
						title="Equity"
						assets={[]}
						liabilities={[]}
						equity={state.equity}
						currency={state.currency}
						totalAssets={0}
						totalLiabilities={0}
						totalEquity={state.totalEquity}
					/>
				{/if}
			{/if}
		</div>

		<!-- Balance Sheet (always visible) -->
		<div class="balance-sheet-section">
			<div class="balance-sheet-section-header">
				<h3>Balance Sheet</h3>
				<div class="valuation-method-selector">
					<label for="valuation-method">Valuation:</label>
					<select
						id="valuation-method"
						value={state.valuationMethod || 'convert'}
						on:change={handleValuationMethodChange}
					>
						<option value="convert">Market Value (Convert to {state.currency})</option>
						<option value="cost">At Cost</option>
						<option value="units">Units</option>
					</select>
				</div>
			</div>

		<div class="balance-sheet-grid">
			<div class="column">
				<h4>Assets</h4>
				<table class="beancount-table">
					<thead>
						<tr class="header-row">
							<th class="account-header">Account</th>
							<th class="amount-header">{state.currency}</th>
							{#if showOtherCurrenciesColumn}
								<th class="other-currencies-header">Other Currencies</th>
							{/if}
						</tr>
					</thead>
				<tbody>
					{#each visibleAssets as item}
						<tr class={getAccountClass(item)}>
							<td class="account-name" 
								on:click={(e) => item.isCategory && toggleCollapse(item.account, e)} 
								style="cursor: {item.isCategory ? 'pointer' : 'default'};">
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell">
										{item.otherCurrencies || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="column">
				<h4>Liabilities</h4>
				<table class="beancount-table">
					<thead>
						<tr class="header-row">
							<th class="account-header">Account</th>
							<th class="amount-header">{state.currency}</th>
							{#if showOtherCurrenciesColumn}
								<th class="other-currencies-header">Other Currencies</th>
							{/if}
						</tr>
					</thead>
				<tbody>
					{#each visibleLiabilities as item}
						<tr class={getAccountClass(item)}>
							<td class="account-name" 
								on:click={(e) => item.isCategory && toggleCollapse(item.account, e)} 
								style="cursor: {item.isCategory ? 'pointer' : 'default'};">
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell">
										{item.otherCurrencies || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="column">
				<h4 class="section-spacer">Equity</h4>
				<table class="beancount-table">
					<thead>
						<tr class="header-row">
							<th class="account-header">Account</th>
							<th class="amount-header">{state.currency}</th>
							{#if showOtherCurrenciesColumn}
								<th class="other-currencies-header">Other Currencies</th>
							{/if}
						</tr>
					</thead>
				<tbody>
					{#each visibleEquity as item}
						<tr class={getAccountClass(item)}>
							<td class="account-name" 
								on:click={(e) => item.isCategory && toggleCollapse(item.account, e)} 
								style="cursor: {item.isCategory ? 'pointer' : 'default'};">
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell">
										{item.otherCurrencies || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
		</div>
	{/if}
</div>

<style>
	.balance-sheet-container { 
		padding: var(--size-4-4); 
		width: 100%;
		overflow-x: auto;
	}

	/* Header with valuation method selector */
	.balance-sheet-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-6);
		flex-wrap: wrap;
		gap: var(--size-4-4);
	}

	.balance-sheet-header h2 {
		margin: 0;
		flex: 1;
	}

	.header-controls {
		display: flex;
		gap: var(--size-4-4);
		align-items: center;
		flex-wrap: wrap;
	}

	.account-management-section {
		display: flex;
		gap: var(--size-4-2);
	}

	.account-action-btn {
		padding: var(--size-4-2) var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.account-action-btn:hover {
		background: var(--interactive-hover);
		border-color: var(--interactive-accent);
	}

	.open-account-btn:hover {
		background: var(--color-green);
		color: var(--text-on-accent);
	}

	.close-account-btn:hover {
		background: var(--color-red);
		color: var(--text-on-accent);
	}

	/* Chart area */
	.chart-area {
		margin-bottom: var(--size-4-8);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		background: var(--background-secondary);
	}

	.chart-area-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-4);
		flex-wrap: wrap;
		gap: var(--size-4-2);
	}

	.chart-selector {
		display: flex;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;
	}

	.chart-selector-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		border: none;
		background: var(--interactive-normal);
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: background 0.15s, color 0.15s;
	}

	.chart-selector-btn:not(:last-child) {
		border-right: 1px solid var(--background-modifier-border);
	}

	.chart-selector-btn:hover {
		background: var(--interactive-hover);
		color: var(--text-normal);
	}

	.chart-selector-btn.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.interval-toggle,
	.balance-section-toggle {
		display: flex;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;
	}

	.interval-toggle button,
	.balance-section-toggle button {
		padding: var(--size-4-1) var(--size-4-3);
		background: var(--interactive-normal);
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: background-color 0.15s, color 0.15s;
	}

	.interval-toggle button:not(:last-child),
	.balance-section-toggle button:not(:last-child) {
		border-right: 1px solid var(--background-modifier-border);
	}

	.interval-toggle button.active,
	.balance-section-toggle button.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.interval-toggle button:hover:not(.active):not(:disabled),
	.balance-section-toggle button:hover:not(.active) {
		background: var(--interactive-hover);
		color: var(--text-normal);
	}

	.interval-toggle button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.trend-chart-container {
		height: 320px;
		position: relative;
	}

	/* Balance Sheet section */
	.balance-sheet-section {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
	}

	.balance-sheet-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-4);
		flex-wrap: wrap;
		gap: var(--size-4-2);
	}

	.balance-sheet-section-header h3 {
		margin: 0;
		color: var(--text-normal);
		font-size: var(--font-ui-larger);
	}

	.valuation-method-selector {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.valuation-method-selector label {
		font-size: 0.9em;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.valuation-method-selector select {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: var(--size-4-1) var(--size-4-2);
		color: var(--text-normal);
		font-size: 0.9em;
		min-width: 200px;
	}

	.valuation-method-selector select:focus {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.column {
		min-width: 0; /* Allow columns to shrink */
		overflow-x: auto;
	}

	/* Multi-currency warning banner */
	.warning-banner {
		background-color: var(--background-modifier-form-field);
		border: 1px solid var(--color-orange);
		border-radius: var(--radius-s);
		padding: var(--size-4-2) var(--size-4-3);
		margin-bottom: var(--size-4-4);
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.warning-icon {
		font-size: 1.1em;
		color: var(--color-orange);
	}

	.warning-text {
		color: var(--text-muted);
		font-size: 0.9em;
		line-height: 1.4;
	}

	.balance-sheet-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-8);
		align-items: start;
		overflow-x: auto; /* Allow horizontal scroll if needed */
	}

	@media (max-width: 1200px) {
		.balance-sheet-grid {
			grid-template-columns: 1fr;
			gap: var(--size-4-6);
		}

		.balance-sheet-header {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--size-4-3);
		}

		.valuation-method-selector {
			width: 100%;
			justify-content: space-between;
		}

		.valuation-method-selector select {
			min-width: 180px;
		}
	}
	
	.column h4 { 
		margin-top: 0; 
		color: var(--text-normal);
		border-bottom: 1px solid var(--background-modifier-border);
		padding-bottom: var(--size-4-2);
	}
	
	.section-spacer { 
		margin-top: var(--size-4-6); 
	}
	
	.grand-total { 
		margin-top: var(--size-4-4); 
	}
	
	.beancount-table { 
		width: 100%; 
		border-collapse: collapse;
		table-layout: fixed; /* Fixed layout for better control */
		min-width: 400px; /* Minimum width to prevent cramping */
	}

	/* Table headers */
	.beancount-table thead {
		background-color: var(--background-modifier-form-field);
		border-bottom: 2px solid var(--background-modifier-border);
	}

	.header-row th {
		padding: var(--size-4-3);
		font-weight: 600;
		color: var(--text-normal);
		text-align: left;
		border-bottom: 2px solid var(--background-modifier-border);
		word-wrap: break-word;
	}

	.account-header {
		width: 40%;
		min-width: 140px;
	}

	.amount-header {
		width: 25%;
		text-align: right !important;
		min-width: 100px;
	}

	.other-currencies-header {
		width: 35%;
		text-align: right !important;
		min-width: 140px;
		color: var(--text-muted);
	}
	
	.beancount-table td, 
	.beancount-table th { 
		padding: var(--size-4-2) var(--size-4-3); 
		border-bottom: 1px solid var(--background-secondary); 
		vertical-align: top; /* Changed from middle to top for multi-line content */
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.account-name {
		font-family: var(--font-interface);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
		width: 40%;
	}

	.collapse-icon {
		display: inline-block;
		width: 12px;
		margin-right: 4px;
		font-size: 0.8em;
		color: var(--text-muted);
		user-select: none;
	}

	.amount-cell {
		font-family: var(--font-monospace);
		white-space: nowrap;
		width: 25%;
		text-align: right;
	}

	.other-currencies-cell {
		font-family: var(--font-monospace);
		color: var(--text-muted);
		font-size: 0.9em;
		width: 35%;
		text-align: right;
		/* Allow text wrapping for multi-currency content */
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.4;
		max-width: 150px;
		padding: var(--size-4-1) var(--size-4-2);
		vertical-align: top; /* Align to top for multi-line content */
	}
	
	/* Hierarchical account styling */
	.account-row.level-0 {
		background-color: var(--background-primary);
		font-weight: 600;
	}

	.account-row.level-1 {
		background-color: var(--background-secondary-alt);
		font-weight: 500;
	}

	.account-row.level-2 {
		background-color: var(--background-primary);
		font-weight: normal;
	}

	.account-row.level-3,
	.account-row.level-4,
	.account-row.level-5 {
		background-color: var(--background-primary);
		font-weight: normal;
		opacity: 0.9;
	}

	/* Category vs leaf account styling */
	.account-row.category {
		border-left: 3px solid var(--interactive-accent);
	}

	.account-row.category .account-name {
		font-weight: 600;
		color: var(--text-normal);
	}

	.account-row.category .category-amount {
		font-weight: 600;
		color: var(--interactive-accent);
	}

	.account-row.leaf {
		border-left: 1px solid var(--background-modifier-border);
	}

	.account-row.leaf .account-name {
		color: var(--text-muted);
	}

	/* Hover effects */
	.account-row:hover {
		background-color: var(--background-modifier-hover) !important;
	}

	/* Total rows styling */
	.beancount-table tbody tr:nth-child(even):not(.account-row) { 
		background-color: var(--background-secondary-alt); 
	}
	
	.beancount-table tfoot tr, 
	.total-row { 
		border-top: 2px solid var(--background-modifier-border); 
		font-weight: 600; 
		background-color: var(--background-modifier-form-field) !important;
	}
	
	.align-right { 
		text-align: right; 
		font-family: var(--font-monospace); 
	}
	
	.error-message { 
		color: var(--text-on-accent);
		background-color: var(--background-modifier-error);
		padding: var(--size-4-3);
		border-radius: var(--radius-s);
		border: 1px solid var(--text-error);
		font-weight: 500;
		line-height: 1.5;
	}

	.refresh-button { display: inline-flex; align-items: center; gap: 4px; padding: var(--size-4-1) var(--size-4-3); cursor: pointer; }
	.refresh-button:disabled { opacity: 0.6; cursor: not-allowed; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.loading-spinner { animation: spin 1s linear infinite; }

	/* Responsive design */
	@media (max-width: 1200px) {
		.balance-sheet-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.account-name {
			max-width: 100px;
		}
		
		.beancount-table td,
		.beancount-table th {
			padding: var(--size-4-1) var(--size-4-2);
			font-size: 0.9em;
		}

		.other-currencies-cell {
			font-size: 0.8em;
			max-width: 120px;
			line-height: 1.3;
			white-space: pre-wrap;
			word-break: break-word;
		}

		/* Adjust column widths for mobile */
		.account-header {
			width: 35%;
		}

		.amount-header {
			width: 30%;
		}

		.other-currencies-header {
			width: 35%;
		}

		.beancount-table {
			min-width: 350px;
		}
	}

	@media (max-width: 480px) {
		.account-header {
			width: 45%;
		}

		.amount-header {
			width: 25%;
		}

		.other-currencies-header {
			width: 30%;
		}

		.other-currencies-cell {
			font-size: 0.75em;
			max-width: 100px;
			line-height: 1.2;
			white-space: pre-wrap;
			word-break: break-word;
		}

		.beancount-table {
			min-width: 320px;
		}

		/* Allow horizontal scroll for very small screens */
		.column {
			overflow-x: auto;
		}
	}
</style>