/* HOLDOR RPG — physics test (A45, G4). Part 1 (fakes): an impulse moves and decays to rest within 1.2 s; uphill is 25–35 % slower than flat,
   downhill 10–20 % faster, a > 0.9 slope is a wall; water (depth 0.5) slows to ~55 % with a splash on entry and ripples;
   knock from R.hit becomes an impulse (position changes over several steps, not one); a big hit gives hit-stop + flash +
   camera kick; a knocked mob that dies tumbles (z rises, lands, one bounce); walkers do not; footsteps fire every 0.28 s
   with the right surface (grass / snow + prints / stone / wet / sand); arrows fly on a lob, land and stay 6 s in the ground,
   bolts do not; R.phys.off restores the raw behaviour; 60 entities × 600 steps < 300 ms.
   Fakes only what the build lacks (R.hit, R.fx); R.world.slide is always faked to free movement, groundY / water to fields.
   Part 2 (the integrated build, real player / combat / world / terrain / water / nature / loot): the Winterfell push bug (stick right
   60 steps: x only), the R.hit chain does not grow, weight (accel ~0.12 s, stop ~0.1 s, reversal, sprint), slopes / wall / wading /
   ice under the real player, R.hit knock + giants + the kill launch, one-bounce drops, rock / tower colliders + sliding + no
   tunnelling, the blocked mask, a crowd without jitter, falls + landing kick (hero and mobs), no drift at rest, dodge immediacy,
   other systems' moves untouched, the budget (40 mobs + 15 critters + the hero).
   Run after `python3 src/build_rpg.py beta/index.html`:
   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_physics.js   (HOLDOR_HTML=path overrides) */
