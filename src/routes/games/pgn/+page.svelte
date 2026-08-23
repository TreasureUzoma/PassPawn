<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Chess } from 'chess.js';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { analyzeGame, type GameReport, type MoveRating } from '$lib/utils/chess-analysis';
	import GameReportCard from '$lib/components/GameReportCard.svelte';
	import {
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight,
		ArrowUpDown,
		X,
		Zap,
		AlertCircle,
		CheckCircle2,
		Star,
		Ghost,
		Play,
		Trash2,
		BookOpen,
		Users,
		Trophy
	} from 'lucide-svelte';

	const game = new Chess();

	// Game State
	let history = $state<string[]>([]);
	let fens = $state<string[]>([]);
	let currentIndex = $state(0);
	let orientation = $state<'white' | 'black'>('white');
	let whiteName = $state('White');
	let blackName = $state('Black');

	// Analysis & Sandbox State
	let engineInfo = $state({ evaluation: 0, bestMove: '', pv: [] as string[] });
	let moveRatings = $state<(MoveRating | null)[]>([]);
	let sandboxActive = $state(false);
	let sandboxGame = $state(new Chess());
	let sandboxFen = $state('');
	let sandboxHistory = $state<string[]>([]);
	let showArrows = $state(true);
	let showMobileAnalysis = $state(false);

	// Full-game analysis state (runs once per loaded PGN, independent of navigation)
	let isAnalyzing = $state(false);
	let analysisDone = $state(0);
	let analysisTotal = $state(0);
	let analysisFailed = $state(false);
	let analysisRequestId = 0;
	let gameReport = $state<GameReport | null>(null);
	let accuracyByPly = $state<(number | null)[]>([]);

	// Reactive PGN derived from URL
	let pgnString = $derived(page.url.searchParams.get('pgn') || '');

	// Reactively load game when PGN changes
	$effect(() => {
		if (pgnString) {
			try {
				// Reset game
				game.loadPgn(pgnString);

				// Extract headers first to check for SetUp/FEN
				const headers = game.header();
				whiteName = headers['White'] || 'White';
				blackName = headers['Black'] || 'Black';

				// Rebuild history & fens
				const moves = game.history();
				// Use the starting FEN from headers if present, otherwise default
				const startFen =
					headers['SetUp'] === '1' && headers['FEN']
						? headers['FEN']
						: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

				const testGame = new Chess(startFen);
				const newFens = [testGame.fen()];

				for (const move of moves) {
					testGame.move(move);
					newFens.push(testGame.fen());
				}

				fens = newFens;
				history = moves;
				currentIndex = newFens.length - 1;
				moveRatings = new Array(newFens.length).fill(null);
				gameReport = null;
				accuracyByPly = new Array(newFens.length).fill(null);

				runAnalysis(newFens, moves);
			} catch (e) {
				console.error('Failed to parse PGN', e);
			}
		}
	});

	function runAnalysis(gameFens: string[], gameMoves: string[]) {
		const requestId = ++analysisRequestId;
		isAnalyzing = true;
		analysisFailed = false;
		analysisDone = 0;
		analysisTotal = gameFens.length;

		analyzeGame(gameFens, gameMoves, (done, total) => {
			if (requestId !== analysisRequestId) return;
			analysisDone = done;
			analysisTotal = total;
		})
			.then((result) => {
				if (requestId !== analysisRequestId) return;
				moveRatings = result.ratings;
				accuracyByPly = result.accuracyByPly;
				gameReport = result.report;
				isAnalyzing = false;
			})
			.catch((e) => {
				console.error('Game analysis failed', e);
				if (requestId !== analysisRequestId) return;
				isAnalyzing = false;
				analysisFailed = true;
			});
	}

	function goToMove(index: number) {
		if (index >= 0 && index < fens.length) {
			currentIndex = index;
			sandboxActive = false;
		}
	}

	function nextMove() {
		goToMove(currentIndex + 1);
	}

	function prevMove() {
		goToMove(currentIndex - 1);
	}

	function firstMove() {
		goToMove(0);
	}

	function lastMove() {
		goToMove(fens.length - 1);
	}

	function toggleOrientation() {
		orientation = orientation === 'white' ? 'black' : 'white';
	}

	function toggleArrows() {
		showArrows = !showArrows;
	}

	function handleEngineUpdate(
		event: CustomEvent<{ evaluation: number; bestMove: string; pv: string[] }>
	) {
		const { evaluation, bestMove, pv } = event.detail;
		engineInfo = {
			evaluation,
			bestMove: bestMove || engineInfo.bestMove,
			pv: pv.length > 0 ? pv : engineInfo.pv
		};
	}

	function enterSandbox() {
		sandboxActive = true;
		sandboxGame = new Chess(fens[currentIndex]);
		sandboxFen = sandboxGame.fen();
		sandboxHistory = [];
	}

	function exitSandbox() {
		sandboxActive = false;
	}

	function handleMove(event: CustomEvent<{ from: string; to: string; promotion?: string }>) {
		if (!sandboxActive) {
			enterSandbox();
		}

		try {
			const move = sandboxGame.move({
				from: event.detail.from,
				to: event.detail.to,
				promotion: event.detail.promotion || 'q'
			});

			if (move) {
				sandboxFen = sandboxGame.fen();
				sandboxHistory = [...sandboxHistory, move.san];
			}
		} catch (e) {
			console.error('Invalid sandbox move', e);
		}
	}

	function getRatingIcon(rating: string | null) {
		switch (rating) {
			case 'Brilliant':
				return { icon: Star, color: 'text-cyan-400' };
			case 'Great':
				return { icon: Zap, color: 'text-blue-400' };
			case 'Best':
				return { icon: CheckCircle2, color: 'text-green-500' };
			case 'Excellent':
				return { icon: CheckCircle2, color: 'text-green-400' };
			case 'Good':
				return { icon: CheckCircle2, color: 'text-green-300' };
			case 'Inaccuracy':
				return { icon: AlertCircle, color: 'text-yellow-500' };
			case 'Mistake':
				return { icon: AlertCircle, color: 'text-orange-500' };
			case 'Blunder':
				return { icon: AlertCircle, color: 'text-red-500' };
			case 'Book':
				return { icon: BookOpen, color: 'text-neutral-400' };
			default:
				return null;
		}
	}

	let movePairs = $derived(
		Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => [
			history[i * 2],
			history[i * 2 + 1]
		])
	);
