<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import type { ChartConfiguration } from "chart.js/auto";
	import type { AccountDetail } from "../../services/accountDetail.service";
	import ChartComponent from "../common/ChartComponent.svelte";
	import CustomSelect from "../common/CustomSelect.svelte";
	import TabBar from "../common/TabBar.svelte";

	export let account: string;
	export let detail: AccountDetail;

	const dispatch = createEventDispatcher();

	let reconcileInput = "";
	let errorMessage = "";
	let activeTab: "details" | "balance-history" = "details";
	let balanceHistoryView: "chart" | "table" = "chart";
	let balanceHistoryInterval: "month" | "week" = "month";

	// Re-sync local edit state whenever a fresh `detail` arrives (initial load,
	// or after this modal's own save/balance/force-reconcile actions refresh it).
	$: {
		reconcileInput = detail.reconcileDays != null ? String(detail.reconcileDays) : "";
		errorMessage = "";
	}

	function shortAccount(acct: string): string {
		const parts = acct.split(":");
		return parts.length > 1 ? parts.slice(1).join(":") : acct;
	}

	function handleSave() {
		const trimmed = reconcileInput.trim();
		if (trimmed === "") {
			errorMessage = "";
			dispatch("save-reconcile", { reconcileDays: null });
			return;
		}
		const days = parseInt(trimmed, 10);
		if (isNaN(days) || days <= 0) {
			errorMessage = "Reconciliation interval must be a positive number of days";
			return;
		}
		errorMessage = "";
		dispatch("save-reconcile", { reconcileDays: days });
	}

	function handleBalance() {
		dispatch("add-balance");
	}

	function handleForceReconcile() {
		dispatch("force-reconcile");
	}

	function close() {
		dispatch("close");
	}

	$: balanceHistory = (balanceHistoryInterval === "week" ? detail.balanceHistoryWeekly : detail.balanceHistoryMonthly) || [];
	$: balanceHistoryChartConfig = buildBalanceHistoryChart(balanceHistory, detail.balanceHistoryCurrency);

	function formatBalanceAmount(value: number): string {
		return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
	}

	function buildBalanceHistoryChart(
		history: Array<{ date: string; label: string; value: number }>,
		currency: string,
	): ChartConfiguration | null {
		if (!history.length) return null;

		return {
			type: "line",
			data: {
				labels: history.map((point) => point.label),
				datasets: [
					{
						label: `Balance (${currency})`,
						data: history.map((point) => point.value),
						borderColor: "rgb(75, 192, 192)",
						backgroundColor: "rgba(75, 192, 192, 0.12)",
						tension: 0.25,
						fill: true,
						pointRadius: history.length > 60 ? 0 : 3,
						pointHoverRadius: 5,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: true, position: "top" },
					tooltip: {
						mode: "index",
						intersect: false,
						callbacks: {
							label: (context) => `Balance: ${formatBalanceAmount(context.parsed.y)} ${currency}`,
						},
					},
				},
				scales: {
					x: {
						display: true,
						ticks: { maxTicksLimit: 8 },
						grid: { display: false },
					},
					y: {
						display: true,
						ticks: {
							callback: (value) => (typeof value === "number" ? formatBalanceAmount(value) : value),
						},
					},
				},
				interaction: { mode: "nearest", axis: "x", intersect: false },
			},
		};
	}
</script>

