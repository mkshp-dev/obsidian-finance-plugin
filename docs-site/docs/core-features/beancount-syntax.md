---
sidebar_position: 2
---

# Beancount Transaction Syntax

## 📝 Overview

While the Unified Transaction Modal simplifies data entry through a friendly interface, understanding the underlying Beancount plain-text syntax is valuable for :

- **Direct file editing** in your preferred text editor
- **Power-user workflows** with scripts and automation
- **Debugging** transaction issues
- **Understanding** what the plugin generates behind the scenes

This reference covers all Beancount transaction syntax types with clear indicators showing what the plugin currently supports through its UI.

:::tip Support Status Legend
- ✅ **Fully Supported** - Available through the transaction modal UI
- ⚠️ **Partially Supported** - Requires manual file editing or workarounds
- ❌ **Not Yet Supported** - Coming in future versions
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
1. Scroll down to the "Tags" section in the modal
2. Type tag name (without the `#` symbol)
3. Press Enter or click the add button
4. Repeat for multiple tags

**Tips:**
- Tags appear after the narration in the generated Beancount syntax
- Use consistent tag names for easier filtering
- Common tags: `#vacation`, `#work`, `#tax-deductible`, `#reimbursable`

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
1. Scroll down to the "Tags & Links" section in the modal
2. Type link name in the Links field (without the `^` symbol)
3. Press Enter or click the add button
4. Repeat for multiple links

### Multiple Related Transactions
```beancount
2024-12-01 * "Invoice sent" ^project-alpha
  Income:Consulting              -5000.00 USD
  Assets:AccountsReceivable      5000.00 USD

2024-12-30 * "Payment received" ^project-alpha
  Assets:Checking                5000.00 USD
  Assets:AccountsReceivable     -5000.00 USD
```
**Status:** ✅ Fully Supported

**Tips:**
- Links appear after tags in the generated Beancount syntax
- Use consistent link names to connect related transactions
- Common uses: invoices and payments, project tracking, loan installments

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

### Complex Expression
```beancount
2024-12-30 * "Shared expense with adjustment"
  Liabilities:CreditCard           -85.00 USD
  Assets:AccountsReceivable:John  ((85.00/2) - 5) USD
  Expenses:Shopping
```
**Status:** ❌ Not Supported

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
1. In the transaction header row, click the **📋** (Metadata) button on the far right
2. This expands the Transaction Metadata section
3. Click "+ Add Metadata" to add a key-value pair
4. Enter the key (must be lowercase, e.g., `confirmation`) and value
5. Add multiple metadata entries as needed

**Note:** Metadata keys must be lowercase with only letters, numbers, hyphens, or underscores. The plugin validates this before saving.

### Posting-Level Metadata
```beancount
2024-12-30 * "Stock purchase"
  Assets:Brokerage:AAPL            10 AAPL {150.00 USD}
    broker: "E-Trade"
    order-id: "12345"
  Assets:Brokerage:Cash         -1500.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. For each posting, click the **📋** button in the posting toolbar (next to 💬, !, @, $)
2. This expands the Posting Metadata section for that specific posting
3. Click "+ Add Metadata" to add key-value pairs
4. Enter keys (must be lowercase) and values
5. Each posting can have its own independent metadata

**Note:** Posting-level metadata is indented with 4 spaces and appears immediately after the posting line. Beancount's internal metadata (like `filename`, `lineno`, `__tolerances__`, `__accuracy__`) is automatically hidden in the UI.

---

## 🚩 Posting-Level Flags

Individual postings can have their own flags (! for pending, * for cleared).

```beancount
2024-12-30 * "Suspected duplicate"
  Assets:Checking                -100.00 USD
  ! Expenses:Misc                 100.00 USD