</script>

<div
	class="min-h-screen lg:h-screen w-screen flex flex-col bg-[#161512] text-neutral-200 lg:overflow-hidden font-sans"
>
	<!-- Mobile Top Bar: title + way back out of the review -->
	<div
		class="lg:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-[#1e1c1a]"
	>
		<h1 class="text-xs font-black uppercase tracking-widest text-neutral-400">Game Review</h1>
		<button
			onclick={() => goto(resolve('/'))}
			aria-label="Close review"
			class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white"
		>
			<X class="h-4 w-4" />
		</button>
	</div>

	<!-- Main Area: Eval Bar | Board | Sidebar -->
	<div class="flex-1 flex overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4 justify-center">
		<!-- 2. Board Container (Maximized) -->
		<div
			class="flex-1 flex flex-col justify-center items-center overflow-y-auto lg:overflow-hidden min-w-0 gap-1 sm:gap-2 no-scrollbar"
		>
			<!-- Top Player Name -->
			<div
				class="w-full max-w-3xl lg:max-w-[calc(100vh-10rem)] mb-1 sm:mb-2 shrink-0 relative z-10 transition-all duration-300"
			>
				<div
					class="bg-[#262421] border border-neutral-800 rounded-md px-3 sm:px-4 py-1 sm:py-2 flex items-center justify-between shadow-xl"
				>
					<div class="flex items-center gap-2 overflow-hidden">
						<div
							class="h-6 w-6 sm:h-8 sm:w-8 rounded bg-neutral-700 flex items-center justify-center shrink-0"
						>
							<Users class="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
						</div>
						<span class="font-bold text-xs sm:text-base truncate text-white">
							{orientation === 'white' ? blackName : whiteName}
						</span>
					</div>
					<div class="text-[10px] font-mono text-neutral-500 bg-white/5 px-2 py-0.5 rounded">
						OPPONENT
					</div>
				</div>
			</div>

			<!-- Chess Board -->
			<div
				class="w-full max-w-3xl lg:max-w-[calc(100vh-10rem)] shrink-0 transition-all duration-300"
			>
				<ChessBoard
					fen={sandboxActive ? sandboxFen : fens[currentIndex]}
					{orientation}
					bestMoveUci={engineInfo.bestMove || null}
					showBestMoveArrow={showArrows}
					on:engine={handleEngineUpdate}
					on:move={handleMove}
				/>
			</div>

			<!-- Bottom Player Name -->
			<div
				class="w-full max-w-3xl lg:max-w-[calc(100vh-10rem)] mt-1 sm:mb-2 shrink-0 relative z-10 transition-all duration-300"
			>
				<div
					class="bg-[#262421] border border-neutral-800 rounded-md px-3 sm:px-4 py-1 sm:py-2 flex items-center justify-between shadow-xl"
				>
					<div class="flex items-center gap-2 overflow-hidden">
						<div
							class="h-6 w-6 sm:h-8 sm:w-8 rounded bg-primary/20 flex items-center justify-center shrink-0"
						>
							<Users class="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
						</div>
						<span class="font-bold text-xs sm:text-base truncate text-white">
							{orientation === 'white' ? whiteName : blackName}
						</span>
					</div>
					<div class="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
						YOU
					</div>
				</div>
			</div>
		</div>

		<!-- 3. Sidebar (Stats, Move List, Controls) -->
		<aside
			class="w-80 xl:w-[400px] shrink-0 flex flex-col gap-3 h-full overflow-hidden hidden lg:flex"
		>
			<!-- Simple Sidebar Header / Branding -->
			<div class="flex items-center justify-between px-2 shrink-0">
				<div class="flex items-center gap-2">
					<h2 class="font-bold tracking-tight text-sm uppercase opacity-60">Review</h2>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onclick={() => goto(resolve('/'))}
					class="h-8 text-xs text-neutral-400 hover:text-white">Close</Button
				>
			</div>

			<!-- Game Report: accuracy, estimated rating, per-move accuracy map -->
			<div class="shrink-0">
				<GameReportCard
					report={gameReport}
					{whiteName}
					{blackName}
					ratings={moveRatings}
					{accuracyByPly}
					{currentIndex}
					{isAnalyzing}
					onSelect={goToMove}
				/>
			</div>

			<!-- Analysis Summary & Ratings -->
			<div
				class="bg-[#262421] rounded-xl border border-neutral-800 shadow-xl overflow-hidden flex flex-col shrink-0"
			>
				<div class="p-3 border-b border-neutral-800 flex items-center justify-between bg-white/5">
					<h3 class="text-[10px] font-black uppercase tracking-widest text-neutral-400">
						Analysis
					</h3>
					{#if sandboxActive}
						<span
							class="text-[9px] font-bold text-orange-400 animate-pulse flex items-center gap-1"
						>
							<Ghost class="h-3 w-3" /> SANDBOX
						</span>
					{:else if isAnalyzing}
						<span class="text-[9px] font-bold text-primary flex items-center gap-1.5">
							<span
								class="h-2.5 w-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin"
							></span>
							Reviewing {analysisDone}/{analysisTotal}
						</span>
					{/if}
				</div>
				{#if isAnalyzing}
					<div class="h-1 w-full bg-white/5">
						<div
							class="h-full bg-primary transition-all duration-300"
							style="width: {analysisTotal ? (analysisDone / analysisTotal) * 100 : 0}%"
						></div>
					</div>
				{/if}
				<div class="p-4 space-y-4">
					{#if analysisFailed}
						<div
							class="flex items-center gap-2 text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-lg px-3 py-2"
						>
							<AlertCircle class="h-3.5 w-3.5 shrink-0" />
							Game review failed to complete. Move ratings may be incomplete.
						</div>
					{/if}
					{#if engineInfo.bestMove}
						<div class="flex items-center gap-4">
							<div class="flex flex-col">
								<span class="text-[9px] uppercase font-black text-neutral-500 mb-1 leading-none"
									>Best Move</span
								>
								<div
									class="bg-primary text-primary-foreground px-3 py-1.5 rounded font-black font-mono text-sm shadow-lg shadow-primary/20"
								>
									{engineInfo.bestMove}
								</div>
							</div>
							<div class="flex-1 overflow-x-auto custom-scrollbar whitespace-nowrap pb-2">
								<div class="flex gap-1.5">
									{#each engineInfo.pv.slice(0, 5) as move, i (i)}
										<span
											class="text-[10px] font-mono bg-white/5 px-2 py-1 rounded border border-white/10"
											>{move}</span
										>
									{/each}
									<span class="text-[10px] text-neutral-600 self-center">...</span>
								</div>
							</div>
						</div>
					{:else}
						<div class="flex items-center gap-3 py-2">
							<div
								class="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
							></div>
							<span class="text-xs font-bold text-neutral-500 italic">Thinking...</span>
						</div>
					{/if}

					{#if !sandboxActive && moveRatings[currentIndex]}
						{@const rating = moveRatings[currentIndex]}
						{@const cfg = getRatingIcon(rating)}
						<div
							class="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5 animate-in slide-in-from-right-4"
						>
							{#if cfg}
								<cfg.icon class="h-6 w-6 {cfg.color} drop-shadow-[0_0_8px_currentColor]" />
								<div>
									<p class="text-[10px] font-black uppercase {cfg.color} leading-none">{rating}</p>
									<p class="text-[9px] text-neutral-500 font-bold mt-1">Move {currentIndex}</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Move List Section -->
			<div
				class="flex-1 bg-[#262421] rounded-xl border border-neutral-800 shadow-xl flex flex-col overflow-hidden min-h-0"
			>
				<div
					class="p-3 bg-white/5 border-b border-neutral-800 flex items-center justify-between shrink-0"
				>
					<h3 class="text-[10px] font-black uppercase tracking-widest text-neutral-400">
						Move List
					</h3>
					<span class="text-[10px] font-mono text-neutral-500">{history.length} moves</span>
				</div>
				<div class="flex-1 overflow-y-auto custom-scrollbar p-1.5 bg-[#1e1c1a]">
					<div class="grid grid-cols-12 gap-0.5">
						{#each movePairs as pair, i (i)}
							{@const idx1 = i * 2 + 1}
							{@const idx2 = (i + 1) * 2}
							<div
								class="col-span-2 py-1 text-[10px] text-neutral-600 font-mono text-center self-center"
							>
								{i + 1}.
							</div>
							<button
								onclick={() => goToMove(idx1)}
								class="col-span-5 text-left px-3 py-2 text-xs font-bold transition-all rounded-sm flex items-center justify-between {currentIndex ===
									idx1 && !sandboxActive
									? 'bg-primary text-primary-foreground font-bold shadow-[0_0_10px_rgba(var(--primary),0.3)] shadow-inner'
									: 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}"
							>
								{pair[0]}
								{#if moveRatings[idx1]}
									{@const cfg = getRatingIcon(moveRatings[idx1])}
									{#if cfg}
										<cfg.icon
											class="h-3 w-3 {currentIndex === idx1
												? 'text-primary-foreground'
												: cfg.color}"
										/>
									{/if}
								{/if}
							</button>
							{#if pair[1]}
								<button
									onclick={() => goToMove(idx2)}
									class="col-span-5 text-left px-3 py-2 text-xs font-bold transition-all rounded-sm flex items-center justify-between {currentIndex ===
										idx2 && !sandboxActive
										? 'bg-primary text-primary-foreground font-bold shadow-[0_0_10px_rgba(var(--primary),0.3)] shadow-inner'
										: 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}"
								>
									{pair[1]}
									{#if moveRatings[idx2]}
										{@const cfg = getRatingIcon(moveRatings[idx2])}
										{#if cfg}
											<cfg.icon
												class="h-3 w-3 {currentIndex === idx2
													? 'text-primary-foreground'
													: cfg.color}"
											/>
										{/if}
									{/if}
								</button>
							{:else}
								<div class="col-span-5"></div>
							{/if}
						{/each}
					</div>

					{#if sandboxActive}
						<div class="mt-4 border-t border-dashed border-white/10 pt-4 px-2 pb-4">
							<div
								class="text-[9px] font-black uppercase text-orange-400 flex items-center gap-2 mb-3 tracking-tighter"
							>
								<Ghost class="h-3.5 w-3.5" /> Variation Tree
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each sandboxHistory as move, i (i)}
									<span
										class="px-2 py-1 bg-orange-400/10 text-orange-400 rounded-sm text-[10px] font-black font-mono border border-orange-400/20"
										>{move}</span
									>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Sidebar Footer: Controls -->
				<div class="bg-[#21201d] border-t border-neutral-800 p-4 shrink-0 space-y-4">
					<!-- Primary Playback -->
					<div class="flex items-center justify-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onclick={firstMove}
							disabled={currentIndex === 0 || sandboxActive}
							class="h-10 w-10 text-neutral-400 hover:text-white hover:bg-white/10"
						>
							<ChevronsLeft class="h-6 w-6" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onclick={prevMove}
							disabled={currentIndex === 0 || sandboxActive}
							class="h-10 w-10 text-neutral-400 hover:text-white hover:bg-white/10"
						>
							<ChevronLeft class="h-6 w-6" />
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onclick={nextMove}
							disabled={currentIndex === fens.length - 1 || sandboxActive}
							class="h-10 w-10 text-neutral-400 hover:text-white hover:bg-white/10"
						>
							<ChevronRight class="h-6 w-6" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onclick={lastMove}
							disabled={currentIndex === fens.length - 1 || sandboxActive}
							class="h-10 w-10 text-neutral-400 hover:text-white hover:bg-white/10"
						>
							<ChevronsRight class="h-6 w-6" />
						</Button>
					</div>

					<!-- Secondary Layer: Utility -->
					<div class="space-y-2">
						<div class="grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={toggleOrientation}
								class="h-9 text-[10px] font-black uppercase tracking-tight border-neutral-800"
							>
								<ArrowUpDown class="mr-2 h-3.5 w-3.5" /> Flip Board
							</Button>
							<Button
								variant={showArrows ? 'default' : 'outline'}
								size="sm"
								onclick={toggleArrows}
								class="h-9 text-[10px] font-black uppercase tracking-tight border-neutral-800"
							>
								<Zap class="mr-2 h-3.5 w-3.5 {showArrows ? 'fill-current' : ''}" />
								{showArrows ? 'Hide' : 'Show'} Arrows
							</Button>
						</div>
						{#if sandboxActive}
							<Button
								variant="destructive"
								size="sm"
								onclick={exitSandbox}
								class="w-full h-9 text-[10px] font-black uppercase tracking-tight"
							>
								<Trash2 class="mr-2 h-3.5 w-3.5" /> Exit Sandbox
							</Button>
						{:else}
							<Button
								variant="outline"
								size="sm"
								onclick={enterSandbox}
								class="w-full h-9 text-[10px] font-black uppercase tracking-tight border-neutral-800 hover:bg-white/5"
							>
								<Play class="mr-2 h-3.5 w-3.5" /> Try Moves
							</Button>
						{/if}
					</div>
				</div>
			</div>
		</aside>
	</div>

	<div
		class="lg:hidden h-20 shrink-0 bg-[#262421] border-t border-neutral-800 flex flex-col items-center justify-center px-4 gap-2 relative z-50"
	>
		<div class="flex items-center justify-between w-full max-w-sm gap-2">
			<div class="flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon"
					onclick={firstMove}
					disabled={currentIndex === 0 || sandboxActive}
					class="h-10 w-8 text-neutral-500 hover:text-white"
				>
					<ChevronsLeft class="h-5 w-5" />
				</Button>

				<Button
					variant="ghost"
					size="icon"
					onclick={prevMove}
					disabled={currentIndex === 0 || sandboxActive}
					class="h-10 w-10 text-neutral-400"
				>
					<ChevronLeft class="h-6 w-6" />
				</Button>
			</div>

			<button
				onclick={() => (showMobileAnalysis = !showMobileAnalysis)}
				class="flex flex-col items-center min-w-[100px] border border-white/5 bg-white/5 py-1 px-2 rounded-lg active:scale-95 transition-transform"
			>
				<div
					class="px-3 py-0.5 bg-white/10 rounded font-black text-[10px] text-neutral-400 uppercase tracking-tighter mb-1"
				>
					Move {currentIndex}
				</div>
				{#if !sandboxActive && moveRatings[currentIndex]}
					{@const rating = moveRatings[currentIndex]}
					{@const cfg = getRatingIcon(rating)}
					{#if cfg}
						<div class="flex items-center gap-1.5 animate-in zoom-in-50 duration-300">
							<cfg.icon class="h-4 w-4 {cfg.color} drop-shadow-[0_0_5px_currentColor]" />
							<span class="text-xs font-black uppercase {cfg.color} tracking-tight">{rating}</span>
						</div>
					{/if}
				{:else if sandboxActive}
					<div class="flex items-center gap-1.5 text-orange-400">
						<Ghost class="h-4 w-4" />
						<span class="text-xs font-black uppercase tracking-tight">Sandbox</span>
					</div>
				{:else if isAnalyzing}
					<div class="flex items-center gap-1.5 text-primary">
						<span
							class="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin"
						></span>
						<span class="text-xs font-black uppercase tracking-tight"
							>Reviewing {analysisDone}/{analysisTotal}</span
						>
					</div>
				{:else}
					<div class="text-[10px] font-bold text-neutral-600 uppercase">Analysis & Sandbox</div>
				{/if}
			</button>

			<div class="flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon"
					onclick={nextMove}
					disabled={currentIndex === fens.length - 1 || sandboxActive}
					class="h-10 w-10 text-neutral-400"
				>
					<ChevronRight class="h-6 w-6" />
				</Button>

				<Button
					variant="ghost"
					size="icon"
					onclick={lastMove}
					disabled={currentIndex === fens.length - 1 || sandboxActive}
					class="h-10 w-8 text-neutral-500 hover:text-white"
				>
					<ChevronsRight class="h-5 w-5" />
				</Button>
			</div>
		</div>
	</div>
</div>

{#if showMobileAnalysis}
	<!-- Mobile Analysis Overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="lg:hidden fixed inset-0 z-[100] bg-black/80 backdrop-blur-md animate-in fade-in duration-300 flex flex-col pt-12"
		onclick={() => (showMobileAnalysis = false)}
	>
		<div
			class="flex-1 bg-[#1e1c1a] border-t border-neutral-800 rounded-t-3xl p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-10 duration-500"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center justify-between shrink-0">
				<h2 class="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
					<Trophy class="h-5 w-5 text-yellow-500" />
					Game Review
				</h2>
				<button
					onclick={() => (showMobileAnalysis = false)}
					aria-label="Close"
					class="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Game Report: accuracy, estimated rating, per-move accuracy map -->
			<div class="shrink-0">
				<GameReportCard
					report={gameReport}
					{whiteName}
					{blackName}
					ratings={moveRatings}
					{accuracyByPly}
					{currentIndex}
					{isAnalyzing}
					onSelect={(i) => {
						goToMove(i);
						showMobileAnalysis = false;
					}}
				/>
			</div>

			<!-- Analysis Card -->
			<div class="bg-[#262421] border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<span
						class="text-[10px] font-black uppercase text-neutral-500 tracking-widest leading-none"
						>Best Move</span
					>
					{#if sandboxActive}
						<span
							class="text-[9px] font-bold text-orange-400 animate-pulse flex items-center gap-1"
						>
							<Ghost class="h-3 w-3" /> SANDBOX
						</span>
					{:else if isAnalyzing}
						<span class="text-[9px] font-bold text-primary flex items-center gap-1.5">
							<span
								class="h-2.5 w-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin"
							></span>
							Reviewing {analysisDone}/{analysisTotal}
						</span>
					{/if}
				</div>
				{#if isAnalyzing}
					<div class="h-1 w-full bg-white/5 rounded-full overflow-hidden -mt-2">
						<div
							class="h-full bg-primary transition-all duration-300"
							style="width: {analysisTotal ? (analysisDone / analysisTotal) * 100 : 0}%"
						></div>
					</div>
				{/if}

				<div class="flex items-center gap-4">
					{#if engineInfo.bestMove}
						<div
							class="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-black font-mono text-lg shadow-xl shadow-primary/20"
						>
							{engineInfo.bestMove}
						</div>
						<div class="flex-1 flex gap-1.5 overflow-x-auto custom-scrollbar pb-2">
							{#each engineInfo.pv.slice(0, 3) as move, i (i)}
								<span
									class="text-xs font-mono bg-white/5 px-2.5 py-1.5 rounded-md border border-white/10 whitespace-nowrap"
									>{move}</span
								>
							{/each}
						</div>
					{:else}
						<div class="flex items-center gap-3">
							<div
								class="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
							></div>
							<span class="text-xs font-bold text-neutral-500">Stockfish thinking...</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Move List -->
			<div class="shrink-0 border border-neutral-800 bg-[#161512] rounded-2xl overflow-hidden flex flex-col">
				<div
					class="bg-white/5 px-4 py-3 border-b border-neutral-800 flex items-center justify-between"
				>
					<h3 class="text-xs font-black uppercase text-neutral-400">Move List</h3>
					<span class="text-[10px] font-mono text-neutral-600">{history.length} moves</span>
				</div>
				<div class="p-2">
					<div class="grid grid-cols-12 gap-1">
						{#each movePairs as pair, i (i)}
							{@const idx1 = i * 2 + 1}
							{@const idx2 = (i + 1) * 2}
							<div
								class="col-span-2 py-2 text-[10px] text-neutral-700 font-mono text-center self-center"
							>
								{i + 1}.
							</div>
							<button
								onclick={() => {
									goToMove(idx1);
									showMobileAnalysis = false;
								}}
								class="col-span-5 px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-1 {currentIndex ===
									idx1 && !sandboxActive
									? 'bg-primary text-primary-foreground shadow-lg'
									: 'text-neutral-400 hover:bg-white/5'}"
							>
								{pair[0]}
								{#if moveRatings[idx1]}
									{@const cfg = getRatingIcon(moveRatings[idx1])}
									{#if cfg}
										<cfg.icon
											class="h-3.5 w-3.5 shrink-0 {currentIndex === idx1
												? 'text-primary-foreground'
												: cfg.color}"
										/>
									{/if}
								{/if}
							</button>
							{#if pair[1]}
								<button
									onclick={() => {
										goToMove(idx2);
										showMobileAnalysis = false;
									}}
									class="col-span-5 px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-1 {currentIndex ===
										idx2 && !sandboxActive
										? 'bg-primary text-primary-foreground shadow-lg'
										: 'text-neutral-400 hover:bg-white/5'}"
								>
									{pair[1]}
									{#if moveRatings[idx2]}
										{@const cfg = getRatingIcon(moveRatings[idx2])}
										{#if cfg}
											<cfg.icon
												class="h-3.5 w-3.5 shrink-0 {currentIndex === idx2
													? 'text-primary-foreground'
													: cfg.color}"
											/>
										{/if}
									{/if}
								</button>
							{:else}
								<div class="col-span-5"></div>
							{/if}
						{/each}
					</div>

					{#if sandboxActive}
						<div class="mt-2 border-t border-dashed border-white/10 pt-3 px-3 pb-3">
							<div
								class="text-[9px] font-black uppercase text-orange-400 flex items-center gap-2 mb-2 tracking-tighter"
							>
								<Ghost class="h-3.5 w-3.5" /> Variation Tree
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each sandboxHistory as move, i (i)}
									<span
										class="px-2 py-1 bg-orange-400/10 text-orange-400 rounded-sm text-[10px] font-black font-mono border border-orange-400/20"
										>{move}</span
									>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="grid grid-cols-2 gap-3 pb-8">
				<Button
					variant="outline"
					class="h-12 border-neutral-800 text-xs font-black uppercase"
					onclick={() => {
						toggleOrientation();
						showMobileAnalysis = false;
					}}
				>
					<ArrowUpDown class="mr-2 h-4 w-4" /> Flip Board
				</Button>
				<Button
					variant={showArrows ? 'default' : 'outline'}
					class="h-12 border-neutral-800 text-xs font-black uppercase"
					onclick={() => toggleArrows()}
				>
					<Zap class="mr-2 h-4 w-4 {showArrows ? 'fill-current' : ''}" />
					{showArrows ? 'Hide' : 'Show'} Arrows
				</Button>

				{#if sandboxActive}
					<Button
						variant="destructive"
						class="col-span-2 h-12 text-xs font-black uppercase tracking-tight"
						onclick={() => {
							exitSandbox();
							showMobileAnalysis = false;
						}}
					>
						<Trash2 class="mr-2 h-4 w-4" /> Exit Sandbox
					</Button>
				{:else}
					<Button
						variant="outline"
						class="col-span-2 h-12 border-neutral-800 text-xs font-black uppercase tracking-tight hover:bg-white/5"
						onclick={() => {
							enterSandbox();
							showMobileAnalysis = false;
						}}
					>
						<Play class="mr-2 h-4 w-4" /> Try Moves (Sandbox)
					</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
		height: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: hsl(var(--muted));
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.5);
	}

	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
