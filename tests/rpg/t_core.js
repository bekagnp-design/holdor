// RPG core (A01 / G8) on the integrated build: boot doors (fresh → intro, living hero → world, dead hero → heroes), ONE starter rule
// (R.firstChamp = R.champs.first = R.heroes.starter = the intro's starter: Stark → brienne), fixed step, entities + garbage, v2 save with
// p.* aliases, v1 migration, newHero, screen pause (a real tap closes), camera clamp + follow, systems, errors, the inline loader.
// usage: RPG_HTML=path RPG_NOBUILD=1 CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_core.js
'use strict';
const L = require('./lib');
const { ok } = L;

(async () => {
  L.build();
  const { page: p, errors, cerrs, close } = await L.launch();
  const E = (fn, a) => p.evaluate(fn, a);
  try {
    /* ================= A: fresh boot → the intro; the inline loader gives way ================= */
    const b = await L.boot(p, { save: null, settle: 700 });
    const a0 = await E(() => ({ v: R.VERSION, boot: R.boot, cur: R.ui.cur, player: !!R.player, hero: R.state && R.state.p && R.state.p.hero, loader: !!document.getElementById('boot'),
      gl: document.querySelectorAll('canvas#gl').length === 1 && document.getElementById('gl').nextElementSibling === document.getElementById('c'), vw: R.vw, vh: R.vh }));
    ok('R.VERSION 2.0.0', a0.v === '2.0.0', a0.v);
    ok('fresh boot: the intro opens (R.boot intro), no hero yet, the inline loader is gone', b.booted && a0.boot === 'intro' && a0.cur === 'intro' && !a0.hero && !a0.loader, JSON.stringify(a0));
    ok('one #gl canvas, right before #c; viewport 390×844', a0.gl && a0.vw === 390 && a0.vh === 844, JSON.stringify(a0));
    const first = await E(() => ({ core: ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'].map(h => R.firstChamp(h)),
      a10: R.champs && R.champs.first ? ['stark', 'lannister', 'martell'].map(h => R.champs.first(h)) : null, heroes: R.heroes ? ['stark', 'lannister', 'martell'].map(h => R.heroes.starter(h)) : null,
      intro: R.intro && R.intro.starter ? ['stark', 'lannister', 'martell'].map(h => R.intro.starter(h)) : null, ns: Object.keys(R.newState('tyrell').acc.champs) }));
    ok('one starter rule: R.firstChamp = R.champs.first = R.heroes.starter = the intro (Stark brienne, Lannister kevan, Martell areo); newState unlocks it', first.core.join() === 'brienne,kevan,gendry,viserys,rodrik,garlan,areo' && (!first.a10 || first.a10.join() === 'brienne,kevan,areo') && (!first.heroes || first.heroes.join() === 'brienne,kevan,areo') && (!first.intro || first.intro.join() === 'brienne,kevan,areo') && first.ns.join() === 'garlan', JSON.stringify(first));

    /* the default hero: newState(stark) + newHero() */
    await E(() => { const ce = R.clearEnts; R.clearEnts = () => { window.__nullWhy = (new Error('clear').stack || '').split('\n').slice(2, 6).map(x => x.trim().replace(/\(file:.*?:(\d+):\d+\)/, '@$1')).join(' < '); return ce(); }; });
    const nh0 = await E(() => { R.ui.close(); R.state = R.newState('stark'); const e = R.newHero(); const p = R.state.p, st = R.statsFor(p), h = R.homePos('stark');
      return { hero: p.hero, name: p.name, cls: p.cls, lvl: p.lvl, runs: R.state.acc.champs[p.hero].runs, kind: e.kind, type: e.type, team: e.team, keep: e.keep, hpMax: e.hpMax, hp: e.hp, st, x: e.x, y: e.y, h, cur: R.ui.cur, running: R.running, saved: JSON.parse(localStorage.getItem('holdor_rpg')).p.hero }; });
    ok('newHero(): the starter brienne (Brienne of Tarth, knight, L1, run 1), a player entity (type = id, team 0, keep), full hp (the player module stats), at the house seat, saved', nh0.hero === 'brienne' && nh0.name === 'Brienne of Tarth' && nh0.cls === 'knight' && nh0.lvl === 1 && nh0.runs === 1 && nh0.kind === 'player' && nh0.type === 'brienne' && nh0.team === 0 && nh0.keep && nh0.hp === nh0.hpMax && nh0.hpMax > 0 && Math.abs(nh0.x - nh0.h.x) < 1 && Math.abs(nh0.y - nh0.h.y) < 1 && nh0.cur === null && nh0.running && nh0.saved === 'brienne', JSON.stringify(nh0));
    const tAdv = await E(async () => { const t0 = R.t, w0 = performance.now(); await new Promise(r => setTimeout(r, 2500)); return { d: R.t - t0, w: (performance.now() - w0) / 1000 }; });
    ok('the loop advances R.t in real time, never faster than the clock (2.5 s)', tAdv.d > 0 && tAdv.d <= tAdv.w + 0.05, JSON.stringify(tAdv));
    const st = await E(() => { R.stop(); const t0 = R.t, k0 = R.tick; R.step(); return { d: R.t - t0, k: R.tick - k0 }; });
    ok('R.step advances R.t by 1/60 and the tick count by 1', Math.abs(st.d - 1 / 60) < 1e-9 && st.k === 1, JSON.stringify(st));

    /* entities (far from the hero so the world's own spawns stay out of the counts) */
    const ent = await E(() => {
      const X = R.player.x > 3600 ? 300 : 6900, Y = 300; const got = []; R.bus.on('kill', (e, by) => got.push([e.id, by && by.id]));
      const m = R.spawn({ kind: 'mob', type: 'axe', x: X + 50, y: Y, hp: 30 }), k = R.spawn({ kind: 'mob', type: 'sword', x: X + 100, y: Y, hp: 30, keep: true }), far = R.spawn({ kind: 'mob', type: 'archer', x: X + 1400, y: Y, hp: 30 });
      const o = { ids: [m.id, k.id, far.id], defaults: m.team === 1 && m.hpMax === 30 && m.hp === 30 && !!m.cd && !!m.status && m.dead === false,
        near: R.near(X, Y, 120).map(e => e.id), nearF: R.near(X, Y, 120, e => e.type === 'axe').map(e => e.id), nearest: R.nearest(X, Y, 2000, e => e.kind === 'mob').id, find: R.find(e => e === far) === far, dist: R.dist(m, far) };
      R.kill(m, R.player); R.kill(k); R.kill(m); o.killed = got.filter(g => g[0] === m.id || g[0] === k.id); o.pid = R.player.id; o.deadNow = m.dead && m.anim === 'die' && R.ents.includes(m);
      for (let i = 0; i < 30; i++) R.step(); o.stillAt30 = R.ents.includes(m); for (let i = 0; i < 43; i++) R.step(); o.goneAt73 = !R.ents.includes(m); o.keepStays = k.dead;
      o.nearSkipsDead = !R.near(X + 100, Y, 10).includes(k); R.remove(far); o.removed = !R.ents.includes(far); o.playerStays = R.ents.includes(R.player); R.remove(k); return o; });
    ok('spawn: ids, defaults; near / filter / nearest / find / dist', ent.ids[1] === ent.ids[0] + 1 && ent.defaults && ent.near.length === 2 && ent.nearF.length === 1 && ent.nearest === ent.ids[0] && ent.find && Math.abs(ent.dist - 1350) < 1e-6, JSON.stringify(ent));
    ok('kill: dead + die anim, kill event once with the killer, the body stays a while and is gone by 1.2 s, near skips the dead, the player is kept', ent.killed.length === 2 && ent.killed[0][1] === ent.pid && ent.deadNow && ent.goneAt73 && ent.keepStays && ent.nearSkipsDead && ent.removed && ent.playerStays, JSON.stringify(ent));

    /* save / load / aliases / migration */
    const sv = await E(() => {
      const o = {}; let saved = 0; R.bus.on('save', () => saved++); const s = R.state;
      s.p.flags.met = 1; s.p.found.push('winterfell'); s.p.title = 'Lord'; s.p.ach.push('first');
      o.alias = s.acc.world.flags.met === 1 && s.acc.world.found.includes('winterfell') && s.acc.title === 'Lord' && s.acc.ach.includes('first') && s.p.quests === s.acc.world.quests && s.p.killed === s.acc.world.killed && s.p.bosses === s.acc.world.bosses && R.acc() === s.acc;
      s.p.flags = { re: 2 }; o.aliasSet = s.acc.world.flags.re === 2 && s.p.flags.re === 2;
      const pj = JSON.parse(JSON.stringify(s.p)); o.notSerialised = !('flags' in pj) && !('found' in pj) && !('title' in pj) && !('ach' in pj) && pj.hero === 'brienne';
      s.p.gold = 123; R.player.x = 1000; R.player.y = 2000; R.player.hp = 100; const t0 = Date.now(); R.save(true);
      const raw = JSON.parse(localStorage.getItem('holdor_rpg')); o.raw = { v: raw.v, gold: raw.p.gold, pos: raw.p.pos, hp: raw.p.hp, dead: raw.p.dead, flags: raw.acc.world.flags, title: raw.acc.title, pflags: raw.p.flags, stamp: raw.saved >= t0 };
      delete raw.p.potions; delete raw.opts; delete raw.acc.best; localStorage.setItem('holdor_rpg', JSON.stringify(raw));
      R.state = null; o.loaded = R.load(); o.back = { gold: R.state.p.gold, pos: R.state.p.pos, potions: R.state.p.potions, opts: R.state.opts, best: R.state.acc.best, flagsAlias: R.state.p.flags === R.state.acc.world.flags && R.state.p.flags.re === 2, title: R.state.p.title };
      R.state.p.gold = 5; R.save(); o.debouncedNotYet = JSON.parse(localStorage.getItem('holdor_rpg')).p.gold === 123;
      const v1 = { v: 1, p: { name: 'Old', house: 'tyrell', cls: 'ranger', lvl: 3, gold: 9, found: ['highgarden'], flags: { a: 1 }, quests: { q1: { st: 'done' } }, ach: ['x'], title: 'Ser', killed: { axe: 4 }, bosses: {}, comps: ['loras'] }, opts: { sfx: 0 } };
      const keep = R.state; o.mig = R.load(JSON.parse(JSON.stringify(v1))); const m = R.state;
      o.migOk = m.v === 2 && m.acc.house === 'tyrell' && m.acc.world.found[0] === 'highgarden' && m.acc.world.flags.a === 1 && m.acc.world.quests.q1.st === 'done' && m.acc.ach[0] === 'x' && m.acc.title === 'Ser' && m.acc.world.killed.axe === 4 && m.p.hero === null && m.p.lvl === 3 && m.p.gold === 9 && m.p.flags === m.acc.world.flags && !('found' in JSON.parse(JSON.stringify(m.p))) && m.acc.champs[R.firstChamp('tyrell')] && m.opts.sfx === 0 && m.opts.haptic === 1;
      o.door = R.doorOf ? [R.doorOf(m), R.doorOf(keep), R.doorOf(null)] : null;
      R.state = keep;
      return new Promise(res => setTimeout(() => { o.debouncedLater = JSON.parse(localStorage.getItem('holdor_rpg')).p.gold === 5; o.saved = saved; res(o); }, 1000)); });
    ok('p.flags/found/quests/bosses/killed/ach/title alias acc.world.* / acc.*, settable, R.acc(), not serialised in p', sv.alias && sv.aliasSet && sv.notSerialised, JSON.stringify([sv.alias, sv.aliasSet, sv.notSerialised]));
    ok('save(true): v2, gold, player pos + hp + dead, acc.world.flags + acc.title, the save time stamp (R.net keeps the newer)', sv.raw.v === 2 && sv.raw.gold === 123 && sv.raw.pos.x === 1000 && sv.raw.pos.y === 2000 && sv.raw.hp === 100 && sv.raw.dead === false && sv.raw.flags.re === 2 && sv.raw.title === 'Lord' && sv.raw.pflags === undefined && sv.raw.stamp, JSON.stringify(sv.raw));
    ok('load: round-trip, missing keys filled (p.potions, opts, acc.best), aliases re-installed', sv.loaded && sv.back.gold === 123 && sv.back.pos.x === 1000 && sv.back.potions && sv.back.opts && sv.back.best && sv.back.flagsAlias && sv.back.title === 'Lord', JSON.stringify(sv.back));
    ok('save(): debounced (not at once, written within 1 s), save event fired', sv.debouncedNotYet && sv.debouncedLater && sv.saved >= 2, JSON.stringify([sv.debouncedNotYet, sv.debouncedLater, sv.saved]));
    ok('a v1 save migrates to v2 (world progress → acc.world, ach/title → acc, house → acc, the starter unlocked, opts filled)', sv.mig && sv.migOk);
    ok('doors: an account without a hero or fallen → intro, a living hero → world, no state → intro', sv.door && sv.door.join() === 'intro,world,intro', JSON.stringify(sv.door));

    /* newHero keeps the account */
    const nh = await E(() => { const o = {}; const old = R.spawn({ kind: 'mob', type: 'axe', x: 100, y: 100, hp: 5 }); let heroEv = null, starts = 0; R.bus.on('hero', id => heroEv = id); R.bus.on('start', () => starts++);
      R.state.p.gold = 500; R.state.p.lvl = 7; R.state.acc.world.flags.keepMe = 1;
      const e = R.newHero('sansa'); const p = R.state.p;
      o.hero = p.hero === 'sansa' && p.name === 'Sansa Stark' && p.cls === R.clsOf('sansa') && p.lvl === 1 && p.gold === 0 && p.dead === false && e === R.player && e.type === 'sansa' && !e.dead && e.hp === e.hpMax;
      o.cleared = !R.ents.includes(old) && R.ents.includes(e); o.runs = R.state.acc.champs.sansa.runs === 1 && R.state.acc.champs.sansa.unlocked === 1;
      o.accKept = R.state.acc.world.flags.keepMe === 1 && p.flags.keepMe === 1; o.ev = heroEv === 'sansa' && starts === 1 && R.ui.cur === null; o.saved = JSON.parse(localStorage.getItem('holdor_rpg')).p.hero === 'sansa';
      o.cls = R.clsOf('bronn') === 'ranger' && R.clsOf('jaime') === 'knight' && R.clsOf('dany') === 'maester' && R.champInfo('oberyn').name === 'Oberyn Martell' && R.champInfo('oberyn').house === 'martell' && R.champInfo('nobody').name === 'Nobody';
      return o; });
    ok('newHero(sansa): fresh L1 hero, name + class from the roster, old entities cleared, runs counted, account progress kept, hero + start events, saved', nh.hero && nh.cleared && nh.runs && nh.accKept && nh.ev && nh.saved, JSON.stringify(nh));
    ok('champInfo / clsOf (melee→knight, ranged→ranger, caster→maester)', nh.cls);

    /* screens + pause (a real tap closes) */
    await E(() => { const ev = []; window._scr = ev; R.bus.on('screen', (n, a) => ev.push([n, a]));
      R.screens.tst = { open(arg, el) { el.innerHTML = '<div id="tbody">T' + arg + '</div><button id="tbtn" class="pri" style="margin-top:40px">CLOSE</button>'; document.getElementById('tbtn').onclick = () => R.ui.close(); }, close() { ev.push(['closed']); } };
      R.screens.live = { live: true, open(arg, el) { el.textContent = 'live'; }, close() {} };
      R.stop(); R.ui.open('tst', 7); });
    const sc = await E(async () => { const o = { cur: R.ui.cur, arg: R.ui.arg, paused: R.paused, on: document.getElementById('screen').classList.contains('on'), ds: document.getElementById('screen').dataset.screen, body: document.getElementById('tbody').textContent };
      R.run(); const t0 = R.t; await new Promise(r => setTimeout(r, 600)); o.frozen = R.t === t0; R.stop(); return o; });
    ok('ui.open: cur/arg, #screen.on, data-screen, content, paused, the loop frozen', sc.cur === 'tst' && sc.arg === 7 && sc.paused && sc.on && sc.ds === 'tst' && sc.body === 'T7' && sc.frozen, JSON.stringify(sc));
    await L.tap(p, '#tbtn', { wait: 350 });
    const sc2 = await E(() => ({ cur: R.ui.cur, paused: R.paused, on: document.getElementById('screen').classList.contains('on'), html: document.getElementById('screen').innerHTML, ev: window._scr.filter(x => x[0] === 'tst' || x[0] === 'closed' || x[0] === null).slice(0, 3) }));
    const tAfter = await E(async () => { R.run(); const t0 = R.t; await new Promise(r => setTimeout(r, 2500)); return R.t - t0; });
    ok('a real tap on the screen\'s button closes it: cur null, unpaused, #screen empty, open→close events; the loop resumes', sc2.cur === null && !sc2.paused && !sc2.on && sc2.html === '' && JSON.stringify(sc2.ev) === JSON.stringify([['tst', 7], ['closed'], [null, null]]) && tAfter > 0, JSON.stringify(sc2) + ' ' + tAfter.toFixed(3));
    const lv = await E(async () => { R.run(); R.ui.open('live'); const o = { paused: R.paused, cur: R.ui.cur }; const t0 = R.t; await new Promise(r => setTimeout(r, 2500)); o.moved = R.t - t0 > 0;
      R.ui.open('tst', 1); o.swapped = R.ui.cur === 'tst' && R.paused; o.closeOther = R.ui.close('live') === false && R.ui.cur === 'tst'; R.ui.close('tst'); o.closed = R.ui.cur === null;
      o.missing = R.ui.open('nope') === null && R.ui.cur === null && !R.paused; R.pause(true); o.manual = R.paused; R.pause(false); o.manualOff = !R.paused;
      const d = R.ui.toast('hello'); o.toast = !!d && d.className === 'toast' && d.textContent === 'hello'; return o; });
    ok('live screen keeps the game running; swap; close(name) only closes that one; unknown → null; R.pause; toast', lv.cur === 'live' && !lv.paused && lv.moved && lv.swapped && lv.closeOther && lv.closed && lv.missing && lv.manual && lv.manualOff && lv.toast, JSON.stringify(lv));

    /* camera: clamp + follow (the 3D renderer owns w2s; the clamp is the core's) */
    const cam = await E(() => { R.stop(); const o = {}; const P = R.player, c = R.cam, hw = () => R.vw / (2 * c.z), hh = () => R.vh / (2 * c.z);
      P.x = -5000; P.y = -5000; R.camSnap(); o.tl = Math.abs(c.x - Math.min(R.W / 2, hw())) < 1e-6 && Math.abs(c.y - Math.min(R.H / 2, hh())) < 1e-6;
      P.x = 99999; P.y = 99999; R.camSnap(); o.br = Math.abs(c.x - Math.max(R.W / 2, R.W - hw())) < 1e-6 && Math.abs(c.y - Math.max(R.H / 2, R.H - hh())) < 1e-6;
      P.x = 3000; P.y = 6000; R.camSnap(); o.mid = c.x === 3000 && c.y === 6000;
      P.x = 3300; P.y = 6300; R.camUpdate(1 / 60); o.after1 = Math.hypot(c.x - 3300, c.y - 6300); for (let i = 0; i < 119; i++) R.camUpdate(1 / 60); o.after120 = Math.hypot(c.x - 3300, c.y - 6300);
      R.respawnAt(3000, 6000); o.w = R.w2s(R.player.x, R.player.y, 0); o.vw = R.vw; o.vh = R.vh; return o; });
    ok('camera clamps at the world edges, snaps, follows with smoothing (part way after a step, there after 2 s)', cam.tl && cam.br && cam.mid && cam.after1 > 20 && cam.after1 < 420 && cam.after120 < 1, JSON.stringify(cam));

    /* tick1s, played, rng, systems, fallbacks, homePos */
    const misc = await E(() => { R.stop(); const o = {}; let ticks = 0; R.bus.on('tick1s', () => ticks++); const pl0 = R.state.p.played; R.t = Math.floor(R.t) + 0.5; for (let i = 0; i < 60; i++) R.step(); o.ticks = ticks; o.played = R.state.p.played - pl0;
      R.rng(42); const a = [R.rng(), R.rng(), R.irnd(1, 6)]; R.rng(42); const b = [R.rng(), R.rng(), R.irnd(1, 6)]; o.rng = JSON.stringify(a) === JSON.stringify(b) && a[0] >= 0 && a[0] < 1 && a[2] >= 1 && a[2] <= 6;
      const n0 = R.sysList.length, order = []; R.sys.zz = { order: -50, update() { order.push('zz'); } }; R.addSys('aa', { order: -60, update() { order.push('aa'); } }); R.sys.bad = { order: -55, update() { throw new Error('boom'); } };
      R.step(); o.sys = order.join(',') === 'aa,zz' && R.sysList.length === n0 + 3 && R.errors.some(s => /sys:bad: boom/.test(s)); delete R.sys.bad; delete R.sys.zz; delete R.sys.aa; o.sysGone = R.sysList.length === n0;
      const B = R.data.balance, C = R.champs; R.data.balance = undefined; R.champs = undefined;
      o.xp = R.xpNext(1) === 131 && R.xpNext(10) === 1130; const s2 = R.statsFor({ lvl: 10, cls: 'ranger', stats: { str: 5, agi: 20, int: 5, vit: 10 }, gear: { weapon: { stats: { atk: 12 } } } }); o.stats = s2.hpMax === 360 && s2.atk === 72 && s2.def === 22;
      R.champs = { statsAt: (id, L) => ({ hp: 1000 + L, atk: 50 }) }; const s3 = R.statsFor({ hero: 'jon', lvl: 2, cls: 'knight', stats: { str: 5, vit: 5 } }); o.champStats = s3.hpMax === 1002 && s3.atk === 50 && s3.def === 9.4 && s3.spd === 170;
      o.firstNoA10 = R.firstChamp('stark') === 'brienne' && R.firstChamp('martell') === 'areo';
      R.data.balance = B; R.champs = C;
      const W = R.data.world, RW = R.world; R.data.world = { pois: [{ id: 'winterfell', name: 'Winterfell', type: 'castle', house: 'stark', seat: true, x: 3300, y: 2900 }, { id: 'sunspear', name: 'Sunspear', type: 'castle', house: 'martell', x: 4000, y: 11000 }] }; R.world = null;
      o.homePoi = JSON.stringify(R.homePos('stark')) === JSON.stringify({ x: 3300, y: 2900 }) && JSON.stringify(R.homePos('martell')) === JSON.stringify({ x: 4000, y: 11000 });
      R.world = { startPos: h => ({ x: 11, y: 22 }) }; o.homeWorld = R.homePos().x === 11; R.data.world = W; R.world = RW;
      o.errs = R.errors.filter(s => !/sys:bad/.test(s)); R.errors.length = 0; o.pl = !!R.player; return o; });
    ok('tick1s fires once per game second and counts p.played', misc.ticks === 1 && misc.played === 1, JSON.stringify([misc.ticks, misc.played]));
    ok('rng is deterministic by seed; systems run in order, a throwing system is logged not fatal, delete re-sorts', misc.rng && misc.sys && misc.sysGone, JSON.stringify([misc.rng, misc.sys, misc.sysGone]));
    ok('fallbacks without balance / A10: xpNext, statsFor (ranger L10 → hp 360, atk 72, def 22), statsAt fills, the starter table', misc.xp && misc.stats && misc.champStats && misc.firstNoA10, JSON.stringify(misc));
    ok('homePos: the seat POI by house; R.world.startPos first', misc.homePoi && misc.homeWorld);
    ok('no R.errors from the core itself', !misc.errs.length, misc.errs.join(' | '));

    /* reload: the saved hero enters the world at his saved position */
    const why = await E(() => R.player ? null : (window.__nullWhy || "no clearEnts")); if (why) console.log('  info R.player was cleared by: ' + why);
    await E(() => { R.run(); if (!R.player) R.enterWorld(); R.player.x = 4321; R.player.y = 8765; R.save(true); });
    await L.boot(p, { settle: 400 });
    const re = await E(() => ({ boot: R.boot, x: R.player.x, y: R.player.y, hero: R.state.p.hero, running: R.running, cur: R.ui.cur, alias: R.state.p.flags === R.state.acc.world.flags && R.state.p.flags.keepMe === 1 }));
    ok('reload: the living hero enters the world at his saved position, aliases live', re.boot === 'world' && Math.abs(re.x - 4321) < 40 && Math.abs(re.y - 8765) < 40 && re.hero === 'sansa' && re.running && re.cur === null && re.alias, JSON.stringify(re));

    /* ================= B: permadeath door: R.kill(hero) → one Hall line; reload → heroes screen, no 2nd line; RIDE → fresh hero ================= */
    const dz = await E(() => { const h0 = R.state.acc.hall.length; R.state.p.gold = 40; const k = R.spawn({ kind: 'mob', type: 'walker', name: 'Test walker', x: R.player.x + 30, y: R.player.y, hp: 10, lvl: 4 });
      R.player.lastHitBy = k; R.kill(R.player, k); R.save(true); const a = R.state.acc; return { h0, h1: a.hall.length, last: a.hall[a.hall.length - 1], dead: R.player.dead, saved: JSON.parse(localStorage.getItem('holdor_rpg')).p.dead }; });
    ok('R.kill(hero) → 21_player\'s permadeath: dead, one Hall line with the killer, saved dead', dz.dead && dz.h1 === dz.h0 + 1 && dz.last && dz.last.id === 'sansa' && /walker/i.test(dz.last.killer || '') && dz.saved === true, JSON.stringify(dz));
    await L.boot(p, { settle: 600 });
    await L.steps(p, 30);
    const dd = await E(() => ({ boot: R.boot, cur: R.ui.cur, dead: R.player && R.player.dead, hp: R.player && R.player.hp, hall: R.state.acc.hall.length, hero: R.state.p.hero, gold: R.state.p.gold, ride: !!document.querySelector('#screen .hr-ride') }));
    ok('reload with a dead hero → the heroes screen (afterDeath), the hero stays dead (hp 0), no second Hall line', dd.boot === 'heroes' && dd.cur === 'heroes' && dd.dead === true && dd.hp === 0 && dd.hall === dz.h1 && dd.hero === 'sansa' && dd.ride, JSON.stringify(dd));
    const sel = await E(() => { const c = [...document.querySelectorAll('#screen .hr-card.on')].find(x => x.dataset.id !== 'sansa'); return c ? '#screen .hr-card[data-id="' + c.dataset.id + '"]' : null; });
    if (sel) await L.tap(p, sel, { wait: 200 });
    await L.tap(p, '#screen .hr-ride', { wait: 400 });
    const nx = await E(() => ({ cur: R.ui.cur, hero: R.state.p.hero, lvl: R.state.p.lvl, gold: R.state.p.gold, dead: R.player.dead, full: R.player.hp > 0 && R.player.hp >= R.player.hpMax * 0.5, running: R.running, paused: R.paused, hall: R.state.acc.hall.length }));
    ok('RIDE tap → a fresh L1 hero, 0 gold, alive, the game runs, the Hall kept', nx.cur === null && nx.lvl === 1 && nx.gold === 0 && !nx.dead && nx.full && nx.running && !nx.paused && nx.hall === dz.h1, JSON.stringify(nx));
    await L.boot(p, { settle: 400 });
    const w2 = await E(() => ({ boot: R.boot, cur: R.ui.cur, hero: R.state.p.hero, dead: R.player.dead }));
    ok('reload with the living hero → straight into the world', w2.boot === 'world' && w2.cur === null && w2.hero === nx.hero && !w2.dead, JSON.stringify(w2));
  } catch (e) { ok('t_core ran to the end', false, e && e.stack || e); }
  const real = L.realConsole(cerrs).filter(t => !/boom/.test(t)), mine = real.filter(t => /\b(core|boot|netload|load|screen:|bus:(save|load|death|start|hero|netload))\b/.test(t));
  ok('no page errors, no thrown errors from the core / boot', !errors.length && !mine.length, errors.concat(mine).slice(0, 4).join(' | '));
  if (real.length > mine.length) console.log('  info other modules logged ' + (real.length - mine.length) + ' error(s): ' + real.filter(t => !mine.includes(t)).slice(0, 3).map(t => t.split('\n')[0].slice(0, 120)).join(' | '));
  await close();
  L.report();
})();
