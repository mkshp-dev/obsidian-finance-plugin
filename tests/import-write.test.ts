import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { appendEntries } from '../src/utils/import/ledgerText';
import { writeImport } from '../src/services/import.service';
import type BeancountPlugin from '../src/main';

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

describe('writeImport', () => {
	let root: string;
	let plugin: BeancountPlugin;
	const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'beancount-import-'));
		fs.mkdirSync(path.join(root, 'Finances', 'transactions'), { recursive: true });
		fs.writeFileSync(path.join(root, 'Finances', 'transactions', '2026.beancount'), ';; Transactions for 2026\n');
		fs.writeFileSync(path.join(root, 'Finances', 'balances.beancount'), '2026-01-01 balance Assets:Bank 0 INR\n');

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
	});

	afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

	const txn = (date: string, amount: string) => ({
		date, flag: '*', payee: 'Cafe', narration: 'UPI/Cafe', tags: [], links: [],
		metadata: { 'import-ref': `r-${date}` },
		postings: [{ account: 'Assets:Bank', amount, currency: 'INR' }, { account: 'Expenses:Food' }],
	});

	it('appends transactions and assertions and backs each file up once', async () => {
		const result = await writeImport(plugin, {
			transactions: [txn('2026-09-01', '-10'), txn('2026-09-02', '-20')],
			assertions: [
				{ date: '2026-09-01', account: 'Assets:Bank', amount: '100', currency: 'INR' },
				{ date: '2026-09-03', account: 'Assets:Bank', amount: '70', currency: 'INR' },
			],
		});

		expect(result).toEqual({ transactions: 2, assertions: 2, errors: [] });
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
	});
});
