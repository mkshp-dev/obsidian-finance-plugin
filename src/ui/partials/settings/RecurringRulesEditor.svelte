<!-- src/ui/partials/settings/RecurringRulesEditor.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { Notice, MarkdownView } from 'obsidian';
	import {
		parseRecurringFile,
		applyRecurringEdits,
		validateRecurringFile,
		occurrencesInWindow,
		type RecurringRule,
		type RecurringCadence,
	} from '../../../services/recurring.service';
	import { getOpenAccounts, getCommodities } from '../../../utils/accounts';
	import { getAllCurrenciesQuery } from '../../../queries/index';
	import { parse as parseCsv } from 'csv-parse/sync';
	import { Logger } from '../../../utils/logger';

	export let plugin: any;

	type Editable = RecurringRule & { _localId: string; _draft?: boolean };

	const CADENCES: RecurringCadence[] = [
		'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly',
	];

	let rules: Editable[] = [];
	let originalContent: string = '';
	let resolvedPath: string = '';
	let accounts: string[] = [];
	let currencies: string[] = [];
	let dirty = false;
	let loading = false;
	let saveError: string | null = null;

	const dispatch = createEventDispatcher();

	function newId(): string {
		return Math.random().toString(36).slice(2, 9);
	}

	function resolvePath(): string {
		const explicit = plugin.settings.recurringFilePath?.trim();
		if (explicit) return explicit;
		const folder = plugin.settings.structuredFolderName?.trim() || 'Finances';
		return `${folder}/recurring.beancount`;
	}

	async function loadFile() {
		loading = true;
		saveError = null;
		try {
			resolvedPath = resolvePath();
			const adapter = plugin.app.vault.adapter;
			if (!(await adapter.exists(resolvedPath))) {
				originalContent = '';
				rules = [];
				dirty = false;
				return;
			}
			originalContent = await adapter.read(resolvedPath);
			const parsed = parseRecurringFile(originalContent);
			rules = parsed.map(r => ({ ...r, _localId: newId() }));
			dirty = false;
		} catch (e) {
			saveError = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function loadAutocompleteSources() {
		try {
			// Two sources, unioned: `#commodities` covers every declared
			// commodity (canonical list); `distinct(currency)` from postings
			// catches anything actually transacted.
			const [accs, declaredCommodities, postingsCsv] = await Promise.all([
				getOpenAccounts(plugin),
				getCommodities(plugin).catch(() => [] as Array<{ name: string }>),
				plugin.runQuery(getAllCurrenciesQuery()).catch(() => ''),
			]);
			accounts = accs ?? [];

			const merged = new Set<string>();
			for (const c of declaredCommodities ?? []) {
				if (c?.name) merged.add(c.name);
			}
			if (postingsCsv) {
				const rows = parseCsv(postingsCsv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
				for (const r of rows) {
					const code = (r['currency_'] ?? '').trim();
					if (code) merged.add(code);
				}
			}
			const op = plugin.settings.operatingCurrency;
			if (op) merged.add(op);

			const sorted = Array.from(merged).sort((a, b) => {
				if (op) {
					if (a === op) return -1;
					if (b === op) return 1;
				}
				return a.localeCompare(b);
			});
			if (sorted.length > 0) currencies = sorted;
		} catch (e) {
			Logger.log('[RecurringRulesEditor] failed to load autocomplete sources', e);
		}
	}

	function todayIso(): string {
		return new Date().toISOString().slice(0, 10);
	}

	function addRule() {
		const op = plugin.settings.operatingCurrency || 'USD';
		rules = [...rules, {
			_localId: newId(),
			_draft: true,
			nickname: '',
			cadence: 'monthly',
			expenseAccount: '',
			fundingAccount: '',
			amount: 0,
			currency: op,
			startDate: todayIso(),
		}];
		dirty = true;
	}

	function removeRule(localId: string) {
		rules = rules.filter(r => r._localId !== localId);
		dirty = true;
	}

	function markDirty() {
		dirty = true;
	}

	function ruleIsValid(r: Editable): { ok: boolean; reason?: string } {
		if (!r.nickname.trim()) return { ok: false, reason: 'nickname required' };
		if (!/^[a-zA-Z][a-zA-Z0-9 ._-]*$/.test(r.nickname.trim())) return { ok: false, reason: 'nickname: letters, digits, space, . _ -' };
		if (!CADENCES.includes(r.cadence)) return { ok: false, reason: 'invalid cadence' };
		if (!r.expenseAccount.trim()) return { ok: false, reason: 'destination account required' };
		if (!r.fundingAccount.trim()) return { ok: false, reason: 'funding account required' };
		if (!isFinite(r.amount) || r.amount === 0) return { ok: false, reason: 'amount must be a non-zero number' };
		if (!/^[A-Z][A-Z0-9'._-]*$/.test(r.currency.trim())) return { ok: false, reason: 'invalid currency code' };
		if (!/^\d{4}-\d{2}-\d{2}$/.test(r.startDate.trim())) return { ok: false, reason: 'start-date must be YYYY-MM-DD' };
		return { ok: true };
	}

	function previewOccurrences(r: Editable): string[] {
		const v = ruleIsValid(r);
		if (!v.ok) return [];
		const today = todayIso();
		// One year window — enough to surface 3 occurrences for any cadence.
		const to = (() => {
			const d = new Date(today + 'T00:00:00Z');
			d.setUTCFullYear(d.getUTCFullYear() + 1);
			return d.toISOString().slice(0, 10);
		})();
		return occurrencesInWindow(r as RecurringRule, today, to).slice(0, 3);
	}

	async function save() {
		saveError = null;
		const invalid = rules.find(r => !ruleIsValid(r).ok);
		if (invalid) {
			saveError = `Rule "${invalid.nickname || '(unnamed)'}" is invalid: ${ruleIsValid(invalid).reason}`;
			return;
		}
		try {
			const adapter = plugin.app.vault.adapter;
			const sourceContent = originalContent || '';
			const cleanRules: RecurringRule[] = rules.map(r => ({
				nickname: r.nickname.trim(),
				cadence: r.cadence,
				expenseAccount: r.expenseAccount.trim(),
				fundingAccount: r.fundingAccount.trim(),
				amount: r.amount,
				currency: r.currency.trim().toUpperCase(),
				startDate: r.startDate,
				sourceLine: r._draft ? undefined : r.sourceLine,
			}));
			const newContent = applyRecurringEdits(sourceContent, cleanRules);
			await adapter.write(resolvedPath, newContent);
			new Notice('Recurring rules saved.');
			dispatch('saved');
			await loadFile();
		} catch (e) {
			saveError = e instanceof Error ? e.message : String(e);
		}
	}

	function validate() {
		if (!originalContent) {
			new Notice('No file loaded yet.');
			return;
		}
		const issues = validateRecurringFile(originalContent);
		if (issues.length === 0) {
			new Notice('No issues found.');
		} else {
			const summary = issues.slice(0, 5).map(i => `L${i.line}: ${i.reason}`).join('\n');
			const more = issues.length > 5 ? `\n…and ${issues.length - 5} more` : '';
			new Notice(`${issues.length} issue${issues.length === 1 ? '' : 's'}:\n${summary}${more}`, 10000);
		}
	}

	async function openFileAtLine(line: number | undefined) {
		try {
			const file = plugin.app.vault.getAbstractFileByPath(resolvedPath);
			if (!file) {
				new Notice(`File not found: ${resolvedPath}`);
				return;
			}
			const leaf = plugin.app.workspace.getLeaf(true);
			await leaf.openFile(file as any);
			if (typeof line === 'number') {
				const view = leaf.view;
				if (view instanceof MarkdownView && view.editor) {
					view.editor.setCursor({ line: Math.max(0, line - 1), ch: 0 });
					view.editor.scrollIntoView({ from: { line: line - 1, ch: 0 }, to: { line: line - 1, ch: 0 } }, true);
				}
			}
		} catch (e) {
			new Notice(`Could not open file: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	$: filteredAccountSuggest = (q: string, prefix: 'Expenses' | 'Assets' | 'Income' | '' = '') => {
		const lowered = q.toLowerCase();
		return accounts
			.filter(a => (prefix === '' || a.startsWith(prefix)) && a.toLowerCase().includes(lowered))
			.slice(0, 8);
	};

	onMount(async () => {
		await Promise.all([loadFile(), loadAutocompleteSources()]);
	});
</script>

<div class="recurring-rules-editor">
	<div class="header-row">
		<h4>Rules</h4>
		<div class="actions">
			<button on:click={addRule}>+ Add rule</button>
			<button on:click={validate} title="Parse the file and report any malformed lines">Validate</button>
			<button on:click={loadFile} title="Discard local edits and reload from disk">Reload</button>
			<button on:click={save} disabled={!dirty} class="cta" title="Write changes to {resolvedPath}">Save</button>
		</div>
	</div>

	{#if resolvedPath}
		<div class="path-line">File: <code>{resolvedPath}</code></div>
	{/if}
	{#if loading}
		<p class="muted">Loading…</p>
	{/if}
	{#if saveError}
		<p class="error-msg">{saveError}</p>
	{/if}

	{#if !loading && rules.length === 0}
		<p class="muted">No rules yet — click <strong>+ Add rule</strong> to start.</p>
	{/if}

	<div class="rule-cards">
		{#each rules as rule (rule._localId)}
			{@const valid = ruleIsValid(rule)}
			{@const preview = previewOccurrences(rule)}
			<div class="rule-card" class:invalid={!valid.ok}>
				<div class="card-row title-row">
					<input
						class="nickname"
						type="text"
						placeholder="nickname"
						bind:value={rule.nickname}
						on:input={markDirty}
					/>
					<select
						class="cadence"
						bind:value={rule.cadence}
						on:change={markDirty}
					>
						{#each CADENCES as c}
							<option value={c}>{c}</option>
						{/each}
					</select>
					<button
						class="ghost"
						on:click={() => openFileAtLine(rule.sourceLine)}
						disabled={!rule.sourceLine}
						title={rule.sourceLine ? `Open ${resolvedPath} at line ${rule.sourceLine}` : 'New rule — save first to enable jump'}
					>↗ Open</button>
					<button class="danger ghost" on:click={() => removeRule(rule._localId)} title="Remove rule">✕</button>
				</div>

				<div class="card-row">
					<label class="field">
						<span>Destination</span>
						<input
							type="text"
							list="recurring-accounts-{rule._localId}"
							placeholder={rule.amount >= 0 && rule.fundingAccount.startsWith('Income') ? 'Assets:Bank…' : 'Expenses:…'}
							bind:value={rule.expenseAccount}
							on:input={markDirty}
						/>
						<datalist id="recurring-accounts-{rule._localId}">
							{#each filteredAccountSuggest(rule.expenseAccount) as acc}
								<option value={acc} />
							{/each}
						</datalist>
					</label>

					<label class="field">
						<span>Funding</span>
						<input
							type="text"
							list="recurring-funding-{rule._localId}"
							placeholder="Assets:Banking:…"
							bind:value={rule.fundingAccount}
							on:input={markDirty}
						/>
						<datalist id="recurring-funding-{rule._localId}">
							{#each filteredAccountSuggest(rule.fundingAccount) as acc}
								<option value={acc} />
							{/each}
						</datalist>
					</label>
				</div>

				<div class="card-row">
					<label class="field amount">
						<span>Amount</span>
						<input
							type="number"
							step="0.01"
							bind:value={rule.amount}
							on:input={markDirty}
						/>
					</label>

					<label class="field currency">
						<span>Currency</span>
						<select
							bind:value={rule.currency}
							on:change={markDirty}
						>
							{#if rule.currency && !currencies.includes(rule.currency)}
								<option value={rule.currency}>{rule.currency}</option>
							{/if}
							{#each currencies as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</label>

					<label class="field date">
						<span>Start date</span>
						<input
							type="date"
							bind:value={rule.startDate}
							on:input={markDirty}
						/>
					</label>
				</div>

				{#if !valid.ok}
					<div class="card-row issue">⚠ {valid.reason}</div>
				{:else if preview.length > 0}
					<div class="card-row preview" title="Next up to 3 occurrences within a year of today">
						Next:
						{#each preview as p, i}
							<span class="pill">{p}</span>{#if i < preview.length - 1}{' '}{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.recurring-rules-editor {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.header-row h4 {
		margin: 0;
	}
	.header-row .actions {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.header-row .actions button {
		padding: 4px 10px;
		border-radius: var(--radius-s);
	}
	.cta {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
	.cta[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.path-line {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.muted { color: var(--text-muted); }

	.error-msg {
		color: var(--color-red);
		font-size: var(--font-ui-small);
	}

	.rule-cards {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.rule-card {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--background-secondary);
	}
	.rule-card.invalid {
		border-color: var(--color-red);
	}

	.card-row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.title-row .nickname {
		flex: 1 1 auto;
		min-width: 140px;
		font-weight: 600;
	}
	.title-row .cadence {
		flex: 0 0 auto;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1 1 200px;
	}
	.field span {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}
	.field input,
	.field select {
		width: 100%;
	}
	.field.amount,
	.field.currency,
	.field.date {
		flex: 0 0 auto;
		min-width: 110px;
	}
	.field.amount input { width: 110px; }

	.ghost {
		background: transparent;
	}
	.danger {
		color: var(--color-red);
	}

	.issue {
		color: var(--color-red);
		font-size: var(--font-ui-small);
	}

	.preview {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.pill {
		display: inline-block;
		padding: 1px 8px;
		border-radius: 999px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		font-variant-numeric: tabular-nums;
		margin-right: 4px;
	}
</style>
