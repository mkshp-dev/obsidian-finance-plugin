---
sidebar_position: 1
---

# Beancount Transaction Syntax

## 📝 Overview

While the Unified Transaction Modal simplifies data entry through a friendly interface, understanding the underlying Beancount plain-text syntax is valuable for:

- **Direct file editing** in your preferred text editor.
- **Power-user workflows** with scripts and automation.
- **Debugging** transaction issues.
- **Understanding** what the plugin generates behind the scenes.

This reference covers all Beancount transaction syntax types with clear indicators showing what the plugin currently supports through its UI.

:::tip Support Status Legend
- ✅ **Fully Supported** - Available through the transaction modal UI.
- ⚠️ **Partially Supported** - Requires manual file editing or workarounds.
- ❌ **Not Yet Supported** - Coming in future versions.
:::

---

## 💰 Basic Transaction Structure

### Transaction Flags

Transaction flags indicate the status of a transaction.

#### Completed Transaction (*)
```beancount
2024-12-30 * "Grocery Store" "Weekly shopping"
  Expenses:Food:Groceries           45.50 USD
  Assets:Cash                      -45.50 USD
```
**Status:** ✅ Fully Supported (default flag in modal)

#### Incomplete Transaction (!)
```beancount
2024-12-30 ! "Pending charge"
  Expenses:Unknown                 25.00 USD
  Assets:Cash                     -25.00 USD
```
**Status:** ✅ Fully Supported

**How to use:** In the transaction header, select `!` from the Flag dropdown next to the Date field.

---

### Payee and Narration Variations

#### Both Payee and Narration
```beancount
2024-12-30 * "Amazon" "Office supplies"
  Expenses:Shopping                29.99 USD
  Liabilities:CreditCard          -29.99 USD
```
**Status:** ✅ Fully Supported

**How to use:** Fill in both "Payee" and "Description" fields in the modal.

#### Narration Only
```beancount
2024-12-30 * "Coffee and pastries"
  Expenses:Food:Coffee              8.50 USD
  Assets:Cash                      -8.50 USD
```
**Status:** ✅ Fully Supported

**How to use:** Leave "Payee" field empty, fill only "Description" field.

#### Payee Only (Empty Narration)
```beancount
2024-12-30 * "Amazon" ""
  Expenses:Shopping                29.99 USD
  Liabilities:CreditCard          -29.99 USD
```
**Status:** ✅ Fully Supported

**How to use:** Fill "Payee" field, leave "Description" empty.

#### No Payee or Narration
```beancount
2024-12-30 *
  Expenses:Misc                    10.00 USD
  Assets:Cash                     -10.00 USD
```
**Status:** ✅ Fully Supported

---

## 🎯 Multiple Postings

Transactions can have any number of postings (minimum 2 required by Beancount).

### Salary with Multiple Deductions
```beancount
2024-12-15 * "Acme Corp" "Monthly salary"
  Assets:Checking                 3500.00 USD
  Income:Salary                  -5000.00 USD
  Expenses:Taxes:Federal           900.00 USD
  Expenses:Taxes:State             300.00 USD
  Expenses:Taxes:SocialSecurity    300.00 USD
```
**Status:** ✅ Fully Supported

**How to use:** Click "Add Posting" button to add as many postings as needed.

### Split Payment
```beancount
2024-12-30 * "Restaurant bill split"
  Liabilities:CreditCard           -80.00 USD
  Assets:AccountsReceivable:John    40.00 USD
  Expenses:Restaurant               40.00 USD
```
**Status:** ✅ Fully Supported

---

## 🔢 Amount Interpolation

Beancount can automatically calculate one missing amount to balance the transaction.

### One Elided Amount
```beancount
2024-12-30 * "Credit card payment"
  Assets:Checking                -400.00 USD
  Liabilities:CreditCard
```
**Status:** ✅ Fully Supported

**How to use:** Leave the Amount field empty for one posting. Beancount will calculate it automatically.

### Elided Amount with Cost
```beancount
2024-12-30 * "Sold stocks"
  Assets:Brokerage:AAPL           -10 AAPL {150.00 USD}
  Assets:Brokerage:Cash          1750.00 USD
  Income:CapitalGains
```
**Status:** ✅ Fully Supported

### Multiple Currencies with Elided Amount
```beancount
2024-12-30 * "Foreign currency gift"
  Income:Gifts                   -100.00 EUR
  Income:Gifts                    -50.00 GBP
  Assets:Cash
```
**Status:** ✅ Fully Supported

**Note:** Beancount creates separate balance postings for each currency when using interpolation.

---

## 💱 Prices - Currency Conversion

