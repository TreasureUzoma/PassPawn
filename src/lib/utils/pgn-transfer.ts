// Hands a PGN off to the /games/pgn review page without going through the
// URL query string, which can hit browser/server length limits for large
// PGNs (many games concatenated, deep annotations, etc).
const STORAGE_KEY = 'passedpawn:pending-pgn';

export function stashPgn(pgn: string) {
	try {
		sessionStorage.setItem(STORAGE_KEY, pgn);
	} catch {
		// sessionStorage unavailable (private mode, quota, etc) — caller falls
		// back to passing the PGN via the URL query param instead.
	}
}

export function takePgn(): string | null {
	try {
		const pgn = sessionStorage.getItem(STORAGE_KEY);
		if (pgn) sessionStorage.removeItem(STORAGE_KEY);
		return pgn;
	} catch {
		return null;
	}
}
