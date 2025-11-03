<!-- src/components/YahooFinanceSearchComponent.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { YahooFinanceService } from '../services/YahooFinanceService';

    export let selectedSymbol: string = '';
    export let currentPriceMetadata: string = '';
    export let disabled: boolean = false;

    const dispatch = createEventDispatcher<{
        apply: { symbol: string; metadata: string };
        cancel: void;
    }>();

    const yahooService = new YahooFinanceService();
    
    let manualSymbol = selectedSymbol;
    let showPreview = false;

    // Get financial websites and symbol examples
    const websites = yahooService.getFinancialWebsites();
    const symbolExamples = yahooService.getCommonSymbols();

    $: {
        if (manualSymbol && manualSymbol.trim().length > 0) {
            showPreview = true;
        } else {
            showPreview = false;
        }
    }

    $: previewMetadata = manualSymbol ? yahooService.generatePriceMetadata(manualSymbol.toUpperCase()) : '';

    function handleApply() {
        if (!manualSymbol || manualSymbol.trim().length === 0) return;

        const symbol = manualSymbol.toUpperCase().trim();
        const metadata = yahooService.generatePriceMetadata(symbol);
        
        dispatch('apply', {
            symbol: symbol,
            metadata: metadata
        });
    }

    function handleCancel() {
        manualSymbol = '';
        showPreview = false;
        dispatch('cancel');
    }

    function selectExampleSymbol(symbol: string) {
        manualSymbol = symbol;
        showPreview = true;
    }

    function openWebsite(url: string) {
        window.open(url, '_blank');
    }
</script>

