<script lang="ts">
	// --- REMOVED onMount, parseCsv, queries, plugin imports ---
	import { writable, type Writable } from 'svelte/store';
	import type { BalanceSheetController, BalanceSheetState, AccountItem } from '../../../controllers/BalanceSheetController';

	// --- Receive the controller ---
	export let controller: BalanceSheetController;

	// --- Set up a placeholder and subscribe to the store ---
	const placeholderState: Writable<BalanceSheetState> = writable({
		isLoading: true, error: null, assets: [], liabilities: [], equity: [],
		totalAssets: 0, totalLiabilities: 0, totalEquity: 0, currency: 'INR',
		hasUnconvertedCommodities: false, unconvertedWarning: null, valuationMethod: 'convert'
	});
	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;
	// ------------------------------------------------------

	// Helper function to generate indentation based on account level
	function getIndentation(level: number): string {
		return '\u00A0'.repeat(level * 4); // Non-breaking spaces for proper indentation
	}

	// Helper function to get CSS class based on account level
	function getAccountClass(item: AccountItem): string {
		const baseClass = 'account-row';
		const levelClass = `level-${item.level}`;
		const typeClass = item.isCategory ? 'category' : 'leaf';
		return `${baseClass} ${levelClass} ${typeClass}`;
	}

	// Helper function to determine if other currencies column should be visible
	function hasOtherCurrencies(accounts: AccountItem[]): boolean {
		return accounts.some(item => item.otherCurrencies && item.otherCurrencies.trim() !== '');
	}

	// Always show other currencies column for all valuation methods if any section has them
	$: showOtherCurrenciesColumn = state.assets && state.liabilities && state.equity && 
		(hasOtherCurrencies(state.assets) || hasOtherCurrencies(state.liabilities) || hasOtherCurrencies(state.equity));

	// Handle valuation method change
	async function handleValuationMethodChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const method = target.value as 'convert' | 'cost' | 'units';
		if (controller) {
			await controller.setValuationMethod(method);
		}
	}

	// Get display label for the current valuation method
	function getValuationMethodLabel(method: string): string {
		switch (method) {
			case 'convert': return 'Market Value';
			case 'cost': return 'At Cost';
			case 'units': return 'Units';
			default: return 'Market Value';
		}
	}

	// Collapsible hierarchy state
	let collapsedAccounts = new Set<string>();

	function toggleCollapse(account: string, event?: MouseEvent) {
		if (event) {
			event.stopPropagation();
		}
		console.log('Toggle collapse for:', account, 'Currently collapsed?', collapsedAccounts.has(account));
		const newSet = new Set(collapsedAccounts);
		if (newSet.has(account)) {
			newSet.delete(account);
		} else {
			newSet.add(account);
		}
		collapsedAccounts = newSet; // Trigger reactivity with new Set instance
		console.log('New collapsed state:', Array.from(collapsedAccounts));
	}

	function isCollapsed(account: string): boolean {
		return collapsedAccounts.has(account);
	}

	function shouldShowRow(item: AccountItem, collapsed: Set<string>): boolean {
		// Always show root level items
		if (item.level === 0) return true;
		
		// Check if any parent is collapsed
		const accountParts = item.account.split(':');
		for (let i = 1; i < accountParts.length; i++) {
			const parentPath = accountParts.slice(0, i).join(':');
			if (collapsed.has(parentPath)) {
				return false;
			}
		}
		return true;
	}

	// Create reactive filtered lists that depend on collapsedAccounts
	$: visibleAssets = state.assets ? state.assets.filter(item => shouldShowRow(item, collapsedAccounts)) : [];
	$: visibleLiabilities = state.liabilities ? state.liabilities.filter(item => shouldShowRow(item, collapsedAccounts)) : [];
	$: visibleEquity = state.equity ? state.equity.filter(item => shouldShowRow(item, collapsedAccounts)) : [];
</script>

