# Release Notes - v2.0.0 (Beta 1)

**Release Date:** $(date +%Y-%m-%d)
**Tag:** v2.0.0

This is the first major Beta release of the **Obsidian Finance Plugin**, featuring a complete overhaul of the UI, a new unified transaction modal, and a powerful Python backend for performance.

## 🌟 Highlights

*   **Unified Transaction Modal**: Create Transactions, Balance Assertions, and Notes from a single, tabbed interface. Smart validation ensures your ledger stays clean.
*   **Journal View**: A full Fava-style ledger view with advanced filtering (by date, payee, tag) and full CRUD support.
*   **Performance**: A new Python backend handles parsing and querying, keeping Obsidian fast even with large Beancount files.
*   **BQL Integration**: Run Beancount Query Language queries directly in your notes using ` ```bql ` blocks or inline `` `bql:...` `` syntax.
*   **Commodities & Pricing**: Integrated Yahoo Finance search to easily add and track stock/crypto prices.

## ⚠️ Requirements

*   **Python 3.8+**
*   **Beancount** (`pip install beancount`)
*   **Windows Users**: WSL is highly recommended.

## 🛠️ Installation (Manual / BRAT)

1.  Download `main.js`, `manifest.json`, and `styles.css` from the assets below.
2.  Create a folder `obsidian-finance-plugin` in `.obsidian/plugins/`.
3.  Copy the files there and reload Obsidian.
4.  **Important**: Go to Settings -> Finance Plugin and configure your Beancount file path.

## 🐛 Known Issues

*   The backend uses port `5013` by default. Ensure this port is free.
*   On first load, the plugin might take a few seconds to detect your Python environment.

---
*Feedback is welcome! Please report bugs on the GitHub Issues page.*
