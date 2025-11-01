<script lang="ts">
	// --- REMOVED onMount, parseCsv, queries, plugin imports ---
	import { writable, type Writable } from 'svelte/store';
	import type { BalanceSheetController, BalanceSheetState } from '../../controllers/BalanceSheetController';

	// --- Receive the controller ---
	export let controller: BalanceSheetController;

	// --- Set up a placeholder and subscribe to the store ---
	const placeholderState: Writable<BalanceSheetState> = writable({
		isLoading: true, error: null, assets: [], liabilities: [], equity: [],
		totalAssets: 0, totalLiabilities: 0, totalEquity: 0, totalLiabEquity: 0, currency: 'USD'
	});
	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;
	// ------------------------------------------------------
</script>

<div class="balance-sheet-container">
	{#if state.isLoading}
		<p>Loading balance sheet...</p>
	{:else if state.error}
		<p class="error-message">{state.error}</p>
	{:else}
		<div class="balance-sheet-grid">
			<div class="column">
				<h4>Assets</h4>
				<table class="beancount-table">
					<tbody>
						{#each state.assets as [name, amount]}
							<tr>
								<td>{name}</td>
								<td class="align-right">{amount}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>Total Assets</strong></td>
							<td class="align-right"><strong>{state.totalAssets.toFixed(2)} {state.currency}</strong></td>
						</tr>
					</tfoot>
				</table>
			</div>

			<div class="column">
				<h4>Liabilities</h4>
				<table class="beancount-table">
					<tbody>
						{#each state.liabilities as [name, amount]}
							<tr>
								<td>{name}</td>
								<td class="align-right">{amount}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>Total Liabilities</strong></td>
							<td class="align-right"><strong>{state.totalLiabilities.toFixed(2)} {state.currency}</strong></td>
						</tr>
					</tfoot>
				</table>

				<h4 class="section-spacer">Equity</h4>
				<table class="beancount-table">
					<tbody>
						{#each state.equity as [name, amount]}
							<tr>
								<td>{name}</td>
								<td class="align-right">{amount}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>Total Equity</strong></td>
							<td class="align-right"><strong>{state.totalEquity.toFixed(2)} {state.currency}</strong></td>
						</tr>
					</tfoot>
				</table>

				<table class="beancount-table grand-total">
					<tfoot>
						<tr>
							<td><strong>Total Liabilities + Equity</strong></td>
							<td class="align-right"><strong>{state.totalLiabEquity.toFixed(2)} {state.currency}</strong></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.balance-sheet-container { padding: var(--size-4-4); }
	.balance-sheet-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--size-4-8);
	}
	.column h4 { margin-top: 0; }
	.section-spacer { margin-top: var(--size-4-6); }
	.grand-total { margin-top: var(--size-4-4); }
	.beancount-table { width: 100%; border-collapse: collapse; }
	.beancount-table td { padding: 6px; border-bottom: 1px solid var(--background-secondary); }
	.beancount-table tbody tr:nth-child(even) { background-color: var(--background-secondary-alt); }
	.beancount-table tfoot tr { border-top: 2px solid var(--background-modifier-border); font-weight: 600; }
	.align-right { text-align: right; font-family: var(--font-monospace); }
	.error-message { color: var(--text-error); }
</style>