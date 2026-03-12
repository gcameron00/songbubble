/**
 * GET  /api/lyrics  — top 10 lyrics by decay-weighted vote score
 * POST /api/lyrics  — submit a new lyric
 */
import type { Env } from '../env.d.ts';
import { validateSubmission } from '../_lib/validate';

const DECAY_SECONDS = 7 * 24 * 60 * 60; // 604 800 s = 7 days
const CHART_SIZE    = 10;

// Each vote contributes its own decayed value so fresh votes always count more
// than old ones, regardless of when other votes were cast.
const LEADERBOARD_SQL = `
  SELECT
    l.id,
    l.text,
    l.artist,
    l.song,
    l.created_at,
    CAST(ROUND(
      COALESCE(
        SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / CAST(? AS REAL))),
        0
      )
    ) AS INTEGER) AS score
  FROM lyrics l
  LEFT JOIN votes v ON v.lyric_id = l.id
  GROUP BY l.id
  ORDER BY score DESC
  LIMIT ?
`;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(LEADERBOARD_SQL)
    .bind(DECAY_SECONDS, CHART_SIZE)
    .all();

  return Response.json(results, {
    headers: { 'Cache-Control': 'public, max-age=30' },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text, artist, song } = body as Record<string, string>;

  const errors = validateSubmission(text ?? '', artist ?? '', song ?? '');
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 422 });
  }

  const t = text.trim(), a = artist.trim(), s = song.trim();

  const { meta } = await env.DB.prepare(
    'INSERT INTO lyrics (text, artist, song) VALUES (?, ?, ?)',
  )
    .bind(t, a, s)
    .run();

  return Response.json(
    { id: meta.last_row_id, lyric: { id: meta.last_row_id, text: t, artist: a, song: s, score: 0 } },
    { status: 201 },
  );
};
