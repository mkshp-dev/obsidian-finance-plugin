<script lang="ts">
    import { onMount } from 'svelte';
    import { debounce } from '../../../utils/index';

    // Instead of importing Controller, we receive the Store
    export let store: any;

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

    const updateFiltersDebounced = debounce(() => {
        applyFilters();
    }, 500);

    function applyFilters() {
        const newFilters: any = {};
        if (searchTerm) newFilters.searchTerm = searchTerm;
        if (selectedAccount) newFilters.account = selectedAccount;
        if (startDate) newFilters.startDate = startDate;
        if (endDate) newFilters.endDate = endDate;
        if (payeeFilter) newFilters.payee = payeeFilter;
        if (tagFilter) newFilters.tag = tagFilter;

        if (typeFilter !== 'all') {
            newFilters.entryTypes = [typeFilter];
        } else {
            newFilters.entryTypes = undefined; // clear it
        }

        // We need to merge with empty object to ensure we clear old filters if they are now empty
        // Actually setFilters merges. To clear, we should use setFilters with explicit undefineds or clearFilters then set.
        // But JournalStore.setFilters does a merge.
        // Let's just pass what we have. If a user clears an input, we pass empty string?
        // JournalService checks `if (filters.account)` so empty string is ignored.
        // So we need to ensure we don't persist old values.

        // Better approach: clear all then set new.
        // But that triggers two loads.
        // Let's just update the store with all keys.

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

    function formatDate(dateStr: string) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString();
    }

    function formatEntryType(type: string) {
        switch(type) {
            case 'transaction': return 'TXN';
            case 'note': return 'NOTE';
            case 'pad': return 'PAD';
            case 'balance': return 'BAL';
            default: return type.toUpperCase();
        }
    }

    function getEntryDescription(entry: any) {
        if (entry.type === 'transaction') {
            return `${entry.payee ? entry.payee + ' | ' : ''}${entry.narration || ''}`;
        }
        if (entry.type === 'note') {
            return `${entry.account}: ${entry.comment}`;
        }
        if (entry.type === 'balance') {
            return `Balance ${entry.account}: ${entry.amount} ${entry.currency}`;
        }
        if (entry.type === 'pad') {
            return `Pad ${entry.account} from ${entry.source_account}`;
        }
        return '';
    }

    onMount(() => {
        loadEntries();
    });
</script>

<div class="journal-tab">
    <!-- Filters Toolbar -->
    <div class="filters-container">
        <div class="filter-row">
            <div class="filter-group">
                <label for="search">Search</label>
                <input type="text" id="search" bind:value={searchTerm} on:input={updateFiltersDebounced} placeholder="Search..." />
            </div>
            <div class="filter-group">
                <label for="type">Type</label>
                <select id="type" bind:value={typeFilter} on:change={applyFilters}>
                    <option value="all">All Types</option>
                    <option value="transaction">Transactions</option>
                    <option value="note">Notes</option>
                    <option value="balance">Balances</option>
                    <option value="pad">Pads</option>
                </select>
            </div>
             <div class="filter-group">
                <label for="account">Account</label>
                <input type="text" id="account" bind:value={selectedAccount} on:input={updateFiltersDebounced} placeholder="Account..." />
            </div>
        </div>

        <div class="filter-row">
             <div class="filter-group">
                <label for="start">From</label>
                <input type="date" id="start" bind:value={startDate} on:change={applyFilters} />
            </div>
             <div class="filter-group">
                <label for="end">To</label>
                <input type="date" id="end" bind:value={endDate} on:change={applyFilters} />
            </div>
            <div class="filter-group">
                <label for="payee">Payee</label>
                <input type="text" id="payee" bind:value={payeeFilter} on:input={updateFiltersDebounced} placeholder="Payee..." />
            </div>
            <div class="filter-group">
                <label for="tag">Tag</label>
                <input type="text" id="tag" bind:value={tagFilter} on:input={updateFiltersDebounced} placeholder="Tag..." />
            </div>
            <div class="filter-actions">
                 <button class="btn" on:click={handleClear}>Clear</button>
                 <button class="btn btn-primary" on:click={() => refresh()}>Refresh</button>
            </div>
        </div>
    </div>

    <!-- Error Banner -->
    {#if $error}
        <div class="error-banner">
            <span class="font-medium">Error:</span> {$error}
        </div>
    {/if}

    <!-- Table -->
    <div class="table-container">
        <table class="journal-table">
            <thead>
                <tr>
                    <th class="col-date">Date</th>
                    <th class="col-type">Type</th>
                    <th class="col-desc">Description</th>
                    <th class="col-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                {#if $loading}
                    <tr>
                        <td colspan="4" class="text-center py-8">Loading...</td>
                    </tr>
                {:else if $entries.length === 0}
                    <tr>
                        <td colspan="4" class="text-center py-8">No entries found.</td>
                    </tr>
                {:else}
                    {#each $entries as entry}
                        <tr>
                            <td class="col-date">{formatDate(entry.date)}</td>
                            <td class="col-type">
                                <span class="badge badge-{entry.type}">{formatEntryType(entry.type)}</span>
                            </td>
                            <td class="col-desc">
                                {getEntryDescription(entry)}
                            </td>
                            <td class="col-actions">
                                {#if entry.type === 'transaction'}
                                    <button class="action-btn delete-btn" title="Delete" on:click={() => deleteTransaction(entry.id)}>
                                        🗑️
                                    </button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    <div class="pagination-container">
        <span class="pagination-info">
            Showing <span class="font-semibold">{($currentPage - 1) * $pageSize + 1}</span> to <span class="font-semibold">{Math.min($currentPage * $pageSize, $totalCount)}</span> of <span class="font-semibold">{$totalCount}</span>
        </span>
        <div class="pagination-controls">
            <button class="btn-small" on:click={() => setPage($currentPage - 1)} disabled={$currentPage === 1}>
                Previous
            </button>
            <button class="btn-small" on:click={() => setPage($currentPage + 1)} disabled={!$hasMore}>
                Next
            </button>
        </div>
    </div>
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
        color: var(--text-error);
        border-radius: 6px;
        border: 1px solid var(--text-error);
    }

    .table-container {
        flex: 1;
        overflow-y: auto;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
    }

    .journal-table {
        width: 100%;
        border-collapse: collapse;
    }

    .journal-table th {
        text-align: left;
        padding: 0.75rem;
        background: var(--background-secondary);
        color: var(--text-muted);
        font-weight: 600;
        font-size: 0.85rem;
        position: sticky;
        top: 0;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .journal-table td {
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid var(--background-modifier-border);
        font-size: 0.9rem;
        color: var(--text-normal);
    }

    .journal-table tr:hover {
        background-color: var(--background-modifier-hover);
    }

    .col-date { width: 100px; font-family: var(--font-monospace); }
    .col-type { width: 80px; }
    .col-desc { flex: 1; font-family: var(--font-monospace); }
    .col-actions { width: 60px; text-align: center; }

    .badge {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .badge-transaction { background: var(--interactive-accent); color: var(--text-on-accent); }
    .badge-note { background: var(--text-muted); color: var(--text-on-accent); }
    .badge-balance { background: var(--color-purple); color: var(--text-on-accent); }
    .badge-pad { background: var(--color-orange); color: var(--text-on-accent); }

    .action-btn {
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.6;
        padding: 4px;
    }

    .action-btn:hover {
        opacity: 1;
        background-color: var(--background-modifier-hover);
        border-radius: 4px;
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

    .text-center { text-align: center; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
</style>
