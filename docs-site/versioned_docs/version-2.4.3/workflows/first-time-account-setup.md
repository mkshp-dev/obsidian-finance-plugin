---
sidebar_position: 1
---

# Set Up Your Accounts for the First Time

This walks through going from a blank ledger (or the onboarding demo data) to a chart of accounts that actually reflects your finances, with correct opening balances.

If you haven't run the onboarding wizard yet, do that first — see [First-Time Setup](../getting-started/first-time-setup.md). This page picks up right after.

---

## 1. Set your Operating Currency

Before opening accounts, set your primary currency in **Settings → General → Operating Currency**. Every balance calculation and Net Worth figure is reported in this currency, so it's easiest to get it right up front. See [Settings](../settings.md).

---

## 2. Plan your account tree

Beancount requires every account you post to be explicitly opened first — including `Income` and `Expenses` categories, not just `Assets` and `Liabilities`. It's worth sketching the tree before you start clicking:

*   **Assets**: one per real account — `Assets:Checking`, `Assets:Savings`, `Assets:Brokerage`, `Assets:Cash`
*   **Liabilities**: `Liabilities:CreditCard`, `Liabilities:Loans:Car`, etc.
*   **Income**: broad categories are usually enough — `Income:Salary`, `Income:Interest`, `Income:Dividends`
*   **Expenses**: this is the one worth planning — a 2-level tree like `Expenses:Food:Groceries`, `Expenses:Food:Restaurants`, `Expenses:Housing:Rent` gives you useful reporting without becoming unmanageable

You don't have to get this perfect — you can always open more accounts later.

---

## 3. Open your accounts

For **Assets and Liabilities**, use the UI: go to the **Accounts & Balances** tab and click **➕ Open Account** in the header for each one. Fill in the account name, opening date, and (optionally) which currencies it can hold. If it's an account you'll want to check regularly (a checking or credit card account), set a **Reconciliation interval** here too — see [Periodic Reconciliation](./periodic-reconciliation.md) for why that matters. See [Adding Accounts and Commodities](../adding-data/adding-account-commodity.md) for the full reference.

For a handful of **Income/Expenses categories**, the same modal works fine. If you're opening many at once (a whole expense tree), it's faster to open `accounts.beancount` directly in the editor — see [Editing the .beancount Files](../adding-data/editing-files.md) — and type `open` at the start of a line to expand the built-in snippet template for each one.

---

## 4. Record opening balances

Opening an account with `open` doesn't give it a balance — it starts at zero. To reflect your real-world starting point, Beancount's convention is an `Equity:Opening-Balances` account that absorbs the difference. You have two ways to do this, both ending at the same place:

### Recommended: let the plugin do it for you
1. Open `Equity:Opening-Balances` like any other account (step 3 above).
2. For each account, use **+ → Balance tab** to record a `balance` assertion for today with the real-world amount from your bank/statement. See [Using the + Button](../adding-data/using-plus-button.md#2-balance-tab). Since the account is still at zero, this assertion will *fail* — that's expected.
3. Open the **Snapshot sidebar → Reconciliation** tab. The account will show up as **Failing**. Click **Force reconcile**, and pick `Equity:Opening-Balances` as the account that absorbs the difference. See [Reconciliation](../reconciliation.md#actions) for details on what this does under the hood (it's a Beancount `pad` directive).

### Manual alternative
If you'd rather write it directly: open the file and type `pad` at the start of a line to expand the built-in snippet (`pad Assets:Checking Equity:Opening-Balances`), then on the next line type `bal` to expand a `balance` assertion with the real amount. This is exactly what Force Reconcile does for you automatically.

---

## 5. Verify

Open the **Accounts & Balances** tab and confirm each account now shows the balance you expect. Check the [Snapshot sidebar](../snapshot-view.md) status indicator shows ✅ — if it shows errors, click them to jump straight to the problem line.

From here, you're ready for day-to-day use — see [Adding Financial Data](../adding-data/using-plus-button.md) for recording new transactions, and [Periodic Reconciliation](./periodic-reconciliation.md) for keeping things accurate going forward.
