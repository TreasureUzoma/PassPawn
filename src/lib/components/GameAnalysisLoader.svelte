<script lang="ts">
	import { fade } from 'svelte/transition';

	let { done = 0, total = 0 }: { done?: number; total?: number } = $props();

	let pct = $derived(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);

	// 3x3 "board" used for the scanning-square animation below.
	const squares = Array.from({ length: 9 }, (_, i) => i);
</script>

<div
	class="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-[#161512] px-6"
	transition:fade={{ duration: 250 }}
>
	<div class="board-glow absolute inset-0"></div>

	<div class="relative grid grid-cols-3 gap-1.5">
		{#each squares as i (i)}
			<div
				class="square h-7 w-7 rounded-sm sm:h-9 sm:w-9 {i % 2 === 0 ? 'bg-[#3a3835]' : 'bg-[#2a2825]'}"
				style="animation-delay: {i * 90}ms"
			></div>
		{/each}
	</div>

	<div class="relative flex flex-col items-center gap-2 text-center">
		<h2 class="text-sm font-black uppercase tracking-[0.2em] text-neutral-200">
			Reviewing your game
		</h2>
		<p class="text-xs font-medium text-neutral-500">
			Stockfish is checking every move
			{#if total > 0}
				<span class="text-neutral-400">· {done}/{total}</span>
			{/if}
		</p>
	</div>

	<div class="relative h-1 w-48 overflow-hidden rounded-full bg-white/5 sm:w-64">
		<div
			class="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
			style="width: {pct}%"
		></div>
	</div>
</div>

<style>
	.board-glow {
		background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.05), transparent 60%);
	}

	.square {
		animation: pulse-square 1.35s ease-in-out infinite;
	}

	@keyframes pulse-square {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(0.85);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.square {
			animation: none;
			opacity: 0.8;
		}
	}
</style>
