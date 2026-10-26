// src/utils/import/expression.ts
// The formula language of import template fields: what follows `=`.
//
//   ={{Deposit}} - {{Withdrawal}}
//   =IF {{Description}} STARTS WITH "CHRG:" THEN "Expenses:Bank:Fees"
//    ELSE ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"
//   =SPLIT({{Description}}, "/", 2) + " (" + {{Chq /Ref No.}} + ")"
//
// Parsed into a tree and evaluated directly; nothing is passed to eval.

import { addDays, formatDatePattern, parseDatePattern } from './values';

export type ValueType = 'text' | 'number' | 'date' | 'bool';

export type CompareOp = '<' | '>' | '<=' | '>=' | '==' | '!=';
export type TextOp = 'CONTAINS' | 'STARTS WITH' | 'ENDS WITH';

export type Expr =
	| { type: 'column'; name: string }
	| { type: 'text'; value: string }
	| { type: 'number'; value: string }
	| { type: 'negate'; operand: Expr }
	| { type: 'not'; operand: Expr }
	| { type: 'arith'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr }
	| { type: 'compare'; op: CompareOp | TextOp; left: Expr; right: Expr }
	| { type: 'logic'; op: 'AND' | 'OR'; left: Expr; right: Expr }
	| { type: 'empty'; operand: Expr; negated: boolean }
	| { type: 'if'; cond: Expr; then: Expr; else?: Expr }
	| { type: 'lookup'; returns: 'account' | 'alias'; operand: Expr; mode: 'contains' | 'exact'; fallback?: Expr }
	| { type: 'call'; name: FunctionName; args: Expr[] };

export class FormulaError extends Error {}

// --- Functions ---

type Param = 'text' | 'number' | 'date' | 'any';

const FUNCTIONS = {
	FORMAT_DATE: { params: ['date', 'text'], returns: 'text', help: 'FORMAT_DATE(date, "YYYY-MM-DD"): the date written with a pattern. YYYY, YY, MMMM (September), MMM (Sep), MM, M, DD, D' },
	YEAR: { params: ['date'], returns: 'number', help: 'YEAR(date): the year, e.g. 2026' },
	MONTH: { params: ['date'], returns: 'number', help: 'MONTH(date): the month, 1 to 12' },
	DAY: { params: ['date'], returns: 'number', help: 'DAY(date): the day of the month' },
	ADD_DAYS: { params: ['date', 'number'], returns: 'date', help: 'ADD_DAYS(date, 1): a date that many days later (or earlier, if negative)' },
	DATE: { params: ['text', 'text'], returns: 'date', help: 'DATE(text, "DD/MM/YYYY"): reads a date out of text written with that pattern' },
	SPLIT: { params: ['text', 'text', 'number'], returns: 'text', help: 'SPLIT(text, "/", 2): the 2nd part when split at "/"' },
	TRIM: { params: ['text'], returns: 'text', help: 'TRIM(text): without extra spaces' },
	UPPER: { params: ['text'], returns: 'text', help: 'UPPER(text)' },
	LOWER: { params: ['text'], returns: 'text', help: 'LOWER(text)' },
	REPLACE: { params: ['text', 'text', 'text'], returns: 'text', help: 'REPLACE(text, "find", "with")' },
	ABS: { params: ['number'], returns: 'number', help: 'ABS(number): without its sign' },
	ROUND: { params: ['number', 'number'], optional: 1, returns: 'number', help: 'ROUND(number, 2)' },
	FIRST: { params: ['any'], variadic: true, returns: 'any', help: 'FIRST(a, b, …): the first one that isn\'t empty' },
} as const satisfies Record<string, { params: readonly Param[]; returns: ValueType | 'any'; help: string; optional?: number; variadic?: boolean }>;

export type FunctionName = keyof typeof FUNCTIONS;

export const FUNCTION_NAMES = Object.keys(FUNCTIONS) as FunctionName[];

