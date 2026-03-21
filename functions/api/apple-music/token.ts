import type { Env } from '../../env.d.ts';

/** Base64url-encode an ArrayBuffer. */
function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Base64url-encode a plain string. */
function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 15_777_000; // 6 months in seconds

  const header  = base64urlStr(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID }));
  const payload = base64urlStr(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: now, exp }));
  const signingInput = `${header}.${payload}`;

  // Strip PEM envelope and whitespace to get the raw base64 key bytes.
  const pemBody = env.APPLE_MUSIC_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')   // literal \n from .dev.vars dotenv format
    .replace(/\s+/g, '');  // actual whitespace / newlines

  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const token = `${signingInput}.${base64url(signature)}`;

  return Response.json({ token }, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg, keyLength: env.APPLE_MUSIC_PRIVATE_KEY?.length ?? 0 }, { status: 500 });
  }
};
