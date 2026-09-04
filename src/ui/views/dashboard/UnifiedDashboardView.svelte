<script lang="ts">
    import { onMount } from 'svelte';

    // Components
    import TabBar from '../../common/TabBar.svelte';
    import OverviewTab from '../../partials/dashboard/OverviewTab.svelte';
    import TransactionsTab from '../../partials/dashboard/TransactionsTab.svelte';
    import BalanceSheetTab from '../../partials/dashboard/BalanceSheetTab.svelte';
    import CommoditiesTab from '../../partials/dashboard/CommoditiesTab.svelte';
    import JournalTab from '../../partials/dashboard/JournalTab.svelte';
    import IncomeStatementTab from '../../partials/dashboard/IncomeStatementTab.svelte';

    // Types
    import type { OverviewController } from '../../../controllers/OverviewController';
    import type { TransactionController } from '../../../controllers/TransactionController';
    import type { BalanceSheetController } from '../../../controllers/BalanceSheetController';
    import type { CommoditiesController } from '../../../controllers/CommoditiesController';
    import type { IncomeStatementController } from '../../../controllers/IncomeStatementController';
    import type { NavRequest } from '../../../types/navigation';

    // Props
    export let overviewController: OverviewController;
    export let transactionController: TransactionController;
    export let balanceSheetController: BalanceSheetController;
    export let commoditiesController: CommoditiesController;
    export let incomeStatementController: IncomeStatementController;
    export let journalStore: any;
    export let plugin: any = null; // Add plugin prop

    export let activeTab = 'overview';

    export function navigate(req: NavRequest) {
        if (!req || !req.tab) return;
        if (req.tab === 'transactions') {
            const filters = req.filters || {};
            transactionController.setPendingFilters(filters);
            void transactionController.handleFilterChange(filters);
        } else if (req.tab === 'journal') {
            if (req.filters) {
                void journalStore.setFilters(req.filters);
            }
        }
        activeTab = req.tab;
    }

    function handleNavigateEvent(e: CustomEvent<NavRequest>) {
        if (e && e.detail) {
            navigate(e.detail);
        }
    }

    const tabs = [
        { value: 'overview', label: 'Overview' },
        { value: 'transactions', label: 'Transactions' },
        { value: 'journal', label: 'Journal' },
        { value: 'balancesheet', label: 'Accounts & Balances' },
        { value: 'incomestatement', label: 'Income Statement' },
        { value: 'commodities', label: 'Commodities' }
    ];
</script>

<div class="beancount-dashboard">

    <div class="tabs-header">
        <TabBar {tabs} bind:value={activeTab} fullWidth={false} ariaLabel="Dashboard sections" />
    </div>

    <div class="tab-content">
        {#if activeTab === 'overview'}
            <OverviewTab controller={overviewController} {plugin} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'transactions'}
            <TransactionsTab 
                controller={transactionController}
                {navigate}
                on:navigate={handleNavigateEvent}
                on:filtersChange={e => transactionController.handleFilterChange(e.detail)}
            />
        {:else if activeTab === 'journal'}
            <JournalTab store={journalStore} {plugin} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'balancesheet'}
            <BalanceSheetTab controller={balanceSheetController} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'incomestatement'}
            <IncomeStatementTab controller={incomeStatementController} {navigate} on:navigate={handleNavigateEvent} />
        {:else if activeTab === 'commodities'}
            <CommoditiesTab controller={commoditiesController} on:navigate={handleNavigateEvent} on:openCommodity on:addCommodity />
        {/if}
    </div>
</div>

<style>
    .beancount-dashboard {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .tabs-header {
        display: flex;
        padding: var(--size-4-2) var(--size-4-3);
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        overflow-x: auto;
    }

    .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--size-4-4);
        background: var(--background-primary);
    }
</style>
