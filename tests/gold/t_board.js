// tests/gold/t_board.js — Heavy Gold boards: a round end submits the right r (the round run out with G.step), the end line
// "This week: total X · best Y · #rank", this week's top 3 on the end screen (me marked), the board tabs THIS WEEK / ALL TIME ×
// PLAYERS / COUNTRIES with the mocked data (me highlighted, "You: #N" pinned outside the top 20), too_fast, the title podium
// (LAST WEEK'S CHAMPIONS #2 · #1 · #3, flags next to the names; the fallback THIS WEEK SO FAR; nothing when both are empty),
// offline texts, no Telegram id anywhere in the DOM, and the layout at 390x844, 844x390 and 640x360 (screenshots in .shots/).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const TOKEN = '3c9e1f2a-5b6d-4e7f-8a90-b1c2d3e4f5a6', TGID = 918273645, ROWID = 5550001;
const ME = { name: 'Nino Test', country: 'GE' };
const CC = ['GE', 'FR', 'US', 'JP', 'BR', 'DE', 'IN', 'TR', 'UA', 'IT'];

/* mocked boards (each row also carries a tg_id the client must never show) */
function board(scope, o) {
  const players = []; for (let i = 0; i < (o.n == null ? 20 : o.n); i++) {
    const mine = o.mineAt === i + 1;
    players.push({ name: mine ? ME.name : (o.names && o.names[i]) || ('Player ' + String.fromCharCode(65 + i)), country: mine ? ME.country : CC[i % CC.length],
      total: 3000 - i * 111, best: 900 - i * 20, rounds: 40 - i, mine, tg_id: ROWID + i });
  }
  const countries = o.n === 0 ? [] : [{ country: 'FR', players: 9, rounds: 60, gold: 9100, tg_id: ROWID }, { country: 'GE', players: 14, rounds: 120, gold: 15400 }, { country: 'JP', players: 3, rounds: 11, gold: 2100 }];
  return { scope, since: '2026-11-23T00:00:00Z', until: scope === 'last' ? '2026-11-23T00:00:00Z' : undefined, players, me: o.me === undefined ? null : o.me, countries, totals: o.totals || { players: o.n === 0 ? 0 : 57, rounds: o.n === 0 ? 0 : 311 } };
}
const DATA = {
  full: { last: board('last', { names: ['Giorgi', 'Marie', 'Kenji', 'Ana'], n: 4 }), week: board('week', { mineAt: 2, me: { rank: 2, total: 2889, best: 880, rounds: 39 } }), all: board('all', { me: { rank: 31, total: 120, best: 60, rounds: 4 }, totals: { players: 140, rounds: 2400 } }) },
  fallback: { last: board('last', { n: 0 }), week: board('week', { names: ['Luka', 'Sofia', 'Omar'], n: 3 }), all: board('all', { n: 3 }) },
  empty: { last: board('last', { n: 0 }), week: board('week', { n: 0 }), all: board('all', { n: 0 }) }
};

