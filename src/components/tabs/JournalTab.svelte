<!-- src/components/tabs/JournalTab.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { JournalController, type JournalTransaction, type JournalEntry, type JournalFilters } from '../../controllers/JournalController';
    import { formatCurrency } from '../../utils';
    import TransactionEditModal from '../TransactionEditModal.svelte';

    export let controller: JournalController;

    let entries: JournalEntry[] = [];
    let transactions: JournalTransaction[] = []; // Legacy support
    let loading = false;
    let error: string | null = null;
    let lastUpdated: Date | null = null;
    let apiConnected = false;
    
    // Pagination state
    let currentPage = 1;
    let pageSize = 200;
    let totalCount = 0;
    let hasMore = false;
    
    let currentFilters: JournalFilters = {};
    let showFilters = false;
    let showAllEntryTypes = true; // New toggle for showing all vs just transactions

    // Edit modal state
    let showEditModal = false;
    let editingTransaction: JournalTransaction | null = null;
    let accounts: string[] = [];
    let payees: string[] = [];
    let allTags: string[] = [];

    // Form filter values
    let filterStartDate = '';
    let filterEndDate = '';
    let filterAccount = '';
    let filterPayee = '';
    let filterTag = '';
    let filterSearch = '';
    
    // Entry type filters - focused on journal essentials
    let selectedEntryTypes: string[] = ['transaction', 'balance', 'pad', 'note'];
    let availableEntryTypes = [
        { value: 'transaction', label: 'Transactions', icon: '💰' },
        { value: 'balance', label: 'Balance Assertions', icon: '⚖️' },
        { value: 'pad', label: 'Pad Directives', icon: '�' },
        { value: 'note', label: 'Notes', icon: '�' }
    ];

    // UI state - Remove expandedTransactions since we'll always show details
    // let expandedTransactions: Set<string> = new Set();

    const unsubscribers: (() => void)[] = [];

    onMount(async () => {
        // Controller is passed as prop, no need to create it

        // Subscribe to stores
        unsubscribers.push(
            controller.entries.subscribe(value => entries = value),
            controller.filteredTransactions.subscribe(value => transactions = value),
            controller.loading.subscribe(value => loading = value),
            controller.error.subscribe(value => error = value),
            controller.lastUpdated.subscribe(value => lastUpdated = value),
            controller.filters.subscribe(value => currentFilters = value),
            controller.apiConnected.subscribe(value => apiConnected = value),
            controller.currentPage.subscribe(value => currentPage = value),
            controller.pageSize.subscribe(value => pageSize = value),
            controller.totalCount.subscribe(value => totalCount = value),
            controller.hasMore.subscribe(value => hasMore = value)
        );

        // Load initial data
        await controller.loadAllEntries();
    });

    onDestroy(() => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
    });

    async function handleRefresh() {
        await controller.refresh();
    }

    async function applyFilters() {
        const filters: JournalFilters = {};
        
        if (filterStartDate) filters.startDate = filterStartDate;
        if (filterEndDate) filters.endDate = filterEndDate;
        if (filterAccount) filters.account = filterAccount;
        if (filterPayee) filters.payee = filterPayee;
        if (filterTag) filters.tag = filterTag;
        if (filterSearch) filters.searchTerm = filterSearch;
        if (selectedEntryTypes.length > 0) filters.entryTypes = selectedEntryTypes;

        await controller.updateFilters(filters);
    }

    async function clearFilters() {
        filterStartDate = '';
        filterEndDate = '';
        filterAccount = '';
        filterPayee = '';
        filterTag = '';
        filterSearch = '';
        await controller.clearFilters();
    }

    async function reloadBackend() {
        await controller.reloadBackend();
    }

    // Remove toggle functionality since we'll always show details
    // function toggleTransactionExpanded(transactionId: string) { ... }

    function editTransaction(entry: JournalEntry) {
        // Only allow editing transactions for now
        if (entry.type !== 'transaction') {
            console.warn('Editing is only supported for transactions');
            return;
        }
        
        editingTransaction = entry as JournalTransaction;
        showEditModal = true;
        
        // Load accounts, payees, and tags for the form
        loadFormData();
    }

    async function loadFormData() {
        try {
            // Load accounts, payees, and tags in parallel
            const [accountsResult, payeesResult, tagsResult] = await Promise.all([
                controller.getAccounts(),
                controller.getPayees(),
                controller.getTags()
            ]);
            
            accounts = accountsResult;
            payees = payeesResult;
            allTags = tagsResult;
        } catch (error) {
            console.error('Error loading form data:', error);
        }
    }

    async function handleSaveTransaction(event: CustomEvent) {
        if (!editingTransaction) return;
        
        const updatedData = event.detail;
        const success = await controller.updateTransaction(editingTransaction.id, updatedData);
        
        if (success) {
            showEditModal = false;
            editingTransaction = null;
            // Refresh the view
            await refreshData();
        }
    }

    async function handleDeleteTransaction(event: CustomEvent) {
        if (!editingTransaction) return;
        
        const transactionId = event.detail;
        const success = await controller.deleteTransaction(transactionId);
        
        if (success) {
            showEditModal = false;
            editingTransaction = null;
            // Refresh the view
            await refreshData();
        }
    }

    function handleCancelEdit() {
        showEditModal = false;
        editingTransaction = null;
    }

    function formatDate(dateStr: string): string {
        try {
            return new Date(dateStr).toLocaleDateString();
        } catch {
            return dateStr;
        }
    }

    function formatAmount(amount: string | null, currency: string | null): string {
        if (!amount || !currency) {
            return amount || '';
        }
        
        try {
            const numAmount = parseFloat(amount);
            return formatCurrency(numAmount, currency);
        } catch {
            return `${amount} ${currency}`;
        }
    }

    function getTransactionId(transaction: JournalTransaction): string {
        return transaction.id;
    }

    function formatTags(tags: string[]): string {
        return tags.map(tag => `#${tag}`).join(' ');
    }

    // Pagination functions
    async function nextPage() {
        await controller.nextPage();
    }

    async function previousPage() {
        await controller.previousPage();
    }

    async function goToPage(page: number) {
        await controller.goToPage(page);
    }

    async function changePageSize(newSize: number) {
        await controller.changePageSize(newSize);
    }

    // Calculate pagination info
    $: startRecord = (currentPage - 1) * pageSize + 1;
    $: endRecord = Math.min(currentPage * pageSize, totalCount || (showAllEntryTypes ? entries.length : transactions.length));
    $: totalPages = Math.ceil((totalCount || (showAllEntryTypes ? entries.length : transactions.length)) / pageSize);

    // Functions for all entry types
    function getEntryId(entry: JournalEntry): string {
        return entry.id;
    }

    function getEntryIcon(entryType: string): string {
        const found = availableEntryTypes.find(t => t.value === entryType);
        return found ? found.icon : '📄';
    }

    function getEntryTypeLabel(entryType: string): string {
        const found = availableEntryTypes.find(t => t.value === entryType);
        return found ? found.label : entryType;
    }

    function toggleShowAllEntryTypes() {
        showAllEntryTypes = !showAllEntryTypes;
        updateEntryTypeFilter();
    }

    function updateEntryTypeFilter() {
        if (showAllEntryTypes) {
            selectedEntryTypes = ['transaction', 'balance', 'pad', 'note'];
        } else {
            selectedEntryTypes = ['transaction'];
        }
        applyFilters();
    }

    function toggleEntryType(entryType: string) {
        if (selectedEntryTypes.includes(entryType)) {
            selectedEntryTypes = selectedEntryTypes.filter(t => t !== entryType);
        } else {
            selectedEntryTypes = [...selectedEntryTypes, entryType];
        }
        
        // Update the show all toggle based on selection
        showAllEntryTypes = selectedEntryTypes.length > 1;
        applyFilters();
    }
