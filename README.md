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
- **Auto-starting Backend**: Python backend starts automatically when needed
- **Advanced Filtering**: Server-side filtering by account, payee, tags, date ranges, or search terms
- **Real-time API Status**: Visual connection indicator and automatic backend management
- **Fava-style Interface**: Clean, expandable transaction cards with proper formatting

---

## 🔧 Requirements

This plugin integrates with your existing Beancount setup:

1. **Python 3.8+**
2. **Beancount v3+**: Install via `pip install beancount`
3. **bean-query**: Command-line tool for querying Beancount files
4. **bean-price** *(optional)*: For automatic commodity price fetching
5. **WSL Support**: Full compatibility for Windows users running Beancount in WSL

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
2. **Set Beancount File Path**: Enter the absolute path to your main `.beancount` file
   - Windows: `C:\Users\YourName\Documents\finances.beancount`
   - macOS/Linux: `/home/username/finances.beancount`
   - WSL: `/mnt/c/Users/YourName/Documents/finances.beancount`
3. **Configure Command Paths**: 
   - Set paths to `bean-query` and `bean-price` (usually auto-detected)
   - For WSL users: Enable WSL mode in settings

### Advanced Configuration
- **Default Currency**: Set your primary reporting currency
- **Update Intervals**: Configure automatic data refresh rates
- **Display Options**: Customize number formatting and decimal places

## Python Backend (Auto-starting)

The **Journal tab** uses a Python backend that **starts automatically** when needed.

### Prerequisites

1. **Python 3.8+** installed and available in your system PATH
2. **Beancount** package: `pip install beancount`

The backend will automatically install Flask and flask-cors when first started.

### How It Works

- When you open the Journal tab, the backend starts automatically as a child process
- No manual commands or scripts needed
- The backend runs on `http://localhost:5001` by default
- Backend stops automatically when you close Obsidian

### Backend Features

- **Automatic Process Management**: Starts and stops with the plugin
- **Complete Transaction Parsing**: Full Beancount file parsing with all postings, metadata, and tags
- **Server-side Filtering**: High-performance filtering by date, account, payee, tags, and search terms
- **Auto-reload**: Reload Beancount files without restarting
- **Error Recovery**: Automatic retry on startup failures

### Troubleshooting

If the Journal tab shows "Backend API Starting..." for more than 30 seconds:

1. **Check Python Installation**: Ensure `python3` or `python` command works in terminal
2. **Install Beancount**: Run `pip install beancount`
3. **Check Console**: Open Developer Tools (Ctrl+Shift+I) for error messages
4. **Verify File Path**: Ensure Beancount file path is correct in plugin settings

**Note**: Other tabs work independently. The Journal tab requires Python 3.8+ and Beancount, but handles all setup automatically.

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
- Hierarchical account grouping
- Multi-currency conversion support

#### **Accounts Tab**
- Navigate account hierarchy interactively
- View balances at each account level
- Drill down to individual account details

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
- Advanced server-side filtering by account, payee, tags, date ranges
- **Auto-starting backend** - Python API starts automatically when needed
- Real-time backend status monitoring and automatic reconnection

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