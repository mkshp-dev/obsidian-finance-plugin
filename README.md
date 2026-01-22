# Obsidian Finance Plugin

A comprehensive financial dashboard plugin for [Obsidian.md](https://obsidian.md) that integrates with your [Beancount](https://beancount.github.io/docs/) plain-text accounting ledger. Transform your vault into a powerful financial analysis tool with interactive dashboards, detailed reports, and seamless transaction management.

## 🌟 Features

### 📊 **Overview Dashboard**
- **Net Worth Tracking**: Real-time asset and liability monitoring
- **Monthly Trends**: Income vs expenses with visual charts
- **Asset Allocation**: Portfolio distribution with interactive charts
- **Quick Metrics**: Key financial indicators at a glance

### 💸 **Transaction Management** ⭐ **ENHANCED**
- **Unified Entry Modal**: Create and edit transactions, balance assertions, and notes in one interface
- **Tab-based Entry Types**: Switch between Transaction, Balance, and Note entry types
- **Smart Validation**: Type-specific validation for each entry type
- **Auto-complete**: Intelligent suggestions for accounts, payees, and tags
- **Real-time Search**: Instant transaction lookup across all criteria
- **Full CRUD Operations**: Create, read, update, and delete with confirmation dialogs

### 🏦 **Account Hierarchy**
- **Interactive Tree**: Expandable account structure with drill-down capability
- **Balance Views**: Real-time balances for all account levels
- **Account Analytics**: Track account performance and trends
- **Multi-currency Support**: Proper currency conversion and display

### � **Balance Sheet Reporting**
- **Asset Tracking**: Comprehensive asset portfolio overview
- **Liability Management**: Monitor debts and obligations
- **Equity Analysis**: Track net worth changes over time
- **Period Comparisons**: Month-over-month and year-over-year analysis

### 🪙 **Commodities & Pricing** ⭐ **ENHANCED**
- **Yahoo Finance Integration**: Simplified symbol search with direct links to major financial websites
- **Easy Symbol Configuration**: Manual symbol entry with helpful examples and quick-select common stocks, ETFs, and crypto
- **Price Metadata Management**: Configure automated price sources in the format `USD:yahoo/SYMBOL`
- **Visual Status Indicators**: Quick overview with color-coded pricing status (🟢 automated, ⚪ manual)
- **Compact Card Layout**: Optimized grid display that efficiently uses screen space
- **Multi-currency Support**: Support for stocks, forex, and cryptocurrencies with proper formatting

### 📋 **Journal View** ⭐ **ENHANCED**
- **Complete Transaction Display**: Full Beancount ledger format with all postings and metadata
- **Comprehensive Entry Management**: View, edit, and delete all entry types (transactions, balance assertions, notes)
- **BQL-Powered Queries**: Efficient data retrieval using Beancount Query Language
- **Advanced Filtering**: Client-side filtering by account, payee, tags, date ranges, or search terms
- **Direct File Operations**: All CRUD operations performed directly on Beancount files with atomic writes
- **Fava-style Interface**: Clean, expandable transaction cards with proper formatting

### 🔍 **BQL Code Blocks & Inline Queries** ⭐ **NEW**
- **Native Query Integration**: Execute Beancount Query Language (BQL) directly in your notes
- **Dual Query Modes**: 
  - **Code Blocks**: `​```bql` for formatted table results with export capabilities
  - **Inline Queries**: `bql:query` for live financial values embedded in text
- **Template Shorthand System**: Create custom shortcuts like `bql-sh:WORTH` for frequently used queries
- **Live Results**: Queries execute automatically and display current data from your ledger  
- **Interactive Tables**: Sortable, responsive tables with proper formatting
- **Export Capabilities**: Copy results to clipboard or download as CSV
- **Template File Management**: All shortcuts defined in user-customizable template files
- **Real-time Data**: Always shows current data from your Beancount ledger

---

## 🔧 Requirements

This plugin integrates with your existing Beancount setup:

1. **Beancount v3+**: Install via `pip install beancount`
2. **bean-query**: Command-line tool for querying Beancount files (included with Beancount)
3. **bean-check**: Validation tool (included with Beancount)
4. **bean-price** *(optional)*: For automatic commodity price fetching
5. **WSL Support**: Full compatibility for Windows users running Beancount in WSL

**Note**: Python is only required for Beancount CLI tools. No separate backend server needed.

---

## 📦 Installation

### From Obsidian Community Plugins *(Coming Soon)*
1. Open Obsidian Settings → Community Plugins
2. Search for "Finance Plugin" or "Beancount"
3. Install and enable the plugin

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/mukundshelake/obsidian-finance-plugin/releases)
2. Extract files to `<vault>/.obsidian/plugins/obsidian-finance-plugin/`
3. Enable the plugin in Obsidian Settings → Community Plugins

---

## ⚙️ Configuration

### Basic Setup
1. **Open Plugin Settings**: Settings → Plugin Options → Finance Plugin
2. **Connection Panel**: The first section provides comprehensive setup and testing
   - **System Detection**: Automatic detection of Python, Beancount, and required tools
   - **File Selection**: Choose your Beancount file from vault or enter absolute path
   - **Command Testing**: Individual test buttons for all 4 critical commands:
     - **Bean Check**: Validates Beancount file syntax
     - **Bean Query**: Tests BQL query execution  
     - **Bean Query CSV**: Validates CSV output format
     - **Backend API Server**: Tests Python backend connectivity
   - **Batch Testing**: "Test All Commands" button for comprehensive validation
3. **Path Configuration**: 
   - Windows: `C:\Users\YourName\Documents\finances.beancount`
   - macOS/Linux: `/home/username/finances.beancount`
   - WSL: `/mnt/c/Users/YourName/Documents/finances.beancount`

### Configuration Sections
- **Connection**: Comprehensive system setup and command testing
- **Transaction Form**: Default and reporting currency settings
- **Performance**: Max results and pagination limits
- **BQL Code Blocks**: Display preferences for query results  
- **BQL Shortcuts Template**: Custom shorthand query configuration

### Architecture

The plugin uses a **pure TypeScript/Svelte architecture** with no backend server:

- **BQL Queries**: Direct execution via `bean-query` CLI for all data retrieval
- **File Operations**: Atomic writes with backup support for all CRUD operations
- **Transaction Parsing**: Smart line-based parsing to preserve formatting and comments
- **Cross-platform**: Full support for Windows, macOS, Linux, and WSL

### How It Works

- All data queries execute via Beancount's `bean-query` command-line tool
- Transactions, balances, and notes are read/written directly to your Beancount file
- File modifications use atomic writes (temp file + rename) with optional backups
- No server processes, no network calls, no API dependencies

---

## 🔍 Using BQL Queries

The plugin includes powerful **BQL (Beancount Query Language)** functionality with two distinct modes for different use cases.

### 📊 **BQL Code Blocks** - For Detailed Analysis

Create formatted tables with full query results:

1. **Insert Code Block**: Manually type:
   ````markdown
   ```bql
   SELECT account GROUP BY account ORDER BY account
   ```
   ````

2. **Interactive Results**: 
   - **Refresh** (⟳): Re-run query with latest data
   - **Copy** (📋): Copy raw CSV results to clipboard
   - **Export** (📤): Download results as CSV file
   - **View Query**: Toggle query visibility

### 💰 **Inline BQL Queries** - For Live Financial Data ⭐ **NEW**

Embed live financial values directly in your text using single backticks:

#### **Direct Queries:**
```markdown
My current net worth is `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`

Today I have `bql:SELECT convert(sum(position), 'USD') WHERE account ~ 'Checking'` in my checking account.
```

#### **Shorthand System:**
First, configure shortcuts in your template file, then use them:

```markdown
My total worth: `bql-sh:WORTH`
Checking balance: `bql-sh:CHECKING`  
Monthly expenses: `bql-sh:EXPENSES_MTD`
```

### ⚙️ **Template File System**

All shortcuts are defined in a **user-customizable template file**:

1. **Configure Template Path**: Settings → Finance Plugin → BQL Shortcuts Template Path
2. **Example Template Format**:
   ```markdown
   ## WORTH: Total net worth in USD
   ```bql-shorthand
   SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'
   ```
   
   ## CHECKING: Checking account balance
   ```bql-shorthand
   SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'
   ```
   ```

3. **Completely Customizable**: Create any shortcuts you want with your preferred currencies and account patterns

### Common BQL Query Examples

**List All Accounts:**
```bql
SELECT account GROUP BY account ORDER BY account
```

**Recent Transactions:**
```bql
SELECT date, payee, narration, account, position ORDER BY date DESC LIMIT 20
```

**Account Balances:**
```bql
SELECT account, sum(position) GROUP BY account ORDER BY account
```

**Asset Accounts:**
```bql
SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account
```

**Income This Year:**
```bql
SELECT account, sum(position) WHERE account ~ '^Income' AND year = YEAR(TODAY()) GROUP BY account
```

**Monthly Expenses:**
```bql
SELECT year, month, sum(position) WHERE account ~ '^Expenses' GROUP BY year, month ORDER BY year DESC, month DESC
```

### 🎯 **Use Cases**

**Code Blocks** - Perfect for:
- Financial analysis and reporting
- Detailed account breakdowns  
- Data export for spreadsheets
- Complex multi-column queries

**Inline Queries** - Perfect for:
- Daily journal entries: "Spent `bql-sh:DAILY_EXPENSES` today"
- Quick financial summaries: "Net worth: `bql-sh:WORTH`"  
- Status updates: "Emergency fund: `bql-sh:EMERGENCY_FUND`"
- Goal tracking: "Savings progress: `bql-sh:SAVINGS_GOAL`"

### BQL Integration Benefits

- **Live Data**: Always shows current data from your Beancount ledger
- **Template System**: No built-in defaults - everything is user-defined
- **Note-Taking Workflow**: Perfect for financial journaling and analysis
- **No External Tools**: Execute queries directly within Obsidian
- **Dual Modes**: Choose the right format for your needs
- **Custom Shortcuts**: Create personalized financial shortcuts

---

## 🛠️ Troubleshooting

### Command Execution Issues

If queries or operations fail:

1. **Check Beancount Installation**: Ensure `bean-query` and `bean-check` commands work in terminal
2. **Verify File Path**: Ensure Beancount file path is correct in plugin settings
3. **Test Commands**: Use Settings → Connection → "Test All Commands" for validation
4. **Check Console**: Open Developer Tools (Ctrl+Shift+I) for detailed error messages
5. **WSL Users**: Ensure path conversion is working properly for Windows/WSL file access

### Liabilities & Net Worth Presentation

Important: Beancount often stores liabilities as negative numbers (this is standard). To make the Snapshot/Sidebar clearer for users:

- Liabilities are displayed as a positive magnitude in the UI (e.g. `200 USD` instead of `-200 USD`).
- Net Worth is calculated as Assets - Liabilities (where Liabilities is treated as the positive magnitude). The UI preserves overpaid/credit balances correctly (if a liability becomes positive in Beancount, the net worth calculation accounts for that).

This presentation makes the Snapshot easier to read while preserving accounting semantics under the hood.

### Connection Validation & Testing ⭐ **ENHANCED**

The plugin includes a comprehensive connection validation panel that ensures all components work correctly:

**3-Command Testing Suite**:
- **Bean Check**: Validates Beancount file syntax and reports errors
- **Bean Query**: Tests BQL query execution with sample queries
- **Bean Query CSV**: Validates CSV output format for data export

**Smart System Detection**:
- Platform detection (Windows, macOS, Linux, WSL)
- Python executable and version detection  
- Automatic path format handling (Windows vs WSL)
- Real-time command validation with detailed error reporting

**Professional Testing Interface**:
- Individual test buttons for each command with real-time status indicators
- "Test All Commands" for comprehensive batch validation
- Transparent command display showing exactly what will be executed
- Detailed error messages and success confirmations
- No external dependencies or hanging processes

**Benefits**:
- **Confidence**: Know your setup works before using the plugin
- **Debugging**: Clear error messages help resolve configuration issues
- **Cross-Platform**: Handles Windows, WSL, macOS, and Linux environments seamlessly
- **User-Friendly**: Visual status indicators (⭕ pending, 🔄 running, ✅ success, ❌ failed)

### Selecting a Beancount file from the vault

If your `.beancount` file lives inside your Obsidian vault, you can choose it directly from the plugin Settings using the "Choose from vault" button next to the Beancount file path input. The plugin will set the absolute filesystem path (so external tools like `bean-query` can read it) and validate the file automatically.

### Yahoo Finance Symbol Search

The **Commodities tab** includes a simplified Yahoo Finance integration that helps you find and configure ticker symbols for automated price fetching.

#### How It Works

1. **Browse Financial Websites**: Click buttons to open major financial websites in new tabs
   - **Yahoo Finance** - https://finance.yahoo.com/
   - **Google Finance** - https://www.google.com/finance/
   - **Bloomberg** - https://www.bloomberg.com/markets/
   - **MarketWatch** - https://www.marketwatch.com/
   - **Investing.com** - https://www.investing.com/
   - **Morningstar** - https://www.morningstar.com/

2. **Find Your Symbol**: Search for your desired stock, ETF, or crypto on any of these sites and copy the ticker symbol

3. **Quick Examples**: Use pre-populated examples organized by category:
   - **Popular Stocks**: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, NFLX
   - **ETFs**: SPY, QQQ, VTI, VOO, IVV  
   - **Cryptocurrency**: BTC-USD, ETH-USD, ADA-USD, SOL-USD

4. **Configure Price Source**: Enter the symbol manually or click an example to automatically generate the Beancount price metadata in the format `USD:yahoo/SYMBOL`

#### Benefits

- **No API Dependencies**: No API keys, rate limits, or CORS issues
- **Always Up-to-Date**: Uses official financial websites with the most current symbol information
- **User-Controlled**: You research and verify symbols on professional financial sites
- **Educational**: Learn about different financial data sources and their coverage
- **Flexible**: Works with any symbol that Yahoo Finance supports for price fetching

This approach provides a reliable, user-friendly way to configure automated price sources for your Beancount commodities without the complexity of API management.

## Usage Guide

---

## 🚀 Usage

### Opening the Dashboard
1. Click the **💰** icon in the left ribbon, or
2. Use Command Palette: `Ctrl/Cmd + P` → "Open Finance Dashboard"

### Navigating Tabs

#### **Overview Tab**
- View key metrics: Total Assets, Liabilities, Net Worth
- Analyze monthly income and expense trends
- Quick financial health snapshot

#### **Transactions Tab**
- Browse all transactions with pagination
- Filter by date range, account, payee, or tags
- Search transactions instantly
- Export filtered results

#### **Balance Sheet Tab**
- Real-time balance sheet with Assets, Liabilities, Equity
- Hierarchical account grouping with collapsible sections
- Multi-currency conversion support
- Multiple valuation methods (Market Value, At Cost, Units)

#### **Commodities Tab** ⭐ **ENHANCED**
- **Compact Grid Layout**: Optimized card sizes that fit content better without excessive whitespace
- **Yahoo Finance Symbol Search**: Simplified workflow with direct links to major financial websites
- **Quick Symbol Entry**: Manual symbol input with helpful examples organized by category
- **Common Symbol Library**: Pre-populated examples for popular stocks (AAPL, GOOGL, MSFT), ETFs (SPY, QQQ, VTI), and cryptocurrencies (BTC-USD, ETH-USD)
- **Financial Website Integration**: One-click access to Yahoo Finance, Google Finance, Bloomberg, MarketWatch, Investing.com, and Morningstar
- **Price Metadata Configuration**: Easy setup of automated price sources in `USD:yahoo/SYMBOL` format
- **Status Indicators**: Visual indicators showing which commodities have automated price fetching (🟢) vs manual entry (⚪)
- **Mobile Responsive**: Optimized grid layout that works well on all screen sizes

#### **Journal Tab** ⭐ **ENHANCED**
- View complete Beancount transactions in ledger format with all postings
- **Edit and Delete**: Full CRUD operations with inline editing modals
- **Multiple Entry Types**: Support for transactions, balance assertions, and notes
- Expand transactions to see full details including metadata and tags
- Advanced filtering by account, payee, tags, date ranges
- **Direct file operations** - All changes written atomically with backups
- Real-time updates reflected immediately across all views

### Creating Entries ⭐ **NEW UNIFIED MODAL**
1. **Command Palette**: `Ctrl/Cmd + P` → "Add Beancount Transaction"
2. **Choose Entry Type**:
   - **💰 Transaction Tab**: Full double-entry transactions with postings, payee, narration, tags, and links
   - **⚖️ Balance Tab**: Balance assertions with account, amount, currency, and optional tolerance
   - **📝 Note Tab**: Account notes with comments for documentation
3. **Smart Validation**: Type-specific validation ensures proper Beancount syntax
4. **Auto-complete**: Intelligent suggestions for accounts, payees, and tags
5. **Save**: Entry appended to your Beancount file with automatic backup

### Managing Existing Entries
1. **From Journal Tab**: Click edit button on any transaction
2. **Full Editor**: Same unified modal interface for editing
3. **Delete Option**: Confirmation dialog for safe deletion
4. **Real-time Updates**: Changes reflected immediately in all views

### Available Commands
Access these commands through the Command Palette (`Ctrl/Cmd + P`):

- **Add Beancount Transaction**: Opens unified entry modal with tabs for transactions, balance assertions, and notes
- **Open Beancount Unified Dashboard**: Opens the main dashboard with all tabs (Overview, Transactions, Balance Sheet, Accounts, Commodities, Journal)
- **Open Beancount Snapshot**: Opens the sidebar view for quick financial metrics

*Note: You can set custom keyboard shortcuts for these commands in Settings → Hotkeys → Finance Plugin*

---

## 🎯 Use Cases

### **Personal Finance Management**
- Track daily expenses and income
- Monitor investment portfolios
- Analyze spending patterns
- Plan budgets and financial goals

### **Investment Tracking**
- Monitor stock, crypto, and commodity prices
- Track portfolio performance
- Analyze asset allocation
- Generate investment reports

### **Business Accounting**
- Manage business accounts and transactions
- Generate financial statements
- Track assets and liabilities
- Export data for tax preparation

### **Multi-Currency Operations**
- Handle international transactions
- Track foreign exchange positions
- Convert between currencies for reporting
- Manage global investment portfolios

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/mukundshelake/obsidian-finance-plugin.git
cd obsidian-finance-plugin

# Install dependencies
npm install

# Start development build
npm run dev

# Build for production
npm run build
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Beancount](https://beancount.github.io/) - The amazing plain-text accounting system
- [Obsidian](https://obsidian.md) - The knowledge management platform
- The Beancount and Obsidian communities for inspiration and support

---

## 🐛 Support

- **Issues**: [GitHub Issues](https://github.com/mukundshelake/obsidian-finance-plugin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mukundshelake/obsidian-finance-plugin/discussions)
- **Documentation**: [Wiki](https://github.com/mukundshelake/obsidian-finance-plugin/wiki)