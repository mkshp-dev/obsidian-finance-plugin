---
sidebar_position: 6
---

# Commodities Tab

![Commodities Tab](/img/CommoditiesTab.png)

The **Commodities Tab** manages all currencies and assets used in your Beancount ledger—from stocks and crypto to forex and commodities.

---

## 🪙 Features

### Commodity Overview
View all commodities declared in your ledger with:
*   **Symbol**: Ticker or commodity code (e.g., `AAPL`, `BTC`, `EUR`).
*   **Latest Price**: Most recent price point with date.
*   **Status Indicator**: Quick visual indicator of price data availability:
    *   🟢 **Automated**: Price fetcher configured and working.
    *   ⚪ **Manual**: No automated source configured.
    *   ❌ **Error**: Price fetcher failed.

### 🔍 Search and Filters

The top control bar allows you to quickly query and filter down your list of commodities:
*   **Search Input**: Filter commodities by typing their symbol.
*   **Filter Toggle Buttons**:
    *   **All**: Shows every commodity declared in the ledger.
    *   **Has Holding**: Displays only commodities that have a positive holdings balance (plus the operating currency).
    *   **Has Price**: Displays only commodities that have recorded price data.
    *   **Has Both**: Displays only commodities with active holdings AND available price data.

### 💰 Updating Prices & Adding Commodities

*   **💰 Update Prices Button**: Instantly triggers the price fetcher (`bean-price`) to retrieve and update the latest market values for all commodities configured with automated price sources.
*   **+ Add Commodity Button**: Open a form to declare new commodities, define their metadata, and configure automated price fetching sources (e.g., Yahoo Finance).

### 💳 Operating Currency Card

The operating currency defined in your ledger (e.g., `USD` or `INR`) is highlighted with a distinct accent border and displays a helper message: *"Base currency for all conversions in this ledger"*.

---

## ⚙️ Metadata Management

![Commodity Card](/img/CommoditiesTab-CommodityCard.png)
![Commodity Details Modal](/img/CommoditiesTab-CommodityDetailsModal.png)

For each commodity, you can configure:
*   **Commodity Details**: Access via click to open detailed view modal.
*   **Price Source**: The fetch source string (e.g., `yahoo/AAPL` for Yahoo Finance).
*   **Logo/Icon URL**: Custom image URL for the commodity.
*   **Display Name**: Human-readable name.
*   **Quote Currency**: The currency this commodity is priced in.

### Price Validation
*   **Test Price Source**: Verify your price fetcher configuration works correctly.
*   **Validate Format**: Ensures the price source string is valid.
*   **Live Testing**: Runs `bean-price` to check if the source can actually fetch prices.
