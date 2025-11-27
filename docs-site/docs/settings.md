---
sidebar_position: 9
---

# Settings

The Settings page allows you to configure the connection to your Beancount environment and customize the plugin's behavior.

## 🔌 Connection Panel

The **Connection** section is the most critical part of the setup. It ensures the plugin can communicate with your Python environment and Beancount tools.

### System Detection
The plugin automatically detects:
- **Platform**: Windows, macOS, Linux, or WSL.
- **Python Path**: Location of the python executable.
- **Beancount Path**: Location of the `bean-query` tool.

### Testing Tools
The panel includes a suite of test buttons to verify your configuration:

1.  **Bean Check**: Validates your Beancount file syntax.
    - *Success*: "No errors found."
    - *Failure*: Lists specific syntax errors (line numbers, messages).
2.  **Bean Query**: Tests if the plugin can execute a basic BQL query.
3.  **Bean Query CSV**: Verifies that the query output can be parsed as CSV.
4.  **Backend API Server**: Tests if the Python backend process can start.
5.  **Test All Commands**: Runs all tests in sequence.

*Tip: If any test fails, check the error message for hints. Common issues include incorrect paths or missing `beancount` pip package.*

---

## 📂 File Configuration

- **Beancount File Path**: The absolute path to your main ledger file.
    - **Choose from Vault**: Button to select a file inside your Obsidian vault.
    - **Manual Entry**: Useful if your file is outside the vault.

---

## ⚙️ General Options

- **Price File Path**: Specific file path to write price updates to (defaults to your main file if not set).
- **Default Currency**: The currency used for new transactions (e.g., `USD`).
- **Reporting Currency**: The currency used to value your Net Worth and Balance Sheet (e.g., `USD`, `EUR`).

---

## 📊 BQL Settings

Customize how BQL query results appear in your notes:

- **Results per Page**: Default number of rows in query tables (default: 20).
- **Show Query**: Whether to display the SQL code block above the results table by default.
- **Table Width**: Controls if the table creates a horizontal scrollbar or wraps text.

---

## ⌨️ Hotkeys

You can configure keyboard shortcuts in Obsidian's **Settings → Hotkeys** menu:

- **Open Finance Dashboard**: Opens the main view.
- **Add Beancount Transaction**: Opens the quick entry modal.
- **Refresh Dashboard**: Reloads data from the file.
