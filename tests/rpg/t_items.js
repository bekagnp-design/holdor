// RPG items (A15): R.items / R.data.items. Part 1 runs js/30_items.js in Node with a fake R (seeded rng, no DOM);
// part 2 builds the RPG page into a scratch file and loads it in Chromium: icons and tooltips render, no page errors.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_items.js   (RPG_HTML=<built page> skips the build)
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..'); const SRC = path.join(ROOT, 'src', 'rpg', 'js', '30_items.js');
const RES = {}; const ok = (k, v, info) => { RES[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
const strip = it => { const o = Object.assign({}, it); delete o.id; return o; };

// a fake R: the core's rng, a recording bus, a save shape like the core's (p = the hero)
function fakeR(seed, cls) {
  const g = { console, Date, Math, Object, Array, JSON, String, Number }; g.window = g;
  let s = (seed >>> 0) || 1;
  g.R = { rng: x => { if (x != null) s = (x >>> 0) || 1; s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; },
    bus: { ev: [], emit(e, ...a) { this.ev.push([e, ...a]); }, on() {}, off() {} }, save() { g.R.saved = (g.R.saved || 0) + 1; }, ui: { toast(t) { (g.R.toasts = g.R.toasts || []).push(t); } },
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    state: { v: 2, p: { name: 'T', house: 'stark', cls: cls || 'knight', lvl: 10, gold: 500, gems: 0, gear: {}, inv: [], potions: { hp: 0, mana: 0 } } } };
  vm.createContext(g); vm.runInContext(fs.readFileSync(SRC, 'utf8'), g, { filename: SRC });
  return g.R;
}

(async () => {
  /* ---------------- part 1: Node ---------------- */
  const R = fakeR(42); const I = R.items; const D = R.data.items; const B = D.bases;
  ok('R.items + R.data.items exist', I && D && D.RAR.length === 5 && D.RAR[4].col === '#e3b661');
  const byKind = k => Object.values(B).filter(b => b.kind === k);
  const wByCls = c => byKind('weapon').filter(b => b.cls === c).length;
  ok('12 weapons per class, 10 armors, 8 trinkets', wByCls('knight') === 12 && wByCls('ranger') === 12 && wByCls('maester') === 12 && byKind('armor').length === 10 && byKind('trinket').length === 8, [wByCls('knight'), wByCls('ranger'), wByCls('maester'), byKind('armor').length, byKind('trinket').length].join('/'));
  ok('2 potions + 3 materials', byKind('potion').length === 2 && byKind('mat').length === 3);
  const names = Object.values(B).map(b => b.name);
  ok('no base name empty, all unique', names.every(n => n && n.trim().length > 2) && new Set(names).size === names.length, names.length + ' names');
  ok('4 sets × 3 slots (weapon per class + armor + trinket)', Object.keys(D.sets).length === 4 && Object.values(D.sets).every(S => S.pieces.length === 5 && ['knight', 'ranger', 'maester'].every(c => S.pieces.some(k => B[k].kind === 'weapon' && B[k].cls === c)) && S.pieces.some(k => B[k].kind === 'armor') && S.pieces.some(k => B[k].kind === 'trinket')));

  // rarity weights: 10k rolls at lvl 20 ± 2 % ; with a floor of 2 the weights renormalise (10/4/1 → 66.7/26.7/6.7)
  const N = 10000; const cnt = [0, 0, 0, 0, 0]; const items = [];
  for (let i = 0; i < N; i++) { const it = I.roll(20, 0, R.rng); cnt[it.rar]++; items.push(it); }
  const want = [60, 25, 10, 4, 1]; const pct = cnt.map(c => c / N * 100);
  ok('10k rolls match 60/25/10/4/1 within 2 %', pct.every((p, i) => Math.abs(p - want[i]) <= 2), pct.map(p => p.toFixed(1)).join('/'));
  const cnt2 = [0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) cnt2[I.roll(20, 2, R.rng).rar]++;
  const want2 = [0, 0, 66.67, 26.67, 6.67]; const pct2 = cnt2.map(c => c / N * 100);
  ok('rarMin 2: nothing below Rare, weights renormalised within 2 %', pct2.every((p, i) => Math.abs(p - want2[i]) <= 2), pct2.map(p => p.toFixed(1)).join('/'));
  ok('every rolled item has a name, id, icon, price, lvl, stats', items.every(it => it.name && it.id && it.icon.includes('<svg') && it.price > 0 && it.lvl === 20 && it.stats && Object.keys(it.stats).length));
  ok('rolls are gear only (weapon / armor / trinket)', items.every(it => ['weapon', 'armor', 'trinket'].includes(it.kind)));
  const kinds = {}; items.forEach(it => kinds[it.kind] = (kinds[it.kind] || 0) + 1);
  ok('kind mix near 45/35/20', Math.abs(kinds.weapon / N * 100 - 45) <= 2 && Math.abs(kinds.armor / N * 100 - 35) <= 2 && Math.abs(kinds.trinket / N * 100 - 20) <= 2, JSON.stringify(kinds));
  ok('trinkets carry exactly one of spd / crit / power', items.filter(it => it.kind === 'trinket').every(it => { const k = Object.keys(it.stats); return k.length === 1 && ['spd', 'crit', 'power'].includes(k[0]); }));
  ok('rolled items respect the level (no base above lvl + 2)', items.every(it => B[it.base].tier <= 22));

  // class filter + rarity locks
  const kn = []; for (let i = 0; i < 3000; i++) kn.push(I.roll(50, 0, R.rng, 'knight'));
  ok('cls knight: no ranger / maester weapon or armor', kn.every(it => !it.cls || it.cls === 'knight'));
  const val = kn.filter(it => /valyrian/.test(it.base));
  ok('Valyrian steel only Legendary', val.length > 0 && val.every(it => it.rar === 4), val.length + ' Valyrian of ' + kn.filter(it => it.rar === 4).length + ' legendary');
  ok('make(Valyrian, rar 0) is forced to Legendary', I.make('k_valyrian', 10, 0, R.rng).rar === 4 && I.make('m_valyrian', 10, 2, R.rng).rar === 4);
  ok('court pieces never below Rare', kn.every(it => it.set !== 'court' || it.rar >= 2) && I.make('a_kg', 30, 0, R.rng).rar === 2);
  const ra = []; for (let i = 0; i < 2000; i++) ra.push(I.roll(5, 0, R.rng, 'ranger'));
  ok('cls ranger: weapons are bows / crossbows / daggers', ra.filter(it => it.kind === 'weapon').every(it => it.cls === 'ranger'));

  // stats monotonic in lvl and rar
  let monoA = true, monoD = true, monoH = true, monoT = true, monoR = true;
  for (const b of byKind('weapon')) for (let r = 0; r <= 4; r++) { let prev = 0; for (let l = 1; l <= 60; l++) { const v = I.statsFor(b.key, l, r).atk; if (v <= prev) monoA = false; prev = v; } }
  for (const b of byKind('armor')) for (let r = 0; r <= 4; r++) { let pd = -1, ph = 0; for (let l = 1; l <= 60; l++) { const s = I.statsFor(b.key, l, r); if (s.def < pd) monoD = false; if (s.hp <= ph) monoH = false; pd = s.def; ph = s.hp; } }
  for (const st of ['spd', 'crit', 'power']) for (let r = 0; r <= 4; r++) { let p = -1; for (let l = 1; l <= 60; l++) { const v = I.statsFor('t_tooth', l, r, st)[st]; if (v < p) monoT = false; p = v; } }
  for (let l = 1; l <= 60; l += 7) { let pa = 0, pd = -1, ph = 0, pt = 0; for (let r = 0; r <= 4; r++) { const a = I.statsFor('k_castle', l, r).atk, d = I.statsFor('a_mail', l, r), t = I.statsFor('t_chain', l, r, 'crit').crit; if (a <= pa || d.def < pd || d.hp <= ph || t <= pt) monoR = false; pa = a; pd = d.def; ph = d.hp; pt = t; } }
  ok('weapon atk strictly rises with lvl', monoA); ok('armor def never falls, hp strictly rises with lvl', monoD && monoH); ok('trinket stat never falls with lvl', monoT);
  ok('atk / hp / trinket strictly rise with rarity, def never falls', monoR);
  const f = I.statsFor('k_castle', 10, 0).atk, f2 = I.statsFor('a_mail', 10, 2);
  ok('formulas: atk (6+1.8·10)=24, def (3+9)·1.44=17, hp 120·1.4=168', f === 24 && f2.def === 17 && f2.hp === 168, [f, f2.def, f2.hp].join('/'));

  // price / sell
  const p0 = I.make('k_castle', 10, 0, R.rng), p4 = I.make('k_castle', 10, 4, R.rng), p0b = I.make('k_castle', 30, 0, R.rng);
  ok('price rises with rarity and level', p4.price > p0.price && p0b.price > p0.price, [p0.price, p4.price, p0b.price].join('/'));
  ok('sell = 25 % of buy (floored, ≥ 1)', I.sellPrice(p0) === Math.floor(p0.price * 0.25) && I.sellPrice(I.make('mt_dust', 1, 0, R.rng)) >= 1 && items.every(it => I.sellPrice(it) * 4 <= it.price));
  ok('potions / mats priced', I.make('p_hp_s', 1, 0, R.rng).price > 0 && I.make('p_hp_l', 1, 0, R.rng).price > I.make('p_hp_s', 1, 0, R.rng).price && I.make('mt_glass', 1, 0, R.rng).price > I.make('mt_iron', 1, 0, R.rng).price);

  // inventory: cap 40, auto-sell Commons when full
  const S = fakeR(7); const J = S.items; const P = S.state.p;
  for (let i = 0; i < 45; i++) J.add(J.make('k_castle', 5, 0, S.rng));
  ok('inv capped at 40, 5 Commons auto-sold for gold', P.inv.length === 40 && P.gold === 500 + 5 * J.sellPrice(J.make('k_castle', 5, 0, S.rng)) && S.toasts.length === 5, 'inv ' + P.inv.length + ' gold ' + P.gold);
  const epic = J.make('a_brig', 5, 3, S.rng); const rA = J.add(epic);
  ok('a full bag takes an Epic by selling its cheapest Common', rA.ok && P.inv.includes(epic) && P.inv.length === 40 && S.toasts.length === 6);
  const stack = J.add(J.make('mt_iron', 1, 0, S.rng)); const stack2 = J.add(J.make('mt_iron', 1, 0, S.rng));
  ok('materials stack; a stack merges even when the bag is full', stack.ok && stack2.ok && stack2.item === stack.item && stack.item.n === 2 && P.inv.length === 40 && J.mats().iron === 2);
  // gear: equip from inv, swap returns the old piece, unequip, class lock
  const w1 = P.inv.find(x => x.kind === 'weapon'); const n0 = P.inv.length; const e1 = J.equip(w1);
  ok('equip moves the item out of the bag into gear.weapon', e1.ok && P.gear.weapon === w1 && !P.inv.includes(w1) && P.inv.length === n0 - 1);
  const w2 = P.inv.find(x => x.kind === 'weapon' && x !== w1); const e2 = J.equip(w2);
  ok('equipping another weapon returns the old one to the bag', e2.ok && e2.old === w1 && P.gear.weapon === w2 && P.inv.includes(w1) && P.inv.length === n0 - 1);
  const u1 = J.unequip('weapon');
  ok('unequip puts it back, slot empty', u1.ok && !P.gear.weapon && P.inv.includes(w2) && P.inv.length === n0);
  ok('unequip refused when the bag is full', (() => { J.equip(w2); while (P.inv.length < 40) P.inv.push(J.make('t_chain', 3, 1, S.rng)); const r = J.unequip('weapon'); return !r.ok && r.why === 'full' && P.gear.weapon === w2; })());
  ok('class lock: a knight cannot equip a bow', (() => { const bow = J.make('r_longbow', 5, 1, S.rng); const r = J.equip(bow); return !r.ok && r.why === 'class' && P.gear.weapon === w2; })());
  ok('a potion cannot be equipped', !J.equip(J.make('p_hp_s', 1, 0, S.rng)).ok);
  ok('inv stays consistent: no item both in the bag and in gear, no duplicates', (() => { const ids = P.inv.map(x => x.id); return new Set(ids).size === ids.length && !P.inv.includes(P.gear.weapon); })());
  const gold0 = P.gold; const sold = J.sell(P.inv[0]);
  ok('sell removes the item and pays 25 %', sold > 0 && P.gold === gold0 + sold && P.inv.length === 39);
  ok('bus saw gold / gear / inv events, save called', S.bus.ev.some(e => e[0] === 'gold') && S.bus.ev.some(e => e[0] === 'gear') && S.bus.ev.some(e => e[0] === 'inv') && S.saved > 0);
  ok('usePotion returns the heal share and consumes one', (() => { J.give('p_hp_l', 2); const h = J.usePotion('p_hp_l'); return h === 0.7 && J.potions().p_hp_l === 1; })());

  // sets
  const T = fakeR(3, 'ranger'); const K = T.items; const Q = T.state.p;
  const gear3 = { weapon: K.make('r_watch', 20, 2, T.rng), armor: K.make('a_nw', 20, 2, T.rng), trinket: K.make('t_clasp', 20, 2, T.rng) };
  const sb3 = K.setBonus(gear3), sb2 = K.setBonus({ weapon: gear3.weapon, armor: gear3.armor }), sb0 = K.setBonus({ weapon: gear3.weapon, armor: K.make('a_mail', 20, 2, T.rng) });
  ok('3 Night\'s Watch pieces: set detected 3/3, 2- and 3-piece bonuses active', sb3.sets.length === 1 && sb3.sets[0].id === 'watch' && sb3.sets[0].n === 3 && sb3.sets[0].active.join() === '2,3' && sb3.stats.def > 0 && sb3.stats.hp > 0 && sb3.stats.crit === 3, JSON.stringify(sb3.stats));
  ok('2 pieces: only the 2-piece bonus', sb2.sets[0].n === 2 && sb2.sets[0].active.join() === '2' && sb2.stats.def > 0 && sb2.stats.hp === 0 && sb2.stats.crit === 0);
  ok('1 piece: the set is listed as 1/3 (for the sheet), no bonus active, zero stats', sb0.sets.length === 1 && sb0.sets[0].n === 1 && !sb0.sets[0].active.length && Object.values(sb0.stats).every(v => v === 0));
  ok('2-piece def bonus = 12 % of gear def', sb2.stats.def === Math.round(gear3.armor.stats.def * 0.12));
  const gs = K.gearStats(gear3);
  ok('gearStats = item stats + set bonus', gs.atk === gear3.weapon.stats.atk && gs.def === gear3.armor.stats.def + sb3.stats.def && gs.hp === gear3.armor.stats.hp + sb3.stats.hp, JSON.stringify(gs));
  ok('every set has a weapon for each class and bonus 2 + 3 defined', Object.values(D.sets).every(S => S.bonus[2] && S.bonus[3]));
  Q.gear = gear3; ok('setBonus() with no arg reads R.state.p.gear', K.setBonus().sets[0].n === 3);

  // compare
  const c1 = K.compare(K.make('r_longbow', 20, 2, T.rng), K.make('r_longbow', 10, 0, T.rng)), c2 = K.compare(K.make('r_longbow', 10, 0, T.rng), K.make('r_longbow', 20, 2, T.rng)), c3 = K.compare(K.make('r_longbow', 10, 0, T.rng), null);
  ok('compare: higher lvl / rar is better, diff has atk, vs nothing is better', c1.better && c1.diff.atk > 0 && !c2.better && c2.diff.atk < 0 && c3.better);

  // upgrade: +1 lvl per step, 5 max, costs gold + materials
  const U = fakeR(11); const V = U.items; const W = U.state.p; W.gold = 100000; V.give('mt_iron', 40); V.give('mt_glass', 10); V.give('mt_dust', 10);
  const sw = V.make('k_castle', 10, 1, U.rng); V.add(sw); const atk0 = sw.stats.atk, pr0 = sw.price; let steps = 0, grows = true, lastAtk = atk0;
  for (let i = 0; i < 7; i++) { const r = V.upgrade(sw); if (r.ok) { steps++; if (sw.stats.atk <= lastAtk) grows = false; lastAtk = sw.stats.atk; } else if (r.why !== 'max') grows = false; }
  ok('upgrade: 5 steps then max, lvl 10 → 15, atk grows each step, price rises', steps === 5 && sw.up === 5 && sw.lvl === 15 && grows && sw.price > pr0 && V.fullName(sw) === 'Castle-forged Longsword +5', 'atk ' + atk0 + '→' + sw.stats.atk);
  ok('upgrade paid gold and iron (1+2+3+4+5 = 15 ingots)', W.gold < 100000 && V.mats().iron === 25 && V.mats().glass < 10, 'gold ' + W.gold + ' iron ' + V.mats().iron + ' glass ' + V.mats().glass);
  const poor = fakeR(12); poor.state.p.gold = 0; const pi = poor.items.make('k_castle', 10, 0, poor.rng);
  ok('upgrade refused without gold / mats, cost reported', (() => { const r = poor.items.upgrade(pi); poor.state.p.gold = 1e6; const r2 = poor.items.upgrade(pi); return !r.ok && r.why === 'gold' && r.cost.gold > 0 && !r2.ok && r2.why === 'mats' && r2.cost.mats.iron === 1; })());
  ok('upgrade with an external mats object spends from it', (() => { const m = { iron: 3 }; const r = poor.items.upgrade(pi, m); return r.ok && m.iron === 2 && pi.lvl === 11; })());
  ok('a trinket upgrade costs dust; a Legendary needs dragonglass', V.upgradeCost(V.make('t_chain', 10, 0, U.rng)).mats.dust === 1 && V.upgradeCost(V.make('k_valyrian', 40, 4, U.rng)).mats.glass === 1);

  // shop
  const shop = V.shopStock({ id: 'winterfell', type: 'castle' }, 12, U.rng), shopT = V.shopStock('town', 12, U.rng);
  ok('shopStock gives 6 priced items: weapon, armor, trinket, 2 potions, 1 material', shop.length === 6 && shop.map(x => x.kind).join() === 'weapon,armor,trinket,potion,potion,mat' && shop.every(x => x.price > 0 && x.name) && shopT.length === 6);
  ok('castle shop: gear Uncommon or better, dragonglass on the table; town: iron', shop.slice(0, 3).every(x => x.rar >= 1) && shop[5].base === 'mt_glass' && shopT[5].base === 'mt_iron');
  ok('shop weapon fits the player class', shop[0].cls === 'knight');

  // loot roll and determinism
  const lootK = {}; for (let i = 0; i < 3000; i++) { const it = V.rollLoot(10, 0, U.rng); lootK[it.kind] = (lootK[it.kind] || 0) + 1; }
  ok('rollLoot gives gear, potions and materials', lootK.potion > 300 && lootK.mat > 100 && (lootK.weapon + lootK.armor + lootK.trinket) > 1500, JSON.stringify(lootK));
  const A1 = fakeR(99), A2 = fakeR(99); const s1 = [], s2 = [];
  for (let i = 0; i < 50; i++) { s1.push(strip(A1.items.roll(15, 0, A1.rng, 'maester'))); s2.push(strip(A2.items.roll(15, 0, A2.rng, 'maester'))); }
  ok('same seed → same 50 rolls (ids aside)', JSON.stringify(s1) === JSON.stringify(s2));
  ok('tooltip / icon are HTML with the rarity colour and the stats', (() => { const it = V.make('k_castle', 10, 3, U.rng); const t = V.tooltip(it), ic = V.icon(it, 48); return t.includes('itm-tip') && t.includes('#b47cff') && t.includes('ATK') && t.includes('Epic') && ic.includes('<svg') && ic.includes('width:48px'); })());
  ok('every base has an icon glyph', Object.values(B).every(b => V.glyph(b.g).includes('<path') || V.glyph(b.g).includes('<circle') || V.glyph(b.g).includes('<rect')));
  ok('no state: state-bound calls refuse cleanly', (() => { const Z = fakeR(1); Z.state = null; const it = Z.items.roll(5); return it && !Z.items.add(it).ok && !Z.items.equip(it).ok && !Z.items.unequip('weapon').ok && Z.items.setBonus().sets.length === 0; })());

  /* ---------------- part 2: the built page in Chromium ---------------- */
  const errors = [];
  try {
    let html = process.env.RPG_HTML;
    if (!html) { html = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'holdor-rpg-')), 'index.html'); const b = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), html], { encoding: 'utf8' }); if (b.status !== 0) throw new Error('build failed: ' + b.stderr); }
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
    // the Telegram SDK include fails offline / behind a proxy: a resource error, not a script error
    pg.on('pageerror', e => errors.push('PE:' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); });
    await pg.goto('file://' + html); await pg.waitForFunction(() => window.R && window.R.items && window.R.data.items, { timeout: 15000 });
    const r = await pg.evaluate(() => {
      R.state = R.newState ? R.newState() : { p: { cls: 'knight', gold: 0, gear: {}, inv: [] } }; R.rng(5);
      const it = R.items.roll(5, 0, R.rng, R.state.p.cls); const a = R.items.add(it); const e = R.items.equip(it);
      const ui = document.getElementById('ui'); ui.innerHTML = R.items.icon(it, 44) + R.items.tooltip(it);
      const allIcons = Object.keys(R.data.items.bases).map(k => R.items.icon(R.items.make(k, 5, 1), 36)).join(''); const d = document.createElement('div'); d.innerHTML = allIcons; ui.appendChild(d);
      const svg = ui.querySelector('.itm-ic svg'); const box = svg && svg.getBoundingClientRect();
      return { kind: it.kind, add: a.ok, equip: e.ok, gearSet: R.state.p.gear[it.kind] === it, inv: R.state.p.inv.length, tip: !!ui.querySelector('.itm-tip'), svgs: ui.querySelectorAll('svg').length, bases: Object.keys(R.data.items.bases).length, svgW: box && Math.round(box.width), shop: R.items.shopStock({ type: 'town' }, 5).length, version: R.VERSION };
    });
    ok('built page: R.items works with the real core (roll → add → equip)', r.add && r.equip && r.gearSet && r.inv === 0, JSON.stringify(r));
    ok('built page: tooltip + one icon per base render as SVG in the DOM', r.tip && r.svgs === r.bases + 1 && r.svgW > 10, r.svgs + ' svgs for ' + r.bases + ' bases');
    ok('built page: shopStock 6 on the real core', r.shop === 6);
    await browser.close();
  } catch (e) { errors.push('BROWSER:' + e.message); }
  ok('no page errors', !errors.length, errors.join(' | ').slice(0, 400));

  console.log(JSON.stringify(RES, null, 1)); console.log('ERR', JSON.stringify(errors));
  const bad = Object.values(RES).filter(v => v.startsWith('FAIL')).length;
  console.log(bad ? bad + ' FAIL' : 'ALL PASS ' + Object.keys(RES).length);
  process.exit(bad || errors.length ? 1 : 0);
})();
