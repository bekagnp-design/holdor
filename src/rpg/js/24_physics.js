/* HOLDOR RPG — 24_physics.js (A45): the physics feel layer, "physics to the maximum". ADDITIVE: no other module changes.
   Two systems bracket every mover: physPre (order 79, before the player 80 / ai 100) and physPost (order 101, after them).
   physPost measures what the other modules moved this step (pos − e.prev), corrects it for terrain (slopes from
   R.render3d.groundY, water from R.water.depth), integrates impulses (e.imp, a velocity with friction by surface) and
   infers e.vel. R.hit is wrapped so o.knock becomes an impulse instead of A11's instant push. Big hits give a 45 ms
   hit-stop, a white flash and a camera kick; a knocked mob that dies tumbles (e.z + e.tumble.ang); arrows fly on a lob
   and stay 6 s in the ground; footsteps fire by surface and leave prints on snow. R.phys.off = true disables all of it.

   API (R.phys = P):
     P.impulse(e, ix, iy, o)   add an impulse velocity (u/s); o:{raw:1 ignores weight, src}. Giants (mass ≥ 1.4) take ×0.3.
     P.vel(e) → {x,y}          the measured velocity of the last step (u/s). P.speed(e) → |vel|
     P.massOf(e)               1 = a man; from e.mass, e.big or the mob def's big (giant 1.9, mammoth 2.2, …)
     P.freeze(e, s)            hit-stop: e.stunMicro = s (0.045 default) — physPost undoes the entity's motion while it lasts
     P.tumble(e, dir)          start a death tumble (spin from dir.x); walkers, giants and flyers never tumble
     P.gradAt(x,y) → {x,y,m}   terrain gradient (dh per unit), sampled ±8; m = |gradient|, > 0.9 is a wall
     P.depthAt(x,y) → 0..1     water depth (R.water.depth; without it the 30 units before the sea mask count as 0.5)
     P.climateAt(x,y)          'cold' | 'sand' | 'temperate' from the region's biome / id / name
     P.surfaceAt(x,y,e)        'wet' | 'stone' | 'snow' | 'sand' | 'grass' (the footstep surface)
     P.speedFactor(e,dx,dy)    what a displacement is scaled by (slope × water), from the entity's cached samples
     P.frictionOf(e)           1/s decay of e.imp on the entity's surface: ground 8, ice 1.5, sand 12, air 3
     P.wrapHit()               (re)wraps R.hit when a new one appears (physPre checks each step, so test fakes work)
     P.prints / P.stuck / P.ripples   ring buffers the overlay draws (snow footprints ≤ 60, landed arrows ≤ 40, water rings ≤ 40)
     P.stats {ms, movers, steps}      the last physPost cost in ms
   Events: 'footstep'(e, surface) every 0.28 s of movement · 'splash'(e) on entering water · 'land'(p) when an arrow lands.

   Fields added to entities (the renderer / A05 may read them):
     e.prev {x,y}      position at the end of the last physics step
     e.vel {x,y}       measured velocity, u/s (A11's e.vx/vy stay the AI's intent)
     e.imp {x,y}       impulse velocity, u/s, decays by surface friction; e.impT = game time of the last impulse
     e.stunMicro       seconds of hit-stop left (> 0: hold the animation frame; motion is undone)
     e.flash           seconds of white flash left after a big hit (0.08 → 0)
     e.z               height above the ground, u (0 on it): raise the billboard by e.z × R.cam.z px. Set by the tumble and on arrows.
     e.vz              vertical speed, u/s (arrows, tumble)
     e.tumble          {ang, spin, vz, z, bounced, done}: rotate the billboard by ang (radians, screen space) while !done
     e.stuck / e.life  an arrow that landed (removed from R.ents; P.stuck holds it 6 s) / seconds left in the ground
     e.wading, e.depth in water ≥ 0.5 / the water depth under the entity;  e.onIce — frozen water (cold biome)
     e.grad, e.steep   the cached terrain gradient / standing on a > 0.9 slope;  e.clim — the cached climate
     e.surface         the surface of the last footstep;  e.stepT — footstep accumulator
     e.avoidWater      true on walking mobs (the AI may read it);  e.mass — the cached weight */
