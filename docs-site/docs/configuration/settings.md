---
sidebar_position: 1
---

# Settings

The Settings page is where you configure the plugin to work with your Beancount ledger. Settings are organized into six tabs for easy navigation and configuration.

## 📋 Overview

Settings are accessible via **Settings → Plugin Options → Beancount Finance Plugin**. The interface is organized into these tabs:

1. **General** - Currency and debug settings
2. **Connection** - Beancount and system configuration
3. **File Organization** - Structured layout options
4. **BQL** - Query display preferences
5. **Performance** - Data fetch limits
6. **Backup** - Backup and recovery settings

---

## ⚙️ General Tab

### Operating Currency
- **Purpose**: The primary currency for reporting and as the default in transaction forms.
- **Examples**: `USD`, `EUR`, `INR`, `GBP`
- **Impact**: All balance calculations and Net Worth displays use this currency as the base.
- **Validation**: Validated as a valid 3-letter currency code on input.

### Debug Mode
- **Purpose**: Enable detailed logging to the browser console for troubleshooting.
- **When to Enable**: If you encounter issues and need to inspect what the plugin is doing.
- **Access Logs**: Open Obsidian's Developer Console with `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS).
- **Output Prefix**: Plugin logs are prefixed with `[Beancount]` for easy filtering.

---

## 🔌 Connection Tab

This is the most critical tab. It manages the connection between the plugin and your Beancount installation.

### Automatic System Detection
On startup, the plugin automatically detects:
- **Python Executable**: Searches PATH and standard installation locations for Python 3.
- **Beancount Installation**: Verifies `bean-query` command is available.
- **Beancount File**: Finds your main ledger file (if it was previously configured).
- **WSL Availability**: Checks if Windows Subsystem for Linux is running (for Windows users).

### Status Indicators
After detection, you'll see status icons for:
- **✅ Ready**: The component is correctly configured and working.
- **⚠️ Warning**: The component exists but may have issues.
- **❌ Error**: The component is not found or not working. Click to see error details.

### Manual Configuration
If automatic detection fails, you can:

1. **Set Python Executable Path**: Enter the full path to your Python 3 executable
   - Windows: `C:\Python39\python.exe` or `wsl python3`
   - macOS/Linux: `/usr/local/bin/python3`
   - WSL on Windows: `wsl python3`

2. **Set Beancount File Path**: Enter the absolute path to your `.beancount` file
   - Windows: `C:\Users\YourName\Documents\finances.beancount`
   - macOS/Linux: `/home/username/finances.beancount`
   - WSL Path: `/mnt/c/Users/YourName/Documents/finances.beancount`

3. **Set Beancount Command Path**: Enter the full path to `bean-query`
   - Windows: `C:\Python39\Scripts\bean-query.exe`
   - macOS/Linux: `/usr/local/bin/bean-query`
   - WSL: `wsl bean-query`

### Test Commands
Verify your setup with individual test buttons:
- **Test Bean Check**: Validates Beancount file syntax (runs `bean-check`)
- **Test Bean Query**: Tests BQL query execution
- **Test Bean Query CSV**: Validates CSV output format
- **Test All Commands**: Runs all tests sequentially

---

## 📁 File Organization Tab

Configure how your Beancount ledger is organized.

### Structured Layout

The plugin supports two organizational approaches:

#### Single File Mode (Default)
- All Beancount directives in one `.beancount` file
- Simple, traditional approach
- Good for smaller ledgers or existing setups

#### Structured Layout Mode
- Organizes your ledger into multiple files by type
- Recommended for larger ledgers or better organization
- Easier to navigate and maintain

**Folder Structure:**
```
Finances/
├── ledger.beancount          # Main file with includes
├── accounts.beancount         # Account opening directives
├── commodities.beancount      # Commodity declarations
├── prices.beancount           # Price directives
├── balances.beancount         # Balance assertions
├── pads.beancount            # Pad directives
├── notes.beancount           # Note directives
├── events.beancount          # Event directives
└── transactions/             # Folder for transaction files
    ├── 2024.beancount        # Transactions by year
    ├── 2025.beancount
    └── 2026.beancount
```

### Configuration Options

**Use Structured Layout**
- **Default**: Disabled
- **When Enabled**: The plugin will create/use the structured folder layout
- **Migration**: Can convert existing single-file ledgers to structured layout

