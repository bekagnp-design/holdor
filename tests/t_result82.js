// v1.0.82: the result screen. A win: the VICTORY ribbon, three stars that land one after another, the gold counting up to its value,
// confetti for three stars; the old buttons stay and work (NEXT, Share). A loss: the DEFEAT ribbon and the red card.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_RESULT, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    a.campaign[1] = 3; H.setAcc(a); H.startGame({ level: H.stageLevel(1) }); G.kills = 40; G.goldReward = 480; window.HOLDOR_MARKET.showCampaignResult(true, 3, [], 3); });
  await page.waitForTimeout(150);
  const a = await page.evaluate(() => ({ cls: document.getElementById('card').className, rbn: (document.querySelector('#card .rbn') || {}).textContent, stars: document.querySelectorAll('#card .rs').length,
    on: document.querySelectorAll('#card .rs.on').length, landed: document.querySelectorAll('#card .rs.landed').length, gold: document.querySelector('#card p.m b').textContent }));
  await page.waitForTimeout(1700);
  const b = await page.evaluate(() => ({ landed: document.querySelectorAll('#card .rs.landed').length, gold: document.querySelector('#card p.m b').textContent, conf: document.querySelectorAll('.rconf').length, next: !!document.getElementById('bNext'), share: !!document.getElementById('bShare') }));
  ok('a win: the VICTORY ribbon on the gold card, three stars', /res/.test(a.cls) && /win/.test(a.cls) && a.rbn === 'VICTORY' && a.stars === 3 && a.on === 3, JSON.stringify(a));
  ok('the stars land one after another (none at once, all after 1.5 s)', a.landed === 0 && b.landed === 3, a.landed + ' → ' + b.landed);
  ok('the gold counts up to +480', /^\+0/.test(a.gold) && /^\+480/.test(b.gold), a.gold + ' → ' + b.gold);
  ok('three stars bring confetti; NEXT and Share are still there', b.conf > 10 && b.next && b.share, JSON.stringify(b));
  await page.screenshot({ path: SC + 'result82_win.png' });
  await page.locator('#bNext').tap({ force: true }); await page.waitForTimeout(600);
  ok('NEXT still starts the next stage', await page.evaluate(() => window.HOLDOR.G.state === 'play' && window.HOLDOR.G.level.id === 2));
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.wave = 3; window.HOLDOR_MARKET.showCampaignResult(false, 0, [], 0); }); await page.waitForTimeout(200);
  const l = await page.evaluate(() => ({ cls: document.getElementById('card').className, rbn: (document.querySelector('#card .rbn') || {}).textContent, retry: !!document.getElementById('bRetry') }));
  ok('a loss: the DEFEAT ribbon on the red card, Try again is there', /lose/.test(l.cls) && l.rbn === 'DEFEAT' && l.retry, JSON.stringify(l));
  await page.screenshot({ path: SC + 'result82_lose.png' });
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
