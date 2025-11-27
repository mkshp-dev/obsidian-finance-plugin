---
sidebar_position: 6
---

# Journal & Backend

The **Journal** tab provides a "ledger-first" view of your financial data, mimicking the functionality of tools like Fava but integrated directly into Obsidian.

## 📓 Journal View

The Journal view displays your Beancount entries in a linear, chronological list.

### Features
- **Full Fidelity**: Shows all metadata, tags, links, and multiple postings for each transaction.
- **Fava-style Cards**: Clean, readable layout that handles complex split transactions.
- **Filtering**:
    - **Search**: Full-text search across narrations, payees, and accounts.
    - **Date Range**: Filter by specific years, months, or custom ranges.
    - **Account**: Show transactions only involving specific accounts (recursive).
    - **Metadata**: Filter by tags or links.

### Actions
- **Edit**: Click the pencil icon to open the Unified Entry Modal.
- **Delete**: Remove an entry (with backup).
- **Navigate**: Click on tags or accounts to filter the view instantly.

---

## 🐍 Python Backend

To power the advanced filtering and parsing required for the Journal view, the plugin runs a lightweight Python backend process.

### How it Works
1.  **Auto-Start**: When you open the Journal tab (or Dashboard), the plugin automatically starts a background Python process (`src/backend/journal_api.py`).
2.  **API**: This process exposes a local REST API (usually on port 5001).
3.  **Parsing**: The backend uses Beancount's native Python library to parse your ledger. This ensures 100% accuracy compared to regex-based parsing.
4.  **Performance**: Filtering and searching happen in Python, which is highly optimized for this data structure, keeping the Obsidian UI snappy.

### Backend Status
You can monitor the backend status in the **Settings** -> **Connection** panel or via the status indicator in the Journal tab.
- 🟢 **Connected**: API is running and responding.
- 🟡 **Starting**: Process is launching.
- 🔴 **Disconnected**: Process failed or was stopped.

### Safety
- The backend runs locally on your machine.
- It only listens on `localhost`.
- It shuts down automatically when you close Obsidian (or after a timeout).
