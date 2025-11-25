---
sidebar_position: 2
---

# Installation

This page explains how to install and enable the Obsidian Finance Plugin and its backend dependencies.

Supported environment
- Obsidian (desktop) — plugin is `isDesktopOnly` (see `manifest.json`).
- Node.js and npm required to build the plugin UI; Python 3 and `beancount` are required for the backend.

Steps (end users)
1. Copy or clone the plugin folder into your vault plugins folder:

```powershell
# Windows (PowerShell)
Copy-Item -Path ".\obsidian-finance-plugin" -Destination "$env:APPDATA\Obsidian\VaultName\.obsidian\plugins" -Recurse
```

2. Open Obsidian -> Settings -> Community plugins -> Enable plugin.

Backend requirements
- Python 3.10+ recommended.
- Install Beancount (used by the backend):

```powershell
# inside plugin workspace virtualenv
.venv\Scripts\python.exe -m pip install beancount
```

Bean-price (optional but recommended)
- `bean-price` is used to generate `dependencies/prices.beancount`.
- On Windows, use the `bean-price.exe` binary or install via your package manager. On WSL use the Linux `bean-price` installation.

PowerShell redirection note
- Avoid using `>>` in PowerShell for `bean-price` output — PowerShell may re-encode or add a BOM. Use the provided Python helper or run via `cmd /c` or `Start-Process`.

Developer installation
- Clone the repo, create a Python venv and install `beancount`.
- Install Node dependencies and build the plugin:

```bash
cd docs-site # optionally to run docs
cd <plugin-root>
npm install
npm run build
```

See `development.md` for a full developer setup and recommended versions.
