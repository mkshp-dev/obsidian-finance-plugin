# Manual Testing Guide for Obsidian Finance Plugin

This guide is designed to help you verify the functionality of the Obsidian Finance Plugin (v2.0.0) before release. Please follow these steps sequentially to ensure all features work as expected.

## 1. Prerequisites Check
**Goal**: Verify that the plugin can detect and use the necessary environment.

1.  **Environment Setup**:
    *   Ensure Python 3.8+ is installed.
    *   Ensure Beancount is installed (`pip install beancount`).
    *   Have a valid `.beancount` file ready (or use a fresh one).

2.  **Plugin Installation**:
    *   Install the plugin (via BRAT or manually).
    *   Enable the plugin in Obsidian settings.

3.  **Initial Configuration**:
    *   Go to **Settings > Finance Plugin**.
    *   **Beancount File Path**: Enter the absolute path to your `.beancount` file.
    *   **Connection Test**:
        *   Click "Test All Commands".
        *   Verify that `Bean Check`, `Bean Query`, and `Backend API Server` all show green checks (✅).
        *   *Troubleshooting*: If "Backend API Server" fails, check if port 5013 is free.

## 2. Dashboard Overview
**Goal**: Verify the main dashboard renders correctly.

1.  Open the dashboard: Click the 💰 ribbon icon or run command "Open Finance Dashboard".
2.  **Overview Tab**:
    *   Check if "Net Worth", "Assets", and "Liabilities" cards show numbers (not `NaN` or `undefined`).
    *   Verify the charts (Income/Expense, Net Worth) are visible.
3.  **Transactions Tab**:
    *   Scroll through the list.
    *   Try filtering by a specific Account or Payee.
    *   Verify the pagination works (Next/Previous buttons).
4.  **Accounts & Balances Tab**:
    *   Expand/Collapse the account tree.
    *   Verify balances match what you expect from your file.
5.  **Commodities Tab**:
    *   Check if commodities are listed.
    *   Try clicking the "Yahoo Finance" or other external link buttons.

## 3. Journal & Backend Integration
**Goal**: Verify the Python backend and real-time ledger interaction.

1.  Switch to the **Journal Tab** in the Dashboard.
2.  **Loading State**:
    *   You should see "Loading entries..." briefly.
    *   If the backend was not running, you might see "Backend API Starting...".
3.  **Display**:
    *   Verify that transactions are displayed with full details (Postings, Date, Payee).
    *   Verify that "Balance" and "Note" entries are also visible.
4.  **Filtering**:
    *   **Search**: Type a payee name in the search box. Press Enter or wait. Results should filter.
    *   **Date Range**: Select a "From" date. Verify the list updates.
    *   **Type**: Change dropdown to "Notes". Verify only notes are shown.

## 4. CRUD Operations (Unified Modal)
**Goal**: Verify creating, reading, updating, and deleting entries works.

1.  **Create Transaction**:
    *   Click the "+" button (or command "Add Beancount Transaction").
    *   **Tab**: Ensure "Transaction" tab is selected.
    *   **Fill Form**:
        *   Date: Today.
        *   Payee: "Test Payee".
        *   Narration: "Test Transaction".
        *   Postings:
            *   Account 1: `Assets:Cash` (should autocomplete). Amount: `-10.00`.
            *   Account 2: `Expenses:Food` (should autocomplete). Amount: `10.00`.
    *   **Save**: Click "Add Transaction".
    *   **Verify**: Check the Journal tab. The new transaction should appear immediately.
    *   **Verify File**: Open your `.beancount` file in a text editor. The entry should be appended at the end.

2.  **Create Balance Assertion**:
    *   Open "Add Beancount Transaction".
    *   Switch to **Balance** tab.
    *   Account: `Assets:Cash`.
    *   Amount: Enter a value.
    *   Save and verify in Journal.

3.  **Create Note**:
    *   Open "Add Beancount Transaction".
    *   Switch to **Note** tab.
    *   Account: `Assets:Cash`.
    *   Comment: "This is a test note".
    *   Save and verify in Journal.

4.  **Edit Entry**:
    *   In Journal tab, find the "Test Transaction" you created.
    *   Click the **Edit** (pencil) icon.
    *   Change the Payee to "Updated Payee".
    *   Click "Save Changes".
    *   Verify the change in the Journal list and in the file.

5.  **Delete Entry**:
    *   In Journal tab, find the "Updated Payee" transaction.
    *   Click the **Delete** (trash) icon.
    *   Confirm the dialog.
    *   Verify it disappears from the list and the file.

## 5. BQL Queries
**Goal**: Verify inline and code-block queries.

1.  **Code Block**:
    *   Create a new Obsidian note.
    *   Add the following block:
        ```
        ```bql
        SELECT date, payee, position WHERE account ~ 'Expenses' LIMIT 5
        ```
        ```
    *   Switch to Reading mode.
    *   Verify a table renders with data.

2.  **Inline Query**:
    *   In the note, type: `` `bql:SELECT sum(position) WHERE account ~ 'Assets'` ``.
    *   Switch to Reading mode.
    *   Verify it renders a currency value (e.g., `1234.56 USD`).

## 6. Edge Cases & Resilience
1.  **Invalid File Path**:
    *   Go to Settings, change path to a non-existent file.
    *   Run "Bean Check" in settings. It should fail gracefully.
2.  **Backend Restart**:
    *   While Journal tab is open, kill the python process manually (via Task Manager/Activity Monitor) if you know how.
    *   Click "Refresh" in Journal tab. The plugin should restart the backend automatically.

## 7. UX & Polish
1.  **Theme Compatibility**: Switch Obsidian between Light and Dark mode. Ensure text is legible in both.
2.  **Mobile View**: If possible, resize the window to be narrow (like a phone). Check if the Transaction Modal fits on screen.

---
**Report any failures or odd behaviors found during this process.**
