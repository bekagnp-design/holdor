// v1.0.96: the menus move. Real taps: the home in each look (B → C → A with 🎨) has the motes layer over the stage art and the motes
// move, BATTLE breathes (its glow animates), a drag tilts the stage (parallax); a tab tap grows the new tab out of the tapped side and the
// animation ends (nothing left half-transparent); the tapped tab flashes; ready chest slots wobble and glow; the currencies glint; a modal
// pops on a spring; Champions: portraits breathe, Epic/Legendary shimmer; a hidden page drops the class; no layer exists in a battle and
// the battle's numbers are the same with the layer on and off; the battle's draw costs the same; reduced motion: none of it.
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
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 400 : ms); };
  const setup = async () => { await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FXUI && window.HOLDOR_HOME, { timeout: 20000 }); await page.waitForTimeout(300);
    await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
      a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
      for (let i = 1; i <= 9; i++) a.campaign[i] = 3; a.freeChestAt = Date.now() - 90000000; a.holdTut = 1; a.holdIntro = 1; a.gold = 900; a.gems = 60; H.setAcc(a); H.showHub('shop'); });
    await page.waitForTimeout(700); };
  await page.goto(URL); await page.evaluate(() => localStorage.removeItem('holdor_skin')); await page.goto(URL); await setup();
  // ---- the home, by a real tap on the Battle tab, in B (a new device), then C and A with 🎨
  await tap('.hubtabs button[data-tab="battle"]', 900);
  const motes = () => page.evaluate(() => [...document.querySelectorAll('#hmStage .fxamb i')].filter(e => getComputedStyle(e).display !== 'none').slice(0, 6).map(e => { const r = e.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top); }).join(' '));
  const homeState = () => page.evaluate(() => { const L = document.querySelector('#hmStage .fxamb'), g = document.querySelector('.battlerow .fxglow'), sw = L && L.querySelector('.fxsw');
    return { skin: window.HOLDOR_HOME.skinOf(), root: document.documentElement.classList.contains('fxui'), layer: !!L, n: L ? L.querySelectorAll('i').length : 0, mode: L ? L.className : '',
      under: L ? +getComputedStyle(L).zIndex < +getComputedStyle(document.querySelector('.hmgoal')).zIndex : false,
      sweep: sw ? getComputedStyle(sw).animationName : '', glow: g ? getComputedStyle(g).animationName : '', glowOp: g ? +getComputedStyle(g).opacity : -1,
      glowFits: g ? Math.abs(g.getBoundingClientRect().width - document.getElementById('bBattle').getBoundingClientRect().width) < 12 : false }; });
  for (const look of ['b', 'c', 'a']) {
    if (look !== 'b') await tap('#bSkin', 900);
    const s1 = await homeState(), m1 = await motes(); await page.waitForTimeout(700); const s2 = await homeState(), m2 = await motes();
    ok(`home ${look.toUpperCase()}: the motes layer sits over the art under the goal, its motes move, the light sweeps`,
      s1.skin === look && s1.root && s1.layer && s1.n >= 10 && s1.under && m1 !== m2 && s1.sweep === 'fxSweep', JSON.stringify({ s1, m1, m2 }));
    ok(`home ${look.toUpperCase()}: BATTLE breathes (its glow animates)`, s1.glow === 'fxBreathe' && s1.glowFits && s1.glowOp !== s2.glowOp, `${s1.glowOp} → ${s2.glowOp}`);
    await page.screenshot({ path: SC + `fx96_ui_home_${look}.png` });
  }
  // stark: snow falls; a tap on the stage still strikes (the layer lets taps through)
  ok('stark snow falls; the layer does not take taps', await page.evaluate(() => /fall/.test(document.querySelector('.fxamb').className) && getComputedStyle(document.querySelector('.fxamb')).pointerEvents === 'none'));
  // parallax: a drag on the stage moves the layers, letting go brings them back
  const st = await page.locator('#hmStage').boundingBox();
  await page.mouse.move(st.x + 24, st.y + 70); await page.mouse.down(); await page.mouse.move(st.x + 74, st.y + 90, { steps: 5 });   // under the 56 px tab swipe await page.waitForTimeout(120);
  const par1 = await page.evaluate(() => document.getElementById('hmStage').style.getPropertyValue('--fxpx'));
  await page.mouse.up(); await page.waitForTimeout(150);
  const par2 = await page.evaluate(() => document.getElementById('hmStage').style.getPropertyValue('--fxpx'));
  ok('a drag on the stage tilts it (parallax) and letting go brings it back', +par1 > 0.4 && +par2 === 0, par1 + ' → ' + par2);
  const tilt = await page.evaluate(async () => { const fire = (g, b) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: g }));
    fire(0, 40); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); fire(12, 40); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const v = document.getElementById('hmStage').style.getPropertyValue('--fxpx'); fire(0, 40); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return v; });
  ok('a tilt of the phone (DeviceOrientation) moves the stage layers', +tilt > 0.4, tilt);
  await page.evaluate(() => { const h = document.getElementById('hmHero'); if (h) h.classList.remove('atk'); });
  // ready chest slots wobble and glow; the currencies glint
  const att = await page.evaluate(() => { const s = document.querySelector('.slot.ready'), si = s && s.querySelector('.si');
    return { ready: document.querySelectorAll('.slot.ready').length, wob: si ? getComputedStyle(si).animationName : '', halo: s ? getComputedStyle(s, '::after').animationName : '',
      glint: [...document.querySelectorAll('.hubtop .cur>span')].map(e => getComputedStyle(e, '::after').animationName) }; });
  ok('ready chest slots wobble (juice) and glow; the currency icons glint', att.ready >= 2 && att.wob === 'jWig' && att.halo === 'fxHalo' && att.glint.length >= 2 && att.glint.every(x => x === 'fxGlint'), JSON.stringify(att));
  // ---- a tab switch by a real tap: Collection grows out of its tab, the animation ends, nothing stays half-transparent
  await page.locator('.hubtabs button[data-tab="coll"]').first().tap({ force: true }); await page.waitForTimeout(70);
  const mid = await page.evaluate(() => { const b = document.getElementById('hubBody'); return { fxin: b.classList.contains('fxin'), an: getComputedStyle(b).animationName, ox: b.style.getPropertyValue('--fxox'), op: +getComputedStyle(b).opacity, flash: !!document.querySelector('.hubtabs button.on .fxtapf') }; });
  await page.screenshot({ path: SC + 'fx96_ui_tab_mid.png' });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => { const b = document.getElementById('hubBody'); const half = [...b.querySelectorAll('*')].filter(e => { const o = +getComputedStyle(e).opacity; return o > 0.02 && o < 0.98 && !e.closest('.lock,.done,.off,.dim'); }).map(e => e.className).slice(0, 5);
    return { fxin: b.classList.contains('fxin'), slide: /slide-/.test(b.className), op: getComputedStyle(b).opacity, anims: b.getAnimations().length, rise: b.querySelectorAll('.jrise').length, half }; });
  ok('a tab tap: the new tab grows out of the tapped side (fxTabIn, origin at the Collection tab) and the tab flashes', mid.fxin && mid.an === 'fxTabIn' && parseInt(mid.ox) > 15 && parseInt(mid.ox) < 45 && mid.flash, JSON.stringify(mid));
  ok('the tab animation ends: no class left, opacity 1, nothing half-transparent', !after.fxin && !after.slide && after.op === '1' && after.anims === 0 && after.rise === 0 && !after.half.length, JSON.stringify(after));
  // ---- Champions: portraits breathe, Epic/Legendary shimmer
  await tap('.subtabs button[data-sub="heroes"]', 900);
  const lockedSheen = await page.evaluate(() => ({ locked: document.querySelectorAll('#hubBody .ccard.lock[data-c]').length, sheen: document.querySelectorAll('#hubBody .ccard.lock.fxrE,#hubBody .ccard.lock.fxrL').length }));
  ok('locked Epic/Legendary cards do not shimmer', lockedSheen.locked > 0 && lockedSheen.sheen === 0, JSON.stringify(lockedSheen));
  await page.evaluate(() => { const H = window.HOLDOR; for (let i = 1; i <= 50; i++) H.ACC.campaign[i] = 3; });   // every rarity unlocked
  await tap('.subtabs button[data-sub="heroes"]', 900);
  const col = await page.evaluate(() => { const br = document.querySelector('#hubBody .ccard.fxbr.fxvis .im img, #hubBody .ccard.fxbr.fxvis .im .pe'), sh = document.querySelector('#hubBody .ccard.fxrL.fxvis,#hubBody .ccard.fxrE.fxvis');
    return { cards: document.querySelectorAll('#hubBody .ccard[data-c]').length, leg: document.querySelectorAll('#hubBody .ccard.fxrL').length, epic: document.querySelectorAll('#hubBody .ccard.fxrE').length,
      breath: br ? getComputedStyle(br).animationName : '', sheen: sh ? getComputedStyle(sh, '::after').animationName : '',
      offscreen: [...document.querySelectorAll('#hubBody .ccard[data-c]')].filter(e => e.getBoundingClientRect().top > innerHeight + 60 && e.classList.contains('fxvis')).length }; });
  ok('Champions: unlocked portraits breathe, Epic and Legendary cards shimmer, cards off screen rest', col.cards > 10 && col.leg > 0 && col.epic > 0 && col.breath === 'fxBreath' && col.sheen === 'fxSheen' && col.offscreen === 0, JSON.stringify(col));
  await page.screenshot({ path: SC + 'fx96_ui_collection.png' });
  // ---- a modal pops on a spring
  await tap('.hubtabs button[data-tab="battle"]', 700);
  await page.evaluate(() => window.HOLDOR_FXUI.ecoModal('The Iron Bank', '<p style="margin:8px 0">A modal for the test.</p>', [{ t: 'Close' }]));
  await page.waitForTimeout(120);
  const pop = await page.evaluate(() => { const m = document.querySelector('#ecoModal.on .em'); return m ? getComputedStyle(m).animationName : ''; });
  await page.screenshot({ path: SC + 'fx96_ui_modal.png' });
  ok('a modal pops on a spring (fxPop)', pop === 'fxPop', pop);
  await page.waitForTimeout(500); await tap('#ecoModal.on button', 400);
  // ---- a hidden page drops the root class; visible again brings it back
  const vis = await page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange')); const hid = document.documentElement.classList.contains('fxui');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); const back = document.documentElement.classList.contains('fxui');
    delete document.hidden; return { hid, back }; });
  ok('a hidden page pauses it all (the root class goes) and it comes back', !vis.hid && vis.back, JSON.stringify(vis));
  // ---- battle: no layer, and the numbers are the same with the layer on and off
  const inb = await page.evaluate(async () => { const H = window.HOLDOR; H.showHub('battle'); await new Promise(r => setTimeout(r, 300)); const before = window.HOLDOR_FXUI.homeRaf();
    H.startGame({ level: H.stageLevel(3) }); for (let i = 0; i < 60; i++) H.step(); await new Promise(r => setTimeout(r, 400));
    return { amb: document.querySelectorAll('.fxamb').length, glow: document.querySelectorAll('.fxglow').length, root: document.documentElement.classList.contains('fxui'), state: H.G.state, homeLoopBefore: !!before, homeLoop: window.HOLDOR_FXUI.homeRaf() }; });
  ok('no layer exists during a battle (and the root class is off)', inb.state === 'play' && !inb.amb && !inb.glow && !inb.root, JSON.stringify(inb));
  ok('the home canvas loop stops when a battle starts (it ran on the home screen)', inb.homeLoopBefore && inb.homeLoop === 0, JSON.stringify(inb));
  const same = await page.evaluate(() => { const H = window.HOLDOR, F = window.HOLDOR_FXUI;
    const run = on => { F.FXUI.off = !on; H.G.state = 'menu'; H.showHub('battle'); const lay = !!document.querySelector('.fxamb'); H.startGame({ level: H.stageLevel(4) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false;
      for (let i = 0; i < 60 * 45; i++) { if (H.canCall()) H.callWave(); H.step(); }
      const en = (G.enemies || []).map(e => Object.keys(e).filter(k => typeof e[k] === 'number').sort().map(k => k + '=' + Math.round(e[k] * 100) / 100).join(':')).join('|');
      return { lay, d: [Math.round(G.gold), Math.round(G.doorHp), G.kills, G.wave, (G.enemies || []).length, en].join(',') }; };
    const a = run(true), b = run(false); F.FXUI.off = false; return { on: a, off: b }; });
  ok('the battle ends with the same numbers with the layer on and off (gold, gate, kills, wave, enemies and their positions)', same.on.lay && !same.off.lay && same.on.d === same.off.d, same.on.d.slice(0, 160) + ' … ' + same.on.d.length + ' chars');
  // ---- the battle's draw costs the same (the layer is not there): ~300 frames each
  const perf = async on => page.evaluate(async on => { const H = window.HOLDOR, F = window.HOLDOR_FXUI; F.FXUI.off = !on; H.G.state = 'menu'; H.showHub('battle'); await new Promise(r => setTimeout(r, 300));
    H.startGame({ level: H.stageLevel(4) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; for (let i = 0; i < 60 * 8; i++) { if (H.canCall()) H.callWave(); H.step(); }
    const T = F.drawTimer(); await new Promise(r => setTimeout(r, 200)); T.ms = 0; T.n = 0; const t0 = performance.now(); while (T.n < 300 && performance.now() - t0 < 20000) await new Promise(r => setTimeout(r, 100));
    const ms = T.ms / Math.max(1, T.n); G.paused = true; F.FXUI.off = false; return { ms: Math.round(ms * 1000) / 1000, n: T.n }; }, on);
  const pOff = await perf(false), pOn = await perf(true);
  ok('the battle draw costs the same with the layer on (it is not there) — ms/frame off vs on', pOn.n >= 250 && pOff.n >= 250 && pOn.ms < pOff.ms + 1.5, `off ${pOff.ms} · on ${pOn.ms} (${pOff.n}/${pOn.n} frames)`);
  // ---- the home's frame time with the layer on and off (headless, rAF interval)
  const hperf = async on => page.evaluate(async on => { const H = window.HOLDOR, F = window.HOLDOR_FXUI; F.FXUI.off = !on; H.G.state = 'menu'; H.showHub('battle'); await new Promise(r => setTimeout(r, 400));
    let n = 0, sum = 0, last = 0; await new Promise(res => { const f = now => { if (last) { sum += now - last; n++; } last = now; if (n < 180) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    F.FXUI.off = false; return Math.round(sum / n * 100) / 100; }, on);
  const hOff = await hperf(false), hOn = await hperf(true);
  ok('home frame interval (rAF, headless) with the layer off vs on', hOn < hOff + 6, `off ${hOff} ms · on ${hOn} ms`);
  // ---- reduced motion: none of it
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.HOLDOR.G.state = 'menu'; window.HOLDOR.showHub('shop'); }); await page.waitForTimeout(300);
  await tap('.hubtabs button[data-tab="battle"]', 120);
  const rm = await page.evaluate(() => ({ calm: window.HOLDOR_FXUI.fxuiCalm(), root: document.documentElement.classList.contains('fxui'), amb: document.querySelectorAll('.fxamb').length, glow: document.querySelectorAll('.fxglow').length,
    fxin: document.getElementById('hubBody').classList.contains('fxin'), glint: getComputedStyle(document.querySelector('.hubtop .cur>span'), '::after').animationName }));
  ok('reduced motion: no motes, no glow, no tab growth, no glint', rm.calm && !rm.root && !rm.amb && !rm.glow && !rm.fxin && rm.glint === 'none', JSON.stringify(rm));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  console.log(JSON.stringify(R, null, 1)); console.log('PERF battle draw ms/frame off', pOff.ms, 'on', pOn.ms, '· home rAF ms off', hOff, 'on', hOn); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
