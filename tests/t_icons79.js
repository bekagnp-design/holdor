// v1.0.79: drawn icons instead of emoji — the five quick buttons, today's gift, the Hold pill and the Tasks tabs show SVG icons.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_HOME, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.holdTut = 1; a.holdIntro = 1;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    for (let i = 1; i <= 5; i++) a.campaign[i] = 3; H.setAcc(a); H.showHub('battle'); });
  await page.waitForTimeout(700);
  const home = await page.evaluate(() => ({ gift: !!document.querySelector('#dailyGift svg'), tasks: !!document.querySelector('#bTasks svg') }));
  ok('today\'s gift and the Tasks pill carry drawn icons', home.gift && home.tasks, JSON.stringify(home));
  await page.evaluate(() => window.HOLDOR.showHub('coll')); await page.waitForTimeout(500);
  const army = await page.evaluate(() => [...document.querySelectorAll('.homerow.army .hbtn .ic')].map(e => !!e.querySelector('svg') && !/\p{Extended_Pictographic}/u.test(e.textContent)));
  ok('the three Army buttons (Forge, Tavern, City) carry drawn icons, no emoji', army.length === 3 && army.every(Boolean), JSON.stringify(army));
  await page.screenshot({ path: SC + 'icons79_home.png' });
  await page.evaluate(() => window.HOLDOR.showHub('tasks')); await page.waitForTimeout(500);
  const tabs = await page.evaluate(() => document.querySelectorAll('.hubbody .tkbody, .hubbody p').length >= 0 && [...document.querySelectorAll('.subtabs.tks button')].map(b => !!b.querySelector('svg')));
  ok('Tasks: no tabs for a guest, or every tab with its icon', Array.isArray(tabs) && tabs.every(Boolean), JSON.stringify(tabs));
  const all = await page.evaluate(() => Object.keys(window.HOLDOR_ICONS || {}).length);
  ok('ten icons are defined', all === 10, all);
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
