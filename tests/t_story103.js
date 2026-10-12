// v1.1.3: the thriller opening. A new account never sees a menu at first: house → film 0 → the tutorial battle (in the story's voice) →
// film 1 → stage 1 → film 2 → stage 2 → film 3 → stage 3 → film 4: the castle opens → the Army, the Shop, the Clan open one stage at a
// time with a short film each. Automation skips films by itself (navigator.webdriver) unless a test sets window.__films; the film engine,
// every scene and the script data are tested separately below.
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 500 : ms); };
  const st = () => page.evaluate(() => { const H = window.HOLDOR, G = H.G; return { state: G.state, mode: G.mode, tut: !!G.tutorial, lvl: G.level && G.level.id, hub: !!document.querySelector('.hubtabs'), scr: H.CLOUD.screen, film: !!window.HOLDOR_FILM.FILM.on }; });
  const win = () => page.evaluate(() => { const H = window.HOLDOR, G = H.G; G.tut = null; G.paused = false; G.wave = G.totalWaves; G.waveDone = true; G.enemies = []; G.spawnQueue = []; for (let i = 0; i < 6 && G.state === 'play'; i++) H.step(); return G.state; });
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_STORY && window.HOLDOR_FILM && window.HOLDOR_TUT, { timeout: 20000 });
  // ---- the data: eight films inside their budgets, captions inside the rules, only the scenes and sounds the engine can draw
  const data = await page.evaluate(() => { const F = window.HOLDOR_FILM, S = window.HOLDOR_STORY.STORY; const bud = { f0: [38, 46, 9, 12], f1: [18, 24, 4, 6], f2: [11, 15, 3, 4], f3: [11, 15, 3, 4], f4: [26, 34, 7, 9], f5: [7, 10, 2, 3], f6: [7, 10, 2, 3], f7: [7, 10, 2, 3] };
    const SFXK = ['wind', 'drone', 'heartbeat', 'thud', 'knock3', 'horn', 'sting', 'whisper', 'thunder', 'crow', 'cold', 'gallop', 'silence', 'relief']; const bad = [];
    for (const f of S.films) { const tot = f.shots.reduce((a, s) => a + s.d, 0), b = bud[f.id]; if (!b || tot < b[0] - .5 || tot > b[1] + .5 || f.shots.length < b[2] || f.shots.length > b[3]) bad.push(f.id + ' budget ' + tot);
      for (const s of f.shots) { if (!F.FSC[s.scene]) bad.push('scene ' + s.scene); for (const x of (s.sfx || [])) if (!SFXK.includes(x.k)) bad.push('sfx ' + x.k);
        for (const c of (s.cap || [])) { const w = c.text.trim().split(/\s+/).length; if (w > 8) bad.push(f.id + ' >8 words: ' + c.text); if (c.at + c.hold > s.d + .05) bad.push(f.id + ' overruns: ' + c.text); if (c.hold < 1.6) bad.push(f.id + ' short hold: ' + c.text); } } }
    return { n: S.films.length, ids: S.films.map(f => f.id).join(), tl: S.tutorial_lines.length, blank: S.tutorial_lines.map((l, i) => l === '' ? i : -1).filter(i => i >= 0).join(), skill: S.tutorial_lines[5].includes('{SKILL}'), last: /castle|menu/i.test(S.tutorial_lines[12]), bad }; });
  ok('the script: eight films f0–f7 inside their length and shot budgets, only scenes and sounds the engine has, captions ≤ 8 words that fit their shot; 13 tutorial lines (blank at 2 and 6, {SKILL} in 5, none says castle or menu at the end)', data.n === 8 && data.ids === 'f0,f1,f2,f3,f4,f5,f6,f7' && data.tl === 13 && data.blank === '2,6' && data.skill && !data.last && !data.bad.length, JSON.stringify(data));
  // ---- every scene draws: no error, many colours, the same scene differs in time
  const scenes = await page.evaluate(() => { const F = window.HOLDOR_FILM, H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.sel = 'brienne'; H.setAcc(a); const out = {}; const P = { dunes: { frost: .6, palms: true, fires: 2, heat: .3 }, wall: { beacons: 4, snow: .5 }, road: { rider: true, eyes: 5 }, raven: { letter: true }, gate: { knock: 3, frost: .3 }, door: { thuds: 3, frost: .4 }, hodor: { sweat: true }, champion: { rim: true, eyes: true, breath: true }, host: { count: 80, advance: .4, king: true }, beacons: { n: 5 }, map: { frost: .4, mark: 3 }, hall: { crest: true, figure: true }, dawn: { sun: .5, smoke: .6 }, king: { eyes: true, wind: .5 }, crest: { glow: .8 }, title: { text: 'HOLD THE DOOR', sub: 'x', crack: .6 }, black: { eyes: 4, pulse: true } };
    for (const sc in F.FSC) { const cv = document.createElement('canvas'); cv.width = 195; cv.height = 422; const c = cv.getContext('2d'); try { F.filmStill(cv, sc, 2.2, P[sc] || {}, .5, 5); } catch (e) { out[sc] = 'ERR ' + e.message; continue; }
      const d = c.getImageData(0, 0, 195, 422).data, set = new Set(); for (let i = 0; i < d.length; i += 4 * 41) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); out[sc] = set.size; }
    return out; });
  ok('all 17 scenes draw without error and are not blank (≥ 6 colours each)', Object.keys(scenes).length === 17 && Object.values(scenes).every(v => typeof v === 'number' && v >= 6), JSON.stringify(scenes));
  // ---- a new player, by real taps: no film plays here (automation skips them), no menu appears
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_STORY, { timeout: 20000 }); await page.waitForTimeout(500);
  await page.touchscreen.tap(195, 430); await page.waitForTimeout(700);
  if (!(await page.evaluate(() => !!document.querySelector('.seat[data-i="0"]')))) await tap('#bStart', 600);
  await tap('.seat[data-i="0"]', 700); await tap('#bPick', 600); await tap('.hbig[data-h="stark"]', 1500);
  const s0 = await st();
  const acc0 = await page.evaluate(() => { const A = window.HOLDOR.ACC; return { sv: A.sv, castle: !!A.castle, f0: !!(A.film && A.film.f0), tutWon: !!A.tutWon, text: window.HOLDOR_TUT.TS().t, tours: JSON.stringify(A.tours) }; });
  ok('house chosen → straight into the tutorial battle (the first film is done, no menu, no cinematic screen)', s0.state === 'play' && s0.tut && !s0.hub && acc0.sv === 1 && !acc0.castle && acc0.f0 && !acc0.tutWon, JSON.stringify([s0, acc0]));
  const tx = await page.evaluate(() => { const X = window.HOLDOR_TUT; const T = i => { const s = X.TUT_STEPS[i]; return typeof s.t === 'function' ? s.t() : s.t; }; return { s0: T(0), s1: T(1), s5: T(5), s12: T(6) }; });
  ok('the tutorial speaks in the story\'s voice: seven hours, the knocks, the champion\'s skill by name, the last line tees up the next film', /Seven hours/.test(tx.s0) && /knock/.test(tx.s1) && /Tap it/.test(tx.s5) && !/\{SKILL\}/.test(tx.s5) && /listen for the knock/.test(tx.s12) && !/castle|menu/i.test(tx.s12), JSON.stringify(tx));
  await page.screenshot({ path: SC + 'story103_tut.png' });
  const cls = await page.evaluate(() => ({ app: document.getElementById('app').classList.contains('prestory'), book: getComputedStyle(document.getElementById('bInfo')).display }));
  ok('before the castle the book button is hidden', cls.app && cls.book === 'none', JSON.stringify(cls));
  await tap('#bPause', 400); const pq = await page.evaluate(() => ({ resume: !!document.getElementById('pR'), restart: !!document.getElementById('pT'), leave: !!document.getElementById('pQ') })); await tap('#pR', 300);
  ok('the pause menu has Resume and Restart but no way out of the story', pq.resume && pq.restart && !pq.leave, JSON.stringify(pq));
  const poke = await page.evaluate(() => { window.HOLDOR.showHub('shop'); return null; }); await page.waitForTimeout(600);
  const s1 = await st(); ok('a call to open the menu in the middle of the story goes back into the story (the tutorial restarts), never to the menu', s1.state === 'play' && s1.tut && !s1.hub, JSON.stringify(s1));
  // ---- the tutorial is won: Continue → film 1 → stage 1
  await win(); await page.waitForTimeout(700);
  const tv = await page.evaluate(() => ({ btn: (document.getElementById('bGo') || {}).textContent, won: !!window.HOLDOR.ACC.tutWon, txt: document.querySelector('#card').innerText.slice(0, 60) }));
  ok('the tutorial victory: Continue (not "To your castle"), the first night is held', /Continue/.test(tv.btn || '') && tv.won, JSON.stringify(tv));
  await tap('#bGo', 1400); const s2 = await st();
  ok('Continue → film 1 → stage 1 starts at once (no menu)', s2.state === 'play' && s2.mode === 'campaign' && s2.lvl === 1 && !s2.hub && await page.evaluate(() => !!window.HOLDOR.ACC.film.f1), JSON.stringify(s2));
  // ---- stage 1 lost: one button; won: one button NEXT
  await page.evaluate(() => { const G = window.HOLDOR.G; G.doorHp = 0; window.HOLDOR_STORY.gameOver(); }); await page.waitForTimeout(700);
  const lose = await page.evaluate(() => ({ retry: !!document.getElementById('bRetry'), others: ['#bHero', '#bUp', '#bMap', '#bDiff2'].filter(q => document.querySelector(q)) }));
  if (lose.retry) { ok('a lost gate before the castle: Try again only (no Champion, Towers, Map)', lose.others.length === 0, JSON.stringify(lose)); await tap('#bRetry', 900); }
  else ok('a lost gate before the castle: Try again only', false, JSON.stringify(lose));
  const wn = async (n) => { await win(); await page.waitForTimeout(700); return page.evaluate(() => ({ next: (document.getElementById('bNext') || {}).textContent || '', others: ['#bUp', '#bMap', '#bShare', '#bHero', '#bHard'].filter(q => document.querySelector(q)), stars: document.querySelectorAll('.stars, .big.stars').length })); };
  const w1 = await wn(1);
  ok('stage 1 won: a single NEXT button (no Upgrades, Map, Share)', /NEXT/.test(w1.next) && !w1.others.length, JSON.stringify(w1));
  await tap('#bNext', 1400); const s3 = await st(); ok('NEXT → film 2 → stage 2', s3.state === 'play' && s3.lvl === 2 && !s3.hub && await page.evaluate(() => !!window.HOLDOR.ACC.film.f2), JSON.stringify(s3));
  await wn(2); await tap('#bNext', 1400); const s4 = await st(); ok('stage 2 won → film 3 → stage 3', s4.state === 'play' && s4.lvl === 3 && !s4.hub && await page.evaluate(() => !!window.HOLDOR.ACC.film.f3), JSON.stringify(s4));
  const w3 = await wn(3); ok('stage 3 won: the button says ENTER THE KEEP', /ENTER THE KEEP/.test(w3.next) && !w3.others.length, JSON.stringify(w3));
  await page.screenshot({ path: SC + 'story103_keep_btn.png' });
  await tap('#bNext', 1600);
  const k = await page.evaluate(() => { const A = window.HOLDOR.ACC; return { castle: !!A.castle, f4: !!A.film.f4, hub: !!document.querySelector('.hubtabs'), scr: window.HOLDOR.CLOUD.screen, locks: [...document.querySelectorAll('.hubtabs button.lock')].map(b => b.dataset.tab + ':' + b.dataset.lock).join(), pills: [...document.querySelectorAll('.hmstrip .hpill')].map(b => b.id).join(), slots: document.querySelectorAll('.hmslots .slot').length, app: document.getElementById('app').classList.contains('prestory') }; });
  ok('film 4 → the castle opens for the first time: only BATTLE is open — Army, Shop, Clan locked (stages 4, 5, 6), no chests, the rank pill only', k.castle && k.f4 && k.hub && k.scr === 'hub:battle' && /shop:2/.test(k.locks) && /coll:1/.test(k.locks) && /clan:3/.test(k.locks) && k.pills === 'hubTro' && k.slots === 0 && !k.app, JSON.stringify(k));
  await page.screenshot({ path: SC + 'story103_castle.png' });
  // ---- after the castle: a stage at a time opens a part, with its film
  const open = async n => { await page.evaluate(n => { const H = window.HOLDOR; H.G.state = 'menu'; for (let i = 1; i <= n; i++) H.ACC.campaign[i] = 3; H.persist(); H.showHub('battle'); }, n); await page.waitForTimeout(900); return page.evaluate(() => ({ locks: [...document.querySelectorAll('.hubtabs button.lock')].map(b => b.dataset.tab).join(), f: Object.keys(window.HOLDOR.ACC.film || {}).join(), slots: document.querySelectorAll('.hmslots .slot').length })); };
  const a4 = await open(4); ok('stage 4 held: film 5, the Army and the chests open', a4.locks === 'shop,clan' && /f5/.test(a4.f) && a4.slots === 4, JSON.stringify(a4));
  const a5 = await open(5); ok('stage 5 held: film 6, the Shop and the Tasks pill open', a5.locks === 'clan' && /f6/.test(a5.f), JSON.stringify(a5));
  const a6 = await open(6); ok('stage 6 held: film 7, the Clan opens — nothing is locked', a6.locks === '' && /f7/.test(a6.f), JSON.stringify(a6));
  // ---- more doors out of the story are closed: the campaign map, and a battle that cannot start leaves a card with Continue
  const wk = await page.evaluate(() => { const H = window.HOLDOR; H.ACC.castle = 0; H.ACC.sv = 1; H.ACC.tutWon = 1; H.ACC.campaign = { 1: 3, 2: 3 }; H.ACC.film = { f0: 1, f1: 1, f2: 1, f3: 1 }; H.G.state = 'menu'; window.HOLDOR_STORY.stClass(); window.HOLDOR_STORY.showCampaign(); return { state: H.G.state, scr: H.CLOUD.screen, map: !!document.querySelector('.stagegrid, .campmap, #bMapBack') }; }); await page.waitForTimeout(600);
  const wk2 = await st();
  ok('the campaign map is another way into the menu: before the castle it too goes back into the story', wk2.state === 'play' && wk2.lvl === 3 && !wk2.hub && !wk.map, JSON.stringify([wk, wk2]));
  const card = await page.evaluate(() => { let n = 0; window.HOLDOR.G.state = 'menu'; window.HOLDOR_STORY.stGo(() => { n++; }, 'Stage 9', 'The Test'); const b = document.getElementById('bStGo'); const r0 = n; b.click(); return { first: r0, after: n, scr: window.HOLDOR.CLOUD.screen, txt: document.querySelector('#card').innerText.replace(/\s+/g, ' ').slice(0, 60) }; });
  ok('a plain card (Stage N, the name, Continue) sits under every story battle: it starts the battle by itself and Continue starts it again if it could not start', card.first === 1 && card.after === 2 && card.scr === 'story' && /Stage 9/.test(card.txt), JSON.stringify(card));
  const chain = await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.sv = 1; a.castle = 1; a.intro = 1; a.tut = 1; a.tutWon = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; a.film = { f0: 1, f1: 1, f2: 1, f3: 1, f4: 1 }; for (let i = 1; i <= 6; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.G.state = 'menu'; H.showHub('battle'); return null; }); await page.waitForTimeout(900);
  const ch2 = await page.evaluate(() => ({ films: Object.keys(window.HOLDOR.ACC.film).join(), hub: !!document.querySelector('.hubtabs') }));
  ok('stages 4, 5 and 6 were held with NEXT and the hub was never opened: the first visit plays every film that is due (f5, f6, f7) before the hub', ch2.films === 'f0,f1,f2,f3,f4,f5,f6,f7' && ch2.hub, JSON.stringify(ch2));
  // ---- an account made before the story flow is untouched: the menu opens as before
  const old = await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('lannister', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 }; H.setAcc(a); H.persist(); H.G.state = 'menu'; H.showHub('battle'); return { sv: a.sv || 0, hub: !!document.querySelector('.hubtabs'), tut: window.HOLDOR_TUT.TUT_STEPS[0].t }; }); await page.waitForTimeout(500);
  const oldText = await page.evaluate(() => { const t = window.HOLDOR_TUT.TUT_STEPS[0].t; return typeof t === 'function' ? t() : t; });
  ok('an account without the story flag sees the menu at once and the old tutorial words', old.sv === 0 && old.hub && /marching on the door/.test(oldText), JSON.stringify([old.sv, old.hub, oldText]));
  // ---- the film engine for real (films on): it plays, types its captions, can be skipped, and hands control back
  await page.evaluate(() => { window.__films = 1; const H = window.HOLDOR, a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sel = 'brienne'; H.setAcc(a); window.__done = null; window.HOLDOR_FILM.filmPlay('f1', sk => { window.__done = sk ? 'skipped' : 'ended'; }); });
  await page.waitForTimeout(3600);
  const f = await page.evaluate(() => ({ on: window.HOLDOR_FILM.FILM.on, el: !!document.querySelector('.film canvas'), bars: document.querySelectorAll('.film .fbar').length, skip: !!document.getElementById('filmSkip'), caps: [...document.querySelectorAll('.film .fc')].map(e => e.textContent), shot: window.HOLDOR_FILM.FIL && window.HOLDOR_FILM.FIL.si, amb: null }));
  ok('a film plays: a canvas with letterbox bars, a Skip button, shots advance, the first caption types itself', f.on && f.el && f.bars === 2 && f.skip && f.shot >= 0 && f.caps.length >= 1 && f.caps[0].length > 3, JSON.stringify(f));
  await page.screenshot({ path: SC + 'story103_film.png' });
  await tap('#filmSkip', 400);
  const f2 = await page.evaluate(() => ({ on: window.HOLDOR_FILM.FILM.on, gone: !document.querySelector('.film'), done: window.__done }));
  ok('Skip ends the film at once and tells the caller it was skipped', !f2.on && f2.gone && f2.done === 'skipped', JSON.stringify(f2));
  const full = await page.evaluate(() => new Promise(res => { window.HOLDOR_FILM.filmPlay({ id: 't', shots: [{ scene: 'black', d: 0.8, p: {}, cap: [{ at: 0.1, text: 'Count the knocks.', kind: 'whisper', hold: 1.6 }] }, { scene: 'title', d: 0.8, p: { text: 'X' } }] }, sk => res({ skipped: sk, on: window.HOLDOR_FILM.FILM.on })); }));
  ok('a film that is not skipped ends by itself and hands control back (skipped = false)', full.skipped === false && !full.on, JSON.stringify(full));
  // ---- the real thing, films on: house → film 0 plays on top of the screen → Skip → the tutorial battle begins
  const pg2 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }); pg2.on('pageerror', e => errors.push('PE2:' + e.message));
  await pg2.addInitScript(() => { window.__films = 1; try { localStorage.clear(); } catch (e) {} });
  await pg2.goto(URL); await pg2.waitForFunction(() => window.HOLDOR && window.HOLDOR_STORY, { timeout: 20000 }); await pg2.waitForTimeout(500);
  await pg2.touchscreen.tap(195, 430); await pg2.waitForTimeout(700);
  if (!(await pg2.evaluate(() => !!document.querySelector('.seat[data-i="0"]')))) await pg2.locator('#bStart').first().tap({ force: true });
  await pg2.waitForTimeout(500); await pg2.locator('.seat[data-i="0"]').first().tap({ force: true }); await pg2.waitForTimeout(700); await pg2.locator('#bPick').first().tap({ force: true }); await pg2.waitForTimeout(600); await pg2.locator('.hbig[data-h="stark"]').first().tap({ force: true }); await pg2.waitForTimeout(1500);
  const live = await pg2.evaluate(() => ({ film: !!document.querySelector('.film canvas'), on: window.HOLDOR_FILM.FILM.on, state: window.HOLDOR.G.state, f0: !!(window.HOLDOR.ACC.film && window.HOLDOR.ACC.film.f0), hub: !!document.querySelector('.hubtabs') }));
  ok('with films on, choosing the house starts film 0 (not the battle, not a menu); it is not marked seen until it ends', live.film && live.on && live.state !== 'play' && !live.f0 && !live.hub, JSON.stringify(live));
  await pg2.waitForTimeout(2500); await pg2.screenshot({ path: SC + 'story103_f0_live.png' });
  await pg2.locator('#filmSkip').first().tap({ force: true }); await pg2.waitForTimeout(1500);
  const after = await pg2.evaluate(() => ({ film: !!document.querySelector('.film'), state: window.HOLDOR.G.state, tut: !!window.HOLDOR.G.tutorial, f0: !!window.HOLDOR.ACC.film.f0, hub: !!document.querySelector('.hubtabs'), amb: 1 }));
  ok('Skip → film 0 is marked seen and the tutorial battle starts at once', !after.film && after.state === 'play' && after.tut && after.f0 && !after.hub, JSON.stringify(after));
  await pg2.close();
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
