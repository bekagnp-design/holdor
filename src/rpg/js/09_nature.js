/* HOLDOR RPG — nature (A43). Biome vegetation and ground life on A05's three.js terrain (R.render3d = {scene, camera,
   renderer, groundY(x, y)}; scene axes as A37's props: x east, z = the 2D world's y (south), y up, 1 unit = 1 world unit).
   The land is streamed in 600-unit chunks around the player (the 3×3 ring, ≤ 9 alive, built on demand one per step,
   disposed when they leave the ring). A chunk = one THREE.InstancedMesh per prop type (≤ 12 draw calls), placed by a
   seeded hash per chunk on walkable ground only (R.world.blocked false, above the sea), never within 120 units of a POI
   or 30 of a road, with value-noise clumps so every place reads differently; the near ring (the player's chunk and its
   edge neighbours) carries the ground life (flowers, reeds, drifts, pools …), the diagonals only trees and rocks, and
   nothing lives beyond 1400 units. Grass tufts are one global InstancedMesh (≤ 400 camera-facing quads within 440 units)
   that follows the player. Wind: a vertex sway in onBeforeCompile (uniform uTime shared by every material), stronger in
   the Stormlands and on the coast, snow-stiff in the North; windmill blades spin. Big trees, boulders, spires, stacks,
   pillars, outcrops, standing stones, basalt, mills and farms fill R.nature.obstacles [{x, y, r}] (a 64-unit grid behind
   R.nature.blockedAt(x, y, r)); 10_world's R.world.slide (both forms) asks it, so the hero and the mobs walk around trunks.
   The recipe of a place: the region id of 11_world_data (N.REGION_BIOME) and the named woods / bogs inside the regions
   (N.ZONES: the Wolfswood, the Kingswood, the Neck, the Red Mountains, Crackclaw Point); a chunk votes with its land only.
   Water = the sea mask + 09b_water's rivers / lakes (the frozen seas beyond the Wall are snowfields); chunks rebuild on
   'water'. POI cores keep clear by type (castles / towns ≥ 210 units, camps 150, others 120: N.keepOf(poi)).
   API: R.nature.describe(x, y) → one flavour line (2 variants per biome, stable per place); .biomeAt(x, y);
   .chunks (Map key 'cx,cy' → {cx, cy, lod, biome, group, meshes, obst, n, tris, ms}); .obstacles; .blockedAt(x, y, r);
   .refresh() / .buildAll() / .build(cx, cy, lod); .reset() (disposes everything incl. the shared geometry / materials);
   .attach(render3d); .stats {built, lastMs, maxMs, disposed:{meshes, geoms, mats}, grass}; .grassCount(); .biomeOverride
   (tests: a biome id or fn(x, y)); .BIOMES (recipes, each with .ground = a ground colour), .PROPS; .CHUNK = 600. */
