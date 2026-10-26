<script lang="ts">
	import { tick } from 'svelte';
	import { FILE_NAME_FIELD, IMPORT_REF_KEY, type ImportMapping } from '../../../models/import';
	import { buildDrafts, checkField, parseField, typeEnv, type DraftResult, type FieldWant } from '../../../utils/import/mapping';
	import type { AccountAliases } from '../../../utils/import/aliases';
	import { columnFits } from '../../../utils/import/columns';
	import { functionHelp, resultTexts, type FunctionName } from '../../../utils/import/expression';
	import { generateTransactionText } from '../../../utils/directives/transactionDirectives';
	import FieldCount from './FieldCount.svelte';
	import HelpTip from '../../common/HelpTip.svelte';
	import TabBar from '../../common/TabBar.svelte';

	export let labels: string[] = [];
	export let dataRows: string[][] = [];
	export let accounts: string[] = [];
	export let fileName = '';
	/** Row number of the first transaction, for pointing at rows in messages. */
	export let firstRowNumber = 1;
	/** Aliases from open directives, for lookups. */
	export let aliases: AccountAliases[] = [];
	export let mapping: ImportMapping;
	export let profileName = '';
	export let applying = false;
	/** Told the account posting 1 now has when it's plain text, or '' for a formula: page 2 shows the same value. */
	export let onStatementAccount: (account: string) => void = () => {};
	export let onBack: () => void;
	export let onApply: () => void;

	$: types = mapping.columnTypes;
	$: onStatementAccount(isFormula(mapping.postings[0]?.account ?? '') ? '' : (mapping.postings[0]?.account ?? '').trim());
	$: env = typeEnv(labels, types);
	$: chipLabels = [...labels.filter((_, i) => columnFits(types[i], 'any')), FILE_NAME_FIELD];
	$: numberColumns = labels.map((_, i) => i).filter((i) => types[i]?.kind === 'number');

	// --- Fields, by key: 'date', 'payee', 'narration', 'posting-0-amount', 'meta-1', 'tags'… ---
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

	function getField(key: string): string {
		const posting = /^posting-(\d+)-(account|amount|currency)$/.exec(key);
		if (posting) return mapping.postings[Number(posting[1])][posting[2] as 'account' | 'amount' | 'currency'];
		if (key.startsWith('meta-')) return metaRows[Number(key.slice(5))]?.value ?? '';
		if (key === 'date' || key === 'payee' || key === 'narration') return mapping[key];
		return '';
	}

	/** What a field has to produce. */
	function wantOf(key: string): FieldWant {
		return key === 'date' ? 'date' : /^posting-\d+-amount$/.test(key) ? 'number' : 'text';
	}

	function isFormula(value: string): boolean {
		return value.trim().startsWith('=');
	}

	/**
	 * Puts formula text into the field edited last: at the cursor when it
	 * already holds a formula (like clicking a cell in Excel), otherwise as a
	 * new formula. Tags and links get a new entry. `select`, a part of the
	 * snippet, is left selected to be typed over.
	 */
	async function insert(snippet: string, select?: string) {
		const key = lastFocused;
		const el = elements[key];
		const current = getField(key);
		let at: number;
		if (key !== 'tags' && key !== 'links' && isFormula(current) && el) {
			const start = el.selectionStart ?? current.length;
			const end = el.selectionEnd ?? start;
			setField(key, current.slice(0, start) + snippet + current.slice(end));
			at = start;
		} else {
			setField(key, `=${snippet}`);
			at = 1;
		}
		await tick();
		if (!el) return;
		el.focus();
		const part = select ? snippet.indexOf(select) : -1;
		if (part >= 0) el.setSelectionRange(at + part, at + part + select!.length);
		else el.setSelectionRange(at + snippet.length, at + snippet.length);
	}

	// --- Function chips, grouped by what they work on ---
	/** The column formulas usually start from: the narration's column, else the first text column. */
	function textColumn(): string {
		const f = parseField(mapping.narration);
		if ('expr' in f && f.expr.type === 'column' && labels.includes(f.expr.name)) return f.expr.name;
		return labels.find((_, i) => types[i]?.kind === 'text') ?? labels[0] ?? '';
	}

	/** The first Date or Date & time column. */
	function dateColumn(): string {
		return labels.find((_, i) => types[i]?.kind === 'date' || types[i]?.kind === 'datetime') ?? labels[0] ?? '';
	}

	function numberColumn(): string {
		const f = parseField(mapping.postings[0]?.amount ?? '');
		if ('expr' in f && f.expr.type === 'column') return f.expr.name;
		return labels[numberColumns[0]] ?? '';
	}

	/** `select`: a placeholder in the built text, selected after inserting so it's typed over. */
	type Snippet = { label: string; help: string; build: () => string; select?: string };
	/** Where unmatched rows go: left for the user to choose, and not an account until they do. */
	const ELSE_PLACEHOLDER = 'Expenses:…';
	const fn = (name: FunctionName, build: () => string): Snippet => ({ label: name, help: functionHelp(name), build });
	const GROUPS: { name: 'Logic' | 'Text' | 'Number' | 'Date'; snippets: Snippet[] }[] = [
		{ name: 'Logic', snippets: [
			{ label: 'IF', help: 'IF condition THEN value ELSE value', build: () => `IF {{${textColumn()}}} CONTAINS "text" THEN "value" ELSE "value"` },
			{ label: 'ACCOUNT WHERE', help: 'The account whose alias matches the text', build: () => `ACCOUNT WHERE {{${textColumn()}}} CONTAINS ALIAS ELSE "${ELSE_PLACEHOLDER}"`, select: ELSE_PLACEHOLDER },
			{ label: 'ALIAS WHERE', help: 'The alias that matched, e.g. as a tidy payee', build: () => `ALIAS WHERE {{${textColumn()}}} CONTAINS ALIAS` },
		] },
		{ name: 'Text', snippets: [
			fn('SPLIT', () => `SPLIT({{${textColumn()}}}, "/", 2)`),
			fn('TRIM', () => `TRIM({{${textColumn()}}})`),
			fn('UPPER', () => `UPPER({{${textColumn()}}})`),
			fn('LOWER', () => `LOWER({{${textColumn()}}})`),
			fn('REPLACE', () => `REPLACE({{${textColumn()}}}, "find", "with")`),
			fn('FIRST', () => `FIRST({{${textColumn()}}}, "")`),
		] },
		{ name: 'Number', snippets: [
			fn('ABS', () => `ABS({{${numberColumn()}}})`),
			fn('ROUND', () => `ROUND({{${numberColumn()}}}, 2)`),
		] },
		{ name: 'Date', snippets: [
			fn('FORMAT_DATE', () => `FORMAT_DATE({{${dateColumn()}}}, "YYYY-MM-DD")`),
			fn('YEAR', () => `YEAR({{${dateColumn()}}})`),
			fn('MONTH', () => `MONTH({{${dateColumn()}}})`),
			fn('DAY', () => `DAY({{${dateColumn()}}})`),
			fn('ADD_DAYS', () => `ADD_DAYS({{${dateColumn()}}}, 1)`),
			fn('DATE', () => `DATE({{${textColumn()}}}, "DD/MM/YYYY")`),
		] },
	];
	// --- Insert panel: one tab of chips at a time ---
	type InsertTab = 'Columns' | (typeof GROUPS)[number]['name'];
	const INSERT_TABS = [{ value: 'Columns', label: 'Columns' }, ...GROUPS.map((g) => ({ value: g.name, label: g.name }))];
	let insertTab: InsertTab = 'Columns';
	function selectInsertTab(tab: string) { insertTab = tab as InsertTab; }
	$: snippets = GROUPS.find((g) => g.name === insertTab)?.snippets ?? [];

	/** On a function tab, moving to a date or number field shows the functions for it. */
	let tabFollows = lastFocused;
	$: if (lastFocused !== tabFollows) {
		tabFollows = lastFocused;
		const want = wantOf(lastFocused);
		if (insertTab !== 'Columns' && want !== 'text') insertTab = want === 'number' ? 'Number' : 'Date';
	}

	/** The field chips insert into, as shown above them. */
	function fieldName(key: string): string {
		const posting = /^posting-(\d+)-(account|amount|currency)$/.exec(key);
		if (posting) return `Posting ${Number(posting[1]) + 1} ${posting[2]}`;
		if (key.startsWith('meta-')) return metaRows[Number(key.slice(5))]?.key.trim() || 'Metadata';
		return key.charAt(0).toUpperCase() + key.slice(1);
	}

	// --- Metadata rows, kept as a list so keys can be edited; import-ref stays first ---
	function rowsOf(metadata: Record<string, string>) {
		const rows = Object.entries(metadata)
			.sort(([a], [b]) => (a === IMPORT_REF_KEY ? -1 : b === IMPORT_REF_KEY ? 1 : 0))
			.map(([key, value]) => ({ key, value }));
		if (!rows.some((r) => r.key === IMPORT_REF_KEY)) rows.unshift({ key: IMPORT_REF_KEY, value: '' });
		return rows;
	}
	let metaRows = rowsOf(mapping.metadata);
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
	/** What's wrong with a field, or '' if nothing. */
	function problem(value: string, want: FieldWant, e: typeof env): string {
		return checkField(value, want, e);
	}

	$: problems = [
		problem(mapping.date, 'date', env),
		problem(mapping.payee, 'text', env),
		problem(mapping.narration, 'text', env),
		...mapping.postings.flatMap((p) => [problem(p.account, 'text', env), problem(p.amount, 'number', env), problem(p.currency, 'text', env)]),
		...metaRows.map((r) => problem(r.value, 'text', env)),
		...mapping.tags.map((t) => problem(t, 'text', env)),
		...mapping.links.map((l) => problem(l, 'text', env)),
	].filter(Boolean);

	// --- Live preview ---
	$: result = buildDrafts(dataRows, labels, mapping, { aliases, fileName });
	$: failed = result.drafts.filter((d) => d.errors.length > 0);
	$: readable = result.drafts.length - failed.length;

	/** The draft shown in the preview, stepped through with the arrows. Kept in range as the mapping changes. */
	let previewIndex = 0;
	$: if (previewIndex > result.drafts.length - 1) previewIndex = Math.max(0, result.drafts.length - 1);
	$: shown = result.drafts[previewIndex] ?? null;

	function showDraft(draft: (typeof result.drafts)[number]) {
		previewIndex = Math.max(0, result.drafts.indexOf(draft));
	}

	// --- How many rows each field gave a value for, shown next to its label ---
	/** A field's name in error messages and in the drafts' per-field results. */
	function whatOf(key: string): string {
		const posting = /^posting-(\d+)-(account|amount|currency)$/.exec(key);
		if (posting) return `Posting ${Number(posting[1]) + 1} ${posting[2]}`;
		if (key.startsWith('meta-')) {
			const k = metaRows[Number(key.slice(5))]?.key.trim() ?? '';
			return k === IMPORT_REF_KEY ? IMPORT_REF_KEY : `Metadata "${k}"`;
		}
		return key[0].toUpperCase() + key.slice(1);
	}

	/** Nothing for an empty or broken field; otherwise rows that got a value, and how alias lookups went. */
	function countFor(key: string, value: string, r: DraftResult) {
		if (!value.trim() || problem(value, wantOf(key), env)) return null;
		const what = whatOf(key);
		const looked = r.drafts.filter((d) => d.lookups?.[what] !== undefined);
		return {
			filled: r.drafts.filter((d) => d.filled?.[what]).length,
			total: r.drafts.length,
			looked: looked.length,
			matched: looked.filter((d) => d.lookups![what]).length,
		};
	}

	$: constantAccounts = mapping.postings.flatMap((p) => {
		const f = parseField(p.account);
		if ('text' in f) return f.text ? [f.text] : [];
		return 'expr' in f ? resultTexts(f.expr) : [];
	});
	$: missingAccounts = constantAccounts.filter((a) => a && accounts.length > 0 && !accounts.includes(a.trim()));
	$: canApply = !!mapping.postings[0]?.account.trim() && readable > 0 && problems.length === 0;
