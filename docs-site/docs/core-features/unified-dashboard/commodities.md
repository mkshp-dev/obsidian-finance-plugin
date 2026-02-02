---
sidebar_position: 5
---

# Commodities Tab

The **Commodities Tab** manages all currencies and assets used in your Beancount ledger—from stocks and crypto to forex and commodities.

## 🪙 Features

### Commodity Overview
View all commodities declared in your ledger with:
- **Symbol**: Ticker or commodity code (e.g., `AAPL`, `BTC`, `EUR`)
- **Latest Price**: Most recent price point with date
- **Status Indicator**: Quick visual indicator of price data availability
  - 🟢 **Automated**: Price fetcher configured and working
  - ⚪ **Manual**: No automated source configured
  - ❌ **Error**: Price fetcher failed

### Metadata Management
For each commodity, you can configure:
- **Commodity Details**: Access via click to open detailed view modal
- **Price Source**: The fetch source string (e.g., `yahoo/AAPL` for Yahoo Finance)
- **Logo/Icon URL**: Custom image URL for the commodity
- **Display Name**: Human-readable name
- **Quote Currency**: The currency this commodity is priced in

### Price Validation
- **Test Price Source**: Verify your price fetcher configuration works correctly
- **Validate Format**: Ensures the price source string is valid
- **Live Testing**: Runs `bean-price` to check if the source can actually fetch prices

## 🛠 Under the Hood

### Controller Architecture
`CommoditiesController.ts` manages:
- Commodity list fetching and state
- Detail modal interactions
- Price validation operations
- Metadata update operations

### Data Fetching
The tab fetches commodity information via direct Beancount file analysis:
1. Scans for all `commodity` directives in the ledger
2. Extracts metadata from the directives
3. Queries for the latest price date in the ledger
4. Displays combined information to the user

### Price Management
When you configure a price source:
1. The setting is stored in the `commodity` directive metadata (e.g., `meta: {"price-source": "yahoo/AAPL"}`)
2. Clicking "Test Price Source" runs: `bean-price -e <commodity> <fetcher-config>`
3. If successful, the price source is saved to your Beancount file
4. Beancount's price updating tools can then use this configuration for automated fetches

### File Operations
Commodity metadata changes follow the atomic write pattern:
1. Locate the commodity directive in the file
2. Create a backup if enabled
3. Update the directive metadata
4. Write atomically to the file

This ensures your commodity configuration is always safe and recoverable.