Prices are used for currency conversions where you don't need to track cost basis.

### Per-Unit Price (@)
```beancount
2024-12-30 * "Currency exchange"
  Assets:Checking                -400.00 USD @ 1.09 CAD
  Assets:ForeignBank              436.00 CAD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting with amount (e.g., `-400.00 USD`)
2. Click "▶ Advanced (Cost/Price)" to expand the section
3. Fill in **Price Amount**: `1.09`
4. Fill in **Price Currency**: `CAD`
5. Leave "Total Price" checkbox unchecked

### Total Price (@@)
```beancount
2024-12-30 * "Currency exchange total"
  Assets:Checking                -400.00 USD @@ 436.00 CAD
  Assets:ForeignBank              436.00 CAD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting with amount
2. Click "▶ Advanced (Cost/Price)"
3. Fill in **Price Amount**: `436.00`
4. Fill in **Price Currency**: `CAD`
5. **Check** "Total Price (use @@ instead of @)"

---

## 📈 Costs - Tracking Investments

Costs are used for commodities held at cost (stocks, investments) to track cost basis for capital gains calculations.

### Per-Unit Cost - Buying Stocks
```beancount
2024-12-30 * "Buy Apple shares"
  Assets:Brokerage:AAPL            10 AAPL {150.00 USD}
  Assets:Brokerage:Cash         -1500.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting: Amount `10`, Currency `AAPL`
2. Click "▶ Advanced (Cost/Price)"
3. Fill in **Cost Amount**: `150.00`
4. Fill in **Cost Currency**: `USD`
5. Leave "Total Cost" checkbox unchecked

### Total Cost - With Fees
```beancount
2024-12-30 * "Buy shares with commission"
  Assets:Brokerage:IVV             10 IVV {{1850.00 USD}}
  Assets:Brokerage:Cash         -1850.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting: Amount `10`, Currency `IVV`
2. Click "▶ Advanced (Cost/Price)"
3. Fill in **Cost Amount**: `1850.00`
4. Fill in **Cost Currency**: `USD`
5. **Check** "Total Cost (use &#123;&#123;&#125;&#125; instead of &#123;&#125;)"

### Cost with Date
```beancount
2024-12-30 * "Buy shares"
  Assets:Brokerage:MSFT            20 MSFT {183.07 USD, 2024-12-30}
  Assets:Brokerage:Cash         -3661.40 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Set up cost as above
2. Fill in **Cost Date** field using the date picker

### Cost with Label
```beancount
2024-12-30 * "Buy shares with label"
  Assets:Brokerage:GOOG            15 GOOG {140.50 USD, "lot-2024-001"}
  Assets:Brokerage:Cash         -2107.50 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Set up cost as above
2. Fill in **Cost Label** field: `lot-2024-001` (quotes added automatically)

### Cost with Both Date and Label
```beancount
2024-12-30 * "Buy shares fully labeled"
  Assets:Brokerage:TSLA            5 TSLA {250.00 USD, 2024-12-30, "tesla-dec"}
  Assets:Brokerage:Cash         -1250.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Set up cost as above
2. Fill in both **Cost Date** and **Cost Label** fields

---

## 💰 Cost AND Price Together

You can specify both cost and price on the same posting. The cost is used for balance calculation and lot tracking, while the price is recorded in Beancount's price database.

```beancount
2024-12-30 * "Sell Apple shares at profit"
  Assets:Brokerage:AAPL           -10 AAPL {150.00 USD} @ 175.00 USD
  Assets:Brokerage:Cash          1750.00 USD
  Income:CapitalGains            -250.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting: Amount `-10`, Currency `AAPL`
2. Click "▶ Advanced (Cost/Price)"
3. Fill in **Cost** section: Amount `150.00`, Currency `USD`
4. Fill in **Price** section: Amount `175.00`, Currency `USD`

**Use case:** When selling investments, this records both the original purchase price (for capital gains calculation) and the current sale price (for market value tracking).

---

## 🎯 Lot Matching (Reducing Positions)

When selling investments, you can specify which lot to reduce using various matching methods.

### Match by Exact Cost
```beancount
2024-12-30 * "Sell specific lot by cost"
  Assets:Brokerage:MSFT           -20 MSFT {183.07 USD}
  Assets:Brokerage:Cash          3900.00 USD
  Income:CapitalGains
```
**Status:** ✅ Fully Supported

**How to use:** Specify the exact cost amount used when originally purchasing that lot.

