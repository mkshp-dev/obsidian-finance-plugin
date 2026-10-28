<script lang="ts">
	import HelpTip from '../../common/HelpTip.svelte';
	import { createEventDispatcher } from 'svelte';
	import CardComponent from '../../common/CardComponent.svelte';
	import IndicatorsSection from './IndicatorsSection.svelte';
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';
	import type { OverviewController } from '../../../controllers/OverviewController';
	import { writable, type Writable } from 'svelte/store'; // Import writable
	import type { OverviewPeriodPreset, OverviewState } from '../../../controllers/OverviewController'; // Import the State type
	import { AddBudgetModal } from '../../modals/AddBudgetModal';
	import { AddTargetModal } from '../../modals/AddTargetModal';
	import { parsePeriodLabel } from '../../../utils/index';
	import { resolveNavTab, type NavRequest } from '../../../types/navigation';
	import type { TransactionFilters } from '../../../queries';

	// --- Receive the controller ---
	export let controller: OverviewController;
	export let plugin: any = null;
	export let navigate: ((req: NavRequest) => void) | null = null;

	const dispatch = createEventDispatcher();

	function handleKpiClick(accountPrefix?: string, event?: MouseEvent | KeyboardEvent) {
		const { startDate, endDate } = parsePeriodLabel(state.periodLabel || '', 'month');
		const filters: TransactionFilters = {};
		if (accountPrefix) filters.account = accountPrefix;
		if (startDate) filters.startDate = startDate;
		if (endDate) filters.endDate = endDate;

		const req: NavRequest = { tab: resolveNavTab(event), filters };
		if (navigate) {
			navigate(req);
		} else {
			dispatch('navigate', req);
		}
	}

	// --- THIS IS THE FIX ---
	// 1. Create a local, placeholder store with default values.
	//    This ensures $stateStore is always a valid store.
	const placeholderState: Writable<OverviewState> = writable({
		isLoading: true,
		error: null,
		netWorth: '0.00 USD',
		currency: 'USD',
		periodPreset: 'this-month',
		periodMode: 'month',
		periodYear: new Date().getFullYear(),
		periodMonth: new Date().getMonth() + 1,
		periodLabel: '',
		periodIncome: '0.00 USD',
		periodExpenses: '0.00 USD',
		periodNetIncome: '0.00 USD',
		periodSavingsRate: '0%',
	});

	// 2. Use a reactive statement ($:) to update the local store variable
	//    *after* the 'controller' prop is passed in.
	$: stateStore = controller ? controller.state : placeholderState;
	
	// 3. Now, '$stateStore' will safely subscribe, starting with the
	//    placeholder and then automatically switching to the real store.
	$: state = $stateStore;
	
	// Add refresh functionality
	function handleRefresh() {
		if (controller) {
			controller.loadData();
		}
	}

	function handleAddBudget() {
		if (!plugin) return;
		new AddBudgetModal(plugin.app, plugin).open();
	}

	function handleAddTarget() {
		if (!plugin) return;
		new AddTargetModal(plugin.app, plugin).open();
	}

	function handlePeriodPresetChange(event: Event) {
		const preset = (event.currentTarget as HTMLSelectElement).value as OverviewPeriodPreset;
		controller?.setPeriodPreset(preset);
	}

	function handleYearChange(event: Event) {
		const year = Number((event.currentTarget as HTMLInputElement).value);
		controller?.setPeriodYear(year);
	}

	function handleMonthChange(event: Event) {
		const month = Number((event.currentTarget as HTMLSelectElement).value);
		controller?.setPeriodMonth(month);
	}

	const months = [
		{ value: 1, label: 'January' },
		{ value: 2, label: 'February' },
		{ value: 3, label: 'March' },
		{ value: 4, label: 'April' },
		{ value: 5, label: 'May' },
		{ value: 6, label: 'June' },
		{ value: 7, label: 'July' },
		{ value: 8, label: 'August' },
		{ value: 9, label: 'September' },
		{ value: 10, label: 'October' },
		{ value: 11, label: 'November' },
		{ value: 12, label: 'December' },
	];

	const periodPresets = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'last-year', label: 'Last Year' },
		{ value: 'custom-month', label: 'Custom Month' },
		{ value: 'custom-year', label: 'Custom Year' },
	];
	// -----------------------
