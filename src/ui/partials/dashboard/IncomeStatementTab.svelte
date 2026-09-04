<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import type { IncomeStatementController, IncomeStatementState } from '../../../controllers/IncomeStatementController';
	import type { AccountItem } from '../../../controllers/BalanceSheetController';
	import { Logger } from '../../../utils/logger';
	import { parsePeriodLabel } from '../../../utils/index';
	import { resolveNavTab, type NavRequest } from '../../../types/navigation';
	import SunburstChart from '../../common/SunburstChart.svelte';
	import ChartComponent from '../../common/ChartComponent.svelte';
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';
	import CustomSelect from '../../common/CustomSelect.svelte';

	const dispatch = createEventDispatcher();

	// Chart selector
	let selectedChart: 'trend' | 'total' = 'trend';
	// Sub-selector for sunburst section
	let selectedTotalSection: 'income' | 'expenses' = 'income';

	// --- Receive the controller ---
	export let controller: IncomeStatementController;
	export let navigate: ((req: NavRequest) => void) | null = null;

	// --- Placeholder state & store subscription ---
	const placeholderState: Writable<IncomeStatementState> = writable({
		isLoading: true, error: null, income: [], expenses: [],
		totalIncome: 0, totalExpenses: 0, netProfit: 0, currency: 'USD',
		hasUnconvertedCommodities: false, unconvertedWarning: null, valuationMethod: 'convert',
		chartConfig: null, chartError: null, chartLoading: false, chartInterval: 'month',
		chartTrendType: 'netprofit',
	});
	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;
	$: currencyDecimals = controller ? controller.plugin.currencyPrecisionService.getDecimals(state.currency) : 2;

	$: if (controller) {
		controller.onChartClick = (periodKey: string, interval: 'month' | 'week', ctrlKey?: boolean) => {
			const { startDate, endDate } = parsePeriodLabel(periodKey, interval);
			if (startDate && endDate) {
				const req: NavRequest = { tab: resolveNavTab({ ctrlKey }), filters: { startDate, endDate } };
				if (navigate) {
					navigate(req);
				} else {
					dispatch('navigate', req);
				}
			}
		};
	}

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
	async function handleValuationMethodChange(method: string) {
		if (controller) {
			await controller.setValuationMethod(method as 'convert' | 'cost' | 'units');
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

	function handleTrendTypeChange(trendType: 'netprofit' | 'income' | 'expense') {
		if (controller && state.chartTrendType !== trendType) {
			controller.setChartTrendType(trendType);
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
							{ value: 'trend', label: 'Trends', icon: 'line-chart' },
							{ value: 'total', label: 'Totals Breakdown', icon: 'pie-chart' }
						]}
						bind:value={selectedChart}
						on:change={(e) => selectedChart = e.detail}
						ariaLabel="Select chart view"
					/>

					{#if selectedChart === 'trend'}
						<CustomSelect
							variant="secondary"
							position="middle"
							options={[
								{ value: 'netprofit', label: 'Net Profit', icon: 'dollar-sign' },
								{ value: 'income', label: 'Income', icon: 'plus-circle' },
								{ value: 'expense', label: 'Expense', icon: 'minus-circle' }
							]}
							value={state.chartTrendType}
							on:change={(e) => handleTrendTypeChange(e.detail)}
							disabled={state.chartLoading}
							ariaLabel="Select trend type"
						/>

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
					{:else if selectedChart === 'total'}
						<CustomSelect
							variant="secondary"
							position="right"
							options={[
								{ value: 'income', label: 'Income', icon: 'plus-circle' },
								{ value: 'expenses', label: 'Expenses', icon: 'minus-circle' }
							]}
							bind:value={selectedTotalSection}
							on:change={(e) => selectedTotalSection = e.detail}
							ariaLabel="Select totals section"
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
			{:else if selectedChart === 'total'}
				{#if selectedTotalSection === 'income'}
					<!-- Income: expect positive (credit accounts). Pass as assets→green, with assetsExpectNegative -->
					<SunburstChart
						title="Income"
						assets={state.income}
						liabilities={[]}
						equity={[]}
						currency={state.currency}
						decimals={currencyDecimals}
						totalAssets={state.totalIncome}
						totalLiabilities={0}
						totalEquity={0}
						assetsLabel="Income"
						assetsExpectNegative={false}
						on:segment-click={handleSegmentClick}
					/>
				{:else}
					<!-- Expenses: expect positive (debit accounts). Pass as liabilities→red, with liabilitiesExpectNegative=false -->
					<SunburstChart
						title="Expenses"
						assets={[]}
						liabilities={state.expenses}
						equity={[]}
						currency={state.currency}
						decimals={currencyDecimals}
						totalAssets={0}
						totalLiabilities={state.totalExpenses}
						totalEquity={0}
						liabilitiesLabel="Expenses"
						liabilitiesExpectNegative={false}
						on:segment-click={handleSegmentClick}
					/>
				{/if}
			{/if}
		</div>

		<!-- Income Statement Table -->
		<div class="income-statement-section">
			<div class="income-statement-section-header">
				<h3>Income Statement</h3>
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
										on:click={(e) => handleAccountRowClick(item, e)}
										title={!item.isCategory ? 'Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal' : undefined}>
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
					<div class="section-total">
						<span>Total Income</span>
						<span class="total-amount">{state.totalIncome.toFixed(currencyDecimals)} {state.currency}</span>
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
										on:click={(e) => handleAccountRowClick(item, e)}
										title={!item.isCategory ? 'Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal' : undefined}>
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
					<div class="section-total">
						<span>Total Expenses</span>
						<span class="total-amount">{state.totalExpenses.toFixed(currencyDecimals)} {state.currency}</span>
					</div>
				</div>
			</div>

			<!-- Net Profit Summary -->
			<div class="net-profit-row">
				<span class="net-profit-label">Net Profit</span>
				<span class="net-profit-value {netProfitClass(state.netProfit)}">
					{state.netProfit.toFixed(currencyDecimals)} {state.currency}
				</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.income-statement-container {
		padding: 0;
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

	.valuation-method-label {
		font-size: 0.9em;
		color: var(--text-muted);
		white-space: nowrap;
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
		font-size: var(--font-ui-small);
	}

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
		padding: var(--size-4-1) var(--size-4-2);
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
		cursor: pointer;
	}

	:global(.account-row.category) .account-name {
		cursor: pointer;
	}

	:global(.account-row.leaf) {
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	:global(.account-row.leaf):hover {
		background-color: var(--background-modifier-hover);
	}

	:global(.account-row.leaf):hover .account-name {
		color: var(--text-accent);
		text-decoration: underline;
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
