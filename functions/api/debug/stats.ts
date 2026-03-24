/**
 * GET /api/debug/stats
 * Returns a summary of current database state for the BubbleTrouble dashboard.
 */
import type { Env } from '../../env.d.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [songs, votes, votesToday, fingerprints, noAmId] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM songs').first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM votes').first<{ n: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM votes WHERE vote_day = DATE('now')",
    ).first<{ n: number }>(),
    env.DB.prepare(
      'SELECT COUNT(DISTINCT fingerprint) AS n FROM votes',
    ).first<{ n: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM songs WHERE apple_music_id IS NULL OR apple_music_id = ''",
    ).first<{ n: number }>(),
  ]);

  return Response.json({
    songs_count:         songs?.n         ?? 0,
    votes_count:         votes?.n         ?? 0,
    votes_today:         votesToday?.n    ?? 0,
    unique_fingerprints: fingerprints?.n  ?? 0,
    no_apple_music_id:   noAmId?.n        ?? 0,
  });
};