```
**Status:** ✅ Fully Supported

**How to use:**
1. For each posting, click the **!** button in the posting toolbar
2. This expands a Flag dropdown for that posting
3. Select either `*` (cleared) or `!` (pending)
4. The flag appears before the account name in the generated syntax

**Use case:** Marking individual postings as uncertain while the overall transaction is confirmed.

---

## 💬 Comments

### Inline Comments
```beancount
2024-12-30 * "Grocery shopping"
  Expenses:Groceries               75.50 USD  ; Weekly supplies
  Assets:Cash                     -75.50 USD  ; Paid in cash
```
**Status:** ✅ Fully Supported

**How to use:**
1. For each posting, click the **💬** button in the posting toolbar
2. This expands a Comment field for that posting
3. Enter your comment text (without the `;` symbol)
4. The comment appears at the end of the posting line prefixed with `;`

**Note:** Comments are posting-specific and appear on the same line as the posting amount.

### Block Comments
```beancount
; This is a comment line
; It can span multiple lines

2024-12-30 * "Regular transaction"
  Expenses:Something               10.00 USD
  Assets:Cash                     -10.00 USD
```
**Status:** ⚠️ Preserved when editing, but not editable through modal

---

## 🌍 Multiple Currencies in Same Transaction

Transactions can mix multiple currencies, useful for forex trading, gifts, or international transfers.

```beancount
2024-12-30 * "Mixed currency transaction"
  Assets:Cash:USD                -100.00 USD
  Assets:Cash:EUR                  85.00 EUR @ 1.18 USD
  Expenses:CurrencyExchange         3.00 USD
