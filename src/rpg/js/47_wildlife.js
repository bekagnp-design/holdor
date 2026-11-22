/* HOLDOR RPG — wildlife (A46): non-hostile ambient life around the hero, one small painted silhouette per species, drawn in code.
   Every animal is an entity {kind:'critter', team:2, noLoot, noCollide, species, h (px), z (height), ai:{st}} with
   e.frame(anim, t, face) → a cached canvas (≤ 40 px tall, 2–3 frames per species) that the 3D renderer (A05) draws as a billboard;
   without a renderer the system draws them itself on the 2D overlay (R.wildlife.draw2d = false turns that off).
   Per biome (R.world.regionAt → biomeOf), within 500 units of the hero, ≤ 14 alive, a spawn batch every 4 s, despawn past 1100:
     north       hares (hop), deer (graze, flee at 160), ravens (perch on castles, loops), wolves at night (circle, never attack; howl + keep away below level 5)
     reach       sheep (flock, drift), chickens near towns, butterflies by day, ravens at castles
     crownlands  the same as the reach
     riverlands  herons standing in shallows, frogs (hop near water, croak), fish jumps (a splash every 6–10 s on water), butterflies by day
     dorne       lizards (dart between rocks), vultures circling at z 200, scorpions near rocks
     coast       gulls (wheel over the shore, cry), crabs (sidestep)
     beyond      snow foxes, a distant mammoth walking the horizon once per 3 minutes (900 units out), shadowcat eyes at night (vanish when approached)
   Moving props: a flapping banner (kind 'critter', species 'banner', prop) on every castle within 600, chimney / campfire smoke at towns and camps
   (R.fx.spawn('smoke') when A32 has it, else rising ellipses on the overlay). A direct hit (the 'hit' event with tgt.kind 'critter') makes the
   animal flee and emits 'critterHit'(critter, src, info). Skills never target team 2 (A11's R.attack skips it).
   API: R.wildlife = { SPECIES, BIOMES, LIMIT, RANGE, FAR, CD, list(), props(), describe(biome), biomeOf(region), biomeAt(x,y), nearWater(x,y,r),
     populateNow(rng), spawnOne(species, x, y, o), spawnMammoth(), frame(species, anim, t, face), frameAt(species, anim, fi, face), cacheSize(),
     puffs, rings, mamT, fishT, draw2d, flee(e, src) }  — system 'wildlife' (order 65). */
