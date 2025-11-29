---
sidebar_position: 5
---

# Accounts Tab

The **Accounts Tab** is your chart of accounts explorer.

## 🏦 Features

- **Tree View**: Browse your entire account structure.
- **Details Panel**: Click any account to see:
    - **Current Balance**: Real-time balance.
    - **Status**: Active/Inactive.
    - **Metadata**: (Planned) Account open dates, description.

## 🛠 Under the Hood

1.  **Controller**: `AccountsController.ts`.
2.  **Data Source**: Queries `getAllAccountsQuery()` and `getAllAccountBalancesQuery()`.
3.  **Parsing**: Beancount often returns negative numbers for Income/Equity and positive for Assets/Expenses. The controller normalizes these signs for user-friendly display (e.g., showing Income as positive revenue).
