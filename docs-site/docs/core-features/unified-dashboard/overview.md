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

---

## 🔍 Behind the Scenes: BQL Queries

All data on this tab comes from direct **bean-query** BQL queries. Here are the exact queries used:

### Net Worth Components

**Total Assets:**
```sql
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'
```

**Total Liabilities:**
```sql
SELECT convert(sum(position), 'USD') WHERE account ~ '^Liabilities'
```

*Net Worth = Assets - |Liabilities|*

### Monthly Metrics

**Current Month Income:**
```sql
SELECT convert(sum(position), 'USD') WHERE account ~ '^Income' AND date >= 2026-02-01 AND date <= 2026-02-28
```

**Current Month Expenses:**
```sql
SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND date >= 2026-02-01 AND date <= 2026-02-28
```

*Dates are dynamically calculated based on the current month*

### Historical Chart Data

**Net Worth Over Time:**
```sql
SELECT year, month, only('USD', convert(last(balance), 'USD', last(date))) WHERE account ~ '^(Assets|Liabilities)' ORDER BY year, month
```

This query groups data by month and gets the last balance for each period, converted to your operating currency.

:::tip
You can run these queries yourself in a BQL code block or use them as templates for custom financial dashboards!
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for all plugin queries.
