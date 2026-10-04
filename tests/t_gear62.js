// v1.0.62 gear II without a server: the set maths (quads, pairs and triples that repeat, the two collection bonuses, the caps), what the four
// new stats do in battle (armor, lifesteal, regeneration, crit), and the forge screens (bonus block, set book, tier sheet, burn picker).
// The gear config is read from backend/holdor_v11.sql, so the client and the server agree by construction.
const { chromium } = require('playwright');
const fs = require('fs');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const sql = fs.readFileSync(require('path').resolve(__dirname, '..', 'backend', 'holdor_v11.sql'), 'utf8');
const CFG = JSON.parse(/insert into econ_config \(k, v\) values \('gear', '(\{[\s\S]*?\})'::jsonb\) on conflict/.exec(sql)[1]);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GEAR && window.HOLDOR_GEAR.gearTestBag, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  let n = 0;
  const mk = (slot, set, o = {}) => ({ id: (n++ % 200).toString(16).padStart(2, '0') + 'ab' + n, slot, r: o.r ?? 0, tier: o.tier ?? 1, cap: (o.tier ?? 1) * 4, set, lvl: o.lvl ?? 0, champ: o.champ === undefined ? 'jon' : o.champ, main: o.main || { k: 'dmg', v: 0 }, subs: o.subs || [] });
  const stats = (items) => page.evaluate(([items, cfg]) => { const G = window.HOLDOR_GEAR; G.gearTestBag(items, cfg); return { s: G.gearStats('jon'), e: G.gearEff('jon') }; }, [items, CFG]);
  const SL = ['weapon', 'offhand', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet', 'banner'];
  // ---- sets ----
  let r = await stats([mk('weapon', 'wolf'), mk('helmet', 'wolf')]); ok('a quad set: 2 pieces give the 2-piece bonus (Direwolf +8% health)', r.s.hp === 8 && r.s.dmg === 0, JSON.stringify(r.s));
  r = await stats([mk('weapon', 'wolf'), mk('helmet', 'wolf'), mk('armor', 'wolf')]); ok('3 pieces of a quad: still only the 2-piece bonus', r.s.hp === 8 && r.s.dmg === 0);
  r = await stats(['weapon', 'helmet', 'armor', 'boots'].map(x => mk(x, 'wolf'))); ok('4 pieces: both bonuses (health +8, damage +12)', r.s.hp === 8 && r.s.dmg === 12, JSON.stringify(r.s));
  r = await stats(['weapon', 'helmet'].map(x => mk(x, 'stag'))); ok('a pair set: +10% health', r.s.hp === 10);
  r = await stats(['weapon', 'helmet', 'armor', 'boots'].map(x => mk(x, 'stag'))); ok('a pair set repeats: 4 pieces = two pairs = +20%', r.s.hp === 20);
  r = await stats(['weapon', 'helmet', 'armor'].map(x => mk(x, 'stag'))); ok('3 pieces of a pair set: one pair only', r.s.hp === 10);
  r = await stats(['weapon', 'helmet', 'armor'].map(x => mk(x, 'wall'))); ok('a triple set: armor +14, health +6', r.s.armor === 14 && r.s.hp === 6, JSON.stringify(r.s));
  r = await stats(SL.slice(0, 6).map(x => mk(x, 'wall'))); ok('a triple set repeats: 6 pieces = armor +28, health +12', r.s.armor === 28 && r.s.hp === 12);
  r = await stats(['ring', 'amulet', 'banner'].map(x => mk(x, 'blood')));  ok('Blood (triple): lifesteal +8', r.s.lifesteal === 8);
  r = await stats(['weapon', 'gloves'].map(x => mk(x, 'sun')).concat(['ring', 'banner'].map(x => mk(x, 'rose')))); ok('two different pairs both count (crit +6, regeneration +3)', r.s.crit === 6 && r.s.regen === 3, JSON.stringify(r.s));
  r = await stats([mk('weapon', 'wolf', { champ: 'arya' }), mk('helmet', 'wolf', { champ: 'arya' })]); ok('items on another champion do not count', r.s.hp === 0);
  // ---- collections ----
  r = await stats([0, 1, 2, 3, 4].map(k => mk(SL[k], ['stag', 'rose', 'sun', 'anvil', 'raven'][k], { r: k }))); ok('Rainbow: one item of each of the 5 rarities = damage +6, health +6, armor +5', r.s.dmg === 6 && r.s.hp === 6 && r.s.armor === 5, JSON.stringify(r.s));
  r = await stats([0, 1, 2, 3].map(k => mk(SL[k], ['stag', 'rose', 'sun', 'anvil'][k], { r: k }))); ok('four rarities: no Rainbow', r.s.dmg === 0 && r.s.armor === 0);
  const nine = SL.map((x, i) => mk(x, ['stag', 'rose', 'sun', 'anvil', 'raven', 'hunt', 'blood', 'wall', 'kraken'][i]));
  r = await stats(nine); ok('Full kit: all nine slots = damage +4, health +4, regeneration +2, armor +3', r.s.dmg === 4 && r.s.hp === 4 && r.s.regen === 2 && r.s.armor === 3, JSON.stringify(r.s));
  // ---- caps and main values ----
  r = await stats([mk('armor', 'wolf', { main: { k: 'armor', v: 45 }, subs: [{ k: 'armor', v: 30 }, { k: 'crit', v: 90 }, { k: 'lifesteal', v: 60 }, { k: 'regen', v: 50 }] })]);
  ok('the effective numbers stop at the caps (armor 60, crit 60, lifesteal 40, regeneration 30)', r.e.armor === 60 && r.e.crit === 60 && r.e.lifesteal === 40 && r.e.regen === 30 && r.s.armor === 75, JSON.stringify(r.e));
  // ---- in battle ----
  const B = await page.evaluate(([cfg]) => {
    const H = window.HOLDOR, G = H.G, GX = window.HOLDOR_GEAR, C2 = window.HOLDOR_CH52, C3 = window.HOLDOR_CH53, S = window.HOLDOR_CASTLE; const out = {};
    const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.sel = 'jon'; a.copen = { jon: 1 }; a.champs.jon = { lvl: 10, sk: [1, 1, 1], tal: 0 }; H.setAcc(a);
    const bag = (items) => { GX.gearTestBag(items, cfg); H.startGame({ level: 9 }); G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.allies.length = 0; G.rng = () => 0.99; return G.hero; };
    const it = (slot, main, subs) => ({ id: 'aa' + slot, slot, r: 0, tier: 1, cap: 4, set: 'wolf', lvl: 0, champ: 'jon', main, subs: subs || [] });
    // armor: 40% off every blow
    let h = bag([it('armor', { k: 'armor', v: 40 })]); h.hp = h.max; h.invulnUntil = 0; h.shield = 0; C3.hurtHero(100); out.armor = { lost: Math.round(h.max - h.hp), g: G.gearArmor };
    // lifesteal 20%: a blow of 100 heals 20
    h = bag([it('ring', { k: 'lifesteal', v: 20 })]); h.hp = 50; const e = (S.spawn('sword', 300, 0), G.enemies[G.enemies.length - 1]); e.hp = e.max = 5000; C2.heroHit(e, 100); out.ls = { healed: Math.round(h.hp - 50), g: G.gearLs, dealt: Math.round(5000 - e.hp) };
    // regeneration 20 → 2% of max health a second: 3 s of stepping
    h = bag([it('helmet', { k: 'regen', v: 20 })]); h.hp = 1; h.oocT = 99; const max = h.max; for (let i = 0; i < 180; i++) H.step(); out.regen = { gained: Math.round(h.hp - 1), expect: Math.round(max * 0.02 * 3), g: G.gearRegen };
    // crit 100%: a blow deals triple
    h = bag([it('gloves', { k: 'crit', v: 100 })]); const e2 = (S.spawn('sword', 300, 0), G.enemies[G.enemies.length - 1]); e2.hp = e2.max = 5000; G.rng = () => 0.5; C2.heroHit(e2, 100); out.crit = { dealt: Math.round(5000 - e2.hp), g: G.gearCrit };
    // capped: armor 90 in the bag is 60 in battle
    h = bag([it('armor', { k: 'armor', v: 90 })]); h.hp = h.max; h.invulnUntil = 0; h.shield = 0; C3.hurtHero(100); out.cap = Math.round(h.max - h.hp);
    // no gear: nothing changes
    GX.gearTestBag([], cfg); H.startGame({ level: 9 }); out.none = { a: G.gearArmor, l: G.gearLs, r: G.gearRegen, c: G.gearCrit };
    return out; }, [CFG]);
  ok('armor 40%: a blow of 100 costs 60', B.armor.lost === 60 && B.armor.g === 40, JSON.stringify(B.armor));
  ok('lifesteal 20%: heals a fifth of the damage dealt', B.ls.healed === 20 && B.ls.dealt === 100, JSON.stringify(B.ls));
  ok('regeneration 20: 2% of max health a second', Math.abs(B.regen.gained - B.regen.expect) <= 2 && B.regen.g === 20, JSON.stringify(B.regen));
  ok('crit 100%: triple damage', B.crit.dealt === 300, JSON.stringify(B.crit));
  ok('armor stops at 60% in battle (bag says 90)', B.cap === 40, B.cap);
  ok('a champion without gear starts clean', B.none.a === 0 && B.none.l === 0 && B.none.r === 0 && B.none.c === 0, JSON.stringify(B.none));
  // ---- the screens ----
  await page.evaluate(([cfg, mkS]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; H.setAcc(a);
    const its = [['weapon', 'wolf', 4, 5, 20, 'jon'], ['helmet', 'wolf', 3, 3, 12, 'jon'], ['armor', 'stag', 2, 1, 4, 'jon'], ['boots', 'stag', 1, 1, 0, 'jon'], ['ring', 'blood', 0, 1, 4, null], ['amulet', 'blood', 0, 1, 0, null], ['banner', 'raven', 0, 2, 3, null]]
      .map(([slot, set, r, tier, lvl, champ], i) => ({ id: (16 + i).toString(16) + 'cd' + i, slot, r, tier, cap: tier * 4, set, lvl, champ, main: { k: slot === 'weapon' ? 'dmg' : slot === 'ring' ? 'lifesteal' : 'hp', v: 5 + i }, subs: [{ k: 'crit', v: 2 }, { k: 'armor', v: 3 }] }));
    GX.gearTestBag(its, cfg); GX.showForge('jon'); }, [CFG, null]);
  await page.waitForTimeout(500);
  const F = await page.evaluate(() => ({ slots: document.querySelectorAll('.gslot').length, bag: document.querySelectorAll('.gitem').length, tiers: document.querySelectorAll('.gslot .gtier, .gitem .gtier').length, bn: [...document.querySelectorAll('.gbn')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), stats: [...document.querySelectorAll('.gs')].map(e => e.textContent.trim()) }));
  ok('the forge: 9 slots, the bag, tier stars on every item', F.slots === 9 && F.bag === 3 && F.tiers === 7, JSON.stringify([F.slots, F.bag, F.tiers]));
  ok('the bonus block: Direwolf 2 worn (its 2-piece bonus is on), Stag 2 worn, Rainbow 4/5 rarities, Full kit 4/9', F.bn.some(x => /Direwolf · 2/.test(x) && /2: Health \+8%/.test(x)) && F.bn.some(x => /Stag · 2/.test(x) && /Health \+10%/.test(x)) && F.bn.some(x => /Rainbow · 4\/5/.test(x)) && F.bn.some(x => /Full kit · 4\/9/.test(x)), JSON.stringify(F.bn));
  await page.screenshot({ path: SC + 'gear62_forge.png' });
  await page.locator('#gSets').tap({ force: true }); await page.waitForTimeout(400);
  const SB = await page.evaluate(() => ({ groups: [...document.querySelectorAll('.sbk h4')].map(e => e.textContent), rows: document.querySelectorAll('.sbr').length, on: document.querySelectorAll('.sbr.on').length }));
  ok('the set book: quads, pairs, triples, collections; 12 sets + 2 collections', SB.groups.length === 4 && SB.rows === 14 && SB.on === 2, JSON.stringify(SB));
  await page.screenshot({ path: SC + 'gear62_sets.png' });
  await page.evaluate(() => document.querySelector('#ecoModal button:last-child').click()); await page.waitForTimeout(300);
  await page.evaluate(() => { const it = window.HOLDOR_GEAR.gearItems().find(x => x.slot === 'weapon'); window.HOLDOR_GEAR.gearSheet(it.id, 'jon'); }); await page.waitForTimeout(300);
  const SH = await page.evaluate(() => ({ t: document.querySelector('#ecoModal .eh').textContent.replace(/\s+/g, ' '), btns: [...document.querySelectorAll('#ecoModal button')].map(b => b.textContent.trim()) }));
  ok('a ★5 +20 Legendary weapon: fully forged, no strike, no tier button', /Fully forged: tier 5/.test(SH.t) && !SH.btns.some(b => /Strike|Tier/.test(b)), JSON.stringify(SH));
  await page.evaluate(() => document.querySelector('#ecoModal button:last-child').click()); await page.waitForTimeout(200);
  await page.evaluate(() => { const it = window.HOLDOR_GEAR.gearItems().find(x => x.slot === 'helmet'); window.HOLDOR_GEAR.gearSheet(it.id, 'jon'); }); await page.waitForTimeout(300);
  const SH2 = await page.evaluate(() => ({ t: document.querySelector('#ecoModal .eh').textContent.replace(/\s+/g, ' '), btns: [...document.querySelectorAll('#ecoModal button')].map(b => b.textContent.trim()) }));
  ok('an Epic ★3 +12 helmet (at its cap): a tier button with the price, no strike', SH2.btns.some(b => /^⬆ Tier 4\s*(?:🪙)?\s*\d+/.test(b)) && !SH2.btns.some(b => /Strike/.test(b)) && /At its cap/.test(SH2.t), JSON.stringify(SH2));
  await page.screenshot({ path: SC + 'gear62_sheet.png' });
  const price = await page.evaluate(() => { const G = window.HOLDOR_GEAR; return G.gearTierCost(G.gearItems().find(x => x.slot === 'helmet')); });
  ok('the tier price = 14000 × Epic 3.2 = 44800', price === 44800, price);
  await page.evaluate(() => { const G = window.HOLDOR_GEAR; const it = G.gearItems().find(x => x.slot === 'helmet'); G.gearTierPick(it.id, 'jon'); }); await page.waitForTimeout(300);
  const PK = await page.evaluate(() => ({ t: document.querySelector('#ecoModal .eh').textContent.replace(/\s+/g, ' '), n: document.querySelectorAll('#ecoModal .gpk').length }));
  ok('no other Epic item of ★3+ in the bag: nothing to burn, and it says so', PK.n === 0 && /another\s*Epic item of tier 3 or higher/.test(PK.t), JSON.stringify(PK));
  await page.evaluate(() => document.querySelector('#ecoModal button:last-child').click()); await page.waitForTimeout(200);
  // a Rare ★1 at +4 with two Rare fodders (★1 and ★2) and one Epic that must not be offered
  await page.evaluate(([cfg]) => { const G = window.HOLDOR_GEAR; const base = { champ: null, set: 'wolf', lvl: 0, main: { k: 'hp', v: 5 }, subs: [] };
    G.gearTestBag([Object.assign({ id: 'a1x', slot: 'ring', r: 2, tier: 1, cap: 4 }, base, { lvl: 4 }), Object.assign({ id: 'b2x', slot: 'boots', r: 2, tier: 1, cap: 4 }, base), Object.assign({ id: 'c3x', slot: 'gloves', r: 2, tier: 2, cap: 8 }, base), Object.assign({ id: 'd4x', slot: 'amulet', r: 3, tier: 1, cap: 4 }, base)], cfg);
    G.gearTierPick('a1x', 'jon'); }, [CFG]); await page.waitForTimeout(300);
  const PK2 = await page.evaluate(() => [...document.querySelectorAll('#ecoModal .gpk')].map(b => b.dataset.f));
  ok('the burn picker offers only same-rarity items of the tier or higher (never the item itself, never an Epic)', JSON.stringify(PK2.sort()) === '["b2x","c3x"]', JSON.stringify(PK2));
  await page.screenshot({ path: SC + 'gear62_burn.png' });
  // art sheets: a 3x3 magenta sheet is cut into cells, the magenta turns transparent, items then show the images
  const art = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 300, 300); x.fillStyle = '#336699'; for (let i = 0; i < 9; i++) x.fillRect((i % 3) * 100 + 30, Math.floor(i / 3) * 100 + 30, 40, 40);
    const G = window.HOLDOR_GEAR; G.setGearSheet('kinds1', c.toDataURL()); await new Promise(r => setTimeout(r, 400)); const keys = Object.keys(G.GEAR_ART);
    const im = new Image(); im.src = G.GEAR_ART['weapon:Sword']; await new Promise(r => { im.onload = r; }); const cc = document.createElement('canvas'); cc.width = im.width; cc.height = im.height; const cx = cc.getContext('2d'); cx.drawImage(im, 0, 0);
    return { keys, corner: cx.getImageData(2, 2, 1, 1).data[3], centre: cx.getImageData(50, 50, 1, 1).data[3] }; });
  ok('an art sheet is cut into the 9 items of its grid, magenta becomes transparent', art.keys.length === 9 && art.corner === 0 && art.centre === 255, JSON.stringify(art));
  ok('gifts show their items', await page.evaluate(() => window.HOLDOR_DAILY.rewardChips({ gear: { n: 1, min_r: 3, min_tier: 2 } }).includes('Epic+ ★2+')));
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
