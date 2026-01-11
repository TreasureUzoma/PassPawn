<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { Trophy } from 'lucide-svelte';
	import { Handshake } from 'lucide-svelte';
	import { Chess } from 'chess.js';
	import type { Square, Move } from 'chess.js';
	import Icon from './Icons.svelte';
	import EvalBar from './EvalBar.svelte';

	export let fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	export let orientation: 'white' | 'black' = 'white';

	const dispatch = createEventDispatcher<{
		move: { from: Square; to: Square; promotion?: string };
		engine: { evaluation: number; bestMove: string; pv: string[] };
	}>();

	let chess = new Chess(fen);
	let board = chess.board();
	let isCheckmate = false;
	let isDraw = false;
	let isCheck = false;
	let turn = 'w';
	let winner: 'White' | 'Black' | null = null;
	let kingSquare: Square | null = null;
	let evaluation = 0;

	$: {
		if (fen !== chess.fen()) {
			try {
				chess.load(fen);
				updateGameState();
			} catch (e) {
				console.error('Invalid FEN', e);
			}
		}
	}

	let stockfish: Worker | null = null;

	onMount(() => {
		updateGameState();

		try {
			stockfish = new Worker('/stockfish.js');

			stockfish.onmessage = (event) => {
				const line = event.data;
				if (typeof line !== 'string') return;

				if (line.startsWith('bestmove')) {
					const match = line.match(/bestmove\s+(\S+)/);
					if (match) {
						dispatch('engine', { evaluation, bestMove: match[1], pv: [] });
					}
				}

				if (line.startsWith('info') && (line.includes('score cp') || line.includes('score mate'))) {
					const scoreCpMatch = line.match(/score cp (-?\d+)/);
					const scoreMateMatch = line.match(/score mate (-?\d+)/);
					const pvMatch = line.match(/pv\s+(.*)/);

					let currentEval = evaluation;
					let currentPv: string[] = [];

					if (scoreCpMatch) {
						let cp = parseInt(scoreCpMatch[1], 10);
						if (turn === 'b') cp = -cp;
						currentEval = cp / 100;
					} else if (scoreMateMatch) {
						const mateIn = parseInt(scoreMateMatch[1], 10);
						let mateScore = mateIn;
						if (turn === 'b') mateScore = -mateScore;
						currentEval = mateScore > 0 ? Infinity : -Infinity;
					}

					if (pvMatch) {
						currentPv = pvMatch[1].split(' ').slice(0, 5);
					}

					evaluation = currentEval;
					dispatch('engine', { evaluation, bestMove: '', pv: currentPv });
				}
			};

			stockfish.postMessage('uci');
			stockfish.postMessage('isready');
			// stockfish.postMessage('ucinewgame'); // Doing this on load might reset generic engine state?
		} catch (e) {
			console.error('Stockfish init failed', e);
			// Fallback
			evaluation = getMaterialEvaluation();
		}
	});

	onDestroy(() => {
		stockfish?.terminate();
	});

	$: rows = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
	$: cols = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

	// Interaction State
	let selectedSquare: Square | null = null;
	let draggedPiece: {
		row: number;
		col: number;
		square: Square;
		type: string;
		color: 'w' | 'b';
		x: number;
		y: number;
	} | null = null;

	let possibleMoves: string[] = [];
	let capturedPieces: { w: string[]; b: string[] } = { w: [], b: [] };

	let boardElement: HTMLElement;

	function updateGameState() {
		board = chess.board();
		capturedPieces = getCapturedPieces();
		isCheckmate = chess.isCheckmate();
		isCheck = chess.inCheck();
		isDraw = chess.isDraw();
		turn = chess.turn(); // 'w' or 'b'

		// Find King of current turn if in check
		kingSquare = null;
		if (isCheck || isCheckmate) {
			let found = false;
			for (let r = 0; r < 8; r++) {
				for (let c = 0; c < 8; c++) {
					const p = board[r][c];
					if (p && p.type === 'k' && p.color === turn) {
						kingSquare = getSquare(r, c);
						found = true;
						break;
					}
				}
				if (found) break;
			}
		}

		if (isCheckmate) {
			winner = turn === 'w' ? 'Black' : 'White';
		} else {
			winner = null;
		}

		// Update Stockfish
		if (stockfish) {
			stockfish.postMessage(`position fen ${chess.fen()}`);
			stockfish.postMessage('go depth 15');
		} else {
			evaluation = getMaterialEvaluation();
		}
	}

	function getPieceColorClasses(color: string) {
		return '';
	}

	function getCapturedPieces() {
		const history = chess.history({ verbose: true });
		const captured = { w: [] as string[], b: [] as string[] };

		for (const move of history) {
			if (move.captured) {
				const capturedColor = move.color === 'w' ? 'b' : 'w';
				captured[capturedColor].push(move.captured);
			}
		}

		const order = ['p', 'n', 'b', 'r', 'q'];
		captured.w.sort((a, b) => order.indexOf(a) - order.indexOf(b));
		captured.b.sort((a, b) => order.indexOf(a) - order.indexOf(b));

		return captured;
	}

	function handleMouseDown(
		e: MouseEvent,
		row: number,
		col: number,
		piece: { type: string; color: 'w' | 'b' } | null
	) {
		if (isCheckmate) return;

		const clickedSquare = getSquare(row, col);

		// Case 1: Clicking a valid move target (Tap-to-Move)
		if (selectedSquare && possibleMoves.includes(clickedSquare)) {
			makeMove(selectedSquare, clickedSquare);
			return;
		}

		// Case 2: Selecting a piece
		if (!piece || chess.turn() !== piece.color) {
			// Clicked empty or opponent piece without a valid capture move selected -> Deselect
			selectedSquare = null;
			possibleMoves = [];
			return;
		}

		e.preventDefault();

		// Select the piece
		selectedSquare = clickedSquare;
		const moves = chess.moves({ square: clickedSquare, verbose: true });
		possibleMoves = moves.map((m) => m.to);

		// Start Dragging
		draggedPiece = {
			row,
			col,
			square: clickedSquare,
			type: piece.type,
			color: piece.color,
			x: e.clientX,
			y: e.clientY
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!draggedPiece) return;
		draggedPiece = { ...draggedPiece, x: e.clientX, y: e.clientY };
	}

	function handleMouseUp(e: MouseEvent) {
		if (!draggedPiece) {
			return;
		}

		if (boardElement) {
			const boardRect = boardElement.getBoundingClientRect();
			const squareSize = boardRect.width / 8;

			const relativeX = e.clientX - boardRect.left;
			const relativeY = e.clientY - boardRect.top;

			if (
				relativeX >= 0 &&
				relativeX <= boardRect.width &&
				relativeY >= 0 &&
				relativeY <= boardRect.height
			) {
				const targetColIdx = Math.floor(relativeX / squareSize);
				const targetRowIdx = Math.floor(relativeY / squareSize);

				const actualRow = orientation === 'white' ? targetRowIdx : 7 - targetRowIdx;
				const actualCol = orientation === 'white' ? targetColIdx : 7 - targetColIdx;

				const targetSquare = getSquare(actualRow, actualCol);

				// If dropped on a different square, try to move
				if (targetSquare !== draggedPiece.square) {
					makeMove(draggedPiece.square, targetSquare);
				} else {
					// Dropped on same square (Click/Tap)
					// Keep selection active, do not clear possibleMoves
					stopDragOnly();
					return;
				}
			}
		}

		stopDragOnly();
	}

	function makeMove(from: Square, to: Square) {
		// Dispatch the move event to the parent component.
		// The parent will handle the game logic and pawn promotion.
		dispatch('move', { from, to });

		// Clear local UI state after attempting a move.
		selectedSquare = null;
		possibleMoves = [];

		stopDragOnly();
	}

	function stopDragOnly() {
		draggedPiece = null;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function getSquare(row: number, col: number): Square {
		const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
		return `${files[col]}${ranks[row]}` as Square;
	}

	function getPieceName(char: string) {
		const names: Record<string, string> = {
			p: 'pawn',
			n: 'knight',
			b: 'bishop',
			r: 'rook',
			q: 'queen',
			k: 'king'
		};
		return names[char.toLowerCase()];
	}

	// Fallback Material Evaluation
	function getMaterialEvaluation() {
		if (isCheckmate) {
			return turn === 'w' ? -Infinity : Infinity;
		}

		const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
		let score = 0;

		const currentBoard = chess.board();
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				const p = currentBoard[r][c];
				if (p) {
					const val = values[p.type] || 0;
					score += p.color === 'w' ? val : -val;
				}
			}
		}
		return score;
	}

	function getSquareCoords(square: string) {
		const file = square.charCodeAt(0) - 97; // a-h
		const rank = 8 - parseInt(square[1]); // 1-8

		const actualFile = orientation === 'white' ? file : 7 - file;
		const actualRank = orientation === 'white' ? rank : 7 - rank;

		return {
			x: actualFile + 0.5,
			y: actualRank + 0.5
		};
	}
