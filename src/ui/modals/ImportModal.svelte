<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice, TFile } from 'obsidian';
	import type BeancountPlugin from '../../main';
	import { MAPPING_VERSION, type ColumnType, type ImportMapping, type ImportProfile, type TableBounds } from '../../models/import';
	import StepBar from '../common/StepBar.svelte';
	import StepFile from './import/StepFile.svelte';
	import StepTable from './import/StepTable.svelte';
	import StepMapping from './import/StepMapping.svelte';
	import StepReview from './import/StepReview.svelte';
	import { readCsvRows, detectTable, columnLabels, headerSignature, detectStatementBalance, findHeaderRow, tableFromHeader } from '../../utils/import/csvTable';
	import { detectColumnTypes, detectDecimalMark } from '../../utils/import/columns';
	import { blankMapping, buildDrafts, impliedOpening, isPlainField, statementAssertions, statementDifference, type DraftResult, type StatementAssertion } from '../../utils/import/mapping';
	import { parseAmount } from '../../utils/import/values';
	import type { AccountAliases } from '../../utils/import/aliases';
	import { applyAlias, createReviewRows, type ReviewRow } from '../../utils/import/review';
	import { checkOpeningBalance, loadAccountAliases, lookupDuplicates, writeImport, type OpeningBalanceCheck } from '../../services/import.service';
	import { getOpenAccounts } from '../../utils/index';
	import { Logger } from '../../utils/logger';

	export let plugin: BeancountPlugin;
	export let close: () => void;
	export let onComplete: (() => void | Promise<void>) | undefined = undefined;

	type Step = 'file' | 'table' | 'mapping' | 'review';
	const STEPS: { value: Step; label: string; title: string; description: string }[] = [
		{ value: 'file', label: 'Select file', title: 'Select a file',
			description: "Choose the CSV statement to import, and a saved profile if you've imported from the same place before." },
		{ value: 'table', label: 'Identify content', title: 'Identify the content',
			description: 'Show where the transactions are in the file and what each column holds.' },
		{ value: 'mapping', label: 'Define mapping', title: 'Define the mapping',
			description: 'Describe how each row becomes a transaction in your ledger.' },
		{ value: 'review', label: 'Review', title: 'Review',
			description: 'Check what will be added to your ledger before importing.' },
	];
	let step: Step = 'file';
	$: page = STEPS.find((s) => s.value === step)!;

	// Ledger data for account pickers and alias matching.
	let accounts: string[] = [];
	let aliasEntries: AccountAliases[] = [];
	let ledgerError = '';

	onMount(async () => {
		try {
			[accounts, aliasEntries] = await Promise.all([getOpenAccounts(plugin), loadAccountAliases(plugin)]);
		} catch (e) {
			Logger.error('[Import] Failed to load accounts', e);
			ledgerError = `Couldn't read accounts from the ledger: ${e instanceof Error ? e.message : String(e)}`;
		}
	});

	// Step 1: file and profile
	const files: string[] = plugin.app.vault.getFiles()
		.filter((f) => f.extension.toLowerCase() === 'csv')
		.sort((a, b) => b.stat.mtime - a.stat.mtime)
		.map((f) => f.path);
	let filePath = '';
	let rows: string[][] = [];
	let bounds: TableBounds | null = null;
	let fileError = '';
	/** The chosen saved profile, or '' for a new mapping. */
	let profileId = '';

	$: profiles = [...plugin.settings.importProfiles].sort((a, b) => a.name.localeCompare(b.name));
	$: chosenProfile = profiles.find((p) => p.id === profileId) ?? null;

	async function selectFile(path: string) {
		filePath = path;
		rows = [];
		bounds = null;
		fileError = '';
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		try {
			rows = readCsvRows(await plugin.app.vault.cachedRead(file));
			locateTable();
		} catch (e) {
			fileError = `Couldn't read this file as CSV: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	function selectProfile(id: string) {
		profileId = id;
		if (rows.length > 0) locateTable();
	}

	/** Whether the table was found, or has to be marked by hand in the Table step. */
	let tableFound = true;

	/** Uses the chosen profile's header when the file has it, else looks for a table. */
	function locateTable() {
		const profileHeader = chosenProfile ? findHeaderRow(rows, chosenProfile.headerSignature) : -1;
		bounds = profileHeader >= 0 ? tableFromHeader(rows, profileHeader) : detectTable(rows);
		tableFound = bounds !== null;
		if (!bounds) bounds = rows.length > 1 ? { headerRow: 0, firstRow: 1, lastRow: rows.length - 1 } : null;
	}

	$: header = bounds ? rows[bounds.headerRow] ?? [] : [];
	$: labels = columnLabels(header);
	$: dataRows = bounds ? rows.slice(bounds.firstRow, bounds.lastRow + 1) : [];
	$: signature = headerSignature(header);
	$: profileMismatch = !!chosenProfile && rows.length > 0 && findHeaderRow(rows, chosenProfile.headerSignature) < 0;

	// Step 2: column types. Re-guessed when the header or the profile changes; kept otherwise.
	let columnTypes: ColumnType[] = [];
	let decimalMark: '.' | ',' = '.';
	let typesFor = '';

	$: typesKey = `${signature}|${profileId}|${labels.length}`;
	$: if (step === 'table' && typesKey !== typesFor) prepareColumnTypes();

	function prepareColumnTypes() {
		const key = typesKey;
		if (key === typesFor) return;
		const saved = usableProfile(chosenProfile)?.mapping;
		columnTypes = saved
			? JSON.parse(JSON.stringify(saved.columnTypes)) as ColumnType[]
			: detectColumnTypes(dataRows, labels.length);
		decimalMark = saved?.decimalMark ?? detectDecimalMark(dataRows, columnTypes);
		statementAccount = plainAccount(saved?.postings[0]?.account ?? '');
		typesFor = key;
		openingEdited = false;
		closingEdited = false;
	}

	/**
	 * The account this statement belongs to, chosen on page 2. It's the same
	 * value as posting 1's account on page 3, shown in both places; empty when
	 * the file has several accounts and posting 1 is a formula.
	 */
	let statementAccount = '';

	/** An account typed as plain text, or '' for a formula or nothing. */
	function plainAccount(value: string): string {
		return isPlainField(value) ? value.trim() : '';
	}

	// The balances before and after the statement: found in the file when they're there, else typed in. Optional.
	let openingBalance = '';
	let closingBalance = '';
	let openingRow: number | null = null;
	let closingRow: number | null = null;
	/** Once edited by hand, a field is no longer replaced by what's found in the file. */
	let openingEdited = false;
	let closingEdited = false;
	$: if (step === 'table' && bounds && !openingEdited) findOpening(bounds, decimalMark);
	$: if (step === 'table' && bounds && !closingEdited) findClosing(bounds, decimalMark);

	function findOpening(b: TableBounds, mark: '.' | ',') {
		const found = detectStatementBalance(rows, b, mark, 'opening');
		openingBalance = found?.amount ?? '';
		openingRow = found?.row ?? null;
	}

	function findClosing(b: TableBounds, mark: '.' | ',') {
		const found = detectStatementBalance(rows, b, mark, 'closing');
		closingBalance = found?.amount ?? '';
		closingRow = found?.row ?? null;
	}

	/** A balance field as a plain number, or null if it's empty or can't be read. */
	function amountOf(text: string): string | null {
		const t = text.trim();
		return t ? parseAmount(t, decimalMark) ?? parseAmount(t, '.') : null;
	}

	// Step 3: mapping. Rebuilt when anything it was built from changes, keeping what the user typed.
	let mapping: ImportMapping | null = null;
	let mappingFor = '';
	/** The table and profile the current mapping was made for. */
	let mappingSource = '';
	let profileName = '';

	/** A profile saved in the current format for a file with the same number of columns. */
	function usableProfile(p: ImportProfile | null): ImportProfile | null {
		return p && p.mapping.version === MAPPING_VERSION && p.mapping.columnTypes?.length === labels.length ? p : null;
	}

	function prepareMapping() {
		const key = `${signature}|${profileId}|${decimalMark}|${JSON.stringify(columnTypes)}`;
		if (mapping && key === mappingFor) {
			syncStatementAccount(mapping);
			mapping = mapping;
			return;
		}

		const saved = usableProfile(chosenProfile);
		// Without a profile the form starts blank; after a change in the Table step it keeps what was typed.
		const keep = mapping && !saved && mappingSource === `${signature}|${profileId}` ? mapping : null;
		const next: ImportMapping = saved ? JSON.parse(JSON.stringify(saved.mapping)) as ImportMapping
			: keep ? { ...keep }
			: blankMapping(columnTypes, decimalMark);
		next.columnTypes = JSON.parse(JSON.stringify(columnTypes)) as ColumnType[];
		next.decimalMark = decimalMark;
		syncStatementAccount(next);

		mapping = next;
		profileName = chosenProfile?.name ?? (profileName || filePath.split('/').pop()!.replace(/\.csv$/i, ''));
		mappingFor = key;
		mappingSource = `${signature}|${profileId}`;
	}

	/** Posting 1 follows the account chosen on page 2; without one, a typed account is cleared but a formula is kept. */
	function syncStatementAccount(m: ImportMapping) {
		const posting = m.postings[0];
		if (!posting) return;
		if (statementAccount) posting.account = statementAccount;
		else if (isPlainField(posting.account)) posting.account = '';
	}

	/** Posting 1's account and currency when they're typed in, not taken from a column. */
	function statementOf(m: ImportMapping): { account: string; currency: string } | null {
		const p = m.postings[0];
		return p && isPlainField(p.account) && isPlainField(p.currency) && p.account.trim() ? { account: p.account.trim(), currency: p.currency.trim() } : null;
	}

	/** Updates the chosen profile, or saves a new one (replacing a profile with the same name). */
	async function saveProfile(m: ImportMapping) {
		const name = profileName.trim() || 'Bank statement';
		const existing = chosenProfile ?? plugin.settings.importProfiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
		const saved: ImportProfile = {
			id: existing?.id ?? `${Date.now()}`,
			name,
			headerSignature: signature,
			mapping: JSON.parse(JSON.stringify(m)) as ImportMapping,
		};
		plugin.settings.importProfiles = [...plugin.settings.importProfiles.filter((p) => p.id !== saved.id), saved];
		await plugin.saveSettings();
		profileId = saved.id;
		typesFor = `${signature}|${profileId}|${labels.length}`;
		mappingFor = `${signature}|${profileId}|${decimalMark}|${JSON.stringify(columnTypes)}`;
		mappingSource = `${signature}|${profileId}`;
	}

	// Step 4: review
	let result: DraftResult | null = null;
	let reviewRows: ReviewRow[] = [];
	let opening: OpeningBalanceCheck | null = null;
	let statement: { account: string; currency: string } | null = null;
	let assertions: StatementAssertion[] = [];
	/** closing − opening − the rows' amounts, when both balances are given; not "0" means something's off. */
	let difference: string | null = null;
	/** Aliases to add to open directives on import. */
	let pendingAliases: { account: string; alias: string }[] = [];
	let applying = false;

	async function applyMapping() {
		if (!mapping) return;
		applying = true;
		try {
			await saveProfile(mapping);
			result = buildDrafts(dataRows, labels, mapping, { aliases: aliasEntries, fileName: filePath });
			statement = statementOf(mapping);
			const statuses = await lookupDuplicates(plugin, statement?.account ?? '', result.drafts);
			reviewRows = createReviewRows(result.drafts, statuses);

			// Statement balances only apply to a single statement account.
			const before = statementAccount ? amountOf(openingBalance) : null;
			const after = statementAccount ? amountOf(closingBalance) : null;
			const firstDate = result.drafts.find((d) => d.txn)?.txn!.date;
			assertions = statement ? statementAssertions(result.drafts, before, after) : [];
			difference = before !== null && after !== null ? statementDifference(result.drafts, before, after) : null;
			// The ledger should hold the balance before the statement: given, or implied by the one after.
			const expected = before ?? (after === null ? null : impliedOpening(result.drafts, after));
			opening = statement && expected !== null && firstDate
				? await checkOpeningBalance(plugin, statement.account, statement.currency, firstDate, expected)
				: null;
			pendingAliases = [];
			step = 'review';
		} catch (e) {
			Logger.error('[Import] Failed to prepare review', e);
			new Notice(`Couldn't check the statement against the ledger: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			applying = false;
		}
	}

	function rememberAlias(index: number, account: string, alias: string): number {
		pendingAliases = [
			...pendingAliases.filter((p) => p.alias.toLowerCase() !== alias.toLowerCase()),
			{ account, alias },
		];
		const changed = applyAlias(reviewRows, account, alias, index);
		reviewRows = reviewRows;
		return changed.length;
	}

	let importing = false;

	async function submit() {
		if (importing) return;
		importing = true;
		try {
			const transactions = reviewRows.filter((r) => r.include && r.draft.txn).map((r) => r.draft.txn!);
			const balances = statement
				? assertions.filter((a) => a.include).map((a) => ({ date: a.date, account: statement!.account, amount: a.amount, currency: statement!.currency }))
				: [];
			const written = await writeImport(plugin, { transactions, assertions: balances, aliases: pendingAliases });

			const parts = [
				written.transactions > 0 ? `${written.transactions} transaction${written.transactions === 1 ? '' : 's'}` : '',
				written.assertions > 0 ? `${written.assertions} balance assertion${written.assertions === 1 ? '' : 's'}` : '',
				written.aliases > 0 ? `${written.aliases} alias${written.aliases === 1 ? '' : 'es'}` : '',
			].filter(Boolean);
			const somethingWritten = parts.length > 0;
			if (somethingWritten) new Notice(`Imported ${parts.join(', ')}.`);
			if (written.errors.length > 0) {
				new Notice(`Some of the import wasn't written:\n${written.errors.join('\n')}`, 0);
			}
			if (somethingWritten) {
				await onComplete?.();
				close();
			}
		} catch (e) {
			Logger.error('[Import] Failed to write import', e);
			new Notice(`Couldn't write the import: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			importing = false;
		}
	}
</script>

<div class="import-modal">
	<StepBar steps={STEPS} current={step} onSelect={(s) => (step = s)} />

	<div class="import-page-heading">
		<h3>{page.title}</h3>
		<p>{page.description}</p>
	</div>

	{#if ledgerError}
		<div class="import-banner is-error">{ledgerError}</div>
	{/if}

	{#if step === 'file'}
		<StepFile
			{files}
			{filePath}
			{fileError}
			{profiles}
			{profileId}
			{profileMismatch}
			canContinue={bounds !== null}
			onSelectFile={selectFile}
			onSelectProfile={selectProfile}
			onCancel={close}
			onNext={() => (step = 'table')}
		/>
	{:else if step === 'table' && bounds}
		<StepTable
			{rows}
			{accounts}
			bind:statementAccount
			{tableFound}
			bind:bounds
			{labels}
			{dataRows}
			bind:columnTypes
			bind:decimalMark
			bind:openingBalance
			bind:closingBalance
			bind:openingRow
			bind:closingRow
			onEditOpening={() => (openingEdited = true)}
			onEditClosing={() => (closingEdited = true)}
			onBack={() => (step = 'file')}
			onNext={() => { prepareMapping(); step = 'mapping'; }}
		/>
	{:else if step === 'mapping' && mapping && bounds}
		<StepMapping
			{labels}
			onStatementAccount={(account) => (statementAccount = account)}
			{dataRows}
			{accounts}
			fileName={filePath}
			firstRowNumber={bounds.firstRow + 1}
			aliases={aliasEntries}
			bind:mapping
			bind:profileName
			{applying}
			onBack={() => (step = 'table')}
			onApply={applyMapping}
		/>
	{:else if step === 'review' && mapping && result}
		<StepReview
			bind:rows={reviewRows}
			{labels}
			{accounts}
			{opening}
			{statement}
			bind:assertions
			{difference}
			{importing}
			onRememberAlias={rememberAlias}
			onBack={() => (step = 'mapping')}
			onSubmit={submit}
		/>
	{/if}
</div>

<style>
	.import-modal {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.import-page-heading h3 {
		margin: 0;
		font-size: var(--font-ui-large);
	}

	.import-page-heading p {
		margin: var(--size-4-1) 0 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}
</style>
