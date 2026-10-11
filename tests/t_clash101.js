// v1.1.1: Houses Clash I. Two simulations on one phone: the rival's lane (a bot) drawn in the top half, mine in the bottom; the same
// waves on both; army points (+1 / 10 s) send the house's soldiers down the rival's road as enemies; the bot builds, upgrades and
// sends too; a broken door ends the clash with a result and a record; taps reach only my lane, shifted to it.
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
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CLASH && window.HOLDOR_TROOPS, { timeout: 20000 }); await page.waitForTimeout(400);
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; for (let i = 1; i <= 12; i++) a.campaign[i] = 3; a.gold = 500; a.army = { lvl: 5, keep: 'foot' }; H.setAcc(a); H.persist(); H.showHub('events'); }); await page.waitForTimeout(600);
  // ---- the Events page has the card; it opens the Clash screen; Fight starts a clash
  const ev = await page.evaluate(() => ({ card: !!document.querySelector('.evcard[data-ev="clash"]'), first: (document.querySelector('.evcard') || {}).dataset && document.querySelector('.evcard').dataset.ev }));
  ok('the Events page opens with the Houses Clash card first', ev.card && ev.first === 'clash', JSON.stringify(ev));
  await page.evaluate(() => window.HOLDOR.showHub('clan')); await page.waitForTimeout(500);
  const cl = await page.evaluate(() => !!document.getElementById('bClashCard')); await tap('#bClashCard', 500);
  const cl2 = await page.evaluate(() => window.HOLDOR.CLOUD.screen); await tap('#bBack', 500);
  ok('the Clan tab has the Clash card; it opens the Clash screen and its back arrow returns to Clan', cl && cl2 === 'clash-menu' && await page.evaluate(() => window.HOLDOR.CLOUD.screen) === 'hub:clan', JSON.stringify([cl, cl2]));
  await page.evaluate(() => window.HOLDOR.showHub('events')); await page.waitForTimeout(500);
  await tap('.evcard[data-ev="clash"]', 500);
  const menu = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, bots: document.querySelectorAll('.clb').length, on: (document.querySelector('.clb.on') || {}).dataset && document.querySelector('.clb.on').dataset.b, locked: document.querySelectorAll('.clb.lock').length, go: (document.getElementById('bClashGo') || {}).textContent }));
  ok('the Clash screen: five bot levels, bot 1 chosen, the rest locked, a Fight button', menu.scr === 'clash-menu' && menu.bots === 5 && menu.on === '1' && menu.locked === 4 && /Fight bot 1/.test(menu.go), JSON.stringify(menu));
  await page.screenshot({ path: SC + 'clash101_menu.png' });
  await tap('#bClashGo', 900);
  const st = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, C = window.HOLDOR_CLASH.CLASH; return { scr: H.CLOUD.screen, state: G.state, mode: G.mode, lane: G.lane, on: C.on, B: !!C.B, bLane: C.B && C.B.lane, bHouse: C.B && C.B.house, sameMap: C.B && C.B.map !== G.map && C.B.map.slots.length === G.map.slots.length && Math.round(C.B.map.routes[0].total) === Math.round(G.map.routes[0].total), slots: G.map.slots.length, roadTop: Math.min(...G.map.routes[0].pts ? G.map.routes[0].pts.map(p => p[1] || p.y) : [0]), ui: !!document.getElementById('clashUi'), sends: document.querySelectorAll('#clashUi button.cs').length, sub: document.getElementById('hSub').textContent, heroB: C.B && C.B.heroOn }; });
  ok('a clash runs: mode clash, two states (mine A, the rival\'s B on the same layout with its own slots, another house, no champion), the strip with four sends', st.state === 'play' && st.mode === 'clash' && st.lane === 'A' && st.on && st.B && st.bLane === 'B' && st.bHouse !== 'stark' && st.sameMap && st.slots >= 4 && st.ui && st.sends === 4 && /Clash/.test(st.sub) && !st.heroB, JSON.stringify(st));
  // ---- 40 s of play by steps: both lanes get waves, the bot builds, points come
  const run = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_CLASH, C = X.CLASH; const p0 = C.pts; for (let i = 0; i < 60 * 40 && G.state === 'play'; i++) { H.step(); X.clashStepB(); }
    const B = C.B; return { wA: G.wave, wB: B.wave, eA: G.enemies.length, eB: B.enemies.length, tA: G.map.slots.filter(s => s.tower).length, tB: B.map.slots.filter(s => s.tower).length, pts: C.pts, p0, bpts: C.bpts, doorA: Math.round(G.doorHp), doorB: Math.round(B.doorHp), botSent: G.enemies.some(e => e.troop) || (G.log || []).length, state: G.state, lane: C.lane, fin: C.fin }; });
  ok('after 40 s: waves on both lanes, the bot built a tower on its lane (mine has none), army points grew by 4', run.wA >= 2 && run.wB >= 2 && run.tB >= 1 && run.tA === 0 && run.pts === Math.min(10, run.p0 + 4) && run.state === 'play' && run.lane === 'A' && !run.fin, JSON.stringify(run));
  // ---- a send: foot ×3 of House Stark appear on the rival's road as enemies; points drop; a tap on the button does the same
  const snd = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_CLASH, C = X.CLASH; const p0 = C.pts; const nB0 = C.B.enemies.filter(e => e.troop).length; const r = X.clashSend('foot'); const tr = C.B.enemies.filter(e => e.troop); return { r, p0, p1: C.pts, n: tr.length - nB0, house: tr[0] && tr[0].troop, role: tr[0] && tr[0].role, hp: tr[0] && tr[0].hp, type: tr[0] && tr[0].type, log: C.log.filter(l => l.a === 'send').length }; });
  ok('a send costs 2 points and puts three Stark foot soldiers on the rival\'s road (enemies of type troop); it is logged', snd.r && snd.p1 === snd.p0 - 2 && snd.n === 3 && snd.house === 'stark' && snd.role === 'foot' && snd.hp > 100 && snd.type === 'troop' && snd.log === 1, JSON.stringify(snd));
  await page.evaluate(() => { const C = window.HOLDOR_CLASH.CLASH; C.pts = 10; window.HOLDOR_CLASH.clashSpawnTroops('lannister', 'archer'); }); await page.waitForTimeout(100);
  const b0 = await page.evaluate(() => window.HOLDOR_CLASH.CLASH.B.enemies.filter(e => e.troop).length);
  await tap('#clashUi button.cs[data-r="rider"]', 300);
  const tp = await page.evaluate(() => ({ nB: window.HOLDOR_CLASH.CLASH.B.enemies.filter(e => e.troop && e.role === 'rider').length, pts: window.HOLDOR_CLASH.CLASH.pts, mine: window.HOLDOR.G.enemies.filter(e => e.troop).length }));
  ok('the rider button sends two riders (3 points); a Lannister archer pair walks my road', tp.nB === 2 && tp.pts === 7 && tp.mine >= 2, JSON.stringify([b0, tp]));
  // ---- the soldiers walk and fight on the road; the frame draws both lanes without errors
  const walk = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_CLASH; X.clashSpawnTroops('tyrell', 'foot'); const t = G.enemies[G.enemies.length - 1]; t.hp = t.max = 1e6; const p0 = t.prog; for (let i = 0; i < 120; i++) { H.step(); X.clashStepB(); } return { moved: t.prog > p0 + 20, alive: t.hp > 0 || t.dead, state: G.state }; });
  ok('sent soldiers walk the road', walk.moved, JSON.stringify(walk));
  await page.waitForTimeout(400); await page.screenshot({ path: SC + 'clash101_battle.png' });
  const drawn = await page.evaluate(() => { const c = document.getElementById('c'), x = c.getContext('2d'); const top = x.getImageData(0, 0, c.width, Math.floor(c.height / 2)).data, bot = x.getImageData(0, Math.floor(c.height / 2), c.width, Math.floor(c.height / 2)).data; const s = d => { const set = new Set(); for (let i = 0; i < d.length; i += 4 * 97) set.add((d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5)); return set.size; }; return { top: s(top), bot: s(bot) }; });
  ok('both halves of the canvas are drawn (many colours each)', drawn.top > 8 && drawn.bot > 8, JSON.stringify(drawn));
  // ---- taps: the top half is ignored; a tap in my lane lands on my map (world y shifted by the window)
  const tw = await page.evaluate(() => { const X = window.HOLDOR_CLASH; const w = X.toWorld(195, 350 + 100); const w2 = X.w2s(195, X.CLASH_TOP + 100); return { y: Math.round(w.y), expect: X.CLASH_TOP + 100, back: Math.round(w2.y - document.getElementById('c').offsetTop) }; });
  ok('toWorld shifts a tap in the bottom half into the lane window; w2s brings it back to the same screen y', tw.y === tw.expect && Math.abs(tw.back - 450 * (await page.evaluate(() => window.HOLDOR_CLASH.CLASH.myDy && document.getElementById('c').getBoundingClientRect().width / 390))) < 2, JSON.stringify(tw));
  // ---- the end: the rival's door breaks → a win, gold, the record; Again starts a new clash
  const fin = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_CLASH, C = X.CLASH; const g0 = H.ACC.gold; C.B.doorHp = 1; C.B.enemies.push(Object.assign({}, C.B.enemies[0] || { type: 'sword', hp: 10, max: 10, prog: 0, route: 0, id: 9999, spdBase: 60, vel: 0, slow: 1, mark: 1, stunT: 0, atkT: 0, dps: 10, r: 10, gold: 1 }, { prog: C.B.map.routes[0].total - 10, hp: 500, max: 500, id: 99999, troop: null })); for (let i = 0; i < 60 * 8 && !C.fin; i++) { H.step(); X.clashStepB(); } return { win: C.win, fin: C.fin, state: G.state, rec: H.ACC.clash, gold: H.ACC.gold - g0 }; });
  await page.waitForTimeout(900);
  const res = await page.evaluate(() => ({ text: document.querySelector('#card') ? document.querySelector('#card').innerText.slice(0, 120).replace(/\n/g, ' ') : '', again: !!document.getElementById('bClAgain'), home: !!document.getElementById('bClHome') }));
  ok('the rival\'s door breaks: Clash won, the record 1W, no gold invented (the server pays from v1.1.2), the result with Again and home', fin.win === 'A' && fin.fin && fin.state === 'over' && fin.rec.w === 1 && fin.gold === 0 && /Clash won/.test(res.text) && res.again && res.home, JSON.stringify([fin, res]));
  await page.screenshot({ path: SC + 'clash101_result.png' });
  await tap('#bClAgain', 900);
  const again = await page.evaluate(() => ({ state: window.HOLDOR.G.state, mode: window.HOLDOR.G.mode, on: window.HOLDOR_CLASH.CLASH.on, fin: window.HOLDOR_CLASH.CLASH.fin, ui: !!document.getElementById('clashUi') }));
  ok('Again starts a fresh clash', again.state === 'play' && again.mode === 'clash' && again.on && !again.fin && again.ui, JSON.stringify(again));
  // ---- my door breaks → a loss, no gold, home cleans up
  const lose = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_CLASH, C = X.CLASH; const g0 = H.ACC.gold; G.doorHp = 0; for (let i = 0; i < 30 && !C.fin; i++) { H.step(); X.clashStepB(); } return { win: C.win, rec: H.ACC.clash, gold: H.ACC.gold - g0, state: G.state }; });
  await page.waitForTimeout(1100); await tap('#bClHome', 700);
  const home = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, on: window.HOLDOR_CLASH.CLASH.on, ui: !!document.getElementById('clashUi') }));
  ok('my door breaks: a loss (1W 1L), no gold; To the castle leaves the clash clean', lose.win === 'B' && lose.rec.l === 1 && lose.gold === 0 && home.scr === 'hub:battle' && !home.on && !home.ui, JSON.stringify([lose, home]));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
