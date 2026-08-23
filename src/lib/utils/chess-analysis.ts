import { Chess } from 'chess.js';
import { OPENING_BOOK } from './opening-book';

export type MoveRating =
	| 'Book'
	| 'Brilliant'
	| 'Best'
	| 'Excellent'
	| 'Good'
	| 'Inaccuracy'
	| 'Mistake'
	| 'Blunder';

export interface AnalysisResult {
	/** White-perspective evaluation (pawns) at each ply, index 0 = starting position. */
	evaluations: number[];
	/** ratings[i] = quality of the move that produced fens[i]. ratings[0] is always null. */
	ratings: (MoveRating | null)[];
}

const MATE_SCORE = 20; // pawns, stand-in for "forced mate" so comparisons stay sane
const MOVETIME_MS = 300;
const BOOK_MAX_PLY = 10; // only look for book moves in the first N plies

function isBookMove(sanMoves: string[], plyIndex: number): boolean {
	if (plyIndex > BOOK_MAX_PLY) return false;
	const prefix = sanMoves.slice(0, plyIndex + 1).join(' ');
	return OPENING_BOOK.some((line) => line === prefix || line.startsWith(prefix + ' '));
}

interface EngineLine {
	evalWhite: number;
	bestMoveUci: string | null;
}

function evaluatePosition(worker: Worker, fen: string): Promise<EngineLine> {
	return new Promise((resolve) => {
		let latestCp: number | null = null;
		let latestMate: number | null = null;
		const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w';

		function onMessage(event: MessageEvent) {
			const line = event.data;
			if (typeof line !== 'string') return;

			if (line.startsWith('info') && (line.includes('score cp') || line.includes('score mate'))) {
				const cpMatch = line.match(/score cp (-?\d+)/);
				const mateMatch = line.match(/score mate (-?\d+)/);
				if (mateMatch) {
					latestMate = parseInt(mateMatch[1], 10);
					latestCp = null;
				} else if (cpMatch) {
					latestCp = parseInt(cpMatch[1], 10);
					latestMate = null;
				}
			}

			if (line.startsWith('bestmove')) {
				const match = line.match(/bestmove\s+(\S+)/);
				const bestMoveUci = match && match[1] !== '(none)' ? match[1] : null;

				let evalSideToMove: number;
				if (latestMate !== null) {
					evalSideToMove = latestMate > 0 ? MATE_SCORE : -MATE_SCORE;
				} else if (latestCp !== null) {
					evalSideToMove = latestCp / 100;
				} else {
					evalSideToMove = 0;
				}

				const evalWhite = sideToMove === 'w' ? evalSideToMove : -evalSideToMove;

				worker.removeEventListener('message', onMessage);
				resolve({ evalWhite, bestMoveUci });
			}
		}

		worker.addEventListener('message', onMessage);
		worker.postMessage(`position fen ${fen}`);
		worker.postMessage(`go movetime ${MOVETIME_MS}`);
	});
}

function uciToSan(fen: string, uciMove: string): string | null {
	try {
		const game = new Chess(fen);
		const from = uciMove.slice(0, 2);
		const to = uciMove.slice(2, 4);
		const promotion = uciMove.length > 4 ? uciMove.slice(4) : undefined;
		const move = game.move({ from, to, promotion });
		return move ? move.san : null;
	} catch {
		return null;
	}
}

/**
 * Crude sacrifice detector: did the mover put a piece worth 3+ points somewhere
 * the opponent can immediately grab it? Combined with "this was still the best
 * move and the position stays good for the mover" that's a reasonable stand-in
 * for a "Brilliant" move.
 */
function isSacrifice(fenBefore: string, uciMove: string): boolean {
	try {
		const game = new Chess(fenBefore);
		const from = uciMove.slice(0, 2) as import('chess.js').Square;
		const to = uciMove.slice(2, 4) as import('chess.js').Square;
		const promotion = uciMove.length > 4 ? uciMove.slice(4) : undefined;
		const move = game.move({ from, to, promotion });
		if (!move) return false;

		const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
		if ((values[move.piece] || 0) < 3) return false; // ignore pawn pushes/trades

		return game.moves({ verbose: true }).some((m) => m.to === to && m.captured);
	} catch {
		return false;
	}
}

/**
 * Runs a full-game engine pass and classifies every move played. Spins up its
 * own Stockfish worker so it doesn't fight with any "live" analysis a board
 * component might be doing for the currently displayed position.
 */
export async function analyzeGame(
	fens: string[],
	sanMoves: string[],
	onProgress?: (done: number, total: number) => void
): Promise<AnalysisResult> {
	const worker = new Worker('/stockfish.js');

	await new Promise<void>((resolve) => {
		function onReady(event: MessageEvent) {
			if (event.data === 'readyok') {
				worker.removeEventListener('message', onReady);
				resolve();
			}
		}
		worker.addEventListener('message', onReady);
		worker.postMessage('uci');
		worker.postMessage('isready');
	});

	const evaluations: number[] = [];
	const bestMoves: (string | null)[] = [];
	const total = fens.length;

	try {
		for (let i = 0; i < total; i++) {
			const fen = fens[i];
			const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w';

			if (new Chess(fen).isCheckmate()) {
				// No legal moves to search; the side to move has just been mated.
				evaluations.push(sideToMove === 'w' ? -MATE_SCORE : MATE_SCORE);
				bestMoves.push(null);
			} else {
				const { evalWhite, bestMoveUci } = await evaluatePosition(worker, fen);
				evaluations.push(evalWhite);
				bestMoves.push(bestMoveUci);
			}

			onProgress?.(i + 1, total);
		}
	} finally {
		worker.terminate();
	}

	const ratings: (MoveRating | null)[] = [null];

	for (let i = 1; i < total; i++) {
		const fenBefore = fens[i - 1];
		const moverIsWhite = fenBefore.split(' ')[1] !== 'b';
		const evalBefore = evaluations[i - 1];
		const evalAfter = evaluations[i];

		// Centipawn loss from the mover's point of view (0 or positive = no loss).
		const loss = Math.max(0, moverIsWhite ? evalBefore - evalAfter : evalAfter - evalBefore);

		if (isBookMove(sanMoves, i - 1)) {
			ratings.push('Book');
			continue;
		}

		const playedSan = sanMoves[i - 1];
		const bestUci = bestMoves[i - 1];
		const bestSan = bestUci ? uciToSan(fenBefore, bestUci) : null;
		const isBest = !!bestSan && bestSan === playedSan;

		if (isBest && loss < 0.3) {
			const moverEvalAfter = moverIsWhite ? evalAfter : -evalAfter;
			if (loss < 0.1 && moverEvalAfter > -0.5 && isSacrifice(fenBefore, bestUci!)) {
				ratings.push('Brilliant');
			} else {
				ratings.push('Best');
			}
			continue;
		}

		if (loss < 0.2) ratings.push('Excellent');
		else if (loss < 0.5) ratings.push('Good');
		else if (loss < 1.0) ratings.push('Inaccuracy');
		else if (loss < 2.0) ratings.push('Mistake');
		else ratings.push('Blunder');
	}

	return { evaluations, ratings };
}
