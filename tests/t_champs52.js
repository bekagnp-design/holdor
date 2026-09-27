// v1.0.52: champion order + migration, the 14 Stark/Targaryen kits, every new mechanic fired at least once.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CH52, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  // order + tiers + unlock stages
  const ord = await page.evaluate(() => { const H = window.HOLDOR; const by = {}; for (const c of H.CHAMPS) { (by[c.house] = by[c.house] || []).push(c.id + ':' + c.tier); } return { by, us: window.HOLDOR_CH52.UNLOCK_STAGE, first: H.newAccount('stark', 0, 'squire').sel, firstT: H.newAccount('targaryen', 0, 'squire').sel }; });
  ok('stark order', ord.by.stark.join(' ') === 'brienne:0 robb:1 bran:2 sansa:3 ned:4 arya:5 jon:6', ord.by.stark.join(' '));
  ok('martell order', ord.by.martell.join(' ') === 'areo:0 nymeria:1 obara:2 tyene:3 doran:4 ellaria:5 oberyn:6', ord.by.martell.join(' '));
  ok('unlock stages', JSON.stringify(ord.us) === '[0,5,10,18,27,36,45]', JSON.stringify(ord.us));
  ok('new accounts start with the first champion', ord.first === 'brienne' && ord.firstT === 'viserys', ord.first + ' ' + ord.firstT);
  // migration: an old save with Jon riding and 12 stages held keeps Jon, Arya, Sansa, Bran (old tiers 0/3/6/10) + gets Brienne, Robb, Bran by the new order
  const mig = await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('stark', 0, 'squire'); delete a.lv52; a.sel = 'jon'; a.champs = { jon: { lvl: 5, sk: [2, 1, 1], tal: 0 } }; for (let i = 1; i <= 12; i++) a.campaign[i] = 2; window.HOLDOR_CH52.migrate52(a); H.setAcc(a); return { copen: Object.keys(a.copen).sort().join(','), un: H.CHAMPS.filter(c => c.house === 'stark' && window.HOLDOR_CH52.unlocked(a, c)).map(c => c.id).join(','), jonOpen: window.HOLDOR_CH52.unlocked(a, window.HOLDOR_CH52.CBY.jon), nedOpen: window.HOLDOR_CH52.unlocked(a, window.HOLDOR_CH52.CBY.ned) }; });
  ok('migration keeps old unlocks', mig.copen === 'arya,bran,jon,sansa' && mig.un === 'brienne,robb,bran,sansa,arya,jon' && mig.jonOpen && !mig.nedOpen, JSON.stringify(mig));
  // kits
  const kits = await page.evaluate(() => { const H = window.HOLDOR; const out = {}; for (const id in window.HOLDOR_CH52.KITS52) out[id] = window.HOLDOR_CH52.CBY[id].sk.join('+'); const pairs = new Set(Object.values(out).map(x => x.split('+').slice(0, 2).sort().join('+'))); const ults = Object.values(out).map(x => x.split('+')[2]); return { out, uniquePairs: pairs.size, ults: ults.length, uniqueUlts: new Set(ults).size, missing: Object.values(out).flatMap(x => x.split('+')).filter(k => !H.SK[k]) }; });
  ok('14 kits, unique pairs and ults', kits.uniquePairs === 14 && kits.uniqueUlts === 14 && kits.missing.length === 0, JSON.stringify(kits));
  // base damage
  const base = await page.evaluate(() => ({ r: window.HOLDOR_CH52.HERO_BASE('ranged').dmg, c: window.HOLDOR_CH52.HERO_BASE('caster').dmg, m: window.HOLDOR_CH52.HERO_BASE('melee').dmg }));
  ok('ranged −20%', base.r === 14 && base.c === 12 && base.m === 22, JSON.stringify(base));
  // play each of the 14 through a scripted battle: ult + skills, no exceptions
  const play = async (house, id) => page.evaluate(([house, id]) => {
    const H = window.HOLDOR, G = H.G; const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 1 }; a.army = { lvl: 5 }; H.setAcc(a);
    H.startGame({ level: 9 }); G.waveDone = false; const R0 = G.map.routes[0];
    for (let i = 0; i < 8; i++) window.HOLDOR_CASTLE.spawn(i % 3 ? 'sword' : 'axe', R0.total - 150 - i * 14, 0);
    const h = G.hero; const e0 = G.enemies[0]; const p = H.posAt(G.map, e0.prog, 0); h.x = p.x + 10; h.y = p.y; h.tx = null; h.hp = h.max * 0.4;
    const before = { gold: G.gold, door: G.doorHp, n: G.enemies.length, allies: G.allies.length, hp: h.hp, prog: G.enemies.map(e => Math.round(e.prog)) };
    for (let i = 0; i < 400 && G.state === 'play'; i++) H.step();
    h.cd.ult = 0; H.castUlt();
    for (let i = 0; i < 90 && G.state === 'play'; i++) H.step();
    const st = { ult: h.c.sk[2], cd: h.cd.ult > 0, gold: G.gold - before.gold, door: G.doorHp - before.door, alive: G.enemies.filter(e => e.hp > 0).length, allies: G.allies.length, hp: Math.round(h.hp), max: h.max, kills: G.kills, traps: G.traps.length, wall: G.wallUntil > G.time, goldx2: G.goldx2Until > G.time, rage: h.rageUntil > G.time, chilled: G.enemies.filter(e => e.chillT > G.time).length, sundered: G.enemies.filter(e => e.sunderT > G.time).length, stunned: G.enemies.filter(e => e.stunT > 0).length, state: G.state, prog: G.enemies.map(e => Math.round(e.prog)) };
    return st; }, [house, id]);
  const ids = { stark: ['brienne', 'robb', 'bran', 'sansa', 'ned', 'arya', 'jon'], targaryen: ['viserys', 'missandei', 'daario', 'greyworm', 'jorah', 'drogo', 'dany'] };
  const res = {};
  for (const house in ids) for (const id of ids[house]) { res[id] = await play(house, id); }
  const chk = (id, cond) => ok('play ' + id + ' (' + res[id].ult + ')', cond(res[id]) && res[id].state === 'play', JSON.stringify(res[id]));
  chk('brienne', s => s.cd);
  chk('robb', s => s.allies >= 2 && s.chilled >= 0);
  chk('bran', s => s.cd);
  chk('sansa', s => s.goldx2 || s.gold > 0);
  chk('ned', s => s.cd);
  chk('arya', s => s.kills >= 1);
  chk('jon', s => s.wall);
  chk('viserys', s => s.cd);
  chk('missandei', s => s.cd);
  chk('daario', s => s.kills >= 1 || s.alive < 8);
  chk('greyworm', s => s.allies >= 3);
  chk('jorah', s => s.rage);
  chk('drogo', s => s.cd);
  chk('dany', s => s.cd);
  // targeted mechanic checks
  const mech = await page.evaluate(() => {
    const H = window.HOLDOR, G = H.G; const out = {};
    const setup = (house, id) => { const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 0 }; H.setAcc(a); H.startGame({ level: 9 }); G.waveDone = false; return G.hero; };
    // frostbite + sunder via heroHit on Jon / Sansa
    let h = setup('stark', 'jon'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); let e = G.enemies[0]; window.HOLDOR_CH52.heroHit(e, 10); out.frost = { chill: e.chillT > G.time, v: e.chillV };
    h = setup('stark', 'sansa'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); e = G.enemies[0]; window.HOLDOR_CH52.heroHit(e, 10); H.step(); out.sunder = { t: e.sunderT > G.time, v: e.sunderV, mark: e.mark };
    // lifesteal on Brienne
    h = setup('stark', 'brienne'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); e = G.enemies[0]; h.hp = 100; window.HOLDOR_CH52.heroHit(e, 40); out.lifesteal = { hp: h.hp };
    // blood on Daario: below half → more damage
    h = setup('targaryen', 'daario'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); e = G.enemies[0]; G.rng = () => 0.99; h.hp = h.max * 0.3; const hp0 = e.hp; window.HOLDOR_CH52.heroHit(e, 10); out.blood = { dealt: Math.round((hp0 - e.hp) * 100) / 100 };
    // knock on Drogo
    h = setup('targaryen', 'drogo'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); e = G.enemies[0]; G.rng = () => 0.01; const pr = e.prog; window.HOLDOR_CH52.heroHit(e, 1); out.knock = { moved: pr - e.prog };
    // chain on Viserys (caster)
    h = setup('targaryen', 'viserys'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); window.HOLDOR_CASTLE.spawn('sword', 210, 0); const e2 = G.enemies[1]; const hp2 = e2.hp; window.HOLDOR_CH52.heroHit(G.enemies[0], 20); out.chain = { second: Math.round((hp2 - e2.hp) * 10) / 10 };
    // gold x2 on Sansa
    h = setup('stark', 'sansa'); window.HOLDOR_CASTLE.spawn('axe', 200, 0); window.HOLDOR_CASTLE.spawn('axe', 200, 0); const ea = G.enemies[0], eb = G.enemies[1]; G.rng = () => 0.99; let g0 = G.gold; ea.hp = 1; window.HOLDOR_CH52.heroHit(ea, 5); const plain = G.gold - g0; G.goldx2Until = G.time + 5; g0 = G.gold; eb.hp = 1; window.HOLDOR_CH52.heroHit(eb, 5); out.goldx2 = { plain, doubled: G.gold - g0 };
    // caltrops / volley / howl fire on their timers
    h = setup('targaryen', 'greyworm'); h.skT.trap = 0.01; H.step(); out.trap = { n: G.traps.filter(t => t.calt).length, dmg: G.traps[0] && G.traps[0].dmg };
    h = setup('targaryen', 'dany'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); const q = H.posAt(G.map, 200, 0); h.x = q.x + 20; h.y = q.y; h.skT.volley = 0.01; const np = G.projs.length; H.step(); out.volley = { projs: G.projs.length - np, dmg: G.projs.filter(p => p.dmg === 150).length };
    h = setup('stark', 'robb'); window.HOLDOR_CASTLE.spawn('sword', 200, 0); const q2 = H.posAt(G.map, 200, 0); h.x = q2.x + 20; h.y = q2.y; h.skT.howl = 0.01; H.step(); out.howl = { chilled: G.enemies.filter(e => e.chillT > G.time).length, v: G.enemies[0].chillV };
    // a new battle clears the wall / double gold
    H.startGame({ level: 9 }); out.reset = { wall: G.wallUntil, gx: G.goldx2Until };
    // wall stops walkers: Jon
    h = setup('stark', 'jon'); const R0 = G.map.routes[0]; window.HOLDOR_CASTLE.spawn('sword', R0.total - 120, 0); e = G.enemies[0]; h.cd.ult = 0; H.castUlt(); for (let i = 0; i < 240; i++) H.step(); out.wall = { remain: Math.round(R0.total - e.prog), wall: G.wallUntil > G.time };
    return out; });
  ok('frostbite', mech.frost.chill && mech.frost.v === 45, JSON.stringify(mech.frost));
  ok('sunder', mech.sunder.t && mech.sunder.v === 30 && mech.sunder.mark === 1.3, JSON.stringify(mech.sunder));
  ok('lifesteal', mech.lifesteal.hp === 114, JSON.stringify(mech.lifesteal));
  ok('second wind', mech.blood.dealt === 16, JSON.stringify(mech.blood));
  ok('shove', mech.knock.moved === 24, JSON.stringify(mech.knock));
  ok('chain', mech.chain.second === 13, JSON.stringify(mech.chain));
  ok('gold ×2', mech.goldx2.doubled === mech.goldx2.plain * 2, JSON.stringify(mech.goldx2));
  ok('caltrops', mech.trap.n === 1 && mech.trap.dmg === 210, JSON.stringify(mech.trap));
  ok('volley', mech.volley.projs >= 1 && mech.volley.dmg === 1, JSON.stringify(mech.volley));
  ok('howl', mech.howl.chilled === 1 && mech.howl.v === 60, JSON.stringify(mech.howl));
  ok('battle reset', mech.reset.wall === 0 && mech.reset.gx === 0, JSON.stringify(mech.reset));
  ok('ice wall holds', mech.wall.wall && mech.wall.remain >= 60 && mech.wall.remain <= 95, JSON.stringify(mech.wall));
  // hero room + book render the new kits without errors
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('targaryen', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.showHeroRoom('dany'); });
  await page.waitForTimeout(400);
  const hr = await page.evaluate(() => document.querySelector('#card').innerText);
  ok('hero room dany', /Volley/.test(hr) && /Dracarys/.test(hr) && /Mother of Dragons/.test(hr), hr.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch_dany.png' });
  await page.evaluate(() => window.HOLDOR_BOOK.showBook('champs', 'greyworm', false)); await page.waitForTimeout(400);
  const bk = await page.evaluate(() => document.querySelector('#bkDetail').innerText);
  ok('book greyworm', /Caltrops/.test(bk) && /Shield Wall/.test(bk) && /Torgo Nudho/.test(bk), bk.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch_book.png' });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
