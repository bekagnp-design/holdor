// A02 input: floating joystick (left half), camera look + pinch (right half), action buttons, keyboard, multi-touch,
// controls hidden while a screen is open. Playwright with real touches (CDP Input.dispatchTouchEvent for drags and two fingers).
// Landscape (2026-11-22): the app is laid out wide; the suite runs a landscape phone (844×390, no turn) and checks the controls' geometry at 740×360 and 640×360 too.
// Run: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_input.js   (HOLDOR_HTML overrides beta/index.html)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'); const HTML = path.resolve(ROOT, process.env.HOLDOR_HTML || 'beta/index.html');
const SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  // a running game: a saved hero with the tutorial finished, so no intro screen hides the controls
  const save = require('./lib').fakeSave({ house: 'stark', lvl: 3 }); save.acc.world.flags.tut = 8;
  await page.addInitScript(s => { try { if (!sessionStorage.getItem('t_input')) { sessionStorage.setItem('t_input', '1'); localStorage.setItem('holdor_rpg', JSON.stringify(s)); } } catch (e) {} }, save);
  await page.goto('file://' + HTML);
  await page.waitForFunction(() => window.R && R.input && R.input.el && R.step, null, { timeout: 60000 });
  await page.waitForFunction(() => R.running || (R.ui && R.ui.cur), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { if (R.ui.cur) R.ui.close(); R.stop && R.stop(); });
  await page.evaluate(() => { window.__btns = []; R.bus.on('btn', (n, src) => window.__btns.push(n + ':' + src)); });
  const cdp = await ctx.newCDPSession(page);
  // CDP touch: touchStart lists every active point (new ones press), touchMove lists all points, touchEnd lists the RELEASED points ([] = all).
  // Touchmoves after the first in a sequence reach the page asynchronously (next frame), so every call settles for two frames.
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 10)))));
  const touch = async (type, pts) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p.x, y: p.y, id: p.id, radiusX: 6, radiusY: 6, force: 1 })) }); await settle(); };
  const OUT = {}; let fails = 0; const ok = (k, v, info) => { OUT[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) fails++; };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const centre = id => ev(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, vis: r.width > 0 && getComputedStyle(document.getElementById(id)).display !== 'none' }; }, id);
  const snap = () => ev(() => ({ move: { x: +R.input.move.x.toFixed(3), y: +R.input.move.y.toFixed(3) }, active: R.input.active, look: { dx: (R.input.lastLook || R.input.look).dx, dy: (R.input.lastLook || R.input.look).dy }, pinch: +R.input.pinch.toFixed(3), atkDn: R.input.down('attack'), atkPr: R.input.pressed('attack'), btns: window.__btns.slice() }));
  const step = n => ev(n => { for (let i = 0; i < (n || 1); i++) R.step(); }, n);

  // 1. a touch drag on the left half drives the joystick
  await touch('touchStart', [{ x: 150, y: 250, id: 1 }]); await touch('touchMove', [{ x: 190, y: 250, id: 1 }]);
  let s = await snap(); const joyOn = await ev(() => document.getElementById('joy').classList.contains('on'));
  ok('joystick drag 40px right → move ≈ (0.65, 0)', s.active && joyOn && Math.abs(s.move.x - 30 / 46) < 0.03 && Math.abs(s.move.y) < 0.01, JSON.stringify(s.move));
  await touch('touchMove', [{ x: 154, y: 250, id: 1 }]); s = await snap();
  ok('inside the 10 px dead zone → move 0', s.active && s.move.x === 0 && s.move.y === 0, JSON.stringify(s.move));
  await touch('touchMove', [{ x: 150, y: 150, id: 1 }]); s = await snap();
  const base = await ev(() => document.getElementById('joy').style.transform);
  ok('beyond 56 px → unit vector up, the base follows', Math.abs(s.move.y + 1) < 0.01 && Math.abs(s.move.x) < 0.01 && /150(\.0)?px,\s*206(\.0)?px/.test(base), JSON.stringify(s.move) + ' ' + base);
  await touch('touchEnd', []); s = await snap();
  ok('release → move 0, not active', !s.active && s.move.x === 0 && s.move.y === 0, JSON.stringify(s));
  // 2. a tap on ATTACK: btn event + pressed() for exactly one step
  const A = await centre('b-attack'); ok('ATTACK is 84 px on the right', A.w === 84 && A.h === 84 && A.x > 844 / 2, JSON.stringify(A));
  await page.touchscreen.tap(A.x, A.y); s = await snap();
  ok('tap ATTACK → btn attack, pressed before the step', s.btns.includes('attack:btn') && s.atkPr && !s.atkDn, JSON.stringify({ pr: s.atkPr, dn: s.atkDn, btns: s.btns }));
  await step(1); s = await snap(); ok('pressed cleared after one step', !s.atkPr, '');
  // 3. two simultaneous touches: joystick held + attack held, then one released
  await ev(() => { window.__btns = []; });
  await touch('touchStart', [{ x: 150, y: 250, id: 1 }]); await touch('touchStart', [{ x: 150, y: 250, id: 1 }, { x: A.x, y: A.y, id: 2 }]);
  s = await snap(); ok('two fingers: joystick active + attack down', s.active && s.atkDn && s.atkPr && s.btns.includes('attack:btn'), JSON.stringify(s));
  await touch('touchMove', [{ x: 200, y: 250, id: 1 }, { x: A.x, y: A.y, id: 2 }]); s = await snap();
  ok('moving finger 1 while finger 2 holds attack', s.move.x > 0.8 && s.atkDn, JSON.stringify({ move: s.move, dn: s.atkDn }));
  await touch('touchEnd', [{ x: A.x, y: A.y, id: 2 }]); s = await snap();
  ok('finger 2 up → attack released, joystick still active', !s.atkDn && s.active && s.move.x > 0.8, JSON.stringify({ move: s.move, dn: s.atkDn, act: s.active }));
  await touch('touchEnd', []); s = await snap(); ok('finger 1 up → idle', !s.active && s.move.x === 0, '');
  // 4. a right-half drag that starts off the buttons rotates the camera (look), a two-finger pinch sets pinch
  await step(1); await touch('touchStart', [{ x: 500, y: 250, id: 3 }]); await touch('touchMove', [{ x: 530, y: 240, id: 3 }]); await touch('touchMove', [{ x: 545, y: 235, id: 3 }]);
  s = await snap(); ok('right-half drag does not start the joystick', !s.active && s.move.x === 0, '');
  await step(1); s = await snap(); ok('look = px since the last step (45, -15)', s.look.dx === 45 && s.look.dy === -15, JSON.stringify(s.look));
  await step(1); s = await snap(); ok('look resets to 0 on the next step', s.look.dx === 0 && s.look.dy === 0 && s.pinch === 1, JSON.stringify(s.look));
  await touch('touchEnd', []);
  await touch('touchStart', [{ x: 480, y: 250, id: 4 }]); await touch('touchStart', [{ x: 480, y: 250, id: 4 }, { x: 540, y: 250, id: 5 }]);
  await touch('touchMove', [{ x: 450, y: 250, id: 4 }, { x: 540, y: 250, id: 5 }]); await touch('touchMove', [{ x: 450, y: 250, id: 4 }, { x: 570, y: 250, id: 5 }]);
  await step(1); s = await snap(); ok('pinch 60 → 120 px → factor 2, no look', Math.abs(s.pinch - 2) < 0.01 && s.look.dx === 0, JSON.stringify({ pinch: s.pinch, look: s.look }));
  await touch('touchEnd', []); await step(1); s = await snap(); ok('pinch back to 1', s.pinch === 1, '');
  // 5. keyboard
  await ev(() => { window.__btns = []; });
  await page.keyboard.down('j'); s = await snap(); ok('key J → attack pressed + down + btn', s.atkPr && s.atkDn && s.btns.includes('attack:key'), JSON.stringify(s.btns));
  await step(1); s = await snap(); ok('key J held: pressed off, down on', !s.atkPr && s.atkDn, '');
  await page.keyboard.up('j'); s = await snap(); ok('key J up → down off', !s.atkDn, '');
  await page.keyboard.down('d'); await page.keyboard.down('w'); s = await snap();
  ok('W+D → move (0.707, -0.707)', Math.abs(s.move.x - 0.707) < 0.01 && Math.abs(s.move.y + 0.707) < 0.01, JSON.stringify(s.move));
  await page.keyboard.up('d'); await page.keyboard.up('w'); s = await snap(); ok('keys up → move 0', s.move.x === 0 && s.move.y === 0, '');
  await page.keyboard.down('e'); await step(1); s = await snap(); ok('E held → look.dx +6 per step', s.look.dx === 6, JSON.stringify(s.look));
  await page.keyboard.up('e'); await page.keyboard.down('q'); await step(1); s = await snap(); ok('Q held → look.dx -6', s.look.dx === -6, JSON.stringify(s.look)); await page.keyboard.up('q');
  await ev(() => { window.__btns = []; });
  for (const k of ['k', '1', '2', '3', 'r', 'f', 'Escape', 'm', 'i', 'l', 'c']) await page.keyboard.press(k);
  s = await snap(); const want = ['dodge', 'skill1', 'skill2', 'skill3', 'potion', 'interact', 'menu', 'map', 'inv', 'quests', 'chat'].map(x => x + ':key');
  ok('K 1 2 3 R F Esc M I L C → ' + want.map(x => x.split(':')[0]).join(' '), JSON.stringify(s.btns) === JSON.stringify(want), JSON.stringify(s.btns));
  await page.waitForTimeout(80); await ev(() => { for (let i = 0; i < 4 && R.ui.cur; i++) R.ui.close(); }); await step(1);
  // 6. typing in an input does not fire game keys
  await ev(() => { window.__btns = []; const i = document.createElement('input'); i.id = 'tin'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('j'); s = await snap(); ok('typing in an input: J ignored', !s.btns.length && !s.atkPr, JSON.stringify(s.btns));
  await ev(() => { document.getElementById('tin').remove(); });
  // 7. controls hide while a screen is open
  await ev(() => { window.__btns = []; R.screens.x = { open() {}, close() {} }; R.ui.open('x'); });
  const hid = await ev(() => getComputedStyle(document.getElementById('ctl')).display);
  await page.touchscreen.tap(A.x, A.y); s = await snap();
  ok('screen open → #ctl hidden, tap on ATTACK does nothing', hid === 'none' && !s.btns.length && !s.atkPr, hid + ' ' + JSON.stringify(s.btns));
  await touch('touchStart', [{ x: 150, y: 250, id: 6 }]); await touch('touchMove', [{ x: 200, y: 250, id: 6 }]); s = await snap(); await touch('touchEnd', []);
  ok('screen open → no joystick', !s.active && s.move.x === 0, '');
  await page.keyboard.press('j'); s = await snap(); ok('screen open → gameplay key J ignored', !s.atkPr && !s.btns.includes('attack:key'), JSON.stringify(s.btns));
  await page.keyboard.press('Escape'); s = await snap(); ok('screen open → Esc still emits menu', s.btns.includes('menu:key'), JSON.stringify(s.btns));
  await page.waitForTimeout(80); await ev(() => { for (let i = 0; i < 4 && R.ui.cur; i++) R.ui.close(); }); const shown = await ev(() => getComputedStyle(document.getElementById('ctl')).display);
  await ev(() => { window.__btns = []; }); await page.touchscreen.tap(A.x, A.y); s = await snap(); await step(1);
  ok('screen closed → controls back, ATTACK works', shown === 'block' && s.btns.includes('attack:btn'), shown + ' ' + JSON.stringify(s.btns));
  // 8. the contextual INTERACT pill
  await ev(() => { R.input.setInteract(null); });   // the hero may stand by an NPC in the real world: start from no prompt
  let v = await centre('b-interact'); ok('INTERACT hidden by default', !v.vis, '');
  await ev(() => { R.input.interact = { label: 'TALK' }; R.step(); }); v = await centre('b-interact');
  const lbl = await ev(() => document.querySelector('#b-interact .lb').textContent);
  ok('R.input.interact = {label} → pill shown after a step', v.vis && lbl === 'TALK' && v.h >= 44 && v.w >= 120 && v.x < 844 / 2, JSON.stringify(v) + ' ' + lbl);
  await ev(() => { window.__btns = []; }); await page.touchscreen.tap(v.x, v.y); s = await snap();
  ok('tap INTERACT → btn interact', s.btns.includes('interact:btn') && (await ev(() => R.input.pressed('interact'))), JSON.stringify(s.btns));
  await ev(() => { R.input.interact = null; R.step(); }); v = await centre('b-interact'); ok('interact = null → hidden', !v.vis, '');
  // 9. cooldown ring, potion badge, skill caption
  const cd = await ev(() => { R.input.setCooldown(0, 0.5); R.input.setPotions(2); R.input.setSkill(1, { label: 'Shield' }); const e = document.getElementById('b-sk1');
    return { cd: getComputedStyle(e).getPropertyValue('--cd').trim(), cls: e.classList.contains('cd'), badge: document.querySelector('#b-potion .badge').textContent, lb: document.querySelector('#b-sk2 .lb').textContent, keys: [...document.querySelectorAll('#ctl .sk .key')].map(k => k.textContent).join('') }; });
  ok('setCooldown(0,.5) → --cd .5 + class; setPotions(2) → badge 2; setSkill label', cd.cd === '0.500' && cd.cls && cd.badge === '2' && cd.lb === 'Shield' && cd.keys === '123', JSON.stringify(cd));
  await ev(() => { R.input.setCooldown(0, 0); R.input.setPotions(0); });
  const empty = await ev(() => ({ cd: document.getElementById('b-sk1').classList.contains('cd'), emp: document.getElementById('b-potion').classList.contains('empty') }));
  ok('cooldown 0 clears, potions 0 dims', !empty.cd && empty.emp, JSON.stringify(empty));
  // 10. every control ≥ 44 px, inside the (landscape) view, round buttons do not overlap, no control on another one (the top row, the INTERACT pill,
  // the chat button) or on the minimap, the top row at the top right left of the minimap, the INTERACT pill on the joystick half, the round cluster on the right half
  const ctlGeo = (W, H) => ev(([W, H]) => {
    const vis = el => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    const geo = [...document.querySelectorAll('#ctl button')].filter(vis).map(b => { const r = b.getBoundingClientRect(); return { id: b.id, x: r.left, y: r.top, w: r.width, h: r.height }; });
    const small = geo.filter(g => g.w < 44 || g.h < 44), out = geo.filter(g => g.x < 0 || g.y < 0 || g.x + g.w > W + .5 || g.y + g.h > H + .5);
    const round = geo.filter(g => /b-(attack|dodge|sk|potion)/.test(g.id)), over = [];
    for (let i = 0; i < round.length; i++) for (let j = i + 1; j < round.length; j++) { const a = round[i], b = round[j]; const d = Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2); if (d < a.w / 2 + b.w / 2 + 2) over.push(a.id + '/' + b.id + ':' + d.toFixed(0)); }
    const boxes = geo.slice(); for (const id of ['prChat', 'minimap']) { const el = document.getElementById(id); if (vis(el)) { const r = el.getBoundingClientRect(); boxes.push({ id, x: r.left, y: r.top, w: r.width, h: r.height }); } }
    // round on round (the cluster vs the round minimap): circle distance; anything else: rectangles
    const isRound = id => /b-(attack|dodge|sk|potion)|minimap/.test(id);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (/b-(attack|dodge|sk|potion)/.test(a.id) && /b-(attack|dodge|sk|potion)/.test(b.id)) continue;
      if (isRound(a.id) && isRound(b.id)) { const d = Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2); if (d < a.w / 2 + b.w / 2) over.push(a.id + '/' + b.id + ' centres ' + d.toFixed(1) + ' < radii ' + (a.w / 2 + b.w / 2)); continue; }
      if (a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1) over.push(a.id + '/' + b.id); }
    const top = geo.filter(g => /b-(map|inv|menu)/.test(g.id)), mm = boxes.find(b => b.id === 'minimap'), pill = geo.find(g => g.id === 'b-interact');
    const r = n => Math.round(n), fmt = a => a.map(g => g.id + '@' + r(g.x) + ',' + r(g.y) + ' ' + r(g.w) + '×' + r(g.h));
    return { n: geo.length, small: fmt(small), out: fmt(out), over, top: top.length === 3 && top.every(t => t.y < 80 && t.x > W / 2 && (!mm || t.x + t.w <= mm.x)), right: round.length === 6 && round.every(g => g.x > W / 2),
      pill: !pill || pill.x + pill.w <= W / 2 + .5, sizes: geo.filter(g => /b-(sk1|dodge|potion|attack)/.test(g.id)).map(g => g.id + ':' + r(g.w)).join(' '), rv: R.vw + '×' + R.vh + (R.rot ? ' rot' : '') }; }, [W, H]);
  const g0 = await ctlGeo(844, 390);
  ok('844×390: all ' + g0.n + ' controls ≥ 44 px, on screen, no overlap; top row top right, left of the minimap; buttons on the right half, INTERACT on the left', !g0.small.length && !g0.out.length && !g0.over.length && g0.top && g0.right && g0.pill && g0.rv === '844×390', JSON.stringify(g0));
  ok('skill buttons 60, dodge 56, potion 52, attack 84', g0.sizes === 'b-sk1:60 b-potion:52 b-dodge:56 b-attack:84', g0.sizes);
  // 11. haptics go to Telegram only when opts.haptic is on
  const hap = await ev(() => { window.__hap = []; window.Telegram = { WebApp: { HapticFeedback: { impactOccurred: k => window.__hap.push('i:' + k), notificationOccurred: k => window.__hap.push('n:' + k), selectionChanged: () => window.__hap.push('s') } } };
    R.state = R.newState ? R.newState() : { opts: { haptic: 1 } }; const a = R.haptic('medium'); R.state.opts.haptic = 0; const b = R.haptic('heavy'); R.state.opts.haptic = 1; return { a, b, log: window.__hap }; });
  ok('R.haptic: medium sent, blocked when opts.haptic = 0', hap.a === true && hap.b === false && hap.log.join() === 'i:medium', JSON.stringify(hap));
  // 12. the top-right row emits map / inv / menu
  await ev(() => { window.__btns = []; }); for (const id of ['b-map', 'b-inv', 'b-menu']) { await ev(() => { if (R.ui.cur) R.ui.close(); }); const c = await centre(id); await page.touchscreen.tap(c.x, c.y); await page.waitForTimeout(60); }
  await ev(() => { if (R.ui.cur) R.ui.close(); });
  s = await snap(); ok('top row taps → map inv menu', JSON.stringify(s.btns) === JSON.stringify(['map:btn', 'inv:btn', 'menu:btn']), JSON.stringify(s.btns));
  // the screen a top-row button opens is under the finger: the tap's own click (touch) and the mouse's click must not close it again
  for (const how of ['tap', 'mouse']) { await ev(() => { for (let i = 0; i < 3 && R.ui.cur; i++) R.ui.close(); }); await page.waitForTimeout(700); const c = await centre('b-menu');
    if (how === 'tap') await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(350); const cur = await ev(() => R.ui.cur); ok('menu by ' + how + ' stays open (no ghost click on its ✕)', cur === 'menu', String(cur)); }
  await ev(() => { for (let i = 0; i < 3 && R.ui.cur; i++) R.ui.close(); });
  // screenshot with the joystick held and a cooldown running
  await ev(() => { R.input.setCooldown(2, 0.6); R.input.setPotions(3); R.input.setSkill(0, { label: 'Slash' }); R.input.setSkill(1, { label: 'Shield' }); R.input.setSkill(2, { label: 'Rally' }); R.input.interact = { label: 'TALK' }; R.step(); });
  await touch('touchStart', [{ x: 150, y: 260, id: 9 }]); await touch('touchMove', [{ x: 180, y: 240, id: 9 }]); await page.waitForTimeout(80);
  await page.screenshot({ path: SC + 'rpg_input.png' }); await touch('touchEnd', []);
  // 13. small landscape phones: the same geometry at 740×360 and 640×360 (the INTERACT pill shown), and a joystick drag still maps to move
  for (const [W, H] of [[740, 360], [640, 360]]) {
    await page.setViewportSize({ width: W, height: H }); await page.waitForFunction(([W, H]) => R.vw === W && R.vh === H, [W, H], { timeout: 3000 }).catch(() => {});
    await ev(() => { R.input.interact = { label: 'TALK' }; R.step(); }); await page.waitForTimeout(100);
    const g = await ctlGeo(W, H);
    ok(W + '×' + H + ': all ' + g.n + ' controls ≥ 44 px, on screen, no overlap; top row left of the minimap; buttons right, INTERACT left', !g.small.length && !g.out.length && !g.over.length && g.top && g.right && g.pill && g.rv === W + '×' + H, JSON.stringify(g));
    await touch('touchStart', [{ x: 120, y: 200, id: 11 }]); await touch('touchMove', [{ x: 160, y: 200, id: 11 }]); s = await snap(); await touch('touchEnd', []); await step(1);
    ok(W + '×' + H + ': joystick drag 40 px right → move ≈ (0.65, 0)', s.active && Math.abs(s.move.x - 30 / 46) < 0.03 && Math.abs(s.move.y) < 0.01, JSON.stringify(s.move));
    await page.screenshot({ path: SC + 'rpg_input_' + W + '.png' });
  }
  ok('no page errors', !errors.length, errors.join(' || '));
  for (const k in OUT) console.log(OUT[k].startsWith('OK') ? 'OK  ' : 'FAIL', k, OUT[k].replace(/^(OK|FAIL)\s?/, ''));
  console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
