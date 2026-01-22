---
sidebar_position: 2
---

# Installation

This guide covers how to install the Obsidian Finance Plugin and set up Beancount integration.

## 📦 Plugin Installation

### Method 1: Community Plugins (Recommended)
*Note: Once approved by Obsidian.*
1.  Open Obsidian **Settings** → **Community Plugins**.
2.  Turn off "Restricted mode".
3.  Click **Browse** and search for **"Finance Plugin"**.
4.  Click **Install** and then **Enable**.

### Method 2: Manual Installation (BRAT / GitHub)
1.  Download the latest `main.js`, `manifest.json`, and `styles.css` from the [GitHub Releases](https://github.com/mkshp-dev/obsidian-finance-plugin/releases) page.
2.  Create a folder named `obsidian-finance-plugin` in your vault's plugin directory: `<VaultFolder>/.obsidian/plugins/`.
3.  Place the downloaded files into this folder.
4.  Reload Obsidian.
5.  Go to **Settings** → **Community Plugins** and enable **Finance Plugin**.

---

## 🐍 Beancount Requirements

The plugin integrates with Beancount command-line tools for querying and validating your ledger.

### 1. Python Environment
You need **Python 3.8 or newer** installed on your system.
- **Windows**: Install from the Microsoft Store or python.org.
- **macOS**: `brew install python`
- **Linux**: Usually pre-installed.

### 2. Beancount
Install the Beancount package via pip:

```bash
pip install beancount
```

This provides the following command-line tools:
- `bean-query`: For running BQL queries
- `bean-check`: For validating Beancount file syntax
- `bean-price`: For fetching commodity prices (optional)

*Verify installation:*
Open your terminal and run:
```bash
bean-query --version
```
If this displays a version number, you are good to go.

---

## ⚙️ Configuration

After installation, you must configure the plugin to point to your ledger.

1.  **Open Settings**: Settings → Community Plugins → Finance Plugin.
2.  **Connection Panel**: The plugin attempts to **auto-detect** your Python environment and Beancount tools.
    - **Status Indicators**: Look for green checkmarks next to Bean-Query, Bean-Check, etc.
    - **Manual Override**: If detection fails, toggle "Manual Configuration" to specify paths.
3.  **Beancount File**: Enter the absolute path to your main ledger file (e.g., `C:\Users\You\Documents\ledger.beancount` or `/home/you/finance/main.bean`).
4.  **Test Commands**: Use the "Test All Commands" button to verify everything works.

### WSL Support (Windows)
The plugin has native support for **Windows Subsystem for Linux (WSL)**.
1.  Ensure Python and Beancount are installed *inside* your WSL distribution.
2.  In Settings, the plugin should detect "WSL (Default)" if available.
3.  You can use Windows-style paths (e.g., `C:\...`) and the plugin will automatically convert them to `/mnt/c/...` for command execution.

---

## 🛠 Under the Hood

The plugin uses a **pure TypeScript/Svelte architecture**:

1.  **System Detection**: `SystemDetector.ts` scans your environment (PATH, Registry, WSL) to find a valid Python executable and `bean-query` binary.
2.  **Direct CLI Execution**: All queries run via direct `bean-query` command execution with proper shell escaping.
3.  **Atomic File Operations**: Transaction creation/updates use atomic writes (temp file + rename) with optional backups.
4.  **No Server Needed**: Unlike v1.x, there is no backend server process - everything runs directly via CLI tools.