export function functionHelp(name: FunctionName): string {
	return FUNCTIONS[name].help;
}

// --- Tokens ---

interface Token {
	kind: 'column' | 'string' | 'number' | 'word' | 'op' | 'end';
	value: string;
}

const OPERATORS = ['<=', '>=', '==', '!=', '<', '>', '+', '-', '*', '/', '(', ')', ','];

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const ch = source[i];
		if (/\s/.test(ch)) { i++; continue; }

		if (source.startsWith('{{', i)) {
			const end = source.indexOf('}}', i + 2);
			const name = end < 0 ? '' : source.slice(i + 2, end);
			if (end < 0 || /[{}]/.test(name)) throw new FormulaError('A column name is missing its closing }}');
			tokens.push({ kind: 'column', value: name.trim() });
			i = end + 2;
			continue;
		}

		if (ch === '"') {
			let value = '';
			let j = i + 1;
			for (; j < source.length && source[j] !== '"'; j++) {
				if (source[j] === '\\' && j + 1 < source.length) j++;
				value += source[j];
			}
			if (j >= source.length) throw new FormulaError('A text in quotes is missing its closing "');
			tokens.push({ kind: 'string', value });
			i = j + 1;
			continue;
		}

		const number = /^\d+(\.\d+)?/.exec(source.slice(i));
		if (number) { tokens.push({ kind: 'number', value: number[0] }); i += number[0].length; continue; }

		const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
		if (word) { tokens.push({ kind: 'word', value: word[0].toUpperCase() }); i += word[0].length; continue; }

		const op = OPERATORS.find((o) => source.startsWith(o, i));
		if (op) { tokens.push({ kind: 'op', value: op }); i += op.length; continue; }

		throw new FormulaError(ch === '=' ? 'Use == to compare' : `Unexpected "${ch}"`);
	}
	tokens.push({ kind: 'end', value: '' });
	return tokens;
}

// --- Parser ---

