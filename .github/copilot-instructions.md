# Obsidian Finance Plugin - AI Agent Instructions

## Architecture Overview

This is an **Obsidian plugin** integrating [Beancount](https://beancount.github.io) plain-text accounting with **pure TypeScript + Svelte frontend**.

**Key architectural pattern**: TypeScript Obsidian plugin with direct Beancount CLI integration:
1. **Frontend**: Svelte components in Views/Modals → Controllers (with Svelte stores) → Services → Direct CLI execution
2. **BQL Execution**: Direct shell execution of `bean-query` for all data retrieval
3. **File Operations**: Atomic writes directly to Beancount files with backup support
4. **No Backend**: All operations performed client-side via CLI tools

## Critical Development Workflows

### Build & Dev
```bash
npm run dev        # Watch mode with esbuild (bundles TypeScript + Svelte)
npm run build      # Production build (minified)
```
**esbuild config**: 
- Svelte compiled with `css: "injected"` mode (no separate CSS files)
- TypeScript compiled with proper module resolution

### Testing in Obsidian
1. Build creates [main.js](main.js) in plugin root
2. Symlink/copy plugin folder to Obsidian vault: `<vault>/.obsidian/plugins/obsidian-finance-plugin/`
3. Enable plugin in Obsidian → Settings → Community Plugins
4. Use **debug mode** setting + browser DevTools for logging

## Service & Data Flow Patterns

### Controller Pattern (5 Dashboard Tabs)
Each tab has a **Controller** ([src/controllers/](src/controllers/)) managing:
- Svelte `writable` store for reactive state
- Data fetching via BQL queries
- Business logic for filtering/transformation

Example: [OverviewController.ts](src/controllers/OverviewController.ts) fetches net worth, income/expenses via `runQuery()` (shell BQL), exposes `state` store consumed by [OverviewTab.svelte](src/ui/partials/dashboard/OverviewTab.svelte).

### Service Layer
- [JournalService](src/services/journal.service.ts): Entry retrieval via BQL queries
- Direct file operations: All CRUD functions in [utils/index.ts](src/utils/index.ts) for creating/updating/deleting entries

### Store Pattern
[journal.store.ts](src/stores/journal.store.ts): Svelte store wrapping `JournalService`, provides reactive `entries`, `loading`, `error` states used by Journal tab.

## Platform & Environment Handling

### SystemDetector ([src/utils/SystemDetector.ts](src/utils/SystemDetector.ts))
**Critical for all environment operations**. Detects:
- Python executable (tries `python3`, `python`, `py`, WSL variants)
- WSL scenarios (Windows → WSL path translation `/mnt/c/...`)
- Beancount commands availability (`bean-query`, `bean-check`, `bean-price`)

**Always use** `SystemDetector.getInstance()` before spawning commands. See [ConnectionSettings.svelte](src/ui/partials/settings/ConnectionSettings.svelte) for test command patterns.

### Cross-platform Path Handling
- Windows users may have Beancount in WSL → use `convertWslPathToWindows()` from [utils/index.ts](src/utils/index.ts)
- Settings store absolute paths ([settings.ts](src/settings.ts): `beancountFilePath`, `beancountCommand`)

## BQL (Beancount Query Language) Integration

### Dual Query Modes
1. **Code Blocks**: `​```bql` in markdown → [BQLCodeBlockProcessor.ts](src/ui/markdown/BQLCodeBlockProcessor.ts) renders interactive tables
2. **Inline Queries**: `bql:SELECT ...` → [InlineBQLProcessor.ts](src/ui/markdown/InlineBQLProcessor.ts) renders single values in text

### Shorthand System
- Users define `bql-sh:WORTH` aliases in template file ([ShorthandParser](src/utils/shorthandParser.ts))
- Format: `## SHORTCUT_NAME: Description` followed by ` ```bql-shorthand ... ``` `
- Expanded at query execution time, supports both code blocks and inline

### Query Execution Pattern
```typescript
import { runQuery } from './utils/index';
const csv = await runQuery(plugin, query, true); // Returns CSV string
// Parse with csv-parse library (see controllers)
```
**Important**: Uses shell execution of `bean-query` (not Python API) for compatibility with user's Beancount setup.

## Svelte Component Conventions

### Modal Pattern
TypeScript wrapper extends `Modal` ([UnifiedTransactionModal.ts](src/ui/modals/UnifiedTransactionModal.ts)):
1. Constructor receives plugin + data
2. `onOpen()`: Mount Svelte component with `$set()` for props
3. `onClose()`: Call `component.$destroy()`
4. Svelte handles DOM in [TransactionEditModal.svelte](src/ui/modals/TransactionEditModal.svelte) with `createEventDispatcher` for callbacks

### View Registration
```typescript
// In main.ts onload()
this.registerView(VIEW_TYPE, (leaf) => new MyView(leaf, this));
// View extends ItemView, mounts Svelte component in onOpen()
```
See [unified-dashboard-view.ts](src/ui/views/dashboard/unified-dashboard-view.ts) for tab management with controllers.

## Beancount File Modification

### Write Patterns (via Python API)
Backend handles **atDirect File Operations)
All writes use **atomic operations** with backups in [utils/index.ts](src/utils/index.ts):
1. Read entire file into memory
2. Create backup if enabled (via `createBackupFile()`)
3. Parse/locate entry using BQL queries for line numbers
4. Modify lines in-memory
5. Write to temp file → atomic rename to original

