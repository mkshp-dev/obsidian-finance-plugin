---
sidebar_position: 2
---

# Installation

This guide covers how to install the Obsidian Finance Plugin and set up the necessary backend environment.

## 📦 Plugin Installation

### Method 1: Community Plugins (Recommended)
*Note: Once approved by Obsidian.*
1.  Open Obsidian **Settings** → **Community Plugins**.
2.  Turn off "Restricted mode".
3.  Click **Browse** and search for **"Finance Plugin"**.
4.  Click **Install** and then **Enable**.

### Method 2: Manual Installation (BRAT / GitHub)
1.  Download the latest `main.js`, `manifest.json`, and `styles.css` from the [GitHub Releases](https://github.com/mukundshelake/obsidian-finance-plugin/releases) page.
2.  Create a folder named `obsidian-finance-plugin` in your vault's plugin directory: `<VaultFolder>/.obsidian/plugins/`.
3.  Place the downloaded files into this folder.
4.  Reload Obsidian.
5.  Go to **Settings** → **Community Plugins** and enable **Finance Plugin**.

---

## 🐍 Backend Requirements

The plugin relies on a local Python backend to parse Beancount files and run queries efficiently.

### 1. Python Environment
You need **Python 3.8 or newer** installed on your system.
- **Windows**: Install from the Microsoft Store or python.org.
- **macOS**: `brew install python`
- **Linux**: Usually pre-installed.

### 2. Beancount
Install the Beancount package via pip:

```bash
pip install beancount flask flask-cors
```

**Note**: The plugin requires `flask` and `flask-cors` to run the local API server.

*Verify installation:*
Open your terminal and run:
```bash
python3 -c "import beancount; import flask; print('Ready')"
```
If this prints "Ready", you are good to go.

### 3. Optional Dependencies
- **bean-price**: For fetching online prices. Usually included with Beancount, or install via `pip install bean-price`.

---

## ⚙️ Configuration

After installation, you must configure the plugin to point to your ledger.

1.  **Open Settings**: Settings → Community Plugins → Finance Plugin.
2.  **Connection Panel**: The plugin attempts to **auto-detect** your Python environment and Beancount tools.
    - **Status Indicators**: Look for green checkmarks next to Python, Bean-Query, etc.
    - **Manual Override**: If detection fails, toggle "Manual Configuration" to specify paths.
3.  **Beancount File**: Enter the absolute path to your main ledger file (e.g., `C:\Users\You\Documents\ledger.beancount` or `/home/you/finance/main.bean`).

### WSL Support (Windows)
The plugin has native support for **Windows Subsystem for Linux (WSL)**.
1.  Ensure Python and Beancount are installed *inside* your WSL distribution.
2.  In Settings, the plugin should detect "WSL (Default)" if available.
3.  You can use Windows-style paths (e.g., `C:\...`) and the plugin will automatically convert them to `/mnt/c/...` for the backend.

---

## 🛠 Under the Hood

When you enable the plugin, the following process occurs:

1.  **System Detection**: `SystemDetector.ts` scans your environment (PATH, Registry, WSL) to find a valid Python executable and `bean-query` binary.
2.  **Backend Launch**: `BackendProcess.ts` spawns a child process running `src/backend/journal_api.py`. This is a lightweight Flask server running on `localhost:5013`.
3.  **API Connection**: The frontend (`ApiClient.ts`) polls the health endpoint (`/health`) until the server is ready.
4.  **Data Flow**: All heavy lifting (parsing files, running BQL queries) is offloaded to this Python process, ensuring the Obsidian UI remains responsive.
