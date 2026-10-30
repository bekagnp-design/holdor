// v1.3.8: Trials replace the Clan tab. Four tabs Shop · Army · Battle · Trials; the Clan page stays reachable (showHub('clan'), back arrow);
// the invitations are one card on Tasks; Trials is a local endless run: a skill offer before every wave, the gate falls, the best wave is stored,
// no server calls (battle_start / battle_finish), no economy RPCs. Real taps for the tab, START, the offer, the result buttons.
const { chromium } = require('playwright');
const path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  const rpc = []; page.on('request', r => { if (/supabase|rpc\//.test(r.url())) rpc.push(r.url()); });
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(ms == null ? 450 : ms); };
  const scr = () => page.evaluate(() => window.HOLDOR.CLOUD.screen);
  const setup = async (stages) => { await page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.sv = 0; a.castle = 1;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.freeChestAt = Date.now() - 3600000; a.holdTut = 1; a.holdIntro = 1; a.gold = 900; a.gems = 60; a.sel = 'robb'; H.setAcc(a); H.showHub('battle'); }, stages); await page.waitForTimeout(800); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_TRIALS, { timeout: 20000 }); await page.waitForTimeout(300);
  await setup(10);
  // ---- the tabs
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.hubtabs button')].map(b => b.dataset.tab + ':' + b.textContent.trim().replace(/\s+/g, '')));
  ok('four tabs: Shop · Army · Battle · Trials; no Clan tab', tabs.join('|') === 'shop:Shop|coll:Army|battle:Battle|trials:Trials', JSON.stringify(tabs));
  // ---- Clan: no tab, but the page still renders, with a back arrow
  await page.evaluate(() => window.HOLDOR.showHub('clan')); await page.waitForTimeout(500);
  const cl = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, realm: !!document.getElementById('clRealm'), btns: document.querySelectorAll('#clRealm .btn').length, back: !!document.querySelector('.hback #hubBack'), on: (document.querySelector('.hubtabs button.on') || {}).dataset.tab, tab: !!document.querySelector('.hubtabs button[data-tab="clan"]') }));
  ok('showHub("clan") still renders the realm page (3 buttons) with a back arrow and no Clan tab', cl.scr === 'hub:clan' && cl.realm && cl.btns === 3 && cl.back && !cl.tab && cl.on === 'battle', JSON.stringify(cl));
  await tap('#hubBack', 500); ok('…the back arrow returns to Battle', await scr() === 'hub:battle', await scr());
  // ---- Tasks: the invite card (a signed-in seat is needed for Tasks: fake the server state, no request is made)
  await page.evaluate(() => { const H = window.HOLDOR, E = window.HOLDOR_ECON; E.ECO.on = true; H.CLOUD.on = true; E.ECO.seat = H.SAVE.cur >= 0 ? H.SAVE.cur : 0; if (H.SAVE.cur < 0) H.SAVE.cur = 0; E.ECO.seat = H.SAVE.cur; });
  await page.evaluate(() => window.HOLDOR.showHub('tasks')); await page.waitForTimeout(500);
  const tk = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, card: !!document.getElementById('bInvCard'), txt: (document.getElementById('bInvCard') || {}).textContent }));
  ok('Tasks (Quests) has the small "Invite friends" card', tk.scr === 'hub:tasks' && tk.card && /Invite friends/.test(tk.txt), JSON.stringify(tk));
  await tap('#bInvCard', 600);
  const fr = await page.evaluate(() => ({ on: (document.querySelector('.subtabs.tks .on') || {}).dataset && document.querySelector('.subtabs.tks .on').dataset.tk, inv: /Invite friends/.test(document.getElementById('hubBody').innerText) }));
  ok('…it opens the Friends part of Tasks (the invitation block)', fr.on === 'friends' && fr.inv, JSON.stringify(fr));
  await page.evaluate(() => { const E = window.HOLDOR_ECON; E.ECO.on = false; window.HOLDOR.CLOUD.on = false; window.HOLDOR.showHub('battle'); }); await page.waitForTimeout(400);
  // ---- Trials page
  await tap('.hubtabs button[data-tab="trials"]', 700);
  const pg = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, on: (document.querySelector('.hubtabs button.on') || {}).dataset.tab, title: (document.querySelector('.trtx b') || {}).textContent, best: (document.getElementById('trBest') || {}).textContent, go: !!document.getElementById('bTrials'), last: !!document.querySelector('.trlast'), back: !!document.querySelector('.hback') }));
  ok('the Trials tab: "The Long Night", "Not played yet" (nothing invented), a START button, no last build yet', pg.scr === 'hub:trials' && pg.on === 'trials' && pg.title === 'The Long Night' && pg.best === 'Not played yet' && pg.go && !pg.last && !pg.back, JSON.stringify(pg));
  await page.screenshot({ path: SC + 'trials138_page.png' });
  // ---- locked before stage 8
  await setup(3); await page.evaluate(() => { window.HOLDOR.setAcc(Object.assign(window.HOLDOR.ACC, {})); window.HOLDOR.showHub('battle'); }); await page.waitForTimeout(400);
  const lk = await page.evaluate(() => { const b = document.querySelector('.hubtabs button[data-tab="trials"]'); return { lock: b.classList.contains('lock'), need: b.dataset.lock }; });
  ok('with 3 stages held the Trials tab is locked (needs 5 past the castle)', lk.lock && lk.need === '5', JSON.stringify(lk));
  await tap('.hubtabs button[data-tab="trials"]', 400);
  ok('…a tap on the lock only says so', await scr() === 'hub:battle', await scr());
  await setup(10); await tap('.hubtabs button[data-tab="trials"]', 700);
  // ---- START: a battle opens, no server call, the first offer comes before wave 1
  rpc.length = 0; const gold0 = await page.evaluate(() => window.HOLDOR.ACC.gold);
  await tap('#bTrials', 300);
  await page.evaluate(() => { const G = window.HOLDOR.G; G.nextIn = 0; for (let i = 0; i < 3; i++) window.HOLDOR.step(); }); await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const G = window.HOLDOR.G; return { state: G.state, mode: G.mode, tr: !!G.trials, bid: G.bid, total: String(G.totalWaves), ask: G.learnAsk && G.learnAsk.length, cards: document.querySelectorAll('#boonOv [data-learn]').length, paused: G.paused, sub: document.getElementById('hSub').textContent, wave: G.wave }; });
  ok('START opens a local run: campaign-like, endless, no battle id, "The Long Night", a skill offer of three before wave 1', st.state === 'play' && st.mode === 'campaign' && st.tr && !st.bid && st.total === 'Infinity' && st.ask === 3 && st.cards === 3 && st.paused && st.sub === 'The Long Night' && st.wave === 0, JSON.stringify(st));
  await page.waitForTimeout(700); await page.screenshot({ path: SC + 'trials138_offer.png' });
  const first = await page.evaluate(() => window.HOLDOR.G.learnAsk[0]);
  await page.locator('#boonOv [data-learn="' + first + '"]').tap({ force: true }); await page.waitForTimeout(300);
  await page.evaluate(() => { for (let i = 0; i < 6; i++) window.HOLDOR.step(); });
  ok('a tap on a card learns the skill and wave 1 starts', await page.evaluate((id) => { const G = window.HOLDOR.G; return G.wave === 1 && !G.learnAsk && G.learned.includes(id); }, first));
  // ---- play: run waves with the step hook (60 steps per game second); every wave opens a new offer
  const offers = [];
  for (let w = 2; w <= 4; w++) {
    await page.evaluate(() => { const G = window.HOLDOR.G; G.enemies.length = 0; G.spawnQueue.length = 0; G.waveDone = true; G.nextIn = 0; window.HOLDOR.step(); });
    const o = await page.evaluate(() => { const G = window.HOLDOR.G; return { ask: G.learnAsk && G.learnAsk.join(), wave: G.wave, cards: document.querySelectorAll('#boonOv [data-learn]').length }; });
    offers.push(o);
    await page.locator('#boonOv [data-learn]').first().tap({ force: true }); await page.waitForTimeout(200);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) window.HOLDOR.step(); });
  }
  ok('before every following wave the champion is offered three skills again (waves 2-4)', offers.every((o, i) => o.ask && o.cards === 3 && o.wave === i + 1), JSON.stringify(offers));
  // 60 steps = one game second moves the run
  const t0 = await page.evaluate(() => window.HOLDOR.G.time); await page.evaluate(() => { for (let i = 0; i < 60; i++) window.HOLDOR.step(); });
  ok('60 steps advance a game second (the live loop may add a few more)', await page.evaluate((t) => window.HOLDOR.G.time - t >= 0.98, t0), String(await page.evaluate((t) => window.HOLDOR.G.time - t, t0)));
  const learned = await page.evaluate(() => window.HOLDOR.G.learned.length);
  ok('the champion has learned four skills in four waves', learned === 4, learned);
  // ---- the gate falls
  await page.evaluate(() => { const G = window.HOLDOR.G; G.doorHp = 0; window.HOLDOR_TRIALS.gameOver(); });
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => ({ state: window.HOLDOR.G.state, txt: card.innerText, big: (document.querySelector('.big') || {}).textContent, build: !!document.querySelector('.bcard'), again: !!document.getElementById('bTrAgain'), back: !!document.getElementById('bTrBack'), tr: window.HOLDOR.ACC.trials }));
  ok('the gate falls: the result shows waves held, the build card, Try again; best wave and runs are stored in ACC.trials', res.state === 'over' && /took the gate/.test(res.txt) && /3/.test(res.big) && res.build && res.again && res.back && res.tr.best === 3 && res.tr.runs === 1 && res.tr.last.learned.length === 4, JSON.stringify({ big: res.big, tr: res.tr }));
  await page.screenshot({ path: SC + 'trials138_result.png' });
  ok('a guest got wooden chests only per 5 waves (3 waves: none) and gold 12 per wave (3 held = 36)', await page.evaluate((g) => window.HOLDOR.ACC.gold === g + 36, gold0), String(await page.evaluate(() => window.HOLDOR.ACC.gold)));
  ok('no battle_start / battle_finish / economy request was made', rpc.length === 0, rpc.join(','));
  // ---- Try again → a fresh run, offer again; then back to the page shows the best and the last build
  await tap('#bTrAgain', 300);
  await page.evaluate(() => { const G = window.HOLDOR.G; G.nextIn = 0; for (let i = 0; i < 3; i++) window.HOLDOR.step(); }); await page.waitForTimeout(300);
  ok('Try again starts a new run with a new offer', await page.evaluate(() => { const G = window.HOLDOR.G; return G.state === 'play' && G.wave === 0 && !!G.learnAsk && G.learned.length === 0; }));
  await page.evaluate(() => { const G = window.HOLDOR.G; G.learnAsk = null; G.paused = false; const o = document.getElementById('boonOv'); if (o) o.remove(); G.wave = 8; G.learnDone[8] = 1; G.waveDone = false; G.spawnQueue.length = 0; G.nextIn = 14; G.doorHp = 0; window.HOLDOR_TRIALS.gameOver(); });
  await page.waitForTimeout(400);
  const r2 = await page.evaluate(() => window.HOLDOR.ACC.trials); ok('a better run raises the best (wave 7) and counts the run', r2.best === 7 && r2.runs === 2, JSON.stringify(r2));
  await tap('#bTrBack', 700);
  const pg2 = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, best: document.getElementById('trBest').textContent }));
  ok('back on the Trials page the best wave is real: "Best: wave 7 · 2 runs"', pg2.scr === 'hub:trials' && pg2.best === 'Best: wave 7 · 2 runs', JSON.stringify(pg2));
  // ---- a signed-in seat: no rewards, and the page says so
  const note = await page.evaluate(() => { const E = window.HOLDOR_ECON; return { guest: document.querySelector('.trnote').textContent }; });
  ok('the guest page lists the real reward rule', /wooden chest/.test(note.guest), note.guest);
  // ---- v1.4.1: a server-managed seat — trials_start on START, trials_claim on the result; the answers are mocked (the real ones: backend v38)
  const calls = []; let claimAnswer = null;
  await page.route(/rpc\/trials_start/, r => { calls.push(['start', r.request().postDataJSON()]); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.route(/rpc\/trials_claim/, r => { calls.push(['claim', r.request().postDataJSON()]); r.fulfill(claimAnswer); });
  const managed = async () => { await page.evaluate(() => { const H = window.HOLDOR, E = window.HOLDOR_ECON; if (H.SAVE.cur < 0) H.SAVE.cur = 0; E.ECO.on = true; E.ECO.seat = H.SAVE.cur; H.CLOUD.on = true; H.CLOUD.token = '00000000-0000-0000-0000-000000000001'; }); };
  const endRun = async (w) => { await page.evaluate((w) => { const G = window.HOLDOR.G; G.learnAsk = null; G.paused = false; const o = document.getElementById('boonOv'); if (o) o.remove(); G.wave = w + 1; G.learnDone[w + 1] = 1; G.waveDone = false; G.spawnQueue.length = 0; G.nextIn = 14; G.doorHp = 0; window.HOLDOR_TRIALS.gameOver(); }, w); await page.waitForTimeout(900); };
  await managed(); await page.evaluate(() => window.HOLDOR.showHub('trials')); await page.waitForTimeout(500);
  ok('the page tells a server seat the real rule (12 gold a wave, a chest per 5, one claim an hour, 600 a day)', await page.evaluate(() => /12 gold a wave/.test(document.querySelector('.trnote').textContent) && /one claim an hour/.test(document.querySelector('.trnote').textContent) && /600 gold a day/.test(document.querySelector('.trnote').textContent)));
  const stAns = { gold: 5000, gems: 70, xp: 0, at: new Date().toISOString() };
  claimAnswer = { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, waves: 12, gold: 144, chests: 2, chest_gold: 230, chest_gems: 9, day_left: 226, state: stAns }) };
  const g1 = await page.evaluate(() => window.HOLDOR.ACC.gold);
  await tap('#bTrials', 300); await page.waitForTimeout(300);
  ok('START on a server seat calls trials_start with the seat', calls.length === 1 && calls[0][0] === 'start' && calls[0][1].seat === (await page.evaluate(() => window.HOLDOR.SAVE.cur)) && !!calls[0][1].token, JSON.stringify(calls));
  await endRun(12);
  const m1 = await page.evaluate(() => ({ txt: document.getElementById('card').innerText, gold: window.HOLDOR.ACC.gold, big: (document.querySelector('.big') || {}).textContent }));
  ok('the result calls trials_claim with 12 waves and shows the SERVER numbers (374 gold = 144 + 230, 9 gems, 2 chests, 226 left)', calls.length === 2 && calls[1][0] === 'claim' && calls[1][1].waves === 12 && /\+374/.test(m1.txt) && /\+9/.test(m1.txt) && /2 Trials chests/.test(m1.txt) && /226 gold left/.test(m1.txt), m1.txt.replace(/\s+/g, ' ').slice(0, 300));
  ok('…the wallet takes the server state (gold 5000), not a local guess', m1.gold === 5000, String(m1.gold) + ' from ' + g1);
  await page.screenshot({ path: SC + 'trials141_managed.png' });
  // a refusal shows its reason and changes nothing
  claimAnswer = { status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'one claim per hour' }) };
  await tap('#bTrAgain', 300); await page.waitForTimeout(300); await endRun(6);
  const m2 = await page.evaluate(() => ({ txt: document.getElementById('card').innerText, gold: window.HOLDOR.ACC.gold }));
  ok('a refusal ("one claim per hour") is shown as the reason and the gold stays', calls.length === 4 && /No reward this time: one claim per hour/.test(m2.txt) && m2.gold === 5000, m2.txt.replace(/\s+/g, ' ').slice(0, 300));
  // 0 waves: nothing to claim, no call
  await tap('#bTrAgain', 300); await page.waitForTimeout(300); const n0 = calls.length;
  await page.evaluate(() => { const G = window.HOLDOR.G; G.learnAsk = null; G.paused = false; const o = document.getElementById('boonOv'); if (o) o.remove(); G.doorHp = 0; window.HOLDOR_TRIALS.gameOver(); }); await page.waitForTimeout(500);
  ok('a run with 0 waves makes no claim', calls.length === n0 && (await page.evaluate(() => /no reward is waiting/.test(document.getElementById('card').innerText))), String(calls.length - n0));
  await page.evaluate(() => { window.HOLDOR_ECON.ECO.on = false; window.HOLDOR.CLOUD.on = false; });
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
