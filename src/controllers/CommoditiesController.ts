// src/controllers/CommoditiesController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { 
    parseCommoditiesListCSV, 
    parseCommoditiesPriceDataCSV, 
    parseCommodityDetailsCSV,
    validatePriceSource,
    validateLogoUrl,
    saveCommodityMetadata
} from '../utils/index';

/**
 * Interface representing metadata and state of a single commodity.
 */
export interface CommodityInfo {
    /** The commodity symbol (e.g. "USD", "AAPL"). */
    symbol: string;
    /** Whether explicit price metadata exists for this commodity. */
    hasPriceMetadata: boolean;
    /** The price metadata string (e.g. "yahoo/AAPL") if exists. */
    priceMetadata?: string;
    /** Complete metadata dictionary from Beancount. */
    fullMetadata: Record<string, any>;
    /** Latest price information if available. */
    currentPrice?: string;
    /** Alias for fullMetadata for UI compatibility. */
    metadata?: Record<string, any>;
    /** Logo URL from commodity metadata. */
    logoUrl?: string | null;
    /** Whether the price is latest (updated within last day). */
    isPriceLatest?: boolean;
}

/**
 * Interface representing the state of the Commodities view.
 */
export interface CommoditiesState {
    /** List of all loaded commodities. */
    commodities: CommodityInfo[];
    /** The currently selected commodity for detailed view. */
    selectedCommodity: CommodityInfo | null;
    /** Current search filter string. */
    searchTerm: string;
    /** Whether data is loading. */
    loading: boolean;
    /** Error message if loading/saving failed. */
    error: string | null;
    /** Timestamp of last data update. */
    lastUpdated: Date | null;
    /** Whether any commodity data exists. */
    hasCommodityData: boolean;
}

/**
 * CommoditiesController
 *
 * Manages the state and logic for the Commodities tab.
 * Handles loading commodity lists, fetching details (including prices and metadata),
 * creating/updating commodity definitions, and validating price sources/logo URLs.
 */
export class CommoditiesController {
    private plugin: BeancountPlugin;
    
    // Reactive stores
    /** Store for the full list of commodities. */
    public commodities: Writable<CommodityInfo[]> = writable([]);
    /** Store for the currently selected commodity. */
    public selectedCommodity: Writable<CommodityInfo | null> = writable(null);
    /** Store for the search term. */
    public searchTerm: Writable<string> = writable('');
    /** Store for loading state. */
    public loading: Writable<boolean> = writable(false);
    /** Store for error messages. */
    public error: Writable<string | null> = writable(null);
    /** Store for last update timestamp. */
    public lastUpdated: Writable<Date | null> = writable(null);
    /** Store indicating if any data is present. */
    public hasCommodityData: Writable<boolean> = writable(false);

    // Derived stores for filtering
    /** Store containing commodities filtered by the search term. */
    public filteredCommodities: Writable<CommodityInfo[]> = writable([]);

