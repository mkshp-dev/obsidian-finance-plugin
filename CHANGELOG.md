6# Changelog

All notable changes to the Obsidian Finance Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-22

### 🚀 **Major Architecture Overhaul**

This is a **breaking release** that fundamentally changes the plugin architecture, removing the Python backend entirely for a simpler, more reliable design.

### Changed 🔄 **BREAKING CHANGES**

#### **Complete Backend Removal**
- **Removed Python Flask Backend**: Eliminated the auto-starting Python server (`journal_api.py`)
- **Direct CLI Integration**: All operations now use direct `bean-query` execution
- **No API Layer**: Removed HTTP API client and backend process management
- **Simpler Dependencies**: No longer requires Flask, flask-cors, or virtual environment setup

#### **New Pure TypeScript Architecture**
- **BQL-Only Queries**: All data retrieval via direct Beancount Query Language execution
- **Atomic File Operations**: Direct file reads/writes with backup support
- **Client-Side Processing**: All filtering and processing done in TypeScript
- **Improved Reliability**: No server startup delays or connection issues

### Added ⭐ **NEW FEATURES**

#### **Direct File CRUD Operations**
- **New Transaction Functions**: `updateTransaction()` with proper header detection (scans backward from posting lines)
- **Balance Operations**: `updateBalance()`, `deleteBalance()` with correct BQL queries using `#entries` table
- **Note Operations**: `updateNote()`, `deleteNote()` with proper entry type filtering
- **Smart Line Detection**: Automatic scanning to find transaction boundaries preserving formatting

#### **Enhanced Testing**
- **3-Command Test Suite**: Bean Check, Bean Query, Bean Query CSV (removed backend test)
- **Streamlined Validation**: Faster, simpler command testing without server dependencies

### Fixed 🐛 **BUG FIXES**

#### **Transaction Editing**
- **Fixed Duplicate Headers**: Transaction edits now properly replace entire transaction instead of creating duplicate header lines
- **Proper Line Detection**: BQL queries return posting lines, code now scans backward to find transaction headers
- **Complete Replacement**: Full transaction block (header + all postings) replaced atomically

#### **BQL Query Corrections**
- **Fixed Balance Queries**: Changed from non-existent `#balances` table to `#entries` with `type='balance'` filter
- **Fixed Note Queries**: Changed from non-existent `#notes` table to `#entries` with `type='note'` filter
- **Proper Column Access**: Updated queries to use `filename` and `lineno` columns from `#entries` table

### Removed 🗑️ **DEPRECATED**

#### **Backend Infrastructure**
- Removed `src/backend/journal_api.py` (1673 lines)
- Removed `src/core/backend-process.ts` (289 lines)
- Removed `src/api/client.ts` (116 lines)
- Removed `src/api/endpoints.ts` (16 lines)
- Removed backend API methods from `JournalService`
- Removed backend startup/management code from `main.ts`
- Removed Flask dependency from requirements

#### **Settings & UI**
- Removed backend testing from Connection settings
- Removed backend status indicators
- Removed API connection monitoring
- Updated documentation to reflect new architecture

### Migration Guide

For users upgrading from v1.x:

1. **No Action Required**: The plugin will automatically use direct CLI execution
2. **Dependencies**: Only Beancount CLI tools needed (`bean-query`, `bean-check`, `bean-price`)
3. **Performance**: May notice slightly slower initial queries (no caching), but more reliable
4. **Functionality**: All features work identically, just via different implementation

### Benefits of New Architecture

- ✅ **Simpler Setup**: No Python backend to configure or troubleshoot
- ✅ **More Reliable**: No server startup failures or connection issues
- ✅ **Faster Startup**: Plugin loads instantly without waiting for backend
- ✅ **Smaller Footprint**: ~2000 lines of code removed
- ✅ **Easier Debugging**: All operations visible in Developer Console
- ✅ **Cross-Platform**: Better WSL support without HTTP layer complications

