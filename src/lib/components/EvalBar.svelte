<script lang="ts">
	let {
		evaluation = 0,
		orientation = 'vertical',
		loading = false
	}: { evaluation?: number; orientation?: 'vertical' | 'horizontal'; loading?: boolean } = $props();

	let clampedEval = $derived(Math.max(-10, Math.min(10, evaluation)));
	// Percentage for white's advantage (0 to 100)
	// +10 -> 100%, 0 -> 50%, -10 -> 0%
	let whitePercent = $derived(((clampedEval + 10) / 20) * 100);
</script>

<div
	class="bg-neutral-900 rounded-md overflow-hidden flex relative ring-1 ring-white/10 shadow-2xl
    {orientation === 'vertical' ? 'flex-col-reverse h-full w-7' : 'flex-row h-7 w-full'}
    {loading ? 'animate-pulse' : ''}"
>
	<!-- White Bar -->
	<div
		class="bg-gradient-to-t from-neutral-100 to-white transition-all duration-700 ease-out {loading
			? 'opacity-40'
			: ''}"
		style="{orientation === 'vertical'
			? `height: ${loading ? 50 : whitePercent}%`
			: `width: ${loading ? 50 : whitePercent}%`}; {orientation === 'vertical'
			? 'width: 100%'
			: 'height: 100%'}"
	></div>

	<!-- Black Bar (implicitly the background, but let's make it explicit if needed) -->
	<div class="bg-neutral-800 absolute inset-0 -z-10"></div>

	<!-- Evaluation Score -->
	<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
		<span
			class="text-[9px] font-black tracking-tighter mix-blend-difference text-white uppercase px-1"
		>
			{#if loading}
				···
			{:else}
				{Math.abs(evaluation) >= 10
					? evaluation > 0
						? 'M'
						: '-M'
					: (evaluation > 0 ? '+' : '') + evaluation.toFixed(1)}
			{/if}
		</span>
	</div>
</div>
