---
sidebar_position: 10
---

# Troubleshooting

This guide addresses common issues you might encounter while using the Obsidian Finance Plugin.

## 🔧 Backend Issues

### "Backend API Starting..." Stuck
If the Journal tab or Dashboard shows "Backend API Starting..." for more than 30 seconds:

1.  **Check Python**: Ensure you have Python installed and the path is correct in Settings.
2.  **Check Beancount**: Run `pip install beancount` in your terminal.
3.  **Check Console**: Open Obsidian's Developer Tools (`Ctrl+Shift+I` on Windows/Linux, `Cmd+Opt+I` on macOS) and look for red error messages in the Console tab.
4.  **Validate File**: Use the **"Bean Check"** button in Settings to ensure your ledger file doesn't have syntax errors that are crashing the parser.

### "Command not found"
If you see errors related to `bean-query` or `python` not found:
- **Windows**: Ensure Python is added to your system PATH.
- **WSL**: Make sure you are using the correct WSL path format (`/mnt/c/...`).
- **macOS/Linux**: If you installed Python via a specific manager (like conda or pyenv), you might need to provide the full absolute path to the python executable in Settings.

---

## 📉 Data Presentation

### Liabilities & Net Worth Signs
Beancount internally stores Liabilities and Income as **negative numbers** (Credit balances).

To make the UI friendlier:
- **Dashboard**: The plugin displays Liabilities as **positive numbers** (magnitude).
- **Net Worth**: Calculated as `Assets - Liabilities` (treating Liability as a positive magnitude).
- **Balance Sheet**: Follows standard presentation.

*Example*:
- Beancount: `Assets:Bank` = 100, `Liabilities:CreditCard` = -20.
- Dashboard displays: Assets $100, Liabilities $20, Net Worth $80.

### Missing Prices / Currency Conversions
If your Net Worth shows as 0 or incorrect values:
1.  **Check Prices**: Ensure you have price entries for your commodities.
2.  **Reporting Currency**: Make sure the **Reporting Currency** in Settings matches the currency of your prices (e.g., USD).
3.  **Update Prices**: Use the Commodities tab to fetch the latest prices.

---

## 📝 File & Path Issues

### "File not found"
- **Absolute Paths**: The plugin requires absolute file paths to work with the external Python process.
- **Vault Location**: If your vault is in a cloud-synced folder (iCloud, OneDrive), ensure the files are downloaded locally and the path is stable.

### PowerShell Encoding Characters
If you see weird characters in your files when using PowerShell:
- This is a known PowerShell issue with standard output redirection.
- The plugin handles this internally, but if you run commands manually, use the Python helper or `cmd.exe`.

---

## 🐛 Getting Help

If you're still stuck:

1.  **Github Issues**: Report bugs on the [GitHub Repository](https://github.com/mukundshelake/obsidian-finance-plugin/issues).
2.  **Discussions**: Ask questions in the [Discussions](https://github.com/mukundshelake/obsidian-finance-plugin/discussions) tab.
3.  **Logs**: When reporting an issue, please include any errors from the Developer Console (`Ctrl+Shift+I`).
