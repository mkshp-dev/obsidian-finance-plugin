---
sidebar_position: 10
---

# Troubleshooting

This guide addresses common issues with connectivity, queries, and data display.

---

## 🔌 Connection Issues

### "bean-query: command not found"
*   **Cause**: The plugin cannot find `bean-query` in your system's PATH. Note that `bean-query` is **not** included with Beancount and must be installed separately.
*   **Solution**: 
    1.  Install beanquery: `pip install beanquery` (see [Requirements](./getting-started/requirements.md)).
    2.  Go to **Settings → Beancount Ledger → Connection**.
    3.  Click **Test All Commands** to see which commands fail.
    4.  If auto-detection fails, manually enter the absolute path to `bean-query`:
        *   Windows: `C:\Users\<YourUsername>\AppData\Local\Programs\Python\Python3X\Scripts\bean-query.exe`
        *   macOS/Linux: `/usr/local/bin/bean-query` or `~/.local/bin/bean-query`
        *   WSL: `wsl bean-query`
    5.  Click **Test Bean Query** to verify it works.

### "File not found" errors
*   **Cause**: The Beancount file path in settings is incorrect or the file doesn't exist.
*   **Solution**: Verify your **Beancount File Path** in **Settings → Connection**:
    *   Windows: `C:\Users\YourName\Documents\finances.beancount`
    *   macOS/Linux: `/home/username/finances.beancount`
    *   WSL: `/mnt/c/Users/YourName/Documents/finances.beancount` (Linux-style path)
*   **Test**: Use the **Test Bean Check** button to validate the file.

### WSL Path Errors
*   **Symptom**: Commands work but file operations fail on Windows when using WSL.
*   **Cause**: Path format mismatch between Windows and WSL.
*   **Solution**:
    *   If your Beancount file is in Windows, use the WSL path format: `/mnt/c/Users/YourName/...`
    *   The plugin automatically converts paths when executing commands.
    *   Verify in **Settings → Connection** that "WSL (Default)" is detected.

### Python Not Found
*   **Symptom**: All Beancount commands fail.
*   **Cause**: Python is not installed or not in your PATH.
*   **Solution**:
    1.  Verify Python 3.8+ is installed: `python --version` or `python3 --version` in terminal.
    2.  If not installed, download from [python.org](https://python.org) or use your OS package manager.
    3.  After installing, restart Obsidian so the plugin can auto-detect Python.

---

## 📊 Query Issues

### "Error: Invalid Query"
*   **Syntax Error**: Check for typos in your BQL query.
    *   Strings must use single quotes: `'Expenses'` not `"Expenses"`.
    *   Regex patterns use tilde: `account ~ '^Assets'` not `account = '^Assets'`.
    *   SQL keywords must be uppercase: `SELECT`, `WHERE`, `GROUP BY`.
*   **Test**: Try a simple query first: `SELECT account`.

### Empty Results
*   **Date Format**: Ensure dates are `YYYY-MM-DD` format (ISO 8601).
    *   ✅ Correct: `date >= 2026-01-01`
    *   ❌ Wrong: `date >= 01/01/2026`
*   **Currency Conversion**: `convert()` functions return 0 if no price data exists for that date.
    *   Solution: Add price directives to your ledger or check the date range (see [Adding Price Metadata](./adding-data/adding-price-metadata.md)).

### Slow Query Performance
*   **Large Ledgers**: Queries on large files (>10k transactions) may run slowly.
*   **Solutions**:
    1.  Reduce date ranges in queries: `WHERE date >= 2026-01-01`.
    2.  Lower **Max Transaction Results** in **Settings → Performance**.
    3.  Use more specific `WHERE` clauses to reduce result sets.

---

## 📉 Data Display

### Liabilities Show as Positive Numbers?
*   **This is intentional!** Beancount stores Liabilities as negative numbers internally. The plugin uses `neg()` in its BQL query to flip the sign, so outstanding debt displays as a positive number (normal debt) and a credit or overpayment displays as negative.

### Missing Charts
*   **Requirement**: Charts require at least 2 data points (typically 2 months of history) to render a line.
*   **Solution**: Ensure your ledger has transactions spanning multiple months.

---

## 🛠 Debug Mode

For detailed troubleshooting:
1.  **Enable Debug Mode**: **Settings → General → Debug Mode** (toggle on).
2.  **Open Console**: Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS).
3.  **Filter Logs**: Search for `[Beancount]` in the console.

---

## 🆘 Getting Help

If you're still stuck:
1.  **Check Documentation**: Review the [Installation Guide](./getting-started/installation.md) and [Settings](./settings.md) docs.
2.  **GitHub Issues**: Search existing issues at [GitHub Issues](https://github.com/mkshp-dev/obsidian-finance-plugin/issues).
3.  **Create Issue**: Include your OS, Python version, Beancount version, and debug console logs.
