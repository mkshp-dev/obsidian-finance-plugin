# BQL Query Showcase 📊

This demonstrates powerful financial analysis queries using the BQL (Beancount Query Language) integration in Obsidian. Perfect for screenshots and showcasing the feature!

---

## 💰 **Portfolio Overview**

### Current Asset Allocation
```bql
SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account ORDER BY sum(position) DESC LIMIT 10
```

### Net Worth Summary
```bql
SELECT 
  'Assets' as category, 
  convert(sum(position), 'USD') as total 
WHERE account ~ '^Assets'
UNION ALL
SELECT 
  'Liabilities' as category, 
  convert(sum(position), 'USD') as total 
WHERE account ~ '^Liabilities'
```

---

## 📈 **Investment Analysis**

### Top Performing Holdings
```bql
SELECT account, sum(position), units(sum(position)) 
WHERE account ~ '^Assets:Investments' 
GROUP BY account 
ORDER BY sum(position) DESC
```

### Cash vs Investment Split
```bql
SELECT 
  CASE 
    WHEN account ~ 'Cash|Checking|Savings' THEN 'Cash'
    WHEN account ~ 'Investment|Brokerage|401k|IRA' THEN 'Investments'
    ELSE 'Other'
  END as asset_type,
  convert(sum(position), 'USD') as total
WHERE account ~ '^Assets'
GROUP BY asset_type
ORDER BY total DESC
```

---

## 💸 **Expense Analysis**

### Monthly Spending Breakdown (Last 6 Months)
```bql
SELECT 
  year, 
  month, 
  convert(sum(position), 'USD') as monthly_expenses
WHERE account ~ '^Expenses' 
  AND date >= DATE_SUB(TODAY(), INTERVAL 6 MONTH)
GROUP BY year, month 
ORDER BY year DESC, month DESC
```

### Top Expense Categories This Year
```bql
SELECT 
  account, 
  convert(sum(position), 'USD') as spent
WHERE account ~ '^Expenses' 
  AND year = YEAR(TODAY())
GROUP BY account 
ORDER BY spent DESC 
LIMIT 15
```

### Dining Out vs Groceries Comparison
```bql
SELECT 
  CASE 
    WHEN account ~ 'Dining|Restaurant' THEN 'Dining Out'
    WHEN account ~ 'Groceries|Food:Groceries' THEN 'Groceries'
    ELSE 'Other Food'
  END as food_type,
  convert(sum(position), 'USD') as total
WHERE account ~ '^Expenses:Food'
  AND year = YEAR(TODAY())
GROUP BY food_type
ORDER BY total DESC
```

---

## 📊 **Income Tracking**

### Income Sources This Year
```bql
SELECT 
  account, 
  convert(sum(position), 'USD') as income
WHERE account ~ '^Income' 
  AND year = YEAR(TODAY())
GROUP BY account 
ORDER BY income DESC
```

### Monthly Income Trend
```bql
SELECT 
  year, 
  month, 
  convert(sum(position), 'USD') as monthly_income
WHERE account ~ '^Income:Salary'
  AND date >= DATE_SUB(TODAY(), INTERVAL 12 MONTH)
GROUP BY year, month 
ORDER BY year DESC, month DESC
```

---

## 🏦 **Account Health**

### Account Balances by Institution
```bql
SELECT 
  REGEXP_EXTRACT(account, r'^Assets:([^:]+)') as institution,
  convert(sum(position), 'USD') as balance
WHERE account ~ '^Assets:(Checking|Savings|Investment)'
GROUP BY institution
ORDER BY balance DESC
```

### Credit Card Balances
```bql
SELECT 
  account, 
  convert(sum(position), 'USD') as balance
WHERE account ~ '^Liabilities:CreditCard'
GROUP BY account 
ORDER BY balance DESC
```

---

## 📅 **Recent Activity**

### Recent Large Transactions
```bql
SELECT 
  date, 
  payee, 
  narration, 
  account, 
  convert(position, 'USD') as amount
WHERE ABS(CONVERT(position, 'USD')) > 1000
ORDER BY date DESC 
LIMIT 20
```

