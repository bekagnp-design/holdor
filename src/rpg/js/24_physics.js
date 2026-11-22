/* HOLDOR RPG — 24_physics.js (A45, G4): the physics feel layer, "physics to the maximum" (GTA as a feel reference). ADDITIVE.
   Three systems bracket every mover: physPre (79, before the player 80 / ai 100), physMid (80.5, right after the player: what
   the hero's OWN walk / dodge moved) and physPost (101, after the AI). physPost measures what the other modules moved this step
   (pos − e.prev) and: gives the hero weight (his own walk becomes a target velocity that e.walk reaches in ~0.12 s and leaves in
   ~0.1 s; ice ×0.14 grip → he slides; dodges are immediate; moves by other systems pass untouched), corrects walking for terrain
   (slopes from R.render3d.groundY: up to 35 % slower uphill, 15 % faster down, > 0.9 = a wall; R.water.depth: wading 55 %,
   deep 40 %), integrates impulses (e.imp, friction by surface, sub-steps of ≤ 6 units → no tunnelling), pushes bodies out of
   circle colliders (A43's rocks + tree trunks, the four towers of every seat castle, P.extra), keeps every mover out of the
   blocked mask, lets the hero (and knocked mobs) fall off banks and land (camera kick), and infers e.vel. R.hit is wrapped
   (once, wherever it sits in the chain) so o.knock N becomes an impulse that slides ~N units; giants take a fraction. A kill
   launches the body away from the blow and tumbles it; big hits give hit-stop + flash + a camera kick; arrows fly on a lob and
   stay 6 s in the ground; loot drops bounce once; footsteps by surface, prints on snow, ripples in water.
   R.world.gateOpen is wrapped so the account house's own region counts as open (A07's gates[].homeOf; A06 ignored it and pushed a
   Stark hero 480 units south of Winterfell every 0.5 s). R.phys.off = true disables all of it.

   API (R.phys = P):
     P.impulse(e, ix, iy, o)   add an impulse velocity (u/s); o:{raw:1 ignores weight, src}. × 1/mass, giants (≥ 1.4) 0.57/mass, bosses 0.15
     P.move(e, dx, dy)         a displacement in sub-steps (≤ P.SUB units), each slid against the mask and pushed out of colliders
     P.collide(e) → bool       push e out of every collider it overlaps;  P.collidersNear(x, y, r) → [{x,y,r}];  P.colliderCount
     P.extra                   [{x,y,r}] extra circle colliders (tests, other modules); P.natureCols = false leaves A43's out
     P.towers() → [{x,y,r}]    the seat-castle towers;  P.rebuildColliders() (automatic when A43's chunk set changes)
     P.TREE                    trunk radius by A43 record type (other tall PROPS → 5); a chunk's ch.cols [{x,y,r}] replaces obst + recs
     P.iceAt(x,y) / P.icePatch frozen water in the cold, ~20 % patches beyond the Wall / in the Always Winter
     P.homeGate(regionId)      true when that region's gate is the account house's home (open);  P.wrapGate()
     P.blockedAt(x,y)          R.world.blocked, guarded
     P.ACC / P.BRAKE / P.ICE_GRIP / P.WALK_MAX / P.FALL_V / P.LAND_V / P.KILL_V   the tuning (u/s², u/s)
     P.vel(e) → {x,y}          the measured velocity of the last step (u/s). P.speed(e) → |vel|
     P.massOf(e)               1 = a man; from e.mass, e.big or the mob def's big (giant 1.9, mammoth 2.2, …)
     P.freeze(e, s)            hit-stop: e.stunMicro = s (0.045 default) — physPost undoes the entity's motion while it lasts
     P.tumble(e, dir)          start a death tumble (spin from dir.x); walkers, giants and flyers never tumble
     P.gradAt(x,y) → {x,y,m}   terrain gradient (dh per unit), sampled ±8; m = |gradient|, > 0.9 is a wall
     P.depthAt(x,y) → 0..1     water depth (R.water.depth; without it the 30 units before the sea mask count as 0.5)
     P.climateAt(x,y)          'cold' | 'sand' | 'temperate' from the region's biome / id / name
     P.surfaceAt(x,y,e)        'ice' | 'wet' | 'stone' | 'snow' | 'sand' | 'grass' (the footstep surface; A33 maps ice → stepSnow)
     P.speedFactor(e,dx,dy)    what a displacement is scaled by (slope × water), from the entity's cached samples
     P.frictionOf(e)           1/s decay of e.imp on the entity's surface: ground 8, ice 1.5, sand 12, air 3
     P.wrapHit()               (re)wraps R.hit when a new one appears (physPre checks each step, so test fakes work)
     P.prints / P.stuck / P.ripples   ring buffers the overlay draws (snow footprints ≤ 60, landed arrows ≤ 40, water rings ≤ 40)
     P.stats {ms, movers, steps}      the last physPost cost in ms
   Events: 'footstep'(e, surface) every 0.28 s of movement · 'splash'(e) on entering water · 'land'(p) when an arrow lands ·
           'landed'(e, speed) when the hero / a mob comes down from a fall.

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
     e.avoidWater      true on walking mobs (the AI may read it);  e.mass — the cached weight
     e.walk {x,y}      the hero's weighted velocity (u/s);  e.air — falling (e.z, e.vz);  e.physPre / e.physMid — the own-move probe
     e.bounces         a loot drop's bounce count */
