<script lang="ts">
    import HelpTip from '../../common/HelpTip.svelte';
    import { onMount, onDestroy } from 'svelte';
    import { debounce, getOpenAccounts, getPayees, getTags, deleteTransaction, deleteBalance, deleteNote, createSnippet, type TransactionData, type CostData, type PriceDataPayload } from '../../../utils/index';
    import SkeletonLoader from '../../common/SkeletonLoader.svelte';
    import ErrorBanner from '../../common/ErrorBanner.svelte';
    import EmptyState from '../../common/EmptyState.svelte';
    import TransactionCard from './cards/TransactionCard.svelte';
    import BalanceCard from './cards/BalanceCard.svelte';
    import NoteCard from './cards/NoteCard.svelte';
    import { UnifiedTransactionModal } from '../../modals/UnifiedTransactionModal';
    import { ConfirmModal } from '../../modals/ConfirmModal';
    import { SnippetNameModal } from '../../modals/SnippetNameModal';
    import { Notice } from 'obsidian';
    import type { JournalEntry } from '../../../models/journal';
    import { Logger } from '../../../utils/logger';
    import { nativeDatePicker } from '../../actions/nativeDatePicker';

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

    import { resolveNavTab, type NavRequest } from '../../../types/navigation';

    export let plugin: any = null; // We will need to update the parent to pass this.
    export let navigate: ((req: NavRequest) => void) | null = null;

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
        refresh
    } = store;

    // Local filter state
    let searchTerm = '';
    let selectedAccount = '';
    let startDate = '';
    let endDate = '';
    let payeeFilter = '';
    let tagFilter = '';
    let typeFilter = 'all';
    let activeSuggestionField: 'account' | 'payee' | 'tag' | null = null;
    let closeSuggestionsTimer: ReturnType<typeof setTimeout> | null = null;
    
    // Flag to prevent filter application during initialization
    let isInitialized = false;

    // Suggestions lists
    let availableAccounts: string[] = [];
    let availablePayees: string[] = [];
    let availableTags: string[] = [];
    let filteredAccountSuggestions: string[] = [];
    let filteredPayeeSuggestions: string[] = [];
    let filteredTagSuggestions: string[] = [];

    function getFilteredSuggestions(options: string[], value: string): string[] {
        const query = value.trim().toLowerCase();
        const matches = query
            ? options.filter((option) => option.toLowerCase().includes(query))
            : options;

        return matches.slice(0, 50);
    }

    $: filteredAccountSuggestions = activeSuggestionField === 'account'
        ? getFilteredSuggestions(availableAccounts, selectedAccount)
        : [];
    $: filteredPayeeSuggestions = activeSuggestionField === 'payee'
        ? getFilteredSuggestions(availablePayees, payeeFilter)
        : [];
    $: filteredTagSuggestions = activeSuggestionField === 'tag'
        ? getFilteredSuggestions(availableTags, tagFilter)
        : [];

    const updateFiltersDebounced = debounce(() => {
        // Prevent filter updates if not initialized or already loading
        if (!isInitialized || isLoading) {
            return;
        }
        applyFilters();
    }, 300);

    async function fetchSuggestions() {
        if (!plugin) return;
        try {
            // Run requests in parallel - now using BQL directly instead of backend API
            const [accountsRes, payeesRes, tagsRes] = await Promise.allSettled([
                getOpenAccounts(plugin),
                getPayees(plugin),
                getTags(plugin)
            ]);

            if (accountsRes.status === 'fulfilled') {
                availableAccounts = accountsRes.value || [];
            }
            if (payeesRes.status === 'fulfilled') {
                availablePayees = payeesRes.value || [];
            }
            if (tagsRes.status === 'fulfilled') {
                availableTags = tagsRes.value || [];
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

    function openSuggestions(field: 'account' | 'payee' | 'tag') {
        if (closeSuggestionsTimer) {
            clearTimeout(closeSuggestionsTimer);
            closeSuggestionsTimer = null;
        }
        activeSuggestionField = field;
    }

    function closeSuggestionsSoon() {
        closeSuggestionsTimer = setTimeout(() => {
            activeSuggestionField = null;
            closeSuggestionsTimer = null;
        }, 150);
    }

    function selectSuggestion(field: 'account' | 'payee' | 'tag', value: string) {
        if (field === 'account') selectedAccount = value;
        if (field === 'payee') payeeFilter = value;
        if (field === 'tag') tagFilter = value;

        activeSuggestionField = null;
        applyFilters();
    }

    function handleSuggestionKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            activeSuggestionField = null;
        }
    }

    function handleClear() {
        searchTerm = '';
        selectedAccount = '';
        startDate = '';
        endDate = '';
        payeeFilter = '';
        tagFilter = '';
        typeFilter = 'all';
        activeSuggestionField = null;
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
                try {
                    let result;
                    
                    // Call the appropriate delete function based on entry type
                    if (entry.type === 'transaction') {
                        result = await deleteTransaction(plugin, entry.id);
                    } else if (entry.type === 'balance') {
                        result = await deleteBalance(plugin, entry.id);
                    } else if (entry.type === 'note') {
                        result = await deleteNote(plugin, entry.id);
                    } else {
                        new Notice(`Deleting ${entry.type} entries is not supported.`);
                        return;
                    }
                    
                    if (result.success) {
                        new Notice(`${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} deleted successfully!`);
                        await refresh();
                    } else {
                        new Notice(`Failed to delete ${entry.type}: ${result.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    new Notice(`Failed to delete ${entry.type}. Check console for details.`);
                }
            }
        ).open();
    }

    function handleCreateSnippet(entry: any) {
        if (!plugin) {
            console.error("Plugin instance not found");
            return;
        }

        // Guess a default snippet name from payee or narration
        let defaultName = '';
        if (entry.payee) {
            defaultName = entry.payee;
            if (entry.narration) defaultName += ` - ${entry.narration}`;
        } else {
            defaultName = entry.narration || 'MySnippet';
        }

        // Clean name of characters that aren't nice for autocompletion matching
        defaultName = defaultName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();

        new SnippetNameModal(
            plugin.app,
            defaultName,
            async (snippetName) => {
                try {
                    // Map JournalTransaction to TransactionData
                    const transactionData: TransactionData = {
                        date: entry.date,
                        flag: entry.flag || '*',
                        payee: entry.payee || undefined,
                        narration: entry.narration,
                        tags: entry.tags || [],
                        links: entry.links || [],
                        metadata: entry.metadata as Record<string, string> || {},
                        postings: (entry.postings || []).map((p: any) => {
                            const cost: CostData | undefined = p.cost ? {
                                number: p.cost.number || undefined,
                                currency: p.cost.currency || undefined,
                                date: p.cost.date || undefined,
                                label: p.cost.label || undefined,
                                isTotal: p.cost.isTotal
                            } : undefined;

                            const price: PriceDataPayload | undefined = p.price ? {
                                amount: p.price.amount,
                                currency: p.price.currency,
                                isTotal: p.price.isTotal
                            } : undefined;

                            return {
                                account: p.account,
                                amount: p.amount || undefined,
                                currency: p.currency || undefined,
                                flag: p.flag || undefined,
                                comment: p.comment || undefined,
                                metadata: p.metadata || {},
                                cost,
                                price
                            };
                        })
                    };

                    const result = await createSnippet(plugin, snippetName, transactionData);
                    if (result.success) {
                        new Notice(`Snippet "${snippetName}" created successfully!`);
                    } else {
                        new Notice(`Failed to create snippet: ${result.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Error creating snippet:', error);
                    new Notice(`Failed to create snippet. Check console for details.`);
                }
            }
        ).open();
    }

    function handleAccountClick(accountName: string, ctrlKey = false) {
        if (!accountName) return;
        const req: NavRequest = { tab: resolveNavTab({ ctrlKey }), filters: { account: accountName } };
        if (navigate) {
            navigate(req);
        } else {
            dispatch('navigate', req);
        }
    }

    function handlePayeeClick(payeeName: string) {
        if (!payeeName) return;
        const req: NavRequest = { tab: 'transactions', filters: { payee: payeeName } };
        if (navigate) {
            navigate(req);
        } else {
            dispatch('navigate', req);
        }
    }

    function handleTagClick(tagName: string, ctrlKey = false) {
        if (!tagName) return;
        const req: NavRequest = { tab: resolveNavTab({ ctrlKey }), filters: { tag: tagName } };
        if (navigate) {
            navigate(req);
        } else {
            dispatch('navigate', req);
        }
    }

    // Keep the filter inputs in sync with the store, not just on mount — the
    // tab stays mounted when a same-tab Ctrl/Cmd+click (e.g. from a Journal
    // card) pushes new filters into the store via navigate(), so the inputs
    // must reflect it live instead of only after a tab switch remounts us.
    $: syncLocalFiltersFromStore($filters);

    function syncLocalFiltersFromStore(currentFilters: any) {
        if (!currentFilters) return;
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
    }

    onMount(() => {
        Logger.log('JournalTab mounted');
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
        if (closeSuggestionsTimer) clearTimeout(closeSuggestionsTimer);
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
                <div class="suggestion-wrapper">
                    <input
                        type="text"
                        id="account"
                        bind:value={selectedAccount}
                        on:input={updateFiltersDebounced}
                        on:focus={() => openSuggestions('account')}
                        on:blur={closeSuggestionsSoon}
                        on:keydown={handleSuggestionKeydown}
                        placeholder="Account..."
                        autocomplete="off"
                        disabled={isLoading}
                    />
                    {#if filteredAccountSuggestions.length > 0}
                        <ul class="suggestions-list" role="listbox">
                            {#each filteredAccountSuggestions as account}
                                <li role="option" aria-selected="false" title={account} on:mousedown|preventDefault={() => selectSuggestion('account', account)}>
                                    {account}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>
        </div>

        <div class="filter-row">
             <div class="filter-group">
                <label for="start">From</label>
                <input type="date" id="start" bind:value={startDate} on:change={applyFilters} disabled={isLoading} use:nativeDatePicker />
            </div>
             <div class="filter-group">
                <label for="end">To</label>
                <input type="date" id="end" bind:value={endDate} on:change={applyFilters} disabled={isLoading} use:nativeDatePicker />
            </div>
            <div class="filter-group">
                <label for="payee">Payee</label>
                <div class="suggestion-wrapper">
                    <input
                        type="text"
                        id="payee"
                        bind:value={payeeFilter}
                        on:input={updateFiltersDebounced}
                        on:focus={() => openSuggestions('payee')}
                        on:blur={closeSuggestionsSoon}
                        on:keydown={handleSuggestionKeydown}
                        placeholder="Payee..."
                        autocomplete="off"
                        disabled={isLoading}
                    />
                    {#if filteredPayeeSuggestions.length > 0}
                        <ul class="suggestions-list" role="listbox">
                            {#each filteredPayeeSuggestions as payee}
                                <li role="option" aria-selected="false" title={payee} on:mousedown|preventDefault={() => selectSuggestion('payee', payee)}>
                                    {payee}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>
            <div class="filter-group">
                <label for="tag">Tag</label>
                <div class="suggestion-wrapper">
                    <input
                        type="text"
                        id="tag"
                        bind:value={tagFilter}
                        on:input={updateFiltersDebounced}
                        on:focus={() => openSuggestions('tag')}
                        on:blur={closeSuggestionsSoon}
                        on:keydown={handleSuggestionKeydown}
                        placeholder="Tag..."
                        autocomplete="off"
                        disabled={isLoading}
                    />
                    {#if filteredTagSuggestions.length > 0}
                        <ul class="suggestions-list" role="listbox">
                            {#each filteredTagSuggestions as tag}
                                <li role="option" aria-selected="false" title={tag} on:mousedown|preventDefault={() => selectSuggestion('tag', tag)}>
                                    {tag}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>
            <div class="filter-actions">
                 <button class="btn" on:click={handleClear} disabled={isLoading}>Clear</button>
                 <button class="btn btn-primary" on:click={() => refresh()} disabled={isLoading}>Refresh</button>
                 <HelpTip topic="journal" />
            </div>
        </div>
    </div>

    <!-- Error Banner -->
    {#if $error}
        <ErrorBanner message={$error} on:retry={() => refresh()} />
    {/if}

    <!-- Cards List -->
    <div class="cards-container">
        {#if isLoading}
            <SkeletonLoader type="list" rows={5} />
        {/if}
        
        {#if !isLoading && visibleEntriesArray.length === 0}
            <EmptyState icon="📓" title="No Entries Found" description="No transactions, notes, or balances match your search criteria or active filters." />
        {/if}
        
        {#if !isLoading && visibleEntriesArray.length > 0}
            {#each visibleEntriesArray as entry (entry.id)}
                {#if entry.type === 'transaction'}
                    <TransactionCard
                        {entry}
                        enableUserSnippets={plugin?.settings?.enableUserSnippets}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                        on:create-snippet={(e) => handleCreateSnippet(e.detail)}
                        on:account-click={(e) => handleAccountClick(e.detail?.account, e.detail?.ctrlKey)}
                        on:payee-click={(e) => handlePayeeClick(typeof e.detail === 'string' ? e.detail : e.detail?.payee)}
                        on:view-transactions={(e) => handlePayeeClick(e.detail?.payee)}
                        on:tag-click={(e) => handleTagClick(e.detail?.tag, e.detail?.ctrlKey)}
                    />
                {:else if entry.type === 'balance'}
                    <BalanceCard
                        {entry}
                        on:edit={() => handleEdit(entry)}
                        on:delete={() => handleDelete(entry)}
                        on:account-click={(e) => handleAccountClick(e.detail?.account, e.detail?.ctrlKey)}
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
        padding: 0;
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
        width: 100%;
        padding: 0.4rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.9rem;
    }

    .suggestion-wrapper {
        position: relative;
    }

    .suggestions-list {
        position: absolute;
        z-index: 100;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        max-height: min(16rem, 40vh);
        margin: 0;
        padding: 0.25rem 0;
        overflow-y: auto;
        list-style: none;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
    }

    .suggestions-list li {
        padding: 0.35rem 0.5rem;
        overflow: hidden;
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.9rem;
        line-height: 1.3;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .suggestions-list li:hover {
        background: var(--background-modifier-hover);
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
