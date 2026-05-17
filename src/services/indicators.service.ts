// src/services/indicators.service.ts
//
// Pure parser + serializer for `event "Indicator"` directives stored in
// events.beancount. The on-disk format is a date-anchored event with
// 6 metadata lines (key: value):
//
//   2024-01-15 event "Indicator" "Budget"
//       accountQuery: "Expenses:Food"
//       name: "Groceries"
//       cycle: "Monthly"
//       isRollover: 1
//       target: 500.00
//       currency: "USD"
//
// We support three `type` values: Budget, Target, Savings.
//   - Budget   →  Expenses:* accounts, monitor cap-and-spend
//   - Target   →  any Asset growth goal
//   - Savings  →  Asset accounts under a Savings/Investments root
//
// Apart from the picker labels and account filter, all three are
// structurally identical. Treating Savings as a distinct first-class
// type lets the UI surface them separately in the dashboard while
// keeping queries simple (filter on description in BQL).
//
// `applyIndicatorEdits` does a surgical rewrite — it leaves comments
// and unrelated directives untouched, so users can hand-edit the file
// alongside the plugin.

export type IndicatorType = 'Budget' | 'Target' | 'Savings';
export type IndicatorCycle = 'Monthly' | 'Weekly';

export interface Indicator {
    type: IndicatorType;
    name: string;
    accountQuery: string;
    cycle: IndicatorCycle;
    target: number;
    currency: string;
    isRollover: boolean;
    /** ISO YYYY-MM-DD — date the directive is anchored at. */
    startDate: string;
    /** 1-based line number of the `event` line. Set on parse, undefined for new. */
    sourceLine?: number;
    /** 1-based line number of the last metadata line in the block. */
    sourceEndLine?: number;
    /** Opt-out flag for the Monthly Forecast: when true, this
     * indicator's effective amount is NOT subtracted from discretionary
     * residual. Authored as `discretionary: TRUE` metadata. */
    discretionary?: boolean;
    /** Income-percent mode (typical for Savings): when present, the
     * forecast computes effective = (targetPercent / 100) × monthly
     * income instead of using the fixed `target` field. Authored as
     * `targetPercent: 20` metadata. Range 0-100. `target` may be 0
     * (placeholder) when this is set. */
    targetPercent?: number;
}

const TYPES: ReadonlySet<IndicatorType> = new Set(['Budget', 'Target', 'Savings']);
const CYCLES: ReadonlySet<IndicatorCycle> = new Set(['Monthly', 'Weekly']);

const EVENT_HEADER = /^(\d{4}-\d{2}-\d{2})\s+event\s+"Indicator"\s+"([^"]+)"\s*$/;
const META_LINE = /^\s+([A-Za-z]+)\s*:\s*(.*)$/;

/**
 * Parse all Indicator events from a file's content. Tolerant of extra
 * blank lines and comments between blocks; metadata keys can appear in
 * any order. Unknown keys are ignored. Type values outside the supported
 * set cause the directive to be dropped silently — the user's BQL would
 * not pick it up anyway.
 */
