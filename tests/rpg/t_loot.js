/* HOLDOR RPG — loot test (A17): drops spawn and scatter, gold auto-picks within 46 u (magnet from 120), gear needs INTERACT or 1.5 s standing,
   a chest opens into 3 items + gold, drops expire at 60 s. Run after `python3 src/build_rpg.py beta/index.html`:
   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_loot.js   (HOLDOR_HTML=path overrides the build path). */
const { chromium } = require('playwright');
const path = require('path');
const html = process.env.HOLDOR_HTML || 'beta/index.html';
const file = path.isAbsolute(html) ? html : path.resolve(__dirname, '..', '..', html);
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + msg + (extra != null ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.R && R.loot && R.spawn, { timeout: 15000 });

  /* fake world: a player, a save, a mob type with a full drop table; R.items faked only if A15's module is absent */
  const setup = await page.evaluate(() => {
    R.rng(42); R.state = R.newState(); R.state.p.gold = 0; R.state.p.gems = 0; R.state.p.inv = []; R.state.p.gear = {}; R.state.p.potions = { hp: 0, mana: 0 };
    R.ents.length = 0; R.running = false; R.paused = false;
    R.player = R.spawn({ kind: 'player', x: 1000, y: 1000, r: 14, team: 0, hp: 200, lvl: 3, name: 'Tester' });
    delete R.player.gold; delete R.player.gems;            // the fallback path adds to the save directly
    if (!R.input) R.input = {}; R.input.interact = null;
    R.data.mobs = R.data.mobs || {}; R.data.mobs.__lootTest = { drops: { item: 1, potion: 1, mat: 1, gem: 0 }, gold: [2, 8] };
    window.__itemsFaked = !R.items;
    if (!R.items) R.items = { roll: (lvl, rar) => ({ id: 'f' + Math.random().toString(36).slice(2), kind: 'weapon', name: 'Castle-forged sword', rar: rar || 0, lvl, stats: { atk: 5 }, icon: '🗡️' }) };
    window.__loot = []; R.bus.on('loot', it => window.__loot.push(it.name)); window.__gold = 0; R.bus.on('gold', n => window.__gold += n);
    return { itemsFaked: window.__itemsFaked, sys: !!R.sys.loot, stepOk: typeof R.step === 'function' };
  });
  ok(setup.sys && setup.stepOk, 'loot system registered, R.step present', setup);

  /* 1. drop(mob) spawns scattered entities with icons and colours */
  const d1 = await page.evaluate(() => {
    const mob = R.spawn({ kind: 'mob', type: '__lootTest', x: 1600, y: 1600, lvl: 3, hp: 1, team: 1 });
    const out = R.loot.drop(mob); const again = R.loot.drop(mob);
    const subs = {}; for (const e of out) subs[e.sub] = (subs[e.sub] || 0) + 1;
    const gold = out.filter(e => e.sub === 'gold').reduce((s, e) => s + e.amount, 0);
    for (let i = 0; i < 45; i++) R.step();                               // 0.75 s: the scatter settles
    const dist = out.map(e => Math.round(Math.hypot(e.x - 1600, e.y - 1600)));
    const hopped = out.some(e => e.vz !== 0 || e.z > 0) || out.every(e => e.z === 0);
    const live = out.filter(e => R.ents.includes(e)).length;
    return { n: out.length, again: again.length, subs, gold, dist, live, icons: out.every(e => e.icon && e.col), item: out.find(e => e.sub === 'item'), kinds: out.every(e => e.kind === 'drop'), hopped };
  });
  ok(d1.n >= 4 && d1.kinds, 'drop() spawns drop entities (gold + item + potion + mat)', { n: d1.n, subs: d1.subs });
  ok(d1.again === 0, 'a second drop() on the same mob rolls nothing (mob.looted)');
  ok(d1.gold >= 6 && d1.gold <= 24, 'gold = 2–8 × level 3', d1.gold);
  ok(d1.dist.every(d => d >= 15 && d <= 60), 'drops settle 20–50 units from the mob', d1.dist);
  ok(d1.live === d1.n, 'the far-off drops are not picked up (player 850 u away)');
  ok(d1.icons && d1.item && d1.item.item && d1.item.item.name, 'every drop has e.icon + e.col; the item drop carries the item', d1.item && d1.item.item.name);
  ok(d1.hopped, 'drops hop (vz) and land (z back to 0)');

  /* 2. gold auto-pickup within 46 u; the magnet pulls from 120 u; an item is not auto-taken */
  const d2 = await page.evaluate(() => {
    const g0 = R.state.p.gold;
    const near = R.loot.spawn('gold', R.player.x + 40, R.player.y, { amount: 10, scatter: false });
    const far = R.loot.spawn('gold', R.player.x + 110, R.player.y, { amount: 7, scatter: false });
    const out = R.loot.spawn('gold', R.player.x + 300, R.player.y, { amount: 5, scatter: false });
    R.step(); R.step();
    const nearGone = !R.ents.includes(near), goldAfterNear = R.state.p.gold - g0;
    const farX0 = far.x; for (let i = 0; i < 20; i++) R.step(); const farMoved = far.dead || far.x < farX0;   // 0.33 s: it drifts toward the player
    for (let i = 0; i < 90; i++) R.step();                                                              // 1.5 s more: it arrives
    const farGone = !R.ents.includes(far);
    const outStays = R.ents.includes(out) && out.x === R.player.x + 300;
    R.remove(out); out.dead = true;
    return { nearGone, goldAfterNear, farMoved, farGone, gold: R.state.p.gold - g0, ev: window.__gold };
  });
  ok(d2.nearGone && d2.goldAfterNear === 10, 'gold at 40 u is taken at once (+10)', d2);
  ok(d2.farMoved && d2.farGone && d2.gold === 17, 'gold at 110 u is magnetised and taken (+7)', d2);
  ok(d2.ev === 17, "the fallback path emits 'gold' once per coin", d2.ev);

  /* 3. an item needs INTERACT: the label appears within 70 u, the bus event takes it, auto-equip into the empty slot, then into the bag */
  const d3 = await page.evaluate(() => {
    const it1 = { id: 'sw1', kind: 'weapon', name: 'Castle-forged sword', rar: 2, lvl: 3, stats: { atk: 9 }, icon: '🗡️' };
    const e1 = R.loot.spawn('item', R.player.x + 50, R.player.y, { item: it1, scatter: false });
    for (let i = 0; i < 30; i++) R.step();                                                              // 0.5 s: no auto-take at 50 u (not standing on it)
    const stillThere = R.ents.includes(e1), lbl = R.input.interact && R.input.interact.label, src = R.input.interact && R.input.interact.src, glow = e1.glow, col = e1.col;
    R.bus.emit('interact', e1);                                                                          // A12's INTERACT → bus
    const gone = !R.ents.includes(e1), gear = R.state.p.gear.weapon && R.state.p.gear.weapon.id, inv1 = R.state.p.inv.length, cleared = !R.input.interact;
    const e2 = R.loot.spawn('item', R.player.x + 50, R.player.y, { item: { id: 'sw2', kind: 'weapon', name: 'Longaxe', rar: 0, lvl: 3, stats: { atk: 7 }, icon: '🪓' }, scatter: false });
    R.step(); R.step(); R.input.interact.act();                                                         // the act() shortcut
    const inv2 = R.state.p.inv.map(i => i.id), gearStill = R.state.p.gear.weapon.id;
    return { stillThere, lbl, src, glow, col, gone, gear, inv1, cleared, inv2, gearStill, loot: window.__loot.slice() };
  });
  ok(d3.stillThere, 'an item at 50 u is not auto-picked');
  ok(d3.lbl === 'Take Castle-forged sword' && d3.src === 'loot', "R.input.interact = {label:'Take <name>', src:'loot'}", d3.lbl);
  ok(d3.glow === '#4fb0ff' && d3.col === '#4fb0ff', 'a Rare item drop has a blue beam (e.glow) in the rarity colour', d3.glow);
  ok(d3.gone && d3.gear === 'sw1' && d3.inv1 === 0 && d3.cleared, "'interact' takes it; the empty weapon slot is auto-filled; the label clears", d3);
  ok(d3.inv2.length === 1 && d3.inv2[0] === 'sw2' && d3.gearStill === 'sw1', 'the second weapon lands in the bag, the equipped one stays', d3.inv2);
  ok(d3.loot.length === 2 && d3.loot[0] === 'Castle-forged sword', "'loot' emitted per item", d3.loot);

  /* 3b. standing on a material for 1.5 s takes it without a tap; materials stack */
  const d3b = await page.evaluate(() => {
    const m = { id: 'bone', kind: 'mat', name: 'Wight bone', rar: 0, lvl: 3, icon: '🦴', n: 1 };
    const e = R.loot.spawn('mat', R.player.x + 5, R.player.y, { item: m, scatter: false });
    for (let i = 0; i < 60; i++) R.step();                                                               // 1.0 s: still there
    const at1 = R.ents.includes(e);
    for (let i = 0; i < 40; i++) R.step();                                                               // 1.67 s: taken
    const at2 = R.ents.includes(e);
    const e2 = R.loot.spawn('mat', R.player.x + 5, R.player.y, { item: { id: 'bone', kind: 'mat', name: 'Wight bone', rar: 0, lvl: 3, icon: '🦴', n: 2 }, scatter: false });
    R.loot.take(e2);
    const mats = R.state.p.inv.filter(i => i.kind === 'mat');
    return { at1, at2, mats: mats.length, n: mats[0] && mats[0].n, inv: R.state.p.inv.length };
  });
  ok(d3b.at1 && !d3b.at2, 'a material is auto-taken after 1.5 s standing on it', d3b);
  ok(d3b.mats === 1 && d3b.n === 3, 'materials stack by id (1 + 2 = 3)', d3b);

  /* 4. a chest: INTERACT opens it into 3 items + gold (+ gems from Rare) */
  const d4 = await page.evaluate(() => {
    const ch = R.loot.chest(R.player.x + 60, R.player.y, 5, 2);
    R.step(); R.step();
    const lbl = R.input.interact && R.input.interact.label, kind = ch.kind, name = ch.name;
    R.bus.emit('interact', ch);
    const drops = ch.drops || []; const items = drops.filter(e => e.sub === 'item'), gold = drops.filter(e => e.sub === 'gold').reduce((s, e) => s + e.amount, 0), gems = drops.filter(e => e.sub === 'gem').length;
    const rars = items.map(e => e.item.rar); const again = R.loot.open(ch);
    for (let i = 0; i < 20; i++) R.step();
    const coinsTaken = R.loot.drops().filter(e => e.sub === 'gold').length;                         // coins within 46–120 u fly in
    for (let i = 0; i < 16 * 60; i++) R.step();                                                       // 16 s: the open chest disappears
    const chestGone = !R.ents.includes(ch);
    return { lbl, kind, name, n: drops.length, items: items.length, gold, gems, rars, again, opened: ch.opened, coinsTaken, chestGone };
  });
  ok(d4.kind === 'chest' && d4.name === 'Rare chest' && d4.lbl === 'Open chest', "a chest entity; INTERACT label 'Open chest'", d4);
  ok(d4.opened && d4.items === 3 && d4.gold >= 75 && d4.gems === 1 && d4.again === null, 'opening gives 3 items + gold (+1 gem drop); opens once', { items: d4.items, gold: d4.gold, gems: d4.gems, rars: d4.rars });
  ok(d4.rars[0] >= 2, 'the first chest item is at least the chest rarity', d4.rars);
  ok(d4.chestGone, 'the opened chest is removed after 15 s');

  /* 5. drops expire at 60 s; goldBurst makes 3–6 coins that sum */
  const d5 = await page.evaluate(() => {
    R.ents.length = 0; R.ents.push(R.player);
    const e = R.loot.spawn('item', R.player.x + 500, R.player.y + 500, { lvl: 3, rar: 0 });
    for (let i = 0; i < 59 * 60; i++) R.step();
    const at59 = R.ents.includes(e); const blink = e.blink;
    for (let i = 0; i < 90; i++) R.step();
    const at61 = R.ents.includes(e);
    const coins = R.loot.goldBurst(R.player.x + 600, R.player.y, 100);
    const sum = coins.reduce((s, c) => s + c.amount, 0);
    return { at59, blink, at61, coins: coins.length, sum };
  });
  ok(d5.at59 && d5.blink && !d5.at61, 'a drop lives 60 s (blinks in the last 8 s) then disappears', d5);
  ok(d5.coins >= 3 && d5.coins <= 6 && d5.sum === 100, 'goldBurst(100) → 3–6 coins summing to 100', d5);

  /* 6. a boss kill through the bus drops gems + a guaranteed item; the module never throws */
  const d6 = await page.evaluate(() => {
    const boss = R.spawn({ kind: 'boss', type: 'nope', x: 3000, y: 3000, lvl: 10, hp: 1, team: 1 });
    const n0 = R.ents.length; R.kill(boss);
    const drops = R.ents.filter(e => e.kind === 'drop' && Math.hypot(e.x - 3000, e.y - 3000) < 80);
    return { n: drops.length, gems: drops.filter(e => e.sub === 'gem').length, items: drops.filter(e => e.sub === 'item').length, gold: drops.filter(e => e.sub === 'gold').reduce((s, e) => s + e.amount, 0), grew: R.ents.length > n0 };
  });
  ok(d6.grew && d6.gems === 1 && d6.items >= 1 && d6.gold >= 200, "the 'kill' event drops boss loot: gems + item + 10× gold", d6);

  await page.evaluate(() => { const c = R.ctx; R.cam.x = R.player.x; R.cam.y = R.player.y; for (const e of R.loot.drops()) R.loot.drawDrop(c, e); });
  ok(errors.length === 0, 'no page errors', errors);
  console.log(fails ? 'FAILED ' + fails : 'ALL OK', setup.itemsFaked ? '(R.items faked)' : '(real R.items)');
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
