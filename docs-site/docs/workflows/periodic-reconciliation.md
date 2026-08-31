---
sidebar_position: 4
---

# Periodic Reconciliation

Reconciliation is the habit that keeps your ledger trustworthy — regularly checking that what Beancount thinks an account holds matches what your bank (or wallet, or brokerage) actually says. This page is the practical, "do this every month" version; for the full mechanics of the feature, see [Reconciliation](../reconciliation.md).

---

## 1. Set an interval per account, once

When you [open an account](../adding-data/adding-account-commodity.md) (or any time after, via **Edit**), set a **reconciliation interval** that matches how often you realistically check it:

*   Checking/credit card accounts you actively use: **7–14 days**
*   Savings, brokerage, less-active accounts: **30 days**
*   Cash or accounts you rarely touch: leave it unset, or a long interval — no point being nagged about something that never moves

This is what powers the overdue/up-to-date tracking in the Snapshot sidebar.

---

## 2. Make it a recurring ritual

Pick a cadence — monthly, right before you'd consider "closing the books" for the month, works well for most people. When that time comes:

1. Open the [Snapshot sidebar](../snapshot-view.md) → **Reconciliation** tab.
2. Toggle **Only overdue** so the list is just what needs attention.
3. Work through the list top to bottom.

---

## 3. For each overdue account

1. Pull up the real-world balance (your bank's app or statement).
2. Click **Balance** on that row — it opens **+ → Balance tab** pre-filled with the account. Enter the real balance and save.
3. If it passes, you're done with that account. If it shows **Failing**, something in your ledger doesn't match reality — time to investigate.

---

## 4. When an assertion fails

Click the account name (plain click → **Transactions** tab, `Ctrl`/`Cmd`+click → **Journal** tab), both filtered to that account since your last successful reconciliation — see [Inter-Tab Navigation](../advanced/inter-tab-navigation.md). Look for the obvious culprits first: a transaction you forgot to enter, a duplicate, or a typo'd amount.

Only reach for **Force reconcile** once you're confident the gap is genuine and unrecoverable (e.g. an old, untracked transaction you can't fully reconstruct) — it plugs the gap with a `pad` directive rather than explaining it. See [Reconciliation → Actions](../reconciliation.md#actions) for the full warning on when this is and isn't appropriate.

---

## 5. Why bother

Every dashboard number — Net Worth, the Income Statement, budget progress — is only as accurate as your ledger. A monthly reconciliation habit is what turns "probably right" into "verifiably right," and it catches data-entry mistakes while they're still easy to remember and fix, instead of six months later when you're trying to figure out why last January's numbers look wrong.
