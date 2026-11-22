/* HOLDOR RPG — 63_spellfx.js (S1): the 3D spell + loot effect layer, inside R.render3d.scene (complements 60_vfx's 2D overlay).
   Five pooled batches, all built once, hidden while empty (0 draw calls idle, ≤ 6 busy):
     pts   — THREE.Points, additive: embers, sparks, motes, fireball heads, arrow streaks, sparkles
     mist  — THREE.Points, normal blending: dust wakes, green mist, dark feathers
     decal — instanced ground quads, additive, one canvas atlas (ring · crescent · soft disc · star burst): novas, shock rings, cleave arcs, scorch, pools
     beam  — instanced open cylinders, additive, vertical fade: heal columns, loot beams, the level-up pillar
     gem / coin — InstancedMesh (Lambert): item tokens bobbing over a drop, gold coins spinning as a cluster
   Hooks (bus): 'cast' (id, slot) → by R.data.skills[id].kind; R.skills.shots (tagged on 'cast') → fireballs / flasks / arrows in flight + impacts;
   R.skills.zones → arrow rain, fire rain, wildfire pools; R.ents kind 'proj' → streak trails, 'projend' → impact puffs; kind 'trap' → green mist;
   kind 'drop' → tokens + rarity beams (rare+), 'remove' of a taken drop → magnet arc + sparkle into the hero; 'hit' {kind fire/ice/poison}
   → a small 3D burst; 'heal' {tgt} → motes; 'levelup' → light pillar + spiralling motes.
   API: R.spellfx = { on, why, play(kind, x, y, o), clear(), count(), stats, kinds }. prefers-reduced-motion halves every count.
   Never throws at load; without THREE (or without a 3D scene) it does nothing. */
