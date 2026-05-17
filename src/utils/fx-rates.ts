// src/utils/fx-rates.ts
//
// Tiny parser for `<date> price <FROM> <amount> <TO>` directives in
// prices.beancount. Returns the latest-known direct conversion rate
// for each currency to the requested operating currency.
//
// Inverse rates (operating-currency-quoted-in-foreign) are honored:
// `2026-01-01 price UYU 0.025 USD` yields USD→UYU = 40.
//
// Chained conversions (e.g. BTC priced in USD, USD priced in UYU →
// BTC→UYU) are NOT computed. Add a transitive pass if a use case
// needs it.

const PRICE_LINE = new RegExp(
    String.raw`^(\d{4}-\d{2}-\d{2})\s+price\s+` +
        String.raw`([A-Z][A-Z0-9'._-]*)\s+` + // from
        String.raw`([\d.]+)\s+` + // amount
        String.raw`([A-Z][A-Z0-9'._-]*)`, // to
);

interface PriceEntry {
    date: string;
    from: string;
    to: string;
    amount: number;
}

/**
 * Parse prices.beancount text and return direct conversion rates to
 * `operatingCurrency`. Keys are foreign currency codes; values are
 * units of operatingCurrency per 1 unit of foreign.
 */
export function parseFxRates(
    pricesText: string,
    operatingCurrency: string,
): Record<string, number> {
    const entries: PriceEntry[] = [];
    for (const raw of pricesText.split(/\r?\n/)) {
        const m = PRICE_LINE.exec(raw.trim());
        if (!m) continue;
        const amount = parseFloat(m[3]);
        if (!isFinite(amount) || amount <= 0) continue;
        entries.push({ date: m[1], from: m[2], amount, to: m[4] });
    }

    // Keep only the latest entry per (from, to) pair.
    const latest = new Map<string, PriceEntry>();
    for (const e of entries) {
        const key = `${e.from}|${e.to}`;
        const cur = latest.get(key);
        if (!cur || e.date > cur.date) latest.set(key, e);
    }

    const rates: Record<string, number> = {};
    for (const e of latest.values()) {
        if (e.to === operatingCurrency) {
            rates[e.from] = e.amount;
        } else if (e.from === operatingCurrency) {
            // Inverse: 1 OP = e.amount FOREIGN → 1 FOREIGN = 1/e.amount OP
            const inverse = 1 / e.amount;
            // Prefer a direct quote over an inverse if both exist:
            // only fill if not already set by a direct rate.
            if (rates[e.to] === undefined) rates[e.to] = inverse;
        }
    }
    return rates;
}
