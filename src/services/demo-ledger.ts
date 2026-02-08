// src/services/demo-ledger.ts

export const DEMO_LEDGER_CONTENT = `;; Beancount Demo Ledger
;; Created by Beancount for Obsidian

option "title" "Personal Finance Demo"
option "operating_currency" "USD"

;; Commodities
2020-01-01 commodity USD
  name: "US Dollar"
  
2020-01-01 commodity AAPL
  name: "Apple Inc."
  price: "yahoo/AAPL"
  logo: "https://logo.clearbit.com/apple.com"
  
2020-01-01 commodity GOOGL
  name: "Alphabet Inc."
  price: "yahoo/GOOGL"
  logo: "https://logo.clearbit.com/google.com"
  
2020-01-01 commodity MSFT
  name: "Microsoft Corporation"
  price: "yahoo/MSFT"
  logo: "https://logo.clearbit.com/microsoft.com"

;; Accounts
2020-01-01 open Assets:Checking USD
2020-01-01 open Assets:Savings USD
2020-01-01 open Assets:Brokerage AAPL,GOOGL,MSFT,USD
2020-01-01 open Liabilities:CreditCard USD
2020-01-01 open Income:Salary USD
2020-01-01 open Income:Dividends USD
2020-01-01 open Income:CapitalGains USD
2020-01-01 open Expenses:Food:Groceries USD
2020-01-01 open Expenses:Food:Dining USD
2020-01-01 open Expenses:Rent USD
2020-01-01 open Expenses:Utilities USD
2020-01-01 open Expenses:Transport USD
2020-01-01 open Expenses:Commissions USD
2020-01-01 open Equity:Opening-Balances USD

;; Price History
2023-01-03 price AAPL 125.07 USD
2023-01-03 price GOOGL 88.37 USD
2023-01-03 price MSFT 239.58 USD

2023-02-01 price AAPL 145.43 USD
2023-02-01 price GOOGL 91.23 USD
2023-02-01 price MSFT 248.90 USD

;; Opening Balances
2023-01-01 * "Opening Balance"
  Assets:Checking           5000.00 USD
  Assets:Savings           10000.00 USD
  Liabilities:CreditCard    -500.00 USD
  Equity:Opening-Balances

;; Transactions
2023-01-03 * "Broker" "Purchase Apple Stock"
  Assets:Brokerage           10 AAPL {125.07 USD}
  Expenses:Commissions        4.95 USD
  Assets:Checking

2023-01-05 * "Landlord" "Monthly Rent"
  Expenses:Rent             1200.00 USD
  Assets:Checking

2023-01-10 * "Grocery Store" "Weekly Groceries"
  Expenses:Food:Groceries    150.00 USD
  Liabilities:CreditCard

2023-01-12 * "Broker" "Purchase Google Stock"
  Assets:Brokerage            5 GOOGL {88.37 USD}
  Expenses:Commissions        4.95 USD
  Assets:Checking

2023-01-15 * "Employer" "Bi-weekly Salary"
  Assets:Checking           3000.00 USD
  Income:Salary

2023-01-18 * "Broker" "Purchase Microsoft Stock"
  Assets:Brokerage            3 MSFT {239.58 USD}
  Expenses:Commissions        4.95 USD
  Assets:Checking

2023-01-20 * "Restaurant" "Dinner with friends"
  Expenses:Food:Dining        85.50 USD
  Liabilities:CreditCard

2023-01-25 * "Utility Co" "Electric Bill"
  Expenses:Utilities         120.00 USD
  Assets:Checking

2023-01-28 * "Gas Station" "Fuel"
  Expenses:Transport          45.00 USD
  Liabilities:CreditCard

2023-01-31 * "Bank" "Interest Payment"
  Assets:Savings              25.00 USD
  Income:Salary  ; Technically Interest Income but keeping it simple

2023-02-01 * "Credit Card Co" "Payment"
  Liabilities:CreditCard     500.00 USD
  Assets:Checking

2023-02-05 * "Landlord" "Monthly Rent"
  Expenses:Rent             1200.00 USD
  Assets:Checking

2023-02-10 * "Grocery Store" "Weekly Groceries"
  Expenses:Food:Groceries    145.00 USD
  Liabilities:CreditCard

2023-02-15 * "Apple Inc" "Quarterly Dividend"
  Assets:Brokerage           2.30 USD
  Income:Dividends

2023-02-20 * "Broker" "Sell Apple Stock - Partial Position"
  Assets:Brokerage           -3 AAPL {125.07 USD} @ 145.43 USD
  Expenses:Commissions        4.95 USD
  Assets:Checking          432.34 USD
  Income:CapitalGains      -61.13 USD
`;

