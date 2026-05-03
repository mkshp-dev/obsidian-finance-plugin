// src/services/liabilities.service.ts
//
// Parses Beancount `open` directives plus their indented metadata to
// surface accounts that represent loans, credit lines, mortgages or
// receivables on a dedicated dashboard tab. Pure functions only — no
// I/O — so the parser is unit-testable.
//
// Recognised metadata keys (all optional; account is included if it
// has *any* of them OR if its name starts with "Liabilities:" or
// "Assets:Receivables:"):
//
//   loan-type:        free-form string ("credit-card", "mortgage",
//                     "personal-loan", "receivable", etc.)
//   principal:        original amount (number, no currency suffix —
//                     the account's open-currency is used)
//   interest-rate:    annual percentage as a number (e.g. 29.5)
//   monthly-payment:  number (no currency suffix)
//   due-day:          day of month (1–31) when payment is due
//   counterparty:     human label ("Banco Santander", "Maria Esther")
//
// Source format example:
//
//   2026-01-01 open Liabilities:Credit:Visa  USD
//     loan-type: "credit-card"
//     principal: 50000
//     interest-rate: 29.5
//     monthly-payment: 5000
//     due-day: 10
//     counterparty: "Banco Santander"
//
//   2026-02-01 open Assets:Receivables:Maria  UYU
//     loan-type: "receivable"
//     principal: 12000
//     monthly-payment: 1000
//     due-day: 15

export type LoanRole = 'liability' | 'receivable';

export interface LoanAccount {
    /** Full account path (e.g. "Liabilities:Credit:Visa"). */
    account: string;
    /** Currency declared on the open directive (first declared currency wins). */
    currency: string;
    /** ISO open-date. */
    openDate: string;
    /** Whether this account represents money the user owes (liability) or is owed (receivable). */
    role: LoanRole;
    /** Free-form loan classification (credit-card, mortgage, personal-loan, receivable, …). */
    loanType: string | null;
    /** Counterparty label (bank, lender, friend, …). */
    counterparty: string | null;
    /** Original / face amount of the loan. */
    principal: number | null;
    /** Annual interest rate as a number (e.g. 29.5 for 29.5%). */
    interestRate: number | null;
    /** Monthly payment amount in the account currency. */
    monthlyPayment: number | null;
    /** Day-of-month the payment is due (1–31). */
    dueDay: number | null;
    /** Optional funding/destination account override read from the `funding-account` meta. */
    fundingAccount: string | null;
    /** 1-based source line number of the open directive (for "open file at rule" jumps). */
    sourceLine?: number;
}

