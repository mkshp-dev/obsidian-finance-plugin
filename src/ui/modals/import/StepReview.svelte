<script lang="ts">
	import TabBar from '../../common/TabBar.svelte';
	import ReviewDetail from './ReviewDetail.svelte';
	import HelpTip from '../../common/HelpTip.svelte';
	import { counterAccount, filterRows, isResolved, untickUnresolved, type ReviewFilter, type ReviewRow } from '../../../utils/import/review';
	import type { OpeningBalanceCheck } from '../../../services/import.service';
	import type { StatementAssertion } from '../../../utils/import/mapping';

	export let rows: ReviewRow[] = [];
	export let labels: string[] = [];
	export let accounts: string[] = [];
	export let payees: string[] = [];
	export let tags: string[] = [];
	export let currencies: string[] = [];
	export let opening: OpeningBalanceCheck | null = null;
	/** Posting 1's account and currency, when they're the same for every row. */
	export let statement: { account: string; currency: string } | null = null;
	/** Balance assertions for the balances before and after the statement, each with its own toggle. */
	export let assertions: StatementAssertion[] = [];
	/** closing − opening − the rows' amounts, when both balances were given. */
	export let difference: string | null = null;
	/** True while the import is being written. */
	export let importing = false;
	export let onBack: () => void;
	export let onSubmit: () => void;

	let filter: ReviewFilter = 'all';
	/** Index into `rows` of the row open in detail, or null for the list. */
	let selected: number | null = null;

	$: visible = filterRows(rows, filter);
	$: tabs = [
		{ value: 'all', label: 'All', count: rows.length },
		{ value: 'attention', label: 'Needs attention', count: filterRows(rows, 'attention').length, tone: 'warning' as const },
		{ value: 'duplicates', label: 'Duplicates', count: filterRows(rows, 'duplicates').length },
	];
	/** Which rows can be ticked. */
	$: resolved = rows.map(isResolved);

	/** After an edit in the detail view: a row that's become unresolved can't stay ticked. */
	function changed() {
		untickUnresolved(rows);
		rows = rows;
	}
	$: includedCount = rows.filter((r, i) => r.include && resolved[i]).length;
	$: assertionCount = assertions.filter((a) => a.include).length;
	$: importLabel = [
		includedCount > 0 || assertionCount === 0 ? `${includedCount} transaction${includedCount === 1 ? '' : 's'}` : '',
		assertionCount > 0 ? `${assertionCount} balance assertion${assertionCount === 1 ? '' : 's'}` : '',
	].filter(Boolean).join(' and ');
	$: position = selected === null ? -1 : visible.indexOf(selected);

	function statusOf(row: ReviewRow): { label: string; tone: string } | null {
		if (!isResolved(row)) return { label: 'unresolved', tone: 'bad' };
		if (row.status.kind === 'imported') return { label: 'imported', tone: 'muted' };
		if (row.status.kind === 'possible') return { label: 'possible duplicate', tone: 'warn' };
		return null;
	}

	function step(delta: number) {
		const next = visible[position + delta];
		if (next !== undefined) selected = next;
	}
</script>

{#if selected !== null && rows[selected]}
	<ReviewDetail
		row={rows[selected]}
		{labels}
		{accounts}
		{payees}
		{tags}
		{currencies}
		onChange={changed}
		positionLabel={position >= 0 ? `Row ${position + 1} of ${visible.length}` : ''}
		hasPrev={position > 0}
		hasNext={position >= 0 && position < visible.length - 1}
		onPrev={() => step(-1)}
		onNext={() => step(1)}
		onList={() => (selected = null)}
	/>
{:else}
	<div class="import-step">
		{#if difference !== null && difference !== '0' && !/^-?0(\.0+)?$/.test(difference)}
			<div class="import-banner is-warning">
				The balances before and after the statement don't match its transactions: they're {difference} {statement?.currency ?? ''} apart.
				A row may be missing, or an amount's sign is wrong.
			</div>
		{/if}

		{#if opening && !opening.ok}
			<div class="import-banner is-warning">
				Before this statement, the ledger shows {opening.ledger} {statement?.currency ?? ''} but the bank shows {opening.statement} {statement?.currency ?? ''}
				(a difference of {opening.difference}). Some earlier transactions may be missing or wrong.
			</div>
		{/if}

		<div class="review-tabs">
			<TabBar {tabs} value={filter} ariaLabel="Filter rows" on:change={(e) => (filter = e.detail)} />
			<HelpTip topic="importReview" />
		</div>

		<div class="import-table-wrap">
			<table class="review-table">
				<thead>
					<tr><th>Add</th><th>Date</th><th>Description</th><th class="amount">Amount</th><th>Account</th><th>Status</th></tr>
				</thead>
				<tbody>
					{#each visible as i (i)}
						{@const row = rows[i]}
						{@const txn = row.draft.txn}
						{@const status = statusOf(row)}
						<tr on:click={() => (selected = i)}>
							<td on:click|stopPropagation>
								<input type="checkbox" bind:checked={rows[i].include} disabled={!resolved[i]}
									aria-label="Add to ledger" title={resolved[i] ? '' : 'Resolve this transaction before adding it'} />
							</td>
							<td class="nowrap">{txn.date}</td>
							<td class="description" title={txn.narration || row.draft.cells.join(' | ')}>
								{txn.payee || txn.narration || row.draft.cells.filter(Boolean).join(' | ')}
							</td>
							<td class="amount" class:is-negative={String(txn.postings?.[0]?.amount ?? '').startsWith('-')}>
								{txn.postings?.[0]?.amount ?? ''}
							</td>
							<td class="account" title={counterAccount(row)}>{counterAccount(row)}</td>
							<td>{#if status}<span class="import-badge tone-{status.tone}">{status.label}</span>{/if}</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="import-hint">Nothing here.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if assertions.length > 0}
			<section class="import-section">
				<h4>Balance assertions</h4>
				<table class="review-table">
					<thead>
						<tr><th>Add</th><th>Date</th><th>Balance</th><th>When</th></tr>
					</thead>
					<tbody>
						{#each assertions as assertion, i (assertion.kind)}
							<tr class="assertion-row">
								<td><input type="checkbox" bind:checked={assertions[i].include} aria-label="Add balance assertion to ledger" /></td>
								<td class="nowrap">{assertion.date}</td>
								<td><code>{assertion.date} balance {statement?.account} {assertion.amount} {statement?.currency}</code></td>
								<td class="import-hint">{assertion.kind === 'opening' ? 'before the statement' : 'after the statement'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		<div class="import-footer">
			<button type="button" on:click={onBack}>Back</button>
			<button type="button" class="mod-cta" disabled={importing || (includedCount === 0 && assertionCount === 0)} on:click={onSubmit}>
				{importing ? 'Importing…' : `Import ${importLabel}`}
			</button>
		</div>
	</div>
{/if}

<style>
	.review-tabs {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.review-tabs > :global(:first-child) {
		flex: 1;
	}

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





	.assertion-row {
		cursor: default;
	}
</style>
