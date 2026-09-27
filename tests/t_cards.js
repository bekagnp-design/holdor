// Cards (v1.0.48): needs, chests, level-ups with cards + gold, account XP and level chests, spell levels, deals, migration, first-win cards.
const { chromium } = require('playwright');
const SC = __dirname + '/rv/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::|supabase/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CARDS, { timeout: 20000 }); await page.waitForTimeout(300);
  const out = {};
  const ALL = 'a.learn={glass:1,keep:1,tier2:1,fire:1,reinf:1,scorp:1,wild:1,weir:1,tier3:1,tier4:1,tier5:1,gates:1,big:1,chest:1,hold:1,champ:1};a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};';
  // 1. a stage-12 player: pool, needs, chest rolls
  out.pool = await page.evaluate((ALL) => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.copen = { jon: 1 }; a.sel = 'jon'; eval(ALL); for (let i = 1; i <= 12; i++) a.campaign[i] = 2; a.sel = 'jon'; H.setAcc(a); H.persist();
    const pool = C.cardPool(); const rar = {}; pool.forEach(k => rar[k] = C.cardRar(k));
    return { n: pool.length, rar, need: { jon1: C.cardNeed('c:jon', 1), jon10: C.cardNeed('c:jon', 10), weir1: C.cardNeed('t:weir', 1), fire1: C.cardNeed('s:fire', 1), arrows1: C.cardNeed('s:arrows', 1) }, gold: { jon1: C.cardGold('c:jon', 1), watch1: C.cardGold('t:watch', 1), fire1: C.cardGold('s:fire', 1) } }; }, ALL);
  out.chests = await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; const res = {}; for (const t of ['wood', 'iron', 'valyrian', 'dragon']) { const r = C.rollChest(t); res[t] = r.map(x => x.k === 'card' ? `${x.key}×${x.cnt}(r${x.r})` : x.k + x.s); } return { res, cards: Object.assign({}, H.ACC.cards) }; });
  // rare gating over many rolls: iron's 2nd stack always rare+, dragon's stacks r>=1,2,3 when available
  out.gating = await page.evaluate(() => { const C = window.HOLDOR_CARDS; let bad = 0, n = 0; for (let i = 0; i < 40; i++) { const r = C.rollChest('dragon').filter(x => x.k === 'card'); n++; if (r.length < 4) bad++; if (r[0] && r[0].r < 1) bad++; if (r[1] && r[1].r < 2) bad++; } return { rolls: n, bad }; });
  // 2. level-ups: not without cards; with cards + gold; XP and level chests
  out.lvl = await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS, A = H.ACC; A.cards = {}; A.gold = 5000; A.axp = 0; A.lvlChests = 0;
    const r = {}; r.noCards = C.cardLevelUp('c:jon'); A.cards['c:jon'] = C.cardNeed('c:jon'); const g0 = A.gold; r.withCards = C.cardLevelUp('c:jon'); r.jonLvl = H.cprog(null, 'jon').lvl; r.goldSpent = g0 - A.gold; r.cardsLeft = A.cards['c:jon']; r.xp = A.axp;
    A.cards['t:watch'] = 999; let k = 0; while (C.cardLevelUp('t:watch')) k++; r.watchUps = k; r.watchLvl = H.ACC.tlv.watch; r.watchCardsLeft = A.cards['t:watch'];
    A.cards['s:fire'] = 999; k = 0; while (C.cardLevelUp('s:fire')) k++; r.fireUps = k; r.fireLvl = C.spellLvl('fire'); r.fireMul = C.spellMul('fire');
    r.acc = C.accLevel(); r.lvlChests = C.lvlChestsReady(); r.tier2 = C.lvlChestTier(2); r.tier5 = C.lvlChestTier(5); r.tier10 = C.lvlChestTier(10); r.gold = A.gold; return r; });
  // 3. the hero room and the tower room through real taps
  await page.evaluate(() => { const H = window.HOLDOR, A = H.ACC; A.cards = { 'c:jon': 0 }; A.gold = 3000; H.showHeroRoom('jon'); });
  await page.waitForTimeout(300);
  out.heroRoom0 = await page.evaluate(() => { const b = document.querySelector('#clist button[data-a="lvl"]'); return { txt: b.textContent, dis: b.disabled, line: (document.querySelector('.cardline') || {}).textContent }; });
  await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; H.ACC.cards['c:jon'] = C.cardNeed('c:jon'); H.showHeroRoom('jon'); });
  await page.waitForTimeout(300); await page.screenshot({ path: SC + 'c_hero.png' });
  out.heroRoom1 = await page.evaluate(() => { const b = document.querySelector('#clist button[data-a="lvl"]'); return { txt: b.textContent, dis: b.disabled }; });
  const bb = await page.locator('#clist button[data-a="lvl"]').boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(400);
  out.heroRoom2 = await page.evaluate(() => ({ lvl: window.HOLDOR.cprog(null, 'jon').lvl, cards: window.HOLDOR.ACC.cards['c:jon'], btn: document.querySelector('#clist button[data-a="lvl"]').textContent }));
  await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; H.ACC.cards['t:keep'] = C.cardNeed('t:keep'); window.HOLDOR_CARDS.showTowerRoom('keep'); }); await page.waitForTimeout(300); await page.screenshot({ path: SC + 'c_tower.png' });
  const tb = await page.locator('#clist button[data-a="tl"]').boundingBox(); await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.waitForTimeout(400);
  out.towerRoom = await page.evaluate(() => ({ lvl: window.HOLDOR.ACC.tlv.keep, cards: window.HOLDOR.ACC.cards['t:keep'] }));
  await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; H.ACC.cards['s:arrows'] = C.cardNeed('s:arrows'); C.showSpellRoom('arrows'); }); await page.waitForTimeout(300); await page.screenshot({ path: SC + 'c_spell.png' });
  const sb = await page.locator('#clist button[data-a="sl"]').boundingBox(); await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.waitForTimeout(400);
  out.spellRoom = await page.evaluate(() => ({ lvl: window.HOLDOR_CARDS.spellLvl('arrows'), cards: window.HOLDOR.ACC.cards['s:arrows'], line: document.querySelector('#clist .lvbox').textContent.slice(0, 90) }));
  // 4. collection cards with bars, spells tab, level chest row on the battle tab
  await page.evaluate(() => window.HOLDOR.showHub('coll', 'heroes')); await page.waitForTimeout(400); await page.screenshot({ path: SC + 'c_coll.png' });
  out.coll = await page.evaluate(() => ({ bars: document.querySelectorAll('.ccard .cb').length, up: document.querySelectorAll('.ccard .upb').length, first: document.querySelector('.ccard .cb em').textContent }));
  await page.evaluate(() => window.HOLDOR.showHub('coll', 'spells')); await page.waitForTimeout(400); await page.screenshot({ path: SC + 'c_spells.png' });
  out.spells = await page.evaluate(() => [...document.querySelectorAll('.ccard[data-s]')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(500); await page.screenshot({ path: SC + 'c_battle.png' });
  out.battle = await page.evaluate(() => ({ lvlRow: (document.querySelector('.chestrow.lvl em') || {}).textContent, ready: window.HOLDOR_CARDS.lvlChestsReady(), lvl: document.querySelector('.hubtop .lv').textContent }));
  const lc = await page.locator('#lvlChest').boundingBox(); await page.touchscreen.tap(lc.x + lc.width / 2, lc.y + lc.height / 2); await page.waitForTimeout(500);
  await page.locator('#cch').click({ force: true }); await page.waitForTimeout(5500); await page.screenshot({ path: SC + 'c_chest.png' });
  out.ceremony = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#cer .rcard.sm')].map(c => c.textContent.replace(/\s+/g, ' ').trim()), collect: document.querySelector('#ccol').classList.contains('in') }));
  await page.locator('#ccol').click({ force: true }); await page.waitForTimeout(500);
  out.afterChest = await page.evaluate(() => ({ ready: window.HOLDOR_CARDS.lvlChestsReady(), claimed: window.HOLDOR.ACC.lvlChests, row: !!document.querySelector('.chestrow.lvl') }));
  // 5. deals sell cards
  out.deals = await page.evaluate(() => { const H = window.HOLDOR; const d = H.genDeals(); const i = d.findIndex(x => x.k === 'cards'); if (i < 0) return { none: d.map(x => x.k) }; const before = (H.ACC.cards[d[i].key] || 0); H.ACC.gold = 9999; H.ACC.deals = null; const ok = H.buyDeal(i); return { kind: d[i].k, name: d[i].n, s: d[i].s, price: d[i].price, ok, gained: (H.ACC.cards[d[i].key] || 0) - before, cnt: d[i].cnt }; });
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(400); await page.screenshot({ path: SC + 'c_shop.png' });
  // 6. first-time stage win pays cards
  out.win = await page.evaluate(() => { const H = window.HOLDOR, G0 = H.G; H.startGame({ mode: 'campaign', level: H.LEVELS[12] }); const G = H.G; G.doorHp = G.doorMax; const before = JSON.stringify(H.ACC.cards); H.victory(); return { reward: G.cardReward, changed: JSON.stringify(H.ACC.cards) !== before, txt: (document.body.textContent.match(/\+\d+ [A-Za-z ]+ cards?/) || [])[0] }; });
  await page.screenshot({ path: SC + 'c_win.png' });
  // 7. an old save migrates: XP from the levels bought, one level chest waiting, tours from the old flag
  out.migr = await page.evaluate(() => { const H = window.HOLDOR, C = window.HOLDOR_CARDS; const a = H.newAccount('lannister', 0, 'squire'); delete a.lv48; delete a.cards; delete a.slv; delete a.axp; delete a.tours; a.tut = 1; a.tour = 1; a.xpBonus = 120; a.champs = { jaime: { lvl: 8, sk: [3, 2, 1], tal: 0 } }; a.tlv = { watch: 5, keep: 3 }; a.upg = { leather: 1 }; C.migrate48(a); return { axp: a.axp, lvl: C.accLevel(a).l, lvlChests: a.lvlChests, tours: a.tours, xpBonus: a.xpBonus, cards: a.cards }; });
  console.log(JSON.stringify(out, null, 1)); console.log('ERR', errors); await browser.close();
})();