const OPEN_DIRECTIVE = /^(\d{4}-\d{2}-\d{2})\s+open\s+([A-Z][A-Za-z0-9:_-]*)\s*([A-Z][A-Z0-9'._-]*)?(?:\s+"[^"]*")?\s*$/;
const META_LINE = /^\s+([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/;

/**
 * Strip Beancount string quoting from a metadata value. Numeric and
 * bare values pass through unchanged. Returns `null` for empty.
 */
function unquote(raw: string): string {
    const t = raw.trim();
    if (!t) return '';
    if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
        return t.slice(1, -1);
    }
    return t;
}

function toNumber(raw: string): number | null {
    const t = unquote(raw).trim();
    if (!t) return null;
    const n = parseFloat(t);
    return isFinite(n) ? n : null;
}

function inferRole(account: string, loanType: string | null): LoanRole {
    if (account.startsWith('Liabilities:') || account === 'Liabilities') return 'liability';
    if (account.startsWith('Assets:Receivables') || /^Receivables(:|$)/.test(account)) return 'receivable';
    if ((loanType || '').toLowerCase().includes('receivable')) return 'receivable';
    return 'liability';
}

/**
 * Parse the contents of an accounts file (typically accounts.beancount)
 * for `open` directives whose metadata identifies them as loan-like.
 * Lines that don't match the directive shape are silently ignored.
 */
export function parseLoanAccounts(content: string): LoanAccount[] {
    const out: LoanAccount[] = [];
    const lines = content.split(/\r?\n/);

    let pending: { startLine: number; openDate: string; account: string; currency: string; meta: Record<string, string> } | null = null;

    const flush = () => {
        if (!pending) return;
        const { account, openDate, currency, meta, startLine } = pending;
        const loanType = meta['loan-type'] ? unquote(meta['loan-type']) : null;
        const isLoanShaped =
            loanType !== null ||
            'principal' in meta ||
            'monthly-payment' in meta ||
            'interest-rate' in meta ||
            'due-day' in meta ||
            account.startsWith('Liabilities:') ||
            account.startsWith('Assets:Receivables');
        if (isLoanShaped) {
            const dueDay = meta['due-day'] ? toNumber(meta['due-day']) : null;
            out.push({
                account,
                currency,
                openDate,
                role: inferRole(account, loanType),
                loanType,
                counterparty: meta['counterparty'] ? unquote(meta['counterparty']) : null,
                principal: meta['principal'] ? toNumber(meta['principal']) : null,
                interestRate: meta['interest-rate'] ? toNumber(meta['interest-rate']) : null,
                monthlyPayment: meta['monthly-payment'] ? toNumber(meta['monthly-payment']) : null,
                dueDay: dueDay !== null && dueDay >= 1 && dueDay <= 31 ? Math.round(dueDay) : null,
                fundingAccount: meta['funding-account'] ? unquote(meta['funding-account']) : null,
                sourceLine: startLine,
            });
        }
        pending = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        if (!trimmed || trimmed.startsWith(';')) {
            // blank / comment line outside an open block resets pending only at the boundary
            // (we still allow blank lines after metadata to terminate the block).
            if (pending && !trimmed) flush();
            continue;
        }

        const openMatch = OPEN_DIRECTIVE.exec(raw);
        if (openMatch) {
            // Flush the previous block if any, then start a new pending one.
            flush();
            const [, openDate, account, currency] = openMatch;
            pending = {
                startLine: i + 1,
                openDate,
                account,
                currency: currency || '',
                meta: {},
            };
            continue;
        }

        if (pending) {
            const metaMatch = META_LINE.exec(raw);
            if (metaMatch) {
                pending.meta[metaMatch[1]] = metaMatch[2];
                continue;
            }
            // Non-metadata, non-open content: terminate the block.
            flush();
        }
    }
    flush();
    return out;
}

/**
 * Compute the next due date (YYYY-MM-DD) for a loan account, given a
 * reference date. If `dueDay` falls today, today is returned. If it
 * already passed this month, the same day next month is used (clamped
 * to the month-end for short months).
 */
export function nextDueDate(dueDay: number | null, today: string = new Date().toISOString().slice(0, 10)): string | null {
    if (dueDay === null || !isFinite(dueDay)) return null;
    const [y, m, d] = today.split('-').map(Number);
    const clamp = (year: number, month: number, day: number): string => {
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const safe = Math.min(Math.max(1, Math.round(day)), lastDay);
        return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${safe.toString().padStart(2, '0')}`;
    };
    if (d <= dueDay) return clamp(y, m, dueDay);
    // Otherwise, roll forward one month.
    const nextYear = m === 12 ? y + 1 : y;
    const nextMonth = m === 12 ? 1 : m + 1;
    return clamp(nextYear, nextMonth, dueDay);
}

/**
 * Days between two ISO dates (b - a). Negative means a is after b.
 */
export function daysBetween(a: string, b: string): number {
    const da = new Date(a + 'T00:00:00Z').getTime();
    const db = new Date(b + 'T00:00:00Z').getTime();
    return Math.round((db - da) / 86400000);
}

/**
 * Compute the user-facing payoff fraction (0..1) given a balance and
 * a principal. For liabilities the balance is typically negative
 * (Beancount credit) and shrinks toward zero as it's paid off; for
 * receivables it's positive and shrinks the same way. We normalise
 * by absolute values so the fraction is meaningful in both cases.
 * Returns `null` if principal is missing or zero.
 */
export function payoffFraction(currentBalance: number | null, principal: number | null): number | null {
    if (principal === null || principal === 0 || currentBalance === null) return null;
    const remaining = Math.abs(currentBalance) / Math.abs(principal);
    return Math.max(0, Math.min(1, 1 - remaining));
}

/**
 * Naive months-to-payoff estimate: |balance| / |monthlyPayment|.
 * Doesn't compound interest — back-of-envelope ETA only. Returns null
 * when either input is missing or zero.
 */
export function monthsRemaining(currentBalance: number | null, monthlyPayment: number | null): number | null {
    if (currentBalance === null || monthlyPayment === null || monthlyPayment === 0) return null;
    const months = Math.abs(currentBalance) / Math.abs(monthlyPayment);
    if (!isFinite(months) || months <= 0) return null;
    return months;
}

// --- Write-back helpers (used by the in-tab Add/Edit loan modal) ---

/**
 * Editable shape used by the loan modal. `account` is required (the
 * unique key) and `currency` is required (drives the open-directive
 * declaration). All other fields are optional metadata.
 */
export interface LoanFormDraft {
    account: string;
    currency: string;
    openDate: string; // YYYY-MM-DD
    loanType: string | null;
    counterparty: string | null;
    principal: number | null;
    interestRate: number | null;
    monthlyPayment: number | null;
    dueDay: number | null;
    fundingAccount: string | null;
}

const META_KEY_ORDER: Array<keyof LoanFormDraft> = [
    'loanType', 'counterparty', 'principal', 'interestRate', 'monthlyPayment', 'dueDay', 'fundingAccount',
];

const META_KEY_TO_BEANCOUNT: Record<string, string> = {
    loanType: 'loan-type',
    counterparty: 'counterparty',
    principal: 'principal',
    interestRate: 'interest-rate',
    monthlyPayment: 'monthly-payment',
    dueDay: 'due-day',
    fundingAccount: 'funding-account',
};

const STRING_META_KEYS: ReadonlySet<string> = new Set(['loanType', 'counterparty', 'fundingAccount']);

/**
 * Format a single open-directive block from a draft, e.g.:
 *
 *   2026-01-15 open Liabilities:Credit:Visa  USD
 *     loan-type: "credit-card"
 *     principal: 5000
 *     ...
 */
export function formatLoanOpenDirective(draft: LoanFormDraft): string {
    const lines: string[] = [];
    const head = `${draft.openDate} open ${draft.account}` + (draft.currency ? `  ${draft.currency}` : '');
    lines.push(head);

    for (const key of META_KEY_ORDER) {
        const raw = draft[key];
        if (raw === null || raw === undefined || raw === '') continue;
        const beancountKey = META_KEY_TO_BEANCOUNT[key];
        if (!beancountKey) continue;
        const value = STRING_META_KEYS.has(key as string)
            ? `"${String(raw).replace(/"/g, '\\"')}"`
            : String(raw);
        lines.push(`  ${beancountKey}: ${value}`);
    }

    return lines.join('\n');
}

/**
 * Surgical rewrite of an accounts.beancount file: replace, insert, or
 * delete loan-account blocks while leaving every other line exactly
 * where the user wrote it.
 *
 *   - `edits` is keyed by the original account path. Each entry is the
 *     desired new state, or `null` to remove the block.
 *   - `additions` is the list of brand-new loan accounts to append at
 *     the bottom (separated by a blank line for breathing room).
 *
 * A "loan-account block" is the open-directive line plus the indented
 * metadata lines that immediately follow it.
 */
export function applyLoanEdits(
    originalContent: string,
    edits: Record<string, LoanFormDraft | null>,
    additions: LoanFormDraft[] = [],
): string {
    const lines = originalContent.split(/\r?\n/);
    const trailingNewline = originalContent.endsWith('\n');
    const accounts = parseLoanAccounts(originalContent);

    const blockRanges = new Map<string, [number, number]>();
    for (const acc of accounts) {
        const start = (acc.sourceLine ?? 1) - 1;
        let end = start;
        for (let i = start + 1; i < lines.length; i++) {
            if ((lines[i].startsWith(' ') || lines[i].startsWith('\t')) && META_LINE.test(lines[i])) {
                end = i;
                continue;
            }
            break;
        }
        blockRanges.set(acc.account, [start, end]);
    }

    const accountByStart = new Map<number, string>();
    for (const [account, [start]] of blockRanges) {
        accountByStart.set(start, account);
    }

    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const account = accountByStart.get(i);
        if (account && account in edits) {
            const desired = edits[account];
            const [, end] = blockRanges.get(account)!;
            if (desired === null) {
                i = end + 1;
                if (out.length > 0 && out[out.length - 1].trim() === '' &&
                    i < lines.length && lines[i].trim() === '') {
                    i += 1;
                }
                continue;
            }
            out.push(formatLoanOpenDirective(desired));
            i = end + 1;
            continue;
        }
        out.push(lines[i]);
        i += 1;
    }

    if (additions.length > 0) {
        if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
        for (let k = 0; k < additions.length; k++) {
            if (k > 0) out.push('');
            out.push(formatLoanOpenDirective(additions[k]));
        }
    }

    let result = out.join('\n');
    if (trailingNewline && !result.endsWith('\n')) result += '\n';
    return result;
}

