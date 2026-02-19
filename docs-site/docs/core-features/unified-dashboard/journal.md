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

---

## 🔍 Behind the Scenes: BQL Queries

The Journal tab combines multiple queries to show all entry types:

### Transaction Entries
```sql
SELECT id, date, flag, payee, narration, tags, links, filename, lineno, account, number, currency, cost_number, cost_currency, cost_date, price, entry.meta as entry_meta FROM postings WHERE <filters> ORDER BY date DESC, id, account
```

This queries the `postings` table and groups results by transaction ID client-side. Includes:
- All posting details (amounts, currencies, costs)
- File location (`filename`, `lineno`) for editing
- Transaction-level metadata

### Balance Assertions
```sql
SELECT date, account, amount, tolerance, discrepancy FROM #balances WHERE <filters> ORDER BY date DESC, account
```

Retrieves all balance directives with:
- Expected amount
- Allowed tolerance
- Any discrepancy found by Beancount

### Note Entries
```sql
SELECT date, account, comment, tags, links, meta FROM #notes WHERE <filters> ORDER BY date DESC, account
```

Gets all note directives attached to accounts.

:::tip
The Journal tab fetches all three entry types in parallel and merges them client-side, sorting by date. This provides a unified chronological view of your ledger.
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for all plugin queries.