</script>

<div
	class="flex gap-2 sm:gap-4 items-stretch justify-center w-full max-w-full sm:max-w-3xl flex-col sm:flex-row"
>
	<!-- Eval Bar (Desktop) -->
	<div class="h-auto w-8 py-8 hidden sm:block">
		<EvalBar {evaluation} orientation="vertical" />
	</div>

	<div class="flex flex-col gap-2 sm:gap-4 w-full max-w-full sm:max-w-2xl">
		<!-- Eval Bar (Mobile) -->
		<div class="w-full h-6 block sm:hidden">
			<EvalBar {evaluation} orientation="horizontal" />
		</div>

		<!-- Captured Pieces (Top - Opponent) -->
		<div
			class="flex h-10 w-full items-center gap-1.5 rounded-lg bg-neutral-900/50 border border-white/5 px-3 min-h-[40px] shadow-inner"
		>
			{#each orientation === 'white' ? capturedPieces.w : capturedPieces.b as piece}
				<div class="relative h-7 w-7 transition-transform hover:scale-110">
					<Icon
						name={getPieceName(piece)}
						color={orientation === 'white' ? 'w' : 'b'}
						size="100%"
						class="drop-shadow-sm filter brightness-110"
					/>
				</div>
			{/each}
		</div>

		<div
			bind:this={boardElement}
			class="aspect-square w-full select-none rounded-lg shadow-2xl relative overflow-hidden ring-4 ring-border"
		>
			<div class="grid h-full w-full grid-cols-8 grid-rows-8">
				{#each rows as row}
					{#each cols as col}
						{@const isDark = (row + col) % 2 === 1}
						{@const square = getSquare(row, col)}
						{@const piece = board[row][col]}

						{@const isBeingDragged = draggedPiece?.row === row && draggedPiece?.col === col}
						{@const isPossibleMove = possibleMoves.includes(square)}
						{@const isCaptureMove = isPossibleMove && piece !== null}
						{@const isKingInDanger = square === kingSquare}
						{@const isSelected = square === selectedSquare}

						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="relative flex items-center justify-center transition-all duration-200
                            {isDark ? 'bg-[#769656] text-[#eeeed2]' : 'bg-[#eeeed2] text-[#769656]'}
                            {isSelected ? 'bg-yellow-200/50 ring-inset ring-4 ring-yellow-400' : ''}
                            {isKingInDanger ? 'ring-inset ring-4 ring-red-500 bg-red-400/50' : ''}
                            "
							data-square={square}
							onmousedown={(e) => handleMouseDown(e, row, col, piece)}
						>
							<!-- Coordinate labels -->
							{#if col === (orientation === 'white' ? 0 : 7)}
								<span class="absolute top-0.5 left-1 text-[0.65rem] font-bold opacity-80">
									{8 - row}
								</span>
							{/if}
							{#if row === (orientation === 'white' ? 7 : 0)}
								<span class="absolute bottom-0 right-1 text-[0.65rem] font-bold opacity-80">
									{String.fromCharCode(97 + col)}
								</span>
							{/if}

							<!-- Piece -->
							{#if piece && !isBeingDragged}
								<div
									class="h-[80%] w-[80%] cursor-grab active:cursor-grabbing {isCaptureMove
										? 'opacity-80'
										: ''} z-10"
								>
									<Icon
										name={getPieceName(piece.type)}
										color={piece.color}
										size="107%"
										class="drop-shadow-lg filter"
									/>
								</div>
							{/if}

							<!-- Possible Move Indicators -->
							{#if isPossibleMove}
								{#if isCaptureMove}
									<!-- Corner indicators for capture -->
									<div class="absolute inset-0 z-0">
										<div
											class="absolute top-0 left-0 w-3 h-3 border-t-4 border-l-4 border-black/20 rounded-tl-sm"
										></div>
										<div
											class="absolute top-0 right-0 w-3 h-3 border-t-4 border-r-4 border-black/20 rounded-tr-sm"
										></div>
										<div
											class="absolute bottom-0 left-0 w-3 h-3 border-b-4 border-l-4 border-black/20 rounded-bl-sm"
										></div>
										<div
											class="absolute bottom-0 right-0 w-3 h-3 border-b-4 border-r-4 border-black/20 rounded-br-sm"
										></div>
									</div>
								{:else}
									<!-- Soft Dot -->
									<div
										class="absolute h-3.5 w-3.5 md:h-4 md:w-4 rounded-full bg-black/15 pointer-events-none"
									></div>
								{/if}
							{/if}
						</div>
					{/each}
				{/each}
			</div>

			<!-- Checkmate Overlay -->
			{#if isCheckmate && winner}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500 cursor-pointer"
					onclick={() => {
						isCheckmate = false;
						winner = null;
					}}
				>
					<div
						class="flex flex-col items-center gap-2 p-6 rounded-xl bg-card border border-border shadow-2xl text-center"
					>
						<Trophy class="w-16 h-16 text-yellow-500 mb-2" strokeWidth={1.5} />
						<h2 class="text-3xl font-black text-foreground tracking-tight">Checkmate!</h2>
						<p class="text-lg font-medium text-muted-foreground">
							<span class={winner === 'White' ? 'text-foreground' : 'text-muted-foreground'}
								>{winner}</span
							> wins
						</p>
						<p class="text-xs text-muted-foreground mt-2">Click to dismiss</p>
					</div>
				</div>
			{/if}

			<!-- Draw Overlay -->
			{#if isDraw}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500 cursor-pointer"
					onclick={() => {
						isDraw = false;
					}}
				>
					<div
						class="flex flex-col items-center gap-2 p-6 rounded-xl bg-card border border-border shadow-2xl text-center"
					>
						<Handshake class="w-16 h-16 text-yellow-500 mb-1" strokeWidth={1.5} />
						<h2 class="text-3xl font-black text-foreground tracking-tight">Draw!</h2>
						<p class="text-lg font-medium text-muted-foreground">The game is a draw.</p>
						<p class="text-xs text-muted-foreground mt-2">Click to dismiss</p>
					</div>
				</div>
			{/if}

			<!-- Dragged Piece Floating Layer -->
			{#if draggedPiece}
				<div
					class="fixed z-50 pointer-events-none h-16 w-16"
					style="left: {draggedPiece.x}px; top: {draggedPiece.y}px; transform: translate(-50%, -50%);"
				>
					<Icon
						name={getPieceName(draggedPiece.type)}
						color={draggedPiece.color}
						size="100%"
						class="drop-shadow-2xl filter"
					/>
				</div>
			{/if}
		</div>

		<!-- Captured Pieces (Bottom - Me) -->
		<div
			class="flex h-10 w-full items-center gap-1.5 rounded-lg bg-neutral-900/50 border border-white/5 px-3 min-h-[40px] shadow-inner"
		>
			{#each orientation === 'white' ? capturedPieces.b : capturedPieces.w as piece}
				<div class="relative h-7 w-7 transition-transform hover:scale-110">
					<Icon
						name={getPieceName(piece)}
						color={orientation === 'white' ? 'b' : 'w'}
						size="100%"
						class="drop-shadow-sm filter brightness-110"
					/>
				</div>
			{/each}
		</div>
	</div>
</div>
