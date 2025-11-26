---
sidebar_position: 6
---

# Prices

This page covers how to update commodity prices using `bean-price` and how to avoid common PowerShell pitfalls.

What `bean-price` does
- `bean-price` evaluates a Beancount price expression or generates price directives for a ledger. The plugin uses it to produce `dependencies/prices.beancount`.

WSL vs PowerShell
- Running `bean-price` under WSL works and the shell redirection `>>` produces clean UTF-8 text:

```bash
bean-price ../../../ledger.beancount >> ../../../dependencies/prices.beancount
```

- In PowerShell, using `>>` can cause encoding or BOM issues because PowerShell may re-encode output (Out-File uses UTF-16 by default). This leads to “garbage” in the file.

Safe PowerShell options
- Use `Start-Process` with redirection:

```powershell
Start-Process -FilePath 'bean-price.exe' -ArgumentList '..\..\..\ledger.beancount' -RedirectStandardOutput '..\..\..\dependencies\prices.beancount' -NoNewWindow -Wait
```

- Or pipe through `Out-File` with explicit UTF-8 encoding:

```powershell
bean-price.exe ..\..\..\ledger.beancount 2>&1 | Out-File -FilePath ..\..\..\dependencies\prices.beancount -Encoding utf8 -Append
```

Recommended approach: backend helper
- The plugin includes (or can call) a backend helper that runs `bean-price` via Python and writes `dependencies/prices.beancount` with `encoding='utf-8'`. This avoids shell-specific quirks. See `run_bean_price_and_write` in `src/backend/journal_api.py` and the API endpoint `/prices/update` (if present).

Example: call the plugin endpoint

```http
POST /prices/update
Content-Type: application/json
{
  "beancount_path": "ledger.beancount",
  "out_path": "dependencies/prices.beancount",
  "timeout": 120
}
```

The endpoint runs `bean-price` and writes UTF-8 output to the specified file, returning stdout/stderr for diagnostics.
