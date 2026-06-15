---
sidebar_position: 2
---

# Advanced Queries

Beancount Query Language (BQL) is exceptionally powerful, allowing you to generate sophisticated financial reports directly within your notes. This page provides a library of advanced BQL query recipes for investment tracking, budget analysis, multi-currency reporting, and date ranges.

---

## 📈 Investment Tracking

### 1. Current Stock and Crypto Holdings
Displays the raw quantity and currency of items held in your brokerage accounts, grouped by account and asset symbol:
```sql
SELECT account, currency, units(sum(position)) WHERE account ~ '^Assets:Brokerage' GROUP BY account, currency
```

### 2. Investment Performance (Market Value vs. Cost)
Compares the original cost basis (acquisition cost) against the current market value (converted to your operating currency, e.g. USD) to see unrealized gains:
```sql
SELECT account, cost(sum(position)), convert(sum(position), 'USD') WHERE account ~ '^Assets:Brokerage' GROUP BY account
```

### 3. Capital Gains Summary
Aggregates capital gains realized from asset sales, grouped by calendar year:
```sql
SELECT year, sum(position) WHERE account ~ '^Income:CapitalGains' GROUP BY year ORDER BY year DESC
```

### 4. Dividend Income History
Lists all dividends received, sorted chronologically:
```sql
SELECT date, payee, position WHERE account ~ '^Income:Dividends' ORDER BY date DESC
```

---

## 📊 Budget & Spending Analysis

### 1. Year-over-Year Expense Comparison
Groups monthly expenditures converted to your operating currency to analyze seasonal patterns:
```sql
SELECT year, month, convert(sum(position), 'USD') WHERE account ~ '^Expenses' GROUP BY year, month ORDER BY year, month
```

### 2. Top Merchants (Spending by Payee)
Lists your top 20 merchants by total spending across all expense accounts:
```sql
SELECT payee, sum(position) WHERE account ~ '^Expenses' GROUP BY payee ORDER BY sum(position) DESC LIMIT 20
```

### 3. Tag-Based Expense Tracking
Filters postings to a specific tag (e.g. tracking spending for a specific `#vacation` or `#business` project):
```sql
SELECT date, payee, narration, position WHERE 'vacation' IN tags ORDER BY date DESC
```

---

## 🧮 Advanced Account Analysis

### 1. Historical Net Worth Trend
Extracts month-end net worth totals by summing all Assets and Liabilities:
```sql
SELECT year, month, convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities)' GROUP BY year, month ORDER BY year, month
```

### 2. Monthly Savings Rate (Nested Subqueries)
Calculates monthly savings rate percentages (`(Income - Expenses) / Income`) using nested BQL subqueries for a specific year:
```sql
SELECT month, (SELECT convert(sum(position), 'USD') WHERE account ~ '^Income' AND month = parent.month) AS income, (SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND month = parent.month) AS expenses WHERE year = 2026 GROUP BY month
```

### 3. Credit Card Balance History
Tracks the day-by-day running balance of a credit card liabilities account:
```sql
SELECT date, balance WHERE account = 'Liabilities:CreditCard' ORDER BY date DESC LIMIT 50
```

---

## 💱 Multi-Currency Reports

### 1. Non-Operating Currency Assets
Lists all asset balances held in currencies other than your primary operating currency (e.g. excluding USD):
```sql
SELECT account, currency, sum(position) WHERE NOT currency = 'USD' AND account ~ '^Assets' GROUP BY account, currency
```

### 2. Multi-Currency Conversion
Displays both the raw units held and their converted value in your operating currency:
```sql
SELECT account, units(sum(position)), convert(sum(position), 'USD') WHERE account ~ '^Assets' GROUP BY account
```

---

## 📅 Date Range Operations

### 1. Quarter Performance
Compares income categories accrued during the first quarter of the year:
```sql
SELECT account, sum(position) WHERE account ~ '^Income' AND date >= 2026-01-01 AND date <= 2026-03-31 GROUP BY account
```

### 2. Relative Date Ranges (Last 90 Days)
Lists your top expense accounts over the last 90 days using the dynamic `today()` function:
```sql
SELECT account, sum(position) WHERE account ~ '^Expenses' AND date >= today() - 90 GROUP BY account ORDER BY sum(position) DESC
```
