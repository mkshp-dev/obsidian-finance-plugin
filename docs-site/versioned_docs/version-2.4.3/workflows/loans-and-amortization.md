---
sidebar_position: 2
---

# Loans and Amortization

Beancount (and this plugin) doesn't calculate amortization schedules for you — there's no built-in mortgage/loan calculator. What it's good at is recording the principal/interest split of each payment accurately, once you know what that split is, and keeping the running balance verifiably correct via reconciliation. This page covers that workflow.

Get the actual amortization schedule (the principal/interest split for each payment) from your lender's statement, loan documents, or an external amortization calculator/spreadsheet — that's your source of truth. The plugin's job is bookkeeping, not calculating it.

---

## 1. Open the loan account

Open a `Liabilities` account for the loan, e.g. `Liabilities:Loans:Car` or `Liabilities:Loans:Mortgage`. See [Adding Accounts and Commodities](../adding-data/adding-account-commodity.md).

---

## 2. Record the disbursement

When you take out the loan, record the money arriving and the liability being created in one transaction. For example, buying a car partly financed by a loan:

```beancount
2026-01-15 * "Car dealership" "Financed vehicle purchase"
  Assets:Vehicles:Car          25000.00 USD
  Liabilities:Loans:Car       -22000.00 USD
  Assets:Checking              -3000.00 USD
```

Use **+ → Transaction tab** to enter this — see [Using the + Button](../adding-data/using-plus-button.md).

---

## 3. Record each payment, split by principal and interest

Every payment reduces the liability (principal) *and* records an expense (interest). A useful trick: fill in the two amounts you know for certain — the total payment leaving your checking account, and the interest amount from your statement — and **leave the liability posting's amount blank**. The plugin's auto-balance feature (see [Postings](../adding-data/using-plus-button.md#1-transaction-tab)) computes the exact principal portion for you:

```beancount
2026-02-01 * "Car loan payment"
  Assets:Checking              -450.00 USD
  Expenses:Interest:CarLoan     180.00 USD
  Liabilities:Loans:Car
```

This is more reliable than typing the principal figure by hand, since it can't drift from a rounding mistake.

---

## 4. Set up a reminder (with a caveat)

You can add this as a recurring schedule in the [Upcoming Transactions](../upcoming-transactions.md) tab (Monthly frequency) so you're reminded when a payment is due. **Caveat:** most loans have a slightly different interest/principal split every period as the balance amortizes, so treat the scheduled postings as a starting template — before you click **Insert**, edit the amount to match that period's actual interest figure from your statement, and leave the liability posting blank as above so it auto-balances correctly.

For an interest rate that never changes and a fixed payment, the drift period-to-period is usually small enough that reviewing before each insert takes seconds.

---

## 5. Reconcile against the lender's statement

Periodically (monthly is typical), compare your ledger's `Liabilities:Loans:Car` balance against the payoff balance shown on your statement, and set a reconciliation interval on the account so the plugin reminds you to do this. See [Periodic Reconciliation](./periodic-reconciliation.md). If they drift apart, it usually means a payment was recorded with the wrong split, or a fee/escrow adjustment wasn't captured.

---

## 6. Reporting

Tag loan-related transactions (e.g. `#carloan`) if you want to pull total interest paid over the life of the loan later:

```sql
SELECT sum(position) WHERE account ~ '^Expenses:Interest:CarLoan'
```

See [Advanced Queries](../advanced/advanced-queries.md) for more recipes like this.

---

## 7. Paying it off

When the final payment brings the balance to exactly zero, you can close the account with a `close` directive (see [Adding Accounts and Commodities](../adding-data/adding-account-commodity.md)) to keep it out of your active account list while preserving its history.
