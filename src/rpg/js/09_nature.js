/* HOLDOR RPG — nature (A43). Biome vegetation and ground life on A05's three.js terrain (R.render3d = {scene, camera,
   renderer, groundY(x, y)}; scene axes as A37's props: x east, z = the 2D world's y (south), y up, 1 unit = 1 world unit).
   The land is streamed in 600-unit chunks around the player (the 3×3 ring, ≤ 9 alive, built on demand one per step,
   disposed when they leave the ring). A chunk = one THREE.InstancedMesh per prop type (≤ 12 draw calls), placed by a
   seeded hash per chunk on walkable ground only (R.world.blocked false, above the sea), never within 120 units of a POI
   or 30 of a road, with value-noise clumps so every place reads differently; the near ring (the player's chunk and its
   edge neighbours) carries the ground life (flowers, reeds, drifts, pools …), the diagonals only trees and rocks, and
   nothing lives beyond 1400 units. Grass tufts are one global InstancedMesh (≤ 400 camera-facing quads within 440 units)
   that follows the player. Wind: a vertex sway in onBeforeCompile (uniform uTime shared by every material), stronger in
   the Stormlands and on the coast, snow-stiff in the North; windmill blades spin. Props are visual only, except boulders /
   spires / stacks / pillars / outcrops / wet rocks which fill R.nature.obstacles [{x, y, r}] (R.nature.blockedAt(x, y, r);
   hooked into R.world.extraBlocked only when A06 declares that property). A37's R.props.tree(biome) geometry is used as
   the generic tree of a biome when it is present.
   API: R.nature.describe(x, y) → one flavour line (2 variants per biome, stable per place); .biomeAt(x, y);
   .chunks (Map key 'cx,cy' → {cx, cy, lod, biome, group, meshes, obst, n, tris, ms}); .obstacles; .blockedAt(x, y, r);
   .refresh() / .buildAll() / .build(cx, cy, lod); .reset() (disposes everything incl. the shared geometry / materials);
   .attach(render3d); .stats {built, lastMs, maxMs, disposed:{meshes, geoms, mats}, grass}; .grassCount(); .biomeOverride
   (tests: a biome id or fn(x, y)); .BIOMES (recipes, each with .ground = a ground colour), .PROPS; .CHUNK = 600. */
