<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	import { Trophy } from 'lucide-svelte';
	import { Handshake } from 'lucide-svelte';
	import { Chess } from 'chess.js';
	import type { Square } from 'chess.js';
	import Icon from './Icons.svelte';
	import EvalBar from './EvalBar.svelte';

	export let fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	export let orientation: 'white' | 'black' = 'white';
	// UCI move (e.g. "e2e4") to draw as a suggestion arrow, and whether to show it at all.
	export let bestMoveUci: string | null = null;
	export let showBestMoveArrow: boolean = true;

	const dispatch = createEventDispatcher<{
		move: { from: Square; to: Square; promotion?: string };
		// `reset: true` means "forget whatever bestMove/pv you were showing" - sent the
		// instant a new position starts being analyzed, so the arrow doesn't keep
		// pointing at the previous position while the engine catches up.
		engine: { evaluation: number; bestMove: string; pv: string[]; reset?: boolean };
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
	let hasEvaluated = false; // becomes true once the engine reports its first real score

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

	// Requests are serialized: only one `go` is ever in flight. Each request gets
	// a token, and a `bestmove` reply is only trusted (dispatched to the parent)
	// if no newer request has superseded it in the meantime - otherwise a search
	// that got `stop`'d the instant a new move arrived could flash a stale/
	// half-baked "best move" for a position that isn't even on screen anymore.
	// The sign of every score is resolved against the position that was actually
	// sent, not whatever `turn` happens to be by the time the engine replies.
	let searching = false;
	let activeTurn: 'w' | 'b' = 'w';
	let requestToken = 0;
	let activeToken = 0;
	let queuedFen: string | null = null;
	let queuedTurn: 'w' | 'b' = 'w';

	function requestEngineEval(fenToEval: string, turnToEval: 'w' | 'b') {
		if (!stockfish) return;

		requestToken++;

		// A new position is now the one that matters - whatever bestMove/arrow was
		// shown belonged to whatever position we were just looking at, so clear it
		// immediately instead of leaving it on screen until the new search resolves.
		dispatch('engine', { evaluation, bestMove: '', pv: [], reset: true });

		if (searching) {
			queuedFen = fenToEval;
			queuedTurn = turnToEval;
			stockfish.postMessage('stop');
			return;
		}

		searching = true;
		activeTurn = turnToEval;
		activeToken = requestToken;
		stockfish.postMessage(`position fen ${fenToEval}`);
		stockfish.postMessage('go depth 18');
	}

	onMount(() => {
		try {
			stockfish = new Worker('/stockfish.js');

			stockfish.onmessage = (event) => {
				const line = event.data;
				if (typeof line !== 'string') return;

				if (line.startsWith('bestmove')) {
					const finishedToken = activeToken;
					searching = false;
					if (queuedFen) {
						const nextFen = queuedFen;
						const nextTurn = queuedTurn;
						queuedFen = null;
						requestEngineEval(nextFen, nextTurn);
					}

					// Only trust this result if nothing newer has come in while it
					// was running (or being aborted).
					if (finishedToken === requestToken) {
						const match = line.match(/bestmove\s+(\S+)/);
						if (match && match[1] !== '(none)') {
							dispatch('engine', { evaluation, bestMove: match[1], pv: [] });
						}
					}
					return;
				}

				if (line.startsWith('info') && (line.includes('score cp') || line.includes('score mate'))) {
					// This search has already been superseded by a newer request (e.g. a
					// `stop` was sent but the engine is still flushing lines from the old
					// search) - the position it describes is no longer on screen.
					if (activeToken !== requestToken) return;

					const scoreCpMatch = line.match(/score cp (-?\d+)/);
					const scoreMateMatch = line.match(/score mate (-?\d+)/);
					const pvMatch = line.match(/pv\s+(.*)/);

					let currentEval = evaluation;
					let currentPv: string[] = [];

					if (scoreCpMatch) {
						let cp = parseInt(scoreCpMatch[1], 10);
						if (activeTurn === 'b') cp = -cp;
						currentEval = cp / 100;
					} else if (scoreMateMatch) {
						const mateIn = parseInt(scoreMateMatch[1], 10);
						let mateScore = mateIn;
						if (activeTurn === 'b') mateScore = -mateScore;
						currentEval = mateScore > 0 ? Infinity : -Infinity;
					}

					if (pvMatch) {
						currentPv = pvMatch[1].split(' ').slice(0, 5);
					}

					evaluation = currentEval;
					hasEvaluated = true;
					dispatch('engine', { evaluation, bestMove: '', pv: currentPv });
				}
			};

			stockfish.postMessage('uci');
			// A bigger hash table means fewer repeated searches on deep/long games,
			// at the cost of more memory - worth it for meaningfully stronger analysis.
			stockfish.postMessage('setoption name Hash value 128');
			stockfish.postMessage('isready');
		} catch (e) {
			console.error('Stockfish init failed', e);
			stockfish = null;
		}

		updateGameState();
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

	let boardElement: HTMLElement;

	// Animated piece layer: each piece keeps a stable id across renders so the
	// browser can transition its position (instead of the piece just popping
	// into its new square, which is what made moves feel abrupt before).
	interface PieceState {
		id: number;
		type: string;
		color: 'w' | 'b';
		row: number;
		col: number;
	}
	let pieces: PieceState[] = [];
	let pieceIdCounter = 0;
	let skipPieceTransition = true; // true on mount so the initial board doesn't "slide in"

	function squareToRC(square: string): [number, number] {
		const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const row = 8 - parseInt(square[1], 10);
		const col = files.indexOf(square[0]);
		return [row, col];
	}

	// Best-move suggestion arrow, in board-percentage coordinates (0-100).
	$: arrow = (() => {
		if (!bestMoveUci || bestMoveUci.length < 4) return null;
		try {
			const [fr, fc] = squareToRC(bestMoveUci.slice(0, 2));
			const [tr, tc] = squareToRC(bestMoveUci.slice(2, 4));
			const dispFr = orientation === 'white' ? fr : 7 - fr;
			const dispFc = orientation === 'white' ? fc : 7 - fc;
			const dispTr = orientation === 'white' ? tr : 7 - tr;
			const dispTc = orientation === 'white' ? tc : 7 - tc;
			return {
				x1: (dispFc + 0.5) * 12.5,
				y1: (dispFr + 0.5) * 12.5,
				x2: (dispTc + 0.5) * 12.5,
				y2: (dispTr + 0.5) * 12.5
			};
		} catch {
			return null;
		}
	})();

	function syncPieces(newBoard: ReturnType<Chess['board']>) {
		// These Maps/Sets are throwaway scratch space local to this single
		// synchronous pass (never read reactively/in markup), so the plain
		// built-ins are correct here - SvelteMap/SvelteSet would just add
		// proxy overhead for no benefit.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const oldBySquare = new Map<string, PieceState>();
		for (const p of pieces) {
			oldBySquare.set(getSquare(p.row, p.col), p);
		}

		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const newBySquare = new Map<string, { type: string; color: 'w' | 'b' }>();
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				const p = newBoard[r][c];
				if (p) newBySquare.set(getSquare(r, c), { type: p.type, color: p.color as 'w' | 'b' });
			}
		}

		const nextPieces: PieceState[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const usedOldIds = new Set<number>();
		const unmatchedNewSquares: string[] = [];

		// Squares that already hold the exact same piece: nothing to animate.
		for (const [square, np] of newBySquare) {
			const op = oldBySquare.get(square);
			if (op && op.type === np.type && op.color === np.color) {
				nextPieces.push(op);
				usedOldIds.add(op.id);
			} else {
				unmatchedNewSquares.push(square);
			}
		}

		const remainingOld = pieces.filter((p) => !usedOldIds.has(p.id));

		// Match every remaining old piece to the closest plausible new square
		// (same colour; prefer same type, falling back for promotions).
		for (const square of unmatchedNewSquares) {
			const target = newBySquare.get(square)!;
			const [tr, tc] = squareToRC(square);

			let bestIdx = -1;
			let bestScore = Infinity;
			remainingOld.forEach((op, idx) => {
				if (usedOldIds.has(op.id) || op.color !== target.color) return;
				const dist = Math.abs(op.row - tr) + Math.abs(op.col - tc);
				const score = (op.type === target.type ? 0 : 100) + dist;
				if (score < bestScore) {
					bestScore = score;
					bestIdx = idx;
				}
			});

			if (bestIdx >= 0) {
				const op = remainingOld[bestIdx];
				usedOldIds.add(op.id);
				nextPieces.push({ id: op.id, type: target.type, color: target.color, row: tr, col: tc });
			} else {
				nextPieces.push({
					id: pieceIdCounter++,
					type: target.type,
					color: target.color,
					row: tr,
					col: tc
				});
			}
		}

		const changedCount = nextPieces.reduce((count, np) => {
			const op = pieces.find((p) => p.id === np.id);
			return !op || op.row !== np.row || op.col !== np.col ? count + 1 : count;
		}, 0);

		// A normal move (including castling/en passant) shifts at most a
		// couple of pieces. Anything bigger means we jumped somewhere in the
		// move list, so snap instantly instead of sliding every piece around.
		skipPieceTransition = changedCount > 2 || pieces.length === 0;
		pieces = nextPieces;
	}

	function updateGameState() {
		board = chess.board();
		syncPieces(board);
		if (skipPieceTransition) {
			// Let this render apply positions with transitions disabled, then
			// re-enable them for whatever move comes next.
			tick().then(() => {
				skipPieceTransition = false;
			});
		}
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
			requestEngineEval(chess.fen(), turn as 'w' | 'b');
		} else {
			evaluation = getMaterialEvaluation();
		}
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

</script>

<div
	class="flex gap-2 sm:gap-4 items-stretch justify-center w-full max-w-full sm:max-w-3xl flex-col sm:flex-row"
>
	<!-- Eval Bar (Desktop) -->
	<div class="h-auto w-8 py-8 hidden sm:block">
		<EvalBar {evaluation} loading={!hasEvaluated} orientation="vertical" />
	</div>

	<div class="flex flex-col gap-2 sm:gap-4 w-full max-w-full sm:max-w-2xl">
		<!-- Eval Bar (Mobile) -->
		<div class="w-full h-6 block sm:hidden">
			<EvalBar {evaluation} loading={!hasEvaluated} orientation="horizontal" />
		</div>

		<div
			bind:this={boardElement}
			class="aspect-square w-full select-none rounded-lg shadow-2xl relative overflow-hidden ring-4 ring-border"
		>
			<div class="grid h-full w-full grid-cols-8 grid-rows-8">
				{#each rows as row (row)}
					{#each cols as col (col)}
						{@const isDark = (row + col) % 2 === 1}
						{@const square = getSquare(row, col)}
						{@const piece = board[row][col]}
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
                            {piece ? 'cursor-grab active:cursor-grabbing' : ''}
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

			<!-- Animated Piece Layer -->
			<div class="absolute inset-0 z-10 pointer-events-none">
				{#each pieces as piece (piece.id)}
					{@const square = getSquare(piece.row, piece.col)}
					{@const isDragged = draggedPiece?.square === square}
					{@const isCaptureTarget = possibleMoves.includes(square)}
					{@const displayRow = orientation === 'white' ? piece.row : 7 - piece.row}
					{@const displayCol = orientation === 'white' ? piece.col : 7 - piece.col}
					<div
						class="absolute top-0 left-0 h-[12.5%] w-[12.5%] flex items-center justify-center {skipPieceTransition
							? ''
							: 'transition-transform duration-200 ease-out'}"
						style="transform: translate({displayCol * 100}%, {displayRow *
							100}%); opacity: {isDragged ? 0 : 1};"
					>
						<div class="h-[80%] w-[80%] {isCaptureTarget ? 'opacity-80' : ''}">
							<Icon
								name={getPieceName(piece.type)}
								color={piece.color}
								size="107%"
								class="drop-shadow-lg filter"
							/>
						</div>
					</div>
				{/each}
			</div>

			<!-- Best Move Arrow -->
			{#if showBestMoveArrow && arrow}
				<svg
					class="absolute inset-0 z-20 pointer-events-none"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<defs>
						<marker
							id="pp-arrowhead"
							markerWidth="2.4"
							markerHeight="2.4"
							refX="1.2"
							refY="1.2"
							orient="auto"
						>
							<path d="M0,0 L2.4,1.2 L0,2.4 Z" fill="rgba(255,170,0,0.85)" />
						</marker>
					</defs>
					<line
						x1={arrow.x1}
						y1={arrow.y1}
						x2={arrow.x2}
						y2={arrow.y2}
						stroke="rgba(255,170,0,0.85)"
						stroke-width="2.2"
						stroke-linecap="round"
						marker-end="url(#pp-arrowhead)"
					/>
				</svg>
			{/if}

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
	</div>
</div>
