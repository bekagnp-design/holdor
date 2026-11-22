// RPG v2.0.0 (A32): the vfx layer — every kind draws something, the pool never passes its cap, numbers rise and land, the shake
// decays to zero, shields follow their entity and end, the hooks work without the other modules, reduced motion halves the counts,
// 300 particles update + draw under 4 ms (median). Build first: python3 src/build_rpg.py beta/index.html
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info != null ? ' ' + info : ''); };
  const html = 'file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html');
  const open = async (opts) => { const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
    p.on('pageerror', e => errors.push('PE:' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); });
    if (opts && opts.calm) await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(html); await p.waitForFunction(() => window.R && R.fx && R.sys && R.sys.vfx && R.fx.spawn, { timeout: 20000 }); return p; };

  const p = await open();
  const r = await p.evaluate(() => {
    const out = {}; const fx = R.fx, S = R.sys.vfx, DT = 1 / 60;
    // the integrated build installs the 3D projection; sections 1–11 test the layer on the flat 2D projection (core's), 12 on a perspective one
    const w2sReal = R.w2s, keep3d = R.render3d; R.w2s = (x, y) => ({ x: (x - R.cam.x) * R.cam.z + 195, y: (y - R.cam.y) * R.cam.z + 422 }); R.render3d = undefined;
    R.cam.x = 500; R.cam.y = 500; R.cam.z = 1; R.paused = false; if (R.ui && R.ui.cur) R.ui.close();
    const cv = document.createElement('canvas'); cv.width = 390; cv.height = 844; const ctx = cv.getContext('2d'); R.dpr = 1;
    const clear = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 390, 844); };
    const pixels = () => { const d = ctx.getImageData(0, 0, 390, 844).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return n; };
    const step = n => { for (let i = 0; i < n; i++) S.update(DT); };
    const ent = R.spawn({ kind: 'player', x: 500, y: 500, r: 14, face: 1, team: 0, hp: 100 }); R.player = ent;
    const opts = { shield: { ent, dur: 2 }, dash: { ent }, portal: { ent }, telegraph: { r: 80, dur: 1 }, arrow: { vx: 1, vy: 0 }, bolt: { vx: 0, vy: -1 }, levelup: { ent }, loot: { rar: 3 }, slash: { face: 1 }, heal: { ent }, nova: {} };
    /* 1. every kind draws (after 2 steps) and the cheap, timed ones are gone after 10 s */
    out.kinds = fx.kinds.slice(); out.perKind = {}; out.left = {};
    for (const k of fx.kinds) { fx.clear(); const p0 = fx.spawn(k, 500, 500, opts[k] || {}); step(2); clear(); S.drawWorld(ctx); out.perKind[k] = { made: !!p0, n: fx.count(), px: pixels() };
      step(600); out.left[k] = fx.count(); }
    fx.clear(); for (const k of fx.kinds) fx.spawn(k, 500, 500, opts[k] || {}); step(30); clear(); S.drawWorld(ctx); out.allPx = pixels(); out.allN = fx.count();
    /* 2. the cap under 2000 spawns */
    fx.clear(); let max = 0; const ks = fx.kinds; for (let i = 0; i < 2000; i++) { fx.spawn(ks[i % ks.length], 500 + (i % 7) * 10, 500 + (i % 5) * 10, opts[ks[i % ks.length]] || {}); if (fx.count() > max) max = fx.count(); if (i % 50 === 0) S.update(DT); } out.capMax = max; out.cap = fx.CAP; out.dropped = fx.stats.dropped;
    /* 3. cheap first: a pool full of shields keeps them when dust asks for room */
    fx.clear(); for (let i = 0; i < fx.CAP; i++) fx.spawn('shield', 500, 500, { ent, dur: 5 }); const before = fx.ps.filter(q => q.kind === 'shield').length; for (let i = 0; i < 50; i++) fx.spawn('ash', 500, 500, {}); out.shieldsKept = fx.ps.filter(q => q.kind === 'shield').length === before && before === fx.CAP;
    fx.clear(); for (let i = 0; i < 60; i++) fx.spawn('ash', 500, 500, {}); const ashN = fx.count(); const sh = fx.spawn('shield', 500, 500, { ent, dur: 5 }); out.shieldOverAsh = !!sh && fx.count() === fx.CAP && ashN === fx.CAP;
    /* 4. numbers: rise, land 1.3 → 1, crit gold and bigger, cap 40 */
    fx.clear(); const n = fx.num(500, 500, 42, null, true); const q0 = fx.numPose(n); step(12); const q1 = fx.numPose(n); step(30); const q2 = fx.numPose(n);
    out.num = { s0: q0.scale, s1: q1.scale, rise1: q1.rise, rise2: q2.rise, col: n.col, big: n.big, alive: fx.nums.length }; clear(); S.drawWorld(ctx); out.numPx = pixels();
    for (let i = 0; i < 60; i++) fx.num(500, 500, i); out.numCap = fx.nums.length; step(80); out.numGone = fx.nums.length;
    /* 5. shake */
    fx.clear(); fx.shake(10, 0.3); let moved = 0; for (let i = 0; i < 5; i++) { S.update(DT); moved += Math.abs(fx.offset.x) + Math.abs(fx.offset.y); } step(30); out.shake = { moved, after: Math.abs(fx.offset.x) + Math.abs(fx.offset.y) };
    /* 6. the shield follows its entity and ends with its duration */
    fx.clear(); const s = fx.spawn('shield', 0, 0, { ent, dur: 0.5 }); ent.x = 540; ent.y = 520; step(3); out.shieldFollow = s.x === 540 && s.y === 520 && s.on === 1; step(40); out.shieldEnded = s.on === 0 || s.kind !== 'shield'; ent.x = 500; ent.y = 500;
    const tg = fx.spawn('telegraph', 500, 500, { r: 60, dur: 0.5 }); step(3); const tgAlive = tg.on === 1; step(40); out.telegraph = tgAlive && tg.on === 0;
    /* 7. hooks: hit → spark + number once, kill → shatter / ash / blood by arch, levelup → pillar, loot → beam */
    fx.clear(); const mob = R.spawn({ kind: 'mob', type: 'walker', x: 520, y: 500, r: 14, hp: 50 });
    R.bus.emit('hit', { src: ent, tgt: mob, dmg: 17, crit: true, kind: 'ice' }); S.update(DT); out.hit = { sparks: fx.ps.filter(q => q.kind === 'hit').length, nums: fx.nums.length, big: fx.nums[0] && fx.nums[0].big, txt: fx.nums[0] && fx.nums[0].txt };
    fx.clear(); fx.num(mob.x, mob.y, 9); R.bus.emit('hit', { src: ent, tgt: mob, dmg: 9 }); S.update(DT); out.hitNoDup = fx.nums.length;
    fx.clear(); R.bus.emit('kill', mob, ent); out.killWalker = fx.ps.some(q => q.kind === 'shatter') && !fx.ps.some(q => q.kind === 'ash');
    fx.clear(); R.bus.emit('kill', { kind: 'mob', type: 'wight', x: 500, y: 500, r: 14 }, ent); out.killWight = fx.ps.some(q => q.kind === 'ash') && !fx.ps.some(q => q.kind === 'shatter');
    fx.clear(); R.bus.emit('kill', { kind: 'mob', type: 'axe', x: 500, y: 500, r: 14 }, ent); out.killAxe = fx.ps.some(q => q.kind === 'blood');
    fx.clear(); R.bus.emit('levelup', 2); out.levelup = fx.ps.some(q => q.kind === 'levelup' && q.ent === ent);
    fx.clear(); R.bus.emit('loot', { rar: 3, x: 500, y: 500 }); out.loot = fx.ps.some(q => q.kind === 'loot' && q.h > 60);
    /* 8. footstep dust while the player moves, none while he stands */
    fx.clear(); step(2); for (let i = 0; i < 30; i++) { ent.x += 3; S.update(DT); } out.dustMoving = fx.ps.filter(q => q.kind === 'dust').length; fx.clear(); step(30); out.dustStill = fx.ps.filter(q => q.kind === 'dust').length;
    /* 9. the flat w2s lifts z: a particle at z = 100 draws higher than one at z = 0 */
    fx.clear(); const low = fx.spawn('nova', 500, 500, { r: 20, dur: 1 }); const hi = fx.spawn('nova', 500, 500, { r: 20, dur: 1, z: 100 }); step(30); clear(); S.drawWorld(ctx);
    const d = ctx.getImageData(0, 0, 390, 844).data; let top = 1e9, bot = -1; for (let y = 0; y < 844; y++) for (let x = 0; x < 390; x++) if (d[(y * 390 + x) * 4 + 3] > 8) { if (y < top) top = y; if (y > bot) bot = y; } out.lift = { top, bot };
    /* 10. draw() is a no-op in the frame the renderer called drawWorld, draws otherwise */
    fx.clear(); fx.spawn('nova', 500, 500, { r: 40, dur: 1 }); step(1); clear(); S.drawWorld(ctx); const a1 = pixels(); clear(); S.draw(ctx); out.drawSkip = pixels(); clear(); S.draw(ctx); out.drawAlone = pixels(); out.drawWorldPx = a1;
    /* 11. performance: 300 live particles, update + drawWorld */
    fx.clear(); const top300 = () => { while (fx.count() < 286) fx.spawn('ash', 500 + (Math.random() - 0.5) * 200, 500 + (Math.random() - 0.5) * 300, {}); while (fx.count() < 300) fx.spawn('dust', 500, 500, {}); };
    const times = []; for (let i = 0; i < 41; i++) { top300(); const c = fx.count(); const t0 = performance.now(); S.update(DT); S.drawWorld(ctx); times.push(performance.now() - t0); if (i === 0) out.perfCount = c; }
    times.sort((a, b) => a - b); out.perfMedian = times[20]; out.perfMax = times[40];
    /* 12. a perspective w2s like the 3D renderer's: the layer projects every point itself (the ground ring becomes an ellipse), no double lift */
    const w2s0 = R.w2s, PT = 0.6; R.w2s = (x, y, z) => { z = z || 0; const dx = x - R.cam.x, dy = y - R.cam.y; const sc = 900 / Math.max(50, 900 + dy * Math.sin(PT)); return { x: 195 + dx * sc, y: 422 + (dy * Math.cos(PT) - z * Math.sin(PT)) * sc, s: sc }; };
    const bbox = () => { const d = ctx.getImageData(0, 0, 390, 844).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < 844; y++) for (let x = 0; x < 390; x++) if (d[(y * 390 + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { w: x1 - x0, h: y1 - y0, cy: (y0 + y1) / 2 }; };
    fx.clear(); fx.spawn('nova', 500, 500, { r: 60, dur: 1, w: 2 }); step(30); clear(); S.drawWorld(ctx); out.persp = bbox(); out.perspIs3d = fx.is3d;
    fx.clear(); fx.spawn('nova', 500, 500, { r: 60, dur: 1, w: 2, z: 100 }); step(30); clear(); S.drawWorld(ctx); out.perspHi = bbox();
    fx.clear(); for (const k of fx.kinds) fx.spawn(k, 500, 500, opts[k] || {}); step(5); clear(); S.drawWorld(ctx); out.perspPx = pixels(); fx.clear(); R.w2s = w2s0; fx.spawn('dust', 500, 500, {}); S.drawWorld(ctx); out.flatAgain = fx.is3d === false;
    /* 13. every kind the other modules spawn (24_physics, 47_wildlife, 22_skills, 13_bosses, 45_events) makes particles */
    const asked = ['splash', 'smoke', 'raise', 'slam', 'volley', 'warcry', 'dread', 'fire', 'frost', 'peck', 'rally', 'raven', 'shaft', 'snap', 'strike', 'taunt', 'trap', 'dash', 'heal', 'levelup', 'shield', 'slash', 'dust', 'nova', 'loot', 'hit', 'blood', 'ash', 'shatter'];
    out.asked = asked.filter(k => { fx.clear(); return !fx.spawn(k, 500, 500, k === 'shield' || k === 'dash' || k === 'heal' || k === 'levelup' ? { ent } : {}); });
    fx.clear(); fx.spawn('splash', 500, 500, { n: 3 }); const sp0 = fx.ps.filter(q => q.kind === 'splash').length; step(60); out.splash = { n: sp0, after: fx.ps.filter(q => q.kind === 'splash' && !q.fl).length };
    fx.clear(); R.w2s = w2sReal; R.render3d = keep3d; return out;
  });
  /* the page itself: start the loop, spawn, and the real canvas is not blank */
  await p.evaluate(() => { R.cam.x = 500; R.cam.y = 500; R.cam.z = 1; R.paused = false; R.start(); for (const k of R.fx.kinds) R.fx.spawn(k, 500 + (Math.random() - 0.5) * 200, 500 + (Math.random() - 0.5) * 400, k === 'shield' || k === 'dash' || k === 'portal' || k === 'levelup' || k === 'heal' ? { ent: R.player, dur: 3 } : k === 'loot' ? { rar: 4 } : k === 'arrow' ? { vx: 1, vy: 0 } : k === 'bolt' ? { vx: 0, vy: -1 } : { r: 80, dur: 3 }); R.fx.num(520, 480, 128, null, true); R.fx.num(480, 520, 15); });
  await p.waitForTimeout(120);
  const live = await p.evaluate(() => { const d = R.ctx.getImageData(0, 0, R.cv.width, R.cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return { px: n, running: R.running, count: R.fx.count() }; });
  await p.screenshot({ path: path.resolve(__dirname, '..', '..', '.shots', 'rpg_vfx.png') }).catch(() => {});
  await p.close();
  /* reduced motion halves the counts */
  const pc = await open({ calm: true });
  const calm = await pc.evaluate(() => { R.cam.x = 500; R.cam.y = 500; R.fx.clear(); R.fx.spawn('ash', 500, 500, {}); const a = R.fx.count(); R.fx.clear(); R.fx.spawn('levelup', 500, 500, {}); return { calm: R.fx.calm, ash: a, lvl: R.fx.count() }; });
  await pc.close();
  const normalAsh = r.perKind.ash.n, normalLvl = r.perKind.levelup.n;

  const expectKinds = ['slash', 'hit', 'blood', 'ash', 'shatter', 'arrow', 'bolt', 'nova', 'heal', 'shield', 'levelup', 'loot', 'telegraph', 'dash', 'dust', 'portal'];
  ok('all 16 kinds exist', expectKinds.every(k => r.kinds.includes(k)), r.kinds.join(','));
  for (const k of expectKinds) ok('kind ' + k + ' spawns and draws', r.perKind[k] && r.perKind[k].made && r.perKind[k].n > 0 && r.perKind[k].px > 0, JSON.stringify(r.perKind[k]));
  const timed = expectKinds.filter(k => !['shield', 'portal'].includes(k));
  ok('timed kinds are gone after 10 s', timed.every(k => r.left[k] === 0), JSON.stringify(r.left));
  ok('every kind other modules spawn exists (skills / bosses through aliases)', !r.asked.length, r.asked.join());
  ok('a splash throws droplets that land within a second', r.splash.n >= 4 && r.splash.after === 0, r.splash);
  ok('all kinds together, 30 steps: canvas not blank', r.allPx > 500 && r.allN > 0, r.allPx + ' px, ' + r.allN + ' particles');
  ok('2000 spawns never pass the cap', r.capMax <= r.cap && r.capMax > 0, r.capMax + ' <= ' + r.cap + ' (dropped ' + r.dropped + ')');
  ok('a full pool keeps the expensive shields when cheap ash asks', r.shieldsKept, '');
  ok('a shield replaces the cheapest ash mote in a full pool', r.shieldOverAsh, '');
  ok('number lands 1.3 → 1 and rises with an ease-out', Math.abs(r.num.s0 - 1.3) < 1e-6 && Math.abs(r.num.s1 - 1) < 1e-6 && r.num.rise1 > 0 && r.num.rise2 > r.num.rise1 && r.num.alive === 1, JSON.stringify(r.num));
  ok('crit number is gold and big, and draws', r.num.big && r.num.col === '#ffd36a' && r.numPx > 20, r.numPx + ' px');
  ok('numbers cap at 40 and expire', r.numCap === 40 && r.numGone === 0, r.numCap + '/' + r.numGone);
  ok('shake moves the offset then returns it to zero', r.shake.moved > 0 && r.shake.after === 0, JSON.stringify(r.shake));
  ok('shield follows its entity and ends with its duration', r.shieldFollow && r.shieldEnded, '');
  ok('telegraph lives for its duration then ends', r.telegraph, '');
  ok('hit event → spark + one crit number', r.hit.sparks > 0 && r.hit.nums === 1 && r.hit.big && r.hit.txt === '17', JSON.stringify(r.hit));
  ok('hit event does not double a number the combat module already drew', r.hitNoDup === 1, String(r.hitNoDup));
  ok('kill → shatter for a walker, ash for a wight, blood for a wildling', r.killWalker && r.killWight && r.killAxe, [r.killWalker, r.killWight, r.killAxe].join(','));
  ok('levelup → pillar on the player; loot rar 3 → beam', r.levelup && r.loot, '');
  ok('footstep dust only while moving', r.dustMoving >= 3 && r.dustStill === 0, r.dustMoving + '/' + r.dustStill);
  ok('flat w2s: z lifts the drawing on the screen', r.lift.top < 844 / 2 - 100 - 10 && r.lift.bot > 844 / 2 - 100 + 10, JSON.stringify(r.lift));
  ok('draw() skips the frame the renderer drew, draws alone otherwise', r.drawWorldPx > 0 && r.drawSkip === 0 && r.drawAlone > 0, [r.drawWorldPx, r.drawSkip, r.drawAlone].join('/'));
  ok('300 particles update + draw < 4 ms median', r.perfCount >= 300 && r.perfMedian < 4, 'median ' + r.perfMedian.toFixed(2) + ' ms, max ' + r.perfMax.toFixed(2) + ' ms, n=' + r.perfCount);
  ok('live page: loop runs and the real canvas is not blank', live.running && live.px > 200 && live.count > 0, JSON.stringify(live));
  ok('reduced motion halves the counts', calm.calm && calm.ash < normalAsh && calm.ash >= Math.ceil(normalAsh / 2) - 1 && calm.lvl < normalLvl, JSON.stringify({ calm, normalAsh, normalLvl }));
  ok('perspective w2s: ground ring projects as an ellipse (w > h), z = 100 lifts by the projection only', r.perspIs3d && r.persp.w > r.persp.h * 1.15 && r.persp.w > 90 && Math.abs(r.perspHi.cy - (r.persp.cy - 100 * Math.sin(0.6))) < 3 && r.flatAgain, JSON.stringify({ p: r.persp, hi: r.perspHi, is3d: r.perspIs3d }));
  ok('perspective w2s: every kind still draws', r.perspPx > 500, r.perspPx + ' px');
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