<div class="modal-body">
	<div class="identity">
		<div class="identity-info">
			<div class="account-name">{shortAccount(account)}</div>
			<div class="account-full-name">{account}</div>
		</div>
		{#if detail.isClosed}
			<span class="badge badge-muted">Closed</span>
		{:else}
			<span class="badge badge-ok">Open</span>
		{/if}
	</div>

	<div class="tab-bar-row">
		<TabBar
			tabs={[
				{ value: 'details', label: 'Metadata' },
				{ value: 'balance-history', label: 'Balance History' },
			]}
			bind:value={activeTab}
			fullWidth={false}
			ariaLabel="Account detail sections"
		/>
	</div>

	{#if activeTab === "balance-history"}
		<div class="section">
			<div class="section-heading">
				<p class="section-title">Balance History</p>
				<div class="pill-dropdown-group">
					<CustomSelect
						variant="primary"
						position={balanceHistory.length > 0 ? 'left' : 'single'}
						options={[
							{ value: 'month', label: 'Monthly', icon: 'calendar' },
							{ value: 'week', label: 'Weekly', icon: 'clock' },
						]}
						bind:value={balanceHistoryInterval}
						ariaLabel="Balance history interval"
					/>
					{#if balanceHistory.length > 0}
						<CustomSelect
							variant="secondary"
							position="right"
							options={[
								{ value: 'chart', label: 'Chart', icon: 'trend' },
								{ value: 'table', label: 'Table', icon: 'table' },
							]}
							bind:value={balanceHistoryView}
							ariaLabel="Balance history view"
						/>
					{/if}
				</div>
			</div>
			<div class="section-card history-card">
				{#if balanceHistory.length === 0}
					<div class="empty-history">No balance history found for this account.</div>
				{:else if balanceHistoryView === "chart" && balanceHistoryChartConfig}
					<div class="balance-history-chart">
						<ChartComponent config={balanceHistoryChartConfig} height="240px" />
					</div>
				{:else}
					<div class="balance-history-table-wrap">
						<table class="balance-history-table">
							<thead>
								<tr>
									<th>{balanceHistoryInterval === "week" ? "Week ending" : "Month"}</th>
									<th>Balance ({detail.balanceHistoryCurrency})</th>
								</tr>
							</thead>
							<tbody>
								{#each balanceHistory.slice().reverse() as point}
									<tr>
										<td>{point.label}</td>
										<td>{formatBalanceAmount(point.value)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="section">
			<p class="section-title">Details</p>
			<div class="section-card">
				<div class="kv-row">
					<span class="kv-key">Open date</span>
					<span class="kv-value">{detail.openDate || "—"}</span>
				</div>
				{#if detail.isClosed}
					<div class="kv-row">
						<span class="kv-key">Close date</span>
						<span class="kv-value">{detail.closeDate}</span>
					</div>
				{/if}
				<div class="kv-row">
					<span class="kv-key">Currencies</span>
					<span class="kv-value">{detail.currencies.length ? detail.currencies.join(", ") : "—"}</span>
				</div>
			</div>
		</div>

		<div class="section">
			<p class="section-title">Reconciliation</p>
			<div class="section-card">
				<div class="kv-row">
					<span class="kv-key">Status</span>
					<span class="kv-value">
						{#if detail.isFailing}
							<span class="badge badge-error"
								>Failing{#if detail.failingDiscrepancy} — off by {detail.failingDiscrepancy}{/if}{#if detail.failingDate} as of {detail.failingDate}{/if}</span
							>
						{:else if !detail.reconcileDays}
							<span class="text-muted">No interval set</span>
						{:else if detail.lastBalanceDate}
							<span class="badge" class:badge-warning={detail.isOverdue} class:badge-ok={!detail.isOverdue}
								>{detail.isOverdue ? "Overdue" : "Up to date"}</span
							>
							<span class="status-detail">last reconciled {detail.lastBalanceDate} ({detail.daysSinceLastBalance}d ago)</span>
						{:else}
							<span class="badge badge-warning">Never reconciled</span>
						{/if}
					</span>
				</div>

				{#if detail.isClosed}
					<div class="kv-row">
						<span class="kv-key">Reconciliation interval (days)</span>
						<span class="kv-value">{detail.reconcileDays ? `${detail.reconcileDays} days (account closed)` : "—"}</span>
					</div>
				{:else}
					<div class="kv-row">
						<span class="kv-key">Reconciliation interval (days)</span>
						<span class="kv-value">
							<div class="edit-area">
								<input type="number" min="1" bind:value={reconcileInput} placeholder="e.g. 30 (blank to clear)" />
								{#if errorMessage}
									<span class="error-text">{errorMessage}</span>
								{/if}
							</div>
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="footer">
		<div class="footer-group">
			<button class="btn" on:click={handleBalance}>Add Balance</button>
			<button
				class="btn"
				disabled={!detail.isFailing}
				title={detail.isFailing ? "" : "No failing balance assertion to fix"}
				on:click={handleForceReconcile}>Force reconcile</button
			>
		</div>
		<div class="footer-group">
			{#if !detail.isClosed}
				<button class="btn btn-primary" on:click={handleSave}>Save</button>
			{/if}
			<button class="btn btn-ghost" on:click={close}>Done</button>
		</div>
	</div>
</div>

<style>
	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 4px 0;
	}

	.identity {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.identity-info {
		flex: 1;
		min-width: 0;
	}

	.account-name {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-normal);
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.account-full-name {
		margin-top: 2px;
		color: var(--text-muted);
		font-size: 12px;
		font-family: var(--font-monospace);
		overflow-wrap: anywhere;
	}

	.tab-bar-row {
		display: flex;
		justify-content: flex-start;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.pill-dropdown-group {
		display: inline-flex;
		align-items: center;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05));
	}

	.section-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 0;
	}

	.section-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.history-card {
		min-height: 72px;
	}

	.balance-history-chart {
		height: 240px;
		padding: 12px;
	}

	.balance-history-table-wrap {
		max-height: 280px;
		overflow: auto;
	}

	.balance-history-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	.balance-history-table th,
	.balance-history-table td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--background-modifier-border);
		text-align: left;
		font-variant-numeric: tabular-nums;
	}

	.balance-history-table th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--background-secondary);
		color: var(--text-muted);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.empty-history {
		padding: 16px;
		color: var(--text-muted);
		font-size: 13px;
	}

	.kv-row {
		display: grid;
		grid-template-columns: minmax(120px, 0.32fr) minmax(0, 1fr);
		align-items: start;
		column-gap: 14px;
		row-gap: 8px;
		padding: 9px 14px;
		border-bottom: 1px solid var(--background-modifier-border);
		font-size: 13px;
	}

	.kv-row:last-child {
		border-bottom: none;
	}

	.kv-key {
		color: var(--text-muted);
		font-size: 12px;
		line-height: 1.45;
	}

	.kv-value {
		min-width: 0;
		color: var(--text-normal);
		overflow-wrap: anywhere;
		font-size: 13px;
		line-height: 1.45;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.status-detail {
		color: var(--text-muted);
		font-size: 12px;
	}

	.text-muted {
		color: var(--text-muted);
	}

	/* ── Badges ───────────────────────────────────────── */
	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
	}

	.badge-ok {
		background: var(--color-green, #4caf50);
		color: white;
		opacity: 0.85;
	}

	.badge-warning {
		background: var(--color-orange, #ff9800);
		color: white;
		opacity: 0.9;
	}

	.badge-error {
		background: var(--color-red, #e53935);
		color: white;
		opacity: 0.9;
	}

	.badge-muted {
		background: var(--background-modifier-border);
		color: var(--text-muted);
	}

	/* ── Inline edit ──────────────────────────────────── */
	.edit-area {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}

	.edit-area input {
		width: 100%;
		max-width: 200px;
		padding: 6px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 13px;
		box-sizing: border-box;
	}

	.edit-area input:focus {
		outline: none;
		border-color: var(--interactive-accent);
	}

	.error-text {
		font-size: 11px;
		color: var(--text-error);
	}

	/* ── Buttons ──────────────────────────────────────── */
	.btn {
		padding: 5px 12px;
		border-radius: 5px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 12px;
		cursor: pointer;
		transition: background 0.15s ease;
		white-space: nowrap;
	}

	.btn:hover:not(:disabled) {
		background: var(--background-secondary-alt);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: transparent;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--interactive-accent-hover);
	}

	.btn-ghost {
		background: transparent;
		border-color: transparent;
		color: var(--text-muted);
	}

	.btn-ghost:hover:not(:disabled) {
		color: var(--text-normal);
		background: var(--background-secondary);
	}

	/* ── Footer ───────────────────────────────────────── */
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding-top: 4px;
		border-top: 1px solid var(--background-modifier-border);
		flex-wrap: wrap;
	}

	.footer-group {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
</style>
