---
sidebar_position: 4
---

# Balance Sheet Tab

The **Balance Sheet** provides a hierarchical view of your financial position at any point in time.

## 🏛 Features

### Account Hierarchy
View your accounts organized by type with drill-down capability:
- **Assets**: Cash, Banks, Investments, Real Estate
- **Liabilities**: Credit Cards, Loans, Mortgages
- **Equity**: Opening balances, Retained Earnings, Paid-in Capital
- **Income & Expenses**: (if configured to display)

### Valuation Methods
Toggle between three views to see different perspectives:

1.  **Market Value (Converted)**: All holdings converted to your Operating Currency at current market prices
   - Uses the `convert()` function to apply exchange rates and market prices
   - Perfect for seeing your net worth in a single currency
   
2.  **At Cost**: The original cost basis of your assets
   - Uses the `cost()` function to show purchase prices
   - Useful for tax calculations and understanding gains/losses
   
3.  **Units**: Raw number of shares, coins, or currency units
   - Shows `50 AAPL`, `1.5 BTC`, `1000 USD`, etc.
   - Essential for tracking asset quantities

### Real-time Balances
- Parent account balances automatically aggregate children
- All values update when new transactions are recorded
- Account expansion/collapse saves your preferences

---

## 🔍 Behind the Scenes: BQL Queries

Each valuation method uses a different query to fetch account balances:

### Market Value (Convert)
```sql
SELECT account, convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account
```

Converts all holdings to your operating currency at current market prices.

### Historical Cost
```sql
SELECT account, cost(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account
```

Shows original purchase prices - useful for tax calculations and understanding gains/losses.

### Units (Raw Holdings)
```sql
SELECT account, units(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account
```

Shows actual quantities held (e.g., "50 AAPL", "1.5 BTC", "1000 USD").

:::tip
The `NOT close_date(account)` filter ensures closed accounts don't appear in the balance sheet.
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for all plugin queries.
