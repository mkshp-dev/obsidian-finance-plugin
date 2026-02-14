// src/utils/structuredLayout.ts

import type BeancountPlugin from '../main';
import { Notice, TFile } from 'obsidian';
import { Logger } from './logger';
import { runQuery } from './index';
import * as path from 'path';
import * as fs from 'fs';

/**
 * File types in the structured layout.
 */
export type FileType = 'ledger' | 'accounts' | 'commodities' | 'prices' | 'pads' | 'balances' | 'notes' | 'events' | 'transactions';

/**
 * Operation types for routing to appropriate files.
 */
export type OperationType = 'transaction' | 'account' | 'commodity' | 'price' | 'pad' | 'balance' | 'note' | 'event';

/**
 * Structured layout file definitions.
 */
export const STRUCTURED_FILES: Record<FileType, string> = {
    ledger: 'ledger.beancount',
    accounts: 'accounts.beancount',
    commodities: 'commodities.beancount',
    prices: 'prices.beancount',
    pads: 'pads.beancount',
    balances: 'balances.beancount',
    notes: 'notes.beancount',
    events: 'events.beancount',
    transactions: 'transactions' // This is a folder
};

/**
 * Create the structured folder layout with all required files.
 * Creates empty directive files - use migrateToStructuredLayout() to populate with data.
 * 
 * @param plugin - The Beancount plugin instance
 * @param folderName - Name of the folder to create (default: "Finances")
 * @returns The absolute path to the created folder
 */
export async function createStructuredFolder(
    plugin: BeancountPlugin,
    folderName: string = 'Finances'
): Promise<string> {
    try {
        const adapter = plugin.app.vault.adapter;
        // @ts-ignore
        const vaultRoot = adapter.getBasePath();
        const folderPath = path.join(vaultRoot, folderName);

        Logger.log('[structuredLayout] Creating structured folder:', folderPath);

        // Create main folder if it doesn't exist
        try {
            await plugin.app.vault.createFolder(folderName);
            Logger.log('[structuredLayout] Created main folder');
        } catch (e: any) {
            // Folder might already exist - only log if it's not that error
            if (!e.message || !e.message.includes('already exists')) {
                Logger.log('[structuredLayout] Folder creation error:', e);
            }
        }

        // Create transactions subfolder
        const transactionsFolderPath = path.join(folderName, 'transactions');
        try {
            await plugin.app.vault.createFolder(transactionsFolderPath);
            Logger.log('[structuredLayout] Created transactions folder');
        } catch (e: any) {
            // Folder might already exist - only log if it's not that error
            if (!e.message || !e.message.includes('already exists')) {
                Logger.log('[structuredLayout] Transactions folder creation error:', e);
            }
        }

        // Create initial year file (current year)
        const currentYear = new Date().getFullYear();
        await ensureYearFile(plugin, folderName, currentYear);

        // Create individual files with empty content
        const files = getEmptyFileContents();
        
        for (const [fileType, fileName] of Object.entries(STRUCTURED_FILES)) {
            if (fileType === 'transactions') continue; // Skip, it's a folder
            if (fileType === 'ledger') continue; // Skip, handled separately with includes
            
            const filePath = path.join(folderName, fileName);
            const content = files[fileType as FileType] || '';
            
            try {
                const existing = plugin.app.vault.getAbstractFileByPath(filePath);
                if (!existing) {
                    await plugin.app.vault.create(filePath, content);
                    Logger.log(`[structuredLayout] Created ${filePath}`);
                } else {
                    Logger.log(`[structuredLayout] ${filePath} already exists, skipping`);
                }
            } catch (e: any) {
                // Only log as error if it's not "already exists"
                if (e.message && e.message.includes('already exists')) {
                    Logger.log(`[structuredLayout] ${filePath} already exists (caught in create), skipping`);
                } else {
                    Logger.error(`[structuredLayout] Failed to create ${filePath}:`, e);
                }
            }
        }

        // Generate and create/update ledger.beancount with include statements
        const includeStatements = generateIncludeStatements(folderName, [currentYear]);
        const ledgerPath = path.join(folderName, STRUCTURED_FILES.ledger);
        
        try {
            const existing = plugin.app.vault.getAbstractFileByPath(ledgerPath);
            if (existing && existing instanceof TFile) {
                // File exists - update it
                await plugin.app.vault.modify(existing, includeStatements);
                Logger.log(`[structuredLayout] Updated ${ledgerPath} with includes`);
            } else if (!existing) {
                // Create new file
                await plugin.app.vault.create(ledgerPath, includeStatements);
                Logger.log(`[structuredLayout] Created ${ledgerPath} with includes`);
            }
        } catch (e: any) {
            // If file was just created by another process, try to read and update it
            if (e.message && e.message.includes('already exists')) {
                Logger.log(`[structuredLayout] ${ledgerPath} already exists, attempting to update...`);
                try {
                    // Wait a moment for the file to be available
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const existing = plugin.app.vault.getAbstractFileByPath(ledgerPath);
                    if (existing && existing instanceof TFile) {
                        await plugin.app.vault.modify(existing, includeStatements);
                        Logger.log(`[structuredLayout] Updated ${ledgerPath} with includes after retry`);
                    }
                } catch (retryError) {
                    Logger.error(`[structuredLayout] Failed to update ledger file after retry:`, retryError);
                    throw retryError;
                }
            } else {
                Logger.error(`[structuredLayout] Failed to create/update ledger file:`, e);
                throw e;
            }
        }

        new Notice(`Structured layout created in ${folderName}/`);
        return folderPath;
    } catch (error: any) {
        Logger.error('[structuredLayout] Failed to create structured folder:', error);
        // Only show user-facing error if it's not just "already exists"
        if (!error.message || !error.message.includes('already exists')) {
            new Notice('Failed to create structured folder layout');
        }
        throw error;
    }
}

