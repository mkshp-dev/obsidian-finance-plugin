<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Notice } from 'obsidian'; // Ensure Notice is imported
	import UpcomingTab from './UpcomingTab.svelte';
	import TabBar from '../../common/TabBar.svelte';

	export let plugin: any = null;
	export let isLoading = true;
	export let assets = "0 USD";
	export let liabilities = "0 USD";
	export let netWorth = "0.00 USD";
	export let kpiError: string | null = null;
	export let fileStatus: "checking" | "ok" | "error" = "checking";
	export let fileStatusMessage: string | null = "";
	export let errorCount = 0;
	export let errorList: Array<{ filePath: string; fileName: string; lineNum: number; message: string }> = [];
	// Reconciliation props
	export let reconciliationOverdue = 0;
	export let reconciliationUpToDate = 0;
	export let reconciliationAccounts: Array<{
		account: string;
		reconcileDays: number;
		lastBalanceDate: string | null;
		daysSinceLastBalance: number | null;
		isOverdue: boolean;
		isFailing: boolean;
		failingDate: string | null;
		failingDiscrepancy: string | null;
	}> = [];
	export let activeTab: 'errors' | 'reconciliation' = 'errors';

	// Upper-region toggle (Key Metrics / Upcoming) — pure local UI state, not
	// dispatched to the view class, since UpcomingTab self-fetches its own
	// data via the `plugin` prop rather than being driven by updateView().
	let activeUpperTab: 'metrics' | 'upcoming' = 'metrics';
	let upcomingDueCount = 0;

	// Reconciliation list filter — pure display-only local state.
	let showOnlyOverdue = false;
	$: visibleReconciliationAccounts = showOnlyOverdue
		? reconciliationAccounts.filter(acct => acct.isOverdue)
		: reconciliationAccounts;

	const dispatch = createEventDispatcher();

	function handleRefresh() {
		dispatch('refresh');
	}

	function handleStatusClick() {
		if (fileStatus === 'error' && fileStatusMessage) {
			new Notice(fileStatusMessage, 0); // Show persistent notice
		}
	}

	function switchTab(tab: string) {
		dispatch('tabChange', tab as 'errors' | 'reconciliation');
	}

	function switchUpperTab(tab: string) {
		activeUpperTab = tab as 'metrics' | 'upcoming';
	}

	function handleUpcomingDueCount(e: CustomEvent<number>) {
		upcomingDueCount = e.detail;
	}

	function handleErrorClick(error: { filePath: string; lineNum: number }) {
		if (!error.filePath) return;
		dispatch('open-error', { filePath: error.filePath, lineNum: error.lineNum });
	}

	function handleReconcileClick(acct: { account: string; lastBalanceDate: string | null }, event: MouseEvent) {
		dispatch('reconcile-click', {
			account: acct.account,
			lastBalanceDate: acct.lastBalanceDate,
			ctrlKey: event.ctrlKey || event.metaKey
		});
	}

	function handleEditAccount(acct: { account: string }) {
		dispatch('edit-account', { account: acct.account });
	}

	function handleAddBalance(acct: { account: string }) {
		dispatch('add-balance', { account: acct.account });
	}

	function handleForceReconcile(acct: { account: string; failingDate: string | null; failingDiscrepancy: string | null }) {
		dispatch('force-reconcile', {
			account: acct.account,
			failingDate: acct.failingDate,
			failingDiscrepancy: acct.failingDiscrepancy
		});
	}

	/** Shorten an account name for display: "Assets:Bank:Checking" → "Bank:Checking" */
	function shortAccount(account: string): string {
		const parts = account.split(':');
		return parts.length > 1 ? parts.slice(1).join(':') : account;
	}

</script>

