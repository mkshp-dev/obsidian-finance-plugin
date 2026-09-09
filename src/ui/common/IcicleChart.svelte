<!-- src/ui/common/IcicleChart.svelte -->
<!--
  Pure-SVG icicle chart — no D3, no extra dependencies.
  Top-down partition layout: root row at top, leaf accounts toward the
  bottom, rectangle widths proportional to balance. Mirrors the props,
  drill-down, and interaction contract of SunburstChart.svelte so the two
  can be swapped in the same UI area.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { AccountItem } from '../../controllers/BalanceSheetController';

	const dispatch = createEventDispatcher();

	// ── Props ────────────────────────────────────────────────────────────────
	export let assets: AccountItem[]      = [];
	export let liabilities: AccountItem[] = [];
	export let equity: AccountItem[]      = [];
	export let currency: string           = 'USD';
	export let decimals: number            = 2;
	export let totalAssets: number        = 0;
	export let totalLiabilities: number   = 0;
	export let totalEquity: number        = 0;
	export let title: string              = 'All Accounts';
	// Optional overrides for section labels (used e.g. for Income Statement)
	export let assetsLabel: string              = 'Assets';
	export let liabilitiesLabel: string         = 'Liabilities';
	export let equityLabel: string              = 'Equity';
	// Expected sign per section: true = expect negative balance, false = expect positive
	export let assetsExpectNegative: boolean      = false;
	export let liabilitiesExpectNegative: boolean = true;  // beancount liabilities are credit (negative)

	// ── SVG geometry ─────────────────────────────────────────────────────────
	const CHART_W    = 480;  // px, viewBox width
	const ROW_H      = 40;   // px per depth row
	const ROW_GAP    = 2;    // gap between stacked rows
	const MIN_LABEL_W = 34;  // px — below this, no label is drawn
	const MIN_SLICE_W = 1.5; // px — below this, node is skipped (space still consumed)

	// ── Internal types ───────────────────────────────────────────────────────
	interface IcicleNode {
		id:           string;
		label:        string;
		path:         string;   // breadcrumb path string
		amount:       string;   // formatted
		value:        number;   // absolute value used for sizing
		color:        string;
		x0:           number;
		x1:           number;
		depth:        number;
		section:      'Assets' | 'Liabilities' | 'Equity';
		negative:     boolean;  // true if source item has negative amountNumber
		sourceItem:   AccountItem | null;
		children:     IcicleNode[];
	}

	interface DrillLevel {
		crumb:   string;          // display label for breadcrumb
		items:   AccountItem[];   // children to show as row 0
		section: string;
	}

	// ── Reactive state ───────────────────────────────────────────────────────
	let drillStack: DrillLevel[]   = [];
	let hoveredNode: IcicleNode | null = null;
	let svgEl: SVGSVGElement;
	let tooltipX = 0;
	let tooltipY = 0;

	// ── Color helpers (matches SunburstChart's palette) ─────────────────────
	const SECTION_HUE: Record<string, number> = {
		Assets:      142,
		Liabilities: 4,
		Equity:      213,
	};

	function getColor(section: string, depth: number): string {
		const hue = SECTION_HUE[section] ?? 200;
		const lig = Math.min(72, 36 + depth * 10);
		return `hsl(${hue}, 52%, ${lig}%)`;
	}

	function getHoverColor(section: string): string {
		const hue = SECTION_HUE[section] ?? 200;
		return `hsl(${hue}, 65%, 55%)`;
	}

	// ── Anomaly detection ────────────────────────────────────────────────────
	function isAnomalous(section: string, negative: boolean): boolean {
		if (section === 'Assets')      return assetsExpectNegative ? !negative : negative;
		if (section === 'Liabilities') return liabilitiesExpectNegative ? !negative : negative;
		return negative; // equity: expect positive
	}

	// ── Layout builder ────────────────────────────────────────────────────────
	/**
	 * Recursively convert AccountItem[] into IcicleNode[] occupying [x0, x1].
	 */
	function buildNodes(
		items:      AccountItem[],
		section:    string,
		x0:         number,
		x1:         number,
		depth:      number,
		parentPath: string,
	): IcicleNode[] {
		const total = items.reduce((s, i) => s + Math.abs(i.amountNumber), 0);
		if (total < 0.001 || x1 <= x0) return [];

		let x = x0;
		const span = x1 - x0;
		const result: IcicleNode[] = [];

		for (const item of items) {
			const w = (Math.abs(item.amountNumber) / total) * span;
			if (w < MIN_SLICE_W) { x += w; continue; } // skip near-invisible slices

			const p = parentPath ? `${parentPath} › ${item.displayName}` : item.displayName;
			const isNeg = item.amountNumber < 0;
			const node: IcicleNode = {
				id:          item.account,
				label:       item.displayName,
				path:        p,
				amount:      item.amount,
				value:       Math.abs(item.amountNumber),
				color:       getColor(section, depth),
				x0:          x,
				x1:          x + w,
				depth,
				section:     section as IcicleNode['section'],
				negative:    isNeg,
				sourceItem:  item,
				children:    item.children?.length
					? buildNodes(item.children, section, x, x + w, depth + 1, p)
					: [],
			};
			result.push(node);
			x += w;
		}
		return result;
	}

	// ── Full-tree layout (three sections side-by-side at row 0) ─────────────
	$: grandTotal =
		Math.abs(totalAssets) +
		Math.abs(totalLiabilities) +
		Math.abs(totalEquity);

	$: fullLayout = (() => {
		if (grandTotal < 0.001) return [];

		const aW = (Math.abs(totalAssets)      / grandTotal) * CHART_W;
		const lW = (Math.abs(totalLiabilities) / grandTotal) * CHART_W;
		const eW = CHART_W - aW - lW;

		// Root-level items for each section (level === 0 in the flat list)
		const aRoots = assets.filter(i => i.level === 0);
		const lRoots = liabilities.filter(i => i.level === 0);
		const eRoots = equity.filter(i => i.level === 0);

		function syntheticRoot(
			id:      string,
			label:   string,
			section: IcicleNode['section'],
			value:   number,
			x0:      number,
			x1:      number,
			roots:   AccountItem[],
		): IcicleNode {
			const childItems = roots.length === 1 && roots[0].children?.length
				? roots[0].children
				: roots;

			return {
				id, label, path: label,
				amount:     `${value.toFixed(decimals)} ${currency}`,
				value:      Math.abs(value),
				color:      getColor(section, 0),
				x0, x1,
				depth:      0,
				section,
				negative:   value < 0,
				sourceItem: roots[0] ?? null,
				children:   childItems.length
					? buildNodes(childItems, section, x0, x1, 1, label)
					: [],
			};
		}

		const nodes: IcicleNode[] = [];
		if (aW > MIN_SLICE_W)
			nodes.push(syntheticRoot('__assets__',      assetsLabel,      'Assets',      totalAssets,      0,      aW,          aRoots));
		if (lW > MIN_SLICE_W)
			nodes.push(syntheticRoot('__liabilities__', liabilitiesLabel, 'Liabilities', totalLiabilities, aW,     aW + lW,     lRoots));
		if (eW > MIN_SLICE_W)
			nodes.push(syntheticRoot('__equity__',      equityLabel,      'Equity',      totalEquity,      aW + lW, CHART_W,   eRoots));

		return nodes;
	})();

	// ── Drill-down layout ────────────────────────────────────────────────────
	$: drillLayout = (() => {
		if (drillStack.length === 0) return null;
		const { items, section, crumb } = drillStack[drillStack.length - 1];
		return buildNodes(items, section, 0, CHART_W, 0, crumb);
	})();

	$: activeLayout = drillLayout ?? fullLayout;

	// ── Flatten for rendering ────────────────────────────────────────────────
	function flattenNodes(nodes: IcicleNode[]): IcicleNode[] {
		return nodes.flatMap(n => [n, ...flattenNodes(n.children)]);
	}
	$: allNodes = flattenNodes(activeLayout);

	$: maxDepth = allNodes.reduce((m, n) => Math.max(m, n.depth), 0);
	$: chartHeight = (maxDepth + 1) * ROW_H;

	function rectFor(n: IcicleNode) {
		return { x: n.x0, y: n.depth * ROW_H, width: Math.max(0, n.x1 - n.x0), height: ROW_H - ROW_GAP };
	}

	// ── Interactions ─────────────────────────────────────────────────────────
	function onRectMouseMove(e: MouseEvent, node: IcicleNode) {
		hoveredNode = node;
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		tooltipX = e.clientX - rect.left + 14;
		tooltipY = e.clientY - rect.top  - 14;
	}

	function onRectClick(node: IcicleNode, event?: MouseEvent | KeyboardEvent) {
		// Ctrl/Cmd+click always navigates to Transactions, regardless of whether
		// the node has children — it's the deliberate escape hatch out of drilling.
		if (event?.ctrlKey || event?.metaKey) {
			const account = node.sourceItem?.account || (node.id.startsWith('__') ? '' : node.id);
			if (account) {
				dispatch('segment-click', { account, node });
			}
			return;
		}
		// Plain click drills in (zooms the sub-tree to fill the full width).
		const children = node.sourceItem?.children ?? [];
		if (children.length > 0) {
			drillStack = [...drillStack, {
				crumb:   node.path,
				items:   children,
				section: node.section,
			}];
		}
	}

	function drillBack(targetDepth: number) {
		drillStack = drillStack.slice(0, targetDepth);
	}
