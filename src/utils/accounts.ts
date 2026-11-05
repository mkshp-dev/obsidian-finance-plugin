// src/utils/accounts.ts
// BQL-backed helpers: open accounts, payees, tags, commodities, account tree builder.

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import type { AccountNode } from '../models/account';
import { runQuery } from './queryRunner';

// --- ACCOUNT TREE ---

/**
 * Builds a hierarchical tree of accounts from a flat list of account name strings.
 *
 * @param {string[]} accounts - e.g. ["Assets:Bank:Checking", "Expenses:Food"]
 */
export function buildAccountTree(accounts: string[]): AccountNode[] {
    const root: AccountNode = { name: 'Root', fullName: '', children: [] };
    accounts.sort();
    for (const account of accounts) {
        if (!account) continue;
        const parts = account.split(':');
        let currentNode = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const fullName = parts.slice(0, i + 1).join(':');
            let childNode = currentNode.children.find(child => child.name === part);
            if (!childNode) {
                childNode = { name: part, fullName: fullName, children: [] };
                currentNode.children.push(childNode);
            }
            currentNode = childNode;
        }
    }
    return root.children;
}

// --- LEDGER QUERIES ---

/**
 * Gets all open accounts using BQL.
 */
export async function getOpenAccounts(plugin: BeancountPlugin): Promise<string[]> {
    try {
        const csv = await runQuery(plugin, `SELECT account FROM #accounts WHERE NOT bool(close)`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as { account: string }[];
        return records.map((row) => row.account).filter((acc) => acc);
    } catch (error) {
        console.error('[getOpenAccounts] Error:', error);
        throw new Error(`Failed to fetch open accounts: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}

/**
 * Fetches all distinct payees from the ledger.
 */
export async function getPayees(plugin: BeancountPlugin): Promise<string[]> {
    try {
        const csv = await runQuery(plugin, `SELECT DISTINCT payee`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as { payee: string }[];
        return records
            .map((row) => row.payee)
            .filter((payee) => payee && payee.trim() !== '')
            .sort();
    } catch (error) {
        console.error('[getPayees] Error:', error);
        return [];
    }
}

/**
 * Fetches all distinct tags from the ledger, splitting multi-tag strings.
 */
export async function getTags(plugin: BeancountPlugin): Promise<string[]> {
    try {
        const csv = await runQuery(plugin, `SELECT DISTINCT joinstr(tags) FROM entries WHERE tags IS NOT NULL`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as Record<string, string>[];

        const allTags = new Set<string>();
        records.forEach((row) => {
            const tagSet = row['joinstr(tags)'] || row.tags || (Object.values(row)[0]);
            if (tagSet && typeof tagSet === 'string') {
                tagSet.split(',').forEach((t) => {
                    const tag = t.trim().replace(/^#/, '');
                    if (tag) allTags.add(tag);
                });
            }
        });

        return Array.from(allTags).sort();
    } catch (error) {
        console.error('[getTags] Error:', error);
        return [];
    }
}

/**
 * Fetches all distinct commodities from the ledger.
 */
export async function getCommodities(plugin: BeancountPlugin): Promise<Array<{ name: string }>> {
    try {
        const csv = await runQuery(plugin, `SELECT name AS name_ FROM #commodities GROUP BY name`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as Record<string, string>[];
        return records
            .map((row) => ({ name: row.name_ || row.name || (Object.values(row)[0] || '') }))
            .filter((c) => c.name && c.name.trim() !== '')
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('[getCommodities] Error:', error);
        return [];
    }
}
