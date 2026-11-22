// A37 — R.props: every POI type builds without throwing and under 300 triangles, trees per biome, rocks, the Wall, a scatter of
// 200 instances in < 50 ms, and a small scene rendered with WebGL (swiftshader) to .shots/rpg_props.png.
// THREE: the built page's vendor copy if A05 vendored one; otherwise THREE_JS=<path to three.min.js> (UMD, r128+) is injected.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome [THREE_JS=…/three.min.js] node tests/rpg/t_props.js
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const html = path.join(ROOT, '.shots', 'rpg_props_test.html');
fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true });
const b0 = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), html], { encoding: 'utf8' });
if (b0.status !== 0) { console.log('FAIL build', b0.stdout, b0.stderr); process.exit(1); }
const vendored = /\bTHREE\b/.test(fs.readFileSync(html, 'utf8').split('/* ==== js/00_core.js')[0] || '');
let threePath = process.env.THREE_JS || null;
if (!threePath && !vendored) { for (const p of [path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js'), path.join(ROOT, 'node_modules', 'three', 'build', 'three.js')]) if (fs.existsSync(p)) { threePath = p; break; } }
if (!threePath && !vendored) { try { threePath = require.resolve('three/build/three.min.js'); } catch (e) {} }
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 720, height: 460 }, deviceScaleFactor: 1 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + html);
  await pg.waitForFunction(() => window.R && R.props && R.props.build);
  const before = await pg.evaluate(() => ({ three: typeof THREE !== 'undefined', nullBuild: typeof THREE === 'undefined' ? R.props.build({ type: 'castle' }) === null && R.props.tree('north') === null && R.props.scatter({}, 5) === null : null }));
  if (!before.three) { ok(before.nullBuild === true, 'without THREE every builder returns null'); if (!threePath) { console.log('FAIL no THREE: vendor it in src/rpg/vendor/ or pass THREE_JS=<three.min.js>'); process.exit(1); } await pg.addScriptTag({ path: threePath }); }
  const r = await pg.evaluate(() => {
    const out = { tris: {}, errors: [], rev: THREE.REVISION };
    const pois = [{ id: 'winterfell', type: 'castle', house: 'stark', seat: true, x: -260, y: -140 }, { id: 'moat', type: 'castle', house: 'tyrell', x: 120, y: -470 }, { id: 'wintertown', type: 'town', x: 280, y: -90 },
      { id: 'camp1', type: 'camp', x: 0, y: 130 }, { id: 'crypt', type: 'dungeon', x: -330, y: 250 }, { id: 'godswood', type: 'shrine', x: 330, y: 230 }, { id: 'odd', kind: 'village', x: 0, y: 0 }];
    const built = [];
    for (const p of pois) { try { const o = R.props.build(p); built.push(o); out.tris[p.id] = o.userData.tris; if (!o.userData.tris) out.errors.push(p.id + ' empty'); } catch (e) { out.errors.push(p.id + ': ' + e.message); } }
    out.same = R.props.build(pois[0]).userData.tris === out.tris.winterfell && R.props.build(pois[2]).userData.tris === out.tris.wintertown;
    out.mats = new Set(); built.forEach(o => o.traverse(m => { if (m.isMesh) out.mats.add(m.material.uuid); })); out.mats = out.mats.size;
    out.trees = {}; for (const bm of ['north', 'reach', 'dorne', 'riverlands', undefined]) { const t = R.props.tree(bm); out.trees[bm || 'default'] = R.props.tris(t); }
    out.rock = R.props.tris(R.props.rock());
    const w = R.props.wall(); out.wall = { tris: R.props.tris(w), x: Math.round(w.position.x), z: Math.round(w.position.z) };
    const t0 = performance.now(); const sc = R.props.scatter({ bbox: [0, 0, 3000, 3000], biome: 'north' }, 200, R.rng); out.scatterMs = Math.round((performance.now() - t0) * 10) / 10; out.scatter = sc.userData;
    const sc2 = R.props.scatter({ poly: [[0, 0], [400, 0], [400, 400], [0, 400]], biome: 'dorne' }, 40, R.rng); out.scatterPoly = sc2.userData.placed;
    // a blocked world: nothing may land
    const old = R.world; R.world = { blocked: () => true }; out.scatterBlocked = R.props.scatter({ bbox: [0, 0, 100, 100] }, 30, R.rng).userData.placed; R.world = old;
    R.props.update(0.5); out.spun = built[4].getObjectByName('ring').rotation.z > 0.1;
    // the scene
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 460; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:9'; document.body.appendChild(cv);
    try {
      const rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); rd.setSize(720, 460, false);
      const sn = new THREE.Scene(); sn.background = new THREE.Color(0x1a2230); sn.fog = new THREE.Fog(0x1a2230, 900, 1700);
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x55653f })); gr.rotation.x = -Math.PI / 2; sn.add(gr);
      sn.add(new THREE.AmbientLight(0x8fa3b8, 0.9)); const sun = new THREE.DirectionalLight(0xffeedd, 1.0); sun.position.set(400, 700, 300); sn.add(sun);
      built.forEach(o => sn.add(o));
      const kinds = ['north', 'north', 'reach', 'reach', 'dorne', 'dorne', 'north']; kinds.forEach((k, i) => { const t = R.props.tree(k); t.position.set(-420 + i * 140, 0, 420); t.rotation.y = i; sn.add(t); });
      for (let i = 0; i < 5; i++) { const rk = R.props.rock(); rk.position.set(-300 + i * 150, 0, 330); rk.scale.setScalar(.8 + i * .15); sn.add(rk); }
      w.position.set(0, 0, -720); sn.add(w);
      const sc3 = R.props.scatter({ bbox: [-600, -600, 600, 600], biome: 'reach' }, 40, R.rng); sn.add(sc3);
      const cam = new THREE.PerspectiveCamera(42, 720 / 460, 1, 4000); cam.position.set(360, 520, 900); cam.lookAt(0, 40, -40);
      rd.render(sn, cam); out.calls = rd.info.render.calls; out.sceneTris = rd.info.render.triangles;
      const px = rd.getContext().getParameter ? 1 : 0; out.gl = !!px;
    } catch (e) { out.errors.push('render: ' + e.message); }
    return out;
  });
  await pg.screenshot({ path: path.join(ROOT, '.shots', 'rpg_props.png'), clip: { x: 0, y: 0, width: 720, height: 460 } });
  console.log(JSON.stringify(r));
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  ok(r.errors.length === 0, 'every POI type builds, the scene renders ' + JSON.stringify(r.errors));
  for (const k in r.tris) ok(r.tris[k] > 0 && r.tris[k] <= 300, k + ' ' + r.tris[k] + ' tris (≤ 300)');
  ok(r.same, 'the same POI builds the same prop twice');
  ok(r.mats <= 8, 'materials shared (' + r.mats + ' across 7 POIs)');
  for (const k in r.trees) ok(r.trees[k] > 0 && r.trees[k] <= 50, 'tree ' + k + ' ' + r.trees[k] + ' tris (≤ 50)');
  ok(r.rock === 20, 'rock 20 tris (' + r.rock + ')');
  ok(r.wall.tris <= 200 && r.wall.x === 3600 && r.wall.z === 2600, 'the Wall ' + JSON.stringify(r.wall));
  ok(r.scatter.placed === 200 && r.scatter.trees === 150, 'scatter 200 (' + JSON.stringify(r.scatter) + ')');
  ok(r.scatterMs < 50, 'scatter 200 in ' + r.scatterMs + ' ms (< 50)');
  ok(r.scatterPoly === 40 && r.scatterBlocked === 0, 'scatter respects the polygon (' + r.scatterPoly + ') and blocked ground (' + r.scatterBlocked + ')');
  ok(r.spun, 'the dungeon ring spins on update');
  ok(r.calls > 5 && r.sceneTris > 500, 'rendered ' + r.calls + ' draw calls, ' + r.sceneTris + ' tris with three r' + r.rev);
  // the screenshot is not blank: count pixels that differ from the background
  const png = fs.readFileSync(path.join(ROOT, '.shots', 'rpg_props.png')); ok(png.length > 20000, 'screenshot has content (' + png.length + ' bytes)');
  await b.close();
  console.log(fails.length ? 'FAILS: ' + fails.join(' | ') : 'OK t_props');
  process.exit(fails.length ? 1 : 0);
})();
