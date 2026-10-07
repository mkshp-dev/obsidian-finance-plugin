<script lang="ts">
	import { tick } from 'svelte';
	import { FILE_NAME_FIELD, IMPORT_REF_KEY, type AccountMatcher, type ColumnType, type ImportMapping } from '../../../models/import';
	import { buildDrafts, parseField } from '../../../utils/import/mapping';
	import { columnFits } from '../../../utils/import/columns';
	import { generateTransactionText } from '../../../utils/directives/transactionDirectives';

	export let labels: string[] = [];
	export let dataRows: string[][] = [];
	export let accounts: string[] = [];
	export let fileName = '';
	/** Row number of the first transaction, for pointing at rows in messages. */
	export let firstRowNumber = 1;
	export let matcher: AccountMatcher;
	export let mapping: ImportMapping;
	export let profileName = '';
	export let applying = false;
	export let onBack: () => void;
	export let onApply: () => void;

	const PREVIEW_COUNT = 3;

	$: types = mapping.columnTypes;
	$: chipLabels = [...labels.filter((_, i) => columnFits(types[i], 'any')), FILE_NAME_FIELD];
	$: numberColumns = labels.map((_, i) => i).filter((i) => types[i]?.kind === 'number');

	// --- Column chips insert `={{Column}}` into the field edited last ---
	let lastFocused = 'narration';
	const elements: Record<string, HTMLInputElement> = {};

	function track(node: HTMLInputElement, key: string) {
		elements[key] = node;
		const onFocus = () => (lastFocused = key);
		node.addEventListener('focus', onFocus);
		return {
			update(next: string) { key = next; elements[key] = node; },
			destroy() { node.removeEventListener('focus', onFocus); },
		};
	}

	function setField(key: string, value: string) {
		const posting = /^posting-(\d+)-(account|amount|currency)$/.exec(key);
		if (posting) mapping.postings[Number(posting[1])][posting[2] as 'account' | 'amount' | 'currency'] = value;
		else if (key.startsWith('meta-')) metaRows[Number(key.slice(5))].value = value;
		else if (key === 'tags' || key === 'links') mapping[key] = [...mapping[key], value];
		else if (key === 'date' || key === 'payee' || key === 'narration') mapping[key] = value;
		mapping = mapping;
		metaRows = metaRows;
	}

	async function insertColumn(label: string) {
		const key = lastFocused;
		setField(key, `={{${label}}}`);
		await tick();
		elements[key]?.focus();
	}

	// --- Metadata rows, kept as a list so keys can be edited; import-ref stays first ---
	let metaRows = Object.entries(mapping.metadata)
		.sort(([a], [b]) => (a === IMPORT_REF_KEY ? -1 : b === IMPORT_REF_KEY ? 1 : 0))
		.map(([key, value]) => ({ key, value }));
	if (!metaRows.some((r) => r.key === IMPORT_REF_KEY)) metaRows.unshift({ key: IMPORT_REF_KEY, value: '' });
	$: mapping.metadata = Object.fromEntries(metaRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
	let showMetadata = true;

	// --- Postings ---
	function addPosting() {
		mapping.postings = [...mapping.postings, { account: '', amount: '', currency: '' }];
	}

	function removePosting(index: number) {
		mapping.postings = mapping.postings.filter((_, i) => i !== index);
	}

	// --- Tags and links: Enter adds the typed value ---
	let tagInput = '';
	let linkInput = '';

	function addEntry(e: KeyboardEvent, field: 'tags' | 'links') {
		if (e.key !== 'Enter' && e.key !== ',') return;
		e.preventDefault();
		const value = (field === 'tags' ? tagInput : linkInput).trim().replace(/^[#^]/, '');
		if (value && !mapping[field].includes(value)) mapping[field] = [...mapping[field], value];
		if (field === 'tags') tagInput = ''; else linkInput = '';
	}

	function removeEntry(field: 'tags' | 'links', index: number) {
		mapping[field] = mapping[field].filter((_, i) => i !== index);
	}

	// --- Checking fields as they're typed ---
	type Want = 'date' | 'number' | 'any';

	/** What's wrong with a field, or '' if nothing. */
	function problem(value: string, want: Want, cols: string[], columnTypes: ColumnType[]): string {
		const f = parseField(value);
		if ('error' in f) return f.error;
		if ('text' in f) return '';
		if (f.column === FILE_NAME_FIELD) return want === 'any' ? '' : `${FILE_NAME_FIELD} can't be used here`;
		const i = cols.indexOf(f.column);
		if (i < 0) return `There's no column "${f.column}"`;
		if (want === 'date' && !columnFits(columnTypes[i], 'date')) return `"${f.column}" isn't a Date column`;
		if (want === 'number' && !columnFits(columnTypes[i], 'number')) return `"${f.column}" isn't a Number column`;
		return '';
	}

	function isFormula(value: string): boolean {
		return value.trim().startsWith('=');
	}

	$: problems = [
		problem(mapping.date, 'date', labels, types),
		problem(mapping.payee, 'any', labels, types),
		problem(mapping.narration, 'any', labels, types),
		...mapping.postings.flatMap((p) => [problem(p.account, 'any', labels, types), problem(p.amount, 'number', labels, types), problem(p.currency, 'any', labels, types)]),
		...metaRows.map((r) => problem(r.value, 'any', labels, types)),
		...mapping.tags.map((t) => problem(t, 'any', labels, types)),
		...mapping.links.map((l) => problem(l, 'any', labels, types)),
	].filter(Boolean);

	// --- Live preview ---
	$: result = buildDrafts(dataRows, labels, mapping, { matchAccount: matcher, accounts, fileName });
	$: preview = result.drafts.filter((d) => d.txn).slice(0, PREVIEW_COUNT).map((d) => generateTransactionText(d.txn!));
	$: failed = result.drafts.filter((d) => d.errors.length > 0);
	$: readable = result.drafts.length - failed.length;
	$: constantAccounts = [
		...mapping.postings.map((p) => p.account).filter((a) => a.trim() && !isFormula(a)),
		mapping.unmatchedAccount,
	];
	$: missingAccounts = constantAccounts.filter((a) => a && accounts.length > 0 && !accounts.includes(a.trim()));
	$: canApply = !!mapping.postings[0]?.account.trim() && readable > 0 && problems.length === 0 && !!mapping.unmatchedAccount.trim();
</script>

<datalist id="import-accounts">
	{#each accounts as account}<option value={account} />{/each}
</datalist>

<div class="import-step">
	<div class="column-chips">
		<span class="import-hint">Insert column:</span>
		{#each chipLabels as label}
			<button type="button" class="chip" class:is-builtin={label === FILE_NAME_FIELD}
				on:mousedown|preventDefault on:click={() => insertColumn(label)}>{label}</button>
		{/each}
	</div>
	<p class="import-hint">
		Fill in the transaction as you would in Add Transaction. Text you type is used for every row;
		<code>={'{{Column}}'}</code> takes the value from that column. Click a column above to put it in the field you're editing.
	</p>

	<div class="txn-form">
		<div class="transaction-header-row">
			<div class="form-group">
				<label for="map-date">Date *</label>
				<input id="map-date" type="text" class:is-formula={isFormula(mapping.date)} class:is-invalid={problem(mapping.date, 'date', labels, types)}
					placeholder={'={{Date column}}'} bind:value={mapping.date} use:track={'date'} />
			</div>
			<div class="form-group">
				<label for="map-flag">Flag</label>
				<select id="map-flag" class="dropdown" bind:value={mapping.flag}>
					<option value="*">* Complete</option>
					<option value="!">! Incomplete</option>
				</select>
			</div>
			<div class="form-group">
				<label for="map-payee">Payee</label>
				<input id="map-payee" type="text" class:is-formula={isFormula(mapping.payee)} class:is-invalid={problem(mapping.payee, 'any', labels, types)}
					placeholder="Store name" bind:value={mapping.payee} use:track={'payee'} />
			</div>
			<div class="form-group">
				<label for="map-narration">Narration</label>
				<input id="map-narration" type="text" class:is-formula={isFormula(mapping.narration)} class:is-invalid={problem(mapping.narration, 'any', labels, types)}
					placeholder="Description" bind:value={mapping.narration} use:track={'narration'} />
			</div>
			<button type="button" class="metadata-toggle-btn" class:active={showMetadata}
				on:click={() => (showMetadata = !showMetadata)} title="Transaction metadata">📋</button>
		</div>

		{#if showMetadata}
			<div class="transaction-metadata-section">
				<h5>Transaction metadata</h5>
				{#each metaRows as row, i}
					<div class="metadata-item">
						<input type="text" class="metadata-key" placeholder="key" bind:value={row.key}
							readonly={row.key === IMPORT_REF_KEY && i === 0} aria-label="Metadata key" />
						<input type="text" class="metadata-value" class:is-formula={isFormula(row.value)} class:is-invalid={problem(row.value, 'any', labels, types)}
							placeholder={row.key === IMPORT_REF_KEY ? 'Blank: generated from the row' : 'value'}
							bind:value={row.value} use:track={`meta-${i}`} aria-label="Metadata value" />
						{#if row.key === IMPORT_REF_KEY && i === 0}
							<span class="import-hint required-note" title="Used to recognise rows that were already imported">required</span>
						{:else}
							<button type="button" class="remove-metadata" on:click={() => (metaRows = metaRows.filter((_, j) => j !== i))}>&times;</button>
						{/if}
					</div>
				{/each}
				<button type="button" class="add-metadata-btn" on:click={() => (metaRows = [...metaRows, { key: '', value: '' }])}>+ Add Metadata</button>
			</div>
		{/if}

		{#each mapping.postings as posting, i}
			<div class="posting-container">
				<div class="posting-row">
					<div class="posting-field">
						<label for="map-account-{i}">Account *{i === 0 ? ' (this statement\'s account)' : ''}</label>
						<input id="map-account-{i}" type="text" list="import-accounts"
							class:is-formula={isFormula(posting.account)} class:is-invalid={problem(posting.account, 'any', labels, types)}
							placeholder={i === 0 ? 'Assets:Bank:Checking' : 'Account name, or ={{Column}} to match aliases'}
							bind:value={posting.account} use:track={`posting-${i}-account`} />
					</div>
					<div class="posting-field">
						<label for="map-amount-{i}">Amount</label>
						<input id="map-amount-{i}" type="text"
							class:is-formula={isFormula(posting.amount)} class:is-invalid={problem(posting.amount, 'number', labels, types)}
							placeholder="Optional amount" bind:value={posting.amount} use:track={`posting-${i}-amount`} />
					</div>
					<div class="posting-field">
						<label for="map-currency-{i}">Currency</label>
						<input id="map-currency-{i}" type="text"
							class:is-formula={isFormula(posting.currency)} class:is-invalid={problem(posting.currency, 'any', labels, types)}
							bind:value={posting.currency} use:track={`posting-${i}-currency`} />
					</div>
					{#if mapping.postings.length > 2}
						<button type="button" class="remove-posting" on:click={() => removePosting(i)} title="Remove posting">&times;</button>
					{/if}
				</div>
			</div>
		{/each}
		<button type="button" class="add-posting" on:click={addPosting}>+ Add Posting</button>

		<div class="tags-links-row">
			<div class="form-group">
				<label for="map-tags">Tags</label>
				<input id="map-tags" type="text" placeholder="Tag + Enter" bind:value={tagInput}
					on:keydown={(e) => addEntry(e, 'tags')} use:track={'tags'} />
				{#if mapping.tags.length > 0}
					<div class="entries">
						{#each mapping.tags as tag, i}
							<span class="entry" class:is-formula={isFormula(tag)}>{isFormula(tag) ? tag : `#${tag}`}
								<button type="button" on:click={() => removeEntry('tags', i)} aria-label="Remove tag">&times;</button></span>
						{/each}
					</div>
				{/if}
			</div>
			<div class="form-group">
				<label for="map-links">Links</label>
				<input id="map-links" type="text" placeholder="Link + Enter" bind:value={linkInput}
					on:keydown={(e) => addEntry(e, 'links')} use:track={'links'} />
				{#if mapping.links.length > 0}
					<div class="entries">
						{#each mapping.links as link, i}
							<span class="entry" class:is-formula={isFormula(link)}>{isFormula(link) ? link : `^${link}`}
								<button type="button" on:click={() => removeEntry('links', i)} aria-label="Remove link">&times;</button></span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if problems.length > 0}
		<div class="import-banner is-error">{problems[0]}{problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}</div>
	{/if}

	<details class="import-collapsible">
		<summary><span class="summary-title">Options</span>
			<span class="import-hint">unmatched accounts, running balance</span></summary>
		<div class="options">
			<div class="import-field">
				<label for="map-unmatched">Unmatched accounts go to</label>
				<input id="map-unmatched" type="text" list="import-accounts" bind:value={mapping.unmatchedAccount} />
				<span class="import-hint">For an account taken from a column that isn't an open account or one of your aliases. These transactions get the ! flag.</span>
			</div>
			<label class="inline-check">
				<input type="checkbox" bind:checked={mapping.payeeFromAlias} /> Use the matched alias as payee
			</label>
			<div class="import-field">
				<label for="map-balance">Running balance column</label>
				<select id="map-balance" class="dropdown" value={mapping.balanceColumn ?? -1}
					on:change={(e) => (mapping.balanceColumn = Number(e.currentTarget.value) < 0 ? null : Number(e.currentTarget.value))}>
					<option value={-1}>None</option>
					{#each numberColumns as i}<option value={i}>{labels[i]}</option>{/each}
				</select>
				<span class="import-hint">Checks posting 1's amounts add up row by row, and offers a closing balance assertion.</span>
			</div>
		</div>
	</details>

	<section class="import-section">
		<h4>Preview</h4>
		{#if result.balance?.ok}
			<div class="status is-ok">✓ All {result.drafts.length} rows add up to the running balance · closing balance {result.balance.closing}</div>
		{:else if result.balance && result.balance.breakAt !== undefined}
			<div class="status is-bad">✗ Row {firstRowNumber + result.balance.breakAt} doesn't add up to the running balance. Check the amount column's sign in the Table step.</div>
		{/if}
		{#if failed.length > 0}
			<div class="import-banner is-warning">
				{failed.length} row{failed.length === 1 ? '' : 's'} can't be read:
				{#each failed.slice(0, 3) as d}<div>Row {firstRowNumber + d.sourceIndex}: {d.errors.join('; ')}</div>{/each}
			</div>
		{/if}
		{#each preview as text}
			<pre class="preview">{text}</pre>
		{/each}
		{#if readable > PREVIEW_COUNT}<span class="import-hint">…and {readable - PREVIEW_COUNT} more</span>{/if}
		{#if missingAccounts.length > 0}
			<div class="import-banner is-warning">Not an open account yet: {missingAccounts.join(', ')}</div>
		{/if}
	</section>

	<div class="import-footer">
		<div class="import-field footer-profile">
			<label for="import-profile">Save mapping as</label>
			<input id="import-profile" type="text" bind:value={profileName} />
		</div>
		<button type="button" on:click={onBack}>Back</button>
		<button type="button" class="mod-cta" disabled={!canApply || applying} on:click={onApply}>
			{applying ? 'Checking ledger…' : 'Apply mapping'}
		</button>
	</div>
</div>

<style>
	.column-chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--size-4-1);
	}

	.chip {
		height: auto;
		padding: 2px var(--size-4-2);
		font-size: var(--font-ui-smaller);
		border-radius: var(--radius-l);
	}

	.chip.is-builtin {
		font-style: italic;
	}

	/* Mirrors the Add Transaction form */
	.txn-form {
		display: flex;
		flex-direction: column;
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

	.form-group label, .posting-field label {
		font-size: 0.8rem;
		font-weight: 500;
		margin-bottom: 0.2rem;
		color: var(--text-muted);
	}

	.txn-form input[type="text"] {
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	.txn-form input[type="text"]:focus {
		outline: none;
		border-color: var(--interactive-accent);
	}

	.txn-form input.is-formula, .entry.is-formula {
		font-family: var(--font-monospace);
		color: var(--text-accent);
	}

	.txn-form input.is-invalid {
		border-color: var(--text-error);
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

	.remove-metadata, .remove-posting {
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		height: 26px;
		padding: 0 0.5rem;
	}

	.remove-metadata:hover, .remove-posting:hover {
		color: var(--text-error);
		border-color: var(--text-error);
	}

	.add-metadata-btn {
		align-self: flex-start;
	}

	.posting-container {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 10px;
		margin-bottom: 8px;
	}

	.posting-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr auto;
		gap: 8px;
		align-items: flex-end;
	}

	.posting-field {
		display: flex;
		flex-direction: column;
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

	.tags-links-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-3);
		margin-top: var(--size-4-3);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.entries {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}

	.entry {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 12px;
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.1);
		color: var(--text-accent);
	}

	.entry button {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 0;
		height: auto;
		cursor: pointer;
		color: inherit;
	}

	@media (max-width: 700px) {
		.transaction-header-row, .posting-row, .tags-links-row {
			grid-template-columns: 1fr;
		}
	}

	.import-collapsible {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-2) var(--size-4-3);
	}

	.import-collapsible > summary {
		display: flex;
		align-items: baseline;
		gap: var(--size-4-3);
		cursor: pointer;
	}

	.summary-title {
		font-weight: 600;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
		padding-top: var(--size-4-2);
	}

	.inline-check {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		font-size: var(--font-ui-small);
	}

	.status {
		font-size: var(--font-ui-small);
		margin-bottom: var(--size-4-2);
	}

	.status.is-ok {
		color: var(--text-success);
	}

	.status.is-bad {
		color: var(--text-error);
	}

	.preview {
		margin: 0 0 var(--size-4-2);
		padding: var(--size-4-2);
		background: var(--background-secondary);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
		white-space: pre-wrap;
	}

	.footer-profile {
		margin-right: auto;
		flex-direction: row;
		align-items: center;
	}
</style>
