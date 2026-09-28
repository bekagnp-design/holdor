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
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_ECON, { timeout: 30000 });
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
      // spot checks the SQL test compares against
      win: [[1, 1, 1], [1, 3, 1], [7, 2, 0], [34, 3, 1], [50, 1, 0]].map(([id, st, first]) => [id, st, first, ECON.win({ id }, st, !!first)]),
      hold: [[0, 0], [7, 85], [20, 333], [26, 5045]].map(([w, k]) => [w, k, ECON.hold(w, k)]),
    };
  });
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(d, null, 1));
  console.log('wrote', OUT, '· v' + d.version, '· upgrades', Object.keys(d.upg).length, '· achievements', Object.keys(d.ach).length);
})();