### This Week's Transactions
```bql
SELECT 
  date, 
  payee, 
  narration, 
  account,
  position
WHERE date >= DATE_SUB(TODAY(), INTERVAL 7 DAY)
ORDER BY date DESC, payee
```

---

## 🎯 **Budget Analysis**

### Budget vs Actual (Monthly)
```bql
SELECT 
  REGEXP_EXTRACT(account, r'^Expenses:([^:]+)') as category,
  convert(sum(position), 'USD') as actual_spent
WHERE account ~ '^Expenses' 
  AND year = YEAR(TODAY()) 
  AND month = MONTH(TODAY())
GROUP BY category
ORDER BY actual_spent DESC
LIMIT 10
```

### Savings Rate Calculation
```bql
SELECT 
  'Income' as type,
  convert(sum(position), 'USD') as amount
WHERE account ~ '^Income'
  AND year = YEAR(TODAY())
UNION ALL
SELECT 
  'Expenses' as type,
  convert(sum(position), 'USD') as amount
WHERE account ~ '^Expenses'
  AND year = YEAR(TODAY())
```

---

## 🔍 **Deep Dive Queries**

### Subscription Services Tracking
```bql
SELECT 
  payee,
  count(*) as frequency,
  convert(sum(position), 'USD') as total_spent
WHERE (payee ~ 'Netflix|Spotify|Amazon|Adobe|Microsoft')
  OR (narration ~ 'subscription|monthly|recurring')
  AND date >= DATE_SUB(TODAY(), INTERVAL 12 MONTH)
GROUP BY payee
ORDER BY total_spent DESC
```

### Tax-Deductible Expenses
```bql
SELECT 
  account,
  convert(sum(position), 'USD') as deductible_amount
WHERE account ~ '^Expenses:(Medical|Charity|Business|Education)'
  AND year = YEAR(TODAY())
GROUP BY account
ORDER BY deductible_amount DESC
```

### Currency Exposure
```bql
SELECT 
  UNITS(sum(position)) as currency,
  sum(position) as total_holdings
WHERE account ~ '^Assets'
GROUP BY UNITS(sum(position))
HAVING UNITS(sum(position)) != 'USD'
ORDER BY total_holdings DESC
```

---

## 🚀 **Advanced Analytics**

### Monthly Burn Rate (6-Month Average)
```bql
SELECT 
  AVG(monthly_expenses) as avg_monthly_burn
FROM (
  SELECT 
    year, 
    month,
    convert(sum(position), 'USD') as monthly_expenses
  WHERE account ~ '^Expenses'
    AND date >= DATE_SUB(TODAY(), INTERVAL 6 MONTH)
  GROUP BY year, month
)
```

### Wealth Accumulation Trend
```bql
SELECT 
  year,
  month,
  convert(sum(position), 'USD') as net_worth
WHERE account ~ '^(Assets|Liabilities)'
GROUP BY year, month
ORDER BY year DESC, month DESC
LIMIT 24
```

---

## 💡 **Quick Insights**

### Account Count by Type
```bql
SELECT 
  REGEXP_EXTRACT(account, r'^([^:]+)') as account_type,
  count(distinct account) as account_count
GROUP BY account_type
ORDER BY account_count DESC
```

### Most Frequent Payees
```bql
SELECT 
  payee,
  count(*) as transaction_count,
  convert(sum(position), 'USD') as total_amount
WHERE payee IS NOT NULL
  AND date >= DATE_SUB(TODAY(), INTERVAL 6 MONTH)
GROUP BY payee
ORDER BY transaction_count DESC
LIMIT 15
```

---

## 📝 **Screenshot Tips**

**For Best Screenshots:**
1. **Disable tools** in settings for clean tables
2. **Use descriptive queries** that show real insights
3. **Include date ranges** for realistic data
4. **Show variety**: balances, trends, comparisons
5. **Highlight powerful features**: regex, date functions, conversions

**Perfect for showcasing:**
- ✅ Complex financial analysis in plain text notes
- ✅ Live data that updates automatically  
- ✅ Professional-looking tables with no setup
- ✅ Advanced SQL-like queries for accounting data
- ✅ Seamless integration with note-taking workflow