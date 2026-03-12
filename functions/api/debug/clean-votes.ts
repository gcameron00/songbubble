/**
 * POST /api/debug/clean-votes
 * Deletes all rows from the votes table. Lyrics are preserved.
 */
import type { Env } from '../../env.d.ts';

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const result = await env.DB.prepare('DELETE FROM votes').run();
  return Response.json({ ok: true, deleted: result.meta.changes });
};
