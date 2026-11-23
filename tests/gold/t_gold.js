// tests/gold/t_gold.js — Heavy Gold smoke: title → PLAY with a real tap, a full 150 s round simulated with G.step,
// gold conserved (coins + carried + banked = minted), robbery, banking, every god's skill, the end screen, no page errors.
const { chromium } = require('playwright'); const path = require('path');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED/i.test(m.text())) errs.push(m.text()); });
    await pg.route(/telegram\.org/, r => r.abort());
    await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G);
    await pg.evaluate(() => { if (G.setDayGod) G.setDayGod('none'); G.beforePlay = null; try { localStorage.setItem('hg_profile', JSON.stringify({ name: 'Tester', country: 'GE' })); } catch (e) {} });
    await pg.screenshot({ path: path.join(__dirname, '..', '..', '.shots', 'gold_title_' + w + '.png') });
    const btn = await pg.locator('#play').boundingBox(); ok(btn && btn.height >= 44 && btn.y + btn.height <= h, w + 'x' + h + ': PLAY visible, >= 44 px', btn);
    await pg.locator('.god[data-god="thor"]').tap(); await pg.locator('#play').tap(); await pg.waitForTimeout(300);
    const s0 = await pg.evaluate(() => ({ on: !!G.S, god: G.S && G.S.me.god, minted: G.S.minted, total: G.total(), n: G.S.ps.length, coins: G.S.coins.length }));
    ok(s0.on && s0.god === 'thor' && s0.n === 8 && s0.total === s0.minted && s0.coins <= 20, 'a real tap starts a round as Thor with 8 heroes, a few coins, gold conserved', s0);
    // a real joystick drag moves the hero
    const p0 = await pg.evaluate(() => ({ x: G.S.me.x, y: G.S.me.y }));
    await pg.mouse.move(w * 0.3, h * 0.6); await pg.mouse.down(); await pg.mouse.move(w * 0.3 + 50, h * 0.6, { steps: 4 }); await pg.waitForTimeout(500);
    const p1 = await pg.evaluate(() => ({ x: G.S.me.x, y: G.S.me.y, jx: G.joy.dx })); await pg.mouse.up();
    ok(p1.x - p0.x > 30, 'a drag to the right moves the hero right', { dx: Math.round(p1.x - p0.x), jx: p1.jx });
    const dm = await pg.evaluate(() => { const lay = () => JSON.stringify([G.S.ps.map(p => [Math.round(p.x), Math.round(p.y)]), G.S.coins.map(c => [Math.round(c.x), Math.round(c.y)]), G.S.vaults.map(v => [Math.round(v.x), Math.round(v.y)])]);
      const god0 = G.S.me.god; G.setMap(7); G.start(god0); const a = lay(); G.step(600); const c10 = JSON.stringify(G.S.coins.slice(-5).map(c => [Math.round(c.x), Math.round(c.y)]));
      G.start(god0); const b = lay(); G.step(600); const c10b = JSON.stringify(G.S.coins.slice(-5).map(c => [Math.round(c.x), Math.round(c.y)])); G.setMap(8); G.start(god0); const d = lay(); G.setMap(null); G.start(god0);
      return { same: a === b, sameCoins: c10 === c10b, differs: a !== d, no: G.mapNo }; });
    ok(dm.same && dm.differs && dm.no >= 1, 'the daily map: the same start, coins and vaults on the same map; another map differs', dm);
    const r = await pg.evaluate(() => {
      const S = G.S, out = { checks: [] }; const off0 = G.total() - S.minted;
      // robbery: the lighter one touches the heavier one
      const far = [[600, 600], [3400, 600], [600, 3400], [3400, 3400], [2000, 2000]].map(([x, y]) => ({ x, y })).sort((m, n) => Math.min(...S.vaults.map(v => Math.hypot(v.x - n.x, v.y - n.y))) - Math.min(...S.vaults.map(v => Math.hypot(v.x - m.x, v.y - m.y))))[0];
      const a = S.ps[1], c = S.ps[2]; S.pairT = {}; a.cd = c.cd = S.t + 99; a.inv = c.inv = a.imm = c.imm = 0; a.carry = 0; c.carry = 200; a.x = far.x; a.y = far.y; c.x = far.x + 20; c.y = far.y; const before = G.total() - S.minted;
      G.step(1); out.rob = { a: a.carry, c: c.carry, conserved: G.total() - S.minted === before };
      // banking: stand in a vault 1.5 s
      const v = G.VAULTS[0], q = S.ps[3];
      q.carry = 77; q.bot = false; const bank0 = q.bank; let carried = 0;
      for (let i = 0; i < 100 && q.bank === bank0; i++) { for (const o of S.ps) if (o !== q && Math.hypot(o.x - v.x, o.y - v.y) < 400) { o.x = v.x + (v.x < 2000 ? 1500 : -1500); o.y = v.y; } q.x = v.x; q.y = v.y; q.vx = q.vy = 0; if (q.carry) carried = q.carry; G.step(1); }
      out.bank = { banked: q.bank - bank0, carry: q.carry, carried }; q.bot = true;
      // a hero in a vault and a vanished hero cannot be robbed
      const vv = S.vaults[1], h1 = S.ps[5], l1 = S.ps[6]; h1.carry = 90; l1.carry = 0; h1.x = vv.x; h1.y = vv.y; l1.x = vv.x + 20; l1.y = vv.y; h1.bankT = 0; S.pairT = {};
      const keep = h1.carry; G.step(1); out.safe = { kept: h1.carry === keep || h1.bank > 0, robbed: l1.carry > 0 };
      const h2 = S.ps[5]; h2.x = 2000; h2.y = 2000; h2.carry = 90; h2.inv = S.t + 3; l1.x = 2015; l1.y = 2000; l1.carry = 0; S.pairT = {}; G.step(1); out.vanish = { robbed: l1.carry > 0 }; h2.inv = 0;
      // skills
      const me = S.me; me.carry = 10; const t3 = S.ps[4]; t3.carry = 300; t3.imm = 0; t3.x = me.x + 60; t3.y = me.y; t3.inv = 0; const tb = G.total();
      me.cd = 0; out.thor = { used: G.useSkill(me), victim: t3.carry, conserved: G.total() === tb };
      for (const g of ['hermes', 'loki', 'amirani']) { me.god = g; me.cd = 0; out[g] = G.useSkill(me); }
      out.inv = me.inv > S.t; out.imm = me.imm > S.t; out.decoys = S.decoys.length; me.god = 'thor';
      out.off = G.total() - S.minted;   // gold the test itself handed out above
      // vaults move every 20 s, the new spot shows 3 s before; coins arrive one a second, worth 8 → 4 → 2
      const v0 = S.vaults.map(v => [Math.round(v.x), Math.round(v.y)]).join(); const tm = S.vNext; let warned = false;
      while (S.t < tm + 0.1) { G.step(1); if (S.vaults[0].nx != null) warned = true; }
      out.vault = { warned, moved: S.vaults.map(v => [Math.round(v.x), Math.round(v.y)]).join() !== v0, n: S.vaults.length };
      out.values = [];
      // the rest of the round
      let guard = 0; while (!S.over && guard++ < 200000) { G.step(60); const vs = new Set(S.coins.map(c => c.v)); if (S.t > 52 && S.t < 54) out.values.push(...vs); }
      out.over = S.over; out.minted = S.minted; out.total = G.total() - out.off; out.coinsLeft = S.coins.length;
      out.banks = S.ps.map(p => p.bank); out.robs = S.ps.reduce((s, p) => s + p.robs, 0);
      return out; });
    ok(r.rob.a > 0 && r.rob.c < 200 && r.rob.conserved, 'the lighter one robs the heavier one; gold conserved', r.rob);
    ok(r.bank.banked >= 77 && r.bank.carry === 0, '1.5 s in a vault banks the carried gold', r.bank);
    ok(!r.safe.robbed && r.vanish && !r.vanish.robbed, 'a hero standing in a vault or vanished (Loki) cannot be robbed', { safe: r.safe, vanish: r.vanish });
    ok(r.thor.used && r.thor.victim < 300 && r.thor.conserved, 'Thor makes a richer rival nearby spill gold; conserved', r.thor);
    ok(r.hermes && r.loki && r.amirani && r.inv && r.imm && r.decoys >= 1, 'Hermes, Loki (vanish + decoy), Amirani (chains) skills fire', r);
    ok(r.vault.warned && r.vault.moved && r.vault.n === 2, '2 vaults move after 20 s and show the new spot first', r.vault);
    ok(r.over && r.total === r.minted && r.minted > 600 && r.minted < 900, 'the round ends at 2:30; one coin a second (8, 4, 2) minted ~810; every coin accounted for', { minted: r.minted, total: r.total, left: r.coinsLeft });
    ok(r.values.includes(4), 'after 50 s new coins are worth 4', [...new Set(r.values)]);
    ok(r.robs > 3 && r.banks.filter(x => x > 0).length >= 3, 'bots rob and bank during a round', { robs: r.robs, banks: r.banks });
    await pg.waitForTimeout(300);
    const e = await pg.evaluate(() => ({ on: document.getElementById('end').classList.contains('on'), rank: document.getElementById('eRank').textContent }));
    ok(e.on && /#\d+ of 8/.test(e.rank), 'the end screen shows the rank', e);
    await pg.screenshot({ path: path.join(__dirname, '..', '..', '.shots', 'gold_end_' + w + '.png') });
    await pg.locator('#again').tap(); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(__dirname, '..', '..', '.shots', 'gold_play_' + w + '.png') });
    const err = await pg.evaluate(() => getComputedStyle(document.getElementById('err')).display);
    ok(!errs.length && err === 'none', 'no page errors, #err hidden', errs);
    await pg.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
