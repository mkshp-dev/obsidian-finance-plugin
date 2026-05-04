<!-- src/ui/modals/LoanEditModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import type { LoanFormDraft } from '../../services/liabilities.service';
	import { pruneDraftForMode } from '../../services/liabilities.service';

	export let initial: LoanFormDraft;
	export let mode: 'add' | 'edit' = 'add';
	export let accounts: string[] = [];
	export let currencies: string[] = [];

	const dispatch = createEventDispatcher();

	const LOAN_TYPES = [
		'credit-card', 'mortgage', 'personal-loan', 'auto-loan',
		'student-loan', 'line-of-credit', 'receivable', 'other',
	];

	let draft: LoanFormDraft = {
		...initial,
		loanType: initial.loanType ?? 'credit-card',
		paymentMode: initial.paymentMode ?? 'recurring',
	};
	let errors: Record<string, string> = {};

	$: assetAccounts = accounts.filter(a => a.startsWith('Assets'));
	$: incomeAccounts = accounts.filter(a => a.startsWith('Income'));
	$: fundingPool = [...assetAccounts, ...incomeAccounts];
	$: pathPool = accounts.filter(a => a.startsWith('Liabilities') || a.startsWith('Assets:Receivables'));

	function validate(): boolean {
		errors = {};
		const path = (draft.account ?? '').trim();
		if (!path) errors.account = 'Account path is required';
		else if (!/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(path))
			errors.account = "Use at least 2 segments (e.g. 'Liabilities:Visa')";

		const ccy = (draft.currency ?? '').trim();
		if (!ccy) errors.currency = 'Currency is required';
		else if (!/^[A-Z][A-Z0-9'._-]*$/.test(ccy)) errors.currency = 'Currency must be uppercase code';

		if (!/^\d{4}-\d{2}-\d{2}$/.test((draft.openDate ?? '').trim())) errors.openDate = 'Must be YYYY-MM-DD';

		if (draft.principal !== null && draft.principal < 0) errors.principal = 'Must be ≥ 0';
		if (draft.interestRate !== null && draft.interestRate < 0) errors.interestRate = 'Must be ≥ 0';

		if (draft.paymentMode === 'recurring') {
			if (draft.dueDay !== null && (draft.dueDay < 1 || draft.dueDay > 31))
				errors.dueDay = 'Day must be 1–31';
			if (draft.monthlyPayment !== null && draft.monthlyPayment < 0)
				errors.monthlyPayment = 'Must be ≥ 0';
		} else {
			if (draft.payoffDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.payoffDate.trim()))
				errors.payoffDate = 'Must be YYYY-MM-DD';
			if (draft.payoffAmount !== null && draft.payoffAmount < 0)
				errors.payoffAmount = 'Must be ≥ 0';
		}

		return Object.keys(errors).length === 0;
	}

	function handleSave() {
		if (!validate()) return;
		const cleanedRaw: LoanFormDraft = {
			account: draft.account.trim(),
			currency: draft.currency.trim().toUpperCase(),
			openDate: draft.openDate.trim(),
			loanType: (draft.loanType ?? '').trim() || null,
			counterparty: (draft.counterparty ?? '').trim() || null,
			principal: numberOrNull(draft.principal),
			interestRate: numberOrNull(draft.interestRate),
			monthlyPayment: numberOrNull(draft.monthlyPayment),
			dueDay: draft.dueDay !== null && draft.dueDay !== undefined ? Math.round(Number(draft.dueDay)) : null,
			fundingAccount: (draft.fundingAccount ?? '').trim() || null,
			paymentMode: draft.paymentMode,
			payoffDate: (draft.payoffDate ?? '').trim() || null,
			payoffAmount: numberOrNull(draft.payoffAmount),
		};
		const cleaned = pruneDraftForMode(cleanedRaw);
		dispatch('save', { draft: cleaned, originalAccount: initial.account });
	}

	function numberOrNull(v: number | null | undefined): number | null {
		if (v === null || v === undefined || v === ('' as any)) return null;
		const n = Number(v);
		return isFinite(n) ? n : null;
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleDelete() {
		if (mode !== 'edit') return;
		if (!confirm(`Remove loan account "${initial.account}"?\n\nThe open directive and metadata will be deleted from accounts.beancount. Past transactions referencing the account stay intact.`)) return;
		dispatch('delete', { originalAccount: initial.account });
	}

	// --- Reusable inline combobox state. We keep two so the path and
	// funding fields can each have their own open/highlight cursor. ---

	type ComboboxField = 'path' | 'funding';
	let comboboxOpen: Record<ComboboxField, boolean> = { path: false, funding: false };
	let comboboxIndex: Record<ComboboxField, number> = { path: -1, funding: -1 };

	function openCombobox(which: ComboboxField) {
		comboboxOpen[which] = true;
		comboboxIndex[which] = -1;
	}
	function closeCombobox(which: ComboboxField) {
		comboboxOpen[which] = false;
		comboboxIndex[which] = -1;
	}
	function suggestionsFor(which: ComboboxField): string[] {
		const pool = which === 'path' ? pathPool : fundingPool;
		const value = which === 'path' ? draft.account : (draft.fundingAccount ?? '');
		const q = (value ?? '').trim().toLowerCase();
		if (!q) return pool.slice(0, 12);
		return pool
			.filter(a => a.toLowerCase().includes(q))
			.slice(0, 12);
	}
	function pickSuggestion(which: ComboboxField, value: string) {
		if (which === 'path') {
			draft.account = value;
		} else {
			draft.fundingAccount = value;
		}
		closeCombobox(which);
	}
	function isCreatable(which: ComboboxField, suggestions: string[]): boolean {
		const value = which === 'path' ? draft.account : (draft.fundingAccount ?? '');
		const v = (value ?? '').trim();
		if (!v) return false;
		if (which === 'path' && !/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(v)) return false;
		if (which === 'funding' && !/^[A-Z][A-Za-z0-9:_-]*$/.test(v)) return false;
		// Don't show "create new" when the typed value matches an existing entry.
		return !suggestions.some(s => s === v);
	}
	async function handleComboboxKey(which: ComboboxField, event: KeyboardEvent) {
		const sugg = suggestionsFor(which);
		const creatable = isCreatable(which, sugg) ? 1 : 0;
		const max = sugg.length + creatable - 1;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			openCombobox(which);
			comboboxIndex[which] = Math.min(comboboxIndex[which] + 1, max);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			openCombobox(which);
			comboboxIndex[which] = Math.max(comboboxIndex[which] - 1, -1);
		} else if (event.key === 'Enter') {
			if (!comboboxOpen[which]) return;
			const idx = comboboxIndex[which];
			if (idx >= 0 && idx < sugg.length) {
				event.preventDefault();
				pickSuggestion(which, sugg[idx]);
			} else if (idx === sugg.length && creatable) {
				// "Create new" row — accept the typed value as-is.
				event.preventDefault();
				closeCombobox(which);
			}
		} else if (event.key === 'Escape') {
			closeCombobox(which);
		}
	}
</script>

<div class="loan-modal">
	<!-- Account path + currency -->
	<div class="row">
		<div class="field grow combobox-field">
			<label for="loan-modal-account">Account path <em>*</em></label>
			<input
				id="loan-modal-account"
				type="text"
				placeholder="Liabilities:Credit:Visa"
				autocomplete="off"
				bind:value={draft.account}
				on:focus={() => openCombobox('path')}
				on:input={() => openCombobox('path')}
				on:keydown={(e) => handleComboboxKey('path', e)}
				on:blur={() => setTimeout(() => closeCombobox('path'), 120)}
				class:error={errors.account}
			/>
			{#if comboboxOpen.path}
				{@const sugg = suggestionsFor('path')}
				{@const creatable = isCreatable('path', sugg)}
				{#if sugg.length > 0 || creatable}
					<ul class="combobox-list">
						{#each sugg as s, i}
							<li
								class:active={comboboxIndex.path === i}
								on:mousedown|preventDefault={() => pickSuggestion('path', s)}
							>{s}</li>
						{/each}
						{#if creatable}
							<li
								class="combobox-create"
								class:active={comboboxIndex.path === sugg.length}
								on:mousedown|preventDefault={() => closeCombobox('path')}
							>+ Create new account: <code>{draft.account}</code></li>
						{/if}
					</ul>
				{/if}
			{/if}
			{#if errors.account}<span class="error-msg">{errors.account}</span>{/if}
		</div>

		<label class="field narrow">
			<span>Currency <em>*</em></span>
			<select
				bind:value={draft.currency}
				class:error={errors.currency}
			>
				{#if draft.currency && !currencies.includes(draft.currency)}
					<option value={draft.currency}>{draft.currency}</option>
				{/if}
				{#each currencies as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
			{#if errors.currency}<span class="error-msg">{errors.currency}</span>{/if}
		</label>
	</div>

	<!-- Identity row -->
	<div class="row">
		<label class="field">
			<span>Open date <em>*</em></span>
			<input type="date" bind:value={draft.openDate} class:error={errors.openDate} />
			{#if errors.openDate}<span class="error-msg">{errors.openDate}</span>{/if}
		</label>

		<label class="field">
			<span>Loan type</span>
			<select bind:value={draft.loanType}>
				{#each LOAN_TYPES as t}<option value={t}>{t}</option>{/each}
			</select>
		</label>

		<label class="field grow">
			<span>Counterparty</span>
			<input type="text" placeholder="Banco Santander, Maria Esther, …" bind:value={draft.counterparty} />
		</label>
	</div>

	<!-- Headline numbers (apply to both modes) -->
	<div class="row">
		<label class="field">
			<span>Principal</span>
			<input type="number" step="any" placeholder="0" bind:value={draft.principal} class:error={errors.principal} />
			{#if errors.principal}<span class="error-msg">{errors.principal}</span>{/if}
		</label>

		<label class="field">
			<span>Interest rate (% APR)</span>
			<input type="number" step="any" placeholder="0" bind:value={draft.interestRate} class:error={errors.interestRate} />
			{#if errors.interestRate}<span class="error-msg">{errors.interestRate}</span>{/if}
		</label>
	</div>

	<!-- Payment schedule selector -->
	<fieldset class="payment-mode">
		<legend>Payment schedule</legend>
		<label class="radio">
			<input type="radio" bind:group={draft.paymentMode} value="recurring" />
			<span>
				<strong>Recurring monthly</strong>
				<span class="hint">a fixed amount every month on the same day</span>
			</span>
		</label>
		<label class="radio">
			<input type="radio" bind:group={draft.paymentMode} value="one-time" />
			<span>
				<strong>One-time payoff</strong>
				<span class="hint">a single lump-sum payment by a target date</span>
			</span>
		</label>
	</fieldset>

	<!-- Mode-specific fields -->
	{#if draft.paymentMode === 'recurring'}
		<div class="row">
			<label class="field">
				<span>Monthly payment</span>
				<input type="number" step="any" placeholder="0" bind:value={draft.monthlyPayment} class:error={errors.monthlyPayment} />
				{#if errors.monthlyPayment}<span class="error-msg">{errors.monthlyPayment}</span>{/if}
			</label>

			<label class="field narrow">
				<span>Due day</span>
				<input type="number" min="1" max="31" placeholder="1–31" bind:value={draft.dueDay} class:error={errors.dueDay} />
				{#if errors.dueDay}<span class="error-msg">{errors.dueDay}</span>{/if}
			</label>
		</div>
	{:else}
		<div class="row">
			<label class="field">
				<span>Payoff date</span>
				<input type="date" bind:value={draft.payoffDate} class:error={errors.payoffDate} />
				{#if errors.payoffDate}<span class="error-msg">{errors.payoffDate}</span>{/if}
			</label>

			<label class="field">
				<span>Payoff amount</span>
				<input type="number" step="any" placeholder="0" bind:value={draft.payoffAmount} class:error={errors.payoffAmount} />
				{#if errors.payoffAmount}<span class="error-msg">{errors.payoffAmount}</span>{/if}
			</label>
		</div>
	{/if}

	<!-- Funding account -->
	<div class="row">
		<div class="field grow combobox-field">
			<label for="loan-modal-funding">
				Funding account
				<span class="muted small">— used by the recurring widget when synthesising payment rules</span>
			</label>
			<input
				id="loan-modal-funding"
				type="text"
				placeholder="Assets:Banking:… or Income:Repayment"
				autocomplete="off"
				bind:value={draft.fundingAccount}
				on:focus={() => openCombobox('funding')}
				on:input={() => openCombobox('funding')}
				on:keydown={(e) => handleComboboxKey('funding', e)}
				on:blur={() => setTimeout(() => closeCombobox('funding'), 120)}
			/>
			{#if comboboxOpen.funding}
				{@const sugg = suggestionsFor('funding')}
				{@const creatable = isCreatable('funding', sugg)}
				{#if sugg.length > 0 || creatable}
					<ul class="combobox-list">
						{#each sugg as s, i}
							<li
								class:active={comboboxIndex.funding === i}
								on:mousedown|preventDefault={() => pickSuggestion('funding', s)}
							>{s}</li>
						{/each}
						{#if creatable}
							<li
								class="combobox-create"
								class:active={comboboxIndex.funding === sugg.length}
								on:mousedown|preventDefault={() => closeCombobox('funding')}
							>+ Use new account: <code>{draft.fundingAccount}</code></li>
						{/if}
					</ul>
				{/if}
			{/if}
		</div>
	</div>

	<div class="footer">
		{#if mode === 'edit'}
			<button class="danger" on:click={handleDelete} title="Delete this account from accounts.beancount">Delete</button>
		{/if}
		<div class="footer-spacer"></div>
		<button on:click={handleCancel}>Cancel</button>
		<button class="cta" on:click={handleSave}>{mode === 'add' ? 'Add loan' : 'Save changes'}</button>
	</div>
</div>

<style>
	.loan-modal {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-3);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 160px;
		min-width: 0;
	}
	.field.grow { flex: 1 1 240px; }
	.field.narrow { flex: 0 0 120px; }
	.field > label,
	.field > span {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.field em {
		color: var(--color-red);
		font-style: normal;
	}
	.muted { color: var(--text-faint); }
	.small { font-size: var(--font-ui-smaller); }
	.field input,
	.field select {
		width: 100%;
		padding: 6px 8px;
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
	}
	.field input.error,
	.field select.error {
		border-color: var(--color-red);
	}
	.error-msg {
		color: var(--color-red);
		font-size: var(--font-ui-smaller);
	}

	/* Combobox: wraps an input + an absolutely-positioned suggestion list. */
	.combobox-field {
		position: relative;
	}
	.combobox-list {
		position: absolute;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		max-height: 240px;
		overflow-y: auto;
		margin: 0;
		padding: 4px 0;
		list-style: none;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow-s);
		z-index: 50;
	}
	.combobox-list li {
		padding: 6px 10px;
		cursor: pointer;
		font-family: var(--font-monospace);
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}
	.combobox-list li:hover,
	.combobox-list li.active {
		background: var(--background-modifier-hover);
	}
	.combobox-list .combobox-create {
		font-family: var(--font-interface);
		color: var(--interactive-accent);
		border-top: 1px solid var(--background-modifier-border);
		padding-top: 8px;
		margin-top: 4px;
		font-style: italic;
	}
	.combobox-list .combobox-create code {
		font-style: normal;
		font-family: var(--font-monospace);
		color: var(--text-normal);
		background: var(--background-secondary);
		padding: 1px 6px;
		border-radius: 4px;
		margin-left: 4px;
	}

	/* Payment-mode fieldset */
	.payment-mode {
		margin: 0;
		padding: var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-secondary);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.payment-mode legend {
		padding: 0 6px;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.payment-mode .radio {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		cursor: pointer;
	}
	.payment-mode .radio input { margin-top: 4px; }
	.payment-mode .radio strong {
		display: block;
		font-weight: 600;
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}
	.payment-mode .radio .hint {
		display: block;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.footer {
		display: flex;
		gap: 8px;
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
		align-items: center;
	}
	.footer-spacer { flex: 1; }
	button {
		padding: 6px 14px;
		border-radius: var(--radius-s);
		cursor: pointer;
	}
	.cta {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: 1px solid var(--interactive-accent);
	}
	.danger {
		background: transparent;
		color: var(--color-red);
		border: 1px solid var(--color-red);
	}
	.danger:hover {
		background: color-mix(in srgb, var(--color-red), transparent 92%);
	}
</style>
