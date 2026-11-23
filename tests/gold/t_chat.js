// tests/gold/t_chat.js — Heavy Gold chat (35_chat.js) against a mocked server (page.route on the Supabase RPCs, a faked Telegram.WebApp):
// the 💬 Chat icon button (.ib) in #titleLinks, the unread dot from the closed 20 s poll (since-based; your own messages never light it), the full
// screen on the title (🌍 World + the country tab with flag and name), each message with flag, name, 👑, text and HH:MM, the 3 s poll
// with since while open, SEND with real taps, every server error in 1–3 English words ('rate' → "Too fast"), the 200-character cap,
// tabs, Report (⋯) and Block (long press), no Telegram id in the DOM, no HTML injection ('<img src=x onerror=alert(1)>' renders as
// text), the source never assigns innerHTML; during a round the round HUD button overlaps nothing, the docked panel leaves the hero
// and the free side uncovered (the joystick still drags there), the game keeps running, the round's end closes it; offline
// "Open in Telegram" with nothing sent; a failed login says "Offline" with ↻ Retry; every visible text short (GOLD.md "UI rules"); no profile; the layout at 390x844, 844x390
// and 640x360 (screenshots in .shots/gold_chat_*.png); the docked panel never covers the skill button (a tap there fires the skill);
// landscape with the keyboard up (844x170): the input and SEND stay inside the panel; a message hidden for everyone (3 reports)
// leaves the open chat at the next refresh from since 0 (FULL_MS); a full page of 50 after since replaces the stored list (no
// silent gap), a refresh keeps older stored messages and rebuilds nothing when nothing changed; closed during a round the unread
// poll is 3 × slower; gold stays conserved.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SRC = path.join(__dirname, '..', '..', 'src', 'gold', 'js', '35_chat.js');
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const TOKEN = '5d2c8e1a-7b3f-4a6e-9c10-2e4f6a8b0c13', TGID = 918273645, MSGTG = 7770001;
const ME = { name: 'Ann', country: 'GE' };
const ERRTXT = { rate: 'Too fast', too_long: 'Too long', empty: 'Empty', no_profile: 'No profile', bad_channel: 'Not your country', auth: 'Not signed in', http500: 'Offline' };
/* GOLD.md "UI rules": no visible text node longer than 40 characters in the chat panel, except message bodies and names */
const longTexts = pg => pg.evaluate(() => { const out = [], s = document.getElementById('hgChat'), wk = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); let n;
  while ((n = wk.nextNode())) { const t = n.textContent.trim(), e = n.parentElement; if (!t || !e || !e.getClientRects().length) continue;
    if (e.closest('.hgCmb,.hgCmh .n,#hgChMenu .q')) continue; if ([...t].length > 40) out.push(t); } return out; });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* the mocked server: tg_login, the profile, minimal boards, and hg_chat_* with the GOLD.md rules (every message also carries a tg_id the client must never show) */
async function setup(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, hasTouch: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const M = { calls: [], msgs: [], id: 0, profile: o.noProfile ? null : Object.assign({}, ME), blocked: [], reports: [], force: null, loginFail: !!o.loginFail, dialogs: [] };
  M.seed = (channel, name, country, body, extra) => { const m = Object.assign({ id: ++M.id, channel, name, country, body, at: new Date().toISOString(), crown: false, tg_id: MSGTG + M.id }, extra || {}); M.msgs.push(m); return m; };
  if (!o.empty) {
    M.seed('world', 'Giorgi', 'GE', 'Hello all', { crown: true }); M.seed('world', 'Marie', 'FR', 'Bonjour'); M.seed('world', 'Ann', 'GE', 'my own words');
    M.seed('c:GE', 'Luka', 'GE', 'gamarjoba'); M.seed('world', 'Carl', 'US', 'first from Carl'); M.seed('world', 'Carl', 'US', 'second from Carl');
  }
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { M.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await pg.route(/telegram\.org/, r => r.abort());
  await pg.route(/supabase\.co/, async route => {
    const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const mm = rq.url().match(/\/rest\/v1\/rpc\/(\w+)$/); if (!mm) return route.abort();
    const name = mm[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
    M.calls.push({ name, body, at: Date.now() });
    const send = (j, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(j) });
    if (name === 'tg_login') { if (M.loginFail) { await sleep(600); return send({ message: 'bad init data' }, 400); } return send({ token: TOKEN, tg_id: TGID, name: 'Ann' }); }
    if (!body || body.token !== TOKEN) return send({ message: 'bad session' }, 400);
    if (name === 'hg_profile_get') return send(M.profile ? { name: M.profile.name, country: M.profile.country } : {});
    if (name === 'hg_profile_set') { M.profile = { name: body.name, country: body.country }; return send({ ok: true, name: body.name, country: body.country }); }
    if (name === 'hg_board') return send({ scope: body.scope, since: '2026-11-23T00:00:00Z', players: [], me: null, countries: [], totals: { players: 0, rounds: 0 } });
    if (name === 'hg_round_submit') return send({ ok: true, week: { total: 10, best: 10, rounds: 1, rank: 1 } });
    const okCh = ch => ch === 'world' || (M.profile && ch === 'c:' + M.profile.country);
    const out = m => ({ id: m.id, name: m.name, country: m.country, body: m.body, at: m.at, mine: !!(M.profile && m.name === M.profile.name), crown: m.crown, tg_id: m.tg_id });
    if (name === 'hg_chat_list') {
      if (!okCh(body.channel)) return send({ error: 'bad_channel' });
      const since = +body.since || 0, bl = M.blocked.map(s => s.toLowerCase());
      const rows = M.msgs.filter(m => m.channel === body.channel && m.id > since && bl.indexOf(m.name.toLowerCase()) < 0 && M.reports.filter(r => r === m.id).length < 3).slice(-50).map(out);
      return send({ msgs: rows });
    }
    if (name === 'hg_chat_send') {
      if (M.force) { const f = M.force; M.force = null; if (f === 'http500') return send({ message: 'boom' }, 500); return send({ error: f }); }
      if (!M.profile) return send({ error: 'no_profile' });
      if (!okCh(body.channel)) return send({ error: 'bad_channel' });
      const t = String(body.body == null ? '' : body.body).replace(/[\u0000-\u001f\u007f]/g, '').trim();
      if (!t) return send({ error: 'empty' });
      if ([...t].length > 200) return send({ error: 'too_long' });
      const m = M.seed(body.channel, M.profile.name, M.profile.country, t);
      return send({ ok: true, msg: out(m) });
    }
    if (name === 'hg_chat_block') { M.blocked.push(String(body.name)); return send({ ok: true }); }
    if (name === 'hg_chat_report') { M.reports.push(+body.id); return send({ ok: true }); }
    return send({ message: 'no function ' + name }, 404);
  });
  if (o.tg !== false) await pg.addInitScript(([u, id]) => {
    const init = 'query_id=AAE1&user=' + encodeURIComponent(JSON.stringify(Object.assign({ id }, u))) + '&auth_date=1763900000&hash=0f1e2d3c4b5a69788796a5b4c3d2e1f0';
    window.Telegram = { WebApp: { initData: init, initDataUnsafe: { user: Object.assign({ id }, u) }, platform: 'android', version: '8.0', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {}, HapticFeedback: { impactOccurred() {} }, openTelegramLink() {} } };
  }, [{ first_name: 'Ann', language_code: 'en' }, TGID]);
  if (!o.noProfile) await pg.addInitScript(p => localStorage.setItem('hg_profile', JSON.stringify(p)), ME);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.net && G.chat && G.chat.open);
  if (o.tg !== false && !o.loginFail) await pg.waitForFunction(() => G.net.on, null, { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(300);
  const lists = ch => M.calls.filter(c => c.name === 'hg_chat_list' && (!ch || c.body.channel === ch));
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 5000)) { if (fn()) return true; await sleep(50); } return !!fn(); };
  return { ctx, pg, M, errs, n: nm => M.calls.filter(c => c.name === nm), lists, until };
}
/* GOLD.md "UI rules": the title fits with no scroll. Other modules' title parts are hidden here (each group checks its own), so this
   checks that this module's icon adds no scroll to the core's own layout (core = everything but Rules hidden) and keeps PLAY and
   the icons on screen in one row; the whole page's scroll is printed as INFO */
