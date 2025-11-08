# Test New BQL Syntax

## Direct BQL Queries
My total assets: `bql:SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account ~ '^Assets' AND date = TODAY()`

## BQL Shortcuts
- My worth: `bql-sh:WORTH`
- Total assets: `bql-sh:ASSETS`
- Checking balance: `bql-sh:CHECKING`
- Net worth: `bql-sh:NETWORTH`

## Usage Comparison

### Old problematic syntax (removed):
~~My worth is {{WORTH}}~~

### New safe syntax:
My worth is `bql-sh:WORTH`

## Why This is Better
✅ No conflicts with Obsidian templates  
✅ No conflicts with Dataview plugin  
✅ Clear, explicit syntax  
✅ Consistent with direct BQL queries  
✅ Safe for all Obsidian environments