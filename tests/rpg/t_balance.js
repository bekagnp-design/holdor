// HOLDOR RPG — A39 balance test: the curves in Node, the simulation against its targets, the doc's numbers, and a Playwright load of the built page.
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_balance.js
//   HOLDOR_HTML=beta/index.html … skips the build and loads that page instead (the build goes to .shots/rpg_balance.html).
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const B = require(path.join(ROOT, 'src/rpg/js/80_balance.js'));
const SIM = require(path.join(ROOT, 'src/rpg/tools/balance_sim.js'));
const fails = []; let n = 0;
const ok = (c, msg) => { n++; if (!c) fails.push(msg); console.log((c ? 'ok   ' : 'FAIL ') + msg); };
const f2 = x => (Math.round(x * 100) / 100).toFixed(2), pc = x => Math.round(100 * x) + ' %';
const mono = (name, f, strict) => { let prev = f(1), good = true, at = 0; for (let L = 2; L <= 60; L++) { const v = f(L); if (strict ? !(v > prev) : !(v >= prev)) { good = false; at = L; break; } prev = v; } ok(good, name + (strict ? ' strictly' : '') + ' increasing over levels 1..60' + (good ? '' : ' (breaks at ' + at + ')')); };

/* ---- 1. the curves ---- */
ok(B.xp(1) === 131, 'xp(1) = 131 (80 + 45 + 6)');
ok(B.xpTotal(60) === 944758 && B.xpTotal(60) > 900000 && B.xpTotal(60) < 1000000, 'xp to reach 60 = 944 758, inside the 900k–1M band (' + B.xpTotal(60) + ')');
mono('xp(L)', B.xp, true); mono('hp(L, 5)', L => B.hp(L, 5), true); mono('atk(L, 5)', L => B.atk(L, 5), true); mono('def(L, 5)', L => B.def(L, 5), true);
mono('ref.player(L).hp', L => B.ref.player(L).hp, true); mono('ref.player(L).atk', L => B.ref.player(L).atk, true);
mono('mob.hp(L)', B.mob.hp, true); mono('mob.atk(L)', B.mob.atk, true); mono('mob.def(L)', B.mob.def, false); mono('mob.xp(L)', B.mob.xp, false);
mono('mob.hpMul(L)', B.mob.hpMul, true); mono('mob.atkMul(L)', B.mob.atkMul, true); mono('mob.goldMean(L)', B.mob.goldMean, true);
mono('time.levelMinutes[L]', L => B.time.levelMinutes[L], true);
mono('prices.potionS(L)', B.prices.potionS, false); mono('prices.upgrade(L, 1)', L => B.prices.upgrade(L, 1), false); mono('prices.inn(L)', B.prices.inn, false);
mono('gear.weaponAtk(L, 1, 0)', L => B.gear.weaponAtk(L, 1, 0), false); mono('gear.armorHp(L, 1, 0)', L => B.gear.armorHp(L, 1, 0), false);
ok(B.mob.hpMul(1) === 1 && B.mob.atkMul(1) === 1, 'mob multipliers are 1 at level 1');
ok(B.time.levelMinutes[1] === 2, 'level 1 takes 2 minutes (' + B.time.levelMinutes[1] + ')');
ok(Math.abs(B.time.minutesTo(10) - 40) <= 1 && Math.abs(B.time.minutesTo(30) - 360) <= 4 && Math.abs(B.time.minutesTo(60) - 2400) <= 24, 'time table reaches 10 / 30 / 60 at 40 min / 6 h / 40 h (' + B.time.minutesTo(10) + ' / ' + B.time.minutesTo(30) + ' / ' + B.time.minutesTo(60) + ')');
{ let lo = 9, hi = 0, bare = 0; for (let L = 1; L <= 60; L++) { const h = B.hitsToKill(L); lo = Math.min(lo, h); hi = Math.max(hi, h); bare = Math.max(bare, B.mob.hp(L) / B.dmg(B.atk(L, B.statsAt(L, 'knight').str), B.mob.def(L))); }
  ok(lo >= 4 && hi <= 6, 'a same-level mob dies in 4–6 reference hits at every level (' + f2(lo) + '–' + f2(hi) + ')'); ok(bare <= 7, 'without any gear at most 7 hits (' + f2(bare) + ')'); }
{ let good = true, prev = -1; for (let d = -14; d <= 10; d++) { const v = B.xpLevelMul(d); if (v < prev) good = false; prev = v; } ok(good && B.xpLevelMul(0) === 1 && B.xpLevelMul(-13) === 0 && B.xpLevelMul(9) === 1.5, 'xpLevelMul: 0 at −13, 1 at 0, 1.5 cap, non-decreasing'); }
ok(B.drops.heroUnlock === 0, 'drops.heroUnlock = 0 (heroes come from rescue quests and bosses)');
ok(B.drops.rar(0.5) === 0 && B.drops.rar(0.999) === 4 && B.drops.rar(0.1, 1) === 1, 'drops.rar: median common, top legendary, elite floor uncommon');
ok(B.run.permadeath === true && B.run.revive === false && B.prices.revive === null && B.run.dies.includes('gold') && B.run.start.potions === 3, 'run: permadeath, no revive, gold dies, 3 potions to start');
ok(B.aggro.maxPack(1) === 2 && B.aggro.maxPack(8) === 6 && B.aggro.maxChasers === 6 && B.aggro.packW(1).length === 6, 'aggro: packs of 2 at level 1, 6 from level 8, six chasers at most');
ok(B.prices.upgrade(10, 2) > B.prices.upgrade(10, 1) && B.prices.potionL(10) > B.prices.potionS(10) && B.prices.sell(10, 2) > B.prices.sell(10, 0), 'prices order: +2 > +1, large > small potion, rarer sells for more');
ok(B.dmg(20, 0) === 20 && B.dmg(20, 20) === 10 && B.dmg(0, 50) === 1, 'dmg(atk, def) = atk² / (atk + def), at least 1');

