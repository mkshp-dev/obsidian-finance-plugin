---
sidebar_position: 5
---

# Income Statement Tab

The **Income Statement Tab** gives you a comprehensive view of your profitability — how much you earned, spent, and kept over any period.

## 📊 Features

### Summary KPIs

At the top of the tab you'll find three key metrics:

- **Total Income**: Sum of all Income account balances (sign-flipped to show as positive)
- **Total Expenses**: Sum of all Expenses account balances
- **Net Profit**: `Total Income − Total Expenses` — positive means you spent less than you earned

### Account Hierarchy

Income and Expense accounts are displayed as interactive, collapsible trees mirroring your Beancount account structure:

- **Income** tree: All `Income:*` accounts grouped by hierarchy
- **Expenses** tree: All `Expenses:*` accounts grouped by hierarchy
- Parent nodes show rolled-up totals from their children
- Leaf nodes show the actual account balance

### Valuation Methods

Toggle between three views (same as the Balance Sheet tab):

1. **Market Value (Converted)**: All amounts converted to your Operating Currency using `convert()`
2. **At Cost**: Original cost basis using `cost()`
3. **Units**: Raw quantities using `units()`

### Interactive Charts

#### Sunburst Charts
Visual breakdown of income and expense composition:
- Each slice represents an account, sized proportionally to its balance
- Hover to see exact amounts and account names
- Drill down into sub-accounts by clicking parent segments

#### Trend Chart
A bar/line chart showing financial performance over time:
- **Net Profit** trend: Combined income minus expenses per period
- **Income** trend: Total income per period
- **Expense** trend: Total expenses per period
- Switch between **monthly** and **weekly** granularity
- Gaps appear where no transactions exist for a period

---

## 🔍 Behind the Scenes: BQL Queries

### Income & Expense Account Balances

**Market Value (Convert):**
```sql
SELECT account, convert(sum(position), 'USD')
WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account)
GROUP BY account ORDER BY account
```

**At Cost:**
```sql
SELECT account, cost(sum(position))
WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account)
GROUP BY account ORDER BY account
```

**Units:**
```sql
SELECT account, units(sum(position))
WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account)
GROUP BY account ORDER BY account
```

### Trend Chart Queries

**Net Profit by Month:**
```sql
SELECT year, month, only('USD', convert(sum(position), 'USD', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) AS _worth
WHERE account ~ '^(Income|Expenses)' GROUP BY year, month ORDER BY year, month
```

**Net Profit by Week:**
```sql
SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, only('USD', convert(sum(position), 'USD', last(date_add(date_trunc('week', date), 6))))
WHERE account ~ '^(Income|Expenses)' GROUP BY date_trunc('week', date) ORDER BY week_end
```

**Income by Month:**
```sql
SELECT year, month, only('USD', convert(sum(position), 'USD', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) AS _worth
WHERE account ~ '^(Income)' GROUP BY year, month ORDER BY year, month
```

**Expenses by Month:**
```sql
SELECT year, month, only('USD', convert(sum(position), 'USD', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) AS _worth
WHERE account ~ '^(Expenses)' GROUP BY year, month ORDER BY year, month
```

:::note Sign Conventions
Beancount stores income as **negative** internally (credit accounts). The plugin negates these values when displaying totals so they appear as positive numbers. Net profit uses the raw sign — a positive net profit means expenses exceeded income (a loss). The UI applies an additional sign flip so a green net profit always means you're ahead.
:::

:::tip
`'USD'` in the queries above is substituted with your configured **Operating Currency** from settings.
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for a full reference of all plugin queries.
