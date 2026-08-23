<script lang="ts">
	import type { GameReport, MoveRating } from '$lib/utils/chess-analysis';

	let {
		report,
		whiteName,
		blackName,
		ratings,
		accuracyByPly,
		currentIndex,
		isAnalyzing,
		onSelect
	}: {
		report: GameReport | null;
		whiteName: string;
		blackName: string;
		ratings: (MoveRating | null)[];
		accuracyByPly: (number | null)[];
		currentIndex: number;
		isAnalyzing: boolean;
		onSelect: (index: number) => void;
	} = $props();

	const ratingColor: Record<MoveRating, string> = {
		Brilliant: '#22d3ee',
		Best: '#22c55e',
		Excellent: '#4ade80',
		Good: '#86efac',
		Book: '#a1a1aa',
		Inaccuracy: '#eab308',
		Mistake: '#f97316',
		Blunder: '#ef4444'
	};

	const badTags: MoveRating[] = ['Blunder', 'Mistake', 'Inaccuracy'];

	function badCount(counts: Partial<Record<MoveRating, number>>) {
		return badTags.map((tag) => ({ tag, count: counts[tag] || 0 })).filter((t) => t.count > 0);
	}
</script>

<div class="bg-[#262421] rounded-xl border border-neutral-800 shadow-xl overflow-hidden">
	<div class="p-3 border-b border-neutral-800 bg-white/5">
		<h3 class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Game Report</h3>
	</div>

	{#if !report}
		<div class="p-4 space-y-3">
			<div class="h-14 animate-pulse rounded-lg bg-white/5"></div>
			<p class="text-[10px] font-bold text-neutral-500 uppercase text-center">
				{isAnalyzing ? 'Building report…' : 'Waiting for analysis…'}
			</p>
		</div>
	{:else}
		<div class="p-4 space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
					<p class="text-[9px] font-bold uppercase tracking-wider text-neutral-500 truncate">
						{whiteName}
					</p>
					<p class="text-2xl font-black text-white mt-0.5">{report.white.accuracy}%</p>
					<p class="text-[9px] text-neutral-500 font-bold mt-0.5">
						~{report.white.estimatedRating || '—'} rating
					</p>
					{#if badCount(report.white.moveCounts).length > 0}
						<div class="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
							{#each badCount(report.white.moveCounts) as { tag, count } (tag)}
								<span
									class="text-[9px] font-bold px-1.5 py-0.5 rounded"
									style="color: {ratingColor[tag]}; background-color: {ratingColor[tag]}1a;"
								>
									{count} {tag}
								</span>
							{/each}
						</div>
					{/if}
				</div>
				<div class="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
					<p class="text-[9px] font-bold uppercase tracking-wider text-neutral-500 truncate">
						{blackName}
					</p>
					<p class="text-2xl font-black text-white mt-0.5">{report.black.accuracy}%</p>
					<p class="text-[9px] text-neutral-500 font-bold mt-0.5">
						~{report.black.estimatedRating || '—'} rating
					</p>
					{#if badCount(report.black.moveCounts).length > 0}
						<div class="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
							{#each badCount(report.black.moveCounts) as { tag, count } (tag)}
								<span
									class="text-[9px] font-bold px-1.5 py-0.5 rounded"
									style="color: {ratingColor[tag]}; background-color: {ratingColor[tag]}1a;"
								>
									{count} {tag}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<p class="text-[9px] text-neutral-600 text-center -mt-1">
				Accuracy and rating are approximate, estimated from engine centipawn loss.
			</p>

			<div>
				<p class="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
					Accuracy by move
				</p>
				<div class="flex items-end gap-[2px] h-14 overflow-x-auto custom-scrollbar pb-1">
					{#each ratings as rating, i (i)}
						{#if i > 0}
							{@const acc = accuracyByPly[i]}
							{@const color = rating ? ratingColor[rating] : '#52525b'}
							{@const heightPct = acc !== null ? Math.max(6, acc) : 20}
							<button
								type="button"
								onclick={() => onSelect(i)}
								title={`Move ${i}${rating ? `: ${rating}` : ''}${acc !== null ? ` (${acc.toFixed(0)}% accurate)` : ''}`}
								class="w-1.5 shrink-0 rounded-t-sm transition-opacity hover:opacity-70 {i ===
								currentIndex
									? 'ring-2 ring-white'
									: ''}"
								style="height: {heightPct}%; background-color: {color};"
								aria-label={`Jump to move ${i}`}
							></button>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
