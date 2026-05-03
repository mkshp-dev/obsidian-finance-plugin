// src/services/recurring.service.ts
//
// Parses Beancount `custom "recurring"` directives into typed
// RecurringRule objects and computes upcoming occurrences for a
// look-ahead window. Pure functions only — no I/O — so the calculator
// is unit-testable and reusable from controllers, commands, or codegen.
//
// Ledger format (positional args after `custom "recurring"`):
//
//   <start-date> custom "recurring" "<nickname>" "<cadence>" \
//                "<expense-account>" "<funding-account>" \
//                <amount> <currency>
//
// Example:
//
//   2024-01-01 custom "recurring" "rent-monthly" "monthly" \
//                     "Expenses:Housing:Rent" \
//                     "Assets:Bank:Checking" \
//                     1500 USD
//
// `<cadence>` supports: daily, weekly, biweekly, monthly, quarterly,
// semiannual, yearly. The start-date anchors the schedule (e.g. a
// monthly rule starting 2024-01-15 occurs on the 15th of every month).

export type RecurringCadence =
    | 'daily'
    | 'weekly'
    | 'biweekly'
    | 'monthly'
    | 'quarterly'
    | 'semiannual'
    | 'yearly';

export interface RecurringRule {
    nickname: string;
    cadence: RecurringCadence;
    expenseAccount: string;
    fundingAccount: string;
    amount: number;
    currency: string;
    /** Anchor date in ISO YYYY-MM-DD. Schedule rolls forward from here. */
    startDate: string;
    /** 1-based source line number for "open file at rule" jumps. */
    sourceLine?: number;
    /**
     * True for rules synthesised from `open` directive metadata
     * (loan accounts) rather than authored as `custom "recurring"`
     * directives. The widget can badge them differently and the
     * editor should treat them as read-only.
     */
    synthetic?: boolean;
    /** For synthetic rules: account that produced this rule. */
    fromLoanAccount?: string;
}

export interface RecurringOccurrence {
    date: string; // YYYY-MM-DD
    rule: RecurringRule;
}

const CADENCES: ReadonlySet<RecurringCadence> = new Set([
    'daily',
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'semiannual',
    'yearly',
]);

// Match a `custom "recurring"` directive.
//
// Beancount custom directive args are space-separated, with strings
// quoted. We match the leading date + nickname + cadence + accounts
// (all strings) then capture the trailing `<amount> <currency>` pair.
const RECURRING_DIRECTIVE = new RegExp(
    String.raw`^(\d{4}-\d{2}-\d{2})\s+custom\s+"recurring"\s+` +
        String.raw`"([^"]+)"\s+` + // nickname
        String.raw`"([^"]+)"\s+` + // cadence
        String.raw`"([^"]+)"\s+` + // expense account
        String.raw`"([^"]+)"\s+` + // funding account
        String.raw`(-?\d+(?:\.\d+)?)\s+` + // amount
        String.raw`([A-Z][A-Z0-9'._-]*)\s*$`, // currency
);

/**
 * Parse the contents of a recurring.beancount file (or any file that
 * happens to contain `custom "recurring"` lines). Lines that don't
 * match the directive shape are silently ignored — the user can keep
 * comments and blank lines freely.
 */
export function parseRecurringFile(content: string): RecurringRule[] {
    const out: RecurringRule[] = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const m = RECURRING_DIRECTIVE.exec(lines[i].trim());
        if (!m) continue;
        const [, startDate, nickname, cadence, expenseAccount, fundingAccount, amountStr, currency] = m;
        if (!CADENCES.has(cadence as RecurringCadence)) continue;
        const amount = parseFloat(amountStr);
        if (!isFinite(amount)) continue;
        out.push({
            nickname,
            cadence: cadence as RecurringCadence,
            expenseAccount,
            fundingAccount,
            amount,
            currency,
            startDate,
            sourceLine: i + 1,
        });
    }
    return out;
}

function addDays(iso: string, days: number): string {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number): string {
    // Preserve day-of-month where possible; clamp on month-end overflow
    // (e.g. Jan 31 + 1 month → Feb 28 or 29).
    const [y, m, d] = iso.split('-').map(Number);
    const target = new Date(Date.UTC(y, m - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, lastDay));
    return target.toISOString().slice(0, 10);
}

/**
 * Step a date forward by one cadence increment. Pure; no clamping
 * across DST since we use UTC arithmetic on the date portion only.
 */
function advance(iso: string, cadence: RecurringCadence): string {
    switch (cadence) {
        case 'daily':
            return addDays(iso, 1);
        case 'weekly':
            return addDays(iso, 7);
        case 'biweekly':
            return addDays(iso, 14);
        case 'monthly':
            return addMonths(iso, 1);
        case 'quarterly':
            return addMonths(iso, 3);
        case 'semiannual':
            return addMonths(iso, 6);
        case 'yearly':
            return addMonths(iso, 12);
    }
}

/**
 * Roll the rule's start-date forward to the first occurrence on or after `from`.
 * Bounded loop: we cap at 10000 iterations so a malformed cadence cannot hang.
 */
function nextOnOrAfter(rule: RecurringRule, from: string): string | null {
    let cursor = rule.startDate;
    for (let i = 0; i < 10000; i++) {
        if (cursor >= from) return cursor;
        cursor = advance(cursor, rule.cadence);
    }
    return null;
}

/**
 * For a single rule, return all occurrences in [from, to] (inclusive on both ends).
 * Empty array if the rule never fires inside the window.
 */
export function occurrencesInWindow(
    rule: RecurringRule,
    from: string,
    to: string,
): string[] {
    if (from > to) return [];
    const start = nextOnOrAfter(rule, from);
    if (!start || start > to) return [];
    const out: string[] = [];
    let cursor = start;
    for (let i = 0; i < 10000 && cursor <= to; i++) {
        out.push(cursor);
        cursor = advance(cursor, rule.cadence);
    }
    return out;
}

/**
 * Flat, date-sorted list of occurrences across all rules within
 * `lookaheadDays` from `today` (inclusive). The default `today` is
 * the local date in YYYY-MM-DD; callers can override for testing.
 */
export function getUpcoming(
    rules: RecurringRule[],
    lookaheadDays: number,
    today: string = new Date().toISOString().slice(0, 10),
): RecurringOccurrence[] {
    const to = addDays(today, Math.max(0, lookaheadDays));
    const all: RecurringOccurrence[] = [];
    for (const rule of rules) {
        for (const date of occurrencesInWindow(rule, today, to)) {
            all.push({ date, rule });
        }
    }
    all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rule.nickname.localeCompare(b.rule.nickname)));
    return all;
}
