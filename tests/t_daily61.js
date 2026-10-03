// v1.0.61: the calendar and quests for a guest (no server): the button says why, the screen explains, no popup, nothing is credited;
// and the tables the server pays from are what the screen promises.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_DAILY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const D = await page.evaluate(() => { const X = window.HOLDOR_DAILY; return { n: X.LOGIN_CAL.length, empty: X.LOGIN_CAL.filter(d => !Object.keys(d).length).length, q: Object.fromEntries(Object.entries(X.QUESTS).map(([k, l]) => [k, l.length])),
    ids: Object.values(X.QUESTS).flat().map(q => q.id), metrics: [...new Set(Object.values(X.QUESTS).flat().map(q => q.m))].sort(), books: Object.values(X.QUESTS).flat().concat(X.LOGIN_CAL.map(r => ({ r }))).flatMap(q => Object.keys((q.r && q.r.books) || q.books || {})) }; });
  ok('30 calendar days, each pays something', D.n === 30 && D.empty === 0);
  ok('quest ids are unique, metrics are the ones the server counts', new Set(D.ids).size === D.ids.length && D.metrics.every(m => ['wins', 'kills', 'days', 'stars', 'hold_runs', 'hold_waves', 'new_stages', 'hard_wins', 'battles'].includes(m)), JSON.stringify(D.metrics));
  ok('only real books are paid', D.books.every(b => ['b:c', 'b:r', 'b:e', 'b:l'].includes(b)), D.books.join());
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; H.setAcc(a); H.showHub('battle'); });
  await page.waitForTimeout(1800);
  const b = await page.evaluate(() => ({ btn: (document.querySelector('#bDaily') || {}).textContent, modal: !!document.querySelector('#ecoModal.on') }));
  ok('the Daily button is there (an icon button, no number for a guest)', /Daily/.test(b.btn || '') && !/\d/.test(b.btn || ''), b.btn);
  ok('no popup for a guest', !b.modal);
  await page.locator('#bDaily').tap({ force: true }); await page.waitForTimeout(500);
  const t = await page.evaluate(() => document.querySelector('#card').innerText);
  ok('the screen explains what is needed', /signed in through Telegram/.test(t), t.slice(0, 120).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'daily_guest.png' });
  ok('nothing was credited', await page.evaluate(() => window.HOLDOR.ACC.gems) === 80 && await page.evaluate(() => window.HOLDOR.ACC.gold) === 150);
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
