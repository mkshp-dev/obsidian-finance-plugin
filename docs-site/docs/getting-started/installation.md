---
sidebar_position: 2
---

# Installation

This guide covers how to install Beancount for Obsidian and the required dependencies.

## 📦 Plugin Installation

### Method 1: Community Plugins (Recommended)
*Note: Once approved by Obsidian.*
1.  Open Obsidian **Settings** → **Community Plugins**.
2.  Turn off "Restricted mode".
3.  Click **Browse** and search for **"Beancount for Obsidian"**.
4.  Click **Install** and then **Enable**.

### Method 2: Manual Installation (GitHub Releases)
1.  Download the latest `main.js`, `manifest.json`, and `styles.css` from the [GitHub Releases](https://github.com/mkshp-dev/obsidian-finance-plugin/releases) page.
2.  Create a folder named `obsidian-finance-plugin` in your vault's plugin directory: `<VaultFolder>/.obsidian/plugins/`.
3.  Place the downloaded files into this folder.
4.  Reload Obsidian.
5.  Go to **Settings** → **Community Plugins** and enable **Beancount for Obsidian**.

### Method 3: BRAT (Beta Testing)
For testing beta versions:
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Use BRAT to add: `mkshp-dev/obsidian-finance-plugin`
3. Select the `dev` branch for latest features
4. Enable the plugin in Community Plugins

---

## 🐍 Beancount Requirements

The plugin requires Beancount command-line tools to function.

### 1. Python Environment
Install **Python 3.8 or newer**:
- **Windows**: [python.org](https://www.python.org/downloads/) or Microsoft Store
- **macOS**: `brew install python`
- **Linux**: Usually pre-installed (`python3 --version` to check)

### 2. Beancount
Install via pip:

```bash
pip install beancount
```

This provides:
- `bean-check`: For validating Beancount file syntax
- `bean-price`: For fetching commodity prices (optional)

### 3. Beanquery (Required)
Bean-query is **not** included with Beancount and must be installed separately:

```bash
pip install beanquery
```

This provides:
- `bean-query`: For running BQL queries (essential for the plugin)

**Verify Installation:**
```bash
python --version      # Should show 3.8+
bean-check --version  # Should display version
bean-query --version  # Should display version
```

### Platform-Specific Notes

**Windows:**
- Add Python Scripts folder to PATH: `C:\Users\YourName\AppData\Local\Programs\Python\Python3X\Scripts\`
- Restart terminal/Obsidian after installation

**macOS:**
- Use `pip3` instead of `pip`
- May need to install Xcode Command Line Tools: `xcode-select --install`

**Linux:**
- Use `pip3` for Python 3.x
- Debian/Ubuntu: `sudo apt install python3-pip`

**WSL (Windows Subsystem for Linux):**
- Install Python and Beancount inside your WSL distribution
- Plugin auto-detects WSL and handles path conversion
- Use Linux-style paths: `/mnt/c/...`

---

## ⚙️ Next Steps

After installation:

1. **Run First-Time Setup**: The [Onboarding Modal](./first-time-setup.md) appears automatically
2. **Or Configure Manually**: Go to **Settings → Beancount for Obsidian → Connection**
3. **Test Connection**: Use "Test All Commands" to verify everything works

See [First-Time Setup](./first-time-setup.md) for the complete onboarding walkthrough.
