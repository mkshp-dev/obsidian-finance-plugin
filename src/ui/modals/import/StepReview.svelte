<script lang="ts">
	import type { ImportMapping } from '../../../models/import';
	import TabBar from '../../common/TabBar.svelte';
	import ReviewDetail from './ReviewDetail.svelte';
	import { counterAccount, filterRows, isUncategorized, rowsMatchingAlias, type ReviewFilter, type ReviewRow } from '../../../utils/import/review';
	import type { OpeningBalanceCheck } from '../../../services/import.service';

	export let rows: ReviewRow[] = [];
	export let labels: string[] = [];
	export let mapping: ImportMapping;
	export let accounts: string[] = [];
	export let opening: OpeningBalanceCheck | null = null;
	/** Posting 1's account and currency, when they're the same for every row. */
	export let statement: { account: string; currency: string } | null = null;
	export let closingBalance: { date: string; amount: string } | null = null;
	export let addAssertion = true;
	export let onRememberAlias: (index: number, account: string, alias: string) => number;
	export let onBack: () => void;
	export let onSubmit: () => void;

	let filter: ReviewFilter = 'all';
	/** Index into `rows` of the row open in detail, or null for the list. */
	let selected: number | null = null;

	$: visible = filterRows(rows, filter, mapping);
	$: tabs = [
		{ value: 'all', label: 'All', count: rows.length },
		{ value: 'attention', label: 'Needs attention', count: filterRows(rows, 'attention', mapping).length, tone: 'warning' as const },
		{ value: 'duplicates', label: 'Duplicates', count: filterRows(rows, 'duplicates', mapping).length },
	];
	$: includedCount = rows.filter((r) => r.include && r.draft.txn).length;
	$: position = selected === null ? -1 : visible.indexOf(selected);

	function statusOf(row: ReviewRow, m: ImportMapping): { label: string; tone: string } | null {
		if (!row.draft.txn) return { label: 'error', tone: 'bad' };
		if (row.status.kind === 'imported') return { label: 'imported', tone: 'muted' };
		if (row.status.kind === 'possible') return { label: 'possible duplicate', tone: 'warn' };
		if (isUncategorized(row, m)) return { label: 'uncategorized', tone: 'warn' };
		return null;
	}

	function step(delta: number) {
		const next = visible[position + delta];
		if (next !== undefined) selected = next;
	}
</script>

{#if selected !== null && rows[selected]}
	<ReviewDetail
		bind:row={rows[selected]}
		{labels}
		{mapping}
		{accounts}
		positionLabel={position >= 0 ? `Row ${position + 1} of ${visible.length}` : ''}
		hasPrev={position > 0}
		hasNext={position >= 0 && position < visible.length - 1}
		countAliasMatches={(alias) => rowsMatchingAlias(rows, alias, mapping, selected ?? -1).length}
		onRemember={(account, alias) => { const n = onRememberAlias(selected ?? -1, account, alias); rows = rows; return n; }}
		onPrev={() => step(-1)}
		onNext={() => step(1)}
		onList={() => (selected = null)}
	/>
{:else}
	<div class="import-step">
		{#if opening && !opening.ok}
			<div class="import-banner is-warning">
				Before this statement, the ledger shows {opening.ledger} {statement?.currency ?? ''} but the bank shows {opening.statement} {statement?.currency ?? ''}
				(a difference of {opening.difference}). Some earlier transactions may be missing or wrong.
			</div>
		{/if}

		<TabBar {tabs} value={filter} ariaLabel="Filter rows" on:change={(e) => (filter = e.detail)} />

		<div class="import-table-wrap">
			<table class="review-table">
				<thead>
					<tr><th>Add</th><th>Date</th><th>Description</th><th class="amount">Amount</th><th>Account</th><th></th></tr>
				</thead>
				<tbody>
					{#each visible as i (i)}
						{@const row = rows[i]}
						{@const txn = row.draft.txn}
						{@const status = statusOf(row, mapping)}
						<tr on:click={() => (selected = i)}>
							<td on:click|stopPropagation>
								<input type="checkbox" bind:checked={rows[i].include} disabled={!txn} aria-label="Add to ledger" />
							</td>
							<td class="nowrap">{txn?.date ?? ''}</td>
							<td class="description" title={txn?.narration ?? row.draft.cells.join(' | ')}>
								{txn ? (txn.payee || txn.narration) : row.draft.errors.join('; ')}
							</td>
							<td class="amount" class:is-negative={String(txn?.postings?.[0]?.amount ?? '').startsWith('-')}>
								{txn?.postings?.[0]?.amount ?? ''}
							</td>
							<td class="account" title={counterAccount(row)}>{counterAccount(row)}</td>
							<td>{#if status}<span class="badge tone-{status.tone}">{status.label}</span>{/if}</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="import-hint">Nothing here.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if closingBalance}
			<label class="assertion">
				<input type="checkbox" bind:checked={addAssertion} />
				Add balance assertion: <code>{closingBalance.date} balance {statement?.account} {closingBalance.amount} {statement?.currency}</code>
			</label>
		{/if}

		<div class="import-footer">
			<button type="button" on:click={onBack}>Back</button>
			<button type="button" class="mod-cta" disabled={includedCount === 0} on:click={onSubmit}>
				Import {includedCount} transaction{includedCount === 1 ? '' : 's'}
			</button>
		</div>
	</div>
{/if}

<style>
	.review-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-ui-small);
	}

	.review-table th {
		text-align: left;
		font-weight: 600;
		color: var(--text-muted);
		position: sticky;
		top: 0;
		background: var(--background-primary);
	}

	.review-table td, .review-table th {
		padding: var(--size-4-1) var(--size-4-2);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.review-table tbody tr {
		cursor: pointer;
	}

	.review-table tbody tr:hover td {
		background: var(--background-modifier-hover);
	}

	.nowrap {
		white-space: nowrap;
	}

	.description, .account {
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.amount.is-negative {
		color: var(--text-error);
	}

	.badge {
		font-size: var(--font-ui-smaller);
		padding: 1px 6px;
		border-radius: var(--radius-s);
		white-space: nowrap;
	}

	.tone-warn {
		background: rgba(var(--color-orange-rgb), 0.15);
		color: var(--color-orange);
	}

	.tone-bad {
		background: rgba(var(--color-red-rgb), 0.15);
		color: var(--text-error);
	}

	.tone-muted {
		background: var(--background-modifier-hover);
		color: var(--text-muted);
	}

	.assertion {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		font-size: var(--font-ui-small);
	}
</style>
