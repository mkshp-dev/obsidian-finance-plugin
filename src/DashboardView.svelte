<script lang="ts">
	import { onMount } from 'svelte';
	import { parse } from 'csv-parse/sync';
	import HierarchicalDropdown from './HierarchicalDropdown.svelte';
	import { buildAccountTree, debounce } from './utils'; // Removed runQuery
	export let runQuery: (query: string) => Promise<string>;

	// Component State
	let allAccounts: string[] = [];
	let accountTree: AccountNode[] = [];
	let selectedAccount: string | null = null;
	let transactions: string[][] = []; // Original fetched transactions
	let sortedTransactions: string[][] = []; // Transactions to display
	let isLoadingAccounts = true;
	let isLoadingTransactions = false;
	let error: string | null = null;
	let startDate: string | null = null;
	let endDate: string | null = null;
	let payeeFilter: string = '';
	let debouncedPayeeFilter: string = ''; // Add this line
	let allTags: string[] = []; // Add this near other state variables
	let tagFilter: string = ''; // Input value <<--- HERE IT IS
	let debouncedTagFilter: string = ''; // Debounced value for query
	// -----------------------------
	// Sorting State
	type SortColumn = 'date' | 'payee' | 'narration' | 'amount';
	let sortColumn: SortColumn = 'date';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Tree Parsing Utility
	interface AccountNode { name: string; fullName: string | null; children: AccountNode[]; }

