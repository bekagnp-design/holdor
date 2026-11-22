// t_mobs.js — R.data.mobs (src/rpg/js/12_mobs.js): every old enemy is a mob with a real sprite, stats grow with the level,
// a same-level common dies in 4–7 reference hits and hits for ~6 % of the player's hp (×0.7 at level 1), elites ×3 / bosses ×12, pick() honours weights.
// Part 1 runs in Node with a fake window (no browser needed). Part 2 opens the built RPG page in Chromium and spawns a mob through the core.
// usage: node tests/rpg/t_mobs.js            RPG_HTML=<built page> to point part 2 at a page; otherwise beta/index.html when it is an RPG build,
//        otherwise `python3 src/build_rpg.py .shots/rpg_mobs.html` when the build script exists, otherwise part 2 is skipped (SKIP line, not a failure).
const fs = require('fs'), path = require('path'), vm = require('vm'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const MOBS_JS = path.join(ROOT, 'src', 'rpg', 'js', '12_mobs.js');
const BASE = path.join(ROOT, 'src', 'base', 'index.v1.0.44.html');
let fails = 0, n = 0;
const ok = (c, name, detail) => { n++; if (c) console.log('OK   ' + name); else { fails++; console.log('FAIL ' + name + (detail != null ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); } };

/* ---------- part 1: Node ---------- */
global.window = { R: { data: {}, rng: (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })() } };
vm.runInThisContext(fs.readFileSync(MOBS_JS, 'utf8'), { filename: MOBS_JS });
const R = window.R, M = R.data.mobs, keys = R.mobs.keys;
ok(M && keys.length >= 40, 'module registers R.data.mobs (' + keys.length + ' keys)');

// every old enemy (ENEMY_CFG of the old build) is a mob, and every mob's sprite is one of those keys
const cfgSrc = fs.readFileSync(BASE, 'utf8').match(/const ENEMY_CFG=(\{[^;]*\});/);
const CFG = cfgSrc ? JSON.parse(cfgSrc[1]) : null;
ok(CFG && Object.keys(CFG).length === 34, 'old ENEMY_CFG read from src/base (' + (CFG ? Object.keys(CFG).length : 0) + ' sprites)');
if (CFG) {
  const noSprite = keys.filter(k => !CFG[M[k].sprite]);
  ok(!noSprite.length, 'every mob has a sprite in ENEMY_CFG', noSprite);
  const missing = Object.keys(CFG).filter(k => !M[k]);
  ok(!missing.length, 'every old enemy key is a mob', missing);
  const liveBeta = '/home/user/holdor/beta/index.html';
  try { const m2 = fs.readFileSync(liveBeta, 'utf8').match(/const ENEMY_CFG=(\{[^;]*\});/); if (m2) ok(JSON.stringify(JSON.parse(m2[1])) === JSON.stringify(CFG), 'the live beta build has the same ENEMY_CFG'); } catch (e) {}
}
const variants = ['bandit', 'bandit_archer', 'raider', 'spearwife', 'direwolf', 'brownbear'];
ok(variants.every(k => M[k] && M[k].tint && CFG && CFG[M[k].sprite]), 'the 6 RPG-only variants exist with a tint and an old sprite', variants.map(k => k + ':' + (M[k] ? M[k].sprite + '/' + M[k].tint : 'none')));
ok(M.direwolf.role === 'elite' && M.direwolf.size === 1.5 && M.brownbear.sprite === 'hound' && M.brownbear.size === 1.6, 'direwolf is an elite hound ×1.5, the brown bear a hound ×1.6');

// shape
const ROLES = ['melee', 'ranged', 'caster', 'healer', 'summoner', 'brute', 'fly', 'elite', 'boss'];
const badShape = keys.filter(k => { const m = M[k], b = m.base; return !(m.name && m.sprite && m.arch && ROLES.indexOf(m.role) >= 0 && b && b.hp > 0 && b.atk > 0 && b.def >= 0 && b.spd >= 90 && b.spd <= 160 && b.r >= 10 && b.aggro >= 260 && b.aggro <= 420 && b.range >= 36 && b.atkCd > 0 && m.scale && m.scale.hp > 1 && m.scale.atk > 1 && Array.isArray(m.traits) && m.xp > 0 && m.gold.length === 2 && m.drops && m.drops.potion >= 0 && (m.tier === 'boss' || (m.tier >= 1 && m.tier <= 5))); });
ok(!badShape.length, 'every mob has the full shape (base, scale, traits, xp, gold, drops, tier; spd 90–160, aggro 260–420)', badShape);
const rangedBad = keys.filter(k => (M[k].role === 'ranged' || M[k].role === 'caster' || M[k].traits.indexOf('ranged') >= 0) && !(M[k].base.range >= 220 && M[k].base.range <= 300));
ok(!rangedBad.length, 'ranged / caster mobs shoot from 220–300', rangedBad);
const meleeBad = keys.filter(k => M[k].role === 'melee' && !(M[k].base.range >= 36 && M[k].base.range <= 56));
ok(!meleeBad.length, 'melee range 36 (reach / mounted up to 56)', meleeBad);
ok(M.lord.tier === 'boss' && M.king.tier === 'boss' && M.dragon.tier === 'boss' && R.mobs.list().indexOf('king') < 0 && R.mobs.list('boss').length === 3, 'bosses are tier "boss" and not in the common list');
const needTraits = { necro: 'raise', skin: 'heal', chief: 'haste', archer: 'ranged', raven: 'fly', walker: 'fall', giant: 'stagger', crypt: 'split', brood: 'summon', berserk: 'enrage', spider: 'web', cat: 'stealth', wraith: 'ghostly', shield: 'shielded', hound: 'pack' };
const noTrait = Object.keys(needTraits).filter(k => M[k].traits.indexOf(needTraits[k]) < 0 || !M[k].p[needTraits[k]]);
ok(!noTrait.length, 'the old mechanics are traits with parameters (raise, heal, haste, ranged, fly, fall, stagger, split, summon, …)', noTrait);
ok(M.walker.traits.indexOf('undead') < 0 && M.axe.traits.indexOf('undead') >= 0 && M.bandit.traits.indexOf('undead') < 0, 'wights are undead, walkers and the living are not');
ok(M.axe.res.holy === 1.5 && M.wraith.res.phys === 0.45 && M.bandit.res.phys === 1, 'resistances follow the traits');

// monotonic in level, for every key
const LV = []; for (let L = 1; L <= 60; L++) LV.push(L);
const nonMono = [];
for (const k of keys) { let prev = null; for (const L of LV) { const s = R.mobs.statsAt(k, L); if (prev && !(s.hp > prev.hp && s.atk > prev.atk && s.def > prev.def && s.xp > prev.xp && s.gold[1] >= prev.gold[1])) { nonMono.push(k + '@' + L); break; } prev = s; } }
ok(!nonMono.length, 'hp, atk, def, xp grow strictly with the level for all ' + keys.length + ' keys (1–60)', nonMono);
ok(R.mobs.statsAt('axe', 1).hp === M.axe.base.hp && R.mobs.statsAt('axe', 1).atk === M.axe.base.atk, 'base equals statsAt(key, 1)');
ok(Math.abs(M.axe.scale.hp - R.mobs.statsAt('axe', 2).hp / M.axe.base.hp) < 0.01, 'scale is the real level 1 → 2 growth');

// balance: hits to kill and hit share at 1, 10, 25, 45, 60
const CHECK = [1, 10, 25, 45, 60];
const commons = keys.filter(k => ['melee', 'ranged', 'caster', 'healer', 'summoner', 'fly'].indexOf(M[k].role) >= 0);
const hitsBad = [];
for (const k of commons) for (const L of CHECK) { const h = R.mobs.hitsToKill(k, L); if (h < 4 || h > 7) hitsBad.push(k + '@' + L + '=' + h); }
ok(!hitsBad.length, 'every common (' + commons.length + ' keys) dies in 4–7 reference hits at levels ' + CHECK.join('/'), hitsBad);
const pctBad = [];
for (const L of CHECK) for (const k of ['axe', 'bandit', 'crawler']) { const s = R.mobs.statsAt(k, L), want = 100 * R.mobs.hitPctAt(L); if (Math.abs(s.hitPct - want) > 1) pctBad.push(k + '@' + L + '=' + s.hitPct + ' (want ' + want.toFixed(1) + ')'); }
ok(!pctBad.length, 'a plain melee hit takes ~6 % of the reference player\'s hp (4.2 % at level 1, the gentle start) at every checked level', pctBad);
ok(Math.abs(R.mobs.hitPctAt(1) - 0.042) < 0.001 && R.mobs.hitPctAt(8) === 0.06 && R.mobs.hitPctAt(60) === 0.06, 'hit share ramps ×0.7 → ×1 over levels 1–8');
// "×3 hp" is effective: an elite takes 3× the reference hits of a common (its raw hp is also shaped by its def multiplier),
// "×1.5 atk" is the share of the player's hp one hit takes (the formula is super-linear in atk, so raw atk is ×1.35)
const eliteBad = [];
for (const L of CHECK) { const a = R.mobs.statsAt('axe', L); for (const k of keys.filter(k => M[k].role === 'elite')) { const e = R.mobs.statsAt(k, L); const pr = e.hitPct / a.hitPct / M[k].am; if (!(M[k].hm === 3 && e.hits === 3 * a.hits && pr > 0.92 && pr < 1.08)) eliteBad.push(k + '@' + L + ' hits ' + e.hits + '/' + a.hits + ' hit% ' + e.hitPct + '/' + a.hitPct); } }
ok(!eliteBad.length, 'elites: ×3 hits to kill, one hit ×1.5 (am) of a common\'s share at every checked level', eliteBad);
const bossBad = [];
for (const L of CHECK) for (const k of ['lord', 'king', 'dragon']) { const b = R.mobs.statsAt(k, L), a = R.mobs.statsAt('axe', L); if (!(M[k].hm === 12 && b.hits >= 11 * a.hits && b.hits <= 12 * a.hits && b.hitPct >= 1.9 * a.hitPct)) bossBad.push(k + '@' + L + ' hits ' + b.hits + '/' + a.hits + ' hit% ' + b.hitPct); }
ok(!bossBad.length, 'bosses: ×12 hits to kill, one hit ≥×2 of a common\'s share (tier boss)', bossBad);
const xp1 = R.mobs.statsAt('axe', 1).xp, xp60 = R.mobs.statsAt('axe', 60).xp, need = L => 80 + 45 * L + 6 * L * L;
ok(need(1) / xp1 >= 8 && need(1) / xp1 <= 14 && need(60) / xp60 >= 14 && need(60) / xp60 <= 24, 'a level takes ~10 same-level kills at 1 and ~18 at 60', [need(1) / xp1, need(60) / xp60].map(v => v.toFixed(1)));
const g = R.mobs.statsAt('axe', 7).gold; ok(g[0] === 14 && g[1] === 56, 'gold 2–8 × level for a common', g);
ok(R.mobs.statsAt('king', 10).drops.gem === 1 && R.mobs.statsAt('axe', 10).drops.gem == null, 'gems drop only from bosses');

// tiers
ok([1, 2, 3, 4, 5].every(t => R.mobs.list(t).length >= 2) && R.mobs.list(1).length >= 8, 'every tier 1–5 has mobs (' + [1, 2, 3, 4, 5].map(t => R.mobs.list(t).length).join('/') + ')');
ok(R.mobs.tierFor(1) === 1 && R.mobs.tierFor(9) === 2 && R.mobs.tierFor(25) === 3 && R.mobs.tierFor(40) === 4 && R.mobs.tierFor(60) === 5, 'tierFor maps the level bands');
ok(LV.every(L => R.mobs.forLevel(L).length >= 5 && R.mobs.forLevel(L).indexOf('king') < 0), 'forLevel gives ≥5 non-boss keys at every level 1–60');
ok(R.mobs.tableFor(50).some(r => r.key === 'walker' && r.w === 1) && R.mobs.tableFor(50).some(r => r.key === 'giant' && r.w === 1), 'tableFor(lvl): this tier at full weight, the previous at half');

// pick(): weights, forms, unknown keys, zero weights
let s0 = 5; const rng = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; };
const N = 30000, cnt = {}; for (let i = 0; i < N; i++) { const k = R.mobs.pick([['axe', 6], ['archer', 3], ['hound', 1], ['king', 0]], rng); cnt[k] = (cnt[k] || 0) + 1; }
ok(Math.abs(cnt.axe / N - 0.6) < 0.02 && Math.abs(cnt.archer / N - 0.3) < 0.02 && Math.abs(cnt.hound / N - 0.1) < 0.015 && !cnt.king, 'pick() respects weights (array form), weight 0 never comes', cnt);
const cnt2 = {}; for (let i = 0; i < N; i++) { const k = R.mobs.pick({ sword: 1, spider: 3 }, rng); cnt2[k] = (cnt2[k] || 0) + 1; }
ok(Math.abs(cnt2.spider / N - 0.75) < 0.02 && !Object.keys(cnt2).some(k => k !== 'sword' && k !== 'spider'), 'pick() with an object map', cnt2);
const cnt3 = {}; for (let i = 0; i < 2000; i++) { const k = R.mobs.pick([{ key: 'wolf', w: 2 }, 'bat', { key: 'nosuchmob', w: 50 }], rng); cnt3[k] = (cnt3[k] || 0) + 1; }
ok(cnt3.wolf > cnt3.bat && !cnt3.nosuchmob && !cnt3.null, 'pick() with {key,w} and plain strings; unknown keys dropped', cnt3);
ok(R.mobs.pick([], rng) === null && R.mobs.pick({ axe: 0 }, rng) === null, 'pick() of nothing is null');
ok(R.mobs.pick(R.mobs.tableFor(1), rng) != null, 'pick(tableFor(1)) gives a key');
let r1, r2; R.rng && (window.R.rng = (() => { let s = 3; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })()); r1 = R.mobs.pick(R.mobs.tableFor(20)); window.R.rng = (() => { let s = 3; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(); r2 = R.mobs.pick(R.mobs.tableFor(20));
ok(r1 === r2, 'pick() without rng uses R.rng (deterministic)');

// make() → an entity in the ARCH shape
const e = R.mobs.make('hound', 4, 100, 200);
ok(e && e.kind === 'mob' && e.type === 'hound' && e.team === 1 && e.hp === e.hpMax && e.hp === R.mobs.statsAt('hound', 4).hp && e.lvl === 4 && e.x === 100 && e.ai && e.cd && e.status && e.anim === 'idle' && e.traits.indexOf('pack') >= 0 && e.p.pack.n === 3, 'make() builds a mob entity with stats, traits and params', e && Object.keys(e));
ok(R.mobs.make('king', 30).kind === 'boss' && R.mobs.make('nosuch', 1) === null, 'make(): bosses are kind boss, unknown keys null');
ok(R.mobs.describe('necro').length === 3 && /raises/.test(R.mobs.describe('necro').join(' ')), 'describe() gives short trait lines');

// balance table
console.log('\n' + R.mobs.table([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]) + '\n');
const roleLine = ROLES.map(r => r + ':' + keys.filter(k => M[k].role === r).length).join(' ');
console.log('roles  ' + roleLine);
console.log('tiers  ' + [1, 2, 3, 4, 5, 'boss'].map(t => 'T' + t + ' ' + R.mobs.list(t).join(',')).join('\n       '));

/* ---------- part 2: the built page in Chromium ---------- */
(async () => {
  let pw = null; try { pw = require('playwright'); } catch (e) {}
  let FILE = process.env.RPG_HTML || '';
  const isRpg = f => { try { return /\/\* ==== js\/12_mobs\.js ==== \*\//.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; } };
  if (!FILE) { const beta = path.join(ROOT, 'beta', 'index.html'); if (isRpg(beta)) FILE = beta; }
  if (!FILE && fs.existsSync(path.join(ROOT, 'src', 'build_rpg.py'))) { fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true }); const out = path.join(ROOT, '.shots', 'rpg_mobs.html'); const r = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), out], { encoding: 'utf8' }); if (r.status === 0 && isRpg(out)) FILE = out; else console.log('build_rpg.py: ' + (r.stderr || r.stdout || '').trim()); }
  if (!pw || !FILE) { console.log('SKIP browser part: ' + (!pw ? 'playwright not installed' : 'no RPG build (set RPG_HTML or add src/build_rpg.py)')); return done(); }
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', x => errors.push('PE:' + x.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|net::|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto('file://' + FILE);
  const booted = await page.waitForFunction(() => window.R && R.data && R.data.mobs && R.mobs, null, { timeout: 15000 }).then(() => true).catch(() => false);
  ok(booted, 'the built page registers R.data.mobs (' + path.relative(ROOT, FILE) + ')');
  if (booted) {
    const r = await page.evaluate(() => {
      const out = { keys: R.mobs.keys.length, hasSpawn: !!R.spawn, core: !!(R.bus && R.step) };
      const s = R.mobs.statsAt('axe', 10); out.axe10 = [s.hp, s.atk, s.hits];
      if (R.spawn) { const e = R.mobs.spawn('axe', 3, 300, 300); out.spawned = !!(e && e.id && R.ents.indexOf(e) >= 0); try { for (let i = 0; i < 60; i++) R.step(); out.stepped = true; } catch (x) { out.stepped = x.message; } out.alive = !!(e && !e.dead && e.hp === e.hpMax); }
      const A = window.A_ENEMY; out.assets = !!(A && (A.cfg || A.CFG));
      if (out.assets) { const cfg = A.cfg || A.CFG; out.noSprite = R.mobs.keys.filter(k => !cfg[R.data.mobs[k].sprite]); }
      out.pick = R.mobs.pick(R.mobs.tableFor(12));
      return out;
    });
    ok(r.keys >= 40 && r.axe10[2] === 5, 'statsAt works in the page', r.axe10);
    if (r.hasSpawn) ok(r.spawned && r.stepped === true && r.alive, 'R.mobs.spawn() puts a mob into R.ents and 60 core steps run', r); else console.log('note: R.spawn absent (core not in this build), spawn not checked');
    if (r.assets) ok(!r.noSprite.length, 'every mob sprite is in A_ENEMY.cfg', r.noSprite); else console.log('note: A_ENEMY (A04) not in this build; sprites checked against the old ENEMY_CFG in part 1');
    ok(typeof r.pick === 'string', 'pick(tableFor(12)) in the page', r.pick);
  }
  ok(!errors.length, 'no page errors', errors.slice(0, 5));
  await browser.close();
  done();
})().catch(e => { ok(false, 'browser part threw', e.message); done(); });

function done() { console.log(fails ? `FAILS: ${fails} of ${n}` : `ALL PASS (${n})`); process.exit(fails ? 1 : 0); }
