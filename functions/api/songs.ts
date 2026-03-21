/**
 * GET  /api/songs       — top 10 songs by decay-weighted vote score
 * GET  /api/songs?q=…   — full-catalogue search (up to 50 results, with scores)
 * POST /api/songs       — submit a new song
 */
import type { Env } from '../env.d.ts';
import { validateSubmission } from '../_lib/validate';

const DECAY_SECONDS = 28 * 24 * 60 * 60; // 2 419 200 s = 28 days
const CHART_SIZE    = 10;
const SEARCH_LIMIT  = 50;

const SCORE_FRAGMENT = `
  CAST(ROUND(
    COALESCE(
      SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / CAST(? AS REAL))),
      0
    )
  ) AS INTEGER) AS score
`;

// Each vote contributes its own decayed value so fresh votes always count more
// than old ones, regardless of when other votes were cast.
const LEADERBOARD_SQL = `
  SELECT s.id, s.title, s.artist, s.album, s.apple_music_id, s.artwork_url, s.created_at, ${SCORE_FRAGMENT}
  FROM songs s
  LEFT JOIN votes v ON v.song_id = s.id
  GROUP BY s.id
  ORDER BY score DESC
  LIMIT ?
`;

const SEARCH_SQL = `
  SELECT s.id, s.title, s.artist, s.album, s.apple_music_id, s.artwork_url, s.created_at, ${SCORE_FRAGMENT}
  FROM songs s
  LEFT JOIN votes v ON v.song_id = s.id
  WHERE LOWER(s.title)  LIKE '%' || LOWER(?) || '%'
     OR LOWER(s.artist) LIKE '%' || LOWER(?) || '%'
     OR LOWER(s.album)  LIKE '%' || LOWER(?) || '%'
  GROUP BY s.id
  ORDER BY score DESC
  LIMIT ?
`;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (q) {
    const { results } = await env.DB.prepare(SEARCH_SQL)
      .bind(DECAY_SECONDS, q, q, q, SEARCH_LIMIT)
      .all();
    return Response.json(results);
  }

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

  const { title, artist, album, apple_music_id, artwork_url } = body as Record<string, string>;

  // If submitted from Apple Music catalogue, check for an existing record first.
  if (apple_music_id) {
    const existing = await env.DB.prepare(
      'SELECT id, title, artist, album FROM songs WHERE apple_music_id = ?',
    ).bind(apple_music_id).first<{ id: number; title: string; artist: string; album: string | null }>();

    if (existing) {
      return Response.json({
        id: existing.id,
        song: { id: existing.id, title: existing.title, artist: existing.artist, album: existing.album, score: 0, apple_music_id },
      });
    }
  }

  const errors = validateSubmission(title ?? '', artist ?? '', album ?? '');
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 422 });
  }

  const t  = title.trim();
  const a  = artist.trim();
  const al = album?.trim() || null;
  const am = apple_music_id?.trim() || null;
  const aw = artwork_url?.trim() || null;

  const { meta } = await env.DB.prepare(
    'INSERT INTO songs (title, artist, album, apple_music_id, artwork_url) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(t, a, al, am, aw)
    .run();

  return Response.json(
    { id: meta.last_row_id, song: { id: meta.last_row_id, title: t, artist: a, album: al, score: 0, apple_music_id: am } },
    { status: 201 },
  );
};