    /**
     * Creates an instance of CommoditiesController.
     * @param {BeancountPlugin} plugin - The main plugin instance.
     */
    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
        this.setupReactivity();
        console.debug('[CommoditiesController] initialized');
    }

    /**
     * Sets up reactive subscriptions to update filtered lists automatically.
     */
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

    /**
     * Updates the filteredCommodities store based on the search term.
     * @param {CommodityInfo[]} commodities - The full list.
     * @param {string} searchTerm - The search term.
     */
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
     * Load all commodities data using BQL queries.
     * Fetches commodity list and price data, then merges them.
     */
    public async loadData(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        console.debug('[CommoditiesController] loadData: starting');
        try {
            // Get operating currency from settings
            const operatingCurrency = this.plugin.settings.operatingCurrency || 'USD';
            
            // Execute both queries in parallel
            const [commoditiesCSV, priceDataCSV] = await Promise.all([
                this.plugin.runQuery(queries.getAllCommoditiesQuery()),
                this.plugin.runQuery(queries.getCommoditiesPriceDataQuery(operatingCurrency))
            ]);
            
            console.debug('[CommoditiesController] loadData: received CSV data');
            
            // Parse CSV results
            const allSymbols = parseCommoditiesListCSV(commoditiesCSV);
            const priceDataMap = parseCommoditiesPriceDataCSV(priceDataCSV);
            
            console.debug('[CommoditiesController] parsed', allSymbols.length, 'commodities and', priceDataMap.size, 'price entries');
            
            // Merge data: iterate all commodities and enrich with price data
            const commodities: CommodityInfo[] = allSymbols.map(symbol => {
                const priceData = priceDataMap.get(symbol);
                
                return {
                    symbol,
                    hasPriceMetadata: !!(priceData?.logo || priceData?.price),
                    priceMetadata: priceData?.logo || undefined,
                    fullMetadata: {
                        ...(priceData?.logo ? { logo: priceData.logo } : {}),
                    },
                    metadata: {
                        ...(priceData?.logo ? { logo: priceData.logo } : {}),
                    },
                    currentPrice: priceData?.price ? `${priceData.price} ${operatingCurrency}` : undefined,
                    logoUrl: priceData?.logo || null,
                    isPriceLatest: priceData?.isLatest || false
                } as CommodityInfo;
            });

            commodities.sort((a, b) => a.symbol.localeCompare(b.symbol));
            this.commodities.set(commodities);
            this.lastUpdated.set(new Date());
            
            // Update hasCommodityData flag based on loaded commodities
            this.hasCommodityData.set(commodities.length > 0);

        } catch (error) {
            console.error('Error querying commodities via BQL:', error);
            this.error.set(error instanceof Error ? error.message : 'Failed to query commodities from ledger');
            this.hasCommodityData.set(false);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Load detailed information for a specific commodity by symbol using BQL.
     * Updates selectedCommodity store.
     * @param {string} symbol - The commodity symbol.
     */
    public async loadCommodityDetails(symbol: string): Promise<void> {
        console.debug('[CommoditiesController] loadCommodityDetails:', symbol);
        try {
            const detailsCSV = await this.plugin.runQuery(queries.getCommodityDetailsQuery(symbol));
            const details = parseCommodityDetailsCSV(detailsCSV);
            
            console.debug('[CommoditiesController] loadCommodityDetails: parsed ->', details);
            
            this.selectedCommodity.set({
                symbol: details.symbol || symbol,
                hasPriceMetadata: !!details.priceMetadata,
                priceMetadata: details.priceMetadata || undefined,
                fullMetadata: details.metadata,
                metadata: details.metadata,
                currentPrice: undefined,  // Detail query doesn't include current price
                filename: details.filename || undefined,
                lineno: details.lineno || undefined
            } as any);

        } catch (error) {
            console.warn('Failed to query commodity details via BQL for', symbol, ':', error);
        }
    }

    /**
     * Save metadata (creates or updates commodity directive in Beancount).
     * @param {string} symbol - The commodity symbol.
     * @param {Record<string, any>} metadata - The metadata key-value pairs.
     * @returns {Promise<boolean | any>} The result object or false on failure.
     */
    public async saveMetadata(symbol: string, metadata: Record<string, any>): Promise<boolean | any> {
        this.loading.set(true);
        this.error.set(null);
        try {
            console.debug('[CommoditiesController] saveMetadata:', { symbol, metadata });
            
            // Get file location from selected commodity
            const current = get(this.selectedCommodity);
            const filename = (current as any)?.filename;
            const lineno = (current as any)?.lineno;
            
            if (!filename || !lineno) {
                throw new Error('Commodity location not available. Please reload the commodity details.');
            }

            // Use native TypeScript save function (no backend needed!)
            const createBackup = this.plugin.settings.createBackups ?? true;
            const result = await saveCommodityMetadata(symbol, metadata, filename, lineno, createBackup);

            console.debug('[CommoditiesController] saveMetadata: result ->', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to save metadata');
            }

            // Refresh list and selected commodity
            await this.loadData();
            await this.loadCommodityDetails(symbol);
            return result;
        } catch (error) {
            console.error('Error saving commodity metadata:', error);
            const msg = error instanceof Error ? error.message : 'Failed to save metadata';
            this.error.set(msg);
            return false;
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Test price source string using native bean-price execution.
     * @param {string} symbol - The commodity symbol.
     * @returns {Promise<any>} The validation result.
     */
    public async testPriceSource(symbol: string): Promise<any> {
        this.loading.set(true);
        this.error.set(null);
        try {
            const current = get(this.selectedCommodity) || this.getCommodityBySymbol(symbol);
            const priceMeta = current?.priceMetadata || (current?.fullMetadata || {})['price'];
            console.debug('[CommoditiesController] testPriceSource:', { symbol, priceMeta });

            if (!priceMeta) {
                return { success: false, error: 'No price metadata found for commodity' };
            }

            // Use native TypeScript validation (no backend needed)
            const result = await validatePriceSource(this.plugin, priceMeta);

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
     * Validates a logo URL using native fetch (checks content type).
     * @param {string} symbol - The commodity symbol (for logging/context).
     * @param {string} url - The URL to test.
     * @returns {Promise<any>} The validation result.
     */
    public async testLogoUrl(symbol: string, url: string): Promise<any> {
        console.debug('[CommoditiesController] testLogoUrl:', { symbol, url });
        try {
            if (!url || url.trim() === '') {
                return { success: false, error: 'No URL provided' };
            }

            // Use native TypeScript validation (no backend needed)
            const result = await validateLogoUrl(url);

            console.debug('[CommoditiesController] testLogoUrl result ->', result);
            return result;
        } catch (error) {
            console.error('Error testing logo URL:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Helper to find a commodity in the current list by symbol.
     * @param {string} symbol - The symbol to find.
     * @returns {CommodityInfo | undefined} The commodity info.
     */
    private getCommodityBySymbol(symbol: string): CommodityInfo | undefined {
        const list = get(this.commodities);
        return list.find(c => c.symbol === symbol);
    }

    /**
     * Selects a commodity and loads its full details.
     * @param {CommodityInfo} commodity - The commodity to select.
     */
    public async selectCommodity(commodity: CommodityInfo): Promise<void> {
        console.debug('[CommoditiesController] selectCommodity ->', commodity?.symbol);
        this.selectedCommodity.set(commodity);
        await this.loadCommodityDetails(commodity.symbol);
    }

    /**
     * Clears the currently selected commodity.
     */
    public clearSelection(): void {
        this.selectedCommodity.set(null);
    }

    /**
     * Sets the search term.
     * @param {string} term - The new search term.
     */
    public setSearchTerm(term: string): void {
        this.searchTerm.set(term);
    }

    /**
     * Triggers a refresh of the commodity data.
     */
    public async refresh(): Promise<void> {
        await this.loadData();
    }
}
