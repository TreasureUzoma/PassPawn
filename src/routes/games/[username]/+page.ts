import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

interface ChessComProfile {
	avatar?: string;
	username: string;
	name?: string;
	followers: number;
	country?: string;
}

export const load: PageLoad = async ({ params, fetch }) => {
	const username = params.username?.trim();

	if (!username) {
		throw error(400, 'A username is required.');
	}

	let res: Response;
	try {
		res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`);
	} catch {
		throw error(502, 'Could not reach Chess.com. Please try again in a moment.');
	}

	if (res.status === 404) {
		throw error(404, `No Chess.com player found for "${username}".`);
	}

	if (!res.ok) {
		throw error(502, 'Chess.com is having issues right now. Please try again in a moment.');
	}

	const profile = (await res.json()) as ChessComProfile;

	return { username, profile };
};
