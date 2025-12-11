// src/services/demo-ledger.ts

export const DEMO_LEDGER_CONTENT = `;; Beancount Demo Ledger
;; Created by Obsidian Finance Plugin

option "title" "Personal Finance Demo"
option "operating_currency" "USD"

;; Accounts
2020-01-01 open Assets:Checking USD
2020-01-01 open Assets:Savings USD
2020-01-01 open Liabilities:CreditCard USD
2020-01-01 open Income:Salary USD
2020-01-01 open Expenses:Food:Groceries USD
2020-01-01 open Expenses:Food:Dining USD
2020-01-01 open Expenses:Rent USD
2020-01-01 open Expenses:Utilities USD
2020-01-01 open Expenses:Transport USD
2020-01-01 open Equity:Opening-Balances USD

;; Opening Balances
2023-01-01 * "Opening Balance"
  Assets:Checking           5000.00 USD
  Assets:Savings           10000.00 USD
  Liabilities:CreditCard    -500.00 USD
  Equity:Opening-Balances

;; Transactions
2023-01-05 * "Landlord" "Monthly Rent"
  Expenses:Rent             1200.00 USD
  Assets:Checking

2023-01-10 * "Grocery Store" "Weekly Groceries"
  Expenses:Food:Groceries    150.00 USD
  Liabilities:CreditCard

2023-01-15 * "Employer" "Bi-weekly Salary"
  Assets:Checking           3000.00 USD
  Income:Salary

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
`;
