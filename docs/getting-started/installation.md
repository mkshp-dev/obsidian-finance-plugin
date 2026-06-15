---
sidebar_position: 2
---

# Installation

This guide covers how to install the **Beancount Ledger** plugin in your Obsidian vault. 

> [!NOTE]
> Before running the plugin, ensure you have set up Python and Beancount on your machine. See the [Requirements](./requirements.md) guide for details.

---

## 📦 Installation Methods

You can install the plugin using one of the three methods below.

### Method 1: Obsidian Community Plugins (Recommended)
Once the plugin is approved and listed in the official Obsidian store, this is the easiest method:
1.  Open Obsidian and go to **Settings** → **Community Plugins**.
2.  Turn off **Restricted mode** if it is enabled.
3.  Click **Browse** and search for **"Beancount Ledger"**.
4.  Click **Install**, and then click **Enable**.

---

### Method 2: BRAT (Beta Testing / Latest Features)
If you want to test the absolute latest development versions or pre-releases, you can use the **Obsidian42 - BRAT** plugin:
1.  Install the **BRAT** plugin from Obsidian's Community Plugins directory.
2.  Enable BRAT in your settings.
3.  Open the Command Palette (`Ctrl/Cmd + P`) and run `BRAT: Add a beta plugin for testing`.
4.  Enter the repository URL: `mkshp-dev/obsidian-finance-plugin`
5.  Click **Add Plugin**. BRAT will download and enable the plugin.
6.  *Optional*: In BRAT settings, you can choose to track the `dev` branch to test experimental changes before they are released.

---

### Method 3: Manual Installation (GitHub Releases)
If you need to install the plugin manually or without internet access:
1.  Go to the [GitHub Releases](https://github.com/mkshp-dev/obsidian-finance-plugin/releases) page.
2.  Download the latest release zip or files: `main.js`, `manifest.json`, and `styles.css`.
3.  Navigate to your Obsidian vault folder.
4.  Go to the hidden plugins directory: `<VaultFolder>/.obsidian/plugins/` (you may need to show hidden files in your OS file explorer).
5.  Create a new folder named `beancount-finance`.
6.  Place the downloaded `main.js`, `manifest.json`, and `styles.css` files into this folder.
7.  Reload Obsidian or restart the app.
8.  Go to **Settings** → **Community Plugins** and enable **Beancount Ledger**.

---

## ⚙️ Next Steps

Once the plugin is installed and enabled, it will detect if you have a ledger configured. If you don't, it will automatically launch the onboarding setup wizard to guide you through connecting Python and creating your first Beancount files.

See the [First-Time Setup](./first-time-setup.md) guide to proceed.
