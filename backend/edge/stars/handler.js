// Telegram Stars for HOLDOR (game v1.0.60, backend v9). One Supabase Edge Function, three jobs:
//   POST {op:'invoice', token, seat, sku}  the app asks for an invoice link (the server records the order, Telegram makes the link)
//   POST <Telegram update>                 pre_checkout_query → "may I take the Stars?", successful_payment → credit, refunded_payment → take back
//   GET  ?setup=<one-time code>            points the bot's webhook at this function (the code lives in app_secrets and is deleted after use)
// Money never moves here: every decision is a SQL function (pay_*) that only the service key may call. The bot token is read from
// app_secrets per request and is never logged or returned; error text is scrubbed of it.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
class Rpc extends Error { constructor(m, status) { super(m); this.status = status; } }

export function makeHandler(env, f = fetch) {
  const tgBase = env.tgBase || 'https://api.telegram.org';
  const cache = new Map();
  async function rpc(fn, args) {
    let r;
    try { r = await f(env.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: env.key, Authorization: 'Bearer ' + env.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }); }
    catch (e) { throw new Rpc('database unreachable', 503); }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
    if (!r.ok) throw new Rpc((j && (j.message || j.error)) || ('rpc ' + r.status), r.status);
    return j;
  }
  async function secret(k) {
    const c = cache.get(k); if (c && Date.now() - c.t < 60000) return c.v;
    const v = await rpc('pay_secret', { k }); cache.set(k, { v, t: Date.now() }); return v;
  }
  async function tg(method, body) {
    const tok = await secret('bot_token');
    if (!tok || /^PASTE/.test(tok)) throw new Error('the bot token is not set');
    let r, j;
    try { r = await f(tgBase + '/bot' + tok + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); j = await r.json(); }
    catch (e) { throw new Error('telegram unreachable'); }
    if (!j || !j.ok) throw new Error('telegram: ' + String((j && j.description) || r.status).split(tok).join('***'));
    return j.result;
  }
  const bad = e => e instanceof Rpc && e.status >= 400 && e.status < 500;   // the order is wrong: no use retrying
  const clean = e => String((e && e.message) || e).slice(0, 160);

  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      if (req.method === 'GET') {
        const code = url.searchParams.get('setup');
        if (!code) return reply({ ok: true, name: 'holdor-stars' });
        const want = await secret('setup_code');
        if (!want || code !== want) return reply({ ok: false, error: 'no' }, 403);
        const hook = await secret('webhook_secret');
        await tg('setWebhook', { url: env.url + '/functions/v1/stars', secret_token: hook, allowed_updates: ['pre_checkout_query', 'message'] });
        await rpc('pay_setup_done'); cache.delete('setup_code');
        return reply({ ok: true, webhook: 'set' });
      }
      if (req.method !== 'POST') return reply({ error: 'method' }, 405);
      let b; try { b = await req.json(); } catch (e) { return reply({ error: 'bad body' }, 400); }
      if (!b || typeof b !== 'object') return reply({ error: 'bad body' }, 400);

      // ---- the app: an invoice for one item on one seat ----
      if (b.op === 'invoice') {
        if (typeof b.token !== 'string' || typeof b.sku !== 'string' || !Number.isInteger(b.seat)) return reply({ error: 'bad request' }, 400);
        let it;
        try { it = await rpc('pay_create', { token: b.token, seat: b.seat, sku: b.sku }); }
        catch (e) { return bad(e) ? reply({ error: clean(e) }, 400) : reply({ error: 'the server is busy, try again' }, 503); }
        try {
          const link = await tg('createInvoiceLink', { title: String(it.title).slice(0, 32), description: String(it.description).slice(0, 255), payload: it.id, currency: 'XTR', prices: [{ label: String(it.title).slice(0, 32), amount: it.stars }] });
          return reply({ ok: true, link, id: it.id, stars: it.stars });
        } catch (e) { return reply({ error: 'Telegram could not make the invoice: ' + clean(e) }, 502); }
      }

      // ---- Telegram ----
      if ('update_id' in b) {
        const hook = await secret('webhook_secret');
        if (!hook || req.headers.get('x-telegram-bot-api-secret-token') !== hook) return reply({ error: 'no' }, 401);
        const q = b.pre_checkout_query;
        if (q) {
          let r = { ok: false, why: 'unknown order' };
          try { r = await rpc('pay_precheck', { id: q.invoice_payload, tg: q.from && q.from.id, stars: q.total_amount, currency: q.currency }); }
          catch (e) { if (!bad(e)) return reply({ error: 'retry' }, 503); }
          await tg('answerPreCheckoutQuery', r && r.ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: String((r && r.why) || 'This order cannot be paid').slice(0, 200) });
          return reply({ ok: true });
        }
        const m = b.message;
        if (m && m.successful_payment) {
          const p = m.successful_payment;
          try { await rpc('pay_confirm', { id: p.invoice_payload, tg: m.from && m.from.id, stars: p.total_amount, currency: p.currency, charge: p.telegram_payment_charge_id }); }
          catch (e) { if (!bad(e)) return reply({ error: 'retry' }, 503); }   // a wrong order is dropped; a database problem is retried by Telegram
          return reply({ ok: true });
        }
        if (m && m.refunded_payment) {
          try { await rpc('pay_refund', { charge: m.refunded_payment.telegram_payment_charge_id }); }
          catch (e) { if (!bad(e)) return reply({ error: 'retry' }, 503); }
          return reply({ ok: true });
        }
        return reply({ ok: true });   // any other update is not ours
      }
      return reply({ error: 'bad request' }, 400);
    } catch (e) {
      return reply({ error: 'failed: ' + clean(e) }, 500);
    }
  };
}
