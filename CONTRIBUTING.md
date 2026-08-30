# Contributing

Thanks for considering a contribution to Beancount Ledger.

## Development setup

```bash
git clone https://github.com/mkshp-dev/obsidian-finance-plugin.git
cd obsidian-finance-plugin
npm install
npm run dev
```

`npm run dev` builds the plugin and watches for changes. Symlink or copy the built files into a vault's `.obsidian/plugins/beancount-finance/` folder to test them in Obsidian.

## Submitting changes

1. Fork the repo and create a branch off `dev`.
2. Make your changes, keeping them focused and scoped to the issue at hand.
3. Run `npm run build` to make sure the project still compiles.
4. Open a pull request against `dev` describing what changed and why.

## Reporting bugs

Please open a [GitHub issue](https://github.com/mkshp-dev/obsidian-finance-plugin/issues) with steps to reproduce, your Obsidian/plugin version, and any relevant error messages from the developer console.
