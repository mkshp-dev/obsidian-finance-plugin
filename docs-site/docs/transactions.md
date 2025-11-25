---
sidebar_position: 7
---

# Transactions

This page explains how the plugin creates, edits and deletes transactions and how those actions map to Beancount file edits.

Creating transactions (UI)
- Use the New Transaction button in the Unified Dashboard or the Transaction modal (`src/components/TransactionForm.svelte`).
- The frontend validates required fields (date, narration, postings) and sends `POST /transactions` to the backend.

Backend mapping
- `POST /transactions` -> `add_entry_to_file` (appends transaction and creates a backup)
- `PUT /transactions/<id>` -> `update_transaction_in_file` (finds transaction by `entry.meta['lineno']` and replaces the text block)
- `DELETE /transactions/<id>` -> `delete_transaction_from_file`

Safety and backups
- All modifying operations create a `'ledger.beancount.backup.YYYYmmdd_HHMMSS'` file before writing.
- When updating, the code finds start/end lines by inspecting indentation and replaces the block atomically.

Example: updating a transaction (client request)

```json
PUT /transactions/abc123
{
  "date": "2025-01-01",
  "narration": "Updated",
  "postings": [ {"account":"Assets:Bank","amount":"100.00","currency":"USD"}, {"account":"Expenses:Food"} ]
}
```

If the backend cannot locate the transaction by lineno it returns a helpful error. Check backend logs (forwarded to the Obsidian dev console) to diagnose missing lineno or parse issues.
