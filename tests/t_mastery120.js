// v1.2.0: Mastery — after a tower's last level two paths bought with gold (a guest seat, real taps in the tower room), and what the steps do in battle.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_MST && window.HOLDOR_ARMY, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const tap = async (sel) => { await page.locator(sel).first().tap({ force: true }); await page.waitForTimeout(300); };
  const setup = (o) => page.evaluate((o) => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = { win: 1, battle: 1, coll: 1, shop: 1, hold: 1, events: 1 };
    const L = window.HOLDOR_TUT.LESSONS; a.learn = {}; (Array.isArray(L) ? L.map(l => l.id || l.k) : Object.keys(L)).forEach(k => a.learn[k] = 1);
    for (let i = 1; i <= o.stages; i++) a.campaign[i] = 3; a.gold = o.gold; a.tlv = { watch: o.lvl, scorp: o.lvl }; a.mst = o.mst || {}; a.sel = 'robb'; H.setAcc(a); H.persist(); window.HOLDOR_ARMY.showTowerRoom('watch'); }, o);
  const txt = () => page.evaluate(() => document.querySelector('#card').innerText);
  const st = (k) => page.evaluate((k) => window.HOLDOR_MST.mstState(k), k);
  const gold = () => page.evaluate(() => window.HOLDOR.ACC.gold);
  // ---- locked: level 15 → "opens at the last level"; level 16 with 20 stages → "opens after 30 stages"
  await setup({ stages: 40, gold: 200000, lvl: 15 }); await page.waitForTimeout(400);
  ok('below the last level a locked Mastery line says so', /MASTERY/.test(await txt()) && /opens at the last level/.test(await txt()) && !(await page.$('[data-mb]')));
  await setup({ stages: 20, gold: 200000, lvl: 16 }); await page.waitForTimeout(400);
  ok('at the last level but under 30 stages: opens after 30 stages', /opens after 30 stages \(you have 20\)/.test(await txt()) && !(await page.$('[data-mb]')));
  // ---- open: two paths, buy steps by tapping
  await setup({ stages: 40, gold: 200000, lvl: 16 }); await page.waitForTimeout(400);
  const paths = await page.evaluate(() => ({ n: document.querySelectorAll('.mpath').length, btns: [...document.querySelectorAll('[data-mb]')].map(b => b.dataset.mb + ':' + b.textContent.replace(/\s+/g, ' ')) }));
  ok('two paths with a big button each', paths.n === 2 && paths.btns.length === 2 && /CHOOSE VOLLEY/.test(paths.btns[0]) && /20k/.test(paths.btns[0]), JSON.stringify(paths));
  await page.screenshot({ path: SC + 'mst120_room.png' });
  await tap('[data-mb="a"]');
  ok('step 1 of path A: 20 000 gold, state a/1', (await gold()) === 180000 && JSON.stringify(await st('watch')) === '{"p":"a","s":1}', (await gold()) + ' ' + JSON.stringify(await st('watch')));
  ok('the other path dims; its button is gone', await page.evaluate(() => !!document.querySelector('.mpath.off') && !document.querySelector('[data-mb="b"]')));
  await tap('[data-mb="a"]'); await tap('[data-mb="a"]');
  ok('steps 2 and 3: 40 000 + 80 000, mastered', (await gold()) === 60000 && (await st('watch')).s === 3 && /MASTERED/.test(await txt()), (await gold()) + ' ' + JSON.stringify(await st('watch')));
  await page.screenshot({ path: SC + 'mst120_done.png' });
  // ---- switching: two taps, 10 000, back to none
  await tap('[data-mreset]'); ok('the first tap on Switch only asks', (await st('watch')).s === 3 && /Tap again/.test(await txt()));
  await tap('[data-mreset]'); ok('the second tap pays 10 000 and resets', (await gold()) === 50000 && (await st('watch')).p === null);
  // ---- not enough gold
  await page.evaluate(() => { window.HOLDOR.ACC.gold = 5000; window.HOLDOR_ARMY.showTowerRoom('watch'); }); await page.waitForTimeout(300);
  await tap('[data-mb="b"]');
  ok('with too little gold nothing is bought', (await gold()) === 5000 && (await st('watch')).p === null && /Need 15k more/.test(await txt()));
  // ---- in battle: what the steps do
  const battle = async (tower, enc, n, fn) => page.evaluate(([tower, enc, n, fnsrc]) => { const H = window.HOLDOR, G = H.G, S = window.HOLDOR_CASTLE; const a = H.ACC; a.tlv = { watch: 16, scorp: 16 }; a.mst = {}; a.mst[tower] = enc;
    H.startGame({ mode: 'campaign', level: H.stageLevel(1, 3) }); G.gold = 5000; G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.allies.length = 0; G.projs.length = 0;
    const slot = G.map.slots[3]; H.build(slot, tower); const t = slot.tower; t.cd = 0; const R0 = G.map.routes[0];
    // enemies on the road next to the tower
    let best = null, bd = 1e9; for (let pr = 40; pr < R0.total - 60; pr += 8) { const p = H.posAt(G.map, pr, 0); const d = Math.hypot(p.x - slot.x, p.y - slot.y); if (d < bd) { bd = d; best = pr; } }
    const E = []; for (let i = 0; i < n; i++) { S.spawn('sword', best + i * 14, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 9000; E.push(e); }
    return new Function('H', 'G', 't', 'E', 'return (' + fnsrc + ')(H,G,t,E)')(H, G, t, E); }, [tower, enc, n, fn.toString()]);
  const shots = await battle('watch', 2, 4, (H, G, t, E) => { H.step(); return G.projs.filter(p => p.src === 'watch').length; });
  ok('Watchtower Volley step 2: one shot sends 3 arrows (1 + 2 extra)', shots === 3, shots);
  const crit = await battle('watch', 13, 1, (H, G, t, E) => { G.rng = () => 0; H.step(); const p = G.projs.find(p => p.src === 'watch'); return { crit: !!(p && p.crit), mul: p ? p.dmg / H.TOWERS.watch.dmg : 0 }; });
  ok('Watchtower Marksman step 3: a critical shot deals more than double', crit.crit && crit.mul > 2.2, JSON.stringify(crit));
  const pierce = await battle('scorp', 2, 4, (H, G, t, E) => { G.rng = () => 0.5; H.step(); for (let i = 0; i < 240 && G.projs.length; i++) H.step(); return E.map(e => Math.round(e.max - e.hp)); });
  ok('Scorpion Piercing bolt step 2: the bolt also hurts two enemies behind the first', pierce.filter(x => x > 0).length >= 3, JSON.stringify(pierce));
  const chill = await battle('scorp', 12, 1, (H, G, t, E) => { H.step(); for (let i = 0; i < 240 && G.projs.length; i++) H.step(); return { chill: E[0].chillT > G.time - 0.05 || E[0].chillT > 0, v: E[0].chillV }; });
  ok('Scorpion Dragonbane step 2: a hit chills 30 %', chill.chill && chill.v === 30, JSON.stringify(chill));
  const plain = await battle('watch', 0, 4, (H, G, t, E) => { H.step(); return G.projs.filter(p => p.src === 'watch').length; });
  ok('without Mastery a Watchtower still fires one arrow', plain === 1, plain);
  ok('no page errors', !errors.length, errors.join(' | '));
  console.log(JSON.stringify(R, null, 1)); console.log('ERR', JSON.stringify(errors));
  await browser.close(); process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
