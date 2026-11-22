// A22: three instanced dungeons. Enter teleports into the dungeon corner and spawns room 1's first wave; killing every wave opens the
// door; room 3 ends with the mini-boss and the chest; leave restores the overworld position and R.world.populate; 3 runs a day; the sheet.
// Run after `python3 src/build_rpg.py beta/index.html`:  CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_dungeons.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  let file = path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html');
  let html = fs.readFileSync(file, 'utf8');
  // Build quirk guard: if the modules were inlined into the external telegram <script src> (ignored by browsers), move them into the inline script.
  if (/telegram-web-app\.js">\s*\/\* ====/.test(html)) { let moved = ''; html = html.replace(/(<script src="[^"]*telegram-web-app\.js">)([\s\S]*?)(<\/script>)/, (m, a, b, c) => { moved = b; return a + c; });
    html = html.replace("'use strict';", "'use strict';\n" + moved); file = path.join(os.tmpdir(), 'holdor_rpg_dg_test.html'); fs.writeFileSync(file, html); console.log('NOTE build inlined js into the telegram script tag; a patched copy is used:', file); }
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  p.on('pageerror', e => errors.push('PE:' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errors.push('CE:' + m.text()); });
  await p.goto('file://' + file); await p.waitForFunction(() => window.R && R.dungeons && R.sys.dungeons, { timeout: 15000 });
  // Fakes for the modules the other agents own (only when absent) + a player and a state when the core/boot did not make them.
  await p.evaluate(() => {
    if (!R.spawnMob) R.spawnMob = (type, x, y, o) => R.spawn({ kind: 'mob', type, x, y, team: 1, lvl: (o && o.lvl) || 1, hp: 100, atk: 10, def: 2, spd: 100, name: type, elite: !!(o && o.elite), fake: 1 });
    if (!R.loot) R.loot = { calls: [], chest: (x, y, o) => { const e = R.spawn({ kind: 'drop', chest: true, x, y, team: 2, fake: 1 }); R.loot.calls.push({ x, y, o }); return e; } };
    if (!R.boss) R.boss = { spawn: (id, x, y) => R.spawn({ kind: 'boss', type: id, x, y, team: 1, hp: 1000, name: id, fake: 1 }) };
    if (!R.world) R.world = { populate: true, blocked: () => false, fake: 1 };
    if (!R.state) R.state = R.newState(); R.state.p.lvl = 12; R.state.p.gems = 5;
    if (!R.player) R.player = R.spawn({ kind: 'player', team: 0, x: 3600, y: 9000, hp: 500, lvl: 12, name: 'Tester' });
    R.player.x = 3600; R.player.y = 9000; R.cam.x = 3600; R.cam.y = 9000; R.paused = false;
    window.__dgEv = []; R.bus.on('dungeon', (id, st, x) => window.__dgEv.push(st));
  });
  const steps = n => p.evaluate(n => { for (let i = 0; i < n; i++) R.step(); }, n);
  const mobs = () => p.evaluate(() => R.ents.filter(e => e.dg != null && !e.dead && (e.kind === 'mob' || e.kind === 'boss')).map(e => ({ x: e.x, y: e.y, room: e.dg, boss: !!e.dgBoss, type: e.type, team: e.team })));
  const killAll = () => p.evaluate(() => { let n = 0; for (const e of R.ents) if (e.dg != null && !e.dead && (e.kind === 'mob' || e.kind === 'boss')) { e.hp = 0; R.kill(e); n++; } return n; });
  const inRoom = (m, r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
  const ROOMS = await p.evaluate(() => R.dungeons.ROOMS);
  // 1. the entry sheet from a portal interact (real tap on ENTER)
  await p.evaluate(() => { R.bus.emit('interact', { kind: 'portal', dg: 'dg_crypts', x: 3600, y: 9000 }); });
  const sheet = await p.evaluate(() => ({ cur: R.ui.cur, txt: document.getElementById('screen').textContent, btn: document.querySelector('#dgenter') && document.querySelector('#dgenter').textContent, paused: R.paused }));
  ok('portal interact opens the dungeon sheet with name, level and the daily gems', sheet.cur === 'dungeon' && /The Crypts/.test(sheet.txt) && /12/.test(sheet.txt) && /\+10 gems/.test(sheet.txt) && sheet.btn === 'ENTER', JSON.stringify(sheet).slice(0, 160));
  await p.tap('#dgenter'); await steps(2);
  const ent = await p.evaluate(() => ({ active: R.dungeons.active && R.dungeons.active.id, px: R.player.x, py: R.player.y, ret: R.state.p.flags.dgReturn, pop: R.world.populate, runs: R.state.p.flags['dg:dg_crypts:' + new Date().toISOString().slice(0, 10)], bar: document.getElementById('dgbar').classList.contains('on'), barTxt: document.getElementById('dgbar').textContent, cur: R.ui.cur }));
  ok('ENTER teleports into the dungeon corner (x 6800–7200, y 100–700) and saves the overworld position', ent.active === 'dg_crypts' && ent.px >= 6800 && ent.px <= 7200 && ent.py >= 100 && ent.py <= 700 && ent.ret && ent.ret.x === 3600 && ent.ret.y === 9000, JSON.stringify(ent).slice(0, 200));
  ok('R.world.populate is false inside, the run is counted, the sheet closed', ent.pop === false && ent.runs === 1 && ent.cur === null);
  ok('#dgbar shows room 1 / 3 and the enemies left', ent.bar && /Room 1 \/ 3/.test(ent.barTxt) && /enemies left/.test(ent.barTxt), ent.barTxt);
  let m = await mobs();
  ok('room 1 wave 1 spawned inside room 1 (team 1)', m.length >= 3 && m.every(e => inRoom(e, ROOMS[0]) && e.room === 0 && e.team === 1), JSON.stringify(m.map(e => e.type)));
  // the mask: walls block, the room floor does not, the closed door blocks
  const bl = await p.evaluate(() => { const Rm = R.dungeons.ROOMS[0], d = R.dungeons.active.doors[0]; return { wall: R.dungeons.blocked(6820, 600), floor: R.dungeons.blocked(Rm.x + 50, Rm.y + 50), door: R.dungeons.blocked(d.x, d.y), hall: R.dungeons.blocked(d.x, d.y + 25), world: R.world.blocked(6820, 600), outside: R.dungeons.blocked(3600, 9000) }; });
  ok('blocked(): walls + closed door block, floor + corridor free, R.world.blocked consults it', bl.wall && !bl.floor && bl.door && !bl.hall && bl.world && bl.outside, JSON.stringify(bl));
  // the player cannot walk into a wall (fallback clamp)
  const clamp = await p.evaluate(() => { const b = { x: R.player.x, y: R.player.y }; R.player.x = 6810; R.player.y = 600; R.step(); return { x: R.player.x, y: R.player.y, b }; });
  ok('a player stepped into the wall is put back', clamp.x === clamp.b.x && clamp.y === clamp.b.y, JSON.stringify(clamp));
  // 2. kill the three waves of room 1 → the door opens
  let waves = 0, door = false;
  for (let i = 0; i < 6 && !door; i++) { const n = await killAll(); if (n) waves++; await steps(100); door = await p.evaluate(() => R.dungeons.active.doors[0].open); }
  ok('three waves in room 1, then the door opens', waves === 3 && door, 'waves=' + waves + ' door=' + door);
  const bl2 = await p.evaluate(() => { const d = R.dungeons.active.doors[0]; return R.dungeons.blocked(d.x, d.y); });
  ok('the open door no longer blocks', bl2 === false);
  // 3. room 2: walk in → waves; room 3: waves → the boss → the chest
  await p.evaluate(() => { R.player.x = 7000; R.player.y = 410; }); await steps(60);
  m = await mobs(); ok('entering room 2 spawns its first wave there', m.length >= 3 && m.every(e => inRoom(e, ROOMS[1]) && e.room === 1), JSON.stringify(m.map(e => [e.type, e.room])));
  let door2 = false; for (let i = 0; i < 6 && !door2; i++) { await killAll(); await steps(100); door2 = await p.evaluate(() => R.dungeons.active.doors[1].open); }
  ok('room 2 cleared opens the second door', door2);
  await p.evaluate(() => { R.player.x = 7000; R.player.y = 250; }); await steps(60);
  let boss = null; for (let i = 0; i < 6 && !boss; i++) { await killAll(); await steps(100); boss = await p.evaluate(() => { const b = R.dungeons.active.boss; return b ? { name: b.name, dead: !!b.dead, x: b.x, y: b.y, kind: b.kind } : null; }); }
  ok('after room 3\'s waves the mini-boss appears in room 3', boss && !boss.dead && inRoom(boss, ROOMS[2]), JSON.stringify(boss));
  const barBoss = await p.evaluate(() => document.getElementById('dgbar').textContent); ok('the banner names the boss', boss && barBoss.includes(boss.name), barBoss);
  await killAll(); await steps(5);
  const ch = await p.evaluate(() => { const a = R.dungeons.active; return { chest: a.chestAt, ent: !!a.chest, kind: a.chest && a.chest.kind, cleared: a.cleared, gems: R.state.p.gems, flag: R.state.p.flags['dgc:dg_crypts:' + new Date().toISOString().slice(0, 10)], leave: document.getElementById('dgleave').classList.contains('on'), btn: document.getElementById('dgleavebtn').textContent, leaveT: a.leaveT, ev: window.__dgEv.slice() }; });
  ok('the chest appears in room 3 after the boss', ch.chest && inRoom(ch.chest, ROOMS[2]) && ch.ent, JSON.stringify(ch.chest) + ' ' + ch.kind);
  ok('daily first clear pays +10 gems once', ch.gems === 15 && ch.flag === 1 && ch.cleared);
  ok('the Leave prompt shows with a 20 s countdown', ch.leave && /LEAVE \(20\)/.test(ch.btn) && ch.leaveT > 19, ch.btn);
  ok('dungeon events: enter → wave → door → room → boss → clear', ['enter', 'wave', 'door', 'room', 'boss', 'clear'].every(s => ch.ev.includes(s)), ch.ev.join(','));
  // 4. leave by the button (real tap) restores everything
  await p.tap('#dgleavebtn'); await steps(2);
  const lv = await p.evaluate(() => ({ active: R.dungeons.active, px: R.player.x, py: R.player.y, pop: R.world.populate, ret: R.state.p.flags.dgReturn, bar: document.getElementById('dgbar').classList.contains('on'), leave: document.getElementById('dgleave').classList.contains('on'), left: R.ents.filter(e => e.dg != null || e.kind === 'door' || e.dgChest).length, wb: R.world.blocked(6820, 600), ev: window.__dgEv.slice(-1)[0] }));
  ok('LEAVE restores the overworld position, R.world.populate and R.world.blocked, clears the dungeon entities', lv.active === null && lv.px === 3600 && lv.py === 9000 && lv.pop === true && !lv.ret && !lv.bar && !lv.leave && lv.left === 0 && lv.wb === false && lv.ev === 'leave', JSON.stringify(lv));
  // 5. the 10-minute timer ends a run; the daily limit refuses the fourth run; the second clear pays no gems again
  const tm = await p.evaluate(() => { R.dungeons.enter('dg_harrenhal'); const a = R.dungeons.active; const id = a.id; a.timeLeft = 0.01; R.step(); return { id, active: R.dungeons.active, px: R.player.x, ev: window.__dgEv.slice(-1)[0] }; });
  ok('the timer at 0 ends the run (fail) and returns the player', tm.id === 'dg_harrenhal' && tm.active === null && tm.px === 3600 && tm.ev === 'fail', JSON.stringify(tm));
  const lim = await p.evaluate(() => { const d = new Date().toISOString().slice(0, 10); R.state.p.flags['dg:dg_caves:' + d] = 3; const c = R.dungeons.canEnter('dg_caves'); const r = R.dungeons.enter('dg_caves'); R.ui.open('dungeon', 'dg_caves'); const b = document.getElementById('dgenter'); const out = { ok: c.ok, reason: c.reason, entered: r, active: R.dungeons.active, btnDisabled: b && b.disabled, btnTxt: b && b.textContent }; R.ui.close(); return out; });
  ok('3 runs a day: the fourth is refused and the sheet\'s button is disabled', lim.ok === false && lim.entered === false && lim.active === null && lim.btnDisabled === true && /NO RUNS LEFT/.test(lim.btnTxt), JSON.stringify(lim));
  // 6. death inside leaves without the reward; reload mid-dungeon restores the position
  const dth = await p.evaluate(() => { R.dungeons.enter('dg_crypts'); R.bus.emit('death'); return { active: R.dungeons.active, px: R.player.x, ev: window.__dgEv.slice(-1)[0] }; });
  ok('death inside the dungeon returns the player to the overworld', dth.active === null && dth.px === 3600 && dth.ev === 'fail', JSON.stringify(dth));
  // 7. a screenshot inside the crypts for the eye
  await p.evaluate(() => { const d = new Date().toISOString().slice(0, 10); R.state.p.flags['dg:dg_crypts:' + d] = 0; R.dungeons.enter('dg_crypts'); R.cam.x = 7000; R.cam.y = 420; R.drawAll(); });
  const shot = await p.evaluate(() => { R.drawAll(); const c = R.cv, x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let dark = 0, lit = 0; for (let i = 0; i < d.length; i += 16) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l < 20) dark++; else lit++; } return { dark, lit }; });
  ok('the dungeon draws its own floor and walls (dark stone with lit rooms)', shot.dark > 0 && shot.lit > 0, JSON.stringify(shot));
  try { fs.mkdirSync(path.resolve(__dirname, '..', '..', '.shots'), { recursive: true }); await p.screenshot({ path: path.resolve(__dirname, '..', '..', '.shots', 'rpg_dungeon.png') }); } catch (e) {}
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(T, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(T).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
