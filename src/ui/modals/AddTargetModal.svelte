<!-- src/ui/modals/AddTargetModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { nativeDatePicker } from '../actions/nativeDatePicker';
	import { buildAccountQuery, parseAccountQuery } from '../../utils';
	import AccountQueryRow from './AccountQueryRow.svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let accounts: string[] = [];
	export let currencies: string[] = ['INR', 'USD', 'EUR', 'GBP'];
	export let defaultCurrency: string = 'USD';
	export let editingIndicator: any = null;

	// Form state
	let name: string = '';
	let accountRows: string[] = [''];
	let cycle: 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly' = 'Monthly';
	let target: string = '';
	let currency: string = defaultCurrency;
	let isRollover: boolean = false;
	let startDate: string = new Date().toISOString().split('T')[0];
	let tag: string = '';
	let tagMode: 'has' | 'not_has' = 'has';

	// UI state
	let nameError: string = '';
	let accountError: string = '';
	let targetError: string = '';

	// Filtered asset accounts
	$: assetAccounts = accounts.filter(a => a.startsWith('Assets'));

	function addAccountRow() {
		accountRows = [...accountRows, ''];
	}

	function removeAccountRow(index: number) {
		const next = accountRows.filter((_, i) => i !== index);
		accountRows = next.length > 0 ? next : [''];
	}

	onMount(() => {
		if (editingIndicator) {
			name = editingIndicator.name || '';
			accountRows = parseAccountQuery(editingIndicator.accountString || '');
			if (accountRows.length === 0) accountRows = [''];
			cycle = editingIndicator.period || 'Monthly';
			target = String(editingIndicator.targetAmount || '');
			currency = editingIndicator.currency || defaultCurrency;
			isRollover = editingIndicator.isRollOver || false;
			startDate = editingIndicator.startDate || new Date().toISOString().split('T')[0];
			tag = editingIndicator.tag || '';
			tagMode = editingIndicator.tagMode || 'has';
		} else {
			currency = defaultCurrency;
		}
	});

	function validate(): boolean {
		let valid = true;
		nameError = '';
		accountError = '';
		targetError = '';

		if (!name.trim()) {
			nameError = 'Name is required';
			valid = false;
		}
		if (!accountRows.some(r => r.trim())) {
			accountError = 'At least one account is required';
			valid = false;
		}
		const t = parseFloat(target);
		if (!target || isNaN(t) || t <= 0) {
			targetError = 'Enter a positive number';
			valid = false;
		}
		return valid;
	}

	function handleSave() {
		if (!validate()) return;
		const cleanedAccounts = accountRows.map(r => r.trim()).filter(Boolean);
		dispatch('save', {
			name: name.trim(),
			accountQuery: buildAccountQuery(cleanedAccounts),
			cycle,
			target: parseFloat(target),
			currency,
			isRollover,
			startDate,
			tag: tag.trim() || undefined,
			tagMode: tag.trim() ? tagMode : undefined,
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="indicator-modal">
	<h2>{editingIndicator ? 'Edit Target' : 'Add Target'}</h2>

	<div class="form-grid">
		<div class="form-group full-width">
			<label for="target-name">Name <span class="required">*</span></label>
			<input
				id="target-name"
				type="text"
				bind:value={name}
				placeholder="e.g. Emergency Fund"
				class:error={nameError}
			/>
			{#if nameError}<span class="error-msg">{nameError}</span>{/if}
		</div>

		<div class="form-group full-width">
			<label for="target-account">Asset Account <span class="required">*</span></label>
			<div class="account-rows">
				{#each accountRows as row, i (i)}
					<AccountQueryRow
						bind:value={accountRows[i]}
						accounts={assetAccounts}
						showRemove={accountRows.length > 1}
						placeholder="e.g. Assets:Savings"
						hasError={!!accountError}
						on:remove={() => removeAccountRow(i)}
					/>
				{/each}
			</div>
			<button type="button" class="add-row-btn" on:click={addAccountRow}>+ Add another account</button>
			{#if accountError}<span class="error-msg">{accountError}</span>{/if}
		</div>

		<div class="form-group">
			<label for="target-cycle">Period</label>
			<select id="target-cycle" bind:value={cycle}>
				<option value="Monthly">Monthly</option>
				<option value="Weekly">Weekly</option>
				<option value="Quarterly">Quarterly</option>
				<option value="Yearly">Yearly</option>
			</select>
		</div>

		<div class="form-group">
			<label for="target-amount">Target Amount <span class="required">*</span></label>
			<input
				id="target-amount"
				type="number"
				min="0"
				step="0.01"
				bind:value={target}
				placeholder="0.00"
				class:error={targetError}
			/>
			{#if targetError}<span class="error-msg">{targetError}</span>{/if}
		</div>

		<div class="form-group">
			<label for="target-currency">Currency</label>
			<select id="target-currency" bind:value={currency}>
				{#each currencies as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
		</div>

		<div class="form-group rollover-row">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={isRollover} />
				Roll over
			</label>
		</div>

		{#if isRollover}
			<div class="form-group full-width">
				<label for="target-start">Start Date</label>
				<input id="target-start" type="date" bind:value={startDate} use:nativeDatePicker />
			</div>
		{/if}

		<div class="form-group full-width">
			<label for="target-tag">Tag <span class="optional">(optional)</span></label>
			<div class="tag-row">
				<select id="target-tag-mode" bind:value={tagMode}>
					<option value="has">Has tag</option>
					<option value="not_has">Does not have tag</option>
				</select>
				<input id="target-tag" type="text" bind:value={tag} placeholder="e.g. savings" />
			</div>
		</div>
	</div>

	<div class="modal-footer">
		<button class="cancel-btn" on:click={handleCancel}>Cancel</button>
		<button class="save-btn" on:click={handleSave}>{editingIndicator ? 'Save Changes' : 'Save Target'}</button>
	</div>
</div>

<style>
	.indicator-modal {
		padding: var(--size-4-4);
	}

	.indicator-modal h2 {
		margin: 0 0 var(--size-4-4);
		font-size: var(--font-ui-larger);
		color: var(--text-normal);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-2);
		margin-bottom: var(--size-4-3);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.required {
		color: var(--text-error);
	}

	input[type='text'],
	input[type='number'],
	input[type='date'],
	select {
		padding: var(--size-4-1) var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		width: 100%;
	}

	input.error,
	select.error {
		border-color: var(--text-error);
	}

	.error-msg {
		color: var(--text-error);
		font-size: var(--font-ui-smaller);
	}

	.account-rows {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.add-row-btn {
		align-self: flex-start;
		margin-top: var(--size-4-1);
		padding: 2px 0;
		background: transparent;
		border: none;
		box-shadow: none;
		color: var(--text-accent);
		cursor: pointer;
		font-size: var(--font-ui-smaller);
	}

	.add-row-btn:hover {
		text-decoration: underline;
	}

	.rollover-row {
		flex-direction: row;
		align-items: center;
		margin-top: auto;
		margin-bottom: auto;
		padding-top: var(--size-4-1);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	.optional {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}

	.tag-row {
		display: flex;
		gap: var(--size-4-2);
	}

	.tag-row select {
		flex-shrink: 0;
		width: auto;
	}

	.tag-row input {
		flex: 1;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-2);
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.cancel-btn {
		padding: var(--size-4-1) var(--size-4-4);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn {
		padding: var(--size-4-1) var(--size-4-4);
		background: var(--interactive-accent);
		border: none;
		border-radius: var(--radius-s);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn:hover {
		background: var(--interactive-accent-hover);
	}
</style>