(function () {
  'use strict';
  const SF = R.spellfx = { on: false, why: '', stats: { calls: 0, ms: 0, msMax: 0, spawned: 0, dropped: 0 }, kinds: [] };
  const T = window.THREE;
  if (!T) { SF.why = 'no THREE'; return; }
  let calm = false; try { calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  SF.calm = calm;
  const cnt = n => calm ? Math.max(1, Math.ceil(n / 2)) : n;
  const TAU = Math.PI * 2, rnd = Math.random, rr = (a, b) => a + rnd() * (b - a);
  const RAR_DEF = ['#b9c4cf', '#5fbf6a', '#4fb0ff', '#b47cff', '#ff9a3c'];
  const rarCol = r => { r = Math.max(0, Math.min(4, r | 0)); try { const I = R.items; if (I && typeof I.rarCol === 'function') { const c = I.rarCol(r); if (c) return c; } if (I && I.RAR && I.RAR[r] && I.RAR[r].col) return I.RAR[r].col; } catch (e) {} return RAR_DEF[r]; };
  // '#rrggbb' → [r, g, b] 0..1 (display values: the shaders write them as they are), cached
  const CC = new Map();
  const rgb = h => { let c = CC.get(h); if (c) return c; const s = String(h || '#ffffff').replace('#', ''); const f = s.length === 3 ? s.split('').map(q => q + q).join('') : s.padEnd(6, 'f');
    c = [parseInt(f.slice(0, 2), 16) / 255, parseInt(f.slice(2, 4), 16) / 255, parseInt(f.slice(4, 6), 16) / 255]; if (c.some(isNaN)) c = [1, 1, 1]; CC.set(h, c); return c; };

  /* ---------------- CPU pools ---------------- */
  const PCAP = 700, DCAP = 64, BCAP = 32, GCAP = 48, CCAP = 96, MCAP = 32;
  SF.CAP = { pts: PCAP, decal: DCAP, beam: BCAP, gem: GCAP, coin: CCAP, mover: MCAP };
  // particles: struct of arrays; blend 0 = additive (pts), 1 = normal (mist)
  const F = n => new Float32Array(n);
  const P = { x: F(PCAP), y: F(PCAP), z: F(PCAP), vx: F(PCAP), vy: F(PCAP), vz: F(PCAP), age: F(PCAP), life: F(PCAP), s0: F(PCAP), s1: F(PCAP),
    r: F(PCAP), g: F(PCAP), b: F(PCAP), a: F(PCAP), grav: F(PCAP), drag: F(PCAP), mode: new Uint8Array(PCAP), bl: new Uint8Array(PCAP),
    ox: F(PCAP), oz: F(PCAP), orad: F(PCAP), oang: F(PCAP), ospd: F(PCAP), oy: F(PCAP), ob: F(PCAP), fol: new Uint8Array(PCAP) };
  const pLive = new Int32Array(PCAP); let pN = 0; const pFree = []; for (let i = PCAP - 1; i >= 0; i--) pFree.push(i);
  // particle(o): x/y/z three coords; o = {vx,vy,vz, life, s0, s1, col, a, grav, drag, mist, delay, orbit:{cx,cz,r,ang,spd,fol}}
  function part(x, y, z, o) {
    let i = pFree.pop(); if (i === undefined) { SF.stats.dropped++; return -1; }
    const c = rgb(o.col); P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = o.vx || 0; P.vy[i] = o.vy || 0; P.vz[i] = o.vz || 0;
    P.age[i] = -(o.delay || 0); P.life[i] = o.life || 0.5; P.s0[i] = o.s0 || 8; P.s1[i] = o.s1 == null ? P.s0[i] : o.s1; P.r[i] = c[0]; P.g[i] = c[1]; P.b[i] = c[2];
    P.a[i] = o.a == null ? 1 : o.a; P.grav[i] = o.grav || 0; P.drag[i] = o.drag || 0; P.bl[i] = o.mist ? 1 : 0; P.mode[i] = 0; P.fol[i] = 0;
    if (o.orbit) { const q = o.orbit; P.mode[i] = 1; P.ox[i] = q.cx; P.oz[i] = q.cz; P.orad[i] = q.r; P.oang[i] = q.ang; P.ospd[i] = q.spd; P.ob[i] = gY(q.cx, q.cz); P.oy[i] = y - P.ob[i]; P.fol[i] = q.fol ? 1 : 0; }
    pLive[pN++] = i; SF.stats.spawned++; return i;
  }
  // decals: ground quads; cell 0 ring, 1 crescent, 2 disc, 3 burst
  const dec = []; for (let i = 0; i < DCAP; i++) dec.push({ on: false });
  function decal(x, y, z, o) {
    let d = null; for (const q of dec) if (!q.on) { d = q; break; } if (!d) { SF.stats.dropped++; return null; }
    d.on = true; d.x = x; d.y = y; d.z = z; d.age = -(o.delay || 0); d.life = o.life || 0.5; d.r0 = o.r0 == null ? 10 : o.r0; d.r1 = o.r1 == null ? d.r0 : o.r1; d.rot = o.rot || 0; d.vrot = o.vrot || 0;
    d.c = rgb(o.col); d.a = o.a == null ? 1 : o.a; d.cell = o.cell | 0; d.fol = !!o.fol; d.ease = o.ease || 0; d.hold = o.hold || 0; d.sx = o.sx || 1; SF.stats.spawned++; return d;
  }
  const bms = []; for (let i = 0; i < BCAP; i++) bms.push({ on: false });
  function beam(x, y, z, o) {
    let b = null; for (const q of bms) if (!q.on) { b = q; break; } if (!b) { SF.stats.dropped++; return null; }
    b.on = true; b.x = x; b.y = y; b.z = z; b.age = -(o.delay || 0); b.life = o.life || 1; b.rad = o.r || 20; b.h = o.h || 160; b.c = rgb(o.col); b.a = o.a == null ? 1 : o.a; b.fol = !!o.fol; b.grow = o.grow || 0.15; SF.stats.spawned++; return b;
  }
  // movers: a picked-up drop flying in an arc into the hero
  const mov = []; for (let i = 0; i < MCAP; i++) mov.push({ on: false });

  /* ---------------- world helpers ---------------- */
  let R3 = null, gY = (x, y) => 0;
  const hero = () => (R.player && !R.player.dead ? R.player : null);
  const heroH = () => { const p = hero(); if (!p) return 64; try { const fe = R.fx && R.fx.entH; const h = fe ? fe(p) : 0; if (h > 20 && h < 200) return h; } catch (e) {} return 64; };
  const near = (x, y) => { const p = hero(); const cx = p ? p.x : (R.cam ? R.cam.x : x), cy = p ? p.y : (R.cam ? R.cam.y : y); return Math.abs(x - cx) < 1500 && Math.abs(y - cy) < 1500; };

  /* ---------------- effect recipes (world x, y on the ground; h = height above it) ---------------- */
  const PAL = {
    fire: { core: '#fff1c4', mid: '#ffb347', ember: '#ff6a1a', ring: '#ff8a3a', dark: '#c2410c' },
    wild: { core: '#eaffc4', mid: '#9dff6b', ember: '#4fd13a', ring: '#7fe05a', dark: '#2f8a25' },
    frost: { core: '#ffffff', mid: '#bfeeff', ember: '#7fd3ff', ring: '#9fe3ff', dark: '#3b82c4' },
    holy: { core: '#fff8dc', mid: '#ffe28a', ember: '#ffc94a', ring: '#ffd36a', dark: '#c99a2e' },
    steel: { core: '#ffffff', mid: '#e8f0ff', ember: '#c8d6ea', ring: '#dfe8f5', dark: '#8aa0b8' },
    arrow: { core: '#fffbe8', mid: '#f3e7c4', ember: '#d9c48f', ring: '#efe2b8', dark: '#8a7a50' },
    dread: { core: '#e9d6ff', mid: '#b07cff', ember: '#7a3fd0', ring: '#9a64ff', dark: '#24122f' },
    war: { core: '#fff4dc', mid: '#ffd7a0', ember: '#ff9a5a', ring: '#ffc884', dark: '#b4542a' }
  };
  const W = (x, y, h) => [x, gY(x, y) + (h || 0), y];       // world → three
  function burst(x, y, h, pal, n, o) { o = o || {}; const q = W(x, y, h); n = cnt(n);
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = rr(o.sp0 || 120, o.sp1 || 300), up = rr(o.up0 == null ? 40 : o.up0, o.up1 == null ? 220 : o.up1);
      part(q[0], q[1], q[2], { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up, life: rr(0.35, o.life || 0.7), s0: rr(o.sz0 || 5, o.sz1 || 10), s1: 1, col: i % 3 ? pal.ember : pal.mid, grav: o.grav == null ? 420 : o.grav, drag: 2.2 }); }
    part(q[0], q[1], q[2], { life: 0.16, s0: o.flash || 60, s1: (o.flash || 60) * 1.5, col: pal.core, a: 0.9 }); }
  function ring(x, y, pal, r0, r1, life, o) { o = o || {}; const q = W(x, y, 3 + Math.min(10, r1 * 0.03)); return decal(q[0], q[1], q[2], Object.assign({ r0, r1, life, col: pal.ring, cell: 0, ease: 1 }, o)); }
  function motes(x, y, pal, n, o) { o = o || {}; n = cnt(n); const g = gY(x, y);
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, r = rr(o.r0 || 6, o.r1 || 30);
      part(x + Math.cos(a) * r, g + rr(o.h0 || 4, o.h1 || 30), y + Math.sin(a) * r, { vy: rr(o.vy0 || 50, o.vy1 || 120), life: rr(o.l0 || 0.7, o.l1 || 1.3), s0: rr(4, 8), s1: 2, col: i & 1 ? pal.mid : pal.core, delay: rr(0, o.spread || 0.3), drag: 0.5,
        orbit: o.orbit ? { cx: x, cz: y, r, ang: a, spd: rr(3, 5.5) * (i & 1 ? 1 : -1), fol: !!o.fol } : null }); } }

  const FX = {
    // a fireball head + ember trail at (x, y, h): one step of a projectile in flight
    trail(x, y, h, pal, big, dx, dy) { const q = W(x, y, h); const s = big ? 24 : 8;
      part(q[0], q[1], q[2], { life: 0.09, s0: s, s1: s * 0.6, col: pal.core, a: 1 });
      if (big) { part(q[0], q[1], q[2], { life: 0.12, s0: s * 2.1, s1: s * 1.2, col: pal.mid, a: 0.55 });
        if (rnd() < (calm ? 0.5 : 1)) part(q[0] + rr(-4, 4), q[1] + rr(-4, 4), q[2] + rr(-4, 4), { vx: -dx * 60 + rr(-40, 40), vy: rr(10, 80), vz: -dy * 60 + rr(-40, 40), life: rr(0.3, 0.6), s0: rr(4, 8), s1: 1, col: rnd() < 0.5 ? pal.ember : pal.mid, grav: -30, drag: 1.5 });
        if (!calm && rnd() < 0.35) part(q[0], q[1] + 6, q[2], { vy: rr(20, 50), life: rr(0.5, 0.9), s0: 10, s1: 22, col: '#3a3330', a: 0.28, mist: true, drag: 1 }); }
      else part(q[0] - dx * 7, q[1], q[2] - dy * 7, { life: 0.07, s0: s * 0.8, s1: s * 0.4, col: pal.mid, a: 0.7 }); },
    fire(x, y, o) { o = o || {}; const pal = o.pal || PAL.fire; const r = o.r || 40;
      burst(x, y, 18, pal, 18, { flash: 70, sp0: 140, sp1: 340 });
      ring(x, y, pal, r * 0.5, r * 1.9, 0.5); const q = W(x, y, 2.5); decal(q[0], q[1], q[2], { r0: r * 1.3, r1: r * 1.5, life: 1.1, col: pal.dark, a: 0.7, cell: 3, rot: rnd() * TAU });
      decal(q[0], q[1], q[2], { r0: r, r1: r * 1.2, life: 0.9, col: pal.ember, a: 0.55, cell: 2 });
      for (let i = 0; i < cnt(5); i++) { const a = rnd() * TAU, d = rr(0, r * 0.8); const g = W(x + Math.cos(a) * d, y + Math.sin(a) * d, 6); part(g[0], g[1], g[2], { vy: rr(10, 30), life: rr(0.6, 1.1), s0: 14, s1: 34, col: '#4a3a32', a: 0.32, mist: true, drag: 0.8, delay: rr(0, 0.15) }); } },
    frost(x, y, o) { o = o || {}; const pal = PAL.frost, r = o.r || 130; const g = gY(x, y);
      ring(x, y, pal, 12, r, 0.45, { a: 1 }); ring(x, y, pal, 8, r * 0.75, 0.55, { a: 0.6, delay: 0.08 });
      const q = W(x, y, 3); decal(q[0], q[1], q[2], { r0: r * 0.4, r1: r * 1.1, life: 0.5, col: pal.mid, a: 0.75, cell: 3, rot: rnd() * TAU, ease: 1 });
      decal(q[0], q[1], q[2], { r0: r * 0.9, r1: r, life: 1.4, col: pal.dark, a: 0.5, cell: 2, hold: 0.5 });
      const n = cnt(26); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr(-0.1, 0.1), s = rr(260, 420);
        part(x + Math.cos(a) * 10, g + rr(6, 20), y + Math.sin(a) * 10, { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rr(60, 180), life: rr(0.35, 0.55), s0: rr(6, 11), s1: 2, col: i % 3 ? pal.mid : pal.core, grav: 500, drag: 2.4 }); }
      // shards that stand a moment on the ring, then fade
      const m = cnt(10); for (let i = 0; i < m; i++) { const a = rnd() * TAU, d = r * rr(0.55, 0.95);
        part(x + Math.cos(a) * d, g + rr(4, 14), y + Math.sin(a) * d, { vy: rr(30, 70), life: rr(0.7, 1.1), s0: rr(8, 12), s1: 3, col: pal.core, delay: 0.25 * d / r, drag: 2 }); }
      part(x, g + 26, y, { life: 0.22, s0: 110, s1: 170, col: pal.mid, a: 0.6 }); },
    heal(x, y, o) { o = o || {}; const pal = PAL.holy; const q = W(x, y, 0); const H = heroH();
      beam(q[0], q[1], q[2], { r: o.r || 26, h: H * 2.6, life: 1.2, col: pal.mid, a: 0.85, fol: !!o.fol });
      decal(q[0], q[1] + 2.5, q[2], { r0: 24, r1: 46, life: 1.2, col: pal.ring, a: 0.8, cell: 2, fol: !!o.fol, hold: 0.4 });
      ring(x, y, pal, 10, 60, 0.6, { fol: !!o.fol });
      motes(x, y, pal, 22, { r0: 8, r1: 34, h0: 2, h1: H * 0.9, vy0: 50, vy1: 120, l0: 0.8, l1: 1.4, orbit: true, fol: !!o.fol, spread: 0.5 }); },
    smallheal(x, y) { motes(x, y, PAL.holy, 6, { r0: 6, r1: 20, h0: 10, h1: 50, l0: 0.5, l1: 0.9, spread: 0.2 }); },
    cleave(x, y, o) { o = o || {}; const pal = o.pal || PAL.steel; const r = o.r || 90; const ang = o.ang || 0; const q = W(x, y, 4);
      if ((o.arc || 110) >= 360) { decal(q[0], q[1], q[2], { r0: r * 0.7, r1: r * 1.1, life: 0.32, col: pal.mid, a: 1, cell: 1, rot: ang, vrot: 16 });
        decal(q[0], q[1], q[2], { r0: r * 0.6, r1: r * 1.05, life: 0.32, col: pal.ring, a: 0.8, cell: 1, rot: ang + Math.PI, vrot: 16 }); ring(x, y, pal, r * 0.4, r * 1.15, 0.3, { a: 0.6 }); }
      else { decal(q[0], q[1], q[2], { r0: r * 0.75, r1: r * 1.12, life: 0.3, col: pal.mid, a: 1, cell: 1, rot: ang, vrot: 2.5, sx: 1 });
        decal(q[0], q[1] + 0.5, q[2], { r0: r * 0.55, r1: r * 0.9, life: 0.24, col: pal.core, a: 0.6, cell: 1, rot: ang, vrot: 3 }); }
      const n = cnt(10), g = gY(x, y), span = Math.min(TAU, ((o.arc || 110) * Math.PI) / 180);
      for (let i = 0; i < n; i++) { const a = ang + (i / (n - 1 || 1) - 0.5) * span, d = r * rr(0.8, 1.05);
        part(x + Math.cos(a) * d, g + rr(14, 36), y + Math.sin(a) * d, { vx: Math.cos(a) * 120, vz: Math.sin(a) * 120, vy: rr(20, 90), life: rr(0.2, 0.4), s0: rr(4, 8), s1: 1, col: o.bleed && i % 2 ? '#ff4a4a' : pal.core, grav: 300, drag: 2 }); } },
    dash(x0, y0, x1, y1, o) { o = o || {}; const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L; const n = cnt(Math.max(4, Math.min(16, Math.round(L / 12))));
      for (let i = 0; i < n; i++) { const k = i / (n - 1 || 1), x = x0 + (x1 - x0) * k + rr(-8, 8), y = y0 + (y1 - y0) * k + rr(-8, 8); const g = gY(x, y);
        part(x, g + rr(3, 10), y, { vx: -uy * rr(-50, 50) - ux * 30, vz: ux * rr(-50, 50) - uy * 30, vy: rr(15, 45), life: rr(0.6, 1.0), s0: rr(14, 22), s1: rr(36, 54), col: '#b8a27e', a: 0.42, mist: true, drag: 1.6, delay: k * 0.12 });
        if (i % 2 === 0) part(x, g + rr(16, 40), y, { vx: ux * 200, vz: uy * 200, life: 0.18, s0: 6, s1: 1, col: '#fff4dc', a: 0.8, drag: 4, delay: k * 0.1 }); }
      if (!o.quiet) ring(x1, y1, PAL.war, 10, 46, 0.3, { a: 0.6 }); },
    warcry(x, y, o) { o = o || {}; const pal = o.pal || PAL.war, r = o.r || 200; const g = gY(x, y);
      ring(x, y, pal, 16, r, 0.5, { a: 1 }); ring(x, y, pal, 12, r * 0.7, 0.6, { a: 0.55, delay: 0.1 });
      const q = W(x, y, 3); decal(q[0], q[1], q[2], { r0: 30, r1: r * 0.6, life: 0.45, col: pal.ember, a: 0.5, cell: 3, rot: rnd() * TAU, ease: 1 });
      part(x, g + 40, y, { life: 0.28, s0: 160, s1: 240, col: pal.core, a: 0.55 }); part(x, g + 40, y, { life: 0.5, s0: 90, s1: 120, col: pal.mid, a: 0.35 });
      const n = cnt(14); for (let i = 0; i < n; i++) { const a = rnd() * TAU; part(x + Math.cos(a) * 18, g + rr(10, 50), y + Math.sin(a) * 18, { vx: Math.cos(a) * rr(140, 260), vz: Math.sin(a) * rr(140, 260), vy: rr(40, 140), life: rr(0.35, 0.6), s0: rr(4, 8), s1: 1, col: pal.mid, grav: 260, drag: 2 }); } },
    strike(x, y, o) { burst(x, y, 30, (o && o.pal) || PAL.steel, 10, { flash: 50, sp0: 100, sp1: 240, up0: 20, up1: 160 }); ring(x, y, PAL.steel, 8, 40, 0.25, { a: 0.7 }); },
    impact(x, y, h, pal, o) { o = o || {}; const q = W(x, y, h == null ? 24 : h); const n = cnt(o.n || 5);
      for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = rr(60, 180); part(q[0], q[1], q[2], { vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rr(20, 140), life: rr(0.18, 0.35), s0: rr(3, 6), s1: 1, col: i & 1 ? pal.mid : pal.core, grav: 400, drag: 2 }); }
      part(q[0], q[1], q[2], { life: 0.1, s0: o.flash || 22, s1: (o.flash || 22) * 1.4, col: pal.core, a: 0.7 });
      if (o.dust !== false) { const g = gY(x, y); part(x, g + 4, y, { vy: 20, life: 0.5, s0: 10, s1: 26, col: '#b8a27e', a: 0.35, mist: true, drag: 1 }); } },
    mist(x, y, o) { o = o || {}; const pal = PAL.wild, r = o.r || 30, n = cnt(o.n || 8); const g = gY(x, y);
      for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = rr(0, r); part(x + Math.cos(a) * d, g + rr(2, 12), y + Math.sin(a) * d, { vx: Math.cos(a) * rr(5, 25), vz: Math.sin(a) * rr(5, 25), vy: rr(8, 30), life: rr(0.9, 1.6), s0: rr(16, 26), s1: rr(40, 60), col: i % 3 ? '#5fae4a' : '#9ad36a', a: o.a || 0.34, mist: true, drag: 0.8, delay: rr(0, o.spread || 0.2) }); }
      if (!o.quiet) for (let i = 0; i < cnt(4); i++) { const a = rnd() * TAU, d = rr(0, r); part(x + Math.cos(a) * d, g + rr(4, 16), y + Math.sin(a) * d, { vy: rr(20, 60), life: rr(0.5, 0.9), s0: 6, s1: 2, col: pal.mid, a: 0.8, delay: rr(0, 0.3) }); } },
    dread(x, y, o) { const r = (o && o.r) || 160; ring(x, y, PAL.dread, 14, r, 0.55); const q = W(x, y, 3); decal(q[0], q[1], q[2], { r0: r * 0.6, r1: r, life: 0.9, col: PAL.dread.ember, a: 0.45, cell: 2 });
      const g = gY(x, y), n = cnt(14); for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = rr(10, r * 0.8); part(x + Math.cos(a) * d, g + rr(4, 20), y + Math.sin(a) * d, { vy: rr(30, 80), life: rr(0.7, 1.2), s0: rr(16, 24), s1: rr(30, 44), col: PAL.dread.dark, a: 0.5, mist: true, drag: 1, delay: rr(0, 0.2) }); } },
    shield(x, y) { ring(x, y, PAL.frost, 10, 46, 0.4, { a: 0.8, fol: true }); motes(x, y, PAL.frost, 8, { r0: 20, r1: 30, h0: 10, h1: 50, orbit: true, fol: true, l0: 0.5, l1: 0.8 }); },
    feathers(x, y) { const g = gY(x, y), n = cnt(10); for (let i = 0; i < n; i++) { const a = rnd() * TAU; part(x, g + 60, y, { vx: Math.cos(a) * rr(40, 120), vz: Math.sin(a) * rr(40, 120), vy: rr(40, 120), life: rr(0.6, 1.0), s0: 8, s1: 5, col: '#1c1c26', a: 0.7, mist: true, grav: 120, drag: 2 }); } },
    levelup(x, y, o) { o = o || {}; const pal = PAL.holy; const q = W(x, y, 0); const H = heroH();
      beam(q[0], q[1], q[2], { r: 34, h: H * 5, life: 1.9, col: '#ffd36a', a: 1, fol: true, grow: 0.25 }); beam(q[0], q[1], q[2], { r: 16, h: H * 6, life: 1.6, col: '#fff4c8', a: 0.9, fol: true, grow: 0.2 });
      ring(x, y, pal, 14, 120, 0.6, { fol: true }); ring(x, y, pal, 10, 80, 0.7, { delay: 0.35, fol: true, a: 0.7 });
      const qd = W(x, y, 2.5); decal(qd[0], qd[1], qd[2], { r0: 40, r1: 70, life: 1.8, col: pal.ember, a: 0.6, cell: 3, vrot: 1.2, fol: true, hold: 0.6 });
      const n = cnt(40); for (let i = 0; i < n; i++) { const a = (i / n) * TAU * 3, r = rr(28, 46);
        part(x + Math.cos(a) * r, gY(x, y) + 4, y + Math.sin(a) * r, { vy: rr(70, 140), life: rr(1.3, 1.9), s0: rr(5, 9), s1: 2, col: i % 3 ? pal.mid : pal.core, delay: (i / n) * 0.6, orbit: { cx: x, cz: y, r, ang: a, spd: 4.5, fol: true } }); }
      part(x, gY(x, y) + H * 0.6, y, { life: 0.35, s0: 200, s1: 280, col: '#fff1c4', a: 0.6 }); },
    pickup(x, y, col) { const p = hero(); if (!p) return; let m = null; for (const q of mov) if (!q.on) { m = q; break; } if (!m) return;
      m.on = true; m.x0 = x; m.y0 = y; m.h0 = 14; m.px = null; m.age = 0; m.life = 0.38; m.col = col; m.gold = false; return m; },
    // rain of arrows / fire: called per tick of a zone by the zone tracker
    fall(x, y, pal, fire) { const g = gY(x, y); const H0 = fire ? 260 : 200, sp = fire ? 900 : 1100, life = H0 / sp;
      const vx = fire ? -120 : -40; part(x - vx * life, g + H0, y, { vx, vy: -sp, life, s0: fire ? 22 : 6, s1: fire ? 16 : 5, col: fire ? pal.mid : pal.core, a: 1 });
      if (fire) part(x - vx * life, g + H0 + 18, y, { vx, vy: -sp, life: life * 1.05, s0: 12, s1: 6, col: pal.ember, a: 0.7 });
      else part(x - vx * life, g + H0 + 14, y, { vx, vy: -sp, life: life * 1.02, s0: 4, s1: 3, col: pal.mid, a: 0.6 });
      return life; }
  };
  SF.kinds = Object.keys(FX);
  // pending impacts (a falling streak lands → a puff), kept tiny
  const later = []; const after = (t, f) => { if (later.length < 64) later.push({ t: R.t + t, f }); };

  /* ---------------- the public play() ---------------- */
  SF.play = (kind, x, y, o) => { if (!SF.on) return false; const f = FX[kind]; if (!f) return false; try { f(x, y, o || {}); } catch (e) { console.error('spellfx', kind, e); return false; } return true; };

  /* ---------------- bus: casts by skill kind ---------------- */
  let lastHX = null, lastHY = null;            // the hero's position at the end of the previous step (a dash's start)
  const nearestFoe = (x, y, r) => { let b = null, bd = r * r; for (const e of R.ents) { if (e.dead || e.team !== 1 || !(e.hp > 0) || e.kind === 'drop' || e.kind === 'trap') continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; b = e; } } return b; };
  const shotKind = new WeakMap();
  function onCast(id, slot) {
    if (!SF.on) return; const D = R.data && R.data.skills; let sk = null, o = null;
    if (id && typeof id === 'object') { o = id; sk = (D && D[o.id]) || o; } else sk = D && D[id];
    const p = hero(); if (!sk || !p) return; const kind = (o && o.fx) || sk.fx || sk.kind; const x = (o && o.x != null) ? o.x : p.x, y = (o && o.y != null) ? o.y : p.y;
    // tag this step's new shots with the skill (fireball / flask / arrows)
    const S = R.skills && R.skills.shots; if (S) for (const s of S) if (!shotKind.has(s) && Math.abs(s.t0 - R.t) < 1e-6) shotKind.set(s, sk.kind === 'fire_bolt' ? 'fire' : sk.kind === 'wildfire' ? 'wild' : sk.line ? 'shaft' : 'arrow');
    const t = nearestFoe(x, y, (sk.range || 90) + 40); let ang = t ? Math.atan2(t.y - y, t.x - x) : (p.face >= 0 ? 0 : Math.PI);
    if (!t) { const m = R.input && R.input.move; if (m && (Math.abs(m.x) > 0.2 || Math.abs(m.y) > 0.2)) ang = Math.atan2(m.y, m.x); }
    switch (kind) {
      case 'melee_aoe': FX.cleave(x, y, { r: sk.range || 90, arc: sk.arc || 110, ang, bleed: sk.dot === 'bleed' }); break;
      case 'dash_strike': if (lastHX != null && Math.hypot(p.x - lastHX, p.y - lastHY) > 8) FX.dash(lastHX, lastHY, p.x, p.y); else FX.dash(x - Math.cos(ang) * (sk.dash || 160), y - Math.sin(ang) * (sk.dash || 160), x, y); break;
      case 'taunt': FX.warcry(x, y, { r: sk.range || 200 }); break;
      case 'buff': FX.warcry(x, y, { r: 130, pal: PAL.fire }); break;
      case 'heal': FX.heal(x, y, { fol: true }); break;
      case 'shield': FX.shield(x, y); break;
      case 'frost_nova': FX.frost(x, y, { r: sk.r || 130 }); break;
      case 'strike': if (t) FX.strike(t.x, t.y); else FX.cleave(x, y, { r: 60, arc: 90, ang }); break;
      case 'debuff': FX.dread(x, y, { r: sk.r || 160 }); break;
      case 'summon_raven': FX.feathers(x, y); break;
      case 'volley': { const g = gY(x, y); part(x + Math.cos(ang) * 20, g + 34, y + Math.sin(ang) * 20, { life: 0.12, s0: 26, s1: 40, col: PAL.arrow.core, a: 0.6 }); break; }
      default: break;   // fire_bolt / wildfire / rain draw through their shots and zones
    }
  }

  /* ---------------- trackers: shots, zones, projectiles, traps, drops ---------------- */
  const shotPrev = new Map();                  // shot → {x, y, h, kind} (its last drawn point: the impact spot)
  const zoneSeen = new WeakSet(), zoneLive = new Map();
  const projSeen = new Map();                  // proj ent → {x, y, h, fire}
  const trapSeen = new Map();
  const drops = new Map();                     // drop ent → {t0, seed, col, rar, sub}
  const palOfShot = k => k === 'fire' ? PAL.fire : k === 'wild' ? PAL.wild : PAL.arrow;
  function trackShots() {
    const S = R.skills && R.skills.shots; const cur = new Set();
    if (S) for (const s of S) { cur.add(s); let k = shotKind.get(s); if (!k) { k = s.kind || s.fx || (s.col === '#9fe07a' ? 'wild' : 'arrow'); shotKind.set(s, k); }
      const f = Math.max(0, Math.min(1, (R.t - s.t0) / (s.dur || 0.1))); const x = s.x0 + (s.x1 - s.x0) * f, y = s.y0 + (s.y1 - s.y0) * f; const h = 30 + Math.sin(f * Math.PI) * (k === 'arrow' || k === 'shaft' ? 26 : 40);
      if (!near(x, y)) continue; const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0) || 1;
      FX.trail(x, y, h, palOfShot(k), k === 'fire' || k === 'wild', (s.x1 - s.x0) / L, (s.y1 - s.y0) / L);
      if (k === 'shaft') FX.trail(x - (s.x1 - s.x0) / L * 10, y - (s.y1 - s.y0) / L * 10, h, PAL.arrow, false, (s.x1 - s.x0) / L, (s.y1 - s.y0) / L);
      shotPrev.set(s, { x: s.x1, y: s.y1, h: 30, k, hit: !!s.onHit }); }
    for (const [s, q] of shotPrev) if (!cur.has(s)) { shotPrev.delete(s); if (!near(q.x, q.y)) continue;
      if (q.k === 'fire') FX.fire(q.x, q.y, { r: 40 }); else if (q.k === 'wild') { FX.fire(q.x, q.y, { r: 34, pal: PAL.wild }); FX.mist(q.x, q.y, { r: 40, n: 6 }); }
      else if (q.hit) FX.impact(q.x, q.y, q.h, PAL.arrow); }
  }
  function trackZones() {
    const Z = R.skills && R.skills.zones; if (Z) for (const z of Z) if (!zoneSeen.has(z)) { zoneSeen.add(z);
      const fire = !!z.fire, wild = z.kind === 'wildfire'; const pal = wild ? PAL.wild : fire ? PAL.fire : PAL.arrow; const life = z.dur || 2.5; const q = W(z.x, z.y, 3);
      decal(q[0], q[1], q[2], { r0: z.r * 0.96, r1: z.r, life, col: pal.ring, a: wild ? 0.7 : 0.45, cell: 0, hold: life * 0.7 });
      decal(q[0], q[1] - 0.5, q[2], { r0: z.r * 0.85, r1: z.r, life, col: wild ? pal.ember : pal.dark, a: wild ? 0.5 : 0.25, cell: 2, hold: life * 0.7 });
      zoneLive.set(z, { acc: 0, pal, fire, wild }); }
    for (const [z, st] of zoneLive) { if (R.t > (z.until || 0) + 0.05 || (Z && Z.indexOf(z) < 0 && R.t > (z.until || 0))) { zoneLive.delete(z); continue; } if (!near(z.x, z.y)) continue;
      st.acc += R.dt * (calm ? 0.5 : 1);
      if (st.wild) { while (st.acc >= 0.12) { st.acc -= 0.12; FX.mist(z.x, z.y, { r: z.r * 0.9, n: 1, a: 0.26, spread: 0.05, quiet: true }); const a = rnd() * TAU, d = rr(0, z.r * 0.85), g = gY(z.x, z.y);
        part(z.x + Math.cos(a) * d, g + 4, z.y + Math.sin(a) * d, { vy: rr(40, 90), life: rr(0.4, 0.7), s0: rr(8, 14), s1: 2, col: rnd() < 0.5 ? PAL.wild.mid : PAL.wild.core, a: 0.9 }); } }
      else { const every = st.fire ? 0.09 : 0.045; while (st.acc >= every) { st.acc -= every; const a = rnd() * TAU, d = Math.sqrt(rnd()) * z.r, x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d;
        const t = FX.fall(x, y, st.pal, st.fire); const pal = st.pal, fire = st.fire; after(t, () => { if (fire) { burst(x, y, 6, pal, 5, { flash: 40, sp0: 60, sp1: 160, up0: 30, up1: 140 }); const qq = W(x, y, 2.5); decal(qq[0], qq[1], qq[2], { r0: 10, r1: 34, life: 0.4, col: pal.ring, a: 0.8, cell: 0, ease: 1 }); } else FX.impact(x, y, 4, pal, { n: 3, flash: 14 }); }); } } }
  }
  function scanEnts() {
    const seenP = new Set(), seenT = new Set(), seenD = new Set();
    for (const e of R.ents) { const k = e.kind;
      if (k === 'proj') { if (e.dead) continue; seenP.add(e); const fire = e.o && (e.o.kind === 'fire' || e.o.dot); const h = e.z == null ? 30 : e.z; let q = projSeen.get(e); if (!q) { q = { x: e.x, y: e.y, h, fire }; projSeen.set(e, q); }
        if (near(e.x, e.y)) { const L = Math.hypot(e.vx || 0, e.vy || 0) || 1; FX.trail(e.x, e.y, h, fire ? PAL.fire : e.team === 1 ? PAL.war : PAL.arrow, false, (e.vx || 0) / L, (e.vy || 0) / L); }
        q.x = e.x; q.y = e.y; q.h = h; }
      else if (k === 'trap') { if (e.dead) continue; seenT.add(e); if (!trapSeen.has(e)) { trapSeen.set(e, { x: e.x, y: e.y, n: 0 }); if (near(e.x, e.y)) { FX.mist(e.x, e.y, { r: 22, n: 5 }); ring(e.x, e.y, PAL.wild, 6, 30, 0.4, { a: 0.7 }); } }
        else { const q = trapSeen.get(e); if (++q.n % 24 === 0 && near(e.x, e.y)) FX.mist(e.x, e.y, { r: 14, n: 1, a: 0.2, quiet: true }); } }
      else if (k === 'drop') { if (e.dead) continue; seenD.add(e); if (!drops.has(e)) { const it = e.item; const rar = e.sub === 'item' || e.sub === 'mat' ? (it && it.rar) | 0 : e.sub === 'gem' ? 3 : 0;
          drops.set(e, { t0: R.t, seed: rnd() * TAU, rar, sub: e.sub, col: e.sub === 'item' || e.sub === 'mat' ? rarCol(rar) : e.col || '#e3b661' }); } } }
    for (const [e, q] of projSeen) if (!seenP.has(e)) { projSeen.delete(e); if (near(q.x, q.y)) FX.impact(q.x, q.y, q.h, q.fire ? PAL.fire : PAL.arrow, { n: 4, dust: !q.fire }); }
    for (const [e, q] of trapSeen) if (!seenT.has(e)) { trapSeen.delete(e); if (near(q.x, q.y)) FX.mist(q.x, q.y, { r: 40, n: 10, a: 0.4 }); }
    for (const [e, q] of drops) if (e.dead || !seenD.has(e)) { drops.delete(e); if (e.taken && near(e.x, e.y)) { const m = FX.pickup(e.x, e.y, q.col); if (m) { m.gold = q.sub === 'gold'; m.h0 = (e.z || 0) + 14; } } }
  }

  /* ---------------- simulation (one fixed step) ---------------- */
  function sim(dt) {
    const p = hero(); const hx = p ? p.x : 0, hz = p ? p.y : 0, hy = p ? gY(p.x, p.y) : 0;
    // particles
    let w = 0;
    for (let j = 0; j < pN; j++) { const i = pLive[j]; let a = P.age[i] + dt;
      if (a >= P.life[i]) { pFree.push(i); continue; }
      P.age[i] = a; pLive[w++] = i; if (a < 0) continue;
      if (P.mode[i] === 1) { P.oang[i] += P.ospd[i] * dt; P.oy[i] += P.vy[i] * dt; const f = P.fol[i] && p; const cx = f ? hx : P.ox[i], cz = f ? hz : P.oz[i], by = f ? hy : P.ob[i];
        const r = P.orad[i] * (1 - 0.35 * a / P.life[i]); P.x[i] = cx + Math.cos(P.oang[i]) * r; P.z[i] = cz + Math.sin(P.oang[i]) * r; P.y[i] = by + P.oy[i]; continue; }
      const k = P.drag[i] ? Math.max(0, 1 - P.drag[i] * dt) : 1; P.vx[i] *= k; P.vz[i] *= k; P.vy[i] = P.vy[i] * k - P.grav[i] * dt;
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt; }
    pN = w;
    for (const d of dec) if (d.on) { d.age += dt; if (d.age >= d.life) d.on = false; else if (d.age >= 0) { d.rot += d.vrot * dt; if (d.fol && p) { d.x = hx; d.z = hz; d.y = hy + 2.5; } } }
    for (const b of bms) if (b.on) { b.age += dt; if (b.age >= b.life) b.on = false; else if (b.fol && p) { b.x = hx; b.z = hz; b.y = hy; } }
    for (const m of mov) if (m.on) { m.age += dt; if (!p) { m.on = false; continue; } const k = Math.min(1, m.age / m.life), e = k * k * (3 - 2 * k);
      const x0 = m.x0, z0 = m.y0, y0 = gY(m.x0, m.y0) + m.h0, x1 = hx, z1 = hz, y1 = hy + heroH() * 0.55; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = Math.max(y0, y1) + 70;
      const u = 1 - e; m.px = u * u * x0 + 2 * u * e * cx + e * e * x1; m.pz = u * u * z0 + 2 * u * e * cz + e * e * z1; m.py = u * u * y0 + 2 * u * e * cy + e * e * y1;
      part(m.px, m.py, m.pz, { life: 0.22, s0: 9, s1: 2, col: m.col, a: 0.9 }); if (!calm && (R.tick & 1)) part(m.px + rr(-4, 4), m.py + rr(-4, 4), m.pz + rr(-4, 4), { vy: rr(-20, 20), life: 0.3, s0: 5, s1: 1, col: '#fffbe8', a: 1 });
      if (k >= 1) { m.on = false; for (let i = 0; i < cnt(8); i++) { const a = rnd() * TAU; part(x1, y1, z1, { vx: Math.cos(a) * rr(60, 140), vz: Math.sin(a) * rr(60, 140), vy: rr(20, 140), life: rr(0.25, 0.45), s0: rr(4, 7), s1: 1, col: i & 1 ? m.col : '#fffbe8', grav: 200, drag: 2 }); }
        decal(x1, hy + 3, z1, { r0: 10, r1: 34, life: 0.3, col: m.col, a: 0.9, cell: 0, ease: 1 }); } }
    for (let i = later.length - 1; i >= 0; i--) if (R.t >= later[i].t) { const f = later[i].f; later.splice(i, 1); try { f(); } catch (e) {} }
  }

  /* ---------------- GPU: built on the first 'render3d' ---------------- */
  let G = null;
  function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.85)'); r.addColorStop(0.45, 'rgba(255,255,255,0.28)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(c); t.needsUpdate = true; return t; }
  function atlasTex() { const S = 128, c = document.createElement('canvas'); c.width = c.height = S * 2; const g = c.getContext('2d');
    // 0 ring (top-left)
    let cx = S / 2, cy = S / 2; let gr = g.createRadialGradient(cx, cy, 0, cx, cy, S / 2); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.86, 'rgba(255,255,255,1)'); gr.addColorStop(0.93, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // 1 crescent (top-right): an arc of ~150° facing +x, bright outer edge, fading tips
    cx = S * 1.5; cy = S / 2; g.save(); g.beginPath(); g.rect(S, 0, S, S); g.clip();
    for (let i = 0; i < 48; i++) { const k = i / 47, a = (k - 0.5) * 2.6, tip = Math.pow(Math.sin(k * Math.PI), 0.7); for (let j = 0; j < 6; j++) { const rr2 = S * (0.3 + 0.032 * j + 0.06 * tip); g.fillStyle = 'rgba(255,255,255,' + (0.07 + 0.14 * j / 5) * tip + ')'; g.beginPath(); g.arc(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, S * (0.03 + 0.03 * tip), 0, TAU); g.fill(); } }
    g.restore();
    // 2 soft disc (bottom-left)
    cx = S / 2; cy = S * 1.5; gr = g.createRadialGradient(cx, cy, 0, cx, cy, S / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, S, S, S);
    // 3 burst (bottom-right): rays + a ring of runes-like dots
    cx = S * 1.5; cy = S * 1.5; g.save(); g.beginPath(); g.rect(S, S, S, S); g.clip(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + (i % 2) * 0.1, L = S * (i % 2 ? 0.34 : 0.47); const lg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.35, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = lg; g.lineWidth = i % 2 ? 2 : 3.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(Math.cos(a) * S * 0.4, Math.sin(a) * S * 0.4, 1.8, 0, TAU); g.fill(); }
    g.restore(); const t = new T.CanvasTexture(c); t.needsUpdate = true; return t; }
  const PV = `attribute vec4 aC; attribute float aS; uniform float uScale; uniform float uMax; varying vec4 vC;
    void main(){ vC = aC; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aS * uScale / max(1.0, -mv.z), 1.0, uMax); gl_Position = projectionMatrix * mv; }`;
  const PF = `uniform sampler2D uMap; varying vec4 vC; void main(){ float t = texture2D(uMap, gl_PointCoord).a; float a = vC.a * t; if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb, a); }`;
  const DV = `attribute vec3 iP; attribute vec3 iS; attribute vec4 iC; attribute float iK; varying vec2 vU; varying vec4 vC;
    void main(){ vC = iC; float c = cos(iS.z), s = sin(iS.z); vec2 q = vec2(position.x * iS.x, position.y * iS.y); vec3 w = iP + vec3(q.x * c - q.y * s, 0.0, q.x * s + q.y * c);
      vec2 cell = vec2(mod(iK, 2.0), floor(iK / 2.0 + 0.01)); vU = vec2((uv.x + cell.x) * 0.5, (uv.y + 1.0 - cell.y) * 0.5);
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
  const DF = `uniform sampler2D uMap; varying vec2 vU; varying vec4 vC; void main(){ float t = texture2D(uMap, vU).a; float a = vC.a * t; if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb, a); }`;
  const BV = `attribute vec3 iP; attribute vec2 iS; attribute vec4 iC; uniform float uTime; varying vec4 vC; varying float vY; varying float vF;
    void main(){ vC = iC; vY = uv.y; vec3 w = iP + vec3(position.x * iS.x, (position.y + 0.5) * iS.y, position.z * iS.x); vec4 mv = viewMatrix * vec4(w, 1.0);
      vec3 n = normalize(mat3(viewMatrix) * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
  const BF = `uniform float uTime; varying vec4 vC; varying float vY; varying float vF; void main(){ float fall = pow(1.0 - vY, 1.6) * smoothstep(0.0, 0.06, vY); float band = 0.78 + 0.22 * sin(vY * 26.0 - uTime * 7.0);
      float a = vC.a * fall * band * pow(vF, 1.4); if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb, a); }`;
  function build(R3_) {
    if (G || !R3_ || !R3_.scene) return; R3 = R3_; gY = typeof R3.groundY === 'function' ? R3.groundY : gY;
    try {
      const glow = glowTex(), atlas = atlasTex(); const uScale = { value: 400 }, uTime = { value: 0 }; let mx = 256; try { const gl = R3.renderer.getContext(); const rg = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE); if (rg && rg[1] > 1) mx = Math.min(512, rg[1]); } catch (e) {} const uMax = { value: mx };
      const mkPts = (blend, cap) => { const geo = new T.BufferGeometry(); const pos = new T.BufferAttribute(new Float32Array(cap * 3), 3), col = new T.BufferAttribute(new Float32Array(cap * 4), 4), sz = new T.BufferAttribute(new Float32Array(cap), 1);
        pos.setUsage(T.DynamicDrawUsage); col.setUsage(T.DynamicDrawUsage); sz.setUsage(T.DynamicDrawUsage); geo.setAttribute('position', pos); geo.setAttribute('aC', col); geo.setAttribute('aS', sz); geo.setDrawRange(0, 0);
        const mat = new T.ShaderMaterial({ uniforms: { uMap: { value: glow }, uScale, uMax }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, depthTest: true, blending: blend });
        const o = new T.Points(geo, mat); o.frustumCulled = false; o.visible = false; o.renderOrder = blend === T.AdditiveBlending ? 12 : 11; o.name = 'spellfx-pts'; return { o, pos, col, sz }; };
      const mkInst = (base, attrs, mat, cap, order) => { const geo = new T.InstancedBufferGeometry(); geo.setIndex(base.index); for (const k in base.attributes) geo.setAttribute(k, base.attributes[k]);
        const A = {}; for (const [k, n] of attrs) { A[k] = new T.InstancedBufferAttribute(new Float32Array(cap * n), n); A[k].setUsage(T.DynamicDrawUsage); geo.setAttribute(k, A[k]); } geo.instanceCount = 0;
        const o = new T.Mesh(geo, mat); o.frustumCulled = false; o.visible = false; o.renderOrder = order; return { o, A }; };
      const pts = mkPts(T.AdditiveBlending, PCAP), mist = mkPts(T.NormalBlending, PCAP);
      const decMat = new T.ShaderMaterial({ uniforms: { uMap: { value: atlas } }, vertexShader: DV, fragmentShader: DF, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const decal_ = mkInst(new T.PlaneGeometry(2, 2), [['iP', 3], ['iS', 3], ['iC', 4], ['iK', 1]], decMat, DCAP + GCAP + CCAP, 10); decal_.o.name = 'spellfx-decal';
      const bMat = new T.ShaderMaterial({ uniforms: { uTime }, vertexShader: BV, fragmentShader: BF, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide });
      const beam_ = mkInst(new T.CylinderGeometry(1, 1, 1, 14, 1, true), [['iP', 3], ['iS', 2], ['iC', 4]], bMat, BCAP + GCAP, 13); beam_.o.name = 'spellfx-beam';
      const gemMat = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3a3a3a, flatShading: true }); const gem = new T.InstancedMesh(new T.OctahedronGeometry(1, 0), gemMat, GCAP + MCAP);
      gem.instanceMatrix.setUsage(T.DynamicDrawUsage); gem.count = 0; gem.frustumCulled = false; gem.visible = false; gem.name = 'spellfx-gem'; gem.setColorAt(0, new T.Color(1, 1, 1));
      const coinMat = new T.MeshLambertMaterial({ color: 0xffd36a, emissive: 0x6a4a10 }); const coin = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 0.22, 12), coinMat, CCAP + MCAP);
      coin.instanceMatrix.setUsage(T.DynamicDrawUsage); coin.count = 0; coin.frustumCulled = false; coin.visible = false; coin.name = 'spellfx-coin';
      const root = new T.Group(); root.name = 'spellfx'; root.add(pts.o, mist.o, decal_.o, beam_.o, gem, coin); R3.scene.add(root);
      G = { root, pts, mist, decal: decal_, beam: beam_, gem, coin, uScale, uTime, m4: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), v: new T.Vector3(), s: new T.Vector3(), col: new T.Color() };
      SF.on = true; SF.why = ''; SF.gl = G;
    } catch (e) { console.error('spellfx build', e); SF.why = 'build: ' + (e && e.message); G = null; SF.on = false; }
  }

  /* ---------------- write the GPU buffers (once per drawn frame) ---------------- */
  function write() {
    const g = G; const cam = R3.camera; let calls = 0;
    // point size scale: drawing-buffer px per world unit at depth 1
    const H = (R3.renderer && R3.renderer.domElement && R3.renderer.domElement.height) || (R.vh * (R.dpr || 1)); g.uScale.value = H * 0.5 / Math.tan(((cam.fov || 60) * Math.PI / 180) / 2); g.uTime.value = R.t;
    // particles → two clouds
    let na = 0, nm = 0; const A = g.pts, M = g.mist, pa = A.pos.array, ca = A.col.array, sa = A.sz.array, pm = M.pos.array, cm = M.col.array, sm = M.sz.array;
    for (let j = 0; j < pN; j++) { const i = pLive[j]; const a0 = P.age[i]; if (a0 < 0) continue; const k = a0 / P.life[i]; const fade = Math.min(1, k * 10) * (1 - k * k); const s = P.s0[i] + (P.s1[i] - P.s0[i]) * k;
      if (P.bl[i]) { const o = nm * 3, c = nm * 4; pm[o] = P.x[i]; pm[o + 1] = P.y[i]; pm[o + 2] = P.z[i]; cm[c] = P.r[i]; cm[c + 1] = P.g[i]; cm[c + 2] = P.b[i]; cm[c + 3] = P.a[i] * fade; sm[nm++] = s; }
      else { const o = na * 3, c = na * 4; pa[o] = P.x[i]; pa[o + 1] = P.y[i]; pa[o + 2] = P.z[i]; ca[c] = P.r[i]; ca[c + 1] = P.g[i]; ca[c + 2] = P.b[i]; ca[c + 3] = P.a[i] * fade; sa[na++] = s; } }
    const flush = (B, n) => { B.o.geometry.setDrawRange(0, n); B.o.visible = n > 0; if (n) { B.pos.needsUpdate = B.col.needsUpdate = B.sz.needsUpdate = true; calls++; } };
    flush(A, na); flush(M, nm);
    // decals: transient + drop halos
    const DA = g.decal.A, dP = DA.iP.array, dS = DA.iS.array, dC = DA.iC.array, dK = DA.iK.array; let nd = 0; const dmax = DCAP + GCAP + CCAP;
    const putD = (x, y, z, sx, sz, rot, c, a, cell) => { if (nd >= dmax) return; const o = nd * 3, q = nd * 4; dP[o] = x; dP[o + 1] = y; dP[o + 2] = z; dS[o] = sx; dS[o + 1] = sz; dS[o + 2] = rot; dC[q] = c[0]; dC[q + 1] = c[1]; dC[q + 2] = c[2]; dC[q + 3] = a; dK[nd++] = cell; };
    for (const d of dec) if (d.on && d.age >= 0) { const k = d.age / d.life; const e = d.ease ? 1 - (1 - k) * (1 - k) * (1 - k) : k; const r = d.r0 + (d.r1 - d.r0) * e;
      const fade = d.hold && k < d.hold / d.life ? Math.min(1, k * 12) : (d.hold ? 1 - (k - d.hold / d.life) / (1 - d.hold / d.life) : Math.min(1, k * 12) * (1 - k)); putD(d.x, d.y, d.z, r * d.sx, r, d.rot, d.c, d.a * Math.max(0, fade), d.cell); }
    // beams: transient + loot
    const BA = g.beam.A, bP = BA.iP.array, bS = BA.iS.array, bC = BA.iC.array; let nb = 0; const bmax = BCAP + GCAP;
    const putB = (x, y, z, r, h, c, a) => { if (nb >= bmax) return; const o = nb * 3, s = nb * 2, q = nb * 4; bP[o] = x; bP[o + 1] = y; bP[o + 2] = z; bS[s] = r; bS[s + 1] = h; bC[q] = c[0]; bC[q + 1] = c[1]; bC[q + 2] = c[2]; bC[q + 3] = a; nb++; };
    for (const b of bms) if (b.on && b.age >= 0) { const k = b.age / b.life; const grow = Math.min(1, k / b.grow); const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; putB(b.x, b.y, b.z, b.rad * (0.6 + 0.4 * grow) * (1 - 0.3 * k), b.h * (0.35 + 0.65 * grow), b.c, b.a * fade); }
    // tokens: gems for items / mats / gems / potions, a coin cluster for gold
    let ng = 0, nc = 0; const m4 = g.m4, qq = g.q, eu = g.e, v = g.v, sc = g.s, col = g.col; const tok = R.t;
    const putGem = (x, y, z, s, spin, c) => { if (ng >= GCAP + MCAP) return; eu.set(0, spin, 0); qq.setFromEuler(eu); v.set(x, y, z); sc.set(s * 0.72, s, s * 0.72); m4.compose(v, qq, sc); g.gem.setMatrixAt(ng, m4); col.setRGB(c[0], c[1], c[2], T.SRGBColorSpace); g.gem.setColorAt(ng, col); ng++; };
    const putCoin = (x, y, z, s, spin) => { if (nc >= CCAP + MCAP) return; eu.set(Math.PI / 2, spin, 0, 'YXZ'); qq.setFromEuler(eu); v.set(x, y, z); sc.set(s, s, s); m4.compose(v, qq, sc); g.coin.setMatrixAt(nc++, m4); };
    let nDrops = 0;
    for (const [e, q] of drops) { if (!near(e.x, e.y)) continue; if (++nDrops > 40) break; const gy = gY(e.x, e.y), lift = (e.z || 0); const bob = Math.sin(tok * 3 + q.seed) * 3; const c = rgb(q.col); const age = R.t - q.t0; const pop = Math.min(1, age / 0.25);
      if (q.sub === 'gold') { const n = Math.min(4, 2 + ((e.amount | 0) > 20 ? 2 : (e.amount | 0) > 5 ? 1 : 0)); for (let i = 0; i < n; i++) { const a = q.seed + i * TAU / n + tok * 1.6; putCoin(e.x + Math.cos(a) * 6, gy + lift + 9 + bob + i * 2.2, e.y + Math.sin(a) * 6, 5.5 * pop, tok * 5 + i); }
        putD(e.x, gy + 2.5, e.y, 16, 16, 0, rgb('#ffd36a'), 0.35 * pop, 2); }
      else { const s = (q.rar >= 3 ? 8 : q.rar >= 2 ? 7 : 6) * pop; putGem(e.x, gy + lift + 30 + bob, e.y, s, tok * 2 + q.seed, c);
        putD(e.x, gy + 2.5, e.y, 18 + q.rar * 3, 18 + q.rar * 3, 0, c, (0.35 + 0.1 * q.rar) * pop, 2);
        if (q.rar >= 2) { putB(e.x, gy, e.y, 7 + q.rar * 1.5, 150 + q.rar * 50, c, (0.55 + 0.12 * q.rar) * pop); putD(e.x, gy + 3, e.y, 22 + 2 * Math.sin(tok * 4 + q.seed), 22, tok, c, 0.55 * pop, 0);
          if (!calm && (R.tick % (q.rar >= 4 ? 6 : 10)) === 0 && SF._wrote !== R.tick) { const a = rnd() * TAU; part(e.x + Math.cos(a) * 8, gy + rr(8, 30), e.y + Math.sin(a) * 8, { vy: rr(30, 70), life: rr(0.6, 1), s0: 5, s1: 1, col: q.col, a: 0.9 }); } } } }
    SF._wrote = R.tick;
    for (const m of mov) if (m.on && m.px != null) { const k = Math.min(1, m.age / m.life); if (m.gold) putCoin(m.px, m.py, m.pz, 5 * (1 - 0.6 * k), R.t * 12); else putGem(m.px, m.py, m.pz, 6 * (1 - 0.6 * k), R.t * 10, rgb(m.col)); }
    const flushI = (B, n) => { B.o.geometry.instanceCount = n; B.o.visible = n > 0; if (n) { for (const k in B.A) B.A[k].needsUpdate = true; calls++; } };
    flushI(g.decal, nd); flushI(g.beam, nb);
    g.gem.count = ng; g.gem.visible = ng > 0; if (ng) { g.gem.instanceMatrix.needsUpdate = true; if (g.gem.instanceColor) g.gem.instanceColor.needsUpdate = true; calls++; }
    g.coin.count = nc; g.coin.visible = nc > 0; if (nc) { g.coin.instanceMatrix.needsUpdate = true; calls++; }
    SF.stats.calls = calls; SF.stats.n = { pts: na, mist: nm, decal: nd, beam: nb, gem: ng, coin: nc };
  }

  /* ---------------- the system ---------------- */
  const sys = R.addSys('spellfx', { order: 897,
    update(dt) { if (!SF.on) return; const t0 = performance.now();
      try { trackShots(); trackZones(); scanEnts(); sim(dt || R.dt || 1 / 60); } catch (e) { if ((SF._err = (SF._err | 0) + 1) <= 3) console.error('spellfx', e); }
      const p = hero(); if (p) { lastHX = p.x; lastHY = p.y; } SF.stats.upd = performance.now() - t0; },
    draw() { if (!SF.on || !G) return; const t0 = performance.now(); try { write(); } catch (e) { if ((SF._err = (SF._err | 0) + 1) <= 3) console.error('spellfx', e); }
      const ms = performance.now() - t0 + (SF.stats.upd || 0); SF.stats.ms = ms; if (ms > SF.stats.msMax) SF.stats.msMax = ms; } });
  SF.sys = sys;
  SF.count = () => { let d = 0, b = 0, m = 0; for (const q of dec) if (q.on) d++; for (const q of bms) if (q.on) b++; for (const q of mov) if (q.on) m++; return { pts: pN, decal: d, beam: b, mover: m, later: later.length, drops: drops.size, shots: shotPrev.size, zones: zoneLive.size, proj: projSeen.size, traps: trapSeen.size }; };
  SF.idle = () => { const c = SF.count(); return !c.pts && !c.decal && !c.beam && !c.mover && !c.later; };
  SF.clear = () => { for (let j = 0; j < pN; j++) pFree.push(pLive[j]); pN = 0; for (const q of dec) q.on = false; for (const q of bms) q.on = false; for (const q of mov) q.on = false; later.length = 0; };
  SF.fx = FX; SF.PAL = PAL;

  /* ---------------- bus hooks ---------------- */
  try {
    R.bus.on('cast', onCast);
    R.bus.on('levelup', () => { const p = hero(); if (SF.on && p) FX.levelup(p.x, p.y); });
    let hitBudget = 0, hitT = 0;
    R.bus.on('hit', h => { if (!SF.on || !h || !h.tgt) return; const k = h.kind; if (k !== 'fire' && k !== 'ice' && k !== 'poison' && k !== 'wild') return;
      if (R.t - hitT > 0.5) { hitT = R.t; hitBudget = 0; } if (++hitBudget > 12) return; const e = h.tgt; if (!near(e.x, e.y)) return;
      const pal = k === 'fire' ? PAL.fire : k === 'ice' ? PAL.frost : PAL.wild; FX.impact(e.x, e.y, 26, pal, { n: 3, flash: 16, dust: false }); });
    const healT = new WeakMap();
    R.bus.on('heal', h => { if (!SF.on || !h || !h.tgt) return; const e = h.tgt; if ((healT.get(e) || -9) > R.t - 0.6) return; healT.set(e, R.t); if (near(e.x, e.y)) FX.smallheal(e.x, e.y); });
    if (R.render3d && R.render3d.scene) build(R.render3d); else R.bus.on('render3d', r3 => build(r3 || R.render3d));
  } catch (e) { SF.why = 'hooks: ' + (e && e.message); }
})();