async function titleFit(pg, mine) {
  return pg.evaluate(ids => { const t = document.getElementById('title'), all = t.scrollHeight - t.clientHeight, hid = [];
    for (const box of ['titleExtra', 'titleLinks']) for (const c of document.getElementById(box).children) if (ids.indexOf(c.id) < 0 && c.id !== 'helpB' && c.style.display !== 'none') { hid.push(c); c.style.display = 'none'; }
    const own = t.scrollHeight - t.clientHeight;
    for (const id of ids) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; hid.push(e); } }
    const core = t.scrollHeight - t.clientHeight; for (const id of ids) { const e = document.getElementById(id); if (e) e.style.display = ''; }
    const r = id => { const q = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right) }; };
    const res = { all, own, core, play: r('play'), links: ids.concat('helpB').map(r), row: new Set(ids.concat('helpB').map(id => Math.round(document.getElementById(id).getBoundingClientRect().top))).size, H: innerHeight, W: innerWidth };
    for (const c of hid) c.style.display = ''; return res; }, mine);
}
const errHidden = pg => pg.evaluate(() => getComputedStyle(document.getElementById('err')).display === 'none');
const on = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; }, sel);
const rowsOf = pg => pg.evaluate(() => [...document.querySelectorAll('#hgChList .hgCm')].map(r => ({ id: +r.dataset.id, me: r.classList.contains('me'),
  f: (r.querySelector('.f') || {}).textContent || '', n: r.querySelector('.n').textContent, cr: !!r.querySelector('.cr'), t: (r.querySelector('.t') || {}).textContent || '', b: r.querySelector('.hgCmb').textContent, dots: !!r.querySelector('.hgCmo') })));
