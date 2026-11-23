// tests/gold/t_daygod.js — the day god (src/gold/js/40_daygod.js): today's god follows the UTC weekday; each of the 7 rules, forced with
// G.setDayGod, does what it says, measured through G.step (robbery share, cooldown, lightning at 30 s on the richest, coin worth, banking
// time, speed, the Moon night overlay read back from the canvas); 'none' is neutral; gold is conserved on every day; the title chip (icon + rule,
// a tap pops the effect + the next god right at the chip), the HUD chip (icon + the effect, ≤ 2 words) show, stay short and overlap nothing at 390×844, 844×390 and 640×360;
// the chip adds no title scroll; the end screen carries no day line; no page errors. Screenshots: .shots/gold_day_*.png
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const FILE = path.resolve(process.env.GOLD_HTML || path.join(__dirname, '..', '..', 'beta', 'index.html'));
const SHOTS = path.join(__dirname, '..', '..', '.shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m, i) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails++; };
const KEYS = ['sol', 'mani', 'tyr', 'odin', 'thor', 'freya', 'saturn'];   // by UTC weekday, 0 = Sunday
const near = (a, b, e) => Math.abs(a - b) <= e;

/* page helpers: start a round under a forced day, keep the bots still, put heroes far from the vaults (now and next) */
function helpers() {
  window.T = {
    begin(key, god) { G.setDayGod(key); G.start(god || 'thor'); return G.S; },
    off() { return G.total() - G.S.minted; },
    freeze() { for (const p of G.S.ps) { if (p.bot) { p.ai.t = 1e9; p.ai.dx = p.ai.dy = 0; } p.vx = p.vy = 0; p.imm = p.inv = 0; p.bankT = 0; } G.S.pairT = {}; G.S.decoys = []; },
    spots() { const vs = []; for (const v of G.S.vaults) { vs.push({ x: v.x, y: v.y }); if (v.nx != null) vs.push({ x: v.nx, y: v.ny }); }
      const out = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) out.push({ x: 400 + i * 640, y: 400 + j * 640 });
      return out.map(q => Object.assign(q, { d: Math.min(...vs.map(v => Math.hypot(v.x - q.x, v.y - q.y))) })).sort((a, b) => b.d - a.d); },
    spread() { const sp = T.spots(); G.S.ps.forEach((p, i) => { p.x = sp[i].x; p.y = sp[i].y; }); T.freeze(); T.clear(); return sp; },
    clear() { for (const c of G.S.coins) if (G.S.ps.some(p => Math.hypot(c.x - p.x, c.y - p.y) < 90)) { c.x = 3940; c.y = 3940; } },   // coins moved off the heroes' spots, not removed
    to(t) { while (G.S.t < t && !G.S.over) G.step(1); },
  };
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const open = async (w, h) => {
    const pg = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
    await pg.addInitScript(() => { try { localStorage.setItem('hg_profile', JSON.stringify({ name: 'Tester', country: 'GE' })); } catch (e) {} });   // the profile module holds PLAY until a profile exists
    pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/telegram|supabase|ERR_FAILED/i.test(m.text())) pg.errs.push(m.text()); });
    await pg.route(/telegram\.org|supabase\.co/, r => r.abort());
    await pg.goto('file://' + FILE); await pg.waitForFunction(() => window.G && G.dayGod && G.setDayGod);
    await pg.evaluate(helpers); return pg;
  };
  const frames = (pg, n) => pg.evaluate(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n || 3);
  const noErr = async (pg, tag) => { const err = await pg.evaluate(() => getComputedStyle(document.getElementById('err')).display); ok(!pg.errs.length && err === 'none', tag + ': no page errors, #err hidden', pg.errs); };

  /* ---------- 1. today's god, the 7 rules, 'none', gold conserved (390×844) ---------- */
  const pg = await open(390, 844);
  const d0 = await pg.evaluate(() => Object.assign({}, G.dayGod, { all: undefined, visible: undefined, timeLeft: undefined, utc: new Date().getUTCDay() }));
  ok(d0.key === KEYS[d0.utc] && d0.name && d0.rule && d0.day && d0.desc && d0.dow === d0.utc, "G.dayGod is today's UTC god: { key, name, rule, day, desc }", d0);
  const names = await pg.evaluate(() => G.dayGod.all.map(d => [d.key, d.name, d.rule, d.day]));
  ok(JSON.stringify(names.map(n => n[0])) === JSON.stringify(KEYS) && names.map(n => n[3]).join() === 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', 'the week: Sol, Máni, Tyr, Odin, Thor, Freya, Saturn by UTC weekday', names);

  // a real tap on PLAY after forcing a day starts a round under that day
  await pg.evaluate(() => G.setDayGod('thor')); await pg.locator('.god[data-god="loki"]').tap(); await pg.locator('#play').tap(); await pg.waitForTimeout(250);
  const tap = await pg.evaluate(() => ({ active: G.dayGod.active, god: G.S && G.S.me.god, chip: G.$('dgChip') && G.$('dgChip').classList.contains('on') }));
  ok(tap.active === 'thor' && tap.god === 'loki' && tap.chip, 'G.setDayGod + a real tap on PLAY: the round runs under the forced day, the chip shows', tap);

  // Tuesday, Tyr's law: a robbery takes 50 % (35 % on a neutral day)
  await pg.evaluate(() => { window.__rob = null; G.on('rob', (L, H, take, loss) => { window.__rob = { take, loss, before: H.carry + loss, thief: L.id, victim: H.id }; }); });
  const rob = await pg.evaluate(() => { const out = {};
    for (const key of ['tyr', 'none']) { const S = T.begin(key); const sp = T.spread(); const a = S.ps[1], c = S.ps[2]; a.carry = 0; c.carry = 200;
      a.x = sp[0].x; a.y = sp[0].y; c.x = sp[0].x + 22; c.y = sp[0].y; S.ps[0].x = sp[1].x; S.ps[0].y = sp[1].y; T.clear();
      window.__rob = null; const off = T.off(); G.step(1); out[key] = Object.assign({ share: __rob && __rob.loss / __rob.before, mod: G.mod('rob', c, G.ROB), conserved: T.off() === off }, __rob); }
    return out; });
  ok(rob.tyr.victim === 2 && rob.tyr.loss === Math.ceil(rob.tyr.before * 0.5) && near(rob.tyr.share, 0.5, 0.01) && rob.tyr.mod === 0.5 && rob.tyr.conserved, "Tyr's law: a robbery takes 50% of the carry; conserved", rob.tyr);
  ok(rob.none.loss === Math.ceil(rob.none.before * 0.35) && rob.none.mod === 0.35, "'none': the robbery is back to 35%", rob.none);

  // Wednesday, Odin's ravens: cooldowns 30 % shorter, measured by stepping until the skill fires again
  const cd = await pg.evaluate(() => { const out = {};
    for (const key of ['odin', 'none']) { const S = T.begin(key, 'hermes'); T.spread(); const me = S.me, r = {};
      for (const g of ['hermes', 'loki', 'amirani']) { me.god = g; me.cd = 0; G.useSkill(me); let n = 0; while (!G.useSkill(me) && n < 1200) { G.step(1); n++; } r[g] = +(n / 60).toFixed(2); me.inv = me.imm = 0; S.decoys = []; }
      r.mod = G.mod('cd', me, 9); out[key] = r; }
    return out; });
  ok(near(cd.odin.hermes, 2.8, 0.03) && near(cd.odin.loki, 7, 0.03) && near(cd.odin.amirani, 7, 0.03) && near(cd.odin.mod, 6.3, 1e-9), "Odin's ravens: cooldowns 30% shorter (Hermes 4 → 2.8 s, Loki and Amirani 10 → 7 s, Thor 9 → 6.3 s)", cd.odin);
  ok(near(cd.none.hermes, 4, 0.03) && near(cd.none.loki, 10, 0.03) && cd.none.mod === 9, "'none': cooldowns as the core sets them", cd.none);

  // Thursday, Thor's day: lightning every 30 s on the richest carrier (>= 10, not in a vault), 25 % spilled as coins
  const th = await pg.evaluate(() => {
    const S = T.begin('thor', 'hermes'), out = {}, DG = G.dayGod;
    const setup = (t, fn) => { T.to(t); T.spread(); for (const p of S.ps) p.carry = 0; fn(); T.freeze(); T.clear(); const off = T.off(), n0 = DG.strikes.length; const t0 = S.t;
      let steps = 0; while (DG.strikes.length === n0 && steps < 120) { G.step(1); steps++; }
      const rec = DG.strikes[DG.strikes.length - 1] || {}; return Object.assign({ at: +S.t.toFixed(3), conserved: T.off() === off, toast: G.$('toast').textContent, waited: +(S.t - t0).toFixed(2) }, rec); };
    out.s30 = setup(29.8, () => { S.ps[3].carry = 120; S.ps[5].carry = 40; S.me.carry = 30; });
    out.s30.victimCarry = S.ps[3].carry; out.s30.other = S.ps[5].carry; out.s30.coinsNear = S.coins.filter(c => Math.hypot(c.x - S.ps[3].x, c.y - S.ps[3].y) < 140).reduce((s, c) => s + c.v, 0);
    out.chip30 = G.$('dgChip').textContent;
    out.s60 = setup(59.8, () => { for (const p of S.ps) p.carry = 0; S.ps[4].carry = 9; });
    out.s90 = setup(89.8, () => { const v = S.vaults[0]; S.ps[2].x = v.x; S.ps[2].y = v.y; S.ps[2].carry = 150; S.ps[4].carry = 60; });
    out.s90.second = S.ps[4].carry; out.s90.inVault = S.ps[2].carry;
    out.s120 = setup(119.8, () => { S.me.carry = 90; S.ps[6].carry = 50; });
    out.s120.me = S.me.carry; out.s120.isMe = DG.strikes[DG.strikes.length - 1].me; S.over = true;   // freeze on the bolt for the screenshot
    out.list = DG.strikes.map(s => [s.t, s.id, s.loss, s.why || 'hit']);
    return out; });
  ok(near(th.s30.t, 30, 0.02) && th.s30.id === 3 && th.s30.before >= 120 && th.s30.loss === Math.ceil(th.s30.before * 0.25) && th.s30.victimCarry === th.s30.before - th.s30.loss && th.s30.other >= 40 && th.s30.coinsNear >= th.s30.loss && th.s30.conserved,
    "Thor's day: at 30 s lightning strikes the richest (120 → 90), 25% spills as coins next to him, the others keep theirs; conserved", th.s30);
  ok(/^⚡ −\d+ · \S+$/.test(th.s30.toast) && th.s30.toast.split(' ').length <= 6 && /^⚡\d+ s$/.test(th.chip30), 'a short toast "⚡ −30 · <name>"; the HUD chip "⚡ N s" counts down to the next strike', { toast: th.s30.toast, chip: th.chip30 });
  ok(near(th.s60.t, 60, 0.02) && th.s60.why === 'poor' && !th.s60.hit && th.s60.conserved, 'at 60 s nobody carries 10: no strike', th.s60);
  ok(near(th.s90.t, 90, 0.02) && th.s90.why === 'vault' && th.s90.id === 2 && th.s90.inVault === 150 && th.s90.second >= 60 && th.s90.conserved, 'at 90 s the richest stands in a vault: spared, and nobody else is struck', th.s90);
  ok(near(th.s120.t, 120, 0.02) && th.s120.isMe && th.s120.before >= 90 && th.s120.loss === Math.ceil(th.s120.before * 0.25) && th.s120.me === th.s120.before - th.s120.loss && /^⚡ −\d+ · Thor's lightning$/.test(th.s120.toast) && th.s120.conserved, 'at 120 s the player is the richest: struck (90 → 67), toast "⚡ −23 · Thor\'s lightning"', th.s120);
  await frames(pg, 3);
  const flash = await pg.evaluate(() => G.dayGod.flashes);
  await pg.screenshot({ path: path.join(SHOTS, 'gold_day_thor_strike.png') });
  ok(flash > 0, 'the strike draws a blue flash and a bolt (screenshot gold_day_thor_strike.png)', { flashes: flash, strikes: th.list });

  // Friday, Freya's gold: coins worth 50 % more (12, 6, 3; the start coins too), and minted counts it
  const fr = await pg.evaluate(() => { const out = {};
    window.__pick = []; if (!window.__pk) { window.__pk = 1; G.on('pickup', (p, c) => __pick.push(c.v)); }
    for (const key of ['freya', 'none']) { const S = T.begin(key), r = {}; r.start = [...new Set(S.coins.map(c => c.v))]; r.minted0 = S.minted; r.total0 = G.total();
      const per = t => { T.to(t); const m = S.minted; G.step(60); return S.minted - m; };
      r.v1 = per(10.5); r.v2 = per(60.5); r.v3 = per(110.5); window.__pick = []; while (!S.over) G.step(60);
      r.minted = S.minted; r.conserved = G.total() === S.minted; r.picked = [...new Set(__pick)].sort((a, b) => a - b); out[key] = r; }
    return out; });
  ok(fr.freya.start.join() === '12' && fr.freya.minted0 === 168 && fr.freya.total0 === 168 && fr.freya.v1 === 12 && fr.freya.v2 === 6 && fr.freya.v3 === 3 && fr.freya.picked.includes(3),
    "Freya's gold: every coin is worth 50% more (8 → 12, 4 → 6, 2 → 3, the start coins too), minted counts it", fr.freya);
  ok(fr.freya.conserved && fr.freya.minted > 1100 && fr.freya.minted <= 1500, "Freya's gold: a whole round mints ~1218, gold conserved (the server's cap is 1500)", { minted: fr.freya.minted });
  ok(fr.none.start.join() === '8' && fr.none.v1 === 8 && fr.none.v2 === 4 && fr.none.v3 === 2 && fr.none.minted > 600 && fr.none.minted < 900 && fr.none.conserved, "'none': coins 8 → 4 → 2, ~812 minted", fr.none);

  // Saturday, Saturn's hour: banking takes 0.75 s instead of 1.5 s
  const sat = await pg.evaluate(() => { const out = {};
    for (const key of ['saturn', 'none']) { const S = T.begin(key); T.spread(); const v = S.vaults[0], me = S.me; me.carry = 50; me.x = v.x; me.y = v.y; const b0 = me.bank; let n = 0;
      while (me.bank === b0 && n < 300) { for (const o of S.ps) if (o !== me && Math.hypot(o.x - v.x, o.y - v.y) < 500) { o.x = v.x + (v.x < 2000 ? 1500 : -1500); o.y = v.y; } me.x = v.x; me.y = v.y; me.vx = me.vy = 0; G.step(1); n++; }
      out[key] = { steps: n, secs: +(n / 60).toFixed(3), banked: me.bank - b0, mod: G.mod('bankT', me, G.BANK_T) }; }
    return out; });
  ok(sat.saturn.steps >= 45 && sat.saturn.steps <= 46 && sat.saturn.banked === 50 && sat.saturn.mod === 0.75, "Saturn's hour: 0.75 s in a vault banks the carry", sat.saturn);
  ok(sat.none.steps >= 90 && sat.none.steps <= 91 && sat.none.mod === 1.5, "'none': banking takes 1.5 s", sat.none);

  // Sunday, Sun day: every hero 12 % faster (the player, measured over 1 s of steps, and a bot through the mod)
  const sun = await pg.evaluate(() => { const out = {};
    for (const key of ['sol', 'none']) { const S = T.begin(key, 'thor'); T.spread(); const me = S.me; me.carry = 0; me.x = 900; me.y = 2000;
      for (const o of S.ps) if (o !== me && Math.abs(o.y - 2000) < 300 && o.x < 2400) o.y = o.y < 2000 ? 1500 : 2500;
      for (const c of S.coins) if (Math.abs(c.y - 2000) < 80 && c.x < 2000) c.y = 3600;   // moved, not removed
      G.joy.on = true; G.joy.dx = 1; G.joy.dy = 0; G.step(40); const x1 = me.x; G.step(60); const x2 = me.x; G.joy.on = false; G.joy.dx = 0;
      out[key] = { v: +(x2 - x1).toFixed(1), carry: me.carry, bot: +G.mod('speed', S.ps[1], 270).toFixed(2) }; }
    out.ratio = +(out.sol.v / out.none.v).toFixed(4); return out; });
  ok(near(sun.ratio, 1.12, 0.005) && sun.sol.carry === 0 && near(sun.sol.bot, 302.4, 0.01) && near(sun.none.v, 270, 1), 'Sun day: every hero is 12% faster (270 → 302 units/s)', sun);

  // Monday, Moon night: dark beyond ~340 units, rivals outside the light hidden with their names, coins glimmer — read back from the canvas
  const moon = async key => {
    await pg.evaluate(key => { const S = T.begin(key, 'thor'); S.over = true;   // the simulation stops, the drawing goes on
      const me = S.me; me.x = 2000; me.y = 2000; me.carry = 0; S.camX = 2000; S.camY = 2000; S.decoys = []; S.fx = []; S.veins = [];
      S.vaults.forEach((v, i) => { v.x = 300 + i * 3400; v.y = 300; v.nx = v.ny = null; });
      S.coins.forEach(c => { c.x = 3700; c.y = 3700; });
      S.ps.slice(4).forEach((p, i) => { p.x = 300 + i * 120; p.y = 3700; });
      const A = S.ps[1], B = S.ps[2], C = S.ps[3];
      A.x = 2000; A.y = 2360; A.carry = 30;   // just outside the light, below: its name reaches into the soft edge
      B.x = 2150; B.y = 2480; B.carry = 0;    // deep in the dark
      C.x = 1900; C.y = 1880; C.carry = 0;    // in the light
      S.coins[0].x = 1880; S.coins[0].y = 1580;   // a coin ~437 units away, on screen
    }, key);
    await frames(pg, 4);
    return pg.evaluate(() => { const S = G.S, v = G.dayGod.view, cv = G.$('c'), D = cv.width / G.W, c2 = cv.getContext('2d');
      const sc = p => [p.x * v.k + v.ox, p.y * v.k + v.oy];
      const px = (x, y) => Array.from(c2.getImageData(Math.round(x * D), Math.round(y * D), 1, 1).data).slice(0, 3);
      const box = (x0, y0, x1, y1) => { const d = c2.getImageData(Math.round(x0 * D), Math.round(y0 * D), Math.round((x1 - x0) * D), Math.round((y1 - y0) * D)).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i], d[i + 1], d[i + 2]); return m; };
      const [A, B, C] = [S.ps[1], S.ps[2], S.ps[3]], a = sc(A), bb = sc(B), c = sc(C), co = sc(S.coins[0]), rA = G.radius(A) * v.k;
      return { k: +v.k.toFixed(3), corner: px(4, 4), empty: px(...sc({ x: 2150, y: 1600 })), aBody: px(a[0] + rA * 0.7, a[1]), aName: box(a[0] - 34, a[1] - rA - 30, a[0] + 34, a[1] - rA - 6), bBody: px(bb[0] + G.radius(B) * v.k * 0.7, bb[1]), cBody: px(c[0] + G.radius(C) * v.k * 0.7, c[1]), coin: px(...co),
        vis: [G.dayGod.visible(S.me), G.dayGod.visible(A), G.dayGod.visible(B), G.dayGod.visible(C)], drawn: G.dayGod.drawn, onScreen: [a, bb, co].every(([x, y]) => x > 0 && x < G.W && y > 0 && y < G.H) }; });
  };
  const mn = await moon('mani'); await pg.screenshot({ path: path.join(SHOTS, 'gold_day_moon_test.png') });
  const nn = await moon('none');
  const dark = p => p[0] <= 12 && p[1] <= 14 && p[2] <= 26, bright = p => Math.max(...p) > 90;
  ok(mn.onScreen && mn.drawn > 0 && dark(mn.corner) && dark(mn.empty), 'Moon night: the overlay is drawn, the map is dark beyond the light', mn);
  ok(dark(mn.aBody) && mn.aName <= 30 && dark(mn.bBody) && bright(nn.aBody) && nn.aName > 150 && bright(nn.bBody), 'Moon night: rivals outside the light are hidden, their names too (seen on a neutral day)', { moon: [mn.aBody, mn.aName, mn.bBody], none: [nn.aBody, nn.aName, nn.bBody] });
  ok(bright(mn.cBody) && mn.coin[0] > 80 && mn.coin[0] > mn.coin[2] + 30, 'Moon night: a rival inside the light is seen; a coin in the dark still glimmers gold', { rival: mn.cBody, coin: mn.coin, coinNone: nn.coin });
  ok(mn.vis.join() === 'true,false,false,true' && nn.vis.every(Boolean), 'G.dayGod.visible(p): false for heroes hidden by the dark (for the minimap)', { moon: mn.vis, none: nn.vis });
  await pg.evaluate(() => { const S = T.begin('mani', 'thor'); S.me.x = 2000; S.me.y = 2000; S.camX = S.camY = 2000; S.ps[1].x = 2050; S.ps[1].y = 1830; S.ps[2].x = 2000; S.ps[2].y = 2420; S.ps[2].carry = 25; });
  await pg.waitForTimeout(1800); await pg.screenshot({ path: path.join(SHOTS, 'gold_day_moon_play.png') });

  // a day forced in the middle of a round waits for the next G.start; 'none' is neutral
  const mid = await pg.evaluate(() => { T.begin('tyr'); const me = G.S.me; G.setDayGod('freya');
    const r = { key: G.dayGod.key, active: G.dayGod.active, rob: G.mod('rob', me, G.ROB), coin: G.mod('coinValue', null, 8) };
    G.start('thor'); r.after = { active: G.dayGod.active, rob: G.mod('rob', me, G.ROB), coin: G.mod('coinValue', null, 8) };
    T.begin('none'); const p = G.S.me; r.none = { key: G.dayGod.key, active: G.dayGod.active, mods: [G.mod('rob', p, 0.35), G.mod('cd', p, 4), G.mod('bankT', p, 1.5), G.mod('speed', p, 270), G.mod('coinValue', null, 8)],
      chip: G.$('dgChip').classList.contains('on'), banner: getComputedStyle(G.$('dgBanner')).display };
    let n = 0; while (!G.S.over) G.step(60); r.none.strikes = G.dayGod.strikes.length; r.none.end = G.$('dgEnd') ? getComputedStyle(G.$('dgEnd')).display : 'none'; r.none.drawn = G.dayGod.drawn;
    G.setDayGod(null); r.back = G.dayGod.key; r.today = ['sol', 'mani', 'tyr', 'odin', 'thor', 'freya', 'saturn'][new Date().getUTCDay()]; return r; });
  ok(mid.key === 'freya' && mid.active === 'tyr' && mid.rob === 0.5 && mid.coin === 8 && mid.after.active === 'freya' && mid.after.rob === 0.35 && mid.after.coin === 12, 'a day forced mid-round takes effect at the next G.start', mid);
  ok(mid.none.key === 'none' && mid.none.mods.join() === '0.35,4,1.5,270,8' && !mid.none.chip && mid.none.banner === 'none' && mid.none.end === 'none' && mid.none.strikes === 0 && mid.back === mid.today,
    "G.setDayGod('none'): no rule, no chip on the title or the HUD; G.setDayGod(null) goes back to today", mid.none);

  // gold is conserved on every day: a whole round each, checked every second
  const cons = await pg.evaluate(() => { const out = {};
    for (const key of ['sol', 'mani', 'tyr', 'odin', 'thor', 'freya', 'saturn', 'none']) { const S = T.begin(key, ['hermes', 'thor', 'loki', 'amirani'][key.length % 4]); let bad = 0, n = 0;
      while (!S.over && n++ < 400) { G.step(60); if (G.total() !== S.minted) bad++; }
      out[key] = { bad, over: S.over, minted: S.minted, total: G.total(), robs: S.ps.reduce((s, p) => s + p.robs, 0), banked: S.ps.reduce((s, p) => s + p.bank, 0), strikes: G.dayGod.strikes.filter(s => s.hit).length }; }
    return out; });
  ok(Object.values(cons).every(r => r.bad === 0 && r.over && r.total === r.minted && r.robs > 0 && r.banked > 0), 'gold is conserved on every day: G.total() === G.S.minted through a whole round', cons);
  await noErr(pg, '390x844 rules');
  await pg.close();

  /* ---------- 2. banner, chip, end line at three sizes ---------- */
  const R = (a, b) => a && b && a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
  for (const [w, h] of [[390, 844], [844, 390], [640, 360]]) {
    const p = await open(w, h), tag = w + 'x' + h;
    const ban = await p.evaluate(keys => keys.map(k => { G.setDayGod(k); const el = G.$('dgBanner'), r = el.getBoundingClientRect(), box = e => { const q = (typeof e === 'string' ? document.querySelector(e) : e).getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; };
      return { k, text: el.textContent, btn: el.tagName === 'BUTTON', ban: box(el), others: ['h1', '#gods', '#gdesc', '#play', '#best', '#titleLinks'].map(box), play: box('#play'), sw: document.documentElement.scrollWidth }; }), KEYS);
    const all = await p.evaluate(() => G.dayGod.all.map(d => ({ ic: d.ic, rule: d.rule, hud: d.hud, desc: d.desc })));
    const banOk = ban.every((r, i) => r.btn && r.text === all[i].ic + all[i].rule && all[i].rule.split(' ').length <= 2 && r.ban.height >= 44 && r.ban.x >= 0 && r.ban.x + r.ban.width <= w && r.sw <= w && !r.others.some(o => R(o, r.ban)));
    ok(banOk, tag + ': the title chip "<icon> <rule>" (2 words, a >= 44 px button) shows for each day and overlaps nothing', ban.map(r => [r.text, Math.round(r.ban.y), Math.round(r.ban.height), Math.round(r.ban.width)]));
    ok(ban.every(r => r.play.height >= 44 && r.play.y + r.play.height <= h) , tag + ': PLAY stays on screen with the chip', ban.map(r => [Math.round(r.play.y + r.play.height), Math.round(r.ban.height)]));
    ok(all.every(d => d.desc.split(' ').filter(x => x !== '·').length <= 4 && d.hud.split(' ').length <= 2), tag + ': every effect line is at most 4 words, every HUD effect at most 2', all.map(d => [d.desc, d.hud]));
    // the chip adds no scroll to the title: the title's overflow is the same with the chip hidden
    const sc = await p.evaluate(() => { G.setDayGod('odin'); const t = G.$('title'), el = G.$('dgBanner'); const a = t.scrollHeight - t.clientHeight; el.style.display = 'none'; const b = t.scrollHeight - t.clientHeight; el.style.display = ''; return { withChip: a, without: b }; });
    ok(sc.withChip <= Math.max(0, sc.without), tag + ': the day chip adds no scroll to the title', sc);
    // a real tap pops the effect and the next god in one short line
    await p.evaluate(() => G.setDayGod('mani')); await p.locator('#dgBanner').tap(); await p.waitForTimeout(350);
    const pop = await p.evaluate(() => { const e = G.$('dgPop'), r = e && e.getBoundingClientRect(), box = q => { const o = q && q.getBoundingClientRect(); return o && { x: o.x, y: o.y, width: o.width, height: o.height }; };
      return e && { a: e.firstChild.textContent, b: e.lastChild.textContent, op: +getComputedStyle(e).opacity, x: r.x, w: r.width, y: r.y, h: r.height, ban: box(G.$('dgBanner')),
        cover: [['h1', box(document.querySelector('#title h1') || document.querySelector('h1'))], ['god', box(document.querySelector('#gods .god.sel'))], ['gdesc', box(G.$('gdesc'))], ['play', box(G.$('play'))]] }; });
    const pr = pop && { x: pop.x, y: pop.y, width: pop.w, height: pop.h }, hit = pop ? pop.cover.filter(([, o]) => o && o.width && R(o, pr)).map(o => o[0]) : ['?'];
    const nextTo = pop && (((Math.abs(pop.y - (pop.ban.y + pop.ban.height)) <= 8 || Math.abs(pop.y + pop.h - pop.ban.y) <= 8) && pop.x + pop.w > pop.ban.x && pop.x < pop.ban.x + pop.ban.width)
      || ((Math.abs(pop.x - (pop.ban.x + pop.ban.width)) <= 10 || Math.abs(pop.x + pop.w - pop.ban.x) <= 10) && pop.y + pop.h > pop.ban.y && pop.y < pop.ban.y + pop.ban.height)
      || (Math.abs(pop.x + pop.w / 2 - (pop.ban.x + pop.ban.width / 2)) <= 2 && Math.abs(pop.y + pop.h / 2 - (pop.ban.y + pop.ban.height / 2)) <= 2));   // under / above, beside, or on the chip
    ok(pop && pop.a === '🌙 Darkness' && /^Next: Tyr · \d+ (h|m)$/.test(pop.b) && pop.op > 0.5, tag + ': a tap on the chip pops "🌙 Darkness" / "Next: Tyr · 7 h"', pop && [pop.a, pop.b, pop.op]);
    ok(pop && nextTo && pop.x >= 16 - 0.5 && pop.x + pop.w <= w - 16 + 0.5 && pop.y >= 0 && pop.y + pop.h <= h && !hit.length, tag + ': the pop sits right at the chip, inside the 16 px gutters, over neither the title, the picked god, its line nor PLAY', pop && { pop: [Math.round(pop.x), Math.round(pop.y), Math.round(pop.w), Math.round(pop.h)], ban: pop.ban, hit });
    await p.screenshot({ path: path.join(SHOTS, 'gold_day_pop_' + w + '.png') });
    await p.evaluate(() => G.setDayGod('thor')); await p.screenshot({ path: path.join(SHOTS, 'gold_day_title_' + w + '.png') });
    const hud = [];
    for (const k of KEYS) {
      await p.evaluate(k => { const S = T.begin(k, 'amirani'); S.me.carry = 1234; S.me.bank = 4321; S.ps[1].bank = 999; }, k);
      await p.waitForTimeout(260);
      hud.push(await p.evaluate(() => { const box = id => { const q = G.$(id).getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; };
        const chip = box('dgChip'); return { k: G.dayGod.active, text: G.$('dgChip').textContent, chip, others: ['hTL', 'hTC', 'hTR', 'sk'].map(id => [id, box(id)]), on: getComputedStyle(G.$('dgChip')).display !== 'none' }; }));
      { const r = hud[hud.length - 1]; r.hit = r.others.filter(([id, o]) => o.width && R(o, r.chip)).map(o => o[0]); delete r.others; }
      if (k === 'thor' || k === 'mani') await p.screenshot({ path: path.join(SHOTS, 'gold_day_hud_' + k + '_' + w + '.png') });
    }
    ok(hud.every((r, i) => r.on && r.k === KEYS[i] && (KEYS[i] === 'thor' ? /^⚡\d+ s$/.test(r.text) : r.text === all[i].ic + all[i].hud && all[i].hud.split(' ').length <= 2) && r.chip.height > 10 && r.chip.x >= 0 && r.chip.y >= 0 && r.chip.x + r.chip.width <= w && r.chip.y + r.chip.height <= h && !r.hit.length),
      tag + ': the HUD chip "<icon> <effect>" (≤ 2 words: "🌙 Dark", "⚖️ Rob 50%"; "⚡ N s" on Thor\'s day) overlaps neither carry/bank, the clock, the board nor the skill button', hud.map(r => [r.text, r.hit, Math.round(r.chip.x), Math.round(r.chip.y), Math.round(r.chip.width)]));
    const end = await p.evaluate(() => { T.begin('freya', 'hermes'); while (!G.S.over) G.step(600); const box = id => { const q = G.$(id).getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; };
      return { on: G.$('end').classList.contains('on'), dgEnd: !!G.$('dgEnd'), day: /Today|Freya's|Coins ×1.5|🌸|Next:/.test(G.$('end').innerText), txt: G.$('end').innerText.replace(/\s+/g, ' ') }; });
    // a bot may be named Freya and win: the check looks for the day's own words
    ok(end.on && !end.dgEnd && !end.day, tag + ': the end screen carries no day-god line', end);
    await p.screenshot({ path: path.join(SHOTS, 'gold_day_end_' + w + '.png') });
    await noErr(p, tag);
    await p.close();
  }
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
