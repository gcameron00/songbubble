/**
 * GET /api/debug/stats
 * Returns a summary of current database state for the BubbleTrouble dashboard.
 */
import type { Env } from '../../env.d.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [lyrics, votes, votesToday, fingerprints] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM lyrics').first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM votes').first<{ n: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM votes WHERE vote_day = DATE('now')",
    ).first<{ n: number }>(),
    env.DB.prepare(
      'SELECT COUNT(DISTINCT fingerprint) AS n FROM votes',
    ).first<{ n: number }>(),
  ]);

  return Response.json({
    lyrics_count:          lyrics?.n          ?? 0,
    votes_count:           votes?.n           ?? 0,
    votes_today:           votesToday?.n      ?? 0,
    unique_fingerprints:   fingerprints?.n    ?? 0,
  });
};
