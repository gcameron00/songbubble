/**
 * GET  /api/songs  — top 10 songs by decay-weighted vote score
 * POST /api/songs  — submit a new song
 */
import type { Env } from '../env.d.ts';
import { validateSubmission } from '../_lib/validate';

const DECAY_SECONDS = 28 * 24 * 60 * 60; // 2 419 200 s = 28 days
const CHART_SIZE    = 10;

// Each vote contributes its own decayed value so fresh votes always count more
// than old ones, regardless of when other votes were cast.
const LEADERBOARD_SQL = `
  SELECT
    s.id,
    s.title,
    s.artist,
    s.album,
    s.created_at,
    CAST(ROUND(
      COALESCE(
        SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / CAST(? AS REAL))),
        0
      )
    ) AS INTEGER) AS score
  FROM songs s
  LEFT JOIN votes v ON v.song_id = s.id
  GROUP BY s.id
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

  const { title, artist, album } = body as Record<string, string>;

  const errors = validateSubmission(title ?? '', artist ?? '', album ?? '');
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 422 });
  }

  const t = title.trim();
  const a = artist.trim();
  const al = album?.trim() || null;

  const { meta } = await env.DB.prepare(
    'INSERT INTO songs (title, artist, album) VALUES (?, ?, ?)',
  )
    .bind(t, a, al)
    .run();

  return Response.json(
    { id: meta.last_row_id, song: { id: meta.last_row_id, title: t, artist: a, album: al, score: 0 } },
    { status: 201 },
  );
};
