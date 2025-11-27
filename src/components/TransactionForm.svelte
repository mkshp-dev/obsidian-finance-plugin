<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	// Props
	export let accountList: string[] = [];
	export let operatingCurrency: string = 'USD';

	// State
	let activeTab: 'transaction' | 'balance' | 'note' = 'transaction';
	let date: string = new Date().toISOString().slice(0, 10);
	let payee: string = '';
	let narration: string = '';
	let tag: string = '';

	// Date validation
	function validateDate(dateString: string): boolean {
		const selectedDate = new Date(dateString);
		const today = new Date();
		const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
		const oneYearFromNow = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
		
		return selectedDate >= oneYearAgo && selectedDate <= oneYearFromNow;
	}

	// Smart date suggestions
	function getDateSuggestions() {
		const today = new Date();
		return {
			today: today.toISOString().slice(0, 10),
			yesterday: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
			lastWeek: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
		};
	}

	// --- NEW: Postings Array State ---
	interface Posting {
		account: string;
		amount: string; // Keep as string for input binding
		currency: string;
	}
	// Start with two empty postings
	let postings: Posting[] = [
		{ account: localStorage.getItem('beancount-lastTo') || 'Expenses:', amount: '', currency: operatingCurrency }, // Typically the expense
		{ account: localStorage.getItem('beancount-lastFrom') || 'Assets:Checking', amount: '', currency: operatingCurrency } // Typically the source
	];
	// -------------------------------

	// State for Balance/Note tabs (kept separate)
	let balanceAccount: string = localStorage.getItem('beancount-lastBalanceAcct') || 'Assets:Checking';
	let noteAccount: string = localStorage.getItem('beancount-lastNoteAcct') || 'Assets:Checking';
	let noteText: string = '';
	// Amount/Currency used by Balance tab
	let amount: string = '';
	let currency: string = operatingCurrency;


	const dispatch = createEventDispatcher();

	// --- NEW: Functions to manage postings ---
	function addPosting() {
		postings = [...postings, { account: '', amount: '', currency: operatingCurrency }];
	}

	function removePosting(index: number) {
		// Only allow removal if more than 2 postings exist
		if (postings.length > 2) {
			postings = postings.filter((_, i) => i !== index);
		}
	}
	// ---------------------------------------

	function handleSubmit() {
		// Validate date before submission
		if (!validateDate(date)) {
			alert('Please select a date within the last year to next year range.');
			return;
		}

		let data: any = { type: activeTab };

		if (activeTab === 'transaction') {
			// Save last used accounts from the *last* two postings (common pattern)
			if (postings.length >= 2) {
				localStorage.setItem('beancount-lastTo', postings[postings.length - 2].account); // Second to last often expense/dest
				localStorage.setItem('beancount-lastFrom', postings[postings.length - 1].account); // Last often asset/source
			}
			data = { ...data, date, payee, narration, tag, postings }; // Send the postings array
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

	function setTab(tab: typeof activeTab) {
		activeTab = tab;
		if (tab === 'transaction' && payeeInput) {
			setTimeout(() => payeeInput.focus(), 0);
		}
	}

</script>

<datalist id="beancount-accounts">
	{#each accountList as account}
		<option value={account}></option>
	{/each}
</datalist>


<div class="transaction-form-card">
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
				<div class="setting-item-control"><input type="text" bind:value={narration} placeholder="(Optional)" /></div>
			</div>
			<div class="setting-item">
				<div class="setting-item-info"><div class="setting-item-name">Tag</div></div>
				<div class="setting-item-control"><input type="text" bind:value={tag} placeholder="(Optional)" /></div>
			</div>

			<div class="postings-section">
				<div class="setting-item-info"><div class="setting-item-name">Postings</div></div>
				{#each postings as posting, index (index)}
					<div class="posting-row">
						<div class="setting-item">
							<div class="setting-item-control">
								<input type="text" bind:value={posting.account} list="beancount-accounts" placeholder="Account" required />
							</div>
						</div>
						<div class="setting-item amount-currency">
							<input class="amount-input" type="number" step="0.01" bind:value={posting.amount} placeholder="Amount (leave one blank)" />
							<input class="currency-input" type="text" bind:value={posting.currency} placeholder="Curr" required />
						</div>
						<button type="button" class="remove-button" on:click={() => removePosting(index)} disabled={postings.length <= 2}>
							&#10005; </button>
					</div>
				{/each}
				<button type="button" class="add-button" on:click={addPosting}>+ Add Posting</button>
			</div>
		{:else if activeTab === 'balance'}
			<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">Date</div></div><div class="setting-item-control"><input type="date" bind:value={date} required /></div></div>
			<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">Account</div></div><div class="setting-item-control"><input type="text" bind:value={balanceAccount} list="beancount-accounts" required /></div></div>
			<div class="form-row"><div class="setting-item" style="flex: 2;"><div class="setting-item-info"><div class="setting-item-name">Amount</div></div><div class="setting-item-control"><input type="number" step="0.01" bind:value={amount} placeholder="e.g., 913.90" required /></div></div><div class="setting-item" style="flex: 1;"><div class="setting-item-info"><div class="setting-item-name">Currency</div></div><div class="setting-item-control"><input type="text" bind:value={currency} required /></div></div></div>

		{:else if activeTab === 'note'}
			<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">Date</div></div><div class="setting-item-control"><input type="date" bind:value={date} required /></div></div>
			<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">Account</div></div><div class="setting-item-control"><input type="text" bind:value={noteAccount} list="beancount-accounts" required /></div></div>
			<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">Note Text</div></div><div class="setting-item-control"><input type="text" bind:value={noteText} placeholder="e.g., Reconciled" required /></div></div>
		{/if}

		<div class="setting-item"><div class="setting-item-control"><button type="submit" class="mod-cta">{#if activeTab === 'transaction'}Add Transaction{:else if activeTab === 'balance'}Add Balance Check{:else if activeTab === 'note'}Add Note{/if}</button></div></div>
	</form>
</div>

<style>
	/* Tab styles (unchanged) */
	.transaction-form-card {
		background: var(--background-primary);
		border-radius: 10px;
		border: 1px solid var(--background-modifier-border);
		box-shadow: 0 2px 8px rgba(0,0,0,0.04);
		padding: 24px 24px 18px 24px;
		max-width: 520px;
		margin: 0 auto;
	}
	.beancount-tabs {
		display: flex;
		border-bottom: none;
		margin-bottom: 20px;
		background: none;
		border-radius: 0;
		box-shadow: none;
		padding: 0;
	}
	.beancount-tabs button { padding: 8px 16px; border: none; border-bottom: 2px solid transparent; background: none; color: var(--text-muted); cursor: pointer; margin-bottom: -1px; }
	.beancount-tabs button.active { color: var(--text-normal); border-bottom-color: var(--interactive-accent); }
	.beancount-tabs button:hover { color: var(--text-normal); }

	/* Form layout */
	form { display: flex; flex-direction: column; gap: 15px; }
	input[type="text"], input[type="date"], input[type="number"] { width: 100%; }
	.form-row { display: flex; gap: 10px; }
	.form-row .setting-item { margin-bottom: 0; }

	/* --- NEW: Posting Styles --- */
	.postings-section {
		border-top: none;
		padding-top: 15px;
	}
	.posting-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px; /* Space between rows */
	}
	/* Make account input take most space */
	.posting-row .setting-item:first-child {
		flex: 3; /* Adjust ratio as needed */
		margin-bottom: 0;
	}
	/* Container for amount and currency */
	.posting-row .amount-currency {
		flex: 2; /* Adjust ratio as needed */
		display: flex;
		gap: 5px;
		margin-bottom: 0;
	}
	.amount-currency .amount-input {
		flex: 3; /* Amount takes more space */
	}
	.amount-currency .currency-input {
		flex: 1; /* Currency takes less space */
		min-width: 50px; /* Ensure currency is readable */
	}
	/* Style remove button */
	.remove-button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		line-height: 1; /* Prevent extra height */
		flex-shrink: 0;
	}
	.remove-button:hover {
		color: var(--text-error);
	}
	.remove-button:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}
	/* Style add button */
	.add-button {
		margin-top: 5px;
		width: auto; /* Don't take full width */
	}
	/* ------------------------- */

	/* Ensure setting-item labels display correctly if needed */
	.setting-item-info { min-width: 80px; /* Adjust as needed */ }
</style>