import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { addAliasesToOpenDirectives, appendEntries } from '../src/utils/import/ledgerText';
import { writeImport } from '../src/services/import.service';
import type BeancountPlugin from '../src/main';

const { runQuery } = vi.hoisted(() => ({ runQuery: vi.fn<[unknown, string], Promise<string>>() }));
vi.mock('../src/utils/queryRunner', () => ({ runQuery }));

describe('appendEntries', () => {
	it('separates transactions with a blank line', () => {
		expect(appendEntries(';; header\n', ['A\n  x', 'B\n  y'], '\n', true)).toBe(';; header\n\nA\n  x\n\nB\n  y\n');
	});

	it('adds a missing final newline first and keeps single-line entries together', () => {
		expect(appendEntries('x', ['b1', 'b2'], '\n', false)).toBe('x\nb1\nb2\n');
	});

	it('writes into an empty file without leading blank lines', () => {
		expect(appendEntries('', ['A', 'B'], '\n', true)).toBe('A\n\nB\n');
	});

	it('keeps CRLF files CRLF', () => {
		expect(appendEntries('x\r\n', ['A'], '\r\n', true)).toBe('x\r\n\r\nA\r\n');
	});
});

describe('addAliasesToOpenDirectives', () => {
	const ledger = [
		'2020-01-01 open Assets:Bank INR',
		'  description: "Savings"',
		'2020-01-01 open Expenses:Food',
		'  aliases: "Swiggy|Zomato" ; delivery',
		'2020-01-01 open Expenses:Travel',
		'',
	].join('\n');

	it('extends an existing aliases line, keeping its comment and skipping aliases already there', () => {
		const { content, missing } = addAliasesToOpenDirectives(ledger, [{ account: 'Expenses:Food', lineno: 3, aliases: ['zomato', 'City Mall'] }], '\n');
		expect(missing).toEqual([]);
		expect(content.split('\n')[3]).toBe('  aliases: "Swiggy|Zomato|City Mall" ; delivery');
	});

	it('adds an aliases line after the existing metadata', () => {
		const { content } = addAliasesToOpenDirectives(ledger, [{ account: 'Assets:Bank', lineno: 1, aliases: ['ACME "LTD"'] }], '\n');
		expect(content.split('\n').slice(0, 3)).toEqual([
			'2020-01-01 open Assets:Bank INR',
			'  description: "Savings"',
			'  aliases: "ACME \\"LTD\\""',
		]);
	});

	it('edits several directives in one file without line numbers drifting', () => {
		const { content } = addAliasesToOpenDirectives(ledger, [
			{ account: 'Assets:Bank', lineno: 1, aliases: ['NEFT'] },
			{ account: 'Expenses:Travel', lineno: 5, aliases: ['Uber', 'Ola'] },
		], '\n');
		expect(content).toBe([
			'2020-01-01 open Assets:Bank INR',
			'  description: "Savings"',
			'  aliases: "NEFT"',
			'2020-01-01 open Expenses:Food',
			'  aliases: "Swiggy|Zomato" ; delivery',
			'2020-01-01 open Expenses:Travel',
			'  aliases: "Uber|Ola"',
			'',
		].join('\n'));
	});

	it('leaves a line that no longer holds the open directive alone', () => {
		const { content, missing } = addAliasesToOpenDirectives(ledger, [{ account: 'Expenses:Food', lineno: 1, aliases: ['X'] }], '\n');
		expect(missing).toEqual(['Expenses:Food']);
		expect(content).toBe(ledger);
	});

	it("doesn't take an account for a longer one with the same start", () => {
		const { missing } = addAliasesToOpenDirectives('2020-01-01 open Expenses:FoodCourt\n', [{ account: 'Expenses:Food', lineno: 1, aliases: ['X'] }], '\n');
		expect(missing).toEqual(['Expenses:Food']);
	});
});

