---
sidebar_position: 4
---

# Adding Price Metadata

To keep your assets (like stocks, ETFs, mutual funds, or cryptocurrencies) valued at their current market price in your dashboards, you need price data. This guide covers how to record prices and set up automated price fetching.

---

## 📈 Price Directives Syntax

In Beancount, a price directive records the historical value of a commodity in a specific currency on a particular date:

```beancount
YYYY-MM-DD price SYMBOL PRICE_AMOUNT QUOTE_CURRENCY
```

### Examples:
```beancount
2026-05-28 price AAPL 182.30 USD
2026-05-28 price BTC 67450.00 USD
```

These directives are typically stored in `prices.beancount` in your structured layout folder.

---

## 🪙 Price Sources in Commodity Metadata

The command-line tool **`bean-price`** can fetch these price directives from the internet automatically. To do this, you must annotate each commodity with a `price:` metadata entry specifying where to download the data.

The format for the price metadata value is:
```
"QUOTE_CURRENCY:SOURCE/TICKER"
```

### Common Price Sources:

1.  **Yahoo Finance** (Best for global stocks, ETFs, and indices):
    *   US Stocks: `"USD:yahoo/AAPL"`
    *   US Mutual Funds / ETFs: `"USD:yahoo/VTSAX"`
    *   Foreign Tickers (include suffix): `"INR:yahoo/RELIANCE.NS"` (NSE India), `"CAD:yahoo/SHOP.TO"` (TSX Canada)
2.  **Coinbase** (Best for cryptocurrencies):
    *   Bitcoin: `"USD:coinbase/BTC-USD"`
    *   Ethereum: `"USD:coinbase/ETH-USD"`

#### Example Commodity Declaration:
```beancount
2020-01-01 commodity AAPL
  name: "Apple Inc."
  price: "USD:yahoo/AAPL"
```

---

## 🧪 Configuring and Testing Price Sources

You can add and test price sources directly through the plugin UI:

1.  Go to the **Unified Dashboard** → **Commodities** tab.
2.  Click on a commodity row to open its detailed view modal.
3.  In the **Price Source** field, enter the format (e.g., `USD:yahoo/AAPL`).
4.  Click the **Test Price Source** button:
    *   The plugin validates the format.
    *   It runs a live command (`bean-price -e ...`) in the background to fetch a quote.
    *   If successful, it displays the retrieved price in green. If it fails, it displays the error from `bean-price`.
5.  Click **Save** to write the configuration to your `commodities.beancount` file.

---

## 🔄 Automated Price Fetching

Once your commodities are annotated with price sources, you can let the plugin fetch daily prices automatically.

### How It Works:
1.  The plugin schedules a background execution of `bean-price <main_ledger>`.
2.  `bean-price` reads the ledger, detects all commodities with `price:` metadata, and contacts the online sources.
3.  The plugin receives the output, filters and deduplicates the price lines against your existing entries in `prices.beancount`, and appends only *new* price lines.
4.  Your historical price log grows over time without manual intervention.

### Enabling Scheduled Fetching:
1.  Go to **Settings → Beancount Ledger → General**.
2.  Toggle **"Enable automatic price fetching"** to **On**.
3.  Set the **Fetch interval (hours)** (e.g., `24` hours).
4.  The scheduled fetch starts running immediately.

### Manual Price Fetch:
To run a price fetch immediately, open the Command Palette (`Ctrl/Cmd + P`) and execute:
**"Fetch Commodity Prices"**

A desktop notification will report how many new price directives were appended to your `prices.beancount` file.
