// Tunes each stage's enemy multiplier so the balance bot ends near a target gate % (bisection in log space).
// usage: node tune45.js <from-to> <out.json>   env: PAR=2 REP=2 IT=6 DIFF=squire
const { chromium } = require('playwright');
const fs = require('fs');
const [A, B] = (process.argv[2] || '1-50').split('-').map(Number);
const OUT = process.argv[3] || __dirname + '/tuned.json';
const PAR = +(process.env.PAR || 2), REP = +(process.env.REP || 2), IT = +(process.env.IT || 6), DIFF = process.env.DIFF || 'squire';
const PLAY = function(job){
    const H = window.HOLDOR, X = window.HOLDOR_GEN, id = job.id, diff = job.diff || 'squire', prof = job.prof || 'camp';
    const L = Object.assign({}, H.LEVELS[id - 1]); if (job.mult) L.mult = job.mult;
    const res = [];
    for (let rep = 0; rep < (job.rep || 1); rep++) {
      const a = H.newAccount('stark', 0, 'squire'); a.diff = diff; a.tut = 1; a.intro = 1; a.tour = 1; a.learn = {glass:1,keep:1,tier2:1,fire:1,reinf:1,scorp:1,wild:1,weir:1,tier3:1,tier4:1,tier5:1,gates:1,big:1,chest:1,hold:1,champ:1};
      for (let i = 1; i < id; i++) a.campaign[i] = 2;
      if (diff === 'kingsguard') { for (let i = 1; i <= 50; i++) a.campaign[i] = 2; for (let i = 1; i < id; i++) a.hard[i] = 2; }
      a.sel = 'jon';
      // the player we expect at this point of the road
      const k = diff === 'kingsguard' ? 50 + id * 0.6 : id;
      const cl = Math.min(20, 1 + Math.round(0.33 * (k - 1)));
      const rk = Math.min(X.rankCap(cl), 1 + Math.floor((k - 1) / 12));
      const tl = Math.min(16, 1 + Math.floor(0.22 * (k - 1)));
      a.champs.jon = { lvl: cl, sk: [rk, rk, rk], tal: cl >= 10 ? 1 : 0 };
      a.tlv = { watch: tl, glass: tl, keep: tl, scorp: tl, wild: tl, weir: tl };
      const perks = [['leather', 8], ['bank', 12], ['training', 15], ['sworn', 18], ['coin', 20], ['ironwood', 25], ['cache', 30], ['horse', 35], ['secondlife', 40], ['salvage', 45]];
      for (const [p, at] of perks) if (k >= at) a.upg[p] = 1;
      H.setAcc(a);
      H.startGame({ mode: 'campaign', level: L }); const G = H.G;
      const T = H.TOWERS, map = G.map, open = H.openTowers();
      const segs = map.routes.flatMap(R => R.segs.map(sg => Object.assign({ R }, sg)));
      const near = sl => { let best = null, bd = 1e9; for (const sg of segs) { const vx = sg.b.x - sg.a.x, vy = sg.b.y - sg.a.y, l2 = sg.len * sg.len; const t = Math.max(0, Math.min(1, ((sl.x - sg.a.x) * vx + (sl.y - sg.a.y) * vy) / l2)); const px = sg.a.x + vx * t, py = sg.a.y + vy * t; const d = Math.hypot(sl.x - px, sl.y - py); if (d < bd) { bd = d; best = { d, frac: (sg.start + sg.len * t) / sg.R.total }; } } return best; };
      const slots = map.slots.map(sl => Object.assign(sl, { nf: near(sl) })).slice().sort((p, q) => (q.nf.frac - p.nf.frac) || (p.nf.d - q.nf.d));
      const plan = ['watch', 'glass', 'watch', 'scorp', 'wild', 'keep', 'watch', 'scorp', 'weir', 'wild', 'glass', 'watch', 'scorp', 'keep', 'watch', 'wild', 'scorp', 'watch'].filter(k => open.includes(k));
      let pi = 0, steps = 0, ups = 0, builds = 0, ults = 0, pw = 0, heroDeaths = 0, wasDead = false;
      const hero = G.hero;
      const homeFor = () => { const R = map.routes[G.wave % map.routes.length]; const q = H.posAt(map, R.total - 95, R.i); return hero.type === 'melee' ? q : { x: q.x + (q.x < 195 ? 38 : -38), y: q.y - 10 }; };
      const maxSteps = 90000;
      while (steps < maxSteps && G.state === 'play') {
        steps++;
        if (steps % 12 === 0) {
          const free = slots.filter(sl => !sl.tower);
          const extra = ['watch', 'scorp', 'watch', 'glass', 'wild', 'watch', 'keep', 'scorp', 'weir', 'watch', 'wild', 'glass'].filter(k => open.includes(k));
          const want = pi < plan.length ? plan[pi] : extra[(pi - plan.length) % extra.length];
          const mxl = X.maxTowerLvl();
          const upc = map.slots.filter(sl => sl.tower && sl.tower.lvl < mxl).sort((p, q) => H.upCost(p.tower) - H.upCost(q.tower))[0];
          if (free.length && (pi < plan.length || !upc || H.upCost(upc.tower) > G.gold)) { const c = H.costOf(want); if (G.gold >= c) { H.build(free[0], want); builds++; pi++; } }
          else if (upc) { const up = H.upCost(upc.tower); if (G.gold >= up) { G.gold -= up; upc.tower.lvl++; upc.tower.invested += up; ups++; } }
          if (H.canCall() && G.nextIn < 9) H.callWave();
          if (!hero.dead && hero.tx == null && steps % 240 === 0) { const hm = homeFor(); if (Math.hypot(hero.x - hm.x, hero.y - hm.y) > 6) { hero.tx = hm.x; hero.ty = hm.y; } }
          if (hero.dead && !wasDead) heroDeaths++; wasDead = hero.dead;
          if (!hero.dead && hero.cd.ult <= 0) { const n = G.enemies.filter(e => e.hp > 0 && !e.fly && Math.hypot(H.posAt(map, e.prog, e.route).x - hero.x, H.posAt(map, e.prog, e.route).y - hero.y) < 110).length; const boss = G.enemies.some(e => e.hp > 0 && (e.boss || e.mini)); if (n >= 3 || boss) { H.castUlt(); ults++; } }
          if (H.spellOpen('arrows') && G.powerCd.arrows <= 0) { const al = G.enemies.filter(e => e.hp > 0 && !e.fly); if (al.length >= 4) { let bx = 0, by = 0, bn = 0; for (const e of al) { const p = H.posAt(map, e.prog, e.route); let n = 0; for (const o of al) { const q = H.posAt(map, o.prog, o.route); if (Math.hypot(p.x - q.x, p.y - q.y) < 90) n++; } if (n > bn) { bn = n; bx = p.x; by = p.y; } } if (bn >= 4) { H.castPower('arrows', bx, by); pw++; } } }
          if (H.spellOpen('fire') && G.powerCd.fire <= 0) { const b = G.enemies.find(e => e.hp > 0 && (e.boss || e.mini || e.dragon)); if (b) { const p = b.fly ? { x: b.x, y: b.y } : H.posAt(map, b.prog, b.route); H.castPower('fire', p.x, p.y); pw++; } }
          if (H.spellOpen('reinf') && G.powerCd.reinf <= 0 && G.enemies.some(e => e.hp > 0 && !e.fly && map.routes[e.route || 0].total - e.prog < 260)) { H.castPower('reinf'); pw++; }
        }
        H.step();
      }
      res.push({ win: !!G.victory, door: Math.round(100 * G.doorHp / G.doorMax), wave: G.wave, waves: L.waves, steps, towers: map.slots.filter(x => x.tower).length, lv: map.slots.filter(x => x.tower).reduce((a, x) => a + x.tower.lvl, 0), hd: heroDeaths });
    }
    return { id, mult: L.mult, diff, res };
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pages = [];
  for (let i = 0; i < PAR; i++) { const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => console.log('PAGEERR', e.message)); await p.goto(('file://' + require('path').resolve(__dirname, '../..', process.env.HOLDOR_HTML || 'beta/index.html'))); await p.waitForFunction(() => window.HOLDOR_GEN, { timeout: 20000 });
    await p.evaluate(src => { window.__play = eval('(' + src + ')'); }, PLAY.toString()); pages.push(p); }
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const ids = process.env.IDS ? process.env.IDS.split(',').map(Number) : []; if (!ids.length) for (let i = A; i <= B; i++) ids.push(i); let qi = 0;
  await Promise.all(pages.map(async p => { while (qi < ids.length) { const id = ids[qi++]; const t0 = Date.now();
    const r = await p.evaluate(([id, REP, IT, DIFF, LO, HI, PRED]) => {
      const H = window.HOLDOR, L = H.LEVELS[id - 1], boss = !!L.boss;
      const T = (id <= 5 ? 90 : id <= 10 ? 80 : id <= 20 ? 70 : id <= 30 ? 62 : id <= 40 ? 56 : 52) - (boss ? 10 : 0);
      const score = m => { const r = window.__play({ id, mult: m, rep: REP, diff: DIFF }).res; return { s: r.reduce((a, x) => a + (x.win ? x.door : -20 - 40 * (1 - x.wave / x.waves)), 0) / r.length, r }; };
      const m0 = PRED && PRED[id] ? PRED[id] : 1.5 + 1.6 * Math.pow((id - 1) / 49, 1.1); let lo = m0 * LO, hi = m0 * HI; const log = [];
      for (let k = 0; k < IT; k++) { const mid = Math.sqrt(lo * hi); const sc = score(mid); log.push(mid.toFixed(3) + ':' + Math.round(sc.s)); if (sc.s > T) lo = mid; else hi = mid; }
      return { id, T, m: Math.sqrt(lo * hi), log };
    }, [id, REP, IT, DIFF, +(process.env.LO || 0.6), +(process.env.HI || 1.8), process.env.PRED ? JSON.parse(fs.readFileSync(process.env.PRED, 'utf8')) : null]);
    out[id] = Math.round(r.m * 1000) / 1000; fs.writeFileSync(OUT, JSON.stringify(out));
    console.log('S' + String(id).padStart(2), 'T' + r.T, 'm=' + r.m.toFixed(3), r.log.join(' '), Math.round((Date.now() - t0) / 1000) + 's'); } }));
  await browser.close();
})();
