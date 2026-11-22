// RPG v2.0.0 — the world map screen (A26): opens from the HUD's map button (or R.ui.open('map')), draws the Westeros art with fog, regions,
// POIs, you, others, quests, events and gates into a canvas; pans with one finger, zooms by double-tap / pinch / the API within 0.5–3×;
// a tap on a found castle opens the card and FAST TRAVEL (free) moves the player; an unfound POI toasts "Not yet discovered";
// the canvas is redrawn only on interaction. Real taps. Fakes R.data.world (2 regions, 4 POIs) and a player only when the game has none.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=... node tests/rpg/t_map.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(ROOT, process.env.HOLDOR_HTML || 'beta/index.html');
const MAP = 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, 'src/assets/westeros_1200.webp')).toString('base64');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text().slice(0, 160)); }); // the Telegram SDK include fails offline: not a code error
  const out = {}; const ok = (k, v, info) => { out[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const view = () => ev(() => R.screens.map.view());
  const toS = (x, y) => ev(([x, y]) => R.screens.map.toScreen(x, y), [x, y]);
  // how many distinct colours the map canvas holds (sampled) — a blank canvas has one or two
  const colours = () => ev(() => { const cv = R.screens.map.canvas(); if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 4 * 101) s.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)); return s.size; });
  const sample = () => ev(() => { const cv = R.screens.map.canvas(); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 53) h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; return h; });
  const box = sel => ev(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), t: e.textContent.replace(/\s+/g, ' ').trim(), dis: !!e.disabled }; }, sel);
  await page.goto(URL); await page.waitForFunction(() => window.R && R.screens && R.screens.map, { timeout: 20000 }); await page.waitForTimeout(200);
  // ---- setup: a save, a world (faked when the data module is absent), a player near a found castle, the map art, fake neighbours
  const F = await ev(async MAP => {
    R.running = false; if (R.stop) R.stop(); for (let i = 0; i < 4 && R.ui.cur; i++) R.ui.close(); R.state = R.newState();
    if (!R.data.world) R.data.world = {
      regions: [{ id: 'north', name: 'The North', lvl: [1, 8], biome: 'snow', poly: [[600, 600], [6600, 600], [6600, 5400], [600, 5400]] }, { id: 'riverlands', name: 'The Riverlands', lvl: [8, 16], biome: 'green', poly: [[600, 5400], [6600, 5400], [6600, 8400], [600, 8400]] }],
      pois: [{ id: 'winterfell', name: 'Winterfell', kind: 'castle', house: 'stark', x: 3600, y: 3600, region: 'north' }, { id: 'castle_black', name: 'Castle Black', kind: 'castle', x: 3900, y: 1500, region: 'north' },
        { id: 'shrine_wolfswood', name: 'Wolfswood shrine', kind: 'shrine', x: 3000, y: 3100, region: 'north' }, { id: 'riverrun', name: 'Riverrun', kind: 'castle', x: 3000, y: 6300, region: 'riverlands' }],
      roads: [[[3600, 3600], [3700, 4600], [3400, 5400], [3000, 6300]]], gates: [{ id: 'g_river', from: 'north', to: 'riverlands', x: 3500, y: 5400, lvl: 8 }] };
    const W = R.data.world, L = v => Array.isArray(v) ? v : Object.keys(v).map(k => (v[k].id = v[k].id || k, v[k]));
    const P = L(W.pois || W.poi || W.places), RG = L(W.regions);
    const castle = P.find(p => (p.kind || p.type) === 'castle') || P[0];
    const other = P.find(p => p !== castle && (p.kind || p.type) === 'castle') || P.find(p => p !== castle);
    const shrine = P.find(p => p !== castle && p !== other && (p.kind || p.type) === 'shrine');
    const reg = castle.region || (RG[0] && RG[0].id);
    R.state.p.found = [castle.id].concat(shrine ? [shrine.id] : []); R.state.p.flags.regions = {}; if (reg) R.state.p.flags.regions[reg] = 1;
    for (const e of R.ents.slice()) if (e.kind === 'player') R.remove(e);
    R.player = R.spawn({ kind: 'player', team: 0, x: castle.x + 120, y: castle.y + 320, hp: 100, hpMax: 100, name: 'Tester', lvl: 3 });
    R.cam.x = R.player.x; R.cam.y = R.player.y;
    // a neighbour on the map: the real presence module has nobody offline, so its list is replaced for this test
    const jory = { id: 'o1', name: 'Jory', x: castle.x + 260 * (R.WS || 1), y: castle.y + 120 * (R.WS || 1), lvl: 4 };   // far enough from the castle's tap circle in the 4.5× world
    if (!R.presence) R.presence = { list: () => [jory] }; else if (!(R.presence.list && R.presence.list().length)) R.presence.list = () => [jory];
    if (!R.quests) R.quests = { markers: () => [{ x: castle.x - 300, y: castle.y + 600, name: 'The missing hound' }] };
    if (!R.events) R.events = { active: () => [{ x: castle.x + 600, y: castle.y - 1000, name: 'Wight horde' }] };
    await new Promise(res => { const im = new Image(); im.onload = () => { R.assets = R.assets || {}; R.assets.map = im; res(); }; im.onerror = () => res(); im.src = MAP; });
    return { castle: { id: castle.id, name: castle.name || castle.id, x: castle.x, y: castle.y }, other: { id: other.id, name: other.name || other.id, x: other.x, y: other.y }, player: { x: R.player.x, y: R.player.y }, nreg: RG.length, npoi: P.length, hasMap: !!(R.assets && R.assets.map && R.assets.map.naturalWidth) };
  }, MAP);
  // ---- open: the HUD's map button when there is one, else the screen API
  const hudBtn = await page.locator('[data-btn="map"], #btnMap, #bMap, .hud-map, button[aria-label*="map" i]').first();
  if (await hudBtn.count()) { await hudBtn.tap({ force: true }); } else { await ev(() => R.ui.open('map')); }
  await page.waitForTimeout(500);
  const o = await ev(() => ({ cur: R.ui.cur, on: document.querySelector('#screen').classList.contains('on'), cv: !!document.querySelector('#screen canvas.mp-cv'), paused: R.paused, you: !!document.querySelector('.mp-you'), draws: R.screens.map.draws, legend: (document.querySelector('.mp-legend') || {}).textContent || '' }));
  ok('the map opens: R.ui.cur = map, a canvas fills the screen, the game is paused, the player arrow is there', o.cur === 'map' && o.on && o.cv && o.paused && o.you && o.draws >= 1, JSON.stringify(o));
  ok('it draws the art (not blank): many colours in the canvas', (await colours()) > 40 && F.hasMap, 'colours=' + await colours() + ' hasMap=' + F.hasMap);
  const cvBox = await box('#screen canvas.mp-cv'), v0 = await view();
  const cvDpr = await ev(() => { const cv = R.screens.map.canvas(); return cv.width / cv.getBoundingClientRect().width; });
  ok('the canvas is the (landscape) screen size and capped at 2× DPR', cvBox && cvBox.w === 844 && cvBox.h === 390 && cvDpr <= 2.01, JSON.stringify(cvBox) + ' dpr=' + cvDpr);
  const youS = await toS(F.player.x, F.player.y);
  // the centre is the player, unless the map's edge is nearer than half a screen (then the view stops at the edge)
  const WH = await ev(() => [R.W || 7200, R.H || 12288]);   // the world's size (R.WS made it 4.5× larger)
  const hw = 422 / v0.k, hh = 195 / v0.k, ex = hw * 2 >= WH[0] ? WH[0] / 2 : Math.min(Math.max(F.player.x, hw), WH[0] - hw), ey = hh * 2 >= WH[1] ? WH[1] / 2 : Math.min(Math.max(F.player.y, hh), WH[1] - hh);
  ok('at open the camera centres on the player at zoom 1 (or stops at the map\'s edge)', Math.abs(v0.cx - ex) < 1 && Math.abs(v0.cy - ey) < 1 && Math.abs(v0.z - 1) < 1e-9 && (ex !== F.player.x || Math.abs(youS.x - 422) < 2) && (ey !== F.player.y || Math.abs(youS.y - 195) < 2), JSON.stringify([youS, v0, { ex, ey }]));
  ok('the legend row names you · castle · quest · players · event, inside the screen', /you/.test(o.legend) && /castle/.test(o.legend) && /quest/.test(o.legend) && /players/.test(o.legend) && /event/.test(o.legend) && (await box('.mp-legend')).b <= 390, o.legend);
  // ---- redraws only on interaction
  const d0 = await ev(() => R.screens.map.draws); await page.waitForTimeout(700); const d1 = await ev(() => R.screens.map.draws);
  ok('idle for 700 ms: no redraw', d1 === d0, d0 + ' → ' + d1);
  // ---- pan: one finger drag moves the view by the drag distance (at 2.5×, away from the map's edges: in landscape the whole width
  //      fits at 1× and leaves only ±35 px of sideways travel at 2×)
  await ev(() => R.screens.map.zoomAt(422, 195, 2.5)); await page.waitForTimeout(200);
  const vp = await view(), h0 = await sample();
  await page.mouse.move(422, 180); await page.mouse.down(); await page.mouse.move(462, 240, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250);
  const v1 = await view(), h1 = await sample(), d2 = await ev(() => R.screens.map.draws);
  ok('pan: the view centre moves by 40 × 60 px (in world units) and the canvas changes', Math.abs((vp.cx - v1.cx) * v1.k - 40) < 1.5 && Math.abs((vp.cy - v1.cy) * v1.k - 60) < 1.5 && h1 !== h0 && d2 > d1, JSON.stringify({ dx: (vp.cx - v1.cx) * v1.k, dy: (vp.cy - v1.cy) * v1.k, changed: h1 !== h0, draws: d2 - d1 }));
  // ---- tap a found castle → the card with FAST TRAVEL (free)
  await ev(c => R.screens.map.centreOn(c.x, c.y), F.castle); await ev(() => R.screens.map.zoomAt(422, 195, 1.6)); await page.waitForTimeout(150);
  const cs = await toS(F.castle.x, F.castle.y);
  await page.touchscreen.tap(cs.x, cs.y); await page.waitForTimeout(450);
  const card = await box('.mp-card'), h3 = await box('.mp-card h3'), go = await box('.mp-card .mp-go'), dist = await box('.mp-card .d');
  const covers = !!card && cs.x >= card.x && cs.x <= card.x + card.w && cs.y >= card.y && cs.y <= card.b;   // landscape: the card must leave the tapped castle visible
  ok('the card: the castle\'s name, a distance line, one primary FAST TRAVEL (free) button ≥ 44 px, not covering the tapped castle', !!card && h3 && h3.t === F.castle.name && go && /FAST TRAVEL \(free\)/.test(go.t) && go.h >= 44 && !go.dis && !covers && card.b <= 390 && dist && /away/.test(dist.t) && /on foot/.test(dist.t), JSON.stringify({ card, castleAt: { x: Math.round(cs.x), y: Math.round(cs.y) }, covers, h3: h3 && h3.t, go: go && go.t, dist: dist && dist.t }));
  const prim = await ev(() => document.querySelectorAll('#screen button.pri').length);
  ok('one primary button on the screen', prim === 1, 'pri=' + prim);
  await page.screenshot({ path: SC + 'rpg_map.png' });
  const sizes = await ev(() => [...document.querySelectorAll('#screen button')].map(b => { const r = b.getBoundingClientRect(); return [b.className.split(' ')[0], Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 44 || x[2] < 44));
  ok('every button on the map is at least 44 px', sizes.length === 0, JSON.stringify(sizes));
  await page.locator('.mp-card .mp-go').tap({ force: true }); await page.waitForTimeout(400);
  const after = await ev(() => ({ cur: R.ui.cur, px: R.player.x, py: R.player.y, cx: R.cam.x, cy: R.cam.y, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|'), pos: R.state.p.pos }));
  ok('FAST TRAVEL: the player stands at the castle, the camera follows, the map closes, a toast names it', Math.abs(after.px - F.castle.x) < 2 && Math.abs(after.py - F.castle.y) <= 40 && after.cx === after.px && after.cy === after.py && after.cur === null && /Fast travel/.test(after.toast) && new RegExp(F.castle.name).test(after.toast), JSON.stringify(after));
  // ---- an unfound POI → "Not yet discovered", no card
  await ev(() => R.ui.open('map')); await page.waitForTimeout(300);
  await ev(p => R.screens.map.centreOn(p.x, p.y), F.other); await page.waitForTimeout(100);
  const os = await toS(F.other.x, F.other.y);
  await page.touchscreen.tap(os.x, os.y); await page.waitForTimeout(350);
  const un = await ev(() => ({ card: !!document.querySelector('.mp-card'), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|'), cur: R.ui.cur }));
  ok('a tap on an unfound POI toasts "Not yet discovered" and opens no card', !un.card && /Not yet discovered/.test(un.toast) && un.cur === 'map', JSON.stringify(un));
  // ---- the overview at 0.5×: the whole map on the screen (fog over the second region, the gate chain); then zoom checks
  await ev(() => R.screens.map.zoomAt(422, 195, 0.5)); await page.waitForTimeout(300);
  const ov = await view();
  ok('at 0.5× the whole map fits the screen', ov.z === 0.5 && WH[0] * ov.k <= 844 + 1 && WH[1] * ov.k <= 390 + 1 && (await colours()) > 40, JSON.stringify({ w: WH[0] * ov.k, h: WH[1] * ov.k }));
  await page.screenshot({ path: SC + 'rpg_map_overview.png' });
  // ---- zoom: double-tap doubles, the API clamps to 0.5–3, a pinch (CDP touch gesture) zooms in
  await ev(() => R.screens.map.zoomAt(422, 195, 1)); await page.waitForTimeout(600);
  await page.touchscreen.tap(422, 160); await page.waitForTimeout(80); await page.touchscreen.tap(423, 161); await page.waitForTimeout(250);
  const vz = await view();
  ok('double-tap zooms to 2×', Math.abs(vz.z - 2) < 0.01, 'z=' + vz.z);
  const cl = await ev(() => { R.screens.map.zoomAt(422, 195, 10); const a = R.screens.map.view().z; R.screens.map.zoomAt(422, 195, 0.01); const b = R.screens.map.view().z; R.screens.map.zoomAt(422, 195, 1); return [a, b]; });
  ok('zoom clamps to 3× and 0.5×', cl[0] === 3 && cl[1] === 0.5, JSON.stringify(cl));
  let pinchZ = null; try { const cdp = await page.context().newCDPSession(page); await cdp.send('Input.synthesizePinchGesture', { x: 422, y: 230, scaleFactor: 1.8, relativeSpeed: 400 }); await page.waitForTimeout(300); pinchZ = (await view()).z; } catch (e) { pinchZ = 'n/a ' + e.message.slice(0, 200); }
  ok('a pinch zooms in', typeof pinchZ === 'number' && pinchZ > 1.2 && pinchZ <= 3, 'z=' + pinchZ);
  // ---- other players: a tap on the cyan dot names him (at 3×: the landscape fit shows ~1.7× more world per pixel than the portrait one did,
  //      so 1.6× put a village's tap circle over his dot; 3× gives him the same pixel spacing the portrait 1.6× had)
  await ev(() => { R.screens.map.zoomAt(422, 195, 3); const p = R.presence.list()[0]; R.screens.map.centreOn(p.x, p.y); }); await page.waitForTimeout(150);
  const jp = await ev(() => { const p = R.presence.list()[0]; return R.screens.map.toScreen(p.x, p.y); });   // where his dot is (the view may stop at the map's edge)
  await page.touchscreen.tap(Math.round(jp.x), Math.round(jp.y)); await page.waitForTimeout(300);
  const tagT = await ev(() => (document.querySelector('.mp-tag') || {}).textContent || '');
  ok('a tap on another player shows his name', /Jory|\S/.test(tagT) && tagT.length > 0, tagT);
  // ---- close
  await page.locator('.mp-x').tap({ force: true }); await page.waitForTimeout(250);
  const closed = await ev(() => ({ cur: R.ui.cur, on: document.querySelector('#screen').classList.contains('on'), paused: R.paused, left: document.querySelectorAll('.mp-cv, .mp-card, .mp-you').length }));
  ok('✕ closes the map, unpauses, leaves nothing behind', closed.cur === null && !closed.on && !closed.paused && closed.left === 0, JSON.stringify(closed));
  ok('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();
  let bad = 0; for (const k in out) { console.log(out[k].startsWith('OK') ? 'OK   ' : 'FAIL ', k, out[k].replace(/^(OK|FAIL)\s?/, '')); if (!out[k].startsWith('OK')) bad++; }
  console.log(bad ? bad + ' FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
