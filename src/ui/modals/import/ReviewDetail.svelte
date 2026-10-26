<script lang="ts">
	import { aliasSuggestion, categoryPosting, type ReviewRow } from '../../../utils/import/review';
	import { generateTransactionText } from '../../../utils/directives/transactionDirectives';
	import { nativeDatePicker } from '../../actions/nativeDatePicker';
	import HelpTip from '../../common/HelpTip.svelte';

	export let row: ReviewRow;
	export let labels: string[] = [];
	export let accounts: string[] = [];
	export let positionLabel = '';
	export let hasPrev = false;
	export let hasNext = false;
	/** How many other uncategorized rows an alias would also match. */
	export let countAliasMatches: (alias: string) => number;
	/** Saves an alias for `account` and applies it; returns how many other rows it changed. */
	export let onRemember: (account: string, alias: string) => number;
	export let onPrev: () => void;
	export let onNext: () => void;
	export let onList: () => void;

	$: txn = row.draft.txn;
	/** Where the row went when no alias matched. */
	$: fallback = row.draft.match?.fallback ?? '';
	/** The posting the Account field edits: the one categorized from a column. */
	$: posting = categoryPosting(row);

	// Per-row state, reset when moving to another row.
	let shownRow: ReviewRow | null = null;
	let accountAtOpen = '';
	let aliasText = '';
	let aliasTouched = false;
	let remembered: { account: string; alias: string; count: number } | null = null;
	$: if (row !== shownRow) {
		shownRow = row;
		accountAtOpen = row.draft.txn?.postings?.[categoryPosting(row)]?.account ?? '';
		aliasText = '';
		aliasTouched = false;
		remembered = null;
	}

	$: account = txn?.postings?.[posting]?.account ?? '';
	$: canRemember = !!account && account !== fallback && account !== accountAtOpen && !remembered;
	$: if (canRemember && !aliasTouched) aliasText = (row.draft.match?.mode === 'exact' ? '' : txn?.payee) || aliasSuggestion(row);
	$: aliasMatches = canRemember && aliasText.trim() ? countAliasMatches(aliasText.trim()) : 0;
	$: previewText = txn ? generateTransactionText(txn) : '';

	function edited() {
		row.edited = true;
		row = row;
	}

	function changeAccount(value: string) {
		if (!txn?.postings) return;
		txn.postings[posting] = { ...txn.postings[posting], account: value.trim() };
		txn.flag = value.trim() && value.trim() !== fallback ? '*' : '!';
		edited();
	}

	function remember() {
		const alias = aliasText.trim();
		if (!alias || !txn) return;
		if (row.draft.match?.payeeIsAlias) txn.payee = alias;
		if (row.draft.match) row.draft.match.matched = true;
		row.draft.matchedAlias = alias;
		const count = onRemember(account, alias);
		remembered = { account, alias, count };
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

				{#if canRemember}
					<div class="remember">
						<div class="import-row tight">
							<span>Remember</span>
							<input type="text" bind:value={aliasText} on:input={() => (aliasTouched = true)} aria-label="Alias" />
							<span>→ {account}</span>
							<HelpTip topic="importRemember" />
						</div>
						<div class="import-row tight">
							<button type="button" disabled={!aliasText.trim()} on:click={remember}>Remember alias</button>
							{#if aliasMatches > 0}<span class="import-hint">also fills in {aliasMatches} other row{aliasMatches === 1 ? '' : 's'}</span>{/if}
						</div>
					</div>
				{:else if remembered}
					<div class="import-banner is-success">
						"{remembered.alias}" will be added to {remembered.account}'s aliases on import{remembered.count > 0 ? `, and ${remembered.count} other row${remembered.count === 1 ? ' was' : 's were'} filled in` : ''}.
					</div>
				{/if}
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

	.remember {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
		padding: var(--size-4-2);
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-small);
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
