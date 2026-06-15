---
sidebar_position: 3
---

# Adding Accounts and Commodities

To keep your ledger organized, you must explicitly declare the accounts and commodities (currencies, stocks, crypto) that you use in your transactions.

---

## 🏦 Managing Accounts

Beancount requires you to open an account before you can post transactions to it. If you try to write a transaction using an undeclared account, Beancount will raise an error.

### Account Types
Beancount supports five root account types:
*   `Assets`: Money you own (e.g. `Assets:Checking`, `Assets:Brokerage`).
*   `Liabilities`: Money you owe (e.g. `Liabilities:CreditCard`, `Liabilities:CarLoan`).
*   `Equity`: Represents net worth initialization (e.g. `Equity:OpeningBalances`).
*   `Income`: Revenue sources (e.g. `Income:Salary`, `Income:Interest`).
*   `Expenses`: Outflows (e.g. `Expenses:Food:Groceries`, `Expenses:Housing:Rent`).

### Open and Close Directives
To declare an account, use the `open` directive with a date. You can also specify the currencies the account is allowed to hold:

```beancount
2020-01-01 open Assets:Checking USD, EUR
```

To close an account (preventing future transactions on it), use the `close` directive:

```2026-05-30 close Assets:Checking```

---

### Managing Accounts via UI

You don't have to write these directives manually. You can manage accounts directly from the dashboard:

1.  Open the **Unified Dashboard** and navigate to the **Accounts & Balances** tab.
2.  In the top right header controls, click:
    *   **➕ Open Account**: Launches a modal where you enter the new account name (with autocomplete prefixes), select the opening date, and list allowed currencies.
    *   **❌ Close Account**: Launches a modal where you select an active account and the closing date.
3.  The plugin appends the appropriate directive to `accounts.beancount` in your structured layout folder.
4.  The dashboard refreshes automatically, updating your account lists.

---

## 🪙 Declaring Commodities

A **commodity** is any unit of currency or asset tracked in your ledger (e.g., USD, EUR, AAPL, BTC). While Beancount can use currencies without explicit declaration, declaring them allows you to attach useful metadata.

### Commodity Syntax
Declare a commodity with the `commodity` directive:

```beancount
2020-01-01 commodity AAPL
```

### Metadata Annotations
Our plugin recognizes specific metadata key-value pairs indented under the commodity directive to customize the dashboard display:

*   `name`: The full display name of the commodity (e.g., `"Apple Inc."`).
*   `logo`: A URL to an icon/image of the commodity (displays as an avatar in the Commodities tab).
*   `price`: The automated price source for the commodity (see [Adding Price Metadata](./adding-price-metadata.md)).

#### Example:
```beancount
2020-01-01 commodity BTC
  name: "Bitcoin"
  logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.png"
  price: "USD:coinbase/BTC-USD"
```

---

### Declaring Commodities via UI

You can configure and declare commodities directly from the dashboard:

1.  Open the **Unified Dashboard** and navigate to the **Commodities** tab.
2.  Click the **➕ Add Commodity** button in the header (or click on an existing commodity's row to edit it).
3.  Fill in the fields:
    *   **Symbol**: The ticker/currency symbol (e.g., `AAPL`, `EUR`).
    *   **Display Name**: Human-readable name (e.g. `Apple Inc.`).
    *   **Logo URL**: Image link for the icon.
    *   **Quote Currency**: The currency this commodity's price is measured in (e.g. `USD`).
4.  The plugin writes the commodity directive and formatted metadata keys to `commodities.beancount` in your structured layout.
