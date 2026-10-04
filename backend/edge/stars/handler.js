// Telegram Stars for HOLDOR (game v1.0.60, backend v9) and the bot's own messages. One Supabase Edge Function, four jobs:
//   POST {op:'invoice', token, seat, sku}  the app asks for an invoice link (the server records the order, Telegram makes the link)
//   POST <Telegram update>                 pre_checkout_query → "may I take the Stars?", successful_payment → credit, refunded_payment → take back
//   GET  ?setup=<one-time code>            points the bot's webhook at this function (the code lives in app_secrets and is deleted after use)
//   POST <Telegram update: /start /play /help in a private chat>   the welcome: the banner, two lines in the player's language
//        (Georgian for `ka`, English otherwise) and a ▶ Play button that opens the Mini App and carries the deep-link payload
//        (`t.me/HoldorTDBot?start=s_x` → `startapp=s_x`, so the source / duel / invitation code survives). Nothing is stored.
//   POST {op:'digest', kind:'day'|'war', code}  the schedule (pg_cron, backend v28) asks for the channel posts: the text is the database's
//        own (bot_digest), sent as plain text to the channels set in app_secrets (channel_en / channel_ka); the code is app_secrets digest_code.
//   POST {op:'remind', code}  (backend v29) the hourly schedule: ONE message, with a ▶ Play button, to each person who pressed /start
//        24–72 hours ago and never opened the game; whoever blocked the bot is marked and never written to again. /start notes the
//        person (bot_seen) for this; nothing else is kept.
//   POST {op:'refgift', code}  (backend v30) the hourly schedule: ONE message to each inviter whose friends (joined by his link) have
//        cleared the stages, naming them, with a ▶ Play button; the friends are marked so the same news never comes twice.
// Money never moves here: every decision is a SQL function (pay_*) that only the service key may call. The bot token is read from
// app_secrets per request and is never logged or returned; error text is scrubbed of it.
const BOT = 'HoldorTDBot';
const ART = 'https://bekagnp-design.github.io/holdor/docs/marketing/bot_banner_1280x720.png';
const TXT = {
  en: { gift: n => '🎁 Your friend' + (n.length > 1 ? 's ' : ' ') + n.join(', ') + (n.length > 1 ? ' have' : ' has') + ' cleared the first stages.\n\nYour invitation gift is waiting: Tasks → Friends → Claim.', remind: '🚪 The door is still open.\n\nThe dead are waiting, defender. The first battle takes two minutes.', start: '🚪 Welcome, defender!\n\nThe dead are at the gate and you are the last wall. Build towers, lead your champion, and hold the door.\n\nTap PLAY — the first battle takes two minutes.',
        help: '⚔️ How to play\n\n1. Tap a free spot on the road side to build a tower.\n2. Tap a tower to upgrade or sell it.\n3. Move your champion where the dead break through.\n4. Hold the gate until the last wave.\n\nEvery day: the Hold. Every week: your country\'s war.', play: '▶ Play free' },
  ka: { gift: n => '🎁 შენმა ' + (n.length > 1 ? 'მეგობრებმა ' : 'მეგობარმა ') + n.join(', ') + ' პირველი ეტაპები გაიარ' + (n.length > 1 ? 'ეს' : 'ა') + '.\n\nმოწვევის საჩუქარი გელოდება: Tasks → Friends → Claim.', remind: '🚪 კარი ჯერ კიდევ ღიაა.\n\nმკვდრები ელოდებიან, დამცველო. პირველი ბრძოლა ორ წუთს გრძელდება.', start: '🚪 კეთილი იყოს შენი მობრძანება, დამცველო!\n\nმკვდრები კართან არიან და შენ ბოლო კედელი ხარ. ააშენე კოშკები, უხელმძღვანელე ჩემპიონს და დაიცავი კარი.\n\nდააჭირე PLAY-ს — პირველი ბრძოლა ორ წუთს გრძელდება.',
        help: '⚔️ როგორ ვითამაშო\n\n1. გზის პირას თავისუფალ ადგილზე დააჭირე და ააშენე კოშკი.\n2. კოშკზე დაჭერით გააძლიერებ ან გაყიდი.\n3. ჩემპიონი იქ გადაიყვანე, სადაც მკვდრები გაარღვევენ.\n4. გაუძელი კარს ბოლო ტალღამდე.\n\nყოველდღე: Hold. ყოველ კვირას: შენი ქვეყნის ომი.', play: '▶ თამაში უფასოა' } };