**Folder Name**
- **Default**: `Finances`
- **Purpose**: Name of the root folder for structured layout
- **Location**: Created in your vault root directory
- **Customizable**: Use any folder name you prefer (e.g., `Accounting`, `Ledger`, `Books`)

### Migration to Structured Layout

If you have an existing single-file ledger and want to switch to structured layout:

1. **Enable** "Use Structured Layout" in settings
2. **Set** your desired folder name
3. **Save** settings - the plugin will offer to migrate your data
4. **Confirm** migration in the popup modal
5. **Review** the newly created structured folder

The migration process:
- Parses your existing ledger
- Organizes directives by type into appropriate files
- Creates yearly transaction files
- Preserves all your data and formatting
- Creates a backup of your original file

### Benefits of Structured Layout

**Organization:**
- Easier to find specific types of entries
- Clearer separation of concerns
- Better for version control (smaller diffs)

**Performance:**
- Faster loading for large ledgers
- Easier to edit specific sections
- Better IDE/editor performance

**Collaboration:**
- Multiple people can work on different files
- Reduced merge conflicts
- Clearer git history

### Working with Structured Layout

When structured layout is enabled:
- **New transactions** are automatically added to the current year's transaction file
- **Other directives** (accounts, prices, etc.) are added to appropriate files
- **Querying** works the same - the main ledger file includes all sub-files
- **Editing** can be done in the plugin or directly in the files

---

## 📊 BQL Tab

Customize how Beancount Query Language results are displayed in your notes.

### Show Query Tools
- **Default**: Enabled ✅
- **Purpose**: Displays toolbar buttons above BQL code block results:
  - **Refresh (⟳)**: Re-run the query with fresh data
  - **Copy (📋)**: Copy raw CSV results to clipboard
  - **Download (📥)**: Export results as a CSV file
- **Disable If**: You prefer cleaner output without UI controls.

### Show Query Text
- **Default**: Disabled ❌
- **Purpose**: Shows the original BQL query above results.
- **Enable If**: You want to see/debug the SQL being executed or learn BQL syntax.

### Shortcuts Template File
- **Purpose**: Path to a markdown file defining reusable BQL shortcuts.
- **Format**: Create a file like `BQL_Shortcuts.md` with shorthand query definitions:
  ```markdown
  ## WORTH: Net Worth
  ```bql-shorthand
  SELECT convert(sum(position), 'USD')
  WHERE account ~ '^(Assets|Liabilities)'
  ```
  ```
- **Usage**: Reference shortcuts as `bql:WORTH` in inline queries.
- **Helper Button**: Click **"Create Template"** to generate a starter file with common shortcuts.

---

## ⚡ Performance Tab

Optimize plugin performance for your hardware and ledger size.

### Max Transaction Results
- **Default**: 2000
- **Purpose**: Limits the number of transactions fetched for the Transactions tab.
- **Guidance**: Lower this if the Dashboard feels sluggish (try 500-1000).
- **Impact**: Does NOT affect the Journal view (which uses server-side pagination).

### Max Journal Results
- **Default**: 1000
- **Purpose**: Limits entries displayed per page in the Journal tab.
- **Guidance**: Lower for faster page loads, increase if you have a small ledger.

---

## 💾 Backup Tab

Configure automatic backups for data safety.

### Create Backups
- **Default**: Enabled ✅
- **Purpose**: Automatically creates timestamped backup files before modifying your Beancount file.
- **Backup Format**: `<filename>.backup.<YYYYMMDD-HHMMSS>`
- **When Created**: Every time you add/edit/delete a transaction, balance assertion, or note.
- **Location**: Saved in the same directory as your main Beancount file.

### Max Backup Files
- **Default**: 10
- **Purpose**: Maximum number of backup files to keep.
- **Behavior**:
  - `0` = Keep all backups (unlimited)
  - `>0` = Automatically delete oldest backups when limit is exceeded
- **Example**: With setting of 10, you'll always have the 10 most recent backups.

### Recovery
To restore from a backup:
1. Open your vault file browser
2. Locate the backup file (e.g., `finances.beancount.backup.20231025-143022`)
3. Copy its contents or rename it to restore
