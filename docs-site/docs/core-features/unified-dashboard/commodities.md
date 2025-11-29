---
sidebar_position: 6
---

# Commodities Tab

The **Commodities Tab** manages the currencies and assets used in your ledger.

## 🪙 Features

### 1. Market Data
- **List View**: See all commodities declared in your file.
- **Latest Price**: Shows the most recent price point for each asset.

### 2. Metadata Management
- **Logo**: Assign a URL for the commodity icon.
- **Price Source**: Configure the source string for automated price fetching (e.g., `yahoo/AAPL`).

### 3. Price Updates
- **Validation**: "Test Price Source" button runs `bean-price -e` to verify the configuration works.
- **Update**: (Planned) Batch update prices from the UI.

## 🛠 Under the Hood

1.  **Controller**: `CommoditiesController.ts`.
2.  **API Integration**:
    - **GET /commodities?detailed=true**: Fetches symbol, latest price date, and metadata.
    - **PUT /commodities/{symbol}**: Updates the `commodity` directive in your file with new metadata.
    - **POST /commodities/{symbol}/validate_price**: Spawns a `bean-price` process to test the fetcher.
