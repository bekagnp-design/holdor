/* HOLDOR RPG — physics test (A45): an impulse moves and decays to rest within 1.2 s; uphill is 25–35 % slower than flat,
   downhill 10–20 % faster, a > 0.9 slope is a wall; water (depth 0.5) slows to ~55 % with a splash on entry and ripples;
   knock from R.hit becomes an impulse (position changes over several steps, not one); a big hit gives hit-stop + flash +
   camera kick; a knocked mob that dies tumbles (z rises, lands, one bounce); walkers do not; footsteps fire every 0.28 s
   with the right surface (grass / snow + prints / stone / wet / sand); arrows fly on a lob, land and stay 6 s in the ground,
   bolts do not; R.phys.off restores the raw behaviour; 60 entities × 600 steps < 300 ms.
   Fakes only what the build lacks (R.hit, R.fx); R.world.slide is always faked to free movement, groundY / water to fields.
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
    const t0 = performance.now(); let phys = 0; for (let i = 0; i < 600; i++) { R.step(); phys += R.phys.stats.ms; }
    return { ms: performance.now() - t0, phys, movers: R.phys.stats.movers };
  });
  ok(r9.ms < 300, '60 entities × 600 steps under 300 ms (whole step)', { ms: Math.round(r9.ms), physMs: Math.round(r9.phys), movers: r9.movers });

  ok(errors.length === 0, 'no page errors', errors);
  await browser.close();
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