describe('writeImport', () => {
	let root: string;
	let plugin: BeancountPlugin;
	const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'beancount-import-'));
		fs.mkdirSync(path.join(root, 'Finances', 'transactions'), { recursive: true });
		fs.writeFileSync(path.join(root, 'Finances', 'transactions', '2026.beancount'), ';; Transactions for 2026\n');
		fs.writeFileSync(path.join(root, 'Finances', 'balances.beancount'), '2026-01-01 balance Assets:Bank 0 INR\n');
		fs.writeFileSync(path.join(root, 'Finances', 'accounts.beancount'), '2020-01-01 open Assets:Bank INR\n2020-01-01 open Expenses:Food\n');

		const abs = (p: string) => (path.isAbsolute(p) ? p : path.join(root, p));
		const adapter = {
			getBasePath: () => root,
			read: async (p: string) => fs.promises.readFile(abs(p), 'utf8'),
			write: async (p: string, c: string) => fs.promises.writeFile(abs(p), c, 'utf8'),
			exists: async (p: string) => fs.existsSync(abs(p)),
			copy: async (a: string, b: string) => fs.promises.copyFile(abs(a), abs(b)),
			remove: async (p: string) => fs.promises.unlink(abs(p)),
			rename: async (a: string, b: string) => fs.promises.rename(abs(a), abs(b)),
		};
		plugin = {
			settings: { structuredFolderName: 'Finances', createBackups: true, fileOrganization: 'yearly' },
			app: { vault: { adapter, getAbstractFileByPath: (p: string) => (fs.existsSync(abs(p)) ? {} : null) } },
		} as unknown as BeancountPlugin;

		runQuery.mockReset();
		runQuery.mockResolvedValue(`account,filename,lineno\nExpenses:Food,${path.join(root, 'Finances', 'accounts.beancount')},2\n`);
	});

	afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

	const txn = (date: string, amount: string) => ({
		date, flag: '*', payee: 'Cafe', narration: 'UPI/Cafe', tags: [], links: [],
		metadata: { 'import-ref': `r-${date}` },
		postings: [{ account: 'Assets:Bank', amount, currency: 'INR' }, { account: 'Expenses:Food' }],
	});

	it('appends transactions and assertions, backs each file up once, and saves aliases', async () => {
		const result = await writeImport(plugin, {
			transactions: [txn('2026-09-01', '-10'), txn('2026-09-02', '-20')],
			assertions: [
				{ date: '2026-09-01', account: 'Assets:Bank', amount: '100', currency: 'INR' },
				{ date: '2026-09-03', account: 'Assets:Bank', amount: '70', currency: 'INR' },
			],
			aliases: [{ account: 'Expenses:Food', alias: 'Cafe' }],
		});

		expect(result).toEqual({ transactions: 2, assertions: 2, aliases: 1, errors: [] });
		expect(read('Finances/transactions/2026.beancount')).toBe([
			';; Transactions for 2026',
			'',
			'2026-09-01 * "Cafe" "UPI/Cafe"',
			'  import-ref: "r-2026-09-01"',
			'  Assets:Bank  -10 INR',
			'  Expenses:Food',
			'',
			'2026-09-02 * "Cafe" "UPI/Cafe"',
			'  import-ref: "r-2026-09-02"',
			'  Assets:Bank  -20 INR',
			'  Expenses:Food',
			'',
		].join('\n'));
		expect(read('Finances/transactions/2026.beancount.bak')).toBe(';; Transactions for 2026\n');
		expect(read('Finances/balances.beancount')).toBe([
			'2026-01-01 balance Assets:Bank 0 INR',
			'2026-09-01 balance Assets:Bank  100 INR',
			'2026-09-03 balance Assets:Bank  70 INR',
			'',
		].join('\n'));
		expect(read('Finances/accounts.beancount')).toBe('2020-01-01 open Assets:Bank INR\n2020-01-01 open Expenses:Food\n  aliases: "Cafe"\n');
	});

	it('reports an alias for an account without an open directive', async () => {
		const result = await writeImport(plugin, { transactions: [], assertions: [], aliases: [{ account: 'Expenses:Gifts', alias: 'Florist' }] });
		expect(result.aliases).toBe(0);
		expect(result.errors).toEqual(['Alias "Florist" not saved: Expenses:Gifts has no open directive']);
	});
});
