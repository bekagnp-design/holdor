// HOLDOR RPG — A10 champions (heroes). Part 1: the module under a fake window/R in node (data, mapping, stats, import, portraits).
// Part 2: one Playwright load of the RPG build (built here into the scratch path, or RPG_HTML) — R.champs present, no page errors.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_champs.js   (NO_PW=1 skips part 2)
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = {}; const ok = (k, v, info) => { OUT[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
const load = () => {
  const win = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 390, innerHeight: 844 }; win.window = win; win.R = {};
  const code = fs.readFileSync(path.join(ROOT, 'src/rpg/js/14_champs.js'), 'utf8');
  vm.runInNewContext(code, win); return win.R;
};
(async () => {
  /* ---------- part 1: node ---------- */
  const R = load(), C = R.champs, list = R.data.champs, SK = R.data.champSkills, SIG = R.data.sigMap, KINDS = C.SIG_KINDS;
  const ids = list.map(c => c.id), houses = C.HOUSE_ORDER;
  ok('49 champions', list.length === 49 && new Set(ids).size === 49, list.length);
  ok('7 per house, tiers 0..6', houses.every(h => { const l = C.byHouse(h); return l.length === 7 && l.map(c => c.tier).join() === '0,1,2,3,4,5,6'; }));
  ok('fields', list.every(c => c.id && c.house && c.name && c.short && c.emoji && c.type && c.rar >= 0 && c.rar <= 4 && c.base && c.base.hp > 0 && c.base.atk > 0 && c.base.def > 0 && c.base.spd > 0 &&
    ['tank', 'dps', 'ranged', 'support'].indexOf(c.role) >= 0 && c.sig && c.sig.skill && c.sig.name && c.sig.cd > 0 && KINDS.indexOf(c.sig.kind) >= 0 && c.sig.v.length === 5 && c.sig.d && c.portrait === c.id + '_portrait'));
  ok('rarity 0..4 by tier, 5 names', list.every(c => c.rar === [0, 0, 1, 2, 2, 3, 4][c.tier] && c.rarName === C.RAR_N[c.rar]) && C.RAR_N.length === 5);
  /* the 100 skills and the mapping */
  const skIds = Object.keys(SK);
  ok('100 skills', skIds.length === 100, skIds.length);
  ok('100 mapped', skIds.every(k => SIG[k] && KINDS.indexOf(SIG[k].kind) >= 0 && SIG[k].d) && Object.keys(SIG).every(k => SK[k]), Object.keys(SIG).length);
  ok('5 ranks each', skIds.every(k => SK[k].v.length === 5 && SK[k].id === k));
  const kinds = C.kinds(); ok('kinds', Object.values(kinds).reduce((a, b) => a + b, 0) === 100 && Object.keys(kinds).every(k => KINDS.indexOf(k) >= 0), JSON.stringify(kinds));
  /* the old rule: no two champions share the signature (ultimate), no two share the skill pair; every signature is an old ultimate */
  const sigs = list.map(c => c.sig.skill), pairs = list.map(c => c.kit.slice(0, 2).sort().join('+'));
  ok('49 unique signatures', new Set(sigs).size === 49 && sigs.every(s => SK[s].ult), sigs.filter((s, i) => sigs.indexOf(s) !== i).join(','));
  ok('49 unique pairs', new Set(pairs).size === 49 && list.every(c => !SK[c.kit[0]].ult && !SK[c.kit[1]].ult));
  ok('kits = data.champKits', list.every(c => R.data.champKits[c.id] && R.data.champKits[c.id].join() === c.kit.join()));
  /* stats */
  let mono = true, bad = '';
  for (const c of list) { let p = C.statsAt(c.id, 1); for (let L = 2; L <= 60; L++) { const s = C.statsAt(c.id, L); if (!(s.hp > p.hp && s.atk >= p.atk && s.def >= p.def && s.spd === p.spd)) { mono = false; bad = c.id + '@' + L; } p = s; } }
  ok('statsAt monotonic 1..60', mono, bad);
  const j1 = C.statsAt('jon', 1), j60 = C.statsAt('jon', 60), b1 = C.statsAt('brienne', 1);
  ok('statsAt shape', j1.hp > 100 && j60.hp > j1.hp * 5 && j1.rank === 1 && j60.rank === 5 && b1.hp !== j1.hp, JSON.stringify([j1, j60]));
  ok('rankAt', [1, 14, 15, 29, 30, 44, 45, 59, 60].map(C.rankAt).join() === '1,1,2,2,3,3,4,4,5');
  /* Addendum 2: heroes */
  const types = C.types();
  ok('types = melee/ranged/caster', Object.keys(types).sort().join() === 'caster,melee,ranged' && types.melee + types.ranged + types.caster === 49, JSON.stringify(types));
  ok('cls', list.every(c => C.cls(c.id) === { melee: 'knight', ranged: 'ranger', caster: 'maester' }[c.type] && c.cls === C.cls(c.id)) && C.cls('jon') === 'knight' && C.cls('bronn') === 'ranger' && C.cls('tyrion') === 'maester' && C.cls('nobody') === null);
  const hb0 = C.heroBase('brienne', 30), hb4 = C.heroBase('jon', 30), hb4b = C.heroBase('dany', 60);
  ok('heroBase common +0', hb0 && hb0.hp === 0 && hb0.atk === 0 && hb0.def === 0 && hb0.crit === 0 && hb0.rar === 0, JSON.stringify(hb0));
  ok('heroBase legendary small', hb4 && hb4.rar === 4 && hb4.hp > 0 && hb4.atk > 0 && hb4.mul.hp <= 0.12 * 1.4 && hb4.mul.atk <= 0.12 * 1.4 && hb4.mul.def <= 0.12 * 1.4 && hb4.crit <= 0.12 && hb4.cls === 'knight', JSON.stringify(hb4));
  ok('heroBase grows with level', hb4b.hp > C.heroBase('dany', 1).hp && hb4b.atk >= C.heroBase('dany', 1).atk && C.heroBase('nobody', 1) === null, JSON.stringify(hb4b));
  ok('first(house) = tier 0 Common', houses.every(h => { const f = C.get(C.first(h)); return f && f.house === h && f.tier === 0 && f.rar === 0; }) && C.first('stark') === 'brienne' && C.first('martell') === 'areo', houses.map(C.first).join());
  ok('unlockText every champion', list.every(c => typeof C.unlockText(c.id) === 'string' && C.unlockText(c.id).length > 10 && c.unlock && c.unlock.kind && c.unlock.region) &&
    list.filter(c => c.tier === 0).every(c => c.unlock.kind === 'start') && list.filter(c => c.rar === 4).every(c => c.unlock.kind === 'boss' && /beyond the Wall/.test(c.unlock.text)) &&
    list.filter(c => c.tier <= 1).every(c => /start|near/.test(c.unlock.text)) && list.filter(c => c.rar === 1).every(c => /Uncommon/.test(c.unlock.text)), C.unlockText('jon'));
  /* tavern cost */
  ok('unlockCost', C.unlockCost('brienne').gold === 500 && C.unlockCost('jon').gems === 400 && C.unlockCost('bran').gold === 1500 && C.unlockCost('sansa').gold === 4000 && C.unlockCost('arya').gems === 120 && C.unlockCost('x') === null);
  /* signature numbers against the ARCH player formulas */
  const L = 20, hit = C.refAtk(L), hp = C.refHp(L);
  const sm = C.sigEffect('smash', 1, L), he = C.sigEffect('heal', 1, L), sh = C.sigEffect('shield', 1, L), kr = C.sigEffect('kraken', 3, L), oa = C.sigEffect({ skill: 'oath' }, 5, L);
  ok('aoe ≈ 2.5× basic hit', sm && sm.kind === 'aoe' && Math.abs(sm.dmg - 2.5 * hit) <= 1 && sm.radius > 0 && sm.stun === 2, JSON.stringify(sm));
  ok('heal 25% hp', he && he.kind === 'heal' && Math.abs(he.heal - 0.25 * hp) <= 1 && he.healPct === 0.25, JSON.stringify(he));
  ok('shield 30% for 4 s', sh && sh.kind === 'shield' && Math.abs(sh.shield - 0.3 * hp) <= 1 && sh.dur === 4, JSON.stringify(sh));
  ok('rank values', kr && kr.v === SK.kraken.v[2] && kr.stun === kr.v && kr.dur === kr.v && oa && oa.rank === 5 && oa.invuln && oa.dur === 9 && oa.shieldPct === 1, JSON.stringify([kr, oa]));
  ok('every sig resolves', skIds.every(k => { const e = C.sigEffect(k, 3); return e && e.kind && e.lvl === 30 && (e.dmg == null || e.dmg >= 0); }) && list.every(c => C.sigAt(c.id, 10) && C.sigAt(c.id, 10).kind === c.sig.kind) && C.sigEffect('nope', 1) === null);
  ok('describe', /\d/.test(C.describe('jon', 10)) && !/\{v\}/.test(C.describe('arya', 1)), C.describe('jon', 10));
  /* import an old save: the v4 container, an account alone, a server levels map */
  const acc = { house: 'stark', sel: 'jon', gold: 1234.6, gems: 80, campaign: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, copen: { arya: 1 }, champs: { jon: { lvl: 37, sk: [1, 1, 1] }, robb: { lvl: 1, sk: [1, 1, 1] }, sansa: { lvl: 61 }, dany: { lvl: 12 } } };
  const im = C.import({ v: 4, cur: 1, slots: [null, acc] });
  ok('import v4 save', im.ids.join() === 'brienne,robb,sansa,arya,jon,dany' && im.champs.jon.lvl === 37 && im.champs.sansa.lvl === 60 && im.champs.brienne.lvl === 1 && im.champs.arya.lvl === 1 && im.gold === 1235 && im.gems === 80 && im.house === 'stark', JSON.stringify(im));
  const im2 = C.import({ 'c:jon': 5, 'c:tyrion': 22, 'sk:jon:0': 3, 't:arrow': 4, 'c:ghost': 9 });
  ok('import levels map', im2.ids.join() === 'jon,tyrion' && im2.champs.tyrion.lvl === 22 && im2.champs.jon.lvl === 5, JSON.stringify(im2));
  const im3 = C.import({ house: 'martell', champs: { oberyn: { lvl: 3 } } });
  ok('import account', im3.ids.join() === 'areo,oberyn' && im3.champs.oberyn.lvl === 3 && C.import(null).ids.length === 0 && C.import({}).ids.length === 0, JSON.stringify(im3));
  const ta = C.toAcc(im); ok('toAcc', Object.keys(ta).length === 6 && ta.jon.unlocked === 1 && ta.jon.runs === 0 && ta.jon.lvl === 37);
  /* portraits: the extracted asset file if present, else the old game's built page */
  let artSrc = null, artText = '';
  for (const f of fs.existsSync(path.join(ROOT, 'src/rpg/assets')) ? fs.readdirSync(path.join(ROOT, 'src/rpg/assets')) : []) {
    const t = fs.readFileSync(path.join(ROOT, 'src/rpg/assets', f), 'utf8'); if (/A_CHAMP/.test(t) && /jon_portrait/.test(t)) { artSrc = 'assets/' + f; artText = t; break; }
  }
  if (!artSrc) for (const f of ['beta/index.html', 'index.html']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (/const CHAMP_ART=\{/.test(t)) { artSrc = f; artText = t; break; } }
  const noArt = artText ? ids.filter(id => !new RegExp('["\']?\\b' + id + '_portrait["\']?\\s*:').test(artText)) : ids;
  ok('49 portraits in ' + (artSrc || '?'), !!artSrc && noArt.length === 0, noArt.join(','));
  const noFrames = artText ? ids.filter(id => !new RegExp('["\']?\\b' + id + '["\']?\\s*:').test(artText) || !new RegExp('["\']?\\b' + id + '_attack["\']?\\s*:').test(artText)) : ids;
  ok('49 stance + attack sheets', !!artSrc && noFrames.length === 0, noFrames.join(','));
  ok('hasArt without art', C.hasArt('jon') === false);

  /* ---------- part 2: one Playwright load of the RPG build ---------- */
  let errors = [];
  if (process.env.NO_PW !== '1') {
    let html = process.env.RPG_HTML;
    if (!html) { html = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'holdor-rpg-')), 'index.html'); const b = spawnSync('python3', [path.join(ROOT, 'src/build_rpg.py'), html], { encoding: 'utf8' }); ok('build', b.status === 0 && fs.existsSync(html), (b.stdout + b.stderr).trim().split('\n').pop()); }
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
      page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/.test(m.text())) errors.push('C:' + m.text()); });
      await page.goto('file://' + path.resolve(html));
      await page.waitForFunction(() => window.R && R.champs && R.data && R.data.champs, { timeout: 20000 });
      const s = await page.evaluate(() => ({ n: R.data.champs.length, kits: Object.keys(R.data.champKits).length, sk: Object.keys(R.data.champSkills).length, first: R.champs.first('stark'), cls: R.champs.cls('jon'),
        hb: R.champs.heroBase('jon', 10), sig: R.champs.sigAt('jon', 30), st: R.champs.statsAt('arya', 60), houses: !!(R.data.houses && R.data.houses.stark && R.data.houses.stark.col), art: R.champs.hasArt('jon'), ver: R.VERSION }));
      ok('page: R.champs live', s.n === 49 && s.kits === 49 && s.sk === 100 && s.first === 'brienne' && s.cls === 'knight' && s.hb && s.hb.rar === 4 && s.sig && s.sig.kind === 'shield' && s.st && s.st.hp > 0 && s.houses && s.ver === '2.0.0', JSON.stringify(s));
      ok('page: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await browser.close();
    } catch (e) { ok('playwright', false, String(e.message || e).split('\n')[0]); }
  }
  /* ---------- report ---------- */
  for (const k in OUT) console.log(OUT[k].startsWith('OK') ? 'OK   ' + k + (OUT[k].length > 2 ? '  ' + OUT[k].slice(3) : '') : 'FAIL ' + k + '  ' + OUT[k].slice(5));
  console.log('KINDS ' + JSON.stringify(kinds) + '  TYPES ' + JSON.stringify(types));
  const fails = Object.keys(OUT).filter(k => OUT[k].startsWith('FAIL'));
  console.log(fails.length ? 'FAILS: ' + fails.join(', ') : 'ALL PASS (' + Object.keys(OUT).length + ')');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
