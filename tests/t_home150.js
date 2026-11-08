// v1.5.0: the home answers three questions at a glance. One green BATTLE · STAGE N button straight under the art (≥ 56 px tall, in the
// first screen), one tap → the preparation sheet or the stage itself; a row of ready pills only when something is ready (chests to open,
// a champion that can level up) and none when nothing is; a quiet "opens at stage N" pill; labels on the chests; the Hold card and the
// strip stepped back; the 🎨 look switch back in the art's corner. Real taps throughout.
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
  const box = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), t: e.textContent.replace(/\s+/g, ' ').trim() }; }, sel);
  // an account with n stages held; opened = star chests already opened (3 stars fill one); castle = the story's castle (the preparation sheet needs it)
  const setup = async (o) => { await page.evaluate((o) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.tutv = 99; a.castle = o.castle ? 1 : 0;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1, chests: 1, tasks: 1, clan: 1, trials: 1 }; a.ui = { home_army: 1, home_shop: 1, home_clan: 1, home_trials: 1 };
    for (let i = 1; i <= o.n; i++) a.campaign[i] = 3; a.starChests = o.opened == null ? o.n : o.opened; a.lvlChests = 99; a.freeChestAt = o.free ? Date.now() - 90000000 : Date.now() - 3600000;
    a.holdTut = 1; a.holdIntro = 1; a.gold = o.gold == null ? 900 : o.gold; a.gems = 60; if (o.cards) a.cards = o.cards; H.setAcc(a); H.showHub('battle'); }, o); await page.waitForTimeout(900); };
  await page.goto(URL); await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_HOME150, { timeout: 20000 }); await page.waitForTimeout(300);
  await page.evaluate(() => { try { localStorage.removeItem('holdor_skin'); } catch (e) {} });
  // ---- nine stages, nothing ready: the one button, no ready row, the "opens at" pill
  await setup({ n: 9, castle: 1 });
  const b = await box('#bBattle'), st = await box('#hmStage'), nw = await box('#hmNew'), hold = await box('#bHold');
  const look = await page.evaluate(() => ({ go: document.querySelector('#bBattle').classList.contains('go150'), bg: getComputedStyle(document.querySelector('#bBattle')).backgroundImage, holdBg: getComputedStyle(document.querySelector('#bHold')).backgroundImage,
    ready: !!document.querySelector('#hmReady'), readySlots: document.querySelectorAll('.slot.ready').length, labels: [...document.querySelectorAll('.hmslots .slot .sl')].map(e => e.textContent), skin: !!document.querySelector('#bSkin'), goal: (document.querySelector('#hmGoal') || {}).textContent || '',
    order: [...document.querySelectorAll('#hubBody > *')].map(e => e.id || e.className.split(' ')[0]), map: !!document.querySelector('#bMapH'), champ: !!document.querySelector('#bChampH'), strip: [...document.querySelectorAll('.hmstrip .hpill')].map(e => e.id) }));
  ok('the primary button: BATTLE · STAGE 10 with the stage\'s name and the gold it pays, ≥ 56 px tall, straight under the art, bottom ≤ 700', !!b && /BATTLE/.test(b.t) && /STAGE 10 · /.test(b.t) && /\+\d/.test(b.t) && b.h >= 56 && b.b <= 700 && st && b.y >= st.b - 2 && b.y <= st.b + 16, JSON.stringify(b));
  ok('it is the one green button: the Hold\'s button is blue and does not pulse', look.go && /rgb\(154, 234, 120\)|#9aea78/i.test(look.bg) && !/234, 120/.test(look.holdBg) && hold && /HOLD/.test(hold.t), look.bg.slice(0, 60) + ' | ' + look.holdBg.slice(0, 60));
  ok('nothing ready → no ready row and no lit chest', !look.ready && look.readySlots === 0);
  ok('every chest has a label: Stars · Level · Free · Gift', look.labels.join() === 'Stars,Level,Free,Gift', look.labels.join());
  ok('the "opens at stage N" pill names a stage beyond the nine held', !!nw && /OPENS AT STAGE (1[0-9]|[2-9][0-9])/i.test(nw.t) && nw.h >= 44, nw && nw.t);
  ok('the order: art → BATTLE → Map · new · champion → chests → the Hold → the strip at the bottom (rank, Tasks, event); the road-north bar', look.order.join('>') === 'hmStage>battlerow>hmside>hmslots>hmHold>hmstrip' && !look.skin && /\/50/.test(look.goal) && look.map && look.champ && look.strip.join() === 'hubTro,bTasks,evBadge', JSON.stringify(look.order) + ' ' + look.goal);
  const tapTargets = await page.evaluate(() => [...document.querySelectorAll('#hubBody button')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e, '::before'); const pad = cs.content !== 'none' && cs.position === 'absolute' ? -parseFloat(cs.top || 0) * 2 : 0; return [e.id || e.className.split(' ')[0], Math.round(r.height + pad)]; }).filter(x => x[1] < 44));
  ok('every button on the home is at least 44 px tall (or reaches 44 with its hit area)', tapTargets.length === 0, JSON.stringify(tapTargets));
  await page.screenshot({ path: SC + 'home150_quiet.png' });
  // ---- the "opens at" pill opens the thing's room, back returns
  await tap('#hmNew', 700);
  const nwScr = await scr(), nwText = await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 160));
  ok('a tap on the pill leaves the home for the room of what opens next', nwScr !== 'hub:battle' || !document.querySelector('#hmStage'), nwScr + ' ' + nwText.replace(/\n/g, ' | ').slice(0, 80));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(500);
  // ---- one tap on BATTLE opens the preparation sheet (spells to choose at nine stages), START begins stage 10
  await tap('#bBattle', 800);
  const prep = await page.evaluate(() => ({ sheet: !!document.querySelector('#prep .pcard'), go: !!document.querySelector('#pGo'), state: window.HOLDOR.G.state }));
  ok('one tap on BATTLE opens the preparation sheet (no map in between)', prep.sheet && prep.go && prep.state !== 'play', JSON.stringify(prep));
  await page.screenshot({ path: SC + 'home150_prep.png' });
  await tap('#pGo', 1500);
  const g = await page.evaluate(() => ({ state: window.HOLDOR.G.state, mode: window.HOLDOR.G.mode, id: window.HOLDOR.G.level && window.HOLDOR.G.level.id }));
  ok('START begins stage 10', g.state === 'play' && g.mode === 'campaign' && g.id === 10, JSON.stringify(g));
  await page.evaluate(() => { const H = window.HOLDOR; H.G.state = 'menu'; H.showHub('battle'); }); await page.waitForTimeout(500);
  // ---- without the castle (nothing to choose yet) BATTLE goes straight into the stage
  await setup({ n: 4, castle: 0 });
  await tap('#bBattle', 1500);
  const g2 = await page.evaluate(() => ({ state: window.HOLDOR.G.state, id: window.HOLDOR.G.level && window.HOLDOR.G.level.id, prep: !!document.querySelector('#prep') }));
  ok('with nothing to choose, one tap on BATTLE starts stage 5 at once', g2.state === 'play' && g2.id === 5 && !g2.prep, JSON.stringify(g2));
  await page.evaluate(() => { const H = window.HOLDOR; H.G.state = 'menu'; H.showHub('battle'); }); await page.waitForTimeout(500);
  // ---- chests ready: the ready row says so, a tap opens the first ready chest
  await setup({ n: 9, castle: 1, opened: 7, free: 1 });
  const rd = await box('#hmReady .rdy');
  const rdN = await page.evaluate(() => ({ slots: [...document.querySelectorAll('.slot.ready')].map(s => s.id), rows: document.querySelectorAll('#hmReady .rdy').length, top: document.querySelector('#hmReady').getBoundingClientRect().top < document.querySelector('#hmStage').getBoundingClientRect().top }));
  ok('two star chests + the free one ready → the ready row on top: "3 chests to open", the star and free slots lit', !!rd && /3 chests to open/i.test(rd.t) && rd.h >= 44 && rdN.rows === 1 && rdN.slots.join() === 'starChest,freeChest' && rdN.top, JSON.stringify([rd, rdN]));
  await page.screenshot({ path: SC + 'home150_ready.png' });
  await tap('#hmReady .rdy', 1200);
  const ch = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, scene: !!document.querySelector('#cbig, #cch, .chest, #chestWrap'), home: !!document.querySelector('#hmStage') }));
  ok('a tap on the ready pill opens the chest', ch.scene || !ch.home, JSON.stringify(ch));
  // close the chest scene the way a player does: the three lucky taps on the chest, then SKIP › and COLLECT — so nothing covers the home afterwards
  for (let i = 0; i < 4 && await page.locator('#cer.lucky #cch').count(); i++) { await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(500); }
  await page.waitForTimeout(600);
  for (let i = 0; i < 3 && !(await page.locator('#cskip').count()); i++) { if (await page.locator('#cch').count()) await page.locator('#cch').tap({ force: true }); await page.waitForTimeout(400); }
  if (await page.locator('#cskip').count()) { await page.locator('#cskip').tap({ force: true }); await page.waitForTimeout(200); }
  if (await page.locator('#ccol').count()) { await page.locator('#ccol').tap({ force: true }); await page.waitForTimeout(300); }
  ok('the chest scene closes after SKIP › and COLLECT', await page.evaluate(() => { const e = document.querySelector('#cer'); return !e || getComputedStyle(e).display === 'none'; }));
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(500);
  // ---- a champion that can level up: a second pill, green, and ⬆ on the champion button; the pill opens the champion's room
  const key = await page.evaluate(() => 'c:' + window.HOLDOR.ACC.sel);
  await setup({ n: 9, castle: 1, gold: 50000, cards: { [key]: 99 } });
  const up = await page.evaluate(() => ({ pills: [...document.querySelectorAll('#hmReady .rdy')].map(e => e.dataset.r + ':' + e.textContent.replace(/\s+/g, ' ').trim()), upb: !!document.querySelector('#bChampH .upb'), can: window.HOLDOR_HOME150.homeReadyItems(9).map(i => i.k) }));
  ok('a champion that can level up → a "… can level up" pill and ⬆ on the champion button; nothing else is announced', up.pills.length === 1 && /^champ:.* can level up/.test(up.pills[0]) && up.upb && up.can.join() === 'champ', JSON.stringify(up));
  await tap('#hmReady .rdy.champ', 700);
  ok('the pill opens the champion\'s room', /LEVEL UP|RIDE|RIDING/.test(await page.evaluate(() => document.querySelector('#card').innerText)), await scr());
  await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(500);
  ok('one look, no 🎨 (v1.0.98)', await page.evaluate(() => !document.querySelector('#bSkin')));
  // ---- a short phone: the button still sits in the first screen
  await page.setViewportSize({ width: 360, height: 740 }); await page.evaluate(() => window.HOLDOR.showHub('battle')); await page.waitForTimeout(700);
  const b2 = await box('#bBattle');
  ok('on 360×740 the button is ≥ 56 px tall and ends above 600', !!b2 && b2.h >= 56 && b2.b <= 600, JSON.stringify(b2));
  await page.screenshot({ path: SC + 'home150_short.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  // ---- two stages held: the pill says what opens at stage 3 (the Hold); a brand-new player sees BEGIN and no pills
  await setup({ n: 2, castle: 0 });
  const two = await page.evaluate(() => ({ nw: (document.querySelector('#hmNew') || {}).textContent || '', battle: document.querySelector('#bBattle').textContent, ready: !!document.querySelector('#hmReady') }));
  ok('with two stages held: BATTLE · STAGE 3, the pill says what opens at stage 3, nothing ready', /STAGE 3/.test(two.battle) && /OPENS AT STAGE 3/i.test(two.nw) && !two.ready, JSON.stringify(two));
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; H.setAcc(a); H.showHub('battle'); }); await page.waitForTimeout(600);
  const nw0 = await page.evaluate(() => ({ battle: document.getElementById('bBattle').textContent, hint: !!document.querySelector('.hint'), pill: !!document.querySelector('#hmNew'), ready: !!document.querySelector('#hmReady'), h: document.getElementById('bBattle').getBoundingClientRect().height }));
  ok('a brand-new player: BEGIN · YOUR FIRST LESSON on the same big button, the hint, no pills', /BEGIN/.test(nw0.battle) && nw0.hint && !nw0.pill && !nw0.ready && nw0.h >= 56, JSON.stringify(nw0));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
