// v1.5.0: the champion animations refined — hit flash, knockback, sparks, deaths on the blow, landing damage numbers, crit numbers for
// ultimates, a camera shake inside the demo canvas only, the idle weight shift, the card's parallax on the tilt, reduced motion respected.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_DEMO && window.HOLDOR_GUIDE && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(600);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= 20; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); });
  // 1. every one of the eleven kinds draws at the moments that matter (before, on, right after the blow, late) without throwing or going blank
  const kinds = await page.evaluate(() => { const GD = window.HOLDOR_GUIDE, bad = [], cats = Object.keys(GD.SKSETS).concat(['generic']);
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d');
    for (const cat of cats) { const sk = cat === 'generic' ? 'no_such_skill' : GD.SKSETS[cat].split(' ')[0]; if (GD.skCat(sk) !== cat) bad.push(cat + ':cat'); for (const t of [0.3, 1.25, 1.31, 1.35, 1.5, 2.9, 4.45]) { try { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 320, 180); GD.skillDemoFrame(c, sk, t, 'stark', 'robb'); const d = c.getImageData(0, 0, 320, 180).data, u = new Set(); for (let i = 0; i < d.length; i += 40) u.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); if (u.size < 25) bad.push(cat + '@' + t + ':blank'); const m = c.getTransform(); if (m.a !== 1 || m.e !== 0 || m.f !== 0) bad.push(cat + '@' + t + ':transform-leak'); } catch (e) { bad.push(cat + '@' + t + ':' + e.message); } } }
    return { n: cats.length, bad }; });
  ok('all 11 kinds draw at 7 moments without an error, a blank or a leaked transform', kinds.n === 11 && kinds.bad.length === 0, JSON.stringify(kinds).slice(0, 300));
  // 2. the champion demo at 1.25 s and 1.35 s (the cleave lands at 1.30 s): the frames differ, and the same t draws the same frame twice (deterministic)
  const diff = await page.evaluate(() => { const D = window.HOLDOR_DEMO; const draw = t => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d'); D.demoFrame(c, 'champ', 'robb', t); return c.getImageData(0, 0, 320, 180).data; };
    const cmp = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n; };
    const a = draw(1.25), b = draw(1.35), b2 = draw(1.35), s1 = draw(1.31), s2 = draw(1.33); return { ab: cmp(a, b), bb: cmp(b, b2), shake: cmp(s1, s2) }; });
  ok('champion demo: t=1.25 and t=1.35 differ (pixels), t=1.35 twice is identical, the shake frames differ', diff.ab > 300 && diff.bb === 0 && diff.shake > 300, JSON.stringify(diff));
  // 3. an ultimate's damage numbers are gold crits (near #ffd23c); the plain strike's are not
  const crit = await page.evaluate(() => { const GD = window.HOLDOR_GUIDE; const gold = sk => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d'); GD.skillDemoFrame(c, sk, 1.55, 'stark', 'arya'); const d = c.getImageData(0, 0, 320, 180).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 235 && d[i + 1] > 190 && d[i + 1] < 228 && d[i + 2] < 95) n++; return n; }; return { ult: gold('assassinate'), plain: gold('crit'), isUlt: !!(window.HOLDOR.SK && window.HOLDOR.SK.assassinate && window.HOLDOR.SK.assassinate.ult) }; });
  ok('an ultimate pops gold crit numbers, a plain strike does not', crit.ult > 150 && crit.ult > crit.plain * 3, JSON.stringify(crit));
  // 4. the enemies: a hit flashes white and knocks back (the hit frame is brighter where the enemy stands and the body shifts right), the death starts on the blow
  const hit = await page.evaluate(() => { const GD = window.HOLDOR_GUIDE; const frame = t => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d'); GD.skillDemoFrame(c, 'crit', t, 'stark', 'arya'); return c.getImageData(0, 0, 320, 180).data; };
    const white = d => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248) n++; return n; };
    const before = white(frame(1.40)), on = white(frame(1.47)), late = white(frame(1.75)); return { before, on, late }; });
  ok('the hit frame is far whiter than the frame before it (flash + spark), and the glow has gone by the fall', hit.on > hit.before + 400 && hit.late < hit.on, JSON.stringify(hit));
  // 5. the card: the glare variables carry the crest (parallax by CSS only), the card lifts while held
  await page.evaluate(() => window.HOLDOR_ARMY.showHeroRoom('robb')); await page.waitForTimeout(400);
  const card = await page.evaluate(() => { const el = document.querySelector('.acard'), sig = document.querySelector('.asig'); if (!el || !sig) return null; const read = () => getComputedStyle(sig).translate;
    el.style.setProperty('--gx', '20%'); el.style.setProperty('--gy', '20%'); const a = read(); el.style.setProperty('--gx', '80%'); el.style.setProperty('--gy', '60%'); const b = read();
    const st = document.querySelector('.hstage'); st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 300, pointerId: 1 })); const held = el.classList.contains('held'); st.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); const rel = el.classList.contains('held');
    return { a, b, held, rel, glare: getComputedStyle(document.querySelector('.aglare')).backgroundImage.split('gradient').length - 1 }; });
  ok('the crest moves with --gx/--gy, the card is held on pointerdown and released on pointerup, the glare has two layers', card && card.a !== card.b && card.held && !card.rel && card.glare === 2, JSON.stringify(card));
  await page.screenshot({ path: SC + 'anim150_room.png' });
  // 6. reduced motion: the crest does not move, the card does not lift, the idle drift is off
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.HOLDOR_ARMY.showHeroRoom('robb')); await page.waitForTimeout(700);
  const rm = await page.evaluate(() => { const el = document.querySelector('.acard'), sig = document.querySelector('.asig'); el.style.setProperty('--gx', '80%'); const tr = getComputedStyle(sig).translate; el.classList.add('held'); const sc = getComputedStyle(el).scale; el.classList.remove('held'); return { tr, sc, ry: el.style.getPropertyValue('--ry'), anim: getComputedStyle(document.querySelector('.hhead .hstage')).animationName }; });
  ok('reduced motion: crest still, no lift, the card does not drift, the float animation is off', rm && /^(none|0px 0px|0px)$/.test(rm.tr) && (rm.sc === 'none' || rm.sc === '1') && Math.abs(parseFloat(rm.ry) || 0) < 0.01 && rm.anim === 'none', JSON.stringify(rm));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
