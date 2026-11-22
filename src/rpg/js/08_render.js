/* HOLDOR RPG — render system (A05). The ONLY system that clears the canvas (order 900).
   Draw order: base fill → map art (R.assets.map, visible source rect only; parchment gradient if absent) → grain →
   roads → POI markers → fog of the undiscovered (cached 1/8 canvas) → gate haze → boss telegraphs → entities
   (culled to viewport + 120 px, z-sorted) → vfx world layer → vignette → ambience tint.
   Camera (update, order 900): follows R.player, lerp .12, lookahead 40 u in the move direction, clamped to the world;
   zoom 1.0 on phones, 1.25 when the screen is wider than 700 px (set R.cam.zAuto = false to drive the zoom yourself).
   Soft dependencies (all optional): R.draw.sprite/champ/hero(key?, sx, sy, o) with SCREEN coords and o = {face, anim,
   animT, scale (= zoom), e, team, ctx}; R.draw.zsort(list); R.draw.bar(ctx, x, y, w, h, frac, col); R.world.regionAt;
   R.world.gateOpen(id); R.data.world.{regions, pois, roads, gates}; R.data.houses[h].col; R.sys.vfx.drawWorld(ctx);
   R.sys.boss.drawTelegraphs(ctx); R.sys.ambience.drawTint(ctx).
   API: R.render.worldToScreenRect(x, y, w, h) → {x, y, w, h}; R.render.redrawFog(); R.render.snapCam();
   R.render.visible(margin) → {x0, y0, x1, y1} world rect; R.render.fogCanvas; R.render.stats {last, hist, median()}. */
