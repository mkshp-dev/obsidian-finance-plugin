---
sidebar_position: 8
---

# Settings

The Settings page is where you configure the plugin to work with your Beancount ledger. Settings are organized into six tabs for easy navigation and configuration.

---

## 📋 Overview

Settings are accessible via **Settings → Community Plugins → Beancount Ledger**. The interface is organized into these tabs:

1. **General** - Currency, automatic price fetching, and debug settings
2. **Connection** - Beancount executable and system configuration
3. **File Organization** - Structured layout options
4. **BQL** - Query display preferences and editor settings
5. **Performance** - Data fetch limits
6. **Backup** - Backup and recovery settings

---

## ⚙️ General Tab

### Operating Currency
*   **Purpose**: The primary currency for reporting and as the default in transaction forms.
*   **Examples**: `USD`, `EUR`, `INR`, `GBP`
*   **Impact**: All balance calculations and Net Worth displays use this currency as the base.
*   **Validation**: Validated as a valid 3-letter currency code on input.

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

> **Tip**: You can also trigger a manual fetch at any time via Command Palette → **"Fetch Commodity Prices"**.
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

### Status Indicators
After detection, you'll see status icons for:
*   **✅ Ready**: The component is correctly configured and working.
*   **⚠️ Warning**: The component exists but may have issues.
*   **❌ Error**: The component is not found or not working. Click to see error details.

### Manual Configuration
If automatic detection fails, you can:
1.  **Set Python Executable Path**: Enter the full path to your Python 3 executable.
2.  **Set Beancount File Path**: Enter the absolute path to your `.beancount` file.
3.  **Set Beancount Command Path**: Enter the full path to `bean-query`.

### Test Commands
Verify your setup with individual test buttons:
*   **Test Bean Check**: Validates Beancount file syntax (runs `bean-check`).
*   **Test Bean Query**: Tests BQL query execution.
*   **Test Bean Query CSV**: Validates CSV output format.
*   **Test All Commands**: Runs all tests sequentially.

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
├── balances.beancount        # Balance assertions
├── pads.beancount            # Pad directives
├── notes.beancount           # Note directives
├── events.beancount          # Event directives
├── queries.beancount         # Named query directives
└── transactions/             # Folder for transaction files
    ├── 2024.beancount        # Transactions by year
    ├── 2025.beancount
    └── 2026.beancount
```

### Configuration Options
*   **Folder Name**: Name of the root folder for structured layout (default: `Finances`).
*   **Importing Existing Ledgers**: If you have an existing single-file ledger, the plugin can import and organize it into this structured layout via the onboarding wizard.

---

## 📊 BQL Tab

Customize how Beancount Query Language results are displayed in your notes.

### Show Query Tools
*   **Default**: Enabled ✅
*   **Purpose**: Displays toolbar buttons above BQL code block results:
    *   **Refresh (⟳)**: Re-run the query with fresh data.
    *   **Copy (📋)**: Copy raw CSV results to clipboard.
    *   **Download (📥)**: Export results as a CSV file.

### Show Query Text
*   **Default**: Disabled ❌
*   **Purpose**: Shows the original BQL query above results.

### Editor Settings
*   **Account Name Autocomplete**: Toggle account name popup while typing.
*   **Editor Autocomplete**: Toggle payee, narration, currency, tag, and link autocomplete.
*   **Editor Diagnostics (Linting)**: Select between *Off*, *On save*, or *On change* validation.
*   **Format on Save**: Format `.beancount` files automatically on save.

---

## ⚡ Performance Tab

Optimize plugin performance for your hardware and ledger size.

### Max Transaction Results
*   **Default**: 2000
*   **Purpose**: Limits the number of transactions fetched for the Transactions tab. Lower this if the Dashboard feels sluggish.

### Max Journal Results
*   **Default**: 1000
*   **Purpose**: Limits entries displayed per page in the Journal tab.

---

## 💾 Backup Tab

Configure automatic backups for data safety.

### Create Backups
*   **Default**: Enabled ✅
*   **Purpose**: Automatically creates timestamped backup files before modifying your Beancount files.
*   **Backup Format**: `<filename>.backup.<YYYYMMDD-HHMMSS>`

### Max Backup Files
*   **Default**: 10
*   **Purpose**: Maximum number of backup files to keep (set to `0` for unlimited). Oldest backups are automatically deleted when the limit is exceeded.
