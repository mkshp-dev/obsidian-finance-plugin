---
sidebar_position: 1
---

# Adding Directives

One of the primary actions you will perform is adding new financial data to your ledger. The plugin provides a streamlined **Unified Transaction Modal** for this purpose.

:::tip
This guide covers how to use the transaction modal UI. For details on the underlying Beancount syntax and advanced features, see the [Beancount Transaction Syntax Reference](./beancount-syntax.md).
:::

## 🚀 Accessing the Modal

You can open the "Add Transaction" modal in three ways:
1.  **Ribbon Icon**: Click the **(+)** icon in the left sidebar ribbon.
2.  **Command Palette**: Press `Ctrl/Cmd + P` and search for **"Add Beancount Transaction"**.
3.  **Hotkey**: Assign a custom hotkey in Obsidian Settings.

## 📝 Modal Features

The modal is context-aware and validates your input in real-time.

### 1. Transaction Type
Switch between modes using the tabs:
- **Transaction**: Standard double-entry record (e.g., buying coffee).
- **Balance**: Assert the balance of an account (e.g., reconciling bank statement).
- **Note**: Attach a text note to an account.
- **Query**: Define a named BQL query directive saved to `queries.beancount`.

### 2. Smart Fields
- **Date**: Defaults to today. Supports quick entry.
- **Payee & Narration**: Auto-complete based on your existing data.
- **Postings**:
    - **Account**: Searchable dropdown of your account hierarchy.
    - **Amount**: Auto-formatting (e.g., inputs like `10` become `10.00 USD`).
    - **Auto-Balance**: Leave one amount empty, and the plugin will calculate it automatically.

### 3. Metadata
- **Tags**: Add `#hashtags` to categorize entries.
- **Links**: Link entries to other transaction IDs.

### 4. Query Tab

The **🔍 Query** tab lets you define a named BQL query and save it as a Beancount `query` directive:

| Field | Description |
|-------|-------------|
| **Date** | Directive date (e.g. `2024-01-01`). Does not affect query results. |
| **Query name** | A unique identifier. Must start with a letter; only letters, numbers, `-`, and `_` are allowed. |
| **SQL** | The BQL `SELECT` statement to save. |

After saving, the directive is appended to `queries.beancount` in your structured layout folder:

```
2024-01-01 query "my_expenses" "SELECT account, sum(position) WHERE account ~ 'Expenses' GROUP BY account"
```

You can then reference it anywhere in your vault with `` `bql-q:my_expenses` ``.

:::tip
The inline processor cache is cleared automatically after saving, so the query is available immediately without reloading Obsidian.
:::
