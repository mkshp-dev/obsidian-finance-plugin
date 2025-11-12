<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { JournalTransaction, JournalPosting, JournalEntry, JournalBalance, JournalNote } from '../controllers/JournalController';
    
    export let transaction: JournalTransaction | null = null; // Now optional for Add mode
    export let entry: JournalEntry | null = null; // Support for any entry type
    export let accounts: string[] = [];
    export let payees: string[] = [];
    export let tags: string[] = [];
    export let currencies: string[] = []; // Add currencies prop
    export let mode: 'add' | 'edit' = (transaction || entry) ? 'edit' : 'add'; // Auto-detect mode
    export let defaultCurrency: string = 'INR';
    
    const dispatch = createEventDispatcher();
    
    // Entry type tabs
    let activeTab: 'transaction' | 'balance' | 'note' = 'transaction';
    
    // Initialize active tab based on existing entry
    if (entry) {
        activeTab = entry.type === 'pad' ? 'balance' : entry.type as 'transaction' | 'balance' | 'note';
    } else if (transaction) {
        activeTab = 'transaction';
    }
    
    // Common fields for all entry types
    let date = (transaction?.date || entry?.date) || new Date().toISOString().split('T')[0];
    
    // Transaction-specific fields
    let payee = transaction?.payee || '';
    let narration = transaction?.narration || '';
    let postings: JournalPosting[] = transaction ? [...transaction.postings] : [
        { account: '', amount: null, currency: defaultCurrency, price: null, cost: null },
        { account: '', amount: null, currency: defaultCurrency, price: null, cost: null }
    ];
    let selectedTags: string[] = transaction ? [...transaction.tags] : [];
    let links: string[] = transaction ? [...transaction.links] : [];
    
    // Balance-specific fields
    let balanceAccount = (entry?.type === 'balance') ? (entry as JournalBalance).account : '';
    let balanceAmount = (entry?.type === 'balance') ? (entry as JournalBalance).amount : '';
    let balanceCurrency = (entry?.type === 'balance') ? (entry as JournalBalance).currency : defaultCurrency;
    let balanceTolerance = (entry?.type === 'balance') ? (entry as JournalBalance).tolerance : '';
    
    // Note-specific fields
    let noteAccount = (entry?.type === 'note') ? (entry as JournalNote).account : '';
    let noteComment = (entry?.type === 'note') ? (entry as JournalNote).comment : '';
    
    // UI state
    let saving = false;
    let deleting = false;
    let showDeleteConfirm = false;
    let errors: string[] = [];
    
    // Add a new posting
    function addPosting() {
        postings = [...postings, {
            account: '',
            amount: null,
            currency: 'INR',
            price: null,
            cost: null
        }];
    }
    
    // Remove a posting
    function removePosting(index: number) {
        if (postings.length > 2) {
            postings = postings.filter((_, i) => i !== index);
        }
    }
    
    // Validate form
    function validateForm(): boolean {
        errors = [];
        
        if (!date) errors.push('Date is required');
        
        if (activeTab === 'transaction') {
            if (!narration) errors.push('Narration is required');
            if (postings.length < 2) errors.push('At least 2 postings are required');
            
            for (let i = 0; i < postings.length; i++) {
                if (!postings[i].account) {
                    errors.push(`Posting ${i + 1}: Account is required`);
                }
            }
            
            // Check if amounts balance (if all postings have amounts)
            const postingsWithAmounts = postings.filter(p => p.amount !== null && p.amount !== '');
            if (postingsWithAmounts.length === postings.length) {
                const total = postingsWithAmounts.reduce((sum, p) => {
                    return sum + parseFloat(p.amount || '0');
                }, 0);
                
                if (Math.abs(total) > 0.01) {
                    errors.push('Transaction postings must balance (sum to zero)');
                }
            }
        } else if (activeTab === 'balance') {
            if (!balanceAccount) errors.push('Account is required for balance assertion');
            if (!balanceAmount) errors.push('Amount is required for balance assertion');
            if (!balanceCurrency) errors.push('Currency is required for balance assertion');
        } else if (activeTab === 'note') {
            if (!noteAccount) errors.push('Account is required for note');
            if (!noteComment) errors.push('Comment is required for note');
        }
        
        return errors.length === 0;
    }
    
    // Save entry (transaction, balance, or note)
    async function saveEntry() {
        if (!validateForm()) return;
        
        saving = true;
        
        let entryData: any;
        
        if (activeTab === 'transaction') {
            entryData = {
                type: 'transaction',
                date,
                payee: payee || null,
                narration,
                postings: postings.map(p => ({
                    account: p.account,
                    amount: p.amount,
                    currency: p.currency,
                    price: p.price,
                    cost: p.cost
                })),
                tags: selectedTags,
                links
            };
        } else if (activeTab === 'balance') {
            entryData = {
                type: 'balance',
                date,
                account: balanceAccount,
                amount: balanceAmount,
                currency: balanceCurrency,
                tolerance: balanceTolerance || null
            };
        } else if (activeTab === 'note') {
            entryData = {
                type: 'note',
                date,
                account: noteAccount,
                comment: noteComment
            };
        }
        
        if (mode === 'edit') {
            dispatch('save', entryData);
        } else {
            dispatch('add', entryData);
        }
        
        saving = false;
    }
    
    // Cancel editing
    function cancel() {
        dispatch('cancel');
    }
    
    // Handle tag input
    function handleTagInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        if (event instanceof KeyboardEvent && event.key === 'Enter' && value.trim()) {
            event.preventDefault();
            if (!selectedTags.includes(value.trim())) {
                selectedTags = [...selectedTags, value.trim()];
            }
            target.value = '';
        }
    }
    
    // Remove tag
    function removeTag(tag: string) {
        selectedTags = selectedTags.filter(t => t !== tag);
    }
    
    // Handle link input
    function handleLinkInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        
        if (event instanceof KeyboardEvent && event.key === 'Enter' && value.trim()) {
            const trimmedValue = value.trim();
            if (!links.includes(trimmedValue)) {
                links = [...links, trimmedValue];
            }
            target.value = '';
        }
    }
    
    // Remove link
    function removeLink(link: string) {
        links = links.filter(l => l !== link);
    }
    
    // Delete transaction (only available in edit mode)
    function confirmDelete() {
        if (mode !== 'edit' || !transaction) return;
        showDeleteConfirm = true;
    }
    
    function cancelDelete() {
        showDeleteConfirm = false;
    }
    
    async function deleteEntry() {
        if (mode !== 'edit' || (!transaction && !entry)) return;
        deleting = true;
        const entryId = transaction?.id || entry?.id;
        dispatch('delete', entryId);
        deleting = false;
    }
