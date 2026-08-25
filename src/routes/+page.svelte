<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import PlatformSelect from '$lib/components/PlatformSelect.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { goto } from '$app/navigation';
	import { stashPgn } from '$lib/utils/pgn-transfer';

	let platform: 'chess.com' | 'pgn' = $state('chess.com');
	let username = $state('');
	let pgnContent = $state('');

	function handlePlatformChange(p: 'chess.com' | 'pgn') {
		platform = p;
	}

	function handleFetch() {
		if (platform === 'chess.com') {
			goto(`/games/${username}`);
		} else {
			const trimmed = pgnContent.trim();
			if (!trimmed) return;
			stashPgn(trimmed);
			goto(`/games/pgn`);
		}
	}
</script>

<div class="min-h-screen flex-center p-4">
	<Card.Root class="w-full max-w-md border-border bg-card shadow-lg">
		<Card.Header>
			<Card.Title class="text-2xl font-bold text-center">Import Games</Card.Title>
			<Card.Description class="text-center">
				Analyze your games from Chess.com or paste a PGN directly.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="flex justify-center">
				<PlatformSelect selectedPlatform={platform} onPlatformChange={handlePlatformChange} />
			</div>

			{#if platform === 'chess.com'}
				<div class="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
					<Label for="username">Chess.com Username</Label>
					<Input id="username" type="text" bind:value={username} placeholder="e.g. MagnusCarlsen" />
				</div>
			{:else}
				<div class="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
					<Label for="pgn">PGN Data</Label>
					<Textarea id="pgn" bind:value={pgnContent} placeholder="[Event &quot;...&quot;] ..." />
				</div>
			{/if}

			<Button class="w-full" onclick={handleFetch}
				>{platform === 'chess.com' ? 'Fetch Games' : 'Analyze PGN'}</Button
			>
		</Card.Content>
	</Card.Root>
</div>