<div class="beancount-header">
	<h2>Snapshot</h2>

	<div class="header-controls">
		<button
			type="button" class="beancount-status-button" class:status-ok={fileStatus === 'ok'}
			class:status-error={fileStatus === 'error'}
			class:status-checking={fileStatus === 'checking'}
			on:click={handleStatusClick}
			title={fileStatus === 'error' ? 'Click to see error details' : 'File Status'}
			disabled={fileStatus === 'checking'} >
			{#if fileStatus === 'checking'}
				<span class="status-dot"></span>
				<span>Checking…</span>
			{:else if fileStatus === 'ok'}
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
				<span>OK</span>
			{:else if fileStatus === 'error'}
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				<span>{errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
			{/if}
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

<!-- Upper-region toggle: Key Metrics / Upcoming -->
<div class="upper-tab-strip">
	<TabBar
		tabs={[
			{ value: 'metrics', label: 'Key Metrics' },
			{ value: 'upcoming', label: 'Upcoming', ...(upcomingDueCount > 0 ? { count: upcomingDueCount, tone: 'warning' } : {}) },
		]}
		value={activeUpperTab}
		on:change={(e) => switchUpperTab(e.detail)}
		ariaLabel="Snapshot upper section"
	/>
</div>

<div class="upper-tab-content" class:hidden={activeUpperTab !== 'metrics'}>
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

	{#if !kpiError}
		<div class="conversion-note">
			<span>Commodities without price data are excluded from totals</span>
		</div>
	{/if}
</div>

<!-- Always mounted (not #if-destroyed) so its due-count badge above stays
     live even while Key Metrics is the visible upper tab. -->
<div class="upper-tab-content" class:hidden={activeUpperTab !== 'upcoming'}>
	<UpcomingTab {plugin} on:due-count={handleUpcomingDueCount} />
</div>

<!-- Tabbed bottom section -->
<hr class="tab-separator">
<div class="bottom-tab-strip">
	<TabBar
		tabs={[
			{ value: 'errors', label: 'Errors', ...(errorCount > 0 ? { count: errorCount, tone: 'error' } : {}) },
			{ value: 'reconciliation', label: 'Reconciliation', ...(reconciliationOverdue > 0 ? { count: reconciliationOverdue, tone: 'warning' } : {}) },
		]}
		value={activeTab}
		on:change={(e) => switchTab(e.detail)}
		ariaLabel="Snapshot bottom section"
	/>
</div>

<!-- Tab content -->
{#if activeTab === 'errors'}
	{#if fileStatus === 'error' && errorList.length > 0}
		<div class="error-section">
			<div class="error-list">
				{#each errorList as error}
					{#if error.filePath}
						<button
							type="button"
							class="error-item error-item-clickable"
							on:click={() => handleErrorClick(error)}
							title="Click to open {error.fileName}:{error.lineNum}"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"/>
								<path d="m15 9-6 6"/>
								<path d="m9 9 6 6"/>
							</svg>
							<span class="error-text">{error.fileName}:{error.lineNum}: {error.message}</span>
						</button>
					{:else}
						<div class="error-item">
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"/>
								<path d="m15 9-6 6"/>
								<path d="m9 9 6 6"/>
							</svg>
							<span class="error-text">{error.message}</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{:else}
		<div class="tab-empty-state">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
				<polyline points="22 4 12 14.01 9 11.01"/>
			</svg>
			<span>No errors</span>
		</div>
	{/if}
{:else if activeTab === 'reconciliation'}
	{#if reconciliationAccounts.length === 0}
		<div class="tab-empty-state">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="16" x2="12" y2="12"/>
				<line x1="12" y1="8" x2="12.01" y2="8"/>
			</svg>
			<span>No accounts configured for reconciliation.<br>Add <code>reconcile: 30</code> metadata to an open directive.</span>
		</div>
	{:else}
		<div class="reconciliation-section">
			<!-- Summary row -->
			<div class="reconciliation-summary">
				<span class="reconciliation-summary-text">
					<span class="recon-summary-count" class:recon-summary-warning={reconciliationOverdue > 0}>{reconciliationOverdue} overdue</span>
					<span class="recon-sep">·</span>
					<span class="recon-summary-count">{reconciliationUpToDate} up to date</span>
				</span>
				<label class="recon-toggle">
					<input type="checkbox" bind:checked={showOnlyOverdue} />
					<span class="recon-toggle-track"><span class="recon-toggle-thumb"></span></span>
					<span class="recon-toggle-label">Only overdue</span>
				</label>
			</div>

			<!-- Per-account list -->
			{#if visibleReconciliationAccounts.length === 0}
				<div class="tab-empty-state">
					<span>No overdue accounts.</span>
				</div>
			{:else}
			<div class="reconciliation-list">
				{#each visibleReconciliationAccounts as acct}
					<div class="reconciliation-item" class:recon-overdue={acct.isOverdue}>
						<div class="recon-info">
							<button
								type="button"
								class="recon-account-row recon-account-row-clickable"
								on:click={(e) => handleReconcileClick(acct, e)}
								title="Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal — filtered from {acct.lastBalanceDate ?? 'the beginning'}"
							>
								<span class="recon-indicator" class:indicator-overdue={acct.isOverdue} class:indicator-ok={!acct.isOverdue}></span>
								<span class="recon-account-name" title={acct.account}>{shortAccount(acct.account)}</span>
							</button>
							<div class="recon-detail-row">
								{#if acct.isFailing}
									<span class="recon-detail recon-failing"
										>Failing{#if acct.failingDiscrepancy} — off by {acct.failingDiscrepancy}{/if}</span
									>
								{:else if acct.lastBalanceDate}
									<span class="recon-detail">
										{acct.daysSinceLastBalance}d ago
										<span class="recon-sep">·</span>
										every {acct.reconcileDays}d
									</span>
								{:else}
									<span class="recon-detail recon-never">Never reconciled</span>
								{/if}
							</div>
						</div>
						<div class="recon-actions">
							<button type="button" class="recon-action-btn recon-action-edit" on:click={() => handleEditAccount(acct)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
								Edit
							</button>
							<button type="button" class="recon-action-btn recon-action-balance" on:click={() => handleAddBalance(acct)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
								Balance
							</button>
							<button
								type="button"
								class="recon-action-btn recon-action-force"
								disabled={!acct.isFailing}
								title={acct.isFailing ? '' : 'No failing balance assertion to fix'}
								on:click={() => handleForceReconcile(acct)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
								Force reconcile
							</button>
						</div>
					</div>
				{/each}
			</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	/* --- Header --- */
	.beancount-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--size-4-3);
		padding-bottom: var(--size-4-3);
		margin-bottom: var(--size-4-1);
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.beancount-header h2 {
		margin: 0;
		font-size: var(--font-ui-larger);
		letter-spacing: -0.01em;
	}
	.header-controls {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	/* Status pill */
	.beancount-status-button {
		font-size: var(--font-ui-small);
		padding: var(--size-4-1) var(--size-4-2);
		line-height: var(--line-height-normal);
		background-color: var(--background-modifier-hover);
		border: 1px solid transparent;
		border-radius: var(--radius-s);
		color: var(--text-muted);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		cursor: default;
		transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
	}
	.beancount-status-button.status-error { cursor: pointer; }
	.beancount-status-button.status-error:hover {
		background-color: rgba(var(--color-red-rgb, 224, 82, 82), 0.16);
		transform: translateY(-1px);
	}
	.beancount-status-button span,
	.beancount-status-button svg { font-weight: 500; }
	.beancount-status-button.status-ok {
		background-color: rgba(var(--color-green-rgb, 76, 175, 116), 0.14);
		color: var(--color-green, #4caf74);
	}
	.beancount-status-button.status-error {
		background-color: rgba(var(--color-red-rgb, 224, 82, 82), 0.12);
		color: var(--color-red, #e05252);
	}
	.beancount-status-button.status-checking { color: var(--text-faint); }

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--text-faint);
		animation: pulse 1.4s ease-in-out infinite;
	}

	/* Refresh button */
	.refresh-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: var(--size-4-1) var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background-color: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
	}
	.refresh-button:hover:not(:disabled) {
		background-color: var(--interactive-hover);
		border-color: var(--interactive-accent);
	}
	.refresh-button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.loading-spinner {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.35; }
	}

	/* --- KPI Styles --- */
	.beancount-kpi-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-2);
		margin-bottom: var(--size-4-3);
	}
	.kpi-metric {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: var(--size-4-3);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
		transition: box-shadow 0.15s ease, border-color 0.15s ease;
	}
	.kpi-metric:hover {
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
		border-color: var(--background-modifier-border-hover, var(--background-modifier-border));
	}
	.kpi-label {
		font-size: var(--font-ui-smaller);
		font-weight: 500;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.kpi-value {
		font-size: 1.2em;
		font-weight: 650;
		color: var(--text-normal);
		letter-spacing: -0.01em;
	}
	.kpi-metric:first-child {
		grid-column: 1 / -1;
		background: linear-gradient(135deg, rgba(var(--interactive-accent-rgb, 122, 106, 224), 0.1), var(--background-secondary));
		border-color: rgba(var(--interactive-accent-rgb, 122, 106, 224), 0.25);
	}
	.net-worth {
		font-size: 1.65em;
		font-weight: 700;
		color: var(--text-accent);
	}

	/* --- Error Message Styles --- */
	.beancount-error-message {
		color: var(--text-error);
		font-size: var(--font-ui-small);
		padding: var(--size-4-3);
		background-color: var(--background-secondary-alt);
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
		grid-column: 1 / -1;
		word-break: break-all;
		white-space: pre-wrap;
	}

	/* --- Conversion Note Styles --- */
	.conversion-note {
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
		margin-top: var(--size-4-1);
		text-align: center;
	}

	/* --- Tab Strip Styles --- */
	.tab-separator {
		border: none;
		border-top: 1px solid var(--background-modifier-border);
		margin: var(--size-4-4) 0 0 0;
	}

	.upper-tab-strip {
		margin-bottom: var(--size-4-3);
	}

	.bottom-tab-strip {
		margin: var(--size-4-3) 0 var(--size-4-2) 0;
	}

	.upper-tab-content.hidden {
		display: none;
	}

	/* --- Tab Empty State --- */
	.tab-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-4-6) var(--size-4-3);
		color: var(--text-faint);
		font-size: var(--font-ui-small);
		text-align: center;
		line-height: 1.5;
	}

	.tab-empty-state code {
		font-size: 0.9em;
		background-color: var(--background-secondary);
		padding: 1px 5px;
		border-radius: var(--radius-s);
	}

	/* --- Error Section Styles --- */
	.error-section {
		margin-top: 0;
	}

	.error-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.error-item {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		padding: var(--size-4-2);
		background-color: var(--background-secondary);
		border-radius: var(--radius-s);
		border-left: 3px solid var(--text-error);
		transition: box-shadow 0.15s ease;
	}

	.error-item-clickable {
		width: 100%;
		height: auto;
		min-height: 0;
		border-top: none;
		border-right: none;
		border-bottom: none;
		box-shadow: none;
		text-align: left;
		font: inherit;
		line-height: 1.4;
		white-space: normal;
		overflow: visible;
		cursor: pointer;
	}

	.error-item-clickable:hover {
		background-color: var(--background-modifier-hover);
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
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

	/* --- Reconciliation Section Styles --- */
	.reconciliation-section {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.reconciliation-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--size-4-2);
		flex-wrap: wrap;
	}

	.reconciliation-summary-text {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.recon-summary-count {
		font-weight: 600;
		color: var(--text-normal);
	}

	.recon-summary-warning {
		color: var(--color-orange);
	}

	/* --- "Only overdue" toggle --- */
	.recon-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		user-select: none;
	}

	.recon-toggle input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.recon-toggle-track {
		position: relative;
		width: 28px;
		height: 16px;
		background-color: var(--background-modifier-border);
		border-radius: 999px;
		flex-shrink: 0;
		transition: background-color 0.15s ease;
	}

	.recon-toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		background-color: var(--background-primary);
		border-radius: 50%;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		transition: transform 0.15s ease;
	}

	.recon-toggle input:checked + .recon-toggle-track {
		background-color: var(--interactive-accent);
	}

	.recon-toggle input:checked + .recon-toggle-track .recon-toggle-thumb {
		transform: translateX(12px);
	}

	.recon-toggle-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.reconciliation-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.reconciliation-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--size-4-2) var(--size-4-3);
		padding: var(--size-4-3);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		border-left: 3px solid var(--color-green);
		transition: box-shadow 0.15s ease;
	}

	.reconciliation-item:hover {
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
	}

	.reconciliation-item.recon-overdue {
		border-left-color: var(--color-orange);
	}

	.recon-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1 1 auto;
	}

	.recon-account-row {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
	}

	.recon-account-row-clickable {
		display: flex;
		width: 100%;
		padding: 2px 4px;
		margin: 0 0 0 -4px;
		background: none;
		border: none;
		box-shadow: none;
		text-align: left;
		font: inherit;
		line-height: normal;
		white-space: normal;
		overflow: visible;
		cursor: pointer;
		border-radius: var(--radius-s);
		transition: background-color 0.15s ease;
	}

	.recon-account-row-clickable:hover {
		background-color: var(--background-modifier-hover);
	}

	.recon-indicator {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.recon-indicator.indicator-ok {
		background-color: var(--color-green);
	}

	.recon-indicator.indicator-overdue {
		background-color: var(--color-orange);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-orange) 20%, transparent);
	}

	.recon-account-name {
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-normal);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.recon-detail-row {
		margin-left: 13px; /* align with text after indicator dot */
	}

	.recon-detail {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.recon-sep {
		margin: 0 4px;
		color: var(--text-faint);
	}

	.recon-never {
		color: var(--color-orange);
		font-style: italic;
	}

	.recon-failing {
		color: var(--color-red);
		font-weight: 500;
	}

	.recon-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.recon-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--font-ui-smaller);
		font-weight: 500;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.recon-action-btn svg {
		flex-shrink: 0;
	}

	.recon-action-btn:hover:not(:disabled) {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.recon-action-balance {
		color: var(--interactive-accent);
		border-color: color-mix(in srgb, var(--interactive-accent) 35%, transparent);
		background-color: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-primary));
	}

	.recon-action-balance:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--interactive-accent) 18%, var(--background-primary));
		color: var(--interactive-accent);
	}

	.recon-action-force:not(:disabled) {
		color: var(--color-orange);
		border-color: color-mix(in srgb, var(--color-orange) 35%, transparent);
		background-color: color-mix(in srgb, var(--color-orange) 10%, var(--background-primary));
	}

	.recon-action-force:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--color-orange) 18%, var(--background-primary));
		color: var(--color-orange);
	}

	.recon-action-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>