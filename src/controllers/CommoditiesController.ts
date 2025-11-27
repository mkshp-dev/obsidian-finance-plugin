// src/controllers/CommoditiesController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import { BackendManager } from '../backend/BackendManager';

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
}