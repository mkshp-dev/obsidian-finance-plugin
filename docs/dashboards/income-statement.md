---
sidebar_position: 5
---

# Income Statement Tab

![Income Statement](/img/Income.png)

The **Income Statement Tab** (also known as a Profit and Loss statement) summarizes your revenues and expenses over the lifetime of your ledger, showing your net profit or loss.

---

## 📈 Income vs. Expenses

![Net Income Trend](/img/IncomeTab-NetIncomeTrend.png)
![Expenses Pie Chart](/img/IncomeTab-ExpensesPieChart.png)

The statement is divided into two primary sections:

*   **Income**: Revenue inflows (e.g., `Income:Salary`, `Income:Dividends`). In Beancount, inflows are represented as negative numbers internally. The dashboard flips the sign for display so that income appears as a positive value.
*   **Expenses**: Operational outflows (e.g., `Expenses:Food`, `Expenses:Rent`). Expenses are positive values.

### Net Profit Calculation
At the bottom of the statement, the **Net Profit** (or Net Loss) is computed:
```
Net Profit = Total Income - Total Expenses
```
If your income exceeds your expenses, you have a net profit (displayed in green). If expenses exceed income, it is a net loss (displayed in red).

---

## 🏛 Valuation Methods

Like the Balance Sheet, you can view the Income Statement through three valuation lenses:

1.  **Market Value**: Converts all flows to your Operating Currency using the latest market prices.
2.  **At Cost**: Evaluates flows using the cost basis at the time of transaction.
3.  **Units**: Displays raw counts (e.g. `1200 USD`, `150 EUR`) without conversion.