(function () {
  const Rd = {}; R.render = Rd;
  const WS = R.WS || 1, FOG_K = 8 * WS, FOG_A = 0.55, FOG_HOLE = 420 * WS, CULL = 120, LOOK = 40, CAM_K = 0.12;
  const RAR = ['#cfcfcf', '#7fd06a', '#5aa5ff', '#c060ff', '#ffb347'];
  const HOUSE_COL = { stark: '#a9bdd0', lannister: '#d12b2b', baratheon: '#e3b661', targaryen: '#b1121b', tyrell: '#5fa84a',
    martell: '#e07b2a', greyjoy: '#2e5f7a', arryn: '#6fa7d8', tully: '#3f7fb0', bolton: '#c75b7a', night: '#30343a', wildling: '#7a5a3a' };
  const warned = {};

  /* ---------- small helpers ---------- */
  const bbCache = new WeakMap();
  // a polygon / polyline in any of the shapes the data module may use → [[x,y],...] or null
  function pts(o) {
    if (!o) return null;
    let P = Array.isArray(o) ? o : (o.poly || o.pts || o.points || o.polygon || o.path || o.line);
    if (!P || !P.length) return null;
    if (typeof P[0] === 'number') { const out = []; for (let i = 0; i + 1 < P.length; i += 2) out.push([P[i], P[i + 1]]); return out; }
    if (!Array.isArray(P[0])) P = P.map(q => [q.x, q.y]);
    return P.length ? P : null;
  }
  function bb(o, P) {
    let b = bbCache.get(o); if (b) return b;
    b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const [x, y] of P) { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
    if (typeof o === 'object') bbCache.set(o, b);
    return b;
  }
  const hit = (b, v, m) => b.x1 >= v.x0 - (m || 0) && b.x0 <= v.x1 + (m || 0) && b.y1 >= v.y0 - (m || 0) && b.y0 <= v.y1 + (m || 0);
  function pip(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  const rid = r => r == null ? null : (typeof r === 'string' ? r : (r.id || r.key || r.name || null));
  const pxy = p => (p && p.x != null) ? p : (p && p.pos) ? p.pos : (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: 0, y: 0 });
  const drawable = im => { if (!im) return null; im = im.img || im.image || im.canvas || im; const w = im.naturalWidth || im.width;
    if (!w || im.complete === false) return null; return im; };
  function label(ctx, txt, x, y, fs, col, al) {
    ctx.font = '700 ' + fs + 'px Cinzel, Georgia, serif'; ctx.textAlign = al || 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = Math.max(2, fs * .28); ctx.strokeStyle = 'rgba(4,8,16,.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y);
  }
  Rd.visible = m => { m = m || 0; const C = R.cam, hw = R.vw / 2 / C.z, hh = R.vh / 2 / C.z; return { x0: C.x - hw - m, y0: C.y - hh - m, x1: C.x + hw + m, y1: C.y + hh + m }; };
  Rd.worldToScreenRect = (x, y, w, h) => { const s = R.w2s(x, y); return { x: s.x, y: s.y, w: w * R.cam.z, h: h * R.cam.z }; };
  Rd.pts = pts; Rd.pip = pip; Rd.rid = rid; Rd.pxy = pxy; Rd.label = label; Rd.houseCol = houseCol; Rd.RAR = RAR;

  /* ---------- discovery ---------- */
  function seenSet() {
    const S = new Set(); const p = R.state && R.state.p; if (!p) return S;
    const fr = p.flags && p.flags.regions;
    if (Array.isArray(fr)) fr.forEach(id => S.add(id)); else if (fr && typeof fr === 'object') for (const k in fr) if (fr[k]) S.add(k);
    const cur = curRegion(); if (cur) S.add(cur);
    return S;
  }
  function curRegion() {
    const pl = R.player; if (!pl) return null;
    if (R.world && R.world.regionAt) { try { return rid(R.world.regionAt(pl.x, pl.y)); } catch (e) { return null; } }
    const regs = R.data.world && R.data.world.regions; if (!regs) return null;
    for (const rg of regs) { const P = pts(rg); if (P && pip(pl.x, pl.y, P)) return rid(rg); }
    return null;
  }
  const foundSet = () => new Set((R.state && R.state.p && R.state.p.found) || []);
  function gateOpen(g, id) {
    if (g && typeof g === 'object' && g.open != null) return !!g.open;
    if (R.world && R.world.gateOpen) { try { return !!R.world.gateOpen(id); } catch (e) {} }
    const p = R.state && R.state.p; const fg = p && p.flags && p.flags.gates;
    if (fg) return Array.isArray(fg) ? fg.includes(id) : !!fg[id];
    return seenSet().has(id);
  }
  Rd.seenSet = seenSet; Rd.foundSet = foundSet; Rd.gateOpen = gateOpen;

  /* ---------- fog of the undiscovered (1/8 world, cached) ---------- */
  let fog = null, mask = null, tiny = null, fogEmpty = true, fogSig = '';
  Rd.fogCanvas = null; Rd.fogEmpty = () => fogEmpty;
  function sig() { const W = R.data.world; if (!W || !W.regions) return 'none';
    return Array.from(seenSet()).sort().join(',') + '|' + Array.from(foundSet()).sort().join(','); }
  Rd.redrawFog = function () {
    const W = R.data.world, regs = W && W.regions; fogSig = sig();
    if (!regs || !regs.length) { fogEmpty = true; return; }
    const w = Math.ceil(R.W / FOG_K), h = Math.ceil(R.H / FOG_K);
    if (!fog) { fog = document.createElement('canvas'); fog.width = w; fog.height = h; mask = document.createElement('canvas'); mask.width = w; mask.height = h;
      tiny = document.createElement('canvas'); tiny.width = Math.ceil(w / 6); tiny.height = Math.ceil(h / 6); Rd.fogCanvas = fog; }
    const seen = seenSet(); const mc = mask.getContext('2d'); mc.clearRect(0, 0, w, h); mc.fillStyle = '#000';
    let any = false;
    for (const rg of regs) { if (seen.has(rid(rg))) continue; const P = pts(rg); if (!P) continue; any = true;
      mc.beginPath(); for (let i = 0; i < P.length; i++) { const q = P[i]; if (i) mc.lineTo(q[0] / FOG_K, q[1] / FOG_K); else mc.moveTo(q[0] / FOG_K, q[1] / FOG_K); }
      mc.closePath(); mc.fill(); }
    const fc = fog.getContext('2d'); fc.clearRect(0, 0, w, h); fogEmpty = !any;
    if (any) {
      // soft edges without ctx.filter: down-scale the hard mask, draw it back up with bilinear smoothing
      const tc = tiny.getContext('2d'); tc.clearRect(0, 0, tiny.width, tiny.height); tc.imageSmoothingEnabled = true; tc.drawImage(mask, 0, 0, tiny.width, tiny.height);
      fc.imageSmoothingEnabled = true; fc.drawImage(tiny, 0, 0, w, h);
      // the places the player has found stay visible even inside an unentered region
      const found = foundSet(); const pois = W.pois || []; fc.globalCompositeOperation = 'destination-out';
      for (const poi of pois) { if (!found.has(poi.id)) continue; const q = pxy(poi), cx = q.x / FOG_K, cy = q.y / FOG_K, r = FOG_HOLE / FOG_K;
        const g = fc.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        fc.fillStyle = g; fc.fillRect(cx - r, cy - r, r * 2, r * 2); }
      fc.globalCompositeOperation = 'source-over';
    }
    R.bus.emit('fog', fog, fogEmpty);
  };
  function fogCheck() { if (!R.data.world) return; if (sig() !== fogSig) Rd.redrawFog(); }
  R.bus.on('enter', () => Rd.redrawFog()); R.bus.on('poi', () => Rd.redrawFog()); R.bus.on('tick1s', fogCheck);
  let lastState = null;

  /* ---------- blit an image that covers the whole world (map art, fog) with the camera ---------- */
  function blitWorld(ctx, img, alpha) {
    const v = Rd.visible(0); const x0 = Math.max(0, v.x0), y0 = Math.max(0, v.y0), x1 = Math.min(R.W, v.x1), y1 = Math.min(R.H, v.y1);
    if (x1 <= x0 || y1 <= y0) return;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, kx = iw / R.W, ky = ih / R.H;
    const s = R.w2s(x0, y0), e = R.w2s(x1, y1);
    ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, Math.floor(s.x), Math.floor(s.y), Math.ceil(e.x - s.x) + 1, Math.ceil(e.y - s.y) + 1);
    ctx.globalAlpha = 1;
  }

  /* ---------- background ---------- */
  function drawMap(ctx) {
    const img = drawable(R.assets && R.assets.map);
    if (img) { blitWorld(ctx, img, 1); return true; }
    // parchment: cold north → warm south, with the world's edges visible
    const a = R.w2s(0, 0), b = R.w2s(R.W, R.H);
    const g = ctx.createLinearGradient(0, a.y, 0, b.y);
    g.addColorStop(0, '#e2e8ec'); g.addColorStop(.16, '#c4c9bf'); g.addColorStop(.42, '#b5a378'); g.addColorStop(.78, '#c2a46b'); g.addColorStop(1, '#d4b474');
    ctx.fillStyle = g; ctx.fillRect(Math.max(0, a.x), Math.max(0, a.y), Math.min(R.vw, b.x) - Math.max(0, a.x), Math.min(R.vh, b.y) - Math.max(0, a.y));
    return false;
  }
  let grainPat = null, grainJ = 0, gjx = 0, gjy = 0;
  function drawGrain(ctx) {
    if (!grainPat) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const id = g.createImageData(128, 128), d = id.data;
      let s = 7; for (let i = 0; i < d.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = d[i + 1] = d[i + 2] = s >>> 24; d[i + 3] = 255; }
      g.putImageData(id, 0, 0); grainPat = ctx.createPattern(c, 'repeat'); }
    if (++grainJ % 3 === 0) { gjx = (Math.random() * 128) | 0; gjy = (Math.random() * 128) | 0; }
    ctx.save(); ctx.globalAlpha = .07; ctx.translate(gjx, gjy); ctx.fillStyle = grainPat; ctx.fillRect(-gjx, -gjy, R.vw, R.vh); ctx.restore();
  }
  let vig = null, vigW = 0, vigH = 0;
  function drawVignette(ctx) {
    if (!vig || vigW !== R.vw || vigH !== R.vh) { vigW = R.vw; vigH = R.vh; vig = document.createElement('canvas'); vig.width = Math.ceil(R.vw / 2); vig.height = Math.ceil(R.vh / 2);
      const g = vig.getContext('2d'); const cx = vig.width / 2, cy = vig.height / 2, r = Math.hypot(cx, cy);
      const gr = g.createRadialGradient(cx, cy, r * .45, cx, cy, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = gr; g.fillRect(0, 0, vig.width, vig.height); }
    ctx.drawImage(vig, 0, 0, R.vw, R.vh);
  }
  Rd.drawVignette = drawVignette;

  /* ---------- roads ---------- */
  function drawRoads(ctx, v) {
    const roads = R.data.world && R.data.world.roads; if (!roads || !roads.length) return;
    const z = R.cam.z; const vis = [];
    for (const rd of roads) { const P = pts(rd); if (P && P.length > 1 && hit(bb(rd, P), v, 40)) vis.push(P); }
    if (!vis.length) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); for (const P of vis) for (let i = 0; i < P.length; i++) { const s = R.w2s(P[i][0], P[i][1]); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); } };
    path(); ctx.lineWidth = 7 * z; ctx.strokeStyle = 'rgba(70,46,24,.28)'; ctx.setLineDash([]); ctx.stroke();
    path(); ctx.lineWidth = 3.2 * z; ctx.strokeStyle = 'rgba(232,204,150,.88)'; ctx.setLineDash([12 * z, 9 * z]); ctx.stroke();
    ctx.restore();
  }

  /* ---------- POI markers ---------- */
  function houseCol(poi) {
    const h = poi.house; const H = R.data.houses;
    if (h && H && H[h] && H[h].col) return H[h].col; if (poi.col) return poi.col; return HOUSE_COL[h] || '#c23b3b';
  }
  function mCastle(ctx, x, y, k, poi) {
    const col = houseCol(poi);
    ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x - 11 * k, y - 10 * k, 22 * k, 10 * k);                 // keep
    for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 8 * k - 2.5 * k, y - 14 * k, 5 * k, 4 * k);  // battlements
    ctx.fillStyle = '#1a1d24'; ctx.fillRect(x - 2.5 * k, y - 6 * k, 5 * k, 6 * k);                 // gate
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(x, y - 14 * k); ctx.lineTo(x, y - 30 * k); ctx.stroke(); // pole
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 30 * k); ctx.lineTo(x + 11 * k, y - 30 * k); ctx.lineTo(x + 11 * k, y - 20 * k); ctx.lineTo(x + 5.5 * k, y - 17 * k); ctx.lineTo(x, y - 20 * k); ctx.closePath(); ctx.fill(); // banner
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x + 5.5 * k, y - 25 * k, 2.4 * k, 0, 7); ctx.fill();   // sigil mark
  }
  function mTown(ctx, x, y, k) {
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 8 * k, y - 9 * k, 16 * k, 9 * k);
    ctx.fillStyle = '#4a3324'; ctx.beginPath(); ctx.moveTo(x - 10 * k, y - 9 * k); ctx.lineTo(x, y - 18 * k); ctx.lineTo(x + 10 * k, y - 9 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(x - 2 * k, y - 5 * k, 4 * k, 5 * k);
  }
  function mCamp(ctx, x, y, k) {
    ctx.fillStyle = '#c9a877'; ctx.beginPath(); ctx.moveTo(x - 11 * k, y); ctx.lineTo(x, y - 16 * k); ctx.lineTo(x + 11 * k, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.moveTo(x - 3.5 * k, y); ctx.lineTo(x, y - 7 * k); ctx.lineTo(x + 3.5 * k, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.arc(x + 12 * k, y - 2 * k, 2 * k, 0, 7); ctx.fill();
  }
  function mDungeon(ctx, x, y, k) {
    ctx.strokeStyle = 'rgba(160,90,220,.55)'; ctx.lineWidth = 2.4 * k; ctx.fillStyle = '#0a0a12';
    ctx.beginPath(); ctx.moveTo(x - 8 * k, y); ctx.lineTo(x - 8 * k, y - 9 * k); ctx.arc(x, y - 9 * k, 8 * k, Math.PI, 0); ctx.lineTo(x + 8 * k, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a4a7a'; ctx.beginPath(); ctx.arc(x, y - 7 * k, 1.3 * k, 0, 7); ctx.fill();
  }
  function mShrine(ctx, x, y, k) {
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(x - 2 * k, y - 12 * k, 4 * k, 12 * k);
    ctx.fillStyle = '#b4201f'; ctx.beginPath(); ctx.arc(x, y - 15 * k, 9 * k, 0, 7); ctx.arc(x - 7 * k, y - 11 * k, 5 * k, 0, 7); ctx.arc(x + 7 * k, y - 11 * k, 5 * k, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a1414'; ctx.beginPath(); ctx.arc(x - 1 * k, y - 8 * k, .9 * k, 0, 7); ctx.arc(x + 1 * k, y - 8 * k, .9 * k, 0, 7); ctx.fill();
  }
  const POI = { castle: mCastle, town: mTown, village: mTown, camp: mCamp, dungeon: mDungeon, shrine: mShrine };
  Rd.poiMarkers = POI;
  function drawPois(ctx, v) {
    const pois = R.data.world && R.data.world.pois; if (!pois || !pois.length) return;
    const z = R.cam.z, k = z, found = foundSet(), pl = R.player, showNames = z >= .8;
    for (const poi of pois) {
      const q = pxy(poi); if (q.x < v.x0 - 60 || q.x > v.x1 + 60 || q.y < v.y0 - 80 || q.y > v.y1 + 40) continue;
      const s = R.w2s(q.x, q.y), disc = found.has(poi.id); ctx.globalAlpha = disc ? 1 : .6;
      (POI[poi.kind || poi.type] || mTown)(ctx, s.x, s.y, k, poi);
      if (showNames && poi.name && pl && Math.hypot(q.x - pl.x, q.y - pl.y) <= 700) label(ctx, poi.name, s.x, s.y + 4 * k, Math.max(10, Math.round(11.5 * z)), disc ? '#f3e7c4' : '#c6bfae');
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- the next closed region gate: a red haze on its boundary ---------- */
  function nextGate() {
    const W = R.data.world; const gates = W && W.gates; if (!gates || !gates.length) return null;
    for (const x of gates) { const i = typeof x === 'string' ? x : (x.id || x.region || x.to); if (!gateOpen(x, i)) {
      let P = typeof x === 'object' ? pts(x) : null, closed = false;
      if (!P) { const rg = (W.regions || []).find(r => rid(r) === i); P = rg && pts(rg); closed = true; }
      return P ? { id: i, P, closed, key: typeof x === 'object' ? x : P } : null; } }
    return null;
  }
  Rd.nextGate = nextGate;
  function drawGate(ctx, v) {
    const g = nextGate(); if (!g || !hit(bb(g.key, g.P), v, 40)) return;
    const P = g.P, z = R.cam.z, pulse = .5 + .5 * Math.sin(R.t * 2.2);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); let up = true;
    for (let i = 0; i <= P.length; i++) { const q = P[i % P.length]; if (i === P.length && !g.closed) break; const s = R.w2s(q[0], q[1]); if (s.behind) { up = true; continue; } if (up) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y); up = false; }
    ctx.lineWidth = 28 * z; ctx.strokeStyle = 'rgba(215,40,40,' + (.08 + .05 * pulse) + ')'; ctx.stroke();
    ctx.lineWidth = 11 * z; ctx.strokeStyle = 'rgba(230,60,50,' + (.2 + .08 * pulse) + ')'; ctx.stroke();
    ctx.lineWidth = 2.5 * z; ctx.strokeStyle = 'rgba(255,120,100,' + (.55 + .3 * pulse) + ')'; ctx.stroke();
    ctx.restore();
  }

  /* ---------- entities ---------- */
  const stOn = v => !!v && (typeof v !== 'number' || v > 0 && (v <= 60 || v > R.t)) && !(typeof v === 'object' && v.t != null && v.t <= 0);
  function shadow(ctx, s, r) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 1.5, r * .95, r * .4, 0, 0, 7); ctx.fill(); }
  function light(ctx, s, z) { const r = 72 * z; const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); g.addColorStop(0, 'rgba(255,232,170,.26)'); g.addColorStop(1, 'rgba(255,232,170,0)');
    ctx.fillStyle = g; ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2); }
  function fallbackBody(ctx, e, s, z) {
    const r = (e.r || 14) * z, col = e.kind === 'player' || e.kind === 'ghost' ? '#8fc0ff' : e.team === 0 ? '#7fd06a' : e.team === 2 ? '#e3b661' : e.kind === 'boss' ? '#b1121b' : '#d64b4b';
    const bob = e.anim === 'walk' ? Math.sin((e.animT || 0) * 14) * 1.5 * z : 0, h = r * 2.4;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(s.x, s.y - h * .45 + bob, r * .7, h * .42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f1d9b8'; ctx.beginPath(); ctx.arc(s.x + (e.face || 1) * r * .15, s.y - h + bob + r * .4, r * .42, 0, 7); ctx.fill();
    if (e.anim === 'attack') { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(s.x + (e.face || 1) * r * .9, s.y - h * .5, r * .9, -1.2, 1.2); ctx.stroke(); }
  }
  function body(ctx, e, s, z) {
    const D = R.draw; const o = { face: e.face, anim: e.anim, animT: e.animT, scale: z, e, team: e.team, ctx, dead: e.dead };
    if (D) {
      try {
        let r;
        if (e.kind === 'player' || e.kind === 'ghost') { if (D.hero) { o.house = e.house || (e === R.player && R.state ? R.state.p.house : null); o.cls = e.cls || (e === R.player && R.state ? R.state.p.cls : null); o.ghost = e.kind === 'ghost'; r = D.hero(s.x, s.y, o); if (r !== false) return; } }
        else if (e.kind === 'companion') { if (D.champ) { r = D.champ(e.type, s.x, s.y, o); if (r !== false) return; } }
        else if (e.kind === 'mob' || e.kind === 'boss') { if (D.sprite) { r = D.sprite(e.type, s.x, s.y, o); if (r !== false) return; } }
        else if (e.kind === 'npc') {
          if (e.champ && D.champ) { r = D.champ(e.champ, s.x, s.y, o); if (r !== false) return; }
          if ((e.sprite || e.type) && D.sprite) { r = D.sprite(e.sprite || e.type, s.x, s.y, o); if (r !== false) return; }
          if (D.hero) { o.npc = true; o.house = e.house; r = D.hero(s.x, s.y, o); if (r !== false) return; }
        }
      } catch (x) { if (!warned[e.kind]) { warned[e.kind] = 1; console.warn('render: R.draw failed for', e.kind, e.type, x); } }
    }
    fallbackBody(ctx, e, s, z);
  }
  function bar(ctx, x, y, w, h, frac, col) {
    const D = R.draw; if (D && D.bar) { try { D.bar(ctx, x, y, w, h, frac, col); return; } catch (e) {} }
    ctx.fillStyle = 'rgba(6,11,20,.8)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function drawDrop(ctx, e, s, z) {
    const it = e.item || e, col = RAR[Math.max(0, Math.min(4, it.rar | 0))] || RAR[0], t = R.t + (e.id || 0) * .7, bob = Math.sin(t * 3) * 2 * z, r = (8 + Math.sin(t * 4) * 1.5) * z;
    const cy = s.y - 6 * z + bob, g = ctx.createRadialGradient(s.x, cy, 0, s.x, cy, r * 2.2); g.addColorStop(0, hexA(col, .5)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(s.x - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 1, 6 * z, 2.4 * z, 0, 0, 7); ctx.fill();
    if (e.icon && typeof e.icon === 'string' && e.icon.length <= 3) { ctx.font = Math.round(14 * z) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(e.icon, s.x, s.y - 7 * z + bob); return; }
    ctx.save(); ctx.translate(s.x, s.y - 7 * z + bob); ctx.rotate(Math.PI / 4); ctx.fillStyle = col; ctx.fillRect(-4.5 * z, -4.5 * z, 9 * z, 9 * z);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-4.5 * z, -4.5 * z, 4 * z, 4 * z); ctx.restore();
  }
  function drawPortal(ctx, e, s, z) {
    const r = (e.r || 26) * z, t = R.t;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); g.addColorStop(0, 'rgba(140,220,255,.55)'); g.addColorStop(.7, 'rgba(120,80,220,.25)'); g.addColorStop(1, 'rgba(120,80,220,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .55, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2 * z;
    for (let i = 0; i < 3; i++) { const rr = r * (.45 + i * .25), a0 = t * (1.6 - i * .4) * (i % 2 ? -1 : 1) + i; ctx.strokeStyle = i % 2 ? 'rgba(181,123,255,.85)' : 'rgba(127,224,255,.9)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, rr, rr * .55, 0, a0, a0 + 2.4); ctx.stroke(); }
  }
  // hp bar, name tag and status icons over an entity's head (shared with the 3D path, which draws them on the overlay)
  function drawOverhead(ctx, e, s, z, hOver) {
    const top = s.y - ((hOver || e.h || (e.r || 14) * 2.6) + 8) * z; let y = top;
    const hurt = e.hp < e.hpMax && (e.kind === 'mob' || e.kind === 'boss' || e.kind === 'companion');
    if (hurt) { const w = (e.kind === 'boss' ? 56 : 34) * z, h = (e.kind === 'boss' ? 5 : 3.5) * z; y -= h;
      bar(ctx, s.x - w / 2, y, w, h, e.hp / e.hpMax, e.kind === 'companion' ? '#7fd06a' : e.kind === 'boss' ? '#e3b661' : (e.hostileCol || '#e14b4b')); y -= 3 * z; }
    /* a field mob shows its temper: yellow = passive (fights only when hit), red = aggressive (comes inside its radius) */
    if (e.kind === 'mob' && e.hostileCol && e.name && R.player && Math.hypot(e.x - R.player.x, e.y - R.player.y) < 650) {
      const fs = Math.max(9, Math.round(10 * z)); y -= fs + 1; label(ctx, e.name + ' ' + (e.lvl || 1), s.x, y, fs, e.hostileCol); }
    // NPC names come from A20's npcBubbles system when it runs (it draws the name with the speech bubble)
    const tag = (e.kind === 'npc' && !(R.sys.npcBubbles && R.render3d)) || e.kind === 'boss' || e.kind === 'ghost' || (e.kind === 'player' && e !== R.player);
    if (tag && e.name) { const fs = Math.max(10, Math.round(11 * z)); y -= fs + 1; label(ctx, e.name, s.x, y, fs, e.kind === 'boss' ? '#e3b661' : e.kind === 'ghost' ? '#9fb6c9' : e.kind === 'npc' ? '#f3e7c4' : '#8fc0ff'); }
    const st = e.status; if (st && (stOn(st.stun) || stOn(st.burn) || stOn(st.slow))) {
      let icons = ''; if (stOn(st.stun)) icons += '★'; if (stOn(st.burn)) icons += '🔥'; if (stOn(st.slow)) icons += '❄';
      const fs = Math.round(12 * z); y -= fs + 1; ctx.font = fs + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffd36a'; ctx.fillText(icons, s.x, y); }
  }
  Rd.drawOverhead = drawOverhead; Rd.drawDrop = drawDrop; Rd.drawPortal = drawPortal; Rd.fallbackBody = fallbackBody;
  function drawEnts(ctx) {
    const z = R.cam.z, v = Rd.visible(CULL / z), list = [];
    for (const e of R.ents) if (e.kind === 'player' || (e.x >= v.x0 && e.x <= v.x1 && e.y >= v.y0 && e.y <= v.y1)) list.push(e);
    let sorted = list; const D = R.draw;
    if (D && D.zsort) { try { const r = D.zsort(list); if (Array.isArray(r)) sorted = r; } catch (e) { list.sort((a, b) => a.y - b.y); } }
    else list.sort((a, b) => a.y - b.y);
    Rd.stats.ents = sorted.length;
    for (const e of sorted) {
      const s = R.w2s(e.x, e.y); let a = 1;
      if (e.dead) { a = Math.max(0, 1 - (e.animT || 0) / 1.4); if (a <= 0) continue; }
      if (e.kind === 'ghost') a *= .6; if (e.alpha != null) a *= e.alpha;
      ctx.globalAlpha = a;
      if (e.kind === 'drop') { drawDrop(ctx, e, s, z); continue; }
      if (e.kind === 'portal') { drawPortal(ctx, e, s, z); continue; }
      if (e.kind === 'player') light(ctx, s, z);
      shadow(ctx, s, (e.r || 14) * z);
      body(ctx, e, s, z);
      if (!e.dead) drawOverhead(ctx, e, s, z);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- camera ---------- */
  let snap = true, lastPlayer = null; const look = { x: 0, y: 0 };
  Rd.snapCam = () => { snap = true; };
  function clampCam() { const C = R.cam, hw = R.vw / 2 / C.z, hh = R.vh / 2 / C.z;
    C.x = R.W > hw * 2 ? R.clamp(C.x, hw, R.W - hw) : R.W / 2; C.y = R.H > hh * 2 ? R.clamp(C.y, hh, R.H - hh) : R.H / 2; }
  function camera() {
    const C = R.cam, p = R.player;
    if (C.zAuto !== false) C.z = R.vw > 700 ? 1.25 : 1;
    if (!p) { clampCam(); return; }
    if (p !== lastPlayer) { lastPlayer = p; snap = true; }
    let dx = 0, dy = 0; const mv = R.input && R.input.move;
    if (mv && (mv.x || mv.y)) { dx = mv.x; dy = mv.y; } else if (p.vx || p.vy) { dx = p.vx; dy = p.vy; }
    const l = Math.hypot(dx, dy); if (l > .01) { dx /= l; dy /= l; } else dx = dy = 0;
    look.x = R.lerp(look.x, dx * LOOK, .08); look.y = R.lerp(look.y, dy * LOOK, .08);
    const tx = p.x + look.x, ty = p.y + look.y;
    if (snap || Math.hypot(tx - C.x, ty - C.y) > 1500) { C.x = tx; C.y = ty; snap = false; } else { C.x = R.lerp(C.x, tx, CAM_K); C.y = R.lerp(C.y, ty, CAM_K); }
    clampCam();
  }
  Rd.camera2d = camera; Rd.lookDir = () => look;

  /* ---------- the system ---------- */
  Rd.stats = { last: 0, ents: 0, hist: [], median() { const h = this.hist.slice().sort((a, b) => a - b); return h.length ? h[h.length >> 1] : 0; } };
  const hook = (sys, fn, ctx) => { const S = R.sys[sys]; if (S && typeof S[fn] === 'function') { try { S[fn](ctx); } catch (e) { if (!warned[sys + fn]) { warned[sys + fn] = 1; console.error('render hook', sys, fn, e); } } } };
  Rd.hook = hook; Rd.fogCheck = fogCheck; Rd.blitWorld = blitWorld;
  Rd.mode = '2d';
  // the 2D frame: used when WebGL is unavailable (the 3D path below replaces R.sys.render.draw / update)
  Rd.draw2d = function (ctx) {
    const t0 = performance.now();
    if (R.cam.z <= 0 || !isFinite(R.cam.z)) R.cam.z = 1;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#060b14'; ctx.fillRect(0, 0, R.vw, R.vh);
    const v = Rd.visible(0);
    drawMap(ctx); drawGrain(ctx);
    if (R.data.world) {
      drawRoads(ctx, v); drawPois(ctx, v);
      if (!fog && R.data.world.regions) Rd.redrawFog();
      if (fog && !fogEmpty) blitWorld(ctx, fog, FOG_A);
      drawGate(ctx, v);
    }
    hook('boss', 'drawTelegraphs', ctx);
    drawEnts(ctx);
    hook('vfx', 'drawWorld', ctx);
    drawVignette(ctx);
    hook('ambience', 'drawTint', ctx);
    const ms = performance.now() - t0; Rd.stats.last = ms; const h = Rd.stats.hist; h.push(ms); if (h.length > 120) h.shift();
  };
  Rd.update2d = function () { camera(); if (R.state !== lastState) { lastState = R.state; fogCheck(); } };
  R.addSys('render', { order: 900, update() { Rd.update2d(); }, draw(ctx) { Rd.draw2d(ctx); } });
})();

/* ===================== 3D world (three.js, vendor/three.min.js) =====================
   The WebGL canvas #gl sits under #c; #c stays a transparent overlay (hp bars, names, telegraphs, vfx, vignette, tint).
   World (x, y) on the ground plane → three (x, groundY(x,y), y). North = -z. Camera: third person behind the hero,
   R.cam.yaw (0 = facing north; A02's R.input.look.dx rotates it, consumed here), pitch 35°, R.cam.dist 420 (300–700;
   R.input.look.pinch is consumed as a scale factor). R.w2s(x, y, z=0) → screen px (+ behind flag), R.s2w(sx, sy) → ground
   point, R.cam.z = px per world unit at the hero's depth, R.cam.x/y = the camera target.
   R.render3d = {scene, camera, renderer, setSun(elevDeg, col, azDeg?), setFog(col, near, far), setTint(col), groundY(x,y),
   biomeAt(x,y), heightmap {canvas, w, h, scale, max}, terrain, stats, rebuildTerrain()}; emits 'render3d' when the scene is
   ready. Entities: billboards from e.frame(anim, t, face) || R.draw.frame(key, anim, t, face) (cached canvases → textures),
   e.z lifts the sprite, e.tumble.ang rotates it, e.flash (seconds) flashes it white; drops / portals / traps are small emissive
   billboards. POIs: R.props.build(poi) (A37) or simple low-poly props. Falls back to the 2D renderer without WebGL. */
(function () {
  const Rd = R.render, T = window.THREE;
  function glOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  if (!T) { Rd.why = 'no THREE'; return; }
  if (!glOK()) { Rd.why = 'no WebGL'; return; }
  // the grid: ~90 world units per vertex on the 4.5x map (360 x 600 cells, 30 x 30-cell tiles, frustum-culled); heights x HS so ranges read as mountains at hero scale
  const WS = R.WS || 1, HS = WS > 1 ? 2.5 : 1, DEG = Math.PI / 180, SEG_X = WS > 1 ? 360 : 180, SEG_Y = WS > 1 ? 600 : 300, NX = SEG_X + 1, NY = SEG_Y + 1, H_MAX = 260 * HS, CULL_D = 1600, PROP_D = 2600 * Math.min(WS, 2), PROP_N = 8;
  const clamp = R.clamp, lerp = R.lerp;
  const pxy = Rd.pxy, pts = Rd.pts, rid = Rd.rid;

  /* ---------- canvas + renderer ---------- */
  // the core's #gl canvas (index.tpl.html / 00_core R.gl) when it exists: one #gl in the page, so document.querySelector('#gl') is the drawn one
  const ownGl = !(R.gl && R.gl.tagName === 'CANVAS'), gl = ownGl ? document.createElement('canvas') : R.gl; if (ownGl) { gl.id = 'gl'; R.cv.parentNode.insertBefore(gl, R.cv); }
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: gl, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { Rd.why = 'renderer: ' + e.message; if (ownGl) gl.remove(); return; }
  if (!renderer.getContext()) { Rd.why = 'no context'; if (ownGl) gl.remove(); return; }
  renderer.setClearColor(0x060b14, 1);
  // natural look: ACES filmic tone mapping, sRGB output (textures in sRGB are decoded to linear), a touch over-exposed to keep the art's light
  try { renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18; renderer.outputColorSpace = T.SRGBColorSpace; } catch (e) {}
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 20, 9000);
  const hemi = new T.HemisphereLight(0xbfd4ea, 0x5a4a3a, 1.0); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1d6, 1.2); scene.add(sun);
  scene.fog = new T.Fog(0x9fb0c4, 500, 1500);
  let glName = ''; try { const g = renderer.getContext(), dbg = g.getExtension('WEBGL_debug_renderer_info'); glName = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)); } catch (e) {}
  const R3 = R.render3d = { scene, camera, renderer, glName, software: /swiftshader|llvmpipe|software|mesa offscreen/i.test(glName), stats: { calls: 0, sprites: 0, props: 0 } };
  Rd.mode = '3d'; Rd.gl = gl;
  // the vignette is a static CSS layer between #gl and #c (no full-screen drawImage on the overlay every frame)
  let vigEl = null; try { vigEl = document.createElement('div'); vigEl.id = 'glvig'; R.cv.parentNode.insertBefore(vigEl, R.cv); } catch (e) { vigEl = null; }

  /* ---------- heights ---------- */
  let hts = new Float32Array(NX * NY), seaMask = new Uint8Array(NX * NY), wetMask = new Uint8Array(NX * NY), terrainHasArt = false, seaFromWater = false;
  const waterReady = () => { const W = R.water; return !!(W && typeof W.kindAt === 'function' && (W.ready === undefined || W.ready)); };
  const RIDGES = [ // world units: the Frostfangs, the mountains west of the North, the Mountains of the Moon (the Vale), the Westerlands hills, the Red Mountains
    { x: 3180, y: 1620, rx: 760, ry: 950, h: 240 }, { x: 2280, y: 3720, rx: 320, ry: 640, h: 150 }, { x: 4980, y: 6000, rx: 440, ry: 680, h: 200 },
    { x: 2640, y: 7080, rx: 320, ry: 520, h: 90 }, { x: 3840, y: 10200, rx: 1150, ry: 280, h: 160 }];
  function ridgeH(x, y) { x /= WS; y /= WS; let h = 0; for (const r of RIDGES) { const d = ((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2; if (d < 1) { const f = 1 - d; h = Math.max(h, HS * r.h * f * f * (.7 + .3 * Math.sin(x * .011) * Math.sin(y * .013))); } } return h; }
  const drawable = im => { if (!im) return null; im = im.img || im.image || im.canvas || im; const w = im.naturalWidth || im.width; if (!w || im.complete === false) return null; return im; };
  function buildHeights(img) {
    let px = null;
    if (img) { try { const c = document.createElement('canvas'); c.width = NX; c.height = NY; const g = c.getContext('2d'); g.drawImage(img, 0, 0, NX, NY); px = g.getImageData(0, 0, NX, NY).data; } catch (e) { px = null; } }
    const blk = !px && R.world && R.world.blocked, WA = waterReady() ? R.water : null; seaFromWater = !!WA;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = i / SEG_X * R.W, y = j / SEG_Y * R.H; let h, sea = false;
      if (px) { const r = px[k * 4], g = px[k * 4 + 1], b = px[k * 4 + 2], lum = (r * .3 + g * .59 + b * .11) / 255;
        // the art's sea is dark and olive (about 56-70, 55-61, 25-31): dark, blue well under red and green
        sea = WA ? false : lum < .3 && b < r - 15 && b < g - 15 && Math.abs(r - g) < 22;
        if (!sea) h = 20 + 40 * HS * clamp((.7 - lum) * 2.2, 0, 1); }
      else { sea = blk ? !!R.world.blocked(x, y) : (x < 300 * WS || x > R.W - 300 * WS || y < 200 * WS || y > R.H - 200 * WS); h = 30 + 10 * Math.sin(x / WS * .0021) * Math.cos(y / WS * .0017); }
      wetMask[k] = 0;
      if (WA) { let kd = null, dp = 0; try { kd = WA.kindAt(x, y); dp = typeof WA.depth === 'function' ? +WA.depth(x, y) || 0 : (kd ? 1 : 0); } catch (e) {} sea = kd === 'sea';
        if (!sea && kd && dp > 0) wetMask[k] = kd === 'lake' ? 2 : 1; if (sea) h = 0; else if (h == null) h = 30; }
      if (sea) h = 0; else h += ridgeH(x, y) + 5 * Math.sin(x / WS * .004) * Math.cos(y / WS * .003);
      hts[k] = h; seaMask[k] = sea ? 1 : 0;
    }
    smoothHeights(); bumps();
    // lakes and rivers: below the banks (a lake 22 u, a river 14 u, scaled by A44's depth), never under the sea floor
    if (WA) for (let k = 0; k < NX * NY; k++) { const w = wetMask[k]; if (!w) continue; const x = (k % NX) / SEG_X * R.W, y = Math.floor(k / NX) / SEG_Y * R.H; let dp = 1; try { dp = clamp(+WA.depth(x, y) || 1, .3, 1); } catch (e) {} hts[k] = Math.max(1, hts[k] - (w === 2 ? 22 : 14) * dp); }
    // the height canvas (grey = height / H_MAX) for the water / nature agents
    const hc = R3.heightmap && R3.heightmap.canvas || document.createElement('canvas'); hc.width = NX; hc.height = NY;
    const hg = hc.getContext('2d'), id = hg.createImageData(NX, NY), d = id.data;
    for (let k = 0; k < NX * NY; k++) { const v = Math.round(clamp(hts[k] / H_MAX, 0, 1) * 255); d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = seaMask[k] ? 0 : 255; }
    hg.putImageData(id, 0, 0);
    R3.heightmap = { canvas: hc, w: NX, h: NY, scale: R.W / SEG_X, max: H_MAX, data: hts, sea: seaMask, wet: wetMask };
  }
  function smoothHeights() {
    for (let pass = 0; pass < 3; pass++) { const o = hts.slice();
      for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) { const k = j * NX + i; if (seaMask[k]) continue;
        const a = (o[k] * 4 + o[k - 1] + o[k + 1] + o[k - NX] + o[k + NX] + (o[k - NX - 1] + o[k - NX + 1] + o[k + NX - 1] + o[k + NX + 1]) * .5) / 10; hts[k] = Math.max(4, a); } }
  }
  // value-noise fBm: 1100 u hills (+-26) and 380 u bumps (+-9), less on water banks and on low ground by the sea
  const hh = (i, j) => { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise(x, y) { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hh(i, j), b = hh(i + 1, j), c = hh(i, j + 1), d = hh(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return (a + (b - a) * su) + ((c + (d - c) * su) - (a + (b - a) * su)) * sv; }
  R3.fbm = (x, y) => (vnoise(x / 1100, y / 1100) - .5) * 52 + (vnoise(x / 380 + 17, y / 380 + 31) - .5) * 18;
  function bumps() { if (WS <= 1) return; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; if (seaMask[k] || wetMask[k]) continue; const x = i / SEG_X * R.W, y = j / SEG_Y * R.H, f = clamp((hts[k] - 8) / 30, 0, 1);
      hts[k] = Math.max(4, hts[k] + R3.fbm(x, y) * f); } }
  function groundY(x, y) {
    const fx = clamp(x / R.W * SEG_X, 0, SEG_X - 1e-6), fy = clamp(y / R.H * SEG_Y, 0, SEG_Y - 1e-6);
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * NX + i;
    return (hts[k] * (1 - u) + hts[k + 1] * u) * (1 - v) + (hts[k + NX] * (1 - u) + hts[k + NX + 1] * u) * v;
  }
  R3.groundY = groundY; R3.seaAt = (x, y) => { if (waterReady()) { try { return R.water.kindAt(x, y) === 'sea'; } catch (e) {} } return seaMaskAt(x, y); };
  const seaMaskAt = (x, y) => !!seaMask[clamp(Math.round(y / R.H * SEG_Y), 0, SEG_Y) * NX + clamp(Math.round(x / R.W * SEG_X), 0, SEG_X)];
  R3.biomeAt = (x, y) => { try { if (R.world && R.world.regionAt) { const r = R.world.regionAt(x, y); if (r && r.biome) return r.biome; if (typeof r === 'string') { const rg = (R.data.world.regions || []).find(q => rid(q) === r); if (rg && rg.biome) return rg.biome; } } } catch (e) {} return 'reach'; };

  /* ---------- the terrain texture: map art + roads + biome tints + shoreline + snow + grain ---------- */
  const BIOME_TINT = { snow: [235, 240, 248, .45], tundra: [225, 232, 240, .3], north: [205, 215, 212, .18], forest: [110, 140, 90, .22], riverlands: [120, 160, 95, .18],
    reach: [120, 170, 85, .22], grass: [120, 170, 85, .2], vale: [150, 165, 150, .18], westerlands: [170, 150, 100, .16], crownlands: [150, 160, 110, .14],
    stormlands: [95, 125, 90, .22], desert: [224, 190, 120, .4], dorne: [224, 190, 120, .4], sand: [224, 190, 120, .4], iron: [60, 62, 70, .4], isles: [60, 62, 70, .4],
    rock: [90, 88, 86, .3], beyond: [230, 236, 244, .4], wall: [230, 236, 244, .4], coast: [150, 165, 150, .1] };
  function texCanvas(img) {
    const TW = 1024, TH = 2048, c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d'); const kx = TW / R.W, ky = TH / R.H;
    if (img) { g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, TW, TH); }
    else { const gr = g.createLinearGradient(0, 0, 0, TH); gr.addColorStop(0, '#e2e8ec'); gr.addColorStop(.16, '#c4c9bf'); gr.addColorStop(.42, '#b5a378'); gr.addColorStop(.78, '#c2a46b'); gr.addColorStop(1, '#d4b474'); g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
      g.fillStyle = '#4e7a9a'; for (let k = 0; k < NX * NY; k++) if (seaMask[k]) g.fillRect((k % NX) / SEG_X * TW - 3, Math.floor(k / NX) / SEG_Y * TH - 3.5, 6.2, 7.3); }
    // biome tints: from the regions' polygons when the data module gives biomes, else by position
    const regs = R.data.world && R.data.world.regions; let tinted = false;
    if (regs) for (const rg of regs) { const P = pts(rg), t = rg.biome && BIOME_TINT[String(rg.biome).toLowerCase()]; if (!P || !t) continue; tinted = true;
      g.beginPath(); P.forEach((q, i) => i ? g.lineTo(q[0] * kx, q[1] * ky) : g.moveTo(q[0] * kx, q[1] * ky)); g.closePath(); g.fillStyle = 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',' + t[3] + ')'; g.fill(); }
    if (!tinted) { const ell = (x, y, rx, ry, t) => { const gr = g.createRadialGradient(x * kx, y * ky, 0, x * kx, y * ky, 1); g.save(); g.translate(x * kx, y * ky); g.scale(rx * kx, ry * ky); g.translate(-x * kx, -y * ky);
        gr.addColorStop(0, 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',' + t[3] + ')'); gr.addColorStop(1, 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',0)'); g.fillStyle = gr; g.fillRect(x * kx - 1, y * ky - 1, 2, 2); g.restore(); };
      ell(3840 * WS, 10800 * WS, 2600 * WS, 900 * WS, BIOME_TINT.desert); ell(1900 * WS, 6700 * WS, 700 * WS, 600 * WS, BIOME_TINT.iron); ell(2500 * WS, 8800 * WS, 1500 * WS, 1500 * WS, BIOME_TINT.reach); ell(4300 * WS, 8500 * WS, 1200 * WS, 1000 * WS, BIOME_TINT.stormlands); ell(3600 * WS, 4200 * WS, 2400 * WS, 1600 * WS, BIOME_TINT.north); }
    // soft shoreline: the land mask blurred by up-scaling, kept only over the sea
    const sm = document.createElement('canvas'); sm.width = NX; sm.height = NY; const sg = sm.getContext('2d'), sid = sg.createImageData(NX, NY);
    for (let k = 0; k < NX * NY; k++) { sid.data[k * 4] = 240; sid.data[k * 4 + 1] = 226; sid.data[k * 4 + 2] = 190; sid.data[k * 4 + 3] = seaMask[k] ? 0 : 255; } sg.putImageData(sid, 0, 0);
    const sh = document.createElement('canvas'); sh.width = TW; sh.height = TH; const shg = sh.getContext('2d'); shg.imageSmoothingEnabled = true; shg.drawImage(sm, 0, 0, TW, TH);
    for (let k = 0; k < NX * NY; k++) sid.data[k * 4 + 3] = seaMask[k] ? 255 : 0; sg.putImageData(sid, 0, 0); shg.globalCompositeOperation = 'destination-in'; shg.imageSmoothingEnabled = false; shg.drawImage(sm, 0, 0, TW, TH);
    g.globalAlpha = .5; g.drawImage(sh, 0, 0); g.globalAlpha = 1;
    // the road mask for the shader (alpha), stroked ~70 world units wide with a soft verge
    { const rc = roadCv || (roadCv = document.createElement('canvas')); rc.width = TW; rc.height = TH; const rg = rc.getContext('2d'); rg.clearRect(0, 0, TW, TH); const rs = R.data.world && R.data.world.roads;
      if (rs) { rg.lineCap = 'round'; rg.lineJoin = 'round'; const rp = () => { rg.beginPath(); for (const rd of rs) { const P = pts(rd); if (!P) continue; P.forEach((q, i) => i ? rg.lineTo(q[0] * kx, q[1] * ky) : rg.moveTo(q[0] * kx, q[1] * ky)); } };
        rp(); rg.lineWidth = 130 / R.W * TW + 1.5; rg.strokeStyle = 'rgba(0,0,0,.45)'; rg.stroke(); rp(); rg.lineWidth = 70 / R.W * TW + .8; rg.strokeStyle = '#000'; rg.stroke(); } }
    // roads as sand lines
    const roads = R.data.world && R.data.world.roads;
    if (roads) { g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      const path = () => { g.beginPath(); for (const rd of roads) { const P = pts(rd); if (!P) continue; P.forEach((q, i) => i ? g.lineTo(q[0] * kx, q[1] * ky) : g.moveTo(q[0] * kx, q[1] * ky)); } };
      path(); g.lineWidth = 5; g.strokeStyle = 'rgba(70,46,24,.35)'; g.stroke(); path(); g.lineWidth = 2.6; g.strokeStyle = 'rgba(236,210,156,.95)'; g.setLineDash([7, 5]); g.stroke(); g.restore(); }
    // snow: north of the Wall and on the peaks
    const sn = g.createLinearGradient(0, 0, 0, 2600 * WS * ky); sn.addColorStop(0, 'rgba(240,244,250,.62)'); sn.addColorStop(.7, 'rgba(240,244,250,.35)'); sn.addColorStop(1, 'rgba(240,244,250,0)'); g.fillStyle = sn; g.fillRect(0, 0, TW, 2600 * WS * ky);
    for (let k = 0; k < NX * NY; k++) { sid.data[k * 4] = 242; sid.data[k * 4 + 1] = 246; sid.data[k * 4 + 2] = 252; sid.data[k * 4 + 3] = Math.round(clamp((hts[k] - 140 * HS) / (70 * HS), 0, 1) * 220); } sg.putImageData(sid, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, TW, TH);
    // detail grain
    const nc = document.createElement('canvas'); nc.width = nc.height = 128; const ng = nc.getContext('2d'), nid = ng.createImageData(128, 128); let s = 11;
    for (let i = 0; i < nid.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; nid.data[i] = nid.data[i + 1] = nid.data[i + 2] = s >>> 24; nid.data[i + 3] = 255; } ng.putImageData(nid, 0, 0);
    g.globalAlpha = .09; g.fillStyle = g.createPattern(nc, 'repeat'); g.fillRect(0, 0, TW, TH); g.globalAlpha = 1;
    return c;
  }

  /* ---------- the terrain mesh ---------- */
  let terrain = null, mapTex = null, fogTex = null, fogCv = null, roadCv = null, roadTex = null;
  const VS = 'varying vec2 vUv; varying vec3 vN; varying vec3 vW;\nvoid main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const FS = 'uniform sampler2D map; uniform sampler2D fogMap; uniform float fogA; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 skyCol; uniform vec3 gndCol; uniform vec3 tint; uniform vec3 fogCol; uniform float fogNear; uniform float fogFar;\n' +
    'uniform sampler2D dGrass; uniform sampler2D dSand; uniform sampler2D dSnow; uniform sampler2D dRock; uniform vec4 dAvg; uniform float uDet; uniform float uDetCol; uniform float uDetK; uniform float uGrade; uniform float uHS; uniform float uWS; uniform sampler2D roadMap; uniform sampler2D dRoad;\n' +
    'varying vec2 vUv; varying vec3 vN; varying vec3 vW;\n' +
    'float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }\n' +
    // the map painting only as a blurred tint (mip bias: no lettering, no stage shields); near the camera a tiled splat of R.tex grounds,
    // chosen by that tint (snow / sand / grass), the slope and the height (rock), with a macro brightness pass against visible tiling
    'void main(){ vec3 lo = texture2D(map, vUv, 5.0).rgb; vec3 c = texture2D(map, vUv, 2.5).rgb; float f = texture2D(fogMap, vUv).a; vec3 n = normalize(vN); float d = distance(vW, cameraPosition);\n' +
    ' float near = uDet * (1.0 - smoothstep(520.0, 1200.0, d));\n' +
    ' if (near > 0.001) { vec2 uv = vW.xz * uDetK; vec3 g = texture2D(dGrass, uv).rgb, sa = texture2D(dSand, uv * 1.3).rgb, sn = texture2D(dSnow, uv * 0.8).rgb, rk = texture2D(dRock, uv * 0.7).rgb, g2 = texture2D(dGrass, uv * 0.11 + 0.37).rgb;\n' +
    '  float L = lum(lo), sat = max(lo.r, max(lo.g, lo.b)) - min(lo.r, min(lo.g, lo.b));\n' +
    '  float wSnow = clamp(smoothstep(0.5, 0.7, L) * (1.0 - smoothstep(0.08, 0.2, sat)) + smoothstep(150.0 * uHS, 190.0 * uHS, vW.y) + (1.0 - smoothstep(1800.0 * uWS, 2700.0 * uWS, vW.z)) * 0.8, 0.0, 1.0);\n' +
    '  float wSand = clamp(smoothstep(0.05, 0.14, lo.r - lo.b) * smoothstep(0.3, 0.46, L) * smoothstep(0.0, 0.08, lo.r - lo.g + 0.04), 0.0, 1.0) * (1.0 - wSnow);\n' +
    '  float wRock = clamp(smoothstep(0.22, 0.45, 1.0 - n.y) + smoothstep(110.0 * uHS, 160.0 * uHS, vW.y) * 0.7, 0.0, 1.0) * (1.0 - wSnow * 0.7);\n' +
    '  float wGrass = max(0.0, 1.0 - wSnow - wSand - wRock);\n' +
    '  float ws = wGrass + wSand + wSnow + wRock + 1e-4; vec3 det = (g * wGrass + sa * wSand + sn * wSnow + rk * wRock) / ws; float avg = dot(dAvg, vec4(wGrass, wSand, wSnow, wRock)) / ws;\n' +
    '  vec3 hueT = lo / max(L, 0.04); float macro = clamp(lum(g2) / max(dAvg.x, 0.04), 0.8, 1.2);\n' +
    '  vec3 splat = det * mix(vec3(1.0), hueT, mix(1.0, 0.3, uDetCol)) * macro * clamp(L / max(avg, 0.04), 0.6, 1.4);\n' +
    '  float rd = texture2D(roadMap, vUv).a; if (rd > 0.02) { vec3 rdc = texture2D(dRoad, uv * 1.4).rgb * mix(vec3(1.0), vec3(0.62, 0.5, 0.36) / 0.5, 1.0 - uDetCol); splat = mix(splat, rdc * clamp(L / max(avg, 0.04), 0.8, 1.25), smoothstep(0.25, 0.75, rd)); }\n' +
    '  c = mix(c, splat, near); }\n' +
    ' else { float rf = texture2D(roadMap, vUv).a; c = mix(c, vec3(0.55, 0.45, 0.33), rf * 0.55); }\n' +
    ' float dl = max(dot(n, sunDir), 0.0); vec3 hemi = mix(gndCol, skyCol, n.y * 0.5 + 0.5); vec3 col = c * (hemi + sunCol * dl) * tint; col *= 1.0 - fogA * f * 0.7 * smoothstep(900.0, 2600.0, d);\n' +
    ' float L2 = lum(col); col = mix(vec3(L2), col, 1.0 + 0.08 * uGrade); col *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), uGrade);\n' +
    ' float ff = smoothstep(fogNear, fogFar, d); col = mix(col, fogCol, ff); gl_FragColor = vec4(col, 1.0);\n' +
    ' #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}';
  // the detail textures (A-G10's R.tex when it is there; a grey value-noise canvas until then)
  const noiseTex = (() => { const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), id = g.createImageData(N, N); let sd = 9;
    const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }; const v = new Float32Array(N * N); for (let i = 0; i < v.length; i++) v[i] = rnd();
    for (let pass = 0; pass < 2; pass++) { const o = v.slice(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let a = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += o[((y + dy + N) % N) * N + (x + dx + N) % N]; v[y * N + x] = a / 9; } }
    for (let i = 0; i < v.length; i++) { const q = Math.round(clamp(128 + (v[i] - .5) * 300 + (rnd() - .5) * 40, 0, 255)); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = q; id.data[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; })();
  const U = { map: { value: null }, fogMap: { value: null }, fogA: { value: 0.55 }, sunDir: { value: new T.Vector3(.4, .8, .45).normalize() }, sunCol: { value: new T.Color(0.55, 0.52, 0.46) },
    skyCol: { value: new T.Color(0.62, 0.64, 0.68) }, gndCol: { value: new T.Color(0.34, 0.3, 0.26) }, tint: { value: new T.Color(1, 1, 1) }, fogCol: { value: new T.Color(0x9fb0c4) }, fogNear: { value: 500 }, fogFar: { value: 1500 },
    dGrass: { value: noiseTex }, dSand: { value: noiseTex }, dSnow: { value: noiseTex }, dRock: { value: noiseTex }, dAvg: { value: new T.Vector4(.21, .21, .21, .21) }, uDet: { value: 1 }, uDetCol: { value: 0 }, uDetK: { value: 1 / 90 }, uGrade: { value: 1 }, uHS: { value: HS }, uWS: { value: WS }, roadMap: { value: null }, dRoad: { value: noiseTex } };
  const terrainMat = new T.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, side: T.DoubleSide });
  // the terrain is one height grid cut into 30×30-cell tiles (6 × 10 meshes, one material): three frustum-culls the tiles,
  // and the camera's far plane follows the fog, so a frame draws ~10 % of the 108k triangles
  const TS = 30, DX = R.W / SEG_X, DZ = R.H / SEG_Y;
  function buildTerrain() {
    const img = drawable(R.assets && R.assets.map); terrainHasArt = !!img;
    buildHeights(img);
    const nrm = new Float32Array(NX * NY * 3); // normals on the whole grid first, so tile seams stay smooth
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i, hL = hts[j * NX + Math.max(0, i - 1)], hR = hts[j * NX + Math.min(SEG_X, i + 1)], hD = hts[Math.max(0, j - 1) * NX + i], hU = hts[Math.min(SEG_Y, j + 1) * NX + i];
      let nx = (hL - hR) / (2 * DX), ny = 1, nz = (hD - hU) / (2 * DZ); const l = Math.hypot(nx, ny, nz); nrm[k * 3] = nx / l; nrm[k * 3 + 1] = ny / l; nrm[k * 3 + 2] = nz / l; }
    if (terrain) { scene.remove(terrain); terrain.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    terrain = new T.Group(); terrain.name = 'terrain'; const tiles = [];
    for (let ty = 0; ty < SEG_Y; ty += TS) for (let tx = 0; tx < SEG_X; tx += TS) {
      const i1 = Math.min(SEG_X, tx + TS), j1 = Math.min(SEG_Y, ty + TS), w = i1 - tx + 1, h = j1 - ty + 1;
      const pos = new Float32Array(w * h * 3), uv = new Float32Array(w * h * 2), no = new Float32Array(w * h * 3), idx = new Uint16Array((w - 1) * (h - 1) * 6);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (ty + j) * NX + tx + i, q = j * w + i; pos[q * 3] = (tx + i) * DX; pos[q * 3 + 1] = hts[k]; pos[q * 3 + 2] = (ty + j) * DZ;
        uv[q * 2] = (tx + i) / SEG_X; uv[q * 2 + 1] = 1 - (ty + j) / SEG_Y; no[q * 3] = nrm[k * 3]; no[q * 3 + 1] = nrm[k * 3 + 1]; no[q * 3 + 2] = nrm[k * 3 + 2]; }
      let n = 0; for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d; }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(no, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
      const m = new T.Mesh(geo, terrainMat); m.name = 'tile'; terrain.add(m); tiles.push(m);
    }
    if (mapTex) mapTex.dispose(); mapTex = new T.CanvasTexture(texCanvas(img));
    if (roadTex) roadTex.dispose(); if (roadCv) { roadTex = new T.CanvasTexture(roadCv); roadTex.wrapS = roadTex.wrapT = T.ClampToEdgeWrapping; U.roadMap.value = roadTex; } mapTex.colorSpace = T.SRGBColorSpace; mapTex.anisotropy = R3.software ? 1 : Math.min(2, renderer.capabilities.getMaxAnisotropy()); mapTex.wrapS = mapTex.wrapT = T.ClampToEdgeWrapping; U.map.value = mapTex;
    if (!fogTex) { fogCv = document.createElement('canvas'); fogCv.width = 512; fogCv.height = 1024; fogTex = new T.CanvasTexture(fogCv); fogTex.minFilter = T.LinearFilter; fogTex.generateMipmaps = false; U.fogMap.value = fogTex; }
    scene.add(terrain); R3.terrain = terrain; R3.terrainTiles = tiles; attachDetail();
    for (const p of props.values()) placeProp(p);
  }
  R3.rebuildTerrain = buildTerrain;
  let detailOn = false;
  function texAvg(X, name) { try { if (typeof X.avg === 'function') { const h = X.avg(name); if (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h)) { const c = new T.Color(h); return c.r * .299 + c.g * .587 + c.b * .114; } }
    const c = typeof X.canvas === 'function' && X.canvas(name); if (!c || !c.width) return .45; const k = document.createElement('canvas'); k.width = k.height = 8; const g = k.getContext('2d'); g.drawImage(c, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data; let a = 0; for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255; a += Math.pow(l, 2.2); } return a / 64; } catch (e) { return .45; } }
  function attachDetail() {
    if (detailOn) return true; const X = R.tex; if (!X || typeof X.get !== 'function') return false;
    const get = (n, alt) => { try { return X.get(n) || (alt && X.get(alt)) || null; } catch (e) { return null; } };
    const g = get('grass'), sa = get('sand'), sn = get('snow'), rk = get('rock'); if (!g || !sa || !sn || !rk) return false;
    for (const t of [g, sa, sn, rk]) if (t.wrapS !== T.RepeatWrapping) { t.wrapS = t.wrapT = T.RepeatWrapping; t.needsUpdate = true; }
    const rdT = get('dirt_road', 'mud'); if (rdT) { if (rdT.wrapS !== T.RepeatWrapping) { rdT.wrapS = rdT.wrapT = T.RepeatWrapping; rdT.needsUpdate = true; } U.dRoad.value = rdT; }
    U.dGrass.value = g; U.dSand.value = sa; U.dSnow.value = sn; U.dRock.value = rk; U.dAvg.value.set(texAvg(X, 'grass'), texAvg(X, 'sand'), texAvg(X, 'snow'), texAvg(X, 'rock')); U.uDetCol.value = 1;
    detailOn = true; R3.detail = true; return true; }
  R3.attachDetail = attachDetail;
  R.bus.on('tick1s', () => { if (!detailOn) attachDetail(); });
  function refreshFog() { if (!fogCv) return; const g = fogCv.getContext('2d'); g.clearRect(0, 0, 512, 1024); if (Rd.fogCanvas && !Rd.fogEmpty()) { g.imageSmoothingEnabled = true; g.drawImage(Rd.fogCanvas, 0, 0, 512, 1024); } fogTex.needsUpdate = true; }
  R.bus.on('fog', refreshFog);
  R.bus.on('tick1s', () => { if ((!terrainHasArt && drawable(R.assets && R.assets.map)) || (terrain && !seaFromWater && waterReady())) buildTerrain(); });

  /* ---------- sun / fog / tint ---------- */
  R3.setSun = (elev, col, az) => { elev = clamp(elev == null ? 55 : elev, -10, 90); az = az == null ? 215 : az; const e = elev * DEG, a = az * DEG, d = new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize();
    sun.position.copy(d).multiplyScalar(1000); sun.target.position.set(0, 0, 0); sun.intensity = 1.2 * clamp(Math.sin(Math.max(0, e)) + .12, 0, 1); if (col != null) sun.color.set(col);
    U.sunDir.value.copy(d); U.sunCol.value.copy(sun.color).multiplyScalar(0.55 * clamp(Math.sin(Math.max(0, e)) + .12, 0, 1));
    const k = clamp((elev + 6) / 30, 0, 1); _sc.copy(sun.color).lerp(new T.Color(1, 1, 1), .55); spriteLight.copy(_nightC).lerp(_sc, k); spriteLight.multiplyScalar(.78 + .22 * k); tintVer++; };
  R3.setFog = (col, near, far) => { if (col != null) { scene.fog.color.set(col); U.fogCol.value.copy(scene.fog.color); renderer.setClearColor(scene.fog.color, 1); } if (near != null) { scene.fog.near = near; U.fogNear.value = near; }
    if (far != null) { scene.fog.far = far; U.fogFar.value = far; camera.far = Math.max(800, far * 1.06); camera.updateProjectionMatrix(); } }; // the far plane follows the fog: beyond it the sky is the fog colour anyway
  let tintVer = 1; const tint = new T.Color(1, 1, 1), spriteLight = new T.Color(1, 1, 1), _nightC = new T.Color(.5, .56, .78), _sc = new T.Color();
  R3.setTint = col => { tint.set(col); U.tint.value.copy(tint); tintVer++; };
  R3.setSky = (sky, gnd) => { if (sky != null) { hemi.color.set(sky); U.skyCol.value.copy(hemi.color).multiplyScalar(.62); } if (gnd != null) { hemi.groundColor.set(gnd); U.gndCol.value.copy(hemi.groundColor).multiplyScalar(.5); } };
  R3.setSun(55); R3.setFog(0x9fb0c4, 500, 1500);

  /* ---------- billboards ---------- */
  // texture px per world unit: the hero (64 u) gets a ~150 px tall frame, near the size it shows at on a phone (dpr ≤ 1.5)
  const PXU = 2.3, TEX_MAX = 200;
  const texCache = new Map(), fbCache = {}, sprites = new Map();
  // one texture per frame canvas, LRU-capped: an evicted texture is disposed (GPU memory), and re-uploaded if that canvas comes back
  function texFor(cv) { let t = texCache.get(cv); if (t) { texCache.delete(cv); texCache.set(cv, t); }
    else { t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false; texCache.set(cv, t);
      while (texCache.size > TEX_MAX) { const k0 = texCache.keys().next().value, t0 = texCache.get(k0); texCache.delete(k0); t0.dispose(); } }
    if (cv.dirty) { cv.dirty = false; t.needsUpdate = true; } return t; }
  R3.texCount = () => texCache.size;
  const D_ = () => R.draw || {};
  const strip = k => typeof k === 'string' ? k.replace(/^(champ|mob):/, '') : k;
  function champId(e) { const t = e.type || e.sprite;
    if (e.kind === 'player') return e.hero || (R.state && R.state.p && R.state.p.hero) || (t && !/^npc:/.test(t) ? strip(t) : null);
    if (e.kind === 'ghost') return e.hero || strip(e.type) || null;
    if (e.kind === 'npc') return e.champ || (t && /^champ:/.test(t) ? t.slice(6) : null);
    if (e.kind === 'companion') return e.champ || strip(t);
    return null; }
  function keyFor(e) { if (e.kind === 'mob' || e.kind === 'boss') return strip(e.sprite || e.type); const c = champId(e); if (c) return c; return strip(e.sprite || e.type) || 'hero'; }
  const isChampKind = e => e.kind === 'player' || e.kind === 'ghost' || e.kind === 'companion' || (e.kind === 'npc' && !!champId(e));
  const mCache = {};
  // the figure's body height in world units: mobs from their sheet (R.draw.measure), champions 64, bosses <= 2 x a common mob, critters e.h
  function heightOf(e) {
    if (e.bbH) return e.bbH;
    const D = D_(), k = e.kind;
    if (k === 'critter') return e.h || 24;
    if (isChampKind(e)) { let h = 64; if (D.champMeasure) { const id = champId(e); let m = mCache['c:' + id]; if (m === undefined) { try { m = D.champMeasure(id); } catch (x) { m = null; } mCache['c:' + id] = m; } if (m && m.h > 0) h = m.h; } return h * (e.sz || 1); }
    if (k === 'mob' || k === 'boss') { const key = keyFor(e); let m = mCache['e:' + key]; if (m === undefined) { try { m = D.measure ? D.measure(key) : null; } catch (x) { m = null; } mCache['e:' + key] = m; }
      const base = m && m.h > 0 ? m.h : 48;
      if (k === 'boss') return clamp(base * clamp(e.scale || e.sz || 1.6, 1, 2), 56, 100);
      return clamp(base * (e.sz || e.scale || 1), 16, 120); }
    if (k === 'npc') return 60;
    return 60 * clamp((e.r || 14) / 14, .6, 2);
  }
  R3.heightOf = heightOf;
  function fbFrame(e) {
    const walk = e.anim === 'walk' ? 1 + (Math.floor((e.animT || 0) * 8) % 2) : 0, boss = e.kind === 'boss', key = e.kind + '|' + e.team + '|' + (e.anim === 'attack' ? 'a' : walk) + (boss ? 'B' : '');
    let c = fbCache[key]; if (c) return c;
    const w = boss ? 48 : 28, h = boss ? 96 : 56; c = fbCache[key] = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const col = e.kind === 'player' || e.kind === 'ghost' ? '#8fc0ff' : e.team === 0 ? '#7fd06a' : e.team === 2 ? '#e3b661' : boss ? '#b1121b' : '#d64b4b', bob = walk === 2 ? 2 : 0;
    g.fillStyle = col; g.beginPath(); g.ellipse(w / 2, h * .62 + bob, w * .3, h * .3, 0, 0, 7); g.fill();
    g.fillStyle = '#2a2420'; g.fillRect(w * .36, h * .86, w * .1, h * .14 - bob); g.fillRect(w * .54, h * .86, w * .1, h * .14 - (walk === 1 ? 3 : 0));
    g.fillStyle = '#f1d9b8'; g.beginPath(); g.arc(w / 2 + w * .06, h * .25 + bob, w * .2, 0, 7); g.fill();
    if (e.anim === 'attack') { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(w * .85, h * .5, w * .4, -1.3, 1.3); g.stroke(); }
    return c;
  }
  function glyph(key, draw, size) { let c = fbCache[key]; if (c) return c; c = fbCache[key] = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  // ground glyphs carry their world size: units {w, h} and anchor {x, y} (fractions from the top left)
  const sized = (c, w, ay) => { if (!c.units) { c.units = { w, h: w }; c.anchor = { x: .5, y: ay }; } return c; };
  function dropFrame(e) { const it = e.item || e, rar = Math.max(0, Math.min(4, it.rar | 0)), col = Rd.RAR[rar]; return sized(glyph('drop' + rar, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, hexA(col, .7)); gr.addColorStop(.5, hexA(col, .25)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.fillStyle = col; g.fillRect(-s * .14, -s * .14, s * .28, s * .28); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(-s * .14, -s * .14, s * .12, s * .12); g.restore(); }, 48), 30, .75); }
  const portalFrame = () => sized(glyph('portal', (g, s) => { const c = s / 2; const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(140,220,255,.6)'); gr.addColorStop(.6, 'rgba(120,80,220,.3)'); gr.addColorStop(1, 'rgba(120,80,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.lineWidth = 4; for (let i = 0; i < 3; i++) { g.strokeStyle = i % 2 ? 'rgba(181,123,255,.9)' : 'rgba(127,224,255,.95)'; g.beginPath(); g.arc(c, c, c * (.45 + i * .18), i * 2.1, i * 2.1 + 2.6); g.stroke(); } }, 96), 84, .5);
  const trapFrame = () => sized(glyph('trap', (g, s) => { const c = s / 2; g.fillStyle = 'rgba(20,16,24,.85)'; g.beginPath(); g.arc(c, c, c * .7, 0, 7); g.fill(); g.fillStyle = '#9a9aa6'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * .3, c + Math.sin(a) * c * .3); g.lineTo(c + Math.cos(a + .25) * c * .5, c + Math.sin(a + .25) * c * .5); g.lineTo(c + Math.cos(a) * c * .95, c + Math.sin(a) * c * .95); g.fill(); } }, 48), 30, .5);
  // texture scale for R.draw.*Frame: the sheet's box px at scale 1 is learnt from the first frame (meta.h / meta.sc), then frames are asked at H x PXU px
  const boxH = {};
  function frameScale(ns, key, wh) { const b = boxH[ns + key]; if (!b) return null; return clamp(Math.round(wh * PXU / 8) * 8, 24, 232) / b; }
  function learn(ns, key, cv) { if (!boxH[ns + key] && cv && cv.meta && cv.meta.h > 0 && cv.meta.sc > 0) boxH[ns + key] = cv.meta.h / cv.meta.sc; }
  function viaDraw(ns, key, wh, call) { let sc = frameScale(ns, key, wh); let cv = call(sc || 1); if (!sc && cv) { learn(ns, key, cv); sc = frameScale(ns, key, wh); if (sc) cv = call(sc); } return cv; }
  function frameFor(e, wh) {
    if (e.kind === 'drop') return dropFrame(e); if (e.kind === 'portal') return portalFrame(); if (e.kind === 'trap') return trapFrame();
    let cv = null; const anim = e.anim || 'idle', t = e.animT || 0, face = e.face || 1;
    if (e === R.player && HB.back && D_().heroBack) { try { const st = R.state || {}, p = st.p || {}, acc = st.acc || {};
        const o = { hero: p.hero || champId(e), cls: p.cls, house: acc.house || p.house, face, lean: HB.lean, speed: HB.speed, cloak: R.phys && typeof R.phys.cloak === 'function' ? R.phys.cloak(e) : undefined, e };
        const b = D_().heroBack(anim, t, o); if (b && b.width > 0 && b.meta && b.meta.h > 0) return b; } catch (x) { if (!warned.hb) { warned.hb = 1; console.warn('render: heroBack', x); } } }
    if (typeof e.frame === 'function') { try { cv = e.frame(anim, t, face, { e }); } catch (x) { if (!warned.ef) { warned.ef = 1; console.warn('render: e.frame', x); } } }
    const D = D_();
    if (!cv) { try {
      if (isChampKind(e)) { const id = champId(e);
        if (id && D.champFrame) cv = viaDraw('c', id, wh, sc => D.champFrame(id, anim, t, face, { scale: sc, e }));
        else if (e.kind === 'player' && D.heroFrame) cv = viaDraw('h', 'hero', wh, sc => D.heroFrame(anim, t, face, { scale: sc, e })); }
      if (!cv && D.frame) { const key = keyFor(e);
        if (!boxH['e' + key] && D.meta) { try { const m = D.meta(key); if (m && m.h > 0) boxH['e' + key] = m.h; } catch (x) {} }
        cv = viaDraw('e', key, wh, sc => D.frame(key, anim, t, face, { scale: sc, e })); }
    } catch (x) { if (!warned.df) { warned.df = 1; console.warn('render: R.draw.frame', x); } } }
    if (cv && !(cv.width > 0)) cv = null;
    return cv || fbFrame(e);
  }
  function spriteFor(e) {
    let s = sprites.get(e.id); if (s) return s;
    // DoubleSide so a mirrored (face -1) quad is not culled; forceSinglePass or three draws every transparent DoubleSide object twice
    // no distance fog on the hero and the fighters: in a blizzard (fog near ~150) it washed the hero out to a white ghost at the camera's 420 u
    const mat = new T.SpriteMaterial({ transparent: true, alphaTest: .08, depthWrite: true, side: T.DoubleSide, forceSinglePass: true, fog: !(e === R.player || e.kind === 'player' || e.kind === 'mob' || e.kind === 'boss'), toneMapped: false }); const sp = new T.Sprite(mat); sp.center.set(.5, 0); sp.frustumCulled = false;
    s = { sp, mat, cv: null, tv: 0, ent: e, wh: 60 }; sprites.set(e.id, s); scene.add(sp); return s;
  }
  // flat discs: shadows (one instanced mesh for every billboard) and the hero's light
  const discGeo = new T.PlaneGeometry(1, 1); discGeo.rotateX(-Math.PI / 2);
  const shadowTex = new T.CanvasTexture(glyph('shadow', (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(.6, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 64));
  const SH_MAX = 128;
  const shadows = new T.InstancedMesh(discGeo, new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SH_MAX); shadows.frustumCulled = false; shadows.count = 0; shadows.instanceMatrix.setUsage(T.DynamicDrawUsage); shadows.renderOrder = 1; scene.add(shadows);
  const lightTex = new T.CanvasTexture(glyph('light', (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,236,190,.22)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 64));
  const heroLight = new T.Mesh(discGeo, new T.MeshBasicMaterial({ map: lightTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); heroLight.scale.set(150, 1, 150); heroLight.visible = false; scene.add(heroLight);
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _f = new T.Frustum(), _pm = new T.Matrix4(), _sph = new T.Sphere();
  const stOn = v => !!v && (typeof v !== 'number' || v > 0);
  const NOBB = { proj: 1, fx: 1, decal: 1 };
  // the hero's heading (velocity, else the last one, else his facing), its turn rate -> lean, speed 0..1, and whether we see his back
  const HB = { dx: 0, dy: -1, ang: 0, lean: 0, speed: 0, back: false, dustT: 0, t: -1 };
  R3.heroView = HB;
  function heroTrack(e) {
    if (HB.t === R.t) return; const dt = HB.t < 0 ? 1 / 60 : Math.max(1 / 240, R.t - HB.t); HB.t = R.t;
    // the hero is moved by physics (e.vx/vy stay 0): take the heading from his actual displacement (or e.vel), smoothed
    if (HB.px == null) { HB.px = e.x; HB.py = e.y; }
    let vx = e.vx || (e.vel && e.vel.x) || 0, vy = e.vy || (e.vel && e.vel.y) || 0;
    if (!(Math.hypot(vx, vy) > 15)) { const mx = (e.x - HB.px) / dt, my = (e.y - HB.py) / dt; if (Math.hypot(mx, my) < 2000) { vx = mx; vy = my; } }
    HB.px = e.x; HB.py = e.y; HB.svx = lerp(HB.svx || 0, vx, .35); HB.svy = lerp(HB.svy || 0, vy, .35); vx = HB.svx; vy = HB.svy;
    const sp = Math.hypot(vx, vy); if (sp > 15) { HB.dx = vx / sp; HB.dy = vy / sp; } else if (HB.t === 0) { HB.dx = e.face < 0 ? -1 : 1; HB.dy = 0; }
    const ang = Math.atan2(HB.dy, HB.dx); let da = ang - HB.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); HB.ang = ang;
    HB.lean = lerp(HB.lean, clamp(da / dt * .35, -1, 1), .15); HB.speed = clamp(sp / 240, 0, 1);
    const f = R.cam.fwd || { x: 0, y: -1 }, dot = HB.dx * f.x + HB.dy * f.y; HB.back = HB.back ? dot > .42 : dot > .5;
    // dust when sprinting
    if (sp > 200 && !(e.z > 4) && R.fx && typeof R.fx.spawn === 'function' && R.t > HB.dustT) { HB.dustT = R.t + .11; try { R.fx.spawn('dust', e.x - HB.dx * 10, e.y - HB.dy * 10, { col: '#b9a37e', n: 3, r: 10 }); } catch (x) {} }
  }
  // rim light: a warm silhouette behind the hero (the frame's alpha, a flat colour), 4 % larger, so he pops from the ground
  const rimMat = new T.SpriteMaterial({ transparent: true, depthWrite: false, color: 0xffe2b0, opacity: .22, toneMapped: false, fog: false });
  let rimHouse = null; const rimTint = () => { const h = R.state && R.state.acc && R.state.acc.house, H = R.data && R.data.houses; if (h === rimHouse) return; rimHouse = h; const c = (h && H && H[h] && H[h].col) || '#e8d2a8'; try { rimMat.color.set(c).lerp(new T.Color(1, 1, 1), .45); } catch (e) {} };
  rimMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = diffuse;'); };
  rimMat.customProgramCacheKey = () => 'g1rim';
  const rim = new T.Sprite(rimMat); rim.frustumCulled = false; rim.visible = false; rim.renderOrder = -1; scene.add(rim); R3.rim = rim;

  const deathT = e => { try { return (R.draw && R.draw.deathTime && e.kind !== 'critter' && R.draw.deathTime(keyFor(e))) || .75; } catch (x) { return .75; } };
  function syncSprites() {
    const hero = R.player, hx = hero ? hero.x : R.cam.x, hy = hero ? hero.y : R.cam.y; let n = 0, ns = 0; const seen = new Set();
    if (hero) heroTrack(hero); else rim.visible = false;
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_pm);
    for (const e of R.ents) {
      if (!e || NOBB[e.kind] || e.hidden || e.noDraw) continue;
      if (e !== hero && Math.hypot(e.x - hx, e.y - hy) > CULL_D) continue;
      // the dead play their baked death frames, then fade out over 1.2 s
      let a = 1; if (e.dead) { const k = (e.animT || 0) - deathT(e); a = k > 0 ? Math.max(0, 1 - k / 1.2) : 1; if (a <= 0) continue; }
      if (e.kind === 'ghost') a *= .6; if (e.alpha != null) a *= e.alpha; if (e.fade != null) a *= e.fade; if (a <= .01) continue;
      const wh = heightOf(e), gy = groundY(e.x, e.y);
      _sph.center.set(e.x, gy + wh / 2 + (e.z || 0), e.y); _sph.radius = wh; if (e !== hero && !_f.intersectsSphere(_sph)) continue;
      const s = spriteFor(e); seen.add(e.id); s.ent = e; s.wh = wh;
      const cv = frameFor(e, wh); if (cv !== s.cv) { s.cv = cv; const had = !!s.mat.map; s.mat.map = texFor(cv); if (!had) s.mat.needsUpdate = true; } else if (cv.dirty) texFor(cv);
      // canvas px -> world units and the feet anchor: 05_sprites' meta {ax, ay, h}; else units/anchor on the canvas; else critters 1 px = 1 unit (or e.h), feet at the bottom
      let u, ax = .5, ay = 1; const M = cv.meta;
      if (M && M.h > 0 && M.ax != null) { u = wh / M.h; ax = M.ax / cv.width; ay = M.ay / cv.height; }
      else if (cv.units && cv.units.h > 0) { u = cv.units.h / cv.height; if (cv.anchor) { ax = cv.anchor.x; ay = cv.anchor.y; } }
      else u = e.kind === 'critter' ? (e.h && cv.height > 0 ? e.h / cv.height : 1) : wh / cv.height;
      const w = cv.width * u, h = cv.height * u;
      s.sp.scale.set(w, h, 1); s.sp.center.set(ax, 1 - ay);
      const lift = (e.z || 0) + (e.kind === 'drop' ? 8 + Math.sin(R.t * 3 + e.id) * 3 : e.kind === 'portal' ? 46 : e.kind === 'trap' ? 2 : 0);
      s.sp.position.set(e.x, gy + lift, e.y);
      s.mat.opacity = a; s.mat.rotation = e.tumble && e.tumble.ang ? e.tumble.ang : e.kind === 'portal' ? R.t * 1.5 : 0;
      if (e === hero) { s.mat.rotation += -HB.lean * .14 * (.4 + .6 * HB.speed);
        if (!e.dead && s.mat.map) { rimMat.map = s.mat.map; if (!rim.__m) { rim.__m = 1; rimMat.needsUpdate = true; } rimTint(); rim.center.copy(s.sp.center); rim.scale.set(w * 1.025, h * 1.02, 1); rimMat.rotation = s.mat.rotation;
          const cp = camera.position, bx = e.x - cp.x, bz = e.y - cp.z, bl = Math.hypot(bx, bz) || 1; rim.position.set(e.x + bx / bl * 3, gy + lift - 1, e.y + bz / bl * 3); rim.visible = !(R.t < (s.flUntil || 0)); rimMat.opacity = .22 * a; } else rim.visible = false; }
      // hit flash: the sprite colour above 1 whitens the frame (no blending / shader change)
      const trig = (e.flash > 0 && !s.flash0) || (e.hitT != null && e.hitT !== s.hitT0 && R.t - e.hitT < .1); s.flash0 = e.flash > 0; s.hitT0 = e.hitT;
      if (trig && R.t >= (s.flNext || 0)) { s.flUntil = R.t + .12; s.flNext = R.t + .25; }
      const flash = R.t < (s.flUntil || 0);
      if (flash) s.mat.color.copy(tint).multiply(spriteLight).multiplyScalar(1.45); else if (s.flash || s.tv !== tintVer) s.mat.color.copy(tint).multiply(spriteLight);
      s.flash = flash; s.tv = tintVer;
      s.sp.visible = true; ns++;
      if (e.kind !== 'drop' && e.kind !== 'portal' && e.kind !== 'trap' && !(e.dead && a < .5) && n < SH_MAX && !(e.kind === 'critter' && (e.z || 0) > 60)) {
        const r = Math.max((e.r || 12) * 1.15, Math.min(w * .3, wh * .45)), sa = e.z > 0 ? Math.max(.3, 1 - e.z / 120) : 1;
        _p.set(e.x, gy + 1.5, e.y); _s.set(r * 2.2 * sa, 1, r * 1.5 * sa); _m.compose(_p, _q, _s); shadows.setMatrixAt(n++, _m);
        if ((e === hero || e.kind === 'boss') && n < SH_MAX) { _p.y += .2; _s.set(r * 1.1, 1, r * .7); _m.compose(_p, _q, _s); shadows.setMatrixAt(n++, _m); } }
    }
    shadows.count = n; shadows.instanceMatrix.needsUpdate = true;
    for (const [id, s] of sprites) if (!seen.has(id)) { if (!s.ent.dead && R.ents.indexOf(s.ent) >= 0) { s.sp.visible = false; continue; } scene.remove(s.sp); s.mat.dispose(); sprites.delete(id); }
    if (hero) { heroLight.visible = true; heroLight.position.set(hero.x, groundY(hero.x, hero.y) + 1.6, hero.y); } else heroLight.visible = false;
    R3.stats.sprites = ns;
  }

  /* ---------- POIs: props ---------- */
  const props = new Map();
  const propMat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  // one mesh per prop: the parts (any geometry, a colour, a placement) merged with vertex colours → one draw call
  function mergeParts(parts) {
    const P = [], N = [], UV = [], C = [], c = new T.Color();
    for (const p of parts) { const g0 = p.geo, g = g0.index ? g0.toNonIndexed() : g0; if (p.ry) g.rotateY(p.ry); g.translate(p.x || 0, p.y || 0, p.z || 0);
      const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv && g.attributes.uv.array; c.set(p.col);
      for (let i = 0; i < pos.length; i++) P.push(pos[i]); for (let i = 0; i < nor.length; i++) N.push(nor[i]);
      for (let i = 0, nv = pos.length / 3; i < nv; i++) { C.push(c.r, c.g, c.b); UV.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0); }
      if (g !== g0) g.dispose(); g0.dispose(); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(C, 3)); return geo;
  }
  const box = (w, h, d, col, x, y, z) => ({ geo: new T.BoxGeometry(w, h, d), col, x, y: (y || 0) + h / 2, z });
  function simpleProp(poi) {
    const kind = poi.kind || poi.type, col = Rd.houseCol(poi); let parts;
    if (kind === 'castle') parts = [box(170, 36, 130, '#4a505a'), box(70, 150, 70, '#5a6270'), box(84, 14, 84, '#3a3f4a', 0, 150), box(26, 60, 26, '#5a6270', 60, 36, -40), box(26, 60, 26, '#5a6270', -60, 36, 40),
      box(3, 70, 3, '#2a2420', 0, 164), { geo: new T.PlaneGeometry(40, 30), col, x: 21, y: 218, z: 0 }];
    else if (kind === 'camp') { parts = []; for (let i = 0; i < 3; i++) { const a = i * 2.1; parts.push({ geo: new T.ConeGeometry(28, 44, 6), col: '#c9a877', x: Math.cos(a) * 60, y: 22, z: Math.sin(a) * 60 }); } parts.push({ geo: new T.SphereGeometry(8, 8, 6), col: '#ff8a30', y: 8 }); }
    else if (kind === 'dungeon') parts = [box(70, 80, 40, '#14141e'), box(30, 50, 6, '#2a1a3a', 0, 0, 18), { geo: new T.PlaneGeometry(34, 54), col: '#7a4ac8', y: 27, z: 21.5 }];
    else if (kind === 'shrine') parts = [{ geo: new T.CylinderGeometry(7, 11, 70, 7), col: '#e8e4da', y: 35 }, { geo: new T.SphereGeometry(40, 10, 8), col: '#b4201f', y: 88 }];
    else parts = [box(60, 44, 60, '#7a5a3a'), { geo: new T.ConeGeometry(52, 40, 4), col: '#4a3324', y: 64, ry: Math.PI / 4 }, box(36, 30, 36, '#7a5a3a', 60, 0, 30), { geo: new T.ConeGeometry(32, 26, 4), col: '#4a3324', x: 60, y: 43, z: 30, ry: Math.PI / 4 }];
    const m = new T.Mesh(mergeParts(parts), propMat); m.name = 'prop:' + kind; return m;
  }
  R3.mergeParts = mergeParts; R3.propMat = propMat;
  function placeProp(p) { const q = pxy(p.poi); p.obj.position.set(q.x, groundY(q.x, q.y), q.y); }
  function syncProps() {
    const pois = R.data.world && R.data.world.pois; if (!pois) return;
    const hero = R.player, hx = hero ? hero.x : R.cam.x, hy = hero ? hero.y : R.cam.y;
    const near = []; for (const poi of pois) { const q = pxy(poi), d = Math.hypot(q.x - hx, q.y - hy); if (d <= PROP_D) near.push([d, poi]); }
    near.sort((a, b) => a[0] - b[0]); const show = new Set(); let n = 0;
    for (let i = 0; i < near.length && i < PROP_N; i++) { const poi = near[i][1], id = poi.id || ('poi' + i); show.add(id);
      let p = props.get(id); if (!p) { let obj = null; if (R.props && R.props.build) { try { obj = R.props.build(poi); } catch (e) { if (!warned.pb) { warned.pb = 1; console.warn('render: R.props.build', e); } } }
        if (!obj || !obj.isObject3D) obj = simpleProp(poi); p = { poi, obj }; props.set(id, p); placeProp(p); scene.add(obj); }
      p.obj.visible = true; n++; }
    for (const [id, p] of props) if (!show.has(id)) p.obj.visible = false;
    R3.stats.props = n;
  }

  /* ---------- camera + projection ----------
     Third person behind the hero: yaw 0 looks north; the camera sits at target - forward x dist, forward = (sin yaw, -cos yaw) on the
     ground, so A12's P.camDir (stick up = forward, right = (cos yaw, sin yaw)) moves the hero away from the camera at any yaw.
     A right-half drag (R.input.look.dx) and Q/E turn it (drag right = turn right), R.input.pinch zooms 300..700 (default 420), the pitch
     follows the zoom (30 deg close .. 40 deg far). Yaw / distance ease toward their targets; a value written to R.cam.yaw / R.cam.dist
     from outside (tests, cut-scenes) is taken as the new target and snapped to. */
  R.cam.yaw = R.cam.yaw || 0; R.cam.dist = R.cam.dist || 420; R.cam.pitch = R.cam.pitch || 35 * DEG;
  const CAM = { yawT: R.cam.yaw, distT: R.cam.dist, yawOut: R.cam.yaw, distOut: R.cam.dist, DMIN: 300, DMAX: 700, PMIN: 30, PMAX: 40, TURN: .0065, AHEAD: .14 };
  const _la = new T.Vector3();
  R3.camCfg = CAM;
  const camT = new T.Vector3(R.W / 2, 30, R.H / 2); let camInit = false, lastPlayer = null; const look = { x: 0, y: 0 };
  Rd.snapCam = () => { camInit = false; };
  function updateCam() {
    const C = R.cam, p = R.player, I = R.input, lk = I && I.look;
    if (C.yaw !== CAM.yawOut) { CAM.yawT = C.yaw; } if (C.dist !== CAM.distOut) { CAM.distT = C.dist; }
    if (lk && lk.dx && isFinite(lk.dx)) CAM.yawT += lk.dx * CAM.TURN;
    const pin = I && (I.pinch != null ? I.pinch : lk && lk.pinch); if (pin && pin !== 1 && isFinite(pin) && pin > 0) CAM.distT /= pin;
    CAM.distT = clamp(CAM.distT, CAM.DMIN, CAM.DMAX);
    if (!camInit) { C.yaw = CAM.yawT; C.dist = CAM.distT; }
    else { C.yaw = lerp(C.yaw, CAM.yawT, .32); if (Math.abs(C.yaw - CAM.yawT) < 1e-4) C.yaw = CAM.yawT; C.dist = lerp(C.dist, CAM.distT, .18); if (Math.abs(C.dist - CAM.distT) < .05) C.dist = CAM.distT; }
    CAM.yawOut = C.yaw; CAM.distOut = C.dist;
    if (!C.pitchLock) C.pitch = (CAM.PMIN + (CAM.PMAX - CAM.PMIN) * (C.dist - CAM.DMIN) / (CAM.DMAX - CAM.DMIN)) * DEG;
    C.pitch = clamp(C.pitch, 15 * DEG, 75 * DEG);
    if (p && p !== lastPlayer) { lastPlayer = p; camInit = false; }
    let tx = camT.x, ty = camT.z, dx = 0, dy = 0;
    // a small lookahead along the hero's world velocity
    if (p) { tx = p.x; ty = p.y; dx = p.vx || 0; dy = p.vy || 0; const l = Math.hypot(dx, dy); if (l > 20) { dx /= l; dy /= l; } else dx = dy = 0; }
    look.x = lerp(look.x, dx * 34, .06); look.y = lerp(look.y, dy * 34, .06); tx += look.x; ty += look.y;
    const k = camInit ? .14 : 1; if (!camInit || Math.hypot(tx - camT.x, ty - camT.z) > 1500) { camT.set(tx, 0, ty); camInit = true; camT.y = groundY(clamp(tx, 0, R.W), clamp(ty, 0, R.H)) + 30; } else { camT.x = lerp(camT.x, tx, k); camT.z = lerp(camT.z, ty, k); }
    camT.x = clamp(camT.x, 0, R.W); camT.z = clamp(camT.z, 0, R.H); camT.y = lerp(camT.y, groundY(camT.x, camT.z) + 30, camInit ? .1 : 1);
    const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch), fx = Math.sin(C.yaw), fz = -Math.cos(C.yaw);
    // the camera looks a little past the hero (AHEAD x dist), so he stands below the screen centre with more of the way ahead in view
    const ah = (CAM.AHEAD || 0) * C.dist, lx = camT.x + fx * ah, lz = camT.z + fz * ah;
    const cx = lx - fx * cp * C.dist, cz = lz - fz * cp * C.dist; let cy = camT.y + sp * C.dist;
    // keep the camera above the ground under it and halfway back (hills behind the hero)
    const gc = Math.max(groundY(clamp(cx, 0, R.W), clamp(cz, 0, R.H)), groundY(clamp((cx + camT.x) / 2, 0, R.W), clamp((cz + camT.z) / 2, 0, R.H)) - 10) + 40; if (cy < gc) cy = gc;
    camera.position.set(cx, cy, cz); _la.set(lx, camT.y, lz); camera.lookAt(_la); camera.updateMatrixWorld(true);
    C.x = camT.x; C.y = camT.z; C.z = (R.vh / 2) / (camera.position.distanceTo(camT) * Math.tan(camera.fov * DEG / 2));
    C.fwd = { x: fx, y: fz };
  }

  /* ---------- see-through: props / trees / houses in front of the hero are dithered away ----------
     Every non-shader mesh material in the scene (A37's props, A43's nature, the simple POI props) gets a screen-space test in its
     fragment shader (chained after the module's own onBeforeCompile, its cache key kept + '|occ'): a fragment nearer to the camera than
     the hero and inside an ellipse around the hero and the fight around him is discarded with a clean edge (no dither stipple; a see-through
     hole, no transparency sorting); anything within 120 units of the camera fades too. */
  const OCC = { uOccP: { value: new T.Vector4(0, 0, 0, 0) }, uOccR: { value: new T.Vector3(.32, .42, 1) }, uOccH: { value: new T.Vector4(0, -1e5, 0, 0) } };
  R3.occ = OCC;
  const OCC_V = 'varying vec4 vOccC; varying vec3 vOccW;\n', OCC_F = 'varying vec4 vOccC; varying vec3 vOccW; uniform vec4 uOccP; uniform vec3 uOccR; uniform vec4 uOccH;\n' +
    'void occTest(){ if (uOccP.w < 0.5) return; vec2 n = vOccC.xy / vOccC.w; float dz = vOccC.w;\n' +
    ' vec2 d = vec2((n.x - uOccP.x) * uOccR.z / uOccR.x, (n.y - uOccP.y) / uOccR.y); float r = length(d);\n' +
    ' float k = (1.0 - smoothstep(0.86, 1.0, r)) * step(dz, uOccP.z - 18.0) * 1.04;\n' +
    ' k = max(k, 1.0 - smoothstep(96.0, 116.0, dz));\n' +
    ' float hd = distance(vOccW.xz, uOccH.xz); k = max(k, (1.0 - smoothstep(uOccH.w * 0.88, uOccH.w, hd)) * step(uOccH.y + 6.0, vOccW.y) * step(dz, uOccP.z + 40.0));\n' +
    ' if (k >= 0.5) discard; }\n';   // a clean cut at the middle of each band (QA test 2.1: the 4x4 dither rim showed as stippled halos round the walls)
  const MAIN = /void\s+main\s*\(\s*\)\s*\{/;
  function occPatch(m) {
    if (!m || m.__occ || m.isShaderMaterial || m.isRawShaderMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isLineBasicMaterial) return;
    if (!(m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial || m.isMeshStandardMaterial || m.isMeshToonMaterial || m.isMeshMatcapMaterial)) return;
    m.__occ = true; const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, rr) {
      if (typeof prev === 'function') { try { prev.call(this, sh, rr); } catch (e) {} }
      if (!/#include <project_vertex>/.test(sh.vertexShader) || !MAIN.test(sh.fragmentShader)) return;
      sh.uniforms.uOccP = OCC.uOccP; sh.uniforms.uOccR = OCC.uOccR; sh.uniforms.uOccH = OCC.uOccH;
      sh.vertexShader = OCC_V + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vOccC = gl_Position; { vec4 ow = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n ow = instanceMatrix * ow;\n#endif\n vOccW = (modelMatrix * ow).xyz; }');
      sh.fragmentShader = OCC_F + sh.fragmentShader.replace(MAIN, 'void main() {\n occTest();');
    };
    m.customProgramCacheKey = function () { let k = ''; try { k = typeof prevKey === 'function' ? prevKey.call(this) : ''; } catch (e) {} return k + '|occ' + (typeof prev === 'function' ? String(prev).length : 0); };
    m.needsUpdate = true;
  }
  let occN = 0;
  function occScan() { scene.traverse(o => { if (!o.isMesh || o === shadows || o === heroLight || (o.parent && o.parent.name === 'terrain')) return; const mm = o.material; if (Array.isArray(mm)) mm.forEach(occPatch); else occPatch(mm); }); }
  const _hv = new T.Vector3();
  function occUpdate() {
    if ((occN++ % 4) === 0) occScan();
    const p = R.player; if (!p || R3.occOff) { OCC.uOccP.value.w = 0; return; }
    const gy = groundY(p.x, p.y) + 30; _hv.set(p.x, gy, p.y).applyMatrix4(camera.matrixWorldInverse); const d = -_hv.z;
    _hv.set(p.x, gy, p.y).project(camera);
    // clip w = view depth; the hole is centred a bit above the hero's middle, wide enough for the mobs around him
    OCC.uOccP.value.set(_hv.x, _hv.y + .04, d, d > 0 ? 1 : 0); OCC.uOccH.value.set(p.x, gy - 30, p.y, R3.occInside == null ? 80 : R3.occInside);
    const zoom = 420 / Math.max(200, R.cam.dist || 420); OCC.uOccR.value.set(.34 * zoom, .3 * zoom, camera.aspect);
  }

  const _v = new T.Vector3();
  R.w2s = (x, y, z) => { _v.set(x, groundY(x, y) + (z || 0), y).applyMatrix4(camera.matrixWorldInverse); if (_v.z > -camera.near) return { x: -1e4, y: -1e4, behind: true, d: 0 };
    const d = -_v.z; _v.applyMatrix4(camera.projectionMatrix); return { x: (_v.x + 1) / 2 * R.vw, y: (1 - _v.y) / 2 * R.vh, behind: false, d }; };
  R.s2w = (sx, sy) => { _v.set(sx / R.vw * 2 - 1, 1 - sy / R.vh * 2, .5).unproject(camera); const o = camera.position, d = _v.sub(o).normalize();
    if (d.y >= -1e-4) return { x: clamp(o.x + d.x * 3000, 0, R.W), y: clamp(o.z + d.z * 3000, 0, R.H), far: true };
    let t = (camT.y - 24 - o.y) / d.y; for (let i = 0; i < 6; i++) { const h = groundY(clamp(o.x + d.x * t, 0, R.W), clamp(o.z + d.z * t, 0, R.H)); t = t * .5 + ((h - o.y) / d.y) * .5; }
    return { x: clamp(o.x + d.x * t, 0, R.W), y: clamp(o.z + d.z * t, 0, R.H), far: false }; };
  R3.pxPerUnitAt = (x, y, z) => { const a = R.w2s(x, y, z || 0), b = R.w2s(x, y, (z || 0) + 10); return a.behind || b.behind ? R.cam.z : Math.abs(a.y - b.y) / 10; };

  /* ---------- the next closed gate: a soft red curtain along the region border (3D, fogged, culled) ---------- */
  const gateTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.35, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
  const gateMat = new T.MeshBasicMaterial({ map: gateTex, color: 0xd8382c, transparent: true, depthWrite: false, side: T.DoubleSide, fog: true, toneMapped: false });
  let gateMesh = null, gateKey = null;
  function syncGate() {
    let g = null; try { g = Rd.nextGate(); } catch (e) { g = null; } const key = g ? g.id + ':' + g.P.length + ':' + (terrain ? terrain.id : 0) : null;
    if (key !== gateKey) { gateKey = key; if (gateMesh) { scene.remove(gateMesh); gateMesh.geometry.dispose(); gateMesh = null; }
      if (g && g.P.length > 1 && terrain) { const P = g.P, n = P.length, seg = g.closed ? n : n - 1, pos = [], uv = [], idx = []; let d = 0;
        for (let i = 0; i < seg; i++) { const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 150));
          for (let k = (i ? 1 : 0); k <= m; k++) { const x = a[0] + (b[0] - a[0]) * k / m, y = a[1] + (b[1] - a[1]) * k / m, gy = groundY(clamp(x, 0, R.W), clamp(y, 0, R.H)), u = (d + L * k / m) / 300, q = pos.length / 3;
            pos.push(x, gy - 4, y, x, gy + 130, y); uv.push(u, 0, u, 1); if (q > 0) idx.push(q - 2, q, q - 1, q - 1, q, q + 1); }
          d += L; }
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
        gateMesh = new T.Mesh(geo, gateMat); gateMesh.name = 'gate'; gateMesh.renderOrder = 2; scene.add(gateMesh); } }
    if (gateMesh) gateMat.opacity = .55 + .25 * Math.sin(R.t * 2.2);
  }
  R3.gate = () => gateMesh;
  /* ---------- the overlay on #c ---------- */
  function overlay(ctx) {
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); ctx.clearRect(0, 0, R.vw, R.vh); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    Rd.hook('boss', 'drawTelegraphs', ctx);
    drawProjs(ctx);
    const hero = R.player, hx = hero ? hero.x : R.cam.x, hy = hero ? hero.y : R.cam.y;
    for (const s of sprites.values()) { const e = s.ent; if (!e || e.dead || e.kind === 'drop' || e.kind === 'portal' || e.kind === 'trap') continue;
      if (!s.sp.visible || e.kind === 'critter' || e.noBar && e.kind !== 'npc' && e.kind !== 'boss') continue;
      const h = s.wh || 60, f = R.w2s(e.x, e.y, e.z || 0), top = R.w2s(e.x, e.y, (e.z || 0) + h); if (f.behind || top.behind) continue;
      const zl = Math.max(.2, (f.y - top.y) / h); if (f.x < -80 || f.x > R.vw + 80 || f.y < -40 || f.y > R.vh + 120) continue;
      ctx.globalAlpha = e.kind === 'ghost' ? .7 : 1; Rd.drawOverhead(ctx, e, { x: f.x, y: f.y }, zl, h); }
    ctx.globalAlpha = 1;
    const pois = R.data.world && R.data.world.pois, found = Rd.foundSet();
    if (pois) for (const poi of pois) { const q = pxy(poi); if (!poi.name || Math.hypot(q.x - hx, q.y - hy) > 700) continue; const s = R.w2s(q.x, q.y, (poi.kind === 'castle' ? 240 : 110)); if (s.behind) continue;
      ctx.globalAlpha = found.has(poi.id) ? 1 : .7; Rd.label(ctx, poi.name, s.x, s.y - 14, 13, found.has(poi.id) ? '#f3e7c4' : '#c6bfae'); }
    ctx.globalAlpha = 1;
    // the next closed gate is a 3D curtain (syncGate), not a line on the overlay
    if (!(R.sys.vfx && R.sys.vfx.draw)) Rd.hook('vfx', 'drawWorld', ctx);
    if (!vigEl) Rd.drawVignette(ctx);
    Rd.hook('ambience', 'drawTint', ctx);
  }

  /* ---------- the system ---------- */
  let vw = 0, vh = 0, dpr = 0, lastState = null, ready = false;
  // portrait phones get a taller field of view so the sides of a fight stay on screen; the pixel ratio is capped at 1.5 (1 on software GL)
  // the core resizes #gl to vw x dpr on window resizes: re-apply three's size whenever the buffer is not ours
  function resize() { if (vw === R.vw && vh === R.vh && dpr === R.dpr && DYN.pr && gl.width === Math.floor(R.vw * DYN.pr)) return; vw = R.vw; vh = R.vh; dpr = R.dpr; DYN.pr = 0; prApply(prCap());
    camera.aspect = vw / Math.max(1, vh); camera.fov = camera.aspect < .62 ? 64 : camera.aspect < 1 ? 58 : 50; camera.updateProjectionMatrix(); }
  // projectiles (kind 'proj') on the overlay at chest height: A11's R.combat.drawProj when present, else a short streak
  function drawProjs(ctx) { const C = R.combat, dp = C && typeof C.drawProj === 'function' ? C.drawProj : null; const hero = R.player; if (!hero) return;
    for (const e of R.ents) { if (!e || e.kind !== 'proj' || e.dead || Math.abs(e.x - hero.x) > 1200 || Math.abs(e.y - hero.y) > 1200) continue; const q = e.z == null ? Object.assign({}, e, { z: 30 }) : e;
      try { if (dp) dp(ctx, q); else { const a = R.w2s(e.x, e.y, q.z), l = Math.hypot(e.vx || 0, e.vy || 0) || 1, b = R.w2s(e.x - (e.vx || 0) / l * 14, e.y - (e.vy || 0) / l * 14, q.z); if (!a.behind && !b.behind) { ctx.strokeStyle = e.col || '#f1dca3'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } } } catch (x) {}
    } }
  R.sys.render.update = function () { resize(); if (!terrain) buildTerrain(); updateCam(); if (R.state !== lastState) { lastState = R.state; Rd.fogCheck(); } };
  /* dynamic resolution: the drawing buffer's pixel ratio starts at min(dpr, 1.5) (0.75 on software GL) and steps down by .15 (to .6) while
     the frame interval averages over 24 ms (under ~42 fps), back up after 4 s under 15 ms; R3.prFixed = a number pins it (tests). */
  const DYN = { pr: 0, n: 0, sum: 0, last: 0, good: 0, MIN: .6 };
  R3.dyn = DYN;
  function prCap() { return R3.prFixed > 0 ? R3.prFixed : Math.min(R.dpr || 1, R3.software ? .75 : 1.5); }
  function prApply(pr) { pr = Math.round(clamp(pr, R3.prFixed > 0 ? R3.prFixed : DYN.MIN, prCap()) * 100) / 100; if (pr === DYN.pr) return; DYN.pr = pr; renderer.setPixelRatio(pr); renderer.setSize(R.vw, R.vh, false); }
  function prTick(now) {
    if (!DYN.pr) prApply(prCap());
    const d = DYN.last ? now - DYN.last : 16; DYN.last = now; if (d > 250) return; // a hidden tab or a pause, not a slow frame
    DYN.sum += d; DYN.n++; if (DYN.n < 45) return; const avg = DYN.sum / DYN.n; DYN.sum = DYN.n = 0; DYN.avg = avg;
    if (avg > 24 && DYN.pr > DYN.MIN) { prApply(DYN.pr - .15); DYN.good = 0; }
    // still slow at the lowest resolution on a real GPU: drop the terrain's detail splat (8 -> 3 texture reads per pixel); software GL keeps it (tests, QA shots)
    else if (avg > 30 && !R3.software && U.uDet.value > 0) { U.uDet.value = 0; R3.stats.lowDetail = true; }
    else if (avg < 15) { if (++DYN.good >= 5 && DYN.pr < prCap()) { prApply(DYN.pr + .15); DYN.good = 0; } } else DYN.good = 0;
  }
  /* freeze spikes when new ground streams in (QA test 2.1): a shader program compiles and a texture / buffer uploads on the first draw that
     uses it, all inside that one frame. At the first frame every material in the scene is compiled and every texture uploaded; afterwards a
     nature chunk group that A43 attaches is held hidden and revealed at most one per frame (its materials compiled and its textures
     uploaded on that frame), so streaming costs one chunk's upload per frame at most. R3.warm = {done, n revealed, q queued}. */
  const WARM = { done: false, seen: new WeakSet(), q: [], n: 0, root: null, pinned: 0 };
  R3.warm = WARM;
  const upOne = v => { if (v && v.isTexture && !v.__up && v.image) { v.__up = 1; try { renderer.initTexture(v); } catch (e) {} } };
  function upTex(o) { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { for (const k in m) upOne(m[k]); if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; if (u) upOne(u.value); } } }
  // A43 disposes a chunk's materials when it rebuilds / drops it, and three then deletes the shader program once no material uses it, so
  // walking back (or a LOD rebuild) compiled the same programs again (QA walk: +9 nature programs re-made, 4-18 s frames on software GL).
  // Every program is pinned once (usedTimes + 1): it is never released, a material that comes back reuses it (a few dozen variants at most).
  function pinPrograms() { const pr = renderer.info.programs; if (!pr || pr.length === WARM.pinned) return; for (const q of pr) if (q && !q.__pin) { q.__pin = 1; q.usedTimes++; } WARM.pinned = pr.length; }
  function warmTick() {
    pinPrograms();
    if (!WARM.done) { WARM.done = true; try { scene.traverse(upTex); renderer.compile(scene, camera); } catch (e) {} const nr = scene.getObjectByName('nature'); if (nr) for (const c of nr.children) WARM.seen.add(c); return; }
    if (!R3.stageChunks) return;   // staged chunk reveal: opt-in (R3.stageChunks = true) until t_nature is checked with it (test 3 run: 16 fails with it on)
    let nr = WARM.root; if (!nr || nr.parent !== scene) { nr = WARM.root = scene.getObjectByName('nature') || null; if (!nr) return; }
    for (const c of nr.children) if (!WARM.seen.has(c)) { WARM.seen.add(c); if (c.isGroup && c.visible) { c.visible = false; c.userData.__wq = 1; WARM.q.push(c); } }
    while (WARM.q.length) { const c = WARM.q.shift(); if (c.parent !== nr || !c.userData.__wq) continue; c.userData.__wq = 0; c.visible = true;
      try { c.traverse(upTex); renderer.compile(c, camera, scene); } catch (e) {} WARM.n++; break; }
  }
  R3.warmFlush = () => { for (const c of WARM.q) if (c.userData.__wq) { c.userData.__wq = 0; c.visible = true; } WARM.q.length = 0; };
  // the 3D frame alone (no overlay): also R3.render() / draw() / frame() for tests
  function frame3d(force) {
    resize(); if (!terrain) buildTerrain(); if (!camInit) updateCam();
    if (!fogTex.image.__drawn && Rd.fogCanvas) { fogTex.image.__drawn = true; refreshFog(); }
    syncProps(); syncSprites(); occUpdate(); syncGate(); warmTick();
    renderer.render(scene, camera); const ri = renderer.info.render; R3.stats.calls = ri.calls; R3.stats.tris = ri.triangles; R3.stats.tex = renderer.info.memory.textures; R3.stats.pr = DYN.pr;
    return true;
  }
  R3.render = R3.draw = R3.frame = () => frame3d(true);
  R.sys.render.draw = function (ctx) {
    const t0 = performance.now(); prTick(t0);
    frame3d(false);
    overlay(ctx);
    if (!ready) { ready = true; R.bus.emit('render3d', R3); }
    const ms = performance.now() - t0; Rd.stats.last = ms; const h = Rd.stats.hist; h.push(ms); if (h.length > 120) h.shift();
  };
  Rd.worldToScreenRect = (x, y, w, h) => { const s = R.w2s(x, y); const z = R3.pxPerUnitAt(x, y); return { x: s.x, y: s.y, w: w * z, h: h * z }; };
  Rd.visible = m => { m = m || 0; const C = R.cam, hw = Math.max(R.vw / 2 / C.z, 600), hh = Math.max(R.vh / 2 / C.z, 900); return { x0: C.x - hw - m, y0: C.y - hh - m, x1: C.x + hw + m, y1: C.y + hh + m }; };
  R3.sprites = sprites; R3.props = props; R3.sun = sun; R3.hemi = hemi; R3.uniforms = U;
})();
