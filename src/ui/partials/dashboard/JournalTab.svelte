<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { debounce, getOpenAccounts } from '../../../utils/index';
    import TransactionCard from './cards/TransactionCard.svelte';
    import BalanceCard from './cards/BalanceCard.svelte';
    import NoteCard from './cards/NoteCard.svelte';
    import { UnifiedTransactionModal } from '../../modals/UnifiedTransactionModal';
    import { ConfirmModal } from '../../modals/ConfirmModal';
    import type { JournalEntry } from '../../../models/journal';
    import { Logger } from '../../../utils/logger';

    // Instead of importing Controller, we receive the Store
    export let store: any;
    // We also need the plugin instance to pass to the modal
    // But store usually doesn't have the plugin instance.
    // The previous code didn't use plugin instance for actions, but UnifiedTransactionModal NEEDS it.
    // How did JournalTab get the plugin?
    // It didn't use it before.
    // UnifiedTransactionModal constructor: (app: App, plugin: BeancountPlugin, ...)
    // We need to access the plugin instance.
    // Usually passed as prop or context.
    // Let's assume it's available via a method on the store or we need to find a way.
    // In UnifiedDashboardView.svelte, JournalTab is rendered.
    // UnifiedDashboardView receives `controller` which has `plugin`.
    // JournalTab receives `store`.
    // We might need to pass `plugin` prop to JournalTab.
    // Let's check UnifiedDashboardView.svelte again.

    // For now, I'll add `plugin` export and update the caller if needed.
    // Or I can access it via the store if the store holds a reference?
    // The store is a Svelte store, likely not holding the plugin directly in a public way.
    // `journal.store.ts` imports `JournalService`.

    // The `UnifiedDashboardView.svelte` passes `store={journalStore}`.
    // I should check `UnifiedDashboardView.svelte` to see if I can pass `plugin`.

    export let plugin: any = null; // We will need to update the parent to pass this.

    // Destructure store for easier access
    const {
        entries,
        filters,
        loading,
        error,
        currentPage,
        pageSize,
        totalCount,
        hasMore,
        loadEntries,
        setFilters,
        clearFilters,
        setPage,
        refresh,
        deleteTransaction
    } = store;

    // Local filter state
    let searchTerm = '';
    let selectedAccount = '';
    let startDate = '';
    let endDate = '';
    let payeeFilter = '';
    let tagFilter = '';
    let typeFilter = 'all';
    
    // Flag to prevent filter application during initialization
    let isInitialized = false;

    // Suggestions lists
    let availableAccounts: string[] = [];
    let availablePayees: string[] = [];
    let availableTags: string[] = [];

    const updateFiltersDebounced = debounce(() => {
        // Prevent filter updates if not initialized or already loading
        if (!isInitialized || isLoading) {
            return;
        }
        applyFilters();
    }, 500);

    async function fetchSuggestions() {
        if (!plugin) return;
        try {
            // Run requests in parallel
            const [accountsRes, payeesRes, tagsRes] = await Promise.allSettled([
                getOpenAccounts(plugin),
                plugin.apiClient.get('/payees'),
                plugin.apiClient.get('/tags')
            ]);

            // Limit suggestions to avoid DOM freezing with large datasets
            // Reduced to 200 to ensure responsiveness even on slower devices
            const MAX_SUGGESTIONS = 200;

            if (accountsRes.status === 'fulfilled') {
                availableAccounts = accountsRes.value.slice(0, MAX_SUGGESTIONS);
            }
            if (payeesRes.status === 'fulfilled') {
                const payees = payeesRes.value.payees || [];
                availablePayees = payees.slice(0, MAX_SUGGESTIONS);
            }
            if (tagsRes.status === 'fulfilled') {
                const tags = tagsRes.value.tags || [];
                availableTags = tags.slice(0, MAX_SUGGESTIONS);
            }

        } catch (err) {
            console.error('Failed to load suggestions:', err);
        }
    }

    function applyFilters() {
        // Prevent concurrent filter applications or premature calls
        if (!isInitialized || isLoading) {
            return;
        }
        setFilters({
            searchTerm: searchTerm || undefined,
            account: selectedAccount || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            payee: payeeFilter || undefined,
            tag: tagFilter || undefined,
            entryTypes: typeFilter !== 'all' ? [typeFilter] : undefined
        });
    }

    function handleClear() {
        searchTerm = '';
        selectedAccount = '';
        startDate = '';
        endDate = '';
        payeeFilter = '';
        tagFilter = '';
        typeFilter = 'all';
        clearFilters();
    }

    function handleEdit(entry: JournalEntry) {
        if (!plugin) {
            console.error("Plugin instance not found");
            return;
        }
        new UnifiedTransactionModal(plugin.app, plugin, entry, async () => {
            await refresh();
        }).open();
    }

    function handleDelete(entry: JournalEntry) {
        if (!plugin) {
            console.error("Plugin instance not found");
            return;
        }

        new ConfirmModal(
            plugin.app,
            'Delete Entry',
            `Are you sure you want to delete this ${entry.type}?`,
            async () => {
                await deleteTransaction(entry.id);
            }
        ).open();
    }

    onMount(() => {
        Logger.log('JournalTab mounted');
        // Sync local state with store filters
        const currentFilters = $filters;
        searchTerm = currentFilters.searchTerm || '';
        selectedAccount = currentFilters.account || '';
        startDate = currentFilters.startDate || '';
        endDate = currentFilters.endDate || '';
        payeeFilter = currentFilters.payee || '';
        tagFilter = currentFilters.tag || '';

        if (currentFilters.entryTypes && currentFilters.entryTypes.length === 1) {
            typeFilter = currentFilters.entryTypes[0];
        } else {
            typeFilter = 'all';
        }

        fetchSuggestions();
        loadEntries().then(() => {
            // Set initialized flag after initial load completes
            isInitialized = true;
        });
    });

    // Use non-reactive variables and update them manually
    let hasVisibleEntries = false;
    let visibleEntriesArray: JournalEntry[] = [];
    let isLoading = false;
    let totalEntries = 0;
    let currentPageNum = 1;
    let pageSizeNum = 200;
    let hasMorePages = false;
    
    // Subscribe to stores manually and update local state
    const unsubEntries = entries.subscribe((value: JournalEntry[]) => {
        const allEntries = value || [];
        visibleEntriesArray = allEntries.filter((e: JournalEntry) =>
            e && ['transaction', 'balance', 'note'].includes(e.type)
        );
        hasVisibleEntries = visibleEntriesArray.length > 0;
    });
    
    const unsubLoading = loading.subscribe((value: boolean) => { isLoading = value; });
    const unsubTotalCount = totalCount.subscribe((value: number) => { totalEntries = value; });
    const unsubCurrentPage = currentPage.subscribe((value: number) => { currentPageNum = value; });
    const unsubPageSize = pageSize.subscribe((value: number) => { pageSizeNum = value; });
    const unsubHasMore = hasMore.subscribe((value: boolean) => { hasMorePages = value; });
    
    // Cleanup subscriptions
    onDestroy(() => {
        unsubEntries();
        unsubLoading();
        unsubTotalCount();
        unsubCurrentPage();
        unsubPageSize();
        unsubHasMore();
    });
