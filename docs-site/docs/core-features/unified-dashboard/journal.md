---
sidebar_position: 3
---

# Journal Tab

The **Journal Tab** provides a comprehensive, raw view of your Beancount ledger—similar to the Fava web interface.

## 📋 Features

### Complete Entry Stream
Unlike the Transactions tab, the Journal view shows **all** entry types:
- **Transactions**: Standard double-entry records
- **Notes**: Descriptive notes attached to accounts
- **Balance Assertions**: Balance checks/reconciliations
- **Other Directives**: Any other Beancount directives (pads, documents, etc.)

### Full Management Capabilities
- **View Details**: Click any entry to see full information including metadata
- **Edit**: Right-click or click the edit button to modify an entry
- **Delete**: Remove entries with confirmation to prevent accidents
- **Search**: Full-text search across all fields (date, payee, narration, accounts)

### Advanced Filtering
- **Date Range**: Filter entries by start and end dates
- **Account Filter**: Show entries involving specific accounts
- **Entry Type**: Filter by transaction, note, balance assertion, etc.
- **Live Search**: Instant results as you type

## 🛠 Under the Hood

### Architecture
This tab uses the modern service-based architecture:

1.  **Service Layer**: `JournalService.ts` 
   - Handles communication with the file system
   - Manages entry parsing and serialization
   - Uses Beancount file operations directly (no API backend)

2.  **Svelte Store**: `journal.store.ts`
   - Wraps JournalService with reactive state management
   - Exposes `entries`, `loading`, and `error` as writable stores
   - Automatically updates UI when data changes

3.  **Data Fetching**:
   - On tab load, the controller fetches entries from the Beancount file
   - Entries are parsed to extract key information (date, account, type, etc.)
   - Results are stored in the reactive Svelte store

4.  **CRUD Operations**:
   - **Create**: New entries are appended to the file
   - **Read**: Entries are fetched via BQL queries for their line numbers
   - **Update**: Entries are located by scanning the file and modified in-place
   - **Delete**: Entries are removed from the file atomically

### File Operations
All file modifications follow the atomic write pattern:
1. Read the entire file into memory
2. Create a backup if enabled (via settings)
3. Perform modifications in-memory
4. Write to a temporary file
5. Atomically rename the temp file to the original

This ensures data integrity even if the process crashes mid-operation.
