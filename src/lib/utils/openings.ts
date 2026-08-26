// Opening identification, backed by the full lichess ECO dataset
// (https://github.com/lichess-org/chess-openings, public domain) instead of
// the old hand-picked handful of lines - this recognizes several thousand
// named openings/variations instead of ~40.
import { ECO_OPENINGS } from '$lib/data/eco-openings';

export interface Opening {
	eco: string;
	name: string;
}

// Map move-sequence -> opening, plus the longest sequence length (in tokens)
// so lookups only need to try that many prefixes instead of walking the
// whole game.
const byMoves = new Map<string, Opening>();
let maxTokens = 0;

for (const [eco, name, moves] of ECO_OPENINGS) {
	byMoves.set(moves, { eco, name });
	const tokenCount = moves.split(' ').length;
	if (tokenCount > maxTokens) maxTokens = tokenCount;
}

/**
 * Longest known opening matching the start of `sanMoves` (plain SAN, no move
 * numbers). Returns null once the game has left known theory (or never
 * entered it - e.g. an unusual first move with no book entry at all).
 */
export function getOpening(sanMoves: string[]): Opening | null {
	const limit = Math.min(sanMoves.length, maxTokens);
	for (let len = limit; len > 0; len--) {
		const hit = byMoves.get(sanMoves.slice(0, len).join(' '));
		if (hit) return hit;
	}
	return null;
}

/** Is the move at `plyIndex` (0-based) still within known opening theory? */
export function isBookMove(sanMoves: string[], plyIndex: number, maxPly: number): boolean {
	if (plyIndex > maxPly) return false;
	const prefix = sanMoves.slice(0, plyIndex + 1).join(' ');
	// A prefix counts as "book" if it's itself a known line, or the start of
	// one - most openings continue further than any single ply we're checking.
	if (byMoves.has(prefix)) return true;
	for (const [, , moves] of ECO_OPENINGS) {
		if (moves === prefix || moves.startsWith(prefix + ' ')) return true;
	}
	return false;
}
