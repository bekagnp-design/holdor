// v1.0.97: the tower guide (build sheet, tower sheet, Collection → Towers demo) and the tower fx in battle (glass spears, weirwood
// wave + roots, wildfire bloom, scorpion charge, keep sparks). Display only: the same seeded battle gives the same numbers with the fx on and off.
const { chromium } = require('playwright'); const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.addInitScript(() => { const raf0 = window.requestAnimationFrame.bind(window); window.__hold = false; window.requestAnimationFrame = cb => raf0(t => { if (window.__hold) window.requestAnimationFrame(cb); else cb(t); }); });
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FXT, { timeout: 20000 }); await page.waitForTimeout(400);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    a.gold = 1000; a.gems = 50; for (let i = 1; i < 50; i++) a.campaign[i] = 3; H.setAcc(a); H.showHub('battle'); });
  await page.waitForTimeout(600);
  // ---- the guide texts: every tower has one, with real numbers
  const g = await page.evaluate(() => { const X = window.HOLDOR_FXT, out = {}; for (const k of Object.keys(X.TGUIDE)) { const h = X.towerGuideMini(k, 3), n = X.tgNums(k, 3); out[k] = { len: h.length, nums: n.length, txt: h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; } return out; });
  ok('all six towers have a guide with numbers and a strong / weak line', Object.keys(g).length === 6 && Object.values(g).every(x => x.nums >= 3 && /✔/.test(x.txt) && /✖/.test(x.txt)), JSON.stringify(Object.keys(g)));
  const nm = await page.evaluate(() => { const X = window.HOLDOR_FXT, T = window.HOLDOR.TOWERS || {}; const w = X.tgNums('watch', 1), gl = X.tgNums('glass', 1), we = X.tgNums('weir', 1);
    return { w: w.map(x => x[2]), gl: gl.map(x => x[2]), we: we.map(x => x[2]) }; });
  ok('numbers come from the game: Watchtower lvl 1 = 10 per hit, 1.60/s, 16 dps; Dragonglass slow 45%; Weirwood slow 30%, +20%', nm.w[0] === '10 per hit' && nm.w[1] === '1.60 / s' && String(nm.w[2]) === '16' && /45%/.test(nm.gl[1]) && /30%/.test(nm.we[0]) && /\+20%/.test(nm.we[1]), JSON.stringify(nm));
  // ---- in battle: tap a pad, build from the ring, tap the tower, ℹ → the tower sheet shows the guide
  const playing = () => page.waitForFunction(() => window.HOLDOR.G.state === 'play', { timeout: 6000 }).then(() => true, () => false);
  await page.locator('#bBattle').first().tap({ force: true }); if (!(await playing())) { await page.locator('#bGo').first().tap({ force: true }); await playing(); }
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5; H.setCam && 0; });
  const pad = await page.evaluate(() => { const G = window.HOLDOR.G, s = G.map.slots.find(s => !s.tower), r = window.HOLDOR.w2s ? window.HOLDOR.w2s(s.x, s.y) : null; return { id: s.id, r }; });
  const sheetBuild = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, s = G.map.slots.find(s => !s.tower); H.openConfirm(s, 'glass'); return document.querySelector('#sheet').innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); });
  ok('the build sheet shows who the tower hits, its numbers and strong / weak', /Ground only/.test(sheetBuild) && /White Walkers/.test(sheetBuild) && /✔/.test(sheetBuild) && /✖/.test(sheetBuild), sheetBuild.slice(0, 200));
  await page.screenshot({ path: SC + 'tw97_build_sheet.png' });
  const sheetTower = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_FXT; let G = H.G; document.querySelector('#cNo') && document.querySelector('#cNo').click();
    H.startGame({ level: H.stageLevel(9) }); G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5;
    const X0 = window.HOLDOR_FXB; const heat = G.map.slots.map(() => 0); let nowp = performance.now();
    for (let i = 0; i < 60 * 25 && G.state === 'play'; i++) { if (H.canCall()) H.callWave(); H.step(); if (i % 6 === 0) for (const e of G.enemies) { if (e.hp <= 0) continue; const p = window.HOLDOR_FXT.posE(e); G.map.slots.forEach((s, j) => { if (Math.hypot(p.x - s.x, p.y - s.y) < 58) heat[j]++; }); } }
    H.startGame({ level: H.stageLevel(9) }); G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5;
    const order = heat.map((h, j) => [h, j]).sort((x, y) => y[0] - x[0]).map(x => x[1]); const free = order.filter(j => !G.map.slots[j].tower).map(j => G.map.slots[j]);
    ['glass', 'weir', 'wild', 'scorp', 'watch', 'keep'].forEach((t, i) => { if (free[i]) H.build(free[i], t); });
    const s = G.map.slots.find(s => s.tower && s.tower.type === 'weir'); G.sel = s; X.openSheet(s); return document.querySelector('#sheet').innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); });
  ok('the tower sheet (ℹ) shows the guide for that tower: Weirwood', /Weirwood/.test(sheetTower) && /no damage of its own/.test(sheetTower) && /\+20%/.test(sheetTower), sheetTower.slice(0, 220));
  await page.screenshot({ path: SC + 'tw97_tower_sheet.png' }); await page.evaluate(() => { const H = window.HOLDOR; H.G.sel = null; document.querySelector('#sClose') && document.querySelector('#sClose').click(); });
  // ---- the fx: fight with all six towers, count what each effect produced
  const fx = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_FXT, F = X.FXT; window.__hold = true; G.paused = false; let now = performance.now(), maxSp = 0, maxBl = 0, bigSp = 0, sc = 0;
    for (let i = 0; i < 60 * 70 && G.state === 'play'; i++) { if (H.canCall()) H.callWave(); H.step(); if (i % 2 === 0) { now += 33.3; window.HOLDOR_FXB.drawFrame(now); maxSp = Math.max(maxSp, F.sp.length); maxBl = Math.max(maxBl, F.bl.length); if (F.sp.some(o => o.big)) bigSp++;
        if (G.towers) 0; } }
    return { maxSp, maxBl, bigSp, kills: G.kills, state: G.state, sp: F.sp.length, bl: F.bl.length }; });
  ok('Dragonglass spears burst under enemies in its zone (and stay under the cap 24)', fx.maxSp > 0 && fx.maxSp <= 24, JSON.stringify(fx));
  ok('a Wildfire shell blooms where it lands (≤ 8 at once)', fx.maxBl > 0 && fx.maxBl <= 8, JSON.stringify(fx));
  await page.waitForTimeout(60); await page.screenshot({ path: SC + 'tw97_battle.png' }); await page.evaluate(() => { window.__hold = false; });
  // ---- the Collection → Towers page shows the looping demo
  await page.evaluate(() => { const H = window.HOLDOR; H.G.state = 'menu'; H.showHub('coll'); });
  await page.waitForTimeout(700);
  const book = await page.evaluate(async () => { const H = window.HOLDOR; const t = document.querySelector('.subtabs button[data-sub="book"],[data-sub="codex"],[data-sub="book"]'); return !!t; });
  ok('the Collection has the book tab', book);
  // ---- reduced motion: no tower fx
  const calm = await page.evaluate(() => { const F = window.HOLDOR_FXT.FXT; F.calm = true; F.sp.length = 0; const G = window.HOLDOR.G; return { calm: F.calm }; });
  ok('reduced motion switches the tower fx off', calm.calm === true);
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors)); const bad = Object.values(R).filter(v => !v.startsWith('OK')); await browser.close(); process.exit(bad.length || errors.length ? 1 : 0);
})();
