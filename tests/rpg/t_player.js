// A12 — the player system (src/rpg/js/21_player.js): camera-relative movement + sprint, the three-hit attack combo, dodge i-frames,
// xp / levels (the ARCH curve), potions, permadeath (Hall of the Fallen, next hero), interaction, gold / gems.
// Build first: python3 src/build_rpg.py beta/index.html  (or set HOLDOR_HTML to another built page).
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info != null ? ' ' + info : ''); };
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  p.on('pageerror', e => errors.push('PE:' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); });   // the Telegram SDK include is not reachable offline
  await p.goto('file://' + path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await p.waitForFunction(() => window.R && R.plr && R.sys && R.sys.player, { timeout: 20000 });
  /* 0. the whole build for 6000 steps (100 game s): R.hit is wrapped once — 21_player and 24_physics must not re-wrap each other
     every step (the chain grew ~2 a step until R.hit overflowed the stack) — and it still deals damage */
  const wrapRun = await p.evaluate(() => { const d0 = R.plr.hitDepth(); const t0 = performance.now(); let err = null; try { for (let i = 0; i < 6000; i++) R.step(); } catch (x) { err = x.message; }
    const depth = R.plr.hitDepth(); let works = null; try { const m = R.spawn({ kind: 'mob', type: 'axe', team: 1, x: 10, y: 10, hp: 1000, hpMax: 1000, def: 0, r: 14 }); const pl = { kind: 'npc', team: 0, atk: 10, x: 0, y: 0 }; R.hit(pl, m, 50); works = m.hp < 1000; R.remove(m); } catch (x) { works = 'threw ' + x.message; }
    return { d0, depth, works, err, ms: Math.round(performance.now() - t0) }; });
  ok('6000 steps of the whole build: R.hit wrapped at most 4 deep and still deals damage', !wrapRun.err && wrapRun.depth <= 4 && wrapRun.works === true, JSON.stringify(wrapRun));
  const r = await p.evaluate(() => {
    const out = {}; const got = {}; const step = n => { for (let i = 0; i < (n || 1); i++) R.step(); };
    for (const n of ['hit', 'levelup', 'xp', 'death', 'gold', 'gems', 'refused', 'interact', 'dodge', 'attack', 'kill', 'respawn']) R.bus.on(n, (...a) => (got[n] = got[n] || []).push(a));
    const press = (name, n) => { R.input.pressed = k => k === name; step(1); R.input.pressed = () => false; if (n) step(n - 1); };
    R.stop(); R.running = false; while (R.ui && R.ui.cur) R.ui.close(); R.t = 0;   /* timings below are in steps: start the clock clean after the long run */
    /* the integrated build runs ~30 systems: keep the player's and combat's own, so the joystick module, the world's gates and population
       and the physics layer do not move the test hero */
    R.sysList = R.sysList.filter(s => ['player', 'combat', 'ai', 'proj'].includes(s.name)); if (R.phys) R.phys.off = true;
    /* a v2 save: the hero is a champion, world records live in acc */
    R.state = R.newState(); const S = R.state; S.p.name = 'Tester'; S.p.hero = 'jon'; S.p.house = 'stark'; S.p.gold = 100; S.p.potions = { hp: 2, mana: 0 }; S.p.pos = { x: 3000, y: 6000 };
    S.acc = { house: 'stark', champs: { jon: { unlocked: 1, runs: 0 }, arya: { unlocked: 1, runs: 0 } }, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: {} };
    R.data.champs = R.data.champs || {}; R.data.champs.jon = R.data.champs.jon || { type: 'melee' }; R.data.champs.__tr = { type: 'ranged' }; R.data.champs.__tm = { type: 'mage' };
    out.clsMap = [R.plr.clsOf('jon'), R.plr.clsOf('__tr'), R.plr.clsOf('__tm')];
    const e = R.plr.ensure(); out.made = !!(e && R.player === e && e.kind === 'player' && e.team === 0 && R.ents.includes(e));
    out.cls = S.p.cls; const H = R.plr.heroStats('jon', 1) || {}; out.hpMax = e.hpMax; const K = e.statK || { hp: 1, atk: 1, def: 1 }; out.statK = K;
    /* the ARCH formulas scaled by the champion's line (R.champs.statsAt / ref*, half the spread, clamped), knight hp ×1.2 */
    out.hpMaxExp = R.champs && R.champs.refHp ? Math.round((120 + 18 + 30) * K.hp * 1.2) : Math.round((120 + 18 + 30 + (H.hp || 0)) * 1.2); out.hpFull = e.hp === e.hpMax; out.atk = e.atk;
    out.atkExp = R.champs && R.champs.refAtk ? Math.round((10 + 2 + 7.5) * K.atk * 10) / 10 : Math.round((10 + 2 + 7.5 + (H.atk || 0)) * 10) / 10;
    out.kSane = [K.hp, K.atk, K.def].every(k => k >= 0.8 && k <= 1.25);
    /* movement: 170 u/s, camera relative, sprint after 1.5 s at 240, stops for a screen */
    out.spd = e.spd; R.cam.yaw = 0; R.input.move = { x: 1, y: 0 }; let x0 = e.x, y0 = e.y; step(60); out.move1s = +(e.x - x0).toFixed(2); out.moveAnim = e.anim; out.face = e.face;
    R.input.move = { x: 0, y: 0 }; step(1); out.idleAnim = e.anim;
    R.cam.yaw = Math.PI / 2; R.input.move = { x: 0, y: -1 }; x0 = e.x; y0 = e.y; step(60); out.camDx = +(e.x - x0).toFixed(2); out.camDy = +(e.y - y0).toFixed(2); R.cam.yaw = 0; R.input.move = { x: 0, y: 0 }; step(1);
    R.input.move = { x: 1, y: 0 }; step(90); x0 = e.x; step(60); out.sprint1s = +(e.x - x0).toFixed(2); out.sprintFlag = e.sprint; R.input.move = { x: 0, y: 0 }; step(1); out.sprintOff = e.sprint === false;
    R.screens.__t = { open() {}, close() {} }; R.ui.open('__t'); R.input.move = { x: 1, y: 0 }; x0 = e.x; step(30); out.screenBlock = e.x === x0; R.ui.close(); R.input.move = { x: 0, y: 0 }; step(1);
    const bx = e.x, lim = bx + 50; R.world = { blocked: (x, y) => x > lim }; R.input.move = { x: 1, y: 1 }; step(60); out.blockedX = +(e.x - bx).toFixed(1); out.blockedY = +(e.y - y0).toFixed(1); delete R.world; R.input.move = { x: 0, y: 0 }; step(1);
    /* the basic attack: auto-face, hit, no walking while swinging, the combo, the kill → xp */
    Math.random = () => 0.99; e.crit = 0;   /* R.hit rolls crits with R.rng: no crit chance, so the combo numbers are exact */
    /* 25_progression pays a first kill of each mob type once more (+3 xp units): mark the axeman as seen, so only mob.xp is counted */
    S.p.prog = S.p.prog && typeof S.p.prog === 'object' ? S.p.prog : {}; S.p.prog.kin = Object.assign(S.p.prog.kin || {}, { axe: 1 });
    const m = R.spawn({ kind: 'mob', type: 'axe', name: 'Axeman', x: e.x - 40, y: e.y, r: 14, team: 1, hp: 500, hpMax: 500, def: 0, lvl: 1, xp: 20 });
    press('attack'); out.hit1 = got.hit && got.hit.length === 1 && got.hit[0][0].tgt === m ? got.hit[0][0].dmg : null; out.mobHp = m.hp; out.atkAnim = e.anim; out.autoFace = e.face;
    R.input.move = { x: 1, y: 0 }; x0 = e.x; step(5); out.noWalkInAttack = e.x === x0; R.input.move = { x: 0, y: 0 }; step(15);
    press('attack', 21); press('attack'); const h = got.hit.map(a => a[0]); out.hits = h.length; out.combo3 = h[2] && Math.abs(h[2].dmg - 1.4 * h[0].dmg) <= 1 && h[2].knock === R.plr.KNOCK3; out.knock3 = R.plr.KNOCK3; out.hd = h.map(x => [x.dmg, x.knock, x.crit]); out.knockedX = +(m.x - (e.x - 40)).toFixed(1);
    step(20); press('attack'); out.combo4 = got.attack[3] && got.attack[3][1].combo === 0;
    step(60); press('attack'); press('attack'); step(18); out.buffered = got.attack.length === 6;
    step(60); m.x = e.x - 40; m.hp = 1; press('attack'); out.killed = !!(m.dead && got.kill && got.kill.length === 1); out.xpFromKill = S.p.xp; out.killedRec = S.acc.world.killed.axe; R.remove(m);
    /* dodge: 170 units in 0.35 s, i-frames 0.4 s, cooldown 1.2 s; the wrapper over R.hit makes them real */
    const m2 = R.spawn({ kind: 'mob', type: 'walker', name: 'White Walker', x: e.x + 900, y: e.y, r: 16, team: 1, hp: 100, hpMax: 100, lvl: 5 });
    R.hit = (src, tgt, d) => { tgt.hp -= d; return d; }; step(1);
    step(60); R.input.move = { x: 0, y: 1 }; y0 = e.y; press('dodge'); R.input.move = { x: 0, y: 0 }; out.invOn = e.inv > R.t; out.dodging = e.dodging();
    const hpBefore = e.hp; const hw = R.hit(m2, e, 50); out.hitWhileInv = hw && typeof hw === 'object' ? (hw.blocked ? 0 : hw.dmg) : hw; out.hwBlocked = !!(hw && hw.blocked); out.hpAfterInv = e.hp === hpBefore; out.dodgeAgain = R.plr.dodge(e, 0, 0);
    step(21); out.dodgeDist = +(e.y - y0).toFixed(1); step(4); out.invOffLater = e.inv <= R.t; out.cdBlocks = R.plr.dodge(e, 0, 0) === false;
    step(10); const hp1 = e.hp; out.hitAfterInv = R.hit(m2, e, 10) === 10 && Math.round(hp1 - e.hp) === 10 && e.lastHitBy === m2;
    /* xp / levels */
    out.curve = [R.plr.xpNext(1), R.plr.xpNext(2), R.plr.xpNext(5), R.plr.xpNext(60)];
    const B = R.data.balance; out.curveExp = [1, 2, 5, 60].map(L => B && B.xp ? Math.round(B.xp(L)) : 80 + 45 * L + 6 * L * L);
    e.hp = Math.round(e.hpMax / 2); e.gainXp(R.plr.xpNext(1) - S.p.xp); out.lvl2 = S.p.lvl === 2 && S.p.xp === 0 && got.levelup.length === 1 && got.levelup[0][0] === 2; out.autoPts = S.p.stats.str === 7 && S.p.stats.vit === 6 && S.p.pts === 0; out.fullHeal = e.hp === e.hpMax; out.hpMax2 = e.hpMax;
    out.toastLvl = [...document.querySelectorAll('.toast')].some(t => /LEVEL 2/.test(t.textContent)) || R.ui.cur === 'levelup'; const shut = () => { while (R.ui.cur) R.ui.close(); }; shut();
    e.gainXp(R.plr.xpNext(2) - 1); out.stay2 = S.p.lvl === 2; e.gainXp(1); out.lvl3 = S.p.lvl === 3 && S.p.xp === 0; shut();
    S.opts.manualPts = 1; e.gainXp(R.plr.xpNext(3)); out.manual = S.p.lvl === 4 && S.p.pts === 3; out.spend = e.spend('str') === true && S.p.pts === 2 && S.p.stats.str === 10; S.opts.manualPts = 0; shut();
    e.gainXp(R.plr.xpNext(4) + R.plr.xpNext(5)); out.twoLevels = S.p.lvl === 6 && got.levelup.length === 5; out.bestLvl = S.acc.best.lvl; shut();
    /* potion: 40 % over 2 s, cooldown 8 s */
    e.combatT = R.t; e.hp = Math.round(e.hpMax * 0.3); const hp0 = e.hp; press('potion'); out.potUsed = S.p.potions.hp === 1; step(120); out.potHeal = +(e.hp - hp0).toFixed(1); out.potExp = +(e.hpMax * 0.4).toFixed(1);
    e.hp = Math.round(e.hpMax * 0.3); press('potion'); out.potCd = S.p.potions.hp === 1;
    /* regeneration (the owner): nothing during combat; 3 s after the last hit given or taken, 4 % of hpMax a second, with a soft +N */
    e.healT = 0; e.combatT = R.t; e.hp = Math.round(e.hpMax * 0.5); let rg = 0; const rf = (x, n) => { rg += n; }; R.bus.on('regen', rf); const h0 = e.hp; step(60); out.regenIn = Math.round(e.hp - h0);
    step(150); const h1 = e.hp; step(60); out.regen1s = +((e.hp - h1) / e.hpMax).toFixed(4); out.regenEv = rg; R.bus.off('regen', rf); e.hp = e.hpMax;
    /* interaction */
    const npc = R.spawn({ kind: 'npc', type: 'maester', name: 'Maester Aemon', x: e.x + 50, y: e.y, r: 14, team: 2, hp: 1 }); step(7); out.interactSet = !!(R.input.interact && R.input.interact.e === npc && R.input.interact.label === 'TALK');
    press('interact'); out.interactEv = !!(got.interact && got.interact[0][0] === npc); npc.x += 500; step(7); out.interactGone = R.input.interact === null;
    /* gold / gems */
    out.goldDbg = [S.p.gold, (got.refused || []).length, S.p.gems]; out.goldRefuse = e.gold(-500) === false && S.p.gold === 100 && got.refused.length === 1; out.goldAdd = e.gold(25) === true && S.p.gold === 125 && got.gold[got.gold.length - 1][0] === 25; const gems0 = S.p.gems || 0; out.gems = e.gems(3) === true && S.p.gems === gems0 + 3;
    /* permadeath without a death screen: the Hall gets a line, R.newHero after 4 s, input stops */
    delete R.screens.death;   /* this part is the path WITHOUT the death screen (A31 is in the build) */
    R.newHero = id => { got.newHero = id; }; const xDead = e.x; R.hit(m2, e, 99999); step(1);
    out.dead = e.dead === true && e.hp === 0 && got.death.length === 1; const hall = S.acc.hall[0] || {}; out.hall = S.acc.hall.length === 1 && hall.id === 'jon' && hall.name === 'Tester' && hall.lvl === 6 && hall.killer === 'White Walker' && typeof hall.at === 'number';
    out.runs = S.acc.champs.jon.runs === 1; out.noGoldLoss = S.p.gold === 125; out.noRespawn = !got.respawn;
    R.input.move = { x: 1, y: 0 }; step(10); out.deadStill = e.x === xDead; R.input.move = { x: 0, y: 0 }; step(230); out.newHero = got.newHero === 'arya'; out.nhDbg = [got.newHero, R.ui.cur, e.nextT, R.t];
    let saved = null; try { saved = JSON.parse(localStorage.getItem('holdor_rpg')); } catch (x) {} out.savedHall = !!(saved && saved.acc && saved.acc.hall && saved.acc.hall.length === 1);
    /* the next hero with the death screen present */
    S.p = Object.assign(R.newState().p, { name: 'Tester', hero: 'arya', house: 'stark', pos: { x: 3000, y: 6000 } }); R.remove(e); R.player = null; const e2 = R.plr.ensure(); out.hero2 = e2 !== e && e2.hero === 'arya' && e2.hp === e2.hpMax && !e2.dead;
    R.screens.death = { open(a) { got.deathOpen = a; }, close() {} }; R.hit(m2, e2, 99999); step(1); out.deathScreen = !!(got.deathOpen && got.deathOpen.hero === 'arya' && R.ui.cur === 'death' && S.acc.hall.length === 2 && S.acc.champs.arya.runs === 1);
    return out;
  });
  /* the toast shell may show one toast at a time (a queue): collect what appears over a few seconds */
  const seen = new Set();
  for (let i = 0; i < 40; i++) { (await p.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*=toast]')].map(t => t.textContent))).forEach(t => seen.add(t)); if ([...seen].some(t => t.includes('+25 gold')) && [...seen].some(t => t.includes('+3 gems'))) break; await p.waitForTimeout(150); }
  const toasts = [...seen];
  const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;
  ok('class from the champion type (melee/ranged/mage)', r.clsMap.join() === 'knight,ranger,maester', r.clsMap.join());
  ok('player made from the save, knight stats by the ARCH formulas', r.made && r.cls === 'knight' && Math.abs(r.hpMax - r.hpMaxExp) <= 1 && r.hpFull && Math.abs(r.atk - r.atkExp) <= 0.11 && r.kSane, JSON.stringify([r.hpMax, r.hpMaxExp, r.atk, r.atkExp, r.statK]));
  ok('moves its speed (170, or the champion\'s 165/155/150) in 60 steps, walk anim, faces +x', near(r.move1s, r.spd, 1.5) && r.moveAnim === 'walk' && r.face === 1 && r.idleAnim === 'idle', r.move1s);
  ok('camera-relative: yaw pi/2, stick up → +x', near(r.camDx, r.spd, 1.5) && near(r.camDy, 0, 0.01), JSON.stringify([r.camDx, r.camDy]));
  ok('sprint after 1.5 s: speed × 240/170 a second', near(r.sprint1s, r.spd * 240 / 170, 2) && r.sprintFlag === true && r.sprintOff, r.sprint1s);
  ok('no movement while a screen is open', r.screenBlock);
  ok('R.world.blocked stops x and keeps sliding along y', near(r.blockedX, 50, 3) && r.blockedY > 100, JSON.stringify([r.blockedX, r.blockedY]));
  ok('attack hits the mob in range, auto-faces it, attack anim, no walking while swinging', r.hit1 > 0 && r.mobHp === 500 - r.hit1 && r.atkAnim === 'attack' && r.autoFace === -1 && r.noWalkInAttack, JSON.stringify([r.hit1, r.mobHp]));
  ok('three-hit combo: the third does ×1.4 with a short knockback (stays in reach), the fourth restarts', r.hits === 3 && r.combo3 && near(r.knockedX, -r.knock3, 1) && r.combo4, JSON.stringify([r.hits, r.knockedX, r.knock3, r.combo3, r.combo4, r.hd]));
  ok('a press during the swing is buffered', r.buffered);
  ok('a kill gives xp (mob.xp) and counts in acc.world.killed', r.killed && r.xpFromKill === 20 && r.killedRec === 1, JSON.stringify([r.xpFromKill, r.killedRec]));
  ok('dodge: i-frames at once, R.hit returns 0 while invulnerable, 170 units in 0.35 s', r.invOn && r.dodging && r.hitWhileInv === 0 && r.hpAfterInv && r.dodgeAgain === false && near(r.dodgeDist, 170, 2) && r.invOffLater && r.cdBlocks, JSON.stringify([r.dodgeDist, r.hitWhileInv]));
  ok('after the i-frames a hit lands and the hitter is remembered', r.hitAfterInv);
  ok('xp curve = R.data.balance.xp (80 + 45L + 6L² + 0.15(L−1)³; ARCH without balance)', r.curve.join() === r.curveExp.join() && r.curve[0] === 131, r.curve.join() + ' vs ' + r.curveExp.join());
  ok('level 2 at the curve value: event, auto points, full heal, toast or the level-up screen', r.lvl2 && r.autoPts && r.fullHeal && r.toastLvl, JSON.stringify([r.lvl2, r.autoPts, r.fullHeal, r.toastLvl]));
  ok('one xp short stays, one more levels', r.stay2 && r.lvl3);
  ok('manual points: +3 to spend, spend one', r.manual && r.spend);
  ok('two levels in one gain, acc.best.lvl follows', r.twoLevels && r.bestLvl === 6, r.bestLvl);
  ok('potion heals 40 % over 2 s, the second waits for the cooldown', r.potUsed && near(r.potHeal, r.potExp, 3) && r.potCd, JSON.stringify([r.potHeal, r.potExp]));
  ok('regeneration: none in combat, 4 %/s from 3 s after the last hit, regen events', r.regenIn === 0 && Math.abs(r.regen1s - 0.04) < 0.004 && r.regenEv > 0, JSON.stringify([r.regenIn, r.regen1s, r.regenEv]));
  ok('interact target within 70 units, interact event, cleared when gone', r.interactSet && r.interactEv && r.interactGone);
  ok('gold refused when short, added with events, gems', r.goldRefuse && r.goldAdd && r.gems, JSON.stringify([r.goldRefuse, r.goldAdd, r.gems, r.goldDbg]));
  ok('gold toast', toasts.some(t => t.includes('+25 gold')) && toasts.some(t => t.includes('+3 gems')), JSON.stringify(toasts));
  ok('permadeath: dead, death event, Hall line with the killer, runs++, no gold loss, no respawn, input stops', r.dead && r.hall && r.runs && r.noGoldLoss && r.noRespawn && r.deadStill);
  ok('without a death screen R.newHero gets the next unlocked champion after 4 s; the save holds the Hall', r.newHero && r.savedHall, JSON.stringify([r.newHero, r.savedHall, r.nhDbg]));
  ok('the next hero is made fresh; with the death screen present it opens', r.hero2 && r.deathScreen);
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(T, null, 1));
  await browser.close(); process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
