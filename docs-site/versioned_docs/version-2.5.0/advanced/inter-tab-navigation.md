---
sidebar_position: 4
---

# Inter-Tab Navigation

Most numbers, account names, tags, and date ranges shown across the dashboard — and in the [Snapshot sidebar](../snapshot-view.md) — are clickable. Instead of re-typing filters by hand, click a value to jump straight to a pre-filtered view of the underlying entries.

---

## 🖱️ The Core Rule

Across almost every clickable in the dashboard, the same pattern applies:

* **Click** → opens the **Transactions** tab, pre-filtered to whatever you clicked (an account, a tag, a date range, a payee...).
* **Ctrl/Cmd+Click** → opens the **Journal** tab instead, with the same filters applied.

Use Transactions when you want the flat, sortable table view. Use Journal (via Ctrl/Cmd+click) when you want to see the full entry — narration, tags, notes, and every posting — in context.

> Hover any clickable value in the dashboard and you'll typically see a tooltip confirming both destinations, e.g. *"Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal"*.

---

## 🔗 Where It Works

| Location | Clickable | Filters applied |
|---|---|---|
| Journal Tab | Posting account name, `#tag` chip (on transaction cards) | Account or tag |
| Journal Tab | Balance card account name | Account |
| Overview Tab | Total Balance / Income / Expenses / Savings Rate KPI cards | Account type (if applicable) + current period |
| Overview Tab | Budget/Target card `→ View` button and account chip | Account + the **current cycle's** date range (e.g. this month, for a monthly budget) |
| Income Statement | Trend chart column (month/week bar) | That date range |
| Income Statement | Leaf account row in the Income/Expenses table | Account |
| Balance Sheet | Leaf account row in the Assets/Liabilities/Equity tables | Account |
| Snapshot sidebar → Reconciliation | Account row | Account + date range starting from that account's last successful `balance` directive |

---

## ⚠️ Where the Pattern Is Different

A few clickables intentionally don't follow the plain rule above:

### Category header rows (Balance Sheet & Income Statement tables)
Clicking a **category** row (e.g. "Assets", "Expenses") toggles collapse/expand — it does not navigate. `Ctrl`/`Cmd`+click on a category header **jumps straight to Transactions** for that whole account subtree, skipping the Journal option. This keeps the collapse gesture unambiguous: plain click always means "fold this section," never "leave the page."

### Sunburst charts (Balance Sheet & Income Statement)
Plain click drills into the clicked segment's sub-accounts, the same as before this feature existed. `Ctrl`/`Cmd`+click jumps to the Transactions tab for that segment's account — there's no Journal route here, since the plain click is already spoken for by drilling.

### Payee cross-links
Two single-purpose, one-way links exist independently of the rule above:
* **Journal card payee name** → always opens Transactions, filtered by that payee.
* **Transactions table payee cell** → click filters the Transactions table itself by that payee (in place); `Ctrl`/`Cmd`+click jumps to the Journal tab filtered by the same payee.

### Snapshot sidebar → Errors
Each validation error is clickable, but it doesn't navigate the dashboard at all — it opens the error's source file directly in the editor and jumps to the exact line. See [Snapshot View](../snapshot-view.md) for details.

---

## 💡 Tips

* If a click seems to do nothing, check whether you're on a category header row or a Sunburst arc with children — plain click there drills/collapses by design; hold `Ctrl`/`Cmd` to navigate instead.
* Navigating to a tab that's already open updates its filters in place — no need to switch away and back.
* If the dashboard isn't open yet, navigating from the Snapshot sidebar's Reconciliation tab will open it for you.
