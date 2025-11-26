Dev tools — developer helper scripts
===================================

This folder contains developer helper scripts that are useful for manual testing and debugging. These are not part of the plugin runtime and are safe to move out of the repository root.

Scripts

- `run_validate.py`
  - Purpose: Run a couple of validation helpers from `src/backend/journal_api.py` (`validate_logo_url`, `validate_price_source`) and print results.
  - Usage: `python dev-tools/run_validate.py`

- `run_update_commodity.py`
  - Purpose: Exercise the `update_commodity_metadata()` path in `src/backend/journal_api.py` for a symbol (example uses `BTC`). Useful when debugging metadata writes and backup creation.
  - Usage: `python dev-tools/run_update_commodity.py`

- `run_show_diff.py`
  - Purpose: Show a unified diff between a backup commodity file and the target file. The paths in the script are currently absolute; edit them to point at your local files.
  - Usage: `python dev-tools/run_show_diff.py`

- `run_show_commodity_details.py`
  - Purpose: Print `get_commodity_details()` output and reconstruct a commodity declaration for inspection.
  - Usage: `python dev-tools/run_show_commodity_details.py`

Notes
- These scripts reference absolute paths to your working tree (`C:\Users\Asus\Documents\Vaults\plugin_maker\ledger.beancount`) — edit them if you run the scripts from another environment.
- Keep these scripts in `dev-tools/` or archive them; they are not required for plugin packaging.