const { chromium } = require('playwright');
const path = require('path');
const html = process.env.HOLDOR_HTML || 'beta/index.html';
const file = path.isAbsolute(html) ? html : path.resolve(__dirname, '..', '..', html);
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (extra != null ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.R && R.phys && R.step && R.spawn, { timeout: 15000 });

  const setup = await page.evaluate(() => {
    R.rng(7); R.running = false; R.paused = false; R.ents.length = 0; R.t = 0;
    R.world = R.world || {};
    R.world.slide = (e, dx, dy) => { e.x += dx; e.y += dy; return true; };   // free movement in A06's form (A11's moveEnt reads the arity)
    R.world.blocked = () => false; R.world.regionAt = () => null; R.world.inPoi = () => false;
    window.__ground = () => 0; R.render3d = { groundY: (x, y) => window.__ground(x, y) };
    window.__depth = () => 0; R.water = { depth: (x, y) => window.__depth(x, y) };
    window.__hitFaked = !R.hit;
    if (!R.hit) R.hit = (src, tgt, dmg, o) => { o = o || {}; if (!tgt || tgt.dead) return null; tgt.hp -= dmg; if (src) tgt.lastHitBy = src;
      if (o.knock) { const dx = tgt.x - src.x, dy = tgt.y - src.y, m = Math.hypot(dx, dy) || 1; tgt.x += dx / m * o.knock; tgt.y += dy / m * o.knock; }
      const info = { src, tgt, dmg, crit: false, kind: o.kind || 'phys', dot: !!o.dot, absorbed: 0, blocked: false, killed: false, o };
      R.bus.emit('hit', info); if (tgt.hp <= 0) { info.killed = true; R.kill(tgt); } return info; };
    window.__fxFaked = !R.fx; R.fx = R.fx || {}; const sh0 = R.fx.shake; window.__shakes = [];
    R.fx.shake = (px, s) => { window.__shakes.push(px); if (sh0) sh0(px, s); }; R.fx.spawn = R.fx.spawn || (() => null); R.fx.num = R.fx.num || (() => {});
    R.addSys('tmove', { order: 80, update(dt) { for (const e of R.ents) if (e.mv && !e.dead) { e.x += e.mv.x * dt; e.y += e.mv.y * dt; } } });   // stands for the player / AI movers
    window.__steps = []; R.bus.on('footstep', (e, s) => window.__steps.push({ id: e.id, s }));
    window.__splash = 0; R.bus.on('splash', () => window.__splash++);
    window.mob = (x, y, o) => R.spawn(Object.assign({ kind: 'mob', type: 'axe', x, y, r: 12, team: 1, hp: 1000, hpMax: 1000, lvl: 1, name: 'T', vx: 0, vy: 0, ai: { off: true } }, o || {}));   // ai.off: A11 leaves them to the test mover
    R.player = R.spawn({ kind: 'player', x: 500, y: 500, r: 14, team: 0, hp: 500, hpMax: 500, lvl: 1, name: 'Hero' });
    return { pre: !!R.sys.physPre, post: !!R.sys.physPost, draw: !!R.sys.physDraw, orders: [R.sys.physPre && R.sys.physPre.order, R.sys.physPost && R.sys.physPost.order], hitFaked: window.__hitFaked, fxFaked: window.__fxFaked, wrapped: !!(R.hit && R.hit.__phys) };
  });
  ok(setup.pre && setup.post && setup.draw && setup.orders[0] === 79 && setup.orders[1] === 101, 'physPre 79 / physPost 101 / physDraw registered', setup);

  /* 1. an impulse moves the entity and decays to rest within 1.2 s */
  const r1 = await page.evaluate(() => {
    const m = mob(1000, 1000); R.phys.impulse(m, 300, 0); const xs = [];
    for (let i = 0; i < 72; i++) { R.step(); xs.push(m.x); }
    return { moved: m.x - 1000, tail: Math.abs(xs[71] - xs[65]), imp: m.imp.x, vel: Math.abs(m.vel.x), early: xs[2] - 1000, wrapped: !!R.hit.__phys };
  });
  ok(r1.moved > 20 && r1.moved < 60, 'impulse 300 u/s moves 20–60 units on the ground (friction 8/s)', r1.moved);
  ok(r1.early > 5 && r1.early < 20, 'most of it in the first steps', r1.early);
  ok(r1.tail < 0.5 && r1.imp === 0 && r1.vel < 3, 'at rest by 1.2 s (imp 0, vel < 3)', { tail: r1.tail, imp: r1.imp, vel: r1.vel });
  ok(r1.wrapped, 'R.hit is wrapped by physics (re-wrapped after the test fake)');

  /* 2 + 3. slopes and water: movers at 170 u/s on flat, uphill (gradient 0.45), downhill, a cliff (gradient 2) and in water */
  const r2 = await page.evaluate(() => {
    window.__ground = (x, y) => (y > 5000 && y < 7000) ? x * 0.45 : (y > 8000 && y < 9500 && x > 1200) ? (x - 1200) * 2 : 0;
    window.__depth = (x, y) => (y > 2000 && y < 3000) ? 0.5 : 0;
    const A = mob(1000, 1000, { mv: { x: 170, y: 0 } }), B = mob(1000, 6000, { mv: { x: 170, y: 0 } }), C = mob(1000, 6100, { mv: { x: -170, y: 0 } });
    const D = mob(1150, 9000, { mv: { x: 170, y: 0 } }), E = mob(1000, 2500, { mv: { x: 170, y: 0 } }), F = mob(1000, 1990, { mv: { x: 0, y: 100 } });
    window.__splash = 0; R.phys.ripples.length = 0;
    for (let i = 0; i < 60; i++) R.step();
    const dA = A.x - 1000, dB = B.x - 1000, dC = 1000 - C.x, dE = E.x - 1000;
    return { dA, up: dB / dA, down: dC / dA, cliff: D.x, wall: R.phys.gradAt(1210, 9000).m, water: dE / dA, splash: window.__splash, wadingE: !!E.wading, wadingF: !!F.wading, depthF: F.depth, ripples: R.phys.ripples.length, sf: R.phys.speedFactor(B, 1, 0) };
  });
  ok(r2.dA > 165 && r2.dA < 175, 'flat: 170 u/s stays 170 u/s', r2.dA);
  ok(r2.up >= 0.65 && r2.up <= 0.75, 'uphill (gradient 0.45) is 25–35 % slower', r2.up);
  ok(r2.down >= 1.1 && r2.down <= 1.2, 'downhill is 10–20 % faster', r2.down);
  ok(r2.wall > 0.9 && r2.cliff > 1180 && r2.cliff < 1210, 'a > 0.9 slope blocks like a wall (170 u/s for 1 s, stopped at the cliff foot x≈1200)', { x: r2.cliff, grad: r2.wall });
  ok(r2.water >= 0.5 && r2.water <= 0.6, 'water depth 0.5 slows to ~55 %', r2.water);
  ok(r2.splash >= 1 && r2.wadingE && r2.wadingF && r2.depthF === 0.5, 'entering water splashes; e.wading / e.depth set', { splash: r2.splash, wF: r2.wadingF });
  ok(r2.ripples >= 1, 'ripples while wading', r2.ripples);
  ok(Math.abs(r2.sf - r2.up) < 0.03, 'P.speedFactor agrees with the measured slowdown', r2.sf);

  /* 4. knock from R.hit is an impulse: the position changes over several steps, not in one */
  const r4 = await page.evaluate(() => {
    const src = mob(1000, 1200, { team: 0 }), tgt = mob(1030, 1200);
    const res = R.hit(src, tgt, 10, { knock: 50 });
    const instant = tgt.x - 1030; for (let i = 0; i < 3; i++) R.step(); const after3 = tgt.x - 1030; for (let i = 0; i < 69; i++) R.step();
    const total = tgt.x - 1030;
    const big = mob(1030, 1300, { type: 'giant', big: 1.9, hp: 5000, hpMax: 5000 }); R.hit(src, big, 10, { knock: 50 }); for (let i = 0; i < 72; i++) R.step();
    return { ok: !!res, instant, after3, total, imp: !!tgt.imp, bigMoved: big.x - 1030, mass: R.phys.massOf(big) };
  });
  ok(r4.ok && Math.abs(r4.instant) < 0.01, 'no teleport at the hit', r4.instant);
  ok(r4.after3 > 5 && r4.after3 < 20 && r4.total > 20 && r4.total < 60 && r4.imp, 'the knock plays out over the following steps', { after3: r4.after3, total: r4.total });
  ok(r4.mass >= 1.4 && r4.bigMoved > 0 && r4.bigMoved < r4.total * 0.45, 'a giant resists the knock (×0.3)', { big: r4.bigMoved, man: r4.total });

  /* 4b. impact feel: a hit over 15 % of hpMax → hit-stop, white flash, camera kick */
  const r4b = await page.evaluate(() => {
    const src = mob(1000, 1500, { team: 0 }), t = mob(1030, 1500, { hp: 100, hpMax: 100 }), small = mob(1030, 1550, { hp: 1000, hpMax: 1000 });
    window.__shakes = []; R.hit(src, t, 40, {}); const n1 = window.__shakes.length; const stun = t.stunMicro, flash = t.flash;
    R.hit(src, small, 40, {}); const n2 = window.__shakes.length;
    t.mv = { x: 170, y: 0 }; const x0 = t.x; R.step(); const held = t.x - x0; R.step(); R.step(); R.step(); R.step(); const later = t.x - x0;
    return { stun, flash, kicked: n1 >= 1, smallKick: n2 - n1, px: window.__shakes[0], held, later };
  });
  ok(r4b.stun > 0.04 && r4b.flash > 0.07 && r4b.kicked && r4b.px >= 3, 'big hit: stunMicro 45 ms, flash 80 ms, R.fx.shake', r4b);
  ok(r4b.smallKick === 0, 'a 4 % hit gives no camera kick');
  ok(Math.abs(r4b.held) < 0.01 && r4b.later > 2, 'motion is held during the hit-stop, then resumes', { held: r4b.held, later: r4b.later });

  /* 5. death tumble: a knocked mob that dies rises, lands, bounces once; walkers and giants do not */
  const r5 = await page.evaluate(() => {
    const src = mob(1000, 1700, { team: 0 }), v = mob(1030, 1700, { hp: 5, hpMax: 5 }), w = mob(1030, 1800, { type: 'walker', walker: true, hp: 5, hpMax: 5 });
    R.hit(src, v, 100, { knock: 50 }); R.hit(src, w, 100, { knock: 50 });
    const zs = []; let angMax = 0; for (let i = 0; i < 45; i++) { R.step(); zs.push(+(v.z || 0).toFixed(2)); if (v.tumble) angMax = Math.max(angMax, v.tumble.ang); }
    let peak1 = 0, i1 = -1; for (let i = 0; i < zs.length; i++) { if (zs[i] > peak1) peak1 = zs[i]; if (peak1 > 5 && zs[i] === 0) { i1 = i; break; } }
    let peak2 = 0; if (i1 > 0) for (let i = i1 + 1; i < zs.length; i++) peak2 = Math.max(peak2, zs[i]);
    return { dead: v.dead, tumble: !!v.tumble, bounced: !!(v.tumble && v.tumble.bounced), done: !!(v.tumble && v.tumble.done), peak1, i1, peak2, end: zs[zs.length - 1], angMax, walker: !!w.tumble, slid: v.x - 1030 };
  });
  ok(r5.dead && r5.tumble && r5.peak1 > 8 && r5.peak1 < 20, 'the killed mob tumbles: z rises to ~14', { peak: r5.peak1 });
  ok(r5.i1 > 10 && r5.peak2 > 0.5 && r5.peak2 < 5 && r5.bounced, 'lands, then one small bounce', { land: r5.i1, bounce: r5.peak2 });
  ok(r5.done && r5.end === 0 && r5.angMax > 1, 'rests at z 0 within 0.75 s, having spun (tumble.ang)', { end: r5.end, ang: r5.angMax });
  ok(r5.slid > 10, 'the corpse slides with the knock', r5.slid);
  ok(!r5.walker, 'a walker does not tumble (it shatters)');

  /* 6. footsteps every 0.28 s with the right surface; snow leaves prints */
  const r6 = await page.evaluate(() => {
    R.world.regionAt = (x, y) => (y > 4000 && y < 4500) ? { id: 'north', biome: 'snow', name: 'The North' } : (y > 5100 && y < 5400) ? { id: 'dorne', biome: 'desert', name: 'Dorne' } : null;
    R.world.inPoi = (x, y) => y > 4600 && y < 4900;
    const G = mob(3000, 1000, { mv: { x: 170, y: 0 } }), H = mob(3000, 4200, { mv: { x: 170, y: 0 } }), I = mob(3000, 4750, { mv: { x: 170, y: 0 } });
    const J = mob(3000, 2500, { mv: { x: 170, y: 0 } }), K = mob(3000, 5250, { mv: { x: 170, y: 0 } }), S = mob(3000, 1200);
    window.__steps = []; R.phys.prints.length = 0;
    for (let i = 0; i < 84; i++) R.step();
    const of = e => window.__steps.filter(s => s.id === e.id).map(s => s.s);
    return { G: of(G), H: of(H), I: of(I), J: of(J), K: of(K), S: of(S), prints: R.phys.prints.length, print: R.phys.prints[0] };
  });
  ok(r6.G.length >= 4 && r6.G.length <= 6 && r6.G.every(s => s === 'grass'), '1.4 s of walking → 4–6 footsteps on grass', r6.G);
  ok(r6.H.length >= 4 && r6.H.every(s => s === 'snow'), 'snow in a cold region', r6.H);
  ok(r6.I.length >= 4 && r6.I.every(s => s === 'stone'), 'stone inside a POI', r6.I);
  ok(r6.J.length >= 2 && r6.J.every(s => s === 'wet'), 'wet in water (slower, fewer steps)', r6.J);
  ok(r6.K.length >= 4 && r6.K.every(s => s === 'sand'), 'sand in Dorne', r6.K);
  ok(r6.S.length === 0, 'no footsteps while standing');
  ok(r6.prints >= 3 && r6.prints <= 60 && r6.print && typeof r6.print.ang === 'number', 'snow footprints in R.phys.prints', { n: r6.prints });

  /* 7. arrows fly on a lob and land; bolts do not */
  const r7 = await page.evaluate(() => {
    const src = mob(1000, 3500, { team: 0, atk: 10 });
    const mk = o => { if (R.shoot) return R.shoot(src, 1, 0, o); return R.spawn(Object.assign({ kind: 'proj', x: 1020, y: 3500, vx: o.speed || 520, vy: 0, mv: { x: o.speed || 520, y: 0 }, z: 18, ttl: (o.range || 420) / (o.speed || 520), team: 0, hpMax: 0, hp: 0, r: 3, src, hitIds: [], drawKind: o.drawKind || 'arrow', o: {} }, o.drawKind ? {} : {})); };
    const a = mk({ range: 420, speed: 520 }), b = mk({ range: 420, speed: 520, drawKind: 'bolt' });
    R.step(); const vz0 = a.vz, bvz = b.vz, bz = b.z; const zs = [a.z];
    for (let i = 0; i < 59; i++) { R.step(); zs.push(+a.z.toFixed(1)); }
    const maxZ = Math.max(...zs);
    const landed = !!a.stuck, inStuck = R.phys.stuck.includes(a), inEnts = R.ents.includes(a), x = a.x;
    for (let i = 0; i < 390; i++) R.step();
    return { vz0, maxZ, landed, inStuck, inEnts, x, gone: !R.phys.stuck.includes(a), bvz, bz, bStuck: !!b.stuck, shoot: !!R.shoot };
  });
  ok(r7.vz0 >= 120 && r7.maxZ > 25, 'an arrow gets vz ≥ 120 and arcs', { vz0: r7.vz0, maxZ: r7.maxZ });
  ok(r7.landed && r7.inStuck && !r7.inEnts && r7.x > 1300, 'it lands near its range end, leaves R.ents, stays in R.phys.stuck', { x: r7.x });
  ok(r7.gone, 'the stuck arrow is gone after 6.5 s');
  ok(r7.bvz == null && r7.bz === 18 && !r7.bStuck, 'a bolt has no gravity', { bvz: r7.bvz, bz: r7.bz });

  /* 8. R.phys.off restores the raw behaviour */
  const r8 = await page.evaluate(() => {
    R.phys.off = true;
    const L = mob(5000, 6000, { mv: { x: 170, y: 0 } }), L2 = mob(5000, 1000); R.phys.impulse(L2, 300, 0);
    const src = mob(5000, 1300, { team: 0 }), t = mob(5030, 1300); R.hit(src, t, 10, { knock: 50 }); const instant = t.x - 5030;
    window.__steps = []; for (let i = 0; i < 60; i++) R.step();
    const out = { slope: L.x - 5000, imp: L2.x - 5000, instant, steps: window.__steps.length };
    R.phys.off = false; return out;
  });
  ok(r8.slope > 165 && r8.slope < 175, 'off: no slope slowdown', r8.slope);
  ok(r8.imp === 0, 'off: impulses do not move', r8.imp);
  ok(Math.abs(r8.instant - 50) < 0.01, 'off: knock is the instant 50-unit push', r8.instant);
  ok(r8.steps === 0, 'off: no footstep events');

  /* 9. cost: 60 entities × 600 steps */
  const r9 = await page.evaluate(() => {
    R.ents.length = 0; R.player = R.spawn({ kind: 'player', x: 500, y: 500, r: 14, team: 0, hp: 500, hpMax: 500 });
    for (let i = 0; i < 60; i++) { const a = R.rng() * 6.283; mob(800 + R.rng() * 600, 1500 + R.rng() * 5000, { mv: { x: Math.cos(a) * 120, y: Math.sin(a) * 120 }, big: i % 10 === 0 ? 1.9 : 0 }); }
    R.phys.impulse(R.ents[5], 200, 100);
    /* the machine is shared (load ≫ cores): 12 batches of 50 steps, the least disturbed batch is the cost */
    let best = 1e9, bestPhys = 1e9; for (let b = 0; b < 12; b++) { const t0 = performance.now(); let phys = 0; for (let i = 0; i < 50; i++) { R.step(); phys += R.phys.stats.ms; } best = Math.min(best, (performance.now() - t0) / 50); bestPhys = Math.min(bestPhys, phys / 50); }
    return { ms: best, phys: bestPhys, movers: R.phys.stats.movers };
  });
  ok(r9.phys < 0.5 && r9.ms < 1.5, '60 entities × 600 steps: physics < 0.5 ms per step, the whole step < 1.5 ms (least disturbed of 12 batches)', { stepMs: +r9.ms.toFixed(3), physMs: +r9.phys.toFixed(3), movers: r9.movers });

  ok(errors.length === 0, 'no page errors (part 1)', errors);
  await browser.close();

  /* ================= part 2: the integrated build — the real player, combat, world, terrain, water, nature, loot =================
     (only the ground is flattened where a check needs exact numbers; R.render3d.groundY is put back after each) */
  const L = require('./lib');
  const G = await L.launch();
  const pg = G.page;
  await L.boot(pg, { html: file, save: L.fakeSave({ house: 'stark', lvl: 5 }) });
  await pg.evaluate(() => { R.running = false; try { if (R.ui && R.ui.cur) R.ui.close(); } catch (e) {} for (let i = 0; i < 30; i++) R.step(); });

  /* 10. the known bug: a Stark hero at Winterfell holding the stick right for 60 steps moved +149 x and +960 y (the world watcher
         pushed him out of his own gated region twice). Now: x only. */
  const b1 = await pg.evaluate(() => {
    const p = R.player, x0 = p.x, y0 = p.y, rg = R.world.regionAt(p.x, p.y);
    R.input.move = { x: 1, y: 0 }; let maxJump = 0, lx = p.x, ly = p.y;
    for (let i = 0; i < 60; i++) { R.step(); maxJump = Math.max(maxJump, Math.hypot(p.x - lx, p.y - ly)); lx = p.x; ly = p.y; }
    R.input.move = { x: 0, y: 0 }; for (let i = 0; i < 10; i++) R.step();
    return { dx: p.x - x0, dy: p.y - y0, maxJump, region: rg && rg.id, gated: !!(rg && rg.gate), open: R.world.gateOpen(rg), wrapped: !!R.world.gateOpen.__phys };
  });
  ok(b1.region === 'north' && b1.gated && b1.open && b1.wrapped, 'Winterfell lies in the gated North; for a Stark it counts as open (home gate)', b1);
  ok(b1.dx > 120 && b1.dx < 180 && Math.abs(b1.dy) < 8 && b1.maxJump < 6, 'stick right 60 steps at Winterfell: x moves 120–180, |y| < 8, no step jumps > 6 units', { dx: +b1.dx.toFixed(1), dy: +b1.dy.toFixed(1), jump: +b1.maxJump.toFixed(2) });

  /* helpers in the page: flat ground, a clean spot, the hero's speed per step; __K = the world data's scale (R.WS once A07 scales it) */
  await pg.evaluate(() => {
    window.__K = ((R.world && R.world.size && R.world.size()[0]) || 7200) / 7200;
    /* __flat: level ground and no A43 obstacles in A06's slide (they stream in as the hero moves); __unflat puts both back */
    window.__g0 = R.render3d && R.render3d.groundY; window.__xb = undefined;
    window.__flat = () => { if (R.render3d) R.render3d.groundY = () => 0; if (R.world && window.__xb === undefined) { window.__xb = R.world.extraBlocked || null; R.world.extraBlocked = null; }
      if (R.nature && !window.__nb) { window.__nb = R.nature.blockedAt; R.nature.blockedAt = () => false; } };
    window.__unflat = () => { if (R.render3d && window.__g0) R.render3d.groundY = window.__g0; if (window.__xb !== undefined) { R.world.extraBlocked = window.__xb; window.__xb = undefined; }
      if (window.__nb) { R.nature.blockedAt = window.__nb; window.__nb = null; } };
    window.__clear = () => { for (let i = R.ents.length - 1; i >= 0; i--) { const e = R.ents[i]; if (e !== R.player && e.kind !== 'npc' && e.kind !== 'portal') R.remove(e); } R.world.populate = false; };
    window.__put = (x, y) => { R.input.move = { x: 0, y: 0 }; const p = R.player; p.x = x; p.y = y; p.prev = { x, y }; if (p.walk) { p.walk.x = 0; p.walk.y = 0; } p.imp = { x: 0, y: 0 }; p.z = 0; p.vz = 0; p.air = false; p.gy = null; p.status = {}; p.atkT = 0; p.dodgeT = 0; p.combatT = -99; p.moveT = 0; p.sprint = false; };
    window.__hold = (mx, my, n) => { const p = R.player, sp = []; R.input.move = { x: mx, y: my }; for (let i = 0; i < n; i++) { const x = p.x, y = p.y; if (window.__calm) p.combatT = -99; R.step(); sp.push(Math.hypot(p.x - x, p.y - y) * 60); } return sp; };
    window.__free = () => { R.input.move = { x: 0, y: 0 }; };
    /* a free open spot: 400×400 units with no mask cell, no POI, no collider, no water */
    /* a free open spot: 400×400 units with no mask cell, no POI, no water, and a clear ±500 line east–west (A06's obstacles, A43's rocks
       around it once its chunks are built) */
    window.__spot = () => { const cands = [];
      const K = window.__K; for (let y = 6500 * K; y < 9500 * K && cands.length < 12; y += 200 * K) for (let x = 1500 * K; x < 6000 * K && cands.length < 12; x += 200 * K) { let okk = true;
        for (let yy = y - 200; yy <= y + 200 && okk; yy += 50) for (let xx = x - 200; xx <= x + 200 && okk; xx += 50) if (R.world.blocked(xx, yy) || (R.water && R.water.depth(xx, yy) > 0) || R.world.poiAt(xx, yy, 200)) okk = false;
        if (okk) cands.push({ x, y }); }
      const clear = c => { for (let xx = c.x - 500; xx <= c.x + 500; xx += 8) { if (R.world.blocked(xx, c.y) || (R.water && R.water.depth(xx, c.y) > 0)) return false;
          if (R.world.obstacleAt && R.world.obstacleAt(xx, c.y, 16)) return false; if (R.nature && R.nature.blockedAt && R.nature.blockedAt(xx, c.y, 16)) return false; } return true; };
      for (const c of cands) { window.__put(c.x, c.y); for (let i = 0; i < 30; i++) R.step(); if (clear(c)) return c; }
      return cands[0] || { x: 3000, y: 6000 }; };
    window.__clear(); const s = window.__spot(); window.__S = s; window.__put(s.x, s.y); R.phys.extra.length = 0; R.phys.natureCols = false;   /* A43's trees off for the exact numbers; part 15 turns them back on */
  });

  /* 11. weight: full speed in ~0.12 s, a stop in ~0.1 s, a reversal takes longer, sprint after 1.5 s */
  const w = await pg.evaluate(() => {
    __flat(); __put(__S.x, __S.y); const p = R.player; R.nature && (R.nature.obstacles = []); R.phys.extra.length = 0;
    const acc = __hold(1, 0, 30); const x1 = p.x; R.input.move = { x: 0, y: 0 }; const brake = []; for (let i = 0; i < 12; i++) { const x = p.x; R.step(); brake.push((p.x - x) * 60); } const skid = p.x - x1;
    const stopAt = brake.findIndex(v => v < 1);
    __put(__S.x, __S.y); __hold(1, 0, 30); const rev = __hold(-1, 0, 30); const vx = []; // the signed x velocity after the reversal
    __put(__S.x, __S.y); __hold(1, 0, 30); const rx = []; R.input.move = { x: -1, y: 0 }; for (let i = 0; i < 20; i++) { const x = p.x; R.step(); rx.push((p.x - x) * 60); }
    const flipAt = rx.findIndex(v => v < -150);
    __clear(); __put(__S.x, __S.y); window.__calm = true; const spr = __hold(1, 0, 130); window.__calm = false;   /* a world event's mob may wander in: no combat */ window.__sprTr = spr.filter((_, i) => i % 10 === 0).map(v => Math.round(v)).join(',') + ' x' + Math.round(p.x - __S.x) + ' st ' + JSON.stringify(p.status) + ' sprint ' + p.sprint + ' anim ' + p.anim + ' atk ' + p.attacking() + ' dead ' + p.dead + ' cur ' + (R.ui && R.ui.cur) + ' moveT ' + (+p.moveT).toFixed(2) + ' combat ' + (R.t - p.combatT).toFixed(2) + ' hb ' + (p.lastHitBy && p.lastHitBy.kind); __free(); for (let i = 0; i < 20; i++) R.step();
    __unflat();
    return { spd: p.spd, a3: acc[2], a5: acc[4], a8: acc[7], a12: acc[11], full: acc[29], stopAt, skid, flipAt, sprint: spr.slice(-10).reduce((a, b) => a + b, 0) / 10, sprintFlag: p.sprint, walk: !!p.walk, tr: window.__sprTr };
  });
  ok(w.walk && w.a3 > 40 && w.a3 < 150 && w.a8 >= w.spd * 0.95, "acceleration: ~0.05 s → 40–150 u/s, by 0.13 s ≥ 95 % of full speed (full in ~0.12 s)", { a3: Math.round(w.a3), a5: Math.round(w.a5), a8: Math.round(w.a8) });
  ok(Math.abs(w.full - w.spd) < 2, 'cruise speed stays the hero\'s speed (e.spd, ~170 u/s) on flat ground', { v: Math.round(w.full), spd: w.spd });
  ok(w.stopAt >= 3 && w.stopAt <= 8 && w.skid > 3 && w.skid < 14, 'braking: stopped within ~0.1 s, skids 3–14 units', { steps: w.stopAt, skid: +w.skid.toFixed(1) });
  ok(w.flipAt >= 8 && w.flipAt <= 18, 'a reversal carries momentum: −150 u/s reached after 0.13–0.3 s', w.flipAt);
  ok(Math.abs(w.sprint - w.spd * 240 / 170) < 4, 'sprint after 1.5 s of running: spd × 240/170 (ramped by the same weight)', { v: Math.round(w.sprint), want: Math.round(w.spd * 240 / 170), tr: Math.abs(w.sprint - w.spd * 240 / 170) >= 4 ? w.tr : undefined });

  /* 12. slopes, water and ice under the real player module */
  const sl = await pg.evaluate(() => {
    const p = R.player, S = __S, res = {};
    __flat(); R.render3d.groundY = (x, y) => (x - S.x) * 0.45; __put(S.x, S.y); const up = __hold(1, 0, 40).slice(-10).reduce((a, b) => a + b, 0) / 10; __free(); for (let i = 0; i < 10; i++) R.step();
    __put(S.x, S.y); const dn = __hold(-1, 0, 40).slice(-10).reduce((a, b) => a + b, 0) / 10; __free(); for (let i = 0; i < 10; i++) R.step();
    R.render3d.groundY = (x, y) => (x > S.x + 30 ? (x - S.x - 30) * 2.2 : 0); __put(S.x, S.y); __hold(1, 0, 60); const wallX = p.x - S.x; __free(); for (let i = 0; i < 10; i++) R.step();
    __flat(); const W0 = R.water; const dfake = { depth: () => 0.5, isWater: () => true, kindAt: () => 'river' }; R.water = Object.assign(Object.create(W0 || {}), dfake);
    __put(S.x, S.y); const wade = __hold(1, 0, 40).slice(-10).reduce((a, b) => a + b, 0) / 10; const wading = p.wading; __free(); for (let i = 0; i < 10; i++) R.step();
    /* ice: frozen water in the cold (R.world.regionAt says the North) */
    const rg0 = R.world.regionAt; R.world.regionAt = () => ({ id: 'north', biome: 'snow', name: 'The North' });
    __put(S.x, S.y); __hold(1, 0, 60); const iceTop = p.x; R.input.move = { x: 0, y: 0 }; for (let i = 0; i < 60; i++) R.step(); const iceSkid = p.x - iceTop; const onIce = p.onIce;
    R.world.regionAt = rg0; R.water = W0; __unflat(); __free(); __put(S.x, S.y);
    /* the ice field beyond the Wall is a fixed noise patch */
    let pt = null; const K = __K; for (let y = 200 * K; y < 900 * K && !pt; y += 37) for (let x = 2000 * K; x < 5000 * K && !pt; x += 41) { const r = R.world.regionAt(x, y); if (r && /beyond|winter/.test(r.id) && R.phys.icePatch(x, y) && !R.world.blocked(x, y)) pt = { x, y, id: r.id }; }
    return { up: up / 170, dn: dn / 170, wallX, wade: wade / 170, wading, iceSkid, onIce, icePt: pt, iceAt: pt ? R.phys.iceAt(pt.x, pt.y) : null };
  });
  ok(sl.up > 0.62 && sl.up < 0.8, 'uphill (gradient 0.45): 20–38 % slower', +sl.up.toFixed(3));
  ok(sl.dn > 1.05 && sl.dn < 1.2, 'downhill: 5–20 % faster', +sl.dn.toFixed(3));
  ok(sl.wallX > 15 && sl.wallX < 45, 'a 2.2 slope is a wall: the hero stops at its foot', +sl.wallX.toFixed(1));
  ok(sl.wade > 0.5 && sl.wade < 0.6 && sl.wading, 'wading (R.water.depth 0.5) slows him to ~55 %', +sl.wade.toFixed(3));
  ok(sl.onIce && sl.iceSkid > 30, 'on ice (frozen water in the North) he slides on after the stick is let go', +sl.iceSkid.toFixed(1));
  ok(sl.icePt && sl.iceAt === true, 'ice patches exist beyond the Wall (R.phys.iceAt)', sl.icePt);

  /* 13. knockback with friction from the real R.hit, heavy enemies barely move, the death tumble from the killing blow */
  const kb = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y);
    const mk = (type, dx, dy) => { const m = R.spawnMob(type, S.x + dx, S.y + dy, 5); m.ai = Object.assign(m.ai || {}, { off: true }); m.hp = m.hpMax = 99999; return m; };
    const a = mk('axe', 40, 0), gi = mk('giant', 0, 80), out = {};
    R.hit(p, a, 1, { knock: 40 }); R.hit(p, gi, 1, { knock: 40 }); const ax0 = S.x + 40, gy0 = S.y + 80; out.instant = a.x - ax0;
    const xs = []; for (let i = 0; i < 72; i++) { R.step(); xs.push(a.x - ax0); }
    out.after3 = xs[2]; out.total = xs[71]; out.rest = Math.abs(xs[71] - xs[60]); out.giant = gi.y - gy0; out.mGiant = R.phys.massOf(gi);
    /* a kill without any knock still launches the body away from the hero and tumbles it */
    const v = mk('sword', -40, 0); v.hp = 5; const vx0 = v.x; R.hit(p, v, 9999, {}); const zs = [];
    for (let i = 0; i < 50; i++) { R.step(); zs.push(v.z || 0); }
    out.kdead = v.dead; out.ktumble = !!v.tumble; out.kpeak = Math.max(...zs); out.kslide = vx0 - v.x; out.kdone = !!(v.tumble && v.tumble.done);
    __unflat(); __clear(); return out;
  });
  ok(Math.abs(kb.instant) < 0.01 && kb.after3 > 3 && kb.total > 15 && kb.total < 50 && kb.rest < 0.5, 'R.hit knock 40: no teleport, flies back over steps, skids to rest (friction)', kb);
  ok(kb.mGiant >= 1.4 && kb.giant >= 0 && kb.giant < kb.total * 0.4, 'a giant barely moves (mass ≥ 1.4)', { giant: +kb.giant.toFixed(1), man: +kb.total.toFixed(1) });
  ok(kb.kdead && kb.ktumble && kb.kpeak > 8 && kb.kslide > 5 && kb.kdone, 'a kill without knock: the body is launched away from the blow, tumbles and settles', { peak: +kb.kpeak.toFixed(1), slide: +kb.kslide.toFixed(1) });

  /* 14. loot drops bounce exactly once */
  const lt = await pg.evaluate(() => {
    __clear(); const S = __S; if (!R.loot || !R.loot.spawn) return { none: true };
    const ds = []; for (let i = 0; i < 6; i++) ds.push(R.loot.spawn('mat', S.x + 300, S.y + 60, { lvl: 3, angle: i }));
    const zs = ds.map(() => []); for (let i = 0; i < 90; i++) { R.step(); ds.forEach((d, k) => zs[k].push(d.z || 0)); }
    const bounces = zs.map(z => { let n = 0, up = false; for (let i = 1; i < z.length; i++) { if (z[i] > z[i - 1] && !up && z[i - 1] === 0) { n++; up = true; } if (z[i] === 0) up = false; } return n; });
    const out = { bounces, end: ds.map(d => d.z || 0), b: ds.map(d => d.bounces) }; __clear(); return out;
  });
  ok(lt.none || (lt.bounces.every(n => n === 1) && lt.end.every(z => z === 0)), 'a gold drop lands, bounces once, rests', lt);

  /* 15. colliders: rocks / trees from A43 (P.extra stands for one here), seat towers; sliding along, no tunnelling, the mask */
  const co = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S, out = {};
    R.phys.extra.length = 0; R.phys.extra.push({ x: S.x + 60, y: S.y, r: 12 }); R.step();
    __put(S.x, S.y); __hold(1, 0, 60); out.stopX = p.x - S.x; out.stopY = p.y - S.y;
    __put(S.x, S.y + 4); __hold(1, 0, 90); out.slideY = p.y - S.y; out.passed = p.x > S.x + 60;
    /* a mob shot at 1200 u/s toward a small rock does not tunnel through it */
    R.phys.extra.length = 0; R.phys.extra.push({ x: S.x + 100, y: S.y + 150, r: 6 }); R.step();
    const m = R.spawnMob('axe', S.x + 60, S.y + 150, 3); m.ai = Object.assign(m.ai || {}, { off: true }); m.hp = m.hpMax = 99999; m.prev = { x: m.x, y: m.y };
    R.phys.impulse(m, 1200, 0, { raw: true }); let minD = 1e9; for (let i = 0; i < 40; i++) { R.step(); minD = Math.min(minD, Math.hypot(m.x - (S.x + 100), m.y - (S.y + 150))); }
    out.tunnel = m.x > S.x + 100; out.minD = minD; out.mobX = m.x - S.x;
    R.phys.extra.length = 0; R.phys.natureCols = true; R.step();
    /* the real colliders: seat towers always, A43's rocks and trunks around the hero */
    out.towers = R.phys.towers().length; out.cols = R.phys.colliderCount;
    const N = R.nature; let tr = 0; if (N && N.chunks) for (const ch of N.chunks.values()) for (const t in (ch.recs || {})) if (R.phys.TREE[t]) tr += ch.recs[t].length; out.trees = tr;
    /* stand the hero on a seat tower: he is pushed out to its rim */
    const tw = R.phys.towers()[0]; __put(tw.x + 3, tw.y + 2); R.step(); out.towerD = Math.hypot(p.x - tw.x, p.y - tw.y);
    R.phys.natureCols = false; R.step(); __unflat(); return out;
  });
  ok(co.stopX > 30 && co.stopX < 45 && Math.abs(co.stopY) < 1, 'a rock (r 12) stops the hero at its rim', { x: +co.stopX.toFixed(1), y: +co.stopY.toFixed(2) });
  ok(co.passed && Math.abs(co.slideY) > 3, 'pushing past it off-centre he slides around it', { y: +co.slideY.toFixed(1) });
  ok(!co.tunnel && co.minD > 6, 'a body at 1200 u/s does not tunnel through a 6-unit rock (sub-steps)', { x: +co.mobX.toFixed(1), minD: +co.minD.toFixed(1) });
  ok(co.towers >= 20 && co.cols >= co.towers, 'seat-castle towers are colliders (4 per seat)', { towers: co.towers, cols: co.cols, trees: co.trees });
  ok(co.towerD >= 37 && co.towerD < 50, 'the hero is pushed out of a tower', +co.towerD.toFixed(1));

  /* 16. nothing ends inside a blocked cell; one spawned inside walks out without a jump */
  const bl = await pg.evaluate(() => {
    __clear(); __flat(); const out = {};
    let edge = null; const K = __K; for (let y = 3000 * K; y < 9000 * K && !edge; y += 60) for (let x = 600 * K; x < 6600 * K && !edge; x += 30) if (!R.world.blocked(x, y) && R.world.blocked(x + 60, y) && !R.world.blocked(x - 60, y)) edge = { x, y };
    if (!edge) return { none: true };
    __put(edge.x - 60, edge.y);
    const m = R.spawnMob('axe', edge.x - 20, edge.y, 3); m.ai = Object.assign(m.ai || {}, { off: true }); m.hp = m.hpMax = 99999; m.prev = { x: m.x, y: m.y };
    let inside = 0; R.phys.impulse(m, 900, 0, { raw: true }); for (let i = 0; i < 60; i++) { R.step(); if (R.world.blocked(m.x, m.y)) inside++; }
    out.inside = inside;
    const n = R.spawnMob('axe', edge.x + 70, edge.y, 3); n.ai = Object.assign(n.ai || {}, { off: true }); n.hp = n.hpMax = 99999; n.x = edge.x + 70; n.prev = { x: n.x, y: n.y };
    const was = R.world.blocked(n.x, n.y); let jump = 0, lx = n.x, ly = n.y; for (let i = 0; i < 120; i++) { R.step(); jump = Math.max(jump, Math.hypot(n.x - lx, n.y - ly)); lx = n.x; ly = n.y; }
    out.was = was; out.out = !R.world.blocked(n.x, n.y); out.jump = jump; __unflat(); __clear(); return out;
  });
  ok(bl.none || bl.inside === 0, 'shoved at a blocked cell at 900 u/s, a mob never ends a step inside it', bl);
  ok(bl.none || (bl.was && bl.out && bl.jump < 3), 'a mob spawned inside the mask walks out (≤ 2.5 units per step, no teleport)', bl);

  /* 16b. mobs can move at all: A11's C.moveEnt (with physics' guarded fallback while A06's slide has 5 parameters) moves a mob by (10, 0) */
  const mv = await pg.evaluate(() => { __clear(); __flat(); const S = __S, m = R.spawnMob('axe', S.x + 200, S.y, 3); m.ai = Object.assign(m.ai || {}, { off: true });
    const x0 = m.x; R.combat.moveEnt(m, 10, 0); const d = m.x - x0; R.remove(m); __unflat(); return { d, fix: !!R.combat.moveEnt.physFix, arity: R.world.slide.length }; });
  ok(Math.abs(mv.d - 10) < 0.01, 'R.combat.moveEnt(mob, 10, 0) moves it 10 units', mv);

  /* 17. a crowd around the hero settles without jitter */
  const cr = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y); p.hp = p.hpMax = 1e9; p.inv = 1e9;
    const ms = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const m = R.spawnMob('axe', S.x + Math.cos(a) * 150, S.y + Math.sin(a) * 150, 3, { temper: 'aggressive' }); m.atk = 0; ms.push(m); }
    for (let i = 0; i < 180; i++) R.step();
    window.__dbg = ms.map(m => ({ st: m.ai && m.ai.st, off: m.ai && m.ai.off, d: Math.round(Math.hypot(m.x - p.x, m.y - p.y)), dead: m.dead, inE: R.ents.includes(m), tgt: !!(m.ai && m.ai.tgt) }));
    let rev = 0, n = 0, amp = 0; const last = ms.map(m => ({ x: m.x, y: m.y, dx: 0, dy: 0 }));
    for (let i = 0; i < 60; i++) { R.step(); ms.forEach((m, k) => { const L = last[k], dx = m.x - L.x, dy = m.y - L.y; if (dx * L.dx + dy * L.dy < 0) { rev++; amp = Math.max(amp, Math.hypot(dx, dy)); } n++; L.dx = dx; L.dy = dy; L.x = m.x; L.y = m.y; }); }
    let minPair = 1e9; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) minPair = Math.min(minPair, Math.hypot(ms[i].x - ms[j].x, ms[i].y - ms[j].y) / (ms[i].r + ms[j].r));
    const out = { rev, n, amp, minPair, close: ms.filter(m => Math.hypot(m.x - p.x, m.y - p.y) < 90).length, dbg: JSON.stringify(window.__dbg) }; p.inv = 0; __unflat(); __clear(); return out;
  });
  ok(cr.close >= 4 && cr.amp < 1.5, 'eight mobs around the hero: reversals stay under 1.5 units (no visible jitter)', cr);
  ok(cr.minPair > 0.8, 'and they do not overlap', +cr.minPair.toFixed(2));

  /* 18. landing: running off a 40-unit ledge → airborne (e.z), lands, camera kick, 'landed' event */
  const ld = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; R.render3d.groundY = (x, y) => (x < S.x + 40 ? 40 : 0); __put(S.x, S.y); R.step();
    const sh0 = R.fx && R.fx.shake, kicks = []; if (R.fx) R.fx.shake = (px, s) => { kicks.push(px); try { sh0 && sh0(px, s); } catch (e) {} };
    let lv = null; const h = (e, v) => { if (e === p) lv = v; }; R.bus.on('landed', h);
    let zMax = 0; R.input.move = { x: 1, y: 0 }; for (let i = 0; i < 70; i++) { R.step(); zMax = Math.max(zMax, p.z || 0); } __free(); for (let i = 0; i < 10; i++) R.step();
    /* a mob knocked off the same ledge falls too */
    const m = R.spawnMob('axe', S.x + 10, S.y + 120, 3); m.ai = Object.assign(m.ai || {}, { off: true }); m.hp = m.hpMax = 99999; m.prev = { x: m.x, y: m.y }; R.step();
    R.phys.impulse(m, 500, 0); let mz = 0; for (let i = 0; i < 60; i++) { R.step(); mz = Math.max(mz, m.z || 0); }
    R.bus.off && R.bus.off('landed', h); if (R.fx) R.fx.shake = sh0; __unflat();
    return { zMax, lv, kicks: kicks.length, k0: kicks[0], air: p.air, z: p.z, mobZ: mz, mobEnd: m.z || 0, mobX: m.x - S.x };
  });
  ok(ld.zMax > 20 && ld.lv > 220 && !ld.air && ld.z === 0, 'off a 40-unit ledge: airborne, lands at > 220 u/s', ld);
  ok(ld.kicks >= 1 && ld.k0 >= 2, 'the landing kicks the camera (R.fx.shake)', ld.kicks);
  ok(ld.mobZ > 10 && ld.mobEnd === 0 && ld.mobX > 40, 'a mob knocked off the ledge falls and lands', { z: +ld.mobZ.toFixed(1), x: +ld.mobX.toFixed(1) });

  /* 20. standing still on the real terrain: no drift (the cliff slide only acts on > 0.9 slopes) */
  const dr = await pg.evaluate(() => {
    __clear(); const p = R.player; p.inv = 1e9; R.phys.natureCols = true; const res = []; let tries = 0;
    const K = __K; for (let y = 3200 * K; y < 10000 * K && res.length < 6 && tries < 400; y += 523 * K) for (let x = 900 * K; x < 6400 * K && res.length < 6 && tries < 400; x += 611 * K) { tries++;
      if (R.world.blocked(x, y) || (R.water && R.water.depth(x, y) > 0) || R.phys.gradAt(x, y).m > 0.8) continue;
      __put(x, y); R.step(); R.step(); const x0 = p.x, y0 = p.y; for (let i = 0; i < 180; i++) R.step(); res.push(+Math.hypot(p.x - x0, p.y - y0).toFixed(3)); }
    p.inv = 0; R.phys.natureCols = false; __put(__S.x, __S.y); return res;
  });
  ok(dr.length >= 4 && dr.every(d => d < 0.5), 'the hero standing 3 s at free spots on the real terrain does not drift', dr);

  /* 21. a dodge is immediate (no weight on it) and does not skid on; a move by another system (a skill dash, a scripted push) passes untouched */
  const dg = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y); for (let i = 0; i < 90; i++) R.step(); p.dodgeCd = 0;
    const x0 = p.x; R.input.move = { x: 1, y: 0 }; const pr0 = R.input.pressed; R.input.pressed = k => k === 'dodge'; R.step(); R.input.pressed = pr0; R.input.move = { x: 0, y: 0 };
    const first = p.x - x0; let k = 0; while (p.dodging() && k++ < 40) R.step(); const dodged = p.x - x0; for (let i = 0; i < 30; i++) R.step(); const after = p.x - x0 - dodged;
    __put(S.x, S.y); R.step(); let n = 0; R.addSys('__dash', { order: 85, update() { if (n++ < 10) R.player.x += 10; } }); const x1 = p.x; for (let i = 0; i < 12; i++) R.step(); const dash = p.x - x1;
    delete R.sys.__dash;
    __put(S.x, S.y); R.step(); const y1 = p.y; p.y += 40; R.step(); const put = p.y - y1;
    __unflat(); return { first, dodged, after, dash, put, dodging: typeof p.dodging === 'function' };
  });
  ok(dg.dodging && dg.first > 6 && dg.dodged > 150 && dg.dodged < 200 && dg.after < 6, 'dodge: full speed from the first step (> 6 units), 150–200 units, skids < 6 after it ends', dg);
  ok(Math.abs(dg.dash - 100) < 0.5 && Math.abs(dg.put - 40) < 0.01, 'a 10-unit-per-step dash by another system and a 40-unit put pass through untouched', { dash: dg.dash, put: dg.put });

  /* 23. benders for the grass shader: the hero first, then the nearest moving mobs / critters, at most 8 */
  const bd = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y); p.inv = 1e9;
    const ms = []; for (let i = 0; i < 12; i++) { const m = R.spawnMob('axe', S.x + 60 + i * 30, S.y + 120, 3); m.ai = Object.assign(m.ai || {}, { off: true }); m.mv = 60 + i * 5; ms.push(m); }
    R.addSys('__mv', { order: 99, update(dt) { for (const m of ms) if (!m.dead) m.x += m.mv * dt; } });
    for (let i = 0; i < 10; i++) R.step(); const still = R.phys.benders().map(b => Object.assign({}, b));
    R.input.move = { x: 1, y: 0 }; for (let i = 0; i < 30; i++) R.step(); const b = R.phys.benders().map(q => Object.assign({}, q)); __free();
    delete R.sys.__mv; const near = ms.map(m => Math.hypot(m.x - p.x, m.y - p.y)).sort((a, c) => a - c).slice(0, 7);
    const out = { n: b.length, hero: b[0], still0: still[0], ks: b.slice(1).map(q => +q.k.toFixed(2)), ds: b.slice(1).map(q => Math.round(Math.hypot(q.x - p.x, q.y - p.y))), near: near.map(Math.round), same: R.phys.benders() === R.phys.benders() };
    p.inv = 0; __unflat(); __clear(); return out;
  });
  ok(bd.n === 8 && bd.hero && bd.hero.r >= 12 && bd.hero.k > 0.9 && bd.still0 && bd.still0.k >= 0.25 && bd.same, 'R.phys.benders(): 8 entries, the hero first (r = 2 × body, k from his speed; 0.25 standing), one reused array', bd);
  ok(bd.ks.every(k => k > 0.3 && k <= 1.5) && JSON.stringify(bd.ds) === JSON.stringify(bd.near), 'the other 7 are the nearest moving mobs, k = speed / 170', { ds: bd.ds, near: bd.near, ks: bd.ks });

  /* 24. cloak / hair spring, lean and bob */
  const ck = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y); R.cam.yaw = 0; const out = {};
    for (let i = 0; i < 150; i++) R.step(); out.rest0 = Object.assign({}, R.phys.cloak(p)); out.bob0 = p.bob || 0;
    R.input.move = { x: 0, y: -1 }; let flMax = 0, bobMax = 0; for (let i = 0; i < 120; i++) { R.step(); flMax = Math.max(flMax, R.phys.cloak(p).flare); bobMax = Math.max(bobMax, p.bob || 0); }
    out.flare = flMax; out.bobMax = bobMax;
    R.input.move = { x: 1, y: 0 }; let angMin = 0, angMax = 0, leanMax = 0, leanMin = 0; for (let i = 0; i < 30; i++) { R.step(); const c = R.phys.cloak(p); angMin = Math.min(angMin, c.ang); angMax = Math.max(angMax, c.ang); leanMax = Math.max(leanMax, p.lean); leanMin = Math.min(leanMin, p.lean); }
    out.turnR = { angMin, angMax, leanMax, leanMin };
    __free(); for (let i = 0; i < 120; i++) R.step(); const c = R.phys.cloak(p); out.end = { ang: c.ang, flare: c.flare, bob: p.bob, lean: p.lean };
    __unflat(); return out;
  });
  ok(Math.abs(ck.rest0.ang) < 0.03 && ck.rest0.flare < 0.05 && ck.flare > 0.5 && ck.bobMax > 1 && ck.bobMax < 4, 'the cloak lifts while running (flare > 0.5), the hero bobs 1–4 units', ck);
  ok(ck.turnR.angMin < -0.08 && ck.turnR.angMin > -0.7 && ck.turnR.leanMax > 0.1 && ck.turnR.leanMax < 0.8, 'turning right (north → east): the cloak swings left (inertia), the hero leans into the turn', ck.turnR);
  ok(Math.abs(ck.end.ang) < 0.03 && ck.end.flare < 0.05 && ck.end.bob < 0.01 && Math.abs(ck.end.lean) < 0.03, 'standing 2 s: the spring settles, no bob, no lean', ck.end);

  /* 25. the hero's steps push loose things; sprinting kicks up dust */
  const st = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y); const out = {};
    /* 32_loot's auto pickup takes the owner's drops within 70 units: this drop is a plain loose thing (auto off; INTERACT-only, untaken in 0.7 s) */
    const d = R.loot.spawn('mat', S.x + 30, S.y + 4, { lvl: 3, scatter: false }); d.auto = false; for (let i = 0; i < 5; i++) R.step(); const d0 = { x: d.x, y: d.y };
    const sp0 = R.fx.spawn, dust = []; R.fx.spawn = (k, x, y, o) => { if (k === 'dust') dust.push(o && o.col); return sp0 ? sp0.call(R.fx, k, x, y, o) : null; };
    R.input.move = { x: 1, y: 0 }; let zMax = 0; for (let i = 0; i < 40; i++) { R.step(); zMax = Math.max(zMax, d.z || 0); }
    out.moved = Math.hypot(d.x - d0.x, d.y - d0.y); out.zMax = zMax; const k0 = p.kickN || 0, n0 = dust.length;
    for (let i = 0; i < 150; i++) R.step(); __free(); R.fx.spawn = sp0; out.sprint = p.sprint; out.kicks = (p.kickN || 0) - k0; out.dust = dust.length - n0;
    __unflat(); __clear(); return out;
  });
  ok(st.moved > 2 && st.zMax > 0.5, 'a drop under the hero\'s feet is pushed aside and hops', st);
  ok(st.kicks >= 3 && st.dust >= 3, 'sprinting kicks up dust / leaves at his steps (R.fx.spawn dust)', st);

  /* 26. heavy enemies stepping near the hero shake the camera slightly; far away they do not */
  const hv = await pg.evaluate(() => {
    __clear(); __flat(); const p = R.player, S = __S; __put(S.x, S.y); p.inv = 1e9; const out = {};
    const sh0 = R.fx.shake, kicks = []; R.fx.shake = (px, s) => { kicks.push(+px.toFixed(2)); };
    const g = R.spawnMob('giant', S.x + 220, S.y, 5); g.ai = Object.assign(g.ai || {}, { off: true }); g.hp = g.hpMax = 1e6;
    let sgn = 1; R.addSys('__gw', { order: 99, update(dt) { g.x += sgn * 50 * dt; } });
    for (let i = 0; i < 180; i++) R.step(); out.near = kicks.slice(); kicks.length = 0;
    g.x = S.x + 1100; g.prev = { x: g.x, y: g.y }; for (let i = 0; i < 180; i++) R.step(); out.far = kicks.length;
    delete R.sys.__gw; R.fx.shake = sh0; p.inv = 0; __unflat(); __clear(); return out;
  });
  ok(hv.near.length >= 3 && hv.near.every(k => k > 0 && k <= 4), 'a walking giant 220 units away: slight camera shakes at its steps (≤ 4 px)', hv.near);
  ok(hv.far === 0, 'the same giant 1100 units away: none', hv.far);

  /* 27. the blocked mask at the world's scale: R.world.blocked agrees with the data's rows at cell = size / mask.w (120 · R.WS once scaled) */
  const mk = await pg.evaluate(() => {
    const D = R.data.world, m = D.mask, sz = R.world.size(), cell = sz[0] / m.w; let n = 0, agree = 0, pa = 0;
    for (let y = 37; y < sz[1]; y += sz[1] / 61) for (let x = 53; x < sz[0]; x += sz[0] / 47) { n++; const row = m.rows[Math.floor(y / cell)]; const want = row ? row.charCodeAt(Math.floor(x / cell)) === 35 : true;
      if (R.world.blocked(x, y) === want) agree++; if (R.phys.blockedAt(x, y) === want) pa++; }
    return { n, agree, pa, cell, WS: R.WS, size: sz, cellWS: 120 * (R.WS || 1) };
  });
  ok(mk.agree === mk.n && mk.pa === mk.n, 'the blocked mask: R.world.blocked = the data rows at cell = size / mask.w for every sample', mk);

  /* 19. the phone budget: 40 mobs + 15 critters + the hero, timed inside 600 real steps (physPre + physPost) */
  const bu = await pg.evaluate(() => {
    __clear(); const p = R.player, S = __S; __put(S.x, S.y); p.hp = p.hpMax = 1e9; p.inv = 1e9; R.phys.natureCols = true; R.world.populate = true;
    for (let i = 0; i < 40; i++) { const a = R.rng() * 6.283, d = 120 + R.rng() * 500; R.spawnMob(i % 10 === 0 ? 'giant' : 'axe', S.x + Math.cos(a) * d, S.y + Math.sin(a) * d, 3); }
    const W = R.wildlife, sp = ['hare', 'deer', 'sheep', 'wolf', 'chicken', 'fox', 'boar'].filter(k => W && W.SPECIES && W.SPECIES[k] && !W.SPECIES[k].prop);
    for (let i = 0; i < 15 && sp.length && W.spawnOne; i++) { try { W.spawnOne(sp[i % sp.length], S.x + 250 + (i % 5) * 30, S.y - 250 + Math.floor(i / 5) * 30); } catch (e) {} }
    /* the machine is shared (load ≫ cores): per-batch sums over 12 batches of 50 steps, the least disturbed batch is the cost */
    const tm = (name) => { const s = R.sys[name], u = s.update, ts = []; s.update = function (dt) { const t0 = performance.now(); const r = u.call(this, dt); ts.push(performance.now() - t0); return r; };
      return { ts, get: () => { const a = ts.slice().sort((x, y) => x - y); return { worst: a[a.length - 1], med: a[a.length >> 1] }; }, undo: () => { s.update = u; } }; };
    const A = tm('physPre'), B = tm('physPost'); R.input.move = { x: 1, y: 0.3 }; let crit = 0, mobs = 0;
    for (let i = 0; i < 600; i++) { if (i % 150 === 75) R.input.move = { x: -R.input.move.x, y: R.input.move.y }; R.step(); if (i === 300) { crit = R.ents.filter(e => e.kind === 'critter' && !e.dead).length; mobs = R.ents.filter(e => e.kind === 'mob' && !e.dead).length; } }
    A.undo(); B.undo(); __free(); p.inv = 0; R.world.populate = false; R.phys.natureCols = false;
    let best = 1e9; for (let k = 0; k < 12; k++) { let sum = 0; for (let i = k * 50; i < k * 50 + 50; i++) sum += (A.ts[i] || 0) + (B.ts[i] || 0); best = Math.min(best, sum / 50); }
    const a = A.get(), b = B.get(); const out = { avg: best, med: a.med + b.med, worst: Math.max(a.worst, b.worst), movers: R.phys.stats.movers, critters: crit, mobs, cols: R.phys.colliderCount }; __clear(); return out;
  });
  ok(bu.avg < 0.3 && bu.mobs >= 30, '40 mobs + 15 critters + the hero over 600 real steps: physics < 0.3 ms per step (least disturbed of 12 batches of 50)', { avg: +bu.avg.toFixed(4), med: +bu.med.toFixed(4), worst: +bu.worst.toFixed(2), mobs: bu.mobs, critters: bu.critters, cols: bu.cols });

  /* 22. R.hit is wrapped once: A12's wrapper sits on ours and neither re-wraps the other (the integrated build grew the chain by 2
          per step: 84 → 9460 by t = 79 s, then "Maximum call stack size exceeded" and no damage at all). 6000 steps = 100 game-s. */
  const hd = await pg.evaluate(() => { const depth = () => { let d = 0, f = R.hit; while (f && d < 100000) { d++; f = f.orig; } return d; };
    __clear(); const p = R.player, inv0 = p.inv; p.inv = 1e9; p.hp = p.hpMax = 1e9; const d0 = depth(); for (let i = 0; i < 6000; i++) { R.step(); if (p.dead || p.hp <= 0) { p.dead = false; p.hp = p.hpMax; } }
    p.inv = inv0; p.hp = p.hpMax; const d1 = depth(); let phys = 0; for (let f = R.hit; f; f = f.orig) if (f.__phys) phys++;
    let works = null; try { const m = R.spawnMob('axe', p.x + 30, p.y, 1); m.ai = Object.assign(m.ai || {}, { off: true }); const h0 = m.hp; R.hit(p, m, 5, {}); works = m.hp < h0; R.remove(m); } catch (e) { works = 'threw ' + e.message; }
    return { d0, d1, phys, works, t: +R.t.toFixed(1), errs: (R.errors || []).slice(-3).map(String), cur: R.ui && R.ui.cur, same: R.player === p }; });
  ok(hd.d1 === hd.d0 && hd.d1 <= 4 && hd.phys === 1, 'the R.hit chain does not grow over 6000 steps (≤ 4 deep), physics wraps it once', hd);
  ok(hd.works === true, 'R.hit still deals damage after 100 game-s', hd.works);

  ok(G.errors.length === 0, 'no page errors (part 2)', G.errors.slice(0, 5));
  await G.close();
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
