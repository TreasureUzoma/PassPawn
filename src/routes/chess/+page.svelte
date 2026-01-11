<script lang="ts">
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import Icon from '$lib/components/Icons.svelte';
	import { Chess } from 'chess.js';

	const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	const SCHOLARS_MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

	let game = new Chess(INITIAL_FEN);
	let orientation: 'white' | 'black' = 'white';
	let fen: string;

	// State for Pawn Promotion
	let showPromotionDialog = false;
	let promotionMove: { from: string; to: string } | null = null;
	const promotionPieces = ['q', 'r', 'b', 'n'];

	// This reactive block ensures `fen` is always derived from the `game` state
	$: fen = game.fen();

	// This reactive block ensures `fen` is always derived from the `game` state
	$: fen = game.fen();

	function toggleOrientation() {
		orientation = orientation === 'white' ? 'black' : 'white';
	}

	function resetBoard() {
		game = new Chess(INITIAL_FEN);
	}

	function setPuzzle() {
		// Create a new game instance to correctly update state and history
		game = new Chess(SCHOLARS_MATE_FEN);
	}

	function handleMove(event: CustomEvent<{ from: string; to: string; promotion?: string }>) {
		const { from, to } = event.detail;

		// Check if the move is a pawn promotion
		const moves = game.moves({ square: from as import('chess.js').Square, verbose: true });
		const move = moves.find((m) => (m as any).to === to) as any;

		if (move?.flags.includes('p')) {
			// It's a promotion, show the dialog
			promotionMove = { from, to };
			showPromotionDialog = true;
			return;
		}

		// It's a regular move
		game.move({ from, to });

		// Re-assign the game object to trigger all Svelte reactivity.
		// This updates the FEN and the undo button's disabled state.
		game = game;
	}

	function handlePromotion(piece: string) {
		if (promotionMove) {
			game.move({ ...promotionMove, promotion: piece });
		}
		showPromotionDialog = false;
		promotionMove = null;
		game = game; // Trigger reactivity
	}

	function undoMove() {
		if (game.history().length > 0) {
			game.undo();
			// Re-assign to trigger reactivity
			game = game;
		}
	}
</script>

<div class="w-full p-0 sm:p-8 py-8">
	<!-- Pawn Promotion Modal -->
	{#if showPromotionDialog}
		<div
			role="button"
			tabindex="-1"
			class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
			on:click={() => (showPromotionDialog = false)}
			on:keydown={(e) => e.key === 'Escape' && (showPromotionDialog = false)}
		>
			<div
				role="presentation"
				class="flex gap-2 rounded-lg border border-border bg-card p-4 shadow-2xl"
				on:click|stopPropagation
			>
				{#each promotionPieces as piece}
					<!-- svelte-ignore a11y-autofocus -->
					<button
						autofocus={piece === 'q'}
						on:click={() => handlePromotion(piece)}
						class="h-20 w-20 rounded-md bg-secondary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
					>
						<Icon
							name={{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[piece] || 'queen'}
							color={game.turn()}
							size="100%"
						/>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div
		class="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-start lg:justify-center"
	>
		<div class="flex w-full flex-col gap-4 lg:max-w-2xl">
			<div class="flex flex-col gap-2 mx-4 md:mx-0">
				<h1 class="text-3xl font-bold tracking-tight">Chess Board Component</h1>
				<p class="text-muted-foreground">
					A reusable, responsive chess board component built with Svelte and Tailwind CSS. Supports
					FEN strings and orientation flipping.
				</p>
			</div>

			<div class="flex justify-center bg-transparent w-full">
				<ChessBoard {fen} {orientation} on:move={handleMove} />
			</div>
		</div>
		<div class="flex w-full lg:max-w-2xl px-4 md:px-0 items-center">
			<div
				class="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-xl m-auto"
			>
				<h2 class="text-xl font-semibold">Controls</h2>

				<div class="space-y-4">
					<div class="flex flex-col gap-2">
						<label class="text-sm font-medium text-muted-foreground" for="fen">FEN String</label>
						<input
							id="fen"
							type="text"
							value={fen}
							on:change={(e) => {
								try {
									game = new Chess(e.currentTarget.value);
								} catch (err) {
									/* Ignore invalid FEN */
								}
							}}
							class="w-full rounded bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none ring-1 ring-border focus:ring-2 focus:ring-primary"
						/>
					</div>

					<div class="flex flex-col gap-2">
						<span class="text-sm font-medium text-muted-foreground">Actions</span>
						<div class="grid grid-cols-2 gap-2">
							<button
								on:click={toggleOrientation}
								class="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 active:opacity-90 transition-colors"
							>
								Flip Board
							</button>
							<button
								on:click={undoMove}
								disabled={game?.history().length === 0}
								class="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 active:opacity-90 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
							>
								Undo Move
							</button>
							<button
								on:click={resetBoard}
								class="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 active:opacity-90 transition-colors"
							>
								Reset
							</button>
						</div>
						<button
							on:click={setPuzzle}
							class="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:opacity-90 transition-colors"
						>
							Load "Scholar's Mate"
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
