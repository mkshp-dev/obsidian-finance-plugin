// src/components/InlineBQLProcessor.ts

import type { MarkdownPostProcessorContext } from 'obsidian';
import type BeancountPlugin from '../../main';
import { getQueryDirectives } from '../../utils/index';

interface InlineBQLHTMLElement extends HTMLElement {
	_bqlQuery?: string;
	_originalElement?: HTMLElement;
}

export class InlineBQLProcessor {
	private plugin: BeancountPlugin;
	private queryDirectiveCache: Record<string, string> = {};
	private lastQueryDirectiveCheck = 0;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
	}

	getProcessor() {
		return async (element: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
			await this.processInlineElements(element);
		};
	}

	private async processInlineElements(element: HTMLElement) {
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
				codeElement.addClass('bql-inline-error');
				return;
			}
			query = namedQuery;
		} else {
			// Direct query: "bql:SELECT ..." -> "SELECT ..."
			query = content.replace(/^bql:/, '').trim();
		}

		if (!query) return;

		// Create wrapper for the inline BQL result
		const wrapper = createSpan({ cls: 'bql-inline-wrapper' });

		// Store original content for refresh capability
		(wrapper as InlineBQLHTMLElement)._bqlQuery = query;
		(wrapper as InlineBQLHTMLElement)._originalElement = codeElement;

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
			const errMsg = error instanceof Error ? error.message : String(error);
			wrapper.title = `BQL Error: ${errMsg}`;
		}

		// Replace the original code element
		if (codeElement.parentNode) {
			codeElement.parentNode.replaceChild(wrapper, codeElement);
		}
	}

	private extractSingleValue(csvResult: string): string {
		if (!csvResult || typeof csvResult !== 'string') return '0 USD';
		const lines = csvResult.split('\n').map(l => l.trim()).filter(Boolean);
		if (lines.length < 2) return '0 USD';
		
		let val = lines[1];
		if (val.startsWith('"') && val.endsWith('"')) {
			val = val.substring(1, val.length - 1);
		}
		
		val = val.replace(/^[({[]/g, '').replace(/[)}\]]/g, '').trim();
		return val || '0 USD';
	}

	// Invalidate the query directive cache (call after saving a new query)
	public invalidateQueryCache() {
		this.lastQueryDirectiveCheck = 0;
		this.queryDirectiveCache = {};
	}

	// Method to refresh all inline BQL values
	public refreshAllInlineValues() {
		const inlineElements = activeDocument.querySelectorAll('.bql-inline-wrapper');
		inlineElements.forEach((element) => {
			const query = (element as InlineBQLHTMLElement)._bqlQuery;
			if (query) {
				void this.processInlineBQL(element as HTMLElement, `bql:${query}`, 'direct');
			}
		});
	}
}