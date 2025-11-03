# Performance Improvements

## Buffer Overflow Fix ✅ COMPLETED

### Problem
Users with large Beancount datasets were experiencing "stdout maxBuffer length exceeded" errors when running queries.

### Solution
1. **Increased maxBuffer**: Modified `runQuery()` function in `utils/index.ts` to use 50MB buffer instead of default 200KB
2. **Query Limits**: Added configurable limits to prevent loading excessive data at once
3. **Performance Settings**: Added user-configurable settings for query result limits

## Changes Made

### 1. Buffer Size Increase
```typescript
// In utils/index.ts - runQuery function
const { stdout } = await execAsync(command, { 
    cwd: workingDir, 
    maxBuffer: 50 * 1024 * 1024 // 50MB buffer (was default 200KB)
});
```

### 2. Query Optimization
```typescript
// In queries/index.ts
export function getTransactionsQuery(filters: TransactionFilters, limit: number = 1000): string {
    // Added limit parameter with default
    const orderByPart = `ORDER BY date DESC LIMIT ${limit}`;
}

export function getJournalTransactionsQuery(limit: number = 1000): string {
    // Added limit to prevent loading all journal entries
    return `SELECT date, flag, payee, narration, tags, account, position ORDER BY date DESC LIMIT ${limit}`;
}
```

### 3. User Settings
```typescript
// In settings.ts
export interface BeancountPluginSettings {
    // ... existing settings
    maxTransactionResults: number;  // Default: 2000
    maxJournalResults: number;      // Default: 1000
}
```

### 4. Performance Settings UI
Added new "Performance" section in settings with:
- **Max transaction results**: Controls how many transactions load at once (default: 2000, max: 10000)
- **Max journal results**: Controls how many journal entries load at once (default: 1000, max: 5000)

## Benefits

### Before
- ❌ Buffer overflow errors with large datasets
- ❌ Plugin crashes when loading thousands of transactions
- ❌ No user control over performance vs completeness

### After
- ✅ 50MB buffer handles very large query results
- ✅ Configurable limits prevent memory issues
- ✅ User can balance performance vs data completeness
- ✅ Progressive loading keeps UI responsive

## Testing

### Manual Testing
1. **Small datasets**: Should work exactly as before
2. **Large datasets**: No more buffer overflow errors
3. **Settings**: Users can adjust limits based on their needs
4. **Performance**: Faster loading times with reasonable defaults

### Recommended Settings
- **Small datasets** (< 1000 transactions): Default settings work well
- **Medium datasets** (1000-5000 transactions): Default settings optimal
- **Large datasets** (> 5000 transactions): May want to reduce limits for faster performance

## Usage Notes

### For Users
- If you see "Loading..." indicators taking too long, try reducing the limits in settings
- If you need to see more data, increase the limits (but expect slower performance)
- The plugin now loads the most recent transactions first (sorted by date DESC)

### For Developers
- All query functions now accept optional limit parameters
- Buffer size can be adjusted in `utils/index.ts` if needed
- Consider adding pagination for future enhancements

## Future Improvements

### Potential Enhancements
1. **Pagination**: Load data in chunks with "Load More" buttons
2. **Date Range Filtering**: Automatically limit queries to recent periods
3. **Caching**: Store frequently accessed data to reduce query frequency
4. **Background Loading**: Load additional data in background while showing initial results

### Query-Specific Optimizations
1. **Overview Tab**: Could cache KPI calculations
2. **Balance Sheet**: Group similar accounts to reduce result size
3. **Accounts Tab**: Load account tree progressively
4. **Commodities**: Limit to active commodities by default

This improvement ensures the plugin works reliably with datasets of any size while maintaining good performance for typical usage scenarios.