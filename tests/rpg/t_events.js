// t_events (G7): the four world events start and finish in the REAL world of the integrated build (no fakes).
//   A Stark hero on the Kingsroad south of Winterfell, away from every POI: canStart(); horde → 12–18 wights, the banner, kill them all
//   with R.hit → 'horde:done', +gems; caravan → a wagon NPC; INTERACT on it opens the shop (not a dialog), then the event ends;
//   dragon → nearby mobs flee, 'dragon:done' after its time; elite → one named elite, killed with R.hit → 'elite:done'. No page errors.
// Run: RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_events.js
'use strict';
const L = require('./lib');
(async () => {
  L.build();
  const { page, errors, close } = await L.launch();
  const b = await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 6, flags: { 'gate:north': 1 } }), timeout: 90000, wait: 30000 });
  L.ok('booted into the world', b.running && !!b.player, JSON.stringify({ running: b.running, cur: b.cur }));
  const at = await L.ev(page, () => { if (R.ui.cur) R.ui.close(); R.player.hp = R.player.hpMax = 1e7; R.player.def = 1e4;
    R.player.x = 3000; R.player.y = 3150; for (let i = 0; i < 30; i++) R.step(); window.__ev = []; R.bus.on('event', (id, st) => __ev.push(id + ':' + st));
    return { x: Math.round(R.player.x), y: Math.round(R.player.y), can: R.events.canStart(), inPoi: R.events.inPoi(R.player.x, R.player.y), region: (R.world.regionAt(R.player.x, R.player.y) || {}).id }; });
  L.ok('the hero stands on the Kingsroad in the North, outside every POI; an event may start', at.region === 'north' && !at.inPoi && at.can, JSON.stringify(at));
  const killAll = () => L.ev(page, () => { let n = 0; for (const m of R.events.mobs()) if (!m.dead) { R.hit(R.player, m, 1e7, { kind: 'phys' }); if (!m.dead && R.kill) R.kill(m, R.player); n++; } for (let i = 0; i < 10; i++) R.step(); return n; });
  // 1. the horde
  const H = await L.ev(page, () => { const g0 = R.state.p.gems || 0; const ev = R.events.start('horde'); for (let i = 0; i < 6; i++) R.step(); const ms = R.events.mobs(), bar = document.getElementById('evbar');
    return { id: ev && ev.id, n: ms.length, g0, types: [...new Set(ms.map(m => m.type))], mobsKnown: ms.every(m => !!R.data.mobs[m.type]), bar: bar && bar.classList.contains('on'), t: bar && bar.querySelector('.evbar-t').textContent,
      minD: Math.round(Math.min(...ms.map(m => Math.hypot(m.x - R.player.x, m.y - R.player.y)))) }; });
  L.ok('horde: 12–18 real mobs spawn away from the hero, the banner is up', H.id === 'horde' && H.n >= 12 && H.n <= 18 && H.mobsKnown && H.bar && /horde/i.test(H.t || '') && H.minD >= 150, JSON.stringify(H));
  await L.shot(page, 'events_horde');
  await killAll();
  const H2 = await L.ev(page, () => ({ ev: __ev.slice(), active: !!R.events.active, gems: R.state.p.gems || 0, bar: (document.querySelector('#evbar .evbar-t') || {}).textContent }));
  L.ok('horde: all killed → done, gems paid, the banner says so', H2.ev.includes('horde:done') && !H2.active && H2.gems > H.g0, JSON.stringify(H2));
  // 2. the caravan: its wagon answers INTERACT with the shop
  const C = await L.ev(page, () => { const ev = R.events.start('caravan'); for (let i = 0; i < 6; i++) R.step(); const w = ev && ev.npc;
    if (w) { R.player.x = w.x + 20; R.player.y = w.y; for (let i = 0; i < 12; i++) R.step(); }
    const I = R.input.interact; return { id: ev && ev.id, wagon: !!w, near: !!(I && I.e === w), stock: ev && ev.poi && ev.poi.stock.length }; });
  L.ok('caravan: a wagon on the road with goods, INTERACT offered next to it', C.id === 'caravan' && C.wagon && C.near && C.stock > 0, JSON.stringify(C));
  if (C.near) { await L.tap(page, '#b-interact'); await L.steps(page, 2); await L.waitFor(page, () => R.ui.cur != null, 3000); }
  const C2 = await L.ev(page, () => ({ cur: R.ui.cur }));
  L.ok('caravan: a tap on INTERACT opens the shop, not a dialog', C2.cur === 'shop', JSON.stringify(C2));
  await L.shot(page, 'events_caravan_shop');
  const C3 = await L.ev(page, () => { if (R.ui.cur) R.ui.close(); R.events.stop('done'); for (let i = 0; i < 6; i++) R.step(); return { ev: __ev.slice(-2), active: !!R.events.active, wagon: R.ents.some(e => e.dialog === 'caravan' && !e.dead) }; });
  L.ok('caravan: ends cleanly, the wagon leaves', C3.ev.includes('caravan:done') && !C3.active && !C3.wagon, JSON.stringify(C3));
  // 3. the dragon shadow
  const D = await L.ev(page, () => { const near = []; for (let i = 0; i < 3; i++) near.push(R.mobs.spawn('axe', 6, R.player.x + 140 + i * 20, R.player.y + 40));
    const ev = R.events.start('dragon'); for (let i = 0; i < 30; i++) R.step(); const fled = near.filter(m => !m.dead && (m.flee > R.t || (m.ai && m.ai.state === 'flee'))).length;
    for (let i = 0; i < 60 * 12 && R.events.active; i++) R.step(); for (const m of near) { m.dead = true; R.remove && R.remove(m); } return { id: ev && ev.id, fled, ev: __ev.slice(-2), active: !!R.events.active }; });
  L.ok('dragon: the nearby mobs flee, the shadow passes → done', D.id === 'dragon' && D.fled >= 1 && D.ev.includes('dragon:done') && !D.active, JSON.stringify(D));
  // 4. the elite
  const E = await L.ev(page, () => { const ev = R.events.start('elite'); for (let i = 0; i < 6; i++) R.step(); const m = ev && ev.mob; return { id: ev && ev.id, name: m && m.name, elite: !!(m && m.elite), hp: m && m.hpMax, known: !!(m && R.data.mobs[m.type]) }; });
  L.ok('elite: one named elite of a real mob type', E.id === 'elite' && E.elite && !!E.name && E.known, JSON.stringify(E));
  await killAll();
  const E2 = await L.ev(page, () => ({ ev: __ev.slice(-2), active: !!R.events.active }));
  L.ok('elite: slain → done', E2.ev.includes('elite:done') && !E2.active, JSON.stringify(E2));
  const errs = (await L.gameErrors(page)).concat(errors);
  L.ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await close(); L.report();
})().catch(e => { console.error('FAIL crash', e); process.exit(1); });
