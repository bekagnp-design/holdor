// v1.0.78: the home screen rebuilt (live strip, living stage, next goal, four chest slots, quick buttons, BATTLE) in three looks.
// Real taps: 🎨 cycles A → B → C and the choice stays; each look draws its stage (A the champion who strikes on a tap, B a night scene
// drawn every frame, C the realm's map with the next stage pinned); ?skin=a opens straight in A; the slots open the star chest and count
// the free chest down; the goal opens the map; the Hold pill opens the Hold; the animation stops when the home screen is left.
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const setup = async () => { await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_HOME, { timeout: 20000 }); await page.waitForTimeout(300);
    await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
      a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
      for (let i = 1; i <= 9; i++) a.campaign[i] = 3; a.freeChestAt = Date.now() - 3600000; a.holdTut = 1; a.holdIntro = 1; H.setAcc(a); H.showHub('battle'); });
    await page.waitForTimeout(900); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms || 400); };
  await page.goto(URL); await page.evaluate(() => localStorage.removeItem('holdor_skin')); await page.goto(URL); await setup();
  const base = await page.evaluate(() => ({ skin: window.HOLDOR_HOME.skinOf(), strip: document.querySelectorAll('.hmstrip .hpill').length, slots: document.querySelectorAll('.hmslots .slot').length,
    ids: ['#bBattle', '#starChest', '#bCity', '#bTavern', '#bForge', '#bDaily', '#bSeason', '#hubTro', '#bChampH', '#evBadge', '#hmGoal'].filter(s => !document.querySelector(s)) }));
  ok('a new device opens on B (living gate); the strip has 3 pills, four chest slots, every old id is there', base.skin === 'b' && base.strip === 3 && base.slots === 4 && !base.ids.length, JSON.stringify(base));
  // B: the night scene is drawn and moves
  const px = async () => page.evaluate(() => { const c = document.getElementById('hmGate'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, lit = 0; for (let i = 0; i < d.length; i += 4 * 97) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000003; if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; } return { w: c.width, h, lit }; });
  const p1 = await px(); await page.waitForTimeout(500); const p2 = await px();
  ok('B: the canvas fills the stage, has light in it (moon, torches) and changes frame to frame', p1 && p1.w > 600 && p1.lit > 20 && p1.h !== p2.h, JSON.stringify([p1, p2]));
  await page.screenshot({ path: SC + 'home78_b.png' });
  // 🎨: B → C → A, kept on the device
  await tap('#bSkin', 900);
  const c = await page.evaluate(() => ({ skin: window.HOLDOR_HOME.skinOf(), map: !!document.getElementById('hmMap'), nx: (document.querySelector('.stC .pin.nx b') || {}).textContent, flags: document.querySelectorAll('.stC .pin .fl').length, hub: document.querySelector('.hub').className }));
  ok('🎨 → C: the map, the next stage (10) pinned, a flag on each of the 9 held stages, the wood look', c.skin === 'c' && c.map && c.nx === '10' && c.flags === 9 && /look-c/.test(c.hub), JSON.stringify(c));
  await page.screenshot({ path: SC + 'home78_c.png' });
  await tap('#bSkin', 900);
  const a = await page.evaluate(() => ({ skin: window.HOLDOR_HOME.skinOf(), hero: !!document.getElementById('hmHero'), kept: localStorage.getItem('holdor_skin'), hub: document.querySelector('.hub').className }));
  ok('🎨 → A: the champion on the stage, the purple look, the choice kept', a.skin === 'a' && a.hero && a.kept === 'a' && /look-a/.test(a.hub), JSON.stringify(a));
  const src0 = await page.evaluate(() => document.getElementById('hmHero').src.length);
  await tap('#hmHero', 120);
  const src1 = await page.evaluate(() => ({ len: document.getElementById('hmHero').src.length, atk: document.getElementById('hmHero').classList.contains('atk') }));
  await page.waitForTimeout(500);
  const src2 = await page.evaluate(() => document.getElementById('hmHero').src.length);
  ok('A: a tap on the champion strikes (attack art for a moment, then back)', src1.atk && src1.len !== src0 && src2 === src0, JSON.stringify([src0, src1, src2]));
  await page.screenshot({ path: SC + 'home78_a.png' });
  // ?skin=c opens straight in C
  await page.goto(URL + '?skin=c'); await setup();
  ok('?skin=c in the address opens the war map', await page.evaluate(() => window.HOLDOR_HOME.skinOf() === 'c' && !!document.getElementById('hmMap')));
  // the slots
  const f1 = await page.evaluate(() => document.querySelector('#freeChest em').textContent); await page.waitForTimeout(1300);
  const f2 = await page.evaluate(() => document.querySelector('#freeChest em').textContent);
  ok('the free chest slot counts down to its return (about 23 hours)', /^2[23]:\d\d:\d\d$/.test(f1) && f1 !== f2, f1 + ' → ' + f2);
  // the goal and the Hold pill
  await tap('#hmGoal', 900);
  ok('the next-goal ribbon opens the map', await page.evaluate(() => !!document.querySelector('.mapview') && window.HOLDOR.CLOUD.screen !== 'hub:battle'), await page.evaluate(() => window.HOLDOR.CLOUD.screen));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(700);
  await tap('#hmHold', 900);
  ok('the Hold pill shows today\'s runs and opens the Hold tab', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'hub:hold'));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(700);
  ok('the star chest slot is ready (9 stages × 3 stars) with a count', await page.evaluate(() => document.getElementById('starChest').classList.contains('ready') && /×9/.test(document.getElementById('starChest').innerText)));
  await tap('#starChest', 900);
  ok('a tap on the star chest opens a chest', await page.evaluate(() => !!document.querySelector('#cer #cch')), await page.evaluate(() => window.HOLDOR.CLOUD.screen));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(700);
  // leaving the home screen stops the animation
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(400);
  ok('leaving the home screen stops the animation loop', await page.evaluate(() => window.HOLDOR_HOME.HOME.raf === 0));
  // every house in every look draws without an error
  const all = await page.evaluate(async () => { const H = window.HOLDOR, out = []; for (const h of ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell']) for (const k of ['a', 'b', 'c']) {
      localStorage.setItem('holdor_skin', k); const a = H.newAccount(h, 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tours = { win: 1, battle: 1 }; H.setAcc(a); H.showHub('battle');
      await new Promise(r => setTimeout(r, 120)); if (window.HOLDOR_HOME.HOME.err) out.push(h + k + ':' + window.HOLDOR_HOME.HOME.err); } return out; });
  ok('7 houses × 3 looks draw without an error', all.length === 0, all.join(';'));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
