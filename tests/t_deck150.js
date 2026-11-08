// v1.5.0: the Army tab on a small phone (360×740) — real taps. The deck: no horizontal overflow on any sub-tab, captions on one line,
// the ⬆ badge and the RIDING tag inside the card, the swap banner above the tab bar with the last row still reachable under it,
// 44 px taps (Cancel, Close), a locked card's sheet grey with the stage it opens at; the deck's INFO opens a room whose back arrow
// returns to the deck (the Towers / Spells sub-tabs still come back to themselves); the champion strip: one-line names, the level under
// them, the RIDING ribbon and the ⬆ coin visible.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_DECK && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(300); };
  const sub = () => page.evaluate(() => (document.querySelector('.subtabs button.on') || { dataset: {} }).dataset.sub || null);
  // 14 stages held: 6 towers open (5 in the deck, 1 at home), weirwood + maul locked; 5 spells open, jars + beacon locked; cards for the ⬆ badge
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('targaryen', 0, 'squire'); a.intro = 1; a.tut = 1; a.sv = 0; a.castle = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, trials: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= 14; i++) a.campaign[i] = 3; a.gold = 90000; a.gems = 500; a.cards = { ['c:' + a.sel]: 300, 't:watch': 300, 's:arrows': 300 }; H.setAcc(a); H.persist(); H.showHub('coll', 'deck'); });
  await page.waitForTimeout(500);
  // 1. no horizontal overflow on any Army sub-tab
  const over = {};
  for (const s of ['deck', 'heroes', 'towers', 'spells']) { await page.evaluate(s => window.HOLDOR.showHub('coll', s), s); await page.waitForTimeout(250);
    over[s] = await page.evaluate(() => { const hb = document.getElementById('hubBody'); return [document.documentElement.scrollWidth, innerWidth, hb.scrollWidth, hb.clientWidth]; }); }
  ok('no horizontal overflow on the Army tab (deck, champions, towers, spells)', Object.values(over).every(v => v[0] <= v[1] && v[2] <= v[3]), JSON.stringify(over));
  await page.evaluate(() => window.HOLDOR.showHub('coll', 'deck')); await page.waitForTimeout(400);
  // 2. the deck's cards: captions on one line, the champion's four skill icons fit, the badges inside the card
  const d0 = await page.evaluate(() => { const r = e => e.getBoundingClientRect(); const cards = [...document.querySelectorAll('.ccard.dkc')];
    const clip = cards.filter(c => ['.nm', '.rar'].some(q => { const e = c.querySelector(q); return e && (e.scrollWidth > e.clientWidth + 1 || r(e).height > 24); })).map(c => c.dataset.dv);
    const hero = document.querySelector('.deckrow .ccard[data-c]'), sk = hero.querySelector('.skrow'), hb = r(hero), inside = e => { if (!e) return true; const b = r(e); return b.left >= hb.left - 1 && b.right <= hb.right + 1 && b.top >= hb.top - 1 && b.bottom <= hb.bottom + 1; };
    const tw = document.querySelector('.ccard.dkc[data-dk="t"]'), tb = r(tw), tu = tw.querySelector('.upb');
    return { n: cards.length, clip, lockN: document.querySelectorAll('.ccard.dkc[data-dw="lock"]').length, inDeck: document.querySelectorAll('.ccard.dkc.indeck').length, skFit: sk.scrollWidth <= sk.clientWidth + 1, skW: [sk.scrollWidth, sk.clientWidth], heroW: Math.round(hb.width),
      tagIn: inside(hero.querySelector('.tag')), upbIn: inside(hero.querySelector('.upb')), hasTag: !!hero.querySelector('.tag'), hasUpb: !!hero.querySelector('.upb'), towerUpbIn: !!tu && r(tu).top >= tb.top && r(tu).right <= tb.right + 1 }; });
  ok('deck: 15 cards (8 in the deck, 4 locked), no caption clips, the four skill icons fit the champion card', d0.n === 15 && d0.inDeck === 8 && d0.lockN === 4 && !d0.clip.length && d0.skFit, JSON.stringify(d0));
  ok('deck: the RIDING tag and the ⬆ badge sit inside the card (not clipped by its overflow)', d0.hasTag && d0.hasUpb && d0.tagIn && d0.upbIn && d0.towerUpbIn, JSON.stringify([d0.hasTag, d0.hasUpb, d0.tagIn, d0.upbIn, d0.towerUpbIn]));
  // 3. swap mode by taps: the banner above the tab bar, Cancel 44 px, the last row reachable under the banner
  const S = await page.evaluate(() => window.HOLDOR_DECK.deckState());
  await tap(`.ccard[data-dk="t"][data-dv="${S.tout[0]}"]`);
  const sh = await page.evaluate(() => { const r = e => e.getBoundingClientRect(); const x = document.querySelector('#dkSheet [data-dka="x"]'), sw = document.querySelector('#dkSheet [data-dka="swap"]'); return { on: document.getElementById('dkSheet').classList.contains('on'), closeH: x && r(x).height, swapH: sw && r(sw).height }; });
  ok('the card sheet: Close ≥ 44 px, the swap button ≥ 44 px', sh.on && sh.closeH >= 44 && sh.swapH >= 44, JSON.stringify(sh));
  await tap('#dkSheet [data-dka="swap"]');
  const b0 = await page.evaluate(() => { const r = e => e.getBoundingClientRect(); const ban = document.querySelector('.dkban'), tabs = document.querySelector('.hubtabs'), cn = document.getElementById('dkCancel'); return ban && { banB: Math.round(r(ban).bottom), tabsT: Math.round(r(tabs).top), cancelH: Math.round(r(cn).height), cancelW: Math.round(r(cn).width), banL: Math.round(r(ban).left), banR: Math.round(r(ban).right), pulse: document.querySelectorAll('.ccard.dkc.swap[data-dk="t"][data-dw="in"]').length }; });
  ok('swap banner: its bottom ≤ the tab bar top, Cancel ≥ 44 px, inside the screen, 5 deck towers pulse', b0 && b0.banB <= b0.tabsT && b0.cancelH >= 44 && b0.banL >= 0 && b0.banR <= 360 && b0.pulse === 5, JSON.stringify(b0));
  await page.screenshot({ path: SC + 'deck150_swap.png' });
  const b1 = await page.evaluate(() => { const hb = document.getElementById('hubBody'); hb.scrollTop = hb.scrollHeight; const r = e => e.getBoundingClientRect(); const cards = [...document.querySelectorAll('.ccard.dkc')], last = cards[cards.length - 1], ban = document.querySelector('.dkban'); return { lastB: Math.round(r(last).bottom), banT: Math.round(r(ban).top), lastV: last.dataset.dv, room: hb.classList.contains('dkon') }; });
  ok('scrolled to the end in swap mode: the last card is fully above the banner', b1.lastB <= b1.banT && b1.room, JSON.stringify(b1));
  await page.screenshot({ path: SC + 'deck150_swap_end.png' });
  await tap('#dkCancel');
  ok('cancel: the banner goes, the body gives its room back', await page.evaluate(() => !document.querySelector('.dkban') && !document.getElementById('hubBody').classList.contains('dkon')));
  // 4. the deck's INFO opens a room whose back arrow returns to the deck (tower, spell); the Towers / Spells sub-tabs still come back to themselves
  await page.evaluate(() => { document.getElementById('hubBody').scrollTop = 0; });
  await tap(`.ccard[data-dk="t"][data-dv="${S.tin[0]}"]`); await tap('#dkSheet [data-dka="info"]');
  const room1 = await page.evaluate(() => !!document.querySelector('#armStrip') && !document.querySelector('.subtabs'));
  await tap('#bBack'); const back1 = await sub();
  await tap(`.ccard[data-dk="s"][data-dv="${S.sin[0]}"]`); await tap('#dkSheet [data-dka="info"]');
  const room2 = await page.evaluate(() => !!document.querySelector('#spStrip'));
  await tap('#bBack'); const back2 = await sub();
  ok('INFO from the deck: the tower room and the spell room come back to the deck', room1 && back1 === 'deck' && room2 && back2 === 'deck', JSON.stringify([room1, back1, room2, back2]));
  await tap('.subtabs button[data-sub="towers"]'); await tap('.ccard[data-t]'); await tap('#bBack'); const back3 = await sub();
  await tap('.subtabs button[data-sub="spells"]'); await tap('.ccard[data-s]'); await tap('#bBack'); const back4 = await sub();
  ok('from the Towers / Spells sub-tabs the rooms still come back to their own sub-tab', back3 === 'towers' && back4 === 'spells', JSON.stringify([back3, back4]));
  // 5. a locked card: its sheet is grey and says when it opens
  await tap('.subtabs button[data-sub="deck"]');
  await page.evaluate(() => { const hb = document.getElementById('hubBody'); hb.scrollTop = hb.scrollHeight; });
  await tap('.ccard[data-dk="t"][data-dw="lock"]');
  const lk = await page.evaluate(() => { const el = document.getElementById('dkSheet'), ic = el.querySelector('.dks-ic'); return { on: el.classList.contains('on'), grey: ic.classList.contains('lock') && getComputedStyle(ic).filter.includes('grayscale'), txt: el.innerText.replace(/\s+/g, ' ').slice(0, 120), noSwap: !el.querySelector('[data-dka="swap"]') }; });
  ok('a locked card: the sheet icon is grey, says "opens after stage N", no swap button', lk.on && lk.grey && /opens after stage \d+/.test(lk.txt) && lk.noSwap, JSON.stringify(lk));
  await tap('#dkSheet [data-dka="x"]');
  // 6. the champion strip: one-line names with the level under them, the RIDING ribbon and the ⬆ coin visible
  await page.evaluate(() => window.HOLDOR_ARMY.showHeroRoom(window.HOLDOR.ACC.sel)); await page.waitForTimeout(500);
  const st = await page.evaluate(() => { const r = e => e.getBoundingClientRect(); const strip = document.querySelector('#armStrip'), sb = r(strip), tiles = [...strip.querySelectorAll('.htile')];
    const nmH = tiles.map(t => Math.round(r(t.querySelector('.nm')).height)), lv = tiles.filter(t => t.querySelector('.tlv')).length, rb = strip.querySelector('.rb'), up = strip.querySelector('.upb'), rt = rb && rb.closest('.htile'), stars = rt && rt.querySelector('.stars');
    return { nmH, lv, open: tiles.filter(t => !t.classList.contains('lock')).length, rbVis: !!rb && r(rb).top >= sb.top && r(rb).bottom <= r(rt).bottom && r(rb).width > 30, rbOverName: !!rb && !!rt && r(rb).bottom <= r(rt.querySelector('.nm')).top,
      upIn: !!up && r(up).width >= 18 && r(up).left >= r(up.closest('.htile')).left && r(up).right <= r(up.closest('.htile')).right + 1 && getComputedStyle(up).borderRadius !== '0px', starsIn: !!stars && r(stars).bottom <= r(rt).bottom + 1, docW: document.documentElement.scrollWidth }; });
  ok('strip: every name on one line, the level under the open ones, no horizontal overflow', st.nmH.every(h => h <= 14) && st.lv === st.open && st.docW <= 360, JSON.stringify(st));
  ok('strip: the RIDING ribbon is visible above the portrait (not clipped, not over the name), the ⬆ coin inside the tile, the stars inside', st.rbVis && st.rbOverName && st.upIn && st.starsIn, JSON.stringify([st.rbVis, st.rbOverName, st.upIn, st.starsIn]));
  await page.screenshot({ path: SC + 'deck150_strip.png' });
  await page.evaluate(() => window.HOLDOR_ARMY.showTowerRoom('watch')); await page.waitForTimeout(400);
  const tt = await page.evaluate(() => [...document.querySelectorAll('#armStrip .htile .nm')].map(n => Math.round(n.getBoundingClientRect().height)));
  ok('tower strip: every name on one line', tt.length === 8 && tt.every(h => h <= 14), JSON.stringify(tt));
  ok('no page errors', errors.length === 0, errors.join('|'));
  console.log(JSON.stringify(R, null, 1)); const bad = Object.values(R).filter(v => v.startsWith('FAIL')); console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
