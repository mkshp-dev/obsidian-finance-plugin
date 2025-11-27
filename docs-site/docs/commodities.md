---
sidebar_position: 5
---

# Commodities & Prices

The Commodities tab provides tools to manage your assets, currencies, and their prices. It features a simplified integration with Yahoo Finance for easy symbol configuration.

## 🪙 Commodities Management

The Commodities tab displays all commodities defined in your Beancount file in a compact card layout.

### Visual Status Indicators
Each card has a visual indicator for its price update status:
- 🟢 **Automated**: The commodity has a configured price source (e.g., Yahoo Finance).
- ⚪ **Manual**: The commodity has no automated price source configured.

### Editing Metadata
You can edit the metadata for any commodity (e.g., logo, price source) directly from the dashboard:
1.  Click on a commodity card.
2.  Click **Edit** to open the metadata modal.
3.  Update the **Logo URL** or **Price Source**.
4.  **Save** to update your Beancount file.

*Note: The plugin safely updates the `commodity` directive in your file, preserving other metadata.*

---

## 📈 Yahoo Finance Integration

The plugin simplifies finding and configuring ticker symbols for automated price fetching using `bean-price`.

### Symbol Search Workflow

1.  **Browse Financial Websites**: The "Add Commodity" or "Edit" views provide direct links to major financial sites:
    - Yahoo Finance
    - Google Finance
    - Bloomberg
    - MarketWatch
    - Investing.com
    - Morningstar

2.  **Find Your Symbol**: Search for your stock, ETF, or cryptocurrency on one of these sites (e.g., `AAPL` for Apple, `BTC-USD` for Bitcoin).

3.  **Quick Examples**: The interface provides a library of common symbols:
    - **Stocks**: AAPL, MSFT, GOOGL, AMZN, TSLA...
    - **ETFs**: SPY, QQQ, VTI, VOO...
    - **Crypto**: BTC-USD, ETH-USD, SOL-USD...

4.  **Configure Price Source**:
    - Enter the symbol manually.
    - Or click an example to automatically generate the price source string: `USD:yahoo/SYMBOL`.

### Benefits
- **No API Keys**: Relies on public data sources supported by `bean-price`.
- **Reliable**: Uses official ticker symbols.
- **Flexible**: Works with any symbol Yahoo Finance supports (Stocks, Forex, Crypto).

---

## 💸 Price Updates

The plugin can run `bean-price` to fetch the latest prices for your configured commodities.

### Prerequisites
- **bean-price**: Must be installed (`pip install beancount` usually includes it, or install separately).
- **Configuration**: Commodities must have a `price` metadata field (e.g., `price: "USD:yahoo/AAPL"`).

### How to Update Prices
1.  Go to the **Commodities** tab.
2.  Click the **Update Prices** button (if available/configured).
3.  The plugin runs `bean-price` in the background and appends the new price directives to your price file (usually `prices.beancount` or similar, depending on your setup).

### Configuration
In **Settings**, you can configure:
- **Price File Path**: Where the new price entries should be written.
- **Timeout**: How long to wait for the price fetch to complete.

---

## 🛠️ Technical Details

### Metadata Format
The plugin looks for a `price` metadata key in your commodity directive:

```beancount
2020-01-01 commodity AAPL
  price: "USD:yahoo/AAPL"
  logo: "https://logo.clearbit.com/apple.com"
```

### Safe File Writes
- **Backups**: Every write operation creates a timestamped backup of your file before modification.
- **In-Place Updates**: The plugin attempts to update the existing directive in-place to preserve comments and formatting.
