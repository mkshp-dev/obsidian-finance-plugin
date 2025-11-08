# BQL Shortcuts Template

This file defines your custom BQL shortcuts for inline use.

## Shortcut Format
Each shortcut is defined in a code block with the pattern:
```
## SHORTCUT_NAME: Description
```bql-shorthand
YOUR_BQL_QUERY_HERE
```

## WORTH: My total worth in INR
```bql-shorthand
SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets' and currency ~'INR'
```

## ASSETS: Total assets in INR
```bql-shorthand
SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets' and currency ~'INR'
```
```