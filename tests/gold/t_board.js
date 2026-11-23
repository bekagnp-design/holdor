// tests/gold/t_board.js — Heavy Gold boards (UI rules: icons and numbers): a round end submits the right r (the round run out with G.step),
// the one end line ("Connecting…" → "🏆 #rank · total 🪙", "Not counted · too soon", "Offline · not counted", "Not counted · server" when the
// login works but the hg_* functions are missing, "Not counted · no name"), the 🏆 Boards icons (before Rules)
// in #titleLinks and #endLinks, the board tabs Week / Last week / All × Players / Countries with the mocked data (rows rank · flag · name ·
// gold, me highlighted, my row pinned outside the top 20), the compact title podium (LAST WEEK, 🥇 on #1 only, flags next to the names; the
// fallback THIS WEEK; nothing when both are empty), offline texts, no Telegram id anywhere in the DOM, short texts only, and the layout at
// 390x844, 844x390 and 640x360 (the title / end screens add no scroll; screenshots in .shots/).
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
  const M = { calls: [], data: DATA[o.data || 'full'], submits: 0, loginFail: !!o.loginFail, missing: !!o.missing };
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
    if (M.missing && /^hg_/.test(name)) return send({ code: 'PGRST202', message: 'Could not find the function public.' + name }, 404);   // g1 not applied
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
  const items = [...p.querySelectorAll('.hgPl')].map(e => { const nm = e.querySelector('.nm'), f = e.querySelector('.nm .f'), n = e.querySelector('.nm .n'), g = e.querySelector('.g'), rk = e.querySelector('.rk'), fr = f.getBoundingClientRect(), nr = n.getBoundingClientRect(), r = e.getBoundingClientRect();
    return { rank: +e.dataset.rank, medal: rk && rk.offsetParent ? rk.textContent : '', flag: f.textContent, name: n.textContent, total: g.textContent, size: parseFloat(getComputedStyle(nm).fontSize), color: getComputedStyle(nm).color, gap: Math.round(nr.left - fr.right), sameLine: Math.abs((fr.top + fr.bottom) / 2 - (nr.top + nr.bottom) / 2) < 8, top: Math.round(r.top), bottom: Math.round(r.bottom), x: Math.round(r.left), gBelow: g.getBoundingClientRect().top >= nr.bottom - 2, cut: n.scrollWidth > n.clientWidth + 1 }; });
  return { shown: true, first: ex.firstElementChild === p, head: p.querySelector('.hgPodH').textContent, items, h: Math.round(pr.height), left: Math.round(pr.left), right: Math.round(pr.right) };
});
/* UI rules: no visible text node longer than 40 characters inside `sel` (names are data and skipped) */
const longTexts = (pg, sel) => pg.evaluate(s => { const long = []; for (const root of document.querySelectorAll(s)) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.textContent.trim(), e = n.parentElement; if (!t || !e.offsetParent || e.closest('.n')) continue; if ([...t].length > 40) long.push(t); } } return long; }, sel);
/* the title / end screen with this module's parts (other modules' items in the slots set aside: they have their own tests).
   `base` = the scroll of the core screen alone; when it is 0 the screen must fit with no scroll and every icon on screen;
   otherwise this module must add no scroll (the core's overflow is reported, not counted here). */
