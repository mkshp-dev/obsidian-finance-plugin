<script lang="ts">
	import { onMount } from 'svelte';
	import { parse } from 'csv-parse/sync'; // Keep parse for onMount processing
	import HierarchicalDropdown from '../components/HierarchicalDropdown.svelte';
	import { buildAccountTree, debounce } from '../utils/index';

	export let runQuery: (query: string) => Promise<string>;

	// Component State (remains largely the same)
	let allAccounts: string[] = [];
	let accountTree: AccountNode[] = [];
	let selectedAccount: string | null = null;
	let transactions: string[][] = []; // Raw data from parent (if we move fetching)
	let sortedTransactions: string[][] = []; // Display data
	let isLoadingAccounts = true;
	let isLoadingTransactions = false;
	let error: string | null = null;
	let startDate: string | null = null;
	let endDate: string | null = null;
	let payeeFilter: string = '';
	let debouncedPayeeFilter: string = '';
	let allTags: string[] = [];
	let tagFilter: string = '';
	let debouncedTagFilter: string = '';

	// Sorting State
	type SortColumn = 'date' | 'payee' | 'narration' | 'amount';
	let sortColumn: SortColumn = 'date';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// AccountNode Interface (can stay here or move to types/index.ts)
	interface AccountNode { name: string; fullName: string | null; children: AccountNode[]; }

	// Debounce handlers (use imported debounce)
	const updateDebouncedPayee = debounce((value: string) => { debouncedPayeeFilter = value; }, 1000);
	const updateDebouncedTag = debounce((value: string) => { debouncedTagFilter = value; }, 1000);

	// onMount still fetches initial dropdown data (accounts, tags)
	onMount(async () => {
		isLoadingAccounts = true; error = null;
		try {
			// Use runQuery prop passed from parent
			const [accountResult, tagResult] = await Promise.all([
				runQuery('SELECT account'),
				runQuery('SELECT tags')
			]);

			// Process Accounts (Use imported buildAccountTree)
			const cleanAccountStdout = accountResult.replace(/\r/g, "").trim();
			const accountRecords: string[][] = parse(cleanAccountStdout, { columns: false, skip_empty_lines: true });
			const firstAccountRowIsHeader = accountRecords[0]?.[0]?.toLowerCase() === 'account';
			const accountDataRows = firstAccountRowIsHeader ? accountRecords.slice(1) : accountRecords;
			allAccounts = [...new Set(accountDataRows.map(row => row?.[0]).filter(Boolean))];
			const builtTree = buildAccountTree(allAccounts); // Use imported function
			const allNode: AccountNode = { name: 'All Accounts', fullName: null, children: [] };
			accountTree = [allNode, ...builtTree];
			selectedAccount = null; // Default selection triggers initial fetch via reactivity

			// Process Tags (unchanged logic)
			const cleanTagStdout = tagResult.replace(/\r/g, "").trim();
			const tagRecords: string[][] = parse(cleanTagStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
			const firstTagRowIsHeader = tagRecords[0]?.[0]?.toLowerCase() === 'tags';
			const tagDataRows = firstTagRowIsHeader ? tagRecords.slice(1) : tagRecords;
			allTags = [...new Set(tagDataRows.flat().flatMap(tagStr => tagStr ? tagStr.split(',') : []).map(tag => tag.trim()).filter(tag => tag !== ''))];

		} catch (e) { console.error("DashboardView: ERROR in onMount:", e); error = `Failed to load accounts or tags: ${e.message}`;
		} finally { isLoadingAccounts = false; }
	});

	// --- Sorting logic remains in Svelte component for now ---
	function sortTransactions() {
		const headers = ['date', 'payee', 'narration', 'amount'];
		const columnIndex = headers.indexOf(sortColumn);
		if (columnIndex === -1) return;
		sortedTransactions = [...transactions].sort((a, b) => { // Sorts the 'transactions' prop
			const valA = a.length > columnIndex ? a[columnIndex] : '';
			const valB = b.length > columnIndex ? b[columnIndex] : '';
			if (sortColumn === 'amount') {
				const numRegex = /(-?[\d,]+(?:\.\d+)?)/; const matchA = valA.match(numRegex); const matchB = valB.match(numRegex);
				const numA = matchA ? parseFloat(matchA[1].replace(/,/g, '')) : 0; const numB = matchB ? parseFloat(matchB[1].replace(/,/g, '')) : 0;
				return sortDirection === 'asc' ? numA - numB : numB - numA;
			}
			const comparison = valA.toLowerCase().localeCompare(valB.toLowerCase()); return sortDirection === 'asc' ? comparison : -comparison;
		});
	}
	function handleSort(column: SortColumn) {
		if (sortColumn === column) { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'; }
		else { sortColumn = column; sortDirection = 'desc'; }
		// Sort triggers reactively below
	}
	// ---------------------------------------------------------

	// --- Reactive Statements ---
	// Update debounced filters
	$: updateDebouncedPayee(payeeFilter);
	$: updateDebouncedTag(tagFilter);

	// --- Dispatch filter changes to parent ---
	// We no longer fetch directly. We tell the parent the filters changed.
	import { createEventDispatcher } from 'svelte'; // Add this import if not present
	const dispatch = createEventDispatcher();

	$: filterState = { // Create an object of all filter values
		account: selectedAccount,
		startDate: startDate,
		endDate: endDate,
		payee: debouncedPayeeFilter,
		tag: debouncedTagFilter
	};
	$: console.log("Filters Changed:", filterState); // Debug log

	// Dispatch 'filtersChange' event whenever filterState changes AFTER mount
	let hasMounted = false;
	onMount(() => { hasMounted = true; });
	$: if (hasMounted && filterState) {
		dispatch('filtersChange', filterState);
	}
	// ----------------------------------------

	// --- Update: Receive transactions as a prop ---
	export let incomingTransactions: string[][] = []; // New prop for raw transactions
	// When the prop changes, update local state and sort
	$: if (incomingTransactions) {
		transactions = incomingTransactions;
		sortTransactions();
	}
	// ----------------------------------------------

	// Sorting triggers (unchanged)
	$: if (sortColumn || sortDirection) { sortTransactions(); }

</script>
<div class="account-transactions-view">
	<datalist id="beancount-tags">
		{#each allTags as tag}
			<option value={tag}></option>
		{/each}
	</datalist>
	{#if isLoadingAccounts}
		<p>Loading accounts...</p>
	{:else if error && allAccounts.length === 0}
		<p class="error-message">Error loading accounts: {error}</p>
	{:else}
		<div class="controls">
			<div>
				<label for="account-select">Account:</label>
				<HierarchicalDropdown
					treeData={accountTree} bind:selectedAccount={selectedAccount}
					placeholder="Select Account"
					disabled={isLoadingTransactions || isLoadingAccounts}
					isLoading={isLoadingAccounts}
				/>
			</div>
			<div class="date-range">
				<label for="start-date">From:</label>
				<input type="date" id="start-date" bind:value={startDate} disabled={isLoadingTransactions} />
				<label for="end-date">To:</label>
				<input type="date" id="end-date" bind:value={endDate} disabled={isLoadingTransactions} />
			</div>
			<div>
				<label for="payee-filter">Payee:</label>
				<input type="text" id="payee-filter" bind:value={payeeFilter} placeholder="Filter by payee..." disabled={isLoadingTransactions} />
			</div>
		</div>
		<div>
			<label for="tag-filter">Tag:</label>
			<input
				type="text"
				id="tag-filter"
				bind:value={tagFilter}
				placeholder="Filter by tag (e.g., travel)..."
				disabled={isLoadingTransactions}
				list="beancount-tags" />
		</div>
		<!-- {console.log("DashboardView: Rendering table section. State:", { isLoadingTransactions, error, sortedTransactionsLength: sortedTransactions.length })} -->

		{#if isLoadingTransactions}
			<p>Loading transactions...</p>
		{:else if error}
			<p class="error-message">Error loading transactions: {error}</p>
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
					{#each sortedTransactions as row, index}
						{@const [date, payee, narration, position] = row}
						<tr>
							<td>{date ?? ''}</td>
							<td>{payee ?? ''}</td>
							<td>{narration ?? ''}</td>
							<td class="align-right">{position ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if} {/if} </div>

<style>
	.account-transactions-view { padding: var(--size-4-4); height: 100%; overflow-y: auto; }
	.controls {
		margin-bottom: var(--size-4-4);
		display: flex;
		flex-wrap: wrap; /* Allow wrapping */
		align-items: center;
		gap: var(--size-4-4); /* Space between filter groups */
	}
	/* Ensure consistent styling for filter groups */
	.controls > div { display: flex; align-items: center; gap: var(--size-4-2); }
	.controls label { font-weight: 600; margin-right: var(--size-4-1); white-space: nowrap; }
	.controls input[type="date"], .controls input[type="text"] {
		padding: var(--size-4-1) var(--size-4-2);
	}
	.controls input[type="text"] {
		min-width: 150px; /* Give payee filter some width */
	}

	/* Replace existing table styles with these */
	.transaction-table {
		width: 100%;
		border-collapse: collapse; /* Cleaner lines */
	}

	/* Style the table header */
	.transaction-table th {
		text-align: left;
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-muted);
		padding: 8px 6px;
		border-bottom: 1px solid var(--background-modifier-border);
		/* text-transform: capitalize; */ /* Keep default case from BQL for now */
	}

	/* Style the table cells */
	.transaction-table td {
		padding: 6px;
		border-bottom: 1px solid var(--background-secondary);
	}

	/* Add "zebra striping" for readability */
	.transaction-table tbody tr:nth-child(even) {
		background-color: var(--background-secondary);
	}

	/* Utility class to align text to the right */
	.align-right {
		text-align: right;
		font-family: var(--font-monospace); /* Monospace font for numbers */
	}
</style>