</script>

<datalist id="import-accounts">
	{#each accounts as account}<option value={account} />{/each}
</datalist>

<div class="import-step">
	<div class="insert-panel">
		<div class="insert-head">
			<TabBar tabs={INSERT_TABS} value={insertTab} fullWidth={false} ariaLabel="Insert into the field"
				on:change={(e) => selectInsertTab(e.detail)} />
			<span class="import-hint insert-target">Inserts into <strong>{fieldName(lastFocused)}</strong></span>
			<HelpTip topic="importTemplate" />
		</div>
		<div class="insert-chips">
			{#if insertTab === 'Columns'}
				{#each chipLabels as label}
					<button type="button" class="chip" class:is-builtin={label === FILE_NAME_FIELD}
						on:mousedown|preventDefault on:click={() => insert(`{{${label}}}`)}>{label}</button>
				{/each}
			{:else}
				{#each snippets as snippet (snippet.label)}
					<button type="button" class="chip is-function" title={snippet.help}
						on:mousedown|preventDefault on:click={() => insert(snippet.build(), snippet.select)}>{snippet.label}</button>
				{/each}
			{/if}
		</div>
	</div>
	<div class="txn-form">
		<div class="transaction-header-row">
			<div class="form-group">
				<label for="map-date">Date * <FieldCount count={countFor('date', mapping.date, result)} /></label>
				<input id="map-date" type="text" class:is-formula={isFormula(mapping.date)} class:is-invalid={problem(mapping.date, 'date', env)}
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
				<label for="map-payee">Payee <FieldCount count={countFor('payee', mapping.payee, result)} /></label>
				<input id="map-payee" type="text" class:is-formula={isFormula(mapping.payee)} class:is-invalid={problem(mapping.payee, 'text', env)}
					placeholder="Store name" bind:value={mapping.payee} use:track={'payee'} />
			</div>
			<div class="form-group">
				<label for="map-narration">Narration <FieldCount count={countFor('narration', mapping.narration, result)} /></label>
				<input id="map-narration" type="text" class:is-formula={isFormula(mapping.narration)} class:is-invalid={problem(mapping.narration, 'text', env)}
					placeholder="Description" bind:value={mapping.narration} use:track={'narration'} />
			</div>
			<button type="button" class="metadata-toggle-btn" class:active={showMetadata}
				on:click={() => (showMetadata = !showMetadata)} title="Transaction metadata">📋</button>
		</div>

		{#if showMetadata}
			<div class="transaction-metadata-section">
				<h5>Transaction metadata <HelpTip topic="importMetadata" /></h5>
				{#each metaRows as row, i}
					<div class="metadata-item">
						<input type="text" class="metadata-key" placeholder="key" bind:value={row.key}
							readonly={row.key === IMPORT_REF_KEY && i === 0} aria-label="Metadata key" />
						<div class="metadata-value-wrap">
							<FieldCount count={countFor(`meta-${i}`, row.value, result)} />
							<input type="text" class="metadata-value" class:is-formula={isFormula(row.value)} class:is-invalid={problem(row.value, 'text', env)}
								placeholder="value"
								bind:value={row.value} use:track={`meta-${i}`} aria-label="Metadata value" />
						</div>
						{#if row.key === IMPORT_REF_KEY && i === 0}
							<span class="import-hint required-note">required</span>
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
						<label for="map-account-{i}">Account *{i === 0 ? ' (this statement\'s account)' : ''} <FieldCount count={countFor(`posting-${i}-account`, posting.account, result)} /></label>
						<input id="map-account-{i}" type="text" list="import-accounts"
							class:is-formula={isFormula(posting.account)} class:is-invalid={problem(posting.account, 'text', env)}
							placeholder="Account name"
							bind:value={posting.account} use:track={`posting-${i}-account`} />
					</div>
					<div class="posting-field">
						<label for="map-amount-{i}">Amount <FieldCount count={countFor(`posting-${i}-amount`, posting.amount, result)} /></label>
						<input id="map-amount-{i}" type="text"
							class:is-formula={isFormula(posting.amount)} class:is-invalid={problem(posting.amount, 'number', env)}
							bind:value={posting.amount} use:track={`posting-${i}-amount`} />
					</div>
					<div class="posting-field">
						<label for="map-currency-{i}">Currency <FieldCount count={countFor(`posting-${i}-currency`, posting.currency, result)} /></label>
						<input id="map-currency-{i}" type="text"
							class:is-formula={isFormula(posting.currency)} class:is-invalid={problem(posting.currency, 'text', env)}
							bind:value={posting.currency} use:track={`posting-${i}-currency`} />
					</div>
					{#if mapping.postings.length > 2 && i > 0}
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

	<section class="import-section">
		<div class="preview-head">
			<h4>Preview</h4>
			{#if shown}
				<span class="import-hint">Transaction {previewIndex + 1} of {result.drafts.length} · row {firstRowNumber + shown.sourceIndex} of the file</span>
				<div class="nav-arrows">
					<button type="button" on:click={() => previewIndex--} disabled={previewIndex === 0} aria-label="Previous transaction">‹</button>
					<button type="button" on:click={() => previewIndex++} disabled={previewIndex >= result.drafts.length - 1} aria-label="Next transaction">›</button>
				</div>
			{/if}
		</div>
		{#if failed.length > 0}
			<div class="import-banner is-warning">
				{failed.length} row{failed.length === 1 ? '' : 's'} can't be read:
				{#each failed.slice(0, 3) as d}
					<div><button type="button" class="link-button" on:click={() => showDraft(d)}>Row {firstRowNumber + d.sourceIndex}</button>: {d.errors.join('; ')}</div>
				{/each}
			</div>
		{/if}
		{#if shown?.txn}
			<pre class="preview">{generateTransactionText(shown.txn)}</pre>
		{:else if shown}
			<div class="preview is-unreadable">
				<div>This row can't be read: {shown.errors.join('; ')}</div>
				<code>{shown.cells.join(' | ')}</code>
			</div>
		{/if}
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
	.insert-panel {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
		padding: var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}

	.insert-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--size-4-2);
	}

	.insert-head :global(.tab-bar-item) {
		padding: 3px 10px;
		font-size: var(--font-ui-smaller);
	}

	.insert-target {
		margin-left: auto;
	}

	.insert-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-1);
		min-height: 24px;
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

	.chip.is-function {
		font-family: var(--font-monospace);
		color: var(--text-accent);
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

	.metadata-value-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}

	.metadata-value-wrap input {
		width: 100%;
	}

	.metadata-item {
		align-items: end;
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

	.preview-head {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.preview-head h4 {
		margin: 0;
		margin-right: auto;
	}

	.nav-arrows {
		display: flex;
		gap: var(--size-4-1);
	}

	.link-button {
		all: unset;
		cursor: pointer;
		color: var(--text-accent);
		text-decoration: underline;
	}

	.preview.is-unreadable {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
		color: var(--text-error);
	}

	.preview.is-unreadable code {
		color: var(--text-muted);
		white-space: pre-wrap;
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
