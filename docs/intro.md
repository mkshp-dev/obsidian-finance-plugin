---
sidebar_position: 1
slug: /
---

# Introduction

Welcome to the documentation for **Beancount Ledger**, a comprehensive personal finance plugin that brings the power of Plain Text Accounting directly into your Obsidian vault.

---

## 📈 What is Beancount?

**Beancount** is a popular open-source, double-entry, plain-text accounting system. In plain-text accounting, you record your financial transactions in a simple, human-readable text format. Beancount then parses these text files to generate balance sheets, income statements, trial balances, and custom reports.

Unlike traditional spreadsheet tracking or closed-source proprietary apps, Beancount is:
*   **Plain Text**: Your data is stored in simple text files (`.beancount`). You own your data forever; it will never be locked in a proprietary database or obsolete binary format.
*   **Double-Entry**: Every transaction must balance to zero. If you spend $5 on coffee, it is deducted from your cash asset and added to your food expenses. This ensures mathematical accuracy and prevents data entry errors.
*   **Extensible**: A huge ecosystem of tools, scripts, and importers exists to help you automate your finances.

### 📚 Major Beancount Resources

If you are new to Beancount or want to deepen your understanding, check out these excellent resources:
*   **[Official Beancount Documentation](https://beancount.github.io/docs/)**: The main repository of guides, design documents, and user manuals.
*   **[Beancount Language Syntax Guide](https://beancount.github.io/docs/beancount_language_syntax.html)**: The definitive reference for writing directives, transactions, costs, and prices.
*   **[Beancount Cheat Sheet](https://beancount.github.io/docs/beancount_cheat_sheet.html)**: A quick, handy reference for standard syntax.
*   **[Trading with Beancount (Cookbook)](https://beancount.github.io/docs/trading_with_beancount.html)**: A deep dive into tracking investments, stock transactions, lots, and cost basis.
*   **[Plain Text Accounting](https://plaintextaccounting.org/)**: A community hub for all things plain-text accounting (covering Beancount, Ledger, hledger, and more).

---

## 🌟 Why Beancount Ledger?

This plugin bridges the gap between powerful plain-text accounting and the convenience of modern personal finance apps. It integrates seamlessly with your existing note-taking and journaling workflow in [Obsidian.md](https://obsidian.md).

### Key Features of Our Plugin

*   **🔒 Privacy First**: Your financial data never leaves your local device. There are no cloud servers, no third-party APIs fetching your data, and no advertising trackers.
*   **📊 Unified Dashboard**: A centralized, tabbed interface to visualize your financial health (Overview, Transactions, Journal, Accounts & Balances, Income Statement, and Commodities).
*   **💸 Transaction Management**: A friendly entry modal that lets you add transactions, balance assertions, and notes in seconds without manually writing plain text.
*   **⚙️ Smart Connection**: Automatic detection of Python, Beancount, bean-query, and bean-price, including support for Windows Subsystem for Linux (WSL).
*   **🔍 Live BQL Queries**: Run Beancount Query Language (BQL) statements directly in your markdown notes using custom code blocks or inline queries.
*   **🪙 Bean Price Integration**: Automated market value updates for stocks, mutual funds, ETFs, and cryptocurrencies.
*   **📁 Structured Layout**: Automatically split large journals into clean, organized files (e.g., separating accounts, prices, and transactions by year).
*   **📝 Pro-grade File Editor**: A complete `.beancount` editor view featuring live syntax highlighting, diagnostics/linting, smart auto-indentation, and autocompletion.
