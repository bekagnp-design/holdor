/* HOLDOR RPG — townsfolk (T1): ambient people who make the towns and castles look lived in. Display + light AI only: nobody fights,
   drops loot, shows a bar or opens a dialog (kind 'folk' is not interactable; 21_player only offers npc / portal / drop).
   When the hero comes within NEAR (900) of a town / castle / village / city / friendly camp POI (hostile camps — p.camp / p.mobs — and
   R.townsfolk.SKIP are left empty), PEOPLE are spawned round it: 6–14 by day (seats, King's Landing 14, towns 12, other castles 9),
   about half at night; they despawn when the hero is FAR (1300) from it. At most two places are alive at a time.
   Entity: {kind:'folk', type:'folk', team:2, noLoot, noBar, invuln, noCollide, ambient, role, look, poi (id), bbH (figure height, units),
            fade 0→1, torch?, bub?} + e.frame(anim, t, face) → a cached canvas painted in code at the hero's pixel scale (PXU 2.3 px / unit),
            canvas.meta = {ax, ay, h, sc} (feet anchor in px, figure px height) and canvas.units / canvas.anchor (the same in world units).
   Roles: walker (goes between the place's spots: well, market, gate, house doors, lanes; stops, idles, meets someone and talks),
          guard (two stand at the gate, face the road, shift now and then), child (runs, chases another child), merchant (at the stall,
          calls out), elder (slow, with a staff). Pairs chat: every ~10 s one pair within CHAT_R (150) of the hero says an original
          one-liner and its answer (a bubble on the 2D overlay); the merchant calls within 200.
   Night (R.ambience.night): fewer people, the guards and ~40 % of the walkers carry a torch: e.torch = {z, dx, r, col, k} — the flame's
          height above the feet (units), its sideways offset in billboard units (signed by the facing: + = the side the figure faces),
          the light radius, the colour, a 0–1 flicker. The 3D renderer may draw it as a warm light; until it says so
          (R.render3d.torchLights = true) this system draws a small additive glow at the flame on the overlay (F.glow2d = false: off).
   Ground: every spot and every step is on walkable ground (R.world.blocked false, R.world.obstacleAt false), away from the quest
          NPCs' spots (R.npcs.at(poi)), inside poi.r × 0.9 (poi.r, else the built architecture's userData.radius, else 150 / 170 / 280).
          A layout published by the architecture is used when present: poi.folk or R.render3d.props.get(id).obj.userData.folk =
          {well:{x,y}, market:{x,y}, gate:{x,y}, doors:[{x,y}], lanes:[{x,y}], keepOut:[{x,y,r}]} in units relative to the POI centre.
   Region look: the North furs / wool in grey and brown, the Reach bright linens and straw hats, Dorne light robes and head wraps,
          the Iron Islands dark oilskins, the Westerlands red / gold, the Riverlands blue / green, the Stormlands yellow / black,
          the Wall black cloaks, the Vale sky blue / cream, the Crownlands mixed, Dragonstone ash and red, beyond the Wall furs.
   API: R.townsfolk = { NEAR, FAR, MIN, MAX, CHAT_R, PXU, SKIP, places (poiId → place), isPlace(poi), countFor(poi, night), spawnAt(poiId, o),
          despawn(poiId), list(), lines(region), look(o), frameAt(look, anim, phase, face), cacheSize(), styleOf(region), glow2d, stats }
   System 'townsfolk' (order 66): the spawn check twice a second, AI, chat; system 'townsfolkDraw' (order 908): bubbles, the 2D torch glow, sprites without WebGL. */
