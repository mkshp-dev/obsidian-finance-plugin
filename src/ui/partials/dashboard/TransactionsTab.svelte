<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { AccountNode } from '../../../models/account';
	import { debounce } from '../../../utils/index';
	import type { TransactionController } from '../../../controllers/TransactionController'; // Import controller type
	import SkeletonLoader from '../../common/SkeletonLoader.svelte';
	import ErrorBanner from '../../common/ErrorBanner.svelte';
	import EmptyState from '../../common/EmptyState.svelte';
	import { nativeDatePicker } from '../../actions/nativeDatePicker';

	import { resolveNavTab, type NavRequest } from '../../../types/navigation';

	// --- PROPS ---
	// Receive the controller
	export let controller: TransactionController;
	export let navigate: ((req: NavRequest) => void) | null = null;
	// --- REMOVED all other data props ---

	const dispatch = createEventDispatcher();

	function handlePayeeClick(payee: string, event?: MouseEvent) {
		if (!payee) return;
		const req: NavRequest = { tab: resolveNavTab(event), filters: { payee } };
		if (navigate) {
			navigate(req);
		} else {
			dispatch('navigate', req);
		}
	}

	// --- Get the store from the controller ---
	const stateStore = controller.state;
	// --- Auto-subscribe to the store's value ---
	$: state = $stateStore;
	// ------------------------------------------

	// --- LOCAL UI STATE (Filters) ---
	let selectedAccount: string = ''; // Changed to string for direct input
	let startDate: string | null = null;
	let endDate: string | null = null;
	let payeeFilter: string = '';
	let debouncedPayeeFilter: string = '';
	let tagFilter: string = '';
	let debouncedTagFilter: string = '';

	// Reactive statement to sync pendingFilters if set via controller
	$: if (state && state.pendingFilters) {
		const pf = state.pendingFilters;
		if (pf.account !== undefined) selectedAccount = pf.account || '';
		if (pf.startDate !== undefined) startDate = pf.startDate || null;
		if (pf.endDate !== undefined) endDate = pf.endDate || null;
		if (pf.payee !== undefined) {
			payeeFilter = pf.payee || '';
			debouncedPayeeFilter = pf.payee || '';
		}
		if (pf.tag !== undefined) {
			tagFilter = pf.tag || '';
			debouncedTagFilter = pf.tag || '';
		}
		controller.clearPendingFilters();
	}
	
	// --- LOCAL UI STATE (Sorting) ---
	type SortColumn = 'date' | 'payee' | 'narration' | 'amount' | 'balance';
	let sortColumn: SortColumn = 'date';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let sortedTransactions: string[][] = [];

	// --- Debounce handlers - Optimized for better UX ---
	const updateDebouncedPayee = debounce((value: string) => { debouncedPayeeFilter = value; }, 300);
	const updateDebouncedTag = debounce((value: string) => { debouncedTagFilter = value; }, 300);

	function handleRefresh() {
		controller.refresh();
	}

	function handleClear() {
		selectedAccount = '';
		startDate = null;
		endDate = null;
		payeeFilter = '';
		debouncedPayeeFilter = '';
		tagFilter = '';
		debouncedTagFilter = '';
	}

	// --- REMOVED onMount data fetching ---

	function parseAmountNum(str: string): number {
		if (!str) return 0;
		const match = str.match(/(-?[\d,]+(?:\.\d+)?)/);
		return match ? parseFloat(match[1].replace(/,/g, '')) || 0 : 0;
	}

	// --- Sorting logic (remains local) ---
	function sortTransactions(transactions: string[][]) {
		const headers = ['date', 'payee', 'narration', 'amount', 'balance']; // Added balance column
		const columnIndex = headers.indexOf(sortColumn);
		if (columnIndex === -1) {
			sortedTransactions = [...transactions]; return;
		}
		sortedTransactions = [...transactions].sort((a, b) => {
			const valA = a.length > columnIndex ? a[columnIndex] : '';
			const valB = b.length > columnIndex ? b[columnIndex] : '';
			if (sortColumn === 'amount') {
				const numA = parseAmountNum(valA);
				const numB = parseAmountNum(valB);
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
		account: selectedAccount.trim() || null, // Convert empty string to null
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
				<label for="account-input">Account:</label>
				<input 
					type="text" 
					id="account-input" 
					bind:value={selectedAccount} 
					placeholder="Type account name..." 
					disabled={state.isLoading || state.isLoadingFilters}
					list="account-list"
				/>
				<datalist id="account-list">
					{#each state.allAccounts as account}
						<option value={account}>{account}</option>
					{/each}
				</datalist>
			</div>
			<div class="date-range">
				<label for="start-date">From:</label>
				<input type="date" id="start-date" bind:value={startDate} disabled={state.isLoading} use:nativeDatePicker />
				<label for="end-date">To:</label>
				<input type="date" id="end-date" bind:value={endDate} disabled={state.isLoading} use:nativeDatePicker />
			</div>
			<div>
				<label for="payee-filter">Payee:</label>
				<input type="text" id="payee-filter" bind:value={payeeFilter} placeholder="Filter by payee..." disabled={state.isLoading} />
			</div>
			<div>
				<label for="tag-filter">Tag:</label>
				<input type="text" id="tag-filter" bind:value={tagFilter} placeholder="Filter by tag..." disabled={state.isLoading} list="beancount-tags" />
			</div>
			<div>
				<button class="btn" on:click={handleClear} disabled={state.isLoading || state.isLoadingFilters}>Clear</button>
				<button class="btn btn-primary" on:click={handleRefresh} disabled={state.isLoading || state.isLoadingFilters}>Refresh</button>
			</div>
		</div>

		{#if state.isLoading}
			<SkeletonLoader type="table" />
		{:else if state.error}
			<ErrorBanner message={state.error} on:retry={handleRefresh} />
		{:else if sortedTransactions.length === 0}
			<EmptyState icon="💸" title="No Transactions Found" description="Try selecting a different account or adjusting the date range and filters." />
		{:else}
			<table class="transaction-table sortable">
				<colgroup>
					<col style="width: 11%;" />
					<col style="width: 16%;" />
					<col style="width: 33%;" />
					<col style="width: 20%;" />
					<col style="width: 20%;" />
				</colgroup>
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
						<th on:click={() => handleSort('balance')} class:active={sortColumn === 'balance'} title={state.currentFilters.account ? '' : 'Select an account to see its running balance'}>
							Balance {sortColumn === 'balance' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedTransactions as [date, payee, narration, position, balance]}
						<tr>
							<td>{date}</td>
							<td>
								{#if payee}
									<button class="payee-link" type="button" on:click={(e) => handlePayeeClick(payee, e)} title="Click: filter Transactions by payee '{payee}' · Ctrl/Cmd+click: view in Journal">
										{payee}
									</button>
								{:else}
									<span class="no-payee">&nbsp;</span>
								{/if}
							</td>
							<td>{narration}</td>
							<td class="align-right">{position}</td>
							<td class="align-right">{balance || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
</div>

<style>
	.account-transactions-view { padding: 0; }
	.controls { margin-bottom: var(--size-4-3); display: flex; flex-wrap: wrap; align-items: center; gap: var(--size-4-2); }
	.controls > div { display: flex; align-items: center; gap: var(--size-4-1); }
	.controls label { font-weight: 500; margin-right: var(--size-4-1); white-space: nowrap; font-size: var(--font-ui-small); }
	.controls input[type="date"], .controls input[type="text"] {
		padding: var(--size-4-1) var(--size-4-2);
		height: 28px;
		font-size: var(--font-ui-small);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background-color: var(--background-modifier-form-field);
		color: var(--text-normal);
	}
	.controls input[type="date"] {
		padding: 2px var(--size-4-2);
	}
	.controls input[type="text"] { min-width: 150px; }
	.transaction-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
	.transaction-table td { word-break: break-word; }
	.transaction-table th { text-align: left; font-size: var(--font-ui-small); font-weight: 600; color: var(--text-muted); padding: 8px 6px; border-bottom: 1px solid var(--background-modifier-border); }
	.transaction-table th.active { color: var(--text-accent); }
	.transaction-table th { cursor: pointer; user-select: none; }
	.transaction-table th:hover { color: var(--text-normal); }
	.transaction-table td { padding: 6px; border-bottom: 1px solid var(--background-secondary); }
	.transaction-table tbody tr:nth-child(even) { background-color: var(--background-secondary-alt); }
	.payee-link {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		outline: none !important;
		padding: 0 !important;
		margin: 0 !important;
		height: auto !important;
		font: inherit;
		color: var(--text-normal);
		cursor: pointer;
		text-align: left;
		transition: color 0.15s ease;
	}
	.payee-link:hover {
		color: var(--interactive-accent);
		text-decoration: underline;
		background: transparent !important;
		box-shadow: none !important;
	}
	.align-right { text-align: right; font-family: var(--font-monospace); }
	.error-message { color: var(--text-error); }
	.btn {
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background: var(--interactive-normal);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn:hover {
		background: var(--interactive-hover);
	}
	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}
	.btn-primary:hover {
		background: var(--interactive-accent-hover);
	}
</style>
