<script lang="ts">
	import { createEventDispatcher, onMount, tick } from "svelte";
	import type { ChartConfiguration } from "chart.js/auto";
	import ChartComponent from "../common/ChartComponent.svelte";
	import CustomSelect from "../common/CustomSelect.svelte";
	import TabBar from "../common/TabBar.svelte";
	import { formatSignificantAmount } from "../../utils/index";
	export let symbol: string;
	export let commodity: any = {
		symbol: "",
		metadata: {},
		logo_url: null,
		price_meta: null,
		latest_price: null,
	};

	const dispatch = createEventDispatcher();

	let editingLogo = false;
	let editingPrice = false;
	let logoInput = "";
	let priceInput = "";
	let priceHistoryView: "chart" | "table" = "chart";
	let activeTab: "metadata" | "price-history" = "metadata";

	let priceInputRef: HTMLInputElement | null = null;
	let logoInputRef: HTMLInputElement | null = null;

	$: if (editingPrice) tick().then(() => priceInputRef?.focus());
	$: if (editingLogo) tick().then(() => logoInputRef?.focus());

	onMount(() => {
		logoInput = commodity?.metadata?.logo || commodity?.logo_url || "";
		priceInput = commodity?.metadata?.price || commodity?.price_meta || "";
	});

	function toggleEditLogo() {
		editingLogo = !editingLogo;
	}
	function toggleEditPrice() {
		editingPrice = !editingPrice;
	}

	function saveMetadata() {
		const newMeta = { ...(commodity?.metadata || {}) };
		if (logoInput?.trim()) newMeta.logo = logoInput.trim();
		else delete newMeta.logo;
		if (priceInput?.trim()) newMeta.price = priceInput.trim();
		else delete newMeta.price;
		dispatch("save-metadata", { symbol, metadata: newMeta });
		editingLogo = false;
		editingPrice = false;
	}

	function testPrice() {
		dispatch("test-price", { symbol });
	}
	function testLogo() {
		dispatch("test-logo", { symbol, url: logoInput });
	}
	function close() {
		dispatch("close");
	}

	let showDeleteConfirm = false;
	function requestDelete() {
		showDeleteConfirm = true;
	}
	function cancelDelete() {
		showDeleteConfirm = false;
	}
	function confirmDelete() {
		showDeleteConfirm = false;
		dispatch("delete", { symbol });
	}

	$: hasLogo = !!(commodity?.metadata?.logo || commodity?.logo_url);
	$: logoUrl = commodity?.metadata?.logo || commodity?.logo_url;
	$: priceSource = commodity?.metadata?.price || commodity?.price_meta;
	$: currentPrice = commodity?.currentPrice;
	$: displayName = commodity?.displayName || commodity?.metadata?.name || "";
	$: priceHistory = commodity?.priceHistory || [];
	$: priceHistoryChartConfig = buildPriceHistoryChart(priceHistory);
	$: otherMeta = Object.entries(commodity?.metadata || {}).filter(
		([k]) => k !== "logo" && k !== "price" && k !== "name",
	);

	// Generate initials + color for fallback avatar
	function getInitials(sym: string) {
		return sym ? sym.slice(0, 2).toUpperCase() : "??";
	}

	function formatPriceAmount(value: number | string | null | undefined) {
		if (typeof value !== "number" || !Number.isFinite(value)) return "—";
		return formatSignificantAmount(value);
	}

	function buildPriceHistoryChart(
		history: Array<{ date: string; amount: number; currency: string }>,
	): ChartConfiguration | null {
		if (!history.length) return null;

		const currencies = Array.from(new Set(history.map((point) => point.currency).filter(Boolean)));
		const labelCurrency = currencies.length === 1 ? currencies[0] : "mixed";

		return {
			type: "line",
			data: {
				labels: history.map((point) => point.date),
				datasets: [
					{
						label: labelCurrency ? `Price (${labelCurrency})` : "Price",
						data: history.map((point) => point.amount),
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
							label: (context) => {
								const value = context.parsed.y;
								const currency = history[context.dataIndex]?.currency || "";
								return `Price: ${formatPriceAmount(value)} ${currency}`.trim();
							},
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
							callback: (value) =>
								typeof value === "number" ? formatPriceAmount(value) : value,
						},
					},
				},
				interaction: { mode: "nearest", axis: "x", intersect: false },
			},
		};
	}
</script>

