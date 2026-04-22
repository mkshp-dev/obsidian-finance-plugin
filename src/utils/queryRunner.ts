// src/utils/queryRunner.ts
// BQL query execution — the foundational utility that all other utils depend on.

import { exec } from 'child_process';
import type { ExecException } from 'child_process';
import type BeancountPlugin from '../main';
import { getMainLedgerPath } from './structuredLayout';
import { convertWindowsPathToWsl } from './fileEditor';
import { Logger } from './logger';

/**
 * Executes a Beancount query (BQL) against the configured ledger file.
 *
 * @param {BeancountPlugin} plugin  - The plugin instance (for settings).
 * @param {string}          query   - The BQL query string.
 * @param {string}         [filepath] - Optional path to a specific file. Defaults to the main ledger.
 * @returns {Promise<string>} The CSV output of the query.
 * @throws {Error} If the query fails or command / path is not configured.
 */
export function runQuery(plugin: BeancountPlugin, query: string, filepath?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const filePath = filepath || getMainLedgerPath(plugin);
        const commandName = plugin.settings.beancountCommand;
        if (!filePath) return reject(new Error('File path not set.'));
        if (!commandName) return reject(new Error('Command not set.'));

        // Convert Windows path to WSL path if using WSL
        let queryFilePath = filePath;
        if (commandName.includes('wsl')) {
            queryFilePath = convertWindowsPathToWsl(filePath);
        }

        // Escape double-quotes in query for shell execution
        const escapedQuery = query.replace(/"/g, '\\"');
        const command = `${commandName} -q -f csv "${queryFilePath}" "${escapedQuery}"`;
        Logger.log(`[runQuery] Executing: ${command}`);

        // 50 MB buffer – large ledgers can produce significant CSV output
        exec(command, { maxBuffer: 50 * 1024 * 1024 }, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error) return reject(error);
            if (stderr) return reject(new Error(stderr));

            // Strip lines that are exact query echoes (bean-query sometimes echoes the query back).
            // Only match lines that are identical to the full query — NOT pattern-based filters
            // like 'convert(' or 'sum(', which also appear as column headers in CSV output and
            // would incorrectly strip the header row, causing parseSingleValue to return 0.
            const lines = stdout.split('\n');
            const filteredLines = lines.filter(line => {
                const trimmed = line.trim();
                if (!trimmed) return false;
                if (trimmed === query.trim()) {
                    return false;
                }
                return true;
            });

            const cleanOutput =
                filteredLines.length < lines.length && filteredLines.length > 0
                    ? filteredLines.join('\n')
                    : stdout;

            resolve(cleanOutput);
        });
    });
}