/* ---- 2. the simulation against the targets ---- */
const res = SIM.run({ minFights: 1500, runs: 2000, seed: 7 }); const s = res.summary, r = res.runs;
const within = (v, t, p) => Math.abs(v / t - 1) <= p;
ok(within(s.minutesTo[10], 40, 0.25) && within(s.minutesTo[30], 360, 0.25) && within(s.minutesTo[60], 2400, 0.25), 'sim pace within ±25 % of 40 min / 6 h / 40 h (' + f2(s.minutesTo[10]) + ' min / ' + f2(s.minutesTo[30] / 60) + ' h / ' + f2(s.minutesTo[60] / 60) + ' h)');
ok(s.hits.typical >= 4 && s.hits.typical <= 6 && s.hits.sim >= 3.5 && s.hits.sim <= 6, 'sim hits to kill: typical ' + f2(s.hits.typical) + ', with found gear ' + f2(s.hits.sim));
ok(res.six.every(x => x.full >= 0.85), 'six same-level mobs at once, one potion, skills in use: ≥ 85 % survive at every level (' + res.six.map(x => 'L' + x.lvl + ' ' + pc(x.full)).join(', ') + ')');
ok(s.hazard['20+'] >= 0.3 && s.hazard['20+'] <= 0.8, 'deaths per hour at level 20+ ≈ 0.5 for a 40 % dodger (' + f2(s.hazard['20+']) + ')');
ok(s.hazard['1-9'] >= 0.35 && s.hazard['1-9'] <= 1.3, 'deaths per hour at levels 1–9 between 0.35 and 1.3 (' + f2(s.hazard['1-9']) + ')');
ok(r.minutes.median >= 40 && r.minutes.median <= 100, 'run length median 40–100 min (' + f2(r.minutes.median) + ', p90 ' + f2(r.minutes.p90) + ', mean ' + f2(r.minutes.mean) + ')');
ok(r.reach[10] >= 0.4 && r.reach[10] <= 0.8 && r.reach[15] >= 0.25 && r.reach[15] <= 0.7, 'a first hero reaches level 10 in 40–80 % of runs, 15 in 25–70 % (' + pc(r.reach[10]) + ' / ' + pc(r.reach[15]) + ')');
ok(s.gold.ratio >= 1.05 && s.gold.ratio <= 1.6, 'gold income / sinks ≈ 1.3 (' + f2(s.gold.ratio) + '; potions ' + pc(s.gold.shares.potions) + ', upgrades ' + pc(s.gold.shares.upgrades) + ' of the sinks)');
ok(s.causes.elite >= 0.4, 'elites are the main killer (' + pc(s.causes.elite) + ' of deaths)');
ok(s.noPotionShare >= 0.05, 'potions matter: ' + pc(s.noPotionShare) + ' of deaths with an empty belt');

