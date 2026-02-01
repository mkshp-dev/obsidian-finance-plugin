---
sidebar_position: 2
---

# Transactions Tab

The **Transactions Tab** allows you to explore your financial history with powerful filtering capabilities.

## 🔍 Features

### Dynamic Filtering
Filter your history by any combination of:
- **Date Range**: Start and End dates (inclusive).
- **Account**: Substring match (e.g., "Food" matches "Expenses:Food:Groceries").
- **Payee**: Who you paid (searches transaction payee field).
- **Tags**: Filter by specific tags (e.g., `#vacation`, `#business`).
- **Search**: Full-text search across all transaction fields.

### Results Table
Displays your filtered transactions with:
- **Columns**: Date, Payee, Narration, Amount, Account
- **Sorting**: Automatically sorted by date (newest first)
- **Pagination**: Respects the "Max Transaction Results" setting (default: 2000)
- **Interactive**: Click on transactions to view or edit details

## 🛠 Under the Hood

### Data Flow
1.  **Controller**: `TransactionController.ts` manages the tab's state (filters, results, loading status)
2.  **Filter Options**: On tab load, the controller queries available accounts and tags via BQL
3.  **Dynamic Query Building**: When filters change, a BQL query is constructed dynamically:
    - Example: `SELECT date, payee, narration, position WHERE account ~ 'Food' AND date >= 2023-01-01`
4.  **Query Execution**: The query runs via `bean-query` (direct CLI, no backend API)
5.  **CSV Parsing**: Results are parsed from CSV format using the `csv-parse` library
6.  **Rendering**: The Svelte component displays results in a responsive table

### Performance Notes
- Large result sets are limited by the `maxTransactionResults` setting
- Filtering happens on the client-side after results are fetched
- For very large ledgers, consider lowering date ranges to reduce data transfer
