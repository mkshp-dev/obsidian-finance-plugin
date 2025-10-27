// src/views/overview-view.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type BeancountPlugin from '../main';
import OverviewComponent from './OverviewView.svelte';

export const OVERVIEW_VIEW_TYPE = "beancount-overview-view";

export class OverviewView extends ItemView {
	plugin: BeancountPlugin;
	component: OverviewComponent;

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return OVERVIEW_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Beancount Overview"; // Title shown in the tab
	}

	getIcon(): string {
		return "pie-chart"; // Use a pie-chart icon
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		// Mount the Svelte component, passing necessary props
		this.component = new OverviewComponent({
			target: container,
			props: {
				// Pass the runQuery function for fetching data
				runQuery: this.plugin.runQuery.bind(this.plugin),
				// Pass helper for parsing single values (like totals)
				parseSingleValue: this.plugin.parseSingleValue.bind(this.plugin) // Assuming parseSingleValue is public on plugin
			}
		});
	}

	async onClose() {
		// Destroy the Svelte component when the view is closed
		if (this.component) {
			this.component.$destroy();
		}
	}
}