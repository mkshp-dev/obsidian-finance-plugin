# Obsidian Finance Plugin

A comprehensive financial dashboard plugin for [Obsidian.md](https://obsidian.md) that integrates with your [Beancount](https://beancount.github.io/docs/) plain-text accounting ledger.

📘 **[Full Documentation](https://mkshp-dev.github.io/obsidian-finance-plugin/)** - Read the complete guide for features, configuration, and usage.

---

## ⚠️ Important Prerequisites

**Before installing this plugin, you must have a working Beancount environment.**

This plugin is a **frontend** for Beancount. It **does not** include the core accounting engine itself.

### Mandatory Requirements:
1.  **Python 3.8 or higher**: Must be installed and available in your system PATH.
2.  **Beancount Package**: Must be installed via pip (`pip install beancount`).
    > *Verification*: Open your terminal and run `python3 -c "import beancount; print('Success')"`
3.  **bean-query**: The command-line tool must be accessible.
    > *Verification*: Run `bean-query --version` in your terminal.

**Windows Users**:
We strongly recommend using **WSL (Windows Subsystem for Linux)** for the best experience and performance. The plugin has native support for WSL paths.

---

## 📦 Installation

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/mkshp-dev/obsidian-finance-plugin/releases)
2. Extract files to `<vault>/.obsidian/plugins/obsidian-finance-plugin/`
3. Enable the plugin in Obsidian Settings → Community Plugins

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/mkshp-dev/obsidian-finance-plugin.git
cd obsidian-finance-plugin

# Install dependencies
npm install

# Start development build
npm run dev

# Build for production
npm run build
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
