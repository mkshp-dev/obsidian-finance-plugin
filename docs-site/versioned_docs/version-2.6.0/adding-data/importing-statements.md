---
sidebar_position: 5
---

# Importing CSV Bank Statements (Experimental)

:::warning Experimental
Statement import is experimental: it may change, and its saved mapping profiles may need redoing after an update. Keep backups of your ledger (the plugin's **Create backups** setting is on by default) and check what it adds.
:::

The **Import CSV statement (experimental)** command turns a statement downloaded from your bank or card provider into transactions in your ledger. You describe once how that bank's file is laid out and how its rows become transactions; the plugin saves this as a **mapping profile** and reuses it for that bank's next statement.

---

## 🚀 Opening the Importer

1.  Save the statement as a `.csv` file anywhere inside your vault.
2.  Press `Ctrl/Cmd + P` and run **"Beancount Ledger: Import CSV statement (experimental)"**.

The importer has four pages. The step bar at the top shows where you are, and you can go back at any time without losing what you've set up.

---

## 1. Select a File

*   **Statement file**: Every CSV file in the vault, newest first. UTF-8, UTF-16 and Windows-1252 (common for Excel exports) files are all read correctly.
*   **Separator**: What separates the columns: comma, semicolon (common where `,` is the decimal mark), tab or pipe. It's detected from the file; change it if the next page shows everything in one column.
*   **Mapping profile**: If you've imported from this bank before, choose its profile and the next two pages come back filled in. For a new bank, leave it on **None**; a profile can be saved when you apply the mapping on page 3.

A profile recognises a bank's files by their header row. If the chosen profile was saved for different columns, you're warned that its mapping may not fit.

---

## 2. Identify the Content

Bank exports often have account details above the transactions and totals or notes below them.

### Table rows
The plugin finds the header row and the run of transaction rows under it. The header row is shaded, transactions are highlighted, and everything else is greyed out. If it got it wrong, click a row and choose **Set as header row** or **Set as last row**.

Some banks' files have no header row and start straight with transactions. The plugin notices when it can't find a header; you can also tick **The file has no header row** yourself, and use **Set as first row** if the transactions start lower down. Without a header, name the columns under **Column types** (e.g. `Date`, `Amount`) to use them in formulas as `{{Amount}}`; unnamed ones are `Column 1`, `Column 2`… The names are saved in the profile.

### Column types
For each column, confirm what it holds: **Date** (with the order of day, month and year, in any of the six orders; compact dates like `20260922` are read as year-month-day), **Date & time**, **Number**, **Text**, or **Ignore**. Next to each column you see how many of its values could be read as that type (✓), or how many couldn't, with an example (✗). Also choose how numbers are written: `1,234.56` or `1.234,56`.

Nothing is converted on this page. A date column is passed on exactly as written, and signs are worked out on the next page.

### This statement
*   **Statement account** *(optional)*: The account in your ledger this statement belongs to, e.g. `Assets:Bank:Checking`. It becomes the first posting of every transaction. Leave it empty for files that cover several accounts and choose each row's account with a formula instead.
*   **Balance before / after statement** *(optional)*: Filled in when the file has them (a row labelled like *Opening balance* or *Closing balance as on …*); otherwise type them in or leave them empty. Each becomes a [balance assertion](#-balance-checks).

---

## 3. Define the Mapping

This page looks like the Add Transaction form: date, flag, payee, narration, 📋 metadata, postings, tags and links. Each field is filled in for every row:

*   **Plain text** is used as written for every row, e.g. `INR` or `Expenses:Uncategorized`.
*   **Text starting with `=`** is a formula, worked out for each row, e.g. `={{Description}}`.

Above the form, the insert panel has tabs of buttons that insert into the field you clicked last:

| Tab | What it inserts |
|---|---|
| **Columns** | A column of the file, like `{{Description}}`, or the built-in `{{File name}}`. |
| **Logic** | `IF … THEN … ELSE`, and alias lookups (`ACCOUNT WHERE`, `ALIAS WHERE`). |
| **Text / Number / Date** | Functions, like `SPLIT`, `ROUND` or `FORMAT_DATE`. Hover a button to see what it does. |
| **Aliases** | Shows which accounts have aliases, and a **Manage aliases** button (see [Account Aliases](./account-aliases.md)). |

Next to each field's label, a count like **19/20** shows how many rows got a value from it.

### Required pieces
*   **Date**: It has to be a Beancount date (`2026-09-22`). If your file writes dates another way, use `=FORMAT_DATE({{Date}}, "YYYY-MM-DD")`.
*   **`import-ref`** (in 📋 metadata): How the plugin recognises rows it has already imported. Point it at the bank's reference column if there is one, e.g. `={{Chq /Ref No.}}`. Left empty, or empty for a row, a reference is made up from the row's statement account, date, amount and narration.
*   **Postings**: Posting 1 is the statement's own account. Leave one posting's amount empty and Beancount balances it.

By default, every transaction is linked to the statement it came from with `^{{File name}}`.

### Formulas

| Kind | Examples |
|---|---|
| Columns and text | `={{Description}}`, `="UPI " + {{Ref}}` |
| Arithmetic | `={{Deposit}} - {{Withdrawal}}`, `=-{{Amount}}`, `* /` |
| Conditions | `=IF {{Dr / Cr}} == "DR" THEN -{{Amount}} ELSE {{Amount}}` (chain with `ELSE IF …`) |
| Comparisons | `< > <= >= == !=`, `CONTAINS`, `STARTS WITH`, `ENDS WITH`, `IS EMPTY`, `IS NOT EMPTY`, combined with `AND`, `OR`, `NOT` |
| Text functions | `SPLIT(text, "/", 2)`, `TRIM`, `UPPER`, `LOWER`, `REPLACE(text, "find", "with")`, `FIRST(a, b, …)` (first one that isn't empty) |
| Number functions | `ABS(number)`, `ROUND(number, 2)` |
| Date functions | `FORMAT_DATE(date, "YYYY-MM-DD")`, `YEAR`, `MONTH`, `DAY`, `ADD_DAYS(date, 1)`, `DATE(text, "DD/MM/YYYY")` |

Formulas are checked as you type: a field turns red if it refers to a column that doesn't exist, uses a column set to **Ignore**, or gives the wrong kind of value (e.g. text in an amount).

### Choosing accounts with aliases
If your accounts have [aliases](./account-aliases.md), a formula can pick the account by looking for those aliases in the row's text:

```
=ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"
```

*   `CONTAINS ALIAS` matches an alias anywhere in the text as whole words; the longest matching alias wins. `EQUALS ALIAS` needs the whole text to be the alias.
*   `ELSE` gives the account for rows where no alias matches. The **ACCOUNT WHERE** button inserts `ELSE "Expenses:…"` with the placeholder selected, so you type over it; until you do, those rows aren't valid.
*   `ALIAS WHERE` gives the alias that matched instead of the account, e.g. a tidy payee: `=ALIAS WHERE {{Description}} CONTAINS ALIAS ELSE SPLIT({{Description}}, "/", 2)`.
*   Lookups can be combined with conditions: `=IF {{Description}} STARTS WITH "CHRG" THEN "Expenses:Bank:Fees" ELSE ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"`.

### Preview
The preview shows one transaction at a time; use the ‹ › arrows to step through every row. It also says how many rows are **unresolved** and why (see below). The mapping doesn't have to be perfect: set up the pattern most rows follow, and fix individual rows on the next page.

**Apply mapping** moves on to review. With **Save mapping as** ticked (the default), it also saves the profile under that name; untick it for a one-off file.

---

## 4. Review

The review lists every row with its date, description, amount, account and a **Status**:

| Status | Meaning |
|---|---|
| *(none)* | Ready to add. |
| **unresolved** | Something required is missing; the row can't be added until it's fixed. |
| **imported** | A transaction with the same `import-ref` is already in the ledger. Starts unticked. |
| **possible duplicate** | The ledger already has a posting on the statement account with the same amount and currency within 3 days, e.g. one you entered by hand. Untick it if it's the same transaction. |

The **Needs attention** tab collects unresolved rows and possible duplicates; **Duplicates** collects imported rows and possible duplicates.

### Resolved and unresolved
A transaction is **resolved** when it has:
*   a valid date,
*   at least two postings, each with a valid account name,
*   at least one amount, each amount with a currency (and at most one posting left empty to balance),
*   an `import-ref`.

Unresolved rows start unticked, and their **Add** checkbox is greyed out until they're fixed.

### Editing a row
Click a row to open it. The page shows:
*   at the top, whether it's **Resolved** or **Unresolved** and the **Add to ledger** toggle;
*   the original statement row next to the ledger entry it will become, with what's still missing;
*   below, the full Add Transaction form: date, flag, payee, narration, metadata, every posting (with cost, price, flag, comment and metadata), tags and links.

Changes show up in the ledger entry as you type. Once the row is resolved, tick **Add to ledger**. Use the ‹ › arrows to move through the rows of the current tab, or **← List** to go back.

### 🔢 Balance checks
If you gave balances on page 2:
*   They're offered as **balance assertions** on the statement account: the balance before, dated the first transaction's day, and the balance after, dated the day after the last transaction (Beancount checks a balance at the start of its day). Each has its own toggle.
*   With both balances, you're warned if the transactions don't add up from one to the other, which usually means a missing row or a wrong sign.
*   The balance before is compared with your ledger. A difference means earlier transactions are missing or wrong.

### Importing
**Import N transactions** writes the ticked, resolved transactions to the transactions file for their period (as with the + button), and the balance assertions to `balances.beancount`. Each file is backed up and written once.

---

## 💡 Tips

*   **Bank references**: Prefer the bank's own reference column for `import-ref`. Made-up references depend on the statement account, date, amount and narration, so they change if those do.
*   **Start with aliases**: A few aliases for the payees you see most often save most of the categorising. Add them from page 3's **Aliases** tab without leaving the importer.
*   **Several accounts in one file**: Leave the statement account empty and pick posting 1's account with a formula, e.g. from an account-name column.
