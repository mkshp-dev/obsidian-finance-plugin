<!-- src/ui/modals/LoanEditModal.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LoanFormDraft } from '../../services/liabilities.service';

	export let initial: LoanFormDraft;
	export let mode: 'add' | 'edit' = 'add';
	export let accounts: string[] = [];
	export let currencies: string[] = [];

	const dispatch = createEventDispatcher();

	const LOAN_TYPES = [
		'credit-card', 'mortgage', 'personal-loan', 'auto-loan',
		'student-loan', 'line-of-credit', 'receivable', 'other',
	];

	let draft: LoanFormDraft = { ...initial, loanType: initial.loanType ?? 'credit-card' };
	let errors: Record<string, string> = {};

	$: assetAccounts = accounts.filter(a => a.startsWith('Assets'));
	$: incomeAccounts = accounts.filter(a => a.startsWith('Income'));
	$: fundingAccounts = [...assetAccounts, ...incomeAccounts];

	function validate(): boolean {
		errors = {};
		const path = (draft.account ?? '').trim();
		if (!path) errors.account = 'Account path is required';
		else if (!/^[A-Z][A-Za-z0-9:_-]*$/.test(path)) errors.account = 'Format: \'TopLevel:Sub:Leaf\' (must start with capital)';

		const ccy = (draft.currency ?? '').trim();
		if (!ccy) errors.currency = 'Currency is required';
		else if (!/^[A-Z][A-Z0-9'._-]*$/.test(ccy)) errors.currency = 'Currency must be uppercase code';

		if (!/^\d{4}-\d{2}-\d{2}$/.test((draft.openDate ?? '').trim())) errors.openDate = 'Must be YYYY-MM-DD';

		if (draft.dueDay !== null && (draft.dueDay < 1 || draft.dueDay > 31))
			errors.dueDay = 'Day must be 1–31';
		if (draft.principal !== null && draft.principal < 0)
			errors.principal = 'Must be ≥ 0';
		if (draft.monthlyPayment !== null && draft.monthlyPayment < 0)
			errors.monthlyPayment = 'Must be ≥ 0';
		if (draft.interestRate !== null && draft.interestRate < 0)
			errors.interestRate = 'Must be ≥ 0';

		return Object.keys(errors).length === 0;
	}

	function handleSave() {
		if (!validate()) return;
		const cleaned: LoanFormDraft = {
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
		};
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
</script>

<div class="loan-modal">
	<div class="row">
		<label class="field grow">
			<span>Account path <em>*</em></span>
			<input
				type="text"
				placeholder="Liabilities:Credit:Visa"
				list="loan-accounts"
				bind:value={draft.account}
				class:error={errors.account}
			/>
			<datalist id="loan-accounts">
				{#each accounts.filter(a => a.startsWith('Liabilities') || a.startsWith('Assets:Receivables')) as a}
					<option value={a} />
				{/each}
			</datalist>
			{#if errors.account}<span class="error-msg">{errors.account}</span>{/if}
		</label>

		<label class="field narrow">
			<span>Currency <em>*</em></span>
			<input
				type="text"
				list="loan-currencies"
				placeholder="USD"
				bind:value={draft.currency}
				class:error={errors.currency}
			/>
			<datalist id="loan-currencies">
				{#each currencies as c}<option value={c} />{/each}
			</datalist>
			{#if errors.currency}<span class="error-msg">{errors.currency}</span>{/if}
		</label>
	</div>

	<div class="row">
		<label class="field">
			<span>Open date <em>*</em></span>
			<input
				type="date"
				bind:value={draft.openDate}
				class:error={errors.openDate}
			/>
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
			<input
				type="text"
				placeholder="Banco Santander, Maria Esther, …"
				bind:value={draft.counterparty}
			/>
		</label>
	</div>

	<div class="row">
		<label class="field">
			<span>Principal</span>
			<input
				type="number"
				step="any"
				placeholder="0"
				bind:value={draft.principal}
				class:error={errors.principal}
			/>
			{#if errors.principal}<span class="error-msg">{errors.principal}</span>{/if}
		</label>

		<label class="field">
			<span>Interest rate (% APR)</span>
			<input
				type="number"
				step="any"
				placeholder="0"
				bind:value={draft.interestRate}
				class:error={errors.interestRate}
			/>
			{#if errors.interestRate}<span class="error-msg">{errors.interestRate}</span>{/if}
		</label>

		<label class="field">
			<span>Monthly payment</span>
			<input
				type="number"
				step="any"
				placeholder="0"
				bind:value={draft.monthlyPayment}
				class:error={errors.monthlyPayment}
			/>
			{#if errors.monthlyPayment}<span class="error-msg">{errors.monthlyPayment}</span>{/if}
		</label>

		<label class="field narrow">
			<span>Due day</span>
			<input
				type="number"
				min="1"
				max="31"
				placeholder="1–31"
				bind:value={draft.dueDay}
				class:error={errors.dueDay}
			/>
			{#if errors.dueDay}<span class="error-msg">{errors.dueDay}</span>{/if}
		</label>
	</div>

	<div class="row">
		<label class="field grow">
			<span>Funding account (used by the recurring widget when synthesising payment rules)</span>
			<input
				type="text"
				list="loan-funding"
				placeholder="Assets:Banking:… or Income:Repayment"
				bind:value={draft.fundingAccount}
			/>
			<datalist id="loan-funding">
				{#each fundingAccounts as a}<option value={a} />{/each}
			</datalist>
		</label>
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
	.field span {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.field em {
		color: var(--color-red);
		font-style: normal;
	}
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
