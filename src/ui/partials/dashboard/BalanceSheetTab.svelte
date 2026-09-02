<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	// --- REMOVED onMount, parseCsv, queries, plugin imports ---
	import { writable, type Writable } from 'svelte/store';
	import { Menu } from 'obsidian';
	import type { BalanceSheetController, BalanceSheetState, AccountItem } from '../../../controllers/BalanceSheetController';
	import { Logger } from '../../../utils/logger';
	import { AccountManagementModal } from '../../modals/AccountManagementModal';
	import { AccountDetailModal } from '../../modals/AccountDetailModal';
	import { BeancountView, BEANCOUNT_VIEW_TYPE } from '../../views/sidebar/sidebar-view';
	import { resolveNavTab, type NavRequest } from '../../../types/navigation';
	import SunburstChart from '../../common/SunburstChart.svelte';
	import ChartComponent from '../../common/ChartComponent.svelte';
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';
	import CustomSelect from '../../common/CustomSelect.svelte';

	const dispatch = createEventDispatcher();

	// Chart selector: which chart is shown in the chart area
	let selectedChart: 'trend' | 'balances' = 'trend';
	// Sub-selector for Balances view
	let selectedBalanceSection: 'assets' | 'liabilities' | 'equity' = 'assets';

	// --- Receive the controller ---
	export let controller: BalanceSheetController;
	export let navigate: ((req: NavRequest) => void) | null = null;

	function handleAccountRowClick(item: AccountItem, event: MouseEvent) {
		if (item.isCategory) {
			if (event && (event.ctrlKey || event.metaKey)) {
				// Ctrl/Cmd+click on a category header is the existing escape hatch
				// straight to Transactions — deliberately not repurposed for Journal.
				handleAccountNavigate(item.account);
			} else {
				toggleCollapse(item.account, event);
			}
		} else {
			handleAccountNavigate(item.account, event);
		}
	}

	function handleAccountNavigate(account: string, event?: { ctrlKey?: boolean; metaKey?: boolean }) {
		if (!account) return;
		const req: NavRequest = { tab: resolveNavTab(event), filters: { account } };
		if (navigate) {
			navigate(req);
		} else {
			dispatch('navigate', req);
		}
	}

	function handleSegmentClick(e: CustomEvent<{ account: string }>) {
		// Sunburst only ever emits this on Ctrl/Cmd+click (plain click drills in
		// instead) — always send it to Transactions, per the sunburst's own contract.
		const account = e.detail?.account;
		if (account) {
			handleAccountNavigate(account);
		}
	}

	// --- Set up a placeholder and subscribe to the store ---
	const placeholderState: Writable<BalanceSheetState> = writable({
		isLoading: true, error: null, assets: [], liabilities: [], equity: [],
		totalAssets: 0, totalLiabilities: 0, totalEquity: 0, currency: 'INR',
		hasUnconvertedCommodities: false, unconvertedWarning: null, valuationMethod: 'convert',
		chartConfig: null, chartError: null, chartLoading: false, chartInterval: 'month'
	});
	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;
	$: currencyDecimals = controller ? controller.plugin.currencyPrecisionService.getDecimals(state.currency) : 2;
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
	async function handleValuationMethodChange(method: string) {
		if (controller) {
			await controller.setValuationMethod(method as 'convert' | 'cost' | 'units');
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

	// Opening/closing an account here only refreshes this tab's own controller.
	// The Snapshot sidebar view (reconciliation panel) caches its own account
	// list independently and has no listener for changes made elsewhere, so it
	// must be refreshed explicitly or it keeps showing stale (e.g. just-closed)
	// accounts until the user manually hits its own refresh button (issue #271).
	async function refreshSnapshotView() {
		const leaves = controller.plugin.app.workspace.getLeavesOfType(BEANCOUNT_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof BeancountView) {
				await leaf.view.updateView();
			}
		}
	}

	function handleOpenAccount() {
		const plugin = controller.plugin;
		const modal = new AccountManagementModal(
			plugin.app,
			plugin,
			'open',
			async () => {
				// Refresh callback
				await controller.loadData();
				await refreshSnapshotView();
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
				await refreshSnapshotView();
			}
		);
		modal.open();
	}

	// Right-click on a leaf account row -> "Account details" (view/edit reconcile
	// interval, Balance/Force reconcile quick actions). Categories have no
	// open/close/reconcile state of their own, so the menu is leaf-only.
	function handleAccountContextMenu(item: AccountItem, event: MouseEvent) {
		if (item.isCategory) return;
		event.preventDefault();
		const menu = new Menu();
		menu.addItem((menuItem) =>
			menuItem
				.setTitle('Account details')
				.setIcon('info')
				.onClick(() => openAccountDetail(item.account))
		);
		menu.showAtMouseEvent(event);
	}

	function openAccountDetail(account: string) {
		const plugin = controller.plugin;
		const modal = new AccountDetailModal(plugin.app, plugin, account, async () => {
			await controller.loadData();
			await refreshSnapshotView();
		});
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
			<button class="btn btn-primary" on:click={handleRefresh} disabled={state.isLoading}>Refresh</button>
		</div>
	</div>

	{#if state.isLoading}
		<SkeletonLoader type="list" rows={8} />
	{:else if state.error}
		<ErrorBanner message={state.error} on:retry={handleRefresh} />
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
				<div class="pill-dropdown-group">
					<CustomSelect
						variant="primary"
						position="left"
						options={[
							{ value: 'trend', label: 'Net Worth Trend', icon: 'line-chart' },
							{ value: 'balances', label: 'Balances', icon: 'pie-chart' }
						]}
						bind:value={selectedChart}
						on:change={(e) => selectedChart = e.detail}
						ariaLabel="Select chart view"
					/>

					{#if selectedChart === 'trend'}
						<CustomSelect
							variant="secondary"
							position="right"
							options={[
								{ value: 'month', label: 'Monthly', icon: 'calendar' },
								{ value: 'week', label: 'Weekly', icon: 'clock' }
							]}
							value={state.chartInterval}
							on:change={(e) => handleIntervalChange(e.detail === 'week' ? 'week' : 'month')}
							disabled={state.chartLoading}
							ariaLabel="Select chart interval"
						/>
					{:else if selectedChart === 'balances'}
						<CustomSelect
							variant="secondary"
							position="right"
							options={[
								{ value: 'assets', label: 'Assets', icon: 'briefcase' },
								{ value: 'liabilities', label: 'Liabilities', icon: 'credit-card' },
								{ value: 'equity', label: 'Equity', icon: 'scale' }
							]}
							bind:value={selectedBalanceSection}
							on:change={(e) => selectedBalanceSection = e.detail}
							ariaLabel="Select balance section"
						/>
					{/if}
				</div>
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
						decimals={currencyDecimals}
						totalAssets={state.totalAssets}
						totalLiabilities={0}
						totalEquity={0}
						on:segment-click={handleSegmentClick}
					/>
				{:else if selectedBalanceSection === 'liabilities'}
					<SunburstChart
						title="Liabilities"
						assets={[]}
						liabilities={state.liabilities}
						equity={[]}
						currency={state.currency}
						decimals={currencyDecimals}
						totalAssets={0}
						totalLiabilities={state.totalLiabilities}
						totalEquity={0}
						on:segment-click={handleSegmentClick}
					/>
				{:else}
					<SunburstChart
						title="Equity"
						assets={[]}
						liabilities={[]}
						equity={state.equity}
						currency={state.currency}
						decimals={currencyDecimals}
						totalAssets={0}
						totalLiabilities={0}
						totalEquity={state.totalEquity}
						on:segment-click={handleSegmentClick}
					/>
				{/if}
			{/if}
		</div>

		<!-- Balance Sheet (always visible) -->
		<div class="balance-sheet-section">
			<div class="balance-sheet-section-header">
				<h3>Balance Sheet</h3>
				<div class="valuation-method-selector">
					<span class="valuation-method-label">Valuation:</span>
					<CustomSelect
						variant="secondary"
						position="single"
						options={[
							{ value: 'convert', label: `Market Value (Convert to ${state.currency})` },
							{ value: 'cost', label: 'At Cost' },
							{ value: 'units', label: 'Units' },
						]}
						value={state.valuationMethod || 'convert'}
						on:change={(e) => handleValuationMethodChange(e.detail)}
						ariaLabel="Valuation method"
					/>
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
								on:click={(e) => handleAccountRowClick(item, e)}
								on:contextmenu={(e) => handleAccountContextMenu(item, e)}
								title={!item.isCategory ? 'Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal · Right-click: account details' : undefined}>
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory} on:click={(e) => !item.isCategory && handleAccountNavigate(item.account, e)}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell" on:click={(e) => !item.isCategory && handleAccountNavigate(item.account, e)}>
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
								on:click={(e) => handleAccountRowClick(item, e)}
								on:contextmenu={(e) => handleAccountContextMenu(item, e)}
								title={!item.isCategory ? 'Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal · Right-click: account details' : undefined}>
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory} on:click={(e) => !item.isCategory && handleAccountNavigate(item.account, e)}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell" on:click={(e) => !item.isCategory && handleAccountNavigate(item.account, e)}>
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
								on:click={(e) => handleAccountRowClick(item, e)}
								on:contextmenu={(e) => handleAccountContextMenu(item, e)}
								title={!item.isCategory ? 'Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal · Right-click: account details' : undefined}>
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory} on:click={(e) => !item.isCategory && handleAccountNavigate(item.account, e)}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell" on:click={(e) => !item.isCategory && handleAccountNavigate(item.account, e)}>
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
		padding: 0; 
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
		position: relative;
	}

	.chart-area-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-4);
		flex-wrap: wrap;
		gap: var(--size-4-2);
		position: relative;
		z-index: 20;
	}

	.pill-dropdown-group {
		display: inline-flex;
		align-items: center;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05));
	}

	.chart-select-dropdown {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: var(--size-4-1) var(--size-4-3);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		font-weight: 500;
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.chart-select-dropdown:hover:not(:disabled) {
		border-color: var(--interactive-accent);
		background-color: var(--interactive-hover);
	}

	.chart-select-dropdown:focus {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.chart-select-dropdown:disabled {
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

	.valuation-method-label {
		font-size: 0.9em;
		color: var(--text-muted);
		white-space: nowrap;
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
		font-size: var(--font-ui-small);
	}

	/* Table headers */
	.beancount-table thead {
		background-color: var(--background-modifier-form-field);
		border-bottom: 2px solid var(--background-modifier-border);
	}

	.header-row th {
		padding: var(--size-4-1) var(--size-4-2);
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
		padding: var(--size-4-1) var(--size-4-2); 
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
		cursor: pointer;
	}

	:global(.account-row.category) .account-name {
		cursor: pointer;
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
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.account-row.leaf .account-name {
		color: var(--text-muted);
		cursor: pointer;
	}

	.account-row.leaf:hover .account-name {
		color: var(--text-accent);
		text-decoration: underline;
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

	.btn {
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background: var(--interactive-normal);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn:hover {
		background: var(--interactive-hover);
	}
	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}
	.btn-primary:hover {
		background: var(--interactive-accent-hover);
	}

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