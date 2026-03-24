/**
 * GET /api/debug/activity
 * Returns vote counts per day for the last 28 days, including days with zero votes.
 */
import type { Env } from '../../env.d.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT DATE('now', '-27 days')
      UNION ALL
      SELECT DATE(d, '+1 day') FROM dates WHERE d < DATE('now')
    )
    SELECT dates.d AS vote_day, COUNT(votes.id) AS count
    FROM dates
    LEFT JOIN votes ON votes.vote_day = dates.d
    GROUP BY dates.d
    ORDER BY dates.d ASC
  `).all();

  return Response.json(results);
};
