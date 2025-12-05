---
sidebar_position: 3
---

# Journal Tab

The **Journal Tab** provides a raw, unfiltered view of your Beancount ledger, similar to the `Fava` web interface.

## 📋 Features

### Unified Stream
Unlike the Transactions tab, the Journal view shows **all** entry types:
- **Transactions**
- **Notes**
- **Balance Assertions**
- **Pads**
- **Documents** (planned)

### Management
- **Context Menu**: Right-click any entry to **Edit** or **Delete**.
- **Search**: Full-text search across narrations, payees, and comments.

## 🛠 Under the Hood

This tab uses a newer architecture than the others:

1.  **Service Layer**: `JournalService.ts` calls the REST API endpoints directly (`GET /entries`).
2.  **Pagination**: The Python backend (`get_entries`) handles server-side filtering and pagination (offset/limit) to support large files efficiently.
3.  **Store**: `journal.store.ts` manages the Svelte store, ensuring UI reactivity when entries are added or deleted.
4.  **Backend Filtering**: The Python class `BeancountJournalAPI` performs the actual filtering on the in-memory Beancount objects (`data.Transaction`, `data.Note`, etc.) before serialization.
