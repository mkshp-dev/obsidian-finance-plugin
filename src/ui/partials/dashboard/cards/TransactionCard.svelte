<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { JournalTransaction } from '../../../../models/journal';

    export let entry: JournalTransaction;
    export let enableUserSnippets = false;

    const dispatch = createEventDispatcher();

    function formatAmount(amount: string | null, currency: string | null) {
        if (!amount) return '';
        return `${amount} ${currency || ''}`;
    }
</script>

<div class="card transaction-card">
    <div class="card-header">
        <div class="header-left">
            <span class="badge badge-transaction">
                <span class="icon">💰</span> TRANSACTIONS
            </span>
            <span class="date">{entry.date}</span>
            <span class="flag">{entry.flag}</span>
            {#if entry.payee}
                <button class="payee payee-link" type="button" on:click={() => dispatch('view-transactions', { payee: entry.payee })} title="View in Transactions tab">"{entry.payee}"</button>
            {/if}
            <span class="narration">"{entry.narration}"</span>
            {#each entry.tags as tag}
                <button class="tag tag-link" type="button" on:click={(e) => dispatch('tag-click', { tag, ctrlKey: e.ctrlKey || e.metaKey })} title="Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal">#{tag}</button>
            {/each}
        </div>
        <div class="header-right">
            <button class="btn-icon" on:click={() => dispatch('edit', entry)} title="Edit">
                ✏️
            </button>
            <button class="btn-icon" on:click={() => dispatch('make-recurring', entry)} title="Make recurring">
                🔁
            </button>
            <button
                class="btn-icon"
                disabled={!enableUserSnippets}
                on:click={() => dispatch('create-snippet', entry)} 
                title={enableUserSnippets ? "Save as snippet" : "User-defined snippets disabled in settings"}
            >
                📋
            </button>
            <button class="btn-icon delete-btn" on:click={() => dispatch('delete', entry)} title="Delete">
                ❌
            </button>
        </div>
    </div>

    <div class="card-body">
        {#each entry.postings as posting}
            <div class="posting-row">
                <button class="account account-link" type="button" on:click={(e) => dispatch('account-click', { account: posting.account, ctrlKey: e.ctrlKey || e.metaKey })} title="Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal">
                    {posting.account}
                </button>
                <div class="amount" class:negative={posting.amount && posting.amount.startsWith('-')}>
                    {formatAmount(posting.amount, posting.currency)}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .card {
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border-hover);
        border-radius: 6px;
        margin-bottom: var(--size-4-3);
        overflow: hidden;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--size-4-2) var(--size-4-3);
        background: var(--background-secondary-alt);
        border-bottom: 1px solid var(--background-modifier-border-hover);
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: var(--size-4-2);
        flex-wrap: wrap;
        font-family: var(--font-monospace);
        font-size: 0.85rem;
    }

    .header-right {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--background-modifier-form-field);
        color: var(--text-muted);
    }

    .date {
        color: var(--text-muted);
        font-weight: 500;
        font-size: 0.85rem;
    }

    .payee {
        font-style: italic;
        color: var(--text-muted);
        font-size: 0.85rem;
    }

    button.payee-link {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
        padding: 0 !important;
        margin: 0 !important;
        height: auto !important;
        font-style: italic;
        color: var(--text-muted);
        font-size: 0.85rem;
        font-family: inherit;
        cursor: pointer;
        transition: color 0.15s ease, text-decoration 0.15s ease;
    }

    button.payee-link:hover {
        color: var(--text-accent);
        text-decoration: underline;
        background: transparent !important;
        box-shadow: none !important;
    }

    .narration {
        color: var(--text-normal);
        font-weight: 500;
        font-size: 0.85rem;
    }

    .tag {
        color: var(--text-accent);
        font-size: 0.8rem;
    }

    button.tag-link {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
        padding: 0 !important;
        margin: 0 !important;
        height: auto !important;
        font-family: inherit;
        cursor: pointer;
        transition: color 0.15s ease, text-decoration 0.15s ease;
    }

    button.tag-link:hover {
        text-decoration: underline;
        background: transparent !important;
        box-shadow: none !important;
    }

    .btn-edit {
        padding: 3px 10px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        transition: all 0.2s;
        color: var(--text-normal);
    }

    .btn-edit:hover {
        background: var(--background-modifier-hover);
        color: var(--text-accent);
    }

    .btn-snippet {
        padding: 3px 10px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        transition: all 0.2s;
        color: var(--text-normal);
    }

    .btn-snippet:hover:not(:disabled) {
        background: var(--background-modifier-hover);
        color: var(--text-accent);
    }

    .btn-snippet:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        background: var(--background-secondary-alt);
        color: var(--text-muted);
        border-color: var(--background-modifier-border);
    }

    .btn-icon {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        font-size: 0.9rem;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .btn-icon:hover {
        opacity: 1;
        background: var(--background-modifier-hover);
        border-radius: 4px;
    }

    .delete-btn:hover {
        color: var(--text-error);
    }

    .card-body {
        padding: var(--size-4-1) 0;
    }

    .posting-row {
        display: flex;
        justify-content: space-between;
        padding: var(--size-4-2) var(--size-4-3);
        font-family: var(--font-monospace);
        font-size: 0.85rem;
        line-height: 1.2;
    }

    .posting-row:nth-child(even) {
        background-color: var(--background-primary-alt);
    }

    .account {
        color: var(--text-muted);
        font-size: 0.85rem;
    }

    .account-link {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
        padding: 0 !important;
        margin: 0 !important;
        height: auto !important;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        transition: color 0.15s ease, text-decoration 0.15s ease;
    }

    .account-link:hover {
        color: var(--text-accent);
        text-decoration: underline;
        background: transparent !important;
        box-shadow: none !important;
    }

    .amount {
        font-weight: 600;
        color: var(--text-success); /* Default positive */
    }

    .amount.negative {
        color: var(--text-accent); /* Usually negative numbers are distinct */
        /* Or adhere to image: purple/blueish for amounts */
        color: var(--interactive-accent);
    }
</style>
