// src/utils/csvParsers.ts
// Commodity-specific CSV parsers: list, price data, and detail parsers.

import { parse as parseCsv } from 'csv-parse/sync';
import { parseMetadataString } from './formatters';

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
        console.error('Error parsing commodities list CSV:', e, 'CSV:', csv);
        return [];
    }
}

/**
 * Parses CSV from getCommoditiesPriceDataQuery into a Map of price data keyed by symbol.
 * Format: [date_, currency_, price_, logo_, islatest_]
 */
export function parseCommoditiesPriceDataCSV(
    csv: string
): Map<string, { price: string | null; logo: string | null; date: string | null; isLatest: boolean }> {
    const priceDataMap = new Map();

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
            if (row.length < 5) continue;

            const date = row[0]?.trim() || null;
            const currency = row[1]?.trim() || null;
            const price = row[2]?.trim() || null;
            const logo = row[3]?.trim() || null;
            const isLatestStr = row[4]?.trim().toLowerCase() || 'false';
            const isLatest = isLatestStr === 'true' || isLatestStr === '1';

            if (currency) {
                priceDataMap.set(currency, { price, logo, date, isLatest });
            }
        }

        return priceDataMap;
    } catch (e) {
        console.error('Error parsing commodities price data CSV:', e, 'CSV:', csv);
        return priceDataMap;
    }
}

/**
 * Parses CSV from getCommodityDetailsQuery into a single commodity detail object.
 * Format: [name_, meta_, logo_, pricemetadata_, filename_, lineno_]
 */
export function parseCommodityDetailsCSV(csv: string): {
    symbol: string;
    metadata: Record<string, any>;
    logo: string | null;
    priceMetadata: string | null;
    filename: string | null;
    lineno: number | null;
} {
    const defaultResult = {
        symbol: '',
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
        if (row.length < 6) return defaultResult;

        const symbol = row[0]?.trim() || '';
        const metaStr = row[1]?.trim() || '{}';
        const logo = row[2]?.trim() || null;
        const priceMetadata = row[3]?.trim() || null;
        const filename = row[4]?.trim() || null;
        const linenoStr = row[5]?.trim() || null;

        const metadata = parseMetadataString(metaStr);
        const parsedLineno = linenoStr ? parseInt(linenoStr, 10) : NaN;
        const lineno = isNaN(parsedLineno) ? null : parsedLineno;

        return { symbol, metadata, logo, priceMetadata, filename, lineno };
    } catch (e) {
        console.error('Error parsing commodity details CSV:', e, 'CSV:', csv);
        return defaultResult;
    }
}

/**
 * Parses CSV from getCommoditiesHoldingsQuery into a Map keyed by currency symbol.
 *
 * Each row has shape `[currency, units_, valueOp_]` where `units_` is an inventory
 * string like `"11.80 USD"` or `",30949 UYU"` (sign placement varies by sum sign)
 * and `valueOp_` is the same holdings converted to the operating currency
 * (e.g. `"471 UYU"`).
 *
 * We extract the absolute numeric magnitude from each (sign is always positive
 * for asset balances in practice; the sign placement is a beanquery CSV quirk).
 */
export function parseCommoditiesHoldingsCSV(
    csv: string
): Map<string, { holdings: number; holdingsRaw: string; valueOp: number }> {
    const map = new Map<string, { holdings: number; holdingsRaw: string; valueOp: number }>();

    const extractNumber = (cell: string | undefined): number => {
        if (!cell) return 0;
        // Match the first signed/unsigned numeric value; ignore currency tokens.
        const m = cell.match(/-?\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) : 0;
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
            if (row.length < 3) continue;

            const currency = row[0]?.trim();
            if (!currency) continue;

            const unitsCell = row[1]?.trim() || '';
            const valueCell = row[2]?.trim() || '';

            const holdings = Math.abs(extractNumber(unitsCell));
            const valueOp = Math.abs(extractNumber(valueCell));

            // Display string: pick whichever non-empty side of the inventory string
            // has the value (e.g. "11.80 USD" or "30949 UYU").
            const holdingsRaw = unitsCell
                .split(',')
                .map(s => s.trim())
                .find(s => /\d/.test(s)) || '';

            map.set(currency, { holdings, holdingsRaw, valueOp });
        }

        return map;
    } catch (e) {
        console.error('Error parsing commodities holdings CSV:', e, 'CSV:', csv);
        return map;
    }
}
