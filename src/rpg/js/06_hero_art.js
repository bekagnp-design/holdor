/* HOLDOR RPG — 06_hero_art.js (A37): the player character drawn in code, a 48-unit "painted miniature" that matches the
   old hand-drawn enemies (dark outline, two tones, big hands, 3/4 view facing right). FALLBACK ONLY since the owner's
   decision (the world is 3D, the hero is a champion from its sprite sheets): kept so R.draw.hero / the HUD portrait have
   something when no sheet is loaded.
   R.heroArt.draw(ctx, x, y, o)   x,y = the feet on the ground (screen px). o: {cls:'knight'|'ranger'|'maester', house,
     anim:'idle'|'walk'|'attack'|'hurt'|'die'|'dodge', t (seconds into the anim), ph (0..1 overrides t), face ±1, scale, alpha,
     seed, gear:{weapon,armor}} — items {rar, name, fam?}; weapon families knight sword/axe/mace, ranger bow/xbow/dagger,
     maester staff/rod/tome; the weapon metal and the armour trim take the rarity colour.
   R.heroArt.portrait(cls, house, size) → canvas (head and shoulders on the house colour).
   Static layers (torso + head + headgear + cloak) are cached per (cls, house, armour rarity, face); limbs draw live. */
(function () {
  const R = window.R = window.R || {};
  const FB = { stark: { col: '#a9bdd0', col2: '#3b4a5a', e: '🐺' }, lannister: { col: '#e3b661', col2: '#7a1d1d', e: '🦁' }, baratheon: { col: '#e0c14a', col2: '#23231f', e: '🦌' },
    targaryen: { col: '#e14b4b', col2: '#1c1c1c', e: '🐉' }, greyjoy: { col: '#d8b74a', col2: '#1f2a30', e: '🦑' }, tyrell: { col: '#7fd06a', col2: '#2f5a2a', e: '🌹' }, martell: { col: '#f08a3c', col2: '#7a2a1a', e: '☀️' } };
  const houseOf = h => (R.data && R.data.houses && R.data.houses[h]) || (window.A_CHAMP && A_CHAMP.houses && A_CHAMP.houses[h]) || FB[h] || FB.stark;
  const RAR = ['#b9bcc2', '#5fcf6a', '#4f9bff', '#b56cff', '#f5b84a'];
  const CLS = { knight: 1, ranger: 1, maester: 1 };
  const OUT = '#1b1611', LW = 1.5, CS = 3, TAU = Math.PI * 2;
  const hx = c => { let s = String(c || '#888').replace('#', ''); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; const n = parseInt(s, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const h2 = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  const mix = (a, b, k) => { const A = hx(a), B = hx(b); return '#' + h2(A[0] + (B[0] - A[0]) * k) + h2(A[1] + (B[1] - A[1]) * k) + h2(A[2] + (B[2] - A[2]) * k); };
  let g = null, flash = 0;
  const C = c => flash > 0 ? mix(c, '#ffffff', flash) : c;
  /* ---- primitives (unit space, feet at the origin, +x forward, y up negative) ---- */
  function capsule(ax, ay, bx, by, wa, wb) { const a = Math.atan2(by - ay, bx - ax); g.beginPath(); g.arc(ax, ay, wa, a + Math.PI / 2, a - Math.PI / 2); g.arc(bx, by, wb, a - Math.PI / 2, a + Math.PI / 2); g.closePath(); }
  function limb(ax, ay, bx, by, wa, wb, col, sh) {
    capsule(ax, ay, bx, by, wa, wb); g.fillStyle = C(sh); g.fill();
    capsule(ax + wa * .2, ay - wa * .2, bx + wb * .2, by - wb * .2, wa * .6, wb * .6); g.fillStyle = C(col); g.fill();
    capsule(ax, ay, bx, by, wa, wb); g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke();
  }
  function poly(pts, col, stroke) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); if (col) { g.fillStyle = C(col); g.fill(); } if (stroke !== false) { g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke(); } }
  function disc(x, y, r, col, stroke) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = C(col); g.fill(); if (stroke !== false) { g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke(); } }
  function line(ax, ay, bx, by, w, col) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineWidth = w; g.strokeStyle = C(col); g.lineCap = 'round'; g.stroke(); }
  const dir = a => [Math.sin(a), Math.cos(a)];       /* limb angle: 0 = hanging down, + = forward */
  /* ---- palette ---- */
  function palette(hs, arar) {
    const col = hs.col || '#a9bdd0', col2 = hs.col2 || '#3b4a5a';
    return { col, col2, colSh: mix(col, '#000000', .4), cloak: mix(col, '#0a0c10', .5), cloakSh: mix(col, '#0a0c10', .7), skin: '#e6b990', skinSh: '#b97f5a', hair: '#3d2817',
      steel: '#a4adb6', steelSh: '#5f6974', steelHi: '#e0e5e9', leather: '#73502f', leatherSh: '#4a3119', cloth: '#56605a', clothSh: '#353c38', robe: '#8b8d90', robeSh: '#5a5d61',
      boot: '#3f2d1f', bootSh: '#26190f', wood: '#8c5b2c', woodSh: '#593717', trim: RAR[arar] || RAR[0], fire: '#7cff5a', e: hs.e || '' };
  }
  const famOf = (cls, w) => { if (!w) return cls === 'ranger' ? 'bow' : cls === 'maester' ? 'staff' : 'sword'; if (w.fam) return w.fam; const n = String(w.name || '') + (w.icon || '');
    if (cls === 'knight') return /axe|hatchet|🪓/i.test(n) ? 'axe' : /mace|hammer|maul|flail|club|🔨/i.test(n) ? 'mace' : 'sword';
    if (cls === 'ranger') return /crossbow/i.test(n) ? 'xbow' : /dagger|knife|knives|dirk|🗡/i.test(n) ? 'dagger' : 'bow';
    return /tome|book|grimoire|📖/i.test(n) ? 'tome' : /rod|scept|wand/i.test(n) ? 'rod' : 'staff'; };
  /* ---- the static body: torso + head + headgear + cloak, hip at the origin, facing right ---- */
  const cache = new Map();
  function body(cls, house, arar, face) {
    const key = cls + '|' + house + '|' + arar + '|' + face; let ce = cache.get(key); if (ce) return ce;
    if (cache.size > 64) cache.clear();
    const pal = palette(houseOf(house), arar), cv = document.createElement('canvas'); cv.width = 40 * CS; cv.height = 52 * CS;
    const g0 = g, f0 = flash; g = cv.getContext('2d'); flash = 0; g.setTransform(CS, 0, 0, CS, 20 * CS, 32 * CS); g.lineJoin = 'round';
    drawBody(cls, pal, face); ce = { cv, ox: 20, oy: 32, w: 40, h: 52, pal, white: null }; g = g0; flash = f0; cache.set(key, ce); return ce;
  }
  function head(cls, pal, big) {
    const cx = 1.5, cy = -22.5;
    if (cls === 'ranger') { /* hood back */ poly([-7, -14, -8.5, -24, -3, -31.5, 6, -29, 9, -20, 7, -14], pal.cloak); }
    if (cls === 'maester') { disc(cx - .5, cy - .5, 6.4, '#9a9a9a'); }
    g.beginPath(); g.ellipse(cx, cy, 5.6, 6.1, 0, 0, TAU); g.fillStyle = C(pal.skinSh); g.fill(); g.beginPath(); g.ellipse(cx + .8, cy - .8, 4.6, 5.1, 0, 0, TAU); g.fillStyle = C(pal.skin); g.fill();
    g.beginPath(); g.ellipse(cx, cy, 5.6, 6.1, 0, 0, TAU); g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke();
    if (cls === 'knight') { poly([-4.2, -22.5, -4.5, -26, -1.5, -29.5, 3, -30.3, 6.5, -27.5, 7.4, -22.5], pal.steel); poly([-4.2, -22.5, 7.4, -22.5, 7.4, -20.8, -4.2, -20.8], pal.steelSh); poly([5, -21, 6.6, -21, 6.6, -16.5, 5, -16.5], pal.steelSh); line(-2, -29.6, 4, -29.8, 1.6, pal.col); }
    else if (cls === 'ranger') { g.beginPath(); g.ellipse(cx - 1, cy - 1.2, 8.2, 8.6, 0, 0, TAU); g.ellipse(cx + 2.2, cy + .2, 4.4, 5.2, 0, 0, TAU, true); g.fillStyle = C(pal.cloak); g.fill('evenodd'); g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke(); g.beginPath(); g.ellipse(cx + 2.2, cy + .2, 4.4, 5.2, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); }
    else { poly([-4.5, -23, -3.8, -27.5, 0, -28.6, 5, -27.6, 6.5, -24.5, 5, -25.5, 0, -26.6, -3.2, -25.2], '#b9b9b9'); poly([2, -18.5, 6.8, -19.5, 7, -16.3, 4, -15.5], '#c9c9c9'); }
    disc(2.4, -23.2, .75, OUT, false); disc(5.4, -23.4, .75, OUT, false); line(6.2, -22.4, 6.8, -20.6, .9, pal.skinSh); line(4.6, -19.6, 6.2, -19.8, .8, pal.skinSh);
    if (big) { line(1.4, -24.9, 3.2, -25.2, .9, OUT); line(4.6, -25.1, 6.2, -25.2, .9, OUT); }
  }
  function drawBody(cls, pal, face) {
    const torso = () => { g.beginPath(); g.moveTo(-6.5, 8); g.lineTo(6.8, 8); g.lineTo(5.8, 1); g.lineTo(7.2, -9); g.quadraticCurveTo(7.6, -14.5, 2.6, -14.8); g.lineTo(-2.6, -14.8); g.quadraticCurveTo(-7.6, -14.5, -7, -9); g.lineTo(-5.6, 1); g.closePath(); };
    if (cls === 'ranger') { poly([-8, -13, 7.5, -13, 8, 10, 2, 15, -6, 15, -11.5, 9], pal.cloakSh); poly([-7, -12, 5, -12, 5.5, 8, 1, 12, -4, 12, -9, 7], pal.cloak, false); limb(-6.5, -4, -2.5, -16, 1.8, 1.6, pal.leather, pal.leatherSh); for (let i = 0; i < 3; i++) line(-3.2 + i * .9, -16, -2.4 + i * .9, -19, 1.1, pal.col); }
    torso(); g.fillStyle = C(cls === 'knight' ? pal.steelSh : cls === 'ranger' ? pal.leatherSh : pal.robeSh); g.fill(); g.save(); g.clip();
    g.fillStyle = C(cls === 'knight' ? pal.steel : cls === 'ranger' ? pal.leather : pal.robe); g.fillRect(-4, -16, 14, 26);
    if (cls === 'knight') { g.fillStyle = C(pal.colSh); g.fillRect(-5.2, -12.5, 10.4, 21); g.fillStyle = C(pal.col); g.fillRect(-2.6, -12.5, 7.8, 21); g.fillStyle = C(pal.col2); g.fillRect(.6, -12.5, 1.1, 21); g.fillStyle = C(pal.trim); g.fillRect(-5.2, -12.5, 10.4, 1); }
    if (cls === 'ranger') { g.fillStyle = C(pal.trim); g.fillRect(-.6, -12, 1.2, 20); for (let i = 0; i < 4; i++) { g.fillRect(-4.5, -10 + i * 4, 1.4, 1.4); g.fillRect(3.4, -10 + i * 4, 1.4, 1.4); } }
    if (cls === 'maester') { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-9, -16, 5, 26); g.fillStyle = C(pal.trim); g.fillRect(-9, 6.6, 18, 1.4); }
    g.restore(); torso(); g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke();
    poly([-5.8, .4, 6, .4, 6, 2.6, -5.8, 2.6], pal.leatherSh, false); poly([.4, .2, 3, .2, 3, 2.8, .4, 2.8], pal.trim);
    limb(-.2, -14.5, 1.2, -18.5, 2.1, 2.1, pal.skin, pal.skinSh);
    if (cls === 'knight') { g.beginPath(); g.ellipse(.4, -14.6, 4.4, 2.1, 0, 0, TAU); g.fillStyle = C(pal.steel); g.fill(); g.lineWidth = LW; g.strokeStyle = C(OUT); g.stroke(); }
    head(cls, pal);
    if (cls === 'maester') { const cols = ['#e0b24a', '#cfd3d6', '#b4713b', '#777b80', '#e0b24a', '#cfd3d6']; for (let i = 0; i < 6; i++) { const a = Math.PI * (.15 + i * .14); disc(.4 + 4.2 * Math.cos(a), -14 + 2.6 * Math.sin(a), 1.05, cols[i]); } }
    if (cls === 'knight' && pal.e) { g.save(); g.translate(1.6, -5.5); if (face < 0) g.scale(-1, 1); g.font = '6px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; try { g.fillText(pal.e, 0, 0); } catch (e) {} g.restore(); }
  }
  /* ---- poses ---- */
  const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
  const kf = (F, p, keys) => { let i = 0; while (i < F.length - 2 && p > F[i + 1].p) i++; const a = F[i], b = F[i + 1], k = ease((p - a.p) / ((b.p - a.p) || 1)), o = {}; for (const n of keys) o[n] = a[n] + (b[n] - a[n]) * k; return o; };
  const KEYS = ['fu', 'ff', 'bu', 'bf', 'w', 'tilt', 'dx', 'lean', 'fla', 'bla', 'glow', 'pull'];
  const IDLE = { p: 0, fu: .3, ff: 1.35, bu: -.35, bf: .55, w: -1, tilt: 0, dx: 0, lean: 0, fla: .18, bla: -.12, glow: 0, pull: 0 };
  const ATK = {
    swing: [IDLE, { ...IDLE, p: .3, fu: -2.3, ff: -2.9, w: -2.7, tilt: -.12, dx: -1.5 }, { ...IDLE, p: .58, fu: 1.55, ff: 1.9, w: .55, tilt: .2, dx: 2.5, lean: .1, fla: .5, bla: -.4 }, { ...IDLE, p: 1 }],
    bow: [IDLE, { ...IDLE, p: .5, fu: 1.6, ff: 1.6, w: -1.45, pull: 1, tilt: .04 }, { ...IDLE, p: .62, fu: 1.6, ff: 1.6, w: -1.6, pull: 0, dx: -1 }, { ...IDLE, p: 1 }],
    thrust: [IDLE, { ...IDLE, p: .3, fu: -.4, ff: .6, w: -1.75, dx: -2, tilt: -.08 }, { ...IDLE, p: .55, fu: 1.4, ff: 1.5, w: -.75, dx: 3, tilt: .15, lean: .12, glow: 1, fla: .55, bla: -.45 }, { ...IDLE, p: .85, glow: .3 }, { ...IDLE, p: 1 }],
    cast: [IDLE, { ...IDLE, p: .35, fu: 1.1, ff: -2.4, w: -1.5, tilt: -.06 }, { ...IDLE, p: .6, fu: 1.3, ff: -2.2, w: -1.5, glow: 1 }, { ...IDLE, p: 1 }] };
  const DUR = { attack: .45, hurt: .3, dodge: .35, die: .8 };
  function pose(o, cls, fam) {
    const an = o.anim || 'idle', t = o.t || 0, sd = (o.seed || 0) * 1.7;
    const P = { ...IDLE, flk: .05, blk: .08, bob: 0, br: 0, dy: 0, rot: 0, alpha: o.alpha == null ? 1 : o.alpha, flash: 0, ghost: 0, sx: 1, sy: 1, trail: 0, p: 0, shadow: 1 };
    const p = o.ph != null ? o.ph : an in DUR ? Math.min(1, t / DUR[an]) : 0; P.p = p;
    if (an === 'walk') { const ph = o.ph != null ? o.ph * TAU : t * TAU * 1.7 + sd, s = Math.sin(ph), c = Math.cos(ph);
      P.fla = .55 * s; P.flk = .95 * Math.max(0, c); P.bla = -.55 * s; P.blk = .95 * Math.max(0, -c); P.bu = .45 * s - .15; P.bf = P.bu + .5; P.fu = -.3 * s + .25; P.ff = P.fu + 1.05; P.w = -1 + .2 * s;
      P.bob = -1.3 * Math.abs(c); P.tilt = .06 + .03 * s; P.lean = .05; }
    else if (an === 'idle') { const ph = t * 1.1 + sd; P.br = .018 * Math.sin(ph * Math.PI); P.dx = .6 * Math.sin(ph * Math.PI * .5); P.tilt = .02 * Math.sin(ph * Math.PI * .5); P.ff = 1.35 + .06 * Math.sin(ph * Math.PI); P.bf = .55 + .05 * Math.cos(ph * Math.PI); }
    else if (an === 'attack') { const kind = fam === 'bow' || fam === 'xbow' ? 'bow' : fam === 'tome' ? 'cast' : cls === 'maester' ? 'thrust' : 'swing'; Object.assign(P, kf(ATK[kind], p, KEYS)); if (kind === 'swing' && p > .3 && p < .75) P.trail = 1 - (p - .3) / .45; }
    else if (an === 'hurt') { const k = 1 - p; P.dx = -3 * k; P.tilt = -.18 * k; P.flash = k * k * .85; P.fu = .3 + .8 * k; P.bu = -.35 - .7 * k; P.flk = .3 * k; P.blk = .3 * k; }
    else if (an === 'dodge') { const k = Math.sin(Math.PI * p); P.lean = .42 * k; P.sx = 1 + .08 * k; P.sy = 1 - .08 * k; P.alpha *= .75; P.ghost = 1; P.fla = .9 * k; P.bla = -.9 * k; P.fu = -.6 * k + .3; P.bu = -.9 * k; P.tilt = .1 * k; }
    else if (an === 'die') { const k = ease(p); P.rot = -Math.PI / 2 * k; P.fu = .3 + k; P.ff = 1.35 + .6 * k; P.bu = -.35 - .8 * k; P.flk = .5 * k; P.alpha *= Math.max(0, 1 - Math.max(0, t - .9) / .6); P.shadow = 1 - .6 * k; P.w = -1 + 1.8 * k; }
    return P;
  }
  /* ---- weapons at the hand (hx,hy), blade angle w (canvas radians, 0 = forward, -π/2 = up) ---- */
  function weapon(fam, hx, hy, w, pal, rar, P, S) {
    const dx = Math.cos(w), dy = Math.sin(w), nx = -dy, ny = dx, met = rar > 0 ? mix(pal.steelHi, RAR[rar], .4) : pal.steelHi, metSh = rar > 0 ? mix(pal.steelSh, RAR[rar], .3) : pal.steelSh;
    const pt = (k, n) => [hx + dx * k + nx * n, hy + dy * k + ny * n];
    if (fam === 'sword' || fam === 'dagger') { const L = fam === 'sword' ? 17 : 8; line(...pt(-3, 0), ...pt(1, 0), 2.2, pal.woodSh); disc(...pt(-3.4, 0), 1.2, metSh); line(...pt(1.3, -2.6), ...pt(1.3, 2.6), 1.8, metSh);
      poly([...pt(1.6, -1.3), ...pt(L - 2.5, -1), ...pt(L, 0), ...pt(L - 2.5, 1), ...pt(1.6, 1.3)], metSh); poly([...pt(2, -.9), ...pt(L - 3, -.7), ...pt(L - .6, 0), ...pt(2, .1)], met, false); }
    else if (fam === 'axe') { line(...pt(-4, 0), ...pt(15, 0), 2.2, pal.wood); poly([...pt(10, 0), ...pt(9, -3), ...pt(13.5, -5.5), ...pt(16, -1.5), ...pt(15, 1)], metSh); poly([...pt(10.5, -.5), ...pt(10.2, -2.8), ...pt(13.6, -4.6), ...pt(15.2, -1.5)], met, false); }
    else if (fam === 'mace') { line(...pt(-4, 0), ...pt(12, 0), 2.2, pal.wood); disc(...pt(13.5, 0), 3, metSh); for (let i = 0; i < 4; i++) { const a = w + i * Math.PI / 2; poly([hx + dx * 13.5 + Math.cos(a) * 2, hy + dy * 13.5 + Math.sin(a) * 2, hx + dx * 13.5 + Math.cos(a + .5) * 3.4, hy + dy * 13.5 + Math.sin(a + .5) * 3.4, hx + dx * 13.5 + Math.cos(a + 1) * 2, hy + dy * 13.5 + Math.sin(a + 1) * 2], met); } }
    else if (fam === 'bow') { const T = pt(13, 0), B = pt(-13, 0); g.beginPath(); g.moveTo(T[0], T[1]); g.quadraticCurveTo(hx + nx * -7, hy + ny * -7, B[0], B[1]); g.lineWidth = 3; g.strokeStyle = C(OUT); g.stroke(); g.lineWidth = 1.6; g.strokeStyle = C(rar > 0 ? mix(pal.wood, RAR[rar], .4) : pal.wood); g.stroke();
      const sx = S ? S[0] : hx + nx * 1, sy = S ? S[1] : hy + ny * 1; line(T[0], T[1], sx, sy, .7, '#e9e2cf'); line(sx, sy, B[0], B[1], .7, '#e9e2cf'); if (P.pull > 0) { line(sx, sy, sx + 17, sy, 1.2, pal.wood); disc(sx + 17, sy, 1, met, false); } }
    else if (fam === 'xbow') { const a = w + Math.PI / 2, cx = Math.cos(a), cy = Math.sin(a); line(hx - cx * 4, hy - cy * 4, hx + cx * 11, hy + cy * 11, 3, pal.woodSh); line(hx + cx * 9 + dx * 6, hy + cy * 9 + dy * 6, hx + cx * 9 - dx * 6, hy + cy * 9 - dy * 6, 1.8, met); line(hx + cx * 9 + dx * 6, hy + cy * 9 + dy * 6, hx + cx * 2, hy + cy * 2, .7, '#e9e2cf'); line(hx + cx * 9 - dx * 6, hy + cy * 9 - dy * 6, hx + cx * 2, hy + cy * 2, .7, '#e9e2cf'); }
    else if (fam === 'staff' || fam === 'rod') { const L = fam === 'staff' ? 24 : 14, D = fam === 'staff' ? 20 : 2; line(...pt(-D, 0), ...pt(L, 0), 2.4, pal.woodSh); line(...pt(-D + 1, .4), ...pt(L - 1, .4), .8, pal.wood);
      const tip = pt(L + 1.5, 0); if (P.glow > 0) { g.globalAlpha *= .35; disc(tip[0], tip[1], 3 + 9 * P.glow, pal.fire, false); g.globalAlpha /= .35; } g.globalAlpha *= .5; disc(tip[0], tip[1], 4, pal.fire, false); g.globalAlpha /= .5; disc(tip[0], tip[1], 2.2, pal.fire); }
    else if (fam === 'tome') { poly([...pt(-2, -3), ...pt(5, -3), ...pt(5, 3), ...pt(-2, 3)], pal.col2); poly([...pt(-1.4, -2.4), ...pt(4.4, -2.4), ...pt(4.4, 2.4), ...pt(-1.4, 2.4)], rar > 0 ? RAR[rar] : '#d9cfae', false); if (P.glow > 0) { g.globalAlpha *= .4 * P.glow; disc(...pt(1.5, 0), 4 + 8 * P.glow, pal.fire, false); g.globalAlpha /= .4 * P.glow; } }
  }
  /* ---- the figure in its local frame (feet at the origin, facing right) ---- */
  function figure(ce, P, cls, fam, wrar) {
    const pal = ce.pal, hipY = -19 + P.bob, br = 1 + P.br;
    const leg = (x0, a, k, col, sh) => { const d1 = dir(a), kx = x0 + d1[0] * 9.5, ky = hipY + d1[1] * 9.5, d2 = dir(a - k), ax = kx + d2[0] * 9.5, ay = ky + d2[1] * 9.5;
      limb(x0, hipY, kx, ky, 3.1, 2.4, col, sh); limb(kx, ky, ax, ay, 2.4, 2.1, col, sh); poly([ax - 2.6, ay - 1.5, ax + 1.2, ay - 1.8, ax + 5.2, ay + .4, ax + 4.8, ay + 2.2, ax - 2.9, ay + 2.4], pal.boot); };
    const arm = (sx, sy, u, f, col, sh, fn) => { const d1 = dir(u), ex = sx + d1[0] * 8, ey = sy + d1[1] * 8, d2 = dir(f), hx = ex + d2[0] * 7.5, hy = ey + d2[1] * 7.5;
      if (fn) fn(hx, hy, 'pre'); limb(sx, sy, ex, ey, 2.7, 2.2, col, sh); limb(ex, ey, hx, hy, 2.2, 1.9, pal.skin, pal.skinSh); disc(hx, hy, 2.3, pal.skin); return [hx, hy]; };
    const legCol = cls === 'knight' ? pal.steel : pal.cloth, legSh = cls === 'knight' ? pal.steelSh : pal.clothSh, armCol = cls === 'knight' ? pal.steel : cls === 'ranger' ? pal.leather : pal.robe, armSh = cls === 'knight' ? pal.steelSh : cls === 'ranger' ? pal.leatherSh : pal.robeSh;
    leg(-2.6, P.bla, P.blk, legSh, mix(legSh, '#000', .3)); leg(2.6, P.fla, P.flk, legCol, legSh);
    const ct = Math.cos(P.tilt), st = Math.sin(P.tilt), sh = (x, y) => [x * ct - y * br * st, hipY + x * st + y * br * ct];
    const bs = sh(-5.5, -13.5), fs = sh(6, -13.5);
    const bh = arm(bs[0], bs[1], P.bu, P.bf, armSh, mix(armSh, '#000', .3));
    if (cls === 'knight' && fam !== 'dagger') { const a = P.bf; g.save(); g.translate(bh[0], bh[1]); g.rotate(a * .5); poly([-4.5, -8, 4.5, -8, 4.5, 2, 0, 9, -4.5, 2], pal.col); poly([-3.3, -6.8, 3.3, -6.8, 3.3, 1.5, 0, 6.8, -3.3, 1.5], pal.colSh, false); line(-3.3, -6.8, 3.3, -6.8, 1.4, pal.trim); g.restore(); }
    if (cls === 'maester') poly([-6.5, hipY + 7, 6.8, hipY + 7, 9.5 + P.lean * 6, -.5, -8.5 + P.lean * 6, -.5], pal.robeSh);
    g.save(); g.translate(0, hipY); g.rotate(P.tilt); g.scale(1, br); g.drawImage(ce.cv, -ce.ox, -ce.oy, ce.w, ce.h);
    if (P.flash > .03) { if (!ce.white) { const c = document.createElement('canvas'); c.width = ce.cv.width; c.height = ce.cv.height; const w = c.getContext('2d'); w.drawImage(ce.cv, 0, 0); w.globalCompositeOperation = 'source-in'; w.fillStyle = '#fff'; w.fillRect(0, 0, c.width, c.height); ce.white = c; } g.globalAlpha *= P.flash; g.drawImage(ce.white, -ce.ox, -ce.oy, ce.w, ce.h); g.globalAlpha /= P.flash; }
    g.restore();
    if (cls === 'maester') { poly([-6, hipY + 6.5, 6.2, hipY + 6.5, 8 + P.lean * 6, -1.5, -7 + P.lean * 6, -1.5], pal.robe); g.fillStyle = C(pal.trim); g.fillRect(-7 + P.lean * 6, -2.6, 15, 1.2); }
    if (cls === 'maester') { const cols = ['#e0b24a', '#cfd3d6']; for (let i = 0; i < 2; i++) disc(fs[0] - 2 + i * 1.4, fs[1] + 1, .9, cols[i], false); }
    if (P.trail > 0) { g.globalAlpha *= .35 * P.trail; g.beginPath(); g.arc(fs[0], fs[1], 29, -2.7, P.w); g.arc(fs[0], fs[1], 17, P.w, -2.7, true); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.globalAlpha /= .35 * P.trail; }
    if (cls === 'knight') disc(fs[0] + .6, fs[1], 3.3, pal.steel);
    const fh = arm(fs[0], fs[1], P.fu, P.ff, armCol, armSh);
    let S = null; if (fam === 'bow' && P.pull > 0) S = [fh[0] - 9 * P.pull, fh[1] + .5];
    weapon(fam, fh[0], fh[1], P.w, pal, wrar, P, S);
    if (fam === 'dagger') weapon('dagger', bh[0], bh[1], P.w + .3, pal, wrar, P);
    if (S) { limb(bs[0], bs[1], S[0] - 5, S[1] + 2.5, 2.7, 2.2, armSh, mix(armSh, '#000', .3)); limb(S[0] - 5, S[1] + 2.5, S[0], S[1], 2.2, 1.9, pal.skin, pal.skinSh); disc(S[0], S[1], 2.3, pal.skin); }
  }
  function draw(ctx, x, y, o) {
    o = o || {}; const cls = CLS[o.cls] ? o.cls : 'knight', house = o.house || 'stark', face = o.face < 0 ? -1 : 1, s = o.scale || 1, gear = o.gear || {};
    const arar = gear.armor && gear.armor.rar | 0 || 0, wrar = gear.weapon && gear.weapon.rar | 0 || 0, fam = famOf(cls, gear.weapon);
    const ce = body(cls, house, arar, face), P = pose(o, cls, fam); g = ctx; flash = P.flash;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
    if (P.shadow > 0 && P.alpha > 0) { ctx.globalAlpha *= .3 * P.shadow; ctx.beginPath(); ctx.ellipse(P.dx * face, 1.2, 11 * P.shadow, 3.8 * P.shadow, 0, 0, TAU); ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha /= .3 * P.shadow; }
    const one = () => { ctx.save(); ctx.translate(P.dx * face, P.dy); if (P.rot) ctx.rotate(P.rot * face); if (P.lean) ctx.transform(1, 0, -P.lean * face, 1, 0, 0); ctx.scale(face * P.sx, P.sy); figure(ce, P, cls, fam, wrar); ctx.restore(); };
    if (P.ghost) for (let i = 2; i >= 1; i--) { ctx.save(); ctx.globalAlpha *= .13 * i; ctx.translate(-face * 7 * i, 0); one(); ctx.restore(); }
    if (P.alpha > 0) { ctx.globalAlpha *= P.alpha; one(); }
    ctx.restore(); g = null; flash = 0;
  }
  const pcache = new Map();
  function portrait(cls, house, size) {
    cls = CLS[cls] ? cls : 'knight'; house = house || 'stark'; size = size || 64; const key = cls + '|' + house + '|' + size; if (pcache.has(key)) return pcache.get(key);
    const hs = houseOf(house), pal = palette(hs, 0), cv = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1); cv.width = cv.height = size * d;
    const g0 = g; g = cv.getContext('2d'); flash = 0; g.scale(d, d);
    const gr = g.createRadialGradient(size * .5, size * .4, size * .1, size * .5, size * .5, size * .7); gr.addColorStop(0, mix(hs.col2 || '#333', hs.col || '#999', .35)); gr.addColorStop(1, mix(hs.col2 || '#222', '#000', .5)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const k = size / 24; g.save(); g.beginPath(); g.rect(0, 0, size, size); g.clip(); g.translate(size * .46, size * 1.02); g.scale(k, k); g.translate(0, 19); g.lineJoin = 'round';
    g.save(); g.translate(0, -19); g.beginPath(); g.moveTo(-9, 2); g.lineTo(9, 2); g.lineTo(8, -10); g.quadraticCurveTo(8.5, -14.5, 3, -14.8); g.lineTo(-3, -14.8); g.quadraticCurveTo(-8.5, -14.5, -8, -10); g.closePath(); g.fillStyle = cls === 'knight' ? pal.steel : cls === 'ranger' ? pal.leather : pal.robe; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke();
    if (cls === 'knight') { g.fillStyle = pal.col; g.fillRect(-4, -12, 8, 14); g.fillStyle = pal.col2; g.fillRect(-.5, -12, 1, 14); }
    limb(-.2, -14.5, 1.2, -18.5, 2.3, 2.3, pal.skin, pal.skinSh); head(cls, pal, true);
    if (cls === 'maester') { const cols = ['#e0b24a', '#cfd3d6', '#b4713b', '#777b80', '#e0b24a', '#cfd3d6']; for (let i = 0; i < 6; i++) { const a = Math.PI * (.12 + i * .15); disc(.4 + 5 * Math.cos(a), -14 + 2.8 * Math.sin(a), 1.1, cols[i]); } }
    g.restore(); g.restore(); g.lineWidth = 2; g.strokeStyle = hs.col || '#999'; g.strokeRect(1, 1, size - 2, size - 2); g = g0; pcache.set(key, cv); return cv;
  }
  R.heroArt = { draw, portrait, H: 48, RAR, famOf, houseOf, cacheSize: () => cache.size, clear: () => { cache.clear(); pcache.clear(); } };
  if (R.draw && !R.draw.hero) R.draw.hero = (x, y, o) => draw(R.ctx, x, y, o);
})();