### Match by Date Only
```beancount
2024-12-30 * "Sell by acquisition date"
  Assets:Brokerage:MSFT           -20 MSFT {2024-01-15}
  Assets:Brokerage:Cash          3900.00 USD
  Income:CapitalGains
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting: Amount `-20`, Currency `MSFT`
2. Click "▶ Advanced (Cost/Price)"
3. **Leave Cost Amount empty**
4. Fill in **Cost Date**: Select the acquisition date
5. Leave Cost Currency empty

**Use case:** When you want to sell shares acquired on a specific date without needing to remember the exact cost.

### Match by Label Only
```beancount
2024-12-30 * "Sell by label"
  Assets:Brokerage:GOOG           -15 GOOG {"lot-2024-001"}
  Assets:Brokerage:Cash          2250.00 USD
  Income:CapitalGains
```
**Status:** ✅ Fully Supported

**How to use:**
1. Add posting: Amount `-15`, Currency `GOOG`
2. Click "▶ Advanced (Cost/Price)"
3. **Leave Cost Amount and Cost Date empty**
4. Fill in **Cost Label**: `lot-2024-001`
5. Leave Cost Currency empty

**Use case:** When you label lots for identification (e.g., "employee-grant-2024", "tax-loss-harvest") and want to sell a specific labeled lot.

---

## 🏷️ Tags

Tags allow you to categorize and filter transactions. They're useful for budgeting, tracking projects, or marking tax-deductible expenses.

### Single Tag
```beancount
2024-12-30 * "Flight to Berlin" #vacation
  Expenses:Travel:Flights        1200.00 USD
  Liabilities:CreditCard        -1200.00 USD
```
**Status:** ✅ Fully Supported

### Multiple Tags
```beancount
2024-12-30 * "Business dinner" #work #deductible #reimbursable
  Expenses:Meals                  125.00 USD
  Liabilities:CreditCard         -125.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Scroll down to the "Tags" section in the modal.
2. Type tag name (without the `#` symbol).
3. Press Enter or click the add button.
4. Repeat for multiple tags.

---

## 🔗 Links

Links connect related transactions together (like an invoice and its payment, or multiple transactions in the same project).

### Single Link
```beancount
2024-12-30 * "Invoice for consulting" ^invoice-2024-12
  Income:Consulting              -2500.00 USD
  Assets:AccountsReceivable      2500.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. Scroll down to the "Tags & Links" section in the modal.
2. Type link name in the Links field (without the `^` symbol).
3. Press Enter or click the add button.
4. Repeat for multiple links.

---

## 🧮 Arithmetic Expressions

Beancount supports arithmetic expressions in amount fields for convenience.

### Simple Division
```beancount
2024-12-30 * "Split bill"
  Liabilities:CreditCard          -120.00 USD
  Assets:AccountsReceivable:Bob   120.00/3 USD
  Assets:AccountsReceivable:Sue   120.00/3 USD
  Expenses:Restaurant
```
**Status:** ❌ Not Supported

**Workaround:** Calculate the result manually (40.00 USD in this example) and enter the computed value.

---

## 📋 Metadata

Metadata allows attaching arbitrary key-value data to transactions and postings.

### Transaction-Level Metadata
```beancount
2024-12-30 * "Hotel booking"
  confirmation: "ABC123456"
  category: "Travel"
  Expenses:Travel:Hotel           250.00 USD
  Liabilities:CreditCard         -250.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. In the transaction header row, click the **📋** (Metadata) button on the far right.
2. This expands the Transaction Metadata section.
3. Click "+ Add Metadata" to add a key-value pair.
4. Enter the key (must be lowercase) and value.

---

## 📊 Feature Support Summary

| Feature | Support | Notes |
|:---|:---|:---|
| Transaction flags | ✅ Full | Supported via flag selectors |
| Payee and/or narration | ✅ Full | All combinations supported |
| Multiple postings (>2) | ✅ Full | Add unlimited postings in UI |
| Amount interpolation | ✅ Full | Leave one amount field blank |
| Per-unit price (@) | ✅ Full | Supported |
| Total price (@@) | ✅ Full | Supported |
| Per-unit cost (`{}`) | ✅ Full | Supported |
| Total cost (`{{}}`) | ✅ Full | Supported |
| Cost date and label | ✅ Full | Supported in advanced drawer |
| Cost + Price together | ✅ Full | Supported |
| Lot matching | ✅ Full | Match by cost, date, or label |
| Tags & Links | ✅ Full | Supported in tags/links field |
| Transaction metadata | ✅ Full | Supported |
| Posting metadata | ✅ Full | Supported |
| Inline comments | ✅ Full | Supported |
| Arithmetic expressions | ❌ No | Calculate manually |
| Multiple currencies | ✅ Full | Supported |
