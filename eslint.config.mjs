// Mirrors the Obsidian community plugin scanner (the review bot), per
// eslint-plugin-obsidianmd's "Community plugin scanner configuration":
// https://github.com/obsidianmd/eslint-plugin/blob/master/docs/configuration.md#community-plugin-scanner-configuration
// Differences: the scanner downgrades most rules to "warn", while this keeps the
// recommended "error"s; and our own sentence-case options are kept (the scanner
// turns those rules off).
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  ...obsidianmd.configs.recommended,

  {
    files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
    rules: {
      // Security — keep as errors
      "no-eval": "error",
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/no-forbidden-elements": "error",

      // Covered by TypeScript or too noisy (off in the scanner)
      "no-undef": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "import/no-unresolved": "off",

      // Old plugins should not change their command ids
      "obsidianmd/commands/no-command-in-command-id": "off",
      "obsidianmd/commands/no-plugin-id-in-command-id": "off",
    },
  },

  {
    // Our own UI-text style (the scanner turns sentence-case off).
    files: ["**/*.ts"],
    rules: {
      "obsidianmd/ui/sentence-case": ["error", {
        "enforceCamelCaseLower": true,
        "acronyms": ["BQL", "USD", "INR", "EUR", "BTC", "GOLD", "CSV", "AST", "HTML", "UI", "URL", "YYYY-MM-DD", "BQL-q"],
        "ignoreWords": ["Beancount", "Markdown", "markdown", "Python", "GitHub", "Beancount settings", "Beancount snapshot", "Beancount dashboard", "Beancount configuration", "Transactions/2025.beancount", "Transactions/2025/2025-01.beancount", "queries.beancount", "bql-q:name", "bql:name", "assets:bank:checking"]
      }],
    },
  },

  {
    // Implied eval, once per call: core rule in JS, typescript-eslint's in TS.
    files: ["**/*.{js,cjs,mjs,jsx}"],
    rules: { "no-implied-eval": "error" },
  },
  {
    files: ["**/*.{ts,cts,mts,tsx}"],
    rules: { "@typescript-eslint/no-implied-eval": "error" },
  },

  {
    // Scanner handles these separately.
    files: ["manifest.json"],
    rules: { "obsidianmd/validate-manifest": "off" },
  },
  {
    files: ["LICENSE", "LICENSE.md", "LICENSE.txt"],
    rules: { "obsidianmd/validate-license": "off" },
  },

  {
    // The scanner honours disable comments but does not report unused ones.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
      reportUnusedInlineConfigs: "off",
    },
  },

  globalIgnores([
    // Not linted by the scanner either.
    "**/docs-site/**",
    "main.js",
    "**/*.min.js",
    "**/{dist,build,out,release}/**/*.{js,cjs,mjs,jsx}",
    "node_modules",
    "dist",
    "build",
    "pkg",
    "test-vault",
    ".obsidian",
    "**/.obsidian/**",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "**/*.test.*",
    "**/*.tests.*",
    "**/*.spec.*",
    "**/*.specs.*",
    "**/test/**",
    "**/tests/**",
    "**/__tests__/**",
    "**/mocks/**",
    "**/__mocks__/**",
    "**/*.cjs",
    "**/*.mjs",
    "**/*.cts",
    "**/*.mts",
    "**/vite*",
    "**/scripts/**",
    "**/docs/**",
    "**/i18n/**",
    "**/i18next/**",
    "**/locale/**",
    "**/locales/**",
    "**/translations/**",
    "**/l10n/**",
    ".pnpm-store",
    "**/testUtils**",
    "automation/**",
    "**/e2e/**",
    "**/e2e-tests/**",
    "**/*.e2e.*",
    "**/wdio.conf.*",
    "**/wdio.*.conf.*",
    "**/playwright.config.*",
    "**/{astro,babel,commitlint,docusaurus,esbuild,eslint,jest,oxlint,postcss,prettier,rolldown,rollup,stylelint,svelte,tailwind,tsdown,tsup,uno,webpack}.config.*",
    "**/{eslint,jest}.*.config.*",
    "**/jest.setup.*",
    "**/.{babelrc,eslintrc,mocharc,prettierrc}.*",
  ]),
]);
