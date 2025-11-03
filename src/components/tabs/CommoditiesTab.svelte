<!-- src/components/tabs/CommoditiesTab.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { CommoditiesController, CommodityInfo } from '../../controllers/CommoditiesController';
    import YahooFinanceSearchComponent from '../YahooFinanceSearchComponent.svelte';

    export let controller: CommoditiesController;

    // Extract the stores from the controller
    $: commoditiesStore = controller.commodities;
    $: filteredCommoditiesStore = controller.filteredCommodities;
    $: selectedCommodityStore = controller.selectedCommodity;
    $: searchTermStore = controller.searchTerm;
    $: loadingStore = controller.loading;
    $: errorStore = controller.error;
    $: lastUpdatedStore = controller.lastUpdated;
    $: hasCommodityDataStore = controller.hasCommodityData;

    // UI state
    let showDetailModal = false;

    // Watch for selectedCommodity changes to control modal
    $: showDetailModal = !!$selectedCommodityStore;

    onMount(async () => {
        await controller.loadData();
    });

    function handleSearchInput(event: Event) {
        const target = event.target as HTMLInputElement;
        controller.setSearchTerm(target.value);
    }

    function handleCommodityClick(commodity: CommodityInfo) {
        controller.selectCommodity(commodity);
    }

    function closeDetailModal() {
        controller.clearSelection();
    }

    function handleRefresh() {
        controller.refresh();
    }

    function handleKeydown(event: KeyboardEvent, callback: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            callback();
        }
    }

    // Yahoo Finance Search Handlers
    async function handleYahooFinanceApply(event: CustomEvent<{ symbol: string; metadata: string; price?: number }>) {
        const { symbol: yahooSymbol, metadata } = event.detail;
        
        if ($selectedCommodityStore) {
            try {
                await controller.updatePriceMetadata($selectedCommodityStore.symbol, yahooSymbol);
                console.log(`Applied Yahoo Finance source for ${$selectedCommodityStore.symbol}: ${metadata}`);
            } catch (error) {
                console.error('Failed to apply Yahoo Finance source:', error);
            }
        }
    }

    function handleYahooFinanceCancel() {
        // Just log for now, no special handling needed
        console.log('Yahoo Finance search cancelled');
    }

    async function handleRemovePriceMetadata() {
        if ($selectedCommodityStore) {
            try {
                await controller.removePriceMetadata($selectedCommodityStore.symbol);
                console.log(`Removed price metadata for ${$selectedCommodityStore.symbol}`);
            } catch (error) {
                console.error('Failed to remove price metadata:', error);
            }
        }
    }

    function formatNumber(num: number | undefined): string {
        if (num === undefined || num === null || isNaN(num)) return 'N/A';
        return num.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 6 
        });
    }

    function formatDate(dateStr: string | undefined): string {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString();
        } catch {
            return dateStr;
        }
    }

    function getCommodityTypeIcon(symbol: string): string {
        // Common currency symbols
        const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'INR', 'CNY'];
        if (currencies.includes(symbol)) {
            return '💱'; // Currency exchange icon
        }
        
        // Cryptocurrency patterns
        if (symbol.match(/^(BTC|ETH|ADA|DOT|LINK|UNI|AAVE|SOL|AVAX|MATIC)$/)) {
            return '₿'; // Bitcoin icon for crypto
        }
        
        // Stock/ETF patterns (typically longer symbols)
        if (symbol.length > 3) {
            return '📈'; // Stock chart icon
        }
        
        return '🪙'; // Generic commodity icon
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