const MINE = { title: ['hgPod', 'hgMe', 'hgTitleBoard', 'helpB'], end: ['hgEnd', 'hgEndBoard', 'share', 'change'] };
const SLOTS = { title: ['titleExtra', 'titleLinks'], end: ['endExtra', 'endLinks'] };
const screenFits = (pg, which, w, h) => pg.evaluate(([which, keep, slots, w, h]) => {
  const scr = document.getElementById(which), r = e => e.getBoundingClientRect(), on = b => b.top >= 0 && b.bottom <= h && b.left >= 0 && b.right <= w;
  const core = which === 'title' ? ['helpB'] : ['share', 'change'];
  const hid = [], hide = ids => { for (const id of slots) for (const c of document.getElementById(id).children) if (ids.indexOf(c.id) < 0 && c.style.display !== 'none') { hid.push(c); c.style.display = 'none'; } };
  hide(core); const base = scr.scrollHeight - scr.clientHeight; for (const c of hid.splice(0)) c.style.display = '';
  hide(keep);
  const pri = document.getElementById(which === 'title' ? 'play' : 'again'), links = slots[1], first = document.getElementById(core[0]);
  const out = { base, scroll: scr.scrollHeight - scr.clientHeight, pri: on(r(pri)),
    links: [...document.querySelectorAll('#' + links + ' > *')].filter(e => e.offsetParent).map(e => [e.id, base > 1 || on(r(e)), Math.round(r(e).width), Math.round(r(e).height), Math.round(r(e).top), Math.abs(r(e).top - r(first).top) < 2]) };
  /* one row is asked of icon buttons only: a wider .sec another module made of a core link (the share card) may wrap the row */
  out.allIb = [...document.querySelectorAll('#' + links + ' > *')].filter(e => e.offsetParent).every(e => e.classList.contains('ib'));
  for (const c of hid) c.style.display = '';
  out.ok = (base > 1 ? out.scroll <= base + 1 : out.scroll <= 1 && out.pri) && out.links.every(l => l[1] && l[2] >= 52 && l[3] >= 44 && (l[5] || !out.allIb)); return out; }, [which, MINE[which], SLOTS[which], w, h]);
const fitNote = (tag, f) => { if (f.base > 1) console.log('INFO ' + tag + ': the core screen alone scrolls ' + f.base + ' px (a core change; see the report); this module adds ' + (f.scroll - f.base) + ' px');
  if (!f.allIb && f.links.some(l => !l[5])) console.log('INFO ' + tag + ': the links row wraps because a link there is a wide .sec, not an .ib (' + f.links.map(l => l[0] + ' ' + l[2] + ' px').join(', ') + ')'); };
