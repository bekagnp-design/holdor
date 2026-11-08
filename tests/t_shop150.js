// v1.5.0: the Shop made simple. The balance is pinned on the first screen; a deal the player can afford has a green BUY that really
// buys on a tap; one he cannot afford says what is missing; the free deal says CLAIM; the locked picks are a short row with UNLOCK;
// the timer ticks; every button is at least 44 px tall; a guest's Stars packs are grey with the reason; the Season card opens the season.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_SHOP150, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel, ms) => { await page.locator(sel).first().tap(); await page.waitForTimeout(ms == null ? 400 : ms); };
  const setup = (gold, gems) => page.evaluate(([gold, gems]) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    for (let i = 1; i <= 5; i++) a.campaign[i] = 3; a.gold = gold; a.gems = gems; a.deals = null; H.setAcc(a); H.persist(); H.showHub('shop'); }, [gold, gems]);
  // ---- a poor player: everything but the free deal says what is missing
  await setup(0, 0); await page.waitForTimeout(700);
  const poor = await page.evaluate(() => { const H = window.HOLDOR, d = H.genDeals(); const vp = window.innerHeight;
    const bal = document.querySelector('.shbal'), rb = bal && bal.getBoundingClientRect();
    const btn = i => document.querySelector(`[data-deal="${i}"]`);
    return { bal: !!bal && rb.top >= 0 && rb.bottom <= vp / 2, balTxt: bal ? bal.innerText.replace(/\s+/g, ' ') : '', first: (document.getElementById('hubBody').firstElementChild || {}).className,
      free: btn(0) ? { txt: btn(0).textContent.trim(), cls: btn(0).className, dis: btn(0).disabled } : null,
      d1: { price: d[1].price, txt: btn(1).textContent.trim(), dis: btn(1).disabled, cls: btn(1).className },
      d2: { price: d[2].price, txt: btn(2).textContent.trim(), dis: btn(2).disabled },
      locked: [...document.querySelectorAll('.sitem.deal.lock')].map(e => ({ unl: (e.querySelector('[data-unl]') || {}).textContent, chip: (e.querySelector('.pchip') || {}).textContent })),
      timer: !!document.querySelector('.shtimer #dealCd'), t0: (document.getElementById('dealCd') || {}).textContent,
      small: [...document.querySelectorAll('#hubBody *')].filter(e => e.children.length === 0 && e.textContent.trim() && !e.closest('svg') && !e.classList.contains('badge')).map(e => parseFloat(getComputedStyle(e).fontSize)).filter(x => x < 13).length,
      short: [...document.querySelectorAll('#hubBody button')].map(b => Math.round(b.getBoundingClientRect().height)).filter(h => h < 44).length,
      stars: [...document.querySelectorAll('[data-stars]')].map(b => b.dataset.stars + ':' + b.disabled + ':' + b.closest('.sitem').classList.contains('lock')),
      note: [...document.querySelectorAll('.shopnote')].map(x => x.textContent).join('|'), season: (document.querySelector('#bSeason') || {}).textContent || '',
      sections: [...document.querySelectorAll('#hubBody .hh h2')].map(h => h.textContent) }; });
  ok('the balance is pinned on the first screen with what each currency buys', poor.bal && /Gold/.test(poor.balTxt) && /Dragonglass/.test(poor.balTxt) && /shbal/.test(poor.first), poor.balTxt + ' · ' + poor.first);
  ok('the sections come in order: deals, chests, gold, dragonglass', JSON.stringify(poor.sections) === '["For you today","Chests","Gold for dragonglass","Dragonglass"]', JSON.stringify(poor.sections));
  ok('the free deal says CLAIM in green', poor.free && poor.free.txt === 'CLAIM' && /free/.test(poor.free.cls) && !poor.free.dis, JSON.stringify(poor.free));
  const need = p => p.gold ? 'Need ' + window_fmt(p.gold) + ' more' : 'Need ' + p.gems + ' more';
  function window_fmt(n) { return n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n); }
  ok('a deal he cannot afford is grey and says what is missing', poor.d1.dis && poor.d1.txt === need(poor.d1.price) && /need/.test(poor.d1.cls) && poor.d2.dis && poor.d2.txt === need(poor.d2.price), JSON.stringify([poor.d1, poor.d2]));
  ok('the three locked picks are a row with UNLOCK buttons that say what is missing', poor.locked.length === 3 && poor.locked.every(l => /Need \d+ more/.test(l.unl || '')) && poor.locked.map(l => l.chip.trim()).join() === '20,40,80', JSON.stringify(poor.locked));
  ok('no text under 13 px (badges aside), no button under 44 px', poor.small === 0 && poor.short === 0, poor.small + ' / ' + poor.short);
  ok('a guest sees the Stars packs grey, disabled, with the reason', poor.stars.join() === 'gems_s:true:true,gems_m:true:true,gems_l:true:true' && /signed in through Telegram/.test(poor.note), poor.stars.join() + ' · ' + poor.note);
  ok('the Season Pass and VIP are one card with their Stars prices', /Season Pass/.test(poor.season) && /VIP/.test(poor.season) && /250/.test(poor.season) && /200/.test(poor.season), poor.season.replace(/\s+/g, ' ').slice(0, 120));
  await page.waitForTimeout(1200);
  const t1 = await page.evaluate(() => document.getElementById('dealCd').textContent);
  ok('the timer ticks', poor.timer && t1 !== poor.t0, poor.t0 + ' → ' + t1);
  await page.screenshot({ path: SC + 'shop150_poor.png' });
  // ---- a rich player: green BUY, and a real tap buys
  await setup(99999, 9999); await page.waitForTimeout(700);
  const rich = await page.evaluate(() => { const b = document.querySelector('[data-deal="1"]'), cs = getComputedStyle(b); const d = window.HOLDOR.genDeals()[1];
    return { txt: b.textContent.trim(), dis: b.disabled, cls: b.className, bg: cs.backgroundImage, price: d.price, kind: d.k, gold: window.HOLDOR.goldOf(), gems: window.HOLDOR.ACC.gems, chip: (b.closest('.sitem').querySelector('.pchip') || {}).textContent }; });
  ok('a deal he can afford has a green BUY and the price as one chip', rich.txt === 'BUY' && !rich.dis && /buy/.test(rich.cls) && /182, 255, 154|b6ff9a/i.test(rich.bg) && /\d/.test(rich.chip || ''), JSON.stringify([rich.txt, rich.cls, rich.chip]));
  await tap('[data-deal="1"]', 700);
  const after = await page.evaluate(() => { const H = window.HOLDOR, b = document.querySelector('[data-deal="1"]') || document.querySelector('.sitem.deal.done button'); return { bought: H.dealsState().bought.slice(), gold: H.goldOf(), gems: H.ACC.gems, btn: b ? b.textContent.trim() : '', done: document.querySelectorAll('.sitem.deal.done').length }; });
  const paid = rich.price.gold ? rich.gold - after.gold : rich.gems - after.gems, due = rich.price.gold || rich.price.gems || 0;
  ok('tapping BUY buys it: paid the price, the card is marked taken', after.bought[1] === 1 && after.btn === '✔ TAKEN' && after.done === 1 && (rich.kind === 'gold' || rich.kind === 'gems' ? true : paid === due), JSON.stringify({ paid, due, kind: rich.kind, btn: after.btn }));
  const claim = await page.evaluate(() => { const H = window.HOLDOR; const g0 = H.goldOf(), m0 = H.ACC.gems; return { g0, m0, d: H.genDeals()[0] }; });
  await tap('[data-deal="0"]', 700);
  const claimed = await page.evaluate(() => ({ bought: window.HOLDOR.dealsState().bought[0], gold: window.HOLDOR.goldOf(), gems: window.HOLDOR.ACC.gems }));
  ok('tapping CLAIM takes the free deal', claimed.bought === 1 && (claim.d.k === 'gold' ? claimed.gold === claim.g0 + claim.d.gold : claim.d.k === 'gems' ? claimed.gems === claim.m0 + claim.d.gems : true), JSON.stringify([claim.d.k, claim.d.s]));
  // the locked row: UNLOCK really unlocks a fourth pick
  const gemsBefore = await page.evaluate(() => window.HOLDOR.ACC.gems);   // the free deal above may have paid dragonglass
  await tap('[data-unl="3"]', 700);
  const unl = await page.evaluate(() => ({ unl: window.HOLDOR.dealsState().unl.slice(), open: document.querySelectorAll('.sitem.deal:not(.lock)').length, locked: document.querySelectorAll('.sitem.deal.lock').length, gems: window.HOLDOR.ACC.gems }));
  ok('UNLOCK opens the fourth pick for 20 dragonglass', unl.unl[3] === 1 && unl.open === 4 && unl.locked === 2 && unl.gems === gemsBefore - 20, JSON.stringify([unl, gemsBefore]));
  // the chests: the wooden one says OPEN, the others BUY
  const chests = await page.evaluate(() => [...document.querySelectorAll('[data-buy]')].map(b => b.dataset.buy + ':' + b.textContent.trim() + ':' + b.disabled));
  ok('the chests: the free one says OPEN, the rest BUY', chests.join() === 'wood:OPEN:false,iron:BUY:false,valyrian:BUY:false,dragon:BUY:false', chests.join());
  // a tap on the dragonglass balance scrolls to the packs
  await tap('#shBalD', 900);
  const scrolled = await page.evaluate(() => { const r = document.getElementById('shStars').getBoundingClientRect(); return r.top >= 0 && r.top < 200; });
  ok('a tap on the dragonglass balance scrolls to the Stars packs', scrolled);
  await page.screenshot({ path: SC + 'shop150_rich.png' });
  // the Season card opens the season page
  await page.evaluate(() => window.HOLDOR.showHub('shop')); await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('bSeason').scrollIntoView()); await page.waitForTimeout(300);
  await tap('#bSeason', 700);
  ok('the Season card opens the season page', /Season/i.test(await page.evaluate(() => document.querySelector('#card').innerText.slice(0, 120))));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
