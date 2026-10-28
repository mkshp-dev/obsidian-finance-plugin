import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { setOpenDirectiveMetadata, updateAccountAliases, updateAccountReconcileMetadata } from '../src/utils/directives/accountDirectives';
import { createPadDirective } from '../src/utils/directives/padDirectives';
import type BeancountPlugin from '../src/main';

/**
 * Minimal fake plugin backed by a real scratch directory on disk, so these
 * tests exercise the actual read/write/splice logic exactly as production
 * does (via plugin.app.vault.adapter), not a stubbed-out mock.
 */
function makeFakePlugin(rootDir: string): BeancountPlugin {
	const resolvePath = (relativePath: string) => path.join(rootDir, relativePath);

	const adapter = {
		getBasePath: () => rootDir,
		read: async (relativePath: string) => fs.promises.readFile(resolvePath(relativePath), 'utf8'),
		write: async (relativePath: string, content: string) => fs.promises.writeFile(resolvePath(relativePath), content, 'utf8'),
		exists: async (relativePath: string) => fs.existsSync(resolvePath(relativePath)),
		copy: async (src: string, dest: string) => fs.promises.copyFile(resolvePath(src), resolvePath(dest)),
		remove: async (relativePath: string) => fs.promises.unlink(resolvePath(relativePath)),
		rename: async (src: string, dest: string) => fs.promises.rename(resolvePath(src), resolvePath(dest)),
	};

	return {
		settings: { structuredFolderName: '', createBackups: false },
		app: { vault: { adapter } },
	} as unknown as BeancountPlugin;
}

describe('updateAccountReconcileMetadata', () => {
	let tmpDir: string;
	let plugin: BeancountPlugin;
	let accountsFile: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beancount-test-'));
		plugin = makeFakePlugin(tmpDir);
		accountsFile = path.join(tmpDir, 'accounts.beancount');
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('updates an existing reconcile line while preserving other metadata', async () => {
		fs.writeFileSync(
			accountsFile,
			[
				'2020-01-01 open Assets:Checking                                 USD',
				'  description: "Primary checking account"',
				'  reconcile: 14',
				'2020-01-01 open Assets:Savings                                  USD',
			].join('\n') + '\n'
		);

		const result = await updateAccountReconcileMetadata(plugin, 'Assets:Checking', accountsFile, 1, 21, false);
		expect(result.success).toBe(true);

		const content = fs.readFileSync(accountsFile, 'utf8');
		expect(content).toContain('  description: "Primary checking account"');
		expect(content).toContain('  reconcile: 21');
		expect(content).not.toContain('reconcile: 14');
	});

	it('clears reconcile while leaving other metadata untouched', async () => {
		fs.writeFileSync(
			accountsFile,
			[
				'2020-01-01 open Assets:Checking                                 USD',
				'  description: "Primary checking account"',
				'  reconcile: 14',
			].join('\n') + '\n'
		);

		const result = await updateAccountReconcileMetadata(plugin, 'Assets:Checking', accountsFile, 1, null, false);
		expect(result.success).toBe(true);

		const content = fs.readFileSync(accountsFile, 'utf8');
		expect(content).toContain('  description: "Primary checking account"');
		expect(content).not.toContain('reconcile');
	});

	it('removes the whole metadata block when clearing the only metadata line', async () => {
		fs.writeFileSync(
			accountsFile,
			[
				'2020-01-01 open Assets:Checking                                 USD',
				'  reconcile: 14',
				'2020-01-01 open Assets:Savings                                  USD',
			].join('\n') + '\n'
		);

		const result = await updateAccountReconcileMetadata(plugin, 'Assets:Checking', accountsFile, 1, null, false);
		expect(result.success).toBe(true);

		const lines = fs.readFileSync(accountsFile, 'utf8').split('\n');
		expect(lines[0]).toBe('2020-01-01 open Assets:Checking                                 USD');
		expect(lines[1]).toBe('2020-01-01 open Assets:Savings                                  USD');
	});

	it('inserts reconcile into an existing metadata block that has other keys', async () => {
		fs.writeFileSync(
			accountsFile,
			[
				'2020-01-01 open Assets:Investments                              USD,MSFT,GOOGL,AAPL',
				'  description: "Investment brokerage account"',
			].join('\n') + '\n'
		);

		const result = await updateAccountReconcileMetadata(plugin, 'Assets:Investments', accountsFile, 1, 90, false);
		expect(result.success).toBe(true);

		const content = fs.readFileSync(accountsFile, 'utf8');
		expect(content).toContain('  description: "Investment brokerage account"');
		expect(content).toContain('  reconcile: 90');
	});

	it('creates a brand-new metadata block when the open directive has none', async () => {
		fs.writeFileSync(
			accountsFile,
			[
				'2020-01-01 open Expenses:Food:Groceries                         USD',
				'2020-01-01 open Expenses:Food:Dining                            USD',
			].join('\n') + '\n'
		);

		const result = await updateAccountReconcileMetadata(plugin, 'Expenses:Food:Groceries', accountsFile, 1, 30, false);
		expect(result.success).toBe(true);

		const lines = fs.readFileSync(accountsFile, 'utf8').split('\n');
		expect(lines[1]).toBe('  reconcile: 30');
		expect(lines[2]).toBe('2020-01-01 open Expenses:Food:Dining                            USD');
	});

	it('is a no-op when clearing an account that has no reconcile metadata', async () => {
		const original = '2020-01-01 open Assets:Investments                              USD\n  description: "no reconcile here"\n';
		fs.writeFileSync(accountsFile, original);

		const result = await updateAccountReconcileMetadata(plugin, 'Assets:Investments', accountsFile, 1, null, false);
		expect(result.success).toBe(true);
		expect(fs.readFileSync(accountsFile, 'utf8')).toBe(original);
	});

	it('fails safely when the line number no longer points at the expected open directive', async () => {
		fs.writeFileSync(accountsFile, '2020-01-01 open Assets:Checking USD\n');

		const result = await updateAccountReconcileMetadata(plugin, 'Assets:Savings', accountsFile, 1, 30, false);
		expect(result.success).toBe(false);
		expect(result.error).toContain('not found');
	});
});

