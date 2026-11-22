// RPG v2.0.0 — the heroes roster (A14, js/23_companions.js): one hero, permadeath. Real taps.
// Run: python3 src/build_rpg.py beta/index.html && CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_companions.js
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const html = process.env.HOLDOR_HTML || 'beta/index.html';
  await page.goto('file://' + (path.isAbsolute(html) ? html : path.resolve(__dirname, '..', '..', html)));
  await page.waitForFunction(() => window.R && window.R.heroes && window.R.screens && window.R.screens.heroes, { timeout: 20000 });
  const T = {}; const ok = (k, v, info) => { T[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const txt = sel => page.evaluate(s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; }, sel);
  const count = sel => page.evaluate(s => document.querySelectorAll(s).length, sel);
  const tap = async sel => { const el = await page.$(sel); if (!el) throw new Error('no element ' + sel); await el.scrollIntoViewIfNeeded(); await el.tap(); await page.waitForTimeout(80); };

  // a fresh account of House Stark; R.newHero faked when A01's is absent, recorded either way
  const setup = await page.evaluate(() => { try { R.stop && R.stop(); } catch (e) {} R.state = R.newState(); R.state.p.house = 'stark'; R.state.p.name = ''; if (R.state.acc) { R.state.acc.house = 'stark'; R.state.acc.champs = {}; R.state.acc.hall = []; }
    window.__nh = []; const real = typeof R.newHero === 'function' ? R.newHero : null; R.newHero = id => { window.__nh.push(id); if (real) return real(id); R.state.p.hero = id; R.state.p.lvl = 1; R.state.p.xp = 0; R.state.p.created = Date.now(); };
    window.__hero = []; R.bus.on('hero', (id, why) => window.__hero.push(id + ':' + why)); window.__ride = []; R.bus.on('ride', id => window.__ride.push(id));
    const ids = R.heroes.houseIds('stark'); return { ids, starter: R.heroes.starter('stark'), starterName: R.heroes.champ(R.heroes.starter('stark')).name, fake: !real }; });
  ok('the house has a roster and a starter', setup.ids.length >= 1 && setup.ids.includes(setup.starter), JSON.stringify(setup));

  // 1. the screen lists the house's champions; the starter unlocked, the rest locked + disabled
  await page.evaluate(() => R.ui.open('heroes')); await page.waitForTimeout(150);
  const n = await count('.hr-card'), nOn = await count('.hr-card.on'), nLock = await count('.hr-card.lock'), nDis = await count('.hr-card:disabled'), nLkTxt = await page.evaluate(() => [...document.querySelectorAll('.hr-card.lock .hr-lk')].filter(e => e.textContent.trim().length > 4).length);
  ok('lists every champion of the house', n === setup.ids.length, n + '/' + setup.ids.length);
  ok('one unlocked at a new account: the starter', nOn === 1 && (await page.evaluate(() => document.querySelector('.hr-card.on').dataset.id)) === setup.starter, nOn + ' ' + setup.starter);
  ok('locked ones are disabled, grey, and say how to unlock', nLock === n - 1 && nDis === n - 1 && nLkTxt === n - 1, [nLock, nDis, nLkTxt].join(' '));
  ok('class and rarity on every card', (await page.evaluate(() => [...document.querySelectorAll('.hr-card .hr-c')].every(e => /Knight|Ranger|Maester/.test(e.textContent) && /Common|Uncommon|Rare|Epic|Legendary/.test(e.textContent)))));
  ok('runs and best level on the unlocked card', /runs\s*0/.test((await txt('.hr-card.on .hr-st')) || '') && /best/.test((await txt('.hr-card.on .hr-st')) || ''), await txt('.hr-card.on .hr-st'));
  const btn0 = await txt('.hr-ride');
  ok('the primary button names the preselected starter', btn0 === 'RIDE AS ' + setup.starterName.toUpperCase(), btn0);
  // a locked card does not select
  const lockedId = setup.ids.find(id => id !== setup.starter);
  await page.evaluate(id => { const c = document.querySelector('.hr-card[data-id="' + id + '"]'); c.scrollIntoView(); }, lockedId);
  try { await page.tap('.hr-card[data-id="' + lockedId + '"]', { force: true, timeout: 2000 }); } catch (e) {} await page.waitForTimeout(100);
  ok('a tap on a locked card changes nothing', (await txt('.hr-ride')) === btn0 && !(await page.evaluate(id => document.querySelector('.hr-card[data-id="' + id + '"]').classList.contains('sel'), lockedId)), await txt('.hr-ride'));

  // 2. unlock() flips a card, toasts, emits hero
  const flip = await page.evaluate(id => { const r = R.heroes.unlock(id, 'test'); const c = document.querySelector('.hr-card[data-id="' + id + '"]'); const toast = [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|'); return { r, on: c.classList.contains('on'), dis: c.disabled, toast, ev: window.__hero.slice(), again: R.heroes.unlock(id, 'test'), st: R.heroes.acc().champs[id] }; }, lockedId);
  ok('unlock() flips the card bright and enabled', flip.r === true && flip.on && !flip.dis, JSON.stringify([flip.r, flip.on, flip.dis]));
  ok('unlock toasts "joins your house" and emits hero once', /joins your house/.test(flip.toast) && flip.ev.length === 1 && flip.ev[0] === lockedId + ':test' && flip.again === false && flip.st.unlocked === 1, JSON.stringify([flip.toast, flip.ev]));

  // 3. tap selects, RIDE AS calls R.newHero
  await tap('.hr-card[data-id="' + lockedId + '"]');
  const lockedName = await page.evaluate(id => R.heroes.champ(id).name, lockedId);
  ok('a tap selects the unlocked card (gold frame) and renames the button', (await count('.hr-card.sel')) === 1 && (await page.evaluate(() => document.querySelector('.hr-card.sel').dataset.id)) === lockedId && (await txt('.hr-ride')) === 'RIDE AS ' + lockedName.toUpperCase(), await txt('.hr-ride'));
  await tap('.hr-ride');
  const rode = await page.evaluate(id => ({ nh: window.__nh.slice(), ride: window.__ride.slice(), cur: R.ui.cur, runs: R.heroes.acc().champs[id].runs, hero: R.state.p.hero }), lockedId);
  ok('RIDE AS calls R.newHero with the id, counts a run, closes the screen', rode.nh.length === 1 && rode.nh[0] === lockedId && rode.ride[0] === lockedId && rode.cur === null && rode.runs === 1, JSON.stringify(rode));

  // 4. the fall writes one hall line (no duplicate from the death event), the hall lists it
  const fell = await page.evaluate(id => { const p = R.state.p; p.hero = id; p.name = R.heroes.champ(id).name; p.lvl = 7; p.played = 540; if (R.screens.death && R.screens.death.cfg) R.screens.death.cfg.fade = 600000; const e = R.heroes.fall({ name: 'Wight' }); R.bus.emit('death', { killer: { name: 'Wight' } }); return { e, n: R.heroes.acc().hall.length, best: R.heroes.best() }; }, lockedId);
  await page.waitForTimeout(60);
  const hallN = await page.evaluate(() => R.heroes.acc().hall.length);
  ok('fall() writes name, level and killer; the death event does not double it', fell.e && fell.e.lvl === 7 && fell.e.killer === 'Wight' && fell.n === 1 && hallN === 1 && fell.best.lvl === 7 && fell.best.runs === 1, JSON.stringify([fell.e, hallN, fell.best]));
  await page.evaluate(() => R.ui.open('hall')); await page.waitForTimeout(120);
  const rows = await count('.hr-row'), row = (await txt('.hr-row')) || '', sum = (await txt('.hr-sum')) || '';
  ok('the hall lists the entry with portrait, name, level, killer and when', rows === 1 && row.includes(lockedName) && /Lv 7/.test(row) && /slain by Wight/.test(row) && /ago|just now/.test(row) && (await count('.hr-row .hr-pt')) === 1, row + ' cur=' + (await page.evaluate(() => R.ui.cur + ' ' + document.getElementById('screen').innerText.slice(0, 160))));
  ok('the hall sums runs, best level and the fallen', /1\s*runs/.test(sum.replace(/\s+/g, ' ')) && /Lv 7\s*best level/.test(sum.replace(/\s+/g, ' ')) && /1\s*fallen/.test(sum.replace(/\s+/g, ' ')), sum.replace(/\s+/g, ' '));

  // 5. after a death: the fallen hero crossed with its level, another hero preselected; hall ↔ heroes by taps
  await page.evaluate(() => R.ui.open('heroes', { afterDeath: true })); await page.waitForTimeout(120);
  const fellTxt = (await txt('.hr-fell')) || ''; const fellS = await count('.hr-fell s'); const fallenCard = await page.evaluate(id => { const c = document.querySelector('.hr-card[data-id="' + id + '"]'); return c && c.classList.contains('fallen'); }, lockedId);
  ok('the fallen hero is shown crossed with its level', fellS === 1 && fellTxt.includes(lockedName) && /Lv 7/.test(fellTxt) && /fell to Wight/.test(fellTxt) && fallenCard, fellTxt);
  ok('the button offers another hero, not the fallen one', (await txt('.hr-ride')) === 'RIDE AS ' + setup.starterName.toUpperCase(), await txt('.hr-ride'));
  await tap('.hr-hall'); const cur1 = await page.evaluate(() => R.ui.cur); await tap('.hr-ride'); const cur2 = await page.evaluate(() => R.ui.cur); const stillAfter = await count('.hr-fell');
  ok('taps: the hall opens from the roster and CHOOSE A HERO returns to it (after-death kept)', cur1 === 'hall' && cur2 === 'heroes' && stillAfter === 1, [cur1, cur2, stillAfter].join(' '));
  try { fs.mkdirSync(path.resolve(__dirname, '..', '..', '.shots'), { recursive: true }); await page.screenshot({ path: path.resolve(__dirname, '..', '..', '.shots', 'rpg_heroes.png') }); } catch (e) {}
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(T, null, 1)); const bad = Object.values(T).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
