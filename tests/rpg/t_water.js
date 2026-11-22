// A44 water: the mask read from the map art (sea by flood fill, the Trident as a river, the God's Eye as a lake), the
// physics API (isWater / depth / kindAt / flowAt / shorePoints / shoreDist), and the 3D sea + rivers drawn with a fake
// R.render3d (a real THREE scene) — non-blank water pixels, ≤ 4 draw calls, uTime advancing, the plane following the camera.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_water.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const b64 = fs.readFileSync(path.join(root, 'src/assets/westeros_1200.webp')).toString('base64');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); });
  await page.goto('file://' + path.resolve(root, process.env.RPG_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.water && R.sys.water && window.THREE, { timeout: 20000 });
  const r = await page.evaluate(async (b64) => {
    const out = {}, W = R.water, T = THREE, S = 6;
    const img = new Image(); img.src = 'data:image/webp;base64,' + b64; await img.decode();
    out.cellsBefore = W.ready;
    const cells = W.build(img); out.cells = cells; out.buildMs = W.stats.buildMs; out.ready = W.ready; out.dims = [W.w, W.h, W.CS];
    // ---- the physics API (art px × 6 = world units)
    const narrow = [1100 * S, 1350 * S], winterfell = [2950, 2450], riverrun = [2540, 7250], kl = [833 * S, 1353 * S], trident = [600 * S, 1075 * S], sunset = [60 * S, 700 * S], bite = [980 * S, 640 * S];
    out.narrowSea = [W.isWater(...narrow), W.depth(...narrow), W.kindAt(...narrow)];
    out.winterfell = [W.isWater(...winterfell), W.depth(...winterfell), W.kindAt(...winterfell)];
    out.riverrun = [W.isWater(...riverrun), W.kindAt(...riverrun)]; out.kl = [W.isWater(...kl), W.kindAt(...kl)];
    out.sunset = W.kindAt(...sunset); out.bite = W.kindAt(...bite);
    // the Trident (the purple line NE of Riverrun): river cells in a 100×60 px window, flow vectors unit length
    let nr = 0, nf = 0, nUnit = 0, flows = []; for (let y = 1040; y < 1120; y += 4) for (let x = 560; x < 660; x += 4) { if (W.kindAt(x * S, y * S) === 'river') { nr++; const f = W.flowAt(x * S + 1, y * S + 1); if (f) { nf++; const L = Math.hypot(f.x, f.y); if (Math.abs(L - 1) < .03) nUnit++; if (flows.length < 6) flows.push([+f.x.toFixed(2), +f.y.toFixed(2)]); } } }
    out.trident = { river: nr, flows: nf, unit: nUnit, depthAt: W.depth(...trident), sample: flows };
    let anyRiverNearRiverrun = 0; for (let y = 1000; y < 1300; y += 4) for (let x = 420; x < 700; x += 4) if (W.kindAt(x * S, y * S) === 'river') anyRiverNearRiverrun++;
    out.riverNearRiverrun = anyRiverNearRiverrun;
    // the God's Eye (668..704 × 1228..1280 px): mostly lake
    let nl = 0, nt = 0; for (let y = 1232; y < 1278; y += 4) for (let x = 672; x < 702; x += 4) { nt++; if (W.kindAt(x * S, y * S) === 'lake') nl++; }
    out.godsEye = { lake: nl, total: nt, depth: W.depth(686 * S, 1254 * S) };
    // the shoreline east of King's Landing: points in the water, unit normals pointing to land
    const sp = W.shorePoints(5220, 8118, 400); out.shore = { n: sp.length, water: sp.filter(p => W.isWater(p.x, p.y)).length, unit: sp.filter(p => Math.abs(Math.hypot(p.nx, p.ny) - 1) < .01).length,
      landward: sp.filter(p => !W.isWater(p.x + p.nx * W.CS * 1.5, p.y + p.ny * W.CS * 1.5)).length, kinds: [...new Set(sp.map(p => p.kind))] };
    out.shoreDist = [W.shoreDist(...narrow), W.shoreDist(...winterfell), W.shoreDist(5220, 8118)];
    out.outside = [W.isWater(-10, 5), W.isWater(7300, 100), W.depth(1e9, 1e9), W.kindAt(NaN, 1)];
    out.bigSeas = cells.sea > 40000 && cells.sea < 90000;
    // ---- the 3D: a fake R.render3d with a real THREE scene (no A05 renderer in this build)
    const glc = document.createElement('canvas'); glc.id = 'glt'; glc.width = 390; glc.height = 844; glc.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;z-index:50'; document.body.appendChild(glc);
    const renderer = new T.WebGLRenderer({ canvas: glc, antialias: false, preserveDrawingBuffer: true }); renderer.setSize(390, 844, false); renderer.setClearColor(0x060b14, 1);
    const scene = new T.Scene(); scene.fog = new T.Fog(0x9fb0c4, 900, 2600);
    const camera = new T.PerspectiveCamera(60, 390 / 844, 20, 9000);
    const tex = new T.Texture(img); tex.needsUpdate = true; tex.minFilter = T.LinearFilter;
    const ground = new T.Mesh(new T.PlaneGeometry(7200, 12288), new T.MeshBasicMaterial({ map: tex })); ground.rotateX(-Math.PI / 2); ground.position.set(3600, 0, 6144); scene.add(ground);
    const groundY = (x, y) => (W.depth(x, y) >= 1 ? 0 : 24) + (W.depth(x, y) >= 1 ? 0 : Math.max(0, 6 - Math.abs(W.shoreDist(x, y)) * 3));
    R.render3d = { scene, camera, renderer, groundY, heightmap: { fake: true } };
    R.bus.emit('render3d', R.render3d);
    out.attached = !!(W.sea && W.sea.parent === scene); out.uniforms = !!W.uniforms;
    const place = (px, py, pz, tx, ty, tz) => { camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true); };
    place(1140 * S, 230, 1360 * S, 1030 * S, 0, 1350 * S);
    const t0 = W.uniforms.uTime.value; for (let i = 0; i < 30; i++) R.step(); out.dTime = W.uniforms.uTime.value - t0;
    out.rivers = !!(W.rivers && W.rivers.parent === scene); out.riverVerts = W.rivers ? W.rivers.geometry.attributes.position.count : 0;
    out.seaPos = [W.sea.position.x, W.sea.position.y, W.sea.position.z]; out.hasMask = W.uniforms.uHasMask.value; out.drawCallsStat = W.stats.drawCalls;
    // the plane follows the camera in 1200-unit steps
    place(2500, 230, 3000, 2000, 0, 2500); R.step(); out.seaPos2 = [W.sea.position.x, W.sea.position.z]; place(1140 * S, 230, 1360 * S, 1030 * S, 0, 1350 * S); R.step();
    // render + pixels
    renderer.render(scene, camera); const calls1 = renderer.info.render.calls;
    const grab = () => { const c = document.createElement('canvas'); c.width = 390; c.height = 844; const g = c.getContext('2d'); g.drawImage(glc, 0, 0); return { c, d: g.getImageData(0, 0, 390, 844).data }; };
    const stat = d => { let non = 0, blue = 0, white = 0; for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (Math.abs(r - 6) + Math.abs(g - 11) + Math.abs(b - 20) > 12) non++; if (b > r + 10 && g > r) blue++; if (r > 200 && g > 200 && b > 200) white++; } return { non, blue, white, of: d.length / 16 }; };
    const view1 = grab(); out.px1 = stat(view1.d); out.calls = calls1;
    // without the water meshes the same view has no teal pixels (the map art is olive at sea)
    W.sea.visible = false; if (W.rivers) W.rivers.visible = false; renderer.render(scene, camera); out.pxNoWater = stat(grab().d); W.sea.visible = true; if (W.rivers) W.rivers.visible = true;
    // storm → bigger amplitude, faster; night → darker
    W.setStorm(1); for (let i = 0; i < 240; i++) R.step(); out.storm = [W.uniforms.uStorm.value, W.uniforms.uAmp.value, W.uniforms.uSpeed.value]; W.setStorm(0); for (let i = 0; i < 240; i++) R.step(); out.calm = [W.uniforms.uAmp.value];
    R.ambience = { nightK: 1, weather: 'clear', sunDir: { x: 0.2, y: 0.5, z: 0.3 } }; R.step(); out.night = W.uniforms.uNight.value; out.sun = [+W.uniforms.uSun.value.x.toFixed(2), +W.uniforms.uSun.value.y.toFixed(2)]; R.ambience = { nightK: 0, weather: 'clear' }; R.step();
    // timing: 20 renders (SwiftShader, informational)
    let tt = performance.now(); for (let i = 0; i < 10; i++) { R.step(); renderer.render(scene, camera); } out.renderMs = (performance.now() - tt) / 10;
    // view 2: the Trident and the God's Eye from the south-west
    place(560 * S, 320, 1130 * S, 620 * S, 0, 1070 * S); R.step(); renderer.render(scene, camera); const view2 = grab(); out.px2 = stat(view2.d); out.calls2 = renderer.info.render.calls;
    place(690 * S - 300, 260, 1254 * S + 420, 690 * S, 0, 1254 * S); R.step(); renderer.render(scene, camera); const view3 = grab(); out.px3 = stat(view3.d);
    // the picture: three views stacked + the mask
    glc.style.display = 'none'; const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;background:#000;z-index:60;display:grid;grid-template-rows:1fr 1fr 1fr'; document.body.appendChild(box);
    for (const v of [view1, view2, view3]) { const c = document.createElement('canvas'); c.width = 390; c.height = 281; c.getContext('2d').drawImage(v.c, 0, 282, 390, 281, 0, 0, 390, 281); c.style.cssText = 'width:390px;height:281px'; box.appendChild(c); }
    const dbg = W.debugCanvas(1); dbg.style.cssText = 'position:fixed;right:4px;top:4px;width:90px;height:154px;border:1px solid #fff;background:#222;z-index:70;image-rendering:pixelated'; document.body.appendChild(dbg);
    const cap = document.createElement('div'); cap.textContent = 'water: sea east of King’s Landing · the Trident · the God’s Eye'; cap.style.cssText = 'position:fixed;left:6px;bottom:6px;color:#fff;font:12px sans-serif;z-index:70;text-shadow:0 1px 2px #000'; document.body.appendChild(cap);
    out.errorsNow = 0;
    return out;
  }, b64);
  fs.mkdirSync(path.join(root, '.shots'), { recursive: true });
  await page.screenshot({ path: path.join(root, '.shots/rpg_water.png') });
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  ok(r.ready && r.dims[0] === 300 && r.dims[1] === 512 && r.dims[2] === 24, 'mask built 300×512 cells of 24 units: ' + JSON.stringify(r.dims));
  ok(r.bigSeas, 'the sea covers a plausible share of the map: ' + JSON.stringify(r.cells));
  ok(r.narrowSea[0] === true && r.narrowSea[1] === 1 && r.narrowSea[2] === 'sea', 'Narrow Sea east of King\'s Landing is sea: ' + JSON.stringify(r.narrowSea));
  ok(r.sunset === 'sea' && r.bite === 'sea', 'Sunset Sea + the Bite are sea: ' + JSON.stringify([r.sunset, r.bite]));
  ok(r.winterfell[0] === false && r.winterfell[1] === 0 && r.winterfell[2] === null, 'Winterfell is land: ' + JSON.stringify(r.winterfell));
  ok(r.riverrun[0] === false && r.kl[0] === false, 'Riverrun + King\'s Landing castles are land: ' + JSON.stringify([r.riverrun, r.kl]));
  ok(r.trident.river >= 20 && r.trident.flows === r.trident.river && r.trident.unit === r.trident.flows, 'the Trident is a river with unit flow vectors: ' + JSON.stringify(r.trident));
  ok(r.riverNearRiverrun >= 20, 'river cells in the Riverrun / Trident area: ' + r.riverNearRiverrun);
  ok(r.godsEye.lake >= r.godsEye.total * 0.5 && r.godsEye.depth === 1, 'the God\'s Eye is a lake (the Isle of Faces in it is land): ' + JSON.stringify(r.godsEye));
  ok(r.shore.n >= 3 && r.shore.water === r.shore.n && r.shore.unit === r.shore.n && r.shore.landward >= r.shore.n * 0.8, 'shorePoints east of King\'s Landing: in the water, unit normals toward land: ' + JSON.stringify(r.shore));
  ok(r.shoreDist[0] > 0 && r.shoreDist[1] < 0, 'shoreDist signed (+ water, − land): ' + JSON.stringify(r.shoreDist));
  ok(r.outside.every(v => !v), 'outside the world / NaN → land: ' + JSON.stringify(r.outside));
  ok(r.attached && r.uniforms && r.hasMask === 1, 'sea plane attached to the fake scene with the mask texture: ' + JSON.stringify([r.attached, r.uniforms, r.hasMask]));
  ok(Math.abs(r.dTime - 0.5) < 1e-6, 'uTime advances 0.5 s over 30 steps: ' + r.dTime);
  ok(r.rivers && r.riverVerts >= 4 * 80, 'rivers + lake mesh built: ' + JSON.stringify([r.rivers, r.riverVerts]));
  ok(r.seaPos[0] === 7200 && r.seaPos[2] === 8400 && r.seaPos[1] === 2 && r.seaPos2[0] === 2400 && r.seaPos2[1] === 3600, 'the plane follows the camera in 1200-unit steps at height 2: ' + JSON.stringify([r.seaPos, r.seaPos2]));
  ok(r.calls - 1 <= 4 && r.drawCallsStat <= 4, 'draw calls (minus the test ground): ' + JSON.stringify([r.calls, r.drawCallsStat]));
  ok(r.px1.non > r.px1.of * 0.5 && r.px1.blue > r.pxNoWater.blue + 2000, 'the sea renders teal pixels the bare map does not: ' + JSON.stringify([r.px1, r.pxNoWater]));
  ok(r.px2.blue > 200 && r.px3.blue > 300, 'the Trident + the God\'s Eye render water pixels: ' + JSON.stringify([r.px2, r.px3]));
  ok(r.storm[0] > 0.9 && r.storm[1] > 5.5 && r.storm[2] > 1.6 && r.calm[0] < 3.3, 'storm raises the waves, calm lowers them: ' + JSON.stringify([r.storm, r.calm]));
  ok(r.night === 1 && r.sun[1] > 0.4, 'night + sun direction from R.ambience: ' + JSON.stringify([r.night, r.sun]));
  ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
  console.log(JSON.stringify({ cells: r.cells, buildMs: Math.round(r.buildMs), trident: r.trident.river, godsEye: r.godsEye, shore: r.shore.n, calls: r.calls, px: r.px1, renderMs: +r.renderMs.toFixed(1) }));
  if (fails.length) { console.log('FAIL\n - ' + fails.join('\n - ')); await browser.close(); process.exit(1); }
  console.log('OK t_water');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
