# Savings Rate Debug Test - FIXED BEANCOUNT LOGIC ✅

## 🔧 **Critical Fix Applied**

**Issue**: Previous logic incorrectly assumed expenses were negative in Beancount  
**Reality**: In Beancount accounting:
- **Income accounts**: Negative balances (credits) → Convert to positive for display
- **Expense accounts**: Positive balances (debits) → Already positive  
- **Asset accounts**: Positive balances (debits)
- **Liability accounts**: Negative balances (credits) → Convert to positive for display

## ✅ Enhanced Debug Logging Active

The plugin now has corrected Beancount accounting logic + comprehensive debug logging.

## 🔧 Test Instructions

### Step 1: Open Obsidian Plugin
1. **Load the plugin** in Obsidian (ensure the latest build is copied to your vault)
2. **Open Unified Dashboard** (ribbon icon or command palette)
3. **Navigate to Overview tab**

### Step 2: Enable Console Logging
1. **Open Developer Tools**: Press `F12` or `Ctrl+Shift+I`
2. **Go to Console tab**
3. **Clear console**: Click the clear button or press `Ctrl+L`

### Step 3: Trigger Debug Output
1. **Click the Refresh button** in the Overview tab
2. **Watch console output** for detailed logging

## 📊 Expected Console Output (CORRECTED)

The debug logging will show **5 key stages**:

### 1. Raw Query Results
```javascript
Raw query results: {
  assets: "50000.00 USD",           // Total assets (positive)
  liabilities: "-10000.00 USD",     // Total liabilities (negative)  
  income: "-5000.00 USD",           // Monthly income (negative)
  expenses: "2000.00 USD"           // Monthly expenses (positive)
}
```

### 2. Extracted Amounts  
```javascript
Extracted amounts: {
  assets: "50000.00 USD",           // After currency extraction
  liabilities: "-10000.00 USD",     
  income: "-5000.00 USD",           
  expenses: "2000.00 USD"           
}
```

### 3. Parsed Amounts (CORRECTED LOGIC)
```javascript
Parsed amounts: {
  assets: {amount: 50000, currency: "USD"},
  liabilities: {amount: -10000, currency: "USD"},
  income: {amount: -5000, currency: "USD"},
  expenses: {amount: 2000, currency: "USD"},
  incomeAmount: 5000,               // Math.abs(-5000) = 5000 for display
  expensesAmount: 2000,             // Already positive
  liabilitiesAmount: 10000          // Math.abs(-10000) = 10000 for display
}
```

### 4. Calculations (CORRECTED)
```javascript
Calculations: {
  netWorth: 40000,                  // Assets - |Liabilities| = 50000 - 10000
  savings: 3000,                    // |Income| - Expenses = 5000 - 2000
  income: 5000,                     // |Income| for percentage calculation
  expenses: 2000,                   // Expenses (already positive)
  savingsRate: "60"                 // (3000 / 5000) * 100 = 60%
}
```

### 5. Final State
```javascript
Final state to be set: {
  netWorth: "40000.00 USD",
  monthlyIncome: "5000.00 USD",     // Displayed as positive
  monthlyExpenses: "2000.00 USD",   // Displayed as positive
  savingsRate: "60%",               // ← Should now appear correctly in UI
  currency: "USD"
}
```

## 🚨 Troubleshooting Scenarios

### ❌ Scenario 1: Savings Rate shows "0%" or "N/A"

**If you see:**
```javascript
Calculations: {
  income: 0,                       // ← Problem: No income data
  savingsRate: "N/A"
}
```

**Root Cause**: No income transactions for November 2025
**Solution**: Add test income transactions with negative amounts

### ❌ Scenario 2: Empty Query Results

**If you see:**
```javascript
Raw query results: {
  income: "",                      // ← Problem: Empty result
  expenses: ""
}
```

**Root Cause**: No transactions in date range 2025-11-01 to 2025-11-30
**Solution**: Add transactions for current month

## 🛠️ Quick Fix: Add Test Data (CORRECTED FORMAT)

If your Beancount file has no November 2025 data, add these test transactions:

```beancount
2025-11-01 * "Test Monthly Income"
  Income:Salary          -5000.00 USD    ; ← Note: Negative (credit)
  Assets:Checking         5000.00 USD

2025-11-02 * "Test Monthly Expense" 
  Expenses:Food            500.00 USD    ; ← Note: Positive (debit)
  Assets:Checking         -500.00 USD

2025-11-03 * "Test Monthly Expense"
  Expenses:Transport       200.00 USD    ; ← Note: Positive (debit) 
  Assets:Checking         -200.00 USD
```

**Expected Result:**
- Monthly Income Query: `-5000.00 USD` → Displayed as: `5000.00 USD`
- Monthly Expenses Query: `700.00 USD` → Displayed as: `700.00 USD`  
- Savings Rate: `(5000 - 700) / 5000 * 100 = 86%`

## 📋 Debug Checklist (UPDATED)

- [ ] Console shows all 5 debug output stages
- [ ] Raw income shows **negative** value (e.g., "-5000.00 USD")
- [ ] Raw expenses show **positive** value (e.g., "2000.00 USD")
- [ ] Parsed amounts show correct `incomeAmount` (absolute of negative income)
- [ ] Calculations show positive income and expenses values
- [ ] Final state contains savings rate with "%" symbol
- [ ] UI displays the calculated savings rate

## 🎯 What Changed

**Before (WRONG)**: `savings = income - Math.abs(expenses)`  
**After (CORRECT)**: `savings = Math.abs(income) - expenses`

This reflects proper Beancount accounting where:
- Income accounts naturally have negative balances
- Expense accounts naturally have positive balances

---

**Current Status**: ✅ **Fixed and ready for testing** - Beancount accounting logic corrected, debug logging enhanced.