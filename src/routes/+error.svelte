<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Ghost, Home } from 'lucide-svelte';

	const status = page.status;
	const error = page.error;

	function title() {
		if (status === 404) return 'Page not found';
		if (status === 400) return 'Bad request';
		if (status >= 500) return 'Something went wrong';
		return `Error ${status}`;
	}
</script>

<svelte:head>
	<title>
		{status === 404 ? '404 - Page Not Found' : `${status} - Error`}
	</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="min-h-screen flex-center flex-col gap-4 p-6 text-center">
	<div
		class="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground"
	>
		<Ghost class="h-8 w-8" />
	</div>
	<div class="space-y-1.5">
		<p class="text-sm font-mono font-bold text-muted-foreground">{status}</p>
		<h1 class="text-2xl font-black tracking-tight">{title()}</h1>
		{#if error?.message}
			<p class="max-w-sm text-sm text-muted-foreground">{error.message}</p>
		{/if}
	</div>
	<Button href="/" class="mt-2">
		<Home class="mr-2 h-4 w-4" />
		Go home
	</Button>
</main>
