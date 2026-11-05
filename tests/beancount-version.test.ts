import { describe, it, expect } from 'vitest';
import { checkBeancountVersion, beancountV2Message, BEANCOUNT_UPGRADE_COMMAND } from '../src/utils/beancountVersion';

describe('checkBeancountVersion (Issue #289)', () => {
	it('flags Beancount 2 bundled bean-query output', () => {
		const r = checkBeancountVersion('bean-query', 'Beancount 2.3.6 (git:0f0c6f3a; 2023-01-01)');
		expect(r.isBeancountV2).toBe(true);
		expect(r.beancountVersion).toBe('2.3.6');
	});

	it('does not flag Beancount 3 output', () => {
		const r = checkBeancountVersion('bean-query', 'Beancount 3.1.0');
		expect(r.isBeancountV2).toBe(false);
		expect(r.beancountVersion).toBe('3.1.0');
	});

	it('does not flag the standalone beanquery tool', () => {
		const r = checkBeancountVersion('bean-query', 'bean-query, version 0.2.0');
		expect(r.isBeancountV2).toBe(false);
		expect(r.beancountVersion).toBeNull();
	});

	it('flags the Beancount 2-only beancount.query module command', () => {
		expect(checkBeancountVersion('python3 -m beancount.query', '').isBeancountV2).toBe(true);
		expect(checkBeancountVersion('wsl python -m beancount.query', undefined).isBeancountV2).toBe(true);
		expect(checkBeancountVersion('python3 -m beanquery', '').isBeancountV2).toBe(false);
	});

	it('handles empty output', () => {
		expect(checkBeancountVersion('bean-query', null).isBeancountV2).toBe(false);
	});

	it('includes the upgrade command in the message', () => {
		expect(beancountV2Message('2.3.6')).toContain('Beancount 2.3.6');
		expect(beancountV2Message(null)).toContain(BEANCOUNT_UPGRADE_COMMAND);
	});
});
