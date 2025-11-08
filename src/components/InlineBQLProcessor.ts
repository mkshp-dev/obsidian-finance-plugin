// src/components/InlineBQLProcessor.ts

import type { MarkdownPostProcessorContext } from 'obsidian';
import type BeancountPlugin from '../main';
import { ShorthandParser } from '../utils/shorthandParser';

export class InlineBQLProcessor {
	private plugin: BeancountPlugin;
	private shorthandCache: Record<string, string> = {};
	private lastTemplateFileCheck = 0;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
	}

	getProcessor() {
		return async (element: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			await this.processInlineElements(element, ctx);
		};
	}

	private async processInlineElements(element: HTMLElement, context: MarkdownPostProcessorContext) {
		// Find all inline code elements that start with 'bql:' or 'bql-sh:'
		const codeElements = Array.from(element.querySelectorAll('code, .cm-inline-code, [data-type="code"]'));
		
		for (const codeEl of codeElements) {
			const content = codeEl.textContent || '';
			
			if (content.startsWith('bql:')) {
				await this.processInlineBQL(codeEl as HTMLElement, content, false);
			} else if (content.startsWith('bql-sh:')) {
				await this.processInlineBQL(codeEl as HTMLElement, content, true);
			}
		}
		
		// Also check if the element itself is a code element
		if (element.tagName === 'CODE') {
			const content = element.textContent || '';
			if (content.startsWith('bql:')) {
				await this.processInlineBQL(element, content, false);
			} else if (content.startsWith('bql-sh:')) {
				await this.processInlineBQL(element, content, true);
			}
		}
	}

	private async getShorthands(): Promise<Record<string, string>> {
		const now = Date.now();
		// Refresh cache every 30 seconds to catch template file changes
		if (now - this.lastTemplateFileCheck < 30000 && Object.keys(this.shorthandCache).length > 0) {
			return this.shorthandCache;
		}

		const templatePath = this.plugin.settings.bqlShorthandsTemplatePath.trim();
		
		if (templatePath) {
			// Convert relative path to absolute path if needed
			let absolutePath = templatePath;
			if (!templatePath.startsWith('/') && !templatePath.match(/^[A-Za-z]:/)) {
				// This is a relative path, resolve it relative to the vault
				const vaultPath = (this.plugin.app.vault.adapter as any).basePath || '';
				absolutePath = require('path').join(vaultPath, templatePath);
			}
			
			this.shorthandCache = ShorthandParser.parseShorthandsFromFile(absolutePath);
		} else {
			this.shorthandCache = {}; // No shortcuts if no template path
		}
		this.lastTemplateFileCheck = now;
		return this.shorthandCache;
	}

	private async processInlineBQL(codeElement: HTMLElement, content: string, isShorthand: boolean = false) {
		let query: string;
		
		if (isShorthand) {
			// Extract shorthand notation: "bql-sh:SHORTHAND" -> "SHORTHAND"
			const shorthandKey = content.replace(/^bql-sh:/, '').trim();
			const shortcuts = await this.getShorthands();
			const shorthandQuery = shortcuts[shorthandKey];
			
			if (!shorthandQuery) {
				const availableShortcuts = Object.keys(shortcuts);
				if (availableShortcuts.length === 0) {
					codeElement.textContent = `[No shortcuts defined in template file]`;
					codeElement.title = 'Please add shortcuts to your template file or check your template file path in settings';
				} else {
					codeElement.textContent = `[Unknown shorthand: ${shorthandKey}]`;
					codeElement.title = `Available shortcuts: ${availableShortcuts.join(', ')}`;
				}
				codeElement.style.color = 'var(--text-error)';
				return;
			}
			
			query = shorthandQuery;
		} else {
			// Extract direct query: "bql:SELECT ..." -> "SELECT ..."
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
			
			// Show original shorthand name in tooltip if applicable
			if (isShorthand) {
				const shorthandKey = content.replace(/^bql-sh:/, '').trim();
				wrapper.title = `BQL Shorthand (${shorthandKey}): ${query}`;
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
		if (!csvResult || csvResult.trim() === '') {
			return '0';
		}

		try {
			const lines = csvResult.trim().split('\n');
			if (lines.length < 2) {
				return '0';
			}

			// Get the first data row (skip header)
			const dataLine = lines[1];
			
			// Parse CSV value (handle quoted values)
			let value = dataLine.trim();
			
			// Remove quotes if present
			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			}
			
			// Handle comma-separated values (take first column)
			if (value.includes(',')) {
				const parts = this.parseCSVLine(dataLine);
				value = parts[0] || '0';
				if (value.startsWith('"') && value.endsWith('"')) {
					value = value.slice(1, -1);
				}
			}
			
			// Format the value nicely
			return this.formatValue(value);
			
		} catch (error) {
			console.error('Error extracting single value:', error);
			return '❌';
		}
	}

	private parseCSVLine(line: string): string[] {
		const result: string[] = [];
		let current = '';
		let inQuotes = false;
		
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			
			if (char === '"' && (i === 0 || line[i-1] === ',')) {
				inQuotes = true;
			} else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
				inQuotes = false;
			} else if (char === ',' && !inQuotes) {
				result.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
		
		result.push(current.trim());
		return result;
	}

	private formatValue(value: string): string {
		// Check if it's a number
		const numMatch = value.match(/^([+-]?\d+\.?\d*)\s*([A-Z]{3})?$/);
		if (numMatch) {
			const number = parseFloat(numMatch[1]);
			const currency = numMatch[2];
			
			if (currency) {
				// Format as currency
				return new Intl.NumberFormat('en-US', {
					style: 'currency',
					currency: currency,
					minimumFractionDigits: 0,
					maximumFractionDigits: 2,
				}).format(Math.abs(number));
			} else {
				// Format as number
				return new Intl.NumberFormat('en-US', {
					minimumFractionDigits: 0,
					maximumFractionDigits: 2,
				}).format(number);
			}
		}
		
		// Return as-is if not a number
		return value;
	}

	// Method to refresh all inline BQL values
	public refreshAllInlineValues() {
		const inlineElements = document.querySelectorAll('.bql-inline-wrapper');
		inlineElements.forEach(async (element) => {
			const query = (element as any)._bqlQuery;
			if (query) {
				await this.processInlineBQL(element as HTMLElement, `bql:${query}`, false);
			}
		});
	}
}