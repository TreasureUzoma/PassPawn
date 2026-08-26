import { Chess } from 'chess.js';
import { isBookMove as isKnownOpeningMove } from './openings';

export type MoveRating =
	| 'Book'
	| 'Brilliant'
	| 'Best'
	| 'Excellent'
	| 'Good'
	| 'Inaccuracy'
	| 'Mistake'
	| 'Blunder';

export interface PlayerReport {
	/** 0-100, lichess-style "how close to the engine's evaluation" score. */
	accuracy: number;
	/** Average centipawn loss (in pawns), excluding book moves. */
	acpl: number;
	/** Rough Elo-ish estimate derived from acpl. Not an official rating - a ballpark. */
	estimatedRating: number;
	moveCounts: Partial<Record<MoveRating, number>>;
}

export interface GameReport {
	white: PlayerReport;
	black: PlayerReport;
}

export interface AnalysisResult {
	/** White-perspective evaluation (pawns) at each ply, index 0 = starting position. */
	evaluations: number[];
	/** ratings[i] = quality of the move that produced fens[i]. ratings[0] is always null. */
	ratings: (MoveRating | null)[];
	/** accuracyByPly[i] = accuracy (0-100) of the move that produced fens[i]. null for ply 0 and book moves. */
	accuracyByPly: (number | null)[];
	report: GameReport;
}

const MATE_SCORE = 20; // pawns, stand-in for "forced mate" so comparisons stay sane
const MOVETIME_MS = 600; // more search time per position = fewer bogus "blunders"
const BOOK_MAX_PLY = 10; // only look for book moves in the first N plies

function isBookMove(sanMoves: string[], plyIndex: number): boolean {
	return isKnownOpeningMove(sanMoves, plyIndex, BOOK_MAX_PLY);
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

/** Converts a white-perspective eval (pawns) into White's win probability (0-100). */
function winPercent(evalWhite: number): number {
	if (evalWhite >= MATE_SCORE) return 100;
	if (evalWhite <= -MATE_SCORE) return 0;
	const cp = evalWhite * 100;
	return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Lichess's move-accuracy curve: bigger win% swings decay accuracy fast, small swings barely dent it. */
function accuracyFromWinPercentLoss(winPercentLoss: number): number {
	const acc = 103.1668 * Math.exp(-0.04354 * winPercentLoss) - 3.1669;
	return Math.max(0, Math.min(100, acc));
}

// Rough ACPL (pawns) -> Elo anchors. This is a ballpark heuristic, not a real
// rating formula - there's no substitute for actually playing rated games.
const RATING_ANCHORS: [acpl: number, rating: number][] = [
	[0, 2900],
	[0.1, 2500],
	[0.2, 2200],
	[0.35, 2000],
	[0.5, 1800],
	[0.75, 1600],
	[1.0, 1400],
	[1.5, 1200],
	[2.0, 1000],
	[3.0, 800],
	[5.0, 500]
];

function estimateRating(acpl: number): number {
	if (acpl <= RATING_ANCHORS[0][0]) return RATING_ANCHORS[0][1];
	for (let i = 1; i < RATING_ANCHORS.length; i++) {
		const [prevAcpl, prevRating] = RATING_ANCHORS[i - 1];
		const [anchorAcpl, anchorRating] = RATING_ANCHORS[i];
		if (acpl <= anchorAcpl) {
			const t = (acpl - prevAcpl) / (anchorAcpl - prevAcpl);
			return Math.round((prevRating + t * (anchorRating - prevRating)) / 25) * 25;
		}
	}
	return RATING_ANCHORS[RATING_ANCHORS.length - 1][1];
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
		// A bigger hash table trades memory for meaningfully stronger, more
		// consistent evaluations across a whole game.
		worker.postMessage('setoption name Hash value 128');
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
	const accuracyByPly: (number | null)[] = [null];

	const totals = {
		w: { acplSum: 0, acplCount: 0, accSum: 0, accCount: 0, moveCounts: {} as Partial<Record<MoveRating, number>> },
		b: { acplSum: 0, acplCount: 0, accSum: 0, accCount: 0, moveCounts: {} as Partial<Record<MoveRating, number>> }
	};

	for (let i = 1; i < total; i++) {
		const fenBefore = fens[i - 1];
		const moverIsWhite = fenBefore.split(' ')[1] !== 'b';
		const mover = moverIsWhite ? totals.w : totals.b;
		const evalBefore = evaluations[i - 1];
		const evalAfter = evaluations[i];

		// Centipawn loss from the mover's point of view (0 or positive = no loss).
		const loss = Math.max(0, moverIsWhite ? evalBefore - evalAfter : evalAfter - evalBefore);

		// Win% swing, from the mover's own point of view, feeds the accuracy curve.
		const wpBefore = moverIsWhite ? winPercent(evalBefore) : 100 - winPercent(evalBefore);
		const wpAfter = moverIsWhite ? winPercent(evalAfter) : 100 - winPercent(evalAfter);
		const winPercentLoss = Math.max(0, wpBefore - wpAfter);
		const accuracy = accuracyFromWinPercentLoss(winPercentLoss);

		let rating: MoveRating;

		if (isBookMove(sanMoves, i - 1)) {
			rating = 'Book';
		} else {
			const playedSan = sanMoves[i - 1];
			const bestUci = bestMoves[i - 1];
			const bestSan = bestUci ? uciToSan(fenBefore, bestUci) : null;
			const isBest = !!bestSan && bestSan === playedSan;

			if (isBest && loss < 0.3) {
				const moverEvalAfter = moverIsWhite ? evalAfter : -evalAfter;
				rating =
					loss < 0.1 && moverEvalAfter > -0.5 && isSacrifice(fenBefore, bestUci!)
						? 'Brilliant'
						: 'Best';
			} else if (loss < 0.2) rating = 'Excellent';
			else if (loss < 0.5) rating = 'Good';
			else if (loss < 1.0) rating = 'Inaccuracy';
			else if (loss < 2.0) rating = 'Mistake';
			else rating = 'Blunder';
		}

		ratings.push(rating);
		mover.moveCounts[rating] = (mover.moveCounts[rating] || 0) + 1;

		// Book moves are "free" theory - they don't count for or against accuracy/ACPL.
		if (rating === 'Book') {
			accuracyByPly.push(null);
		} else {
			accuracyByPly.push(accuracy);
			mover.acplSum += loss;
			mover.acplCount++;
			mover.accSum += accuracy;
			mover.accCount++;
		}
	}

	function buildPlayerReport(t: (typeof totals)['w']): PlayerReport {
		const acpl = t.acplCount > 0 ? t.acplSum / t.acplCount : 0;
		const accuracy = t.accCount > 0 ? t.accSum / t.accCount : 100;
		return {
			accuracy: Math.round(accuracy * 10) / 10,
			acpl: Math.round(acpl * 100) / 100,
			estimatedRating: t.acplCount > 0 ? estimateRating(acpl) : 0,
			moveCounts: t.moveCounts
		};
	}

	const report: GameReport = {
		white: buildPlayerReport(totals.w),
		black: buildPlayerReport(totals.b)
	};

	return { evaluations, ratings, accuracyByPly, report };
}
