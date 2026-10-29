// v1.2.7: captions under the battle buttons, the speed button still works.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_PREP, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1); for (let i = 1; i <= 20; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist();
    H.startGame({ mode: 'campaign', level: H.LEVELS.find(l => l.id === 8) }); H.G.gold = 500; });
  await page.waitForTimeout(800);
  ok('the three top buttons carry a caption', await page.evaluate(() => ['bInfo', 'bSpeed', 'bPause'].map(i => document.getElementById(i).dataset.cap).join() === 'BOOK,SPEED,PAUSE'));
  await page.screenshot({ path: SC + 'ui127_battle.png' });
  await page.locator('#bSpeed').tap({ force: true }); await page.waitForTimeout(200);
  ok('the speed button still works', await page.evaluate(() => /2/.test(document.getElementById('bSpeed').textContent)));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