<div class="modal-body">
	<!-- Identity -->
	<div class="identity">
		<div class="logo-wrap">
			{#if hasLogo}
				<img
					src={logoUrl}
					alt="{symbol} logo"
					on:error={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
			{:else}
				<span class="logo-initials">{getInitials(symbol)}</span>
			{/if}
		</div>
		<div class="identity-info">
			<div class="symbol-name">{symbol}</div>
			{#if displayName}
				<div class="display-name">{displayName}</div>
			{/if}
			{#if currentPrice}
				<div class="current-price">
					Current price: <strong>{currentPrice}</strong>
				</div>
			{/if}
		</div>
	</div>

	<!-- Tabs -->
	<TabBar
		tabs={[
			{ value: 'metadata', label: 'Metadata' },
			{ value: 'price-history', label: 'Price History' },
		]}
		bind:value={activeTab}
		fullWidth={false}
		ariaLabel="Commodity detail sections"
	/>

	{#if activeTab === "price-history"}
		<!-- Price History -->
		<div class="section">
			<div class="section-heading">
				<p class="section-title">Price History</p>
				{#if priceHistory.length > 0}
					<CustomSelect
						variant="secondary"
						position="single"
						options={[
							{ value: 'chart', label: 'Chart', icon: 'trend' },
							{ value: 'table', label: 'Table', icon: 'table' },
						]}
						bind:value={priceHistoryView}
						ariaLabel="Price history view"
					/>
				{/if}
			</div>
			<div class="section-card history-card">
				{#if priceHistory.length === 0}
					<div class="empty-history">No price directives found for this commodity.</div>
				{:else if priceHistoryView === "chart" && priceHistoryChartConfig}
					<div class="price-history-chart">
						<ChartComponent config={priceHistoryChartConfig} height="240px" />
					</div>
				{:else}
					<div class="price-history-table-wrap">
						<table class="price-history-table">
							<thead>
								<tr>
									<th>Date</th>
									<th>Price</th>
									<th>Currency</th>
								</tr>
							</thead>
							<tbody>
								{#each priceHistory.slice().reverse() as point}
									<tr>
										<td>{point.date}</td>
										<td>{formatPriceAmount(point.amount)}</td>
										<td>{point.currency}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Price Source -->
		<div class="section">
			<p class="section-title">Price Source</p>
			<div class="section-card">
				{#if !editingPrice}
					<div class="kv-row">
						<span class="kv-key">Source</span>
						<span class="kv-value">{priceSource || "—"}</span>
						<div class="kv-actions">
							<button
								class="btn btn-ghost"
								on:click={testPrice}
								title="Test this price source">Test</button
							>
							<button class="btn" on:click={toggleEditPrice}
								>{priceSource ? "Edit" : "Add"}</button
							>
						</div>
					</div>
				{:else}
					<div class="edit-area">
						<input
							type="text"
							bind:value={priceInput}
							bind:this={priceInputRef}
							placeholder="e.g. yahoo/BTC-USD or crypto:coingecko/bitcoin"
						/>
						<span class="edit-hint"
							>Format: provider/symbol — e.g. <code>yahoo/AAPL</code>
							or <code>crypto:coingecko/bitcoin</code></span
						>
						<div class="edit-buttons">
							<button class="btn btn-primary" on:click={saveMetadata}
								>Save</button
							>
							<button class="btn btn-ghost" on:click={testPrice}
								>Test</button
							>
							<button class="btn btn-ghost" on:click={toggleEditPrice}
								>Cancel</button
							>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Logo -->
		<div class="section">
			<p class="section-title">Logo</p>
			<div class="section-card">
				{#if !editingLogo}
					<div class="kv-row">
						<span class="kv-key">URL</span>
						<span class="kv-value">{logoUrl || "—"}</span>
						<div class="kv-actions">
							{#if logoUrl}
								<button
									class="btn btn-ghost"
									on:click={testLogo}
									title="Verify logo URL">Test</button
								>
							{/if}
							<button class="btn" on:click={toggleEditLogo}
								>{logoUrl ? "Edit" : "Add"}</button
							>
						</div>
					</div>
				{:else}
					<div class="edit-area">
						<input
							type="text"
							bind:value={logoInput}
							bind:this={logoInputRef}
							placeholder="https://example.com/logo.png"
						/>
						<span class="edit-hint"
							>Direct image URL (PNG, SVG, or JPG)</span
						>
						<div class="edit-buttons">
							<button class="btn btn-primary" on:click={saveMetadata}
								>Save</button
							>
							<button class="btn btn-ghost" on:click={testLogo}
								>Test URL</button
							>
							<button class="btn btn-ghost" on:click={toggleEditLogo}
								>Cancel</button
							>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Other Metadata -->
		{#if otherMeta.length > 0}
			<div class="section">
				<p class="section-title">Other Metadata</p>
				<div class="section-card">
					{#each otherMeta as [key, value]}
						<div class="kv-row">
							<span class="kv-key">{key}</span>
							<span class="kv-value"
								>{typeof value === "string"
									? value
									: JSON.stringify(value)}</span
							>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- Footer -->
	<div class="footer">
		<button class="btn btn-danger" on:click={requestDelete}
			>Delete Commodity</button
		>
		<button class="btn btn-primary" on:click={close}>Done</button>
	</div>
</div>

<svelte:window on:keydown={(e) => e.key === 'Escape' && showDeleteConfirm && cancelDelete()} />

<!-- Delete Confirmation Overlay -->
{#if showDeleteConfirm}
	<div
		class="confirm-overlay"
	>
		<button class="confirm-backdrop" type="button" on:click={cancelDelete} aria-label="Close dialog"></button>
		<div class="confirm-dialog" role="dialog" aria-modal="true" tabindex="-1">
			<h4>Delete {symbol}</h4>
			<p>
				Are you sure you want to delete the <strong>{symbol}</strong>
				commodity directive? This removes the declaration from your ledger
				file. Existing transactions that use <strong>{symbol}</strong> will
				not be affected.
			</p>
			<div class="confirm-actions">
				<button class="btn btn-ghost" on:click={cancelDelete}
					>Cancel</button
				>
				<button class="btn btn-danger" on:click={confirmDelete}
					>Delete</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 4px 0;
	}

	/* ── Identity row ─────────────────────────────────── */
	.identity {
		display: flex;
		align-items: center;
		gap: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.logo-wrap {
		width: 56px;
		height: 56px;
		border-radius: 10px;
		overflow: hidden;
		background: var(--background-secondary);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--background-modifier-border);
	}

	.logo-wrap img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.logo-initials {
		font-weight: 800;
		font-size: 16px;
		color: var(--text-muted);
	}

	.identity-info {
		flex: 1;
		min-width: 0;
	}

	.symbol-name {
		font-size: 22px;
		font-weight: 700;
		color: var(--text-normal);
		line-height: 1.1;
	}

	.current-price {
		margin-top: 4px;
		font-size: 14px;
		color: var(--text-muted);
	}

	.current-price strong {
		color: var(--text-normal);
		font-size: 16px;
	}

	.display-name {
		margin-top: 4px;
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1.35;
	}

	/* ── Section ──────────────────────────────────────── */
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

	.price-history-chart {
		height: 240px;
		padding: 12px;
	}

	.price-history-table-wrap {
		max-height: 280px;
		overflow: auto;
	}

	.price-history-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	.price-history-table th,
	.price-history-table td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--background-modifier-border);
		text-align: left;
		font-variant-numeric: tabular-nums;
	}

	.price-history-table th {
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

	/* ── Key-value rows ───────────────────────────────── */
	.kv-row {
		display: grid;
		grid-template-columns: minmax(150px, 0.28fr) minmax(0, 1fr) auto;
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
		overflow-wrap: anywhere;
	}

	.kv-value {
		min-width: 0;
		color: var(--text-normal);
		overflow-wrap: anywhere;
		word-break: normal;
		white-space: pre-wrap;
		font-family: var(--font-monospace);
		font-size: 12px;
		line-height: 1.45;
	}

	.kv-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	@media (max-width: 520px) {
		.kv-row {
			grid-template-columns: 1fr;
		}

		.kv-actions {
			justify-content: flex-start;
			flex-wrap: wrap;
		}
	}

	/* ── Inline edit ──────────────────────────────────── */
	.edit-area {
		padding: 10px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.edit-area input {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 13px;
		font-family: var(--font-monospace);
		box-sizing: border-box;
	}

	.edit-area input:focus {
		outline: none;
		border-color: var(--interactive-accent);
	}

	.edit-hint {
		font-size: 11px;
		color: var(--text-faint);
	}

	.edit-buttons {
		display: flex;
		gap: 6px;
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

	.btn:hover {
		background: var(--background-secondary-alt);
	}

	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: transparent;
	}

	.btn-primary:hover {
		background: var(--interactive-accent-hover);
	}

	.btn-ghost {
		background: transparent;
		border-color: transparent;
		color: var(--text-muted);
	}

	.btn-ghost:hover {
		color: var(--text-normal);
		background: var(--background-secondary);
	}

	/* ── Footer ───────────────────────────────────────── */
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 4px;
		border-top: 1px solid var(--background-modifier-border);
	}

	.btn-danger {
		background: transparent;
		border-color: var(--text-error);
		color: var(--text-error);
	}

	.btn-danger:hover {
		background: var(--text-error);
		color: var(--text-on-accent);
		border-color: transparent;
	}

	/* ── Delete confirm overlay ────────────────────────── */
	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.confirm-backdrop {
		position: absolute;
		inset: 0;
		background: transparent;
		border: none;
		cursor: default;
		padding: 0;
	}

	.confirm-dialog {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 10px;
		padding: 24px;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
	}

	.confirm-dialog h4 {
		margin: 0 0 12px 0;
		color: var(--text-normal);
		font-size: 1.1rem;
	}

	.confirm-dialog p {
		margin: 0 0 20px 0;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 1.55;
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
