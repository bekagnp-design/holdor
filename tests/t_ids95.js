// v1.0.95: the public boards carry no Telegram ids (backend v27). A row says `mine`; the app highlights exactly that row.
// (An older server still sends tg_id + seat and no `mine`: `lbIsMe` falls back to comparing them, so the app works before and after the SQL;
// tests/t_realms.js still feeds it the old shape.)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_REALMS, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 3, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; H.setAcc(a); });
  const card = (top, me) => ({ realm: 3, players: 3, seats: 3, waves: 40, stars: 60, kills: 100, gates: 3, best: 26, active: 2, today: 0, today_players: 0, me, day: '2026-10-04', at: new Date().toISOString(), houses: [], top });
  const show = (data) => page.evaluate((d) => { const RC = window.HOLDOR_REALMS; RC.RCARD[3] = { at: Date.now(), data: d }; RC.showRealmCard(3, () => {}, true); return [...document.querySelectorAll('#card .lbrow, .lbrow')].map(r => (r.classList.contains('me') ? '*' : '') + r.querySelector('.nm').textContent.trim()); }, data);
  const rows = (n) => Array.from({ length: n }, (_, i) => i);
  // the new server: `mine`, no tg_id
  const top = [{ mine: false, seat: 0, name: 'Arya', house: 'stark', stars: 30, gates: 3, waves: 20, kills: 5, rank: 1 }, { mine: true, seat: 0, name: 'Me', house: 'stark', stars: 20, gates: 2, waves: 10, kills: 5, rank: 2 }, { mine: false, seat: 0, name: 'Bran', house: 'stark', stars: 10, gates: 1, waves: 5, kills: 5, rank: 3 }];
  const A = await show(card(top, { mine: true, seat: 0, name: 'Me', house: 'stark', stars: 20, gates: 2, waves: 10, kills: 5, rank: 2 }));
  await page.screenshot({ path: SC + 'ids95_card.png' });
  ok('rows carry `mine`, no tg_id: exactly the caller\'s row is highlighted', A.length === 3 && A.filter(x => x[0] === '*').length === 1 && /\*.*Me/.test(A.join('|')), JSON.stringify(A));
  ok('nobody is highlighted when no row is mine', (await show(card(top.map(t => Object.assign({}, t, { mine: false })), null))).every(x => x[0] !== '*'));
  // the caller's row is outside the top 10: the "me" row is added and highlighted
  const far = await show(card(top.map(t => Object.assign({}, t, { mine: false })), { mine: true, seat: 0, name: 'Far', house: 'stark', stars: 1, gates: 1, waves: 1, kills: 1, rank: 40 }));
  ok('a caller outside the top gets his own highlighted row below it', far.length === 4 && far[3][0] === '*' && /Far/.test(far[3]), JSON.stringify(far));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
