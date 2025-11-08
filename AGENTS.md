# Obsidian Finance Plugin - Developer Guide

## Project Overview

**Target**: Obsidian Community Plugin for financial management with Beancount integration  
**Entry Point**: `main.ts` → compiled to `main.js`  
**Architecture**: TypeScript + Svelte 4.2.20 with reactive state management  
**Release Artifacts**: `main.js`, `manifest.json`, `styles.css`

## Current Implementation Status

## Current Implementation Status

### ✅ **Completed Features**
- **Unified Dashboard**: 6-tab interface (Overview, Transactions, Balance Sheet, Accounts, Commodities, Journal)
- **Enhanced Entry Management**: Unified modal system with tabs for transactions, balance assertions, and notes
- **Full CRUD Operations**: Create, read, update, delete with confirmation dialogs and automatic backups
- **Commodities Management**: Full price tracking, metadata management, simplified Yahoo Finance integration ⭐ **ENHANCED**
- **Yahoo Finance Symbol Search**: Streamlined symbol lookup with direct links to major financial websites ⭐ **NEW**
- **Optimized Grid Layouts**: Compact, content-appropriate card layouts for better screen utilization ⭐ **IMPROVED**
- **Journal Tab**: Complete Beancount entry viewing with inline editing capabilities
- **Auto-starting Backend**: Python Flask API with automatic process management
- **Account Hierarchy**: Interactive account tree with balance drilldown
- **Multi-Currency Support**: Proper currency formatting and conversion
- **Search & Filtering**: Real-time search across all data types with server-side filtering
- **Responsive Design**: Mobile-friendly responsive layouts with accessibility improvements
- **BQL Code Blocks**: Native Beancount Query Language integration with live results ⭐ **NEW**
- **Inline BQL Queries**: Live financial data embedded directly in text with `bql:query` syntax ⭐ **NEW**
- **Template Shorthand System**: User-defined shortcuts with `bql-sh:SHORTHAND` syntax ⭐ **NEW**
- **Template File Management**: No built-in defaults, all shortcuts from customizable template files ⭐ **NEW**

### 🏗️ **Architecture**

#### **File Structure**
```
src/
  main.ts                     # Plugin lifecycle, command registration (no hardcoded hotkeys)
  settings.ts                 # Configuration interface, Beancount connection
  backend/
    BackendManager.ts         # Auto-starting Python backend management
    journal_api.py           # Flask REST API for complete Beancount data access
  components/
    CardComponent.svelte      # Reusable card component
    ChartComponent.svelte     # Chart visualization component
    DropdownItem.svelte       # Dropdown menu items
    HierarchicalDropdown.svelte # Hierarchical account selector
    TransactionEditModal.svelte # Unified entry modal (transactions, balance, notes) ⭐ ENHANCED
    UnifiedTransactionModal.ts # Modal controller for all entry types ⭐ NEW
    YahooFinanceSearchComponent.svelte # Simplified Yahoo Finance symbol search ⭐ NEW
    BQLCodeBlockProcessor.ts  # BQL code block processor for live query results ⭐ NEW
    InlineBQLProcessor.ts     # Inline BQL processor for embedding live financial data ⭐ NEW
    tabs/
      OverviewTab.svelte      # Financial overview with charts
      TransactionsTab.svelte  # Transaction browser with filtering
      BalanceSheetTab.svelte  # Balance sheet reporting
      AccountsTab.svelte      # Account hierarchy explorer
      CommoditiesTab.svelte   # Commodity & price management ⭐ ENHANCED
      JournalTab.svelte       # Complete Beancount entry management ⭐ ENHANCED
  controllers/
    OverviewController.ts     # Overview data & state management
    TransactionController.ts  # Transaction operations & filtering
    BalanceSheetController.ts # Balance sheet logic
    AccountsController.ts     # Account hierarchy management
    CommoditiesController.ts  # Commodity data & price tracking
    JournalController.ts      # Complete journal entry CRUD operations ⭐ ENHANCED
  queries/
    index.ts                  # BQL query functions for all operations
  types/                      # TypeScript type definitions for all entry types
  utils/
    index.ts                  # Utility functions (parsing, formatting)
    shorthandParser.ts        # Template file parser for BQL shortcuts ⭐ NEW
  views/
    sidebar-view.ts           # Legacy sidebar implementation
    SidebarView.svelte        # Sidebar Svelte component
    unified-dashboard-view.ts # Main dashboard view controller
    UnifiedDashboardView.svelte # Main dashboard UI ⭐ MAIN INTERFACE
```
  views/
    sidebar-view.ts           # Legacy sidebar implementation
    SidebarView.svelte        # Sidebar Svelte component
    unified-dashboard-view.ts # Main dashboard view controller
    UnifiedDashboardView.svelte # Main dashboard UI ⭐ MAIN INTERFACE
