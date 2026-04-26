<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import type { IncomeStatementController, IncomeStatementState } from '../../../controllers/IncomeStatementController';
	import type { AccountItem } from '../../../controllers/BalanceSheetController';
	import { Logger } from '../../../utils/logger';
	import SunburstChart from '../../common/SunburstChart.svelte';
	import ChartComponent from '../../common/ChartComponent.svelte';

	// Chart selector
	let selectedChart: 'trend' | 'total' = 'trend';
	// Sub-selector for sunburst section
	let selectedTotalSection: 'income' | 'expenses' = 'income';

	// --- Receive the controller ---
	export let controller: IncomeStatementController;

	// --- Placeholder state & store subscription ---
	const placeholderState: Writable<IncomeStatementState> = writable({
		isLoading: true, error: null, income: [], expenses: [],
		totalIncome: 0, totalExpenses: 0, netProfit: 0, currency: 'USD',
		hasUnconvertedCommodities: false, unconvertedWarning: null, valuationMethod: 'convert',
		chartConfig: null, chartError: null, chartLoading: false, chartInterval: 'month',
	});
	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;

	// Indentation helper
	function getIndentation(level: number): string {
		return '\u00A0'.repeat(level * 4);
	}

	function getAccountClass(item: AccountItem): string {
		return `account-row level-${item.level} ${item.isCategory ? 'category' : 'leaf'}`;
	}

	function hasOtherCurrencies(accounts: AccountItem[]): boolean {
		return accounts.some(item => item.otherCurrencies && item.otherCurrencies.trim() !== '');
	}

	$: showOtherCurrenciesColumn = state.income && state.expenses &&
		(hasOtherCurrencies(state.income) || hasOtherCurrencies(state.expenses));

	// Valuation method change
	async function handleValuationMethodChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const method = target.value as 'convert' | 'cost' | 'units';
		if (controller) {
			await controller.setValuationMethod(method);
		}
	}

	// Collapsible hierarchy
	let collapsedAccounts = new Set<string>();

	function toggleCollapse(account: string, event?: MouseEvent) {
		if (event) event.stopPropagation();
		const newSet = new Set(collapsedAccounts);
		if (newSet.has(account)) {
			newSet.delete(account);
		} else {
			newSet.add(account);
		}
		collapsedAccounts = newSet;
	}

	function isCollapsed(account: string): boolean {
		return collapsedAccounts.has(account);
	}

	function shouldShowRow(item: AccountItem, collapsed: Set<string>): boolean {
		if (item.level === 0) return true;
		const parts = item.account.split(':');
		for (let i = 1; i < parts.length; i++) {
			const parentPath = parts.slice(0, i).join(':');
			if (collapsed.has(parentPath)) return false;
		}
		return true;
	}

	$: visibleIncome = state.income ? state.income.filter(item => shouldShowRow(item, collapsedAccounts)) : [];
	$: visibleExpenses = state.expenses ? state.expenses.filter(item => shouldShowRow(item, collapsedAccounts)) : [];

	function handleRefresh() {
		if (controller) controller.loadData();
	}

	function handleIntervalChange(interval: 'month' | 'week') {
		if (controller && state.chartInterval !== interval) {
			controller.setChartInterval(interval);
		}
	}

	// Net profit sign helper
	function netProfitClass(val: number): string {
		return val >= 0 ? 'positive' : 'negative';
	}
</script>

