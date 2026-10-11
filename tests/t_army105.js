// v1.1.5: the clear Army — champion strip + 3D card, one big LEVEL UP button, skill rows that open on tap,
// the talent and the portal folded away, the tower room with the same big button. Real taps.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(250); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.gold = 60000; a.gems = 1000; a.sel = 'robb'; a.champs.robb = { lvl: 3, sk: [1, 1, 1], tal: 0 };
    a.cards = { 'c:robb': 200, 'b:c': 2 }; H.setAcc(a); H.persist(); window.HOLDOR_ARMY.showHeroRoom('robb'); });
  await page.waitForTimeout(500);
  const s0 = await page.evaluate(() => ({ strip: !!document.querySelector('#armStrip'), card: !!document.querySelector('.acard'),
    big: (() => { const b = document.querySelector('.bigbtn.lvl.ready'); return b ? b.getBoundingClientRect().height : 0; })(),
    tal: document.querySelector('[data-tgt="tal"]').hidden, portal: document.querySelector('[data-tgt="portal"]').hidden }));
  ok('strip, 3D card, a big green LEVEL UP (>=48px), talent + portal folded', s0.strip && s0.card && s0.big >= 48 && s0.tal && s0.portal, JSON.stringify(s0));
  await tap('.bigbtn.lvl.ready');
  ok('the big button levels up (3 → 4)', await page.evaluate(() => window.HOLDOR.cprog(null, 'robb').lvl) === 4);
  await tap('#armStrip .htile:not(.view)');
  const v = await page.evaluate(() => document.querySelector('.htile.view').dataset.c);
  ok('tapping a tile in the strip changes the champion', v !== 'robb', v);
  await tap('#armStrip .htile[data-c="robb"]');
  await tap('.skrh[data-row="0"]');
  ok('a skill row opens its demo on tap', await page.evaluate(() => !!document.querySelector('.skr.open .rvdemo')));
  await tap('[data-tog="tal"]');
  ok('the talent opens on tap', await page.evaluate(() => !document.querySelector('[data-tgt="tal"]').hidden));
  await page.screenshot({ path: SC + 'army105_hero.png' });
  await tap('[data-tog="portal"]');
  ok('the portal opens on tap', await page.evaluate(() => !document.querySelector('[data-tgt="portal"]').hidden));
  await page.evaluate(() => window.HOLDOR_ARMY.showTowerRoom('archer')); await page.waitForTimeout(400);
  const t0 = await page.evaluate(() => ({ strip: !!document.querySelector('#armStrip'), btn: !!document.querySelector('.bigbtn.lvl'), info: document.querySelector('[data-tgt="tinfo"]') ? document.querySelector('[data-tgt="tinfo"]').hidden : null }));
  ok('tower room: strip + a big level button', t0.strip && t0.btn, JSON.stringify(t0));
  await page.screenshot({ path: SC + 'army105_tower.png' });
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