(function () {
  const N = R.nature = R.nature || {};
  const CHUNK = 600, FAR = 1400, POI_R = 120, ROAD_R = 30, GRASS_MAX = 760, GRASS_R = 460, GRASS_STEP = 110, MAX_DRAWS = 12, MAX_INST = 1200, PER_TYPE = 170, BUILDS = 1, SEA = 0;
  N.CHUNK = CHUNK; N.FAR = FAR; N.POI_R = POI_R; N.ROAD_R = ROAD_R; N.GRASS_MAX = GRASS_MAX; N.MAX_DRAWS = MAX_DRAWS; N.MAX_INST = MAX_INST;
  N.chunks = new Map(); N.obstacles = []; N.biomeOverride = null;
  N.stats = { built: 0, lastMs: 0, maxMs: 0, disposed: { meshes: 0, geoms: 0, mats: 0 }, grass: 0 };
  const has = () => typeof THREE !== 'undefined' && !!(THREE && THREE.InstancedMesh);
  let scene = null, root = null, grass = null, grassAt = null, pending = [], lastCell = null, r3d = null;
  const GEO = {}, MAT = {}, U = { uTime: { value: 0 }, uHero: { value: null }, uBend: { value: null }, uStorm: { value: 1 } };
  const NB = N.NB = 8;   // benders: up to 8 {x, z, r, k} pushing grass / flowers / reeds / bushes aside (the hero, his wake, the nearest movers)
  const ensureU = () => { if (!U.uBend.value) { U.uBend.value = []; for (let i = 0; i < NB; i++) U.uBend.value.push(new THREE.Vector4(0, 0, 0, 0)); } };
  const DECL = 'uniform float uTime, uSway, uFreq, uH, uSpin, uBendK, uStorm; uniform vec2 uHub; uniform vec4 uBend[' + NB + '];';

  /* ---------- hashing, noise, rng ---------- */
  const h2 = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const hs = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const mkRng = seed => { let s = (seed >>> 0) || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const sm = t => t * t * (3 - 2 * t);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi), s = (i, j) => (h2(xi + i, yi + j) & 0xffff) / 65535;
    return R.lerp(R.lerp(s(0, 0), s(1, 0), u), R.lerp(s(0, 1), s(1, 1), u), v); };
  const clumpAt = (x, y, off) => vn(x / 320 + off, y / 320 + off * 1.7);

  /* ---------- the world (every call read lazily: tests swap R.world) ---------- */
  const ALIAS = { snow: 'north', cold: 'north', tundra: 'north', frost: 'beyond', ice: 'beyond', wall: 'wall', plains: 'reach', grass: 'reach', fields: 'reach', forest: 'riverlands', river: 'riverlands',
    wet: 'riverlands', mountain: 'vale', mountains: 'vale', hills: 'westerlands', desert: 'dorne', sand: 'dorne', hot: 'dorne', sun: 'reach', sea: 'coast', shore: 'coast', iron: 'ironislands', islands: 'ironislands', storm: 'stormlands', crown: 'crownlands' };
  // the real regions of 11_world_data.js → a recipe; then the named woods / bogs inside them (every place reads differently)
  const REGION_BIOME = N.REGION_BIOME = { dorne: 'dorne', reach: 'reach', stormlands: 'stormlands', westerlands: 'westerlands', ironislands: 'ironislands', dragonstone: 'dragonstone',
    north: 'north', crownlands: 'crownlands', westcoast: 'coast', riverlands: 'riverlands', vale: 'vale', farnorth: 'north', wall: 'wall', beyond: 'beyond', winter: 'winter' };
  // geography scale: the zones below are in the 7200-wide art grid × 6; R.data.world carries the real size (R.WS = 4.5 → 32 400 wide)
  const GS = N.gs = () => { const w = R.data && R.data.world, Wd = w && (w.W || (w.size && w.size[0])); return Wd > 0 ? Wd / 7200 : 1; };
  const ZONES = N.ZONES = [
    { b: 'wolfswood', region: 'farnorth', at: (x, y) => x < 3150 * GS() },                       // the Wolfswood around Deepwood Motte
    { b: 'kingswood', region: 'crownlands', at: (x, y) => y > 8400 * GS() && x > 4300 * GS() },   // the Kingswood south of King's Landing
    { b: 'neck', region: 'riverlands', at: (x, y) => y < 5150 * GS() },                           // the bog of the Neck around Moat Cailin
    { b: 'redmts', region: 'dorne', at: (x, y) => y < 10900 * GS() && x < 3900 * GS() },          // the dry valleys of the Red Mountains
    { b: 'crackclaw', region: 'dragonstone', at: (x, y) => x < 6000 * GS() }];                    // Crackclaw Point: the pine woods across the strait
  N.biomeAt = (x, y) => {
    const o = N.biomeOverride; if (o) { const b = typeof o === 'function' ? o(x, y) : o; if (b && BIOMES[b]) return b; }
    const rg = R.world && R.world.regionAt ? R.world.regionAt(x, y) : null;
    const id = rg ? String(rg.id || '').toLowerCase() : '';
    if (id && REGION_BIOME[id]) { for (const z of ZONES) if (z.region === id && z.at(x, y) && BIOMES[z.b]) return z.b; if (BIOMES[REGION_BIOME[id]]) return REGION_BIOME[id]; }
    let b = rg ? String(rg.biome || '').toLowerCase() : '';
    if (!BIOMES[b]) b = ALIAS[b] || (rg && ALIAS[String(rg.id || '').toLowerCase()]) || 'reach';
    return b;
  };
  const gy = (x, y) => { const g = r3d && r3d.groundY; if (!g) return 0; const h = g(x, y); return typeof h === 'number' && h === h ? h : 0; };
  const blocked = (x, y) => !!(R.world && R.world.blocked && R.world.blocked(x, y));
  const pois = () => (R.world && R.world.pois) ? R.world.pois() : ((R.data && R.data.world && R.data.world.pois) || []);
  const roads = () => (R.world && R.world.roads) ? R.world.roads() : ((R.data && R.data.world && R.data.world.roads) || []);
  const PX = (p, i) => (p[i] != null ? p[i] : i ? p.y : p.x);
  // water: the blocked sea mask, the terrain under sea level, and 09b_water's rivers / lakes (R.water.isWater) when it is ready
  // (the frozen seas beyond the Wall are walkable snowfields: there only open rivers / lakes count, and the Wall's lands freeze those too)
  const FROZEN = { beyond: 1, winter: 1 };
  const wet = (x, y) => { const Wt = R.water; if (!Wt || !Wt.ready || typeof Wt.isWater !== 'function') return false;
    try { if (!Wt.isWater(x, y)) return false; const rg = R.world && R.world.regionAt ? R.world.regionAt(x, y) : null; return !(rg && FROZEN[rg.id]); } catch (e) { return false; } };
  const isWater = (x, y) => blocked(x, y) || gy(x, y) < SEA - 0.5 || wet(x, y);
  const nearWater = (x, y, r) => isWater(x + r, y) || isWater(x - r, y) || isWater(x, y + r) || isWater(x, y - r) || isWater(x + r * .7, y + r * .7) || isWater(x - r * .7, y - r * .7);
  const flat = (x, y, r, tol) => { const h = gy(x, y), t = tol || 3.5; return Math.abs(gy(x + r, y) - h) < t && Math.abs(gy(x - r, y) - h) < t && Math.abs(gy(x, y + r) - h) < t && Math.abs(gy(x, y - r) - h) < t; };

  /* ---------- geometry toolkit (vertex-coloured, flat shaded, merged into one BufferGeometry per prop) ---------- */
  let grng = mkRng(1);
  const _a = {}, _b = {}, _c = {};   // Colors, made when THREE is there
  const col3 = () => { if (!_a.c) { _a.c = new THREE.Color(); _b.c = new THREE.Color(); _c.c = new THREE.Color(); } };
  const grad = (lo, hi) => yy => _c.c.lerpColors(_a.c.setHex(lo), _b.c.setHex(hi), yy);
  const split = (lo, hi, at) => yy => _c.c.setHex(yy < at ? lo : hi);
  const snowTip = (lo, hi, from) => yy => yy > from ? _c.c.lerpColors(_a.c.setHex(hi), _b.c.setHex(0xe9f1f7), (yy - from) / (1 - from)) : _c.c.lerpColors(_a.c.setHex(lo), _b.c.setHex(hi), yy / from);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(sx, sy, sz));
  const cone = (r, h, seg) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg, open) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!open).translate(0, h / 2, 0);
  const ico = (r, det) => new THREE.IcosahedronGeometry(r, det);
  const oct = r => new THREE.OctahedronGeometry(r, 0);
  const box = (w, h, d, sx, sy, sz) => new THREE.BoxGeometry(w, h, d, sx || 1, sy || 1, sz || 1).translate(0, h / 2, 0);
  const quad = (w, h, segY) => new THREE.PlaneGeometry(w, h, 1, segY || 1).translate(0, h / 2, 0);
  const disc = (r, seg) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2);
  // paint: roughen (on the indexed geometry, so edges stay closed), transform, flat normals, a colour per vertex from a
  // hex / [lo, hi] gradient / fn(yy) by relative height, with ambient darkening at the foot and a per-face jitter
  function pt(src, col, o) {
    o = o || {}; col3();
    // roughness by a hash of the vertex POSITION: the copies of one corner (non-indexed ico / octa) move together, no cracks
    if (o.rough) { const p = src.attributes.position, ry = o.ry == null ? 1 : o.ry, sd = grng() * 1e4 | 0;
      const nz = (x, y, z, k) => ((h2(Math.round(x * 64) + k * 7919 + sd, Math.round(y * 64) * 31 + Math.round(z * 64) * 17) & 0xffff) / 65535 - .5);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + nz(x, y, z, 1) * o.rough, y + nz(x, y, z, 2) * o.rough * ry, z + nz(x, y, z, 3) * o.rough); } }
    let g;
    if (o.keepN) { g = src.index ? src.toNonIndexed() : src; if (g !== src) src.dispose(); if (o.m) { g.applyMatrix4(o.m); } }
    else if (o.smooth && src.index) { src.computeVertexNormals(); g = src.toNonIndexed(); src.dispose(); if (o.m) g.applyMatrix4(o.m); }
    else { g = src.index ? src.toNonIndexed() : src; if (g !== src) src.dispose(); if (o.m) g.applyMatrix4(o.m);
      if (o.smooth) { g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c); const ps = g.attributes.position, nr = new Float32Array(ps.count * 3), v = new THREE.Vector3();
        for (let i = 0; i < ps.count; i++) { v.set(ps.getX(i) - c.x, (ps.getY(i) - c.y) * 1.6, ps.getZ(i) - c.z).normalize(); nr[i * 3] = v.x; nr[i * 3 + 1] = v.y; nr[i * 3 + 2] = v.z; }
        g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); }
      else g.computeVertexNormals(); }
    g.computeBoundingBox();
    const bb = g.boundingBox, h = Math.max(1e-3, bb.max.y - bb.min.y), pos = g.attributes.position, n = pos.count, arr = new Float32Array(n * 3);
    const f = typeof col === 'function' ? col : Array.isArray(col) ? grad(col[0], col[1]) : (() => _c.c.setHex(col));
    const ao = o.ao == null ? .22 : o.ao, jit = o.smooth ? 0 : o.jit == null ? .08 : o.jit;
    for (let i = 0; i < n; i += 3) { const j = 1 + (grng() - .5) * 2 * jit; for (let k = 0; k < 3 && i + k < n; k++) { const v = i + k, yy = (pos.getY(v) - bb.min.y) / h, c = f(yy), m = (1 - ao * (1 - yy)) * j; arr[v * 3] = c.r * m; arr[v * 3 + 1] = c.g * m; arr[v * 3 + 2] = c.b * m; } }
    if (o.cav) for (let v = 0; v < n && v < o.cav.length; v++) { arr[v * 3] *= o.cav[v]; arr[v * 3 + 1] *= o.cav[v]; arr[v * 3 + 2] *= o.cav[v]; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (o.up) { const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0); }
    return g;
  }
  function merge(gs) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    for (const g of gs) { const c = g.attributes.position.count; P.set(g.attributes.position.array.subarray(0, c * 3), o * 3); Nn.set(g.attributes.normal.array.subarray(0, c * 3), o * 3); C.set(g.attributes.color.array.subarray(0, c * 3), o * 3); o += c; g.dispose(); }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
    out.computeBoundingSphere(); out.computeBoundingBox(); return out;
  }

  /* N1 (the integrator, 17:12: "pillows with holes"): a rock = an icosahedron pushed in and out along its directions by a seeded
     ridged noise (copies of one corner move together: no holes), the underside flattened and sunk, real smooth normals from the
     displaced faces (crevices read), and the hollows painted darker. sq = vertical squash. */
  function rockG(r, det, sq, col, mo) {
    const g = new THREE.IcosahedronGeometry(r, det), p = g.attributes.position, n = p.count, ph = []; for (let i = 0; i < 9; i++) ph.push(grng() * 6.283);
    const disp = new Float32Array(n), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize(); const x = v.x, y = v.y, z = v.z;
      let d = Math.sin(x * 2.3 + ph[0]) * Math.sin(y * 2.1 + ph[1]) * Math.sin(z * 2.5 + ph[2]) * .5 + Math.sin(x * 5.1 + ph[3]) * Math.sin(y * 4.7 + ph[4]) * Math.sin(z * 5.3 + ph[5]) * .3;
      d -= Math.abs(Math.sin(x * 9.1 + ph[6] + y * 3) * Math.sin(z * 8.3 + ph[7])) * .16;   // ridged cracks
      disp[i] = d; let R0 = r * (1 + d * .55), yy = y * R0 * sq; if (yy < -r * .28 * sq) yy = -r * .28 * sq - (yy + r * .28 * sq) * .08;   // a flat, sunk underside
      p.setXYZ(i, x * R0 * (1 + .15 * Math.sin(ph[8])), yy, z * R0); }
    // smooth normals by position (the non-indexed copies of a corner share one averaged normal)
    const key = i => Math.round(p.getX(i) * 50) + ',' + Math.round(p.getY(i) * 50) + ',' + Math.round(p.getZ(i) * 50), acc = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fnm = new THREE.Vector3();
    for (let i = 0; i + 2 < n; i += 3) { a.set(p.getX(i), p.getY(i), p.getZ(i)); b.set(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)); c.set(p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); fnm.subVectors(c, b).cross(a.sub(b));
      for (let k = 0; k < 3; k++) { const kk = key(i + k); let e = acc.get(kk); if (!e) acc.set(kk, e = [0, 0, 0]); e[0] += fnm.x; e[1] += fnm.y; e[2] += fnm.z; } }
    const nr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const e = acc.get(key(i)); v.set(e[0], e[1], e[2]).normalize(); nr[i * 3] = v.x; nr[i * 3 + 1] = v.y; nr[i * 3 + 2] = v.z; }
    g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
    const cav = new Float32Array(n); for (let i = 0; i < n; i++) cav[i] = Math.max(.5, Math.min(1.12, .86 + disp[i] * 1.1));
    return pt(g, col, { m: mo, keepN: true, cav, jit: 0, ao: .3 });
  }
  const TRUNK = [0x3a2718, 0x6a4a30], BARK = [0x4a3324, 0x7a5a3c], GREY = [0x3a2e26, 0x5e5044], WHITE = [0xcfc8bc, 0xf2ede4], CACT = [0x2e5a28, 0x5a9440], DRIFT = [0x7a6e60, 0xb8ae9e], SAND = [0x8a3a22, 0xd0784a];
  const crossQuads = (w, h, segY, c1, c2, third) => { const p = [pt(quad(w, h, segY), c1, { up: true }), pt(quad(w, h, segY), c2, { m: M(0, 0, 0, 0, Math.PI / 2, 0), up: true })]; if (third) p.push(pt(quad(w * .8, h * .85, segY), c1, { m: M(0, 0, 0, 0, Math.PI / 4, 0), up: true })); return merge(p); };
  const dots = (list, r, hex) => list.map(p => pt(oct(r), hex, { m: M(p[0], p[1], p[2]), ao: 0 }));

  /* ---------- the prop catalogue: h = sway height, sway = amplitude (× biome wind), bill = camera-facing, ds = double side,
     obst = obstacle radius (× scale), flat = needs level ground, shiny = Phong, glow = unlit, spin/hub = windmill blades ---------- */
  const PROPS = N.PROPS = {
    /* north */
    pine_l: { h: 100, sway: .9, obst: 6, mk: () => merge([pt(cyl(3.2, 6, 44, 6), TRUNK), pt(cone(24, 44, 7), snowTip(0x163a22, 0x2a6436, .8), { m: M(0, 28), rough: 1.6 }), pt(cone(18, 40, 7), snowTip(0x1a4228, 0x2f6c3a, .8), { m: M(0, 52), rough: 1.4 }), pt(cone(11, 32, 7), snowTip(0x1e4a2c, 0x347440, .7), { m: M(0, 72), rough: 1 })]) },
    pine_m: { h: 70, sway: .9, mk: () => merge([pt(cyl(2.6, 4.5, 28, 6), TRUNK), pt(cone(20, 34, 7), snowTip(0x183e24, 0x2c6838, .8), { m: M(0, 18), rough: 1.4 }), pt(cone(13, 30, 7), snowTip(0x1c4628, 0x30703c, .75), { m: M(0, 40), rough: 1.2 })]) },
    pine_s: { h: 44, sway: 1.1, mk: () => merge([pt(cyl(2, 3.2, 14, 5), TRUNK), pt(cone(16, 30, 6), snowTip(0x1a4226, 0x2e6c3a, .75), { m: M(0, 12), rough: 1.4 })]) },
    birch: { h: 56, sway: 1.3, mk: () => merge([pt(cyl(2.2, 3.4, 42, 6), [0xd8d4ca, 0xf2efe6]), pt(cyl(3.5, 3.5, 1.6, 6), 0x2a2826, { m: M(0, 9) }), pt(cyl(3.2, 3.2, 1.4, 6), 0x2a2826, { m: M(0, 19) }), pt(cyl(2.9, 2.9, 1.2, 6), 0x2a2826, { m: M(0, 30) }), pt(ico(10, 0), [0x8a7a2a, 0xe0c45a], { m: M(0, 44), rough: 3 }), pt(ico(7, 0), [0x8a7a2a, 0xe8cc60], { m: M(5, 37, 3), rough: 2.4 })]) },
    heather: { h: 10, sway: .6, mk: () => merge([pt(ico(7, 0), [0x4a4a3a, 0x8a5a9a], { m: M(0, 2, 0, 0, 0, 0, 1.2, .5, 1.2), rough: 2.5 }), pt(ico(6, 0), [0x4a5a3a, 0x9a62a8], { m: M(7, 1.5, 3, 0, .7, 0, 1.1, .45, 1.1), rough: 2 }), pt(ico(5, 0), [0x4a5a3a, 0x7a4e8a], { m: M(-6, 1.2, 4, 0, 1.4, 0, 1.1, .5, 1.1), rough: 2 })]) },
    boulder: { h: 0, tx: 'rock', obst: 11, mk: () => merge([rockG(10, 2, .72, [0x585a56, 0x92948c], M(0, 2.2, 0, 0, 0, 0, 1.2, 1, 1)), rockG(4.5, 1, .7, [0x585a56, 0x8a8c84], M(9, 1, 4))]) },
    drift: { h: 0, tx: 'snow', mk: () => merge([rockG(10, 2, .14, [0xc8d4de, 0xf4f8fb], M(0, -.9, 0, 0, 0, 0, 1.5, 1, 1)), rockG(5, 1, .16, [0xc8d4de, 0xf0f6fa], M(11, -.6, 5, 0, .6, 0, 1.3, 1, 1))]) },
    deadtree: { h: 50, sway: .3, mk: () => merge([pt(cyl(2.6, 5, 46, 6), GREY, { rough: .8 }), pt(cyl(1.2, 2.4, 22, 4), GREY, { m: M(0, 30, 0, 0, 0, -.9) }), pt(cyl(1, 2, 18, 4), GREY, { m: M(0, 38, 0, .8, 0, .7) }), pt(cyl(.8, 1.6, 12, 4), GREY, { m: M(0, 22, 0, -.6, 0, 1.1) })]) },
    /* the Wall / beyond */
    blackpine: { h: 80, sway: .8, obst: 6, mk: () => merge([pt(cyl(2.8, 5, 36, 6), [0x1a1410, 0x3a2e24]), pt(cone(19, 38, 7), snowTip(0x0e1a12, 0x1c3220, .85), { m: M(0, 22), rough: 1.6 }), pt(cone(13, 34, 7), snowTip(0x101e14, 0x203826, .8), { m: M(0, 44), rough: 1.3 }), pt(cone(7, 24, 6), snowTip(0x12201a, 0x243c2a, .7), { m: M(0, 62) })]) },
    iceshard: { h: 0, tx: 'ice', shiny: { specular: 0xffffff, shininess: 160, opacity: .82 }, mk: () => merge([pt(oct(5), [0x9ad0f0, 0xe8f8ff], { m: M(0, 12, 0, 0, 0, .12, 1, 3.2, 1), ao: .1 }), pt(oct(3.2), [0x9ad0f0, 0xe8f8ff], { m: M(5, 7, 3, .2, .8, -.25, 1, 2.6, 1), ao: .1 }), pt(oct(2.4), [0x9ad0f0, 0xe8f8ff], { m: M(-4, 5, -2, -.15, .4, .3, 1, 2.2, 1), ao: .1 })]) },
    pond: { h: 0, flat: true, shiny: { specular: 0xffffff, shininess: 220, opacity: .9 }, mk: () => merge([pt(disc(30, 12), [0xa8d0e8, 0xcfe8f6], { m: M(0, .6), rough: 4, ry: 0, ao: 0 })]) },
    weirwood: { h: 70, sway: .6, obst: 9, mk: () => merge([pt(cyl(4.5, 8, 38, 7), WHITE, { rough: 1 }), pt(cyl(1.6, 2.6, 16, 4), WHITE, { m: M(0, 26, 0, 0, 0, -1) }), pt(cyl(1.6, 2.6, 16, 4), WHITE, { m: M(0, 28, 0, .9, 0, .8) }), pt(ico(20, 1), [0x8a1820, 0xd83a3a], { m: M(0, 48, 0, 0, 0, 0, 1.3, .9, 1.3), rough: 4 }), pt(ico(11, 0), [0x8a1820, 0xe04848], { m: M(10, 40, -6), rough: 3 })]) },
    boulder_snow: { h: 0, tx: 'rock', obst: 11, mk: () => merge([rockG(10, 2, .75, yy => yy > .7 ? _c.c.setHex(0xdfe8ee) : _c.c.lerpColors(_a.c.setHex(0x52565a), _b.c.setHex(0x888e94), yy / .7), M(0, 2.2, 0, 0, 0, 0, 1.2, 1, 1)), rockG(4, 1, .7, [0x52565a, 0x82888e], M(-8, 1, 5))]) },
    /* riverlands */
    willow: { h: 64, sway: 1.5, obst: 6, ds: true, mk: () => merge([pt(cyl(3.6, 6.5, 36, 6), BARK, { rough: 1 }), pt(cone(24, 30, 8), [0x6a8a3a, 0x9ab85a], { m: M(0, 38), rough: 2 }), pt(cone(18, 26, 7), [0x6a8a3a, 0xa0c060], { m: M(9, 40, 4), rough: 2 }), pt(cone(16, 24, 7), [0x6a8a3a, 0x9ab85a], { m: M(-9, 42, -5), rough: 2 }), pt(cyl(25, 22, 30, 10, true), [0x9ab85a, 0x6a8a3a], { m: M(0, 12), rough: 2.4, ao: .05 })]) },
    reed: { h: 36, sway: 2.2, ds: true, mk: () => merge([pt(quad(3, 36, 2), [0x5a7a2a, 0xc8b860], { up: true }), pt(quad(3, 32, 2), [0x5a7a2a, 0xd0c070], { m: M(3, 0, 2, 0, 1.1, .1), up: true }), pt(quad(2.6, 30, 2), [0x5a7a2a, 0xb8a850], { m: M(-3, 0, 1, 0, 2.2, -.1), up: true }), pt(oct(1.6), 0x5a3a2a, { m: M(0, 35, 0, 0, 0, 0, 1, 2.2, 1) })]) },
    mill: { h: 0, obst: 18, spin: .9, hub: [40, 13.5], ds: true, mk: () => merge([pt(box(26, 30, 26), [0x6e6a60, 0x9e9888], { rough: .6 }), pt(cone(21, 16, 4), [0x3a2c22, 0x5a4634], { m: M(0, 30, 0, 0, Math.PI / 4, 0) }), pt(cyl(1.6, 1.6, 6, 5), [0x3a2c22, 0x5a4634], { m: M(0, 40, 11, Math.PI / 2, 0, 0) }), pt(box(5, 7, 1), 0x2a1e16, { m: M(0, 0, 13) }),
      pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2) }), pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2, 0, 0, Math.PI / 2) }), pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2, 0, 0, Math.PI) }), pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2, 0, 0, -Math.PI / 2) })]) },
    oak: { h: 66, sway: .9, obst: 7, mk: () => merge([pt(cyl(4.2, 7, 32, 6), BARK, { rough: 1.2 }), pt(cyl(2, 3, 14, 4), BARK, { m: M(0, 24, 0, 0, 0, -.8) }), pt(ico(22, 1), [0x2e6a26, 0x6aa842], { m: M(0, 46), rough: 4.5 }), pt(ico(14, 0), [0x2e6a26, 0x72b048], { m: M(14, 38, 6), rough: 3.5 }), pt(ico(12, 0), [0x2e6a26, 0x62a03c], { m: M(-13, 40, -5), rough: 3 })]) },
    bush: { h: 12, sway: .7, mk: () => merge([pt(ico(9, 0), [0x2c5226, 0x5a9040], { m: M(0, 3, 0, 0, 0, 0, 1.25, .75, 1.25), rough: 3.5 }), pt(ico(6, 0), [0x2c5226, 0x62984a], { m: M(8, 2, 4, 0, 0, 0, 1.1, .7, 1.1), rough: 2.5 })]) },
    /* vale */
    fir: { h: 80, sway: .7, obst: 5, mk: () => merge([pt(cyl(2.6, 4.6, 26, 6), TRUNK), pt(cone(15, 26, 6), [0x1e4a2c, 0x2e6a3c], { m: M(0, 14), rough: 1.2 }), pt(cone(12, 24, 6), [0x204c2e, 0x30703e], { m: M(0, 30), rough: 1 }), pt(cone(9, 22, 6), [0x22502f, 0x327440], { m: M(0, 46), rough: 1 }), pt(cone(5.5, 18, 6), snowTip(0x24522f, 0x347842, .6), { m: M(0, 62) })]) },
    spire: { h: 0, tx: 'rock', obst: 16, mk: () => merge([pt(cone(15, 112, 8), [0x5e636c, 0x9ca3ac], { rough: 4, ry: .2, smooth: true }), pt(cone(9, 60, 5), [0x5e636c, 0x8e959e], { m: M(12, 0, 6, 0, .6, -.15), rough: 3 }), pt(cone(7, 40, 5), [0x5e636c, 0x8e959e], { m: M(-10, 0, -5, .1, 1.3, .18), rough: 2.5 })]) },
    flower: { h: 9, sway: 1.4, ds: true, mk: () => crossQuads(5, 9, 3, split(0x4a7a2e, 0xb8c4ff, .62), split(0x4a7a2e, 0xd8e0ff, .62)) },
    shrub: { h: 10, sway: .6, mk: () => merge([pt(ico(8, 0), [0x3a5a30, 0x6a8a4a], { m: M(0, 2, 0, 0, 0, 0, 1.3, .65, 1.3), rough: 3 })]) },
    /* reach */
    orchard: { h: 30, sway: .8, mk: () => merge([pt(cyl(2.4, 3.6, 16, 5), BARK), pt(ico(12, 1), [0x3a7a2e, 0x7ab84a], { m: M(0, 24), rough: 2.4 })].concat(dots([[9, 27, 6], [-8, 29, 5], [4, 22, -10], [-6, 20, -8], [10, 20, 2], [-10, 25, -2]], 1.8, 0xd02a2a))) },
    wheat: { h: 18, sway: 2, ds: true, mk: () => crossQuads(14, 18, 2, [0x8a6a24, 0xe8c858], [0x8a6a24, 0xf0d060]) },
    poppy: { h: 10, sway: 1.6, ds: true, mk: () => crossQuads(6, 10, 3, split(0x4a7a2a, 0xd82a26, .62), split(0x4a7a2a, 0xe03a30, .62)) },
    rose: { h: 14, sway: .6, mk: () => merge([pt(ico(10, 1), [0x244a22, 0x3e7a36], { m: M(0, 4, 0, 0, 0, 0, 1.2, .8, 1.2), rough: 3 })].concat(dots([[7, 10, 4], [-6, 11, 3], [2, 13, -6], [-4, 8, -7], [8, 7, -2]], 1.6, 0xe0588a))) },
    /* crownlands */
    elm: { h: 76, sway: 1, obst: 6, mk: () => merge([pt(cyl(3.6, 5.6, 36, 6), BARK, { rough: 1 }), pt(ico(17, 1), [0x2c6428, 0x62a040], { m: M(0, 54, 0, 0, 0, 0, 1.1, 1.5, 1.1), rough: 3.5 }), pt(ico(10, 0), [0x2c6428, 0x6aa848], { m: M(9, 44, 5), rough: 2.5 })]) },
    hedge: { h: 12, sway: .3, mk: () => merge([pt(box(44, 12, 10, 4, 1, 1), [0x1e4a20, 0x3e7a34], { rough: 2 })]) },
    farm: { h: 0, obst: 20, mk: () => merge([pt(box(32, 18, 24), [0xa89270, 0xd8c8a0], { rough: .4 }), pt(cone(19, 15, 4), [0x4a3020, 0x7a5236], { m: M(0, 18, 0, 0, Math.PI / 4, 0, 1.45, 1, 1.15) }), pt(box(4, 10, 4), 0x5a5a5a, { m: M(9, 22, 4) }), pt(box(5, 9, 1.2), 0x3a2a20, { m: M(0, 0, 12.2) })]) },
    haystack: { h: 0, mk: () => merge([pt(cone(10, 15, 7), [0xa8862c, 0xe8c860], { rough: 2 }), pt(ico(3, 0), [0xa8862c, 0xe8c860], { m: M(0, 14) })]) },
    /* stormlands */
    benttree: { h: 60, sway: 1.4, obst: 6, mk: () => { const t = cyl(3.4, 5.6, 40, 6); t.applyMatrix4(new THREE.Matrix4().set(1, .5, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
      return merge([pt(t, BARK, { rough: 1 }), pt(ico(17, 1), [0x2a5a2c, 0x5a8a3e], { m: M(26, 44, 0, 0, 0, -.3, 1.5, .65, 1), rough: 3.5 }), pt(ico(9, 0), [0x2a5a2c, 0x5a8a3e], { m: M(36, 40, 4), rough: 2.5 })]); } },
    stump: { h: 0, mk: () => merge([pt(cyl(6, 7.5, 12, 7), [0x4a3828, 0x7a6448], { rough: 1 }), pt(cone(4.5, 11, 5), [0x5a4634, 0x8a7458], { m: M(2, 10, -1, .25, 0, -.3), rough: 1 }), pt(disc(6, 7), 0xb89a70, { m: M(0, 12.1), ao: 0 })]) },
    pool: { h: 0, flat: true, shiny: { specular: 0xffffff, shininess: 200, opacity: .78 }, mk: () => merge([pt(disc(18, 10), [0x2e3e4e, 0x4a6070], { m: M(0, .5, 0, 0, 0, 0, 1.3, 1, 1), rough: 3, ry: 0, ao: 0 })]) },
    gorse: { h: 10, sway: .6, mk: () => merge([pt(ico(8, 0), [0x203a1e, 0x4a6a34], { m: M(0, 2, 0, 0, 0, 0, 1.3, .7, 1.3), rough: 3.2 })].concat(dots([[5, 7, 3], [-6, 6, 2], [1, 8, -6]], 1.3, 0xe8d030))) },
    /* westerlands */
    goldtree: { h: 66, sway: 1, obst: 6, mk: () => merge([pt(cyl(3.8, 6, 32, 6), BARK, { rough: 1 }), pt(ico(20, 1), [0xa86a18, 0xf0c848], { m: M(0, 46), rough: 4 }), pt(ico(12, 0), [0xa86a18, 0xf8d050], { m: M(13, 38, 5), rough: 3 })]) },
    outcrop: { h: 0, tx: 'rock', obst: 20, mk: () => merge([rockG(14, 2, 1.5, [0x5e3626, 0x9e6a4c], M(0, 6, 0, .1, 0, -.15, 1, 1, .85)), rockG(10, 2, 1.2, [0x5e3626, 0x925e44], M(13, 3, 5, -.1, .7, .3)), rockG(7, 1, 1, [0x5a3828, 0x8a5e48], M(-11, 1.5, -6, .2, 1.4, -.2))]) },
    glint: { h: 0, glow: true, mk: () => merge([pt(oct(2.2), [0xd0a020, 0xfff0a0], { ao: 0, jit: .2 })]) },
    /* dorne */
    palm: { h: 62, sway: 1.6, obst: 4, ds: true, mk: () => { const p = [pt(cyl(2.8, 5, 54, 5), [0x6a4e30, 0xa88a60], { rough: 1 })];
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; p.push(pt(quad(9, 30, 2), [0x3a7a2e, 0x7ab848], { m: M(Math.cos(a) * 3, 54, Math.sin(a) * 3, 0, -a, 0).multiply(M(0, 0, 0, 1.15 + (k % 2) * .2, 0, 0)) })); }
      p.push(pt(oct(2.6), 0x8a5a30, { m: M(0, 53) })); return merge(p); } },
    cactus: { h: 0, mk: () => merge([pt(cyl(5, 6, 34, 7), CACT, { rough: .8 }), pt(cyl(3, 3, 11, 5), CACT, { m: M(5, 18, 0, 0, 0, -Math.PI / 2) }), pt(cyl(2.8, 3, 14, 5), CACT, { m: M(14, 18, 0) }), pt(cyl(2.6, 2.6, 8, 5), CACT, { m: M(-5, 22, 0, 0, 0, Math.PI / 2) }), pt(cyl(2.4, 2.6, 10, 5), CACT, { m: M(-12, 22, 0) }), pt(oct(1.6), 0xf0b0c0, { m: M(0, 34.5), ao: 0 })]) },
    pillar: { h: 0, tx: 'sand_red', obst: 12, mk: () => merge([pt(cyl(8, 12, 70, 9), SAND, { rough: 2.4, ry: .3, smooth: true }), pt(ico(10, 0), [0x8a3a22, 0xc06a40], { m: M(0, 70, 0, 0, 0, 0, 1.2, .5, 1.2), rough: 2 }), pt(cyl(5, 7, 28, 5), [0x8a3a22, 0xc87046], { m: M(13, 0, 4, 0, .5, 0), rough: 2 })]) },
    dune: { h: 0, tx: 'sand', mk: () => merge([pt(ico(60, 2), [0xc8a66a, 0xe8d0a0], { m: M(0, 0, 0, 0, 0, 0, 1, .16, .7), rough: 3, ao: .08, smooth: true })]) },
    drygrass: { h: 14, sway: 1.8, ds: true, mk: () => crossQuads(10, 14, 2, [0x9a7a3a, 0xe8d088], [0x9a7a3a, 0xe0c880], true) },
    /* iron islands / coast */
    wetrock: { h: 0, tx: 'rock_dark', obst: 13, shiny: { specular: 0x6a747c, shininess: 60 }, mk: () => merge([rockG(12, 2, .55, [0x464e54, 0x76828a], M(0, 1.6, 0, 0, 0, 0, 1.3, 1, 1)), rockG(6.5, 1, .6, [0x464e54, 0x707c84], M(11, 1, 6, 0, 0, 0, 1.2, 1, 1))]) },
    driftwood: { h: 0, mk: () => merge([pt(cyl(2.4, 4, 42, 5), DRIFT, { m: M(0, 3, 0, 0, 0, Math.PI / 2 - .08), rough: 1 }), pt(cyl(1.2, 2, 14, 4), DRIFT, { m: M(-10, 4, 0, .5, 0, -.9) })]) },
    seastack: { h: 0, tx: 'rock_dark', obst: 18, mk: () => merge([pt(cyl(9, 17, 92, 9), [0x4a5056, 0x7a8288], { rough: 3.4, ry: .2, smooth: true }), pt(ico(10, 0), [0x2a2e32, 0x5a6068], { m: M(0, 92, 0, 0, 0, 0, 1.1, .6, 1.1), rough: 3 }), pt(ico(2.2, 0), 0xf4f4f4, { m: M(3, 98, 2), ao: 0 }), pt(ico(2, 0), 0xf4f4f4, { m: M(-4, 97, -2), ao: 0 }), pt(oct(2.4), 0xe8ecee, { m: M(6, 50, 9, 0, 0, 0, 1, .3, 1), ao: 0 })]) },
    perch: { h: 28, sway: .2, mk: () => merge([pt(cyl(1.4, 2, 26, 5), [0x4a3a2a, 0x7a6a56], { m: M(0, 0, 0, 0, 0, .08) }), pt(ico(3, 0), 0xf4f4f4, { m: M(2, 28, 0, 0, 0, 0, 1.3, 1, .9), ao: .05 }), pt(ico(1.8, 0), 0xf4f4f4, { m: M(4.6, 30.5, 0), ao: .05 }), pt(oct(.9), 0xe0a020, { m: M(6.3, 30.3, 0, 0, 0, 0, 1.4, .6, .6), ao: 0 }), pt(quad(3, 4, 1), 0x3a3a3a, { m: M(2, 29, 1.2, 0, 0, 1.1), ao: 0 })]) },
    seagrass: { h: 14, sway: 1.8, ds: true, mk: () => crossQuads(10, 14, 2, [0x4a6a4a, 0x9ab08a], [0x4a6a4a, 0xa0b890]) },
    /* G2: the details that make each place its own */
    menhir: { h: 0, tx: 'rock', obst: 9, mk: () => merge([pt(box(12, 46, 7, 1, 3, 1), [0x4a4c4a, 0x8a8e88], { rough: 2.2, ry: .4 }), pt(box(6, 3, 4), [0x3a5a32, 0x5a7a46], { m: M(2, 44, 0, .2, .3, .1), ao: 0 })]) },
    firdark: { h: 96, sway: .6, obst: 6, mk: () => merge([pt(cyl(2.8, 5, 30, 6), [0x22180f, 0x3e2c1c]), pt(cone(17, 30, 7), [0x0c2214, 0x173a22], { m: M(0, 16), rough: 1.3 }), pt(cone(14, 28, 7), [0x0e2616, 0x1a4026], { m: M(0, 34), rough: 1.1 }), pt(cone(10, 26, 6), [0x10281a, 0x1c4428], { m: M(0, 52), rough: 1 }), pt(cone(6, 22, 6), [0x122c1a, 0x1e482a], { m: M(0, 70) })]) },
    fern: { h: 8, sway: 1.2, ds: true, mk: () => crossQuads(12, 8, 2, [0x1e3a1a, 0x3e6a30], [0x1e3a1a, 0x46723a], true) },
    mushroom: { h: 0, mk: () => merge([pt(cyl(.9, 1.2, 4, 5), 0xe8e0d0, { ao: .05 }), pt(cone(3, 2.4, 7), [0x8a2a1a, 0xc8402a], { m: M(0, 4) }), pt(cyl(.7, .9, 3, 5), 0xe8e0d0, { m: M(4, 0, 2), ao: .05 }), pt(cone(2.2, 1.8, 6), [0x8a2a1a, 0xc8402a], { m: M(4, 3, 2) })]) },
    vine: { h: 14, sway: .5, mk: () => merge([pt(box(1.4, 16, 1.4), [0x4a3420, 0x6a4c30]), pt(box(30, .8, .8), 0x5a4a3a, { m: M(0, 13) }), pt(ico(5, 0), [0x2e5a22, 0x5a8a3a], { m: M(-9, 10, 0, 0, 0, 0, 1.3, 1, .8), rough: 1.8 }), pt(ico(5, 0), [0x2e5a22, 0x5a8a3a], { m: M(0, 11, 0, 0, 0, 0, 1.3, 1, .8), rough: 1.8 }), pt(ico(5, 0), [0x2e5a22, 0x5a8a3a], { m: M(9, 10, 0, 0, 0, 0, 1.3, 1, .8), rough: 1.8 })].concat(dots([[-8, 7, 3], [1, 8, 3], [8, 7, 3], [-3, 7, -3]], 1.5, 0x5a2a6a))) },
    sunflower: { h: 20, sway: 1.2, ds: true, mk: () => merge([pt(cyl(.6, .8, 18, 4), 0x4a6a2a), pt(cyl(3.4, 3.4, .8, 8), 0xf0c020, { m: M(0, 18, .6, Math.PI / 2 - .3, 0, 0), ao: 0 }), pt(cyl(1.6, 1.6, 1, 8), 0x4a2a10, { m: M(0, 18.2, 1.1, Math.PI / 2 - .3, 0, 0), ao: 0 })]) },
    scree: { h: 0, tx: 'rock', mk: () => merge([pt(ico(4, 1), [0x6a6e72, 0x9aa0a4], { m: M(0, 1.5, 0, 0, 0, 0, 1.3, .6, 1), rough: 1.2 }), pt(ico(3, 0), [0x6a6e72, 0xa0a6aa], { m: M(7, 1, 3, 0, 0, 0, 1.2, .6, 1), rough: 1 }), pt(ico(2.4, 0), [0x6a6e72, 0x9aa0a4], { m: M(-6, 1, 4), rough: .8 }), pt(ico(3.2, 0), [0x5e6266, 0x8e9498], { m: M(3, 1, -7, 0, 0, 0, 1.2, .5, 1), rough: 1 }), pt(ico(2, 0), [0x6a6e72, 0x9aa0a4], { m: M(-4, .8, -5) })]) },
    scrub: { h: 9, sway: .8, mk: () => merge([pt(ico(6, 0), [0x6a5a30, 0xa89a58], { m: M(0, 2, 0, 0, 0, 0, 1.3, .7, 1.3), rough: 3 }), pt(ico(4, 0), [0x6a5a30, 0xb0a060], { m: M(6, 1.5, 3), rough: 2 }), pt(cyl(.4, .6, 9, 3), 0x5a4a30, { m: M(-4, 0, -3, .3, 0, .4) })]) },
    basalt: { h: 0, tx: 'rock_dark', obst: 12, mk: () => merge([pt(cyl(6, 6.5, 34, 6), [0x141214, 0x3a3436], { rough: .6, ry: 0 }), pt(cyl(5, 5.5, 24, 6), [0x141214, 0x342e30], { m: M(10, 0, 4), rough: .5, ry: 0 }), pt(cyl(5.5, 6, 16, 6), [0x141214, 0x302a2c], { m: M(-8, 0, 6), rough: .5, ry: 0 }), pt(cyl(4.5, 5, 28, 6), [0x141214, 0x3a3436], { m: M(2, 0, -9), rough: .5, ry: 0 })]) },
    ashtree: { h: 46, sway: .2, mk: () => merge([pt(cyl(2.4, 4.6, 42, 6), [0x0e0c0c, 0x2a2422], { rough: .8 }), pt(cyl(1, 2, 18, 4), [0x0e0c0c, 0x2a2422], { m: M(0, 28, 0, 0, 0, -1) }), pt(cyl(.9, 1.8, 15, 4), [0x0e0c0c, 0x2a2422], { m: M(0, 34, 0, .9, 0, .8) }), pt(oct(1.2), 0xff6a20, { m: M(1.5, 12, 2.5), ao: 0 })]) },
    embers: { h: 0, glow: true, mk: () => merge([pt(disc(5, 6), [0x8a2a0a, 0xff7a2a], { m: M(0, .6), ao: 0, jit: .3 }), pt(oct(1.2), 0xffb050, { m: M(2, 1.4, 1), ao: 0 }), pt(oct(1), 0xffd070, { m: M(-2, 1.2, -1), ao: 0 })]) },
    bogpool: { h: 0, flat: true, shiny: { specular: 0x9aa890, shininess: 120, opacity: .85 }, mk: () => merge([pt(disc(22, 10), [0x2a3a26, 0x3e5236], { m: M(0, .5, 0, 0, 0, 0, 1.4, 1, 1), rough: 4, ry: 0, ao: 0 })]) },
    cattail: { h: 30, sway: 2, ds: true, mk: () => merge([pt(quad(2, 28, 2), [0x3a5a22, 0x7a8a3a], { up: true }), pt(quad(2, 24, 2), [0x3a5a22, 0x7a8a3a], { m: M(3, 0, 1, 0, 1.3, .12), up: true }), pt(cyl(1.1, 1.1, 6, 5), 0x5a3418, { m: M(0, 26) }), pt(cyl(1, 1, 5, 5), 0x5a3418, { m: M(3.6, 21, 1.2, 0, 0, .12) })]) },
    /* N1: ground clutter near the camera (the near field, not the chunks): small, varied, never colliders */
    pebbles: { h: 0, tx: 'rock', mk: () => merge([pt(ico(2.2, 1), [0x6e7276, 0xa4aaae], { m: M(0, .7, 0, 0, 0, 0, 1.3, .55, 1), rough: .5, smooth: true }), pt(ico(1.5, 0), [0x6a6e72, 0xa8acb0], { m: M(4, .5, 2, 0, .4, 0, 1.2, .6, 1), rough: .4 }),
      pt(ico(1.1, 0), [0x5a5e62, 0x8e9498], { m: M(-3, .4, 3), rough: .3 }), pt(ico(1.8, 0), [0x62666a, 0x9a9ea2], { m: M(1, .5, -4, 0, 1, 0, 1.3, .5, 1), rough: .4 }), pt(ico(.9, 0), [0x6a6e72, 0xa0a4a8], { m: M(-4.5, .3, -2) })]) },
    pebbles_snow: { h: 0, tx: 'rock', mk: () => merge([rockG(2.4, 1, .6, yy => yy > .55 ? _c.c.setHex(0xe8eef3) : _c.c.lerpColors(_a.c.setHex(0x6a6e72), _b.c.setHex(0x9aa0a6), yy / .55), M(0, .3, 0, 0, 0, 0, 1.3, 1, 1)),
      rockG(1.6, 1, .6, yy => yy > .55 ? _c.c.setHex(0xe8eef3) : _c.c.lerpColors(_a.c.setHex(0x6a6e72), _b.c.setHex(0x9aa0a6), yy / .55), M(4, .2, 2)), rockG(1.2, 0, .7, [0x70747a, 0xa0a6ac], M(-3, .2, 3))]) },
    twigs: { h: 0, mk: () => merge([pt(cyl(.35, .5, 13, 4), [0x6a5440, 0x9a8060], { m: M(-6, .5, 0, 0, .3, Math.PI / 2 - .04) }), pt(cyl(.28, .4, 9, 3), [0x6a5440, 0x907458], { m: M(-2, .5, 3, 0, 1.9, Math.PI / 2) }),
      pt(cyl(.22, .32, 6, 3), [0x705a44, 0x98805e], { m: M(1, .45, -3, 0, -1.1, Math.PI / 2 + .05) }), pt(cyl(.2, .3, 4, 3), [0x705a44, 0x98805e], { m: M(3, .9, 1, .3, .6, Math.PI / 2 - .4) })]) },
    log: { h: 0, mk: () => merge([pt(cyl(3.2, 3.8, 44, 7), [0x5a4632, 0x8a7052], { m: M(-22, 3.2, 0, 0, 0, -Math.PI / 2), rough: .7 }), pt(disc(3.2, 7), 0xa08060, { m: M(22.2, 3.2, 0, 0, 0, -Math.PI / 2), ao: 0 }),
      pt(cyl(.9, 1.4, 10, 4), [0x3e2e20, 0x6a5038], { m: M(-6, 5.5, 1, -.9, 0, -.5) }), pt(ico(3, 0), [0x2e5222, 0x5a8a3a], { m: M(-9, 6.2, 0, 0, 0, 0, 3.2, .35, 1), rough: .8, ao: 0 }), pt(ico(2.2, 0), [0x2e5222, 0x4a7a30], { m: M(10, 6, -.5, 0, 0, 0, 2.4, .3, 1), rough: .6, ao: 0 })]) },
    roots: { h: 0, mk: () => merge([0, 1.4, 2.6, 4.1, 5.2].map((a, i) => pt(cyl(.5, 1.6, 12 + i * 2, 4), [0x5e4a36, 0x8a7052], { m: M(Math.cos(a) * 6, .4, Math.sin(a) * 6, 0, -a, Math.PI / 2 - .12), rough: .3 }))) },
    moss: { h: 0, flat: true, mk: () => merge([pt(disc(9, 9), [0x2e4a1e, 0x4e7a2e], { m: M(0, .35, 0, 0, 0, 0, 1.3, 1, 1), rough: 2.2, ry: 0, ao: 0 }), pt(ico(2.4, 0), [0x3a5a26, 0x5e8a3a], { m: M(3, .3, 2, 0, 0, 0, 1.6, .35, 1.2), ao: 0 }), pt(ico(1.8, 0), [0x3a5a26, 0x5a8236], { m: M(-4, .3, -2, 0, 0, 0, 1.6, .35, 1.2), ao: 0 })]) },
    litter: { h: 0, flat: true, mk: () => { const L = []; for (let i = 0; i < 9; i++) { const a = i * 2.39, d = 2 + (i % 4) * 2.2; L.push(pt(quad(2.2, 1.6), [0x8a4a1e, i % 3 ? 0xc87a2a : 0xd8a03a], { m: M(Math.cos(a) * d, .25 + i * .02, Math.sin(a) * d, -Math.PI / 2, 0, a), ao: 0, jit: .2 })); } return merge(L); } },
    snowtuft: { h: 0, tx: 'snow', mk: () => merge([pt(ico(4, 1), [0xd8e2ea, 0xffffff], { m: M(0, .6, 0, 0, 0, 0, 1.5, .4, 1.1), rough: .8, ao: .1, smooth: true }), pt(ico(2.6, 1), [0xd8e2ea, 0xffffff], { m: M(5, .4, 2, 0, 0, 0, 1.4, .4, 1), rough: .5, ao: .1, smooth: true }),
      pt(quad(.6, 5), [0x5a5a3a, 0x8a8a5a], { m: M(-2, 0, 1, 0, .4, .2), up: true, ao: 0 }), pt(quad(.6, 4), [0x5a5a3a, 0x8a8a5a], { m: M(-1, 0, -1, 0, 1.6, -.15), up: true, ao: 0 })]) },
    wildf: { h: 9, sway: 1.4, ds: true, mk: () => crossQuads(5, 9, 3, split(0x4a7a2e, 0xf0f0f0, .62), split(0x4a7a2e, 0xf0e060, .62)) },
    icefield: { h: 0, flat: true, shiny: { specular: 0xffffff, shininess: 240, opacity: .7 }, mk: () => merge([pt(disc(46, 9), [0xb8dcf0, 0xe4f4fc], { m: M(0, .4, 0, 0, 0, 0, 1.5, 1, .9), rough: 6, ry: 0, ao: 0 })]) },
    autumnoak: { h: 64, sway: .9, obst: 6, mk: () => merge([pt(cyl(4, 6.6, 30, 6), BARK, { rough: 1.2 }), pt(ico(20, 1), [0x8a3a18, 0xd0782a], { m: M(0, 44), rough: 4 }), pt(ico(12, 0), [0x8a3a18, 0xe08a30], { m: M(-12, 38, 6), rough: 3 })]) },
    /* the grass tuft (global, camera-facing, tinted per biome) */
    tuft: { h: 12, sway: 2.4, bill: true, ds: true, mk: () => { const g = quad(11, 12, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i) / 12; p.setX(i, p.getX(i) * (1 - .72 * yy)); } return merge([pt(g, [0x707868, 0xf0f4e0], { up: true, ao: .1 })]); } }
  };

  /* ---------- the biome recipes. Entry: {t, n, place?, lod?, clump?, off?, s:[min,max]?, yaw:[base,spread]?, tilt?, tint?, …}
     place: scatter (default) | water | road | rows | field | edge | grove | anchor. lod 0 = near chunks only. ---------- */
  const BIOMES = N.BIOMES = {
    north: { wind: .35, ground: 0x5e6a5c, grass: [.72, .8, .74], props: [
      { t: 'pine_l', n: 34, clump: .42, off: 1 }, { t: 'pine_m', n: 40, clump: .36, off: 1 }, { t: 'pine_s', n: 28, clump: .3, off: 1 }, { t: 'birch', n: 22, clump: -.5, off: 1 },
      { t: 'heather', n: 60, lod: 0, clump: .3, off: 4, tint: [.92, .8, .74] }, { t: 'boulder_snow', n: 10, tilt: .25 }, { t: 'drift', n: 10, lod: 0, s: [.5, .9] }, { t: 'deadtree', n: 6 },
      { t: 'menhir', place: 'grove', k: 1, m: [4, 6], r: 46, chance: .45, s: [.8, 1.25], tilt: .12 }],
      say: ['Pines and old snow. Wolves sing at night.', 'Birch and heather under a grey sky. The cold bites early.'] },
    wolfswood: { wind: .3, ground: 0x34463a, grass: [.42, .6, .44], grassK: .55, props: [
      { t: 'firdark', n: 70, clump: -.7, off: 21, s: [.85, 1.35] }, { t: 'firdark', n: 30, s: [.6, .9] }, { t: 'pine_l', n: 18, clump: .2, off: 22 }, { t: 'deadtree', n: 6, s: [.8, 1.1] },
      { t: 'fern', n: 70, lod: 0, s: [.8, 1.4] }, { t: 'mushroom', n: 24, lod: 0, s: [.8, 1.6] }, { t: 'boulder', n: 8, tint: [.6, .72, .6], tilt: .3 }, { t: 'drift', n: 8, lod: 0, s: [.6, 1] }],
      say: ['The Wolfswood: firs so close the snow never reaches the ground.', 'Ferns and red caps under black branches. Something watches from the trees.'] },
    wall: { wind: .4, ground: 0xb8c4cc, grass: [.8, .86, .9], grassK: .25, props: [
      { t: 'icefield', n: 4, s: [.8, 1.5] },
      { t: 'blackpine', n: 22, clump: .55, off: 2 }, { t: 'boulder_snow', n: 10, tilt: .2 }, { t: 'weirwood', place: 'grove', k: 2, m: [3, 5], r: 70, s: [.8, 1.2] },
      { t: 'scree', n: 18, lod: 0, tint: [1.05, 1.08, 1.12] }, { t: 'pond', n: 5, lod: 0, s: [.8, 1.5] }, { t: 'drift', n: 20, lod: 0, s: [.6, 1.2] }],
      say: ['Black pines and ice. The wind comes from beyond.', 'Frozen ponds and white trees with red leaves. Nothing moves.'] },
    beyond: { wind: .45, ground: 0xc8d4dc, grass: [.8, .86, .92], grassK: .15, props: [
      { t: 'icefield', n: 5, s: [.9, 1.6] },
      { t: 'blackpine', n: 12, clump: .6, off: 3 }, { t: 'boulder_snow', n: 14, tilt: .2 }, { t: 'weirwood', place: 'grove', k: 2, m: [3, 5], r: 80, s: [.9, 1.3] },
      { t: 'iceshard', n: 14, lod: 0, s: [.35, .7] }, { t: 'pond', n: 6, lod: 0, s: [.9, 1.6] }, { t: 'drift', n: 36, lod: 0, s: [1, 2] }, { t: 'deadtree', n: 8, s: [.7, 1] }],
      say: ['Ice shards and dead groves. The old gods watch.', 'Snow to the horizon. The wind never stops.'] },
    winter: { wind: .6, ground: 0xe2ecf2, grass: [.86, .9, .96], grassK: .06, props: [
      { t: 'icefield', n: 9, s: [1, 2] }, { t: 'iceshard', n: 20, lod: 0, s: [.4, .8], tilt: .2 }, { t: 'drift', n: 44, lod: 0, s: [1.2, 2.4] }, { t: 'boulder_snow', n: 8, s: [1, 1.6] },
      { t: 'weirwood', place: 'grove', k: 1, m: [2, 3], r: 50, chance: .3, s: [.7, 1] }, { t: 'deadtree', n: 4, tint: [.8, .85, .95] }],
      say: ['White on white. The ice hums underfoot.', 'Blue ice spires and nothing else. Even the wind sounds cold.'] },
    riverlands: { wind: 1, ground: 0x4e7a3a, grass: [.5, .92, .4], props: [
      { t: 'willow', n: 30, place: 'water', r: 70 }, { t: 'oak', n: 24, clump: .45, off: 5 }, { t: 'mill', n: 2, place: 'road', min: 40, max: 220, s: [1, 1.2] },
      { t: 'reed', n: 70, lod: 0, place: 'water', r: 40, s: [.8, 1.3] }, { t: 'boulder', n: 8, tint: [.78, .95, .72], tilt: .2 }, { t: 'bush', n: 24, lod: 0 },
      { t: 'pool', n: 6, lod: 0, s: [.8, 1.4] }, { t: 'flower', n: 40, lod: 0, clump: -.5, off: 23, tint: 'meadow' }],
      say: ['Willows trail in the water. Mills turn by the road.', 'Reeds whisper along the banks. Frogs call at dusk.'] },
    neck: { wind: .8, ground: 0x3e5232, grass: [.42, .62, .34], props: [
      { t: 'bogpool', n: 16, s: [.8, 1.8] }, { t: 'cattail', n: 80, lod: 0, s: [.8, 1.3] }, { t: 'reed', n: 40, lod: 0, place: 'water', r: 40 }, { t: 'willow', n: 12, s: [.7, 1], tint: [.8, .85, .7] },
      { t: 'deadtree', n: 14, tint: [.7, .8, .7], s: [.7, 1.1] }, { t: 'stump', n: 10, tint: [.7, .8, .7] }, { t: 'mushroom', n: 14, lod: 0 }],
      say: ['The Neck: black water, reeds and a causeway nobody trusts.', 'Bog pools and drowned trees. The ground moves when you stand still.'] },
    vale: { wind: .9, ground: 0x6a7a5a, grass: [.62, .86, .5], props: [
      { t: 'fir', n: 50, clump: .4, off: 6 }, { t: 'spire', n: 7, s: [.7, 1.3] }, { t: 'boulder', n: 14, tilt: .3 },
      { t: 'flower', n: 60, lod: 0, clump: -.55, off: 6, tint: 'bluewhite' }, { t: 'shrub', n: 20, lod: 0 }, { t: 'scree', n: 50, lod: 0, s: [.8, 1.8], clump: .35, off: 24 }, { t: 'pine_s', n: 16, s: [.7, 1] }],
      say: ['Firs and grey spires. Eagles wheel above.', 'Mountain flowers between the rocks. The air is thin.'] },
    reach: { wind: 1, ground: 0x6a9a3c, grass: [.46, .9, .34], props: [
      { t: 'oak', n: 16, clump: .58, off: 7 }, { t: 'orchard', place: 'rows', rows: 3, gap: 44, rgap: 48, from: 150, max: 60, s: [.9, 1.1] }, { t: 'boulder', n: 4 },
      { t: 'wheat', lod: 0, place: 'field', fields: 3, w: [180, 260], d: [120, 180], gap: 22, tol: 14 }, { t: 'poppy', n: 50, lod: 0, clump: -.5, off: 8 }, { t: 'rose', n: 18, lod: 0 },
      { t: 'vine', place: 'rows', rows: 4, gap: 34, rgap: 26, from: 230, max: 64, s: [.9, 1.1] }, { t: 'sunflower', n: 30, lod: 0, clump: .5, off: 25, s: [.8, 1.2] }],
      say: ['Oaks and wheat to the horizon. Bees in the roses.', 'Orchards in neat rows. Poppies at the field\'s edge.'] },
    crownlands: { wind: 1, ground: 0x7a9448, grass: [.52, .88, .38], props: [
      { t: 'elm', n: 26, clump: .35, off: 9 }, { t: 'farm', n: 2, place: 'road', min: 50, max: 260, s: [.9, 1.15] }, { t: 'haystack', n: 3, place: 'anchor', of: 'farm', r: 40, s: [.8, 1.2] },
      { t: 'wheat', lod: 0, place: 'field', fields: 2, w: [160, 240], d: [110, 170], gap: 24, tol: 14 }, { t: 'hedge', lod: 0, place: 'edge', gap: 44 }, { t: 'bush', n: 16, lod: 0 },
      { t: 'oak', n: 12, clump: .4, off: 26 }, { t: 'pine_m', n: 8, clump: .5, off: 27, tint: [.85, 1, .85] }],
      say: ['Farms and hedges. Smoke from a chimney.', 'Elms along the lanes. Hay drying in the sun.'] },
    kingswood: { wind: .9, ground: 0x3e6030, grass: [.42, .74, .32], props: [
      { t: 'oak', n: 40, clump: -.75, off: 28, s: [.9, 1.4] }, { t: 'elm', n: 26, s: [.9, 1.3] }, { t: 'pine_m', n: 18, clump: .25, off: 29, tint: [.85, 1, .85] }, { t: 'stump', n: 8 },
      { t: 'fern', n: 60, lod: 0 }, { t: 'bush', n: 30, lod: 0 }, { t: 'mushroom', n: 10, lod: 0 }],
      say: ['The Kingswood: oak and elm thick enough to hide an army.', 'Deer trails between old oaks. Outlaws know every one.'] },
    stormlands: { wind: 1.8, ground: 0x4a6a3e, grass: [.4, .72, .36], props: [
      { t: 'benttree', n: 28, clump: .4, off: 10, yaw: [-.6, .35] }, { t: 'stump', n: 18, tilt: .15 }, { t: 'boulder', n: 10, tilt: .3 }, { t: 'deadtree', n: 8 },
      { t: 'pool', n: 12, lod: 0, s: [.8, 1.8] }, { t: 'gorse', n: 30, lod: 0 }],
      say: ['Wind-bent trees and broken stumps. Rain is coming.', 'Pools from the last storm. The sky hangs low.'] },
    westerlands: { wind: 1, ground: 0x8a7a4a, grass: [.7, .8, .4], props: [
      { t: 'oak', n: 30, clump: .4, off: 11 }, { t: 'autumnoak', n: 14, clump: .5, off: 30, tint: [1.3, .82, .5] }, { t: 'goldtree', n: 8, tint: [1.25, 1.05, .55] }, { t: 'outcrop', n: 9, s: [.8, 1.5], tilt: .1 }, { t: 'boulder', n: 8, tint: [1, .78, .66] },
      { t: 'scree', n: 20, lod: 0, tint: [1, .75, .6] },
      { t: 'glint', n: 3, lod: 0, place: 'anchor', of: 'outcrop', r: 12, dy: [8, 26], s: [.8, 1.4] }, { t: 'bush', n: 18, lod: 0 }],
      say: ['Gold-leafed trees over red rock. Ore glints in the stone.', 'Outcrops and old mine mouths. Hills roll west.'] },
    dorne: { wind: 1, ground: 0xd8b878, grass: [1, .9, .55], props: [
      { t: 'palm', n: 22, place: 'water', r: 90, s: [.8, 1.25] }, { t: 'palm', n: 8 }, { t: 'pillar', n: 6, s: [.7, 1.4] }, { t: 'cactus', n: 24, s: [.6, 1.2] },
      { t: 'drygrass', n: 50, lod: 0, clump: .3, off: 12 }, { t: 'scrub', n: 30, lod: 0 }],
      say: ['Palms and red sandstone. Heat shimmers on the dunes.', 'Cacti and dry grass. Sand in everything.'] },
    redmts: { wind: 1.2, ground: 0xb06a40, grass: [1, .78, .5], grassK: .3, props: [
      { t: 'pillar', n: 14, s: [.7, 1.6] }, { t: 'outcrop', n: 12, s: [.9, 1.6], tilt: .15 }, { t: 'scrub', n: 40, lod: 0, s: [.8, 1.3] }, { t: 'scree', n: 40, lod: 0, tint: [1, .7, .55], s: [.9, 2] },
      { t: 'deadtree', n: 6, tint: [1, .85, .7] }, { t: 'drygrass', n: 26, lod: 0 }],
      say: ['Red rock and dry valleys. Every shadow is a hiding place.', 'Scrub, scree and a sky without clouds.'] },
    ironislands: { wind: 1.6, ground: 0x4a5048, grass: [.56, .66, .58], grassK: .4, props: [
      { t: 'wetrock', n: 36, tilt: .25 }, { t: 'seastack', n: 5, s: [.7, 1.3] }, { t: 'driftwood', n: 16, lod: 0 }, { t: 'perch', n: 6, lod: 0 }, { t: 'seagrass', n: 24, lod: 0 },
      { t: 'boulder', n: 14, tint: [.75, .78, .82], tilt: .3, s: [.8, 1.6] }, { t: 'scree', n: 26, lod: 0, tint: [.8, .82, .86] }],
      say: ['Black wet rock and driftwood. Gulls scream.', 'Sea stacks in the spray. Salt on the wind.'] },
    coast: { wind: 1.6, ground: 0x6a7a62, grass: [.58, .76, .58], props: [
      { t: 'wetrock', n: 30, place: 'water', r: 60, tilt: .25 }, { t: 'seastack', n: 4, place: 'water', r: 90, s: [.7, 1.3] }, { t: 'benttree', n: 8, yaw: [2.2, .35] },
      { t: 'driftwood', n: 18, lod: 0, place: 'water', r: 60 }, { t: 'perch', n: 8, lod: 0 }, { t: 'seagrass', n: 50, lod: 0 }],
      say: ['Driftwood and wet stones. Gulls on every perch.', 'Sea stacks and salt grass. The tide is turning.'] },
    dragonstone: { wind: 1.3, ground: 0x2e2a2a, grass: [.5, .56, .46], grassK: .35, props: [
      { t: 'basalt', n: 12, s: [.7, 1.5] }, { t: 'ashtree', n: 18, s: [.8, 1.2] }, { t: 'wetrock', n: 18, tilt: .25, tint: [.7, .66, .66] }, { t: 'embers', n: 10, lod: 0, s: [.8, 1.4] },
      { t: 'pine_s', n: 26, clump: .35, off: 31, tint: [.8, .9, .8] }, { t: 'scree', n: 30, lod: 0, tint: [.4, .38, .38] }, { t: 'drygrass', n: 20, lod: 0, tint: [.6, .6, .5] }],
      say: ['Black rock, ash and a warm wind out of the ground.', 'Burnt trees on the slopes. The stone is warm to the touch.'] },
    crackclaw: { wind: 1.2, ground: 0x3e4a36, grass: [.5, .66, .44], props: [
      { t: 'pine_m', n: 40, clump: -.4, off: 32, tint: [.85, .95, .85] }, { t: 'pine_s', n: 30, s: [.7, 1.1] }, { t: 'deadtree', n: 6 }, { t: 'boulder', n: 16, tilt: .3, tint: [.8, .82, .8] },
      { t: 'fern', n: 30, lod: 0 }, { t: 'gorse', n: 24, lod: 0 }, { t: 'driftwood', n: 6, lod: 0, place: 'water', r: 60 }],
      say: ['Crackclaw Point: crooked pines and bog, and no lord anyone obeys.', 'Pine needles and sea wind. Every path ends at a cliff.'] }
  };
  N.describe = (x, y) => { const b = BIOMES[N.biomeAt(x, y)] || BIOMES.reach; return b.say[h2(Math.floor(x / 900), Math.floor(y / 900)) & 1]; };

  /* ---------- painted impostors (the owner, 16:20: "no Lego"): every plant is 2–3 crossed alpha-tested cards with a painted
     texture — R.tex.treeTex(kind, seed) from 09c_textures.js when it is there (looked up at build time: it loads after this
     file), else a painted canvas made here. One seed per biome and type: the same species looks different in every land;
     instance tint / scale / yaw vary each one. h = height in world units, a = width / height, k = cards (3 trees, 2 plants). ---------- */
  const IMP = N.IMP = {
    pine_l: ['pine', 110, .5], pine_m: ['pine', 86, .5], pine_s: ['pine', 58, .55], firdark: ['fir', 120, .45], blackpine: ['spruce_snow', 104, .5],
    birch: ['birch', 88, .55], oak: ['oak', 92, .95], elm: ['ash', 102, .8], autumnoak: ['oak', 88, .95], goldtree: ['oak', 86, .95], benttree: ['oak_windbent', 80, 1.05],
    willow: ['willow', 86, 1], weirwood: ['weirwood', 100, .95], palm: ['palm', 94, .75], orchard: ['apple', 54, .9], deadtree: ['dead_tree', 72, .75], ashtree: ['dead_tree', 66, .75],
    bush: ['shrub', 30, 1.3, 1], shrub: ['shrub', 26, 1.3, 1], rose: ['shrub', 28, 1.2, 1], gorse: ['gorse', 28, 1.3, 1], heather: ['heather', 15, 1.9, 1],
    reed: ['reeds', 42, .6, 2], cattail: ['reeds', 46, .6, 2], fern: ['fern', 22, 1.3, 2], wheat: ['grass_tall', 26, 1, 2], drygrass: ['grass_tall', 22, 1.1, 2], seagrass: ['grass_tall', 20, 1.1, 2],
    flower: ['flowers_blue', 16, 1.2, 2], poppy: ['flowers_red', 16, 1.2, 2], sunflower: ['flowers_yellow', 34, .7, 2], vine: ['vines', 32, 1.4, 2], cactus: ['cactus_scrub', 44, .8, 2],
    scrub: ['cactus_scrub', 24, 1.3, 1], mushroom: ['mushroom', 9, 1.2, 1], tuft: ['grass_tuft', 16, 1.3, 1], stump: ['stump', 18, 1.2, 2], hedge: ['shrub', 24, 2.2, 2], wildf: ['flowers_white', 12, 1.2, 2] };
  N.impostors = true;
  const impOn = type => N.impostors !== false && !!IMP[type];
  const texApi = () => { const T = R.tex; return T && typeof T.treeTex === 'function' ? T : null; };
  /* the fallback painter: a 128×256 (trees) / 128×128 (plants) canvas, seeded, brush blobs and strokes, alpha 0 / 1 only */
  const PAL = { pine: [0x1e3a26, 0x2e5a36, 0x3e6a40], fir: [0x13281a, 0x1c3a24, 0x26482c], spruce_snow: [0x1a3324, 0x2a4a32, 0xe8eef2], birch: [0x9a8a3a, 0xc8b050, 0xe0c860], oak: [0x2e4a22, 0x46682e, 0x5e7e3a],
    ash: [0x34522a, 0x4e6e34, 0x6a8a42], oak_windbent: [0x2a4426, 0x3e5e30, 0x56763a], willow: [0x5a7a36, 0x7a9a46, 0x9ab25a], weirwood: [0x8a1a1e, 0xb8282a, 0xd84a3a], palm: [0x3a6a2a, 0x5a8a36, 0x7aa444],
    apple: [0x34602a, 0x4e7a34, 0x5e8a3a], dead_tree: [0x3a3028, 0x4e4236, 0x5e5244], shrub: [0x2e4a26, 0x44622e, 0x5a7a3a], gorse: [0x2e4426, 0x44602e, 0xd8b830], heather: [0x4a3a32, 0x5e4450, 0x9a6a9e],
    reeds: [0x4e6a2a, 0x7a8a3a, 0x5a3a20], fern: [0x2a4a22, 0x3e662c, 0x528036], grass_tall: [0x7a7a3a, 0xa89a4a, 0xc8b660], grass_tuft: [0x4e6a34, 0x6e8a44, 0x8aa056], flowers_blue: [0x3e6a2e, 0x5a7e3a, 0x8aa0e8],
    flowers_red: [0x3e6a2e, 0x5a7e3a, 0xc8302a], flowers_yellow: [0x3e6a2e, 0x5a7e3a, 0xe8c030], vines: [0x2e5422, 0x46702e, 0x5a2a6a], cactus_scrub: [0x6a6236, 0x8a7e46, 0xa89a5a], mushroom: [0xe8e0d0, 0xb83a28, 0xd8d0c0] };
  const hexs = (h, k) => { const r = (h >> 16 & 255) * k | 0, g = (h >> 8 & 255) * k | 0, b = (h & 255) * k | 0; return 'rgb(' + Math.min(255, r) + ',' + Math.min(255, g) + ',' + Math.min(255, b) + ')'; };
  function paint(kind, seed, big) {
    const W = 128, H = big ? 256 : 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), rnd = mkRng(seed * 7 + hs(kind)), P = PAL[kind] || PAL.oak;
    const blob = (x, y, r, col, k) => { g.fillStyle = hexs(col, k); g.beginPath(); g.ellipse(x, y, r, r * (.7 + rnd() * .4), rnd() * 3, 0, Math.PI * 2); g.fill(); };
    const stroke = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (rnd() - .5) * 10, (y0 + y1) / 2, x1, y1); g.stroke(); };
    const trunk = (col, top, w) => { g.fillStyle = col; g.beginPath(); g.moveTo(W / 2 - w, H); g.lineTo(W / 2 - w * .35, top); g.lineTo(W / 2 + w * .35, top); g.lineTo(W / 2 + w, H); g.fill(); };
    if (kind === 'pine' || kind === 'fir' || kind === 'spruce_snow') {
      trunk('#3a2a1c', H * .2, 5); const tiers = kind === 'fir' ? 9 : 7;
      for (let t = 0; t < tiers; t++) { const yb = H * (.92 - t * .78 / tiers), half = W * (.46 - t * .4 / tiers) * (kind === 'fir' ? .85 : 1);
        for (let i = 0; i < 26; i++) { const u = rnd() * 2 - 1, x = W / 2 + u * half * (.4 + .6 * rnd()), y = yb - rnd() * H * .13 * (1 - Math.abs(u) * .6);
          blob(x, y, 3 + rnd() * 5, P[rnd() < .55 ? 0 : 1], 1 + rnd() * .5); }
        for (let i = 0; i < 6; i++) blob(W / 2 + (rnd() * 2 - 1) * half * .8, yb - rnd() * 6, 2 + rnd() * 3, P[2], kind === 'spruce_snow' ? 1 : .9 + rnd() * .3); }
      blob(W / 2, H * .1, 3, P[1], 1);
    } else if (kind === 'palm') {
      let x = W / 2, y = H; const bend = (rnd() - .5) * 30; g.strokeStyle = '#7a5e3c'; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + bend, H * .5, x + bend * .6, H * .28); g.stroke(); x += bend * .6; y = H * .28;
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i / 8 - .5) * 3.4, L = 40 + rnd() * 20; for (let j = 0; j < 14; j++) { const t = j / 14, px = x + Math.cos(a) * L * t, py = y + Math.sin(a) * L * t + t * t * 26; blob(px, py, 4.5 - t * 3, P[j % 2], .85 + rnd() * .3); } }
    } else if (kind === 'dead_tree') {
      const br = (x, y, a, L, w, d) => { if (d > 5 || L < 4) return; const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L; stroke(x, y, x1, y1, w, hexs(P[d % 3], 1)); br(x1, y1, a - .3 - rnd() * .5, L * .72, w * .66, d + 1); if (rnd() < .8) br(x1, y1, a + .3 + rnd() * .5, L * .68, w * .62, d + 1); };
      br(W / 2, H, -Math.PI / 2, H * .34, 9, 0);
    } else if (big) {   // broadleaf trees: trunk, a few limbs, a crown of overlapping painted blobs, light from the top left
      const tc = kind === 'birch' ? '#e8e4da' : kind === 'weirwood' ? '#efe9de' : '#4a3626', crownY = H * (kind === 'willow' ? .42 : .38), rx = W * .44, ry = H * (kind === 'oak_windbent' ? .2 : .28);
      trunk(tc, crownY, kind === 'oak' || kind === 'weirwood' ? 9 : 6); if (kind === 'birch') for (let i = 0; i < 8; i++) { g.fillStyle = '#2a2826'; g.fillRect(W / 2 - 4, crownY + rnd() * (H - crownY), 5 + rnd() * 3, 2); }
      for (let i = 0; i < 4; i++) stroke(W / 2, crownY + 30, W / 2 + (rnd() - .5) * rx * 1.4, crownY - rnd() * 20, 3, tc);
      const sx = kind === 'oak_windbent' ? 26 : 0;
      for (let i = 0; i < 150; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()), x = W / 2 + sx * (1 - d) + Math.cos(a) * rx * d, y = crownY + Math.sin(a) * ry * d * (kind === 'willow' && Math.sin(a) > 0 ? 1.9 : 1);
        const lit = (x < W / 2 ? .12 : -.06) + (y < crownY ? .14 : -.08); blob(x, y, 5 + rnd() * 7, P[rnd() < .5 ? 1 : 2], 1.05 + lit + rnd() * .25); }
      if (kind === 'willow') for (let i = 0; i < 26; i++) { const x = W / 2 + (rnd() - .5) * rx * 1.8; stroke(x, crownY, x + (rnd() - .5) * 6, crownY + ry * (1 + rnd()), 2, hexs(P[1], .9 + rnd() * .3)); }
      for (let i = 0; i < (kind === 'apple' ? 22 : 0); i++) blob(W / 2 + (rnd() - .5) * rx * 1.5, crownY + (rnd() - .5) * ry * 1.3, 3, 0xb83a2a, 1);
    } else if (kind === 'mushroom') {
      for (let i = 0; i < 3; i++) { const x = 30 + i * 32 + rnd() * 10, h = 40 + rnd() * 40; g.fillStyle = '#e8e0d0'; g.fillRect(x - 4, H - h, 8, h); blob(x, H - h, 16, P[1], .9 + rnd() * .2); blob(x - 5, H - h - 4, 3, 0xf0e8e0, 1); }
    } else {            // low plants: strokes up from the ground, then the flower / seed heads / berries
      const blades = kind === 'grass_tuft' ? 40 : kind === 'shrub' || kind === 'gorse' || kind === 'heather' || kind === 'cactus_scrub' ? 0 : 30;
      for (let i = 0; i < blades; i++) { const x = 10 + rnd() * (W - 20), top = H * (kind === 'fern' ? .35 : .12) + rnd() * H * .45; stroke(x, H, x + (rnd() - .5) * 30, top, kind === 'reeds' ? 3.4 : 3, hexs(P[rnd() < .5 ? 1 : 2], 1 + rnd() * .35));
        if (kind === 'reeds' && rnd() < .5) { g.fillStyle = hexs(P[2], 1); g.fillRect(x - 2, top, 4, 12); } }
      if (!blades) for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI, d = Math.sqrt(rnd()), x = W / 2 + Math.cos(a) * W * .45 * d * (rnd() < .5 ? -1 : 1), y = H - 4 - Math.sin(a) * H * .7 * d; blob(x, y, 4 + rnd() * 6, P[rnd() < .5 ? 0 : 1], .8 + rnd() * .35); }
      const dots = kind.indexOf('flowers') === 0 ? 26 : kind === 'gorse' || kind === 'heather' ? 40 : kind === 'vines' ? 18 : 0;
      for (let i = 0; i < dots; i++) blob(12 + rnd() * (W - 24), H * (.15 + rnd() * .5), kind === 'flowers_yellow' ? 6 : 3 + rnd() * 2, P[2], .9 + rnd() * .2);
    }
    return c;
  }
  const TEXC = {}, OWN_PAINT = { heather: 1 };   // N1: heather as a low dense purple-brown mound (the integrator, 17:12)
  function impTex(kind, seed, big) {
    const key = kind + '#' + seed; if (TEXC[key]) return TEXC[key]; let tex = null, aspect = 0, src = 'g2', foot = null;
    const T = OWN_PAINT[kind] ? null : texApi(); if (T) { try { const k = typeof T.kinds === 'function' ? T.kinds() : null; if (!k || k.indexOf(kind) >= 0) { tex = T.treeTex(kind, seed); const inf = typeof T.tree === 'function' ? T.tree(kind, seed) : null;
      if (inf && inf.w && inf.h) { aspect = inf.w / inf.h; foot = { fx: (inf.ax == null ? inf.w / 2 : inf.ax) / inf.w, fy: (inf.ay == null ? inf.h : inf.ay) / inf.h, worldH: inf.worldH }; } if (tex) src = 'R.tex'; } } catch (e) { tex = null; } }
    if (src === 'R.tex') return TEXC[key] = { tex, aspect, src, foot };
    if (!tex) { const cv = paint(kind, seed, big); tex = new THREE.CanvasTexture(cv); aspect = cv.width / cv.height; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; }
    try { if (THREE.SRGBColorSpace && 'colorSpace' in tex && !tex.colorSpace) tex.colorSpace = THREE.SRGBColorSpace; } catch (e) {}
    tex.anisotropy = 1; tex.needsUpdate = true;
    return TEXC[key] = { tex, aspect, src };
  }
  N.texSource = () => { const out = {}; for (const k in TEXC) out[k] = TEXC[k].src; return out; };
  const seedOf = (type, biome) => (hs(biome + '|' + type) & 0xfff) + 1;
  // the species of a type in a land: snowy pines in the cold lands when the painter has them, cypresses / olives in the south
  const COLD = { north: 1, wall: 1, beyond: 1, winter: 1 };
  const kindOf = (type, biome) => { const k = IMP[type][0], T = texApi(); let ks = null; try { ks = T && typeof T.kinds === 'function' ? T.kinds() : null; } catch (e) {}
    const has = x => !!ks && ks.indexOf(x) >= 0;
    if (k === 'pine' && COLD[biome] && has('pine_snow')) return 'pine_snow';
    if (type === 'pine_s' && (biome === 'dorne' || biome === 'redmts') && has('cypress')) return 'cypress';
    if (type === 'orchard' && (biome === 'dorne' || biome === 'redmts' || biome === 'crownlands') && has('olive')) return 'olive';
    return k; };
  function impGeo(type, biome) {
    const key = type + '|' + biome; if (GEO[key]) return GEO[key];
    const I = IMP[type], big = (I[3] || 3) === 3, T = impTex(kindOf(type, biome), seedOf(type, biome), big);
    // R.tex paintings: their own aspect and feet (ax, ay); trees a little taller than the fallback's; the fallback canvases are 1:2
    const hgt = T.src === 'R.tex' ? I[1] * (big ? 1.15 : 1) : I[1], wid = T.src === 'R.tex' && T.aspect ? hgt * T.aspect : hgt * (T.aspect ? Math.min(1.6, Math.max(.35, T.aspect * (big ? 1.9 : 1))) : I[2]);
    const ox = T.foot ? (.5 - T.foot.fx) * wid : 0, oy = T.foot ? hgt / 2 - (1 - T.foot.fy) * hgt : hgt / 2;
    const n = I[3] === 1 ? 1 : 2, parts = [];
    for (let i = 0; i < n; i++) { const q = new THREE.PlaneGeometry(wid, hgt, 1, 3).translate(ox, oy, 0); q.rotateY(i * Math.PI / n);
      const nr = q.attributes.normal; for (let j = 0; j < nr.count; j++) nr.setXYZ(j, 0, 1, 0);   // lit like foliage from above, both faces alike
      parts.push(q); }
    let cnt = 0; for (const q of parts) cnt += q.index ? q.index.count : q.attributes.position.count;
    const P3 = new Float32Array(cnt * 3), N3 = new Float32Array(cnt * 3), U2 = new Float32Array(cnt * 2); let o = 0;
    for (const q0 of parts) { const q = q0.toNonIndexed(); q0.dispose(); const c = q.attributes.position.count; P3.set(q.attributes.position.array, o * 3); N3.set(q.attributes.normal.array, o * 3); U2.set(q.attributes.uv.array, o * 2); o += c; q.dispose(); }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P3, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N3, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
    out.computeBoundingSphere(); out.computeBoundingBox(); out.userData.tris = cnt / 3; out.userData.imp = true; out.userData.h = hgt;
    return GEO[key] = out;
  }
  function impMat(type, biome) {
    const key = type + '|' + biome; if (MAT[key]) return MAT[key];
    const I = IMP[type], P = PROPS[type] || {}, B = BIOMES[biome] || BIOMES.reach, T = impTex(kindOf(type, biome), seedOf(type, biome), (I[3] || 3) === 3);
    const m = new THREE.MeshLambertMaterial({ map: T.tex, alphaTest: .5, side: THREE.DoubleSide, transparent: false });
    const sway = (P.sway || 1) * (B.wind || 1) * I[1] / ((I[3] || 3) === 3 ? 30 : 12), bill = I[3] === 1;
    // the low plants (2-card / 1-card: grass, flowers, reeds, ferns, bushes) bend away from the benders; trees do not
    const uni = { uSway: { value: sway }, uFreq: { value: .9 + .9 * (B.wind || 1) }, uH: { value: I[1] }, uSpin: { value: 0 }, uHub: { value: new THREE.Vector2(0, 1e9) }, uBendK: { value: (I[3] || 3) === 3 ? 0 : (P.bendK != null ? P.bendK : 1) } };
    m.userData.uni = uni; m.userData.imp = true; ensureU();
    m.onBeforeCompile = sh => { sh.uniforms.uTime = U.uTime; sh.uniforms.uHero = U.uHero; sh.uniforms.uBend = U.uBend; sh.uniforms.uStorm = U.uStorm; for (const k in uni) sh.uniforms[k] = uni[k]; m.userData.vs = 1;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + DECL + ' uniform vec3 uHero;').replace('#include <begin_vertex>', SHADER(bill) + `
  vec2 hcD = uHero.xz - cameraPosition.xz; float hcL = length(hcD); vec2 hcU = hcD / max(hcL, 1.0); vec2 rcP = iPos.xz - cameraPosition.xz; float tcP = dot(rcP, hcU);
  if (uHero.y > 0.5 && tcP > 0.0 && tcP < hcL - 12.0 && length(rcP - hcU * tcP) < 50.0 + 0.45 * uH) transformed *= 0.02;`);
      // both faces of a card are lit like its front (three flips the normal of back faces: half the cards went dark)
      const nb = THREE.ShaderChunk && THREE.ShaderChunk.normal_fragment_begin;
      if (nb && nb.indexOf('normal *= faceDirection;') >= 0) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', nb.replace('normal *= faceDirection;', '')); };
    m.customProgramCacheKey = () => 'natureImp' + (bill ? 'B' : '');
    m.name = key; return MAT[key] = m;
  }
  // R.tex may finish its paintings later (R.tex.ready): rebuild the look once when it does
  let texHooked = false;
  const hookTex = () => { if (texHooked) return; const T = texApi(); if (!T || !T.ready || typeof T.ready.then !== 'function') return; texHooked = true;
    T.ready.then(() => { try { N.relook(); } catch (e) {} }, () => {}); };
  N.relook = () => { for (const ch of Array.from(N.chunks.values())) disposeChunk(ch);
    for (const k in GEO) if (GEO[k].userData && GEO[k].userData.imp) { try { GEO[k].dispose(); } catch (e) {} delete GEO[k]; }
    for (const k in MAT) if (MAT[k].userData && MAT[k].userData.imp) { try { MAT[k].dispose(); } catch (e) {} delete MAT[k]; }
    for (const k in TEXC) { try { if (TEXC[k].src === 'g2') TEXC[k].tex.dispose(); } catch (e) {} delete TEXC[k]; }
    if (grass) { if (grass.parent) grass.parent.remove(grass); try { grass.dispose(); } catch (e) {} grass = null; } grassAt = null;
    for (const t in clut) { const im = clut[t]; if (im.parent) im.parent.remove(im); try { im.dispose(); } catch (e) {} delete clut[t]; } N.refresh(); };

  /* ---------- geometry / material caches ---------- */
  function addUV(g, S) { const p = g.attributes.position, nr = g.attributes.normal, n = p.count, uv = new Float32Array(n * 2);
    for (let i = 0; i + 2 < n; i += 3) { let ax = 0, ay = 0, az = 0; for (let k = 0; k < 3; k++) { ax += Math.abs(nr.getX(i + k)); ay += Math.abs(nr.getY(i + k)); az += Math.abs(nr.getZ(i + k)); }
      for (let k = 0; k < 3; k++) { const v = i + k, x = p.getX(v), y = p.getY(v), z = p.getZ(v); let u, w; if (ay >= ax && ay >= az) { u = x; w = z; } else if (ax >= az) { u = z; w = y; } else { u = x; w = y; } uv[v * 2] = u / S; uv[v * 2 + 1] = w / S; } }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  // a stone / sand / snow texture from 09c_textures on top of the vertex colours, brightened by the texture's mean so the tint stays
  function texMap(m, name) { const T = R.tex; if (!T || typeof T.get !== 'function') return; let t = null; try { t = T.get(name); } catch (e) { t = null; } if (!t) return;
    m.map = t; let k = 1.4; try { const a = typeof T.avg === 'function' ? T.avg(name) : null; if (a && /^#[0-9a-f]{6}$/i.test(a)) { const n = parseInt(a.slice(1), 16), L = ((n >> 16 & 255) * .3 + (n >> 8 & 255) * .59 + (n & 255) * .11) / 255; k = Math.min(2, Math.max(1, .6 / Math.max(.15, L))); } } catch (e) {}
    m.color.setScalar(k); m.needsUpdate = true; }
  const CLUT_T = { pebbles: 1, pebbles_snow: 1, twigs: 1, log: 1, roots: 1, moss: 1, litter: 1, snowtuft: 1 };
  const geoFor = (type, biome) => { if (impOn(type)) return impGeo(type, biome || 'reach'); if (GEO[type]) return GEO[type]; grng = mkRng(hs(type)); let g = null;
    if (type === 'tree' && R.props && R.props.tree) { try { const m = R.props.tree(GEO._treeBiome || 'reach'); g = m && m.geometry; } catch (e) { g = null; } }
    if (!g) g = PROPS[type].mk(); if (PROPS[type] && PROPS[type].tx) addUV(g, 36); g.userData.tris = g.attributes.position.count / 3; return GEO[type] = g; };
  const SHADER = (bill) => `vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
  vec3 iPos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 iPos = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
${bill ? `  vec2 dC = cameraPosition.xz - iPos.xz; float aB = atan(dC.x, dC.y); float cB = cos(aB), sB = sin(aB);
  transformed = vec3(cB * transformed.x + sB * transformed.z, transformed.y, -sB * transformed.x + cB * transformed.z);` : ''}
  if (uSpin > 0.0 && position.z > uHub.y) { float aS = uTime * uSpin; float cS = cos(aS), sS = sin(aS); vec2 q = vec2(transformed.x, transformed.y - uHub.x); transformed.x = cS * q.x - sS * q.y; transformed.y = uHub.x + sS * q.x + cS * q.y; }
  float hF = clamp(position.y / uH, 0.0, 1.0); hF *= hF;
  float ph = iPos.x * 0.011 + iPos.z * 0.017;
  float wv = (sin(uTime * uFreq + ph) + 0.45 * sin(uTime * uFreq * 2.3 + ph * 1.9 + 1.3)) * uStorm + (uStorm - 1.0) * 0.7;
  transformed.x += wv * uSway * hF; transformed.z += wv * uSway * 0.35 * hF;
  if (uBendK > 0.0) {
    vec2 bP = vec2(0.0);
    for (int i = 0; i < ${NB}; i++) { vec4 bB = uBend[i]; if (bB.z > 0.0) { vec2 dB = iPos.xz - bB.xy; float lB = length(dB); float fB = clamp(1.0 - lB / (bB.z + 6.0), 0.0, 1.0);
      bP += (lB > 0.01 ? dB / lB : vec2(0.7, 0.7)) * (fB * fB * (3.0 - 2.0 * fB)) * bB.w; } }
    float bL = length(bP); if (bL > 1.0) { bP /= bL; bL = 1.0; }
    if (bL > 0.001) { float hB = clamp(position.y / uH, 0.0, 1.0); hB = hB * (0.55 + 0.45 * hB);
#ifdef USE_INSTANCING
      mat3 bM = mat3(modelMatrix) * mat3(instanceMatrix);
#else
      mat3 bM = mat3(modelMatrix);
#endif
      float bS = max(length(bM[0]), 0.001); vec3 bW = vec3(bP.x, -0.42 * bL * hB, bP.y) * (uBendK * 0.85 * uH * hB);
      transformed += vec3(dot(bM[0], bW), dot(bM[1], bW), dot(bM[2], bW)) / (bS * bS) * bS; } }`;
  function matFor(type, biome) {
    if (impOn(type)) return impMat(type, biome);
    const key = type + '|' + biome; if (MAT[key]) return MAT[key];
    const P = PROPS[type], B = BIOMES[biome] || BIOMES.reach; let m;
    if (P.glow) m = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (P.shiny) m = new THREE.MeshPhongMaterial({ vertexColors: true, specular: P.shiny.specular || 0xffffff, shininess: P.shiny.shininess || 100, transparent: P.shiny.opacity != null, opacity: P.shiny.opacity == null ? 1 : P.shiny.opacity, side: P.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: P.shiny.opacity == null });
    else m = new THREE.MeshLambertMaterial({ vertexColors: true, side: P.ds ? THREE.DoubleSide : THREE.FrontSide });
    if (P.tx && !P.glow) texMap(m, P.tx);
    // N1: the near-field clutter never renders pure black: a self-lit floor of half its own mean colour
    if (CLUT_T[type] && m.emissive) { const ca = geoFor(type, biome).attributes.color; if (ca) { let r = 0, g = 0, b = 0; const n = ca.count; for (let i = 0; i < n; i++) { r += ca.getX(i); g += ca.getY(i); b += ca.getZ(i); } m.emissive.setRGB(r / n * .55, g / n * .55, b / n * .55); } }
    const sway = (P.sway || 0) * (B.wind || 1), spin = P.spin || 0;
    if (sway || P.bill || spin) {
      const bill = !!P.bill, uni = { uSway: { value: sway }, uFreq: { value: .9 + .9 * (B.wind || 1) }, uH: { value: Math.max(1, P.h || 1) }, uSpin: { value: spin }, uHub: { value: new THREE.Vector2(P.hub ? P.hub[0] : 0, P.hub ? P.hub[1] : 1e9) },
        uBendK: { value: P.bendK != null ? P.bendK : (P.h > 0 && P.h <= 36 && sway ? .8 : 0) } };
      m.userData.uni = uni; ensureU();
      m.onBeforeCompile = sh => { sh.uniforms.uTime = U.uTime; sh.uniforms.uBend = U.uBend; sh.uniforms.uStorm = U.uStorm; for (const k in uni) sh.uniforms[k] = uni[k]; m.userData.vs = 1;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + DECL).replace('#include <begin_vertex>', SHADER(bill)); };
      m.customProgramCacheKey = () => 'nature' + (bill ? 'B' : '');
    }
    m.name = key; return MAT[key] = m;
  }

  /* ---------- placement ---------- */
  const _p = {}, _col = {};
  const v3 = () => { if (!_p.p) { _p.p = new THREE.Vector3(); _p.q = new THREE.Quaternion(); _p.s = new THREE.Vector3(); _p.e = new THREE.Euler(); _p.m = new THREE.Matrix4(); _col.c = new THREE.Color(); } };
  const segDist = (x, y, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, ll = vx * vx + vy * vy; let t = ll ? ((x - ax) * vx + (y - ay) * vy) / ll : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(ax + vx * t - x, ay + vy * t - y); };
  const keepOf = N.keepOf = p => { const t = String(p.type || p.kind || ''); return t === 'castle' || t === 'town' ? Math.max(210, (p.r || 0) + 50) : t === 'camp' || t === 'dungeon' || t === 'lair' ? 150 : POI_R; };
  function localWorld(x0, y0) {
    const cx = x0 + CHUNK / 2, cy = y0 + CHUNK / 2, R2 = CHUNK * .75 + 260, L = { pois: [], segs: [] };
    for (const p of pois()) if (Math.abs(p.x - cx) < R2 && Math.abs(p.y - cy) < R2) L.pois.push(p);
    const R3 = CHUNK * .75 + 300;
    for (const rd of roads()) { const pts = Array.isArray(rd) ? rd : (rd.pts || rd.points || rd.poly || rd.path || rd.line || []); for (let j = 0; j + 1 < pts.length; j++) { const ax = PX(pts[j], 0), ay = PX(pts[j], 1), bx = PX(pts[j + 1], 0), by = PX(pts[j + 1], 1);
      if (Math.max(ax, bx) < cx - R3 || Math.min(ax, bx) > cx + R3 || Math.max(ay, by) < cy - R3 || Math.min(ay, by) > cy + R3) continue; L.segs.push([ax, ay, bx, by]); } }
    // the distance to the nearest POI core, as if every core were POI_R wide: castles / towns keep a wider yard clear
    L.poiD = (x, y) => { let d = 1e9; for (const p of L.pois) d = Math.min(d, Math.hypot(p.x - x, p.y - y) - keepOf(p) + POI_R); return d; };
    L.roadD = (x, y) => { let d = 1e9; for (const s of L.segs) d = Math.min(d, segDist(x, y, s[0], s[1], s[2], s[3])); return d; };
    return L;
  }
  function tintOf(e, rng, biome) {
    const c = _col.c; c.setRGB(1, 1, 1);
    if (e.tint === 'bluewhite') { const k = rng(); c.setRGB(.55 + .45 * k, .6 + .4 * k, 1); }
    else if (e.tint === 'meadow') { const k = rng(); if (k < .4) c.setRGB(1, .9, .35); else if (k < .7) c.setRGB(1, .6, .9); else c.setRGB(.95, .95, 1); }
    else if (Array.isArray(e.tint)) c.setRGB(e.tint[0], e.tint[1], e.tint[2]);
    const br = .86 + rng() * .26; c.r *= br + (rng() - .5) * .08; c.g *= br + (rng() - .5) * .08; c.b *= br + (rng() - .5) * .08;
    return c;
  }
  // the height of the stone props (world units at scale 1): near a POI none stands above 96 (1.5 heroes)
  const ROCKH = N.ROCKH = { boulder: 16, boulder_snow: 16, drift: 6, outcrop: 34, spire: 112, seastack: 100, pillar: 70, wetrock: 9, basalt: 34, menhir: 46, iceshard: 30 };
  function build(cx, cy, lod) {
    const t0 = performance.now(), key = cx + ',' + cy, x0 = cx * CHUNK, y0 = cy * CHUNK, rng = mkRng(h2(cx, cy));
    const ch = { key, cx, cy, lod: lod || 0, group: null, meshes: [], obst: [], n: 0, tris: 0, ms: 0, biome: null, fields: [], recs: {} };
    if (!has()) return ch;
    v3();
    // the chunk's biome by a 5×5 vote of its LAND (water and points outside every region do not vote: a coastal chunk of an island
    // takes the island's recipe, not the fallback)
    const cnt = {}; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = x0 + (i + .5) * 120, y = y0 + (j + .5) * 120;
      if (!N.biomeOverride && (isWater(x, y) || !(R.world && R.world.regionAt && R.world.regionAt(x, y)))) continue; const b = N.biomeAt(x, y); cnt[b] = (cnt[b] || 0) + 1; }
    if (!Object.keys(cnt).length) cnt[N.biomeAt(x0 + CHUNK / 2, y0 + CHUNK / 2)] = 1;
    const order = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]); ch.biome = order[0]; ch.biomes = order;
    const L = localWorld(x0, y0), recs = ch.recs;
    const ok = (x, y, want) => x >= x0 && y >= y0 && x < x0 + CHUNK && y < y0 + CHUNK && !isWater(x, y) && L.poiD(x, y) >= POI_R && L.roadD(x, y) >= ROAD_R && N.biomeAt(x, y) === want;
    const add = (type, x, y, e, o) => { if (ch.n >= MAX_INST) return false; const P = PROPS[type]; o = o || {};
      let s = e.s ? e.s[0] + rng() * (e.s[1] - e.s[0]) : .82 + rng() * .46; const rh = ROCKH[type];
      if (rh) { if (L.poiD(x, y) < 300) s = Math.min(s, 96 / rh); if (L.roadD(x, y) < 140) s *= .7; }
      const yaw = o.yaw != null ? o.yaw : e.yaw ? e.yaw[0] + (rng() - .5) * 2 * e.yaw[1] : rng() * Math.PI * 2;
      const tx = e.tilt ? (rng() - .5) * 2 * e.tilt : 0, tz = e.tilt ? (rng() - .5) * 2 * e.tilt : 0, dy = e.dy ? e.dy[0] + rng() * (e.dy[1] - e.dy[0]) : 0;
      const c = tintOf(e, rng); (recs[type] = recs[type] || []).push({ x, y, s, yaw, tx, tz, dy, r: c.r, g: c.g, b: c.b }); ch.n++;
      if (P.obst) ch.obst.push({ x, y, r: Math.round(P.obst * s) }); return true; };
    const dens = .6 + .8 * vn(cx * .37 + 9.1, cy * .37 + 3.7);     // some places are thicker than others
    const run = (e, want, cap) => {
      const P = PROPS[e.t]; if (!P) return; if (ch.lod > 0 && e.lod === 0) return; if (e.chance != null && rng() > e.chance) return;
      const have = (recs[e.t] || []).length, room = Math.max(0, Math.min(PER_TYPE, cap == null ? PER_TYPE : cap) - have); if (!room) return;
      const n = Math.min(room, Math.round((e.n || 0) * dens)), pl = e.place || 'scatter';
      const pass = (x, y) => ok(x, y, want) && (!e.clump || (e.clump > 0 ? clumpAt(x, y, e.off || 0) > e.clump : clumpAt(x, y, e.off || 0) < -e.clump)) && (!P.flat || flat(x, y, 24));
      if (pl === 'scatter') { for (let t = 0, got = 0; t < n * 3 && got < n; t++) { const x = x0 + rng() * CHUNK, y = y0 + rng() * CHUNK; if (pass(x, y)) { add(e.t, x, y, e); got++; } } }
      else if (pl === 'water') { for (let t = 0, got = 0; t < n * 4 && got < n; t++) { const x = x0 + rng() * CHUNK, y = y0 + rng() * CHUNK; if (pass(x, y) && nearWater(x, y, e.r || 60)) { add(e.t, x, y, e); got++; } } }
      else if (pl === 'road') { if (!L.segs.length) return; for (let t = 0, got = 0; t < n * 6 && got < n; t++) { const s = L.segs[Math.floor(rng() * L.segs.length)], k = rng(), px = s[0] + (s[2] - s[0]) * k, py = s[1] + (s[3] - s[1]) * k, ll = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
          const side = rng() < .5 ? -1 : 1, d = e.min + rng() * (e.max - e.min), x = px + (-(s[3] - s[1]) / ll) * d * side, y = py + ((s[2] - s[0]) / ll) * d * side;
          if (pass(x, y) && L.roadD(x, y) >= e.min) { add(e.t, x, y, e, { yaw: Math.atan2(s[2] - s[0], s[3] - s[1]) + (side > 0 ? Math.PI : 0) }); got++; } } }
      else if (pl === 'rows') { let got = 0; for (const p of L.pois) { if (got >= (e.max || 60)) break; if (!/town|castle|village|city|farm|seat/.test(String(p.type || p.kind || 'town'))) continue;
          const a = rng() * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a), m = 6 + Math.floor(rng() * 3);
          for (let r = 0; r < e.rows; r++) { const d = e.from + r * e.rgap; for (let i = 0; i < m; i++) { const w = (i - (m - 1) / 2) * e.gap, x = p.x + ux * d - uy * w, y = p.y + uy * d + ux * w; if (pass(x, y) && got < (e.max || 60)) { add(e.t, x, y, e, { yaw: a }); got++; } } } } }
      else if (pl === 'field') { for (let f = 0; f < e.fields; f++) { const fx = x0 + 120 + rng() * (CHUNK - 240), fy = y0 + 120 + rng() * (CHUNK - 240), w = e.w[0] + rng() * (e.w[1] - e.w[0]), d = e.d[0] + rng() * (e.d[1] - e.d[0]), a = rng() * Math.PI;
          if (!pass(fx, fy) || !flat(fx, fy, Math.min(w, d) / 2, e.tol)) continue; const ux = Math.cos(a), uy = Math.sin(a); ch.fields.push({ x: fx, y: fy, w, d, a }); let placed = 0;
          for (let i = -w / 2; i < w / 2 && ch.n < MAX_INST; i += e.gap) for (let j = -d / 2; j < d / 2; j += e.gap) { const jx = i + (rng() - .5) * 8, jy = j + (rng() - .5) * 8, x = fx + ux * jx - uy * jy, y = fy + uy * jx + ux * jy; if ((recs[e.t] || []).length >= PER_TYPE) break; if (pass(x, y)) { add(e.t, x, y, e, { yaw: a + (rng() - .5) * .3 }); placed++; } } } }
      else if (pl === 'edge') { for (const F of ch.fields) { const ux = Math.cos(F.a), uy = Math.sin(F.a); for (const side of [-1, 1]) for (let i = -F.w / 2; i < F.w / 2; i += e.gap) { const j = side * (F.d / 2 + 8), x = F.x + ux * i - uy * j, y = F.y + uy * i + ux * j; if ((recs[e.t] || []).length >= PER_TYPE) break; if (pass(x, y)) add(e.t, x, y, e, { yaw: F.a }); } } }
      else if (pl === 'grove') { for (let g = 0; g < e.k; g++) { const gx = x0 + 80 + rng() * (CHUNK - 160), gy2 = y0 + 80 + rng() * (CHUNK - 160), m = e.m[0] + Math.floor(rng() * (e.m[1] - e.m[0] + 1)); for (let i = 0; i < m; i++) { const a = rng() * Math.PI * 2, d = 20 + rng() * (e.r - 20), x = gx + Math.cos(a) * d, y = gy2 + Math.sin(a) * d; if (pass(x, y)) add(e.t, x, y, e); } } }
      else if (pl === 'anchor') { for (const a of (recs[e.of] || []).slice()) for (let i = 0; i < n; i++) { const an = rng() * Math.PI * 2, d = rng() * e.r * a.s, x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d; if (ok(x, y, want)) add(e.t, x, y, e); } }
    };
    const B0 = BIOMES[ch.biome] || BIOMES.reach; for (const e of B0.props) run(e, ch.biome);
    if (order[1] && cnt[order[1]] >= 5) { const B1 = BIOMES[order[1]]; let used = 0; for (const e of B1.props) { if (Object.keys(recs).length >= MAX_DRAWS) break; if (used >= 3) break; if (!recs[e.t]) used++; run(e, order[1], 60); } }
    // one InstancedMesh per type
    ch.group = new THREE.Group(); ch.group.name = 'chunk ' + key;
    for (const type in recs) { const list = recs[type]; if (!list.length) continue; if (ch.meshes.length >= MAX_DRAWS) break;
      const geo = geoFor(type, ch.biome), im = new THREE.InstancedMesh(geo, matFor(type, ch.biome), list.length); im.name = type; im.frustumCulled = true;
      const bb = impOn(type) && IMP[type][3] === 1;
      for (let i = 0; i < list.length; i++) { const r = list[i]; _p.p.set(r.x, gy(r.x, r.y) + r.dy - (bb ? 1 : 0), r.y); if (bb) _p.q.identity(); else _p.q.setFromEuler(_p.e.set(r.tx, r.yaw, r.tz)); _p.s.set(r.s, r.s, r.s); _p.m.compose(_p.p, _p.q, _p.s); im.setMatrixAt(i, _p.m); _col.c.setRGB(r.r, r.g, r.b); im.setColorAt(i, _col.c); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
      ch.tris += geo.userData.tris * list.length; ch.meshes.push(im); ch.group.add(im); }
    ch.ms = performance.now() - t0; N.stats.built++; N.stats.lastMs = ch.ms; N.stats.maxMs = Math.max(N.stats.maxMs, ch.ms);
    return ch;
  }
  N.build = (cx, cy, lod) => { const key = cx + ',' + cy; const old = N.chunks.get(key); if (old) disposeChunk(old); const ch = build(cx, cy, lod); N.chunks.set(key, ch); if (root && ch.group) root.add(ch.group); rebuildObst(); return ch; };
  function disposeChunk(ch) { N.chunks.delete(ch.key); if (ch.group) { if (ch.group.parent) ch.group.parent.remove(ch.group); for (const m of ch.meshes) { try { m.dispose(); } catch (e) {} N.stats.disposed.meshes++; } } ch.meshes = []; }
  // the obstacles of the live chunks in a 64-unit grid: blockedAt looks at the 3×3 cells around the point (movers call it every step)
  const OG = 64; let ogrid = new Map(), omax = 0;
  function rebuildObst() { const o = [], g = new Map(); let mx = 0; for (const ch of N.chunks.values()) for (const b of ch.obst) { o.push(b); mx = Math.max(mx, b.r);
      const k = Math.floor(b.x / OG) + ',' + Math.floor(b.y / OG); let L = g.get(k); if (!L) g.set(k, L = []); L.push(b); }
    N.obstacles = o; ogrid = g; omax = mx; }
  N.blockedAt = (x, y, r) => { r = r || 0; if (!ogrid.size) return false; const span = Math.ceil((omax + r) / OG), gx = Math.floor(x / OG), gy0 = Math.floor(y / OG);
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) { const L = ogrid.get((gx + i) + ',' + (gy0 + j)); if (!L) continue;
      for (const o of L) if ((o.x - x) ** 2 + (o.y - y) ** 2 < (o.r + r) ** 2) return true; } return false; };

  /* ---------- the grass ---------- */
  function regrass(px, py) {
    if (!grass) { grass = new THREE.InstancedMesh(geoFor('tuft'), matFor('tuft', 'reach'), GRASS_MAX); grass.name = 'grass'; grass.frustumCulled = false; root.add(grass); }
    v3(); grassAt = { x: px, y: py }; const bmemo = new Map(), bAt = (x, y) => { const k = Math.floor(x / 40) * 100003 + Math.floor(y / 40); let v = bmemo.get(k); if (v === undefined) { v = N.biomeAt(x, y); bmemo.set(k, v); } return v; }; const b = N.biomeAt(px, py), B = BIOMES[b] || BIOMES.reach, cell = 100, out = [];
    const L = localWorld(px - CHUNK / 2, py - CHUNK / 2);   // centred on the hero: every POI / road within ~700 of him
    for (let gx = Math.floor((px - GRASS_R) / cell); gx <= Math.floor((px + GRASS_R) / cell); gx++) for (let gyy = Math.floor((py - GRASS_R) / cell); gyy <= Math.floor((py + GRASS_R) / cell); gyy++) {
      // denser at the hero's feet (the cells within 240: +10, within 340: +4), thinning out with distance
      const rng = mkRng(h2(gx * 3 + 1, gyy * 3 + 2)), cd = Math.hypot(gx * cell + cell / 2 - px, gyy * cell + cell / 2 - py); const k = 5 + Math.floor(rng() * 7) + (cd < 240 ? 10 : cd < 340 ? 4 : 0);
      for (let i = 0; i < k; i++) { const x = gx * cell + rng() * cell, y = gyy * cell + rng() * cell, dd = (x - px) ** 2 + (y - py) ** 2, thin = rng(); if (dd > GRASS_R * GRASS_R || isWater(x, y) || L.roadD(x, y) < 18 || L.poiD(x, y) < 50) continue;
        const bb = BIOMES[bAt(x, y)] || B; if (bb.grassK != null && thin > bb.grassK) continue; const g0 = bb.grass || [1, 1, 1], mg = Math.max(g0[0], g0[1], g0[2], .01), g = impOn('tuft') ? g0.map(v => .5 + .5 * v / mg) : g0, br = .85 + rng() * .3, hj = (rng() - .5) * .1; out.push({ x, y, dd, s: (.6 + rng() * .85) * (1 - .45 * dd / (GRASS_R * GRASS_R)), r: g[0] * (br + hj), g: g[1] * br, b: g[2] * (br - hj) }); } }
    out.sort((a, b) => a.dd - b.dd); const n = Math.min(GRASS_MAX, out.length);
    for (let i = 0; i < n; i++) { const r = out[i]; _p.p.set(r.x, gy(r.x, r.y), r.y); _p.q.identity(); _p.s.set(r.s, r.s, r.s); _p.m.compose(_p.p, _p.q, _p.s); grass.setMatrixAt(i, _p.m); _col.c.setRGB(r.r, r.g, r.b); grass.setColorAt(i, _col.c); }
    grass.count = n; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true; N.stats.grass = n;
    const uni = grass.material.userData.uni; if (uni) { uni.uSway.value = PROPS.tuft.sway * (B.wind || 1); uni.uFreq.value = .9 + .9 * (B.wind || 1); }
    try { reclutter(px, py, L, bAt); } catch (e) { console.warn('nature clutter', e); }
    driftEmitters(px, py); stormBiome = b;
  }
  N.grassCount = () => (grass ? grass.count : 0);

  /* ---------- N1: the near field around the hero — ground clutter, drifting leaves / petals / snow / sand, benders, storms ----------
     Clutter: per biome a few small kinds ([type, chance per 64-unit cell, tint?]) within CLUT_R of the hero, one global InstancedMesh per
     kind (≤ CLUT_MAX each, ≤ 5 kinds in a land), seeded per cell (stable while you walk), size / yaw / hue varied, laid on the slope;
     never on water, roads (ROAD_R), POI cores (keepOf) or inside a rock / trunk; rebuilt with the grass (every GRASS_STEP units). */
  const CLUT_R = 330, CLUT_CELL = 64, CLUT_MAX = 150;
  const RED = [1.1, .72, .55], DARK = [.55, .56, .6], BLUE = [.85, .92, 1.05], GOLD = [1.25, 1, .55], BLEACH = [1.35, 1.25, 1.1];
  const CLUTTER = N.CLUTTER = {
    north: [['pebbles_snow', .45], ['twigs', .25], ['roots', .12], ['moss', .22], ['snowtuft', .3]],
    wolfswood: [['log', .07], ['moss', .35], ['mushroom', .25], ['roots', .18], ['twigs', .35]],
    wall: [['snowtuft', .55], ['pebbles_snow', .3]],
    beyond: [['snowtuft', .6], ['pebbles_snow', .3, BLUE]],
    winter: [['snowtuft', .65], ['pebbles_snow', .25, BLUE]],
    riverlands: [['litter', .3], ['twigs', .25], ['wildf', .3], ['mushroom', .1], ['pebbles', .2]],
    neck: [['moss', .4], ['log', .06], ['mushroom', .2], ['twigs', .3]],
    vale: [['pebbles', .5], ['wildf', .3], ['moss', .2]],
    reach: [['wildf', .45], ['pebbles', .15], ['twigs', .15]],
    crownlands: [['wildf', .3], ['twigs', .2], ['pebbles', .2]],
    kingswood: [['log', .07], ['litter', .3], ['mushroom', .2], ['roots', .16], ['moss', .25]],
    stormlands: [['twigs', .35], ['log', .05], ['pebbles', .25], ['moss', .2]],
    westerlands: [['pebbles', .4, RED], ['litter', .25, GOLD], ['twigs', .2]],
    dorne: [['pebbles', .35, [1.3, 1, .7]], ['twigs', .15, BLEACH]],
    redmts: [['pebbles', .5, RED], ['twigs', .12, BLEACH]],
    ironislands: [['pebbles', .5, DARK], ['twigs', .15, BLEACH], ['moss', .12, [.8, .9, .8]]],
    coast: [['pebbles', .4, [.85, .86, .86]], ['twigs', .2, BLEACH]],
    dragonstone: [['pebbles', .45, [.4, .38, .38]], ['twigs', .15, [.5, .45, .42]]],
    crackclaw: [['log', .05], ['moss', .25], ['twigs', .3], ['pebbles', .2]] };
  const clut = {}; N.clutter = {};
  const _up = { v: null };
  function reclutter(px, py, L, bAt) {
    bAt = bAt || N.biomeAt;
    const b = N.biomeAt(px, py), list = CLUTTER[b] || CLUTTER.reach, want = {}; N.clutter = {};
    if (!_up.v) { _up.v = new THREE.Vector3(0, 1, 0); _up.n = new THREE.Vector3(); _up.q = new THREE.Quaternion(); _up.y = new THREE.Quaternion(); }
    for (let k = 0; k < list.length; k++) { const type = list[k][0], ch = list[k][1], tint = list[k][2]; if (!PROPS[type]) continue; const recs = [];
      for (let gx = Math.floor((px - CLUT_R) / CLUT_CELL); gx <= Math.floor((px + CLUT_R) / CLUT_CELL); gx++) for (let gyy = Math.floor((py - CLUT_R) / CLUT_CELL); gyy <= Math.floor((py + CLUT_R) / CLUT_CELL); gyy++) {
        const rng = mkRng(h2(gx * 7 + k * 131 + 3, gyy * 5 + k * 17 + 1)); if (rng() > ch) continue;
        const x = gx * CLUT_CELL + rng() * CLUT_CELL, y = gyy * CLUT_CELL + rng() * CLUT_CELL, s = .6 + rng() * .9, yaw = rng() * Math.PI * 2, hue = rng();
        if ((x - px) ** 2 + (y - py) ** 2 > CLUT_R * CLUT_R || recs.length >= CLUT_MAX) continue;
        if (isWater(x, y) || L.roadD(x, y) < ROAD_R || L.poiD(x, y) < POI_R || N.blockedAt(x, y, 6)) continue;
        if (bAt(x, y) !== b) continue;
        if (type === 'log' && !flat(x, y, 20, 5)) continue;
        recs.push({ x, y, s: type === 'log' ? .8 + (s - .6) * .4 : s, yaw, hue, tint }); }
      if (recs.length) want[type] = recs; }
    for (const t in clut) if (!want[t]) { clut[t].count = 0; clut[t].visible = false; }
    for (const type in want) { const recs = want[type]; N.clutter[type] = recs;
      let im = clut[type]; const geo = geoFor(type, b), mat = matFor(type, b);
      if (!im) { im = clut[type] = new THREE.InstancedMesh(geo, mat, CLUT_MAX); im.name = 'clutter ' + type; im.frustumCulled = false; }
      if (im.geometry !== geo) im.geometry = geo; if (im.material !== mat) im.material = mat; if (im.parent !== root) root.add(im);
      for (let i = 0; i < recs.length; i++) { const r = recs[i], h0 = gy(r.x, r.y), hx = (gy(r.x + 6, r.y) - gy(r.x - 6, r.y)) / 12, hz = (gy(r.x, r.y + 6) - gy(r.x, r.y - 6)) / 12;
        _up.n.set(-hx, 1, -hz).normalize(); _up.q.setFromUnitVectors(_up.v, _up.n); _up.y.setFromAxisAngle(_up.v, r.yaw); if (impOn(type) && IMP[type][3] === 1) _p.q.identity(); else _p.q.copy(_up.q).multiply(_up.y);
        _p.p.set(r.x, h0 - (PROPS[type].flat ? 0 : .3), r.y); _p.s.set(r.s, r.s, r.s); _p.m.compose(_p.p, _p.q, _p.s); im.setMatrixAt(i, _p.m);
        const tn = r.tint || [1, 1, 1], br = .82 + r.hue * .34, sh = (r.hue - .5) * .12; _col.c.setRGB(tn[0] * (br + sh), tn[1] * br, tn[2] * (br - sh)); im.setColorAt(i, _col.c); }
      im.count = recs.length; im.visible = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  N.clutterCount = () => { let n = 0; for (const t in clut) if (clut[t].visible) n += clut[t].count; return n; };
  N.clutterDraws = () => Object.keys(clut).filter(t => clut[t].visible && clut[t].count).length;

  /* drifting bits near the camera: one InstancedMesh of tiny tumbling cards (≤ DRIFT_MAX), the kind by the hero's land — autumn
     leaves in the Riverlands, gold leaves in the Westerlands, petals in the Reach, snow shaken off pines in the North and beyond,
     sand in Dorne, spray on the coasts, ash on Dragonstone. Leaves / petals / snow start in the crowns of the trees around the hero
     (the chunks' records), sand / spray blow low over the ground. Moved on the CPU (≤ 48 matrices a frame). */
  const DRIFT_MAX = 48, WIND = { x: .94, y: .34 };
  const DRIFTS = N.DRIFT = {
    leaf: { n: 30, cols: [0xc8642a, 0xd8a03a, 0x9a4a22, 0xb8862e, 0x8a6a2a], size: [2.6, 4.2], fall: [12, 22], wind: 26, tumble: 3, tree: 1 },
    gold: { n: 30, cols: [0xe8c040, 0xf0d060, 0xd89a2a, 0xc8a038], size: [2.6, 4], fall: [12, 22], wind: 26, tumble: 3, tree: 1 },
    petal: { n: 34, cols: [0xf4c8d8, 0xffffff, 0xf8a0b8, 0xfff0c0, 0xe87a9a], size: [1.6, 2.6], fall: [7, 14], wind: 34, tumble: 4, tree: 1, air: .5 },
    green: { n: 30, cols: [0x4a7a34, 0x6a8a3a, 0x8a6a2a, 0x5a6a2a], size: [2.4, 3.6], fall: [6, 12], wind: 110, tumble: 6, tree: 1, air: .5 },
    snow: { n: 44, cols: [0xffffff, 0xeef4fa, 0xdfe9f2], size: [1.2, 2.2], fall: [16, 28], wind: 18, tumble: 1, tree: 1, air: .35 },
    sand: { n: 40, cols: [0xd8b878, 0xc8a060, 0xe8d0a0, 0xb88a50], size: [.7, 1.4], fall: [0, 3], wind: 150, tumble: 8, low: 1 },
    spray: { n: 30, cols: [0xffffff, 0xe8f0f4, 0xd0dce4], size: [.8, 1.6], fall: [2, 6], wind: 90, tumble: 2, low: 1 },
    ash: { n: 34, cols: [0x5a5454, 0x3a3434, 0x7a7070, 0xff7a2a], size: [1, 2], fall: [5, 10], wind: 30, tumble: 3, air: 1 } };
  const BIOME_DRIFT = N.BIOME_DRIFT = { riverlands: 'leaf', neck: 'leaf', kingswood: 'leaf', crackclaw: 'leaf', westerlands: 'gold', reach: 'petal', crownlands: 'petal', vale: 'petal',
    north: 'snow', wolfswood: 'snow', wall: 'snow', beyond: 'snow', winter: 'snow', dorne: 'sand', redmts: 'sand', stormlands: 'green', coast: 'spray', ironislands: 'spray', dragonstone: 'ash' };
  const TREEISH = t => !!(IMP[t] && (IMP[t][3] || 3) === 3);
  const dr = N.drift = { mesh: null, kind: null, parts: [], emit: [] };
  function driftEmitters(px, py) { const out = []; for (const ch of N.chunks.values()) for (const t in ch.recs) { if (!TREEISH(t)) continue; const hh = IMP[t][1];
      for (const q of ch.recs[t]) if ((q.x - px) ** 2 + (q.y - py) ** 2 < 420 * 420) out.push({ x: q.x, y: q.y, h: hh * q.s, pine: /pine|fir/.test(t) }); }
    dr.emit = out; }
  function driftSpawn(q, D, px, py) { const rnd = Math.random; let e = null;
    if (D.tree && dr.emit.length && !(D.air && rnd() < D.air)) { e = dr.emit[Math.floor(rnd() * dr.emit.length)]; if (dr.kind === 'snow' && !e.pine && rnd() < .7) e = null; }
    if (e) { const a = rnd() * 6.283, d = rnd() * 18 * (e.h / 90); q.x = e.x + Math.cos(a) * d; q.y = e.y + Math.sin(a) * d; q.h = e.h * (.45 + rnd() * .45); }
    else { const a = rnd() * 6.283, d = 40 + rnd() * 300, back = D.low ? 120 : 0; q.x = px + Math.cos(a) * d - WIND.x * back; q.y = py + Math.sin(a) * d - WIND.y * back; q.h = D.low ? 2 + rnd() * 16 : 40 + rnd() * 70; }
    q.vf = D.fall[0] + rnd() * (D.fall[1] - D.fall[0]); q.sz = D.size[0] + rnd() * (D.size[1] - D.size[0]); q.ph = rnd() * 6.283; q.sp = (.5 + rnd()) * D.tumble; q.life = 4 + rnd() * 6; q.rest = 0;
    q.ax = rnd() * 3; q.ay = rnd() * 3; q.col = D.cols[Math.floor(rnd() * D.cols.length)]; q.g = gy(q.x, q.y); q.on = true; }
  function driftUpdate(dt, px, py, biome) {
    const kind = BIOME_DRIFT[biome] || null;
    if (!dr.mesh) { const g = new THREE.PlaneGeometry(1, .62), m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }); dr.mesh = new THREE.InstancedMesh(g, m, DRIFT_MAX); dr.mesh.name = 'drift'; dr.mesh.frustumCulled = false; dr.mesh.count = 0;
      for (let i = 0; i < DRIFT_MAX; i++) dr.parts.push({ on: false }); }
    if (dr.mesh.parent !== root) root.add(dr.mesh);
    if (kind !== dr.kind) { dr.kind = kind; for (const q of dr.parts) q.on = false; }
    if (!kind) { dr.mesh.count = 0; dr.mesh.visible = false; return; }
    const D = DRIFTS[kind], want = Math.min(DRIFT_MAX, Math.round(D.n * (R.lowEnd ? .5 : 1))), st = U.uStorm.value, wsp = D.wind * (.6 + .4 * st) * ((BIOMES[biome] || {}).wind || 1);
    let n = 0; v3(); const t = R.t;
    for (let i = 0; i < want; i++) { const q = dr.parts[i];
      if (!q.on || q.life <= 0 || (q.x - px) ** 2 + (q.y - py) ** 2 > 480 * 480) driftSpawn(q, D, px, py);
      q.life -= dt;
      if (!q.rest) { const fl = Math.sin(t * 2.2 + q.ph); q.x += (WIND.x * wsp + fl * 9) * dt; q.y += (WIND.y * wsp + Math.cos(t * 1.7 + q.ph) * 7) * dt; q.h -= (q.vf * (1 + .35 * fl)) * dt; q.ax += q.sp * dt; q.ay += q.sp * .7 * dt;
        q.g = gy(q.x, q.y); if (D.low && q.h < 3) q.h = 3 + Math.abs(fl) * 4; if (q.h <= 0) { q.h = 0; q.rest = 1; q.life = Math.min(q.life, 1.6); } }
      const k = Math.min(1, q.life / .5); _p.p.set(q.x, q.g + q.h + .3, q.y); _p.q.setFromEuler(_p.e.set(q.rest ? -1.5 : q.ax, q.ay, q.rest ? 0 : q.ax * .6)); const sz = q.sz * Math.max(0, k); _p.s.set(sz, sz, sz); _p.m.compose(_p.p, _p.q, _p.s);
      dr.mesh.setMatrixAt(n, _p.m); _col.c.setHex(q.col); dr.mesh.setColorAt(n, _col.c); n++; }
    dr.mesh.count = n; dr.mesh.visible = n > 0; dr.mesh.instanceMatrix.needsUpdate = true; if (dr.mesh.instanceColor) dr.mesh.instanceColor.needsUpdate = true;
  }
  N.driftCount = () => (dr.mesh && dr.mesh.visible ? dr.mesh.count : 0);

  /* benders: the hero (k by his speed), his wake (3 points every 0.2 s while he moves, a damped spring: k = 0.9·e^(-3a)·cos(4.5a) — the
     plants behind him whip back past upright and settle) and the 4+ nearest moving bodies within 450 (mobs, bosses, companions, NPCs,
     ground critters). R.phys.benders() → [{x, y, r, k}] replaces the list when it is there. The shader pushes plants within r + 6 aside. */
  const wake = []; let wakeT = 0;
  const spdOf = e => { const v = e.vel; if (v && typeof v.x === 'number') return Math.hypot(v.x, v.y); return Math.hypot(e.vx || 0, e.vy || 0); };
  N.benders = () => (N._bend || []).slice();
  const BEND_KIND = { mob: 1, boss: 1, companion: 1, critter: 1, npc: 1 };
  function bendUpdate(dt) {
    ensureU(); const arr = U.uBend.value, out = []; let ph = null;
    if (R.phys && typeof R.phys.benders === 'function') { try { ph = R.phys.benders(); } catch (e) { ph = null; } }
    if (Array.isArray(ph) && ph.length) { for (const b of ph) { if (out.length >= NB) break; if (b && isFinite(b.x)) out.push({ x: b.x, y: b.y != null ? b.y : b.z, r: b.r || 20, k: b.k != null ? b.k : 1 }); } }
    else { const p = R.player;
      if (p && typeof p.x === 'number' && !p.dead) { const v = spdOf(p); out.push({ x: p.x, y: p.y, r: 20, k: .6 + .4 * Math.min(1, v / 80) });
        wakeT -= dt; if (wakeT <= 0 && v > 15) { wakeT = .2; wake.unshift({ x: p.x, y: p.y, t: R.t }); if (wake.length > 3) wake.length = 3; }
        for (const q of wake) { const a = R.t - q.t; if (a < 0 || a > 1.2 || (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < 100) continue; out.push({ x: q.x, y: q.y, r: 18, k: .9 * Math.exp(-a * 3) * Math.cos(a * 4.5) }); }
        const near = []; for (const e of R.ents) { if (e === p || e.dead || e.fly || e.prop || (e.z || 0) > 12 || !BEND_KIND[e.kind]) continue;
          const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d2 < 450 * 450) near.push([d2, e]); }
        near.sort((a, b) => a[0] - b[0]);
        for (const it of near) { if (out.length >= NB) break; const e = it[1], v = spdOf(e); out.push({ x: e.x, y: e.y, r: Math.max(10, Math.min(40, (e.r || 12) * 1.15)), k: .45 + .55 * Math.min(1, v / 50) }); } } }
    for (let i = 0; i < NB; i++) { const b = out[i]; if (b) arr[i].set(b.x, b.y, b.r, b.k); else arr[i].set(0, 0, 0, 0); }
    N._bend = out;
  }
  // storms: rain / snow / spray (R.ambience.weather) and the Stormlands / coasts make every plant and tree sway harder, with gusts
  let stormBiome = null, stormBase = 1;
  N.storm = () => U.uStorm.value;
  N.stormTarget = () => { const A = R.ambience, w = A && A.weather; let k = 1; if (w === 'rain') k += .8; else if (w === 'snow') k += .5; else if (w === 'spray') k += .3; else if (w === 'heat') k += .1;
    if (stormBiome === 'stormlands' || (A && A.stormlands)) k += .5; else if (stormBiome === 'coast' || stormBiome === 'ironislands') k += .25; return k; };
  function stormUpdate(dt) { const tg = N.stormTarget(); stormBase += (tg - stormBase) * Math.min(1, dt * .7); const t = R.t, gust = 1 + .22 * (stormBase - 1) * (Math.sin(t * .83) * .6 + Math.sin(t * 2.1 + 1.3) * .4); U.uStorm.value = stormBase * gust; }

  /* ---------- streaming ---------- */
  const centre = () => { const p = R.player; if (p && typeof p.x === 'number') return [p.x, p.y]; return [R.cam.x || 0, R.cam.y || 0]; };
  N.refresh = () => {
    if (!root) return; const [px, py] = centre(), ccx = Math.floor(px / CHUNK), ccy = Math.floor(py / CHUNK), want = new Map();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) want.set((ccx + i) + ',' + (ccy + j), { cx: ccx + i, cy: ccy + j, lod: (i && j) ? 1 : 0 });
    for (const ch of Array.from(N.chunks.values())) { const w = want.get(ch.key); if (!w || Math.hypot((ch.cx + .5) * CHUNK - px, (ch.cy + .5) * CHUNK - py) > FAR + CHUNK) disposeChunk(ch); }
    pending = []; for (const w of want.values()) { const ch = N.chunks.get(w.key || (w.cx + ',' + w.cy)); if (!ch) pending.push({ cx: w.cx, cy: w.cy, lod: w.lod, pri: 0 }); else if (ch.lod > w.lod) pending.push({ cx: w.cx, cy: w.cy, lod: w.lod, pri: 1 }); }
    pending.sort((a, b) => a.pri - b.pri || (Math.hypot((a.cx + .5) * CHUNK - px, (a.cy + .5) * CHUNK - py) - Math.hypot((b.cx + .5) * CHUNK - px, (b.cy + .5) * CHUNK - py)));
    lastCell = ccx + ',' + ccy; rebuildObst();
  };
  N.buildAll = () => { if (!root) return; while (pending.length) { const q = pending.shift(); N.build(q.cx, q.cy, q.lod); } const [px, py] = centre(); regrass(px, py); };
  N.pending = () => pending.length;
  N.attach = r => { if (!has() || !r || !r.scene) return false; r3d = r; if (!root) { root = new THREE.Group(); root.name = 'nature'; } if (root.parent !== r.scene) { if (root.parent) root.parent.remove(root); r.scene.add(root); }
    scene = r.scene; lastCell = null; hookTex(); return true; };
  const tryAttach = () => { if (R.render3d && R.render3d.scene && (scene !== R.render3d.scene || !root)) N.attach(R.render3d); };
  R.bus.on('render3d', () => { tryAttach(); if (root) { N.refresh(); } });
  // the rivers / lakes arrive later (09b_water builds its mask from the art): rebuild what stands so nothing grows in a river
  R.bus.on('water', () => { if (!root) return; for (const ch of Array.from(N.chunks.values())) disposeChunk(ch); grassAt = null; N.refresh(); });
  N.update = dt => {
    tryAttach(); if (!root) return; U.uTime.value = R.t;
    if (!U.uHero.value) U.uHero.value = new THREE.Vector3(); { const h = R.player; if (h && typeof h.x === 'number') U.uHero.value.set(h.x, 1, h.y); else U.uHero.value.y = 0; }
    const [px, py] = centre(), cell = Math.floor(px / CHUNK) + ',' + Math.floor(py / CHUNK);
    if (cell !== lastCell) N.refresh();
    for (let i = 0; i < BUILDS && pending.length; i++) { const q = pending.shift(); N.build(q.cx, q.cy, q.lod); }
    if (!grassAt || (grassAt.x - px) ** 2 + (grassAt.y - py) ** 2 > GRASS_STEP * GRASS_STEP) regrass(px, py);
    const fdt = Math.min(.1, dt || R.dt || 1 / 60); bendUpdate(fdt); stormUpdate(fdt); driftUpdate(fdt, px, py, stormBiome || N.biomeAt(px, py));
  };
  N.reset = () => { for (const ch of Array.from(N.chunks.values())) disposeChunk(ch); pending = []; lastCell = null; grassAt = null; N.obstacles = [];
    for (const t in clut) { const im = clut[t]; if (im.parent) im.parent.remove(im); try { im.dispose(); } catch (e) {} N.stats.disposed.meshes++; delete clut[t]; } N.clutter = {};
    if (dr.mesh) { if (dr.mesh.parent) dr.mesh.parent.remove(dr.mesh); try { dr.mesh.dispose(); dr.mesh.geometry.dispose(); dr.mesh.material.dispose(); } catch (e) {} dr.mesh = null; dr.parts = []; dr.kind = null; }
    if (grass) { if (grass.parent) grass.parent.remove(grass); try { grass.dispose(); } catch (e) {} N.stats.disposed.meshes++; grass = null; }
    for (const k in GEO) { if (k[0] === '_') continue; try { GEO[k].dispose(); } catch (e) {} N.stats.disposed.geoms++; delete GEO[k]; }
    for (const k in MAT) { try { MAT[k].dispose(); } catch (e) {} N.stats.disposed.mats++; delete MAT[k]; } };
  if (R.addSys) R.addSys('nature', { order: 55, update: N.update });
  // obstacles for movement: only if A06 declares the hook (R.world.extraBlocked), chaining anything already there
  if (R.world && Object.prototype.hasOwnProperty.call(R.world, 'extraBlocked')) { const prev = typeof R.world.extraBlocked === 'function' ? R.world.extraBlocked : null; R.world.extraBlocked = (x, y, r) => N.blockedAt(x, y, r) || !!(prev && prev(x, y, r)); }
  if (!N.describeFallback) N.describeFallback = BIOMES.reach.say[0];
})();
