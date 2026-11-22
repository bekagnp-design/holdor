// HOLDOR RPG — the character sheet + inventory (A16): the bag button opens it, 12 cells, tapping an item shows EQUIP,
// EQUIP moves it to its slot (a worse one says "EQUIP (−N atk)" quietly), SELL adds the shown gold, USE drinks a potion,
// + spends a stat point, AUTO spends the rest, SORT cycles, SELL COMMONS asks first. Real taps. Screenshots → .shots/rpg_inv*.png
// Run: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_inventory.js   (after python3 src/build_rpg.py beta/index.html)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const HTML = 'file://' + path.resolve(ROOT, process.env.HOLDOR_HTML || 'beta/index.html');
const mk = (id, kind, name, rar, lvl, stats) => ({ id, kind, name, rar, lvl, stats });
const ITEMS = [
  mk('w0', 'weapon', 'Rusty sword', 0, 2, { atk: 6 }), mk('w1', 'weapon', 'Castle steel blade', 2, 7, { atk: 14, crit: 3 }),
  mk('w2', 'weapon', 'Winterfang blade', 4, 9, { atk: 22, crit: 8, spd: 5 }), mk('w3', 'weapon', 'Hunting spear', 1, 5, { atk: 9, spd: 4 }),
  mk('a0', 'armor', 'Padded jerkin', 0, 2, { def: 3, hp: 20 }), mk('a1', 'armor', 'Boiled leather', 1, 6, { def: 7, hp: 45 }), mk('a2', 'armor', 'Northern plate', 3, 8, { def: 13, hp: 90 }),
  mk('t0', 'trinket', 'Bone charm', 0, 3, { hp: 30 }), mk('t1', 'trinket', 'Direwolf fang', 2, 7, { crit: 6, atk: 3 }),
  mk('p0', 'potion', 'Poppy draught', 1, 1, { hp: 120 }), mk('p1', 'potion', 'Healing draught', 0, 1, { hp: 60 }), mk('m0', 'mat', 'Dragonglass shard', 2, 1, {})];
