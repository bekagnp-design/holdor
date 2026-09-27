const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 430, height: 800 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + process.argv[2]); await page.waitForFunction(() => window.HOLDOR, { timeout: 20000 }); await page.waitForTimeout(300);
  const shots = [];
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; for (let i = 1; i <= 7; i++) a.campaign[i] = 2; a.sel = 'jon'; a.gold = 900; H.setAcc(a); H.persist(); H.showHub('battle'); });
  await page.waitForTimeout(700); await page.screenshot({ path: 'h1.png' });
  const tabs = await page.evaluate(() => { const t = document.querySelector('.hubtabs'); if (!t) return null; const q = t.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom), innerHeight]; });
  await page.evaluate(() => window.HOLDOR.showCampaign()); await page.waitForTimeout(800); await page.screenshot({ path: 'h2.png' });
  const card = await page.evaluate(() => { const b = document.querySelector('.playcard .go') || document.querySelector('.go'); if (!b) return null; const q = b.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; });
  await page.evaluate(async () => { const H = window.HOLDOR; H.startGame({ mode: 'campaign', level: H.LEVELS[7] }); const G = H.G; G.wave = G.totalWaves; G.waveDone = true; G.spawnQueue = []; G.enemies = []; for (let i = 0; i < 5 && G.state === 'play'; i++) H.step(); await new Promise(r => setTimeout(r, 400)); });
  await page.waitForTimeout(500); await page.screenshot({ path: 'h3.png' });
  const nxt = await page.evaluate(() => { const b = document.querySelector('#bNext'); if (!b) return null; const q = b.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; });
  console.log(JSON.stringify({ tabs, card, nxt }), errors);
  await browser.close();
})();
