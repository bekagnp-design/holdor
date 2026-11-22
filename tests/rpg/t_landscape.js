// tests/rpg/t_landscape.js — the game is wide (test 5, MR B: "a horizontal game").
// A phone held upright (390×844) gets #app turned 90° clockwise: R.rot, R.vw 844 × R.vh 390, --vw / --vh = 1 % of the app,
// real taps and real joystick / look drags land where the turned picture shows them; the same gestures in app space do the same
// thing on a phone held sideways (844×390, no turn). A focused text field keeps the layout when a keyboard shrinks the window.
'use strict';
const L = require('./lib');

(async () => {
  L.build();
  const save = L.fakeSave ? L.fakeSave({ house: 'stark', cls: 'knight', lvl: 3 }) : undefined;
  const run = async (w, h) => {
    const H = await L.launch({ w, h }); const page = H.page;
    await L.boot(page, { save, timeout: 60000 });
    await page.evaluate(() => { if (R.ui.cur) R.ui.close(); if (!R.running && R.enterWorld) R.enterWorld(); for (let i = 0; i < 30; i++) R.step(); });
    return H;
  };
  // app point → the viewport point that shows it
  const scr = (rot, W, x, y) => rot ? { x: W - y, y: x } : { x, y };
  const gestures = async (page, rot, W) => {
    const out = {};
    // joystick: a thumb at app (200, 280) drags 80 px to the app's right
    const a = scr(rot, W, 200, 280), b = scr(rot, W, 280, 280);
    await L.rawTouch(page, 'touchStart', [{ x: a.x, y: a.y, radiusX: 10, radiusY: 10, force: 1, id: 1 }]);
    for (let i = 1; i <= 5; i++) await L.rawTouch(page, 'touchMove', [{ x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5, radiusX: 10, radiusY: 10, force: 1, id: 1 }]);
    await page.waitForTimeout(80);
    out.move = await page.evaluate(() => ({ x: +R.input.move.x.toFixed(2), y: +R.input.move.y.toFixed(2) }));
    await L.rawTouch(page, 'touchEnd', []); await page.waitForTimeout(60);
    // look: a finger at app (640, 200) drags 100 px to the app's right
    const c = scr(rot, W, 640, 200), d = scr(rot, W, 740, 200);
    const yaw0 = await page.evaluate(() => R.cam.yaw);
    await L.rawTouch(page, 'touchStart', [{ x: c.x, y: c.y, radiusX: 10, radiusY: 10, force: 1, id: 2 }]);
    for (let i = 1; i <= 5; i++) await L.rawTouch(page, 'touchMove', [{ x: c.x + (d.x - c.x) * i / 5, y: c.y + (d.y - c.y) * i / 5, radiusX: 10, radiusY: 10, force: 1, id: 2 }]);
    await page.waitForTimeout(400); out.look = await page.evaluate(y0 => { for (let i = 0; i < 10; i++) R.step(); return { dyaw: +(R.cam.yaw - y0).toFixed(3) }; }, yaw0);
    await L.rawTouch(page, 'touchEnd', []); await page.waitForTimeout(60);
    // a real tap on the Bag button opens the bag
    const bag = await page.evaluate(() => { const b = R.input.btn && R.input.btn('inv'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (bag) { await page.touchscreen.tap(bag.x, bag.y); await page.waitForTimeout(250); }
    out.bag = await page.evaluate(() => R.ui.cur); await page.evaluate(() => R.ui.close());
    return out;
  };

  /* 1. upright phone: the app turns */
  let H = await run(390, 844), page = H.page;
  const s = await page.evaluate(() => { const app = document.getElementById('app'), cs = getComputedStyle(document.documentElement);
    return { rot: R.rot, vw: R.vw, vh: R.vh, tf: app.style.transform, w: app.style.width, h: app.style.height, cvw: cs.getPropertyValue('--vw').trim(), cvh: cs.getPropertyValue('--vh').trim(),
      cls: document.documentElement.className, pt: R.pt(380, 20), err: getComputedStyle(document.getElementById('err')).display }; });
  L.ok('upright phone: the app turns 90° and lays out 844 × 390', s.rot === true && s.vw === 844 && s.vh === 390 && /rotate\(90deg\)/.test(s.tf) && s.w === '844px' && s.h === '390px', s);
  L.ok('--vw / --vh are 1 % of the turned app; q-wide / q-s / q-h700 classes on <html>', s.cvw === '8.44px' && s.cvh === '3.9px' && /q-wide/.test(s.cls) && /q-s\b/.test(s.cls) && /q-h700/.test(s.cls), s);
  L.ok('R.pt maps a viewport point to the app (380, 20) → (20, 10)', s.pt.x === 20 && s.pt.y === 10, s.pt);
  const gRot = await gestures(page, true, 390);
  L.ok('upright: a real joystick drag to the app\'s right moves right', gRot.move.x > 0.5 && Math.abs(gRot.move.y) < 0.2, JSON.stringify(gRot.move));
  L.ok('upright: a real look drag to the app\'s right turns the camera', Math.abs(gRot.look.dyaw) > 0.2, gRot.look);
  L.ok('upright: a real tap on Bag opens the bag', gRot.bag === 'inv', gRot.bag);
  // a soft keyboard: a focused text field keeps the turn and the size
  const kb = await page.evaluate(() => { const i = document.createElement('input'); i.id = 't-kb'; document.getElementById('ui').appendChild(i); i.focus(); return true; });
  await page.setViewportSize({ width: 390, height: 520 }); await page.waitForTimeout(250);
  const k = await page.evaluate(() => { const r = { rot: R.rot, vw: R.vw, vh: R.vh }; const i = document.getElementById('t-kb'); i.blur(); i.remove(); return r; });
  L.ok('a focused text field keeps the layout while the window shrinks', kb && k.rot === true && k.vw === 844 && k.vh === 390, k);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
  // the phone is turned sideways: the app stops turning
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300);
  const t = await page.evaluate(() => ({ rot: R.rot, vw: R.vw, vh: R.vh, tf: document.getElementById('app').style.transform }));
  L.ok('turning the phone sideways: no turn, still 844 × 390', t.rot === false && t.vw === 844 && t.vh === 390 && !t.tf, t);
  const e1 = H.errors.slice(); await H.close();

  /* 2. sideways phone: the same app-space gestures do the same */
  H = await run(844, 390); page = H.page;
  const gL = await gestures(page, false, 844);
  L.ok('sideways phone: the same gestures move right, turn the camera the same way, open the bag', gL.move.x > 0.5 && Math.abs(gL.look.dyaw) > 0.2 && Math.sign(gL.look.dyaw) === Math.sign(gRot.look.dyaw) && gL.bag === 'inv', JSON.stringify({ gL, gRot }));
  const e2 = H.errors.slice(); const errShown = await page.evaluate(() => getComputedStyle(document.getElementById('err')).display);
  L.ok('no page errors, #err hidden', !e1.length && !e2.length && s.err === 'none' && errShown === 'none', { e1, e2 });
  await H.close();
  L.report();
})().catch(e => { console.error(e); process.exit(1); });
