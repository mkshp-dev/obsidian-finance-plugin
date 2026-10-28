---
sidebar_position: 6
---

# Account Aliases

An **alias** is a word or phrase from your bank statements that points to an account in your ledger, like `Uber` for `Expenses:Transport` or `CRED Club` for `Liabilities:CreditCard`. When you [import a statement](./importing-statements.md), `ACCOUNT WHERE` and `ALIAS WHERE` formulas look for these aliases in each row's text to choose its account.

---

## 📝 How Aliases Are Stored

Aliases are plain Beancount metadata on the account's `open` directive, separated by `|`:

```beancount
2020-01-01 open Expenses:Transport
  aliases: "Uber|Ola|Metro card"

2020-01-01 open Liabilities:CreditCard
  aliases: "CRED Club"
```

Matching ignores case and extra spaces. With `CONTAINS ALIAS`, an alias matches as whole words anywhere in the text, so `cred` matches `UPI/CRED/…` but not `CREDIT INTEREST`; when several aliases match, the longest wins. Only open accounts are used.

You can edit the `aliases:` line by hand, or use the window below.

---

## 🗂️ Managing Aliases

Run **"Beancount Ledger: Manage account aliases"** from the Command Palette (`Ctrl/Cmd + P`), or click **Manage aliases** on the **Aliases** tab of the importer's mapping page.

The **Account aliases** window lists every open account with its aliases:

*   **Search** finds accounts by name or alias; **Only accounts with aliases** hides the rest.
*   **Add** an alias by typing it in the account's **+ alias** box and pressing `Enter`.
*   **Remove** an alias with the **×** on its chip.
*   An alias can belong to only one account. Adding one that another account already has is refused; remove it there first.

Changes stay in the window until you click **Save**: changed accounts are marked on the left, and new aliases are outlined. **Save** writes every changed account's `aliases:` line at once (backing up the files first, if backups are on). An account's line is added after its other metadata, updated in place, or removed when its last alias goes; everything else in the file stays as written. Closing the window with unsaved changes asks before discarding them.

When you open this window from the importer, the importer picks up your saved aliases as soon as you close it, so the mapping page's preview updates straight away.
