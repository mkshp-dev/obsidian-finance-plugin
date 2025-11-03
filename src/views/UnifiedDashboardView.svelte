<script lang="ts">
	import OverviewTab from '../components/tabs/OverviewTab.svelte';
	import TransactionsTab from '../components/tabs/TransactionsTab.svelte';
	import BalanceSheetTab from '../components/tabs/BalanceSheetTab.svelte';
	import AccountsTab from '../components/tabs/AccountsTab.svelte';
	import CommoditiesTab from '../components/tabs/CommoditiesTab.svelte';
	import JournalTab from '../components/tabs/JournalTab.svelte';
	import { createEventDispatcher } from 'svelte';
	
	// --- Import Controller Types ---
	import type { OverviewController } from '../controllers/OverviewController';
	import type { TransactionController } from '../controllers/TransactionController';
	import type { BalanceSheetController } from '../controllers/BalanceSheetController';
	import type { AccountsController } from '../controllers/AccountsController';
	import type { CommoditiesController } from '../controllers/CommoditiesController';
	import type { JournalController } from '../controllers/JournalController';

	// --- Receive Controllers as props ---
	export let overviewController: OverviewController;
	export let transactionController: TransactionController;
	export let balanceSheetController: BalanceSheetController;
	export let accountsController: AccountsController;
	export let commoditiesController: CommoditiesController;
	export let journalController: JournalController;
	// --- REMOVED transactionState prop ---

	type Tab = 'Overview' | 'Postings' | 'Balance Sheet' | 'Accounts' | 'Commodities' | 'Journal';
	let activeTab: Tab = 'Overview'; // Default to Overview

	const dispatch = createEventDispatcher();
	function forwardFiltersChange(event: any) {
		dispatch('filtersChange', event.detail);
	}
</script>

<div class="beancount-unified-dashboard">
	<div class="beancount-tabs">
		<button class:active={activeTab === 'Overview'} on:click={() => activeTab = 'Overview'}>Overview</button>
		<button class:active={activeTab === 'Postings'} on:click={() => activeTab = 'Postings'}>Postings</button>
		<button class:active={activeTab === 'Balance Sheet'} on:click={() => activeTab = 'Balance Sheet'}>Balance Sheet</button>
		<button class:active={activeTab === 'Accounts'} on:click={() => activeTab = 'Accounts'}>Accounts</button>
		<button class:active={activeTab === 'Commodities'} on:click={() => activeTab = 'Commodities'}>Commodities</button>
		<button class:active={activeTab === 'Journal'} on:click={() => activeTab = 'Journal'}>Journal</button>
	</div>

	<div class="tab-content">
		{#if activeTab === 'Overview'}
			<OverviewTab controller={overviewController} />

		{:else if activeTab === 'Postings'}
			<TransactionsTab
				controller={transactionController}
				on:filtersChange={forwardFiltersChange}
			/>

		{:else if activeTab === 'Balance Sheet'}
			<BalanceSheetTab controller={balanceSheetController} />

		{:else if activeTab === 'Accounts'}
			<AccountsTab accountsController={accountsController} />

		{:else if activeTab === 'Commodities'}
			<CommoditiesTab controller={commoditiesController} />

		{:else if activeTab === 'Journal'}
			<JournalTab controller={journalController} />
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