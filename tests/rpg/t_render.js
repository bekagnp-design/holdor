/* A05 — the render system (3D terrain + billboards on #gl, the 2D overlay on #c; 2D fallback without WebGL).
   Build first: python3 src/build_rpg.py beta/index.html
   Run: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_render.js   (RPG_HTML overrides the page) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'); const HTML = process.env.RPG_HTML || path.join(ROOT, 'beta', 'index.html');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const noise = t => /telegram|Failed to load resource|ERR_|favicon|GPU stall|WebGL warning|GL Driver|EGL|SwiftShader|Automatic fallback/i.test(t);

// the scene set up in the page: a small fake world when the real one is absent, a hero + 30 mobs + the other kinds, no 2D-only globals
const SETUP = (n) => `(() => {
  if (!R.data.world) R.data.world = { regions: [
      { id: 'r1', name: 'The Neck', biome: 'riverlands', poly: [[1800, 3000], [4000, 3000], [4000, 5000], [1800, 5000]] },
      { id: 'r2', name: 'The Vale', biome: 'vale', poly: [[4000, 3000], [6200, 3000], [6200, 5000], [4000, 5000]] }],
    pois: [{ id: 'p1', kind: 'castle', name: 'Moat Cailin', house: 'stark', x: 2800, y: 4000 }, { id: 'p2', kind: 'town', name: 'Hollow Hill', x: 4600, y: 4100 }, { id: 'p3', kind: 'shrine', name: 'The Old Heart', x: 3300, y: 3700 }, { id: 'p4', kind: 'camp', name: 'Rover camp', x: 3100, y: 4250 }],
    roads: [{ pts: [[2800, 4000], [3300, 3950], [3800, 4050], [4600, 4100]] }], gates: ['r2'] };
  R.state = R.newState(); R.state.p.flags.regions = { r1: true }; R.state.p.found = ['p1']; R.state.p.hero = 'jon';
  R.ents.length = 0;
  R.player = R.spawn({ kind: 'player', x: 3000, y: 4000, r: 14, team: 0, hp: 100, hpMax: 100, name: 'Tester', vx: 170, vy: 0, anim: 'walk' });
  const types = ['axe', 'sword', 'archer', 'hound', 'walker'];
  for (let i = 0; i < ${n}; i++) { const a = i / ${n} * Math.PI * 2, d = 120 + (i % 5) * 70;
    R.spawn({ kind: 'mob', type: types[i % 5], x: 3000 + Math.cos(a) * d, y: 4000 + Math.sin(a) * d * .7, r: 14, team: 1, hp: i % 3 ? 60 : 30, hpMax: 60, face: i % 2 ? 1 : -1, anim: i % 4 ? 'walk' : 'attack', status: i === 2 ? { stun: 1 } : i === 5 ? { burn: 1, slow: 1 } : {} }); }
  R.spawn({ kind: 'boss', type: 'giant', x: 3200, y: 3880, r: 26, team: 1, hp: 300, hpMax: 500, name: 'Mag the Mighty' });
  R.spawn({ kind: 'npc', type: 'villager', x: 2920, y: 4060, r: 14, team: 2, hp: 1, name: 'Old Nan' });
  R.spawn({ kind: 'ghost', type: 'arya', x: 3060, y: 4080, r: 14, team: 0, hp: 1, name: 'Wanderer' });
  R.spawn({ kind: 'drop', x: 3040, y: 3960, r: 8, team: 2, hp: 1, item: { rar: 3 } }); R.spawn({ kind: 'drop', x: 2960, y: 4040, r: 8, team: 2, hp: 1, item: { rar: 1 } });
  R.spawn({ kind: 'portal', x: 2880, y: 3900, r: 28, team: 2, hp: 1 });
  R.spawn({ kind: 'mob', type: 'axe', x: 3080, y: 4020, r: 14, team: 1, hp: 60, hpMax: 60, z: 40, tumble: { ang: .8 }, flash: 1 });
  // the real world (R.WS = 4.5) replaces the fixture above: (3000, 4000) is then out at sea. Move the whole scene to a seat's core (land).
  const W = R.data.world, P = W && (W.pois || []).find(q => q.id === 'winterfell'); if (P && W.regions && W.regions.length > 2) { const ox = P.x - 3000, oy = P.y - 4000; for (const e of R.ents) { e.x += ox; e.y += oy; } }
  R.render.redrawFog && R.render.redrawFog();
  return R.render.mode;
})()`;
// run frames by hand: step, draw, time it; walk the hero east so the camera moves; sample the overlay + gl pixels
const FRAMES = (n) => `(() => {
  const times = [], out = { frames: ${n} }, gl = R.render.gl, cv = R.cv, ctx = R.ctx;
  const glctx = R.render3d && R.render3d.renderer.getContext();
  const sampleGl = () => { if (!glctx) return null; const px = new Uint8Array(4 * 64), w = glctx.drawingBufferWidth, h = glctx.drawingBufferHeight; let dark = 0, sum = 0;
    for (let i = 0; i < 64; i++) { const x = Math.floor((i % 8 + .5) / 8 * w), y = Math.floor((Math.floor(i / 8) + .5) / 8 * h); glctx.readPixels(x, y, 1, 1, glctx.RGBA, glctx.UNSIGNED_BYTE, px.subarray(i * 4, i * 4 + 4)); const v = px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]; sum += v; if (v < 30) dark++; }
    return { dark, mean: Math.round(sum / 64 / 3), hash: Array.from(px).join(',') }; };
  // the overlay's middle row: in 3D it must stay mostly transparent (the vignette only darkens the edges), in 2D it is opaque
  const sample2d = () => { const d = ctx.getImageData(0, cv.height >> 1, cv.width, 1).data; let s = 0, n = 0, t = 0; for (let i = 0; i < d.length; i += 4) { s = (s * 31 + d[i] + d[i + 1] + d[i + 2] + d[i + 3]) >>> 0; if (!d[i + 3]) n++; if (d[i + 3] < 250) t++; } return { hash: s, clear: n, translucent: t, w: cv.width }; };
  if (R.ui && R.ui.cur) R.ui.close(); R.paused = false; R.step();
  const cam0 = { x: R.cam.x, y: R.cam.y }, one = new Uint8Array(4), all = [];
  // the render system alone (with a readPixels = a full GPU sync, so the time includes the rasterisation), then every other system's draw
  for (let i = 0; i < ${n}; i++) { R.player.x += 170 / 60; R.step(); const t0 = performance.now(); ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); R.sys.render.draw(ctx); if (glctx) glctx.readPixels(1, 1, 1, 1, glctx.RGBA, glctx.UNSIGNED_BYTE, one); const t1 = performance.now();
    for (const s of R.sysList) if (s.draw && s !== R.sys.render) { try { s.draw(ctx); } catch (e) {} } times.push(t1 - t0); all.push(performance.now() - t0);
    if (i === 10) { out.g1 = sampleGl(); out.c1 = sample2d(); } if (i === ${n} - 1) { out.g2 = sampleGl(); out.c2 = sample2d(); } }
  times.sort((a, b) => a - b); all.sort((a, b) => a - b); out.median = +times[times.length >> 1].toFixed(2); out.p90 = +times[Math.floor(times.length * .9)].toFixed(2); out.medianAll = +all[all.length >> 1].toFixed(2);
  out.cam0 = cam0; out.cam1 = { x: R.cam.x, y: R.cam.y, z: R.cam.z, yaw: R.cam.yaw, dist: R.cam.dist }; out.mode = R.render.mode; out.why = R.render.why || null;
  out.hero = R.w2s(R.player.x, R.player.y); out.heroTop = R.w2s(R.player.x, R.player.y, 56); out.vw = R.vw; out.vh = R.vh; out.ents = R.render.stats.ents;
  if (R.render3d) { const S = R.render3d.stats; out.calls = S.calls; out.sprites = S.sprites; out.props = S.props; out.gy = R.render3d.groundY(R.player.x, R.player.y); out.biome = R.render3d.biomeAt(R.player.x, R.player.y);
    out.hm = R.render3d.heightmap && { w: R.render3d.heightmap.w, h: R.render3d.heightmap.h, scale: R.render3d.heightmap.scale, canvas: !!R.render3d.heightmap.canvas };
    const back = R.s2w(out.hero.x, out.hero.y); out.roundTrip = Math.hypot(back.x - R.player.x, back.y - R.player.y);
    out.behind = R.w2s(R.player.x, R.player.y + 5000).behind; out.seaHero = R.render3d.seaAt(R.player.x, R.player.y); const sm = R.render3d.heightmap.sea; let ns = 0; for (let i = 0; i < sm.length; i++) ns += sm[i]; out.seaFrac = +(ns / sm.length).toFixed(3); out.art = !!(R.assets && R.assets.map); out.gl = R.render3d.glName; }
  out.fog = !!R.render.fogCanvas; out.err = document.getElementById('err').style.display;
  return out;
})()`;

async function run(label, args, n) {
  const b = await chromium.launch({ executablePath: EXE, args }); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = []; pg.on('pageerror', e => errs.push('PE ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push('CE ' + m.text()); });
  await pg.goto('file://' + HTML); await pg.waitForFunction(() => window.R && R.render && R.sys.render, null, { timeout: 15000 });
  const mode = await pg.evaluate(SETUP(30)); const r = await pg.evaluate(FRAMES(n));
  // closing the intro with no hero entered makes 52_intro re-open it 300 ms later (and an opening screen resets the input): close, wait, close again
  await pg.evaluate(() => { if (R.ui && R.ui.cur) R.ui.close(); }); await pg.waitForTimeout(450);
  const y0 = await pg.evaluate(() => { if (R.ui && R.ui.cur) R.ui.close(); R.paused = false; return R.cam.yaw; });
  // a real CDP touch drag on the right half (not on a button): 100 px to the right
  const cdp = await pg.context().newCDPSession(pg); const tp = (x, y) => [{ x, y, radiusX: 10, radiusY: 10, force: 1, id: 3 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(250, 300) });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(250 + i * 20, 300) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const y1 = await pg.evaluate(() => { for (let i = 0; i < 30; i++) R.step(); return R.cam.yaw; });
  // a real two-finger pinch on the right half: fingers apart → closer
  const pd0 = await pg.evaluate(() => R.cam.dist); const tp2 = (a, b) => [{ x: a, y: 300, id: 4 }, { x: b, y: 300, id: 5 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp2(260, 330) });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp2(260 - i * 6, 330 + i * 6) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const pd1 = await pg.evaluate(() => { for (let i = 0; i < 60; i++) R.step(); return R.cam.dist; });
  await pg.evaluate(d => { R.cam.dist = d; for (let i = 0; i < 60; i++) R.step(); }, pd0);
  const d0 = await pg.evaluate(() => R.cam.dist); await pg.mouse.move(250, 300); await pg.mouse.wheel(0, -200);
  const d1 = await pg.evaluate(() => { for (let i = 0; i < 40; i++) R.step(); return R.cam.dist; });
  for (let i = 0; i < 6; i++) await pg.mouse.wheel(0, -400); const dMin = await pg.evaluate(() => { for (let i = 0; i < 60; i++) R.step(); return R.cam.dist; });
  for (let i = 0; i < 8; i++) await pg.mouse.wheel(0, 400); const dMax = await pg.evaluate(() => { for (let i = 0; i < 60; i++) R.step(); return R.cam.dist; });
  r.camCtl = await pg.evaluate(([y0, y1, d0, d1, dMin, dMax, pd0, pd1]) => { if (!R.render3d) return null; const C = R.cam, out = { dYaw: y1 - y0, dDist: d1 - d0, minDist: dMin, maxDist: dMax, pinch: [pd0, pd1] };
    C.yaw = Math.PI / 2; C.dist = 420; R.step(); R.drawAll(); const cam = R.render3d.camera.position, p = R.player; out.fwdX = p.x - cam.x; out.fwdZ = Math.abs(p.y - cam.z);
    out.camDir = R.plr && R.plr.camDir ? R.plr.camDir(0, -1) : null; C.yaw = 0; R.step();
    const H = R.render3d.heightOf; out.hHero = H(R.player); const boss = R.ents.find(e => e.kind === 'boss'), mob = R.ents.find(e => e.kind === 'mob' && e.type === 'axe'); out.hBoss = boss && H(boss); out.hMob = mob && H(mob);
    const sp = R.render3d.sprites.get(R.player.id); out.heroBB = sp ? { w: +sp.sp.scale.x.toFixed(1), h: +sp.sp.scale.y.toFixed(1), cy: +sp.sp.center.y.toFixed(3) } : null; return out; }, [y0, y1, d0, d1, dMin, dMax, pd0, pd1]);
  r.render3dEvent = await pg.evaluate(() => { let got = false; R.bus.on('render3d', () => { got = true; }); R.drawAll(); return got || !R.render3d || 'fired-before'; });
  return { b, pg, errs, mode, r };
}

(async () => {
  fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true });
  // ---- 3D (SwiftShader) ----
  const A = await run('3d', ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], 60);
  const r = A.r; console.log('3D', JSON.stringify(r));
  ok(A.mode === '3d', '3D mode (WebGL via SwiftShader): mode=' + A.mode + (r.why ? ' why=' + r.why : ''));
  ok(r.g1 && r.g1.dark < 56 && r.g1.mean > 25, 'the WebGL canvas has non-blank pixels (' + (r.g1 && r.g1.dark) + '/64 dark samples, mean ' + (r.g1 && r.g1.mean) + ')');
  ok(r.g1 && r.g2 && r.g1.hash !== r.g2.hash, 'WebGL pixels change while the hero walks');
  ok(Math.abs(r.hero.x - r.vw / 2) < 40 && r.hero.y > r.vh * .35 && r.hero.y < r.vh * .8, 'w2s(hero) lands near the screen centre: ' + Math.round(r.hero.x) + ',' + Math.round(r.hero.y) + ' of ' + r.vw + 'x' + r.vh);
  ok(r.heroTop.y < r.hero.y - 40, 'w2s with z lifts the point (' + Math.round(r.hero.y - r.heroTop.y) + ' px for 56 u)');
  ok(r.roundTrip < 6, 's2w(w2s(hero)) returns to the hero (' + r.roundTrip.toFixed(2) + ' u off)');
  ok(r.behind === true, 'a point behind the camera is flagged');
  ok(r.cam1.x > r.cam0.x + 20, 'the camera follows the hero east (' + Math.round(r.cam0.x) + ' → ' + Math.round(r.cam1.x) + ')');
  ok(r.cam1.z > 1 && r.cam1.z < 4, 'R.cam.z = px per unit at the hero (' + r.cam1.z.toFixed(2) + ')');
  ok(r.cam1.dist === 420 && r.cam1.yaw === 0, 'camera defaults: dist 420, yaw 0');
  const cc = r.camCtl || {};
  ok(cc.dYaw > .4 && cc.dYaw < .9, 'a real right-half touch drag of 100 px turns the camera right (yaw +' + (cc.dYaw || 0).toFixed(2) + ')');
  ok(cc.pinch && cc.pinch[1] < cc.pinch[0] - 40, 'a real two-finger pinch (fingers apart) zooms in: dist ' + (cc.pinch && cc.pinch.map(Math.round).join(' → ')));
  ok(cc.minDist >= 299 && cc.minDist < 320 && cc.maxDist > 680 && cc.maxDist <= 701, 'pinch / wheel zooms within 300..700 (' + Math.round(cc.minDist) + '..' + Math.round(cc.maxDist) + ')');
  ok(cc.fwdX > 200 && cc.fwdZ < 60 && (!cc.camDir || cc.camDir.x > .99), 'yaw 90 deg: the camera looks east and stick-up moves east (camera ' + Math.round(cc.fwdX) + ' u west of the hero; camDir ' + JSON.stringify(cc.camDir) + ')');
  ok(cc.hHero === 64 && cc.hMob > 40 && cc.hMob < 56 && cc.hBoss <= 2 * cc.hMob + 4, 'billboard heights: hero ' + cc.hHero + ', axe ' + cc.hMob + ', boss ' + cc.hBoss + ' (<= 2 x mob); hero quad ' + JSON.stringify(cc.heroBB));
  const SOFT = /swiftshader|llvmpipe|software/i.test(r.gl || '');
  ok(r.median < (SOFT ? 1200 : 25), (SOFT ? '[software GL shared by 9 agents: sanity bound 1200] ' : '') + 'render median ' + r.median + ' ms (< 25; p90 ' + r.p90 + '; whole frame with every module ' + r.medianAll + ' ms) with ' + r.sprites + ' billboards, ' + r.calls + ' draw calls, art=' + r.art + ', gl=' + r.gl);
  ok(r.calls <= 120, 'draw calls ' + r.calls + ' ≤ 120 (A43 nature: up to 12 per chunk; billboards 1 each)');
  ok(r.sprites >= 20 && r.props >= 3, 'billboards ' + r.sprites + ' (in the view frustum) and props ' + r.props + ' are in the scene');
  ok(r.hm && r.hm.canvas && r.hm.w > 100 && r.hm.h > 100 && r.hm.scale > 0 && r.hm.scale <= 100, 'R.render3d.heightmap {canvas ' + (r.hm && r.hm.w + 'x' + r.hm.h) + ', ' + (r.hm && r.hm.scale.toFixed(1)) + ' u per vertex (<= 100)}');
  ok(typeof r.gy === 'number' && r.gy > 0 && r.gy < 300 && r.seaHero === false && r.seaFrac > .01 && r.seaFrac < .75, 'groundY(hero) = ' + (r.gy && r.gy.toFixed(1)) + ' on land; sea covers ' + Math.round(r.seaFrac * 100) + '% of the grid');
  ok(typeof r.biome === 'string' && r.biome.length > 0, 'biomeAt gives a biome (' + r.biome + '; reach without R.world)');
  ok(r.c1 && r.c1.translucent > r.c1.w * .3 && r.c1.hash !== (r.c2 && r.c2.hash), 'the 2D overlay stays see-through (' + (r.c1 && r.c1.translucent) + '/' + (r.c1 && r.c1.w) + ' translucent px mid-row, ' + (r.c1 && r.c1.clear) + ' clear) and changes between frames');
  ok(r.fog, 'the fog canvas exists');
  ok(r.render3dEvent === 'fired-before', "'render3d' fired at the first frame");
  ok(r.err === 'none' || r.err === '', 'no error overlay'); ok(A.errs.length === 0, 'no page errors' + (A.errs.length ? ': ' + A.errs.slice(0, 3).join(' | ') : ''));
  await A.pg.screenshot({ path: path.join(ROOT, '.shots', 'rpg_render.png') }); await A.b.close();

  // ---- 2D fallback (WebGL disabled) ----
  const B = await run('2d', ['--disable-webgl', '--disable-3d-apis'], 40);
  const q = B.r; console.log('2D', JSON.stringify({ mode: q.mode, why: q.why, median: q.median, hero: q.hero, cam: q.cam1, clear: q.c1 && q.c1.clear, ents: q.ents }));
  ok(B.mode === '2d', '2D fallback without WebGL: mode=' + B.mode + ' why=' + q.why);
  ok(q.c1 && q.c1.clear === 0 && q.c1.hash !== q.c2.hash, 'the 2D renderer paints the canvas opaque and the pixels change');
  ok(q.median < 12, '2D frame median ' + q.median + ' ms (< 12)');
  ok(Math.abs(q.hero.x - q.vw / 2) < 60 && Math.abs(q.hero.y - q.vh / 2) < 60, '2D camera keeps the hero near the centre: ' + Math.round(q.hero.x) + ',' + Math.round(q.hero.y));
  ok(q.ents >= 30, '2D draws the entities (' + q.ents + ')'); ok(B.errs.length === 0, '2D: no page errors' + (B.errs.length ? ': ' + B.errs.slice(0, 3).join(' | ') : ''));
  await B.pg.screenshot({ path: path.join(ROOT, '.shots', 'rpg_render_2d.png') }); await B.b.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crash ' + (e.stack || e)); process.exit(1); });
