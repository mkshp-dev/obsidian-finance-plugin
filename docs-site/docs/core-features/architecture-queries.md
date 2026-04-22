---
sidebar_position: 6
---

# Architecture & Queries

This plugin is powered by **bean-query**, the Beancount Query Language (BQL) engine. Every piece of data you see in the dashboard comes from direct BQL queries against your Beancount files.

This page documents the exact queries used throughout the plugin, so you can understand, modify, or replicate them in your own workflows.

---

## 🏗️ Architecture Overview

**How it works:**
1. Plugin reads your `.beancount` files
2. Executes BQL queries via `bean-query` command-line tool
3. Parses CSV results
4. Renders data in dashboard or note views

**Key principle:** All data retrieval happens through BQL - there's no proprietary API or database. You can run any of these queries manually in your terminal.

---

## 📊 Overview Tab Queries

All KPI queries in the Overview tab use a typed pattern that returns a plain rounded number rather than an inventory string. The `only()` function returns `null` if the position cannot be fully converted to a single currency (e.g. missing price data), which safely excludes unconverted commodities instead of causing an error.

### Net Worth (single query)

```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2)
WHERE account ~ '^(Assets|Liabilities)'
```

### This Month's Income

```sql
SELECT neg(round(number(only('USD', convert(sum(position), 'USD'))), 2))
WHERE account ~ '^Income'
  AND month = month(today()) AND year = year(today())
```

`neg()` flips the sign because Beancount stores income as negative internally.

### This Month's Expenses

```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2)
WHERE account ~ '^Expenses'
  AND month = month(today()) AND year = year(today())
```

### This Month's Savings (Income − Expenses)

```sql
SELECT neg(round(number(only('USD', convert(sum(position), 'USD'))), 2))
WHERE account ~ '^(Income|Expenses)'
  AND month = month(today()) AND year = year(today())
```

Date filtering uses BQL's built-in `month(today())` and `year(today())` — no hardcoded dates are passed from TypeScript.

### Historical Net Worth Chart

```sql
SELECT year, month, only('USD', convert(last(balance), 'USD', last(date)))
WHERE account ~ '^(Assets|Liabilities)'
ORDER BY year, month
```

This query:
- Groups data by year and month
- Gets the last balance for each month
- Converts to your operating currency
- Includes both Assets and Liabilities for net worth calculation

---

## 🧮 Snapshot View Queries

The sidebar Snapshot View uses three separate queries to display Assets, Liabilities, and Net Worth:

**Assets:**
```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2)
WHERE account ~ '^Assets'
```

**Liabilities** (sign-flipped so positive = debt):
```sql
SELECT neg(round(number(only('USD', convert(sum(position), 'USD'))), 2))
WHERE account ~ '^Liabilities'
```

**Net Worth:**
```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2)
WHERE account ~ '^(Assets|Liabilities)'
```

---

## 💰 Transactions Tab Queries

### Transaction List with Filters

**Base Query (all transactions):**
```sql
SELECT date, payee, narration, position, balance ORDER BY date DESC, lineno DESC LIMIT 1000
```

**With Account Filter:**
```sql
SELECT date, payee, narration, position, balance WHERE account ~ '^Assets:Checking' ORDER BY date DESC, lineno DESC LIMIT 1000
```

**With Date Range:**
```sql
SELECT date, payee, narration, position, balance WHERE date >= 2026-01-01 AND date <= 2026-12-31 ORDER BY date DESC, lineno DESC LIMIT 1000
```

**With Payee Filter:**
```sql
SELECT date, payee, narration, position, balance WHERE payee ~ 'Amazon' ORDER BY date DESC, lineno DESC LIMIT 1000
```

**With Tag Filter:**
```sql
SELECT date, payee, narration, position, balance WHERE 'vacation' IN tags ORDER BY date DESC, lineno DESC LIMIT 1000
```

**Combined Filters:**
Multiple conditions are joined with `AND`:
```sql
SELECT date, payee, narration, position, balance WHERE account ~ '^Expenses:Food' AND date >= 2026-01-01 AND date <= 2026-01-31 ORDER BY date DESC, lineno DESC LIMIT 1000
```

