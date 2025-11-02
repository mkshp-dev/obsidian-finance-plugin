<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import HierarchicalDropdown from '../HierarchicalDropdown.svelte';
	import type { AccountNode } from '../../utils/index';
	import { parseAmount, debounce } from '../../utils/index';
	import type { TransactionController } from '../../controllers/TransactionController'; // Import controller type

	// --- PROPS ---
	// Receive the controller
	export let controller: TransactionController;
	// --- REMOVED all other data props ---

	// --- Get the store from the controller ---
	const stateStore = controller.state;
	// --- Auto-subscribe to the store's value ---
	$: state = $stateStore;
	// ------------------------------------------

	// --- LOCAL UI STATE (Filters) ---
	let selectedAccount: string | null = null;
	let startDate: string | null = null;
	let endDate: string | null = null;
	let payeeFilter: string = '';
	let debouncedPayeeFilter: string = '';
	let tagFilter: string = '';
	let debouncedTagFilter: string = '';
	
	// --- LOCAL UI STATE (Sorting) ---
	type SortColumn = 'date' | 'payee' | 'narration' | 'amount';
	let sortColumn: SortColumn = 'date';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let sortedTransactions: string[][] = [];

	const dispatch = createEventDispatcher();
	
	// --- Debounce handlers - Optimized for better UX ---
	const updateDebouncedPayee = debounce((value: string) => { debouncedPayeeFilter = value; }, 300);
	const updateDebouncedTag = debounce((value: string) => { debouncedTagFilter = value; }, 300);

	// --- REMOVED onMount data fetching ---

	// --- Sorting logic (remains local) ---
	function sortTransactions(transactions: string[][]) {
		const headers = ['date', 'payee', 'narration', 'amount'];
		const columnIndex = headers.indexOf(sortColumn);
		if (columnIndex === -1) {
			sortedTransactions = [...transactions]; return;
		}
		sortedTransactions = [...transactions].sort((a, b) => {
			const valA = a.length > columnIndex ? a[columnIndex] : '';
			const valB = b.length > columnIndex ? b[columnIndex] : '';
			if (sortColumn === 'amount') {
				const numA = parseAmount(valA).amount;
				const numB = parseAmount(valB).amount;
				return sortDirection === 'asc' ? numA - numB : numB - numA;
			}
			const comparison = valA.toLowerCase().localeCompare(valB.toLowerCase()); return sortDirection === 'asc' ? comparison : -comparison;
		});
	}
	function handleSort(column: SortColumn) {
		if (sortColumn === column) { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'; }
		else { sortColumn = column; sortDirection = 'desc'; }
	}

	// --- Reactive Statements ---
	$: updateDebouncedPayee(payeeFilter);
	$: updateDebouncedTag(tagFilter);

	$: filterState = {
		account: selectedAccount,
		startDate: startDate,
		endDate: endDate,
		payee: debouncedPayeeFilter,
		tag: debouncedTagFilter
	};
	
	let hasMounted = false;
	onMount(() => { hasMounted = true; });
	// Dispatch filter changes *up* to the parent controller
	$: if (hasMounted && filterState) {
		dispatch('filtersChange', filterState);
	}
	
	// REACT to incoming data *from* the parent controller
	$: if (state.currentTransactions) {
		sortTransactions(state.currentTransactions);
	}
	// Re-sort if sort criteria change
	$: if (sortColumn || sortDirection) {
		sortTransactions(state.currentTransactions);
	}
</script>

<div class="account-transactions-view">
	<datalist id="beancount-tags">
		{#each state.allTags as tag} <option value={tag}></option> {/each}
	</datalist>
	{#if state.isLoadingFilters}
		<p>Loading filters...</p>
	{:else}
		<div class="controls">
			<div>
				<label for="account-select">Account:</label>
				<HierarchicalDropdown
					treeData={state.accountTree} bind:selectedAccount={selectedAccount}
					placeholder="Select Account"
					disabled={state.isLoading || state.isLoadingFilters}
					isLoading={state.isLoadingFilters}
				/>
			</div>
			<div class="date-range">
				<label for="start-date">From:</label>
				<input type="date" id="start-date" bind:value={startDate} disabled={state.isLoading} />
				<label for="end-date">To:</label>
				<input type="date" id="end-date" bind:value={endDate} disabled={state.isLoading} />
			</div>
			<div>
				<label for="payee-filter">Payee:</label>
				<input type="text" id="payee-filter" bind:value={payeeFilter} placeholder="Filter by payee..." disabled={state.isLoading} />
			</div>
			<div>
				<label for="tag-filter">Tag:</label>
				<input type="text" id="tag-filter" bind:value={tagFilter} placeholder="Filter by tag..." disabled={state.isLoading} list="beancount-tags" />
			</div>
		</div>

		{#if state.isLoading}
			<p>Loading transactions...</p>
		{:else if state.error}
			<p class="error-message">Error loading transactions: {state.error}</p>
		{:else if sortedTransactions.length === 0}
			<p>No transactions found for the selected criteria.</p>
		{:else}
			<table class="transaction-table sortable">
				<thead>
					<tr>
						<th on:click={() => handleSort('date')} class:active={sortColumn === 'date'}>
							Date {sortColumn === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
						</th>
						<th on:click={() => handleSort('payee')} class:active={sortColumn === 'payee'}>
							Payee {sortColumn === 'payee' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
						</th>
						<th on:click={() => handleSort('narration')} class:active={sortColumn === 'narration'}>
							Narration {sortColumn === 'narration' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
						</th>
						<th on:click={() => handleSort('amount')} class:active={sortColumn === 'amount'}>
							Amount {sortColumn === 'amount' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedTransactions as [date, payee, narration, position]}
						<tr>
							<td>{date}</td>
							<td>{payee}</td>
							<td>{narration}</td>
							<td class="align-right">{position}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
</div>

<style>
	.account-transactions-view { padding: var(--size-4-4); height: 100%; overflow-y: auto; }
	.controls { margin-bottom: var(--size-4-4); display: flex; flex-wrap: wrap; align-items: center; gap: var(--size-4-4); }
	.controls > div { display: flex; align-items: center; gap: var(--size-4-2); }
	.controls label { font-weight: 600; margin-right: var(--size-4-1); white-space: nowrap; }
	.controls input[type="date"], .controls input[type="text"] { padding: var(--size-4-1) var(--size-4-2); }
	.controls input[type="text"] { min-width: 150px; }
	.transaction-table { width: 100%; border-collapse: collapse; }
	.transaction-table th { text-align: left; font-size: var(--font-ui-small); font-weight: 600; color: var(--text-muted); padding: 8px 6px; border-bottom: 1px solid var(--background-modifier-border); }
	.transaction-table th.active { color: var(--text-accent); }
	.transaction-table th { cursor: pointer; user-select: none; }
	.transaction-table th:hover { color: var(--text-normal); }
	.transaction-table td { padding: 6px; border-bottom: 1px solid var(--background-secondary); }
	.transaction-table tbody tr:nth-child(even) { background-color: var(--background-secondary-alt); }
	.align-right { text-align: right; font-family: var(--font-monospace); }
	.error-message { color: var(--text-error); }
</style>