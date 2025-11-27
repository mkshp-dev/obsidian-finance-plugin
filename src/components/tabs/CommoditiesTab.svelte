<!-- src/components/tabs/CommoditiesTab.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { CommoditiesController, CommodityInfo } from '../../controllers/CommoditiesController';

    export let controller: CommoditiesController;

    const dispatch = createEventDispatcher();

    // Extract the stores from the controller
    $: filteredCommoditiesStore = controller.filteredCommodities;
    $: searchTermStore = controller.searchTerm;
    $: loadingStore = controller.loading;
    $: errorStore = controller.error;
    $: lastUpdatedStore = controller.lastUpdated;
    $: hasCommodityDataStore = controller.hasCommodityData;

    // UI state

    // Load data on mount
    onMount(async () => {
        console.debug('[CommoditiesTab] onMount — loading commodities');
        await controller.loadData();
    });

    function handleSearchInput(event: Event) {
        const target = event.target as HTMLInputElement;
        console.debug('[CommoditiesTab] handleSearchInput ->', target.value);
        controller.setSearchTerm(target.value);
    }

    function handleCommodityClick(commodity: CommodityInfo) {
        console.debug('[CommoditiesTab] handleCommodityClick ->', commodity?.symbol);
        // Let parent view handle opening the detailed modal (so it can use the app/plugin)
        controller.selectCommodity(commodity);
        dispatch('openCommodity', { symbol: commodity.symbol, commodity });
    }

    function closeDetailModal() {
        console.debug('[CommoditiesTab] closeDetailModal');
        controller.clearSelection();
    }

    function handleRefresh() {
        console.debug('[CommoditiesTab] handleRefresh');
        controller.refresh();
    }

    // Note: helper functions like keydown handlers, removal helpers, and formatters
    // were removed from this component because they are not referenced by the
    // template. Keep logic focused on rendering and delegating actions to the
    // controller to avoid duplication and improve testability.

    function getCommodityTypeIcon(_: string): string {
        // Use a single generic commodity icon for all items.
        return '🪙';
    }
</script>

