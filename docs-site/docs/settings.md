---
sidebar_position: 8
---

# Settings

This page describes plugin settings and environment configuration.

Where settings live
- Plugin-level settings are managed via `src/settings.ts` and exposed in the Obsidian settings UI.

Important configuration values
- `bean-price` path: If `bean-price` is not on PATH, set the full path in the environment or configure the backend to use `bean-price.exe` on Windows.
- Timeouts: price generation may take time. The backend helpers accept a `timeout` parameter (seconds).

Environment variables
- `NO_COLOR=1` and `TERM=dumb` are used by the backend when running `bean-price` to avoid color/control escapes.

Advanced
- If you run the backend manually, create a venv and export environment variables before launching:

```bash
python -m venv .venv
.venv/Scripts/activate
pip install beancount
export NO_COLOR=1
python src/backend/journal_api.py ledger.beancount
```

On Windows/PowerShell set environment variables with `$env:NO_COLOR='1'` before starting the backend.
