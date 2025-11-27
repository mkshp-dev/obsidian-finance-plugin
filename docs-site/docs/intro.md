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

*   **📊 Overview Dashboard**: Real-time Net Worth, Monthly Trends, and Asset Allocation.
*   **💸 Transaction Management**: Unified entry modal for Transactions, Balance Assertions, and Notes with smart validation.
*   **🏦 Account Hierarchy**: Interactive tree view with real-time balances and drill-down capability.
*   **📋 Journal View**: Full Beancount ledger interface with server-side filtering and Fava-style cards.
*   **🔍 BQL Integration**: Execute live queries in your notes using Code Blocks or Inline Queries.
*   **🪙 Commodities & Pricing**: Yahoo Finance integration for easy symbol search and automated price updates.
*   **⚙️ Smart Connection**: Automatic detection of Python/Beancount environment (including WSL support).

## 📚 Documentation Guide

*   **[Installation](./installation.md)**: How to set up the plugin and its dependencies.
*   **[Dashboard](./dashboard.md)**: Explore the visual analytics and account views.
*   **[BQL Queries](./bql.md)**: Learn how to query your data directly in Obsidian notes.
*   **[Transactions](./transactions.md)**: How to create and manage financial entries.
*   **[Commodities](./commodities.md)**: Managing assets, currencies, and prices.
*   **[Journal & Backend](./journal.md)**: Understanding the ledger view and the background process.
*   **[Settings](./settings.md)**: Configuration and connection management.
*   **[Troubleshooting](./troubleshooting.md)**: Solutions for common issues.
*   **[Agent Context](./agent-context.md)**: Technical overview for AI assistants and developers.

## 🔧 Requirements

1.  **Python 3.8+**
2.  **Beancount v3+** (`pip install beancount`)
3.  **bean-query** (included with Beancount)
4.  **bean-price** (optional, for price updates)

The plugin supports Windows, macOS, Linux, and WSL (Windows Subsystem for Linux).
