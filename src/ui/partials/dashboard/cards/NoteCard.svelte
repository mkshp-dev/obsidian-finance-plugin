<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { JournalNote } from '../../../../models/journal';

    export let entry: JournalNote;

    const dispatch = createEventDispatcher();
</script>

<div class="card note-card">
    <div class="card-header">
        <div class="header-left">
            <span class="badge badge-note">
                <span class="icon">📝</span> NOTE
            </span>
            <span class="date">{entry.date}</span>
        </div>
        <div class="header-right">
             <button class="btn-icon delete-btn" on:click={() => dispatch('delete', entry)} title="Delete">
                🗑️
            </button>
            <button class="btn-edit" on:click={() => dispatch('edit', entry)}>
                ✏️ Edit
            </button>
        </div>
    </div>

    <div class="card-body">
        <div class="note-account">{entry.account}</div>
        <div class="note-content">
            {entry.comment}
        </div>
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
        background: var(--text-muted);
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
        padding: 1rem;
    }

    .note-account {
        font-family: var(--font-monospace);
        color: var(--text-muted);
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
    }

    .note-content {
        white-space: pre-wrap;
        color: var(--text-normal);
        line-height: 1.5;
    }
</style>
