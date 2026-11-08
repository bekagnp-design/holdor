// v1.2.4 / flow150: the preparation before a battle — real taps. The map card shows the chosen deck (champion, 3 spells, 5 towers) with one
// ⚔ TO BATTLE button; "change ›" opens Army → Loadout (the one editor) and a pill brings the player back to the same stage; a swap made in
// the Loadout shows on the map card; the battle starts with the chosen spells and towers. Before stage 5 there is no deck strip at all.
// (Adapted from the v1.2.4 sheet test: the sheet with its own tower/spell editor is gone, the data functions and the battle outcome are the same.)
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_PREP && window.HOLDOR_FLOW150, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(250); };
  const setup = (n) => page.evaluate((n) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= n; i++) a.campaign[i] = 3; a.sel = 'robb'; H.setAcc(a); H.persist(); H.showCampaign('gates'); }, n);
  // early: nothing to choose, no deck strip, the battle starts at once
  await setup(4);
  ok('before stage 5 the card has no deck strip', await page.evaluate(() => !document.querySelector('#pDeckStrip') && !document.querySelector('#prep')));
  await tap('#bGo'); await page.waitForTimeout(400);
  ok('before stage 5 the battle starts with one tap, no sheet', await page.evaluate(() => !document.querySelector('#prep') && window.HOLDOR.G.state === 'play'));
  // stage 20 cleared: seven towers, five spells — the card shows the deck
  await setup(20);
  const strip = await page.evaluate(() => ({ strips: document.querySelectorAll('#playcard .pdeck').length, sp: document.querySelectorAll('#playcard .pdi.sp').length, tw: document.querySelectorAll('#playcard .pdi.tw').length,
    ch: document.querySelectorAll('#playcard .pdi.ch').length, roster: window.HOLDOR_PREP.towerRoster().length, go: (document.querySelector('#bGo') || {}).textContent || '', sheet: !!document.querySelector('#prep') }));
  ok('the map card shows the deck: the champion, 3 spells, 5 of the 7 open towers, one ⚔ TO BATTLE button, no sheet', strip.strips === 1 && strip.sp === 3 && strip.tw === 5 && strip.ch === 1 && strip.roster === 5 && /TO BATTLE/.test(strip.go) && !strip.sheet, JSON.stringify(strip));
  await page.screenshot({ path: SC + 'prep124.png' });
  // change › opens the Loadout with a way back to the same stage
  const h2 = await page.evaluate(() => document.querySelector('#playcard h2').textContent);
  await tap('#pDeck'); await page.waitForTimeout(400);
  const dk = await page.evaluate(() => ({ scr: window.HOLDOR.CLOUD.screen, ret: !!document.getElementById('dkRet'), indeck: document.querySelectorAll('.ccard.indeck').length, txt: (document.getElementById('dkRet') || {}).parentElement ? document.getElementById('dkRet').parentElement.textContent : '' }));
  ok('"change ›" opens Army → Loadout (the one editor) with a "Back to the battle" pill that names the stage', dk.scr === 'hub:coll' && dk.ret && dk.indeck >= 8 && dk.txt.includes(h2), JSON.stringify(dk));
  // a swap made in the Loadout (its own function; the two-tap swap is t_deck144's job) shows on the map card
  const before = await page.evaluate(() => window.HOLDOR_PREP.towerRoster());
  const swapped = await page.evaluate((b0) => window.HOLDOR_DECK.deckSwap('t', b0, 'rook'), before[0]);
  await page.evaluate(() => window.HOLDOR_SP.spellEquip('night', 0));
  await tap('#dkRet'); await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ card: !!document.querySelector('#playcard'), h2: (document.querySelector('#playcard h2') || {}).textContent, tw: [...document.querySelectorAll('#playcard .pdi.tw')].map(e => e.dataset.dt), sp: [...document.querySelectorAll('#playcard .pdi.sp')].map(e => e.dataset.ds), ret: window.HOLDOR_FLOW150.PREP.ret }));
  ok('the pill returns to the same stage; the card shows the swapped tower and Long Night in slot 1', swapped && back.card && back.h2 === h2 && back.tw.includes('rook') && !back.tw.includes(before[0]) && back.tw.length === 5 && back.sp[0] === 'night' && back.ret === null, JSON.stringify(back));
  // another tab forgets the way back
  await page.evaluate(() => { window.HOLDOR_FLOW150.PREP.ret = 17; window.HOLDOR.showHub('shop'); }); await page.waitForTimeout(200);
  ok('leaving for another tab forgets the way back', await page.evaluate(() => window.HOLDOR_FLOW150.PREP.ret === null && !document.getElementById('dkRet')));
  await setup(20); await tap('#bGo'); await page.waitForTimeout(500);
  const res = await page.evaluate(() => { const H = window.HOLDOR; return { play: H.G.state === 'play', slots: H.G.slots, bt: window.HOLDOR_PREP.battleTowers(), sheet: !!document.querySelector('#prep') }; });
  ok('⚔ TO BATTLE starts the battle at once, no sheet, with the deck as it stands (3 spells, 5 towers)', res.play && !res.sheet && res.slots.length === 3 && res.bt.length === 5, JSON.stringify(res));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
