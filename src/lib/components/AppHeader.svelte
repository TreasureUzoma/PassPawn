<script lang="ts">
	import { resolve } from '$app/paths';
	import { Crown } from 'lucide-svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let { children }: { children?: import('svelte').Snippet } = $props();
</script>

<header
	class="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
>
	<div class="container mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
		<a href={resolve('/')} class="flex items-center shrink-0 group">
			<span class="flex h-7 w-7 items-center justify-center">
				<Crown class="h-4 w-4" />
			</span>
			<span class="text-sm font-black tracking-tight">
				Passed<span class="text-muted-foreground font-bold">Pawn</span>
			</span>
		</a>

		<div class="flex min-w-0 flex-1 items-center justify-end gap-2">
			{@render children?.()}
			<ThemeToggle />
		</div>
	</div>
</header>
