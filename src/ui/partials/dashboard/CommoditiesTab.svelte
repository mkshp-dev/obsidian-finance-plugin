<!-- src/components/tabs/CommoditiesTab.svelte -->
<script lang="ts">
	import HelpTip from '../../common/HelpTip.svelte';
	import { onMount, createEventDispatcher } from "svelte";
	import type {
		CommoditiesController,
		CommodityInfo,
	} from "../../../controllers/CommoditiesController";
	import CommodityCard from "./cards/CommodityCard.svelte";
	import SkeletonLoader from "../../common/SkeletonLoader.svelte";
	import ErrorBanner from "../../common/ErrorBanner.svelte";
	import EmptyState from "../../common/EmptyState.svelte";
	import CustomSelect from "../../common/CustomSelect.svelte";

	export let controller: CommoditiesController;

	const dispatch = createEventDispatcher();

	// Extract the stores from the controller
	$: filteredCommoditiesStore = controller.filteredCommodities;
	$: operatingCurrency = controller.getOperatingCurrency();
	$: lastUpdatedStore = controller.lastUpdated;
	// Re-derive after every loadData() (tracked via lastUpdatedStore) so this reflects
	// the currency precision map once it's finished loading, not just its value at mount.
	let operatingCurrencyDecimals = 2;
	$: if ($lastUpdatedStore || operatingCurrency) {
		operatingCurrencyDecimals = controller.getCurrencyDecimals(operatingCurrency);
	}
	$: searchTermStore = controller.searchTerm;
	$: loadingStore = controller.loading;
	$: errorStore = controller.error;
	$: hasCommodityDataStore = controller.hasCommodityData;
	$: fetchingPricesStore = controller.fetchingPrices;
	$: lastPriceFetchStore = controller.lastPriceFetch;
	$: beanPriceAvailableStore = controller.beanPriceAvailable;

	// UI state
	type FilterMode = 'all' | 'has_holding' | 'has_price' | 'has_both';
	let filterMode: FilterMode = 'all';

	$: displayCommodities = (() => {
		const list = $filteredCommoditiesStore;
		if (filterMode === 'has_holding') return list.filter(c => c.isOperatingCurrency || (c.holdings ?? 0) !== 0);
		if (filterMode === 'has_price')   return list.filter(c => c.isOperatingCurrency || !!c.currentPrice);
		if (filterMode === 'has_both')    return list.filter(c => c.isOperatingCurrency || ((c.holdings ?? 0) !== 0 && !!c.currentPrice));
		return list;
	})();

	// Load data on mount
	onMount(async () => {
		console.debug("[CommoditiesTab] onMount — loading commodities");
		controller.refreshBeanPriceAvailability();
		await controller.loadData();
	});

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		console.debug("[CommoditiesTab] handleSearchInput ->", target.value);
		controller.setSearchTerm(target.value);
	}

	function handleCommodityClick(event: CustomEvent) {
		const commodity = event.detail.commodity;
		console.debug(
			"[CommoditiesTab] handleCommodityClick ->",
			commodity?.symbol,
		);
		controller.selectCommodity(commodity);
		dispatch("openCommodity", { symbol: commodity.symbol, commodity });
	}

	function closeDetailModal() {
		console.debug("[CommoditiesTab] closeDetailModal");
		controller.clearSelection();
	}

	function handleRefresh() {
		console.debug("[CommoditiesTab] handleRefresh");
		controller.refresh();
	}

	function handleAddCommodity() {
		console.debug("[CommoditiesTab] handleAddCommodity");
		dispatch("addCommodity");
	}

	async function handleUpdatePrices() {
		console.debug("[CommoditiesTab] handleUpdatePrices");
		await controller.fetchPrices();
	}

	// Format time since last fetch
	function formatTimeSince(date: Date): string {
		const now = new Date().getTime();
		const past = date.getTime();
		const diffMs = now - past;

		const minutes = Math.floor(diffMs / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return "just now";
	}
</script>

<div class="commodities-tab">
	<!-- Header with search and refresh -->
	<div class="commodities-header">
		<div class="header-left">
			<h3>Commodities & Prices <HelpTip topic="commodities" /></h3>
			{#if $lastUpdatedStore}
				<span class="last-updated"
					>Last updated: {$lastUpdatedStore.toLocaleTimeString()}</span
				>
			{/if}
			{#if !$hasCommodityDataStore && !$loadingStore}
				<div class="price-notice">
					ℹ️ No commodities found in your Beancount file. Add
					commodity declarations to see price metadata and holdings
					information.
				</div>
			{/if}
		</div>

		<div class="header-right">
			<button
				on:click={handleUpdatePrices}
				class="update-prices-button"
				disabled={!$beanPriceAvailableStore || $loadingStore || $fetchingPricesStore}
				title={$beanPriceAvailableStore
					? "Fetch latest prices for commodities with configured price sources"
					: "Set up a bean-price command in Settings → Connection to enable price fetching"}
			>
				{$fetchingPricesStore ? "⟳ Fetching..." : "💰 Update Prices"}
			</button>
			<button
				on:click={handleAddCommodity}
				class="add-commodity-button"
				title="Add new commodity"
			>
				+ Add Commodity
			</button>
			<input
				type="text"
				placeholder="Search commodities..."
				value={$searchTermStore}
				on:input={handleSearchInput}
				class="search-input"
			/>
			<button class="btn btn-primary" on:click={handleRefresh} disabled={$loadingStore}>Refresh</button>
		</div>
	</div>

	<!-- Filter toggle -->
	<div class="filter-bar">
		<div class="pill-dropdown-group">
			<CustomSelect
				variant="primary"
				position="single"
				options={[
					{ value: 'all', label: 'All Commodities', icon: 'layers' },
					{ value: 'has_holding', label: 'Has Holding', icon: 'wallet' },
					{ value: 'has_price', label: 'Has Price', icon: 'tag' },
					{ value: 'has_both', label: 'Has Both', icon: 'sparkles' }
				]}
				bind:value={filterMode}
				on:change={(e) => filterMode = e.detail}
				ariaLabel="Filter commodities"
			/>
		</div>
		<span class="filter-count">{displayCommodities.length} shown</span>
	</div>
	{#if $lastPriceFetchStore}
		<div class="price-fetch-info">
			ℹ️ Last price update: {formatTimeSince($lastPriceFetchStore.date)} —
			{$lastPriceFetchStore.summary}
		</div>
	{/if}

	<!-- Error display -->
	{#if $errorStore}
		<ErrorBanner message={$errorStore} on:retry={handleRefresh} />
	{/if}

	<!-- Loading state -->
	{#if $loadingStore}
		<SkeletonLoader type="kpi" />
	{/if}

	<!-- Commodities grid -->
	{#if !$loadingStore && displayCommodities.length > 0}
		<div class="commodities-grid">
			{#each displayCommodities as commodity, index}
				<CommodityCard
					{commodity}
					{index}
					{operatingCurrency}
					{operatingCurrencyDecimals}
					on:click={handleCommodityClick}
				/>
			{/each}
		</div>
	{:else if !$loadingStore}
		<EmptyState icon="🪙" title="No Commodities Found" description={$searchTermStore ? `No commodities match "${$searchTermStore}"` : filterMode !== 'all' ? `No commodities match the active filter` : 'No commodities found in your Beancount file.'}>
			{#if !$searchTermStore}
				<p class="empty-hint">
					Commodities appear when you declare them in your Beancount file:
				</p>
				<ul class="empty-list">
					<li>• Commodity declarations (e.g., <code>2024-01-01 commodity BTC</code>)</li>
					<li>• With price source metadata (e.g., <code>price: "USD"</code>)</li>
					<li>• Or other metadata like exchange symbols</li>
				</ul>
			{/if}
		</EmptyState>
	{/if}
</div>

<!-- Inline modal removed — use the Obsidian Modal wrapper to show commodity details -->

<style>
	.commodities-tab {
		padding: 0;
		max-width: 1200px;
		margin: 0 auto;
	}

	.commodities-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		flex-wrap: wrap;
		gap: 10px;
	}

	.header-left h3 {
		margin: 0;
		color: var(--text-normal);
	}

	.last-updated {
		font-size: 0.85em;
		color: var(--text-muted);
		margin-left: 10px;
	}

	.price-notice {
		margin-top: 8px;
		padding: 8px 12px;
		background: var(--background-secondary);
		border-left: 3px solid var(--text-accent);
		border-radius: 4px;
		font-size: 13px;
		color: var(--text-muted);
		max-width: 500px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.update-prices-button {
		padding: 8px 16px;
		border: 1px solid var(--interactive-accent);
		border-radius: 6px;
		background: var(--background-secondary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.update-prices-button:hover:not(:disabled) {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		transform: translateY(-1px);
	}

	.update-prices-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
		background: var(--background-secondary);
		border-color: var(--background-modifier-border);
		color: var(--text-faint);
		filter: grayscale(1);
	}

	.add-commodity-button {
		padding: 8px 16px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.add-commodity-button:hover {
		background: var(--interactive-accent-hover);
	}

	.search-input {
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		width: 200px;
	}

	/* Filter bar */
	.filter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		position: relative;
		z-index: 20;
	}

	.pill-dropdown-group {
		display: inline-flex;
		align-items: center;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05));
	}

	.filter-count {
		font-size: 12px;
		color: var(--text-faint);
	}

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

	.price-fetch-info {
		background: var(--background-secondary);
		color: var(--text-muted);
		padding: 10px 16px;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		margin-bottom: 16px;
		font-size: 13px;
	}

	.error-message {
		background: var(--background-secondary-alt);
		color: var(--text-error);
		padding: 12px;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		margin-bottom: 20px;
	}

	.loading-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px;
		color: var(--text-muted);
		gap: 12px;
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--background-modifier-border);
		border-top: 2px solid var(--text-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.commodities-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 16px;
		margin-top: 8px;
	}

	.empty-state {
		/* Override Obsidian core's global `.empty-state` rule
		 * (position:absolute; width:100%; height:100%; top:0) which would
		 * otherwise turn this placeholder into a full-viewport overlay
		 * that swallows clicks on every dashboard button. */
		position: relative;
		width: auto;
		height: auto;
		text-align: center;
		padding: 60px 20px;
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.empty-state h4 {
		margin: 0 0 8px 0;
		color: var(--text-normal);
	}

	.empty-state p {
		margin: 8px 0;
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
	}

	.empty-hint {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
		margin-bottom: 16px;
	}

	.empty-list {
		text-align: left;
		max-width: 400px;
		margin: 0 auto;
		color: var(--text-muted);
		font-size: 13px;
	}

	.empty-list li {
		margin: 4px 0;
	}

	/* Removed inline modal and metadata-action styles — modal lives in Obsidian Modal component now. */
</style>
