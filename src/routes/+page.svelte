<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import PlatformSelect from '$lib/components/PlatformSelect.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { goto } from '$app/navigation';
	import { stashPgn } from '$lib/utils/pgn-transfer';
	import { ArrowRight, Sparkles, Swords, LineChart } from 'lucide-svelte';

	let platform: 'chess.com' | 'pgn' = $state('chess.com');
	let username = $state('');
	let pgnContent = $state('');

	function handlePlatformChange(p: 'chess.com' | 'pgn') {
		platform = p;
	}

	function handleFetch() {
		if (platform === 'chess.com') {
			const trimmed = username.trim();
			if (!trimmed) return;
			goto(`/games/${trimmed}`);
		} else {
			const trimmed = pgnContent.trim();
			if (!trimmed) return;
			stashPgn(trimmed);
			goto(`/games/pgn`);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && platform === 'chess.com') {
			e.preventDefault();
			handleFetch();
		}
	}

	const canSubmit = $derived(
		platform === 'chess.com' ? username.trim().length > 0 : pgnContent.trim().length > 0
	);

	const highlights = [
		{ icon: Swords, text: 'Move-by-move accuracy & blunder detection' },
		{ icon: LineChart, text: 'Estimated rating from your play, per game' },
		{ icon: Sparkles, text: 'Best-move arrows powered by Stockfish' }
	];
</script>

<svelte:head>
	<title>PassedPawn — Chess Game Review</title>
</svelte:head>

<div class="relative flex min-h-screen flex-col overflow-hidden bg-background">
	<!-- Decorative backdrop -->
	<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
		<div
			class="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
		></div>
		<div
			class="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-primary/5 blur-[100px]"
		></div>
		<div class="board-pattern absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"></div>
	</div>

	<AppHeader />

	<main class="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-12 sm:py-16">
		<div class="max-w-lg space-y-3 text-center">
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
			>
				<Sparkles class="h-3 w-3 text-primary" /> Free · Runs in your browser
			</span>
			<h1 class="text-3xl font-black tracking-tight sm:text-5xl">
				Know exactly<br class="hidden sm:block" /> where you went wrong.
			</h1>
			<p class="text-balance text-sm text-muted-foreground sm:text-base">
				Import a Chess.com profile or paste a PGN to get an engine-backed review — accuracy,
				move ratings, and best-move arrows for every position.
			</p>
		</div>

		<Card.Root class="w-full max-w-md border-border/80 bg-card shadow-xl shadow-black/[0.03]">
			<Card.Header>
				<Card.Title class="text-xl font-bold">Import a game</Card.Title>
				<Card.Description>Choose a source to start your review.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-5">
				<PlatformSelect selectedPlatform={platform} onPlatformChange={handlePlatformChange} />

				{#if platform === 'chess.com'}
					<div class="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
						<Label for="username">Chess.com username</Label>
						<Input
							id="username"
							type="text"
							bind:value={username}
							onkeydown={handleKeydown}
							placeholder="e.g. MagnusCarlsen"
							autocomplete="off"
						/>
					</div>
				{:else}
					<div class="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
						<Label for="pgn">PGN data</Label>
						<Textarea
							id="pgn"
							bind:value={pgnContent}
							placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'}
							class="min-h-32 font-mono text-xs"
						/>
					</div>
				{/if}

				<Button class="w-full group" size="lg" disabled={!canSubmit} onclick={handleFetch}>
					{platform === 'chess.com' ? 'Fetch games' : 'Analyze PGN'}
					<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
				</Button>
			</Card.Content>
		</Card.Root>

		<ul class="grid w-full max-w-md gap-2.5 sm:grid-cols-1">
			{#each highlights as h}
				<li class="flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
					>
						<h.icon class="h-3.5 w-3.5" />
					</span>
					{h.text}
				</li>
			{/each}
		</ul>
	</main>
</div>

<style>
	.board-pattern {
		background-image:
			linear-gradient(45deg, currentColor 25%, transparent 25%),
			linear-gradient(-45deg, currentColor 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, currentColor 75%),
			linear-gradient(-45deg, transparent 75%, currentColor 75%);
		background-size: 48px 48px;
		background-position:
			0 0,
			0 24px,
			24px -24px,
			-24px 0px;
		color: var(--foreground);
	}
</style>
