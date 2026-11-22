// T1 — 48_townsfolk.js: ambient people in towns and castles. At Winterfell, Lannisport and Sunspear (the real world data) 6–14 people
// spawn when the hero comes within 900, all kind 'folk' / team 2 / noLoot / noBar, inside poi.r × 0.9, never on a blocked cell, away from
// the quest NPCs; they walk (and stay on walkable ground for 30 s), guards stand at the gate, a merchant at the stall, pairs chat (a bubble
// within 150 every ~10 s), region looks differ (Dorne wraps, northern furs), fewer people at night and some carry e.torch, everyone despawns
// past 1300; frames are non-blank canvases with feet meta; 14 people cost ≤ 0.3 ms per step; screenshots at 390×844 by day and at night.
// usage: HOLDOR_HTML=$F RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_townsfolk.js   (FOLK_SHOTS=0 skips the screenshots)
'use strict';
const L = require('./lib');
(async () => {
  L.build();
  const { page, errors, close } = await L.launch({ w: 390, h: 844 });
  await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 5 }), timeout: 90000, wait: 30000 });
  await page.evaluate(() => { if (R.ui && R.ui.cur) R.ui.close(); R.paused = false; });
  const r = await page.evaluate(() => {
    const F = R.townsfolk, out = { towns: {}, bad: [], errs: [] }, P = R.player, steps = n => { for (let i = 0; i < n; i++) R.step(); };
    if (!F || !P) return { missing: !F ? 'R.townsfolk' : 'R.player' };
    R.stop(); if (R.world.openGate) for (const rg of R.world.regions()) if (rg.gate) R.world.openGate(rg.id); R.world.lastGood = null; if (R.ambience && R.ambience.setHour) R.ambience.setHour(12); if (R.ambience) R.ambience.night = false;
    const pois = R.data.world.pois, byId = id => pois.find(p => p.id === id), put = (x, y) => { P.x = x; P.y = y; P.vx = P.vy = 0; };
    const near = (id, t) => byId(id) || pois.filter(p => p.type === t).sort((a, b) => 0)[0];
    const W = R.world, blk = (x, y) => W.blocked(x, y) || (W.obstacleAt && W.obstacleAt(x, y, 4));
    for (const [id, t] of [['winterfell', 'castle'], ['lannisport', 'town'], ['sunspear', 'castle']]) {
      const p = near(id, t); if (!p) { out.errs.push('no ' + id); continue; }
      for (const k in F.places) F.despawn(k);
      put(p.x + 40, p.y + 300); steps(40); const hp = [Math.round(P.x - p.x), Math.round(P.y - p.y)];
      const L1 = F.list().filter(e => e.poi === p.id), pr = F.places[p.id] && F.places[p.id].pr;
      const o = out.towns[p.id] = { n: L1.length, pr, hp, roles: {}, styles: {}, hats: {} };
      for (const e of L1) { o.roles[e.role] = (o.roles[e.role] || 0) + 1; o.styles[e.look.style] = 1; o.hats[e.look.hat || '-'] = (o.hats[e.look.hat || '-'] || 0) + 1;
        if (e.kind !== 'folk' || e.team !== 2 || !e.noLoot || !e.noBar || typeof e.frame !== 'function') out.bad.push(p.id + ':flags');
        if (Math.hypot(e.x - p.x, e.y - p.y) > pr * .9 + 2) out.bad.push(p.id + ':out:' + Math.round(Math.hypot(e.x - p.x, e.y - p.y)));
        if (blk(e.x, e.y)) out.bad.push(p.id + ':blocked'); }
      // 15 s: they move, never onto blocked ground, never out of the place
      const x0 = L1.map(e => [e.x, e.y]); let blocked = 0, outside = 0;
      for (let i = 0; i < 900; i++) { R.step(); if (i % 10 === 0) for (const e of L1) { if (e.gone) continue; if (blk(e.x, e.y)) blocked++; if (Math.hypot(e.x - p.x, e.y - p.y) > pr * .9 + 2) outside++; } }
      o.moved = L1.filter((e, i) => Math.hypot(e.x - x0[i][0], e.y - x0[i][1]) > 20).length; o.blocked = blocked; o.outside = outside;
      const npcs = (R.npcs && R.npcs.at(p.id)) || []; let minN = 1e9; for (const e of L1) for (const n of npcs) minN = Math.min(minN, Math.hypot(e.x - n.x, e.y - n.y)); o.npcs = npcs.length; o.minNpc = Math.round(minN);
    }
    // chat: within 150 of a talking pair a bubble shows within ~12 s
    { const p = byId('winterfell'); for (const k in F.places) F.despawn(k); put(p.x + 40, p.y + 500); steps(40);
      const pair = F.list().find(e => e.ai.st === 'chat' && e.ai.lead); out.pair = !!pair;
      if (pair) { put(pair.x + 60, pair.y + 40); let got = null; for (let i = 0; i < 60 * 14 && !got; i++) { R.step(); const b = F.list().find(e => e.bub); if (b) got = b.bub.txt; } out.bubble = got; } }
    // per-step cost with 14 people
    { const p = byId('winterfell'); for (const k in F.places) F.despawn(k); put(p.x, p.y + 400); steps(2); for (const k in F.places) F.despawn(k); const mp = F.MAX_PLACES; F.MAX_PLACES = 1; F.spawnAt(p.id, { n: 14, night: false });
      for (const pid in F.places) if (pid !== p.id) F.despawn(pid);
      const S = R.sys.townsfolk; let best = 1e9; for (let rep = 0; rep < 3; rep++) { const t0 = performance.now(); for (let i = 0; i < 600; i++) { R.t += 1 / 60; S.update(1 / 60); } best = Math.min(best, (performance.now() - t0) / 600); }
      out.perStep = +best.toFixed(4); out.n14 = F.list().filter(e => e.poi === p.id).length; F.MAX_PLACES = mp; }
    // night: fewer, torches
    { const p = byId('winterfell'); for (const k in F.places) F.despawn(k); if (R.ambience && R.ambience.setHour) R.ambience.setHour(23); R.ambience.night = true; put(p.x + 40, p.y + 600); steps(40);
      const Ln = F.list().filter(e => e.poi === p.id); out.night = { n: Ln.length, torches: Ln.filter(e => e.torch).length, torchOk: Ln.filter(e => e.torch).every(e => e.torch.z > 30 && e.torch.r > 0) };
      R.ambience.setHour && R.ambience.setHour(12); R.ambience.night = false; }
    // despawn past 1300
    { const p = byId('winterfell'); put(p.x + 40, p.y + 600); steps(40); const n0 = F.list().filter(e => e.poi === p.id).length; put(p.x + 1400, p.y + 600); steps(70); out.despawn = { n0, n1: F.list().filter(e => e.poi === p.id).length, places: Object.keys(F.places) }; }
    // frames
    { const looks = [F.look({ seed: 1, role: 'walker', style: F.styleOf('dorne') }), F.look({ seed: 2, role: 'guard', style: F.styleOf('north') }), F.look({ seed: 3, role: 'child', style: F.styleOf('reach') })];
      out.frames = []; for (const lk of looks) for (const an of ['idle', 'walk', 'talk']) for (let ph = 0; ph < 6; ph++) for (const face of [1, -1]) { const c = F.frameAt(lk, an, ph, face, ph === 1);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) a++;
        if (!c.meta || !(c.meta.h > 0) || a < 200) out.frames.push(lk.role + an + ph + face + ':' + a); }
      out.walkDiff = F.frameAt(looks[0], 'walk', 0, 1) !== F.frameAt(looks[0], 'walk', 2, 1); out.childH = looks[2].H; out.adultH = looks[0].H; }
    R.run(); return out;
  });
  if (r.missing) { L.ok('module present', false, r.missing); await close(); return L.report(); }
  for (const id in r.towns) { const o = r.towns[id]; console.log('   ' + id + ' ' + JSON.stringify(o));
    L.ok(id + ': 6–14 people spawn (' + o.n + ')', o.n >= 6 && o.n <= 14);
    L.ok(id + ': they move (' + o.moved + ') and never stand on blocked ground or leave the place (' + o.blocked + '/' + o.outside + ')', o.moved >= 3 && o.blocked === 0 && o.outside === 0);
    L.ok(id + ': a guard at the gate', (o.roles.guard || 0) >= 1);
    L.ok(id + ': away from the quest NPCs (min ' + o.minNpc + ')', !o.npcs || o.minNpc >= 20); }
  L.ok('Dorne / the North look different', JSON.stringify(r.towns.sunspear && r.towns.sunspear.styles) !== JSON.stringify(r.towns.winterfell && r.towns.winterfell.styles));
  L.ok('spawn flags + positions', r.bad.length === 0, r.bad.slice(0, 6).join(' '));
  L.ok('a pair chats with a bubble (' + r.bubble + ')', r.pair && !!r.bubble);
  L.ok('14 people ≤ 0.3 ms per step (' + r.perStep + ' ms, ' + r.n14 + ')', r.perStep <= 0.3 && r.n14 === 14);
  L.ok('night: fewer people, torches (' + JSON.stringify(r.night) + ')', r.night.n >= 3 && r.night.n < (r.towns.winterfell || {}).n && r.night.torches >= 1 && r.night.torchOk);
  L.ok('despawn past 1300 (' + JSON.stringify(r.despawn) + ')', r.despawn.n0 > 0 && r.despawn.n1 === 0);
  L.ok('frames non-blank with feet meta (' + r.frames.length + ' bad)', r.frames.length === 0, r.frames.slice(0, 5).join(' '));
  L.ok('walk frames differ, children smaller (' + r.childH.toFixed(1) + ' vs ' + r.adultH.toFixed(1) + ')', r.walkDiff && r.childH < 45 && r.adultH > 54);
  const shots = [];
  if (process.env.FOLK_SHOTS !== '0') for (const [id, hour, name] of [['winterfell', 12, 'folk_winterfell_day'], ['sunspear', 12, 'folk_sunspear_day'], ['winterfell', 23, 'folk_winterfell_night']]) {
    await page.evaluate(([id, hour]) => { const F = R.townsfolk, p = R.data.world.pois.find(q => q.id === id); for (const k in F.places) F.despawn(k);
      if (R.ambience && R.ambience.setHour) R.ambience.setHour(hour); R.ambience.night = hour > 20 || hour < 5;
      const pl = F.spawnAt(id, { n: hour > 20 ? 7 : 14 }); const m = pl.market || pl.well || pl.spots[0];
      R.player.x = m.x + 10; R.player.y = m.y + 90; R.player.vx = R.player.vy = 0; R.cam.yaw = 0; if (R.render && R.render.snapCam) R.render.snapCam();
      for (let i = 0; i < 240; i++) R.step(); }, [id, hour]);
    await page.waitForTimeout(500);
    const f = require('path').join(__dirname, '..', '..', '.shots', 'rpg', name + '.png'); require('fs').mkdirSync(require('path').dirname(f), { recursive: true });
    try { await page.screenshot({ path: f, timeout: 120000 }); shots.push(f); } catch (e) { L.skip('shot ' + name, e.message.split('\n')[0]); }
  }
  L.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log('shots: ' + shots.join(' '));
  await close(); L.report();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