<div class="balance-sheet-container">
	<div class="balance-sheet-header">
		<h2>Balance Sheet</h2>
		<div class="valuation-method-selector">
			<label for="valuation-method">Valuation:</label>
			<select 
				id="valuation-method" 
				value={state.valuationMethod || 'convert'} 
				on:change={handleValuationMethodChange}
			>
				<option value="convert">Market Value (Convert to {state.currency})</option>
				<option value="cost">At Cost</option>
				<option value="units">Units</option>
			</select>
		</div>
	</div>

	{#if state.isLoading}
		<p>Loading balance sheet...</p>
	{:else if state.error}
		<p class="error-message">{state.error}</p>
	{:else}
		<!-- Multi-currency warning -->
		{#if state.hasUnconvertedCommodities && state.unconvertedWarning}
			<div class="warning-banner">
				<span class="warning-icon">⚠️</span>
				<span class="warning-text">{state.unconvertedWarning}</span>
			</div>
		{/if}

		<div class="balance-sheet-grid">
			<div class="column">
				<h4>Assets</h4>
				<table class="beancount-table">
					<thead>
						<tr class="header-row">
							<th class="account-header">Account</th>
							<th class="amount-header">{state.currency}</th>
							{#if showOtherCurrenciesColumn}
								<th class="other-currencies-header">Other Currencies</th>
							{/if}
						</tr>
					</thead>
				<tbody>
					{#each visibleAssets as item}
						<tr class={getAccountClass(item)}>
							<td class="account-name" 
								on:click={(e) => item.isCategory && toggleCollapse(item.account, e)} 
								style="cursor: {item.isCategory ? 'pointer' : 'default'};">
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell">
										{item.otherCurrencies || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="column">
				<h4>Liabilities</h4>
				<table class="beancount-table">
					<thead>
						<tr class="header-row">
							<th class="account-header">Account</th>
							<th class="amount-header">{state.currency}</th>
							{#if showOtherCurrenciesColumn}
								<th class="other-currencies-header">Other Currencies</th>
							{/if}
						</tr>
					</thead>
				<tbody>
					{#each visibleLiabilities as item}
						<tr class={getAccountClass(item)}>
							<td class="account-name" 
								on:click={(e) => item.isCategory && toggleCollapse(item.account, e)} 
								style="cursor: {item.isCategory ? 'pointer' : 'default'};">
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell">
										{item.otherCurrencies || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="column">
				<h4 class="section-spacer">Equity</h4>
				<table class="beancount-table">
					<thead>
						<tr class="header-row">
							<th class="account-header">Account</th>
							<th class="amount-header">{state.currency}</th>
							{#if showOtherCurrenciesColumn}
								<th class="other-currencies-header">Other Currencies</th>
							{/if}
						</tr>
					</thead>
				<tbody>
					{#each visibleEquity as item}
						<tr class={getAccountClass(item)}>
							<td class="account-name" 
								on:click={(e) => item.isCategory && toggleCollapse(item.account, e)} 
								style="cursor: {item.isCategory ? 'pointer' : 'default'};">
								{#if item.isCategory}
									<span class="collapse-icon">{isCollapsed(item.account) ? '▶' : '▼'}</span>
								{/if}
								{getIndentation(item.level)}{item.displayName}
							</td>
								<td class="align-right amount-cell" class:category-amount={item.isCategory}>
									{item.amount}
								</td>
								{#if showOtherCurrenciesColumn}
									<td class="align-right other-currencies-cell">
										{item.otherCurrencies || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.balance-sheet-container { 
		padding: var(--size-4-4); 
		width: 100%;
		overflow-x: auto;
	}

	/* Header with valuation method selector */
	.balance-sheet-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-6);
		flex-wrap: wrap;
		gap: var(--size-4-4);
	}

	.balance-sheet-header h2 {
		margin: 0;
		color: var(--text-normal);
	}

	.valuation-method-selector {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.valuation-method-selector label {
		font-size: 0.9em;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.valuation-method-selector select {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: var(--size-4-1) var(--size-4-2);
		color: var(--text-normal);
		font-size: 0.9em;
		min-width: 200px;
	}

	.valuation-method-selector select:focus {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.column {
		min-width: 0; /* Allow columns to shrink */
		overflow-x: auto;
	}

	/* Multi-currency warning banner */
	.warning-banner {
		background-color: var(--background-modifier-form-field);
		border: 1px solid var(--color-orange);
		border-radius: var(--radius-s);
		padding: var(--size-4-2) var(--size-4-3);
		margin-bottom: var(--size-4-4);
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.warning-icon {
		font-size: 1.1em;
		color: var(--color-orange);
	}

	.warning-text {
		color: var(--text-muted);
		font-size: 0.9em;
		line-height: 1.4;
	}

	.balance-sheet-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-8);
		align-items: start;
		overflow-x: auto; /* Allow horizontal scroll if needed */
	}

	@media (max-width: 1200px) {
		.balance-sheet-grid {
			grid-template-columns: 1fr;
			gap: var(--size-4-6);
		}

		.balance-sheet-header {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--size-4-3);
		}

		.valuation-method-selector {
			width: 100%;
			justify-content: space-between;
		}

		.valuation-method-selector select {
			min-width: 180px;
		}
	}
	
	.column h4 { 
		margin-top: 0; 
		color: var(--text-normal);
		border-bottom: 1px solid var(--background-modifier-border);
		padding-bottom: var(--size-4-2);
	}
	
	.section-spacer { 
		margin-top: var(--size-4-6); 
	}
	
	.grand-total { 
		margin-top: var(--size-4-4); 
	}
	
	.beancount-table { 
		width: 100%; 
		border-collapse: collapse;
		table-layout: fixed; /* Fixed layout for better control */
		min-width: 400px; /* Minimum width to prevent cramping */
	}

	/* Table headers */
	.beancount-table thead {
		background-color: var(--background-modifier-form-field);
		border-bottom: 2px solid var(--background-modifier-border);
	}

	.header-row th {
		padding: var(--size-4-3);
		font-weight: 600;
		color: var(--text-normal);
		text-align: left;
		border-bottom: 2px solid var(--background-modifier-border);
		word-wrap: break-word;
	}

	.account-header {
		width: 40%;
		min-width: 140px;
	}

	.amount-header {
		width: 25%;
		text-align: right !important;
		min-width: 100px;
	}

	.other-currencies-header {
		width: 35%;
		text-align: right !important;
		min-width: 140px;
		color: var(--text-muted);
	}
	
	.beancount-table td, 
	.beancount-table th { 
		padding: var(--size-4-2) var(--size-4-3); 
		border-bottom: 1px solid var(--background-secondary); 
		vertical-align: top; /* Changed from middle to top for multi-line content */
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.account-name {
		font-family: var(--font-interface);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
		width: 40%;
	}

	.collapse-icon {
		display: inline-block;
		width: 12px;
		margin-right: 4px;
		font-size: 0.8em;
		color: var(--text-muted);
		user-select: none;
	}

	.amount-cell {
		font-family: var(--font-monospace);
		white-space: nowrap;
		width: 25%;
		text-align: right;
	}

	.other-currencies-cell {
		font-family: var(--font-monospace);
		color: var(--text-muted);
		font-size: 0.9em;
		width: 35%;
		text-align: right;
		/* Allow text wrapping for multi-currency content */
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.4;
		max-width: 150px;
		padding: var(--size-4-1) var(--size-4-2);
		vertical-align: top; /* Align to top for multi-line content */
	}
	
	/* Hierarchical account styling */
	.account-row.level-0 {
		background-color: var(--background-primary);
		font-weight: 600;
	}

	.account-row.level-1 {
		background-color: var(--background-secondary-alt);
		font-weight: 500;
	}

	.account-row.level-2 {
		background-color: var(--background-primary);
		font-weight: normal;
	}

	.account-row.level-3,
	.account-row.level-4,
	.account-row.level-5 {
		background-color: var(--background-primary);
		font-weight: normal;
		opacity: 0.9;
	}

	/* Category vs leaf account styling */
	.account-row.category {
		border-left: 3px solid var(--interactive-accent);
	}

	.account-row.category .account-name {
		font-weight: 600;
		color: var(--text-normal);
	}

	.account-row.category .category-amount {
		font-weight: 600;
		color: var(--interactive-accent);
	}

	.account-row.leaf {
		border-left: 1px solid var(--background-modifier-border);
	}

	.account-row.leaf .account-name {
		color: var(--text-muted);
	}

	/* Hover effects */
	.account-row:hover {
		background-color: var(--background-modifier-hover) !important;
	}

	/* Total rows styling */
	.beancount-table tbody tr:nth-child(even):not(.account-row) { 
		background-color: var(--background-secondary-alt); 
	}
	
	.beancount-table tfoot tr, 
	.total-row { 
		border-top: 2px solid var(--background-modifier-border); 
		font-weight: 600; 
		background-color: var(--background-modifier-form-field) !important;
	}
	
	.align-right { 
		text-align: right; 
		font-family: var(--font-monospace); 
	}
	
	.error-message { 
		color: var(--text-error); 
		background-color: var(--background-modifier-error);
		padding: var(--size-4-3);
		border-radius: var(--radius-s);
		border: 1px solid var(--text-error);
	}

	/* Responsive design */
	@media (max-width: 1200px) {
		.balance-sheet-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.account-name {
			max-width: 100px;
		}
		
		.beancount-table td,
		.beancount-table th {
			padding: var(--size-4-1) var(--size-4-2);
			font-size: 0.9em;
		}

		.other-currencies-cell {
			font-size: 0.8em;
			max-width: 120px;
			line-height: 1.3;
			white-space: pre-wrap;
			word-break: break-word;
		}

		/* Adjust column widths for mobile */
		.account-header {
			width: 35%;
		}

		.amount-header {
			width: 30%;
		}

		.other-currencies-header {
			width: 35%;
		}

		.beancount-table {
			min-width: 350px;
		}
	}

	@media (max-width: 480px) {
		.account-header {
			width: 45%;
		}

		.amount-header {
			width: 25%;
		}

		.other-currencies-header {
			width: 30%;
		}

		.other-currencies-cell {
			font-size: 0.75em;
			max-width: 100px;
			line-height: 1.2;
			white-space: pre-wrap;
			word-break: break-word;
		}

		.beancount-table {
			min-width: 320px;
		}

		/* Allow horizontal scroll for very small screens */
		.column {
			overflow-x: auto;
		}
	}
</style>