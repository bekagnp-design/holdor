// v1.0.45 regression: migration, progression caps, workshop, armory, 50-stage flow, NEXT, Easy→Hard, Brothers, daily map, all maps build.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
const ok = (c, m) => { if (!c) { FAILS.push(m); } };
const FAILS = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join('|')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR_GEN, { timeout: 20000 });
  await page.waitForTimeout(500);
  const R = {};
  // 1. migration of a v1.0.44 save
  R.migr = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_GEN; const a = H.newAccount('stark', 0, 'squire'); delete a.cv; delete a.pv; delete a.tlv; delete a.hard;
    a.campaign = { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3, 6: 2, 7: 1 }; a.stg = { 1: { 2: 3, 3: 1 } }; a.champs = { jon: { lvl: 10, sk: [3, 3, 2], tal: 1 }, arya: { lvl: 3, sk: [2, 1, 1], tal: 0 } };
    a.upg = { keen: 1, shafts: 1, draw: 1, bolts: 1, leather: 1, horse: 1 }; a.gold = 1000; a.diff = 'kingsguard'; X.migrate45(a);
    return { cleared: Object.keys(a.campaign).length, c21: a.campaign[21], c19: a.campaign[19], jon: a.champs.jon, arya: a.champs.arya, upg: Object.keys(a.upg).sort().join(','), gold: a.gold, refund: a.refund, diff: a.diff, stg: a.stg === undefined, cv: a.cv, pv: a.pv }; });
  ok(R.migr.cleared === 21 && R.migr.c21 === 1 && R.migr.jon.lvl === 19 && R.migr.jon.sk.join() === '5,5,3' && R.migr.arya.lvl === 5 && R.migr.upg === 'horse,leather' && R.migr.refund === 1500 && R.migr.gold === 2500 && R.migr.diff === 'squire' && R.migr.stg, 'migration ' + JSON.stringify(R.migr));
  // 2. progression caps
  R.prog = await page.evaluate(async () => { const H = window.HOLDOR, X = window.HOLDOR_GEN; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.copen = { jon: 1 }; a.sel = 'jon'; for (let i = 1; i <= 20; i++) a.campaign[i] = 3; a.gold = 200000; a.cards = { 'c:jon': 99999, 't:watch': 99999 }; H.setAcc(a); H.persist();
    X.showHeroRoom('jon'); const click = async (sel) => { const b = document.querySelector(sel); if (b && !b.disabled) b.click(); await new Promise(r => setTimeout(r, 20)); };
    for (let i = 0; i < 30; i++) await click('#clist button[data-a="lvl"]');
    const lvl = H.cprog(null, 'jon').lvl; const p = H.cprog(null, 'jon'); p.lvl = 5; H.persist(); X.showHeroRoom('jon');
    for (let i = 0; i < 6; i++) await click('#clist button[data-a="sk"][data-i="0"]');
    const skAt5 = p.sk[0]; p.lvl = 20; X.showHeroRoom('jon'); for (let i = 0; i < 6; i++) await click('#clist button[data-a="sk"][data-i="0"]');
    const talBtn = !!document.querySelector('#clist button[data-a="tal"]');
    X.showTowerRoom('watch'); for (let i = 0; i < 20; i++) await click('#clist button[data-a="tl"]');
    const tl = X.tLvl('watch'); const st16 = X.towerStats({ type: 'watch', lvl: 1 }, 16), st1 = X.towerStats({ type: 'watch', lvl: 1 }, 1), st4 = X.towerStats({ type: 'watch', lvl: 1 }, 4), st3 = X.towerStats({ type: 'watch', lvl: 1 }, 3);
    X.showUpgrades(); const armoryHasTower = !!document.querySelector('.ug[data-u="keen"]'); document.querySelector('.ug[data-u="leather"]').click(); await new Promise(r => setTimeout(r, 30)); document.querySelector('#bBuy').click(); await new Promise(r => setTimeout(r, 30));
    return { lvl, skAt5, sk20: p.sk[0], talBtn, tl, dmg1: st1.dmg, dmg16: Math.round(st16.dmg * 100) / 100, range3: st3.range, range4: st4.range, armoryHasTower, leather: !!H.ACC.upg.leather }; });
  ok(R.prog.lvl === 20 && R.prog.skAt5 === 2 && R.prog.sk20 === 5 && R.prog.talBtn && R.prog.tl === 16 && R.prog.range4 > R.prog.range3 * 1.07 && !R.prog.armoryHasTower && R.prog.leather, 'progression ' + JSON.stringify(R.prog));
  ok(Math.abs(R.prog.dmg16 / R.prog.dmg1 - 1.45 * 1.08) < 0.02, 'tower lvl16 dmg ' + (R.prog.dmg16 / R.prog.dmg1));
  // 3. world map, NEXT, stage flow
  R.flow = await page.evaluate(async () => { const H = window.HOLDOR, X = window.HOLDOR_GEN; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.copen = { jon: 1 }; a.sel = 'jon'; for (let i = 1; i <= 9; i++) a.campaign[i] = 2; a.gold = 5000; H.setAcc(a); H.persist();
    X.showCampaign(); await new Promise(r => setTimeout(r, 300)); const pins = document.querySelectorAll('.mn').length, open = document.querySelectorAll('.mn.open').length; const sel = document.querySelector('#playcard h2').textContent;
    document.querySelector('.mn.open[data-l="4"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); const sel4 = document.querySelector('#playcard h2').textContent;
    document.querySelector('#bGo').click(); await new Promise(r => setTimeout(r, 200)); const G = H.G; const lv = G.level.id;
    G.wave = G.totalWaves; G.waveDone = true; G.spawnQueue = []; G.enemies = []; for (let i = 0; i < 5 && G.state === 'play'; i++) H.step(); await new Promise(r => setTimeout(r, 200));
    const nx = document.querySelector('#bNext'); const nxText = nx && nx.textContent; nx.click(); await new Promise(r => setTimeout(r, 300));
    return { pins, open, sel, sel4, lv, nxText, nextLevel: H.G.level.id, state: H.G.state, hardBtn: !!document.querySelector('#bDiff') }; });
  ok(R.flow.pins === 50 && R.flow.open === 10 && R.flow.sel === 'Uplands' && R.flow.sel4 === 'The Boneway' && R.flow.lv === 4 && /NEXT/.test(R.flow.nxText) && R.flow.nextLevel === 5 && R.flow.state === 'play', 'flow ' + JSON.stringify(R.flow));
  await page.evaluate(() => { const G = window.HOLDOR.G; G.state = 'menu'; window.HOLDOR_GEN.showCampaign(); });
  await page.waitForTimeout(500); await page.screenshot({ path: SC + 't45_map.png' });
  // 4. Easy → Hard
  R.hard = await page.evaluate(async () => { const H = window.HOLDOR, X = window.HOLDOR_GEN; const a = H.ACC; const before = X.hardOpen(); for (let i = 1; i <= 49; i++) a.campaign[i] = 2;
    H.startGame({ mode: 'campaign', level: H.LEVELS[49] }); const G = H.G; G.wave = G.totalWaves; G.waveDone = true; G.spawnQueue = []; G.enemies = []; for (let i = 0; i < 5 && G.state === 'play'; i++) H.step(); await new Promise(r => setTimeout(r, 200));
    const after = X.hardOpen(), hardMsg = !!document.querySelector('#bHard'); document.querySelector('#bHard').click(); await new Promise(r => setTimeout(r, 300));
    const diff = a.diff, open2 = X.levelOpen(null, H.LEVELS[1]); H.startGame({ mode: 'campaign', level: H.LEVELS[0] }); G.wave = G.totalWaves; G.waveDone = true; G.spawnQueue = []; G.enemies = []; for (let i = 0; i < 5 && G.state === 'play'; i++) H.step(); await new Promise(r => setTimeout(r, 200));
    return { before, after, hardMsg, diff, open2, hard1: a.hard[1], easy1: a.campaign[1], mult: G.mult }; });
  ok(!R.hard.before && R.hard.after && R.hard.hardMsg && R.hard.diff === 'kingsguard' && R.hard.open2 === false && R.hard.hard1 >= 1 && R.hard.easy1 === 2, 'hard ' + JSON.stringify(R.hard));
  // 5. Brothers march to the road and fight
  R.bro = await page.evaluate(async () => { const H = window.HOLDOR, X = window.HOLDOR_GEN; const a = H.ACC; a.diff = 'squire'; H.G.state = 'menu';
    H.startGame({ mode: 'campaign', level: H.LEVELS[11] }); const G = H.G; G.doorMax = G.doorHp = 1e6; G.hero.dead = true; G.hero.respawnT = 1e9; H.callWave();
    let n = 0; while (n < 60 * 90) { H.step(); n++; if (G.enemies.filter(e => !e.fly && G.map.routes[e.route || 0].total - e.prog < 240).length >= 2) break; }
    H.castPower('reinf'); const k0 = G.kills; let minD = 1e9;
    for (let i = 0; i < 60 * 8; i++) { H.step(); for (const b of G.allies.filter(x => x.kind === 'brother')) { const d = X.dist(b.x, b.y, b.rx, b.ry); } }
    const bros = G.allies.filter(x => x.kind === 'brother'); const offRoad = bros.map(b => { let m = 1e9; for (const R of G.map.routes) for (let d = 0; d < R.total; d += 6) { const p = X.posAt(G.map, d, R.i); m = Math.min(m, X.dist(p.x, p.y, b.x, b.y)); } return Math.round(m); });
    return { n: bros.length, offRoad, kills: G.kills - k0, hurt: bros.some(b => b.hp < b.max) }; });
  ok(R.bro.n >= 1 && R.bro.offRoad.every(d => d < 26) && R.bro.kills > 0, 'brothers ' + JSON.stringify(R.bro));
  // 6. daily Hold map stays on screen, uses the neutral multiplier
  R.hold = await page.evaluate(async () => { const H = window.HOLDOR; const a = H.ACC; a.online.attempts = 3; H.G.state = 'menu'; H.startGame({ mode: 'online' }); const G = H.G; const pts = G.map.routes[0].pts; const maxY = Math.max(...pts.map(p => p.y)); const r = { maxY: Math.round(maxY), mult: G.mult, door: G.doorMax, slots: G.map.slots.length }; G.state = 'menu'; return r; });
  ok(R.hold.maxY <= 628 && R.hold.mult === 1 && R.hold.slots >= 12, 'hold ' + JSON.stringify(R.hold));
  // 7. every stage builds, has spots and a road inside the screen
  R.maps = await page.evaluate(() => { const H = window.HOLDOR, X = window.HOLDOR_GEN; const bad = []; for (const L of H.LEVELS) { const m = X.buildMap({ routes: L.routes, gates: L.gates, raw: true, style: L.style, sea: L.sea, seaW: L.seaW, river: L.river, ponds: L.ponds, seed: X.hash32('L' + L.id), biome: L.biome });
      const outside = m.routes.some(R => R.pts.some(p => p.y > 629 || (p.y > 0 && (p.x < 10 || p.x > 380)))); if (m.slots.length < 12 || outside) bad.push(L.id + ':' + m.slots.length + (outside ? ' out' : '')); } return bad; });
  ok(R.maps.length === 0, 'maps ' + R.maps.join(' '));
  // 8. cloud score summary counts hard stars
  R.score = await page.evaluate(() => { const H = window.HOLDOR; return H.scoreSummary ? H.scoreSummary() : null; });
  console.log(JSON.stringify(R, null, 1));
  console.log(FAILS.length ? 'FAILS:\n' + FAILS.join('\n') : 'ALL PASS');
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
