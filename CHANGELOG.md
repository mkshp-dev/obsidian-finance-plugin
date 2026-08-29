# Changelog

All notable changes to Beancount Ledger will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## In-progress

## 2.4.1 - 2026-08-29

- **Reconciliation Actions: Edit, Balance, and Force Reconcile** — The Snapshot sidebar's Reconciliation tab now does more than report status. Each account row gets three buttons: **Edit** opens a new **Account details** modal — view open/close dates, currencies, and reconciliation status, and set or clear the `reconcile` interval on an already-open account, previously only settable once at account creation — also reachable by right-clicking an account row in the Accounts & Balances tab. **Balance** jumps straight to the Add Transaction modal's Balance tab with the account pre-filled, for the everyday "check the real balance, record it" step. **Force reconcile** — enabled only when an account's latest balance assertion is actually failing — inserts a Beancount `pad` directive so Beancount auto-generates a transaction covering the difference, with a pad-account picker and a plain-language warning that this is a plug, not a fix for whatever caused the gap. The summary row was also simplified from two bordered stat boxes to a single text line ("N overdue · N up to date") with a new **Only overdue** toggle to filter the list down to what needs attention.

- **Scheduled & Recurring Transactions** — Set up transactions that repeat automatically or fire once in the future, right from the Snapshot sidebar. A new **Upcoming** tab (toggled against Key Metrics) lets you define a schedule — name, frequency (`One-time`, `Weekly`, `Monthly`, `Quarterly`, `Yearly`), start date, payee/narration, and any number of postings, including a blank posting left to auto-balance — which is stored as a plain-text `event "Recurring"` directive in `events.beancount`. Nothing posts to your ledger automatically: click **Refresh** to check for due occurrences, and a schedule that's fallen behind surfaces *every* missed occurrence at once rather than just the next one. Each occurrence is resolved independently as **Insert** (materialize it and advance), **Skip** (dismiss it and still advance), or left on **Hold** (re-offered next refresh) — with a Hold on an earlier occurrence correctly blocking later ones in the same batch from being resolved out of order. Every materialized transaction is tagged with `scheduled: "<name>"` metadata, giving a built-in duplicate-insert safety check and a full audit trail back to its originating schedule. The bundled onboarding demo ledger now includes several example schedules covering every frequency.


## 2.4.0 - 2026-08-17