/** Parses a formula (without its leading `=`). Throws FormulaError. */
export function parseExpression(source: string): Expr {
	const tokens = tokenize(source);
	let pos = 0;

	const peek = (offset = 0) => tokens[pos + offset];
	const isWord = (w: string, offset = 0) => peek(offset).kind === 'word' && peek(offset).value === w;
	const isOp = (o: string) => peek().kind === 'op' && peek().value === o;
	const describe = (t: Token) => (t.kind === 'end' ? 'the end' : t.kind === 'string' ? `"${t.value}"` : t.kind === 'column' ? `{{${t.value}}}` : t.value);
	const expectWord = (w: string) => {
		if (!isWord(w)) throw new FormulaError(`Expected ${w} but found ${describe(peek())}`);
		pos++;
	};
	const expectOp = (o: string) => {
		if (!isOp(o)) throw new FormulaError(`Expected "${o}" but found ${describe(peek())}`);
		pos++;
	};

	function expression(): Expr {
		return or();
	}

	function or(): Expr {
		let left = and();
		while (isWord('OR')) { pos++; left = { type: 'logic', op: 'OR', left, right: and() }; }
		return left;
	}

	function and(): Expr {
		let left = not();
		while (isWord('AND')) { pos++; left = { type: 'logic', op: 'AND', left, right: not() }; }
		return left;
	}

	function not(): Expr {
		if (isWord('NOT')) { pos++; return { type: 'not', operand: not() }; }
		return comparison();
	}

	function comparison(): Expr {
		const left = additive();
		const t = peek();
		if (t.kind === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(t.value)) {
			pos++;
			return { type: 'compare', op: t.value as CompareOp, left, right: additive() };
		}
		if (isWord('CONTAINS')) {
			if (isWord('ALIAS', 1)) throw new FormulaError('CONTAINS ALIAS only works in a lookup: ACCOUNT WHERE … CONTAINS ALIAS');
			pos++;
			return { type: 'compare', op: 'CONTAINS', left, right: additive() };
		}
		if ((isWord('STARTS') || isWord('ENDS')) && isWord('WITH', 1)) {
			const op = isWord('STARTS') ? 'STARTS WITH' : 'ENDS WITH';
			pos += 2;
			return { type: 'compare', op, left, right: additive() };
		}
		if (isWord('IS')) {
			pos++;
			const negated = isWord('NOT');
			if (negated) pos++;
			expectWord('EMPTY');
			return { type: 'empty', operand: left, negated };
		}
		if (isWord('EQUALS')) throw new FormulaError('Use == to compare (EQUALS is for EQUALS ALIAS in lookups)');
		return left;
	}

	function additive(): Expr {
		let left = multiplicative();
		while (isOp('+') || isOp('-')) {
			const op = peek().value as '+' | '-';
			pos++;
			left = { type: 'arith', op, left, right: multiplicative() };
		}
		return left;
	}

	function multiplicative(): Expr {
		let left = unary();
		while (isOp('*') || isOp('/')) {
			const op = peek().value as '*' | '/';
			pos++;
			left = { type: 'arith', op, left, right: unary() };
		}
		return left;
	}

	function unary(): Expr {
		if (isOp('-')) { pos++; return { type: 'negate', operand: unary() }; }
		return primary();
	}

	function primary(): Expr {
		const t = peek();
		if (t.kind === 'column') { pos++; return { type: 'column', name: t.value }; }
		if (t.kind === 'string') { pos++; return { type: 'text', value: t.value }; }
		if (t.kind === 'number') { pos++; return { type: 'number', value: t.value }; }
		if (isOp('(')) {
			pos++;
			const inner = expression();
			expectOp(')');
			return inner;
		}
		if (isWord('IF')) {
			pos++;
			const cond = expression();
			expectWord('THEN');
			const then = expression();
			if (!isWord('ELSE')) return { type: 'if', cond, then };
			pos++;
			return { type: 'if', cond, then, else: expression() };
		}
		if ((isWord('ACCOUNT') || isWord('ALIAS')) && isWord('WHERE', 1)) {
			const returns = isWord('ACCOUNT') ? 'account' : 'alias';
			pos += 2;
			const operand = additive();
			let mode: 'contains' | 'exact';
			if (isWord('CONTAINS')) mode = 'contains';
			else if (isWord('EQUALS')) mode = 'exact';
			else throw new FormulaError(`Expected CONTAINS ALIAS or EQUALS ALIAS but found ${describe(peek())}`);
			pos++;
			expectWord('ALIAS');
			if (!isWord('ELSE')) return { type: 'lookup', returns, operand, mode };
			pos++;
			return { type: 'lookup', returns, operand, mode, fallback: expression() };
		}
		if (t.kind === 'word' && t.value in FUNCTIONS && peek(1).kind === 'op' && peek(1).value === '(') {
			pos += 2;
			const args: Expr[] = [];
			if (!isOp(')')) {
				args.push(expression());
				while (isOp(',')) { pos++; args.push(expression()); }
			}
			expectOp(')');
			return { type: 'call', name: t.value as FunctionName, args };
		}
		if (t.kind === 'word' && peek(1).kind === 'op' && peek(1).value === '(') throw new FormulaError(`There's no function ${t.value}`);
		if (t.kind === 'word') throw new FormulaError(`Unexpected ${t.value}. Columns go in {{ }} and text in quotes`);
		throw new FormulaError(`Unexpected ${describe(t)}`);
	}

	const result = expression();
	if (peek().kind !== 'end') throw new FormulaError(`Unexpected ${describe(peek())}`);
	return result;
}

// --- Types ---

export interface TypeEnv {
	/** The type of a column, or null if there's no such column. Throws for unusable columns. */
	columnType(name: string): ValueType | null;
}

const TYPE_NAMES: Record<ValueType, string> = { text: 'text', number: 'a number', date: 'a date', bool: 'true/false' };

