// tests/gold/t_online.js — Heavy Gold online play (90_online.js) against a local fake Supabase Realtime server: a hand-made WebSocket
// (http upgrade, RFC 6455 frames) speaking enough of the Phoenix protocol vsn 1.0.0 (phx_join / phx_reply / phx_leave, heartbeat,
// broadcast with self:false, presence track / untrack, presence_state, presence_diff; like Phoenix, a duplicate join and a leave get
// phx_close with the old join's ref, and a crashed channel gets phx_error). The game's socket URL is window.HG_ONLINE_URL.
// Three real pages (390x844, 844x390, 640x360) and one raw hostile client: PLAY ONLINE hidden outside Telegram; the lobby puts the
// second player in the first one's room; a friend link (start_param room_<code>) joins it; the invite link; names cleaned, never HTML;
// Start now; the same 8 seats on every page (3 players with flags, the rest bots); each page sees the others move; a robbery between two
// real players, the same carries on all three pages; banking; Loki's vanish + decoy seen by the others; a silent player is "left";
// gold conserved on the host; the message rate; the host closes → the next one takes over with the gold intact; the end: both submit
// r.mode = 'online' with r.map; then a room starts at once when it is full (MAX), and a lone player plays with 7 bots. No page errors.
// Hardening: the title links row at 844x390 / 640x360; console-edited skill numbers clamped on the host; a console teleport capped;
// gold conserved on a client's page while it picks up coins; one rejoin after phx_error + a socket drop; no phantom skill after a
// hand-over; a bot's robbery toast says "(bot)".
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http'); const crypto = require('crypto');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TGIDS = { Ann: 700000101, Bob: 700000202, Cat: 700000303, Dan: 700000404, Eve: 700000505, Fay: 700000606, Gus: 700000707, Hal: 700000808, Ivy: 700000909 };

/* ---------------- a fake Realtime server ---------------- */
function fakeRealtime() {
  const T = new Map(), conns = new Set(), st = { in: 0, out: 0, inB: 0, outB: 0, joins: 0, tracks: 0, hb: 0, urls: [], byTopic: {}, dups: 0, joinLog: [] };
  let refN = 0; const pref = () => 'F' + (++refN).toString(36);
  const srv = http.createServer((q, s) => { s.writeHead(404); s.end(); });
  srv.on('upgrade', (req, sock) => {
    const k = req.headers['sec-websocket-key']; if (!k) { sock.destroy(); return; }
    st.urls.push(req.url);
    const acc = crypto.createHash('sha1').update(k + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
    sock.setNoDelay(true);
    const c = { sock, buf: Buffer.alloc(0), alive: true, frag: null }; conns.add(c);
    sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); try { parse(c); } catch (e) { console.error('fake ws:', e); } });
    sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
  });
  function frame(c, data, op) {
    if (!c.alive) return; const n = data.length; let h;
    if (n < 126) h = Buffer.from([0x80 | op, n]);
    else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(n, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
    try { c.sock.write(Buffer.concat([h, data])); } catch (e) {}
  }
  const send = (c, o) => { st.out++; frame(c, Buffer.from(JSON.stringify(o)), 1); };
  function parse(c) {
    for (;;) {
      if (c.buf.length < 2) return;
      const b0 = c.buf[0], b1 = c.buf[1], fin = b0 & 0x80, op = b0 & 15, masked = b1 & 0x80; let len = b1 & 127, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      const mo = masked ? 4 : 0; if (c.buf.length < off + mo + len) return;
      const data = Buffer.from(c.buf.subarray(off + mo, off + mo + len));
      if (masked) { const m = c.buf.subarray(off, off + 4); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
      c.buf = c.buf.subarray(off + mo + len);
      if (op === 8) { frame(c, Buffer.alloc(0), 8); try { c.sock.end(); } catch (e) {} drop(c); return; }
      if (op === 9) { frame(c, data, 10); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2) { if (fin) onText(c, data.toString('utf8')); else c.frag = data; continue; }
      if (op === 0) { c.frag = Buffer.concat([c.frag || Buffer.alloc(0), data]); if (fin) { const d = c.frag; c.frag = null; onText(c, d.toString('utf8')); } }
    }
  }
  const mem = t => { if (!T.has(t)) T.set(t, new Map()); return T.get(t); };
  const presOf = t => { const o = {}; for (const [, m] of mem(t)) if (m.metas) o[m.key] = { metas: m.metas }; return o; };
  const diff = (t, joins, leaves) => { for (const [cc, m] of mem(t)) if (m.pres) send(cc, { topic: t, event: 'presence_diff', payload: { joins, leaves }, ref: null }); };
  function onText(c, txt) {
    st.in++; let m; try { m = JSON.parse(txt); } catch (e) { return; }
    const { topic, event, payload, ref } = m, jr = m.join_ref;
    const reply = (status, response) => send(c, { topic, event: 'phx_reply', payload: { status, response: response || {} }, ref, join_ref: jr });
    if (topic === 'phoenix' && event === 'heartbeat') { st.hb++; return reply('ok'); }
    const ms = mem(topic), kind = String(topic).replace(/^realtime:(hg-[a-z]+).*/, '$1');
    if (event === 'phx_join') {
      st.joins++; const cfg = (payload && payload.config) || {}, pr = cfg.presence || {};
      // Phoenix closes the earlier join of a duplicate with phx_close carrying that join's ref
      const old = ms.get(c); if (old) { st.dups++; send(c, { topic, event: 'phx_close', payload: {}, ref: old.jr }); ms.delete(c); if (old.metas) diff(topic, {}, { [old.key]: { metas: old.metas } }); }
      const me = { key: pr.key || crypto.randomUUID(), pres: !!pr.enabled, metas: null, self: !!(cfg.broadcast && cfg.broadcast.self), jr: m.ref };
      st.joinLog.push({ topic, key: me.key, at: Date.now() });
      ms.set(c, me); reply('ok', { postgres_changes: [] });
      if (me.pres) send(c, { topic, event: 'presence_state', payload: presOf(topic), ref: null });
      return;
    }
    const me = ms.get(c); if (!me) return reply('error', { reason: 'unmatched topic' });
    if (event === 'phx_leave') { ms.delete(c); reply('ok'); send(c, { topic, event: 'phx_close', payload: {}, ref: me.jr }); if (me.metas) diff(topic, {}, { [me.key]: { metas: me.metas } }); return; }
    if (event === 'presence') { st.tracks++; const p = payload || {};
      if (p.event === 'track') { const old = me.metas; me.metas = [Object.assign({}, p.payload || {}, { phx_ref: pref() })]; diff(topic, { [me.key]: { metas: me.metas } }, old ? { [me.key]: { metas: old } } : {}); }
      else if (p.event === 'untrack' && me.metas) { const old = me.metas; me.metas = null; diff(topic, {}, { [me.key]: { metas: old } }); }
      return reply('ok');
    }
    if (event === 'broadcast') { st.inB++; const b = st.byTopic[kind] = st.byTopic[kind] || { sent: 0, got: 0 }; b.sent++;
      for (const [cc] of ms) { if (cc === c && !me.self) continue; st.outB++; b.got++; send(cc, { topic, event: 'broadcast', payload, ref: null }); } return; }
    if (event === 'access_token') return;
    reply('error', { reason: 'unknown event' });
  }
  function drop(c) { if (!c.alive) return; c.alive = false; conns.delete(c);
    for (const [t, ms] of T) { const m = ms.get(c); if (!m) continue; ms.delete(c); if (m.metas) diff(t, {}, { [m.key]: { metas: m.metas } }); } }
  const kick = (t, suffix) => { let n = 0; for (const [c, m] of mem(t)) { if (!m.key.endsWith(suffix)) continue; n++; try { c.sock.destroy(); } catch (e) {} drop(c); } return n; };   // the network drops one player's socket
  // a channel process dies on the server: phx_error with its join ref, the member is gone (the socket stays up); returns the sockets
  const crash = (t, suffix) => { const out = []; for (const [c, m] of [...mem(t)]) { if (!m.key.endsWith(suffix)) continue; out.push(c);
    send(c, { topic: t, event: 'phx_error', payload: {}, ref: m.jr }); mem(t).delete(c); if (m.metas) diff(t, {}, { [m.key]: { metas: m.metas } }); } return out; };
  const dropConns = cs => { for (const c of cs) { try { c.sock.destroy(); } catch (e) {} drop(c); } return cs.length; };
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ port: srv.address().port, st, presence: presOf, kick, crash, dropConns, joined: t => mem(t).size,
    close: () => { for (const c of conns) { try { c.sock.destroy(); } catch (e) {} } srv.close(); } })));
}

