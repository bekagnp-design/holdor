// v1.0.55: realm (country) statistics for everyone — players in every realm list, the realm card, Events → Realms.
// The backend is mocked (the leaderboard and realm_card answers of backend v4); backend/test/realms_test.py checks
// the same screens against the real SQL.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const LB = { total: 7, players: 4, countries: 4, day: '2026-09-27', at: '2026-09-27T10:00:00Z', me: null, myday: null, today: [],
  realms: [{ realm: 3, players: 2, seats: 2, waves: 39, stars: 66, kills: 10828, active: 2, today: 31, today_players: 1 },
           { realm: 0, players: 3, seats: 3, waves: 15, stars: 26, kills: 1390, active: 1, today: 0, today_players: 0 },
           { realm: 11, players: 1, seats: 1, waves: 12, stars: 24, kills: 940, active: 0, today: 0, today_players: 0 },
           { realm: 2, players: 1, seats: 1, waves: 0, stars: 0, kills: 0, active: 0, today: 0, today_players: 0 }],
  top: [{ tg_id: 2, seat: 2, name: 'P2', house: 'targaryen', realm: 3, stars: 49, gates: 34, waves: 26, kills: 5045, rank: 1 }],
  houses: [{ house: 'targaryen', players: 2, seats: 3, waves: 41, stars: 66, kills: 5935, today: 31 }, { house: 'stark', players: 3, seats: 3, waves: 13, stars: 26, kills: 6283, today: 0 }] };
