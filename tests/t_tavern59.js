// v1.0.59: the tavern for a guest (local rules) — five rarities, the star cap, raising a star by burning cards,
// skill ranks paid with books, books in chests and deals, the summon portal, the rarity bonus in battle. Real taps.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TAVERN, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(250); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = { chest: 1 };
    for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.gold = 60000; a.gems = 1000; a.sel = 'robb'; a.champs.robb = { lvl: 9, sk: [1, 1, 1], tal: 0 };
    a.cards = { 'c:robb': 200, 'c:brienne': 15, 'c:sansa': 30, 'b:c': 2 }; H.setAcc(a); H.persist(); });
  const T = await page.evaluate(() => { const T = window.HOLDOR_TAVERN, C = window.HOLDOR_CH52.CBY; return { rar: ['brienne', 'robb', 'bran', 'sansa', 'ned', 'arya', 'jon'].map(id => T.champRar(C[id])), stat: T.RAR_STAT }; });
  ok('rarity by opening order', JSON.stringify(T.rar) === '[0,0,1,2,2,3,4]', JSON.stringify(T.rar));
  // levels up to the star's cap, then the star box
  await page.evaluate(() => window.HOLDOR_TAVERN.showHeroRoom('robb')); await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { const b = await page.$('#clist button[data-a="lvl"]:not([disabled])'); if (b) await tap('#clist button[data-a="lvl"]'); }
  const s1 = await page.evaluate(() => ({ lvl: window.HOLDOR.cprog(null, 'robb').lvl, box: !!document.querySelector('.ascbox'), fods: [...document.querySelectorAll('.fod')].map(b => b.dataset.f + ':' + b.textContent) }));
  ok('★1 stops at 10 and shows the star box', s1.lvl === 10 && s1.box, JSON.stringify(s1));
  await page.screenshot({ path: SC + 'tv59_asc.png' });
  // Brienne has 15 of 20: short; Sansa (Rare) 30 of 10: picked
  const pick = await page.evaluate(() => document.querySelector('.ascgo').dataset.f);
  ok('the burn picks a champion with enough cards (Sansa, a Rare: 10 needed)', pick === 'sansa', pick);
  const g0 = await page.evaluate(() => window.HOLDOR.ACC.gold);
  await tap('.ascgo');
  const s2 = await page.evaluate(() => ({ st: window.HOLDOR_TAVERN.cstar('robb'), sansa: window.HOLDOR.ACC.cards['c:sansa'], gold: window.HOLDOR.ACC.gold, cap: window.HOLDOR_TAVERN.champCap('robb') }));
  ok('★2: 10 Sansa cards burnt, 1500 gold, cap 20', s2.st === 2 && s2.sansa === 20 && g0 - s2.gold === 1500 && s2.cap === 20, JSON.stringify(s2));
  await tap('#clist button[data-a="lvl"]');
  ok('level 11 after the star', await page.evaluate(() => window.HOLDOR.cprog(null, 'robb').lvl) === 11);
  // skills: two Common books → rank 2 → rank 3; the third needs 2 more
  for (let i = 0; i < 3; i++) await tap('#clist button[data-a="sk"][data-i="0"]');
  const s3 = await page.evaluate(() => ({ rank: window.HOLDOR.cprog(null, 'robb').sk[0], books: window.HOLDOR.ACC.cards['b:c'], dis: document.querySelector('#clist button[data-a="sk"][data-i="0"]').disabled }));
  ok('books: rank 3, none left, the next is locked', s3.rank === 3 && s3.books === 0 && s3.dis, JSON.stringify(s3));
  // the rarity lifts the champion in battle: Jon (Legendary) +20% over the same level without it
  const b = await page.evaluate(() => { const H = window.HOLDOR, T = window.HOLDOR_TAVERN; H.ACC.copen = { jon: 1 }; H.ACC.sel = 'jon'; H.ACC.champs.jon = { lvl: 5, sk: [1, 1, 1], tal: 0 }; const h = H.makeHero(); const base = window.HOLDOR_CH52.HERO_BASE('melee'); H.ACC.sel = 'robb'; return { hp: h.max, exp: Math.round(base.hp * 1.2 * 1.2 * (H.ACC.upg.training ? 1.18 : 1)) }; });
  ok('Legendary: +20% base', b.hp === b.exp, JSON.stringify(b));
  // the portal (guest: rolled here)
  await page.evaluate(() => window.HOLDOR_TAVERN.showHeroRoom('robb')); await page.waitForTimeout(300);
  const gm = await page.evaluate(() => window.HOLDOR.ACC.gems);
  await tap('.tvsum button[data-a="s10"]');
  const s4 = await page.evaluate(() => ({ gems: window.HOLDOR.ACC.gems, n: document.querySelectorAll('#ecoModal .smc').length }));
  ok('ten summons: 540 dragonglass, ten cards shown', gm - s4.gems === 540 && s4.n === 10, JSON.stringify(s4));
  await page.screenshot({ path: SC + 'tv59_summon.png' });
  await tap('#ecoModal button');
  // a dragon chest always brings 3 Common, 2 Rare, 1 Epic books
  const s5 = await page.evaluate(() => { const H = window.HOLDOR; const b0 = Object.assign({}, H.ACC.cards); const r = H.rollChest('dragon'); return { r: r && r.filter(x => x.key && x.key[0] === 'b').map(x => x.key + ':' + x.cnt), c: (H.ACC.cards['b:c'] || 0) - (b0['b:c'] || 0), rr: (H.ACC.cards['b:r'] || 0) - (b0['b:r'] || 0), e: (H.ACC.cards['b:e'] || 0) - (b0['b:e'] || 0) }; });
  ok('dragon chest books', s5.c === 3 && s5.rr === 2 && s5.e === 1, JSON.stringify(s5));
  // the collection shows stars and the Tavern button sits beside the Forge
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(400);
  ok('Tavern button', await page.evaluate(() => !!document.querySelector('#bTavern')));
  await tap('#bTavern'); await page.waitForTimeout(300);
  ok('it opens the tavern', /Tavern/.test(await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 40))));
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
