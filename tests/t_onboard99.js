// v1.0.99: the first minutes. A new player, by real taps: title → seat → realm (preselected from the language: one tap) → house →
// cinematic (skip) → straight into the first battle, where a Watchtower already stands by the door and the tutorial has 13 steps
// (8 actions); the champion's card and skill sit in a framed row, the spells in theirs. Then the home opens gradually: three locked
// tabs for a player with no stage (a tap only says so), chests and Army after stage 1, the Shop, the Tasks pill and the locked Hold
// card after 2, the event pill, Clan and the open Hold after 3. The lessons that left the first battle (sell, info, speed, pause, book)
// queue by stage — only for an account that finished the new tutorial.
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
  const scr = () => page.evaluate(() => window.HOLDOR.CLOUD.screen);
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_OB && window.HOLDOR_TUT, { timeout: 20000 }); await page.waitForTimeout(400);
  // ---- a new player: title → seat → realm → house → cinematic → the first battle
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_OB, { timeout: 20000 }); await page.waitForTimeout(500);
  ok('the realm is guessed from the language (en → United States)', await page.evaluate(() => window.HOLDOR_OB.obGuessRealm() === window.HOLDOR_OB.LANGS.findIndex(L => L.c === 'United States')));
  await page.touchscreen.tap(195, 430); await page.waitForTimeout(700);   // the title: tap anywhere to start
  if (!(await page.evaluate(() => !!document.querySelector('.seat[data-i="0"]')))) await tap('#bStart', 600);
  await tap('.seat[data-i="0"]', 700);
  const realm = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, pick: (document.querySelector('#bPick') || {}).textContent }));
  ok('the realm screen opens with the guessed realm preselected: one tap "Fight for United States"', /Fight for United States/.test(realm.pick || ''), JSON.stringify(realm));
  await tap('#bPick', 600); await tap('.hbig[data-h="stark"]', 900);
  const cine = await page.evaluate(() => !!document.querySelector('.cine #skip')); ok('the cinematic plays after the house', cine);
  await tap('#skip', 1500);
  const first = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_TUT; const tw = G.map ? G.map.slots.filter(s => s.tower) : [];
    const hero = document.getElementById('rowHero'), sp = document.querySelector('.brow.spells');
    return { state: G.state, tutorial: !!G.tutorial, tut: !!G.tut, step: G.tut && G.tut.i, towers: tw.map(s => s.tower.type + s.tower.lvl), gold: Math.round(G.gold), steps: X.TUT_STEPS.length, acts: X.TUT_STEPS.filter(s => s.want).length,
      frame: hero ? getComputedStyle(hero).borderTopWidth : '', label: hero ? getComputedStyle(hero, '::before').content : '', spells: sp ? getComputedStyle(sp, '::before').content : '', ult: !!document.querySelector('#rowHero #bUlt'), hub: !!document.querySelector('.hubtabs') }; });
  ok('the first battle begins by itself after the house (no home first): the tutorial is on at step 0', first.state === 'play' && first.tutorial && first.tut && first.step === 0 && !first.hub, JSON.stringify(first));
  ok('a Watchtower already stands by the door and the gold is still 90', first.towers.join() === 'watch1' && first.gold === 90, JSON.stringify(first));
  ok('the tutorial has 13 steps, 10 of them actions (the rest became lessons on later stages)', first.steps === 13 && first.acts === 10, first.steps + '/' + first.acts);
  ok('the champion and the skill share a framed row labelled YOUR CHAMPION; the spells their own, labelled SPELLS', parseFloat(first.frame) >= 2 && /YOUR CHAMPION/.test(first.label) && /SPELLS/.test(first.spells) && first.ult, JSON.stringify([first.frame, first.label, first.spells]));
  await page.screenshot({ path: SC + 'ob99_battle.png' });
  // the first lesson: call the wave (the prebuilt tower shoots), then a kill
  const run = await page.evaluate(() => { const H = window.HOLDOR, G = H.G, X = window.HOLDOR_TUT, OB = window.HOLDOR_OB; X.tutNext(); const w0 = X.TS().want; H.callWave(); let n = 0; while (n++ < 60 * 25 && G.state === 'play' && X.TS() && X.TS().want === 'kill') { H.step(); OB.tutFrame(1 / 60); } return { w0, kills: G.kills, want: X.TS() ? X.TS().want : null, shots: G.projs.length + G.kills }; });
  ok('step 1 asks to call the wave; after it the prebuilt tower kills by itself and step 2 (kill) passes to step 3 (build)', run.w0 === 'call' && run.kills > 0 && run.want === 'build', JSON.stringify(run));
  // ---- finish the tutorial: the account is marked for the staged lessons; the home for a player with no stage: three locked tabs
  await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_TUT; H.G.tut.i = X.TUT_STEPS.length - 1; X.tutAdvance(); H.G.state = 'menu'; H.showHub('battle'); }); await page.waitForTimeout(700);
  const h0 = await page.evaluate(() => ({ tut: window.HOLDOR.ACC.tut, tutv: window.HOLDOR.ACC.tutv, locks: [...document.querySelectorAll('.hubtabs button.lock')].map(b => b.dataset.tab + ':' + b.dataset.lock), pills: [...document.querySelectorAll('.hmstrip .hpill')].map(b => b.id), slots: document.querySelectorAll('.hmslots .slot').length, hold: !!document.getElementById('hmHold'), battle: document.getElementById('bBattle').textContent }));
  ok('finishing the tutorial marks the account (tutv 99); with no stage held: Army, Shop and Clan locked with their stages, the rank pill only, no chests, no Hold card, BATTLE! STAGE 1', h0.tut === 1 && h0.tutv === 99 && h0.locks.join() === 'shop:2,coll:1,clan:3' && h0.pills.join() === 'hubTro' && h0.slots === 0 && !h0.hold && /STAGE 1/.test(h0.battle), JSON.stringify(h0));
  await page.screenshot({ path: SC + 'ob99_home_locked.png' });
  // the home tour shows only what is on the screen: 4 steps with no stage, 5 after stage 1 (chests), 6 after 2 (Tasks); the coach is on it now
  const tour = await page.evaluate(() => { const H = window.HOLDOR, OB = window.HOLDOR_OB, X = window.HOLDOR_TUT; const on = X.COACH.on, n0 = X.COACH.steps ? X.COACH.steps.length : 0;
    const len = n => { H.ACC.campaign = {}; for (let i = 1; i <= n; i++) H.ACC.campaign[i] = 3; return OB.TOURS.battle().filter(Boolean).length; }; const r = { on, n0, l0: len(0), l1: len(1), l2: len(2), sels: OB.TOURS.battle().filter(Boolean).map(s => s.sel) };
    H.ACC.campaign = {}; H.ACC.learn = {}; X.coachEnd(true); H.ACC.tours = { win: 1, battle: 1 }; H.persist(); H.showHub('battle'); return r; }); await page.waitForTimeout(500);
  ok('the home tour runs after the tutorial and shows only what is there: 4 steps with no stage, 5 after stage 1, 6 after stage 2 (Tasks pill, not a back arrow)', tour.on && tour.n0 === 4 && tour.l0 === 4 && tour.l1 === 5 && tour.l2 === 6 && tour.sels.includes('#bTasks') && !tour.sels.includes('.hback'), JSON.stringify(tour));
  await tap('.hubtabs button[data-tab="shop"]', 300);
  const lockSay = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, toast: (document.getElementById('ecoToast') || {}).textContent || '' }));
  ok('a tap on a locked tab stays home and says when it opens', lockSay.scr === 'hub:battle' && /opens after stage 2/.test(lockSay.toast), JSON.stringify(lockSay));
  // stage 1 held: chests and Army; stage 2: the Shop, the Tasks pill, the locked Hold card; stage 3: the event pill, Clan, the open Hold
  const at = async n => { await page.evaluate(n => { const H = window.HOLDOR; for (let i = 1; i <= n; i++) H.ACC.campaign[i] = 3; H.persist(); H.showHub('battle'); }, n); await page.waitForTimeout(600);
    return page.evaluate(() => ({ locks: [...document.querySelectorAll('.hubtabs button.lock')].map(b => b.dataset.tab), pills: [...document.querySelectorAll('.hmstrip .hpill')].map(b => b.id), slots: document.querySelectorAll('.hmslots .slot').length, hold: (document.getElementById('hmHold') || {}).className || '' })); };
  const s1 = await at(1); ok('stage 1: the chests appear and Army opens', s1.slots === 4 && s1.locks.join() === 'shop,clan' && s1.pills.join() === 'hubTro' && !s1.hold, JSON.stringify(s1));
  const s2 = await at(2); ok('stage 2: the Shop and the Tasks pill open, the Hold card shows locked', s2.locks.join() === 'clan' && s2.pills.join() === 'hubTro,bTasks' && /lock/.test(s2.hold), JSON.stringify(s2));
  const s3 = await at(3); ok('stage 3: the event pill, Clan and the open Hold', s3.locks.length === 0 && s3.pills.join() === 'hubTro,bTasks,evBadge' && s3.hold && !/lock/.test(s3.hold), JSON.stringify(s3));
  // ---- the staged lessons queue by stage, only for an account that finished the new tutorial
  const lq = async (n, tutv) => page.evaluate(([n, tutv]) => { const H = window.HOLDOR; H.ACC.campaign = {}; for (let i = 1; i <= n; i++) H.ACC.campaign[i] = 3; H.ACC.tutv = tutv; H.ACC.learn = { chest: 1, hold: 1, champ: 1 }; H.G.state = 'menu'; H.startGame({ mode: 'campaign', level: H.stageLevel(n + 1) }); const q = (H.G.lq || []).slice(); H.G.lq = []; H.G.tut = null; H.G.paused = false; return q; }, [n, tutv]);
  const q1 = await lq(1, 99), q5 = await lq(5, 99), q0 = await lq(5, 0);
  ok('after the new tutorial: stage 2 queues the sell lesson only; stage 6 queues sell, info, speed, pause and book', q1.filter(k => /^(sell|info|speed|pause|book)$/.test(k)).join() === 'sell' && ['sell', 'info', 'speed', 'pause', 'book'].every(k => q5.includes(k)), JSON.stringify([q1, q5]));
  ok('an account that skipped or predates the new tutorial gets none of them', !q0.some(k => /^(sell|info|speed|pause|book)$/.test(k)), JSON.stringify(q0));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
