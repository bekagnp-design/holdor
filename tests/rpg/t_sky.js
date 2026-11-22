// tests/rpg/t_sky.js — G12: the sky and the atmosphere (src/rpg/js/09e_sky.js).
// The dome / ridge ring / aurora / shafts sit in R.render3d.scene; the dome is camera-relative (it follows the camera); the colours at the top
// of #gl (sky only, the camera tilted up to 15°) differ as expected at noon / dusk / night / rain / snow; the ring's profile follows the land;
// the 3D aurora shows beyond the Wall at night only; no errors; cost per frame with and without the sky; screenshots on the landscape phone (844×390).
// Landscape: fov 50° on a wide frame, so at the lowest camera pitch (15°, the game's clamp) the top rows of #gl look ~7–10° above the horizon
// (portrait looked ~13–16° up); topColor reports the elevation of the rows it reads.
//   python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=… node tests/rpg/t_sky.js      (RPG_HTML=… RPG_NOBUILD=1 to test another build)
// Screenshots: .shots/rpg/sky_*.png
'use strict';
const L = require('./lib');
const { ok, skip } = L;

// in the 7200-wide grid of the old map; scaled to the world (R.WS × that) after boot, so 'north' is the North, not beyond the Wall
const PLACES = {
  reach: { x: 2300, y: 9300 }, dorne: { x: 3970, y: 11200 }, north: { x: 3300, y: 3300 }, river: { x: 2540, y: 7450 }, beyond: { x: 3700, y: 300 }
};

