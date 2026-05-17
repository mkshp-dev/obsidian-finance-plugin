<!-- src/ui/modals/RecurringEditModal.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		occurrencesInWindow,
		type RecurringRule,
		type RecurringCadence,
	} from '../../services/recurring.service';

	export let initial: RecurringRule;
	export let mode: 'add' | 'edit' = 'add';
	export let accounts: string[] = [];
	export let currencies: string[] = [];

	const dispatch = createEventDispatcher();

	const CADENCES: { value: RecurringCadence; label: string; hint: string }[] = [
		{ value: 'daily', label: 'Daily', hint: 'every day' },
		{ value: 'weekly', label: 'Weekly', hint: 'every 7 days' },
		{ value: 'biweekly', label: 'Biweekly', hint: 'every 14 days' },
		{ value: 'monthly', label: 'Monthly', hint: 'same day of month' },
		{ value: 'quarterly', label: 'Quarterly', hint: 'every 3 months' },
		{ value: 'semiannual', label: 'Semiannual', hint: 'every 6 months' },
		{ value: 'yearly', label: 'Yearly', hint: 'same date each year' },
	];

	// Patterns are pure UI sugar — they don't change the on-disk format.
	// They adjust the labels, placeholders and combobox bias so the form
	// makes sense for non-Expense flows (loan payment → Liabilities, salary
	// → Assets from Income, savings → Equity, asset transfer → Assets).
	type Pattern = 'expense' | 'income' | 'liability' | 'equity' | 'transfer' | 'custom';

	interface PatternConfig {
		value: Pattern;
		label: string;
		icon: string;
		blurb: string;
		fromLabel: string;
		fromHint: string;
		fromPrefix: string;          // root account suggested in the From field
		fromPlaceholder: string;
		toLabel: string;
		toHint: string;
		toPrefix: string;            // root account suggested in the To field
		toPlaceholder: string;
	}

	const PATTERNS: PatternConfig[] = [
		{
			value: 'expense',
			label: 'Expense',
			icon: '💸',
			blurb: 'Recurring bill, subscription or living cost.',
			fromLabel: 'Paid from',
			fromHint: 'Asset account the money leaves (Assets:Bank:…)',
			fromPrefix: 'Assets',
			fromPlaceholder: 'Assets:Bank:Checking',
			toLabel: 'Paid to',
			toHint: 'Expense category that records the cost.',
			toPrefix: 'Expenses',
			toPlaceholder: 'Expenses:Housing:Rent',
		},
		{
			value: 'income',
			label: 'Income',
			icon: '💰',
			blurb: 'Salary, repayment received, recurring income.',
			fromLabel: 'Income source',
			fromHint: 'Income account that books the inflow.',
			fromPrefix: 'Income',
			fromPlaceholder: 'Income:Salary',
			toLabel: 'Received into',
			toHint: 'Asset account that grows.',
			toPrefix: 'Assets',
			toPlaceholder: 'Assets:Bank:Checking',
		},
		{
			value: 'liability',
			label: 'Liability payment',
			icon: '🏦',
			blurb: 'Paying down a credit card, loan, or mortgage.',
			fromLabel: 'Paid from',
			fromHint: 'Asset account that funds the payment.',
			fromPrefix: 'Assets',
			fromPlaceholder: 'Assets:Bank:Checking',
			toLabel: 'Liability reduced',
			toHint: 'Liability account whose balance shrinks.',
			toPrefix: 'Liabilities',
			toPlaceholder: 'Liabilities:Credit:Visa',
		},
		{
			value: 'equity',
			label: 'Savings / Equity',
			icon: '📈',
			blurb: 'Investment contribution, retirement savings.',
			fromLabel: 'Drawn from',
			fromHint: 'Asset account that funds the contribution.',
			fromPrefix: 'Assets',
			fromPlaceholder: 'Assets:Bank:Checking',
			toLabel: 'Equity / savings',
			toHint: 'Equity or savings account that grows.',
			toPrefix: 'Equity',
			toPlaceholder: 'Equity:Retirement:401k',
		},
		{
			value: 'transfer',
			label: 'Asset transfer',
			icon: '↔',
			blurb: 'Move money between two of your accounts.',
			fromLabel: 'From',
			fromHint: 'Source asset account.',
			fromPrefix: 'Assets',
			fromPlaceholder: 'Assets:Bank:Checking',
			toLabel: 'To',
			toHint: 'Destination asset account.',
			toPrefix: 'Assets',
			toPlaceholder: 'Assets:Bank:Savings',
		},
		{
			value: 'custom',
			label: 'Custom',
			icon: '🛠',
			blurb: 'Any-to-any flow. No prefix bias.',
			fromLabel: 'From account',
			fromHint: 'Any valid account path.',
			fromPrefix: '',
			fromPlaceholder: 'Assets:…',
			toLabel: 'To account',
			toHint: 'Any valid account path.',
			toPrefix: '',
			toPlaceholder: 'Expenses:…',
		},
	];

	function detectPattern(rule: RecurringRule): Pattern {
		const f = (rule.fundingAccount ?? '').trim();
		const e = (rule.expenseAccount ?? '').trim();
		const fromIs = (root: string) => f === root || f.startsWith(root + ':');
		const toIs = (root: string) => e === root || e.startsWith(root + ':');
		if (fromIs('Income') && toIs('Assets')) return 'income';
		if (fromIs('Assets') && toIs('Liabilities')) return 'liability';
		if (fromIs('Assets') && toIs('Equity')) return 'equity';
		if (fromIs('Assets') && toIs('Assets')) return 'transfer';
		if (fromIs('Assets') && toIs('Expenses')) return 'expense';
		// Empty form (add mode) → default to expense; otherwise custom.
		if (!f && !e) return 'expense';
		return 'custom';
	}

	let pattern: Pattern = detectPattern(initial);

	$: patternCfg = PATTERNS.find(p => p.value === pattern) ?? PATTERNS[0];

	let draft: RecurringRule = {
		nickname: initial.nickname ?? '',
		cadence: initial.cadence ?? 'monthly',
		expenseAccount: initial.expenseAccount ?? '',
		fundingAccount: initial.fundingAccount ?? '',
		amount: initial.amount ?? 0,
		currency: initial.currency ?? (currencies[0] ?? 'USD'),
		startDate: initial.startDate ?? new Date().toISOString().slice(0, 10),
		sourceLine: initial.sourceLine,
	};

	function applyPatternPrefixes() {
		// Only fill empty fields — never clobber what the user already typed.
		if (!draft.fundingAccount.trim() && patternCfg.fromPrefix) {
			draft.fundingAccount = patternCfg.fromPrefix + ':';
		}
		if (!draft.expenseAccount.trim() && patternCfg.toPrefix) {
			draft.expenseAccount = patternCfg.toPrefix + ':';
		}
	}

	function changePattern(p: Pattern) {
		pattern = p;
		applyPatternPrefixes();
	}

	let errors: Record<string, string> = {};

	$: expenseSuggestions = filterAccounts(draft.expenseAccount, accounts, patternCfg.toPrefix);
	$: fundingSuggestions = filterAccounts(draft.fundingAccount, accounts, patternCfg.fromPrefix);

	function filterAccounts(query: string, all: string[], preferPrefix: string): string[] {
		const q = (query ?? '').trim().toLowerCase();
		const matched = q
			? all.filter(a => a.toLowerCase().includes(q))
			: all.slice();
		if (!preferPrefix) return matched.slice(0, 12);
		// Prefix-matching entries float to the top so the suggestion list
		// reflects the active pattern (Liability payment → Liabilities:* first).
		const inPrefix = matched.filter(a => a === preferPrefix || a.startsWith(preferPrefix + ':'));
		const rest = matched.filter(a => !(a === preferPrefix || a.startsWith(preferPrefix + ':')));
		return [...inPrefix, ...rest].slice(0, 12);
	}

	type ComboField = 'expense' | 'funding';
	let comboOpen: Record<ComboField, boolean> = { expense: false, funding: false };
	let comboIdx: Record<ComboField, number> = { expense: -1, funding: -1 };

	function openCombo(which: ComboField) {
		comboOpen = { ...comboOpen, [which]: true };
		comboIdx = { ...comboIdx, [which]: -1 };
	}
	function closeCombo(which: ComboField) {
		setTimeout(() => {
			comboOpen = { ...comboOpen, [which]: false };
		}, 120);
	}
	function pickSuggestion(which: ComboField, value: string) {
		if (which === 'expense') draft.expenseAccount = value;
		else draft.fundingAccount = value;
		comboOpen = { ...comboOpen, [which]: false };
	}
	function isCreatable(which: ComboField, suggestions: string[]): boolean {
		const value = which === 'expense' ? draft.expenseAccount : draft.fundingAccount;
		const v = (value ?? '').trim();
		if (!v) return false;
		if (!/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(v)) return false;
		return !suggestions.some(s => s === v);
	}
	function handleComboKey(which: ComboField, event: KeyboardEvent) {
		const sugg = which === 'expense' ? expenseSuggestions : fundingSuggestions;
		const creatable = isCreatable(which, sugg) ? 1 : 0;
		const max = sugg.length + creatable - 1;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			comboOpen = { ...comboOpen, [which]: true };
			comboIdx = { ...comboIdx, [which]: Math.min(comboIdx[which] + 1, max) };
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			comboOpen = { ...comboOpen, [which]: true };
			comboIdx = { ...comboIdx, [which]: Math.max(comboIdx[which] - 1, -1) };
		} else if (event.key === 'Enter') {
			if (!comboOpen[which]) return;
			const idx = comboIdx[which];
			if (idx >= 0 && idx < sugg.length) {
				event.preventDefault();
				pickSuggestion(which, sugg[idx]);
			} else if (idx === sugg.length && creatable) {
				event.preventDefault();
				comboOpen = { ...comboOpen, [which]: false };
			}
		} else if (event.key === 'Escape') {
			comboOpen = { ...comboOpen, [which]: false };
		}
	}

	function validate(): boolean {
		errors = {};
		const nick = (draft.nickname ?? '').trim();
		if (!nick) errors.nickname = 'Nickname is required';
		else if (!/^[a-zA-Z][a-zA-Z0-9 ._-]*$/.test(nick))
			errors.nickname = 'Letters, digits, space, . _ -  (must start with a letter)';

		if (!CADENCES.some(c => c.value === draft.cadence)) errors.cadence = 'Pick a cadence';

		const exp = (draft.expenseAccount ?? '').trim();
		if (!exp) errors.expenseAccount = 'Destination account is required';
		else if (!/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(exp))
			errors.expenseAccount = "Use full path (e.g. 'Expenses:Housing:Rent')";

		const fnd = (draft.fundingAccount ?? '').trim();
		if (!fnd) errors.fundingAccount = 'Funding account is required';
		else if (!/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(fnd))
			errors.fundingAccount = "Use full path (e.g. 'Assets:Bank:Checking')";

		const amt = Number(draft.amount);
		if (!isFinite(amt) || amt === 0) errors.amount = 'Amount must be a non-zero number';

		const ccy = (draft.currency ?? '').trim();
		if (!ccy) errors.currency = 'Currency is required';
		else if (!/^[A-Z][A-Z0-9'._-]*$/.test(ccy)) errors.currency = 'Use uppercase code';

		if (!/^\d{4}-\d{2}-\d{2}$/.test((draft.startDate ?? '').trim()))
			errors.startDate = 'Must be YYYY-MM-DD';

		return Object.keys(errors).length === 0;
	}

	function handleSave() {
		if (!validate()) return;
		const cleaned: RecurringRule = {
			nickname: draft.nickname.trim(),
			cadence: draft.cadence,
			expenseAccount: draft.expenseAccount.trim(),
			fundingAccount: draft.fundingAccount.trim(),
			amount: Number(draft.amount),
			currency: draft.currency.trim().toUpperCase(),
			startDate: draft.startDate.trim(),
			sourceLine: draft.sourceLine,
		};
		dispatch('save', { rule: cleaned, originalNickname: initial.nickname });
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleDelete() {
		if (mode !== 'edit') return;
		if (
			!confirm(
				`Remove recurring rule "${initial.nickname}"?\n\nThe directive line will be deleted from recurring.beancount.`,
			)
		)
			return;
		dispatch('delete', { originalNickname: initial.nickname });
	}

	$: previewOccurrences = (() => {
		// Show the next 4 occurrences over a 1-year window, but only when
		// the form is currently valid — otherwise the preview would mislead.
		const test: RecurringRule = {
			nickname: draft.nickname || 'preview',
			cadence: draft.cadence,
			expenseAccount: draft.expenseAccount || 'X:Y',
			fundingAccount: draft.fundingAccount || 'X:Y',
			amount: Number(draft.amount) || 1,
			currency: draft.currency || 'USD',
			startDate: draft.startDate,
		};
		if (!/^\d{4}-\d{2}-\d{2}$/.test(test.startDate)) return [];
		const today = new Date().toISOString().slice(0, 10);
		const d = new Date(today + 'T00:00:00Z');
		d.setUTCFullYear(d.getUTCFullYear() + 1);
		const to = d.toISOString().slice(0, 10);
		const from = test.startDate < today ? today : test.startDate;
		return occurrencesInWindow(test, from, to).slice(0, 4);
	})();

	function formatPreviewDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}
</script>

<div class="recurring-modal">
	<!-- Pattern picker — UI sugar that adapts the form to the flow type. -->
	<div class="field">
		<span class="field-label">Pattern</span>
		<div class="pattern-grid">
			{#each PATTERNS as p}
				<button
					type="button"
					class="pattern-chip"
					class:selected={pattern === p.value}
					on:click={() => changePattern(p.value)}
					title={p.blurb}
				>
					<span class="pattern-icon">{p.icon}</span>
					<span class="pattern-label">{p.label}</span>
				</button>
			{/each}
		</div>
		<span class="hint">{patternCfg.blurb}</span>
	</div>

	<!-- Nickname -->
	<div class="row">
		<label class="field grow">
			<span>Nickname <em>*</em></span>
			<input
				type="text"
				bind:value={draft.nickname}
				placeholder="rent-monthly"
				class:error={!!errors.nickname}
				autofocus
			/>
			{#if errors.nickname}<span class="error-msg">{errors.nickname}</span>
			{:else}<span class="hint">A unique short name. Used as the identity key.</span>
			{/if}
		</label>
	</div>

	<!-- Cadence as radio cards -->
	<div class="field">
		<span class="field-label">Cadence <em>*</em></span>
		<div class="cadence-grid">
			{#each CADENCES as cad}
				<label class="cadence-card" class:selected={draft.cadence === cad.value}>
					<input
						type="radio"
						name="cadence"
						value={cad.value}
						bind:group={draft.cadence}
					/>
					<span class="cadence-label">{cad.label}</span>
					<span class="cadence-hint">{cad.hint}</span>
				</label>
			{/each}
		</div>
	</div>

	<!-- Money-flow row: From  →  To -->
	<div class="flow-row">
		<div class="flow-field">
			<span class="field-label">{patternCfg.fromLabel} <em>*</em></span>
			<div class="combobox-wrap">
				<input
					type="text"
					bind:value={draft.fundingAccount}
					on:focus={() => openCombo('funding')}
					on:blur={() => closeCombo('funding')}
					on:keydown={(e) => handleComboKey('funding', e)}
					placeholder={patternCfg.fromPlaceholder}
					class:error={!!errors.fundingAccount}
				/>
				{#if comboOpen.funding && (fundingSuggestions.length > 0 || isCreatable('funding', fundingSuggestions))}
					<div class="combobox-menu">
						{#each fundingSuggestions as s, i}
							<button
								type="button"
								class="combobox-item"
								class:active={comboIdx.funding === i}
								on:mousedown|preventDefault={() => pickSuggestion('funding', s)}
							>
								{s}
							</button>
						{/each}
						{#if isCreatable('funding', fundingSuggestions)}
							<button
								type="button"
								class="combobox-item create"
								class:active={comboIdx.funding === fundingSuggestions.length}
								on:mousedown|preventDefault={() => closeCombo('funding')}
							>
								＋ Create new account: <code>{draft.fundingAccount}</code>
							</button>
						{/if}
					</div>
				{/if}
			</div>
			{#if errors.fundingAccount}<span class="error-msg">{errors.fundingAccount}</span>
			{:else}<span class="hint">{patternCfg.fromHint}</span>
			{/if}
		</div>

		<div class="flow-arrow" aria-hidden="true">→</div>

		<div class="flow-field">
			<span class="field-label">{patternCfg.toLabel} <em>*</em></span>
			<div class="combobox-wrap">
				<input
					type="text"
					bind:value={draft.expenseAccount}
					on:focus={() => openCombo('expense')}
					on:blur={() => closeCombo('expense')}
					on:keydown={(e) => handleComboKey('expense', e)}
					placeholder={patternCfg.toPlaceholder}
					class:error={!!errors.expenseAccount}
				/>
				{#if comboOpen.expense && (expenseSuggestions.length > 0 || isCreatable('expense', expenseSuggestions))}
					<div class="combobox-menu">
						{#each expenseSuggestions as s, i}
							<button
								type="button"
								class="combobox-item"
								class:active={comboIdx.expense === i}
								on:mousedown|preventDefault={() => pickSuggestion('expense', s)}
							>
								{s}
							</button>
						{/each}
						{#if isCreatable('expense', expenseSuggestions)}
							<button
								type="button"
								class="combobox-item create"
								class:active={comboIdx.expense === expenseSuggestions.length}
								on:mousedown|preventDefault={() => closeCombo('expense')}
							>
								＋ Create new account: <code>{draft.expenseAccount}</code>
							</button>
						{/if}
					</div>
				{/if}
			</div>
			{#if errors.expenseAccount}<span class="error-msg">{errors.expenseAccount}</span>
			{:else}<span class="hint">{patternCfg.toHint}</span>
			{/if}
		</div>
	</div>

	<!-- Amount + currency + start-date -->
	<div class="row">
		<label class="field grow">
			<span>Amount <em>*</em></span>
			<input
				type="number"
				step="any"
				bind:value={draft.amount}
				placeholder="1500"
				class:error={!!errors.amount}
			/>
			{#if errors.amount}<span class="error-msg">{errors.amount}</span>{/if}
		</label>

		<label class="field narrow">
			<span>Currency <em>*</em></span>
			<select bind:value={draft.currency} class:error={!!errors.currency}>
				{#if draft.currency && !currencies.includes(draft.currency)}
					<option value={draft.currency}>{draft.currency}</option>
				{/if}
				{#each currencies as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
			{#if errors.currency}<span class="error-msg">{errors.currency}</span>{/if}
		</label>

		<label class="field narrow">
			<span>Start date <em>*</em></span>
			<input
				type="text"
				bind:value={draft.startDate}
				placeholder="YYYY-MM-DD"
				pattern="\d{'{4}'}-\d{'{2}'}-\d{'{2}'}"
				class:error={!!errors.startDate}
			/>
			{#if errors.startDate}<span class="error-msg">{errors.startDate}</span>
			{:else}<span class="hint">Anchors the schedule</span>
			{/if}
		</label>
	</div>

	<!-- Live preview of next occurrences -->
	{#if previewOccurrences.length > 0}
		<div class="preview-block">
			<span class="preview-title">Next occurrences</span>
			<ul class="preview-list">
				{#each previewOccurrences as iso}
					<li class="preview-item">
						<span class="preview-date">{formatPreviewDate(iso)}</span>
						<span class="preview-iso">{iso}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Footer actions -->
	<div class="modal-footer">
		{#if mode === 'edit'}
			<button type="button" class="btn-danger" on:click={handleDelete}>Delete</button>
		{/if}
		<span class="footer-spacer"></span>
		<button type="button" class="btn-ghost" on:click={handleCancel}>Cancel</button>
		<button type="button" class="btn-primary" on:click={handleSave}>
			{mode === 'add' ? 'Add rule' : 'Save'}
		</button>
	</div>
</div>

<style>
	.recurring-modal {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 4px;
	}

	.row {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.field.grow { flex: 1 1 auto; min-width: 200px; }
	.field.narrow { flex: 0 0 140px; }

	.field > span,
	.field-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.field-label em,
	.field > span em {
		color: var(--text-error);
		font-style: normal;
		margin-left: 2px;
	}

	.field input[type="text"],
	.field input[type="number"],
	.field select {
		width: 100%;
		padding: 6px 8px;
		font-size: 13px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		border-radius: 6px;
		font-family: inherit;
	}
	.field input[type="text"]:focus,
	.field input[type="number"]:focus,
	.field select:focus {
		outline: none;
		border-color: var(--text-accent);
	}
	.field input.error,
	.field select.error {
		border-color: var(--text-error);
	}

	.error-msg {
		font-size: 11px;
		color: var(--text-error);
		text-transform: none !important;
		letter-spacing: 0 !important;
		font-weight: 400 !important;
	}
	.hint {
		font-size: 11px;
		color: var(--text-faint);
		text-transform: none !important;
		letter-spacing: 0 !important;
		font-weight: 400 !important;
	}

	.pattern-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 6px;
	}
	.pattern-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 999px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 12px;
		transition: border-color 0.12s, background 0.12s;
	}
	.pattern-chip:hover { background: var(--background-modifier-hover); }
	.pattern-chip.selected {
		border-color: var(--text-accent);
		background: color-mix(in srgb, var(--text-accent), transparent 90%);
		color: var(--text-accent);
		font-weight: 600;
	}
	.pattern-icon {
		font-size: 14px;
		line-height: 1;
	}
	.pattern-label {
		font-size: 12px;
	}

	.flow-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 10px;
		align-items: start;
	}
	.flow-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.flow-arrow {
		font-size: 22px;
		color: var(--text-faint);
		padding-top: 26px; /* align with input below the field-label */
		user-select: none;
	}
	@media (max-width: 520px) {
		.flow-row {
			grid-template-columns: 1fr;
		}
		.flow-arrow {
			padding-top: 0;
			text-align: center;
			transform: rotate(90deg);
		}
	}

	.cadence-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 6px;
	}
	.cadence-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		cursor: pointer;
		background: var(--background-primary);
		transition: border-color 0.12s, background 0.12s;
	}
	.cadence-card:hover { background: var(--background-modifier-hover); }
	.cadence-card.selected {
		border-color: var(--text-accent);
		background: color-mix(in srgb, var(--text-accent), transparent 92%);
	}
	.cadence-card input { display: none; }
	.cadence-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-normal);
	}
	.cadence-hint {
		font-size: 10px;
		color: var(--text-faint);
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}

	.combobox-wrap { position: relative; width: 100%; }
	.combobox-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		max-height: 220px;
		overflow-y: auto;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
		z-index: 50;
		display: flex;
		flex-direction: column;
	}
	.combobox-item {
		text-align: left;
		padding: 6px 10px;
		font-size: 12px;
		font-family: var(--font-monospace);
		color: var(--text-normal);
		background: transparent;
		border: none;
		border-radius: 0;
		cursor: pointer;
	}
	.combobox-item:hover,
	.combobox-item.active {
		background: var(--background-modifier-hover);
	}
	.combobox-item.create {
		border-top: 1px solid var(--background-modifier-border);
		color: var(--text-accent);
	}
	.combobox-item.create code {
		font-family: var(--font-monospace);
		color: var(--text-normal);
	}

	.preview-block {
		background: var(--background-secondary);
		border-radius: 8px;
		padding: 10px 12px;
	}
	.preview-title {
		display: block;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 6px;
	}
	.preview-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.preview-item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		font-size: 12px;
	}
	.preview-date {
		color: var(--text-normal);
	}
	.preview-iso {
		color: var(--text-faint);
		font-family: var(--font-monospace);
		font-variant-numeric: tabular-nums;
	}

	.modal-footer {
		display: flex;
		gap: 8px;
		align-items: center;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.footer-spacer { flex: 1; }

	.btn-primary,
	.btn-ghost,
	.btn-danger {
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid transparent;
	}
	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
	.btn-primary:hover { background: var(--interactive-accent-hover); }
	.btn-ghost {
		background: transparent;
		color: var(--text-muted);
		border-color: var(--background-modifier-border);
	}
	.btn-ghost:hover { background: var(--background-modifier-hover); }
	.btn-danger {
		background: transparent;
		color: var(--text-error);
		border-color: var(--background-modifier-border);
	}
	.btn-danger:hover {
		background: color-mix(in srgb, var(--text-error), transparent 88%);
		border-color: var(--text-error);
	}
</style>
