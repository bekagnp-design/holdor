// v1.0.60: the Stars shop for a guest (no Telegram, no server): packs are shown, disabled, with the reason; the Starter pack is not offered;
// the item table matches what the server sells; nothing is credited by tapping.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_STARS, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.gems = 20; H.setAcc(a); H.showHub('shop'); });
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({ btns: [...document.querySelectorAll('[data-stars]')].map(b => b.dataset.stars + ':' + b.disabled), note: (document.querySelector('.shopnote+.shopgrid') ? '' : '') || [...document.querySelectorAll('.shopnote')].map(x => x.textContent).join('|'), starter: !!document.querySelector('[data-stars="starter"]') }));
  ok('three packs, all disabled for a guest', JSON.stringify(s.btns) === '["gems_s:true","gems_m:true","gems_l:true"]', JSON.stringify(s.btns));
  ok('the Starter pack is not offered to a guest', !s.starter);
  ok('the note says why', /signed in through Telegram/.test(s.note), s.note);
  await page.locator('[data-stars="gems_m"]').first().tap({ force: true }).catch(() => {}); await page.waitForTimeout(300);
  ok('a tap on a disabled pack does nothing', await page.evaluate(() => window.HOLDOR.ACC.gems) === 20 && !(await page.evaluate(() => document.querySelector('#ecoModal.on'))));
  const T = await page.evaluate(() => Object.fromEntries(Object.entries(window.HOLDOR_STARS.STARS_SHOP).map(([k, v]) => [k, [v.stars, v.gems, v.gold || 0]])));
  ok('the price table', JSON.stringify(T) === '{"gems_s":[50,150,0],"gems_m":[125,400,0],"gems_l":[350,1200,0],"pass":[250,null,0],"vip":[200,null,0],"starter":[75,300,5000]}', JSON.stringify(T));
  ok('better value for bigger packs', T.gems_s[1] / T.gems_s[0] < T.gems_m[1] / T.gems_m[0] && T.gems_m[1] / T.gems_m[0] < T.gems_l[1] / T.gems_l[0]);
  await page.screenshot({ path: SC + 'stars_guest.png' });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
