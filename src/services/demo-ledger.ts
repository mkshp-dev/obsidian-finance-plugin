// src/services/demo-ledger.ts

export const DEMO_LEDGER_CONTENT = `;; Beancount Demo Ledger
;; Created by Beancount for Obsidian
;; Comprehensive example demonstrating all major Beancount features

;; ============================================================================
;; Global Options
;; ============================================================================

option "title" "Personal Finance Demo"
option "operating_currency" "USD"
option "booking_method" "STRICT"

;; Plugin directives (example - requires beancount.plugins.auto_accounts)
;; plugin "beancount.plugins.auto_accounts"

;; ============================================================================
;; Commodities
;; ============================================================================

1970-01-01 commodity USD
  name: "US Dollar"
  asset-class: "cash"
  
1970-01-01 commodity EUR
  name: "Euro"
  asset-class: "cash"

2020-01-01 commodity AAPL
  name: "Apple Inc."
  price: "yahoo/AAPL"
  logo: "https://logo.clearbit.com/apple.com"
  asset-class: "stock"
  
2020-01-01 commodity GOOGL
  name: "Alphabet Inc."
  price: "yahoo/GOOGL"
  logo: "https://logo.clearbit.com/google.com"
  asset-class: "stock"
  
2020-01-01 commodity MSFT
  name: "Microsoft Corporation"
  price: "yahoo/MSFT"
  logo: "https://logo.clearbit.com/microsoft.com"
  asset-class: "stock"

;; ============================================================================
;; Accounts
;; ============================================================================

;; Asset accounts
2020-01-01 open Assets:Checking USD
  description: "Primary checking account"

2020-01-01 open Assets:Savings USD
  description: "High-yield savings account"

2020-01-01 open Assets:Investments USD
  description: "Investment brokerage account"

;; Liability accounts
2020-01-01 open Liabilities:CreditCard USD
  description: "Credit card account"

;; Income accounts
2020-01-01 open Income:Salary USD
  description: "Employment income"

2020-01-01 open Income:Interest USD
  description: "Interest income from savings"

2020-01-01 open Income:Dividends USD
  description: "Dividend income from investments"

2020-01-01 open Income:CapitalGains USD
  description: "Capital gains from investment sales"

;; Expense accounts
2020-01-01 open Expenses:Food:Groceries USD
2020-01-01 open Expenses:Food:Dining USD
2020-01-01 open Expenses:Rent USD
2020-01-01 open Expenses:Utilities USD
2020-01-01 open Expenses:Transport USD
2020-01-01 open Expenses:Shopping USD
2020-01-01 open Expenses:Commissions USD

;; Equity accounts
2020-01-01 open Equity:Opening-Balances USD

;; Example of closing an account
;; 2026-12-31 close Assets:OldAccount

;; ============================================================================
;; Price History
;; ============================================================================

2026-01-03 price AAPL 185.50 USD
2026-01-03 price GOOGL 142.30 USD
2026-01-03 price MSFT 415.20 USD
2026-01-03 price EUR 1.10 USD

2026-02-01 price AAPL 192.75 USD
2026-02-01 price GOOGL 145.60 USD
2026-02-01 price MSFT 425.80 USD
2026-02-01 price EUR 1.11 USD

;; ============================================================================
;; Pad Directives
;; ============================================================================
;; Automatic balance padding - fills in missing amounts

2026-01-01 pad Assets:Checking Equity:Opening-Balances

;; ============================================================================
;; Balance Assertions
;; ============================================================================
;; Verify account balances at specific dates

2026-01-01 balance Assets:Checking 5000.00 USD
2026-01-01 balance Assets:Savings 10000.00 USD
2026-01-01 balance Liabilities:CreditCard -500.00 USD

2026-02-01 balance Assets:Checking 3555.00 USD

;; ============================================================================
;; Notes
;; ============================================================================
;; Account and transaction notes

2026-01-01 note Assets:Checking "Primary checking account - switched from old bank"
2026-01-15 note Liabilities:CreditCard "APR is 18.99% - consider paying off"

;; Document directives link external files (requires actual files)
;; 2026-01-01 document Assets:Checking "statements/checking-jan-2026.pdf"
;; 2026-01-31 document Liabilities:CreditCard "statements/cc-jan-2026.pdf"

;; ============================================================================
;; Events
;; ============================================================================
;; Financial events and milestones

2026-01-01 event "location" "New York"
2026-03-15 event "tax-filing" "Filed 2025 Tax Return"
2026-06-01 event "employer" "Promoted to Senior Position"

;; ============================================================================
;; Transactions
;; ============================================================================

2026-01-01 * "Opening Balance"
  Assets:Checking           5000.00 USD
  Assets:Savings           10000.00 USD
  Liabilities:CreditCard    -500.00 USD
  Equity:Opening-Balances

2026-01-03 * "Broker" "Purchase Apple Stock"
  Assets:Investments         10 AAPL {185.50 USD}
  Expenses:Commissions        4.95 USD
  Assets:Checking

2026-01-05 * "Landlord" "Monthly Rent" #rent
  Expenses:Rent             1200.00 USD
  Assets:Checking

2026-01-10 * "Grocery Store" "Weekly Groceries" #food #groceries
  Expenses:Food:Groceries    150.00 USD
  Liabilities:CreditCard

2026-01-12 * "Broker" "Purchase Google Stock"
  Assets:Investments          5 GOOGL {142.30 USD}
  Expenses:Commissions        4.95 USD
  Assets:Checking

2026-01-15 * "Employer" "Bi-weekly Salary" ^paycheck-001
  Assets:Checking           3000.00 USD
  Income:Salary

2026-01-18 * "Broker" "Purchase Microsoft Stock"
  Assets:Investments          3 MSFT {415.20 USD}
  Expenses:Commissions        4.95 USD
  Assets:Checking

2026-01-20 * "Restaurant" "Dinner with friends" #food #dining
  Expenses:Food:Dining        85.50 USD
  Liabilities:CreditCard

2026-01-22 ! "Online Purchase" "Pending charge" #shopping
  ; Note: ! flag indicates pending/uncertain transaction
  Expenses:Shopping         125.00 USD
  Liabilities:CreditCard

2026-01-25 * "Utility Co" "Electric Bill" #utilities
  Expenses:Utilities         120.00 USD
  Assets:Checking

2026-01-28 * "Gas Station" "Fuel" #transport
  Expenses:Transport          45.00 USD
  Liabilities:CreditCard

2026-02-01 * "Credit Card Co" "Payment" ^cc-payment-001
  Liabilities:CreditCard     500.00 USD
  Assets:Checking

2026-02-05 * "Landlord" "Monthly Rent" #rent
  Expenses:Rent             1200.00 USD
  Assets:Checking

2026-02-10 * "Bank" "Interest Payment"
  Assets:Savings              15.00 USD
    interest: "0.25% APY"
  Income:Interest

2026-02-10 * "Grocery Store" "Weekly Groceries" #food #groceries
  Expenses:Food:Groceries    145.00 USD
  Liabilities:CreditCard

2026-02-15 * "Employer" "Bi-weekly Salary" ^paycheck-002
  Assets:Checking           3000.00 USD
  Income:Salary

2026-02-15 * "Apple Inc" "Quarterly Dividend"
  Assets:Investments          2.50 USD
  Income:Dividends

2026-02-20 * "Broker" "Sell Apple Stock - Partial Position"
  Assets:Investments         -3 AAPL {185.50 USD} @ 192.75 USD
  Expenses:Commissions        4.95 USD
  Assets:Checking          551.30 USD
  Income:CapitalGains       -21.75 USD

;; Query directives (named BQL queries)
;; query "monthly-expenses" "
;;   SELECT date, narration, COST(position) AS amount
;;   FROM account ~ 'Expenses:'
;;   WHERE year = YEAR(TODAY()) AND month = MONTH(TODAY())
;; "
`;