</script>

<div class="icicle-root">

	<!-- Breadcrumb navigation -->
	<nav class="icicle-breadcrumb" aria-label="Account hierarchy breadcrumb">
		<button
			class="crumb-btn"
			class:active={drillStack.length === 0}
			on:click={() => drillBack(0)}
		>{title}</button>

		{#each drillStack as level, i}
			<span class="crumb-sep" aria-hidden="true">›</span>
			<button
				class="crumb-btn"
				class:active={i === drillStack.length - 1}
				on:click={() => drillBack(i + 1)}
			>{level.crumb.split(' › ').pop()}</button>
		{/each}
	</nav>

	<!-- SVG chart + tooltip wrapper -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="icicle-chart-wrap"
		on:mouseleave={() => (hoveredNode = null)}
	>
		<svg
			bind:this={svgEl}
			viewBox="0 0 {CHART_W} {chartHeight}"
			class="icicle-svg"
			role="img"
			aria-label="Icicle chart"
		>
			<defs>
				<!-- Diagonal-stripe hatch for anomalous (unexpected-sign) accounts -->
				<pattern id="icicle-hatch-anomalous" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
					<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>
				</pattern>
			</defs>

			<!-- ── Rectangles ── -->
			{#each allNodes as node (node.id + '|' + node.depth + '|' + node.x0.toFixed(2))}
				{@const r = rectFor(node)}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<rect
					x={r.x}
					y={r.y}
					width={r.width}
					height={r.height}
					fill={hoveredNode === node ? getHoverColor(node.section) : node.color}
					stroke="var(--background-primary)"
					stroke-width="1.5"
					class="icicle-rect"
					class:drillable={node.sourceItem?.children?.length}
					on:mousemove={(e) => onRectMouseMove(e, node)}
					on:click={(e) => onRectClick(node, e)}
					role="button"
					tabindex="0"
					aria-label="{node.path}: {node.amount}"
					title={node.sourceItem?.children?.length ? 'Click to drill in · Ctrl/Cmd+click: view in Transactions' : 'Ctrl/Cmd+click: view in Transactions'}
					on:keydown={(e) => e.key === 'Enter' && onRectClick(node, e)}
				/>
				<!-- Stripe overlay for anomalous-sign accounts -->
				{#if isAnomalous(node.section, node.negative)}
					<rect
						x={r.x} y={r.y} width={r.width} height={r.height}
						fill="url(#icicle-hatch-anomalous)"
						stroke="none"
						pointer-events="none"
					/>
				{/if}
			{/each}

			<!-- ── Inline labels (only if rect is wide enough) ── -->
			{#each allNodes as node (node.id + '-lbl')}
				{@const r = rectFor(node)}
				{#if r.width > MIN_LABEL_W}
					<text
						x={r.x + r.width / 2}
						y={r.y + r.height / 2 - 5}
						text-anchor="middle"
						dominant-baseline="middle"
						font-size={node.depth === 0 ? 12 : 10}
						font-weight={node.depth === 0 ? '600' : '400'}
						fill="rgba(255,255,255,0.92)"
						pointer-events="none"
					>{node.label}</text>
					<text
						x={r.x + r.width / 2}
						y={r.y + r.height / 2 + 9}
						text-anchor="middle"
						dominant-baseline="middle"
						font-size="9"
						fill="rgba(255,255,255,0.78)"
						pointer-events="none"
					>{node.amount}</text>
				{/if}
			{/each}
		</svg>

		<!-- Hover tooltip -->
		{#if hoveredNode}
			<div class="icicle-tooltip" style="left:{tooltipX}px;top:{tooltipY}px;">
				<div class="tt-path">{hoveredNode.path}</div>
				<div class="tt-amount">{hoveredNode.amount}</div>
				{#if hoveredNode.sourceItem?.children?.length}
					<div class="tt-hint">Click to drill down ›</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Legend (shown at root level only) -->
	{#if drillStack.length === 0}
		<div class="icicle-legend" aria-label="Chart legend">
			{#if Math.abs(totalAssets) > 0.001}
				<span class="legend-item">
					<span class="legend-dot legend-assets"></span>
					{assetsLabel}
				</span>
			{/if}
			{#if Math.abs(totalLiabilities) > 0.001}
				<span class="legend-item">
					<span class="legend-dot legend-liabilities"></span>
					{liabilitiesLabel}
				</span>
			{/if}
			{#if Math.abs(totalEquity) > 0.001}
				<span class="legend-item">
					<span class="legend-dot legend-equity"></span>
					{equityLabel}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Hatch pattern hint -->
	{#if grandTotal >= 0.001}
		<p class="hatch-hint">
			<svg width="14" height="14" class="hatch-hint-svg">
				<defs>
					<pattern id="icicle-hatch-hint-pat" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
						<line x1="0" y1="0" x2="0" y2="8" stroke="var(--text-muted)" stroke-width="3"/>
					</pattern>
				</defs>
				<rect width="14" height="14" rx="2" fill="var(--background-modifier-border)" />
				<rect width="14" height="14" rx="2" fill="url(#icicle-hatch-hint-pat)" />
			</svg>
			Stripes = unexpected sign
		</p>
	{/if}

	<!-- Empty state -->
	{#if grandTotal < 0.001}
		<p class="icicle-empty">No data to display. Load your balance sheet first.</p>
	{/if}

</div>

<style>
	.icicle-root {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--size-4-3);
		padding: var(--size-4-2) 0;
	}

	/* Breadcrumb */
	.icicle-breadcrumb {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
		font-size: var(--font-ui-small);
		width: 100%;
		max-width: 460px;
	}

	.crumb-btn {
		background: none;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 2px 10px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		transition: background 0.1s, color 0.1s;
	}
	.crumb-btn:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
	.crumb-btn.active { color: var(--text-normal); font-weight: 600; border-color: var(--interactive-accent); }

	.crumb-sep { color: var(--text-faint); font-size: 12px; }

	/* SVG container */
	.icicle-chart-wrap {
		position: relative;
		width: 100%;
		max-width: 460px;
	}

	.icicle-svg {
		width: 100%;
		height: auto;
		display: block;
	}

	/* Tooltip */
	.icicle-tooltip {
		position: absolute;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: 8px 12px;
		pointer-events: none;
		z-index: 20;
		box-shadow: var(--shadow-s);
		max-width: 240px;
		min-width: 140px;
	}

	.tt-path {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin-bottom: 3px;
		word-break: break-all;
	}

	.tt-amount {
		font-size: var(--font-ui-medium);
		font-weight: 600;
		color: var(--text-normal);
	}

	.tt-hint {
		margin-top: 4px;
		font-size: 11px;
		color: var(--text-faint);
		font-style: italic;
	}

	/* Legend */
	.icicle-legend {
		display: flex;
		gap: var(--size-4-5);
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.legend-dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-assets {
		background: hsl(142, 52%, 36%);
	}

	.legend-liabilities {
		background: hsl(4, 52%, 36%);
	}

	.legend-equity {
		background: hsl(213, 52%, 36%);
	}

	.icicle-rect {
		cursor: pointer;
		transition: fill 0.12s ease;
	}

	.icicle-rect.drillable {
		cursor: pointer;
	}

	.hatch-hint-svg {
		vertical-align: -2px;
		margin-right: 4px;
	}

	.icicle-empty {
		color: var(--text-faint);
		font-size: var(--font-ui-small);
		text-align: center;
		padding: var(--size-4-4);
	}

	.hatch-hint {
		margin: 0;
		font-size: 11px;
		color: var(--text-faint);
		display: flex;
		align-items: center;
		gap: 4px;
	}
</style>
