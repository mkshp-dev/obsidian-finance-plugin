// src/components/InlineBQLProcessor.ts

import type { MarkdownPostProcessorContext } from 'obsidian';
import type BeancountPlugin from '../../main';
import { parseSingleValue, getQueryDirectives } from '../../utils/index';

export class InlineBQLProcessor {
	private plugin: BeancountPlugin;
	private queryDirectiveCache: Record<string, string> = {};
	private lastQueryDirectiveCheck = 0;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
	}

	getProcessor() {
		return async (element: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			await this.processInlineElements(element, ctx);
		};
	}

	private async processInlineElements(element: HTMLElement, context: MarkdownPostProcessorContext) {
		// Fast path: avoid expensive querySelectorAll if the element definitely doesn't contain BQL
		const textContent = element.textContent || '';
		if (!textContent.includes('bql:') && !textContent.includes('bql-q:')) {
			return;
		}

		const codeElements = Array.from(element.querySelectorAll('code, .cm-inline-code, [data-type="code"]'));

		for (const codeEl of codeElements) {
			const content = codeEl.textContent || '';

			if (content.startsWith('bql:')) {
				await this.processInlineBQL(codeEl as HTMLElement, content, 'direct');
			} else if (content.startsWith('bql-q:')) {
				await this.processInlineBQL(codeEl as HTMLElement, content, 'query-directive');
			}
		}

		// Also check if the element itself is a code element
		if (element.tagName === 'CODE') {
			const content = element.textContent || '';
			if (content.startsWith('bql:')) {
				await this.processInlineBQL(element, content, 'direct');
			} else if (content.startsWith('bql-q:')) {
				await this.processInlineBQL(element, content, 'query-directive');
			}
		}
	}

	/** Fetch named query directives from queries.beancount (cached 30 s). */
	private async getQueryDirectivesMap(): Promise<Record<string, string>> {
		const now = Date.now();
		if (now - this.lastQueryDirectiveCheck < 30000 && Object.keys(this.queryDirectiveCache).length > 0) {
			return this.queryDirectiveCache;
		}
		this.queryDirectiveCache = await getQueryDirectives(this.plugin);
		this.lastQueryDirectiveCheck = now;
		return this.queryDirectiveCache;
	}

	private async processInlineBQL(
		codeElement: HTMLElement,
		content: string,
		mode: 'direct' | 'query-directive'
	) {
		let query: string;

		if (mode === 'query-directive') {
			const queryName = content.replace(/^bql-q:/, '').trim();
			const queries = await this.getQueryDirectivesMap();
			const namedQuery = queries[queryName];

			if (!namedQuery) {
				const available = Object.keys(queries);
				codeElement.textContent = available.length === 0
					? `[No named queries defined in queries.beancount]`
					: `[Unknown query: ${queryName}]`;
				codeElement.title = available.length === 0
					? 'Add query directives via the Add panel (Query tab) or directly to queries.beancount'
					: `Available queries: ${available.join(', ')}`;
				codeElement.style.color = 'var(--text-error)';
				return;
			}
			query = namedQuery;
		} else {
			// Direct query: "bql:SELECT ..." -> "SELECT ..."
			query = content.replace(/^bql:/, '').trim();
		}

		if (!query) return;

		// Create wrapper for the inline BQL result
		const wrapper = document.createElement('span');
		wrapper.className = 'bql-inline-wrapper';

		// Store original content for refresh capability
		(wrapper as any)._bqlQuery = query;
		(wrapper as any)._originalElement = codeElement;

		try {
			// Show loading state
			wrapper.textContent = '⟳';
			wrapper.className = 'bql-inline-wrapper bql-inline-loading';

			// Execute the query
			const csvResult = await this.plugin.runQuery(query);

			// Extract single value from result
			const value = this.extractSingleValue(csvResult);

			// Update with result
			wrapper.textContent = value;
			wrapper.className = 'bql-inline-wrapper bql-inline-result';

			if (mode === 'query-directive') {
				const queryName = content.replace(/^bql-q:/, '').trim();
				wrapper.title = `BQL Query (${queryName}): ${query}`;
			} else {
				wrapper.title = `BQL: ${query}`;
			}

		} catch (error) {
			// Show error state
			wrapper.textContent = '❌';
			wrapper.className = 'bql-inline-wrapper bql-inline-error';
			wrapper.title = `BQL Error: ${error.message}`;
		}

		// Replace the original code element
		if (codeElement.parentNode) {
			codeElement.parentNode.replaceChild(wrapper, codeElement);
		}
	}

	private extractSingleValue(csvResult: string): string {
		// Use the same robust CSV parsing logic from utils/index.ts
		return parseSingleValue(csvResult);
	}

	// Invalidate the query directive cache (call after saving a new query)
	public invalidateQueryCache() {
		this.lastQueryDirectiveCheck = 0;
		this.queryDirectiveCache = {};
	}

	// Method to refresh all inline BQL values
	public refreshAllInlineValues() {
		const inlineElements = document.querySelectorAll('.bql-inline-wrapper');
		inlineElements.forEach(async (element) => {
			const query = (element as any)._bqlQuery;
			if (query) {
				await this.processInlineBQL(element as HTMLElement, `bql:${query}`, 'direct');
			}
		});
	}
}