---
sidebar_position: 6
---

# Plugin API

The Obsidian Finance plugin exposes a public JavaScript API so that other Obsidian plugins can run Beancount queries programmatically, without needing to invoke `bean-query` themselves.

---

## Accessing the API

```typescript
const financePlugin = (app.plugins.plugins as any)['obsidian-finance-plugin'];

if (!financePlugin?.api) {
  console.warn('Obsidian Finance Plugin is not enabled.');
  return;
}

const { api } = financePlugin;
```

---

## `api.runQuery(query, filepath?, format?)`

Executes a BQL (Beancount Query Language) statement against the configured ledger file (or any `.beancount` file you provide).

### Signature

```typescript
runQuery(
  query: string,
  filepath?: string,
  format?: 'csv' | 'text' | 'beancount'
): Promise<string>
```

### Parameters

| Parameter  | Type                              | Default                        | Description |
|:---|:---|:---|:---|
| `query`    | `string`                          | _(required)_                   | A valid BQL query string. |
| `filepath` | `string \| undefined`             | Plugin's configured ledger     | Absolute path to a `.beancount` file. If omitted, the file path from the plugin settings is used. |
| `format`   | `'csv' \| 'text' \| 'beancount'`  | `'csv'`                        | Output format passed to `bean-query` via the `-f` flag. |

### Return value

A `Promise<string>` that resolves to the raw output of `bean-query` in the requested format.

### Errors

The promise rejects with an `Error` if:
*   The ledger file path is not configured and no `filepath` was provided.
*   The `bean-query` command is not configured in the plugin settings.
*   The query itself fails (e.g. syntax error or missing account).

---

## Examples

### Fetch account balances (CSV)

```typescript
const csv = await api.runQuery(
  'SELECT account, sum(position) GROUP BY account ORDER BY account'
);
// csv is a CSV string you can parse with your preferred library
```

### Query a specific ledger file

```typescript
const csv = await api.runQuery(
  'SELECT date, narration, position WHERE account ~ "Expenses"',
  '/home/user/finances/main.beancount'
);
```

### Get output as plain text

```typescript
const text = await api.runQuery(
  'BALANCES',
  undefined,
  'text'
);
```

---

## TypeScript types

If you are writing a plugin in TypeScript and want full type safety, you can copy the interface below into your project:

```typescript
interface BeancountPluginApi {
  runQuery(
    query: string,
    filepath?: string,
    format?: 'csv' | 'text' | 'beancount'
  ): Promise<string>;
}
```

Then cast the plugin instance:

```typescript
const api = (app.plugins.plugins as any)['obsidian-finance-plugin']
  ?.api as BeancountPluginApi | undefined;
```