<div class="income-statement-container">
	<!-- Header -->
	<div class="income-statement-header">
		<h2>Income Statement</h2>
		<div class="header-controls">
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
							<rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/>
						</svg>
						Net Profit Trend
					</button>
					<button
						class="chart-selector-btn"
						class:active={selectedChart === 'total'}
						on:click={() => (selectedChart = 'total')}
						aria-pressed={selectedChart === 'total'}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="3"/>
							<circle cx="12" cy="12" r="7"/>
							<circle cx="12" cy="12" r="11"/>
						</svg>
						Total
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
				{:else if selectedChart === 'total'}
					<div class="section-toggle">
						<button
							class:active={selectedTotalSection === 'income'}
							on:click={() => (selectedTotalSection = 'income')}
						>Income</button>
						<button
							class:active={selectedTotalSection === 'expenses'}
							on:click={() => (selectedTotalSection = 'expenses')}
						>Expenses</button>
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
			{:else if selectedChart === 'total'}
				{#if selectedTotalSection === 'income'}
					<!-- Income: expect negative (credit accounts). Pass as assets→green, with assetsExpectNegative -->
					<SunburstChart
						title="Income"
						assets={state.income}
						liabilities={[]}
						equity={[]}
						currency={state.currency}
						totalAssets={state.totalIncome}
						totalLiabilities={0}
						totalEquity={0}
						assetsLabel="Income"
						assetsExpectNegative={true}
					/>
				{:else}
					<!-- Expenses: expect positive (debit accounts). Pass as liabilities→red, with liabilitiesExpectNegative=false -->
					<SunburstChart
						title="Expenses"
						assets={[]}
						liabilities={state.expenses}
						equity={[]}
						currency={state.currency}
						totalAssets={0}
						totalLiabilities={state.totalExpenses}
						totalEquity={0}
						liabilitiesLabel="Expenses"
						liabilitiesExpectNegative={false}
					/>
				{/if}
			{/if}
		</div>

		<!-- Income Statement Table -->
		<div class="income-statement-section">
			<div class="income-statement-section-header">
				<h3>Income Statement</h3>
				<div class="valuation-method-selector">
					<label for="is-valuation-method">Valuation:</label>
					<select
						id="is-valuation-method"
						value={state.valuationMethod || 'convert'}
						on:change={handleValuationMethodChange}
					>
						<option value="convert">Market Value (Convert to {state.currency})</option>
						<option value="cost">At Cost</option>
						<option value="units">Units</option>
					</select>
				</div>
			</div>

			<div class="income-statement-grid">
				<!-- Income Column -->
				<div class="column">
					<h4>Income</h4>
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
							{#each visibleIncome as item}
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
					<div class="section-total">
						<span>Total Income</span>
						<span class="total-amount">{state.totalIncome.toFixed(2)} {state.currency}</span>
					</div>
				</div>

				<!-- Expenses Column -->
				<div class="column">
					<h4>Expenses</h4>
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
							{#each visibleExpenses as item}
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
					<div class="section-total">
						<span>Total Expenses</span>
						<span class="total-amount">{state.totalExpenses.toFixed(2)} {state.currency}</span>
					</div>
				</div>
			</div>

			<!-- Net Profit Summary -->
			<div class="net-profit-row">
				<span class="net-profit-label">Net Profit</span>
				<span class="net-profit-value {netProfitClass(state.netProfit)}">
					{state.netProfit.toFixed(2)} {state.currency}
				</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.income-statement-container {
		padding: var(--size-4-4);
		width: 100%;
		overflow-x: auto;
	}

	.income-statement-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-6);
		flex-wrap: wrap;
		gap: var(--size-4-4);
	}

	.income-statement-header h2 {
		margin: 0;
		flex: 1;
	}

	.header-controls {
		display: flex;
		gap: var(--size-4-4);
		align-items: center;
	}

	/* Refresh button */
	.refresh-button {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
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

	.refresh-button:hover:not(:disabled) {
		background: var(--interactive-hover);
		border-color: var(--interactive-accent);
	}

	.refresh-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.loading-spinner {
		animation: spin 1s linear infinite;
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
	.section-toggle {
		display: flex;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;
	}

	.interval-toggle button,
	.section-toggle button {
		padding: var(--size-4-1) var(--size-4-3);
		background: var(--interactive-normal);
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: background-color 0.15s, color 0.15s;
	}

	.interval-toggle button:not(:last-child),
	.section-toggle button:not(:last-child) {
		border-right: 1px solid var(--background-modifier-border);
	}

	.interval-toggle button.active,
	.section-toggle button.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.interval-toggle button:hover:not(.active):not(:disabled),
	.section-toggle button:hover:not(.active) {
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

	/* Income Statement section */
	.income-statement-section {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
	}

	.income-statement-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-4);
		flex-wrap: wrap;
		gap: var(--size-4-2);
	}

	.income-statement-section-header h3 {
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

	.income-statement-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-8);
		align-items: start;
		overflow-x: auto;
	}

	@media (max-width: 1200px) {
		.income-statement-grid {
			grid-template-columns: 1fr;
			gap: var(--size-4-6);
		}

		.income-statement-header {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--size-4-3);
		}
	}

	.column {
		min-width: 0;
		overflow-x: auto;
	}

	.column h4 {
		margin-top: 0;
		color: var(--text-normal);
		border-bottom: 1px solid var(--background-modifier-border);
		padding-bottom: var(--size-4-2);
	}

	/* Warning banner */
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

	/* Table */
	.beancount-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		min-width: 300px;
	}

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
		width: 50%;
		min-width: 140px;
	}

	.amount-header {
		width: 25%;
		text-align: right !important;
		min-width: 100px;
	}

	.other-currencies-header {
		width: 25%;
		text-align: right !important;
		min-width: 120px;
		color: var(--text-muted);
	}

	.beancount-table td,
	.beancount-table th {
		padding: var(--size-4-2) var(--size-4-3);
		border-bottom: 1px solid var(--background-secondary);
		vertical-align: top;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.account-name {
		font-family: var(--font-interface);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 180px;
		width: 50%;
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

	.category-amount {
		font-weight: 600;
	}

	.align-right {
		text-align: right;
	}

	.other-currencies-cell {
		font-family: var(--font-monospace);
		font-size: 0.8em;
		white-space: pre-line;
		color: var(--text-muted);
		text-align: right;
	}

	/* Account row styles */
	:global(.account-row) {
		transition: background-color 0.1s ease;
	}

	:global(.account-row:hover) {
		background-color: var(--background-modifier-hover);
	}

	:global(.account-row.category) {
		background-color: var(--background-secondary);
	}

	:global(.account-row.level-0) {
		font-weight: 700;
		font-size: 1.05em;
	}

	:global(.account-row.level-1) {
		font-weight: 500;
	}

	/* Section totals */
	.section-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--size-4-2) var(--size-4-3);
		margin-top: var(--size-4-2);
		border-top: 2px solid var(--background-modifier-border);
		font-weight: 600;
		background: var(--background-secondary);
		border-radius: 0 0 var(--radius-s) var(--radius-s);
	}

	.total-amount {
		font-family: var(--font-monospace);
	}

	.total-amount.positive {
		color: var(--color-green);
	}

	/* Net profit row */
	.net-profit-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--size-4-3) var(--size-4-4);
		margin-top: var(--size-4-4);
		border: 2px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-secondary);
		font-weight: 700;
		font-size: 1.05em;
	}

	.net-profit-label {
		color: var(--text-normal);
	}

	.net-profit-value {
		font-family: var(--font-monospace);
		font-size: 1.1em;
	}

	.net-profit-value.positive {
		color: var(--color-green);
	}

	.net-profit-value.negative {
		color: var(--color-red);
	}

	.error-message {
		color: var(--color-red);
		padding: var(--size-4-3);
		border: 1px solid var(--color-red);
		border-radius: var(--radius-s);
		background: var(--background-modifier-error);
	}

	.chart-loading {
		color: var(--text-muted);
		text-align: center;
		padding: var(--size-4-8);
	}
</style>
