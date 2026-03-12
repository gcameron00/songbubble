/**
 * GET    /api/votes  — return lyric IDs voted for today by this browser
 * POST   /api/votes  — cast a vote for a lyric
 * DELETE /api/votes  — retract a vote cast today
 *
 * Anonymous identity: a UUID is generated on first visit and stored in the
 * `lb_fp` cookie (1-year expiry). It is never linked to any personal data.
 *
 * Rules enforced here (and at DB level via UNIQUE index):
 *   - Max VOTES_PER_DAY votes per fingerprint per calendar day.
 *   - One vote per fingerprint per lyric, ever.
 *   - Retraction is only permitted for votes cast on the current calendar day.
 */
import type { Env } from '../env.d.ts';

const VOTES_PER_DAY = 5;
const COOKIE_NAME   = 'lb_fp';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function getFingerprint(request: Request): { fp: string; isNew: boolean } {
  const cookie = request.headers.get('cookie') ?? '';
  const match  = cookie.match(/lb_fp=([a-f0-9-]{36})/);
  if (match) return { fp: match[1], isNew: false };
  return { fp: crypto.randomUUID(), isNew: true };
}

function startOfTodayUtc(): number {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { fp, isNew } = getFingerprint(request);
  if (isNew) return Response.json({ voted_today: [], voted_ever: [] });

  const [todayResult, everResult] = await Promise.all([
    env.DB.prepare(
      'SELECT lyric_id FROM votes WHERE fingerprint = ? AND vote_day = ?',
    ).bind(fp, todayUtc()).all(),
    env.DB.prepare(
      'SELECT DISTINCT lyric_id FROM votes WHERE fingerprint = ?',
    ).bind(fp).all(),
  ]);

  return Response.json({
    voted_today: todayResult.results.map((r: Record<string, unknown>) => r.lyric_id),
    voted_ever:  everResult.results.map((r: Record<string, unknown>) => r.lyric_id),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { lyric_id } = body as Record<string, number>;
  if (!lyric_id || typeof lyric_id !== 'number') {
    return Response.json({ error: 'lyric_id (number) is required' }, { status: 400 });
  }

  const { fp, isNew } = getFingerprint(request);

  // Check daily budget.
  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM votes WHERE fingerprint = ? AND created_at >= ?',
  )
    .bind(fp, startOfTodayUtc())
    .all();

  const usedToday = (results[0] as { count: number }).count;
  if (usedToday >= VOTES_PER_DAY) {
    return Response.json(
      { error: 'Daily vote limit reached', remaining: 0 },
      { status: 429 },
    );
  }

  // Insert vote — UNIQUE index prevents double-voting the same lyric on the same day.
  try {
    await env.DB.prepare(
      'INSERT INTO votes (lyric_id, fingerprint, vote_day) VALUES (?, ?, ?)',
    )
      .bind(lyric_id, fp, todayUtc())
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return Response.json({ error: 'Already voted for this lyric today' }, { status: 409 });
    }
    throw err;
  }

  const remaining = VOTES_PER_DAY - usedToday - 1;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isNew) {
    headers['Set-Cookie'] =
      `${COOKIE_NAME}=${fp}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
  }

  return Response.json({ ok: true, remaining }, { headers });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { lyric_id } = body as Record<string, number>;
  if (!lyric_id || typeof lyric_id !== 'number') {
    return Response.json({ error: 'lyric_id (number) is required' }, { status: 400 });
  }

  const { fp, isNew } = getFingerprint(request);

  // No cookie means this browser has never voted — nothing to retract.
  if (isNew) {
    return Response.json({ error: 'No retractable vote found' }, { status: 404 });
  }

  // Only allow retraction if the vote was cast today.
  const { results } = await env.DB.prepare(
    'SELECT id FROM votes WHERE lyric_id = ? AND fingerprint = ? AND vote_day = ?',
  )
    .bind(lyric_id, fp, todayUtc())
    .all();

  if (results.length === 0) {
    return Response.json({ error: 'No retractable vote found' }, { status: 404 });
  }

  await env.DB.prepare(
    'DELETE FROM votes WHERE lyric_id = ? AND fingerprint = ? AND vote_day = ?',
  )
    .bind(lyric_id, fp, todayUtc())
    .run();

  // Return updated remaining budget so the client can sync.
  const { results: todayVotes } = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM votes WHERE fingerprint = ? AND created_at >= ?',
  )
    .bind(fp, startOfTodayUtc())
    .all();

  const usedToday = (todayVotes[0] as { count: number }).count;
  return Response.json({ ok: true, remaining: Math.max(0, VOTES_PER_DAY - usedToday) });
};