</script>

<div class="journal-tab">
    <div class="journal-header">
        <div class="header-actions">
            <!-- API Status Indicator -->
            <div class="api-status" class:connected={apiConnected} class:disconnected={!apiConnected}>
                <span class="status-dot"></span>
                <span class="status-text">
                    {apiConnected ? 'API Connected' : 'API Disconnected'}
                </span>
            </div>

            <button 
                class="refresh-btn" 
                on:click={handleRefresh}
                disabled={loading}
                aria-label="Refresh journal data"
            >
                <span class="refresh-icon" class:spinning={loading}>🔄</span>
                Refresh
            </button>

            <button 
                class="reload-backend-btn" 
                on:click={reloadBackend}
                disabled={loading || !apiConnected}
                aria-label="Reload backend data"
                title="Reload Beancount file in backend"
            >
                <span>🔄</span>
                Reload Backend
            </button>
            
            <button 
                class="filter-toggle-btn"
                class:active={showFilters}
                on:click={() => showFilters = !showFilters}
                aria-label="Toggle filters"
            >
                🔍 Filters
            </button>

            <button 
                class="entry-type-toggle-btn"
                class:active={showAllEntryTypes}
                on:click={toggleShowAllEntryTypes}
                aria-label="Toggle between all entries and transactions only"
                title={showAllEntryTypes ? 'Show only transactions' : 'Show all entry types'}
            >
                {showAllEntryTypes ? '📄 All Entries' : '💰 Transactions Only'}
            </button>

            {#if lastUpdated}
                <span class="last-updated">
                    Updated: {lastUpdated.toLocaleTimeString()}
                </span>
            {/if}
        </div>

        <!-- Filters Panel -->
        {#if showFilters}
            <div class="filters-panel">
                <div class="filters-grid">
                    <div class="filter-group">
                        <label for="start-date">Start Date:</label>
                        <input 
                            id="start-date"
                            type="date" 
                            bind:value={filterStartDate}
                            on:change={applyFilters}
                        />
                    </div>

                    <div class="filter-group">
                        <label for="end-date">End Date:</label>
                        <input 
                            id="end-date"
                            type="date" 
                            bind:value={filterEndDate}
                            on:change={applyFilters}
                        />
                    </div>

                    <div class="filter-group">
                        <label for="filter-account">Account:</label>
                        <input 
                            id="filter-account"
                            type="text" 
                            placeholder="e.g. Assets:Cash"
                            bind:value={filterAccount}
                            on:input={applyFilters}
                        />
                    </div>

                    <div class="filter-group">
                        <label for="filter-payee">Payee:</label>
                        <input 
                            id="filter-payee"
                            type="text" 
                            placeholder="e.g. Grocery Store"
                            bind:value={filterPayee}
                            on:input={applyFilters}
                        />
                    </div>

                    <div class="filter-group">
                        <label for="filter-tag">Tag:</label>
                        <input 
                            id="filter-tag"
                            type="text" 
                            placeholder="e.g. food"
                            bind:value={filterTag}
                            on:input={applyFilters}
                        />
                    </div>

                    <div class="filter-group">
                        <label for="filter-search">Search:</label>
                        <input 
                            id="filter-search"
                            type="text" 
                            placeholder="Search in description, payee, accounts..."
                            bind:value={filterSearch}
                            on:input={applyFilters}
                        />
                    </div>
                </div>

                <!-- Entry Type Filters -->
                {#if showAllEntryTypes}
                    <div class="entry-type-filters">
                        <h4>Entry Types:</h4>
                        <div class="entry-type-grid">
                            {#each availableEntryTypes as entryType}
                                <label class="entry-type-checkbox">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedEntryTypes.includes(entryType.value)}
                                        on:change={() => toggleEntryType(entryType.value)}
                                    />
                                    <span class="entry-type-icon">{entryType.icon}</span>
                                    <span class="entry-type-label">{entryType.label}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                {/if}

                <div class="filter-actions">
                    <button class="clear-filters-btn" on:click={clearFilters}>
                        Clear All Filters
                    </button>
                </div>
            </div>
        {/if}
    </div>

    <div class="journal-content">
        {#if !apiConnected && !loading}
            <div class="api-disconnected-state">
                <h3>Backend API Starting...</h3>
                <p>The Python backend is starting automatically. This may take a few moments.</p>
                <div class="api-instructions">
                    <h4>Requirements:</h4>
                    <ul>
                        <li><strong>Python 3.8+</strong> installed and available in PATH</li>
                        <li><strong>Beancount</strong> package installed (<code>pip install beancount</code>)</li>
                        <li><strong>Flask</strong> and <strong>flask-cors</strong> will be installed automatically</li>
                    </ul>
                    <h4>If the backend fails to start:</h4>
                    <ol>
                        <li>Ensure Python and Beancount are properly installed</li>
                        <li>Check the console for error messages</li>
                        <li>Verify your Beancount file path is correct in settings</li>
                        <li>Click "Try to Connect" to retry</li>
                    </ol>
                </div>
                <button class="retry-connection-btn" on:click={handleRefresh}>
                    Try to Connect
                </button>
            </div>
        {:else if loading}
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading journal entries...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <h3>Error Loading Journal</h3>
                <p>{error}</p>
                <button on:click={handleRefresh}>Try Again</button>
            </div>
        {:else if transactions.length === 0}
            <div class="empty-state">
                <h3>No Transactions Found</h3>
                <p>No transactions match your current filters.</p>
                {#if Object.keys(currentFilters).length > 0}
                    <button on:click={clearFilters}>Clear Filters</button>
                {/if}
            </div>
        {:else}
            <div class="transactions-list">
                <div class="list-header">
                    <div class="transaction-count">
                        {#if totalCount > 0}
                            Showing {startRecord}-{endRecord} of {totalCount} transaction{totalCount !== 1 ? 's' : ''}
                        {:else}
                            Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                        {/if}
                    </div>
                    
                    <div class="pagination-controls">
                        <div class="page-size-selector">
                            <label for="page-size">Per page:</label>
                            <select 
                                id="page-size" 
                                bind:value={pageSize} 
                                on:change={() => changePageSize(pageSize)}
                            >
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                                <option value={500}>500</option>
                            </select>
                        </div>
                        
                        <div class="page-navigation">
                            <button 
                                class="page-btn"
                                on:click={previousPage}
                                disabled={currentPage <= 1 || loading}
                                aria-label="Previous page"
                            >
                                ← Previous
                            </button>
                            
                            <span class="page-info">
                                Page {currentPage} {totalPages > 0 ? `of ${totalPages}` : ''}
                            </span>
                            
                            <button 
                                class="page-btn"
                                on:click={nextPage}
                                disabled={!hasMore || loading}
                                aria-label="Next page"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>

                {#each (showAllEntryTypes ? entries : transactions) as entry (getEntryId(entry))}
                    {@const entryId = getEntryId(entry)}
                    
                    <div class="entry-item entry-{entry.type}">
                        <!-- Entry Header -->
                        <div class="entry-header">
                            <div class="entry-meta">
                                <span class="entry-type-badge">
                                    <span class="entry-icon">{getEntryIcon(entry.type)}</span>
                                    <span class="entry-type-name">{getEntryTypeLabel(entry.type)}</span>
                                </span>
                                <span class="entry-date">{formatDate(entry.date)}</span>
                                
                                <!-- Type-specific header content -->
                                {#if entry.type === 'transaction'}
                                    <span class="transaction-flag">{entry.flag}</span>
                                    {#if entry.payee}
                                        <span class="transaction-payee">"{entry.payee}"</span>
                                    {/if}
                                    <span class="transaction-narration">"{entry.narration}"</span>
                                    {#if entry.tags && entry.tags.length > 0}
                                        <span class="transaction-tags">{formatTags(entry.tags)}</span>
                                    {/if}
                                {:else if entry.type === 'note'}
                                    <span class="note-account">{entry.account}</span>
                                    <span class="note-comment">"{entry.comment}"</span>
                                {:else if entry.type === 'balance'}
                                    <span class="balance-account">{entry.account}</span>
                                    <span class="balance-amount">{entry.amount} {entry.currency}</span>
                                {:else if entry.type === 'pad'}
                                    <span class="pad-account">{entry.account}</span>
                                    <span class="pad-source">← {entry.source_account}</span>
                                {/if}
                            </div>
                            
                            <div class="entry-actions">
                                <button 
                                    class="edit-entry-btn"
                                    on:click={() => editTransaction(entry)}
                                    aria-label="Edit {entry.type}"
                                    title="Edit this {entry.type}"
                                >
                                    ✏️ Edit
                                </button>
                            </div>
                        </div>

                        <!-- Entry Details (Always Visible for transactions) -->
                        {#if entry.type === 'transaction'}
                            <div class="entry-details">
                                <div class="postings-list">
                                    {#each entry.postings as posting}
                                        <div class="posting-entry">
                                            <span class="posting-account">{posting.account}</span>
                                            <span class="posting-amount">
                                                {formatAmount(posting.amount, posting.currency)}
                                            </span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Transaction Edit Modal -->
{#if showEditModal && editingTransaction}
    <div class="modal-overlay" on:click={handleCancelEdit}>
        <div class="modal-container" on:click|stopPropagation>
            <TransactionEditModal 
                transaction={editingTransaction}
                {accounts}
                {payees}
                tags={allTags}
                on:save={handleSaveTransaction}
                on:delete={handleDeleteTransaction}
                on:cancel={handleCancelEdit}
            />
        </div>
    </div>
{/if}

<style>
    .journal-tab {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .journal-header {
        padding: 1rem;
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.5rem;
    }

    .refresh-btn, .filter-toggle-btn, .clear-filters-btn, .reload-backend-btn, .retry-connection-btn {
        padding: 0.5rem 1rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-normal);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s ease;
    }

    .refresh-btn:hover, .filter-toggle-btn:hover, .clear-filters-btn:hover, 
    .reload-backend-btn:hover, .retry-connection-btn:hover {
        background: var(--interactive-hover);
    }

    .refresh-btn:disabled, .reload-backend-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .filter-toggle-btn.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .refresh-icon {
        display: inline-block;
        margin-right: 0.5rem;
    }

    .refresh-icon.spinning {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .last-updated {
        font-size: 0.8rem;
        color: var(--text-muted);
        margin-left: auto;
    }

    /* API Status Indicator */
    .api-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .api-status.connected {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
        border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .api-status.disconnected {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
    }

    .reload-backend-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .reload-backend-btn:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    /* Filters Panel */
    .filters-panel {
        margin-top: 1rem;
        padding: 1rem;
        background: var(--background-primary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
    }

    .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .filter-group label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-normal);
    }

    .filter-group input {
        padding: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.9rem;
    }

    .filter-group input:focus {
        outline: none;
        border-color: var(--interactive-accent);
    }

    .filter-actions {
        display: flex;
        justify-content: flex-end;
    }

    /* Content Area */
    .journal-content {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
    }

    /* List Header with Pagination */
    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding: 0.75rem;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        flex-wrap: wrap;
        gap: 1rem;
    }

    .transaction-count {
        font-size: 0.9rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .pagination-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .page-size-selector {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
    }

    .page-size-selector label {
        color: var(--text-muted);
        font-weight: 500;
    }

    .page-size-selector select {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.85rem;
        cursor: pointer;
    }

    .page-navigation {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .page-btn {
        padding: 0.4rem 0.8rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-normal);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .page-btn:hover:not(:disabled) {
        background: var(--interactive-hover);
        border-color: var(--interactive-accent);
    }

    .page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .page-info {
        font-size: 0.85rem;
        color: var(--text-muted);
        font-weight: 500;
        white-space: nowrap;
    }

    /* Transaction Entries */
    .transaction-entry {
        margin-bottom: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .transaction-entry:hover {
        border-color: var(--interactive-accent);
    }

    .transaction-header {
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--background-primary);
    }

    .transaction-meta {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        flex: 1;
    }

    .transaction-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .edit-transaction-btn {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-normal);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .edit-transaction-btn:hover {
        background: var(--interactive-hover);
        border-color: var(--interactive-accent);
    }

    .transaction-date {
        font-weight: 600;
        color: var(--text-accent);
        font-family: var(--font-monospace);
    }

    .transaction-flag {
        font-weight: bold;
        color: var(--text-normal);
        font-family: var(--font-monospace);
    }

    .transaction-payee {
        color: var(--text-normal);
        font-style: italic;
    }

    .transaction-narration {
        color: var(--text-normal);
        font-weight: 500;
    }

    .transaction-tags {
        color: var(--text-accent);
        font-size: 0.85rem;
    }

    /* Transaction Details */
    .transaction-details {
        border-top: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
    }

    .postings-list {
        padding: 1rem;
    }

    .posting-entry {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        margin-bottom: 0.25rem;
        background: var(--background-primary);
        border-radius: 4px;
        font-family: var(--font-monospace);
        font-size: 0.9rem;
    }

    .posting-account {
        color: var(--text-normal);
        flex: 1;
    }

    .posting-amount {
        color: var(--text-accent);
        font-weight: 600;
        text-align: right;
        white-space: nowrap;
    }

    /* States */
    .loading-state, .error-state, .empty-state, .api-disconnected-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        text-align: center;
        min-height: 200px;
    }

    .api-disconnected-state {
        max-width: 600px;
        margin: 0 auto;
    }

    .api-disconnected-state h3 {
        color: var(--text-error);
        margin-bottom: 1rem;
    }

    .api-disconnected-state p {
        color: var(--text-muted);
        margin-bottom: 1.5rem;
    }

    .api-instructions {
        background: var(--background-secondary);
        padding: 1.5rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        text-align: left;
    }

    .api-instructions h4 {
        margin-bottom: 1rem;
        color: var(--text-normal);
    }

    .api-instructions ol, .api-instructions ul {
        margin-left: 1.5rem;
        color: var(--text-normal);
    }

    .api-instructions li {
        margin-bottom: 0.5rem;
    }

    .api-instructions code {
        background: var(--background-primary);
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: var(--font-monospace);
        font-size: 0.85rem;
    }

    .retry-connection-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        font-weight: 600;
    }

    .loading-spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid var(--background-modifier-border);
        border-top: 3px solid var(--interactive-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    .error-state h3 {
        color: var(--text-error);
        margin-bottom: 0.5rem;
    }

    .empty-state h3 {
        color: var(--text-muted);
        margin-bottom: 0.5rem;
    }

    /* Entry Type Filters */
    .entry-type-toggle-btn {
        padding: 0.5rem 1rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-normal);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s ease;
    }

    .entry-type-toggle-btn:hover {
        background: var(--interactive-hover);
    }

    .entry-type-toggle-btn.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .entry-type-filters {
        margin-top: 1rem;
        padding: 1rem;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
    }

    .entry-type-filters h4 {
        margin-bottom: 0.75rem;
        color: var(--text-normal);
        font-size: 0.9rem;
    }

    .entry-type-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.5rem;
    }

    .entry-type-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        font-size: 0.85rem;
    }

    .entry-type-checkbox:hover {
        background: var(--background-primary);
    }

    .entry-type-checkbox input[type="checkbox"] {
        margin: 0;
    }

    .entry-type-icon {
        font-size: 1rem;
    }

    .entry-type-label {
        color: var(--text-normal);
    }

    /* Entry Display Styles */
    .entry-item {
        margin-bottom: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .entry-item:hover {
        border-color: var(--interactive-accent);
    }

    .entry-header {
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--background-primary);
    }

    .entry-meta {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        flex: 1;
    }

    .entry-type-badge {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.6rem;
        background: var(--background-secondary);
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
    }

    .entry-icon {
        font-size: 0.85rem;
    }

    .entry-type-name {
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .entry-date {
        font-weight: 600;
        color: var(--text-accent);
        font-family: var(--font-monospace);
    }

    /* Type-specific styles */
    .entry-balance .entry-type-badge {
        background: var(--color-yellow);
        color: var(--text-on-accent);
    }

    .entry-pad .entry-type-badge {
        background: var(--color-blue);
        color: var(--text-on-accent);
    }

    .entry-note .entry-type-badge {
        background: var(--color-green);
        color: var(--text-on-accent);
    }

    .note-account, .balance-account, .pad-account {
        font-family: var(--font-monospace);
        color: var(--text-normal);
        font-weight: 500;
    }

    .note-comment {
        color: var(--text-muted);
        font-style: italic;
    }

    .balance-amount {
        font-family: var(--font-monospace);
        color: var(--text-accent);
        font-weight: 600;
    }

    .pad-source {
        font-family: var(--font-monospace);
        color: var(--text-muted);
    }

    .entry-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .edit-entry-btn {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-normal);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .edit-entry-btn:hover {
        background: var(--interactive-hover);
        border-color: var(--interactive-accent);
    }

    .entry-details {
        border-top: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .filters-grid {
            grid-template-columns: 1fr;
        }
        
        .transaction-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }
        
        .transaction-meta {
            font-size: 0.85rem;
        }
        
        .posting-entry {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
        }
    }

    /* Modal Styling */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-container {
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow: hidden;
    }
</style>