describe('createPadDirective', () => {
	let tmpDir: string;
	let plugin: BeancountPlugin;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beancount-test-'));
		plugin = makeFakePlugin(tmpDir);
		fs.mkdirSync(path.join(tmpDir, 'Finances'), { recursive: true });
		fs.writeFileSync(path.join(tmpDir, 'Finances', 'pads.beancount'), '2019-12-31 pad Assets:Old Equity:Opening-Balances\n');
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('appends a pad directive at the given date', async () => {
		const result = await createPadDirective(plugin, '2026-08-19', 'Assets:Checking', 'Equity:Opening-Balances', false);
		expect(result.success).toBe(true);

		const content = fs.readFileSync(path.join(tmpDir, 'Finances', 'pads.beancount'), 'utf8');
		expect(content).toContain('2026-08-19 pad Assets:Checking Equity:Opening-Balances');
		// Existing content preserved, new directive appended after it.
		expect(content.indexOf('2019-12-31')).toBeLessThan(content.indexOf('2026-08-19'));
	});
});

describe('setOpenDirectiveMetadata', () => {
	const ledger = [
		'2020-01-01 open Assets:Bank INR',
		'  description: "Savings"',
		'  ; kept with the directive',
		'2020-01-01 open Expenses:Food',
		'  aliases: "Swiggy|Zomato" ; delivery',
		'2020-01-01 open Expenses:FoodCourt',
		'',
	].join('\n');

	it('replaces a value, keeping its comment', () => {
		const out = setOpenDirectiveMetadata(ledger, 'Expenses:Food', 4, 'aliases', 'Swiggy|Zomato|City "Mall"', '\n');
		expect(out!.split('\n')[4]).toBe('  aliases: "Swiggy|Zomato|City \\"Mall\\"" ; delivery');
	});

	it('adds a key after the metadata, before trailing comments', () => {
		const out = setOpenDirectiveMetadata(ledger, 'Assets:Bank', 1, 'aliases', 'NEFT', '\n');
		expect(out!.split('\n').slice(0, 4)).toEqual([
			'2020-01-01 open Assets:Bank INR',
			'  description: "Savings"',
			'  aliases: "NEFT"',
			'  ; kept with the directive',
		]);
	});

	it('removes a key, and leaves a missing one alone', () => {
		expect(setOpenDirectiveMetadata(ledger, 'Expenses:Food', 4, 'aliases', null, '\n')).toBe(ledger.replace('  aliases: "Swiggy|Zomato" ; delivery\n', ''));
		expect(setOpenDirectiveMetadata(ledger, 'Assets:Bank', 1, 'aliases', null, '\n')).toBe(ledger);
	});

	it("refuses a line that doesn't hold that account's open directive", () => {
		expect(setOpenDirectiveMetadata(ledger, 'Expenses:Food', 1, 'aliases', 'X', '\n')).toBeNull();
		// Not fooled by an account that only starts the same.
		expect(setOpenDirectiveMetadata(ledger, 'Expenses:Food', 6, 'aliases', 'X', '\n')).toBeNull();
	});
});

describe('updateAccountAliases', () => {
	let tmpDir: string;
	let plugin: BeancountPlugin;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beancount-test-'));
		plugin = makeFakePlugin(tmpDir);
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('writes several accounts in one file, and clears aliases', async () => {
		const file = path.join(tmpDir, 'accounts.beancount');
		fs.writeFileSync(file, '2020-01-01 open Assets:Bank\n2020-01-01 open Expenses:Food\n  aliases: "Swiggy"\n2020-01-01 open Expenses:Travel\n');

		// Line numbers as read before any change: adding to Assets:Bank mustn't move the others' edits.
		expect(await updateAccountAliases(plugin, [
			{ account: 'Assets:Bank', filename: file, lineno: 1, aliases: ['NEFT'] },
			{ account: 'Expenses:Food', filename: file, lineno: 2, aliases: [] },
			{ account: 'Expenses:Travel', filename: file, lineno: 4, aliases: ['Uber', 'Ola'] },
		], false)).toEqual({ saved: 3, errors: [] });
		expect(fs.readFileSync(file, 'utf8')).toBe([
			'2020-01-01 open Assets:Bank',
			'  aliases: "NEFT"',
			'2020-01-01 open Expenses:Food',
			'2020-01-01 open Expenses:Travel',
			'  aliases: "Uber|Ola"',
			'',
		].join('\n'));
	});

	it('skips a directive that has moved', async () => {
		const file = path.join(tmpDir, 'accounts.beancount');
		fs.writeFileSync(file, '2020-01-01 open Expenses:Food\n');
		const result = await updateAccountAliases(plugin, [{ account: 'Expenses:Food', filename: file, lineno: 2, aliases: ['X'] }], false);
		expect(result.saved).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(fs.readFileSync(file, 'utf8')).toBe('2020-01-01 open Expenses:Food\n');
	});
});
