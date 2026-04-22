---
sidebar_position: 1
---

# Overview Tab

The **Overview Tab** is the landing page of the Unified Dashboard. It answers the question: *"How am I doing financially right now?"*

## 📊 Visual Analytics

### Key Performance Indicators (KPIs)
At-a-glance metrics displayed at the top:
- **Net Worth**: Your total wealth (Assets + Liabilities) in your Operating Currency
- **Monthly Income**: Total income accrued this calendar month
- **Monthly Expenses**: Total expenses incurred this calendar month
- **Savings Rate**: Your efficiency metric: `Savings / Income` as a percentage

### Net Worth Chart
- **Chart Type**: Interactive line chart showing your financial trajectory
- **Time Period**: Historical net worth from the earliest transaction to today
- **Data Source**: Cumulative balance of all Assets and Liabilities accounts per month
- **Interactivity**: Hover over points to see exact values with dates
- **Requirements**: Needs at least 2 months of data to render

---

## 🔍 Behind the Scenes: BQL Queries

All data on this tab comes from direct **bean-query** BQL queries. Here are the exact queries used:

### Net Worth

```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2) AS _totalWorth
WHERE account ~ '^(Assets|Liabilities)'
```

Assets and Liabilities are summed together in a single query. Beancount stores liabilities as negative, so the result is the true net worth directly.

### Monthly Metrics

**Current Month Income:**
```sql
SELECT neg(round(number(only('USD', convert(sum(position), 'USD'))), 2)) AS _thisMonthIncome
WHERE account ~ '^Income' AND month=month(today()) AND year=year(today())
```

**Current Month Expenses:**
```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2) AS _thisMonthExpenses
WHERE account ~ '^Expenses' AND month=month(today()) AND year=year(today())
```

**Current Month Savings** (net of income and expenses):
```sql
SELECT neg(round(number(only('USD', convert(sum(position), 'USD'))), 2)) AS _thisMonthNetWorthChange
WHERE account ~ '^(Income|Expenses)' AND month=month(today()) AND year=year(today())
```

`neg()` is used on Income and the combined Income+Expenses queries because Beancount stores income as negative. Dates are resolved natively in BQL using `month(today())` and `year(today())` — no date parameters are passed from the plugin.

*Savings Rate is calculated client-side as `Savings / Income × 100`.*

### Historical Chart Data

**Net Worth Over Time:**
```sql
SELECT year, month, only('USD', convert(last(balance), 'USD', last(date)))
WHERE account ~ '^(Assets|Liabilities)' ORDER BY year, month
```

Groups data by month and gets the last cumulative balance for each period, converted to your operating currency.

:::tip
You can run these queries yourself in a BQL code block or use them as templates for custom financial dashboards!
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for all plugin queries.
