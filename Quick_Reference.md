# Finance Plugin Quick Reference

## 🚀 Getting Started

1. **Install Plugin**: Enable in Settings → Community Plugins
2. **Configure**: Settings → Plugin Options → Finance Plugin
3. **Set Beancount File**: Enter path to your `.beancount` file
4. **Open Dashboard**: Click 💰 icon or use Command Palette

---

## 📋 Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Add Beancount Transaction` | Open unified entry modal | Create transactions, balance assertions, notes |
| `Open Beancount Unified Dashboard` | Main dashboard with all tabs | Full financial management interface |
| `Open Beancount Snapshot` | Quick sidebar view | Rapid financial overview |
| `Insert BQL Query Block` | Insert BQL code block template | Quick BQL query insertion |

*Set custom hotkeys in Settings → Hotkeys → Finance Plugin*

---

## 🏷️ BQL Syntax Quick Reference

### Code Blocks
```markdown
​```bql
SELECT account, sum(position) GROUP BY account ORDER BY account
​```
```

### Inline Queries
```markdown
Net worth: `bql:SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'`
```

### Shorthand System
```markdown
Net worth: `bql-sh:WORTH`
```

---

## 📁 Tab Overview

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Overview** | Financial summary | Net worth, trends, key metrics |
| **Transactions** | Transaction browser | Search, filter, CRUD operations |
| **Balance Sheet** | Financial statements | Assets, liabilities, equity |
| **Accounts** | Account hierarchy | Tree view, balance drilldown |
| **Commodities** | Price management | Yahoo Finance integration |
| **Journal** | Complete ledger view | Full Beancount entries, editing |

---

## ⚙️ Template File Setup

1. **Create template file** (e.g., `BQL_Shortcuts.md`)
2. **Set path in settings**: Settings → Finance Plugin → BQL Shortcuts Template Path
3. **Use format**:
   ```markdown
   ## WORTH: My total worth
   ```bql-shorthand
   SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets'
   ```
   ```

---

## 🔧 Troubleshooting

### Backend Issues
- **Journal tab loading**: Ensure Python 3.8+ and `pip install beancount`
- **Path errors**: Check Beancount file path in settings
- **WSL users**: Enable WSL mode in plugin settings

### BQL Issues
- **Code blocks not working**: Check Beancount file path and permissions
- **Shortcuts not found**: Verify template file path and format
- **Query errors**: Validate BQL syntax in separate tool first

### Common Fixes
- **Reload plugin**: Disable/enable in Community Plugins
- **Check console**: F12 → Console for error messages
- **Update paths**: Use absolute paths for reliability

---

## 💡 Pro Tips

### Daily Workflow
1. Use **inline BQL** for journal entries: `bql-sh:WORTH`
2. Use **code blocks** for analysis and reports
3. Create **custom shortcuts** for frequently used queries
4. Set **hotkeys** for quick transaction entry

### Performance
- Keep template files small and focused
- Use specific account patterns in queries
- Cache refreshes every 30 seconds automatically

### Organization
- Group related shortcuts in template file
- Use descriptive shortcut names (WORTH, CHECKING, etc.)
- Comment your complex BQL queries

---

*For detailed documentation, see README.md and BQL_Integration_Examples.md*