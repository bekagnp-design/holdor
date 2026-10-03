// v1.0.86: hundreds of items. The kinds grow from 54 to 224 (backend v22): the app's list is the server's, the first 54 keep their
// places (an item rolled before keeps its name and picture), and a new kind shows its own name and drawing when tapped in the forge.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const v11 = fs.readFileSync(path.resolve(__dirname, '..', 'backend', 'holdor_v11.sql'), 'utf8');
const CFG = JSON.parse(/insert into econ_config \(k, v\) values \('gear', '(\{[\s\S]*?\})'::jsonb\) on conflict/.exec(v11)[1]);
const kindsOf = f => JSON.parse(/-- KINDS-BEGIN\nupdate econ_config set v = v \|\| '([\s\S]*?)'::jsonb/.exec(fs.readFileSync(path.resolve(__dirname, '..', 'backend', f), 'utf8'))[1].replace(/''/g, "'")).kinds;
const OLD = kindsOf('holdor_v12.sql'), NEW = kindsOf('holdor_v22.sql');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GA && window.HOLDOR_GEAR, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const K = await page.evaluate(() => { const K = window.HOLDOR_GEAR.GEAR_KIND; const o = {}; for (const s in K) o[s] = K[s].map(x => x[0]); return o; });
  const n = Object.values(K).reduce((a, v) => a + v.length, 0);
  ok('224 kinds in the app, 16+ in every slot', n === 224 && Math.min(...Object.values(K).map(v => v.length)) >= 16, String(n));
  ok('the app\'s names are the server\'s (backend v22), in order', Object.keys(NEW).every(s => JSON.stringify(K[s]) === JSON.stringify(NEW[s].map(k => k.n))));
  ok('the first 54 stay in their places', Object.keys(OLD).every(s => JSON.stringify(K[s].slice(0, OLD[s].length)) === JSON.stringify(OLD[s].map(k => k.n))));
  // a bag: an old Sword (kind 0) and three new kinds; tap each in the forge
  const pick = [['weapon', 0], ['weapon', 49], ['ring', 21], ['banner', 19]];
  await page.evaluate(([cfg, pick]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }; a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; H.setAcc(a);
    GX.gearTestBag(pick.map(([slot, kind], i) => ({ id: 'k86' + i, slot, kind, r: 3, tier: 3, cap: 4, set: 'wolf', lvl: 0, champ: null, main: { k: 'hp', v: 3 }, subs: [] })), cfg); GX.showForge('jon'); }, [CFG, pick]);
  await page.waitForTimeout(600);
  const seen = [];
  for (let i = 0; i < pick.length; i++) {
    await page.locator(`.gitem[data-i="k86${i}"]`).tap(); await page.waitForTimeout(400);
    seen.push(await page.evaluate(([slot, kind]) => { const t = document.body.innerText, nm = window.HOLDOR_GEAR.GEAR_KIND[slot][kind][0];
      const norm = h => h.replace(/id="[^"]*"|url\(#[^)]*\)/g, ''), tmp = document.createElement('span'); tmp.innerHTML = window.HOLDOR_GA.gearArt(slot, nm, 3, 'wolf');
      const svg = norm(tmp.firstChild.outerHTML), shown = [...document.querySelectorAll('.gic svg')].some(e => norm(e.outerHTML) === svg);
      return { nm, named: t.includes(nm), shown }; }, pick[i]));
    if (i === 1) await page.screenshot({ path: SC + 'kinds86_sheet.png' });
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^(close|back|✕)$/i.test(b.textContent.trim())); if (b) b.click(); else document.querySelectorAll('.modal,.ecoModal').forEach(m => m.remove()); });
    await page.waitForTimeout(300);
  }
  ok('the old Sword is still a Sword', seen[0].nm === 'Sword' && seen[0].named && seen[0].shown, JSON.stringify(seen[0]));
  ok('new kinds show their own name and drawing (Harpoon, Gold band, Weirwood totem)', seen.slice(1).every(x => x.named && x.shown) && seen.slice(1).map(x => x.nm).join() === 'Harpoon,Gold band,Weirwood totem', JSON.stringify(seen.slice(1)));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
