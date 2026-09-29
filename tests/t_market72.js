// v1.0.72: sharing (a win, a duel) opens Telegram's share sheet with a line and the game link; a `startapp=s_<code>` start parameter
// is reported to the server once per device; the win screen has a Share button that really taps.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.addInitScript(() => { window.__opened = []; window.__rpc = [];
    window.Telegram = { WebApp: { platform: 'android', version: '8.0', initData: '', initDataUnsafe: { start_param: 's_yt1' }, ready() {}, expand() {}, onEvent() {}, isVersionAtLeast() { return true; }, requestFullscreen() {}, disableVerticalSwipes() {}, lockOrientation() {}, setHeaderColor() {}, setBackgroundColor() {}, openTelegramLink(u) { window.__opened.push(u); } } }; });
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_MARKET, { timeout: 20000 }); await page.waitForTimeout(400);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => window.HOLDOR_MARKET.shareWin(7, 3)); await page.waitForTimeout(300);
  let u = await page.evaluate(() => window.__opened.slice());
  ok('a win share opens the Telegram share sheet with the game link and a line about gate 7 with 3 stars', u.length === 1 && u[0].startsWith('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/HoldorTDBot/play')) && decodeURIComponent(u[0]).includes('gate 7 ⭐⭐⭐'), u[0]);
  await page.evaluate(() => window.HOLDOR_MARKET.shareDuel(9, 150, 'a bot')); await page.waitForTimeout(300);
  u = await page.evaluate(() => window.__opened.slice());
  ok('a duel share says the waves, the kills and the opponent', u.length === 2 && /9 waves, 150 of the dead put down, against a bot/.test(decodeURIComponent(u[1])), u[1]);
  // the win screen: a real tap on Share
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; H.setAcc(a); H.startGame({ level: H.stageLevel(1) }); G.kills = 12; window.HOLDOR_MARKET.showCampaignResult(true, 3, [], 3); });
  await page.waitForTimeout(600);
  const has = await page.evaluate(() => !!document.querySelector('#bShare'));
  ok('the win screen has a Share button', has);
  if (has) { await page.locator('#bShare').tap({ force: true }); await page.waitForTimeout(400); }
  u = await page.evaluate(() => window.__opened.slice());
  ok('tapping it shares the stage the seat just held', u.length === 3 && /gate 1 ⭐⭐⭐/.test(decodeURIComponent(u[2])), u[2]);
  await page.screenshot({ path: SC + 'market72_win.png' });
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
