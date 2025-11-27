<script lang="ts">
	import { onMount, onDestroy, beforeUpdate } from 'svelte';
	// Import necessary types and Chart.js itself
	import Chart, { type ChartConfiguration, type ChartItem } from 'chart.js/auto';

	// Props for the chart
	export let config: ChartConfiguration; // The configuration object for Chart.js
	export let width: string | null = null; // Optional width
	export let height: string | null = null; // Optional height

	let canvasElement: HTMLCanvasElement; // Reference to the canvas element
	let chartInstance: Chart | null = null; // Reference to the Chart.js instance

	// Function to create or update the chart
	function renderChart() {
		if (!canvasElement || !config) return;

		// If a chart instance exists, update it
		if (chartInstance) {
			chartInstance.data = config.data; // Update data
			chartInstance.options = config.options || {}; // Update options
			chartInstance.update(); // Redraw the chart
		} else {
			// Otherwise, create a new chart instance
			chartInstance = new Chart(canvasElement as ChartItem, config);
		}
	}

	// --- Lifecycle Functions ---

	// When the component mounts, render the initial chart
	onMount(() => {
		renderChart();
	});

	// Before the component updates (e.g., props change), re-render the chart
	beforeUpdate(() => {
		renderChart();
	});

	// When the component is destroyed, clean up the Chart.js instance
	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}
	});

</script>

<canvas bind:this={canvasElement} {width} {height}></canvas>