**Key functions** in [utils/index.ts](src/utils/index.ts):
- `createTransaction()`: Append transaction to end of file
- `updateTransaction()`: Find via BQL, scan backward to header, replace entire block
- `deleteTransaction()`: Locate and remove transaction lines
- `createBalanceAssertion()`: Append balance directive
- `updateBalance()`: Find and replace balance line
- `createNote()`: Append note directive
- All operations preserve surrounding formatting and comments
QL Query Results**: Transaction updates query `postings` table which returns posting line numbers. Must scan backward to find header.
2. **Logger requires enablement**: `Logger.setDebugMode(true)` in settings, else silent ([logger.ts](src/utils/logger.ts)).
3. **WSL paths**: Windows → Beancount file in WSL requires `/mnt/c/...` translation for file operations.
4. **Svelte reactivity**: Use `$:` for derived values, controllers expose stores not raw data.
5. **BQL CSV parsing**: Always use `runQuery(plugin, query, true)` for CSV mode to avoid formatting issues.
6. **Atomic writes**: All file modifications use temp file + rename pattern for safety
4. Replace entire block atomically
## Common Gotchas

1. **Backend Port**: Hardcoded to 5013 (not 5001 as in old docs). Check [ApiClient](src/api/client.ts) `baseUrl`.
2. **Logger requires enablement**: `Logger.setDebugMode(true)` in settings, else silent ([logger.ts](src/utils/logger.ts)).
3. **Bundle size**: Python backend inlined as text literal in `main.js` (1800+ lines). Normal for this architecture.
4. **WSL paths**: Windows → Beancount file in WSL requires `/mnt/c/...` translation but Python commands run with `wsl python3`.
5. **Svelte reactivity**: Use `$:` for derived values, controllers expose stores not raw data.
6. **BQL CSV parsing**: Always use `runQuery(plugin, query, true)` for CSV mode to avoid formatting issues.

## Plugin Settings Architecture

[settings.ts](src/settings.ts) uses **tabbed UI** with Svelte component for Connection tab ([ConnectionSettings.svelte](src/ui/partials/settings/ConnectionSettings.s)
2. **BQL queries**: Create test note with `​```bql SELECT * FROM OPEN;​``` block
3. **File operations**: Test CRUD functions in Journal tab with backups enabled
4. **Dev tools**: Scripts in [dev-tools/](dev-tools/) for validating metadata writes and diff
- `bqlShowTools`/`bqlShowQuery`: Code block rendering preferences
- `createBackups`/`maxBackupFiles`: Safety for file modifications

## Testing Entry Points

1. **Connection validation**: Settings → Connection → "Test All Commands" button (see [ConnectionSettings.svelte](src/ui/partials/settings/ConnectionSettings.svelte) lines 400-600)
2. **Backend health**: Journal tab auto-starts backend, shows status indicator
3. **BQL queries**: Create test note with `​```bql SELECT * FROM OPEN;​``` block
4. **Dev tools**: Run [dev-tools/run_validate.py](dev-tools/run_validate.py) for metadata helpers

## Documentation Structure

- User docs in [docs-site/](docs-site/) (Docusaurus site, not used for AI reference)
- [README.md](README.md): Comprehensive user guide (architecture, features, setup)
- This file: Architecture for AI agents

---
**When in doubt**: Check existing controllers/services for patterns, use SystemDetector for env operations, and rely on Logger.log() for debugging (enable debugMode setting first). All CRUD operations are in [utils/index.ts](src/utils/index.ts).
