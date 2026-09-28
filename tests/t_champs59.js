// v1.0.59: Martell kits — uniqueness across all 49 champions, a scripted battle per Martell champion,
// and a targeted check of every new mechanic.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CH59, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const kits = await page.evaluate(() => { const H = window.HOLDOR, K = Object.assign({}, window.HOLDOR_CH52.KITS52, window.HOLDOR_CH53.KITS53, window.HOLDOR_CH54.KITS54, window.HOLDOR_CH59.KITS59); const out = {}; for (const id in K) out[id] = window.HOLDOR_CH52.CBY[id].sk.join('+');
    const pairs = Object.values(out).map(x => x.split('+').slice(0, 2).sort().join('+')), ults = Object.values(out).map(x => x.split('+')[2]);
    const dupP = pairs.filter((p, i) => pairs.indexOf(p) !== i), dupU = ults.filter((u, i) => ults.indexOf(u) !== i);
    return { n: Object.keys(out).length, all: H.SK && Object.keys(window.HOLDOR_CH52.CBY).length, dupP, dupU, missing: Object.values(out).flatMap(x => x.split('+')).filter(k => !H.SK[k] || !H.SK[k].d || H.SK[k].v.length !== 5),
      notUlt: Object.values(out).map(x => x.split('+')[2]).filter(k => !H.SK[k].ult), ultAsSkill: Object.values(out).flatMap(x => x.split('+').slice(0, 2)).filter(k => H.SK[k].ult) }; });
  ok('49 kits unique', kits.n === 49 && kits.all === 49 && !kits.dupP.length && !kits.dupU.length && !kits.missing.length && !kits.notUlt.length && !kits.ultAsSkill.length, JSON.stringify(kits));
  const ids = ['areo', 'nymeria', 'obara', 'tyene', 'doran', 'ellaria', 'oberyn'];
  for (const id of ids) {
    const s = await page.evaluate((id) => {
      const H = window.HOLDOR, G = H.G; const a = H.newAccount('martell', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 1 }; H.setAcc(a);
      H.startGame({ level: 9 }); G.waveDone = false; const R0 = G.map.routes[0];
      for (let i = 0; i < 8; i++) window.HOLDOR_CASTLE.spawn(i % 3 ? 'sword' : 'axe', R0.total - 150 - i * 14, 0);
      const h = G.hero; const p = H.posAt(G.map, G.enemies[0].prog, 0); h.x = p.x + 10; h.y = p.y; h.tx = null; h.hp = h.max * 0.4;
      for (let i = 0; i < 400 && G.state === 'play'; i++) H.step();
      h.cd.ult = 0; H.castUlt();
      for (let i = 0; i < 700 && G.state === 'play'; i++) H.step();
      return { ult: h.c.sk[2], cd: h.cd.ult > 0, kills: G.kills, state: G.state }; }, id);
    ok('play ' + id + ' (' + s.ult + ')', s.cd && s.state === 'play', JSON.stringify(s));
  }
  const M = await page.evaluate(() => {
    const H = window.HOLDOR, G = H.G, C3 = window.HOLDOR_CH53, C2 = window.HOLDOR_CH52, S = window.HOLDOR_CASTLE, X = window.HOLDOR_CH59; const out = {};
    const setup = (id) => { const a = H.newAccount('martell', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 0 }; H.setAcc(a); H.startGame({ level: 9 }); G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.allies.length = 0; return G.hero; };
    const at = (prog) => H.posAt(G.map, prog, 0);
    const sturdy = (type, prog) => { S.spawn(type, prog, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 5000; return e; };
    const stepN = (n, h) => { for (let i = 0; i < n; i++) { if (h) h.atkT = 999; H.step(); } };
    let h, e, q;
    // Sun of Dorne: a brother at half health beside Doran mends 20 a second
    h = setup('doran'); G.powerCd.reinf = 0; H.castPower('reinf'); stepN(30, h); const b = G.allies[0]; h.x = b.x + 20; h.y = b.y; h.tx = null; b.hp = b.max * 0.5; const b0 = b.hp; stepN(60, h); out.sunaura = Math.round(b.hp - b0);
    h = setup('areo'); G.powerCd.reinf = 0; H.castPower('reinf'); stepN(30, h); const c = G.allies[0]; h.x = c.x + 20; h.y = c.y; h.tx = null; c.hp = c.max * 0.5; const c0 = c.hp; stepN(60, h); out.sunaura -= Math.round(c.hp - c0);
    // Patience: 5 s still → +50%
    h = setup('doran'); e = sturdy('sword', 200); e.spdBase = 0; G.rng = () => 0.99; h.stillT = 0; C2.heroHit(e, 100); const p0 = 5000 - e.hp; e.hp = 5000; h.stillT = 5; C2.heroHit(e, 100); out.patience = Math.round(100 * (5000 - e.hp) / p0);
    // Viper's Kiss: the fourth blow deals 150 more and poisons
    h = setup('oberyn'); e = sturdy('sword', 200); e.spdBase = 0; G.rng = () => 0.99; const dd = []; for (let i = 0; i < 4; i++) { const hp0 = e.hp; C2.heroHit(e, 10); dd.push(Math.round(hp0 - e.hp)); } out.viper = { dd, poison: !!e.poison };
    // I Serve: 40% less damage on top of Iron Skin, no block limit
    h = setup('areo'); h.cd.ult = 0; H.castUlt(); h.hp = h.max; h.invulnUntil = 0; h.shield = 0; C3.hurtHero(100); out.iserve = { lost: Math.round(h.max - h.hp), on: h.iserveUntil > G.time };
    // The Whip: the 4 strongest within 200 px bound 3 s and dragged 60 px
    h = setup('nymeria'); const ws = []; for (let i = 0; i < 5; i++) { const x = sturdy('sword', 300 + i * 6); x.hp = 1000 + i * 100; ws.push(x); } q = at(300); h.x = q.x + 40; h.y = q.y; h.tx = null; const pr = ws.map(x => x.prog); h.cd.ult = 0; H.castUlt();
    out.whip = ws.map((x, i) => [Math.round(x.stunT * 10) / 10, Math.round(pr[i] - x.prog)]);
    // Spears of Dorne: the 5 closest to the gate take 540, pinned 1 s
    h = setup('obara'); const sp = []; for (let i = 0; i < 7; i++) sp.push(sturdy('sword', 100 + i * 40)); h.cd.ult = 0; H.castUlt(); out.spears = sp.map(x => Math.round(5000 - x.hp));
    // Serpent's Kiss: poisoned 55/s and cannot strike
    h = setup('tyene'); e = sturdy('sword', 300); e.spdBase = 0; q = at(300); h.x = q.x + 30; h.y = q.y; h.tx = null; h.cd.ult = 0; H.castUlt(); stepN(1, h); out.kiss = { dps: e.poison && e.poison.dps, weak: e.weak, dis: Math.round((e.disarmT - G.time) * 10) / 10 };
    // Vengeance and Justice: the door is spared, then every enemy takes 1.5× the spared damage
    h = setup('doran'); e = sturdy('sword', 100); e.spdBase = 0; const door0 = G.doorHp; h.cd.ult = 0; H.castUlt(); X.hitDoor(100, 0); X.hitDoor(100, 0); const door1 = G.doorHp; const eh = e.hp; stepN(60 * 11, h); out.veng = { spared: door0 === door1, took: Math.round(eh - e.hp) };
    // The Red Viper: 8 blows at 150% on the strongest within 200 px
    h = setup('oberyn'); e = sturdy('sword', 300); e.spdBase = 0; q = at(300); h.x = q.x + 60; h.y = q.y; h.tx = null; const hd = h.dmg; h.cd.ult = 0; H.castUlt(); out.redviper = { took: Math.round(5000 - e.hp), expect: Math.round(8 * 1.5 * hd), poison: !!e.poison, near: Math.round(Math.hypot(h.x - q.x, h.y - q.y)) };
    return out; });
  ok('sun of dorne +20/s', Math.abs(M.sunaura - 20) <= 2, JSON.stringify(M.sunaura));
  ok('patience +50%', M.patience === 150, JSON.stringify(M.patience));
  ok("viper's kiss 4th blow", M.viper.dd[0] === M.viper.dd[1] && M.viper.dd[3] - M.viper.dd[0] >= 150 && M.viper.poison, JSON.stringify(M.viper));
  ok('i serve −40%', M.iserve.on && M.iserve.lost === Math.round(100 * 0.65 * 0.6), JSON.stringify(M.iserve));
  ok('the whip: 4 of 5 bound + dragged', M.whip.filter(x => x[0] >= 2.9 && x[1] === 60).length === 4, JSON.stringify(M.whip));
  ok('spears of dorne: 5 of 7', M.spears.filter(x => x >= 540).length === 5 && M.spears.slice(0, 2).every(x => x === 0), JSON.stringify(M.spears));
  ok("serpent's kiss", M.kiss.dps === 55 && M.kiss.weak === 0 && M.kiss.dis > 3.5, JSON.stringify(M.kiss));
  ok('vengeance', M.veng.spared && M.veng.took >= 300, JSON.stringify(M.veng));
  ok('red viper', M.redviper.took >= M.redviper.expect && M.redviper.poison && M.redviper.near <= 20, JSON.stringify(M.redviper));
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('martell', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 50; i++) a.campaign[i] = 3; a.sel = 'oberyn'; H.setAcc(a); window.HOLDOR_GEN.showHeroRoom('oberyn'); });
  await page.waitForTimeout(400);
  const hr = await page.evaluate(() => document.querySelector('#card').innerText);
  ok('hero room oberyn', /Red Viper/.test(hr) && /Viper's Kiss/.test(hr), hr.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch59_oberyn.png' });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
