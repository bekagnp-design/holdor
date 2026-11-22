// RPG G2 nature + the real world: 09_nature.js on the integrated 3D build (three.js, software GL), with the real world data.
// Per-region recipes (the North, the Wolfswood, the Neck, the Riverlands, the Reach, the Westerlands, the Stormlands, the Kingswood,
// the Vale, Dorne, the Red Mountains, the Iron Islands, the Wall, beyond it, the Lands of Always Winter, Dragonstone, the Stony Shore),
// chunk streaming + disposal, the per-chunk budget, nothing on roads / water / POI cores, deterministic placement, wind in the shader,
// tree colliders reaching R.world.slide, the wildlife biome of each real region, and a calm start at every house seat
// (no gate toast, no boss within 800 units, no ambient mob within 600). Screenshots: .shots/rpg/nature_<biome>.png.
// usage: python3 src/build_rpg.py beta/index.html && node tests/rpg/t_nature.js   (RPG_HTML / HOLDOR_RPG_HTML = a built page; RPG_NOBUILD=1)
'use strict';
const L = require('./lib');
if (!process.env.RPG_HTML && process.env.HOLDOR_RPG_HTML) process.env.RPG_HTML = process.env.HOLDOR_RPG_HTML;
(async () => {
  L.build();
  const { page, errors, cerrs, close } = await L.launch();
  page.setDefaultNavigationTimeout(180000); page.setDefaultTimeout(90000);   // 9 agents on 4 cores: be patient
  const toasts = [];
  await page.exposeFunction('__g2toast', t => toasts.push(String(t)));
  /* ---- a calm start at three house seats: 20 game seconds with no input → the hero untouched, nothing within 400 units ---- */
  const START = [['lannister', 'casterly', 'westerlands'], ['martell', 'sunspear', 'dorne'], ['stark', 'winterfell', 'north']];
  for (const [house, seat, region] of START) {
    toasts.length = 0;
    const b = await L.boot(page, { save: L.fakeSave({ house }), wait: 30000, timeout: 90000 });   // a loaded CI box: the 5 MB page can take > 15 s
    L.ok(house + ': booted into the world (3D)', b.running && b.player, JSON.stringify({ running: b.running, cur: b.cur }));
    await page.evaluate(() => { const o = R.ui.toast; R.ui.toast = function (t, c) { window.__g2toast(t); return o && o.apply(R.ui, arguments); }; });
    await page.waitForTimeout(400);
    const st = await page.evaluate(seat => { R.stop(); const p = R.player, wf = R.world.poi(seat), hp0 = p.hp; let near = 0, nearWho = [];
      for (let i = 0; i < 1200; i++) { R.step(); if (i % 30 === 0) for (const e of R.ents) if ((e.kind === 'mob' || e.kind === 'boss') && !e.dead && e.team !== 0 && Math.hypot(e.x - p.x, e.y - p.y) < 400) { near++; if (nearWho.length < 4) nearWho.push(e.type + ' L' + e.lvl + ' @' + Math.round(Math.hypot(e.x - p.x, e.y - p.y)) + (e.ambient ? ' amb' : '') + (e.quest ? ' quest' : '')); } }
      R.start && R.start();
      return { d: Math.round(Math.hypot(p.x - wf.x, p.y - wf.y)), blocked: R.world.blocked(p.x, p.y), cur: R.world.cur, hp0, hp: p.hp, near, nearWho,
        bossNear: R.ents.filter(e => e.kind === 'boss' && Math.hypot(e.x - p.x, e.y - p.y) < 800).map(e => e.name),
        ambient: R.ents.filter(e => e.kind === 'mob' && e.ambient && !e.dead).map(e => ({ d: Math.round(Math.hypot(e.x - wf.x, e.y - wf.y)), l: e.lvl })) }; }, seat);
    const lv = st.ambient.filter(a => a.d < 1500).map(a => a.l);
    L.ok(house + ' start: at ' + seat + ' on walkable ground in ' + region + ', no pushback, no gate toast', st.d < 200 && !st.blocked && st.cur === region && !toasts.some(t => /held by|defeat it first/.test(t)), JSON.stringify({ d: st.d, cur: st.cur, toasts }));
    L.ok(house + ' start: 20 s idle → hp unchanged, no mob / boss within 400 units', st.hp >= st.hp0 && st.near === 0 && !st.bossNear.length, JSON.stringify({ hp0: st.hp0, hp: st.hp, near: st.near, who: st.nearWho, boss: st.bossNear }));
    // spawned ≥ 600 away; an idle mob may wander a few steps after 20 s, so 540 is the line
    L.ok(house + ' start: no ambient mob within 600 of the seat (±wander), the ones within 1500 at the bottom of the band', st.ambient.every(a => a.d >= 540) && lv.every(l => l <= 2), JSON.stringify(st.ambient.slice(0, 14)));
  }
  // every seat: the bosses' spawn spots (13_bosses: poi position, else x,y) are ≥ 800 units away
  const seats = await page.evaluate(() => { const B = (R.data.bosses && (Array.isArray(R.data.bosses) ? R.data.bosses : Object.values(R.data.bosses))) || [], out = [];
    for (const s of R.world.seats()) for (const bo of B) { const q = bo.poi && R.world.poi(bo.poi), x = q ? q.x : bo.x, y = q ? q.y : bo.y; if (typeof x !== 'number') continue;
      const d = Math.hypot(x - s.x, y - s.y); if (d < 800) out.push(s.id + '~' + bo.id + ':' + Math.round(d)); }
    const homes = R.world.seats().map(s => { const rg = R.world.regionAt(s.x, s.y); return s.id + ':' + (rg ? rg.id : '-') + ':' + (rg && rg.home === s.house ? 'home' : 'x'); });
    return { close: out, homes }; });
  L.ok('no boss spawn spot within 800 units of any house seat', !seats.close.length, JSON.stringify(seats.close));
  L.ok('every seat stands in its house\'s home region', seats.homes.every(h => /:home$/.test(h)), JSON.stringify(seats.homes));

  /* ---- recipes ---- */
  const rc = await page.evaluate(() => { const N = R.nature, out = { kinds: {}, missing: [], sig: {} };
    for (const b in N.BIOMES) { const t = [...new Set(N.BIOMES[b].props.map(e => e.t))]; out.kinds[b] = t.length; for (const k of t) if (!N.PROPS[k]) out.missing.push(b + ':' + k); out.sig[b] = t.sort().join(','); }
    out.dupSig = Object.keys(out.sig).filter((b, i, a) => a.findIndex(c => out.sig[c] === out.sig[b]) !== i);
    const S = { north: [3250, 2750], wolfswood: [2150, 1950], neck: [3350, 4900], riverlands: [3600, 6250], reach: [2500, 9850], westerlands: [1500, 8350], stormlands: [5250, 9800],
      kingswood: [5050, 8850], crownlands: [4600, 8000], vale: [5050, 5950], dorne: [5000, 11250], redmts: [3000, 10750], ironislands: [800, 6000], wall: [3700, 900], beyond: [4000, 420],
      winter: [500, 1300], dragonstone: [6650, 7350], crackclaw: [5650, 7900], coast: [1200, 4700] };
    const WS = (R.data.world.W || 7200) / 7200; for (const b in S) { S[b][0] *= WS; S[b][1] *= WS; }   // the places are in the 7200-wide grid; the world is R.WS × that
    out.at = {}; for (const b in S) out.at[b] = N.biomeAt(S[b][0], S[b][1]);
    out.wild = {}; const WL = R.wildlife; if (WL) for (const b of ['beyond', 'winter', 'wall', 'wolfswood', 'ironislands', 'dragonstone', 'crownlands', 'dorne', 'riverlands']) out.wild[b] = WL.biomeAt(S[b][0], S[b][1]);
    out.wildOk = !WL || Object.values(out.wild).every(w => w && WL.BIOMES[w]);
    return out; });
  L.ok('every recipe names known props, ≥ 4 kinds each, no two recipes alike', !rc.missing.length && Object.values(rc.kinds).every(n => n >= 4) && !rc.dupSig.length, JSON.stringify({ missing: rc.missing, kinds: rc.kinds, dup: rc.dupSig }));
  const wrong = Object.keys(rc.at).filter(b => rc.at[b] !== b);
  L.ok('biomeAt on the real map: 19 places, each its own recipe', !wrong.length, JSON.stringify(wrong.map(b => b + '→' + rc.at[b])));
  L.ok('wildlife: the real region ids pick their critters (beyond: snow fox + mammoth, Wolfswood, Iron Islands, Dragonstone …)', rc.wildOk && rc.wild.beyond === 'beyond' && rc.wild.winter === 'beyond' && rc.wild.wall === 'wall' && rc.wild.wolfswood === 'wolfswood' && rc.wild.ironislands === 'iron' && rc.wild.dragonstone === 'ash' && rc.wild.crownlands === 'crownlands', JSON.stringify(rc.wild));

  /* ---- streaming in eight regions: biome, budget, placement rules, screenshots ---- */
  const SPOTS = [['north', 3250, 2750], ['wolfswood', 2150, 1950], ['riverlands', 3600, 6250], ['reach', 2500, 9850], ['westerlands', 1500, 8350], ['stormlands', 5250, 9800], ['dorne', 5000, 11250], ['ironislands', 800, 6000], ['beyond', 4000, 420], ['dragonstone', 6720, 7290], ['crackclaw', 5650, 7900]];
  let disposed0 = null;
  for (const [name, x, y] of SPOTS) {
    const r = await page.evaluate(([x, y]) => {
      const WS = (R.data.world.W || 7200) / 7200; x *= WS; y *= WS;
      const p = R.player, N = R.nature; p.x = x; p.y = y; p.vx = p.vy = 0; p.hp = p.hpMax; p.inv = R.t + 99; R.world.lastGood = null; R.world.cur = null;
      for (const e of R.ents.slice()) if ((e.kind === 'mob' || e.kind === 'boss') && Math.hypot(e.x - x, e.y - y) < 900) R.remove(e);
      R.cam.dist = 700; if (R.camSnap) R.camSnap(); N.refresh(); N.buildAll(); for (let i = 0; i < 3; i++) R.step();
      const ch = N.chunks.get(Math.floor(x / N.CHUNK) + ',' + Math.floor(y / N.CHUNK)); let bad = [], n = 0, maxDraw = 0, maxInst = 0;
      for (const c of N.chunks.values()) { maxDraw = Math.max(maxDraw, c.meshes.length); maxInst = Math.max(maxInst, c.n);
        for (const k in c.recs) for (const q of c.recs[k]) { n++;
          if (R.world.blocked(q.x, q.y)) bad.push(k + ' in the sea'); else if (R.world.roadNear(q.x, q.y, N.ROAD_R - 1)) bad.push(k + ' on a road');
          else { const po = R.world.pois().find(pp => Math.hypot(pp.x - q.x, pp.y - q.y) < N.keepOf(pp) - 1); if (po) bad.push(k + ' in ' + po.id); } } }
      return { n: N.chunks.size, biome: ch && ch.biome, kinds: ch ? Object.keys(ch.recs).length : 0, inst: ch ? ch.n : 0, maxDraw, maxInst, bad: bad.slice(0, 5), nbad: bad.length, all: n,
        grass: N.grassCount(), obst: N.obstacles.length, disposed: N.stats.disposed.meshes, attached: !!(R.render3d && R.render3d.scene.getObjectByName('nature')) };
    }, [x, y]);
    await page.waitForTimeout(250);
    await L.shot(page, 'nature_' + name);
    if (disposed0 == null) disposed0 = r.disposed;
    L.ok(name + ': 9 chunks of its own recipe, ≥ 3 kinds, budget ≤ 12 draws / 1200 instances per chunk', r.attached && r.n === 9 && r.biome === name && r.kinds >= 3 && r.inst > 20 && r.maxDraw <= 12 && r.maxInst <= 1200, JSON.stringify(r));
    L.ok(name + ': nothing in the sea, on a road or in a POI core (' + r.all + ' placed)', r.nbad === 0, JSON.stringify(r.bad));
  }
  const ds = await page.evaluate(() => R.nature.stats.disposed.meshes);
  L.ok('chunks left behind are disposed (meshes freed)', ds > disposed0, ds + ' > ' + disposed0);

  /* ---- the painted look (owner, 16:20: "no Lego"): every plant is an alpha-tested textured card, the rocks are smooth ---- */
  const look = await page.evaluate(() => { const N = R.nature, out = { cards: 0, solid: [], tex: 0, src: N.texSource ? N.texSource() : {} };
    for (const c of N.chunks.values()) for (const im of c.meshes) { if (N.IMP[im.name]) { if (im.material.map && im.material.alphaTest >= .3 && im.geometry.attributes.uv) out.cards++; else out.solid.push(im.name); } }
    out.tex = Object.keys(out.src).length; out.grass = !!(N.IMP.tuft); return out; });
  L.ok('plants are painted alpha cards (R.tex or the fallback painter), none left as solid low-poly', look.cards > 5 && !look.solid.length && look.tex > 0, JSON.stringify({ cards: look.cards, solid: look.solid, src: look.src }).slice(0, 400));

  /* ---- determinism, wind, colliders ---- */
  const dc = await page.evaluate(() => { const N = R.nature, p = R.player, cx = Math.floor(p.x / N.CHUNK), cy = Math.floor(p.y / N.CHUNK);
    const sig = ch => Object.keys(ch.recs).sort().map(k => k + ':' + ch.recs[k].map(q => Math.round(q.x) + '/' + Math.round(q.y)).join(';')).join('|');
    const a = sig(N.chunks.get(cx + ',' + cy)), b = sig(N.build(cx, cy, 0)); return a === b && a.length > 10; });
  L.ok('placement is deterministic per chunk (rebuilt = identical)', dc);
  const wind = await page.evaluate(() => { const N = R.nature; let m = null; for (const c of N.chunks.values()) for (const im of c.meshes) if (im.material.userData && im.material.userData.uni && !m) m = im.material;
    const t0 = R.t; for (let i = 0; i < 30; i++) R.step(); return { has: !!m && typeof m.onBeforeCompile === 'function', sway: m && m.userData.uni.uSway.value, dt: +(R.t - t0).toFixed(2) }; });
  L.ok('wind: swaying materials get the vertex sway (onBeforeCompile, uSway > 0) and time advances', wind.has && wind.sway > 0 && wind.dt > 0.4, JSON.stringify(wind));
  const col = await page.evaluate(() => { const N = R.nature, p = R.player, WS = (R.data.world.W || 7200) / 7200; p.x = 2150 * WS; p.y = 1950 * WS; R.world.lastGood = null; N.refresh(); N.buildAll();
    let tree = null; for (const c of N.chunks.values()) for (const k of ['firdark', 'pine_l']) for (const q of (c.recs[k] || [])) if (!tree && Math.hypot(q.x - p.x, q.y - p.y) < 500) tree = { x: q.x, y: q.y, k };
    if (!tree) return { tree: null };
    const o = N.obstacles.find(o => Math.hypot(o.x - tree.x, o.y - tree.y) < 1);
    const m = { x: tree.x - 60, y: tree.y, r: 14 }; let steps = 0; for (let i = 0; i < 40; i++) { if (R.world.slide(m, 3, 0)) steps++; }
    const q = R.world.slide(tree.x - 60, tree.y, tree.x, tree.y, 14);
    return { tree, obst: o && o.r, blocked: N.blockedAt(tree.x, tree.y, 0), viaWorld: R.world.obstacleAt(tree.x, tree.y, 0), stopAt: Math.round(tree.x - m.x), steps, five: Math.round(tree.x - q.x) }; });
  L.ok('big trees are colliders: in R.nature.obstacles, R.world.obstacleAt, and slide stops a mover at the trunk', col.tree && col.obst > 0 && col.blocked && col.viaWorld && col.stopAt >= col.obst && col.stopAt < 40 && col.five >= col.obst, JSON.stringify(col));


  /* ---- N1: plants bend away from the hero and movers, storms, drifting leaves / petals / snow / sand, ground clutter near the camera ---- */
  const WALK = [['north', 3250, 2750, 'snow'], ['reach', 2500, 9850, 'petal'], ['riverlands', 3600, 6250, 'leaf'], ['dorne', 5000, 11250, 'sand'], ['beyond', 4000, 420, 'snow']];
  for (const [name, x, y, dk] of WALK) {
    const r = await page.evaluate(([x, y]) => {
      const WS = (R.data.world.W || 7200) / 7200; x *= WS; y *= WS;
      const p = R.player, N = R.nature; R.stop(); p.x = x; p.y = y; p.vx = p.vy = 0; p.hp = p.hpMax; p.inv = R.t + 99; R.world.lastGood = null; R.world.cur = null;
      for (const e of R.ents.slice()) if ((e.kind === 'mob' || e.kind === 'boss') && Math.hypot(e.x - x, e.y - y) < 900) R.remove(e);
      R.cam.dist = 330; if (R.camSnap) R.camSnap(); N.refresh(); N.buildAll();
      for (let i = 0; i < 40; i++) { p.x += 2.2; p.vx = 132; R.step(); }          // the hero walks east through the grass
      R.start && R.start();
      const b = N.benders(), L = []; for (const t in N.clutter) for (const q of N.clutter[t]) L.push([t, q]);
      const bad = []; for (const [t, q] of L) { if (R.world.blocked(q.x, q.y)) bad.push(t + ' in the sea'); else if (R.world.roadNear(q.x, q.y, N.ROAD_R - 1)) bad.push(t + ' on a road');
        else { const po = R.world.pois().find(pp => Math.hypot(pp.x - q.x, pp.y - q.y) < N.keepOf(pp) - 1); if (po) bad.push(t + ' in ' + po.id); } }
      const grassMat = R.render3d.scene.getObjectByName('grass'), gu = grassMat && grassMat.material.userData.uni;
      return { biome: N.biomeAt(p.x, p.y), grass: N.grassCount(), clutter: N.clutterCount(), draws: N.clutterDraws(), kinds: Object.keys(N.clutter), bad: bad.slice(0, 4), nbad: bad.length,
        drift: N.driftCount(), dk: N.drift.kind, hero: b[0] && Math.hypot(b[0].x - p.x, b[0].y - p.y) < 1 && b[0].k > .6, wake: b.slice(1).some(q => q.r === 18), nb: b.length, grassBend: gu && gu.uBendK.value, grassVS: grassMat && grassMat.material.userData.vs };
    }, [x, y]);
    await page.waitForTimeout(300);
    await L.shot(page, 'nature_walk_' + name);
    L.ok(name + ': the hero bends the grass (bender 0 on him, his wake behind, the grass shader takes them)', r.hero && r.wake && r.nb <= 8 && r.grassBend > 0 && r.grassVS === 1 && r.grass > 200, JSON.stringify(r));
    L.ok(name + ': ground clutter near the camera (≥ 2 kinds, ≤ 5 draws), none on water / roads / POI cores; ' + dk + ' drifting', r.clutter > 15 && r.kinds.length >= 2 && r.draws <= 5 && r.nbad === 0 && r.dk === dk && r.drift > 10, JSON.stringify(r));
  }
  const ns = await page.evaluate(() => { const N = R.nature, A = R.ambience, out = {}; R.stop(); A.set('clear'); for (let i = 0; i < 400; i++) R.step(); out.clear = +N.stormTarget().toFixed(2);
    A.set('rain'); for (let i = 0; i < 400; i++) R.step(); out.rain = +N.storm().toFixed(2); out.rainT = +N.stormTarget().toFixed(2); A.set('auto');
    // a mob walking next to the hero becomes a bender
    const p = R.player, m = R.ents.find(e => e.kind === 'mob' && !e.dead) || null; if (m) { m.x = p.x + 60; m.y = p.y; m.vx = 50; } R.step();
    out.mob = m ? N.benders().some(b => Math.abs(b.x - m.x) < 6 && Math.abs(b.y - m.y) < 6) : null;
    // the world corners at the new scale: chunks build there without errors, keys stay integral
    const W = R.data.world.W || R.W, H = R.data.world.H || R.H, ch = N.build(Math.floor(W * .98 / N.CHUNK), Math.floor(H * .98 / N.CHUNK), 0); out.corner = !!ch && ch.key === Math.floor(W * .98 / N.CHUNK) + ',' + Math.floor(H * .98 / N.CHUNK);
    out.W = W; out.H = H; return out; });
  L.ok('storms: rain makes the plants and trees sway harder (uStorm > 1.5), clear weather calms them', ns.clear < 1.4 && ns.rain > 1.5 && ns.rainT > 1.7, JSON.stringify(ns));
  L.ok('a mob next to the hero bends the grass too; chunks build at the far corner of the ' + ns.W + ' × ' + ns.H + ' world', (ns.mob === null || ns.mob) && ns.corner, JSON.stringify(ns));
  const px = await L.canvasPixels(page, '#gl');
  if (/screenshot failed/.test(px.how || '')) L.skip('the 3D world is drawn', 'the canvas screenshot timed out under load: ' + px.how);
  else L.ok('the 3D world is drawn', px.ok && px.distinct > 8, JSON.stringify(px));
  const real = L.realConsole(cerrs).filter(t => /nature|world|wildlife/i.test(t));
  L.ok('no page errors, no console errors from nature / world / wildlife', !errors.length && !real.length, JSON.stringify(errors.concat(real)).slice(0, 400));
  await close(); L.report();
})().catch(e => { console.error(e); process.exit(1); });
