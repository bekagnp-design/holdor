// tests/gold/t_ladder.js — Heavy Gold country ladder + crowns (src/gold/js/36_ladder.js, crowns in 30_board.js), against a mocked server:
// the ladder screen (from the title's "Country ladder" and from the board's header): countries by position with flag, name,
// "N players + M bots", score; this week's pairs with the vs line (both scores, who leads, a tie keeps the higher place); the rest
// rows (#1 on an odd week, an unpaired last); the player's country highlighted; "Ends in 3 d 4 h"; a tap shows the bots bot1…botN;
// last week's results; the title line under the podium, short ("🇬🇪 #5 vs 🇹🇷 #4 · 120 vs 98 — you lead"; the full form
// "🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 120 vs 98 — you lead" on the ladder and the end screen), the other leads and ties,
// nothing in a rest week or offline; the end line from a fresh hg_ladder asked after hg_round_submit answered (30_board's 'submitted');
// crowns (👑 on the podium, the board, the end top 3; a crown drawn above the hero when his own row on the 'last' board is crowned,
// with no extra call); offline; a phone clock ahead of the server at the week's end (no ask loop) and a real week end (one ask);
// no Telegram id and no markup from the server in the DOM; the layout at 390x844, 844x390 and 640x360 with a day god's banner
// (screenshots in .shots/).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const TOKEN = '7d1e2f3a-4b5c-4d6e-8f70-a1b2c3d4e5f6', TGID = 735102846, ROWID = 4440001;
const ME = { name: 'Nino Test', country: 'GE' };
const ENDS = new Date(Date.now() + ((3 * 24 + 4) * 60 + 20) * 60000).toISOString();   // 3 d 4 h 20 m from now

/* the ladder on an odd ISO week: #1 rests, (2-3) (4-5) (6-7), #8 has no one below it and rests too */
function ladder(o) {
  o = o || {};
  const R = (pos, country, real, score, rounds, opp, opp_score, side) => ({ pos, country, real, bots: Math.max(0, 5 - real), score, rounds, opp, opp_score, side, crown: pos === 1, tg_id: ROWID + pos });
  const ge = o.ge == null ? 120 : o.ge, tr = o.tr == null ? 98 : o.tr;
  let rows = [R(1, 'FR', 9, 310.5, 60, null, null, 'rest'), R(2, 'JP', 3, 150.25, 11, 'US', 151, 'down'), R(3, 'US', 4, 151, 14, 'JP', 150.25, 'up'),
    R(4, 'TR', 1, tr, 3, 'GE', ge, 'down'), R(5, 'GE', 2, ge, 7, 'TR', tr, 'up'), R(6, 'BR', 0, 0, 0, 'DE', 0, 'down'), R(7, 'DE', 0, 0, 0, 'BR', 0, 'up'),
    R(8, 'UA', 0, 0, 0, null, null, 'rest'), { pos: 9, country: '<img src=x onerror="window.__xss=1">', real: 1, bots: 4, score: 5, rounds: 1, opp: null, opp_score: null, side: 'rest' }];
  let mine = { country: 'GE', pos: 5, opp: 'TR', score: ge, opp_score: tr, side: 'up', ends_at: ENDS };
  if (o.geHigh) {   // Georgia #4 above Türkiye #5
    rows = rows.map(r => r.country === 'GE' ? Object.assign({}, r, { pos: 4, side: 'down' }) : r.country === 'TR' ? Object.assign({}, r, { pos: 5, side: 'up' }) : r).sort((a, b) => a.pos - b.pos);
    mine = Object.assign({}, mine, { pos: 4, side: 'down' });
  }
  if (o.rest) {      // Georgia is #1 and rests
    rows = [R(1, 'GE', 2, 140, 7, null, null, 'rest'), R(2, 'FR', 9, 30, 60, 'JP', 20, 'down'), R(3, 'JP', 3, 20, 11, 'FR', 30, 'up')];
    mine = { country: 'GE', pos: 1, opp: null, score: 140, opp_score: null, side: 'rest', ends_at: ENDS };
  }
  if (o.empty) { rows = []; mine = null; }
  if (o.ends && mine) mine = Object.assign({}, mine, { ends_at: o.ends });
  return { week_start: '2026-11-16T00:00:00Z', week_end: o.ends || ENDS, iso_week: 47, ladder: rows, mine,
    last: o.empty ? [] : [{ week: '2026-11-09', a: 'FR', b: 'JP', a_score: 200, b_score: 150, winner: 'FR' }, { week: '2026-11-09', a: 'US', b: 'TR', a_score: 90, b_score: 90, winner: 'US' },
      { week: '2026-11-09', a: 'BR', b: 'GE', a_score: 70, b_score: 95, winner: 'GE' }, { week: '2026-11-09', a: 'DE', b: 'UA', a_score: 40, b_score: 10, winner: 'DE' }] };
}
function board(scope, crownAt, meChamp) {   // meChamp: the player is last week's #1 (his own row on the 'last' board, crowned)
  const names = ['Giorgi', 'Marie', 'Kenji', 'Ana', 'Luka'], cc = ['GE', 'FR', 'US', 'JP', 'TR'], players = [];
  const meAt = scope === 'week' ? 1 : meChamp && scope === 'last' ? 0 : -1;
  for (let i = 0; i < 5; i++) players.push({ name: i === meAt ? ME.name : names[i], country: i === meAt ? ME.country : cc[i], total: 3000 - i * 111, best: 900 - i * 20, rounds: 40 - i,
    mine: i === meAt, crown: i + 1 === crownAt, tg_id: ROWID + 50 + i });
  return { scope, since: '2026-11-16T00:00:00Z', players, me: scope === 'week' ? { rank: 2, total: 2889, best: 880, rounds: 39 } : null, countries: [{ country: 'GE', players: 2, rounds: 7, gold: 240 }], totals: { players: 30, rounds: 120 } };
}

