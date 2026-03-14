/**
 * POST /api/debug/reset
 * Deletes all rows from both the votes and songs tables.
 * Votes are deleted first to satisfy the foreign key constraint.
 */
import type { Env } from '../../env.d.ts';

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const votes = await env.DB.prepare('DELETE FROM votes').run();
  const songs = await env.DB.prepare('DELETE FROM songs').run();
  return Response.json({
    ok: true,
    votes_deleted: votes.meta.changes,
    songs_deleted: songs.meta.changes,
  });
};