/**
 * Generate include statements for the main ledger file.
 * Order is critical: commodities → accounts → prices → pads → balances → notes → events → transactions
 * 
 * @param folderName - Name of the folder (for relative paths)
 * @param years - Array of years that have transaction files
 * @returns The complete ledger.beancount content with includes
 */
export function generateIncludeStatements(folderName: string, years: number[]): string {
    const header = `;; Main Ledger File
;; Auto-generated by Beancount for Obsidian
;; 
;; WARNING: Include statements are managed automatically.
;; Manual edits to include directives may be overwritten.

option "title" "Personal Finance"
option "operating_currency" "USD"

`;

    const includes: string[] = [
        ';; Order matters: commodities must be defined before accounts',
        `include "commodities.beancount"`,
        '',
        ';; Chart of accounts',
        `include "accounts.beancount"`,
        '',
        ';; Price data',
        `include "prices.beancount"`,
        '',
        ';; Pads and balance assertions',
        `include "pads.beancount"`,
        `include "balances.beancount"`,
        '',
        ';; Notes and events',
        `include "notes.beancount"`,
        `include "events.beancount"`,
        '',
        ';; Transaction files by year (newest first)',
    ];

    // Add transaction files in descending order (newest first)
    const sortedYears = [...years].sort((a, b) => b - a);
    for (const year of sortedYears) {
        includes.push(`include "transactions/${year}.beancount"`);
    }

    return header + includes.join('\n') + '\n';
}

/**
 * Ensure a year file exists in the transactions folder.
 * Creates the file if it doesn't exist and updates the main ledger's includes.
 * 
 * @param plugin - The Beancount plugin instance
 * @param folderName - Name of the structured folder
 * @param year - The year to ensure exists
 */
export async function ensureYearFile(
    plugin: BeancountPlugin,
    folderName: string,
    year: number
): Promise<void> {
    const yearFileName = `${year}.beancount`;
    const yearFilePath = path.join(folderName, 'transactions', yearFileName);
    
    const existing = plugin.app.vault.getAbstractFileByPath(yearFilePath);
    
    if (!existing) {
        // Create new year file
        const content = `;; Transactions for ${year}
;; Auto-generated by Beancount for Obsidian

`;
        
        try {
            await plugin.app.vault.create(yearFilePath, content);
            Logger.log(`[structuredLayout] Created year file: ${yearFilePath}`);
            
            // Update ledger.beancount to include this year
            await updateLedgerIncludes(plugin, folderName);
            
            new Notice(`Created ${year} transaction file`);
        } catch (e: any) {
            // If file already exists, just log it - don't throw
            if (e.message && e.message.includes('already exists')) {
                Logger.log(`[structuredLayout] Year file ${yearFilePath} already exists, skipping`);
            } else {
                Logger.error(`[structuredLayout] Failed to create year file ${yearFilePath}:`, e);
                throw e;
            }
        }
    } else {
        Logger.log(`[structuredLayout] Year file ${yearFilePath} already exists`);
    }
}

