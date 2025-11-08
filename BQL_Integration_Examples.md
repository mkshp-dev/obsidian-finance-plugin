# BQL Integration Examples

This document demonstrates the complete BQL integration system with both code blocks and inline queries.

## 📊 BQL Code Blocks

Use code blocks for detailed analysis with formatted table results:

### Account Overview
```bql
SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account ORDER BY account
```

### Recent Activity
```bql
SELECT date, payee, narration, account, position ORDER BY date DESC LIMIT 15
```

### Monthly Summary
```bql
SELECT YEAR(date) as year, MONTH(date) as month, sum(position) 
WHERE account ~ '^Expenses' 
GROUP BY year, month 
ORDER BY year DESC, month DESC LIMIT 12
```

---

## 💰 Inline BQL Queries

### Direct Queries
Embed live values using single backticks with `bql:` prefix:

- My current net worth: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`
- Cash on hand: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'`
- Credit card balance: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Liabilities:Credit'`

### Shorthand System
Use shortcuts defined in your template file:

- **Total Worth**: `bql-sh:WORTH`
- **Checking Balance**: `bql-sh:CHECKING` 
- **Savings Balance**: `bql-sh:SAVINGS`
- **Monthly Expenses**: `bql-sh:EXPENSES_MTD`
- **Monthly Income**: `bql-sh:INCOME_MTD`

---

## 📝 Practical Examples

### Daily Journal Entry
```markdown
# Financial Journal - November 8, 2025

Today was a good day financially. I spent `bql-sh:DAILY_EXPENSES` on essentials and saved the rest.

## Current Status
- **Net Worth**: `bql-sh:WORTH` (up from last month!)
- **Emergency Fund**: `bql-sh:EMERGENCY_FUND` / $10,000 goal
- **Investment Portfolio**: `bql-sh:INVESTMENTS`

## Monthly Progress
This month I've spent `bql-sh:EXPENSES_MTD` out of my $3,000 budget, leaving `bql-sh:BUDGET_REMAINING` for the rest of November.

My income this month: `bql-sh:INCOME_MTD`
```

### Financial Review
```markdown
# Quarterly Review - Q4 2025

## Asset Summary
My total assets are now `bql-sh:TOTAL_ASSETS`, distributed across:
- Checking: `bql-sh:CHECKING`
- Savings: `bql-sh:SAVINGS` 
- Investments: `bql-sh:INVESTMENTS`
- Real Estate: `bql-sh:REAL_ESTATE`

## Performance Metrics
- Monthly savings rate: `bql-sh:SAVINGS_RATE`%
- Investment return YTD: `bql-sh:INVESTMENT_RETURN`%
- Debt-to-income ratio: `bql-sh:DEBT_RATIO`%

The goal is to reach `bql-sh:FINANCIAL_INDEPENDENCE_TARGET` by 2030.
```

---

## ⚙️ Setting Up Your Template File

Create a template file (e.g., `BQL_Shortcuts.md`) with this format:

```markdown
# My BQL Shortcuts

## WORTH: Total net worth in USD
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'
```

## CHECKING: Checking account balance
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'
```

## EXPENSES_MTD: Month-to-date expenses
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND YEAR(date) = YEAR(TODAY()) AND MONTH(date) = MONTH(TODAY())
```
```

Then configure the template path in Settings → Finance Plugin → BQL Shortcuts Template Path.

---

## 🎯 Tips & Best Practices

### Code Blocks - Best For:
- ✅ Financial reports and analysis
- ✅ Data export to spreadsheets  
- ✅ Complex multi-column queries
- ✅ Account reconciliation

### Inline Queries - Best For:
- ✅ Daily journal entries
- ✅ Quick status updates
- ✅ Goal tracking
- ✅ Financial summaries

### Template Organization:
- Use **UPPERCASE** names for shortcuts
- Group related shortcuts together
- Include helpful descriptions
- Customize currencies to your needs
- Keep queries simple for inline use

---

*This document demonstrates the power of embedding live financial data directly in your notes using the BQL integration system.*