</script>

<div class="journal-tab">
    <!-- Filters Toolbar -->
    <div class="filters-container">
        <div class="filter-row">
            <div class="filter-group">
                <label for="search">Search</label>
                <input type="text" id="search" bind:value={searchTerm} on:input={updateFiltersDebounced} placeholder="Search (payee, narration, account)..." disabled={isLoading} />
            </div>
            <div class="filter-group">
                <label for="type">Type</label>
                <select id="type" bind:value={typeFilter} on:change={applyFilters} disabled={isLoading}>
                    <option value="all">All Types</option>
                    <option value="transaction">Transactions</option>
                    <option value="note">Notes</option>
                    <option value="balance">Balances</option>
                </select>
            </div>
             <div class="filter-group">
                <label for="account">Account</label>
                <input type="text" id="account" bind:value={selectedAccount} on:input={updateFiltersDebounced} list="account-suggestions" placeholder="Account..." disabled={isLoading} />
                <datalist id="account-suggestions">
                    {#each availableAccounts as account}
                        <option value={account} />
                    {/each}
                </datalist>
            </div>
        </div>

        <div class="filter-row">
             <div class="filter-group">
                <label for="start">From</label>
                <input type="date" id="start" bind:value={startDate} on:change={applyFilters} disabled={isLoading} />
            </div>
             <div class="filter-group">
                <label for="end">To</label>
                <input type="date" id="end" bind:value={endDate} on:change={applyFilters} disabled={isLoading} />
            </div>
            <div class="filter-group">
                <label for="payee">Payee</label>
                <input type="text" id="payee" bind:value={payeeFilter} on:input={updateFiltersDebounced} list="payee-suggestions" placeholder="Payee..." disabled={isLoading} />
                <datalist id="payee-suggestions">
                    {#each availablePayees as payee}
                        <option value={payee} />
                    {/each}
                </datalist>
            </div>
            <div class="filter-group">
                <label for="tag">Tag</label>
                <input type="text" id="tag" bind:value={tagFilter} on:input={updateFiltersDebounced} list="tag-suggestions" placeholder="Tag..." disabled={isLoading} />
                <datalist id="tag-suggestions">
                    {#each availableTags as tag}
                        <option value={tag} />
                    {/each}
                </datalist>
                <!-- Datalist temporarily removed for debugging -->
            </div>
            <div class="filter-actions">
                 <button class="btn" on:click={handleClear} disabled={isLoading}>Clear</button>
                 <button class="btn btn-primary" on:click={() => refresh()} disabled={isLoading}>Refresh</button>
            </div>
        </div>
    </div>

    <!-- Error Banner -->
    {#if $error}
        <div class="error-banner">
            <span class="font-medium">Error:</span> {$error}
        </div>
    {/if}

    <!-- Cards List -->
    <div class="cards-container">
        {#if isLoading}
            <div class="loading-state">Loading entries...</div>
        {/if}
        
        {#if !isLoading && visibleEntriesArray.length === 0}
            <span style="display: block; text-align: center; padding: 3rem; color: var(--text-muted);">
                No entries found matching your filters.
            </span>
        {/if}
        
        {#if !isLoading && visibleEntriesArray.length > 0}
            {#each visibleEntriesArray as entry (entry.id)}
                {#if entry.type === 'transaction'}
                    <TransactionCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                    />
                {:else if entry.type === 'balance'}
                    <BalanceCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                    />
                {:else if entry.type === 'note'}
                    <NoteCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                    />
                {/if}
            {/each}
        {/if}
    </div>

    <!-- Pagination -->
    {#if totalEntries > 0}
    <div class="pagination-container">
        <span class="pagination-info">
            Showing <span class="font-semibold">{(currentPageNum - 1) * pageSizeNum + 1}</span> to <span class="font-semibold">{Math.min(currentPageNum * pageSizeNum, totalEntries)}</span> of <span class="font-semibold">{totalEntries}</span>
        </span>
        <div class="pagination-controls">
            <button class="btn-small" on:click={() => setPage(currentPageNum - 1)} disabled={currentPageNum === 1}>
                Previous
            </button>
            <button class="btn-small" on:click={() => setPage(currentPageNum + 1)} disabled={!hasMorePages}>
                Next
            </button>
        </div>
    </div>
    {/if}
</div>

<style>
    .journal-tab {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 1rem;
        gap: 1rem;
    }

    .filters-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: var(--background-secondary);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
    }

    .filter-row {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        align-items: flex-end;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        min-width: 120px;
    }

    .filter-group label {
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .filter-group input, .filter-group select {
        padding: 0.4rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.9rem;
    }

    .filter-actions {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
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

    .error-banner {
        padding: 0.75rem;
        background: var(--background-modifier-error);
        color: var(--text-on-accent); /* Ensure readability on red background */
        border-radius: 6px;
        border: 1px solid var(--text-error);
        margin-bottom: 1rem;
        font-weight: 500;
    }

    .cards-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 4px; /* Space for scrollbar */
    }

    .loading-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-muted);
        font-size: 1.1rem;
        border: 1px dashed var(--background-modifier-border);
        border-radius: 8px;
    }

    .pagination-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 0.5rem;
    }

    .pagination-info {
        font-size: 0.9rem;
        color: var(--text-muted);
    }

    .pagination-controls {
        display: flex;
        gap: 0.5rem;
    }

    .btn-small {
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.85rem;
    }

    .btn-small:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
