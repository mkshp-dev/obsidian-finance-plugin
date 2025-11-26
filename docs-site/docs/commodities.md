---
sidebar_position: 5
---

# Commodities

The Commodities page explains how commodity metadata is managed and how the UI maps to file changes.

Metadata fields
- `logo`: URL for the commodity logo
- `price`: bean-price style source (string) used by `bean-price` or the plugin's validation

How editing works
1. Open the Commodities tab in the Unified Dashboard.
2. Select a commodity and click Edit — this opens a modal populated from the backend `GET /commodities/<symbol>` which reads the `data.Commodity` directive and filters internal metadata keys (see `filter_user_metadata` in `src/backend/journal_api.py`).
3. When you Save, the frontend calls `PUT /commodities/<symbol>` with payload `{ "metadata": { ... } }`. The backend's `update_commodity_metadata` will:
   - Attempt to find the original commodity declaration by `entry.meta['lineno']` and edit in-place.
   - If lineno is missing or cannot be used, fall back to appending a new declaration using `create_commodity_declaration`.

Example payload

```json
{
  "metadata": { "logo": "https://example.com/logo.png", "price": "bean-price example" }
}
```

Safety and backups
- All write operations create a backup file named `<file>.backup.YYYYmmdd_HHMMSS` before overwriting.
- Internal Beancount metadata keys like `lineno` and `filename` are filtered out of user metadata and are not written back to the ledger.

Troubleshooting
- If edits fail with index errors, check the backend logs for `lineno` diagnostics and ensure your ledger file isn't modified concurrently by another tool.
