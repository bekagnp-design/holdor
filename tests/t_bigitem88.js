// v1.0.88: the item up close. Tapping an item in the forge opens its sheet with a large view of it (not the small icon): the item's own
// drawing, about 156 px, swaying, a glint passing; moving the finger over it tilts it in 3D and letting go sets it straight.
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
    GX.gearTestBag([{ id: 'b88', slot: 'weapon', kind: 11, r: 4, tier: 4, cap: 4, set: 'dragon', lvl: 2, champ: null, main: { k: 'dmg', v: 6 }, subs: [] }], cfg); GX.showForge('jon'); }, [CFG]);
  await page.waitForTimeout(500);
  await page.locator('.gitem[data-i="b88"]').tap(); await page.waitForTimeout(500);
  const A = await page.evaluate(() => { const b = document.querySelector('.gbig'); if (!b) return null; const r = b.getBoundingClientRect(), svg = b.querySelector('.gbw svg');
    const tmp = document.createElement('span'); tmp.innerHTML = window.HOLDOR_GA.gearArt('weapon', 'Greatsword', 4, 'dragon'); const norm = h => h.replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
    return { w: Math.round(r.width), same: !!svg && norm(svg.outerHTML) === norm(tmp.firstChild.outerHTML), anim: svg ? svg.getAnimations().length : 0, glint: b.querySelector('.gbgl').getAnimations().length,
      small: !!document.querySelector('.gsheet > .gic'), legend: b.classList.contains('r4') }; });
  ok('the sheet opens with the item large (~156 px), not the small icon', A && A.w >= 150 && !A.small, JSON.stringify(A));
  ok('it is the item\'s own drawing (a Legendary Dragon Greatsword)', A && A.same && A.legend);
  ok('it sways and a glint passes', A && A.anim > 0 && A.glint > 0);
  const box = await page.locator('.gbw').boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2); await page.waitForTimeout(150);
  const t1 = await page.evaluate(() => { const w = document.querySelector('.gbw'); return [w.style.getPropertyValue('--ry'), w.style.getPropertyValue('--rx'), getComputedStyle(w).transform]; });
  await page.screenshot({ path: SC + 'bigitem88.png' });
  await page.mouse.move(5, 5); await page.evaluate(() => document.querySelector('.gbw').dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })));
  await page.waitForTimeout(150);
  const t2 = await page.evaluate(() => document.querySelector('.gbw').style.getPropertyValue('--ry'));
  ok('the finger tilts it in 3D; letting go sets it straight', parseFloat(t1[0]) > 10 && parseFloat(t1[1]) > 5 && t1[2] !== 'none' && t2 === '0deg', JSON.stringify([t1, t2]));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
