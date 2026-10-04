// The bot's own messages (backend/edge/stars/handler.js): /start, /play and /help in a private chat, with a fake database and a fake
// Telegram. No network, no token: the fake answers pay_secret with test values and records every Telegram call.
import { makeHandler, botCommand } from '../edge/stars/handler.js';
const TOKEN = '123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz', HOOK = 'hook-secret-1';
let calls = [], photoFails = false, tgDown = false, digests = [];
const SECRETS = { bot_token: TOKEN, webhook_secret: HOOK, digest_code: 'dig-1', channel_en: '@holdor_news', channel_ka: '@holdor_ge' };
const DIG = { 'day:en': { ok: true, text: "⚔️ Yesterday's Hold top-2\n\n1. Arya — 41 🌊\n2. Bran — 30 🌊" }, 'day:ka': { ok: true, text: '⚔️ გუშინდელი Hold-ის ტოპ-2' }, 'war:en': { ok: false, why: 'no realm fought last week' } };
const f = async (url, init) => {
  const body = init && init.body ? JSON.parse(init.body) : {};
  if (url.includes('/rest/v1/rpc/pay_secret')) return new Response(JSON.stringify(SECRETS[body.k] === undefined ? null : SECRETS[body.k]), { status: 200 });
  if (url.includes('/rest/v1/rpc/bot_digest')) { digests.push(body); return new Response(JSON.stringify(DIG[body.kind + ':' + body.lang] || { ok: false, why: 'nothing' }), { status: 200 }); }
  if (url.includes('/rest/v1/rpc/')) return new Response('{}', { status: 200 });
  const m = /\/bot([^/]+)\/(\w+)$/.exec(url);
  if (tgDown) throw new Error('down');
  calls.push({ method: m[2], tokOk: m[1] === TOKEN, body });
  if (m[2] === 'sendPhoto' && photoFails) return new Response(JSON.stringify({ ok: false, description: 'Bad Request: wrong file identifier/HTTP URL specified' }), { status: 400 });
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
};
const handle = makeHandler({ url: 'http://db', key: 'svc' }, f);
const upd = (text, o = {}) => ({ update_id: Math.floor(Math.random() * 1e9), message: { message_id: 1, text, chat: { id: 555, type: o.type || 'private' }, from: { id: 555, language_code: o.lang || 'en' } } });
const post = async (b, secret = HOOK) => { const r = await handle(new Request('http://fn/', { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(b) })); return { status: r.status, body: await r.json() }; };
const fails = []; const check = (name, cond, info = '') => { console.log((cond ? 'OK  ' : 'FAIL'), name, cond ? '' : JSON.stringify(info)); if (!cond) fails.push(name); };
const last = () => calls[calls.length - 1];
const url = c => c && c.body.reply_markup && c.body.reply_markup.inline_keyboard[0][0].url;

calls = []; let r = await post(upd('/start'));
check('/start: one photo with the welcome and a Play button (English for an English user)', r.status === 200 && calls.length === 1 && last().method === 'sendPhoto' && last().tokOk && /Welcome, defender/.test(last().body.caption) && /bot_banner_1280x720\.png$/.test(last().body.photo) && last().body.chat_id === 555, calls);
check('the button opens the Mini App with startapp=s_bot (a plain /start)', url(last()) === 'https://t.me/HoldorTDBot/play?startapp=s_bot', url(last()));
calls = []; await post(upd('/start s_x', { lang: 'ka' }));
check('a deep link carries its payload into the Mini App (s_x) and a Georgian user gets Georgian', url(last()) === 'https://t.me/HoldorTDBot/play?startapp=s_x' && /კეთილი იყოს/.test(last().body.caption) && /თამაში უფასოა/.test(last().body.reply_markup.inline_keyboard[0][0].text), last());
calls = []; await post(upd('/start d_ab12cd34')); const d1 = url(last()); calls = []; await post(upd('/start r_0011aabb')); const d2 = url(last());
check('a duel code and an invitation code survive the same way', d1.endsWith('startapp=d_ab12cd34') && d2.endsWith('startapp=r_0011aabb'), [d1, d2]);
calls = []; await post(upd('/start <script>'));
check('a payload with odd characters becomes s_bot (nothing unsafe in the link)', url(last()).endsWith('startapp=s_bot'), url(last()));
calls = []; await post(upd('/play@HoldorTDBot'));
check('/play (also with @bot) answers like /start', last().method === 'sendPhoto' && url(last()).endsWith('startapp=s_bot'));
calls = []; await post(upd('/help'));
check('/help: a short how-to as text, with the same Play button', last().method === 'sendMessage' && /How to play/.test(last().body.text) && url(last()).endsWith('startapp=s_bot'));
calls = []; await post(upd('/start', { type: 'group' })); await post(upd('hello there'));
check('a group chat and a plain message get no answer', calls.length === 0, calls);
calls = []; r = await post(upd('/start'), 'wrong');
check('an update without the webhook secret is refused (401) and nothing is sent', r.status === 401 && calls.length === 0);
photoFails = true; calls = []; r = await post(upd('/start'));
check('if Telegram cannot fetch the picture, the welcome goes as text', r.status === 200 && calls.map(c => c.method).join() === 'sendPhoto,sendMessage' && /Welcome/.test(last().body.text), calls.map(c => c.method));
photoFails = false; tgDown = true; r = await post(upd('/start'));
check('Telegram down: the update still answers 200 (no retry storm)', r.status === 200 && r.body.ok === true);
tgDown = false;
check('botCommand: only private chats, only the three commands', botCommand({ text: '/start', chat: { type: 'private' } }).cmd === 'start' && botCommand({ text: '/shop', chat: { type: 'private' } }) === null && botCommand({ text: '/start', chat: { type: 'supergroup' } }) === null && botCommand(null) === null);
// the schedule's digests (backend v28)
const dpost = async (b) => { const r = await handle(new Request('http://fn/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })); return { status: r.status, body: await r.json() }; };
calls = []; r = await dpost({ op: 'digest', kind: 'day', code: 'wrong' });
check('a digest without the right code is refused (403) and nothing is posted', r.status === 403 && calls.length === 0);
calls = []; r = await dpost({ op: 'digest', kind: 'day', code: 'dig-1' });
check('the day digest goes to both channels as plain text, the database\'s own text', r.status === 200 && calls.length === 2 && calls[0].body.chat_id === '@holdor_news' && /Arya — 41/.test(calls[0].body.text) && calls[1].body.chat_id === '@holdor_ge' && !calls[0].body.parse_mode && calls[0].body.disable_web_page_preview === true, calls);
calls = []; r = await dpost({ op: 'digest', kind: 'war', code: 'dig-1' });
check('nothing to report (no realm fought): nothing is posted, the answer says why', calls.length === 0 && r.body.sent[0].skipped === 'no realm fought last week', r.body);
delete SECRETS.channel_ka; calls = [];   // a fresh handler: the secrets are cached for a minute
{ const h2 = makeHandler({ url: 'http://db', key: 'svc' }, f); await h2(new Request('http://fn/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'digest', kind: 'day', code: 'dig-1' }) })); }
check('a channel that is not set is skipped', calls.length === 1 && calls[0].body.chat_id === '@holdor_news');
r = await dpost({ op: 'digest', kind: 'other', code: 'dig-1' });
check('an unknown kind is refused', r.status === 400);
const flat = JSON.stringify(calls);
check('the token never appears in what is sent', !flat.includes(TOKEN));
console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'all bot checks OK'); process.exit(fails.length ? 1 : 0);
