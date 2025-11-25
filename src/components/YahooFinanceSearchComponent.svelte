<!-- src/components/YahooFinanceSearchComponent.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let selectedSymbol: string = '';
    export let currentPriceMetadata: string = '';
    export let disabled: boolean = false;

    const dispatch = createEventDispatcher<{
        apply: { symbol: string; metadata: string };
        cancel: void;
    }>();

    let manualSymbol = selectedSymbol || '';

    // Simple preview: use explicit currentPriceMetadata if provided, otherwise derive a nominal preview
    $: previewMetadata = currentPriceMetadata && currentPriceMetadata.trim().length > 0
        ? currentPriceMetadata
        : (manualSymbol ? `${manualSymbol.toUpperCase()}:yahoo/${manualSymbol.toUpperCase()}` : '');

    function handleApply() {
        dispatch('apply', { symbol: manualSymbol.toUpperCase(), metadata: previewMetadata });
    }

    function handleCancel() {
        dispatch('cancel');
    }
</script>

<div class="yahoo-finance-search {disabled ? 'disabled' : ''}">
    <div class="current-source">
        <span class="label">Current source:</span>
        <code class="current-metadata">{currentPriceMetadata || '—'}</code>
    </div>

    <!-- Symbol lookup removed: simplified UI only -->
    <div class="symbol-entry">
        <input
            type="text"
            bind:value={manualSymbol}
            placeholder="Enter symbol (e.g., AAPL, GOOGL, SPY)"
            class="symbol-input"
            {disabled}
        />
    </div>

    <div class="preview-section">
        <h4>📋 Configuration Preview</h4>
        <div class="preview-details">
            <div class="preview-row">
                <span class="preview-label">Symbol:</span>
                <span class="preview-value">{manualSymbol ? manualSymbol.toUpperCase() : '—'}</span>
            </div>
            <div class="preview-row">
                <span class="preview-label">Price Metadata:</span>
                <code class="preview-metadata">{previewMetadata}</code>
            </div>
        </div>
        <div class="action-buttons">
            <button class="apply-button" on:click={handleApply} {disabled}>✅ Apply</button>
            <button class="cancel-button" on:click={handleCancel} {disabled}>❌ Cancel</button>
        </div>
    </div>
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
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.5rem;
    }

    .website-button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0.75rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
        color: var(--text-normal);
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: auto;
    }

    .website-button:hover {
        background: var(--background-modifier-hover);
        border-color: var(--interactive-accent);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .website-name {
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--text-accent);
        margin-bottom: 0.25rem;
    }

    .website-desc {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.2;
    }

    .category-group {
        margin-bottom: 1.5rem;
    }

    .category-group:last-child {
        margin-bottom: 0;
    }

    .symbols-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.4rem;
    }

    .symbol-button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0.5rem 0.6rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-secondary);
        color: var(--text-normal);
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: auto;
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
        font-size: 0.85rem;
        font-family: var(--font-monospace);
        margin-bottom: 0.1rem;
    }

    .symbol-name {
        font-size: 0.75rem;
        color: var(--text-muted);
        line-height: 1.1;
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
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        }
        
        .action-buttons {
            flex-direction: column;
        }
        
        .website-button, .symbol-button {
            padding: 0.5rem;
        }

        .website-name {
            font-size: 0.9rem;
        }

        .website-desc {
            font-size: 0.75rem;
        }
    }
</style>