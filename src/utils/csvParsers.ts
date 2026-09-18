// src/utils/csvParsers.ts
// Commodity-specific CSV parsers: list, price data, and detail parsers.

import { parse as parseCsv } from 'csv-parse/sync';
import { parseMetadataString } from './formatters';
import { Logger } from './logger';

/**
 * Parses CSV from getAllCommoditiesQuery into an array of commodity symbols.
 */
export function parseCommoditiesListCSV(csv: string): string[] {
    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return [];

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        // Skip header row, extract first column
        return records
            .slice(1)
            .map(row => row[0]?.trim())
            .filter((symbol): symbol is string => !!symbol && symbol.length > 0);
    } catch (e) {
        Logger.error('Error parsing commodities list CSV:', e, 'CSV:', csv);
        return [];
    }
}

/**
 * Parses CSV from getCommoditiesPriceDataQuery into a Map of price data keyed by symbol.
 * Format: [date_, currency_, displayname_, price_, logo_, islatest_]
 */
export function parseCommoditiesPriceDataCSV(
    csv: string
): Map<string, { displayName: string | null; price: string | null; logo: string | null; date: string | null; isLatest: boolean }> {
    const priceDataMap = new Map<string, { displayName: string | null; price: string | null; logo: string | null; date: string | null; isLatest: boolean }>();

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return priceDataMap;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (row.length < 6) continue;

            const date = row[0]?.trim() || null;
            const currency = row[1]?.trim() || null;
            const displayName = row[2]?.trim() || null;
            const price = row[3]?.trim() || null;
            const logo = row[4]?.trim() || null;
            const isLatestStr = row[5]?.trim().toLowerCase() || 'false';
            const isLatest = isLatestStr === 'true' || isLatestStr === '1';

            if (currency) {
                priceDataMap.set(currency, { displayName, price, logo, date, isLatest });
            }
        }

        return priceDataMap;
    } catch (e) {
        Logger.error('Error parsing commodities price data CSV:', e, 'CSV:', csv);
        return priceDataMap;
    }
}

/**
 * Parses CSV from getCommodityDetailsQuery into a single commodity detail object.
 * Format: [name_, displayname_, meta_, logo_, pricemetadata_, filename_, lineno_]
 */
export function parseCommodityDetailsCSV(csv: string): {
    symbol: string;
    displayName: string | null;
    metadata: Record<string, unknown>;
    logo: string | null;
    priceMetadata: string | null;
    filename: string | null;
    lineno: number | null;
} {
    const defaultResult = {
        symbol: '',
        displayName: null,
        metadata: {},
        logo: null,
        priceMetadata: null,
        filename: null,
        lineno: null,
    };

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return defaultResult;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        if (records.length < 2) return defaultResult;

        const row = records[1];
        if (row.length < 7) return defaultResult;

        const symbol = row[0]?.trim() || '';
        const displayName = row[1]?.trim() || null;
        const metaStr = row[2]?.trim() || '{}';
        const logo = row[3]?.trim() || null;
        const priceMetadata = row[4]?.trim() || null;
        const filename = row[5]?.trim() || null;
        const linenoStr = row[6]?.trim() || null;

        const metadata = parseMetadataString(metaStr);
        const parsedLineno = linenoStr ? parseInt(linenoStr, 10) : NaN;
        const lineno = isNaN(parsedLineno) ? null : parsedLineno;

        return { symbol, displayName, metadata, logo, priceMetadata, filename, lineno };
    } catch (e) {
        Logger.error('Error parsing commodity details CSV:', e, 'CSV:', csv);
        return defaultResult;
    }
}

/**
 * Parses CSV from getAccountDetailQuery into a single account detail object.
 * Format: [account, open_date, close_date, currencies, reconcile_days, filename, lineno]
 */
