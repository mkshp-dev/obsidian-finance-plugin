<script lang="ts">
	import type BeancountPlugin from '../main';
	import OverviewTab from '../components/tabs/OverviewTab.svelte';
	import TransactionsTab from '../components/tabs/TransactionsTab.svelte';
	import BalanceSheetTab from '../components/tabs/BalanceSheetTab.svelte';
	import { createEventDispatcher } from 'svelte';

	export let plugin: BeancountPlugin;
	// Receive the state objects as props
	export let transactionState: any = {};
	export let overviewState: any = {};

	type Tab = 'Overview' | 'Transactions' | 'Balance Sheet';
	let activeTab: Tab = 'Overview';

	const dispatch = createEventDispatcher();
	function forwardFiltersChange(event: any) {
		dispatch('filtersChange', event.detail);
	}
</script>

<div class="beancount-unified-dashboard">
	<div class="beancount-tabs">
		<button class:active={activeTab === 'Overview'} on:click={() => activeTab = 'Overview'}>Overview</button>
		<button class:active={activeTab === 'Transactions'} on:click={() => activeTab = 'Transactions'}>Transactions</button>
		<button class:active={activeTab === 'Balance Sheet'} on:click={() => activeTab = 'Balance Sheet'}>Balance Sheet</button>
	</div>

	<div class="tab-content">
		{#if activeTab === 'Overview'}
			<OverviewTab
				isLoading={overviewState.isLoading}
				error={overviewState.error}
				netWorth={overviewState.netWorth}
				monthlyIncome={overviewState.monthlyIncome}
				monthlyExpenses={overviewState.monthlyExpenses}
				savingsRate={overviewState.savingsRate}
				chartConfig={overviewState.chartConfig}
				chartError={overviewState.chartError}
			/>
		{:else if activeTab === 'Transactions'}
			<TransactionsTab
				{plugin} isLoading={transactionState.isLoading}
				error={transactionState.error}
				incomingTransactions={transactionState.currentTransactions}
				on:filtersChange={forwardFiltersChange}
			/>
		{:else if activeTab === 'Balance Sheet'}
			<BalanceSheetTab {plugin} />
		{/if}
	</div>
</div>

<style>
	/* ... (Styles are unchanged) ... */
	.beancount-tabs { display: flex; border-bottom: 1px solid var(--background-modifier-border); padding: 0 var(--size-4-4); }
	.beancount-tabs button { padding: 10px 16px; border: none; border-bottom: 2px solid transparent; background: none; color: var(--text-muted); cursor: pointer; margin-bottom: -1px; font-size: var(--font-ui-small); font-weight: 600; }
	.beancount-tabs button.active { color: var(--text-normal); border-bottom-color: var(--interactive-accent); }
	.beancount-tabs button:hover { color: var(--text-normal); }
	.tab-content { height: 100%; overflow-y: auto; } /* Added overflow */
	.beancount-unified-dashboard { display: flex; flex-direction: column; height: 100%; }
</style>