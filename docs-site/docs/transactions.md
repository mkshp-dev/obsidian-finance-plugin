---
sidebar_position: 4
---

# Transactions

The **Transactions** module provides a powerful interface for managing your financial entries. The plugin features a **Unified Entry Modal** that handles Transactions, Balance Assertions, and Notes in a single workflow.

## ➕ Creating Entries

To create a new entry, click the **"Add Transaction"** button in the dashboard or use the command **"Add Beancount Transaction"**.

### Unified Entry Modal

The modal has three tabs for different entry types:

#### 1. 💰 Transaction Tab
Used for standard double-entry accounting records.
- **Date**: Defaults to today.
- **Payee**: Who the transaction is with (auto-completes from existing payees).
- **Narration**: Description of the transaction.
- **Tags**: Optional categorization tags.
- **Postings**:
    - **Account**: Source or destination account (auto-completes).
    - **Amount**: Numerical value.
    - **Currency**: Transaction currency.
- **Auto-Balancing**: If you leave the amount empty on the last posting, the plugin calculates it automatically to ensure `Sum = 0`.

#### 2. ⚖️ Balance Tab
Used to assert the balance of an account at a specific point in time (Reconciliation).
- **Date**: Date of the assertion.
- **Account**: The account to check.
- **Amount**: The known correct balance.
- **Tolerance**: (Optional) Allowable difference before Beancount flags an error.

#### 3. 📝 Note Tab
Used to add context or documentation to an account.
- **Date**: Date of the note.
- **Account**: The relevant account.
- **Comment**: The text of the note.

---

## ✨ Smart Features

### Validation
The form includes real-time validation:
- **Syntax Check**: Ensures amounts are numbers and dates are valid.
- **Balance Check**: Visual indicator if the transaction creates an imbalance.
- **Required Fields**: Highlights missing information before saving.

### Auto-Complete
The form learns from your existing Beancount file:
- **Accounts**: Suggests accounts from your hierarchy.
- **Payees**: Suggests payees you've used before.
- **Tags**: Suggests existing tags.

---

## 📋 Managing Transactions

The **Transactions Tab** in the dashboard lists your recent history.

- **Search**: Real-time filtering by text, account, or amount.
- **Filter**: Filter by date range or specific accounts.
- **Edit**: Click any transaction to open the Unified Modal with pre-filled data.
- **Delete**: Remove transactions with a confirmation dialog.

---

## 🛡️ Data Safety

- **Backups**: The plugin creates a backup of your Beancount file before *every* write operation (Create, Update, Delete).
- **Atomic Writes**: Edits are performed carefully to preserve the surrounding file structure.
- **Formatting**: The plugin respects standard Beancount formatting conventions.
