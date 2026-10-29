// v1.3.2: the Siege maul — opens at stage 18, slams a circle, staggers what is not a boss; the rooms know it.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_MAUL && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const setup = (n) => page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.sel = 'robb'; a.tlv = { maul: 16 }; H.setAcc(a); H.persist(); window.HOLDOR_LEARN.LEARN.at.length = 0; return H.openTowers().includes('maul'); }, n);
  ok('closed at 17 stages', await setup(17) === false);
  ok('open at 18 stages', await setup(18) === true);
  // in battle: a pack, one swing
  const r = await page.evaluate(() => { const H = window.HOLDOR, S = window.HOLDOR_CASTLE; H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); const G = H.G; G.gold = 5000; G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.projs.length = 0;
    const slot = G.map.slots[3]; H.build(slot, 'maul'); const t = slot.tower; t.cd = 0; const R0 = G.map.routes[0]; let best = null, bd = 1e9;
    for (let pr = 40; pr < R0.total - 60; pr += 8) { const p = H.posAt(G.map, pr, 0); const d = Math.hypot(p.x - slot.x, p.y - slot.y); if (d < bd) { bd = d; best = pr; } }
    for (let i = 0; i < 3; i++) { S.spawn('sword', best + i * 8, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 9000; }
    S.spawn('sword', best, 0); const boss = G.enemies[G.enemies.length - 1]; boss.hp = boss.max = 9000; boss.boss = 1;
    for (let i = 0; i < 20; i++) H.step();
    const E = G.enemies.slice(); const hit = E.filter(e => e.hp < e.max).length, stag = E.filter(e => !e.boss && e.chillT > G.time && e.chillV === 98).length, bossStag = boss.chillT > G.time && boss.chillV === 98;
    return { hit, stag, bossStag, n: E.length }; });
  ok('one swing hurts the pack and staggers it, but not the boss', r.hit >= 2 && r.stag >= 2 && r.bossStag === false, JSON.stringify(r));
  await page.evaluate(() => window.HOLDOR_ARMY.showTowerRoom('maul')); await page.waitForTimeout(600);
  ok('the tower room shows the maul with a demo', await page.locator('canvas.dmv[data-dk="tower"][data-di="maul"]').count() === 1);
  await page.screenshot({ path: SC + 'maul132.png' });
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