/** The type an expression produces. Throws FormulaError when it doesn't fit together. */
export function typeOf(e: Expr, env: TypeEnv): ValueType {
	const value = (x: Expr, what: string): ValueType => {
		const t = typeOf(x, env);
		if (t === 'bool') throw new FormulaError(`${what} needs a value, not a true/false condition`);
		return t;
	};
	const need = (x: Expr, want: ValueType, what: string) => {
		const t = typeOf(x, env);
		if (t !== want) throw new FormulaError(`${what} needs ${TYPE_NAMES[want]}, not ${TYPE_NAMES[t]}`);
	};

	switch (e.type) {
		case 'column': {
			const t = env.columnType(e.name);
			if (t === null) throw new FormulaError(`There's no column "${e.name}"`);
			return t;
		}
		case 'text': return 'text';
		case 'number': return 'number';
		case 'negate': need(e.operand, 'number', 'A minus sign'); return 'number';
		case 'not': need(e.operand, 'bool', 'NOT'); return 'bool';
		case 'logic': need(e.left, 'bool', e.op); need(e.right, 'bool', e.op); return 'bool';
		case 'empty': value(e.operand, 'IS EMPTY'); return 'bool';
		case 'arith': {
			const l = value(e.left, `"${e.op}"`);
			const r = value(e.right, `"${e.op}"`);
			if (e.op === '+' && (l === 'text' || r === 'text')) return 'text';
			if (l !== 'number' || r !== 'number') throw new FormulaError(`"${e.op}" needs numbers${e.op === '+' ? ' or text' : ''}, not ${TYPE_NAMES[l === 'number' ? r : l]}`);
			return 'number';
		}
		case 'compare': {
			const l = value(e.left, e.op);
			const r = value(e.right, e.op);
			if (['<', '>', '<=', '>='].includes(e.op) && !(l === r && (l === 'number' || l === 'date'))) {
				throw new FormulaError(`"${e.op}" compares two numbers or two dates, not ${TYPE_NAMES[l]} and ${TYPE_NAMES[r]}`);
			}
			return 'bool';
		}
		case 'if': {
			need(e.cond, 'bool', 'IF');
			const a = value(e.then, 'THEN');
			if (!e.else) return a;
			const b = value(e.else, 'ELSE');
			return a === b ? a : 'text';
		}
		case 'lookup':
			value(e.operand, 'A lookup');
			if (e.fallback) value(e.fallback, 'ELSE');
			return 'text';
		case 'call': {
			const f = FUNCTIONS[e.name];
			const optional = 'optional' in f ? f.optional : 0;
			const variadic = 'variadic' in f && f.variadic;
			const min = f.params.length - optional;
			if (e.args.length < min || (!variadic && e.args.length > f.params.length)) {
				throw new FormulaError(`${e.name} takes ${variadic ? `at least ${min}` : min === f.params.length ? min : `${min} or ${f.params.length}`} value${min === 1 && !variadic ? '' : 's'}: ${f.help}`);
			}
			const types = e.args.map((arg, i) => {
				const param: Param = f.params[Math.min(i, f.params.length - 1)];
				if (param === 'number' || param === 'date') { need(arg, param, `${e.name}`); return param; }
				return value(arg, e.name);
			});
			if (f.returns !== 'any') return f.returns;
			return types.every((t) => t === types[0]) ? types[0] : 'text';
		}
	}
}

// --- Values ---

export type Value =
	| { type: 'text'; text: string }
	| { type: 'number'; amount: string; raw?: string }
	| { type: 'date'; date: string; raw?: string }
	| { type: 'bool'; bool: boolean };

