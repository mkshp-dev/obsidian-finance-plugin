# 🔧 Inline BQL Debug

## Issue Analysis

**Your Query Had Extra Quote**:
- ❌ Wrong: `bql:'SELECT sum(CONVERT(position, 'INR')) FROM postings WHERE account ~ '^Assets' and currency ~'INR'`
- ✅ Correct: `bql:SELECT sum(CONVERT(position, 'INR')) FROM postings WHERE account ~ '^Assets' and currency ~'INR'`

**Corrected Query**: `bql:SELECT sum(CONVERT(position, 'INR')) FROM postings WHERE account ~ '^Assets' and currency ~'INR'`

## Simple Debug Tests

1. **Basic String**: `bql:SELECT 'Hello World'`
2. **Simple Number**: `bql:SELECT 123.45`
3. **Account Test**: `bql:SELECT account LIMIT 1`

## Asset Queries

4. **Without FROM**: `bql:SELECT sum(CONVERT(position, 'INR')) WHERE account ~ '^Assets'`
5. **With FROM postings**: `bql:SELECT sum(CONVERT(position, 'INR')) FROM postings WHERE account ~ '^Assets'`
6. **Currency filter**: `bql:SELECT sum(CONVERT(position, 'INR')) WHERE account ~ '^Assets' AND currency ~ 'INR'`

## Liability Queries  

7. **Your Working Query**: `bql:SELECT sum(CONVERT(position, 'INR')) FROM postings WHERE account ~ '^Liabilities' and currency ~'INR'`

---

## Debug Instructions

1. **Open Browser Console** (F12 in most browsers)
2. **Look for logs** starting with `InlineBQL:`
3. **Check if processor is being called** at all
4. **If no logs appear**, the processor isn't being registered properly
5. **If logs appear but queries fail**, check the query syntax

---

## Expected Behavior

- **Loading**: Shows ⟳ while processing
- **Success**: Shows formatted value (e.g., ₹117,260.93)
- **Error**: Shows ❌ with tooltip containing error details
- **Hover**: Tooltip shows the original BQL query

---

## Common Issues

- **Extra quotes**: Remove any quotes around the SELECT statement
- **Query syntax**: Try with and without `FROM postings`
- **Processor not loaded**: Check console for registration errors
- **BQL syntax**: Ensure your query works in terminal first