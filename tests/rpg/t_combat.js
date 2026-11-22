/* HOLDOR RPG — combat core (A11): R.hit, R.attack, projectiles, statuses, mob AI, death rules, performance.
   Run after `python3 src/build_rpg.py beta/index.html`:
   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_combat.js */
const { chromium } = require('playwright');
const path = require('path');
const HTML = process.env.HOLDOR_RPG_HTML || path.resolve(__dirname, '..', '..', 'beta', 'index.html');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
let fails = 0;
const ok = (c, name, info) => { console.log((c ? 'OK   ' : 'FAIL ') + name + (info != null ? '  ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); if (!c) fails++; };

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', e => { console.log('PAGE ERROR', e.message); fails++; });
  await pg.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await pg.goto('file://' + HTML, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.R && R.combat && R.sys.ai && R.sys.proj && R.sys.combat, null, { timeout: 10000 });

  /* page-side helpers: a fresh arena with one player entity at (1000,1000) facing +x */
  await pg.evaluate(() => {
    window.T = {};
    /* the integrated build runs ~30 systems; the arena keeps only combat's own (status ticks, mob AI, projectiles) so the world's
       population, region gates, physics impulses and the player's stat recalculation do not move or rescale the test entities */
    const KEEP = ['combat', 'ai', 'proj'];
    T.isolate = () => { R.sysList = R.sysList.filter(s => KEEP.includes(s.name) || KEEP.some(k => R.sys[k] === s)); if (R.phys) R.phys.off = true; };
    T.reset = (hp = 400) => { T.isolate(); R.ents.length = 0; R.state = R.newState(); R.t = 0; R.rng(7);
      R.player = R.spawn({ kind: 'player', team: 0, x: 1000, y: 1000, hp, hpMax: hp, atk: 20, def: 10, crit: 0, r: 14, face: 1, name: 'Hero' });
      T.hits = []; T.kills = []; T.xp = 0; T.gold = 0; return R.player; };
    T.steps = n => { for (let i = 0; i < n; i++) R.step(); };
    R.bus.on('hit', i => T.hits && T.hits.push({ src: i.src && i.src.id, tgt: i.tgt.id, dmg: i.dmg, crit: i.crit, dot: !!i.dot, kind: i.kind }));
    R.bus.on('kill', e => T.kills && T.kills.push(e.type));
    R.bus.on('xp', n => { T.xp += n; });
    R.bus.on('gold', n => { T.gold += n; });
  });

  /* 1. a mob 300 units away chases the player and hits it */
  let r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('axe', 1300, 1000, 1); const x0 = m.x; let firstHit = -1, firstChase = -1;
    for (let i = 0; i < 600 && firstHit < 0; i++) { R.step(); if (firstChase < 0 && m.ai.st === 'chase') firstChase = i; if (T.hits.some(h => h.src === m.id && h.tgt === R.player.id)) firstHit = i; }
    return { firstChase, firstHit, moved: Math.round(x0 - m.x), hp: R.player.hp, hpMax: R.player.hpMax, st: m.ai.st, aggro: m.aggro, spd: m.spd, dist: Math.round(R.dist(m, R.player)), anim: R.player.anim }; });
  ok(r.firstChase >= 0 && r.firstChase < 20, 'mob 300 away acquires the player within 0.3 s', r);
  ok(r.firstHit > 0 && r.firstHit < 420 && r.hp < r.hpMax && r.moved > 200, 'mob chases, closes 200+ units and hits the player', r);
  ok(r.dist < 80, 'mob stands at melee reach after the hit', r.dist);

  /* 2. R.hit applies def, no crit when crit = 0, kills, rewards */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1500, 1500, 1); m.def = 50; m.hp = m.hpMax = 1000; m.ai.off = true; R.player.atk = 50;
    const a = R.hit(R.player, m, 50, { kind: 'phys' }); const hp1 = m.hp;
    m.def = 0; const b = R.hit(R.player, m, 50); const hp2 = m.hp;
    const k = R.spawnMob('axe', 1600, 1600, 2); k.hp = 10; k.def = 0; const xp0 = R.state.p.xp, gold0 = R.state.p.gold;
    const c = R.hit(R.player, k, 50); T.steps(1);
    const killed = (R.acc && R.acc().world && R.acc().world.killed) || (R.state.acc && R.state.acc.world && R.state.acc.world.killed) || R.state.p.killed;
    return { a: a.dmg, hp1, b: b.dmg, hp2, crit: a.crit || b.crit, killed: c.killed, dead: k.dead, anim: k.anim, lastHitBy: k.lastHitBy === R.player, kills: T.kills, xpGain: R.state.p.xp - xp0, goldGain: (R.state.p.gold - gold0) + R.ents.filter(e => e.kind === 'drop' && e.sub === 'gold').reduce((a, e) => a + (e.amount || 0), 0), xpEv: T.xp, cnt: killed && killed.axe, hurt: m.anim }; });
  ok(r.a === 25 && r.hp1 === 975, 'atk 50 through def 50 is halved (balance dmg: atk²/(atk+def) = 25)', r);
  ok(r.b === 50 && r.hp2 === 925 && !r.crit, 'def 0 keeps 50; no crit at crit 0', r);
  ok(r.killed && r.dead && r.anim === 'die' && r.lastHitBy && r.kills.length === 1 && r.kills[0] === 'axe', 'hp ≤ 0 → R.kill, die anim, lastHitBy, kill event', r);
  ok(r.xpGain > 0 && r.xpEv === r.xpGain && r.goldGain >= 4 && r.cnt === 1, 'kill gives xp to the save, gold (to the save or dropped on the ground) and counts killed.axe', r);
  ok(r.hurt === 'hurt', 'a hit target shows the hurt anim', r.hurt);

  /* 2a. a kill pays xp exactly once and rolls loot exactly once, though 20_combat, 21_player and 32_loot all listen to 'kill' */
  r = await pg.evaluate(() => { T.reset(); if (R.plr && R.plr.attach) { R.plr.attach(R.player); R.player.atk = 20; R.player.def = 10; R.player.hp = R.player.hpMax = 400; }
    let xpEv = 0, drops = 0; const f1 = () => xpEv++, f2 = e => { if (e && e.kind === 'drop') drops++; }; R.bus.on('xp', f1); R.bus.on('spawn', f2);
    const m = R.spawnMob('axe', 1040, 1000, 1); m.ai.off = true; m.hp = 5; const xp0 = R.state.p.xp;
    R.hit(R.player, m, 50); const xp1 = R.state.p.xp, d1 = drops; R.bus.emit('kill', m, R.player); R.kill(m, R.player); T.steps(2);
    const sm = R.spawnMob('axe', 1060, 1000, 1, { summoned: m, noReward: true }); sm.ai.off = true; const ev0 = xpEv, dr0 = drops; R.hit(R.player, sm, 1e6); T.steps(1);
    R.bus.off('xp', f1); R.bus.off('spawn', f2);
    return { xpEv: ev0, gained: xp1 - xp0, mobXp: m.xp, drops1: d1, dropsAfter: dr0, xpAfter: R.state.p.xp - xp0, nrXp: xpEv - ev0, nrDrops: drops - dr0 }; });
  ok(r.xpEv === 1 && r.gained === r.mobXp && r.gained > 0 && r.xpAfter === r.gained, 'a kill pays its xp once (a second kill event pays nothing)', r);
  ok(r.drops1 >= 1 && r.dropsAfter === r.drops1, 'a kill rolls its loot once (gold on the ground; a second kill event drops nothing)', r);
  ok(r.nrXp === 0 && r.nrDrops === 0, 'a noReward summon pays no xp and drops nothing', r);

  /* 2b. crit: chance 1 → ×1.6 */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1500, 1500, 1); m.def = 0; m.hp = m.hpMax = 1000; m.ai.off = true; R.player.crit = 1; const a = R.hit(R.player, m, 50); R.player.crit = 0; return { dmg: a.dmg, crit: a.crit }; });
  ok(r.crit && r.dmg === 80, 'crit chance 1 → ×1.6 (50 → 80)', r);

  /* 3. R.attack melee hits ≤ 3 targets in the arc, not the one behind */
  r = await pg.evaluate(() => { T.reset(); const front = []; for (let i = 0; i < 5; i++) { const m = R.spawnMob('axe', 1040 + (i % 2) * 10, 1000 + (i - 2) * 12, 1); m.hp = m.hpMax = 1000; m.def = 0; front.push(m); }  /* no step runs: AI stays idle */
    const behind = R.spawnMob('axe', 950, 1000, 1); behind.hp = behind.hpMax = 1000; behind.ai.off = true;
    const out = R.attack(R.player, { kind: 'melee', arc: 90, range: 70, dmg: 10 });
    return { n: out.hits.length, hurtFront: front.filter(m => m.hp < 1000).length, behindHp: behind.hp, lastHitBy: out.targets.every(t => t.lastHitBy === R.player), anim: R.player.anim, aggroed: front.filter(m => m.ai.tgt === R.player).length }; });
  ok(r.n === 3 && r.hurtFront === 3 && r.behindHp === 1000, 'melee: 3 of 5 in front hit, the one behind untouched', r);
  ok(r.lastHitBy && r.anim === 'attack' && r.aggroed === 3, 'melee targets remember the attacker and turn on him', r);

  /* 4. R.attack ranged: a projectile entity travels and hits */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1250, 1000, 1); m.hp = m.hpMax = 1000; m.def = 0; m.ai.off = true;
    const out = R.attack(R.player, { kind: 'ranged', range: 400, dmg: 30, dir: { x: 1, y: 0 } }); const p = out.proj;
    const info = { kind: p.kind, col: p.col, drawKind: p.drawKind, vx: Math.round(p.vx), team: p.team, x0: Math.round(p.x) }; let hitAt = -1;
    for (let i = 0; i < 120; i++) { R.step(); if (hitAt < 0 && m.hp < 1000) hitAt = i; }
    return Object.assign(info, { hitAt, dmg: 1000 - m.hp, projGone: R.ents.indexOf(p) < 0, projs: R.ents.filter(e => e.kind === 'proj').length }); });
  ok(r.kind === 'proj' && r.drawKind === 'arrow' && !!r.col && r.vx > 400 && r.team === 0, 'ranged attack spawns a proj entity with col + drawKind', r);
  ok(r.hitAt > 5 && r.hitAt < 60 && r.dmg === 30 && r.projGone && r.projs === 0, 'projectile travels ~230 units, hits for 30, is removed', r);

  /* 4b. a projectile that hits nothing expires */
  r = await pg.evaluate(() => { T.reset(); const out = R.attack(R.player, { kind: 'ranged', range: 300, dmg: 5, dir: { x: 0, y: -1 } }); T.steps(90); return { gone: R.ents.indexOf(out.proj) < 0, hits: T.hits.length }; });
  ok(r.gone && r.hits === 0, 'a missing arrow expires at its range', r);

  /* 5. burn ticks 4 % of the hit per 0.5 s for 3 s */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1500, 1500, 1); m.hp = m.hpMax = 1000; m.def = 0; m.ai.off = true;
    const a = R.hit(R.player, m, 100, { burn: 3 }); const hp0 = m.hp; T.steps(200);
    const ticks = T.hits.filter(h => h.dot && h.tgt === m.id); return { first: a.dmg, hp0, hp: m.hp, ticks: ticks.length, tick: ticks[0] && ticks[0].dmg, kind: ticks[0] && ticks[0].kind, burnOff: !m.status.burn }; });
  ok(r.first === 100 && r.hp0 === 900 && r.ticks >= 5 && r.ticks <= 7 && r.tick === 4 && r.kind === 'fire' && r.hp === 900 - 4 * r.ticks && r.burnOff, 'burn: 4 per 0.5 s, 5–7 ticks, then off', r);

  /* 5b. bleed via o.dot alias, stun stops the mob, shield absorbs */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1100, 1000, 1); m.hp = m.hpMax = 1000; m.def = 0;
    R.hit(R.player, m, 100, { dot: 'bleed', stun: 1 }); const x0 = m.x; T.steps(45); const movedStunned = Math.abs(m.x - x0);  /* 0.75 s: still stunned, one bleed tick at 0.5 s */
    const bleeds = T.hits.filter(h => h.dot && h.kind === 'bleed').length;
    m.status.shield = 30; const s = R.hit(R.player, m, 50); return { movedStunned, bleeds, stunUntil: m.status.stun, shieldDmg: s.dmg, absorbed: s.absorbed, shieldLeft: m.status.shield }; });
  ok(r.movedStunned < 1 && r.stunUntil > 0, 'stun: the mob does not move for its duration', r);
  ok(r.bleeds >= 1, 'o.dot:"bleed" alias ticks', r.bleeds);
  ok(r.shieldDmg === 20 && r.absorbed === 30 && r.shieldLeft === 0, 'shield pool 30 absorbs 30 of 50', r);

  /* 6. i-frames block */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1500, 1500, 1); m.hp = m.hpMax = 1000; m.ai.off = true; m.inv = R.t + 1;
    const a = R.hit(R.player, m, 50); const hp1 = m.hp; T.steps(61); const b = R.hit(R.player, m, 50); return { blocked: a.blocked, dmg: a.dmg, hp1, hitEvents: T.hits.length, after: b.dmg }; });
  ok(r.blocked && r.dmg === 0 && r.hp1 === 1000 && r.hitEvents === 1, 'inv > R.t → no damage, no hit event', r);
  ok(r.after > 0, 'after the i-frames the next hit lands', r.after);

  /* 6b. knockback pushes the target away from the source */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('sword', 1050, 1000, 1); m.ai.off = true; R.hit(R.player, m, 1, { knock: 40 }); return { x: Math.round(m.x), y: Math.round(m.y) }; });
  ok(r.x === 1090 && r.y === 1000, 'knock 40 pushes the target 40 units away', r);

  /* 7. healer heals wounded allies within 200 */
  r = await pg.evaluate(() => { T.reset(); const h = R.spawnMob('skin', 3000, 3000, 1); const a = R.spawnMob('axe', 3050, 3000, 1); a.hp = Math.round(a.hpMax / 2); const far = R.spawnMob('axe', 3400, 3000, 1); far.hp = Math.round(far.hpMax / 2);
    const hp0 = a.hp; T.steps(250); return { role: h.role, hp0, hp: a.hp, hpMax: a.hpMax, far: far.hp === Math.round(far.hpMax / 2), heals: Math.round((a.hp - hp0) / Math.max(1, Math.round(a.hpMax * 0.08))) }; });
  ok(r.role === 'healer' && r.hp > r.hp0 && r.heals >= 1 && r.heals <= 2 && r.far, 'skinchanger heals the near ally 8 %/4 s, not the far one', r);

  /* 7b. necromancer raises wights while fighting (max 3); chief buffs */
  r = await pg.evaluate(() => { T.reset(1e9); const n = R.spawnMob('necro', 1200, 1000, 1); n.hp = n.hpMax = 1e9; T.steps(60 * 20);
    const wights = R.ents.filter(e => e.kind === 'mob' && e.summoner === n && !e.dead).length; const total = R.ents.filter(e => e.kind === 'mob' && e.summoner === n).length;
    return { role: n.role, wights, total, summons: n.ai.summons.length }; });
  ok(r.role === 'caster' && r.wights >= 1 && r.wights <= 3 && r.summons <= 3, 'necromancer raises wights, at most 3 alive', r);
  r = await pg.evaluate(() => { T.reset(1e9); const c = R.spawnMob('chief', 1150, 1000, 1); const a = R.spawnMob('axe', 1150, 1060, 1); T.steps(30); const buffed = a.status.atkBuff > R.t;
    a.ai.off = true; a.status.atkBuff = R.t + 5; const hp0 = R.player.hp; R.player.def = 0; const h = R.hit(a, R.player, 100); return { buffed, dmg: h.dmg }; });
  ok(r.buffed && r.dmg === 120, 'chief buffs allies: +20 % attack for 5 s', r);

  /* 8. killing a walker drops the wights within 200, not farther */
  r = await pg.evaluate(() => { T.reset(); const w = R.spawnMob('walker', 3000, 3000, 1); const a = R.spawnMob('axe', 3100, 3000, 1), b = R.spawnMob('sword', 3000, 3150, 1), far = R.spawnMob('axe', 3400, 3000, 1), cat = R.spawnMob('cat', 3050, 3050, 1);
    const xp0 = R.state.p.xp; R.hit(R.player, w, 1e6); return { w: w.dead, a: a.dead, b: b.dead, far: far.dead, cat: cat.dead, kills: T.kills.slice().sort(), xp: R.state.p.xp - xp0, aBy: a.lastHitBy === R.player }; });
  ok(r.w && r.a && r.b && !r.far && !r.cat && r.kills.join() === 'axe,sword,walker' && r.aBy, 'walker death drops wights within 200 (not the shadowcat, not the far one)', r);
  ok(r.xp > 0, 'the chain kills reward xp', r.xp);

  /* 9. mobs stop at a safe POI's edge; separation keeps them apart */
  r = await pg.evaluate(() => { T.reset(); R.data.world = { pois: [{ id: 'wf', kind: 'castle', x: 1000, y: 1000 }, { id: 'camp', kind: 'camp', x: 5000, y: 5000 }] };
    const q = R.spawnMob('axe', 1290, 1060, 1); T.steps(120); const quiet = { st: q.ai.st, d: Math.round(R.dist(q, R.player)) }; R.remove(q);
    const m = R.spawnMob('axe', 1300, 1000, 1); T.steps(2); R.hit(R.player, m, 1); T.steps(200); const d = Math.round(R.dist(m, R.player));
    const c = R.spawnMob('axe', 5000, 5000, 1); c.ai.t = 1e9; T.steps(2); const cd = Math.round(Math.hypot(c.x - 5000, c.y - 5000));
    const a1 = R.spawnMob('axe', 6000, 6000, 1), a2 = R.spawnMob('axe', 6000, 6000, 1); a1.ai.t = a2.ai.t = 1e9; T.steps(3); const sep = Math.round(R.dist(a1, a2));
    delete R.data.world; return { quiet, d, hits: T.hits.filter(h => h.tgt === R.player.id).length, st: m.ai.st, cd, sep, rsum: Math.round(a1.r + a2.r) }; });
  ok(r.quiet.st !== 'chase' && r.quiet.st !== 'attack' && r.quiet.d > 250, 'a mob does not aggro a hero who stands inside a castle', r.quiet);
  ok(r.d >= 160 && r.d <= 175 && r.hits === 0, 'a provoked mob chases to the castle safe radius (160) and cannot reach the player inside', r);
  ok(r.cd < 2, 'a camp is not a safe POI', r.cd);
  ok(r.sep >= r.rsum - 1, 'two mobs on one spot separate to their radius sum', r);

  /* 10. R.data.mobs entries are honoured; R.mobs.statsAt wins when present; elite scales */
  r = await pg.evaluate(() => { T.reset(); const keepMobs = R.mobs, keepData = R.data.mobs; R.mobs = undefined; R.data.mobs = { axe: { name: 'Test wight', hp: 77, atk: 5, def: 0, spd: 100, role: 'melee', sprite: 'axe', wight: 1 }, bowman: { hp: 40, atk: 6, spd: 120, role: 'ranged', range: 250 } };
    const a = R.spawnMob('axe', 2000, 2000, 1), bw = R.spawnMob('bowman', 2000, 2100, 1), g = R.spawnMob('giant', 2000, 2200, 1), e = R.spawnMob('axe', 2000, 2300, 1, { elite: true });
    R.mobs = { statsAt: (t, l) => ({ hp: 500 + l }) }; const s = R.spawnMob('axe', 2000, 2400, 3); R.mobs = undefined; R.data.mobs = undefined;
    return { a: [a.hpMax, a.atk, a.spd, a.name, a.sprite], bw: [bw.role, bw.range, bw.hpMax], g: [g.hpMax, g.role, g.name], e: [e.hpMax, e.name], s: s.hpMax, lvl5: (() => { const v = R.spawnMob('axe', 2000, 2500, 5).hpMax; R.mobs = keepMobs; R.data.mobs = keepData; return v; })() }; });
  ok(r.a[0] === 77 && r.a[1] === 5 && r.a[2] === 100 && r.a[3] === 'Test wight', 'R.data.mobs numbers are used as given (lvl 1 = ×1)', r.a);
  ok(r.bw[0] === 'ranged' && r.bw[1] === 250 && r.bw[2] === 40, 'a data-only type works (no fallback row)', r.bw);
  ok(r.g[0] === 580 && r.g[1] === 'melee' && r.g[2] === 'Wight giant', 'a type missing from R.data.mobs falls back to the old table', r.g);
  ok(r.e[0] === Math.round(77 * 2.2) && r.e[1].startsWith('Elite'), 'elite: ×2.2 hp, Elite name', r.e);
  ok(r.s === 503, 'R.mobs.statsAt overrides the fallback numbers', r.s);
  ok(r.lvl5 > 48, 'fallback hp scales with level', r.lvl5);

  /* 11. a ranged mob shoots a projectile at the player */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('archer', 1300, 1000, 1); let proj = 0, hit = -1;
    for (let i = 0; i < 400; i++) { R.step(); proj = Math.max(proj, R.ents.filter(e => e.kind === 'proj' && e.team === 1).length); if (hit < 0 && R.player.hp < R.player.hpMax) hit = i; }
    return { proj, hit, dist: Math.round(R.dist(m, R.player)), range: m.range }; });
  ok(r.proj >= 1 && r.hit > 0 && r.dist > 150, 'archer stops at range, shoots, the arrow hurts the player', r);

  /* 12. dead mobs are removed after 0.8 s */
  r = await pg.evaluate(() => { T.reset(); const m = R.spawnMob('axe', 1500, 1500, 1); R.hit(R.player, m, 1e6); T.steps(40); const at40 = R.ents.indexOf(m) >= 0; T.steps(12); return { at40, at52: R.ents.indexOf(m) >= 0 }; });
  ok(r.at40 && !r.at52, 'a dead mob stays 0.8 s for the die anim, then goes', r);

  /* 13. performance: 40 mobs, 600 steps */
  r = await pg.evaluate(() => { T.reset(1e9); R.player.def = 0; const types = ['axe', 'sword', 'archer', 'hound', 'skin', 'necro', 'chief', 'wolf', 'raven', 'spear'];
    for (let i = 0; i < 40; i++) { const ang = i / 40 * Math.PI * 2, d = 120 + (i % 5) * 45; R.spawnMob(types[i % types.length], 1000 + Math.cos(ang) * d, 1000 + Math.sin(ang) * d, 1); }
    const t0 = performance.now(); for (let i = 0; i < 600; i++) R.step(); const ms = performance.now() - t0;
    return { ms: Math.round(ms * 10) / 10, mobs: R.ents.filter(e => e.kind === 'mob' && !e.dead).length, hits: T.hits.length, hp: R.player.hp }; });
  ok(r.ms < 300, '40 mobs × 600 steps in < 300 ms', r);
  ok(r.hits > 100 && r.hp < 1e9, 'the crowd actually fights', { hits: r.hits });

  await b.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
