---
sidebar_position: 1
---

# Obsidian Finance Plugin — Overview

This documentation covers the **Obsidian Finance Plugin**: a Beancount-integrated dashboard for Obsidian that provides transaction management, commodity metadata editing (logo & price sources), and price updates via `bean-price`.

Key features:
- Unified dashboard for transactions, balances, and charts.
- Commodity metadata editor (logo URL, price source) with safe file writes.
- Backend API that operates directly on your Beancount ledger (`src/backend/journal_api.py`).

Quick links:
- Installation: `installation.md`
- Quick start: `quick-start.md`
- Commodities & prices: `commodities.md`, `prices.md`
- Backend API reference: `backend-api.md`

This site is kept with Docusaurus under `docs-site/`. To preview locally:

```bash
cd docs-site
npm install
npm run start
# Visit http://localhost:3000
```

If you are a developer, see `development.md` for the developer workflow and how the plugin loads the Python backend via `src/backend/BackendManager.ts`.
