<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser,
				retry: 2,
				staleTime: 60 * 60 * 1000
			}
		}
	});
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
<QueryClientProvider client={queryClient}>
	<main class="min-h-screen transition-colors duration-300">
		{@render children()}
	</main>
</QueryClientProvider>
