/* HOLDOR RPG — world runtime (A06). Helpers over R.data.world (written by 11_world_data.js, which loads AFTER this file,
   so the data is read lazily on every call), the region / POI watcher (system 'world', order 50) and the ambient
   population (system 'populate', order 60). Without R.data.world every helper returns a safe default: no regions,
   no POIs, nothing blocked except the outside of the world, no spawns. */
(function () {
  const world = R.world = R.world || {};
  const W = () => (R.data && R.data.world) || null;
  const CELL = 64;          // regionAt cache cell (world units)
  const MASK = 120;         // mask cell (world units): mask.rows[floor(y/120)][floor(x/120)] === '#' blocks
  const POI_R = 90;         // "at a POI" radius (poiAt default, the poi event)
  const SAFE = 160;         // no spawns inside this radius around a POI
  const FAR = 1400;         // mobs farther than this from the player are despawned
  const CD = 6;             // seconds between spawn batches
  world.CELL = CELL; world.MASK = MASK; world.POI_R = POI_R; world.SAFE = SAFE; world.FAR = FAR;
  world.populate = true;    // dungeons / intro set false: no ambient spawns (despawning of far mobs still runs)
  world.cur = null;         // the player's current region id (null = none yet / open sea)
  world.lastGood = null;    // the last player position in an allowed region (gate pushback goes toward it)

  /* ---- data binding: the cache belongs to one data object; a swapped R.data.world (tests, reload) rebinds ---- */
  let bound = null, cache = null, cols = 0, rows = 0, polys = [];
  const P = (p, i) => (p[i] != null ? p[i] : i ? p.y : p.x);
  const bind = () => {
    const d = W(); if (d === bound && cache) return d;
    bound = d; cache = null; polys = [];
    if (!d) return null;
    const s = world.size();
    cols = Math.max(1, Math.ceil(s[0] / CELL)); rows = Math.max(1, Math.ceil(s[1] / CELL));
    cache = new Int16Array(cols * rows).fill(-1);                    // -1 unknown, -2 no region, i = regions[i]
    polys = (d.regions || []).map(r => (r.poly && r.poly.length >= 3) ? r.poly.map(p => [P(p, 0), P(p, 1)]) : null);
    return d;
  };
  world.reset = () => { bound = null; cache = null; world.cur = null; world.lastGood = null; inside = {}; };
  world.size = () => { const d = W(); return (d && d.size && d.size.length === 2) ? d.size : [R.W || 7200, R.H || 12288]; };
  world.inWorld = (x, y) => { const s = world.size(); return x >= 0 && y >= 0 && x < s[0] && y < s[1]; };
  world.regions = () => { const d = W(); return (d && d.regions) || []; };
  world.pois = () => { const d = W(); return (d && d.pois) || []; };
  world.roads = () => { const d = W(); return (d && d.roads) || []; };

  /* ---- regions ---- */
  const pip = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const idxAt = (x, y) => { for (let i = 0; i < polys.length; i++) if (polys[i] && pip(x, y, polys[i])) return i; return -2; };
  // the first region (in data order) whose polygon holds the point; cached per 64-unit cell by the cell's centre,
  // with an exact (uncached) check when the centre lies in no region — coasts stay walkable to the edge
  world.regionAt = (x, y) => {
    const d = bind(); if (!d || !polys.length) return null;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
    const k = cy * cols + cx; let i = cache[k];
    if (i === -1) cache[k] = i = idxAt(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
    if (i === -2) i = idxAt(x, y);
    return i >= 0 ? d.regions[i] : null;
  };
  world.regionOf = id => world.regions().find(r => r.id === id) || null;
  world.regionIdAt = (x, y) => { const r = world.regionAt(x, y); return r ? r.id : null; };

  /* ---- POIs ---- */
  world.poi = id => world.pois().find(p => p.id === id) || null;
  world.poiAt = (x, y, r = POI_R) => { let best = null, bd = r * r; for (const p of world.pois()) { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd <= bd) { bd = dd; best = p; } } return best; };
  world.inPoi = (x, y, r = SAFE) => world.poiAt(x, y, r);

  /* ---- the blocked mask: '#' cells, everything outside the world, rows the mask does not have ---- */
  world.blocked = (x, y) => {
    const d = W(); if (!d) return false;
    if (!world.inWorld(x, y)) return true;
    const m = d.mask; if (!m || !m.rows) return false;
    const row = m.rows[Math.floor(y / MASK)]; if (row == null) return true;
    return row.charCodeAt(Math.floor(x / MASK)) === 35;
  };
  world.walkable = (x, y) => !world.blocked(x, y);

  // moves e by (dx,dy) with an axis-separated slide against the mask; an entity already inside a wall may leave it
  const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
  world.slide = (e, dx, dy) => {
    if (!e || (!dx && !dy)) return false;
    const r = Math.min(e.r || 12, 40) * 0.6, free = world.blocked(e.x, e.y); let moved = false;
    if (dx) { const nx = e.x + dx; if (free || (!world.blocked(nx, e.y) && !world.blocked(nx + sgn(dx) * r, e.y))) { e.x = nx; moved = true; } else if (e.vx) e.vx = 0; }
    if (dy) { const ny = e.y + dy; if (free || (!world.blocked(e.x, ny) && !world.blocked(e.x, ny + sgn(dy) * r))) { e.y = ny; moved = true; } else if (e.vy) e.vy = 0; }
    const s = world.size(); e.x = R.clamp(e.x, 0, s[0] - 1); e.y = R.clamp(e.y, 0, s[1] - 1);
    return moved;
  };

  /* ---- roads: the nearest point on any road polyline within r → {x,y,d,road,seg} or null ---- */
  world.roadNear = (x, y, r = 120) => {
    let best = null, bd = r * r; const rd = world.roads();
    for (let i = 0; i < rd.length; i++) { const L = rd[i]; for (let j = 0; j + 1 < L.length; j++) {
      const ax = P(L[j], 0), ay = P(L[j], 1), vx = P(L[j + 1], 0) - ax, vy = P(L[j + 1], 1) - ay, ll = vx * vx + vy * vy;
      let t = ll ? ((x - ax) * vx + (y - ay) * vy) / ll : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + vx * t, py = ay + vy * t, dd = (px - x) ** 2 + (py - y) ** 2;
      if (dd <= bd) { bd = dd; best = { x: px, y: py, d: Math.sqrt(dd), road: i, seg: j }; } } }
    return best;
  };

  /* ---- spawning ---- */
  // n points on walkable ground min..max units from (x,y), outside every POI's safe radius, in the same region when it can
  world.spawnAround = (x, y, n = 1, o = {}) => {
    const out = []; if (!W()) return out;
    const min = o.min == null ? 200 : o.min, max = o.max == null ? 600 : o.max, rng = o.rng || Math.random;
    const tries = o.tries || Math.max(24, n * 16), safe = o.safe == null ? SAFE : o.safe;
    const home = o.sameRegion === false ? null : world.regionAt(x, y);
    for (let t = 0; t < tries && out.length < n; t++) {
      const a = rng() * Math.PI * 2, dist = min + (max - min) * rng(), px = x + Math.cos(a) * dist, py = y + Math.sin(a) * dist;
      if (!world.inWorld(px, py) || world.blocked(px, py) || (safe > 0 && world.inPoi(px, py, safe))) continue;
      if (home && t < tries / 2 && world.regionAt(px, py) !== home) continue;      // prefer the home region, relax after half the tries
      out.push({ x: Math.round(px), y: Math.round(py) });
    }
    return out;
  };
  world.spawnTableAt = (x, y) => { const d = W(); if (!d || !d.spawns) return null; const rg = world.regionAt(x, y); if (!rg) return null; return d.spawns.find(s => s.region === rg.id) || null; };

  // where a new character of this house stands: the house seat POI, 20 units south of its marker
  world.startPos = house => {
    const d = W(), s = world.size(), fall = { x: s[0] / 2, y: s[1] / 2 }; if (!d) return fall;
    const st = d.start, ps = world.pois(); let p = null;
    if (st) { const id = typeof st === 'string' ? st : st[house]; if (typeof id === 'string') p = world.poi(id); }
    if (!p) p = ps.find(q => q.house === house && q.seat) || ps.find(q => q.house === house && q.type === 'castle') || ps.find(q => q.house === house) || null;
    if (!p && st && typeof st.house === 'string') p = world.poi(st.house);
    if (!p) p = ps.find(q => q.seat) || ps[0] || null;
    return p ? { x: p.x, y: p.y + 20 } : fall;
  };

  /* ---- gates: a region with gate:{after, boss} opens once flags['gate:'+id] is set. Discovered POIs / regions and gate flags
     belong to the ACCOUNT (ARCH Addendum 2): R.acc().world when the core has it, else R.state.p (the core aliases p.flags to it) ---- */
  const store = () => { let s = null; try { s = R.acc ? R.acc() : null; } catch (e) {} s = s && s.world; if (!s) s = R.state && R.state.p; return s || null; };
  world.store = store;
  const flags = () => { const S = store(); if (!S) return null; return S.flags = S.flags || {}; };
  world.gateOpen = id => { const rg = typeof id === 'string' ? world.regionOf(id) : id; if (!rg || !rg.gate) return true; const f = flags(); return !!(f && f['gate:' + rg.id]); };
  world.openGate = id => { const f = flags(); if (!f || f['gate:' + id]) return false; f['gate:' + id] = 1; R.save(); R.bus.emit('gate', id, true); return true; };
  const bossName = id => { const B = R.data && R.data.bosses; const b = B ? (Array.isArray(B) ? B.find(x => x && x.id === id) : B[id]) : null; return (b && b.name) || id || 'its guardian'; };
  // a region boss dies → its gate opens (the boss module may also set the flag itself; this is the safety net)
  R.bus.on('kill', e => { if (!e || (e.kind !== 'boss' && !e.boss)) return; const key = e.type || e.boss || e.bossId;
    for (const rg of world.regions()) if (rg.gate && rg.gate.boss === key && !world.gateOpen(rg) && world.openGate(rg.id) && R.ui && R.ui.toast) R.ui.toast('The way to ' + (rg.name || rg.id) + ' is open', '#8be26a'); });

  /* ---- the watcher: region changes, gate pushback, POI discovery (every 0.5 s) ---- */
  let acc = 0, toastT = -9, inside = {};
  const pushBack = (p, rg) => {
    const lg = world.lastGood; let dx = 0, dy = 1;
    if (lg) { const L = Math.hypot(lg.x - p.x, lg.y - p.y); if (L > 1) { dx = (lg.x - p.x) / L; dy = (lg.y - p.y) / L; } }
    for (let i = 0; i < 12 && world.regionAt(p.x, p.y) === rg; i++) { p.x += dx * 40; p.y += dy * 40; }   // 40 units back, more only while still inside
    if (lg && world.regionAt(p.x, p.y) === rg) { p.x = lg.x; p.y = lg.y; }
    p.vx = 0; p.vy = 0;
    if (R.t - toastT > 2) { toastT = R.t; if (R.ui && R.ui.toast) R.ui.toast('The way north is held by ' + bossName(rg.gate && rg.gate.boss) + ' — defeat it first', '#f0b060'); R.bus.emit('gate', rg.id, false); }
  };
  world.enterCheck = () => {
    const p = R.player; if (!p || !W()) return;
    const S = store(), rg = world.regionAt(p.x, p.y), id = rg ? rg.id : null;
    if (id !== world.cur) {
      if (rg && !world.gateOpen(rg)) { pushBack(p, rg); return; }     // refused: the player stays in the previous region
      world.cur = id;
      if (rg) { if (S) { const f = flags(); const dr = f.regions = f.regions || {}; if (!dr[id]) { dr[id] = 1; R.save(); } } R.bus.emit('enter', id, rg); }
    }
    world.lastGood = { x: p.x, y: p.y };
    for (const q of world.pois()) {
      const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (dd <= POI_R * POI_R) { if (!inside[q.id]) { inside[q.id] = 1;
        if (S) { S.found = S.found || []; if (!S.found.includes(q.id)) { S.found.push(q.id); R.save(); } }
        R.bus.emit('poi', q.id, q); } }
      else if (inside[q.id] && dd > (POI_R + 30) ** 2) delete inside[q.id];        // leave with a little hysteresis
    }
  };
  const addSys = (name, s) => (R.addSys ? R.addSys(name, s) : (s.name = name, R.sys[name] = s, R.sysList = Object.values(R.sys).sort((a, b) => (a.order || 0) - (b.order || 0)), s));
  addSys('world', { order: 50, update(dt) { acc += dt; if (acc < 0.5) return; acc = 0; world.enterCheck(); } });

  /* ---- ambient population: 8–14 live mobs around the player from the region's spawn table ---- */
  let cd = 0;
  const pick = (mobs, rng) => { let tot = 0; for (const m of mobs) tot += m.w == null ? 1 : m.w; let r = rng() * tot;
    for (const m of mobs) { r -= m.w == null ? 1 : m.w; if (r <= 0) return m.type; } return mobs[mobs.length - 1].type; };
  const bare = (type, x, y, lvl) => R.spawn({ kind: 'mob', type, name: type, x, y, lvl, r: 14, team: 1, hp: 30 + 12 * lvl, hpMax: 30 + 12 * lvl, atk: 4 + 2 * lvl, def: Math.round(lvl * 0.8), spd: 110, ai: { st: 'idle' } });
  world.spawnMob = (type, x, y, lvl) => { let e = null; try { e = R.spawnMob ? R.spawnMob(type, x, y, lvl) : bare(type, x, y, lvl); } catch (x) { console.error('spawnMob', type, x); }
    if (e && typeof e === 'object') e.ambient = true; return e; };
  world.liveMobs = () => R.ents.filter(e => e.kind === 'mob' && !e.dead);
  // one batch now (the system calls it every 6 s; tests call it directly); returns how many were spawned
  world.populateNow = rng => {
    rng = rng || Math.random; const p = R.player, tab = p && world.spawnTableAt(p.x, p.y);
    if (!tab || !tab.mobs || !tab.mobs.length) return 0;
    const dens = tab.density == null ? 1 : tab.density, lo = Math.round(8 * dens), hi = Math.max(lo, Math.round(14 * dens));
    const live = world.liveMobs().length; if (live >= lo) return 0;
    const tgt = lo + Math.floor(rng() * (hi - lo + 1)), pts = world.spawnAround(p.x, p.y, tgt - live, { rng });
    const la = tab.lvl ? tab.lvl[0] : 1, lb = tab.lvl ? tab.lvl[1] : la;
    for (const q of pts) world.spawnMob(pick(tab.mobs, rng), q.x, q.y, la + Math.floor(rng() * (lb - la + 1)));
    return pts.length;
  };
  addSys('populate', { order: 60, update(dt) {
    const p = R.player; if (!p || !R.state) return;
    for (let i = R.ents.length - 1; i >= 0; i--) { const e = R.ents[i]; if (e.kind === 'mob' && !e.persist && !e.quest && Math.hypot(e.x - p.x, e.y - p.y) > FAR) R.remove(e); }
    cd -= dt; if (cd > 0 || world.populate === false) return;
    cd = CD; world.populateNow();
  } });
  world.cooldown = () => cd;
})();
