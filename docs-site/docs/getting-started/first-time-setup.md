---
sidebar_position: 3
---

# First-Time Setup

This guide walks you through your first experience with the Obsidian Finance Plugin.

## 🚀 Automatic Onboarding

When you first enable the plugin, the **Onboarding Modal** automatically appears if no Beancount file is configured. This friendly wizard helps you get started in minutes.

### Onboarding Options

You have two paths to choose from:

#### 📊 Option 1: Start with Demo Data

**Best for:**
- New Beancount users wanting to learn
- Testing the plugin before committing
- Understanding how the plugin works
- Seeing examples of proper Beancount syntax

**What You Get:**
- A complete structured folder layout in your vault
- Sample accounts (checking, savings, investments, credit cards)
- Realistic transactions spanning multiple months
- Example investments with price tracking
- Various transaction types (income, expenses, transfers)
- Properly formatted directives to learn from

**Demo Data Includes:**
- **Accounts**: Assets (Bank, Investments), Liabilities (Credit Card), Income, Expenses
- **Transactions**: Salary deposits, grocery shopping, restaurant meals, utilities, investments
- **Commodities**: Stock tickers (AAPL, GOOGL, VTSAX) with prices
- **Balance Assertions**: Monthly reconciliation examples

The demo data is completely safe to explore and modify. You can delete it anytime and start fresh with your real data.

#### 📁 Option 2: Use Existing Beancount File

**Best for:**
- Existing Beancount users migrating to Obsidian
- Users with an established ledger
- Those wanting to continue with their current setup

**Setup Steps:**
1. **Choose File Location**: Select whether your file is inside or outside your vault
2. **Browse or Enter Path**: Use the file picker or enter the absolute path
3. **Optional Migration**: Choose to keep single-file or migrate to structured layout
4. **Validation**: Plugin tests the file and verifies Beancount can read it

**Path Examples:**
- Inside vault: `My Vault/Finances/ledger.beancount`
- Outside vault: `C:\Users\You\Documents\finances.beancount`
- WSL: `/mnt/c/Users/You/Documents/finances.beancount`

### Structured Layout

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
└── transactions/            # Transaction files by year
    ├── 2024.beancount
    ├── 2025.beancount
    └── 2026.beancount
```

## 🔄 Re-running Onboarding

You can run the onboarding wizard anytime:

1. Open Command Palette (`Ctrl/Cmd + P`)
2. Type "Run Setup/Onboarding"
3. Follow the wizard to reconfigure or start fresh

**Use Cases:**
- Switching from demo data to real data
- Changing folder names or organization
- Migrating from single-file to structured layout
- Starting over with a clean slate

## ⚙️ Post-Setup Configuration

After onboarding completes:

### Verify Connection
1. Open **Settings → Finance Plugin → Connection**
2. Check for green checkmarks on all tests
3. If any tests fail, review the [Troubleshooting Guide](../queries/troubleshooting.md)

### Configure Preferences
- **Operating Currency**: Set your default currency (USD, EUR, etc.)
- **Performance**: Adjust limits based on your ledger size
- **BQL**: Configure query display preferences
- **Backups**: Enable automatic backups (recommended)

### Start Using the Plugin

Once configured, you're ready to:
- **Open Dashboard**: Click the ribbon icon or use Command Palette
- **Add Transactions**: Use the "Add Transaction" command
- **Execute Queries**: Try BQL code blocks in your notes
- **Explore Views**: Check out all dashboard tabs

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
2. **Test Connection**: Ensure bean-query works
3. **Explore Dashboard**: See your real data visualized
4. **Try Features**: Test transaction editing, BQL queries
5. **Consider Migration**: Optionally migrate to structured layout
6. **Customize Settings**: Adjust to your preferences

## 💡 Tips

**Demo Data:**
- Safe to experiment with - can't hurt your real finances
- Delete the demo folder anytime: just remove `Finances/` folder
- Great reference for Beancount syntax examples

**File Paths:**
- Use absolute paths for reliability
- WSL users: use Linux-style paths (`/mnt/c/...`)
- Inside vault: plugin handles path conversion automatically

**Structured Layout:**
- Can migrate later - no need to decide immediately
- Easy to switch back to single file if needed
- Recommended for ledgers > 500 transactions

**Onboarding:**
- Can be run multiple times safely
- Each run offers to backup existing data
- No data loss - always creates backups first

## 🆘 Troubleshooting Onboarding

### Onboarding Modal Doesn't Appear
- Check if `beancountFilePath` is already set in settings
- Manually run: Command Palette → "Run Setup/Onboarding"

### File Path Invalid
- Ensure the file exists and has `.beancount` or `.bean` extension
- Check file permissions (readable by Obsidian)
- For WSL: verify path format is correct

### Demo Data Not Loading
- Check console for errors (Ctrl+Shift+I)
- Ensure vault has write permissions
- Try using a different folder name

### Bean-query Not Found
- Install Beancount: `pip install beancount`
- Verify installation: `bean-query --version` in terminal
- Set manual path in Connection settings if auto-detect fails

For more help, see the [Troubleshooting Guide](../queries/troubleshooting.md).
