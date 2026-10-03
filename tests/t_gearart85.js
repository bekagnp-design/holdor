// v1.0.85: drawn items. Every kind of every slot is drawn (no emoji), the metal changes with the rarity and the gem / cloth with the set,
// Epic and Legendary items shine, and the forge shows the drawings in the slots and the bag.
const { chromium } = require('playwright');
const fs = require('fs');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const sql = fs.readFileSync(require('path').resolve(__dirname, '..', 'backend', 'holdor_v11.sql'), 'utf8');
const CFG = JSON.parse(/insert into econ_config \(k, v\) values \('gear', '(\{[\s\S]*?\})'::jsonb\) on conflict/.exec(sql)[1]);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GA && window.HOLDOR_GEAR, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const A = await page.evaluate(() => { const G = window.HOLDOR_GA, K = window.HOLDOR_GEAR.GEAR_KIND, out = { n: 0, fallback: [], same: 0, bad: [] };
    const seen = new Set();
    for (const slot in K) K[slot].forEach(([name]) => { out.n++; const [fam, , hit] = G.gaFamily(slot, name); const svg = G.gearArt(slot, name, 2, 'wolf');
      if (!/^<svg viewBox="0 0 48 48">/.test(svg) || svg.length < 300) out.bad.push(name);
      const key = svg.replace(/id="[^"]*"|url\(#[^)]*\)/g, ''); if (seen.has(key)) out.same++; seen.add(key);
      if (!hit) out.fallback.push(name); });
    const m = [0, 1, 2, 3, 4].map(r => G.gearArt('weapon', 'Sword', r, 'wolf').match(/stop-color="(#[0-9a-f]+)"/)[1]);
    const s = ['wolf', 'dragon'].map(x => G.gearArt('ring', 'Ring', 2, x).includes(G.GA_SET[x]));
    return { ...out, metals: new Set(m).size, sets: s }; });
  ok('all 54 kinds are drawn, each its own picture', A.n === 54 && !A.bad.length && A.same === 0, JSON.stringify({ n: A.n, bad: A.bad, same: A.same }));
  ok('every kind finds its own family (no fallback shape by accident)', A.fallback.length === 0, A.fallback.join(','));
  ok('five rarities, five metals; the set colours the gem', A.metals === 5 && A.sets.every(Boolean), JSON.stringify([A.metals, A.sets]));
  await page.evaluate(([cfg]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; H.setAcc(a);
    const its = []; let i = 0; for (const slot of GX.GEAR_SLOTS) for (let k = 0; k < GX.GEAR_KIND[slot].length; k++) { its.push({ id: (16 + i).toString(16) + 'ef' + i, slot, kind: k, r: i % 5, tier: 1 + i % 5, cap: 4, set: Object.keys(GX.GEAR_SET)[i % 12], lvl: 0, champ: k === 0 ? 'jon' : null, main: { k: 'hp', v: 3 }, subs: [] }); i++; }
    GX.gearTestBag(its, cfg); GX.showForge('jon'); }, [CFG]);
  await page.waitForTimeout(600);
  const F = await page.evaluate(() => { const ic = [...document.querySelectorAll('.gslot .gic, .gitem .gic')]; return { n: ic.length, svg: ic.filter(e => e.querySelector('svg')).length,
    emoji: ic.filter(e => /\p{Extended_Pictographic}/u.test([...e.childNodes].filter(c => c.nodeType === 3).map(c => c.nodeValue).join(''))).length, shine: document.querySelectorAll('.gic.r4, .gic.r3').length }; });
  ok('the forge: every item icon is a drawing, none an emoji; Epic and Legendary shine', F.n >= 54 && F.svg === F.n && F.emoji === 0 && F.shine > 0, JSON.stringify(F));
  await page.screenshot({ path: SC + 'gearart85_forge.png', fullPage: true });
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
