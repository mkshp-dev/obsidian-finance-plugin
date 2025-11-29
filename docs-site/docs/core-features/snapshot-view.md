---
sidebar_position: 2
---

# Snapshot View

The **Snapshot View** is a persistent sidebar widget designed to give you "at a glance" financial awareness while you write notes.

## 👁 Features

### 1. Key Metrics
Displays high-level numbers extracted from your ledger:
- **Net Worth**: Assets - Liabilities.
- **Income (Month)**: Total income for the current month.
- **Expenses (Month)**: Total expenses for the current month.

### 2. Recent Transactions
Shows a compact list of the last 5-10 transactions.
- Clicking a transaction opens the full **Unified Dashboard**.

### 3. Quick Actions
- **Add**: Button to open the Add Transaction modal.
- **Refresh**: Reloads data from the file.

## 🛠 Under the Hood

The Snapshot View is lighter than the main dashboard:

1.  **View Type**: It is registered as `BEANCOUNT_VIEW_TYPE` and typically lives in the right sidebar.
2.  **Data Fetching**:
    - It uses `runQuery()` directly to fetch specific aggregates (Net Worth, Income) instead of loading the full dataset.
    - This ensures it minimizes impact on Obsidian's startup time.
3.  **Reactivity**: It listens for `beancount:refresh` events. When you save a transaction in the main dashboard, the Snapshot View updates automatically.
