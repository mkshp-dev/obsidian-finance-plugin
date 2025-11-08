# BQL Template File System - Complete Guide

This new system replaces the complex in-settings shorthand management with a simple, user-friendly template file approach.

## 🎯 **What Changed**

### ❌ **Old System (Removed)**
- Complex modal dialogs in settings for editing shortcuts
- All shortcuts stored in plugin settings JSON
- Required plugin restart to see changes
- Cumbersome UI for managing shortcuts

### ✅ **New System (Much Better!)**
- Simple template file path in settings
- Edit shortcuts in familiar Obsidian markdown environment
- Syntax highlighting and autocomplete
- Live reloading (shortcuts refresh every 30 seconds)
- Easy backup, sharing, and version control

## 🚀 **How to Use**

### 1. **Set Template File Path**
1. Go to **Settings → Community Plugins → Finance Plugin**
2. Find **"BQL Shortcuts Template"** section
3. Enter path to your template file (e.g., `/home/user/BQL_Shortcuts.md`)
4. Click **"Create Template"** to generate a default file

### 2. **Edit Your Shortcuts**
Open your template file in Obsidian and edit shortcuts using this format:

```markdown
## SHORTCUT_NAME: Description
```bql-shorthand
SELECT your_query_here
```
```

### 3. **Use in Notes**
Use `bql-sh:SHORTCUT_NAME` in your notes to insert live financial data.

## 📝 **Template File Format**

The template file uses markdown with special `bql-shorthand` code blocks:

```markdown
# My BQL Shortcuts

## WORTH: Total worth across all accounts
```bql-shorthand
SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account ~ '^Assets' AND date = TODAY()
```

## CHECKING: Current checking account balance
```bql-shorthand
SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account ~ '^Assets:Checking' AND date = TODAY()
```

## RENT_BUDGET: Budget allocated for rent
```bql-shorthand
SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account = 'Assets:Budget:Rent' AND date = TODAY()
```
```

## 🎨 **Template File Benefits**

### **1. Native Obsidian Experience**
- Full markdown editor with syntax highlighting
- Autocomplete and IntelliSense
- Familiar editing environment
- Easy formatting and organization

### **2. Easy Management**
- Add shortcuts: Just add a new section
- Edit shortcuts: Modify the query in place
- Delete shortcuts: Remove the section
- Organize with headings, comments, and documentation

### **3. Collaboration & Backup**
- Version control with git
- Easy sharing with team members
- Simple backup (just copy the file)
- Template reuse across multiple vaults

### **4. Live Updates**
- Changes refresh automatically (30-second cache)
- No need to restart Obsidian
- Real-time testing and iteration

## 📋 **Default Shortcuts Included**

When you create a template file, these shortcuts are included:

| Shortcut | Description | Usage |
|----------|-------------|-------|
| `WORTH` | Total worth across all accounts | `bql-sh:WORTH` |
| `ASSETS` | Total assets | `bql-sh:ASSETS` |
| `LIABILITIES` | Total liabilities | `bql-sh:LIABILITIES` |
| `NETWORTH` | Net worth (assets - liabilities) | `bql-sh:NETWORTH` |
| `CHECKING` | Checking account balance | `bql-sh:CHECKING` |
| `SAVINGS` | Savings account balance | `bql-sh:SAVINGS` |
| `INVESTMENT` | Investment account balance | `bql-sh:INVESTMENT` |
| `CASH` | Combined cash accounts | `bql-sh:CASH` |
| `INCOME_MTD` | Income month-to-date | `bql-sh:INCOME_MTD` |
| `EXPENSE_MTD` | Expenses month-to-date | `bql-sh:EXPENSE_MTD` |
| `BUDGET_REMAINING` | Budget remaining this month | `bql-sh:BUDGET_REMAINING` |

## 💡 **Usage Examples**

### **Daily Journal**
```markdown
## Financial Check - November 6, 2025

Today's summary:
- Current worth: `bql-sh:WORTH`
- Available cash: `bql-sh:CASH`
- Investment portfolio: `bql-sh:INVESTMENT`

Monthly progress:
- Income this month: `bql-sh:INCOME_MTD`
- Spent this month: `bql-sh:EXPENSE_MTD`
- Budget remaining: `bql-sh:BUDGET_REMAINING`
```

### **Budget Tracking**
```markdown
## Budget Review

### Housing
- Rent budget: `bql-sh:RENT_BUDGET`
- Utilities budget: `bql-sh:UTILITIES_BUDGET`

### Goals
- Emergency fund: `bql-sh:EMERGENCY_FUND`
- Vacation savings: `bql-sh:VACATION_FUND`
```

## 🔧 **Advanced Customization**

### **Custom Shortcut Examples**

Add these to your template file for specialized tracking:

```markdown
## RENT_BUDGET: Budget allocated for rent
```bql-shorthand
SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account = 'Assets:Budget:Rent' AND date = TODAY()
```

## EMERGENCY_FUND: Emergency fund balance
```bql-shorthand
SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account = 'Assets:Savings:Emergency' AND date = TODAY()
```

## LAST_MONTH_INCOME: Previous month's income
```bql-shorthand
SELECT sum(CONVERT(position, 'USD')) FROM close_positions WHERE account ~ '^Income' AND YEAR(date) = YEAR(TODAY()) AND MONTH(date) = MONTH(TODAY()) - 1
```

## TOP_EXPENSES: Top 5 expense categories this month
```bql-shorthand
SELECT account, sum(CONVERT(position, 'USD')) FROM close_positions WHERE account ~ '^Expenses' AND YEAR(date) = YEAR(TODAY()) AND MONTH(date) = MONTH(TODAY()) GROUP BY account ORDER BY sum(position) DESC LIMIT 5
```
```

## 🚀 **Migration from Old System**

If you were using the old shorthand system:

1. **Check your current shortcuts** in plugin settings (they'll be read-only now)
2. **Create a new template file** using the "Create Template" button
3. **Copy any custom shortcuts** from the old system to your template file
4. **Test the new shortcuts** with `bql-sh:SHORTCUT_NAME`
5. **Enjoy the improved experience!**

## ✨ **Why This is Better**

✅ **User-Friendly**: Edit in familiar Obsidian environment  
✅ **No More Modals**: No clunky popup dialogs  
✅ **Live Reloading**: Changes take effect automatically  
✅ **Version Control**: Easy backup and collaboration  
✅ **Organized**: Group and document your shortcuts  
✅ **Flexible**: Easy to add, edit, and remove shortcuts  
✅ **Portable**: Share templates across vaults  

**Result**: A much cleaner, more maintainable, and user-friendly shorthand system! 🎉