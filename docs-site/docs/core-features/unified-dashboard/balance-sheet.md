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

## 🛠 Under the Hood

### Controller Architecture
`BalanceSheetController.ts` manages:
- Tab state (selected valuation method, expanded accounts)
- Dynamic BQL query generation
- Hierarchical tree construction from flat CSV data
- Svelte store for reactive updates

### Query Generation
The query adapts based on the selected valuation method:

**Market Value (Converted):**
```sql
SELECT account, convert(sum(position), 'USD')
WHERE account ~ '^Assets|^Liabilities|^Equity'
GROUP BY account
```

**At Cost:**
```sql
SELECT account, cost(sum(position))
WHERE account ~ '^Assets|^Liabilities|^Equity'
GROUP BY account
```

**Units:**
```sql
SELECT account, units(sum(position))
WHERE account ~ '^Assets|^Liabilities|^Equity'
GROUP BY account
```

### Tree Building
1. BQL returns flat rows: `Assets:Bank:Checking | 100 USD`
2. The `buildAccountHierarchy()` function recursively constructs a tree
3. Parent nodes (`Assets`, `Assets:Bank`) automatically sum their children
4. The UI renders this tree with collapsible expand/collapse controls

### Performance
- Queries limit results based on `maxTransactionResults` setting
- For very large account hierarchies, the tree building is optimized with O(n) iteration
- Account states (expanded/collapsed) are stored in the component state for quick re-renders