(function () {
  const P = R.phys = R.phys || {};
  P.off = false;
  P.G = 900; P.FRICTION = { ground: 8, ice: 1.5, sand: 12, air: 3 }; P.KNOCK_V = 6;
  P.STEP_T = 0.28; P.RIPPLE_T = 0.4; P.HITSTOP = 0.045; P.FLASH = 0.08; P.BIG_HIT = 0.15;
  P.TELEPORT = 60; P.SLOPE_DX = 8; P.STEEP = 0.9; P.UP_MAX = 0.35; P.DOWN_MAX = 0.15; P.WADE = 0.55; P.WADE_D = 0.5;
  P.ARROW_VZ = 120; P.STUCK_T = 6; P.PRINT_T = 10; P.RIPPLE_LIFE = 0.9; P.SAMPLE_T = 0.049; P.MOVING = 20;
  P.prints = []; P.stuck = []; P.ripples = []; P.stats = { ms: 0, movers: 0, steps: 0 };
  const MOVER = { player: 1, companion: 1, mob: 1, boss: 1, npc: 1 };
  const fn = (o, k) => (o && typeof o[k] === 'function' ? o[k] : null);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const hyp = Math.hypot, now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const COLD = /snow|frost|winter|north|wall|beyond|cold|ice|tundra|gift/, SAND = /dorne|desert|sand|dune|coast|beach|hot|sun/;
  const DUST = { snow: '#eef4ff', sand: '#d8b97a', wet: '#9fe3ff', stone: '#9aa3ad', grass: '#b9a58a' };
  const isMover = e => !!e && !!MOVER[e.kind] && !e.noPhys;

  /* ---- terrain, water, climate ---- */
  const groundFn = () => fn(R.render3d, 'groundY');
  P.heightAt = (x, y) => { const g = groundFn(); if (!g) return 0; try { return num(g(x, y), 0); } catch (e) { return 0; } };
  P.gradAt = (x, y) => {
    const g = groundFn(); if (!g) return { x: 0, y: 0, m: 0 };
    const d = P.SLOPE_DX; let gx = 0, gy = 0;
    try { gx = (num(g(x + d, y), 0) - num(g(x - d, y), 0)) / (2 * d); gy = (num(g(x, y + d), 0) - num(g(x, y - d), 0)) / (2 * d); } catch (e) { gx = gy = 0; }
    return { x: gx, y: gy, m: hyp(gx, gy) };
  };
  const regAt = (x, y) => { const f = fn(R.world, 'regionAt'); if (!f) return null; try { return f(x, y); } catch (e) { return null; } };
  const regStr = r => (r ? ((r.biome || '') + ' ' + (r.id || '') + ' ' + (r.name || '')).toLowerCase() : '');
  P.climateAt = (x, y) => { const s = regStr(regAt(x, y)); return COLD.test(s) ? 'cold' : SAND.test(s) ? 'sand' : 'temperate'; };
  P.depthAt = (x, y) => {
    const f = fn(R.water, 'depth');
    if (f) { let d = 0; try { d = num(f(x, y), 0); } catch (e) { d = 0; } return d < 0 ? 0 : d > 1 ? 1 : d; }
    /* no water module yet: the last 30 units before the sea mask are wading (a blocked cell that lies in no region = sea) */
    const bl = fn(R.world, 'blocked'); if (!bl || !(R.data && R.data.world && R.data.world.mask)) return 0;
    const W = 30, inW = fn(R.world, 'inWorld');
    const sea = (sx, sy) => bl(sx, sy) && (!inW || inW(sx, sy)) && !regAt(sx, sy);
    return sea(x + W, y) || sea(x - W, y) || sea(x, y + W) || sea(x, y - W) ? P.WADE_D : 0;
  };
  const inPoi = (x, y) => { const f = fn(R.world, 'inPoi') || fn(R.world, 'poiAt'); if (!f) return false; try { return !!f(x, y, 160); } catch (e) { return false; } };
  P.surfaceAt = (x, y, e) => {
    const depth = e && e.depth != null ? e.depth : P.depthAt(x, y), clim = (e && e.clim) || P.climateAt(x, y);
    if (depth >= P.WADE_D && clim !== 'cold') return 'wet';
    if (inPoi(x, y)) return 'stone';
    return clim === 'cold' ? 'snow' : clim === 'sand' ? 'sand' : 'grass';
  };
  P.frictionOf = e => { const F = P.FRICTION; if (e.fly) return F.air; if (e.onIce) return F.ice; if (e.clim === 'sand') return F.sand; return F.ground; };
  /* refresh the per-entity terrain samples (gradient, depth, climate) at most every 3 steps */
  const sample = (e, force) => {
    if (!force && e.physT != null && R.t - e.physT < P.SAMPLE_T) return;
    e.physT = R.t;
    e.grad = e.fly ? null : P.gradAt(e.x, e.y); e.steep = !!(e.grad && e.grad.m > P.STEEP);
    e.clim = P.climateAt(e.x, e.y);
    const d = e.fly ? 0 : P.depthAt(e.x, e.y); e.depth = d; e.onIce = d > 0 && e.clim === 'cold';
  };
  /* the displacement (dx,dy) of length d, corrected by the entity's cached terrain samples: the uphill part of a > 0.9 slope
     is removed (a wall you can still walk along), gentler slopes slow up to 35 % / speed 15 % downhill, water scales by depth */
  const correct = (e, dx, dy, d) => {
    let tx = dx, ty = dy; if (e.fly || !(d > 1e-9)) return [tx, ty];
    const g = e.grad;
    if (g && g.m > 1e-6) {
      const ux = g.x / g.m, uy = g.y / g.m, up = dx * ux + dy * uy;            /* units climbed along the uphill direction */
      if (up > 0) { if (g.m > P.STEEP) { tx -= up * ux; ty -= up * uy; } else { const k = 1 - Math.min(P.UP_MAX, up / d * g.m * 0.7); tx *= k; ty *= k; } }
      else if (up < 0) { const k = 1 + Math.min(P.DOWN_MAX, -up / d * g.m * 0.5); tx *= k; ty *= k; }
    }
    const dp = e.depth || 0; if (dp > 0 && !e.onIce) { const k = dp >= P.WADE_D ? P.WADE : 1 - (1 - P.WADE) * (dp / P.WADE_D); tx *= k; ty *= k; }
    return [tx, ty];
  };
  P.speedFactor = (e, dx, dy) => { const d = hyp(dx, dy); if (!(d > 1e-9)) return 1; const c = correct(e, dx, dy, d); return hyp(c[0], c[1]) / d; };

  /* ---- weight, impulses, movement ---- */
  const defBig = e => { const C = R.combat, d = (C && fn(C, 'defOf') && C.defOf(e.type)) || (R.data && R.data.mobs && R.data.mobs[e.type]) || null; return d && num(d.big, 0) > 0 ? d.big : 0; };
  P.massOf = e => { if (!e) return 1; if (typeof e.mass === 'number') return e.mass; let m = num(e.big, 0) || (e.type ? defBig(e) : 0) || 1; if (e.kind === 'boss') m = Math.max(m, 2); e.mass = m; return m; };
  P.isBig = e => P.massOf(e) >= 1.4;
  P.moveEnt = (e, dx, dy) => {
    if (!dx && !dy) return;
    const C = R.combat; if (C && fn(C, 'moveEnt')) { C.moveEnt(e, dx, dy); return; }
    const sl = !e.fly && fn(R.world, 'slide'); if (sl) { if (sl.length >= 4) { const q = sl(e.x, e.y, e.x + dx, e.y + dy, e.r); if (q && typeof q.x === 'number') { e.x = q.x; e.y = q.y; } } else sl(e, dx, dy); return; }
    e.x = R.clamp(e.x + dx, 0, R.W || 1e9); e.y = R.clamp(e.y + dy, 0, R.H || 1e9);
  };
  P.impulse = (e, ix, iy, o) => {
    if (!e || (!ix && !iy) || !isFinite(ix) || !isFinite(iy)) return e;
    o = o || {}; let k = o.raw ? 1 : (e.kind === 'boss' ? 0.15 : P.isBig(e) ? 0.3 : 1);
    const I = e.imp = e.imp || { x: 0, y: 0 }; I.x += ix * k; I.y += iy * k;
    const m = hyp(I.x, I.y); if (m > 1200) { I.x *= 1200 / m; I.y *= 1200 / m; }
    e.impT = R.t; return e;
  };
  P.vel = e => (e && e.vel) || { x: 0, y: 0 };
  P.speed = e => { const v = e && e.vel; return v ? hyp(v.x, v.y) : 0; };
  P.freeze = (e, s) => { if (e) e.stunMicro = Math.max(e.stunMicro || 0, s == null ? P.HITSTOP : s); return e; };
  P.flashEnt = (e, s) => { if (e) e.flash = Math.max(e.flash || 0, s == null ? P.FLASH : s); return e; };
  const noTumble = e => !e || e.kind !== 'mob' || e.fly || e.walker || P.massOf(e) >= 1.8 || /giant|mammoth|dragon|walker|lord|king/.test(e.type || '');
  P.tumble = (e, dir) => {
    if (P.off || noTumble(e) || e.tumble) return null;
    const sx = dir && dir.x ? (dir.x < 0 ? -1 : 1) : (e.imp && e.imp.x ? (e.imp.x < 0 ? -1 : 1) : (e.face || 1));
    e.z = 0; return e.tumble = { ang: 0, spin: 6 * sx, vz: 160, z: 0, bounced: false, done: false };
  };

  /* ---- R.hit wrapper: knock → impulse (the instant push stays when P.off) ---- */
  let lastHit = null;
  P.wrapHit = () => {
    const orig = R.hit; if (typeof orig !== 'function' || orig === lastHit) return false;
    if (orig.__phys) { lastHit = orig; return false; }
    const norm = (x, y) => { const m = hyp(x, y) || 1; return { x: x / m, y: y / m }; };
    const w = function (src, tgt, dmg, o) {
      if (P.off || !o || !o.knock || !tgt || tgt.kind === 'boss' || tgt.noKnock) return orig(src, tgt, dmg, o);
      const o2 = Object.assign({}, o, { knock: 0, knockImp: o.knock });
      const res = orig(src, tgt, dmg, o2);
      if (res && !res.blocked) {
        const k = o.knockDir ? norm(o.knockDir.x, o.knockDir.y) : (src && (src.x !== tgt.x || src.y !== tgt.y)) ? norm(tgt.x - src.x, tgt.y - src.y) : { x: tgt.face < 0 ? -1 : 1, y: 0 };
        P.impulse(tgt, k.x * o.knock * P.KNOCK_V, k.y * o.knock * P.KNOCK_V, { src });
        if (res.killed || (tgt.dead && !tgt.tumble)) P.tumble(tgt, k);
      }
      return res;
    };
    w.__phys = true; w.orig = orig; R.hit = w; lastHit = w;
    if (R.combat && R.combat.hit === orig) R.combat.hit = w;
    return true;
  };
  P.wrapHit();

  /* ---- the home-region gate (the KNOWN BUG of the integrated build): A07 marks a gate's home houses (gates[].homeOf, gateFor(region,
     house) → null at home), but A06's R.world.gateOpen ignores it, so a Stark hero who starts at Winterfell inside the gated North was
     pushed 480 units south by the world watcher every 0.5 s (the probe: stick right 60 steps → +149 x, +960 y). Until A06 reads
     gateFor itself, the gate of the account house's own region counts as open. Guarded: no data / no gateFor → A06's answer. */
  const houseNow = () => { let a = null; try { a = typeof R.acc === 'function' ? R.acc() : null; } catch (e) { a = null; } a = a || (R.state && R.state.acc) || null;
    return (a && a.house) || (R.state && R.state.p && R.state.p.house) || null; };
  P.homeGate = id => {
    const D = R.data && R.data.world, h = houseNow(); if (!D || !h) return false;
    const rid = typeof id === 'string' ? id : id && id.id; if (!rid) return false;
    try { if (typeof D.gateFor === 'function') return !D.gateFor(rid, h) && !!(D.gates || []).find(g => g && g.region === rid); } catch (e) { return false; }
    const g = (D.gates || []).find(q => q && q.region === rid); return !!(g && Array.isArray(g.homeOf) && g.homeOf.indexOf(h) >= 0);
  };
  P.wrapGate = () => {
    const W = R.world; if (!W || typeof W.gateOpen !== 'function' || W.gateOpen.__phys) return false;
    const orig = W.gateOpen;
    const g = function (id) { const r = orig.apply(this, arguments); if (r || P.off) return r; return P.homeGate(id) ? true : r; };
    g.__phys = true; g.orig = orig; W.gateOpen = g; return true;
  };
  P.wrapGate();

  /* ---- hit feel + death tumble ---- */
  R.bus.on('hit', info => {
    if (P.off || !info || !info.tgt || info.dot) return;
    const t = info.tgt, frac = num(info.dmg, 0) / Math.max(1, num(t.hpMax, 1));
    if (frac <= P.BIG_HIT) return;
    P.freeze(t); P.flashEnt(t);
    const sh = fn(R.fx, 'shake'); if (sh) sh(Math.min(14, 3 + 40 * frac), 0.18);
  });
  R.bus.on('kill', e => {
    if (P.off || !e || e.tumble) return;
    const I = e.imp, recent = (e.impT != null && R.t - e.impT < 0.5) || (I && hyp(I.x, I.y) > 30);
    if (recent) P.tumble(e, I && (I.x || I.y) ? I : null);
  });
  R.bus.on('spawn', e => { if (isMover(e)) e.prev = { x: e.x, y: e.y }; });

  /* ---- physPre (79): hit-stop / flash timers, re-wrap R.hit, mobs avoid water ---- */
  R.addSys('physPre', { order: 79, update(dt) {
    if (P.off) return;
    if (R.hit !== lastHit) P.wrapHit();
    if (R.world && R.world.gateOpen && !R.world.gateOpen.__phys) P.wrapGate();
    for (const e of R.ents) {
      if (e.stunMicro > 0) e.stunMicro -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.kind === 'mob' && !e.fly && e.avoidWater == null) e.avoidWater = true;
    }
  } });

  /* ---- physPost (101): terrain correction, impulses, velocity, footsteps, shoves, tumbles, arrows ---- */
  const footstep = (e, dt) => {
    const sp = P.speed(e);
    if (sp < P.MOVING) { e.stepT = 0; e.rippleT = 0; return; }
    e.stepT = (e.stepT || 0) + dt;
    if (e.stepT >= P.STEP_T) {
      e.stepT -= P.STEP_T;
      const s = e.surface = P.surfaceAt(e.x, e.y, e);
      R.bus.emit('footstep', e, s);
      const sp2 = fn(R.fx, 'spawn'); if (sp2 && (s !== 'grass' || e !== R.player)) sp2('dust', e.x - (e.face || 1) * 3, e.y + 2, { col: DUST[s] || DUST.grass, n: 1 });
      if (s === 'snow') { const ang = Math.atan2(e.vel.y, e.vel.x), side = (e.stepN = ((e.stepN || 0) + 1) % 2) ? 1 : -1, px = -Math.sin(ang) * 4 * side, py = Math.cos(ang) * 4 * side;
        if (P.prints.length >= 60) P.prints.shift(); P.prints.push({ x: e.x + px, y: e.y + py, ang, t: R.t, side }); }
    }
    if (e.wading) { e.rippleT = (e.rippleT || 0) + dt; if (e.rippleT >= P.RIPPLE_T) { e.rippleT -= P.RIPPLE_T; if (P.ripples.length >= 40) P.ripples.shift(); P.ripples.push({ x: e.x, y: e.y, t: R.t, r: (e.r || 12) * 0.8 }); } }
  };
  const splash = e => {
    R.bus.emit('splash', e);
    const sp = fn(R.fx, 'spawn'); let p = null; if (sp) p = sp('splash', e.x, e.y, { col: DUST.wet, n: 3 });
    if (!p && fn(R.fx, 'num')) R.fx.num(e.x, e.y - (e.r || 12), '💧', DUST.wet);
    if (P.ripples.length >= 40) P.ripples.shift(); P.ripples.push({ x: e.x, y: e.y, t: R.t, r: (e.r || 12) });
  };
  const shove = (e, movers, dt) => {                   /* a moving giant drifts lighter neighbours aside (soft, on top of A11's separation) */
    const v = e.vel, sp = v ? hyp(v.x, v.y) : 0; if (sp < 15) return;
    const m = P.massOf(e), reach = (e.r || 14) + 40;
    for (const n of movers) {
      if (n === e || n.dead || n.fly || n.kind === 'boss' || P.massOf(n) >= m) continue;
      const dx = n.x - e.x, dy = n.y - e.y; if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
      const d = hyp(dx, dy), min = (e.r || 14) + (n.r || 14) + 6; if (d >= min) continue;
      const ux = d > 1e-6 ? dx / d : (v.x >= 0 ? 1 : -1), uy = d > 1e-6 ? dy / d : 0, a = 6 * sp * dt;     /* acceleration 6·|v| u/s² while in contact */
      P.impulse(n, ux * a, uy * a, { raw: true });
    }
  };
  const tumbleStep = (e, dt) => {
    const T = e.tumble; if (!T || T.done) return;
    T.vz -= P.G * dt; T.z += T.vz * dt; T.ang += T.spin * dt;
    if (T.z <= 0) { T.z = 0; if (!T.bounced && T.vz < -40) { T.bounced = true; T.vz = -T.vz * 0.35; T.spin *= 0.5; } else { T.vz = 0; T.spin = 0; T.done = true; } }
    e.z = T.z; e.vz = T.vz;
  };
  const arrowStep = (p, dt) => {
    if (p.dead || (p.drawKind || 'arrow') !== 'arrow' || p.noGrav || (p.o && (p.o.kind === 'fire' || p.o.kind === 'holy'))) return false;
    if (p.vz == null) { const T = num(p.ttl, 0), z0 = num(p.z, 18); p.z = z0; p.vz = T > 0.05 ? Math.max(P.ARROW_VZ, (0.5 * P.G * T * T - z0) / T) : P.ARROW_VZ; p.grav = true; }
    p.vz -= P.G * dt; p.z += p.vz * dt;
    if (p.z > 0) return false;
    /* landed: out of R.ents (so A11's proj system stops hitting with it), 6 s in the ground, drawn by our overlay */
    p.z = 0; p.vz = 0; p.stuck = true; p.life = P.STUCK_T; p.landT = R.t; p.dead = true;
    if (p.ang == null) p.ang = Math.atan2(p.vy || 0, p.vx || 1);
    R.remove(p); if (P.stuck.length >= 40) P.stuck.shift(); P.stuck.push(p);
    const sp = fn(R.fx, 'spawn'); if (sp) sp('dust', p.x, p.y, { n: 1 });
    R.bus.emit('land', p); R.bus.emit('projend', p);
    return true;
  };
  R.addSys('physPost', { order: 101, update(dt) {
    if (P.off || !(dt > 0)) return;
    const t0 = now(), movers = [], ents = R.ents; let nMov = 0;
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      if (e.kind === 'proj') { arrowStep(e, dt); continue; }
      if (!isMover(e)) continue;
      movers.push(e);
      const pv = e.prev; if (!pv) { e.prev = { x: e.x, y: e.y }; e.vel = e.vel || { x: 0, y: 0 }; continue; }
      const alive = !e.dead;
      let dx = e.x - pv.x, dy = e.y - pv.y, d2 = dx * dx + dy * dy;
      if (d2 > P.TELEPORT * P.TELEPORT) { pv.x = e.x; pv.y = e.y; e.vel = { x: 0, y: 0 }; e.stepT = 0; sample(e, true); continue; }
      const I = e.imp, hasImp = !!(I && (I.x || I.y));
      if (alive && (d2 > 1e-8 || hasImp)) sample(e);
      /* 1. what the other modules moved this step, corrected for slope, water and hit-stop */
      if (alive && d2 > 1e-8) {
        let tx = 0, ty = 0;
        if (!(e.stunMicro > 0)) { const c = correct(e, dx, dy, Math.sqrt(d2)); tx = c[0]; ty = c[1]; }
        if (tx !== dx || ty !== dy) P.moveEnt(e, tx - dx, ty - dy);
      }
      /* 2. standing on a cliff face slides you down it */
      if (alive && !e.fly && e.steep && e.grad && e.grad.m > 1e-6 && !(e.stunMicro > 0)) P.moveEnt(e, -e.grad.x / e.grad.m * 60 * dt, -e.grad.y / e.grad.m * 60 * dt);
      /* 3. impulses (corpses slide too), friction by surface */
      if (hasImp && !(e.stunMicro > 0)) {
        P.moveEnt(e, I.x * dt, I.y * dt);
        const k = Math.exp(-P.frictionOf(e) * dt); I.x *= k; I.y *= k;
        if (I.x * I.x + I.y * I.y < 9) { I.x = 0; I.y = 0; }
      }
      /* 4. the measured velocity */
      dx = e.x - pv.x; dy = e.y - pv.y;
      const v = e.vel || (e.vel = { x: 0, y: 0 }); v.x = dx / dt; v.y = dy / dt; pv.x = e.x; pv.y = e.y;
      /* 5. water state, footsteps, ripples */
      if (alive && !e.fly) {
        const wading = (e.depth || 0) >= P.WADE_D && !e.onIce; if (wading && !e.wading) splash(e); e.wading = wading;
        footstep(e, dt);
      } else e.wading = false;
      tumbleStep(e, dt);
      nMov++;
    }
    /* 6. giants push lighter neighbours aside */
    for (const e of movers) if (!e.dead && P.massOf(e) >= 1.4) shove(e, movers, dt);
    /* 7. landed arrows, ripples and prints age out */
    for (let i = P.stuck.length - 1; i >= 0; i--) { const p = P.stuck[i]; p.life -= dt; if (p.life <= 0) P.stuck.splice(i, 1); }
    if (P.ripples.length && R.t - P.ripples[0].t > P.RIPPLE_LIFE) { const k = P.ripples.findIndex(r => R.t - r.t <= P.RIPPLE_LIFE); P.ripples.splice(0, k < 0 ? P.ripples.length : k); }
    if (P.prints.length && R.t - P.prints[0].t > P.PRINT_T) P.prints.shift();
    P.stats.movers = nMov; P.stats.steps++; P.stats.ms = now() - t0;
  } });

  /* ---- the 2D overlay (902, after the renderer): snow footprints, water rings, arrows in the ground ---- */
  R.addSys('physDraw', { order: 902, draw(ctx) {
    if (P.off || !ctx || !(P.prints.length || P.ripples.length || P.stuck.length)) return;
    const t = R.t, z = R.cam.z || 1, vw = R.vw || 390, vh = R.vh || 844, C = R.cam;
    const p0 = R.w2s(C.x, C.y, 0), p1 = R.w2s(C.x, C.y, 10), flat = !p1 || p1.y === p0.y;   /* the 2D core ignores z: raise by hand */
    const on = s => s && !s.behind && s.x > -30 && s.y > -30 && s.x < vw + 30 && s.y < vh + 30;
    ctx.save();
    for (const q of P.prints) { const age = t - q.t; if (age < 0 || age > P.PRINT_T) continue; const s = R.w2s(q.x, q.y, 0); if (!on(s)) continue;
      ctx.globalAlpha = 0.4 * (1 - age / P.PRINT_T); ctx.fillStyle = '#6d82a4'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 3.6 * z, 2.2 * z, q.ang, 0, 7); ctx.fill(); }
    ctx.lineWidth = Math.max(1, 1.2 * z); ctx.strokeStyle = '#cfe9ff';
    for (const q of P.ripples) { const k = (t - q.t) / P.RIPPLE_LIFE; if (k < 0 || k > 1) continue; const s = R.w2s(q.x, q.y, 0); if (!on(s)) continue;
      const r = (q.r + 18 * k) * z; ctx.globalAlpha = 0.5 * (1 - k); ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * 0.45, 0, 0, 7); ctx.stroke(); }
    ctx.lineCap = 'round';
    for (const p of P.stuck) { const a = R.w2s(p.x, p.y, 0); if (!on(a)) continue; const b = R.w2s(p.x - Math.cos(p.ang) * 7, p.y - Math.sin(p.ang) * 7, 8); if (flat) b.y -= 8 * z;
      ctx.globalAlpha = Math.min(1, p.life / 1.2) * 0.9; ctx.strokeStyle = p.col || '#f1dca3'; ctx.lineWidth = Math.max(1, 1.6 * z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.restore();
  } });
})();
