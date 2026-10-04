// v1.0.96: battle fx — a hit flashes in the blow's colour and throws sparks, merged damage numbers, deaths burst by kind,
// projectile trails, tower recoil + muzzle smoke, the gate jolts and sheds splinters, ambient life per biome.
// Display only: the same seeded battle ends with the same numbers with the layer on and off. Reduced motion turns it off.
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
const ACC = () => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
  a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
  a.gold = 1000; a.gems = 50; for (let i = 1; i < 50; i++) a.campaign[i] = 3; H.setAcc(a); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FXB, { timeout: 20000 }); await page.waitForTimeout(400);
  await page.evaluate(ACC); await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(700);
  const tap = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; const b = await l.boundingBox(); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return true; };
  // ---- 1. a real battle, entered by taps: Battle → HOLD THE DOOR
  await tap('#bBattle'); await page.waitForTimeout(700);
  await tap('#bGo'); await page.waitForTimeout(900);
  for (let k = 0; k < 4 && (await page.evaluate(() => window.HOLDOR.G.state)) !== 'play'; k++) {
    for (const s of ['#bStart', '#bBegin', '#bPlay', '#bOk', '#bGo']) if (await tap(s)) { await page.waitForTimeout(700); break; } }
  const st0 = await page.evaluate(() => ({ state: window.HOLDOR.G.state, biome: window.HOLDOR.G.map && window.HOLDOR.G.map.biome }));
  ok('a battle starts by taps (Battle → HOLD THE DOOR)', st0.state === 'play', JSON.stringify(st0));
  // build a mixed defence, then fight: the layer must show hits, deaths, trails and shots
  const fight = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_FXB; X.FXB.qLock = 1; X.FXB.q = 1;
    G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5; const types = ['watch', 'scorp', 'wild', 'watch', 'glass', 'scorp', 'watch', 'wild'];
    G.map.slots.slice(0, 8).forEach((s, i) => { if (!s.tower) H.build(s, types[i]); });
    let now = performance.now(), maxTr = 0, maxNp = 0, maxNn = 0, sawRecoil = 0;
    for (let i = 0; i < 60 * 50; i++) { if (H.canCall() && i % 600 === 0) H.callWave(); H.step(); if (G.state !== 'play') break;
      if (i % 2 === 0) { now += 33.3; X.drawFrame(now); const c = X.fxbCounts(); maxTr = Math.max(maxTr, c.trails); maxNp = Math.max(maxNp, c.np); maxNn = Math.max(maxNn, c.nn); } }
    const c = X.fxbCounts(); return { c, maxTr, maxNp, maxNn, kills: G.kills, state: G.state }; });
  ok('hits flash and spark, deaths burst (pool > 0 after kills), numbers merged and capped (≤ 8)', fight.kills > 0 && fight.c.st.hits > 0 && fight.c.st.deaths > 0 && fight.maxNp > 0 && fight.maxNn > 0 && fight.maxNn <= 8, JSON.stringify({ kills: fight.kills, st: fight.c.st, maxNp: fight.maxNp, maxNn: fight.maxNn }));
  ok('projectile trails exist while towers shoot; towers recoil with a muzzle puff', fight.maxTr > 0 && fight.c.st.shots > 0, 'trails ' + fight.maxTr + ', shots ' + fight.c.st.shots);
  ok('combat particles stay under the cap (160)', fight.maxNp <= 160, String(fight.maxNp));
  // the tinted flash: wildfire paints the white silhouette green (cached), a plain arrow keeps it white
  const tint = await page.evaluate(() => { const X = window.HOLDOR_FXB, wh = document.createElement('canvas'); wh.width = 8; wh.height = 8; const x = wh.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(2, 2, 4, 4);
    const g = X.fxbTint({ type: 'axe', lastSrc: 'wild' }, wh), w = X.fxbTint({ type: 'axe', lastSrc: 'watch' }, wh), px = g.getContext('2d').getImageData(4, 4, 1, 1).data;
    return { green: px[1] > px[0] && px[1] > px[2], white: w === wh, cached: X.fxbTint({ type: 'axe', lastSrc: 'wild' }, wh) === g }; });
  ok('a hit flash takes the blow\'s colour (wildfire green), steel stays white, tints are cached', tint.green && tint.white && tint.cached, JSON.stringify(tint));
  // mid-fight screenshot: let the real loop draw a moment
  const mid = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_FXB, G = H.G; G.paused = false; let now = performance.now(), best = 0;
    for (let i = 0; i < 60 * 40 && G.state === 'play'; i++) { if (H.canCall()) H.callWave(); H.step(); if (i % 2 === 0) { now += 33.3; X.drawFrame(now); const c = X.fxbCounts(); best = Math.max(best, c.np); if (c.np >= 40 && c.trails >= 2 && c.nn >= 2) break; } }
    return X.fxbCounts(); });
  await page.screenshot({ path: SC + 'fx96_battle_mid.png' });
  console.log('mid-fight shot: particles ' + mid.np + ', trails ' + mid.trails + ', numbers ' + mid.nn);
  // ---- 2. the gate: a stage with no towers, the enemies reach the door
  const gate = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_FXB; H.startGame({ mode: 'campaign', level: H.stageLevel(20) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false;
    let now = performance.now(), kick = 0, off = 0, chips = 0; const gs = X.FXB.st.gate;
    for (let i = 0; i < 60 * 90 && X.FXB.st.gate === gs; i++) { if (H.canCall() && i % 300 === 0) H.callWave(); H.step(); if (i % 2 === 0) { now += 33.3; X.drawFrame(now); } }
    const g0 = X.FXB.st.gate - gs; X.drawFrame(now += 16.7); kick = X.FXB.kick; for (let k = 0; k < 6; k++) off = Math.max(off, Math.abs(X.fxbGateKick(now + k * 7))); chips = X.FXB.P.slice(0, X.FXB.np).filter(p => p.k === 4).length;
    return { g0, kick, off, chips, door: G.doorHp, max: G.doorMax }; });
  ok('the gate jolts and sheds splinters when it is hit', gate.g0 > 0 && gate.kick > 0 && gate.off > 0 && gate.chips > 0, JSON.stringify(gate));
  // ---- 3. ambient life per biome (snow, ash, desert, storm, swamp, sea …), screenshots of a snow and an ash/desert stage
  const want = ['snow', 'ash', 'desert', 'storm', 'swamp', 'forest', 'city', 'mountain', 'coast'];
  const stages = await page.evaluate(w => { const H = window.HOLDOR, out = {}; for (let n = 1; n <= 50; n++) { const L = H.stageLevel(n); const b = L && (L.biome || (L.o && L.o.biome)); if (b && w.includes(b) && !out[b]) out[b] = n; } return out; }, want);
  const amb = {};
  for (const b of Object.keys(stages)) {
    amb[b] = await page.evaluate(n => { const H = window.HOLDOR, X = window.HOLDOR_FXB; H.startGame({ mode: 'campaign', level: H.stageLevel(n) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false;
      let now = performance.now(); for (let i = 0; i < 40; i++) { now += 16.7; X.drawFrame(now); } const c = X.fxbCounts(); return { biome: G.map.biome, na: c.na, glint: c.glint, fires: c.fires }; }, stages[b]);
    if (b === 'snow' || b === 'ash' || b === 'desert') { await page.waitForTimeout(900); await page.screenshot({ path: SC + 'fx96_battle_' + b + '.png' }); }
  }
  const lively = Object.values(amb).filter(a => a.na > 0);
  ok('ambient particles live in at least 3 biomes (≤ 90 each)', lively.length >= 3 && Object.values(amb).every(a => a.na <= 90), JSON.stringify(amb));
  // ---- 4. display only: the same seeded battle with the layer on and off ends the same
  const same = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_FXB;
    // the Daily Hold is seeded (G.rng from the day and the attempt), so the same start replays the same battle
    const run = on => { X.FXB.on = on; H.ACC.online.attempts = 99; H.startGame({ mode: 'online' }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 5000;
      const types = ['watch', 'wild', 'scorp', 'watch', 'glass']; G.map.slots.slice(0, 5).forEach((s, i) => H.build(s, types[i]));
      let now = 1000; for (let i = 0; i < 60 * 70; i++) { if (H.canCall() && i % 900 === 0) H.callWave(); H.step(); if (G.state !== 'play') break; if (i % 2 === 0) { now += 33.3; X.drawFrame(now); } }
      const pos = G.enemies.map(e => { const p = H.posAt(G.map, e.prog, e.route); return e.fly ? [Math.round(e.x * 100), Math.round(e.y * 100)] : [Math.round(p.x * 100), Math.round(p.y * 100)]; }).join(';');
      return [G.kills, Math.round(G.gold * 100), Math.round(G.doorHp * 100), G.wave, G.enemies.length, pos].join('|'); };
    const a = run(false), b = run(true), c = run(false); X.FXB.on = true; return { a, b, c, deaths: X.FXB.st.deaths }; });
  ok('the same seeded battle gives the same digest with the layer on and off (display only)', same.a === same.b && same.a === same.c, (same.a === same.b ? 'digest ' + same.a.slice(0, 60) + '…' : same.a.slice(0, 120) + ' ≠ ' + same.b.slice(0, 120)));
  // ---- 5. cost: the battle's draw() timed over 300 frames, layer off vs on (same battle, headless)
  const perf = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_FXB;
    const run = on => { X.FXB.on = on; H.ACC.online.attempts = 99; H.startGame({ mode: 'online' }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5;
      const types = ['watch', 'scorp', 'wild', 'watch', 'glass', 'scorp', 'watch', 'wild']; G.map.slots.slice(0, 8).forEach((s, i) => H.build(s, types[i]));
      let now = 5000; for (let i = 0; i < 60 * 30; i++) { if (H.canCall()) H.callWave(); H.step(); if (i % 3 === 0) { now += 50; X.drawFrame(now); } }
      let tot = 0; for (let f = 0; f < 300; f++) { if (H.canCall()) H.callWave(); H.step(); now += 16.7; const t0 = performance.now(); X.drawFrame(now); tot += performance.now() - t0; }
      return tot / 300; };
    const off1 = run(false), on1 = run(true), off2 = run(false), on2 = run(true), off3 = run(false), on3 = run(true); X.FXB.on = true;
    return { off: Math.min(off1, off2, off3), on: Math.min(on1, on2, on3), np: X.FXB.np, enemies: H.G.enemies.length }; });
  console.log('PERF draw ms/frame: off ' + perf.off.toFixed(3) + ' · on ' + perf.on.toFixed(3) + ' (enemies ' + perf.enemies + ', particles ' + perf.np + ')');
  ok('the layer costs little (< 1.5 ms/frame more, headless)', perf.on - perf.off < 1.5, 'off ' + perf.off.toFixed(3) + ' / on ' + perf.on.toFixed(3));
  await page.close();
  // ---- 6. reduced motion: off
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push('PE2:' + e.message));
  await p2.emulateMedia({ reducedMotion: 'reduce' });
  await p2.goto(URL); await p2.waitForFunction(() => window.HOLDOR && window.HOLDOR_FXB, { timeout: 20000 }); await p2.waitForTimeout(300); await p2.evaluate(ACC);
  const calm = await p2.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_FXB; H.startGame({ mode: 'campaign', level: H.stageLevel(41) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5;
    ['watch', 'wild', 'scorp'].forEach((t, i) => H.build(G.map.slots[i], t)); let now = 1000;
    for (let i = 0; i < 60 * 40; i++) { if (H.canCall() && i % 600 === 0) H.callWave(); H.step(); if (i % 2 === 0) { now += 33.3; X.drawFrame(now); } }
    const wh = document.createElement('canvas'); wh.width = wh.height = 4; return { calm: X.FXB.calm, c: X.fxbCounts(), kills: G.kills, tint: X.fxbTint({ type: 'axe', lastSrc: 'wild' }, wh) === wh, kick: X.fxbGateKick(now) }; });
  ok('prefers-reduced-motion: the layer is off (no particles, trails, numbers, tint or gate jolt)', calm.calm && calm.c.np === 0 && calm.c.na === 0 && calm.c.trails === 0 && calm.c.nn === 0 && calm.tint && calm.kick === 0, JSON.stringify({ calm: calm.calm, np: calm.c.np, na: calm.c.na, tr: calm.c.trails, kills: calm.kills }));
  await ctx2.close();
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) ? 1 : 0);
})();
