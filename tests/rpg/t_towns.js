// HOLDOR RPG — towns (A21): the shop, the inn and the smith on a 390×844 phone with real taps.
// The shop shows 6 items of the day; buying a potion takes gold and adds to potions.hp; what the hero cannot afford says "Need N more";
// SELL sells one item and offers "sell all Commons"; the inn's REST heals to full, clears ailments and takes 20 × lvl/5 gold (free under 5);
// the smith's UPGRADE raises the item (+1, lvl) and takes mats + gold; REFORGE takes 30 gems and changes the secondary stat.
// run:  python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_towns.js
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const HTML = path.resolve(__dirname, '..', '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CE:' + m.text()); });   // the Telegram SDK include may not load offline
  await page.goto('file://' + HTML); await page.waitForFunction(() => window.R && R.towns && R.screens.shop && R.screens.inn && R.screens.smith, { timeout: 20000 });
  const out = []; let bad = 0; const ok = (name, v, info) => { if (!v) bad++; out.push((v ? 'OK   ' : 'FAIL ') + name + (info ? '  [' + info + ']' : '')); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap(); await page.waitForTimeout(ms == null ? 250 : ms); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // ---- a hero with gold, gems, an equipped sword, two items and three mats, standing in a town
  const S = await ev(() => { if (R.stop) R.stop(); const s = R.newState(); s.p.name = 'Tester'; s.p.lvl = 6; s.p.gold = 5000; s.p.gems = 500; s.p.pos = { x: 1000, y: 1000 }; s.p.potions = { hp: 2, mana: 0 };
    s.p.gear = { weapon: { id: 'w0', kind: 'weapon', name: 'Old sword', rar: 0, lvl: 3, stats: { atk: 14 }, icon: 'weapon' } };
    s.p.inv = [{ id: 'a1', kind: 'armor', name: 'Patched leather', rar: 0, lvl: 2, stats: { def: 6 }, icon: 'armor' }, { id: 't1', kind: 'trinket', name: 'Bone charm', rar: 1, lvl: 4, stats: { hp: 40, crit: 3 }, icon: 'trinket' },
      { id: 'm1', kind: 'mat', name: 'Iron ore', rar: 0, lvl: 1, stats: {}, icon: 'mat' }, { id: 'm2', kind: 'mat', name: 'Iron ore', rar: 0, lvl: 1, stats: {}, icon: 'mat' }, { id: 'm3', kind: 'mat', name: 'Iron ore', rar: 0, lvl: 1, stats: {}, icon: 'mat' }];
    R.state = s;
    let poi = (R.data.world && R.data.world.pois || []).find(q => q.shop === true && q.x != null);
    if (!poi) { poi = { id: 't_town', name: 'Testers Rest', type: 'town', shop: true, x: 1000, y: 1000, r: 160 }; R.data.world = R.data.world || {}; R.data.world.pois = R.data.world.pois || []; R.data.world.pois.push(poi); }
    if (!R.player) R.player = R.spawn({ kind: 'player', team: 0, x: poi.x, y: poi.y, hp: 60, hpMax: 200, lvl: 6, name: 'Tester' }); else { R.player.x = poi.x; R.player.y = poi.y; R.player.hpMax = R.player.hpMax || 200; R.player.hp = 60; }
    R.player.status = { burn: 3, shield: 20 }; window.__poi = poi;
    R.ui.open('shop', poi); return { poi: poi.id, cur: R.ui.cur, stock: R.towns.stock(poi).length, price0: R.towns.price(R.towns.stock(poi)[0]) }; });
  ok('the shop opens from R.ui.open("shop", poi)', S.cur === 'shop', S.cur);
  const shop = await ev(() => { const cards = [...document.querySelectorAll('.tw-card.gear')]; const vh = window.innerHeight, scr = document.getElementById('screen');
    const btns = [...document.querySelectorAll('#screen button')].map(b => Math.round(b.getBoundingClientRect().height));
    const small = [...document.querySelectorAll('#screen *')].filter(e => e.children.length === 0 && e.textContent.trim() && !e.closest('svg')).map(e => parseFloat(getComputedStyle(e).fontSize)).filter(x => x < 13).length;
    return { n: cards.length, stock: R.towns.stock(window.__poi).length, stats: cards.map(c => (c.querySelector('.tw-st') || {}).textContent || ''), chips: cards.filter(c => c.querySelector('.tw-chip')).length,
      buys: cards.map(c => (c.querySelector('[data-buy]') || {}).textContent || ''), pots: document.querySelectorAll('.tw-card.pot').length, prem: [...document.querySelectorAll('.tw-card.prem b')].map(b => b.textContent),
      bal: (document.querySelector('.tw-bal') || {}).textContent, fits: scr.scrollHeight <= vh + 1, sh: scr.scrollHeight, short: btns.filter(h => h < 44).length, small, tabs: [...document.querySelectorAll('.tw-tabs button')].map(b => b.textContent) }; });
  ok('6 gear items of the day, each with the main stat vs the equipped one and a price chip', shop.n === 6 && shop.stock === 6 && shop.chips === 6 && shop.stats.every(s => (/(ATK|DEF|HP|SPD|CRIT) \d+/.test(s) && /[▲▼=]/.test(s)) || /^(Heals|Restores|Material)/.test(s)), shop.n + ' · ' + JSON.stringify(shop.stats) + ' chips ' + shop.chips + ' stock ' + shop.stock);   // a potion in the stock says what it does (G7)
  ok('every item is affordable for a hero with 5000 gold: green BUY', shop.buys.every(t => /^BUY/.test(t)), JSON.stringify(shop.buys));
  ok('two potion cards and the premium row (Rare chest, Legendary roll, +10 bag slots)', shop.pots === 2 && shop.prem.join('|') === 'Rare chest|Legendary roll|+10 bag slots', shop.pots + ' · ' + shop.prem.join('|'));
  ok('the balance row shows gold and gems', /5k|5000/.test(shop.bal) && /500/.test(shop.bal), shop.bal);
  ok('the whole shop fits one 844-px glance, no button under 44 px, no text under 13 px', shop.fits && shop.short === 0 && shop.small === 0, `h ${shop.sh} short ${shop.short} small ${shop.small}`);
  ok('the three town tabs SHOP · INN · SMITH', shop.tabs.join() === 'SHOP,INN,SMITH', shop.tabs.join());
  await page.screenshot({ path: SC + 'rpg_shop.png' });
  // ---- buy a potion with a real tap
  await tap('[data-buy="p:small"]', 400);
  const pot = await ev(() => ({ gold: R.state.p.gold, hp: R.state.p.potions.hp, toast: !!document.querySelector('.toast'), have: (document.querySelector('.tw-card.pot .tw-nm i') || {}).textContent }));
  ok('a tap on the potion\'s BUY takes 40 gold and adds one to potions.hp', pot.gold === 4960 && pot.hp === 3 && /Have 3/.test(pot.have), JSON.stringify(pot));
  // ---- a poor hero: Need N more
  await ev(() => { R.state.p.gold = 10; R.ui.open('shop', window.__poi); });
  const poor = await ev(() => { const b = document.querySelector('.tw-card.gear [data-buy]'), it = R.towns.stock(window.__poi)[0]; const p = document.querySelector('[data-buy="p:small"]');
    return { txt: b.textContent.trim(), dis: b.disabled, cls: b.className, price: R.towns.price(it), pot: p.textContent.trim(), pdis: p.disabled, prem: document.querySelector('[data-buy="x:leg"]').textContent.trim() }; });
  ok('an item he cannot afford is grey, disabled and says Need N more (N = price − gold)', poor.dis && /need/.test(poor.cls) && poor.txt === 'Need ' + (poor.price - 10 >= 10000 ? (poor.price - 10) / 1000 + 'k' : poor.price - 10) + ' more', JSON.stringify(poor));
  ok('the potion says Need 30 more; the Legendary roll (300 gems) is still green with 500 gems', poor.pot === 'Need 30 more' && poor.pdis && /^BUY/.test(poor.prem), poor.pot + ' · ' + poor.prem);
  // ---- buy a gear item: it lands in the bag and the card says SOLD for the day
  await ev(() => { R.state.p.gold = 5000; R.ui.open('shop', window.__poi); });
  const g0 = await ev(() => ({ gold: R.state.p.gold, inv: R.state.p.inv.length, price: R.towns.price(R.towns.stock(window.__poi)[0]), id: R.towns.stock(window.__poi)[0].id }));
  await tap('[data-buy="g:0"]', 400);
  const g1 = await ev(() => ({ gold: R.state.p.gold, inv: R.state.p.inv.length, last: R.state.p.inv[R.state.p.inv.length - 1].id, card: document.querySelector('.tw-card.gear[data-i="0"] button').textContent.trim(), sold: (R.state.p.flags.shopSold || {}) }));
  ok('a tap on a gear BUY takes its price, puts the item in the bag and marks the card SOLD', g1.gold === g0.gold - g0.price && g1.inv === g0.inv + 1 && g1.last === g0.id && g1.card === 'SOLD', JSON.stringify([g0, g1.gold, g1.inv, g1.card]));
  // ---- premium: the Rare chest for gems
  const c0 = await ev(() => ({ gems: R.state.p.gems, inv: R.state.p.inv.length }));
  await tap('[data-buy="x:chest"]', 200);
  const c1 = await ev(() => ({ gems: R.state.p.gems, inv: R.state.p.inv.length, rar: R.state.p.inv[R.state.p.inv.length - 1].rar, flash: !!document.querySelector('.tw-flash') }));
  ok('the Rare chest takes 60 gems and gives an item of rarity ≥ 2 with a flash', c1.gems === c0.gems - 60 && c1.inv === c0.inv + 1 && c1.rar >= 2 && c1.flash, JSON.stringify(c1));
  // ---- SELL tab: one item sold by a tap, "sell all Commons" offered
  await tap('.tw-seg [data-s="sell"]', 300);
  const s0 = await ev(() => { const rows = document.querySelectorAll('.tw-srow').length, it = R.state.p.inv[0]; return { rows, inv: R.state.p.inv.length, gold: R.state.p.gold, price: R.towns.sellPrice(it), id: it.id, all: (document.querySelector('.tw-sellall') || {}).textContent }; });
  ok('the SELL tab lists every bag item with a sell price and offers SELL ALL COMMONS', s0.rows === s0.inv && /SELL ALL COMMONS/.test(s0.all) && /\+\d/.test(s0.all), s0.rows + '/' + s0.inv + ' · ' + s0.all);
  await tap('[data-sell="0"]', 400);
  const s1 = await ev(() => ({ inv: R.state.p.inv.length, gold: R.state.p.gold, first: R.state.p.inv[0].id, rows: document.querySelectorAll('.tw-srow').length }));
  ok('a tap on SELL removes that item and pays its price', s1.inv === s0.inv - 1 && s1.gold === s0.gold + s0.price && s1.first !== s0.id && s1.rows === s1.inv, JSON.stringify([s0.inv, s0.gold, s1]));
  // ---- inside(): the town under the hero's feet, null in the field
  const ins = await ev(() => { const poi = window.__poi; R.player.x = poi.x; R.player.y = poi.y; const a = R.towns.inside(); R.player.x = -99999; R.player.y = -99999; const b = R.towns.inside(); R.player.x = poi.x; R.player.y = poi.y; return { a: a && a.id, b: b && b.id, poi: poi.id }; });
  ok('R.towns.inside() gives the town POI under the hero and null far away', ins.a === ins.poi && ins.b == null, JSON.stringify(ins));
  // ---- the inn: REST heals to full, clears the burn (keeps the shield), takes 20 × 6/5 = 24 gold
  await tap('.tw-tabs [data-t="inn"]', 300);
  const inn0 = await ev(() => ({ cur: R.ui.cur, hp: R.player.hp, cost: R.towns.restCost(), gold: R.state.p.gold, rest: document.querySelector('.tw-rest').textContent.trim(), rum: (document.querySelector('.tw-rumour') || {}).textContent, home: !!document.querySelector('.tw-home'), ail: (document.querySelectorAll('.tw-vrow b')[1] || {}).textContent }));
  ok('the INN tab opens the inn: the innkeep\'s rumour, the ailment line, one big REST with its price, no "home" (permadeath)', inn0.cur === 'inn' && inn0.rum.length > 20 && /^REST · 24 gold$/.test(inn0.rest) && inn0.cost === 24 && !inn0.home && /Burn/.test(inn0.ail), JSON.stringify(inn0));
  await tap('.tw-rest', 400);
  const inn1 = await ev(() => ({ hp: R.player.hp, max: R.player.hpMax, gold: R.state.p.gold, st: Object.keys(R.player.status), rest: document.querySelector('.tw-rest').textContent.trim(), bar: (document.querySelector('.tw-bar i') || {}).style.width }));
  ok('a tap on REST heals to full, clears the burn, keeps the shield and takes 24 gold', inn1.hp === inn1.max && inn1.gold === inn0.gold - 24 && inn1.st.join() === 'shield' && /already fresh/.test(inn1.rest) && inn1.bar === '100%', JSON.stringify(inn1));
  const free = await ev(() => { const l = R.state.p.lvl; R.state.p.lvl = 3; const c = R.towns.restCost(); R.state.p.lvl = l; return c; });
  ok('REST is free under level 5', free === 0, String(free));
  await page.screenshot({ path: SC + 'rpg_inn.png' });
  // ---- the smith: pick the equipped sword, UPGRADE takes mats + gold and raises the item; REFORGE rerolls the secondary for 30 gems
  await tap('.tw-tabs [data-t="smith"]', 300);
  await tap('[data-pick="e:weapon"]', 300);
  const sm0 = await ev(() => { const it = R.state.p.gear.weapon, c = R.towns.upgradeCost(it); return { cur: R.ui.cur, up: it.up | 0, lvl: it.lvl, atk: it.stats.atk, mats: R.towns.mats(), gold: R.state.p.gold, c, btn: document.querySelector('.tw-up').textContent.trim(), rows: document.querySelectorAll('.tw-prow').length, on: (document.querySelector('.tw-prow.on') || {}).dataset }; });
  ok('the smith lists the equipped sword + the bag\'s gear; the sword is picked; UPGRADE shows mats + gold', sm0.cur === 'smith' && sm0.rows >= 3 && sm0.on && sm0.on.pick === 'e:weapon' && /^UPGRADE \+1/.test(sm0.btn) && sm0.c.mats >= 1 && sm0.c.gold > 0 && sm0.mats === 3, JSON.stringify(sm0));
  await tap('.tw-up', 150);
  const sm1 = await ev(() => { const it = R.state.p.gear.weapon; return { up: it.up | 0, lvl: it.lvl, atk: it.stats.atk, mats: R.towns.mats(), gold: R.state.p.gold, flash: !!document.querySelector('.tw-flash'), btn: document.querySelector('.tw-up').textContent.trim(), name: document.querySelector('.tw-fhead b').textContent }; });
  ok('a tap on UPGRADE raises the sword to +1 (level and ATK up), takes its mats and the gold, flashes', sm1.up === sm0.up + 1 && sm1.lvl > sm0.lvl && sm1.atk > sm0.atk && sm1.mats === sm0.mats - sm0.c.mats && sm1.gold === sm0.gold - sm0.c.gold && sm1.flash && /\+1$/.test(sm1.name), JSON.stringify(sm1));
  // too few mats for the next step: the button says what is missing and is disabled (the bag is emptied of mats, the tab re-rendered)
  await ev(() => { R.state.p.inv = R.state.p.inv.filter(it => it.kind !== 'mat'); });
  await tap('.tw-tabs [data-t="shop"]', 200); await tap('.tw-tabs [data-t="smith"]', 300); await tap('[data-pick="e:weapon"]', 300);
  const sm2 = await ev(() => ({ btn: document.querySelector('.tw-up').textContent.trim(), dis: document.querySelector('.tw-up').disabled, mats: R.towns.mats(), need: R.towns.upgradeCost(R.state.p.gear.weapon).mats }));
  ok('without the mats the next step says what is missing and is disabled', sm2.dis && sm2.btn === 'Need ' + sm2.need + ' more mats' && sm2.mats === 0 && sm2.need >= 1, JSON.stringify(sm2));
  const rf0 = await ev(() => { const it = R.state.p.gear.weapon; return { gems: R.state.p.gems, sec: JSON.stringify(Object.entries(it.stats).filter(([k]) => k !== 'atk')), btn: document.querySelector('.tw-ref').textContent.trim() }; });
  await tap('.tw-ref', 400);
  const rf1 = await ev(() => { const it = R.state.p.gear.weapon; return { gems: R.state.p.gems, sec: JSON.stringify(Object.entries(it.stats).filter(([k]) => k !== 'atk')), atk: it.stats.atk, n: Object.keys(it.stats).length }; });
  ok('REFORGE takes 30 gems and changes the secondary stat, the main stat untouched', /REFORGE/.test(rf0.btn) && rf1.gems === rf0.gems - 30 && rf1.sec !== rf0.sec && rf1.sec !== '[]' && rf1.atk === sm1.atk && rf1.n === 2, JSON.stringify([rf0, rf1]));
  await page.screenshot({ path: SC + 'rpg_smith.png' });
  // ---- back closes; the HUD's TOWN button can open 'town' without a poi
  await tap('.tw-back', 200);
  const closed = await ev(() => { const a = R.ui.cur; R.ui.open('town'); const b = R.ui.cur, name = (document.querySelector('.tw-title b') || {}).textContent; R.ui.close(); return { a, b, name }; });
  ok('the back arrow closes the screen; R.ui.open("town") with no poi uses the town under the hero', closed.a === null && closed.b === 'town' && closed.name.length > 0, JSON.stringify(closed));
  // ---- the stock is the same within a day and seeded by the POI
  const det = await ev(() => { const a = R.towns.stock(window.__poi).map(i => i.id).join(), b = R.towns.stock(window.__poi).map(i => i.id).join(), c = R.towns.stock({ id: 'other', name: 'Other', shop: true }).map(i => i.id).join(); return { same: a === b, diff: a !== c }; });
  ok('the stock of the day is stable for a POI and differs between POIs', det.same && det.diff, JSON.stringify(det));
  ok('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  console.log(out.join('\n')); console.log(bad ? `${bad} FAIL` : 'ALL OK'); console.log('shots:', SC + 'rpg_shop.png', SC + 'rpg_inn.png', SC + 'rpg_smith.png');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
