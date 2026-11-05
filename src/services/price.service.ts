import * as path from 'path';
import { TFile } from 'obsidian';
import type BeancountPlugin from '../main';
import type { PriceFetchResult, PriceData } from '../types';
import { getTargetFile, getMainLedgerPath } from '../utils/structuredLayout';
import { execSafe } from '../utils';
import { Logger } from '../utils/logger';

/**
 * PriceService
 *
 * Fetches all commodity prices in one shot by running:
 *   bean-price <ledger.beancount>
 *
 * bean-price reads the ledger, discovers all commodities that have a
 * `price:` metadata entry, fetches their current prices from the
 * configured sources, and prints ready-to-use Beancount price directives
 * to stdout.  We filter those lines out of the output and append them
 * to prices.beancount.
 *
 * stderr from bean-price is informational only (e.g. balance-check
 * warnings) and is logged but never treated as a failure.
 */
export class PriceService {
	private plugin: BeancountPlugin;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
	}

	// ------------------------------------------------------------------ //
	//  Public API
	// ------------------------------------------------------------------ //

	/**
	 * Runs `bean-price <ledger>`, captures price directives from stdout,
	 * deduplicates them against the existing prices.beancount content,
	 * and appends any new ones.
	 */
	public async fetchAndSavePrices(): Promise<PriceFetchResult> {
		Logger.log('[PriceService] fetchAndSavePrices — starting');

		// 1. Resolve the bean-price executable
		const beanPriceCommand = this.resolveBeanPriceCommand();
		if (!beanPriceCommand) {
			return this.failResult('bean-price command not configured. Please set it up in Settings → Connection.');
		}

		// 2. Resolve the main ledger path
		const ledgerPath = getMainLedgerPath(this.plugin);
		if (!ledgerPath) {
			return this.failResult(`Ledger file not found: ${ledgerPath}`);
		}
		// Ensure ledger exists inside the vault
		// Convert absolute path to vault-relative path
		// @ts-ignore adapter has getBasePath
		const vaultRoot = this.plugin.app.vault.adapter.getBasePath();
		const ledgerRel = path.relative(vaultRoot, ledgerPath).replace(/\\/g, '/');
		const ledgerAbstract = this.plugin.app.vault.getAbstractFileByPath(ledgerRel);
		const ledgerFile = ledgerAbstract instanceof TFile ? ledgerAbstract : null;
		if (!ledgerFile) {
			return this.failResult(`Ledger file not found in vault: ${ledgerRel}`);
		}

		// 3. Resolve prices.beancount path
		const pricesFilePath = getTargetFile(this.plugin, 'price');
		if (!pricesFilePath) {
			return this.failResult('Could not determine prices.beancount path from plugin settings.');
		}

		// 4. Run bean-price on the entire ledger (one command, all commodities)
		const args = [ledgerPath];
		Logger.log(`[PriceService] Executing (safe): ${beanPriceCommand} ${args.join(' ')}`);

		let stdout: string;
		let stderr: string;
		try {
			const result = await Promise.race([
				execSafe(beanPriceCommand, args, { maxBuffer: 20 * 1024 * 1024 }),
				new Promise<never>((_, reject) =>
					window.setTimeout(() => reject(new Error('Timeout: bean-price took longer than 60 seconds')), 60_000)
				),
			]);
			stdout = result.stdout;
			stderr = result.stderr;
		} catch (err) {
			// bean-price exits non-zero when there are balance errors in the
			// ledger — stdout may still contain valid price directives.
			const errorObj = err as { stdout?: string; stderr?: string; message?: string };
			stdout = errorObj.stdout ?? '';
			stderr = errorObj.stderr ?? errorObj.message ?? String(err);
		}

		// Log stderr for diagnostics but do NOT fail on it
		if (stderr.trim()) {
			Logger.log('[PriceService] bean-price stderr (informational):\n' + stderr.trim());
		}

		// 5. Extract price directives from stdout
		const newDirectives = this.extractPriceDirectives(stdout);
		Logger.log(`[PriceService] Found ${newDirectives.length} price directive(s) in bean-price output`);

		if (newDirectives.length === 0) {
			return {
				successful: [],
				failed: [],
				fetchedCount: 0,
				savedCount: 0,
			};
		}

		// 6. Deduplicate: skip any directive that is already in prices.beancount
		// Convert prices file path to vault-relative path and read via vault API
		const pricesRel = path.relative(vaultRoot, pricesFilePath).replace(/\\/g, '/');
		const pricesAbstract = this.plugin.app.vault.getAbstractFileByPath(pricesRel);
		const pricesFile = pricesAbstract instanceof TFile ? pricesAbstract : null;
		const existingContent = pricesFile ? await this.plugin.app.vault.read(pricesFile) : '';

		const toAppend = newDirectives.filter(line => !existingContent.includes(line));
		Logger.log(`[PriceService] ${toAppend.length} new directive(s) to append (${newDirectives.length - toAppend.length} already present)`);

		// 7. Append new directives
		let savedCount = 0;
		if (toAppend.length > 0) {
			const separator = existingContent.endsWith('\n') ? '' : '\n';
			const appendText = separator + toAppend.join('\n') + '\n';
			if (pricesFile) {
				await this.plugin.app.vault.modify(pricesFile, existingContent + appendText);
			} else {
				await this.plugin.app.vault.create(pricesRel, existingContent + appendText);
			}
			savedCount = toAppend.length;
			Logger.log(`[PriceService] Appended ${savedCount} directive(s) to ${pricesFilePath}`);
		}

		// 8. Parse directives into PriceData for the result summary
		const successful = newDirectives.map(line => this.parseDirective(line)).filter(Boolean) as PriceData[];

		return {
			successful,
			failed: [],
			fetchedCount: newDirectives.length,
			savedCount,
		};
	}

	// ------------------------------------------------------------------ //
	//  Private helpers
	// ------------------------------------------------------------------ //

	/**
	 * Filters stdout lines to only those that look like Beancount price
	 * directives: `YYYY-MM-DD price SYMBOL AMOUNT CURRENCY`
	 */
	private extractPriceDirectives(stdout: string): string[] {
		const priceLineRe = /^\d{4}-\d{2}-\d{2}\s+price\s+\S+\s+[\d.]+\s+\S+\s*$/;
		return stdout
			.split('\n')
			.map(l => l.trim())
			.filter(l => priceLineRe.test(l));
	}

	/**
	 * Parses a single price directive line into a PriceData object.
	 * Returns null if the line cannot be parsed.
	 */
	private parseDirective(line: string): { date: string; commodity: string; amount: number; currency: string } | null {
		// Format: YYYY-MM-DD price SYMBOL AMOUNT CURRENCY
		const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+price\s+(\S+)\s+([\d.]+)\s+(\S+)/);
		if (!match) return null;
		return {
			date: match[1],
			commodity: match[2],
			amount: parseFloat(match[3]),
			currency: match[4],
		};
	}

	/**
	 * Returns the bean-price executable path from settings. Requires explicit
	 * configuration (via Settings → Connection or onboarding auto-detect) —
	 * mirrors bean-query's settings-only resolution in queryRunner.ts, so
	 * what's saved in settings is always what actually runs.
	 */
	private resolveBeanPriceCommand(): string | null {
		return this.plugin.settings.beanPriceCommand?.trim() || null;
	}

	/** Whether a usable bean-price command is configured in settings. */
	public hasBeanPriceCommand(): boolean {
		return !!this.resolveBeanPriceCommand();
	}

	/** Builds a zero-count failure result with a single error entry. */
	private failResult(error: string): PriceFetchResult {
		Logger.error('[PriceService]', error);
		return {
			successful: [],
			failed: [{ commodity: '*', source: '*', error }],
			fetchedCount: 0,
			savedCount: 0,
		};
	}
}
