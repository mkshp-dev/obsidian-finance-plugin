// src/services/YahooFinanceService.ts

export interface YahooSymbolResult {
    symbol: string;
    name: string;
    currentPrice?: number;
    currency: string;
    exchange?: string;
    type?: string;
}

export class YahooFinanceService {
    /**
     * Generate Beancount price metadata string
     * @param symbol Yahoo Finance symbol
     * @param currency Target currency (default: 'USD')
     */
    generatePriceMetadata(symbol: string, currency: string = 'USD'): string {
        return `${currency}:yahoo/${symbol.toUpperCase()}`;
    }

    /**
     * Get popular financial websites for symbol lookup
     */
    getFinancialWebsites(): Array<{name: string, url: string, description: string}> {
        return [
            {
                name: "Yahoo Finance",
                url: "https://finance.yahoo.com/",
                description: "Search for any stock, ETF, crypto, or mutual fund"
            },
            {
                name: "Google Finance",
                url: "https://www.google.com/finance/",
                description: "Quick symbol lookup and market data"
            },
            {
                name: "Bloomberg",
                url: "https://www.bloomberg.com/markets/",
                description: "Professional financial data and symbols"
            },
            {
                name: "MarketWatch",
                url: "https://www.marketwatch.com/",
                description: "Stock quotes and financial news"
            },
            {
                name: "Investing.com",
                url: "https://www.investing.com/",
                description: "Global markets and symbol search"
            },
            {
                name: "Morningstar",
                url: "https://www.morningstar.com/",
                description: "Mutual funds, ETFs, and stock analysis"
            }
        ];
    }

    /**
     * Get common symbol examples for reference
     */
    getCommonSymbols(): Array<{category: string, symbols: Array<{symbol: string, name: string}>}> {
        return [
            {
                category: "Popular Stocks",
                symbols: [
                    { symbol: "AAPL", name: "Apple Inc." },
                    { symbol: "GOOGL", name: "Alphabet Inc." },
                    { symbol: "MSFT", name: "Microsoft Corp." },
                    { symbol: "AMZN", name: "Amazon.com Inc." },
                    { symbol: "TSLA", name: "Tesla Inc." },
                    { symbol: "NVDA", name: "NVIDIA Corp." },
                    { symbol: "META", name: "Meta Platforms" },
                    { symbol: "NFLX", name: "Netflix Inc." }
                ]
            },
            {
                category: "ETFs",
                symbols: [
                    { symbol: "SPY", name: "SPDR S&P 500 ETF" },
                    { symbol: "QQQ", name: "Invesco QQQ Trust" },
                    { symbol: "VTI", name: "Vanguard Total Stock Market" },
                    { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
                    { symbol: "IVV", name: "iShares Core S&P 500" }
                ]
            },
            {
                category: "Cryptocurrency",
                symbols: [
                    { symbol: "BTC-USD", name: "Bitcoin" },
                    { symbol: "ETH-USD", name: "Ethereum" },
                    { symbol: "ADA-USD", name: "Cardano" },
                    { symbol: "SOL-USD", name: "Solana" }
                ]
            }
        ];
    }
}