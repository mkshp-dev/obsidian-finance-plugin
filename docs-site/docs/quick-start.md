---
sidebar_position: 3
---

# Quick Start

This quick start shows the minimal steps to see the plugin in action.

1. Ensure backend dependencies are installed (Python, `beancount`, optional `bean-price`).

2. Build the plugin UI and start Obsidian in developer mode (or drop the folder into your vault plugins folder):

```bash
npm run build
# Then enable the plugin in Obsidian
```

3. Start the backend (the plugin's `BackendManager` will spawn it automatically when needed). If you want to run it manually for debugging:

```bash
.venv\Scripts\python.exe src\backend\journal_api.py ledger.beancount --port 5001
# or: python src/backend/journal_api.py path/to/ledger.beancount
```

4. Open the Unified Dashboard in Obsidian (Command Palette -> Unified Dashboard). The plugin will show Transactions, Commodities, Balance Sheet and Charts.

5. Edit a commodity (open Commodities tab → select a commodity → Edit). Save changes — the plugin will call the backend endpoint `PUT /commodities/<symbol>` which maps to `update_commodity_metadata` in `src/backend/journal_api.py`.

6. Update prices: run `bean-price` or use the plugin's prices endpoint (if available) to populate `dependencies/prices.beancount`.

If you see errors, open the developer console in Obsidian (View → Toggle Developer Tools) — `BackendManager` forwards backend stdout/stderr to the console.
