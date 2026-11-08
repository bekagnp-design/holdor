// v1.5.0: the Trials tab made clear. One big button that says its state — green "⚔ START TRIAL" when the run pays, grey "⏳ NEXT REWARD IN
// N MIN" under the server's hour rule, grey "✔ TODAY'S REWARD TAKEN" when the day's 600 gold are used up (a tap still starts a run for the
// record); the record and today's gold left as one small line (the server's own day_left, never a guess); the reward on the result as a compact
// list (waves → gold, chests → gold + gems, earned, left today); the skill offer's "learned" line grouped so a long run fits a short phone.
// Real taps for the tab, the button in every state, the result buttons. The server answers are mocked (the real ones: backend v38).
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 450 : ms); };
  const scr = () => page.evaluate(() => window.HOLDOR.CLOUD.screen);
  // the page draws 🪙 / 💎 as icons (currency.js): their text is gone, so texts are compared with single spaces and without the emoji
  const btn = () => page.evaluate(() => { const n = s => s.replace(/\s+/g, ' ').trim(); const b = document.getElementById('bTrials'); if (!b) return null; const cs = getComputedStyle(b); return { st: b.dataset.st, cls: b.className, bt: n(b.querySelector('.bt').textContent), bs: n(b.querySelector('.bs').textContent), h: b.getBoundingClientRect().height, bg: cs.backgroundImage + '|' + cs.backgroundColor, best: n(document.getElementById('trBest').textContent), note: n(document.querySelector('.trnote').textContent), w: document.getElementById('trCard').getBoundingClientRect().right, vw: innerWidth }; });
  const rows = () => page.evaluate(() => { const n = s => s.replace(/\s+/g, ' ').trim(); return [...document.querySelectorAll('#card .trrw .trr')].map(r => n(r.querySelector('span').textContent) + ' | ' + n(r.querySelector('b').textContent)); });
  const setup = async (stages) => { await page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.sv = 0; a.castle = 1;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.freeChestAt = Date.now() - 3600000; a.holdTut = 1; a.holdIntro = 1; a.gold = 900; a.gems = 60; a.sel = 'robb'; H.setAcc(a); H.showHub('battle'); }, stages); await page.waitForTimeout(800); };
  const firstOffer = async () => { await page.evaluate(() => { const G = window.HOLDOR.G; G.nextIn = 0; for (let i = 0; i < 3; i++) window.HOLDOR.step(); }); await page.waitForTimeout(300); };
  const learnOne = async () => { await page.locator('#boonOv [data-learn]').first().tap({ force: true }); await page.waitForTimeout(150); await page.evaluate(() => { for (let i = 0; i < 6; i++) window.HOLDOR.step(); }); };
  const nextWave = async () => { await page.evaluate(() => { const G = window.HOLDOR.G; G.enemies.length = 0; G.spawnQueue.length = 0; G.waveDone = true; G.nextIn = 0; window.HOLDOR.step(); }); await page.waitForTimeout(150); };
  const endRun = async (w) => { await page.evaluate((w) => { const G = window.HOLDOR.G; G.learnAsk = null; G.paused = false; const o = document.getElementById('boonOv'); if (o) o.remove(); G.wave = w + 1; G.learnDone[w + 1] = 1; G.waveDone = false; G.spawnQueue.length = 0; G.nextIn = 14; G.doorHp = 0; window.HOLDOR_TRIALS.gameOver(); }, w); await page.waitForTimeout(900); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TRIALS, { timeout: 20000 }); await page.waitForTimeout(300);
  await setup(10);
  // ---- never played (a guest): one green button that says what the run pays, the record line says nothing invented
  await tap('.hubtabs button[data-tab="trials"]', 700);
  let b = await btn();
  ok('never played: the big button is green and ready — "⚔ START TRIAL" / "12 🪙 a wave · a wooden chest every 5 waves"', b && b.st === 'ready' && /\bready\b/.test(b.cls) && /bigbtn/.test(b.cls) && b.bt === '⚔ START TRIAL' && /^12 a wave · a wooden chest every 5 waves$/.test(b.bs) && b.h >= 60 && /linear-gradient/.test(b.bg), JSON.stringify(b));
  ok('…the record line is "Not played yet" and the card fits the phone (no horizontal overflow)', b.best === 'Not played yet' && b.w <= b.vw, JSON.stringify({ best: b.best, w: b.w, vw: b.vw }));
  ok('…only one .bigbtn on the page, no second primary button', await page.evaluate(() => document.querySelectorAll('#hubBody .bigbtn').length === 1 && document.querySelectorAll('#hubBody .btn:not(.sec)').length === 0));
  await page.screenshot({ path: SC + 'trials150_never.png' });
  // ---- a guest run ends at wave 7: the result lists the reward as rows; the chest row says to open it below
  const gold0 = await page.evaluate(() => window.HOLDOR.ACC.gold);
  await tap('#bTrials', 300); await firstOffer();
  ok('a tap on the green button starts the run with the first offer', await page.evaluate(() => { const G = window.HOLDOR.G; return G.state === 'play' && !!G.trials && G.learnAsk && G.learnAsk.length === 3; }));
  await learnOne(); for (let w = 2; w <= 4; w++) { await nextWave(); await learnOne(); }
  // the offer's learned line is grouped (×n), not a growing list of names
  await nextWave();
  const have = await page.evaluate(() => (document.querySelector('#boonOv .bo-have') || {}).textContent);
  ok('the offer says what was learned, grouped: "Learned this battle (4): … ×2 …"', /^Learned this battle \(4\): /.test(have) && /×2/.test(have) && !/, /.test(have), have);
  await endRun(7);
  let rw = await rows();
  ok('the guest result lists the reward as rows: "7 waves held +84 🪙" and "1 Trials chest open below ↓"', rw.length === 2 && rw[0] === '7 waves held | +84' && rw[1] === '1 Trials chest | open below ↓', JSON.stringify(rw));
  ok('…the gold was paid (12 a wave) and the chest button is the primary one', await page.evaluate((g) => window.HOLDOR.ACC.gold === g + 84 && document.getElementById('bTrChest') && !document.getElementById('bTrChest').classList.contains('sec') && document.getElementById('bTrAgain').classList.contains('sec'), gold0));
  await page.screenshot({ path: SC + 'trials150_result_guest.png' });
  await tap('#bTrBack', 700); b = await btn();
  ok('back on the tab: the record line "Best: wave 7 · 1 run", the button still green', await scr() === 'hub:trials' && b.best === 'Best: wave 7 · 1 run' && b.st === 'ready', JSON.stringify({ best: b.best, st: b.st }));
  // ---- a server seat (mocked backend v38): the claim's day_left and the hour rule shape the button
  const calls = []; let claimAnswer = null;
  await page.route(/rpc\/trials_start/, r => { calls.push('start'); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.route(/rpc\/trials_claim/, r => { calls.push('claim'); r.fulfill(claimAnswer); });
  await page.evaluate(() => { const H = window.HOLDOR, E = window.HOLDOR_ECON; if (H.SAVE.cur < 0) H.SAVE.cur = 0; E.ECO.on = true; E.ECO.seat = H.SAVE.cur; H.CLOUD.on = true; H.CLOUD.token = '00000000-0000-0000-0000-000000000001'; });
  await page.evaluate(() => window.HOLDOR.showHub('trials')); await page.waitForTimeout(500); b = await btn();
  ok('a server seat before any claim: green, the line says "up to 600 🪙 a day" (the cap, not a guessed balance), the note names the hour rule', b.st === 'ready' && b.best === 'Best: wave 7 · 1 run · up to 600 a day' && /one reward an hour/.test(b.note) && /up to 600 a day/.test(b.note), JSON.stringify({ best: b.best, note: b.note }));
  const stAns = { gold: 5000, gems: 70, xp: 0, at: new Date().toISOString() };
  claimAnswer = { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, waves: 12, gold: 144, chests: 2, chest_gold: 230, chest_gems: 9, day_left: 226, state: stAns }) };
  await tap('#bTrials', 300); await page.waitForTimeout(300); await endRun(12);
  rw = await rows();
  ok('the server result is a compact list: 12 waves → +144, 2 chests → +230 · +9 💎, Earned +374 · +9, Left today 226 / 600', rw.join(' ; ') === '12 waves held | +144 ; 2 Trials chests opened | +230 · +9 ; Earned | +374 · +9 ; Left today | 226 / 600', JSON.stringify(rw));
  await page.screenshot({ path: SC + 'trials150_result_server.png' });
  await tap('#bTrBack', 700); b = await btn();
  // the hour rule: the next claim passes at the next UTC hour, and at least 5 min after this one — the button counts that down
  const expMin = await page.evaluate(() => { const t = Date.now() + (window.HOLDOR_ECON.ECO.off || 0); const h = new Date(t); h.setUTCMinutes(0, 0, 0); return Math.max(1, Math.ceil((Math.max(h.getTime() + 3600000, t + 300000) - t) / 60000)); });
  const gotMin = b.bt.match(/IN (\d+) MIN|IN (1) H/); const got = gotMin ? +(gotMin[1] || 60) : -1;
  ok('after the claim the button is grey: "⏳ NEXT REWARD IN N MIN" with N = minutes to the next UTC hour (≥ 5), and says a run still counts', b.st === 'wait' && /\bwait\b/.test(b.cls) && !/\bready\b/.test(b.cls) && Math.abs(got - expMin) <= 1 && /Start anyway/.test(b.bs) && /counts for the record/.test(b.bs) && !/linear-gradient/.test(b.bg), JSON.stringify({ bt: b.bt, exp: expMin, bs: b.bs }));
  ok('…the record line carries the server\'s day_left: "Best: wave 12 · 2 runs · 226 🪙 left today"', b.best === 'Best: wave 12 · 2 runs · 226 left today', b.best);
  ok('…ACC.trials.srv remembers the day, the gold left and the next moment (real server data, persisted)', await page.evaluate(() => { const s = window.HOLDOR.ACC.trials.srv; return s && s.left === 226 && s.d === new Date().toISOString().slice(0, 10) && s.next > Date.now(); }));
  await page.screenshot({ path: SC + 'trials150_wait.png' });
  // a tap on the grey button still starts a run (for the record), and the server is told
  const n0 = calls.length; await tap('#bTrials', 300); await firstOffer();
  ok('a tap on the grey button still starts a run and calls trials_start', await page.evaluate(() => window.HOLDOR.G.state === 'play' && !!window.HOLDOR.G.trials) && calls.length === n0 + 1 && calls[n0] === 'start', JSON.stringify(calls.slice(n0)));
  // the hour passes (the remembered moment is moved two minutes into the past — the server clock may run a few seconds behind): green again, with the real gold left
  await page.evaluate(() => { const G = window.HOLDOR.G; G.learnAsk = null; G.paused = false; const o = document.getElementById('boonOv'); if (o) o.remove(); G.state = 'over'; window.HOLDOR.ACC.trials.srv.next = Date.now() - 120000; window.HOLDOR.showHub('trials'); }); await page.waitForTimeout(500); b = await btn();
  ok('when the hour has passed the button is green again and the line still says "226 🪙 left today"', b.st === 'ready' && /226 left today$/.test(b.best), JSON.stringify({ st: b.st, best: b.best }));
  // the daily cap: the server refuses "the daily Trials reward is used up" → the result says so, the tab says TODAY'S REWARD TAKEN
  claimAnswer = { status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'the daily Trials reward is used up' }) };
  await tap('#bTrials', 300); await page.waitForTimeout(300); await endRun(9);
  rw = await rows();
  ok('the daily-cap refusal on the result: "No reward this time · today\'s 600 🪙 are taken · more in N h" and "The run counts for the record"', rw.length === 2 && /^No reward this time \| today's 600 are taken · more in \d+ h$/.test(rw[0]) && rw[1].trim() === 'The run counts for the record |', JSON.stringify(rw));
  ok('…the refusal row is not wider than the card (it stacks)', await page.evaluate(() => { const r = document.querySelector('#card .trrw .trr.no'), c = document.getElementById('card'); return r && r.getBoundingClientRect().right <= c.getBoundingClientRect().right && r.scrollWidth <= r.clientWidth + 1; }));
  await page.screenshot({ path: SC + 'trials150_result_daily.png' });
  await tap('#bTrBack', 700); b = await btn();
  ok('the tab after the cap: grey "✔ TODAY\'S REWARD TAKEN" / "⚔ Play for the record · more gold in N h", the line "0 🪙 left today"', b.st === 'done' && /\bwait\b/.test(b.cls) && b.bt === "✔ TODAY'S REWARD TAKEN" && /^⚔ Play for the record · more gold in \d+ h$/.test(b.bs) && /· 0 left today$/.test(b.best), JSON.stringify({ bt: b.bt, bs: b.bs, best: b.best }));
  await page.screenshot({ path: SC + 'trials150_done.png' });
  // a new UTC day: yesterday's answer is forgotten — green, "up to 600 🪙 a day"
  await page.evaluate(() => { window.HOLDOR.ACC.trials.srv.d = '2000-01-01'; window.HOLDOR.showHub('trials'); }); await page.waitForTimeout(400); b = await btn();
  ok('a new UTC day forgets yesterday\'s cap: green again, the line says "up to 600 🪙 a day"', b.st === 'ready' && /up to 600 a day$/.test(b.best), JSON.stringify({ st: b.st, best: b.best }));
  // the hour rule as a refusal ("one claim per hour"): the result shows the countdown, the tab goes grey with the same minutes
  claimAnswer = { status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'one claim per hour' }) };
  await tap('#bTrials', 300); await page.waitForTimeout(300); await endRun(6);
  rw = await rows();
  ok('the hour-rule refusal on the result: "No reward this time one reward an hour · next in N min"', rw.length === 2 && /^No reward this time \| one reward an hour · next in (\d+ min|1 h)$/.test(rw[0]), JSON.stringify(rw));
  await tap('#bTrBack', 700); b = await btn();
  ok('…and the tab counts it down: "⏳ NEXT REWARD IN N MIN", the gold left unknown → "up to 600 🪙 a day"', b.st === 'wait' && /^⏳ NEXT REWARD IN (\d+ MIN|1 H)$/.test(b.bt) && /up to 600 a day$/.test(b.best), JSON.stringify({ bt: b.bt, best: b.best }));
  // the countdown ticks in place (the timer is 30 s; it is fired by hand here) and keeps the tap working
  await page.evaluate(() => { window.HOLDOR.ACC.trials.srv.next = Date.now() - 120000; });
  const ticked = await page.evaluate(() => { const b0 = document.getElementById('bTrials'); window.HOLDOR_TRIALS.trialsTick(); const b1 = document.getElementById('bTrials'); return { same: b1 === b0, st: b1.dataset.st, cls: b1.className, best: document.getElementById('trBest').textContent.replace(/\s+/g, ' ').trim() }; });
  ok('the tick redraws the button in place (same element, now green and ready)', ticked.same && ticked.st === 'ready' && /\bready\b/.test(ticked.cls), JSON.stringify(ticked));
  await tap('#bTrials', 300); ok('…and its tap still starts a run', await page.evaluate(() => window.HOLDOR.G.state === 'play' && !!window.HOLDOR.G.trials));
  await page.evaluate(() => { const G = window.HOLDOR.G; G.learnAsk = null; G.paused = false; const o = document.getElementById('boonOv'); if (o) o.remove(); G.doorHp = 0; window.HOLDOR_TRIALS.gameOver(); }); await page.waitForTimeout(400);
  await page.evaluate(() => { window.HOLDOR_ECON.ECO.on = false; window.HOLDOR.CLOUD.on = false; });
  // ---- a short phone (390×700): the Trials card and the skill offer fit, the offer box never leaves the stage
  await page.setViewportSize({ width: 390, height: 700 }); await page.waitForTimeout(300);
  await setup(10); await tap('.hubtabs button[data-tab="trials"]', 600);
  const fit = await page.evaluate(() => { const c = document.getElementById('trCard').getBoundingClientRect(), t = document.querySelector('.hubtabs').getBoundingClientRect(); return { cb: c.bottom, tt: t.top, w: c.right <= innerWidth }; });
  ok('390×700: the whole Trials card (button included) sits above the tab bar, no horizontal overflow', fit.cb <= fit.tt && fit.w, JSON.stringify(fit));
  await tap('#bTrials', 300); await firstOffer(); await learnOne();
  for (let w = 2; w <= 12; w++) { await nextWave(); if (w < 12) await learnOne(); }
  const off = await page.evaluate(() => { const o = document.getElementById('boonOv'), i = document.querySelector('#boonOv .bo-in'), s = document.getElementById('stage'); if (!o || !i) return null; const ob = o.getBoundingClientRect(), ib = i.getBoundingClientRect(), sb = s.getBoundingClientRect(); return { top: ib.top >= sb.top - 1, bot: ib.bottom <= sb.bottom + 1, cards: document.querySelectorAll('#boonOv [data-learn]').length, have: document.querySelector('#boonOv .bo-have').textContent, lines: document.querySelector('#boonOv .bo-have').getBoundingClientRect().height, w: ib.right <= innerWidth }; });
  ok('390×700, wave 12 of a Trials run: the offer (3 cards) stays inside the stage, the learned line is grouped (×n, at most five names, "+N more") and two lines at most', off && off.top && off.bot && off.cards === 3 && off.w && /^Learned this battle \(11\): /.test(off.have) && off.have.split(' · ').length <= 6 && off.lines <= 40, JSON.stringify(off));
  await page.screenshot({ path: SC + 'trials150_offer_short.png' });
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
