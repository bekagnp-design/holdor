/* HOLDOR RPG — 60_vfx.js (A32): damage numbers, slashes, auras, blood / ash, screen shake, telegraph circles.
   API (ARCH.md):  R.fx.num(x, y, txt, col, big) · R.fx.spawn(kind, x, y, o) · R.fx.shake(px, s) · R.fx.offset {x, y}
   System 'vfx' (order 905): update(dt); drawWorld(ctx) is called by the renderer after the entities; draw(ctx) draws only when nobody
   called drawWorld this frame, so the layer works without the renderer too.
   Geometry (Addendum 2): the world is 3D, this layer stays on the transparent 2D overlay. Every particle keeps a WORLD position
   (x, y on the ground, z = height) and is projected every frame through R.w2s(x, y, z); rings, telegraphs, slashes and pillars sample
   points in world space and project each one; R.cam.z is the pixels-per-unit factor for sizes. When the installed R.w2s is still the flat
   2D one (no renderer), z is lifted on the screen by hand so the effects look the same. Nothing here ever fills the overlay.
   Budget: one pool of ≤ 400 particles; when it is full the cheapest (lowest pr, then the most spent) is recycled, a cheap new one is
   dropped instead of an expensive old one; ≤ 40 numbers; prefers-reduced-motion halves every count and the shake.
   Hooks (so it works without the other modules): hit → spark + number (unless the combat module already put a number there this step),
   kill → ash (undead) / ice shards (walkers) / blood (the living) by the mob's arch, levelup → gold pillar on the player,
   loot → beam for rare drops, boss / death → shake, respawn → nova in the house colour. Footstep dust follows the player while he moves. */
