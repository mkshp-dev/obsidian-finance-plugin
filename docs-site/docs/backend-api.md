---
sidebar_position: 9
---

# Backend API Reference

This page documents the REST endpoints exposed by the plugin backend implemented in `src/backend/journal_api.py`.

Endpoints

- `GET /health`
  - Description: health check
  - Response: `{ "status": "ok", "timestamp": "..." }`

- `GET /commodities?detailed=true`
  - Description: list commodities with metadata and latest price
  - Maps to: `get_commodities_detailed()`

- `GET /commodities/<symbol>`
  - Description: get details for a single commodity
  - Maps to: `get_commodity_details()`

- `PUT /commodities/<symbol>`
  - Description: create/update commodity metadata
  - Payload: `{ "metadata": { <key>: <value>, ... } }`
  - Maps to: `update_commodity_metadata()` and `create_commodity_declaration()`

- `POST /commodities/<symbol>/validate_price`
  - Description: validate `price` metadata using `bean-price -e`
  - Payload: `{ "price": "<price_meta>" }`
  - Maps to: `validate_price_source()`

- `POST /prices/update`
  - Description: run `bean-price` and write to dependencies/prices.beancount (if implemented)
  - Payload: optional `{ "beancount_path": "...", "out_path": "...", "timeout": 120 }`
  - Maps to: `run_bean_price_and_write()` (if present)

- Transaction endpoints
  - `GET /transactions` (list)
  - `POST /transactions` (create) -> `add_entry_to_file()`
  - `PUT /transactions/<id>` (update) -> `update_transaction_in_file()`
  - `DELETE /transactions/<id>` -> `delete_transaction_from_file()`

Error handling
- Successful responses typically return `{ "success": true, ... }` or domain objects.
- Errors return `{ "success": false, "error": "message" }` or HTTP 400/500. Check backend logs for diagnostics.

Notes
- All write operations create backups named `<filename>.backup.YYYYmmdd_HHMMSS` before mutating files.
- The backend filters internal metadata keys (`lineno`, `filename`) from user-visible metadata (`filter_user_metadata`).
