// flow150: the path from the home to the fight and back, by real taps. Home → BATTLE → ⚔ TO BATTLE starts the next stage in two taps;
// a replay of an earlier stage is three (pin, then ⚔ TO BATTLE); the Hold is one. The map card: the deck strip above one big button,
// the next pin pulsing, locked pins grey, cleared pins with small stars. The result at 390×700: NEXT STAGE › (or ⟲ TRY AGAIN) is inside
// the first screen with Replay and Home under it; the rewards are chips.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = []; const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const open = async (h) => { const page = await browser.newPage({ viewport: { width: 390, height: h }, deviceScaleFactor: 2, hasTouch: true }); page.on('pageerror', e => errors.push('PE:' + e.message));
    await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
    await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_FLOW150 && window.HOLDOR_MARKET, { timeout: 20000 }); await page.waitForTimeout(300); return page; };
  const setup = (page, n) => page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tour = 99; a.holdTut = 1;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    Object.assign(a.learn, { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 }); a.ui = { speed: 1, book: 1, army: 1, shop: 1, clan: 1 }; a.rv = { done: 1 };
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.starChests = Math.floor(3 * n / 3); a.sel = 'robb'; H.setAcc(a); H.persist(); H.showHub('battle'); }, n);
  const box = (page, q) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) }; }, q);
  let taps = 0; const tap = async (page, sel, ms) => { await page.locator(sel).first().tap({ force: true }); taps++; await page.waitForTimeout(ms || 350); };
  const playing = (page) => page.evaluate(() => ({ state: window.HOLDOR.G.state, lvl: window.HOLDOR.G.level && window.HOLDOR.G.level.id, mode: window.HOLDOR.G.mode }));

  // ---- 1. home → next stage in two taps (390×844) ----
  let page = await open(844);
  await setup(page, 20); await page.waitForTimeout(900);
  taps = 0; await tap(page, '#bBattle', 600);
  const map = await page.evaluate(() => ({ h2: (document.querySelector('#playcard h2') || {}).textContent, next: window.HOLDOR.LEVELS[20].n, pin: !!document.querySelector('.mn.open[data-l="21"] animate'),
    lockGrey: /grayscale/.test(getComputedStyle(document.querySelector('.mn.lock')).filter), stars: document.querySelector('.mn.open[data-l="20"]').textContent.includes('★'), strip: document.querySelectorAll('#playcard .pdeck .pdi').length, nextC: !!document.getElementById('bNextC') }));
  ok('BATTLE opens the map at the next stage: its pin pulses, locked pins are grey, cleared pins carry small stars, the deck strip has 9 pieces, no "next stage" button when already there', map.h2 === map.next && map.pin && map.lockGrey && map.stars && map.strip === 9 && !map.nextC, JSON.stringify(map));
  const go = await box(page, '#bGo'), tabs = await box(page, '.hubtabs'), strip = await box(page, '#pDeckStrip');
  ok('⚔ TO BATTLE: one wide button (≥ 300×48) under the deck strip, above the tabs, inside the screen', go && go.w >= 300 && go.h >= 48 && strip && strip.b <= go.y && go.b <= tabs.y && go.b <= 844, JSON.stringify({ go, strip, tabs }));
  const chg = await box(page, '#pDeck'); ok('the "change ›" link is a 44 px target', chg && chg.h >= 44, JSON.stringify(chg));
  await page.screenshot({ path: SC + 'flow150_map.png' });
  await tap(page, '#bGo', 600);
  const p1 = await playing(page); ok('home → fight in 2 taps (the next stage)', taps === 2 && p1.state === 'play' && p1.lvl === 21, taps + ' taps ' + JSON.stringify(p1));
  // ---- 2. a replay for stars: BATTLE → pin → ⚔ TO BATTLE ----
  await setup(page, 20); await page.waitForTimeout(900);
  taps = 0; await tap(page, '#bBattle', 600);
  await page.evaluate(() => document.querySelector('.mn.open[data-l="17"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))); taps++; await page.waitForTimeout(400);
  const pick = await page.evaluate(() => ({ h2: (document.querySelector('#playcard h2') || {}).textContent, n17: window.HOLDOR.LEVELS[16].n, nextC: !!document.getElementById('bNextC'), best: !!document.querySelector('#playcard .bst') }));
  ok('a tapped pin selects that stage: its name, its best stars, a "next stage" button to come back', pick.h2 === pick.n17 && pick.nextC && pick.best, JSON.stringify(pick));
  await tap(page, '#bGo', 600);
  const p2 = await playing(page); ok('home → replay of stage 17 in 3 taps', taps === 3 && p2.state === 'play' && p2.lvl === 17, taps + ' taps ' + JSON.stringify(p2));
  // ---- 3. the Hold: one tap ----
  await setup(page, 20); await page.waitForTimeout(900);
  taps = 0; await tap(page, '#bHold', 800);
  const p3 = await playing(page); ok('home → the Hold in 1 tap', taps === 1 && p3.state === 'play' && p3.mode === 'online', taps + ' taps ' + JSON.stringify(p3));
  // ---- 4. an early account: still two taps, no deck strip ----
  await setup(page, 4); await page.waitForTimeout(900);
  taps = 0; await tap(page, '#bBattle', 600);
  const early = await page.evaluate(() => ({ strip: !!document.querySelector('#pDeckStrip'), go: (document.querySelector('#bGo') || {}).textContent }));
  await tap(page, '#bGo', 600);
  const p4 = await playing(page); ok('stage 5 for a young account: 2 taps, no deck strip yet', taps === 2 && p4.state === 'play' && p4.lvl === 5 && !early.strip && /TO BATTLE/.test(early.go), taps + ' taps ' + JSON.stringify({ p4, early }));
  await page.close();

  // ---- 5. the result screen on a short phone (390×700) ----
  page = await open(700);
  await setup(page, 20); await page.waitForTimeout(600);
  await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ mode: 'campaign', level: H.LEVELS[20] }); const G = H.G; G.kills = 40; G.goldReward = 480; H.ACC.campaign[21] = 3; G.cardReward = { n: 4, name: 'Scorpion' };
    try { window.HOLDOR_LEARN.LEARN.at.length = 0; for (const k of ['warhammer', 'howl']) { G.learnAsk = [k]; window.HOLDOR_LEARN.learnPick(k); } G.hLv = 2; } catch (e) {} window.HOLDOR_MARKET.showCampaignResult(true, 3, [], 3); });
  await page.waitForTimeout(2000);
  const nx = await box(page, '#bNext'), rp = await box(page, '#bRetry'), hm = await box(page, '#bHome');
  const win = await page.evaluate(() => ({ nx: (document.querySelector('#bNext .nx') || {}).textContent, chips: document.querySelectorAll('#card .rew .rt').length, gold: (document.querySelector('#card p.m b') || {}).textContent, share: !!document.getElementById('bShare'), map: !!document.getElementById('bMap'), bcard: !!document.querySelector('.bcard'),
    order: [...document.querySelectorAll('#card .btn.nextbig, #card .resrow, #card .reslinks, #card .bcard')].map(e => e.className.split(' ')[0] || e.id).join('>') }));
  ok('a win on 390×700: NEXT STAGE › is the one big button (≥ 56 px), inside the first screen, with Replay and Home under it and the build card last', nx && nx.h >= 56 && nx.y >= 0 && nx.b <= 700 && rp && rp.h >= 44 && rp.b <= 700 && hm && hm.h >= 44 && hm.b <= 700 && /NEXT STAGE/.test(win.nx) && /^(btn)>(resrow)>(reslinks)>(bcard)$/.test(win.order), JSON.stringify({ nx, rp, hm, win }));
  ok('the rewards read in one glance: gold, stars, dragonglass and cards as chips; Map, Upgrades and Share stay as links', win.chips >= 4 && /\+480/.test(win.gold) && win.share && win.map && win.bcard, JSON.stringify(win));
  await page.screenshot({ path: SC + 'flow150_win700.png' });
  taps = 0; await tap(page, '#bNext', 700);
  const p5 = await playing(page); ok('NEXT STAGE › starts the next stage: 1 tap', taps === 1 && p5.state === 'play' && p5.lvl === 22, JSON.stringify(p5));
  await page.evaluate(() => { const G = window.HOLDOR.G; G.wave = 3; window.HOLDOR_MARKET.showCampaignResult(false, 0, [], 0); }); await page.waitForTimeout(800);
  const rt = await box(page, '#bRetry'), hm2 = await box(page, '#bHome');
  const lose = await page.evaluate(() => ({ txt: (document.querySelector('#bRetry .nx') || {}).textContent, cls: document.getElementById('card').className, hero: !!document.getElementById('bHero') }));
  ok('a loss on 390×700: ⟲ TRY AGAIN is the one big button inside the screen, Home beside Champion and Towers', rt && rt.h >= 56 && rt.b <= 700 && hm2 && hm2.b <= 700 && /TRY AGAIN/.test(lose.txt) && /lose/.test(lose.cls) && lose.hero, JSON.stringify({ rt, hm2, lose }));
  await page.screenshot({ path: SC + 'flow150_lose700.png' });
  await tap(page, '#bHome', 700);
  ok('🏠 Home returns to the home', await page.evaluate(() => window.HOLDOR.CLOUD.screen === 'hub:battle' && !!document.getElementById('bBattle')));
  await page.close();
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
