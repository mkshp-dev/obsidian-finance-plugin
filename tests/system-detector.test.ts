import { describe, it, expect, beforeAll } from 'vitest';
import { SystemDetector } from '../src/utils/SystemDetector';

// execSafe.ts (used internally by SystemDetector) reads window.setTimeout/clearTimeout,
// which only exist in a browser/Electron renderer context. Stub it under vitest's plain
// Node test environment so real command execution works in these tests.
/* eslint-disable-next-line obsidianmd/no-global-this -- Node test shim, not plugin runtime code */
if (typeof (globalThis as unknown as { window?: unknown }).window === 'undefined') {
	/* eslint-disable-next-line obsidianmd/no-global-this -- Node test shim, not plugin runtime code */
	(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

describe('SystemDetector.findExecutable', () => {
	const detector = SystemDetector.getInstance();

	it('finds an executable that is known to be on PATH', async () => {
		// node itself is guaranteed present (it's running these tests).
		const result = await detector.findExecutable('node');
		expect(result.found).toBe(true);
		expect(result.path).toBeTruthy();
	});

	it('reports not found for a nonexistent executable', async () => {
		const result = await detector.findExecutable('definitely-not-a-real-command-xyz');
		expect(result.found).toBe(false);
		expect(result.path).toBeNull();
	});
});

describe('SystemDetector.detectBeanQueryCommand (Issue #74)', () => {
	const detector = SystemDetector.getInstance();
	let beanQueryAvailable = false;

	beforeAll(async () => {
		// Detect once whether bean-query/beanquery is actually installed in this
		// environment. Locally this is usually false (no Python tooling assumed) and
		// the test below only checks graceful failure. In CI, a prior workflow step
		// installs beanquery via pip, so this resolves true and the test asserts
		// real end-to-end success.
		const viaPath = await detector.findExecutable('bean-query');
		if (viaPath.found && viaPath.accessible) {
			beanQueryAvailable = true;
			return;
		}
		const result = await detector.testCommand('python3', ['-m', 'beanquery', '--version']);
		beanQueryAvailable = result.success;
	});

	it('detects bean-query when installed, or fails gracefully when it is not', async () => {
		const result = await detector.detectBeanQueryCommand();

		if (beanQueryAvailable) {
			expect(result.isValid).toBe(true);
			expect(result.command).toBeTruthy();
			expect(result.version).toBeTruthy();
		} else {
			expect(result.isValid).toBe(false);
			expect(result.command).toBeNull();
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});
});
