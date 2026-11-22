/* 51_map.js — the world map screen (A26). R.screens.map: the whole Westeros art in a canvas that fills the screen, pinch-zoom 0.5–3×,
   one-finger pan, double-tap zoom; fog over regions never entered; region names with level bands; POIs (found bright with names, unfound
   faint dots, castles as shields in house colours with a drawn sigil); roads faint; the player as a pulsing white arrow (a DOM element, so
   the canvas is redrawn only on interaction); other players cyan; quest markers gold; events red; region gates as red chains until open.
   Tap a found castle / shrine → a bottom card with one primary button FAST TRAVEL (free). Everything is tolerant of missing modules. */
(function () {
  const HOUSES = { stark: { n: 'Stark', col: '#a9bdd0' }, lannister: { n: 'Lannister', col: '#e3b661' }, baratheon: { n: 'Baratheon', col: '#e0c14a' },
    targaryen: { n: 'Targaryen', col: '#e14b4b' }, greyjoy: { n: 'Greyjoy', col: '#d8b74a' }, tyrell: { n: 'Tyrell', col: '#7fd06a' }, martell: { n: 'Martell', col: '#f08a3c' } };
  const MINZ = 0.5, MAXZ = 3, TRAVEL = { castle: 1, shrine: 1 }, WALK = 170, TAP_PX = 24;
  const KIND = { castle: 'Castle', town: 'Town', camp: 'Camp', dungeon: 'Dungeon', shrine: 'Shrine', portal: 'Portal', ruin: 'Ruin', village: 'Village' };
  const BLURB = { castle: 'A seat of power. Fast travel here is free once you have found it.', shrine: 'A quiet shrine. You rise here when you fall; fast travel is free.',
    town: 'A town with a market and an inn.', camp: 'A camp. Expect company.', dungeon: 'Something lives below. Bring a companion.', portal: 'A portal to an instanced dungeon.' };
  let root, cv, ctx, dpr = 1, vw = 390, vh = 844, fit = 0.07, view = { cx: 0, cy: 0, z: 1 }, raf = 0, img = null, imgSrc = '', card = null, you = null, tag = null;
  const ptrs = new Map(); let moved = 0, pinch = null, pinched = false, lastTap = 0, lastTapAt = null, tagT = 0;
  const S = R.screens.map = { live: false, draws: 0 };
  /* ---- data readers, tolerant of the data module's shape ---- */
  const world = () => (R.data && R.data.world) || {};
  const list = v => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).map(k => { const o = v[k]; if (o && typeof o === 'object' && o.id == null) o.id = k; return o; }).filter(o => o && typeof o === 'object') : [];
  const num = v => typeof v === 'number' && isFinite(v);
  const pts = p => (Array.isArray(p) ? p : []).map(q => Array.isArray(q) ? { x: +q[0], y: +q[1] } : q && typeof q === 'object' ? { x: +q.x, y: +q.y } : null).filter(q => q && isFinite(q.x) && isFinite(q.y));
  const poly = r => pts(r.poly || r.polygon || r.pts || r.points || r.shape);
  const regions = () => list(world().regions);
  const pois = () => list(world().pois || world().poi || world().places).filter(p => num(p.x) && num(p.y));
  const roads = () => list(world().roads).map(r => pts(Array.isArray(r) ? r : (r.pts || r.points || r.path || r.poly || []))).filter(r => r.length > 1);
  const gates = () => list(world().gates || world().regionGates);
  const centroid = r => { if (r.c) { const c = pts([r.c])[0]; if (c) return c; } if (num(r.cx) && num(r.cy)) return { x: r.cx, y: r.cy }; if (num(r.x) && num(r.y)) return { x: r.x, y: r.y }; const P = poly(r); if (!P.length) return null; let x = 0, y = 0; for (const q of P) { x += q.x; y += q.y; } return { x: x / P.length, y: y / P.length }; };
  const band = r => { const b = r.lvl != null ? r.lvl : r.band != null ? r.band : r.level != null ? r.level : r.levels; let a, z;
    if (Array.isArray(b)) { a = b[0]; z = b[1]; } else if (b && typeof b === 'object') { a = b.min != null ? b.min : b[0]; z = b.max != null ? b.max : b[1]; } else if (typeof b === 'string') return b; else if (num(b)) { a = b; z = r.lvlMax != null ? r.lvlMax : r.max; } else { a = r.lvlMin != null ? r.lvlMin : r.min; z = r.lvlMax != null ? r.lvlMax : r.max; }
    if (a == null && z == null) return ''; if (a == null) a = z; if (z == null || z === a) return 'Lv ' + a; if (z >= 99) return 'Lv ' + a + '+'; return 'Lv ' + a + '–' + z; };
  // world progress belongs to the account (ARCH addendum 2: R.state.acc.world.found / .flags); older saves keep it on R.state.p
  const P = () => (R.state && ((R.state.acc && R.state.acc.world) || R.state.p)) || {};
  const flags = () => P().flags || (R.state && R.state.p && R.state.p.flags) || {};
  const inSet = (f, id) => !!f && (Array.isArray(f) ? f.indexOf(id) >= 0 : !!f[id]);
  const entered = id => inSet(flags().regions, id);
  const found = id => inSet(P().found || (R.state && R.state.p && R.state.p.found), id);
  const gateOpen = g => { if (R.world && typeof R.world.gateOpen === 'function') { try { return !!R.world.gateOpen(g.id != null ? g.id : g); } catch (e) {} }
    if (g.open) return true; if (inSet(flags().gates, g.id)) return true; return !!(g.to && entered(g.to)); };
  const house = h => (R.data && R.data.houses && R.data.houses[h]) || HOUSES[h] || null;
  const safe = (o, m) => { try { const v = o && typeof o[m] === 'function' ? o[m]() : null; return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const players = () => safe(R.presence, 'list').filter(p => p && num(p.x) && num(p.y) && p !== R.player && !p.me);
  const qmarks = () => safe(R.quests, 'markers').filter(m => m && num(m.x) && num(m.y));
  const events = () => safe(R.events, 'active').filter(e => e && num(e.x) && num(e.y));
  const mapImg = () => { const m = (R.assets && R.assets.map) || window.A_MAP || null; if (!m) return null;
    if (typeof m === 'string') { if (m !== imgSrc) { imgSrc = m; img = new Image(); img.onload = () => redraw(); img.src = m; } return img && img.complete && img.naturalWidth ? img : null; }
    if (m.naturalWidth === 0 && typeof m.addEventListener === 'function') { if (!m._mpHook) { m._mpHook = 1; m.addEventListener('load', () => redraw(), { once: true }); } return null; }
    return (m.naturalWidth || m.width) ? m : null; };
  /* ---- view ---- */
  const k = () => fit * view.z;
  const toS = (x, y) => ({ x: (x - view.cx) * k() + vw / 2, y: (y - view.cy) * k() + vh / 2 });
  const toW = (sx, sy) => ({ x: (sx - vw / 2) / k() + view.cx, y: (sy - vh / 2) / k() + view.cy });
  const clampView = () => { view.z = R.clamp(view.z, MINZ, MAXZ); const kk = k(), hw = vw / 2 / kk, hh = vh / 2 / kk;
    view.cx = hw * 2 >= R.W ? R.W / 2 : R.clamp(view.cx, hw, R.W - hw); view.cy = hh * 2 >= R.H ? R.H / 2 : R.clamp(view.cy, hh, R.H - hh); };
  const redraw = () => { if (!cv || raf) return; raf = requestAnimationFrame(draw); };
  const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); vw = root.clientWidth || window.innerWidth; vh = root.clientHeight || window.innerHeight;
    // 0.5× is the whole map on the screen (contain), zoom 1 the player's surroundings, 3× the detail
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); cv.style.width = vw + 'px'; cv.style.height = vh + 'px'; fit = Math.min(vw / R.W, vh / R.H) * 2; clampView(); redraw(); };
  const centreOn = (x, y) => { view.cx = x; view.cy = y; clampView(); redraw(); };
  const zoomAt = (sx, sy, z) => { const w = toW(sx, sy); view.z = R.clamp(z, MINZ, MAXZ); const kk = k(); view.cx = w.x - (sx - vw / 2) / kk; view.cy = w.y - (sy - vh / 2) / kk; clampView(); redraw(); };
  /* ---- drawing helpers ---- */
  const path = (c, P) => { c.beginPath(); for (let i = 0; i < P.length; i++) { const s = toS(P[i].x, P[i].y); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); } };
  const halo = (c, txt, x, y, font, col, align) => { c.font = font; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = 'rgba(5,9,18,.85)'; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y); };
  const shield = (c, x, y, s) => { c.beginPath(); c.moveTo(x - s, y - s * 0.9); c.lineTo(x + s, y - s * 0.9); c.lineTo(x + s, y + s * 0.15); c.quadraticCurveTo(x + s, y + s * 0.85, x, y + s * 1.15); c.quadraticCurveTo(x - s, y + s * 0.85, x - s, y + s * 0.15); c.closePath(); };
  // a tiny drawn sigil per house (no emoji): wolf, lion, stag, dragon, kraken, rose, sun-and-spear
  const sigil = (c, h, x, y, s) => { c.save(); c.strokeStyle = c.fillStyle = 'rgba(10,14,22,.9)'; c.lineWidth = Math.max(1, s * 0.22); c.lineCap = 'round'; c.beginPath();
    switch (h) {
      case 'stark': c.moveTo(x - s * .55, y - s * .55); c.lineTo(x - s * .35, y + s * .1); c.lineTo(x, y + s * .6); c.lineTo(x + s * .35, y + s * .1); c.lineTo(x + s * .55, y - s * .55); c.lineTo(x + s * .2, y - s * .25); c.lineTo(x - s * .2, y - s * .25); c.closePath(); c.fill(); break;
      case 'lannister': c.arc(x, y, s * .32, 0, 7); c.fill(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.moveTo(x + Math.cos(a) * s * .4, y + Math.sin(a) * s * .4); c.lineTo(x + Math.cos(a) * s * .62, y + Math.sin(a) * s * .62); } c.stroke(); break;
      case 'baratheon': c.moveTo(x, y + s * .6); c.lineTo(x, y - s * .1); c.moveTo(x, y + s * .1); c.lineTo(x - s * .45, y - s * .4); c.moveTo(x, y + s * .1); c.lineTo(x + s * .45, y - s * .4); c.moveTo(x - s * .3, y - s * .2); c.lineTo(x - s * .5, y + s * .05); c.moveTo(x + s * .3, y - s * .2); c.lineTo(x + s * .5, y + s * .05); c.stroke(); break;
      case 'targaryen': for (let i = -1; i <= 1; i++) { c.moveTo(x + i * s * .4, y + s * .5); c.quadraticCurveTo(x + i * s * .6, y - s * .1, x + i * s * .25, y - s * .5); } c.stroke(); break;
      case 'greyjoy': c.arc(x, y - s * .2, s * .28, 0, 7); c.fill(); c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(x + i * s * .2, y); c.quadraticCurveTo(x + i * s * .5, y + s * .3, x + i * s * .3, y + s * .6); } c.stroke(); break;
      case 'tyrell': for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; c.moveTo(x, y); c.arc(x + Math.cos(a) * s * .3, y + Math.sin(a) * s * .3, s * .22, 0, 7); } c.fill(); break;
      case 'martell': c.arc(x, y, s * .28, 0, 7); c.fill(); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .39; c.moveTo(x + Math.cos(a) * s * .36, y + Math.sin(a) * s * .36); c.lineTo(x + Math.cos(a) * s * .55, y + Math.sin(a) * s * .55); } c.moveTo(x - s * .6, y + s * .6); c.lineTo(x + s * .6, y - s * .6); c.stroke(); break;
      default: c.arc(x, y, s * .3, 0, 7); c.fill();
    } c.restore(); };
  const icon = (c, p, x, y, s) => { const kind = p.kind || p.type || 'town'; c.save(); c.lineWidth = Math.max(1, s * .14); c.strokeStyle = 'rgba(5,9,18,.9)';
    if (kind === 'castle') { const H = house(p.house); shield(c, x, y, s); c.fillStyle = H ? H.col : '#c9b27a'; c.fill(); c.stroke(); if (p.house) sigil(c, p.house, x, y - s * .05, s * .8); else { c.fillStyle = 'rgba(10,14,22,.9)'; c.fillRect(x - s * .45, y - s * .3, s * .9, s * .55); } }
    else if (kind === 'shrine') { c.beginPath(); c.moveTo(x - s * .7, y + s * .9); c.lineTo(x + s * .7, y + s * .9); c.lineTo(x + s * .55, y + s * .45); c.lineTo(x - s * .55, y + s * .45); c.closePath(); c.fillStyle = '#5a5666'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x + s * .75, y, x, y + s * .5); c.quadraticCurveTo(x - s * .75, y, x, y - s); c.fillStyle = '#f0d070'; c.fill(); c.stroke(); }
    else if (kind === 'camp') { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y + s * .8); c.lineTo(x - s, y + s * .8); c.closePath(); c.fillStyle = '#c99a5a'; c.fill(); c.stroke(); c.beginPath(); c.arc(x, y + s * .5, s * .22, 0, 7); c.fillStyle = '#ff9b3c'; c.fill(); }
    else if (kind === 'dungeon' || kind === 'portal') { c.beginPath(); c.arc(x, y, s, 0, 7); c.fillStyle = kind === 'portal' ? '#163a4a' : '#2a2233'; c.fill(); c.strokeStyle = kind === 'portal' ? '#58d7e8' : '#b07ae0'; c.stroke(); c.beginPath(); c.moveTo(x - s * .45, y + s * .5); c.lineTo(x - s * .45, y); c.arc(x, y, s * .45, Math.PI, 0); c.lineTo(x + s * .45, y + s * .5); c.fillStyle = 'rgba(5,9,18,.95)'; c.fill(); }
    else { c.beginPath(); c.rect(x - s * .7, y - s * .1, s * 1.4, s); c.fillStyle = '#d8c9a3'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(x - s * .9, y - s * .05); c.lineTo(x, y - s); c.lineTo(x + s * .9, y - s * .05); c.closePath(); c.fillStyle = '#8c4a3c'; c.fill(); c.stroke(); }
    c.restore(); };
  const chain = (c, x, y, s) => { c.save(); c.strokeStyle = '#e14b4b'; c.lineWidth = Math.max(1.4, s * .22); for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(x + i * s * .95, y, s * .6, s * .4, i % 2 ? 0 : Math.PI / 2, 0, 7); c.stroke(); } c.restore(); };
  const draw = () => { raf = 0; if (!cv || !ctx) return; S.draws++; const c = ctx, kk = k(), z = view.z; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#0a1626'; c.fillRect(0, 0, vw, vh);
    const o = toS(0, 0), mw = R.W * kk, mh = R.H * kk, im = mapImg();
    if (im) { c.imageSmoothingEnabled = true; c.drawImage(im, 0, 0, im.naturalWidth || im.width, im.naturalHeight || im.height, o.x, o.y, mw, mh); }
    else { c.fillStyle = '#6a5a3f'; c.fillRect(o.x, o.y, mw, mh); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(o.x, o.y + mh * i / 12); c.lineTo(o.x + mw, o.y + mh * i / 12); c.stroke(); } for (let i = 1; i < 7; i++) { c.beginPath(); c.moveTo(o.x + mw * i / 7, o.y); c.lineTo(o.x + mw * i / 7, o.y + mh); c.stroke(); } }
    c.save(); c.beginPath(); c.rect(o.x, o.y, mw, mh); c.clip();
    // fog over regions never entered
    const RG = regions();
    // soft edges: the fog is blurred (a region polygon is often a few straight lines)
    try { c.filter = 'blur(' + Math.round(R.clamp(8 * z, 4, 14)) + 'px)'; } catch (e) {}
    for (const r of RG) { if (entered(r.id)) continue; const P = poly(r); if (P.length < 3) continue; path(c, P); c.closePath(); c.fillStyle = 'rgba(5,9,18,.7)'; c.fill(); c.lineWidth = Math.max(6, 10 * z); c.strokeStyle = 'rgba(5,9,18,.35)'; c.stroke(); }
    try { c.filter = 'none'; } catch (e) {}
    // roads, faint
    c.lineWidth = Math.max(1, 1.1 * z); c.strokeStyle = 'rgba(255,226,170,.26)'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const rd of roads()) { path(c, rd); c.stroke(); }
    // region gates: red chains until open
    const cen = {}; for (const r of RG) cen[r.id] = centroid(r);
    for (const g of gates()) { if (gateOpen(g)) continue; let x = g.x, y = g.y; if (!num(x) || !num(y)) { const a = cen[g.from], b = cen[g.to]; if (!a || !b) continue; x = (a.x + b.x) / 2; y = (a.y + b.y) / 2; } const s = toS(x, y); chain(c, s.x, s.y, 5 * R.clamp(z, .8, 1.6)); const lv = g.lvl != null ? g.lvl : g.level; if (lv != null) halo(c, 'Lv ' + lv, s.x, s.y + 12 * R.clamp(z, .8, 1.6), '700 ' + Math.round(10 * R.clamp(z, .9, 1.4)) + 'px ' + 'Cinzel,Georgia,serif', '#ff8a8a'); }
    // region names + level bands at the centroids
    const boxes = []; const hits = (x, y, w, h) => boxes.some(b => x - w / 2 < b.x + b.w / 2 && x + w / 2 > b.x - b.w / 2 && y - h / 2 < b.y + b.h / 2 && y + h / 2 > b.y - b.h / 2);
    for (const r of RG) { const cc = cen[r.id]; if (!cc) continue; const s = toS(cc.x, cc.y), on = entered(r.id), fs = Math.round(13 * R.clamp(z, .8, 1.5)); const name = (r.name || r.n || r.id || '') + ''; if (!name) continue;
      c.font = '700 ' + fs + 'px Cinzel,Georgia,serif'; boxes.push({ x: s.x, y: s.y + fs * .5, w: c.measureText(name.toUpperCase()).width + 8, h: fs * 2.4 });
      halo(c, name.toUpperCase(), s.x, s.y, '700 ' + fs + 'px Cinzel,Georgia,serif', on ? '#f3e7c4' : 'rgba(243,231,196,.62)'); const b = band(r); if (b) halo(c, b, s.x, s.y + fs * 1.05, '600 ' + Math.round(fs * .8) + 'px Cinzel,Georgia,serif', on ? '#e3b661' : 'rgba(227,182,97,.65)'); }
    // POIs: unfound faint dots, found icons with names
    const nameZ = z >= .75, fs2 = Math.round(11 * R.clamp(z, .9, 1.4));
    for (const p of pois()) { const s = toS(p.x, p.y); if (s.x < -40 || s.y < -40 || s.x > vw + 40 || s.y > vh + 40) continue; const kind = p.kind || p.type || 'town';
      if (!found(p.id)) { c.beginPath(); c.arc(s.x, s.y, kind === 'castle' ? 3.2 : 2.4, 0, 7); c.fillStyle = 'rgba(255,255,255,.38)'; c.fill(); continue; }
      const sz = (kind === 'castle' ? 9 : 7.5) * R.clamp(z, .8, 1.5); icon(c, p, s.x, s.y, sz);
      if (nameZ || kind === 'castle') { const nm = (p.name || p.n || p.id) + '', f2 = '600 ' + fs2 + 'px Cinzel,Georgia,serif'; c.font = f2; const w2 = c.measureText(nm).width + 6;
        let ly = s.y + sz * 1.5 + fs2 * .6; if (hits(s.x, ly, w2, fs2 + 4)) ly = s.y - sz * 1.5 - fs2 * .6; if (!hits(s.x, ly, w2, fs2 + 4)) halo(c, nm, s.x, ly, f2, '#f3e7c4'); } }
    // quest markers, gold
    for (const m of qmarks()) { const s = toS(m.x, m.y), sz = 7 * R.clamp(z, .9, 1.4); c.save(); c.translate(s.x, s.y); c.rotate(Math.PI / 4); c.fillStyle = '#e3b661'; c.strokeStyle = 'rgba(5,9,18,.9)'; c.lineWidth = 1.5; c.beginPath(); c.rect(-sz, -sz, sz * 2, sz * 2); c.fill(); c.stroke(); c.restore(); halo(c, '!', s.x, s.y + 0.5, '900 ' + Math.round(sz * 1.6) + 'px Georgia,serif', '#2a1d05'); c.lineWidth = 1; }
    // active events, red
    for (const e of events()) { const s = toS(e.x, e.y), rr = 11 * R.clamp(z, .9, 1.4); c.beginPath(); c.arc(s.x, s.y, rr, 0, 7); c.lineWidth = 2.5; c.strokeStyle = '#e14b4b'; c.stroke(); c.beginPath(); c.arc(s.x, s.y, rr * .35, 0, 7); c.fillStyle = '#e14b4b'; c.fill(); if (e.name || e.n) halo(c, (e.name || e.n) + '', s.x, s.y - rr - 8, '700 ' + fs2 + 'px Cinzel,Georgia,serif', '#ff8a8a'); }
    // other players, small cyan dots
    for (const p of players()) { const s = toS(p.x, p.y); c.beginPath(); c.arc(s.x, s.y, 4, 0, 7); c.fillStyle = '#58d7e8'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(5,9,18,.9)'; c.stroke(); }
    c.restore(); placeYou(); };
  /* ---- DOM pieces: the player's arrow (CSS pulse, no canvas redraw), a name tag, the bottom card ---- */
  const placeYou = () => { if (!you) return; const pl = R.player; if (!pl) { you.style.display = 'none'; return; } const s = toS(pl.x, pl.y); you.style.display = ''; const a = (pl.vx || pl.vy) ? Math.atan2(pl.vy, pl.vx) + Math.PI / 2 : 0; you.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) rotate(' + a.toFixed(3) + 'rad)'; };
  const hideTag = () => { if (tag) { tag.remove(); tag = null; } clearTimeout(tagT); };
  const showTag = (txt, sx, sy) => { hideTag(); tag = document.createElement('div'); tag.className = 'mp-tag'; tag.textContent = txt; tag.style.left = sx + 'px'; tag.style.top = sy + 'px'; root.appendChild(tag); tagT = setTimeout(hideTag, 2500); };
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const walk = d => { const s = Math.round(d / WALK); return s < 60 ? s + ' s on foot' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s on foot'; };
  const closeCard = () => { if (card) { card.remove(); card = null; } };
  const openCard = p => { closeCard(); const kind = p.kind || p.type || 'town', H = house(p.house), name = (p.name || p.n || p.id) + '';
    card = document.createElement('div'); card.className = 'mp-card'; card.dataset.poi = p.id;
    const kTxt = (KIND[kind] || kind) + (H ? ' · House ' + (H.n || H.name || p.house) : p.region ? ' · ' + (p.region + '').replace(/[_-]/g, ' ') : '');
    const d = R.player ? Math.hypot(R.player.x - p.x, R.player.y - p.y) : null;
    card.innerHTML = '<button class="mp-cx" aria-label="Close">✕</button><div class="k"></div><h3></h3><p></p><div class="d"></div>';
    card.querySelector('.k').textContent = kTxt; card.querySelector('h3').textContent = name; card.querySelector('p').textContent = p.blurb || p.desc || p.text || BLURB[kind] || '';
    card.querySelector('.d').textContent = d == null ? '' : d < 60 ? 'You are here' : fmt(d) + ' away · ' + walk(d);
    if (TRAVEL[kind]) { const b = document.createElement('button'); b.className = 'pri mp-go'; b.textContent = 'FAST TRAVEL (free)'; if (d != null && d < 60) b.disabled = true; b.addEventListener('click', () => travel(p)); card.appendChild(b); }
    card.querySelector('.mp-cx').addEventListener('click', closeCard); root.appendChild(card); };
  const travel = p => { const pl = R.player; if (!pl) { R.ui.toast('No one to move yet'); return; } let x = p.x, y = p.y + 36; if (R.world && typeof R.world.blocked === 'function') { try { if (R.world.blocked(x, y)) { x = p.x; y = p.y; } } catch (e) {} }
    pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0; if (pl.ai) pl.ai.target = null; R.cam.x = x; R.cam.y = y;
    R.bus.emit('travel', p); if (R.save) R.save(); if (R.sfx && R.sfx.play) { try { R.sfx.play('ui', .6); } catch (e) {} }
    try { const tg = window.Telegram && Telegram.WebApp; if (tg && tg.HapticFeedback && R.state && R.state.opts && R.state.opts.haptic) tg.HapticFeedback.impactOccurred('medium'); } catch (e) {}
    R.ui.close(); R.ui.toast('Fast travel: ' + (p.name || p.n || p.id), '#f3e7c4'); };
  /* ---- hit test + taps ---- */
  const hit = (sx, sy) => { let best = null, bd = TAP_PX * TAP_PX; for (const p of pois()) { const s = toS(p.x, p.y), d = (s.x - sx) ** 2 + (s.y - sy) ** 2; if (d < bd) { bd = d; best = { type: 'poi', p }; } }
    if (best) return best; bd = 20 * 20; for (const p of players()) { const s = toS(p.x, p.y), d = (s.x - sx) ** 2 + (s.y - sy) ** 2; if (d < bd) { bd = d; best = { type: 'player', p }; } }
    if (best) return best; for (const m of qmarks()) { const s = toS(m.x, m.y), d = (s.x - sx) ** 2 + (s.y - sy) ** 2; if (d < bd) { bd = d; best = { type: 'quest', p: m }; } } return best; };
  const onTap = (sx, sy) => { const h = hit(sx, sy); hideTag(); if (!h) { closeCard(); return; }
    if (h.type === 'poi') { if (found(h.p.id)) openCard(h.p); else { closeCard(); R.ui.toast('Not yet discovered'); } }
    else if (h.type === 'player') { const s = toS(h.p.x, h.p.y); showTag((h.p.name || h.p.n || 'Player') + (h.p.lvl ? ' · Lv ' + h.p.lvl : ''), s.x, s.y - 6); }
    else if (h.type === 'quest') { const s = toS(h.p.x, h.p.y); showTag(h.p.name || h.p.title || h.p.txt || 'Quest', s.x, s.y - 8); } };
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const down = e => { if (e.button != null && e.button > 0) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} const p = pos(e); ptrs.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y });
    if (ptrs.size === 1) { moved = 0; pinched = false; pinch = null; } else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; pinch = { d: dist2(a, b) || 1, z: view.z, w: toW(mid.x, mid.y) }; pinched = true; closeCard(); hideTag(); } };
  const move = e => { const q = ptrs.get(e.pointerId); if (!q) return; e.preventDefault(); const p = pos(e); const dx = p.x - q.x, dy = p.y - q.y; q.x = p.x; q.y = p.y;
    if (ptrs.size === 1 && !pinch) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 3) { view.cx -= dx / k(); view.cy -= dy / k(); clampView(); redraw(); if (card && moved > 30) closeCard(); } }
    else if (ptrs.size >= 2 && pinch) { const [a, b] = [...ptrs.values()]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; view.z = R.clamp(pinch.z * dist2(a, b) / pinch.d, MINZ, MAXZ); const kk = k(); view.cx = pinch.w.x - (mid.x - vw / 2) / kk; view.cy = pinch.w.y - (mid.y - vh / 2) / kk; clampView(); redraw(); } };
  const up = e => { const q = ptrs.get(e.pointerId); if (!q) return; ptrs.delete(e.pointerId); if (ptrs.size) { if (ptrs.size === 1) { pinch = null; moved = 99; } return; }
    const p = pos(e); if (pinched || moved > 8) return; const now = Date.now();
    if (now - lastTap < 320 && lastTapAt && dist2(lastTapAt, p) < 40) { lastTap = 0; lastTapAt = null; closeCard(); hideTag(); zoomAt(p.x, p.y, view.z >= 2.5 ? 1 : Math.min(MAXZ, view.z * 2)); return; }
    lastTap = now; lastTapAt = p; onTap(p.x, p.y); };
  const wheel = e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); };
  /* ---- the screen ---- */
  S.open = (arg, el) => { root = el || document.getElementById('screen'); root.classList.add('mp');
    root.innerHTML = '<canvas class="mp-cv"></canvas><div class="mp-you"><b></b><i></i></div>' +
      '<div class="mp-top"><div class="mp-title">WESTEROS <small class="mp-z"></small></div><button class="mp-x" aria-label="Close map">✕</button></div>' +
      '<button class="mp-me" aria-label="Centre on me">◎</button>' +
      '<div class="mp-legend"><span><i class="l-you"></i>you</span><span><i class="l-castle"></i>castle</span><span><i class="l-quest"></i>quest</span><span><i class="l-players"></i>players</span><span><i class="l-event"></i>event</span></div>';
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d'); you = root.querySelector('.mp-you'); card = null; tag = null; ptrs.clear(); pinch = null; pinched = false; moved = 0; lastTap = 0; S.draws = 0;
    root.querySelector('.mp-x').addEventListener('click', () => R.ui.close());
    root.querySelector('.mp-me').addEventListener('click', () => { if (R.player) centreOn(R.player.x, R.player.y); });
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', size);
    view.z = 1; const at = arg && num(arg.x) && num(arg.y) ? arg : R.player || { x: R.W / 2, y: R.H / 2 }; view.cx = at.x; view.cy = at.y; size();
    const RG = regions(); root.querySelector('.mp-z').textContent = (RG.length ? RG.filter(r => entered(r.id)).length + '/' + RG.length + ' regions · ' : '') + ((P().found || []).length) + ((P().found || []).length === 1 ? ' place found' : ' places found'); };
  S.close = () => { window.removeEventListener('resize', size); if (raf) cancelAnimationFrame(raf); raf = 0; hideTag(); closeCard(); if (root) { root.classList.remove('mp'); root.innerHTML = ''; } cv = null; ctx = null; you = null; ptrs.clear(); };
  /* ---- test hooks ---- */
  S.view = () => ({ cx: view.cx, cy: view.cy, z: view.z, k: k(), vw, vh }); S.toScreen = (x, y) => toS(x, y); S.toWorld = (x, y) => toW(x, y); S.redraw = redraw; S.hit = hit; S.zoomAt = zoomAt; S.centreOn = centreOn; S.travel = travel; S.canvas = () => cv;
  S.pan = (dx, dy) => { view.cx -= dx / k(); view.cy -= dy / k(); clampView(); redraw(); };
  // the top-row MAP button, the minimap tap and the M key all emit 'btn' 'map': open the map, or close it when it is open
  if (R.bus && R.bus.on) R.bus.on('btn', n => { if (n !== 'map') return; if (R.ui.cur === 'map') R.ui.close(); else if (R.state && R.player) R.ui.open('map'); });
  if (R.bus && R.bus.on) { R.bus.on('poi', () => { if (R.ui.cur === 'map') redraw(); }); R.bus.on('enter', () => { if (R.ui.cur === 'map') redraw(); }); }
})();
