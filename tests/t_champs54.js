// v1.0.54: Greyjoy + Tyrell kits — uniqueness across all 42 redone champions, a scripted battle per champion,
// and a targeted check of every new mechanic.
const { chromium } = require('playwright');
const SC = require('path').resolve(__dirname, '..', '.shots') + '/'; require('fs').mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto(('file://' + require('path').resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_CH54, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const kits = await page.evaluate(() => { const H = window.HOLDOR, K = Object.assign({}, window.HOLDOR_CH52.KITS52, window.HOLDOR_CH53.KITS53, window.HOLDOR_CH54.KITS54); const out = {}; for (const id in K) out[id] = window.HOLDOR_CH52.CBY[id].sk.join('+');
    const pairs = Object.values(out).map(x => x.split('+').slice(0, 2).sort().join('+')), ults = Object.values(out).map(x => x.split('+')[2]);
    const dupP = pairs.filter((p, i) => pairs.indexOf(p) !== i), dupU = ults.filter((u, i) => ults.indexOf(u) !== i);
    const use = {}; for (const x of Object.values(out)) for (const k of x.split('+').slice(0, 2)) use[k] = (use[k] || 0) + 1;
    return { n: Object.keys(out).length, dupP, dupU, missing: Object.values(out).flatMap(x => x.split('+')).filter(k => !H.SK[k] || !H.SK[k].d || H.SK[k].v.length !== 5), most: Object.entries(use).sort((a, b) => b[1] - a[1]).slice(0, 6) }; });
  ok('42 kits unique', kits.n === 42 && !kits.dupP.length && !kits.dupU.length && !kits.missing.length, JSON.stringify(kits));
  const play = (house, id) => page.evaluate(([house, id]) => {
    const H = window.HOLDOR, G = H.G; const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 1 }; H.setAcc(a);
    H.startGame({ level: 9 }); G.waveDone = false; const R0 = G.map.routes[0];
    for (let i = 0; i < 8; i++) window.HOLDOR_CASTLE.spawn(i % 3 ? 'sword' : 'axe', R0.total - 150 - i * 14, 0);
    const h = G.hero; const p = H.posAt(G.map, G.enemies[0].prog, 0); h.x = p.x + 10; h.y = p.y; h.tx = null; h.hp = h.max * 0.4;
    for (let i = 0; i < 400 && G.state === 'play'; i++) H.step();
    h.cd.ult = 0; H.castUlt();
    for (let i = 0; i < 60 && G.state === 'play'; i++) H.step();
    return { ult: h.c.sk[2], cd: h.cd.ult > 0, kills: G.kills, state: G.state }; }, [house, id]);
  const ids = { greyjoy: ['rodrik', 'aeron', 'balon', 'victarion', 'yara', 'euron', 'theon'], tyrell: ['garlan', 'randyll', 'mace', 'loras', 'olenna', 'sam', 'margaery'] };
  for (const house in ids) for (const id of ids[house]) { const s = await play(house, id); ok('play ' + id + ' (' + s.ult + ')', s.cd && s.state === 'play', JSON.stringify(s)); }
  const M = await page.evaluate(() => {
    const H = window.HOLDOR, G = H.G, C3 = window.HOLDOR_CH53, C2 = window.HOLDOR_CH52, S = window.HOLDOR_CASTLE; const out = {};
    const setup = (house, id) => { const a = H.newAccount(house, 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; a.copen = {}; a.copen[id] = 1; a.sel = id; a.champs[id] = { lvl: 12, sk: [5, 5, 5], tal: 0 }; H.setAcc(a); H.startGame({ level: 9 }); G.waveDone = false; G.rng = Math.random; return G.hero; };
    const at = (prog) => H.posAt(G.map, prog, 0);
    const sturdy = (type, prog) => { S.spawn(type, prog, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 5000; return e; };
    const stepN = (n, h) => { for (let i = 0; i < n; i++) { if (h) h.atkT = 999; H.step(); } };
    let h, e, q;
    // Quick Study: battle XP ×2
    h = setup('greyjoy', 'rodrik'); h.bxp = 0; window.HOLDOR_CH54.heroXp(1); out.quickstudy = h.bxp;
    // Drowning Tide: 26 a second within 70 px
    h = setup('greyjoy', 'aeron'); e = sturdy('sword', 300); q = at(300); h.x = q.x + 30; h.y = q.y; h.tx = null; e.spdBase = 0; stepN(60, h); out.drown = Math.round(5000 - e.hp);
    // Bleed: 15% of max health over 4 s, bosses half
    h = setup('greyjoy', 'victarion'); e = sturdy('sword', 300); G.rng = () => 0.99; C2.heroHit(e, 1); const b1 = e.bleed ? Math.round(e.bleed.dps * 4) : null; const lord = S.spawn('lord', 200, 0) || G.enemies[G.enemies.length - 1]; const lo = G.enemies[G.enemies.length - 1]; lo.hp = lo.max = 4000; C2.heroHit(lo, 1); out.bleed = { sword: b1, boss: lo.bleed ? Math.round(lo.bleed.dps * 4) : null };
    // Reave: a champion kill heals 12%
    h = setup('greyjoy', 'yara'); S.spawn('axe', 300, 0); e = G.enemies[0]; e.hp = 1; h.hp = 100; G.rng = () => 0.99; C2.heroHit(e, 5); out.reave = { gain: Math.round(h.hp - 100), expect: Math.round(h.max * 0.12) };
    // Stormcaller: 150 on a wight within 150 px
    h = setup('greyjoy', 'euron'); e = sturdy('sword', 300); e.spdBase = 0; q = at(300); h.x = q.x + 60; h.y = q.y; h.tx = null; h.atkT = 999; h.skT.storm = 0.01; H.step(); out.storm = Math.round(5000 - e.hp);
    // What Is Dead: 1 health and 4 s untouchable, once per life
    h = setup('greyjoy', 'theon'); h.hp = 10; h.invulnUntil = 0; C3.hurtHero(100); const w1 = { hp: h.hp, inv: Math.round((h.invulnUntil - G.time) * 10) / 10, dead: h.dead }; C3.hurtHero(100); const w2 = h.hp; h.invulnUntil = 0; C3.hurtHero(100); out.whatisdead = { w1, w2, deadAfter: h.dead };
    // Thorns: 25 back for every blow
    h = setup('tyrell', 'garlan'); e = sturdy('sword', 300); q = at(300); h.x = q.x; h.y = q.y; h.tx = null; let hp0 = h.hp, eh0 = e.hp, th = null; for (let i = 0; i < 120 && th == null; i++) { h.atkT = 999; H.step(); if (h.hp < hp0 - 0.01) th = Math.round(eh0 - e.hp); hp0 = h.hp; eh0 = e.hp; } out.thorns = th;
    // Drill +30% (and Muster ×1.5 on top), Favour 48% faster — one brother, one sturdy wight
    const allyHit = (house, id, ult) => { h = setup(house, id); G.powerCd.reinf = 0; H.castPower('reinf'); stepN(40, h); G.allies = [G.allies[0]]; const b = G.allies[0]; const R0 = G.map.routes[0]; let best = null, bd = 1e9; for (let d = 20; d < R0.total; d += 2) { const pp = at(d); const dd = Math.hypot(pp.x - b.x, pp.y - b.y); if (dd < bd) { bd = dd; best = d; } }
      e = sturdy('sword', best); e.spdBase = 0; h.x = b.x + 60; h.y = b.y - 30; h.tx = null; if (ult) { h.cd.ult = 0; H.castUlt(); } let hit = null, rate = null, prev = e.hp; for (let i = 0; i < 120 && hit == null; i++) { h.atkT = 999; H.step(); if (e.hp < prev - 0.01) { hit = Math.round((prev - e.hp) * 100) / 100; rate = Math.round(b.atkT * 1000) / 1000; } prev = e.hp; } return { hit, base: Math.round(b.dmg * 100) / 100, rate, brate: b.rate, d: Math.round(Math.hypot(b.x - h.x, b.y - h.y)) }; };
    out.drill = allyHit('tyrell', 'randyll', false); out.muster = allyHit('tyrell', 'randyll', true); out.favour = allyHit('tyrell', 'margaery', false);
    // Tourney Lance: after 60 px of riding, +150% and a 1 s stun
    h = setup('tyrell', 'loras'); e = sturdy('sword', 300); G.rng = () => 0.99; h.momPx = 100; C2.heroHit(e, 10); out.momentum = { dealt: Math.round(5000 - e.hp), stun: e.stunT >= 1, reset: h.momPx };
    // Fall Back: Sam steps away from a wight that reaches him
    h = setup('tyrell', 'sam'); e = sturdy('sword', 300); e.spdBase = 0; q = at(300); h.x = q.x + 6; h.y = q.y; h.tx = null; const d0 = Math.hypot(h.x - q.x, h.y - q.y); stepN(30, h); out.keepback = { from: Math.round(d0), to: Math.round(Math.hypot(h.x - q.x, h.y - q.y)) };
    // Old Tales: spells −30 s
    h = setup('greyjoy', 'rodrik'); G.powerCd.arrows = 20; G.powerCd.fire = 50; h.cd.ult = 0; H.castUlt(); out.oldtales = { arrows: G.powerCd.arrows, fire: G.powerCd.fire };
    // Drowned and Risen: a fallen brother stands up; the champion survives one killing blow
    h = setup('greyjoy', 'aeron'); G.powerCd.reinf = 0; H.castPower('reinf'); stepN(10, h); h.cd.ult = 0; H.castUlt(); const br = G.allies[0]; br.hp = -5; H.step(); h.invulnUntil = 0; C3.hurtHero(h.max * 3); out.drowned = { brother: br.hp === br.max && G.allies.includes(br), hero: Math.round(h.hp / h.max * 100), dead: h.dead };
    // The Iron Price: 60 gold → 380 to all; no gold → 190
    h = setup('greyjoy', 'balon'); const ea = sturdy('sword', 300), eb = sturdy('axe', 200); G.gold = 100; h.cd.ult = 0; H.castUlt(); const ip1 = { gold: G.gold, a: Math.round(5000 - ea.hp), b: Math.round(5000 - eb.hp) }; G.gold = 0; h.cd.ult = 0; H.castUlt(); out.ironprice = { ip1, poor: Math.round(5000 - ea.hp) - ip1.a };
    // Axe Storm: 1.2× damage every half second around Victarion
    h = setup('greyjoy', 'victarion'); e = sturdy('sword', 300); e.spdBase = 0; q = at(300); h.x = q.x + 20; h.y = q.y; h.tx = null; h.cd.ult = 0; H.castUlt(); stepN(62, h); out.axestorm = { dealt: Math.round(5000 - e.hp), per: Math.round(h.dmg * 1.2 * 10) / 10 };
    // The Iron Fleet: ten volleys of 270
    h = setup('greyjoy', 'yara'); const fl = [sturdy('sword', 300), sturdy('sword', 250), sturdy('sword', 200)]; for (const x of fl) x.spdBase = 0; h.x = 20; h.y = 40; h.tx = null; h.cd.ult = 0; H.castUlt(); stepN(260, h); out.ironfleet = { total: Math.round(fl.reduce((s, x) => s + 5000 - x.hp, 0)), fleet: G.fleet };
    // Iron Arrow: every wight on the chosen line takes 720
    h = setup('greyjoy', 'theon'); const ia = [sturdy('sword', 300), sturdy('sword', 330), sturdy('sword', 360), sturdy('axe', 900)]; q = at(300); const q2 = at(360); h.x = q.x - (q2.x - q.x) * 2; h.y = q.y - (q2.y - q.y) * 2; h.x = Math.max(10, Math.min(380, h.x)); h.y = Math.max(20, Math.min(600, h.y)); h.cd.ult = 0; H.castUlt(); out.ironarrow = ia.map(x => Math.round(5000 - x.hp));
    // Growing Strong: +25% after 5 s
    h = setup('tyrell', 'garlan'); const slot = G.map.slots[0]; slot.tower = { type: 'watch', lvl: 1, cd: 0, invested: 70, face: 0 }; let inR = null; for (let d = 20; d < G.map.routes[0].total; d += 2) { const pp = at(d); if (Math.hypot(pp.x - slot.x, pp.y - slot.y) < 60) { inR = d; break; } } e = sturdy('axe', inR); h.x = slot.x + 200 > 380 ? slot.x - 200 : slot.x + 200; h.y = Math.min(600, slot.y + 150); h.tx = null; h.cd.ult = 0; H.castUlt(); G.growT0 = G.time - 5; G.projs = []; H.step(); const pw = G.projs.filter(p => p.src === 'watch')[0]; out.growing = { dmg: pw ? Math.round(pw.dmg * 100) / 100 : null, base: Math.round(C3.towerStats(slot.tower).dmg * 100) / 100 };
    // Harvest Feast: 30 a second
    h = setup('tyrell', 'mace'); G.doorHp = G.doorMax - 500; const dh = G.doorHp; h.cd.ult = 0; H.castUlt(); stepN(60, h); out.harvest = Math.round(G.doorHp - dh);
    // Queen of Thorns: everyone poisoned 48/s for 6 s
    h = setup('tyrell', 'olenna'); sturdy('sword', 300); sturdy('axe', 100); h.cd.ult = 0; H.castUlt(); out.queenthorns = G.enemies.map(x => x.poison ? x.poison.dps + '/' + x.poison.t : null);
    // Dragonglass Dagger: the Lieutenant dies; the Night King takes 1000; no walker → the strongest takes 1000
    h = setup('tyrell', 'sam'); S.spawn('walker', 300, 0); S.spawn('lord', 250, 0); S.spawn('sword', 200, 0); const lt = G.enemies[1]; lt.hp = lt.max = 3000; h.cd.ult = 0; H.castUlt(); const s1 = { lordDead: lt.hp <= 0 };
    h = setup('tyrell', 'sam'); S.spawn('king', 300, 0); const kg = G.enemies[0]; kg.hp = kg.max = 9000; h.cd.ult = 0; H.castUlt(); s1.king = Math.round(9000 - kg.hp);
    h = setup('tyrell', 'sam'); const s3 = sturdy('sword', 300); sturdy('axe', 200).hp = 100; h.cd.ult = 0; H.castUlt(); s1.none = Math.round(5000 - s3.hp); out.slayer = s1;
    // Queen of Roses: wights within 150 px turn around for 5 s, bosses do not
    h = setup('tyrell', 'margaery'); const r1 = sturdy('sword', 300), r2 = sturdy('lord', 305); q = at(300); h.x = q.x + 40; h.y = q.y; h.tx = null; h.cd.ult = 0; H.castUlt(); out.queenroses = { wight: Math.round((r1.charmT - G.time) * 10) / 10, boss: !!(r2.charmT > G.time) };
    return out; });
  ok('quick study ×2', M.quickstudy === 2, M.quickstudy);
  ok('drowning tide 26/s', Math.abs(M.drown - 26) <= 1, M.drown);
  ok('bleed 15% (boss half)', M.bleed.sword === 750 && M.bleed.boss === 300, JSON.stringify(M.bleed));
  ok('reave 12%', M.reave.gain === M.reave.expect, JSON.stringify(M.reave));
  ok('stormcaller 150', M.storm === 150, M.storm);
  ok('what is dead', M.whatisdead.w1.hp === 1 && M.whatisdead.w1.inv === 4 && !M.whatisdead.w1.dead && M.whatisdead.w2 === 1 && M.whatisdead.deadAfter, JSON.stringify(M.whatisdead));
  ok('thorns 25', M.thorns === 25, M.thorns);
  ok('drill +30%', M.drill.hit != null && Math.abs(M.drill.hit - M.drill.base * 1.3) < 0.05 && M.drill.d <= 90, JSON.stringify(M.drill));
  ok('muster ×1.5 on top', M.muster.hit != null && Math.abs(M.muster.hit - M.muster.base * 1.3 * 1.5) < 0.05, JSON.stringify(M.muster));
  ok("favour 48% faster", M.favour.hit != null && Math.abs(M.favour.rate - M.favour.brate / 1.48) < 0.002, JSON.stringify(M.favour));
  ok('tourney lance', M.momentum.dealt === 25 && M.momentum.stun && M.momentum.reset === 0, JSON.stringify(M.momentum));
  ok('fall back', M.keepback.to > M.keepback.from + 25, JSON.stringify(M.keepback));
  ok('old tales −30 s', M.oldtales.arrows === 0 && M.oldtales.fire === 20, JSON.stringify(M.oldtales));
  ok('drowned and risen', M.drowned.brother && M.drowned.hero === 50 && !M.drowned.dead, JSON.stringify(M.drowned));
  ok('iron price', M.ironprice.ip1.gold === 40 && M.ironprice.ip1.a === 380 && M.ironprice.ip1.b === 380 && M.ironprice.poor === 190, JSON.stringify(M.ironprice));
  ok('axe storm', M.axestorm.dealt >= 2 * M.axestorm.per - 1 && Math.abs(M.axestorm.dealt / M.axestorm.per - Math.round(M.axestorm.dealt / M.axestorm.per)) < 0.02, JSON.stringify(M.axestorm));
  ok('iron fleet 10 × 270', M.ironfleet.total === 2700 && M.ironfleet.fleet === null, JSON.stringify(M.ironfleet));
  ok('iron arrow', M.ironarrow.filter(x => x === 720).length >= 2 && M.ironarrow.every(x => x === 0 || x === 720), JSON.stringify(M.ironarrow));
  ok('growing strong +25%', M.growing.dmg != null && Math.abs(M.growing.dmg - M.growing.base * 1.25) < 0.02, JSON.stringify(M.growing));
  ok('harvest 30/s', Math.abs(M.harvest - 30) <= 1, M.harvest);
  ok('queen of thorns', M.queenthorns.every(x => x === '48/6'), JSON.stringify(M.queenthorns));
  ok('dragonglass dagger', M.slayer.lordDead && M.slayer.king === 1000 && M.slayer.none === 1000, JSON.stringify(M.slayer));
  ok('queen of roses', M.queenroses.wight === 5 && !M.queenroses.boss, JSON.stringify(M.queenroses));
  // hero room + book
  await page.evaluate(() => { const H = window.HOLDOR; const a = H.newAccount('greyjoy', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 46; i++) a.campaign[i] = 3; H.setAcc(a); H.persist(); H.showHeroRoom('theon'); });
  await page.waitForTimeout(400);
  const hr = await page.evaluate(() => document.querySelector('#card').innerText);
  ok('hero room theon', /What Is Dead/.test(hr) && /Iron Arrow/.test(hr) && /Precision/.test(hr), hr.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch54_theon.png' });
  await page.evaluate(() => window.HOLDOR_BOOK.showBook('champs', 'margaery', false)); await page.waitForTimeout(400);
  const bk = await page.evaluate(() => document.querySelector('#bkDetail').innerText);
  ok('book margaery', /Queen of Roses/.test(bk) && /Favour/.test(bk) && /Charm/.test(bk), bk.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SC + 'ch54_book.png' });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
})();
