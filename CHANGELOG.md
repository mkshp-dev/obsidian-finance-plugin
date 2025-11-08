# Changelog

All notable changes to the Obsidian Finance Plugin will be documented in this file.

## [Unreleased] - 2025-11-08

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
- **Template Command**: "Insert BQL Query Block" command for quick query insertion
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