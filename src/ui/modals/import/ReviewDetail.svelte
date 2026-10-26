<script lang="ts">
	import { tick } from 'svelte';
	import { IMPORT_REF_KEY } from '../../../models/import';
	import type { JournalPosting } from '../../../models/journal';
	import {
		cleanMetadata, draftProblems, fromFormPosting, postingParts, toFormPosting,
		type PostingParts, type ReviewRow,
	} from '../../../utils/import/review';
	import { generateTransactionText } from '../../../utils/directives/transactionDirectives';
	import { nativeDatePicker } from '../../actions/nativeDatePicker';
	import PostingRow from '../transaction-edit/PostingRow.svelte';
	import TagLinkInput from '../transaction-edit/TagLinkInput.svelte';

	export let row: ReviewRow;
	export let labels: string[] = [];
	export let accounts: string[] = [];
	export let payees: string[] = [];
	export let tags: string[] = [];
	export let currencies: string[] = [];
	export let positionLabel = '';
	export let hasPrev = false;
	export let hasNext = false;
	/** Called after every edit, so the list sees the row's new state. */
	export let onChange: () => void;
	export let onPrev: () => void;
	export let onNext: () => void;
	export let onList: () => void;

	// --- The form, loaded from the row's transaction when a row is opened ---
	let shownRow: ReviewRow | null = null;
	let date = '';
	let flag = '*';
	let payee = '';
	let narration = '';
	let metaRows: { key: string; value: string }[] = [];
	let selectedTags: string[] = [];
	let selectedLinks: string[] = [];
	let postings: JournalPosting[] = [];
	let parts: PostingParts[] = [];
	let showMetadata = false;

	$: if (row !== shownRow) load(row);

	function load(r: ReviewRow) {
		shownRow = r;
		const txn = r.draft.txn;
		date = txn.date;
		flag = txn.flag ?? '*';
		payee = txn.payee ?? '';
		narration = txn.narration ?? '';
		const meta = txn.metadata ?? {};
		metaRows = [
			{ key: IMPORT_REF_KEY, value: meta[IMPORT_REF_KEY] ?? '' },
			...Object.entries(meta).filter(([k]) => k !== IMPORT_REF_KEY).map(([key, value]) => ({ key, value })),
		];
		selectedTags = [...(txn.tags ?? [])];
		selectedLinks = [...(txn.links ?? [])];
		postings = (txn.postings ?? []).map(toFormPosting);
		parts = postings.map(postingParts);
		showMetadata = !metaRows[0].value.trim();
	}

	/** Writes the form back into the row's transaction. */
	function save() {
		if (row !== shownRow) return;
		row.draft.txn = {
			date: date.trim(),
			flag,
			payee: payee.trim(),
			narration: narration.trim(),
			tags: selectedTags,
			links: selectedLinks,
			metadata: cleanMetadata(Object.fromEntries(metaRows.map((m) => [m.key, m.value]))),
			postings: postings.map((p, i) => fromFormPosting(p, parts[i])),
		};
		row = row;
		onChange();
	}

	/** Any input, change or click in the form saves once Svelte has applied it (posting rows edit their own objects). */
	async function sync() {
		await tick();
		save();
	}

	$: ledgerText = generateTransactionText(row.draft.txn);
	$: problems = draftProblems(row.draft);
	$: resolved = problems.unresolved.length === 0;

	// --- Postings, as in Add Transaction ---
	function addPosting() {
		postings = [...postings, { account: '', amount: '', currency: '', flag: null, comment: null, metadata: {} }];
		parts = [...parts, { cost: false, price: false, flag: false, comment: false, metadata: false }];
	}

	function removePosting(index: number) {
		postings = postings.filter((_, i) => i !== index);
		parts = parts.filter((_, i) => i !== index);
	}

	function toggle(index: number, part: keyof PostingParts) {
		parts[index] = { ...parts[index], [part]: !parts[index][part] };
		const p = postings[index];
		if (part === 'cost' && !p.cost) p.cost = { number: null, currency: null, date: null, label: null };
		if (part === 'price' && !p.price) p.price = { amount: '', currency: '' };
		if (part === 'flag' && !p.flag) p.flag = '!';
		if (part === 'comment' && p.comment == null) p.comment = '';
		if (part === 'metadata' && !p.metadata) p.metadata = {};
		postings = postings;
	}

	function nextKey(map: Record<string, string>): string {
		let n = Object.keys(map).length + 1;
		while (`key${n}` in map) n++;
		return `key${n}`;
	}

	function addPostingMetadata(index: number) {
		const map = postings[index].metadata ?? {};
		postings[index].metadata = { ...map, [nextKey(map)]: '' };
	}

	function removePostingMetadata(index: number, key: string) {
		postings[index].metadata = Object.fromEntries(Object.entries(postings[index].metadata ?? {}).filter(([k]) => k !== key));
	}

	function renamePostingMetadata(index: number, oldKey: string, newKey: string) {
		const map = postings[index].metadata ?? {};
		const key = newKey.trim();
		if (key === oldKey || key in map) return;
		postings[index].metadata = Object.fromEntries(Object.entries(map).map(([k, v]) => [k === oldKey ? key : k, v]));
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

	<div class="detail-status" class:is-unresolved={!resolved}>
		<span class="import-badge tone-{resolved ? 'good' : 'bad'}">{resolved ? 'Resolved' : 'Unresolved'}</span>
		{#if row.status.kind === 'possible'}
			<span class="import-badge tone-warn">possible duplicate</span>
		{:else if row.status.kind === 'imported'}
			<span class="import-badge tone-muted">imported</span>
		{/if}
		<span class="import-hint">
			{resolved
				? 'Ready to add to the ledger.'
				: `${problems.unresolved.length} thing${problems.unresolved.length === 1 ? '' : 's'} to fill in before it can be added.`}
		</span>
		<label class="toggle-include" title={resolved ? '' : 'Resolve this transaction before adding it'}>
			<input type="checkbox" bind:checked={row.include} disabled={!resolved} on:change={() => onChange()} /> Add to ledger
		</label>
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
			<h4>Ledger entry</h4>
			<pre class="preview">{ledgerText}</pre>
			{#if !resolved}
				<div class="import-banner is-error">
					Fill in the following before this can be added:
					<ul>{#each problems.unresolved as p}<li>{p}</li>{/each}</ul>
				</div>
			{/if}
			{#if problems.notes.length > 0}
				<div class="import-hint">Couldn't read from the file: {problems.notes.join('; ')}</div>
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

	<!-- Mirrors the Add Transaction form -->
	<div class="txn-form" role="presentation" on:input={sync} on:change={sync} on:click={sync} on:keyup={sync}>
		<h4 class="txn-form-title">Transaction</h4>
		<div class="transaction-header-row">
			<div class="form-group">
				<label for="detail-date">Date *</label>
				<input id="detail-date" type="date" bind:value={date} use:nativeDatePicker />
			</div>
			<div class="form-group">
				<label for="detail-flag">Flag</label>
				<select id="detail-flag" class="dropdown" bind:value={flag}>
					<option value="*">* Complete</option>
					<option value="!">! Incomplete</option>
				</select>
			</div>
			<div class="form-group">
				<label for="detail-payee">Payee</label>
				<input id="detail-payee" type="text" bind:value={payee} list="import-payees" placeholder="Store name" />
			</div>
			<div class="form-group">
				<label for="detail-narration">Narration</label>
				<input id="detail-narration" type="text" bind:value={narration} placeholder="Description" />
			</div>
			<button type="button" class="metadata-toggle-btn" class:active={showMetadata}
				on:click={() => (showMetadata = !showMetadata)} title="Transaction metadata">📋</button>
		</div>

		{#if showMetadata}
			<div class="transaction-metadata-section">
				<h5>Transaction metadata</h5>
				{#each metaRows as meta, i}
					<div class="metadata-item">
						<input type="text" class="metadata-key" placeholder="key" bind:value={meta.key}
							readonly={i === 0} aria-label="Metadata key" />
						<input type="text" class="metadata-value" placeholder="value" bind:value={meta.value} aria-label="Metadata value" />
						{#if i === 0}
							<span class="import-hint required-note">required</span>
						{:else}
							<button type="button" class="remove-metadata" on:click={() => (metaRows = metaRows.filter((_, j) => j !== i))}>&times;</button>
						{/if}
					</div>
				{/each}
				<button type="button" class="add-metadata-btn" on:click={() => (metaRows = [...metaRows, { key: nextKey(Object.fromEntries(metaRows.map((m) => [m.key, m.value]))), value: '' }])}>
					+ Add Metadata
				</button>
			</div>
		{/if}

		<datalist id="import-payees">{#each payees as p}<option value={p} />{/each}</datalist>
		<datalist id="accounts-list">{#each accounts as a}<option value={a} />{/each}</datalist>
		<datalist id="currencies-list">{#each currencies as c}<option value={c} />{/each}</datalist>

		<div class="postings-section">
			{#each postings as posting, index (index)}
				<PostingRow
					{posting}
					{index}
					totalPostings={postings.length}
					{date}
					operatingCurrency={postings[0]?.currency || ''}
					showCost={parts[index].cost}
					showPrice={parts[index].price}
					showPostingFlag={parts[index].flag}
					showPostingComment={parts[index].comment}
					showPostingMetadata={parts[index].metadata}
					onToggleCost={(i) => toggle(i, 'cost')}
					onTogglePrice={(i) => toggle(i, 'price')}
					onToggleFlag={(i) => toggle(i, 'flag')}
					onToggleComment={(i) => toggle(i, 'comment')}
					onToggleMetadata={(i) => toggle(i, 'metadata')}
					onRemovePosting={removePosting}
					onAddMetadata={addPostingMetadata}
					onRemoveMetadata={removePostingMetadata}
					onUpdateMetadataKey={renamePostingMetadata}
				/>
			{/each}
			<button type="button" class="add-posting" on:click={addPosting}>+ Add Posting</button>
		</div>

		<TagLinkInput bind:selectedTags bind:selectedLinks {tags} />
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
		.detail-grid, .transaction-header-row {
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
		margin: 0 0 var(--size-4-2);
		padding: var(--size-4-2);
		background: var(--background-secondary);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
		white-space: pre-wrap;
	}

	.import-banner ul {
		margin: var(--size-4-1) 0 0;
		padding-left: var(--size-4-4);
	}

	/* Mirrors the Add Transaction form */
	.txn-form {
		display: flex;
		flex-direction: column;
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.txn-form-title {
		margin: 0 0 var(--size-4-2);
	}

	.transaction-header-row {
		display: grid;
		grid-template-columns: 160px 110px 1fr 2fr auto;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		align-items: end;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group label {
		font-size: 0.8rem;
		font-weight: 500;
		margin-bottom: 0.2rem;
		color: var(--text-muted);
	}

	.txn-form input[type="text"], .txn-form input[type="date"] {
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	.metadata-toggle-btn {
		background: var(--background-modifier-form-field);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 0.3rem 0.5rem;
		cursor: pointer;
		font-size: 1rem;
	}

	.metadata-toggle-btn.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.transaction-metadata-section {
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--interactive-accent);
		border-radius: 6px;
		background: var(--background-secondary);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.transaction-metadata-section h5 {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.metadata-item {
		display: grid;
		grid-template-columns: 1fr 2fr 4.5em;
		gap: 0.5rem;
		align-items: center;
	}

	.required-note {
		text-align: center;
	}

	.remove-metadata {
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		height: 26px;
		padding: 0 0.5rem;
	}

	.add-metadata-btn {
		align-self: flex-start;
	}

	.postings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.add-posting {
		align-self: flex-start;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		border-radius: 4px;
		padding: 0.35rem 0.75rem;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.detail-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-4-2) var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-left: 3px solid var(--color-green);
		border-radius: var(--radius-s);
		background: var(--background-secondary);
	}

	.detail-status.is-unresolved {
		border-left-color: var(--text-error);
	}

	.toggle-include {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		margin-left: auto;
		font-weight: 500;
	}
</style>
