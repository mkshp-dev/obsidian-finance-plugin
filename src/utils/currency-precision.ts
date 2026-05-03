// src/utils/currency-precision.ts
//
// Currency-aware number handling. Two responsibilities:
//
//   1. Choose the BQL `round(N, k)` precision per currency so values
//      survive the server-side roundtrip without losing real digits.
//      (Beancount conversions can produce many decimals; we keep
//      enough to faithfully represent every real currency.)
//
//   2. Format numbers for display *as exactly as the data permits*.
//      No artificial rounding to "natural fiat decimals" — if the
//      ledger says 15,847.83 UYU, the dashboard shows 15,847.83 UYU.
//      Trailing zeros are still trimmed so that an exactly-200 USD
//      value renders as "200 USD", not "200.00 USD".
//
// Pure functions only — safe to import from controllers, Svelte
// components, query factories, or unit tests.

export interface CurrencyPrecision {
    /** Decimal places to round to in BQL `round(..., n)` so we don't lose information server-side. */
    storage: number;
}

/**
 * Per-currency BQL storage precision. We default to 8 (matches the
 * smallest sub-unit of BTC/ETH and is plenty for any fiat). Currencies
 * with traditionally finer denominations override upward.
 */
const PRECISION_TABLE: Record<string, CurrencyPrecision> = {
    BTC: { storage: 8 },
    ETH: { storage: 10 },
    XMR: { storage: 8 },
    LTC: { storage: 8 },
    BCH: { storage: 8 },
    DOGE: { storage: 8 },
    SOL: { storage: 9 },
    ADA: { storage: 8 },
    DOT: { storage: 10 },
    PAXG: { storage: 8 },
    XAU:  { storage: 8 },
    XAG:  { storage: 6 },
};

const DEFAULT_PRECISION: CurrencyPrecision = { storage: 8 };

/**
 * Resolve the BQL storage precision for a currency code. Unknown codes
 * default to 8 decimals — enough to faithfully represent any modern
 * fiat (which max out at thousandths) and BTC-like crypto.
 */
export function getCurrencyPrecision(code: string | null | undefined): CurrencyPrecision {
    if (!code) return DEFAULT_PRECISION;
    return PRECISION_TABLE[code.toUpperCase()] ?? DEFAULT_PRECISION;
}

/** Cap on how many decimals we render — large enough for any realistic case, small enough to dodge floating-point noise. */
const MAX_DISPLAY_DECIMALS = 10;

/**
 * Format `value` exactly: locale-aware thousands separator, trailing
 * zeros trimmed, but every real digit preserved. The currency arg is
 * accepted for API symmetry with `formatCurrencyAmount` but does not
 * change the precision — we trust the data over a per-currency table.
 */
export function formatCurrency(
    value: number | null | undefined,
    _currency?: string | null,
    opts: { signed?: boolean; minDigits?: number } = {},
): string {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    const min = Math.max(0, Math.min(MAX_DISPLAY_DECIMALS, opts.minDigits ?? 0));
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: min,
        maximumFractionDigits: MAX_DISPLAY_DECIMALS,
    });
    return opts.signed && value > 0 ? `+${formatted}` : formatted;
}

/**
 * Format `value` and append the currency suffix. Convenience wrapper
 * for the common "amount + currency" rendering used everywhere on
 * the dashboard.
 */
export function formatCurrencyAmount(
    value: number | null | undefined,
    currency: string | null | undefined,
    opts: { signed?: boolean; minDigits?: number } = {},
): string {
    const num = formatCurrency(value, currency, opts);
    if (num === '—') return '—';
    return currency ? `${num} ${currency}` : num;
}
