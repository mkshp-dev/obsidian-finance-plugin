---
sidebar_position: 3
---

# Snapshot View

The **Snapshot View** is a persistent sidebar widget that gives you at-a-glance financial awareness while you work in your notes.

## 👁 Features

### File Status Indicator
The status button at the top shows the health of your Beancount file:
- **✅ OK** — File is valid, no errors detected
- **❌ N Errors** — Click to see a notification with the full error message
- **Checking…** — Validation is in progress

### Key Metrics
Displays three high-level financial indicators pulled directly from your ledger:
- **Net Worth** — Total position across all Assets and Liabilities accounts, converted to your Operating Currency
- **Assets** — Total value of all Assets accounts in your Operating Currency
- **Liabilities** — Total value of all Liabilities accounts. Positive numbers represent outstanding debt; negative numbers indicate a credit or overpayment

All three values are rounded to 2 decimal places and shown in your configured Operating Currency.

> **Note:** Commodities without price data are excluded from the totals. If you hold stocks or crypto without price directives, only the cash portion will be reflected.

### Refresh Button
Reloads all three KPI values and re-validates the Beancount file on demand.

---

## 🔍 Underlying Queries

The Snapshot View uses three typed BQL queries (using your configured Operating Currency, e.g. `USD`):

**Assets:**
```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2)
WHERE account ~ '^Assets'
```

**Liabilities** (sign-flipped so positive = debt):
```sql
SELECT neg(round(number(only('USD', convert(sum(position), 'USD'))), 2))
WHERE account ~ '^Liabilities'
```

**Net Worth** (Assets + Liabilities combined):
```sql
SELECT round(number(only('USD', convert(sum(position), 'USD'))), 2)
WHERE account ~ '^(Assets|Liabilities)'
```

The `only()` function returns `null` if the position cannot be fully converted to a single currency (e.g., missing price data for a commodity). This is why unconverted commodities are excluded rather than causing an error.

---

## 💡 Usage Tips

### When to Use
- **Daily note-taking** — Keep it open while journaling to quickly reference balances
- **Quick checks** — Glance at net worth without opening the full dashboard
- **Context switching** — Maintain financial awareness while working on other tasks

### Placement
Access the Snapshot View via:
- **Command Palette**: `Ctrl/Cmd + P` → "Open Beancount Snapshot"
- **Right Sidebar**: Drag and position the view anywhere in Obsidian's layout
