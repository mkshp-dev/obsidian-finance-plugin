<!-- src/ui/modals/RecordPaymentModal.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LoanRow } from '../../controllers/LiabilitiesController';
	import { formatCurrencyAmount } from '../../utils/currency-precision';

	export let loan: LoanRow;
	export let accounts: string[] = [];
	export let defaultFunding: string = '';

	const dispatch = createEventDispatcher();

	let date: string = new Date().toISOString().slice(0, 10);
	let amount: number | null = loan.monthlyPayment ?? null;
	let funding: string = ((loan.fundingAccount ?? defaultFunding) ?? '').trim();
	let payee: string = loan.counterparty ?? '';
	let narration: string = loan.role === 'receivable'
		? `Repayment from ${loan.counterparty ?? loan.account}`
		: `Payment to ${loan.counterparty ?? loan.account}`;

	let errors: Record<string, string> = {};

	$: assetAccounts = accounts.filter(a => a.startsWith('Assets'));
	$: incomeAccounts = accounts.filter(a => a.startsWith('Income'));

	function validate(): boolean {
		errors = {};
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) errors.date = 'Must be YYYY-MM-DD';
		if (!amount || !isFinite(Number(amount)) || Number(amount) <= 0) errors.amount = 'Must be > 0';
		if (!funding.trim()) errors.funding = 'Funding/destination account is required';
		return Object.keys(errors).length === 0;
	}

	function handleSave() {
		if (!validate()) return;
		dispatch('save', {
			date: date.trim(),
			amount: Number(amount),
			currency: loan.currency,
			loanAccount: loan.account,
			fundingAccount: funding.trim(),
			payee: payee.trim() || null,
			narration: narration.trim() || null,
			role: loan.role,
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="payment-modal">
	<div class="loan-summary">
		<div class="loan-name">{loan.account}</div>
		<div class="loan-meta">
			<span>Balance: <strong>{loan.currentBalanceDisplay}</strong></span>
			{#if loan.monthlyPayment !== null}
				<span class="sep">·</span>
				<span>Monthly: <strong>{formatCurrencyAmount(loan.monthlyPayment, loan.currency)}</strong></span>
			{/if}
		</div>
	</div>

	<div class="row">
		<label class="field narrow">
			<span>Date <em>*</em></span>
			<input
				type="text"
				inputmode="numeric"
				placeholder="YYYY-MM-DD"
				pattern="\d{4}-\d{2}-\d{2}"
				bind:value={date}
				class:error={errors.date}
			/>
			{#if errors.date}<span class="error-msg">{errors.date}</span>{/if}
		</label>

		<label class="field narrow">
			<span>Amount <em>*</em> ({loan.currency})</span>
			<input
				type="number"
				step="any"
				bind:value={amount}
				class:error={errors.amount}
			/>
			{#if errors.amount}<span class="error-msg">{errors.amount}</span>{/if}
		</label>

		<label class="field grow">
			<span>{loan.role === 'receivable' ? 'Receiving account' : 'Funding account'} <em>*</em></span>
			<input
				type="text"
				list="payment-funding-list"
				placeholder={loan.role === 'receivable' ? 'Assets:Banking:…' : 'Assets:Banking:…'}
				bind:value={funding}
				class:error={errors.funding}
			/>
			<datalist id="payment-funding-list">
				{#each [...assetAccounts, ...incomeAccounts] as a}
					<option value={a} />
				{/each}
			</datalist>
			{#if errors.funding}<span class="error-msg">{errors.funding}</span>{/if}
		</label>
	</div>

	<div class="row">
		<label class="field grow">
			<span>Payee</span>
			<input
				type="text"
				placeholder="e.g. {loan.counterparty ?? 'Banco Santander'}"
				bind:value={payee}
			/>
		</label>
		<label class="field grow">
			<span>Narration</span>
			<input
				type="text"
				bind:value={narration}
			/>
		</label>
	</div>

	<div class="footer">
		<div class="footer-spacer"></div>
		<button on:click={handleCancel}>Cancel</button>
		<button class="cta" on:click={handleSave}>Record payment</button>
	</div>
</div>

<style>
	.payment-modal {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}
	.loan-summary {
		padding: var(--size-4-2) var(--size-4-3);
		background: var(--background-secondary);
		border-radius: var(--radius-s);
	}
	.loan-name {
		font-weight: 600;
		margin-bottom: 4px;
	}
	.loan-meta {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.loan-meta .sep {
		margin: 0 6px;
		color: var(--text-faint);
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
	.field.narrow { flex: 0 0 130px; }
	.field span {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.field em {
		color: var(--color-red);
		font-style: normal;
	}
	.field input {
		width: 100%;
		padding: 6px 8px;
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
	}
	.field input.error { border-color: var(--color-red); }
	.error-msg {
		color: var(--color-red);
		font-size: var(--font-ui-smaller);
	}

	.footer {
		display: flex;
		gap: 8px;
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
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
</style>