(function () {
  const N = R.nature = R.nature || {};
  const CHUNK = 600, FAR = 1400, POI_R = 120, ROAD_R = 30, GRASS_MAX = 400, GRASS_R = 440, GRASS_STEP = 110, MAX_DRAWS = 12, MAX_INST = 1200, PER_TYPE = 170, BUILDS = 1, SEA = 0;
  N.CHUNK = CHUNK; N.FAR = FAR; N.POI_R = POI_R; N.ROAD_R = ROAD_R; N.GRASS_MAX = GRASS_MAX; N.MAX_DRAWS = MAX_DRAWS; N.MAX_INST = MAX_INST;
  N.chunks = new Map(); N.obstacles = []; N.biomeOverride = null;
  N.stats = { built: 0, lastMs: 0, maxMs: 0, disposed: { meshes: 0, geoms: 0, mats: 0 }, grass: 0 };
  const has = () => typeof THREE !== 'undefined' && !!(THREE && THREE.InstancedMesh);
  let scene = null, root = null, grass = null, grassAt = null, pending = [], lastCell = null, r3d = null;
  const GEO = {}, MAT = {}, U = { uTime: { value: 0 } };

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
  const ZONES = N.ZONES = [
    { b: 'wolfswood', region: 'farnorth', at: (x, y) => x < 3150 },                         // the Wolfswood around Deepwood Motte
    { b: 'kingswood', region: 'crownlands', at: (x, y) => y > 8400 && x > 4300 },            // the Kingswood south of King's Landing
    { b: 'neck', region: 'riverlands', at: (x, y) => y < 5150 },                             // the bog of the Neck around Moat Cailin
    { b: 'redmts', region: 'dorne', at: (x, y) => y < 10900 && x < 3900 }];                  // the dry valleys of the Red Mountains
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
  const isWater = (x, y) => blocked(x, y) || gy(x, y) < SEA - 0.5;
  const nearWater = (x, y, r) => isWater(x + r, y) || isWater(x - r, y) || isWater(x, y + r) || isWater(x, y - r) || isWater(x + r * .7, y + r * .7) || isWater(x - r * .7, y - r * .7);
  const flat = (x, y, r) => { const h = gy(x, y); return Math.abs(gy(x + r, y) - h) < 3.5 && Math.abs(gy(x - r, y) - h) < 3.5 && Math.abs(gy(x, y + r) - h) < 3.5 && Math.abs(gy(x, y - r) - h) < 3.5; };

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
    if (o.rough) { const p = src.attributes.position, ry = o.ry == null ? 1 : o.ry; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (grng() - .5) * o.rough, p.getY(i) + (grng() - .5) * o.rough * ry, p.getZ(i) + (grng() - .5) * o.rough); }
    const g = src.index ? src.toNonIndexed() : src; if (g !== src) src.dispose();
    if (o.m) g.applyMatrix4(o.m);
    g.computeVertexNormals(); g.computeBoundingBox();
    const bb = g.boundingBox, h = Math.max(1e-3, bb.max.y - bb.min.y), pos = g.attributes.position, n = pos.count, arr = new Float32Array(n * 3);
    const f = typeof col === 'function' ? col : Array.isArray(col) ? grad(col[0], col[1]) : (() => _c.c.setHex(col));
    const ao = o.ao == null ? .22 : o.ao, jit = o.jit == null ? .08 : o.jit;
    for (let i = 0; i < n; i += 3) { const j = 1 + (grng() - .5) * 2 * jit; for (let k = 0; k < 3 && i + k < n; k++) { const v = i + k, yy = (pos.getY(v) - bb.min.y) / h, c = f(yy), m = (1 - ao * (1 - yy)) * j; arr[v * 3] = c.r * m; arr[v * 3 + 1] = c.g * m; arr[v * 3 + 2] = c.b * m; } }
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
    birch: { h: 56, sway: 1.3, mk: () => merge([pt(cyl(2.2, 3.4, 42, 6), [0xd8d4ca, 0xf2efe6]), pt(cyl(3.5, 3.5, 1.6, 6), 0x2a2826, { m: M(0, 9) }), pt(cyl(3.2, 3.2, 1.4, 6), 0x2a2826, { m: M(0, 19) }), pt(cyl(2.9, 2.9, 1.2, 6), 0x2a2826, { m: M(0, 30) }), pt(ico(10, 0), [0x7a9a3a, 0xb8cc5a], { m: M(0, 44), rough: 3 }), pt(ico(7, 0), [0x7a9a3a, 0xc0d060], { m: M(5, 37, 3), rough: 2.4 })]) },
    heather: { h: 10, sway: .6, mk: () => merge([pt(ico(7, 0), [0x4a4a3a, 0x8a5a9a], { m: M(0, 2, 0, 0, 0, 0, 1.2, .5, 1.2), rough: 2.5 }), pt(ico(6, 0), [0x4a5a3a, 0x9a62a8], { m: M(7, 1.5, 3, 0, .7, 0, 1.1, .45, 1.1), rough: 2 }), pt(ico(5, 0), [0x4a5a3a, 0x7a4e8a], { m: M(-6, 1.2, 4, 0, 1.4, 0, 1.1, .5, 1.1), rough: 2 })]) },
    boulder: { h: 0, obst: 11, mk: () => merge([pt(ico(10, 1), [0x4e514e, 0x8e918c], { m: M(0, 5, 0, 0, 0, 0, 1.25, .85, 1), rough: 3.2 })]) },
    drift: { h: 0, mk: () => merge([pt(ico(14, 1), [0xd8e2ea, 0xffffff], { m: M(0, 0, 0, 0, 0, 0, 1.7, .32, 1), rough: 2, ao: .12 })]) },
    deadtree: { h: 50, sway: .3, mk: () => merge([pt(cyl(2.6, 5, 46, 6), GREY, { rough: .8 }), pt(cyl(1.2, 2.4, 22, 4), GREY, { m: M(0, 30, 0, 0, 0, -.9) }), pt(cyl(1, 2, 18, 4), GREY, { m: M(0, 38, 0, .8, 0, .7) }), pt(cyl(.8, 1.6, 12, 4), GREY, { m: M(0, 22, 0, -.6, 0, 1.1) })]) },
    /* the Wall / beyond */
    blackpine: { h: 80, sway: .8, obst: 6, mk: () => merge([pt(cyl(2.8, 5, 36, 6), [0x1a1410, 0x3a2e24]), pt(cone(19, 38, 7), snowTip(0x0e1a12, 0x1c3220, .85), { m: M(0, 22), rough: 1.6 }), pt(cone(13, 34, 7), snowTip(0x101e14, 0x203826, .8), { m: M(0, 44), rough: 1.3 }), pt(cone(7, 24, 6), snowTip(0x12201a, 0x243c2a, .7), { m: M(0, 62) })]) },
    iceshard: { h: 0, shiny: { specular: 0xffffff, shininess: 160, opacity: .82 }, mk: () => merge([pt(oct(5), [0x9ad0f0, 0xe8f8ff], { m: M(0, 12, 0, 0, 0, .12, 1, 3.2, 1), ao: .1 }), pt(oct(3.2), [0x9ad0f0, 0xe8f8ff], { m: M(5, 7, 3, .2, .8, -.25, 1, 2.6, 1), ao: .1 }), pt(oct(2.4), [0x9ad0f0, 0xe8f8ff], { m: M(-4, 5, -2, -.15, .4, .3, 1, 2.2, 1), ao: .1 })]) },
    pond: { h: 0, flat: true, shiny: { specular: 0xffffff, shininess: 220, opacity: .9 }, mk: () => merge([pt(disc(30, 12), [0xa8d0e8, 0xcfe8f6], { m: M(0, .6), rough: 4, ry: 0, ao: 0 })]) },
    weirwood: { h: 70, sway: .6, obst: 9, mk: () => merge([pt(cyl(4.5, 8, 38, 7), WHITE, { rough: 1 }), pt(cyl(1.6, 2.6, 16, 4), WHITE, { m: M(0, 26, 0, 0, 0, -1) }), pt(cyl(1.6, 2.6, 16, 4), WHITE, { m: M(0, 28, 0, .9, 0, .8) }), pt(ico(20, 1), [0x8a1820, 0xd83a3a], { m: M(0, 48, 0, 0, 0, 0, 1.3, .9, 1.3), rough: 4 }), pt(ico(11, 0), [0x8a1820, 0xe04848], { m: M(10, 40, -6), rough: 3 })]) },
    boulder_snow: { h: 0, obst: 11, mk: () => merge([pt(ico(10, 1), yy => yy > .62 ? _c.c.setHex(0xe6eef4) : _c.c.lerpColors(_a.c.setHex(0x4a4d4e), _b.c.setHex(0x80858a), yy / .62), { m: M(0, 5, 0, 0, 0, 0, 1.25, .85, 1), rough: 3 })]) },
    /* riverlands */
    willow: { h: 64, sway: 1.5, obst: 6, ds: true, mk: () => merge([pt(cyl(3.6, 6.5, 36, 6), BARK, { rough: 1 }), pt(cone(24, 30, 8), [0x6a8a3a, 0x9ab85a], { m: M(0, 38), rough: 2 }), pt(cone(18, 26, 7), [0x6a8a3a, 0xa0c060], { m: M(9, 40, 4), rough: 2 }), pt(cone(16, 24, 7), [0x6a8a3a, 0x9ab85a], { m: M(-9, 42, -5), rough: 2 }), pt(cyl(25, 22, 30, 10, true), [0x9ab85a, 0x6a8a3a], { m: M(0, 12), rough: 2.4, ao: .05 })]) },
    reed: { h: 36, sway: 2.2, ds: true, mk: () => merge([pt(quad(3, 36, 2), [0x5a7a2a, 0xc8b860], { up: true }), pt(quad(3, 32, 2), [0x5a7a2a, 0xd0c070], { m: M(3, 0, 2, 0, 1.1, .1), up: true }), pt(quad(2.6, 30, 2), [0x5a7a2a, 0xb8a850], { m: M(-3, 0, 1, 0, 2.2, -.1), up: true }), pt(oct(1.6), 0x5a3a2a, { m: M(0, 35, 0, 0, 0, 0, 1, 2.2, 1) })]) },
    mill: { h: 0, obst: 18, spin: .9, hub: [40, 13.5], ds: true, mk: () => merge([pt(box(26, 30, 26), [0x6e6a60, 0x9e9888], { rough: .6 }), pt(cone(21, 16, 4), [0x3a2c22, 0x5a4634], { m: M(0, 30, 0, 0, Math.PI / 4, 0) }), pt(cyl(1.6, 1.6, 6, 5), [0x3a2c22, 0x5a4634], { m: M(0, 40, 11, Math.PI / 2, 0, 0) }), pt(box(5, 7, 1), 0x2a1e16, { m: M(0, 0, 13) }),
      pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2) }), pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2, 0, 0, Math.PI / 2) }), pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2, 0, 0, Math.PI) }), pt(quad(6, 28, 1), [0xd8ccae, 0xf0e6cc], { m: M(0, 40, 14.2, 0, 0, -Math.PI / 2) })]) },
    oak: { h: 66, sway: .9, obst: 7, mk: () => merge([pt(cyl(4.2, 7, 32, 6), BARK, { rough: 1.2 }), pt(cyl(2, 3, 14, 4), BARK, { m: M(0, 24, 0, 0, 0, -.8) }), pt(ico(22, 1), [0x2e6a26, 0x6aa842], { m: M(0, 46), rough: 4.5 }), pt(ico(14, 0), [0x2e6a26, 0x72b048], { m: M(14, 38, 6), rough: 3.5 }), pt(ico(12, 0), [0x2e6a26, 0x62a03c], { m: M(-13, 40, -5), rough: 3 })]) },
    bush: { h: 12, sway: .7, mk: () => merge([pt(ico(9, 0), [0x2c5226, 0x5a9040], { m: M(0, 3, 0, 0, 0, 0, 1.25, .75, 1.25), rough: 3.5 }), pt(ico(6, 0), [0x2c5226, 0x62984a], { m: M(8, 2, 4, 0, 0, 0, 1.1, .7, 1.1), rough: 2.5 })]) },
    /* vale */
    fir: { h: 80, sway: .7, obst: 5, mk: () => merge([pt(cyl(2.6, 4.6, 26, 6), TRUNK), pt(cone(15, 26, 6), [0x1e4a2c, 0x2e6a3c], { m: M(0, 14), rough: 1.2 }), pt(cone(12, 24, 6), [0x204c2e, 0x30703e], { m: M(0, 30), rough: 1 }), pt(cone(9, 22, 6), [0x22502f, 0x327440], { m: M(0, 46), rough: 1 }), pt(cone(5.5, 18, 6), snowTip(0x24522f, 0x347842, .6), { m: M(0, 62) })]) },
    spire: { h: 0, obst: 16, mk: () => merge([pt(cone(15, 112, 6), [0x5e636c, 0x9ca3ac], { rough: 5, ry: .2 }), pt(cone(9, 60, 5), [0x5e636c, 0x8e959e], { m: M(12, 0, 6, 0, .6, -.15), rough: 3 }), pt(cone(7, 40, 5), [0x5e636c, 0x8e959e], { m: M(-10, 0, -5, .1, 1.3, .18), rough: 2.5 })]) },
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
    outcrop: { h: 0, obst: 20, mk: () => merge([pt(ico(14, 1), [0x5a2e1e, 0xa8644a], { m: M(0, 10, 0, .1, 0, -.15, 1, 1.7, .85), rough: 4.5 }), pt(ico(10, 1), [0x5a2e1e, 0x9a5a40], { m: M(13, 6, 5, -.1, .7, .3, 1, 1.4, .9), rough: 3.5 }), pt(ico(8, 0), [0x5a3424, 0x8a5a44], { m: M(-11, 4, -6, .2, 1.4, -.2, 1, 1.2, 1), rough: 3 })]) },
    glint: { h: 0, glow: true, mk: () => merge([pt(oct(2.2), [0xd0a020, 0xfff0a0], { ao: 0, jit: .2 })]) },
    /* dorne */
    palm: { h: 62, sway: 1.6, obst: 4, ds: true, mk: () => { const p = [pt(cyl(2.8, 5, 54, 5), [0x6a4e30, 0xa88a60], { rough: 1 })];
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; p.push(pt(quad(9, 30, 2), [0x3a7a2e, 0x7ab848], { m: M(Math.cos(a) * 3, 54, Math.sin(a) * 3, 0, -a, 0).multiply(M(0, 0, 0, 1.15 + (k % 2) * .2, 0, 0)) })); }
      p.push(pt(oct(2.6), 0x8a5a30, { m: M(0, 53) })); return merge(p); } },
    cactus: { h: 0, mk: () => merge([pt(cyl(5, 6, 34, 7), CACT, { rough: .8 }), pt(cyl(3, 3, 11, 5), CACT, { m: M(5, 18, 0, 0, 0, -Math.PI / 2) }), pt(cyl(2.8, 3, 14, 5), CACT, { m: M(14, 18, 0) }), pt(cyl(2.6, 2.6, 8, 5), CACT, { m: M(-5, 22, 0, 0, 0, Math.PI / 2) }), pt(cyl(2.4, 2.6, 10, 5), CACT, { m: M(-12, 22, 0) }), pt(oct(1.6), 0xf0b0c0, { m: M(0, 34.5), ao: 0 })]) },
    pillar: { h: 0, obst: 12, mk: () => merge([pt(cyl(8, 12, 70, 6), SAND, { rough: 3, ry: .3 }), pt(ico(10, 0), [0x8a3a22, 0xc06a40], { m: M(0, 70, 0, 0, 0, 0, 1.2, .5, 1.2), rough: 2 }), pt(cyl(5, 7, 28, 5), [0x8a3a22, 0xc87046], { m: M(13, 0, 4, 0, .5, 0), rough: 2 })]) },
    dune: { h: 0, mk: () => merge([pt(ico(60, 1), [0xc8a66a, 0xf0d8a0], { m: M(0, 0, 0, 0, 0, 0, 1, .16, .7), rough: 4, ao: .08 })]) },
    drygrass: { h: 14, sway: 1.8, ds: true, mk: () => crossQuads(10, 14, 2, [0x9a7a3a, 0xe8d088], [0x9a7a3a, 0xe0c880], true) },
    /* iron islands / coast */
    wetrock: { h: 0, obst: 13, shiny: { specular: 0x9aa4ac, shininess: 90 }, mk: () => merge([pt(ico(13, 1), [0x141618, 0x3a4248], { m: M(0, 5, 0, 0, 0, 0, 1.3, .6, 1), rough: 3.5 }), pt(ico(7, 0), [0x141618, 0x343c42], { m: M(11, 3, 6, 0, 0, 0, 1.2, .6, 1), rough: 2.4 })]) },
    driftwood: { h: 0, mk: () => merge([pt(cyl(2.4, 4, 42, 5), DRIFT, { m: M(0, 3, 0, 0, 0, Math.PI / 2 - .08), rough: 1 }), pt(cyl(1.2, 2, 14, 4), DRIFT, { m: M(-10, 4, 0, .5, 0, -.9) })]) },
    seastack: { h: 0, obst: 18, mk: () => merge([pt(cyl(9, 17, 92, 7), [0x1e2226, 0x4a5058], { rough: 4, ry: .2 }), pt(ico(10, 0), [0x2a2e32, 0x5a6068], { m: M(0, 92, 0, 0, 0, 0, 1.1, .6, 1.1), rough: 3 }), pt(ico(2.2, 0), 0xf4f4f4, { m: M(3, 98, 2), ao: 0 }), pt(ico(2, 0), 0xf4f4f4, { m: M(-4, 97, -2), ao: 0 }), pt(oct(2.4), 0xe8ecee, { m: M(6, 50, 9, 0, 0, 0, 1, .3, 1), ao: 0 })]) },
    perch: { h: 28, sway: .2, mk: () => merge([pt(cyl(1.4, 2, 26, 5), [0x4a3a2a, 0x7a6a56], { m: M(0, 0, 0, 0, 0, .08) }), pt(ico(3, 0), 0xf4f4f4, { m: M(2, 28, 0, 0, 0, 0, 1.3, 1, .9), ao: .05 }), pt(ico(1.8, 0), 0xf4f4f4, { m: M(4.6, 30.5, 0), ao: .05 }), pt(oct(.9), 0xe0a020, { m: M(6.3, 30.3, 0, 0, 0, 0, 1.4, .6, .6), ao: 0 }), pt(quad(3, 4, 1), 0x3a3a3a, { m: M(2, 29, 1.2, 0, 0, 1.1), ao: 0 })]) },
    seagrass: { h: 14, sway: 1.8, ds: true, mk: () => crossQuads(10, 14, 2, [0x4a6a4a, 0x9ab08a], [0x4a6a4a, 0xa0b890]) },
    /* G2: the details that make each place its own */
    menhir: { h: 0, obst: 9, mk: () => merge([pt(box(12, 46, 7, 1, 3, 1), [0x4a4c4a, 0x8a8e88], { rough: 2.2, ry: .4 }), pt(box(6, 3, 4), [0x3a5a32, 0x5a7a46], { m: M(2, 44, 0, .2, .3, .1), ao: 0 })]) },
    firdark: { h: 96, sway: .6, obst: 6, mk: () => merge([pt(cyl(2.8, 5, 30, 6), [0x22180f, 0x3e2c1c]), pt(cone(17, 30, 7), [0x0c2214, 0x173a22], { m: M(0, 16), rough: 1.3 }), pt(cone(14, 28, 7), [0x0e2616, 0x1a4026], { m: M(0, 34), rough: 1.1 }), pt(cone(10, 26, 6), [0x10281a, 0x1c4428], { m: M(0, 52), rough: 1 }), pt(cone(6, 22, 6), [0x122c1a, 0x1e482a], { m: M(0, 70) })]) },
    fern: { h: 8, sway: 1.2, ds: true, mk: () => crossQuads(12, 8, 2, [0x1e3a1a, 0x3e6a30], [0x1e3a1a, 0x46723a], true) },
    mushroom: { h: 0, mk: () => merge([pt(cyl(.9, 1.2, 4, 5), 0xe8e0d0, { ao: .05 }), pt(cone(3, 2.4, 7), [0x8a2a1a, 0xc8402a], { m: M(0, 4) }), pt(cyl(.7, .9, 3, 5), 0xe8e0d0, { m: M(4, 0, 2), ao: .05 }), pt(cone(2.2, 1.8, 6), [0x8a2a1a, 0xc8402a], { m: M(4, 3, 2) })]) },
    vine: { h: 14, sway: .5, mk: () => merge([pt(box(1.4, 16, 1.4), [0x4a3420, 0x6a4c30]), pt(box(30, .8, .8), 0x5a4a3a, { m: M(0, 13) }), pt(ico(5, 0), [0x2e5a22, 0x5a8a3a], { m: M(-9, 10, 0, 0, 0, 0, 1.3, 1, .8), rough: 1.8 }), pt(ico(5, 0), [0x2e5a22, 0x5a8a3a], { m: M(0, 11, 0, 0, 0, 0, 1.3, 1, .8), rough: 1.8 }), pt(ico(5, 0), [0x2e5a22, 0x5a8a3a], { m: M(9, 10, 0, 0, 0, 0, 1.3, 1, .8), rough: 1.8 })].concat(dots([[-8, 7, 3], [1, 8, 3], [8, 7, 3], [-3, 7, -3]], 1.5, 0x5a2a6a))) },
    sunflower: { h: 20, sway: 1.2, ds: true, mk: () => merge([pt(cyl(.6, .8, 18, 4), 0x4a6a2a), pt(cyl(3.4, 3.4, .8, 8), 0xf0c020, { m: M(0, 18, .6, Math.PI / 2 - .3, 0, 0), ao: 0 }), pt(cyl(1.6, 1.6, 1, 8), 0x4a2a10, { m: M(0, 18.2, 1.1, Math.PI / 2 - .3, 0, 0), ao: 0 })]) },
    scree: { h: 0, mk: () => merge([pt(ico(4, 0), [0x6a6e72, 0x9aa0a4], { m: M(0, 1.5, 0, 0, 0, 0, 1.3, .6, 1), rough: 1.2 }), pt(ico(3, 0), [0x6a6e72, 0xa0a6aa], { m: M(7, 1, 3, 0, 0, 0, 1.2, .6, 1), rough: 1 }), pt(ico(2.4, 0), [0x6a6e72, 0x9aa0a4], { m: M(-6, 1, 4), rough: .8 }), pt(ico(3.2, 0), [0x5e6266, 0x8e9498], { m: M(3, 1, -7, 0, 0, 0, 1.2, .5, 1), rough: 1 }), pt(ico(2, 0), [0x6a6e72, 0x9aa0a4], { m: M(-4, .8, -5) })]) },
    scrub: { h: 9, sway: .8, mk: () => merge([pt(ico(6, 0), [0x6a5a30, 0xa89a58], { m: M(0, 2, 0, 0, 0, 0, 1.3, .7, 1.3), rough: 3 }), pt(ico(4, 0), [0x6a5a30, 0xb0a060], { m: M(6, 1.5, 3), rough: 2 }), pt(cyl(.4, .6, 9, 3), 0x5a4a30, { m: M(-4, 0, -3, .3, 0, .4) })]) },
    basalt: { h: 0, obst: 12, mk: () => merge([pt(cyl(6, 6.5, 34, 6), [0x141214, 0x3a3436], { rough: .6, ry: 0 }), pt(cyl(5, 5.5, 24, 6), [0x141214, 0x342e30], { m: M(10, 0, 4), rough: .5, ry: 0 }), pt(cyl(5.5, 6, 16, 6), [0x141214, 0x302a2c], { m: M(-8, 0, 6), rough: .5, ry: 0 }), pt(cyl(4.5, 5, 28, 6), [0x141214, 0x3a3436], { m: M(2, 0, -9), rough: .5, ry: 0 })]) },
    ashtree: { h: 46, sway: .2, mk: () => merge([pt(cyl(2.4, 4.6, 42, 6), [0x0e0c0c, 0x2a2422], { rough: .8 }), pt(cyl(1, 2, 18, 4), [0x0e0c0c, 0x2a2422], { m: M(0, 28, 0, 0, 0, -1) }), pt(cyl(.9, 1.8, 15, 4), [0x0e0c0c, 0x2a2422], { m: M(0, 34, 0, .9, 0, .8) }), pt(oct(1.2), 0xff6a20, { m: M(1.5, 12, 2.5), ao: 0 })]) },
    embers: { h: 0, glow: true, mk: () => merge([pt(disc(5, 6), [0x8a2a0a, 0xff7a2a], { m: M(0, .6), ao: 0, jit: .3 }), pt(oct(1.2), 0xffb050, { m: M(2, 1.4, 1), ao: 0 }), pt(oct(1), 0xffd070, { m: M(-2, 1.2, -1), ao: 0 })]) },
    bogpool: { h: 0, flat: true, shiny: { specular: 0x9aa890, shininess: 120, opacity: .85 }, mk: () => merge([pt(disc(22, 10), [0x2a3a26, 0x3e5236], { m: M(0, .5, 0, 0, 0, 0, 1.4, 1, 1), rough: 4, ry: 0, ao: 0 })]) },
    cattail: { h: 30, sway: 2, ds: true, mk: () => merge([pt(quad(2, 28, 2), [0x3a5a22, 0x7a8a3a], { up: true }), pt(quad(2, 24, 2), [0x3a5a22, 0x7a8a3a], { m: M(3, 0, 1, 0, 1.3, .12), up: true }), pt(cyl(1.1, 1.1, 6, 5), 0x5a3418, { m: M(0, 26) }), pt(cyl(1, 1, 5, 5), 0x5a3418, { m: M(3.6, 21, 1.2, 0, 0, .12) })]) },
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
      { t: 'heather', n: 60, lod: 0, clump: .3, off: 4 }, { t: 'boulder_snow', n: 10, tilt: .25 }, { t: 'drift', n: 26, lod: 0, s: [.8, 1.6] }, { t: 'deadtree', n: 6 },
      { t: 'menhir', place: 'grove', k: 1, m: [4, 6], r: 46, chance: .45, s: [.8, 1.25], tilt: .12 }],
      say: ['Pines and old snow. Wolves sing at night.', 'Birch and heather under a grey sky. The cold bites early.'] },
    wolfswood: { wind: .3, ground: 0x34463a, grass: [.42, .6, .44], grassK: .55, props: [
      { t: 'firdark', n: 70, clump: -.7, off: 21, s: [.85, 1.35] }, { t: 'firdark', n: 30, s: [.6, .9] }, { t: 'pine_l', n: 18, clump: .2, off: 22 }, { t: 'deadtree', n: 6, s: [.8, 1.1] },
      { t: 'fern', n: 70, lod: 0, s: [.8, 1.4] }, { t: 'mushroom', n: 24, lod: 0, s: [.8, 1.6] }, { t: 'boulder', n: 8, tint: [.6, .72, .6], tilt: .3 }, { t: 'drift', n: 8, lod: 0, s: [.6, 1] }],
      say: ['The Wolfswood: firs so close the snow never reaches the ground.', 'Ferns and red caps under black branches. Something watches from the trees.'] },
    wall: { wind: .4, ground: 0xb8c4cc, grass: [.8, .86, .9], grassK: .25, props: [
      { t: 'icefield', n: 4, s: [.8, 1.5] },
      { t: 'blackpine', n: 22, clump: .55, off: 2 }, { t: 'boulder_snow', n: 10, tilt: .2 }, { t: 'weirwood', place: 'grove', k: 2, m: [3, 5], r: 70, s: [.8, 1.2] },
      { t: 'iceshard', n: 26, lod: 0, s: [.6, 1.5] }, { t: 'pond', n: 5, lod: 0, s: [.8, 1.5] }, { t: 'drift', n: 26, lod: 0, s: [.8, 1.8] }],
      say: ['Black pines and ice. The wind comes from beyond.', 'Frozen ponds and white trees with red leaves. Nothing moves.'] },
    beyond: { wind: .45, ground: 0xc8d4dc, grass: [.8, .86, .92], grassK: .15, props: [
      { t: 'icefield', n: 5, s: [.9, 1.6] },
      { t: 'blackpine', n: 12, clump: .6, off: 3 }, { t: 'boulder_snow', n: 14, tilt: .2 }, { t: 'weirwood', place: 'grove', k: 2, m: [3, 5], r: 80, s: [.9, 1.3] },
      { t: 'iceshard', n: 40, lod: 0, s: [.7, 1.8] }, { t: 'pond', n: 6, lod: 0, s: [.9, 1.6] }, { t: 'drift', n: 36, lod: 0, s: [1, 2] }, { t: 'deadtree', n: 8, s: [.7, 1] }],
      say: ['Ice shards and dead groves. The old gods watch.', 'Snow to the horizon. The wind never stops.'] },
    winter: { wind: .6, ground: 0xe2ecf2, grass: [.86, .9, .96], grassK: .06, props: [
      { t: 'icefield', n: 9, s: [1, 2] }, { t: 'iceshard', n: 60, lod: 0, s: [.9, 2.4], tilt: .2 }, { t: 'drift', n: 44, lod: 0, s: [1.2, 2.4] }, { t: 'boulder_snow', n: 8, s: [1, 1.6] },
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
      { t: 'oak', n: 30, clump: .5, off: 7 }, { t: 'orchard', place: 'rows', rows: 3, gap: 44, rgap: 48, from: 150, max: 60, s: [.9, 1.1] }, { t: 'boulder', n: 4 },
      { t: 'wheat', lod: 0, place: 'field', fields: 2, w: [180, 260], d: [120, 180], gap: 24 }, { t: 'poppy', n: 50, lod: 0, clump: -.5, off: 8 }, { t: 'rose', n: 18, lod: 0 },
      { t: 'vine', place: 'rows', rows: 4, gap: 34, rgap: 26, from: 230, max: 64, s: [.9, 1.1] }, { t: 'sunflower', n: 30, lod: 0, clump: .5, off: 25, s: [.8, 1.2] }],
      say: ['Oaks and wheat to the horizon. Bees in the roses.', 'Orchards in neat rows. Poppies at the field\'s edge.'] },
    crownlands: { wind: 1, ground: 0x7a9448, grass: [.52, .88, .38], props: [
      { t: 'elm', n: 26, clump: .35, off: 9 }, { t: 'farm', n: 2, place: 'road', min: 50, max: 260, s: [.9, 1.15] }, { t: 'haystack', n: 3, place: 'anchor', of: 'farm', r: 40, s: [.8, 1.2] },
      { t: 'wheat', lod: 0, place: 'field', fields: 2, w: [160, 240], d: [110, 170], gap: 24 }, { t: 'hedge', lod: 0, place: 'edge', gap: 44 }, { t: 'bush', n: 16, lod: 0 },
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
      { t: 'oak', n: 30, clump: .4, off: 11 }, { t: 'autumnoak', n: 14, clump: .5, off: 30 }, { t: 'goldtree', n: 8 }, { t: 'outcrop', n: 9, s: [.8, 1.5], tilt: .1 }, { t: 'boulder', n: 8, tint: [1, .78, .66] },
      { t: 'scree', n: 20, lod: 0, tint: [1, .75, .6] },
      { t: 'glint', n: 3, lod: 0, place: 'anchor', of: 'outcrop', r: 12, dy: [8, 26], s: [.8, 1.4] }, { t: 'bush', n: 18, lod: 0 }],
      say: ['Gold-leafed trees over red rock. Ore glints in the stone.', 'Outcrops and old mine mouths. Hills roll west.'] },
    dorne: { wind: 1, ground: 0xd8b878, grass: [1, .9, .55], props: [
      { t: 'palm', n: 22, place: 'water', r: 90, s: [.8, 1.25] }, { t: 'palm', n: 8 }, { t: 'pillar', n: 6, s: [.7, 1.4] }, { t: 'dune', n: 8, s: [.8, 1.6], yaw: [0, .4] }, { t: 'cactus', n: 24, s: [.6, 1.2] },
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
      say: ['Black rock, ash and a warm wind out of the ground.', 'Burnt trees on the slopes. The stone is warm to the touch.'] }
  };
  N.describe = (x, y) => { const b = BIOMES[N.biomeAt(x, y)] || BIOMES.reach; return b.say[h2(Math.floor(x / 900), Math.floor(y / 900)) & 1]; };

  /* ---------- geometry / material caches ---------- */
  const geoFor = type => { if (GEO[type]) return GEO[type]; grng = mkRng(hs(type)); let g = null;
    if (type === 'tree' && R.props && R.props.tree) { try { const m = R.props.tree(GEO._treeBiome || 'reach'); g = m && m.geometry; } catch (e) { g = null; } }
    if (!g) g = PROPS[type].mk(); g.userData.tris = g.attributes.position.count / 3; return GEO[type] = g; };
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
  float wv = sin(uTime * uFreq + ph) + 0.45 * sin(uTime * uFreq * 2.3 + ph * 1.9 + 1.3);
  transformed.x += wv * uSway * hF; transformed.z += wv * uSway * 0.35 * hF;`;
  function matFor(type, biome) {
    const key = type + '|' + biome; if (MAT[key]) return MAT[key];
    const P = PROPS[type], B = BIOMES[biome] || BIOMES.reach; let m;
    if (P.glow) m = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (P.shiny) m = new THREE.MeshPhongMaterial({ vertexColors: true, specular: P.shiny.specular || 0xffffff, shininess: P.shiny.shininess || 100, transparent: P.shiny.opacity != null, opacity: P.shiny.opacity == null ? 1 : P.shiny.opacity, side: P.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: P.shiny.opacity == null });
    else m = new THREE.MeshLambertMaterial({ vertexColors: true, side: P.ds ? THREE.DoubleSide : THREE.FrontSide });
    const sway = (P.sway || 0) * (B.wind || 1), spin = P.spin || 0;
    if (sway || P.bill || spin) {
      const bill = !!P.bill, uni = { uSway: { value: sway }, uFreq: { value: .9 + .9 * (B.wind || 1) }, uH: { value: Math.max(1, P.h || 1) }, uSpin: { value: spin }, uHub: { value: new THREE.Vector2(P.hub ? P.hub[0] : 0, P.hub ? P.hub[1] : 1e9) } };
      m.userData.uni = uni;
      m.onBeforeCompile = sh => { sh.uniforms.uTime = U.uTime; for (const k in uni) sh.uniforms[k] = uni[k];
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uSway, uFreq, uH, uSpin; uniform vec2 uHub;').replace('#include <begin_vertex>', SHADER(bill)); };
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
  function build(cx, cy, lod) {
    const t0 = performance.now(), key = cx + ',' + cy, x0 = cx * CHUNK, y0 = cy * CHUNK, rng = mkRng(h2(cx, cy));
    const ch = { key, cx, cy, lod: lod || 0, group: null, meshes: [], obst: [], n: 0, tris: 0, ms: 0, biome: null, fields: [], recs: {} };
    if (!has()) return ch;
    v3();
    const cnt = {}; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const b = N.biomeAt(x0 + (i + .5) * 200, y0 + (j + .5) * 200); cnt[b] = (cnt[b] || 0) + 1; }
    const order = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]); ch.biome = order[0]; ch.biomes = order;
    const L = localWorld(x0, y0), recs = ch.recs;
    const ok = (x, y, want) => x >= x0 && y >= y0 && x < x0 + CHUNK && y < y0 + CHUNK && !isWater(x, y) && L.poiD(x, y) >= POI_R && L.roadD(x, y) >= ROAD_R && N.biomeAt(x, y) === want;
    const add = (type, x, y, e, o) => { if (ch.n >= MAX_INST) return false; const P = PROPS[type]; o = o || {};
      const s = e.s ? e.s[0] + rng() * (e.s[1] - e.s[0]) : .82 + rng() * .46, yaw = o.yaw != null ? o.yaw : e.yaw ? e.yaw[0] + (rng() - .5) * 2 * e.yaw[1] : rng() * Math.PI * 2;
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
          if (!pass(fx, fy) || !flat(fx, fy, Math.min(w, d) / 2)) continue; const ux = Math.cos(a), uy = Math.sin(a); ch.fields.push({ x: fx, y: fy, w, d, a }); let placed = 0;
          for (let i = -w / 2; i < w / 2 && ch.n < MAX_INST; i += e.gap) for (let j = -d / 2; j < d / 2; j += e.gap) { const jx = i + (rng() - .5) * 8, jy = j + (rng() - .5) * 8, x = fx + ux * jx - uy * jy, y = fy + uy * jx + ux * jy; if ((recs[e.t] || []).length >= PER_TYPE) break; if (pass(x, y)) { add(e.t, x, y, e, { yaw: a + (rng() - .5) * .3 }); placed++; } } } }
      else if (pl === 'edge') { for (const F of ch.fields) { const ux = Math.cos(F.a), uy = Math.sin(F.a); for (const side of [-1, 1]) for (let i = -F.w / 2; i < F.w / 2; i += e.gap) { const j = side * (F.d / 2 + 8), x = F.x + ux * i - uy * j, y = F.y + uy * i + ux * j; if ((recs[e.t] || []).length >= PER_TYPE) break; if (pass(x, y)) add(e.t, x, y, e, { yaw: F.a }); } } }
      else if (pl === 'grove') { for (let g = 0; g < e.k; g++) { const gx = x0 + 80 + rng() * (CHUNK - 160), gy2 = y0 + 80 + rng() * (CHUNK - 160), m = e.m[0] + Math.floor(rng() * (e.m[1] - e.m[0] + 1)); for (let i = 0; i < m; i++) { const a = rng() * Math.PI * 2, d = 20 + rng() * (e.r - 20), x = gx + Math.cos(a) * d, y = gy2 + Math.sin(a) * d; if (pass(x, y)) add(e.t, x, y, e); } } }
      else if (pl === 'anchor') { for (const a of (recs[e.of] || []).slice()) for (let i = 0; i < n; i++) { const an = rng() * Math.PI * 2, d = rng() * e.r * a.s, x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d; if (ok(x, y, want)) add(e.t, x, y, e); } }
    };
    const B0 = BIOMES[ch.biome] || BIOMES.reach; for (const e of B0.props) run(e, ch.biome);
    if (order[1] && cnt[order[1]] >= 2) { const B1 = BIOMES[order[1]]; let used = 0; for (const e of B1.props) { if (Object.keys(recs).length >= MAX_DRAWS) break; if (used >= 3) break; if (!recs[e.t]) used++; run(e, order[1], 60); } }
    // one InstancedMesh per type
    ch.group = new THREE.Group(); ch.group.name = 'chunk ' + key;
    for (const type in recs) { const list = recs[type]; if (!list.length) continue; if (ch.meshes.length >= MAX_DRAWS) break;
      const geo = geoFor(type), im = new THREE.InstancedMesh(geo, matFor(type, ch.biome), list.length); im.name = type; im.frustumCulled = true;
      for (let i = 0; i < list.length; i++) { const r = list[i]; _p.p.set(r.x, gy(r.x, r.y) + r.dy, r.y); _p.q.setFromEuler(_p.e.set(r.tx, r.yaw, r.tz)); _p.s.set(r.s, r.s, r.s); _p.m.compose(_p.p, _p.q, _p.s); im.setMatrixAt(i, _p.m); _col.c.setRGB(r.r, r.g, r.b); im.setColorAt(i, _col.c); }
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
    v3(); grassAt = { x: px, y: py }; const b = N.biomeAt(px, py), B = BIOMES[b] || BIOMES.reach, cell = 100, out = [];
    const L = localWorld(Math.floor(px / CHUNK) * CHUNK, Math.floor(py / CHUNK) * CHUNK);
    for (let gx = Math.floor((px - GRASS_R) / cell); gx <= Math.floor((px + GRASS_R) / cell); gx++) for (let gyy = Math.floor((py - GRASS_R) / cell); gyy <= Math.floor((py + GRASS_R) / cell); gyy++) {
      const rng = mkRng(h2(gx * 3 + 1, gyy * 3 + 2)); const k = 3 + Math.floor(rng() * 5);
      for (let i = 0; i < k; i++) { const x = gx * cell + rng() * cell, y = gyy * cell + rng() * cell, dd = (x - px) ** 2 + (y - py) ** 2, thin = rng(); if (dd > GRASS_R * GRASS_R || isWater(x, y) || L.roadD(x, y) < 18 || L.poiD(x, y) < 50) continue;
        const bb = BIOMES[N.biomeAt(x, y)] || B; if (bb.grassK != null && thin > bb.grassK) continue; const g = bb.grass || [1, 1, 1], br = .85 + rng() * .3; out.push({ x, y, dd, s: .7 + rng() * .7, r: g[0] * br, g: g[1] * br, b: g[2] * br }); } }
    out.sort((a, b) => a.dd - b.dd); const n = Math.min(GRASS_MAX, out.length);
    for (let i = 0; i < n; i++) { const r = out[i]; _p.p.set(r.x, gy(r.x, r.y), r.y); _p.q.identity(); _p.s.set(r.s, r.s, r.s); _p.m.compose(_p.p, _p.q, _p.s); grass.setMatrixAt(i, _p.m); _col.c.setRGB(r.r, r.g, r.b); grass.setColorAt(i, _col.c); }
    grass.count = n; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true; N.stats.grass = n;
    const uni = grass.material.userData.uni; if (uni) { uni.uSway.value = PROPS.tuft.sway * (B.wind || 1); uni.uFreq.value = .9 + .9 * (B.wind || 1); }
  }
  N.grassCount = () => (grass ? grass.count : 0);

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
    scene = r.scene; lastCell = null; return true; };
  const tryAttach = () => { if (R.render3d && R.render3d.scene && (scene !== R.render3d.scene || !root)) N.attach(R.render3d); };
  R.bus.on('render3d', () => { tryAttach(); if (root) { N.refresh(); } });
  N.update = dt => {
    tryAttach(); if (!root) return; U.uTime.value = R.t;
    const [px, py] = centre(), cell = Math.floor(px / CHUNK) + ',' + Math.floor(py / CHUNK);
    if (cell !== lastCell) N.refresh();
    for (let i = 0; i < BUILDS && pending.length; i++) { const q = pending.shift(); N.build(q.cx, q.cy, q.lod); }
    if (!grassAt || (grassAt.x - px) ** 2 + (grassAt.y - py) ** 2 > GRASS_STEP * GRASS_STEP) regrass(px, py);
  };
  N.reset = () => { for (const ch of Array.from(N.chunks.values())) disposeChunk(ch); pending = []; lastCell = null; grassAt = null; N.obstacles = [];
    if (grass) { if (grass.parent) grass.parent.remove(grass); try { grass.dispose(); } catch (e) {} N.stats.disposed.meshes++; grass = null; }
    for (const k in GEO) { if (k[0] === '_') continue; try { GEO[k].dispose(); } catch (e) {} N.stats.disposed.geoms++; delete GEO[k]; }
    for (const k in MAT) { try { MAT[k].dispose(); } catch (e) {} N.stats.disposed.mats++; delete MAT[k]; } };
  if (R.addSys) R.addSys('nature', { order: 55, update: N.update });
  // obstacles for movement: only if A06 declares the hook (R.world.extraBlocked), chaining anything already there
  if (R.world && Object.prototype.hasOwnProperty.call(R.world, 'extraBlocked')) { const prev = typeof R.world.extraBlocked === 'function' ? R.world.extraBlocked : null; R.world.extraBlocked = (x, y, r) => N.blockedAt(x, y, r) || !!(prev && prev(x, y, r)); }
  if (!N.describeFallback) N.describeFallback = BIOMES.reach.say[0];
})();
