<script lang="ts">
	import { onMount } from 'svelte';
	import { parse as parseCsv } from 'csv-parse/sync';
	import type BeancountPlugin from '../../main'; // Adjust path as needed
	import * as queries from '../../queries'; // Adjust path as needed

	export let plugin: BeancountPlugin; // Pass the plugin instance

	let isLoading = true;
	let error: string | null = null;
	let assets: [string, string][] = [];
	let liabilities: [string, string][] = [];
	let equity: [string, string][] = [];
	let totalAssets = 0;
	let totalLiabilities = 0;
	let totalEquity = 0;
	let totalLiabEquity = 0;
	let currency = 'USD';

	onMount(async () => {
		isLoading = true; error = null;
		try {
			const reportingCurrency = plugin.settings.reportingCurrency;
			if (!reportingCurrency) throw new Error("Reporting Currency not set.");

			const query = queries.getBalanceSheetQuery(reportingCurrency);
			const result = await plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true });

			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('account');
			const rows = firstRowIsHeader ? records.slice(1) : records;

			let tempAssets: [string, string][] = [];
			let tempLiab: [string, string][] = [];
			let tempEquity: [string, string][] = [];
			let runningTotalAssets = 0;
			let runningTotalLiab = 0;
			let runningTotalEquity = 0;

			for (const row of rows) {
				if (row.length < 2) continue;
				const [account, amountStr] = row;
				const amountNum = parseFloat(amountStr.split(' ')[0].replace(/,/g, '')) || 0;
				currency = amountStr.split(' ')[1] || reportingCurrency; // Grab currency

				const lastColonIndex = account.lastIndexOf(':');
				const trimmedName = lastColonIndex > -1 ? account.substring(lastColonIndex + 1) : account;
				
				const formattedRow: [string, string] = [trimmedName, amountStr];

				if (account.startsWith('Assets')) {
					tempAssets.push(formattedRow);
					runningTotalAssets += amountNum;
				} else if (account.startsWith('Liabilities')) {
					tempLiab.push(formattedRow);
					runningTotalLiab += amountNum;
				} else if (account.startsWith('Equity')) {
					tempEquity.push(formattedRow);
					runningTotalEquity += amountNum;
				}
			}

			// Set all state at the end
			assets = tempAssets;
			liabilities = tempLiab;
			equity = tempEquity;
			totalAssets = runningTotalAssets;
			totalLiabilities = runningTotalLiab;
			totalEquity = runningTotalEquity;
			// Per accounting equation, Liab + Equity should balance Assets
			totalLiabEquity = runningTotalLiab + runningTotalEquity;

		} catch (e) {
			console.error("Error loading balance sheet:", e);
			error = e.message;
		} finally {
			isLoading = false;
		}
	});

</script>

<div class="balance-sheet-container">
	{#if isLoading}
		<p>Loading balance sheet...</p>
	{:else if error}
		<p class="error-message">{error}</p>
	{:else}
		<div class="balance-sheet-grid">
			<div class="column">
				<h4>Assets</h4>
				<table class="beancount-table">
					<tbody>
						{#each assets as [name, amount]}
							<tr>
								<td>{name}</td>
								<td class="align-right">{amount}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>Total Assets</strong></td>
							<td class="align-right"><strong>{totalAssets.toFixed(2)} {currency}</strong></td>
						</tr>
					</tfoot>
				</table>
			</div>

			<div class="column">
				<h4>Liabilities</h4>
				<table class="beancount-table">
					<tbody>
						{#each liabilities as [name, amount]}
							<tr>
								<td>{name}</td>
								<td class="align-right">{amount}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>Total Liabilities</strong></td>
							<td class="align-right"><strong>{totalLiabilities.toFixed(2)} {currency}</strong></td>
						</tr>
					</tfoot>
				</table>

				<h4 class="section-spacer">Equity</h4>
				<table class="beancount-table">
					<tbody>
						{#each equity as [name, amount]}
							<tr>
								<td>{name}</td>
								<td class="align-right">{amount}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td><strong>Total Equity</strong></td>
							<td class="align-right"><strong>{totalEquity.toFixed(2)} {currency}</strong></td>
						</tr>
					</tfoot>
				</table>

				<table class="beancount-table grand-total">
					<tfoot>
						<tr>
							<td><strong>Total Liabilities + Equity</strong></td>
							<td class="align-right"><strong>{totalLiabEquity.toFixed(2)} {currency}</strong></td>
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

	/* Re-using table styles from other components */
	.beancount-table { width: 100%; border-collapse: collapse; }
	.beancount-table td { padding: 6px; border-bottom: 1px solid var(--background-secondary); }
	.beancount-table tbody tr:nth-child(even) { background-color: var(--background-secondary-alt); }
	.beancount-table tfoot tr { border-top: 2px solid var(--background-modifier-border); font-weight: 600; }
	.align-right { text-align: right; font-family: var(--font-monospace); }
	.error-message { color: var(--text-error); }
</style>