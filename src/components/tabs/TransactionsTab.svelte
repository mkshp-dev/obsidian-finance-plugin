<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { parse } from 'csv-parse/sync';
	import HierarchicalDropdown from '../HierarchicalDropdown.svelte';
	import { buildAccountTree, debounce, parseAmount } from '../../utils/index';
	import type BeancountPlugin from '../../main';

	// --- PROPS ---
	// Data comes from the parent view
	export let plugin: BeancountPlugin;
	export let isLoading: boolean = true;
	export let error: string | null = null;
	export let incomingTransactions: string[][] = [];
	// ----------------

	// --- LOCAL UI STATE ---
	let allAccounts: string[] = [];
	let accountTree: AccountNode[] = [];
	let allTags: string[] = [];
	let isLoadingAccounts = true; // Separate loading for dropdowns

	// Filter state
	let selectedAccount: string | null = null;
	let startDate: string | null = null;
	let endDate: string | null = null;
	let payeeFilter: string = '';
	let debouncedPayeeFilter: string = '';
	let tagFilter: string = '';
	let debouncedTagFilter: string = '';
	
	// Sorting state
	type SortColumn = 'date' | 'payee' | 'narration' | 'amount';
	let sortColumn: SortColumn = 'date';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let sortedTransactions: string[][] = [];

	interface AccountNode { name: string; fullName: string | null; children: AccountNode[]; }
	
	const dispatch = createEventDispatcher();

	// --- Debounce handlers ---
	const updateDebouncedPayee = debounce((value: string) => { debouncedPayeeFilter = value; }, 1000);
	const updateDebouncedTag = debounce((value: string) => { debouncedTagFilter = value; }, 1000);

	// --- onMount: Fetch data for filters ONLY ---
	onMount(async () => {
		isLoadingAccounts = true;
		try {
			const [accountResult, tagResult] = await Promise.all([
				plugin.runQuery('SELECT account'),
				plugin.runQuery('SELECT tags')
			]);

			// Process Accounts
			const cleanAccountStdout = accountResult.replace(/\r/g, "").trim();
			const accountRecords: string[][] = parse(cleanAccountStdout, { columns: false, skip_empty_lines: true });
			const firstAccountRowIsHeader = accountRecords[0]?.[0]?.toLowerCase() === 'account';
			const accountDataRows = firstAccountRowIsHeader ? accountRecords.slice(1) : accountRecords;
			allAccounts = [...new Set(accountDataRows.map(row => row?.[0]).filter(Boolean))];
			const builtTree = buildAccountTree(allAccounts);
			const allNode: AccountNode = { name: 'All Accounts', fullName: null, children: [] };
			accountTree = [allNode, ...builtTree];
			selectedAccount = null; // Set default

			// Process Tags
			const cleanTagStdout = tagResult.replace(/\r/g, "").trim();
			const tagRecords: string[][] = parse(cleanTagStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
			const firstTagRowIsHeader = tagRecords[0]?.[0]?.toLowerCase() === 'tags';
			const tagDataRows = firstTagRowIsHeader ? tagRecords.slice(1) : tagRecords;
			allTags = [...new Set(tagDataRows.flat().flatMap(tagStr => tagStr ? tagStr.split(',') : []).map(tag => tag.trim()).filter(tag => tag !== ''))];
		} catch (e) {
			console.error("TransactionsTab: ERROR in onMount:", e);
			// Show error in the *main* error prop?
			// error = `Failed to load accounts or tags: ${e.message}`;
		} finally {
			isLoadingAccounts = false;
		}
	});

	// --- Sorting logic (remains local) ---
	function sortTransactions(transactions: string[][]) {
		const headers = ['date', 'payee', 'narration', 'amount'];
		const columnIndex = headers.indexOf(sortColumn);
		if (columnIndex === -1) {
			sortedTransactions = [...transactions];
			return;
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
	// Update debounced filters
	$: updateDebouncedPayee(payeeFilter);
	$: updateDebouncedTag(tagFilter);

	// Create combined filter state
	$: filterState = {
		account: selectedAccount,
		startDate: startDate,
		endDate: endDate,
		payee: debouncedPayeeFilter,
		tag: debouncedTagFilter
	};

	// --- DISPATCH filter changes ---
	let hasMounted = false;
	onMount(() => { hasMounted = true; });
	$: if (hasMounted && filterState) {
		dispatch('filtersChange', filterState);
	}
	
	// --- REACT to incoming data ---
	$: if (incomingTransactions) {
		sortTransactions(incomingTransactions); // Sort the new data
	}
	// Re-sort if sort criteria change
	$: if (sortColumn || sortDirection) {
		sortTransactions(incomingTransactions);
	}
</script>

<div class="account-transactions-view">
	<datalist id="beancount-tags">
		{#each allTags as tag} <option value={tag}></option> {/each}
	</datalist>
	{#if isLoadingAccounts}
		<p>Loading filters...</p>
	{:else}
		<div class="controls">
			<div>
				<label for="account-select">Account:</label>
				<HierarchicalDropdown
					treeData={accountTree} bind:selectedAccount={selectedAccount}
					placeholder="Select Account"
					disabled={isLoading || isLoadingAccounts}
					isLoading={isLoadingAccounts}
				/>
			</div>
			<div class="date-range">
				<label for="start-date">From:</label>
				<input type="date" id="start-date" bind:value={startDate} disabled={isLoading} />
				<label for="end-date">To:</label>
				<input type="date" id="end-date" bind:value={endDate} disabled={isLoading} />
			</div>
			<div>
				<label for="payee-filter">Payee:</label>
				<input type="text" id="payee-filter" bind:value={payeeFilter} placeholder="Filter by payee..." disabled={isLoading} />
			</div>
			<div>
				<label for="tag-filter">Tag:</label>
				<input type="text" id="tag-filter" bind:value={tagFilter} placeholder="Filter by tag..." disabled={isLoading} list="beancount-tags" />
			</div>
		</div>

		{#if isLoading}
			<p>Loading transactions...</p>
		{:else if error}
			<p class="error-message">Error loading transactions: {error}</p>
		{:else if sortedTransactions.length === 0}
			<p>No transactions found for the selected criteria.</p>
		{:else}
			<table class="transaction-table sortable">
				<thead>
					<tr>
						<th on:click={() => handleSort('date')} class:active={sortColumn === 'date'}>Date {sortColumn === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
						<th on:click={() => handleSort('payee')} class:active={sortColumn === 'payee'}>Payee {sortColumn === 'payee' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
						<th on:click={() => handleSort('narration')} class:active={sortColumn === 'narration'}>Narration {sortColumn === 'narration' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
						<th on:click={() => handleSort('amount')} class:active={sortColumn === 'amount'}>Amount {sortColumn === 'amount' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
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