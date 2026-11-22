// tests/rpg/t_smoke.js — the integration smoke the integrator runs after every merge (A40).
// Asserts the core (R, R.step, R.spawn, R.save/load, R.ui, R.bus); every module check is conditional on the module's presence
// (SKIP when R.screens.x / R.sys.x / R.x is absent) and fails only on real errors: a present module that does not do its job,
// a pageerror, R.errors, the #err overlay, a thrown error logged by a system.
//   node tests/rpg/t_smoke.js            (builds first; RPG_NOBUILD=1 skips the build, RPG_HTML=path tests another file)
// Screenshots: .shots/rpg/smoke_*.png
'use strict';
const path = require('path');
const L = require('./lib');
const { ok, skip, has } = L;

(async () => {
  L.build();
  const { page, errors, cerrs, close } = await L.launch();
  const E = (fn, arg) => page.evaluate(fn, arg);

  /* ---- 1. fresh boot: no save ---- */
  let b;
  try { b = await L.boot(page); } catch (e) { ok('boot: window.R appears', false, e.message); await close(); return L.report(); }
  const core = await E(() => ({ v: R.VERSION, step: typeof R.step, spawn: typeof R.spawn, save: typeof R.save, load: typeof R.load, kill: typeof R.kill, near: typeof R.near,
    ui: !!(R.ui && typeof R.ui.open === 'function' && typeof R.ui.close === 'function' && typeof R.ui.toast === 'function'), bus: !!(R.bus && R.bus.on && R.bus.emit && R.bus.off), ents: Array.isArray(R.ents), data: !!R.data, sys: !!R.sys, screens: !!R.screens }));
  ok('core: R.VERSION, R.step, R.spawn, R.kill, R.near, R.save/load, R.ui, R.bus, R.ents, R.data/sys/screens', !!core.v && core.step === 'function' && core.spawn === 'function' && core.save === 'function' && core.load === 'function' && core.kill === 'function' && core.near === 'function' && core.ui && core.bus && core.ents && core.data && core.sys && core.screens, JSON.stringify(core));
  console.log(`  info version ${b.version}; screens [${b.screens.join(' ')}]; sys [${b.sys.join(' ')}]; data [${b.data.join(' ')}]`);
  if (b.screens.includes('intro')) ok('fresh boot: the intro is open (or the game runs with a default save)', b.cur === 'intro' || b.running, `cur=${b.cur} running=${b.running}`);
  else if (b.running) ok('fresh boot: the game runs with a default save (no intro module)', true, `cur=${b.cur}`);
  else skip('fresh boot: the intro is open', 'no R.screens.intro and nothing started the game (52_intro / 90_main absent)');
  const sp = await E(() => { try { const e = R.spawn({ kind: 'mob', type: 'axe', x: 100, y: 100, hp: 5 }); const inEnts = R.ents.includes(e); const id = e.id; R.remove ? R.remove(e) : (R.ents.splice(R.ents.indexOf(e), 1)); return { id, inEnts, hpMax: e.hpMax, team: e.team }; } catch (x) { return { err: x.message }; } });
  ok('core: R.spawn assigns id / hpMax / team and lists the entity', sp.id > 0 && sp.inEnts && sp.hpMax === 5 && sp.team === 1, JSON.stringify(sp));
  await L.shot(page, 'smoke_01_fresh');

  /* ---- 2. boot with a fake save ---- */
  const SAVE = L.fakeSave({ house: 'stark', hero: 'jon', cls: 'knight', lvl: 2, gold: 50 });
  b = await L.boot(page, { save: SAVE });
  let st = await E(() => R.state && R.state.p ? { hero: R.state.p.hero, name: R.state.p.name, lvl: R.state.p.lvl, gold: R.state.p.gold, v: R.state.v, acc: !!R.state.acc } : null);
  if (st) ok('boot with a save: R.state is the injected save (hero jon, level 2)', st.hero === 'jon' && st.lvl === 2, JSON.stringify(st));
  else {
    const loaded = await E(() => { const r = R.load(); return { r, hero: R.state && R.state.p && R.state.p.hero, lvl: R.state && R.state.p && R.state.p.lvl }; });
    ok('R.load reads the injected save (the boot module did not load it)', loaded.r && loaded.hero === 'jon' && loaded.lvl === 2, JSON.stringify(loaded));
  }
  if (b.running) ok('boot with a save: R.running', true, b.cur ? 'a screen is open: ' + b.cur : 'no screen open');
  else if (b.cur === 'intro') ok('boot with a save: R.running', false, 'the intro opened despite a valid save');
  else if (b.cur) ok('boot with a save: R.running (paused under a screen)', true, 'screen ' + b.cur + '; the test closes it');
  else { skip('boot with a save: R.running', 'nothing started the game (90_main absent); the test calls R.start()'); await E(() => { if (typeof R.start === 'function') R.start(); }); }
  await E(() => { if (R.ui.cur && R.ui.cur !== 'intro') R.ui.close(); });
  await L.steps(page, 5);

  const pl = await E(() => R.player ? { kind: R.player.kind, x: Math.round(R.player.x), y: Math.round(R.player.y), hp: R.player.hp, hpMax: R.player.hpMax, inEnts: R.ents.includes(R.player), face: R.player.face, team: R.player.team, lvl: R.player.lvl } : null);
  if (pl) ok('a player entity exists (kind player, team 0, in R.ents, hp > 0)', pl.kind === 'player' && pl.inEnts && pl.hp > 0 && pl.team === 0, JSON.stringify(pl));
  else skip('a player entity exists', 'R.player is not created (core / 21_player)');

  const hud = await E(() => { const ui = document.getElementById('ui'); const t = ui ? ui.innerText.replace(/\s+/g, ' ').trim() : '';
    return { sys: !!(R.sys.hud), n: ui ? ui.querySelectorAll('*').length : 0, hpEl: !!(ui && ui.querySelector('[class*=hp],[id*=hp],[class*=health],[id*=health],[class*=life],[id*=life]')), txt: t.slice(0, 80) }; });
  if (hud.sys || hud.n > 0) ok('HUD elements exist (#ui has children' + (hud.hpEl ? ', an hp element' : '') + ')', hud.n > 0, JSON.stringify(hud));
  else skip('HUD elements exist', 'no R.sys.hud and #ui is empty (50_hud absent)');
  await L.shot(page, 'smoke_02_game');

  /* ---- 3. joystick ---- */
  if (!pl) skip('joystick drag moves the player (> 60 units in 60 steps)', 'no player');
  else if (!(await has(page, 'R.input'))) skip('joystick drag moves the player (> 60 units in 60 steps)', 'no R.input (02_input absent)');
  else {
    const mover = await has(page, 'R.sys.player || R.sys.move || R.sys.movement || R.sys.hero');
    const dirs = [[90, 0], [-90, 0], [0, 90], [0, -90]]; let moved = null, lastMv = null; const tried = [];
    for (const [dx, dy] of dirs) {
      const p0 = await E(() => ({ x: R.player.x, y: R.player.y }));
      const rel = await L.joystick(page, dx, dy, 240);
      const mv = await E(() => R.input && R.input.move ? { x: +(+R.input.move.x || 0).toFixed(2), y: +(+R.input.move.y || 0).toFixed(2) } : null);
      await L.steps(page, 60);
      const p1 = await E(() => ({ x: R.player.x, y: R.player.y }));
      await rel(); await L.steps(page, 5);
      const d = { dx: Math.round(p1.x - p0.x), dy: Math.round(p1.y - p0.y), move: mv }; lastMv = mv;
      tried.push(`drag[${dx},${dy}]→${JSON.stringify(d)}`);
      const along = dx ? d.dx * Math.sign(dx) : d.dy * Math.sign(dy);
      if (along > 60) { moved = Object.assign({ dir: [dx, dy] }, d); break; }
      if (!mv || (Math.abs(mv.x) < 0.1 && Math.abs(mv.y) < 0.1)) break;   // the joystick did not register at all: other directions will not help
    }
    const registered = lastMv && (Math.abs(lastMv.x) >= 0.1 || Math.abs(lastMv.y) >= 0.1);
    if (moved) ok('joystick drag moves the player (> 60 units in 60 steps)', true, JSON.stringify(moved));
    else if (registered && !mover) skip('joystick drag moves the player (> 60 units in 60 steps)', 'R.input.move is set by the drag but no R.sys.player moves the player yet; ' + tried.join(' '));
    else ok('joystick drag moves the player (> 60 units in 60 steps)', false, (registered ? 'R.input.move set, player did not move: ' : 'the drag did not set R.input.move: ') + tried.join(' '));
  }
  await L.shot(page, 'smoke_03_moved');

  /* ---- 4. combat: a mob 40 units ahead, ATTACK, kill, xp ---- */
  let mobAlive = false;
  if (!pl) { skip('ATTACK reduces the mob hp', 'no player'); skip('killing the mob raises xp', 'no player'); }
  else {
    const canHit = await has(page, 'typeof R.hit === "function"');
    const mob = await E(() => {
      const P = R.player, x = P.x + 40 * (P.face || 1), y = P.y; let m = null, how = '';
      const type = R.data.mobs ? (R.data.mobs.axe ? 'axe' : Object.keys(R.data.mobs)[0]) : 'axe';
      if (typeof R.spawnMob === 'function') { try { m = R.spawnMob(type, x, y, P.lvl || 1); how = 'R.spawnMob(' + type + ')'; } catch (e) { how = 'R.spawnMob threw ' + e.message; m = null; } }
      if (!m || !(m.hp > 0) || !m.kind) { if (m && m.id && R.remove) R.remove(m); m = R.spawn({ kind: 'mob', type, name: 'Test wight', x, y, hp: 40, hpMax: 40, atk: 2, def: 0, spd: 0, lvl: 1, team: 1, r: 14, ai: {} }); how += (how ? ' → ' : '') + 'bare R.spawn'; }
      m.x = x; m.y = y; if (m.hp > 60) m.hp = 60;   // short fight
      window.__mob = m; return { id: m.id, hp: m.hp, hpMax: m.hpMax, how, type: m.type, team: m.team, dist: Math.round(Math.hypot(m.x - P.x, m.y - P.y)) };
    });
    const atkSel = await L.findBtn(page, 'attack|\\batk\\b|⚔|sword', '#ui');
    const trigger = async () => { if (atkSel) await L.tap(page, atkSel, { wait: 20 }); else { await page.keyboard.down('j'); await L.steps(page, 2); await page.keyboard.up('j'); } };
    const xp0 = await E(() => R.state && R.state.p ? { xp: R.state.p.xp, lvl: R.state.p.lvl } : null);
    let rounds = 0, dead = false, hpMin = mob.hp;
    for (let i = 0; i < 40 && !dead; i++) {
      rounds++; await trigger(); await L.steps(page, 20);
      const s = await E(() => { const m = window.__mob; return { hp: m.hp, dead: !!m.dead || m.hp <= 0 || !R.ents.includes(m) }; });
      hpMin = Math.min(hpMin, s.hp); dead = s.dead;
      if (i === 15 && !dead && hpMin < mob.hp) await E(() => { window.__mob.hp = Math.min(window.__mob.hp, 3); });   // the hits land: shorten the kill
    }
    const hurt = hpMin < mob.hp, via = atkSel ? 'the ATTACK button' : 'key J';
    if (hurt) ok('ATTACK reduces the mob hp', true, `${mob.how} at ${mob.dist} u; hp ${mob.hp}→${hpMin} in ${rounds} rounds via ${via}`);
    else if (!canHit || !(await has(page, 'R.sys.player || R.sys.combat'))) skip('ATTACK reduces the mob hp', `no R.hit / R.sys.player / R.sys.combat yet (${mob.how})`);
    else ok('ATTACK reduces the mob hp', false, `mob hp stayed ${mob.hp} after ${rounds} rounds via ${via} (R.hit present; ${mob.how} at ${mob.dist} u)`);
    if (canHit && !dead) {
      const h = await E(() => { const m = window.__mob, h0 = m.hp; try { R.hit(R.player, m, 50, { kind: 'phys' }); } catch (e) { return 'threw ' + e.message; } return m.hp < h0 ? 'ok ' + h0 + '→' + m.hp : 'no change ' + h0 + '→' + m.hp; });
      ok('R.hit(player, mob, 50) lowers the mob hp', /^ok/.test(h), h);
      await L.steps(page, 30); dead = await E(() => !!window.__mob.dead || window.__mob.hp <= 0 || !R.ents.includes(window.__mob));
    }
    mobAlive = !dead;
    const after = await E(() => ({ dead: !!window.__mob.dead || window.__mob.hp <= 0 || !R.ents.includes(window.__mob), xp: R.state && R.state.p ? R.state.p.xp : null, lvl: R.state && R.state.p ? R.state.p.lvl : null }));
    if (!after.dead) { if (hurt) ok('the mob dies', false, 'hurt but alive after the rounds: hp ' + hpMin); else skip('killing the mob raises xp', 'the mob was never hurt'); }
    else if (!xp0) skip('killing the mob raises xp', 'no R.state.p');
    else if (after.xp > xp0.xp || after.lvl > xp0.lvl) ok('killing the mob raises xp', true, `xp ${xp0.xp}→${after.xp}, lvl ${xp0.lvl}→${after.lvl}`);
    else if (!(await has(page, 'R.sys.player'))) skip('killing the mob raises xp', 'the mob died but no R.sys.player grants xp yet');
    else ok('killing the mob raises xp', false, `the mob died, xp ${xp0.xp}→${after.xp}, lvl ${xp0.lvl}→${after.lvl}`);
  }
  await L.shot(page, 'smoke_04_fight');

  /* ---- 5. save + reload keeps the level ---- */
  const sv = await E(() => { if (!R.state || !R.state.p) return null; R.state.p.gold = (R.state.p.gold | 0) + 123; R.save(true); let ls = null; try { ls = JSON.parse(localStorage.getItem('holdor_rpg')); } catch (e) {}
    return { lvl: R.state.p.lvl, gold: R.state.p.gold, hero: R.state.p.hero, pos: R.state.p.pos, lsLvl: ls && ls.p && ls.p.lvl, lsGold: ls && ls.p && ls.p.gold, lsV: ls && ls.v }; });
  if (!sv) skip('R.save(true) writes localStorage holdor_rpg', 'no R.state');
  else ok('R.save(true) writes localStorage holdor_rpg', sv.lsLvl === sv.lvl && sv.lsGold === sv.gold, JSON.stringify(sv));
  b = await L.boot(page);   // the same URL again; the injected save is not re-applied (once per boot call)
  const re = await E(() => { if (!R.state) R.load(); return R.state && R.state.p ? { lvl: R.state.p.lvl, gold: R.state.p.gold, hero: R.state.p.hero, running: R.running, cur: R.ui.cur } : { running: R.running, cur: R.ui.cur }; });
  if (sv) ok('reload keeps the level (and the hero, the gold)', re.lvl === sv.lvl && re.hero === sv.hero && re.gold === sv.gold, JSON.stringify(re));
  if (!b.running && !b.cur) await E(() => { if (typeof R.start === 'function') R.start(); });
  await E(() => { if (R.ui.cur && R.ui.cur !== 'intro') R.ui.close(); });
  await L.shot(page, 'smoke_05_reload');

  /* ---- 6. screens: map / bag / menu / chat open from their buttons and close ---- */
  const SCREENS = [['map', ['map'], 'map(?!.*mini)|world'], ['bag', ['inventory', 'bag', 'inv', 'items', 'character'], 'bag|invent|items|backpack|character'], ['menu', ['menu', 'settings', 'pause', 'options'], 'menu|settings|pause|options|☰|⚙'], ['chat', ['chat'], 'chat|💬']];
  let shotN = 6;
  for (const [label, names, re] of SCREENS) {
    const name = await E(ns => ns.find(n => R.screens && R.screens[n]) || null, names);
    if (!name) { skip(`${label} screen opens and closes`, `no R.screens.${names.join('/')}`); continue; }
    await E(() => { if (R.ui.cur) R.ui.close(); });
    const sel = await L.findBtn(page, re, '#ui'); let via = 'its button';
    if (sel) await L.tap(page, sel);
    const cur1 = await E(() => R.ui.cur);
    if (cur1 !== name) { via = sel ? `R.ui.open (the HUD button opened ${cur1 || 'nothing'})` : 'R.ui.open (no HUD button found)'; await E(n => R.ui.open(n), name); await page.waitForTimeout(150); }
    const o = await E(() => { const el = document.getElementById('screen'); const t = el ? el.innerText.replace(/\s+/g, ' ').trim() : ''; return { cur: R.ui.cur, on: !!el && el.classList.contains('on'), len: t.length, txt: t.slice(0, 120), paused: !!R.paused }; });
    ok(`${label} screen opens (R.screens.${name}) via ${via}`, o.cur === name && o.on && o.len > 0, JSON.stringify(o));
    if (label === 'chat') ok('chat screen shows text for a guest', o.len > 0, o.txt);
    await L.shot(page, `smoke_0${shotN++}_${label}`);
    const csel = await L.findBtn(page, 'close|back|✕|×|✖|←|done|dismiss|resume|^x$', '#screen'); let cvia = 'its close button';
    if (csel) await L.tap(page, csel);
    let c = await E(() => ({ cur: R.ui.cur, on: document.getElementById('screen').classList.contains('on') }));
    if (c.cur) { cvia = csel ? 'R.ui.close (the close button did not close it)' : 'R.ui.close (no close button found)'; await E(() => R.ui.close()); c = await E(() => ({ cur: R.ui.cur, on: document.getElementById('screen').classList.contains('on') })); }
    ok(`${label} screen closes via ${cvia}`, !c.cur && !c.on, JSON.stringify(c));
  }

  /* ---- 7. permadeath: the hero dies → death screen + a Hall entry; the next hero is fresh and the game runs ---- */
  // the world may have killed the hero already (mobs at the seat while the screens were tested): that is a real death — take the next life first
  const early = await E(() => R.player && R.player.dead ? { killer: R.player.killer || (R.player.lastHitBy && (R.player.lastHitBy.name || R.player.lastHitBy.type)) || null, cur: R.ui.cur, hall: R.state.acc.hall.length } : null);
  if (early) { console.log('  info the hero died in the world before section 7: ' + JSON.stringify(early) + ' — a new life first');
    ok('a hero killed by the world gets the death screen or the heroes screen (never a dead hero with nothing open)', early.cur === 'death' || early.cur === 'heroes' || early.cur === null && await L.waitFor(page, 'R.ui.cur === "death" || R.ui.cur === "heroes"', 2500), JSON.stringify(early));
    await E(() => { if (R.ui.cur) R.ui.close(); if (typeof R.newHero === 'function') R.newHero(R.state.p.hero); }); await L.steps(page, 5); }
  const plNow = await has(page, 'R.player && !R.player.dead');
  if (!plNow) { skip('the hero\'s death opens the death screen and writes the Hall', 'no living player'); skip('the next hero is a fresh level-1 hero and the game runs', 'no living player'); }
  else {
    const hall0 = await E(() => R.state && R.state.acc && Array.isArray(R.state.acc.hall) ? R.state.acc.hall.length : null);
    const hasDeath = await has(page, 'R.screens.death'), hasPlayerSys = await has(page, 'R.sys.player');
    const died = await E(() => {
      const P = R.player; let killer = R.ents.find(e => e !== P && !e.dead && (e.kind === 'mob' || e.kind === 'boss'));
      if (!killer) killer = R.spawn({ kind: 'mob', type: 'walker', name: 'Test walker', x: P.x + 30, y: P.y, hp: 10, hpMax: 10, atk: 1, def: 0, spd: 0, lvl: 1, team: 1, r: 14, ai: {} });
      let how = 'hp = 0';
      if (typeof R.hit === 'function') { try { R.hit(killer, P, (P.hpMax || 999) * 20, { kind: 'phys' }); how = 'R.hit(mob, player, 20×hpMax)'; } catch (e) { how = 'R.hit threw ' + e.message; } }
      if (P.hp > 0) { P.hp = 0; how += ' then hp = 0'; }
      return { how, killer: killer.name || killer.type };
    });
    await L.steps(page, 120);
    await L.waitFor(page, 'R.ui.cur === "death"', 2500);
    const d = await E(() => ({ cur: R.ui.cur, dead: !!(R.player && R.player.dead), hp: R.player && R.player.hp, hall: R.state && R.state.acc && Array.isArray(R.state.acc.hall) ? R.state.acc.hall.length : null, last: R.state && R.state.acc && R.state.acc.hall && R.state.acc.hall[R.state.acc.hall.length - 1] }));
    const hallGrew = hall0 != null && d.hall === hall0 + 1;
    if (hasDeath) ok('the hero\'s death opens the death screen and writes the Hall of the Fallen', d.cur === 'death' && hallGrew, `${died.how} by ${died.killer}; ${JSON.stringify(d)}`);
    else if (hasPlayerSys) ok('the hero\'s death writes the Hall of the Fallen (no death screen module yet)', hallGrew, `${died.how}; ${JSON.stringify(d)}`);
    else skip('the hero\'s death opens the death screen and writes the Hall', `no R.screens.death and no R.sys.player (${died.how}; ${JSON.stringify(d)})`);
    await L.shot(page, 'smoke_10_death');
    // the next hero: a button on the death screen, else R.newHero('jon')
    let via = 'the death screen';
    if (d.cur === 'death') { const nsel = await L.findBtn(page, 'jon|next|continue|choose|pick|hero|rise|again', '#screen'); if (nsel) await L.tap(page, nsel, { wait: 300 }); else via = 'no button found'; }
    let fresh = await E(() => R.state && R.state.p && R.player && !R.player.dead ? { lvl: R.state.p.lvl, xp: R.state.p.xp, hero: R.state.p.hero, hp: R.player.hp, running: R.running, cur: R.ui.cur } : null);
    if (!fresh || fresh.lvl !== 1 || fresh.cur === 'death') {
      if (await has(page, 'typeof R.newHero === "function"')) { via = (via === 'the death screen' ? 'R.newHero (the death screen button did not do it)' : 'R.newHero'); await E(() => R.newHero('jon')); await L.steps(page, 10); fresh = await E(() => R.state && R.state.p && R.player && !R.player.dead ? { lvl: R.state.p.lvl, xp: R.state.p.xp, hero: R.state.p.hero, hp: R.player.hp, running: R.running, cur: R.ui.cur } : null); }
    }
    if (fresh) ok(`the next hero is a fresh level-1 hero and the game runs (via ${via})`, fresh.lvl === 1 && fresh.xp === 0 && fresh.hp > 0 && fresh.running && fresh.cur !== 'death', JSON.stringify(fresh));
    else if (!hasDeath && !(await has(page, 'typeof R.newHero === "function"'))) skip('the next hero is a fresh level-1 hero and the game runs', 'no R.screens.death and no R.newHero yet');
    else ok('the next hero is a fresh level-1 hero and the game runs', false, `no living player after ${via}: ` + JSON.stringify(await E(() => ({ cur: R.ui.cur, running: R.running, p: !!R.player, dead: R.player && R.player.dead, lvl: R.state && R.state.p && R.state.p.lvl }))));
    await E(() => { if (R.ui.cur && R.ui.cur !== 'intro') R.ui.close(); });
    await L.shot(page, 'smoke_11_newhero');
  }

  /* ---- 8. the camera: R.w2s of the player lands near the screen centre; the WebGL canvas is drawn ---- */
  if (!(await has(page, 'R.player && typeof R.w2s === "function"'))) skip('R.w2s(player) is near the screen centre', 'no player / R.w2s');
  else if (!(await has(page, 'R.render3d || R.sys.render || R.sys.render3d || R.sys.camera || R.sys.cam'))) skip('R.w2s(player) is near the screen centre', 'no renderer / camera system follows the player yet');
  else {
    await L.steps(page, 30);
    const w = await E(() => { const s = R.w2s(R.player.x, R.player.y, 0); return { sx: Math.round(s.x), sy: Math.round(s.y), cx: Math.round(R.vw / 2), cy: Math.round(R.vh / 2), vw: R.vw, vh: R.vh }; });
    ok('R.w2s(player) is near the screen centre (within 30% of the viewport)', Math.abs(w.sx - w.cx) < w.vw * 0.3 && Math.abs(w.sy - w.cy) < w.vh * 0.3, JSON.stringify(w));
  }
  if (!(await has(page, 'R.render3d'))) skip('the WebGL canvas #gl is drawn (non-blank)', 'R.render3d absent');
  else {
    const renderExpr = await E(() => ['render', 'draw', 'frame'].find(k => typeof R.render3d[k] === 'function') ? 'R.render3d.' + ['render', 'draw', 'frame'].find(k => typeof R.render3d[k] === 'function') + '()' : 'R.drawAll && R.drawAll()');
    const px = await L.canvasPixels(page, '#gl', renderExpr);
    ok('the WebGL canvas #gl is drawn (non-blank, more than one colour)', px.ok && px.nonBlank > 0.05 && px.distinct > 1, JSON.stringify(px) + ' after ' + renderExpr);
  }

  /* ---- 9. frame cost ---- */
  // the budget tests a regression, not the machine: 1500 ms on a normal one, scaled by a measured baseline when the machine is slow (software GL under load).
  // The baseline = an empty-scene frame on this machine: a WebGL canvas the size of #gl cleared + one full-screen fill (no game code), plus a fixed JS loop;
  // the game's 300 frames may cost at most FRAME_K baseline frames each.
  // (measured before and after the game's frames, the larger one counts: the load on a shared machine moves while the test runs)
  const FRAME_K = 25;
  const emptyFrame = () => E(() => { const g0 = document.getElementById('gl'), cv = document.createElement('canvas'); cv.width = (g0 && g0.width) || 585; cv.height = (g0 && g0.height) || 1266;
    const gl = cv.getContext('webgl'), px = new Uint8Array(4); let prog = null;
    if (gl) { const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }; prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}')); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform float t;void main(){gl_FragColor=vec4(fract(gl_FragCoord.xy*.01+t),.5,1.);}'));
      gl.linkProgram(prog); gl.useProgram(prog); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); }
    const frame = i => { let x = 0; for (let k = 0; k < 20000; k++) x += Math.sqrt(k + i); if (gl) { gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(gl.getUniformLocation(prog, 't'), i * .01); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return x; };
    frame(0); const t0 = performance.now(); for (let i = 1; i <= 30; i++) frame(i); const ms = (performance.now() - t0) / 30;
    try { const ext = gl && gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); } catch (e) {} return +ms.toFixed(3); });
  const base0 = await emptyFrame();
  const cost = await E(() => { const t0 = performance.now(); for (let i = 0; i < 300; i++) { R.step(); if (typeof R.drawAll === 'function') R.drawAll(); } return Math.round(performance.now() - t0); });
  const base = Math.max(base0, await emptyFrame());
  const budget = Math.max(1500, Math.round(300 * base * FRAME_K));
  ok('frame cost: 300 steps + draws within the budget (1500 ms, or ' + FRAME_K + ' × an empty-scene frame on a slow machine)', cost < budget, cost + ' ms, budget ' + budget + ' ms, empty frame ' + base + ' ms (before ' + base0 + ')');
  await L.shot(page, 'smoke_12_end');

  /* ---- 10. errors ---- */
  const gerr = await L.gameErrors(page), real = L.realConsole(cerrs);
  ok('no pageerror', errors.length === 0, errors.slice(0, 5).join(' | '));
  ok('no R.errors and no #err overlay', gerr.length === 0, gerr.slice(0, 5).join(' | '));
  ok('no thrown error logged by a system (console.error with a TypeError / ReferenceError …)', real.length === 0, real.slice(0, 3).map(s => s.replace(/\s+/g, ' ').slice(0, 200)).join(' | '));
  if (cerrs.length && !real.length) console.log(`  info ${cerrs.length} console error line(s), none a thrown error (network / resource noise)`);
  await close();
  L.report();
})().catch(async e => { console.log('  FAIL smoke crashed  — ' + (e && e.stack || e)); console.log(path.basename(__filename, '.js') + ': crashed'); console.log('FAILED 1'); process.exit(1); });
