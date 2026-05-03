// src/utils/currency-precision.ts
//
// Currency-aware number formatting. The dashboard previously rendered
// every monetary value with a hard-coded 2-decimal toFixed/toLocaleString,
// which over-rounded crypto (0.012 BTC → "0.01") and added meaningless
// trailing zeros to currencies that have no fractional unit in real
// circulation (UYU, JPY).
//
// `getCurrencyPrecision` returns the natural decimal places for each
// currency code. `formatCurrency` formats a number with that precision
// and an adaptive override for tiny magnitudes so a sub-cent value
// doesn't collapse to zero on the screen.
//
// Pure functions only — safe to import from controllers, Svelte
// components, query factories, or unit tests.

export interface CurrencyPrecision {
    /** Decimal places to render in the UI for "ordinary" magnitudes (>= 1). */
    display: number;
    /** Decimal places to round to in BQL `round(..., n)` so we don't lose information server-side. */
    storage: number;
    /**
     * Optional cap on the number of decimals when adapting precision
     * for sub-unit magnitudes (|value| < 1). Defaults to `storage`
     * (we never show more decimals than we kept around). Currencies
     * with a true sub-unit (like satoshis on BTC) accept higher caps.
     */
    adaptiveMax?: number;
}

const PRECISION_TABLE: Record<string, CurrencyPrecision> = {
    // --- Cryptocurrencies (smallest-unit-defined) ---
    BTC: { display: 8, storage: 8, adaptiveMax: 8 },
    ETH: { display: 8, storage: 8, adaptiveMax: 8 },
    XMR: { display: 8, storage: 8, adaptiveMax: 8 },
    LTC: { display: 8, storage: 8, adaptiveMax: 8 },
    BCH: { display: 8, storage: 8, adaptiveMax: 8 },
    DOGE: { display: 8, storage: 8, adaptiveMax: 8 },
    SOL: { display: 6, storage: 8, adaptiveMax: 8 },
    ADA: { display: 6, storage: 8, adaptiveMax: 8 },
    DOT: { display: 6, storage: 8, adaptiveMax: 8 },

    // --- Tokenised commodities ---
    PAXG: { display: 4, storage: 6, adaptiveMax: 8 },
    XAU:  { display: 4, storage: 6, adaptiveMax: 8 },
    XAG:  { display: 3, storage: 4, adaptiveMax: 6 },

    // --- "Hundredth-of-unit" fiat ---
    USD: { display: 2, storage: 2 },
    EUR: { display: 2, storage: 2 },
    GBP: { display: 2, storage: 2 },
    INR: { display: 2, storage: 2 },
    BRL: { display: 2, storage: 2 },
    CAD: { display: 2, storage: 2 },
    AUD: { display: 2, storage: 2 },
    CHF: { display: 2, storage: 2 },
    MXN: { display: 2, storage: 2 },
    ARS: { display: 2, storage: 2 },

    // --- Effectively-integer fiat (centavo / sen / fil exists in law,
    //     not in daily circulation; rounding to whole units matches
    //     how amounts are quoted at point of sale). ---
    UYU: { display: 0, storage: 2, adaptiveMax: 2 },
    JPY: { display: 0, storage: 0 },
    KRW: { display: 0, storage: 0 },
    VND: { display: 0, storage: 0 },
    IDR: { display: 0, storage: 0 },
    CLP: { display: 0, storage: 0 },
    PYG: { display: 0, storage: 0 },
    HUF: { display: 0, storage: 0 },
    TWD: { display: 0, storage: 0 },
};

const DEFAULT_PRECISION: CurrencyPrecision = { display: 2, storage: 2 };

/**
 * Resolve the natural precision for a currency code. Unknown codes
 * fall back to the same 2-decimal default that web banking, fintech
 * and most fiat currencies share.
 */
export function getCurrencyPrecision(code: string | null | undefined): CurrencyPrecision {
    if (!code) return DEFAULT_PRECISION;
    return PRECISION_TABLE[code.toUpperCase()] ?? DEFAULT_PRECISION;
}

/**
 * Pick the number of decimals to show for `value` in `currency`.
 * Logic:
 *   - For |value| >= 1 → use the currency's display precision.
 *   - For 0 < |value| < 1 → step up the precision (toward
 *     adaptiveMax) so the value retains at least one significant digit.
 *   - For 0 → use display precision (typically 0 or 2).
 *
 * This matches the EquivalentsRow algorithm but parametrised by
 * currency (so 0.012 BTC stays "0.012" while 0.01 USD stays "0.01"
 * and 0 UYU stays just "0").
 */
function pickDecimals(value: number, p: CurrencyPrecision): number {
    if (!isFinite(value)) return p.display;
    const abs = Math.abs(value);
    const cap = p.adaptiveMax ?? p.storage;
    const display = p.display;

    if (abs === 0) return display;
    if (abs >= 1) return display;

    // Sub-unit value: bump decimals until at least one significant digit
    // shows, capped at `cap`.
    if (cap <= display) return display;
    if (abs >= 0.1) return Math.max(display, Math.min(2, cap));
    if (abs >= 0.01) return Math.max(display, Math.min(4, cap));
    if (abs >= 0.0001) return Math.max(display, Math.min(6, cap));
    return cap;
}

/**
 * Format `value` for `currency`. Returns the bare number string
 * (no currency suffix). Trailing zeros are stripped because we
 * pass `minimumFractionDigits: 0` — keeping `1234.5` as `"1,234.5"`
 * rather than `"1,234.50"` for crypto-shaped values.
 */
export function formatCurrency(
    value: number | null | undefined,
    currency: string | null | undefined,
    opts: { signed?: boolean; minDigits?: number } = {},
): string {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    const p = getCurrencyPrecision(currency);
    const max = pickDecimals(value, p);
    const min = Math.max(0, Math.min(max, opts.minDigits ?? 0));
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
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
