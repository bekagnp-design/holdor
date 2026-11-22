// tests/rpg/t_spellfx.js — S1: the 3D spell + loot effect layer (src/rpg/js/63_spellfx.js) inside R.render3d.scene.
// Every effect spawns through its real hook (R.skills.castId / the 'cast' bus event / R.skills.shots + zones / R.loot drops + take / 'levelup')
// and the pools return to idle; idle = 0 draw calls, busy ≤ 6; CPU per frame (update + buffer write) with everything at once;
// prefers-reduced-motion halves the counts; no errors. Screenshots at 390×844: .shots/rpg/spellfx_*.png
//   python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=… node tests/rpg/t_spellfx.js      (RPG_HTML=… RPG_NOBUILD=1 for another build)
'use strict';
const L = require('./lib');
const { ok, skip } = L;

(async () => {
  L.build();
  const { page, errors, cerrs, close } = await L.launch();
  const E = (fn, arg) => page.evaluate(fn, arg);
  let b;
  try { b = await L.boot(page, { save: L.fakeSave({ house: 'stark', hero: 'jon', cls: 'maester', lvl: 30 }) }); } catch (e) { ok('boot', false, e.message); await close(); return L.report(); }
  await E(() => { if (R.ui && R.ui.cur) R.ui.close(); });
  await L.steps(page, 10);
  const base = await E(() => ({ sf: !!R.spellfx, on: R.spellfx && R.spellfx.on, why: R.spellfx && R.spellfx.why, r3: !!(R.render3d && R.render3d.scene), sys: !!R.sys.spellfx, order: R.sys.spellfx && R.sys.spellfx.order,
    inScene: !!(R.render3d && R.render3d.scene.getObjectByName('spellfx')), kinds: R.spellfx && R.spellfx.kinds }));
  if (!base.r3) { skip('3D effects', 'no R.render3d'); ok('R.spellfx exists without WebGL and does not throw', base.sf && !base.on, JSON.stringify(base)); await close(); return L.report(); }
  ok('the layer is on, in the scene, system before the renderer (order < 900)', base.on && base.inScene && base.sys && base.order < 900, JSON.stringify({ on: base.on, why: base.why, order: base.order }));

  /* a quiet arena: the hero at a fixed spot, no mobs, camera snapped; R.running = false so rAF draws nothing (the test steps and draws by hand) */
  const arena = () => E(() => {
    R.running = false; const p = R.player; const S = R.spellfx;
    // a cast the way R.skills.cast does it (executor, then the 'cast' event) when castId refuses (the save's hero may carry another class)
    window.__cast = id => { const D = R.data.skills, sk = D[id]; R.player.cd = {}; if (R.skills.castId(id)) return true; const ok = R.skills.EX[sk.kind](sk, R.skills.val(id, 3), R.player) !== false; R.bus.emit('cast', id, 0); return ok; };
    for (const e of R.ents) if (e.kind === 'mob' || e.kind === 'boss' || e.kind === 'drop' || e.kind === 'proj' || e.kind === 'trap' || e.kind === 'critter') e.dead = true;
    R.ents = R.ents.filter(e => !e.dead || e === p); p.x = 2950; p.y = 2650; p.vx = p.vy = 0; p.hp = p.hpMax; p.cd = {}; p.status = {}; p.face = 1;
    if (R.skills) { R.skills.shots.length = 0; R.skills.zones.length = 0; } R.cam.yaw = 0; if (R.render.snapCam) R.render.snapCam();
    for (let i = 0; i < 3; i++) R.step(); S.clear(); for (let i = 0; i < 2; i++) R.step(); S.sys.draw(); return S.count();
  });
  const dummy = (dx, dy) => E(([dx, dy]) => { const p = R.player; return R.spawn({ kind: 'mob', team: 1, type: 'wight', name: 'Dummy', x: p.x + dx, y: p.y + dy, r: 14, hp: 1e6, hpMax: 1e6, lvl: 1, atk: 0, def: 0, spd: 0, ai: { off: true }, noLoot: true }).id; }, [dx, dy]);
  const stepDraw = n => E(n => { for (let i = 0; i < n; i++) R.step(); R.spellfx.sys.draw(); const S = R.spellfx; return { c: S.count(), n: S.stats.n, calls: S.stats.calls }; }, n);
  const untilIdle = (max) => E(max => { const S = R.spellfx; let i = 0; for (; i < max; i++) { R.step(); if (S.idle() && !S.count().drops) break; } S.sys.draw(); return { steps: i, idle: S.idle(), c: S.count(), calls: S.stats.calls, vis: S.gl.root.children.filter(o => o.visible).length }; }, max);

  const idle0 = await arena(); const d0 = await stepDraw(1);
  ok('idle: nothing live, 0 draw calls, every batch hidden', d0.calls === 0 && idle0.pts === 0, JSON.stringify({ idle0, calls: d0.calls }));

  /* ---- every effect through its real hook: it spawns, then the pools return to idle ---- */
  const CASES = [
    ['fireball (castId m_flask: shot → trail → burst + scorch)', 'castId', 'm_flask', [0, -230]],
    ['frost nova (castId m_frost)', 'castId', 'm_frost', [60, -40]],
    ['heal column + motes (castId m_tinct)', 'castId', 'm_tinct', null],
    ['wildfire pool + green mist (castId m_pool)', 'castId', 'm_pool', [0, -200]],
    ['fire rain (castId m_storm)', 'castId', 'm_storm', [0, -200]],
    ['cleave crescent (cast k_cleave)', 'bus', 'k_cleave', [50, -30]],
    ['whirl (cast k_whirl)', 'bus', 'k_whirl', [50, -30]],
    ['charge dust wake (cast k_lunge after a move)', 'dash', 'k_lunge', null],
    ['war cry shock ring (cast k_taunt)', 'bus', 'k_taunt', [80, -60]],
    ['volley streaks + impact puffs (EX.volley + cast r_volley)', 'ex', 'r_volley', [40, -220]],
    ['snare green mist (EX.trap → trap entity)', 'ex', 'r_snare', null],
    ['level-up pillar + spiral motes (bus levelup)', 'lvl', null, null]
  ];
  const results = {}; const T0 = Date.now();
  // a screenshot of the world only: any screen the test's own 'levelup' opened is closed first, then one real frame
  const snap = async name => { await E(() => { if (R.ui && R.ui.cur) R.ui.close(); R.drawAll(); }); await L.shot(page, name); };
  for (const [name, how, id, foe] of CASES) {
    await arena(); if (foe) await dummy(foe[0], foe[1]);
    const r = await E(([how, id]) => { const S = R.spellfx, p = R.player, D = R.data.skills; let fired = false;
      if (how === 'castId') fired = __cast(id);
      else if (how === 'bus') { R.bus.emit('cast', id, 0); fired = true; }
      else if (how === 'dash') { R.step(); const x0 = p.x; p.x += 160; R.bus.emit('cast', id, 0); p.x = x0 + 160; fired = true; }
      else if (how === 'ex') { const sk = D[id]; fired = R.skills.EX[sk.kind](sk, R.skills.val(id, 3), p) !== false; R.bus.emit('cast', id, 0); }
      else if (how === 'lvl') { R.bus.emit('levelup', R.state.p.lvl); fired = true; }
      let peak = { pts: 0, decal: 0, beam: 0 }; let calls = 0;
      for (let i = 0; i < 40; i++) { R.step(); if (i % 5 === 4) { S.sys.draw(); calls = Math.max(calls, S.stats.calls); } const c = S.count(); for (const k in peak) peak[k] = Math.max(peak[k], c[k]); }
      for (const e of R.ents.slice()) if (e.kind === 'trap') { e.dead = true; R.remove(e); }   // a snare lives 30 s: lift it (its removal puffs mist)
      return { fired, peak, calls }; }, [how, id]);
    const end = await untilIdle(900);
    results[name] = { peak: r.peak, end }; console.log('  ' + name + ' ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
    ok(name + ': spawns', r.fired && (r.peak.pts > 0 || r.peak.decal > 0), JSON.stringify(r));
    ok(name + ': pools back to idle, batches hidden', end.idle && end.vis === 0 && end.calls === 0, JSON.stringify(end));
  }
  // kinds that tell themselves apart: the nova and the cleave draw ground decals, the heal and the level-up draw beams
  ok('frost / cleave use ground decals, heal / level-up use beams', results[CASES[1][0]].peak.decal > 0 && results[CASES[5][0]].peak.decal > 0 && results[CASES[2][0]].peak.beam > 0 && results[CASES[11][0]].peak.beam > 0);

  /* ---- loot: tokens bob, rare+ get a beam, gold is a coin cluster; a pickup flies into the hero ---- */
  await arena();
  const loot = await E(() => { const S = R.spellfx, p = R.player, out = {};
    const at = (i) => ({ x: p.x - 90 + i * 45, y: p.y - 170 });
    const ds = []; for (let r = 0; r <= 4; r++) { const q = at(r); ds.push(R.loot.spawn('item', q.x, q.y, { rar: r, lvl: 10, scatter: false })); }
    const g = R.loot.spawn('gold', p.x + 20, p.y - 240, { amount: 40, scatter: false }); ds.push(g);
    for (let i = 0; i < 30; i++) R.step(); R.drawAll(); out.n = Object.assign({}, S.stats.n); out.calls = S.stats.calls; out.drops = S.count().drops;
    out.rare = ds.filter(e => e.sub === 'item' && (e.item.rar | 0) >= 2).length; out.rars = ds.map(e => e.item ? e.item.rar : e.sub);   // rolls may land above the floor
    return out; });
  ok('loot: 6 drops tracked, 5 gem tokens, a coin cluster, beams for rare / epic / legendary only', loot.drops === 6 && loot.n.gem === 5 && loot.n.coin >= 2 && loot.n.beam === loot.rare && loot.rare >= 3, JSON.stringify(loot));
  ok('loot: draw calls ≤ 6', loot.calls > 0 && loot.calls <= 6, String(loot.calls));
  await snap('spellfx_loot');
  const pick = await E(() => { const S = R.spellfx; const d = R.ents.filter(e => e.kind === 'drop'); let took = 0; for (const e of d.slice(0, 3)) if (R.loot.take(e)) took++;
    R.step(); R.step(); const m1 = S.count().mover; for (let i = 0; i < 6; i++) R.step(); R.drawAll(); const tok = S.stats.n.gem + S.stats.n.coin;
    for (let i = 0; i < 40; i++) R.step(); return { took, m1, tok, m2: S.count().mover, drops: S.count().drops }; });
  ok('pickup: a magnet arc per taken drop, done in under a second', pick.took === 3 && pick.m1 === 3 && pick.m2 === 0 && pick.drops === 3, JSON.stringify(pick));
  await E(() => { for (const e of R.ents) if (e.kind === 'drop') { e.dead = true; } R.ents = R.ents.filter(e => !e.dead); });
  const lootEnd = await untilIdle(300); ok('loot: idle once the drops are gone', lootEnd.idle && lootEnd.c.drops === 0 && lootEnd.calls === 0, JSON.stringify(lootEnd));

  /* ---- screenshots: fireball in flight, frost nova, heal, cleave + war cry ---- */
  await arena(); await dummy(250, -90);
  const fb = await E(() => { __cast('m_flask'); for (let i = 0; i < 12; i++) R.step(); R.drawAll(); const S = R.spellfx; return { n: S.stats.n, c: S.count(), beams: S.gl.beam.o.geometry.instanceCount, drops: R.ents.filter(e => e.kind === 'drop').map(e => [e.sub, e.x - R.player.x, e.y - R.player.y]) }; });
  console.log('  fireball frame', JSON.stringify(fb)); await snap('spellfx_fireball');
  await E(() => { for (let i = 0; i < 12; i++) R.step(); R.drawAll(); }); await snap('spellfx_fireball_hit');
  await arena(); await dummy(70, -60); await E(() => { __cast('m_frost'); for (let i = 0; i < 12; i++) R.step(); R.drawAll(); }); await snap('spellfx_frost');
  await arena(); await E(() => { __cast('m_tinct'); for (let i = 0; i < 24; i++) R.step(); R.drawAll(); }); await snap('spellfx_heal');
  await arena(); await dummy(60, -40); await E(() => { R.bus.emit('cast', 'k_cleave', 0); for (let i = 0; i < 6; i++) R.step(); R.drawAll(); }); await snap('spellfx_cleave');
  await arena(); await E(() => { R.bus.emit('levelup', 31); for (let i = 0; i < 40; i++) R.step(); R.drawAll(); }); await snap('spellfx_levelup');

  /* ---- cost: everything at once (casts, shots, zones, 20 drops) — the layer's own update + buffer write per frame ---- */
  await arena(); for (const q of [[0, -220], [120, -160], [-120, -160], [60, -40]]) await dummy(q[0], q[1]);
  const cost = await E(() => { const S = R.spellfx, p = R.player; const ms = []; let calls = 0, maxPts = 0;
    for (let i = 0; i < 20; i++) R.loot.spawn(i % 4 ? 'item' : 'gold', p.x + (i % 5) * 40 - 80, p.y - 120 - Math.floor(i / 5) * 40, { rar: i % 5, lvl: 5, amount: 12, scatter: false });
    for (let f = 0; f < 150; f++) {
      if (f % 30 === 0) { for (const id of ['m_flask', 'm_frost', 'm_tinct', 'm_pool', 'm_storm']) { __cast(id); } R.bus.emit('cast', 'k_cleave', 0); R.bus.emit('cast', 'k_taunt', 0); }
      if (f === 60) R.bus.emit('levelup', 32);
      R.step(); if (f % 50 === 49) R.drawAll(); else S.sys.draw(); ms.push(S.stats.ms); calls = Math.max(calls, S.stats.calls); maxPts = Math.max(maxPts, S.count().pts); }
    ms.sort((a, b) => a - b); return { med: +ms[ms.length >> 1].toFixed(3), p90: +ms[Math.floor(ms.length * 0.9)].toFixed(3), max: +ms[ms.length - 1].toFixed(3), calls, maxPts, dropped: S.stats.dropped, total: R.render3d.stats.calls }; });
  ok('cost: median ≤ 0.5 ms per frame with everything at once (update + buffer write)', cost.med <= 0.5, JSON.stringify(cost));
  ok('cost: ≤ 6 draw calls for the whole layer', cost.calls > 0 && cost.calls <= 6, String(cost.calls));
  await snap('spellfx_all');
  const after = await untilIdle(1200);
  await E(() => { for (const e of R.ents) if (e.kind === 'drop') e.dead = true; R.ents = R.ents.filter(e => !e.dead); });
  const after2 = await untilIdle(300);
  ok('cost: idle again afterwards', after2.idle && after2.calls === 0, JSON.stringify({ after: after.c, after2: after2.c }));

  /* ---- prefers-reduced-motion halves the counts ---- */
  const full = await E(() => { const S = R.spellfx; S.clear(); const p = R.player; S.play('frost', p.x, p.y, { r: 130 }); return S.count().pts; });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.R && R.spellfx && R.spellfx.on && R.player, null, { timeout: 20000 }).catch(() => {});
  const calm = await E(() => { const S = R.spellfx; if (!S || !S.on) return { on: false }; R.paused = true; S.clear(); const p = R.player; S.play('frost', p.x, p.y, { r: 130 }); return { on: true, calm: S.calm, pts: S.count().pts }; });
  ok('reduced motion: about half the particles', calm.on && calm.calm && calm.pts <= Math.ceil(full / 2) + 2 && calm.pts > 0, JSON.stringify({ full, calm }));

  const errs = errors.concat(cerrs.filter(t => /spellfx/i.test(t)));
  ok('no page errors, no spellfx console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await close(); L.report();
})();