window.R = window.R || {};
(function () {
  'use strict';
  const CAP = 400, NCAP = 40, TAU = Math.PI * 2;
  const HOUSE_COL = { stark: '#a9bdd0', lannister: '#e3b661', baratheon: '#e0c14a', targaryen: '#e14b4b', greyjoy: '#d8b74a', tyrell: '#7fd06a', martell: '#f08a3c' };
  const RAR_COL = ['#b9c4cf', '#7fd06a', '#5fa8ff', '#c07cff', '#ffd36a'];
  const KIND_COL = { phys: '#fff6dc', fire: '#ffa94a', ice: '#9fe3ff', holy: '#ffe28a', wild: '#9dff6b', poison: '#9dff6b' };
  /* particle types */
  const DOT = 1, SHARD = 2, DROP = 3, STREAK = 4, SLASH = 5, RING = 6, PILLAR = 7, HEX = 8, TELE = 9, GHOST = 10, FLASH = 11, EMIT = 12, ORBIT = 13, PLUS = 14;
  const fx = R.fx = R.fx || {};
  fx.CAP = CAP; fx.NCAP = NCAP; fx.offset = { x: 0, y: 0 }; fx.calm = false;
  try { fx.calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  fx.stats = { spawned: 0, dropped: 0, nums: 0 };
  const TPL = { on: 0, k: 0, kind: '', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, t: 0, life: 1, sz: 1, sz2: 0, col: '#fff', col2: '', a: 1,
    rot: 0, vr: 0, pr: 1, layer: 1, ent: null, dur: 0, ang: 0, span: 0, r: 0, ph: 0, every: 0, acc: 0, sub: '', lx: 0, ly: 0, face: 1, n: 0, h: 0, fl: 0 };
  const P = []; for (let i = 0; i < CAP; i++) P.push(Object.assign({}, TPL));
  const A = [], free = P.slice(), N = [];          // A = live particles, free = idle pool objects, N = numbers
  fx.ps = A; fx.nums = N;
  const rnd = Math.random, cnt = n => fx.calm ? Math.max(1, Math.ceil(n / 2)) : n, eo = k => 1 - (1 - k) * (1 - k) * (1 - k);
  const houseCol = () => { try { const h = R.state && R.state.p && (R.state.p.house || (R.state.acc && R.state.acc.house)); const d = R.data && R.data.houses && R.data.houses[h]; return (d && d.col) || HOUSE_COL[h] || '#a9bdd0'; } catch (e) { return '#a9bdd0'; } };
  const gone = e => !e || e.dead || e.removed || e.done;
  const goneEnt = e => gone(e) || (R.ents && R.ents.indexOf(e) < 0);
  // in 3D the billboard's own height (R.render3d.sprites: id → {sp}, anchored at the feet) puts sparks, shields and pillars on the sprite
  const spriteH = e => { try { const S = R.render3d && R.render3d.sprites, s = S && e && e.id != null && S.get && S.get(e.id); if (s && s.sp && s.sp.scale) { const h = Math.abs(s.sp.scale.y); if (h > 1 && isFinite(h)) return h * 0.82; } } catch (x) {} return 0; };
  const entH = e => e.h || spriteH(e) || (e.r || 14) * 2.2;
  fx.entH = entH;
  /* ---- colours: hex → rgba strings, cached; soft disc sprites per colour ---- */
  const RGBA = new Map(), SOFT = new Map();
  function rgb(col) { if (col[0] !== '#') return null; let h = col.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(col, a) { const key = col + '|' + (a * 100 | 0); let s = RGBA.get(key); if (s) return s; const c = rgb(col); s = c ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' : col; RGBA.set(key, s); return s; }
  function soft(col) { let c = SOFT.get(col); if (c) return c; c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, col); r.addColorStop(0.4, rgba(col, 0.85)); r.addColorStop(1, rgba(col, 0)); g.fillStyle = r; g.fillRect(0, 0, 32, 32); SOFT.set(col, c); return c; }
  /* ---- pool ---- */
  function release(i) { const p = A[i]; const l = A.length - 1; A[i] = A[l]; A.pop(); p.on = 0; p.ent = null; free.push(p); }
  function alloc(pr) {
    if (free.length) { const p = Object.assign(free.pop(), TPL); p.on = 1; p.pr = pr; A.push(p); fx.stats.spawned++; return p; }
    let bi = 0, bs = 1e9;       // the pool is full: the cheapest particle goes first, among equals the most spent one
    for (let i = 0; i < A.length; i++) { const q = A[i]; const s = q.pr * 4 - (q.life > 0 ? Math.min(1, q.t / q.life) : 1); if (s < bs) { bs = s; bi = i; } }
    const v = A[bi]; fx.stats.dropped++; if (v.pr > pr) return null;
    Object.assign(v, TPL); v.on = 1; v.pr = pr; fx.stats.spawned++; return v;
  }
  function add(k, kind, x, y, z, life, pr, o) { const p = alloc(pr); if (!p) return null; p.k = k; p.kind = kind; p.x = x; p.y = y; p.z = z; p.life = life; if (o) Object.assign(p, o); return p; }
  const dot = (kind, x, y, z, life, sz, col, pr, o) => add(DOT, kind, x, y, z, life, pr, o ? Object.assign({ sz, col }, o) : { sz, col });
  const shard = (kind, x, y, z, col, sp, pr, o) => { const a = rnd() * TAU; return add(SHARD, kind, x, y, z, 0.3 + rnd() * 0.3, pr, Object.assign({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 40 + rnd() * sp * 0.8, g: 520, rot: rnd() * TAU, vr: (rnd() - 0.5) * 20, sz: 3 + rnd() * 3, sz2: 1.6, col }, o || {})); };
  const streak = (kind, x, y, z, dir, o) => { const l = Math.hypot(dir.x || 0, dir.y || 0, dir.z || 0) || 1; return add(STREAK, kind, x, y, z, o.life || 0.22, 2, Object.assign({ vx: (dir.x || 0) / l, vy: (dir.y || 0) / l, vz: (dir.z || 0) / l, sz: 14, sz2: 1.6, col: '#eef3fa' }, o)); };
  /* ---- the kinds ---- */
  const K = {};
  K.slash = (x, y, o) => { const ang = o.ang != null ? o.ang : (o.face < 0 ? Math.PI : 0); const col = o.col || houseCol();
    const p = add(SLASH, 'slash', x, y, o.z != null ? o.z : 30, o.dur || 0.2, 3, { ang, span: o.span || 2.2, r: o.r || 34, col, face: o.face < 0 ? -1 : 1 });
    for (let i = 0, n = cnt(3); i < n; i++) dot('slash', x + Math.cos(ang) * (o.r || 34) * 0.9, y + Math.sin(ang) * (o.r || 34) * 0.9, 30 + (rnd() - 0.5) * 20, 0.25 + rnd() * 0.15, 1.5 + rnd() * 1.5, '#ffffff', 2, { vx: Math.cos(ang) * 60, vy: Math.sin(ang) * 60, vz: 30 + rnd() * 40, g: 300 });
    return p; };
  K.hit = (x, y, o) => { const z = o.z != null ? o.z : 18, col = o.col || KIND_COL[o.kind] || KIND_COL.phys;
    const p = add(FLASH, 'hit', x, y, z, 0.12, 2, { sz: o.sz || 9, col, rot: rnd() * TAU });
    for (let i = 0, n = cnt(4); i < n; i++) shard('hit', x, y, z, col, 110 + rnd() * 110, 2);
    return p; };
  K.blood = (x, y, o) => { const h = o.h || 28; let p = null; for (let i = 0, n = cnt(6); i < n; i++) p = add(DROP, 'blood', x, y, h * (0.3 + rnd() * 0.5), 0.9, 1, { vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 70, vz: 20 + rnd() * 90, g: 600, sz: 1.6 + rnd() * 1.6, col: rnd() < 0.5 ? '#5e0d12' : '#7a1118' }); return p; };
  K.ash = (x, y, o) => { const h = o.h || 28; let p = dot('ash', x, y, h * 0.45, 0.7, 12, '#2a2a30', 1, { a: 0.4, sz2: 1.2, vz: 10 });
    for (let i = 0, n = cnt(14); i < n; i++) dot('ash', x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 8, rnd() * h, 0.9 + rnd() * 0.6, 1.6 + rnd() * 2.2, rnd() < 0.6 ? '#9a9a9a' : '#55555c', 1, { vx: (rnd() - 0.5) * 36, vy: (rnd() - 0.5) * 16, vz: 14 + rnd() * 26, drag: 0.6, sz2: 0.5, ph: rnd() * TAU });
    return p; };
  K.shatter = (x, y, o) => { const h = o.h || 28; const p = add(RING, 'shatter', x, y, 2, 0.35, 3, { r: 26, sz2: 3, col: '#9fe3ff' });
    for (let i = 0, n = cnt(10); i < n; i++) shard('shatter', x, y, rnd() * h, i & 1 ? '#dff5ff' : '#8fd3ff', 90 + rnd() * 130, 2, { life: 0.5 + rnd() * 0.3, g: 420, sz2: 2 });
    for (let i = 0, n = cnt(6); i < n; i++) dot('shatter', x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 10, rnd() * h, 0.8, 2 + rnd() * 2, '#cfeeff', 1, { vz: 8 + rnd() * 14, drag: 1 });
    return p; };
  const trail = (kind, x, y, o, col, len, w, col2) => { const z = o.z != null ? o.z : 30;
    if (o.ent) return add(EMIT, kind, o.ent.x, o.ent.y, z, o.dur || 3, 3, { ent: o.ent, every: 0.025, acc: 0.025, sub: kind, col, col2, sz: len, sz2: w, lx: o.ent.x, ly: o.ent.y, fl: 1 });
    const dir = o.vx != null || o.vy != null ? { x: o.vx, y: o.vy, z: o.vz || 0 } : { x: Math.cos(o.ang || 0), y: Math.sin(o.ang || 0), z: 0 };
    const p = streak(kind, x, y, z, dir, { col, col2, sz: len, sz2: w });
    if (col2) for (let i = 0, n = cnt(2); i < n; i++) dot(kind, x, y, z + (rnd() - 0.5) * 6, 0.3 + rnd() * 0.2, 1.5 + rnd() * 1.5, col, 1, { vx: (rnd() - 0.5) * 30, vy: (rnd() - 0.5) * 30, vz: (rnd() - 0.5) * 30 });
    return p; };
  K.arrow = (x, y, o) => trail('arrow', x, y, o, o.col || '#eef3fa', 14, 1.6, '');
  K.bolt = (x, y, o) => trail('bolt', x, y, o, o.col || '#9dff6b', 22, 2.4, o.col2 || '#2d7a1e');
  K.nova = (x, y, o) => add(RING, 'nova', x, y, o.z != null ? o.z : 2, o.dur || 0.45, 3, { r: o.r || 90, sz2: o.w || 6, col: o.col || '#ffd36a', a: o.fill == null ? 0.14 : o.fill });
  K.heal = (x, y, o) => { if (o.ent) { x = o.ent.x; y = o.ent.y; } const h = o.ent ? entH(o.ent) : 28; const p = dot('heal', x, y, h * 0.4, 0.6, 14, '#7fd06a', 2, { a: 0.35, sz2: 0.8, vz: 20 });
    for (let i = 0, n = cnt(8); i < n; i++) add(PLUS, 'heal', x + (rnd() - 0.5) * 24, y + (rnd() - 0.5) * 12, rnd() * h * 0.6, 0.7 + rnd() * 0.3, 2, { vz: 30 + rnd() * 40, vx: (rnd() - 0.5) * 10, sz: 2.5 + rnd() * 2, col: i & 1 ? '#d8ffbf' : '#7fd06a' });
    return p; };
  K.shield = (x, y, o) => { const e = o.ent; const r = o.r || ((e ? e.r || 14 : 14) * 1.8 + 8); const z = o.z != null ? o.z : (e ? entH(e) * 0.5 : 20);
    return add(HEX, 'shield', e ? e.x : x, e ? e.y : y, z, o.dur || 3, 4, { ent: e || null, r, col: o.col || '#8fd3ff', ph: rnd() * TAU, rot: rnd() }); };
  K.levelup = (x, y, o) => { const e = o.ent || null; if (e) { x = e.x; y = e.y; } const col = o.col || '#ffd36a';
    const p = add(PILLAR, 'levelup', x, y, 0, o.dur || 1.2, 4, { ent: e, h: 160, sz: 36, col });
    add(RING, 'levelup', x, y, 2, 0.6, 3, { r: 70, sz2: 5, col, a: 0.1 }); add(RING, 'levelup', x, y, 2, 0.45, 3, { r: 40, sz2: 3, col: '#ffffff', a: 0 });
    for (let i = 0, n = cnt(18); i < n; i++) dot('levelup', x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 20, rnd() * 20, 0.9 + rnd() * 0.5, 2 + rnd() * 2.5, i % 3 ? col : '#fff6d6', 2, { vx: (rnd() - 0.5) * 30, vy: (rnd() - 0.5) * 15, vz: 60 + rnd() * 90, drag: 0.8, ph: rnd() * TAU });
    return p; };
  K.loot = (x, y, o) => { const rar = o.rar | 0, col = o.col || RAR_COL[Math.min(4, rar)] || RAR_COL[0]; const e = o.ent || null; if (e) { x = e.x; y = e.y; }
    const p = add(PILLAR, 'loot', x, y, 0, o.dur || 1.8, 4, { ent: e, h: 60 + rar * 20, sz: 10 + rar * 3, col, a: 0.75 });
    for (let i = 0, n = cnt(4 + rar * 2); i < n; i++) dot('loot', x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 8, rnd() * 10, 0.9 + rnd() * 0.7, 1.5 + rnd() * 2, col, 1, { vz: 25 + rnd() * 35, drag: 0.5, ph: rnd() * TAU });
    return p; };
  K.telegraph = (x, y, o) => add(TELE, 'telegraph', o.ent ? o.ent.x : x, o.ent ? o.ent.y : y, 1, o.dur || 1, 4, { ent: o.follow ? o.ent || null : null, r: o.r || 80, col: o.col || '#ff3b3b', ang: o.ang || 0, span: o.arc || 0, layer: 0 });
  K.dash = (x, y, o) => { const e = o.ent; const col = o.col || houseCol();
    if (!e) return add(GHOST, 'dash', x, y, 0, 0.3, 2, { sz: o.r || 14, col, face: o.face < 0 ? -1 : 1, layer: 0 });
    const p = add(EMIT, 'dash', e.x, e.y, 0, o.dur || 0.25, 3, { ent: e, every: 0.04, sub: 'dash', col, sz: e.r || 14 }); if (p) emitChild(p); return p; };
  K.dust = (x, y, o) => { if (A.length > CAP * 0.75) return null; let p = null; for (let i = 0, n = o.n || 1; i < n; i++) p = dot('dust', x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 4, 1 + rnd() * 3, 0.4, 2.5 + rnd() * 1.5, o.col || fx.dustCol || '#b9a58a', 0, { a: 0.55, vx: (rnd() - 0.5) * 16, vy: (rnd() - 0.5) * 8, vz: 6, sz2: 1, layer: 0 }); return p; };
  K.portal = (x, y, o) => { const e = o.ent || null; if (e) { x = e.x; y = e.y; }
    return add(EMIT, 'portal', x, y, 0, o.dur || (e ? 1e9 : 2), 4, { ent: e, every: 0.05, acc: 0.05, sub: 'portal', r: o.r || 40, col: o.col || '#b48cff', col2: o.col2 || '#e6d2ff', layer: 0, fl: 1 }); };
  // water (24_physics on entering water, 47_wildlife's fish): droplets that arc and fall back + a ring spreading on the surface
  K.splash = (x, y, o) => { const col = o.col || '#cfe3ee', n = cnt(o.n ? o.n + 3 : 6); const p = add(RING, 'splash', x, y, 1, 0.55, 2, { r: o.r || 22, sz2: 2, col: '#e4f0f6', a: 0 });
    for (let i = 0; i < n; i++) add(DROP, 'splash', x + (rnd() - 0.5) * 6, y + (rnd() - 0.5) * 4, 2, 0.6, 1, { vx: (rnd() - 0.5) * 70, vy: (rnd() - 0.5) * 40, vz: 50 + rnd() * 80, g: 520, sz: 1.3 + rnd() * 1.3, col: i & 1 ? col : '#ffffff' });
    return p; };
  K.ripple = (x, y, o) => add(RING, 'ripple', x, y, 1, o.dur || 0.9, 1, { r: o.r || 18, sz2: 1.5, col: o.col || '#dbeaf2', a: 0 });
  K.smoke = (x, y, o) => { let p = null; for (let i = 0, n = cnt(o.n || 6); i < n; i++) p = dot('smoke', x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 8, (o.z || 4) + rnd() * 8, 1.2 + rnd() * 0.8, 7 + rnd() * 6, o.col || '#6d6a66', 0, { a: 0.32, sz2: 2.2, vx: (rnd() - 0.5) * 12, vy: (rnd() - 0.5) * 6, vz: 18 + rnd() * 16, drag: 0.5, ph: rnd() * TAU }); return p; };
  fx.kinds = Object.keys(K);
  // names the skill / boss / event modules spawn → the closest kind with its colour (so none of them silently draws nothing)
  const KALIAS = { slam: ['nova', { col: '#c8b48a', r: 110, w: 8 }], warcry: ['nova', { col: '#ff9a4a', r: 120 }], rally: ['nova', { col: '#ffd36a', r: 110 }], taunt: ['nova', { col: '#ff5a4a', r: 90 }],
    dread: ['nova', { col: '#7a4aa8', r: 110 }], fire: ['nova', { col: '#ff7a2a', r: 80, fill: 0.22 }], frost: ['shatter', {}], raise: ['ash', {}], volley: ['arrow', {}], shaft: ['bolt', { col: '#fff2b0', col2: '#d8a83a' }],
    strike: ['slash', {}], peck: ['hit', { col: '#2a2a30', sz: 7 }], raven: ['hit', { col: '#2a2a30', sz: 7 }], snap: ['hit', { col: '#c8b48a' }], trap: ['hit', { col: '#c8b48a' }], water: ['splash', {}], wade: ['ripple', {}] };
  fx.alias = KALIAS;
  fx.spawn = (kind, x, y, o) => { let f = K[kind]; o = o || {}; if (!f) { const a = KALIAS[kind]; if (!a || !K[a[0]]) return null; f = K[a[0]]; o = Object.assign({}, a[1], o); } return f(x || 0, y || 0, o) || null; };
  fx.stop = p => { if (p && p.on) p.t = p.life; };
  fx.count = () => A.length;
  fx.clear = () => { while (A.length) release(A.length - 1); N.length = 0; pend.length = 0; shk.t = 0; fx.offset.x = fx.offset.y = 0; };
  /* ---- numbers: rise with an ease-out, land from 1.3 → 1, crits gold and bigger ---- */
  let seq = 0;
  // 3D: callers place numbers a little 'north' of the target (y − r·1.6, a 2D lift); seat the number above the nearest billboard's head instead
  function seat3d(n) { let best = null, bd = 56 * 56; const L = R.ents || [];
    for (let i = 0; i < L.length; i++) { const e = L[i]; if (!e || e.kind === 'drop' || e.kind === 'portal') continue; const dx = e.x - n.x, d0 = dx * dx + (e.y - n.y) ** 2, d1 = dx * dx + (e.y - (e.r || 14) * 1.6 - n.y) ** 2, d = Math.min(d0, d1); if (d < bd) { bd = d; best = e; } }
    if (best) { n.x = best.x; n.y = best.y; n.z = entH(best) + 6; } }
  fx.num = (x, y, txt, col, big) => { if (N.length >= NCAP) N.shift(); const n = { x, y, z: 60, txt: String(txt), col: col || (big ? '#ffd36a' : '#f3f6fa'), big: !!big, t: 0, life: big ? 1.1 : 0.85, dx: (rnd() - 0.5) * 18, seq: ++seq }; if (fx.is3d) seat3d(n); N.push(n); fx.stats.nums++; return n; };
  fx.numPose = n => { const k = Math.min(1, n.t / n.life); return { k, rise: (n.big ? 40 : 28) * eo(k), scale: 1.3 - 0.3 * eo(Math.min(1, n.t / 0.14)), alpha: k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35) }; };
  /* ---- shake: the renderer reads R.fx.offset; our own drawing applies it too (setTransform, so never twice) ---- */
  const shk = { a: 0, d: 1, t: 0 };
  fx.shake = (px, s) => { px = Math.min(24, (px || 6) * (fx.calm ? 0.5 : 1)); s = s || 0.25; const cur = shk.t > 0 ? shk.a * shk.t / shk.d : 0; if (px >= cur) { shk.a = px; shk.d = s; shk.t = s; } };
  /* ---- emitters' children ---- */
  function emitChild(p) {
    const e = p.ent;
    if (p.sub === 'dash') { if (!e) return; add(GHOST, 'dash', e.x, e.y, 0, 0.3, 2, { sz: p.sz, col: p.col, face: e.face < 0 ? -1 : 1, layer: 0 }); }
    else if (p.sub === 'portal') { const a = rnd() * TAU; add(ORBIT, 'portal', p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, 0, 1.1, 1, { ent: e, lx: p.x, ly: p.y, ang: a, r: p.r, vr: 2.6 + rnd() * 1.4, sz: 2 + rnd() * 1.5, col: rnd() < 0.5 ? p.col : p.col2 }); }
    else { // arrow / bolt trails follow a projectile: direction from its velocity or its last position
      if (!e) return; let dx = e.vx || 0, dy = e.vy || 0, dz = e.vz || 0; if (!dx && !dy) { dx = e.x - p.lx; dy = e.y - p.ly; } p.lx = e.x; p.ly = e.y; if (!dx && !dy && !dz) return;
      const z = e.z != null ? e.z : p.z; streak(p.sub, e.x, e.y, z, { x: dx, y: dy, z: dz }, { col: p.col, col2: p.col2, sz: p.sz, sz2: p.sz2 });
      if (p.col2 && rnd() < 0.5) dot(p.sub, e.x, e.y, z + (rnd() - 0.5) * 6, 0.3, 1.5 + rnd(), p.col, 1, { vz: (rnd() - 0.5) * 30 });
    }
  }
  /* ---- the hit numbers the combat module may or may not have drawn itself ---- */
  const pend = [];
  function flushPending() {
    for (const q of pend) { let dup = false; for (const n of N) if (n.t === 0 && Math.abs(n.x - q.x) + Math.abs(n.y - q.y) < 40) { dup = true; break; }
      if (!dup) fx.num(q.x, q.y, q.player ? '-' + Math.round(q.dmg) : Math.round(q.dmg), q.player ? '#ff6b6b' : (q.crit ? '#ffd36a' : '#f3f6fa'), !!q.crit); }
    pend.length = 0;
  }
  /* ---- footstep dust ---- */
  const LP = new WeakMap();
  function steps(dt) {
    const pl = R.player; if (!pl || pl.dead) return; const list = R.ents ? R.ents : [];
    for (let i = -1; i < list.length; i++) { const e = i < 0 ? pl : list[i]; if (!e || e.dead || (i >= 0 && (e === pl || e.kind !== 'companion'))) continue;
      let q = LP.get(e); if (!q) { LP.set(e, q = { x: e.x, y: e.y, t: 0 }); continue; }
      const d = Math.abs(e.x - q.x) + Math.abs(e.y - q.y); q.x = e.x; q.y = e.y; if (d < 0.4) continue;
      q.t += dt; if (q.t >= 0.13) { q.t = 0; fx.spawn('dust', e.x - (e.face || 1) * 4, e.y + 2, {}); } }
  }
  /* ---- update ---- */
  function update(dt) {
    if (shk.t > 0) { shk.t -= dt; const k = Math.max(0, shk.t / shk.d), a = shk.a * k * k; fx.offset.x = (rnd() * 2 - 1) * a; fx.offset.y = (rnd() * 2 - 1) * a; if (shk.t <= 0) fx.offset.x = fx.offset.y = 0; }
    else if (fx.offset.x || fx.offset.y) fx.offset.x = fx.offset.y = 0;
    if (pend.length) flushPending();
    for (let i = N.length - 1; i >= 0; i--) { const n = N[i]; n.t += dt; if (n.t >= n.life) N.splice(i, 1); }
    steps(dt);
    for (let i = A.length - 1; i >= 0; i--) {
      const p = A[i]; p.t += dt;
      if (p.t >= p.life) { if (p.k === HEX && p.life > 0.2) add(RING, 'shield', p.x, p.y, p.z, 0.25, 2, { r: p.r, sz2: 2, col: p.col, a: 0.1 }); release(i); continue; }
      switch (p.k) {
        case DOT: case PLUS: case SHARD: { const d = p.drag ? Math.max(0, 1 - p.drag * dt) : 1; p.vx *= d; p.vy *= d; if (p.drag) p.vz *= d; p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.k === SHARD) p.rot += p.vr * dt; if (p.z < 0 && p.g) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; } break; }
        case DROP: { if (!p.fl) { p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.fl = 1; p.layer = 0; p.t = Math.min(p.t, p.life * 0.4); } } break; }
        case HEX: { if (p.ent) { if (goneEnt(p.ent)) { p.t = p.life; break; } p.x = p.ent.x; p.y = p.ent.y; } p.rot += 0.6 * dt; break; }
        case PILLAR: case RING: case TELE: { if (p.ent) { if (gone(p.ent)) { if (p.k === PILLAR) p.t = Math.max(p.t, p.life * 0.6); } else { p.x = p.ent.x; p.y = p.ent.y; } } break; }
        case EMIT: { if (p.ent) { if (p.fl ? gone(p.ent) || (p.sub === 'portal' && goneEnt(p.ent)) : goneEnt(p.ent)) { p.t = p.life; break; } if (p.sub !== 'arrow' && p.sub !== 'bolt') { p.x = p.ent.x; p.y = p.ent.y; } }
          p.acc += dt; let n = 0; while (p.acc >= p.every && n++ < 6) { p.acc -= p.every; emitChild(p); } if (p.sub === 'portal') p.rot += 1.6 * dt; break; }
        case ORBIT: { const k = p.t / p.life; p.ang += p.vr * dt; const cx = p.ent && !gone(p.ent) ? p.ent.x : p.lx, cy = p.ent && !gone(p.ent) ? p.ent.y : p.ly, rr = p.r * (1 - k * 0.9); p.x = cx + Math.cos(p.ang) * rr; p.y = cy + Math.sin(p.ang) * rr; p.z = k * 46; break; }
      }
    }
  }
  /* ---- drawing: everything projected through R.w2s(x, y, z) in screen space, sizes by R.cam.z ---- */
  let Z = 1, is3d = false, VW = 390, VH = 844;
  function pj(x, y, z) { const s = R.w2s(x, y, z); if (!is3d && z) s.y -= z * Z; return s; }
  const vis = (s, m) => s && s.x > -m && s.x < VW + m && s.y > -m && s.y < VH + m && s.x === s.x && s.y === s.y;
  function groundPoly(ctx, x, y, z, r, n, a0, a1, close) { // a polygon sampled on the ground circle, each point projected
    const sect = a1 != null; const from = sect ? a0 : 0, to = sect ? a1 : TAU; if (sect) { const c = pj(x, y, z); ctx.moveTo(c.x, c.y); }
    for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; const s = pj(x + Math.cos(a) * r, y + Math.sin(a) * r, z); if (i || sect) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); }
    if (close || sect) ctx.closePath();
  }
  function drawP(ctx, p) {
    const k = Math.min(1, p.t / p.life);
    switch (p.k) {
      case DOT: { const s = pj(p.x, p.y, p.z); if (!vis(s, 40)) return; let al = p.a * (k < 0.1 ? k / 0.1 : k > 0.5 ? (1 - k) / 0.5 : 1); if (p.ph) al *= 0.72 + 0.28 * Math.sin(R.t * 18 + p.ph); const r = (p.sz + p.sz2 * k * p.sz) * Z; ctx.globalAlpha = al; ctx.drawImage(soft(p.col), s.x - r, s.y - r, r * 2, r * 2); return; }
      case PLUS: { const s = pj(p.x, p.y, p.z); if (!vis(s, 40)) return; const r = p.sz * Z; ctx.globalAlpha = 1 - k; ctx.fillStyle = p.col; ctx.fillRect(s.x - r, s.y - r / 3, r * 2, r * 2 / 3); ctx.fillRect(s.x - r / 3, s.y - r, r * 2 / 3, r * 2); return; }
      case SHARD: { const s = pj(p.x, p.y, p.z); if (!vis(s, 40)) return; const c = Math.cos(p.rot) * p.sz * Z, sn = Math.sin(p.rot) * p.sz * Z; ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = p.sz2 * Z; ctx.beginPath(); ctx.moveTo(s.x - c, s.y - sn); ctx.lineTo(s.x + c, s.y + sn); ctx.stroke(); return; }
      case DROP: { const s = pj(p.x, p.y, p.z); if (!vis(s, 40)) return; ctx.fillStyle = p.col; ctx.beginPath(); if (p.fl) { ctx.globalAlpha = 0.9 * (1 - k); ctx.ellipse(s.x, s.y, p.sz * 1.8 * Z, p.sz * 0.7 * Z, 0, 0, TAU); } else { ctx.globalAlpha = 0.95; ctx.arc(s.x, s.y, p.sz * Z, 0, TAU); } ctx.fill(); return; }
      case STREAK: { const a = pj(p.x, p.y, p.z); if (!vis(a, 80)) return; const b = pj(p.x - p.vx * p.sz, p.y - p.vy * p.sz, p.z - p.vz * p.sz);
        if (p.col2) { ctx.globalAlpha = 0.35 * (1 - k); ctx.strokeStyle = p.col2; ctx.lineWidth = p.sz2 * 3 * Z; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = p.sz2 * Z; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); return; }
      case SLASH: { const c = pj(p.x, p.y, p.z); if (!vis(c, p.r * Z + 60)) return; const pr = eo(k), s = p.face, n = 10; const a0 = p.ang + s * (-p.span / 2 + p.span * Math.max(0, pr - 0.65)), a1 = p.ang + s * (-p.span / 2 + p.span * pr); if (a0 === a1) return;
        const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(pj(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, p.z)); }
        const al = Math.pow(1 - k, 0.6); ctx.globalAlpha = al * 0.55; ctx.strokeStyle = p.col; ctx.lineWidth = 7 * Z; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i <= n; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        ctx.globalAlpha = al; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4 * Z; ctx.beginPath(); ctx.moveTo(pts[5].x, pts[5].y); for (let i = 6; i <= n; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); return; }
      case RING: { const c = pj(p.x, p.y, p.z); if (!vis(c, p.r * Z + 60)) return; const r = p.r * eo(k); ctx.beginPath(); groundPoly(ctx, p.x, p.y, p.z, r, 28, null, null, true);
        if (p.a) { ctx.globalAlpha = p.a * (1 - k); ctx.fillStyle = p.col; ctx.fill(); } ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = (p.sz2 * (1 - k) + 1) * Z; ctx.stroke(); return; }
      case PILLAR: { const b = pj(p.x, p.y, 0); if (!vis(b, p.h * Z + 60)) return; const tp = pj(p.x, p.y, p.h); const al = Math.min(1, p.t / 0.1) * (k > 0.5 ? (1 - k) / 0.5 : 1) * (p.a || 1); const w = p.sz * Z * (0.8 + 0.4 * (1 - k)), wt = w * 0.55;
        const g = ctx.createLinearGradient(b.x, b.y, tp.x, tp.y); g.addColorStop(0, rgba(p.col, 0.9)); g.addColorStop(0.55, rgba(p.col, 0.5)); g.addColorStop(1, rgba(p.col, 0));
        ctx.globalAlpha = al; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b.x - w / 2, b.y); ctx.lineTo(b.x + w / 2, b.y); ctx.lineTo(tp.x + wt / 2, tp.y); ctx.lineTo(tp.x - wt / 2, tp.y); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = al * 0.7; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(b.x - w * 0.14, b.y); ctx.lineTo(b.x + w * 0.14, b.y); ctx.lineTo(tp.x + wt * 0.1, tp.y + (b.y - tp.y) * 0.15); ctx.lineTo(tp.x - wt * 0.1, tp.y + (b.y - tp.y) * 0.15); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = al * 0.5; ctx.fillStyle = p.col; ctx.beginPath(); groundPoly(ctx, p.x, p.y, 0, p.sz * 0.9, 16, null, null, true); ctx.fill(); return; }
      case HEX: { const c = pj(p.x, p.y, p.z); if (!vis(c, p.r * Z + 60)) return; const al = Math.min(1, p.t / 0.15) * (k > 0.85 ? (1 - k) / 0.15 : 1); const r = p.r * Z * (1 + 0.04 * Math.sin(R.t * 6 + p.ph));
        ctx.globalAlpha = al; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = p.rot + i * Math.PI / 3; const px = c.x + Math.cos(a) * r, py = c.y + Math.sin(a) * r * 0.92; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath();
        ctx.fillStyle = rgba(p.col, 0.13); ctx.fill(); ctx.strokeStyle = p.col; ctx.lineWidth = 2 * Z; ctx.stroke();
        ctx.globalAlpha = al * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 * Z; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.82, p.rot * 1.5, p.rot * 1.5 + 0.9); ctx.stroke(); return; }
      case TELE: { const c = pj(p.x, p.y, p.z); if (!vis(c, p.r * Z + 80)) return; const a0 = p.span ? p.ang - p.span / 2 : null, a1 = p.span ? p.ang + p.span / 2 : null;
        ctx.globalAlpha = 0.55 + 0.15 * Math.sin(R.t * 10); ctx.strokeStyle = p.col; ctx.lineWidth = 2 * Z; ctx.beginPath(); groundPoly(ctx, p.x, p.y, p.z, p.r, 30, a0, a1, true); ctx.stroke();
        ctx.globalAlpha = 0.2 + 0.2 * k; ctx.fillStyle = p.col; ctx.beginPath(); groundPoly(ctx, p.x, p.y, p.z, p.r * k, 30, a0, a1, true); ctx.fill();
        if (k > 0.85) { ctx.globalAlpha = (k - 0.85) / 0.15 * 0.7; ctx.fillStyle = '#ffffff'; ctx.beginPath(); groundPoly(ctx, p.x, p.y, p.z, p.r, 30, a0, a1, true); ctx.fill(); } return; }
      case GHOST: { const s = pj(p.x, p.y, 0); if (!vis(s, 80)) return; const w = p.sz * 1.3 * Z, h = p.sz * 2.6 * Z; ctx.globalAlpha = 0.4 * (1 - k); ctx.fillStyle = p.col; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(s.x - w / 2, s.y - h, w, h, w / 2); else ctx.ellipse(s.x, s.y - h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill(); return; }
      case FLASH: { const s = pj(p.x, p.y, p.z); if (!vis(s, 60)) return; const r = p.sz * Z * (1 + k); ctx.globalAlpha = 1 - k; ctx.drawImage(soft(p.col), s.x - r * 1.6, s.y - r * 1.6, r * 3.2, r * 3.2);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * Z; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = p.rot + i * Math.PI / 2, l = r * 2.2 * (1 - k * 0.5); ctx.moveTo(s.x + Math.cos(a) * r * 0.3, s.y + Math.sin(a) * r * 0.3); ctx.lineTo(s.x + Math.cos(a) * l, s.y + Math.sin(a) * l); } ctx.stroke(); return; }
      case EMIT: { if (p.sub !== 'portal') return; const c = pj(p.x, p.y, 0); if (!vis(c, p.r * Z + 60)) return; const al = Math.min(1, p.t / 0.3) * (p.life < 1e8 && k > 0.8 ? (1 - k) / 0.2 : 1);
        ctx.globalAlpha = al * 0.35; ctx.strokeStyle = p.col; ctx.lineWidth = 2.5 * Z; ctx.beginPath(); groundPoly(ctx, p.x, p.y, 0, p.r, 24, null, null, true); ctx.stroke();
        ctx.globalAlpha = al * 0.9; ctx.strokeStyle = p.col2; ctx.lineWidth = 1.6 * Z; for (let j = 0; j < 2; j++) { const a0 = p.rot + j * Math.PI; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = a0 + i / 8 * 1.6, rr = p.r * (1 - i / 8 * 0.3); const s = pj(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, i * 2); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); } ctx.stroke(); } return; }
      case ORBIT: { const s = pj(p.x, p.y, p.z); if (!vis(s, 40)) return; const r = p.sz * Z * (1 - k * 0.5); ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 * 0.8; ctx.drawImage(soft(p.col), s.x - r, s.y - r, r * 2, r * 2); return; }
    }
  }
  function drawNums(ctx) {
    const zs = Math.min(1.6, Math.max(0.7, Z)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const n of N) { const q = fx.numPose(n); const s = pj(n.x + n.dx * q.k, n.y, n.z); if (!vis(s, 80)) continue; const px = (n.big ? 22 : 15) * q.scale * zs, y = s.y - q.rise * zs;
      ctx.globalAlpha = q.alpha; ctx.font = '900 ' + px.toFixed(1) + 'px Cinzel,Georgia,serif'; ctx.lineWidth = (n.big ? 4 : 3) * zs; ctx.strokeStyle = 'rgba(6,11,20,0.85)'; ctx.strokeText(n.txt, s.x, y); ctx.fillStyle = n.col; ctx.fillText(n.txt, s.x, y); }
  }
  function drawAll(ctx) {
    if (!A.length && !N.length) return;
    VW = R.vw || 390; VH = R.vh || 844; Z = R.cam.z > 0 ? R.cam.z : 1;
    const a = R.w2s(R.cam.x, R.cam.y, 0), b = R.w2s(R.cam.x, R.cam.y, 100); is3d = fx.is3d = !!(a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 0.01);
    const dpr = R.dpr || 1; ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, fx.offset.x * dpr, fx.offset.y * dpr); ctx.lineCap = 'round';
    for (let i = 0; i < A.length; i++) if (A[i].layer === 0) drawP(ctx, A[i]);
    for (let i = 0; i < A.length; i++) if (A[i].layer !== 0) drawP(ctx, A[i]);
    ctx.globalAlpha = 1; if (N.length) drawNums(ctx); ctx.globalAlpha = 1; ctx.restore();
  }
  let byRenderer = false;
  const sys = R.addSys('vfx', { order: 905, update,
    drawWorld: ctx => { byRenderer = true; drawAll(ctx); },
    draw: ctx => { if (byRenderer) { byRenderer = false; return; } if (!R.sysList.some(s => s !== sys && s.draw)) { const d = R.dpr || 1; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, R.vw || 390, R.vh || 844); } drawAll(ctx); } });
  fx.sys = sys;
  /* ---- hooks ---- */
  if (R.bus && R.bus.on) {
    R.bus.on('hit', info => { if (!info || !info.tgt) return; const t = info.tgt, h = entH(t);
      fx.spawn('hit', t.x, t.y, { z: h * 0.55, kind: info.kind, col: info.col });
      if (info.dmg != null && !info.silent) pend.push({ x: t.x, y: t.y, dmg: info.dmg, crit: !!info.crit, player: t.kind === 'player' });
      if (t.kind === 'player' && (info.dmg || 0) > 0) fx.shake(info.crit ? 5 : 2.5, 0.14); });
    R.bus.on('kill', m => { if (!m) return; const md = R.data && R.data.mobs && R.data.mobs[m.type]; const arch = [m.type, m.arch, m.cat, md && md.arch, md && md.beh, md && md.cat, md && md.sprite].filter(Boolean).join(' ');
      const h = entH(m);
      if (/walker|wraith|ice|frost|white|snow/i.test(arch)) fx.spawn('shatter', m.x, m.y, { h });
      else if (/wight|skel|bone|ghoul|undead|dead|shade/i.test(arch) || m.kind === 'boss') fx.spawn('ash', m.x, m.y, { h });
      else { fx.spawn('blood', m.x, m.y, { h }); fx.spawn('dust', m.x, m.y, { n: 2 }); }
      if (m.kind === 'boss' || /giant|mammoth|dragon/i.test(arch)) fx.shake(8, 0.35); });
    // wading: every footstep in water (24_physics: e.wading / e.depth) leaves a ring and a few drops, near the hero only
    R.bus.on('footstep', e => { if (!e || !(e.wading || (e.depth || 0) >= 0.5)) return; const pl = R.player; if (pl && e !== pl && Math.hypot(e.x - pl.x, e.y - pl.y) > 500) return;
      fx.spawn('ripple', e.x, e.y, { r: (e.r || 14) * 1.2, dur: 0.8 }); if (e === pl) for (let i = 0; i < 2; i++) add(DROP, 'splash', e.x, e.y, 2, 0.4, 0, { vx: (rnd() - 0.5) * 50, vy: (rnd() - 0.5) * 30, vz: 30 + rnd() * 40, g: 520, sz: 1.2 + rnd(), col: '#e4f0f6' }); });
    R.bus.on('levelup', () => { const pl = R.player; if (pl) fx.spawn('levelup', pl.x, pl.y, { ent: pl }); });
    R.bus.on('loot', item => { if (!item) return; const e = item.ent || item.drop || null; const x = e ? e.x : item.x != null ? item.x : R.player ? R.player.x : 0, y = e ? e.y : item.y != null ? item.y : R.player ? R.player.y : 0;
      if ((item.rar | 0) >= 2) fx.spawn('loot', x, y, { rar: item.rar, ent: e }); else for (let i = 0, n = cnt(4); i < n; i++) dot('loot', x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 6, rnd() * 8, 0.6, 1.5 + rnd(), RAR_COL[item.rar | 0] || RAR_COL[0], 1, { vz: 30 + rnd() * 20 }); });
    R.bus.on('boss', (id, phase) => { fx.shake(phase ? 10 : 6, 0.4); });
    R.bus.on('death', () => { const pl = R.player; fx.shake(12, 0.5); if (pl) fx.spawn('ash', pl.x, pl.y, { h: entH(pl) }); });
    R.bus.on('respawn', () => { const pl = R.player; if (pl) fx.spawn('nova', pl.x, pl.y, { r: 70, col: houseCol() }); });
  }
})();