## [1.0.0-beta.1] - 2025-11-10

### 🚀 **Beta Release - Feature Complete**

This release introduces critical debugging tools and a smooth onboarding experience for new users.

### Added ⭐ **NEW FEATURES**

#### **Debug Mode**
- **Toggleable Debugging**: New settings option to enable/disable detailed logging.
- **Granular Logs**: Detailed console logs for API calls, state changes, and UI events when enabled.
- **Clean Console**: Production environment stays clean by default.

#### **Onboarding Experience**
- **Welcome Modal**: Auto-detection of unconfigured settings on startup.
- **Demo Ledger Generator**: One-click creation of a fully functional example Beancount file (`example.beancount`) with Assets, Liabilities, Income, Expenses, and ~12 sample transactions.
- **Smart Configuration**: Options to browse for existing files or start fresh with the demo.

## [1.0.0] - 2025-11-09

### Added ⭐ **NEW FEATURES**

#### **Connection Validation & Testing System**
- **4-Command Testing Suite**: Comprehensive validation for Bean Check, Bean Query, Bean Query CSV, and Backend API Server
- **Professional Testing Interface**: Individual test buttons with real-time status indicators (⭕ pending, 🔄 running, ✅ success, ❌ failed)
- **Batch Testing**: "Test All Commands" button for comprehensive system validation
- **Transparent Command Display**: Shows exactly what commands will be executed for debugging
- **Cross-Platform Path Handling**: Automatic Windows/WSL path format conversion with proper separators
- **Backend Validation Mode**: --validate-only flag implementation for non-hanging Flask server testing

#### **Enhanced User Experience**
- **Streamlined Settings**: Clean, focused settings panel without system status clutter
- **Command Customization**: Removed hardcoded hotkeys - users can set their own preferred shortcuts
- **Professional Error Handling**: Enhanced error messages with helpful guidance
- **Cross-Platform Compatibility**: Robust support for Windows, WSL, macOS, and Linux environments

### Improved ⭐ **ENHANCEMENTS**

#### **Settings Interface Cleanup**
- **Removed System Status Section**: Eliminated LED status indicators and diagnostic panel for cleaner UI
- **Removed Debug Sections**: Completely removed "Debug & System Commands" and command debug modal
- **Clean Settings Flow**: Settings now start directly with Connection panel
- **Focused Configuration**: Only actionable settings visible, no status information clutter

#### **Backend Stability**
- **Non-hanging Validation**: Backend testing no longer hangs with --validate-only flag
- **Proper Exit Codes**: Backend returns appropriate exit codes (0=success, 1=failure) for testing
- **Unicode Compatibility**: Replaced Unicode characters with ASCII for Windows console compatibility
- **Error Recovery**: Improved error handling and recovery mechanisms

### Fixed 🐛 **BUG FIXES**

#### **Cross-Platform Issues**
- **Windows Path Handling**: Fixed mixed path separator issues for Windows native setups
- **WSL Path Conversion**: Proper conversion between Windows and WSL path formats
- **Console Encoding**: Fixed Unicode encoding errors on Windows systems
- **Path Format Consistency**: Environment-specific path construction

### Removed 🗑️ **DEPRECATED**
- **System Status Panel**: LED indicators, refresh button, diagnostic information
- **Debug & System Commands**: Command audit panel and debug modal functionality
- **Status Update Calls**: Automatic status refresh functionality
- **Hardcoded Command Hotkeys**: Users now set their own keyboard shortcuts

## [0.1.0] - 2025-11-08

### Added ⭐ **MAJOR FEATURES**

