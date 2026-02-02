---
sidebar_position: 3
---

# Snapshot View

The **Snapshot View** is a persistent sidebar widget designed to give you "at a glance" financial awareness while you work in your notes.

## 👁 Features

### Key Metrics
Displays high-level financial indicators extracted directly from your ledger:
- **Net Worth**: Your total wealth (Assets - Liabilities) in your Operating Currency
- **Income (Month)**: Total income accrued for the current month
- **Expenses (Month)**: Total expenses incurred this month
- **All Values**: Displayed in your configured Operating Currency with proper formatting

### Recent Transactions
Shows a compact list of your most recent transactions (default: last 5-10 entries):
- **Date** and **Payee** for quick identification
- **Amount** with proper currency display
- **Click to View**: Clicking a transaction opens the full Unified Dashboard for details

### Quick Actions
Convenient buttons for common operations:
- **Add Transaction**: Opens the Unified Transaction Modal
- **Refresh**: Reloads data from your Beancount file
- **Open Dashboard**: Opens the full Unified Dashboard view

## 🛠 Under the Hood

The Snapshot View is optimized for minimal performance impact:

### View Registration
- **View Type**: Registered as `BEANCOUNT_VIEW_TYPE` in the plugin
- **Location**: Typically placed in the right sidebar for persistent visibility
- **Lifecycle**: Loads once when opened, refreshes on data changes

### Lightweight Data Fetching
Unlike the full dashboard, the Snapshot uses targeted queries:
1. **Minimal Queries**: Executes only essential BQL queries for the metrics displayed
   - Net Worth: Single query for Assets and Liabilities sum
   - Monthly Income/Expenses: Targeted queries with date filters for current month
   - Recent Transactions: Simple `ORDER BY date DESC LIMIT 10` query
2. **Fast Execution**: Direct CLI execution via `runQuery()` without heavy processing
3. **Cached Results**: Results are cached until explicit refresh or data change

### Reactivity
The view stays synchronized with your ledger:
- **Event Listening**: Listens for transaction creation/update/delete events
- **Auto-refresh**: Updates automatically when you make changes in the Dashboard
- **Manual Refresh**: Button available for on-demand updates

### Performance Optimization
- **Startup Impact**: Minimal - doesn't load until you open the sidebar
- **Memory Footprint**: Small - only stores essential metrics, not full transaction list
- **Query Efficiency**: Uses BQL aggregation functions to minimize data transfer
- **No Polling**: Only fetches data when explicitly needed (open, refresh, or change event)

## 💡 Usage Tips

### When to Use
- **Daily Note Taking**: Keep it open while journaling to reference your finances
- **Quick Checks**: Glance at net worth without opening the full dashboard
- **Context Switching**: Maintain financial awareness while working on other tasks

### Customization
The Snapshot View respects your plugin settings:
- **Operating Currency**: Displays all values in your configured currency
- **Date Format**: Uses your system's locale for date display
- **Backup Settings**: Changes made via quick actions follow backup preferences

### Placement Options
Access the Snapshot View via:
- **Command**: `Ctrl/Cmd + P` → "Open Beancount Snapshot"
- **Ribbon**: (if enabled) Click the Beancount icon
- **Right Sidebar**: Drag and position the view as needed in Obsidian's layout
