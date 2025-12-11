# Code Review Findings

## Critical / High Priority
1.  **Port Conflict Risk**: The Python backend hardcodes port `5013` (`src/core/backend-process.ts`). If this port is in use by another application, the backend will fail to start.
    *   *Recommendation*: Implement port hunting (find first available port) or allow configuration in settings.
2.  **Dependency Installation**: The backend attempts to install `flask` and `flask-cors` using `pip` automatically. This can fail due to permission issues or environment isolation (e.g., in some system Python installs).
    *   *Recommendation*: If installation fails, surface a clear error message to the user asking them to install dependencies manually via terminal.

## Medium Priority
1.  **Manifest Directory Reliability**: `BackendProcess` relies on `(this.plugin as any).manifest.dir`. While standard in Obsidian, strictly speaking the `manifest` property type definition doesn't guarantee `dir` is present in all contexts (though for a loaded plugin it is).
    *   *Recommendation*: Fallback to constructing the path relative to the vault root if `dir` is missing, or ensure typed access.
2.  **Hardcoded "localhost"**: `ApiClient` uses `http://localhost:5013`. On some systems (especially IPv6 enabled), `localhost` might resolve differently than `127.0.0.1`.
    *   *Recommendation*: Consistency is key. `backend-process.ts` spawns with `--host localhost`. It is usually safer to use `127.0.0.1` explicitly to avoid DNS resolution issues.

## Low Priority / UX Improvements
1.  **Loading States**: While `JournalTab` has a loading state, some other tabs might benefit from clearer "empty states" or skeletons while data is being fetched.
2.  **Error Messages**: Some API errors return generic 500s. The Python backend could be improved to return structured JSON errors that the frontend can display more gracefully (e.g., "Transaction date invalid" instead of "Server Error").
3.  **Suggestion Limits**: `JournalTab` limits autocomplete suggestions to 200 items. This is a good performance guard, but for users with massive ledgers, they might miss accounts.
    *   *Recommendation*: Implement server-side search for autocomplete instead of fetching all and slicing.

## Future Tech Debt
1.  **Controller vs Store Pattern**: The codebase is currently mixed. `JournalTab` uses a Svelte Store pattern (reactive), while older tabs (`Overview`, `Transactions`) use a Controller pattern.
    *   *Recommendation*: Standardize on the Store/Service pattern (like `JournalStore`) for better reactivity and separation of concerns in v2.x.
