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
    /** Optional override for the funding account used by synthetic recurring rules (γ integration). */
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
 * Synthesize Beancount-shaped recurring rules from loan account
 * metadata. Only accounts with both `monthly-payment` and `due-day`
 * yield a rule (other accounts have no payment schedule to replay).
 *
 * Convention:
 *   - Liabilities: each payment is "destination = liability account
 *     (paid down), funding = a placeholder Assets account". We don't
 *     know which Asset account funds the payment without further
 *     metadata, so we use the account's open-currency Assets:* if a
 *     `funding-account` meta is present, otherwise the synthetic rule
 *     is emitted with `Assets:Banking` as a generic placeholder. The
 *     user can override at any time by adding `funding-account: "…"`
 *     to the open directive.
 *   - Receivables: destination = Assets:Receivables account, funding =
 *     Income:Repayment by default (or the configured funding-account).
 *
 * The result feeds the same RecurringRule shape as `parseRecurringFile`
 * so the dashboard widget renders synthetic and explicit rules in one
 * unified list. Synthetic rules have no `sourceLine` (the open
 * directive is in a different file) and a stable nickname like
 * `loan:<account>` so explicit rules can override by sharing the
 * nickname.
 */
export interface SyntheticRecurringRule {
    nickname: string;
    cadence: 'monthly';
    expenseAccount: string;
    fundingAccount: string;
    amount: number;
    currency: string;
    startDate: string;
    /** Originating loan account, for traceability. */
    fromLoanAccount: string;
    /** True for synthetic rules so the UI can badge them. */
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
