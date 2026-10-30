// v1.3.5: the build card on the result screen.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_BUILD && window.HOLDOR_MARKET, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const run = (learn) => page.evaluate((learn) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1); for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); window.HOLDOR_LEARN.LEARN.at.length = 0;
    H.startGame({ mode: 'campaign', level: H.LEVELS.find(l => l.id === 8) }); const G = H.G; for (const k of learn) { G.learnAsk = [k]; window.HOLDOR_LEARN.learnPick(k); } G.hLv = 2; G.kills = 40;
    window.HOLDOR_MARKET.showCampaignResult(true, 3, [], 12); return { has: !!document.querySelector('.bcard'), txt: (document.querySelector('.bcard') || {}).innerText || '', icons: document.querySelectorAll('.bcard .bcs').length }; }, learn);
  const none = await run([]); ok('nothing learned: no card', none.has === false);
  const r = await run(['warhammer', 'howl']);
  ok('two skills learned: the card names the build and shows both', r.has && r.icons === 2 && /build/.test(r.txt) && /battle level 3/.test(r.txt), JSON.stringify(r).slice(0, 220));
  await page.waitForTimeout(1500); await page.screenshot({ path: SC + 'build135.png' });
  ok('the build card has a share button with the build in the text', await page.evaluate(() => !!document.getElementById('bBuildShare') && /build/.test(window.HOLDOR_BUILD.buildShareText())));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
