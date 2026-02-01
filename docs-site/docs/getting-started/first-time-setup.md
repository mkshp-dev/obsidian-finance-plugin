---
sidebar_position: 3
---

# First-Time Setup

This guide walks you through your first experience with the Obsidian Finance Plugin using the **3-step onboarding process**.

## 🚀 Automatic Onboarding

When you first enable the plugin, the **Onboarding Modal** automatically appears if no Beancount file is configured. You can also launch it anytime via Command Palette: **"Obsidian Finance: Run Setup/Onboarding"**.

The onboarding uses a **step-by-step wizard** with progress indicator to ensure your system is properly configured.

---

## Step 1: Prerequisites Check 🔍

Before setting up your ledger files, the plugin verifies your system has the required software installed.

### Required Software

- **Python 3.8 or higher**: The runtime environment for Beancount
- **Beancount v3+**: The accounting engine with `bean-query` command

Optional:
- **bean-price**: For automated price fetching (can be added later)

### Running the Check

1. Click **"🔍 Check Prerequisites"** button
2. The plugin automatically detects:
   - Python executable and version
   - bean-query command and version  
   - System environment (Windows, macOS, Linux, WSL)

### Results

#### ✅ All Prerequisites Met
If all requirements are satisfied, you'll see:
- Python command path and version
- bean-query command path and version
- **"Next: File Setup →"** button to proceed

The detected commands are automatically saved to your settings.

#### ❌ Prerequisites Not Met
If requirements are missing, you'll see:
- Specific items that failed (Python or bean-query)
- Platform-specific installation instructions
- Link to official Beancount documentation
- Option to **"Skip (Manual Config)"** for later setup

### Installation Instructions

The modal displays platform-specific instructions based on your OS:

**Windows:**
```powershell
# Install Python from python.org
# Then in PowerShell:
pip install beancount
bean-query --version
```

**macOS:**
```bash
brew install python@3.11
pip3 install beancount
bean-query --version
```

**Linux:**
```bash
sudo apt install python3 python3-pip  # Debian/Ubuntu
pip3 install beancount
bean-query --version
```

See the [official Beancount installation guide](https://beancount.github.io/docs/installing_beancount.html) for detailed instructions.

### Skipping Prerequisites Check

You can click **"Skip (Manual Config)"** to bypass the check and configure commands manually later in **Settings → Connection** tab. This is useful if:
- You have Beancount installed in a non-standard location
- You're using WSL or a custom Python environment
- You want to configure later

---

## Step 2: File Setup 📁

## Step 2: File Setup 📁

After prerequisites are verified, choose your starting point.

### Two Paths Available

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
1. **Select File**: Choose from existing `.beancount` files in your vault via dropdown
2. **Or Enter Path Manually**: Provide absolute path to file outside vault
3. **Configure Folder**: Set the folder name for structured layout (default: "Finances")
4. **Migration**: Plugin automatically migrates single file to structured layout

**Path Examples:**
- Inside vault: Select from dropdown
- Outside vault: `C:\Users\You\Documents\finances.beancount`
- WSL: `/mnt/c/Users/You/Documents/finances.beancount`

### Navigation

- **← Back to Prerequisites**: Return to Step 1
- **Start Setup**: Proceed with chosen configuration

---

## Step 3: Verification ✅

After setup completes, you'll see a success screen with:

### Configuration Summary

- Python command and version
- Bean-query command
- File mode (Structured Layout)
- Data source (Demo or Existing)
- Folder location

### Next Steps Provided

1. Open the Finance Dashboard
2. Explore the 5 tabs (Overview, Transactions, Journal, Balance Sheet, Commodities)
3. Try BQL queries in markdown notes
4. Customize settings

### Actions

- **Open Dashboard & Close**: Opens the unified dashboard view and closes the modal
- **Close**: Just close the modal (can open dashboard later via Command Palette)

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