```
**Status:** ✅ Fully Supported

**How to use:** Each posting can have a different currency in the Currency field. Use prices (@) to record exchange rates when needed.

---

## 📊 Feature Support Summary

| Feature | Support | Notes |
|---------|---------|-------|
| **Basic Transactions** | | |
| Transaction flag (*) | ✅ Full | Default in modal |
| Transaction flag (!) | ✅ Full | Flag dropdown in header |
| Payee and/or narration | ✅ Full | All combinations supported |
| Multiple postings (>2) | ✅ Full | Click "Add Posting" |
| Amount interpolation | ✅ Full | Leave one amount empty |
| **Prices & Costs** | | |
| Per-unit price (@) | ✅ Full | Click **@** button |
| Total price (@@) | ✅ Full | Via checkbox |
| Per-unit cost (&#123;&#125;) | ✅ Full | Click **$** button |
| Total cost (&#123;&#123;&#125;&#125;) | ✅ Full | Via checkbox |
| Cost with date | ✅ Full | Via date picker |
| Cost with label | ✅ Full | Via text field |
| Cost + Price together | ✅ Full | Fill both sections |
| **Lot Matching** | | |
| By exact cost | ✅ Full | Specify cost amount |
| By date only | ✅ Full | Date field only |
| By label only | ✅ Full | Label field only |
| **Organization** | | |
| Tags | ✅ Full | Add via Tags section |
| Links | ✅ Full | Add via Links section |
| **Advanced** | | |
| Transaction metadata | ✅ Full | Click **📋** in header |
| Posting metadata | ✅ Full | Click **📋** per posting |
| Posting flags | ✅ Full | Click **!** per posting |
| Inline comments | ✅ Full | Click **💬** per posting |
| Arithmetic expressions | ❌ No | Calculate manually |
| Multiple currencies | ✅ Full | Mix currencies freely |

---

## 💡 Tips for Power Users

### When to Use Cost vs Price

**Use Cost for:**
- 📈 **Investments** (stocks, bonds, crypto) where you need capital gains tracking
- 🏦 **Assets held at cost** that you plan to sell later
- Example: Buying 100 shares of AAPL at $150 each

**Use Price for:**
- 💱 **Simple currency conversions** without cost basis tracking
- 📊 **Recording exchange rates** for reference
- Example: Converting $1000 to €900

**Use Both for:**
- 💰 **Selling investments** to record both cost basis and sale price
- Example: Selling AAPL shares bought at $150, now worth $175

### Using the Posting Toolbar

Each posting has a toolbar with 5 feature buttons:

- **$** (Cost) - Add cost basis for investments
- **@** (Price) - Add conversion price
- **!** (Flag) - Mark posting as pending (*) or cleared (!)
- **💬** (Comment) - Add inline comment
- **📋** (Metadata) - Add posting-level metadata

Click any button to expand that section. You can use multiple features on the same posting.

### Using the Advanced Section Effectively

The **$** (Cost) and **@** (Price) buttons expand sections on each posting:

1. **Cost Basis Section**
   - **Cost Amount**: Per-unit acquisition cost (or total if checkbox checked)
   - **Cost Currency**: Currency of the cost
   - **Cost Date**: Acquisition date (for lot matching)
   - **Cost Label**: Custom identifier for the lot
   - **Checkbox**: Check for total cost &#123;&#123;&#125;&#125; instead of per-unit &#123;&#125;

2. **Conversion Price Section**
   - **Price Amount**: Exchange rate or total amount
   - **Price Currency**: Currency being converted to
   - **Checkbox**: Check for total price `@@` instead of per-unit `@`

### Editing Existing Transactions

When you edit a transaction that has costs or prices:
- The Advanced section **auto-expands** if cost/price data exists
- All existing values are preserved
- You can modify or remove cost/price data as needed
- Empty fields are ignored (won't generate empty cost/price syntax)

### Direct File Editing

If you prefer editing `.beancount` files directly:
- **Date-ordered**: Keep transactions sorted by date for `bean-check` validation
- **Indentation**: Use 2 spaces for postings
- **Alignment**: Align amounts at column 50+ for readability (optional)
- **Validation**: Run `bean-check` to verify syntax before using

---

## 🛠️ Under the Hood

### How the Plugin Generates Syntax

When you save a transaction through the modal, the plugin:

1. **Validates** all fields (required fields, positive amounts, date constraints)
2. **Formats** the transaction according to Beancount syntax rules
3. **Positions** the transaction in date order within the file
4. **Writes atomically** with optional backup creation

### Backend Processing

The plugin uses a Python Flask backend ([journal_api.py](../../../src/backend/journal_api.py)) that:
- Parses the existing `.beancount` file preserving comments and formatting
- Generates proper Beancount syntax for costs/prices/tags
- Handles edge cases (payee-only, amount interpolation, lot matching)
- Creates backups before writing (if enabled in settings)

### Cost/Price Format Examples

The backend generates these formats based on your inputs:

| Your Input | Generated Syntax |
|------------|------------------|
| Cost: 150.00 USD | `{150.00 USD}` |
| Cost: 1850.00 USD (total) | `{{1850.00 USD}}` |
| Cost date: 2024-01-15 | `{2024-01-15}` |
| Cost label: "lot-001" | `{"lot-001"}` |
| Cost: 150 USD, date + label | `{150.00 USD, 2024-01-15, "lot-001"}` |
| Price: 1.09 CAD | `@ 1.09 CAD` |
| Price: 436.00 CAD (total) | `@@ 436.00 CAD` |
| Cost + Price | `{150.00 USD} @ 175.00 USD` |

---

## 🚀 Future Enhancements

Features planned for future releases:

- ⏳ **Arithmetic expressions** in amounts (e.g., `120.00/3 USD` for split bills)
- ⏳ **Bulk operations** (multi-transaction editing)
- ⏳ **Import from CSV/OFX** files
- ⏳ **Transaction templates** for recurring entries

Have a feature request? [Open an issue on GitHub](https://github.com/mkshp-dev/obsidian-finance-plugin/issues)!

---

## 📚 Additional Resources

- [Official Beancount Documentation](https://beancount.github.io/docs/)
- [Beancount Syntax Cheat Sheet](https://beancount.github.io/docs/beancount_cheat_sheet.html)
- [Beancount Cookbook](https://beancount.github.io/docs/trading_with_beancount.html)
- [Plugin GitHub Repository](https://github.com/mkshp-dev/obsidian-finance-plugin)

For help with the transaction modal UI, see [Adding Directives](./adding-directives.md).
