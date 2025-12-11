---
sidebar_position: 2
---

# Transactions Tab

The **Transactions Tab** allows you to explore your financial history with powerful filtering.

## 🔍 Features

### Filtering
Filter your history by any combination of:
- **Date Range**: Start and End dates.
- **Account**: Substring match (e.g., "Food" matches "Expenses:Food").
- **Payee**: Who you paid.
- **Tags**: Filter by specific tags (e.g., `#vacation`).

### Results Table
- **Columns**: Date, Payee, Narration, Amount (Position), Balance.
- **Sorting**: Automatically sorted by date (newest first).
- **Pagination**: Supports infinite scrolling or large pages (configurable limit).

## 🛠 Under the Hood

1.  **Controller**: `TransactionController.ts` manages state.
2.  **Filter Loading**: On mount, it queries `getAllAccounts` and `getAllTags` to populate the filter dropdowns.
3.  **Query Generation**:
    - When filters change, `getTransactionsQuery()` constructs a dynamic SQL-like BQL query.
    - Example: `SELECT date, payee... WHERE account ~ 'Food' AND date >= 2023-01-01`.
4.  **Execution**: The query is sent to `bean-query` via the backend process.
5.  **Parsing**: The resulting CSV is parsed into rows and displayed in the virtualized table component.
