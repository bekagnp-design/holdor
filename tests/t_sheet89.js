// v1.0.89: a cleaner item sheet and SELL on the tower ring.
// Item sheet: the item large, its name and +level, rarity and stars, a level bar, stat chips, the set in one line; one gold Upgrade
// button with the chance and price under it, Equip and Sell side by side, ✕ closes; no "Strike" anywhere.
// Battle: tapping a built tower shows a sell button that says SELL (not just a bag) with the gold it returns.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const sql = fs.readFileSync(path.resolve(__dirname, '..', 'backend', 'holdor_v11.sql'), 'utf8');
const CFG = JSON.parse(/insert into econ_config \(k, v\) values \('gear', '(\{[\s\S]*?\})'::jsonb\) on conflict/.exec(sql)[1]);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GEAR && window.HOLDOR_RING, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(([cfg]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { glass: 1, keep: 1, tier2: 1, fire: 1, reinf: 1, scorp: 1, wild: 1, weir: 1, tier3: 1, tier4: 1, tier5: 1, gates: 1, big: 1, chest: 1, hold: 1, champ: 1 };
    a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; for (let i = 1; i <= 30; i++) a.campaign[i] = 2; H.setAcc(a);
    GX.gearTestBag([{ id: 's89', slot: 'weapon', kind: 11, r: 4, tier: 4, cap: 4, set: 'dragon', lvl: 2, champ: null, main: { k: 'dmg', v: 6 }, subs: [{ k: 'crit', v: 2 }] }], cfg); GX.showForge('jon'); }, [CFG]);
  await page.waitForTimeout(500);
  await page.locator('.gitem[data-i="s89"]').tap(); await page.waitForTimeout(500);
  const A = await page.evaluate(() => { const m = document.querySelector('#ecoModal .em'), bs = [...m.querySelectorAll('.eb button')];
    const r = b => b.getBoundingClientRect();
    return { gsm: m.classList.contains('gsm'), text: m.textContent.replace(/\s+/g, ' '), big: !!m.querySelector('.gbig'), name: (m.querySelector('.gsn') || {}).textContent, rar: (m.querySelector('.gsrar') || {}).textContent,
      bar: !!m.querySelector('.gsbar i'), chips: m.querySelectorAll('.gst em, .gst span').length, btns: bs.map(b => b.textContent.trim()),
      wide: r(bs[0]).width > r(bs[1]).width * 1.6, side: Math.abs(r(bs[1]).top - r(bs[2]).top) < 2, x: r(bs[bs.length - 1]).width < 44 && r(bs[bs.length - 1]).top < r(m).top + 30 }; });
  await page.screenshot({ path: SC + 'sheet89.png' });
  ok('the sheet: item large, "Dragon Greatsword +2", Legendary, level bar, stat chips', A.gsm && A.big && /Dragon Greatsword\s*\+2/.test(A.name) && A.rar === 'Legendary' && A.bar && A.chips === 2, JSON.stringify(A));
  ok('no "Strike" anywhere; one wide Upgrade button with chance and price', !/strike/i.test(A.text) && /^⚒️ Upgrade to \+3\s*\d+% chance · (?:🪙)?\s*\d+/.test(A.btns[0]) && A.wide, JSON.stringify(A.btns));
  ok('Equip and Sell side by side, ✕ in the corner', /^Equip/.test(A.btns[1]) && /^Sell/.test(A.btns[2]) && A.side && A.btns[3] === '✕' && A.x);
  // (the Upgrade button itself goes to the server: backend/test/gear_test.py taps it on a managed seat)
  await page.evaluate(() => { const m = document.getElementById('ecoModal'); m.className = ''; m.innerHTML = ''; document.querySelectorAll('.ov,.overlay').forEach(e => e.classList.remove('show')); });
  await page.locator('.gitem[data-i="s89"]').tap(); await page.waitForTimeout(400);
  await page.locator('#ecoModal .eb button', { hasText: '✕' }).tap(); await page.waitForTimeout(300);
  ok('✕ closes the sheet', await page.evaluate(() => !document.getElementById('ecoModal').classList.contains('on')));
  // the battle: build a Keep, tap it → the sell button says SELL
  await page.evaluate(() => { const H = window.HOLDOR; document.querySelectorAll('.modal,.ov').forEach(e => e.remove && e.classList.remove('show')); H.startGame({ mode: 'campaign', level: H.LEVELS[11] }); H.G.gold = 5000; });
  await page.waitForTimeout(400);
  const slotXY = (pick) => page.evaluate((pick) => { const G = window.HOLDOR.G, Rg = window.HOLDOR_RING;
    const s = pick === 'free' ? G.map.slots.filter(x => !x.tower).sort((a, b) => Math.abs(a.x - 195) - Math.abs(b.x - 195))[0] : G.map.slots.find(x => x.tower);
    const st = document.querySelector('#stage').getBoundingClientRect(), p = Rg.w2s(s.x, s.y); return { x: st.left + p.x, y: st.top + p.y }; }, pick);
  let p = await slotXY('free'); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(350);
  const idx = await page.evaluate(() => window.HOLDOR_RING.state().items.findIndex(i => i.act === 'build'));
  await page.locator('#ring .rb').nth(idx).tap(); await page.waitForTimeout(250); await page.locator('#ring .rb').nth(idx).tap(); await page.waitForTimeout(300);
  p = await slotXY('built'); await page.touchscreen.tap(p.x, p.y - 10); await page.waitForTimeout(350);
  const S = await page.evaluate(() => { const b = document.querySelector('#ring .rb.sell'); if (!b) return null; const w = b.querySelector('.rw'), r = w && w.getBoundingClientRect(), q = b.getBoundingClientRect();
    return { word: w && w.textContent, inside: !!r && r.top >= q.top && r.bottom <= q.bottom + 2, gold: (b.querySelector('.rp') || {}).textContent }; });
  await page.screenshot({ path: SC + 'sheet89_ring.png' });
  ok('a built tower: the sell button says SELL, with the gold it returns', S && S.word === 'SELL' && S.inside && /^\+\d+$/.test(S.gold), JSON.stringify(S));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