(async () => {
  L.build();
  const { page, errors, cerrs, close } = await L.launch();
  const E = (fn, arg) => page.evaluate(fn, arg);
  let b;
  try { b = await L.boot(page, { save: L.fakeSave({ house: 'tyrell', hero: 'jon', lvl: 30 }) }); } catch (e) { ok('boot', false, e.message); await close(); return L.report(); }
  await E(() => { if (R.ui && R.ui.cur) R.ui.close(); });
  await L.steps(page, 10);
  const lay = await E(() => ({ vw: R.vw, vh: R.vh, rot: !!R.rot, ws: (R.data.world && R.data.world.W || 7200) / 7200 }));
  for (const k in PLACES) { PLACES[k].x *= lay.ws; PLACES[k].y *= lay.ws; }
  ok('the landscape phone: the app is 844×390, not turned', lay.vw === 844 && lay.vh === 390 && !lay.rot, JSON.stringify(lay));
  const base = await E(() => ({ sky: !!R.sky, sys: !!(R.sys.sky), order: R.sys.sky && R.sys.sky.order, r3: !!(R.render3d && R.render3d.scene), why: R.sky && R.sky.why, mode: R.render && R.render.mode }));
  if (!base.r3) { skip('the sky in the 3D scene', 'no R.render3d (' + base.mode + ')'); ok('R.sky exists without WebGL and does not throw', base.sky, JSON.stringify(base)); await close(); return L.report(); }
  ok('system sky (order 895, before the renderer\'s 900)', base.sys && base.order === 895 && base.order < 900, JSON.stringify(base));

  /* ---- a scene: teleport, hour, weather, camera; a few steps + a draw ---- */
  const setScene = (s) => E(s => {
    const A = R.ambience; R.player.x = s.x; R.player.y = s.y; R.player.vx = R.player.vy = 0; if (R.render.snapCam) R.render.snapCam();
    for (const e of R.ents) if (e.kind === 'mob' || e.kind === 'boss') e.dead = true;
    if (s.pitch) { R.cam.pitchLock = true; R.cam.pitch = s.pitch * Math.PI / 180; } else { R.cam.pitchLock = false; }
    A.setHour(s.h); A.set(s.w || 'auto');
    for (let i = 0; i < 30; i++) { R.step(); A.setHour(s.h); if (s.sunYaw) { const d = A.sunDir; R.cam.yaw = Math.atan2(d.x, -d.z); } else if (s.yaw != null) R.cam.yaw = s.yaw; }
    R.player.hp = R.player.hpMax; R.drawAll();
    return { biome: A.biome, weather: A.weather, region: A.region, auroraK: A.auroraK, fog: A.gl.fog, far: R.render3d.camera.far, pitch: +(R.cam.pitch * 180 / Math.PI).toFixed(1), sun: A.sunDir };
  }, s);
  // the mean colour of the top rows of #gl, with only the sky meshes visible (so props never get in the way): re-renders, then reads
  const topColor = (onlySky) => E(onlySky => {
    const G = R.render3d, S = R.sky, sc = G.scene, hid = [];
    if (onlySky) for (const o of sc.children) if (o !== S.root && o.visible && !o.isLight) { o.visible = false; hid.push(o); }
    G.renderer.render(sc, G.camera);
    const gl = G.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), acc = [0, 0, 0]; let n = 0;
    for (let i = 0; i < 12; i++) for (const fy of [.985, .96, .93]) { gl.readPixels(Math.floor((i + .5) / 12 * W), Math.floor(fy * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); acc[0] += px[0]; acc[1] += px[1]; acc[2] += px[2]; n++; }
    for (const o of hid) o.visible = true;
    // the elevation (degrees above the horizontal) the read rows look at, centre column
    const cam = G.camera, elev = fy => { const v = new THREE.Vector3(0, 2 * fy - 1, .5).unproject(cam).sub(cam.position).normalize(); return +(Math.asin(v.y) * 180 / Math.PI).toFixed(1); };
    const c = acc.map(v => Math.round(v / n)); return { r: c[0], g: c[1], b: c[2], sum: c[0] + c[1] + c[2], sat: Math.max(...c) - Math.min(...c), el: [elev(.93), elev(.985)] };
  }, onlySky);

  /* ---- 1. attached + follows the camera ---- */
  await setScene(Object.assign({ h: 12, w: 'clear', pitch: 15 }, PLACES.reach));
  const att = await E(() => { const S = R.sky, sc = R.render3d.scene; let inScene = false; S.dome.traverseAncestors(a => { if (a === sc) inScene = true; });
    return { ready: S.ready, inScene, ring: !!S.ring && S.ring.parent === S.root, aur: !!S.auroraMesh, shafts: !!S.shafts, dome: S.dome.name, mat: S.dome.material.type, depthWrite: S.dome.material.depthWrite, fog: S.dome.material.fog, order: S.dome.renderOrder, attach: S.stats.attach, rr: S.uniforms.uRr.value, far: R.render3d.camera.far }; });
  ok('the dome, the ridge ring, the aurora and the shafts are in R.render3d.scene', att.ready && att.inScene && att.ring && att.aur && att.shafts, JSON.stringify(att));
  ok('the dome: depthWrite off, fog off, drawn after the opaques (renderOrder 9999)', att.depthWrite === false && att.fog === false && att.order === 9999, JSON.stringify(att));
  ok('the ring sits just inside the far plane', att.rr > att.far * .85 && att.rr < att.far, att.rr + ' / ' + att.far);
  // the far plane moves with the fog (G1: fog far × 1.06, every frame): the dome is drawn at the far depth, never clipped; the ring follows
  const f0 = await E(() => { const G = R.render3d, f0 = G.camera.far; G.camera.far = 900; G.camera.updateProjectionMatrix(); R.sys.sky.update(1 / 60); return { f0, rr: R.sky.uniforms.uRr.value, far: G.camera.far }; });
  const farTop = await topColor(true);
  // the renderer resets camera.far from the fog every frame (topColor draws frames), so the ring is read right after sky.update at far 900
  const farMv = { rr: f0.rr, far: f0.far }; await E(f0 => { const G = R.render3d; G.camera.far = f0; G.camera.updateProjectionMatrix(); R.sys.sky.update(1 / 60); }, f0.f0);
  ok('with camera.far = 900 the sky is still drawn (blue at the top) and the ring moves in (< 900)', farMv.far === 900 && farMv.rr < 900 && farTop.b > farTop.r + 30, JSON.stringify({ farMv, farTop }));
  const noon = await topColor(true);
  await setScene(Object.assign({ h: 12, w: 'clear', pitch: 15 }, { x: PLACES.reach.x + 2600, y: PLACES.reach.y - 3000 }));
  const moved = await topColor(true);
  const follow = await E(() => ({ cam: R.render3d.camera.position.toArray().map(Math.round), clear: R.render3d.renderer.getClearColor(new THREE.Color()).getHexString() }));
  ok('the dome follows the camera: the sky colour is the same 4000 units away', Math.abs(noon.sum - moved.sum) < 30 && moved.b > moved.r, JSON.stringify({ noon, moved, follow }));

  /* ---- 2. colours by time and weather (camera tilted up so the top of #gl is sky) ---- */
  const dusk = await setScene(Object.assign({ h: 19.2, w: 'clear', pitch: 15, sunYaw: true }, PLACES.dorne)).then(() => topColor(true));
  const night = await setScene(Object.assign({ h: 23.5, w: 'clear', pitch: 15 }, PLACES.north)).then(() => topColor(true));
  const rain = await setScene(Object.assign({ h: 12, w: 'rain', pitch: 15 }, PLACES.river)).then(() => topColor(true));
  const snow = await setScene(Object.assign({ h: 12, w: 'snow', pitch: 15 }, PLACES.north)).then(() => topColor(true));
  const C = { noon, dusk, night, rain, snow }; console.log('  info top-of-#gl colours ' + JSON.stringify(C));
  ok('landscape frame at pitch 15°: the read rows are sky, above the horizon (> 3°)', [noon, dusk, night, rain, snow].every(c => c.el[0] > 3), JSON.stringify([noon, dusk, night, rain, snow].map(c => c.el)));
  ok('noon: a blue sky (b > r + 40, bright)', noon.b > noon.r + 40 && noon.sum > 330, JSON.stringify(noon));
  ok('dusk toward the sun: warm (r > b)', dusk.r > dusk.b + 10, JSON.stringify(dusk));
  ok('night: dark navy (sum < 120, b ≥ r)', night.sum < 120 && night.b >= night.r, JSON.stringify(night));
  ok('rain: grey overcast (less saturated and darker than noon)', rain.sat < noon.sat - 30 && rain.sum < noon.sum, JSON.stringify(rain));
  ok('snow: white haze (brighter and less saturated than noon)', snow.sum > noon.sum && snow.sat < noon.sat, JSON.stringify(snow));

  /* ---- 3. the horizon matches the terrain's fog; the ring follows the land; the aurora only beyond the Wall at night ---- */
  await setScene(Object.assign({ h: 12, w: 'clear' }, PLACES.reach));
  const hz = await E(() => { const U = R.sky.uniforms, tf = R.render3d.uniforms.fogCol.value; return { sky: [U.uFog.value.x, U.uFog.value.y, U.uFog.value.z].map(v => +v.toFixed(3)), terrain: [tf.r, tf.g, tf.b].map(v => +v.toFixed(3)), fix: R.sky.fogFix }; });
  ok('the dome below the horizon = the colour the terrain fades to', Math.abs(hz.sky[0] - hz.terrain[0]) + Math.abs(hz.sky[1] - hz.terrain[1]) + Math.abs(hz.sky[2] - hz.terrain[2]) < .02, JSON.stringify(hz));
  const prof = await E(() => { const p = R.sky.ring.geometry.attributes.position.array, n = p.length / 3; let lo = 1, hi = -1; for (let i = 1; i < n; i += 2) { const y = p[i * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; } return { lo: +lo.toFixed(4), hi: +hi.toFixed(4), ms: R.sky.stats.profile }; });
  ok('the ridge profile varies around the camera (land / sea)', prof.hi - prof.lo > .01, JSON.stringify(prof));
  const aurNoon = await E(() => R.sky.aurora);
  const aurB = await setScene(Object.assign({ h: 23.5, w: 'clear' }, PLACES.beyond)); const aurNight = await E(() => ({ on: R.sky.aurora === true && R.sky.aurora3d, k: R.sky.uniforms.uAur.value, vis: R.sky.auroraMesh.visible }));
  ok('the 3D aurora: beyond the Wall at night, not at noon in the Reach', !aurNoon && aurNight.on && aurNight.vis && aurNight.k > .3, JSON.stringify({ aurNoon, aurNight, region: aurB.region, k: aurB.auroraK }));

  /* ---- 4. cost: the render system's draw (+ a 1-px readPixels = a full GPU sync) with and without the sky, default camera ---- */
  await setScene(Object.assign({ h: 17.6, w: 'clear' }, PLACES.reach));
  const cost = await E(() => {
    const G = R.render3d, gl = G.renderer.getContext(), one = new Uint8Array(4), ctx = R.ctx;
    const run = n => { const t = []; for (let i = 0; i < n; i++) { R.step(); const t0 = performance.now(); ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); R.sys.render.draw(ctx); gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return +t[t.length >> 1].toFixed(2); };
    const S = R.sky, parts = { dome: S.dome, ring: S.ring, shafts: S.shafts }, only = k => { for (const n in parts) parts[n].__skip = n !== k; };
    // one mesh alone: the others hidden right before the render (the sky's update sets visibility every step)
    const sb = G.scene.onBeforeRender; G.scene.onBeforeRender = function () { sb.apply(this, arguments); for (const n in parts) if (parts[n].__skip) parts[n].visible = false; };
    run(5); const on1 = run(16); S.setOn(false); const off1 = run(16); S.setOn(true); const on2 = run(16); S.setOn(false); const off2 = run(16); S.setOn(true);
    const per = {}; for (const k in parts) { only(k); per[k] = run(12); } for (const n in parts) parts[n].__skip = false; G.scene.onBeforeRender = sb; S.dome.visible = S.ring.visible = true;
    let sysMs = 0; for (let i = 0; i < 20; i++) { R.step(); sysMs += S.stats.ms; }
    return { on: Math.min(on1, on2), off: Math.min(off1, off2), per, shafts: S.shafts.visible, skyUpdateMs: +(sysMs / 20).toFixed(3), calls: G.stats.calls, gl: G.glName };
  });
  console.log('  info cost ' + JSON.stringify(cost));
  // software GL shades the dome's sky pixels on a CPU shared by several agents: there the bound is 40 % (12 % on a GPU)
  ok('cost: the sky adds < 12 % (40 % on software GL) or < 6 ms to a frame, its update < 0.5 ms', (cost.on - cost.off < 6 || cost.on < cost.off * (/SwiftShader|llvmpipe|software/i.test(cost.gl || '') ? 1.4 : 1.12)) && cost.skyUpdateMs < .5, JSON.stringify(cost));

  /* ---- 5. screenshots (844×390 landscape, the HUD hidden so the sky shows; the camera tilted up to 15° except the first) ---- */
  const shots = [['sky_noon_reach_game', { h: 12, w: 'clear' }, 'reach'], ['sky_noon_reach', { h: 12, w: 'clear', pitch: 15 }, 'reach'], ['sky_dusk_dorne', { h: 19.2, w: 'heat', pitch: 15, sunYaw: true }, 'dorne'],
    ['sky_night_north_stars', { h: 23.5, w: 'clear', pitch: 15, yaw: Math.PI, no2d: 1 }, 'north'], ['sky_rain_riverlands', { h: 13, w: 'rain', pitch: 15 }, 'river'],
    ['sky_beyond_wall_aurora', { h: 23.5, w: 'clear', pitch: 15, yaw: Math.PI / 2, no2d: 1 }, 'beyond'], ['sky_beyond_wall_aurora_game', { h: 23.5, w: 'clear', yaw: Math.PI / 2 }, 'beyond']];
  await E(() => { const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; });
  for (const [name, s, at] of shots) {
    await setScene(Object.assign({}, s, PLACES[at]));
    // no2d: the 2D overlay (#c: A34's moon / aurora / night lights, labels) hidden, to judge the 3D sky alone
    await E(h => { const c = document.getElementById('c'); if (c) c.style.visibility = h ? 'hidden' : ''; }, !!s.no2d);
    await page.waitForTimeout(250);
    try { await page.screenshot({ path: require('path').join(L.SHOTS, name + '.png'), timeout: 60000 }); } catch (e) { console.log('  info screenshot ' + name + ' failed: ' + e.message.split('\n')[0]); }
  }
  await E(() => { for (const id of ['ui', 'c']) { const u = document.getElementById(id); if (u) u.style.visibility = ''; } R.cam.pitchLock = false; });
  console.log('  info screenshots in ' + L.SHOTS + ': ' + shots.map(s => s[0]).join(', '));

  /* ---- 6. errors ---- */
  const ge = await L.gameErrors(page), ce = L.realConsole(cerrs);
  ok('no page errors, no R.errors, no thrown console errors', !errors.length && !ge.length && !ce.length, JSON.stringify({ errors: errors.slice(0, 3), ge: ge.slice(0, 3), ce: ce.slice(0, 3) }));
  await close(); L.report();
})();
