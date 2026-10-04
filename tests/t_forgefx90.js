// v1.0.90: the forge scene. Upgrading shows an anvil, a hammer (swinging, with sparks) and the item while the server decides, then the
// verdict: success = "+3" rising, a flash and golden sparks; failure = "NOT THIS TIME · the item is safe", smoke and a shake. The scene waits
// at least 1.9 s so the hammer lands, a tap skips the verdict, and the continuation (toast, forge redraw) runs once afterwards.
// A server that cannot be reached ends the scene instead of leaving it on the screen.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const sql = fs.readFileSync(path.resolve(__dirname, '..', 'backend', 'holdor_v11.sql'), 'utf8');
const CFG = JSON.parse(/insert into econ_config \(k, v\) values \('gear', '(\{[\s\S]*?\})'::jsonb\) on conflict/.exec(sql)[1]);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GFX && window.HOLDOR_GEAR, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(([cfg]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; H.setAcc(a);
    GX.gearTestBag([{ id: 'f90', slot: 'weapon', kind: 11, r: 4, tier: 4, cap: 4, set: 'dragon', lvl: 2, champ: null, main: { k: 'dmg', v: 6 }, subs: [] }], cfg); GX.showForge('jon'); }, [CFG]);
  await page.waitForTimeout(400);
  // success
  await page.evaluate(() => { const G = window.HOLDOR_GFX, it = window.HOLDOR_GEAR.gearItems()[0]; window.__log = []; window.__t0 = performance.now(); window.__g = G.gfxStart(it, 'up');
    G.gfxReveal(window.__g, true, Object.assign({}, it, { lvl: 3 }), '+3', () => window.__log.push(['done', Math.round(performance.now() - window.__t0)])); });
  await page.waitForTimeout(900);
  const A = await page.evaluate(() => { const e = document.getElementById('gfx'), h = e && e.querySelector('.gfh'); return { on: !!e, anvil: !!e.querySelector('.gfa'), big: !!e.querySelector('.gfi .gbig'), sparks: e.querySelectorAll('.gfk').length, swing: h ? h.getAnimations().length : 0, win: e.classList.contains('win') }; });
  await page.screenshot({ path: SC + 'forgefx90_hammer.png' });
  ok('the scene: the item on an anvil, the hammer swinging, sparks flying, no verdict yet', A.on && A.anvil && A.big && A.swing > 0 && A.sparks > 0 && !A.win, JSON.stringify(A));
  await page.waitForTimeout(1300);
  const B = await page.evaluate(() => { const e = document.getElementById('gfx'); return e && { win: e.classList.contains('win'), txt: e.querySelector('#gft').textContent, hammer: e.querySelector('.gfh').style.display, gold: e.querySelectorAll('.gfk.g').length, log: window.__log.length }; });
  await page.screenshot({ path: SC + 'forgefx90_win.png' });
  ok('the verdict waited for the hammer (>= 1.9 s), then: "+3", golden sparks, hammer away', B && B.win && B.txt === '+3' && B.hammer === 'none' && B.gold >= 10 && B.log === 0, JSON.stringify(B));
  await page.waitForTimeout(1900);
  const C = await page.evaluate(() => ({ gone: !document.getElementById('gfx'), log: window.__log }));
  ok('the scene ends by itself and the continuation runs once', C.gone && C.log.length === 1 && C.log[0][1] >= 3000, JSON.stringify(C));
  // failure + a tap skips the verdict
  await page.evaluate(() => { const G = window.HOLDOR_GFX, it = window.HOLDOR_GEAR.gearItems()[0]; window.__log = []; window.__g = G.gfxStart(it, 'up'); G.gfxReveal(window.__g, false, it, '', () => window.__log.push('done')); });
  await page.waitForTimeout(2300);
  const D = await page.evaluate(() => { const e = document.getElementById('gfx'); return e && { lose: e.classList.contains('lose'), txt: e.querySelector('#gft').textContent, smoke: e.querySelectorAll('.gfm').length, log: window.__log.length }; });
  await page.screenshot({ path: SC + 'forgefx90_lose.png' });
  ok('failure: "NOT THIS TIME · the item is safe", smoke', D && D.lose && /NOT THIS TIME/.test(D.txt) && /safe/.test(D.txt) && D.smoke > 0 && D.log === 0, JSON.stringify(D));
  await page.touchscreen.tap(195, 420); await page.waitForTimeout(200);
  const E = await page.evaluate(() => ({ gone: !document.getElementById('gfx'), log: window.__log.length }));
  ok('a tap skips the rest of the verdict (the continuation runs once)', E.gone && E.log === 1, JSON.stringify(E));
  // a server that cannot be reached: the Upgrade button starts the scene, the failure ends it
  await page.evaluate(() => window.HOLDOR_GEAR.gearSheet(window.HOLDOR_GEAR.gearItems()[0].id, 'jon')); await page.waitForTimeout(400);
  await page.locator('#ecoModal .eb button').first().tap(); await page.waitForTimeout(300);
  const F1 = await page.evaluate(() => !!document.getElementById('gfx'));
  let gone = false; for (let i = 0; i < 60 && !gone; i++) { await page.waitForTimeout(250); gone = await page.evaluate(() => !document.getElementById('gfx')); }
  ok('the Upgrade button starts the scene; with no server it ends instead of hanging on the screen', gone, JSON.stringify({ started: F1, ended: gone }));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