const msgLine = pg => pg.evaluate(() => { const e = document.getElementById('hgChMsg'); return { t: e.textContent, bad: e.classList.contains('bad') }; });
const R = (a, b) => a && b && a.width > 0 && b.width > 0 && a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
async function sendText(pg, text) { await pg.locator('#hgChIn').fill(text); await pg.locator('#hgChSend').tap(); await pg.waitForTimeout(300); }

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------- 0. the source never writes HTML ---------- */
  {
    const src = fs.readFileSync(SRC, 'utf8');
    const bad = src.match(/\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML|document\.write|DOMParser|createContextualFragment/g);
    ok(!bad, '35_chat.js never assigns innerHTML/outerHTML and never parses HTML (user text goes in with textContent)', bad);
  }

  /* ---------- 1. on the title in Telegram (390x844): the dot, the screen, polling with since, send, errors, tabs, report, block ---------- */
  {
    const T = await setup(b); const { pg, M } = T;
    const def = await pg.evaluate(() => ({ open: G.chat.OPEN_MS, closed: G.chat.CLOSED_MS, full: G.chat.FULL_MS, on: G.net.on }));
    ok(def.open === 3000 && def.closed === 20000 && def.full === 30000 && def.on, 'online; the chat polls every 3 s while open (a refresh from since 0 every 30 s) and every 20 s while closed (defaults)', def);
    const tb = await pg.evaluate(() => { const e = document.getElementById('hgChatBtn'), r = e.getBoundingClientRect(); return { in: e.parentElement.id, ib: e.classList.contains('ib'), i: e.querySelector('i').textContent, t: e.querySelector('span').textContent, h: r.height, w: r.width, dot: !e.querySelector('.hgDot').hidden }; });
    ok(tb.in === 'titleLinks' && tb.ib && tb.i === '💬' && tb.t === 'Chat' && tb.h >= 52 && tb.w >= 52 && !tb.dot, 'a 💬 "Chat" icon button (.ib) in #titleLinks (≥ 52 px), no dot before any poll', tb);
    ok(await pg.evaluate(() => document.querySelector('#titleLinks .ib').id === 'hgChatBtn'), 'Chat is the first icon in #titleLinks', null);
    // the first closed poll (FIRST_MS after coming online): both channels, since 0
    await T.until(() => T.lists('world').length >= 1 && T.lists('c:GE').length >= 1, 6000);
    await pg.waitForTimeout(300);
    const cp = { w: T.lists('world')[0], c: T.lists('c:GE')[0] };
    ok(cp.w && cp.c && cp.w.body.since === 0 && cp.c.body.since === 0 && cp.w.body.token === TOKEN, 'closed and online: hg_chat_list(token, "world" / "c:GE", since 0) for the unread dot', cp.w && [cp.w.body, cp.c && cp.c.body]);
    ok(await on(pg, '#hgChatBtn .hgDot'), 'messages from others nobody has seen yet: a dot on the Chat button', null);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_title_dot_390.png') });

    // open: the full screen, WORLD + Georgia
    const n0 = T.lists('world').length;
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(400);
    const o1 = await pg.evaluate(() => { const s = document.getElementById('hgChat'); return { on: s.classList.contains('on'), full: s.classList.contains('full'), mode: G.chat.mode,
      w: document.getElementById('hgChTabW').textContent, c: document.getElementById('hgChTabC').textContent, act: document.querySelector('.hgChTab.on').id, ph: document.getElementById('hgChIn').placeholder }; });
    ok(o1.on && o1.full && o1.mode === 'full' && o1.w === '🌍World' && o1.c === '\u{1F1EC}\u{1F1EA}Georgia' && o1.act === 'hgChTabW' && o1.ph === 'Message', 'Chat opens a full screen with two tabs: 🌍 World and the country (🇬🇪 Georgia), World first; the input says "Message"', o1);
    const ln1 = await longTexts(pg); ok(!ln1.length, 'the chat screen: no visible label longer than 40 characters (message bodies and names aside)', ln1);
    const first = T.lists('world')[n0];
    ok(first && first.body.since === 0, 'opening refreshes the open tab from since 0', first && first.body);
    const rows = await rowsOf(pg);
    const hhmm = await pg.evaluate(() => { const d = new Date(), p = v => String(v).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); });
    const g = rows.find(r => r.n === 'Giorgi'), a = rows.find(r => r.n === 'Ann');
    ok(rows.length === 5 && rows.map(r => r.n).join() === 'Giorgi,Marie,Ann,Carl,Carl', 'the world list: the 5 world messages, oldest first', rows.map(r => r.n));
    ok(g && g.f === '\u{1F1EC}\u{1F1EA}' && g.cr && g.b === 'Hello all' && /^\d\d:\d\d$/.test(g.t) && rows.every(r => r.t === hhmm || /^\d\d:\d\d$/.test(r.t)), 'a message shows the flag, the name, 👑 for the champion, the text and HH:MM', g);
    ok(rows.filter(r => r.cr).length === 1 && rows.find(r => r.n === 'Marie').f === '\u{1F1EB}\u{1F1F7}', 'only the champion has the crown; each flag is the sender\'s country', rows.map(r => r.f + r.n + (r.cr ? '👑' : '')));
    ok(a && a.me && !a.dots && rows.filter(r => !r.me).every(r => r.dots), 'your own message is marked and has no ⋯; every other message has a ⋯', rows.map(r => [r.n, r.me, r.dots]));
    const seen1 = await pg.evaluate(() => ({ w: !document.querySelector('#hgChTabW .hgDot').hidden, c: !document.querySelector('#hgChTabC .hgDot').hidden, ls: JSON.parse(localStorage.getItem('hg_chat_seen') || '{}') }));
    ok(!seen1.w && seen1.c && seen1.ls.world === 6 && !seen1.ls['c:GE'], 'what is on screen counts as seen (hg_chat_seen.world = the last id); the unseen country tab keeps its dot', seen1);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_title_390.png') });

    // the 3 s poll with since
    M.seed('world', 'Nika', 'GE', 'new one');
    await T.until(() => T.lists('world').filter(c => c.body.since === 6).length >= 1, 5000);
    await pg.waitForTimeout(200);
    const r2 = await rowsOf(pg);
    ok(r2.length === 6 && r2[5].n === 'Nika' && r2[5].b === 'new one', 'while open the next hg_chat_list uses since = the last id (6) and the new message appears at the bottom', r2.map(r => r.n));
    await pg.waitForTimeout(3400);
    const ws = T.lists('world').filter(c => c.at > first.at);
    const gaps = ws.slice(1).map((c, i) => c.at - ws[i].at);
    ok(ws.length >= 2 && gaps.every(d => d > 2500 && d < 4500) && ws[ws.length - 1].body.since === 7, 'polls about every 3 s while open, each with the latest since', { gaps, since: ws.map(c => c.body.since) });

    // send
    await pg.locator('#hgChIn').tap(); await pg.keyboard.type('Hello world'); await pg.locator('#hgChSend').tap(); await pg.waitForTimeout(400);
    const s1 = T.n('hg_chat_send').slice(-1)[0];
    const r3 = await rowsOf(pg), inV = await pg.locator('#hgChIn').inputValue();
    ok(s1 && s1.body.token === TOKEN && s1.body.channel === 'world' && s1.body.body === 'Hello world', 'SEND: hg_chat_send(token, "world", "Hello world")', s1 && s1.body);
    ok(r3[r3.length - 1].b === 'Hello world' && r3[r3.length - 1].me && inV === '' && (await msgLine(pg)).t === '', 'the sent message shows at once as yours, the input is cleared', { last: r3[r3.length - 1], inV });
    await pg.waitForTimeout(3300);
    const r3b = await rowsOf(pg);
    ok(r3b.filter(r => r.b === 'Hello world').length === 1, 'the next poll brings it back once (no duplicate)', r3b.map(r => r.b));

    // no HTML injection: our text, and a server message with HTML in the name and the body
    const XSS = '<img src=x onerror=alert(1)>';
    await sendText(pg, XSS);
    M.seed('world', '<b>Bob</b>', 'DE', '<script>alert(2)</script><i>x</i>');
    await pg.waitForTimeout(3400);
    const x = await pg.evaluate(() => { const l = document.getElementById('hgChat'); return { img: l.querySelectorAll('img').length, tags: l.querySelectorAll('#hgChList b, #hgChList i:not(.hgDot), #hgChList script').length,
      bodies: [...l.querySelectorAll('.hgCmb')].map(e => e.textContent), names: [...l.querySelectorAll('.hgCmh .n')].map(e => e.textContent) }; });
    ok(T.n('hg_chat_send').slice(-1)[0].body.body === XSS && x.bodies.indexOf(XSS) >= 0 && x.img === 0, 'sending <img src=x onerror=alert(1)>: it renders as text, no <img> element', x.bodies.slice(-2));
    ok(x.tags === 0 && x.names.indexOf('<b>Bob</b>') >= 0 && x.bodies.indexOf('<script>alert(2)</script><i>x</i>') >= 0 && !M.dialogs.length, 'HTML in a name or a body from the server stays text; no script runs (no dialog)', { tags: x.tags, dialogs: M.dialogs });

    // errors
    const nSend0 = T.n('hg_chat_send').length;
    await pg.locator('#hgChIn').fill('   '); await pg.locator('#hgChSend').tap(); await pg.waitForTimeout(150);
    const e0 = await msgLine(pg);
    ok(e0.t === ERRTXT.empty && e0.bad && T.n('hg_chat_send').length === nSend0, 'SEND with only spaces: "Write something first", nothing sent', e0);
    for (const code of ['rate', 'too_long', 'empty', 'no_profile', 'bad_channel', 'http500']) {
      M.force = code; await sendText(pg, 'x'); const e = await msgLine(pg);
      ok(e.t === ERRTXT[code] && e.bad && await pg.locator('#hgChIn').inputValue() === 'x', 'server error ' + code + ': "' + ERRTXT[code] + '" (the text stays in the input)', e);
    }
    // 'auth' (a dead session): 10_net logs in again once and repeats the send, so the message goes out
    { const nl = T.n('tg_login').length, ns = T.n('hg_chat_send').length;
      M.force = 'auth'; await sendText(pg, 'x'); await pg.waitForTimeout(300); const e = await msgLine(pg);
      ok(T.n('tg_login').length === nl + 1 && T.n('hg_chat_send').length === ns + 2 && !e.bad && await pg.locator('#hgChIn').inputValue() === '', 'server error auth: one new login, the send repeated once and delivered', { e, login: T.n('tg_login').length - nl, sends: T.n('hg_chat_send').length - ns }); }
    await sendText(pg, '\u0007');
    ok((await msgLine(pg)).t === ERRTXT.empty, 'a body of control characters only: the server says empty → "Write something first"', await msgLine(pg));
    await pg.locator('#hgChIn').fill('a'.repeat(250)); await pg.waitForTimeout(80);
    const cap = await pg.evaluate(() => ({ len: [...document.getElementById('hgChIn').value].length, line: document.getElementById('hgChMsg').textContent }));
    ok(cap.len === 200 && cap.line === '0 left', 'the input keeps at most 200 characters and counts down near the end', cap);
    const emo = '😀'.repeat(150);
    await pg.locator('#hgChIn').fill(emo); await pg.waitForTimeout(80);
    ok([...(await pg.locator('#hgChIn').inputValue())].length === 150, 'the 200 counts characters, not UTF-16 units (150 emoji fit)', null);
    await pg.locator('#hgChIn').fill('');

    // tabs
    await pg.locator('#hgChTabC').tap(); await pg.waitForTimeout(500);
    const c1 = T.lists('c:GE').slice(-1)[0], cr = await rowsOf(pg);
    const ph = await pg.locator('#hgChIn').getAttribute('placeholder');
    ok(c1 && c1.body.since === 0 && cr.length === 1 && cr[0].n === 'Luka' && cr[0].b === 'gamarjoba' && ph === 'Message', 'the country tab lists "c:GE" (Luka), the input says "Message"', { since: c1 && c1.body.since, rows: cr.map(r => r.n), ph });
    await sendText(pg, 'gaumarjos');
    ok(T.n('hg_chat_send').slice(-1)[0].body.channel === 'c:GE' && (await rowsOf(pg)).slice(-1)[0].b === 'gaumarjos', 'SEND on the country tab goes to "c:GE"', T.n('hg_chat_send').slice(-1)[0].body);
    await pg.evaluate(() => { G.chat.CLOSED_MS = 1200; });
    M.seed('world', 'Marie', 'FR', 'are you there?');
    await pg.waitForTimeout(2600);
    ok(await on(pg, '#hgChTabW .hgDot') && !(await on(pg, '#hgChTabC .hgDot')), 'a new world message while the country tab is open: a dot on the WORLD tab', null);
    await pg.locator('#hgChTabW').tap(); await pg.waitForTimeout(500);
    ok(!(await on(pg, '#hgChTabW .hgDot')) && (await rowsOf(pg)).slice(-1)[0].b === 'are you there?', 'back on WORLD: the message is there, the tab dot goes', null);

    // a message the server hides for everyone (3 reports from others) while the chat is open: the next refresh from since 0 drops it
    await pg.evaluate(() => { G.chat.FULL_MS = 4000; });
    const nf = T.lists('world').length; M.reports.push(1, 1, 1);
    await T.until(() => T.lists('world').slice(nf).some(c => c.body.since === 0), 8000); await pg.waitForTimeout(250);
    const hf = await rowsOf(pg);
    ok(!hf.some(r => r.b === 'Hello all') && hf.some(r => r.b === 'Bonjour') && hf.some(r => r.b === 'are you there?'), 'a message hidden for everyone (3 reports) leaves the open chat at the next refresh from since 0 (FULL_MS); the rest stays', { since: T.lists('world').slice(nf).map(c => c.body.since), rows: hf.map(r => r.b) });
    await pg.evaluate(() => { G.chat.FULL_MS = 30000; });

    // report with the ⋯
    const marie = (await rowsOf(pg)).find(r => r.b === 'Bonjour');
    await pg.locator('#hgChList .hgCm[data-id="' + marie.id + '"] .hgCmo').tap(); await pg.waitForTimeout(150);
    const mn = await pg.evaluate(() => ({ on: !document.getElementById('hgChMenu').hidden, q: document.querySelector('#hgChMenu .q').textContent, rep: document.getElementById('hgChReport').textContent, blk: document.getElementById('hgChBlock').textContent }));
    ok(mn.on && mn.q === '\u{1F1EB}\u{1F1F7} Marie: Bonjour' && mn.rep === '⚑ Report' && mn.blk === '⛔ Block', 'the ⋯ on a message offers Report and Block (the message quoted)', mn);
    await pg.locator('#hgChCancel').tap(); await pg.waitForTimeout(100);
    ok(!(await on(pg, '#hgChMenu')) && !T.n('hg_chat_report').length, 'Cancel closes it, nothing sent', null);
    await pg.locator('#hgChList .hgCm[data-id="' + marie.id + '"] .hgCmo').tap(); await pg.waitForTimeout(150);
    await pg.locator('#hgChReport').tap(); await pg.waitForTimeout(400);
    const rp = T.n('hg_chat_report').slice(-1)[0], afterRep = await rowsOf(pg);
    ok(rp && rp.body.token === TOKEN && rp.body.id === marie.id, 'Report: hg_chat_report(token, id)', rp && rp.body);
    ok(!afterRep.some(r => r.id === marie.id) && afterRep.some(r => r.b === 'are you there?') && (await msgLine(pg)).t === '⚑ Reported' &&
      (await pg.evaluate(() => JSON.parse(localStorage.getItem('hg_chat_hidden') || '[]'))).indexOf(marie.id) >= 0, 'the reported message is hidden for you at once (and stays hidden: hg_chat_hidden); her other messages stay', afterRep.map(r => r.b));

    // block with a long press
    const carl = (await rowsOf(pg)).find(r => r.n === 'Carl');
    const cb = await pg.locator('#hgChList .hgCm[data-id="' + carl.id + '"] .hgCmc').boundingBox();
    await pg.mouse.move(cb.x + 30, cb.y + cb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(750); await pg.mouse.up(); await pg.waitForTimeout(100);
    const mn2 = await pg.evaluate(() => ({ on: !document.getElementById('hgChMenu').hidden, blk: document.getElementById('hgChBlock').textContent }));
    ok(mn2.on && mn2.blk === '⛔ Block' && /Carl/.test(await pg.evaluate(() => document.querySelector('#hgChMenu .q').textContent)), 'a long press on a message opens the same menu', mn2);
    await pg.locator('#hgChBlock').tap(); await pg.waitForTimeout(400);
    const bk = T.n('hg_chat_block').slice(-1)[0], afterBlk = await rowsOf(pg);
    ok(bk && bk.body.name === 'Carl' && bk.body.token === TOKEN && !afterBlk.some(r => r.n === 'Carl') && (await msgLine(pg)).t === '⛔ Blocked', 'Block: hg_chat_block(token, "Carl"), both of his messages go', { body: bk && bk.body, rows: afterBlk.map(r => r.n) });
    const mine = (await rowsOf(pg)).find(r => r.me);
    const mb = await pg.locator('#hgChList .hgCm[data-id="' + mine.id + '"] .hgCmc').boundingBox();
    await pg.mouse.move(mb.x + 30, mb.y + mb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(750); await pg.mouse.up(); await pg.waitForTimeout(100);
    ok(!(await on(pg, '#hgChMenu')), 'a long press on your own message does nothing', null);

    // close; the closed poll lights the dot only for someone else's message
    await pg.locator('#hgChX').tap(); await pg.waitForTimeout(200);
    ok(!(await pg.evaluate(() => document.getElementById('hgChat').classList.contains('on'))) && await pg.evaluate(() => document.getElementById('title').classList.contains('on')), '✕ closes the chat, the title is back', null);
    const nc = T.lists().length;
    M.seed('world', 'Ann', 'GE', 'from my other phone');
    await pg.waitForTimeout(2800);
    const cl = T.lists().slice(nc);
    ok(cl.length >= 2 && cl.every(c => c.body.since > 0) && !(await on(pg, '#hgChatBtn .hgDot')), 'closed: both channels polled with since; your own new message lights no dot', cl.map(c => c.body.channel + '>' + c.body.since));
    M.seed('world', 'Zed', 'BR', 'anyone?');
    await pg.waitForTimeout(1800);
    ok(await on(pg, '#hgChatBtn .hgDot'), 'a new message from someone else: the dot on the Chat button', null);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_title_unread_390.png') });
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(400);
    ok(!(await on(pg, '#hgChatBtn .hgDot')) && (await rowsOf(pg)).slice(-1)[0].b === 'anyone?', 'opening shows it and clears the dot', null);
    await pg.locator('#hgChX').tap();

    // a country that is not yours cannot be read
    await pg.evaluate(() => { G.profile.country = 'FR'; G.emit('profile', G.profile); G.chat.open('country'); });
    await pg.waitForTimeout(500);
    const bc = await pg.evaluate(() => ({ note: (document.getElementById('hgChNote') || {}).textContent, form: document.getElementById('hgChForm').hidden }));
    ok(bc.note === 'Not your country' && bc.form, 'the server refuses a country channel (bad_channel): a note, no input', bc);
    await pg.evaluate(() => { G.profile.country = 'GE'; G.emit('profile', G.profile); G.chat.close(); });

    const dom = await pg.evaluate(() => document.documentElement.outerHTML);
    ok(dom.indexOf(String(TGID)) < 0 && !/77700\d\d/.test(dom), 'no Telegram id anywhere in the DOM (the messages carried one)', null);
    ok(!T.errs.length && await errHidden(pg) && !M.dialogs.length, 'title run: no page errors, #err hidden, no dialog', T.errs);
    await T.ctx.close();
  }

  /* ---------- 2. the layout at three sizes: the title screen, the HUD button, the docked panel during a round ---------- */
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const tag = w + 'x' + h;
    const T = await setup(b, { w, h }); const { pg, M } = T;
    for (let i = 0; i < 14; i++) M.seed('world', i % 2 ? 'Marie' : 'Giorgi', i % 2 ? 'FR' : 'GE', i % 3 ? 'line ' + i : 'a longer message number ' + i + ' that wraps onto a second line on a narrow phone');
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(500);
    const fit = async () => pg.evaluate(() => {
      const s = document.getElementById('hgChat'), r = e => { const q = (typeof e === 'string' ? s.querySelector(e) : e).getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height, b: q.bottom, r: q.right }; };
      const vis = [...s.querySelectorAll('button,input')].filter(e => e.offsetParent && !e.closest('[hidden]'));
      const small = vis.map(e => [e.id || e.className, e.getBoundingClientRect().height]).filter(x => x[1] < 44);
      return { panel: r(s), list: r('#hgChList'), send: r('#hgChSend'), input: r('#hgChIn'), x: r('#hgChX'), tabs: r('#hgChTabs'), scroll: s.scrollHeight - s.clientHeight, wide: document.documentElement.scrollWidth - innerWidth, small, rows: s.querySelectorAll('.hgCm').length };
    });
    const F = await fit();
    ok(F.send.b <= h && F.send.r <= w && F.input.y >= 0 && F.x.y >= 0 && F.x.r <= w && F.list.height >= (h > 500 ? 300 : 120) && F.scroll <= 1 && F.wide <= 0 && !F.small.length && F.rows === 19,
      tag + ' title: the chat screen fits (tabs, ✕, a list ≥ ' + (h > 500 ? 300 : 120) + ' px, SEND on screen, no scroll, every target ≥ 44 px)', F);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_title_' + tag + '.png') });
    // scrolled up: a new message does not pull the list down, a "New messages" pill does
    await pg.evaluate(() => { document.getElementById('hgChList').scrollTop = 0; });
    M.seed('world', 'Nika', 'GE', 'while you scrolled up');
    await T.until(() => T.lists('world').some(c => c.body.since === 20), 5000); await pg.waitForTimeout(250);
    const PL = await pg.evaluate(() => { const l = document.getElementById('hgChList'), p = document.getElementById('hgChNew'), q = p.getBoundingClientRect(); return { top: l.scrollTop, pill: !p.hidden, h: q.height, b: q.bottom, lb: l.getBoundingClientRect().bottom }; });
    await pg.locator('#hgChNew').tap(); await pg.waitForTimeout(200);
    const PL2 = await pg.evaluate(() => { const l = document.getElementById('hgChList'); return { atB: l.scrollHeight - l.scrollTop - l.clientHeight < 12, pill: !document.getElementById('hgChNew').hidden, last: [...l.querySelectorAll('.hgCmb')].pop().textContent }; });
    ok(PL.top === 0 && PL.pill && PL.h >= 44 && PL.b <= PL.lb && PL2.atB && !PL2.pill && PL2.last === 'while you scrolled up', tag + ' title: scrolled up, a new message shows a "New messages" pill (≥ 44 px); a tap scrolls down', { PL, PL2 });
    await pg.locator('#hgChList .hgCm:not(.me) .hgCmo').last().tap(); await pg.waitForTimeout(150);
    const MF = await pg.evaluate(() => { const m = document.getElementById('hgChMenu'), r = m.getBoundingClientRect(); return { on: !m.hidden, b: r.bottom, btns: [...m.querySelectorAll('button')].map(e => { const q = e.getBoundingClientRect(); return [Math.round(q.y), Math.round(q.bottom), Math.round(q.height)]; }) }; });
    ok(MF.on && MF.btns.every(x => x[0] >= 0 && x[1] <= h && x[2] >= 44), tag + ' title: the Report / Block menu fits on screen (buttons ≥ 44 px)', MF);
    await pg.locator('#hgChCancel').tap();
    await pg.locator('#hgChTabC').tap(); await pg.waitForTimeout(500); await pg.locator('#hgChTabW').tap(); await pg.waitForTimeout(300);   // both channels seen
    await pg.locator('#hgChX').tap(); await pg.waitForTimeout(150);
    { const TF = await titleFit(pg, ['hgChatBtn']);
      ok(TF.own <= Math.max(1, TF.core) && TF.row === 1 && (TF.core > 1 || (TF.play.b <= h && TF.links.every(q => q.t >= 0 && q.b <= h && q.l >= 0 && q.r <= w))), tag + ': the 💬 icon adds no scroll to the title (PLAY and the icons on screen, one row)', TF);
      console.log('INFO ' + tag + ': the title scrolls ' + TF.all + ' px with every module, ' + TF.core + ' px with the core alone'); }

    // a round: the HUD button
    await pg.locator('#play').tap(); await pg.waitForTimeout(300);
    await pg.evaluate(() => { const S = G.S; S.me.carry = 345; S.me.bank = 1234; S.ps.forEach((p, i) => { if (p !== S.me) p.bank = 1000 + i * 111; }); });
    await pg.waitForTimeout(400);
    const HB = await pg.evaluate(() => { const box = id => { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') return null; const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; };
      return { hb: box('hgChatHud'), round: !!G.S && !G.S.over, others: ['hTL', 'hTC', 'hTR', 'sk', 'hgMini', 'dgChip'].map(id => [id, box(id)]), pe: getComputedStyle(document.getElementById('hgChatHud')).pointerEvents, inX: document.getElementById('hgChatHud').parentElement.id }; });
    const hit = HB.others.filter(([id, o]) => o && R(o, HB.hb)).map(o => o[0]);
    ok(HB.round && HB.hb && HB.hb.width >= 44 && HB.hb.height >= 44 && HB.hb.x >= 0 && HB.hb.y >= 0 && HB.hb.x + HB.hb.width <= w && HB.hb.y + HB.hb.height <= h && !hit.length && HB.pe === 'auto' && HB.inX === 'hudExtra',
      tag + ' round: a 44 px chat button in #hudExtra overlaps none of carry/bank, the clock, the board, the skill button, the minimap or the day chip', { hb: HB.hb, hit });
    // closed during a round: the 20 s poll (shortened here) puts the unread dot on the HUD button
    ok(!(await on(pg, '#hgChatHud .hgDot')), tag + ' round: no dot while everything is seen', null);
    M.seed('world', 'Zed', 'BR', 'race you to the vault');
    await pg.evaluate(() => { G.chat.CLOSED_MS = 1000; G.chat.poll(); }); await pg.waitForTimeout(800);
    ok(await on(pg, '#hgChatHud .hgDot'), tag + ' round: a new message lights the dot on the HUD chat button', null);
    const n1 = T.lists('world').length; await pg.waitForTimeout(3500);
    const rw = T.lists('world').slice(n1).map(c => c.at), rg = rw.slice(1).map((t, i) => t - rw[i]);
    ok(rw.length >= 1 && rg.every(d => d > 2500), tag + ' round: closed during a round, the unread poll runs every 3 × CLOSED_MS (60 s by default)', { n: rw.length, rg });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_hud_' + tag + '.png') });

    // the docked panel
    await pg.locator('#hgChatHud').tap(); await pg.waitForTimeout(500);
    const D = await pg.evaluate(() => { const s = document.getElementById('hgChat'), q = s.getBoundingClientRect(), sk = document.getElementById('sk').getBoundingClientRect(), me = G.S.me;
      const k = Math.min(1.5, Math.max(0.65, Math.sqrt(G.W * G.H) / 680)) / (1 + (G.radius(me) - 17) / 140), hr = G.radius(me) * k + 22;   // the hero, his name and carry above
      const send = document.getElementById('hgChSend').getBoundingClientRect(), inp = document.getElementById('hgChIn').getBoundingClientRect();
      return { on: s.classList.contains('on'), dock: s.classList.contains('dock'), mode: G.chat.mode, p: { x: q.x, y: q.y, width: q.width, height: q.height, r: q.right, b: q.bottom },
        sk: { x: sk.x, y: sk.y, width: sk.width, height: sk.height }, hero: { x: G.W / 2 - hr, y: G.H / 2 - hr, width: 2 * hr, height: 2 * hr }, rows: s.querySelectorAll('.hgCm').length,
        send: { b: send.bottom, r: send.right, h: send.height }, inp: { y: inp.y, h: inp.height }, t0: G.S.t, small: [...s.querySelectorAll('button,input')].filter(e => e.offsetParent && !e.closest('[hidden]')).map(e => e.getBoundingClientRect().height).filter(v => v < 44).length }; });
    const land = w > h;
    { const ln = await longTexts(pg); ok(!ln.length, tag + ' round: the docked chat: no visible label longer than 40 characters', ln); }
    ok(D.on && D.dock && D.mode === 'dock' && D.rows > 0 && D.send.b <= D.p.b && D.send.r <= D.p.r && D.send.h >= 44 && D.inp.h >= 44 && !D.small, tag + ' round: the chat docks (messages, the input and SEND inside the panel, targets ≥ 44 px)', D);
    ok(!R(D.p, D.hero) && D.p.x >= 0 && D.p.r <= w && D.p.y >= 0 && D.p.b <= h, tag + ' round: the docked panel leaves the hero uncovered', { p: D.p, hero: D.hero });
    if (land) ok(D.p.x >= w * 0.55 && !R(D.p, D.sk), tag + ' round: landscape: a side panel on the right (≤ 45 % of the width), above the skill button; the left side is free', { left: D.p.x, w, sk: D.sk });
    else ok(D.p.height <= h * 0.5 && D.p.y >= h * 0.5 && !R(D.p, D.sk), tag + ' round: portrait: a bottom sheet at most half the height, left of the skill button; the top half is free', { p: D.p, sk: D.sk });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_dock_' + tag + '.png') });
    await pg.waitForTimeout(1000);
    const t1 = await pg.evaluate(() => G.S.t);
    ok(t1 - D.t0 > 0.6, tag + ' round: the game keeps running while the chat is open', { dt: +(t1 - D.t0).toFixed(2) });
    // the joystick on the free side
    const m0 = await pg.evaluate(() => { const S = G.S; Object.assign(S.me, { x: 2000, y: 2000, vx: 0, vy: 0, carry: 0 }); return S.me.x; });
    const sx = land ? Math.round(w * 0.2) : Math.round(w * 0.3), sy = land ? Math.round(h * 0.55) : Math.round(h * 0.32);
    await pg.mouse.move(sx, sy); await pg.mouse.down(); await pg.mouse.move(sx + 50, sy, { steps: 4 }); await pg.waitForTimeout(400);
    const m1 = await pg.evaluate(() => G.S.me.x); await pg.mouse.up();
    ok(m1 - m0 > 30, tag + ' round: a drag on the free side still moves the hero while the chat is open', { dx: Math.round(m1 - m0), at: [sx, sy] });
    // typing does not fire the skill
    const cd0 = await pg.evaluate(() => G.S.me.cd);
    await pg.locator('#hgChIn').tap(); await pg.keyboard.type('j k');
    const ty = await pg.evaluate(() => ({ cd: G.S.me.cd, v: document.getElementById('hgChIn').value }));
    ok(ty.v === 'j k' && ty.cd === cd0, tag + ' round: typing J and space in the input does not use the skill', ty);
    await pg.locator('#hgChSend').tap(); await pg.waitForTimeout(400);
    ok(T.n('hg_chat_send').slice(-1)[0].body.body === 'j k' && (await rowsOf(pg)).slice(-1)[0].b === 'j k', tag + ' round: SEND works from the docked panel', null);
    if (land) {   // the soft keyboard up: the WebView shrinks to the space above it
      await pg.locator('#hgChIn').tap(); await pg.setViewportSize({ width: w, height: 170 }); await pg.waitForTimeout(250);
      const KB = await pg.evaluate(() => { const p = document.getElementById('hgChat').getBoundingClientRect(), box = id => { const q = document.getElementById(id).getBoundingClientRect(); return { y: q.y, b: q.bottom, h: q.height, x: q.x, r: q.right }; };
        const inside = q => q.y >= p.y - 0.5 && q.b <= p.bottom + 0.5 && q.x >= p.x - 0.5 && q.r <= p.right + 0.5 && q.h >= 44;
        const i = box('hgChIn'), s = box('hgChSend');
        return { p: { y: p.y, b: p.bottom, h: p.height }, inp: inside(i), send: inside(s), list: document.getElementById('hgChList').getBoundingClientRect().height, onScreen: s.b <= innerHeight, focus: document.activeElement && document.activeElement.id }; });
      await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_dock_keyboard_' + w + 'x170.png') });
      ok(KB.inp && KB.send && KB.onScreen && KB.list >= 40 && KB.focus === 'hgChIn', tag + ' round: keyboard up (' + w + 'x170): the input and SEND (≥ 44 px) stay inside the docked panel, the list still shows', KB);
      await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(250);
      const KB2 = await pg.evaluate(() => ({ bar: getComputedStyle(document.querySelector('#hgChat .hgChBar')).display, x: document.getElementById('hgChX').getBoundingClientRect().height, sk: (() => { const p = document.getElementById('hgChat').getBoundingClientRect(), q = document.getElementById('sk').getBoundingClientRect(); return p.bottom <= q.top; })() }));
      ok(KB2.bar !== 'none' && KB2.x >= 44 && KB2.sk, tag + ' round: the keyboard gone, the tabs and ✕ are back and the panel is above the skill button again', KB2);
    }
    await pg.locator('#hgChList .hgCm:not(.me) .hgCmo').last().tap(); await pg.waitForTimeout(150);
    const DM = await pg.evaluate(() => { const p = document.getElementById('hgChat').getBoundingClientRect(); return { on: !document.getElementById('hgChMenu').hidden, btns: [...document.querySelectorAll('#hgChMenu button')].map(e => { const q = e.getBoundingClientRect(); return q.y >= p.y - 0.5 && q.bottom <= p.bottom + 0.5 && q.height >= 44; }) }; });
    ok(DM.on && DM.btns.every(Boolean), tag + ' round: the Report / Block menu fits inside the docked panel', DM);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_dock_menu_' + tag + '.png') });
    await pg.locator('#hgChCancel').tap();
    // the skill button stays tappable with the chat open: a tap at its centre and near its top fires the skill, never the chat
    for (const fy of [0.5, 0.25]) {
      await pg.evaluate(() => { G.S.me.cd = 0; }); const skb = await pg.locator('#sk').boundingBox(), nSend = T.n('hg_chat_send').length;
      const top = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.id || e.className); }, [skb.x + skb.width / 2, skb.y + skb.height * fy]);
      await pg.touchscreen.tap(skb.x + skb.width / 2, skb.y + skb.height * fy); await pg.waitForTimeout(150);
      const SK = await pg.evaluate(() => ({ fired: G.S.me.cd > G.S.t, menu: !document.getElementById('hgChMenu').hidden, open: G.chat.isOpen }));
      ok(top === 'sk' && SK.fired && !SK.menu && SK.open && T.n('hg_chat_send').length === nSend, tag + ' round: with the chat docked, a tap on the skill button (' + (fy === 0.5 ? 'centre' : 'upper part') + ') fires the skill, opens no menu and sends nothing', { top, SK });
    }
    // ✕, the HUD button again, then the round's end closes it
    await pg.locator('#hgChX').tap(); await pg.waitForTimeout(150);
    const cl = await pg.evaluate(() => document.getElementById('hgChat').classList.contains('on'));
    await pg.locator('#hgChatHud').tap(); await pg.waitForTimeout(200);
    const re = await pg.evaluate(() => G.chat.isOpen && G.chat.mode === 'dock');
    ok(!cl && re, tag + ' round: ✕ closes the panel, the HUD button opens it again', { cl, re });
    // a fresh round with the chat open, run to the end: gold conserved all the way, the end closes the chat
    const endR = await pg.evaluate(() => { G.start(G.god); const dock = G.chat.isOpen && G.chat.mode === 'dock'; let bad = 0, n = 0;
      while (!G.S.over) { G.step(300); n++; if (G.total() !== G.S.minted) bad++; }
      return { dock, n, bad, over: G.S.over, chat: document.getElementById('hgChat').classList.contains('on'), open: G.chat.isOpen, end: document.getElementById('end').classList.contains('on'), total: G.total(), minted: G.S.minted }; });
    ok(endR.dock && endR.over && !endR.chat && !endR.open && endR.end, tag + ': a new round keeps the chat docked; the round\'s end closes it, the end screen shows', endR);
    ok(endR.bad === 0 && endR.n > 20 && endR.total === endR.minted, tag + ': gold is conserved through a round with the chat open (G.total() === G.S.minted)', endR);
    ok(!T.errs.length && await errHidden(pg) && !M.dialogs.length, tag + ': no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 3. offline (no Telegram): the note, nothing sent, no HUD button ---------- */
  {
    const T = await setup(b, { tg: false }); const { pg, M } = T;
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(300);
    const o = await pg.evaluate(() => ({ on: document.getElementById('hgChat').classList.contains('on'), note: (document.getElementById('hgChNote') || {}).textContent, form: document.getElementById('hgChForm').hidden, tabs: document.getElementById('hgChTabs').hidden, net: G.net.on }));
    ok(o.on && o.note === 'Open in Telegram' && o.form && o.tabs && !o.net, 'offline: the chat says "Open in Telegram", no input, no tabs', o);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_chat_offline_390.png') });
    await pg.locator('#hgChX').tap(); await pg.locator('#play').tap(); await pg.waitForTimeout(600);
    const hb = await pg.evaluate(() => ({ round: !!G.S && !G.S.over, shown: getComputedStyle(document.getElementById('hgChatHud')).display !== 'none' }));
    ok(hb.round && !hb.shown, 'offline: a round has no chat button', hb);
    await pg.waitForTimeout(1500);
    ok(M.calls.length === 0, 'offline: nothing is sent to the server', M.calls.map(c => c.name));
    ok(!T.errs.length && await errHidden(pg), 'offline: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 4. Telegram, but the login fails: Connecting…, then Offline with ↻ Retry ---------- */
  {
    const T = await setup(b, { loginFail: true }); const { pg } = T;
    await pg.waitForFunction(() => !G.net.pending, null, { timeout: 5000 }).catch(() => {});
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(150);
    const c0 = await pg.evaluate(() => (document.getElementById('hgChNote') || {}).textContent);
    await pg.waitForTimeout(900);
    const c1 = await pg.evaluate(() => { const r = document.getElementById('hgChRetry'); return { note: (document.getElementById('hgChNote') || {}).textContent, retry: r ? r.getBoundingClientRect().height : 0 }; });
    ok(c0 === 'Connecting…' && c1.note === 'Offline↻ Retry' && c1.retry >= 44, 'a failed login: "Connecting…" while it tries, then "Offline" with ↻ Retry (≥ 44 px)', { c0, c1 });
    const n = T.n('tg_login').length; await pg.locator('#hgChRetry').tap(); await pg.waitForTimeout(200);
    ok(T.n('tg_login').length === n + 1, 'Retry logs in again', T.n('tg_login').length);
    ok(!T.errs.length && await errHidden(pg), 'failed login: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 5. online without a profile: the world reads, the country tab asks for a profile, the server says no_profile ---------- */
  {
    const T = await setup(b, { noProfile: true }); const { pg } = T;
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(500);
    const w0 = await rowsOf(pg);
    ok(w0.length === 5 && !w0.some(r => r.me), 'no profile: the world chat still reads (nothing is yours)', w0.map(r => r.n));
    await sendText(pg, 'hi');
    ok((await msgLine(pg)).t === ERRTXT.no_profile, 'no profile: SEND → the server says no_profile → "No profile"', await msgLine(pg));
    await pg.locator('#hgChTabC').tap(); await pg.waitForTimeout(300);
    const c = await pg.evaluate(() => ({ tab: document.getElementById('hgChTabC').textContent, note: (document.getElementById('hgChNote') || {}).textContent, form: document.getElementById('hgChForm').hidden, pick: !!document.getElementById('hgChPick') }));
    ok(c.tab === '🏳Country' && /^No country yet/.test(c.note) && c.form && c.pick && !T.lists().some(x => /^c:/.test(x.body.channel)), 'no profile: the country tab asks for a name and a country (no country channel is asked)', c);
    await pg.locator('#hgChPick').tap(); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => document.getElementById('hgProf').classList.contains('on') && !document.getElementById('hgChat').classList.contains('on')), 'its button closes the chat and opens the profile screen', null);
    ok(!T.errs.length && await errHidden(pg), 'no profile: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 6. more than a page (50) between two polls: no silent gap; a refresh keeps older stored messages ---------- */
  {
    const T = await setup(b); const { pg, M } = T;
    await pg.locator('#hgChatBtn').tap(); await pg.waitForTimeout(500);
    const r0 = await rowsOf(pg);
    const after = async (since, from) => { await T.until(() => T.lists('world').slice(from).some(c => c.body.since === since), 8000); await pg.waitForTimeout(250); };
    let n = T.lists('world').length;
    for (let i = 1; i <= 80; i++) M.seed('world', 'Nika', 'GE', 'bulk ' + i);   // ids 7..86 (the 6 base messages first)
    await after(6, n);
    const r1 = await rowsOf(pg);
    ok(r0.length === 5 && r1.length === 50 && r1[0].b === 'bulk 31' && r1[49].b === 'bulk 80' && !r1.some(r => r.b === 'Hello all'),
      '80 new messages between two polls: the since poll gets the newest 50 and they replace the list (bulk 31..80, nothing older glued on in front)', { before: r0.length, n: r1.length, first: r1[0] && r1[0].b, last: r1[49] && r1[49].b });
    n = T.lists('world').length;
    for (let i = 1; i <= 30; i++) M.seed('world', 'Luka', 'GE', 'more ' + i);   // ids 87..116
    await after(86, n);
    const r2 = await rowsOf(pg);
    ok(r2.length === 80 && r2[0].b === 'bulk 31' && r2[79].b === 'more 30', 'a short page (30) is joined on as usual: 80 messages', { n: r2.length, first: r2[0].b, last: r2[79].b });
    n = T.lists('world').length; await pg.evaluate(() => { G.chat.FULL_MS = 1500; });
    await after(0, n);
    await pg.evaluate(() => { document.querySelector('#hgChList .hgCm').dataset.keep = '1'; });
    const r3 = await rowsOf(pg);
    ok(r3.length === 80 && r3[0].b === 'bulk 31' && r3[79].b === 'more 30', 'the refresh from since 0 (the newest 50) reaches back to what is stored, so the 30 older messages stay', { n: r3.length, first: r3[0].b });
    n = T.lists('world').length; await after(0, n);
    ok(await pg.evaluate(() => (document.querySelector('#hgChList .hgCm') || { dataset: {} }).dataset.keep === '1'), 'a refresh with nothing new rebuilds nothing (the rows stay the same elements)', null);
    const m5 = M.msgs.find(m => m.body === 'more 5'); M.reports.push(m5.id, m5.id, m5.id);
    n = T.lists('world').length; await after(0, n);
    const r4 = await rowsOf(pg);
    ok(r4.length === 79 && !r4.some(r => r.b === 'more 5') && r4[0].b === 'bulk 31', 'a message hidden for everyone inside the refreshed page goes; the older stored ones stay', { n: r4.length });
    await pg.evaluate(() => { G.chat.FULL_MS = 30000; });
    await pg.locator('#hgChX').tap(); await pg.waitForTimeout(150);
    n = T.lists('world').length; await pg.locator('#hgChatBtn').tap(); await after(0, n);
    const want = M.msgs.filter(m => m.channel === 'world' && M.reports.filter(r => r === m.id).length < 3).slice(-50).map(m => m.body), r5 = (await rowsOf(pg)).map(r => r.b);
    ok(r5.length === 50 && r5.join('|') === want.join('|'), 'opening again shows exactly the server\'s newest 50 (the open refresh replaces what is stored)', { n: r5.length, first: r5[0], want: want[0] });
    ok(!T.errs.length && await errHidden(pg), 'gap run: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
