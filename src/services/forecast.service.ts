// src/services/forecast.service.ts
//
// Aggregates recurring rules into a monthly forecast: projected
// income, projected fixed expenses, and the residual "discretionary"
// pool the user has left after their unavoidable monthly obligations.
//
// Pure functions only — no I/O. The caller is responsible for
// providing FX rates (operating-currency-per-foreign-unit) so the
// service stays testable without touching beancount.

import type { RecurringRule } from './recurring.service';

/** Avg-days-per-month-based multiplier from any cadence to "per month". */
export const MONTHLY_FACTOR: Record<RecurringRule['cadence'], number> = {
    daily: 365 / 12,
    weekly: 52 / 12,
    biweekly: 26 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    semiannual: 1 / 6,
    yearly: 1 / 12,
};

/** Income/expense classification from account prefixes. */
function classify(rule: RecurringRule): 'income' | 'expense' | 'other' {
    if (
        rule.fundingAccount.startsWith('Income:') ||
        rule.expenseAccount.startsWith('Income:')
    ) {
        return 'income';
    }
    if (
        rule.expenseAccount.startsWith('Expenses:') ||
        rule.fundingAccount.startsWith('Expenses:')
    ) {
        return 'expense';
    }
    return 'other';
}

/** Convert any amount to the operating currency using the rate map.
 * If the currency is the operating one, return as-is. If a rate is
 * missing, returns null — the caller decides how to surface that.
 */
function toOperating(
    amount: number,
    currency: string,
    operating: string,
    fxRates: Record<string, number>,
): number | null {
    if (currency === operating) return amount;
    const rate = fxRates[currency];
    if (!isFinite(rate)) return null;
    return amount * rate;
}

/** A pre-committed amount the user has set aside via an indicator
 * (Budget caps an expense category; Savings commits an asset accrual
 * goal). Both subtract from discretionary residual. */
export interface Commitment {
    name: string;
    /** 'budget' = Expenses cap. 'savings' = Asset accrual (includes
     * legacy 'Target' indicators, treated equivalently). */
    kind: 'budget' | 'savings';
    /** On-disk indicator type, needed by writers. */
    originalType: 'Budget' | 'Target' | 'Savings';
    /** Target/cap in native currency (per cycle). Undefined for
     * percent-based commitments (see `targetPercent`). */
    target: number;
    /** Actual movement against the account this cycle, native currency. */
    actualSpend: number;
    /** Effective drain on discretionary: max(target, actualSpend) for
     * fixed-amount commitments, or max(percent×income, actualSpend) for
     * percent-based ones — always expressed in NATIVE currency. */
    effective: number;
    nativeCurrency: string;
    /** "Monthly" | "Weekly" — used to scale to monthly. Always
     * "Monthly" for percent-based. */
    cycle: string;
    /** Monthly-normalized effective, converted to operating currency.
     * Null when FX rate is missing. */
    monthlyInOperating: number | null;
    /** Mirrors recurring rules: when true, NOT subtracted from
     * residual. Authored as a `discretionary: TRUE` metadata line. */
    discretionary: boolean;
    /** Set when commitment is percent-based. UI shows "X% of income"
     * instead of the fixed amount. */
    targetPercent?: number;
    /** Set when commitment is percent-based: the resolved target in
     * operating currency, = (targetPercent / 100) × monthlyIncome. */
    targetResolvedInOperating?: number;
}

export interface ForecastBreakdownEntry {
    nickname: string;
    kind: 'income' | 'expense';
    /** Original cadence and amount (display verbatim). */
    cadence: RecurringRule['cadence'];
    nativeAmount: number;
    nativeCurrency: string;
    /** Cadence-normalized to monthly, in native currency. */
    monthlyNative: number;
    /** Cadence-normalized to monthly, converted to operating currency.
     * Null when no FX rate is available — the caller can warn + skip.
     */
    monthlyInOperating: number | null;
    /** True for expense rules NOT marked discretionary (i.e. subtracted
     * from income in the residual). Always false for income rules. */
    countsAsFixed: boolean;
    /** True when the rule has `discretionary: TRUE` metadata. */
    discretionary: boolean;
}

export interface ForecastResult {
    operatingCurrency: string;
    monthlyIncome: number;
    monthlyFixedExpenses: number;
    monthlyBudgetCommitments: number;
    monthlySavingsCommitments: number;
    /** income - fixed - budgets - savings. Can be negative. */
    monthlyResidual: number;
    /** (fixed + budgets + savings) / income, 0..1+. NaN if income is 0. */
    fixedConsumptionRatio: number;
    breakdown: ForecastBreakdownEntry[];
    commitments: Commitment[];
    /** Currencies that appeared in rules/commitments but couldn't be converted. */
    missingFxRates: string[];
}

/** Input to the aggregator for indicator commitments. The caller
 * (typically a controller) has already fetched target + actual-spend
 * via BQL. `kind` distinguishes budget caps from savings goals;
 * `originalType` preserves the on-disk indicator type (so toggle
 * writers can rewrite the right `event "Indicator" "<type>"` block). */
export interface CommitmentInput {
    name: string;
    kind: 'budget' | 'savings';
    /** As stored on disk: 'Budget', 'Target', or 'Savings'. Legacy
     * 'Target' values are mapped to kind='savings' for display. */
    originalType: 'Budget' | 'Target' | 'Savings';
    /** Cap or savings target per cycle, native currency. Ignored
     * when `targetPercent` is set. */
    target: number;
    /** Actual movement this cycle (always positive), native currency. */
    actualSpend: number;
    nativeCurrency: string;
    /** "Monthly" | "Weekly" — anything else falls back to monthly.
     * Ignored when `targetPercent` is set (always treated as Monthly). */
    cycle: string;
    /** Opt-out flag from events.beancount metadata. */
    discretionary?: boolean;
    /** When present, `effective` is computed as
     * `(targetPercent / 100) × monthlyIncome` in operating currency,
     * NOT as a fixed amount. Bypasses target/cycle. Range 0-100. */
    targetPercent?: number;
}