export interface EvalContext {
	/** A column's value for the current row; null when the cell is empty. Throws FormulaError when it can't be read. */
	column(name: string): Value | null;
	/** Finds the alias matching `text`. */
	lookup(mode: 'contains' | 'exact', text: string): { account: string; alias: string } | null;
	/** Told about every lookup made, in order. */
	onLookup?(info: { returns: 'account' | 'alias'; mode: 'contains' | 'exact'; text: string; matched: boolean; alias?: string }): void;
	add(a: string, b: string): string;
	subtract(a: string, b: string): string;
	multiply(a: string, b: string): string;
	divide(a: string, b: string): string | null;
	compare(a: string, b: string): number;
	round(a: string, places: number): string;
}

/** A value as text: numbers and dates as they were written in the file. */
export function valueText(v: Value | null): string {
	if (!v) return '';
	switch (v.type) {
		case 'text': return v.text;
		case 'number': return v.raw ?? v.amount;
		case 'date': return v.raw ?? v.date;
		case 'bool': return v.bool ? 'true' : 'false';
	}
}

function fold(text: string): string {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Evaluates an expression for one row. Throws FormulaError. */
export function evaluate(e: Expr, ctx: EvalContext): Value | null {
	const text = (s: string): Value => ({ type: 'text', text: s });
	/** A number operand; an empty cell counts as 0 in arithmetic. */
	const num = (x: Expr): string => {
		const v = evaluate(x, ctx);
		if (!v) return '0';
		if (v.type !== 'number') throw new FormulaError(`"${valueText(v)}" isn't a number`);
		return v.amount;
	};
	const bool = (x: Expr): boolean => {
		const v = evaluate(x, ctx);
		return v?.type === 'bool' && v.bool;
	};

	switch (e.type) {
		case 'column': return ctx.column(e.name);
		case 'text': return text(e.value);
		case 'number': return { type: 'number', amount: e.value };
		case 'negate': {
			const a = num(e.operand);
			return { type: 'number', amount: ctx.subtract('0', a) };
		}
		case 'not': return { type: 'bool', bool: !bool(e.operand) };
		case 'logic':
			return { type: 'bool', bool: e.op === 'AND' ? bool(e.left) && bool(e.right) : bool(e.left) || bool(e.right) };
		case 'empty': {
			const isEmpty = valueText(evaluate(e.operand, ctx)).trim() === '';
			return { type: 'bool', bool: e.negated ? !isEmpty : isEmpty };
		}
		case 'arith': {
			if (e.op === '+') {
				const l = evaluate(e.left, ctx);
				const r = evaluate(e.right, ctx);
				const numeric = (v: Value | null) => !v || v.type === 'number';
				if (numeric(l) && numeric(r) && (l || r)) {
					return { type: 'number', amount: ctx.add(l?.type === 'number' ? l.amount : '0', r?.type === 'number' ? r.amount : '0') };
				}
				return text(valueText(l) + valueText(r));
			}
			const a = num(e.left);
			const b = num(e.right);
			if (e.op === '-') return { type: 'number', amount: ctx.subtract(a, b) };
			if (e.op === '*') return { type: 'number', amount: ctx.multiply(a, b) };
			const q = ctx.divide(a, b);
			if (q === null) throw new FormulaError('Division by zero');
			return { type: 'number', amount: q };
		}
		case 'compare': {
			const l = evaluate(e.left, ctx);
			const r = evaluate(e.right, ctx);
			let result: boolean;
			if (e.op === 'CONTAINS') result = fold(valueText(l)).includes(fold(valueText(r)));
			else if (e.op === 'STARTS WITH') result = fold(valueText(l)).startsWith(fold(valueText(r)));
			else if (e.op === 'ENDS WITH') result = fold(valueText(l)).endsWith(fold(valueText(r)));
			else {
				let order: number;
				if (l?.type === 'number' && r?.type === 'number') order = ctx.compare(l.amount, r.amount);
				else if (l?.type === 'date' && r?.type === 'date') order = l.date < r.date ? -1 : l.date > r.date ? 1 : 0;
				else if (e.op === '==' || e.op === '!=') order = fold(valueText(l)) === fold(valueText(r)) ? 0 : 1;
				else return { type: 'bool', bool: false };
				result = e.op === '<' ? order < 0 : e.op === '>' ? order > 0 : e.op === '<=' ? order <= 0
					: e.op === '>=' ? order >= 0 : e.op === '==' ? order === 0 : order !== 0;
			}
			return { type: 'bool', bool: result };
		}
		case 'if':
			return bool(e.cond) ? evaluate(e.then, ctx) : e.else ? evaluate(e.else, ctx) : null;
		case 'lookup': {
			const searched = valueText(evaluate(e.operand, ctx));
			const found = ctx.lookup(e.mode, searched);
			ctx.onLookup?.({ returns: e.returns, mode: e.mode, text: searched, matched: !!found, alias: found?.alias });
			if (found) return text(e.returns === 'account' ? found.account : found.alias);
			return e.fallback ? evaluate(e.fallback, ctx) : null;
		}
		case 'call':
			return callFunction(e.name, e.args, ctx);
	}
}

function callFunction(name: FunctionName, args: Expr[], ctx: EvalContext): Value | null {
	const str = (i: number) => valueText(evaluate(args[i], ctx));
	const text = (s: string): Value => ({ type: 'text', text: s });
	const number = (i: number): string => {
		const v = evaluate(args[i], ctx);
		if (!v) return '0';
		if (v.type !== 'number') throw new FormulaError(`${name}: "${valueText(v)}" isn't a number`);
		return v.amount;
	};
	/** A date argument as YYYY-MM-DD, or null for an empty cell. */
	const date = (i: number): string | null => {
		const v = evaluate(args[i], ctx);
		if (!v) return null;
		if (v.type !== 'date') throw new FormulaError(`${name}: "${valueText(v)}" isn't a date`);
		return v.date;
	};

	switch (name) {
		case 'FORMAT_DATE': {
			const d = date(0);
			return d === null ? null : text(formatDatePattern(d, str(1)));
		}
		case 'YEAR':
		case 'MONTH':
		case 'DAY': {
			const d = date(0);
			if (d === null) return null;
			const [y, m, dd] = d.split('-').map(Number);
			return { type: 'number', amount: String(name === 'YEAR' ? y : name === 'MONTH' ? m : dd) };
		}
		case 'ADD_DAYS': {
			const d = date(0);
			const n = Number(number(1));
			if (!Number.isInteger(n)) throw new FormulaError('ADD_DAYS: the number of days must be a whole number');
			return d === null ? null : { type: 'date', date: addDays(d, n) };
		}
		case 'DATE': {
			const raw = str(0);
			if (!raw.trim()) return null;
			const d = parseDatePattern(raw, str(1));
			if (d === null) throw new FormulaError(`DATE: "${raw}" doesn't match the pattern "${str(1)}"`);
			return { type: 'date', date: d };
		}
		case 'SPLIT': {
			const n = Number(number(2));
			const parts = str(1) === '' ? [str(0)] : str(0).split(str(1));
			if (!Number.isInteger(n) || n < 1) throw new FormulaError('SPLIT: the part number starts at 1');
			return text((parts[n - 1] ?? '').replace(/\s+/g, ' ').trim());
		}
		case 'TRIM': return text(str(0).replace(/\s+/g, ' ').trim());
		case 'UPPER': return text(str(0).toUpperCase());
		case 'LOWER': return text(str(0).toLowerCase());
		case 'REPLACE': return text(str(1) === '' ? str(0) : str(0).split(str(1)).join(str(2)));
		case 'ABS': return { type: 'number', amount: number(0).replace(/^-/, '') };
		case 'ROUND': {
			const places = args.length > 1 ? Number(number(1)) : 0;
			if (!Number.isInteger(places) || places < 0) throw new FormulaError('ROUND: the number of decimals must be 0 or more');
			return { type: 'number', amount: ctx.round(number(0), places) };
		}
		case 'FIRST':
			for (const arg of args) {
				const v = evaluate(arg, ctx);
				if (valueText(v).trim() !== '') return v;
			}
			return null;
	}
}

// --- Inspecting and printing ---

/** Every lookup in an expression, outermost first. */
export function findLookups(e: Expr): Extract<Expr, { type: 'lookup' }>[] {
	const found: Extract<Expr, { type: 'lookup' }>[] = [];
	const visit = (x: Expr | undefined): void => {
		if (!x) return;
		if (x.type === 'lookup') found.push(x);
		switch (x.type) {
			case 'negate': case 'not': case 'empty': visit(x.operand); break;
			case 'arith': case 'compare': case 'logic': visit(x.left); visit(x.right); break;
			case 'if': visit(x.cond); visit(x.then); visit(x.else); break;
			case 'lookup': visit(x.operand); visit(x.fallback); break;
			case 'call': x.args.forEach(visit); break;
		}
	};
	visit(e);
	return found;
}

/** Fixed texts the expression can produce as its result, e.g. the account names in an IF. */
export function resultTexts(e: Expr): string[] {
	switch (e.type) {
		case 'text': return [e.value];
		case 'if': return [...resultTexts(e.then), ...(e.else ? resultTexts(e.else) : [])];
		case 'lookup': return e.fallback ? resultTexts(e.fallback) : [];
		default: return [];
	}
}

const PRECEDENCE: Partial<Record<Expr['type'], number>> = { logic: 1, not: 2, compare: 3, arith: 4, negate: 6 };

/** Writes an expression back as formula text (without the leading `=`). */
export function printExpression(e: Expr): string {
	const level = (x: Expr) => (x.type === 'arith' && (x.op === '*' || x.op === '/') ? 5 : PRECEDENCE[x.type] ?? 9);
	const wrap = (x: Expr, min: number) => (level(x) < min || x.type === 'if' || x.type === 'lookup' ? `(${printExpression(x)})` : printExpression(x));
	const quote = (s: string) => `"${s.replace(/["\\]/g, '\\$&')}"`;

	switch (e.type) {
		case 'column': return `{{${e.name}}}`;
		case 'text': return quote(e.value);
		case 'number': return e.value;
		case 'negate': return `-${wrap(e.operand, 6)}`;
		case 'not': return `NOT ${wrap(e.operand, 2)}`;
		case 'logic': return `${wrap(e.left, e.op === 'OR' ? 1 : 1.5)} ${e.op} ${wrap(e.right, e.op === 'OR' ? 1.5 : 2)}`;
		case 'empty': return `${wrap(e.operand, 4)} IS ${e.negated ? 'NOT ' : ''}EMPTY`;
		case 'compare': return `${wrap(e.left, 4)} ${e.op} ${wrap(e.right, 4)}`;
		case 'arith': {
			const own = level(e);
			return `${wrap(e.left, own)} ${e.op} ${wrap(e.right, own + 1)}`;
		}
		case 'if': return `IF ${printExpression(e.cond)} THEN ${wrapBranch(e.then, !!e.else)}${e.else ? ` ELSE ${printExpression(e.else)}` : ''}`;
		case 'lookup': return `${e.returns === 'account' ? 'ACCOUNT' : 'ALIAS'} WHERE ${wrap(e.operand, 4)} ${e.mode === 'exact' ? 'EQUALS' : 'CONTAINS'} ALIAS${e.fallback ? ` ELSE ${printExpression(e.fallback)}` : ''}`;
		case 'call': return `${e.name}(${e.args.map(printExpression).join(', ')})`;
	}

	/** A THEN branch that could swallow the IF's own ELSE needs brackets. */
	function wrapBranch(x: Expr, hasElse: boolean): string {
		return hasElse && (x.type === 'if' || x.type === 'lookup') && !(x.type === 'if' ? x.else : x.fallback)
			? `(${printExpression(x)})`
			: printExpression(x);
	}
}
