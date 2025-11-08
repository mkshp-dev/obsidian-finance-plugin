# 📝 Financial Journal - November 2024

*Using inline BQL for live financial data in notes*

---

## 📊 Current Financial Status

I was just going through my finances today and found out I only have `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'` left in total assets. That's concerning because my monthly expenses are around `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024 AND month = 11` this month.

My checking account currently shows `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'` which should be enough for the next few weeks.

---

## 💸 Spending Analysis

### Recent Insights

This month I've spent `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Food' AND year = 2024 AND month = 11` on food, which is quite high compared to my usual budget. 

Breaking it down:
- Groceries: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Food:Groceries' AND year = 2024 AND month = 11`
- Dining out: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Food:Restaurant' AND year = 2024 AND month = 11`

My transportation costs this month were `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Transportation' AND year = 2024 AND month = 11`, which is reasonable.

---

## 🏦 Account Summary

### Primary Accounts

**Checking Account**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'`  
**Savings Account**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Savings'`  
**Investment Account**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment'`

### Credit Cards

Current credit card debt stands at `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Liabilities:CreditCard'`, which I need to pay down.

---

## 📈 Investment Performance

My investment portfolio is currently worth `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment'`. 

The breakdown by major holdings:
- Stock portfolio: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment:Stocks'`
- Index funds: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment:Funds'`
- Crypto: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment:Crypto'`

---

## 💰 Income vs Expenses

### Year-to-Date Summary

**Total Income (2024)**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Income' AND year = 2024`  
**Total Expenses (2024)**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024`

This gives me a savings rate of approximately `bql:SELECT ROUND(100 * (SELECT convert(sum(position), 'USD') WHERE account ~ '^Income' AND year = 2024) / (SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024), 1)`% this year.

---

## 📅 Monthly Trends

### Last 3 Months Expenses

**September**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024 AND month = 9`  
**October**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024 AND month = 10`  
**November**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND year = 2024 AND month = 11` (so far)

---

## 🎯 Financial Goals

### Progress Tracking

**Emergency Fund Target**: $10,000  
**Current Emergency Fund**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Savings:Emergency'`  
**Progress**: `bql:SELECT ROUND(100 * (SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Savings:Emergency') / 10000, 1)`%

**Investment Goal for 2024**: $50,000  
**Current Investments**: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment'`  
**Progress**: `bql:SELECT ROUND(100 * (SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Investment') / 50000, 1)`%

---

## 💡 Insights & Action Items

1. **Reduce dining expenses** - I've spent `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Food:Restaurant' AND year = 2024` on restaurants this year, which is above my target.

2. **Increase emergency fund** - Currently at `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Savings:Emergency'`, need to reach $10,000.

3. **Monitor subscription services** - Regular review of recurring expenses that currently total `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses:Subscriptions' AND year = 2024` annually.

---

## 🔄 Live Data Benefits

✅ **Always Current**: Values update automatically when I add new transactions  
✅ **No Manual Calculation**: Complex financial metrics computed in real-time  
✅ **Consistent Formatting**: Currency values properly formatted  
✅ **Natural Reading**: Financial data flows naturally within my notes  
✅ **Historical Tracking**: Can easily track changes over time in the same note

---

*Note: All values are live and update automatically when the underlying Beancount data changes. Hover over any value to see the underlying BQL query.*