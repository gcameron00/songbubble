/**
 * GET /api/debug/votes?page=1&sort=id&order=desc
 * Returns all votes (newest first by default). Fingerprints are truncated to
 * the first 8 characters to avoid exposing the full token in the browser.
 * Debug use only — not linked from the public chart.
 */
import type { Env } from '../../env.d.ts';

const PER_PAGE = 25;

const SORT_COLS: Record<string, string> = {
  id:          'v.id',
  song_id:     'v.song_id',
  fingerprint: 'v.fingerprint',
  vote_day:    'v.vote_day',
  created_at:  'v.created_at',
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const offset = (page - 1) * PER_PAGE;
  const sort   = SORT_COLS[url.searchParams.get('sort') ?? ''] ?? 'v.id';
  const order  = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

  const [{ results }, { results: countRows }] = await Promise.all([
    env.DB.prepare(`
      SELECT
        v.id,
        v.song_id,
        s.artist || ' \u2014 ' || s.title AS song_label,
        SUBSTR(v.fingerprint, 1, 8) || '\u2026' AS fingerprint,
        v.vote_day,
        v.created_at
      FROM votes v
      LEFT JOIN songs s ON s.id = v.song_id
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
    `).bind(PER_PAGE, offset).all(),

    env.DB.prepare('SELECT COUNT(*) AS total FROM votes').all(),
  ]);

  const total = (countRows[0] as { total: number }).total;

  return Response.json({ results, page, per_page: PER_PAGE, total });
};
