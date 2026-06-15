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
Open Command Palette (`Ctrl/Cmd + P`) → **"Obsidian Finance: Run Setup/Onboarding"**

![Onboarding Welcome](/img/Onboarding-modal1.png)

---

## Step 1: Prerequisites Check 🔍

The plugin verifies your system has the required software (Python, Beancount, bean-query, and optionally bean-price).

For a detailed list of system requirements and step-by-step installation instructions for Windows, macOS, Linux, and WSL, please refer to the **[Requirements](./requirements.md)** guide.

![Prerequisites Onboarding Welcome Screen](/img/Onboarding-checkingPreRequisites.png)

### Running the Check

1. Click **"🔍 Check Prerequisites"** button
2. The plugin automatically detects:
   - Python executable and version
   - bean-query command and version  
   - **bean-price** command and version *(optional — green if found, neutral if not)*
   - System environment (Windows, macOS, Linux, WSL)

### Results

#### ✅ All Prerequisites Met
If all requirements are satisfied, you'll see:
- Python command path and version
- bean-query command path and version
- bean-price command path and version *(or a neutral notice if not installed)*
- **"Next: File Setup →"** button to proceed

![Prerequisites Verification Results](/img/Onboarding-checkingPreRequisites_lowerPart.png)

The detected commands are automatically saved to your settings — including `beanPriceCommand` if bean-price was found.

#### ❌ Prerequisites Not Met
If requirements are missing, you'll see:
- Specific items that failed (Python or bean-query)
- Direct link to the **[Requirements](./requirements.md)** guide for install instructions
- Option to **"Skip (Manual Config)"** for later setup


### Skipping Prerequisites

Click **"Skip (Manual Config)"** to configure later in **Settings → Connection**. Useful if:
- You have Beancount installed in a non-standard location
- You're using WSL or a custom Python environment
- You want to configure later

---

## Step 2: File Setup 📁

Choose your starting point after prerequisites are verified.

![File Setup Section](/img/Onboarding-FileSetup_topPart.png)

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
- Users with an existing Beancount file → imports and organizes it into structured layout
- Safe to explore and modify. Delete it anytime and start fresh.

### Option 2: Existing File 📁
**Setup Steps:**
1. **Select File**: Choose from existing `.beancount` files in your vault via dropdown
2. **Or Enter Path Manually**: Provide absolute path to file outside vault
3. **Configure Folder**: Set the folder name for structured layout (default: "Finances")
4. **Import**: Plugin automatically imports and organizes your file into structured layout

![Select or Import Existing File](/img/Onboarding-FileSetup_lowerPart.png)

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

![Verification Summary](/img/Onboarding-verification_topPart.png)

### Configuration Summary

- Python command and version
- Bean-query command
- File organization (Structured Layout)
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

![Onboarding Completed Successfully](/img/Onboarding-verification_lowerPart.png)

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
- Importing a different ledger file
- Starting over with a clean slate

## ⚙️ Post-Setup Configuration

After onboarding completes:

### Verify Connection
1. Open **Settings → Beancount Ledger → Connection**
2. Check for green checkmarks on all tests
3. If any tests fail, review the [Troubleshooting Guide](../troubleshooting.md)

### Configure Preferences
- **Operating Currency**: Set your default currency (USD, EUR, etc.)
- **Automatic Price Fetching**: If bean-price was detected, enable this in **Settings → General** to keep commodity prices up to date automatically
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
- Organized by directive type for better maintainability
- Recommended for all ledgers, especially those with > 500 transactions
- Easy to navigate and version control

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

For more help, see the [Troubleshooting Guide](../troubleshooting.md).
