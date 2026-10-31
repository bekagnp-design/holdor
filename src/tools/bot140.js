// Balance bot for v1.2+ (answers the skill offers G.learnAsk). Derived from bot45.js.
// usage:  CHROMIUM_PATH=... SEEDS=6 PAR=4 node src/tools/bot140.js 20-40 [out.json]
//   arg   : stage range "a-b" / "a" / "5,15,25" (or a jobs JSON file: [{id, mult}])
//   env   : SEEDS (paired seeds per stage, default 6), PAR (browser pages, default 4),
//           MULTS='{"25":1.7}' (override mults without a rebuild), LEARN=random|off (default random),
//           HOLDOR_HTML (build to test, default beta/index.html), TLF (tower-level slope, default 0.35)
// Profile: tower card level = min(16, 1+floor(TLF*(stage-1))), no Mastery, champion Jon at level/rank by stage,
// perks by stage, learn offers (waves 3/6/9/12/15 + champion levels 3/5) answered by a seeded random pick.
// Prints per stage: wins/seeds, mean gate % (door hp at the end; wins only, and all runs with a loss = 0).
// Not modelled: gear, other champions, spell loadout beyond arrows/fire/reinforce, tower selling, human micro.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const arg = process.argv[2] || '20-40', OUT = process.argv[3] || null;
const SEEDS = +(process.env.SEEDS || 6), PAR = +(process.env.PAR || 4), LEARN = process.env.LEARN || 'random', TLF = +(process.env.TLF || 0.35);
const MULTS = JSON.parse(process.env.MULTS || '{}');
let ids = [];
if (fs.existsSync(arg)) ids = JSON.parse(fs.readFileSync(arg, 'utf8')).map(j => j.id);
else if (arg.includes(',')) ids = arg.split(',').map(Number);
else { const [a, b] = arg.split('-').map(Number); for (let i = a; i <= (b || a); i++) ids.push(i); }
const jobs = []; for (const id of ids) for (let rep = 0; rep < SEEDS; rep++) jobs.push({ id, rep, mult: MULTS[id] });
function play(job, LEARN, TLF) {
  const H = window.HOLDOR, X = window.HOLDOR_GEN, id = job.id, rep = job.rep;
  const L = Object.assign({}, H.LEVELS[id - 1]); if (job.mult) L.mult = job.mult;
  const a = H.newAccount('stark', 0, 'squire'); a.diff = 'squire'; a.tut = 1; a.intro = 1; a.tour = 1; a.learn = { glass: 1, keep: 1, tier2: 1, fire: 1, reinf: 1, scorp: 1, wild: 1, weir: 1, tier3: 1, tier4: 1, tier5: 1, gates: 1, big: 1, chest: 1, hold: 1, champ: 1 };
  for (let i = 1; i < id; i++) a.campaign[i] = 2; a.sel = 'jon';
  const k = id, cl = Math.min(20, 1 + Math.round(0.33 * (k - 1))), rk = Math.min(X.rankCap(cl), 1 + Math.floor((k - 1) / 12)), tl = Math.min(16, 1 + Math.floor(TLF * (k - 1)));
  a.champs.jon = { lvl: cl, sk: [rk, rk, rk], tal: cl >= 10 ? 1 : 0 };
  a.tlv = { watch: tl, glass: tl, keep: tl, scorp: tl, wild: tl, weir: tl, rook: tl, maul: tl }; a.mst = {};
  const rnd = (() => { let s = (id * 7919 + rep * 104729 + 17) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const perks = [['leather', 8], ['bank', 12], ['training', 15], ['sworn', 18], ['coin', 20], ['ironwood', 25], ['cache', 30], ['horse', 35], ['secondlife', 40], ['salvage', 45]];
  for (const [p, at] of perks) if (k >= at) a.upg[p] = 1;
  const LN = window.HOLDOR_LEARN ? window.HOLDOR_LEARN.LEARN : { at: [] }, CV = window.HOLDOR_CHAMP ? window.HOLDOR_CHAMP.CLV : { at: [] };
  window.__o = window.__o || { ln: LN.at.slice(), cv: CV.at.slice() };
  LN.at.length = 0; CV.at.length = 0; if (LEARN !== 'off') { LN.at.push(...window.__o.ln); CV.at.push(...window.__o.cv); }
  H.setAcc(a); H.G.runs = 100 * rep + id; H.startGame({ mode: 'campaign', level: L }); const G = H.G;
  const map = G.map, open = H.openTowers(), hero = G.hero;
  const segs = map.routes.flatMap(R => R.segs.map(sg => Object.assign({ R }, sg)));
  const near = sl => { let best = null, bd = 1e9; for (const sg of segs) { const vx = sg.b.x - sg.a.x, vy = sg.b.y - sg.a.y, l2 = sg.len * sg.len; const t = Math.max(0, Math.min(1, ((sl.x - sg.a.x) * vx + (sl.y - sg.a.y) * vy) / l2)); const px = sg.a.x + vx * t, py = sg.a.y + vy * t; const d = Math.hypot(sl.x - px, sl.y - py); if (d < bd) { bd = d; best = { d, frac: (sg.start + sg.len * t) / sg.R.total }; } } return best; };
  const slots = map.slots.map(sl => Object.assign(sl, { nf: near(sl) })).slice().sort((p, q) => (q.nf.frac - p.nf.frac) || (p.nf.d - q.nf.d));
  const plan = ['watch', 'glass', 'watch', 'scorp', 'wild', 'keep', 'watch', 'scorp', 'weir', 'wild', 'glass', 'watch', 'scorp', 'keep', 'watch', 'wild', 'scorp', 'watch'].filter(k => open.includes(k));
  let pi = 0, steps = 0, asks = 0;
  const homeFor = () => { const R = map.routes[G.wave % map.routes.length]; const q = H.posAt(map, R.total - 95, R.i); return hero.type === 'melee' ? q : { x: q.x + (q.x < 195 ? 38 : -38), y: q.y - 10 }; };
  while (steps < 90000 && G.state === 'play') {
    steps++;
    if (G.learnAsk) { const o = G.learnAsk; asks++; window.HOLDOR_LEARN.learnPick(o[Math.floor(rnd() * o.length)]); }
    if (steps % 12 === 0) {
      const free = slots.filter(sl => !sl.tower);
      const extra = ['watch', 'scorp', 'watch', 'glass', 'wild', 'watch', 'keep', 'scorp', 'weir', 'watch', 'wild', 'glass'].filter(k => open.includes(k));
      const want = pi < plan.length ? plan[pi] : extra[(pi - plan.length) % extra.length];
      const mxl = X.maxTowerLvl();
      const upc = map.slots.filter(sl => sl.tower && sl.tower.lvl < mxl).sort((p, q) => H.upCost(p.tower) - H.upCost(q.tower))[0];
      if (free.length && (pi < plan.length || !upc || H.upCost(upc.tower) > G.gold)) { const c = H.costOf(want); if (G.gold >= c) { H.build(free[0], want); pi++; } }
      else if (upc) { const up = H.upCost(upc.tower); if (G.gold >= up) { G.gold -= up; upc.tower.lvl++; upc.tower.invested += up; } }
      if (H.canCall() && G.nextIn < 9) H.callWave();
      if (!hero.dead && hero.tx == null && steps % 240 === 0) { const hm = homeFor(); if (Math.hypot(hero.x - hm.x, hero.y - hm.y) > 6) { hero.tx = hm.x; hero.ty = hm.y; } }
      if (!hero.dead && hero.cd.ult <= 0) { const n = G.enemies.filter(e => e.hp > 0 && !e.fly && Math.hypot(H.posAt(map, e.prog, e.route).x - hero.x, H.posAt(map, e.prog, e.route).y - hero.y) < 110).length; const boss = G.enemies.some(e => e.hp > 0 && (e.boss || e.mini)); if (n >= 3 || boss) H.castUlt(); }
      if (H.spellOpen('arrows') && G.powerCd.arrows <= 0) { const al = G.enemies.filter(e => e.hp > 0 && !e.fly); if (al.length >= 4) { let bx = 0, by = 0, bn = 0; for (const e of al) { const p = H.posAt(map, e.prog, e.route); let n = 0; for (const o of al) { const q = H.posAt(map, o.prog, o.route); if (Math.hypot(p.x - q.x, p.y - q.y) < 90) n++; } if (n > bn) { bn = n; bx = p.x; by = p.y; } } if (bn >= 4) H.castPower('arrows', bx, by); } }
      if (H.spellOpen('fire') && G.powerCd.fire <= 0) { const b = G.enemies.find(e => e.hp > 0 && (e.boss || e.mini || e.dragon)); if (b) { const p = b.fly ? { x: b.x, y: b.y } : H.posAt(map, b.prog, b.route); H.castPower('fire', p.x, p.y); } }
      if (H.spellOpen('reinf') && G.powerCd.reinf <= 0 && G.enemies.some(e => e.hp > 0 && !e.fly && map.routes[e.route || 0].total - e.prog < 260)) H.castPower('reinf');
    }
    H.step();
  }
  return { id, rep, mult: L.mult, win: !!G.victory, door: Math.round(100 * G.doorHp / G.doorMax), wave: G.wave, waves: L.waves, asks, stalled: steps >= 90000 };
}
const PLAYSRC = play.toString();
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const pages = [];
  for (let i = 0; i < PAR; i++) { const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => console.log('PAGEERR', e.message)); await p.goto('file://' + path.resolve(__dirname, '../..', process.env.HOLDOR_HTML || 'beta/index.html'), { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.HOLDOR_GEN, { timeout: 30000 }); await p.evaluate(src => { window.play_ = eval('(' + src + ')'); }, PLAYSRC); pages.push(p); }
  const results = []; let qi = 0;
  await Promise.all(pages.map(async p => { while (qi < jobs.length) { const job = jobs[qi++]; const r = await p.evaluate(([j, l, t]) => play_(j, l, t), [job, LEARN, TLF]).catch(e => ({ id: job.id, rep: job.rep, err: String(e).slice(0, 200) })); results.push(r); } }));
  for (const id of ids) {
    const rs = results.filter(r => r.id === id).sort((x, y) => x.rep - y.rep), w = rs.filter(r => r.win), n = rs.length;
    const gw = w.length ? Math.round(w.reduce((s, r) => s + r.door, 0) / w.length) : 0, ga = Math.round(rs.reduce((s, r) => s + (r.win ? r.door : 0), 0) / n);
    console.log(`S${String(id).padStart(2)} m${(rs[0].mult || 0).toFixed(3)} ${w.length}/${n} gate(wins) ${String(gw).padStart(3)}% gate(all) ${String(ga).padStart(3)}%  [${rs.map(r => r.err ? 'ERR' : (r.win ? 'W' : 'L') + r.door + '@' + r.wave + '/' + r.waves + (r.stalled ? '!' : '')).join(' ')}] asks${rs[0].asks}`);
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(results));
  await browser.close();
})();
