// v1.0.93 (+ last week's reward card of v1.0.94): the realm war screen, with real taps against a fake of the server's realm_war (the real function is in backend/test/v25_test.py).
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
    window.__last = { week_start: '2026-09-21', realm: 0, pos: 2, score: 30.5, realms: 6, points: 41, days: 3, eligible: true, why: null, reward: { gold: 2000, gems: 30 }, claimed: false }; window.__claims = 0;
    W.rpc = (fn, a) => { if (fn === 'war_state') return Promise.resolve({ last: window.__last });
      if (fn === 'war_claim') { window.__claims++; if (window.__last.claimed) return Promise.reject(new Error('already claimed')); window.__last = Object.assign({}, window.__last, { claimed: true }); return Promise.resolve({ ok: true, reward: window.__last.reward, last: window.__last, state: null }); }
      window.__n++; if (window.__fail) return Promise.reject(new Error('Failed to fetch')); return Promise.resolve({ week_start: '2026-09-28', ends_at: new Date(Date.now() + (2 * 86400 + 5 * 3600 + 120) * 1000).toISOString(),
      realms: [{ realm: 0, players: 12, active: 5, avg50: 30.5, total: 366, score: 33, pos: 1 }, { realm: 3, players: 60, active: 40, avg50: 10, total: 600, score: 30, pos: 2 }, { realm: 5, players: 1, active: 0, avg50: 4, total: 4, score: 4, pos: 3 }, { realm: 7, players: 2, active: 0, avg50: 2, total: 4, score: 2, pos: 4 }],
      mine: { realm: 0, points: 41, days: 3, pos: 1, score: 33 } }); };
    window.HOLDOR_WAR.showRealms(false); });
  await page.waitForTimeout(500);
  ok('the Realms screen has the ⚔️ Realm war button', await page.evaluate(() => !!document.getElementById('bWar')));
  await page.locator('#bWar').tap(); await page.waitForTimeout(700);
  const A = await page.evaluate(() => ({ left: (document.querySelector('.wleft') || {}).textContent, rows: [...document.querySelectorAll('.wrow')].map(r => r.querySelector('.wk').textContent + '|' + r.querySelector('.ws').textContent), me: [...document.querySelectorAll('.wrow.me')].length,
    mine: ([...document.querySelectorAll('#warBody .statbox')].find(b => /Your week/.test(b.textContent)) || {}).textContent, flags: document.querySelectorAll('.wrow .flag').length, how: /top 50 players/.test(document.body.textContent) }));
  await page.screenshot({ path: SC + 'war93.png' });
  ok('the countdown: this week ends in 2d 5h', /ends in\s*2d 5h/.test(A.left || ''), A.left);
  ok('the realms in order with medals and scores', JSON.stringify(A.rows) === JSON.stringify(['🥇|33', '🥈|30', '🥉|4', '#4|2']) && A.flags === 4, JSON.stringify(A));
  ok('my realm is highlighted and my week is shown (41 waves, 3 days, #1)', A.me === 1 && /41/.test(A.mine) && /3/.test(A.mine) && /#1/.test(A.mine), A.mine);
  ok('the scoring rule is written on the screen', A.how);
  // last week's war (v1.0.94): the card, the claim, the claimed state
  const LW = await page.evaluate(() => { const c = document.querySelector('.wlast'); return c && { txt: c.textContent.replace(/\s+/g, ' '), btn: (document.getElementById('bWarClaim') || {}).textContent }; });
  await page.screenshot({ path: SC + 'war94_last.png' });
  ok('last week: "Georgia finished #2 of 6", 41 waves on 3 days, a Claim button with the reward', LW && /finished #2 of 6/.test(LW.txt) && /41 waves on 3 days/.test(LW.txt) && /Claim \+30\s+\+2,000/.test(LW.btn), JSON.stringify(LW));
  await page.locator('#bWarClaim').tap(); await page.waitForTimeout(500);
  const CL = await page.evaluate(() => ({ claims: window.__claims, txt: document.querySelector('.wlast').textContent.replace(/\s+/g, ' '), btn: !!document.getElementById('bWarClaim') }));
  ok('Claim calls the server once and the card reads "✔ Claimed" with the reward', CL.claims === 1 && /✔ Claimed/.test(CL.txt) && /2,000/.test(CL.txt) && !CL.btn, JSON.stringify(CL));
  await page.evaluate(() => { window.__last = { week_start: '2026-09-21', realm: 0, pos: 4, score: 3, realms: 6, points: 8, days: 1, eligible: false, why: 'play on 3 days of a week to qualify', reward: null, claimed: false }; window.HOLDOR_WAR.WAR.last = null; window.HOLDOR_WAR.showRealmWar(() => {}); });
  await page.waitForTimeout(700);
  ok('a player who was not active: the reason is written, no button', await page.evaluate(() => /play on 3 days of a week to qualify/.test(document.querySelector('.wlast').textContent) && !document.getElementById('bWarClaim')));
  await page.evaluate(() => { window.__last = null; window.HOLDOR_WAR.WAR.last = null; window.__last = { realm: null, eligible: false, why: 'no Hold run last week' }; window.HOLDOR_WAR.showRealmWar(() => {}); }); await page.waitForTimeout(600);
  ok('no Hold run last week: no card at all', await page.evaluate(() => !document.querySelector('.wlast')));
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
