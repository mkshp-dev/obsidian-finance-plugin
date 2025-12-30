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
Switch between modes using the dropdown or tabs:
- **Transaction**: Standard double-entry record (e.g., buying coffee).
- **Balance**: Assert the balance of an account (e.g., reconciling bank statement).
- **Note**: Attach a text note to an account.

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

## 🛠 Under the Hood

When you click "Save":

1.  **Validation**: The frontend (`UnifiedTransactionModal.ts`) checks for basic errors (e.g., unbalanced transaction, missing date).
2.  **Submission**: The data is sent as a JSON payload to `POST /transactions` on the local API.
3.  **File Operation**:
    - The Python backend (`journal_api.py`) receives the request.
    - It creates a backup of your `.beancount` file (e.g., `ledger.beancount.backup.20231025...`).
    - It appends the new directive string (formatted in Beancount syntax) to the file.
4.  **Refresh**: The backend reloads the internal Beancount `entries` map, and the frontend Dashboard automatically refreshes to show the new data.
