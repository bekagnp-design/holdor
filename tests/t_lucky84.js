// v1.0.84: lucky chests. Before a chest opens: ★ stars for its tier and three taps; each lucky tap raises it one tier (new art, name,
// a star pops in) and the rewards are the final tier's. Untouched, the taps play by themselves. A dragon chest opens straight away.
// Real taps on a guest seat (the server's version is in backend/test/v21_test.py and the managed flow in econ_test.py).
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_LUCKY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 };
    a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 1000; H.setAcc(a); H.showHub('battle'); });
  await page.waitForTimeout(500);
  // every tap lucky: a wooden chest climbs to dragon
  await page.evaluate(() => { window.__r = Math.random; Math.random = () => 0.01; const L = window.HOLDOR_LUCKY.luckyRoll('wood'); Math.random = window.__r; window.__L = L;
    const g0 = window.HOLDOR.ACC.gold; window.__g0 = g0; window.HOLDOR_LUCKY.luckyShow('wood', L, f => { window.__final = f; }); });
  const s0 = await page.evaluate(() => ({ stars: document.querySelectorAll('#lkSt i.on').length, name: document.getElementById('lkN').textContent, left: document.getElementById('lkLeft').textContent, L: window.__L }));
  ok('a wooden chest: one star, three taps to go (all three rolled lucky)', s0.stars === 1 && s0.left === '3' && JSON.stringify(s0.L) === JSON.stringify({ taps: [true, true, true], tier: 'dragon' }), JSON.stringify(s0));
  const seen = [];
  for (let i = 0; i < 3; i++) { await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(450);
    seen.push(await page.evaluate(() => [document.querySelectorAll('#lkSt i.on').length, document.getElementById('lkN').textContent])); }
  ok('each tap adds a star and a better chest: Iron, Valyrian, Dragon', JSON.stringify(seen) === JSON.stringify([[2, 'Iron chest'], [3, 'Valyrian chest'], [4, 'Dragon chest']]), JSON.stringify(seen));
  await page.screenshot({ path: SC + 'lucky84_dragon.png' });
  await page.waitForTimeout(1200);
  ok('after the third tap the chest goes on as a dragon chest', await page.evaluate(() => window.__final === 'dragon'));
  // the full flow through openChest: no luck, untouched — it plays by itself and opens an iron chest with iron rewards
  await page.evaluate(() => { const H = window.HOLDOR; window.__r = Math.random; Math.random = () => 0.99; window.__g0 = H.ACC.gold; window.HOLDOR_MARKET && 0;
    window.__done = false; window.HOLDOR.openChest('iron', () => { window.__done = true; }); Math.random = window.__r; });
  const t0 = Date.now(); let opened = false;
  while (Date.now() - t0 < 15000) { opened = await page.evaluate(() => !!document.querySelector('#ccol.in')); if (opened) break; await page.waitForTimeout(250); }
  const fin = await page.evaluate(() => ({ name: (document.querySelector('#cer h2') || {}).textContent, gold: window.HOLDOR.ACC.gold - window.__g0, rows: document.querySelectorAll('#crw .rcard').length }));
  ok('untouched, the taps play by themselves and the chest opens (iron: 220–360 gold)', opened && fin.name === 'Iron chest' && fin.gold >= 220 && fin.gold <= 360 + 400, JSON.stringify(fin));
  await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(300);
  ok('collect closes it', await page.evaluate(() => window.__done === true));
  // a dragon chest skips the luck
  await page.evaluate(() => { window.HOLDOR.openChest('dragon', () => {}); });
  ok('a dragon chest opens straight away (no stars, no taps)', await page.evaluate(() => !document.getElementById('lkSt') && /TAP TO OPEN/.test(document.getElementById('ctap').textContent)));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
