// src/components/BQLCodeBlockProcessor.ts

import type { MarkdownPostProcessorContext } from 'obsidian';
import type BeancountPlugin from '../../main';
import type { BQLFormat } from '../../utils/queryRunner';

export class BQLCodeBlockProcessor {
	private plugin: BeancountPlugin;
	private activeBlocks: Set<HTMLElement> = new Set();

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
	}

	getProcessor() {
		return async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			await this.processCodeBlock(source, el, ctx);
		};
	}
	
	// Method to refresh all active BQL blocks
	public refreshAllBlocks() {
		this.activeBlocks.forEach(element => {
			// Get the stored source
			const source = (element as any)._bqlSource;
			if (source) {
				// Reprocess the block with current settings
				this.processCodeBlock(source, element, {} as MarkdownPostProcessorContext);
			}
		});
	}

	private async processCodeBlock(source: string, element: HTMLElement, context: MarkdownPostProcessorContext) {
		const query = source.trim();
		if (!query) return;

		// Store the original source in the element for refresh capability
		(element as any)._bqlSource = query;
		
		// Register this block for future refreshes
		this.activeBlocks.add(element);
		
		// Clean up when element is removed
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.removedNodes.forEach((node) => {
					if (node === element || (node instanceof HTMLElement && node.contains(element))) {
						this.activeBlocks.delete(element);
						observer.disconnect();
					}
				});
			});
		});
		
		if (element.parentElement) {
			observer.observe(element.parentElement, { childList: true, subtree: true });
		}

		// Create container for the BQL result
		const container = document.createElement('div');
		container.className = 'bql-query-container';
		
		// Get user preferences (with fallback to defaults if undefined)
		const showTools = this.plugin.settings.bqlShowTools ?? true;
		const showQuery = this.plugin.settings.bqlShowQuery ?? false;
		
		// Create header with query and controls (only if tools or query should be shown)
		let header: HTMLElement | null = null;
		let controls: HTMLElement | null = null;
		let refreshBtn: HTMLButtonElement | null = null;
		let copyBtn: HTMLButtonElement | null = null;
		let exportBtn: HTMLButtonElement | null = null;
		
		if (showTools || showQuery) {
			header = container.createEl('div', { cls: 'bql-query-header' });
			
			if (showQuery) {
				const queryLabel = header.createEl('div', { cls: 'bql-query-label' });
				queryLabel.createEl('span', { text: 'BQL Query', cls: 'bql-label' });
			}
			
			if (showTools) {
				controls = header.createEl('div', { cls: 'bql-query-controls' });

				// Format selector
				const formatSelect = controls.createEl('select', { cls: 'bql-format-select', title: 'Output format' }) as HTMLSelectElement;
				const formatOptions: { value: BQLFormat; label: string }[] = [
					{ value: 'csv', label: 'Table' },
					{ value: 'text', label: 'Text' },
					{ value: 'beancount', label: 'Beancount' },
				];
				formatOptions.forEach(opt => {
					const option = formatSelect.createEl('option', { text: opt.label }) as HTMLOptionElement;
					option.value = opt.value;
				});
				(container as any)._bqlFormat = 'csv' as BQLFormat;
				formatSelect.value = 'csv';
				formatSelect.addEventListener('change', () => {
					(container as any)._bqlFormat = formatSelect.value as BQLFormat;
					executeQuery();
				});
				
				refreshBtn = controls.createEl('button', { 
					text: '⟳', 
					cls: 'bql-refresh-btn',
					title: 'Refresh query results'
				});
				
				copyBtn = controls.createEl('button', { 
					text: '📋', 
					cls: 'bql-copy-btn',
					title: 'Copy results to clipboard'
				});

				exportBtn = controls.createEl('button', { 
					text: '📤', 
					cls: 'bql-export-btn',
					title: 'Export results'
				});
			}
		}
		
		// Create query display (collapsible) - only if showQuery is enabled
		let queryDisplay: HTMLDetailsElement | null = null;
		if (showQuery) {
			queryDisplay = container.createEl('details', { cls: 'bql-query-details' });
			const querySummary = queryDisplay.createEl('summary', { text: 'View Query', cls: 'bql-query-summary' });
			const queryCode = queryDisplay.createEl('pre', { cls: 'bql-query-code' });
			queryCode.createEl('code', { text: query });
		}
		
		// Create result area
		const resultArea = container.createEl('div', { cls: 'bql-result-area' });
		
		// Function to execute query and update results
		const executeQuery = async () => {
			try {
				// Show loading state (only if tools are shown, otherwise show minimal loading)
				resultArea.empty();
				
				if (showTools) {
					const loadingEl = resultArea.createEl('div', { cls: 'bql-loading' });
					loadingEl.createEl('span', { text: '⟳', cls: 'bql-loading-spinner' });
					loadingEl.createEl('span', { text: 'Executing query...', cls: 'bql-loading-text' });
				} else {
					// Minimal loading for clean mode
					const loadingEl = resultArea.createEl('div', { cls: 'bql-loading-minimal' });
					loadingEl.textContent = 'Loading...';
				}
				
				// Execute the query with the currently selected format
				const currentFormat: BQLFormat = (container as any)._bqlFormat ?? 'csv';
				const queryResult = await this.plugin.runQuery(query, currentFormat);
				
				// Clear loading and show results
				resultArea.empty();
				
				if (!queryResult || queryResult.trim() === '') {
					resultArea.createEl('div', { 
						text: 'No results returned', 
						cls: 'bql-no-results' 
					});
					return;
				}
				
				if (currentFormat === 'csv') {
					// Parse CSV and create table
					const { table, error } = this.createTableFromCSV(queryResult);
					if (error) {
						this.createCollapsibleError(resultArea, 'Error parsing results', error);
						const rawEl = resultArea.createEl('pre', { cls: 'bql-raw-result' });
						rawEl.textContent = queryResult;
					} else if (table) {
						resultArea.appendChild(table);
					}
				} else {
					// text and beancount formats — render as preformatted text
					const preEl = resultArea.createEl('pre', { cls: 'bql-text-result' });
					preEl.textContent = queryResult;
				}
				
				// Store result for copy/export functions
				(container as any)._lastResult = queryResult;
				(container as any)._lastFormat = currentFormat;
				
			} catch (error) {
				// Show collapsible error message
				resultArea.empty();
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.createCollapsibleError(resultArea, 'Query failed', errorMessage);
			}
		};
		
		// Wire up controls (only if they exist)
		if (refreshBtn) {
			refreshBtn.addEventListener('click', executeQuery);
		}
		
		if (copyBtn) {
			copyBtn.addEventListener('click', () => {
				const result = (container as any)._lastResult;
				if (result) {
					navigator.clipboard.writeText(result);
					copyBtn.textContent = '✓';
					setTimeout(() => copyBtn.textContent = '📋', 1000);
				}
			});
		}
		
		if (exportBtn) {
			exportBtn.addEventListener('click', () => {
				const result = (container as any)._lastResult;
				const fmt: BQLFormat = (container as any)._lastFormat ?? 'csv';
				if (result) {
					const ext = fmt === 'csv' ? 'csv' : 'txt';
					const mimeType = fmt === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;';
					this.downloadFile(result, `bql-query-result.${ext}`, mimeType);
					exportBtn.textContent = '✓';
					setTimeout(() => exportBtn.textContent = '📤', 1000);
				}
			});
		}
		
		// Replace the original element with our container
		element.empty();
		element.appendChild(container);
		
		// Execute query immediately
		await executeQuery();
	}
	
	private createCollapsibleError(container: HTMLElement, summary: string, fullError: string) {
		const errorContainer = container.createEl('div', { cls: 'bql-error-container' });
		
		// Create summary line with toggle
		const summaryLine = errorContainer.createEl('div', { cls: 'bql-error-summary' });
		
		const toggleIcon = summaryLine.createEl('span', { 
			text: '▶', 
			cls: 'bql-error-toggle'
		});
		
		const summaryText = summaryLine.createEl('span', { 
			text: summary, 
			cls: 'bql-error-summary-text'
		});
		
		// Extract first line or create short summary
		const firstLine = fullError.split('\n')[0];
		const shortError = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
		
		if (shortError !== summary) {
			summaryText.textContent = `${summary}: ${shortError}`;
		}
		
		// Create collapsible details
		const details = errorContainer.createEl('div', { cls: 'bql-error-details' });
		details.style.display = 'none';
		
		const fullErrorEl = details.createEl('pre', { cls: 'bql-error-full' });
		fullErrorEl.textContent = fullError;
		
		// Toggle functionality
		let isExpanded = false;
		summaryLine.style.cursor = 'pointer';
		
		summaryLine.addEventListener('click', () => {
			isExpanded = !isExpanded;
			details.style.display = isExpanded ? 'block' : 'none';
			toggleIcon.textContent = isExpanded ? '▼' : '▶';
		});
	}
	
	private createTableFromCSV(csvText: string): { table: HTMLTableElement | null, error: string | null } {
		try {
			const lines = csvText.trim().split('\n');
			if (lines.length === 0) {
				return { table: null, error: 'Empty result set' };
			}
			
			// Parse CSV (simple parser - handles quoted values)
			const parseCSVLine = (line: string): string[] => {
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
			};
			
			const headers = parseCSVLine(lines[0]);
			const rows = lines.slice(1).map(parseCSVLine);
			
			// Create table
			const table = document.createElement('table');
			table.className = 'bql-result-table';
			
			// Create header
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headers.forEach(header => {
				const th = headerRow.createEl('th');
				th.textContent = header.replace(/"/g, ''); // Remove quotes
			});
			
			// Create body
			const tbody = table.createEl('tbody');
			rows.forEach(row => {
				const tr = tbody.createEl('tr');
				row.forEach((cell, index) => {
					const td = tr.createEl('td');
					let cellText = cell.replace(/"/g, ''); // Remove quotes
					
					// Format numbers and currencies for better display
					if (index > 0 && this.isNumeric(cellText)) {
						td.className = 'bql-numeric-cell';
						// Keep original formatting but add class for styling
					}
					
					td.textContent = cellText;
				});
			});
			
			return { table, error: null };
			
		} catch (error) {
			return { table: null, error: error instanceof Error ? error.message : 'Unknown parsing error' };
		}
	}
	
	private isNumeric(str: string): boolean {
		if (!str || str.trim() === '') return false;
		// Check if it looks like a number (including currency symbols and decimals)
		return /^[+-]?[\d,]*\.?\d+\s*[A-Z]*$/.test(str.trim());
	}
	
	private downloadFile(content: string, filename: string, mimeType: string) {
		const blob = new Blob([content], { type: mimeType });
		const link = document.createElement('a');
		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}
}