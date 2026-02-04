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
