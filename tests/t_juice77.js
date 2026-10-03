// v1.0.77: juice — a pressed button springs, the currency counts up to its new value after a change, coins fly from a reward into the
// counter, a tab's rows rise in the first time it opens (not on every redraw), and a burst of kills in battle calls out a streak.
// Display only: the battle's numbers are the same with and without it.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_JUICE, { timeout: 20000 }); await page.waitForTimeout(400);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 1000; a.gems = 50;
    for (let i = 1; i < 6; i++) a.campaign[i] = 3; H.setAcc(a); H.showHub('battle'); });
  await page.waitForTimeout(800);
  // the press spring: pointerdown adds .jp, release swaps it for the spring .jr
  const b = page.locator('#bBattle');
  const box = await b.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.waitForTimeout(60);
  const pressed = await page.evaluate(() => document.querySelector('#bBattle').classList.contains('jp'));
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  const sprung = await page.evaluate(() => document.querySelector('#bBattle').classList.contains('jr') && !document.querySelector('#bBattle').classList.contains('jp'));
  await page.mouse.up(); await page.waitForTimeout(500);
  ok('a pressed button sinks (.jp) and springs back (.jr) on release', pressed && sprung);
  if (await page.evaluate(() => !!document.querySelector('.cmap,.mapview'))) await page.evaluate(() => window.HOLDOR.showHub('battle'));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(300);
  // the gold counts up after it changes
  await page.evaluate(() => { window.HOLDOR.ACC.gold += 500; window.HOLDOR.showHub('battle'); });
  await page.waitForTimeout(60);
  const mid = await page.evaluate(() => document.querySelector('.hubtop .cur > span').textContent.replace(/[^\d.kKmM]/g, ''));
  await page.waitForTimeout(900);
  const end = await page.evaluate(() => document.querySelector('.hubtop .cur > span').textContent.replace(/[^\d.kKmM]/g, ''));
  ok('the gold counts up from the old value to the new one', mid !== end && /1[.,]?5/.test(end), mid + ' → ' + end);
  // coins fly from a reward into the counter
  await page.evaluate(() => { window.HOLDOR_JUICE.juiceCoins(document.querySelector('#bBattle'), 'gold'); });
  await page.waitForTimeout(150);
  const coins = await page.evaluate(() => document.querySelectorAll('.jcoin').length);
  await page.waitForTimeout(1300);
  const left = await page.evaluate(() => document.querySelectorAll('.jcoin').length);
  ok('eight coins fly to the counter and are gone when they land', coins === 8 && left === 0, coins + ' / ' + left);
  // a tab rises in once: opening Shop marks its rows, a redraw of the same tab does not
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(60);
  const rise1 = await page.evaluate(() => document.querySelectorAll('#hubBody .jrise').length);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(60);
  const rise2 = await page.evaluate(() => document.querySelectorAll('#hubBody .jrise').length);
  ok('a tab rises in when it opens, not again on a redraw', rise1 > 0 && rise2 === 0, rise1 + ' / ' + rise2);
  await page.screenshot({ path: SC + 'juice77_shop.png' });
  // battle: a burst of kills calls out a streak; the call-out is display only
  const shout = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; H.startGame({ level: H.stageLevel(3) }); G.lq = []; G.tut = null; G.paused = false;
    window.HOLDOR_JUICE.juiceFrame(); G.time = 10; G.kills += 3; window.HOLDOR_JUICE.juiceFrame(); G.time = 10.5; G.kills += 6; window.HOLDOR_JUICE.juiceFrame();
    const a = [...document.querySelectorAll('.jshout')].map(e => e.innerText.replace(/\s+/g, ' '));
    G.time = 11; G.kills += 8; window.HOLDOR_JUICE.juiceFrame();
    const b = [...document.querySelectorAll('.jshout')].map(e => e.innerText.replace(/\s+/g, ' '));
    return { a, b }; });
  ok('nine kills in a moment: "9 KILLS"; eight more: RAMPAGE ×17', shout.a.length === 1 && /9 KILLS/.test(shout.a[0]) && shout.b.some(x => /RAMPAGE/.test(x) && /17/.test(x)), JSON.stringify(shout));
  const same = await page.evaluate(() => { const H = window.HOLDOR; const run = j => { H.startGame({ level: H.stageLevel(4) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false;
      for (let i = 0; i < 60 * 40; i++) { if (H.canCall()) H.callWave(); H.step(); if (j && i % 4 === 0) window.HOLDOR_JUICE.juiceFrame(); } return [G.kills, Math.round(G.gold), Math.round(G.doorHp), G.wave].join(','); };
    return [run(false), run(true)]; });
  ok('the battle is the same with the juice on (display only)', same[0] === same[1], same.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