(function () {
  const P = R.phys = R.phys || {};
  P.off = false;
  P.G = 900; P.FRICTION = { ground: 8, ice: 1.5, sand: 12, air: 3 }; P.KNOCK_V = 6;
  P.STEP_T = 0.28; P.RIPPLE_T = 0.4; P.HITSTOP = 0.045; P.FLASH = 0.08; P.BIG_HIT = 0.15;
  P.TELEPORT = 60; P.SLOPE_DX = 8; P.STEEP = 0.9; P.UP_MAX = 0.35; P.DOWN_MAX = 0.15; P.WADE = 0.55; P.WADE_D = 0.5;
  P.ARROW_VZ = 120; P.STUCK_T = 6; P.KNOCK_V = (1 - Math.exp(-P.FRICTION.ground / 60)) * 60;   /* knock N units → an impulse that slides ~N units on the ground (fixed 60 Hz steps) */ P.PRINT_T = 10; P.RIPPLE_LIFE = 0.9; P.SAMPLE_T = 0.049; P.MOVING = 20;
  P.ACC = 1450; P.BRAKE = 1750; P.ICE_GRIP = 0.14; P.DODGE_EXIT = 0.45; P.SUB = 6; P.FALL_V = 160; P.SWIM = 0.4; P.UP_DEAD = 0.06;
  P.KILL_V = 170; P.LAND_V = 220; P.UNSTICK_V = 150;
  P.prints = []; P.stuck = []; P.ripples = []; P.stats = { ms: 0, movers: 0, steps: 0, cols: 0 };
  const MOVER = { player: 1, companion: 1, mob: 1, boss: 1, npc: 1 };
  const LIGHT = { critter: 1 };                       /* collide with trees / rocks / walls only (no terrain feel, no footsteps) */
  const fn = (o, k) => (o && typeof o[k] === 'function' ? o[k] : null);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const hyp = Math.hypot, now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const COLD = /snow|frost|winter|north|wall|beyond|cold|ice|tundra|gift/, SAND = /dorne|desert|sand|dune|coast|beach|hot|sun/;
  const DUST = { ice: '#dff3ff', snow: '#eef4ff', sand: '#d8b97a', wet: '#9fe3ff', stone: '#9aa3ad', grass: '#b9a58a' };
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
  const climOf = s => (COLD.test(s) ? 'cold' : SAND.test(s) ? 'sand' : 'temperate');
  P.climateAt = (x, y) => climOf(regStr(regAt(x, y)));
  /* ice: frozen water in the cold, and glassy patches (a fixed noise field, ~20 % of the ground) beyond the Wall / in the Always Winter */
  const ICE_RG = /winter|beyond|glacier|always/;
  P.icePatch = (x, y) => Math.sin(x * 0.0041 + 1.3) * Math.cos(y * 0.0037 - 0.7) + 0.5 * Math.sin((x + y) * 0.0093) > 0.55;
  P.iceAt = (x, y) => { const rs = regStr(regAt(x, y)); if (climOf(rs) !== 'cold') return false; return P.depthAt(x, y) > 0 || (ICE_RG.test(rs) && P.icePatch(x, y)); };
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
    if (e && e.onIce) return 'ice';
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
    const rs = regStr(regAt(e.x, e.y)); e.clim = climOf(rs);
    const d = e.fly ? 0 : P.depthAt(e.x, e.y); e.depth = d; e.onIce = e.clim === 'cold' && (d > 0 || (ICE_RG.test(rs) && P.icePatch(e.x, e.y)));
  };
  /* the displacement (dx,dy) of length d, corrected by the entity's cached terrain samples: the uphill part of a > 0.9 slope
     is removed (a wall you can still walk along), gentler slopes slow up to 35 % / speed 15 % downhill, water scales by depth */
  const correct = (e, dx, dy, d) => {
    let tx = dx, ty = dy; if (e.fly || !(d > 1e-9)) return [tx, ty];
    const g = e.grad;
    if (g && g.m > P.UP_DEAD) {
      const ux = g.x / g.m, uy = g.y / g.m, up = dx * ux + dy * uy;            /* units climbed along the uphill direction */
      if (up > 0) { if (g.m > P.STEEP) { tx -= up * ux; ty -= up * uy; } else { const k = 1 - Math.min(P.UP_MAX, up / d * g.m * 0.7); tx *= k; ty *= k; } }
      else if (up < 0) { const k = 1 + Math.min(P.DOWN_MAX, -up / d * g.m * 0.5); tx *= k; ty *= k; }
    }
    const dp = e.depth || 0; if (dp > 0 && !e.onIce) { const k = dp >= 1 ? P.SWIM : dp >= P.WADE_D ? P.WADE : 1 - (1 - P.WADE) * (dp / P.WADE_D); tx *= k; ty *= k; }
    return [tx, ty];
  };
  P.speedFactor = (e, dx, dy) => { const d = hyp(dx, dy); if (!(d > 1e-9)) return 1; const c = correct(e, dx, dy, d); return hyp(c[0], c[1]) / d; };

  /* ---- weight, impulses, movement ---- */
  /* weight: e.big, the old enemy table's big (A11's FALLBACK), A08's size, else by name (A08's table has no big) */
  const MASS_RE = [[/mammoth/, 2.2], [/giant/, 1.9], [/brood/, 1.8], [/troll|ogre|bear/, 1.5], [/king|lord/, 1.5], [/chief/, 1.4], [/walker/, 1.25]];
  const defBig = e => {
    const C = R.combat, t = e.type || ''; let d = null;
    try { d = (C && fn(C, 'defOf') && C.defOf(t)) || null; } catch (x) { d = null; }
    const F = C && C.FALLBACK && C.FALLBACK[t], M = R.data && R.data.mobs && R.data.mobs[t];
    for (const q of [d, F, M]) if (q && num(q.big, 0) > 1) return q.big;
    if (M && num(M.size, 0) >= 1.3) return M.size;
    const nm = (t + ' ' + ((M && (M.sprite || M.arch)) || '') + ' ' + (e.name || '')).toLowerCase();
    for (const [re, m] of MASS_RE) if (re.test(nm)) return m;
    return 0;
  };
  P.massOf = e => { if (!e) return 1; if (typeof e.mass === 'number') return e.mass; let m = num(e.big, 0) || (e.type ? defBig(e) : 0) || 1; if (e.kind === 'boss') m = Math.max(m, 2); e.mass = m; return m; };
  P.isBig = e => P.massOf(e) >= 1.4;
  P.moveEnt = (e, dx, dy) => {
    if (!dx && !dy) return;
    const C = R.combat; if (C && fn(C, 'moveEnt')) { C.moveEnt(e, dx, dy); return; }
    const sl = !e.fly && fn(R.world, 'slide'); if (sl) { if (sl.length >= 4) { const q = sl(e.x, e.y, e.x + dx, e.y + dy, e.r); if (q && typeof q.x === 'number') { e.x = q.x; e.y = q.y; } } else sl(e, dx, dy); return; }
    e.x = R.clamp(e.x + dx, 0, R.W || 1e9); e.y = R.clamp(e.y + dy, 0, R.H || 1e9);
  };
  /* ---- colliders: circles from A43's chunks (rocks = ch.obst, tree trunks / farms / mills from ch.recs), the four towers of every
     seat castle (A37's castle: corners at ±150·1.45, radius 26·1.45) and P.extra (tests / other modules: {x,y,r}). A 60-unit grid,
     rebuilt when the chunk set changes. Entities collide with their body (0.55 × e.r, ≤ 11), not their hit radius. ---- */
  const TREE = P.TREE = { pine_l: 7, pine_m: 6, pine_s: 4.5, birch: 4.5, deadtree: 5, blackpine: 6.5, weirwood: 10, willow: 7, oak: 7, fir: 6, elm: 7, benttree: 6, goldtree: 7, palm: 5, cactus: 6, stump: 6, farm: 15, mill: 16, haystack: 9 };
  /* a trunk radius for a placed record type: the table above, else any tall prop A43 describes (PROPS[t].h ≥ 40, not already an
     obstacle), else a tree-like name — keyed on what 09_nature exposes (chunk recs by prop type), never on how a tree is drawn */
  const TREE_RE = /tree|pine|oak|elm|fir|birch|palm|willow|weirwood|ash|yew|cedar|sentinel|ironwood/;
  const trunkR = t => { if (TREE[t]) return TREE[t]; const D = R.nature && R.nature.PROPS && R.nature.PROPS[t]; if (D && D.obst) return 0;
    if (D && num(D.h, 0) >= 40) return 5; return TREE_RE.test(t) ? 5 : 0; };
  const CC = 60; let grid = new Map(), gridSig = null; P.extra = P.extra || []; P.colliderCount = 0; P.natureCols = true;
  const gk = (cx, cy) => cx * 4099 + cy;
  const addC = (x, y, r) => { if (!(r > 0) || !isFinite(x) || !isFinite(y)) return; const o = { x, y, r }; P.colliderCount++;
    for (let cx = Math.floor((x - r) / CC), cx1 = Math.floor((x + r) / CC); cx <= cx1; cx++) for (let cy = Math.floor((y - r) / CC), cy1 = Math.floor((y + r) / CC); cy <= cy1; cy++) { const k = gk(cx, cy); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(o); } };
  const seatPois = () => { const W = R.data && R.data.world, ps = W && W.pois; if (!ps) return []; return (Array.isArray(ps) ? ps : Object.values(ps)).filter(q => q && q.seat && (q.type === 'castle' || q.kind === 'castle') && typeof q.x === 'number'); };
  P.towers = () => { const out = []; for (const q of seatPois()) for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push({ x: q.x + c[0] * 217.5, y: q.y + c[1] * 217.5, r: 37 }); return out; };
  P.rebuildColliders = () => {
    grid = new Map(); P.colliderCount = 0; const N = R.nature;
    let nCh = 0;
    if (P.natureCols && N && N.chunks && typeof N.chunks.values === 'function') for (const ch of N.chunks.values()) { if (!ch) continue; nCh++;
      if (Array.isArray(ch.cols)) { for (const o of ch.cols) if (o) addC(o.x, o.y, o.r); continue; }     /* an explicit list wins (A43 / G2 may add one) */
      for (const o of ch.obst || []) addC(o.x, o.y, o.r);
      const rc = ch.recs || {}; for (const t in rc) { const tr = trunkR(t); if (!tr) continue; for (const q of rc[t]) if (q) addC(q.x, q.y, tr * num(q.s, 1)); } }
    if (P.natureCols && !nCh && N && Array.isArray(N.obstacles)) for (const o of N.obstacles) if (o) addC(o.x, o.y, o.r);
    for (const o of P.towers()) addC(o.x, o.y, o.r);
    for (const o of P.extra) if (o) addC(o.x, o.y, o.r);
  };
  const colSig = () => { const N = R.nature; let sg = (P.natureCols ? 1 : 0) + '|' + ((R.data && R.data.world && R.data.world.pois) ? 1 : 0) + '|';
    for (const o of P.extra) if (o) sg += o.x + ',' + o.y + ',' + o.r + ';';
    if (P.natureCols && N && N.chunks && typeof N.chunks.forEach === 'function') N.chunks.forEach((ch, k) => { sg += k + ':' + (ch && ch.n || 0) + ':' + (ch && ch.cols ? ch.cols.length : '') + ';'; });
    if (P.natureCols && N && Array.isArray(N.obstacles)) sg += '|o' + N.obstacles.length; return sg; };
  const bodyR = e => Math.min(11, 0.55 * num(e.r, 12));
  /* push e out of every collider it overlaps (two passes); returns true when it touched one */
  P.collide = e => {
    if (!grid.size || e.fly || e.noCollide2) return false;
    const br = bodyR(e); let hit = false;
    for (let pass = 0; pass < 2; pass++) { let moved = false;
      const cx0 = Math.floor((e.x - br) / CC), cx1 = Math.floor((e.x + br) / CC), cy0 = Math.floor((e.y - br) / CC), cy1 = Math.floor((e.y + br) / CC);
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) { const a = grid.get(gk(cx, cy)); if (!a) continue;
        for (const o of a) { const dx = e.x - o.x, dy = e.y - o.y, min = o.r + br; if (dx > min || dx < -min || dy > min || dy < -min) continue; const d2 = dx * dx + dy * dy; if (d2 >= min * min) continue;
          const d = Math.sqrt(d2); let ux, uy; if (d > 1e-6) { ux = dx / d; uy = dy / d; } else { ux = 1; uy = 0; }
          const nx = o.x + ux * (min + 0.01), ny = o.y + uy * (min + 0.01);
          if (!blockedAt(nx, ny)) { e.x = nx; e.y = ny; moved = hit = true; }
          const I = e.imp; if (I) { const vn = I.x * ux + I.y * uy; if (vn < 0) { I.x -= vn * ux * 1.3; I.y -= vn * uy * 1.3; } } } }
      if (!moved) break; }
    return hit;
  };
  P.collidersNear = (x, y, r) => { const out = [], seen = new Set(); for (let cx = Math.floor((x - r) / CC); cx <= Math.floor((x + r) / CC); cx++) for (let cy = Math.floor((y - r) / CC); cy <= Math.floor((y + r) / CC); cy++) { const a = grid.get(gk(cx, cy)); if (a) for (const o of a) if (!seen.has(o)) { seen.add(o); out.push(o); } } return out; };
  const blockedAt = (x, y) => { const b = fn(R.world, 'blocked'); if (!b) return false; try { return !!b(x, y); } catch (e) { return false; } };
  P.blockedAt = blockedAt;
  /* a displacement in sub-steps of ≤ P.SUB units, each slid against the mask and pushed out of colliders: no tunnelling */
  P.move = (e, dx, dy) => {
    if (!dx && !dy) return; const n = Math.min(12, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / P.SUB)));
    for (let i = 0; i < n; i++) { P.moveEnt(e, dx / n, dy / n); P.collide(e); }
  };
  P.impulse = (e, ix, iy, o) => {
    if (!e || (!ix && !iy) || !isFinite(ix) || !isFinite(iy)) return e;
    o = o || {}; const m = P.massOf(e); let k = o.raw ? 1 : (e.kind === 'boss' ? 0.15 : m >= 1.4 ? 0.57 / m : 1 / Math.max(0.5, m));
    const I = e.imp = e.imp || { x: 0, y: 0 }; I.x += ix * k; I.y += iy * k;
    const im = hyp(I.x, I.y); if (im > 1200) { I.x *= 1200 / im; I.y *= 1200 / im; }
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
    /* already in the chain (A12's wrapper sits on top of ours): never wrap twice — the two re-wraps grew R.hit by 2 per step */
    for (let f = orig, n = 0; f && n < 10000; f = f.orig, n++) if (f.__phys || f.physWrap) { lastHit = orig; return false; }
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
    w.__phys = true; w.physWrap = true; w.orig = orig; R.hit = w; lastHit = w;
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
    const W = R.world; if (!W || typeof W.gateOpen !== 'function') return false;
    for (let f = W.gateOpen, n = 0; f && n < 64; f = f.orig, n++) if (f.__phys) return false;
    const orig = W.gateOpen;
    const g = function (id) { const r = orig.apply(this, arguments); if (r || P.off) return r; return P.homeGate(id) ? true : r; };
    g.__phys = true; g.orig = orig; W.gateOpen = g; return true;
  };
  let lastGate = null; P.wrapGate(); lastGate = R.world && R.world.gateOpen;

  /* ---- hit feel + death tumble ---- */
  R.bus.on('hit', info => {
    if (P.off || !info || !info.tgt || info.dot) return;
    const t = info.tgt, frac = num(info.dmg, 0) / Math.max(1, num(t.hpMax, 1));
    if (frac <= P.BIG_HIT) return;
    P.freeze(t); P.flashEnt(t);
    const sh = fn(R.fx, 'shake'); if (sh) sh(Math.min(14, 3 + 40 * frac), 0.18);
  });
  /* a mob that dies tumbles: along its knock when it had one, else launched away from the killing blow (P.KILL_V u/s) */
  R.bus.on('kill', (e, by) => {
    if (P.off || !e || e.tumble) return;
    const I = e.imp, recent = (e.impT != null && R.t - e.impT < 0.5) || (I && hyp(I.x, I.y) > 30);
    if (recent) { P.tumble(e, I && (I.x || I.y) ? I : null); return; }
    if (!by || noTumble(e)) return;
    const dx = e.x - num(by.x, e.x), dy = e.y - num(by.y, e.y), m = hyp(dx, dy); if (!(m > 1e-6)) return;
    P.impulse(e, dx / m * P.KILL_V, dy / m * P.KILL_V, { src: by }); P.tumble(e, { x: dx, y: dy });
  });
  R.bus.on('spawn', e => { if (isMover(e)) e.prev = { x: e.x, y: e.y }; });

  /* ---- physPre (79): hit-stop / flash timers, re-wrap R.hit, mobs avoid water ---- */
  R.addSys('physPre', { order: 79, update(dt) {
    if (P.off) return;
    if (R.hit !== lastHit) P.wrapHit();
    if (R.world && R.world.gateOpen && R.world.gateOpen !== lastGate) { P.wrapGate(); lastGate = R.world.gateOpen; }
    for (const e of R.ents) {
      if (e.stunMicro > 0) e.stunMicro -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.kind === 'mob' && !e.fly && e.avoidWater == null) e.avoidWater = true;
    }
    const h = R.player; if (h) { const q = h.physPre || (h.physPre = { x: 0, y: 0, t: -1 }); q.x = h.x; q.y = h.y; q.t = R.t; }
  } });
  /* physMid (80.5, right after the player system): what the hero's OWN walking / dodge moved this step. Only that gets the weight;
     whatever else moved him (a skill dash, the world's gate push, a knock without physics, a test's put) passes through untouched. */
  R.addSys('physMid', { order: 80.5, update() {
    if (P.off) return; const h = R.player, q = h && h.physPre; if (!q || q.t !== R.t) return;
    const m = h.physMid || (h.physMid = { x: 0, y: 0, t: -1 }); m.x = h.x - q.x; m.y = h.y - q.y; m.t = R.t;
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
  /* the hero's weight: his own displacement becomes a target velocity (slope / water corrected) that his real velocity e.walk reaches at
     P.ACC (full speed in ~0.12 s) and leaves at P.BRAKE (a stop in ~0.1 s, a reversal in ~0.2 s); on ice both × P.ICE_GRIP, so he
     slides. A dodge is immediate (its exit is capped at 45 % of the walk speed so it does not skid on). A wall or a tree that stops
     him also stops his velocity. */
  P.WALK_MAX = 300;      /* own displacement faster than this (u/s) and not a dodge = a skill / scripted move: no weight */
  const heroStep = (e, rdx, rdy, rd2, dt, held, t0) => {
    const W = e.walk || (e.walk = { x: 0, y: 0 });
    /* split this step's displacement into the hero's own (player system, measured by physMid) and the rest */
    const M = e.physMid, own = M && M.t === t0; const dx = own ? M.x : rdx, dy = own ? M.y : rdy, d2 = dx * dx + dy * dy;
    if (held) { e.x -= dx; e.y -= dy; return; }
    const scr = R.ui && R.ui.cur && !(R.screens && R.screens[R.ui.cur] && R.screens[R.ui.cur].live); if (scr) { W.x = 0; W.y = 0; }   /* the world holds still for a screen */
    let dodge = false; try { dodge = typeof e.dodging === 'function' && !!e.dodging(); } catch (x) { dodge = false; }
    if (!dodge && d2 > (P.WALK_MAX * dt) * (P.WALK_MAX * dt)) { P.collide(e); return; }
    let tx = dx, ty = dy; if (d2 > 1e-8) { const c = correct(e, dx, dy, Math.sqrt(d2)); tx = c[0]; ty = c[1]; }
    const ivx = tx / dt, ivy = ty / dt;
    if (dodge) { W.x = ivx; W.y = ivy; e.wasDodge = true; }
    else {
      if (e.wasDodge) { e.wasDodge = false; const m = hyp(W.x, W.y), cap = Math.max(hyp(ivx, ivy), num(e.spd, 170) * P.DODGE_EXIT); if (m > cap) { W.x *= cap / m; W.y *= cap / m; } }
      const grip = e.onIce ? P.ICE_GRIP : 1, ddx = ivx - W.x, ddy = ivy - W.y, dm = hyp(ddx, ddy);
      if (dm > 1e-9) { const im = hyp(ivx, ivy), wm = hyp(W.x, W.y), along = wm > 1e-6 ? (ivx * W.x + ivy * W.y) / wm : im;
        const st = (im > 1 && along >= wm - 1 ? P.ACC : P.BRAKE) * grip * dt; if (dm <= st) { W.x = ivx; W.y = ivy; } else { W.x += ddx / dm * st; W.y += ddy / dm * st; } }
    }
    const x0 = e.x - dx, y0 = e.y - dy, wx = W.x * dt, wy = W.y * dt;      /* x0: where the hero would be without his own move */
    if (Math.abs(wx - dx) > 1e-9 || Math.abs(wy - dy) > 1e-9) P.move(e, wx - dx, wy - dy); else P.collide(e);
    const ax = (e.x - x0) / dt, ay = (e.y - y0) / dt; if (hyp(ax, ay) < hyp(W.x, W.y) - 1) { W.x = ax; W.y = ay; }
  };
  /* falling: when the ground drops away faster than P.FALL_V u/s (a bank taken at a sprint, a dodge off a ledge) the hero leaves it,
     falls with P.G and lands: 'landed'(e, speed) and, over P.LAND_V u/s, a camera kick + dust */
  const land = (e, v) => {
    R.bus.emit('landed', e, v);
    if (v < P.LAND_V) return; e.landT = R.t;
    const h = R.player, near = e === h || (h && P.isBig(e) && hyp(e.x - h.x, e.y - h.y) < 420);     /* the hero's own landing, or a giant's near him */
    const sh = near && fn(R.fx, 'shake'); if (sh) try { sh(Math.min(10, 2 + v / 70 * (e === h ? 1 : P.massOf(e) * 0.6)), 0.16); } catch (x) {}
    const sp = fn(R.fx, 'spawn'); if (sp) try { sp('dust', e.x, e.y + 2, { col: DUST[e.surface] || DUST.grass, n: 3 }); } catch (x) {}
    if (R.sfx && typeof R.sfx.play === 'function') try { R.sfx.play('land', Math.min(1, v / 500)); } catch (x) {}
  };
  const fallStep = (e, dt) => {
    if (e.fly || e.tumble) { e.gy = null; return; }
    const g = P.heightAt(e.x, e.y), gp = e.gyTick === R.tick - 1 ? e.gy : null; e.gy = g; e.gyTick = R.tick; if (gp == null) return;
    let z = num(e.z, 0), vz = num(e.vz, 0);
    if (!e.air) { const drop = gp - g; if (drop / dt > P.FALL_V && z <= 0.01) { e.air = true; z = drop; vz = 0; } else return; }
    else z += gp - g;
    vz -= P.G * dt; z += vz * dt;
    if (z <= 0) { z = 0; e.air = false; const v = -vz; vz = 0; land(e, v); }
    e.z = z; e.vz = vz;
  };
  /* nothing ends inside a blocked cell: back to where it was; an entity that was already inside (spawned there) walks out toward the
     nearest free point at P.UNSTICK_V u/s (never a teleport). NPCs and bosses are only ever put back, never walked. */
  const DIRS = []; for (let k = 0; k < 8; k++) DIRS.push([Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
  const unstick = (e, x0, y0, dt) => {
    if (e.fly || !blockedAt(e.x, e.y)) return false;
    if (!blockedAt(x0, y0)) { e.x = x0; e.y = y0; if (e.imp) { e.imp.x = 0; e.imp.y = 0; } if (e.walk) { e.walk.x = 0; e.walk.y = 0; } return true; }
    if (e.kind === 'npc' || e.kind === 'boss') return false;
    for (const r of [24, 48, 96, 160, 240, 360]) for (const d of DIRS) if (!blockedAt(e.x + d[0] * r, e.y + d[1] * r)) { e.x += d[0] * P.UNSTICK_V * dt; e.y += d[1] * P.UNSTICK_V * dt; return true; }
    return false;
  };
  /* critters: trees / rocks / walls and the mask, nothing else (their own module moves them; flyers and perches are left alone) */
  const lightStep = (e, dt) => {
    if (e.dead || e.fly || num(e.z, 0) > 20 || (e.ai && (e.ai.st === 'fly' || e.ai.st === 'perch'))) { e.prev = null; return; }
    const pv = e.prev; if (!pv) { e.prev = { x: e.x, y: e.y }; return; }
    const dx = e.x - pv.x, dy = e.y - pv.y;
    if (dx * dx + dy * dy <= P.TELEPORT * P.TELEPORT && (dx || dy)) { P.collide(e); unstick(e, pv.x, pv.y, dt); }
    pv.x = e.x; pv.y = e.y;
  };
  /* a loot drop bounces once (A17 integrates z / vz; a second rebound is cancelled here) */
  const dropStep = e => { if (e.dead) return; if (num(e.z, 0) <= 0 && e.vz > 0) { e.bounces = (e.bounces || 0) + 1; if (e.bounces > 1) e.vz = 0; } };
  R.addSys('physPost', { order: 101, update(dt) {
    if (P.off || !(dt > 0)) return;
    const t0 = now(), movers = [], ents = R.ents; let nMov = 0;
    const sg = colSig(); if (sg !== gridSig) { gridSig = sg; P.rebuildColliders(); }
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      if (e.kind === 'proj') { arrowStep(e, dt); continue; }
      if (e.kind === 'drop') { dropStep(e); continue; }
      if (LIGHT[e.kind]) { lightStep(e, dt); continue; }
      if (!isMover(e)) continue;
      movers.push(e);
      const pv = e.prev; if (!pv) { e.prev = { x: e.x, y: e.y }; e.vel = e.vel || { x: 0, y: 0 }; continue; }
      const alive = !e.dead, hero = alive && e.kind === 'player', held = e.stunMicro > 0;
      let dx = e.x - pv.x, dy = e.y - pv.y, d2 = dx * dx + dy * dy;
      if (d2 > P.TELEPORT * P.TELEPORT) { pv.x = e.x; pv.y = e.y; e.vel = { x: 0, y: 0 }; e.stepT = 0; if (e.walk) { e.walk.x = 0; e.walk.y = 0; } e.gy = null; if (e.air) { e.air = false; e.z = 0; e.vz = 0; } sample(e, true); continue; }
      const I = e.imp, hasImp = !!(I && (I.x || I.y));
      if (alive && (d2 > 1e-8 || hasImp || hero)) sample(e);
      /* 1. what the other modules moved this step, corrected for slope, water and hit-stop; the hero gets his weight */
      if (hero) heroStep(e, dx, dy, d2, dt, held, R.t);
      else if (alive && d2 > 1e-8) {
        let tx = 0, ty = 0;
        if (!(e.stunMicro > 0)) { const c = correct(e, dx, dy, Math.sqrt(d2)); tx = c[0]; ty = c[1]; }
        if (tx !== dx || ty !== dy) P.moveEnt(e, tx - dx, ty - dy);
      }
      /* 2. standing on a cliff face slides you down it */
      if (alive && !e.fly && e.steep && e.grad && e.grad.m > 1e-6 && !(e.stunMicro > 0)) P.moveEnt(e, -e.grad.x / e.grad.m * 60 * dt, -e.grad.y / e.grad.m * 60 * dt);
      /* 3. impulses (corpses slide too), friction by surface */
      if (hasImp && !(e.stunMicro > 0)) {
        P.move(e, I.x * dt, I.y * dt);
        const k = Math.exp(-P.frictionOf(e) * dt); I.x *= k; I.y *= k;
        if (I.x * I.x + I.y * I.y < 9) { I.x = 0; I.y = 0; }
      }
      /* 3b. trees, rocks and towers push out what the other modules moved; nothing ends inside a blocked cell */
      else if (!hero && alive && d2 > 1e-8 && e.kind !== 'npc') P.collide(e);
      if (alive) unstick(e, pv.x, pv.y, dt);
      if (hero || (alive && e.kind === 'mob' && (hasImp || e.air))) fallStep(e, dt);     /* mobs only fall when knocked off a bank */
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
