/* HOLDOR RPG — 07_props.js (A37): low-poly 3D props for the Westeros map. three.js is a global `THREE` (vendored by A05);
   every function returns null when it is missing, nothing here touches THREE at load time.
   World axes: x east, z south (= the 2D world's y), y up; 1 unit = 1 world unit; every prop stands on y = 0.
   R.props.build(poi)        → THREE.Group for a POI {type|kind:'castle'|'town'|'camp'|'dungeon'|'shrine', x, y, house?, seat?, id?}
                               one merged vertex-coloured mesh + banner / emissive extras; userData.tris ≤ 300; position = (x, 0, y)
   R.props.tree(biome)       → Mesh: pines (north/snow), round crowns (reach/forest/riverlands), palms (dorne/desert), round by default
   R.props.rock()            → Mesh
   R.props.scatter(region, n, rng) → Group of two InstancedMeshes (trees + rocks) on walkable ground inside region.poly / region.bbox
   R.props.wall()            → the Wall: one long box along z ≈ 2600 from x 1200 to 6000 (R.data.world.wall overrides)
   R.props.update(dt)        → spins the dungeon rings (registered as system 'props' when R.addSys exists)
   R.props.tris(obj)         → triangle count of an object tree (instances counted once).                                            */
(function () {
  const R = window.R = window.R || {};
  const FB = { stark: { col: '#a9bdd0', col2: '#3b4a5a', e: '🐺' }, lannister: { col: '#e3b661', col2: '#7a1d1d', e: '🦁' }, baratheon: { col: '#e0c14a', col2: '#23231f', e: '🦌' },
    targaryen: { col: '#e14b4b', col2: '#1c1c1c', e: '🐉' }, greyjoy: { col: '#d8b74a', col2: '#1f2a30', e: '🦑' }, tyrell: { col: '#7fd06a', col2: '#2f5a2a', e: '🌹' }, martell: { col: '#f08a3c', col2: '#7a2a1a', e: '☀️' } };
  const houseOf = h => (R.data && R.data.houses && R.data.houses[h]) || (window.A_CHAMP && A_CHAMP.houses && A_CHAMP.houses[h]) || FB[h] || null;
  const has = () => typeof THREE !== 'undefined' && THREE && THREE.BufferGeometry;
  const T = () => THREE;
  /* deterministic per-prop randomness */
  const mkRng = seed => { let s = (seed >>> 0) || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const hashOf = poi => { const str = String(poi.id || poi.name || '') + '|' + Math.round(poi.x || 0) + '|' + Math.round(poi.y || 0); let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  /* ---- shared materials / caches ---- */
  const S = { mat: null, glow: {}, banner: {}, geo: {}, tree: {}, rock: null, spinners: [] };
  const mat = () => S.mat || (S.mat = new THREE.MeshLambertMaterial({ vertexColors: true }));
  const glow = hex => S.glow[hex] || (S.glow[hex] = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  /* bake a flat-shaded vertex colour: lit from above and the east, darker at the foot; returns a NON-indexed copy */
  function paint(src, hex, o) {
    o = o || {}; const geo = src.index ? src.toNonIndexed() : src.clone(); geo.computeVertexNormals(); geo.computeBoundingBox();
    const pos = geo.attributes.position, nrm = geo.attributes.normal, c = new THREE.Color(hex), bb = geo.boundingBox, h = (bb.max.y - bb.min.y) || 1, arr = new Float32Array(pos.count * 3);
    const top = o.top != null ? o.top : .22, foot = o.foot != null ? o.foot : .16;
    for (let i = 0; i < pos.count; i++) { const ny = nrm.getY(i), nx = nrm.getX(i), yy = (pos.getY(i) - bb.min.y) / h; let k = .74 + top * Math.max(0, ny) + .09 * nx + foot * yy; if (ny < -.5) k *= .55; arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo;
  }
  /* merge painted parts [{g, m?}] (non-indexed, position/normal/color) into one geometry */
  function merge(parts) {
    let n = 0; for (const p of parts) n += p.g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), v = new THREE.Vector3(), nm = new THREE.Matrix3(); let off = 0;
    for (const p of parts) { const pos = p.g.attributes.position, nr = p.g.attributes.normal, co = p.g.attributes.color; if (p.m) nm.getNormalMatrix(p.m);
      for (let i = 0; i < pos.count; i++) { const j = (off + i) * 3; v.set(pos.getX(i), pos.getY(i), pos.getZ(i)); if (p.m) v.applyMatrix4(p.m); P[j] = v.x; P[j + 1] = v.y; P[j + 2] = v.z;
        v.set(nr.getX(i), nr.getY(i), nr.getZ(i)); if (p.m) v.applyMatrix3(nm).normalize(); N[j] = v.x; N[j + 1] = v.y; N[j + 2] = v.z; C[j] = co.getX(i); C[j + 1] = co.getY(i); C[j + 2] = co.getZ(i); }
      off += pos.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
  }
  const M = (x, y, z, ry, sx, sy, sz) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz)); return m; };
  /* primitive geometries, built once, standing on y = 0 (unit sizes, scaled by the matrix) */
  function geo(k) {
    if (S.geo[k]) return S.geo[k];
    let g;
    if (k === 'box') { g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); }
    else if (k === 'cyl6') { g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, .5, 0); }
    else if (k === 'cyl4') { g = new THREE.CylinderGeometry(.85, 1, 1, 4, 1, true); g.translate(0, .5, 0); }
    /* true cones (ConeGeometry emits degenerate top triangles): n sides + an n-fan cap, apex at y = 1 */
    else if (k === 'cone6' || k === 'cone4') { const n = k === 'cone6' ? 6 : 4, v = [], o = k === 'cone4' ? Math.PI / 4 : 0; for (let i = 0; i < n; i++) { const a = o + i / n * Math.PI * 2, b = o + (i + 1) / n * Math.PI * 2, x0 = Math.cos(a), z0 = Math.sin(a), x1 = Math.cos(b), z1 = Math.sin(b);
        v.push(x1, 0, z1, x0, 0, z0, 0, 1, 0); if (i > 0 && i < n - 1) v.push(Math.cos(o), 0, Math.sin(o), x0, 0, z0, x1, 0, z1); }
      g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); }
    else if (k === 'ico') { g = new THREE.IcosahedronGeometry(1, 0); }
    else if (k === 'plane') { g = new THREE.PlaneGeometry(1, 1); }
    else if (k === 'ring') { g = new THREE.RingGeometry(.82, 1, 16, 1); }
    /* a gable roof: a triangular prism, ridge along x, standing on y = 0, 1×1×1 */
    else if (k === 'gable') { g = new THREE.BufferGeometry(); const v = [
      -.5, 0, -.5, .5, 0, -.5, .5, 1, 0, -.5, 0, -.5, .5, 1, 0, -.5, 1, 0,   /* north slope */
      .5, 0, .5, -.5, 0, .5, -.5, 1, 0, .5, 0, .5, -.5, 1, 0, .5, 1, 0,      /* south slope */
      -.5, 0, .5, -.5, 0, -.5, -.5, 1, 0,  .5, 0, -.5, .5, 0, .5, .5, 1, 0,  /* gable ends */
      -.5, 0, -.5, -.5, 0, .5, .5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0, -.5]; /* floor */
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); }
    return S.geo[k] = g;
  }
  const STONE = 0x8d8f93, STONE2 = 0x6f7378, WOOD = 0x6b4a2b, ROOF = 0x5a3a2c, SLATE = 0x2f3744, SNOW = 0xe8eef4;
  const part = (k, hex, x, y, z, sx, sy, sz, ry, o) => ({ g: paint(geo(k), hex, o), m: M(x, y, z, ry, sx, sy, sz) });
  /* ---- the house banner: a canvas texture plane on a pole ---- */
  function banner(house, w, h) {
    const hs = houseOf(house) || { col: '#9aa7b5', col2: '#2b3340', e: '' }, key = house + ':' + (hs.col || '');
    if (!S.banner[key]) { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d'); g.fillStyle = hs.col2 || '#223'; g.fillRect(0, 0, 64, 96); g.fillStyle = hs.col || '#aaa'; g.fillRect(5, 5, 54, 86);
      g.fillStyle = hs.col2 || '#223'; g.beginPath(); g.moveTo(5, 91); g.lineTo(32, 74); g.lineTo(59, 91); g.closePath(); g.fill();
      g.font = '38px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111'; try { g.fillText(hs.e || '', 32, 42); } catch (e) {}
      const tex = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      S.banner[key] = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }); }
    const grp = new THREE.Group(); const pole = new THREE.Mesh(paint(geo('box'), WOOD), mat()); pole.scale.set(2.5, h * 1.5, 2.5); grp.add(pole);
    const cloth = new THREE.Mesh(geo('plane'), S.banner[key]); cloth.scale.set(w, h, 1); cloth.position.set(w / 2 + 1.5, h * 1.5 - h / 2, 0); grp.add(cloth); grp.name = 'banner'; return grp;
  }
  /* ---- POI builders (parts in local units around the origin) ---- */
  const B = {
    castle(poi, rnd, parts, grp) {
      const seat = !!(poi.seat || poi.size === 'seat' || poi.size === 'large' || poi.big), k = seat ? 1.45 : 1, n = seat ? 4 : 2 + Math.floor(rnd() * 2);
      const half = 150 * k, wh = 60 * k, tw = 16 * k, tr = 26 * k, th = (100 + rnd() * 20) * k;
      const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
      parts.push(part('box', STONE2, 0, 0, -half, half * 2, wh, tw), part('box', STONE2, 0, 0, half, half * 2, wh, tw), part('box', STONE2, -half, 0, 0, tw, wh, half * 2), part('box', STONE2, half, 0, 0, tw, wh, half * 2));
      for (let i = 0; i < n; i++) { const c = corners[(i + (seat ? 0 : Math.floor(rnd() * 4))) % 4]; parts.push(part('cyl6', STONE, c[0], 0, c[1], tr, th, tr), part('cone6', seat ? SLATE : ROOF, c[0], th, c[1], tr * 1.25, 34 * k, tr * 1.25)); }
      parts.push(part('box', STONE, 0, 0, -10 * k, 90 * k, 120 * k, 80 * k), part('cone4', SLATE, 0, 120 * k, -10 * k, 64 * k, 36 * k, 58 * k));
      parts.push(part('box', 0x241a14, 0, 0, half + tw / 2 + .5, 34 * k, 44 * k, 2));  /* the gate, a dark doorway on the south wall */
      const bn = banner(poi.house, 34 * k, 50 * k); bn.position.set(0, 156 * k, -10 * k); grp.add(bn);
      grp.userData.radius = half * 1.5;
    },
    town(poi, rnd, parts, grp) {
      const n = 3 + Math.floor(rnd() * 3), hues = [0xb59a72, 0xc2a883, 0xa88b66, 0x9c8464];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * .6, d = 70 + rnd() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d, w = 44 + rnd() * 26, dd = 36 + rnd() * 20, h = 26 + rnd() * 10, ry = rnd() * Math.PI;
        parts.push(part('box', hues[i % 4], x, 0, z, w, h, dd, ry), part('gable', ROOF, x, h, z, w + 6, 18 + rnd() * 8, dd + 6, ry)); }
      parts.push(part('cyl6', STONE2, 0, 0, 0, 12, 10, 12), part('box', WOOD, 0, 10, 0, 3, 22, 3), part('cone6', ROOF, 0, 30, 0, 14, 10, 14)); /* the well */
      grp.userData.radius = 170;
    },
    camp(poi, rnd, parts, grp) {
      const tent = 0xc9b18a, tent2 = 0x8f7e62;
      parts.push(part('cone6', tent, -48, 0, 10, 32, 42, 32, rnd() * 3), part('cone6', tent2, 44, 0, -22, 28, 38, 28, rnd() * 3));
      for (let i = 0; i < 3; i++) parts.push(part('box', WOOD, 0, 0, 36, 22, 4, 4, i * Math.PI / 3));      /* logs */
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push(part('ico', STONE2, Math.cos(a) * 12, 0, 36 + Math.sin(a) * 12, 3.5, 3, 3.5)); } /* the fire ring */
      const ember = new THREE.Mesh(geo('plane'), glow(0xff7a2a)); ember.rotation.x = -Math.PI / 2; ember.scale.set(16, 16, 1); ember.position.set(0, 5, 36); ember.name = 'ember'; grp.add(ember);
      const flame = new THREE.Mesh(geo('cone6'), glow(0xffb347)); flame.scale.set(6, 16, 6); flame.position.set(0, 4, 36); flame.name = 'flame'; grp.add(flame);
      const light = new THREE.PointLight(0xffa040, 1.6, 320, 1.5); light.position.set(0, 26, 36); light.name = 'firelight'; grp.add(light);
      grp.userData.radius = 110;
    },
    dungeon(poi, rnd, parts, grp) {
      const dark = 0x3a3f49;
      parts.push(part('box', dark, -44, 0, 0, 20, 92, 22), part('box', dark, 44, 0, 0, 20, 92, 22), part('box', dark, 0, 92, 0, 112, 20, 24), part('box', 0x0a0b10, 0, 0, -3, 70, 92, 2));
      for (let i = 0; i < 4; i++) parts.push(part('ico', dark, -60 + i * 40, 0, 40 + rnd() * 20, 8, 5, 8));
      const pivot = new THREE.Group(); pivot.position.set(0, 50, 4); const ring = new THREE.Mesh(geo('ring'), glow(0x7cff5a)); ring.scale.set(36, 36, 1); pivot.add(ring);
      for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(geo('box'), glow(0xc8ffb0)); const a = i * Math.PI / 2; r.scale.set(4, 4, 4); r.position.set(Math.cos(a) * 33, Math.sin(a) * 33 - 2, 0); pivot.add(r); }
      pivot.userData.spin = .6; pivot.name = 'ring'; grp.add(pivot); S.spinners.push(pivot);
      const light = new THREE.PointLight(0x7cff5a, 1.2, 240, 1.5); light.position.set(0, 50, 20); grp.add(light);
      grp.userData.radius = 90;
    },
    shrine(poi, rnd, parts, grp) {
      const bark = 0xefe9e0, leaf = 0xb3202a;
      parts.push(part('cyl6', bark, 0, 0, 0, 11, 72, 11, 0, { foot: .05 }), part('ico', leaf, 0, 86, 0, 30, 24, 30), part('ico', leaf, -22, 72, 8, 20, 16, 20), part('ico', leaf, 20, 76, -6, 22, 17, 22));
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; parts.push(part('cyl6', bark, Math.cos(a) * 12, 0, Math.sin(a) * 12, 5, 10, 5, 0, { foot: .05 })); }
      const face = new THREE.Mesh(geo('plane'), glow(0x7a0f14)); face.scale.set(9, 15, 1); face.position.set(0, 42, 11.4); face.name = 'face'; grp.add(face);
      parts.push(part('box', STONE2, 0, 0, 30, 26, 6, 18)); /* the offering stone */
      grp.userData.radius = 60;
    }
  };
  function build(poi) {
    if (!has() || !poi) return null;
    const type = B[poi.type] ? poi.type : B[poi.kind] ? poi.kind : /seat|castle|keep|hold/i.test(poi.type || poi.kind || '') ? 'castle' : /town|village|city|port/i.test(poi.type || poi.kind || '') ? 'town' : /camp/i.test(poi.type || '') ? 'camp' : /dungeon|portal|crypt|cave/i.test(poi.type || '') ? 'dungeon' : /shrine|weirwood|godswood/i.test(poi.type || '') ? 'shrine' : 'camp';
    const rnd = mkRng(hashOf(poi)), parts = [], grp = new THREE.Group(); grp.name = 'poi:' + type;
    B[type](poi, rnd, parts, grp);
    const mesh = new THREE.Mesh(merge(parts), mat()); mesh.name = 'body'; grp.add(mesh);
    grp.position.set(poi.x || 0, 0, poi.y || 0); grp.userData.poi = poi; grp.userData.type = type; grp.userData.tris = tris(grp); return grp;
  }
  /* ---- trees, rocks, the Wall ---- */
  const biomeKind = b => /north|snow|ice|wall|frost|winter|pine|neck/i.test(b || '') ? 'pine' : /dorne|desert|sand|dune|sun/i.test(b || '') ? 'palm' : 'round';
  function treeGeo(kind) {
    if (S.tree[kind]) return S.tree[kind];
    let parts;
    if (kind === 'pine') parts = [part('cyl4', WOOD, 0, 0, 0, 3, 24, 3), part('cone6', 0x2f5f3c, 0, 18, 0, 19, 42, 19), part('cone6', 0x3b7449, 0, 42, 0, 14, 36, 14, .5), part('cone6', SNOW, 0, 66, 0, 7, 14, 7, 1, { top: .1 })];
    else if (kind === 'palm') { parts = [part('cyl4', 0x8a6a3e, 0, 0, 0, 3, 62, 3)]; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * 10, 60, Math.sin(a) * 10), new THREE.Quaternion().setFromEuler(new THREE.Euler(-.9, -a + Math.PI / 2, 0, 'YXZ')), new THREE.Vector3(12, 34, 1)); const g = paint(geo('plane'), 0x4f9a4a, { top: .1 }); g.translate(0, .5, 0); parts.push({ g, m }); } }
    else parts = [part('cyl4', WOOD, 0, 0, 0, 3.5, 30, 3.5), part('ico', 0x4f8a3f, 0, 42, 0, 21, 19, 21), part('ico', 0x5c9a46, 9, 50, 6, 13, 11, 13)];
    return S.tree[kind] = merge(parts);
  }
  const tree = biome => { if (!has()) return null; const m = new THREE.Mesh(treeGeo(biomeKind(biome)), mat()); m.name = 'tree'; return m; };
  const rockGeo = () => S.rock || (S.rock = merge([part('ico', STONE, 0, 6, 0, 14, 9, 11)]));
  const rock = () => { if (!has()) return null; const m = new THREE.Mesh(rockGeo(), mat()); m.name = 'rock'; return m; };
  const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  function scatter(region, n, rng) {
    if (!has()) return null; region = region || {}; rng = rng || R.rng || Math.random; n = n | 0;
    let bb = region.bbox; const poly = region.poly || region.polygon;
    if (!bb && poly) { bb = [Infinity, Infinity, -Infinity, -Infinity]; for (const p of poly) { bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); } }
    if (!bb) bb = [region.x0 || 0, region.y0 || 0, region.x1 || R.W || 7200, region.y1 || R.H || 12288];
    const blocked = R.world && R.world.blocked ? R.world.blocked : null, nt = Math.round(n * .75), nr = n - nt;
    const trees = new THREE.InstancedMesh(treeGeo(biomeKind(region.biome)), mat(), nt || 1), rocks = new THREE.InstancedMesh(rockGeo(), mat(), nr || 1);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler(); let it = 0, ir = 0, tries = 0;
    while (it + ir < n && tries++ < n * 6) {
      const x = bb[0] + rng() * (bb[2] - bb[0]), y = bb[1] + rng() * (bb[3] - bb[1]);
      if (poly && !inPoly(poly, x, y)) continue; if (blocked) { try { if (blocked(x, y)) continue; } catch (err) {} }
      const k = .75 + rng() * .6; p.set(x, 0, y); q.setFromEuler(e.set(0, rng() * Math.PI * 2, 0)); s.set(k, k * (.9 + rng() * .3), k); m.compose(p, q, s);
      if (it < nt) trees.setMatrixAt(it++, m); else rocks.setMatrixAt(ir++, m);
    }
    trees.count = it; rocks.count = ir; trees.instanceMatrix.needsUpdate = true; rocks.instanceMatrix.needsUpdate = true; trees.name = 'trees'; rocks.name = 'rocks';
    const g = new THREE.Group(); g.add(trees); g.add(rocks); g.name = 'scatter'; g.userData.placed = it + ir; g.userData.trees = it; g.userData.rocks = ir; return g;
  }
  function wall() {
    if (!has()) return null; const d = (R.data && R.data.world && R.data.world.wall) || {}, x0 = d.x0 != null ? d.x0 : 1200, x1 = d.x1 != null ? d.x1 : 6000, z = d.y != null ? d.y : 2600, h = d.h || 240, t = d.t || 70;
    const parts = [part('box', 0xdfe8f2, 0, 0, 0, x1 - x0, h, t, 0, { foot: .3, top: .3 }), part('box', 0xb9c9d8, 0, h, 0, x1 - x0, 6, t * .9, 0, { top: .35 })];
    for (let i = 0; i <= 8; i++) parts.push(part('box', 0xcfdbe8, -(x1 - x0) / 2 + i * (x1 - x0) / 8, 0, 0, 60, h * 1.08, t * 1.3));
    const m = new THREE.Mesh(merge(parts), mat()); m.position.set((x0 + x1) / 2, 0, z); m.name = 'wall'; m.userData.tris = tris(m); return m;
  }
  function tris(obj) { let n = 0; if (!obj) return 0; obj.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; n += Math.round((g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3); } }); return n; }
  function update(dt) { for (const s of S.spinners) if (s.parent) s.rotation.z += (s.userData.spin || .6) * dt; }
  R.props = { build, tree, rock, scatter, wall, tris, update, banner, paint, merge, geo, treeGeo, rockGeo, biomeKind, S, has };
  if (R.addSys && !R.sys.props) R.addSys('props', { order: 85, update });
})();