```

## Environment & Tooling

### **Core Stack**
- **Node.js**: LTS (18+)
- **Package Manager**: npm (required for build scripts)
- **Bundler**: esbuild (configured in `esbuild.config.mjs`)
- **Framework**: Svelte 4.2.20 with TypeScript
- **Types**: Obsidian API type definitions

### **Development Commands**
```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Linting (optional)
npm run lint
```

### **Key Technologies**
- **Svelte Stores**: Reactive state management across components
- **BQL Integration**: Direct Beancount Query Language execution
- **TypeScript**: Strict type checking enabled
- **CSS Variables**: Obsidian theme integration
- **Responsive Design**: Mobile-first approach

## Recent Major Updates

### **Complete BQL Integration System** ⭐ **LATEST**

#### **BQL Code Blocks**
- **BQLCodeBlockProcessor.ts**: Complete code block processor for executing BQL queries directly in notes
- **Live Query Results**: Automatic execution and formatted table display of Beancount Query Language statements
- **Interactive Features**: Refresh, copy, and export functionality with collapsible query display
- **Obsidian-Native Workflow**: Perfect integration with note-taking using familiar code block syntax
- **Template Command**: "Insert BQL Query Block" command for quick query template insertion
- **Professional Styling**: Comprehensive CSS styling with responsive design and proper table formatting
- **Error Handling**: Graceful error display with fallback to raw CSV output

#### **Inline BQL Queries** ⭐ **LATEST**
- **InlineBQLProcessor.ts**: DOM-based processor for inline financial data embedding
- **Dual Syntax Support**: Direct queries (`bql:SELECT...`) and shortcuts (`bql-sh:WORTH`)
- **Template File System**: User-defined shortcuts in markdown template files with `bql-shorthand` code blocks
- **ShorthandParser.ts**: Robust parser for reading shortcuts from markdown template files
- **No Built-in Defaults**: Complete template-only approach for maximum user control
- **Real-time Processing**: Live financial values embedded directly in text
- **Smart Caching**: 30-second cache refresh for template file changes
- **Error Handling**: Clear error messages with helpful tooltips showing available shortcuts

### **Usage Examples**:

#### **BQL Code Blocks:**
```markdown
## Account Balances
​```bql
SELECT account, sum(position) GROUP BY account ORDER BY account
​```

## Recent Transactions  
​```bql
SELECT date, payee, narration ORDER BY date DESC LIMIT 10
​```
```

#### **Inline BQL Integration:**
```markdown
# Daily Financial Journal - November 8, 2025

Today I spent `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND date = TODAY()` on various expenses.

My current financial position:
- **Net Worth**: `bql-sh:WORTH`
- **Checking Balance**: `bql-sh:CHECKING`  
- **Savings**: `bql-sh:SAVINGS`
- **Emergency Fund**: `bql-sh:EMERGENCY_FUND`

This month's spending is at `bql-sh:EXPENSES_MTD` out of my `bql-sh:BUDGET_LIMIT` budget.

## Investment Performance
My portfolio is worth `bql-sh:INVESTMENTS` with a YTD return of `bql-sh:INVESTMENT_RETURN_YTD`.
```

#### **Template File Example:**
```markdown
# BQL Shortcuts Template

## WORTH: Total net worth in USD
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'
```

## CHECKING: Checking account balance
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking'
```

