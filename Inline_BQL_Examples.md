# 💰 Inline BQL Examples

*Live financial data directly in your text*

---

## Basic Usage

Use inline code with `bql:` prefix to embed live values:

**Total Assets**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`

**Monthly Expenses**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024 AND month = 11`

**Checking Balance**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'`

---

## Natural Sentences

I currently have `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'` in my checking account and `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Savings'` in savings, for a total liquid cash position of `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:(Checking|Savings)'`.

This month I've spent `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Food' AND year = 2024 AND month = 11` on food and `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Transportation' AND year = 2024 AND month = 11` on transportation.

---

## Quick Metrics

**Net Worth**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities)'`

**This Year's Income**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Income' AND year = 2024`

**This Year's Expenses**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024`

**Investment Portfolio**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment'`

**Credit Card Debt**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Liabilities:CreditCard'`

---

## Count Examples

**Number of Transactions This Month**: `bql:SELECT count(*) WHERE year = 2024 AND month = 11`

**Number of Investment Accounts**: `bql:SELECT count(distinct account) WHERE account ~ '^Assets:Investment'`

**Active Credit Cards**: `bql:SELECT count(distinct account) WHERE account ~ '^Liabilities:CreditCard'`

---

## How It Works

1. **Type**: `` `bql:YOUR_QUERY_HERE` ``
2. **Processes**: Query executes automatically
3. **Shows**: First value from result, formatted nicely
4. **Updates**: Refreshes when underlying data changes
5. **Hover**: Shows the original query in tooltip

---

## 💡 Pro Tips

- **Keep queries simple** - inline is best for single values
- **Use convert()** for consistent currency formatting
- **Add year/month filters** for time-specific data
- **Use account regex** for flexible account matching
- **Hover over values** to see the underlying query

---

## ✨ Perfect For

✅ **Financial journaling** with live data  
✅ **Quick status updates** in daily notes  
✅ **Budget tracking** with real numbers  
✅ **Goal progress** with automatic calculations  
✅ **Investment updates** in portfolio notes  
✅ **Expense analysis** in spending reviews