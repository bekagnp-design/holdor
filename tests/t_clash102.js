// v1.1.2: Houses Clash II. A ghost (a real player's recorded log) replays on the top lane: its towers rise at the logged ticks, its sends
// walk my road, its champion rides; the finished run goes to the server as a record (kind, seed, log, waves, door, the ghost's id) and
// the server's verdict shows under the local one; the screen on a managed seat: league, ranked, friend, practice, the runs; a friend
// link startapp=c_<code>. The server is faked here (the SQL has its own test: backend/test/v32_test.py).
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 400 : ms); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CL2 && window.HOLDOR_CLASH, { timeout: 20000 }); await page.waitForTimeout(400);
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; for (let i = 1; i <= 12; i++) a.campaign[i] = 3; a.gold = 500; a.army = { lvl: 5, keep: 'foot' }; a.sel = 'brienne'; H.setAcc(a); H.persist(); H.showHub('battle'); }); await page.waitForTimeout(500);
  // ---- a guest: the local practice screen
  await page.evaluate(() => window.HOLDOR_CL2.showClash()); await page.waitForTimeout(300);
  ok('a guest (no seat signed in) gets the local practice screen', await page.evaluate(() => !window.HOLDOR_CL2.clashServer() && window.HOLDOR.CLOUD.screen === 'clash-menu' && !document.getElementById('bClRank') && !!document.getElementById('bClashGo')));
  // ---- a ghost replays on lane B
  const gh = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_CLASH; const seed = 424242; const slots = H.posAt ? null : null;
    // find a slot id of the clash map: build a throwaway clash to read the layout, then start the real one with the ghost
    X.clashStart({ bot: 1, kind: 'practice' }); const s0 = G.map.slots[2].id, s1 = G.map.slots[3].id; X.clashStop();
    const ghost = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ann', house: 'lannister', champ: 'jaime', lvl: 9, seed, waves: 5, door: 70, log: [{ t: 30, a: 'build', s: s0, type: 'watch' }, { t: 60, a: 'move', x: 200, y: 560 }, { t: 200, a: 'send', role: 'foot' }, { t: 400, a: 'up', s: s0 }, { t: 500, a: 'build', s: s1, type: 'watch' }, { t: 520, a: 'call' }] };
    G.state = 'menu'; X.clashStart({ ghost, kind: 'rank', seed, house: 'lannister', code: null });
    const C = X.CLASH; const B0 = { hero: C.B.heroOn, champ: C.B.hero && C.B.hero.c && C.B.hero.c.id, house: C.B.house, seedB: C.B.seed, seedA: G.seed, sameSeed: C.B.seed === G.seed };
    for (let i = 0; i < 600; i++) { H.step(); X.clashStepB(); }
    const B = C.B; const t0 = B.map.slots.find(s => s.id === s0), t1 = B.map.slots.find(s => s.id === s1);
    return { B0, kind: C.kind, opp: C.opp.name, oppHouse: C.opp.house, ghostOn: !!C.ghost, i: C.ghost && C.ghost.i, t0: t0.tower && t0.tower.type + t0.tower.lvl, t1: t1.tower && t1.tower.type + t1.tower.lvl, mine: G.enemies.filter(e => e.troop).map(e => e.troop + ':' + e.role), heroB: [Math.round(B.hero.x), Math.round(B.hero.y)], waveB: B.wave, state: G.state, bar: document.getElementById('hName').textContent + '/' + document.getElementById('uName').textContent, myChamp: H.G.hero.c.id }; });
  ok('a ranked clash with a ghost: lane B is House Lannister with Jaime riding, the same seed as mine; the log replays — a Watchtower at tick 30, upgraded at 400, a second at 500, the wave called; its sent foot soldiers (Lannister ×3) walk my road; the bar at the bottom still shows my champion', gh.kind === 'rank' && gh.opp === 'Ann' && gh.oppHouse === 'lannister' && gh.B0.hero && gh.B0.champ === 'jaime' && gh.B0.sameSeed && gh.ghostOn && gh.i >= 6 && gh.t0 === 'watch2' && gh.t1 === 'watch1' && gh.mine.filter(x => x === 'lannister:foot').length === 3 && Math.abs(gh.heroB[0] - 200) < 16 && Math.abs(gh.heroB[1] - 560) < 16 && gh.state === 'play' && gh.myChamp === 'brienne' && /Brienne/.test(gh.bar) && !/Kingslayer/.test(gh.bar), JSON.stringify(gh));
  await page.waitForTimeout(300); await page.screenshot({ path: SC + 'clash102_ghost.png' });
  // ---- the finish goes to the (faked) server: the record and the verdict
  const fin = await page.evaluate(() => new Promise(res => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_CLASH, Y = window.HOLDOR_CL2; Y.CL2.force = true; const calls = [];
    Y.setRpc((fn, args) => { calls.push({ fn, args }); if (fn === 'clash_finish') return { ok: true, run: { kind: 'rank', waves: args.waves, door: args.door }, result: 'win', delta: 12, gift: { gold: 400, gems: 10 }, rating: 1012, league: 'Bronze', state: null }; return { ok: true }; });
    X.CLASH.B.doorHp = 0; for (let i = 0; i < 30 && !X.CLASH.fin; i++) { H.step(); X.clashStepB(); }
    setTimeout(() => { const e = document.getElementById('clSrv'); res({ win: X.CLASH.win, calls: calls.map(c => c.fn), a: calls[0] && calls[0].args, srv: e ? e.textContent : null }); }, 1500); }));
  ok('the finished run is recorded: clash_finish with kind rank, the ghost\'s id, the seed, House Stark, Brienne, waves and door as integers, a log with the sends; the server\'s verdict shows (WIN, +12, Bronze, +400 gold)', fin.win === 'A' && fin.calls.join() === 'clash_finish' && fin.a.kind === 'rank' && fin.a.ghost === 'aaaaaaaa-0000-0000-0000-000000000001' && fin.a.seed === 424242 && fin.a.house === 'stark' && fin.a.champ === 'brienne' && Number.isInteger(fin.a.waves) && Number.isInteger(fin.a.door) && fin.a.door >= 0 && fin.a.door <= 100 && Array.isArray(fin.a.log) && /WIN/.test(fin.srv) && /\+12/.test(fin.srv) && /Bronze/.test(fin.srv) && /\+400/.test(fin.srv), JSON.stringify(fin).slice(0, 600));
  await page.screenshot({ path: SC + 'clash102_result.png' });
  // ---- the screen on a managed seat (faked state): league, ranked, friend, practice, the open clash with its link, the runs
  await page.evaluate(() => { const Y = window.HOLDOR_CL2; window.HOLDOR_CLASH.clashStop(); Y.CL2.st = null;
    Y.setRpc((fn, args) => { window.__calls = (window.__calls || []).concat([{ fn, args }]);
      if (fn === 'clash_state') return { rating: 1012, league: 'Bronze', wins: 1, losses: 0, draws: 0, rank_left: 4, cw: 1, cl: 0, runs: [{ kind: 'rank', waves: 6, door: 55, result: 'win', delta: 12 }], clashes: [{ id: 'x', code: 'ab12cd34', status: 'open', mine: true, waiting: true, left: 3600, opponent: '…', me: { played: false }, them: { played: false }, result: null }], state: null };
      if (fn === 'clash_start') return { ok: true, kind: 'rank', ghost: { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Bob', house: 'tyrell', champ: 'brienne', seed: 777, waves: 3, door: 40, log: [] } };
      return { ok: true }; });
    Y.showClash(); });
  await page.waitForTimeout(600);
  const scr = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, text: document.querySelector('#card').innerText.replace(/\s+/g, ' ').slice(0, 400), rank: !!document.getElementById('bClRank'), friend: !!document.getElementById('bClFriend'), go: !!document.getElementById('bClashGo'), link: !!document.querySelector('[data-share="ab12cd34"]'), code: (document.querySelector('.reflink code') || {}).textContent || '', runs: document.querySelectorAll('.duelrow').length }));
  ok('a managed seat: Bronze 1012, 1W, Ranked (4 left), Challenge a friend, Practice, the open friend clash with its link, the runs', scr.scr === 'clash-menu' && /Bronze/.test(scr.text) && /1012/.test(scr.text) && /4 left/.test(scr.text) && scr.rank && scr.friend && scr.go && scr.link && scr.runs >= 2 && /startapp=c_ab12cd34$/.test(scr.code), JSON.stringify(scr));
  await page.screenshot({ path: SC + 'clash102_menu.png' });
  await tap('#bClRank', 1200);
  const rk = await page.evaluate(() => ({ calls: (window.__calls || []).map(c => c.fn + ':' + (c.args.kind || '')), state: window.HOLDOR.G.state, mode: window.HOLDOR.G.mode, opp: window.HOLDOR_CLASH.CLASH.opp && window.HOLDOR_CLASH.CLASH.opp.name, house: window.HOLDOR_CLASH.CLASH.opp && window.HOLDOR_CLASH.CLASH.opp.house, kind: window.HOLDOR_CLASH.CLASH.kind, seed: window.HOLDOR.G.seed }));
  ok('Ranked asks the server for a ghost and starts the clash against it (Bob of House Tyrell, seed 777)', rk.calls.includes('clash_start:rank') && rk.state === 'play' && rk.mode === 'clash' && rk.opp === 'Bob' && rk.house === 'tyrell' && rk.kind === 'rank' && rk.seed === 777, JSON.stringify(rk));
  // ---- the link
  const lk = await page.evaluate(() => { const Y = window.HOLDOR_CL2; window.HOLDOR_CLASH.clashStop(); const a = Y.cl2FromStart('c_AB12CD34'), p = Y.CL2.pending; const b = Y.cl2FromStart('d_ab12cd34'); return { a, p, b, p2: Y.CL2.pending }; });
  ok('startapp=c_<code> is kept as a pending clash (lower-cased); a duel link is not', lk.a && lk.p === 'ab12cd34' && !lk.b && lk.p2 === 'ab12cd34', JSON.stringify(lk));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