(function () {
  const W = R.wildlife = R.wildlife || {};
  const TAU = Math.PI * 2;
  W.LIMIT = 14; W.RANGE = 500; W.MIN = 240; W.FAR = 1100; W.CD = 4; W.MAM_EVERY = 180; W.MAM_FAR = 900; W.draw2d = true;
  W.puffs = []; W.rings = []; W.mamT = 30 + Math.random() * 60; W.fishT = 0;
  const rnd = () => (R.rng ? R.rng() : Math.random());
  const fn = (o, k) => !!o && typeof o[k] === 'function';
  const world = () => (R.world && R.data && R.data.world) ? R.world : null;
  const night = () => !!(R.ambience && R.ambience.night);
  const heroLvl = () => (R.state && R.state.p && R.state.p.lvl) || (R.player && R.player.lvl) || 1;
  const sfx = (n, v) => { if (R.sfx && fn(R.sfx, 'play')) { try { R.sfx.play(n, v); } catch (e) {} } };
  const fx = (k, x, y, o) => { if (R.fx && fn(R.fx, 'spawn')) { try { R.fx.spawn(k, x, y, o); return true; } catch (e) {} } return false; };

  /* ---- species: beh = behaviour, h = sprite height px (≤ 40), w = width, spd u/s, fleeR = the hero's distance that starts a flight,
          when: any | day | night, group [min,max], place: ground | water | town | castle | rock | horizon, wt = pick weight ---- */
  const S = W.SPECIES = {
    hare: { name: 'Hare', beh: 'hop', w: 22, h: 18, r: 7, spd: 70, flee: 220, fleeR: 130, group: [1, 2], place: 'ground', wt: 3, note: 'hops, bolts when you come close' },
    deer: { name: 'Deer', beh: 'graze', w: 36, h: 34, r: 12, spd: 40, flee: 260, fleeR: 160, group: [2, 3], place: 'ground', wt: 3, note: 'grazes in small herds, flees at 160' },
    raven: { name: 'Raven', beh: 'raven', w: 20, h: 16, r: 6, spd: 120, flee: 170, fleeR: 90, group: [2, 4], place: 'castle', alt: 'ground', wt: 2, note: 'perches on castle walls, flies loops' },
    wolf: { name: 'Wolf', beh: 'circle', w: 34, h: 26, r: 11, spd: 75, flee: 230, fleeR: 0, group: [2, 3], place: 'ground', when: 'night', wt: 3, note: 'circles at a distance by night, never attacks' },
    sheep: { name: 'Sheep', beh: 'flock', w: 24, h: 22, r: 9, spd: 30, flee: 150, fleeR: 90, group: [3, 5], place: 'ground', wt: 3, note: 'flocks drift across the fields' },
    chicken: { name: 'Chicken', beh: 'peck', w: 14, h: 14, r: 5, spd: 45, flee: 170, fleeR: 60, group: [2, 4], place: 'town', wt: 2, note: 'pecks by the town walls' },
    butterfly: { name: 'Butterfly', beh: 'flutter', w: 14, h: 10, r: 4, spd: 40, flee: 120, fleeR: 50, group: [2, 3], place: 'ground', when: 'day', wt: 2, z: 16, note: 'flutters by day' },
    heron: { name: 'Heron', beh: 'stand', w: 24, h: 36, r: 9, spd: 20, flee: 140, fleeR: 120, group: [1, 2], place: 'water', wt: 3, note: 'stands in the shallows, takes off when you come close' },
    frog: { name: 'Frog', beh: 'hop', w: 12, h: 10, r: 4, spd: 60, flee: 120, fleeR: 70, group: [2, 3], place: 'water', wt: 3, home: 60, croak: 1, note: 'hops by the water, croaks' },
    lizard: { name: 'Lizard', beh: 'dart', w: 20, h: 8, r: 5, spd: 320, flee: 320, fleeR: 70, group: [1, 2], place: 'rock', alt: 'ground', wt: 3, note: 'darts between the rocks' },
    vulture: { name: 'Vulture', beh: 'soar', w: 44, h: 22, r: 10, spd: 60, flee: 0, fleeR: 0, group: [1, 2], place: 'ground', wt: 2, z: 200, note: 'circles high above' },
    scorpion: { name: 'Scorpion', beh: 'side', w: 14, h: 10, r: 4, spd: 25, flee: 90, fleeR: 55, group: [1, 2], place: 'rock', alt: 'ground', wt: 2, note: 'keeps to the rocks' },
    gull: { name: 'Gull', beh: 'wheel', w: 26, h: 16, r: 7, spd: 110, flee: 180, fleeR: 80, group: [2, 4], place: 'water', alt: 'ground', wt: 3, z: 70, note: 'wheels over the shore, cries' },
    crab: { name: 'Crab', beh: 'side', w: 16, h: 12, r: 5, spd: 35, flee: 95, fleeR: 60, group: [1, 3], place: 'water', alt: 'ground', wt: 2, note: 'sidesteps along the tideline' },
    snowfox: { name: 'Snow fox', beh: 'hop', w: 26, h: 20, r: 8, spd: 90, flee: 240, fleeR: 140, group: [1, 2], place: 'ground', wt: 3, hop: 0, note: 'trots over the snow, bolts at 140' },
    mammoth: { name: 'Mammoth', beh: 'walkline', w: 56, h: 40, r: 30, spd: 22, flee: 22, fleeR: 0, group: [1, 1], place: 'horizon', wt: 0, note: 'a far silhouette walking the horizon, once per three minutes' },
    eyes: { name: 'Shadowcat eyes', beh: 'eyes', w: 20, h: 8, r: 6, spd: 0, flee: 0, fleeR: 130, group: [1, 2], place: 'ground', when: 'night', wt: 2, z: 14, note: 'two glints in the dark that vanish when approached' },
    banner: { name: 'Banner', beh: 'banner', w: 20, h: 40, r: 4, spd: 0, flee: 0, fleeR: 0, group: [1, 1], place: 'castle', wt: 0, prop: 1, z: 70, note: 'flaps in the house colour' } };
  for (const k in S) S[k].id = k;
  W.BIOMES = { north: ['hare', 'deer', 'raven', 'wolf'], reach: ['sheep', 'chicken', 'butterfly', 'raven'], crownlands: ['sheep', 'chicken', 'butterfly', 'raven'],
    riverlands: ['heron', 'frog', 'butterfly'], dorne: ['lizard', 'vulture', 'scorpion'], coast: ['gull', 'crab'], beyond: ['snowfox', 'eyes', 'mammoth'],
    // the real regions of 11_world_data.js that need their own mix (every place different)
    wolfswood: ['deer', 'wolf', 'raven', 'eyes'], stormlands: ['deer', 'hare', 'frog', 'raven'], westerlands: ['hare', 'deer', 'lizard', 'raven'],
    vale: ['hare', 'raven', 'vulture', 'lizard'], iron: ['gull', 'crab', 'raven'], ash: ['gull', 'crab', 'lizard', 'raven'], wall: ['snowfox', 'raven', 'wolf'] };
  const EXTRA = { riverlands: [{ id: 'fish', name: 'Fish', when: 'any', note: 'jump with a splash every 6–10 s' }] };
  // the biome of a region (A07's data, any naming): beyond | north | coast | riverlands | dorne | crownlands | reach, null for no region
  const BIO = [[/beyond|always|winter|frostfang|haunted|thenn/, 'beyond'], [/north|wolfswood|barrow|gift|wall|vale|mountain|moon|snow|frost|ice|tundra/, 'north'],
    [/iron|coast|shore|island|sea|bay|salt|stepstone|pyke/, 'coast'], [/river|trident|neck|marsh|swamp|lake|god/, 'riverlands'], [/dorne|desert|sand|dune|red/, 'dorne'],
    [/crown|king|dragonstone|blackwater/, 'crownlands'], [/reach|storm|west|plain|grass|forest|wood|field|garden|lannis|rock|sun|wet|hot|cold/, 'reach']];
  // the region ids of 11_world_data.js win over the biome word (its 'wall' biome covers the Wall, beyond and the Lands of Always Winter)
  W.REGION_BIOME = { dorne: 'dorne', reach: 'reach', stormlands: 'stormlands', westerlands: 'westerlands', ironislands: 'iron', dragonstone: 'ash', north: 'north',
    crownlands: 'crownlands', westcoast: 'coast', riverlands: 'riverlands', vale: 'vale', farnorth: 'north', wall: 'wall', beyond: 'beyond', winter: 'beyond' };
  W.biomeOf = reg => { if (!reg) return null; if (typeof reg === 'string') reg = { biome: reg };
    const id = String(reg.id || '').toLowerCase(); if (id && W.REGION_BIOME[id] && W.BIOMES[W.REGION_BIOME[id]]) return W.REGION_BIOME[id];
    const s = String(reg.biome || reg.id || reg.name || '').toLowerCase(); if (!s) return null;
    if (W.BIOMES[s]) return s; for (const [re, b] of BIO) if (re.test(s)) return b; return 'reach'; };
  // the Wolfswood: the west of the Far North (around Deepwood Motte) is its own forest
  W.biomeAt = (x, y) => { const w = world(); if (!w || !fn(w, 'regionAt')) return null; try { const rg = w.regionAt(x, y), b = W.biomeOf(rg);
    if (rg && rg.id === 'farnorth' && x < 3100) return 'wolfswood'; return b; } catch (e) { return null; } };
  W.describe = biome => { const b = (biome && typeof biome === 'object') ? W.biomeOf(biome) : (W.BIOMES[biome] ? biome : W.biomeOf(biome)); if (!b) return [];
    return (W.BIOMES[b] || []).map(id => ({ id, name: S[id].name, when: S[id].when || 'any', note: S[id].note })).concat(EXTRA[b] || []); };
  W.list = () => R.ents.filter(e => e.kind === 'critter' && !e.dead && !e.prop);
  W.props = () => R.ents.filter(e => e.kind === 'critter' && !e.dead && e.prop);

  /* ---- ground tests: water (R.water.isWater, else the mask's blocked cells = sea / lakes / ridges), rocks (blocked cells), free ground ---- */
  const blocked = (x, y) => { const w = world(); return w && fn(w, 'blocked') ? w.blocked(x, y) : false; };
  const isWater = (x, y) => { if (R.water && fn(R.water, 'isWater')) { try { return !!R.water.isWater(x, y); } catch (e) {} } return blocked(x, y); };
  W.nearWater = (x, y, r) => { r = r || 70; if (isWater(x, y)) return true; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; if (isWater(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true; } return false; };
  const nearRock = (x, y, r) => { r = r || 70; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; if (blocked(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true; } return false; };
  const free = (x, y) => { const w = world(); if (!w) return true; if (fn(w, 'inWorld') && !w.inWorld(x, y)) return false; if (blocked(x, y)) return false; if (fn(w, 'inPoi') && w.inPoi(x, y, 110)) return false; return true; };
  const poisNear = (x, y, r, test) => { const w = world(); if (!w || !fn(w, 'pois')) return []; return w.pois().filter(p => (!test || test(p)) && (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r); };
  const isCastle = p => p.type === 'castle' || p.kind === 'castle';
  const isTown = p => p.type === 'town' || p.kind === 'town';
  const smokes = p => isTown(p) || p.type === 'camp' || p.kind === 'camp';
  const ring = (x, y, min, max) => { const a = rnd() * TAU, d = min + (max - min) * rnd(); return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }; };
  // n anchor points for a species around the hero: ground (free, off POIs), water / rock edges, or around a town / castle POI
  const anchors = (sp, px, py, n) => {
    const out = []; let place = sp.place;
    if (place === 'town' || place === 'castle') { const L = poisNear(px, py, W.RANGE + 120, place === 'town' ? isTown : isCastle); if (!L.length) { if (!sp.alt) return out; place = sp.alt; }
      else { for (let i = 0; i < n; i++) { const p = L[Math.floor(rnd() * L.length)]; if (place === 'castle') out.push({ x: p.x + (rnd() - .5) * 50, y: p.y - 6 - rnd() * 10, poi: p, z: 60 + rnd() * 10 }); else { let q = null; for (let t = 0; t < 10 && !q; t++) { const c = ring(p.x, p.y, 60, 115); if (!blocked(c.x, c.y)) q = c; } if (q) out.push(Object.assign(q, { poi: p })); } } return out; } }
    if (place === 'water' || place === 'rock') { const test = place === 'water' ? W.nearWater : nearRock;
      for (let t = 0; t < 60 && out.length < n; t++) { const c = ring(px, py, W.MIN, W.RANGE); if (!blocked(c.x, c.y) && test(c.x, c.y, 70) && (!world() || !fn(world(), 'inWorld') || world().inWorld(c.x, c.y))) out.push(c); }
      if (out.length || !sp.alt) return out; place = sp.alt; }
    const w = world();
    if (w && fn(w, 'spawnAround')) { for (const q of w.spawnAround(px, py, n, { min: W.MIN, max: W.RANGE, rng: rnd, safe: 110 })) out.push(q); }
    else for (let t = 0; t < 40 && out.length < n; t++) { const c = ring(px, py, W.MIN, W.RANGE); if (free(c.x, c.y)) out.push(c); }
    return out;
  };

  /* ---- spawning ---- */
  W.spawnOne = (id, x, y, o) => { const sp = S[id]; if (!sp) return null; o = o || {}; const hp = o.hp || (sp.prop ? 1 : 10 + 3 * heroLvl());
    const e = { kind: 'critter', type: id, species: id, name: sp.name, team: 2, noLoot: true, noCollide: true, ambient: true, prop: !!sp.prop, x, y, z: o.z != null ? o.z : (sp.z || 0),
      r: sp.r, h: sp.h, w: sp.w, hp, hpMax: hp, atk: 0, def: 0, spd: sp.spd, lvl: 1, face: rnd() < .5 ? -1 : 1, anim: 'idle', fade: 0, home: { x, y }, col: o.col || null, poi: o.poi || null,
      noKnock: !!(sp.prop || id === 'mammoth' || id === 'eyes'), ai: { st: sp.beh === 'raven' && o.poi ? 'perch' : sp.beh === 'eyes' ? 'watch' : 'idle', t: rnd() * 2, dir: rnd() < .5 ? -1 : 1, ph: rnd() * TAU } };
    e.frame = (anim, t, face) => id === 'banner' ? W.frameAt('banner', 'flap', Math.floor((t || 0) * 6) % 3, 1, e.col) : W.frame(id, anim, t, face == null ? e.face : face);
    if (o.ext) Object.assign(e, o.ext);
    return R.spawn(e); };
  const groupAt = (sp, a, n) => { const out = []; for (let i = 0; i < n; i++) { let x = a.x, y = a.y; if (i) { const c = ring(a.x, a.y, 20, 55); if (!blocked(c.x, c.y)) { x = c.x; y = c.y; } }
    const e = W.spawnOne(sp.id, x, y, { poi: a.poi, z: a.z != null ? a.z : undefined }); if (e) { e.ai.t = rnd() * 2; out.push(e); } } return out; };
  const allowed = (sp, isNight) => !sp.prop && sp.wt > 0 && (!sp.when || (sp.when === 'night') === isNight);
  // one batch: fill up to 10–14 critters of the hero's biome (every allowed species once, then by weight), banners on castles, the smoke list
  W.populateNow = rng => {
    const keep = R.rng; if (rng) R.rng = rng;
    try {
      const p = R.player; if (!p || p.dead || (R.world && R.world.populate === false)) { W.smokers = []; return 0; }
      const b = W.biomeAt(p.x, p.y); W.biome = b; if (!b) { W.smokers = []; return 0; }
      const isNight = night(), ids = (W.BIOMES[b] || []).map(k => S[k]).filter(sp => allowed(sp, isNight));
      let alive = 0; const have = {}; for (const e of R.ents) if (e.kind === 'critter' && !e.dead && !e.prop) { alive++; have[e.species] = (have[e.species] || 0) + 1; }
      const tgt = Math.min(W.LIMIT, 10 + Math.floor(rnd() * 5)); let made = 0;
      const put = sp => { const n = Math.min(sp.group[0] + Math.floor(rnd() * (sp.group[1] - sp.group[0] + 1)), tgt - alive); if (n <= 0) return false;
        const a = anchors(sp, p.x, p.y, 1)[0]; if (!a) return false; const g = groupAt(sp, a, n); alive += g.length; made += g.length; have[sp.id] = (have[sp.id] || 0) + g.length; return g.length > 0; };
      for (const sp of ids) if (!have[sp.id] && alive < tgt) put(sp);
      let tot = 0; for (const sp of ids) tot += sp.wt;
      for (let i = 0; i < 6 && alive < tgt && tot > 0; i++) { let r = rnd() * tot, sp = ids[ids.length - 1]; for (const q of ids) { r -= q.wt; if (r <= 0) { sp = q; break; } } put(sp); }
      // props: one banner per castle within 600, smoke at towns and camps within 600
      const castles = poisNear(p.x, p.y, 600, isCastle), hasB = {}; for (const e of R.ents) if (e.kind === 'critter' && e.species === 'banner' && !e.dead && e.poi) hasB[e.poi.id] = 1;
      for (const c of castles) if (!hasB[c.id]) { const H = R.data.houses && c.house && R.data.houses[c.house]; W.spawnOne('banner', c.x + 8, c.y - 12, { poi: c, col: (H && H.col) || '#c9b27a', z: c.bannerZ != null ? c.bannerZ : 70 }); }
      W.smokers = poisNear(p.x, p.y, 600, smokes).map(q => ({ poi: q, x: q.x + (q.type === 'camp' || q.kind === 'camp' ? 0 : 10), y: q.y - 4, z: q.type === 'camp' || q.kind === 'camp' ? 12 : 46, t: rnd() * .8 }));
      return made;
    } finally { if (rng) R.rng = keep; }
  };
  // the mammoth: 900 units out on walkable ground, walking across the hero's view for ~70 s
  W.spawnMammoth = () => { const p = R.player; if (!p) return null; for (let t = 0; t < 12; t++) { const a = rnd() * TAU, x = p.x + Math.cos(a) * W.MAM_FAR, y = p.y + Math.sin(a) * W.MAM_FAR;
      if (blocked(x, y) || (world() && fn(world(), 'inWorld') && !world().inWorld(x, y))) continue;
      const e = W.spawnOne('mammoth', x, y, { z: 0 }); if (!e) return null; const d = e.ai.dir; e.ai.vx = -Math.sin(a) * d; e.ai.vy = Math.cos(a) * d; e.ai.st = 'walk'; e.ai.life = 70; e.face = e.ai.vx < 0 ? -1 : 1; e.anim = 'walk'; return e; } return null; };

  /* ---- behaviours: tiny state machines on e.ai (st, t = time in state, tx/ty = target) ---- */
  const faceTo = (e, dx) => { if (Math.abs(dx) > .5) e.face = dx < 0 ? -1 : 1; };
  const moveTo = (e, tx, ty, spd, dt, ground) => { const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d < 2) return true; const k = Math.min(d, spd * dt) / d, mx = dx * k, my = dy * k; faceTo(e, dx);
    const w = world(); if (ground && w && fn(w, 'slide')) { if (!w.slide(e, mx, my)) { e.ai.stuck = (e.ai.stuck || 0) + 1; return e.ai.stuck > 6; } } else { e.x += mx; e.y += my; } return d <= spd * dt + 2; };
  const target = (e, min, max, homeR) => { const h = e.home || e, a = rnd() * TAU, d = min + (max - min) * rnd(); let tx = e.x + Math.cos(a) * d, ty = e.y + Math.sin(a) * d;
    if (homeR && Math.hypot(tx - h.x, ty - h.y) > homeR) { const b = rnd() * TAU, r = rnd() * homeR * .6; tx = h.x + Math.cos(b) * r; ty = h.y + Math.sin(b) * r; } e.ai.tx = tx; e.ai.ty = ty; e.ai.stuck = 0; };
  const go = (e, st, t) => { e.ai.st = st; e.ai.t = 0; e.ai.until = t ? R.t + t : 0; };
  // a flight away from (fx, fy): every species but the props; eyes vanish, perched ravens launch
  W.flee = (e, src) => { if (!e || e.dead || e.kind !== 'critter') return false; const sp = S[e.species]; if (!sp || sp.prop) return false; const f = src && src.x != null ? src : R.player || e;
    if (sp.beh === 'eyes') { e.dead = true; R.remove(e); return true; }
    e.ai.fx = f.x; e.ai.fy = f.y; e.ai.fleeT = 0; go(e, 'flee', sp.beh === 'stand' ? 6 : sp.beh === 'raven' || sp.beh === 'wheel' ? 4 : 2.2); e.anim = 'walk'; return true; };
  const fleeStep = (e, sp, dt, C) => { const a = e.ai; let dx = e.x - a.fx, dy = e.y - a.fy, d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; if (a.turn) { const t = dx; dx = -dy * a.turn; dy = t * a.turn; }
    const fl = sp.beh === 'raven' || sp.beh === 'wheel' || sp.beh === 'flutter' || sp.beh === 'stand' || sp.beh === 'soar';
    if (fl) { e.z = Math.min((sp.z || 0) + 90, (e.z || 0) + 70 * dt); e.x += dx * sp.flee * dt; e.y += dy * sp.flee * dt; faceTo(e, dx); }
    else { const w = world(); const mv = (w && fn(w, 'slide')) ? w.slide(e, dx * sp.flee * dt, dy * sp.flee * dt) : (e.x += dx * sp.flee * dt, e.y += dy * sp.flee * dt, true); faceTo(e, dx); if (!mv) a.turn = a.turn || (rnd() < .5 ? -1 : 1);
      if (sp.beh === 'hop' || sp.beh === 'dart') { a.ph += dt * 14; e.z = Math.abs(Math.sin(a.ph)) * (sp.beh === 'dart' ? 0 : 8); } }
    e.anim = 'walk'; a.fleeT += dt;
    if (R.t >= a.until && C.d > sp.fleeR + 40) { a.turn = 0; if (sp.beh === 'stand') { e.gone = true; return; } if (sp.beh === 'raven') go(e, 'fly', 6 + rnd() * 6); else if (sp.beh === 'wheel' || sp.beh === 'soar' || sp.beh === 'flutter') go(e, 'fly'); else { e.z = sp.z || 0; go(e, 'idle', .5 + rnd() * 2); e.anim = 'idle'; } }
    else if (a.fleeT > 9) e.gone = true; };
  const B = {
    hop(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; e.z = 0; if (R.t >= a.until) { target(e, 40, 120, sp.home); go(e, 'wander'); } }
      else { const hopH = sp.hop == null ? (sp.beh === 'hop' && e.species === 'frog' ? 6 : 7) : sp.hop; a.ph += dt * 10; e.z = Math.abs(Math.sin(a.ph)) * hopH; e.anim = 'walk'; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 4) { e.z = 0; go(e, 'idle', 1 + rnd() * 2.5); } }
      if (sp.croak) { a.croak = (a.croak == null ? 2 + rnd() * 6 : a.croak) - dt; if (a.croak <= 0) { a.croak = 4 + rnd() * 5; if (C.d < 420) sfx('croak', .25); } } },
    graze(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until) { target(e, 30, 90, 180); go(e, 'wander'); } }
      else { e.anim = 'walk'; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 5) go(e, 'idle', 2 + rnd() * 3); } },
    flock(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until) { let cx = 0, cy = 0, n = 0; for (const o of R.ents) if (o !== e && !o.dead && o.species === 'sheep' && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 200 * 200) { cx += o.x; cy += o.y; n++; }
          W.drift = W.drift == null ? rnd() * TAU : W.drift + (rnd() - .5) * .6; const dx = Math.cos(W.drift) * 40, dy = Math.sin(W.drift) * 40;
          if (n) { cx /= n; cy /= n; a.tx = cx + dx + (rnd() - .5) * 60; a.ty = cy + dy + (rnd() - .5) * 60; } else { a.tx = e.x + dx; a.ty = e.y + dy; } a.stuck = 0; go(e, 'wander'); } }
      else { e.anim = 'walk'; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 5) go(e, 'idle', 1.5 + rnd() * 3); } },
    peck(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until) { target(e, 15, 50, 90); go(e, 'wander'); } }
      else { e.anim = 'walk'; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 3) go(e, 'idle', 1 + rnd() * 2); } },
    dart(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until) { target(e, 40, 100, 150); go(e, 'wander'); } }
      else { e.anim = 'walk'; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 1) go(e, 'idle', 2 + rnd() * 4); } },
    side(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until) { a.tx = e.x + (rnd() < .5 ? -1 : 1) * (20 + rnd() * 30); a.ty = e.y + (rnd() - .5) * 10; a.stuck = 0; go(e, 'wander'); } }
      else { e.anim = 'walk'; const f = e.face; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 3) go(e, 'idle', 1 + rnd() * 2); e.face = f; } },
    stand(e, sp, dt, C) { const a = e.ai; if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until) { target(e, 10, 25, 60); go(e, 'wander'); } }
      else { e.anim = 'walk'; if (moveTo(e, a.tx, a.ty, sp.spd, dt, true) || a.t > 2) go(e, 'idle', 4 + rnd() * 6); } },
    raven(e, sp, dt, C) { const a = e.ai;
      if (a.st === 'perch') { e.anim = 'idle'; e.z = a.pz == null ? (a.pz = e.z || 60) : a.pz; if (C.d < sp.fleeR) { go(e, 'fly', 8 + rnd() * 6); a.cx = e.x; a.cy = e.y; a.rad = 80 + rnd() * 60; a.ang = rnd() * TAU; a.launch = 1; sfx('caw', .25); } }
      else if (a.st === 'idle') { e.anim = 'idle'; e.z = 0; if (R.t >= a.until) { go(e, 'fly', 8 + rnd() * 8); a.cx = e.x; a.cy = e.y; a.rad = 70 + rnd() * 70; a.ang = rnd() * TAU; } }
      else { e.anim = 'walk'; if (a.cx == null) { a.cx = e.x; a.cy = e.y; a.rad = 90; a.ang = 0; } if (C.d < 70 && a.st === 'fly') { a.cx += (e.x - C.px) * .5; a.cy += (e.y - C.py) * .5; }
        a.ang += a.dir * sp.spd / a.rad * dt; const tx = a.cx + Math.cos(a.ang) * a.rad, ty = a.cy + Math.sin(a.ang) * a.rad; faceTo(e, tx - e.x); e.x += (tx - e.x) * Math.min(1, 4 * dt); e.y += (ty - e.y) * Math.min(1, 4 * dt);
        e.z = Math.min(130, (e.z || 0) + 60 * dt) - 12 * Math.sin(a.ang * 2);
        if (R.t >= a.until) { if (e.poi && C.d > sp.fleeR + 40 && Math.hypot(e.poi.x - e.x, e.poi.y - e.y) < 300) { e.x = e.poi.x + (rnd() - .5) * 50; e.y = e.poi.y - 8 - rnd() * 8; go(e, 'perch'); } else if (!e.poi) { e.z = 0; go(e, 'idle', 2 + rnd() * 4); } else go(e, 'fly', 6 + rnd() * 6); } } },
    wheel(e, sp, dt, C) { const a = e.ai; e.anim = 'walk'; if (a.cx == null) { a.cx = e.home.x; a.cy = e.home.y; a.rad = 60 + rnd() * 60; a.ang = a.ph; }
      a.ang += a.dir * sp.spd / a.rad * dt; const tx = a.cx + Math.cos(a.ang) * a.rad, ty = a.cy + Math.sin(a.ang) * a.rad; faceTo(e, tx - e.x); e.x += (tx - e.x) * Math.min(1, 3 * dt); e.y += (ty - e.y) * Math.min(1, 3 * dt);
      e.z = (sp.z || 70) + 12 * Math.sin(a.ang * 3); a.cry = (a.cry == null ? 3 + rnd() * 8 : a.cry) - dt; if (a.cry <= 0) { a.cry = 5 + rnd() * 7; if (C.d < 420) sfx('gull', .22); }
      if (rnd() < dt * .15) { a.cx += (rnd() - .5) * 80; a.cy += (rnd() - .5) * 80; } },
    soar(e, sp, dt, C) { const a = e.ai; e.anim = 'walk'; if (a.cx == null) { a.cx = e.home.x; a.cy = e.home.y; a.rad = 120 + rnd() * 80; a.ang = a.ph; }
      a.ang += a.dir * sp.spd / a.rad * dt; e.x = a.cx + Math.cos(a.ang) * a.rad; e.y = a.cy + Math.sin(a.ang) * a.rad; faceTo(e, -Math.sin(a.ang) * a.dir); e.z = sp.z + 10 * Math.sin(a.ang * 2); },
    flutter(e, sp, dt, C) { const a = e.ai; e.anim = 'walk'; if (a.st === 'idle') go(e, 'fly'); a.ph += dt * 9; if (a.tx == null || rnd() < dt * 1.2 || Math.hypot(a.tx - e.x, a.ty - e.y) < 6) target(e, 20, 70, 130);
      moveTo(e, a.tx, a.ty, sp.spd, dt, false); e.z = (sp.z || 16) + 6 * Math.sin(a.ph); },
    circle(e, sp, dt, C) { const a = e.ai; e.anim = 'walk'; const low = C.lvl < 5, lo = low ? 320 : 230, hi = low ? 430 : 330;
      let dx = e.x - C.px, dy = e.y - C.py, d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; const rad = d < lo ? 1 : d > hi ? -1 : 0, tx = -dy * a.dir, ty = dx * a.dir, sp2 = rad ? sp.spd * 1.6 : sp.spd;
      const mx = (tx + dx * rad * 1.2) , my = (ty + dy * rad * 1.2), m = Math.hypot(mx, my) || 1; const w = world();
      const mv = (w && fn(w, 'slide')) ? w.slide(e, mx / m * sp2 * dt, my / m * sp2 * dt) : (e.x += mx / m * sp2 * dt, e.y += my / m * sp2 * dt, true); if (!mv) a.dir = -a.dir; faceTo(e, mx);
      if (low) { a.howl = (a.howl == null ? 3 + rnd() * 9 : a.howl) - dt; if (a.howl <= 0) { a.howl = 10 + rnd() * 10; e.anim = 'howl'; e.howlT = R.t + 1.2; sfx('howl', .5); R.bus.emit('howl', e); } }
      if (e.howlT > R.t) e.anim = 'howl'; },
    walkline(e, sp, dt, C) { const a = e.ai; e.anim = 'walk'; e.x += a.vx * sp.spd * dt; e.y += a.vy * sp.spd * dt; a.life -= dt; if (a.life <= 0 || blocked(e.x, e.y)) e.gone = true; },
    eyes(e, sp, dt, C) { e.anim = 'idle'; if (C.d < sp.fleeR || !C.night) { e.gone = true; } },
    banner(e, sp, dt, C) { e.anim = 'flap'; if (e.poi && Math.hypot(e.poi.x - C.px, e.poi.y - C.py) > 900) e.gone = true; } };

  /* ---- the hit rule: a direct hit → flight + the achievement hook ---- */
  R.bus.on('hit', info => { const t = info && info.tgt; if (!t || t.kind !== 'critter' || t.dead) return; if (W.flee(t, info.src)) R.bus.emit('critterHit', t, info.src, info); });

  /* ---- the system ---- */
  let cd = 0;
  const update = dt => {
    const p = R.player; if (!p || !R.state) return;
    const C = { px: p.x, py: p.y, d: 0, night: night(), lvl: heroLvl() }, noPop = R.world && R.world.populate === false;
    for (let i = R.ents.length - 1; i >= 0; i--) { const e = R.ents[i]; if (e.kind !== 'critter') continue; if (e.dead) continue;
      const sp = S[e.species]; if (!sp) continue; const dx = e.x - C.px, dy = e.y - C.py, d2 = dx * dx + dy * dy; C.d = Math.sqrt(d2);
      const far = sp.id === 'mammoth' ? W.MAM_FAR + 800 : sp.prop ? 1000 : W.FAR;
      if (noPop || d2 > far * far || e.gone || (sp.when === 'day' && C.night) || (sp.when === 'night' && !C.night && sp.beh !== 'circle')) { R.remove(e); continue; }
      if (sp.beh === 'circle' && !C.night) { if (e.ai.st !== 'flee') { e.ai.fx = C.px; e.ai.fy = C.py; e.ai.until = R.t + 9; e.ai.fleeT = e.ai.fleeT || 0; e.ai.st = 'flee'; } }
      e.fade = Math.min(1, (e.fade || 0) + dt * 2); e.ai.t += dt;
      if (e.ai.st === 'flee') fleeStep(e, sp, dt, C); else if (e.ai.st !== 'flee' && sp.fleeR && !sp.prop && sp.beh !== 'eyes' && C.d < sp.fleeR && sp.beh !== 'raven') W.flee(e, p); else B[sp.beh](e, sp, dt, C); }
    // ambient props: smoke puffs, fish jumps, the mammoth timer
    if (W.smokers) for (const s of W.smokers) { s.t -= dt; if (s.t <= 0) { s.t = .8; const x = s.x + (rnd() - .5) * 4, y = s.y; if (!fx('smoke', x, y, { z: s.z })) if (W.puffs.length < 60) W.puffs.push({ x, y, z: s.z, t: 0, ttl: 2.4, dx: (rnd() - .5) * 10 }); } }
    for (let i = W.puffs.length - 1; i >= 0; i--) { const q = W.puffs[i]; q.t += dt; q.z += 18 * dt; q.x += q.dx * dt; if (q.t >= q.ttl) W.puffs.splice(i, 1); }
    for (let i = W.rings.length - 1; i >= 0; i--) { const q = W.rings[i]; q.t += dt; if (q.t >= q.ttl) W.rings.splice(i, 1); }
    if (W.biome === 'riverlands' || W.biome === 'coast') { W.fishT -= dt; if (W.fishT <= 0) { W.fishT = 6 + rnd() * 4; for (let t = 0; t < 20; t++) { const c = ring(p.x, p.y, 60, 320); if (isWater(c.x, c.y)) { if (!fx('splash', c.x, c.y, { r: 10 })) W.rings.push({ x: c.x, y: c.y, t: 0, ttl: 1.1 }); sfx('splash', .2); W.lastFish = { x: c.x, y: c.y, t: R.t }; break; } } } }
    if (W.biome === 'beyond' && !noPop) { W.mamT -= dt; if (W.mamT <= 0) { W.mamT = W.MAM_EVERY; W.spawnMammoth(); } }
    cd -= dt; if (cd > 0) return; cd = W.CD; W.populateNow();
  };
  const proj = (x, y, h, z) => { const s = R.w2s(x, y, h || 0); if (h && !R.render3d) s.y -= h * z; return s; };
  const draw = ctx => {
    const z = R.cam.z || 1, hasFx = R.fx && fn(R.fx, 'spawn');
    if (!hasFx) { for (const q of W.puffs) { const s = proj(q.x, q.y, q.z, z), k = q.t / q.ttl, r = (3 + 7 * k) * z; ctx.globalAlpha = .35 * (1 - k); ctx.fillStyle = '#c9c4bb'; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .7, 0, 0, TAU); ctx.fill(); }
      for (const q of W.rings) { const s = R.w2s(q.x, q.y, 0), k = q.t / q.ttl; ctx.globalAlpha = .6 * (1 - k); ctx.strokeStyle = '#dfe9f3'; ctx.lineWidth = Math.max(1, 1.5 * z); ctx.beginPath(); ctx.ellipse(s.x, s.y, (4 + 18 * k) * z, (2 + 9 * k) * z, 0, 0, TAU); ctx.stroke(); if (k < .35) { ctx.fillStyle = '#9fb6c9'; ctx.beginPath(); ctx.ellipse(s.x, s.y - (8 - 20 * k) * z, 2.5 * z, 1.4 * z, 0, 0, TAU); ctx.fill(); } }
      ctx.globalAlpha = 1; }
    if (!W.draw2d || R.render3d) return;
    for (const e of R.ents) { if (e.kind !== 'critter') continue; const s = proj(e.x, e.y, e.z || 0, z); if (s.x < -60 || s.y < -60 || s.x > R.vw + 60 || s.y > R.vh + 60) continue;
      const c = e.frame(e.anim, e.animT, e.face); if (!c) continue; const w = c.width * z, h = c.height * z; ctx.globalAlpha = e.dead ? Math.max(0, 1 - (R.t - (e.diedAt || R.t))) : (e.fade == null ? 1 : e.fade);
      if ((e.z || 0) > 0 && !e.prop) { ctx.fillStyle = 'rgba(0,0,0,.18)'; const g = R.w2s(e.x, e.y, 0); ctx.beginPath(); ctx.ellipse(g.x, g.y, w * .3, w * .12, 0, 0, TAU); ctx.fill(); }
      if (e.dead) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(e.face * Math.PI / 2); ctx.drawImage(c, -w / 2, -h, w, h); ctx.restore(); } else ctx.drawImage(c, s.x - w / 2, s.y - h, w, h); }
    ctx.globalAlpha = 1;
  };
  R.addSys('wildlife', { order: 65, update, draw });

  /* ---- frames: one canvas per species / anim / frame / face, painted once ---- */
  const cache = {}; W.cacheSize = () => Object.keys(cache).length;
  const FPS = { idle: 2, walk: 8, flap: 6, howl: 2 };
  W.frame = (id, anim, t, face) => { const sp = S[id]; if (!sp) return null; anim = PAINT[id].anims.includes(anim) ? anim : 'idle'; const n = 3; const fi = Math.floor(Math.max(0, t || 0) * (sp.beh === 'walkline' ? 3 : sp.beh === 'soar' ? 1.5 : FPS[anim] || 2)) % n; return W.frameAt(id, anim, fi, face); };
  W.frameAt = (id, anim, fi, face, col) => { const sp = S[id]; if (!sp) return null; const P = PAINT[id]; if (!P.anims.includes(anim)) anim = 'idle'; fi = ((fi | 0) % 3 + 3) % 3; face = face < 0 ? -1 : 1; col = col || '#c9b27a';
    const key = id + '|' + anim + '|' + fi + '|' + face + (id === 'banner' ? '|' + col : ''); if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h; const x = c.getContext('2d'); x.lineCap = 'round'; x.lineJoin = 'round';
    if (face < 0) { x.translate(sp.w, 0); x.scale(-1, 1); }
    try { P.paint(x, sp.w, sp.h, anim, fi, col); } catch (e) { x.fillStyle = '#333'; x.fillRect(sp.w * .3, sp.h * .3, sp.w * .4, sp.h * .6); }
    return cache[key] = c; };

  /* ---- painters: small silhouettes with a lighter back and a darker belly; fi 0/1/2 = pose phases ---- */
  const E = (x, cx, cy, rx, ry, rot, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); x.fill(); };
  const Lw = (x, pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); };
  const T = (x, pts, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fill(); };
  const legs = (x, cx, gy, span, len, fi, w, col, walk) => { const o = walk ? [0, 1, -1][fi] * span * .5 : 0; Lw(x, [cx - span, gy - len, cx - span + o, gy], w, col); Lw(x, [cx + span, gy - len, cx + span - o, gy], w, col); };
  const dot = (x, cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); };
  const PAINT = {
    hare: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const walk = an === 'walk', st = walk ? [0, 1, 0][fi] : 0, bx = 11, by = h - 5 - st * 2;
      E(x, bx, by, 6.5 + st * 2, 4.5 - st * .8, -st * .3, '#6b5236'); E(x, bx + 1, by + 1, 4, 2.5, 0, '#8a7050'); E(x, 17, by - 4, 3.2, 2.8, 0, '#6b5236');
      Lw(x, [18, by - 6, 19.5 - fi, by - 13], 2, '#6b5236'); Lw(x, [16.5, by - 6, 15 - fi * .5, by - 12.5], 2, '#6b5236'); dot(x, 18.6, by - 4.5, .7, '#111'); dot(x, 4.5, by - 1, 1.6, '#eee');
      if (walk) { Lw(x, [8, by + 2, 4 - st * 2, h - 1], 1.8, '#4a3826'); Lw(x, [15, by + 2, 18 + st * 2, h - 1], 1.8, '#4a3826'); } else { Lw(x, [6, by + 3, 4, h - 1, 9, h - 1], 1.8, '#4a3826'); Lw(x, [15, by + 3, 17, h - 1], 1.8, '#4a3826'); } } },
    deer: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const walk = an === 'walk', gy = h - 1, by = gy - 14, down = !walk && fi === 1;
      legs(x, 11, gy, 3, 10, fi, 2, '#5a3a20', walk); legs(x, 24, gy, 3, 10, fi, 2, '#6b4526', walk); E(x, 17, by, 10, 5.5, 0, '#8a5a33'); E(x, 17, by + 2, 7, 3, 0, '#a4764b');
      const hx = down ? 31 : 29, hy = down ? by + 6 : by - 9; Lw(x, [25, by - 2, hx - 1, hy + 1], 3.5, '#8a5a33'); E(x, hx, hy, 3.6, 2.4, down ? .6 : .2, '#7a4e2b'); dot(x, hx + 1.2, hy - .6, .7, '#111');
      Lw(x, [hx - 1, hy - 2, hx - 4, hy - 9, hx - 7, hy - 8], 1, '#d9c9a8'); Lw(x, [hx - 3, hy - 7, hx - 1, hy - 11], 1, '#d9c9a8'); Lw(x, [hx + 1, hy - 2, hx + 3, hy - 9, hx + 6, hy - 8], 1, '#d9c9a8'); dot(x, 7, by - 1, 1.5, '#e8dcc8'); } },
    raven: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const fly = an === 'walk';
      if (!fly) { E(x, 9, 10, 5, 3.2, -.35, '#1a1a22'); dot(x, 13.5, 7, 2.6, '#1a1a22'); T(x, [15.5, 6.5, 19, 7.5, 15.5, 8.2], '#3a3a44'); Lw(x, [4.5, 11.5, 1, 14.5], 2.2, '#1a1a22'); Lw(x, [8, 13, 8, 15.5], 1, '#333'); Lw(x, [11, 12.5, 11.5, 15.5], 1, '#333'); dot(x, 14, 6.2, .6, '#9ad'); if (fi === 2) { E(x, 10, 9, 5, 2.4, -.5, '#2a2a36'); } }
      else { const wy = [2, 7, 12][fi]; E(x, 10, 9, 4, 2.6, 0, '#1a1a22'); dot(x, 14, 8, 2, '#1a1a22'); T(x, [15.5, 7.5, 19, 8.3, 15.5, 9], '#3a3a44'); T(x, [8, 8.5, 1, wy, 4, wy + 1, 12, 9.5], '#1a1a22'); T(x, [8, 8.5, 1.5, wy + 2, 11, 10], '#24242e'); Lw(x, [6, 10, 2, 13], 1.8, '#1a1a22'); dot(x, 14.5, 7.3, .5, '#9ad'); } } },
    wolf: { anims: ['idle', 'walk', 'howl'], paint(x, w, h, an, fi) { const walk = an === 'walk', howl = an === 'howl', gy = h - 1, by = gy - 9;
      legs(x, 10, gy, 3, 8, fi, 2.2, '#454b54', walk); legs(x, 24, gy, 3, 8, fi, 2.2, '#596069', walk); E(x, 17, by, 11, 5, 0, '#596069'); E(x, 17, by - 1.5, 8, 2.5, 0, '#6e7682');
      Lw(x, [6, by - 1, 1.5, by - 6 + (walk ? fi : 0)], 2.6, '#596069'); if (howl) { Lw(x, [26, by - 2, 30, by - 10], 4, '#596069'); E(x, 31, by - 11, 3, 2.2, -.9, '#596069'); T(x, [32, by - 13, 34, by - 16, 33.5, by - 12], '#454b54'); }
      else { Lw(x, [26, by - 2, 29, by - 5], 4, '#596069'); E(x, 30, by - 5, 3.5, 2.3, .15, '#596069'); T(x, [28, by - 7.5, 29, by - 10.5, 30.5, by - 7.5], '#454b54'); dot(x, 31.5, by - 5.8, .7, '#e8d060'); dot(x, 33.5, by - 4.6, .7, '#2a2a2a'); } } },
    sheep: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const walk = an === 'walk', gy = h - 1, by = gy - 9, down = !walk && fi === 1;
      legs(x, 8, gy, 2, 5, fi, 1.8, '#2a2622', walk); legs(x, 16, gy, 2, 5, fi, 1.8, '#2a2622', walk); for (const [cx, cy, r] of [[7, by, 4.5], [12, by - 2, 5.5], [17, by, 4.5], [12, by + 1.5, 5]]) dot(x, cx, cy, r, '#e8e2d2'); dot(x, 11, by - 3.5, 3.5, '#f4f0e6');
      const hx = 20.5, hy = down ? by + 3 : by - 1; E(x, hx, hy, 2.8, 2.2, .3, '#2a2622'); dot(x, hx + 1.5, hy - .6, .5, '#eee'); Lw(x, [hx - 2, hy - 2.5, hx - 3.5, hy - 1], 1.2, '#2a2622'); } },
    chicken: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const walk = an === 'walk', gy = h - 1, by = gy - 5, peck = !walk && fi === 1;
      legs(x, 6.5, gy, 1.2, 3, fi, 1, '#d8a040', walk); E(x, 6.5, by, 4.2, 3, -.2, '#d9c9a8'); T(x, [2.5, by - 1, 0, by - 4, 3.5, by + .5], '#8a7a60'); const hx = 10.5, hy = peck ? by + 1 : by - 4;
      dot(x, hx, hy, 2, '#d9c9a8'); T(x, [hx + 1.5, hy, hx + 4, hy + .8, hx + 1.5, hy + 1.2], '#e8b030'); dot(x, hx + .6, hy - .6, .4, '#222'); dot(x, hx - .5, hy - 2.2, 1, '#c93a2a'); dot(x, hx + 1.5, hy + 1.8, .7, '#c93a2a'); } },
    butterfly: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const k = an === 'walk' ? [1, .55, .15][fi] : [1, .9, 1][fi];
      Lw(x, [7, 3, 7, 8], 1.2, '#2a2020'); for (const s of [-1, 1]) { E(x, 7 + s * 3.2 * k, 4, 3.2 * k, 2.6, s * .3, '#e8a23a'); E(x, 7 + s * 2.4 * k, 7, 2.2 * k, 1.8, -s * .3, '#d8862a'); E(x, 7 + s * 3.5 * k, 3.8, 1 * k, .8, 0, '#2a2020'); } Lw(x, [7, 3, 5.5, 1], .6, '#2a2020'); Lw(x, [7, 3, 8.5, 1], .6, '#2a2020'); } },
    heron: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const fly = an === 'walk', gy = h - 1;
      if (!fly) { Lw(x, [10, gy - 14, 9.5 + (fi === 1 ? 1 : 0), gy], 1.2, '#4a4a40'); Lw(x, [12.5, gy - 14, 13, gy - (fi === 2 ? 6 : 0)], 1.2, '#4a4a40'); E(x, 11, gy - 17, 7, 4, -.15, '#9fb0bd'); E(x, 10, gy - 19, 5, 2, -.2, '#b9c7d2'); Lw(x, [4.5, gy - 16, 1.5, gy - 13], 2, '#6f7f8c');
        Lw(x, [16, gy - 19, 18.5, gy - 25, 17, gy - 29 + (fi === 1 ? 3 : 0)], 2.6, '#9fb0bd'); dot(x, 17, gy - 30 + (fi === 1 ? 3 : 0), 2.4, '#9fb0bd'); T(x, [19, gy - 30.5 + (fi === 1 ? 3 : 0), 24, gy - 29 + (fi === 1 ? 3 : 0), 19, gy - 29 + (fi === 1 ? 3 : 0)], '#e3b661'); dot(x, 17.6, gy - 31 + (fi === 1 ? 3 : 0), .6, '#111'); Lw(x, [15, gy - 31 + (fi === 1 ? 3 : 0), 12, gy - 32 + (fi === 1 ? 3 : 0)], 1, '#2a2e33'); }
      else { const wy = [6, 14, 22][fi]; E(x, 12, 18, 7, 3, 0, '#9fb0bd'); T(x, [8, 17, 2, wy, 6, wy + 1, 15, 19], '#8a9aa8'); T(x, [12, 17, 18, wy, 22, wy + 1, 15, 19], '#8a9aa8'); Lw(x, [18, 17, 21, 14, 23, 13], 2.4, '#9fb0bd'); dot(x, 23, 12.5, 2.2, '#9fb0bd'); T(x, [24.5, 12, 24, 13, 24, 11.5], '#e3b661'); Lw(x, [6, 20, 1, 22], 1.2, '#4a4a40'); } } },
    frog: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const hop = an === 'walk' && fi === 1;
      if (hop) { E(x, 6, 5.5, 5.5, 2.6, -.2, '#5f8f3e'); Lw(x, [2, 7, 0.5, 9.5], 1.4, '#4a7030'); Lw(x, [9, 7, 11.5, 9.5], 1.4, '#4a7030'); } else { E(x, 6, 6.5, 4.6, 3, 0, '#5f8f3e'); E(x, 6, 7.5, 3, 1.6, 0, '#8ab060'); Lw(x, [2.5, 7.5, 1, 9.5, 3, 9.5], 1.4, '#4a7030'); Lw(x, [9.5, 7.5, 11, 9.5, 9, 9.5], 1.4, '#4a7030'); }
      dot(x, 8.5, 3.6, 1.4, '#5f8f3e'); dot(x, 4.5, 3.6, 1.4, '#5f8f3e'); dot(x, 8.8, 3.4, .6, '#e8d040'); dot(x, 4.8, 3.4, .6, '#e8d040'); } },
    lizard: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const s = [0, 1.5, -1.5][fi];
      Lw(x, [8, 5, 4, 5 + s, 0.5, 3.5 - s], 1.6, '#8c7a4a'); E(x, 11, 5, 4.5, 2, 0, '#8c7a4a'); E(x, 11, 4.3, 3, .9, 0, '#a89660'); E(x, 16.5, 4.6, 2.6, 1.5, 0, '#8c7a4a'); dot(x, 17.5, 3.9, .4, '#111');
      Lw(x, [9, 6, 7 - s, 7.6], 1, '#6e5e38'); Lw(x, [13, 6, 15 + s, 7.6], 1, '#6e5e38'); Lw(x, [9, 4, 7 + s, 2.6], 1, '#6e5e38'); Lw(x, [13, 4, 15 - s, 2.6], 1, '#6e5e38'); } },
    vulture: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const t = [0, 1.5, -1.5][fi];
      T(x, [22, 9, 3, 6 + t, 0.5, 9 + t, 4, 9.5 + t, 1.5, 11.5 + t, 6, 10 + t, 3.5, 12.5 + t, 20, 12], '#2a2420'); T(x, [22, 9, 41, 6 - t, 43.5, 9 - t, 40, 9.5 - t, 42.5, 11.5 - t, 38, 10 - t, 40.5, 12.5 - t, 24, 12], '#2a2420');
      E(x, 22, 11, 5, 2.6, 0, '#2a2420'); E(x, 22, 10.2, 3, 1, 0, '#3e3630'); T(x, [19, 13, 25, 13, 22, 18], '#2a2420'); dot(x, 22, 8.6, 1.4, '#c9a08a'); } },
    scorpion: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const o = [0, .8, -.8][fi];
      E(x, 7, 7, 3.6, 1.6, 0, '#4a3a2c'); dot(x, 10, 7, 1.4, '#4a3a2c'); Lw(x, [4, 6.5, 2.5, 4.5, 2.5, 2, 3.5, 1], 1.4, '#4a3a2c'); dot(x, 4, 1, .8, '#6a2a1a');
      Lw(x, [10.5, 6.5, 12.5 + o, 5.5, 13.5, 6.5], 1.1, '#4a3a2c'); Lw(x, [10.5, 7.5, 12.5 - o, 8, 13.5, 7], 1.1, '#4a3a2c'); for (let i = 0; i < 3; i++) { Lw(x, [6 + i * 1.3, 8, 5 + i * 1.3 + o, 9.6], .8, '#3a2e22'); } } },
    gull: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const wy = [3, 8, 13][fi];
      E(x, 13, 9, 5, 2.6, 0, '#f0f0ee'); dot(x, 18.5, 7.8, 2, '#f0f0ee'); T(x, [20, 7.5, 23.5, 8.5, 20, 9], '#e8b030'); dot(x, 19, 7.2, .5, '#222');
      T(x, [11, 8, 1, wy, 3, wy + 1.5, 14, 10], '#a8acb0'); T(x, [15, 8, 25, wy, 23, wy + 1.5, 12, 10], '#a8acb0'); T(x, [11, 8, 1, wy, 2, wy + .5], '#333'); T(x, [15, 8, 25, wy, 24, wy + .5], '#333'); Lw(x, [8.5, 9.5, 5.5, 11.5], 1.6, '#f0f0ee'); } },
    crab: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const o = [0, 1, -1][fi];
      E(x, 8, 7, 5, 3, 0, '#b3482f'); E(x, 8, 6, 3.5, 1.4, 0, '#cf6a4a'); dot(x, 6, 3.5, .9, '#2a1a14'); dot(x, 10, 3.5, .9, '#2a1a14');
      for (let i = 0; i < 4; i++) { Lw(x, [4 - i * .6, 6 + i * 1, 1 - i * .4 + o, 8 + i * 1.1], 1, '#8a3620'); Lw(x, [12 + i * .6, 6 + i * 1, 15 + i * .4 - o, 8 + i * 1.1], 1, '#8a3620'); }
      Lw(x, [4, 5, 2, 2.5], 1.3, '#b3482f'); dot(x, 2, 2, 1.3, '#b3482f'); Lw(x, [12, 5, 14, 2.5], 1.3, '#b3482f'); dot(x, 14, 2, 1.3, '#b3482f'); } },
    snowfox: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const walk = an === 'walk', gy = h - 1, by = gy - 7;
      if (walk) { legs(x, 8, gy, 2.4, 6, fi, 1.8, '#d8dde2', true); legs(x, 17, gy, 2.4, 6, fi, 1.8, '#eef2f5', true); } else { Lw(x, [8, by + 2, 7, gy], 1.8, '#d8dde2'); Lw(x, [16, by + 2, 17, gy], 1.8, '#eef2f5'); }
      E(x, 12.5, by, 8, 4, 0, '#eef2f5'); E(x, 3.5, by + 1, 4, 2.4, -.5, '#eef2f5'); dot(x, 1.5, by + 2.5, 1.6, '#d8dde2'); E(x, 21, by - 3, 3.4, 2.4, .25, '#eef2f5'); T(x, [19, by - 5.5, 19.5, by - 9.5, 21.5, by - 5.5], '#eef2f5'); T(x, [21.5, by - 5.5, 23, by - 9, 23.5, by - 5], '#eef2f5'); dot(x, 24.3, by - 2.4, .8, '#222'); dot(x, 21.8, by - 3.8, .6, '#222'); } },
    mammoth: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const walk = an === 'walk', gy = h - 1, by = gy - 18;
      legs(x, 17, gy, 4.5, 13, fi, 5, '#2e2217', walk); legs(x, 36, gy, 4.5, 13, fi, 5, '#3a2a1e', walk); E(x, 27, by, 19, 11, 0, '#3a2a1e'); E(x, 24, by - 6, 11, 5, -.15, '#4a3626');
      dot(x, 44, by - 6, 7.5, '#3a2a1e'); dot(x, 43, by - 11, 4, '#4a3626'); Lw(x, [49, by - 2, 53, by + 6, 51, by + 13], 3.2, '#3a2a1e'); Lw(x, [46, by + 1, 51, by + 5, 55, by + 1], 1.6, '#e8dcc8'); dot(x, 47.5, by - 7, .8, '#111'); Lw(x, [8, by - 3, 4, by + 4], 1.6, '#3a2a1e'); } },
    eyes: { anims: ['idle', 'walk'], paint(x, w, h, an, fi) { const closed = fi === 2;
      for (const cx of [5.5, 14.5]) { if (closed) { Lw(x, [cx - 2.4, 4.2, cx + 2.4, 4.2], 1.4, 'rgba(207,227,106,.75)'); } else { x.shadowColor = '#cfe36a'; x.shadowBlur = 4; E(x, cx, 4, 2.6, 1.6, 0, '#cfe36a'); x.shadowBlur = 0; dot(x, cx, 4, .7, '#1a2a10'); } } } },
    banner: { anims: ['idle', 'flap'], paint(x, w, h, an, fi, col) { Lw(x, [3, 2, 3, h - 1], 1.6, '#2a2520'); dot(x, 3, 1.5, 1.4, '#c9b27a');
      const s = [0, 1, -1][fi]; x.fillStyle = col; x.beginPath(); x.moveTo(4, 3); x.quadraticCurveTo(10 + s * 2, 6 - s * 1.5, 16 + s * 2, 4 + s); x.quadraticCurveTo(14 + s, 10, 17 - s * 2, 16 - s); x.quadraticCurveTo(10 - s * 2, 14 + s, 4, 17); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.moveTo(4, 11); x.quadraticCurveTo(10 - s * 2, 13 + s, 17 - s * 2, 16 - s); x.quadraticCurveTo(10 - s * 2, 14 + s, 4, 17); x.closePath(); x.fill(); } } };
})();