// a command in a private chat: which one, the payload to carry into the Mini App, the language
export function botCommand(m) {
  if (!m || typeof m.text !== 'string' || !m.chat || m.chat.type !== 'private') return null;
  const c = /^\/(start|play|help)(?:@\w+)?(?:\s+(\S+))?\s*$/.exec(m.text.trim());
  if (!c) return null;
  const arg = c[2] || '';
  const lang = /^ka/i.test((m.from && m.from.language_code) || '') ? 'ka' : 'en';
  return { cmd: c[1], start: /^[A-Za-z0-9_-]{1,64}$/.test(arg) ? arg : 's_bot', lang };
}
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

      // ---- the schedule: real results into the channels ----
      if (b.op === 'digest') {
        const want = await secret('digest_code');
        if (!want || typeof b.code !== 'string' || b.code !== want) return reply({ ok: false, error: 'no' }, 403);
        if (b.kind !== 'day' && b.kind !== 'war') return reply({ error: 'bad kind' }, 400);
        const sent = [];
        for (const lang of ['en', 'ka']) {
          const chat = await secret('channel_' + lang); if (!chat) continue;
          let d; try { d = await rpc('bot_digest', { kind: b.kind, lang }); } catch (e) { sent.push({ lang, error: clean(e) }); continue; }
          if (!d || !d.ok) { sent.push({ lang, skipped: (d && d.why) || 'nothing' }); continue; }
          try { await tg('sendMessage', { chat_id: chat, text: String(d.text).slice(0, 4000), disable_web_page_preview: true }); sent.push({ lang, ok: true }); }
          catch (e) { sent.push({ lang, error: clean(e) }); }
        }
        return reply({ ok: true, sent });
      }

      // ---- the schedule: one reminder to those who started the bot and never played ----
      if (b.op === 'remind') {
        const want = await secret('digest_code');
        if (!want || typeof b.code !== 'string' || b.code !== want) return reply({ ok: false, error: 'no' }, 403);
        const due = (await rpc('bot_remind_due', { lim: 50 })) || [];
        let sent = 0, blocked = 0, failed = 0;
        for (const d of due) {
          const t = TXT[d.lang === 'ka' ? 'ka' : 'en'];
          try { await tg('sendMessage', { chat_id: d.tg, text: t.remind, reply_markup: { inline_keyboard: [[{ text: t.play, url: 'https://t.me/' + BOT + '/play?startapp=s_remind' }]] } });
                await rpc('bot_reminded', { tg: d.tg, blocked: false }); sent++; }
          catch (e) {
            if (/blocked|deactivated|chat not found|403/i.test(String(e && e.message))) { await rpc('bot_reminded', { tg: d.tg, blocked: true }); blocked++; }
            else failed++;   // Telegram is busy: the next hour tries again
          }
        }
        return reply({ ok: true, due: due.length, sent, blocked, failed });
      }

      // ---- the schedule: tell an inviter that a friend's gift is ready (backend v30) ----
      if (b.op === 'refgift') {
        const want = await secret('digest_code');
        if (!want || typeof b.code !== 'string' || b.code !== want) return reply({ ok: false, error: 'no' }, 403);
        const due = (await rpc('bot_ref_due', { lim: 50 })) || [];
        let sent = 0, blocked = 0, failed = 0;
        for (const d of due) {
          const t = TXT[d.lang === 'ka' ? 'ka' : 'en'], names = (d.names || []).slice(0, 5).map(String);
          if ((d.names || []).length > 5) names.push('…');
          try { await tg('sendMessage', { chat_id: d.tg, text: t.gift(names), reply_markup: { inline_keyboard: [[{ text: t.play, url: 'https://t.me/' + BOT + '/play?startapp=s_refgift' }]] } });
                await rpc('bot_ref_notified', { tg: d.tg, friends: d.friends, blocked: false }); sent++; }
          catch (e) {
            // blocked, or never started the bot (Telegram does not let a bot write first): mark, so it is not tried every hour
            if (/blocked|deactivated|chat not found|initiate|403/i.test(String(e && e.message))) { await rpc('bot_ref_notified', { tg: d.tg, friends: d.friends, blocked: /blocked|deactivated/i.test(String(e && e.message)) }); blocked++; }
            else failed++;
          }
        }
        return reply({ ok: true, due: due.length, sent, blocked, failed });
      }

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
        const cmd = botCommand(m);
        if (cmd) {   // the welcome never fails the update: Telegram must not retry a greeting
          try { await rpc('bot_seen', { tg: m.from && m.from.id, lang: cmd.lang, start: cmd.start }); } catch (e) { /* a note for the reminder: not worth failing for */ }
          const t = TXT[cmd.lang], kb = { inline_keyboard: [[{ text: t.play, url: 'https://t.me/' + BOT + '/play?startapp=' + cmd.start }]] };
          try {
            if (cmd.cmd === 'help') await tg('sendMessage', { chat_id: m.chat.id, text: t.help, reply_markup: kb });
            else {
              try { await tg('sendPhoto', { chat_id: m.chat.id, photo: ART, caption: t.start, reply_markup: kb }); }
              catch (e) { await tg('sendMessage', { chat_id: m.chat.id, text: t.start, reply_markup: kb }); }   // the picture could not be fetched
            }
          } catch (e) { /* the player blocked the bot, or Telegram is down: nothing to do */ }
          return reply({ ok: true });
        }
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
