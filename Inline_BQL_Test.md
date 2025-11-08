# Inline BQL Test

Testing inline BQL functionality.

## Corrected Syntax Tests

My current worth is `bql:SELECT sum(CONVERT(position, 'INR')) WHERE account ~ '^Assets'`

## Alternative Query Style

Total assets: # Inline BQL Testing - Correct Syntax

## ✅ **Correct Usage Examples**

### Direct BQL Queries (use single backticks)
- My current worth: `bql:SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets' and currency ~'INR'`
- Total assets: `bql:SELECT sum(CONVERT(position, 'INR')) WHERE account ~ '^Assets'`
- Checking balance: `bql:SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets:Checking'`

### BQL Shortcuts (use single backticks)
- My worth: `bql-sh:WORTH`
- Assets total: `bql-sh:ASSETS`
- Checking balance: `bql-sh:CHECKING`

### In Sentences
Today I have `bql:SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets:Checking' and currency ~'INR'` in my checking account, and my total worth is `bql-sh:WORTH`.

---

## ❌ **Wrong Usage (Won't Work)**

### Code Blocks (triple backticks) - These WON'T render inline
```bql:SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets' and currency ~'INR'
```

```bql-sh:WORTH
```

---

## 🔍 **Why Single Backticks?**

The inline BQL processor specifically looks for `<code>` elements in the DOM, which are created by single backticks in markdown. Triple backticks create `<pre><code>` blocks that are handled by the separate BQL code block processor.

## 🧪 **Testing Your Setup**

Try this simple test:

My test worth is `bql-sh:WORTH` and my checking balance is `bql:SELECT convert(sum(position), 'INR') WHERE account ~ '^Assets:Checking' and currency ~'INR'`.

If you see live values instead of the query text, your inline BQL is working!

---

## 📝 **Key Points**

1. **Single backticks** (`bql:query`) = Inline rendering with live values
2. **Triple backticks** (```bql) = Code blocks with table results
3. **Shortcuts** must be defined in your template file first
4. **Processing delay** may be 1-2 seconds for initial load

## Simple Tests

Test 1: `bql:SELECT 'Hello World'`

Test 2: `bql:SELECT 123.45`

Test 3: `bql:SELECT account LIMIT 1`

## With FROM postings

Assets with FROM: `bql:SELECT sum(CONVERT(position, 'INR')) FROM postings WHERE account ~ '^Assets'`

---

**Note**: The issue was the extra quote. Use:
- ✅ Correct: `bql:SELECT query here`
- ❌ Wrong: `bql:'SELECT query here'` (extra quote)