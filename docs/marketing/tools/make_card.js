// Builds the link-card / bot banner from the REAL game (beta/index.html): a mid-fight battle frame on a snow stage with the v1.0.96
// effects, and the home screen. Output: docs/marketing/shots/battle96.png, home96.png and card_1280x720.png (+ 640x360 by make_card.py).
// usage: CHROMIUM_PATH=... node docs/marketing/tools/make_card.js [stage]   (default stage 38)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..'), OUT = path.resolve(__dirname, '..') + '/', SH = OUT + 'shots/';
const URL = 'file://' + ROOT + '/beta/index.html', STAGE = +(process.argv[2] || 38);
const ACC = () => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
  a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
  a.gold = 12400; a.gems = 380; a.name = 'Defender'; for (let i = 1; i < STAGE; i++) a.campaign[i] = 3; H.setAcc(a); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await page.addInitScript(() => { const raf0 = window.requestAnimationFrame.bind(window); window.__fxHold = false;
    window.requestAnimationFrame = cb => raf0(t => { if (window.__fxHold) window.requestAnimationFrame(cb); else cb(t); }); });
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FXB, { timeout: 20000 }); await page.waitForTimeout(400);
  await page.evaluate(`(${ACC.toString().replace('STAGE', STAGE)})()`);
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(1500);
  await page.screenshot({ path: SH + 'home96.png' });
  // the battle: build a defence, fight until a busy frame, hold the real loop and shoot
  const info = await page.evaluate(stage => { const H = window.HOLDOR, G0 = H.G; H.startGame({ level: H.stageLevel(stage) }); const G = H.G, X = window.HOLDOR_FXB; X.FXB.qLock = 1; X.FXB.q = 1;
    G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5; const types = ['watch', 'scorp', 'wild', 'glass', 'watch', 'scorp', 'wild', 'watch'];
    G.map.slots.slice(0, 8).forEach((s, i) => { if (!s.tower) H.build(s, types[i]); }); window.__fxHold = true; G.paused = false;
    let now = performance.now(), best = 0, bestI = 0; const d0 = X.FXB.st.deaths;
    for (let i = 0; i < 60 * 70 && G.state === 'play'; i++) { if (H.canCall()) H.callWave(); H.step(); if (i % 2 === 0) { now += 33.3; X.drawFrame(now); const c = X.fxbCounts();
      const score = c.np + 6 * c.trails + 10 * c.nn + 4 * Math.min(G.enemies.length, 12); if (i > 600 && score > best && c.st.deaths > d0 + 3) { best = score; bestI = i; if (best > 190) break; } } }
    return { biome: G.map.biome, state: G.state, best, counts: X.fxbCounts(), wave: G.wave, enemies: G.enemies.length }; }, STAGE);
  console.log('battle frame', JSON.stringify(info));
  await page.waitForTimeout(80); await page.screenshot({ path: SH + 'battle96.png' });
  await browser.close();
})();
