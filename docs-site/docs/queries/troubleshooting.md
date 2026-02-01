---
sidebar_position: 2
---

# Troubleshooting

This guide addresses common issues with connectivity, queries, and data display.

## 🔌 Connection Issues

### "bean-query: command not found"
- **Cause**: The plugin cannot find `bean-query` in your system's PATH.
- **Solution**: 
  1. Go to Settings → Connection Tab
  2. Click "Test All Commands" to see which commands fail
  3. If auto-detection fails, manually enter the absolute path to `bean-query`:
     - Windows: `C:\Python39\Scripts\bean-query.exe`
     - macOS/Linux: `/usr/local/bin/bean-query` or `~/.local/bin/bean-query`
     - WSL: `wsl bean-query`
  4. Click "Test Bean Query" to verify it works
- **Alternative**: Add Beancount's scripts directory to your system PATH

### "File not found" errors
- **Cause**: The Beancount file path in settings is incorrect or the file doesn't exist.
- **Solution**: Verify your **Beancount File Path** in Settings → Connection:
  - Windows: `C:\Users\YourName\Documents\finances.beancount`
  - macOS/Linux: `/home/username/finances.beancount`
  - WSL: `/mnt/c/Users/YourName/Documents/finances.beancount` (Linux-style path)
- **Test**: Use the "Test Bean Check" button to validate the file

### WSL Path Errors
- **Symptom**: Commands work but file operations fail on Windows when using WSL.
- **Cause**: Path format mismatch between Windows and WSL.
- **Solution**:
  - If your Beancount file is in Windows, use the WSL path format: `/mnt/c/Users/YourName/...`
  - The plugin automatically converts paths when executing commands
  - Verify in Settings → Connection that "WSL (Default)" is detected
  - Test with "Test All Commands" to ensure conversion works

### Python Not Found
- **Symptom**: All Beancount commands fail.
- **Cause**: Python is not installed or not in PATH.
- **Solution**:
  1. Verify Python 3.8+ is installed: `python --version` or `python3 --version`
  2. If not installed, download from python.org or use your package manager
  3. After installing, restart Obsidian
  4. The plugin will auto-detect Python on next startup

---

## 📊 Query Issues

### "Error: Invalid Query"
- **Syntax Error**: Check for typos in your BQL query
  - Strings must use single quotes: `'Expenses'` not `"Expenses"`
  - Regex patterns use tilde: `account ~ '^Assets'` not `account = '^Assets'`
  - SQL keywords must be uppercase: `SELECT`, `WHERE`, `GROUP BY`
- **Test**: Try a simple query first: `SELECT account`

### Empty Results
- **Date Format**: Ensure dates are `YYYY-MM-DD` format (ISO 8601)
  - ✅ Correct: `date >= 2023-01-01`
  - ❌ Wrong: `date >= 01/01/2023`
- **Currency Conversion**: `convert()` functions return 0 if no price data exists for that date
  - Solution: Add price directives to your ledger or check the date range
- **Account Regex**: Double-check your account patterns
  - Example: `'^Expenses'` matches "Expenses:Food" but not "Income:Salary"

### Slow Query Performance
- **Large Ledgers**: Queries on large files (>10k transactions) may be slow
- **Solutions**:
  1. Reduce date ranges in queries: `WHERE date >= 2024-01-01`
  2. Lower "Max Transaction Results" in Settings → Performance
  3. Use more specific WHERE clauses to reduce result sets
  4. Consider splitting very large ledgers into yearly files

### BQL Code Blocks Not Rendering
- **Symptom**: Code blocks show raw query text instead of results table.
- **Solutions**:
  1. Ensure you're using the correct syntax:
     ````
     ```bql
     SELECT * FROM accounts
     ```
     ````
  2. Check the browser console (Ctrl+Shift+I) for error messages
  3. Enable Debug Mode in Settings → General → Debug Mode
  4. Look for `[Beancount]` prefixed messages in the console

---

## 📉 Data Display

### Liabilities Show as Positive Numbers?
- **This is intentional!** Beancount stores Liabilities as negative numbers internally, but the plugin displays them as positive magnitudes for user-friendliness.
- **Net Worth Calculation**: Still correct as `Assets - |Liabilities|`

### Missing Charts
- **Requirement**: Charts require at least 2 data points (typically 2 months of history) to render a line.
- **Solution**: 
  - Ensure your ledger has transactions spanning multiple months
  - Check that accounts match the expected patterns (e.g., `^Assets`, `^Liabilities`)

### Incorrect Net Worth
- **Common Causes**:
  1. **Missing Price Data**: If you hold commodities (stocks, crypto), ensure you have price directives
  2. **Wrong Account Classification**: Verify accounts start with correct prefixes (Assets, Liabilities, etc.)
  3. **Opening Balances**: Ensure you have proper opening balance entries
- **Debug**: Use a direct BQL query to verify:
  ```bql
  SELECT account, convert(sum(position), 'USD')
  WHERE account ~ '^Assets|^Liabilities'
  GROUP BY account
  ```

---

## 🛠 Debug Mode

For detailed troubleshooting:

1. **Enable Debug Mode**: Settings → General → Debug Mode (toggle on)
2. **Open Console**: Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
3. **Filter Logs**: Search for `[Beancount]` in the console
4. **Look for**:
   - Command execution logs showing the exact `bean-query` commands
   - Error messages with stack traces
   - File operation logs (reads, writes, backups)

### Common Log Messages

**Successful Query:**
```
[Beancount] Running query: SELECT account...
[Beancount] Query completed: 42 results
```

**Failed Command:**
```
[Beancount] Command failed: bean-query not found
[Beancount] Error: spawn bean-query ENOENT
```

**File Operation:**
```
[Beancount] Creating backup: finances.beancount.backup.20240101-120000
[Beancount] Transaction created successfully
```

---

## 🆘 Getting Help

If you're still stuck:

1. **Check Documentation**: Review the [Installation Guide](../getting-started/installation.md) and [Settings](../configuration/settings.md) docs
2. **GitHub Issues**: Search existing issues at https://github.com/mkshp-dev/obsidian-finance-plugin/issues
3. **Create Issue**: Include:
   - Your OS (Windows 10/11, macOS version, Linux distro)
   - Python version: `python --version`
   - Beancount version: `bean-query --version`
   - Debug logs from the console
   - Steps to reproduce the problem
