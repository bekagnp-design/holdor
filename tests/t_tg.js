// Telegram full-screen simulation on an iPhone-sized screen: fake WebApp + the safe-area CSS variables Telegram sets.
const { chromium } = require('playwright');
const OUT = __dirname + '/rv/';
const VW = 390, VH = 844, TOP = 47, CTOP = 46, BOT = 34;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  await page.route(/telegram\.org|supabase\.co/, r => r.abort());
  await page.addInitScript(([TOP, CTOP, BOT]) => {
    const noop = () => {};
    window.Telegram = { WebApp: { platform: 'ios', version: '8.0', initData: '', initDataUnsafe: { user: { id: 7, first_name: 'Test', language_code: 'ka' } },
      ready: noop, expand: noop, onEvent: noop, offEvent: noop, isVersionAtLeast: () => true, requestFullscreen: noop, disableVerticalSwipes: noop, lockOrientation: noop,
      setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop, enableClosingConfirmation: noop, HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
      CloudStorage: { getItem: (k, cb) => cb && cb(null, ''), setItem: (k, v, cb) => cb && cb(null, true) }, safeAreaInset: { top: TOP, bottom: BOT, left: 0, right: 0 }, contentSafeAreaInset: { top: CTOP, bottom: 0, left: 0, right: 0 }, viewportHeight: 844, viewportStableHeight: 844, isFullscreen: true } };
    document.addEventListener('DOMContentLoaded', () => { const r = document.documentElement.style; r.setProperty('--tg-safe-area-inset-top', TOP + 'px'); r.setProperty('--tg-content-safe-area-inset-top', CTOP + 'px'); r.setProperty('--tg-safe-area-inset-bottom', BOT + 'px'); });
  }, [TOP, CTOP, BOT]);
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR, { timeout: 20000 });
  await page.waitForTimeout(1000);
  const rect = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.top), Math.round(r.bottom)] : null; }, sel);
  const out = { tgClass: await page.evaluate(() => document.documentElement.classList.contains('tg')) };
  await page.screenshot({ path: OUT + 'tg_title.png' });
  // a fresh player straight into the tutorial
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; H.setAcc(a); H.persist(); H.showHub('battle'); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + 'tg_hub_new.png' });
  out.hubNew = { top: await rect('.hubtop'), tabs: await rect('.hubtabs'), battle: await rect('#bBattle') };
  const b = await page.locator('#bBattle').boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + 'tg_tut0.png' });
  out.tut = await page.evaluate(() => { const G = window.HOLDOR.G; const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.top), Math.round(r.bottom)] : null; }; return { state: G.state, tut: !!G.tut, hud: q('#hud'), stage: q('#stage'), bar: q('#bar'), skip: q('#tutSkip'), app: q('#app') }; });
  // tap through to the build step and open the ring
  for (let i = 0; i < 8; i++) { const w = await page.evaluate(() => { const X = window.HOLDOR_TUT, st = X.TS(); return st ? (st.want || 'hold') : null; }); if (w !== 'hold') break; await page.touchscreen.tap(VW / 2, 450); await page.waitForTimeout(700); }
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + 'tg_tut_build.png' });
  out.build = await page.evaluate(() => { const X = window.HOLDOR_TUT, st = X.TS(); const R = window.HOLDOR_RING.state(); return { want: st && st.want, ring: !!R, btns: [...document.querySelectorAll('#ring .rb')].map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; }) }; });
  // mid-campaign battle, ring at the top-most pad
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('lannister', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 1; a.learn = { glass: 1, keep: 1, tier2: 1, fire: 1, reinf: 1, scorp: 1, wild: 1, weir: 1, tier3: 1, tier4: 1, tier5: 1, gates: 1, big: 1, chest: 1, hold: 1, champ: 1 }; for (let i = 1; i <= 20; i++) a.campaign[i] = 2; H.setAcc(a); H.startGame({ mode: 'campaign', level: H.LEVELS[20] }); H.G.gold = 3000; });
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => { const G = window.HOLDOR.G, R = window.HOLDOR_RING; const s = G.map.slots.slice().sort((a, b) => a.y - b.y)[0]; R.openRing(s); R.ringFrame(); const st = document.querySelector('#stage').getBoundingClientRect(); return { stageTop: Math.round(st.top), btnTops: [...document.querySelectorAll('#ring .rb')].map(b => Math.round(b.getBoundingClientRect().top)), tip: (() => { const t = document.querySelector('#ringTip'); if (t.hidden) return null; const r = t.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })() }; });
  out.topRing = top;
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + 'tg_ring_top.png' });
  out.allPads = await page.evaluate(async () => { const G = window.HOLDOR.G, R = window.HOLDOR_RING, st = document.querySelector('#stage').getBoundingClientRect(); const bad = []; let n = 0;
    for (const lv of [0, 4, 9, 13, 17, 20, 27, 33, 41, 49]) { window.HOLDOR.startGame({ mode: 'campaign', level: window.HOLDOR.LEVELS[lv] }); const g = window.HOLDOR.G; g.gold = 5000;
      for (const s of g.map.slots) { R.openRing(s); R.ringFrame(); await new Promise(r => setTimeout(r, 30)); n++;
        for (const b of document.querySelectorAll('#ring .rb')) { const q = b.getBoundingClientRect(); if (q.left < st.left - 1 || q.right > st.right + 1 || q.top < st.top - 1 || q.bottom + 14 > st.bottom + 1) { bad.push(lv + 1 + ':' + s.id); break; } } R.closeRing(); } }
    return { checked: n, bad }; });
  out.safe = { top: TOP + CTOP, bottom: VH - BOT };
  console.log(JSON.stringify(out, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
