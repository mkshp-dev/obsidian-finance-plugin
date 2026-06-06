# Beancount Queries and Processing Improvements Report

After reviewing the codebase, particularly `src/queries/index.ts`, the controllers, and `src/utils/formatters.ts`, I have identified several opportunities to significantly improve performance by reducing the number of `bean-query` subprocess calls, and eliminating redundant client-side processing by better leveraging BQL functions.

Here is a summary of the recommended improvements:

## 1. Consolidating Multi-Query Dashboards (N+1 Query Reduction)

Currently, the `OverviewController` and `sidebar-view.ts` execute 4 separate single-value queries in parallel to fetch KPI data (Net Worth, Income, Expenses, Savings). Since each query spawns a new Python `bean-query` subprocess and parses the ledger, this adds significant overhead.

**Observation:**
These four queries:
- `getTotalWorthQuery`
- `getThisMonthIncomeQuery`
- `getThisMonthExpensesQuery`
- `getThisMonthSavingsQuery`

**Improvement:**
They can be replaced with a **single grouped query** using conditional `WHERE` clauses. BQL allows us to apply the month/year filter only to Income/Expenses while keeping all-time balances for Assets/Liabilities.

**Proposed Query:**
```sql
SELECT
    account,
    round(number(only('${reportingCurrency}', convert(sum(position), '${reportingCurrency}'))), 2) AS amount
WHERE
    account ~ '^(Assets|Liabilities)'
    OR (account ~ '^(Income|Expenses)' AND month=month(today()) AND year=year(today()))
GROUP BY account
```

**Client-Side Processing:**
In TypeScript, we iterate over the returned rows once, categorizing the `amount` by the `account` prefix (`Assets`, `Liabilities`, `Income`, `Expenses`) to calculate all four KPIs simultaneously. This eliminates 3 redundant subprocess spawns per dashboard reload.

## 2. Eliminating Redundant Regex Parsing in Charts

The `BalanceSheetController` and `IncomeStatementController` load historical trend chart data via queries like `getHistoricalNetWorthDataQuery` and `getHistoricalNetProfitDataQuery`.

**Observation:**
The chart processing logic currently extracts numerical values from the CSV output using a heavy custom regex pipeline:
```typescript
// In _processChartData
const nw = parseAmount(extractConvertedAmount(row[2].trim(), reportingCurrency));
```
This is because it expects a multi-currency string (e.g., `"1234.56 USD"`).

**Improvement:**
The historical queries in BQL already use `only('${currency}', ...)` to isolate the target currency. By wrapping this in BQL's `number()` function, the query will output a plain number (e.g., `1234.56`) instead of an amount string.

**Proposed Query Change:**
```sql
-- Before
only('${currency}', convert(last(balance), '${currency}', ...))

-- After
number(only('${currency}', convert(last(balance), '${currency}', ...)))
```

**Client-Side Processing:**
With the query returning a pure float string, we can completely remove `parseAmount` and `extractConvertedAmount` from the chart data pipeline. The controllers can simply use `parseFloat(row[2]) || 0`, which is much faster and less error-prone.

## 3. Simplifying Commodity Holdings Parsing

In `CommoditiesController`, the `parseCombinedCommodityDataCSV` and `parseCommoditiesHoldingsCSV` functions use regex (`extractNumber`, `extractCurrencyToken`) to parse inventory strings like `"65.64 DOGE"` and converted values like `"658.37 INR"`.

**Observation:**
The query `getCombinedCommodityDataQuery` returns `valueOp_` as a string formatted as `<amount> <operatingCurrency>`.

**Improvement:**
We can offload the currency stripping to BQL using the `number(only(...))` pattern for the converted value column.

**Proposed Query Change:**
```sql
-- Before
convert(sum(position), '${operatingCurrency}') AS valueOp_

-- After
number(only('${operatingCurrency}', convert(sum(position), '${operatingCurrency}'))) AS valueOp_
```

**Client-Side Processing:**
The `valueOp_` column will now strictly contain a plain number, or empty/0 if conversion failed. We can replace the custom `extractCurrencyToken` logic with a straightforward `parseFloat(valueCell) || 0`. We still keep `units(sum(position))` as a string for the raw holdings display (`units_`), but the converted value logic is vastly simplified.

## 4. Refactoring `parseSingleValue`

