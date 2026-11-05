---
sidebar_position: 6
---

# Reconciliation

The **Reconciliation** tab, in the [Snapshot sidebar](./snapshot-view.md), shows the health of every account you've configured with a reconciliation interval — and lets you act on it directly, without leaving the sidebar.

---

## How It Works

For any account where you have set a `reconcile: <days>` metadata key on its `open` directive, the plugin tracks the date of the most recent *passing* `balance` assertion for that account. If the gap since the last passing assertion exceeds the configured interval — or if the account has never had one — it is flagged as overdue.

This mirrors the real Beancount reconciliation workflow: you check the real-world balance, add a `balance` directive, and if it fails, you go find and fix the missing or wrong transactions until it passes. The plugin's job is to remind you which accounts need that check, and to shortcut the everyday steps of that workflow.

---

## What You See

*   A summary line at the top — **"N overdue · N up to date"** — with an **Only overdue** toggle to filter the list down to just the accounts that need attention.
*   A **per-account list** below, each entry showing:
    *   ✅ **Up to date** — Last reconciled within the configured interval.
    *   ⚠️ **Overdue** — Last reconciliation was more than `<days>` ago, with the overdue duration shown.
    *   ⚠️ **Never reconciled** — No `balance` assertion has ever been recorded for this account.
    *   🔴 **Failing** — The account's most recent `balance` assertion exists but didn't pass, shown with the discrepancy amount.

**Click the account name** to open the dashboard's Transactions tab, filtered to that account and to the date range since its last successful `balance` directive (so you see exactly what's changed since you last reconciled). `Ctrl`/`Cmd`+click opens the Journal tab with the same filters instead. If the account has never been reconciled, the filter is left open-ended. See [Inter-Tab Navigation](./advanced/inter-tab-navigation.md) for the full picture of how these connections work across the plugin.

---

## Actions

Each account row has three buttons:

### Edit
Opens the **Account details** modal: view open/close dates, currencies, and reconciliation status, and change the account's `reconcile` interval (or clear it) without hand-editing the `.beancount` file. Also reachable by right-clicking an account row in the [Accounts & Balances](./dashboards/accounts-balances.md#account-details) tab.

### Balance
Opens the Add Transaction modal directly on its Balance tab with the account pre-filled — the everyday "check the real balance, record it" step of reconciling.

### Force reconcile
Only enabled when the account's most recent balance assertion is actually *failing*. Inserts a Beancount `pad` directive so Beancount auto-generates a transaction covering the difference, making the assertion pass.

> **This is a plug, not a fix.** Use it only when you're confident the gap is genuine — for example, an untracked historical transaction — not as a shortcut past a data-entry mistake you haven't tracked down yet. You'll be asked to pick which account absorbs the difference (commonly an `Equity:Opening-Balances`-style account).

---

## Setting Up Reconciliation Intervals

You can configure the interval for any account in three ways:

1.  **Via the Open Account modal**: When opening a new account from the **Accounts & Balances** tab, fill in the optional **"Reconciliation interval (days)"** field.
2.  **Via Edit** (see [Actions](#actions) above): change or clear the interval on an already-open account at any time.
3.  **Manually in your `.beancount` file**: Add the metadata key directly to the `open` directive:

```beancount
2020-01-01 open Assets:Checking USD
  reconcile: 30
```

This tells the plugin to flag the account if it has not been reconciled within 30 days.

---

## 💡 Usage Tips

*   Use the Reconciliation tab as a checklist to know which accounts need a balance assertion before closing the month.
*   Turn on **Only overdue** when you're doing a monthly reconciliation pass, so cleared accounts don't clutter the list.
*   Reach for **Force reconcile** sparingly — a failing assertion is often telling you about a real missing transaction, and papering over it with a pad directive just defers finding it.
