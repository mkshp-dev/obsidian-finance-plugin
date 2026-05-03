// src/utils/equivalents.ts

import type BeancountPlugin from '../main';
import { parseSingleValue } from './index';
import { Logger } from './logger';

const CURRENCY_FORMAT_RE = /^[A-Z][A-Z0-9'._-]*$/;

/**
 * Normalizes the user-configured `equivalentCurrencies` list into a clean,
 * deduped array, dropping invalid entries and the operating currency itself.
 * Returns an empty array when nothing is configured.
 */
export function sanitizeEquivalentCurrencies(
    raw: string[] | undefined | null,
    operatingCurrency: string,
): string[] {
    if (!raw || raw.length === 0) return [];
    const op = (operatingCurrency || '').toUpperCase();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of raw) {
        const code = (entry ?? '').trim().toUpperCase();
        if (!code) continue;
        if (!CURRENCY_FORMAT_RE.test(code)) continue;
        if (code === op) continue;
        if (seen.has(code)) continue;
        seen.add(code);
        out.push(code);
    }
    return out;
}

/**
 * Runs the same single-value query factory against each equivalent currency
 * in parallel and returns a `{ currency: number }` map. Failures for an
 * individual currency are logged and dropped — the dashboard should still
 * render the primary value even if one equivalent's price chain is missing.
 *
 * The factory shape matches the existing query helpers in queries/index.ts,
 * which all accept (currency, rounding) and return a single-projection BQL
 * string compatible with parseSingleValue.
 */
export async function collectEquivalents(
    plugin: BeancountPlugin,
    equivalents: string[],
    factory: (currency: string, rounding: number) => string,
    rounding: number = 2,
): Promise<Record<string, number>> {
    if (equivalents.length === 0) return {};
    const entries = await Promise.all(equivalents.map(async (currency) => {
        try {
            const result = await plugin.runQuery(factory(currency, rounding));
            const num = parseFloat(parseSingleValue(result));
            if (!isFinite(num)) return null;
            return [currency, num] as [string, number];
        } catch (e) {
            Logger.warn(`Equivalent currency '${currency}' query failed:`, e);
            return null;
        }
    }));
    const out: Record<string, number> = {};
    for (const entry of entries) {
        if (entry) out[entry[0]] = entry[1];
    }
    return out;
}
