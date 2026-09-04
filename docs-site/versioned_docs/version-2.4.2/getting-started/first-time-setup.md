---
sidebar_position: 3
---

# First-Time Setup

This guide walks you through the **3-step onboarding wizard** that appears when you first enable the plugin.

## 🚀 Launching the Onboarding

The **Onboarding Modal** appears automatically when:
- You enable the plugin for the first time
- No Beancount file is configured in settings

**Manual Launch:**
Open Command Palette (`Ctrl/Cmd + P`) → **"Beancount Ledger: Run setup/onboarding"**

---

## Step 1: Connect 🔌

The plugin uses **`bean-query`** (a command-line tool from the Beancount ecosystem) to query your financial data. Obsidian must be able to detect and execute it.

![Connect Onboarding Step](/img/Onboarding-checkingPreRequisites.png)

### Required & Optional Components

- **`bean-query` (Required):** Status indicator (green dot when detected with version badge e.g. `v0.2.0`), absolute executable path, and an **Edit** button to customize the command.
- **`bean-price` (Optional):** Used for automatic commodity price fetching (`Not detected. Install with pip install beanprice to enable automatic price fetching. You can set this up later in Settings.`).

### Detection & Manual Verification

1. **Automatic Detection:** Upon opening Step 1, the plugin automatically scans your system environment for `bean-query` and `bean-price`.
2. **Manual Entry:** Click **Edit** or enter your exact executable command or absolute file path into the command input box.
   - *Common Command Values:* `bean-query`, `wsl bean-query`, `C:\Users\<user>\AppData\Roaming\Python\Python313\Scripts\bean-query.exe`, `/usr/local/bin/bean-query`

### Step Controls

- **Re-detect:** Re-scans your system environment for `bean-query` and `bean-price`.
- **Skip for now:** Bypasses CLI verification so you can proceed with setting up your ledger folder (*Note: Dashboard features require `bean-query` to be configured later in Settings → Connection*).
- **Next: Organize →:** Advances to Step 2.

### Installation Instructions & Prerequisites

If `bean-query` or `bean-price` is not yet installed on your machine, see the complete OS-specific installation guides for Windows, macOS, Linux, Flatpak, and WSL in the [System Requirements & Installation Guide](./requirements.md).

---

## Step 2: Organize 📁

Choose how to start and configure your structured ledger folder layout. All your finance files will be organized inside a single folder in your vault.

![File Setup Section](/img/Onboarding-FileSetup_topPart.png)

### Data Choice Options

#### 📊 Option 1: Start with Demo Data (Recommended for beginners)
- A complete sample ledger with realistic accounts, commodities, and transactions.
- Allows you to explore the dashboard immediately without existing files.
- Includes sample checking, savings, credit card, investment, income, and expense entries.

#### 📁 Option 2: Use My Existing Ledger
- Select an existing `.beancount` file in your vault (or enter a path manually) to migrate it into the structured folder layout.

### Layout & Currency Configuration Options

1. **Folder name:** Specifies the vault folder where organized finance files live (default: `Finances`).
2. **Transaction file period:** Choose how transaction files are grouped inside `transactions/`:
   - **Yearly (e.g. 2026.beancount):** Group entries by calendar year.
   - **Monthly:** Group entries by year and month directory.
3. **Operating currency:** Primary currency for your records (e.g. `USD`, `EUR`, `GBP`).
   - *Note:* Demo data uses USD by default. You can change the operating currency later in Settings.

---

## Step 3: Ready 🎉

After configuring your folder and options, Step 3 displays a success screen (**"🎉 You're all set!"**) with a configuration summary and recommended next steps:

![Verification Summary](/img/Onboarding-verification_topPart.png)

### Configuration Summary

- **bean-query**: Command path & detected version badge (e.g. `v0.2.0`).
- **bean-price**: Connection status (`Not configured (optional)` or verified path).
- **Folder**: Location in vault (e.g. `Finances/`).
- **Data source**: Selected mode (`Demo Data` or `Existing Ledger`).
- **Currency**: Primary operating currency (e.g. `USD`).
- **Transactions**: Grouping scheme (`Yearly files`).

### 🚀 Next Steps Checklist