/**
 * Update the main ledger file's include statements based on existing year files.
 * 
 * @param plugin - The Beancount plugin instance
 * @param folderName - Name of the structured folder
 */
async function updateLedgerIncludes(
    plugin: BeancountPlugin,
    folderName: string
): Promise<void> {
    try {
        // Scan transactions folder for year files
        const transactionsFolderPath = path.join(folderName, 'transactions');
        const files = plugin.app.vault.getFiles().filter(f => 
            f.path.startsWith(transactionsFolderPath) && f.extension === 'beancount'
        );
        
        // Extract years from filenames
        const years: number[] = [];
        for (const file of files) {
            const match = file.basename.match(/^(\d{4})$/);
            if (match) {
                years.push(parseInt(match[1], 10));
            }
        }
        
        // Generate new include statements
        const includeStatements = generateIncludeStatements(folderName, years);
        
        // Update ledger file
        const ledgerPath = path.join(folderName, STRUCTURED_FILES.ledger);
        const ledgerFile = plugin.app.vault.getAbstractFileByPath(ledgerPath);
        
        if (ledgerFile && ledgerFile instanceof TFile) {
            await plugin.app.vault.modify(ledgerFile, includeStatements);
            Logger.log(`[structuredLayout] Updated ledger includes with years:`, years);
        }
    } catch (e) {
        Logger.error('[structuredLayout] Failed to update ledger includes:', e);
    }
}

/**
 * Get the target file path for a given operation type.
 * 
 * @param plugin - The Beancount plugin instance
 * @param operationType - The type of operation being performed
 * @param date - Optional date for transaction routing (to determine year)
 * @returns The absolute path to the target file
 */
export function getTargetFile(
    plugin: BeancountPlugin,
    operationType: OperationType,
    date?: string
): string {
    const folderName = plugin.settings.structuredFolderName || 'Finances';
    // @ts-ignore
    const vaultRoot = plugin.app.vault.adapter.getBasePath();
    
    let relativePath: string;
    
    switch (operationType) {
        case 'transaction':
            if (date) {
                const year = new Date(date).getFullYear();
                relativePath = path.join(folderName, 'transactions', `${year}.beancount`);
            } else {
                // Default to current year
                const currentYear = new Date().getFullYear();
                relativePath = path.join(folderName, 'transactions', `${currentYear}.beancount`);
            }
            break;
        case 'account':
            relativePath = path.join(folderName, STRUCTURED_FILES.accounts);
            break;
        case 'commodity':
            relativePath = path.join(folderName, STRUCTURED_FILES.commodities);
            break;
        case 'price':
            relativePath = path.join(folderName, STRUCTURED_FILES.prices);
            break;
        case 'pad':
            relativePath = path.join(folderName, STRUCTURED_FILES.pads);
            break;
        case 'balance':
            relativePath = path.join(folderName, STRUCTURED_FILES.balances);
            break;
        case 'note':
            relativePath = path.join(folderName, STRUCTURED_FILES.notes);
            break;
        case 'event':
            relativePath = path.join(folderName, STRUCTURED_FILES.events);
            break;
        default:
            // Fallback to ledger file
            relativePath = path.join(folderName, STRUCTURED_FILES.ledger);
    }
    
    return path.join(vaultRoot, relativePath);
}

/**
 * Get the path to the main ledger file (entry point for BQL queries).
 * 
 * @param plugin - The Beancount plugin instance
 * @returns The absolute path to ledger.beancount
 */
export function getMainLedgerPath(plugin: BeancountPlugin): string {
    const folderName = plugin.settings.structuredFolderName || 'Finances';
    // @ts-ignore
    const vaultRoot = plugin.app.vault.adapter.getBasePath();
    return path.join(vaultRoot, folderName, STRUCTURED_FILES.ledger);
}

/**
 * Get empty file contents for initial setup.
 */