/** Per-cycle to monthly factor for budget cycles. */
const BUDGET_CYCLE_FACTOR: Record<string, number> = {
    Monthly: 1,
    Weekly: 52 / 12,
};

/**
 * Compute the monthly forecast across all recurring rules and budget
 * commitments. Rules / budgets whose currency has no FX rate get
 * surfaced with `monthlyInOperating: null` and DO NOT contribute to
 * the totals — the UI can show them so the user fixes prices.
 */
export function aggregateForecast(
    rules: RecurringRule[],
    commitmentsIn: CommitmentInput[],
    operatingCurrency: string,
    fxRates: Record<string, number>,
): ForecastResult {
    let monthlyIncome = 0;
    let monthlyFixedExpenses = 0;
    let monthlyBudgetCommitments = 0;
    let monthlySavingsCommitments = 0;
    const breakdown: ForecastBreakdownEntry[] = [];
    const commitments: Commitment[] = [];
    const missing = new Set<string>();

    for (const rule of rules) {
        const kind = classify(rule);
        if (kind === 'other') continue;

        const factor = MONTHLY_FACTOR[rule.cadence];
        const monthlyNative = rule.amount * factor;
        const monthlyInOp = toOperating(
            monthlyNative,
            rule.currency,
            operatingCurrency,
            fxRates,
        );
        if (monthlyInOp === null) missing.add(rule.currency);

        const discretionary = rule.discretionary === true;
        // Both income and expense rules honor the discretionary flag:
        //   - expense + flag → NOT counted as fixed obligation
        //   - income  + flag → NOT counted as guaranteed monthly income
        // Reasoning: the flag means "exclude from the residual math".
        const countsAsFixed = kind === 'expense' && !discretionary;
        const countsAsIncome = kind === 'income' && !discretionary;

        if (monthlyInOp !== null) {
            if (countsAsIncome) monthlyIncome += monthlyInOp;
            if (countsAsFixed) monthlyFixedExpenses += monthlyInOp;
        }

        breakdown.push({
            nickname: rule.nickname,
            kind,
            cadence: rule.cadence,
            nativeAmount: rule.amount,
            nativeCurrency: rule.currency,
            monthlyNative,
            monthlyInOperating: monthlyInOp,
            countsAsFixed,
            discretionary,
        });
    }

    for (const c of commitmentsIn) {
        const discretionary = c.discretionary === true;
        let monthlyInOp: number | null;
        let effective: number;
        let targetResolvedInOp: number | undefined;

        if (c.targetPercent !== undefined) {
            // Percent-based: resolve against the income computed above.
            // Always treated as Monthly (the percent IS the monthly rate).
            targetResolvedInOp = (c.targetPercent / 100) * monthlyIncome;
            const actualSpendInOp = toOperating(
                c.actualSpend,
                c.nativeCurrency,
                operatingCurrency,
                fxRates,
            );
            if (actualSpendInOp === null) {
                missing.add(c.nativeCurrency);
                monthlyInOp = null;
                effective = c.actualSpend;
            } else {
                monthlyInOp = Math.max(targetResolvedInOp, actualSpendInOp);
                effective = monthlyInOp; // already in operating currency
            }
        } else {
            // Fixed-amount: existing path.
            effective = Math.max(c.target, c.actualSpend);
            const cycleFactor = BUDGET_CYCLE_FACTOR[c.cycle] ?? 1;
            const monthlyNative = effective * cycleFactor;
            monthlyInOp = toOperating(
                monthlyNative,
                c.nativeCurrency,
                operatingCurrency,
                fxRates,
            );
            if (monthlyInOp === null) missing.add(c.nativeCurrency);
        }

        if (monthlyInOp !== null && !discretionary) {
            if (c.kind === 'budget') monthlyBudgetCommitments += monthlyInOp;
            else monthlySavingsCommitments += monthlyInOp;
        }

        commitments.push({
            name: c.name,
            kind: c.kind,
            originalType: c.originalType,
            target: c.target,
            actualSpend: c.actualSpend,
            effective,
            nativeCurrency: c.nativeCurrency,
            cycle: c.targetPercent !== undefined ? 'Monthly' : c.cycle,
            monthlyInOperating: monthlyInOp,
            discretionary,
            ...(c.targetPercent !== undefined
                ? { targetPercent: c.targetPercent, targetResolvedInOperating: targetResolvedInOp }
                : {}),
        });
    }

    const monthlyResidual = monthlyIncome
        - monthlyFixedExpenses
        - monthlyBudgetCommitments
        - monthlySavingsCommitments;
    const consumed = monthlyFixedExpenses
        + monthlyBudgetCommitments
        + monthlySavingsCommitments;
    const fixedConsumptionRatio =
        monthlyIncome > 0 ? consumed / monthlyIncome : NaN;

    return {
        operatingCurrency,
        monthlyIncome,
        monthlyFixedExpenses,
        monthlyBudgetCommitments,
        monthlySavingsCommitments,
        monthlyResidual,
        fixedConsumptionRatio,
        breakdown,
        commitments,
        missingFxRates: Array.from(missing).sort(),
    };
}
