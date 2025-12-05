---
sidebar_position: 11
---

# Agent Context

This document provides technical context for AI agents and developers working on the `obsidian-finance-plugin`. It outlines the architecture, key file structures, and development patterns.

## 🏗️ Architecture

The plugin uses a hybrid architecture:

1.  **Frontend (TypeScript/Svelte)**:
    - Runs within Obsidian (Electron).
    - Manages UI, Settings, and File I/O for simple operations.
    - Uses Svelte for views (`src/views/`, `src/components/`).
    - Organized by modules: `src/models`, `src/services`, `src/stores`.

2.  **Backend (Python/Flask)**:
    - Independent process managed by `src/core/backend-process.ts`.
    - `src/backend/journal_api.py`: The main entry point.
    - Handles complex Beancount parsing, BQL queries, and filtering.
    - Exposes a local REST API (default port 5001).

3.  **Communication**:
    - Frontend calls Backend via HTTP (`src/api/client.ts`).
    - `BackendManager` handles process lifecycle (start, stop, health checks).

## 📂 Key Directories

- **`src/`**: TypeScript source code.
    - **`main.ts`**: Plugin entry point.
    - **`settings.ts`**: Settings tab definition.
    - **`core/`**: Core logic (BackendProcess, Lifecycle).
    - **`backend/`**: Python source code.
    - **`ui/`**: Svelte components and views.
    - **`services/`**: Business logic services (JournalService, TransactionService).
    - **`types/`**: TypeScript definitions.

- **`docs-site/`**: Docusaurus documentation.

## 🧩 Key Patterns

### Backend Management
- The backend is "Auto-starting".
- `BackendProcess` spawns the python script.
- It polls `/health` to check readiness.
- It creates a dedicated `.venv` if needed (logic in `journal_api.py` or startup scripts).

### Safe File Writes
- **NEVER** overwrite user data without a backup.
- Pattern:
    1.  Read file.
    2.  Write `<file>.backup.<timestamp>`.
    3.  Perform modification.
    4.  Write new content to `<file>`.

### BQL Execution
- **Code Blocks**: Handled by `src/main.ts` registering a markdown code block processor.
- **Inline Queries**: Handled by regex parsing in `src/main.ts` (or dedicated processor).
- Both use `BeanQueryService` to call `bean-query` (either via CLI or Backend API).

### System Detection
- `src/utils/SystemDetector.ts` is the source of truth for paths.
- Handles `wsl` path conversion (`/mnt/c/...` to/from `C:\...`).

## 🛠️ Development Tips

- **Build**: `npm run build` (uses esbuild).
- **Hot Reload**: `npm run dev` (watches changes).
- **Logs**: Backend stdout/stderr is piped to Obsidian's Developer Console.
- **Styles**: `styles.css` contains global styles; Svelte components use scoped styles.

## 🤖 Common Tasks for Agents

1.  **Adding a new Visual**:
    - Create Svelte component in `src/ui/partials/`.
    - Register in `UnifiedDashboardView.svelte`.
    - Fetch data via `BeanQueryService`.

2.  **Extending the API**:
    - Add endpoint in `src/backend/journal_api.py`.
    - Add typed method in `src/api/client.ts`.

3.  **Updating Documentation**:
    - Edit files in `docs-site/docs/`.
    - Follow the structure defined in `sidebars.ts`.