## EXPENSES_MTD: Month-to-date expenses
```bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Expenses' AND YEAR(date) = YEAR(TODAY()) AND MONTH(date) = MONTH(TODAY())
```
```

### **Simplified Yahoo Finance Integration** ⭐ **LATEST**
- **YahooFinanceSearchComponent.svelte**: Clean, simplified component with direct website links
- **No API Dependencies**: Removed complex API calls, CORS handling, and error management
- **Financial Website Links**: Direct access to Yahoo Finance, Google Finance, Bloomberg, MarketWatch, Investing.com, and Morningstar
- **Symbol Examples**: Pre-populated common stocks, ETFs, and cryptocurrency symbols organized by category
- **Manual Symbol Entry**: Simple text input for any ticker symbol with real-time metadata preview
- **User-Friendly Workflow**: Users research symbols on professional sites and configure price sources manually

### **Optimized Grid Layouts** ⭐ **NEW**
- **Commodities Tab**: Reduced card minimum width from 280px to 220px, optimized padding and spacing
- **Compact Cards**: Removed fixed minimum heights, content now auto-sizes appropriately
- **Yahoo Finance Modal**: Improved website buttons (280px → 220px) and symbol examples (180px → 140px)
- **Mobile Responsive**: Better utilization of screen space on all devices
- **Visual Improvements**: Tighter spacing, smaller gaps, and more content-appropriate sizing

### **Yahoo Finance Integration Enhancement** ⭐
- **YahooFinanceSearchComponent.svelte**: Simple, practical component with direct financial website access
- **Financial Website Integration**: One-click access to major financial data sources for symbol lookup
- **Pre-populated Examples**: Common stocks (AAPL, GOOGL, MSFT), ETFs (SPY, QQQ, VTI), crypto (BTC-USD, ETH-USD)
- **Manual Symbol Configuration**: Easy text input with real-time Beancount metadata preview
- **No External Dependencies**: Eliminated API keys, rate limits, and CORS complications
- **User-Controlled Research**: Professional financial websites for accurate, up-to-date symbol information

### **Grid Layout Optimizations** ⭐
- **CommoditiesTab.svelte**: Compact commodity cards with optimized spacing and content-appropriate sizing
- **Reduced Card Sizes**: Minimum widths reduced (280px → 220px) with dynamic height adjustment
- **Improved Spacing**: Tighter gaps (16px → 12px) and padding (16px → 12px) for better space utilization
- **Mobile Enhancements**: Consistent gap sizes and responsive grid adjustments
- **Visual Polish**: Better content flow and reduced whitespace while maintaining readability

### **Recent Major Updates**

#### **Complete Inline BQL System** ⭐ **LATEST**
- **Template-Only Architecture**: Removed all built-in shorthand defaults for complete user control
- **Dual Query Modes**: Code blocks for detailed analysis, inline queries for embedded values
- **Advanced Template System**: User-defined shortcuts with automatic file path resolution
- **Clean Production Code**: Removed all debug console.log statements for silent operation
- **Professional UX**: Enhanced error messages with helpful tooltips and guidance
- **File Picker Enhancement**: Sophisticated autocomplete and browse functionality for template files

#### **Previous Operations Summary**
- **Yahoo Finance Simplification**: Completely redesigned Yahoo Finance integration to remove API complexity
- **Grid Layout Optimization**: Enhanced both CommoditiesTab and YahooFinanceSearchComponent layouts
- **Card Size Optimization**: Reduced minimum widths and heights for more content-appropriate sizing
- **Mobile Responsiveness**: Improved mobile layouts with better space utilization
- **Build System**: Fixed Svelte compilation issues and maintained clean build process
- **Documentation Updates**: Comprehensive README and AGENTS.md updates reflecting all improvements

### **Backend Architecture** ⭐
- **BackendManager.ts**: Auto-starting Python backend with WSL support
- **journal_api.py**: Complete Flask REST API with entry type validation
- **Process Management**: Automatic start/stop, health checking, and reconnection
- **Error Recovery**: Graceful handling of backend failures with user feedback
- **Port Management**: Configurable port handling for development and production

### **Command System Updates**
- **No Hardcoded Hotkeys**: Removed predefined keyboard shortcuts from commands
- **User Customizable**: Users can set their own preferred hotkeys in Obsidian settings
- **Clean Command Palette**: Commands appear without confusing hotkey indicators

### **Code Quality Improvements**
- **Build Warnings**: Maintained at 28 non-blocking accessibility warnings
- **Single Style Tags**: Fixed Svelte component style tag issues for proper compilation
- **Grid Layout Optimizations**: Enhanced visual density while maintaining accessibility
- **TypeScript Strict**: Full strict mode compliance with comprehensive type definitions
- **Error Handling**: Graceful degradation for missing data and backend failures
- **Mobile Responsiveness**: Consistent responsive design patterns across all components

## File & Folder Conventions

### **Current Project Structure**
```
src/
  main.ts                   # Plugin lifecycle, registers commands and views
  settings.ts               # Beancount connection settings and validation
  
  components/               # Reusable Svelte components
    tabs/                   # Tab-specific components
      CommoditiesTab.svelte # Commodity management with price tracking
      OverviewTab.svelte    # Financial overview with charts
      TransactionsTab.svelte # Transaction browser with filtering
      AccountsTab.svelte    # Account hierarchy explorer
      BalanceSheetTab.svelte # Balance sheet reporting
    CardComponent.svelte    # Reusable card layout
    ChartComponent.svelte   # Chart visualization wrapper
    TransactionForm.svelte  # Transaction entry form
    
  controllers/              # Business logic and state management
    CommoditiesController.ts # Commodity data with Svelte stores
    OverviewController.ts    # Dashboard metrics and charts
    TransactionController.ts # Transaction CRUD operations
    AccountsController.ts    # Account hierarchy management
    BalanceSheetController.ts # Balance sheet calculations
    
  queries/                  # BQL query definitions
    index.ts               # All Beancount Query Language functions
    
  views/                    # Obsidian view implementations
    unified-dashboard-view.ts # Main dashboard controller
    UnifiedDashboardView.svelte # Main dashboard UI
    sidebar-view.ts        # Legacy sidebar (maintained for compatibility)
    
  types/                    # TypeScript type definitions
  utils/                    # Utility functions and helpers
