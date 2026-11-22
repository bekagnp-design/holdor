// RPG core (A01): build, boot doors (default hero / intro / dead hero → heroes), fixed step, entities + garbage, v2 save with p.* aliases,
// v1 migration, newHero, screen pause (a real tap closes), camera clamp + follow, respawn, systems, errors.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_core.js
const { chromium } = require('playwright');
const path = require('path'); const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const HTML = process.env.HOLDOR_RPG_HTML || 'beta/index.html';
(async () => {
  const b = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), path.join(ROOT, HTML)], { encoding: 'utf8' });
  if (b.status !== 0) { console.log('FAIL build', b.stdout, b.stderr); process.exit(1); }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const URL = 'file://' + path.join(ROOT, HTML);
  const newPage = async (init) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true }); if (init) await c.addInitScript(init);
    const p = await c.newPage(); p.on('pageerror', e => errors.push('PE:' + e.message)); // console errors count too, except a blocked network resource (the Telegram SDK tag offline) and the 'boom' this suite throws inside a system on purpose
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Error: boom/.test(m.text())) errors.push('CE:' + m.text()); }); return p; };
  const booted = p => p.waitForFunction(() => window.R && window.R.VERSION && window.R.boot, { timeout: 15000 });

  /* ================= A: no intro / heroes module built → the house's first champion enters the world ================= */
  const p = await newPage();
  await p.goto(URL); await booted(p);
  const boot = await p.evaluate(() => ({ v: R.VERSION, boot: R.boot, running: R.running, paused: R.paused, cur: R.ui.cur, v2: R.state.v, house: R.state.acc.house, champs: R.state.acc.champs,
    hero: R.state.p.hero, name: R.state.p.name, cls: R.state.p.cls, pl: R.player && { kind: R.player.kind, type: R.player.type, team: R.player.team, r: R.player.r, hp: R.player.hp, hpMax: R.player.hpMax, atk: R.player.atk, def: R.player.def, spd: R.player.spd, keep: R.player.keep, x: R.player.x, y: R.player.y, name: R.player.name },
    ver: !!document.getElementById('ver'), cam: { x: R.cam.x, y: R.cam.y }, vw: R.vw, vh: R.vh, gl: !!document.getElementById('gl') && document.getElementById('gl').nextElementSibling === document.getElementById('c'), glw: document.getElementById('gl').width, cw: document.getElementById('c').width,
    saved: !!localStorage.getItem('holdor_rpg') }));
  ok('R.VERSION 2.0.0', boot.v === '2.0.0', boot.v);
  ok('boot: no intro → stark account, first champion jon as the hero (Jon Snow, knight), run 1, in the world, nothing open, saved', boot.boot === 'default' && boot.v2 === 2 && boot.house === 'stark' && boot.champs.jon && boot.champs.jon.unlocked === 1 && boot.champs.jon.runs === 1 && boot.hero === 'jon' && boot.name === 'Jon Snow' && boot.cls === 'knight' && boot.running && !boot.paused && boot.cur === null && boot.saved, JSON.stringify({ boot: boot.boot, hero: boot.hero, name: boot.name, cls: boot.cls, champs: boot.champs }));
  ok('player: kind player, type = champion id, team 0, r 16, keep, ARCH formulas at L1 (hp 168, atk 19.5, def 8.2, spd 170)', boot.pl && boot.pl.kind === 'player' && boot.pl.type === 'jon' && boot.pl.name === 'Jon Snow' && boot.pl.team === 0 && boot.pl.r === 16 && boot.pl.hpMax === 168 && boot.pl.hp === 168 && boot.pl.atk === 19.5 && boot.pl.def === 8.2 && boot.pl.spd === 170 && boot.pl.keep === true, JSON.stringify(boot.pl));
  ok('player at the world centre when no world data, camera on him', boot.pl && boot.pl.x === 3600 && boot.pl.y === 6144 && boot.cam.x === 3600 && boot.cam.y === 6144, JSON.stringify(boot.cam));
  ok('version label; #gl canvas before #c, both sized 390×844', boot.ver && boot.gl && boot.glw === 390 && boot.cw === 390 && boot.vw === 390 && boot.vh === 844, JSON.stringify([boot.gl, boot.glw, boot.cw]));
  const tAdv = await p.evaluate(async () => { const t0 = R.t; await new Promise(r => setTimeout(r, 400)); return R.t - t0; });
  ok('the loop advances R.t at ~60 Hz (0.4 s → 0.25..0.55)', tAdv > 0.25 && tAdv < 0.55, tAdv.toFixed(3));

  /* fixed step */
  const st = await p.evaluate(() => { R.stop(); const t0 = R.t, k0 = R.tick; R.step(); return { d: R.t - t0, k: R.tick - k0 }; });
  ok('R.step advances R.t by 1/60 and the tick count by 1', Math.abs(st.d - 1 / 60) < 1e-9 && st.k === 1, JSON.stringify(st));

  /* entities */
  const ent = await p.evaluate(() => {
    const got = []; R.bus.on('kill', (e, by) => got.push([e.id, by && by.id]));
    const m = R.spawn({ kind: 'mob', type: 'axe', x: 3650, y: 6144, hp: 30 });
    const k = R.spawn({ kind: 'mob', type: 'sword', x: 3700, y: 6144, hp: 30, keep: true });
    const far = R.spawn({ kind: 'mob', type: 'archer', x: 5000, y: 6144, hp: 30 });
    const o = { ids: [m.id, k.id, far.id], defaults: m.team === 1 && m.hpMax === 30 && m.hp === 30 && m.anim === 'idle' && !!m.cd && !!m.status && m.dead === false,
      near: R.near(3600, 6144, 120).map(e => e.id), nearF: R.near(3600, 6144, 120, e => e.kind === 'mob').map(e => e.id), nearest: R.nearest(3600, 6144, 2000, e => e.kind === 'mob').id,
      find: R.find(e => e.type === 'archer') === far, dist: R.dist(m, far) };
    R.kill(m, R.player); R.kill(k); R.kill(m);
    o.killed = got.slice(); o.deadNow = m.dead && m.anim === 'die' && R.ents.includes(m);
    for (let i = 0; i < 71; i++) R.step(); o.stillAt71 = R.ents.includes(m);
    R.step(); R.step(); o.goneAt73 = !R.ents.includes(m); o.keepStays = R.ents.includes(k) && k.dead;
    o.nearSkipsDead = !R.near(3700, 6144, 10).includes(k);
    R.remove(far); o.removed = !R.ents.includes(far); o.playerStays = R.ents.includes(R.player);
    R.remove(k); return o; });
  ok('spawn: id, defaults (team 1, hp = hpMax, idle, cd/status)', ent.ids[0] > 0 && ent.ids[1] === ent.ids[0] + 1 && ent.defaults, JSON.stringify(ent.ids));
  ok('near / near+filter / nearest / find / dist', ent.near.length === 3 && ent.nearF.length === 2 && ent.nearest === ent.ids[0] && ent.find && Math.abs(ent.dist - 1350) < 1e-6, JSON.stringify([ent.near, ent.nearF, ent.nearest, ent.dist]));
  ok('kill: dead + die anim, kill event once with the killer, body stays 1.2 s then goes, keep stays', ent.killed.length === 2 && ent.killed[0][0] === ent.ids[0] && ent.killed[0][1] === 1 && ent.deadNow && ent.stillAt71 && ent.goneAt73 && ent.keepStays, JSON.stringify(ent.killed) + ' ' + [ent.stillAt71, ent.goneAt73, ent.keepStays]);
  ok('near skips the dead; remove works; the player is never collected', ent.nearSkipsDead && ent.removed && ent.playerStays);

  /* save / load / aliases / migration */
  const sv = await p.evaluate(() => {
    const o = {}; let saved = 0; R.bus.on('save', () => saved++);
    const s = R.state; s.p.flags.met = 1; s.p.found.push('winterfell'); s.p.title = 'Lord'; s.p.ach.push('first');
    o.alias = s.acc.world.flags.met === 1 && s.acc.world.found[0] === 'winterfell' && s.acc.title === 'Lord' && s.acc.ach[0] === 'first' && s.p.quests === s.acc.world.quests && s.p.killed === s.acc.world.killed && s.p.bosses === s.acc.world.bosses && R.acc() === s.acc;
    s.p.flags = { re: 2 }; o.aliasSet = s.acc.world.flags.re === 2 && s.p.flags.re === 2;
    const pj = JSON.parse(JSON.stringify(s.p)); o.notSerialised = !('flags' in pj) && !('found' in pj) && !('title' in pj) && !('ach' in pj) && pj.hero === 'jon';
    s.p.gold = 123; R.player.x = 1000; R.player.y = 2000; R.player.hp = 100; R.save(true);
    const raw = JSON.parse(localStorage.getItem('holdor_rpg')); o.raw = { v: raw.v, gold: raw.p.gold, pos: raw.p.pos, hp: raw.p.hp, dead: raw.p.dead, flags: raw.acc.world.flags, title: raw.acc.title, pflags: raw.p.flags };
    delete raw.p.potions; delete raw.opts; delete raw.acc.best; localStorage.setItem('holdor_rpg', JSON.stringify(raw));
    R.state = null; o.loaded = R.load(); o.back = { gold: R.state.p.gold, pos: R.state.p.pos, potions: R.state.p.potions, opts: R.state.opts, best: R.state.acc.best, flagsAlias: R.state.p.flags === R.state.acc.world.flags && R.state.p.flags.re === 2, title: R.state.p.title };
    R.state.p.gold = 5; R.save(); o.debouncedNotYet = JSON.parse(localStorage.getItem('holdor_rpg')).p.gold === 123;
    // a v1 save migrates: p.found / flags / ach / title move to acc
    const v1 = { v: 1, p: { name: 'Old', house: 'tyrell', cls: 'ranger', lvl: 3, gold: 9, found: ['highgarden'], flags: { a: 1 }, quests: { q1: { st: 'done' } }, ach: ['x'], title: 'Ser', killed: { axe: 4 }, bosses: {}, comps: ['loras'] }, opts: { sfx: 0 } };
    const keep = R.state; o.mig = R.load(JSON.parse(JSON.stringify(v1))); const m = R.state;
    o.migOk = m.v === 2 && m.acc.house === 'tyrell' && m.acc.world.found[0] === 'highgarden' && m.acc.world.flags.a === 1 && m.acc.world.quests.q1.st === 'done' && m.acc.ach[0] === 'x' && m.acc.title === 'Ser' && m.acc.world.killed.axe === 4 && m.p.hero === null && m.p.lvl === 3 && m.p.gold === 9 && m.p.flags === m.acc.world.flags && m.p.title === 'Ser' && !('found' in JSON.parse(JSON.stringify(m.p))) && m.acc.champs.margaery && m.opts.sfx === 0 && m.opts.haptic === 1;
    R.state = keep;
    return new Promise(res => setTimeout(() => { o.debouncedLater = JSON.parse(localStorage.getItem('holdor_rpg')).p.gold === 5; o.saved = saved; res(o); }, 1000)); });
  ok('p.flags/found/quests/bosses/killed/ach/title alias acc.world.* / acc.*, settable, R.acc(), not serialised in p', sv.alias && sv.aliasSet && sv.notSerialised);
  ok('save(true): v2, gold, player pos + hp + dead, acc.world.flags + acc.title in localStorage holdor_rpg, no p.flags copy', sv.raw.v === 2 && sv.raw.gold === 123 && sv.raw.pos.x === 1000 && sv.raw.pos.y === 2000 && sv.raw.hp === 100 && sv.raw.dead === false && sv.raw.flags.re === 2 && sv.raw.title === 'Lord' && sv.raw.pflags === undefined, JSON.stringify(sv.raw));
  ok('load: round-trip, missing keys filled (p.potions, opts, acc.best), aliases re-installed', sv.loaded && sv.back.gold === 123 && sv.back.pos.x === 1000 && sv.back.potions && sv.back.potions.hp === 3 && sv.back.opts && sv.back.opts.sfx === 1 && sv.back.best && sv.back.best.lvl === 0 && sv.back.flagsAlias && sv.back.title === 'Lord', JSON.stringify(sv.back));
  ok('save(): debounced (not at once, written within 1 s), save event fired', sv.debouncedNotYet && sv.debouncedLater && sv.saved >= 2, JSON.stringify([sv.debouncedNotYet, sv.debouncedLater, sv.saved]));
  ok('a v1 save migrates to v2 (world progress → acc.world, ach/title → acc, house → acc, first champion unlocked, opts filled)', sv.mig && sv.migOk);
  const vis = await p.evaluate(() => { R.state.p.gold = 77; try { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); } catch (e) { return 'skip'; }
    document.dispatchEvent(new Event('visibilitychange')); const g = JSON.parse(localStorage.getItem('holdor_rpg')).p.gold; try { delete document.visibilityState; } catch (e) {} return g; });
  ok('visibilitychange hidden → immediate save', vis === 77 || vis === 'skip', String(vis));

  /* newHero */
  const nh = await p.evaluate(() => { const o = {}; R.spawn({ kind: 'mob', type: 'axe', x: 100, y: 100, hp: 5 }); let heroEv = null, starts = 0; R.bus.on('hero', id => heroEv = id); R.bus.on('start', () => starts++);
    R.state.p.gold = 500; R.state.p.lvl = 7; R.state.acc.world.flags.keepMe = 1;
    const e = R.newHero('sansa'); const p = R.state.p;
    o.hero = p.hero === 'sansa' && p.name === 'Sansa Stark' && p.cls === 'maester' && p.lvl === 1 && p.gold === 0 && p.dead === false && e === R.player && e.type === 'sansa' && e.name === 'Sansa Stark' && e.kind === 'player' && !e.dead && e.hp === e.hpMax;
    o.cleared = R.ents.length === 1 && R.ents[0] === e; o.pos = e.x === 3600 && e.y === 6144 && R.cam.x === 3600 && R.cam.y === 6144; o.runs = R.state.acc.champs.sansa.runs === 1 && R.state.acc.champs.sansa.unlocked === 1 && R.state.acc.champs.jon.runs === 1;
    o.accKept = R.state.acc.world.flags.keepMe === 1 && p.flags.keepMe === 1; o.ev = heroEv === 'sansa' && starts === 1 && R.running && R.ui.cur === null; o.saved = JSON.parse(localStorage.getItem('holdor_rpg')).p.hero === 'sansa';
    o.cls = R.clsOf('bronn') === 'ranger' && R.clsOf('jaime') === 'knight' && R.clsOf('dany') === 'maester' && R.champInfo('oberyn').name === 'Oberyn Martell' && R.champInfo('oberyn').house === 'martell' && R.firstChamp('lannister') === 'jaime' && R.firstChamp('martell') === 'oberyn' && R.champInfo('nobody').name === 'Nobody';
    return o; });
  ok('newHero(sansa): fresh L1 hero, name + class (caster → maester) from the roster, entities cleared, at home, runs counted, account progress kept, hero + start events, saved', nh.hero && nh.cleared && nh.pos && nh.runs && nh.accKept && nh.ev && nh.saved, JSON.stringify(nh));
  ok('champInfo / clsOf / firstChamp from the old roster (melee→knight, ranged→ranger, caster→maester)', nh.cls);

  /* screens + pause (real tap closes) */
  await p.evaluate(() => { const ev = []; window._scr = ev; R.bus.on('screen', (n, a) => ev.push([n, a]));
    R.screens.tst = { open(arg, el) { el.innerHTML = '<div id="tbody">T' + arg + '</div><button id="tbtn" class="pri" style="margin-top:40px">CLOSE</button>'; document.getElementById('tbtn').onclick = () => R.ui.close(); }, close() { ev.push(['closed']); } };
    R.screens.live = { live: true, open(arg, el) { el.textContent = 'live'; }, close() {} };
    R.run(); R.ui.open('tst', 7); });
  const sc = await p.evaluate(async () => { const o = { cur: R.ui.cur, arg: R.ui.arg, paused: R.paused, on: document.getElementById('screen').classList.contains('on'), ds: document.getElementById('screen').dataset.screen, body: document.getElementById('tbody').textContent };
    const t0 = R.t; await new Promise(r => setTimeout(r, 300)); o.frozen = R.t === t0; return o; });
  ok('ui.open: cur/arg, #screen.on, data-screen, content, paused', sc.cur === 'tst' && sc.arg === 7 && sc.paused && sc.on && sc.ds === 'tst' && sc.body === 'T7', JSON.stringify(sc));
  ok('the loop does not step while a screen is open', sc.frozen);
  await p.tap('#tbtn'); await p.waitForTimeout(350);
  const sc2 = await p.evaluate(() => ({ cur: R.ui.cur, paused: R.paused, on: document.getElementById('screen').classList.contains('on'), html: document.getElementById('screen').innerHTML, ev: window._scr }));
  const tAfter = await p.evaluate(async () => { const t0 = R.t; await new Promise(r => setTimeout(r, 300)); return R.t - t0; });
  ok('a real tap on the screen\'s button closes it: cur null, unpaused, #screen empty, screen events open→close', sc2.cur === null && !sc2.paused && !sc2.on && sc2.html === '' && JSON.stringify(sc2.ev) === JSON.stringify([['tst', 7], ['closed'], [null, undefined]]), JSON.stringify(sc2));
  ok('the loop resumes after close', tAfter > 0.15, tAfter.toFixed(3));
  const lv = await p.evaluate(async () => { R.ui.open('live'); const o = { paused: R.paused, cur: R.ui.cur }; const t0 = R.t; await new Promise(r => setTimeout(r, 250)); o.moved = R.t - t0 > 0.1;
    R.ui.open('tst', 1); o.swapped = R.ui.cur === 'tst' && R.paused; o.closeOther = R.ui.close('live') === false && R.ui.cur === 'tst'; R.ui.close('tst'); o.closed = R.ui.cur === null;
    o.missing = R.ui.open('nope') === null && R.ui.cur === null && !R.paused; R.pause(true); o.manual = R.paused; R.pause(false); o.manualOff = !R.paused;
    const d = R.ui.toast('hello'); o.toast = !!d && d.className === 'toast' && d.textContent === 'hello'; return o; });
  ok('live screen keeps the game running; swap screens; close(name) only closes that one; unknown screen → null; R.pause; toast', lv.cur === 'live' && !lv.paused && lv.moved && lv.swapped && lv.closeOther && lv.closed && lv.missing && lv.manual && lv.manualOff && lv.toast, JSON.stringify(lv));

  /* camera */
  const cam = await p.evaluate(() => { R.stop(); const o = {}; const P = R.player;
    P.x = -5000; P.y = -5000; R.camSnap(); o.tl = { x: R.cam.x, y: R.cam.y };
    P.x = 99999; P.y = 99999; R.camSnap(); o.br = { x: R.cam.x, y: R.cam.y };
    P.x = 3000; P.y = 6000; R.camSnap(); o.mid = { x: R.cam.x, y: R.cam.y };
    const s = R.w2s(3000, 6000); o.centre = s; const w = R.s2w(0, 0); o.corner = w; const back = R.s2w(s.x, s.y); o.inv = back;
    P.x = 3300; P.y = 6300; R.step(); o.after1 = Math.hypot(R.cam.x - 3300, R.cam.y - 6300); for (let i = 0; i < 119; i++) R.step(); o.after120 = Math.hypot(R.cam.x - 3300, R.cam.y - 6300);
    P.x = 50; P.y = 50; for (let i = 0; i < 300; i++) R.step(); o.followClamp = { x: R.cam.x, y: R.cam.y };
    R.respawnAt(3000, 6000); return o; });
  ok('camera clamps at the top-left (195, 422) and bottom-right (7005, 11866) of the 7200×12288 world', cam.tl.x === 195 && cam.tl.y === 422 && cam.br.x === 7005 && cam.br.y === 11866, JSON.stringify([cam.tl, cam.br]));
  ok('w2s of the camera point is the screen centre; s2w inverts; corner', cam.centre.x === 195 && cam.centre.y === 422 && cam.inv.x === 3000 && cam.inv.y === 6000 && cam.corner.x === 2805 && cam.corner.y === 5578, JSON.stringify([cam.centre, cam.inv, cam.corner]));
  ok('camera follows with smoothing: part way after one step, there within 1 u after 2 s', cam.after1 > 50 && cam.after1 < 420 && cam.after120 < 1, JSON.stringify([cam.after1, cam.after120]));
  ok('follow stays clamped', cam.followClamp.x === 195 && cam.followClamp.y === 422, JSON.stringify(cam.followClamp));

  /* tick1s, played, death/respawn, rng, systems, stats, homePos */
  const misc = await p.evaluate(() => { const o = {}; let ticks = 0; R.bus.on('tick1s', () => ticks++); const pl0 = R.state.p.played; R.t = Math.floor(R.t) + 0.5; for (let i = 0; i < 60; i++) R.step(); o.ticks = ticks; o.played = R.state.p.played - pl0;
    let death = 0, resp = 0; R.bus.on('death', () => death++); R.bus.on('respawn', () => resp++); R.kill(R.player); o.dead = R.player.dead && R.player.anim === 'die'; for (let i = 0; i < 200; i++) R.step(); o.playerKept = R.ents.includes(R.player);
    R.save(true); o.deadSaved = JSON.parse(localStorage.getItem('holdor_rpg')).p.dead === true;
    const e = R.respawnAt(100, 200); o.resp = e === R.player && !e.dead && e.hp === e.hpMax && e.x === 100 && e.y === 200 && death === 1 && resp === 1 && R.cam.x === 195 && R.cam.y === 422 && JSON.parse(localStorage.getItem('holdor_rpg')).p.pos.x === 100 && JSON.parse(localStorage.getItem('holdor_rpg')).p.dead === false;
    R.rng(42); const a = [R.rng(), R.rng(), R.irnd(1, 6)]; R.rng(42); const b = [R.rng(), R.rng(), R.irnd(1, 6)]; o.rng = JSON.stringify(a) === JSON.stringify(b) && a[0] >= 0 && a[0] < 1 && a[2] >= 1 && a[2] <= 6;
    const order = []; R.sys.zz = { order: 5, update() { order.push('zz'); } }; R.addSys('aa', { order: 1, update() { order.push('aa'); }, draw(c) { order.push('draw'); } }); R.sys.bad = { order: 2, update() { throw new Error('boom'); } };
    R.step(); R.drawAll(); o.sys = order.join(',') === 'aa,zz,draw' && R.sysList.length === 3 && R.errors.some(s => /sys:bad: boom/.test(s)); delete R.sys.bad; delete R.sys.zz; delete R.sys.aa; o.sysGone = R.sysList.length === 0;
    o.xp = R.xpNext(1) === 131 && R.xpNext(10) === 1130; const s2 = R.statsFor({ lvl: 10, cls: 'ranger', stats: { str: 5, agi: 20, int: 5, vit: 10 }, gear: { weapon: { stats: { atk: 12 } } } }); o.stats = s2.hpMax === 360 && s2.atk === 72 && s2.def === 22;
    R.champs = { statsAt: (id, L) => ({ hp: 1000 + L, atk: 50 }) }; const s3 = R.statsFor({ hero: 'jon', lvl: 2, cls: 'knight', stats: { str: 5, vit: 5 } }); o.champStats = s3.hpMax === 1002 && s3.atk === 50 && s3.def === 9.4 && s3.spd === 170; delete R.champs;
    o.home = JSON.stringify(R.homePos()) === JSON.stringify({ x: 3600, y: 6144 }); R.data.world = { pois: [{ id: 'winterfell', name: 'Winterfell', type: 'castle', house: 'stark', seat: true, x: 3300, y: 2900 }, { id: 'sunspear', name: 'Sunspear', type: 'castle', house: 'martell', x: 4000, y: 11000 }] };
    o.homePoi = JSON.stringify(R.homePos()) === JSON.stringify({ x: 3300, y: 2900 }) && JSON.stringify(R.homePos('martell')) === JSON.stringify({ x: 4000, y: 11000 }); delete R.data.world;
    R.world = { startPos: h => ({ x: 11, y: 22 }) }; o.homeWorld = R.homePos().x === 11; delete R.world;
    o.errs = R.errors.filter(s => !/sys:bad/.test(s)); R.errors.length = 0; return o; });
  ok('tick1s fires once per game second and counts p.played', misc.ticks === 1 && misc.played === 1, JSON.stringify([misc.ticks, misc.played]));
  ok('kill(player): death event, body kept, p.dead saved; respawnAt: full hp, position, respawn event, camera snapped, saved alive', misc.dead && misc.playerKept && misc.deadSaved && misc.resp);
  ok('rng is deterministic by seed; irnd in range', misc.rng);
  ok('systems run in order (direct assignment or addSys), a throwing system is logged to R.errors not fatal, delete re-sorts', misc.sys && misc.sysGone);
  ok('xpNext and statsFor fallbacks (ranger L10 agi20 vit10 + weapon atk12 → hp 360, atk 72, def 22); R.champs.statsAt fills hp/atk when present', misc.xp && misc.stats && misc.champStats);
  ok('homePos: world centre without data; the seat POI by house, or by the house seat name; R.world.startPos first', misc.home && misc.homePoi && misc.homeWorld);
  ok('no R.errors from the core itself', !misc.errs.length, misc.errs.join(' | '));

  /* reload: the saved hero enters the world at his saved position */
  await p.evaluate(() => { R.player.x = 4321; R.player.y = 8765; R.save(true); });
  await p.reload(); await booted(p);
  const re = await p.evaluate(() => ({ boot: R.boot, x: R.player.x, y: R.player.y, cam: [R.cam.x, R.cam.y], hero: R.state.p.hero, name: R.state.p.name, running: R.running, cur: R.ui.cur, alias: R.state.p.flags === R.state.acc.world.flags && R.state.p.flags.keepMe === 1 }));
  ok('reload: the saved hero enters the world at his saved position, camera there, aliases live', re.boot === 'world' && re.x === 4321 && re.y === 8765 && re.cam[0] === 4321 && re.cam[1] === 8765 && re.hero === 'sansa' && re.name === 'Sansa Stark' && re.running && re.cur === null && re.alias, JSON.stringify(re));
  await p.context().close();

  /* ================= B: intro + heroes screens built (pre-registered by an init script) ================= */
  const q = await newPage(() => { window.R = { screens: {
    intro: { open(arg, el) { el.innerHTML = '<h1>intro</h1><button id="go" class="pri">BEGIN</button>'; document.getElementById('go').onclick = () => { R.state = R.newState('martell'); R.newHero(); }; }, close() { window._introClosed = 1; } },
    heroes: { open(arg, el) { window._heroArg = arg; el.innerHTML = '<h1>heroes</h1><button id="next" class="pri">RIDE</button>'; document.getElementById('next').onclick = () => R.newHero('ellaria'); }, close() {} } } }; });
  await q.goto(URL); await booted(q);
  const in1 = await q.evaluate(() => ({ boot: R.boot, cur: R.ui.cur, player: R.player, running: R.running, paused: R.paused, state: R.state, h1: document.querySelector('#screen h1') && document.querySelector('#screen h1').textContent }));
  ok('no save → the intro opens: no player, loop not running, no state yet', in1.boot === 'intro' && in1.cur === 'intro' && in1.player === null && !in1.running && in1.paused && in1.state === null && in1.h1 === 'intro', JSON.stringify(in1));
  await q.tap('#go'); await q.waitForTimeout(300);
  const in2 = await q.evaluate(() => ({ cur: R.ui.cur, closed: window._introClosed, house: R.state.acc.house, hero: R.state.p.hero, name: R.state.p.name, cls: R.state.p.cls, running: R.running, paused: R.paused, pl: R.player && R.player.type, runs: R.state.acc.champs.oberyn.runs, saved: JSON.parse(localStorage.getItem('holdor_rpg')).p.hero }));
  ok('the intro\'s BEGIN tap (newState(martell) + newHero()) → Oberyn Martell, knight, intro closed, in the world, saved', in2.cur === null && in2.closed === 1 && in2.house === 'martell' && in2.hero === 'oberyn' && in2.name === 'Oberyn Martell' && in2.cls === 'knight' && in2.running && !in2.paused && in2.pl === 'oberyn' && in2.runs === 1 && in2.saved === 'oberyn', JSON.stringify(in2));
  await q.evaluate(() => { R.state.p.gold = 40; R.kill(R.player); R.save(true); });
  await q.reload(); await booted(q);
  const dd = await q.evaluate(() => ({ boot: R.boot, cur: R.ui.cur, arg: window._heroArg, dead: R.player && R.player.dead, hp: R.player && R.player.hp, running: R.running, paused: R.paused, hero: R.state.p.hero, gold: R.state.p.gold, h1: document.querySelector('#screen h1') && document.querySelector('#screen h1').textContent }));
  ok('reload with a dead hero → the world is entered and the heroes screen opens with {afterDeath:true}, the dead hero kept (hp 0), paused', dd.boot === 'heroes' && dd.cur === 'heroes' && dd.arg && dd.arg.afterDeath === true && dd.dead === true && dd.hp === 0 && dd.running && dd.paused && dd.hero === 'oberyn' && dd.gold === 40 && dd.h1 === 'heroes', JSON.stringify(dd));
  await q.tap('#next'); await q.waitForTimeout(300);
  const nx = await q.evaluate(() => ({ cur: R.ui.cur, hero: R.state.p.hero, name: R.state.p.name, cls: R.state.p.cls, gold: R.state.p.gold, dead: R.player.dead, hp: R.player.hp === R.player.hpMax, paused: R.paused, running: R.running, oberyn: R.state.acc.champs.oberyn, ellaria: R.state.acc.champs.ellaria, ents: R.ents.length }));
  ok('RIDE tap → newHero(ellaria): screen closed, Ellaria Sand the maester alive at L1 with 0 gold, runs counted per champion, one entity', nx.cur === null && nx.hero === 'ellaria' && nx.name === 'Ellaria Sand' && nx.cls === 'maester' && nx.gold === 0 && !nx.dead && nx.hp && !nx.paused && nx.running && nx.oberyn.runs === 1 && nx.ellaria.runs === 1 && nx.ellaria.unlocked === 1 && nx.ents === 1, JSON.stringify(nx));
  await q.reload(); await booted(q);
  const w2 = await q.evaluate(() => ({ boot: R.boot, cur: R.ui.cur, hero: R.state.p.hero, dead: R.player.dead }));
  ok('reload with the living hero → straight into the world', w2.boot === 'world' && w2.cur === null && w2.hero === 'ellaria' && !w2.dead, JSON.stringify(w2));
  await q.context().close();

  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(T, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