async function setup(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, hasTouch: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const M = { calls: [], lad: o.lad || {}, ladErr: !!o.ladErr, crown: !!o.crown, submitted: 0 };
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await pg.route(/telegram\.org/, r => r.abort());
  await pg.route(/supabase\.co/, async route => {
    const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const mm = rq.url().match(/\/rest\/v1\/rpc\/(\w+)$/); if (!mm) return route.abort();
    const name = mm[1]; let body = null; try { body = JSON.parse(rq.postData() || 'null'); } catch (e) {}
    M.calls.push({ name, body, t: Date.now() });
    const send = (j, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(j) });
    if (name === 'tg_login') return send({ token: TOKEN, tg_id: TGID, name: ME.name });
    if (!body || body.token !== TOKEN) return send({ message: 'bad session' }, 400);
    if (name === 'hg_profile_get') return send(Object.assign({ name: ME.name, country: ME.country }, M.crown ? { crown: true } : {}));
    if (name === 'hg_profile_set') return send({ ok: true, name: body.name, country: body.country });
    if (name === 'hg_round_submit') { await new Promise(r => setTimeout(r, 250)); M.submitted++; return send({ ok: true, week: { total: 345, best: 200, rounds: 3, rank: 7 } }); }
    if (name === 'hg_board') return send(board(body.scope, body.scope === 'last' ? 1 : 3, M.crown));
    if (name === 'hg_ladder') { if (M.ladErr) return send({ message: 'no function hg_ladder' }, 404); return send(ladder(M.submitted ? Object.assign({}, M.lad, { ge: 135 }) : M.lad)); }
    return send({ message: 'no function ' + name }, 404);
  });
  if (o.tg !== false) await pg.addInitScript(([u, id]) => {
    const init = 'query_id=AAE1&user=' + encodeURIComponent(JSON.stringify(Object.assign({ id }, u))) + '&auth_date=1763900000&hash=0f1e2d3c4b5a69788796a5b4c3d2e1f0';
    window.Telegram = { WebApp: { initData: init, initDataUnsafe: { user: Object.assign({ id }, u) }, platform: 'ios', version: '8.0', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, disableVerticalSwipes() {}, HapticFeedback: { impactOccurred() {} }, openTelegramLink() {} } };
  }, [{ first_name: 'Nino', language_code: 'en' }, TGID]);
  await pg.addInitScript(p => { localStorage.setItem('hg_profile', JSON.stringify(p)); localStorage.setItem('hg_sound', 'off'); }, ME);
  await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.net && G.board && G.ladder);
  await pg.evaluate(g => { if (G.setDayGod) G.setDayGod(g); }, o.god || 'none');
  if (o.tg !== false) await pg.waitForFunction(() => G.net.on, null, { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return { ctx, pg, M, errs, n: name => M.calls.filter(c => c.name === name) };
}
const noIds = pg => pg.evaluate(([a, b]) => { const c = document.body.cloneNode(true); for (const s of c.querySelectorAll('script,style')) s.remove(); const h = c.outerHTML + document.body.innerText; return !/tg_id/i.test(h) && h.indexOf(String(a)) < 0 && h.indexOf(String(b)) < 0; }, [TGID, ROWID]);
const errHidden = pg => pg.evaluate(() => getComputedStyle(document.getElementById('err')).display === 'none');
const titleLine = pg => pg.evaluate(() => { const e = document.getElementById('lgTitle'); if (!e || !e.isConnected) return null; const pod = document.getElementById('hgPod'), r = e.getBoundingClientRect();
  const lead = [...e.querySelectorAll('.l')].find(x => x.offsetParent), shown = getComputedStyle(e).display !== 'none';
  return { shown, text: shown ? e.innerText : '', full: G.ladder.text(G.ladder.data), afterPod: !!pod && pod.isConnected && pod.nextElementSibling === e, inExtra: e.parentNode.id, l: r.left, r: r.right, t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), lead: lead ? lead.className : '' }; });
