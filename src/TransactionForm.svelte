<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	
	export let accountList: string[] = [];
	export let defaultCurrency: string = 'USD';

	// --- NEW FORM STATE ---
	let date: string = new Date().toISOString().slice(0, 10);
	let payee: string = '';
	let narration: string = ''; // <-- NEW
	let tag: string = '';       // <-- NEW
	let amount: string = '';
	let fromAccount: string = localStorage.getItem('beancount-lastFrom') || 'Assets:Checking';
	let toAccount: string = localStorage.getItem('beancount-lastTo') || 'Expenses:';
	let currency: string = defaultCurrency;

	const dispatch = createEventDispatcher();

	function handleSubmit() {
		localStorage.setItem('beancount-lastFrom', fromAccount);
		localStorage.setItem('beancount-lastTo', toAccount);
		
		dispatch('submit', {
			date,
			payee,
			narration, // <-- NEW
			tag,       // <-- NEW
			amount,
			fromAccount,
			toAccount,
			currency
		});
	}

	let payeeInput: HTMLInputElement;
	onMount(() => {
		if (payeeInput) {
			payeeInput.focus();
		}
	});
</script>

<datalist id="beancount-accounts">
	{#each accountList as account}
		<option value={account}></option>
	{/each}
</datalist>

<form on:submit|preventDefault={handleSubmit}>
	<div class="setting-item">
		<div class="setting-item-info"><div class="setting-item-name">Date</div></div>
		<div class="setting-item-control">
			<input type="date" bind:value={date} required />
		</div>
	</div>

	<div class="setting-item">
		<div class="setting-item-info"><div class="setting-item-name">Payee</div></div>
		<div class="setting-item-control">
			<input type="text" bind:this={payeeInput} bind:value={payee} placeholder="e.g., Coffee Shop" required />
		</div>
	</div>

	<div class="setting-item">
		<div class="setting-item-info"><div class="setting-item-name">Narration</div></div>
		<div class="setting-item-control">
			<input type="text" bind:value={narration} placeholder="(Optional) e.g., Weekly groceries" />
		</div>
	</div>

	<div class="setting-item">
		<div class="setting-item-info"><div class="setting-item-name">Tag</div></div>
		<div class="setting-item-control">
			<input type="text" bind:value={tag} placeholder="(Optional) e.g., #trip-2025" />
		</div>
	</div>
	<div class="form-row">
		<div class="setting-item" style="flex: 2;">
			<div class="setting-item-info"><div class="setting-item-name">Amount</div></div>
			<div class="setting-item-control">
				<input type="number" step="0.01" bind:value={amount} placeholder="e.g., 4.50" required />
			</div>
		</div>
		<div class="setting-item" style="flex: 1;">
			<div class="setting-item-info"><div class="setting-item-name">Currency</div></div>
			<div class="setting-item-control">
				<input type="text" bind:value={currency} required />
			</div>
		</div>
	</div>

	<div class="setting-item">
		<div class="setting-item-info"><div class="setting-item-name">From Account</div></div>
		<div class="setting-item-control">
			<input type="text" bind:value={fromAccount} list="beancount-accounts" required />
		</div>
	</div>

	<div class="setting-item">
		<div class="setting-item-info"><div class="setting-item-name">To Account</div></div>
		<div class="setting-item-control">
			<input type="text" bind:value={toAccount} list="beancount-accounts" required />
		</div>
	</div>

	<div class="setting-item">
		<div class="setting-item-control">
			<button type="submit" class="mod-cta">Add Transaction</button>
		</div>
	</div>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	input[type="text"], input[type="date"], input[type="number"] {
		width: 100%;
	}
	.form-row {
		display: flex;
		gap: 10px;
	}
	.form-row .setting-item {
		margin-bottom: 0;
	}
</style>