// v1.3.3: Wildfire jars (aimed pool) and Beacon (towers faster, stealth revealed): they open by stage, they work in battle.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_SP, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const start = (n, loadout) => page.evaluate(([n, loadout]) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.sel = 'robb'; a.loadout = loadout; H.setAcc(a); H.persist(); window.HOLDOR_LEARN.LEARN.at.length = 0;
    H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); const G = H.G; G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.gold = 5000; }, [n, loadout]);
  await start(20, ['jars', 'beacon', 'arrows']);
  const j = await page.evaluate(() => { const H = window.HOLDOR, S = window.HOLDOR_CASTLE, G = H.G; const R0 = G.map.routes[0]; const p = H.posAt(G.map, R0.total * 0.5, 0); S.spawn('sword', R0.total * 0.5, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 5000; e.slow = 1;
    window.HOLDOR_SP.castPower('jars', p.x, p.y); const c = G.clouds.length, t0 = e.hp; for (let i = 0; i < 120; i++) H.step(); return { clouds: c, cd: G.powerCd.jars > 0, dmg: t0 - e.hp, t: G.clouds[0] && G.clouds[0].t }; });
  ok('Wildfire jars: a pool appears, the cooldown starts, an enemy standing in it burns', j.clouds === 1 && j.cd && j.dmg > 60, JSON.stringify(j));
  const b = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.enemies.length = 0; const slot = G.map.slots[3]; H.build(slot, 'watch'); const t = slot.tower; const R0 = G.map.routes[0]; const S = window.HOLDOR_CASTLE;
    const near = (() => { let best = 0, bd = 1e9; for (let pr = 40; pr < R0.total - 60; pr += 8) { const p = H.posAt(G.map, pr, 0); const d = Math.hypot(p.x - slot.x, p.y - slot.y); if (d < bd) { bd = d; best = pr; } } return best; })();
    S.spawn('sword', near, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 1e9; e.stealth = true;
    t.cd = 0; H.step(); const normal = t.cd; t.cd = 0; window.HOLDOR_SP.castPower('beacon'); H.step(); const fast = t.cd; return { normal, fast, ratio: normal / fast, until: G.beaconUntil > G.time, stealth: e.stealth }; });
  ok('Beacon: towers shoot 30% faster, stealth is revealed', Math.abs(b.ratio - 1.3) < 0.05 && b.until && b.stealth === false, JSON.stringify(b));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