<!-- Commodity Detail Modal -->
{#if showDetailModal && $selectedCommodityStore}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
        class="modal-overlay" 
        on:click={closeDetailModal}
        role="dialog" 
        aria-modal="true"
        aria-labelledby="modal-title"
    >
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
            class="commodity-modal" 
            on:click|stopPropagation
            role="document"
        >
            <div class="modal-header">
                <h3 id="modal-title">
                    <span class="commodity-icon">{getCommodityTypeIcon($selectedCommodityStore.symbol)}</span>
                    {$selectedCommodityStore.symbol} Details
                </h3>
                <button 
                    class="close-button" 
                    on:click={closeDetailModal}
                    aria-label="Close modal"
                >×</button>
            </div>
            
            <div class="modal-content">
                <!-- Summary Info -->
                <div class="commodity-summary">
                    <div class="summary-row">
                        <span class="label">Symbol:</span>
                        <span class="value">{$selectedCommodityStore.symbol}</span>
                    </div>
                    <div class="summary-row">
                        <span class="label">Price Metadata:</span>
                        <span class="value">
                            {#if $selectedCommodityStore.hasPriceMetadata}
                                <span class="has-price-meta">✅ Available</span>
                                {#if $selectedCommodityStore.priceMetadata}
                                    <br><small>Source: {$selectedCommodityStore.priceMetadata}</small>
                                {/if}
                            {:else}
                                <span class="no-price-meta">❌ None (prices will not be fetched)</span>
                            {/if}
                        </span>
                    </div>
                    
                    {#if $selectedCommodityStore.currentPrice}
                        <div class="summary-row">
                            <span class="label">Current Price:</span>
                            <span class="value">{$selectedCommodityStore.currentPrice}</span>
                        </div>
                    {/if}
                </div>

                <!-- Yahoo Finance Search Component -->
                <YahooFinanceSearchComponent
                    currentPriceMetadata={$selectedCommodityStore.priceMetadata || ''}
                    disabled={$loadingStore}
                    on:apply={handleYahooFinanceApply}
                    on:cancel={handleYahooFinanceCancel}
                />

                <!-- Price Metadata Management -->
                {#if $selectedCommodityStore.hasPriceMetadata}
                    <div class="price-metadata-actions">
                        <button 
                            class="remove-metadata-button"
                            on:click={handleRemovePriceMetadata}
                            disabled={$loadingStore}
                        >
                            🗑️ Remove Price Metadata
                        </button>
                    </div>
                {/if}

                <!-- Full Metadata Display -->
                {#if $selectedCommodityStore.fullMetadata && Object.keys($selectedCommodityStore.fullMetadata).length > 0}
                    <div class="metadata-section">
                        <h4>All Metadata</h4>
                        <div class="metadata-table">
                            <div class="table-header">
                                <span>Key</span>
                                <span>Value</span>
                            </div>
                            {#each Object.entries($selectedCommodityStore.fullMetadata) as [key, value]}
                                <div class="table-row">
                                    <span class="metadata-key">{key}</span>
                                    <span class="metadata-value">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else}
                    <div class="no-metadata">
                        <div class="no-metadata-icon">�</div>
                        <h4>No additional metadata</h4>
                        <p>This commodity has no additional metadata defined.</p>
                        <div class="metadata-setup-guide">
                            <h5>To add metadata:</h5>
                            <ol>
                                <li>Add metadata to your commodity declaration:
                                    <code>2024-01-01 commodity {$selectedCommodityStore.symbol}
  price: "USD"
  exchange_symbol: "SYMBOL"</code>
                                </li>
                                <li>Use metadata for automated price fetching with bean-price</li>
                                <li>Refresh this tab to see the updated metadata</li>
                            </ol>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

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
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
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
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-radius: 8px;
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        min-height: 120px;
        height: auto;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
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
        margin-bottom: 12px;
        gap: 8px;
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
        margin: 8px 0;
        padding: 8px 0;
        flex-grow: 1;
        display: flex;
        align-items: center;
        min-height: 24px;
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
        padding-top: 8px;
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

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .commodity-modal {
        background: var(--background-primary);
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .modal-header h3 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
    }

    .close-button:hover {
        background: var(--background-secondary);
        color: var(--text-normal);
    }

    .modal-content {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(80vh - 140px);
    }

    .commodity-summary {
        margin-bottom: 24px;
    }

    .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--background-modifier-border-focus);
    }

    .summary-row .label {
        font-weight: 500;
        color: var(--text-muted);
    }

    .summary-row .value {
        font-weight: 600;
        color: var(--text-normal);
    }

    .has-price-meta {
        color: var(--text-success);
        font-weight: 600;
    }

    .no-price-meta {
        color: var(--text-error);
        font-weight: 600;
    }

    .metadata-section {
        margin-top: 24px;
    }

    .metadata-section h4 {
        margin: 0 0 12px 0;
        color: var(--text-normal);
    }

    .metadata-table {
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .metadata-table .table-header {
        display: grid;
        grid-template-columns: 1fr 2fr;
        background: var(--background-secondary);
        padding: 12px;
        font-weight: 600;
        color: var(--text-normal);
    }

    .metadata-table .table-row {
        display: grid;
        grid-template-columns: 1fr 2fr;
        padding: 10px 12px;
        border-top: 1px solid var(--background-modifier-border-focus);
    }

    .metadata-table .table-row:nth-child(even) {
        background: var(--background-secondary-alt);
    }

    .metadata-key {
        font-weight: 500;
        color: var(--text-muted);
    }

    .metadata-value {
        color: var(--text-normal);
        word-break: break-word;
    }

    .no-metadata {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
    }

    .no-metadata-icon {
        font-size: 48px;
        margin-bottom: 16px;
    }

    .no-metadata h4 {
        margin: 0 0 8px 0;
        color: var(--text-normal);
    }

    .metadata-setup-guide {
        background: var(--background-secondary);
        border-radius: 8px;
        padding: 16px;
        margin-top: 20px;
        text-align: left;
    }

    .metadata-setup-guide h5 {
        margin: 0 0 12px 0;
        color: var(--text-normal);
    }

    .metadata-setup-guide ol {
        margin: 0;
        padding-left: 20px;
    }

    .metadata-setup-guide li {
        margin: 8px 0;
        color: var(--text-muted);
    }

    .metadata-setup-guide code {
        background: var(--background-primary);
        padding: 8px 12px;
        border-radius: 4px;
        font-family: var(--font-monospace);
        font-size: 12px;
        display: block;
        margin: 8px 0;
        border: 1px solid var(--background-modifier-border);
        white-space: pre-line;
    }

    .empty-list code {
        background: var(--background-primary);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--font-monospace);
        font-size: 11px;
        border: 1px solid var(--background-modifier-border);
    }

    @media (max-width: 768px) {
        .commodities-header {
            flex-direction: column;
            align-items: stretch;
        }

        .header-right {
            justify-content: space-between;
        }

        .search-input {
            flex: 1;
            min-width: 0;
        }

        .commodities-grid {
            grid-template-columns: 1fr;
            gap: 20px;
        }

        .commodity-modal {
            margin: 10px;
            max-height: 90vh;
        }
    }

    /* Price Metadata Actions */
    .price-metadata-actions {
        margin: var(--size-4-4) 0;
        padding: var(--size-4-3);
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
    }

    .remove-metadata-button {
        background: var(--color-red);
        color: var(--text-on-accent);
        border: none;
        border-radius: var(--radius-s);
        padding: var(--size-4-2) var(--size-4-3);
        cursor: pointer;
        font-size: 0.9em;
        font-weight: 500;
        transition: background-color 0.2s ease;
    }

    .remove-metadata-button:hover:not(:disabled) {
        background: var(--color-red-hover);
    }

    .remove-metadata-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>