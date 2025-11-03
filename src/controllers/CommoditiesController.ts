// src/controllers/CommoditiesController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
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
        this.setupReactivity();
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

        try {
            // Check if any commodities exist
            const commodityAvailabilityQuery = getPriceDataAvailabilityQuery();
            const commodityAvailabilityResult = await this.plugin.runQuery(commodityAvailabilityQuery);
            const hasCommodityData = this.parseCommodityAvailability(commodityAvailabilityResult);
            this.hasCommodityData.set(hasCommodityData);

            if (!hasCommodityData) {
                this.commodities.set([]);
                this.lastUpdated.set(new Date());
                return;
            }

            // Get all commodities with metadata and current prices
            const commoditiesQuery = getCommoditiesQuery();
            const commoditiesResult = await this.plugin.runQuery(commoditiesQuery);
            const commodities = this.parseCommoditiesResult(commoditiesResult);

            // Sort by symbol
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
        try {
            const commodityQuery = getCommodityDetailsQuery(symbol);
            const commodityResult = await this.plugin.runQuery(commodityQuery);
            const commodityDetails = this.parseCommodityDetails(commodityResult);

            // Update the selected commodity with detailed info
            this.selectedCommodity.update(current => {
                if (current?.symbol === symbol && commodityDetails) {
                    return { ...current, ...commodityDetails };
                }
                return current;
            });

        } catch (error) {
            console.warn('Could not load commodity details for', symbol, ':', error);
        }
    }

    /**
     * Set the selected commodity and load its details
     */
    public async selectCommodity(commodity: CommodityInfo): Promise<void> {
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

            // TODO: Implement actual Beancount file modification
            // This would involve calling a backend service or direct file manipulation
            console.log(`Updated ${symbol} with Yahoo Finance source: ${priceMetadata}`);
            
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

            console.log(`Removed price metadata for ${symbol}`);
            
        } catch (error) {
            console.error('Error removing price metadata:', error);
            this.loading.set(false);
            this.error.set(`Failed to remove price metadata: ${error.message}`);
        }
    }
}