</script>
<div class="beancount-overview">
	<div class="overview-header">
		<div class="overview-title">
			<h3>Financial Overview <HelpTip topic="overview" /></h3>
			<p>{state.periodLabel}</p>
		</div>
		<div class="overview-actions">
			<div class="period-controls">
				<label>
					<span>Period</span>
					<select value={state.periodPreset} on:change={handlePeriodPresetChange} disabled={state.isLoading}>
						{#each periodPresets as preset}
							<option value={preset.value}>{preset.label}</option>
						{/each}
					</select>
				</label>
				{#if state.periodPreset === 'custom-month' || state.periodPreset === 'custom-year'}
					<label>
						<span>Year</span>
						<input
							type="number"
							min="1"
							step="1"
							value={state.periodYear}
							on:change={handleYearChange}
							disabled={state.isLoading}
						/>
					</label>
				{/if}
				{#if state.periodPreset === 'custom-month'}
					<label>
						<span>Month</span>
						<select value={state.periodMonth} on:change={handleMonthChange} disabled={state.isLoading}>
							{#each months as month}
								<option value={month.value}>{month.label}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>
			<button class="btn btn-primary" on:click={handleRefresh} disabled={state.isLoading}>Refresh</button>
		</div>
	</div>

	{#if state.isLoading}
		<SkeletonLoader type="kpi" />
	{:else if state.error}
		<ErrorBanner message={state.error} on:retry={handleRefresh} />
	{:else}
		<div class="conversion-warning">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
				<line x1="12" y1="9" x2="12" y2="13"/>
				<line x1="12" y1="17" x2="12.01" y2="17"/>
			</svg>
			<span>Only commodities with conversion prices to {state.currency} are included in Net Worth calculations</span>
		</div>
		
		<div class="kpi-grid">
			<CardComponent label="Total Balance" value={state.netWorth} comparison="Assets minus liabilities" clickable on:click={(e) => handleKpiClick(undefined, e.detail)} />
			<CardComponent label="Income" value={state.periodIncome} comparison={state.periodLabel} clickable on:click={(e) => handleKpiClick('Income', e.detail)} />
			<CardComponent label="Expenses" value={state.periodExpenses} comparison={state.periodLabel} clickable on:click={(e) => handleKpiClick('Expenses', e.detail)} />
			<CardComponent label="Savings Rate" value={state.periodSavingsRate} comparison={`Net income: ${state.periodNetIncome}`} clickable on:click={(e) => handleKpiClick(undefined, e.detail)} />
		</div>

		<IndicatorsSection
			{plugin}
			{navigate}
			on:navigate
			on:add-budget={handleAddBudget}
			on:add-target={handleAddTarget}
		/>
	{/if}
</div>

<style>
	/* Styles remain unchanged */
	.beancount-overview { padding: 0; }
	
	.overview-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: var(--size-4-4);
		margin-bottom: var(--size-4-4);
		padding-bottom: var(--size-4-2);
		border-bottom: 1px solid var(--background-modifier-border);
	}
	
	.overview-header h3 {
		margin: 0;
		color: var(--text-normal);
		font-size: var(--font-ui-larger);
	}

	.overview-title p {
		margin: var(--size-4-1) 0 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.overview-actions {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--size-4-2);
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
	
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--size-4-4);
	}

	.period-controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--size-4-2);
	}

	.period-controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.period-controls select,
	.period-controls input {
		min-width: 110px;
		height: 32px;
		padding: 0 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	.period-controls input {
		width: 110px;
	}
	
	.conversion-warning {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: var(--size-4-2) var(--size-4-3);
		margin-bottom: var(--size-4-4);
		background: var(--background-modifier-info);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}
	
	.conversion-warning svg {
		flex-shrink: 0;
		opacity: 0.7;
	}
	
	.error-message { color: var(--text-error); }

	@media (max-width: 700px) {
		.overview-header {
			align-items: stretch;
			flex-direction: column;
		}

		.overview-actions {
			justify-content: flex-start;
		}

		.period-controls {
			justify-content: flex-start;
		}
	}
</style>
