<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { JournalBalance } from '../../../../models/journal';

    export let entry: JournalBalance;

    const dispatch = createEventDispatcher();
</script>

<div class="card balance-card">
    <div class="card-header">
        <div class="header-left">
            <span class="badge badge-balance">
                <span class="icon">⚖️</span> BALANCE
            </span>
            <span class="date">{entry.date}</span>
        </div>
        <div class="header-right">
             <button class="btn-icon delete-btn" on:click={() => dispatch('delete', entry)} title="Delete">
                ❌
            </button>
            <button class="btn-edit" on:click={() => dispatch('edit', entry)}>
                ✏️ Edit
            </button>
        </div>
    </div>

    <div class="card-body">
        <div class="balance-row">
            <div class="account">{entry.account}</div>
            <div class="amount">
                {entry.amount} {entry.currency}
            </div>
        </div>
        {#if entry.diff_amount}
             <div class="balance-row diff">
                <div class="label">Difference:</div>
                <div class="amount error">
                    {entry.diff_amount} {entry.currency}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .card {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        margin-bottom: 1rem;
        overflow: hidden;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--background-secondary);
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-family: var(--font-monospace);
    }

    .header-right {
        display: flex;
        gap: 0.5rem;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--color-purple);
        color: var(--text-on-accent);
    }

    .date {
        color: var(--text-muted);
        font-weight: 600;
    }

    .btn-edit {
        padding: 4px 12px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
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

    .btn-icon {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        font-size: 1rem;
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
        padding: 0.75rem 1rem;
        font-family: var(--font-monospace);
    }

    .balance-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .account {
        color: var(--text-normal);
        font-size: 1rem;
    }

    .amount {
        font-weight: 600;
        color: var(--text-normal);
    }

    .diff {
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px dashed var(--background-modifier-border);
    }

    .amount.error {
        color: var(--text-error);
    }
</style>