---

## 📋 Journal Tab Queries

The Journal tab combines three types of entries:

### Transaction Entries
```sql
SELECT id, date, flag, payee, narration, tags, links, filename, lineno, account, number, currency, cost_number, cost_currency, cost_date, price, entry.meta as entry_meta FROM postings WHERE <filters> ORDER BY date DESC, id, account
```

This query:
- Retrieves all postings from the `postings` table
- Groups by transaction ID client-side
- Includes metadata and file location for editing

### Balance Assertions
```sql
SELECT date, account, amount, tolerance, discrepancy FROM #balances WHERE <filters> ORDER BY date DESC, account
```

### Note Entries
```sql
SELECT date, account, comment, tags, links, meta FROM #notes WHERE <filters> ORDER BY date DESC, account
```

---

## 🏦 Balance Sheet Tab Queries

### Market Value (Default)
```sql
SELECT account, convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account
```

This converts all holdings to your operating currency at current market prices.

### Historical Cost
```sql
SELECT account, cost(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account
```

Shows original purchase prices - useful for tax calculations.

### Units (Raw Holdings)
```sql
SELECT account, units(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account
```

Shows actual quantities held (e.g., "50 AAPL", "1.5 BTC").

---

## 🪙 Commodities Tab Queries

### List All Commodities
```sql
SELECT name AS name_ FROM #commodities GROUP BY name
```

### Commodity Price Data
```sql
SELECT last(date) AS date_, last(currency) AS currency_, round(getprice(last(currency), 'USD'),2) AS price_, currency_meta(last(currency), 'logo') AS logo_, bool(today()-1<last(date)) AS islatest_ FROM #prices GROUP BY currency
```

This query:
- Gets the most recent price for each commodity
- Converts to operating currency
- Retrieves logo metadata
- Flags prices updated within last day as "latest"

### Commodity Details
```sql
SELECT name AS name_, last(meta) AS meta_, currency_meta(last(name),'logo') AS logo_, currency_meta(last(name), 'price') AS pricemetadata_, meta('filename') AS filename_, meta('lineno') AS lineno_ FROM #commodities WHERE name='AAPL'
```

Retrieves full metadata including:
- Logo URL
- Price source (e.g., "yahoo/AAPL")
- File location for editing

---

## 🔍 Helper Queries

### Get All Open Accounts
```sql
SELECT account
```
*Post-processed to get unique list of open accounts*

### Get All Unique Tags
```sql
SELECT tags
```
*Post-processed to extract unique tags from all transactions*

### File Validation
```sql
SELECT TRUE LIMIT 0
```
This validates Beancount file syntax without returning data - used by the connection test.

---

## 🛠️ Using These Queries

### In Terminal
Run any query manually:
```bash
bean-query /path/to/your.beancount "SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account"
```

### In Your Notes
Use BQL code blocks:
    ```bql
    SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account
    ```

### Inline in Text
Embed live values:
```markdown
My current net worth: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities)'`
```

---

## 📝 Query Syntax Notes

**Important:** All queries must be written on a single line in code blocks. Multi-line queries will only execute the first line.

**Currency Placeholders:** In the queries above, `'USD'` is used as an example. The plugin substitutes your configured operating currency from settings.

**Date Formats:** Dates in BQL use `YYYY-MM-DD` format without quotes (e.g., `date >= 2026-01-01`)

**Regular Expressions:** The `~` operator performs regex matching:
- `account ~ '^Assets'` - matches accounts starting with "Assets"
- `payee ~ 'Amazon'` - matches payees containing "Amazon"

---

## 🔗 Learn More

- **Official BQL Documentation:** [Beancount Query Language](https://beancount.github.io/docs/beancount_query_language.html)
- **Query Examples:** See our [BQL Queries](../queries/bql.md) page for more examples
- **Source Code:** All query definitions are in [`src/queries/index.ts`](https://github.com/mkshp-dev/obsidian-finance-plugin/blob/master/src/queries/index.ts)
