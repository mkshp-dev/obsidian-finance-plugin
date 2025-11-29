---
sidebar_position: 1
---

# Introduction

The **Obsidian Finance Plugin** is a comprehensive financial dashboard for [Obsidian.md](https://obsidian.md) that seamlessly integrates with [Beancount](https://beancount.github.io/docs/), the popular plain-text accounting system.

This plugin transforms your Obsidian vault into a powerful financial analysis tool, allowing you to manage transactions, visualize your net worth, and track your portfolio without leaving your note-taking environment.

## 🌟 Core Value

- **Privacy First**: Your financial data stays in your local text files. No cloud servers, no third-party access.
- **Plain Text Accounting**: Leverages the power and flexibility of Beancount.
- **Integrated Workflow**: Manage your finances alongside your daily notes and journals.
- **Visual Analytics**: Beautiful, interactive charts and dashboards.
- **Powerful Querying**: Native support for Beancount Query Language (BQL) directly in your notes.

## 🚀 Key Features

*   **📊 Unified Dashboard**: A centralized hub featuring Overview, Transactions, Journal, Balance Sheet, Accounts, and Commodities tabs.
*   **💸 Transaction Management**: Unified entry modal for Transactions, Balance Assertions, and Notes with smart validation.
*   **🏦 Account Hierarchy**: Interactive tree view with real-time balances and drill-down capability.
*   **📋 Journal View**: Full Beancount ledger interface with server-side filtering and Fava-style cards.
*   **🔍 BQL Integration**: Execute live queries in your notes using Code Blocks or Inline Queries.
*   **🪙 Commodities & Pricing**: Yahoo Finance integration for easy symbol search and automated price updates.
*   **⚙️ Smart Connection**: Automatic detection of Python/Beancount environment (including WSL support).

## 📚 Documentation Guide

This documentation is structured to help you get the most out of the plugin:

*   **[Getting Started](./getting-started/installation.md)**: Setup instructions and initial configuration.
*   **[Core Features](./core-features/unified-dashboard/overview.md)**: Deep dive into the Dashboard, Adding Directives, and Snapshot views.
*   **[Configuration](./configuration/settings.md)**: Detailed explanation of all plugin settings.
*   **[Queries](./queries/bql.md)**: Master the Beancount Query Language (BQL) within Obsidian.

## 🔧 Requirements

1.  **Python 3.8+**
2.  **Beancount v3+** (`pip install beancount`)
3.  **bean-query** (included with Beancount)
4.  **bean-price** (optional, for price updates)

The plugin supports Windows, macOS, Linux, and WSL (Windows Subsystem for Linux).
