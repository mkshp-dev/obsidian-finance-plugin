---
sidebar_position: 4
---

# Features

This page summarizes the user-facing features and where to find the implementation.

- Unified Dashboard: consolidated view of transactions, balances and charts (`src/views/UnifiedDashboardView.svelte`).
- Transactions editor: create, edit, delete transactions with safe file backups (`src/components/TransactionForm.svelte`, `update_transaction_in_file`).
- Commodities manager: edit commodity metadata (logo, price source) and write safe commodity declarations (`src/components/tabs/CommoditiesTab.svelte`, `src/backend/journal_api.py`).
- Price updating: integrate with `bean-price` to generate `dependencies/prices.beancount`. Helper lives in `src/backend/journal_api.py` (`run_bean_price_and_write`).
- Backend API: REST endpoints to list/update entries, used by the frontend controllers (`src/backend/journal_api.py`, `src/backend/BackendManager.ts`).

Additional capabilities:
- Developer-friendly logs: backend stdout/stderr forwarded to the Obsidian dev console by `BackendManager`.
- Safe file operations: all file-modifying operations create timestamped backups before writing.

See the dedicated pages for deep dives: `commodities.md`, `prices.md`, `transactions.md`, and `backend-api.md`.
