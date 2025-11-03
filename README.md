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

### � **Commodities & Pricing**
- **Price Integration**: Automated price updates with `bean-price`
- **Multi-currency**: Support for stocks, forex, and cryptocurrencies
- **Metadata Management**: Track data sources and automation status
- **Visual Indicators**: Quick status overview with color-coded pricing

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

#### **Commodities Tab**
- Manage investment and currency tracking
- View price metadata status (🟢 automated, ⚪ manual)
- Access detailed commodity information
- Configure price sources for automated fetching

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