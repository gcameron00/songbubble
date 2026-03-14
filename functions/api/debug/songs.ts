/**
 * GET /api/debug/songs?page=1
 * Returns all songs (ordered by id) with their current decay-weighted score.
 * Debug use only — not linked from the public chart.
 */
import type { Env } from '../../env.d.ts';

const PER_PAGE      = 25;
const DECAY_SECONDS = 28 * 24 * 60 * 60;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const offset = (page - 1) * PER_PAGE;

  const [{ results }, { results: countRows }] = await Promise.all([
    env.DB.prepare(`
      SELECT
        s.id,
        s.title,
        s.artist,
        s.album,
        s.created_at,
        CAST(ROUND(COALESCE(
          SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / CAST(? AS REAL))),
          0
        )) AS INTEGER) AS score
      FROM songs s
      LEFT JOIN votes v ON v.song_id = s.id
      GROUP BY s.id
      ORDER BY s.id
      LIMIT ? OFFSET ?
    `).bind(DECAY_SECONDS, PER_PAGE, offset).all(),

    env.DB.prepare('SELECT COUNT(*) AS total FROM songs').all(),
  ]);

  const total = (countRows[0] as { total: number }).total;

  return Response.json({ results, page, per_page: PER_PAGE, total });
};
