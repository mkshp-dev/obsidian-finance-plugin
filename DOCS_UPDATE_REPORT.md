# Documentation Update Report for Beancount Obsidian Plugin

Based on a thorough review of the current `src/` codebase and the documentation inside `docs-site/`, the following corrections, improvements, updates, and deletions are required to accurately reflect the current state of the plugin.

## 1. Structural Updates & New Pages
- **Income Statement Tab:**
  - **Issue:** The `Income Statement` tab has been fully implemented in the codebase (`src/ui/partials/dashboard/IncomeStatementTab.svelte`, `IncomeStatementController.ts`) but is completely missing from the documentation.
  - **Action Needed:** Create a new file `docs-site/docs/core-features/unified-dashboard/income-statement.md`.
  - **Details to Include:**
    - Explain features like interactive Sunburst Charts, total income, total expenses, net profit, and different valuation methods (convert, cost, units).
    - Provide the `bean-query` BQL queries used for fetching Income and Expenses, as defined in `IncomeStatementController.ts`.
- **Update `sidebars.ts`:**
  - **Issue:** The sidebars configuration does not list the new `Income Statement` page.
  - **Action Needed:** Add `'core-features/unified-dashboard/income-statement'` under the Unified Dashboard category in `docs-site/sidebars.ts`.

## 2. Updates to Existing Pages

### Overview Tab (`docs-site/docs/core-features/unified-dashboard/overview.md`)
- **Recurring Widget:**
  - **Issue:** The Overview tab now includes a `Recurring Widget` (`src/ui/partials/dashboard/RecurringWidget.svelte` and `RecurringController.ts`) which tracks upcoming recurring transactions. This is absent from the docs.
  - **Action Needed:** Add a "Recurring Transactions" section to the Overview Tab documentation explaining how it fetches `custom "recurring"` directives from `recurring.beancount` based on the `lookaheadDays` setting.

### Balance Sheet Tab (`docs-site/docs/core-features/unified-dashboard/balance-sheet.md`)
- **Sunburst & Trend Charts:**
  - **Issue:** The current documentation only mentions the account hierarchy and valuation methods. The codebase (`src/ui/partials/dashboard/BalanceSheetTab.svelte`) has added interactive Data Visualization including Trend Charts and Sunburst Charts for Assets, Liabilities, and Equity.
  - **Action Needed:** Document the new chart features in the "Features" section.

### Adding Directives (`docs-site/docs/core-features/adding-directives.md`)
- **Unified Transaction Modal:**
  - **Issue:** The documentation correctly explains the modal's functions but could benefit from explicitly naming `UnifiedTransactionModal` if referring to internal classes (or replacing any older references to `UnifiedEntryModal` if they existed in other places). The current explanation is solid but should match the exact tabs provided by `UnifiedTransactionModal.ts` (Transaction, Balance, Note, Pad, etc).

### First-Time Setup (`docs-site/docs/getting-started/first-time-setup.md`)
- **Dashboard Tabs Summary:**
  - **Issue:** Step 3 Verification mentions "Explore the 5 tabs".
  - **Action Needed:** Update this to "Explore the 6 tabs" to include the Income Statement tab.

### Architecture & Queries (`docs-site/docs/core-features/architecture-queries.md`)
- **Income Statement Queries:**
  - **Issue:** Missing the queries used to generate the Income Statement.
  - **Action Needed:** Add the BQL queries for extracting Income and Expenses (as handled by `IncomeStatementController.ts`).
- **Journal Tab Store Pattern:**
  - **Issue:** The documentation claims the "Journal tab fetches all three entry types in parallel and merges them client-side". While true, it might be worth mentioning (in an "Under the Hood" or similar section) that the Journal uses a Service/Store pattern (`JournalStore`, `JournalService`) compared to other tabs which use Controllers.

## 3. Deletions
- No major files need deletion, but outdated counts (like "5 tabs") and any potential obsolete architecture descriptions that don't match the new Controller/Store implementations should be purged.

## Summary
The documentation is largely accurate for the original features but has fallen behind the UI development of the Unified Dashboard, specifically missing the `Income Statement`, `Recurring Widget`, and interactive visualizations (`SunburstChart`).
