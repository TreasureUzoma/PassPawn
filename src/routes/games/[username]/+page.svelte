<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import type { PageData } from './$types';
	import {
		Timer,
		Zap,
		Calendar,
		Trophy,
		Users,
		ChevronRight,
		PlusCircle,
		MinusCircle,
		CircleSlash,
		Clock,
		Search,
		X
	} from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { stashPgn } from '$lib/utils/pgn-transfer';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();

	function reviewGame(pgn: string) {
		stashPgn(pgn);
		goto(resolve('/games/pgn'));
	}

	interface GamePlayer {
		username: string;
		rating: number;
		result: string;
	}

	interface Game {
		pgn: string;
		time_control: string;
		white: GamePlayer;
		black: GamePlayer;
		time_class: string;
		rules: string;
		end_time?: number;
		last_activity?: number;
		url: string;
	}

	interface ArchiveResponse {
		archives: string[];
	}

	const archivesQuery = createQuery(() => ({
		queryKey: ['archives', data.username],
		queryFn: async () => {
			const res = await fetch(`https://api.chess.com/pub/player/${data.username}/games/archives`);
			if (!res.ok) throw new Error('Failed to fetch archives index');
			const archiveData: ArchiveResponse = await res.json();
			return archiveData.archives.reverse();
		}
	}));

	const allGamesQuery = createQuery(() => ({
		queryKey: ['allGames', data.username],
		enabled: !!archivesQuery.data,
		queryFn: async () => {
			const urls = archivesQuery.data!;
			const results = await Promise.all(
				urls.map(async (url) => {
					const res = await fetch(url);
					if (!res.ok) return [];
					const json = await res.json();
					return json.games || [];
				})
			);
			return results.flat() as Game[];
		}
	}));

	function getGameResult(game: Game) {
		const isWhite = game.white.username.toLowerCase() === data.username.toLowerCase();
		const player = isWhite ? game.white : game.black;
		const opponent = isWhite ? game.black : game.white;

		if (player.result === 'win')
			return { type: 'win', label: 'Win', color: 'text-green-500', icon: PlusCircle };
		if (opponent.result === 'win')
			return { type: 'loss', label: 'Loss', color: 'text-red-500', icon: MinusCircle };

		return { type: 'draw', label: 'Draw', color: 'text-muted-foreground', icon: CircleSlash };
	}

	function getOpponent(game: Game) {
		const isWhite = game.white.username.toLowerCase() === data.username.toLowerCase();
		return isWhite ? game.black : game.white;
	}

	function getGameTypeIcon(timeClass: string) {
		switch (timeClass) {
			case 'blitz':
				return Zap;
			case 'bullet':
				return Zap;
			case 'rapid':
				return Timer;
			case 'daily':
				return Calendar;
			default:
				return Clock;
		}
	}

	function getGameDate(game: Game) {
		const ts = game.end_time || game.last_activity;
		if (!ts) return 'Unknown';
		return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	// --- Search & filters ---
	let searchQuery = $state('');
	let timeClassFilter = $state<'all' | 'bullet' | 'blitz' | 'rapid' | 'daily'>('all');
	let resultFilter = $state<'all' | 'win' | 'loss' | 'draw'>('all');
	let visibleCount = $state(25);

	const timeClassOptions: { value: typeof timeClassFilter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'bullet', label: 'Bullet' },
		{ value: 'blitz', label: 'Blitz' },
		{ value: 'rapid', label: 'Rapid' },
		{ value: 'daily', label: 'Daily' }
	];

	const resultOptions: { value: typeof resultFilter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'win', label: 'Wins' },
		{ value: 'loss', label: 'Losses' },
		{ value: 'draw', label: 'Draws' }
	];

	let sortedGames = $derived(
		[...(allGamesQuery.data ?? [])].sort((a, b) => {
			const timeA = a.end_time || a.last_activity || 0;
			const timeB = b.end_time || b.last_activity || 0;
			return timeB - timeA;
		})
	);

	let filteredGames = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return sortedGames.filter((game) => {
			if (timeClassFilter !== 'all' && game.time_class !== timeClassFilter) return false;
			if (resultFilter !== 'all' && getGameResult(game).type !== resultFilter) return false;
			if (q && !getOpponent(game).username.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	let visibleGames = $derived(filteredGames.slice(0, visibleCount));
	let hasActiveFilters = $derived(
		searchQuery.trim() !== '' || timeClassFilter !== 'all' || resultFilter !== 'all'
	);

	// Reset pagination whenever the result set changes shape
	$effect(() => {
		searchQuery;
		timeClassFilter;
		resultFilter;
		visibleCount = 25;
	});

	function clearFilters() {
		searchQuery = '';
		timeClassFilter = 'all';
		resultFilter = 'all';
	}
</script>

<AppHeader>
	<Button href={resolve('/')} variant="ghost" size="sm" class="text-xs font-semibold">
		Change user
	</Button>
</AppHeader>

<div class="container mx-auto max-w-4xl space-y-6 p-4">
	<div
		class="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded-2xl border bg-card p-6 shadow-sm relative overflow-hidden"
	>
		<!-- Decoration -->
		<div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>

		<img
			src={data.profile.avatar ?? `https://avatar.idolo.dev/${data.username}`}
			alt={data.profile.username}
			class="h-24 w-24 shrink-0 rounded-full border-4 border-background shadow-xl object-cover"
		/>
		<div class="min-w-0 w-full text-center sm:text-left">
			<h1
				class="truncate text-2xl sm:text-4xl font-black tracking-tight"
				title={data.profile.username}
			>
				{data.profile.username}
			</h1>
			<div
				class="mt-2 flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-muted-foreground"
			>
				<span class="flex items-center gap-1.5 font-medium">
					<Users class="h-4 w-4 shrink-0" />
					{data.profile.followers.toLocaleString()} followers
				</span>
				{#if data.profile.country}
					<span class="flex items-center gap-1.5 font-medium">
						<span class="opacity-50">#</span>
						{data.profile.country.split('/').pop()}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-2 px-2">
			<h2 class="text-xl font-bold flex items-center gap-2">
				<Trophy class="h-5 w-5 text-yellow-500 shrink-0" />
				Recent Games
			</h2>
			<div class="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded border">
				{#if hasActiveFilters}
					{filteredGames.length} / {allGamesQuery.data?.length || 0} GAMES
				{:else}
					{allGamesQuery.data?.length || 0} GAMES
				{/if}
			</div>
		</div>

		<!-- Search & Filters -->
		<div class="flex flex-col gap-2.5 rounded-xl border bg-card p-3">
			<div class="relative">
				<Search
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="text"
					placeholder="Search by opponent..."
					bind:value={searchQuery}
					class="pl-9 pr-9"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						aria-label="Clear search"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				{#each timeClassOptions as opt}
					<button
						type="button"
						onclick={() => (timeClassFilter = opt.value)}
						class="rounded-full border px-3 py-1 text-xs font-semibold transition-colors {timeClassFilter ===
						opt.value
							? 'bg-primary text-primary-foreground border-primary'
							: 'bg-transparent text-muted-foreground border-border hover:bg-muted'}"
					>
						{opt.label}
					</button>
				{/each}
				<span class="mx-1 h-4 w-px bg-border hidden sm:block"></span>
				{#each resultOptions as opt}
					<button
						type="button"
						onclick={() => (resultFilter = opt.value)}
						class="rounded-full border px-3 py-1 text-xs font-semibold transition-colors {resultFilter ===
						opt.value
							? 'bg-primary text-primary-foreground border-primary'
							: 'bg-transparent text-muted-foreground border-border hover:bg-muted'}"
					>
						{opt.label}
					</button>
				{/each}
				{#if hasActiveFilters}
					<button
						type="button"
						onclick={clearFilters}
						class="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2"
					>
						Clear filters
					</button>
				{/if}
			</div>
		</div>

		{#if archivesQuery.isPending || allGamesQuery.isPending}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div class="h-20 animate-pulse rounded-xl border bg-card"></div>
				{/each}
			</div>
		{:else if archivesQuery.isError || allGamesQuery.isError}
			<div
				class="py-8 text-center text-destructive bg-destructive/10 rounded-xl border border-destructive/20 p-4"
			>
				<p class="font-bold">Failed to load games</p>
				<p class="text-xs opacity-80">Chess.com API might be temporarily unavailable</p>
			</div>
		{:else}
			<div class="grid gap-3">
				{#each visibleGames as game}
					{@const result = getGameResult(game)}
					{@const TypeIcon = getGameTypeIcon(game.time_class)}
					<button
						type="button"
						onclick={() => reviewGame(game.pgn)}
						class="group relative flex w-full items-center gap-3 sm:gap-4 rounded-xl border bg-card p-3 sm:p-4 text-left transition-all hover:border-primary hover:shadow-lg active:scale-[0.98]"
					>
						<!-- Left: Game Type Icon -->
						<div
							class="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
						>
							<TypeIcon class="h-5 w-5 sm:h-6 sm:w-6" />
						</div>

						<!-- Center: Players -->
						<div class="flex-1 min-w-0">
							<div class="flex flex-col gap-0.5">
								<div
									class="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-sm sm:text-base font-bold"
								>
									<span class="truncate text-right sm:text-left" title={game.white.username}
										>{game.white.username}</span
									>
									<span class="text-[10px] opacity-40 font-mono shrink-0 px-0.5">VS</span>
									<span class="truncate" title={game.black.username}>{game.black.username}</span>
								</div>
								<div
									class="mt-0.5 flex items-center flex-wrap justify-center sm:justify-start gap-x-2 gap-y-1 text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider"
								>
									<span>{game.time_class}</span>
									<span class="opacity-30">•</span>
									<span>{game.rules}</span>
									<span class="opacity-30">•</span>
									<span>{getGameDate(game)}</span>
								</div>
							</div>
						</div>

						<!-- Right: Result Icon -->
						<div class="flex shrink-0 items-center gap-3">
							<div class="flex flex-col items-end">
								<result.icon class="h-5 w-5 sm:h-6 sm:w-6 {result.color}" />
								<span
									class="hidden sm:block text-[10px] font-bold {result.color} mt-1 uppercase tracking-tighter"
								>
									{result.label}
								</span>
							</div>
							<ChevronRight
								class="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors"
							/>
						</div>
					</button>
				{/each}

				{#if filteredGames.length > visibleGames.length}
					<Button variant="outline" class="w-full" onclick={() => (visibleCount += 25)}>
						Load more ({filteredGames.length - visibleGames.length} remaining)
					</Button>
				{/if}

				{#if allGamesQuery.data?.length === 0}
					<div
						class="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed"
					>
						<p class="font-medium italic">No recent games found for this user.</p>
					</div>
				{:else if filteredGames.length === 0}
					<div
						class="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed space-y-2"
					>
						<p class="font-medium italic">No games match your filters.</p>
						<button
							type="button"
							onclick={clearFilters}
							class="text-xs font-semibold text-primary underline underline-offset-2"
						>
							Clear filters
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