- **Unified Inter-Tab Dashboard Connections & Navigation API** — Built a centralized navigation contract (`NavRequest`, `NavigationFilters`) allowing cross-tab linking and filter synchronization across the entire dashboard:
  - **Journal Tab**: Click any posting account name on a `TransactionCard` or `BalanceCard` to open the Transactions tab pre-filtered to that account (#263).
  - **Income Statement Chart**: Click any month/week column in the Income Statement trend chart to jump to the Transactions tab pre-filtered to that date range, with a `pointer` cursor on hover (#264).
  - **Income Statement Table**: Click any leaf account row (or `Ctrl`/`Cmd` click category headers) in the Income/Expenses table to view transactions for that account (#265).
  - **Balance Sheet Table**: Click any leaf account row (or `Ctrl`/`Cmd` click category headers) in Assets/Liabilities/Equity tables to jump to the Transactions tab pre-filtered to that account (#266).
  - **Overview Tab**: Click KPI summary cards (Income, Expenses, Total Balance, Savings Rate) to open Transactions tab pre-filtered to that period & account type. Added a `"→ View"` button and clickable account chips on Budget and Target indicator cards (#267).
  - **Sunburst Charts**: Click any arc segment on Sunburst charts across Income Statement and Balance Sheet tabs to navigate to Transactions for that account, featuring cursor pointer styling and enhanced tooltip hints (#268).
  - **Transactions ↔ Journal**: Click any payee name in the Transactions tab table to jump to the Journal tab pre-filtered to that payee, and click the `"↗"` link or payee name on Journal `TransactionCard` headers to jump back to the Transactions tab (#269).
  - **Journal Tab Tags**: Click any `#tag` chip on a `TransactionCard` header to jump to the Transactions tab pre-filtered to that tag.
  - **Ctrl/Cmd+Click for Journal**: All account/tag/date-range/KPI clickables that navigate to Transactions now also support `Ctrl`/`Cmd`+click to open the Journal tab pre-filtered instead — Journal card account & tag chips, Overview KPI cards and Budget/Target indicators, Income Statement chart columns, and leaf account rows and Sunburst arcs on the Balance Sheet and Income Statement tabs. Category header rows on the Balance Sheet/Income Statement tables keep their existing `Ctrl`/`Cmd`+click behavior (jump to Transactions for that category) unchanged. Also fixed a bug where Sunburst arc clicks (#268) were never actually wired to navigation (`segment-click` had no listener), so that connection now works for the first time.

- **Transactions Tab: Clear filters button** — Added a "Clear" button next to Refresh, matching the Journal tab.

- **Commodities: "Update Prices" reflects real availability** — The button is now disabled (with an explanatory tooltip) when no `bean-price` command is configured, instead of failing silently on click. Also removed `bean-price`'s live auto-detect fallback so it always runs the exact command shown in Settings → Connection, matching `bean-query`'s existing behavior.

- **Settings: Clearer command verification feedback** — Fixed the Verify button's success/error box, which was rendering a duplicate checkmark/✕ with low-contrast text; redesigned with a tinted background and left border accent.

- **Currency-aware decimal precision** — Amounts across the dashboard now use each currency's actual precision (inferred from how it's written in the ledger), instead of a hardcoded 2 decimals everywhere. Fixes crypto/low-value commodity prices that were being rounded to `0.00`, and zero-decimal currencies (e.g. JPY) that were getting a padded `.00`.


## 2.3.2 - 2026-08-07

### Added 🚀

- **Account Reconciliation Tracking** — Never lose track of which accounts are overdue for reconciliation. Assign a `reconcile: <days>` interval to any account's `open` directive and the plugin will continuously monitor how long ago each account last had a `balance` assertion — flagging any that exceed their interval or have never been reconciled at all. A new **Reconciliation tab** in the Snapshot sidebar shows an at-a-glance summary (overdue count vs. up-to-date count) and a per-account status list with clear ✅ / ⚠️ indicators. Setting up intervals is just as easy: the **Open Account** modal in the Accounts tab now includes an optional **"Reconciliation interval (days)"** field, so you can configure the schedule directly from the UI without touching your `.beancount` files.

### Improved 🔨

- **Custom Pill Dropdown Controls** — Redesigned the chart area selectors and filter controls across the "Accounts and Balances", "Income Statement", and "Commodities" tabs with a polished custom dropdown component. Primary selectors ("Net Worth Trend" / "Trends" / "All Commodities") use a vibrant purple accent with custom SVG icons, paired with cascading sub-option menus ("Balances", "Monthly", "Weekly", "Assets", "Liabilities", etc.). Popovers are 100% opaque across all Obsidian themes and support full keyboard navigation (`Escape`, `Enter`, Arrow keys) and click-outside dismissal.


## 2.3.1 - 2026-07-26

### Added 🚀

- **Onboarding Wizard: Full redesign with connection probing** — Replaced the previous onboarding trigger (keyed on `structuredFolderName`) with a dedicated `onboardingCompleted` settings flag and a companion runtime connection probe (`probeConnection`) that non-blockingly verifies `bean-query` reachability on startup. The wizard Svelte component was rewritten with new step-based UI including dependency detection cards, folder-structure tree preview, setup-card selection, a polished summary/next-steps screen, and refined CSS using Obsidian design tokens throughout.

- **Settings: Structured metadata definitions and Editor tab** — Added a `getSettingDefinitions()` method that returns human-readable names and descriptions for all settings, enabling programmatic access for onboarding and documentation. Reorganised the settings tabs: the former "Backup" tab was merged into "Performance", the "Named queries" help block was removed from the BQL tab, and a new dedicated **📝 Editor** tab was created to house autocomplete, snippets, format-on-save, and lint-mode settings.

- **Documentation Site: Docusaurus-based docs-site** — Shipped a complete `docs-site/` directory containing a Docusaurus project with 20+ documentation pages covering installation, requirements, first-time setup, all dashboard tabs, adding data, advanced queries, Beancount syntax reference, settings, troubleshooting, plugin API, and the changelog. Includes screenshots, videos, and custom CSS theming.

### Improved 🔨

- **Journal Tab: Robust in-memory filtering for Balances and Notes** — Balance and Note directives now honour the search field, payee, and tag filters. Balances are filtered client-side by account, amount, and currency; Notes are filtered by account, comment, and tags. When a payee filter is active, Balances and Notes are correctly excluded since those directive types have no payee. Re-sort logic was extended to cover all three filter dimensions.

- **UI Polish** — Changed the "Open Account" modal date field from a plain text input to a native `<input type="date">` picker. Aligned the Journal tab search debounce delay from 800 ms to 300 ms (matching the Transactions tab). Fixed double currency rendering on Balance cards where `{entry.diff_amount}` already included the currency symbol.

- **BQL Processors: Obsidian-native DOM helpers** — Replaced all raw `activeDocument.createElement` calls in `BQLCodeBlockProcessor` and `InlineBQLProcessor` with Obsidian's native helpers (`createDiv`, `createSpan`, `createEl`). Refactored the file-download anchor creation to use `createEl('a', { attr: { … } })` with proper `detach()` cleanup and a feature-detection guard (`'download' in HTMLAnchorElement.prototype`).

- **ESLint & Code Quality** — Updated the ESLint ignore path from `docs/` to `docs-site/`, renamed the npm script from `eslint` to `lint` for standardisation, pinned `@eslint/js` to `^9.0.0`, and upgraded `eslint-plugin-obsidianmd` to `latest`. Resolved all new linting issues raised by the updated ruleset (Obsidian-native DOM APIs, `createDiv`/`createSpan` usage, safe element creation patterns).

### Fixed 🐛

- **Settings DOM: Replace `createEl('div')` with `createDiv()`** — Updated three instances in the File Organisation settings tab (`pathDiv`, `descEl`, `validationEl`) to use Obsidian's `createDiv()` helper instead of `createEl('div', …)`, resolving lint warnings from `eslint-plugin-obsidianmd`.

### Changed (internal) 🔧

- **CI/CD: Release and deployment workflow fixes** — Restructured `release-finalize.yml` to prevent false failures, standardised the changelog-rewriting regex, fixed the docs directory path in `release-trigger.yml`, added `CHANGELOG.md` and workflow files to deploy triggers, and migrated the documentation deployment to direct GitHub Actions deployment.

- **Licensing & Manifest** — Standardised `LICENSE` to MIT and converted `manifest.json` `fundingUrl` from a plain string to the multi-platform object format (`GitHub Sponsors` + `Buy Me a Coffee`).


## 2.3.0 - 2026-07-15

- **Transaction Modal: Layout improvements and UI fixes** — Moved Account fields in Balance/Note tabs and the Query name field in the Query tab adjacent to the Date field for a more compact form layout. Adjusted flag select box height and padding to prevent vertical text clipping, and properly escaped Svelte double curly braces in the cost section to prevent rendering of '[object Object]'.

- **Editor & Dashboard: User-defined transaction snippets** — Added support for loading custom transaction templates from a standalone `snippets.beancount` file. Toggling the feature on-demand creates the template file with a `sampleSnippet` if missing. Supports real-time cache reloading via vault change events, folder rename safety hooks, and a command to open the snippets file. Also added a `📋 Snippet` button to transaction cards in the Journal tab to save existing transactions to the snippets file under a custom name, and a `📋 Load Snippet` button in the `Add Transaction` modal footer to search and populate the form fields.

- **Transaction Modal: Polish delete button UI** — Replaced the trash can/bucket emoji (`🗑️`) with a standard `✕` (`&times;`) sign across the posting and metadata deletion buttons. Redesigned the button from a solid red block to a clean white/grey layout with a red cross that transitions to a soft red background on hover. Cleaned up redundant CSS rules to unify the button styling.


- **Journal Tab: Icon-only actions & button reordering** — Switched action buttons for transactions, notes, and balances to compact icon-only layouts to save horizontal space. Reordered transaction actions to **Edit (✏️) → Save as snippet (📋) → Delete (❌)** and note/balance actions to **Edit (✏️) → Delete (❌)**. Added clear tooltips to all icon buttons.

- **ESLint & Code Quality: Resolve all static analysis errors** — Resolved all ESLint errors by adjusting the configuration to ignore the standalone `docs/` directory instead of the obsolete `docs-site/` pathway, applying sentence-casing to UI labels, using window-scoped timer prefixes for popout window compatibility, and typing variables cleanly to prevent unsafe promise checks.

- **Documentation: QoL improvements** — Removed outdated caution warning, added community store installation instructions, updated logo path to repository root, and pointed to online documentation for detailed requirements.

## 2.2.6 - 2026-07-08

## 2.2.5 - 2026-07-08

- **Codebase Cleanup: Remove dead path-normalisation methods from SystemDetector** — Deleted `normalizeFilePath` and its private helper `convertWSLToWindowsPath` from `SystemDetector`. Both methods had zero external callers; WSL↔Windows path translation is already handled correctly at two dedicated call-sites: `convertWindowsPathToWsl` (in `fileEditor.ts`) is applied JIT in `queryRunner.ts` when the configured command includes `wsl`, and `convertWslPathToWindows` (also in `fileEditor.ts`) is used throughout `directives.ts` and `beancount-lint.ts` to normalise paths returned by Beancount tools before Obsidian vault writes.

## 2.2.4 - 2026-07-07


## 2.2.3 - 2026-07-07

- **Settings: Remove redundant path fields for cross-device portability** — Removed `beancountFilePath` and `structuredFolderPath` from the plugin settings interface and `data.json`. Both fields stored absolute OS-level paths that broke portability when settings were synced across machines with different usernames or directory layouts. Since v2.0.0 enforces vault-only file access, the main ledger path can always be derived at runtime as `structuredFolderName + "/ledger.beancount"` via the existing `getMainLedgerPath()` utility. Updated all call sites (`directives.ts`, `sidebar-view.ts`, `beancount-lint.ts`, `ConnectionSettings.svelte`, `OnboardingModal.svelte`) to use `getMainLedgerPath()` or guard on `structuredFolderName` instead. Added an explicit `sourcePath` parameter to `migrateToStructuredLayout()` so onboarding no longer needs to write a temporary path into settings. The onboarding trigger in `main.ts` now checks `structuredFolderName` as the source of truth for setup completion. Addresses portability concern raised in discussion #245.

## 2.2.2 - 2026-07-04

- **Onboarding Wizard: Improve UI/UX flow and navigation gating** — Updated the setup wizard to allow users to skip or proceed past the Python/prerequisites check step. Added a warning callout if Beancount is missing while allowing layout setup to proceed, clarified that ledger files must be vault-relative, updated placeholders, and added Cancel/Exit button triggers to Step 2.

- **File Organization: Safe Folder name renaming with validation** — Redesigned the **Folder name** setting field with an interactive Edit/Save/Cancel lifecycle. Added validation checks for folder existence and invalid characters, physically renaming the structured layout folder in the Obsidian vault, and dynamically updating configuration paths (`beancountFilePath` and `structuredFolderPath`) under the hood to prevent write/query path mismatches.

- **Codebase Cleanup: Remove obsolete settings, unused parameters, and redundant scripts** — Removed dead advanced settings panels and file autocomplete modal helpers from the settings view, eliminated unused parameters and variables from controllers, processors, and layout utilities, and removed redundant script files (`test-build.js` and the checked-in detection script artifact) to simplify the codebase and improve maintainability.

## 2.2.1 - 2026-07-04

## 2.2.0 - 2026-06-21

- **Multi-Currency Warning: Clarify warning column wording** — Updated the multi-currency warnings on the Balance Sheet and Income Statement to reference the specific reporting currency name instead of positional column descriptions like 'first column' and 'second column' to prevent user confusion. Merged PR #230.

- **Income Statement: Fix Net Profit trend signs and show income as positive** — Updated the income statement and net profit trend charts to display conventional signs (positive values for profit and negative values for loss), negating credit accounts at the source so income balances render as positive. Adjusted chart colors (green for profit, red for loss) and fixed the anomalous stripes rendering on the Income Sunburst Chart. Merged PR #238.

- **Financial Overview: Selectable reporting periods** — Added a period selector to the Overview dashboard to filter income, expenses, and savings rate KPI cards. Supports presets (This Month, Last Month, This Year, Last Year) as well as custom months and years. Updates the total balance query to compute historical period-end net worth correctly based on the selected period end date. Merged PR #234.

- **Budget & Target Suggestions: Improve account autocomplete** — Removed the arbitrary 8-item hard limit from the Add Budget and Add Target account autocomplete lists. Added matching result counts, default/empty state notes, and increased dropdown heights with full scrollbar support. Merged PR #239.

- **Commodity Dashboard: Display names and price history** — Added support for retrieving and displaying human-readable display names from Beancount commodity metadata. Introduced interactive price history chart and table views in the commodity details modal. Restructured card grids and key-value details layout with overflow-wrap/ellipsis rules to handle long text fields without UI clipping or overlap. Merged PR #237.

- **Journal Filter Autocomplete: Custom suggestion menus** — Replaced native HTML `<datalist>` inputs with custom, scrollable dropdown menus for Account, Payee, and Tag filters in the Journal view. Truncates rendering to the top 50 matches to prevent Electron/Obsidian DOM lag, while preserving full search capabilities. Adds keydown handlers (Escape to close) and click-safe blur timers. Merged PR #236.

- **Performance: Optimize Balance Sheet and Income Statement queries using BQL native position filtering** — Shipped native position splitting via `only()` and regex substitutions via `subst()` inside `bean-query`, moving heavy parsing out of the Svelte frontend. This reduces processing steps, simplifies the controllers, and speeds up dashboard load times. Closes [#211](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/211).

- **Commodity Dashboard: Support negative commodity holdings and correct UI rendering** — Updated parser to preserve negative signs from BQL units/values queries (allowing short/residual positions). Fixed `CommodityCard` value rendering to correctly display negative operating currency values instead of falling back to raw units, and updated `CommoditiesTab` filters (`has_holding` / `has_both`) to check for non-zero holdings (`!== 0`) so short positions are not hidden. Merged PR #229.

## 2.1.8 - 2026-06-15

## 2.1.7 - 2026-06-15

## 2.1.6 - 2026-06-14

## 2.1.5 - 2026-06-14

## 2.1.4 - 2026-06-14

## 2.1.3 - 2026-06-14

- **Component Cards: Refine styling, margins, and density** — Refactored TransactionCard, BalanceCard, NoteCard, and CommodityCard to use a var(--background-secondary) background with subtle border-hover outlines. Tightened component padding, optimized typography visual hierarchy (emphasizing values, muting labels/dates), and reduced line-heights to present dense card lists cleanly. Closes [#219](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/219).

- **Dashboard Layout: Optimize tab padding, density, and controls** — Moved outer padding to UnifiedDashboardView's tab container, removing double padding across all tabs. Increased density on Income Statement and Balance Sheet tables by reducing cell padding and using smaller UI font sizes. Tightened TransactionsTab filter controls with compact spacing and standard Obsidian-aligned input heights. Closes [#218](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/218).

- **Modal Polish: Compact grid layouts, unified spacing, and standard footers** — Refactored form layouts in AddBudgetModal, AddTargetModal, and CommodityCreateModal to use CSS Grid for compact, aligned form presentation. Standardized spacing using Obsidian design tokens, unified modal footers using a standard .modal-footer class aligned to the bottom right, and adjusted custom autocomplete dropdown max heights to optimize vertical space. Closes [#217](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/217).

- **Onboarding Workflow: Refactor wizard to Svelte & polish layout** — Replaced the custom DOM-based onboarding wizard with a Svelte component, introduced a card-based data selection layout, reduced vertical spacing, adopted Obsidian's native setting-item classes, and standardized success/warning states to match Obsidian UI tokens. Closes [#216](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/216).

- **Design Cleanups: Adopt Obsidian spacing and CSS tokens** — Transitioned inline styles across Svelte/TypeScript files to external stylesheets and `<style>` blocks, cleaned up hardcoded pixels to use design tokens, standardized typography variables, and compacted inputs/buttons for a professional native Obsidian feel. Closes [#215](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/215).

- **Loading & Error States: Standardize status states across all tabs** — Added unified, premium skeleton loaders, error banners with interactive retry buttons, and empty state illustrations. Integrated them across all 5 dashboard views to prevent sudden blank state shifts. Closes [#87](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/87).

- **Design Tokens: Establish design token system in styles.css** — Added consistent spacing, typography, shadow, transition, and finance-specific color variables (assets, liabilities, equity, income, expense) adapting automatically to light/dark themes under `:root`. Refactored existing styles to use these variables for better theme integration. Closes [#84](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/84).

- **File Organization: Support monthly transaction files** — Added setting to organize transactions by month (`transactions/YYYY/YYYY-MM.beancount`) instead of just yearly. Updates the onboarding wizard and automatic file management tools to support both formats dynamically, and resolves a bug where the main ledger includes remained yearly after initial creation or migration. Closes [#210](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/210).

- **Financial Indicators: Add edit and delete support for budgets and targets** — Added UI action buttons to edit and delete indicators, backed by new atomic update/delete directives helpers and event line location querying. Closes [#207](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/207).

## [2.0.0] - 2026-06-03

### Changed ⚠️
- **Security & Compatibility: Vault-only ledger requirement (Breaking Change)** — Replaced all direct filesystem access (`fs` and `fs/promises` imports) in `fileEditor.ts`, `directives.ts`, and `PriceService` with Obsidian's native Vault adapter APIs (`exists`, `read`, `write`, `remove`, `rename`, `copy`). Because the Obsidian Vault API is strictly scoped to files inside the vault, the plugin now requires your Beancount ledger and any included files to be stored inside the current vault. Absolute paths outside the vault are no longer supported. Closes [#203](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/203).

### Security 🔒
- **CLI Execution: Migrate to safe parameterized spawn calls** — Replaced all shell execution (`exec` and `execAsync`) calls across `SystemDetector`, `queryRunner`, `price.service`, and `sidebar-view` with a secure utility `execSafe` that runs commands directly as process spawns without shell invocation (`shell: false`). Replaced shell-based OS detection with native Node APIs, added whitelist sanitization to user-configured price metadata, and documented permissions in the README. Closes [#204](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/204).

## [1.6.0] - 2026-05-31

### Added 🚀
- **Editor: Inline linting via bean-query `.errors` diagnostics** — Beancount validation errors now appear as red squiggly underlines directly in the editor. Uses the existing `runQuery` / bean-query infrastructure (no separate `bean-check` install required): runs the special `.errors` BQL command, parses the plain text output, and maps results to CodeMirror 6 `Diagnostic` objects. A lint-gutter marker appears in the left margin for each affected line; hovering shows the full error message. Three modes in Settings → BQL → Editor Settings: *Off*, *On save* (default, ~500 ms after save), and *On change* (2 s debounce). Lint runs silently without blocking editing. Implemented in `src/lang/beancount-lint.ts` (`getErrors` + `beancountLinter`). Closes [#190](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/190).
- **Editor: Directive snippet templates (txn, open, balance, price, pad…)** — typing a directive keyword (`txn`, `open`, `close`, `bal`, `pad`, `price`, `note`) at the very start of a line and pressing Tab now expands a fully-formed directive template with Tab-navigable placeholders. Today's date is pre-filled in every snippet. Implemented in `src/lang/beancount-snippets.ts` as a `beancountSnippetSource` composed into a single `autocompletion()` extension together with the existing account/payee/narration sources in `BeancountFileView`. Closes [#186](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/186).
- **Editor: Smart indentation and Format Document command** — pressing Enter after a posting or directive line now auto-indents the new line with 2 spaces; a new "Format Document" command (`Ctrl/Cmd+Shift+F` or via the command palette as *Format Beancount Document*) normalises posting indentation to 2 spaces, right-aligns amounts within each transaction block, and fixes `@` / `@@` price-annotation spacing. An opt-in "Format on save" toggle (Settings → BQL → Editor Settings, default off) applies the formatter automatically on every save. Implemented in `src/lang/beancount-indent.ts` (`indentService`) and `src/lang/beancount-format.ts` (pure `formatBeancount` + CodeMirror command). Closes [#184](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/184).
- **Editor: Payee, narration, currency, tag and link autocomplete** — extended the existing CodeMirror 6 completion system with four new context-aware sources: (1) payee suggestions inside the first quoted string of a transaction header, sourced from `getPayees()`; (2) narration suggestions inside the second quoted string, optionally filtered by the already-typed payee; (3) currency/commodity completions after numeric amounts or after `commodity`/`price`/`balance` directives, sourced from `getCommodities()`; (4) tag completions after `#` and link completions after `^` in transaction headers, sourced from `getTags()` and the ledger's `links` column respectively. All sources share the same 30-second TTL cache per plugin instance. Completions are context-isolated and do not leak between fields. The Settings → BQL → Editor Settings toggle now governs all completion types and its label was updated to "Editor autocomplete". Closes [#182](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/182).
- **Editor: Account-name autocomplete in the Beancount file editor** — typing an account prefix (`Assets:`, `Expenses:Food`, etc.) in a `.beancount` file now shows a completion popup with matching open accounts. Completions are sourced from the ledger's `open` directives via `getOpenAccounts()`, sorted by usage frequency, and cached for 30 seconds (cache is invalidated on file reload). The popup is suppressed inside comment lines and string literals. A new toggle **Account name autocomplete** in Settings → BQL → Editor Settings lets users enable or disable the feature. Closes [#180](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/180).
- **File editor: Beancount syntax highlighting via Lezer grammar** — `.beancount` files now render with full colour-coded syntax highlighting: directives, dates, account names, currencies, amounts, string literals, metadata keys, tags, flags, and comments are each tokenised and mapped to Obsidian CSS variables so the colours adapt automatically to light and dark themes. Implemented as a `StreamLanguage`-backed `LanguageSupport` extension (`src/lang/beancount-language.ts` + `src/lang/beancount-highlight.ts`) consumed by `BeancountFileView`. Closes [#178](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/178).
- **File editor: replaced textarea with CodeMirror 6 EditorView** — `.beancount` files now open in a full CodeMirror 6 editor with line numbers, undo/redo, find/replace, active-line highlighting, and Tab key support. All `@codemirror/*` packages are provided by Obsidian's runtime; no bundle-size increase. Closes [#176](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/176).

### Improved 🚀
- **Documentation: Refactor Docusaurus documentation hierarchy** — restructured the documentation layout to match a more logical user flow, splitting requirements, introducing new guides for direct file editing features (autocomplete, linting, formatting, snippets), documenting the new accounts & balances and income statement dashboard tabs, and grouping advanced BQL queries. Closes [#199](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/199).

### Fixed 🐛
- **Accounts and Balances: duplicate "Net Worth Trend" label in trend chart area** — removed the extra chart title rendering so the label appears once in the selector UI.
- **Commodity metadata: price source test failed for valid expressions on Windows** — switched validation to execute `bean-price -e <source>` using argument-based process spawning (instead of shell-quoted command strings), fixing errors such as invalid source with extra quote characters.
- **File writes: race conditions and newline corruption on Windows** — adopted Fava-like file-write safety measures across all CRUD operations:
  - **Concurrency control:** introduced an async mutex (`FileLock`) in `fileEditor.ts`; concurrent writes to the same path are now queued sequentially, and unique temporary filenames eliminate race conditions between parallel `.tmp` writes.
  - **Newline preservation:** all read-modify-write operations (`updateBalance`, `deleteBalance`, `updateNote`, `deleteNote`, `updateTransaction`, `deleteTransaction`, `saveCommodityMetadata`, `deleteCommodityDirective`) now detect and preserve the file's original line ending (`\r\n` or `\n`) via `getNewlineCharacter()`.
  - **Append/create operations extended:** `saveOpenDirective`, `saveCloseDirective`, `createBalanceAssertion`, `createNote`, `createCommodity`, and `createPriceDirective` now also detect the target file's line ending before appending, ensuring newly written directives match the file's existing style. (PR #173 + follow-up)

## [1.5.2] - 2026-05-27

### Fixed 🐛
- **Indicators: wrong-cycle data for rollover budgets** — rollover queries previously used `GROUP BY (year, month) ... ORDER BY DESC LIMIT 1`, returning the most recent past cycle's row when the current cycle had no postings yet. Replaced with an aggregate-only query filtered to the current cycle via `date_trunc`.
- **Indicators: rollover remaining stuck at base amount** — when an account had no postings at all, the query returned zero rows and the fallback reset remaining to `targetAmount`, discarding accumulated carry-over. Remaining is now computed client-side as `elapsedCycles × targetAmount − cumulativeBalance`.
- **Indicators: negative available budget shown as "On Track"** — a rollover deficit made `effectiveTarget` negative, but `getPct` short-circuited to `0%` (green). Negative or zero effective target now correctly renders as "Over Budget".
- **Indicators: rollover targets silently treated as non-rollover** — `loadTargetStatus` always computed `remaining = targetAmount − current` regardless of `isRollOver`. Now applies the correct carry-over formula for rollover targets.

### Improved 🚀
- **Demo ledger** — uncommented the example BQL query and added multiple `event "Indicator"` directives (Budgets and Targets) so the Financial Indicators section is populated when users first test the plugin. Closes [#164](https://github.com/mkshp-dev/obsidian-finance-plugin/issues/164).

---