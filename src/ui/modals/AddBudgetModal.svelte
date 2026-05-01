<!-- src/ui/modals/AddBudgetModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let accounts: string[] = [];
	export let currencies: string[] = ['INR', 'USD', 'EUR', 'GBP'];
	export let defaultCurrency: string = 'USD';

	// Form state
	let name: string = '';
	let accountQuery: string = '';
	let cycle: 'Monthly' | 'Weekly' = 'Monthly';
	let target: string = '';
	let currency: string = defaultCurrency;
	let isRollover: boolean = false;
	let startDate: string = new Date().toISOString().split('T')[0];

	// UI state
	let nameError: string = '';
	let accountError: string = '';
	let targetError: string = '';

	// Filtered expense accounts
	$: expenseAccounts = accounts.filter(a => a.startsWith('Expenses'));
	$: filteredAccounts = accountQuery
		? expenseAccounts.filter(a => a.toLowerCase().includes(accountQuery.toLowerCase()))
		: expenseAccounts;
	let showDropdown = false;

	onMount(() => {
		currency = defaultCurrency;
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
		if (!accountQuery.trim()) {
			accountError = 'Account is required';
			valid = false;
		}
		const t = parseFloat(target);
		if (!target || isNaN(t) || t <= 0) {
			targetError = 'Enter a positive number';
			valid = false;
		}
		return valid;
	}

	function selectAccount(acc: string) {
		accountQuery = acc;
		showDropdown = false;
	}

	function handleSave() {
		if (!validate()) return;
		dispatch('save', {
			name: name.trim(),
			accountQuery: accountQuery.trim(),
			cycle,
			target: parseFloat(target),
			currency,
			isRollover,
			startDate,
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="indicator-modal">
	<h2>Add Budget</h2>

	<div class="form-group">
		<label for="budget-name">Name <span class="required">*</span></label>
		<input
			id="budget-name"
			type="text"
			bind:value={name}
			placeholder="e.g. Total Monthly Expenses"
			class:error={nameError}
		/>
		{#if nameError}<span class="error-msg">{nameError}</span>{/if}
	</div>

	<div class="form-group">
		<label for="budget-account">Expense Account <span class="required">*</span></label>
		<div class="autocomplete-wrapper">
			<input
				id="budget-account"
				type="text"
				bind:value={accountQuery}
				placeholder="e.g. Expenses:Food"
				class:error={accountError}
				on:focus={() => (showDropdown = true)}
				on:blur={() => setTimeout(() => (showDropdown = false), 150)}
			/>
			{#if showDropdown && filteredAccounts.length > 0}
				<ul class="autocomplete-dropdown">
					{#each filteredAccounts.slice(0, 8) as acc}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<li on:click={() => selectAccount(acc)}>{acc}</li>
					{/each}
				</ul>
			{/if}
		</div>
		{#if accountError}<span class="error-msg">{accountError}</span>{/if}
	</div>

	<div class="form-row">
		<div class="form-group">
			<label for="budget-cycle">Period</label>
			<select id="budget-cycle" bind:value={cycle}>
				<option value="Monthly">Monthly</option>
				<option value="Weekly">Weekly</option>
			</select>
		</div>

		<div class="form-group">
			<label for="budget-target">Target <span class="required">*</span></label>
			<input
				id="budget-target"
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
			<label for="budget-currency">Currency</label>
			<select id="budget-currency" bind:value={currency}>
				{#each currencies as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="form-group rollover-row">
		<label class="toggle-label">
			<input type="checkbox" bind:checked={isRollover} />
			Roll over
		</label>
	</div>

	{#if isRollover}
		<div class="form-group">
			<label for="budget-start">Start Date</label>
			<input id="budget-start" type="date" bind:value={startDate} />
		</div>
	{/if}

	<div class="modal-actions">
		<button class="cancel-btn" on:click={handleCancel}>Cancel</button>
		<button class="save-btn" on:click={handleSave}>Save Budget</button>
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

	.form-group {
		margin-bottom: var(--size-4-3);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: var(--size-4-3);
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

	.autocomplete-wrapper {
		position: relative;
	}

	.autocomplete-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		max-height: 160px;
		overflow-y: auto;
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
	}

	.autocomplete-dropdown li {
		padding: var(--size-4-1) var(--size-4-2);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.autocomplete-dropdown li:hover {
		background: var(--background-modifier-hover);
	}

	.rollover-row {
		flex-direction: row;
		align-items: center;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	.modal-actions {
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