1. Open the **Finance Dashboard** to explore your financial data.
2. Browse the 6 main tabs: Overview, Transactions, Journal, Accounts & Balances, Income Statement, Commodities.
3. Try BQL queries in your Markdown notes using ` ```bql ` code blocks.
4. Manage commands anytime in **Settings → Connection**.

---

## Structured Layout

Both options create a **structured folder layout** by default. This modern organization approach keeps your ledger maintainable as it grows.

**Why Structured Layout?**
- **Organized**: Directives grouped by type
- **Scalable**: Works well for ledgers of any size
- **Navigable**: Easy to find specific entries
- **Version Control**: Better git diffs and merge handling
- **Collaborative**: Multiple people can work on different files

**Folder Structure Created:**
```
Finances/                      # Your chosen folder name
├── ledger.beancount          # Main file (includes all others)
├── accounts.beancount        # Account opening directives
├── commodities.beancount     # Commodity declarations
├── prices.beancount          # Price directives
├── balances.beancount        # Balance assertions
├── pads.beancount           # Pad directives
├── notes.beancount          # Note directives
├── events.beancount         # Event directives
└── transactions/            # Transaction files by period
    ├── 2024.beancount
    ├── 2025.beancount
    └── 2026.beancount
```

## 🔄 Re-running Onboarding

You can run the onboarding wizard anytime:

1. Open Command Palette (`Ctrl/Cmd + P`)
2. Type **"Beancount Ledger: Run setup/onboarding"**
3. Follow the wizard to reconfigure or start fresh

**Use Cases:**
- Switching from demo data to real data
- Changing folder names or organization
- Importing a different ledger file
- Re-detecting or updating `bean-query` / `bean-price` commands

## ⚙️ Post-Setup Configuration

After onboarding completes:

### Verify Connection
1. Open **Settings → Beancount Ledger → Connection**
2. Check for green checkmarks on all tests
3. If any tests fail, review the [Troubleshooting Guide](../troubleshooting.md)

### Configure Preferences
- **Operating Currency**: Set your default currency (USD, EUR, etc.)
- **Automatic Price Fetching**: If `bean-price` was detected, enable this in **Settings → General** to keep commodity prices up to date automatically
- **Performance**: Adjust limits based on your ledger size
- **BQL**: Configure query display preferences
- **Backups**: Enable automatic backups (recommended)

---

## 🎓 Learning Path

### For New Beancount Users

1. **Start with Demo Data**: Explore the sample ledger
2. **Open Dashboard**: See your financial overview
3. **Examine Transactions**: Look at the demo entries in the Journal tab
4. **Try Editing**: Modify a demo transaction to understand the workflow
5. **Learn BQL**: Execute some sample queries
6. **Read Beancount Docs**: Visit [Beancount Documentation](https://beancount.github.io/docs/)

### For Existing Beancount Users

1. **Point to Your Ledger**: Use existing file option
2. **Test Connection**: Ensure `bean-query` works
3. **Explore Dashboard**: See your real data visualized
4. **Try Features**: Test transaction editing, BQL queries
5. **Consider Migration**: Optionally migrate to structured layout
6. **Customize Settings**: Adjust to your preferences

---

## 💡 Tips

**Demo Data:**
- Safe to experiment with - can't hurt your real finances
- Delete the demo folder anytime: just remove `Finances/` folder
- Great reference for Beancount syntax examples

**File Paths:**
- Use absolute paths for reliability
- WSL users: use `wsl bean-query` command and Linux-style paths
- Inside vault: plugin handles path conversion automatically

**Structured Layout:**
- Organized by directive type for better maintainability
- Recommended for all ledgers, especially those with > 500 transactions
- Easy to navigate and version control

---

## 🆘 Troubleshooting Onboarding

### Onboarding Modal Doesn't Appear
- Check if onboarding is already completed in settings
- Manually run: Command Palette → **"Beancount Ledger: Run setup/onboarding"**

### File Path Invalid
- Ensure the file exists and has `.beancount` extension
- Check file permissions (readable by Obsidian)
- For WSL: verify path format is correct

### Bean-query Not Found
- Install Beancount & beanquery: `pip install beancount beanquery`
- Verify installation: `bean-query --version` in terminal
- Set manual path in Connection settings or Step 1 manual command input if auto-detect fails
- If using Flatpak, grant filesystem permission via `flatpak override --filesystem=...`

For more help, see the [Troubleshooting Guide](../troubleshooting.md).
