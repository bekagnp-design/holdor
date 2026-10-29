// v1.2.4: the preparation sheet before a battle — real taps: spells into slots, towers in and out, the build menu follows.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_PREP, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(250); };
  const setup = (n) => page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); H.showCampaign('gates'); }, n);
  // early: nothing to choose, the battle starts at once
  await setup(4); await tap('#bGo'); await page.waitForTimeout(400);
  ok('before stage 5 there is no sheet, the battle starts', await page.evaluate(() => !document.querySelector('#prep') && window.HOLDOR.G.state === 'play'));
  // stage 20 cleared: seven towers, five spells
  await setup(20); await tap('#bGo');
  ok('the sheet opens with the stage button', await page.locator('#prep .pcard').count() === 1);
  ok('five towers are chosen out of seven', await page.evaluate(() => window.HOLDOR_PREP.towerRoster().length === 5 && document.querySelectorAll('#prep [data-tw]').length === 7));
  await page.screenshot({ path: SC + 'prep124.png' });
  // drop a tower, add another
  const before = await page.evaluate(() => window.HOLDOR_PREP.towerRoster());
  await tap('#prep [data-tw="' + before[0] + '"]'); await tap('#prep [data-tw="rook"]');
  const after = await page.evaluate(() => window.HOLDOR_PREP.towerRoster());
  ok('the roster follows the taps', !after.includes(before[0]) && after.includes('rook') && after.length === 5, after.join());
  // spells: slot 0, put Long Night
  await tap('#prep [data-s="0"]'); await tap('#prep [data-sp="night"]');
  ok('Long Night sits in slot 1', await page.evaluate(() => window.HOLDOR.ACC.loadout[0] === 'night'));
  await tap('#pGo'); await page.waitForTimeout(500);
  const res = await page.evaluate(() => { const H = window.HOLDOR; return { play: H.G.state === 'play', slots: H.G.slots, bt: window.HOLDOR_PREP.battleTowers(), btn: document.querySelector('#bP0') && document.querySelector('#bP0').getAttribute('data-p') }; });
  ok('the battle starts with the chosen spells and towers', res.play && res.slots[0] === 'night' && res.bt.includes('rook') && !res.bt.includes(before[0]), JSON.stringify(res));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
