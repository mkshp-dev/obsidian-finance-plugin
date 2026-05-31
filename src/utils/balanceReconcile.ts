// src/utils/balanceReconcile.ts
//
// Keeps forward-dated balance assertions consistent when a new
// transaction is inserted before them.
//
// A `<date> balance` assertion is checked at the START of its date, so a
// transaction dated T shifts the accumulated balance for every assertion
// on the same account+currency dated STRICTLY AFTER T. When a vault keeps
// closing assertions ahead of "today" (e.g. a clean-start cut-over),
// recording a payment silently breaks them with "Balance failed". These
// pure helpers find the affected assertions and rewrite their amounts by
// the posting delta, so callers can offer the user a one-click fix.

export interface BalancePosting {
    account: string;
    /** Signed amount this posting adds to the account (beancount sign). */
    amount: number;
    currency: string;
}

export interface AssertionUpdate {
    /** 0-based line index in the balances file. */
    lineIndex: number;
    date: string;
    account: string;
    currency: string;
    oldAmount: number;
    newAmount: number;
}

// Captures: 1=date, 2=account, 3=amount, 4=currency. Amount allows an
// optional sign, optional thousands commas, and an optional fraction.
const BALANCE_LINE =
    /^(\d{4}-\d{2}-\d{2})\s+balance\s+([A-Z][A-Za-z0-9:_-]*)\s+(-?[0-9][0-9,]*(?:\.[0-9]+)?)\s+([A-Z][A-Z0-9'._-]*)\s*$/;

/** Round away binary-float noise (e.g. 0.1 + 0.2) without imposing a
 * fixed scale — money amounts here never need more than 8 places. */
function roundMoney(n: number): number {
    return parseFloat(n.toFixed(8));
}

function formatAmount(n: number): string {
    // String(parseFloat(...)) drops trailing zeros and normalises -0 → 0.
    return String(roundMoney(n));
}

/**
 * Find balance assertions in `balancesContent` that the given postings
 * would invalidate, and compute their corrected amounts. Only assertions
 * dated strictly after `afterDate` (the transaction date) and matching a
 * posting's account+currency are returned.
 */
export function computeAssertionUpdates(
    balancesContent: string,
    postings: BalancePosting[],
    afterDate: string,
): AssertionUpdate[] {
    const lines = balancesContent.split(/\r?\n/);
    const updates: AssertionUpdate[] = [];

    for (let i = 0; i < lines.length; i++) {
        const m = BALANCE_LINE.exec(lines[i]);
        if (!m) continue;
        const [, date, account, amountRaw, currency] = m;
        // Assertions on/before the txn date are checked before the txn
        // takes effect, so they're untouched.
        if (date <= afterDate) continue;

        let delta = 0;
        let matched = false;
        for (const p of postings) {
            if (p.account === account && p.currency === currency) {
                delta += p.amount;
                matched = true;
            }
        }
        if (!matched || delta === 0) continue;

        const oldAmount = parseFloat(amountRaw.replace(/,/g, ''));
        updates.push({
            lineIndex: i,
            date,
            account,
            currency,
            oldAmount,
            newAmount: roundMoney(oldAmount + delta),
        });
    }
    return updates;
}

/**
 * Apply the computed updates to the balances file content, rewriting only
 * the amount token on each affected line (surrounding whitespace and every
 * other line are left exactly as the user wrote them).
 */
export function applyAssertionUpdates(
    balancesContent: string,
    updates: AssertionUpdate[],
): string {
    if (updates.length === 0) return balancesContent;
    const lines = balancesContent.split(/\r?\n/);

    for (const u of updates) {
        const line = lines[u.lineIndex];
        if (line === undefined) continue;
        const m = BALANCE_LINE.exec(line);
        if (!m) continue; // defensive: line drifted since compute()
        const amountRaw = m[3];
        // Splice just the amount, located right before its currency token.
        const curIdx = line.lastIndexOf(m[4]);
        const amtIdx = line.lastIndexOf(amountRaw, curIdx);
        if (amtIdx < 0) continue;
        lines[u.lineIndex] =
            line.slice(0, amtIdx) + formatAmount(u.newAmount) + line.slice(amtIdx + amountRaw.length);
    }
    return lines.join('\n');
}