// --- Synthetic recurring rules from loan metadata (γ integration) ---

/**
 * Synthesize Beancount-shaped recurring rules from loan account
 * metadata. Only accounts with both `monthly-payment` and `due-day`
 * yield a rule. The result feeds RecurringController so the recurring
 * widget can render synthetic + explicit rules together. An explicit
 * rule with the same nickname (`loan:<account>`) wins.
 */
export interface SyntheticRecurringRule {
    nickname: string;
    cadence: 'monthly';
    expenseAccount: string;
    fundingAccount: string;
    amount: number;
    currency: string;
    startDate: string;
    fromLoanAccount: string;
    synthetic: true;
}

const DEFAULT_LIABILITY_FUNDING = 'Assets:Banking';
const DEFAULT_RECEIVABLE_FUNDING = 'Income:Repayment';

export function synthesizeRecurringFromLoans(
    accounts: LoanAccount[],
    today: string = new Date().toISOString().slice(0, 10),
): SyntheticRecurringRule[] {
    const out: SyntheticRecurringRule[] = [];
    for (const acc of accounts) {
        if (acc.monthlyPayment === null || acc.dueDay === null) continue;
        const due = nextDueDate(acc.dueDay, today);
        if (!due) continue;

        const funding = acc.fundingAccount
            || (acc.role === 'liability' ? DEFAULT_LIABILITY_FUNDING : DEFAULT_RECEIVABLE_FUNDING);

        out.push({
            nickname: `loan:${acc.account}`,
            cadence: 'monthly',
            expenseAccount: acc.account,
            fundingAccount: funding,
            amount: Math.abs(acc.monthlyPayment),
            currency: acc.currency || 'USD',
            startDate: due,
            fromLoanAccount: acc.account,
            synthetic: true,
        });
    }
    return out;
}
