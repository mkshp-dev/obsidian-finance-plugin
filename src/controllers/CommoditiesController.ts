// src/controllers/CommoditiesController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import { BackendManager } from '../backend/BackendManager';
import { 
    getCommoditiesQuery, 
    getCommodityDetailsQuery,
    getPriceDataAvailabilityQuery
} from '../queries/index';

export interface CommodityInfo {
    symbol: string;
    hasPriceMetadata: boolean;
    priceMetadata?: string;
    fullMetadata: Record<string, any>;
    currentPrice?: string; // Latest price from getprice()
    metadata?: Record<string, any>;
}

export interface CommoditiesState {
    commodities: CommodityInfo[];
    selectedCommodity: CommodityInfo | null;
    searchTerm: string;
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    hasCommodityData: boolean;
}

export class CommoditiesController {
    private plugin: BeancountPlugin;
    private backendManager: BackendManager;
    
    // Reactive stores
    public commodities: Writable<CommodityInfo[]> = writable([]);
    public selectedCommodity: Writable<CommodityInfo | null> = writable(null);
    public searchTerm: Writable<string> = writable('');
    public loading: Writable<boolean> = writable(false);
    public error: Writable<string | null> = writable(null);
    public lastUpdated: Writable<Date | null> = writable(null);
    public hasCommodityData: Writable<boolean> = writable(false);