The `parseSingleValue` utility in `src/utils/formatters.ts` uses CSV parsing and regex to pull a single number from single-row BQL outputs.

**Observation:**
Once the Overview KPIs are consolidated into a single grouped query (Improvement 1), the primary use cases for `parseSingleValue` will be removed.

**Improvement:**
The remaining uses of `parseSingleValue` (like in `InlineBQLProcessor` and Indicators) already benefit from queries wrapped in BQL's `number()` function. The regex fallbacks inside `parseSingleValue` that strip brackets/parentheses (`/^[({[]/g`) are largely redundant if the BQL query is written correctly. We can streamline this function to rely on standard CSV parsing and remove the overly complex string manipulations, since `number()` guarantees a clean numeric string.

---

### Conclusion

By shifting string manipulation and formatting logic from the JavaScript frontend into native BQL functions (`number()`, `only()`, `round()`), we can drastically simplify the processing functions in `src/utils/`. Furthermore, consolidating isolated KPI queries into a single grouped `WHERE` clause avoids the heavy performance penalty of spawning multiple Python processes, leading to a much snappier UI experience.

## 5. Detailed Review of Processing Functions

Below is a breakdown of specific formatting and parsing functions in the codebase, assessing whether they can be removed or simplified.

### In `src/utils/formatters.ts`

-   **`parseSingleValue(csv: string)`**
    -   **Current Usage:** Used to extract a single numeric value from single-row query responses (e.g., `getTotalWorthQuery`, inline BQL). Includes complex regex to strip brackets/parentheses for inventory strings.
    -   **Verdict:** **Simplify.** Once the Overview KPIs are consolidated, its usage will drop. For remaining uses (like Inline BQL), if the queries consistently use BQL's `number()` to guarantee a plain numeric string, the aggressive regex cleaning in this function can be safely removed, turning it into a simple CSV-row extractor.

-   **`parseAmount(amountString: string)`**
    -   **Current Usage:** Used heavily in `IncomeStatementController`, `BalanceSheetController` charts, and `TransactionsTab.svelte` to parse strings like `"1,234.56 USD"` into `{ amount: 1234.56, currency: 'USD' }`.
    -   **Verdict:** **Simplify/Refactor.**
        -   For charts: By modifying chart queries to return plain numbers using `number(only(...))`, `parseAmount` is no longer needed in the `_processChartData` pipelines.
        -   For `TransactionsTab`: It is used for sorting the Amount column. It can be kept but simplified or isolated to just handle UI string sorting, rather than being a core data-pipeline parser.

-   **`extractConvertedAmount(inventoryString: string, targetCurrency: string)`**
    -   **Current Usage:** Used by `IncomeStatementController` and `BalanceSheetController` to pull out the converted currency portion (e.g., pulling the `USD` part out of `"0.016 ETHW, 49.60 USD"`).
    -   **Verdict:** **Cannot completely remove, but usage can be reduced.**
        -   In chart processing: Can be **removed entirely** if the queries are updated to use `number(only(...))` as described above.
        -   In the main hierarchy builder (`buildAccountHierarchy`): This function is still necessary when `hasUnconvertedCommodities` is true, as the query returns multi-currency inventory strings that must be parsed client-side to separate the operating currency from other holdings.

-   **`extractNonReportingCurrencies(inventoryString: string, operatingCurrency: string)`**
    -   **Current Usage:** Extracts all other currencies from a multi-currency string to display as a warning/secondary column in the balance/income hierarchies.
    -   **Verdict:** **Keep.** Similar to `extractConvertedAmount`, this remains necessary for properly displaying multi-currency account rows in the UI when the ledger is not fully converted.

### In `src/utils/csvParsers.ts`

-   **`parseCombinedCommodityDataCSV` & `parseCommoditiesHoldingsCSV`**
    -   **Current Usage:** Parses complex multi-column outputs for the commodities dashboard. Contains internal regexes like `extractNumber` and `extractCurrencyToken` to handle BQL's formatted string outputs (`"65.64 DOGE"`, `"658.37 INR"`).
    -   **Verdict:** **Simplify.** By wrapping the `valueOp_` selection in `number(only('${operatingCurrency}', ...))` in the `getCombinedCommodityDataQuery`, we guarantee `valueOp_` is a pure number. This allows us to eliminate the internal `extractCurrencyToken` and `extractNumber` regex logic for the converted values, reducing the parsing to standard numeric casting (`parseFloat`).