const CARD3 = { realm: 3, players: 2, seats: 2, waves: 39, stars: 66, kills: 10828, gates: 40, best: 26, active: 2, today: 31, today_players: 1, me: null, day: '2026-09-27', at: '2026-09-27T10:00:00Z',
  houses: [{ house: 'targaryen', players: 1, seats: 1, waves: 26, stars: 49 }, { house: 'stark', players: 1, seats: 1, waves: 13, stars: 17 }],
  top: [{ tg_id: 2, seat: 2, name: 'P2', house: 'targaryen', stars: 49, gates: 34, waves: 26, kills: 5045, rank: 1 },
        { tg_id: 3, seat: 0, name: 'P3', house: 'stark', stars: 17, gates: 6, waves: 13, kills: 5783, rank: 2 }] };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|status of 5/.test(m.text())) errors.push('C:' + m.text()); });
  let cardMode = 'ok', calls = [];
  await page.route(/telegram\.org/, r => r.abort());
  await page.route(/\/rest\/v1\/rpc\//, async r => {
    const fn = r.request().url().split('/').pop(); const body = JSON.parse(r.request().postData() || '{}'); calls.push([fn, body]);
    if (fn === 'leaderboard') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LB) });
    if (fn === 'realm_card') {
      if (cardMode === 'down') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"down"}' });
      const c = body.realm === 3 ? CARD3 : { realm: body.realm, players: 0, seats: 0, waves: 0, stars: 0, kills: 0, gates: 0, best: 0, active: 0, today: 0, today_players: 0, houses: [], top: [], me: null };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) });
    }
    return r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"no"}' });
  });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_REALMS, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tapEl = async (sel) => { await page.locator(sel).first().tap(); await page.waitForTimeout(450); };
  const txt = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);
  const grid = () => page.evaluate(() => [...document.querySelectorAll('#card .statbox .gr b')].map(b => b.innerText));
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.learn = { chest: 1, hold: 1, champ: 1 };
    for (let i = 1; i <= 3; i++) a.campaign[i] = 3; H.SAVE.slots[0] = a; H.SAVE.cur = 0; H.setAcc(a); H.persist(); });
  await page.evaluate(() => window.HOLDOR.fetchLeaderboard(true)); await page.waitForTimeout(300);
  // the global realm screen
  await page.evaluate(() => window.HOLDOR.showRealms(false)); await page.waitForTimeout(500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#card .rrow')].map(b => [+b.dataset.j, b.querySelector('.pp').innerText.replace(/\s+/g, ' ').trim()]));
  ok('193 rows with players', rows.length === 193 && rows.every(r => /^\d+ players?$/.test(r[1])), rows.length + ' ' + JSON.stringify(rows.slice(0, 5)));
  ok('players per realm', JSON.stringify(rows.slice(0, 4)) === JSON.stringify([[3, '2 players'], [0, '3 players'], [11, '1 player'], [2, '1 player']]), JSON.stringify(rows.slice(0, 4)));
  ok('empty realm shows 0', rows.slice(4).every(r => r[1] === '0 players'));
  ok('status totals', /Live · 4 players · 4 countries · 7 defenders · updated/.test(await txt('#card .sub')), await txt('#card .sub'));
  ok('my realm box says players', /3\s+players/.test(await txt('#bMyRealm')), (await txt('#bMyRealm')).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'rl2_realms.png' });
  // tap Germany → the card
  await tapEl('#card .rrow[data-j="3"]'); await page.waitForTimeout(300);
  const card = await txt('#card');
  ok('card numbers', JSON.stringify(await grid()) === JSON.stringify(['2', '2', '2', '39', '66', '10,828', '31', '1', '26']), JSON.stringify(await grid()));
  ok('card head', /Germany/.test(card) && /realm rank #1 of 193/.test(card) && /Live · updated/.test(card) && /Per player: 20 🌊 · 33 ⭐/.test(card), card.slice(0, 160).replace(/\n/g, ' | '));
  ok('card houses', /House Targaryen\s+1 defender · 26 🌊 · 49 ⭐/.test(card) && /House Stark\s+1 defender · 13 🌊 · 17 ⭐/.test(card));
  ok('card defenders', await page.evaluate(() => [...document.querySelectorAll('#card .lbrow')].length === 2) && /🏆101 · ⭐49 · 🌊26/.test(card) && /🏆43 · ⭐17 · 🌊13/.test(card));
  ok('realm_card called with seat', calls.some(c => c[0] === 'realm_card' && c[1].realm === 3 && c[1].seat === 0));
  await page.screenshot({ path: SC + 'rl2_card.png', fullPage: true });
  await tapEl('#bRcBack');
  ok('back to realms', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'realms'));
  // the backend down: the card keeps the realm's line from the leaderboard and says so
  cardMode = 'down';
  await tapEl('#card .rrow[data-j="11"]'); await page.waitForTimeout(400);
  const c11 = await txt('#card');
  ok('card offline fallback', JSON.stringify((await grid()).slice(0, 6)) === JSON.stringify(['1', '1', '0', '12', '24', '940']) && /Could not reach the realm/.test(c11) && !/Houses fighting/.test(c11), c11.slice(0, 200).replace(/\n/g, ' | '));
  cardMode = 'ok';
  // an empty realm
  await page.evaluate(() => window.HOLDOR_REALMS.showRealmCard(150)); await page.waitForTimeout(400);
  const c150 = await txt('#card');
  ok('empty realm', /no defender yet/.test(c150) && /No house holds/.test(c150) && /be the first to fight/.test(c150) && !/realm rank/.test(c150), c150.slice(0, 120).replace(/\n/g, ' | '));
  // Events → Realms
  await page.evaluate(() => window.HOLDOR.showHub('events')); await page.waitForTimeout(500);
  const ev = await page.evaluate(() => [...document.querySelectorAll('.rlink')].map(b => [+b.dataset.j, b.querySelector('.nm small').innerText]));
  ok('events rows with players only', JSON.stringify(ev) === JSON.stringify([[3, '👥 2'], [0, '👥 3'], [11, '👥 1'], [2, '👥 1']]), JSON.stringify(ev));
  ok('events totals', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.rcsum span')].map(e => e.innerText))) === JSON.stringify(['👥 4 players', '🌍 4 countries', '🛡️ 7 defenders']));
  ok('events rank badges', await page.evaluate(() => { const b = [...document.querySelectorAll('.rlink .rk')].map(e => getComputedStyle(e).backgroundImage.slice(0, 40)); return /gradient/.test(b[0]) && b[0] !== b[1] && /gradient/.test(b[2]) && !/gradient/.test(b[3]); }));
  await page.screenshot({ path: SC + 'rl2_events.png' });
  await tapEl('.rlink[data-j="0"]'); await page.waitForTimeout(300);
  ok('events → Georgia card', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'realm:0'));
  await tapEl('#bBack');
  ok('✖ back to events', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'hub:events'));
  await page.evaluate(() => window.HOLDOR.showHub('events', 'houses')); await page.waitForTimeout(300);
  const hs = await page.evaluate(() => [...document.querySelectorAll('.hpanel .standrow .nm small')].map(e => e.innerText));
  ok('houses: players and defenders', JSON.stringify(hs) === JSON.stringify(['2 players · 3 defenders', '3 players · 3 defenders']), JSON.stringify(hs));
  // a leaderboard cached by an older build (no players / countries / seats): no totals, no errors
  await page.evaluate(() => { const H = window.HOLDOR; const lb = JSON.parse(JSON.stringify(H.CLOUD.lb)); delete lb.players; delete lb.countries; lb.realms.forEach(r => { delete r.seats; delete r.active; delete r.today; delete r.today_players; }); H.CLOUD.lb = lb; H.CLOUD.lbAt = Date.now(); H.showHub('events'); });
  await page.waitForTimeout(300);
  ok('old cache: no totals row', await page.evaluate(() => !document.querySelector('.rcsum') && document.querySelectorAll('.rlink').length === 4));
  await page.evaluate(() => window.HOLDOR.showRealms(false, '', true)); await page.waitForTimeout(300);
  ok('old cache: status line', /Live · 7 defenders · updated/.test(await txt('#card .sub')), await txt('#card .sub'));
  // choosing a realm for a new seat speaks of players
  await page.evaluate(() => window.HOLDOR.newLang(1, '', 3)); await page.waitForTimeout(300);
  ok('realm picker: players', /2\s+players/.test(await txt('#card .statbox')) && /per player/.test(await txt('#card .statbox')), (await txt('#card .statbox')).replace(/\n/g, ' '));
  console.log(JSON.stringify(R, null, 1));
  const bad = Object.entries(R).filter(([k, v]) => !v.startsWith('OK'));
  if (bad.length) console.log('FAILS:', bad.map(b => b[0]).join(', '));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' || ') : 'ERRORS: none');
  await browser.close();
  process.exit(bad.length || errors.length ? 1 : 0);
})();
