# BQL Code Block Test

This note demonstrates the new BQL (Beancount Query Language) code block functionality in the Obsidian Finance Plugin.

## Basic Account Query

```bql
SELECT account GROUP BY account ORDER BY account
```

## Recent Transactions

```bql
SELECT date, payee, narration, account, position ORDER BY date DESC LIMIT 10
```

## Asset Account Balances

```bql
SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account ORDER BY account
```

## Income This Year

```bql
SELECT account, sum(position) WHERE account ~ '^Income' AND year = YEAR(TODAY()) GROUP BY account ORDER BY sum(position)
```

## Monthly Expenses

```bql
SELECT year, month, sum(position) WHERE account ~ '^Expenses' GROUP BY year, month ORDER BY year DESC, month DESC LIMIT 12
```

## Cash Flow Summary

```bql
SELECT account, sum(position) WHERE account ~ '^(Income|Expenses)' GROUP BY account ORDER BY account
```

---

**How to use:**
1. Create a code block with `bql` as the language
2. Write your Beancount Query Language statement
3. The query will execute automatically and display results in a formatted table
4. Use the controls to refresh, copy results, or export as CSV
5. Click "View Query" to see the executed BQL statement

**Keyboard shortcuts:**
- Refresh button: Re-executes the query with latest data
- Copy button: Copies raw CSV results to clipboard  
- Export button: Downloads results as CSV file

This integration makes it incredibly easy to include live financial data directly in your notes!