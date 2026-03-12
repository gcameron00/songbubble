/**
 * GET /api/debug/lyrics?page=1
 * Returns all lyrics (ordered by id) with their current decay-weighted score.
 * Debug use only — not linked from the public chart.
 */
import type { Env } from '../../env.d.ts';

const PER_PAGE     = 25;
const DECAY_SECONDS = 7 * 24 * 60 * 60;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const offset = (page - 1) * PER_PAGE;

  const [{ results }, { results: countRows }] = await Promise.all([
    env.DB.prepare(`
      SELECT
        l.id,
        l.text,
        l.artist,
        l.song,
        l.created_at,
        CAST(ROUND(COALESCE(
          SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / CAST(? AS REAL))),
          0
        )) AS INTEGER) AS score
      FROM lyrics l
      LEFT JOIN votes v ON v.lyric_id = l.id
      GROUP BY l.id
      ORDER BY l.id
      LIMIT ? OFFSET ?
    `).bind(DECAY_SECONDS, PER_PAGE, offset).all(),

    env.DB.prepare('SELECT COUNT(*) AS total FROM lyrics').all(),
  ]);

  const total = (countRows[0] as { total: number }).total;

  return Response.json({ results, page, per_page: PER_PAGE, total });
};
