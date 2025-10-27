<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let accountList: string[] = [];
	export let defaultCurrency: string = 'USD';

	// --- NEW: State for active tab ---
	let activeTab: 'transaction' | 'balance' | 'note' = 'transaction';
	// ---------------------------------

	// Form state - keep all fields, but only show relevant ones
	let date: string = new Date().toISOString().slice(0, 10);
	let payee: string = '';
	let narration: string = '';
	let tag: string = '';
	let amount: string = '';
	let currency: string = defaultCurrency;
	// Use separate variables for balance/note account to avoid conflicts
	let balanceAccount: string = localStorage.getItem('beancount-lastBalanceAcct') || 'Assets:Checking';
	let noteAccount: string = localStorage.getItem('beancount-lastNoteAcct') || 'Assets:Checking';
	let noteText: string = '';
	// Use separate variables for transaction accounts
	let fromAccount: string = localStorage.getItem('beancount-lastFrom') || 'Assets:Checking';
	let toAccount: string = localStorage.getItem('beancount-lastTo') || 'Expenses:';


	const dispatch = createEventDispatcher();

	function handleSubmit() {
		let data: any = { type: activeTab };

		// Save relevant state based on the active tab
		if (activeTab === 'transaction') {
			localStorage.setItem('beancount-lastFrom', fromAccount);
			localStorage.setItem('beancount-lastTo', toAccount);
			data = { ...data, date, payee, narration, tag, amount, fromAccount, toAccount, currency };
		} else if (activeTab === 'balance') {
			localStorage.setItem('beancount-lastBalanceAcct', balanceAccount);
			data = { ...data, date, account: balanceAccount, amount, currency };
		} else if (activeTab === 'note') {
			localStorage.setItem('beancount-lastNoteAcct', noteAccount);
			data = { ...data, date, account: noteAccount, text: noteText };
		}

		dispatch('submit', data);
	}

	// Autofocus payee field for transactions
	let payeeInput: HTMLInputElement;
	onMount(() => {
		if (activeTab === 'transaction' && payeeInput) {
			payeeInput.focus();
		}
	});

	// --- NEW: Function to change tab ---
	function setTab(tab: typeof activeTab) {
		activeTab = tab;
		// Refocus payee if switching back to transaction
		if (tab === 'transaction' && payeeInput) {
			// Use timeout to ensure element is visible before focusing
			setTimeout(() => payeeInput.focus(), 0);
		}
	}
	// ------------------------------------

</script>

<datalist id="beancount-accounts">
	{#each accountList as account}
		<option value={account}></option>
	{/each}
</datalist>

<div class="beancount-tabs">
	<button class:active={activeTab === 'transaction'} on:click={() => setTab('transaction')}>Transaction</button>
	<button class:active={activeTab === 'balance'} on:click={() => setTab('balance')}>Balance</button>
	<button class:active={activeTab === 'note'} on:click={() => setTab('note')}>Note</button>
</div>
<form on:submit|preventDefault={handleSubmit}>

	{#if activeTab === 'transaction'}
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Date</div></div>
			<div class="setting-item-control"><input type="date" bind:value={date} required /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Payee</div></div>
			<div class="setting-item-control"><input type="text" bind:this={payeeInput} bind:value={payee} placeholder="e.g., Coffee Shop" required /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Narration</div></div>
			<div class="setting-item-control"><input type="text" bind:value={narration} placeholder="(Optional) e.g., Weekly groceries" /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Tag</div></div>
			<div class="setting-item-control"><input type="text" bind:value={tag} placeholder="(Optional) e.g., #trip-2025" /></div>
		</div>
		<div class="form-row">
			<div class="setting-item" style="flex: 2;">
				<div class="setting-item-info"><div class="setting-item-name">Amount</div></div>
				<div class="setting-item-control"><input type="number" step="0.01" bind:value={amount} placeholder="e.g., 4.50" required /></div>
			</div>
			<div class="setting-item" style="flex: 1;">
				<div class="setting-item-info"><div class="setting-item-name">Currency</div></div>
				<div class="setting-item-control"><input type="text" bind:value={currency} required /></div>
			</div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">From Account</div></div>
			<div class="setting-item-control"><input type="text" bind:value={fromAccount} list="beancount-accounts" required /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">To Account</div></div>
			<div class="setting-item-control"><input type="text" bind:value={toAccount} list="beancount-accounts" required /></div>
		</div>

	{:else if activeTab === 'balance'}
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Date</div></div>
			<div class="setting-item-control"><input type="date" bind:value={date} required /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Account</div></div>
			<div class="setting-item-control"><input type="text" bind:value={balanceAccount} list="beancount-accounts" required /></div>
		</div>
		<div class="form-row">
			<div class="setting-item" style="flex: 2;">
				<div class="setting-item-info"><div class="setting-item-name">Amount</div></div>
				<div class="setting-item-control"><input type="number" step="0.01" bind:value={amount} placeholder="e.g., 913.90" required /></div>
			</div>
			<div class="setting-item" style="flex: 1;">
				<div class="setting-item-info"><div class="setting-item-name">Currency</div></div>
				<div class="setting-item-control"><input type="text" bind:value={currency} required /></div>
			</div>
		</div>

	{:else if activeTab === 'note'}
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Date</div></div>
			<div class="setting-item-control"><input type="date" bind:value={date} required /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Account</div></div>
			<div class="setting-item-control"><input type="text" bind:value={noteAccount} list="beancount-accounts" required /></div>
		</div>
		<div class="setting-item">
			<div class="setting-item-info"><div class="setting-item-name">Note Text</div></div>
			<div class="setting-item-control"><input type="text" bind:value={noteText} placeholder="e.g., Reconciled" required /></div>
		</div>
	{/if}
	<div class="setting-item">
		<div class="setting-item-control">
			<button type="submit" class="mod-cta">
				{#if activeTab === 'transaction'}Add Transaction
				{:else if activeTab === 'balance'}Add Balance Check
				{:else if activeTab === 'note'}Add Note
				{/if}
			</button>
		</div>
	</div>
</form>

<style>
	/* --- NEW: Tab Styles --- */
	.beancount-tabs {
		display: flex;
		border-bottom: 1px solid var(--background-modifier-border);
		margin-bottom: 20px;
	}
	.beancount-tabs button {
		padding: 8px 16px;
		border: none;
		border-bottom: 2px solid transparent; /* Hidden border */
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		margin-bottom: -1px; /* Overlap the container border */
	}
	.beancount-tabs button.active {
		color: var(--text-normal);
		border-bottom-color: var(--interactive-accent); /* Highlight active tab */
	}
	.beancount-tabs button:hover {
		color: var(--text-normal);
	}
	/* --- End Tab Styles --- */

	form { display: flex; flex-direction: column; gap: 15px; }
	input[type="text"], input[type="date"], input[type="number"] { width: 100%; }
	.form-row { display: flex; gap: 10px; }
	.form-row .setting-item { margin-bottom: 0; }
</style>