<div class="commodities-tab">
    <!-- Header with search and refresh -->
    <div class="commodities-header">
        <div class="header-left">
            <h3>Commodities & Prices</h3>
            {#if $lastUpdatedStore}
                <span class="last-updated">Last updated: {$lastUpdatedStore.toLocaleTimeString()}</span>
            {/if}
            {#if !$hasCommodityDataStore && !$loadingStore}
                <div class="price-notice">
                    ℹ️ No commodities found in your Beancount file. Add commodity declarations to see price metadata and holdings information.
                </div>
            {/if}
        </div>
        
        <div class="header-right">
            <input 
                type="text" 
                placeholder="Search commodities..." 
                value={$searchTermStore}
                on:input={handleSearchInput}
                class="search-input"
            />
            <button 
                on:click={handleRefresh} 
                class="refresh-button"
                disabled={$loadingStore}
                title="Refresh commodities data"
            >
                {$loadingStore ? '⟳' : '🔄'}
            </button>
        </div>
    </div>

    <!-- Error display -->
    {#if $errorStore}
        <div class="error-message">
            ⚠️ {$errorStore}
        </div>
    {/if}

    <!-- Loading state -->
    {#if $loadingStore}
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <span>Loading commodities data...</span>
        </div>
    {/if}

    <!-- Commodities grid -->
    {#if !$loadingStore && $filteredCommoditiesStore.length > 0}
        <div class="commodities-grid">
            {#each $filteredCommoditiesStore as commodity, index}
                <div class="commodity-card-wrapper">
                    <button 
                        class="commodity-card" 
                        on:click={() => handleCommodityClick(commodity)} 
                        aria-label="View details for {commodity?.symbol || `UNKNOWN_${index}`}"
                        type="button"
                    >
                        <div class="commodity-header">
                            <span class="commodity-icon">{getCommodityTypeIcon(commodity?.symbol)}</span>
                            <span class="commodity-symbol">{commodity?.symbol || `UNKNOWN_${index}`}</span>
                            {#if commodity?.hasPriceMetadata}
                                <span class="price-metadata-indicator has-metadata" title="Has price metadata - automated price fetching enabled">🟢</span>
                            {:else}
                                <span class="price-metadata-indicator no-metadata" title="No price metadata - manual price entry only">⚪</span>
                            {/if}
                        </div>
                        
                        <div class="current-price">
                            {#if commodity?.currentPrice}
                                <span class="price-value">{commodity.currentPrice}</span>
                            {:else}
                                <span class="no-price">No current price available</span>
                            {/if}
                        </div>

                        <div class="view-details-hint">
                            <span class="view-details">Click for details →</span>
                        </div>
                    </button>
                </div>
            {/each}
        </div>
    {:else if !$loadingStore}
        <div class="empty-state">
            <div class="empty-icon">🪙</div>
            <h4>No commodities found</h4>
            <p>
                {$searchTermStore ? 
                    `No commodities match "${$searchTermStore}"` : 
                    'No commodities found in your Beancount file'}
            </p>
            {#if !$searchTermStore}
                <p class="empty-hint">
                    Commodities appear when you declare them in your Beancount file:
                </p>
                <ul class="empty-list">
                    <li>• Commodity declarations (e.g., <code>2024-01-01 commodity BTC</code>)</li>
                    <li>• With metadata for price sources (e.g., <code>price: "USD"</code>)</li>
                    <li>• Or other metadata like exchange symbols</li>
                </ul>
            {/if}
        </div>
    {/if}
</div>

<!-- Inline modal removed — use the Obsidian Modal wrapper to show commodity details -->

<style>
    .commodities-tab {
        padding: 20px;
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

    .search-input {
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;
        width: 200px;
    }

    .refresh-button {
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s ease;
    }

    .refresh-button:hover:not(:disabled) {
        background: var(--background-secondary);
    }

    .refresh-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
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
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .commodities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
        margin-top: 8px;
    }

    .commodity-card-wrapper {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .commodity-card-wrapper:hover {
        border-color: var(--background-modifier-border-hover);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .commodity-card {
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-radius: 8px;
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        min-height: auto;
        height: auto;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        overflow: visible;
    }

    .commodity-card:hover {
        background: var(--background-secondary);
        transform: translateY(-2px);
    }

    .commodity-card:focus {
        outline: 2px solid var(--text-accent);
        outline-offset: 2px;
    }

    .commodity-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        gap: 6px;
    }

    .commodity-icon {
        font-size: 18px;
    }

    .commodity-symbol {
        font-weight: 600;
        font-size: 16px;
        color: var(--text-normal);
        flex-grow: 1;
    }

    .price-metadata-indicator {
        font-size: 14px;
        margin-left: auto;
    }

    .price-metadata-indicator.has-metadata {
        color: var(--text-success);
    }

    .price-metadata-indicator.no-metadata {
        color: var(--text-muted);
        opacity: 0.7;
    }

    .current-price {
        margin: 4px 0;
        padding: 4px 0;
        flex-grow: 1;
        display: flex;
        align-items: center;
        min-height: 20px;
        border-top: 1px solid var(--background-modifier-border-focus);
    }

    .current-price .price-value {
        font-size: 14px;
        color: var(--text-accent);
        font-weight: 600;
    }

    .current-price .no-price {
        font-size: 13px;
        color: var(--text-muted);
        font-style: italic;
    }

    .view-details-hint {
        text-align: right;
        margin-top: auto;
        padding-top: 4px;
        border-top: 1px solid var(--background-modifier-border-focus);
    }

    .view-details {
        font-size: 12px;
        color: var(--text-accent);
        opacity: 0.7;
    }

    .empty-state {
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