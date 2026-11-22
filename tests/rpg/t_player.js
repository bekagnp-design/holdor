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
  const r = await p.evaluate(() => {
    const out = {}; const got = {}; const step = n => { for (let i = 0; i < (n || 1); i++) R.step(); };
    for (const n of ['hit', 'levelup', 'xp', 'death', 'gold', 'gems', 'refused', 'interact', 'dodge', 'attack', 'kill', 'respawn']) R.bus.on(n, (...a) => (got[n] = got[n] || []).push(a));
    const press = (name, n) => { R.input.pressed = k => k === name; step(1); R.input.pressed = () => false; if (n) step(n - 1); };
    R.stop(); R.running = false;
    /* a v2 save: the hero is a champion, world records live in acc */
    R.state = R.newState(); const S = R.state; S.p.name = 'Tester'; S.p.hero = 'jon'; S.p.house = 'stark'; S.p.gold = 100; S.p.potions = { hp: 2, mana: 0 }; S.p.pos = { x: 3000, y: 6000 };
    S.acc = { house: 'stark', champs: { jon: { unlocked: 1, runs: 0 }, arya: { unlocked: 1, runs: 0 } }, hall: [], titles: [], title: '', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: {} };
    R.data.champs = R.data.champs || {}; R.data.champs.jon = R.data.champs.jon || { type: 'melee' }; R.data.champs.__tr = { type: 'ranged' }; R.data.champs.__tm = { type: 'mage' };
    out.clsMap = [R.plr.clsOf('jon'), R.plr.clsOf('__tr'), R.plr.clsOf('__tm')];
    const e = R.plr.ensure(); out.made = !!(e && R.player === e && e.kind === 'player' && e.team === 0 && R.ents.includes(e));
    out.cls = S.p.cls; const H = R.plr.heroStats('jon', 1) || {}; out.hpMax = e.hpMax; out.hpMaxExp = Math.round((120 + 18 + 30 + (H.hp || 0)) * 1.2); out.hpFull = e.hp === e.hpMax; out.atk = e.atk; out.atkExp = Math.round((10 + 2 + 7.5 + (H.atk || 0)) * 10) / 10;
    /* movement: 170 u/s, camera relative, sprint after 1.5 s at 240, stops for a screen */
    R.cam.yaw = 0; R.input.move = { x: 1, y: 0 }; let x0 = e.x, y0 = e.y; step(60); out.move1s = +(e.x - x0).toFixed(2); out.moveAnim = e.anim; out.face = e.face;
    R.input.move = { x: 0, y: 0 }; step(1); out.idleAnim = e.anim;
    R.cam.yaw = Math.PI / 2; R.input.move = { x: 0, y: -1 }; x0 = e.x; y0 = e.y; step(60); out.camDx = +(e.x - x0).toFixed(2); out.camDy = +(e.y - y0).toFixed(2); R.cam.yaw = 0; R.input.move = { x: 0, y: 0 }; step(1);
    R.input.move = { x: 1, y: 0 }; step(90); x0 = e.x; step(60); out.sprint1s = +(e.x - x0).toFixed(2); out.sprintFlag = e.sprint; R.input.move = { x: 0, y: 0 }; step(1); out.sprintOff = e.sprint === false;
    R.screens.__t = { open() {}, close() {} }; R.ui.open('__t'); R.input.move = { x: 1, y: 0 }; x0 = e.x; step(30); out.screenBlock = e.x === x0; R.ui.close(); R.input.move = { x: 0, y: 0 }; step(1);
    const bx = e.x, lim = bx + 50; R.world = { blocked: (x, y) => x > lim }; R.input.move = { x: 1, y: 1 }; step(60); out.blockedX = +(e.x - bx).toFixed(1); out.blockedY = +(e.y - y0).toFixed(1); delete R.world; R.input.move = { x: 0, y: 0 }; step(1);
    /* the basic attack: auto-face, hit, no walking while swinging, the combo, the kill → xp */
    Math.random = () => 0.99;
    const m = R.spawn({ kind: 'mob', type: 'axe', name: 'Axeman', x: e.x - 40, y: e.y, r: 14, team: 1, hp: 500, hpMax: 500, def: 0, lvl: 1, xp: 20 });
    press('attack'); out.hit1 = got.hit && got.hit.length === 1 && got.hit[0][0].tgt === m ? got.hit[0][0].dmg : null; out.mobHp = m.hp; out.atkAnim = e.anim; out.autoFace = e.face;
    R.input.move = { x: 1, y: 0 }; x0 = e.x; step(5); out.noWalkInAttack = e.x === x0; R.input.move = { x: 0, y: 0 }; step(15);
    press('attack', 21); press('attack'); const h = got.hit.map(a => a[0]); out.hits = h.length; out.combo3 = h[2] && Math.abs(h[2].dmg - 1.4 * h[0].dmg) <= 1 && h[2].knock === 70; out.knockedX = +(m.x - (e.x - 40)).toFixed(1);
    step(20); press('attack'); out.combo4 = got.attack[3] && got.attack[3][1].combo === 0;
    step(60); press('attack'); press('attack'); step(18); out.buffered = got.attack.length === 6;
    step(60); m.x = e.x - 40; m.hp = 1; press('attack'); out.killed = !!(m.dead && got.kill && got.kill.length === 1); out.xpFromKill = S.p.xp; out.killedRec = S.acc.world.killed.axe; R.remove(m);
    /* dodge: 170 units in 0.35 s, i-frames 0.4 s, cooldown 1.2 s; the wrapper over R.hit makes them real */
    const m2 = R.spawn({ kind: 'mob', type: 'walker', name: 'White Walker', x: e.x + 900, y: e.y, r: 16, team: 1, hp: 100, hpMax: 100, lvl: 5 });
    R.hit = (src, tgt, d) => { tgt.hp -= d; return d; }; step(1);
    step(60); R.input.move = { x: 0, y: 1 }; y0 = e.y; press('dodge'); R.input.move = { x: 0, y: 0 }; out.invOn = e.inv > R.t; out.dodging = e.dodging();
    const hpBefore = e.hp; out.hitWhileInv = R.hit(m2, e, 50); out.hpAfterInv = e.hp === hpBefore; out.dodgeAgain = R.plr.dodge(e, 0, 0);
    step(21); out.dodgeDist = +(e.y - y0).toFixed(1); step(4); out.invOffLater = e.inv <= R.t; out.cdBlocks = R.plr.dodge(e, 0, 0) === false;
    step(10); const hp1 = e.hp; out.hitAfterInv = R.hit(m2, e, 10) === 10 && Math.round(hp1 - e.hp) === 10 && e.lastHitBy === m2;
    /* xp / levels */
    out.curve = [R.plr.xpNext(1), R.plr.xpNext(2), R.plr.xpNext(5), R.plr.xpNext(60)];
    e.hp = Math.round(e.hpMax / 2); e.gainXp(R.plr.xpNext(1) - S.p.xp); out.lvl2 = S.p.lvl === 2 && S.p.xp === 0 && got.levelup.length === 1 && got.levelup[0][0] === 2; out.autoPts = S.p.stats.str === 7 && S.p.stats.vit === 6 && S.p.pts === 0; out.fullHeal = e.hp === e.hpMax; out.hpMax2 = e.hpMax;
    out.toastLvl = [...document.querySelectorAll('.toast')].some(t => /LEVEL 2/.test(t.textContent));
    e.gainXp(R.plr.xpNext(2) - 1); out.stay2 = S.p.lvl === 2; e.gainXp(1); out.lvl3 = S.p.lvl === 3 && S.p.xp === 0;
    S.opts.manualPts = 1; e.gainXp(R.plr.xpNext(3)); out.manual = S.p.lvl === 4 && S.p.pts === 3; out.spend = e.spend('str') === true && S.p.pts === 2 && S.p.stats.str === 10; S.opts.manualPts = 0;
    e.gainXp(R.plr.xpNext(4) + R.plr.xpNext(5)); out.twoLevels = S.p.lvl === 6 && got.levelup.length === 5; out.bestLvl = S.acc.best.lvl;
    /* potion: 40 % over 2 s, cooldown 8 s */
    e.combatT = R.t; e.hp = Math.round(e.hpMax * 0.3); const hp0 = e.hp; press('potion'); out.potUsed = S.p.potions.hp === 1; step(120); out.potHeal = +(e.hp - hp0).toFixed(1); out.potExp = +(e.hpMax * 0.4).toFixed(1);
    e.hp = Math.round(e.hpMax * 0.3); press('potion'); out.potCd = S.p.potions.hp === 1;
    /* interaction */
    const npc = R.spawn({ kind: 'npc', type: 'maester', name: 'Maester Aemon', x: e.x + 50, y: e.y, r: 14, team: 2, hp: 1 }); step(7); out.interactSet = !!(R.input.interact && R.input.interact.e === npc && R.input.interact.label === 'TALK');
    press('interact'); out.interactEv = !!(got.interact && got.interact[0][0] === npc); npc.x += 500; step(7); out.interactGone = R.input.interact === null;
    /* gold / gems */
    out.goldRefuse = e.gold(-500) === false && S.p.gold === 100 && got.refused.length === 1; out.goldAdd = e.gold(25) === true && S.p.gold === 125 && got.gold[got.gold.length - 1][0] === 25; out.gems = e.gems(3) === true && S.p.gems === 3;
    /* permadeath without a death screen: the Hall gets a line, R.newHero after 4 s, input stops */
    R.newHero = id => { got.newHero = id; }; const xDead = e.x; R.hit(m2, e, 99999); step(1);
    out.dead = e.dead === true && e.hp === 0 && got.death.length === 1; const hall = S.acc.hall[0] || {}; out.hall = S.acc.hall.length === 1 && hall.id === 'jon' && hall.name === 'Tester' && hall.lvl === 6 && hall.killer === 'White Walker' && typeof hall.at === 'number';
    out.runs = S.acc.champs.jon.runs === 1; out.noGoldLoss = S.p.gold === 125; out.noRespawn = !got.respawn;
    R.input.move = { x: 1, y: 0 }; step(10); out.deadStill = e.x === xDead; R.input.move = { x: 0, y: 0 }; step(230); out.newHero = got.newHero === 'arya';
    let saved = null; try { saved = JSON.parse(localStorage.getItem('holdor_rpg')); } catch (x) {} out.savedHall = !!(saved && saved.acc && saved.acc.hall && saved.acc.hall.length === 1);
    /* the next hero with the death screen present */
    S.p = Object.assign(R.newState().p, { name: 'Tester', hero: 'arya', house: 'stark', pos: { x: 3000, y: 6000 } }); R.remove(e); R.player = null; const e2 = R.plr.ensure(); out.hero2 = e2 !== e && e2.hero === 'arya' && e2.hp === e2.hpMax && !e2.dead;
    R.screens.death = { open(a) { got.deathOpen = a; }, close() {} }; R.hit(m2, e2, 99999); step(1); out.deathScreen = !!(got.deathOpen && got.deathOpen.hero === 'arya' && R.ui.cur === 'death' && S.acc.hall.length === 2 && S.acc.champs.arya.runs === 1);
    return out;
  });
  await p.waitForTimeout(700);
  const toasts = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
  const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;
  ok('class from the champion type (melee/ranged/mage)', r.clsMap.join() === 'knight,ranger,maester', r.clsMap.join());
  ok('player made from the save, knight stats by the ARCH formulas', r.made && r.cls === 'knight' && r.hpMax === r.hpMaxExp && r.hpFull && r.atk === r.atkExp, JSON.stringify([r.hpMax, r.hpMaxExp, r.atk, r.atkExp]));
  ok('moves 170 units in 60 steps, walk anim, faces +x', near(r.move1s, 170, 1.5) && r.moveAnim === 'walk' && r.face === 1 && r.idleAnim === 'idle', r.move1s);
  ok('camera-relative: yaw pi/2, stick up → +x', near(r.camDx, 170, 1.5) && near(r.camDy, 0, 0.01), JSON.stringify([r.camDx, r.camDy]));
  ok('sprint after 1.5 s: 240 units per second', near(r.sprint1s, 240, 2) && r.sprintFlag === true && r.sprintOff, r.sprint1s);
  ok('no movement while a screen is open', r.screenBlock);
  ok('R.world.blocked stops x and keeps sliding along y', near(r.blockedX, 50, 3) && r.blockedY > 100, JSON.stringify([r.blockedX, r.blockedY]));
  ok('attack hits the mob in range, auto-faces it, attack anim, no walking while swinging', r.hit1 > 0 && r.mobHp === 500 - r.hit1 && r.atkAnim === 'attack' && r.autoFace === -1 && r.noWalkInAttack, JSON.stringify([r.hit1, r.mobHp]));
  ok('three-hit combo: the third does ×1.4 with knockback, the fourth restarts', r.hits === 3 && r.combo3 && near(r.knockedX, -70, 1) && r.combo4, JSON.stringify([r.hits, r.knockedX]));
  ok('a press during the swing is buffered', r.buffered);
  ok('a kill gives xp (mob.xp) and counts in acc.world.killed', r.killed && r.xpFromKill === 20 && r.killedRec === 1, JSON.stringify([r.xpFromKill, r.killedRec]));
  ok('dodge: i-frames at once, R.hit returns 0 while invulnerable, 170 units in 0.35 s', r.invOn && r.dodging && r.hitWhileInv === 0 && r.hpAfterInv && r.dodgeAgain === false && near(r.dodgeDist, 170, 2) && r.invOffLater && r.cdBlocks, JSON.stringify([r.dodgeDist, r.hitWhileInv]));
  ok('after the i-frames a hit lands and the hitter is remembered', r.hitAfterInv);
  ok('xp curve 80 + 45L + 6L²', r.curve.join() === '131,194,455,24380', r.curve.join());
  ok('level 2 at the curve value: event, auto points, full heal, toast', r.lvl2 && r.autoPts && r.fullHeal && r.toastLvl, JSON.stringify([r.lvl2, r.autoPts, r.fullHeal, r.toastLvl]));
  ok('one xp short stays, one more levels', r.stay2 && r.lvl3);
  ok('manual points: +3 to spend, spend one', r.manual && r.spend);
  ok('two levels in one gain, acc.best.lvl follows', r.twoLevels && r.bestLvl === 6, r.bestLvl);
  ok('potion heals 40 % over 2 s, the second waits for the cooldown', r.potUsed && near(r.potHeal, r.potExp, 3) && r.potCd, JSON.stringify([r.potHeal, r.potExp]));
  ok('interact target within 70 units, interact event, cleared when gone', r.interactSet && r.interactEv && r.interactGone);
  ok('gold refused when short, added with events, gems', r.goldRefuse && r.goldAdd && r.gems);
  ok('gold toast', toasts.some(t => t.includes('+25 gold')) && toasts.some(t => t.includes('+3 gems')), JSON.stringify(toasts));
  ok('permadeath: dead, death event, Hall line with the killer, runs++, no gold loss, no respawn, input stops', r.dead && r.hall && r.runs && r.noGoldLoss && r.noRespawn && r.deadStill);
  ok('without a death screen R.newHero gets the next unlocked champion after 4 s; the save holds the Hall', r.newHero && r.savedHall);
  ok('the next hero is made fresh; with the death screen present it opens', r.hero2 && r.deathScreen);
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(T, null, 1));
  await browser.close(); process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
