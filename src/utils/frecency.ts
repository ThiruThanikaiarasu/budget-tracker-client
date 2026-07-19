import type { Friend } from '../store/friendStore';

// Must match the server's half-life (friendController.ts) so ordering agrees.
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const LAMBDA = Math.LN2 / HALF_LIFE_MS;

/** Current, decayed frecency score for a friend (0 if never interacted). */
export function frecency(f: Friend, now = Date.now()): number {
  if (!f.frecencyScore || !f.lastInteractedAt) return 0;
  const dt = Math.max(0, now - new Date(f.lastInteractedAt).getTime());
  return f.frecencyScore * Math.exp(-LAMBDA * dt);
}

/**
 * Most-used friends first (recency-weighted). Stable: friends with no history
 * keep their existing relative order (which is newest-first from the API).
 */
export function sortByFrecency(friends: Friend[]): Friend[] {
  const now = Date.now();
  return friends
    .map((f, i) => ({ f, i, s: frecency(f, now) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}
