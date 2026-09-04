---
sidebar_position: 7
---

# Upcoming Transactions

The **Upcoming** tab — toggled against **Key Metrics** at the top of the [Snapshot sidebar](./snapshot-view.md) — lets you define transactions that repeat automatically or fire once in the future, and process the ones that have come due, without leaving the sidebar.

---

## How It Works

Each schedule is stored as an `event "Recurring"` directive in your `events.beancount` file — plain text, just like everything else in your ledger. Nothing is ever added to your ledger automatically: a schedule only produces a real transaction when you explicitly confirm it via the process-dues flow below.

---

## Adding a Schedule

Click the **＋** button in the Upcoming tab to open the **Add Scheduled Transaction** modal:

*   **Frequency** — `One-time`, `Weekly`, `Monthly`, `Quarterly`, or `Yearly`.
*   **Start Date** — the first (or only, for `One-time`) occurrence.
*   **Payee / Narration** — optional, same as a regular transaction.
*   **Postings** — add as many as you need. Leave one posting's amount blank to have Beancount auto-balance it, exactly like a manually-entered transaction.
*   **Tags & Links** — optional, same as a regular transaction. Carried into every occurrence the schedule generates, so it's a convenient way to tag a whole recurring series (e.g. `#subscription`) for later BQL reporting.

Each row in the list shows the schedule's name, amount, frequency, and next due date, with an orange indicator when something is due.

---

## Processing Due Occurrences

Click **Process dues** to check for due occurrences. If a schedule has fallen behind by more than one cycle, **every** missed occurrence is surfaced at once — not just the next one — grouped under that schedule in a confirmation dialog. For each occurrence you choose one of:

*   ✅ **Insert** — materialize it into the ledger and advance to the next occurrence.
*   ⏭ **Skip** — dismiss this occurrence without adding it, and still advance past it.
*   ⏸ **Hold** — do nothing; it stays due and you'll be asked again next time you process dues.

> **Note:** `nextDate` advances as a single cursor, so a Hold on an earlier occurrence blocks later occurrences of the *same* schedule from being resolved in that batch — they're simply re-offered next time instead of being processed out of order.

Every transaction created this way is tagged with `scheduled: "<name>"` metadata, linking it back to the schedule that produced it. This also gives the plugin a way to detect and skip an accidental duplicate insert (e.g. if the confirmation dialog is submitted twice).

---

## Editing & Deleting

Hover a schedule row to reveal ✏️ (edit) and ❌ (delete) icons. Editing reopens the same form pre-filled with the schedule's current details; deleting removes the `event` directive from `events.beancount` after a confirmation prompt.

---

## 💡 Usage Tips

*   **Bill tracking** — Set up recurring rent, subscriptions, and insurance payments once, then just click **Process dues** whenever you're catching up on bookkeeping.
*   **One-time reminders** — A `One-time` schedule works well for a single future transaction you don't want to forget (e.g. a large purchase or a tax payment), without cluttering your ledger with a future-dated entry ahead of time.
*   If a schedule has fallen behind by several cycles, resolve the oldest occurrences first — remember a **Hold** on an earlier one blocks later ones in the same batch.
