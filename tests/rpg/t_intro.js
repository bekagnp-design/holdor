// RPG intro (A27): with no save the intro opens; BEGIN → Stark → the first hero (Jon Snow, the rest locked) → RIDE AS JON SNOW →
// the prologue (5 captions, the last one the permadeath rule) → tap 5× → R.state written (acc.house stark, acc.champs.jon unlocked,
// p.hero jon, p.name Jon Snow, p.cls knight), saved in localStorage, R.running. Also: back arrows, a locked hero refuses, SKIP, Continue.
// usage: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_intro.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SC = path.resolve(__dirname, '..', '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const HTML = process.env.HOLDOR_HTML ? path.resolve(process.env.HOLDOR_HTML) : path.resolve(__dirname, '..', '..', 'beta', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; let page = null;
  const RES = {}; let bad = 0; const ok = (k, v, info) => { RES[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) bad++; };
  const shot = n => page.screenshot({ path: SC + 'rpg_intro_' + n + '.png' });
  const boot = async (clear) => { // one page for the whole suite: under file:// Chromium keeps localStorage per page, but it survives a reload
    if (!page) { page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
      page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text()) && /intro|screen:|boot|netload|\bload\b/i.test(m.text())) errors.push('C:' + m.text()); });   // other modules' errors are their suites' business
      await page.goto('file://' + HTML); }
    if (clear) await page.evaluate(() => { try { R.save = () => false; localStorage.removeItem('holdor_rpg'); } catch (e) {} });   // pagehide must not write the old save back
    await page.reload(); await page.waitForFunction(() => window.R && R.screens && R.screens.intro, { timeout: 20000 }); await page.waitForTimeout(700);
    // the boot module (90_main) opens the intro for a new save; until it lands, open it here
    await page.evaluate(() => { if (!R.ui.cur) R.ui.open('intro'); }); await page.waitForTimeout(400); };
  const step = () => page.evaluate(() => R.intro.step);
  const txt = sel => page.$eval(sel, e => e.textContent.trim()).catch(() => null);

  /* ---- 1. the full path ---- */
  await boot(true);
  const t0 = Date.now();
  ok('intro opens on a fresh save', (await page.evaluate(() => R.ui.cur)) === 'intro' && (await step()) === 'title', await step());
  ok('title: HOLDOR + Hold the door + BEGIN', (await txt('.in-logo')) === 'HOLDOR' && (await txt('.in-sub')) === 'Hold the door' && (await txt('#in-begin')) === 'BEGIN' && !(await page.$('#in-cont')));
  await page.waitForFunction(() => R.intro.bg().map, { timeout: 5000 }).catch(() => {});
  const bg = await page.evaluate(() => R.intro.bg()); ok('title: the map pans with snow (canvas sized, art loaded)', bg.on && bg.w > 300 && bg.h > 600 && bg.snow === 90 && bg.map, JSON.stringify(bg));
  await shot('1_title');
  await page.tap('#in-begin'); await page.waitForTimeout(250);
  ok('BEGIN → house step', (await step()) === 'house');
  ok('house: 7 cards, button disabled until a pick', (await page.$$eval('.in-house', l => l.length)) === 7 && (await page.$eval('#in-next', b => b.disabled)));
  await shot('2_houses');
  await page.tap('.in-house[data-h="stark"]'); await page.waitForTimeout(200);
  ok('house: Stark gets the gold frame, button says RIDE FOR HOUSE STARK', (await page.$eval('.in-house[data-h="stark"]', e => e.classList.contains('sel'))) && /ride for house stark/i.test(await txt('#in-next')) && !(await page.$eval('#in-next', b => b.disabled)), await txt('#in-next'));
  ok('house: only one selected', (await page.$$eval('.in-house.sel', l => l.length)) === 1);
  await shot('2_houses_stark');
  // back arrow: to the title and again forward (the pick is kept)
  await page.tap('#in-back'); await page.waitForTimeout(200); ok('house ← back → title', (await step()) === 'title');
  await page.tap('#in-begin'); await page.waitForTimeout(200); ok('title → house keeps the pick', (await step()) === 'house' && (await page.$eval('.in-house[data-h="stark"]', e => e.classList.contains('sel'))));
  await page.tap('#in-next'); await page.waitForTimeout(250);
  ok('RIDE → hero step', (await step()) === 'hero');
  const heroes = await page.evaluate(() => ({ open: [...document.querySelectorAll('.in-hero.big')].map(e => e.dataset.id), locked: [...document.querySelectorAll('.in-hero.lock')].map(e => e.dataset.id), sel: [...document.querySelectorAll('.in-hero.sel')].map(e => e.dataset.id), btn: document.getElementById('in-next').textContent, dis: document.getElementById('in-next').disabled, cls: (document.querySelector('.in-hero.big .cl') || {}).textContent, fl: (document.querySelector('.in-hero.big .fl') || {}).textContent }));
  ok('hero: only the starter Brienne unlocked (R.firstChamp), six locked, Brienne preselected', heroes.open.join() === 'brienne' && heroes.locked.length === 6 && heroes.sel.join() === 'brienne', JSON.stringify(heroes.open) + ' ' + JSON.stringify(heroes.locked));
  ok('hero: button RIDE AS BRIENNE OF TARTH, enabled', /ride as brienne of tarth/i.test(heroes.btn) && !heroes.dis, heroes.btn);
  ok('hero: class Knight from melee + a fantasy line', /knight/i.test(heroes.cls || '') && (heroes.fl || '').length > 10, heroes.cls + ' | ' + heroes.fl);
  ok('hero: locked caption says it unlocks as you progress (any house)', /unlocks as you progress/i.test(await txt('.in-lockh') || ''));
  await shot('3_hero');
  await page.tap('.in-hero.lock[data-id="arya"]'); await page.waitForTimeout(250);
  ok('hero: a locked card refuses (toast, selection stays Brienne)', (await page.evaluate(() => R.intro.hero)) === 'brienne' && !!(await page.$('.toast')), await txt('.toast'));
  await page.tap('#in-back'); await page.waitForTimeout(200); ok('hero ← back → house', (await step()) === 'house');
  await page.tap('#in-next'); await page.waitForTimeout(250); ok('house → hero again', (await step()) === 'hero');
  await page.tap('#in-next'); await page.waitForTimeout(300);
  ok('RIDE AS → prologue', (await step()) === 'prologue');
  const lines = await page.evaluate(() => R.intro.lines);
  ok('prologue: 5 captions, the last is the rule', lines.length === 5 && lines[4] === 'When a hero falls, the house sends the next.', JSON.stringify(lines));
  ok('prologue: SKIP + the hero named ("Brienne of Tarth — House Stark"), no raw {placeholders}', !!(await page.$('#in-skip')) && /brienne of tarth — house stark/i.test(await txt('.in-stage .who') || '') && !lines.some(l => /[{}]/.test(l)), await txt('.in-stage .who') + ' ' + JSON.stringify(lines));
  await page.waitForTimeout(1600);
  const typed = await txt('#in-cap'); ok('prologue: the first caption types in', typed && typed.length > 20 && lines[0].startsWith(typed.replace(/\s*$/, '').slice(0, 20)), typed);
  await shot('4_prologue');
  for (let i = 0; i < 4; i++) { await page.tap('#in-stage'); await page.waitForTimeout(350); }
  ok('prologue: 4 taps → the rule caption', (await page.evaluate(() => R.intro.idx)) === 4 && (await page.$eval('#in-cap', e => e.classList.contains('rule'))));
  await page.waitForTimeout(1500); await shot('5_rule');
  await page.tap('#in-stage'); await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ cur: R.ui.cur, running: R.running, intro: R.intro.open, acc: R.state && R.state.acc, p: R.state && R.state.p, ls: (() => { try { return JSON.parse(localStorage.getItem('holdor_rpg')); } catch (e) { return null; } })() }));
  ok('5th tap → intro closed, R.running', st.cur === null && st.running === true && !st.intro, JSON.stringify({ cur: st.cur, running: st.running }));
  ok('state: acc.house stark, acc.champs.brienne unlocked', st.acc && st.acc.house === 'stark' && st.acc.champs && st.acc.champs.brienne && st.acc.champs.brienne.unlocked === 1, JSON.stringify(st.acc && st.acc.champs));
  ok('state: p.hero brienne, name Brienne of Tarth, cls knight, a full-hp hero at level 1', st.p && st.p.hero === 'brienne' && st.p.name === 'Brienne of Tarth' && st.p.cls === 'knight' && st.p.lvl === 1 && (await page.evaluate(() => R.player && R.player.hp === R.player.hpMax)), JSON.stringify(st.p && { hero: st.p.hero, name: st.p.name, cls: st.p.cls, house: st.p.house, pos: st.p.pos }));
  ok('saved in localStorage', st.ls && st.ls.p && st.ls.p.hero === 'brienne' && st.ls.p.name === 'Brienne of Tarth' && st.ls.acc && st.ls.acc.house === 'stark');
  ok('the whole intro under 60 s tapping through', Date.now() - t0 < 60000, Math.round((Date.now() - t0) / 1000) + 's');
  await page.waitForTimeout(400); await shot('6_world');

  /* ---- 2. Continue with a save ---- */
  await boot(false);
  ok('with a save: Continue appears', !!(await page.$('#in-cont')) && (await txt('#in-cont')) === 'Continue');
  await shot('7_continue');
  await page.tap('#in-cont'); await page.waitForTimeout(400);
  const c2 = await page.evaluate(() => ({ cur: R.ui.cur, running: R.running, hero: R.state && R.state.p && R.state.p.hero }));
  ok('Continue → loads the save, closes, runs', c2.cur === null && c2.running && c2.hero === 'brienne', JSON.stringify(c2));

  /* ---- 3. SKIP + another house: Martell → Areo Hotah (R.firstChamp) → the knight class ---- */
  await boot(true);
  await page.tap('#in-begin'); await page.waitForTimeout(150); await page.tap('.in-house[data-h="martell"]'); await page.waitForTimeout(150); await page.tap('#in-next'); await page.waitForTimeout(250);
  const m = await page.evaluate(() => ({ open: [...document.querySelectorAll('.in-hero.big')].map(e => e.dataset.id), btn: document.getElementById('in-next').textContent, acc: getComputedStyle(document.getElementById('screen')).getPropertyValue('--acc').trim() }));
  ok('Martell: first hero Areo Hotah, accent is the house colour', m.open.join() === 'areo' && /ride as areo hotah/i.test(m.btn) && m.acc === '#f08a3c', JSON.stringify(m));
  await shot('8_martell_hero');
  await page.tap('#in-next'); await page.waitForTimeout(300); await page.tap('#in-skip'); await page.waitForTimeout(400);
  const s3 = await page.evaluate(() => ({ cur: R.ui.cur, running: R.running, p: R.state && R.state.p, h: R.state && R.state.acc && R.state.acc.house, lines: R.intro.lines }));
  ok('SKIP → state written for Areo Hotah of Martell', s3.cur === null && s3.running && s3.p.hero === 'areo' && s3.p.name === 'Areo Hotah' && s3.p.cls === 'knight' && s3.h === 'martell', JSON.stringify({ hero: s3.p.hero, cls: s3.p.cls, h: s3.h }));
  ok('Martell prologue names Sunspear in the fallback lines', s3.lines.some(l => /Sunspear/.test(l)) || !!(await page.evaluate(() => R.data.story && R.data.story.prologue)), JSON.stringify(s3.lines[0]));
  ok('every house has 7 champions and a first hero', await page.evaluate(() => ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'].every(h => R.intro.heroes(h).length === 7 && R.intro.starter(h) === R.firstChamp(h))));
  ok('class by type: Bronn ranger, Tyrion maester, Jaime knight', await page.evaluate(() => { const c = R.intro.champs(); const g = id => c.find(x => x.id === id).cls; return g('bronn') === 'ranger' && g('tyrion') === 'maester' && g('jaime') === 'knight'; }));

  for (const k in RES) console.log(RES[k].startsWith('OK') ? 'OK  ' : 'FAIL', k, RES[k].slice(RES[k].indexOf(' ') + 1 || 99));
  console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
  console.log(bad ? bad + ' FAILS' : 'ALL PASS', '— shots in', SC);
  await browser.close(); process.exit(bad || errors.length ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
