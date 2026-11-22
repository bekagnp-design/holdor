// A23 world events: the wight horde (march, kill-all → chest + gems, timeout → raided castle), the merchant caravan (npc + the −30 % shop,
// gone after 120 s), the dragon shadow (roar, red flash, nearby mobs flee), the wandering elite (×4 hp, named, a guaranteed Rare), the
// scheduler (4–7 min, never in a POI or a dungeon) and the #evbar banner with a real tap → direction toast.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=... node tests/rpg/t_events.js   (HOLDOR_HTML overrides the page)
// Other agents' modules are faked when absent: R.data.world (one castle + one road), R.player, R.spawnMob, R.loot, R.sfx, R.ambience, R.items, the shop screen.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); }); // the Telegram SDK include is network, not the game
  const html = process.env.HOLDOR_HTML || 'beta/index.html';
  await page.goto('file://' + path.resolve(ROOT, html));
  await page.waitForFunction(() => window.R && R.events && R.data.events && R.sys.events, { timeout: 20000 });
  const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => {
    if (R.stop) R.stop(); R.running = false; if (R.ui.cur) R.ui.close();
    R.state = R.state || R.newState(); R.state.p.lvl = 5; R.state.p.gems = 0; R.state.p.flags = {};
    if (!R.data.world) R.data.world = { pois: [{ id: 'winterfell', name: 'Winterfell', type: 'castle', x: 3000, y: 4000, r: 120 }], roads: [[[1200, 4000], [1800, 4000], [2400, 4000], [3000, 4000]]] };
    if (!R.player) R.player = R.spawn({ kind: 'player', team: 0, x: 2200, y: 4000, hp: 500, name: 'me' });
    R.player.dead = false; R.player.x = 2200; R.player.y = 4000; R.cam.x = 2200; R.cam.y = 4000; R.cam.z = 1;
    window.__ = { spawns: [], chests: [], drops: [], sfx: [], flash: [], ev: [], shop: null };
    R.spawnMob = (type, x, y, o) => { __.spawns.push(type); return R.spawn({ kind: 'mob', type, x, y, team: 1, hp: 30, atk: 5, spd: 100, lvl: o.lvl, ai: { state: 'idle' } }); };
    R.loot = { chest: (x, y, rar) => __.chests.push({ x, y, rar }), drop: (x, y, it) => __.drops.push(it) };
    R.sfx = { play: n => __.sfx.push(n) }; R.ambience = { flash: (c, d) => __.flash.push(c + '|' + d) };
    R.items = { shopStock: () => [{ id: 'a', name: 'Sword', price: 100, rar: 1 }, { id: 'b', name: 'Mail', price: 200, rar: 1 }, { id: 'c', name: 'Potion', price: 50, rar: 0 }, { id: 'd', name: 'Extra', price: 10 }], roll: (l, r) => ({ id: 'r' + l, kind: 'weapon', name: 'Rolled', rar: r, lvl: l, stats: {} }) };
    R.screens.shop = { open: poi => { __.shop = poi; }, close: () => {} };
    R.bus.on('event', (id, st) => __.ev.push(id + ':' + st));
    window.steps = n => { for (let i = 0; i < n; i++) R.step(); };
    // the POI the events must never start in: put it on the map as the world helper would (poiAt) only when A06 is absent
    if (!R.world) R.world = { poiAt: (x, y) => R.data.world.pois.find(p => Math.hypot(p.x - x, p.y - y) < p.r) || null, blocked: () => false };
  });
  // --- the scheduler: the first event 4–7 minutes ahead
  const sch = await page.evaluate(() => { R.events.nextAt = null; R.step(); return { t: R.t, next: R.events.nextAt }; });
  ok('the first event is scheduled 4-7 minutes of play ahead', sch.next >= sch.t + 239 && sch.next <= sch.t + 421, JSON.stringify(sch));
  // --- 1. the horde: 12–18 wights on the road away from the castle, marching toward it, the banner
  const H = await page.evaluate(() => { R.rng(42); const ev = R.events.start('horde'); const ms = R.events.mobs(); const b = document.getElementById('evbar');
    const bar = { on: b && b.classList.contains('on'), t: b && b.querySelector('.evbar-t').textContent, time: b && b.querySelector('.evbar-time').textContent, prog: b && b.querySelector('.evbar-prog').textContent };
    const d0 = ms.map(m => Math.hypot(m.x - 3000, m.y - 4000)); const minD0 = Math.round(Math.min(...ms.map(m => Math.hypot(m.x - 2200, m.y - 4000)))); steps(120); const d1 = ms.map(m => Math.hypot(m.x - 3000, m.y - 4000)); R.drawAll();
    return { id: ev && ev.id, n: ms.length, types: [...new Set(__.spawns)], tagged: ms.every(m => m.event === 'horde' && m.persist && m.evN === ev.n), bar, time2: b.querySelector('.evbar-time').textContent,
      closer: d1.filter((d, i) => d < d0[i] - 120).length, minD: minD0, nearRoad: ms.every(m => Math.abs(m.y - 4000) < 160), walk: ms.every(m => m.anim === 'walk'), ev: __.ev.slice(), poi: ev.poi.id, path: ev.path.length }; });
  ok('start("horde") spawns 12-18 wights 250+ away by the road, all tagged event=horde', H.n >= 12 && H.n <= 18 && H.types.length === 1 && H.tagged && H.minD >= 250 && H.nearRoad && H.ev.join() === 'horde:start' && H.poi === 'winterfell', JSON.stringify(H));
  ok('the banner: "A horde marches on Winterfell", 3:00, "0 / N"; after 2 s it reads 2:58', H.bar.on && H.bar.t === 'A horde marches on Winterfell' && H.bar.time === '3:00' && H.bar.prog === '0 / ' + H.n && H.time2 === '2:58', JSON.stringify(H.bar) + ' ' + H.time2);
  ok('every wight marched 120+ units toward the castle in 2 s (walk anim)', H.closer === H.n && H.walk, 'closer ' + H.closer + '/' + H.n + ' walk ' + H.walk);
  await page.screenshot({ path: SC + 'rpg_events_horde.png' });
  await page.locator('#evbar').tap(); await page.waitForTimeout(250);
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  ok('a tap on the banner → a toast with the direction and the target', /The horde: \d+ paces (north|south|east|west)/.test(toast) && /heading for Winterfell/.test(toast), toast);
  const K = await page.evaluate(() => { const ms = R.events.mobs(); const n = ms.length; for (let i = 0; i < n - 1; i++) R.kill(ms[i]); const prog = document.querySelector('.evbar-prog').textContent; R.kill(ms[n - 1]); R.step();
    return { prog, n, ev: __.ev.slice(), chests: __.chests, gems: R.state.p.gems, active: !!R.events.active, bar: document.getElementById('evbar').className, bt: document.querySelector('.evbar-t').textContent, next: R.events.nextAt - R.t }; });
  ok('kills count "N-1 / N"; the last kill → done, a rar-2 chest, +15 gems, a green banner', K.prog === (K.n - 1) + ' / ' + K.n && K.ev.join() === 'horde:start,horde:done' && K.chests.length === 1 && K.chests[0].rar === 2 && K.gems === 15 && !K.active && /done/.test(K.bar) && /Horde destroyed/.test(K.bt) && K.next >= 239 && K.next <= 421, JSON.stringify(K));
  // the timer runs out → fail, the wights vanish, the castle is raided for a day
  const F = await page.evaluate(() => { __.ev.length = 0; R.events.start('horde'); const n = R.events.mobs().length; steps(180 * 60 + 2);
    return { n, ev: __.ev.slice(), left: R.ents.filter(e => e.event === 'horde' && !e.dead).length, flag: R.state.p.flags['raided:winterfell'], mul: R.events.priceMul('winterfell'), raided: R.events.raided('winterfell'), other: R.events.priceMul('kingslanding'), bar: document.getElementById('evbar').className, bt: document.querySelector('.evbar-t').textContent }; });
  ok('3:00 without killing them → fail, the wights vanish, Winterfell raided for a day (prices x1.3), a red banner', F.ev.join() === 'horde:start,horde:fail' && F.left === 0 && F.flag > Date.now() + 86000000 && F.mul === 1.3 && F.raided && F.other === 1 && /fail/.test(F.bar) && /reached Winterfell/.test(F.bt), JSON.stringify(F));
  // --- 2. the caravan
  const C = await page.evaluate(() => { __.ev.length = 0; __.shop = null; const ev = R.events.start('caravan'); const npc = ev.npc;
    const at = { kind: npc.kind, dialog: npc.dialog, team: npc.team, d: Math.round(Math.hypot(npc.x - 2200, npc.y - 4000)), onRoad: Math.abs(npc.y - 4000) < 1, alive: R.ents.includes(npc), interact: typeof npc.interact === 'function', prog: document.querySelector('.evbar-prog').textContent };
    R.cam.x = npc.x; R.cam.y = npc.y; steps(30); R.drawAll(); npc.interact(); const shop = __.shop; const cur = R.ui.cur; R.ui.close(); steps(120 * 60 + 2);
    return { at, cur, shop: shop && { id: shop.id, name: shop.name, n: shop.stock.length, prices: shop.stock.map(i => i.price), p0: shop.stock.map(i => i.price0), disc: shop.disc }, gone: !R.ents.includes(npc), ev: __.ev.slice() }; });
  ok('the caravan: an npc {dialog:"caravan", interact()} on the road 120-450 paces away, neutral team', C.at.kind === 'npc' && C.at.dialog === 'caravan' && C.at.team === 2 && C.at.onRoad && C.at.d >= 120 && C.at.d <= 460 && C.at.alive && C.at.interact && /3 items at -30%/.test(C.at.prog), JSON.stringify(C.at));
  ok('interact → the shop opens with poi {id:"caravan", name:"Caravan"} and 3 items at -30 % (100/200/50 → 70/140/35)', C.cur === 'shop' && C.shop && C.shop.id === 'caravan' && C.shop.name === 'Caravan' && C.shop.n === 3 && C.shop.prices.join() === '70,140,35' && C.shop.p0.join() === '100,200,50', JSON.stringify(C.shop) + ' ' + C.cur);
  ok('after 120 s of steps the wagon is gone and the event is done', C.gone && C.ev.join() === 'caravan:start,caravan:done', JSON.stringify(C.ev) + ' gone ' + C.gone);
  await page.evaluate(() => { R.cam.x = 2200; R.cam.y = 4000; });
  // --- 3. the dragon shadow
  const D = await page.evaluate(() => { __.ev.length = 0; __.sfx.length = 0; __.flash.length = 0;
    const near = [R.spawn({ kind: 'mob', type: 'axe', team: 1, x: 2300, y: 4100, hp: 20, spd: 100, ai: { state: 'idle' } }), R.spawn({ kind: 'mob', type: 'axe', team: 1, x: 2000, y: 3900, hp: 20, spd: 100, ai: { state: 'patrol' } })];
    const far = R.spawn({ kind: 'mob', type: 'axe', team: 1, x: 2200, y: 4700, hp: 20, spd: 100, ai: { state: 'idle' } });
    const ev = R.events.start('dragon'); const t = R.t;
    const f = { near: near.map(m => m.status.flee > t && m.flee > t && m.ai.state === 'flee'), far: !!(far.status.flee || far.flee), sfx: __.sfx.slice(), flash: __.flash.slice(), title: document.querySelector('.evbar-t').textContent, time: document.querySelector('.evbar-time').textContent };
    let threw = null; try { for (let i = 0; i < 90; i++) { R.step(); R.drawAll(); } } catch (e) { threw = e.message; } f.threw = threw;
    f.moved = Math.round(Math.hypot(near[0].x - 2300, near[0].y - 4100)); f.away = Math.hypot(near[0].x - 2200, near[0].y - 4000) > Math.hypot(100, 100) + 100;
    return f; });
  ok('the dragon: nearby mobs (<400) flee 5 s (status.flee, ai.state "flee"), the far one does not; roar + red flash', D.near.every(Boolean) && !D.far && D.sfx.includes('roar') && D.flash[0] === '#ff6a2a|1.2' && D.title === 'A dragon passes overhead' && D.time === '0:06', JSON.stringify(D));
  ok('fleeing mobs run away from the player; the shadow draws 90 frames without an error', D.moved > 100 && D.away && !D.threw, 'moved ' + D.moved + ' away ' + D.away + ' threw ' + D.threw);
  await page.screenshot({ path: SC + 'rpg_events_dragon.png' });
  const D2 = await page.evaluate(() => { steps(6 * 60); const m = R.ents.filter(e => e.kind === 'mob' && e.type === 'axe'); return { ev: __.ev.slice(), states: m.map(x => x.ai.state), active: !!R.events.active }; });
  ok('after 6 s the dragon is gone (done) and the mobs go back to idle', D2.ev.join() === 'dragon:start,dragon:done' && !D2.active && D2.states.every(s => s === 'idle' || s === 'patrol'), JSON.stringify(D2));
  // --- 4. the wandering elite
  const X1 = await page.evaluate(() => { __.ev.length = 0; __.drops.length = 0; R.rng(7); const ev = R.events.start('elite'); const m = ev.mob;
    const a = { name: m.name, named: R.data.events.elite.names.includes(m.name), hp: m.hp, hpMax: m.hpMax, elite: m.elite, d: Math.round(Math.hypot(m.x - 2200, m.y - 4000)), title: document.querySelector('.evbar-t').textContent, prog: document.querySelector('.evbar-prog').textContent, time: document.querySelector('.evbar-time').textContent };
    steps(300); R.drawAll(); a.wandered = Math.hypot(m.x - ev.home.x, m.y - ev.home.y) > 5 || m.anim === 'walk'; a.nearHome = Math.hypot(m.x - ev.home.x, m.y - ev.home.y) < 320; R.kill(m); R.step(); a.ev = __.ev.slice(); a.drops = __.drops.slice(); a.bar = document.getElementById('evbar').className; a.bt = document.querySelector('.evbar-t').textContent; return a; });
  ok('the elite: a named mob with x4 hp (30 → 120) 300-560 paces away; the banner names it, "0 / 1", 4:00', X1.named && X1.hp === 120 && X1.hpMax === 120 && X1.elite && X1.d >= 280 && X1.d <= 600 && X1.title === X1.name + ' roams nearby' && X1.prog === '0 / 1' && X1.time === '4:00', JSON.stringify(X1));
  ok('it wanders near its spot; killing it → done + a guaranteed Rare drop (rar 2)', X1.wandered && X1.nearHome && X1.ev.join() === 'elite:start,elite:done' && X1.drops.length === 1 && X1.drops[0].rar === 2 && /slain/.test(X1.bt), JSON.stringify(X1.ev) + ' ' + JSON.stringify(X1.drops) + ' ' + X1.bt);
  const X2 = await page.evaluate(() => { __.ev.length = 0; const ev = R.events.start('elite'); steps(240 * 60 + 2); return { ev: __.ev.slice(), gone: !R.ents.includes(ev.mob) }; });
  ok('an elite not killed in 4:00 wanders off → fail, the mob is removed', X2.ev.join() === 'elite:start,elite:fail' && X2.gone, JSON.stringify(X2));
  // --- the auto-start rules: never inside a POI, never in a dungeon, never with a screen open; otherwise one starts when due
  const A = await page.evaluate(() => { const r = {}; __.ev.length = 0;
    R.player.x = 3000; R.player.y = 4000; R.events.nextAt = R.t + 0.05; steps(10); r.inPoi = !R.events.active && R.events.nextAt > R.t + 15;
    R.player.x = 2200; R.dungeons = { active: true }; R.events.nextAt = R.t + 0.05; steps(10); r.dungeon = !R.events.active; R.dungeons.active = false;
    R.screens.x = { open: () => {} }; R.ui.open('x'); R.events.nextAt = R.t + 0.05; steps(10); r.screen = !R.events.active; R.ui.close();
    R.events.nextAt = R.t + 0.05; steps(10); r.started = R.events.active && R.events.active.id; r.ev = __.ev.slice(); r.last = R.events.last;
    const picks = {}; for (let i = 0; i < 200; i++) { const k = R.events.pick(); picks[k] = (picks[k] || 0) + 1; } r.picks = Object.keys(picks).sort().join();
    R.events.stop('cancel'); r.cancelled = !R.events.active && __.ev.length === 1 && document.getElementById('evbar').className === ''; return r; });
  ok('no auto-start inside a POI, in a dungeon or with a screen open; due + free → one starts; pick() draws every kind except the last one', A.inPoi && A.dungeon && A.screen && !!A.started && A.ev.length === 1 && A.picks.split(',').length === 3 && !A.picks.includes(A.last) && A.cancelled, JSON.stringify(A));
  // --- a mob-less world: the module must not throw without roads, POIs or mob tables
  const Z = await page.evaluate(() => { const w = R.data.world; R.data.world = {}; __.ev.length = 0; let threw = null; try { const ev = R.events.start('horde'); steps(60); R.drawAll(); R.events.stop('cancel'); R.events.start('caravan'); steps(10); R.drawAll(); R.events.stop('cancel'); } catch (e) { threw = e.message; } R.data.world = w; return { threw, ev: __.ev.slice() }; });
  ok('without roads/POIs the horde and the caravan still start and tick (no throw)', !Z.threw && Z.ev.join() === 'horde:start,caravan:start', JSON.stringify(Z));
  // --- report
  for (const k in T) console.log(T[k].startsWith('OK') ? 'OK   ' + k : 'FAIL ' + k + ' -> ' + T[k]);
  console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
  const bad = Object.values(T).some(v => /^FAIL/.test(v)) || errors.length;
  console.log(bad ? 'FAILS: see above' : 'ALL PASS');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
