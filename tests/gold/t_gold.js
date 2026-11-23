// tests/gold/t_gold.js — Heavy Gold smoke: title → PLAY with a real tap, a full 150 s round simulated with G.step,
// gold conserved (coins + carried + banked = minted), robbery, banking, every god's skill, the end screen, no page errors.
const { chromium } = require('playwright'); const path = require('path');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'src', 'gold', 'index.html'));
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|ERR_FAILED/i.test(m.text())) errs.push(m.text()); });
    await pg.route(/telegram\.org/, r => r.abort());
    await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G);
    await pg.screenshot({ path: path.join(__dirname, '..', '..', '.shots', 'gold_title_' + w + '.png') });
    const btn = await pg.locator('#play').boundingBox(); ok(btn && btn.height >= 44 && btn.y + btn.height <= h, w + 'x' + h + ': PLAY visible, >= 44 px', btn);
    await pg.locator('.god[data-god="thor"]').tap(); await pg.locator('#play').tap(); await pg.waitForTimeout(300);
    const s0 = await pg.evaluate(() => ({ on: !!G.S, god: G.S && G.S.me.god, minted: G.S.minted, total: G.total(), n: G.S.ps.length }));
    ok(s0.on && s0.god === 'thor' && s0.n === 12 && s0.total === s0.minted, 'a real tap starts a round as Thor with 12 heroes, gold conserved', s0);
    // a real joystick drag moves the hero
    const p0 = await pg.evaluate(() => ({ x: G.S.me.x, y: G.S.me.y }));
    await pg.mouse.move(w * 0.3, h * 0.6); await pg.mouse.down(); await pg.mouse.move(w * 0.3 + 50, h * 0.6, { steps: 4 }); await pg.waitForTimeout(500);
    const p1 = await pg.evaluate(() => ({ x: G.S.me.x, y: G.S.me.y, jx: G.joy.dx })); await pg.mouse.up();
    ok(p1.x - p0.x > 30, 'a drag to the right moves the hero right', { dx: Math.round(p1.x - p0.x), jx: p1.jx });
    const r = await pg.evaluate(() => {
      const S = G.S, out = { checks: [] }; const off0 = G.total() - S.minted;
      // robbery: the lighter one touches the heavier one
      const a = S.ps[1], c = S.ps[2]; a.carry = 0; c.carry = 200; a.x = 1000; a.y = 1000; c.x = 1020; c.y = 1000; const before = G.total();
      G.step(1); out.rob = { a: a.carry, c: c.carry, conserved: G.total() === before };
      // banking: stand in a vault 1.5 s
      const v = G.VAULTS[0], q = S.ps[3]; for (const o of S.ps) if (o !== q && Math.hypot(o.x - v.x, o.y - v.y) < 400) { o.x = 1000; o.y = 1000; }
      q.carry = 77; q.bot = false; const bank0 = q.bank; let carried = 0;
      for (let i = 0; i < 100; i++) { q.x = v.x; q.y = v.y; q.vx = q.vy = 0; if (q.carry) carried = q.carry; G.step(1); }
      out.bank = { banked: q.bank - bank0, carry: q.carry, carried }; q.bot = true;
      // skills
      const me = S.me; me.carry = 10; const t3 = S.ps[4]; t3.carry = 300; t3.imm = 0; t3.x = me.x + 60; t3.y = me.y; t3.inv = 0; const tb = G.total();
      me.cd = 0; out.thor = { used: G.useSkill(me), victim: t3.carry, conserved: G.total() === tb };
      for (const g of ['hermes', 'loki', 'amirani']) { me.god = g; me.cd = 0; out[g] = G.useSkill(me); }
      out.inv = me.inv > S.t; out.imm = me.imm > S.t; out.decoys = S.decoys.length; me.god = 'thor';
      out.off = G.total() - S.minted;   // gold the test itself handed out above
      // the rest of the round
      let guard = 0; while (!S.over && guard++ < 200000) G.step(60);
      out.over = S.over; out.minted = S.minted; out.total = G.total() - out.off; out.blocks = S.block;
      out.banks = S.ps.map(p => p.bank); out.robs = S.ps.reduce((s, p) => s + p.robs, 0);
      return out; });
    ok(r.rob.a > 0 && r.rob.c < 200 && r.rob.conserved, 'the lighter one robs the heavier one; gold conserved', r.rob);
    ok(r.bank.banked >= 77 && r.bank.carry === 0, '1.5 s in a vault banks the carried gold', r.bank);
    ok(r.thor.used && r.thor.victim < 300 && r.thor.conserved, 'Thor makes a richer rival nearby spill gold; conserved', r.thor);
    ok(r.hermes && r.loki && r.amirani && r.inv && r.imm && r.decoys >= 1, 'Hermes, Loki (vanish + decoy), Amirani (chains) skills fire', r);
    ok(r.over && r.blocks === 15 && r.total === r.minted, 'the round ends at 2:30 after 15 blocks; every coin accounted for', { blocks: r.blocks, minted: r.minted, total: r.total });
    ok(r.robs > 5 && r.banks.filter(x => x > 0).length >= 4, 'bots rob and bank during a round', { robs: r.robs, banks: r.banks });
    await pg.waitForTimeout(300);
    const e = await pg.evaluate(() => ({ on: document.getElementById('end').classList.contains('on'), rank: document.getElementById('eRank').textContent }));
    ok(e.on && /#\d+ of 12/.test(e.rank), 'the end screen shows the rank', e);
    await pg.screenshot({ path: path.join(__dirname, '..', '..', '.shots', 'gold_end_' + w + '.png') });
    await pg.locator('#again').tap(); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(__dirname, '..', '..', '.shots', 'gold_play_' + w + '.png') });
    const err = await pg.evaluate(() => getComputedStyle(document.getElementById('err')).display);
    ok(!errs.length && err === 'none', 'no page errors, #err hidden', errs);
    await pg.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
