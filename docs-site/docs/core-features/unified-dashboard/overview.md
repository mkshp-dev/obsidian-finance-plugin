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

## 🎯 Financial Indicators

Below the KPI cards, the **Financial Indicators** section lets you define and track Budgets and Savings Targets backed by live BQL data.

### Budgets

A Budget tracks spending against a periodic limit for an expense account.

Each budget card shows:
- **Name** and expense account
- **Progress bar** — colored green (on track), orange (≥75%), or red (over budget)
- **`$spent of $available`** label with percentage
- **Status pill** — `On Track`, `Warning`, or `Over Budget`
- **Stats row**: Base Target · Rollover amount (if enabled) · Available (= Base + Rollover)

**Rollover budgets** accumulate unspent amounts across cycles. For example, if you budget $120/month and only spend $110, the extra $10 rolls forward and the next month's available budget becomes $130.

#### Adding a Budget

Click **+ Add Budget** and fill in:

| Field | Description |
|---|---|
| Name | Display label (e.g. `Groceries`) |
| Expense Account | The `Expenses:*` account to track (autocomplete) |
| Period | `Monthly` or `Weekly` |
| Target Amount | Spending limit per cycle |
| Currency | Tracking currency (defaults to Operating Currency) |
| Enable Rollover | Roll unspent budget into next cycle |
| Start Date | When the budget begins (only shown when rollover is off) |

This writes an `event "Indicator" "Budget"` directive to `events.beancount`:

```beancount
2026-01-01 event "Indicator" "Budget"
  name: "Groceries"
  accountQuery: "Expenses:Food:Groceries"
  cycle: "Monthly"
  target: 500.00
  currency: "USD"
  isRollover: 1
```

### Targets

A Target tracks progress toward a savings or accumulation goal for an asset account.

Each target card shows:
- **Name** and asset account
- **Progress bar** colored by completion percentage
- **Stats row**: Goal · Saved so far · Still needed

#### Adding a Target

Click **+ Add Target** and fill in the same fields as a budget, but select an `Assets:*` account. This writes an `event "Indicator" "Target"` directive to `events.beancount`.

### Refresh

Click the **↺ refresh button** (top-right of the section) to re-run all indicator queries without reloading the full dashboard.

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

### Financial Indicators

**Budget / Target list** (reads all `Indicator` events from `events.beancount`):
```sql
SELECT date AS _startDate, meta('name') AS _name, meta('accountQuery') AS _accountString,
       meta('cycle') AS _period, bool(meta('isRollover')) AS _isRollOver,
       meta('target') AS _budgetAmount, meta('currency') AS _currency
FROM events WHERE type='Indicator' AND description='Budget'
```

**Status query — rollover monthly budget** (one query per indicator):
```sql
SELECT year, month,
  number(only('USD', convert(sum(position), 'USD'))) AS _expenseThisCycle,
  ((year(today())-year(2026-01-01))*12+(month(today())-month(2026-01-01))+1)*500
    - last(number(only('USD', convert(balance, 'USD')))) AS _remainingThisCycle
FROM account ~ '^Expenses:Food:Groceries' OPEN ON 2026-01-01
ORDER BY year DESC, month DESC LIMIT 1
```

The `_remainingThisCycle` formula multiplies cycles elapsed × base target, then subtracts the current running balance, giving the true rollover-adjusted remaining amount.

:::note bean-query CSV behavior
`bean-query -f csv` lowercases all column alias characters. `_startDate` becomes `_startdate` in the CSV output. The plugin's `col()` helper handles this automatically.
:::

:::tip
You can run these queries yourself in a BQL code block or use them as templates for custom financial dashboards!
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for all plugin queries.
