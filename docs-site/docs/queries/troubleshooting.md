---
sidebar_position: 2
---

# Troubleshooting

This guide addresses common issues with connectivity, queries, and data display.

## 🔌 Connection Issues

### "bean-query: command not found"
- **PATH Issue**: Obsidian might not inherit your shell's PATH.
- **Solution**: Go to Settings → Connection and enter the **absolute path** to the executable (e.g., `/usr/local/bin/bean-query`).
- **Test**: Use the "Test All Commands" button to verify detection.

### "File not found" errors
- Ensure your **Beancount File Path** in settings is correct and uses the appropriate format:
  - Windows: `C:\Users\YourName\Documents\finances.beancount`
  - macOS/Linux: `/home/username/finances.beancount`
  - WSL: `/mnt/c/Users/YourName/Documents/finances.beancount`

### WSL Path Errors
- If using WSL, ensure your **File Path** in settings uses the Linux format (`/mnt/c/Users/...`), not Windows format (`C:\Users\...`).
- The plugin will automatically convert paths for command execution.

## 📊 Query Issues

### "Error: Invalid Query"
- **Syntax**: Check for typos in your SQL.
- **Quotes**: Strings must be in single quotes (`'Expenses'`), not double quotes.
- **Regex**: Regex patterns use `~`, not `=`.

### Empty Results
- **Date Format**: Ensure dates are `YYYY-MM-DD`.
- **Currency**: `convert()` functions will return 0 if no price data is available for that date.

## 📉 Data Display

### Liabilities are Positive?
Beancount stores Liabilities as negative numbers. To make the dashboard intuitive:
- We display Liabilities as **positive magnitudes** in the UI.
- Net Worth is calculated as `Assets - |Liabilities|`.

### Missing Charts
- Charts require at least 2 data points (2 months of history) to render a line.

## 🛠 Under the Hood

### Debug Mode
To see detailed logs of what the plugin is doing:
1.  Open `src/main.ts` (if developing) or just check the Console.
2.  The backend process logs to stdout/stderr, which are piped to the Obsidian console with the `[Backend]` prefix.
