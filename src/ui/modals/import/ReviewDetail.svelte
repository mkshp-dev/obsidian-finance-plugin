<script lang="ts">
	import { categoryPosting, type ReviewRow } from '../../../utils/import/review';
	import { generateTransactionText } from '../../../utils/directives/transactionDirectives';
	import { nativeDatePicker } from '../../actions/nativeDatePicker';

	export let row: ReviewRow;
	export let labels: string[] = [];
	export let accounts: string[] = [];
	export let positionLabel = '';
	export let hasPrev = false;
	export let hasNext = false;
	export let onPrev: () => void;
	export let onNext: () => void;
	export let onList: () => void;

	$: txn = row.draft.txn;
	/** The posting the Account field edits: the one categorized from a column. */
	$: posting = categoryPosting(row);

	$: account = txn?.postings?.[posting]?.account ?? '';
	$: previewText = txn ? generateTransactionText(txn) : '';

	function edited() {
		row = row;
	}

	function changeAccount(value: string) {
		if (!txn?.postings) return;
		txn.postings[posting] = { ...txn.postings[posting], account: value.trim() };
		edited();
	}
</script>

<div class="import-step">
	<div class="detail-nav">
		<button type="button" on:click={onList}>← List</button>
		<span class="import-hint">{positionLabel}</span>
		<div class="nav-arrows">
			<button type="button" on:click={onPrev} disabled={!hasPrev} aria-label="Previous row">‹</button>
			<button type="button" on:click={onNext} disabled={!hasNext} aria-label="Next row">›</button>
		</div>
	</div>

	<div class="detail-grid">
		<section class="import-section">
			<h4>Statement row</h4>
			<table class="cells">
				{#each labels as label, i}
					{#if row.draft.cells[i]}
						<tr><th>{label}</th><td>{row.draft.cells[i]}</td></tr>
					{/if}
				{/each}
			</table>
		</section>

		<section class="import-section">
			<h4>Transaction</h4>
			{#if !txn}
				<div class="import-banner is-error">
					This row can't be imported: {row.draft.errors.join('; ')}. Fix the mapping, or add it by hand later.
				</div>
			{:else}
				<div class="import-row">
					<div class="import-field">
						<label for="detail-date">Date</label>
						<input id="detail-date" type="date" bind:value={row.draft.txn.date} on:input={edited} use:nativeDatePicker />
					</div>
					<div class="import-field">
						<label for="detail-flag">Flag</label>
						<select id="detail-flag" class="dropdown" bind:value={row.draft.txn.flag} on:change={edited}>
							<option value="*">* Complete</option>
							<option value="!">! Incomplete</option>
						</select>
					</div>
				</div>
				<div class="import-field">
					<label for="detail-payee">Payee</label>
					<input id="detail-payee" type="text" bind:value={row.draft.txn.payee} on:input={edited} />
				</div>
				<div class="import-field">
					<label for="detail-narration">Narration</label>
					<input id="detail-narration" type="text" bind:value={row.draft.txn.narration} on:input={edited} />
				</div>
				<div class="import-field">
					<label for="detail-account">Account</label>
					<input id="detail-account" type="text" list="import-review-accounts" value={account}
						on:change={(e) => changeAccount(e.currentTarget.value)} />
					<datalist id="import-review-accounts">
						{#each accounts as a}<option value={a} />{/each}
					</datalist>
				</div>
				<div class="import-hint">import-ref: <code>{row.draft.importRef}</code></div>

			{/if}
		</section>
	</div>

	{#if row.status.kind === 'possible'}
		<div class="import-banner is-warning">
			Possible duplicate of <strong>{row.status.match.date} {row.status.match.payee || row.status.match.narration}</strong>
			({row.status.match.amount} {row.status.match.currency}, {row.status.match.filename.split(/[\\/]/).pop()}:{row.status.match.lineno}).
			Turn off "Add to ledger" if it's the same transaction.
		</div>
	{:else if row.status.kind === 'imported'}
		<div class="import-banner is-info">Already imported: a transaction with this import-ref is in the ledger.</div>
	{/if}

	{#if previewText}<pre class="preview">{previewText}</pre>{/if}

	<div class="import-footer">
		<label class="toggle-include">
			<input type="checkbox" bind:checked={row.include} disabled={!txn} /> Add to ledger
		</label>
	</div>
</div>

<style>
	.detail-nav {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
	}

	.nav-arrows {
		margin-left: auto;
		display: flex;
		gap: var(--size-4-1);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
		gap: var(--size-4-3);
	}

	@media (max-width: 700px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	.cells {
		font-size: var(--font-ui-small);
		border-collapse: collapse;
	}

	.cells th {
		text-align: left;
		color: var(--text-muted);
		font-weight: normal;
		padding: 2px var(--size-4-2) 2px 0;
		vertical-align: top;
		white-space: nowrap;
	}

	.cells td {
		word-break: break-word;
		padding: 2px 0;
	}


	.preview {
		margin: 0;
		padding: var(--size-4-2);
		background: var(--background-secondary);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
		white-space: pre-wrap;
	}

	.toggle-include {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		margin-right: auto;
	}
</style>
