// v1.4.4: the Loadout tab is a deck you build — real taps: a tower from the collection replaces one in the deck, a spell the same, cancel works.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_DECK, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(300); };
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('targaryen', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, trials: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= 28; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.showHub('coll', 'deck'); });
  await page.waitForTimeout(600);
  const s0 = await page.evaluate(() => { const S = window.HOLDOR_DECK.deckState(); return { tin: S.tin, tout: S.tout, sin: S.sin, sout: S.sout, inCards: document.querySelectorAll('.ccard.dkc.indeck').length, col: document.querySelectorAll('.ccard.dkc[data-dw="out"]').length }; });
  ok('the deck shows 5 towers + 3 spells in battle, the rest in the collection', s0.tin.length === 5 && s0.sin.length === 3 && s0.inCards === 8 && s0.col === s0.tout.length + s0.sout.length && s0.tout.length === 3, JSON.stringify(s0));
  await page.screenshot({ path: SC + 'deck144.png' });
  // tower: collection card → sheet → USE IN BATTLE → tap a deck tower
  const bring = s0.tout[0], out = s0.tin[1];
  await tap(`.ccard[data-dk="t"][data-dv="${bring}"]`);
  ok('a tap opens the card sheet with USE IN BATTLE and LEVEL UP', await page.evaluate(() => { const el = document.getElementById('dkSheet'); return el.classList.contains('on') && /USE IN BATTLE/.test(el.innerText) && /LEVEL UP/.test(el.innerText); }));
  await tap('#dkSheet [data-dka="swap"]');
  ok('swap mode: a banner and the deck towers pulse', await page.evaluate(() => !!document.querySelector('.dkban') && document.querySelectorAll('.ccard.dkc.swap[data-dk="t"][data-dw="in"]').length === 5));
  await page.screenshot({ path: SC + 'deck144_swap.png' });
  await tap(`.ccard[data-dk="t"][data-dv="${out}"]`);
  const s1 = await page.evaluate(() => Object.assign(window.HOLDOR_DECK.deckState(), { ban: !!document.querySelector('.dkban') }));
  ok('the tower came in at the same place, the other went to the collection', s1.tin[1] === bring && s1.tout.includes(out) && !s1.ban, JSON.stringify(s1.tin));
  // spell: deck card → SWAP OUT → a collection spell
  const sOut = s1.sin[0], sIn = s1.sout[0];
  await tap(`.ccard[data-dk="s"][data-dv="${sOut}"]`); await tap('#dkSheet [data-dka="swap"]');
  await tap(`.ccard[data-dk="s"][data-dv="${sIn}"]`);
  const s2 = await page.evaluate(() => ({ sin: window.HOLDOR_DECK.deckState().sin, lo: window.HOLDOR.ACC.loadout }));
  ok('a spell swapped out from the deck side', s2.sin[0] === sIn && !s2.sin.includes(sOut), JSON.stringify(s2));
  // cancel
  await tap(`.ccard[data-dk="t"][data-dw="in"]`); await tap('#dkSheet [data-dka="swap"]'); await tap('#dkCancel');
  ok('cancel leaves the deck as it was', await page.evaluate((t) => JSON.stringify(window.HOLDOR_DECK.deckState().tin) === t && !document.querySelector('.dkban'), JSON.stringify(s1.tin)));
  // the battle uses the deck
  const bt = await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ mode: 'campaign', level: H.LEVELS.find(l => l.id === 12) }); return { bt: window.HOLDOR_PREP.battleTowers(), slots: H.G.slots }; });
  ok('the battle uses the deck: towers and spells', JSON.stringify(bt.bt) === JSON.stringify(s1.tin) && bt.slots[0] === sIn, JSON.stringify(bt));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
