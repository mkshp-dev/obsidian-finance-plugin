---
sidebar_position: 1
---

# Dashboard Overview

The **Overview Tab** is the landing page of the Unified Dashboard. It answers the question: *"How am I doing right now?"*

## 📊 Visual Analytics

### Net Worth Chart
- **Line Chart**: Shows the trend of your Net Worth over time.
- **Data Source**: Calculates `Assets - Liabilities` for every month in your history.
- **Interactivity**: Hover over points to see exact values.

### Key Performance Indicators (KPIs)
Cards at the top display:
- **Net Worth**: Total wealth in your Operating Currency.
- **Monthly Income**: Income accrued this calendar month.
- **Monthly Expenses**: Expenses incurred this calendar month.
- **Savings Rate**: `(Income - Expenses) / Income`.

## 🛠 Under the Hood

When you open the Overview tab:

1.  **Controller**: `OverviewController.ts` initializes.
2.  **Parallel Queries**: It fires 5 simultaneous BQL queries to the backend:
    - `getTotalAssetsCostQuery`
    - `getTotalLiabilitiesCostQuery`
    - `getMonthlyIncomeQuery`
    - `getMonthlyExpensesQuery`
    - `getHistoricalNetWorthDataQuery`
3.  **Data Processing**:
    - **Currency Conversion**: The backend converts all amounts to your **Operating Currency** using standard Beancount logic (`convert(sum(position), 'USD')`).
    - **Chart Generation**: Historical CSV data is parsed and formatted into a Chart.js configuration object.
4.  **Rendering**: The Svelte component (`OverviewTab.svelte`) renders the Chart.js canvas and KPI cards.