const LADDER = () => {
  const scr = document.getElementById('lgLadder'), rr = s => { const e = typeof s === 'string' ? document.querySelector(s) : s; if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), h: Math.round(q.height), w: Math.round(q.width) }; };
  const cards = [...document.querySelectorAll('#lgBody .lgDuel')].map(c => ({ pair: c.dataset.pair, mine: c.classList.contains('mine'), rest: c.classList.contains('rest'),
    rows: [...c.querySelectorAll('.lgRow')].map(r => ({ cc: r.dataset.cc, pos: r.querySelector('.k').textContent, fl: r.querySelector('.fl').textContent, n: r.querySelector('.n').textContent, m: r.querySelector('.m').textContent, sc: r.querySelector('.sc').textContent, me: r.classList.contains('me') })),
    vs: (c.querySelector('.lgVs') || {}).textContent }));
  const small = [...scr.querySelectorAll('button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(q => q.height < 44 || q.width < 44).length;
  const cut = [...scr.querySelectorAll('.lgRow,.lgVs,.lgMine,.lgLastR')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).length;
  return { on: scr.classList.contains('on'), top: getComputedStyle(scr).zIndex, ends: document.getElementById('lgEnds').textContent, mine: document.getElementById('lgMine').hidden ? null : document.getElementById('lgMine').textContent,
    body: document.getElementById('lgBody').textContent, cards, last: [...document.querySelectorAll('#lgLastWeek .lgLastR')].map(e => e.textContent),
    close: rr('#lgClose'), list: rr('#lgBody'), meRow: rr('#lgBody .lgRow.me'), scroll: scr.scrollHeight - scr.clientHeight, wide: document.documentElement.scrollWidth - window.innerWidth, small, cut,
    xss: window.__xss === 1 || !!scr.querySelector('img') };
};
async function playRound(pg) {
  await pg.locator('#play').tap(); await pg.waitForTimeout(150);
  return pg.evaluate(() => {
    const S = G.S, me = S.me, v = S.vaults[0]; me.carry += 40; S.minted += 40;
    for (let i = 0; i < 150 && me.carry; i++) { for (const o of S.ps) if (o !== me && Math.hypot(o.x - v.x, o.y - v.y) < 500) { o.x = v.x + (v.x < 2000 ? 1500 : -1500); o.y = v.y; } me.x = v.x; me.y = v.y; me.vx = me.vy = 0; G.step(1); }
    let g = 0; while (!S.over && g++ < 100000) G.step(60);
    return { over: S.over, conserved: G.total() === S.minted };
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE });

  /* ---------- 1. portrait, in Telegram: the title line, the ladder screen, the end line, the crowns ---------- */
  {
    const T = await setup(b, { w: 390, h: 844 }); const { pg } = T;
    await pg.waitForFunction(() => !!document.getElementById('lgTitle') && !!document.getElementById('hgPod'), null, { timeout: 4000 }).catch(() => {});
    const L0 = await titleLine(pg);
    ok(L0 && L0.shown && L0.text === '🇬🇪 #5 vs 🇹🇷 #4 · 120 vs 98 — you lead' && /up/.test(L0.lead) && L0.h <= 18, 'the title line, short and on one line: "🇬🇪 #5 vs 🇹🇷 #4 · 120 vs 98 — you lead"', L0);
    ok(L0 && L0.full === '🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 120 vs 98 — you lead', 'its full form (the ladder and the end screen): "🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 120 vs 98 — you lead"', L0 && L0.full);
    ok(L0 && L0.afterPod && L0.inExtra === 'titleExtra' && T.n('hg_ladder').length === 1 && T.n('hg_ladder')[0].body.token === TOKEN, 'the line sits right under the podium in #titleExtra; one hg_ladder(token) call at boot', { L0, calls: T.n('hg_ladder').length });
    const pod = await pg.evaluate(() => [...document.querySelectorAll('#hgPod .hgPl')].map(e => ({ r: +e.dataset.rank, t: e.querySelector('.nm').textContent, cr: !!e.querySelector('.nm .hgCr'), first: e.querySelector('.nm').firstElementChild.className })));
    const p1 = pod.find(p => p.r === 1) || {};
    ok(p1.t === '👑🇬🇪Giorgi' && p1.cr && p1.first === 'hgCr' && pod.filter(p => p.cr).length === 1, "the podium: 👑 before the champion's flag and name (crown from hg_board 'last')", pod);
    ok(await pg.evaluate(() => G.board.top3('title').map(r => r.crown).join()) === 'true,false,false', 'G.board.top3 carries crown', null);
    const play0 = await pg.locator('#play').boundingBox(); ok(play0.y + play0.height <= 844, '390x844: PLAY on screen under the podium and the line', play0);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_title_390.png') });
    // the ladder screen from the title
    const btn = await pg.locator('#lgBtn').boundingBox();
    ok(btn && btn.height >= 44 && await pg.evaluate(() => document.getElementById('lgBtn').parentNode.id === 'titleLinks' && document.getElementById('lgBtn').className === 'sec'), 'a "Country ladder" .sec button in #titleLinks (≥ 44 px)', btn);
    await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(400);
    const S = await pg.evaluate(LADDER);
    ok(S.on && S.ends === 'Ends in 3 d 4 h', 'the ladder screen opens; "Ends in 3 d 4 h"', { on: S.on, ends: S.ends });
    ok(S.cards.map(c => c.pair).join() === '1,2-3,4-5,6-7,8', 'odd week: #1 rests, pairs (2-3) (4-5) (6-7), #8 has no one below it and rests (the bad country code is dropped)', S.cards.map(c => c.pair));
    const rows = [].concat(...S.cards.map(c => c.rows));
    ok(rows.map(r => r.pos + r.fl + r.n).join('|') === '#1🇫🇷👑 France|#2🇯🇵Japan|#3🇺🇸United States|#4🇹🇷Türkiye|#5🇬🇪Georgia|#6🇧🇷Brazil|#7🇩🇪Germany|#8🇺🇦Ukraine',
      'every country by position with its flag and name; 👑 on #1 (the champion country)', rows.map(r => r.pos + r.fl + r.n));
    const ge = rows.find(r => r.cc === 'GE'), fr = rows.find(r => r.cc === 'FR'), tr = rows.find(r => r.cc === 'TR'), ua = rows.find(r => r.cc === 'UA'), jp = rows.find(r => r.cc === 'JP');
    ok(ge.m === '2 players + 3 bots' && fr.m === '9 players' && tr.m === '1 player + 4 bots' && ua.m === '0 players + 5 bots', 'members: "N players + M bots" (real players first, bots counted, never named until opened)', [ge.m, fr.m, tr.m, ua.m]);
    ok(ge.sc === '120' && jp.sc === '150.25' && fr.sc === '310.5' && ua.sc === '0', "each country's score this week (the server's number, up to 2 decimals)", [ge.sc, jp.sc, fr.sc, ua.sc]);
    const vs = S.cards.map(c => c.vs);
    ok(vs[1] === 'VS150.25 vs 151·🇺🇸 United States leads' && vs[2] === 'VS98 vs 120·🇬🇪 Georgia leads' && vs[3] === 'VS0 vs 0·tied: 🇧🇷 Brazil holds #6', 'the vs lines: both scores and who leads (a tie keeps the higher place)', vs);
    ok(vs[0] === 'Rests this week' && vs[4] === 'Rests this week' && S.cards[0].rest && S.cards[4].rest, 'the rest rows say "Rests this week"', [vs[0], vs[4]]);
    ok(ge.me && rows.filter(r => r.me).length === 1 && S.cards[2].mine && S.mine === '🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 120 vs 98 — you lead', "the player's country highlighted, its duel marked, the same line pinned above the list", { me: rows.filter(r => r.me).map(r => r.cc), mine: S.mine });
    ok(S.last.join(' | ') === '🇫🇷 France beat 🇯🇵 Japan · 200 vs 150 | 🇺🇸 United States held its place on a tie with 🇹🇷 Türkiye · 90 vs 90 | 🇬🇪 Georgia beat 🇧🇷 Brazil and moved up · 95 vs 70 | 🇩🇪 Germany beat 🇺🇦 Ukraine · 40 vs 10',
      "last week's results under the list", S.last);
    ok(!/Bots:|bot1 ·/.test(S.body), 'the bots are not named while the rows are closed', null);
    await pg.locator('#lgBody .lgRow[data-cc="GE"]').tap(); await pg.waitForTimeout(150);
    const ex = await pg.evaluate(() => { const r = document.querySelector('#lgBody .lgRow[data-cc="GE"]'), e = r.querySelector('.ex'); return { open: r.classList.contains('open'), aria: r.getAttribute('aria-expanded'), text: e.textContent, shown: getComputedStyle(e).display !== 'none', others: document.querySelectorAll('#lgBody .lgRow.open').length }; });
    ok(ex.open && ex.aria === 'true' && ex.shown && ex.others === 1 && ex.text === 'Bots: bot1 · bot2 · bot3 (members that add no gold) · 2 active players · 7 rounds this week', 'a tap opens a country: its bots by name bot1…bot3, its rounds', ex);
    await pg.locator('#lgBody .lgRow[data-cc="FR"]').tap(); await pg.waitForTimeout(100);
    ok(await pg.evaluate(() => document.querySelector('#lgBody .lgRow[data-cc="FR"] .ex').textContent) === 'No bots · 9 active players · 60 rounds this week', 'a country without bots says "No bots"', null);
    await pg.locator('#lgBody .lgRow[data-cc="GE"]').tap(); await pg.waitForTimeout(100);
    ok(!(await pg.evaluate(() => document.querySelector('#lgBody .lgRow[data-cc="GE"]').classList.contains('open'))), 'a second tap closes it', null);
    ok(!S.xss && await noIds(pg), 'no markup from the server and no Telegram id in the DOM (rows carried tg_id; a bad country code was dropped)', null);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_390.png') });
    await pg.locator('#lgClose').tap(); await pg.waitForTimeout(150);
    ok(!(await pg.evaluate(() => document.getElementById('lgLadder').classList.contains('on'))), 'CLOSE closes the ladder', null);
    // the board's header link
    await pg.locator('#hgTitleBoard').tap(); await pg.waitForTimeout(400);
    const BL = await pg.evaluate(() => { const b = document.getElementById('lgFromBoard'), q = b.getBoundingClientRect(); return { inTop: b.parentNode.classList.contains('hgBtop'), h: q.height, w: q.width, text: b.textContent,
      crownRow: [...document.querySelectorAll('#hgBody .hgRow.crown')].map(r => [...r.children].map(c => c.textContent)) }; });
    ok(BL.inTop && BL.h >= 44 && BL.text === 'Country ladder', 'the board screen has a "Country ladder" link in its header (≥ 44 px)', BL);
    ok(BL.crownRow.length === 1 && BL.crownRow[0][2] === '👑Kenji' && BL.crownRow[0][0] === '3', "the board: 👑 before the champion's name in his row", BL.crownRow);
    await pg.locator('#lgFromBoard').tap(); await pg.waitForTimeout(300);
    const z = await pg.evaluate(() => ({ lad: document.getElementById('lgLadder').classList.contains('on'), board: document.getElementById('hgBoard').classList.contains('on'), top: document.elementFromPoint(innerWidth / 2, 20).closest('.scr').id }));
    ok(z.lad && z.board && z.top === 'lgLadder', 'the link opens the ladder over the board', z);
    await pg.locator('#lgClose').tap(); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.getElementById('hgBoard').classList.contains('on') && !document.getElementById('lgLadder').classList.contains('on')), 'CLOSE goes back to the board', null);
    await pg.locator('#hgClose').tap(); await pg.waitForTimeout(150);
    // a round: the end line comes from a fresh hg_ladder asked after the submit answered
    const R = await playRound(pg);
    const atEnd = await pg.evaluate(() => !!document.getElementById('lgEnd'));
    await pg.waitForFunction(() => { const e = document.getElementById('lgEnd'); return e && e.isConnected && e.textContent; }, null, { timeout: 5000 }).catch(() => {});
    const E = await pg.evaluate(() => { const e = document.getElementById('lgEnd'), w = document.getElementById('hgEnd'); return { text: e && e.isConnected ? e.innerText : null, parent: e && e.parentNode && e.parentNode.id, afterWeek: !!w && w.nextElementSibling === e }; });
    const sub = T.M.calls.findIndex(c => c.name === 'hg_round_submit'), lad = T.M.calls.map((c, i) => [c, i]).filter(([c, i]) => c.name === 'hg_ladder' && i > sub);
    ok(R.over && R.conserved && !atEnd && E.text === '🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 135 vs 98 — you lead' && E.parent === 'endExtra' && E.afterWeek,
      'the end line in #endExtra (right under the week line), with the score after this round', { E, atEnd });
    ok(sub >= 0 && lad.length === 1 && T.M.calls[lad[0][1]].t >= T.M.calls[sub].t + 200, 'it is asked once, after hg_round_submit has answered', { sub, after: lad.length });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_end_390.png') });
    await pg.locator('#change').tap(); await pg.waitForTimeout(500);
    ok((await titleLine(pg) || {}).text === '🇬🇪 #5 vs 🇹🇷 #4 · 135 vs 98 — you lead', 'back on the title, the line shows the new score', await titleLine(pg));
    await pg.locator('#play').tap(); await pg.waitForTimeout(100);
    ok(!(await pg.evaluate(() => !!document.getElementById('lgEnd'))), 'a new round clears the end line', null);
    await pg.evaluate(() => { let g = 0; while (!G.S.over && g++ < 100000) G.step(60); });
    await pg.waitForFunction(() => !!document.getElementById('lgEnd'), null, { timeout: 5000 }).catch(() => {});
    ok(await pg.evaluate(() => !!document.getElementById('lgEnd')), 'the next round end shows it again', null);
    ok(!T.errs.length && await errHidden(pg), 'portrait run: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 2. who leads: the rival, a tie below, a tie above; the rest week; an empty ladder; an error ---------- */
  {
    const T = await setup(b, { lad: { ge: 80 } }); const { pg, M } = T;
    const t1 = await titleLine(pg);
    M.lad = { ge: 98 }; await pg.evaluate(() => G.ladder.refresh(true)); await pg.waitForTimeout(300); const t2 = await titleLine(pg);
    M.lad = { ge: 98, geHigh: true }; await pg.evaluate(() => G.ladder.refresh(true)); await pg.waitForTimeout(300); const t3 = await titleLine(pg);
    ok(t1 && t1.full === '🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 80 vs 98 — Türkiye leads' && t1.text === '🇬🇪 #5 vs 🇹🇷 #4 · 80 vs 98 — they lead' && /down/.test(t1.lead), 'the rival leads: "— Türkiye leads" (the title: "— they lead")', t1);
    ok(t2 && t2.full === '🇬🇪 Georgia #5 · this week vs 🇹🇷 Türkiye (#4): 98 vs 98 — tied, Türkiye holds #4' && t2.text === '🇬🇪 #5 vs 🇹🇷 #4 · 98 vs 98 — tied, they hold #4' && /tie/.test(t2.lead), 'a tie keeps the higher place: "— tied, Türkiye holds #4" (the title: "— tied, they hold #4")', t2);
    ok(t3 && t3.full === '🇬🇪 Georgia #4 · this week vs 🇹🇷 Türkiye (#5): 98 vs 98 — tied, you hold #4' && t3.text === '🇬🇪 #4 vs 🇹🇷 #5 · 98 vs 98 — tied, you hold #4', 'tied from above: "— tied, you hold #4" (the opponent below)', t3);
    await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(400);
    const S3 = await pg.evaluate(LADDER);
    ok(S3.cards.map(c => c.pair).join() === '1,2-3,4-5,6-7,8' && S3.cards[2].rows.map(r => r.cc).join() === 'GE,TR' && S3.cards[2].vs === 'VS98 vs 98·tied: 🇬🇪 Georgia holds #4', 'Georgia above Türkiye: the pair (4-5) with Georgia on top, the tie holds for Georgia', S3.cards[2]);
    await pg.locator('#lgClose').tap();
    M.lad = { rest: true }; await pg.evaluate(() => G.ladder.refresh(true)); await pg.waitForTimeout(300);
    ok(await titleLine(pg) === null, 'the rest week: no title line (the country has no duel)', await titleLine(pg));
    await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(400);
    const S4 = await pg.evaluate(LADDER);
    ok(S4.mine === '🇬🇪 Georgia #1 · rests this week' && S4.cards[0].rest && S4.cards[0].mine && S4.cards[0].rows[0].n === '👑 Georgia' && S4.cards[0].rows[0].me && S4.cards[1].vs === 'VS30 vs 20·🇫🇷 France leads',
      'the rest week on the ladder: "Georgia #1 · rests this week", its row crowned and highlighted, the others duel', { mine: S4.mine, c0: S4.cards[0], vs: S4.cards[1].vs });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_rest_390.png') });
    await pg.locator('#lgClose').tap();
    M.lad = { empty: true }; await pg.evaluate(() => G.ladder.refresh(true)); await pg.waitForTimeout(300);
    await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(400);
    const S5 = await pg.evaluate(LADDER);
    ok(await titleLine(pg) === null && S5.body === 'No country is on the ladder yet. Play a round to put yours on it.' && S5.mine === 'Play a round to bring 🇬🇪 Georgia onto the ladder', 'an empty ladder says so; no title line', { body: S5.body, mine: S5.mine });
    await pg.locator('#lgClose').tap();
    M.ladErr = true; await pg.evaluate(() => G.ladder.refresh(true)); await pg.waitForTimeout(300);
    await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(300);
    await pg.evaluate(() => G.ladder.open(true)); await pg.waitForTimeout(400);
    const S6 = await pg.evaluate(LADDER);
    ok(await titleLine(pg) === null && /Could not load the ladder/.test(S6.body) && await pg.evaluate(() => !!document.getElementById('lgRetry')), 'the server fails: "Could not load the ladder." with Try again; no title line', S6.body);
    M.ladErr = false; M.lad = {}; await pg.locator('#lgRetry').tap(); await pg.waitForTimeout(400);
    ok((await pg.evaluate(LADDER)).cards.length === 5, '"Try again" loads the ladder', null);
    ok(!T.errs.length && await errHidden(pg), 'no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 3. the crown in the arena (hg_profile_get crown: true) and none without it ---------- */
  for (const crown of [true, false]) {
    const T = await setup(b, { crown, w: 390, h: 844 }); const { pg } = T;
    const c0 = await pg.evaluate(() => !!G.profile.crown);
    const lastN = () => T.n('hg_board').filter(c => c.body.scope === 'last').length;
    ok(T.n('hg_profile_get').length === 1 && lastN() === 1 && await pg.evaluate(() => !G.net.rpc.__lg), 'crown ' + crown + ": read from the podium's 'last' answer: no extra call (hg_profile_get once, the profile's sync; hg_board 'last' once), G.net.rpc not wrapped",
      { get: T.n('hg_profile_get').length, last: lastN() });
    await pg.locator('#play').tap(); await pg.waitForTimeout(600);
    const C = await pg.evaluate(() => {
      const S = G.S, me = S.me, cv = document.getElementById('c'), dpr = cv.width / innerWidth, at = G.ladder.crownAt;
      const k = Math.min(1.5, Math.max(0.65, Math.sqrt(innerWidth * innerHeight) / 680)) / (1 + (G.radius(me) - 17) / 140);
      const sx = (me.x - S.camX) * k + innerWidth / 2, sy = (me.y - S.camY) * k + innerHeight / 2, r = G.radius(me) * k;
      const px = (x, y) => [...cv.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
      return { drawn: G.ladder.crownDrawn, at, sx, sy, r, nameTop: sy - r - 18 - 10, gold: at ? [px(at.x - at.w * 0.3, at.y - at.h * 0.2), px(at.x + at.w * 0.3, at.y - at.h * 0.2)] : null, conserved: G.total() === S.minted };
    });
    if (crown) {
      const gold = C.gold && C.gold.every(([r, g, b_]) => r > 170 && g > 100 && b_ < 140);
      ok(c0 && C.drawn > 0 && C.at && Math.abs(C.at.x - C.sx) < 2 && C.at.y <= C.nameTop && C.at.y >= C.nameTop - 12 && gold && C.conserved, 'crown: true from hg_profile_get → a gold crown above the hero, above his name', C);
      await pg.evaluate(() => { const S = G.S; S.me.carry = 0; for (const p of S.ps) if (p !== S.me) { p.x = 3900; p.y = 3900; } });   // a clean shot
      await pg.waitForTimeout(200);
      const at = await pg.evaluate(() => G.ladder.crownAt);
      await pg.screenshot({ path: path.join(SHOTS, 'gold_crown_arena.png'), clip: { x: Math.max(0, at.x - 90), y: Math.max(0, at.y - 40), width: 180, height: 140 } });
      // Loki: his decoy wears the crown too, above its own (bigger) circle
      const dk = await pg.evaluate(async () => { const S = G.S, me = S.me; me.god = 'loki'; me.cd = 0; G.useSkill(me); G.step(30); await new Promise(r => setTimeout(r, 250));
        const dc = S.decoys[0], k = Math.min(1.5, Math.max(0.65, Math.sqrt(innerWidth * innerHeight) / 680)) / (1 + (G.radius(me) - 17) / 140), at = G.ladder.decoyAt;
        const sy = (dc.y - S.camY) * k + innerHeight / 2, r = G.radius({ carry: dc.carry }) * k;
        return { decoy: !!dc, at, want: sy - r - 31, me: G.ladder.crownAt, dx: at && Math.abs(at.x - ((dc.x - S.camX) * k + innerWidth / 2)) }; });
      ok(dk.decoy && dk.at && dk.dx < 3 && Math.abs(dk.at.y - dk.want) < 3, "Loki's decoy wears the crown, above its own circle and name", dk);
      // a new week in the ladder's answer: hg_profile_get is asked again, and the crown goes when the server says so
      const n0 = lastN(), g0 = T.n('hg_profile_get').length; T.M.crown = false; T.M.lad = { ends: new Date(Date.parse(ENDS) + 7 * 86400000).toISOString() };
      await pg.evaluate(() => G.ladder.load(true)); await pg.waitForTimeout(400);
      const c2 = await pg.evaluate(async () => { const a = G.ladder.crownDrawn; await new Promise(r => setTimeout(r, 300)); return { pc: !!G.profile.crown, more: G.ladder.crownDrawn - a }; });
      ok(lastN() === n0 + 1 && T.n('hg_profile_get').length === g0 && !c2.pc && c2.more === 0, "a new week: the 'last' board asked once more (fresh); no crown any more when the server gives none", { calls: lastN() - n0, c2 });
    } else ok(!c0 && C.drawn === 0 && !C.at, 'no crown from hg_profile_get → no crown drawn', C);
    ok(!T.errs.length && await errHidden(pg), 'crown ' + crown + ': no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 4. offline (no Telegram): no title line, the screen says so, no end line, no crown, nothing sent ---------- */
  {
    const T = await setup(b, { tg: false, w: 844, h: 390 }); const { pg } = T;
    ok(await titleLine(pg) === null, 'offline: no title line', null);
    await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(200);
    const S = await pg.evaluate(LADDER);
    ok(S.on && S.body === 'Open HOLDOR in Telegram to see the ladder' && !S.ends && S.mine === null && S.cards.length === 0, 'offline: "Open HOLDOR in Telegram to see the ladder"', S.body);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_offline_844.png') });
    await pg.locator('#lgClose').tap();
    const R = await playRound(pg); await pg.waitForTimeout(400);
    const E = await pg.evaluate(() => ({ end: !!document.getElementById('lgEnd'), crown: G.ladder.crownDrawn, pc: !!G.profile.crown }));
    ok(R.over && R.conserved && !E.end && E.crown === 0 && !E.pc && T.M.calls.length === 0, 'offline: no end line, no crown, nothing sent', { E, calls: T.M.calls.length });
    ok(!T.errs.length && await errHidden(pg), 'offline: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }

  /* ---------- 5. the layout: 390x844, 844x390, 640x360 (title, ladder, board, end) ---------- */
  /* every real day has a day god, so the title carries his banner too (Thor's is one of the two longest) */
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const T = await setup(b, { w, h, god: 'thor' }); const { pg } = T; const tag = w + 'x' + h + ': ';
    await pg.waitForFunction(() => !!document.getElementById('lgTitle') && !!document.getElementById('hgPod'), null, { timeout: 4000 }).catch(() => {});
    const L = await titleLine(pg), play = await pg.locator('#play').boundingBox(), wide = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const TL = await pg.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e || !e.offsetParent) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), h: Math.round(q.height) }; };
      return { pod: r('hgPod'), dg: r('dgBanner'), links: r('titleLinks'), btn: r('lgBtn'), rk1: !!(document.querySelector('.hgPl.p1 .rk') || {}).offsetParent }; });
    if (h <= 380) ok(L && !L.shown && L.full && TL.dg && TL.dg.b <= h && TL.pod && TL.pod.b <= TL.dg.t && TL.pod.h <= 56, tag + "a window ≤ 380 px tall has no title line; the podium stays two rows (the crown stands for #1) and the day god's banner on screen", { L, TL });
    else {
      ok(L && L.shown && L.afterPod && L.l >= 0 && L.r <= w && wide <= 0 && L.h <= 18 && L.text === '🇬🇪 #5 vs 🇹🇷 #4 · 120 vs 98 — you lead', tag + 'the title line under the podium: the short form on one line, inside the screen', L);
      ok(TL.dg && TL.dg.t >= L.b && TL.dg.b <= h, tag + "the day god's banner under it, on screen", TL);
    }
    if (h > 800) ok(TL.links && TL.links.b <= h && TL.btn && TL.btn.b <= h, tag + 'the links (Country ladder, Sound…) on screen with the podium, the line and the banner', TL);
    ok(play.y >= 0 && play.y + play.height <= h, tag + 'PLAY on screen with the podium and the line', play);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_title_' + w + '.png') });
    await pg.locator('#lgBtn').scrollIntoViewIfNeeded(); await pg.locator('#lgBtn').tap(); await pg.waitForTimeout(400);
    await pg.locator('#lgBody .lgRow[data-cc="GE"]').tap(); await pg.waitForTimeout(150);
    const S = await pg.evaluate(LADDER);
    ok(S.close.b <= h && S.close.h >= 44 && S.list.h >= 60 && S.scroll <= 1 && S.wide <= 0 && S.small === 0 && S.cut === 0,
      tag + 'the ladder fits (CLOSE on screen, list ≥ 60 px, no page scroll, targets ≥ 44 px, nothing cut)', { close: S.close, list: S.list, scroll: S.scroll, small: S.small, cut: S.cut });
    ok(S.meRow && S.meRow.t >= S.list.t - 1 && S.meRow.b <= S.list.b + 1, tag + "the player's country is scrolled into view", { me: S.meRow, list: S.list });
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_' + w + '.png') });
    await pg.locator('#lgClose').tap();
    await pg.locator('#hgTitleBoard').scrollIntoViewIfNeeded(); await pg.locator('#hgTitleBoard').tap(); await pg.waitForTimeout(400);
    const B = await pg.evaluate(() => { const scr = document.getElementById('hgBoard'), r = s => { const q = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), h: Math.round(q.height) }; };
      return { link: r('#lgFromBoard'), close: r('#hgClose'), body: r('#hgBody'), scroll: scr.scrollHeight - scr.clientHeight, wide: document.documentElement.scrollWidth - innerWidth }; });
    ok(B.link.h >= 44 && B.link.r <= w && B.close.b <= h && B.body.h >= 60 && B.scroll <= 1 && B.wide <= 0, tag + 'the board with the "Country ladder" link still fits (CLOSE on screen, list ≥ 60 px, no page scroll)', B);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_board_' + w + '.png') });
    await pg.locator('#hgClose').tap();
    await playRound(pg);
    await pg.waitForFunction(() => !!document.getElementById('lgEnd'), null, { timeout: 5000 }).catch(() => {});
    const E = await pg.evaluate(() => { const r = s => { const q = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), h: Math.round(q.height) }; };
      return { on: !!document.getElementById('lgEnd'), line: r('#lgEnd'), again: r('#again'), wide: document.documentElement.scrollWidth - innerWidth }; });
    ok(E.on && E.line.l >= 0 && E.line.r <= w && E.line.h <= 40 && E.again.b <= h && E.wide <= 0, tag + 'the end line fits, PLAY AGAIN on screen', E);
    await pg.screenshot({ path: path.join(SHOTS, 'gold_ladder_end_' + w + '.png') });
    ok(await noIds(pg) && !T.errs.length && await errHidden(pg), tag + 'no Telegram id in the DOM, no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }
  /* ---------- 6. the week's end: a phone clock ahead of the server asks no more than the cache allows; a real end asks once ---------- */
  {
    const T = await setup(b, { lad: { ends: new Date(Date.now() - 60000).toISOString() } }); const { pg, M } = T;   // the server's week "ended" a minute ago
    const n0 = T.n('hg_ladder').length;
    for (let i = 0; i < 5; i++) { await pg.evaluate(() => G.emit('title')); await pg.waitForTimeout(100); }
    ok(n0 === 1 && T.n('hg_ladder').length === n0, 'a clock ahead of the server: 5 title events, no new hg_ladder (the 30 s cache holds)', { boot: n0, after: T.n('hg_ladder').length });
    const fast = () => pg.evaluate(() => { const si = window.setInterval; window.setInterval = (f, ms, ...a) => si(f, ms === 20000 ? 150 : ms, ...a); try { G.ladder.open(); } finally { window.setInterval = si; } });   // the screen's 20 s tick at 150 ms
    await fast(); await pg.waitForTimeout(1200);
    const S = await pg.evaluate(LADDER);
    ok(S.on && T.n('hg_ladder').length === n0 && S.ends === 'Ending now' && S.cards.length === 5, 'the open ladder: 8 ticks, no new hg_ladder, "Ending now"', { calls: T.n('hg_ladder').length - n0, ends: S.ends });
    await pg.locator('#lgClose').tap();
    M.lad = { ends: new Date(Date.now() + 1500).toISOString() }; await pg.evaluate(() => G.ladder.load(true)); await pg.waitForTimeout(200);   // a clock that is right, 1.5 s before the end
    const n1 = T.n('hg_ladder').length; M.lad = { ends: new Date(Date.now() + 7 * 86400000).toISOString() };   // the next answer: the new week
    await fast(); await pg.waitForTimeout(2600);
    const S2 = await pg.evaluate(LADDER);
    ok(T.n('hg_ladder').length === n1 + 1 && /^Ends in [67] d/.test(S2.ends), 'a real week end with the screen open: one fresh hg_ladder, then the new week', { calls: T.n('hg_ladder').length - n1, ends: S2.ends });
    ok(!T.errs.length && await errHidden(pg), 'the clock runs: no page errors, #err hidden', T.errs);
    await T.ctx.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