    // Derived stores for filtering
    public filteredCommodities: Writable<CommodityInfo[]> = writable([]);

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
        this.backendManager = new BackendManager(plugin);
        this.setupReactivity();
        console.debug('[CommoditiesController] initialized');
    }

    private setupReactivity() {
        // Update filtered commodities when search term or commodities change
        let currentCommodities: CommodityInfo[] = [];
        let currentSearchTerm = '';

        this.commodities.subscribe(value => {
            currentCommodities = value;
            this.updateFilteredCommodities(currentCommodities, currentSearchTerm);
        });

        this.searchTerm.subscribe(value => {
            currentSearchTerm = value;
            this.updateFilteredCommodities(currentCommodities, currentSearchTerm);
        });
    }

    private updateFilteredCommodities(commodities: CommodityInfo[], searchTerm: string) {
        if (!searchTerm.trim()) {
            this.filteredCommodities.set(commodities);
            return;
        }

        const filtered = commodities.filter(commodity =>
            commodity.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.filteredCommodities.set(filtered);
    }

    /**
     * Load all commodities data
     */
    public async loadData(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        console.debug('[CommoditiesController] loadData: starting');
        try {
            // Use backend API for detailed commodity data
            const connected = await this.backendManager.ensureBackendRunning();
            console.debug('[CommoditiesController] ensureBackendRunning ->', connected);
            if (!connected) {
                throw new Error('Failed to start Python backend for commodities');
            }

            const resp = await this.backendManager.apiRequest('/commodities?detailed=true');
            console.debug('[CommoditiesController] loadData: apiRequest /commodities?detailed=true status ->', resp.status);
            if (!resp.ok) {
                throw new Error(`Failed to fetch commodities: ${resp.status}`);
            }

            const data = await resp.json();
            console.debug('[CommoditiesController] loadData: received data', data && { count: (data.commodities || []).length });
            const commoditiesRaw = data.commodities || [];

            // Map into CommodityInfo shape
            const commodities = (commoditiesRaw as any[]).map(c => ({
                symbol: c.symbol,
                hasPriceMetadata: !!c.price_meta,
                priceMetadata: c.price_meta || undefined,
                fullMetadata: c.metadata || {},
                // Alias for compatibility with existing modal component
                metadata: c.metadata || {},
                currentPrice: c.latest_price || undefined
            } as CommodityInfo));

            commodities.sort((a, b) => a.symbol.localeCompare(b.symbol));
            this.commodities.set(commodities);
            this.lastUpdated.set(new Date());

        } catch (error) {
            console.error('Error loading commodities data:', error);
            this.error.set(error instanceof Error ? error.message : 'Failed to load commodities data');
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Load detailed information for a specific commodity
     */
    public async loadCommodityDetails(symbol: string): Promise<void> {
        console.debug('[CommoditiesController] loadCommodityDetails:', symbol);
        try {
            const connected = await this.backendManager.ensureBackendRunning();
            console.debug('[CommoditiesController] loadCommodityDetails ensureBackendRunning ->', connected);
            if (!connected) throw new Error('Backend not available');

            const resp = await this.backendManager.apiRequest(`/commodities/${encodeURIComponent(symbol)}`);
            console.debug('[CommoditiesController] loadCommodityDetails: apiRequest status ->', resp.status);
            if (!resp.ok) {
                console.warn('Could not load commodity details for', symbol, ':', resp.statusText);
                return;
            }

            const details = await resp.json();
            console.debug('[CommoditiesController] loadCommodityDetails: details ->', details);
            this.selectedCommodity.set({
                symbol: details.symbol,
                hasPriceMetadata: !!details.price_meta,
                priceMetadata: details.price_meta || undefined,
                fullMetadata: details.metadata || {},
                // Provide `metadata` alias for modal compatibility
                metadata: details.metadata || {},
                currentPrice: details.latest_price || undefined
            });

        } catch (error) {
            console.warn('Could not load commodity details for', symbol, ':', error);
        }
    }

    /**
     * Save metadata (creates or updates commodity directive)
     */
    public async saveMetadata(symbol: string, metadata: Record<string, any>): Promise<boolean | any> {
        this.loading.set(true);
        this.error.set(null);
        try {
            console.debug('[CommoditiesController] saveMetadata:', { symbol, metadata });
            const connected = await this.backendManager.ensureBackendRunning();
            console.debug('[CommoditiesController] saveMetadata ensureBackendRunning ->', connected);
            if (!connected) throw new Error('Backend not available');

            const resp = await this.backendManager.apiRequest(`/commodities/${encodeURIComponent(symbol)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metadata })
            });

            console.debug('[CommoditiesController] saveMetadata: response status ->', resp.status);
            const result = await resp.json();
            console.debug('[CommoditiesController] saveMetadata: result ->', result);

            if (!resp.ok || !result.success) {
                const err = new Error(result.error || `Failed to save metadata (${resp.status})`);
                // Attach full backend payload for richer diagnostics in the catch block
                try { (err as any).payload = result; } catch {}
                throw err;
            }

            // Refresh list and selected commodity
            await this.loadData();
            await this.loadCommodityDetails(symbol);
            return result;
        } catch (error) {
            // Log full error and any attached backend payload for diagnostics
            console.error('Error saving commodity metadata:', error);
            let msg = 'Failed to save metadata';
            if (error instanceof Error) {
                msg = error.message || msg;
                const payload = (error as any)?.payload;
                if (payload) {
                    try {
                        // Include concise payload info when available
                        msg = `${msg} — ${JSON.stringify(payload)}`;
                    } catch {
                        // ignore stringify errors
                    }
                }
            } else {
                try { msg = JSON.stringify(error); } catch { /* ignore */ }
            }

            this.error.set(msg);
            return false;
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Test price source using backend bean-price validation
     */
    public async testPriceSource(symbol: string): Promise<any> {
        this.loading.set(true);
        this.error.set(null);
        try {
            const current = get(this.selectedCommodity) || this.getCommodityBySymbol(symbol);
            const priceMeta = current?.priceMetadata || (current?.fullMetadata || {})['price'];
            console.debug('[CommoditiesController] testPriceSource:', { symbol, priceMeta });
            const connected = await this.backendManager.ensureBackendRunning();
            console.debug('[CommoditiesController] testPriceSource ensureBackendRunning ->', connected);
            if (!connected) throw new Error('Backend not available');

            const resp = await this.backendManager.apiRequest(`/commodities/${encodeURIComponent(symbol)}/validate_price`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price: priceMeta })
            });

            const result = await resp.json();
            console.debug('[CommoditiesController] testPriceSource result ->', result);
            return result;
        } catch (error) {
            console.error('Error testing price source:', error);
            this.error.set(error instanceof Error ? error.message : 'Failed to test price source');
            return { success: false, error: String(error) };
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Test logo URL via backend
     */
    public async testLogoUrl(symbol: string, url: string): Promise<any> {
        console.debug('[CommoditiesController] testLogoUrl:', { symbol, url });
        try {
            const connected = await this.backendManager.ensureBackendRunning();
            console.debug('[CommoditiesController] testLogoUrl ensureBackendRunning ->', connected);
            if (!connected) throw new Error('Backend not available');

            const resp = await this.backendManager.apiRequest(`/commodities/${encodeURIComponent(symbol)}/validate_logo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const result = await resp.json();
            console.debug('[CommoditiesController] testLogoUrl result ->', result);
            return result;
        } catch (error) {
            console.error('Error testing logo URL:', error);
            return { success: false, error: String(error) };
        }
    }

    private getCommodityBySymbol(symbol: string): CommodityInfo | undefined {
        const list = get(this.commodities);
        return list.find(c => c.symbol === symbol);
    }

    /**
     * Set the selected commodity and load its details
     */
    public async selectCommodity(commodity: CommodityInfo): Promise<void> {
        console.debug('[CommoditiesController] selectCommodity ->', commodity?.symbol);
        this.selectedCommodity.set(commodity);
        await this.loadCommodityDetails(commodity.symbol);
    }

    /**
     * Clear the selected commodity
     */
    public clearSelection(): void {
        this.selectedCommodity.set(null);
    }

    /**
     * Update search term
     */
    public setSearchTerm(term: string): void {
        this.searchTerm.set(term);
    }

    /**
     * Refresh all data
     */
    public async refresh(): Promise<void> {
        await this.loadData();
    }

    // Parsing methods
    private parseCommoditiesResult(result: string): CommodityInfo[] {
        const commodities: CommodityInfo[] = [];
        const lines = result.trim().split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.includes('name,meta')) { // Skip header
                
                // Split by comma, but handle quoted values and complex metadata
                const parts = this.parseCSVLine(line);
                
                if (parts.length >= 4) {
                    // New query format: name, meta, meta('price'), getprice(name, 'INR')
                    const symbol = (parts[0] || '').replace(/"/g, '');
                    const fullMetadataStr = (parts[1] || '').replace(/"/g, '');
                    const priceMetadata = (parts[2] || '').replace(/"/g, '');
                    const currentPrice = (parts[3] || '').replace(/"/g, '');
                    
                    // Parse metadata
                    let fullMetadata: Record<string, any> = {};
                    try {
                        if (fullMetadataStr && fullMetadataStr !== '{}' && fullMetadataStr !== '') {
                            // Parse Python dict-like string to JSON
                            const jsonStr = fullMetadataStr
                                .replace(/'/g, '"')
                                .replace(/\{([^}]+)\}/g, (match, content) => {
                                    return `{${content}}`;
                                });
                            fullMetadata = JSON.parse(jsonStr);
                        }
                    } catch (error) {
                        console.warn('Could not parse metadata for', symbol, ':', fullMetadataStr, error);
                        fullMetadata = { raw: fullMetadataStr };
                    }
                    
                    const commodity: CommodityInfo = {
                        symbol: symbol || 'UNKNOWN',
                        hasPriceMetadata: !!priceMetadata && priceMetadata !== '' && priceMetadata !== 'None',
                        priceMetadata: (priceMetadata && priceMetadata !== '' && priceMetadata !== 'None') ? priceMetadata : undefined,
                        fullMetadata,
                        currentPrice: (currentPrice && currentPrice !== '' && currentPrice !== 'None') ? 
                            this.formatPriceWithCurrency(currentPrice) : undefined
                    };
                    
                    commodities.push(commodity);
                } else {
                    console.warn('Insufficient parts in line:', line, 'parts:', parts);
                }
            }
        }
        
        return commodities;
    }

    private formatPriceWithCurrency(price: string): string {
        // If the price already contains currency info, return as is
        if (!price || price === 'None' || price === '') {
            return price;
        }
        
        // Check if price already has currency (contains letters)
        if (/[a-zA-Z]/.test(price)) {
            return price;
        }
        
        // If it's just a number, append INR (since we're querying with INR)
        const numericPrice = parseFloat(price);
        if (!isNaN(numericPrice)) {
            return `${numericPrice.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 4 
            })} INR`;
        }
        
        return price;
    }

    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
            i++;
        }
        
        // Add the last field
        result.push(current.trim());
        
        return result;
    }

    private parseHoldingsResult(result: string): Map<string, number> {
        const holdingsMap = new Map<string, number>();
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
            if (line.trim() && !line.includes('account,currency')) { // Skip header
                const parts = line.trim().split(',');
                if (parts.length >= 3) {
                    const currency = parts[1].trim().replace(/"/g, '');
                    const number = parseFloat(parts[2].trim()) || 0;
                    
                    // Aggregate holdings for each currency
                    const existing = holdingsMap.get(currency) || 0;
                    holdingsMap.set(currency, existing + number);
                }
            }
        }
        
        // Filter out very small amounts (likely rounding errors)
        const filteredMap = new Map<string, number>();
        for (const [currency, amount] of holdingsMap.entries()) {
            if (Math.abs(amount) > 0.001) {
                filteredMap.set(currency, amount);
            }
        }
        
        return filteredMap;
    }

    private parseCommodityAvailability(result: string): boolean {
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
            if (line.trim() && !line.includes('commodity_count')) { // Skip header
                const count = parseInt(line.trim()) || 0;
                return count > 0;
            }
        }
        
        return false;
    }

    private parseCommodityDetails(result: string): Partial<CommodityInfo> | null {
        // For detailed view, we can get more specific metadata
        const lines = result.trim().split('\n');
        
        for (const line of lines) {
            if (line.trim() && !line.includes('name,meta')) { // Skip header
                const parts = this.parseCSVLine(line);
                if (parts.length >= 4) {
                    const symbol = parts[0].trim().replace(/"/g, '');
                    const fullMetadataStr = parts[1].trim().replace(/"/g, '');
                    const priceMetadata = parts[2].trim().replace(/"/g, '');
                    const currentPrice = parts[3].trim().replace(/"/g, '');
                    
                    let fullMetadata: Record<string, any> = {};
                    try {
                        if (fullMetadataStr && fullMetadataStr !== '{}') {
                            const jsonStr = fullMetadataStr.replace(/'/g, '"');
                            fullMetadata = JSON.parse(jsonStr);
                        }
                    } catch (error) {
                        fullMetadata = { raw: fullMetadataStr };
                    }
                    
                    return {
                        symbol,
                        hasPriceMetadata: !!priceMetadata && priceMetadata !== '' && priceMetadata !== 'None',
                        priceMetadata: (priceMetadata && priceMetadata !== '' && priceMetadata !== 'None') ? priceMetadata : undefined,
                        fullMetadata,
                        currentPrice: (currentPrice && currentPrice !== '' && currentPrice !== 'None') ? 
                            this.formatPriceWithCurrency(currentPrice) : undefined
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Update price metadata for a commodity using Yahoo Finance source
     * @param symbol Commodity symbol to update
     * @param yahooSymbol Yahoo Finance symbol
     * @param currency Currency for the price metadata (default: USD)
     */
    async updatePriceMetadata(symbol: string, yahooSymbol: string, currency: string = 'USD'): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Generate the price metadata string
            const priceMetadata = `${currency}:yahoo/${yahooSymbol.toUpperCase()}`;
            
            // Get current commodities and selected commodity
            const currentCommodities = get(this.commodities);
            const currentSelectedCommodity = get(this.selectedCommodity);
            
            // Here we would call the backend to update the Beancount file
            // For now, we'll simulate this by updating our local state
            // In a real implementation, this would modify the commodity directive in the Beancount file
            
            // Update the commodity in our local state
            const updatedCommodities = currentCommodities.map((commodity: CommodityInfo) => {
                if (commodity.symbol === symbol) {
                    return {
                        ...commodity,
                        hasPriceMetadata: true,
                        priceMetadata: priceMetadata,
                        fullMetadata: {
                            ...commodity.fullMetadata,
                            price: priceMetadata
                        }
                    };
                }
                return commodity;
            });

            // Update selected commodity if it matches
            let updatedSelectedCommodity = currentSelectedCommodity;
            if (currentSelectedCommodity && currentSelectedCommodity.symbol === symbol) {
                updatedSelectedCommodity = {
                    ...currentSelectedCommodity,
                    hasPriceMetadata: true,
                    priceMetadata: priceMetadata,
                    fullMetadata: {
                        ...currentSelectedCommodity.fullMetadata,
                        price: priceMetadata
                    }
                };
                this.selectedCommodity.set(updatedSelectedCommodity);
            }

            // Update stores
            this.commodities.set(updatedCommodities);
            this.loading.set(false);


            
        } catch (error) {
            console.error('Error updating price metadata:', error);
            this.loading.set(false);
            this.error.set(`Failed to update price metadata: ${error.message}`);
        }
    }

    /**
     * Remove price metadata for a commodity
     * @param symbol Commodity symbol
     */
    async removePriceMetadata(symbol: string): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Get current commodities and selected commodity
            const currentCommodities = get(this.commodities);
            const currentSelectedCommodity = get(this.selectedCommodity);
            
            // Update the commodity in our local state
            const updatedCommodities = currentCommodities.map((commodity: CommodityInfo) => {
                if (commodity.symbol === symbol) {
                    const { price, ...remainingMetadata } = commodity.fullMetadata;
                    return {
                        ...commodity,
                        hasPriceMetadata: false,
                        priceMetadata: undefined,
                        fullMetadata: remainingMetadata
                    };
                }
                return commodity;
            });

            // Update selected commodity if it matches
            let updatedSelectedCommodity = currentSelectedCommodity;
            if (currentSelectedCommodity && currentSelectedCommodity.symbol === symbol) {
                const { price, ...remainingMetadata } = currentSelectedCommodity.fullMetadata;
                updatedSelectedCommodity = {
                    ...currentSelectedCommodity,
                    hasPriceMetadata: false,
                    priceMetadata: undefined,
                    fullMetadata: remainingMetadata
                };
                this.selectedCommodity.set(updatedSelectedCommodity);
            }

            // Update stores
            this.commodities.set(updatedCommodities);
            this.loading.set(false);


            
        } catch (error) {
            console.error('Error removing price metadata:', error);
            this.loading.set(false);
            this.error.set(`Failed to remove price metadata: ${error.message}`);
        }
    }
}