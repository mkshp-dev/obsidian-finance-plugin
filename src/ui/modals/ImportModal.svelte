<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice, TFile } from 'obsidian';
	import type BeancountPlugin from '../../main';
	import type { ColumnType, ImportMapping, ImportProfile, TableBounds } from '../../models/import';
	import StepBar from '../common/StepBar.svelte';
	import StepFile from './import/StepFile.svelte';
	import StepTable from './import/StepTable.svelte';
	import StepMapping from './import/StepMapping.svelte';
	import StepReview from './import/StepReview.svelte';
	import { readCsvRows, detectTable, columnLabels, headerSignature, detectCurrency, findHeaderRow, tableFromHeader } from '../../utils/import/csvTable';
	import { detectColumnTypes, detectDecimalMark } from '../../utils/import/columns';
	import { buildDrafts, fieldColumn, suggestMapping, type DraftResult } from '../../utils/import/mapping';
	import { createAliasMatcher, type AccountAliases } from '../../utils/import/aliases';
	import { applyAlias, createReviewRows, type ReviewRow } from '../../utils/import/review';
	import { checkOpeningBalance, loadAccountAliases, lookupDuplicates, type OpeningBalanceCheck } from '../../services/import.service';
	import { getOpenAccounts } from '../../utils/index';
	import { Logger } from '../../utils/logger';

	export let plugin: BeancountPlugin;
	export let close: () => void;
	export let onComplete: (() => void | Promise<void>) | undefined = undefined;

	type Step = 'file' | 'table' | 'mapping' | 'review';
	const STEPS: { value: Step; label: string }[] = [
		{ value: 'file', label: 'File' },
		{ value: 'table', label: 'Table' },
		{ value: 'mapping', label: 'Mapping' },
		{ value: 'review', label: 'Review' },
	];
	let step: Step = 'file';

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

	/** Uses the chosen profile's header when the file has it, else looks for a table. */
	function locateTable() {
		fileError = '';
		const profileHeader = chosenProfile ? findHeaderRow(rows, chosenProfile.headerSignature) : -1;
		bounds = profileHeader >= 0 ? tableFromHeader(rows, profileHeader) : detectTable(rows);
		if (!bounds) {
			fileError = "Couldn't find a table of transactions. You can mark the header and last row yourself in the next step.";
			bounds = rows.length > 1 ? { headerRow: 0, firstRow: 1, lastRow: rows.length - 1 } : null;
		}
	}

	$: header = bounds ? rows[bounds.headerRow] ?? [] : [];
	$: labels = columnLabels(header);
	$: dataRows = bounds ? rows.slice(bounds.firstRow, bounds.lastRow + 1) : [];
	$: signature = headerSignature(header);
	$: profileMismatch = !!chosenProfile && rows.length > 0 && findHeaderRow(rows, chosenProfile.headerSignature) < 0;
	$: matcher = createAliasMatcher(aliasEntries);

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
			: detectColumnTypes(dataRows, labels.length, labels);
		decimalMark = saved?.decimalMark ?? detectDecimalMark(dataRows, columnTypes);
		typesFor = key;
	}

	// Step 3: mapping. Rebuilt when anything it was built from changes, keeping what the user typed.
	let mapping: ImportMapping | null = null;
	let mappingFor = '';
	let profileName = '';

	/** A profile saved in the current format for a file with the same number of columns. */
	function usableProfile(p: ImportProfile | null): ImportProfile | null {
		return p && p.mapping.version === 2 && p.mapping.columnTypes?.length === labels.length ? p : null;
	}

	function prepareMapping() {
		const key = `${signature}|${profileId}|${decimalMark}|${JSON.stringify(columnTypes)}`;
		if (mapping && key === mappingFor) return;

		const previous = mapping;
		const saved = usableProfile(chosenProfile);
		const next: ImportMapping = saved
			? JSON.parse(JSON.stringify(saved.mapping)) as ImportMapping
			: suggestMapping(labels, dataRows, detectCurrency(rows, bounds!.headerRow) ?? plugin.settings.operatingCurrency, columnTypes, decimalMark);
		next.columnTypes = JSON.parse(JSON.stringify(columnTypes)) as ColumnType[];
		next.decimalMark = decimalMark;
		// Re-suggested after a change in the Table step: keep what the user had typed.
		if (previous && !saved && next.postings[0] && previous.postings[0]) {
			next.postings[0].account = previous.postings[0].account;
			next.postings[0].currency = previous.postings[0].currency;
			next.unmatchedAccount = previous.unmatchedAccount;
			next.payeeFromAlias = previous.payeeFromAlias;
		}

		mapping = next;
		profileName = chosenProfile?.name ?? (profileName || filePath.split('/').pop()!.replace(/\.csv$/i, ''));
		mappingFor = key;
	}

	/** Posting 1's account and currency when they're typed in, not taken from a column. */
	function statementAccount(m: ImportMapping): { account: string; currency: string } | null {
		const p = m.postings[0];
		return p && !fieldColumn(p.account) && !fieldColumn(p.currency) && p.account.trim() ? { account: p.account.trim(), currency: p.currency.trim() } : null;
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
	}

	// Step 4: review
	let result: DraftResult | null = null;
	let reviewRows: ReviewRow[] = [];
	let opening: OpeningBalanceCheck | null = null;
	let statement: { account: string; currency: string } | null = null;
	let addAssertion = true;
	/** Aliases to add to open directives on import. */
	let pendingAliases: { account: string; alias: string }[] = [];
	let applying = false;

	async function applyMapping() {
		if (!mapping) return;
		applying = true;
		try {
			await saveProfile(mapping);
			result = buildDrafts(dataRows, labels, mapping, { matchAccount: matcher, accounts, fileName: filePath });
			statement = statementAccount(mapping);
			const statuses = await lookupDuplicates(plugin, statement?.account ?? '', result.drafts);
			reviewRows = createReviewRows(result.drafts, statuses);

			const firstDate = result.drafts.find((d) => d.txn)?.txn!.date;
			opening = statement && result.balance?.ok && result.balance.opening !== undefined && firstDate
				? await checkOpeningBalance(plugin, statement.account, statement.currency, firstDate, result.balance.opening)
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
		const changed = applyAlias(reviewRows, account, alias, mapping!, index);
		reviewRows = reviewRows;
		return changed.length;
	}

	function submit() {
		// Writing to the ledger comes in the next stage.
		new Notice(`Ready to import ${reviewRows.filter((r) => r.include).length} transactions (writing isn't built yet).`);
		void onComplete?.();
	}
</script>

<div class="import-modal">
	<StepBar steps={STEPS} current={step} onSelect={(s) => (step = s)} />

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
			transactionCount={dataRows.length}
			canContinue={bounds !== null}
			onSelectFile={selectFile}
			onSelectProfile={selectProfile}
			onCancel={close}
			onNext={() => (step = 'table')}
		/>
	{:else if step === 'table' && bounds}
		<StepTable
			{rows}
			bind:bounds
			{labels}
			{dataRows}
			bind:columnTypes
			bind:decimalMark
			onBack={() => (step = 'file')}
			onNext={() => { prepareMapping(); step = 'mapping'; }}
		/>
	{:else if step === 'mapping' && mapping && bounds}
		<StepMapping
			{labels}
			{dataRows}
			{accounts}
			fileName={filePath}
			firstRowNumber={bounds.firstRow + 1}
			{matcher}
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
			{mapping}
			{accounts}
			{opening}
			{statement}
			closingBalance={statement ? result.closingBalance : null}
			bind:addAssertion
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
</style>
