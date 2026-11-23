// Supabase Edge Function `hg-card` (Heavy Gold, backend g2): the share card behind Telegram's shareToStory(url, ...).
//   GET  /functions/v1/hg-card?id=<uuid>      → 200 image/png, cached a day (a card never changes); 404 when there is no such card
//   GET  /functions/v1/hg-card/<uuid>.png     → the same (a path form, for clients that want a file name)
//   HEAD the same without a body · OPTIONS → 204 · anything else → 405. CORS is open (Access-Control-Allow-Origin: *).
//   Every answer carries X-Content-Type-Options: nosniff, so a browser never reads a card as anything but image/png.
// Deploy with verify_jwt = false (`supabase functions deploy hg-card --no-verify-jwt`): Telegram fetches the image with no
// Authorization header. The card is read with the service role through the REST API: POST /rest/v1/rpc/hg_card_get {id} →
// the PNG as base64 text, or null (hg_card_get is executable by service_role only; backend/holdor_g2.sql, which stores the cards
// with hg_card_put). The key never leaves this function, nothing is logged, and an upstream error says nothing about it.
// Local test: backend/test/g2_test.py imports makeHandler under Node (types are erasable) with a fake REST server.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];   // the PNG signature
const CORS: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'X-Content-Type-Options': 'nosniff' };
type Env = { url: string; key: string };
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const plain = (status: number, text: string): Response =>
  new Response(text, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

// the card id from ?id= or from the path's last part (with or without .png)
export function cardId(u: URL): string {
  const q = u.searchParams.get('id');
  if (q !== null) return q.trim();
  const m = /\/hg-card\/([^/]+?)(?:\.png)?\/?$/i.exec(u.pathname);
  return m ? decodeURIComponent(m[1]) : '';
}

export function makeHandler(env: Env, f: Fetch = fetch) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'method not allowed');
    let id = '';
    try { id = cardId(new URL(req.url)); } catch (_e) { id = ''; }
    if (!UUID.test(id)) return plain(404, 'not found');
    let r: Response;
    try {
      r = await f(env.url + '/rest/v1/rpc/hg_card_get', {
        method: 'POST',
        headers: { apikey: env.key, Authorization: 'Bearer ' + env.key, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: id.toLowerCase() }),
      });
    } catch (_e) { return plain(503, 'unavailable'); }
    if (!r.ok) return plain(502, 'unavailable');
    let b64: unknown = null;
    try { b64 = await r.json(); } catch (_e) { return plain(502, 'unavailable'); }
    if (typeof b64 !== 'string' || b64 === '') return plain(404, 'not found');
    let bin: Uint8Array;
    try { bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); } catch (_e) { return plain(502, 'unavailable'); }
    if (bin.length < SIG.length || SIG.some((v, i) => bin[i] !== v)) return plain(404, 'not found');   // only a PNG is ever served
    const headers = { ...CORS, 'Content-Type': 'image/png', 'Content-Length': String(bin.length), 'Cache-Control': 'public, max-age=86400, immutable' };
    return new Response(req.method === 'HEAD' ? null : bin, { status: 200, headers });
  };
}

// Deno (Supabase Edge Runtime) serves it; under Node (the local test) nothing starts on import
const D = (globalThis as any).Deno;
if (D && typeof D.serve === 'function') {
  const handle = makeHandler({ url: D.env.get('SUPABASE_URL'), key: D.env.get('SUPABASE_SERVICE_ROLE_KEY') });
  D.serve((req: Request) => handle(req));
}
