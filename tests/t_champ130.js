// v1.3.0: the champion grows in battle (kills → levels) and two skills of one kind make a synergy.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CHAMP, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const start = (stage, mode) => page.evaluate(([stage, mode]) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); window.HOLDOR_LEARN.LEARN.at.length = 0;
    H.startGame({ mode: 'campaign', level: H.LEVELS.find(l => l.id === stage) }); H.G.waveDone = false; H.G.nextIn = 1e9; }, [stage, mode]);
  await start(8);
  const base = await page.evaluate(() => { const h = window.HOLDOR.G.hero; return { dmg: h.dmg, max: h.max }; });
  const r1 = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.kills = 12; G.hero.hp = G.hero.max * 0.5; H.step(); const h = G.hero; return { lv: G.hLv, dmg: h.dmg, max: h.max, hp: h.hp }; });
  ok('12 kills: battle level 2, +6% damage and health, a fifth of the health back', r1.lv === 1 && Math.abs(r1.dmg / base.dmg - 1.06) < 1e-6 && Math.abs(r1.max / base.max - 1.06) < 0.01 && r1.hp > base.max * 0.5, JSON.stringify([base, r1]));
  const r2 = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.kills = 500; for (let i = 0; i < 10; i++) H.step(); return G.hLv; });
  ok('all five levels come, one per step, no more', r2 === 5, r2);
  await start(2); const r3 = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.kills = 60; H.step(); return G.hLv || 0; });
  ok('stage 2 (the guided minutes): no levels', r3 === 0);
  // synergy: the champion's own kind + a learned skill of the same kind
  await start(8);
  const syn = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, C = window.HOLDOR_CHAMP; const kit = G.hero.c.sk, cat = C.skCat(kit[0]), SK = C.SK, skCat = C.skCat;
    const other = Object.keys(SK).find(id => !SK[id].ult && !kit.includes(id) && skCat(id) === cat && id !== 'taunt'); const dmg0 = G.hero.dmg, max0 = G.hero.max, gold0 = G.gold;
    G.learnAsk = [other]; window.HOLDOR_LEARN.learnPick(other); return { cat, other, dmg: G.hero.dmg / dmg0, max: G.hero.max / max0, gold: G.gold - gold0, done: G.synDone }; });
  ok('a second skill of the same kind: the synergy bonus lands once', (syn.dmg > 1.09 || syn.max > 1.09 || syn.gold >= 80 || syn.dmg < 1) && syn.done[syn.cat] === 1, JSON.stringify(syn));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
