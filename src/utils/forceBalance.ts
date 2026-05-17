// src/utils/forceBalance.ts
//
// Shared "Force Balance" implementation used by LiabilitiesTab and
// BalanceSheetTab. Writes a `pad` + `balance` directive pair to the
// structured-layout files so beancount auto-balances the account to
// the user-supplied amount.
//
// Strategy:
//   - pad date = today
//   - balance date = today + 1
//     (beancount checks balance assertions at the START of the asserted
//     date — using +1 catches everything posted up to end-of-today.)
//   - pad source = Equity:OpeningBalances (matches the vault convention)
//   - same-day same-account pad/balance lines are REPLACED in place
//     rather than appended, so re-running Force Balance updates the
//     existing entries instead of stacking duplicates (which would
//     fail bean-check with "Duplicate balance assertion").

import { Notice } from 'obsidian';
import type BeancountPlugin from '../main';
import { atomicFileWrite, createBackupFile } from './fileEditor';

export interface ForceBalanceParams {
    account: string;
    currency: string;
    amount: number;
}

export async function applyForceBalance(
    plugin: BeancountPlugin,
    params: ForceBalanceParams,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const folder = plugin.settings.structuredFolderName?.trim() || 'Finances';
        const padPath = `${folder}/pads.beancount`;
        const balPath = `${folder}/balances.beancount`;
        const adapter = plugin.app.vault.adapter;
        // @ts-ignore — getBasePath on FileSystemAdapter
        const vaultRoot = adapter.getBasePath() as string;

        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000)
            .toISOString().slice(0, 10);
        const padDirective =
            `${today} pad ${params.account}  Equity:OpeningBalances`;
        const balDirective =
            `${tomorrow} balance ${params.account}  ${params.amount} ${params.currency}`;

        const padLineRe = new RegExp(
            String.raw`^${today}\s+pad\s+${escapeRegex(params.account)}\b.*$\n?`,
            'm',
        );
        const balLineRe = new RegExp(
            String.raw`^${tomorrow}\s+balance\s+${escapeRegex(params.account)}\b.*$\n?`,
            'm',
        );

        await replaceOrAppend(adapter, vaultRoot, padPath, padLineRe, padDirective, 'forceBalance.pad');
        await replaceOrAppend(adapter, vaultRoot, balPath, balLineRe, balDirective, 'forceBalance.balance');

        new Notice(`Forced balance: ${params.account} → ${params.amount} ${params.currency}`);
        return { ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        new Notice(`Force balance failed: ${msg}`);
        return { ok: false, error: msg };
    }
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function replaceOrAppend(
    adapter: any,
    vaultRoot: string,
    relPath: string,
    matchRe: RegExp,
    directive: string,
    backupTag: string,
) {
    const absPath = `${vaultRoot}/${relPath}`;
    if (!(await adapter.exists(relPath))) {
        await adapter.write(relPath, directive + '\n');
        return;
    }
    const cur = await adapter.read(relPath);
    let next: string;
    if (matchRe.test(cur)) {
        next = cur.replace(matchRe, directive + '\n');
    } else {
        next = cur.endsWith('\n') ? cur + directive + '\n' : cur + '\n' + directive + '\n';
    }
    if (next === cur) return;
    await createBackupFile(absPath, true, backupTag);
    await atomicFileWrite(absPath, next);
}
