---
sidebar_position: 3
---

# Keeping Track of Subscriptions

Subscriptions (streaming, software, gym memberships, insurance) are the textbook use case for [Upcoming Transactions](../upcoming-transactions.md) — fixed amount, fixed cadence, easy to forget. This page covers a simple setup for tracking them and reporting on them later.

---

## 1. Pick an account structure

A single `Expenses:Subscriptions` account is enough if you just want a total. If you want to see spending broken down by service or category, nest it, e.g. `Expenses:Subscriptions:Streaming`, `Expenses:Subscriptions:Software`. Either way, open the account(s) once — see [Adding Accounts and Commodities](../adding-data/adding-account-commodity.md).

---

## 2. Add a schedule per subscription

In the [Snapshot sidebar](../snapshot-view.md)'s **Upcoming** tab, click **＋** and fill in the **Add Scheduled Transaction** modal for each subscription:

*   **Frequency**: `Monthly` or `Yearly`, matching the billing cycle.
*   **Start Date**: the next billing date.
*   **Payee**: the service name (e.g. `Netflix`).
*   **Postings**: the card/account it's billed to, and the expense account — since the amount is normally fixed, fill both in directly rather than leaving one to auto-balance.

Repeat for each subscription. See [Upcoming Transactions](../upcoming-transactions.md) for the full reference on frequencies and how the modal works.

**Tip:** add a tag like `#subscription` in the transaction (the schedule carries it into every generated occurrence) so you can filter for it later regardless of which expense account it landed in.

---

## 3. Process dues as they come up

Whenever you're catching up on bookkeeping, click **Process dues** in the Upcoming tab. For each subscription that's come due, choose **Insert** (record it as-is), **Skip** (dismiss without recording — e.g. a free trial month), or **Hold** (deal with it later). See [Processing Due Occurrences](../upcoming-transactions.md#processing-due-occurrences) for the full behavior, including what happens if you've fallen behind by more than one cycle.

---

## 4. When a price changes

Don't delete and recreate the schedule — hover the row and click **✏️ Edit** to update the amount, then future occurrences use the new figure. This keeps the schedule's history and next-due-date tracking intact.

---

## 5. When you cancel

**Hold** or **Skip** any occurrence that's still pending for the cancelled service, then click **❌ Delete** on the schedule row so it stops appearing. Past transactions it already generated stay in your ledger untouched.

---

## 6. Reporting on total subscription spend

If you tagged your subscriptions in step 2, a single query gives you the total, or a breakdown by service:

```sql
SELECT payee, sum(position) WHERE 'subscription' IN tags GROUP BY payee ORDER BY sum(position) DESC
```

You can drop this in a `bql` code block in any note — see [BQL Queries](../queries/bql.md) — or build it as a [Budget](../dashboards/overview.md#budgets) against `Expenses:Subscriptions` if you want an at-a-glance progress bar on the Overview tab instead.
