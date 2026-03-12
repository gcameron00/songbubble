import type { Env } from '../env.d.ts';

export const onRequestGet: PagesFunction<Env> = () => {
  return Response.json({ ok: true });
};
