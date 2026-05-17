<script lang="ts">
    import { onMount } from 'svelte';

    // Components
    import OverviewTab from '../../partials/dashboard/OverviewTab.svelte';
    import TransactionsTab from '../../partials/dashboard/TransactionsTab.svelte';
    import BalanceSheetTab from '../../partials/dashboard/BalanceSheetTab.svelte';
    import CommoditiesTab from '../../partials/dashboard/CommoditiesTab.svelte';
    import JournalTab from '../../partials/dashboard/JournalTab.svelte';
    import IncomeStatementTab from '../../partials/dashboard/IncomeStatementTab.svelte';
    import LiabilitiesTab from '../../partials/dashboard/LiabilitiesTab.svelte';
    import RecurringTab from '../../partials/dashboard/RecurringTab.svelte';

    // Types
    import type { OverviewController } from '../../../controllers/OverviewController';
    import type { TransactionController } from '../../../controllers/TransactionController';
    import type { BalanceSheetController } from '../../../controllers/BalanceSheetController';
    import type { CommoditiesController } from '../../../controllers/CommoditiesController';
    import type { IncomeStatementController } from '../../../controllers/IncomeStatementController';
    import type { RecurringController } from '../../../controllers/RecurringController';
    import type { LiabilitiesController } from '../../../controllers/LiabilitiesController';

    // Props
    export let overviewController: OverviewController;
    export let transactionController: TransactionController;
    export let balanceSheetController: BalanceSheetController;
    export let commoditiesController: CommoditiesController;
    export let incomeStatementController: IncomeStatementController;
    export let recurringController: RecurringController | null = null;
    export let liabilitiesController: LiabilitiesController | null = null;
    export let journalStore: any;
    export let plugin: any = null; // Add plugin prop

    let activeTab = 'overview';

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'transactions', label: 'Transactions' },
        { id: 'journal', label: 'Journal' },
        { id: 'balancesheet', label: 'Accounts & Balances' },
        { id: 'incomestatement', label: 'Income Statement' },
        { id: 'liabilities', label: 'Liabilities & Receivables' },
        { id: 'recurring', label: 'Recurring' },
        { id: 'commodities', label: 'Commodities' }
    ];
</script>

<div class="beancount-dashboard">
    <div class="tabs-header">
        {#each tabs as tab}
            <button
                class="tab-button {activeTab === tab.id ? 'active' : ''}"
                on:click={() => activeTab = tab.id}
            >
                {tab.label}
            </button>
        {/each}
    </div>

    <div class="tab-content">
        {#if activeTab === 'overview'}
            <OverviewTab
                controller={overviewController}
                {recurringController}
                {plugin}
            />
        {:else if activeTab === 'transactions'}
            <TransactionsTab
                controller={transactionController}
                {plugin}
                on:filtersChange={e => transactionController.handleFilterChange(e.detail)}
            />
        {:else if activeTab === 'journal'}
            <JournalTab store={journalStore} plugin={plugin} />
        {:else if activeTab === 'balancesheet'}
            <BalanceSheetTab controller={balanceSheetController} {plugin} />
        {:else if activeTab === 'incomestatement'}
            <IncomeStatementTab controller={incomeStatementController} />
        {:else if activeTab === 'liabilities'}
            {#if liabilitiesController}
                <LiabilitiesTab controller={liabilitiesController} {plugin} />
            {/if}
        {:else if activeTab === 'recurring'}
            {#if recurringController}
                <RecurringTab
                    controller={recurringController}
                    {plugin}
                    on:editLoan={() => activeTab = 'liabilities'}
                />
            {:else}
                <div style="padding: 24px; color: var(--text-muted);">
                    Recurring controller is not initialized.
                </div>
            {/if}
        {:else if activeTab === 'commodities'}
            <CommoditiesTab controller={commoditiesController} {plugin} on:openCommodity on:addCommodity />
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
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        overflow-x: auto;
    }

    .tab-button {
        background: none;
        border: none;
        padding: 8px 16px;
        cursor: pointer;
        font-size: var(--font-ui-small);
        color: var(--text-muted);
        border-bottom: 2px solid transparent;
        white-space: nowrap;
        border-radius: 0;
    }

    .tab-button:hover {
        color: var(--text-normal);
        background: var(--background-modifier-hover);
    }

    .tab-button.active {
        color: var(--text-accent);
        border-bottom-color: var(--text-accent);
        background: var(--background-primary);
        font-weight: 600;
    }

    .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        background: var(--background-primary);
    }
</style>
