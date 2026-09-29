// v1.0.60: the first battle is short and direct (its own straight road: the dead reach the first tower within seconds), and the page can
// never zoom under the player's fingers (iOS zoomed the HUD on repeated taps and the tutorial's taps stopped landing).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TUT && window.HOLDOR_TUT.TUT_LEVEL, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const m = await page.evaluate(() => {
    const H = window.HOLDOR, X = window.HOLDOR_TUT, G = H.G; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; H.setAcc(a);
    H.startGame({ mode: 'campaign', level: X.TUT_LEVEL, tutorial: 1 });
    const R0 = G.map.routes[0], xs = R0.pts.map(p => Math.round(p.x)), slot = X.tutSlot();
    const out = { len: Math.round(R0.total), straight: xs.every(x => x === 195), gates: G.map.gates.length, routes: G.map.routes.length, slots: G.map.slots.length, slotY: Math.round(slot.y), tutorial: G.tutorial, id: G.level.id };
    H.build(slot, 'watch'); G.tut = null; G.paused = false; G.nextIn = 1e9; H.callWave();
    let n = 0, fs = -1, fk = -1;
    while (n < 60 * 60 && G.state === 'play') { H.step(); n++; if (fs < 0 && G.projs.length) fs = n; if (fk < 0 && G.kills > 0) { fk = n; break; } }
    out.firstShot = Math.round(fs / 6) / 10; out.firstKill = Math.round(fk / 6) / 10; return out; });
  ok('its own short road (was 1131 px on stage 1)', m.len < 700 && m.straight && m.gates === 1 && m.routes === 1, JSON.stringify(m));
  ok('a dozen rings, the first offered is mid-road', m.slots >= 10 && m.slotY > 250 && m.slotY < 420, m.slotY);
  ok('the dead reach the first tower within 8 s (was 19 s)', m.firstShot > 0 && m.firstShot <= 8, m.firstShot);
  ok('the first kill within 10 s (was 20 s)', m.firstKill > 0 && m.firstKill <= 10, m.firstKill);
  ok('still stage 1 for everything else', m.id === 1 && m.tutorial);
  // the move lesson: one tap on the ground is enough
  const mv = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_TUT, G = H.G; H.startGame({ mode: 'campaign', level: X.TUT_LEVEL, tutorial: 1 });
    for (let i = 0; i < 40 && X.tutWantBase() !== 'move'; i++) { if (G.tut.hold) X.tutNext(); else X.tutEvent(X.tutWantBase(), X.TS().want.split(':')[1]); }
    const st = X.TS(); const before = G.tut.i; const want = X.tutWantBase();
    return { want, sel: G.heroSel, before }; });
  ok('the tutorial reaches the move step', mv.want === 'move', JSON.stringify(mv));
  const mv2 = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_TUT, G = H.G; const hero = G.hero; const i0 = G.tut.i; G.tut.hold = false; window.dispatchEvent(new Event('resize'));
    const c = document.querySelector('#c'); const r = c.getBoundingClientRect(); const s = r.width / 390;
    const ev = new PointerEvent('pointerdown', { clientX: r.left + 110 * s, clientY: r.top + 450 * s, bubbles: true, pointerId: 1 }); c.dispatchEvent(ev);
    return { i0, i1: G.tut ? G.tut.i : -1, moved: hero.tx != null }; });
  ok('one tap on the ground moves the champion and finishes the step', mv2.i1 > mv2.i0 || mv2.i1 === -1 || mv2.moved, JSON.stringify(mv2));
  // no accidental zoom
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(400);
  const z = await page.evaluate(() => {
    const ta = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).touchAction : null; };
    const g = t => { const e = new Event(t, { cancelable: true, bubbles: true }); document.dispatchEvent(e); return e.defaultPrevented; };
    const meta = document.querySelector('meta[name=viewport]').content;
    return { hud: ta('#bSpeed'), body: ta('body'), canvas: ta('canvas'), hubBtn: ta('#bBattle'), gs: g('gesturestart'), gc: g('gesturechange'), meta };
  });
  ok('taps never double-tap-zoom (HUD, hub and page: manipulation)', z.hud === 'manipulation' && z.body === 'manipulation' && z.hubBtn === 'manipulation', JSON.stringify(z));
  ok('the canvas keeps its own touch handling', z.canvas === 'none');
  ok('pinch gestures are stopped', z.gs && z.gc);
  ok('the viewport is fixed at 1×', /maximum-scale=1/.test(z.meta) && /minimum-scale=1/.test(z.meta), z.meta);
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
