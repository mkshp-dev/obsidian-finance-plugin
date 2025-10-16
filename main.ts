// main.ts - THE ABSOLUTELY FINAL CORRECTED CODE

// 1. IMPORT 'MarkdownRenderer' instead of 'renderMarkdown'
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownRenderer } from 'obsidian';
import { exec } from 'child_process';
import { parse } from 'csv-parse/sync';

// --- Settings Interface and Defaults (no changes) ---
interface BeancountPluginSettings {
	beancountFilePath: string;
}
const DEFAULT_SETTINGS: BeancountPluginSettings = {
	beancountFilePath: ''
}

// --- Main Plugin Class (no changes) ---
export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new BeancountSettingTab(this.app, this));

		this.addCommand({
			id: 'show-beancount-balance',
			name: 'Show Beancount Balance Report',
			callback: async () => {
				const { beancountFilePath } = this.settings;
				if (!beancountFilePath) {
					new Notice('Beancount file path is not set. Please configure it in the plugin settings.');
					return;
				}
				const command = `wsl /usr/local/bin/bean-query -f csv "${beancountFilePath}" 'SELECT account, sum(position) GROUP BY account'`;
				new Notice('Generating Beancount report...');
				exec(command, (error, stdout, stderr) => {
					if (error) {
						console.error(`Execution Error: ${error.message}`);
						new Notice(`Error running bean-query. Check console for details.`);
						return;
					}
					if (stderr) {
						console.warn(`Beancount Standard Error: ${stderr}`);
					}
					try {
						const records = parse(stdout, { columns: true, skip_empty_lines: true });
						const formattedReport = this.formatDataAsMarkdown(records);
						new ReportModal(this.app, formattedReport, this).open();
					} catch (parseError) {
						console.error("Failed to parse CSV:", parseError);
						new Notice("Failed to parse Beancount output. Check console for details.");
					}
				});
			}
		});
	}

	formatDataAsMarkdown(records: any[]): string {
		if (records.length === 0) { return "No data returned from Beancount."; }
		const headers = Object.keys(records[0]);
		const headerRow = `| ${headers.join(' | ')} |`;
		const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
		const dataRows = records.map(record => `| ${headers.map(header => record[header]).join(' | ')} |`).join('\n');
		return `${headerRow}\n${separatorRow}\n${dataRows}`;
	}

	onunload() {}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}

// --- Settings Tab Class (no changes) ---
class BeancountSettingTab extends PluginSettingTab {
	plugin: BeancountPlugin;
	constructor(app: App, plugin: BeancountPlugin) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Beancount Settings'});
		new Setting(containerEl)
			.setName('Path to beancount file')
			.setDesc('Enter the absolute path to your main .beancount file.')
			.addText(text => text
				.setPlaceholder('/path/to/your/main.beancount')
				.setValue(this.plugin.settings.beancountFilePath)
				.onChange(async (value) => { this.plugin.settings.beancountFilePath = value; await this.plugin.saveSettings(); }));
	}
}

// --- Modal Class (CORRECTED) ---
class ReportModal extends Modal {
	content: string;
	plugin: Plugin;

	constructor(app: App, content: string, plugin: Plugin) {
		super(app);
		this.content = content;
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Beancount Balance Report" });

		// 2. USE THE CORRECT 'MarkdownRenderer.render' STATIC METHOD
		MarkdownRenderer.render(this.app, this.content, contentEl, '', this.plugin);
	}

	onClose() { const {contentEl} = this; contentEl.empty(); }
}