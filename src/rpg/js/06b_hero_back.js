/* HOLDOR RPG — 06b_hero_back.js (H1): the hero seen from BEHIND, painted in code, for the third-person camera.
   R.draw.heroBack(anim, t, o) → a cached transparent canvas, the figure about as tall as R.draw.heroFrame's at the same o.scale,
     c.meta = {ax, ay (the feet point in canvas px), w, h (the figure's box), sc, lift: 0, face, back: true, anim, fi}.
     anim: idle | walk | run | attack | hurt | die | dodge (anything else → idle); t = seconds into the anim.
     o: {hero (champion id, default R.state.p.hero), cls (knight | ranger | maester, default the champion's), house, face ±1 (a slight
        3/4 turn toward that side), lean −1..1 (turning: the body banks, the cloak swings out), speed 0..1 (cloak flare), cloak (sway
        angle in radians; else R.phys.cloak(R.player) when that exists; else derived from speed / lean / the step), gear {weapon, armor}
        (default R.state.p.gear), scale (as R.draw.heroFrame), px (figure height in px, overrides scale), keyOnly}.
   R.draw.heroBackKey(anim, t, o) → the cache key (t quantised: walk / run 8 phases, idle 4, attack 4, dodge 4, die 4, hurt 2).
   Original figures (no likeness of any actor or known character): knight = back plate, pauldrons, long cloak, sword in hand;
   ranger = hood, short cloak, quiver with fletching, bow; maester = robe, chain at the nape, mantle, staff. House colours from
   R.data.houses[h].col / col2, one simple painted sigil shape per house on the cloak; the hair colour is sampled from the champion's
   own sheet (top of the head) when its art is loaded. Light from the upper left, a cool rim on the right, darker undersides.
   Frames live in an own LRU (≤ 320 canvases). */
