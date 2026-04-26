<!-- src/ui/common/SunburstChart.svelte -->
<!--
  Pure-SVG sunburst chart — no D3, no extra dependencies.
  Accepts the flat AccountItem[] arrays already produced by BalanceSheetController
  (each item retains its populated `children` array).
  Renders Assets / Liabilities / Equity as three colour-coded sectors.
  Supports hover tooltips and click-to-drill-down navigation.
-->
<script lang="ts">
	import type { AccountItem } from '../../controllers/BalanceSheetController';

	// ── Props ────────────────────────────────────────────────────────────────
	export let assets: AccountItem[]      = [];
	export let liabilities: AccountItem[] = [];
	export let equity: AccountItem[]      = [];
	export let currency: string           = 'USD';
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
	const SIZE    = 480;
	const CX      = SIZE / 2;
	const CY      = SIZE / 2;
	const RING_W  = 52;   // px per depth ring
	const INNER   = 72;   // inner radius of ring-0
	const TAU     = 2 * Math.PI;
	const START   = -Math.PI / 2; // 12 o'clock

	// ── Internal types ───────────────────────────────────────────────────────
	interface SunburstNode {
		id:           string;
		label:        string;
		path:         string;   // breadcrumb path string
		amount:       string;   // formatted
		value:        number;   // absolute value used for sizing
		color:        string;
		startAngle:   number;
		endAngle:     number;
		depth:        number;
		section:      'Assets' | 'Liabilities' | 'Equity';
		negative:     boolean;  // true if source item has negative amountNumber
		sourceItem:   AccountItem | null;
		children:     SunburstNode[];
	}

	interface DrillLevel {
		crumb:   string;          // display label for breadcrumb
		items:   AccountItem[];   // children to show as ring-0
		section: string;
	}

	// ── Reactive state ───────────────────────────────────────────────────────
	let drillStack: DrillLevel[]    = [];
	let hoveredNode: SunburstNode | null = null;
	let svgEl: SVGSVGElement;
	let tooltipX = 0;
	let tooltipY = 0;

	// ── Color helpers ─────────────────────────────────────────────────────────
	const SECTION_HUE: Record<string, number> = {
		Assets:      142,
		Liabilities: 4,
		Equity:      213,
	};

	function getColor(section: string, depth: number, negative: boolean = false): string {
		const hue  = SECTION_HUE[section] ?? 200;
		const sat  = 52;
		const lig  = Math.min(72, 36 + depth * 10);
		return `hsl(${hue}, ${sat}%, ${lig}%)`;
	}

	function getHoverColor(section: string, negative: boolean = false): string {
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
	 * Recursively convert AccountItem[] into SunburstNode[] occupying [sa, ea].
	 */
	function buildNodes(
		items:      AccountItem[],
		section:    string,
		sa:         number,
		ea:         number,
		depth:      number,
		parentPath: string,
	): SunburstNode[] {
		const total = items.reduce((s, i) => s + Math.abs(i.amountNumber), 0);
		if (total < 0.001 || ea <= sa) return [];

		let angle  = sa;
		const span = ea - sa;
		const result: SunburstNode[] = [];

		for (const item of items) {
			const slice = (Math.abs(item.amountNumber) / total) * span;
			if (slice < 0.003) { angle += slice; continue; } // skip near-invisible arcs

			const p = parentPath ? `${parentPath} › ${item.displayName}` : item.displayName;
			const isNeg = item.amountNumber < 0;
			const node: SunburstNode = {
				id:          item.account,
				label:       item.displayName,
				path:        p,
				amount:      item.amount,
				value:       Math.abs(item.amountNumber),
				color:       getColor(section, depth, isNeg),
				startAngle:  angle,
				endAngle:    angle + slice,
				depth,
				section:     section as SunburstNode['section'],
				negative:    isNeg,
				sourceItem:  item,
				children:    item.children?.length
					? buildNodes(item.children, section, angle, angle + slice, depth + 1, p)
					: [],
			};
			result.push(node);
			angle += slice;
		}
		return result;
	}

	// ── Full-tree layout (three sectors at ring-0) ───────────────────────────
	$: grandTotal =
		Math.abs(totalAssets) +
		Math.abs(totalLiabilities) +
		Math.abs(totalEquity);

	$: fullLayout = (() => {
		if (grandTotal < 0.001) return [];

		const aSpan = (Math.abs(totalAssets)      / grandTotal) * TAU;
		const lSpan = (Math.abs(totalLiabilities) / grandTotal) * TAU;
		const eSpan = TAU - aSpan - lSpan;

		// Root-level items for each section (level === 0 in the flat list)
		const aRoots = assets.filter(i => i.level === 0);
		const lRoots = liabilities.filter(i => i.level === 0);
		const eRoots = equity.filter(i => i.level === 0);

		// Each section's ring-0 is a synthetic node; ring-1+ come from its children
		function syntheticRoot(
			id:      string,
			label:   string,
			section: SunburstNode['section'],
			value:   number,
			sa:      number,
			ea:      number,
			roots:   AccountItem[],
		): SunburstNode {
			// The children of the synthetic root are the level-0 account items themselves
			// (e.g. "Assets:US", "Assets:ETrade" if roots = ["Assets"] and "Assets".children = [...])
			// If there is exactly one root we jump straight to its children for ring-1;
			// if there are many roots, they become ring-1 directly.
			const ring1Items = roots.length === 1 && roots[0].children?.length
				? roots[0].children
				: roots;

			return {
				id, label, path: label,
				amount:     `${value.toFixed(2)} ${currency}`,
				value:      Math.abs(value),
				color:      getColor(section, 0, value < 0),
				startAngle: sa,
				endAngle:   ea,
				depth:      0,
				section,
				negative:   value < 0,
				sourceItem: roots[0] ?? null,
				children:   ring1Items.length
					? buildNodes(ring1Items, section, sa, ea, 1, label)
					: [],
			};
		}

		const nodes: SunburstNode[] = [];
		if (aSpan > 0.003)
			nodes.push(syntheticRoot('__assets__',      assetsLabel,      'Assets',      totalAssets,      START,          START + aSpan,          aRoots));
		if (lSpan > 0.003)
			nodes.push(syntheticRoot('__liabilities__', liabilitiesLabel, 'Liabilities', totalLiabilities, START + aSpan,  START + aSpan + lSpan,  lRoots));
		if (eSpan > 0.003)
			nodes.push(syntheticRoot('__equity__',      equityLabel,      'Equity',      totalEquity,      START + aSpan + lSpan, START + TAU,   eRoots));

		return nodes;
	})();

	// ── Drill-down layout ────────────────────────────────────────────────────
	$: drillLayout = (() => {
		if (drillStack.length === 0) return null;
		const { items, section, crumb } = drillStack[drillStack.length - 1];
		return buildNodes(items, section, START, START + TAU, 0, crumb);
	})();

	$: activeLayout = drillLayout ?? fullLayout;

	// ── Flatten for rendering ────────────────────────────────────────────────
	function flattenNodes(nodes: SunburstNode[]): SunburstNode[] {
		return nodes.flatMap(n => [n, ...flattenNodes(n.children)]);
	}
	$: allNodes = flattenNodes(activeLayout);

	// ── SVG arc path ─────────────────────────────────────────────────────────
	function arcPath(n: SunburstNode): string {
		const r1 = INNER + n.depth * RING_W;
		const r2 = r1 + RING_W - 1;
		const { startAngle: sa, endAngle: ea } = n;

		// Full-circle: split into two arcs to avoid SVG degenerate case
		if (ea - sa >= TAU - 0.001) {
			return (
				`M ${CX + r2} ${CY} A ${r2} ${r2} 0 1 1 ${CX - r2} ${CY} ` +
				`A ${r2} ${r2} 0 1 1 ${CX + r2} ${CY} Z ` +
				`M ${CX + r1} ${CY} A ${r1} ${r1} 0 1 0 ${CX - r1} ${CY} ` +
				`A ${r1} ${r1} 0 1 0 ${CX + r1} ${CY} Z`
			);
		}

		const x1 = CX + r1 * Math.cos(sa), y1 = CY + r1 * Math.sin(sa);
		const x2 = CX + r2 * Math.cos(sa), y2 = CY + r2 * Math.sin(sa);
		const x3 = CX + r2 * Math.cos(ea), y3 = CY + r2 * Math.sin(ea);
		const x4 = CX + r1 * Math.cos(ea), y4 = CY + r1 * Math.sin(ea);
		const lg  = (ea - sa) > Math.PI ? 1 : 0;

		return (
			`M ${x1} ${y1} L ${x2} ${y2} ` +
			`A ${r2} ${r2} 0 ${lg} 1 ${x3} ${y3} ` +
			`L ${x4} ${y4} ` +
			`A ${r1} ${r1} 0 ${lg} 0 ${x1} ${y1} Z`
		);
	}

	// ── Label placement ───────────────────────────────────────────────────────
	function labelInfo(n: SunburstNode): { x: number; y: number; show: boolean; rotate: number } {
		const mid = (n.startAngle + n.endAngle) / 2;
		const r1  = INNER + n.depth * RING_W;
		const r   = r1 + RING_W / 2;
		const arcLen = (n.endAngle - n.startAngle) * r;
		// Only show labels if arc is visually wide enough for text
		const show = arcLen > 32 && (n.endAngle - n.startAngle) > 0.28;
		// Rotate label to follow arc for outer rings
		const rotate = (mid * 180 / Math.PI) + (mid > Math.PI / 2 && mid < 3 * Math.PI / 2 ? 180 : 0);
		return { x: CX + r * Math.cos(mid), y: CY + r * Math.sin(mid), show, rotate };
	}

	// ── Interactions ─────────────────────────────────────────────────────────
	function onArcMouseMove(e: MouseEvent, node: SunburstNode) {
		hoveredNode = node;
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		tooltipX = e.clientX - rect.left + 14;
		tooltipY = e.clientY - rect.top  - 14;
	}

	function onArcClick(node: SunburstNode) {
		const children = node.sourceItem?.children ?? [];
		if (children.length === 0) return; // leaf — nothing to drill into
		drillStack = [...drillStack, {
			crumb:   node.path,
			items:   children,
			section: node.section,
		}];
	}

	function drillBack(targetDepth: number) {
		drillStack = drillStack.slice(0, targetDepth);
	}

	// ── Centre text ───────────────────────────────────────────────────────────
	$: centreLabel = hoveredNode
		? hoveredNode.label
		: drillStack.length > 0
			? (drillStack[drillStack.length - 1].crumb.split(' › ').pop() ?? '')
			: title;

	$: centreSectionTotal = (() => {
		if (title === assetsLabel)      return totalAssets;
		if (title === liabilitiesLabel) return totalLiabilities;
		if (title === equityLabel)      return totalEquity;
		// "All Accounts" — show net worth (Assets minus Liabilities)
		return Math.abs(totalAssets) - Math.abs(totalLiabilities);
	})();

	$: centreAmount = hoveredNode
		? hoveredNode.amount
		: drillStack.length === 0
			? `${centreSectionTotal.toFixed(2)} ${currency}`
			: '';
</script>

<div class="sunburst-root">

	<!-- Breadcrumb navigation -->
	<nav class="sunburst-breadcrumb" aria-label="Account hierarchy breadcrumb">
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
		class="sunburst-chart-wrap"
		on:mouseleave={() => (hoveredNode = null)}
	>
		<svg
			bind:this={svgEl}
			viewBox="0 0 {SIZE} {SIZE}"
			class="sunburst-svg"
			role="img"
			aria-label="Sunburst chart"
		>
			<defs>
				<!-- Diagonal-stripe hatch for anomalous (unexpected-sign) accounts -->
				<pattern id="hatch-anomalous" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
					<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>
				</pattern>
			</defs>

			<!-- ── Arcs ── -->
			{#each allNodes as node (node.id + '|' + node.depth + '|' + node.startAngle.toFixed(4))}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<path
					d={arcPath(node)}
					fill={hoveredNode === node ? getHoverColor(node.section, node.negative) : node.color}
					stroke="var(--background-primary)"
					stroke-width="1.5"
					style="cursor:{node.sourceItem?.children?.length ? 'pointer' : 'default'};transition:fill 0.12s ease;"
					on:mousemove={(e) => onArcMouseMove(e, node)}
					on:click={() => onArcClick(node)}
					role="button"
					tabindex="0"
					aria-label="{node.path}: {node.amount}"
					on:keydown={(e) => e.key === 'Enter' && onArcClick(node)}
				/>
				<!-- Stripe overlay for anomalous-sign accounts -->
				{#if isAnomalous(node.section, node.negative)}
					<path
						d={arcPath(node)}
						fill="url(#hatch-anomalous)"
						stroke="none"
						pointer-events="none"
					/>
				{/if}
			{/each}

			<!-- ── Inline labels (depth 0 & 1 only, only if arc is wide enough) ── -->
			{#each allNodes.filter(n => n.depth <= 1) as node (node.id + '-lbl')}
				{@const lp = labelInfo(node)}
				{#if lp.show}
					<text
						x={lp.x}
						y={lp.y}
						text-anchor="middle"
						dominant-baseline="middle"
						font-size={node.depth === 0 ? 12 : 10}
						font-weight={node.depth === 0 ? '600' : '400'}
						fill="rgba(255,255,255,0.92)"
						pointer-events="none"
					>{node.label}</text>
				{/if}
			{/each}

			<!-- ── Centre hole ── -->
			<circle cx={CX} cy={CY} r={INNER - 5} fill="var(--background-primary)" />
			<text
				x={CX} y={CY - 11}
				text-anchor="middle"
				dominant-baseline="middle"
				font-size="13"
				font-weight="600"
				fill="var(--text-normal)"
				pointer-events="none"
			>{centreLabel}</text>
			<text
				x={CX} y={CY + 11}
				text-anchor="middle"
				dominant-baseline="middle"
				font-size="11"
				fill="var(--text-muted)"
				pointer-events="none"
			>{centreAmount}</text>
		</svg>

		<!-- Hover tooltip -->
		{#if hoveredNode}
			<div class="sunburst-tooltip" style="left:{tooltipX}px;top:{tooltipY}px;">
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
		<div class="sunburst-legend" aria-label="Chart legend">
			{#if Math.abs(totalAssets) > 0.001}
				<span class="legend-item">
					<span class="legend-dot" style="background:{getColor('Assets', 0)};"></span>
					{assetsLabel}
				</span>
			{/if}
			{#if Math.abs(totalLiabilities) > 0.001}
				<span class="legend-item">
					<span class="legend-dot" style="background:{getColor('Liabilities', 0)};"></span>
					{liabilitiesLabel}
				</span>
			{/if}
			{#if Math.abs(totalEquity) > 0.001}
				<span class="legend-item">
					<span class="legend-dot" style="background:{getColor('Equity', 0)};"></span>
					{equityLabel}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Hatch pattern hint -->
	{#if grandTotal >= 0.001}
		<p class="hatch-hint">
			<svg width="14" height="14" style="vertical-align:-2px;margin-right:4px;">
				<defs>
					<pattern id="hatch-hint-pat" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
						<line x1="0" y1="0" x2="0" y2="8" stroke="var(--text-muted)" stroke-width="3"/>
					</pattern>
				</defs>
				<rect width="14" height="14" rx="2" fill="var(--background-modifier-border)" />
				<rect width="14" height="14" rx="2" fill="url(#hatch-hint-pat)" />
			</svg>
			Stripes = unexpected sign
		</p>
	{/if}

	<!-- Empty state -->
	{#if grandTotal < 0.001}
		<p class="sunburst-empty">No data to display. Load your balance sheet first.</p>
	{/if}

</div>

<style>
	.sunburst-root {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--size-4-3);
		padding: var(--size-4-2) 0;
	}

	/* Breadcrumb */
	.sunburst-breadcrumb {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
		font-size: var(--font-ui-small);
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
	.sunburst-chart-wrap {
		position: relative;
		width: 100%;
		max-width: 460px;
	}

	.sunburst-svg {
		width: 100%;
		height: auto;
		display: block;
	}

	/* Tooltip */
	.sunburst-tooltip {
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
	.sunburst-legend {
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

	.sunburst-empty {
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
