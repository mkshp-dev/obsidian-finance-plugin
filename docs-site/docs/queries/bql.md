---
sidebar_position: 1
---

# BQL Queries

The plugin brings the full power of **Beancount Query Language (BQL)** directly into Obsidian. You can execute SQL-like queries against your financial data and display the results in your notes.

The plugin supports two distinct modes:
1.  **Code Blocks**: For detailed analysis and tables.
2.  **Inline Queries**: For embedding live values into your text.

## 📊 BQL Code Blocks

Use standard Markdown code blocks with the `bql` language identifier to create formatted, interactive tables.

:::warning Important
**Single-Line Queries Only**: BQL queries must be written on a single line. Multi-line queries will only execute the first line and ignore subsequent lines.
:::

### Basic Usage

    ````
    ```bql
    SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account
    ```
    ````

### Features
- **Interactive Results**: Sortable columns and responsive layout.
- **Tools**:
    - **Refresh (⟳)**: Re-run the query to get the latest data.
    - **Copy (📋)**: Copy the raw CSV results to your clipboard.
    - **Export (📤)**: Download results as a CSV file.
- **Toggle View**: Hide the query code to show only the results table (configurable in Settings).

### Common Examples

**List All Accounts:**
```sql
SELECT account GROUP BY account ORDER BY account
```

**Recent Transactions:**
```sql
SELECT date, payee, narration, position ORDER BY date DESC LIMIT 20
```

**Monthly Expenses:**
```sql
SELECT year, month, sum(position) WHERE account ~ '^Expenses' GROUP BY year, month ORDER BY year DESC, month DESC
```

---

## 💰 Inline BQL Queries

Embed live financial values directly in your sentences using single backticks. This is perfect for daily journaling (e.g., *"My checking balance is currently..."*).

### Direct Queries

Write a full BQL query inside backticks starting with `bql:`:

> My net worth is `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`

### Shorthand Templates

For complex or frequently used queries, use the **Shorthand System**.

#### 1. Setup Template
Create a note (e.g., `BQL_Shortcuts.md`) and define queries like this:
    ````
    ## WORTH: Net Worth
    ```bql-shorthand
    SELECT convert(sum(position), 'USD') WHERE account ~ '^(Assets|Liabilities)'
    ```
    ````
#### 2. Configure
Go to **Settings** and point "Shortcuts template file" to `BQL_Shortcuts.md`.

#### 3. Use
Now you can simply write:

> My net worth is `bql-sh:WORTH`