export function parseIndicators(content: string): Indicator[] {
    const lines = content.split(/\r?\n/);
    const out: Indicator[] = [];

    for (let i = 0; i < lines.length; i++) {
        const headerMatch = EVENT_HEADER.exec(lines[i]);
        if (!headerMatch) continue;
        const [, startDate, type] = headerMatch;
        if (!TYPES.has(type as IndicatorType)) continue;

        // Greedy capture of subsequent metadata lines. Stop at the first
        // line that isn't a `<tab>key: value` form — blank lines, comments
        // and the next directive all break the block.
        const meta: Record<string, string> = {};
        let endLine = i;
        let j = i + 1;
        for (; j < lines.length; j++) {
            const m = META_LINE.exec(lines[j]);
            if (!m) break;
            meta[m[1]] = stripQuotes(m[2].trim());
            endLine = j;
        }

        const cycle = (meta['cycle'] as IndicatorCycle) || 'Monthly';
        if (!CYCLES.has(cycle)) {
            i = j - 1;
            continue;
        }
        const targetNum = parseFloat(meta['target'] ?? '');
        if (!isFinite(targetNum)) {
            i = j - 1;
            continue;
        }
        const targetPercentRaw = parseFloat(meta['targetPercent'] ?? '');
        const targetPercent =
            isFinite(targetPercentRaw) && targetPercentRaw > 0 && targetPercentRaw <= 100
                ? targetPercentRaw
                : undefined;

        const isDiscretionary =
            meta['discretionary'] === '1' ||
            meta['discretionary'] === 'TRUE' ||
            meta['discretionary'] === 'true';

        out.push({
            type: type as IndicatorType,
            name: meta['name'] ?? '',
            accountQuery: meta['accountQuery'] ?? '',
            cycle,
            target: targetNum,
            currency: meta['currency'] ?? '',
            isRollover: meta['isRollover'] === '1' || meta['isRollover'] === 'TRUE' || meta['isRollover'] === 'true',
            startDate,
            sourceLine: i + 1,
            sourceEndLine: endLine + 1,
            ...(isDiscretionary ? { discretionary: true } : {}),
            ...(targetPercent !== undefined ? { targetPercent } : {}),
        });

        i = j - 1;
    }

    return out;
}

function stripQuotes(s: string): string {
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    return s;
}

/**
 * Toggle the `discretionary: TRUE` metadata for the indicator with
 * the given name+type. Pure: returns the modified content + a
 * `changed` flag so the caller can skip writes when nothing moved.
 * Preserves all unrelated formatting.
 */
export function toggleIndicatorDiscretionaryInText(
    content: string,
    name: string,
    type: IndicatorType,
    value: boolean,
): { changed: boolean; content: string } {
    const lines = content.split(/\r?\n/);
    const FLAG_RE = /^\s+discretionary\s*:/;

    for (let i = 0; i < lines.length; i++) {
        const headerMatch = EVENT_HEADER.exec(lines[i]);
        if (!headerMatch || headerMatch[2] !== type) continue;

        // Walk the metadata block to find this indicator's `name`
        // and the last metadata line index.
        let blockName: string | null = null;
        let lastMetaIdx = i;
        let flagIdx = -1;
        for (let j = i + 1; j < lines.length; j++) {
            const mm = META_LINE.exec(lines[j]);
            if (!mm) break;
            lastMetaIdx = j;
            if (mm[1] === 'name') {
                blockName = stripQuotes(mm[2].trim());
            } else if (mm[1] === 'discretionary') {
                flagIdx = j;
            }
        }

        if (blockName !== name) {
            i = lastMetaIdx;
            continue;
        }

        if (value && flagIdx === -1) {
            lines.splice(lastMetaIdx + 1, 0, '\tdiscretionary: TRUE');
            return { changed: true, content: lines.join('\n') };
        }
        if (!value && flagIdx >= 0) {
            lines.splice(flagIdx, 1);
            return { changed: true, content: lines.join('\n') };
        }
        return { changed: false, content };
    }
    return { changed: false, content };
}

/**
 * Format a single indicator as a beancount event block. Always emits
 * the 7 core fields; appends optional `targetPercent` and
 * `discretionary` lines when set on the indicator. Round-trip with
 * parseIndicators is exact for valid indicators.
 */
export function formatIndicator(ind: Indicator): string {
    const targetStr = Number.isInteger(ind.target)
        ? ind.target.toFixed(2)
        : String(ind.target);
    const lines = [
        `${ind.startDate} event "Indicator" "${ind.type}"`,
        `\taccountQuery: "${ind.accountQuery}"`,
        `\tname: "${ind.name}"`,
        `\tcycle: "${ind.cycle}"`,
        `\tisRollover: ${ind.isRollover ? 1 : 0}`,
        `\ttarget: ${targetStr}`,
        `\tcurrency: "${ind.currency}"`,
    ];
    if (ind.targetPercent !== undefined && ind.targetPercent > 0) {
        lines.push(`\ttargetPercent: ${ind.targetPercent}`);
    }
    if (ind.discretionary === true) {
        lines.push(`\tdiscretionary: TRUE`);
    }
    return lines.join('\n');
}

