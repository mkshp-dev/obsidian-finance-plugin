<!-- src/ui/partials/dashboard/RecurringWidget.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { RecurringController } from '../../../controllers/RecurringController';

    export let controller: RecurringController;
    export let lookaheadDays: number = 30;

    $: upcomingStore = controller.upcoming;
    $: loadingStore = controller.loading;
    $: errorStore = controller.error;

    onMount(() => {
        controller.loadData();
    });

    function formatDate(iso: string): string {
        try {
            const d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return iso;
        }
    }

    function daysUntil(iso: string): number {
        const today = new Date();
        const d = new Date(iso + 'T00:00:00');
        const ms = d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        return Math.round(ms / 86_400_000);
    }

    function dueLabel(iso: string): string {
        const n = daysUntil(iso);
        if (n === 0) return 'today';
        if (n === 1) return 'tomorrow';
        if (n < 0) return `${-n}d overdue`;
        return `in ${n}d`;
    }

    function formatAmount(value: number, currency: string): string {
        const fmt = value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
        return `${fmt} ${currency}`;
    }
</script>

<section class="recurring-widget">
    <header class="recurring-header">
        <h4>Upcoming recurring</h4>
        <span class="recurring-window">next {lookaheadDays}d</span>
    </header>

    {#if $loadingStore}
        <div class="recurring-empty">Loading…</div>
    {:else if $errorStore}
        <div class="recurring-error">⚠️ {$errorStore}</div>
    {:else if $upcomingStore.length === 0}
        <div class="recurring-empty">
            No upcoming recurring transactions.
            <span class="recurring-hint">
                Define them in <code>recurring.beancount</code> with
                <code>custom "recurring"</code> directives.
            </span>
        </div>
    {:else}
        <ul class="recurring-list">
            {#each $upcomingStore as occ}
                <li class="recurring-item" class:overdue={daysUntil(occ.date) < 0}>
                    <div class="recurring-when">
                        <span class="recurring-date">{formatDate(occ.date)}</span>
                        <span class="recurring-due">{dueLabel(occ.date)}</span>
                    </div>
                    <div class="recurring-what">
                        <span class="recurring-nickname">
                            {occ.rule.nickname}
                            {#if occ.rule.synthetic}
                                <span class="auto-badge" title="Auto-generated from {occ.rule.fromLoanAccount} (loan-type metadata)">auto</span>
                            {/if}
                        </span>
                        <span class="recurring-account">{occ.rule.expenseAccount}</span>
                    </div>
                    <div class="recurring-amount">
                        {formatAmount(occ.rule.amount, occ.rule.currency)}
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
    .recurring-widget {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 12px;
        padding: 16px;
    }

    .recurring-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .recurring-header h4 {
        margin: 0;
        color: var(--text-normal);
        font-size: 14px;
        letter-spacing: 0.02em;
    }

    .recurring-window {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .recurring-empty,
    .recurring-error {
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.5;
    }

    .recurring-error {
        color: var(--text-error);
    }

    .recurring-hint {
        display: block;
        margin-top: 6px;
        font-size: 12px;
        color: var(--text-faint);
    }

    .recurring-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .recurring-item {
        display: grid;
        grid-template-columns: 96px 1fr auto;
        align-items: center;
        gap: 12px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--background-secondary);
        font-size: 13px;
    }

    .recurring-item.overdue {
        background: color-mix(in srgb, var(--text-warning), transparent 88%);
        border-left: 2px solid var(--text-warning);
    }

    .recurring-when {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .recurring-date {
        font-weight: 600;
        color: var(--text-normal);
        font-variant-numeric: tabular-nums;
    }

    .recurring-due {
        font-size: 11px;
        color: var(--text-muted);
    }

    .recurring-what {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .recurring-nickname {
        color: var(--text-normal);
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .recurring-account {
        font-size: 11px;
        color: var(--text-faint);
        font-family: var(--font-monospace);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .recurring-amount {
        font-weight: 700;
        color: var(--text-accent);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .auto-badge {
        display: inline-block;
        margin-left: 6px;
        padding: 0 6px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-on-accent);
        background: var(--text-faint);
        border-radius: 999px;
        vertical-align: middle;
    }
</style>
