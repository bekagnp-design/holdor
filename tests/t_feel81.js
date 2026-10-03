// v1.0.81: feel — Telegram haptics follow the sounds (a tap, a claim, a refusal, the door), are throttled, and stay off when muted;
// a big kill (a giant, a lieutenant, the Night King) stops the frame a moment, shakes and flashes; the battle's numbers are unchanged.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.addInitScript(() => { window.__h = []; window.Telegram = { WebApp: { platform: 'android', version: '8.0', initData: '', initDataUnsafe: {}, ready() {}, expand() {}, onEvent() {}, isVersionAtLeast() { return true; },
    requestFullscreen() {}, disableVerticalSwipes() {}, lockOrientation() {}, setHeaderColor() {}, setBackgroundColor() {},
    HapticFeedback: { impactOccurred(s) { window.__h.push('i:' + s); }, notificationOccurred(s) { window.__h.push('n:' + s); }, selectionChanged() {} } } }; });
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FEEL, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const h = await page.evaluate(async () => { const S = window.HOLDOR.SFX; S.muted = false; window.__h = []; const w = ms => new Promise(r => setTimeout(r, ms));
    S.play('tap'); await w(80); S.play('collect'); await w(80); S.play('deny'); await w(80); S.play('gate'); S.play('gate'); await w(80); S.play('king'); await w(80);
    const a = window.__h.slice(); window.__h = []; S.play('tap'); S.play('tap'); const b = window.__h.slice(); window.__h = []; S.muted = true; await w(80); S.play('collect'); const c = window.__h.slice(); S.muted = false; return { a, b, c }; });
  ok('haptics follow the sounds: tap light, claim success, refusal error, door medium (once), Night King heavy', JSON.stringify(h.a) === JSON.stringify(['i:light', 'n:success', 'n:error', 'i:medium', 'i:heavy']), JSON.stringify(h.a));
  ok('two at once are one buzz; muted means none', h.b.length === 1 && h.c.length === 0, JSON.stringify([h.b, h.c]));
  const k = await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; H.setAcc(a); H.startGame({ level: H.stageLevel(10) }); const G = H.G; G.hitStop = 0; G.shake = 0;
    window.HOLDOR_FEEL.feelKill({ type: 'axe' }, { x: 100, y: 100 }); const small = [G.hitStop, G.shake];
    window.HOLDOR_FEEL.feelKill({ type: 'giant', giant: true }, { x: 100, y: 100 }); const big = [G.hitStop, G.shake, G.fx.filter(f => f.t === 'flash').length];
    return { small, big }; });
  ok('a common kill changes nothing; a giant: a hit-stop, a shake and a flash', k.small[0] === 0 && k.small[1] === 0 && k.big[0] > 0 && k.big[1] > 0 && k.big[2] === 1, JSON.stringify(k));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
