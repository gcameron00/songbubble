/**
 * GET /api/debug/votes?page=1
 * Returns all votes (newest first). Fingerprints are truncated to the first 8
 * characters to avoid exposing the full token in the browser.
 * Debug use only — not linked from the public chart.
 */
import type { Env } from '../../env.d.ts';

const PER_PAGE = 25;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const offset = (page - 1) * PER_PAGE;

  const [{ results }, { results: countRows }] = await Promise.all([
    env.DB.prepare(`
      SELECT
        v.id,
        v.lyric_id,
        l.artist || ' — ' || l.song AS lyric_label,
        SUBSTR(v.fingerprint, 1, 8) || '…' AS fingerprint,
        v.vote_day,
        v.created_at
      FROM votes v
      LEFT JOIN lyrics l ON l.id = v.lyric_id
      ORDER BY v.id DESC
      LIMIT ? OFFSET ?
    `).bind(PER_PAGE, offset).all(),

    env.DB.prepare('SELECT COUNT(*) AS total FROM votes').all(),
  ]);

  const total = (countRows[0] as { total: number }).total;

  return Response.json({ results, page, per_page: PER_PAGE, total });
};
