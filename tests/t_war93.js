// v1.0.93: the realm war screen, with real taps against a fake of the server's realm_war (the real function is in backend/test/v25_test.py).
// The Realms screen has the ⚔️ button; the war screen shows the countdown, my week, the realms in order (medals, flags, score, details),
// my realm highlighted, the scoring rule; an empty week says so; a failing server keeps the last standings; offline says it needs the backend.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_WAR, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR, W = window.HOLDOR_WAR.WAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; H.setAcc(a);
    window.__fail = false; window.__n = 0;
    W.rpc = () => { window.__n++; if (window.__fail) return Promise.reject(new Error('Failed to fetch')); return Promise.resolve({ week_start: '2026-09-28', ends_at: new Date(Date.now() + (2 * 86400 + 5 * 3600 + 120) * 1000).toISOString(),
      realms: [{ realm: 0, players: 12, active: 5, avg50: 30.5, total: 366, score: 33, pos: 1 }, { realm: 3, players: 60, active: 40, avg50: 10, total: 600, score: 30, pos: 2 }, { realm: 5, players: 1, active: 0, avg50: 4, total: 4, score: 4, pos: 3 }, { realm: 7, players: 2, active: 0, avg50: 2, total: 4, score: 2, pos: 4 }],
      mine: { realm: 0, points: 41, days: 3, pos: 1, score: 33 } }); };
    window.HOLDOR_WAR.showRealms(false); });
  await page.waitForTimeout(500);
  ok('the Realms screen has the ⚔️ Realm war button', await page.evaluate(() => !!document.getElementById('bWar')));
  await page.locator('#bWar').tap(); await page.waitForTimeout(700);
  const A = await page.evaluate(() => ({ left: (document.querySelector('.wleft') || {}).textContent, rows: [...document.querySelectorAll('.wrow')].map(r => r.querySelector('.wk').textContent + '|' + r.querySelector('.ws').textContent), me: [...document.querySelectorAll('.wrow.me')].length,
    mine: (document.querySelector('#warBody .statbox') || {}).textContent, flags: document.querySelectorAll('.wrow .flag').length, how: /top 50 players/.test(document.body.textContent) }));
  await page.screenshot({ path: SC + 'war93.png' });
  ok('the countdown: this week ends in 2d 5h', /ends in\s*2d 5h/.test(A.left || ''), A.left);
  ok('the realms in order with medals and scores', JSON.stringify(A.rows) === JSON.stringify(['🥇|33', '🥈|30', '🥉|4', '#4|2']) && A.flags === 4, JSON.stringify(A));
  ok('my realm is highlighted and my week is shown (41 waves, 3 days, #1)', A.me === 1 && /41/.test(A.mine) && /3/.test(A.mine) && /#1/.test(A.mine), A.mine);
  ok('the scoring rule is written on the screen', A.how);
  await page.evaluate(() => { window.__fail = true; }); const n0 = await page.evaluate(() => window.__n);
  await page.waitForTimeout(31000);
  const B = await page.evaluate(() => ({ calls: window.__n, st: document.getElementById('warSt').textContent, rows: document.querySelectorAll('.wrow').length }));
  ok('it refreshes every 30 s; a failing server keeps the last standings and says so', B.calls > n0 && /No connection/.test(B.st) && B.rows === 4, JSON.stringify(B));
  await page.evaluate(() => { window.__fail = false; window.HOLDOR_WAR.WAR.data = null; window.HOLDOR_WAR.WAR.rpc = () => Promise.resolve({ week_start: '2026-09-28', ends_at: new Date(Date.now() + 86400000).toISOString(), realms: [], mine: null }); window.HOLDOR_WAR.showRealmWar(() => {}); });
  await page.waitForTimeout(500);
  ok('an empty week says so', await page.evaluate(() => /No Hold runs yet this week/.test(document.getElementById('warBody').textContent) && document.querySelectorAll('.wrow').length === 0));
  await page.locator('#bBack').tap(); await page.waitForTimeout(300);
  const n1 = await page.evaluate(() => window.HOLDOR_WAR.WAR.timer && 1); const c1 = await page.evaluate(() => window.__n);
  await page.evaluate(() => { window.HOLDOR_WAR.WAR.rpc = null; window.HOLDOR_WAR.showRealmWar(() => {}); }); await page.waitForTimeout(300);
  ok('offline: the screen says it needs the online backend', await page.evaluate(() => /needs the online backend/.test(document.body.textContent) && !document.querySelector('.wrow')));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
