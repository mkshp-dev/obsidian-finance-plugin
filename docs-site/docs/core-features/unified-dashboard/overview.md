---
sidebar_position: 1
---

# Overview Tab

The **Overview Tab** is the landing page of the Unified Dashboard. It answers the question: *"How am I doing financially right now?"*

## 📊 Visual Analytics

### Key Performance Indicators (KPIs)
At-a-glance metrics displayed at the top:
- **Net Worth**: Your total wealth (Assets minus Liabilities) in your Operating Currency
- **Monthly Income**: Total income accrued this calendar month
- **Monthly Expenses**: Total expenses incurred this calendar month
- **Savings Rate**: Your efficiency metric: `(Income - Expenses) / Income` as a percentage

### Net Worth Chart
- **Chart Type**: Interactive line chart showing your financial trajectory
- **Time Period**: Historical net worth from the earliest transaction to today
- **Data Source**: Calculated as `Assets - |Liabilities|` for each month in your history
- **Interactivity**: Hover over points to see exact values with dates
- **Requirements**: Needs at least 2 months of data to render

## 🛠 Under the Hood

### Controller Architecture
`OverviewController.ts` manages:
- State management (loading, error handling)
- Parallel query execution for performance
- Chart configuration and data preparation
- Currency conversion handling

### Data Flow
When you open the Overview tab:

1. **Initialization**: The controller loads and creates a reactive Svelte store
2. **Parallel Queries**: Five BQL queries execute simultaneously to fetch:
   - Total Assets (in cost or market value)
   - Total Liabilities
   - Current Month's Income
   - Current Month's Expenses
   - Historical Net Worth data (monthly snapshots)

3. **Query Examples**:
   ```sql
   -- Total Assets
   SELECT convert(sum(position), 'USD') 
   WHERE account ~ '^Assets'
   
   -- Monthly Expenses
   SELECT year, month, sum(position) 
   WHERE account ~ '^Expenses' 
     AND date >= CURRENT_MONTH_START
   GROUP BY year, month
   ```

4. **Data Processing**:
   - **Currency Conversion**: All amounts converted to your Operating Currency using standard Beancount `convert()` logic
   - **Chart Generation**: Historical data is formatted into a Chart.js configuration object
   - **KPI Calculation**: Savings Rate is computed as `(Income - Expenses) / Income`

5. **Rendering**: The Svelte component (`OverviewTab.svelte`) renders:
   - Chart canvas with Chart.js
   - KPI cards with formatted numbers
   - Loading states and error messages

### Performance Optimization
- Queries execute in parallel, not sequentially
- Results are cached in the Svelte store for instant re-renders
- Historical data is limited to 24 months by default (configurable)
- Chart re-renders only when data changes

### Common Calculations

**Net Worth:**
```
Net Worth = Sum(Assets) - Sum(|Liabilities|)
```

**Savings Rate:**
```
Savings Rate = (Monthly Income - Monthly Expenses) / Monthly Income * 100%
```

**Positive Values:**
- Income and Net Worth are displayed as positive numbers
- Expenses are displayed as positive magnitudes (even though they're negative in Beancount)
