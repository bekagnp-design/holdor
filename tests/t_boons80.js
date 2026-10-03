// v1.0.80: Hold blessings. After the 5th wave of the Hold the game stops and offers three blessings (the same three for everyone on
// the same day); a real tap picks one, the wave starts, the effect applies (towers +15% hits harder, the door mends, gold …), they stack,
// a campaign stage never offers them, a new run starts clean, and the offer takes nothing from the battle's random stream.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_BOONS, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  // a Hold run with a strong defence, played to the end of wave 5
  const toFive = () => page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tour = 99; a.holdTut = 1; a.holdIntro = 1;
    a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1, tasks: 1 }; a.learn = { chest: 1, hold: 1, champ: 1, glass: 1, keep: 1, tier2: 1, fire: 1 };
    for (let i = 1; i <= 20; i++) a.campaign[i] = 3; a.tlv = { watch: 6, scorp: 6, glass: 6, keep: 6, wild: 6, weir: 6 }; H.setAcc(a);
    H.startGame({ mode: 'online' }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5;
    const kinds = ['watch', 'wild', 'scorp', 'weir', 'watch', 'glass', 'keep', 'wild']; G.map.slots.slice().sort((p, q) => q.y - p.y).slice(0, 8).forEach((s, i) => { H.build(s, kinds[i]); if (s.tower) s.tower.lvl = 3; });
    G.gold = 500; let n = 0; while (G.wave < 5 && n < 60 * 600) { if (H.canCall()) H.callWave(); H.step(); n++; }
    n = 0; while (!document.getElementById('boonOv') && n < 60 * 600) { if (H.canCall()) H.callWave(); H.step(); n++; }
    return { wave: G.wave, ov: !!document.getElementById('boonOv'), paused: G.paused, ask: G.boonAsk, door: Math.round(G.doorHp), max: G.doorMax, mode: G.mode }; });
  const s = await toFive();
  ok('after wave 5 of the Hold: the game stops and offers three blessings', s.ov && s.paused && s.wave === 5 && s.ask && s.ask.length === 3 && new Set(s.ask).size === 3, JSON.stringify(s));
  const same = await page.evaluate(() => JSON.stringify(window.HOLDOR_BOONS.boonOffer(5)) === JSON.stringify(window.HOLDOR.G.boonAsk) && JSON.stringify(window.HOLDOR_BOONS.boonOffer(5)) === JSON.stringify(window.HOLDOR_BOONS.boonOffer(5)) && JSON.stringify(window.HOLDOR_BOONS.boonOffer(5)) !== JSON.stringify(window.HOLDOR_BOONS.boonOffer(10)));
  ok('the offer comes from the day and the wave (the same for everyone today, another at wave 10)', same);
  await page.screenshot({ path: SC + 'boons80_offer.png' });
  // pick the first by a real tap
  const k = s.ask[0];
  const before = await page.evaluate(() => ({ gold: Math.floor(window.HOLDOR.G.gold), door: window.HOLDOR.G.doorHp, max: window.HOLDOR.G.doorMax }));
  await page.locator(`#boonOv [data-boon="${k}"]`).tap({ force: true }); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ ov: !!document.getElementById('boonOv'), paused: window.HOLDOR.G.paused, boons: window.HOLDOR.G.boons, boon: window.HOLDOR.G.boon, gold: Math.floor(window.HOLDOR.G.gold), door: window.HOLDOR.G.doorHp, max: window.HOLDOR.G.doorMax }));
  ok('a tap takes the blessing, closes the offer and lets the game run', !after.ov && !after.paused && after.boons.length === 1 && after.boons[0] === k, JSON.stringify(after));
  const eff = { arrows: after.boon && after.boon.tw === 0.15, blade: after.boon && after.boon.hero === 0.35, storm: after.boon && after.boon.sp === 0.4, coin: after.gold === before.gold + 300,
    loot: after.boon && after.boon.loot === 0.2, mend: after.door > before.door || before.door === before.max, oak: after.max === before.max + Math.round(before.max * 0.2), focus: true }[k];
  ok('the blessing works (' + k + ')', eff, JSON.stringify([before, after]));
  // the wave starts after the pick
  const w6 = await page.evaluate(() => { const H = window.HOLDOR, G = H.G; let n = 0; while (G.wave < 6 && n < 60 * 120) { if (H.canCall()) H.callWave(); H.step(); n++; } return G.wave; });
  ok('the next wave starts after the choice', w6 === 6);
  // the damage rule: towers +15%
  const mul = await page.evaluate(() => { const G = window.HOLDOR.G, B = window.HOLDOR_BOONS; const keep = G.boon; G.boon = { tw: 0.15, hero: 0.35, sp: 0.4 };
    const r = [B.boonMul('watch'), B.boonMul('hero'), B.boonMul('power'), B.boonMul('nothing')]; G.boon = keep; return r; });
  ok('damage multipliers: towers ×1.15, champion ×1.35, spells ×1.4, the rest ×1', JSON.stringify(mul) === JSON.stringify([1.15, 1.35, 1.4, 1]), JSON.stringify(mul));
  // nobody chooses: the first is taken after 20 s (the timer is checked by shortening it)
  const auto = await page.evaluate(async () => { const H = window.HOLDOR, G = H.G; let n = 0; while (!document.getElementById('boonOv') && n < 60 * 900) { if (H.canCall()) H.callWave(); H.step(); n++; }
    const ask = G.boonAsk && G.boonAsk.slice(), wave = G.wave; if (!ask) return { ask: null, wave }; clearTimeout(G.boonT); G.boonT = setTimeout(() => { if (G.boonAsk) window.HOLDOR_BOONS.boonPick(G.boonAsk[0]); }, 50);
    await new Promise(r => setTimeout(r, 200)); return { ask, boons: G.boons.slice(), wave }; });
  ok('at wave 10 a second offer; untouched, the first is taken and the blessings stack', auto.ask && auto.wave === 10 && auto.boons.length === 2 && auto.boons[1] === auto.ask[0], JSON.stringify(auto));
  // a campaign stage never offers; a new run starts clean
  const camp = await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ level: H.stageLevel(12) }); const G = H.G; G.lq = []; G.tut = null; G.paused = false; G.gold = 1e5;
    G.map.slots.slice(0, 8).forEach(s => { H.build(s, 'watch'); if (s.tower) s.tower.lvl = 3; }); let n = 0; while (G.wave < 7 && n < 60 * 900 && G.state === 'play') { if (H.canCall()) H.callWave(); H.step(); n++; }
    return { wave: G.wave, ov: !!document.getElementById('boonOv'), boons: (G.boons || []).length, boon: G.boon }; });
  ok('a campaign stage past wave 5: no offer, no blessings carried over', camp.wave >= 6 && !camp.ov && camp.boons === 0 && !camp.boon, JSON.stringify(camp));
  // the offer never touches the battle's random stream (the waves stay the day's waves)
  const rng = await page.evaluate(() => { const H = window.HOLDOR; H.startGame({ mode: 'online' }); const G = H.G; let calls = 0; const r0 = G.rng; G.rng = () => { calls++; return r0(); };
    G.wave = 5; G.boonDone = {}; const shown = window.HOLDOR_BOONS.boonCheck(); window.HOLDOR_BOONS.boonPick(G.boonAsk[1]); G.rng = r0; return { shown, calls }; });
  ok('an offer and a pick take nothing from the battle\'s random stream', rng.shown && rng.calls === 0, JSON.stringify(rng));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
