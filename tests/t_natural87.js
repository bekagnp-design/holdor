// v1.0.87: natural items. The drawings use real materials instead of flat toy colours: one shared set of paints and the "handled"
// filter (grit + bevel) on the page, every icon goes through that filter, every paint it names exists, blades carry a ridge (lit and
// shaded halves), the set colour is a shaded dye (no flat set colour left), and the item slot is a dark well, not the old blue tile.
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
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GA && window.HOLDOR_GEAR, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(([cfg]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; H.setAcc(a);
    const its = []; let i = 0; for (const slot of GX.GEAR_SLOTS) for (let k = 0; k < GX.GEAR_KIND[slot].length; k++) { its.push({ id: 'n' + i, slot, kind: k, r: i % 5, tier: 1 + i % 5, cap: 4, set: Object.keys(GX.GEAR_SET)[i % 12], lvl: 0, champ: k === 0 ? 'jon' : null, main: { k: 'hp', v: 3 }, subs: [] }); i++; }
    GX.gearTestBag(its, cfg); GX.showForge('jon'); }, [CFG]);
  await page.waitForTimeout(700);
  const A = await page.evaluate(() => { const G = window.HOLDOR_GA, svgs = [...document.querySelectorAll('.gic svg')];
    const refs = new Set(); svgs.forEach(s => s.outerHTML.replace(/url\(#([^)]+)\)/g, (_, x) => refs.add(x)));
    const missing = [...refs].filter(x => !document.getElementById(x));
    const flat = svgs.filter(s => [...s.querySelectorAll('[fill]')].some(e => Object.values(G.GA_SET).includes(e.getAttribute('fill')))).length;
    const sword = G.gearArt('weapon', 'Sword', 2, 'wolf'), bg = getComputedStyle(document.querySelector('.gic')).backgroundImage;
    return { defs: document.querySelectorAll('#gaDefs').length, n: svgs.length, filtered: svgs.filter(s => s.querySelector('g[filter="url(#gaReal)"]')).length, missing, flat,
      ridge: /x2="1" y2="0"/.test(sword) && /fill="url\(#[^)]*e\)"/.test(sword), bg }; });
  ok('one shared set of paints and the handled-look filter on the page', A.defs === 1);
  ok('every item icon goes through the filter', A.n >= 224 && A.filtered === A.n, `${A.filtered}/${A.n}`);
  ok('every paint an icon names exists', A.missing.length === 0, A.missing.slice(0, 5).join(','));
  ok('no flat set colour left (dyed, shaded paint)', A.flat === 0, String(A.flat));
  ok('a blade has a ridge: one half lit, one in shade', A.ridge);
  ok('the slot is a dark well (no blue tile)', /rgb\(64, 54, 44\)/.test(A.bg), A.bg.slice(0, 80));
  await page.screenshot({ path: SC + 'natural87_forge.png' });
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
