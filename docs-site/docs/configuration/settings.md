---
sidebar_position: 1
---

# Settings

The Settings page is where you configure the bridge between Obsidian and your Beancount ledger.

## 🔌 Connection Panel

This is the heartbeat of the plugin. It manages the link to the Python backend.

### Automatic Detection
On startup, the plugin runs `SystemDetector` to find:
- **Python Executable**: Checks `PATH` and standard install locations.
- **Beancount Library**: Verifies `import beancount` works.
- **WSL Availability**: Checks if Windows Subsystem for Linux is active.

### Manual Configuration
If auto-detection fails, you can toggle **Manual Mode**:
- **Python Path**: Enter the full path to your python executable (e.g., `/usr/local/bin/python3`).
- **Bean-Query Path**: Enter the path to `bean-query`.

### Diagnostic Tools
Use the status indicators to troubleshoot:
- **✅ Ready**: The component is working correctly.
- **❌ Error**: Click the icon to see the error message (e.g., "Module not found").

---

## 📝 Transaction Form

- **Operating Currency**: The primary currency for your ledger (e.g., `USD`, `EUR`). This affects:
    - Default currency in the "Add Transaction" modal.
    - Currency conversion for Net Worth and Balance Sheet totals.

---

## 🚀 Performance

- **Max Transaction Results**: Limit the number of transactions fetched in the dashboard (Default: 2000).
    - *Lower this if the dashboard feels sluggish.*
- **Max Journal Results**: Limit entries in the Journal view (Default: 1000).

---

## 📊 BQL Code Blocks

Customize the appearance of ```` ```bql ```` blocks in your notes.

- **Show query tools**: Toggles the toolbar (Refresh, Copy, Download CSV) above tables.
- **Show query text**: Displays the raw SQL query above the results. Useful for debugging or learning BQL.

---

## ⌨️ BQL Shortcuts

- **Shortcuts template file**: Path to a markdown file (e.g., `BQL_Shortcuts.md`) that defines reusable queries.
    - Click **Create Template** to generate a starter file with common queries like `WORTH`, `ASSETS`, etc.

---

## 🛠 Under the Hood

When settings are changed:
1.  **Validation**: Inputs like currency codes are regex-validated immediately.
2.  **Persistence**: Settings are saved to `data.json` in the plugin folder.
3.  **Backend Restart**: Changing the Python path or Beancount file triggers `BackendProcess.ts` to restart the Flask server with the new configuration.
4.  **Live Reload**: BQL code blocks in open notes are automatically refreshed to reflect changes (e.g., toggling "Show query tools").
