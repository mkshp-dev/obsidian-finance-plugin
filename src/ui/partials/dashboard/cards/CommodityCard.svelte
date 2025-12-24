<!-- src/ui/partials/dashboard/cards/CommodityCard.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { CommodityInfo } from '../../../../controllers/CommoditiesController';

    export let commodity: CommodityInfo;
    export let index: number = 0;

    const dispatch = createEventDispatcher();

    function handleClick() {
        dispatch('click', { commodity });
    }

    function getCommodityTypeIcon(_: string): string {
        return '🪙';
    }

    function handleLogoError(e: Event) {
        const target = e.target as HTMLImageElement;
        if (target) {
            target.style.display = 'none';
        }
    }
</script>

<div class="commodity-card-wrapper">
    <button 
        class="commodity-card" 
        on:click={handleClick}
        aria-label="View details for {commodity?.symbol || `UNKNOWN_${index}`}"
        type="button"
    >
        <div class="commodity-header">
            {#if commodity?.logoUrl}
                <img 
                    src={commodity.logoUrl} 
                    alt="{commodity.symbol} logo" 
                    class="commodity-logo" 
                    on:error={handleLogoError} 
                />
            {:else}
                <span class="commodity-icon">{getCommodityTypeIcon(commodity?.symbol)}</span>
            {/if}
            <span class="commodity-symbol">{commodity?.symbol || `UNKNOWN_${index}`}</span>
            {#if !commodity?.currentPrice}
                <span class="price-status-indicator no-price" title="No price available">⚪</span>
            {:else if commodity?.isPriceLatest}
                <span class="price-status-indicator latest-price" title="Price is up to date (updated today)">🟢</span>
            {:else}
                <span class="price-status-indicator stale-price" title="Price is stale (older than yesterday)">🟠</span>
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

<style>
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

    .commodity-logo {
        width: 24px;
        height: 24px;
        object-fit: contain;
        border-radius: 4px;
    }

    .commodity-symbol {
        font-weight: 600;
        font-size: 16px;
        color: var(--text-normal);
        flex-grow: 1;
    }

    .price-status-indicator {
        font-size: 14px;
        margin-left: auto;
    }

    .price-status-indicator.latest-price {
        color: var(--text-success);
    }

    .price-status-indicator.stale-price {
        color: var(--text-warning);
    }

    .price-status-indicator.no-price {
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
</style>
