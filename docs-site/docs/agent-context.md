---
sidebar_position: 11
---

# Agent Context

This document provides technical context for AI agents and developers working on the `obsidian-finance-plugin`. It outlines the architecture, key file structures, and development patterns.

## 🏗️ Architecture

The plugin uses a **pure TypeScript/Svelte architecture**:

1.  **Frontend (TypeScript/Svelte)**:
    - Runs within Obsidian (Electron).
    - Manages UI, Settings, and all File I/O operations.
    - Uses Svelte for views (`src/ui/views/`, `src/ui/partials/`).
    - Organized by modules: `src/models`, `src/services`, `src/stores`, `src/controllers`.

2.  **Beancount Integration**:
    - Direct CLI execution of `bean-query`, `bean-check`, `bean-price`.
    - All data queries use BQL (Beancount Query Language).
    - No intermediate server or API layer.

3.  **File Operations**:
    - Direct file reads/writes with atomic operations.
    - Backup support before modifications.
    - Line-based parsing to preserve formatting.

## 📂 Key Directories

- **`src/`**: TypeScript source code.
    - **`main.ts`**: Plugin entry point.
    - **`settings.ts`**: Settings tab definition.
    - **`ui/`**: Svelte components, views, and modals.
    - **`controllers/`**: Tab controllers managing state and data flow.
    - **`services/`**: Business logic services (JournalService).
    - **`stores/`**: Svelte stores for reactive state management.
    - **`utils/`**: Utility functions including all CRUD operations.
    - **`types/`**: TypeScript definitions.

- **`docs-site/`**: Docusaurus documentation.

## 🧩 Key Patterns

### Direct CLI Execution
- All BQL queries execute via `runQuery()` function in `src/utils/index.ts`.
- Spawns `bean-query` as child process with proper shell escaping.
- Parses CSV output using `csv-parse/sync` library.
- Handles WSL path conversion automatically via `SystemDetector`.

### Safe File Writes
- **NEVER** overwrite user data without a backup.
- Pattern:
    1.  Read file content.
    2.  Create backup: `<file>.backup.<timestamp>` (if enabled).
    3.  Perform modification in-memory.
    4.  Write to temp file: `<file>.tmp`.
    5.  Atomic rename temp to original.

### BQL Execution
- **Code Blocks**: Handled by `src/ui/markdown/BQLCodeBlockProcessor.ts` registering a markdown code block processor.
- **Inline Queries**: Handled by `src/ui/markdown/InlineBQLProcessor.ts` with regex parsing.
- Both use `runQuery()` function for CLI execution.

### CRUD Operations
All entry creation, updates, and deletions are handled by functions in `src/utils/index.ts`:
- `createTransaction()`, `updateTransaction()`, `deleteTransaction()`
- `createBalanceAssertion()`, `updateBalance()`, `deleteBalance()`
- `createNote()`, `updateNote()`, `deleteNote()`
- Each uses BQL queries to find line numbers, then performs atomic file operations.

### System DEnable debug mode in settings, check Obsidian's Developer Console (Ctrl+Shift+I).
- **Styles**: `styles.css` contains global styles; Svelte components use scoped styles.
- **Testing**: Use Settings → Connection → "Test All Commands" to validate setup.

## 🤖 Common Tasks for Agents

1.  **Adding a new Visual Component**:
    - Create Svelte component in `src/ui/partials/`.
    - Register in appropriate view (e.g., `UnifiedDashboardView.svelte`).
    - Fetch data via BQL queries using `runQuery()`.

2.  **Adding New CRUD Operations**:
    - Add function to `src/utils/index.ts`.
    - Follow atomic write pattern (read → backup → modify → temp write → rename).
    - Use BQL to find line numbers, scan to find boundaries.

3.  **Updating Documentation**:
    - Edit files in `docs-site/docs/`.
    - Follow the structure defined in `sidebars.ts`.
    - Update README.md for user-facing feature changes.