<div class="yahoo-finance-search" class:disabled>
    {#if currentPriceMetadata}
        <div class="current-source">
            <span class="label">Current source:</span>
            <code class="current-metadata">{currentPriceMetadata}</code>
        </div>
    {/if}

    <div class="symbol-entry">
        <h4>📈 Enter Stock Symbol</h4>
        <input
            type="text"
            bind:value={manualSymbol}
            placeholder="Enter symbol (e.g., AAPL, GOOGL, SPY)"
            class="symbol-input"
            {disabled}
        />
        {#if previewMetadata && showPreview}
            <div class="metadata-preview">
                <strong>Price Source:</strong> <code>{previewMetadata}</code>
            </div>
        {/if}
    </div>

    <div class="websites-section">
        <h4>🔍 Find Symbols</h4>
        <p class="help-text">Use these financial websites to look up stock, ETF, or crypto symbols:</p>
        
        <div class="websites-grid">
            {#each websites as site}
                <button
                    class="website-button"
                    on:click={() => openWebsite(site.url)}
                    title={site.description}
                    type="button"
                    {disabled}
                >
                    <span class="website-name">{site.name}</span>
                    <span class="website-desc">{site.description}</span>
                </button>
            {/each}
        </div>
    </div>

    <div class="examples-section">
        <h4>💡 Common Examples</h4>
        <p class="help-text">Click any symbol below to use it quickly:</p>
        
        {#each symbolExamples as category}
            <div class="category-group">
                <h5>{category.category}</h5>
                <div class="symbols-grid">
                    {#each category.symbols as symbol}
                        <button
                            class="symbol-button"
                            on:click={() => selectExampleSymbol(symbol.symbol)}
                            class:selected={manualSymbol === symbol.symbol}
                            type="button"
                            {disabled}
                        >
                            <span class="symbol-code">{symbol.symbol}</span>
                            <span class="symbol-name">{symbol.name}</span>
                        </button>
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    {#if showPreview}
        <div class="preview-section">
            <h4>📋 Configuration Preview</h4>
            <div class="preview-details">
                <div class="preview-row">
                    <span class="preview-label">Symbol:</span>
                    <span class="preview-value">{manualSymbol.toUpperCase()}</span>
                </div>
                <div class="preview-row">
                    <span class="preview-label">Price Metadata:</span>
                    <code class="preview-metadata">{previewMetadata}</code>
                </div>
            </div>

            <div class="action-buttons">
                <button 
                    class="apply-button" 
                    on:click={handleApply}
                    {disabled}
                >
                    ✅ Apply Yahoo Source
                </button>
                <button 
                    class="cancel-button" 
                    on:click={handleCancel}
                    {disabled}
                >
                    ❌ Cancel
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .yahoo-finance-search {
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
    }

    .yahoo-finance-search.disabled {
        opacity: 0.6;
        pointer-events: none;
    }

    .current-source {
        margin-bottom: 1rem;
        padding: 0.5rem;
        background: var(--background-primary-alt);
        border-radius: 4px;
        font-size: 0.9rem;
    }

    .current-metadata {
        background: var(--background-modifier-form-field);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--font-monospace);
        color: var(--color-green);
    }

    .symbol-entry, .websites-section, .examples-section, .preview-section {
        margin-bottom: 1.5rem;
        padding: 1rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
    }

    h4 {
        margin: 0 0 1rem 0;
        color: var(--text-normal);
        font-size: 1.1rem;
        font-weight: 600;
    }

    h5 {
        margin: 0 0 0.5rem 0;
        color: var(--text-muted);
        font-size: 0.9rem;
        font-weight: 500;
    }

    .help-text {
        margin: 0 0 1rem 0;
        color: var(--text-muted);
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .symbol-input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 1rem;
        text-transform: uppercase;
    }

    .symbol-input:focus {
        outline: none;
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 2px var(--interactive-accent-hover);
    }

    .metadata-preview {
        margin-top: 0.75rem;
        padding: 0.5rem;
        background: var(--background-secondary);
        border-radius: 4px;
        font-size: 0.9rem;
        color: var(--text-muted);
    }

    .metadata-preview code {
        color: var(--text-accent);
        font-family: var(--font-monospace);
        font-weight: 500;
    }

    .websites-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 0.75rem;
    }

    .website-button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 1rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
        color: var(--text-normal);
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .website-button:hover {
        background: var(--background-modifier-hover);
        border-color: var(--interactive-accent);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .website-name {
        font-weight: 600;
        font-size: 1rem;
        color: var(--text-accent);
        margin-bottom: 0.5rem;
    }

    .website-desc {
        font-size: 0.85rem;
        color: var(--text-muted);
        line-height: 1.3;
    }

    .category-group {
        margin-bottom: 1.5rem;
    }

    .category-group:last-child {
        margin-bottom: 0;
    }

    .symbols-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.5rem;
    }

    .symbol-button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0.75rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-secondary);
        color: var(--text-normal);
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .symbol-button:hover {
        background: var(--background-modifier-hover);
        border-color: var(--interactive-accent);
    }

    .symbol-button.selected {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
    }

    .symbol-code {
        font-weight: 600;
        font-size: 0.95rem;
        font-family: var(--font-monospace);
        margin-bottom: 0.25rem;
    }

    .symbol-name {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.2;
    }

    .symbol-button.selected .symbol-name {
        color: var(--text-on-accent);
        opacity: 0.9;
    }

    .preview-section {
        background: var(--background-primary-alt);
        border-color: var(--color-accent);
    }

    .preview-details {
        margin-bottom: 1rem;
    }

    .preview-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .preview-label {
        color: var(--text-muted);
        font-weight: 500;
    }

    .preview-value {
        color: var(--text-normal);
        font-family: var(--font-monospace);
    }

    .preview-metadata {
        background: var(--background-modifier-form-field);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--font-monospace);
        color: var(--color-accent);
    }

    .action-buttons {
        display: flex;
        gap: 0.75rem;
    }

    .apply-button {
        flex: 1;
        padding: 0.75rem;
        background: var(--color-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        font-size: 0.9rem;
    }

    .apply-button:hover {
        background: var(--color-accent-hover);
    }

    .cancel-button {
        flex: 1;
        padding: 0.75rem;
        background: transparent;
        color: var(--text-muted);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .cancel-button:hover {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .websites-grid {
            grid-template-columns: 1fr;
        }
        
        .symbols-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        
        .action-buttons {
            flex-direction: column;
        }
        
        .website-button, .symbol-button {
            padding: 0.6rem;
        }
    }
</style>