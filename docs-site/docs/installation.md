---
sidebar_position: 8
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

The plugin relies on a Python backend to parse Beancount files and run queries.

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

*Verify installation:*
Open your terminal and run:
```bash
bean-query --version
```
If this command works, you are ready to go.

### 3. Optional Dependencies
- **bean-price**: For fetching online prices. Usually included with Beancount, or install via `pip install bean-price`.

---

## ⚙️ Configuration

After installation, go to the plugin settings to configure your environment.

1.  **Open Settings**: Settings → Community Plugins → Finance Plugin.
2.  **Connection Panel**: The plugin will attempt to auto-detect your Python and Beancount paths.
    - If valid, you will see Green checks.
    - If not, you may need to manually specify the paths (especially on Windows or custom setups).
3.  **Beancount File**: Select your main ledger file (e.g., `main.beancount` or `ledger.bean`).

### WSL Support
If you use Windows Subsystem for Linux (WSL), the plugin fully supports it.
- **Path Format**: Use the WSL path format (e.g., `/mnt/c/Users/Name/Documents/ledger.beancount`).
- **Python Path**: Point to the python executable inside WSL (e.g., `/usr/bin/python3`).

---

## 🔄 Updating
To update the plugin:
- **Community Plugins**: Click "Check for updates" in the Obsidian settings.
- **Manual**: Download the new release files and replace the old ones.