const icon = (pg, id) => pg.evaluate(id => { const b = document.getElementById(id); if (!b) return null; const q = b.getBoundingClientRect(); return { cls: b.className, parent: b.parentNode.id, text: b.textContent, i: (b.querySelector('i') || {}).textContent, w: Math.round(q.width), h: Math.round(q.height) }; }, id);
async function playRound(pg) {
  await pg.locator('#play').tap(); await pg.waitForTimeout(150);
  return pg.evaluate(() => {
    window.__res = null; if (!window.__hooked) { window.__hooked = true; G.on('end', (S, res) => { window.__res = Object.assign({}, res); }); }
    G.dayGod = { key: 'thor', n: 'Thor' };
    const S = G.S, me = S.me, v = S.vaults[0]; me.carry += 40; S.minted += 40;    // a little gold to bank (minted kept equal to the total)
    for (let i = 0; i < 150 && me.carry; i++) { for (const o of S.ps) if (o !== me && Math.hypot(o.x - v.x, o.y - v.y) < 500) { o.x = v.x + (v.x < 2000 ? 1500 : -1500); o.y = v.y; } me.x = v.x; me.y = v.y; me.vx = me.vy = 0; G.step(1); }
    let g = 0; while (!S.over && g++ < 100000) G.step(60);
    return { over: S.over, res: window.__res, line: document.getElementById('hgWeek').textContent };
  });
}
const rowsOf = pg => pg.evaluate(() => [...document.querySelectorAll('#hgBody .hgRow')].map(r => [...r.children].map(c => c.textContent)));

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------- 1. portrait, in Telegram: podium, a round, the end line, the board tabs, too_fast ---------- */
  {
    const T = await setup(b, { w: 390, h: 844 }); const { pg } = T;
    const P = await podInfo(pg);
    ok(P.shown && P.first && P.head === 'LAST WEEK' && T.n('hg_board').some(c => c.body.scope === 'last'), "the title shows the podium headed LAST WEEK from hg_board(token, 'last'), first in #titleExtra", { head: P.head, first: P.first });
    const order = P.items ? P.items.map(i => i.rank).join() : '';
    ok(order === '1,2,3' && P.items[1].x > P.items[0].x && P.items[2].x > P.items[1].x && P.items.every(i => Math.abs(i.top - P.items[0].top) < 12), 'the podium is one row, 1 · 2 · 3 left to right', P.items && P.items.map(i => [i.rank, i.x, i.top]));
    const [p1, p2, p3] = P.items || [];
    ok(p1 && p1.size > p2.size && p1.size > p3.size && p1.color === 'rgb(232, 184, 74)' && P.items.map(i => i.medal).join('') === '🥇', '#1 is the largest (gold); only #1 has a medal (🥇)', P.items && P.items.map(i => ({ r: i.rank, s: i.size, c: i.color, m: i.medal })));
    ok(P.items && P.items.map(i => i.flag + ' ' + i.name).join(' | ') === '🇬🇪 Giorgi | 🇫🇷 Marie | 🇺🇸 Kenji' && P.items.every(i => i.sameLine && i.gap >= 0 && i.gap <= 10 && !i.cut),
      'each name has its flag right next to it, on the same line, not cut', P.items && P.items.map(i => ({ f: i.flag, n: i.name, gap: i.gap, cut: i.cut })));
    ok(P.items && P.items.map(i => i.total).join('|') === '3,000|2,889|2,778' && P.items.every(i => i.gBelow), 'the gold (a number only) under each name', P.items && P.items.map(i => i.total));
    ok(P.h <= 60 && !(await longTexts(pg, '#hgPod')).length, 'the podium is compact (≤ 60 px), short texts only', P.h);
    const t3 = await pg.evaluate(() => G.board.top3('title'));
    ok(t3.length === 3 && t3.map(r => r.rank + r.flag + r.name + ':' + r.total).join() === '1🇬🇪Giorgi:3000,2🇫🇷Marie:2889,3🇺🇸Kenji:2778' && await pg.evaluate(() => G.board.top3('last').length === 3),
      'G.board.top3("title") returns the rows it rendered (rank, flag, name, total)', t3);
    const tb = await icon(pg, 'hgTitleBoard');
    ok(tb && tb.cls === 'ib' && tb.parent === 'titleLinks' && tb.text === '🏆Boards' && tb.w >= 52 && tb.h >= 52, 'the title link is an icon button 🏆 "Boards" in #titleLinks (≥ 52 px)', tb);
    const ord = await pg.evaluate(() => { const ids = [...document.getElementById('titleLinks').children].map(e => e.id); return { ids, ok: ids.indexOf('hgTitleBoard') < ids.indexOf('helpB') && ids.indexOf('hgMe') < ids.indexOf('helpB') }; });
    ok(ord.ok, 'Boards and the profile icon come before Rules in #titleLinks (Rules stays after them)', ord.ids);
    const tf = await screenFits(pg, 'title', 390, 844);
    ok(tf.ok, '390x844: the title with the podium and the icons fits, PLAY and every icon on screen', tf); fitNote('390x844 title', tf);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_podium_390.png') });
    ok(await noIds(pg), 'title: no Telegram id or "tg_id" in the DOM', null);
    // a round
    const R = await playRound(pg);
    ok(R.line === 'Connecting…', 'the end line says "Connecting…" while the submit waits', R.line);
    await pg.waitForFunction(() => /^🏆/.test(document.getElementById('hgWeek').textContent), null, { timeout: 5000 }).catch(() => {});
    const sub = T.n('hg_round_submit')[0], res = R.res;
    const want = res && { god: res.god, banked: res.bank, rank: res.rank, heroes: res.of, robs: res.robs, lost: res.lost, minted: res.minted, day: 'thor' };
    ok(R.over && sub && sub.body.token === TOKEN && JSON.stringify(sub.body.r) === JSON.stringify(want) && res.bank >= 40, 'a round end submits hg_round_submit(token, r) with r = {god, banked, rank, heroes, robs, lost, minted, day}', { sent: sub && sub.body.r, want });
    const wk = await pg.locator('#hgWeek').textContent();
    ok(wk === '🏆 #7 · 345 🪙', 'the end line: "🏆 #rank · total 🪙"', wk);
    const ex = await pg.evaluate(() => ({ mine: [...document.querySelectorAll('#hgEnd *')].map(e => e.id || e.className), lines: document.getElementById('hgEnd').getBoundingClientRect().height, top3: G.board.top3('end').length }));
    ok(ex.mine.join() === 'hgWeek' && ex.lines <= 24 && ex.top3 === 0, '#endExtra holds one line from this module (no top 3, no button); top3("end") is []', ex);
    const eb = await icon(pg, 'hgEndBoard');
    ok(eb && eb.cls === 'ib' && eb.parent === 'endLinks' && eb.text === '🏆Boards' && eb.w >= 52 && eb.h >= 52, 'the end screen has the 🏆 "Boards" icon in #endLinks (≥ 52 px)', eb);
    const ef = await screenFits(pg, 'end', 390, 844);
    ok(ef.ok && !(await longTexts(pg, '#hgEnd')).length, '390x844: the end screen fits, PLAY AGAIN and the icons on screen, one row of icons', ef); fitNote('390x844 end', ef);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_end_board_390.png') });
    // the board
    await pg.locator('#hgEndBoard').tap(); await pg.waitForTimeout(300);
    const B1 = await pg.evaluate(() => ({ on: document.getElementById('hgBoard').classList.contains('on'), h2: document.querySelector('#hgBoard h2').textContent, scope: document.querySelector('#hgScope .on').textContent, kind: document.querySelector('#hgKind .on').textContent,
      tabs: [...document.querySelectorAll('#hgTabs button')].map(b => b.textContent).join('|'), me: [...document.querySelectorAll('#hgBody .hgRow.me')].map(r => r.dataset.rank), tot: document.getElementById('hgTot').textContent, pin: !document.getElementById('hgPin').hidden }));
    const rows1 = await rowsOf(pg);
    ok(B1.on && B1.h2 === 'BOARDS' && await pg.evaluate(() => document.querySelector('#hgBoard .hgU').textContent === '🪙') && B1.scope === 'Week' && B1.kind === 'Players' && B1.tabs === 'Week|Last week|All|Players|Countries' && rows1.length === 20, 'Boards opens Week · Players with 20 rows (BOARDS 🪙; tabs Week / Last week / All × Players / Countries)', { B1, n: rows1.length });
    ok(JSON.stringify(rows1[0]) === JSON.stringify(['1', '🇬🇪', 'Player A', '3,000']), 'a player row: rank, flag, name, gold (no header row, no extra columns)', rows1[0]);
    ok(B1.me.join() === '2' && rows1[1][2] === ME.name && !B1.pin, 'my row is highlighted; inside the top 20 nothing is pinned', { me: B1.me, pin: B1.pin });
    ok(B1.tot === '👤 57', 'the header shows the player count only ("👤 57", real server totals)', B1.tot);
    ok(!(await longTexts(pg, '#hgBoard')).length, 'the board: no text longer than 40 characters', await longTexts(pg, '#hgBoard'));
    await pg.screenshot({ path: path.join(SHOTS, 'gold_board_week_390.png') });
    await pg.locator('#hgKind button[data-k="countries"]').tap(); await pg.waitForTimeout(150);
    const C1 = { rows: await rowsOf(pg), me: await pg.evaluate(() => [...document.querySelectorAll('#hgBody .hgRow.me')].map(r => r.dataset.cc)) };
    ok(C1.rows.length === 3 && JSON.stringify(C1.rows[0]) === JSON.stringify(['1', '🇬🇪', 'Georgia', '👤 14', '15,400']) && C1.rows[1][2] === 'France' && C1.me.join() === 'GE',
      'Countries: rank, flag, name, 👤 players, gold (by gold; my country highlighted)', C1);
    await pg.locator('#hgScope button[data-k="last"]').tap(); await pg.locator('#hgKind button[data-k="players"]').tap(); await pg.waitForTimeout(300);
    const L1 = await rowsOf(pg);
    ok(L1.length === 4 && L1.map(r => r[2]).join() === 'Giorgi,Marie,Kenji,Ana' && T.n('hg_board').some(c => c.body.scope === 'last'), "Last week: hg_board 'last' rows", L1.map(r => r[2]));
    await pg.locator('#hgScope button[data-k="all"]').tap(); await pg.waitForTimeout(300);
    const A1 = await pg.evaluate(() => ({ n: document.querySelectorAll('#hgBody .hgRow').length, me: document.querySelectorAll('#hgBody .hgRow.me').length, pin: document.getElementById('hgPin').hidden ? null : [...document.querySelectorAll('#hgPin .hgRow > *')].map(c => c.textContent), mine: !!document.querySelector('#hgPin .hgRow.me'), tot: document.getElementById('hgTot').textContent, pinBox: document.getElementById('hgPin').getBoundingClientRect().bottom }));
    ok(A1.n === 20 && A1.me === 0 && A1.mine && JSON.stringify(A1.pin) === JSON.stringify(['#31', '🇬🇪', ME.name, '120']) && A1.pinBox <= 844 && T.n('hg_board').some(c => c.body.scope === 'all'),
      'All · Players: outside the top 20 my own row (#31, flag, name, gold) is pinned under the list', A1);
    ok(A1.tot === '👤 140', 'All: the player count', A1.tot);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_board_all_390.png') });
    await pg.locator('#hgKind button[data-k="countries"]').tap(); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.querySelectorAll('#hgBody .hgRow').length === 3 && document.getElementById('hgPin').hidden), 'All · Countries renders', null);
    ok(await noIds(pg), 'board: no Telegram id or "tg_id" in the DOM (the rows carried tg_id; it is never shown)', null);
    await pg.locator('#hgClose').tap(); await pg.waitForTimeout(150);
    ok(!(await pg.evaluate(() => document.getElementById('hgBoard').classList.contains('on'))), 'CLOSE closes the board', null);
    // a second round right away: the server refuses it (too_fast)
    await pg.locator('#again').tap(); await pg.waitForTimeout(100);
    await pg.evaluate(() => { let g = 0; while (!G.S.over && g++ < 100000) G.step(60); });
    await pg.waitForFunction(() => /too soon/.test(document.getElementById('hgWeek').textContent), null, { timeout: 5000 }).catch(() => {});
    const w2 = await pg.locator('#hgWeek').textContent();
    ok(w2 === 'Not counted · too soon' && T.n('hg_round_submit').length === 2, 'too_fast from the server: "Not counted · too soon"', w2);
    ok(!T.errs.length && await errHidden(pg), 'portrait run: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 2. the podium falls back to this week; nothing when both weeks are empty ---------- */
  {
    const T = await setup(b, { data: 'fallback' }); const P = await podInfo(T.pg);
    ok(P.shown && P.head === 'THIS WEEK' && P.items.map(i => i.rank + i.flag + i.name).join() === '1🇬🇪Luka,2🇫🇷Sofia,3🇺🇸Omar', "no rounds last week: THIS WEEK with this week's top 3", P);
    ok(await T.pg.evaluate(() => G.board.top3('last').length === 0 && G.board.top3('week').length === 3), 'top3("last") is empty, top3("week") has the rows', null);
    await T.ctx.close();
  }
  {
    const T = await setup(b, { data: 'empty' }); const P = await podInfo(T.pg);
    const ex = await T.pg.evaluate(() => ({ kids: document.getElementById('titleExtra').children.length, top3: G.board.top3('title').length, pod: !!document.getElementById('hgPod') }));
    ok(!P.shown && ex.top3 === 0 && !ex.pod, 'both weeks empty: no podium, no names', { P, ex });
    await T.pg.locator('#hgTitleBoard').tap(); await T.pg.waitForTimeout(300);
    const t = await T.pg.evaluate(() => ({ body: document.getElementById('hgBody').textContent, tot: document.getElementById('hgTot').textContent }));
    ok(t.body === 'No rounds yet' && t.tot === '👤 0', 'an empty board says "No rounds yet" (real zeros, nothing invented)', t);
    await T.ctx.close();
  }

  /* ---------- 3. offline (no Telegram): no podium, the board text, the end line; nothing sent ---------- */
  {
    const T = await setup(b, { tg: false, w: 844, h: 390 }); const { pg } = T;
    const P = await podInfo(pg);
    ok(!P.shown, 'offline: no podium', P);
    await pg.locator('#hgTitleBoard').tap(); await pg.waitForTimeout(200);
    const t = await pg.evaluate(() => ({ body: document.getElementById('hgBody').textContent, tabs: document.getElementById('hgTabs').hidden, bh: Math.round(document.getElementById('hgBody').getBoundingClientRect().height) }));
    ok(t.body === 'Open in Telegram' && t.tabs && t.bh <= 90, 'offline: the board says "Open in Telegram" in a small box (no big empty panel)', t);
    await pg.locator('#hgClose').tap();
    const R = await playRound(pg); await pg.waitForTimeout(200);
    const w = await pg.evaluate(() => document.getElementById('hgWeek').textContent);
    ok(R.over && w === 'Offline · not counted' && T.M.calls.length === 0, 'offline: the end line says "Offline · not counted", nothing sent', { w, calls: T.M.calls.length });
    ok(!T.errs.length && await errHidden(pg), 'offline: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 3a. in Telegram, logged in, but the hg_* functions are missing (g1 not applied): "server", never "offline" ---------- */
  {
    const T = await setup(b, { missing: true }); const { pg } = T;
    const P = await podInfo(pg);
    ok(!P.shown, 'no hg_board on the server: no podium', P);
    await pg.locator('#hgTitleBoard').tap();
    await pg.waitForFunction(() => !!document.getElementById('hgRetry'), null, { timeout: 4000 }).catch(() => {});
    const t = await pg.evaluate(() => ({ on: G.net.on, body: document.getElementById('hgBody').textContent, retry: !!document.getElementById('hgRetry') }));
    ok(t.on && /^Server error/.test(t.body) && t.retry, 'logged in but hg_board missing: the board says "Server error" + ↻ Retry (not "Offline")', t);
    await pg.locator('#hgClose').tap();
    const R = await playRound(pg);
    await pg.waitForFunction(() => /server/.test(document.getElementById('hgWeek').textContent), null, { timeout: 5000 }).catch(() => {});
    const w = await pg.evaluate(() => document.getElementById('hgWeek').textContent);
    ok(R.over && w === 'Not counted · server' && T.n('hg_round_submit').length === 1, 'logged in but hg_round_submit missing: the end line says "Not counted · server"', w);
    const np = await pg.evaluate(async () => { const keep = G.profile; G.profile = {}; G.emit('end', G.S, { god: 'thor', bank: 5, rank: 1, of: 8, robs: 0, lost: 0, minted: 5 }); await new Promise(r => setTimeout(r, 100)); const t = document.getElementById('hgWeek').textContent; G.profile = keep; return t; });
    ok(np === 'Not counted · no name' && T.n('hg_round_submit').length === 1, 'no profile: "Not counted · no name", nothing sent', np);
    ok(!T.errs.length && await errHidden(pg), 'missing functions: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 3b. in Telegram but the login fails: the board offers Retry, which logs in and loads ---------- */
  {
    const T = await setup(b, { loginFail: true }); const { pg, M } = T;
    await pg.locator('#hgTitleBoard').tap();
    const c0 = await pg.evaluate(() => document.getElementById('hgBody').textContent);
    await pg.waitForFunction(() => !!document.getElementById('hgRetry'), null, { timeout: 4000 }).catch(() => {});
    const t = await pg.evaluate(() => ({ body: document.getElementById('hgBody').textContent, retry: document.getElementById('hgRetry') && document.getElementById('hgRetry').getBoundingClientRect().height, pod: !!document.getElementById('hgPod') }));
    ok(/Connecting/.test(c0), 'the board says "Connecting…" while the login runs', c0);
    ok(/^Offline/.test(t.body) && t.retry >= 44 && !t.pod, 'a failed login: the board says "Offline" and offers ↻ Retry (≥ 44 px); no podium', t);
    M.loginFail = false;
    await pg.locator('#hgRetry').tap(); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => ({ on: G.net.on, n: document.querySelectorAll('#hgBody .hgRow').length, pod: !!document.getElementById('hgPod') }));
    ok(r.on && r.n === 20 && r.pod, 'Retry logs in, the board loads and the podium appears', r);
    ok(!T.errs.length && await errHidden(pg), 'failed login: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 4. the layout: 390x844, 844x390, 640x360 (title + podium, end screen, board) ---------- */
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const T = await setup(b, { w, h }); const { pg } = T; const tag = w + 'x' + h;
    const P = await podInfo(pg), wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const oneRow = P.shown && P.items.every(i => Math.abs(i.top - P.items[0].top) < 12);
    ok(oneRow && P.left >= 0 && P.right <= w && wide <= 0 && P.h <= (h <= 500 ? 50 : 60) && P.items.every(i => !i.cut || [...i.name].length > 8), tag + ': the podium is one compact row inside the screen (names of up to 8 letters are not cut)', { h: P.h, left: P.left, right: P.right, items: P.items.map(i => [i.name, i.top, i.cut]) });
    const tf = await screenFits(pg, 'title', w, h);
    ok(tf.ok, tag + ': the title with the podium and the icons adds no scroll (none at all once the core fits); the icons share one row', tf); fitNote(tag + ' title', tf);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_podium_' + w + '.png') });
    await playRound(pg);
    await pg.waitForFunction(() => /^🏆/.test(document.getElementById('hgWeek').textContent), null, { timeout: 5000 }).catch(() => {});
    const E = await pg.evaluate(() => { const r = s => { const e = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(e.top), b: Math.round(e.bottom), l: Math.round(e.left), r: Math.round(e.right), h: Math.round(e.height) }; };
      return { box: r('#hgEnd'), wide: document.documentElement.scrollWidth - window.innerWidth }; });
    const ef = await screenFits(pg, 'end', w, h);
    ok(E.box.h <= 24 && E.box.l >= 0 && E.box.r <= w && E.wide <= 0 && ef.ok, tag + ': the end line is one line; the end screen adds no scroll, the icons share one row', { E, ef }); fitNote(tag + ' end', ef);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_end_board_' + w + '.png') });
    await pg.locator('#hgEndBoard').tap(); await pg.waitForTimeout(300);
    for (const [sc, k] of [['week', 'players'], ['last', 'players'], ['all', 'players'], ['week', 'countries']]) {
      await pg.locator('#hgScope button[data-k="' + sc + '"]').tap(); await pg.locator('#hgKind button[data-k="' + k + '"]').tap(); await pg.waitForTimeout(250);
      const L = await pg.evaluate(() => { const scr = document.getElementById('hgBoard'), r = s => { const e = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(e.top), b: Math.round(e.bottom), h: Math.round(e.height) }; };
        const small = [...scr.querySelectorAll('button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(q => q.height < 44 || q.width < 44).length;
        const rows = [...document.querySelectorAll('#hgBody .hgRow')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
        return { close: r('#hgClose'), body: r('#hgBody'), pin: document.getElementById('hgPin').hidden ? null : r('#hgPin'), scroll: scr.scrollHeight - scr.clientHeight, wide: document.documentElement.scrollWidth - window.innerWidth, small, rows }; });
      const long = await longTexts(pg, '#hgBoard');
      ok(L.close.b <= h && L.close.h >= 44 && L.body.h >= 60 && L.scroll <= 1 && L.wide <= 0 && L.small === 0 && L.rows === 0 && (!L.pin || L.pin.b <= L.close.t) && !long.length,
        tag + ' board ' + sc + '/' + k + ': fits (CLOSE on screen, list ≥ 60 px, no page scroll, targets ≥ 44 px, rows not cut, short texts)', { L, long });
      if (sc === 'all') await pg.screenshot({ path: path.join(SHOTS, 'gold_board_' + w + '.png') });
    }
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), tag + ': no Telegram id in the DOM, no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
