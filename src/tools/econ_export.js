// Every economy number the server needs, read straight out of the built game, so server and client never disagree.
// usage: node src/tools/econ_export.js [out.json]   (default: backend/econ.json; CHROMIUM_PATH like the tests)
// Then: python3 backend/gen_econ_sql.py  →  backend/holdor_econ_data.sql (run in Supabase after holdor_v5.sql).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', '..', process.argv[2] || 'backend/econ.json');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();
  await page.route(/telegram\.org|supabase\.co/, r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', '..', 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_ECON && window.HOLDOR_CARDRULES, { timeout: 30000 });
  const d = await page.evaluate(() => {
    const { ECON, UPG, ACHS, CHEST_TIERS, PACK_ITEMS, ARMY_COST, ARMY_MAX, HOLD_ATTEMPTS, CH_MAX, T_MAX, S_MAX, SK_MAX, SK_CAP, VERSION } = window.HOLDOR_ECON;
    const lv = (f, n) => Array.from({ length: n }, (_, i) => f(i + 1));   // price to go from level i+1 to i+2
    return {
      version: VERSION,
      max: { c: CH_MAX, t: T_MAX, s: S_MAX, sk: SK_MAX, army: ARMY_MAX },
      sk_cap: SK_CAP,
      // prices, level l → l+1 (index 0 = level 1)
      card_gold: { c: lv(ECON.lvlCost, CH_MAX), t: lv(ECON.tCost, T_MAX), s: lv(ECON.sCost, S_MAX) },
      sk_cost: lv(ECON.skCost, SK_MAX),
      army_cost: ARMY_COST,
      upg: Object.fromEntries(UPG.map(u => [u.id, ECON.upgCost(u)])),
      pack: Object.fromEntries(Object.entries(PACK_ITEMS).map(([k, v]) => [k, v.cost])),
      ach: Object.fromEntries(ACHS.map(a => [a.id, a.g])),
      chests: Object.fromEntries(Object.entries(CHEST_TIERS).map(([k, v]) => [k, { gold: v.gold, gems: v.gems, cards: v.cards, price: v.price }])),
      exchange: ECON.exchange, deal_unlock: ECON.unlock,
      hold_attempts: HOLD_ATTEMPTS,
      // card copies (v1.0.58, backend v7): which cards a seat can get, their rarity, copies per level, copies per chest stack
      cards: (() => { const R = window.HOLDOR_CARDRULES; return {
        champs: Object.fromEntries(R.CHAMPS.map(c => [c.id, { house: c.house, open: R.UNLOCK_STAGE[c.tier], rar: window.HOLDOR_TAVERN.CH_RAR[c.tier || 0] }])),
        towers: Object.fromEntries(R.TKEYS.map(k => [k, { open: R.TOWER_UNLOCK[k], rar: R.T_RAR[k] || 0 }])),
        spells: Object.fromEntries(Object.keys(R.SPELLS).map(k => [k, { open: k === 'arrows' ? 0 : R.SPELLS[k].at, rar: R.S_RAR[k] || 0 }])),
        need: R.CARD_NEED, mul: R.CARD_MUL, pack: R.CARD_PACK,
        rare: Object.fromEntries(Object.entries(CHEST_TIERS).map(([k, v]) => [k, v.rare || 0])) }; })(),
      // champions (v1.0.59, backend v8): stars, the burn for a star, books for skill ranks, books in chests, the summon
      tavern: (() => { const T = window.HOLDOR_TAVERN; return {
        st_max: T.ST_MAX, asc_gold: T.ASC_GOLD, asc_burn: T.ASC_BURN, book_of: T.BOOK_OF, book_need: T.BOOK_NEED, book_price: T.BOOK_PRICE,
        book_drop: T.BOOK_DROP, summon: { one: T.SUMMON.one, ten: T.SUMMON.ten, odds: T.SUMMON.odds, copies: T.SUMMON.copies } }; })(),
      // Telegram Stars (v1.0.60, backend v9): the items the server sells and what each one pays out
      stars: { skus: Object.fromEntries(Object.entries(window.HOLDOR_STARS.STARS_SHOP).map(([k, v]) => [k, { stars: v.stars, gems: v.gems || 0, gold: v.gold || 0, books: v.books || {}, once: !!v.once, title: v.title, desc: v.desc }])) },
      // the login calendar and the quests (v1.0.61, backend v10): what the server pays and how it counts progress
      calendar: { days: window.HOLDOR_DAILY.LOGIN_CAL, special_gems: window.HOLDOR_DAILY.LOGIN_SPECIAL_GEMS },
      quests: Object.fromEntries(Object.entries(window.HOLDOR_DAILY.QUESTS).map(([k, l]) => [k, l.map(q => ({ id: q.id, m: q.m, n: q.n, r: q.r }))])),
      // spot checks the SQL test compares against
      win: [[1, 1, 1], [1, 3, 1], [7, 2, 0], [34, 3, 1], [50, 1, 0]].map(([id, st, first]) => [id, st, first, ECON.win({ id }, st, !!first)]),
      hold: [[0, 0], [7, 85], [20, 333], [26, 5045]].map(([w, k]) => [w, k, ECON.hold(w, k)]),
    };
  });
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(d, null, 1));
  console.log('wrote', OUT, '· v' + d.version, '· upgrades', Object.keys(d.upg).length, '· achievements', Object.keys(d.ach).length);
})();