// --- Add this Debounced update function ---
	const updateDebouncedPayee = debounce((value: string) => {
		debouncedPayeeFilter = value;
	}, 1000); // Wait 1000ms after user stops typing

	const updateDebouncedTag = debounce((value: string) => {
		debouncedTagFilter = value;
	}, 1000); // Wait 1000ms after user stops typing

	onMount(async () => {
		console.log("DashboardView: onMount started");
		isLoadingAccounts = true; error = null;
		try {
			console.log("DashboardView: Fetching accounts and tags...");
			// --- FETCH BOTH ACCOUNTS AND TAGS ---
			const [accountResult, tagResult] = await Promise.all([
				runQuery('SELECT account'),
				runQuery('SELECT tags') // Query for unique tags
			]);
			// ------------------------------------

			// --- Process Accounts (unchanged) ---
			console.log("DashboardView: Processing accounts...");
			const cleanAccountStdout = accountResult.replace(/\r/g, "").trim();
			const accountRecords: string[][] = parse(cleanAccountStdout, { columns: false, skip_empty_lines: true });
			const firstAccountRowIsHeader = accountRecords[0]?.[0]?.toLowerCase() === 'account';
			const accountDataRows = firstAccountRowIsHeader ? accountRecords.slice(1) : accountRecords;
			allAccounts = [...new Set(accountDataRows.map(row => row?.[0]).filter(Boolean))];
			const builtTree = buildAccountTree(allAccounts);
			const allNode: AccountNode = { name: 'All Accounts', fullName: null, children: [] };
			accountTree = [allNode, ...builtTree];
			selectedAccount = null;
			console.log("DashboardView: Account tree built.");
			// ----------------------------------

			// --- Process Tags ---
			console.log("DashboardView: Processing tags...");
			const cleanTagStdout = tagResult.replace(/\r/g, "").trim();
			// Tags might be comma-separated if multiple on one txn, or single column
			const tagRecords: string[][] = parse(cleanTagStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
			const firstTagRowIsHeader = tagRecords[0]?.[0]?.toLowerCase() === 'tags';
			const tagDataRows = firstTagRowIsHeader ? tagRecords.slice(1) : tagRecords;

            // Flatten, split comma-separated, trim, filter empty, create Set, spread to array
			allTags = [...new Set(
			    tagDataRows.flat() // Flatten array of arrays
			        .flatMap(tagStr => tagStr ? tagStr.split(',') : []) // Split comma-separated tags
			        .map(tag => tag.trim()) // Trim whitespace
			        .filter(tag => tag !== '') // Remove empty strings
            )];
			console.log("DashboardView: Tags processed:", allTags);
			// --------------------

		} catch (e) {
			console.error("DashboardView: ERROR in onMount:", e);
			error = `Failed to load accounts or tags: ${e.message}`;
		} finally {
			isLoadingAccounts = false;
			console.log("DashboardView: onMount finished.");
		}
	});
	async function fetchTransactions(account: string | null, start: string | null, end: string | null, payee: string | null, tag: string | null) {
		if (account === undefined) return;
		isLoadingTransactions = true; transactions = []; error = null;
		try {
			let query = '';
			const selectPart = `SELECT date, payee, narration, position`;
			const whereClauses: string[] = [];
			const orderByPart = `ORDER BY date DESC`;

			if (account !== null) { whereClauses.push(`account ~ '^${account}'`); }
			if (start) { whereClauses.push(`date >= ${start}`); }
			if (end) { whereClauses.push(`date <= ${end}`); }
			if (payee && payee.trim() !== '') { whereClauses.push(`payee ~ '${payee.replace(/'/g, "''")}'`); }
			if (tag && tag.trim() !== '') { // <-- Use 'tag' parameter
				// Remove leading '#' if present, trim whitespace, escape quotes
				const tagName = tag.replace(/^#/, '').trim().replace(/'/g, "''"); // <-- Use 'tag' parameter
				// Only add the clause if the tag name isn't empty after trimming
				if (tagName) {
					whereClauses.push(`'${tagName}' IN tags`); // Use BQL's HAS_TAG function
				}
			}
			if (whereClauses.length > 0) { query = `${selectPart} WHERE ${whereClauses.join(' AND ')} ${orderByPart}`; }
			else { query = `${selectPart} ${orderByPart}`; }

			// console.log("DashboardView: Running Query:", query);
			const result = await runQuery(query);
			// console.log("DashboardView: Raw Query Result:", result);

			const cleanStdout = result.replace(/\r/g, "").trim();
			// console.log("DashboardView: Cleaned Query Result:", cleanStdout);

			const records: string[][] = parse(cleanStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
			// console.log("DashboardView: Parsed Records:", records);

			const defaultHeaders = ['date', 'payee', 'narration', 'position'];
			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('date');
			const dataRows = firstRowIsHeader ? records.slice(1) : records;

			transactions = dataRows.map(row => {
				const completeRow = [...row];
				while(completeRow.length < defaultHeaders.length) completeRow.push('');
				return completeRow;
			});
			// console.log("DashboardView: 'transactions' state updated:", transactions);

			sortTransactions(); // Explicitly trigger sort

		} catch (e) {
			const targetAccount = account ?? 'All Accounts';
			// console.error(`Failed to fetch transactions for ${targetAccount}:`, e);
			error = `Failed to load transactions: ${e.message}`;
		} finally {
			isLoadingTransactions = false;
			// console.log("DashboardView: fetchTransactions finished.");
		}
	}

	// --- COMPLETE sortTransactions FUNCTION ---
	function sortTransactions() {
		// console.log("DashboardView: sortTransactions running..."); // Debug Log 3
		const headers = ['date', 'payee', 'narration', 'amount'];
		const columnIndex = headers.indexOf(sortColumn);
		if (columnIndex === -1) {
			// console.log("DashboardView: sortTransactions - Invalid column index.");
			return;
		}

		// Use the raw 'transactions' array for sorting
		sortedTransactions = [...transactions].sort((a, b) => {
			const valA = a.length > columnIndex ? a[columnIndex] : '';
			const valB = b.length > columnIndex ? b[columnIndex] : '';

			if (sortColumn === 'amount') {
				const numRegex = /(-?[\d,]+(?:\.\d+)?)/;
				const matchA = valA.match(numRegex);
				const matchB = valB.match(numRegex);
				const numA = matchA ? parseFloat(matchA[1].replace(/,/g, '')) : 0;
				const numB = matchB ? parseFloat(matchB[1].replace(/,/g, '')) : 0;
				return sortDirection === 'asc' ? numA - numB : numB - numA;
			}

			// Default string comparison
			const comparison = valA.toLowerCase().localeCompare(valB.toLowerCase());
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		// console.log("DashboardView: 'sortedTransactions' state updated:", sortedTransactions); // Debug Log 4
	}
	// ----------------------------------------

	// --- COMPLETE handleSort FUNCTION ---
	function handleSort(column: SortColumn) {
		if (sortColumn === column) {
			// Toggle direction if clicking the same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// Default to descending for new column
			sortColumn = column;
			sortDirection = 'desc';
		}
		// Sorting happens automatically via reactive statement below
	}
	// ---------------------------------
// src/DashboardView.svelte -> Replace this block at the end of <script>

	// --- CORRECTED REACTIVE LOGIC ---
// Reactive statements

// Reactive statements

// Reactive statements

	// 1. Update debounced value whenever payeeFilter (the input) changes
	$: updateDebouncedPayee(payeeFilter);
	$: updateDebouncedTag(tagFilter);

	// 2. Create a combined key representing all filter states
	$: filterKey = `${selectedAccount ?? 'null'}-${startDate ?? 'null'}-${endDate ?? 'null'}-${debouncedPayeeFilter}-${debouncedTagFilter}`;

	// 3. SINGLE FETCH TRIGGER based on the combined key changing.
	//    The check for selectedAccount !== undefined prevents running before onMount.
	$: if (selectedAccount !== undefined && filterKey) { // <-- ADD filterKey check here
		console.log(`FETCH TRIGGERED by key change: ${filterKey}`);
		fetchTransactions(selectedAccount, startDate, endDate, debouncedPayeeFilter, debouncedTagFilter); // <-- Add debouncedTagFilter here
	}

	// 4. SORT TRIGGERS remain separate
	$: if (transactions) { sortTransactions(); }
	$: if (sortColumn || sortDirection) { sortTransactions(); }
	// --------------------------------

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