function getEmptyFileContents(): Record<FileType, string> {
    return {
        ledger: '', // Will be generated with includes
        accounts: `;; Chart of Accounts
;; Define your account structure here

`,
        commodities: `;; Commodity Definitions
;; Define commodities (currencies, stocks, etc.) here

`,
        prices: `;; Price Data
;; Historical price information

`,
        pads: `;; Pad Directives
;; Automatic balance padding entries

`,
        balances: `;; Balance Assertions
;; Balance verification statements

`,
        notes: `;; Notes
;; Account and transaction notes

`,
        events: `;; Events
;; Financial events and milestones

`,
        transactions: '' // Folder, not a file
    };
}

/**
 * Migration: Convert existing single-file ledger to structured layout.
 * Uses BQL PRINT statements to extract directives by type.
 * 
 * @param plugin - The Beancount plugin instance
 * @param targetFolderName - Name of folder to create for structured layout
 * @returns Promise with success status
 */
export async function migrateToStructuredLayout(
    plugin: BeancountPlugin,
    targetFolderName: string = 'Finances'
): Promise<{ success: boolean; error?: string }> {
    try {
        Logger.log('[Migration] Starting migration to structured layout');
        
        // Validate that we have a source file
        const sourceFile = plugin.settings.beancountFilePath;
        if (!sourceFile) {
            return { success: false, error: 'No source Beancount file configured' };
        }

        // Check if source file exists
        const sourceFileName = sourceFile.split(/[/\\]/).pop() || 'unknown';
        Logger.log(`[Migration] Source file: ${sourceFile}`);

        // Step 0: Check if target folder already exists
        const existingFolder = plugin.app.vault.getAbstractFileByPath(targetFolderName);
        if (existingFolder) {
            return {
                success: false,
                error: `Folder "${targetFolderName}" already exists. Please delete it manually or choose a different folder name.`
            };
        }

        // Step 1: Create just the folder structure (not the files - migration will create them with content)
        Logger.log(`[Migration] Creating folder structure: ${targetFolderName}`);
        try {
            await plugin.app.vault.createFolder(targetFolderName);
        } catch (e: any) {
            if (!e.message || !e.message.includes('already exists')) {
                throw e;
            }
        }
        
        const transactionsFolderPath = path.join(targetFolderName, 'transactions');
        try {
            await plugin.app.vault.createFolder(transactionsFolderPath);
        } catch (e: any) {
            if (!e.message || !e.message.includes('already exists')) {
                throw e;
            }
        }

        // Step 2: Extract all unique years from transactions
        Logger.log('[Migration] Extracting transaction years...');
        const years = await extractTransactionYears(plugin);
        Logger.log(`[Migration] Found years: ${years.join(', ')}`);

        // Step 3: Migrate each directive type
        const migrations = [
            { type: 'commodity', file: STRUCTURED_FILES.commodities, query: "PRINT FROM type='commodity'" },
            { type: 'open/close', file: STRUCTURED_FILES.accounts, query: "PRINT FROM type='open' OR type='close'" },
            { type: 'price', file: STRUCTURED_FILES.prices, query: "PRINT FROM type='price'" },
            { type: 'pad', file: STRUCTURED_FILES.pads, query: "PRINT FROM type='pad'" },
            { type: 'balance', file: STRUCTURED_FILES.balances, query: "PRINT FROM type='balance'" },
            { type: 'note', file: STRUCTURED_FILES.notes, query: "PRINT FROM type='note'" },
            { type: 'event', file: STRUCTURED_FILES.events, query: "PRINT FROM type='event'" }
        ];

        // Migrate non-transaction directives
        for (const migration of migrations) {
            Logger.log(`[Migration] Migrating ${migration.type}...`);
            try {
                const content = await runQuery(plugin, migration.query);
                const filePath = path.join(targetFolderName, migration.file);
                
                if (content && content.trim()) {
                    await writeToFile(plugin, filePath, content);
                    Logger.log(`[Migration] ✓ Migrated ${migration.type} to ${migration.file}`);
                } else {
                    // Create empty file so includes don't break
                    await writeToFile(plugin, filePath, '');
                    Logger.log(`[Migration] - No ${migration.type} directives found, created empty file`);
                }
            } catch (error) {
                Logger.log(`[Migration] ! Failed to migrate ${migration.type}: ${error}`);
                // Continue with other types even if one fails
            }
        }

        // Step 4: Migrate transactions year by year
        Logger.log('[Migration] Migrating transactions by year...');
        for (const year of years) {
            try {
                const query = `PRINT FROM type='transaction' AND year=${year}`;
                const content = await runQuery(plugin, query);
                const yearFilePath = path.join(targetFolderName, 'transactions', `${year}.beancount`);
                
                if (content && content.trim()) {
                    await writeToFile(plugin, yearFilePath, content);
                    Logger.log(`[Migration] ✓ Migrated ${year} transactions to transactions/${year}.beancount`);
                } else {
                    // Create empty file so includes don't break
                    await writeToFile(plugin, yearFilePath, '');
                    Logger.log(`[Migration] - No transactions found for ${year}, created empty file`);
                }
            } catch (error) {
                Logger.error(`[Migration] ! Failed to migrate ${year} transactions:`, error);
                // Continue with other years
            }
        }

        // Step 5: Update main ledger with includes
        Logger.log('[Migration] Generating main ledger with includes...');
        const includeStatements = generateIncludeStatements(targetFolderName, years);
        const ledgerPath = path.join(targetFolderName, STRUCTURED_FILES.ledger);
        await writeToFile(plugin, ledgerPath, includeStatements);

        // Step 6: Update plugin settings
        const mainLedgerPath = getMainLedgerPath(plugin);
        plugin.settings.structuredFolderName = targetFolderName;
        plugin.settings.structuredFolderPath = mainLedgerPath;
        plugin.settings.beancountFilePath = mainLedgerPath;
        await plugin.saveSettings();

        Logger.log('[Migration] ✓ Migration completed successfully!');
        new Notice(`Migration complete! Files created in ${targetFolderName}/`);
        
        return { success: true };
    } catch (error) {
        Logger.error('[Migration] Migration failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extract all unique years from transactions in the current ledger.
 * 
 * @param plugin - The Beancount plugin instance
 * @returns Array of years as numbers
 */
async function extractTransactionYears(plugin: BeancountPlugin): Promise<number[]> {
    try {
        // Query to get all transaction years
        const query = "SELECT DISTINCT year FROM type='transaction' ORDER BY year";
        const csvOutput = await runQuery(plugin, query);
        
        if (!csvOutput || !csvOutput.trim()) {
            Logger.log('[Migration] No transactions found');
            return [];
        }

        // Parse CSV output (skip header, extract year column)
        const lines = csvOutput.trim().split('\n');
        const years: number[] = [];
        
        for (let i = 1; i < lines.length; i++) { // Skip header row
            const line = lines[i].trim();
            if (line) {
                const year = parseInt(line, 10);
                if (!isNaN(year) && year > 1900 && year < 2100) {
                    years.push(year);
                }
            }
        }
        
        return years.sort((a, b) => a - b); // Sort ascending
    } catch (error) {
        Logger.error('[Migration] Failed to extract transaction years:', error);
        // Fallback: return current year
        return [new Date().getFullYear()];
    }
}

/**
 * Write content to a file in the vault, handling both new and existing files.
 * 
 * @param plugin - The Beancount plugin instance
 * @param relativePath - Relative path from vault root
 * @param content - Content to write
 */
async function writeToFile(
    plugin: BeancountPlugin,
    relativePath: string,
    content: string
): Promise<void> {
    try {
        const existing = plugin.app.vault.getAbstractFileByPath(relativePath);
        
        if (existing && existing instanceof TFile) {
            // File exists - replace content (migration always does fresh write)
            await plugin.app.vault.modify(existing, content);
        } else {
            // Create new file, with fallback to modify if it was just created
            try {
                await plugin.app.vault.create(relativePath, content);
            } catch (createError: any) {
                // If file was just created by another process, try to modify it
                if (createError.message && createError.message.includes('already exists')) {
                    const file = plugin.app.vault.getAbstractFileByPath(relativePath);
                    if (file && file instanceof TFile) {
                        await plugin.app.vault.modify(file, content);
                    } else {
                        throw createError;
                    }
                } else {
                    throw createError;
                }
            }
        }
    } catch (error) {
        Logger.error(`[Migration] Failed to write to ${relativePath}:`, error);
        throw error;
    }
}

