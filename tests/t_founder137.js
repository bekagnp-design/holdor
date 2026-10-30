// v1.3.7: the founder tag under the name — from the server number, only for the first hundred.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  let answer = '7'; let asked = 0;
  await page.route(/founder_no/, r => { asked++; r.fulfill({ status: 200, contentType: 'application/json', body: answer }); });
  await page.route(/telegram\.org/, r => r.abort());
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FND, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const home = (cloud) => page.evaluate((cloud) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; for (let i = 1; i <= 10; i++) a.campaign[i] = 3; H.setAcc(a);
    window.HOLDOR_FND.FND.asked = false; H.CLOUD.on = cloud; H.CLOUD.token = cloud ? '00000000-0000-0000-0000-000000000001' : null; H.showHub('battle'); }, cloud);
  await home(false); await page.waitForTimeout(500);
  ok('a guest sees no founder tag and asks nothing', await page.evaluate(() => !document.querySelector('.fnd')) && asked === 0);
  await home(true); await page.waitForTimeout(900);
  ok('a signed-in player #7 gets the tag once the server answers', await page.evaluate(() => /Founder #7/.test(document.querySelector('.who small').innerText)) && asked === 1);
  const kept = await page.evaluate(() => window.HOLDOR.ACC.fno); ok('the number is kept on the account', kept === 7);
  await page.evaluate(() => { window.HOLDOR.ACC.fno = 0; window.HOLDOR_FND.FND.asked = false; }); answer = '104'; asked = 0; await home(true); await page.waitForTimeout(900);
  ok('number 104 is not a founder: no tag', await page.evaluate(() => !document.querySelector('.fnd')));
  await page.evaluate(() => { window.HOLDOR.ACC.fno = 0; window.HOLDOR_FND.FND.asked = false; }); answer = 'null'; await home(true); await page.waitForTimeout(900);
  ok('the server says null: no tag, no error', await page.evaluate(() => !document.querySelector('.fnd')));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
