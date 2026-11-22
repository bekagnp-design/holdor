/* HOLDOR RPG — 07b_architecture.js (G11): textured, smooth-shaded architecture for the POIs and the Wall, layered over A37's R.props.
   R.props.build(poi) → this module's Group (castle | town | camp | dungeon | shrine | lair, one design per great seat, King's Landing)
                        or A37's low-poly prop when this returns null (no THREE, an unknown type). R.props.wall() → the ice Wall along
                        R.data.world.wall.pts (a Group in WORLD coordinates, heights from R.render3d.groundY; userData.world = true).
   Materials: ≤ 10 MeshStandardMaterials shared by everything (stone, dark, plaster, wood, red, slate, thatch, sand, ice, misc), vertex
   colours tint them per part; maps from R.tex.get/normal(name) (G10, looked up lazily at the first build) or small procedural canvases.
   One merged mesh per material per POI; userData.tris ≤ 2500 for the seven seats and King's Landing, ≤ 1200 for the rest.
   Every part stands on the terrain: its foot is sunk to the lowest R.render3d.groundY under its footprint (relative to the POI centre,
   where 08_render places the group). Deterministic per POI id. Nothing touches THREE at load time. R.arch = {build, wall, mats, S}. */
(function () {
  const R = window.R = window.R || {};
  const has = () => typeof THREE !== 'undefined' && THREE && THREE.BufferGeometry && THREE.MeshStandardMaterial;
  const S = { mats: null, geo: {}, puffs: [], wall: null, hm: null };
  const mkRng = seed => { let s = (seed >>> 0) || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const hashOf = poi => hashStr(String(poi.id || poi.name || '') + '|' + Math.round(poi.x || 0) + '|' + Math.round(poi.y || 0));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, TAU = Math.PI * 2;

  /* ---------- procedural textures (fallback for R.tex): 128 px colour + height → normal ---------- */
  const TS = 128;
  function drawTex(name) {
    const c = document.createElement('canvas'); c.width = c.height = TS; const g = c.getContext('2d');
    const hc = document.createElement('canvas'); hc.width = hc.height = TS; const h = hc.getContext('2d');
    const rnd = mkRng(hashStr(name)), hsl = (hh, s, l) => 'hsl(' + hh + ',' + s + '%,' + l + '%)', grey = v => 'rgb(' + v + ',' + v + ',' + v + ')';
    const both = (x, y, w, hh, col, hv) => { for (const dx of [0, -TS]) { g.fillStyle = col; g.fillRect(x + dx, y, w, hh); h.fillStyle = grey(hv); h.fillRect(x + dx, y, w, hh); } };
    function blocks(rh, wmin, wmax, base, gap, mort) {
      g.fillStyle = mort; g.fillRect(0, 0, TS, TS); h.fillStyle = grey(30); h.fillRect(0, 0, TS, TS);
      for (let y = 0; y < TS; y += rh) { let x = -Math.floor(rnd() * wmax); while (x < TS) { const w = Math.round(wmin + rnd() * (wmax - wmin)); both(x + gap, y + gap, w - gap, rh - gap, base(rnd), 150 + rnd() * 90); x += w; } }
    }
    if (name === 'stone_wall') blocks(16, 18, 40, r => hsl(30 + r() * 20, 6 + r() * 6, 62 + r() * 16), 2, '#77736c');
    else if (name === 'stone_dark') blocks(21, 16, 34, r => hsl(220 + r() * 30, 4 + r() * 5, 36 + r() * 14), 2, '#24252a');
    else if (name === 'sand_red') blocks(16, 24, 48, r => hsl(30 + r() * 10, 30 + r() * 12, 68 + r() * 10), 1, '#a88664');
    else if (name === 'plaster') { g.fillStyle = '#d9d0bd'; g.fillRect(0, 0, TS, TS); h.fillStyle = grey(140); h.fillRect(0, 0, TS, TS);
      for (let i = 0; i < 90; i++) { const x = rnd() * TS, y = rnd() * TS, r = 3 + rnd() * 14; g.fillStyle = 'rgba(' + (120 + rnd() * 60 | 0) + ',' + (105 + rnd() * 50 | 0) + ',80,' + (.04 + rnd() * .07) + ')'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); h.fillStyle = 'rgba(255,255,255,.08)'; h.beginPath(); h.arc(x, y, r, 0, TAU); h.fill(); } }
    else if (name === 'wood_planks') { const pw = 16; for (let x = 0; x < TS; x += pw) { const l = 28 + rnd() * 14; both(x, 0, pw, TS, hsl(26 + rnd() * 8, 34 + rnd() * 12, l), 170 + rnd() * 50);
        for (let k = 0; k < 7; k++) { const gx = x + 2 + rnd() * (pw - 4); g.strokeStyle = 'rgba(40,22,10,' + (.25 + rnd() * .3) + ')'; g.lineWidth = .6 + rnd(); g.beginPath(); g.moveTo(gx, 0); for (let y = 0; y <= TS; y += 16) g.lineTo(gx + Math.sin(y * .05 + k) * 1.4, y); g.stroke(); }
        g.fillStyle = '#1e140c'; g.fillRect(x, 0, 1.5, TS); h.fillStyle = grey(20); h.fillRect(x, 0, 1.5, TS); const ky = rnd() * TS; g.fillStyle = 'rgba(30,18,8,.7)'; g.beginPath(); g.ellipse(x + pw / 2, ky, 2, 3, 0, 0, TAU); g.fill(); } }
    else if (name === 'roof_tiles_red' || name === 'roof_slate') { const red = name === 'roof_tiles_red', rh = red ? 16 : 14;
      g.fillStyle = red ? '#4a1e14' : '#15191f'; g.fillRect(0, 0, TS, TS); h.fillStyle = grey(20); h.fillRect(0, 0, TS, TS);
      for (let y = 0; y < TS; y += rh) { let x = (y / rh % 2) * (red ? 8 : 9) - 16; while (x < TS) { const w = red ? 16 : 12 + Math.round(rnd() * 10); for (const dx of [0, -TS]) {
            const col = red ? hsl(10 + rnd() * 12, 48 + rnd() * 18, 34 + rnd() * 14) : hsl(205 + rnd() * 20, 8 + rnd() * 8, 24 + rnd() * 12);
            g.fillStyle = col; h.fillStyle = h.createLinearGradient(0, y, 0, y + rh); h.fillStyle.addColorStop(0, grey(60)); h.fillStyle.addColorStop(1, grey(230));
            if (red) { g.beginPath(); g.moveTo(x + dx + 1, y); g.lineTo(x + dx + w - 1, y); g.lineTo(x + dx + w - 1, y + rh - 5); g.quadraticCurveTo(x + dx + w / 2, y + rh + 3, x + dx + 1, y + rh - 5); g.closePath(); g.fill();
              h.beginPath(); h.moveTo(x + dx + 1, y); h.lineTo(x + dx + w - 1, y); h.lineTo(x + dx + w - 1, y + rh - 5); h.quadraticCurveTo(x + dx + w / 2, y + rh + 3, x + dx + 1, y + rh - 5); h.closePath(); h.fill(); }
            else { g.fillRect(x + dx + 1, y + 1, w - 1, rh - 1); h.fillRect(x + dx + 1, y + 1, w - 1, rh - 1); } } x += w; } } }
    else if (name === 'roof_thatch') { g.fillStyle = '#8a6a36'; g.fillRect(0, 0, TS, TS); h.fillStyle = grey(110); h.fillRect(0, 0, TS, TS);
      for (let i = 0; i < 900; i++) { const x = rnd() * TS, y = rnd() * TS, l = 6 + rnd() * 10, v = rnd(); for (const dy of [0, -TS]) { g.strokeStyle = hsl(38 + v * 10, 40 + v * 20, 28 + v * 34); g.lineWidth = .8; g.beginPath(); g.moveTo(x, y + dy); g.lineTo(x + (rnd() - .5) * 2, y + dy + l); g.stroke();
          h.strokeStyle = grey(80 + v * 170 | 0); h.beginPath(); h.moveTo(x, y + dy); h.lineTo(x, y + dy + l); h.stroke(); } }
      for (let y = 0; y < TS; y += 32) { g.fillStyle = 'rgba(40,26,10,.35)'; g.fillRect(0, y, TS, 3); h.fillStyle = grey(30); h.fillRect(0, y, TS, 3); } }
    else if (name === 'ice') { const gr = g.createLinearGradient(0, 0, TS, TS); gr.addColorStop(0, '#e9f4fb'); gr.addColorStop(.5, '#cfe3f1'); gr.addColorStop(1, '#e4f0f8'); g.fillStyle = gr; g.fillRect(0, 0, TS, TS); h.fillStyle = grey(170); h.fillRect(0, 0, TS, TS);
      for (let i = 0; i < 40; i++) { const x = rnd() * TS; g.fillStyle = 'rgba(255,255,255,' + (.1 + rnd() * .2) + ')'; g.fillRect(x, 0, 1 + rnd() * 4, TS); g.fillStyle = 'rgba(120,160,200,' + (.05 + rnd() * .1) + ')'; g.fillRect(rnd() * TS, 0, 1 + rnd() * 3, TS); }
      for (let i = 0; i < 9; i++) { let x = rnd() * TS, y = rnd() * TS; g.strokeStyle = 'rgba(70,110,150,.55)'; h.strokeStyle = grey(40); g.lineWidth = h.lineWidth = .9; g.beginPath(); h.beginPath(); g.moveTo(x, y); h.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 22; y += 4 + rnd() * 14; g.lineTo(x, y); h.lineTo(x, y); } g.stroke(); h.stroke(); } }
    /* grain on both, then the normal map from the height (wrapped Sobel) */
    const id = g.getImageData(0, 0, TS, TS), hd = h.getImageData(0, 0, TS, TS), d = id.data, H = new Float32Array(TS * TS);
    for (let i = 0; i < TS * TS; i++) { const n = (rnd() - .5) * 18; d[i * 4] = clamp(d[i * 4] + n, 0, 255); d[i * 4 + 1] = clamp(d[i * 4 + 1] + n, 0, 255); d[i * 4 + 2] = clamp(d[i * 4 + 2] + n, 0, 255); H[i] = hd.data[i * 4] / 255 + (rnd() - .5) * .06; }
    g.putImageData(id, 0, 0);
    const nc = document.createElement('canvas'); nc.width = nc.height = TS; const ng = nc.getContext('2d'), nd = ng.createImageData(TS, TS), K = name === 'plaster' || name === 'ice' ? 1.2 : 2.6;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const at = (xx, yy) => H[((yy + TS) % TS) * TS + (xx + TS) % TS];
      const dx = (at(x + 1, y) - at(x - 1, y)) * K, dy = (at(x, y + 1) - at(x, y - 1)) * K, l = Math.hypot(dx, dy, 1), j = (y * TS + x) * 4;
      nd.data[j] = (-dx / l * .5 + .5) * 255; nd.data[j + 1] = (dy / l * .5 + .5) * 255; nd.data[j + 2] = (1 / l * .5 + .5) * 255; nd.data[j + 3] = 255; }
    ng.putImageData(nd, 0, 0);
    return { c, n: nc };
  }
  function asTex(t, srgb) {
    if (!t) return null; let tx = t.isTexture ? t : (t.getContext || t.naturalWidth || t.width) ? new THREE.CanvasTexture(t) : null; if (!tx) return null;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; if (srgb) { if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) tx.encoding = THREE.sRGBEncoding; }
    try { const rd = R.render3d && R.render3d.renderer; tx.anisotropy = rd && !R.render3d.software ? Math.min(4, rd.capabilities.getMaxAnisotropy()) : 1; } catch (e) {}
    tx.needsUpdate = true; return tx;
  }
  function texOf(name) {
    let map = null, nrm = null;
    if (name !== 'ice' && R.tex && typeof R.tex.get === 'function') { try { map = asTex(R.tex.get(name), true); nrm = typeof R.tex.normal === 'function' ? asTex(R.tex.normal(name), false) : null; } catch (e) { map = nrm = null; } }
    if (!map) { const p = drawTex(name); map = asTex(p.c, true); nrm = nrm || asTex(p.n, false); S.proc = (S.proc || 0) + 1; }
    return { map, nrm };
  }
  /* key: [texture, world units per repeat, roughness] */
  const MDEF = { stone: ['stone_wall', 84, .92], plaster: ['plaster', 70, .95], wood: ['wood_planks', 46, .88], red: ['roof_tiles_red', 52, .8],
    slate: ['roof_slate', 50, .7], thatch: ['roof_thatch', 60, 1], glow: [null, 64, 1], ice: ['ice', 190, .28], misc: [null, 64, .85] };
  function leafMat() {
    if (S.leaf !== undefined) return S.leaf; S.leaf = null;
    try { if (R.tex && typeof R.tex.treeTex === 'function') { const t = asTex(R.tex.treeTex('weirwood'), true); if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; S.leaf = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, alphaTest: .5, transparent: false, side: THREE.DoubleSide, roughness: .9 }); S.leaf.name = 'arch:leaf'; mats().leaf = S.leaf; MDEF.leaf = [null, 1, .9]; } } } catch (e) { S.leaf = null; }
    return S.leaf;
  }
  function mats() {
    if (S.mats) return S.mats; const M = {};
    for (const k in MDEF) { const d = MDEF[k], o = { vertexColors: true, roughness: d[2], metalness: 0 };
      if (d[0]) { const t = texOf(d[0]); if (t.map) o.map = t.map; if (t.nrm) { o.normalMap = t.nrm; o.normalScale = new THREE.Vector2(.85, .85); } }
      if (k === 'ice') { o.transparent = true; o.emissive = new THREE.Color(0x10243a); o.roughness = .3; }
      if (k === 'misc') o.side = THREE.DoubleSide;
      M[k] = k === 'glow' ? new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(.16, .16, .16) }) : new THREE.MeshStandardMaterial(o); M[k].name = 'arch:' + k; }
    return S.mats = M;
  }

  /* ---------- unit geometries (standing on y = 0 .. 1 unless noted), built once ---------- */
  function weld(g) { const pos = g.attributes.position, map = new Map(), P = [], I = [];
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4); let j = map.get(k); if (j === undefined) { j = P.length / 3; map.set(k, j); P.push(x, y, z); } I.push(j); }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setIndex(I); o.computeVertexNormals(); return o; }
  const nz3 = (x, y, z, s) => (Math.sin(x * 3.1 + y * 1.7 + s) + Math.sin(y * 2.3 + z * 4.1 + s * 2) + Math.sin(z * 5.3 + x * 2.9 + s * 3)) / 3;
  function geo(k) {
    if (S.geo[k]) return S.geo[k]; const T = THREE; let g;
    const cyl = (n, rt, open) => { const q = new T.CylinderGeometry(rt, 1, 1, n, 1, open !== false); q.translate(0, .5, 0); return q; };
    if (k === 'box') { g = new T.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); }
    else if (k === 'boxnb' || k === 'boxT') { g = new T.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); const ix = Array.from(g.index.array); ix.splice(18, 6); g.setIndex(ix);
      if (k === 'boxT') { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > .5) { p.setX(i, p.getX(i) * .9); p.setZ(i, p.getZ(i) * .9); } g.computeVertexNormals(); } }
    else if (k === 'cyl24') g = cyl(24, .94); else if (k === 'cyl14') g = cyl(14, .95); else if (k === 'cyl14s') g = cyl(14, 1); else if (k === 'cyl8') g = cyl(8, .9); else if (k === 'cyl6') g = cyl(6, .85);
    else if (k === 'cap14' || k === 'cap8') { g = new T.CircleGeometry(1, k === 'cap14' ? 14 : 8); g.rotateX(-Math.PI / 2); }
    else if (/^cone\d+$/.test(k)) { const n = +k.slice(4), P = [], N = [], I = [], sl = Math.SQRT1_2;
      for (let i = 0; i <= n; i++) { const a = i / n * TAU; P.push(Math.cos(a), 0, Math.sin(a)); N.push(Math.cos(a) * sl, sl, Math.sin(a) * sl); }
      for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU; P.push(0, 1, 0); N.push(Math.cos(a) * sl, sl, Math.sin(a) * sl); I.push(n + 1 + i, i + 1, i); }
      g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setIndex(I);
      if (n === 4) g.rotateY(Math.PI / 4); }
    else if (k === 'dome') g = new T.SphereGeometry(1, 12, 5, 0, TAU, 0, Math.PI / 2);
    else if (k === 'onion') { const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(new T.Vector2(Math.max(.001, Math.sin(t * Math.PI * .92) * (1 - t * .35) * 1.05), t)); } g = new T.LatheGeometry(pts, 12); }
    else if (k === 'gable') { g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([
        -.5, 0, -.5, .5, 1, 0, .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 1, 0, .5, 0, .5, -.5, 1, 0, -.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 1, 0,
        -.5, 0, .5, -.5, 1, 0, -.5, 0, -.5, .5, 0, -.5, .5, 1, 0, .5, 0, .5], 3)); g.computeVertexNormals(); }
    else if (k === 'arch') { const s = new T.Shape(); s.moveTo(-.5, 0); s.lineTo(.5, 0); s.lineTo(.5, .5); s.absarc(0, .5, .5, 0, Math.PI, false); s.lineTo(-.5, 0); g = new T.ShapeGeometry(s, 4); }
    else if (k === 'spandrel') { const s = new T.Shape(); s.moveTo(-.5, 0); s.lineTo(-.5, .5); s.lineTo(.5, .5); s.lineTo(.5, 0); s.absarc(0, 0, .5, 0, Math.PI, false); g = new T.ShapeGeometry(s, 5); }
    else if (k === 'plane') { g = new T.PlaneGeometry(1, 1); g.translate(0, .5, 0); }
    else if (k === 'ico0' || k === 'ico1') { g = weld(new T.IcosahedronGeometry(1, k === 'ico0' ? 0 : 1)); }
    else if (/^rock[A-D]$/.test(k) || k === 'rockS') { const s = k.charCodeAt(4) * 1.7; g = weld(new T.IcosahedronGeometry(1, k === 'rockS' ? 1 : 2)); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + .22 * nz3(x, y, z, s) + .1 * nz3(x * 2.7, y * 2.7, z * 2.7, s + 5); p.setXYZ(i, x * f, Math.max(-.15, y) * f, z * f); }
      g.computeVertexNormals(); }
    else if (k === 'stack') { g = new T.CylinderGeometry(.8, 1.15, 1, 9, 4, true); g.translate(0, .5, 0); g = weld(g); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + .18 * nz3(x * 2, y * 3, z * 2, 3); p.setXYZ(i, x * f, y, z * f); } g.computeVertexNormals(); }
    else if (k === 'frond') { g = new T.PlaneGeometry(1, 1, 1, 3); g.rotateX(-Math.PI / 2); g.translate(0, 0, .5); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, -z * z * .7); p.setX(i, p.getX(i) * (1 - z * .7)); } g.computeVertexNormals(); }
    else if (k === 'tent') { g = new T.CylinderGeometry(.06, 1, 1, 9, 2, true); g.translate(0, .5, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > .2 && y < .8) { p.setX(i, p.getX(i) * .9); p.setZ(i, p.getZ(i) * .9); } } g.computeVertexNormals(); }
    else if (k === 'cyl8c') { g = new T.CylinderGeometry(1, 1, 1, 8, 1, true); }
    else if (k === 'slab') { g = new T.BoxGeometry(1, 1, 1, 4, 3, 1); g.translate(0, .5, 0); const p = g.attributes.position, rr = mkRng(99);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i) * (1 - p.getY(i) * .18); p.setZ(i, z); if (Math.abs(x) < .49 && y > .01 && y < .99) p.setZ(i, z * (1 + (rr() - .5) * .35)); if (y > .99) p.setY(i, 1 + (rr() - .5) * .04); }
      g.computeVertexNormals(); }
    else if (k === 'snowcap') { g = new T.CylinderGeometry(1, 1, 1, 8, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); g.scale(1, 1, .5); }
    if (!g) { g = new T.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); }
    if (!g.attributes.normal) g.computeVertexNormals();
    return S.geo[k] = g;
  }

  /* ---------- palettes by region ---------- */
  const COLD = /north|farnorth|wall|beyond|winter|vale|neck/, DRY = /dorne/, IRON = /iron/, CITY = /crown|city/;
  function palette(poi) {
    const r = String(poi.region || '');
    if (DRY.test(r)) return { wall: 'sand', wc: 0xf0dcc0, roof: 'red', rc: 0xe0b090, house: 'plaster', hc: 0xf2e6cf, hr: 'red', snow: false };
    if (IRON.test(r)) return { wall: 'dark', wc: 0x9aa0a8, roof: 'slate', rc: 0xa0a8b0, house: 'wood', hc: 0x9a8c7c, hr: 'thatch', snow: false };
    if (COLD.test(r)) return { wall: 'stone', wc: 0xc8ccd2, roof: 'slate', rc: 0xd0d8e0, house: 'wood', hc: 0xc9b8a0, hr: 'thatch', snow: /wall|beyond|winter|farnorth/.test(r) };
    if (/reach/.test(r)) return { wall: 'stone', wc: 0xf4efe2, roof: 'red', rc: 0xffffff, house: 'plaster', hc: 0xfff6e6, hr: 'thatch', snow: false };
    if (CITY.test(r) || /storm/.test(r)) return { wall: 'stone', wc: 0xe2ddd2, roof: /storm/.test(r) ? 'slate' : 'red', rc: 0xffffff, house: 'plaster', hc: 0xf4ead8, hr: 'red', snow: false };
    return { wall: 'stone', wc: 0xe6e0d4, roof: 'red', rc: 0xf0f0f0, house: 'plaster', hc: 0xf0e4d0, hr: /west/.test(r) ? 'red' : 'thatch', snow: false };
  }

  /* ---------- the builder context: parts → one merged mesh per material ---------- */
  const _q = () => new THREE.Quaternion(), _v = () => new THREE.Vector3();
  function Ctx(poi) {
    const R3 = R.render3d, gfn = R3 && typeof R3.groundY === 'function' ? R3.groundY : null, cx = poi.x || 0, cy = poi.y || 0, W = R.W || 7200, H = R.H || 12288;
    const g0 = gfn ? gfn(clamp(cx, 0, W), clamp(cy, 0, H)) : 0, rnd = mkRng(hashOf(poi)), B = {};
    const C = { poi, rnd, B, pal: palette(poi), grp: new THREE.Group(), g0 };
    C.gy = (x, z) => gfn ? gfn(clamp(cx + x, 0, W), clamp(cy + z, 0, H)) - g0 : 0;
    C.lo = (x, z, e) => Math.min(C.gy(x, z), C.gy(x - e, z - e), C.gy(x + e, z - e), C.gy(x - e, z + e), C.gy(x + e, z + e));
    C.hi = (x, z, e) => Math.max(C.gy(x, z), C.gy(x - e, z - e), C.gy(x + e, z - e), C.gy(x - e, z + e), C.gy(x + e, z + e));
    C.sea = -g0;
    /* o: {x,y,z, sx,sy,sz, ry,rx,rz, col, a, uv:'box'|'cyl', ao} */
    C.add = (m, k, o) => { if (m === 'dark') { m = 'stone'; o = Object.assign({}, o, { col: mulHex(o.col == null ? 0xffffff : o.col, 0x9a9ca2), us: typeof k === 'string' && /^(rock|stack)/.test(k) ? 3 : o.us }); }
      if (m === 'sand') { m = 'stone'; o = Object.assign({}, o, { col: mulHex(o.col == null ? 0xffffff : o.col, 0xffd6a0) }); } (B[m] = B[m] || []).push({ g: typeof k === 'string' ? geo(k) : k, o, cyl: o.uv === 'cyl' || (o.uv == null && /^(cyl|cone|dome|onion|stack|tent)/.test(typeof k === 'string' ? k : '')), u0: rnd(), v0: rnd() }); };
    C.finish = () => {
      const M = mats(), q = _q(), e = new THREE.Euler(), v = _v(), n = _v(), col = new THREE.Color();
      for (const m in B) {
        const parts = B[m], alpha = m === 'ice', ts0 = MDEF[m][1]; let nv = 0, ni = 0;
        for (const p of parts) { nv += p.g.attributes.position.count; ni += p.g.index ? p.g.index.count : p.g.attributes.position.count; }
        const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), CC = new Float32Array(nv * (alpha ? 4 : 3)), I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni); let ov = 0, oi = 0;
        for (const p of parts) {
          const o = p.o, g = p.g, pos = g.attributes.position, nor = g.attributes.normal, sx = o.sx == null ? 1 : o.sx, sy = o.sy == null ? 1 : o.sy, sz = o.sz == null ? 1 : o.sz;
          q.setFromEuler(e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')); col.set(o.col == null ? 0xffffff : o.col); const a = o.a == null ? 1 : o.a, ao = o.ao !== false, rr = (sx + sz) / 2;
          const ts = ts0 * (o.us || 1), reps = Math.max(1, Math.round(TAU * rr / ts));
          for (let i = 0; i < pos.count; i++) {
            const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i), px = x0 * sx, py = y0 * sy, pz = z0 * sz; n.set(nor.getX(i) / sx, nor.getY(i) / sy, nor.getZ(i) / sz).normalize();
            let u, w; if (p.cyl) { u = (Math.atan2(z0, x0) / TAU + .5) * reps; w = (py + Math.hypot(px, pz) * .35) / ts; }
            else { const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z); if (ay >= ax && ay >= az) { u = px / ts; w = pz / ts; } else if (ax >= az) { u = pz / ts; w = py / ts; } else { u = px / ts; w = py / ts; } }
            const j = (ov + i); U[j * 2] = u + p.u0; U[j * 2 + 1] = w + p.v0;
            v.set(px, py, pz).applyQuaternion(q); n.applyQuaternion(q);
            P[j * 3] = v.x + (o.x || 0); P[j * 3 + 1] = v.y + (o.y || 0); P[j * 3 + 2] = v.z + (o.z || 0); N[j * 3] = n.x; N[j * 3 + 1] = n.y; N[j * 3 + 2] = n.z;
            const k = (ao ? .76 + .24 * clamp(py / Math.min(36, Math.max(6, sy * .5)), 0, 1) : 1) * (alpha ? 1 : 1.22), cs = alpha ? 4 : 3;
            CC[j * cs] = col.r * k; CC[j * cs + 1] = col.g * k; CC[j * cs + 2] = col.b * k; if (alpha) CC[j * 4 + 3] = a;
          }
          if (g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + ov; oi += ix.length; } else { for (let i = 0; i < pos.count; i++) I[oi + i] = ov + i; oi += pos.count; }
          ov += pos.count;
        }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(P, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(N, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
        bg.setAttribute('color', new THREE.BufferAttribute(CC, alpha ? 4 : 3)); bg.setIndex(new THREE.BufferAttribute(I, 1)); bg.computeBoundingSphere();
        const mesh = new THREE.Mesh(bg, M[m]); mesh.name = 'arch:' + m; C.grp.add(mesh);
      }
    };
    return C;
  }
  const mulHex = (a, b) => (((a >> 16 & 255) * (b >> 16 & 255) / 255) << 16) | (((a >> 8 & 255) * (b >> 8 & 255) / 255) << 8) | ((a & 255) * (b & 255) / 255);
  /* jittered colour */
  const jit = (C, hex, k) => { const c = new THREE.Color(hex), f = 1 + ((C.rnd() - .5) * (k == null ? .12 : k)); return c.multiplyScalar(f).getHex(); };

  /* ---------- building blocks ---------- */
  function merlonsAlong(C, x0, z0, x1, z1, y, o) {
    const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L, ry = Math.atan2(-dz, dx), step = o.mg || 22, nm = Math.max(1, Math.floor(L / step)), mw = step * .55, t = o.t;
    const ox = -dz * (o.out || 1) * (t / 2 - t * .14), oz = dx * (o.out || 1) * (t / 2 - t * .14);
    for (let i = 0; i < nm; i++) { const f = (i + .5) / nm, mh = (o.mh || 10) * (.9 + C.rnd() * .2); C.add(o.mat, 'boxnb', { x: x0 + (x1 - x0) * f + ox, y, z: z0 + (z1 - z0) * f + oz, sx: mw, sy: mh, sz: t * .28, ry, col: jit(C, o.col, .1), ao: false }); }
  }
  /* a wall run from (x0,z0) to (x1,z1): pieces ≤ 120 long that each follow the ground; o {h, t, mat, col, cren, out, mg, mh} */
  function wallRun(C, x0, z0, x1, z1, o) {
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 4) return; const n = Math.max(1, Math.ceil(L / 120)), dx = (x1 - x0) / L, dz = (z1 - z0) / L, ry = Math.atan2(-dz, dx);
    for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n, ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const lo = Math.min(C.gy(ax, az), C.gy(bx, bz), C.gy(mx, mz)) - 14, top = Math.max(C.gy(ax, az), C.gy(bx, bz), C.gy(mx, mz)) + o.h * (.96 + C.rnd() * .08);
      C.add(o.mat, o.cren === false && o.round ? 'box' : 'boxnb', { x: mx, y: lo, z: mz, sx: L / n + 2, sy: top - lo, sz: o.t, ry, col: jit(C, o.col) });
      if (o.round) C.add(o.mat, 'cyl8c', { x: mx, y: top - 1, z: mz, sx: o.t * .45, sy: L / n + 2, sz: o.t * .5, rz: Math.PI / 2, ry, col: o.col, ao: false });
      else if (o.cren !== false) merlonsAlong(C, ax, az, bx, bz, top, o);
    }
  }
  /* a closed loop of walls; o.gate: leave a gap (width o.gw) in the edge nearest +z (south, toward the default camera) and put a gatehouse there */
  function loop(C, pts, o) {
    let area = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const out = area > 0 ? -1 : 1; let gi = -1, gz = -1e9;
    if (o.gate) pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], mz = (p[1] + q[1]) / 2; if (mz > gz && Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]) * .5) { gz = mz; gi = i; } });
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], oo = Object.assign({}, o, { out });
      if (i === gi) { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), f = (o.gw || 40) / 2 / L, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        wallRun(C, p[0], p[1], mx - (q[0] - p[0]) * f, mz - (q[1] - p[1]) * f, oo); wallRun(C, mx + (q[0] - p[0]) * f, mz + (q[1] - p[1]) * f, q[0], q[1], oo);
        gatehouse(C, mx, mz, Math.atan2(-(q[1] - p[1]), q[0] - p[0]) + (out > 0 ? 0 : Math.PI), o); }
      else wallRun(C, p[0], p[1], q[0], q[1], oo); }
  }
  /* a window: lit ones (no colour given, 70 %) are in the glow material — dark by day, warm at night */
  function windowAt(C, x, y, z, ry, w, h, col) { const lit = col == null && C.rnd() < .7; C.add(lit ? 'glow' : 'misc', 'arch', { x: x, y, z: z, sx: w, sy: h, sz: 1, ry, col: lit ? 0xffb060 : col || 0x15110e, ao: false }); }
  /* a tower: o {r, h, kind 'round'|'square', roof 'cone'|'tall'|'pyr'|'cren'|'dome'|'onion'|'none', mat, col, rm, rc, win, fin, trim} */
  function tower(C, x, z, o) {
    const r = o.r, lo = C.lo(x, z, r) - 12, top = C.hi(x, z, r * .6) + o.h, H = top - lo, round = o.kind !== 'square', mat = o.mat || C.pal.wall, col = jit(C, o.col || C.pal.wc, .1);
    if (round) C.add(mat, o.seg === 24 ? 'cyl24' : 'cyl14', { x, y: lo, z, sx: r * 1.05, sy: H, sz: r * 1.05, col });
    else C.add(mat, 'boxT', { x, y: lo, z, sx: r * 2.1, sy: H, sz: r * 2.1, ry: o.ry || 0, col });
    const tc = o.trim != null ? o.trim : col;
    if (o.roof !== 'none') { if (round) C.add(o.trimMat || mat, o.seg === 24 ? 'cyl24' : 'cyl14s', { x, y: top - 8, z, sx: r * 1.13, sy: 8, sz: r * 1.13, col: tc, ao: false }); else C.add(o.trimMat || mat, 'box', { x, y: top - 8, z, sx: r * 2.1, sy: 8, sz: r * 2.1, ry: o.ry || 0, col: tc, ao: false }); }
    const rm = o.rm || C.pal.roof, rc = o.rc != null ? o.rc : C.pal.rc, roof = o.roof || 'cone', rr = r * 1.24;
    if (roof === 'cone' || roof === 'tall') { const rh = r * (roof === 'tall' ? 3.2 : 1.7 + C.rnd() * .6); C.add(rm, round ? 'cone14' : 'cone4', { x, y: top, z, sx: round ? rr : rr * 1.35, sy: rh, sz: round ? rr : rr * 1.35, ry: o.ry || 0, col: jit(C, rc, .08) });
      if (o.fin != null) C.add('misc', 'cone8', { x, y: top + rh - 2, z, sx: 1.6, sy: 16, sz: 1.6, col: o.fin, ao: false }); }
    else if (roof === 'pyr') C.add(rm, 'cone4', { x, y: top, z, sx: rr * 1.35, sy: r * 1.2, sz: rr * 1.35, ry: o.ry || 0, col: jit(C, rc, .08) });
    else if (roof === 'dome' || roof === 'onion') { C.add(rm, roof, { x, y: top - (roof === 'dome' ? 2 : 0), z, sx: r * 1.02, sy: roof === 'dome' ? r * .95 : r * 2, sz: r * 1.02, col: rc });
      if (o.fin != null) C.add('misc', 'cone8', { x, y: top + (roof === 'dome' ? r * .9 : r * 1.9), z, sx: 1.6, sy: 14, sz: 1.6, col: o.fin, ao: false }); }
    else if (roof === 'cren') { C.add(mat, round ? 'cap14' : 'box', round ? { x, y: top - 4, z, sx: r * 1.1, sy: 1, sz: r * 1.1, col, ao: false } : { x, y: top - 6, z, sx: r * 2.1, sy: 2, sz: r * 2.1, ry: o.ry || 0, col, ao: false });
      const nm = round ? Math.max(6, Math.round(r * 2 * Math.PI / 20)) : 0;
      if (round) for (let i = 0; i < nm; i++) { const a = i / nm * TAU; C.add(mat, 'boxnb', { x: x + Math.sin(a) * r * 1.06, y: top, z: z + Math.cos(a) * r * 1.06, sx: r * 3.4 / nm, sy: 9, sz: 4, ry: a, col: jit(C, col, .08), ao: false }); }
      else { const s = r * 1.05; merlonsAlong(C, x - s, z + s, x + s, z + s, top, { mat, col, t: 14, out: 1, mg: 18 }); merlonsAlong(C, x - s, z - s, x + s, z - s, top, { mat, col, t: 14, out: -1, mg: 18 });
        merlonsAlong(C, x - s, z - s, x - s, z + s, top, { mat, col, t: 14, out: 1, mg: 18 }); merlonsAlong(C, x + s, z - s, x + s, z + s, top, { mat, col, t: 14, out: -1, mg: 18 }); } }
    const nw = o.win != null ? o.win : 2;
    for (let i = 0; i < nw; i++) { const a = (o.wa != null ? o.wa : 0) + (i % 2 ? .7 : -.4) + (C.rnd() - .5) * .4, y = lo + (H - 20) * (.45 + .4 * (i / Math.max(1, nw))) + 12, rad = round ? r * 1.05 * (1 - .05 * (y - lo) / H) + .8 : r * 1.06 + .6;
      if (round) windowAt(C, x + Math.sin(a) * rad, y, z + Math.cos(a) * rad, a, 5, 11); else windowAt(C, x + (i % 2 ? r * .4 : -r * .4), y, z + rad, 0, 5, 11); }
    return top;
  }
  function gatehouse(C, x, z, ry, o) {
    const gw = o.gw || 40, h = o.h + 16, t = o.t * 1.5, mat = o.mat || C.pal.wall, col = o.col || C.pal.wc, lo = C.lo(x, z, gw * .6) - 12, top = C.hi(x, z, gw * .5) + h, cs = Math.cos(ry), sn = Math.sin(ry);
    const oh = Math.min(o.h * .8, gw * 1.15), gy0 = C.gy(x, z) - 2; void lo;
    C.add(mat, 'box', { x, y: gy0 + oh, z, sx: gw + 22, sy: top - gy0 - oh, sz: t, ry, col: jit(C, col) });
    merlonsAlong(C, x - cs * (gw / 2 + 11), z + sn * (gw / 2 + 11), x + cs * (gw / 2 + 11), z - sn * (gw / 2 + 11), top, { mat, col, t, out: 1, mg: 16 });
    C.add('wood', 'plane', { x: x + sn * (t / 2 - 3), y: gy0 + oh - 8, z: z + cs * (t / 2 - 3), sx: gw, sy: 8, sz: 1, ry, col: 0x5a4632, ao: false });
    for (const k of [1, -1]) C.add(mat, 'spandrel', { x: x + sn * k * (t / 2 + .4), y: gy0 + oh - gw * .5, z: z + cs * k * (t / 2 + .4), sx: gw + 1, sy: gw, sz: 1, ry: k > 0 ? ry : ry + Math.PI, col, ao: false });
    for (const s of [-1, 1]) { const tx = x + cs * s * (gw / 2 + 14), tz = z - sn * s * (gw / 2 + 14); if (s > 0 && C.poi.house && !C.bannered) { C.bannered = 1; banner(C, tx, tz, C.hi(tx, tz, 10) + h + 18, ry, C.poi.house); } tower(C, tx, tz, { r: o.gtr || 15, h: h + 18, kind: o.gkind || 'square', roof: o.groof || 'cren', ry, mat, col, win: 1, wa: ry, rm: o.rm, rc: o.rc, trim: o.trim, trimMat: o.trimMat }); }
  }
  /* a keep: o {w, d, h, mat, col, roof 'gable'|'pyr'|'cren', rm, rc, ry, rows} */
  function keep(C, x, z, o) {
    const mat = o.mat || C.pal.wall, col = jit(C, o.col || C.pal.wc), ry = o.ry || 0, lo = C.lo(x, z, Math.max(o.w, o.d) / 2) - 12, top = C.hi(x, z, Math.max(o.w, o.d) / 3) + o.h;
    C.add(mat, 'boxnb', { x, y: lo, z, sx: o.w, sy: top - lo, sz: o.d, ry, col });
    C.add(mat, 'box', { x, y: top - 7, z, sx: o.w + 5, sy: 7, sz: o.d + 5, ry, col: jit(C, col, .1), ao: false });
    const roof = o.roof || 'gable', rm = o.rm || C.pal.roof, rc = o.rc != null ? o.rc : C.pal.rc;
    if (roof === 'gable') C.add(rm, 'gable', { x, y: top, z, sx: o.w + 8, sy: Math.min(o.w, o.d) * .55, sz: o.d + 8, ry, col: jit(C, rc, .06) });
    else if (roof === 'pyr') C.add(rm, 'cone4', { x, y: top, z, sx: o.w * .75, sy: o.h * .45, sz: o.d * .75, ry, col: rc });
    else merlonsAlong(C, x - o.w / 2, z + o.d / 2, x + o.w / 2, z + o.d / 2, top, { mat, col, t: 12, out: 1, mg: 20 });
    const cs = Math.cos(ry), sn = Math.sin(ry), rows = o.rows || Math.max(1, Math.min(3, Math.floor((o.h - 20) / 34))), cols = Math.max(1, Math.min(4, Math.floor(o.w / 28)));
    for (let rI = 0; rI < rows; rI++) for (let cI = 0; cI < cols; cI++) { if (C.rnd() < .15) continue; const lx = (cI - (cols - 1) / 2) * (o.w / cols), y = top - 22 - rI * 34 - 12, lz = o.d / 2 + .7;
      windowAt(C, x + cs * lx + sn * lz, y, z - sn * lx + cs * lz, ry, 6, 13); }
    return top;
  }
  /* a house: o {w, d, h, wm, wc, rm, rc, ry, chim} */
  function house(C, x, z, o) {
    const ry = o.ry || 0, cs = Math.cos(ry), sn = Math.sin(ry), e = Math.max(o.w, o.d) / 2, lo = C.lo(x, z, e) - 8, top = C.hi(x, z, e * .7) + o.h, wc = jit(C, o.wc, .14);
    C.add(o.wm, 'boxnb', { x, y: lo, z, sx: o.w, sy: top - lo, sz: o.d, ry, col: wc });
    const rh = o.d * (.5 + C.rnd() * .25), rt = top + (o.storey || 0); C.add(o.rm, 'gable', { x, y: rt - 1, z, sx: o.w + 8, sy: rh, sz: o.d + 9, ry, col: jit(C, o.rc, .12) });
    if (o.wm === 'plaster') for (const s of [-1, 1]) C.add('wood', 'boxnb', { x: x + cs * s * (o.w / 2 - 1) + sn * (o.d / 2), y: lo, z: z - sn * s * (o.w / 2 - 1) + cs * (o.d / 2), sx: 3.2, sy: top - lo, sz: 3.2, ry, col: 0x6a4a30, ao: false });
    if (o.wm === 'plaster') C.add('wood', 'boxnb', { x: x + sn * (o.d / 2 + .3), y: top - 4, z: z + cs * (o.d / 2 + .3), sx: o.w, sy: 3, sz: 1.5, ry, col: 0x5a3e28, ao: false });
    const dz = o.d / 2 + .5, dx = (C.rnd() - .5) * o.w * .4, gy0 = C.gy(x, z) - 1;
    C.add('misc', 'arch', { x: x + cs * dx + sn * dz, y: gy0, z: z - sn * dx + cs * dz, sx: 9, sy: 17, sz: 1, ry, col: 0x2b1d12, ao: false });
    windowAt(C, x + cs * (dx > 0 ? -o.w * .28 : o.w * .28) + sn * dz, top - 16, z - sn * (dx > 0 ? -o.w * .28 : o.w * .28) + cs * dz, ry, 8, 11);
    if (o.storey) { const ex = 3, h2 = o.storey; C.add(o.wm, 'boxnb', { x, y: top - 2, z, sx: o.w + ex, sy: h2 + 2, sz: o.d + ex, ry, col: jit(C, wc, .06), ao: false });
      C.add('wood', 'box', { x, y: top - 3, z, sx: o.w + ex + 1, sy: 3, sz: o.d + ex + 1, ry, col: 0x5a3e28, ao: false });
      windowAt(C, x + sn * (o.d / 2 + ex / 2 + .5), top + h2 * .35, z + cs * (o.d / 2 + ex / 2 + .5), ry, 6, 9); }
    if (o.chim !== false) { const cx = x + cs * (o.w * .3) - sn * (o.d * .15), cz = z - sn * (o.w * .3) - cs * (o.d * .15); C.add('stone', 'boxnb', { x: cx, y: rt, z: cz, sx: 6, sy: rh * .8 + 6, sz: 6, ry, col: 0xb0a89c, ao: false }); }
  }
  /* ---------- town furniture ---------- */
  const STALL = [0xb8483a, 0x3a6aa0, 0xc8a040, 0x5a8a3a, 0x8a3a6a];
  function stall(C, x, z, ry) { const cs = Math.cos(ry), sn = Math.sin(ry), y = C.gy(x, z) - 2, P = (lx, lz) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz];
    for (const [lx, lz] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) { const q = P(lx, lz); C.add('wood', 'boxnb', { x: q[0], y, z: q[1], sx: 2, sy: 24, sz: 2, ry, col: 0x6a4a30, ao: false }); }
    C.add('misc', 'gable', { x, y: y + 23, z, sx: 32, sy: 7, sz: 22, ry, col: STALL[Math.floor(C.rnd() * 5)], ao: false });
    const q = P(0, 4); C.add('wood', 'box', { x: q[0], y: y + 9, z: q[1], sx: 24, sy: 3, sz: 9, ry, col: 0x8a6a48, ao: false });
    for (let i = 0; i < 2; i++) { const g = P(-6 + i * 12, 4); C.add('misc', 'ico0', { x: g[0], y: y + 13, z: g[1], sx: 4, sy: 3, sz: 4, col: [0xc84030, 0xd8a030, 0x6a9a3a, 0xe8d8b0][Math.floor(C.rnd() * 4)], ao: false }); } }
  function lamp(C, x, z) { const y = C.gy(x, z) - 2; C.add('wood', 'boxnb', { x, y, z, sx: 2.2, sy: 36, sz: 2.2, col: 0x3a2c20, ao: false });
    C.add('glow', 'box', { x, y: y + 35, z, sx: 6.5, sy: 9, sz: 6.5, col: 0xffc070, ao: false }); C.add('misc', 'cone4', { x, y: y + 43, z, sx: 4.5, sy: 4, sz: 4.5, col: 0x2a2420, ao: false }); }
  function barrel(C, x, z, s) { s = s || 1; const y = C.gy(x, z) - 1; C.add('wood', 'cyl8', { x, y, z, sx: 5 * s, sy: 12 * s, sz: 5 * s, col: 0x8a6440, ao: false, uv: 'cyl' }); C.add('wood', 'cap8', { x, y: y + 11.2 * s, z, sx: 4.6 * s, sy: 1, sz: 4.6 * s, col: 0x7a5a38, ao: false }); }
  function cart(C, x, z, ry) { const cs = Math.cos(ry), sn = Math.sin(ry), y = C.gy(x, z), P = (lx, lz) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz];
    C.add('wood', 'boxnb', { x, y: y + 7, z, sx: 30, sy: 8, sz: 16, ry, col: 0x7a5a38 }); for (const s of [-1, 1]) { const q = P(4, s * 9); C.add('wood', 'cyl8c', { x: q[0], y: y + 7, z: q[1], sx: 7, sy: 2, sz: 7, rx: Math.PI / 2, ry, col: 0x4a3626, ao: false }); }
    const h = P(-24, 0); C.add('wood', 'box', { x: h[0], y: y + 6, z: h[1], sx: 20, sy: 1.6, sz: 8, ry, col: 0x6a4a30, ao: false });
    if (C.rnd() < .6) { const q = P(2, 0); C.add('thatch', 'ico0', { x: q[0], y: y + 15, z: q[1], sx: 13, sy: 6, sz: 7, ry, col: 0xe8d8a8, ao: false, uv: 'box' }); } }
  function fenceRun(C, x0, z0, x1, z1) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 18)), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; C.add('wood', 'boxnb', { x, y: C.gy(x, z) - 3, z, sx: 2, sy: 15, sz: 2, col: 0x7a5a3a, ao: false }); }
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; for (const y of [6, 11]) C.add('wood', 'box', { x: mx, y: C.gy(mx, mz) + y, z: mz, sx: L, sy: 1.6, sz: 1.2, ry, col: 0x8a6a48, ao: false }); }
  function signAt(C, x, z, y, ry) { const cs = Math.cos(ry), sn = Math.sin(ry); C.add('wood', 'box', { x: x + sn * 6, y, z: z + cs * 6, sx: 1.4, sy: 1.4, sz: 12, ry, col: 0x3a2c20, ao: false });
    C.add('misc', 'plane', { x: x + sn * 9 + cs * 0, y: y - 12, z: z + cs * 9, sx: 1, sy: 10, sz: 12, ry: ry + Math.PI / 2, col: [0x8a3a2a, 0x2a4a6a, 0x6a5a2a][Math.floor(C.rnd() * 3)], ao: false }); }
  function well(C, x, z) { const wy = C.gy(x, z) - 4; C.add('stone', 'cyl8', { x, y: wy, z, sx: 12, sy: 14, sz: 12, col: 0xc0b8ac }); C.add('misc', 'cap8', { x, y: wy + 12, z, sx: 10, sy: 1, sz: 10, col: 0x101820, ao: false });
    for (const s of [-1, 1]) C.add('wood', 'boxnb', { x: x + s * 10, y: wy + 10, z, sx: 2.5, sy: 22, sz: 2.5, col: 0x6a4a30, ao: false });
    C.add(C.pal.hr, 'gable', { x, y: wy + 30, z, sx: 26, sy: 9, sz: 20, col: 0xe0d0b0, ao: false }); }
  function sept(C, x, z) { const top = tower(C, x, z, { r: 24, h: 34, roof: 'cone', mat: 'plaster', col: 0xf2ece0, rm: 'slate', rc: 0xb8c0c8, win: 2, fin: 0xf0f0ff }); C.add('ice', 'ico0', { x, y: top + 50, z, sx: 4, sy: 7, sz: 4, col: 0xf8fbff, a: .8, ao: false }); }
  function haystack(C, x, z, s) { const y = C.gy(x, z) - 2; C.add('thatch', 'cyl8', { x, y, z, sx: 11 * s, sy: 12 * s, sz: 11 * s, col: 0xf0dca0 }); C.add('thatch', 'cone8', { x, y: y + 12 * s, z, sx: 12 * s, sy: 12 * s, sz: 12 * s, col: 0xf0dca0, ao: false }); }
  function field(C, x, z, w, d, col) { const y = C.gy(x, z) + 1; for (let i = 0; i < 6; i++) C.add('misc', 'box', { x: x - w / 2 + (i + .5) * w / 6, y: y - 2, z, sx: w / 10, sy: 4, sz: d * .9, col: jit(C, col, .15), ao: false });
    fenceRun(C, x - w / 2, z - d / 2, x + w / 2, z - d / 2); fenceRun(C, x - w / 2, z + d / 2, x + w / 2, z + d / 2); fenceRun(C, x - w / 2, z - d / 2, x - w / 2, z + d / 2); }
  /* house materials by region: walls, roofs */
  function houseKit(C) { const r = String(C.poi.region || ''), rnd = C.rnd, p = C.pal;
    const roof = COLD.test(r) ? (rnd() < .5 ? 'thatch' : 'slate') : /river|reach|neck/.test(r) ? (rnd() < .6 ? 'thatch' : 'red') : DRY.test(r) ? 'red' : (rnd() < .7 ? 'red' : 'slate');
    const wm = rnd() < .55 ? (COLD.test(r) ? 'wood' : 'plaster') : rnd() < .5 ? 'stone' : p.house;
    return { wm, wc: wm === 'stone' ? 0xd8d2c8 : wm === 'wood' ? 0xc8b49a : p.hc, rm: roof, rc: roof === 'thatch' ? 0xe8d8b8 : roof === 'slate' ? 0xd0d8e0 : 0xffffff }; }
  /* house banners: a pole, a swallow-tailed cloth and an original sigil drawn as shapes (no emoji, no texture) */
  const HB = { stark: [0xd6dbe0, 0x46525e], lannister: [0x8a1c1c, 0xe0b040], baratheon: [0xe2c244, 0x1e1e1a], targaryen: [0x1c1a1a, 0xc83030],
    greyjoy: [0x1c2228, 0xd8b84a], tyrell: [0x4e8a3a, 0xeacb48], martell: [0xe07a30, 0xb82a20] };
  function sigilShapes(house) {
    const T = THREE, P = pts => { const s = new T.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
    const circle = (x, y, r) => { const s = new T.Shape(); s.absarc(x, y, r, 0, TAU, false); return s; }, out = [];
    if (house === 'stark') out.push(P([[-.4, .5], [-.22, .58], [-.14, .78], [-.04, .64], [.06, .66], [.16, .84], [.2, .6], [.32, .48], [.3, .28], [.14, .18], [.02, .26], [-.1, .4], [-.38, .42]]));
    else if (house === 'lannister') { const m = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = i % 2 ? .25 : .36; m.push([Math.sin(a) * r, .55 + Math.cos(a) * r]); } out.push(P(m));
      const f = new T.Path(); f.absarc(0, .53, .15, 0, TAU, true); out[0].holes.push(f); out.push(P([[-.1, .62], [.1, .62], [.07, .44], [0, .38], [-.07, .44]])); }
    else if (house === 'baratheon') { const half = [[0, .2], [.08, .3], [.1, .5], [.14, .56], [.28, .66], [.36, .86], [.3, .87], [.24, .72], [.2, .8], [.15, .79], [.18, .68], [.08, .6], [0, .6]];
      out.push(P(half.concat(half.slice().reverse().map(p => [-p[0], p[1]])))); }
    else if (house === 'targaryen') out.push(P([[-.42, .86], [-.16, .62], [-.02, .7], [.06, .9], [.2, .86], [.1, .74], [.14, .62], [.42, .86], [.26, .44], [.08, .38], [.14, .22], [-.2, .14], [-.04, .3], [-.22, .42]]));
    else if (house === 'greyjoy') { out.push(circle(0, .66, .14)); for (let k = 0; k < 6; k++) { const x0 = -.15 + k * .06, dir = k < 3 ? -1 : 1, L = [], Rr = [];
        for (let i = 0; i <= 6; i++) { const t = i / 6, x = x0 + dir * Math.sin(t * Math.PI * 1.3) * .14 * t, y = .56 - t * .42, w = .035 * (1 - t) + .008; L.push([x - w, y]); Rr.push([x + w, y]); }
        out.push(P(L.concat(Rr.reverse()))); } }
    else if (house === 'tyrell') { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; out.push(circle(Math.sin(a) * .1, .62 + Math.cos(a) * .1, .1)); } out.push(circle(0, .62, .08));
      out.push(P([[-.02, .5], [.02, .5], [.03, .15], [-.03, .15]]), P([[.02, .34], [.2, .42], [.12, .3]]), P([[-.02, .28], [-.2, .34], [-.1, .22]])); }
    else if (house === 'martell') { out.push(circle(0, .56, .16)); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, b = a + .13, c = a - .13; out.push(P([[Math.sin(b) * .17, .56 + Math.cos(b) * .17], [Math.sin(a) * .3, .56 + Math.cos(a) * .3], [Math.sin(c) * .17, .56 + Math.cos(c) * .17]])); } }
    else out.push(circle(0, .55, .2));
    return out;
  }
  function banner(C, x, z, y, ry, house) {
    const hb = HB[house] || [0x8a96a2, 0x2a3038], key = 'sig:' + house, ss = (S.geo[key] = S.geo[key] || new THREE.ShapeGeometry(sigilShapes(house), 6));
    if (!S.geo.swallow) { const s = new THREE.Shape(); s.moveTo(-.5, 0); s.lineTo(-.5, 1); s.lineTo(.5, 1); s.lineTo(.5, 0); s.lineTo(0, .14); s.closePath(); S.geo.swallow = new THREE.ShapeGeometry(s, 1); }
    const cs = Math.cos(ry), sn = Math.sin(ry), W = 26, H = 40, top = y + 62;
    C.add('wood', 'cyl6', { x, y, z, sx: 1.4, sy: 66, sz: 1.4, col: 0x5a4030, ao: false });
    C.add('wood', 'box', { x, y: top - 2, z, sx: W + 6, sy: 2, sz: 2, ry, col: 0x5a4030, ao: false });
    const fx = x + sn * 2, fz = z + cs * 2;
    C.add('misc', S.geo.swallow, { x: fx, y: top - H - 2, z: fz, sx: W, sy: H, sz: 1, ry, col: hb[0], ao: false });
    if (house === 'martell') C.add('misc', 'plane', { x: fx + sn * .6, y: top - H + 1, z: fz + cs * .6, sx: 2, sy: H - 4, sz: 1, ry, rz: .7, col: 0xe8d060, ao: false });
    C.add('misc', ss, { x: fx + sn * .5, y: top - H + 2, z: fz + cs * .5, sx: W * .95, sy: H * .95, sz: 1, ry, col: hb[1], ao: false });
    C.add('misc', ss, { x: fx - sn * .5, y: top - H + 2, z: fz - cs * .5, sx: -W * .95, sy: H * .95, sz: 1, ry, col: hb[1], ao: false });
  }
  /* a Dorne house: sandstone / plaster block, flat roof with a parapet, an arched door, a striped awning, a dome on the big one */
  function dorneHouse(C, x, z, o) {
    const ry = o.ry || 0, cs = Math.cos(ry), sn = Math.sin(ry), e = Math.max(o.w, o.d) / 2, lo = C.lo(x, z, e) - 8, top = C.hi(x, z, e * .7) + o.h, wm = C.rnd() < .5 ? 'plaster' : 'sand', wc = jit(C, wm === 'plaster' ? 0xfbf0dc : 0xffe8c8, .08);
    const L = (lx, lz) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz];
    C.add(wm, 'boxnb', { x, y: lo, z, sx: o.w, sy: top - lo, sz: o.d, ry, col: wc });
    C.add(wm, 'box', { x, y: top - 3, z, sx: o.w + 3, sy: 3, sz: o.d + 3, ry, col: jit(C, wc, .06), ao: false });
    for (const [lx, lz, w, d] of [[0, o.d / 2, o.w + 3, 2.4], [0, -o.d / 2, o.w + 3, 2.4], [o.w / 2, 0, 2.4, o.d], [-o.w / 2, 0, 2.4, o.d]]) { const p = L(lx, lz); C.add(wm, 'boxnb', { x: p[0], y: top, z: p[1], sx: w, sy: 6, sz: d, ry, col: wc, ao: false }); }
    const dx = (C.rnd() - .5) * o.w * .3, gy0 = C.gy(x, z) - 1, dp = L(dx, o.d / 2 + .5);
    C.add('misc', 'arch', { x: dp[0], y: gy0, z: dp[1], sx: 10, sy: 19, sz: 1, ry, col: 0x3a2418, ao: false });
    for (const k of [-1, 1]) { const wp = L(k * o.w * .3 + (k > 0 ? 0 : 0), o.d / 2 + .5); if (Math.abs(k * o.w * .3 - dx) > 10) windowAt(C, wp[0], top - 17, wp[1], ry, 6, 10, 0x2a1a10); }
    const ap = L(dx, o.d / 2 + 6); C.add('misc', 'plane', { x: ap[0], y: gy0 + 21, z: ap[1], sx: 20, sy: 13, sz: 1, ry, rx: -1.05, col: [0xc8502a, 0x2a6a8a, 0xd8a838, 0x8a3a5a][Math.floor(C.rnd() * 4)], ao: false });
    if (o.dome) { const dr = Math.min(o.w, o.d) * .36; C.add('plaster', 'cyl14s', { x, y: top - 2, z, sx: dr, sy: 8, sz: dr, col: wc, ao: false }); C.add('red', 'dome', { x, y: top + 5, z, sx: dr, sy: dr * .9, sz: dr, col: 0xffc890, ao: false, uv: 'box' }); }
  }
  function bush(C, x, z, s, col, k) { C.add('misc', k || 'ico0', { x, y: C.gy(x, z) + s * .35, z, sx: s * (1 + C.rnd() * .3), sy: s * .75, sz: s * (1 + C.rnd() * .3), ry: C.rnd() * 3, col: jit(C, col, .2), ao: false }); }
  function rock(C, x, z, s, mat, col, k) { const g0 = C.lo(x, z, s * .5); C.add(mat || 'dark', k || 'rockS', { x, y: g0 - s * .1, z, sx: s * (1 + C.rnd() * .4), sy: s * (.6 + C.rnd() * .5), sz: s * (1 + C.rnd() * .4), ry: C.rnd() * 6, col: jit(C, col || 0x9a9894, .15), ao: false, uv: 'box' }); }
  function palm(C, x, z, h) {
    let px = x, pz = z, y = C.gy(x, z) - 2; const lean = C.rnd() * TAU, seg = h / 3;
    for (let i = 0; i < 3; i++) { const nx = px + Math.cos(lean) * (2 + i * 3), nz = pz + Math.sin(lean) * (2 + i * 3); C.add('wood', 'cyl6', { x: px, y, z: pz, sx: 3.4 - i * .6, sy: seg + 1, sz: 3.4 - i * .6, rz: Math.cos(lean) * .08 * (i + 1), rx: -Math.sin(lean) * .08 * (i + 1), col: 0xa08260 }); px = nx; pz = nz; y += seg; }
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + C.rnd() * .4; C.add('misc', 'frond', { x: px, y: y, z: pz, sx: 9, sy: 30, sz: 30, ry: a, rx: -.25, col: jit(C, 0x4e7a34, .2), ao: false }); }
  }
  function weirwood(C, x, z, s, icy) {
    const y = C.gy(x, z) - 4;
    C.add('misc', 'cyl8', { x, y, z, sx: 9 * s, sy: 62 * s, sz: 9 * s, col: 0xe6e0d4 });
    for (let i = 0; i < (s < .6 ? 2 : 4); i++) { const a = i / 4 * TAU + C.rnd(); C.add('misc', 'cone8', { x: x + Math.cos(a) * 3 * s, y: y + (44 + i * 6) * s, z: z + Math.sin(a) * 3 * s, sx: 3 * s, sy: 34 * s, sz: 3 * s, rz: Math.cos(a) * .9, rx: -Math.sin(a) * .9, col: 0xdcd6ca, ao: false }); }
    const lite = s < .6;
    for (let i = 0; i < (lite ? 0 : 4); i++) { const a = i / 4 * TAU + .5; C.add('misc', 'cone8', { x: x + Math.cos(a) * 8 * s, y: y, z: z + Math.sin(a) * 8 * s, sx: 4 * s, sy: 14 * s, sz: 4 * s, rz: Math.cos(a) * 1.1, rx: -Math.sin(a) * 1.1, col: 0xd8d0c2, ao: false }); }
    const lc = icy ? 0xb03038 : 0x9c1c24, lm = leafMat();
    if (lm) { C.leaf = 1; for (let i = 0; i < 3; i++) C.add('leaf', 'plane', { x, y: y + 52 * s, z, sx: 92 * s, sy: 62 * s, sz: 1, ry: i / 3 * Math.PI + .3, col: icy ? 0xffeef0 : 0xffffff, ao: false });
      C.add('leaf', 'plane', { x, y: y + 80 * s, z, sx: 80 * s, sy: 70 * s, sz: 1, rx: -Math.PI / 2, col: 0xffffff, ao: false }); }
    else for (const [dx, dy, dz, r] of (lite ? [[0, 82, 0, 32], [-18, 72, 6, 22]] : [[0, 84, 0, 30], [-22, 72, 8, 20], [21, 76, -6, 22], [4, 70, 18, 18]])) C.add('misc', lite ? 'ico0' : 'ico1', { x: x + dx * s, y: y + dy * s, z: z + dz * s, sx: r * s * 1.1, sy: r * s * .8, sz: r * s, ry: C.rnd() * 3, col: jit(C, lc, .2), ao: false });
    C.add('misc', 'arch', { x, y: y + 30 * s, z: z + 9.4 * s, sx: 8 * s, sy: 13 * s, sz: 1, col: 0x6a1016, ao: false });
    if (icy) C.add('ice', 'cyl8', { x, y, z, sx: 11.5 * s, sy: 58 * s, sz: 11.5 * s, col: 0xdff2ff, a: .45, ao: false });
  }
  function puffs(C, x, z, y, n) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo('ico1'), mats().ice); m.name = 'steam'; m.userData.base = { x: x + (C.rnd() - .5) * 20, y, z: z + (C.rnd() - .5) * 20, ph: C.rnd() }; m.scale.setScalar(1); C.grp.add(m); S.puffs.push(m); if (S.puffs.length > 40) S.puffs.shift(); } }

  /* ---------- the seven seats (and King's Landing) ---------- */
  const SEATS = {
    winterfell(C) {   /* grey granite, a double curtain with many towers, the great keep, the broken tower, the glass gardens, steam vents */
      const g = 0xc4c8ce, w = { mat: 'stone', col: g, t: 16 };
      loop(C, [[-200, -170], [200, -170], [200, 250], [-200, 250]], Object.assign({ h: 46, gate: true, gw: 44, rc: 0xd8dee6, mg: 58 }, w));
      loop(C, [[-130, -125], [130, -125], [130, 40], [-130, 40]], Object.assign({ h: 74, mg: 50, gate: true, gw: 36, gtr: 13 }, w));
      for (const [x, z] of [[-200, -170], [200, -170], [200, 250], [-200, 250]]) tower(C, x, z, { r: 18, h: 66, kind: 'square', roof: 'cren', mat: 'stone', col: g, win: 1 });
      const T = [[-130, -125, 22, 120, 'cone'], [130, -125, 20, 104, 'cone'], [130, 40, 22, 96, 'cone'], [-130, 40, 20, 112, 'tall'], [0, -125, 16, 92, 'cren'], [-130, -45, 15, 88, 'cone']];
      for (const t of T) tower(C, t[0], t[1], { r: t[2], h: t[3] + C.rnd() * 14, roof: t[4], mat: 'stone', col: g, rm: 'slate', rc: 0xc8d2dc, win: 2 });
      tower(C, 70, -90, { r: 17, h: 150, roof: 'none', mat: 'stone', col: 0xb4b8be, win: 3 });   /* the broken tower: no roof, jagged top */
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; C.add('stone', 'boxnb', { x: 70 + Math.sin(a) * 17, y: C.hi(70, -90, 10) + 150 - 2, z: -90 + Math.cos(a) * 17, sx: 10, sy: 6 + C.rnd() * 14, sz: 6, ry: a, col: 0xb4b8be, ao: false }); }
      keep(C, -50, -62, { w: 110, d: 66, h: 96, mat: 'stone', col: 0xb8bcc2, rm: 'slate', rc: 0xc8d2dc });
      /* the glass gardens: a long low hall under a glass roof */
      const gx = 76, gz = -12, glo = C.lo(gx, gz, 40) - 8, gtop = C.hi(gx, gz, 30) + 24;
      C.add('stone', 'boxnb', { x: gx, y: glo, z: gz, sx: 70, sy: gtop - glo, sz: 44, col: 0xb0b4ba });
      C.add('ice', 'gable', { x: gx, y: gtop, z: gz, sx: 74, sy: 22, sz: 48, col: 0xbfe8d8, a: .62, ao: false });
      for (let i = 0; i < 5; i++) C.add('misc', 'boxnb', { x: gx - 32 + i * 16, y: gtop, z: gz, sx: 1.6, sy: 22, sz: 48, col: 0x2c3236, ao: false });
      for (let i = 0; i < 5; i++) bush(C, gx - 26 + i * 13, gz + 5, 7, 0x4f7d3a);
      puffs(C, gx, gz, gtop + 8, 3); puffs(C, -150, 170, C.gy(-150, 170) + 10, 2);
      C.grp.userData.radius = 260;
    },
    casterly(C) {     /* a huge rock with the fortress cut into it, gold-trimmed towers, carved windows, a gate at the foot */
      const rx = 0, rz = -150, base = C.lo(rx, rz, 120) - 20;
      C.add('dark', 'rockA', { x: rx, y: base, z: rz, sx: 250, sy: 300, sz: 160, ry: .3, col: 0xb8a088, uv: 'box', ao: false });
      C.add('dark', 'rockB', { x: -190, y: base, z: rz + 40, sx: 120, sy: 150, sz: 110, ry: 1.2, col: 0xae967e, uv: 'box', ao: false });
      C.add('dark', 'rockC', { x: 180, y: base, z: rz + 20, sx: 130, sy: 180, sz: 110, ry: 2.2, col: 0xb49c84, uv: 'box', ao: false });
      const gold = 0xd8b048, stone = 0xe6d2b0;
      for (const [x, z, r, h] of [[-130, 40, 17, 150], [-62, 22, 14, 120], [72, 18, 16, 165], [140, 45, 15, 130], [10, -20, 20, 250], [-150, -30, 13, 200]])
        tower(C, x, z, { r, h, roof: 'cone', mat: 'stone', col: stone, rm: 'red', rc: 0xd07060, trim: gold, trimMat: 'misc', fin: gold, win: 3 });
      const g0 = C.gy; for (const [x, z, up, w, h] of [[-70, 30, 40, 80, 60], [80, 25, 80, 70, 56], [0, -5, 150, 90, 60], [-120, 20, 100, 50, 50]]) { C.gy = () => base + up;
        keep(C, x, z, { w, d: 44, h, mat: 'stone', col: 0xe2cca8, roof: 'cren', rows: 2 }); } C.gy = g0;
      loop(C, [[-175, 230], [-60, 262], [60, 262], [175, 230], [150, 50], [-150, 50]], { mat: 'stone', col: stone, h: 44, t: 14, gate: true, gw: 40, trim: gold, trimMat: 'misc', rm: 'red', rc: 0xd07060 });
      C.grp.userData.radius = 280;
    },
    highgarden(C) {   /* pale stone on a hill: three tiered rings, slender towers with green-copper roofs, rose hedges */
      const pale = 0xf6f1e6, roofc = 0x9cc4a8, base = C.lo(0, 0, 160);
      C.add('thatch', 'dome', { x: 0, y: base - 40, z: -60, sx: 330, sy: 80, sz: 320, col: 0x7c9a50, ao: false, uv: 'box' });
      const ring = (r, h, y0, n, cren) => { const pts = []; for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU; pts.push([Math.sin(a) * r, Math.cos(a) * r - 60]); }
        const gyo = C.gy; C.gy = (x, z) => gyo(x, z) + y0 * (1.3 - Math.hypot(x, z + 60) / 300); loop(C, pts, { mat: 'stone', col: pale, h, t: 12, gate: r > 200, gw: 36, cren, mg: r > 190 ? 46 : 52, rm: 'slate', rc: roofc }); C.gy = gyo; return pts; };
      const r1 = ring(290, 30, 0, 9, true), r2 = ring(150, 38, 26, 8, true), r3 = ring(84, 40, 52, 6, false); void r3;
      for (const p of r1.filter((p, i) => i % 3 === 1)) tower(C, p[0], p[1], { r: 13, h: 62, mat: 'stone', col: pale, rm: 'slate', rc: roofc, roof: 'cone', win: 1 });
      for (const p of r2.filter((p, i) => i % 3 === 0)) tower(C, p[0], p[1], { r: 12, h: 100, mat: 'stone', col: pale, rm: 'slate', rc: roofc, roof: 'tall', win: 1 });
      const kg = C.gy; C.gy = (x, z) => 50 + kg(x, z);
      keep(C, 0, -70, { w: 80, d: 56, h: 92, mat: 'stone', col: 0xf2ecde, rm: 'slate', rc: roofc });
      for (const [x, z, h] of [[-38, -96, 170], [40, -94, 150], [36, -42, 130], [-36, -44, 140]]) tower(C, x, z, { r: 11, h, mat: 'stone', col: pale, rm: 'slate', rc: roofc, roof: 'tall', fin: 0xd8b048, win: 2 });
      C.gy = kg;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .4; if (Math.abs(Math.sin(a)) < .2 && Math.cos(a) > 0) continue; const x = Math.sin(a) * 315, z = Math.cos(a) * 315 - 60;
        C.add('misc', 'ico0', { x, y: C.gy(x, z) + 2, z, sx: 40, sy: 12, sz: 12, ry: a + Math.PI / 2, col: jit(C, 0x2f5a28, .15), ao: false });
        if (i % 2 === 0) C.add('misc', 'ico0', { x: x + Math.cos(a) * 6, y: C.gy(x, z) + 12, z: z - Math.sin(a) * 6, sx: 4, sy: 3.5, sz: 4, col: i % 3 ? 0xc8203a : 0xf0d040, ao: false }); }
      C.grp.userData.radius = 260;
    },
    sunspear(C) {     /* sandstone: winding walls with rounded tops, domes on drums, the tall slender spear tower, palms, flat-roofed houses */
      const sand = 0xf2d6b0, gold = 0xe0a040;
      loop(C, [[-210, 200], [-120, 255], [0, 250], [130, 262], [215, 160], [180, -60], [60, -125], [-120, -115], [-215, -30]], { mat: 'sand', col: sand, h: 40, t: 14, cren: false, round: true, gate: true, gw: 40, gkind: 'round', groof: 'dome', rm: 'sand', rc: 0xf6dcb8 });
      tower(C, 30, -30, { r: 13, h: 260, mat: 'sand', col: 0xf4dcb6, roof: 'dome', rm: 'misc', rc: gold, fin: gold, win: 4, seg: 14 });
      for (const [x, z, r, h] of [[-70, -10, 40, 46], [90, 50, 28, 40], [-110, 70, 22, 30]]) { const top = tower(C, x, z, { r, h, mat: 'sand', col: 0xf0d8b4, roof: 'none', win: 2 });
        C.add(x < 0 ? 'red' : 'plaster', 'onion', { x, y: top - 2, z, sx: r * .98, sy: r * 1.45, sz: r * .98, col: x < 0 ? 0xffc890 : 0xfff4e4, ao: false, uv: 'box' }); C.add('misc', 'cone8', { x, y: top + r * 1.4, z, sx: 2, sy: 18, sz: 2, col: gold, ao: false }); }
      for (let i = 0; i < 5; i++) { const x = -150 + C.rnd() * 300, z = -60 + C.rnd() * 160; if (Math.hypot(x - 30, z + 30) < 50 || Math.hypot(x + 70, z + 10) < 60 || Math.hypot(x, z - 160) < 100) continue; dorneHouse(C, x, z, { w: 30 + C.rnd() * 18, d: 26 + C.rnd() * 14, h: 22 + C.rnd() * 14, ry: (C.rnd() - .5) * .3, dome: false }); }
      for (const [x, z] of [[-150, 200], [-95, 215], [105, 215], [175, 130], [-245, 40], [245, -20], [160, 0]]) palm(C, x, z, 70 + C.rnd() * 30);
      C.grp.userData.radius = 260;
    },
    pyke(C) {         /* dark towers on sea stacks, joined by bridges */
      const dk = 0x8a9098, sea = Math.min(C.sea, -10), stacks = [[0, -40, 62, 120], [-150, 30, 40, 85], [140, -10, 44, 100], [115, 150, 34, 60], [-60, -170, 30, 95]];
      const tops = [];
      stacks.forEach(([x, z, r, h], i) => { C.gy = C.gyBase; const y0 = Math.min(sea - 30, C.lo(x, z, r) - 20), top = Math.max(C.hi(x, z, r * .5), 0) + h;
        C.add('dark', 'stack', { x, y: y0, z, sx: r, sy: top - y0, sz: r * (.9 + C.rnd() * .2), ry: C.rnd() * 6, col: jit(C, 0xa8a49e, .1), ao: false });
        C.add('dark', 'cap14', { x, y: top, z, sx: r * .82, sy: 1, sz: r * .82, col: 0x6a6c6a, ao: false });
        C.gy = () => top;
        const th = i === 0 ? 120 : 70 + C.rnd() * 40; tower(C, x, z, { r: r * (i === 0 ? .55 : .5), h: th, kind: i === 3 ? 'square' : 'round', roof: i === 0 ? 'tall' : i % 2 ? 'cone' : 'cren', mat: 'dark', col: dk, rm: 'slate', rc: 0x8a96a2, win: 2 });
        if (i === 0) keep(C, x + 6, z + 28, { w: 46, d: 30, h: 50, mat: 'dark', col: 0x8e949c, rm: 'slate', rc: 0x8a96a2 });
        tops.push([x, z, top]); });
      C.gy = C.gyBase;
      for (const [a, b] of [[0, 1], [0, 2], [2, 3], [0, 4]]) { const A = tops[a], Bq = tops[b], L = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]), ry = Math.atan2(-(Bq[1] - A[1]), Bq[0] - A[0]), y = Math.min(A[2], Bq[2]) + 4;
        C.add('wood', 'box', { x: (A[0] + Bq[0]) / 2, y, z: (A[1] + Bq[1]) / 2, sx: L, sy: 4, sz: 11, ry, col: 0x7a6650, ao: false });
        for (const s of [-1, 1]) C.add('misc', 'box', { x: (A[0] + Bq[0]) / 2 - Math.sin(ry) * s * 5.5, y: y + 4, z: (A[1] + Bq[1]) / 2 - Math.cos(ry) * s * 5.5, sx: L, sy: 1.2, sz: 1.2, ry, col: 0x3a2e22, ao: false }); }
      for (let i = 0; i < 6; i++) { const a = C.rnd() * TAU, d = 120 + C.rnd() * 120; rock(C, Math.cos(a) * d, Math.sin(a) * d, 16 + C.rnd() * 20, 'dark', 0x6a6c70); }
      C.grp.userData.radius = 240;
    },
    stormsend(C) {    /* one massive smooth drum tower, a round curtain wall, a gatehouse */
      const st = 0xb8b6ae, top = tower(C, 0, -60, { r: 100, h: 210, seg: 24, roof: 'cren', mat: 'stone', col: st, win: 0 });
      for (let i = 0; i < 9; i++) { const a = -1.1 + i / 8 * 2.2, y = C.gy(0, -60) + 60 + (i % 3) * 48; windowAt(C, Math.sin(a) * 102, y, -60 + Math.cos(a) * 102, a, 4, 14); }
      C.add('stone', 'cyl24', { x: 0, y: top - 34, z: -60, sx: 108, sy: 10, sz: 108, col: 0xa8a69e, ao: false });
      const pts = []; for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * TAU; pts.push([Math.sin(a) * 220, -30 + Math.cos(a) * 252]); }
      loop(C, pts, { mat: 'stone', col: 0xb4b2aa, h: 56, t: 18, gate: true, gw: 42, mg: 26, gkind: 'round', groof: 'cren' });
      for (const p of pts.filter((p, i) => i % 3 === 1)) tower(C, p[0], p[1], { r: 18, h: 78, roof: 'cren', mat: 'stone', col: st, win: 1 });
      C.grp.userData.radius = 240;
    },
    dragonstone(C) {  /* black stone, the stone drum keep, spiky towers, carved dragons crouched on the walls */
      const bk = 0x5a5a5e, w = { mat: 'dark', col: bk, t: 16, mg: 22 };
      loop(C, [[-180, -140], [-60, -185], [120, -170], [195, -40], [175, 170], [60, 238], [-60, 238], [-185, 170]], Object.assign({ h: 58, gate: true, gw: 40, groof: 'tall', gkind: 'round', rm: 'dark', rc: 0x4a4a4e }, w));
      const dt = tower(C, -10, -30, { r: 58, h: 150, seg: 24, roof: 'cren', mat: 'dark', col: 0x626266, win: 4 });
      for (const [x, z, r, h] of [[-180, -140, 20, 110], [120, -170, 18, 120], [195, -40, 19, 100], [175, 170, 20, 116], [-185, 170, 18, 104], [90, 10, 15, 150]])
        tower(C, x, z, { r, h, roof: 'tall', mat: 'dark', col: bk, rm: 'dark', rc: 0x3e3e42, win: 2 });
      const dragon = (x, z, y, ry, s) => { const c = 0x6a686a, cs = Math.cos(ry), sn = Math.sin(ry), f = (lx, lz) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz];
        C.add('dark', 'ico0', { x, y: y + 6 * s, z, sx: 9 * s, sy: 7 * s, sz: 14 * s, ry, col: c, ao: false, uv: 'box' });
        let p = f(0, 14 * s); C.add('dark', 'cone8', { x: p[0], y: y + 8 * s, z: p[1], sx: 4 * s, sy: 16 * s, sz: 4 * s, ry, rx: .9, col: c, ao: false });
        p = f(0, 25 * s); C.add('dark', 'ico0', { x: p[0], y: y + 18 * s, z: p[1], sx: 4.5 * s, sy: 4 * s, sz: 7 * s, ry, col: c, ao: false });
        for (const sd of [-1, 1]) { p = f(sd * 8 * s, -2 * s); C.add('dark', 'cone4', { x: p[0], y: y + 8 * s, z: p[1], sx: 2 * s, sy: 22 * s, sz: 10 * s, ry, rz: -sd * 1.0, col: 0x5a585a, ao: false }); }
        p = f(0, -14 * s); C.add('dark', 'cone8', { x: p[0], y: y + 4 * s, z: p[1], sx: 3 * s, sy: 18 * s, sz: 3 * s, ry, rx: -1.3, col: c, ao: false }); };
      const wp = [[-120, -162], [30, -178], [185, 65], [118, 204], [-122, 204], [-183, 15]];
      for (const [x, z] of wp) { const ang = Math.atan2(x, z); dragon(x * 1.02, z * 1.02, C.hi(x, z, 10) + 60, ang, 1.1); }
      dragon(-10, 28, C.gy(-10, -30) + 156, 0, 1.6);
      C.grp.userData.radius = 260; return dt;
    },
    kingslanding(C) { /* a red-roofed city on three hills, the Red Keep on the highest, a great sept dome */
      const hills = [[-150, -120, 130, 70], [150, -90, 110, 50], [0, 120, 120, 40]];
      for (const [x, z, r, h] of hills) C.add('thatch', 'dome', { x, y: C.lo(x, z, r * .5) - 24, z, sx: r * 1.5, sy: h + 24, sz: r * 1.3, col: 0x8c9a60, ao: false, uv: 'box' });
      const gyo = C.gy, hillY = (x, z) => { let y = gyo(x, z); for (const [hx, hz, r, h] of hills) { const d = Math.hypot((x - hx) / (r * 1.5), (z - hz) / (r * 1.3)); if (d < 1) y = Math.max(y, gyo(hx, hz) - 24 + (h + 24) * Math.sqrt(1 - d * d) - 4); } return y; };
      C.gy = hillY;
      const red = 0xc87a62;
      loop(C, [[-235, -195], [-60, -230], [90, -200], [245, -150], [255, 60], [150, 225], [-110, 230], [-250, 80]], { mat: 'stone', col: 0xd8c8b4, h: 40, t: 14, gate: true, gw: 40, mg: 64, rm: 'red', rc: 0xe8e0d8 });
      /* the Red Keep */
      const kx = -150, kz = -120;
      loop(C, [[kx - 70, kz - 55], [kx + 70, kz - 55], [kx + 70, kz + 55], [kx - 70, kz + 55]], { mat: 'stone', col: red, h: 46, t: 14, mg: 32, gate: false, gw: 30, rm: 'red', rc: 0xf0e0d8 });
      for (const [x, z, r, h] of [[kx - 70, kz - 55, 16, 80], [kx + 70, kz - 55, 16, 86], [kx + 70, kz + 55, 15, 70], [kx - 70, kz + 55, 15, 76]]) tower(C, x, z, { r, h, roof: 'cone', mat: 'stone', col: red, rm: 'red', rc: 0xe8d8d0, win: 1 });
      keep(C, kx - 5, kz - 10, { w: 70, d: 50, h: 70, mat: 'stone', col: 0xbe6a54, rm: 'red', rc: 0xf0e0d8 });
      tower(C, kx + 35, kz - 20, { r: 14, h: 120, roof: 'cone', mat: 'stone', col: red, rm: 'red', rc: 0xe8d8d0, fin: 0xd8b048 });
      /* the great sept on the second hill */
      const sx = 150, sz = -90, st = tower(C, sx, sz, { r: 34, h: 44, roof: 'none', mat: 'plaster', col: 0xf6f2ea, win: 3 });
      C.add('misc', 'dome', { x: sx, y: st - 2, z: sz, sx: 36, sy: 34, sz: 36, col: 0xf2ecde, ao: false });
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, x = sx + Math.sin(a) * 42, z = sz + Math.cos(a) * 42, y = C.lo(x, z, 6) - 8; C.add('plaster', 'cyl8', { x, y, z, sx: 6, sy: st - y + 26, sz: 6, col: 0xf6f2ea }); C.add('slate', 'cone8', { x, y: st + 26, z, sx: 7.5, sy: 26, sz: 7.5, col: 0xe8ecf0 }); }
      /* houses */
      for (let i = 0; i < 13; i++) { const a = C.rnd() * TAU, d = 50 + C.rnd() * 180, x = Math.cos(a) * d, z = Math.sin(a) * d * .9 + 30; if (Math.hypot(x - kx, z - kz) < 95 || Math.hypot(x - sx, z - sz) < 70 || Math.hypot(x, z - 160) < 95) continue;
        house(C, x, z, { w: 30 + C.rnd() * 16, d: 24 + C.rnd() * 10, h: 22 + C.rnd() * 14, wm: 'plaster', wc: 0xf4e8d4, rm: 'red', rc: 0xffffff, ry: Math.round(a / (Math.PI / 2)) * Math.PI / 2 + (C.rnd() - .5) * .3, chim: C.rnd() < .4 }); }
      C.gy = gyo; C.grp.userData.radius = 280;
    }
  };
  SEATS.stark = SEATS.winterfell; SEATS.lannister = SEATS.casterly; SEATS.tyrell = SEATS.highgarden; SEATS.martell = SEATS.sunspear; SEATS.greyjoy = SEATS.pyke; SEATS.baratheon = SEATS.stormsend; SEATS.targaryen = SEATS.dragonstone;

  /* ---------- generic builders ---------- */
  const B = {
    castle(C) {
      const p = C.pal, rnd = C.rnd, n = 4 + Math.floor(rnd() * 3), R0 = 140 + rnd() * 35, pts = [];
      for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU + (rnd() - .5) * .3, r = R0 * (.92 + rnd() * .18); pts.push([Math.sin(a) * r * 1.05, Math.cos(a) * r + 30]); }
      const h = 42 + rnd() * 20, wood = /deepwood/.test(C.poi.id || '');
      if (wood) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.floor(L / 13);
          for (let j = 0; j < k; j++) { const f = (j + .5) / k, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; C.add('wood', 'cone6', { x, y: C.gy(x, z) - 6, z, sx: 5, sy: 48 + rnd() * 8, sz: 5, col: 0x9a7a58, uv: 'cyl' }); } } }
      else loop(C, pts, { mat: p.wall, col: p.wc, h, t: 14, gate: true, gw: 38, mg: 50, rm: p.roof, rc: p.rc, gkind: rnd() < .5 ? 'round' : 'square' });
      const nt = 2 + Math.floor(rnd() * 2.5);
      for (let i = 0; i < nt; i++) { const q = pts[(i * 2 + 1) % n]; tower(C, q[0], q[1], { r: 14 + rnd() * 8, h: h + 30 + rnd() * 50, kind: rnd() < .65 ? 'round' : 'square', roof: ['cone', 'tall', 'cren', 'pyr'][Math.floor(rnd() * 4)], rm: p.roof, rc: p.rc, win: 2 }); }
      if (rnd() < .5) keep(C, (rnd() - .5) * 30, -55 + (rnd() - .5) * 20, { w: 60 + rnd() * 30, d: 46 + rnd() * 20, h: 70 + rnd() * 40, roof: rnd() < .6 ? 'gable' : 'cren', rm: p.roof, rc: p.rc });
      else { tower(C, (rnd() - .5) * 30, -60, { r: 30 + rnd() * 12, h: 90 + rnd() * 50, kind: rnd() < .5 ? 'round' : 'square', roof: rnd() < .5 ? 'cren' : 'cone', rm: p.roof, rc: p.rc, win: 3 }); }
      if (p.snow) for (let i = 0; i < 4; i++) rock(C, (rnd() - .5) * 360, (rnd() - .5) * 360, 12 + rnd() * 10, 'misc', 0xf0f4f8, 'ico0');
      C.grp.userData.radius = R0 * 1.4;
    },
    town(C) {
      if (/kingslanding/.test(C.poi.id || '')) return SEATS.kingslanding(C);
      const rnd = C.rnd, dry = DRY.test(String(C.poi.region || '')), TR = clamp((C.poi.r || 200) * 1.05, 190, 300), SQ = 72, SW = 26;
      /* streets: 3–4 straight lanes out of the market square; houses face them, the square and the lanes stay open */
      const ns = 3 + (rnd() < .5 ? 1 : 0), a0 = rnd() * TAU, streets = []; for (let i = 0; i < ns; i++) streets.push(a0 + i * TAU / ns + (rnd() - .5) * .3);
      let nh = 0; const MAXH = 18 + Math.floor(rnd() * 3), placed = [];
      const ok = (x, z, e) => placed.every(q => Math.hypot(q[0] - x, q[1] - z) > q[2] + e) && Math.hypot(x, z) > SQ + e - 4;
      const put = (x, z, ry, big) => { const k = houseKit(C), w = 30 + rnd() * 16 + (big ? 10 : 0), d = 26 + rnd() * 8, e = Math.max(w, d) / 2 + 3; if (!ok(x, z, e)) return false; placed.push([x, z, e]);
        if (dry) dorneHouse(C, x, z, { w, d, h: 24 + rnd() * 12, ry, dome: big && rnd() < .5 }); else house(C, x, z, { w, d, h: 22 + rnd() * 8, storey: rnd() < .4 ? 16 + rnd() * 6 : 0, wm: k.wm, wc: k.wc, rm: k.rm, rc: k.rc, ry, chim: rnd() < .7 });
        nh++; return true; };
      for (const sa of streets) { const ux = Math.sin(sa), uz = Math.cos(sa), nx = Math.cos(sa), nz = -Math.sin(sa);
        for (let d = SQ + 34; d < TR && nh < MAXH; d += 44 + rnd() * 10) for (const sd of [-1, 1]) { if (nh >= MAXH) break; const off = SW + 18 + rnd() * 6, x = ux * d + nx * sd * off, z = uz * d + nz * sd * off;
          put(x, z, Math.atan2(-sd * nx, -sd * nz) + (rnd() - .5) * .12, false); if (rnd() < .25) { const lx = ux * d + nx * sd * (SW - 4), lz = uz * d + nz * sd * (SW - 4); lamp(C, lx, lz); } }
        const lx = ux * (SQ + 20) + nx * (SW - 2), lz = uz * (SQ + 20) + nz * (SW - 2); lamp(C, lx, lz); }
      /* a ring of houses round the square, between the streets, facing it */
      for (let i = 0; i < ns && nh < MAXH + 2; i++) { const b = streets[i] + Math.PI / ns, r = SQ + 30; put(Math.sin(b) * r, Math.cos(b) * r, b + Math.PI + (rnd() - .5) * .1, true); }
      /* the market: stalls on the square's rim, a well off-centre, barrels, a cart; the centre stays clear */
      const ms = 4 + Math.floor(rnd() * 2); for (let i = 0; i < ms; i++) { const b = streets[0] + (i + .5) * TAU / ms + .35, r = SQ - 20; if (streets.some(sa => Math.abs(Math.atan2(Math.sin(b - sa), Math.cos(b - sa))) < .3)) continue; stall(C, Math.sin(b) * r, Math.cos(b) * r, b + Math.PI); }
      const wb = streets[0] + Math.PI / ns * .9; if (dry) palm(C, Math.sin(wb) * 38, Math.cos(wb) * 38, 70); else well(C, Math.sin(wb) * 40, Math.cos(wb) * 40);
      for (let i = 0; i < 5; i++) { const b = rnd() * TAU, r = SQ - 6 + rnd() * 8; barrel(C, Math.sin(b) * r, Math.cos(b) * r, .9 + rnd() * .3); }
      { const b = streets[1] + .25, r = SQ + 6; cart(C, Math.sin(b) * r, Math.cos(b) * r, b + Math.PI / 2); }
      /* a small sept (or a weirwood in the North) at the end of a street; fences round a garden; signboards */
      { const sa = streets[ns - 1] + Math.PI / ns, r = TR * .82; if (COLD.test(String(C.poi.region || ''))) weirwood(C, Math.sin(sa) * r, Math.cos(sa) * r, .5, false); else sept(C, Math.sin(sa) * r, Math.cos(sa) * r); }
      for (let i = 0; i < 2; i++) { const sa = streets[i] + Math.PI / ns, r = TR * (.55 + rnd() * .2), x = Math.sin(sa) * r, z = Math.cos(sa) * r; fenceRun(C, x - 30, z - 20, x + 30, z - 20); fenceRun(C, x - 30, z - 20, x - 30, z + 20); }
      for (let i = 0; i < Math.min(4, placed.length); i++) { const q = placed[i * 2 % placed.length], ang = Math.atan2(-q[0], -q[1]); signAt(C, q[0] - Math.sin(ang) * (q[2] - 8), q[1] - Math.cos(ang) * (q[2] - 8), C.gy(q[0], q[1]) + 30, ang); }
      if (C.pal.snow) for (let i = 0; i < 3; i++) rock(C, (rnd() - .5) * TR * 2, (rnd() - .5) * TR * 2, 10 + rnd() * 8, 'misc', 0xf0f4f8, 'ico0');
      C.grp.userData.radius = TR + 40; C.grp.userData.streets = streets; C.grp.userData.square = SQ;
    },
    village(C) {
      const rnd = C.rnd, dry = DRY.test(String(C.poi.region || '')), n = 4 + Math.floor(rnd() * 5), placed = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd() * .4, d = 70 + rnd() * 50, x = Math.sin(a) * d, z = Math.cos(a) * d, k = houseKit(C);
        if (placed.some(q => Math.hypot(q[0] - x, q[1] - z) < 46)) continue; placed.push([x, z]);
        if (dry) dorneHouse(C, x, z, { w: 28 + rnd() * 12, d: 24 + rnd() * 8, h: 20 + rnd() * 8, ry: a + Math.PI }); else house(C, x, z, { w: 30 + rnd() * 14, d: 24 + rnd() * 8, h: 20 + rnd() * 8, wm: k.wm, wc: k.wc, rm: k.rm === 'red' && rnd() < .5 ? 'thatch' : k.rm, rc: 0xe8d8b8, ry: a + Math.PI, chim: rnd() < .6 }); }
      well(C, 18, -10); lamp(C, -20, 22); barrel(C, 30, 20); barrel(C, 36, 16, .8);
      const fa = rnd() * TAU, fx = Math.sin(fa) * 190, fz = Math.cos(fa) * 190; field(C, fx, fz, 110, 70, COLD.test(String(C.poi.region || '')) ? 0x8a9a5a : 0xc8b050);
      haystack(C, fx + 70, fz + 10, 1);
      C.grp.userData.radius = 240;
    },
    farm(C) {
      const rnd = C.rnd, k = houseKit(C);
      house(C, -40, 10, { w: 44, d: 30, h: 24, storey: 14, wm: k.wm, wc: k.wc, rm: k.rm, rc: k.rc, ry: (rnd() - .5) * .2 });
      /* the barn: a big timber hall, a wide door, a hay loft */
      const bx = 60, bz = -20, lo = C.lo(bx, bz, 40) - 8, top = C.hi(bx, bz, 30) + 40;
      C.add('wood', 'boxnb', { x: bx, y: lo, z: bz, sx: 70, sy: top - lo, sz: 50, col: 0xa0583a });
      C.add(k.rm === 'red' ? 'thatch' : k.rm, 'gable', { x: bx, y: top - 1, z: bz, sx: 78, sy: 30, sz: 58, col: 0xe0d0b0 });
      C.add('misc', 'plane', { x: bx, y: C.gy(bx, bz) - 1, z: bz + 25.6, sx: 26, sy: 30, sz: 1, col: 0x2a1c12, ao: false });
      C.add('wood', 'plane', { x: bx, y: top - 16, z: bz + 25.6, sx: 12, sy: 10, sz: 1, col: 0x6a4a30, ao: false });
      field(C, -20, 140, 150, 80, 0xc8b050); field(C, 160, 120, 90, 90, 0x7a9a4a);
      for (let i = 0; i < 3; i++) haystack(C, 120 + i * 26, -80 + rnd() * 20, .9 + rnd() * .3);
      cart(C, 10, 60, .4); barrel(C, -70, 40); barrel(C, -64, 46, .8);
      fenceRun(C, -90, -60, 20, -60);
      C.grp.userData.radius = 220;
    },
    inn(C) {
      const rnd = C.rnd, k = houseKit(C), x = 0, z = -30, w = 70, d = 44, lo = C.lo(x, z, 40) - 8, g1 = C.hi(x, z, 30) + 30;
      /* two storeys: stone below, a jettied timber-framed floor above, a big roof, two chimneys, the hanging sign */
      C.add('stone', 'boxnb', { x, y: lo, z, sx: w, sy: g1 - lo, sz: d, col: 0xd0c8b8 });
      C.add('wood', 'box', { x, y: g1 - 3, z, sx: w + 7, sy: 4, sz: d + 7, col: 0x5a3e28, ao: false });
      C.add('plaster', 'boxnb', { x, y: g1, z, sx: w + 6, sy: 28, sz: d + 6, col: 0xf4ead6, ao: false });
      for (let i = 0; i < 5; i++) C.add('wood', 'boxnb', { x: x - (w + 6) / 2 + i * (w + 6) / 4, y: g1, z: z + (d + 6) / 2 + .4, sx: 3, sy: 28, sz: 1.5, col: 0x5a3e28, ao: false });
      C.add(k.rm, 'gable', { x, y: g1 + 27, z, sx: w + 14, sy: 30, sz: d + 14, col: k.rc });
      for (const s of [-1, 1]) C.add('stone', 'boxnb', { x: x + s * 26, y: g1 + 30, z: z - 6, sx: 8, sy: 30, sz: 8, col: 0xb0a89c, ao: false });
      for (let i = 0; i < 4; i++) windowAt(C, x - 27 + i * 18, g1 + 9, z + (d + 6) / 2 + .8, 0, 7, 10);
      for (const i of [0, 3]) windowAt(C, x - 27 + i * 18, lo + 14 + (C.gy(x, z) - lo), z + d / 2 + .6, 0, 7, 11);
      C.add('misc', 'arch', { x, y: C.gy(x, z) - 1, z: z + d / 2 + .6, sx: 12, sy: 20, sz: 1, col: 0x2b1d12, ao: false });
      signAt(C, x + 16, z + d / 2, g1 + 4, 0);
      /* the stable: an open lean-to with hay, a trough */
      const sx = 72, sz = 10, sy = C.gy(sx, sz) - 2;
      for (const [lx, lz] of [[-20, -14], [20, -14], [-20, 14], [20, 14]]) C.add('wood', 'boxnb', { x: sx + lx, y: sy, z: sz + lz, sx: 3, sy: lz < 0 ? 30 : 22, sz: 3, col: 0x6a4a30, ao: false });
      C.add('thatch', 'box', { x: sx, y: sy + 25, z: sz, sx: 48, sy: 2.5, sz: 36, rx: .22, col: 0xe8d8b0, ao: false });
      C.add('wood', 'boxnb', { x: sx, y: sy, z: sz - 15, sx: 40, sy: 16, sz: 2, col: 0x7a5a38 });
      C.add('thatch', 'ico0', { x: sx - 8, y: sy + 4, z: sz - 4, sx: 10, sy: 6, sz: 8, col: 0xf0dca0, ao: false, uv: 'box' });
      C.add('wood', 'boxnb', { x: sx, y: sy, z: sz + 24, sx: 24, sy: 6, sz: 6, col: 0x6a4a30, ao: false });
      lamp(C, -30, 22); lamp(C, 40, 26); barrel(C, -44, 6); barrel(C, -48, 13, .8); barrel(C, -40, 14, .9); cart(C, -70, 40, 1.2);
      fenceRun(C, 50, 40, 100, 40);
      C.grp.userData.radius = 150;
    },
    tower(C) {
      const st = jit(C, C.pal.wc, .1), top = tower(C, 0, 0, { r: 24, h: 150 + C.rnd() * 30, roof: 'cren', mat: C.pal.wall === 'sand' ? 'sand' : 'stone', col: st, win: 3 });
      /* the brazier: a bowl on the roof with a fire that glows at night */
      C.add('misc', 'cyl8', { x: 0, y: top - 2, z: 0, sx: 4, sy: 8, sz: 4, col: 0x2a2420, ao: false });
      C.add('misc', 'cone8', { x: 0, y: top + 16, z: 0, sx: 12, sy: -10, sz: 12, col: 0x3a3028, ao: false });
      C.add('glow', 'cone8', { x: 0, y: top + 12, z: 0, sx: 7, sy: 18, sz: 7, col: 0xffa040, ao: false });
      C.add('ice', 'cone8', { x: 1, y: top + 12, z: 1, sx: 4, sy: 26, sz: 4, col: 0xffe070, a: .7, ao: false });
      C.add('misc', 'arch', { x: 0, y: C.gy(0, 24) - 1, z: 25.4, sx: 12, sy: 22, sz: 1, col: 0x1a120c, ao: false });
      for (let i = 0; i < 4; i++) { const a = C.rnd() * TAU, d = 50 + C.rnd() * 40; rock(C, Math.sin(a) * d, Math.cos(a) * d, 10 + C.rnd() * 10, 'stone', 0xa8a49c); }
      barrel(C, 34, 14); C.grp.userData.radius = 90;
    },
    ruin(C) {
      const rnd = C.rnd, mats = C.pal.wall === 'sand' ? 'sand' : 'stone', moss = 0xa0ae84, n = 5 + Math.floor(rnd() * 3);
      /* broken walls with jagged tops along a lost square, a tower stump, fallen blocks, moss */
      const pts = [[-110, -90], [110, -90], [110, 90], [-110, 90]];
      for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4]; for (let j = 0; j < 4; j++) { if (rnd() < .3) continue; const f0 = j / 4, f1 = (j + 1) / 4, x0 = a[0] + (b[0] - a[0]) * f0, z0 = a[1] + (b[1] - a[1]) * f0, x1 = a[0] + (b[0] - a[0]) * f1, z1 = a[1] + (b[1] - a[1]) * f1;
          const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0), h = 14 + rnd() * 44, lo = C.lo(mx, mz, 20) - 10;
          C.add(mats, 'boxnb', { x: mx, y: lo, z: mz, sx: L - 4, sy: C.gy(mx, mz) - lo + h, sz: 14, ry: Math.atan2(-(z1 - z0), x1 - x0) + (rnd() - .5) * .06, rz: (rnd() - .5) * .05, col: jit(C, rnd() < .4 ? moss : 0xc8c2b6, .12) });
          for (let k = 0; k < 2; k++) C.add(mats, 'box', { x: mx + (rnd() - .5) * L * .6, y: C.gy(mx, mz) + h - 2, z: mz + (rnd() - .5) * 4, sx: 8 + rnd() * 8, sy: 4 + rnd() * 10, sz: 12, ry: Math.atan2(-(z1 - z0), x1 - x0), col: jit(C, 0xc0bab0, .1), ao: false }); } }
      const tt = tower(C, 110, -90, { r: 22, h: 60 + rnd() * 30, roof: 'none', mat: mats, col: 0xb8b2a6, win: 1 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; C.add(mats, 'boxnb', { x: 110 + Math.sin(a) * 22, y: tt - 3, z: -90 + Math.cos(a) * 22, sx: 12, sy: 3 + rnd() * 16, sz: 7, ry: a, col: 0xb8b2a6, ao: false }); }
      for (let i = 0; i < n; i++) { const x = (rnd() - .5) * 240, z = (rnd() - .5) * 200; C.add(mats, 'box', { x, y: C.gy(x, z) - 3, z, sx: 10 + rnd() * 14, sy: 7 + rnd() * 6, sz: 8 + rnd() * 10, ry: rnd() * 3, rx: (rnd() - .5) * .5, rz: (rnd() - .5) * .5, col: jit(C, rnd() < .5 ? moss : 0xc0bab0, .1) });
        C.add('misc', 'ico0', { x: x + 3, y: C.gy(x, z) + 4, z, sx: 6 + rnd() * 5, sy: 2.5, sz: 5 + rnd() * 4, col: jit(C, 0x5a7a3a, .2), ao: false }); }
      for (let i = 0; i < 4; i++) bush(C, (rnd() - .5) * 260, (rnd() - .5) * 220, 9 + rnd() * 6, 0x4e6e36);
      C.grp.userData.radius = 180;
    },
    camp(C) {
      const rnd = C.rnd, cloth = [0xc9b18a, 0x9a8a6a, 0x8a6a4a, 0xb0a080], dead = C.poi.camp === 'wight', iron = C.poi.camp === 'ironborn';
      const nt = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < nt; i++) { const a = i / nt * TAU + rnd() * .5, d = 50 + rnd() * 25, x = Math.cos(a) * d, z = Math.sin(a) * d + 20;
        if (rnd() < .5) C.add('misc', 'tent', { x, y: C.gy(x, z) - 3, z, sx: 24 + rnd() * 8, sy: 34 + rnd() * 10, sz: 24 + rnd() * 8, ry: rnd() * 6, col: jit(C, dead ? 0x6a6a68 : cloth[i % 4], .15), ao: true });
        else C.add('misc', 'gable', { x, y: C.gy(x, z) - 2, z, sx: 40, sy: 24, sz: 26, ry: -a, col: jit(C, dead ? 0x5a5c5e : cloth[(i + 1) % 4], .15) }); }
      const fy = C.gy(0, 20);
      for (let i = 0; i < 3; i++) C.add('wood', 'cyl6', { x: 0, y: fy + 3, z: 20, sx: 2.6, sy: 26, sz: 2.6, rz: Math.PI / 2, ry: i * Math.PI / 3, col: 0x6a4a30, uv: 'box' });
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; C.add('dark', 'ico0', { x: Math.cos(a) * 12, y: fy, z: 20 + Math.sin(a) * 12, sx: 4, sy: 3.5, sz: 4, col: 0x8a8884, ao: false }); }
      C.add('ice', 'cone8', { x: 0, y: fy + 2, z: 20, sx: 7, sy: 18, sz: 7, col: dead ? 0x80d0ff : 0xffa040, a: .85, ao: false });
      C.add('ice', 'cone8', { x: 1, y: fy + 2, z: 21, sx: 4, sy: 26, sz: 4, col: dead ? 0xc0f0ff : 0xffe070, a: .7, ao: false });
      for (let i = 0; i < 2; i++) { const x = -40 + i * 80 + rnd() * 10, z = -30 + rnd() * 10; C.add('wood', 'cyl6', { x, y: C.gy(x, z) + 4, z, sx: 5, sy: 40, sz: 5, rz: Math.PI / 2, ry: rnd() * 3, col: 0x7a5a3a, uv: 'box' }); }
      if (iron) C.add('wood', 'gable', { x: 0, y: C.gy(0, -70) + 14, z: -70, sx: 130, sy: 16, sz: 26, rz: Math.PI, col: 0x6a5038 });
      for (let i = 0; i < 3; i++) { const x = 30 + i * 6, z = 50; C.add('wood', 'boxnb', { x, y: C.gy(x, z) - 2, z, sx: 1.6, sy: 30, sz: 1.6, rz: (i - 1) * .12, col: 0x5a4028, ao: false }); }
      const light = new THREE.PointLight(dead ? 0x80c8ff : 0xffa040, 1.6, 320, 1.5); light.position.set(0, fy + 26, 20); light.name = 'firelight'; C.grp.add(light);
      C.grp.userData.radius = 110;
    },
    dungeon(C) {
      const rnd = C.rnd, ice = /cave|frost|ice/.test((C.poi.id || '') + (C.poi.name || '').toLowerCase()), crypt = /crypt|sept|tomb|vault|dungeon/i.test((C.poi.id || '') + ' ' + (C.poi.name || '')) && !ice;
      if (crypt) { /* crypt stairs under a stone portal */
        const y = C.gy(0, 0); C.add('stone', 'boxnb', { x: 0, y: y - 10, z: -6, sx: 90, sy: 22, sz: 70, col: 0xa8a49c });
        for (const s of [-1, 1]) C.add('stone', 'boxnb', { x: s * 34, y: y - 6, z: 26, sx: 16, sy: 80, sz: 18, col: 0xb4b0a8 });
        C.add('stone', 'box', { x: 0, y: y + 72, z: 26, sx: 92, sy: 16, sz: 22, col: 0xb8b4ac }); C.add('stone', 'cone4', { x: 0, y: y + 88, z: 26, sx: 54, sy: 20, sz: 16, col: 0xa8a49c });
        C.add('misc', 'arch', { x: 0, y: y - 2, z: 35.6, sx: 50, sy: 72, sz: 1, col: 0x080808, ao: false });
        for (let i = 0; i < 4; i++) C.add('stone', 'box', { x: 0, y: y - 4 - i * 3, z: 50 - i * 6, sx: 50, sy: 4, sz: 8, col: 0x9c988e, ao: false });
        for (let i = 0; i < 4; i++) C.add('stone', 'boxnb', { x: -60 + i * 40, y: y - 4, z: 60 + rnd() * 20, sx: 10, sy: 22 + rnd() * 10, sz: 5, rz: (rnd() - .5) * .3, col: 0x9a968e }); }
      else { /* a cave mouth in a rock mound */
        C.add(ice ? 'ice' : 'dark', ice ? 'rockB' : 'rockD', { x: 0, y: C.lo(0, -20, 60) - 30, z: -30, sx: 110, sy: 110, sz: 80, ry: rnd() * .5, col: ice ? 0xd8ecf8 : 0x9a948c, a: 1, uv: 'box', ao: false });
        C.add('misc', 'arch', { x: 0, y: C.gy(0, 40) - 6, z: 44, sx: 56, sy: 64, sz: 1, col: 0x060608, ao: false });
        for (let i = 0; i < 5; i++) rock(C, -70 + i * 35, 60 + rnd() * 30, 10 + rnd() * 12, ice ? 'ice' : 'dark', ice ? 0xe0f0ff : 0x8a8682); }
      C.grp.userData.radius = 90;
    },
    shrine(C) {
      const r = String(C.poi.region || ''), north = /north|wall|beyond|winter|river|neck|vale|coast/.test(r) || /weirwood|godswood|heart|grove|ring/i.test(C.poi.name || '');
      if (north) { const icy = /beyond|winter/.test(r); weirwood(C, 0, 0, 1.1, icy);
        if (/ring|grove|nine/i.test((C.poi.name || '') + (C.poi.blurb || ''))) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; weirwood(C, Math.sin(a) * 90, Math.cos(a) * 90, .45, icy); }
        C.add('dark', 'cap8', { x: 0, y: C.gy(0, 34) + .5, z: 34, sx: 16, sy: 1, sz: 12, col: 0x203038, ao: false });
        rock(C, 20, 40, 10, 'stone', 0xa8a49c); }
      else { /* a small sept: seven sides, a cone roof, a crystal */
        const top = tower(C, 0, 0, { r: 30, h: 40, roof: 'cone', mat: 'plaster', col: 0xf2ece0, rm: 'slate', rc: 0xb8c0c8, win: 3, fin: 0xf0f0ff });
        C.add('ice', 'ico0', { x: 0, y: top + 62, z: 0, sx: 5, sy: 9, sz: 5, col: 0xf8fbff, a: .8, ao: false });
        for (let i = 0; i < 4; i++) bush(C, -40 + i * 26, 46, 8, 0x5a7a3a); }
      C.grp.userData.radius = 70;
    },
    lair(C) {
      const rnd = C.rnd;
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rnd() * .3, d = 60 + rnd() * 60, x = Math.sin(a) * d, z = Math.cos(a) * d; C.add('ice', 'cone8', { x, y: C.gy(x, z) - 10, z, sx: 10 + rnd() * 10, sy: 60 + rnd() * 90, sz: 10 + rnd() * 10, rx: (rnd() - .5) * .4, rz: (rnd() - .5) * .4, col: 0xd8eefc, a: .8, ao: false }); }
      C.add('ice', 'rockS', { x: 0, y: C.gy(0, 0) - 20, z: 0, sx: 50, sy: 40, sz: 50, col: 0xe8f6ff, a: .9, ao: false });
      C.grp.userData.radius = 140;
    }
  };

  function typeOf(poi) { const t = String(poi.type || poi.kind || ''); return B[t] ? t : /seat|castle|keep|hold|fort/i.test(t) ? 'castle' : /village|hamlet/i.test(t) ? 'village' : /farm/i.test(t) ? 'farm' : /inn|tavern/i.test(t) ? 'inn' : /tower|watch/i.test(t) ? 'tower' : /ruin/i.test(t) ? 'ruin' : /town|city|port/i.test(t) ? 'town' : /camp/i.test(t) ? 'camp' : /dungeon|portal|crypt|cave/i.test(t) ? 'dungeon' : /shrine|weirwood|godswood|sept/i.test(t) ? 'shrine' : /lair/i.test(t) ? 'lair' : null; }
  function seatKey(poi) { const id = String(poi.id || '').toLowerCase(); if (SEATS[id] && id !== 'kingslanding') return id; if (poi.seat && poi.house && SEATS[poi.house]) return poi.house; return null; }
  function build(poi) {
    if (!has() || !poi) return null; if (R.arch && R.arch.off) return null;
    const type = typeOf(poi); if (!type) return null;
    const C = Ctx(poi); C.gyBase = C.gy; const sk = type === 'castle' ? seatKey(poi) : null;
    if (sk) SEATS[sk](C); else B[type](C);
    C.gy = C.gyBase;
    if (sk || poi.seat || /kingslanding/.test(poi.id || '')) for (const c of spawnSpots(poi)) clearSpot(C, c[0], c[1], SPAWN_CLEAR);
    C.finish();
    const grp = C.grp; grp.name = 'poi:' + type; grp.position.set(poi.x || 0, 0, poi.y || 0);
    grp.userData.poi = poi; grp.userData.type = type; grp.userData.arch = sk || type; grp.userData.seat = !!sk || /kingslanding/.test(poi.id || ''); grp.userData.tris = tris(grp);
    if (!grp.userData.radius) grp.userData.radius = 160;
    return grp;
  }
  /* the courtyard where a new life stands (00_core R.spawnPoint: the seat's centre + (poi.r or 160) + 40 to the south, or the
     point it really picks) stays open: SPAWN_CLEAR units around it carry no building part above the ground; long wall slabs are cut
     around the circle (a breach), anything else that reaches into it is left out */
  const SPAWN_CLEAR = 92;
  function spawnSpots(poi) { const r = +poi.r > 0 ? +poi.r : 160, out = [[0, r + 40]];
    try { if (poi.house && typeof R.spawnPoint === 'function') { const sp = R.spawnPoint(poi.house); if (sp && isFinite(sp.x) && isFinite(sp.y)) { const dx = sp.x - (poi.x || 0), dz = sp.y - (poi.y || 0);
      if (dx * dx + dz * dz < 700 * 700 && (Math.abs(dx) > 4 || Math.abs(dz - r - 40) > 4)) out.push([dx, dz]); } } } catch (e) {}
    return out; }
  function clearSpot(C, cx, cz, RC) {
    const gy = C.gy(cx, cz) + 6;
    for (const m in C.B) { const parts = C.B[m], keep = [];
      for (const p of parts) { const g = p.g, o = p.o; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
        const sx = o.sx == null ? 1 : o.sx, sy = o.sy == null ? 1 : o.sy, sz = o.sz == null ? 1 : o.sz, ry = o.ry || 0;
        const top = (o.y || 0) + Math.max(bb.max.y * sy, bb.min.y * sy); if (top <= gy) { keep.push(p); continue; }
        const ux = Math.cos(ry), uz = -Math.sin(ry), vx = Math.sin(ry), vz = Math.cos(ry), dx = cx - (o.x || 0), dz = cz - (o.z || 0);
        const x0 = bb.min.x * sx, x1 = bb.max.x * sx, z0 = bb.min.z * sz, z1 = bb.max.z * sz, tilt = Math.abs(o.rx || 0) + Math.abs(o.rz || 0) > .05 ? Math.max(sy, 4) * .5 : 0;
        const t = dx * ux + dz * uz, n = dx * vx + dz * vz, et = Math.max(x0 - tilt - t, 0, t - x1 - tilt), en = Math.max(z0 - tilt - n, 0, n - z1 - tilt);
        if (et * et + en * en >= RC * RC) { keep.push(p); continue; }   // the footprint misses the circle
        const L = x1 - x0, slab = (Math.abs(bb.min.x + .5) < 1e-3 && Math.abs(bb.max.x - .5) < 1e-3 && Math.abs(bb.min.z + .5) < 1e-3 && Math.abs(bb.max.z - .5) < 1e-3);
        if (!slab || tilt || L < (z1 - z0) * 2.5) continue;   // not a long wall slab: left out
        const h = Math.sqrt(Math.max(0, RC * RC - en * en)), cut0 = t - h, cut1 = t + h;
        for (const [a, b] of [[x0, Math.min(x1, cut0)], [Math.max(x0, cut1), x1]]) { if (b - a < 4) continue; const mid = (a + b) / 2;
          keep.push(Object.assign({}, p, { o: Object.assign({}, o, { x: (o.x || 0) + ux * mid, z: (o.z || 0) + uz * mid, sx: b - a }) })); }
      }
      C.B[m] = keep; if (!keep.length) delete C.B[m]; }
  }
  function tris(obj) { let n = 0; if (!obj) return 0; obj.traverse(o => { if (o.isMesh && o.geometry && o.name !== 'steam') { const g = o.geometry; n += Math.round((g.index ? g.index.count : g.attributes.position.count) / 3); } }); return n; }

  /* ---------- the Wall: ice along R.data.world.wall.pts, cracked, snow on top, in world coordinates ---------- */
  function wall() {
    if (!has() || (R.arch && R.arch.off)) return null; const d = (R.data && R.data.world && R.data.world.wall) || {};
    const pts = d.pts && d.pts.length > 1 ? d.pts : [[d.x0 != null ? d.x0 : 1200, d.y != null ? d.y : 2600], [d.x1 != null ? d.x1 : 6000, d.y != null ? d.y : 2600]];
    const R3 = R.render3d, gfn = R3 && R3.groundY ? R3.groundY : () => 0, h = d.h || 320, t = d.t || 80, grp = new THREE.Group(); grp.name = 'wall'; grp.userData.world = true; let tr = 0;
    const W = R.W || 7200, H = R.H || 12288, gy = (x, y) => gfn(clamp(x, 0, W), clamp(y, 0, H));
    const C0 = { poi: { id: 'wall' } }; let chunk = null, nIn = 0; const rnd = mkRng(hashStr('the-wall'));
    const flush = () => { if (!chunk) return; chunk.finish(); for (const m of chunk.grp.children.slice()) { grp.add(m); } chunk = null; nIn = 0; };
    for (let s = 0; s < pts.length - 1; s++) { const [x0, y0] = pts[s], [x1, y1] = pts[s + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 170)), ry = Math.atan2(-(y1 - y0), x1 - x0);
      for (let i = 0; i < n; i++) {
        if (!chunk) { chunk = Ctx({ id: 'wall', x: 0, y: 0 }); chunk.gy = () => 0; }
        const a = i / n, b = (i + 1) / n, ax = x0 + (x1 - x0) * a, ay = y0 + (y1 - y0) * a, bx = x0 + (x1 - x0) * b, by = y0 + (y1 - y0) * b, mx = (ax + bx) / 2, my = (ay + by) / 2;
        const lo = Math.min(gy(ax, ay), gy(bx, by), gy(mx, my)) - 60, top = Math.max(gy(ax, ay), gy(bx, by), gy(mx, my)) + h * (.95 + rnd() * .1), ln = L / n + 6;
        chunk.add('ice', 'slab', { x: mx, y: lo, z: my, sx: ln, sy: top - lo, sz: t * (.92 + rnd() * .16), ry, col: 0xeef7ff, a: .93, ao: false, uv: 'box' });
        chunk.add('misc', 'snowcap', { x: mx, y: top - 2, z: my, sx: ln + 2, sy: 10, sz: t * 1.08, ry, col: 0xf6f9fc, ao: false });
        for (let k = 0; k < 2; k++) { const f = rnd() - .5, cx = mx + Math.cos(ry) * f * ln * .8, cz = my - Math.sin(ry) * f * ln * .8; chunk.add('ice', 'plane', { x: cx + Math.sin(ry) * (t / 2 + 1.5), y: lo + 60 + rnd() * h * .4, z: cz + Math.cos(ry) * (t / 2 + 1.5), sx: 3 + rnd() * 4, sy: 80 + rnd() * 120, sz: 1, ry, rz: (rnd() - .5) * .5, col: 0x5a88b0, a: .45, ao: false }); }
        if (++nIn >= 5) flush();
      } }
    flush(); grp.userData.tris = tris(grp); return grp;
  }
  /* ---------- steam puffs + the Wall in the scene ---------- */
  function update(dt) {
    const t = (R.t || 0);
    for (let i = S.puffs.length - 1; i >= 0; i--) { const m = S.puffs[i]; if (!m.parent) continue; const b = m.userData.base, f = ((t * .22 + b.ph) % 1);
      m.position.set(b.x + Math.sin(f * 6 + b.ph * 9) * 6, b.y + f * 70, b.z); m.scale.setScalar((4 + f * 10) * (f < .8 ? 1 : (1 - f) * 5)); }
    if (S.mats && S.mats.glow) { const A = R.ambience, k = A ? (A.nightK != null ? A.nightK : A.night ? 1 : 0) : 0, v = .16 + 1.5 * clamp(k, 0, 1); S.mats.glow.color.setRGB(v, v * .96, v * .9); }
    const R3 = R.render3d; if (!R3 || !R3.scene || (R.arch && R.arch.autoWall === false)) return;
    const hm = R3.heightmap || R3.terrain || 1; if (S.hm !== hm) { S.hm = hm; if (S.wall) { R3.scene.remove(S.wall); S.wall.traverse(o => { if (o.geometry) o.geometry.dispose(); }); S.wall = null; }
      if (!R3.scene.getObjectByName('wall')) { try { S.wall = R.props.wall(); if (S.wall) R3.scene.add(S.wall); } catch (e) { S.wall = null; } } }
  }

  /* ---------- install over A37 ---------- */
  try {
    R.props = R.props || {};
    const baseBuild = R.props.build, baseWall = R.props.wall;
    R.props.build = poi => { let o = null; try { o = build(poi); } catch (e) { if (!S.warned) { S.warned = 1; console.warn('arch: build', poi && poi.id, e); } o = null; } return o || (baseBuild ? baseBuild(poi) : null); };
    R.props.wall = () => { let o = null; try { o = wall(); } catch (e) { if (!S.warnedW) { S.warnedW = 1; console.warn('arch: wall', e); } o = null; } return o || (baseWall ? baseWall() : null); };
    R.arch = { build, wall, mats, tris, geo: k => geo(k), S, SEATS, palette, autoWall: true };
    if (R.addSys && R.sys && !R.sys.arch) R.addSys('arch', { order: 86, update });
  } catch (e) { try { console.warn('arch: install', e); } catch (x) {} }
})();
