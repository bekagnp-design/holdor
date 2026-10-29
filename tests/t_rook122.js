// v1.2.2: the Rookery — opens at stage 13, its ravens go for healers, summoners and flyers, and a hit silences them. Real taps in the tower room, scripted battles.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_ROOK && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const setup = (stages) => page.evaluate((stages) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    a.learn = {}; const L = window.HOLDOR_TUT.LESSONS; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= stages; i++) a.campaign[i] = 3; a.gold = 5000; a.sel = 'robb'; H.setAcc(a); H.persist(); }, stages);
  // ---- the data
  const d = await page.evaluate(() => { const H = window.HOLDOR; return { def: !!H.TOWERS.rook, name: H.TOWERS.rook.n, keys: Object.keys(H.TOWERS).length }; });
  ok('the Rookery is a tower next to the six others', d.def && d.keys === 7 && d.name === 'Rookery', JSON.stringify(d));
  await setup(10); const closed = await page.evaluate(() => window.HOLDOR.cleared() >= 13);
  await setup(13);
  const open = await page.evaluate(() => { const H = window.HOLDOR; H.showHub('coll', 'towers'); return H.cleared(); });
  await page.evaluate(() => window.HOLDOR_ARMY.showTowerRoom('rook')); await page.waitForTimeout(500);
  const room = await page.evaluate(() => ({ txt: document.querySelector('#card').innerText.slice(0, 260), svg: !!document.querySelector('.tstage svg'), tiles: document.querySelectorAll('#armStrip .htile').length }));
  ok('the tower room opens the Rookery with its drawn icon and seven tiles', /Rookery/.test(room.txt) && room.svg && room.tiles === 7, JSON.stringify(room));
  await page.screenshot({ path: SC + 'rook122_room.png' });
  // ---- in battle
  const run = (fn) => page.evaluate((src) => { const H = window.HOLDOR, G = H.G, S = window.HOLDOR_CASTLE; H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); G.gold = 5000; G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.allies.length = 0; G.projs.length = 0;
    const slot = G.map.slots[3]; H.build(slot, 'rook'); const t = slot.tower; t.cd = 0; const R0 = G.map.routes[0];
    let best = 40, bd = 1e9; for (let pr = 40; pr < R0.total - 60; pr += 8) { const p = H.posAt(G.map, pr, 0); const dd = Math.hypot(p.x - slot.x, p.y - slot.y); if (dd < bd) { bd = dd; best = pr; } }
    const mk = (type, prog) => { S.spawn(type, prog, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 9000; return e; };
    return new Function('H', 'G', 't', 'mk', 'best', 'return (' + src + ')(H,G,t,mk,best)')(H, G, t, mk, best); }, fn.toString());
  const pick = await run((H, G, t, mk, best) => { const sword = mk('sword', best + 30); const necro = mk('necro', best - 10); H.step(); const p = G.projs.find(p => p.src === 'rook'); return { necro: !!p && p.tgt === necro, sword: !!p && p.tgt === sword }; });
  ok('with a sword closer to the gate and a necromancer behind it, the raven goes for the necromancer', pick.necro && !pick.sword, JSON.stringify(pick));
  const fly = await run((H, G, t, mk, best) => { const fk = 'bat'; const sword = mk('sword', best + 30); const bat = mk(fk, best - 5); H.step(); const p = G.projs.find(p => p.src === 'rook'); return { fk, bat: !!p && p.tgt === bat }; });
  ok('a bird is its next choice', fly.bat, JSON.stringify(fly));
  const sil = await run((H, G, t, mk, best) => { const necro = mk('necro', best - 10); H.step(); for (let i = 0; i < 120 && !(necro.silT > G.time); i++) H.step(); return { silenced: necro.silT > G.time, left: Math.round((necro.silT - G.time) * 10) / 10 }; });
  ok('a hit silences the necromancer for about 3 seconds', sil.silenced && sil.left > 2 && sil.left <= 3.1, JSON.stringify(sil));
  const heal = await run((H, G, t, mk, best) => { const sk = mk('skin', best - 10), a = mk('sword', best - 30); a.hp = 100; sk.silT = G.time + 5; t.cd = 1e9; for (let i = 0; i < 120; i++) H.step(); return { silenced: Math.round(a.hp) }; });
  ok('a silenced skinchanger does not heal', heal.silenced === 100, JSON.stringify(heal));
  const heal2 = await run((H, G, t, mk, best) => { const sk = mk('skin', best - 10), a = mk('sword', best - 30); a.hp = 100; t.cd = 1e9; for (let i = 0; i < 120; i++) H.step(); return { free: Math.round(a.hp) }; });
  ok('the same skinchanger, not silenced, does heal', heal2.free > 100, JSON.stringify(heal2));
  await run((H, G, t, mk, best) => { mk('sword', best + 20); mk('necro', best - 10); for (let i = 0; i < 30; i++) H.step(); return 1; });
  await page.waitForTimeout(400); await page.screenshot({ path: SC + 'rook122_battle.png' });
  ok('the Rookery builds and draws in a battle without errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