#### Inline BQL System
- **Inline BQL Queries**: Embed live financial data directly in text using `bql:query` syntax
- **Shorthand System**: Create custom shortcuts like `bql-sh:WORTH` for frequently used queries
- **Template File Management**: User-defined shortcuts in markdown template files
- **Template File Picker**: Sophisticated autocomplete and browse interface for template selection
- **Dual Query Modes**: Code blocks for detailed analysis, inline queries for embedded values
- **Real-time Processing**: Live financial values update automatically
- **Smart Caching**: 30-second cache refresh for template file changes
- **Error Handling**: Clear error messages with helpful tooltips and available shortcuts

#### Enhanced User Experience
- **Template-Only Architecture**: Removed all built-in shorthand defaults for complete user control
- **Clean Production Code**: Removed debug console.log statements for silent operation
- **Professional Error Messages**: Enhanced tooltips and guidance for missing shortcuts
- **File Path Resolution**: Automatic relative-to-absolute path conversion for template files

### Enhanced ⭐ **IMPROVEMENTS**

#### Yahoo Finance Integration
- **Simplified Symbol Search**: Removed API complexity, added direct links to major financial websites
- **Financial Website Integration**: One-click access to Yahoo Finance, Google Finance, Bloomberg, MarketWatch, Investing.com, and Morningstar
- **Symbol Examples Library**: Pre-populated examples for popular stocks, ETFs, and cryptocurrencies
- **Manual Configuration**: Easy text input with real-time metadata preview
- **No API Dependencies**: Eliminated API keys, rate limits, and CORS complications

#### Grid Layout Optimization
- **Compact Commodity Cards**: Reduced minimum widths (280px → 220px) for better space utilization
- **Content-Appropriate Sizing**: Dynamic height adjustment based on content
- **Improved Spacing**: Tighter gaps (16px → 12px) and padding optimization
- **Mobile Responsiveness**: Enhanced mobile layouts with consistent responsive design

#### BQL Code Blocks
- **Enhanced Styling**: Professional CSS with responsive design and proper table formatting
- **Interactive Controls**: Refresh, copy, and export functionality with collapsible query display
- **Error Recovery**: Graceful error display with fallback to raw CSV output

### Fixed
- **Svelte Compilation**: Fixed build warnings and maintained clean compilation
- **Path Resolution**: Proper handling of relative and absolute paths for template files
- **CSS Scoping**: All BQL-related CSS properly scoped to avoid conflicts
- **Console Output**: Clean, silent operation without debug spam

## Previous Releases

### [0.0.1] - Initial Release

#### Core Features
- **Unified Dashboard**: 6-tab interface (Overview, Transactions, Balance Sheet, Accounts, Commodities, Journal)
- **Transaction Management**: Full CRUD operations with unified modal system
- **Account Hierarchy**: Interactive tree view with balance drilldown
- **Auto-starting Backend**: Python Flask API with automatic process management
- **BQL Code Blocks**: Native Beancount Query Language integration
- **Multi-Currency Support**: Proper currency formatting and conversion
- **Responsive Design**: Mobile-friendly layouts with accessibility improvements

---

## Migration Notes

### Upgrading to Inline BQL System

If you were using the plugin before the inline BQL system:

1. **No Breaking Changes**: Existing BQL code blocks continue to work unchanged
2. **New Features**: Inline BQL and shorthand system are additive enhancements
3. **Template Files**: Create template files to use the new shorthand system
4. **Settings**: Configure template file path in plugin settings

### Benefits of Template-Only Approach

- **Complete Control**: Define exactly the shortcuts you need
- **No Conflicts**: No built-in defaults to override or conflict with
- **Customization**: Use your preferred currencies, account patterns, and naming
- **Clarity**: Single source of truth for all shortcuts

---

## Upcoming Features

- **Enhanced BQL Functions**: Additional query helpers and formatting options
- **Template Sharing**: Community templates for common financial setups
- **Advanced Charts**: More visualization options for financial data
- **Export Enhancements**: Additional export formats and scheduling
- **Mobile App**: Companion mobile app for transaction entry

---

*For detailed usage instructions, see README.md and BQL_Integration_Examples.md*