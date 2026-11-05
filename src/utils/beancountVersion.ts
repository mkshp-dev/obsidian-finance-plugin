// src/utils/beancountVersion.ts

/**
 * Detection of an outdated Beancount 2 installation (Issue #289).
 *
 * The plugin needs Beancount 3 plus the separate `beanquery` package. With
 * Beancount 2 still installed, `bean-query` is the old bundled tool and
 * queries fail with confusing errors, so we warn the user up front.
 */

/** Command that upgrades to Beancount 3 and installs beanquery. */
export const BEANCOUNT_UPGRADE_COMMAND = 'pip install -U beancount beanquery';

/** Docs page explaining the Beancount 2 → 3 upgrade. */
export const BEANCOUNT_UPGRADE_DOCS_URL =
	'https://docs.mkshp.dev/obsidian-finance-plugin/troubleshooting#beancount-v2';

export interface BeancountVersionCheck {
	/** True when the command is backed by Beancount 2. */
	isBeancountV2: boolean;
	/** Beancount version found in the output (e.g. "2.3.6"), if any. */
	beancountVersion: string | null;
}

/**
 * Decide whether a bean-query command is running on Beancount 2.
 *
 * - Beancount 2's bundled `bean-query --version` prints e.g.
 *   `Beancount 2.3.6 (git:...)`.
 * - Beancount 3's standalone `beanquery` prints its own version
 *   (e.g. `bean-query, version 0.2.0`), with no Beancount version.
 * - The `beancount.query` module only exists in Beancount 2, so a
 *   `python -m beancount.query` command implies Beancount 2.
 *
 * @param command       - The configured bean-query command.
 * @param versionOutput - Combined stdout/stderr of `<command> --version`.
 */
export function checkBeancountVersion(command: string, versionOutput: string | null | undefined): BeancountVersionCheck {
	const output = versionOutput ?? '';
	const match = output.match(/beancount\s+v?(\d+)\.(\d+)(?:\.(\d+))?/i);
	if (match) {
		const version = [match[1], match[2], match[3]].filter(Boolean).join('.');
		return { isBeancountV2: Number(match[1]) < 3, beancountVersion: version };
	}

	if (/(^|\s)-m\s+beancount\.query(\s|$)/.test(command)) {
		return { isBeancountV2: true, beancountVersion: null };
	}

	return { isBeancountV2: false, beancountVersion: null };
}

/** Short user-facing warning text for a Beancount 2 installation. */
export function beancountV2Message(version: string | null): string {
	const found = version ? `Beancount ${version}` : 'Beancount 2';
	return `${found} is installed, but this plugin needs Beancount 3 and the separate beanquery package. ` +
		`Upgrade with: ${BEANCOUNT_UPGRADE_COMMAND}`;
}
