// RPG A46 wildlife: over a fake R.world (7 biome cells + an empty one, a river / sea / rock column, a castle, a town, a camp) every biome
// spawns its own species (≤ 14), deer flee at 160, ravens perch on the castle and launch, wolves only at night and never attack (howls below
// level 5), shadowcat eyes only at night and vanish when approached, every species' frames are non-blank canvases ≤ 40 px tall, a hit makes
// the animal flee + 'critterHit', banners / smoke / fish jumps / the mammoth, everything despawns 2000 units away, 14 critters × 600 steps < 150 ms.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_wildlife.js   (RPG_HTML=path overrides)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', '..', process.env.RPG_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.wildlife && R.sys.wildlife, { timeout: 20000 }); await page.waitForTimeout(200);

  const r = await page.evaluate(() => {
    const W = R.wildlife, S = R.sys.wildlife, out = {}, steps = n => { for (let i = 0; i < n; i++) R.step(); };
    R.stop(); if (R.ui && R.ui.cur) R.ui.close(); R.paused = false;
    /* ---- the fake world: 1200-unit cells, row 0 north | reach | crownlands | riverlands, row 1 dorne | coast | beyond | (no region) ---- */
    const C = 1200, cells = [['north', 0, 0], ['reach', 1, 0], ['crownlands', 2, 0], ['riverlands', 3, 0], ['dorne', 0, 1], ['coast', 1, 1], ['beyond', 2, 1]];
    const regions = cells.map(([b, cx, cy]) => ({ id: 'r_' + b, name: b, biome: b, lvl: [1, 5], cx: cx * C, cy: cy * C }));
    const centre = b => { const c = cells.find(c => c[0] === b); return { x: c[1] * C + C / 2, y: c[2] * C + C / 2 }; };
    const pois = [{ id: 'wf', name: 'Winterfell', type: 'castle', x: 600, y: 300, house: 'stark', seat: true }, { id: 'town1', name: 'Barrowton', type: 'town', x: 1800, y: 900 },
      { id: 'camp1', name: 'Camp', type: 'camp', x: 3000, y: 900 }, { id: 'kl', name: "King's Landing", type: 'castle', x: 3000, y: 300, house: 'baratheon' }];
    const WATER = [[4380, 4440], [1500, 1560], [300, 360]];                   // a river in the riverlands, the sea on the coast, rocks in dorne (all blocked)
    const blocked = (x, y) => x < 0 || y < 0 || x >= 4 * C || y >= 2 * C || WATER.some(([a, b]) => x >= a && x < b);
    const inPoi = (x, y, r) => pois.find(p => (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) || null;
    R.data.world = { size: [4 * C, 2 * C], regions, pois, roads: [], mask: null };
    R.world = { populate: true, regions: () => regions, pois: () => pois, poi: id => pois.find(p => p.id === id) || null, size: () => [4 * C, 2 * C],
      regionAt: (x, y) => regions.find(g => x >= g.cx && x < g.cx + C && y >= g.cy && y < g.cy + C) || null, blocked, walkable: (x, y) => !blocked(x, y),
      inWorld: (x, y) => x >= 0 && y >= 0 && x < 4 * C && y < 2 * C, poiAt: (x, y, r) => inPoi(x, y, r == null ? 90 : r), inPoi: (x, y, r) => inPoi(x, y, r == null ? 160 : r),
      spawnAround: (x, y, n, o) => { const rng = (o && o.rng) || Math.random, min = o && o.min != null ? o.min : 200, max = o && o.max != null ? o.max : 600, safe = o && o.safe != null ? o.safe : 160, L = [];
        for (let t = 0; t < 40 * n && L.length < n; t++) { const a = rng() * Math.PI * 2, d = min + (max - min) * rng(), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (blocked(px, py) || inPoi(px, py, safe)) continue; L.push({ x: Math.round(px), y: Math.round(py) }); } return L; },
      slide: (e, dx, dy) => { let m = false; if (dx && !blocked(e.x + dx, e.y)) { e.x += dx; m = true; } if (dy && !blocked(e.x, e.y + dy)) { e.y += dy; m = true; } return m; } };
    if (!R.ambience) R.ambience = { night: false };
    const setNight = on => { if (typeof R.ambience.setHour === 'function') R.ambience.setHour(on ? 23 : 12); R.ambience.night = !!on; };
    R.state = R.newState(); R.state.p.lvl = 1; R.ents.length = 0;
    const pl = R.player = R.spawn({ kind: 'player', team: 0, x: 600, y: 600, r: 16, hp: 300, hpMax: 300, lvl: 1, name: 'me', keep: true });
    const clear = () => { for (const e of R.ents.slice()) if (e.kind === 'critter') R.remove(e); W.puffs.length = 0; W.rings.length = 0; };
    const put = (x, y) => { pl.x = x; pl.y = y; pl.vx = pl.vy = 0; };
    const species = () => { const m = {}; for (const e of W.list()) m[e.species] = (m[e.species] || 0) + 1; return m; };
    const hits = []; R.bus.on('critterHit', (e, src) => hits.push(e.species)); const howls = []; R.bus.on('howl', e => howls.push(e.id));
    const pop = (seed) => { R.rng(seed || 7); return W.populateNow(R.rng); };

    /* ---- every biome by day ---- */
    out.day = {}; out.bad = [];
    for (const [b] of cells) { const c = centre(b); clear(); put(c.x, c.y); setNight(false); const n = pop(11 + b.length); const L = W.list(); const ids = W.describe(b).map(d => d.id);
      out.day[b] = { n, alive: L.length, sp: species() };
      for (const e of L) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (e.kind !== 'critter' || e.team !== 2 || !e.noLoot || typeof e.frame !== 'function' || !ids.includes(e.species) || d > 620 || d < 100 || blocked(e.x, e.y)) out.bad.push(b + ':' + e.species + ':' + Math.round(d)); }
      if (L.length > 14 || L.length < 1) out.bad.push(b + ':count:' + L.length); }
    out.descr = {}; for (const b of Object.keys(W.BIOMES)) out.descr[b] = W.describe(b).map(d => d.id);
    out.biomeOf = [W.biomeOf({ biome: 'The Gift' }), W.biomeOf({ id: 'lands_of_always_winter' }), W.biomeOf('iron_islands'), W.biomeOf({ name: 'Dorne' }), W.biomeOf({ id: 'riverlands' }), W.biomeOf({ name: 'The Crownlands' }), W.biomeOf({ name: 'The Reach' }), W.biomeOf(null)];

    /* ---- night: wolves in the north, eyes beyond, no butterflies in the reach ---- */
    out.night = {}; setNight(true);
    for (const b of ['north', 'beyond', 'reach']) { const c = centre(b); clear(); put(c.x, c.y); pop(23); out.night[b] = species(); }
    // wolves circle and never attack: 3 s, the hero untouched, every wolf ≥ 180 away, howls below level 5
    // isolated: only the hero and the critters stand in the world (no event, boss or stray mob from the other systems may hit
    // the hero here); whatever still hurts the hero is named in out.wolf.by
    { const c = centre('north'); clear(); for (const e of R.ents.slice()) if (e !== pl && e.kind !== 'critter') R.remove(e); put(c.x, c.y); pop(29);
      const EVs = R.events, evNext = EVs ? EVs.nextAt : null; if (EVs) { try { if (EVs.active) EVs.stop('fail'); } catch (e) {} EVs.nextAt = 1e12; }
      for (let i = 0; i < 3; i++) R.step();   // the hero's stats settle first (hpMax follows R.state's level: 300 → the real maximum is not damage)
      const hp0 = pl.hp; howls.length = 0; let minD = 1e9, tgt = 0; const wolves = W.list().filter(e => e.species === 'wolf'), by = {};
      const hit0 = R.hit; if (typeof hit0 === 'function') R.hit = function (src, t) { if (t === pl) { const k = src ? (src.kind + ':' + (src.species || src.type || src.id || '')) : 'none'; by[k] = (by[k] || 0) + 1; } return hit0.apply(this, arguments); };
      for (let i = 0; i < 1200; i++) { R.step(); for (const e of R.ents.slice()) if (e !== pl && e.kind !== 'critter' && (e.kind === 'mob' || e.kind === 'boss' || e.team === 1)) { by['ent:' + e.kind + ':' + (e.type || '')] = (by['ent:' + e.kind + ':' + (e.type || '')] || 0) + 1; R.remove(e); }
        for (const w of wolves) { minD = Math.min(minD, Math.hypot(w.x - pl.x, w.y - pl.y)); if (w.ai.tgt || w.ai.st === 'attack' || w.ai.st === 'chase') tgt++; } }
      if (typeof hit0 === 'function') R.hit = hit0; if (EVs) EVs.nextAt = evNext;
      out.wolf = { n: wolves.length, minD: Math.round(minD), tgt, hpLost: hp0 - pl.hp, howls: howls.length, alive: wolves.filter(w => !w.dead && R.ents.includes(w)).length, by };
      setNight(false); steps(2); out.wolfDay = W.list().filter(e => e.species === 'wolf').map(e => e.ai.st); steps(60 * 12); out.wolfGone = W.list().filter(e => e.species === 'wolf').length; }
    // eyes vanish when approached
    { const c = centre('beyond'); clear(); put(c.x, c.y); setNight(true); pop(31); const eye = W.list().find(e => e.species === 'eyes'); out.eyes0 = !!eye;
      if (eye) { put(eye.x + 100, eye.y); steps(3); out.eyesGone = !R.ents.includes(eye); } setNight(false); }

    /* ---- deer flee at 160 ---- */
    { const c = centre('north'); clear(); put(c.x, c.y); pop(13); const deer = W.list().find(e => e.species === 'deer'); out.deer0 = !!deer;
      if (deer) { steps(2); put(deer.x + 200, deer.y); steps(10); out.deerCalm = deer.ai.st; put(deer.x + 150, deer.y); const d0 = Math.hypot(deer.x - pl.x, deer.y - pl.y); steps(30); out.deer = { st: deer.ai.st, d0: Math.round(d0), d1: Math.round(Math.hypot(deer.x - pl.x, deer.y - pl.y)), anim: deer.anim }; } }

    /* ---- ravens perch on the castle, launch when the hero runs through ---- */
    { const c = centre('north'); clear(); put(c.x, c.y); pop(17); const rv = W.list().filter(e => e.species === 'raven'); const wf = pois[0];
      out.raven = { n: rv.length, perched: rv.filter(e => e.ai.st === 'perch' && Math.abs(e.x - wf.x) <= 40 && Math.abs(e.y - wf.y) <= 30 && e.z >= 50).length };
      if (rv.length) { put(wf.x + 30, wf.y + 40); steps(6); out.ravenLaunch = rv.filter(e => e.ai.st === 'fly').length; steps(60 * 20); out.ravenBack = rv.filter(e => e.ai.st === 'perch' || e.ai.st === 'fly').length; }
      out.banner = W.props().filter(e => e.species === 'banner').map(e => [e.poi && e.poi.id, e.col, e.z]); }

    /* ---- frames: every species × anim × 3 frames × 2 faces paints something, ≤ 40 px tall ---- */
    out.frames = {}; out.blank = []; out.tall = [];
    for (const id in W.SPECIES) { const anims = ['idle', 'walk', 'flap', 'howl']; let n = 0; for (const an of anims) for (let fi = 0; fi < 3; fi++) for (const face of [1, -1]) { const c = W.frameAt(id, an, fi, face, '#e14b4b');
      if (!c || !c.width) { out.blank.push(id + ':' + an + fi); continue; } if (c.height > 40) out.tall.push(id + ':' + c.height); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; if (a < 255 * 6) out.blank.push(id + ':' + an + fi + ':' + face); n++; } out.frames[id] = n; }
    const h0 = W.frame('hare', 'walk', 0.0, 1), h1 = W.frame('hare', 'walk', 0.13, 1), h2 = W.frame('hare', 'walk', 0.26, 1); out.frameCycle = [h0 !== h1, h1 !== h2, h0 === W.frame('hare', 'walk', 0.38, 1)]; out.cache = W.cacheSize();
    { const e = W.list()[0]; out.entFrame = e ? (e.frame('walk', 0.2) instanceof HTMLCanvasElement) : null; }

    /* ---- a hit makes the animal flee + critterHit; the hero's swing cannot target it ---- */
    { const c = centre('north'); clear(); put(c.x, c.y); pop(19); const hare = W.list().find(e => e.species === 'hare') || W.list()[0]; hits.length = 0; put(hare.x + 400, hare.y); steps(1);
      let viaHit = false; if (typeof R.hit === 'function') { const info = R.hit(pl, hare, 1); viaHit = !!info; } if (!viaHit) R.bus.emit('hit', { src: pl, tgt: hare, dmg: 1, crit: false, kind: 'phys' });
      const d0 = Math.hypot(hare.x - pl.x, hare.y - pl.y); steps(20); out.hit = { sp: hare.species, st: hare.ai.st, hits: hits.slice(), away: Math.round(Math.hypot(hare.x - pl.x, hare.y - pl.y) - d0), viaHit, dead: !!hare.dead };
      if (typeof R.attack === 'function') { put(hare.x + 30, hare.y); const a = R.attack(pl, { range: 80, arc: 360, dmg: 1 }); out.attackTargets = a && a.targets ? a.targets.filter(t => t.kind === 'critter').length : 0; } else out.attackTargets = 0; }

    /* ---- smoke at the town, fish jumps on the river, the mammoth beyond the Wall ---- */
    { const c = centre('reach'); clear(); put(c.x, c.y); pop(37); steps(60); out.smoke = { smokers: (W.smokers || []).map(s => s.poi.id), puffs: W.puffs.length, fx: !!(R.fx && R.fx.spawn) }; }
    { const c = centre('riverlands'); clear(); put(c.x, c.y); pop(41); W.fishT = 0.01; steps(5); out.fish = { rings: W.rings.length, last: W.lastFish ? [blocked(W.lastFish.x, W.lastFish.y), Math.round(Math.hypot(W.lastFish.x - pl.x, W.lastFish.y - pl.y))] : null, biome: W.biome }; }
    { const c = centre('beyond'); clear(); put(c.x, c.y); pop(43); const m = W.spawnMammoth(); out.mam0 = !!m; if (m) { const d0 = Math.hypot(m.x - pl.x, m.y - pl.y), x0 = m.x, y0 = m.y; steps(60); out.mam = { d0: Math.round(d0), moved: Math.round(Math.hypot(m.x - x0, m.y - y0)), st: m.ai.st, h: m.h, z: m.z, anim: m.anim }; }
      W.mamT = 0.01; const n0 = W.list().filter(e => e.species === 'mammoth').length; steps(2); out.mamTimer = [n0, W.list().filter(e => e.species === 'mammoth').length, Math.round(W.mamT)]; }

    /* ---- despawn 2000+ units away (from the coast into the empty cell, 2400 units) ---- */
    { const c = centre('coast'); clear(); put(c.x, c.y); pop(47); const n0 = W.list().length + W.props().length; put(c.x + 2400, c.y); steps(60 * 5); out.despawn = [n0, W.list().length, W.props().length, W.biomeAt(pl.x, pl.y)]; }

    /* ---- budget: 14 critters × 600 steps of the wildlife system ---- */
    { const c = centre('north'); clear(); put(c.x, c.y); setNight(true); pop(53); const ids = ['hare', 'deer', 'raven', 'wolf']; let k = 0; while (W.list().length < 14 && k < 40) { const id = ids[k++ % 4]; const a = Math.random() * 6.28; W.spawnOne(id, pl.x + Math.cos(a) * 300, pl.y + Math.sin(a) * 300, {}); }
      out.perfN = W.list().length; const t0 = performance.now(); for (let i = 0; i < 600; i++) S.update(1 / 60); out.perfMs = performance.now() - t0; out.perfAlive = W.list().length; setNight(false);
      const t1 = performance.now(); for (let i = 0; i < 100; i++) R.drawAll(); out.drawMs = (performance.now() - t1) / 100;
      // software GL (SwiftShader / llvmpipe in headless CI) is slower for the same draw: the budget is relaxed there, the logic is the same
      try { const gl = document.createElement('canvas').getContext('webgl'), ex = gl && gl.getExtension('WEBGL_debug_renderer_info'); out.gl = gl ? String(gl.getParameter(ex ? ex.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'none'; } catch (e) { out.gl = '?'; }
      out.softGL = /swiftshader|llvmpipe|software|none/i.test(out.gl); }
    out.order = S.order; out.errs = R.errors.slice();
    return out;
  });

  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const has = (m, ...ids) => ids.every(i => m && m[i] > 0);
  ok(r.order === 65, 'system order 65: ' + r.order);
  ok(r.bad.length === 0, 'every critter: kind critter, team 2, noLoot, frame fn, its biome, 100–620 from the hero, on ground: ' + JSON.stringify(r.bad.slice(0, 8)));
  ok(has(r.day.north.sp, 'hare', 'deer', 'raven') && !r.day.north.sp.wolf, 'north by day: hares, deer, ravens, no wolves ' + JSON.stringify(r.day.north));
  ok(has(r.day.reach.sp, 'sheep', 'chicken', 'butterfly'), 'reach: sheep, chickens, butterflies ' + JSON.stringify(r.day.reach));
  ok(has(r.day.crownlands.sp, 'sheep', 'butterfly'), 'crownlands: sheep, butterflies ' + JSON.stringify(r.day.crownlands));
  ok(has(r.day.riverlands.sp, 'heron', 'frog'), 'riverlands: herons, frogs ' + JSON.stringify(r.day.riverlands));
  ok(has(r.day.dorne.sp, 'lizard', 'vulture', 'scorpion'), 'dorne: lizards, vultures, scorpions ' + JSON.stringify(r.day.dorne));
  ok(has(r.day.coast.sp, 'gull', 'crab'), 'coast: gulls, crabs ' + JSON.stringify(r.day.coast));
  ok(has(r.day.beyond.sp, 'snowfox') && !r.day.beyond.sp.eyes, 'beyond by day: snow foxes, no eyes ' + JSON.stringify(r.day.beyond));
  ok(Object.values(r.day).every(d => d.alive >= 1 && d.alive <= 14), 'each biome 1–14 alive ' + JSON.stringify(Object.values(r.day).map(d => d.alive)));
  ok(Object.values(r.descr).every(L => L.length >= 2) && r.descr.riverlands.includes('fish') && r.descr.beyond.includes('mammoth'), 'describe(biome) ' + JSON.stringify(r.descr));
  ok(r.biomeOf.join() === 'north,beyond,coast,dorne,riverlands,crownlands,reach,', 'biomeOf region names ' + JSON.stringify(r.biomeOf));
  ok(has(r.night.north, 'wolf') && has(r.night.beyond, 'eyes') && !r.night.reach.butterfly, 'night: wolves north, eyes beyond, no butterflies ' + JSON.stringify(r.night));
  ok(r.wolf.n >= 2 && r.wolf.minD >= 180 && r.wolf.tgt === 0 && r.wolf.hpLost === 0 && r.wolf.alive === r.wolf.n, 'wolves circle ≥ 180 away for 20 s, never attack ' + JSON.stringify(r.wolf));
  ok(r.wolf.howls >= 1, 'wolves howl at a level-1 hero ' + r.wolf.howls);
  ok(r.wolfDay.every(s => s === 'flee') && r.wolfGone === 0, 'at dawn the wolves leave ' + JSON.stringify([r.wolfDay, r.wolfGone]));
  ok(r.eyes0 && r.eyesGone, 'shadowcat eyes vanish when approached ' + JSON.stringify([r.eyes0, r.eyesGone]));
  ok(r.deer0 && r.deerCalm !== 'flee' && r.deer && r.deer.st === 'flee' && r.deer.d1 > r.deer.d0 + 40 && r.deer.anim === 'walk', 'deer flee at 160 ' + JSON.stringify([r.deerCalm, r.deer]));
  ok(r.raven.n >= 2 && r.raven.perched >= 2, 'ravens perch on the castle walls ' + JSON.stringify(r.raven));
  ok(r.ravenLaunch >= 1 && r.ravenBack === r.raven.n, 'ravens launch when the hero comes, stay around the castle ' + JSON.stringify([r.ravenLaunch, r.ravenBack]));
  ok(r.banner.length === 1 && r.banner[0][0] === 'wf' && /^#/.test(r.banner[0][1]) && r.banner[0][2] >= 60, 'one banner on the castle in the house colour ' + JSON.stringify(r.banner));
  ok(r.blank.length === 0 && r.tall.length === 0 && Object.keys(r.frames).length === 18 && Object.values(r.frames).every(n => n === 24), '18 species × 24 non-blank frames ≤ 40 px ' + JSON.stringify([r.blank.slice(0, 6), r.tall, r.frames]));
  ok(r.frameCycle.join() === 'true,true,true' && r.entFrame === true, 'walk frames cycle at 8 fps, e.frame gives a canvas ' + JSON.stringify([r.frameCycle, r.entFrame, r.cache]));
  ok(r.hit.st === 'flee' && r.hit.hits.length === 1 && r.hit.hits[0] === r.hit.sp && r.hit.away > 30 && !r.hit.dead, 'a hit → flight + critterHit ' + JSON.stringify(r.hit));
  ok(r.attackTargets === 0, 'the hero\'s swing never targets a critter ' + r.attackTargets);
  ok(r.smoke.smokers.includes('town1') && (r.smoke.fx || r.smoke.puffs >= 1), 'chimney smoke at the town ' + JSON.stringify(r.smoke));
  ok(r.fish.biome === 'riverlands' && r.fish.last && r.fish.last[0] === true && r.fish.last[1] <= 320 && (r.fish.rings >= 1 || r.smoke.fx), 'a fish jumps on the water ' + JSON.stringify(r.fish));
  ok(r.mam0 && r.mam.d0 >= 880 && r.mam.d0 <= 920 && r.mam.moved >= 18 && r.mam.moved <= 26 && r.mam.h === 40 && r.mam.z === 0 && r.mam.anim === 'walk', 'the mammoth walks the horizon 900 units out ' + JSON.stringify(r.mam));
  ok(r.mamTimer[1] === r.mamTimer[0] + 1 && r.mamTimer[2] === 180, 'the mammoth timer: one more every 180 s ' + JSON.stringify(r.mamTimer));
  ok(r.despawn[0] >= 2 && r.despawn[1] === 0 && r.despawn[2] === 0 && r.despawn[3] === null, 'everything despawns 2000 units away ' + JSON.stringify(r.despawn));
  ok(r.perfN === 14 && r.perfMs < 150 && r.perfAlive >= 10, '14 critters × 600 steps < 150 ms: ' + r.perfMs.toFixed(1) + ' ms, alive after ' + r.perfAlive);
  ok(r.drawMs < (r.softGL ? 16 : 6), '2D fallback draw under budget ' + r.drawMs.toFixed(2) + ' ms (< ' + (r.softGL ? '16, software GL' : '6') + ')');
  ok(errors.length === 0 && r.errs.length === 0, 'no page errors ' + JSON.stringify([errors, r.errs]));
  console.log('species by biome (day):', JSON.stringify(Object.fromEntries(Object.entries(r.day).map(([b, d]) => [b, Object.keys(d.sp).join('+')]))));
  console.log('night:', JSON.stringify(Object.fromEntries(Object.entries(r.night).map(([b, d]) => [b, Object.keys(d).join('+')]))), 'wolves', JSON.stringify(r.wolf));
  console.log(`wildlife: ${r.perfN} critters × 600 steps ${r.perfMs.toFixed(1)} ms, draw ${r.drawMs.toFixed(2)} ms, ${r.cache} cached frames`);
  for (const f of fails) console.log('FAIL', f);
  console.log(fails.length ? `FAILS: ${fails.length}` : 'OK t_wildlife');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