/* ---------------- a game page ---------------- */
async function mkPage(b, o) {
  const ctx = await b.newContext({ viewport: { width: o.w, height: o.h }, hasTouch: true, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const M = { submits: [], calls: [] }, errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await pg.route(/telegram\.org/, r => r.abort());
  await pg.route(/supabase\.co/, async route => {
    const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const mm = rq.url().match(/\/rest\/v1\/rpc\/(\w+)$/); if (!mm) return route.abort();
    const name = mm[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
    M.calls.push(name);
    const send = j => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(j) });
    if (name === 'tg_login') return send({ token: 'tok-' + o.name, tg_id: TGIDS[o.name] });
    if (name === 'hg_profile_get') return send({ name: o.name, country: o.cc });
    if (name === 'hg_profile_set') return send({ ok: true, name: body.name, country: body.country });
    if (name === 'hg_round_submit') { M.submits.push(body && body.r); return send({ ok: true, week: { total: (body && body.r && body.r.banked) || 0, best: 0, rounds: M.submits.length, rank: 1 } }); }
    if (name === 'hg_board') return send({ scope: body && body.scope, players: [], me: null, countries: [], totals: { players: 0, rounds: 0 } });
    return send({});
  });
  if (o.tg !== false) await pg.addInitScript(([u, id, sp]) => {
    window.__links = [];
    const init = 'query_id=AAE1&user=' + encodeURIComponent(JSON.stringify(Object.assign({ id }, u))) + '&auth_date=1763900000&hash=00ff';
    window.Telegram = { WebApp: { initData: init, initDataUnsafe: Object.assign({ user: Object.assign({ id }, u) }, sp ? { start_param: sp } : {}), platform: 'ios', version: '8.0', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {},
      HapticFeedback: { impactOccurred() {} }, openTelegramLink(l) { window.__links.push(l); } } };
  }, [{ first_name: o.name, language_code: 'en' }, TGIDS[o.name], o.sp || '']);
  await pg.addInitScript(([url, p, god]) => { window.HG_ONLINE_URL = url; try { localStorage.setItem('hg_profile', JSON.stringify(p)); if (god) localStorage.setItem('hg_god', god); } catch (e) {} }, [o.url, { name: o.name, country: o.cc }, o.god || '']);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.online && G.net);
  if (o.tg !== false) await pg.waitForFunction(() => G.net.on, null, { timeout: 5000 }).catch(() => {});
  await pg.evaluate(o2 => {
    if (G.setDayGod) G.setDayGod('none');
    Object.assign(G.online, o2.cfg || {});
    window.__rob = []; window.__res = null;
    G.on('rob', (L, H, take, loss) => window.__rob.push({ L: L.name, H: H.name, me: G.S.me.name, take, loss }));
    G.on('end', (S, res) => { window.__res = Object.assign({}, res); });
    if (o2.god) { const b = document.querySelector('.god[data-god="' + o2.god + '"]'); if (b) b.click(); }
  }, { cfg: o.cfg, god: o.god });
  return { ctx, pg, M, errs, name: o.name, w: o.w, h: o.h };
}
const errHidden = pg => pg.evaluate(() => getComputedStyle(document.getElementById('err')).display === 'none');
const until = async (pg, fn, arg, ms) => { try { await pg.waitForFunction(fn, arg, { timeout: ms || 6000, polling: 50 }); return true; } catch (e) { return false; } };
const box = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0, vw: innerWidth, vh: innerHeight }; }, sel);
const inView = b => !!(b && b.shown && b.x >= 0 && b.y >= 0 && b.x + b.w <= b.vw + 1 && b.y + b.h <= b.vh + 1);
const hero = (pg, name) => pg.evaluate(n => { const p = G.S.ps.find(q => q.name === n); return p && { x: p.x, y: p.y, carry: p.carry, bank: p.bank, robs: p.robs, lost: p.lost, inv: p.inv > G.S.t, tag: p.tag || '', bot: p.bot }; }, name);
const gold = pg => pg.evaluate(() => ({ total: G.total(), minted: G.S.minted, t: +G.S.t.toFixed(2), client: !!G.S.client }));

