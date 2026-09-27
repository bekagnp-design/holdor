// v1.0.53: Lannister + Baratheon kits — uniqueness across all 28 redone champions, a scripted battle per champion,
// and a targeted check of every new mechanic.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CH53, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  // uniqueness across the 28 redone kits
  const kits = await page.evaluate(() => { const H = window.HOLDOR, K = Object.assign({}, window.HOLDOR_CH52.KITS52, window.HOLDOR_CH53.KITS53); const out = {}; for (const id in K) out[id] = window.HOLDOR_CH52.CBY[id].sk.join('+');
    const pairs = Object.values(out).map(x => x.split('+').slice(0, 2).sort().join('+')), ults = Object.values(out).map(x => x.split('+')[2]);
    const dupP = pairs.filter((p, i) => pairs.indexOf(p) !== i), dupU = ults.filter((u, i) => ults.indexOf(u) !== i);
    return { n: Object.keys(out).length, dupP, dupU, missing: Object.values(out).flatMap(x => x.split('+')).filter(k => !H.SK[k] || !H.SK[k].d || H.SK[k].v.length !== 5) }; });
  ok('28 kits unique', kits.n === 28 && !kits.dupP.length && !kits.dupU.length && !kits.missing.length, JSON.stringify(kits));
  // one scripted battle per champion: skills at rank 5, then the ultimate
  const play = (house, id) => page.evaluate(([house, id]) => {
    const H = window.HOLDOR, G = H.G; const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 1 }; H.setAcc(a);
    H.startGame({ level: 9 }); G.waveDone = false; const R0 = G.map.routes[0];
    for (let i = 0; i < 8; i++) window.HOLDOR_CASTLE.spawn(i % 3 ? 'sword' : 'axe', R0.total - 150 - i * 14, 0);
    const h = G.hero; const p = H.posAt(G.map, G.enemies[0].prog, 0); h.x = p.x + 10; h.y = p.y; h.tx = null; h.hp = h.max * 0.4;
    const g0 = G.gold;
    for (let i = 0; i < 400 && G.state === 'play'; i++) H.step();
    h.cd.ult = 0; H.castUlt();
    for (let i = 0; i < 60 && G.state === 'play'; i++) H.step();
    return { ult: h.c.sk[2], cd: h.cd.ult > 0, kills: G.kills, gold: G.gold - g0, frenzy: h.frenzyUntil > G.time, fury: h.furyUntil > G.time, dg: G.dgUntil > G.time, allies: G.allies.length, state: G.state }; }, [house, id]);
  const ids = { lannister: ['kevan', 'bronn', 'gregor', 'tywin', 'jaime', 'cersei', 'tyrion'], baratheon: ['gendry', 'barristan', 'davos', 'renly', 'melisandre', 'robert', 'stannis'] };
  const res = {}; for (const house in ids) for (const id of ids[house]) res[id] = await play(house, id);
  for (const id in res) { const s = res[id]; const extra = id === 'bronn' ? s.frenzy : id === 'robert' ? s.fury : id === 'gendry' ? s.dg : id === 'kevan' ? s.allies >= 4 : true; ok('play ' + id + ' (' + s.ult + ')', s.cd && s.state === 'play' && extra, JSON.stringify(s)); }
  // targeted checks
  const M = await page.evaluate(() => {
    const H = window.HOLDOR, G = H.G, C = window.HOLDOR_CH53, S = window.HOLDOR_CASTLE; const out = {};
    const setup = (house, id) => { const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 0 }; H.setAcc(a); H.startGame({ level: 9 }); G.waveDone = false; G.rng = Math.random; return G.hero; };
    const at = (prog, route) => H.posAt(G.map, prog, route || 0);
    let h, e, e2;
    // Iron Skin: 35% less
    h = setup('lannister', 'gregor'); h.invulnUntil = 0; let hp0 = h.hp; C.hurtHero(100); out.ironskin = Math.round(hp0 - h.hp);
    // Parry: forced success and forced failure
    h = setup('lannister', 'jaime'); S.spawn('sword', 300, 0); e = G.enemies[0]; G.rng = () => 0.01; let eh = e.hp; const par = C.heroParry(e); out.parry = { ok: par, riposte: Math.round((eh - e.hp) * 10) / 10, expect: Math.round(h.dmg * 0.8 * 10) / 10 }; G.rng = () => 0.99; out.parry.miss = C.heroParry(e);
    // Tribute: +25 every 10 s
    h = setup('lannister', 'tywin'); h.skT.tribute = 0.01; let g0 = G.gold; H.step(); out.tribute = G.gold - g0;
    // Contempt: wights next to Cersei hit 40% softer
    h = setup('lannister', 'cersei'); S.spawn('sword', 300, 0); e = G.enemies[0]; let q = at(e.prog); h.x = q.x + 20; h.y = q.y; H.step(); out.contempt = e.weak;
    // Hand of the King: −15% on build and upgrade
    h = setup('lannister', 'tyrion'); out.hand = { build: C.costOf('watch'), up: C.upCost({ type: 'watch', lvl: 1 }), mul: C.handMul() };
    // Forged Steel: +26% damage from towers within 90 px
    const towerShot = (house, id, near, prog) => { h = setup(house, id); const slot = G.map.slots[0]; slot.tower = { type: 'watch', lvl: 1, cd: 0, invested: 70, face: 0 };
      S.spawn('axe', prog, 0); e = G.enemies[0]; if (near) { h.x = slot.x + 30; h.y = slot.y; } else { h.x = slot.x + 200; h.y = Math.min(slot.y + 200, 600); } h.tx = null; G.projs = []; H.step(); const pr = G.projs.filter(p => p.src === 'watch'); return { n: pr.length, dmg: pr[0] ? Math.round(pr[0].dmg * 100) / 100 : null, base: Math.round(C.towerStats(slot.tower).dmg * 100) / 100 }; };
    // a road point inside the watchtower's reach from slot 0
    const slot0 = () => G.map.slots[0];
    h = setup('baratheon', 'gendry'); const s0 = slot0(); let inRange = null, band = null; const Rr = G.map.routes[0]; const r0 = C.towerStats({ type: 'watch', lvl: 1 }).range;
    for (let d = 20; d < Rr.total - 30; d += 2) { const pp = at(d); const dd = Math.hypot(pp.x - s0.x, pp.y - s0.y); if (inRange == null && dd < 90) inRange = d; if (band == null && dd > r0 + 7 + 2 && dd < r0 * 1.16 + 7 - 2) band = d; }
    out.forge = { near: towerShot('baratheon', 'gendry', true, inRange), far: towerShot('baratheon', 'gendry', false, inRange) };
    // Siegecraft: +16% reach — a wight just outside the base range is shot only with Stannis beside the tower
    out.siege = { band, r0, near: band != null ? towerShot('baratheon', 'stannis', true, band).n : null, far: band != null ? towerShot('baratheon', 'stannis', false, band).n : null };
    // Duelist: ×2 against a giant
    h = setup('baratheon', 'barristan'); S.spawn('giant', 300, 0); e = G.enemies[0]; G.rng = () => 0.99; eh = e.hp; C.heroHit ? null : null; window.HOLDOR_CH52.heroHit(e, 10); out.duelist = Math.round((eh - e.hp) * 10) / 10;
    // Rations: the champion and a brother near him +130
    h = setup('baratheon', 'davos'); G.powerCd.reinf = 0; H.castPower('reinf'); const al = G.allies[0]; al.x = h.x + 20; al.y = h.y; al.bornT = null; al.hp = 50; h.hp = h.max - 200; const hh0 = h.hp; h.skT.rations = 0.01; H.step(); out.rations = { hero: Math.round(h.hp - hh0), ally: Math.round(al.hp - 50) };
    // Charm: a hit turns the wight around
    h = setup('baratheon', 'renly'); S.spawn('sword', 400, 0); e = G.enemies[0]; G.rng = () => 0.01; window.HOLDOR_CH52.heroHit(e, 1); const pr0 = e.prog; for (let i = 0; i < 15; i++) H.step(); out.charm = { charmed: e.charmT > G.time, back: Math.round(pr0 - e.prog) };
    // Blood Magic: a death near Melisandre mends the door by 13
    h = setup('baratheon', 'melisandre'); S.spawn('axe', 300, 0); e = G.enemies[0]; q = at(e.prog); h.x = q.x + 30; h.y = q.y; G.doorHp = G.doorMax - 100; const d0 = G.doorHp; e.hp = 1; C.dmg(e, 5, 'watch'); out.bloodmagic = Math.round(G.doorHp - d0);
    // Warhammer: the wight beside the target takes 80%
    h = setup('baratheon', 'robert'); S.spawn('sword', 300, 0); S.spawn('sword', 302, 0); e = G.enemies[0]; e2 = G.enemies[1]; G.rng = () => 0.99; const e2h = e2.hp; window.HOLDOR_CH52.heroHit(e, 10); out.warhammer = Math.round((e2h - e2.hp) * 10) / 10;
    // Two for One: half the reload, one more target
    h = setup('lannister', 'bronn'); for (let i = 0; i < 6; i++) S.spawn('sword', 300 + i * 3, 0); q = at(300); h.x = q.x + 30; h.y = q.y; h.cd.ult = 0; H.castUlt(); h.atkT = 0; G.projs = []; H.step(); out.twoforone = { frenzy: h.frenzyUntil > G.time, projs: G.projs.filter(p => p.src === 'hero').length, atk: Math.round(h.atkT / h.rate * 100) / 100 };
    // Kingslayer: 2000 into a boss
    h = setup('lannister', 'jaime'); S.spawn('sword', 300, 0); S.spawn('lord', 200, 0); const lord = G.enemies.find(x => x.type === 'lord'); const lh = lord.hp; h.cd.ult = 0; H.castUlt(); out.kingslayer = { hit: Math.round(lh - lord.hp), boss: true, lh: Math.round(lh) };
    // Dragonglass Blades: thaw + full damage through ice
    h = setup('baratheon', 'gendry'); const sl = G.map.slots[0]; sl.tower = { type: 'watch', lvl: 1, cd: 0, invested: 70, face: 0, frozen: G.time + 10 }; S.spawn('walker', 300, 0); e = G.enemies[0]; e.hp = e.max = 5000; eh = e.hp; C.dmg(e, 100, 'watch'); const before = Math.round(eh - e.hp); h.cd.ult = 0; H.castUlt(); eh = e.hp; C.dmg(e, 100, 'watch'); out.dg = { before, after: Math.round(eh - e.hp), thawed: sl.tower.frozen === 0 };
    // The Bold: leaps to the wight nearest the gate
    h = setup('baratheon', 'barristan'); const Rt = G.map.routes[0]; S.spawn('sword', Rt.total - 70, 0); S.spawn('sword', 150, 0); const g = G.enemies[0]; const gp = H.posAt(G.map, g.prog, 0); h.x = 60; h.y = 200; h.cd.ult = 0; const gh = g.hp; H.castUlt(); out.bold = { dist: Math.round(Math.hypot(h.x - gp.x, h.y - gp.y)), hit: Math.round(gh - Math.max(0, g.hp)) };
    // Lord of Light: 35% of current health, bosses half
    h = setup('baratheon', 'melisandre'); S.spawn('sword', 300, 0); S.spawn('lord', 200, 0); const sw = G.enemies[0], lo = G.enemies[1]; const swh = sw.hp, loh = lo.hp; h.cd.ult = 0; H.castUlt(); out.lol = { sword: Math.round((1 - sw.hp / swh) * 1000) / 10, lord: Math.round((1 - lo.hp / loh) * 1000) / 10 };
    // Ours Is the Fury: every blow lands on all wights within 55 px
    h = setup('baratheon', 'robert'); for (let i = 0; i < 3; i++) S.spawn('sword', 300 + i * 6, 0); const fe = G.enemies.slice(); for (const x of fe) x.hp = x.max = 5000; q = at(306); h.x = q.x + 8; h.y = q.y; h.tx = null; h.cd.ult = 0; H.castUlt(); G.rng = () => 0.99; h.atkT = 0; H.step(); out.fury = { fury: h.furyUntil > G.time, hurt: fe.filter(x => x.hp < 5000).length, atk: Math.round(h.atkT / h.rate * 100) / 100 };
    // Horns at Dawn: everything on the busiest road hit and thrown back
    h = setup('baratheon', 'stannis'); for (let i = 0; i < 4; i++) S.spawn('sword', 400 + i * 40, 0); for (const x of G.enemies) x.hp = x.max = 5000; const ps = G.enemies.map(x => x.prog), hsd = G.enemies.map(x => x.hp); h.cd.ult = 0; H.castUlt(); out.dawn = { hit: G.enemies.filter((x, i) => x.hp < hsd[i]).length, back: G.enemies.map((x, i) => Math.round(ps[i] - x.prog)) };
    // Discipline: a sturdy wight walks into the brothers; each blow on a brother is 35% softer when Kevan stands within 90 px
    h = setup('lannister', 'kevan'); G.powerCd.reinf = 0; H.castPower('reinf'); for (let i = 0; i < 40; i++) H.step();
    const R0 = G.map.routes[0]; S.spawn('sword', R0.total - 110, 0); e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 50000;
    const b0 = G.allies.find(a => a.kind === 'brother'); h.x = b0.x + 55; h.y = b0.y - 25; h.tx = null;
    const hp = new Map(G.allies.map(a => [a, a.hp])); const blows = [];
    for (let i = 0; i < 240 && blows.length < 3; i++) { H.step(); for (const a of G.allies) { const p0 = hp.get(a); if (p0 != null && a.hp < p0 - 0.01) { blows.push({ d: Math.round(Math.hypot(a.x - h.x, a.y - h.y)), hit: Math.round((p0 - a.hp) * 100) / 100 }); } hp.set(a, a.hp); } }
    out.discipline = { blows, soft: Math.round(e.dps * 0.7 * 0.65 * 100) / 100, full: Math.round(e.dps * 0.7 * 100) / 100 };
    return out; });
  ok('iron skin 35%', M.ironskin === 65, M.ironskin);
  ok('parry', M.parry.ok && M.parry.riposte === M.parry.expect && M.parry.miss === false, JSON.stringify(M.parry));
  ok('tribute +25', M.tribute === 25, M.tribute);
  ok('contempt 40%', Math.abs(M.contempt - 0.6) < 1e-9, M.contempt);
  ok('hand −15%', M.hand.build === 60 && M.hand.up === 68 && Math.abs(M.hand.mul - 0.85) < 1e-9, JSON.stringify(M.hand));
  ok('forged steel +26%', M.forge.near.n === 1 && M.forge.far.n === 1 && Math.abs(M.forge.near.dmg - Math.round(M.forge.near.base * 1.26 * 100) / 100) < 0.02 && Math.abs(M.forge.far.dmg - M.forge.far.base) < 0.02, JSON.stringify(M.forge));
  ok('siegecraft +16%', M.siege.band != null && M.siege.near === 1 && M.siege.far === 0, JSON.stringify(M.siege));
  ok('duelist ×2', M.duelist === 20, M.duelist);
  ok('rations +130', M.rations.hero === 130 && M.rations.ally === 130, JSON.stringify(M.rations));
  ok('charm walks back', M.charm.charmed && M.charm.back > 5, JSON.stringify(M.charm));
  ok('blood magic +13', M.bloodmagic === 13, M.bloodmagic);
  ok('warhammer 80%', M.warhammer === 8, M.warhammer);
  ok('two for one', M.twoforone.frenzy && M.twoforone.projs === 5 && M.twoforone.atk === 0.5, JSON.stringify(M.twoforone));
  ok('kingslayer 2000 into a boss', M.kingslayer.hit === Math.min(2000, M.kingslayer.lh), JSON.stringify(M.kingslayer));
  ok('dragonglass blades', M.dg.before === 65 && M.dg.after === 100 && M.dg.thawed, JSON.stringify(M.dg));
  ok('the bold', M.bold.dist < 20 && M.bold.hit > 0, JSON.stringify(M.bold));
  ok('lord of light', M.lol.sword === 35 && M.lol.lord === 17.5, JSON.stringify(M.lol));
  ok('fury', M.fury.fury && M.fury.hurt === 3 && M.fury.atk === 0.67, JSON.stringify(M.fury));
  ok('horns at dawn', M.dawn.hit === 4 && M.dawn.back.every(b => b >= 29), JSON.stringify(M.dawn));
  ok('discipline 35%', M.discipline.blows.length > 0 && M.discipline.blows.every(b => Math.abs(b.hit - (b.d <= 90 ? M.discipline.soft : M.discipline.full)) < 0.05) && M.discipline.blows.some(b => b.d <= 90), JSON.stringify(M.discipline));
  // the hero room and the book show the new kits
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('lannister', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.showHeroRoom('tyrion'); });
  await page.waitForTimeout(400);
  const hr = await page.evaluate(() => document.querySelector('#card').innerText);
  ok('hero room tyrion', /Hand of the King/.test(hr) && /Kindle/.test(hr) && /Wildfire/.test(hr) && /Master of Coin/.test(hr), hr.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch53_tyrion.png' });
  await page.evaluate(() => window.HOLDOR_BOOK.showBook('champs', 'jaime', false)); await page.waitForTimeout(400);
  const bk = await page.evaluate(() => document.querySelector('#bkDetail').innerText);
  ok('book jaime', /Parry/.test(bk) && /Kingslayer/.test(bk) && /Golden Hand/.test(bk), bk.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch53_book.png' });
  // a real battle with Robert: the fury ring and the warhammer are drawn without errors
  await page.evaluate(() => { const H = window.HOLDOR, G = H.G; const a = H.newAccount('baratheon', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = { robert: 1, renly: 1 }; a.sel = 'renly'; a.champs.renly = { lvl: 12, sk: [5, 5, 5], tal: 0 }; H.setAcc(a); H.startGame({ level: 9 }); G.waveDone = false; for (let i = 0; i < 6; i++) window.HOLDOR_CASTLE.spawn('sword', 300 + i * 10, 0); const q = H.posAt(G.map, 320, 0); G.hero.x = q.x + 10; G.hero.y = q.y; G.rng = () => 0.01; for (let i = 0; i < 40; i++) H.step(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SC + 'ch53_charm.png' });
  ok('charm hearts drawn', await page.evaluate(() => window.HOLDOR.G.enemies.some(e => e.charmT > window.HOLDOR.G.time)));
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