/**
 * Surgical rewrite. For each indicator in `desired`:
 *   - if it has a sourceLine that matches an indicator block in the
 *     original content, that block (header + metadata) is replaced
 *     with a freshly-formatted block;
 *   - if it has no sourceLine, it's appended at the end of the file
 *     (with a leading blank line for breathing room).
 *
 * Indicators present in the original but missing from `desired` are
 * dropped — that's how delete works. Comments, blank lines and
 * unrelated directives are preserved exactly.
 */
export function applyIndicatorEdits(
    originalContent: string,
    desired: Indicator[],
): string {
    const originalLines = originalContent.split(/\r?\n/);
    const trailingNewline = originalContent.endsWith('\n');
    const originalIndicators = parseIndicators(originalContent);

    // Map start-line → desired indicator. If a desired indicator points
    // at a sourceLine that no longer matches a parsed block, we treat it
    // as a new addition (defensive against external file edits between
    // parse and write).
    const blockByStart = new Map<number, { endLine: number }>();
    for (const r of originalIndicators) {
        if (r.sourceLine && r.sourceEndLine) {
            blockByStart.set(r.sourceLine, { endLine: r.sourceEndLine });
        }
    }

    const desiredByStart = new Map<number, Indicator>();
    const additions: Indicator[] = [];
    for (const d of desired) {
        if (
            typeof d.sourceLine === 'number' &&
            blockByStart.has(d.sourceLine)
        ) {
            desiredByStart.set(d.sourceLine, d);
        } else {
            additions.push(d);
        }
    }

    // Walk lines, skipping or rewriting block ranges as needed.
    const out: string[] = [];
    let i = 0;
    while (i < originalLines.length) {
        const oneBased = i + 1;
        if (blockByStart.has(oneBased)) {
            const { endLine } = blockByStart.get(oneBased)!;
            const replacement = desiredByStart.get(oneBased);
            if (replacement) {
                // Replace the entire block with a freshly-formatted one.
                out.push(formatIndicator(replacement));
            }
            // Block dropped (delete) — skip lines, don't push anything.
            // `endLine` is 1-based; assigning to 0-based `i` already
            // points us at the line AFTER the block, so no extra i++.
            i = endLine;
            continue;
        }
        out.push(originalLines[i]);
        i++;
    }

    // Append additions, separated from the previous content by a blank
    // line if needed (and from each other by a blank line as well).
    if (additions.length > 0) {
        if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
        for (let k = 0; k < additions.length; k++) {
            if (k > 0) out.push('');
            out.push(formatIndicator(additions[k]));
        }
    }

    let result = out.join('\n');
    if (trailingNewline && !result.endsWith('\n')) result += '\n';
    return result;
}

/**
 * Validation that mirrors the form's expectations. Returns {ok:true} or
 * {ok:false, reason} so callers can surface a single short message.
 */
export function validateIndicator(ind: Indicator): { ok: boolean; reason?: string } {
    if (!ind.name.trim()) return { ok: false, reason: 'Name is required' };
    if (!/^[\p{L}\p{N} ._\-/&()]+$/u.test(ind.name.trim()))
        return { ok: false, reason: 'Name has unsupported characters' };
    if (!TYPES.has(ind.type)) return { ok: false, reason: 'Invalid type' };
    if (!CYCLES.has(ind.cycle)) return { ok: false, reason: 'Invalid cycle' };
    const acc = ind.accountQuery.trim();
    if (!acc) return { ok: false, reason: 'Account is required' };
    if (!/^[A-Z][A-Za-z0-9:_-]*$/.test(acc))
        return { ok: false, reason: 'Account must be a valid path' };
    if (!isFinite(ind.target) || ind.target <= 0)
        return { ok: false, reason: 'Target must be a positive number' };
    if (!/^[A-Z][A-Z0-9'._-]*$/.test(ind.currency.trim()))
        return { ok: false, reason: 'Currency must be uppercase' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ind.startDate.trim()))
        return { ok: false, reason: 'Start date must be YYYY-MM-DD' };
    return { ok: true };
}
