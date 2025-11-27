---
sidebar_position: 3
---

# BQL Queries

The plugin brings the power of **Beancount Query Language (BQL)** directly into Obsidian. You can execute SQL-like queries against your financial data and display the results in your notes.

The plugin supports two distinct modes for different use cases:
1.  **Code Blocks**: For detailed analysis and tables.
2.  **Inline Queries**: For embedding live values into your text.

## 📊 BQL Code Blocks

Use standard Markdown code blocks with the `bql` language identifier to create formatted tables.

### Basic Usage

```markdown
```bql
SELECT account, sum(position)
WHERE account ~ '^Expenses'
GROUP BY account
ORDER BY account
```
```

### Features
- **Interactive Results**: Sortable columns and responsive layout.
- **Refresh (⟳)**: Re-run the query to get the latest data.
- **Copy (📋)**: Copy the raw CSV results to your clipboard.
- **Export (📤)**: Download results as a CSV file.
- **Toggle View**: Hide the query code to show only the results table.

### Examples

**List All Accounts:**
```sql
SELECT account GROUP BY account ORDER BY account
```

**Recent Transactions:**
```sql
SELECT date, payee, narration, account, position ORDER BY date DESC LIMIT 20
```

**Monthly Expenses:**
```sql
SELECT year, month, sum(position)
WHERE account ~ '^Expenses'
GROUP BY year, month
ORDER BY year DESC, month DESC
```

---

## 💰 Inline BQL Queries

Embed live financial values directly in your text using single backticks. This is perfect for daily journaling ("Spent $X today") or financial summaries ("Net worth is $Y").

### Direct Queries

You can write a full BQL query inside the backticks starting with `bql:`:

```markdown
My current net worth is `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`

Today I have `bql:SELECT convert(sum(position), 'USD') WHERE account ~ 'Checking'` in my checking account.
```

### Template Shorthand System

For frequently used queries, you can define **Shortcuts** in a template file and use them with `bql-sh:`.

#### 1. Create a Template File
Create a markdown file (e.g., `BQL-Templates.md`) anywhere in your vault.

#### 2. Define Shortcuts
Use the following format to define shortcuts:

```markdown
## WORTH: Total net worth in USD
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'
```

## CHECKING: Checking account balance
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'
```
```

#### 3. Configure the Plugin
Go to **Settings → Finance Plugin → BQL Shortcuts Template Path** and enter the path to your template file (e.g., `BQL-Templates.md`).

#### 4. Use Shortcuts in Notes
Now you can use the shorthand syntax:

```markdown
My total worth: `bql-sh:WORTH`
Checking balance: `bql-sh:CHECKING`
```

### Benefits of Inline Queries
- **Live Data**: Always shows current data from your ledger.
- **Contextual**: Integrating numbers into your narrative makes them more meaningful.
- **Reusable**: The template system keeps your queries organized and consistent.

---

## ⚙️ Configuration

You can customize how BQL queries are displayed in **Settings → Finance Plugin → BQL Code Blocks**:

- **Default Page Size**: Number of rows to show per page in tables.
- **Show Query by Default**: Whether to show the SQL code above the table.
- **Currency Display**: How currencies should be formatted.

## 📝 Tips

- **Filtering**: Use `WHERE` clauses effectively to scope your queries (e.g., `WHERE year = 2024`).
- **Grouping**: Use `GROUP BY` to aggregate data (e.g., `GROUP BY account`).
- **Functions**: BQL supports functions like `YEAR()`, `MONTH()`, `TODAY()`, and `convert()`.
- **Regex**: Use `~` for regular expression matching on accounts or payees.