(function () {
  const F = R.townsfolk = R.townsfolk || {};
  const TAU = Math.PI * 2;
  F.NEAR = 900; F.FAR = 1300; F.MIN = 6; F.MAX = 14; F.CHAT_R = 150; F.CALL_R = 200; F.CHAT_EVERY = 10; F.PXU = 2.3; F.MAX_PLACES = 2; F.glow2d = true;
  F.SKIP = { nightfort: 1, queenscrown: 1 };
  F.places = {}; F.stats = { ms: 0, n: 0 };
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mkRng = seed => { let s = (seed >>> 0) || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const rnd = Math.random;
  const fn = (o, k) => !!o && typeof o[k] === 'function';
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const night = () => !!(R.ambience && R.ambience.night);
  const pois = () => { const d = R.data && R.data.world; const p = d && d.pois; return !p ? [] : Array.isArray(p) ? p : Object.keys(p).map(k => p[k]); };
  const poiById = id => pois().find(p => p && p.id === id) || null;

  /* ---- which POIs get people ---- */
  const PLACE_T = { castle: 1, town: 1, village: 1, city: 1, port: 1, hamlet: 1 };
  F.isPlace = p => { if (!p || p.x == null || p.y == null || F.SKIP[p.id] || p.folk === false || p.noFolk) return false;
    const t = String(p.type || p.kind || '').toLowerCase(); if (PLACE_T[t]) return true;
    return t === 'camp' && !p.camp && !p.mobs && !p.hostile; };
  F.countFor = (p, isNight) => { const t = String(p.type || p.kind || '').toLowerCase();
    let n = p.seat || p.hub || /kingslanding/.test(p.id || '') ? 14 : t === 'town' || t === 'city' || t === 'port' ? 12 : t === 'castle' ? 9 : 7;
    if (p.region === 'wall' || p.region === 'beyond' || p.region === 'winter') n -= 2;
    if (p.folkN) n = p.folkN; n = clamp(n, F.MIN, F.MAX);
    return isNight ? Math.max(3, Math.round(n * .5)) : n; };
  const archGroup = p => { try { const P = R.render3d && R.render3d.props; const o = P && fn(P, 'get') ? P.get(p.id) : null; return o && (o.obj || o); } catch (e) { return null; } };
  const radiusOf = p => { if (p.r > 0) return p.r; const g = archGroup(p), r = g && g.userData && g.userData.radius; if (r > 0) return r;
    return /kingslanding/.test(p.id || '') ? 280 : String(p.type) === 'castle' ? 150 : 170; };

  /* ---- ground ---- */
  const W = () => R.world;
  const blocked = (x, y) => { const w = W(); try { if (w && fn(w, 'inWorld') && !w.inWorld(x, y)) return true; return !!(w && fn(w, 'blocked') && w.blocked(x, y)); } catch (e) { return false; } };
  const obst = (x, y, r) => { const w = W(); try { return !!(w && fn(w, 'obstacleAt') && w.obstacleAt(x, y, r || 0)); } catch (e) { return false; } };
  const npcSpots = pid => { try { return (R.npcs && fn(R.npcs, 'at') ? R.npcs.at(pid) : []).filter(n => n && !n.dead); } catch (e) { return []; } };
  // a spot: walkable, inside the place, off the keep-out discs and 40 units from every quest NPC
  const okAt = (pl, x, y) => { if (blocked(x, y) || obst(x, y, 8)) return false;
    if ((x - pl.x) ** 2 + (y - pl.y) ** 2 > pl.sr * pl.sr) return false;
    for (const k of pl.keepOut) if ((x - k.x) ** 2 + (y - k.y) ** 2 < k.r * k.r) return false;
    for (const n of pl.npcs) if ((x - n.x) ** 2 + (y - n.y) ** 2 < 40 * 40) return false;
    return true; };
  // a step from (ox, oy) to (x, y): walkable and inside; a keep-out disc or an NPC's 24 units may only be left, never entered
  const disc = (ox, oy, x, y, cx, cy, r) => { const d1 = (x - cx) ** 2 + (y - cy) ** 2; return d1 < r * r && d1 < (ox - cx) ** 2 + (oy - cy) ** 2; };
  const okStep = (pl, ox, oy, x, y) => { if (blocked(x, y) || obst(x, y, 6)) return false;
    const d1 = (x - pl.x) ** 2 + (y - pl.y) ** 2; if (d1 > pl.sr * pl.sr && d1 > (ox - pl.x) ** 2 + (oy - pl.y) ** 2) return false;
    for (const k of pl.keepOut) if (disc(ox, oy, x, y, k.x, k.y, k.r)) return false;
    for (const n of pl.npcs) if (disc(ox, oy, x, y, n.x, n.y, 24)) return false;
    return true; };
  F.okAt = (pid, x, y) => { const pl = F.places[pid]; return pl ? okAt(pl, x, y) : !blocked(x, y); };
  // the nearest walkable point to (x, y) inside the place (a spiral of probes), or null
  const settle = (pl, x, y, r) => { if (okAt(pl, x, y)) return { x, y }; for (let i = 1; i <= 24; i++) { const a = i * 2.39996, d = (r || 12) * Math.sqrt(i);
      const q = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }; if (okAt(pl, q.x, q.y)) return q; } return null; };
  const randIn = (pl, cx, cy, rad, tries) => { for (let t = 0; t < (tries || 12); t++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (okAt(pl, x, y)) return { x, y }; } return null; };

  /* ---- the place's layout: well, market, gate (toward the nearest road), house doors, lanes ---- */
  function layout(p) {
    const r = mkRng(hash('folk:' + p.id)), pr = radiusOf(p), sr = pr * .9, pl = { id: p.id, poi: p, x: p.x, y: p.y, pr, sr, keepOut: [], ents: [], night: night(), born: R.t, npcs: [] };
    pl.npcs = npcSpots(p.id).map(n => ({ x: n.x, y: n.y }));
    const pub = p.folk || ((archGroup(p) || {}).userData || {}).folk || null, rel = q => q && { x: p.x + q.x, y: p.y + q.y };
    const town = /town|village|city|port|hamlet/.test(String(p.type || ''));
    if (pub && pub.keepOut) for (const k of pub.keepOut) pl.keepOut.push({ x: p.x + k.x, y: p.y + k.y, r: k.r || 20 });
    else if (town) pl.keepOut.push({ x: p.x, y: p.y, r: 15 });   // the well stands in the middle of a town
    // the gate faces the nearest road (12 probes on the rim), else the south
    let ga = Math.PI / 2, best = 1e9; const w = W();
    if (w && fn(w, 'roadNear')) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, q = w.roadNear(p.x + Math.cos(a) * pr * 1.2, p.y + Math.sin(a) * pr * 1.2, 260); if (q && q.d < best) { best = q.d; ga = a; } }
    pl.gateA = ga; pl.gateDir = { x: Math.cos(ga), y: Math.sin(ga) };
    const S = (q, tag) => { const s = q && settle(pl, q.x, q.y, 10); if (s) s.tag = tag; return s; };
    pl.gate = S(rel(pub && pub.gate) || { x: p.x + Math.cos(ga) * sr * .9, y: p.y + Math.sin(ga) * sr * .9 }, 'gate');
    const wa = r() * TAU; pl.well = S(rel(pub && pub.well) || { x: p.x + Math.cos(wa) * (town ? 24 : sr * .25), y: p.y + Math.sin(wa) * (town ? 24 : sr * .25) }, 'well');
    const ma = ga + Math.PI * (.55 + r() * .9); pl.market = S(rel(pub && pub.market) || { x: p.x + Math.cos(ma) * sr * .38, y: p.y + Math.sin(ma) * sr * .38 }, 'market');
    // doors: in front of the houses (a generic town's houses stand on a ring at 70–130 units), in a castle's yard
    pl.doors = []; const nd = 5 + Math.floor(r() * 3);
    if (pub && pub.doors) for (const d of pub.doors) { const s = S(rel(d), 'door'); if (s) pl.doors.push(s); }
    else for (let i = 0; i < nd; i++) { const a = ga + (i + .5) / nd * TAU + (r() - .5) * .5, d = sr * (town ? .3 + r() * .18 : .42 + r() * .3), s = S({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, 'door'); if (s) pl.doors.push(s); }
    pl.lanes = []; if (pub && pub.lanes) for (const d of pub.lanes) { const s = S(rel(d), 'lane'); if (s) pl.lanes.push(s); }
    else for (let i = 0; i < 4; i++) { const a = r() * TAU, d = sr * (.2 + r() * .45), s = S({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, 'lane'); if (s) pl.lanes.push(s); }
    pl.spots = [pl.well, pl.market, pl.gate].concat(pl.doors, pl.lanes).filter(Boolean);
    if (!pl.spots.length) { const s = settle(pl, p.x + 30, p.y + 30, 14); if (s) { s.tag = 'lane'; pl.spots.push(s); } }
    pl.style = F.styleOf(p.region, p);
    return pl;
  }

  /* ---- region styles: palettes (muted, natural) ---- */
  const SK_N = ['#efcfb4', '#e6c0a2', '#dcb294', '#f3d8c2', '#d1a585'], SK_M = ['#e6bb98', '#d6a582', '#c99572', '#efc9a8', '#b98462'], SK_D = ['#b98058', '#a26c46', '#8c5a38', '#c8916a', '#7a4c30', '#d4a27c'];
  const HAIR = ['#2a1e16', '#3e2a1c', '#5a3c24', '#7a5632', '#9a7442', '#2e2a28', '#6e3820', '#b08a52'], HAIR_D = ['#1c1410', '#2a1e16', '#3a2818', '#241a14'];
  const ST = {
    north: { tun: ['#6b6258', '#5c5248', '#7c7062', '#545a5c', '#6e5c48', '#837766'], clo: ['#4a4038', '#5b5148', '#3f3b37', '#55493c'], fur: ['#bdb2a0', '#8f7f6a', '#d6cec0', '#6f6250'],
      hats: ['hood', 'fur', 'hood', 'cap', null, null], skin: SK_N, cloak: .75, furP: .7, legs: ['#4a4238', '#3e3a34', '#5a5046'], wrap: 0 },
    reach: { tun: ['#d8c79e', '#c9a85a', '#8fa860', '#c87a5a', '#e2d8c0', '#7a9ac0', '#b8c87a', '#d89a6a'], clo: ['#8a9a5a', '#a8885a'], fur: ['#c9b58a'],
      hats: ['straw', 'straw', 'kerchief', null, 'cap', null], skin: SK_M, cloak: .1, furP: 0, legs: ['#6a5a40', '#7a6a4a', '#5a5040'], apron: .5 },
    dorne: { tun: ['#ece2cc', '#dcc296', '#cf8a52', '#e8d2a6', '#bf6c4c', '#d9b17a', '#f2ead8'], clo: ['#d8c4a0', '#c9a070'], fur: ['#d8c4a0'],
      hats: ['wrap', 'wrap', 'wrap', 'kerchief', null], skin: SK_D, cloak: .15, furP: 0, legs: ['#c9b08a', '#a8865a'], robe: .6, sandal: 1 },
    iron: { tun: ['#3a4246', '#2f3a3e', '#47423b', '#30373a', '#4a4a44'], clo: ['#262e32', '#2c3236', '#1f2629'], fur: ['#5a5650'],
      hats: ['hood', 'hood', 'cap', null], skin: SK_N, cloak: .8, furP: .1, legs: ['#2a2e30', '#3a3632'], oil: 1 },
    west: { tun: ['#8a2e24', '#a8402e', '#c9a24a', '#6e2a22', '#d8c08a', '#9a5a34'], clo: ['#5a1e1a', '#7a2a22', '#8a6a3a'], fur: ['#c9a86a'],
      hats: ['cap', null, 'kerchief', null, 'hood'], skin: SK_M, cloak: .3, furP: 0, legs: ['#4a3a2a', '#5a4030'] },
    river: { tun: ['#4a6a8a', '#3e6a5a', '#6a8aa0', '#5a7a4a', '#8aa0a8', '#6a7a5a'], clo: ['#3a4a5a', '#3a5a4a', '#5a6a5a'], fur: ['#9a8a70'],
      hats: ['cap', null, 'hood', 'kerchief', 'straw'], skin: SK_M, cloak: .3, furP: 0, legs: ['#4a4a3a', '#3a3a34'], apron: .3 },
    storm: { tun: ['#c9a83a', '#2e2c28', '#8a7a3a', '#d8c06a', '#3a3632', '#6a5a30'], clo: ['#2a2826', '#3a3530', '#5a4a26'], fur: ['#8a7a5a'],
      hats: ['hood', 'cap', null, null], skin: SK_M, cloak: .5, furP: .1, legs: ['#2e2c28', '#4a4030'] },
    wall: { tun: ['#26262a', '#2e2c2c', '#1f1f23', '#33302e'], clo: ['#18181b', '#1d1c1e', '#222024'], fur: ['#3a3634', '#4a4440', '#2a2826'],
      hats: ['hood', 'hood', null, 'fur'], skin: SK_N, cloak: 1, furP: .8, legs: ['#1e1e20', '#2a2826'], black: 1 },
    vale: { tun: ['#6a8ab0', '#d8d4c8', '#4a5a7a', '#9ab0c8', '#8a8a8a'], clo: ['#3a4a6a', '#5a6a8a', '#7a7a7a'], fur: ['#c8c4b8'],
      hats: ['hood', 'cap', null, 'fur'], skin: SK_N, cloak: .6, furP: .3, legs: ['#3a3a40', '#4a4a50'] },
    crown: { tun: ['#8a3a30', '#c9a85a', '#5a6a8a', '#d9c9a3', '#6a5a48', '#7a8a5a'], clo: ['#4a3a30', '#5a4a3a'], fur: ['#a89070'],
      hats: ['cap', null, 'kerchief', 'straw', null], skin: SK_M, cloak: .25, furP: 0, legs: ['#4a4030', '#3a3630'], apron: .3 },
    ash: { tun: ['#3a3634', '#6a2a26', '#4a4440', '#5a5450'], clo: ['#2a2624', '#3a2a28'], fur: ['#5a504a'],
      hats: ['hood', 'cap', null], skin: SK_N, cloak: .6, furP: .1, legs: ['#2a2624', '#3a3430'] },
    beyond: { tun: ['#7a6a58', '#5a4a3a', '#9a8a74', '#6a5a4a'], clo: ['#4a3e32', '#5a4a3a', '#6a5a48'], fur: ['#c8bcaa', '#9a8a74', '#e0d8cc'],
      hats: ['fur', 'hood', 'fur', null], skin: SK_N, cloak: .9, furP: 1, legs: ['#4a3e32', '#3a3228'] } };
  const REG = { north: 'north', farnorth: 'north', westcoast: 'north', reach: 'reach', dorne: 'dorne', ironislands: 'iron', westerlands: 'west', riverlands: 'river',
    stormlands: 'storm', wall: 'wall', vale: 'vale', crownlands: 'crown', dragonstone: 'ash', beyond: 'beyond', winter: 'beyond' };
  F.styleOf = (region, p) => { const k = REG[String(region || '').toLowerCase()] || (/dorne|sun/.test(String(region)) ? 'dorne' : /iron|pyke/.test(String(region)) ? 'iron' : 'crown');
    const s = Object.assign({ id: k }, ST[k]); const H = R.data && R.data.houses && p && (p.house || null); s.house = H && R.data.houses[H] ? R.data.houses[H] : null; return s; };
  F.REG = REG; F.STYLES = ST;

  /* ---- a person's look (deterministic from a seed) ---- */
  F.look = o => {
    o = o || {}; const r = mkRng(o.seed != null ? o.seed : hash(Math.random())), st = o.style || F.styleOf(o.region || 'north'), role = o.role || 'walker';
    const child = role === 'child', old = role === 'elder' || (!child && r() < .14), sex = o.sex || (r() < .5 ? 'f' : 'm');
    const L = { key: 'f' + (o.seed != null ? o.seed : Math.floor(r() * 1e9)), role, child, old, sex, style: st.id,
      H: child ? 38 + r() * 5 : (sex === 'f' ? 55 + r() * 4 : 57.5 + r() * 4.5) - (old ? 1.5 : 0), build: child ? 1.12 : (sex === 'f' ? .9 : .96) + r() * .18,
      skin: pick(r, st.skin), hair: old ? pick(r, ['#c9c2b6', '#a8a298', '#dad4ca']) : st.id === 'dorne' ? pick(r, HAIR_D) : pick(r, HAIR),
      hairStyle: sex === 'f' ? pick(r, ['long', 'bun', 'braid', 'long']) : pick(r, ['short', 'short', 'shag', old ? 'bald' : 'short']),
      beard: sex === 'm' && !child && r() < (old ? .8 : .42), tun: pick(r, st.tun), tun2: pick(r, st.tun), legs: pick(r, st.legs), boot: pick(r, ['#3a2a1e', '#2e241c', '#4a3626']),
      cloak: !child && r() < st.cloak ? pick(r, st.clo) : null, fur: r() < (st.furP || 0) ? pick(r, st.fur) : null, belt: pick(r, ['#3a2a1c', '#4a3422', '#2a201a']),
      dress: sex === 'f' && !child ? r() < .85 : sex === 'f' && r() < .6, robe: !!st.robe && r() < st.robe, apron: r() < (st.apron || .12) ? pick(r, ['#e8dfca', '#d8cfb8', '#cfc2a2']) : null,
      hat: null, hatCol: null, prop: null, oil: !!st.oil, sandal: !!st.sandal };
    L.hat = pick(r, st.hats); if (L.hat === 'straw' && st.id !== 'reach' && st.id !== 'river' && st.id !== 'crown') L.hat = 'cap';
    if (L.hat === 'kerchief' && L.sex !== 'f') L.hat = st.id === 'dorne' ? 'wrap' : null;
    if (L.hat === 'hood' && !L.cloak) L.hat = st.id === 'wall' || st.id === 'iron' ? 'hood' : r() < .5 ? 'cap' : null;
    L.hatCol = L.hat === 'hood' ? (L.cloak || pick(r, st.clo)) : L.hat === 'fur' ? pick(r, st.fur) : L.hat === 'wrap' ? pick(r, ['#efe6d2', '#e6d2a8', '#c97c48', '#d8b06a', '#9a4a3a', '#f4efe4'])
      : L.hat === 'straw' ? pick(r, ['#d8c088', '#cdb070', '#e2cc96']) : L.hat === 'kerchief' ? pick(r, ['#e8dfca', '#c96a4a', '#6a8aa0', '#d8b860', '#8a5a7a']) : pick(r, ['#5a4632', '#4a3a2e', '#6a5038', '#3a3430', '#7a2a22']);
    if (child) { L.cloak = null; L.hat = r() < .3 ? L.hat : null; if (L.hat === 'hood') L.hat = null; }
    if (role === 'guard') { L.sex = 'm'; L.dress = false; L.robe = false; L.apron = null; L.H = 59 + r() * 3; L.build = 1.05; L.prop = 'spear'; L.hat = 'helm'; L.hatCol = '#8a8e92';
      const hc = st.house && (st.house.col2 || st.house.col); L.tun = st.id === 'wall' ? '#1d1d20' : hc || pick(r, st.tun); L.tun2 = st.house ? st.house.col : '#8a8e92'; L.mail = 1; L.cloak = st.id === 'wall' || st.id === 'north' || r() < .4 ? pick(r, st.clo) : null; L.beard = r() < .5; }
    else if (role === 'merchant') { L.apron = L.apron || '#e0d6bc'; L.prop = null; L.cloak = null; L.hat = L.hat === 'hood' ? 'cap' : L.hat; }
    else if (role === 'elder') { L.old = true; L.prop = 'staff'; L.hair = pick(r, ['#c9c2b6', '#dad4ca']); }
    else if (!child) { const pr = r(); L.prop = pr < .16 ? 'basket' : pr < .26 ? 'pail' : pr < .36 ? 'sack' : pr < .46 && L.sex === 'm' ? 'hoe' : pr < .52 ? 'bundle' : null; if (L.old && !L.prop && r() < .6) L.prop = 'staff'; }
    if (st.id === 'dorne' && L.dress) L.robe = true;
    return L;
  };

  /* ---- painting: the figure in a normalised space (100 = the figure's height, feet at 0, facing +x), light from the screen's upper left ---- */
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (h, k) => { const c = hex(h), t = k > 0 ? 255 : 0, a = Math.abs(k); return 'rgb(' + Math.round(c[0] + (t - c[0]) * a) + ',' + Math.round(c[1] + (t - c[1]) * a) + ',' + Math.round(c[2] + (t - c[2]) * a) + ')'; };
  const CWN = 84, TOPN = 128, BOTN = 6;   // canvas width / headroom / footroom in normalised units
  function painter(g, face) {
    const lx = -face, OL = 'rgba(30,22,16,.55)';
    const shade = (x0, y0, x1, y1, col, k1, k2) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, mix(col, k1 == null ? .16 : k1)); gr.addColorStop(.55, col); gr.addColorStop(1, mix(col, k2 == null ? -.3 : k2)); return gr; };
    // a fill shaded across its box (cx, cy, w, h): light at the upper left of the SCREEN
    const P = {
      fill(path, col, cx, cy, w, h, line, k1, k2) { g.fillStyle = shade(cx + lx * w, cy - h, cx - lx * w, cy + h, col, k1, k2); g.fill(path); if (line !== false) { g.strokeStyle = OL; g.lineWidth = line || .9; g.stroke(path); } },
      limb(pts, w0, w1, col, k) { // a tapered limb through 3 points (hip/shoulder, knee/elbow, ankle/wrist)
        const p = new Path2D(), [a, b, c] = pts, n = (u, v) => { const dx = v[0] - u[0], dy = v[1] - u[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
        const n1 = n(a, b), n2 = n(b, c), wm = (w0 + w1) / 2;
        p.moveTo(a[0] + n1[0] * w0 / 2, a[1] + n1[1] * w0 / 2); p.lineTo(b[0] + (n1[0] + n2[0]) * wm / 4, b[1] + (n1[1] + n2[1]) * wm / 4); p.lineTo(c[0] + n2[0] * w1 / 2, c[1] + n2[1] * w1 / 2);
        p.arc(c[0], c[1], w1 / 2, Math.atan2(n2[1], n2[0]), Math.atan2(n2[1], n2[0]) + Math.PI, false);
        p.lineTo(b[0] - (n1[0] + n2[0]) * wm / 4, b[1] - (n1[1] + n2[1]) * wm / 4); p.lineTo(a[0] - n1[0] * w0 / 2, a[1] - n1[1] * w0 / 2);
        p.arc(a[0], a[1], w0 / 2, Math.atan2(-n1[1], -n1[0]), Math.atan2(-n1[1], -n1[0]) + Math.PI, false); p.closePath();
        const x0 = Math.min(a[0], c[0]), x1 = Math.max(a[0], c[0]), y0 = Math.min(a[1], c[1]), y1 = Math.max(a[1], c[1]);
        P.fill(p, k ? mix(col, k) : col, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + w0, (y1 - y0) / 2, .8); },
      ell(cx, cy, rx, ry, col, rot, line, k1, k2) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); P.fill(p, col, cx, cy, rx, ry, line, k1, k2); return p; },
      poly(pts, col, line, k1, k2) { const p = new Path2D(); p.moveTo(pts[0], pts[1]); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (let i = 0; i < pts.length; i += 2) { if (i) p.lineTo(pts[i], pts[i + 1]); x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
        p.closePath(); P.fill(p, col, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, line, k1, k2); return p; },
      curve(build, col, box, line, k1, k2) { const p = new Path2D(); build(p); P.fill(p, col, box[0], box[1], box[2], box[3], line, k1, k2); return p; },
      line(pts, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); },
      dot(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } };
    return P;
  }
  // a leg: hip angle a (from the vertical, + = forward), knee bend b (+ = the foot goes back)
  const legPts = (hx, hy, th, sh, a, b) => { const k = [hx + Math.sin(a) * th, hy + Math.cos(a) * th]; return [[hx, hy], k, [k[0] + Math.sin(a - b) * sh, k[1] + Math.cos(a - b) * sh]]; };
  const armPts = (sx, sy, up, fo, a, b) => { const e = [sx + Math.sin(a) * up, sy + Math.cos(a) * up]; return [[sx, sy], e, [e[0] + Math.sin(a + b) * fo, e[1] + Math.cos(a + b) * fo]]; };
  function paintFigure(g, L, anim, ph, face, torch) {
    const P = painter(g, face), c = L.child, B = L.build;
    const TH = c ? 22 : 24.5, SH = c ? 21 : 23, UP = c ? 15 : 17, FO = c ? 14 : 16;
    const walk = anim === 'walk', talk = anim === 'talk', th = walk ? ph / 6 * TAU : 0;
    // legs: A = near, B = far; the support leg touches the ground (hip height follows it)
    const amp = walk ? (c ? .5 : .42) : 0, aA = amp * Math.sin(th), bA = walk ? .8 * Math.max(0, Math.cos(th)) : 0, aB = amp * Math.sin(th + Math.PI), bB = walk ? .8 * Math.max(0, Math.cos(th + Math.PI)) : 0;
    const ext = (a, b) => TH * Math.cos(a) + SH * Math.cos(a - b), hipH = Math.max(ext(aA, bA), ext(aB, bB));
    const breath = anim === 'idle' || talk ? (ph % 2 ? -.55 : 0) : 0, stoop = L.old ? 2.2 : 0;
    const hipY = -hipH, shY = hipY - (c ? 31 : 30) + breath, headCY = shY - (c ? 11.5 : 10.5) + breath * .4, hx = 0, lean = walk ? 1.2 : 0;
    const sx = 1 + stoop + lean, hR = c ? 9.4 : 7.2, hRy = c ? 9.9 : 8.1;
    const swing = walk ? .5 * Math.sin(th + Math.PI) : 0;   // the near arm swings against the near leg
    const cloakSway = walk ? Math.abs(Math.sin(th)) * 2.5 : 0;
    const hem = L.dress || L.robe ? -5 + (L.robe && !L.dress ? -3 : 0) : hipY + (c ? 7 : 9);
    const torsoW = 10.6 * B, waistW = 9.2 * B;
    /* the cloak behind */
    if (L.cloak) { const bot = L.old || L.style === 'wall' ? -10 : -20, cx = -2;
      P.curve(p => { p.moveTo(sx + torsoW * .7, shY - 1.5); p.quadraticCurveTo(sx - 2, shY - 4, sx - torsoW - 1.5, shY + 1); p.quadraticCurveTo(cx - torsoW - 4 - cloakSway, (shY + bot) / 2, cx - torsoW - 5.5 - cloakSway * 1.6, bot);
        p.quadraticCurveTo(cx - 2, bot + 2.5, cx + torsoW + 2, bot - 1); p.lineTo(sx + torsoW * .6, shY + 6); p.closePath(); }, mix(L.cloak, -.12), [cx - 2, (shY + bot) / 2, torsoW + 5, (bot - shY) / 2], .9, .1, -.4); }
    /* far arm, far leg */
    const fsx = sx - torsoW * .5, fsy = shY + 2.6;
    const farArm = armPts(fsx, fsy, UP, FO, -swing * .9 + (L.prop === 'sack' || L.prop === 'bundle' ? Math.PI * .85 : 0), (L.prop === 'sack' || L.prop === 'bundle') ? -1.6 : .25 + (walk ? .15 : 0));
    P.limb(farArm, 6.4 * B, 5 * B, L.mail ? '#7a7e82' : L.tun, -.22); P.ell(farArm[2][0], farArm[2][1], 2.7, 2.7, mix(L.skin, -.22), 0, .6);
    const legC = L.legs, bootH = c ? 5 : 7;
    const drawLeg = (pts, k) => { P.limb(pts, 8.6 * B, 6.2 * B, legC, k);
      const an = pts[2], ft = new Path2D(); const fx = an[0], fy = an[1];
      if (L.sandal) { ft.ellipse(fx + 2.2, fy - 1.2, 4.3, 1.9, 0, 0, TAU); P.fill(ft, mix(L.skin, k - .05), fx + 2, fy - 1, 4.3, 2, .7); P.line([fx - 1.5, fy - .4, fx + 5.5, fy - .4], 1.1, '#6a4a2a'); }
      else { ft.moveTo(fx - 3, fy - bootH); ft.lineTo(fx + 2.6, fy - bootH); ft.lineTo(fx + 3.2, fy - 3.2); ft.quadraticCurveTo(fx + 7.4, fy - 2.6, fx + 7.2, fy); ft.lineTo(fx - 3.6, fy); ft.closePath(); P.fill(ft, mix(L.boot, k), fx + 1.5, fy - bootH / 2, 5, bootH / 2, .7); } };
    drawLeg(legPts(hx - 2.4, hipY, TH, SH, aB, bB), -.25);
    /* the near leg (under the tunic / skirt) */
    drawLeg(legPts(hx + 2.4, hipY, TH, SH, aA, bA), 0);
    /* torso + skirt / robe */
    const skirtSway = walk ? Math.sin(th) * 1.8 : 0;
    if (L.dress || L.robe) { const hw = (L.robe ? 13.5 : 15.5) * B, col = L.dress ? L.tun2 : L.tun;
      P.curve(p => { p.moveTo(sx - waistW, hipY - 4); p.quadraticCurveTo(-hw * .9, (hipY + hem) / 2, -hw + skirtSway * .4, hem); p.quadraticCurveTo(skirtSway, hem + 1.6, hw + skirtSway, hem - .5);
        p.quadraticCurveTo(hw * .85, (hipY + hem) / 2, sx + waistW, hipY - 4); p.closePath(); }, col, [0, (hipY + hem) / 2, hw, (hem - hipY) / 2 + 4]);
      g.save(); g.globalAlpha = .18; for (const f of [-.45, .1, .55]) P.line([sx + f * waistW, hipY, f * hw + skirtSway * .6, hem - 1], .8, '#1a120c'); g.restore(); }
    const torso = P.curve(p => { p.moveTo(sx - torsoW, shY + 1.2); p.quadraticCurveTo(sx - 1, shY - 2.2, sx + torsoW, shY + .8); p.quadraticCurveTo(sx + torsoW + 1.4, (shY + hipY) / 2, sx + waistW, hipY - 2);
      const tb = L.dress || L.robe ? hipY - 2 : hem; if (!(L.dress || L.robe)) { p.lineTo(sx + waistW + 2.2 + skirtSway * .3, tb); p.quadraticCurveTo(sx, tb + 1.4, sx - waistW - 2.2 + skirtSway * .3, tb); p.lineTo(sx - waistW, hipY - 2); } else p.lineTo(sx - waistW, hipY - 2);
      p.quadraticCurveTo(sx - torsoW - 1.2, (shY + hipY) / 2, sx - torsoW, shY + 1.2); p.closePath(); }, L.oil ? mix(L.tun, -.05) : L.tun, [sx, (shY + hem) / 2, torsoW, (hem - shY) / 2]);
    if (L.oil) { g.save(); g.globalAlpha = .28; P.line([sx - torsoW * .5, shY + 4, sx - waistW * .4, hipY + 2], 1.6, '#cfd8dc'); g.restore(); }   // the oilskin's sheen
    if (L.mail) { g.save(); g.clip(torso); g.fillStyle = 'rgba(150,156,160,.55)'; g.fillRect(sx - torsoW - 2, hipY - 3, torsoW * 2 + 4, 14); g.fillStyle = 'rgba(40,40,44,.25)'; for (let y = hipY - 2; y < hipY + 10; y += 1.6) g.fillRect(sx - torsoW - 2, y, torsoW * 2 + 4, .5); g.restore();
      P.poly([sx - torsoW * .55, shY + 1, sx + torsoW * .6, shY + .5, sx + waistW * .7, hipY + 6, sx - waistW * .65, hipY + 6], L.tun2, .7); }   // the surcoat in the house colour
    if (L.apron) P.poly([sx + waistW * .1, hipY - 4, sx + waistW + 1.2, hipY - 4, sx + waistW + 2.6, (L.dress ? hem - 8 : hipY + 9), sx + waistW * .1 - 1, (L.dress ? hem - 7 : hipY + 9.5)], L.apron, .7, .1, -.18);
    if (!L.dress) { const bl = new Path2D(); bl.rect(sx - waistW - .6, hipY - 4, waistW * 2 + 1.2, 2.6); P.fill(bl, L.belt, sx, hipY - 3, waistW, 1.3, .5); P.dot(sx + waistW * .55, hipY - 2.7, 1, '#b8a070'); }
    else P.line([sx - waistW * .9, hipY - 3.2, sx + waistW * .9, hipY - 3.2], 1.4, mix(L.tun, -.35));
    if (L.fur) for (let i = 0; i < 7; i++) { const f = i / 6, x = sx - torsoW * 1.05 + f * torsoW * 2.0, y = shY + 1.2 - Math.sin(f * Math.PI) * 2.2; P.ell(x, y, 3.3, 2.7, L.fur, 0, .5, .25, -.25); }
    /* head */
    const hcx = sx + 1.4 + stoop * .8, hcy = headCY + (L.old ? 1.2 : 0);
    P.ell(hcx + .4, hcy + hRy * .9, 3.2 * B, 2.6, mix(L.skin, -.12), 0, false);   // the neck
    if (L.hairStyle === 'long' && L.hat !== 'hood' && L.hat !== 'wrap' && L.hat !== 'kerchief') P.curve(p => { p.moveTo(hcx - hR * .2, hcy - hRy * .9); p.quadraticCurveTo(hcx - hR * 1.5, hcy, hcx - hR * 1.1, hcy + hRy * 1.6); p.lineTo(hcx - hR * .1, hcy + hRy * 1.2); p.closePath(); }, L.hair, [hcx - hR, hcy + hRy * .4, hR, hRy * 1.2], .7);
    P.ell(hcx, hcy, hR, hRy, L.skin, 0, .8, .14, -.22);
    P.ell(hcx + hR * .95, hcy + .6, 1.4, 1.9, mix(L.skin, -.06), 0, false);                       // the nose
    P.ell(hcx - hR * .25, hcy + .4, 1.4, 2.1, mix(L.skin, -.18), 0, false);                       // the ear
    P.dot(hcx + hR * .55, hcy - hRy * .12, c ? 1.05 : .85, '#20160f');                             // the eye
    g.save(); g.globalAlpha = .22; P.dot(hcx + hR * .5, hcy + hRy * .35, 1.8, '#c0504a'); g.restore();   // the cheek
    if (L.beard) P.curve(p => { p.moveTo(hcx - hR * .2, hcy + hRy * .1); p.quadraticCurveTo(hcx + hR * .2, hcy + hRy * 1.25, hcx + hR * 1.05, hcy + hRy * .55); p.quadraticCurveTo(hcx + hR * .6, hcy + hRy * .55, hcx + hR * .2, hcy + hRy * .3); p.closePath(); }, L.hair, [hcx + hR * .4, hcy + hRy * .7, hR * .6, hRy * .5], .6);
    // hair (under a hat it shows as a fringe at the back)
    if (L.hairStyle !== 'bald' || L.hat) P.curve(p => { p.moveTo(hcx + hR * .9, hcy - hRy * .35); p.quadraticCurveTo(hcx + hR * .5, hcy - hRy * 1.25, hcx - hR * .3, hcy - hRy * 1.05);
      p.quadraticCurveTo(hcx - hR * 1.25, hcy - hRy * .7, hcx - hR * 1.05, hcy + hRy * (L.hairStyle === 'short' || L.hairStyle === 'bald' ? .25 : .55)); p.quadraticCurveTo(hcx - hR * .45, hcy - hRy * .1, hcx - hR * .05, hcy - hRy * .45);
      p.quadraticCurveTo(hcx + hR * .4, hcy - hRy * .55, hcx + hR * .9, hcy - hRy * .35); p.closePath(); }, L.hair, [hcx, hcy - hRy * .6, hR, hRy * .6], .7, .22, -.3);
    if (L.hairStyle === 'bun' && !L.hat) P.ell(hcx - hR * .9, hcy - hRy * .75, 2.8, 2.6, L.hair, 0, .6);
    if (L.hairStyle === 'braid' && !L.hat) P.line([hcx - hR * .9, hcy, hcx - hR * 1.2, hcy + hRy * 1.6], 2.4, mix(L.hair, -.1));
    const hc = L.hatCol;
    if (L.hat === 'hood') P.curve(p => { p.moveTo(hcx + hR * .95, hcy - hRy * .55); p.quadraticCurveTo(hcx + hR * .55, hcy - hRy * 1.55, hcx - hR * .6, hcy - hRy * 1.25); p.quadraticCurveTo(hcx - hR * 1.65, hcy - hRy * .4, hcx - hR * 1.25, hcy + hRy * 1.25);
      p.lineTo(hcx + hR * .1, hcy + hRy * 1.3); p.quadraticCurveTo(hcx + hR * .05, hcy - hRy * .3, hcx + hR * .95, hcy - hRy * .55); p.closePath(); }, hc, [hcx, hcy - hRy * .2, hR * 1.3, hRy * 1.2], .8, .14, -.35);
    else if (L.hat === 'cap') P.curve(p => { p.moveTo(hcx - hR * 1.05, hcy - hRy * .28); p.quadraticCurveTo(hcx - hR * .8, hcy - hRy * 1.45, hcx + hR * .35, hcy - hRy * 1.3); p.quadraticCurveTo(hcx + hR * 1.2, hcy - hRy * 1.0, hcx + hR * 1.35, hcy - hRy * .45);
      p.lineTo(hcx - hR * 1.05, hcy - hRy * .28); p.closePath(); }, hc, [hcx, hcy - hRy * .8, hR, hRy * .55], .7);
    else if (L.hat === 'straw') { P.ell(hcx + .6, hcy - hRy * .62, hR * 2.15, hRy * .36, hc, -.05, .6, .2, -.25); P.ell(hcx + .2, hcy - hRy * 1.0, hR * .95, hRy * .55, hc, 0, .6, .25, -.2); P.line([hcx - hR * .85, hcy - hRy * .78, hcx + hR * 1.15, hcy - hRy * .8], 1.4, mix(hc, -.45)); }
    else if (L.hat === 'fur') { P.ell(hcx, hcy - hRy * .82, hR * 1.18, hRy * .62, hc, 0, .7, .25, -.3); g.save(); g.globalAlpha = .35; for (let i = 0; i < 6; i++) P.dot(hcx - hR * .9 + i * hR * .36, hcy - hRy * (.6 + (i % 2) * .35), .8, mix(hc, .5)); g.restore(); }
    else if (L.hat === 'wrap') { P.curve(p => { p.moveTo(hcx - hR * 1.1, hcy - hRy * .1); p.quadraticCurveTo(hcx - hR * 1.25, hcy - hRy * 1.35, hcx + hR * .2, hcy - hRy * 1.4); p.quadraticCurveTo(hcx + hR * 1.25, hcy - hRy * 1.2, hcx + hR * 1.05, hcy - hRy * .4);
        p.quadraticCurveTo(hcx, hcy - hRy * .65, hcx - hR * .4, hcy - hRy * .1); p.closePath(); }, hc, [hcx, hcy - hRy * .8, hR, hRy * .6], .7, .22, -.25);
      P.curve(p => { p.moveTo(hcx - hR * 1.0, hcy - hRy * .3); p.quadraticCurveTo(hcx - hR * 1.6, hcy + hRy * .6, hcx - hR * 1.2 - cloakSway * .4, hcy + hRy * 1.7); p.lineTo(hcx - hR * .35, hcy + hRy * 1.1); p.quadraticCurveTo(hcx - hR * .55, hcy + hRy * .2, hcx - hR * .4, hcy - hRy * .1); p.closePath(); }, mix(hc, -.08), [hcx - hR, hcy + hRy * .6, hR * .6, hRy], .6);
      g.save(); g.globalAlpha = .25; P.line([hcx - hR * .9, hcy - hRy * .75, hcx + hR * .9, hcy - hRy * 1.05], .9, '#3a2a1a'); g.restore(); }
    else if (L.hat === 'kerchief') P.curve(p => { p.moveTo(hcx + hR * .85, hcy - hRy * .45); p.quadraticCurveTo(hcx + hR * .3, hcy - hRy * 1.45, hcx - hR * .8, hcy - hRy * 1.0); p.quadraticCurveTo(hcx - hR * 1.35, hcy - hRy * .2, hcx - hR * 1.2, hcy + hRy * .55);
      p.lineTo(hcx - hR * 1.75, hcy + hRy * .95); p.lineTo(hcx - hR * .7, hcy + hRy * .4); p.quadraticCurveTo(hcx - hR * .3, hcy - hRy * .4, hcx + hR * .85, hcy - hRy * .45); p.closePath(); }, hc, [hcx, hcy - hRy * .4, hR, hRy * .7], .7);
    else if (L.hat === 'helm') { P.curve(p => { p.moveTo(hcx - hR * 1.12, hcy - hRy * .15); p.quadraticCurveTo(hcx - hR * 1.1, hcy - hRy * 1.5, hcx + hR * .1, hcy - hRy * 1.45); p.quadraticCurveTo(hcx + hR * 1.2, hcy - hRy * 1.3, hcx + hR * 1.1, hcy - hRy * .2); p.closePath(); }, hc, [hcx - hR * .3, hcy - hRy * .9, hR * .9, hRy * .7], .7, .35, -.4);
      P.ell(hcx, hcy - hRy * .18, hR * 1.45, hRy * .2, mix(hc, -.1), 0, .6, .3, -.3); P.line([hcx + hR * .75, hcy - hRy * .2, hcx + hR * .85, hcy + hRy * .35], 1.3, mix(hc, -.25)); }
    /* the near arm + its prop */
    const nsx = sx + torsoW * .4, nsy = shY + 2.8; let na = swing, nb = .3 + (walk ? .2 * Math.max(0, Math.sin(th)) : 0);
    if (L.prop === 'basket' || L.prop === 'pail') { na = .15; nb = L.prop === 'basket' ? 1.35 : .15; }
    if (L.prop === 'spear') { na = .55; nb = -1.05; }
    if (L.prop === 'staff') { na = .5; nb = -.35 + swing * .3; }
    if (L.prop === 'hoe') { na = .9; nb = -2.2; }
    if (torch && L.prop !== 'spear') { na = .75; nb = -1.6; }
    if (talk) { na = .95 + (ph % 2 ? .25 : -.05); nb = -1.1 - (ph % 2 ? .35 : 0); }
    const nArm = armPts(nsx, nsy, UP, FO, na, nb), hand = nArm[2];
    if (L.prop === 'spear') { P.line([hand[0], hand[1] + 40, hand[0], hand[1] - 52], 1.9, '#6a4a2c'); P.line([hand[0] - .5, hand[1] + 40, hand[0] - .5, hand[1] - 52], .6, 'rgba(255,240,210,.35)');
      P.poly([hand[0], hand[1] - 64, hand[0] + 2.4, hand[1] - 54, hand[0], hand[1] - 51, hand[0] - 2.4, hand[1] - 54], '#c0c6cc', .6, .35, -.35); }
    if (L.prop === 'staff') P.line([hand[0] + .5, hand[1] - 10, hand[0] + 2.5, 0], 2.2, '#6a4e32');
    if (L.prop === 'hoe') { const a = [hand[0] - 26, hand[1] + 22], b = [hand[0] + 12, hand[1] - 14]; P.line([a[0], a[1], b[0], b[1]], 2, '#7a5a38'); P.poly([b[0] - 1, b[1] - 1, b[0] + 5, b[1] + 7, b[0] + 2.5, b[1] + 8, b[0] - 2.5, b[1] + 1.5], '#8a8e90', .6); }
    if (L.prop === 'sack') P.ell(sx - torsoW * .9, shY - 1.5, 7.2, 6.5, '#b8a47e', -.3, .8, .2, -.35);
    if (L.prop === 'bundle') { for (let i = 0; i < 4; i++) P.line([sx - torsoW - 6, shY + 6 - i * 2.2, sx + 3, shY - 5 - i * 2.2], 2.2, ['#6a4a2a', '#7a5a36', '#5a3e24', '#8a6a44'][i]); P.line([sx - 4, shY + 3, sx - 3, shY - 8], 1.2, '#3a2a1a'); }
    P.limb(nArm, 6.6 * B, 5.2 * B, L.mail ? '#8a8e92' : L.tun, L.mail ? 0 : -.04); P.ell(hand[0], hand[1], 2.9, 2.9, mix(L.skin, -.04), 0, .6);
    if (L.prop === 'basket') { const bx = hand[0] + 1, by = hand[1] + 5; P.curve(p => { p.moveTo(bx - 7, by - 3); p.lineTo(bx + 7, by - 3); p.quadraticCurveTo(bx + 6.5, by + 6, bx, by + 6.5); p.quadraticCurveTo(bx - 6.5, by + 6, bx - 7, by - 3); p.closePath(); }, '#b08a52', [bx, by + 1.5, 7, 4.5], .7, .25, -.35);
      g.save(); g.globalAlpha = .35; for (let i = -5; i <= 5; i += 2.5) P.line([bx + i, by - 2.5, bx + i * .8, by + 5.5], .6, '#5a4024'); g.restore(); P.dot(bx - 3, by - 3.6, 2.2, '#b8402e'); P.dot(bx + 1, by - 4.2, 2.2, '#c9a03a'); P.dot(bx + 4, by - 3.4, 2, '#6a8a3a');
      P.line([bx - 6, by - 3, bx, by - 11, bx + 6, by - 3], .9, '#8a6a3a'); }
    if (L.prop === 'pail') { const bx = hand[0], by = hand[1] + 7; P.poly([bx - 4.5, by - 3.5, bx + 4.5, by - 3.5, bx + 3.6, by + 5, bx - 3.6, by + 5], '#8a6a46', .7); P.line([bx - 4.4, by - 1, bx + 4.4, by - 1], .9, '#4a4440'); P.line([bx - 4.5, by - 3.5, bx, by - 8, bx + 4.5, by - 3.5], .7, '#4a4440'); }
    if (torch) { const tx = hand[0] + (L.prop === 'spear' ? -9 : .5), ty = hand[1] + (L.prop === 'spear' ? 12 : 0), top = [tx + 2.2, ty - 15];
      if (L.prop === 'spear') P.dot(tx, ty, 2.3, mix(L.skin, -.1));
      P.line([tx, ty + 3, top[0], top[1]], 2.1, '#5a3e24'); P.line([top[0] - 1.6, top[1] + 1.5, top[0] + 1.6, top[1] + 1.5], 2.6, '#3a2a1a');
      const fx = top[0] + .3, fy = top[1] - 4.5, halo = g.createRadialGradient(fx, fy, 0, fx, fy, 15); halo.addColorStop(0, 'rgba(255,200,110,.5)'); halo.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = halo; g.fillRect(fx - 15, fy - 15, 30, 30);
      const fl = new Path2D(), k = ph % 2 ? 1 : -1; fl.moveTo(fx - 3.6, fy + 3); fl.quadraticCurveTo(fx - 4.6, fy - 2, fx + k * .8, fy - 9.5); fl.quadraticCurveTo(fx + 4.4, fy - 2.5, fx + 3.4, fy + 3); fl.quadraticCurveTo(fx, fy + 5, fx - 3.6, fy + 3);
      const gr = g.createLinearGradient(fx, fy + 4, fx, fy - 9); gr.addColorStop(0, '#ff8a2a'); gr.addColorStop(.5, '#ffc04a'); gr.addColorStop(1, 'rgba(255,240,170,.85)'); g.fillStyle = gr; g.fill(fl); P.ell(fx, fy, 1.6, 2.6, '#fff4c8', 0, false, 0, 0); }
    return { hipY, shY };
  }
  /* ---- frame cache: per look → anim|phase|face|torch ---- */
  const looks = new Set(); let nCanvas = 0;
  F.cacheSize = () => nCanvas;
  F.frameAt = (L, anim, ph, face, torch) => {
    if (!L) return null; anim = anim === 'walk' || anim === 'talk' ? anim : 'idle'; const n = anim === 'walk' ? 6 : 2; ph = ((ph | 0) % n + n) % n; face = face < 0 ? -1 : 1; torch = torch ? 1 : 0;
    const C = L.cache || (L.cache = {}), key = anim + ph + (face < 0 ? 'l' : 'r') + torch; if (C[key]) return C[key];
    const s = L.H * F.PXU / 100, cw = Math.ceil(CWN * s), ch = Math.ceil((TOPN + BOTN) * s), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; g.translate(cw / 2, ch - BOTN * s); g.scale(s * face, s);
    try { paintFigure(g, L, anim, ph, face, torch); } catch (e) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#6a5a48'; g.fillRect(cw * .35, ch * .3, cw * .3, ch * .6); if (!F.warned) { F.warned = 1; console.warn('townsfolk paint', e); } }
    cv.meta = { ax: cw / 2, ay: ch - BOTN * s, h: L.H * F.PXU, sc: s }; cv.units = { w: cw / F.PXU, h: ch / F.PXU }; cv.anchor = { x: .5, y: (ch - BOTN * s) / ch };
    C[key] = cv; nCanvas++; looks.add(L); return cv; };
  const dropLook = L => { if (L && L.cache) { nCanvas -= Object.keys(L.cache).length; L.cache = null; looks.delete(L); } };

  /* ---- spawning ---- */
  const SPD = { walker: 40, guard: 30, child: 92, merchant: 30, elder: 26 };
  function frameOf(e, anim, face) { anim = e.anim2 || anim || e.anim; const L = e.look;
    const ph = anim === 'walk' ? Math.floor(e.wph || 0) : anim === 'talk' ? Math.floor(R.t * 3.2 + e.seed) : Math.floor(R.t * .55 + e.seed);
    return F.frameAt(L, anim, ph, face == null ? e.face : face, !!e.torch); }
  function makeOne(pl, role, at, seed) {
    const L = F.look({ seed, role, style: pl.style }), e = R.spawn({ kind: 'folk', type: 'folk', sprite: 'folk', name: '', team: 2, x: at.x, y: at.y, r: L.child ? 7 : 10, hp: 1, hpMax: 1, lvl: 1,
      noLoot: true, noBar: true, invuln: true, noCollide: true, ambient: true, noPhys: true, role, look: L, poi: pl.id, bbH: L.H, face: rnd() < .5 ? -1 : 1, fade: 0, seed: rnd() * 10,
      spd: SPD[role] * (.88 + rnd() * .24), wph: rnd() * 6, ai: { st: 'idle', t: 0, until: R.t + .5 + rnd() * 3, tx: at.x, ty: at.y, stuck: 0, home: at } });
    e.frame = (anim, t, face) => frameOf(e, anim, face);
    pl.ents.push(e); return e; }
  const spotFor = (pl, e, near) => { const S = pl.spots; if (!S.length) return null; let s = near || S[Math.floor(rnd() * S.length)];
    const q = randIn(pl, s.x, s.y, s.tag === 'gate' ? 18 : 26, 10); return q || { x: s.x, y: s.y }; };
  F.spawnAt = (poiId, o) => {
    o = o || {}; if (F.places[poiId]) F.despawn(poiId);
    const p = typeof poiId === 'object' ? poiId : poiById(poiId); if (!p) return null; const pl = layout(p); F.places[p.id] = pl;
    pl.night = o.night != null ? !!o.night : night(); const n = o.n || F.countFor(p, pl.night), r = mkRng(hash('folk:' + p.id + ':' + Math.floor(R.t / 600)));
    const roles = [];
    if (pl.gate && p.type !== 'camp') { roles.push('guard'); if (n >= 7) roles.push('guard'); }
    if (pl.market && !pl.night && (p.shop || p.type === 'town' || p.seat || r() < .6)) roles.push('merchant');
    if (!pl.night) { const kids = n >= 12 ? 3 : n >= 9 ? 2 : 1; for (let i = 0; i < kids; i++) roles.push('child'); }
    if (r() < .6) roles.push('elder');
    while (roles.length < n) roles.push('walker'); roles.length = n;
    let k = 0, pairs = 0;
    for (const role of roles) {
      let at = null;
      if (role === 'guard') { const side = k++ % 2 ? 1 : -1, px = -pl.gateDir.y * 22 * side, py = pl.gateDir.x * 22 * side; at = settle(pl, pl.gate.x + px, pl.gate.y + py, 8) || spotFor(pl, null, pl.gate); }
      else if (role === 'merchant') at = settle(pl, pl.market.x, pl.market.y + 10, 8);
      else at = spotFor(pl);
      if (!at) continue;
      const e = makeOne(pl, role, at, hash(p.id + ':' + role + ':' + pl.ents.length + ':' + Math.floor(r() * 1e6)));
      if (role === 'guard') { e.ai.post = { x: at.x, y: at.y }; e.face = pl.gateDir.x >= 0 ? 1 : -1; e.ai.st = 'post'; e.ai.until = R.t + 8 + rnd() * 10; }
      if (role === 'merchant') { e.ai.post = { x: at.x, y: at.y }; e.ai.st = 'post'; e.face = pl.x >= at.x ? 1 : -1; e.callT = R.t + 2 + rnd() * 6; }
      if (role === 'walker' && pairs < 2 && pl.ents.filter(q => q.role === 'walker').length >= 2 && rnd() < .7) {   // a pair already talking when the hero arrives
        const a = pl.ents.filter(q => q.role === 'walker' && q !== e && q.ai.st !== 'chat')[0]; if (a) { const q = settle(pl, a.x + 24, a.y + 4, 6); if (q) { e.x = q.x; e.y = q.y; startChat(a, e, 8 + rnd() * 8); pairs++; } } }
      if (pl.night && (role === 'guard' || (role === 'walker' && rnd() < .4))) e.torch = torchOf(e);
    }
    return pl; };
  const torchOf = e => ({ z: e.bbH * .9, dx: e.bbH * .2, r: 130, col: '#ffb25a', k: 1 });
  F.despawn = poiId => { const pl = F.places[poiId]; if (!pl) return; for (const e of pl.ents) { R.remove(e); dropLook(e.look); } delete F.places[poiId]; };
  F.list = () => { const out = []; for (const k in F.places) for (const e of F.places[k].ents) if (!e.dead && !e.gone) out.push(e); return out; };

  /* ---- talk ---- */
  const GEN = [['Bread went up again.', 'It always does when the wind turns.'], ['Did you see the stranger with the sword?', 'Hard to miss. Walks like trouble.'], ['My roof leaks in three places now.', 'Only three? Count yourself lucky.'],
    ['The miller swears he saw lights on the hill.', 'The miller swears at everything.'], ['Heard the road east is safe again.', 'Safe for whom, is my question.'], ['My boy wants to be a knight.', 'Mine wants to be a cook. Wiser.'],
    ['Market day tomorrow, or the day after?', 'Tomorrow. Bring your own sack.'], ['That dog stole a whole ham.', 'Then it ate better than me.'], ['Rain by evening, you mark me.', 'Your knee told you again?'],
    ['The well rope snapped this morning.', 'Third time this moon.'], ['They say the lord has guests coming.', 'Then the kitchens will be hell.'], ['Have you paid the tithe yet?', 'Do not remind me.'],
    ['Something howled out past the fields.', 'Wind in the old mill, nothing more.'], ['The new ale is thin.', 'Thin, but it is cheap.'], ['My sister wed a fisherman.', 'Then you will never want for supper.']];
  const REGL = { north: [['Snow by the next moon, maybe sooner.', 'Then we stack the wood higher.'], ['The springs kept the yard warm all night.', 'Warmer than my bed.'], ['Old Nan says the cold has teeth this year.', 'Old Nan says that every year.']],
    reach: [['The apples came in sweet this year.', 'Sweet enough to sell twice.'], ['Wagons for the harvest fair already.', 'And not one of them for us.'], ['Roses everywhere and still no bread.', 'You cannot eat a rose, they say.']],
    dorne: [['Too hot to haggle today.', 'Then haggle in the shade.'], ['Water first, then talk.', 'Wise. The sun listens to nobody.'], ['The sand got into the figs again.', 'Crunchy figs, a local treat.']],
    iron: [['The boats came back light.', 'The sea keeps what it wants.'], ['Salt in my bread, salt in my beard.', 'Salt in your soul, more like.'], ['Nets to mend before the tide.', 'Then stop talking and mend.']],
    west: [['They found a new seam under the hill.', 'And none of it for us, I wager.'], ['Gold on the banners, mud on our boots.', 'Such is the order of things.'], ['A good year for the vintners.', 'A good year for the drunks too.']],
    river: [['The river rose a hand overnight.', 'Move the barrels up, then.'], ['Fish are biting near the ford.', 'So are the midges.'], ['Ferryman wants double now.', 'Then swim, if you are so proud.']],
    storm: [['Another gale coming off the bay.', 'Tie the shutters, then.'], ['The sea wall cracked again.', 'It cracks. It holds. It always has.'], ['Lightning hit the old oak.', 'Good, it was ugly.']],
    wall: [['Cold enough to crack the ink.', 'Then write shorter letters.'], ['Rangers back yet?', 'Two of three. Same as always.'], ['Mind the ice on the stair.', 'I mind it every morning, on my back.']],
    vale: [['The path up the mountain froze again.', 'Mules hate it more than we do.'], ['Wool prices are good this year.', 'For the sheep, maybe.']],
    crown: [['The city smells worse every summer.', 'You get used to it. Mostly.'], ['Ships from the east in the bay.', 'Silks for them, fish for us.']],
    ash: [['Ash on the washing again.', 'Then wash it again.'], ['The mountain rumbled last night.', 'It does that. Sleep through it.']],
    beyond: [['The fire is all that matters out here.', 'That and the next fire.'], ['Wolves followed the hunters back.', 'Then the hunters can stand watch.']] };
  const NIGHT = [['Late to be out.', 'Late is when the work gets done.'], ['Keep that torch steady.', 'Steady as I can, with this wind.'], ['Heard footsteps on the road.', 'Just the watch, I hope.']];
  const CALLS = { def: ['Fresh bread, still warm!', 'Onions, turnips, honest prices!', 'Rope, nails, needles, thread!', 'Come, look, no charge for looking!', 'Eggs! Eggs this morning!'],
    north: ['Smoked trout from the lake!', 'Wool mittens, good and thick!'], reach: ['Apples, pears, plums!', 'Honeycakes, a penny each!'], dorne: ['Blood oranges, cool from the cellar!', 'Dates and figs, sweet as sin!'],
    iron: ['Salted cod, a whole barrel!', 'Tar and rope for your boat!'], west: ['Copper pots, polished bright!', 'Red wine from the hills!'], river: ['Eels, fresh from the weir!', 'Crayfish, still snapping!'],
    storm: ['Pickled herring, last jar!', 'Lamp oil for the long nights!'], wall: ['Hot broth, warm your hands!', 'Furs, patched but sound!'], vale: ['Goat cheese from the high pastures!'], crown: ['Spices from across the sea!', 'Pies! Pies of every kind!'],
    ash: ['Smoked fish and sea salt!'], beyond: ['Furs for trade!'] };
  F.lines = region => { const k = REG[String(region || '')] || 'crown'; return { pairs: (REGL[k] || []).concat(GEN), night: NIGHT, calls: (CALLS[k] || []).concat(CALLS.def) }; };
  F.LINES = { GEN, REGL, NIGHT, CALLS };
  function startChat(a, b, dur) { const until = R.t + dur; a.ai.st = b.ai.st = 'chat'; a.ai.until = b.ai.until = until; a.ai.mate = b; b.ai.mate = a; a.anim = b.anim = 'idle';
    a.face = b.x >= a.x ? 1 : -1; b.face = a.x >= b.x ? 1 : -1; a.ai.lead = true; b.ai.lead = false; }
  const say = (e, txt, s) => { e.bub = { txt, until: R.t + (s || 3.6), t0: R.t }; e.talkUntil = R.t + Math.min(2.4, s || 3.6); };

  /* ---- behaviour ---- */
  const moveTo = (e, pl, dt, spd) => { const a = e.ai, dx = a.tx - e.x, dy = a.ty - e.y, d = Math.hypot(dx, dy); if (d < 3) return true;
    let mx = dx / d, my = dy / d; const P = R.player;
    if (P) { const hx = e.x - P.x, hy = e.y - P.y, hd = Math.hypot(hx, hy); if (hd < 34 && hd > .1) { const k = (34 - hd) / 34 * 1.4; mx += hx / hd * k; my += hy / hd * k; const m = Math.hypot(mx, my) || 1; mx /= m; my /= m; } }
    const st = Math.min(d, spd * dt), nx = e.x + mx * st, ny = e.y + my * st;
    if (okStep(pl, e.x, e.y, nx, ny)) { e.x = nx; e.y = ny; a.stuck = 0; } else if (okStep(pl, e.x, e.y, nx, e.y)) { e.x = nx; a.stuck += .5; } else if (okStep(pl, e.x, e.y, e.x, ny)) { e.y = ny; a.stuck += .5; } else a.stuck++;
    if (Math.abs(mx) > .15) e.face = mx < 0 ? -1 : 1;
    e.wph = ((e.wph || 0) + st / (e.look.H * (e.look.child ? .62 : .78)) * 6) % 6;
    return a.stuck > 20 || d <= st + 2; };
  const wander = (e, pl) => { const a = e.ai; let q = null;
    if (e.role === 'child') { const mate = rnd() < .45 && pl.ents.find(o => o !== e && o.role === 'child' && !o.dead); if (mate) q = randIn(pl, mate.x, mate.y, 30, 6); if (!q) q = randIn(pl, pl.x, pl.y, pl.sr * .7, 10); }
    else if (e.role === 'elder') q = spotFor(pl, null, rnd() < .6 ? pl.well || null : null);
    else q = spotFor(pl);
    if (!q) return false; a.tx = q.x; a.ty = q.y; a.st = 'walk'; a.t = 0; a.stuck = 0; return true; };
  function think(e, pl, dt, C) {
    const a = e.ai; a.t += dt; e.anim2 = null;
    if (e.leaving) { e.fade -= dt * 1.5; if (e.fade <= 0) { e.gone = true; return; } }
    else if (e.fade < 1) e.fade = Math.min(1, e.fade + dt * 1.6);
    if (e.torch) e.torch.k = .82 + .18 * Math.sin(R.t * 13 + e.seed * 7) * Math.sin(R.t * 5.3 + e.seed);
    if (e.torch) e.torch.dx = Math.abs(e.torch.dx) * (e.face < 0 ? -1 : 1);
    if (a.st === 'post') { e.anim = 'idle';
      if (e.role === 'merchant') { e.face = (C.px >= e.x ? 1 : -1); if (R.t >= e.callT) { e.callT = R.t + 12 + rnd() * 8; if (C.d2 < F.CALL_R * F.CALL_R) { const L = pl.lines.calls; say(e, L[Math.floor(rnd() * L.length)], 3.4); } } if (e.talkUntil > R.t) e.anim2 = 'talk'; return; }
      if (R.t >= a.until) { const side = rnd() < .5 ? -1 : 1, q = settle(pl, a.post.x - pl.gateDir.y * 14 * side, a.post.y + pl.gateDir.x * 14 * side, 4); if (q) { a.tx = q.x; a.ty = q.y; a.st = 'shift'; a.t = 0; } else a.until = R.t + 10; }
      return; }
    if (a.st === 'shift') { e.anim = 'walk'; if (moveTo(e, pl, dt, e.spd) || a.t > 4) { a.tx = a.post.x; a.ty = a.post.y; a.st = 'back'; a.t = 0; } return; }
    if (a.st === 'back') { e.anim = 'walk'; if (moveTo(e, pl, dt, e.spd) || a.t > 4) { a.st = 'post'; a.until = R.t + 10 + rnd() * 12; e.face = pl.gateDir.x >= 0 ? 1 : -1; e.anim = 'idle'; } return; }
    if (a.st === 'chat') { e.anim = 'idle'; if (e.talkUntil > R.t) e.anim2 = 'talk'; const m = a.mate;
      if (!m || m.gone || m.dead || m.ai.mate !== e) { a.st = 'idle'; a.until = R.t + 1; a.mate = null; return; }
      e.face = m.x >= e.x ? 1 : -1; if (R.t >= a.until) { a.st = 'idle'; a.until = R.t + 1 + rnd() * 2; a.mate = null; } return; }
    if (a.st === 'idle') { e.anim = 'idle'; if (R.t >= a.until && !wander(e, pl)) a.until = R.t + 2; return; }
    if (a.st === 'walk') { e.anim = 'walk';
      if (moveTo(e, pl, dt, e.spd) || a.t > 14) { e.anim = 'idle'; a.st = 'idle'; a.until = R.t + (e.role === 'child' ? .4 + rnd() * 1.2 : 2 + rnd() * 4.5);
        if (e.role === 'walker' && rnd() < .55) { const m = pl.ents.find(o => o !== e && o.role === 'walker' && (o.ai.st === 'idle') && !o.leaving && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 70 * 70);
          if (m) { const q = settle(pl, m.x + (e.x < m.x ? -22 : 22), m.y + 3, 5); if (q) { e.x = q.x; e.y = q.y; } startChat(e, m, 7 + rnd() * 8); } } } } }

  /* ---- the system ---- */
  let checkT = 0, chatT = 3;
  function syncPlaces(P) {
    const isN = night(), list = [];
    for (const p of pois()) { if (!F.isPlace(p)) continue; const d2 = (p.x - P.x) ** 2 + (p.y - P.y) ** 2; if (F.places[p.id] || d2 < F.NEAR * F.NEAR) list.push({ p, d2 }); }
    list.sort((a, b) => a.d2 - b.d2);
    const keep = {}; let alive = 0;
    for (const { p, d2 } of list) { const have = F.places[p.id];
      if (have) { if (d2 > F.FAR * F.FAR || alive >= F.MAX_PLACES) { F.despawn(p.id); continue; } keep[p.id] = 1; alive++; if (have.night !== isN) nightTurn(have, isN); continue; }
      if (alive < F.MAX_PLACES && d2 < F.NEAR * F.NEAR) { F.spawnAt(p.id); keep[p.id] = 1; alive++; } }
    for (const id in F.places) if (!keep[id] && !(list.find(q => q.p.id === id))) F.despawn(id);
    for (const id in F.places) { const pl = F.places[id]; pl.npcs = npcSpots(id).map(n => ({ x: n.x, y: n.y }));   // the quest NPCs may spawn after the people
      if (pl.npcs.length) for (const e of pl.ents) { if (e.leaving || e.ai.st === 'walk' || e.ai.st === 'shift' || e.ai.st === 'back') continue;
        const n = pl.npcs.find(n => (n.x - e.x) ** 2 + (n.y - e.y) ** 2 < 34 * 34); if (!n) continue;
        if (e.ai.post) { const d = Math.hypot(e.x - n.x, e.y - n.y) || 1, q = settle(pl, n.x + (e.x - n.x) / d * 46, n.y + (e.y - n.y) / d * 46, 8); if (q) { e.ai.post = q; e.ai.tx = q.x; e.ai.ty = q.y; e.ai.st = 'back'; e.ai.t = 0; } }
        else { if (e.ai.mate) { e.ai.mate.ai.mate = null; e.ai.mate = null; } wander(e, pl); } } }
  }
  // dusk / dawn while the hero is there: the surplus walks home and fades, newcomers step out of the doors, torches are lit / put out
  function nightTurn(pl, isN) { pl.night = isN; const want = F.countFor(pl.poi, isN), alive = pl.ents.filter(e => !e.leaving);
    if (alive.length > want) { const xs = alive.filter(e => e.role !== 'guard' && e.role !== 'merchant').slice(0, alive.length - want); for (const e of xs) e.leaving = true; }
    if (isN) for (const e of pl.ents) { if (e.role === 'merchant') e.leaving = true; }
    else for (let i = alive.length; i < want; i++) { const d = pl.doors[Math.floor(rnd() * pl.doors.length)] || pl.spots[0]; if (!d) break; const role = i % 4 === 0 ? 'child' : 'walker'; makeOne(pl, role, { x: d.x, y: d.y }, hash(pl.id + ':day:' + i + ':' + Math.floor(R.t))); }
    for (const e of pl.ents) { if (isN && !e.leaving && (e.role === 'guard' || (e.role === 'walker' && rnd() < .4))) e.torch = torchOf(e); else if (!isN) e.torch = null; } }
  function update(dt) {
    const P = R.player; if (!P || !R.state) return;
    const t0 = performance.now();
    if (R.t >= checkT) { checkT = R.t + .5; try { syncPlaces(P); } catch (e) { if (!F.warnS) { F.warnS = 1; console.warn('townsfolk sync', e); } } }
    let n = 0; const C = { px: P.x, py: P.y, d2: 0 };
    for (const id in F.places) { const pl = F.places[id]; if (!pl.lines) pl.lines = F.lines(pl.poi.region);
      for (let i = pl.ents.length - 1; i >= 0; i--) { const e = pl.ents[i];
        if (e.gone || e.dead) { R.remove(e); dropLook(e.look); pl.ents.splice(i, 1); continue; }
        C.d2 = (e.x - P.x) ** 2 + (e.y - P.y) ** 2; think(e, pl, dt, C); n++;
        if (e.bub && R.t > e.bub.until) e.bub = null; } }
    // one pair speaks every ~10 s: the nearest chatting pair within CHAT_R, the lead first, the answer 3.8 s later
    chatT -= dt;
    if (chatT <= 0) { chatT = F.CHAT_EVERY * (.85 + rnd() * .3); let best = null, bd = F.CHAT_R * F.CHAT_R;
      for (const id in F.places) for (const e of F.places[id].ents) if (e.ai.st === 'chat' && e.ai.lead && !e.leaving) { const d2 = Math.min((e.x - P.x) ** 2 + (e.y - P.y) ** 2, (e.ai.mate.x - P.x) ** 2 + (e.ai.mate.y - P.y) ** 2); if (d2 < bd) { bd = d2; best = e; } }
      if (best) { const pl = F.places[best.poi], L = night() ? pl.lines.night.concat(pl.lines.pairs.slice(0, 4)) : pl.lines.pairs, pr = L[Math.floor(rnd() * L.length)];
        say(best, pr[0], 3.6); best.ai.reply = { t: R.t + 3.8, txt: pr[1] }; best.ai.until = Math.max(best.ai.until, R.t + 8.5); best.ai.mate.ai.until = best.ai.until; F.lastChat = { a: best.id, b: best.ai.mate.id, txt: pr, t: R.t }; } else chatT = 1.5; }
    for (const id in F.places) for (const e of F.places[id].ents) { const rp = e.ai.reply; if (rp && R.t >= rp.t) { e.ai.reply = null; if (e.ai.mate && !e.ai.mate.gone) say(e.ai.mate, rp.txt, 3.4); } }
    F.stats.ms = performance.now() - t0; F.stats.n = n;
  }

  /* ---- drawing on the overlay: bubbles, the torch glow (until the renderer lights them), the figures without WebGL ---- */
  function bubble(ctx, sx, sy, txt, a) {
    ctx.font = '600 11px "EB Garamond",Georgia,serif'; const w = Math.min(176, ctx.measureText(txt).width + 14), h = 19, x = Math.round(sx - w / 2), y = Math.round(sy - h);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(246,238,220,.93)'; ctx.strokeStyle = 'rgba(60,44,28,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 7); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 4, y + h - .5); ctx.lineTo(sx + 4, y + h - .5); ctx.lineTo(sx + 1, y + h + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2018'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let t = txt; while (t.length > 4 && ctx.measureText(t).width > w - 10) t = t.slice(0, -2); if (t !== txt) t = t.slice(0, -1) + '…';
    ctx.fillText(t, sx, y + h / 2 + .5); ctx.globalAlpha = 1; }
  let glowCv = null;
  const glow = () => { if (glowCv) return glowCv; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,140,.9)'); gr.addColorStop(.25, 'rgba(255,170,80,.45)'); gr.addColorStop(1, 'rgba(255,140,50,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return glowCv = c; };
  function draw(ctx) {
    const L = F.list(); if (!L.length) return;
    const gl = !!R.render3d, z = R.cam.z || 1;
    if (!gl) for (const e of L.slice().sort((a, b) => a.y - b.y)) { const s = R.w2s(e.x, e.y, 0); if (s.x < -80 || s.y < -40 || s.x > R.vw + 80 || s.y > R.vh + 160) continue;
      const c = e.frame(e.anim, e.animT, e.face); if (!c) continue; const k = z / F.PXU; ctx.globalAlpha = e.fade == null ? 1 : e.fade;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 10 * z, 3.5 * z, 0, 0, TAU); ctx.fill(); ctx.drawImage(c, s.x - c.meta.ax * k, s.y - c.meta.ay * k, c.width * k, c.height * k); }
    ctx.globalAlpha = 1;
    const nk = R.ambience && R.ambience.nightK != null ? R.ambience.nightK : night() ? 1 : 0;
    if (F.glow2d && nk > .05 && !(R.render3d && R.render3d.torchLights)) { const spr = glow(); ctx.globalCompositeOperation = 'lighter';
      for (const e of L) { if (!e.torch) continue; const f = R.w2s(e.x, e.y, 0), top = R.w2s(e.x, e.y, e.torch.z); if (f.behind || top.behind) continue; const pu = Math.max(.15, (f.y - top.y) / e.torch.z);
        const sx = top.x + e.torch.dx * pu, sy = top.y; if (sx < -100 || sy < -100 || sx > R.vw + 100 || sy > R.vh + 100) continue; const r = 46 * pu * (.9 + .1 * e.torch.k);
        ctx.globalAlpha = .75 * nk * (e.fade == null ? 1 : e.fade) * e.torch.k; ctx.drawImage(spr, sx - r, sy - r, r * 2, r * 2); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    for (const e of L) { if (!e.bub) continue; const f = R.w2s(e.x, e.y, 0), top = R.w2s(e.x, e.y, e.bbH + 10); if (f.behind || top.behind) continue;
      const sy = top.x === f.x && top.y === f.y ? f.y - (e.bbH + 10) * z : top.y; const age = R.t - e.bub.t0, left = e.bub.until - R.t, a = Math.min(1, age * 5, left * 3);
      if (a > 0) bubble(ctx, top.x, sy, e.bub.txt, a); }
  }
  R.addSys('townsfolk', { order: 66, update });
  R.addSys('townsfolkDraw', { order: 908, draw });   // after the renderer clears the overlay (900) and the ambience tint (907)
  R.bus.on('remove', e => { if (e && e.kind === 'folk') e.gone = true; });
})();
