// v1.2.5: looping demos in the spell room, the tower room and the champion room — they exist, they draw, they move.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_DEMO && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= 20; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); });
  const px = () => page.evaluate(() => { const cv = document.querySelector('canvas.dmv'); if (!cv) return -1; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
  // rooms
  await page.evaluate(() => window.HOLDOR_ARMY.showHeroRoom('robb')); await page.waitForTimeout(500);
  ok('the champion room has a demo canvas', await page.locator('canvas.dmv[data-dk="champ"]').count() === 1);
  const a1 = await px(); await page.waitForTimeout(700); const a2 = await px(); ok('the champion demo moves', a1 !== a2 && a1 !== -1);
  await page.screenshot({ path: SC + 'demo_champ.png' });
  await page.evaluate(() => window.HOLDOR_ARMY.showTowerRoom('glass')); await page.waitForTimeout(500);
  ok('the tower room has a demo canvas for the chosen tower', await page.locator('canvas.dmv[data-dk="tower"][data-di="glass"]').count() === 1);
  await page.evaluate(() => window.HOLDOR_DEMO.showSpellRoom('night')); await page.waitForTimeout(500);
  ok('the spell room has a demo canvas', await page.locator('canvas.dmv[data-dk="spell"][data-di="night"]').count() === 1);
  await page.screenshot({ path: SC + 'demo_spell.png' });
  // contact sheet: every spell, every tower, at 1.9 s, plus every champion draws without errors
  const sheet = await page.evaluate(() => { const D = window.HOLDOR_DEMO, H = window.HOLDOR, bad = []; document.body.innerHTML = '<div id="cs" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#000"></div>';
    const colors = {}; const add = (kind, id) => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; cv.style.width = '100%'; document.getElementById('cs').appendChild(cv); const c = cv.getContext('2d'); try { D.demoFrame(c, kind, id, 1.9); D.demoFrame(c, kind, id, 1.9); const d = c.getImageData(0, 0, 320, 180).data, u = new Set(); for (let i = 0; i < d.length; i += 40) u.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); colors[kind + ':' + id] = u.size; if (u.size < 25) bad.push(kind + ':' + id + ':blank'); } catch (e) { bad.push(kind + ':' + id + ':' + e.message); } };
    ['arrows', 'fire', 'reinf', 'night', 'repair', 'jars', 'beacon'].forEach(k => add('spell', k)); ['watch', 'scorp', 'wild', 'glass', 'weir', 'keep', 'rook', 'maul'].forEach(k => add('tower', k));
    let n = 0; H.CHAMPS.forEach(ch => { try { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d'); for (let t = 0.5; t < 10; t += 3.2) D.demoFrame(c, 'champ', ch.id, t); n++; } catch (e) { bad.push('champ:' + ch.id + ':' + e.message); } });
    return { bad, n }; });
  ok('every spell, tower and champion draws without an error', sheet.bad.length === 0 && sheet.n >= 49, JSON.stringify(sheet).slice(0, 300));
  await page.screenshot({ path: SC + 'demo_sheet.png', fullPage: true });
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
