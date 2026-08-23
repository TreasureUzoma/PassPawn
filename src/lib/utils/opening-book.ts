// A small book of common opening lines (SAN, space separated, no move numbers).
// Used to label the first few plies of a game "Book" instead of relying on the
// engine (which often flags perfectly normal theoretical moves as inaccuracies
// simply because it prefers a different, equally-fine, move order).
//
// This is intentionally not exhaustive — it just needs to cover openings a
// typical club player is likely to reach so the analysis doesn't scream
// "blunder" at move 3.
export const OPENING_BOOK: string[] = [
	// Italian Game
	'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6',
	'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4',
	// Ruy Lopez
	'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7',
	'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6',
	'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6',
	// Scotch / Four Knights / Petrov / Philidor
	'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6',
	'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O',
	'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5',
	'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7',
	// King's Gambit / Vienna
	'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6',
	'e4 e5 Nc3 Nf6 g3 d5 exd5 Nxd5 Bg2 Nb6',
	// Sicilian
	'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
	'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6',
	'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5',
	'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7',
	'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6',
	'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6',
	// French Defense
	'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7',
	'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6',
	'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5',
	// Caro-Kann
	'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6',
	'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5',
	'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6',
	// Scandinavian / Pirc / Alekhine / Modern
	'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6',
	'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O',
	'e4 Nf6 e5 Nd5 d4 d6 Nf3 g6 Bc4 Nb6',
	'e4 g6 d4 Bg7 Nc3 d6 f4 Nf6 Nf3 O-O',
	// Queen's Gambit
	'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O',
	'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5',
	'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5',
	'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7',
	// King's Indian / Grünfeld / Nimzo / Queen's Indian / Catalan
	'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O',
	'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3',
	'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5',
	'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7',
	'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O',
	// London / Colle / Trompowsky
	'd4 d5 Nf3 Nf6 Bf4 e6 e3 Bd6 Bg3 O-O',
	'd4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O Be2 d6',
	'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6',
	'd4 Nf6 Bg5 e6 e4 h6 Bxf6 Qxf6 Nc3 d6',
	// Benoni / Budapest / Dutch
	'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6',
	'd4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4',
	'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O',
	// English / Reti / Bird
	'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5',
	'c4 c5 Nf3 Nf6 Nc3 Nc6 g3 g6 Bg2 Bg7',
	'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O',
	'f4 d5 Nf3 Nf6 e3 g6 b3 Bg7 Bb2 O-O'
];
