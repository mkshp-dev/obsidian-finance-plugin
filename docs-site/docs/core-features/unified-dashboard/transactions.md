---
sidebar_position: 2
---

# Transactions Tab

The **Transactions Tab** allows you to explore your financial history with powerful filtering capabilities.

## 🔍 Features

### Dynamic Filtering
Filter your history by any combination of:
- **Date Range**: Start and End dates (inclusive).
- **Account**: Substring match (e.g., "Food" matches "Expenses:Food:Groceries").
- **Payee**: Who you paid (searches transaction payee field).
- **Tags**: Filter by specific tags (e.g., `#vacation`, `#business`).
- **Search**: Full-text search across all transaction fields.

### Results Table
Displays your filtered transactions with:
- **Columns**: Date, Payee, Narration, Amount, Account
- **Sorting**: Automatically sorted by date (newest first)
- **Pagination**: Respects the "Max Transaction Results" setting (default: 2000)
- **Interactive**: Click on transactions to view or edit details

---

## 🔍 Behind the Scenes: BQL Queries

The Transactions tab uses dynamic query building based on your selected filters:

### Base Query (All Transactions)
```sql
SELECT date, payee, narration, position, balance ORDER BY date DESC, lineno DESC LIMIT 1000
```

### With Filters Applied

**Account Filter:**
```sql
SELECT date, payee, narration, position, balance WHERE account ~ '^Assets:Checking' ORDER BY date DESC, lineno DESC LIMIT 1000
```

**Date Range:**
```sql
SELECT date, payee, narration, position, balance WHERE date >= 2026-01-01 AND date <= 2026-12-31 ORDER BY date DESC, lineno DESC LIMIT 1000
```

**Payee Filter:**
```sql
SELECT date, payee, narration, position, balance WHERE payee ~ 'Amazon' ORDER BY date DESC, lineno DESC LIMIT 1000
```

**Tag Filter:**
```sql
SELECT date, payee, narration, position, balance WHERE 'vacation' IN tags ORDER BY date DESC, lineno DESC LIMIT 1000
```

**Combined Filters:**
Multiple conditions are joined with `AND`:
```sql
SELECT date, payee, narration, position, balance WHERE account ~ '^Expenses:Food' AND date >= 2026-01-01 AND date <= 2026-01-31 ORDER BY date DESC, lineno DESC LIMIT 1000
```

:::tip
The `~` operator performs regex matching, so `account ~ '^Expenses'` matches all accounts starting with "Expenses".
:::

**Learn More:** See the [Architecture & Queries](../architecture-queries.md) page for all plugin queries.
