---
sidebar_position: 8
---

# Settings

The Settings page is where you configure the plugin to work with your Beancount ledger. Settings are organized into six tabs for easy navigation and configuration.

---

## 📋 Overview

Settings are accessible via **Settings → Community Plugins → Beancount Ledger**. The interface is organized into these tabs:

1. **General** - Currency, dashboard defaults, automatic price fetching, and debug settings
2. **Connection** - Beancount executable and system configuration
3. **File Organization** - Structured layout options
4. **Editor** - Autocomplete, snippets, formatting, and linting
5. **BQL** - Query display preferences
6. **Performance** - Data fetch limits and backups

---

## ⚙️ General Tab

### Operating Currency
*   **Purpose**: The primary currency for reporting and as the default in transaction forms.
*   **Examples**: `USD`, `EUR`, `INR`, `GBP`, `BTC`
*   **Impact**: All balance calculations and Net Worth displays use this currency as the base.
*   **Validation**: Must start with an uppercase letter, followed by any combination of uppercase letters, digits, or `' . _ -` (not limited to 3 characters, to support tickers like `BTC` or `GOLD`).
*   **Save to ledger**: A button next to the field writes the `operating_currency` option directly into your `ledger.beancount` file.

### Default Dashboard Period
*   **Purpose**: The period shown by dashboard summaries when the Unified Dashboard first loads.
*   **Options**: `This month`, `Last month`, `This year`, `Last year`.

### Debug Mode
*   **Purpose**: Enable detailed logging to the browser console for troubleshooting.
*   **When to Enable**: If you encounter issues and need to inspect what the plugin is doing.
*   **Access Logs**: Open Obsidian's Developer Console with `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS).
*   **Output Prefix**: Plugin logs are prefixed with `[Beancount]` for easy filtering.

### Automatic Price Fetching
This section controls how the plugin runs `bean-price` to keep your commodity prices up to date.

*   **Enable automatic price fetching**: When enabled, the plugin runs `bean-price <ledger>` at a regular interval, extracts price directives from stdout, and appends any new ones to `prices.beancount` (duplicates are skipped automatically).
*   **Fetch interval (hours)**: How frequently the automatic fetch runs (default: 24 hours).
*   **Last automatic fetch**: Displays when the most recent automatic fetch ran, shown as a relative time (e.g., *2 hours ago*).

> **Tip**: You can also trigger a manual fetch at any time via Command Palette → **"Fetch commodity prices"**.
>
> See the [Automated Price Fetching](./adding-data/adding-price-metadata.md) guide for details on annotating commodities with price sources.

---

## 🔌 Connection Tab

This tab manages the connection between the plugin and your Beancount installation.

### Automatic System Detection
On startup, the plugin automatically detects:
*   **Python Executable**: Searches PATH and standard installation locations for Python 3.
*   **Beancount Installation**: Verifies `bean-query` command is available.
*   **Beancount File**: Finds your main ledger file (if it was previously configured).
*   **WSL Availability**: Checks if Windows Subsystem for Linux is running (for Windows users).

### Manual Configuration
If automatic detection fails, you can:
1.  **Set Beancount Command Path**: Enter the full path to `bean-query` (or `wsl bean-query`).
2.  **Set Bean-price Command Path**: Enter the full path to `bean-price`, for price fetching.

Each field has its own **Verify** button, which runs the command against a trivial query and shows ✅ on success or ❌ with the error output on failure.

---

## 📁 File Organization Tab

Configure how your Beancount ledger is organized.

### Structured Layout
The plugin organizes your finances using a structured folder layout with multiple files by type:
```
Finances/
├── ledger.beancount          # Main file with includes
├── accounts.beancount        # Account opening directives
├── commodities.beancount     # Commodity declarations
├── prices.beancount          # Price directives
├── pads.beancount            # Pad directives
├── balances.beancount        # Balance assertions
├── queries.beancount         # Named query directives
├── notes.beancount           # Note directives
├── events.beancount          # Event directives
└── transactions/             # Folder for transaction files
    ├── 2024.beancount        # Transactions by year (or by year/month, see below)
    ├── 2025.beancount
    └── 2026.beancount
```

### Configuration Options
*   **Folder Name**: Name of the root folder for structured layout (default: `Finances`). Click **Edit** to rename it — the plugin renames the physical vault folder and reloads dependent caches (snippets, journal) automatically.
*   **Transaction File Organization**: `Yearly` (e.g. `transactions/2025.beancount`) or `Monthly` (e.g. `transactions/2025/2025-01.beancount`).
*   **Importing Existing Ledgers**: If you have an existing single-file ledger, the plugin can import and organize it into this structured layout via the onboarding wizard.

---

## 📝 Editor Tab

*   **Editor Autocomplete**: A single toggle that enables context-aware completions in `.beancount` files — account names, payees, narrations, currencies/commodities, tags (`#`), and links (`^`). Reopen the file to apply changes.
*   **User-defined snippets**: Enable loading custom transaction templates from a standalone `snippets.beancount` file inside your structured layout folder. Start typing at the beginning of a line to autocomplete a snippet.
*   **Format on Save**: Automatically format `.beancount` files on save — normalizes indentation to 2 spaces, right-aligns amounts, and fixes `@`/`@@` price annotation spacing. Off by default.
*   **Inline Lint Mode**: Select between *Off*, *On save* (default, ~500ms delay), or *On change* (2s debounce) for inline `bean-check` validation squiggles. Reopen the file to apply changes.

---

## 📊 BQL Tab

Customize how Beancount Query Language results are displayed in your notes.

### Show Query Tools
*   **Default**: Enabled ✅
*   **Purpose**: Displays toolbar buttons above BQL code block results:
    *   **Refresh (⟳)**: Re-run the query with fresh data.
    *   **Copy (📋)**: Copy raw CSV results to clipboard.
    *   **Export (📤)**: Export results as a CSV file.

### Show Query Text
*   **Default**: Disabled ❌
*   **Purpose**: Shows the original BQL query above results.

---

## ⚡ Performance Tab

Optimize plugin performance for your hardware and ledger size, and configure backups.

### Max Transaction Results
*   **Default**: 2000
*   **Purpose**: Limits the number of transactions fetched for the Transactions tab. Lower this if the Dashboard feels sluggish.

### Max Journal Results
*   **Default**: 1000
*   **Purpose**: Limits entries displayed per page in the Journal tab.

### Create Backups
*   **Default**: Enabled ✅
*   **Purpose**: Before modifying a Beancount file, the plugin copies it to `<filename>.bak` in the same folder. This is a single backup that gets overwritten on each subsequent edit — not a rotating or timestamped history — so treat it as a last-edit safety net, not a substitute for version control (e.g. git) if you want a full history of changes.