(async () => {
  const srv = await fakeRealtime();
  const URL_ = 'ws://127.0.0.1:' + srv.port + '/realtime/v1/websocket?apikey=sb_publishable_test&vsn=1.0.0';
  const b = await chromium.launch({ executablePath: EXE });
  const pages = [];
  try {
    /* -- outside Telegram the button is hidden; inside Telegram it shows, first in #titleLinks, >= 44 px -- */
    const off = await mkPage(b, { name: 'Fay', cc: 'GE', w: 390, h: 844, url: URL_, tg: false });
    const offB = await box(off.pg, '#hgOnline');
    ok(offB && !offB.shown, 'outside Telegram PLAY ONLINE is hidden', offB);
    await off.ctx.close();
    const I6 = await mkPage(b, { name: 'Ivy', cc: 'NO', w: 640, h: 360, url: URL_ });
    const r6 = await Promise.all(['#hgOnline', '#hgMe'].map(s => box(I6.pg, s)));
    ok(r6[0] && r6[0].shown && r6[0].h >= 44 && (!r6[1] || r6[1].y === r6[0].y), '640x360: PLAY ONLINE (>= 44 px) adds no row to the title: it shares the row of the name button', r6);
    console.log('INFO 640x360: PLAY ONLINE at ' + r6[0].y + '–' + (r6[0].y + r6[0].h) + ' of ' + r6[0].vh + (inView(r6[0]) ? ' (in view)' : ' (the core title alone already scrolls here: its links row starts below the screen)'));
    await I6.pg.screenshot({ path: path.join(SHOTS, 'online_title_640.png') }); await I6.ctx.close();

    const A = await mkPage(b, { name: 'Ann', cc: 'GE', w: 390, h: 844, url: URL_, god: 'thor', cfg: { WAIT: 60 } }); pages.push(A);
    const tb = await box(A.pg, '#hgOnline'), pb = await box(A.pg, '#play');
    const first = await A.pg.evaluate(() => document.getElementById('titleLinks').firstElementChild.id);
    const pri = await A.pg.evaluate(() => [...document.querySelectorAll('#title .pri')].filter(e => getComputedStyle(e).display !== 'none').length);
    ok(tb && tb.shown && tb.h >= 44 && first === 'hgOnline' && pri === 1 && pb.shown, 'in Telegram PLAY ONLINE shows first in #titleLinks, >= 44 px; PLAY stays the one primary button', { tb, first, pri });
    await A.pg.screenshot({ path: path.join(SHOTS, 'online_title_390.png') });

    /* -- Ann opens a room -- */
    await A.pg.locator('#hgOnline').tap();
    ok(await until(A.pg, () => G.online.phase === 'wait' && G.online.isHost() && G.online.R.ch.joined), 'Ann taps PLAY ONLINE: no room in the lobby, she opens one and hosts it');
    const code = await A.pg.evaluate(() => G.online.room);
    ok(/^[0-9a-z]{6}$/.test(code), 'a room code', code);
    const wA = await A.pg.evaluate(() => ({ list: [...document.querySelectorAll('#onList .onP')].map(e => e.textContent), st: document.getElementById('onSt').textContent, start: getComputedStyle(document.getElementById('onStart')).display }));
    ok(wA.list[0] === '🇬🇪AnnYOU' && /7 bots/.test(wA.list[1]) && /\d+ s/.test(wA.st) && wA.start === 'none', 'the wait screen: her flag, name and YOU, "7 bots fill the empty seats", a countdown; no Start now alone', wA);
    await A.pg.locator('#onInvite').tap(); await sleep(150);
    const links = await A.pg.evaluate(() => window.__links.slice());
    ok(links.length === 1 && links[0].indexOf('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/HoldorTDBot/play?startapp=room_' + code)) === 0, 'INVITE A FRIEND opens the Telegram share with t.me/HoldorTDBot/play?startapp=room_<code>', links[0]);

    /* -- Bob finds it through the lobby; Cat comes by the friend link; a hostile raw client joins too -- */
    const B = await mkPage(b, { name: 'Bob', cc: 'FR', w: 844, h: 390, url: URL_, god: 'hermes' }); pages.push(B);
    await B.pg.screenshot({ path: path.join(SHOTS, 'online_title_844.png') });
    const pl8 = await box(B.pg, '#play');
    ok(inView(pl8), '844x390: PLAY still in view on the title with PLAY ONLINE added', pl8);
    const row8 = await Promise.all(['#hgOnline', '#hgMe', '#hgTitleBoard'].map(s => box(B.pg, s)));
    ok(row8[0] && inView(row8[0]) && row8[0].h >= 44 && row8.every(x => !x || (inView(x) && x.y === row8[0].y)), '844x390: PLAY ONLINE, the name button and Leaderboard share one row, all in view', row8);
    await B.pg.locator('#hgOnline').tap();
    ok(await until(B.pg, c => G.online.room === c && G.online.R && G.online.R.ch.joined && G.online.R.hk, code), 'Bob taps PLAY ONLINE and the lobby puts him in Ann\'s room', await B.pg.evaluate(() => G.online.debug()));
    const C = await mkPage(b, { name: 'Cat', cc: 'US', w: 640, h: 360, url: URL_, god: 'loki', sp: 'room_' + code }); pages.push(C);
    ok(await until(C.pg, c => G.online.room === c && G.online.R && G.online.R.ch.joined, code), 'Cat opens the friend link (start_param room_<code>) and joins the same room');
    const evil = await (await b.newContext()).newPage();
    await evil.route(/telegram\.org|supabase\.co/, r => r.abort()); await evil.goto('file://' + FILE);   // a file page (about:blank may not open local sockets)
    const evr = await evil.evaluate(([url, code]) => new Promise(res => { const w = new WebSocket(url); window.__w = w; const t = 'realtime:hg-r-' + code; setTimeout(() => res('timeout ' + w.readyState), 4000); w.onerror = () => res('error'); w.onclose = () => res('closed');
      w.onopen = () => { w.send(JSON.stringify({ topic: t, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { enabled: true, key: '1zzzzzzzzzevilevil01' }, postgres_changes: [], private: false } }, ref: '1', join_ref: '1' }));
        setTimeout(() => { w.send(JSON.stringify({ topic: t, event: 'presence', payload: { type: 'presence', event: 'track', payload: { u: 'evilevil01', n: '<img src=x onerror=window.__x=1>Eve', c: 'XX', g: 'odin' } }, ref: '2', join_ref: '1' })); res('ok'); }, 200); }; }), [URL_, code]);
    ok(evr === 'ok', 'a raw client connects to the fake Realtime server', evr);
    ok(await until(A.pg, () => document.querySelectorAll('#onList .onP:not(.bot)').length === 4, null, 4000), 'Ann\'s list shows 4 players');
    const lst = await A.pg.evaluate(() => ({ rows: [...document.querySelectorAll('#onList .onP:not(.bot)')].map(e => e.textContent), imgs: document.querySelectorAll('img').length, x: window.__x, bot: document.querySelector('#onList .onP.bot').textContent, start: getComputedStyle(document.getElementById('onStart')).display }));
    ok(lst.rows.includes('🇫🇷Bob') && lst.rows.includes('🇺🇸Cat') && lst.rows.includes('img srcx onerror') && !lst.imgs && lst.x === undefined && /4 bots/.test(lst.bot) && lst.start !== 'none',
      'Bob 🇫🇷 and Cat 🇺🇸 listed; the hostile name is shown as cleaned text (no HTML, no flag for a bad country); 4 bots; the host sees Start now', lst);
    const bc0 = await B.pg.evaluate(() => ({ start: getComputedStyle(document.getElementById('onStart')).display, n: document.querySelectorAll('#onList .onP:not(.bot)').length }));
    ok(bc0.start === 'none' && bc0.n === 4, 'Bob (not the host) sees the same 4 players and no Start now', bc0);
    for (const P of [A, B, C]) {
      await P.pg.screenshot({ path: path.join(SHOTS, 'online_wait_' + P.w + '.png') });
      const inv = await box(P.pg, '#onInvite'), lv = await box(P.pg, '#onLeave'), st = await box(P.pg, '#onSt');
      ok(inView(inv) && inv.h >= 44 && inView(lv) && lv.h >= 44 && inView(st), P.w + 'x' + P.h + ': the wait screen fits (INVITE A FRIEND, Leave >= 44 px, the countdown in view)', { inv, lv });
    }

    /* -- the round -- */
    await A.pg.locator('#onStart').tap();
    let started = true; for (const P of [A, B, C]) started = await until(P.pg, () => G.S && G.S.online && !G.S.over && G.online.phase === 'play') && started;
    ok(started, 'Start now: the round starts on all three pages');
    const seatsOf = P => P.pg.evaluate(() => ({ names: G.S.ps.map(p => p.name), bots: G.S.ps.map(p => p.bot), flags: G.S.ps.map(p => p.flag || ''), me: G.S.me.name, client: !!G.S.client, n: G.S.ps.length, map: G.mapNo }));
    const sA = await seatsOf(A), sB = await seatsOf(B), sC = await seatsOf(C);
    ok(sA.n === 8 && JSON.stringify(sA.names) === JSON.stringify(sB.names) && JSON.stringify(sA.names) === JSON.stringify(sC.names) && sA.names.slice(0, 3).join() === 'Ann,Bob,Cat' && sA.bots.filter(x => x).length === 4 && sA.map === sB.map,
      'the same 8 seats everywhere: Ann, Bob, Cat, the stranger, then 4 bots; the same map', sA);
    ok(sA.flags.slice(0, 3).join(' ') === '🇬🇪 🇫🇷 🇺🇸' && !sA.client && sB.client && sC.client && sB.me === 'Bob' && sC.me === 'Cat', 'flags on the players; Ann hosts, Bob and Cat are clients', { flags: sA.flags, me: [sA.me, sB.me, sC.me] });
    await sleep(600);
    const hud = await B.pg.evaluate(() => ({ tr: document.getElementById('hTR').innerHTML, chip: document.getElementById('onChip').textContent, imgs: document.querySelectorAll('img').length }));
    ok(/\(bot\)/.test(hud.tr) && hud.tr.indexOf('<img') < 0 && /ONLINE · 4 players/.test(hud.chip) && !hud.imgs, 'the HUD board marks bots "(bot)", escapes names; the chip says ONLINE · 4 players', hud);
    for (const P of [A, B, C]) await P.pg.evaluate(() => { for (const p of G.S.ps) { p.inv = 0; } });

    /* -- the others see Bob move (Bob has edited his own numbers in the console meanwhile: window.G is public) -- */
    await B.pg.evaluate(() => { window.__cheat = true; const c = (n, v) => G.addMod(n, (p, x) => window.__cheat && G.S && p === G.S.me ? v : x);
      c('cd', 0.5); c('bankT', 0.1); c('rob', 0.05); c('chainT', 9); c('lokiT', 9); c('thorR', 900); c('thorShare', 0.9); });
    const b0 = { B: await hero(B.pg, 'Bob'), A: await hero(A.pg, 'Bob'), C: await hero(C.pg, 'Bob') };
    await B.pg.keyboard.down('d'); await sleep(1300); await B.pg.keyboard.up('d'); await sleep(700);
    const b1 = { B: await hero(B.pg, 'Bob'), A: await hero(A.pg, 'Bob'), C: await hero(C.pg, 'Bob') };
    ok(b1.B.x - b0.B.x > 150 && b1.A.x - b0.A.x > 150 && b1.C.x - b0.C.x > 150 && Math.abs(b1.A.x - b1.B.x) < 40 && Math.abs(b1.C.x - b1.B.x) < 60, 'Bob walks right on his page; the host and Cat see him move there too', { B: [b0.B.x, b1.B.x], A: [b0.A.x, b1.A.x], C: [b0.C.x, b1.C.x] });
    await until(A.pg, () => { const p = G.S.ps.find(q => q.name === 'Bob'); return p.nm && p.nm.cd < 4; }, null, 4000);
    const md = await A.pg.evaluate(() => { const p = G.S.ps.find(q => q.name === 'Bob'), r = n => Math.round(G.mod(n, p, -1) * 1e4) / 1e4;
      return { cd: r('cd'), bankT: r('bankT'), rob: r('rob'), chainT: r('chainT'), lokiT: r('lokiT'), thorR: r('thorR'), thorShare: r('thorShare') }; });
    await B.pg.evaluate(() => { window.__cheat = false; });
    ok(md.cd === 2.38 && md.bankT === 0.6375 && md.rob === 0.3185 && md.chainT === 3.45 && md.lokiT === 3.45 && md.thorR === 195.5 && md.thorShare === 0.28,
      'console-edited numbers reach the host only inside the legal range (Hermes cd >= 4 x 0.595, bank >= 0.6375 s, robbed share >= 31.85 %, skills <= +15 %)', md);
    const gc = await B.pg.evaluate(() => new Promise(res => { const S = G.S, me = S.me; let c = null, bd = 1e9;
      for (const k of S.coins) { const d = Math.hypot(k.x - me.x, k.y - me.y); if (d < bd) { bd = d; c = k; } }
      if (!c) { res({ none: true }); return; }
      const c0 = me.carry, t0 = performance.now(); let n = 0, off = 0, worst = 0, early = 0; me.x = c.x; me.y = c.y; me.vx = me.vy = 0;
      const f = () => { const d = G.total() - G.S.minted, dt = performance.now() - t0; n++; if (d) { off++; if (Math.abs(d) > Math.abs(worst)) worst = d; }
        if (dt < 150) early = Math.max(early, me.carry - c0); if (dt < 1500) requestAnimationFrame(f); else res({ n, off, worst, early, v: c.v, dist: Math.round(bd) }); };
      requestAnimationFrame(f); }));
    ok(!gc.none && gc.n > 20 && gc.off === 0 && gc.early >= gc.v, 'Bob steps on a coin: his carry grows at once, and on his page coins + carries + banks = minted in every frame', gc);

    /* -- a robbery between two real players: Bob (light) touches Cat (heavy) -- */
    const P0 = await A.pg.evaluate(() => {
      const S = G.S, W = G.WORLD; const far = [[700, 700], [3300, 700], [700, 3300], [3300, 3300], [2000, 2000], [2000, 700], [700, 2000]].map(([x, y]) => ({ x, y }))
        .sort((m, n) => Math.min(...S.vaults.map(v => Math.hypot(v.x - n.x, v.y - n.y))) - Math.min(...S.vaults.map(v => Math.hypot(v.x - m.x, v.y - m.y))))[0];
      // the test freezes the bots far away and gives Cat 100 gold (minted grows with it: gold stays conserved)
      S.ps.forEach((p, i) => { if (!p.bot && !p.net && p !== S.me) return; if (p.bot || p.name.startsWith('img')) { p.ai.t = 1e9; p.ai.dx = p.ai.dy = 0; p.vx = p.vy = 0; p.x = far.x > W / 2 ? 300 + i * 60 : W - 300 - i * 60; p.y = far.y > W / 2 ? 300 : W - 300; } });
      window.__freeze = setInterval(() => { for (const p of G.S.ps) if (p.bot) { p.ai.t = 1e9; p.ai.dx = p.ai.dy = 0; } }, 50);
      const bob = S.ps.find(p => p.name === 'Bob'), cat = S.ps.find(p => p.name === 'Cat'), ann = S.me;
      S.minted += 100 - cat.carry; cat.carry = 100; S.minted -= bob.carry; bob.carry = 0; S.minted -= ann.carry; ann.carry = 0;
      ann.x = far.x > W / 2 ? 400 : W - 400; ann.y = 2000; ann.vx = ann.vy = 0;
      for (const p of S.ps) { p.imm = 0; p.inv = 0; } S.pairT = {};
      return { x: far.x, y: far.y, off: G.total() - S.minted };
    });
    await C.pg.evaluate(P => { const me = G.S.me; me.x = P.x; me.y = P.y; me.vx = me.vy = 0; }, P0);
    await B.pg.evaluate(P => { const me = G.S.me; me.x = P.x + 700; me.y = P.y; me.vx = me.vy = 0;
      G.on('rob', (L) => { if (L === G.S.me && !window.__away) { window.__away = 1; G.S.me.x = P.x + 700; G.S.me.vx = G.S.me.vy = 0; } }); }, P0);
    // the host moves a hero at most 1200 units at once (then 1100/s): wait until it has both where their pages put them
    const at = async (P, n) => { const w = await P.pg.evaluate(() => [G.S.me.x, G.S.me.y]);
      return until(A.pg, ([n, x, y]) => { const p = G.S.ps.find(q => q.name === n); return Math.hypot(p.x - x, p.y - y) < 4; }, [n, w[0], w[1]], 7000); };
    const placed = (await at(C, 'Cat')) && (await at(B, 'Bob'));
    await sleep(700);
    await B.pg.evaluate(P => { const me = G.S.me; me.x = P.x + 34; me.y = P.y; me.vx = me.vy = 0; }, P0);
    const robbed = await until(A.pg, () => { const b = G.S.ps.find(p => p.name === 'Bob'); return b.robs >= 1; }, null, 4000);
    await sleep(900);
    const rA = { bob: await hero(A.pg, 'Bob'), cat: await hero(A.pg, 'Cat') }, rB = { bob: await hero(B.pg, 'Bob'), cat: await hero(B.pg, 'Cat') }, rC = { bob: await hero(C.pg, 'Bob'), cat: await hero(C.pg, 'Cat') };
    ok(placed, 'the host has Cat and Bob where their pages put them', { cat: await hero(A.pg, 'Cat'), bob: await hero(A.pg, 'Bob'), P: P0 });
    ok(robbed && rA.bob.carry >= 18 && rA.cat.lost >= 35 && rA.cat.carry < 100 && rA.bob.robs >= 1, 'the host decides the robbery: Bob (lighter) robbed Cat (heavier): 35% lost, half to Bob', { bob: rA.bob.carry, cat: rA.cat.carry, catLost: rA.cat.lost, robs: rA.bob.robs });
    ok(rB.bob.carry === rA.bob.carry && rB.cat.carry === rA.cat.carry && rC.bob.carry === rA.bob.carry && rC.cat.carry === rA.cat.carry && rC.cat.lost === rA.cat.lost,
      'the same carries on all three pages (host, thief, victim)', { A: [rA.bob.carry, rA.cat.carry], B: [rB.bob.carry, rB.cat.carry], C: [rC.bob.carry, rC.cat.carry] });
    const evB = await B.pg.evaluate(() => window.__rob.slice()), evC = await C.pg.evaluate(() => window.__rob.slice());
    ok(evB.some(e => e.L === 'Bob' && e.H === 'Cat' && e.me === 'Bob') && evC.some(e => e.L === 'Bob' && e.H === 'Cat' && e.me === 'Cat'), 'both players hear the robbery (toast, sound): Bob as the thief, Cat as the victim', { B: evB, C: evC });
    const g1 = await gold(A.pg);
    ok(g1.total - g1.minted === P0.off, 'gold conserved on the host after the robbery (coins + carried + banked = minted)', g1);

    /* -- Bob banks -- */
    let banked = false;
    for (let k = 0; k < 3 && !banked; k++) {
      const v = await A.pg.evaluate(() => { const v = G.S.vaults[0]; return { x: v.x, y: v.y, inT: G.S.vNext - G.S.t }; });
      await B.pg.evaluate(v => { const me = G.S.me; me.x = v.x; me.y = v.y; me.vx = me.vy = 0; }, v);
      banked = await until(A.pg, () => G.S.ps.find(p => p.name === 'Bob').bank > 0, null, 3500);
    }
    await sleep(700);
    const kA = await hero(A.pg, 'Bob'), kB = await hero(B.pg, 'Bob'), tl = await B.pg.evaluate(() => document.getElementById('hTL').textContent);
    ok(banked && kA.bank >= 18 && kA.carry === 0 && kB.bank === kA.bank && kB.carry === 0 && tl.indexOf('Banked ' + kA.bank) >= 0, 'Bob stands in a vault: the host banks his gold; his page and HUD show the same bank', { host: kA, bob: kB, hud: tl });
    const g2 = await gold(A.pg);
    ok(g2.total - g2.minted === P0.off, 'gold conserved on the host after banking', g2);

    /* -- a console teleport: the host moves a hero at most 1200 units at once, then 1100 units a second -- */
    await sleep(1200);   // the move budget refills
    const h0 = await hero(A.pg, 'Bob'), cap0 = await A.pg.evaluate(() => G.online.stats.capped || 0);
    const tp = await B.pg.evaluate(() => { const me = G.S.me, x = me.x < 2000 ? 3800 : 200, y = me.y < 2000 ? 3800 : 200; me.x = x; me.y = y; me.vx = me.vy = 0; return { x, y }; });
    const far = Math.hypot(tp.x - h0.x, tp.y - h0.y);
    await until(A.pg, h => { const p = G.S.ps.find(q => q.name === 'Bob'); return Math.hypot(p.x - h.x, p.y - h.y) > 300; }, h0, 3000);
    const h1 = await hero(A.pg, 'Bob'), step1 = Math.hypot(h1.x - h0.x, h1.y - h0.y);
    const reach = await until(A.pg, t => { const p = G.S.ps.find(q => q.name === 'Bob'); return Math.hypot(p.x - t.x, p.y - t.y) < 40; }, tp, 7000);
    const cap1 = await A.pg.evaluate(() => G.online.stats.capped || 0);
    ok(far > 2000 && step1 > 300 && step1 <= 1550 && reach && cap1 > cap0, 'Bob jumps ' + Math.round(far) + ' units in his console: the host moves him <= 1200 at once, then catches up at 1100 units/s', { far: Math.round(far), first: Math.round(step1), reach, capped: cap1 - cap0 });

    /* -- Cat's Loki trick: the others see her vanish and the decoy -- */
    await C.pg.keyboard.press(' ');
    const lk = await until(A.pg, () => { const c = G.S.ps.find(p => p.name === 'Cat'); return c.inv > G.S.t && G.S.decoys.some(d => d.owner === c); }, null, 3000);
    const lkB = await until(B.pg, () => G.S.decoys.some(d => d.owner.name === 'Cat') && G.S.ps.find(p => p.name === 'Cat').inv > G.S.t, null, 3000);
    ok(lk && lkB, 'Cat presses her skill: the host makes her vanish and leaves a decoy; Bob sees both');

    /* -- a player who never moves is marked "left"; the message rate -- */
    const left = await until(A.pg, () => G.S.ps.some(p => p.name.startsWith('img') && p.tag === 'left'), null, 6000);
    const leftB = await until(B.pg, () => G.S.ps.some(p => p.name.startsWith('img') && p.tag === 'left'), null, 3000);
    ok(left && leftB, 'the stranger who sends nothing shows as "left" on the host and on Bob\'s page');
    const m0 = JSON.parse(JSON.stringify(srv.st)), t0 = Date.now();
    await B.pg.keyboard.down('s'); await C.pg.keyboard.down('a'); await sleep(3000); await B.pg.keyboard.up('s'); await C.pg.keyboard.up('a');
    const m1 = srv.st, sec = (Date.now() - t0) / 1000, ev = ((m1.in - m0.in) + (m1.out - m0.out)) / sec;
    const rate = { eventsPerS: +ev.toFixed(1), states: +(((m1.byTopic['hg-r'] || {}).sent - (m0.byTopic['hg-r'] || {}).sent) / sec).toFixed(1), inputs: +(((m1.byTopic['hg-u'] || {}).sent - (m0.byTopic['hg-u'] || {}).sent) / sec).toFixed(1) };
    ok(rate.eventsPerS < 60 && rate.states >= 3 && rate.states <= 5.5 && rate.inputs >= 6 && rate.inputs <= 11.5, '4 seated players (2 moving): ~4 states/s, ~5 inputs/s per moving player, well under Free\'s 100 messages/s', rate);
    for (const P of [A, B, C]) await P.pg.screenshot({ path: path.join(SHOTS, 'online_play_' + P.w + '.png') });

    /* -- Cat's connection drops: she reconnects, rejoins the room and goes on in the same round -- */
    const uidC = await C.pg.evaluate(() => G.online.uid), upC = 'realtime:hg-u-' + code + '-' + uidC, S0 = await C.pg.evaluate(() => { window.__S0 = G.S; return G.S.t; });
    // Cat's room channel crashes on the server (phx_error) and her socket drops 300 ms later
    const crashAt = Date.now(), dups0 = srv.st.dups, cs = srv.crash('realtime:hg-r-' + code, uidC); await sleep(300); const kicked = srv.dropConns(cs);
    let rejoined = false; for (let i = 0; i < 80 && !rejoined; i++) { await sleep(100); rejoined = srv.joined(upC) > 0 && Object.keys(srv.presence('realtime:hg-r-' + code)).some(k => k.endsWith(uidC)); }
    const c0 = await hero(A.pg, 'Cat'); await C.pg.keyboard.down('a'); await sleep(900); await C.pg.keyboard.up('a'); await sleep(400); const c1 = await hero(A.pg, 'Cat');
    const same = await C.pg.evaluate(() => G.S === window.__S0 && !G.S.over && G.S.client && G.online.phase === 'play');
    ok(kicked === 1 && rejoined && same && c0.x - c1.x > 80 && c1.tag === '', 'Cat\'s socket drops: she reconnects, rejoins room and channel, and the host moves her again in the same round', { kicked, rejoined, same, x: [Math.round(c0.x), Math.round(c1.x)], tag: c1.tag });
    const jC = srv.st.joinLog.filter(j => j.topic === 'realtime:hg-r-' + code && j.key.endsWith(uidC) && j.at >= crashAt).map(j => j.at - crashAt);
    ok(jC.length === 1 && srv.st.dups === dups0 && Date.now() - crashAt > 2500, 'the channel error and the drop give exactly one rejoin: no duplicate join, no rejoin loop (a stale phx_close is ignored)', { joinsAtMs: jC, dups: srv.st.dups - dups0 });

    /* -- the host leaves: Bob (the next key) takes over from the last state -- */
    for (const P of [A, B, C]) ok(!P.errs.length && await errHidden(P.pg), P.name + ': no page errors so far, #err hidden', P.errs);
    const before = await B.pg.evaluate(() => ({ t: G.S.t, coins: G.S.coins.length, minted: G.S.minted })), keyB = await B.pg.evaluate(() => G.online.R.key);
    await A.pg.evaluate(() => clearInterval(window.__freeze));
    await B.pg.evaluate(() => { window.__skB = []; G.on('skill', p => window.__skB.push([p.name, !!G.S.client, +G.S.t.toFixed(2)])); });
    const skC = await C.pg.evaluate(() => G.online.R.skN);
    await A.ctx.close(); pages.splice(pages.indexOf(A), 1);
    const took = await until(B.pg, () => G.online.isHost() && !G.S.client, null, 6000);
    const follows = await until(C.pg, k => { const R = G.online.R; return R && R.hk === k && !G.online.isHost() && G.S.client && R.ep >= 2; }, keyB, 6000);
    await sleep(800);
    const hB = await B.pg.evaluate(() => ({ dbg: G.online.debug(), total: G.total(), minted: G.S.minted, fixes: G.online.stats.fixes, t: G.S.t, ann: G.S.ps.find(p => p.name === 'Ann').tag, client: G.S.client }));
    const hC = await C.pg.evaluate(() => ({ hk: G.online.R.hk, ep: G.online.R.ep, client: G.S.client, statesIn: G.online.stats.statesIn }));
    ok(took && follows && hB.dbg.hk === hC.hk && hB.dbg.ep === hC.ep && hB.t > before.t, 'Ann closes the game: Bob takes over as host (epoch 2), Cat follows him, the clock goes on', { B: hB.dbg, C: hC });
    ok(hB.total === hB.minted && hB.ann === 'left', 'the new host keeps every coin: gold conserved; Ann\'s hero stays in the round as "left"', hB);
    const s0 = hC.statesIn; await sleep(1200); const s1 = await C.pg.evaluate(() => G.online.stats.statesIn);
    ok(s1 - s0 >= 3, 'Cat receives the new host\'s states', { per1200ms: s1 - s0 });
    const mv0 = await hero(B.pg, 'Cat'); await C.pg.keyboard.down('w'); await sleep(1000); await C.pg.keyboard.up('w'); await sleep(500); const mv1 = await hero(B.pg, 'Cat');
    ok(mv0.y - mv1.y > 100, 'Cat\'s inputs now reach Bob, the new host', { y0: Math.round(mv0.y), y1: Math.round(mv1.y) });
    const ph = await B.pg.evaluate(() => ({ asHost: window.__skB.filter(e => e[0] === 'Cat' && !e[1]), adopted: G.S.ps.find(p => p.name === 'Cat').skN, decoy: G.S.decoys.some(d => d.owner.name === 'Cat') }));
    ok(skC >= 1 && !ph.asHost.length && !ph.decoy && ph.adopted === skC, 'Cat pressed her skill before the hand-over: the new host adopts her press count and plays no phantom skill', { skC, ph });

    /* -- the end: the host's last state ends the round everywhere; each one submits r.mode = 'online' -- */
    await B.pg.evaluate(() => { G.step(Math.max(0, Math.round((G.ROUND - G.S.t - 2) * 60))); });
    const g3 = await gold(B.pg);
    ok(g3.total === g3.minted && !g3.client, 'after running the round on to 2:28 on the new host, gold is still conserved', g3);
    const endB = await until(B.pg, () => document.getElementById('end').classList.contains('on'), null, 8000);
    const endC = await until(C.pg, () => document.getElementById('end').classList.contains('on'), null, 8000);
    await sleep(1200);
    const eB = await B.pg.evaluate(() => ({ res: window.__res, rank: document.getElementById('eRank').textContent, lines: document.getElementById('eLines').textContent, again: document.getElementById('again').textContent, banks: G.S.ps.map(p => [p.name, p.bank]) }));
    const eC = await C.pg.evaluate(() => ({ res: window.__res, rank: document.getElementById('eRank').textContent, lines: document.getElementById('eLines').textContent, banks: G.S.ps.map(p => [p.name, p.bank]) }));
    ok(endB && endC && JSON.stringify(eB.banks) === JSON.stringify(eC.banks), 'the bell: both end screens show, with the same final banks', { B: eB.banks, C: eC.banks });
    const rankOf = (banks, n) => banks.slice().sort((x, y) => y[1] - x[1]).findIndex(r => r[0] === n) + 1;
    ok(eB.res.rank === rankOf(eB.banks, 'Bob') && eC.res.rank === rankOf(eB.banks, 'Cat') && eB.res.mode === 'online' && eC.res.mode === 'online' && eB.res.players === 4,
      'each one\'s rank comes from the same banks; res.mode = online', { B: eB.res, C: eC.res });
    ok(/3 other players and 4 bots/.test(eC.lines) && eB.again === 'PLAY ONLINE AGAIN', 'the end lines count players and bots apart; PLAY AGAIN becomes PLAY ONLINE AGAIN', { lines: eC.lines, again: eB.again });
    const subB = B.M.submits, subC = C.M.submits;
    ok(subB.length === 1 && subC.length === 1 && subB[0].mode === 'online' && subC[0].mode === 'online' && subB[0].map === sA.map && subC[0].map === sA.map && subB[0].banked === eB.res.bank && subC[0].banked === eC.res.bank && subC[0].heroes === 8,
      'both submit their own round: hg_round_submit r.mode = online, r.map = today\'s map, their own bank', { B: subB[0], C: subC[0] });
    for (const P of [B, C]) await P.pg.screenshot({ path: path.join(SHOTS, 'online_end_' + P.w + '.png') });
    const ids = await Promise.all([B, C].map(P => P.pg.evaluate(ids => { const h = document.body.innerText + document.body.innerHTML; return ids.every(i => h.indexOf(String(i)) < 0); }, Object.values(TGIDS))));
    ok(ids.every(x => x), 'no Telegram id anywhere on the pages');
    await sleep(2200);
    const gone = await Promise.all([B, C].map(P => P.pg.evaluate(() => ({ R: !!G.online.R, phase: G.online.phase }))));
    ok(gone.every(g => !g.R && g.phase === 'off'), 'after the round the pages leave the room and close the socket', gone);
    for (const P of [B, C]) ok(!P.errs.length && await errHidden(P.pg), P.name + ': no page errors, #err hidden', P.errs);
    await B.ctx.close(); await C.ctx.close(); pages.length = 0; await evil.context().close();

    /* -- a full room starts at once (MAX = 2 here); a lone player plays with 7 bots after the wait -- */
    const D = await mkPage(b, { name: 'Dan', cc: 'DE', w: 390, h: 844, url: URL_, cfg: { MAX: 2, WAIT: 60 } }); pages.push(D);
    const E = await mkPage(b, { name: 'Eve', cc: 'JP', w: 390, h: 844, url: URL_, cfg: { MAX: 2, WAIT: 60 } }); pages.push(E);
    for (const P of [D, E]) await P.pg.evaluate(() => G.setDayGod('thor'));   // Thor's day: lightning every 30 s
    await D.pg.locator('#hgOnline').tap(); await until(D.pg, () => G.online.phase === 'wait' && G.online.isHost());
    await sleep(300);
    const tE = Date.now(); await E.pg.locator('#hgOnline').tap();
    const both = (await until(D.pg, () => G.S && G.S.online && G.online.phase === 'play', null, 6000)) && (await until(E.pg, () => G.S && G.S.online && G.online.phase === 'play', null, 6000));
    const nm = await E.pg.evaluate(() => G.S.ps.map(p => p.name).slice(0, 2).join());
    ok(both && Date.now() - tE < 5000 && nm === 'Dan,Eve', 'with the room full (MAX) the round starts at once, no wait', { ms: Date.now() - tE, nm });
    // the host runs past 0:30: its lightning decides; the client's own day-god strike (local only) is replaced by the next state
    await D.pg.evaluate(() => { const S = G.S; G.step(Math.max(0, Math.round((29.5 - S.t) * 60)));
      const q = S.ps[4], far = [[400, 400], [3600, 400], [400, 3600], [3600, 3600]].map(([x, y]) => ({ x, y })).sort((m, n) => Math.min(...S.vaults.map(v => Math.hypot(v.x - n.x, v.y - n.y))) - Math.min(...S.vaults.map(v => Math.hypot(v.x - m.x, v.y - m.y))))[0];
      q.carry += 120; S.minted += 120; q.ai.t = 1e9; q.ai.dx = q.ai.dy = 0; q.x = far.x; q.y = far.y; q.vx = q.vy = 0; G.step(90);
      window.__still = setInterval(() => { for (const p of G.S.ps) if (p.bot) { p.ai.t = 1e9; p.ai.dx = p.ai.dy = 0; } }, 50); });   // the bots stand still so both pages can be compared
    await sleep(1500);
    const th = await D.pg.evaluate(() => ({ strikes: G.dayGod.strikes.filter(s => s.hit).length, total: G.total(), minted: G.S.minted, carries: G.S.ps.map(p => p.carry) }));
    const te = await E.pg.evaluate(() => ({ carries: G.S.ps.map(p => p.carry), orphan: G.S.coins.filter(c => c.id == null).length, t: G.S.t }));
    ok(th.strikes >= 1 && th.total === th.minted && JSON.stringify(th.carries) === JSON.stringify(te.carries) && !te.orphan, 'Thor\'s day online: the host\'s lightning strikes, gold conserved; the client shows the host\'s carries and coins only', { th, te });
    /* -- a bot robs a real player: the player's toast names it "(bot)" -- */
    const spot = await D.pg.evaluate(() => { const S = G.S, e = S.ps.find(p => p.name === 'Eve'); if (!S.vaults.some(v => G.dist(v, e) < v.r + 100)) return null;
      for (const [x, y] of [[600, 600], [3400, 600], [600, 3400], [3400, 3400], [2000, 2000]]) if (!S.vaults.some(v => Math.hypot(v.x - x, v.y - y) < v.r + 300)) return { x, y }; return null; });
    if (spot) { await E.pg.evaluate(s => { const me = G.S.me; me.x = s.x; me.y = s.y; me.vx = me.vy = 0; }, spot); await until(D.pg, s => { const e = G.S.ps.find(p => p.name === 'Eve'); return Math.hypot(e.x - s.x, e.y - s.y) < 30; }, spot, 7000); }
    await E.pg.evaluate(() => { window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
    const thief = await D.pg.evaluate(() => { const S = G.S, e = S.ps.find(p => p.name === 'Eve'), q = S.ps.find(p => p.bot);
      S.minted -= q.carry; q.carry = 0; S.minted += 60 - e.carry; e.carry = 60;   // gold stays conserved
      q.ai.t = 1e9; q.ai.dx = q.ai.dy = 0; q.vx = q.vy = 0; q.imm = q.inv = e.imm = e.inv = 0; q.x = e.x + 10; q.y = e.y; S.pairT = {}; return q.name; });
    const bt = await until(E.pg, n => window.__toasts.some(t => t.indexOf(n + ' (bot) robbed you: -') === 0), thief, 3000);
    const g4 = await gold(D.pg);
    ok(bt && g4.total === g4.minted, 'a bot robs Eve online: her toast says "' + thief + ' (bot) robbed you"; gold conserved on the host', { toasts: await E.pg.evaluate(() => window.__toasts.slice(-3)), g4 });
    const F = await mkPage(b, { name: 'Fay', cc: 'BR', w: 390, h: 844, url: URL_, cfg: { WAIT: 2 } }); pages.push(F);
    await F.pg.locator('#hgOnline').tap();
    const solo = await until(F.pg, () => G.S && G.S.online && G.online.phase === 'play', null, 7000);
    const fs_ = await F.pg.evaluate(() => ({ humans: G.S.ps.filter(p => !p.bot).length, bots: G.S.ps.filter(p => p.bot).length, client: G.S.client, host: G.online.isHost() }));
    await sleep(800); const sentF = await F.pg.evaluate(() => G.online.stats.states);
    ok(solo && fs_.humans === 1 && fs_.bots === 7 && !fs_.client && sentF <= 1, 'alone after the wait: the round starts with 7 bots, nothing is broadcast to nobody', { fs_, sentF });
    for (const P of [D, E, F]) ok(!P.errs.length && await errHidden(P.pg), P.name + ': no page errors, #err hidden', P.errs);
    /* -- two players open rooms at the same moment: the rooms merge into one -- */
    const Gp = await mkPage(b, { name: 'Gus', cc: 'IT', w: 390, h: 844, url: URL_, cfg: { WAIT: 60 } }); pages.push(Gp);
    const Hp = await mkPage(b, { name: 'Hal', cc: 'ES', w: 390, h: 844, url: URL_, cfg: { WAIT: 60 } }); pages.push(Hp);
    await Promise.all([Gp.pg.evaluate(() => G.online.play()), Hp.pg.evaluate(() => G.online.play())]);
    const mg = await until(Gp.pg, () => G.online.R && G.online.R.ch.joined && G.online.members().length === 2, null, 9000) && await until(Hp.pg, () => G.online.R && G.online.R.ch.joined && G.online.members().length === 2, null, 4000);
    const rg = await Gp.pg.evaluate(() => ({ room: G.online.room, merges: G.online.stats.merges, host: G.online.isHost() })), rh = await Hp.pg.evaluate(() => ({ room: G.online.room, merges: G.online.stats.merges, host: G.online.isHost() }));
    ok(mg && rg.room === rh.room && rg.host !== rh.host, 'two players who tap PLAY ONLINE at the same moment end in one room with one host', { rg, rh });
    for (const P of [Gp, Hp]) ok(!P.errs.length && await errHidden(P.pg), P.name + ': no page errors, #err hidden', P.errs);
    ok(srv.st.hb >= 1, 'heartbeats on the phoenix topic', srv.st.hb);
    const real = await F.pg.evaluate(() => { const u = G.online.url; G.online.url = null; const r = G.online.socketURL(); G.online.url = u; return r; });
    ok(real === 'wss://acimxvnupgpronpohheb.supabase.co/realtime/v1/websocket?apikey=sb_publishable_IdiZ6FC3GwAEZ8AkBeBg0g_doDtulMB&vsn=1.0.0', 'without a test URL the socket goes to the project\'s Realtime with the publishable key, vsn 1.0.0', real);
  } catch (e) { console.error(e); fails++; }
  for (const P of pages) { try { await P.ctx.close(); } catch (e) {} }
  await b.close(); srv.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