/* ---- 3. the doc agrees with the code and the sim ---- */
const docPath = path.join(ROOT, 'docs/rpg-balance.md'); const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
ok(doc.length > 500, 'docs/rpg-balance.md exists');
const m1 = doc.match(/xp\(1\)\s*=\s*(\d+)/); ok(m1 && +m1[1] === B.xp(1), 'doc says xp(1) = ' + (m1 && m1[1]) + ' = code');
const row = L => { const m = doc.match(new RegExp('^\\|\\s*' + L + '\\s*\\|(.*)$', 'm')); return m ? m[1].split('|').map(x => x.trim()) : null; };
const r60 = row(60), r10 = row(10);
ok(r60 && within(+r60[2], s.minutesTo[60] / 60, 0.15), 'doc table: hours to reach 60 ' + (r60 && r60[2]) + ' ≈ sim ' + f2(s.minutesTo[60] / 60));
ok(r10 && within(+r10[2] * 60, s.minutesTo[10], 0.15), 'doc table: hours to reach 10 ' + (r10 && r10[2]) + ' ≈ sim ' + f2(s.minutesTo[10] / 60));

/* ---- 4. the built page: R.data.balance in the browser equals Node ---- */
(async () => {
  let html = process.env.HOLDOR_HTML ? path.resolve(ROOT, process.env.HOLDOR_HTML) : null;
  if (!html) { const dir = path.join(ROOT, '.shots'); fs.mkdirSync(dir, { recursive: true }); html = path.join(dir, 'rpg_balance.html');
    const b = spawnSync('python3', [path.join(ROOT, 'src/build_rpg.py'), html], { encoding: 'utf8' }); ok(b.status === 0, 'build_rpg.py builds the page' + (b.status === 0 ? '' : ': ' + (b.stderr || b.stdout))); }
  if (fs.existsSync(html)) {
    const { chromium } = require('playwright');
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1243/chrome-linux64/chrome') ? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' : undefined);
    const browser = await chromium.launch({ executablePath: exe });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|supabase|telegram/i.test(m.text())) errors.push('C:' + m.text()); });
    await page.goto('file://' + html);
    const found = await page.waitForFunction(() => window.R && R.data && R.data.balance, null, { timeout: 20000 }).then(() => true).catch(() => false);
    ok(found, 'page exposes R.data.balance');
    if (found) {
      const v = await page.evaluate(() => { const Bb = R.data.balance; return { xp1: Bb.xp(1), tot: Bb.xpTotal(60), mobHp10: Bb.mob.hp(10), mobXp30: Bb.mob.xp(30), min60: Bb.time.minutesTo(60), pot: Bb.prices.potionS(10), up: Bb.prices.upgrade(20, 3), perma: Bb.run.permadeath, hero: Bb.drops.heroUnlock, ver: Bb.VERSION }; });
      ok(v.xp1 === 131 && v.xp1 === B.xp(1), 'page: R.data.balance.xp(1) === 131, same as Node and the doc');
      ok(v.tot === B.xpTotal(60) && v.mobHp10 === B.mob.hp(10) && v.mobXp30 === B.mob.xp(30) && Math.abs(v.min60 - B.time.minutesTo(60)) < 0.01 && v.pot === B.prices.potionS(10) && v.up === B.prices.upgrade(20, 3), 'page numbers equal Node: xp total ' + v.tot + ', mob hp(10) ' + v.mobHp10 + ', mob xp(30) ' + v.mobXp30 + ', potion(10) ' + v.pot + ', upgrade(20,+3) ' + v.up);
      ok(v.perma === true && v.hero === 0 && v.ver === '2.0.0', 'page: permadeath on, heroUnlock 0, balance 2.0.0');
    }
    ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }
  console.log(fails.length ? 'FAILS: ' + fails.length + ' of ' + n + '\n' + fails.join('\n') : 'ALL OK (' + n + ' checks)'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('FAILS: ' + e.message); process.exit(1); });
