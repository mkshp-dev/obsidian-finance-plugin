---
sidebar_position: 1
---

# BQL Queries

The plugin brings the full power of **Beancount Query Language (BQL)** directly into Obsidian. You can execute SQL-like queries against your financial data and display the results in your notes.

The plugin supports two distinct modes:
1.  **Code Blocks**: For detailed analysis and tables.
2.  **Inline Queries**: For embedding live values into your text.

## 📊 BQL Code Blocks

Use standard Markdown code blocks with the `bql` language identifier to create formatted, interactive tables.

:::warning Important
**Single-Line Queries Only**: BQL queries must be written on a single line. Multi-line queries will only execute the first line and ignore subsequent lines.
:::

### Basic Usage

    ````
    ```bql
    SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account
    ```
    ````

### Features
- **Interactive Results**: Sortable columns and responsive layout.
- **Tools**:
    - **Refresh (⟳)**: Re-run the query to get the latest data.
    - **Copy (📋)**: Copy the raw CSV results to your clipboard.
    - **Export (📤)**: Download results as a CSV file.
- **Toggle View**: Hide the query code to show only the results table (configurable in Settings).

### Common Examples

**List All Accounts:**
```sql
SELECT account GROUP BY account ORDER BY account
```

**Recent Transactions:**
```sql
SELECT date, payee, narration, position ORDER BY date DESC LIMIT 20
```

**Monthly Expenses:**
```sql
SELECT year, month, sum(position) WHERE account ~ '^Expenses' GROUP BY year, month ORDER BY year DESC, month DESC
```

**Current Account Balances:**
```sql
SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account ORDER BY account
```

**Top Expenses by Category:**
```sql
SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account ORDER BY sum(position) DESC LIMIT 10
```

---

## 📈 Advanced Query Examples

### Investment Tracking

**Current Stock Holdings:**
```sql
SELECT account, currency, units(sum(position)) WHERE account ~ '^Assets:Brokerage' GROUP BY account, currency
```

**Investment Performance (Market Value):**
```sql
SELECT account, cost(sum(position)), convert(sum(position), 'USD') WHERE account ~ '^Assets:Brokerage' GROUP BY account
```

**Capital Gains Summary:**
```sql
SELECT year, sum(position) WHERE account ~ '^Income:CapitalGains' GROUP BY year ORDER BY year DESC
```

**Dividend Income:**
```sql
SELECT date, payee, position WHERE account ~ '^Income:Dividends' ORDER BY date DESC
```

### Budget Analysis

**Year-over-Year Expense Comparison:**
```sql
SELECT year, month, convert(sum(position), 'USD') WHERE account ~ '^Expenses' GROUP BY year, month ORDER BY year, month
```

**Spending by Merchant:**
```sql
SELECT payee, sum(position) WHERE account ~ '^Expenses' GROUP BY payee ORDER BY sum(position) DESC LIMIT 20
```

**Tag-Based Expense Tracking:**
```sql
SELECT date, payee, narration, position WHERE 'vacation' IN tags ORDER BY date DESC
```

### Account Analysis

**Net Worth Trend:**
```sql
SELECT year, month, convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities)' GROUP BY year, month ORDER BY year, month
```

**Savings Rate Calculation:**
```sql
SELECT month, (SELECT convert(sum(position), 'USD') WHERE account ~ '^Income' AND month = parent.month) AS income, (SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND month = parent.month) AS expenses WHERE year = 2023 GROUP BY month
```

**Credit Card Balance History:**
```sql
SELECT date, balance WHERE account = 'Liabilities:CreditCard' ORDER BY date DESC LIMIT 50
```

### Multi-Currency

**Non-USD Holdings:**
```sql
SELECT account, currency, sum(position) WHERE NOT currency = 'USD' AND account ~ '^Assets' GROUP BY account, currency
```

**Currency Conversion:**
```sql
SELECT account, units(sum(position)), convert(sum(position), 'USD') WHERE account ~ '^Assets' GROUP BY account
```

### Date Range Queries

**This Month's Transactions:**
```sql
SELECT date, payee, narration, position WHERE date >= 2026-02-01 AND date <= 2026-02-29 ORDER BY date DESC
```

**Quarter Performance:**
```sql
SELECT account, sum(position) WHERE account ~ '^Income' AND date >= 2026-01-01 AND date <= 2026-03-31 GROUP BY account
```

**Last 90 Days Activity:**
```sql
SELECT account, sum(position) WHERE account ~ '^Expenses' AND date >= today() - 90 GROUP BY account ORDER BY sum(position) DESC
```

---

## 💰 Inline BQL Queries

Embed live financial values directly in your sentences using single backticks. This is perfect for daily journaling (e.g., *"My checking balance is currently..."*).

### Direct Queries

Write a full BQL query inside backticks starting with `bql:`:

> My net worth is `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`

### Shorthand Templates

For complex or frequently used queries, use the **Shorthand System**.

#### 1. Setup Template
Create a note (e.g., `BQL_Shortcuts.md`) and define queries like this:
    ````
    ## WORTH: Net Worth
    ```bql-shorthand
    SELECT convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities)'
    ```
    ````
#### 2. Configure
Go to **Settings** and point "Shortcuts template file" to `BQL_Shortcuts.md`.

#### 3. Use
Now you can simply write:

> My net worth is `bql-sh:WORTH`