async function setup(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, hasTouch: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const M = { calls: [], data: DATA[o.data || 'full'], submits: 0, loginFail: !!o.loginFail };
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await pg.route(/telegram\.org/, r => r.abort());
  await pg.route(/supabase\.co/, async route => {
    const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const mm = rq.url().match(/\/rest\/v1\/rpc\/(\w+)$/); if (!mm) return route.abort();
    const name = mm[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
    M.calls.push({ name, body });
    const send = (j, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(j) });
    if (name === 'tg_login') { if (M.loginFail) { await new Promise(r => setTimeout(r, 600)); return send({ message: 'bad init data' }, 400); } return send({ token: TOKEN, tg_id: TGID, name: 'Nino Test' }); }
    if (!body || body.token !== TOKEN) return send({ message: 'bad session' }, 400);
    if (name === 'hg_profile_get') return send({ name: ME.name, country: ME.country });
    if (name === 'hg_profile_set') return send({ ok: true, name: body.name, country: body.country });
    if (name === 'hg_round_submit') { M.submits++; return send(M.submits === 1 ? { ok: true, week: { total: 345, best: 200, rounds: 3, rank: 7 } } : { error: 'too_fast' }); }
    if (name === 'hg_board') { const d = M.data[body.scope]; return d ? send(d) : send({ error: 'bad_scope' }); }
    return send({ message: 'no function ' + name }, 404);
  });
  if (o.tg !== false) await pg.addInitScript(([u, id]) => {
    const init = 'query_id=AAE1&user=' + encodeURIComponent(JSON.stringify(Object.assign({ id }, u))) + '&auth_date=1763900000&hash=0f1e2d3c4b5a69788796a5b4c3d2e1f0';
    window.Telegram = { WebApp: { initData: init, initDataUnsafe: { user: Object.assign({ id }, u) }, platform: 'ios', version: '8.0', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {}, HapticFeedback: { impactOccurred() {} }, openTelegramLink() {} } };
  }, [{ first_name: 'Nino', language_code: 'en' }, TGID]);
  await pg.addInitScript(p => localStorage.setItem('hg_profile', JSON.stringify(p)), ME);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.net && G.board);
  if (o.tg !== false && !o.loginFail) await pg.waitForFunction(() => G.net.on, null, { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return { ctx, pg, M, errs, n: name => M.calls.filter(c => c.name === name) };
}
/* every rendered text and attribute outside the scripts: no Telegram id, no "tg_id" */
const noIds = pg => pg.evaluate(([a, b]) => { const c = document.body.cloneNode(true); for (const s of c.querySelectorAll('script,style')) s.remove(); const h = c.outerHTML + document.body.innerText; return !/tg_id/i.test(h) && h.indexOf(String(a)) < 0 && h.indexOf(String(b)) < 0; }, [TGID, ROWID]);
const errHidden = pg => pg.evaluate(() => getComputedStyle(document.getElementById('err')).display === 'none');
const podInfo = pg => pg.evaluate(() => {
  const p = document.getElementById('hgPod'); if (!p || p.hidden || !p.isConnected) return { shown: false, text: p ? p.textContent : '' };
  const ex = document.getElementById('titleExtra'), pr = p.getBoundingClientRect();
  const items = [...p.querySelectorAll('.hgPl')].map(e => { const nm = e.querySelector('.nm'), f = e.querySelector('.nm .f'), n = e.querySelector('.nm .n'), g = e.querySelector('.g'), fr = f.getBoundingClientRect(), nr = n.getBoundingClientRect(), r = e.getBoundingClientRect();
    return { rank: +e.dataset.rank, flag: f.textContent, name: n.textContent, total: g.textContent, size: parseFloat(getComputedStyle(nm).fontSize), color: getComputedStyle(nm).color, gap: Math.round(nr.left - fr.right), sameLine: Math.abs((fr.top + fr.bottom) / 2 - (nr.top + nr.bottom) / 2) < 8, top: Math.round(r.top), bottom: Math.round(r.bottom), x: Math.round(r.left), gBelow: g.getBoundingClientRect().top >= nr.bottom - 2 }; });
  return { shown: true, first: ex.firstElementChild === p, head: p.querySelector('.hgPodH').textContent, items, h: Math.round(pr.height), left: Math.round(pr.left), right: Math.round(pr.right) };
});
async function playRound(pg) {
  await pg.locator('#play').tap(); await pg.waitForTimeout(150);
  return pg.evaluate(() => {
    window.__res = null; if (!window.__hooked) { window.__hooked = true; G.on('end', (S, res) => { window.__res = Object.assign({}, res); }); }
    G.dayGod = { key: 'thor', n: 'Thor' };
    const S = G.S, me = S.me, v = S.vaults[0]; me.carry += 40; S.minted += 40;    // a little gold to bank (minted kept equal to the total)
    for (let i = 0; i < 150 && me.carry; i++) { for (const o of S.ps) if (o !== me && Math.hypot(o.x - v.x, o.y - v.y) < 500) { o.x = v.x + (v.x < 2000 ? 1500 : -1500); o.y = v.y; } me.x = v.x; me.y = v.y; me.vx = me.vy = 0; G.step(1); }
    let g = 0; while (!S.over && g++ < 100000) G.step(60);
    return { over: S.over, res: window.__res };
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------- 1. portrait, in Telegram: podium, a round, the end line + top 3, the board tabs, too_fast ---------- */
  {
    const T = await setup(b, { w: 390, h: 844 }); const { pg } = T;
    const P = await podInfo(pg);
    ok(P.shown && P.first && P.head === "LAST WEEK'S CHAMPIONS" && T.n('hg_board').some(c => c.body.scope === 'last'), "the title shows LAST WEEK'S CHAMPIONS from hg_board(token, 'last'), first in #titleExtra", { head: P.head, first: P.first });
    const order = P.items ? P.items.map(i => i.rank).join() : '';
    ok(order === '2,1,3' && P.items[1].x > P.items[0].x && P.items[2].x > P.items[1].x, 'the podium order: #2 left, #1 in the middle, #3 right', order);
    const [p2, p1, p3] = P.items || [];
    ok(p1 && p1.size >= 24 && p1.size <= 28 && p1.size > p2.size && p1.size > p3.size && p1.color === 'rgb(232, 184, 74)' && p2.color === 'rgb(201, 210, 220)' && p3.color === 'rgb(208, 138, 78)',
      '#1 is the largest (24–28 px, gold), #2 silver, #3 bronze', P.items && P.items.map(i => ({ r: i.rank, s: i.size, c: i.color })));
    ok(P.items && P.items.map(i => i.flag + ' ' + i.name).join(' | ') === '🇫🇷 Marie | 🇬🇪 Giorgi | 🇺🇸 Kenji' && P.items.every(i => i.sameLine && i.gap >= 0 && i.gap <= 10),
      'each name has its flag right next to it, on the same line', P.items && P.items.map(i => ({ f: i.flag, n: i.name, gap: i.gap })));
    ok(P.items && P.items.map(i => i.total).join('|') === '2,889 gold|3,000 gold|2,778 gold' && P.items.every(i => i.gBelow), 'the total gold is under each name', P.items && P.items.map(i => i.total));
    const t3 = await pg.evaluate(() => G.board.top3('title'));
    ok(t3.length === 3 && t3.map(r => r.rank + r.flag + r.name + ':' + r.total).join() === '1🇬🇪Giorgi:3000,2🇫🇷Marie:2889,3🇺🇸Kenji:2778' && await pg.evaluate(() => G.board.top3('last').length === 3),
      'G.board.top3("title") returns the rows it rendered (rank, flag, name, total)', t3);
    const play0 = await pg.locator('#play').boundingBox();
    ok(play0.y >= 0 && play0.y + play0.height <= 844, '390x844: PLAY stays on the screen under the podium', play0);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_podium_390.png') });
    ok(await noIds(pg), 'title: no Telegram id or "tg_id" in the DOM', null);
    // a round
    const R = await playRound(pg);
    await pg.waitForFunction(() => /This week/.test(document.getElementById('hgWeek').textContent), null, { timeout: 5000 }).catch(() => {});
    const sub = T.n('hg_round_submit')[0], res = R.res;
    const want = res && { god: res.god, banked: res.bank, rank: res.rank, heroes: res.of, robs: res.robs, lost: res.lost, minted: res.minted, day: 'thor' };
    ok(R.over && sub && sub.body.token === TOKEN && JSON.stringify(sub.body.r) === JSON.stringify(want) && res.bank >= 40, 'a round end submits hg_round_submit(token, r) with r = {god, banked, rank, heroes, robs, lost, minted, day}', { sent: sub && sub.body.r, want });
    const wk = await pg.locator('#hgWeek').textContent();
    ok(wk === 'This week: total 345 · best 200 · #7', 'the end line: "This week: total X · best Y · #rank"', wk);
    await pg.waitForFunction(() => !document.getElementById('hgTop').hidden, null, { timeout: 4000 }).catch(() => {});
    const et = await pg.evaluate(() => [...document.querySelectorAll('#hgTop .hgT')].map(e => ({ r: +e.dataset.rank, t: e.textContent, me: e.classList.contains('me'), s: parseFloat(getComputedStyle(e).fontSize) })));
    ok(et.length === 3 && et.map(e => e.r).join() === '1,2,3' && et[0].s > et[1].s && et[1].me && /YOU/.test(et[1].t) && !et[0].me && /🇬🇪/.test(et[1].t), "the end screen shows this week's top 3 (#1 bigger, my row marked)", et);
    ok((await pg.evaluate(() => G.board.top3('end'))).length === 3, 'G.board.top3("end") returns the end rows', null);
    const again = await pg.locator('#again').boundingBox();
    ok(again.y + again.height <= 844, '390x844: PLAY AGAIN stays on the screen', again);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_end_board_390.png') });
    // the board
    await pg.locator('#hgEndBoard').tap(); await pg.waitForTimeout(300);
    const B1 = await pg.evaluate(() => ({ on: document.getElementById('hgBoard').classList.contains('on'), scope: document.querySelector('#hgScope .on').textContent, kind: document.querySelector('#hgKind .on').textContent,
      rows: [...document.querySelectorAll('#hgBody .hgRow:not(.hd)')].map(r => [...r.children].map(c => c.textContent)), me: [...document.querySelectorAll('#hgBody .hgRow.me')].map(r => r.dataset.rank), tot: document.getElementById('hgTot').textContent, pin: !document.getElementById('hgPin').hidden }));
    ok(B1.on && B1.scope === 'THIS WEEK' && B1.kind === 'PLAYERS' && B1.rows.length === 20, 'Leaderboard opens THIS WEEK · PLAYERS with 20 rows', { scope: B1.scope, kind: B1.kind, n: B1.rows.length });
    ok(JSON.stringify(B1.rows[0]) === JSON.stringify(['1', '🇬🇪', 'Player A', '3,000', '900', '40']), 'a player row: rank, flag, name, total, best, rounds', B1.rows[0]);
    ok(B1.me.join() === '2' && B1.rows[1][2] === ME.name && !B1.pin, 'my row is highlighted; inside the top 20 nothing is pinned', { me: B1.me, pin: B1.pin });
    ok(B1.tot === '57 players · 311 rounds this week', 'the totals line: "N players · M rounds this week"', B1.tot);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_board_week_390.png') });
    await pg.locator('#hgKind button[data-k="countries"]').tap(); await pg.waitForTimeout(150);
    const C1 = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#hgBody .hgRow:not(.hd)')].map(r => [...r.children].map(c => c.textContent)), head: [...document.querySelectorAll('#hgBody .hgRow.hd span')].map(c => c.textContent), me: [...document.querySelectorAll('#hgBody .hgRow.me')].map(r => r.dataset.cc) }));
    ok(C1.rows.length === 3 && JSON.stringify(C1.rows[0]) === JSON.stringify(['1', '🇬🇪', 'Georgia', '14', '120', '15,400']) && C1.rows[1][2] === 'France' && C1.head.join('|') === '#||Country|Players|Rounds|Gold' && C1.me.join() === 'GE',
      'COUNTRIES: flag, name, players, rounds, gold (by gold; my country highlighted)', C1);
    await pg.locator('#hgScope button[data-k="all"]').tap(); await pg.waitForTimeout(300);
    await pg.locator('#hgKind button[data-k="players"]').tap(); await pg.waitForTimeout(150);
    const A1 = await pg.evaluate(() => ({ n: document.querySelectorAll('#hgBody .hgRow:not(.hd)').length, me: document.querySelectorAll('#hgBody .hgRow.me').length, pin: document.getElementById('hgPin').hidden ? '' : document.getElementById('hgPin').textContent, tot: document.getElementById('hgTot').textContent, pinBox: document.getElementById('hgPin').getBoundingClientRect().bottom }));
    ok(A1.n === 20 && A1.me === 0 && /^You: #31/.test(A1.pin) && /total 120 · best 60 · 4 rounds/.test(A1.pin) && A1.pinBox <= 844 && T.n('hg_board').some(c => c.body.scope === 'all'),
      'ALL TIME · PLAYERS: outside the top 20, "You: #31" is pinned at the bottom', A1);
    ok(A1.tot === '140 players · 2,400 rounds in all', 'ALL TIME totals line', A1.tot);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_board_all_390.png') });
    await pg.locator('#hgKind button[data-k="countries"]').tap(); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.querySelectorAll('#hgBody .hgRow:not(.hd)').length === 3 && document.getElementById('hgPin').hidden), 'ALL TIME · COUNTRIES renders', null);
    ok(await noIds(pg), 'board: no Telegram id or "tg_id" in the DOM (the rows carried tg_id; it is never shown)', null);
    await pg.locator('#hgClose').tap(); await pg.waitForTimeout(150);
    ok(!(await pg.evaluate(() => document.getElementById('hgBoard').classList.contains('on'))), 'CLOSE closes the board', null);
    // a second round right away: the server refuses it (too_fast)
    await pg.locator('#again').tap(); await pg.waitForTimeout(100);
    await pg.evaluate(() => { let g = 0; while (!G.S.over && g++ < 100000) G.step(60); });
    await pg.waitForFunction(() => /too soon/.test(document.getElementById('hgWeek').textContent), null, { timeout: 5000 }).catch(() => {});
    const w2 = await pg.locator('#hgWeek').textContent();
    ok(w2 === 'Not counted: too soon after your last round' && T.n('hg_round_submit').length === 2, 'too_fast from the server: a polite line', w2);
    ok(!T.errs.length && await errHidden(pg), 'portrait run: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 2. the podium falls back to this week; nothing when both weeks are empty ---------- */
  {
    const T = await setup(b, { data: 'fallback' }); const P = await podInfo(T.pg);
    ok(P.shown && P.head === 'THIS WEEK SO FAR' && P.items.map(i => i.rank + i.flag + i.name).join() === '2🇫🇷Sofia,1🇬🇪Luka,3🇺🇸Omar', "no rounds last week: THIS WEEK SO FAR with this week's top 3", P);
    ok(await T.pg.evaluate(() => G.board.top3('last').length === 0 && G.board.top3('week').length === 3), 'top3("last") is empty, top3("week") has the rows', null);
    await T.ctx.close();
  }
  {
    const T = await setup(b, { data: 'empty' }); const P = await podInfo(T.pg);
    const ex = await T.pg.evaluate(() => ({ kids: document.getElementById('titleExtra').children.length, top3: G.board.top3('title').length }));
    ok(!P.shown && ex.top3 === 0 && !/CHAMPIONS|SO FAR/.test(await T.pg.evaluate(() => document.body.innerText)), 'both weeks empty: no podium, no names', { P, ex });
    await T.pg.locator('#hgTitleBoard').tap(); await T.pg.waitForTimeout(300);
    const t = await T.pg.evaluate(() => ({ body: document.getElementById('hgBody').textContent, tot: document.getElementById('hgTot').textContent }));
    ok(/No rounds yet this week/.test(t.body) && t.tot === '0 players · 0 rounds this week', 'an empty board says so (real zeros, nothing invented)', t);
    await T.ctx.close();
  }

  /* ---------- 3. offline (no Telegram): no podium, the board text, the end line; nothing sent ---------- */
  {
    const T = await setup(b, { tg: false, w: 844, h: 390 }); const { pg } = T;
    const P = await podInfo(pg);
    ok(!P.shown, 'offline: no podium', P);
    await pg.locator('#hgTitleBoard').tap(); await pg.waitForTimeout(200);
    const t = await pg.evaluate(() => ({ body: document.getElementById('hgBody').textContent, tabs: document.getElementById('hgTabs').hidden }));
    ok(t.body === 'Open HOLDOR in Telegram to see the boards' && t.tabs, 'offline: the board says "Open HOLDOR in Telegram to see the boards"', t);
    await pg.locator('#hgClose').tap();
    const R = await playRound(pg); await pg.waitForTimeout(200);
    const w = await pg.evaluate(() => ({ line: document.getElementById('hgWeek').textContent, top: document.getElementById('hgTop').hidden }));
    ok(R.over && w.line === 'Saved only on this phone' && w.top && T.M.calls.length === 0, 'offline: the end line says "Saved only on this phone", no top 3, nothing sent', { w, calls: T.M.calls.length });
    ok(!T.errs.length && await errHidden(pg), 'offline: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 3b. in Telegram but the login fails: the board offers "Try again", which logs in and loads ---------- */
  {
    const T = await setup(b, { loginFail: true }); const { pg, M } = T;
    await pg.locator('#hgTitleBoard').tap();
    const c0 = await pg.evaluate(() => document.getElementById('hgBody').textContent);
    await pg.waitForFunction(() => !!document.getElementById('hgRetry'), null, { timeout: 4000 }).catch(() => {});
    const t = await pg.evaluate(() => ({ body: document.getElementById('hgBody').textContent, retry: !!document.getElementById('hgRetry'), pod: !!document.getElementById('hgPod'), net: { on: G.net.on, pending: G.net.pending, err: G.net.err } }));
    ok(/Connecting/.test(c0), 'the board says "Connecting…" while the login runs', c0);
    ok(/Could not reach the server/.test(t.body) && t.retry && !t.pod, 'a failed login: the board says it could not reach the server and offers "Try again"; no podium', t);
    M.loginFail = false;
    await pg.locator('#hgRetry').tap(); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => ({ on: G.net.on, n: document.querySelectorAll('#hgBody .hgRow:not(.hd)').length, pod: !!document.getElementById('hgPod') }));
    ok(r.on && r.n === 20 && r.pod, '"Try again" logs in, the board loads and the podium appears', r);
    ok(!T.errs.length && await errHidden(pg), 'failed login: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 4. the layout: 390x844, 844x390, 640x360 (podium, end screen, board) ---------- */
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const T = await setup(b, { w, h }); const { pg } = T;
    const P = await podInfo(pg), play = await pg.locator('#play').boundingBox(), short = h <= 500;
    const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const oneRow = P.shown && P.items.every(i => Math.abs(i.top - P.items[0].top) < 12) && P.h <= 34;
    ok(P.shown && P.left >= 0 && P.right <= w && wide <= 0 && (!short || P.h <= 64), w + 'x' + h + ': the podium fits' + (short ? ' in at most two short rows (two-column title)' : ''), { h: P.h, left: P.left, right: P.right, tops: P.items.map(i => i.top) });
    const playOn = play.y >= 0 && play.y + play.height <= h;
    if (w === 640) console.log('INFO ' + w + 'x' + h + ': PLAY at ' + Math.round(play.y) + '–' + Math.round(play.y + play.height) + ' (the core title alone already scrolls here: see the report)');
    else ok(playOn, w + 'x' + h + ': PLAY is on the screen with the podium', play);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_podium_' + w + '.png') });
    await playRound(pg);
    await pg.waitForFunction(() => !document.getElementById('hgTop').hidden, null, { timeout: 5000 }).catch(() => {});
    const E = await pg.evaluate(() => { const r = s => { const e = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(e.top), b: Math.round(e.bottom), l: Math.round(e.left), r: Math.round(e.right), h: Math.round(e.height) }; };
      return { box: r('#hgEnd'), btn: r('#hgEndBoard'), again: r('#again'), top: r('#hgTop'), wide: document.documentElement.scrollWidth - window.innerWidth }; });
    ok(E.btn.h >= 44 && E.box.l >= 0 && E.box.r <= w && E.wide <= 0 && (!short || E.again.b <= h), w + 'x' + h + ': the end box fits' + (short ? ', PLAY AGAIN still on screen (two-column end screen)' : '') + ' (Leaderboard ≥ 44 px)', E);
    if (w !== 640) ok(E.again.b <= h, w + 'x' + h + ': PLAY AGAIN is on the screen', E.again); else console.log('INFO ' + w + 'x' + h + ': PLAY AGAIN at ' + E.again.t + '–' + E.again.b + ' (the core end screen alone already scrolls here)');
    await pg.screenshot({ path: path.join(SHOTS, 'gold_end_board_' + w + '.png') });
    await pg.locator('#hgEndBoard').tap(); await pg.waitForTimeout(300);
    for (const [sc, k] of [['week', 'players'], ['all', 'players'], ['week', 'countries']]) {
      await pg.locator('#hgScope button[data-k="' + sc + '"]').tap(); await pg.locator('#hgKind button[data-k="' + k + '"]').tap(); await pg.waitForTimeout(250);
      const L = await pg.evaluate(() => { const scr = document.getElementById('hgBoard'), r = s => { const e = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(e.top), b: Math.round(e.bottom), h: Math.round(e.height) }; };
        const small = [...scr.querySelectorAll('button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(q => q.height < 44 || q.width < 44).length;
        const rows = [...document.querySelectorAll('#hgBody .hgRow')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
        return { close: r('#hgClose'), body: r('#hgBody'), pin: document.getElementById('hgPin').hidden ? null : r('#hgPin'), scroll: scr.scrollHeight - scr.clientHeight, wide: document.documentElement.scrollWidth - window.innerWidth, small, rows }; });
      ok(L.close.b <= h && L.close.h >= 44 && L.body.h >= 60 && L.scroll <= 1 && L.wide <= 0 && L.small === 0 && L.rows === 0 && (!L.pin || L.pin.b <= L.close.t),
        w + 'x' + h + ' board ' + sc + '/' + k + ': fits (CLOSE on screen, list ≥ 60 px, no page scroll, targets ≥ 44 px, rows not cut)', L);
      if (sc === 'all') await pg.screenshot({ path: path.join(SHOTS, 'gold_board_' + w + '.png') });
    }
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), w + 'x' + h + ': no Telegram id in the DOM, no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
