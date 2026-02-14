<!-- src/ui/modals/CommodityCreateModal.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    // Form state
    let symbol: string = '';
    let date: string = new Date().toISOString().split('T')[0]; // Today's date
    let priceMetadata: string = '';
    let logoUrl: string = '';

    // UI state
    let symbolError: string = '';
    let testingPrice: boolean = false;
    let testingLogo: boolean = false;
    let priceTestResult: string = '';
    let logoTestResult: string = '';
    let logoPreview: string = '';

    // Validation
    function validateSymbol(value: string): boolean {
        if (!value) {
            symbolError = 'Symbol is required';
            return false;
        }
        if (!/^[A-Z0-9._-]+$/i.test(value)) {
            symbolError = 'Use alphanumeric characters, dots, underscores, or hyphens';
            return false;
        }
        symbolError = '';
        return true;
    }

    function handleSymbolInput(e: Event) {
        const target = e.target as HTMLInputElement;
        symbol = target.value.toUpperCase();
        validateSymbol(symbol);
    }

    function handleLogoInput(e: Event) {
        const target = e.target as HTMLInputElement;
        logoUrl = target.value;
        logoPreview = logoUrl; // Update preview
    }

    function handleLogoError() {
        logoPreview = ''; // Hide broken image
    }

    async function testPrice() {
        if (!priceMetadata.trim()) {
            priceTestResult = 'Please enter a price source';
            return;
        }
        
        testingPrice = true;
        priceTestResult = 'Testing...';
        
        try {
            dispatch('test-price', { symbol, priceMetadata });
            // Result will be handled by parent
        } catch (error) {
            priceTestResult = 'Test failed';
        } finally {
            testingPrice = false;
        }
    }

    async function testLogo() {
        if (!logoUrl.trim()) {
            logoTestResult = 'Please enter a logo URL';
            return;
        }
        
        testingLogo = true;
        logoTestResult = 'Testing...';
        
        try {
            dispatch('test-logo', { symbol, url: logoUrl });
            // Result will be handled by parent
        } catch (error) {
            logoTestResult = 'Test failed';
        } finally {
            testingLogo = false;
        }
    }

    function handleSave() {
        if (!validateSymbol(symbol)) {
            return;
        }
        
        dispatch('save', {
            symbol: symbol.toUpperCase(),
            date,
            priceMetadata: priceMetadata.trim() || undefined,
            logoUrl: logoUrl.trim() || undefined
        });
    }

    function handleCancel() {
        dispatch('cancel');
    }
</script>

<div class="commodity-create-modal">
    <h2>Add New Commodity</h2>

    <div class="form-group">
        <label for="symbol">
            Symbol <span class="required">*</span>
        </label>
        <input
            id="symbol"
            type="text"
            bind:value={symbol}
            on:input={handleSymbolInput}
            placeholder="BTC, AAPL, USD..."
            class:error={symbolError}
            required
        />
        {#if symbolError}
            <div class="error-message">{symbolError}</div>
        {/if}
        <div class="hint">Uppercase alphanumeric recommended (e.g., BTC, AAPL)</div>
    </div>

    <div class="form-group">
        <label for="date">
            Date <span class="required">*</span>
        </label>
        <input
            id="date"
            type="date"
            bind:value={date}
            required
        />
        <div class="hint">Date when the commodity was first introduced</div>
    </div>

    <div class="form-group">
        <label for="priceMetadata">
            Price Source <span class="optional">(optional)</span>
        </label>
        <div class="input-with-button">
            <input
                id="priceMetadata"
                type="text"
                bind:value={priceMetadata}
                placeholder="yahoo/AAPL, USD, coinbase/BTC-USD..."
            />
            <button
                on:click={testPrice}
                disabled={testingPrice || !priceMetadata.trim()}
                class="test-button"
            >
                {testingPrice ? '⏳' : '🧪'} Test
            </button>
        </div>
        {#if priceTestResult}
            <div class="test-result">{priceTestResult}</div>
        {/if}
        <div class="hint">Price source for automated price fetching (e.g., yahoo/AAPL)</div>
    </div>

    <div class="form-group">
        <label for="logoUrl">
            Logo URL <span class="optional">(optional)</span>
        </label>
        <div class="input-with-button">
            <input
                id="logoUrl"
                type="url"
                bind:value={logoUrl}
                on:input={handleLogoInput}
                placeholder="https://logo.clearbit.com/bitcoin.org"
            />
            <button
                on:click={testLogo}
                disabled={testingLogo || !logoUrl.trim()}
                class="test-button"
            >
                {testingLogo ? '⏳' : '🧪'} Test
            </button>
        </div>
        {#if logoTestResult}
            <div class="test-result">{logoTestResult}</div>
        {/if}
        {#if logoPreview}
            <div class="logo-preview">
                <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    on:error={handleLogoError}
                />
            </div>
        {/if}
        <div class="hint">URL to commodity logo image (will be displayed in UI)</div>
    </div>

    <div class="button-group">
        <button on:click={handleCancel} class="cancel-button">
            Cancel
        </button>
        <button 
            on:click={handleSave} 
            class="save-button"
            disabled={!symbol || !!symbolError}
        >
            Create Commodity
        </button>
    </div>
</div>

<style>
    .commodity-create-modal {
        padding: 20px;
        max-width: 600px;
    }

    h2 {
        margin: 0 0 20px 0;
        color: var(--text-normal);
    }

    .form-group {
        margin-bottom: 20px;
    }

    label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: var(--text-normal);
    }

    .required {
        color: var(--text-error);
    }

    .optional {
        color: var(--text-muted);
        font-weight: normal;
        font-size: 0.9em;
    }

    input[type="text"],
    input[type="date"],
    input[type="url"] {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;
        font-family: inherit;
    }

    input.error {
        border-color: var(--text-error);
    }

    .error-message {
        margin-top: 4px;
        color: var(--text-error);
        font-size: 0.85em;
    }

    .hint {
        margin-top: 4px;
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .input-with-button {
        display: flex;
        gap: 8px;
    }

    .input-with-button input {
        flex: 1;
    }

    .test-button {
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 14px;
        white-space: nowrap;
    }

    .test-button:hover:not(:disabled) {
        background: var(--background-modifier-hover);
    }

    .test-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .test-result {
        margin-top: 4px;
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .logo-preview {
        margin-top: 8px;
        padding: 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-secondary);
        text-align: center;
    }

    .logo-preview img {
        max-width: 100px;
        max-height: 100px;
        object-fit: contain;
    }

    .button-group {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid var(--background-modifier-border);
    }

    button {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .cancel-button {
        background: var(--background-secondary);
        color: var(--text-normal);
    }

    .cancel-button:hover {
        background: var(--background-modifier-hover);
    }

    .save-button {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .save-button:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    .save-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