ITEMS[2].nw = 1; ITEMS[8].nw = 1; // picked up since the bag was last opened
const SAVE = { v: 2, acc: { house: 'stark', champs: { jon: { unlocked: 1, runs: 1 } }, hall: [], titles: ['Oathkeeper'], title: 'Oathkeeper', ach: [], world: { found: [], flags: {}, quests: {}, bosses: {}, killed: {} }, best: { lvl: 7, kills: 40 } },
  p: { hero: 'jon', name: 'Jon', house: 'stark', cls: 'knight', lvl: 7, xp: 120, hp: 150, gold: 250, gems: 3, pos: { x: 3000, y: 6000 }, stats: { str: 9, agi: 6, int: 5, vit: 8 }, pts: 3, skills: {}, spts: 0, bar: [null, null, null], gear: {}, inv: ITEMS, potions: { hp: 3, mana: 0 }, flags: {}, created: 1, played: 0 },
  wallet: { imported: false }, opts: { sfx: 0, haptic: 0, lang: 'en' } };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.addInitScript(s => { try { localStorage.setItem('holdor_rpg', JSON.stringify(s)); } catch (e) {} }, SAVE);
  await page.goto(HTML);
  await page.waitForFunction(() => window.R && R.screens && R.screens.inv && R.bus && R.ui, { timeout: 20000 }); await page.waitForTimeout(700);
  const T = {}; let fail = 0; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) fail++; };
  // the save: the boot loaded it when present; else load it here. Whatever screen the boot opened (intro, …) goes away.
  await page.evaluate(() => { if (!R.state) R.load(); if (R.ui.cur) R.ui.close(); if (!R.state.p.inv || R.state.p.inv.length !== 12) { /* a boot that migrated the save: put the twelve back */ } });
  const P = () => page.evaluate(() => { const p = R.state.p; return { inv: p.inv.map(i => i.id), gold: p.gold, pts: p.pts, str: p.stats.str, gear: Object.fromEntries(Object.entries(p.gear || {}).map(([k, v]) => [k, v && v.id])), hp: p.hp, newN: R.inv.newCount() }; });
  const s0 = await P(); ok('save has 12 items', s0.inv.length === 12, JSON.stringify(s0.inv));
  // 1. the bag button opens the sheet
  await page.evaluate(() => R.bus.emit('btn', 'inv')); await page.waitForTimeout(250);
  ok('bag button opens inv', await page.evaluate(() => R.ui.cur === 'inv' && document.querySelector('#screen.on[data-screen="inv"] .inv') != null && R.paused === true));
  ok('12 cells', await page.$$eval('.inv .grid .ic', a => a.length) === 12);
  ok('header: name, title, level, class, house', await page.evaluate(() => { const t = document.querySelector('.inv .hd').textContent; return /Jon/.test(t) && /Oathkeeper/.test(t) && /LV 7/.test(t) && /KNIGHT/.test(t) && /STARK/.test(t) && document.querySelector('.inv .por') != null; }));
  ok('three gear slots + five stats', await page.evaluate(() => document.querySelectorAll('.inv .gear .slot').length === 3 && document.querySelectorAll('.inv .stats > div').length === 5 && /ATK.*DEF.*HP.*CRIT.*SPD/.test(document.querySelector('.inv .stats').textContent)));
  ok('NEW dots on the two fresh items', await page.$$eval('.inv .ic .nd', a => a.length) === 2 && s0.newN === 2);
  ok('rarity frames + level badges', await page.evaluate(() => { const c = document.querySelector('.inv .ic[data-id="w2"]'); return c && c.style.borderColor && c.querySelector('.il').textContent === '9' && document.querySelector('.inv .ic[data-id="w0"]').style.borderColor !== c.style.borderColor; }));
  ok('targets >= 44px', await page.evaluate(() => [...document.querySelectorAll('.inv .ic, .inv .slot, .inv .pts button, .inv .tb button, .inv .x')].every(e => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
  ok('stat points row (3 pts)', await page.evaluate(() => document.querySelectorAll('.inv .pts button[data-act="pt"]').length === 4 && document.querySelector('.inv .pts .auto') != null && /3/.test(document.querySelector('.inv .pts .pl').textContent)));
  // 2. tap an item → the sheet shows EQUIP (the slot is empty, so it is green)
  await page.tap('.inv .ic[data-id="w1"]'); await page.waitForTimeout(250);
  ok('item sheet opens with EQUIP', await page.evaluate(() => { const b = document.querySelector('.inv .sheet button.eq'); return b && b.textContent.trim() === 'EQUIP' && b.classList.contains('pri') && /Castle steel blade/.test(document.querySelector('.inv .sheet .sh-t').textContent) && /SELL/.test(document.querySelector('.inv .sheet .sell').textContent); }));
  await page.screenshot({ path: SC + 'rpg_inv_sheet.png' });
  await page.tap('.inv .sheet button.eq'); await page.waitForTimeout(250);
  let s = await P(); ok('EQUIP moves it to the weapon slot', s.gear.weapon === 'w1' && s.inv.length === 11 && !s.inv.includes('w1'), JSON.stringify(s.gear));
  ok('slot tile shows it', await page.evaluate(() => /Castle steel blade/.test(document.querySelector('.inv .slot[data-slot="weapon"]').textContent) && /\+14 ATK/.test(document.querySelector('.inv .slot[data-slot="weapon"]').textContent)));
  await page.screenshot({ path: SC + 'rpg_inv.png' });
  // 3. a worse weapon: quiet "EQUIP (−8 atk)"
  await page.tap('.inv .ic[data-id="w0"]'); await page.waitForTimeout(200);
  ok('worse item: quiet EQUIP (−8 atk)', await page.evaluate(() => { const b = document.querySelector('.inv .sheet button.eq'); return b && b.textContent.trim() === 'EQUIP (−8 atk)' && !b.classList.contains('pri') && document.querySelector('.inv .sheet .ddn') != null; }), await page.evaluate(() => (document.querySelector('.inv .sheet button.eq') || {}).textContent));
  await page.tap('.inv .sheet .x'); await page.waitForTimeout(150);
  ok('sheet closes', await page.evaluate(() => document.querySelector('.inv .sheet') == null));
  // 4. a better weapon replaces it; the old one returns to the bag
  await page.tap('.inv .ic[data-id="w2"]'); await page.waitForTimeout(200); await page.tap('.inv .sheet button.pri'); await page.waitForTimeout(200);
  s = await P(); ok('better weapon swaps in', s.gear.weapon === 'w2' && s.inv.includes('w1') && s.inv.length === 11);
  // 5. SELL adds the shown gold
  await page.tap('.inv .ic[data-id="m0"]'); await page.waitForTimeout(200);
  const priceTxt = await page.evaluate(() => document.querySelector('.inv .sheet .sell').textContent), price = +(priceTxt.replace(/[^0-9]/g, ''));
  ok('mat sheet: SELL only', price > 0 && await page.evaluate(() => document.querySelector('.inv .sheet button.eq') == null && document.querySelector('.inv .sheet button.use') == null), priceTxt);
  await page.tap('.inv .sheet .sell'); await page.waitForTimeout(200);
  s = await P(); ok('SELL adds gold', s.gold === 250 + price && !s.inv.includes('m0') && s.inv.length === 10, 'gold ' + s.gold + ' price ' + price + ' inv ' + s.inv.join(','));
  ok('gold shown in the toolbar', await page.evaluate(g => document.querySelector('.inv .tb .gold').textContent.replace(/[^0-9]/g, '') === String(g), s.gold));
  // 6. a potion: USE is the primary button
  await page.tap('.inv .ic[data-id="p0"]'); await page.waitForTimeout(200);
  ok('potion sheet: USE primary', await page.evaluate(() => { const b = document.querySelector('.inv .sheet button.pri'); return b && b.textContent.trim() === 'USE'; }));
  await page.tap('.inv .sheet button.pri'); await page.waitForTimeout(200);
  s = await P(); ok('USE drinks it (+hp, never below the old hp)', !s.inv.includes('p0') && s.inv.length === 9 && s.hp > 150, 'hp ' + s.hp);
  // 7. stat points
  await page.tap('.inv .pts button[data-k="str"]'); await page.waitForTimeout(150);
  s = await P(); ok('+ spends a point on STR', s.str === 10 && s.pts === 2, JSON.stringify({ str: s.str, pts: s.pts }));
  await page.tap('.inv .pts .auto'); await page.waitForTimeout(150);
  s = await P(); ok('AUTO spends the rest', s.pts === 0 && await page.evaluate(() => document.querySelector('.inv .pts') == null));
  // 8. sort cycles rarity → level → kind
  const first = async () => page.$$eval('.inv .grid .ic', a => a.slice(0, 3).map(c => c.dataset.id));
  const byRar = await first(); await page.tap('.inv .tb .sort'); await page.waitForTimeout(150);
  ok('SORT → LEVEL', await page.evaluate(() => /LEVEL/.test(document.querySelector('.inv .tb .sort').textContent)) && (await first())[0] === 'a2', JSON.stringify([byRar, await first()]));
  await page.tap('.inv .tb .sort'); await page.waitForTimeout(150);
  ok('SORT → KIND (weapons first)', await page.evaluate(() => /KIND/.test(document.querySelector('.inv .tb .sort').textContent) && [...document.querySelectorAll('.inv .grid .ic')].slice(0, 3).every(c => /^w/.test(c.dataset.id))));
  // 9. sell all Commons asks first (w0, a0, t0 are the Common gear; the Common potion stays)
  await page.tap('.inv .tb .sellc'); await page.waitForTimeout(150);
  ok('SELL COMMONS asks', await page.evaluate(() => /Sell 3 Commons for \d+\?/.test(document.querySelector('.inv .tb').textContent) && document.querySelector('.inv .tb .yes') != null));
  await page.tap('.inv .tb [data-act="sellc-no"]'); await page.waitForTimeout(100);
  ok('NO keeps them', (await P()).inv.length === 9);
  const g1 = (await P()).gold; await page.tap('.inv .tb .sellc'); await page.waitForTimeout(100); await page.tap('.inv .tb .yes'); await page.waitForTimeout(200);
  s = await P(); ok('YES sells the three Commons', s.inv.length === 6 && !s.inv.includes('w0') && !s.inv.includes('a0') && !s.inv.includes('t0') && s.inv.includes('p1') && s.gold > g1, JSON.stringify(s.inv));
  // 10. an equipped item can be unequipped from its slot; close clears the NEW dots; the bag button toggles
  await page.tap('.inv .slot[data-slot="weapon"]'); await page.waitForTimeout(150);
  ok('slot sheet: UNEQUIP', await page.evaluate(() => { const b = document.querySelector('.inv .sheet button.eq'); return b && b.textContent.trim() === 'UNEQUIP'; }));
  await page.tap('.inv .sheet button.eq'); await page.waitForTimeout(150);
  s = await P(); ok('UNEQUIP returns it', !s.gear.weapon && s.inv.includes('w2') && s.inv.length === 7);
  await page.tap('.inv .hd .x'); await page.waitForTimeout(150);
  ok('close clears NEW + unpauses', await page.evaluate(() => R.ui.cur === null && R.inv.newCount() === 0 && R.paused === false));
  await page.evaluate(() => R.bus.emit('btn', 'inv')); await page.waitForTimeout(100); await page.evaluate(() => R.bus.emit('btn', 'inv')); await page.waitForTimeout(100);
  ok('bag button toggles', await page.evaluate(() => R.ui.cur === null));
  ok('saved', await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('holdor_rpg')); return s && s.p.inv.length === 7 && s.p.stats.str >= 10; }));
  ok('no page errors', !errors.length, errors.slice(0, 3).join(' || '));
  for (const k in T) console.log(T[k].startsWith('OK') ? 'OK   ' + k : 'FAIL ' + k + ' — ' + T[k].slice(5));
  console.log('screenshots:', SC + 'rpg_inv.png', SC + 'rpg_inv_sheet.png');
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL (crash)', e); process.exit(1); });