(function () {
  const R = window.R = window.R || {};
  const D = R.draw = R.draw || {};
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  /* ---- colour ---- */
  const hx = c => { let s = String(c || '#888').replace('#', ''); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; const n = parseInt(s, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const h2 = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  const mix = (a, b, k) => { const A = hx(a), B = hx(b); return '#' + h2(A[0] + (B[0] - A[0]) * k) + h2(A[1] + (B[1] - A[1]) * k) + h2(A[2] + (B[2] - A[2]) * k); };
  const lum = c => { const A = hx(c); return (0.2126 * A[0] + 0.7152 * A[1] + 0.0722 * A[2]) / 255; };
  const rgba = (c, a) => { const A = hx(c); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a + ')'; };
  const mute = (c, k) => { const A = hx(c), m = (A[0] + A[1] + A[2]) / 3; return '#' + h2(A[0] + (m - A[0]) * k) + h2(A[1] + (m - A[1]) * k) + h2(A[2] + (m - A[2]) * k); };
  const LIGHT = '#fff4e0', DARK = '#0c0a10', RIM = '#cfe2ff', OUT = 'rgba(18,13,10,.62)';
  const RAR = ['#b9bcc2', '#5fcf6a', '#4f9bff', '#b56cff', '#f5b84a'];
  const FB = { stark: { col: '#a9bdd0', col2: '#3b4a5a' }, lannister: { col: '#e3b661', col2: '#7a1d1d' }, baratheon: { col: '#e0c14a', col2: '#23231f' },
    targaryen: { col: '#e14b4b', col2: '#1c1c1c' }, greyjoy: { col: '#d8b74a', col2: '#1f2a30' }, tyrell: { col: '#7fd06a', col2: '#2f5a2a' }, martell: { col: '#f08a3c', col2: '#7a2a1a' } };
  const houseOf = h => (R.data && R.data.houses && R.data.houses[h]) || FB[h] || FB.stark;
  const CLS = { knight: 1, ranger: 1, maester: 1 };
  const N = { idle: 4, walk: 8, run: 8, attack: 4, hurt: 2, die: 4, dodge: 4 };
  const DUR = { idle: 1.6, walk: 0.8, run: 0.56, attack: 0.3, hurt: 0.3, die: 0.8, dodge: 0.35 };
  const CYC = { idle: 1, walk: 1, run: 1 };
  D.heroBackN = N; D.heroBackDur = DUR;

  /* ---- the palette of one (cls, house, armour rarity, hair) ---- */
  function palette(cls, house, arar, wrar, hair) {
    const hs = houseOf(house), c1 = hs.col || '#a9bdd0', c2 = hs.col2 || '#3b4a5a';
    const dk = lum(c1) < lum(c2) ? c1 : c2, lt = dk === c1 ? c2 : c1;
    let cloak = mute(dk, 0.28); if (lum(cloak) < 0.09) cloak = mix(cloak, mute(lt, 0.4), 0.26); if (lum(cloak) > 0.42) cloak = mix(cloak, '#2a2622', 0.35);
    const sig = mute(mix(lt, '#f2e8d4', 0.12), 0.18);
    const trim = arar > 0 ? mix('#b08a4a', RAR[arar], 0.55) : '#a8875a';
    return { cloak, cloakSh: mix(cloak, DARK, 0.55), lining: mix(cloak, DARK, 0.35), sig, trim, house: mute(lt, 0.3),
      steel: '#9aa3ab', steelDk: '#4c545d', metal: wrar > 0 ? mix('#c9d0d6', RAR[wrar], 0.35) : '#c9d0d6',
      leather: '#6b4a2e', leatherDk: '#3e2a19', cloth: cls === 'ranger' ? '#4f5a3f' : '#4a4640', boot: '#3a2a1d',
      robe: '#7f7c76', robeDk: '#4d4b47', skin: '#d6a882', hair: hair || '#4a3626', wood: '#7a5230', woodDk: '#4a311b', glow: wrar > 0 ? RAR[wrar] : '#9fd8ff' };
  }
  /* ---- hair: the champion sheet's topmost opaque pixels (cached once the art is loaded) ---- */
  const HAIR = {};
  function hairOf(id) {
    if (!id) return null; if (HAIR[id] !== undefined) return HAIR[id];
    let im = null; try { if (!D.forceNoArt) { im = R.assets && R.assets.champ && R.assets.champ[id]; if (!im && typeof A_CHAMP !== 'undefined' && A_CHAMP && A_CHAMP.art && A_CHAMP.art[id]) { im = new Image(); im.src = A_CHAMP.art[id]; HAIR['im:' + id] = HAIR['im:' + id] || im; im = HAIR['im:' + id]; } } } catch (e) { im = null; }
    if (!im || !(im.naturalWidth > 0) || im.complete === false) return null;
    try {
      const w = 64, h = 64, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data; let top = -1;
      for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 200) { top = y; break; }
      if (top < 0) return (HAIR[id] = null);
      let r = 0, gg = 0, b = 0, n = 0;
      for (let y = top + 1; y < Math.min(h, top + 6); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 220) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
      if (!n) return (HAIR[id] = null);
      let col = '#' + h2(r / n) + h2(gg / n) + h2(b / n); col = mute(col, 0.25); if (lum(col) > 0.78) col = mix(col, '#8a8070', 0.3);
      return (HAIR[id] = col);
    } catch (e) { return (HAIR[id] = null); }
  }
  /* ---- gear ---- */
  const famOf = (cls, w) => { if (!w) return cls === 'ranger' ? 'bow' : cls === 'maester' ? 'staff' : 'sword'; if (w.fam) return w.fam; const n = String(w.name || '') + (w.icon || '');
    if (cls === 'knight') return /axe|hatchet|🪓/i.test(n) ? 'axe' : /mace|hammer|maul|flail|club|🔨/i.test(n) ? 'mace' : 'sword';
    if (cls === 'ranger') return /crossbow/i.test(n) ? 'xbow' : /dagger|knife|knives|dirk|🗡/i.test(n) ? 'dagger' : 'bow';
    return /tome|book|grimoire|📖/i.test(n) ? 'tome' : /rod|scept|wand/i.test(n) ? 'rod' : 'staff'; };
  /* the champion sheet's box at scale 1 (so the back figure stands as tall as R.draw.heroFrame's) */
  function boxOf(id) {
    let art = false; try { if (!D.forceNoArt && id) { const im = R.assets && R.assets.champ && R.assets.champ[id]; art = !!(im && im.naturalWidth > 0) || !!(typeof A_CHAMP !== 'undefined' && A_CHAMP && A_CHAMP.art && A_CHAMP.art[id]); } } catch (e) {}
    if (!art) return 150; let m = null; try { m = A_CHAMP && A_CHAMP.meta && A_CHAMP.meta[id]; } catch (e) {} return (m && m.h) || 214;
  }

  /* ---- options → the frame's identity ---- */
  function resolve(anim, t, o) {
    o = o || {}; const st = R.state || {}, p = st.p || {};
    const id = o.hero !== undefined ? o.hero : (p.hero || null);
    let ch = null; try { ch = id && R.champs && R.champs.get ? R.champs.get(id) : null; } catch (e) {}
    let cls = o.cls || (ch && ch.cls) || (id && R.champs && R.champs.cls ? R.champs.cls(id) : null) || p.cls || 'knight'; if (!CLS[cls]) cls = 'knight';
    const house = o.house || (ch && ch.house) || (st.acc && st.acc.house) || p.house || 'stark';
    if (!N[anim]) anim = 'idle';
    const n = N[anim], tt = +t || 0; let fi;
    if (CYC[anim]) { fi = Math.floor(tt / DUR[anim] * n) % n; if (fi < 0) fi += n; } else fi = clamp(Math.floor(Math.max(0, tt) / DUR[anim] * n), 0, n - 1);
    const face = o.face < 0 ? -1 : 1, lean = Math.round(clamp(+o.lean || 0, -1, 1) * 2) / 2;
    const speed = clamp(o.speed != null ? +o.speed || 0 : anim === 'run' ? 1 : anim === 'walk' ? 0.5 : 0, 0, 1), spQ = Math.round(speed * 2) / 2;
    let cloak = o.cloak; if (cloak == null && R.phys && typeof R.phys.cloak === 'function' && R.player) { try { cloak = R.phys.cloak(R.player); } catch (e) { cloak = null; } }
    if (cloak && typeof cloak === 'object') cloak = cloak.a != null ? cloak.a : cloak.angle;
    const clQ = typeof cloak === 'number' && isFinite(cloak) ? Math.round(clamp(cloak, -0.8, 0.8) * 5) / 5 : null;
    const gear = o.gear || p.gear || {}, wp = gear.weapon || null, ar = gear.armor || null;
    const fam = famOf(cls, wp), wrar = wp ? clamp(wp.rar | 0, 0, 4) : 0, arar = ar ? clamp(ar.rar | 0, 0, 4) : 0;
    const box = boxOf(id), pxH = Math.max(16, Math.round(o.px || box * (o.scale || 1)));
    const hair = hairOf(id) || '';
    const key = 'HB|' + (id || '-') + '|' + cls + '|' + house + '|' + anim + '|' + fi + '|' + face + '|' + lean + '|' + (clQ == null ? 'd' : clQ) + '|' + spQ + '|' + fam + wrar + arar + '|' + pxH + '|' + hair;
    return { key, id, cls, house, anim, fi, n, face, lean, speed: spQ, cloak: clQ, fam, wrar, arar, pxH, sc: pxH / box, hair };
  }

  /* ---- LRU ---- */
  const CACHE = new Map(), MAX = 320;
  const cget = k => { const v = CACHE.get(k); if (v) { CACHE.delete(k); CACHE.set(k, v); } return v; };
  const cset = (k, v) => { CACHE.set(k, v); while (CACHE.size > MAX) CACHE.delete(CACHE.keys().next().value); return v; };
  D.heroBackCacheSize = () => CACHE.size; D.heroBackClear = () => { CACHE.clear(); for (const k in HAIR) delete HAIR[k]; };

  /* ---- painting primitives (unit space: 100 units = the figure, feet at 0, y up negative) ---- */
  let g = null, flash = 0, flashCol = '#ffffff';
  const C = c => flash > 0 ? mix(c, flashCol, flash) : c;
  /* fill a path with the upper-left light, a highlight band along its lit edge, a cool rim on the right, a soft dark outline */
  function paint(path, base, bb, o) {
    o = o || {}; const hi = o.hi == null ? 0.28 : o.hi, sh = o.sh == null ? 0.5 : o.sh;
    const gr = g.createLinearGradient(bb[0], bb[1], bb[2], bb[3]);
    gr.addColorStop(0, C(mix(base, LIGHT, hi))); gr.addColorStop(0.45, C(base)); gr.addColorStop(1, C(mix(base, DARK, sh)));
    g.beginPath(); path(); g.fillStyle = gr; g.fill();
    if (o.band !== false || o.rim !== false) {
      g.save(); g.beginPath(); path(); g.clip();
      if (o.band !== false) { g.translate(1.1, 1.1); g.beginPath(); path(); g.lineWidth = 1.6; g.strokeStyle = rgba(LIGHT, o.bandA || 0.2); g.stroke(); g.translate(-1.1, -1.1); }
      if (o.rim !== false) { g.translate(-1.2, -0.3); g.beginPath(); path(); g.lineWidth = 1.1; g.strokeStyle = rgba(RIM, o.rimA || 0.3); g.stroke(); g.translate(1.2, 0.3); }
      if (o.under) { const ug = g.createLinearGradient(0, bb[3] - (bb[3] - bb[1]) * 0.35, 0, bb[3]); ug.addColorStop(0, 'rgba(0,0,0,0)'); ug.addColorStop(1, 'rgba(8,6,10,' + o.under + ')'); g.fillStyle = ug; g.fillRect(bb[0] - 2, bb[1], bb[2] - bb[0] + 4, bb[3] - bb[1] + 2); }
      g.restore();
    }
    if (o.out !== false) { g.beginPath(); path(); g.lineWidth = o.lw || 0.8; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(); }
  }
  /* a tapered limb segment a→b (widths wa, wb) as a path builder */
  const capsule = (ax, ay, bx, by, wa, wb) => () => { const a = Math.atan2(by - ay, bx - ax); g.arc(ax, ay, wa, a + Math.PI / 2, a - Math.PI / 2); g.arc(bx, by, wb, a - Math.PI / 2, a + Math.PI / 2); g.closePath(); };
  const bbOf = (pts, pad) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); } pad = pad || 0; return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; };
  function limb(ax, ay, bx, by, wa, wb, col, o) { paint(capsule(ax, ay, bx, by, wa, wb), col, bbOf([ax, ay, bx, by], Math.max(wa, wb)), o); }
  function stroke(pts, w, col, a) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = w; g.strokeStyle = a == null ? C(col) : rgba(C(col), a); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
  function curve(x0, y0, cx, cy, x1, y1, w, col, a) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.lineWidth = w; g.strokeStyle = a == null ? C(col) : rgba(C(col), a); g.lineCap = 'round'; g.stroke(); }
  function disc(x, y, r, col, o) { paint(() => g.arc(x, y, r, 0, TAU), col, [x - r, y - r, x + r, y + r], o); }

  /* ---- poses: one set of joint parameters per (cls, anim, phase) ---- */
  function pose(cls, anim, k, sp, lean, fam) {
    const P = { bob: 0, hipX: 0, crouch: 0, fwd: 0, tilt: 0, twist: 0, hunch: 0, sy: 1, rot: 0, dy: 0, flash: 0,
      leg: [{ f: 0, l: 0 }, { f: 0, l: 0 }], arm: [{ sw: 0, ex: 0, ey: 0, hx: 0, hy: 0, set: null }, { sw: 0, set: null }], sway: 0, flare: 0, w: null, trail: null, glow: 0, headDn: 0, prone: 0 };
    const ph = k * TAU;
    if (anim === 'walk' || anim === 'run') {
      const run = anim === 'run', A = run ? 1.25 : 1, s = Math.sin(ph), c = Math.cos(ph);
      P.leg[0] = { f: s * A, l: Math.max(0, c) * (run ? 1.5 : 1) }; P.leg[1] = { f: -s * A, l: Math.max(0, -c) * (run ? 1.5 : 1) };
      P.arm[0].sw = -s * (run ? 1.1 : 0.8); P.arm[1].sw = s * (run ? 1.1 : 0.8); P.arm[0].bend = P.arm[1].bend = run ? 1 : 0.25;
      P.bob = -(run ? 2.4 : 1.3) * Math.cos(2 * ph); P.hipX = (run ? 1.0 : 1.5) * c; P.tilt = 0.025 * c; P.twist = 0.5 * s;
      P.fwd = run ? 0.55 : 0.12; P.sway = 0.07 * Math.sin(ph - 0.9) * (run ? 1.4 : 1); P.flare = (run ? 0.7 : 0.18) + (run ? 0.2 : 0.08) * Math.sin(2 * ph - 1.1) + sp * 0.15;
    } else if (anim === 'idle') {
      const b = Math.sin(ph); P.bob = -0.6 * b; P.hunch = -0.4 * b; P.sway = 0.035 * Math.sin(ph + 1.2); P.arm[0].sw = 0.05 * b; P.arm[1].sw = -0.05 * b; P.flare = 0.02;
    } else if (anim === 'attack') {
      const i = Math.min(3, Math.floor(k * 4));
      if (cls === 'ranger' && (fam === 'bow' || fam === 'xbow')) {
        P.arm[0].set = [[-15, -88], [-12, -96]]; P.twist = -0.6; P.tilt = -0.03;
        P.arm[1].set = i === 0 ? [[20, -80], [8, -93]] : i === 1 ? [[25, -86], [13, -91]] : i === 2 ? [[26, -84], [24, -90]] : [[20, -74], [16, -68]];
        P.w = { kind: 'bowup', pull: i === 1 ? 1 : i === 0 ? 0.55 : 0, rel: i === 2 }; P.fwd = 0.1; P.sway = i === 2 ? 0.08 : 0.02;
      } else if (cls === 'maester' && fam !== 'tome') {
        P.arm[1].set = i === 0 ? [[22, -88], [16, -101]] : i === 1 ? [[18, -92], [8, -106]] : i === 2 ? [[16, -90], [4, -101]] : [[19, -70], [18, -56]];
        P.arm[0].set = i === 1 || i === 2 ? [[-20, -80], [-17, -94]] : null; P.w = { kind: 'staffup', a: [-1.45, -1.75, -2.05, -1.62][i] }; P.glow = i === 1 ? 0.7 : i === 2 ? 1 : 0.2;
        P.twist = i === 2 ? 0.3 : 0.15; P.fwd = i === 2 ? 0.25 : 0.08; P.sway = 0.04 * (i - 1.5);
      } else if (fam === 'tome') {
        P.arm[0].set = [[-19, -74], [-10, -76]]; P.arm[1].set = i < 3 ? [[21, -82], [18 - i * 2, -96 + i * 2]] : [[19, -70], [18, -56]]; P.glow = i === 1 ? 0.8 : i === 2 ? 1 : 0.2; P.w = { kind: 'tome' };
      } else {
        /* the swing over the shoulder: wind-up behind the right shoulder → up over the head → down across to the front-left → follow-through */
        const W = [
          { a: [[22, -84], [15, -98]], w: 2.3, lay: 'front', tw: 0.9, tl: -0.06 },
          { a: [[19, -97], [8, -114]], w: -1.45, lay: 'front', tw: 0.4, tl: 0.02, tr: [Math.PI * 0.55, Math.PI * 1.45] },
          { a: [[8, -88], [-8, -86]], w: -2.65, lay: 'back', tw: -0.7, tl: 0.07, tr: [Math.PI * 1.15, Math.PI * 1.95], fwd: 0.35 },
          { a: [[4, -72], [-12, -58]], w: 2.45, lay: 'back', tw: -0.9, tl: 0.05, tr: [Math.PI * 1.5, Math.PI * 2.1], fwd: 0.25, fade: 1 }][i];
        P.arm[1].set = W.a; P.w = { kind: 'held', a: W.w, lay: W.lay }; P.twist = W.tw; P.tilt = W.tl; P.fwd = W.fwd || 0.05; if (W.tr) P.trail = { a0: W.tr[0], a1: W.tr[1], fade: W.fade ? 0.5 : 1 };
        P.arm[0].sw = i >= 2 ? -0.6 : 0.3; P.sway = [-0.05, -0.02, 0.1, 0.14][i]; P.flare = i >= 2 ? 0.3 : 0.1; P.leg[0].f = 0.3; P.leg[1].f = -0.25;
      }
    } else if (anim === 'hurt') {
      const a = k < 0.5 ? 1 : 0.35; P.hunch = 2.6 * a; P.headDn = 2.2 * a; P.tilt = -0.07 * a; P.hipX = -1.5 * a; P.dy = 1.4 * a; P.flash = 0.28 * a; P.arm[0].sw = -0.35 * a; P.arm[1].sw = -0.35 * a; P.crouch = 0.12 * a; P.sway = 0.1 * a; P.flare = 0.25 * a;
    } else if (anim === 'dodge') {
      const i = Math.min(3, Math.floor(k * 4));
      P.crouch = [0.4, 0.7, 0.72, 0.3][i]; P.sy = [0.9, 0.72, 0.74, 0.9][i]; P.rot = [0.05, 0.22, 0.4, 0.08][i] * (lean < 0 ? -1 : 1); P.fwd = [0.4, 0.9, 0.9, 0.3][i];
      P.headDn = [2, 5, 5, 1][i]; P.arm[0].sw = 0.6; P.arm[1].sw = 0.6; P.arm[0].bend = P.arm[1].bend = 1; P.flare = [0.3, 0.5, 0.55, 0.35][i]; P.sway = [0.1, 0.25, 0.3, 0.12][i] * (lean < 0 ? 1 : -1);
      P.leg[0] = { f: 0.4, l: i === 1 || i === 2 ? 0.8 : 0.2 }; P.leg[1] = { f: -0.2, l: i === 1 || i === 2 ? 0.6 : 0 };
    } else if (anim === 'die') {
      const i = Math.min(3, Math.floor(k * 4));
      P.crouch = [0.3, 0.35, 0.2, 0][i]; P.sy = [1, 0.74, 0.5, 0.34][i]; P.fwd = [0.4, 0.8, 1, 1][i]; P.headDn = [3, 4, 3, 2][i]; P.tilt = [0.04, 0.06, 0.05, 0.03][i];
      P.arm[0].sw = [0.3, 0.6, 0.9, 1][i]; P.arm[1].sw = [0.3, 0.6, 0.9, 1][i]; P.arm[0].spread = P.arm[1].spread = [0, 0.3, 0.7, 1][i]; P.sway = [0.04, 0.08, 0.1, 0.06][i]; P.flare = [0.1, 0.3, 0.5, 0.35][i]; P.prone = i / 3;
      P.flash = i === 0 ? 0.25 : 0; P.dropped = i >= 2;
    }
    return P;
  }

  /* ---- sigils: one simple original shape per house, centred at 0,0, size ~1 = 10 units ---- */
  const SIG = {
    stark(c) { // a wolf's head: a long muzzle, two tall ears
      sh(() => { g.moveTo(0, 5.2); g.lineTo(-2.2, 1.6); g.lineTo(-4.4, -0.8); g.lineTo(-4.6, -5.4); g.lineTo(-2.2, -2.8); g.lineTo(0, -3.6); g.lineTo(2.2, -2.8); g.lineTo(4.6, -5.4); g.lineTo(4.4, -0.8); g.lineTo(2.2, 1.6); g.closePath(); }, c); },
    lannister(c) { // a maned head: a ring of points around a round face
      sh(() => { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = i % 2 ? 3.6 : 5.4; i ? g.lineTo(Math.sin(a) * r, -Math.cos(a) * r) : g.moveTo(0, -r); } g.closePath(); }, c);
      sh(() => { g.ellipse(0, 0.4, 2.4, 2.8, 0, 0, TAU); }, mix(c, '#000', 0.35)); },
    baratheon(c) { // antlers over a narrow head
      sh(() => { g.moveTo(-1.2, -0.5); g.lineTo(1.2, -0.5); g.lineTo(0.7, 4.6); g.lineTo(-0.7, 4.6); g.closePath(); }, c);
      for (const s of [-1, 1]) { stroke([s * 1, -0.6, s * 3.2, -3.2, s * 3.6, -5.6], 1.1, c); stroke([s * 3.0, -3.0, s * 5.2, -3.6], 0.9, c); stroke([s * 2.2, -1.9, s * 1.6, -4.4], 0.9, c); } },
    targaryen(c) { // a spread wing with three spines
      sh(() => { g.moveTo(-4.8, 4.4); g.quadraticCurveTo(-3.6, -2.6, 5.4, -5.6); g.lineTo(3.8, -2.2); g.quadraticCurveTo(3.6, -0.4, 4.8, 1); g.quadraticCurveTo(2.4, 0.4, 2.2, 2.6); g.quadraticCurveTo(0.2, 1.6, -0.4, 4); g.quadraticCurveTo(-2.4, 3, -4.8, 4.4); g.closePath(); }, c);
      for (const q of [[-4.4, 4, 4.6, -4.6], [-4.4, 4, 3.4, 0.4], [-4.4, 4, 1.2, 2.4]]) stroke(q, 0.5, mix(c, '#000', 0.45), 0.7); },
    greyjoy(c) { // a round head trailing five curling arms
      sh(() => g.ellipse(0, -2.6, 2.8, 2.6, 0, 0, TAU), c);
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 1.5; curve(x * 0.6, -1, x * 1.6, 2, x * 1.2 + (i % 2 ? 1.4 : -1.4), 5.2, 0.9, c); } },
    tyrell(c) { // a five-petal flower with a dark heart
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; sh(() => g.ellipse(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 2.3, 1.7, a, 0, TAU), c); }
      sh(() => g.arc(0, 0, 1.4, 0, TAU), mix(c, '#000', 0.4)); },
    martell(c) { // a sun disc crossed by a spear
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; stroke([Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * 5, Math.sin(a) * 5], 0.9, c); }
      sh(() => g.arc(0, 0, 2.7, 0, TAU), c); stroke([-5.6, 5.6, 5.6, -5.6], 0.8, mix(c, '#000', 0.45)); }
  };
  function sh(path, col) { g.beginPath(); path(); g.fillStyle = C(col); g.fill(); }
  function sigil(house, x, y, s, rot, col, a) {
    const f = SIG[house]; g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s); g.globalAlpha *= a == null ? 0.88 : a;
    if (f) f(col); else sh(() => g.arc(0, 0, 4, 0, TAU), col);
    g.restore();
  }

  /* ---- weapons (hand at hx,hy, angle a in canvas radians: 0 = +x, −π/2 = up) ---- */
  function blade(hx0, hy0, a, L, pal, wide) {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, pt = (k, n) => [hx0 + dx * k + nx * n, hy0 + dy * k + ny * n];
    const wd = wide || 1.5;
    stroke([...pt(-4.5, 0), ...pt(1, 0)], 2.2, pal.leatherDk); disc(...pt(-5.2, 0), 1.4, pal.trim, { rim: false, band: false });
    stroke([...pt(1.4, -3.6), ...pt(1.4, 3.6)], 1.7, pal.trim);
    const P = [...pt(2, -wd), ...pt(L - 4, -wd * 0.8), ...pt(L, 0), ...pt(L - 4, wd * 0.8), ...pt(2, wd)];
    paint(() => { g.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) g.lineTo(P[i], P[i + 1]); g.closePath(); }, pal.metal, bbOf(P), { hi: 0.5, sh: 0.45, lw: 0.6 });
    stroke([...pt(3, 0), ...pt(L - 3, 0)], 0.5, '#ffffff', 0.45);
  }
  function weapon(fam, hx0, hy0, a, pal, P) {
    if (fam === 'sword') blade(hx0, hy0, a, 36, pal);
    else if (fam === 'dagger') blade(hx0, hy0, a, 15, pal, 1.2);
    else if (fam === 'axe' || fam === 'mace') {
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, L = 30, ex = hx0 + dx * L, ey = hy0 + dy * L;
      limb(hx0 - dx * 5, hy0 - dy * 5, ex, ey, 1.3, 1.2, pal.wood, { rim: false });
      if (fam === 'axe') { const Q = [ex - dx * 2 + nx * 1, ey - dy * 2 + ny * 1, ex - dx * 7 + nx * 7, ey - dy * 7 + ny * 7, ex + dx * 2 + nx * 8, ey + dy * 2 + ny * 8, ex + dx * 1 + nx * 1, ey + dy * 1 + ny * 1];
        paint(() => { g.moveTo(Q[0], Q[1]); g.lineTo(Q[2], Q[3]); g.quadraticCurveTo(ex + nx * 10, ey + ny * 10, Q[4], Q[5]); g.lineTo(Q[6], Q[7]); g.closePath(); }, pal.metal, bbOf(Q), { hi: 0.5 }); }
      else { disc(ex, ey, 4.2, pal.metal, { hi: 0.5 }); for (let i = 0; i < 6; i++) { const b = i / 6 * TAU; stroke([ex + Math.cos(b) * 3.6, ey + Math.sin(b) * 3.6, ex + Math.cos(b) * 6, ey + Math.sin(b) * 6], 1.3, pal.steelDk); } }
    } else if (fam === 'staff' || fam === 'rod') {
      const L = fam === 'staff' ? 70 : 30, B = fam === 'staff' ? 34 : 6, dx = Math.cos(a), dy = Math.sin(a);
      limb(hx0 - dx * B, hy0 - dy * B, hx0 + dx * L, hy0 + dy * L, 1.5, 1.7, pal.wood, { rim: false });
      const tx = hx0 + dx * (L + 2.5), ty = hy0 + dy * (L + 2.5);
      if (P.glow > 0) { const gr = g.createRadialGradient(tx, ty, 0, tx, ty, 9 + 7 * P.glow); gr.addColorStop(0, rgba(pal.glow, 0.85 * P.glow)); gr.addColorStop(1, rgba(pal.glow, 0)); g.fillStyle = gr; g.beginPath(); g.arc(tx, ty, 9 + 7 * P.glow, 0, TAU); g.fill(); }
      disc(tx, ty, 3.2, mix(pal.glow, '#ffffff', 0.25), { hi: 0.6, sh: 0.3 });
      stroke([tx - dx * 3.5 - dy * 3, ty - dy * 3.5 + dx * 3, tx - dx * 1, ty - dy * 1, tx - dx * 3.5 + dy * 3, ty - dy * 3.5 - dx * 3], 1.1, pal.woodDk);
    } else if (fam === 'tome') {
      paint(() => { g.rect(hx0 - 5, hy0 - 4, 10, 7.5); }, pal.leather, [hx0 - 5, hy0 - 4, hx0 + 5, hy0 + 3.5]);
      if (P.glow > 0) { const gr = g.createRadialGradient(hx0, hy0 - 8, 0, hx0, hy0 - 8, 12); gr.addColorStop(0, rgba(pal.glow, 0.8 * P.glow)); gr.addColorStop(1, rgba(pal.glow, 0)); g.fillStyle = gr; g.beginPath(); g.arc(hx0, hy0 - 8, 12, 0, TAU); g.fill(); }
    }
  }
  /* the bow held up ahead (seen from behind: the stave beside the head, the string pulled back toward us) */
  function bowUp(pal, lx, ly, rx, ry, pull, xb) {
    if (xb) { limb(lx - 1, ly + 1, rx, ry, 1.6, 1.5, pal.wood, { rim: false }); stroke([lx - 8, ly - 1, lx + 6, ly + 1], 1.8, pal.woodDk); return; }
    const top = [lx - 3, ly - 30], bot = [lx + 1, ly + 22];
    g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(lx - 9, ly - 4, bot[0], bot[1]); g.lineWidth = 2.6; g.strokeStyle = C(pal.woodDk); g.lineCap = 'round'; g.stroke();
    g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(lx - 9, ly - 4, bot[0], bot[1]); g.lineWidth = 1.3; g.strokeStyle = C(pal.wood); g.stroke();
    const sx = pull > 0 ? rx : lx + 0.5, sy = pull > 0 ? ry : ly - 4;
    stroke([top[0], top[1], sx, sy, bot[0], bot[1]], 0.55, '#ece4cf');
    if (pull > 0) { stroke([sx, sy, lx - 4, ly - 4], 0.9, pal.wood); sh(() => { g.moveTo(lx - 6, ly - 6); g.lineTo(lx - 2, ly - 4.5); g.lineTo(lx - 5.5, ly - 1.5); g.closePath(); }, pal.metal); }
  }
  function bowHang(pal, hx0, hy0) { // the bow carried low in the left hand
    const top = [hx0 + 2, hy0 - 26], bot = [hx0 + 3, hy0 + 22];
    g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(hx0 - 7, hy0, bot[0], bot[1]); g.lineWidth = 2.6; g.strokeStyle = C(pal.woodDk); g.lineCap = 'round'; g.stroke();
    g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(hx0 - 7, hy0, bot[0], bot[1]); g.lineWidth = 1.2; g.strokeStyle = C(pal.wood); g.stroke();
    stroke([top[0], top[1], bot[0], bot[1]], 0.5, '#ece4cf');
  }

  /* ---- the figure ---- */
  function figure(F, P, pal) {
    const cls = F.cls, knight = cls === 'knight', ranger = cls === 'ranger', maester = cls === 'maester';
    const cr = P.crouch * 15, hipY = -47 + cr + P.bob * 0.6, fw = P.fwd;
    const shY = -79 + cr + P.bob + P.hunch * -1 + fw * 5, headY = -90 + cr + P.bob + fw * 8 + P.headDn - P.hunch * 0.3;
    const turn = F.face * 2.2, hipX = P.hipX, shX = hipX * 0.4 + turn * 0.6;
    const twist = P.twist; /* + = the right shoulder comes back toward the camera: it drops a little and moves out */
    const shW = maester ? 12.6 : 13.2, shL = [-shW + shX + twist * 0.8, shY + twist * 1.0], shR = [shW + shX + twist * 1.2, shY - twist * 1.0];
    const sway = (F.cloak != null ? F.cloak : P.sway - F.lean * 0.32 - (F.lean ? 0 : 0)), flare = clamp(P.flare + (F.cloak == null ? Math.abs(F.lean) * 0.25 : 0) + F.speed * 0.1, 0, 1.2);
    /* legs */
    const legs = [0, 1].map(i => {
      const s = i ? 1 : -1, L = P.leg[i], hx0 = hipX + s * 6.2, hy0 = hipY;
      const fx = hipX * 0.25 + s * (5.4 + P.crouch * 3), fy = -L.f * 6.5 - L.l * 11;
      const kx = (hx0 + fx) / 2 + s * (P.crouch * 5 + L.l * 1.2), ky = (hy0 + fy) / 2 + L.l * 3 - P.crouch * 2;
      return { s, hx: hx0, hy: hy0, kx, ky, fx, fy, L, far: L.f > 0.15 };
    });
    const drawLeg = lg => {
      const k = lg.far ? 0.94 : 1, sole = lg.L.l > 0.35;
      limb(lg.hx, lg.hy, lg.kx, lg.ky, 5.6 * k, 4.6 * k, maester ? pal.robeDk : pal.cloth, { under: 0.25 });
      const ax = lg.fx, ay = lg.fy - (sole ? 2.5 : 4);
      if (knight) limb(lg.kx, lg.ky, ax, ay, 4.4 * k, 3.4 * k, pal.steel, { hi: 0.4 }); else limb(lg.kx, lg.ky, ax, ay, 4.2 * k, 3.2 * k, pal.boot);
      disc(lg.kx, lg.ky, 3.2 * k, knight ? pal.steel : pal.leatherDk, { band: false });
      if (sole) paint(() => g.ellipse(ax, ay + 2.6, 3.4 * k, 2.4 * k, 0, 0, TAU), mix(pal.boot, DARK, 0.25), [ax - 3, ay, ax + 3, ay + 5], { rim: false });
      else paint(() => { g.moveTo(ax - 3.6 * k, ay - 1); g.lineTo(ax + 3.6 * k, ay - 1); g.lineTo(ax + 3.8 * k, ay + 4); g.quadraticCurveTo(ax, ay + 5.4, ax - 3.8 * k, ay + 4); g.closePath(); }, pal.boot, [ax - 4, ay - 1, ax + 4, ay + 5]);
    };
    /* arms: shoulder → elbow → hand; sw > 0 = forward (away from us: higher, tucked in, hidden behind the cloak) */
    const arms = [0, 1].map(i => {
      const s = i ? 1 : -1, A = P.arm[i], S = i ? shR : shL;
      if (A.set) return { s, S, E: [A.set[0][0] + shX, A.set[0][1] + cr + P.bob], H: [A.set[1][0] + shX, A.set[1][1] + cr + P.bob], far: false, set: true };
      const sw = A.sw || 0, bend = A.bend || 0, sp = A.spread || 0;
      const E = [S[0] + s * (0.6 + sp * 7) - s * Math.max(0, sw) * 1.8, S[1] + 14 - Math.max(0, sw) * 3 + Math.min(0, sw) * -1.2 - sp * 4];
      const H = [E[0] + s * (0.2 + sp * 8) - s * sw * 2.2 * (1 - bend * 0.4) - s * bend * 2.4, E[1] + 13.5 - sw * 6 - bend * (5 + Math.max(0, sw) * 6) - sp * 4];
      return { s, S, E, H, far: sw > 0.3, sw };
    });
    const drawArm = A => {
      const k = A.far ? 0.92 : 1;
      if (knight) { limb(A.S[0], A.S[1], A.E[0], A.E[1], 4.8 * k, 4.0 * k, pal.cloth, { hi: 0.2 }); limb(A.E[0], A.E[1], A.H[0], A.H[1], 4.0 * k, 3.2 * k, pal.steel, { hi: 0.35 }); disc(A.E[0], A.E[1], 2.6 * k, pal.steelDk, { band: false }); }
      else if (ranger) { limb(A.S[0], A.S[1], A.E[0], A.E[1], 4.6 * k, 3.7 * k, pal.cloth); limb(A.E[0], A.E[1], A.H[0], A.H[1], 3.7 * k, 3.0 * k, pal.leather); }
      else { limb(A.S[0], A.S[1], A.E[0], A.E[1], 5.2 * k, 4.8 * k, pal.robe); limb(A.E[0], A.E[1], A.H[0], A.H[1], 4.8 * k, 5.2 * k, pal.robe); }
      disc(A.H[0], A.H[1], 2.5 * k, knight ? pal.steelDk : pal.skin, { band: false, rim: false });
    };
    const W = P.w, R1 = arms[1], L0 = arms[0];
    const heldA = W && W.kind === 'held' ? W.a : (F.fam === 'sword' || F.fam === 'axe' || F.fam === 'mace' || F.fam === 'dagger') ? 1.95 + (P.arm[1].sw || 0) * -0.35 : null;
    const wpFront = !P.dropped && (W ? W.lay === 'front' || W.kind === 'staffup' : true);
    const drawHeld = () => {
      if (P.dropped) return;
      if (W && W.kind === 'staffup') return weapon(F.fam, R1.H[0], R1.H[1], W.a, pal, P);
      if (W && W.kind === 'tome') return weapon('tome', L0.H[0], L0.H[1], 0, pal, P);
      if (W && W.kind === 'bowup') return;
      if (F.fam === 'staff' || F.fam === 'rod') return weapon(F.fam, R1.H[0], R1.H[1], -1.62 + (P.arm[1].sw || 0) * 0.08, pal, P);
      if (F.fam === 'tome') return weapon('tome', R1.H[0], R1.H[1], 0, pal, P);
      if (F.fam === 'bow') return bowHang(pal, L0.H[0], L0.H[1]);
      if (F.fam === 'xbow') return weapon('dagger', L0.H[0], L0.H[1], 1.9, pal, P);
      if (heldA != null) return weapon(F.fam === 'dagger' ? 'dagger' : F.fam, R1.H[0], R1.H[1], heldA, pal, P);
    };
    /* 1 · far things: a weapon swung ahead of the body, the far arm */
    if (W && W.lay === 'back') drawHeld();
    if (W && W.kind === 'bowup') { bowUp(pal, L0.H[0], L0.H[1], R1.H[0], R1.H[1], W.pull, F.fam === 'xbow'); }
    for (const A of arms) if (A.far) drawArm(A);
    /* 2 · legs (the far one first) */
    const lo = legs.slice().sort((a, b) => b.L.f - a.L.f);
    if (!maester) for (const lg of lo) drawLeg(lg);
    else for (const lg of lo) { const L = lg.L; if (L.l > 0.25 || P.crouch > 0.3) drawLeg(lg); else { const ax = lg.fx, ay = lg.fy - 3; paint(() => { g.moveTo(ax - 3.6, ay - 2); g.lineTo(ax + 3.6, ay - 2); g.lineTo(ax + 3.8, ay + 3.6); g.quadraticCurveTo(ax, ay + 5, ax - 3.8, ay + 3.6); g.closePath(); }, pal.boot, [ax - 4, ay - 2, ax + 4, ay + 5]); } }
    /* 3 · torso */
    const wy = hipY - 3, tw = maester ? 11.5 : 10;
    const torso = () => { g.moveTo(shL[0] + 1, shL[1] - 1); g.quadraticCurveTo(shX, shY - 3.5, shR[0] - 1, shR[1] - 1); g.quadraticCurveTo(shR[0] + 1.5, shR[1] + 10, hipX + tw, wy); g.lineTo(hipX + tw + 0.8, hipY + 3); g.lineTo(hipX - tw - 0.8, hipY + 3); g.lineTo(hipX - tw, wy); g.quadraticCurveTo(shL[0] - 1.5, shL[1] + 10, shL[0] + 1, shL[1] - 1); g.closePath(); };
    const tbb = [shL[0] - 2, shY - 4, shR[0] + 2, hipY + 3];
    if (knight) { paint(torso, pal.steel, tbb, { hi: 0.45, under: 0.35 }); stroke([shX, shY - 1, hipX, wy], 0.9, pal.steelDk, 0.6); }
    else if (ranger) { paint(torso, pal.leather, tbb, { under: 0.35 }); for (let i = 0; i < 3; i++) stroke([hipX - 8, wy - 4 - i * 6, hipX + 8, wy - 4 - i * 6], 0.5, pal.leatherDk, 0.5); }
    else { /* the robe: torso and a long skirt to the ankles, the hem swings with the step */
      const lf = P.leg[0].f - P.leg[1].f, hem = -3 + P.crouch * 6, skirt = () => { g.moveTo(hipX - tw, wy - 2); g.lineTo(hipX + tw, wy - 2); g.quadraticCurveTo(hipX + tw + 3 + flare * 2, hipY + 22, 13 + lf * 1.5 + sway * 8, hem - (P.leg[1].l * 4)); g.quadraticCurveTo(hipX + lf * 2, hem + 2.5, -13 + lf * 1.5 + sway * 8, hem - (P.leg[0].l * 4)); g.quadraticCurveTo(hipX - tw - 3 - flare * 2, hipY + 22, hipX - tw, wy - 2); g.closePath(); };
      paint(skirt, pal.robe, [hipX - 16, wy - 2, hipX + 16, hem + 2], { under: 0.4 });
      g.save(); g.beginPath(); skirt(); g.clip(); for (let i = -2; i <= 2; i++) curve(hipX + i * 3, wy, hipX + i * 4.5 + sway * 5, hipY + 20, i * 5.5 + sway * 8 + lf * 1.2, hem + 1, 0.9, pal.robeDk, 0.45); g.restore();
      paint(torso, pal.robe, tbb, { under: 0.2 });
      stroke([hipX - tw + 0.5, wy - 1, hipX + tw - 0.5, wy - 1], 2.2, pal.leatherDk); }
    if (!maester) { /* the belt */ paint(() => g.rect(hipX - tw - 0.6, wy - 1.8, 2 * tw + 1.2, 3.4), pal.leatherDk, [hipX - tw, wy - 2, hipX + tw, wy + 2], { band: false });
      if (knight) { /* a scabbard hanging from the left hip, toward us */ limb(hipX - tw + 1, wy + 1, hipX - tw - 3 + sway * 3, wy + 24, 1.8, 1.5, pal.leatherDk, { rim: false }); } }
    /* 4 · the cloak / short cloak / mantle */
    const clTop = shY - 1.5, clLen = knight ? -14 + cr * 0.6 : ranger ? -50 + cr * 0.8 : -53 + cr, hemY = clLen - flare * (knight ? 13 : 5) + P.bob * 0.3;
    const hw = (knight ? 18.5 : ranger ? 15.5 : 17) + flare * (knight ? 6 : 3), hs = Math.sin(sway) * (knight ? 30 : 16);
    const cl = [shL[0] + 1.5, clTop, shR[0] - 1.5, clTop];
    const ph = F.fi / F.n * TAU, wv = (knight ? 2.2 : 1.4) * (0.4 + flare);
    const cloakPath = () => {
      g.moveTo(cl[0], cl[1]); g.quadraticCurveTo(shX, clTop - 2.5, cl[2], cl[3]);
      g.bezierCurveTo(shR[0] + 3 + flare * 2, clTop + 14, hipX + hw - 2 + hs * 0.6, hemY - 12, hipX + hw + hs, hemY);
      const n = 4; for (let i = 1; i <= n; i++) { const x = hipX + hw + hs - (2 * hw) * i / n, y = hemY + (i === n ? 0 : 0), mx = x + hw / n, my = hemY + wv * Math.sin(ph * (CYC[F.anim] ? 1 : 0) + i * 1.9) + 1.2; g.quadraticCurveTo(mx, my + 1.8, x, y + (i % 2 ? -0.8 : 0.4)); }
      g.bezierCurveTo(hipX - hw + 2 + hs * 0.6, hemY - 12, shL[0] - 3 - flare * 2, clTop + 14, cl[0], cl[1]); g.closePath(); };
    if (flare > 0.25) { /* the lining shows where the hem lifts toward us */
      const lh = hemY + 3 + flare * 3; paint(() => { g.moveTo(hipX - hw + hs - 1, hemY - 2); g.quadraticCurveTo(hipX + hs, lh + 3, hipX + hw + hs + 1, hemY - 2); g.lineTo(hipX + hw + hs, hemY - 6); g.lineTo(hipX - hw + hs, hemY - 6); g.closePath(); }, pal.lining, [hipX - hw, hemY - 6, hipX + hw, lh], { band: false, rim: false });
    }
    paint(cloakPath, pal.cloak, [shL[0] - 6, clTop - 3, shR[0] + 8, hemY + 3], { hi: 0.3, sh: 0.6, under: 0.3, bandA: 0.16, rimA: 0.32 });
    g.save(); g.beginPath(); cloakPath(); g.clip();
    for (const i of [-1.5, 0, 1.5]) { const x0 = shX + i * 5, x1 = hipX + i * (hw / 1.9) + hs + Math.sin(ph + i) * wv * 0.6; curve(x0, clTop + 8, x0 + (x1 - x0) * 0.45 + sway * 4, (clTop + hemY) / 2 + 4, x1, hemY + 2, knight ? 3.2 : 2.2, pal.cloakSh, 0.3); curve(x0 + 2.6, clTop + 10, x0 + 2.6 + (x1 - x0) * 0.45 + sway * 4, (clTop + hemY) / 2 + 4, x1 + 3, hemY + 1, knight ? 1.8 : 1.2, LIGHT, 0.08); }
    { const vg = g.createLinearGradient(0, clTop, 0, hemY); vg.addColorStop(0, 'rgba(255,240,220,.10)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,4,8,.28)'); g.fillStyle = vg; g.fillRect(hipX - hw - 12, clTop - 3, 2 * hw + 24, hemY - clTop + 6); }
    const sgY = knight ? shY + 22 : ranger ? shY + 15 : shY + 12, sgX = shX + hs * (knight ? 0.28 : 0.2) + (ranger ? -3.5 : 0), sgS = knight ? 1.35 : ranger ? 0.85 : 0.95;
    sigil(F.house, sgX, sgY, sgS, sway * 0.35, pal.sig, 0.85);
    g.restore();
    /* ranger: the quiver over the cloak on the right shoulder blade, fletching above the shoulder */
    if (ranger) {
      const qx = shR[0] - 6, qy = shY - 6, ex = qx - 8 + sway * 3, ey = shY + 26;
      for (let i = 0; i < 4; i++) { const fx = qx + 1 + i * 1.6 - 2, fy = qy - 5 - (i % 2) * 1.6; stroke([fx + 0.6, fy + 6, fx, fy], 0.6, pal.woodDk); sh(() => { g.moveTo(fx, fy - 2.4); g.lineTo(fx - 1.6, fy + 2.4); g.lineTo(fx + 1.6, fy + 2.4); g.closePath(); }, i % 2 ? '#d9d2bf' : mix(pal.house, '#ffffff', 0.25)); }
      limb(qx, qy, ex, ey, 3.3, 2.8, pal.leather, { under: 0.25 }); stroke([qx - 2.6, qy + 2, qx + 2.6, qy + 1], 1, pal.trim); stroke([shL[0] + 3, shY + 1, ex + 1, ey - 6], 1.2, pal.leatherDk, 0.9);
    }
    /* maester: the chain at the nape, links of mixed metals */
    if (maester) { const cols = ['#c9a24a', '#cfd3d6', '#a8683a', '#7d8288']; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + i * 0.105), x = shX + Math.cos(a) * -8.5, y = shY - 2 + Math.sin(a) * -2.5 + 1.5; g.beginPath(); g.ellipse(x, y, 1.3, 0.95, a, 0, TAU); g.strokeStyle = C(cols[i % 4]); g.lineWidth = 0.8; g.stroke(); } }
    /* 5 · head (+ hair / hood / cowl) */
    const hX = shX + turn * 0.6 + P.tilt * -8, hR = 7.4;
    limb(hX, headY + 6, shX, shY - 1, 3.4, 3.8, pal.skin, { band: false, rim: false });
    if (ranger) {
      const hood = () => { g.moveTo(hX - 9.5, shY + 1); g.quadraticCurveTo(hX - 10.5, headY - 4, hX - 1.5, headY - 11.5); g.quadraticCurveTo(hX + 2 + sway * 4, headY - 12.6, hX + 1.6 + sway * 6, headY - 9.6); g.quadraticCurveTo(hX + 10.5, headY - 4, hX + 9.5, shY + 1); g.quadraticCurveTo(hX, shY + 4.5, hX - 9.5, shY + 1); g.closePath(); };
      paint(hood, mix(pal.cloak, pal.cloth, 0.3), [hX - 10, headY - 12, hX + 10, shY + 4], { hi: 0.32, under: 0.3 });
      curve(hX - 5, headY - 6, hX - 1, shY - 4, hX + 3.5, shY + 2, 0.9, pal.cloakSh, 0.5);
    } else {
      const ear = s => disc(hX + s * (hR - 0.4) + F.face * 0.6, headY + 0.8, 1.6, pal.skin, { band: false, rim: false });
      ear(-1); ear(1); paint(() => g.ellipse(hX, headY, hR, hR * 1.1, 0, 0, TAU), pal.skin, [hX - hR, headY - hR, hX + hR, headY + hR], { band: false });
      const hairC = maester ? mix(pal.hair, '#9a958c', 0.35) : pal.hair;
      const hairP = () => { g.moveTo(hX - hR - 0.4, headY + 1.5); g.quadraticCurveTo(hX - hR - 1.2, headY - hR * 1.25, hX, headY - hR * 1.15 - 0.6); g.quadraticCurveTo(hX + hR + 1.2, headY - hR * 1.25, hX + hR + 0.4, headY + 1.5);
        g.quadraticCurveTo(hX + hR - 0.5, headY + 6.5, hX + 3, headY + 7.6); g.lineTo(hX + 1, headY + 6.2); g.lineTo(hX - 0.8, headY + 8); g.lineTo(hX - 2.8, headY + 6.4); g.quadraticCurveTo(hX - hR + 0.5, headY + 6.5, hX - hR - 0.4, headY + 1.5); g.closePath(); };
      paint(hairP, hairC, [hX - hR, headY - hR - 1, hX + hR, headY + 8], { hi: 0.32, sh: 0.55, rimA: 0.35 });
      for (let i = -2; i <= 2; i++) curve(hX + i * 2.2, headY - hR + 0.5, hX + i * 2.9, headY, hX + i * 3.1 + 0.5, headY + 5.5, 0.55, mix(hairC, DARK, 0.4), 0.45);
      curve(hX - 4.5, headY - hR + 1.4, hX - 5.4, headY - 3, hX - 5.8, headY + 1, 0.8, LIGHT, 0.22);
      if (knight) paint(() => { g.moveTo(hX - 7.5, shY + 0.5); g.quadraticCurveTo(hX, shY - 5.5, hX + 7.5, shY + 0.5); g.lineTo(hX + 6.5, shY + 2.5); g.quadraticCurveTo(hX, shY - 1.8, hX - 6.5, shY + 2.5); g.closePath(); }, pal.steel, [hX - 7, shY - 5, hX + 7, shY + 3], { hi: 0.45 });
      if (maester) paint(() => { g.moveTo(hX - 9, shY + 2); g.quadraticCurveTo(hX - 8, shY - 5.5, hX, shY - 4.8); g.quadraticCurveTo(hX + 8, shY - 5.5, hX + 9, shY + 2); g.quadraticCurveTo(hX, shY + 5, hX - 9, shY + 2); g.closePath(); }, pal.robeDk, [hX - 9, shY - 6, hX + 9, shY + 4], { hi: 0.25 });
    }
    /* 6 · pauldrons (knight), over the cloak */
    if (knight) for (const S of [shL, shR]) { const s = S === shL ? -1 : 1;
      for (let j = 2; j >= 0; j--) { const cx = S[0] + s * (1.2 + j * 0.6), cy = S[1] + 1 + j * 3.1, rx = 7.2 - j * 0.8, ry = 5.4 - j * 0.9;
        paint(() => { g.ellipse(cx, cy, rx, ry, s * 0.22, Math.PI * 1.02, Math.PI * 1.98 + 0.001); g.closePath(); g.moveTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry * 0.55, s * 0.22, Math.PI, 0, true); }, j ? pal.steelDk : pal.steel, [cx - rx, cy - ry, cx + rx, cy + ry * 0.6], { hi: 0.5, sh: 0.4 }); }
      stroke([S[0] + s * 1 - 4.5, S[1] - 1.5, S[0] + s * 1 + 4.5, S[1] - 1.5], 0.6, pal.trim, 0.85); }
    /* 7 · near arms, the weapon in hand */
    for (const A of arms) if (!A.far) { drawArm(A); }
    if (wpFront && !(W && W.lay === 'back')) drawHeld();
    if (P.dropped && (F.fam === 'sword' || F.fam === 'axe' || F.fam === 'mace' || F.fam === 'staff')) weapon(F.fam === 'staff' ? 'staff' : F.fam, 16, -3, 0.12, pal, { glow: 0 });
    /* 8 · the swing's trail, a pale crescent around the shoulder */
    if (P.trail) { const cx = shX + 2, cy = shY - 6, r0 = 26, r1 = 33, a0 = P.trail.a0, a1 = P.trail.a1;
      const gr = g.createLinearGradient(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1); gr.addColorStop(0, 'rgba(255,248,230,0)'); gr.addColorStop(1, 'rgba(255,248,230,' + 0.55 * P.trail.fade + ')');
      g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fillStyle = gr; g.fill(); }
  }

  function render(F) {
    const P = pose(F.cls, F.anim, (F.fi + 0.5) / F.n, F.speed, F.lean, F.fam), pal = palette(F.cls, F.house, F.arar, F.wrar, F.hair);
    const H = F.pxH, s = H / 100, W = Math.ceil(H * 1.3 / 2) * 2, top = Math.ceil(H * 1.32 + 2), bot = Math.ceil(H * 0.12 + 2);
    const c = document.createElement('canvas'); c.width = W; c.height = top + bot;
    const g0 = g, f0 = flash; g = c.getContext('2d'); flash = P.flash; flashCol = F.anim === 'hurt' ? '#ffd6cc' : '#ffffff';
    try {
      g.translate(W / 2, top); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
      const rot = F.lean * 0.07 + P.rot * 0.5;
      g.translate(0, P.dy); if (P.sy !== 1) { g.scale(1 + (1 - P.sy) * 0.18, P.sy); } if (rot) { g.translate(0, -30); g.rotate(rot); g.translate(0, 30); }
      if (F.face) { g.transform(1, 0, F.face * -0.02, 1, 0, 0); }
      figure(F, P, pal);
    } finally { g = g0; flash = f0; }
    c.meta = { ax: W / 2, ay: top, w: H * 0.46, h: H, sc: F.sc, lift: 0, face: F.face, back: true, anim: F.anim, fi: F.fi };
    return c;
  }

  D.heroBackKey = (anim, t, o) => resolve(anim, t, o).key;
  D.heroBack = (anim, t, o) => {
    const F = resolve(anim, t, o); if (o && o.keyOnly) return F.key;
    let c = cget(F.key); if (c) return c;
    try { c = render(F); } catch (e) { if (!D._hbWarn) { D._hbWarn = 1; console.warn('heroBack', e); } c = document.createElement('canvas'); c.width = c.height = 4; c.meta = { ax: 2, ay: 4, w: 2, h: 4, sc: 1, lift: 0, face: 1, back: true }; return c; }
    return cset(F.key, c);
  };
})();
