# Obsidian Beancount Plugin

A plugin for [Obsidian.md](https://obsidian.md) to integrate your [Beancount](https://beancount.github.io/docs/) plain-text accounting ledger directly into your vault. View financial snapshots and add new transactions without leaving your notes.



---

## Features

* **Sidebar Dashboard:** Get a quick financial snapshot with key metrics like Assets, Liabilities, and Net Worth.
* **Interactive Reports:** Instantly switch between Balance Sheet, Income, and Expenses reports directly in the sidebar.
* **Quick Transaction Entry:** Use a simple command and modal form to add new transactions to your Beancount file.
* **External Tool Powered:** Leverages the full power and accuracy of your existing Beancount installation.

---

##  Requirements

This plugin acts as a user interface for the Beancount command-line tools. You **must** have the following installed on your system:

1.  **Python 3**
2.  **Beancount (v3 or higher):** The plugin relies on the `bean-query` command. The recommended installation is via pip: `pip install beancount`.
3.  **(For Windows Users)** If you are running Beancount within WSL, this plugin will work by prefixing commands with `wsl.exe`.

---

## Installation & Configuration

1.  Download the latest release from the GitHub releases page (or build it yourself).
2.  Copy the `main.js`, `styles.css`, and `manifest.json` files to your vault's plugin folder: `<YourVault>/.obsidian/plugins/<your-plugin-name>/`.
3.  Enable the plugin in Obsidian's community plugin settings.
4.  Go to the plugin's settings page.
5.  In the "Path to beancount file" field, enter the **absolute path** to your main Beancount ledger file.
    * **Important:** If using WSL, this must be the Linux-style path (e.g., `/mnt/c/Users/YourUser/Documents/finances.beancount`).

---

## Usage

### Viewing Reports

1.  Click the **dollar sign icon (`$`)** in the left-hand ribbon to open the Beancount Snapshot sidebar.
2.  The sidebar will automatically load your key metrics and a default balance sheet.
3.  Use the **[Balance]**, **[Income]**, and **[Expenses]** buttons to switch between reports.
4.  Click the **[Refresh]** button to reload all data from your ledger file.

### Adding a Transaction

1.  Open the command palette (`Ctrl/Cmd + P`).
2.  Search for and run the command **"Add Beancount Transaction"**.
3.  A modal form will appear. Fill in the transaction details.
4.  Click **"Add Transaction"**. The new entry will be appended to the bottom of your configured Beancount file.