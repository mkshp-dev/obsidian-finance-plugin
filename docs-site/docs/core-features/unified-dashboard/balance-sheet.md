---
sidebar_position: 4
---

# Balance Sheet Tab

The **Balance Sheet** provides a hierarchical view of your financial standing.

## 🏛 Features

### Asset Hierarchy
Drill down into your accounts:
- **Assets**: Cash, Banks, Investments.
- **Liabilities**: Credit Cards, Loans.
- **Equity**: Opening balances and retained earnings.

### Valuation Methods
Toggle between three views:
1.  **Market Value (Converted)**: All holdings converted to your Operating Currency at current prices.
2.  **At Cost**: The original cost basis of your assets.
3.  **Units**: The raw number of shares/currency units (e.g., "50 AAPL").

## 🛠 Under the Hood

1.  **Controller**: `BalanceSheetController.ts`.
2.  **Dynamic Querying**: The query changes based on the selected Valuation Method:
    - **Convert**: `SELECT ... convert(sum(position), 'USD') ...`
    - **Cost**: `SELECT ... cost(sum(position)) ...`
    - **Units**: `SELECT ... units(sum(position)) ...`
3.  **Tree Construction**:
    - The raw CSV returns flat rows: `Assets:Bank:Checking | 100 USD`.
    - The controller's `buildAccountHierarchy()` recursively builds a tree structure (`Assets -> Bank -> Checking`).
    - Parent nodes automatically aggregate the values of their children.