export function parseAccountDetailCSV(csv: string): {
    account: string;
    openDate: string | null;
    closeDate: string | null;
    currencies: string[];
    reconcileDays: number | null;
    filename: string | null;
    lineno: number | null;
} {
    const defaultResult = {
        account: '',
        openDate: null,
        closeDate: null,
        currencies: [] as string[],
        reconcileDays: null,
        filename: null,
        lineno: null,
    };

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return defaultResult;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        if (records.length < 2) return defaultResult;

        const row = records[1];
        if (row.length < 7) return defaultResult;

        const account = row[0]?.trim() || '';
        const openDate = row[1]?.trim() || null;
        const closeDate = row[2]?.trim() || null;
        // `open.currencies` renders as a Python list repr, e.g. "['USD', 'CAD']"
        // (verified against real bean-query output) — strip the brackets, then
        // each element's own quotes.
        const currenciesRaw = (row[3] || '').trim().replace(/^\[|\]$/g, '');
        const currencies = currenciesRaw
            ? currenciesRaw.split(',').map(c => c.trim().replace(/^['"]|['"]$/g, '')).filter(c => c.length > 0)
            : [];
        const reconcileDaysStr = row[4]?.trim() || '';
        const parsedReconcileDays = reconcileDaysStr ? parseInt(reconcileDaysStr, 10) : NaN;
        const reconcileDays = isNaN(parsedReconcileDays) ? null : parsedReconcileDays;
        const filename = row[5]?.trim() || null;
        const linenoStr = row[6]?.trim() || '';
        const parsedLineno = linenoStr ? parseInt(linenoStr, 10) : NaN;
        const lineno = isNaN(parsedLineno) ? null : parsedLineno;

        return { account, openDate, closeDate, currencies, reconcileDays, filename, lineno };
    } catch (e) {
        Logger.error('Error parsing account detail CSV:', e, 'CSV:', csv);
        return defaultResult;
    }
}

/**
 * Parses CSV from getCombinedCommodityDataQuery into a Map keyed by currency symbol.
 * Format: [currency_, displayname_, units_, valueOp_, price_, logo_]
 *
 * When bean-query's convert() cannot convert to the operating currency (no price
 * directive exists), it returns the original inventory unchanged (e.g. "0.016 ETHW"
 * instead of "1234 INR"). We detect this by checking whether the currency token in
 * valueOp_ matches the operating currency; if not, valueOp is set to 0.
 *
 * `holdings` and `valueOp` keep their sign so short/closed residual positions do
 * not pass UI filters that only include positive holdings.
 */
export function parseCombinedCommodityDataCSV(
    csv: string,
    operatingCurrency: string
): Map<string, { displayName: string | null; holdings: number; holdingsRaw: string; valueOp: number; price: string | null; logo: string | null }> {
    const map = new Map<string, { displayName: string | null; holdings: number; holdingsRaw: string; valueOp: number; price: string | null; logo: string | null }>();

    const extractNumber = (cell: string | undefined): number => {
        if (!cell) return 0;
        const m = cell.match(/-?\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) : 0;
    };

    // Extract the currency token (e.g. "INR" from "658.35 INR")
    const extractCurrencyToken = (cell: string): string | null => {
        const m = cell.match(/[A-Z][A-Z0-9'._-]*/);
        return m ? m[0] : null;
    };

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return map;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (row.length < 6) continue;

            const currency = row[0]?.trim();
            if (!currency) continue;

            const displayName = row[1]?.trim() || null;
            const unitsCell = row[2]?.trim() || '';
            const valueCell = row[3]?.trim() || '';
            const priceCell = row[4]?.trim() || null;
            const logoCell = row[5]?.trim() || null;

            const holdings = extractNumber(unitsCell);

            // If convert() couldn't convert, valueCell still contains the original
            // currency unit. Detect this and zero out the value to avoid mislabeling.
            const valueCurrencyToken = extractCurrencyToken(valueCell);
            const valueOp = (valueCurrencyToken && valueCurrencyToken !== operatingCurrency)
                ? 0
                : extractNumber(valueCell);

            const holdingsRaw = unitsCell
                .split(',')
                .map(s => s.trim())
                .find(s => /\d/.test(s)) || '';

            const price = priceCell && priceCell !== 'None' ? priceCell : null;
            const logo = logoCell && logoCell !== 'None' ? logoCell : null;

            map.set(currency, { displayName, holdings, holdingsRaw, valueOp, price, logo });
        }

        return map;
    } catch (e) {
        console.error('Error parsing combined commodity data CSV:', e, 'CSV:', csv);
        return map;
    }
}

/**
 * Parses CSV from getCommodityPriceHistoryQuery into dated price points.
 * Format: [date_, amount_], where amount_ is typically "123.45 CNY".
 */
export function parseCommodityPriceHistoryCSV(csv: string): Array<{ date: string; amount: number; currency: string; amountRaw: string }> {
    const rows: Array<{ date: string; amount: number; currency: string; amountRaw: string }> = [];

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return rows;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (row.length < 2) continue;

            const date = row[0]?.trim();
            const amountRaw = row[1]?.trim() || '';
            const amountMatch = amountRaw.match(/(-?[\d,]+(?:\.\d+)?)\s+([A-Z][A-Z0-9'._-]*)/);
            if (!date || !amountMatch) continue;

            rows.push({
                date,
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                currency: amountMatch[2],
                amountRaw,
            });
        }

        return rows;
    } catch (e) {
        Logger.error('Error parsing commodity price history CSV:', e, 'CSV:', csv);
        return rows;
    }
}

/**
 * Parses CSV from getAccountBalanceHistoryQuery's monthly form (year, month, value).
 */
export function parseAccountBalanceHistoryMonthlyCSV(csv: string): Array<{ date: string; label: string; value: number }> {
    const rows: Array<{ date: string; label: string; value: number }> = [];

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return rows;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (row.length < 3) continue;

            const year = parseInt(row[0]?.trim(), 10);
            const month = parseInt(row[1]?.trim(), 10);
            if (!year || !month) continue;
            const value = parseFloat(row[2]?.trim() || '0') || 0;

            rows.push({
                date: `${year}-${String(month).padStart(2, '0')}-01`,
                label: new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
                value,
            });
        }

        return rows;
    } catch (e) {
        Logger.error('Error parsing account balance history CSV:', e, 'CSV:', csv);
        return rows;
    }
}

/**
 * Parses CSV from getAccountBalanceHistoryQuery's weekly form (week_end date, value).
 */
export function parseAccountBalanceHistoryWeeklyCSV(csv: string): Array<{ date: string; label: string; value: number }> {
    const rows: Array<{ date: string; label: string; value: number }> = [];

    try {
        const cleanCsv = csv.replace(/\r/g, '').trim();
        if (!cleanCsv) return rows;

        const records: string[][] = parseCsv(cleanCsv, {
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (row.length < 2) continue;

            const dateStr = row[0]?.trim();
            const d = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
            if (!dateStr || !d || isNaN(d.getTime())) continue;
            const value = parseFloat(row[1]?.trim() || '0') || 0;

            rows.push({
                date: dateStr,
                label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
                value,
            });
        }

        return rows;
    } catch (e) {
        Logger.error('Error parsing account weekly balance history CSV:', e, 'CSV:', csv);
        return rows;
    }
}