```

### **Best Practices Implemented**
- ✅ **Controller Pattern**: Business logic separated from UI components
- ✅ **Reactive State**: Svelte stores for real-time data updates
- ✅ **Type Safety**: Comprehensive TypeScript interfaces
- ✅ **Component Reusability**: Shared components across tabs
- ✅ **Clean Architecture**: Clear separation of concerns

### **Build Configuration**
- **Entry Point**: `src/main.ts` compiles to `main.js`
- **Bundle Target**: Single `main.js` file with all dependencies
- **CSS Processing**: Svelte styles bundled with components
- **TypeScript**: Strict mode enabled with comprehensive type checking

## Current Manifest Configuration

### **Key Properties**
```json
{
  "id": "obsidian-finance-plugin",
  "name": "Finance Plugin",
  "version": "0.0.1",
  "minAppVersion": "0.15.0",
  "description": "Comprehensive financial dashboard with Beancount integration",
  "author": "Mukund Shelake",
  "isDesktopOnly": true
}
```

### **Desktop-Only Features**
- **External Process Execution**: Calls `bean-query` and `bean-price` commands
- **File System Access**: Reads/writes Beancount files outside vault
- **WSL Support**: Windows Subsystem for Linux compatibility
- **Command-line Integration**: Direct Beancount tool execution

## Testing & Development

### **Local Development Setup**
1. **Install in Development Vault**:
   ```bash
   # Copy built files to vault
   cp main.js manifest.json styles.css <vault>/.obsidian/plugins/obsidian-finance-plugin/
   ```

2. **Development Workflow**:
   ```bash
   # Watch mode for development
   npm run dev
   
   # Hot reload: Ctrl+Shift+R in Obsidian after changes
   ```

3. **Test Data Requirements**:
   - Valid Beancount file with sample data
   - Configured `bean-query` and `bean-price` tools
   - Test commodities with price metadata

### **Manual Testing Checklist**
- ✅ All 5 tabs load without errors
- ✅ Commodity price display with currency formatting
- ✅ Transaction filtering and search functionality
- ✅ Account hierarchy navigation
- ✅ Modal accessibility and keyboard navigation
- ✅ Responsive layout on different screen sizes

## Commands & Settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & Releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, Privacy, and Compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & Copy Guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding Conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent Do/Don't

**Do**
- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**
- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common Tasks

### Organize Code Across Multiple Files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a Command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist Settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register Listeners Safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`. 
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**
- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**
- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`. 
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
