---
sidebar_position: 5
---

# Snapshot View

The **Snapshot View** is a persistent sidebar widget that gives you at-a-glance financial awareness while you work in your notes.

![Snapshot View](/img/Snapshot.png)

---

## 👁 Features

### File Status Indicator
The status button at the top shows the health of your Beancount file:
*   **✅ OK** — File is valid, no errors detected.
*   **❌ N Errors** — Click to see a notification with the full error message list.
*   **Checking…** — Validation is currently in progress.

### Key Metrics
Displays three high-level financial indicators pulled directly from your ledger:
*   **Net Worth** — Total position across all Assets and Liabilities accounts, converted to your Operating Currency.
*   **Assets** — Total value of all Assets accounts in your Operating Currency.
*   **Liabilities** — Total value of all Liabilities accounts. Positive numbers represent outstanding debt; negative numbers indicate a credit or overpayment.

All three values are rounded to 2 decimal places and shown in your configured Operating Currency.

> **Note:** Commodities without price data are excluded from the totals. If you hold stocks or crypto without price directives, only the cash portion will be reflected.

### Refresh Button
Reloads all three KPI values and re-validates the Beancount file on demand.



## 💡 Usage Tips

### When to Use
*   **Daily note-taking** — Keep it open in the sidebar while journaling to quickly reference balances.
*   **Quick checks** — Glance at net worth without opening the full dashboard.
*   **Context switching** — Maintain financial awareness while working on other tasks.

### Placement
Access the Snapshot View via:
*   **Command Palette**: `Ctrl/Cmd + P` → "Open Beancount Snapshot".
*   **Right Sidebar**: Drag and position the view anywhere in Obsidian's layout.