</script>

<div class="transaction-edit-modal">
    <div class="modal-header">
        <h3>{mode === 'edit' ? `Edit ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` : `Add ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}</h3>
        <button class="modal-close" on:click={cancel}>&times;</button>
    </div>
    
    <div class="modal-content">
        <!-- Entry Type Tabs -->
        {#if mode === 'add'}
            <div class="entry-tabs">
                <button 
                    class="tab-button {activeTab === 'transaction' ? 'active' : ''}"
                    on:click={() => activeTab = 'transaction'}
                >
                    💰 Transaction
                </button>
                <button 
                    class="tab-button {activeTab === 'balance' ? 'active' : ''}"
                    on:click={() => activeTab = 'balance'}
                >
                    ⚖️ Balance
                </button>
                <button 
                    class="tab-button {activeTab === 'note' ? 'active' : ''}"
                    on:click={() => activeTab = 'note'}
                >
                    📝 Note
                </button>
            </div>
        {/if}
        
        {#if errors.length > 0}
            <div class="errors">
                {#each errors as error}
                    <div class="error">{error}</div>
                {/each}
            </div>
        {/if}
        
        <!-- Common Date Field -->
        <div class="form-group">
            <label for="date">Date *</label>
            <input type="date" id="date" bind:value={date} required />
        </div>
        
        <!-- Transaction Form -->
        {#if activeTab === 'transaction'}
            <div class="form-grid">
                <!-- Payee and Narration -->
                <div class="form-group full-width">
                    <label for="payee">Payee</label>
                    <input 
                        type="text" 
                        id="payee" 
                        bind:value={payee}
                        list="payees-list"
                        placeholder="Optional payee name"
                    />
                    <datalist id="payees-list">
                        {#each payees as payeeOption}
                            <option value={payeeOption} />
                        {/each}
                    </datalist>
                </div>
                
                <div class="form-group full-width">
                    <label for="narration">Narration *</label>
                    <input 
                        type="text" 
                        id="narration" 
                        bind:value={narration}
                        placeholder="Transaction description"
                        required
                    />
                </div>
            </div>
            
            <!-- Postings -->
            <div class="postings-section">
                <h4>Postings</h4>
                {#each postings as posting, index}
                    <div class="posting-row">
                        <div class="posting-account">
                            <label>Account *</label>
                            <input 
                                type="text" 
                                bind:value={posting.account}
                                list="accounts-list"
                                placeholder="Account name"
                                required
                            />
                        </div>
                        
                        <div class="posting-amount">
                            <label>Amount</label>
                            <input 
                                type="number" 
                                step="0.01"
                                bind:value={posting.amount}
                                placeholder="Optional amount"
                            />
                        </div>
                        
                        <div class="posting-currency">
                            <label>Currency</label>
                            <input 
                                type="text" 
                                bind:value={posting.currency}
                                list="currencies-list"
                                placeholder="INR"
                                maxlength="3"
                            />
                        </div>
                        
                        <div class="posting-actions">
                            {#if postings.length > 2}
                                <button type="button" class="remove-posting" on:click={() => removePosting(index)}>
                                    🗑️
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
                
                <button type="button" class="add-posting" on:click={addPosting}>
                    + Add Posting
                </button>
            </div>
            
            <!-- Tags and Links -->
            <div class="form-grid">
                <div class="form-group full-width">
                    <label for="tags">Tags</label>
                    <input 
                        type="text" 
                        id="tags"
                        on:keydown={handleTagInput}
                        list="tags-list"
                        placeholder="Type tag and press Enter"
                    />
                    <datalist id="tags-list">
                        {#each tags as tag}
                            <option value={tag} />
                        {/each}
                    </datalist>
                    
                    {#if selectedTags.length > 0}
                        <div class="selected-tags">
                            {#each selectedTags as tag}
                                <span class="tag">
                                    #{tag}
                                    <button type="button" on:click={() => removeTag(tag)}>&times;</button>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
                
                <div class="form-group full-width">
                    <label for="links">Links</label>
                    <input 
                        type="text" 
                        id="links"
                        on:input={handleLinkInput}
                        placeholder="Add links (comma-separated)"
                    />
                    
                    {#if links.length > 0}
                        <div class="selected-links">
                            {#each links as link}
                                <span class="link">
                                    ^{link}
                                    <button type="button" on:click={() => removeLink(link)}>&times;</button>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
        
        <!-- Balance Form -->
        {#if activeTab === 'balance'}
            <div class="form-grid">
                <div class="form-group full-width">
                    <label for="balance-account">Account *</label>
                    <input 
                        type="text" 
                        id="balance-account" 
                        bind:value={balanceAccount}
                        list="accounts-list"
                        placeholder="Account to check balance"
                        required
                    />
                </div>
                
                <div class="form-group">
                    <label for="balance-amount">Amount *</label>
                    <input 
                        type="number" 
                        step="0.01"
                        id="balance-amount" 
                        bind:value={balanceAmount}
                        placeholder="Expected balance"
                        required
                    />
                </div>
                
                <div class="form-group">
                    <label for="balance-currency">Currency *</label>
                    <input 
                        type="text" 
                        id="balance-currency" 
                        bind:value={balanceCurrency}
                        list="currencies-list"
                        placeholder="INR"
                        maxlength="3"
                        required
                    />
                </div>
                
                <div class="form-group full-width">
                    <label for="balance-tolerance">Tolerance</label>
                    <input 
                        type="number" 
                        step="0.01"
                        id="balance-tolerance" 
                        bind:value={balanceTolerance}
                        placeholder="Optional tolerance amount"
                    />
                </div>
            </div>
        {/if}
        
        <!-- Note Form -->
        {#if activeTab === 'note'}
            <div class="form-grid">
                <div class="form-group full-width">
                    <label for="note-account">Account *</label>
                    <input 
                        type="text" 
                        id="note-account" 
                        bind:value={noteAccount}
                        list="accounts-list"
                        placeholder="Account for the note"
                        required
                    />
                </div>
                
                <div class="form-group full-width">
                    <label for="note-comment">Comment *</label>
                    <textarea 
                        id="note-comment" 
                        bind:value={noteComment}
                        placeholder="Note content"
                        required
                        rows="3"
                    ></textarea>
                </div>
            </div>
        {/if}
        
        <!-- Shared accounts datalist -->
        <datalist id="accounts-list">
            {#each accounts as account}
                <option value={account} />
            {/each}
        </datalist>
        
        <!-- Shared currencies datalist -->
        <datalist id="currencies-list">
            {#each currencies as currency}
                <option value={currency} />
            {/each}
        </datalist>
    </div>
    
    <!-- Modal Footer -->
    <div class="modal-footer">
        <div class="footer-left">
            {#if mode === 'edit'}
                <button 
                    type="button" 
                    class="btn-danger" 
                    on:click={confirmDelete}
                    disabled={deleting}
                >
                    {deleting ? 'Deleting...' : 'Delete'}
                </button>
            {/if}
        </div>
        
        <div class="footer-right">
            <button type="button" class="btn-secondary" on:click={cancel}>
                Cancel
            </button>
            <button 
                type="button" 
                class="btn-primary" 
                on:click={saveEntry}
                disabled={saving}
            >
                {saving ? 'Saving...' : (mode === 'edit' ? 'Save Changes' : `Add ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`)}
            </button>
        </div>
    </div>
</div>

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm}
    <div class="confirm-overlay" on:click={cancelDelete}>
        <div class="confirm-dialog" on:click|stopPropagation>
            <h4>Delete {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h4>
            <p>Are you sure you want to delete this {activeTab}? This action cannot be undone.</p>
            <div class="confirm-actions">
                <button type="button" class="btn-secondary" on:click={cancelDelete}>
                    Cancel
                </button>
                <button type="button" class="btn-danger" on:click={deleteEntry}>
                    Delete
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .transaction-edit-modal {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        margin: 0; /* Remove margin since modal handles positioning */
        width: 100%; /* Use full width of modal container */
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
    }
    
    .modal-header h3 {
        margin: 0;
        color: var(--text-normal);
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--text-muted);
        padding: 0.25rem;
        border-radius: 4px;
    }
    
    .modal-close:hover {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
    }
    
    .modal-content {
        padding: 1.5rem;
    }
    
    .errors {
        background: var(--background-modifier-error);
        border: 1px solid var(--text-error);
        border-radius: 4px;
        padding: 1rem;
        margin-bottom: 1rem;
    }
    
    .error {
        color: var(--text-error);
        margin: 0.25rem 0;
    }
    
    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .form-group {
        display: flex;
        flex-direction: column;
    }
    
    .form-group.full-width {
        grid-column: 1 / -1;
    }
    
    .form-group label {
        font-weight: 500;
        margin-bottom: 0.5rem;
        color: var(--text-normal);
    }
    
    .form-group input {
        padding: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
    }
    
    .form-group input:focus {
        outline: none;
        border-color: var(--interactive-accent);
    }
    
    .postings-section {
        margin-bottom: 1.5rem;
    }
    
    .postings-section h4 {
        margin: 0 0 1rem 0;
        color: var(--text-normal);
    }
    
    .posting-row {
        display: grid;
        grid-template-columns: 3fr 1.2fr 1fr auto; /* Give more space to account field and amount */
        gap: 1rem; /* Increased gap from 0.75rem to 1rem */
        align-items: end;
        margin-bottom: 1rem;
        padding: 1.25rem; /* Increased padding from 1rem to 1.25rem */
        background: var(--background-secondary);
        border-radius: 6px;
    }
    
    .posting-account,
    .posting-amount,
    .posting-currency {
        display: flex;
        flex-direction: column;
    }
    
    .posting-account label,
    .posting-amount label,
    .posting-currency label {
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
        color: var(--text-muted);
    }
    
    .posting-account input,
    .posting-amount input,
    .posting-currency input {
        padding: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
    }
    
    .remove-posting {
        background: var(--background-modifier-error);
        color: var(--text-error);
        border: none;
        border-radius: 4px;
        width: 2rem;
        height: 2rem;
        cursor: pointer;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .remove-posting:hover:not(:disabled) {
        background: var(--text-error);
        color: var(--text-on-accent);
    }
    
    .remove-posting:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .add-posting {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        padding: 0.75rem 1rem;
        cursor: pointer;
        font-weight: 500;
    }
    
    .add-posting:hover {
        background: var(--interactive-accent-hover);
    }
    
    .selected-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }
    
    .tag {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .tag button {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0;
        margin-left: 0.25rem;
    }
    
    .modal-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
    }

    .footer-left {
        display: flex;
    }

    .footer-right {
        display: flex;
        gap: 1rem;
    }
    
    .btn-secondary,
    .btn-primary,
    .btn-danger {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
    }
    
    .btn-secondary {
        background: var(--background-modifier-border);
        color: var(--text-normal);
    }
    
    .btn-secondary:hover {
        background: var(--background-modifier-hover);
    }
    
    .btn-primary {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }
    
    .btn-primary:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }
    
    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-danger {
        background: var(--text-error);
        color: var(--text-on-accent);
    }

    .btn-danger:hover:not(:disabled) {
        background: var(--text-error);
        opacity: 0.8;
    }

    .btn-danger:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Confirmation Dialog */
    .confirm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    }

    .confirm-dialog {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .confirm-dialog h4 {
        margin: 0 0 1rem 0;
        color: var(--text-normal);
        font-size: 1.25rem;
    }

    .confirm-dialog p {
        margin: 0 0 1.5rem 0;
        color: var(--text-muted);
        line-height: 1.5;
    }

    .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
    }
    
    /* Entry Type Tabs */
    .entry-tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--background-modifier-border);
        padding-bottom: 0.5rem;
    }
    
    .tab-button {
        background: none;
        border: none;
        padding: 0.75rem 1rem;
        cursor: pointer;
        color: var(--text-muted);
        font-size: 0.9rem;
        border-radius: 4px 4px 0 0;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
        white-space: nowrap;
    }
    
    .tab-button:hover {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
    }
    
    .tab-button.active {
        color: var(--text-accent);
        border-bottom-color: var(--text-accent);
        background: var(--background-modifier-form-field);
    }
    
    /* Form adaptations for different entry types */
    textarea {
        font-family: inherit;
        font-size: inherit;
        padding: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-modifier-form-field);
        color: var(--text-normal);
        resize: vertical;
        min-height: 60px;
    }
    
    textarea:focus {
        outline: none;
        border-color: var(--text-accent);
        box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
    }
    
    @media (max-width: 768px) {
        .form-grid {
            grid-template-columns: 1fr;
        }
        
        .posting-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
        }
        
        .posting-actions {
            justify-self: end;
        }

        .modal-footer {
            flex-direction: column;
            gap: 1rem;
        }

        .footer-right {
            width: 100%;
            justify-content: center;
        }
        
        .entry-tabs {
            flex-wrap: wrap;
            gap: 0.25rem;
        }
        
        .tab-button {
            padding: 0.5rem 0.75rem;
            font-size: 0.8rem;
        }
    }
</style>