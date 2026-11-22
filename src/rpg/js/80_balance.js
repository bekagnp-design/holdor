/* HOLDOR RPG — R.data.balance (A39): every tunable number in one place, read by the other modules AT USE TIME.
   Runs in the browser (window.R) and in Node (src/rpg/tools/balance_sim.js requires it). Targets + the simulated table: docs/rpg-balance.md.
   80_ loads AFTER the data modules (12_mobs, 22_skills, 30_items …), so read it when you spawn / open a shop / pay, never at load time:
     const B = R.data.balance; const hpMul = B ? B.mob.hpMul(L) : 1 + 0.3 * (L - 1);   // keep a crude fallback for a partial build
   Design rules (each number below follows from one of these):
     1. the player's curves are the ARCH formulas (K.xp / hp / atk / def); +3 stat points a level, auto by class (K.auto);
     2. a same-level mob has the HP of K.hitsToKill basic hits by the REFERENCE player (a knight with typical gear: K.gear.lag levels
        behind, rarity K.gear.rar, +K.gear.plus) — so a same-level mob always dies in 4–6 hits whatever the level;
     3. a mob's basic hit takes K.sixBudget of (hp + one small potion) divided by the hits SIX mobs land before they die (40 % of the
        telegraphed heavy hits dodged) — six at once are survivable with one potion, and K.aggro.maxChasers = 6 makes that the worst case;
     4. a mob's XP is what makes level L take time.levelMinutes[L] (K.xpShare.mobs of the level's XP from kills, one kill per ref.killSec);
     5. prices are MINUTES OF FARMING at that level (K.priceMin); gold per kill is the ARCH 2–8 × level; everything a hero owns dies with him (run). */
(function (root) {
  const R = root.R = root.R || {}; R.data = R.data || {};
  const K = {
    maxLvl: 60,
    xp: [80, 45, 6], xpCubic: 0.15,  // xp to the next level = 80 + 45 L + 6 L² + 0.15 (L−1)³  (the ARCH quadratic; the cubic term keeps a mob's xp
                                     // rising to level 60 under the 40-hour target; xp(1) = 131; Σ 1..59 = 944 758 to reach 60)
    hp: [120, 18, 6],                // hp  = 120 + 18 L + 6 vit
    atk: [10, 2, 1.5],               // atk = 10 + 2 L + 1.5 main (str knight / agi ranger / int maester)
    def: [4, 1.2, 0.6],              // def = 4 + 1.2 L + 0.6 vit
    base: 5, ptsPerLevel: 3,
    auto: { knight: { str: 2, vit: 1 }, ranger: { agi: 2, vit: 1 }, maester: { int: 2, vit: 1 } },
    main: { knight: 'str', ranger: 'agi', maester: 'int' },
    crit: { base: 0.05, mul: 1.6, perAgi: 0.002, max: 0.5 },
    gear: { lag: 3, rar: 1, plus: 1, rarMul: [1, 1.15, 1.32, 1.55, 1.85], wAtk: 0.13, aDef: 0.45, aHp: 0.12, tAtk: 0.04, tCrit: 0.03, plusPct: 0.08, maxPlus: 5 },
    hitsToKill: 5, atkTime: 0.6, mobAtkTime: 1.2, mobDefK: 0.6,
    danger: { min: 0.9, at: 9, late: 0 },   // a mob's hit × danger(L): 0.9 at level 1 rising to 1 at level 9 (one skill, no armour yet), then 1 + late · (L − 9)
    light: { share: 0.4, mul: 0.6 }, heavy: { mul: 1.5 }, dodge: 0.4, sixBudget: 1.0, chain: 0.2, maxPack: 6,
    dpsMul: 1.5, overheadSec: 4, xpShare: { mobs: 0.75 }, goldShare: { quests: 0.2 },
    time: { first: 2, at: [[10, 40], [30, 360], [60, 2400]] },   // minutes at level 1; cumulative minutes to REACH level 10 / 30 / 60
    priceMin: { potionS: 0.6, potionL: 1.5, inn: 0.4, sell: 0.15 },   // consumables: minutes of farming at that level
    priceLvl: { upgrade: 0.08, upgradeGrow: 1.45 },                  // an upgrade: a share of the level's whole income (+1 = 8 %, each further + ×1.45; +1…+3 ≈ 36 % of a level)
    elite: { hpMul: 3.5, atkMul: 2, xpMul: 4, goldMul: 3, chance: [0.08, 0.004] },   // chance(L) = 0.08 + 0.004 L (10 % at 6, 20 % at 30, 32 % at 60): elites are the killers under permadeath
    boss: { hpMul: 15, atkMul: 1.8, heavyShare: 0.8, xpKills: 30, goldKills: 30 },   // ~30 s and the whole belt; about one hero in five dies at a boss
  };
  const cl = L => Math.max(1, Math.min(K.maxLvl, Math.round(+L || 1)));
  const r1 = x => Math.round(x * 10) / 10;
  const poly = (c, L) => c[0] + c[1] * L + c[2] * L * L;
  const B = { K, VERSION: '2.0.0' };
  /* ---- the player ---- */
  B.xp = L => { L = cl(L); return Math.round(poly(K.xp, L) + K.xpCubic * Math.pow(L - 1, 3)); };
  B.xpTotal = L => { let s = 0; for (let i = 1; i < cl(L); i++) s += B.xp(i); return s; };
  B.hp = (L, vit) => Math.round(K.hp[0] + K.hp[1] * cl(L) + K.hp[2] * (+vit || 0));
  B.atk = (L, main) => r1(K.atk[0] + K.atk[1] * cl(L) + K.atk[2] * (+main || 0));
  B.def = (L, vit) => r1(K.def[0] + K.def[1] * cl(L) + K.def[2] * (+vit || 0));
  B.mainStat = cls => K.main[cls] || 'str';
  B.statsAt = (L, cls) => { const a = K.auto[cls] || K.auto.knight, n = cl(L) - 1, s = { str: K.base, agi: K.base, int: K.base, vit: K.base }; for (const k in a) s[k] += a[k] * n; return s; };
  B.atkOf = (L, stats, cls) => B.atk(L, (stats || {})[B.mainStat(cls)]);
  B.critChance = agi => Math.min(K.crit.max, K.crit.base + K.crit.perAgi * Math.max(0, (+agi || 0) - K.base));
  B.dmg = (atk, def) => { atk = Math.max(0, +atk || 0); def = Math.max(0, +def || 0); return Math.max(1, Math.round(atk * atk / (atk + def || 1))); };
  B.mitigation = (atk, def) => (+def || 0) / ((+atk || 0) + (+def || 0) || 1);
  B.xpLevelMul = dl => dl >= 0 ? Math.min(1.5, 1 + 0.1 * dl) : Math.max(0, 1 + 0.08 * dl);   // dl = mob level − player level
  /* ---- gear budgets (what an item of that level is worth; 30_items may use them as its stat budget) ---- */
  const G = K.gear, rm = r => G.rarMul[Math.max(0, Math.min(4, r | 0))], pl = p => 1 + G.plusPct * Math.max(0, Math.min(G.maxPlus, p | 0));
  const refBare = L => { const s = B.statsAt(L, 'knight'); return { atk: B.atk(L, s.str), def: B.def(L, s.vit), hp: B.hp(L, s.vit) }; };
  B.gear = { lag: G.lag, rarMul: G.rarMul, plusPct: G.plusPct, maxPlus: G.maxPlus, score: (lvl, rar) => (lvl | 0) + 4 * (rar | 0),
    weaponAtk: (lvl, rar, plus) => r1(G.wAtk * refBare(lvl).atk * rm(rar) * pl(plus)),
    armorDef: (lvl, rar, plus) => r1(G.aDef * refBare(lvl).def * rm(rar) * pl(plus)),
    armorHp: (lvl, rar, plus) => Math.round(G.aHp * refBare(lvl).hp * rm(rar) * pl(plus)),
    trinketAtk: (lvl, rar, plus) => r1(G.tAtk * refBare(lvl).atk * rm(rar) * pl(plus)),
    trinketCrit: rar => Math.round(100 * G.tCrit * (1 + 0.5 * (rar | 0))) / 100 };
  /* ---- the reference player: a knight with typical gear, the yardstick for every mob number ---- */
  B.ref = {
    gearAt: L => ({ lvl: Math.max(1, cl(L) - G.lag), rar: G.rar, plus: cl(L) >= 5 ? G.plus : 0 }),
    player: (L, cls) => { cls = cls || 'knight'; L = cl(L); const s = B.statsAt(L, cls), g = B.ref.gearAt(L);
      return { lvl: L, cls, stats: s, gear: g, hp: B.hp(L, s.vit) + B.gear.armorHp(g.lvl, g.rar, g.plus), atk: r1(B.atkOf(L, s, cls) + B.gear.weaponAtk(g.lvl, g.rar, g.plus) + B.gear.trinketAtk(g.lvl, g.rar, g.plus)),
        def: r1(B.def(L, s.vit) + B.gear.armorDef(g.lvl, g.rar, g.plus)), crit: B.critChance(s.agi) + B.gear.trinketCrit(g.rar) }; },
    killSec: L => K.hitsToKill * K.atkTime / K.dpsMul + K.overheadSec,        // seconds per kill incl. walking + looting (skills over basic dps = dpsMul)
    killsPerMin: L => 60 / B.ref.killSec(L),
    killsPerLevel: L => B.time.levelMinutes[cl(L)] * B.ref.killsPerMin(L),
    hitsToKill: (L, p) => { p = p || B.ref.player(L); return B.mob.hp(L) / B.dmg(p.atk, B.mob.def(L)); } };
  /* ---- time: minutes a level should take, a cubic through K.time (first level 2 min; reach 10 at 40 min, 30 at 6 h, 60 at 40 h) ---- */
  const solve3 = (A, y) => { const M = A.map((r, i) => r.concat([y[i]])); for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; const t = M[i]; M[i] = M[p]; M[p] = t;
    for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c]; } } return [0, 1, 2].map(i => M[i][3] / M[i][i]); };
  const S = (n, p) => { let s = 0; for (let j = 0; j <= n; j++) s += Math.pow(j, p); return s; };   // Σ j^p, j = 0..n
  const tc = solve3(K.time.at.map(([T]) => [S(T - 2, 1), S(T - 2, 2), S(T - 2, 3)]), K.time.at.map(([T, m]) => m - K.time.first * (T - 1)));
  const minutesAt = L => { const j = cl(L) - 1; return Math.max(0.5, Math.round(10 * (K.time.first + tc[0] * j + tc[1] * j * j + tc[2] * j * j * j)) / 10); };
  B.time = { levelMinutes: [0], cubic: [K.time.first].concat(tc), targets: K.time.at.map(([T, m]) => ({ lvl: T, minutes: m })),
    minutesTo: L => { let s = 0; for (let i = 1; i < cl(L); i++) s += B.time.levelMinutes[i]; return Math.round(s * 10) / 10; },
    hoursTo: L => Math.round(B.time.minutesTo(L) / 6) / 10 };
  for (let L = 1; L <= K.maxLvl; L++) B.time.levelMinutes[L] = minutesAt(L);
  /* ---- mobs: multipliers (1 at level 1) + the reference numbers behind them ---- */
  const dangerK = L => { L = cl(L); const d = K.danger; return L >= d.at ? 1 + d.late * (L - d.at) : d.min + (1 - d.min) * (L - 1) / (d.at - 1); };
  const sixAttacks = () => K.hitsToKill * K.atkTime / K.dpsMul * 21 / K.mobAtkTime;                  // swings six mobs take while they die one by one (skills in use)
  const landedMul = () => K.light.share * K.light.mul + (1 - K.light.share) * (1 - K.dodge) * K.heavy.mul;   // expected damage per swing, in base hits
  const hitPct0 = () => K.sixBudget * (1 + B.potion.s) / (sixAttacks() * landedMul());               // share of the ref hp one base hit takes
  B.mob = {
    def: L => r1(K.mobDefK * refBare(L).def),
    hp: L => { const p = B.ref.player(L); return Math.max(1, Math.floor(K.hitsToKill * B.dmg(p.atk, B.mob.def(L)))); },
    hitPct: L => hitPct0() * dangerK(L),
    atk: L => { const p = B.ref.player(L), d = B.mob.hitPct(L) * p.hp, D = p.def; return r1((d + Math.sqrt(d * d + 4 * d * D)) / 2); },
    hpMul: L => B.mob.hp(L) / B.mob.hp(1),
    atkMul: L => B.mob.atk(L) / B.mob.atk(1),
    xp: L => Math.max(1, Math.round(K.xpShare.mobs * B.xp(L) / B.ref.killsPerLevel(L))),
    gold: (L, r) => Math.round(cl(L) * (2 + 6 * (r == null ? 0.5 : Math.max(0, Math.min(0.999, r))))),   // ARCH: 2–8 × level; pass R.rng() for a roll
    goldMean: L => 5 * cl(L),
    spd: { min: 90, max: 160 },
    light: K.light, heavy: K.heavy, atkTime: K.mobAtkTime,
    elite: K.elite, eliteChance: L => K.elite.chance[0] + K.elite.chance[1] * cl(L), boss: K.boss,
    bossXp: L => B.mob.xp(L) * K.boss.xpKills, bossGold: L => B.mob.goldMean(L) * K.boss.goldKills };
  B.hitsToKill = B.ref.hitsToKill;
  /* ---- the player's tools ---- */
  B.skills = { unlockAt: [1, 3, 8], mul: 2.2, cd: 8, aoeMul: 1.4, barSize: 3 };
  B.potion = { s: 0.35, l: 0.7, cd: 4, max: 5, start: 3, useAt: 0.5 };   // useAt: the hp share at which a careful player drinks (the HUD flashes the potion there)
  B.regen = { pct: 0.04, delay: 3, town: 0.15 };
  B.sprint = { walk: 170, spd: 240, maxSec: 4, regenSec: 5, inCombat: true, note: 'sprint outruns every mob (90–160 u/s): fleeing is a real choice under permadeath' };
  B.dodge = { iframes: 0.35, cd: 0.9, dist: 110, ref: K.dodge, telegraph: 0.5 };
  B.aggro = { radius: 230, leash: 700, packRadius: 140, maxChasers: K.maxPack, loseAfter: 5, get chain() { return K.chain; },
    maxPack: L => Math.min(K.maxPack, 2 + Math.floor(cl(L) / 2)),   // the biggest pack by level: 2 at level 1, 3 at 2–3, 4 at 4–5, 5 at 6–7, 6 from 8
    packW: L => { const k = Math.min(1, Math.max(0, (cl(L) - 1) / 29)); const a = [35, 35, 20, 7, 2.5, 0.5], b = [10, 25, 30, 20, 10, 5]; return a.map((w, i) => w + (b[i] - w) * k); } };   // weights for packs of 1..6, level 1 → 30+
  /* ---- drops ---- */
  B.drops = { potion: 0.05, gear: 0.06, mat: 0.25, gold: 1, rarW: [70, 22, 6.5, 1.3, 0.2], eliteGearRarMin: 1, eliteGear: 0.5, bossGearRarMin: 2, bossGemsRange: [3, 8], chestGemsRange: [1, 3], questGemsRange: [1, 5],
    heroUnlock: 0,   // heroes (champions) never drop: rescue quests and bosses unlock them, deterministically
    rar: (r, min) => { const w = B.drops.rarW, t = w.reduce((a, b) => a + b, 0); let x = (r == null ? 0.5 : r) * t, i = 0; while (i < 4 && x >= w[i]) { x -= w[i]; i++; } return Math.max(min | 0, i); },
    gearLvl: (mobL, r) => Math.max(1, Math.min(K.maxLvl, cl(mobL) + (r == null ? 0 : r < 0.25 ? -1 : r > 0.75 ? 1 : 0))) };
  /* ---- economy: prices are minutes of farming at that level ---- */
  const lvl = L => L != null ? cl(L) : cl((R.state && R.state.p && R.state.p.lvl) || 1);
  B.nice = n => { n = Math.max(1, Math.round(n)); const s = n < 50 ? 1 : n < 500 ? 5 : n < 5000 ? 10 : 50; return Math.max(1, Math.round(n / s) * s); };
  B.econ = { incomePerMin: L => B.ref.killsPerMin(L) * B.mob.goldMean(L) * (1 + K.goldShare.quests), killsPerMin: B.ref.killsPerMin, killsPerLevel: B.ref.killsPerLevel,
    minutes: (L, m) => B.nice(B.econ.incomePerMin(lvl(L)) * m) };
  const PM = K.priceMin, PL = K.priceLvl;
  B.econ.levelIncome = L => B.econ.incomePerMin(lvl(L)) * B.time.levelMinutes[lvl(L)];
  B.prices = { minutes: PM, levelShare: PL,
    potionS: L => B.econ.minutes(L, PM.potionS), potionL: L => B.econ.minutes(L, PM.potionL), inn: L => B.econ.minutes(L, PM.inn),
    upgrade: (L, plus) => B.nice(B.econ.levelIncome(L) * PL.upgrade * Math.pow(PL.upgradeGrow, Math.max(0, (plus | 0) - 1))),
    sell: (itemLvl, rar) => B.econ.minutes(itemLvl, PM.sell * Math.pow(2, Math.max(0, rar | 0))),
    revive: null,   // permadeath: no revive, in gold or gems
    gems: { potionL: 1, elixir: 3, premiumGear: 20, fastTravel: 1 } };
  B.sinks = { target: 1.3, shares: { potions: 0.3, upgrades: 0.45, inn: 0.05, other: 0.2 },
    notes: 'income ≈ 1.3 × the expected sinks; everything is per run: gold, gems and gear die with the hero, so sinks are consumables (potions, inn) and upgrades of gear that is lost anyway — never permanent account progress. Gems: bosses 3–8, chests 1–3, quests 1–5 per run; premium offers must be consumable (large potion 1, elixir 3) or a one-run item (20).' };
  /* ---- the run: one hero, permadeath ---- */
  B.run = { permadeath: true, revive: false,
    dies: ['lvl', 'xp', 'gold', 'gems', 'gear', 'inv', 'potions', 'skills'],
    stays: ['acc.world (found, flags, quests, bosses, killed)', 'acc.champs (unlocked heroes)', 'acc.hall', 'acc.titles', 'acc.ach', 'acc.best'],
    start: { lvl: 1, potions: B.potion.start, gold: 0, gems: 0, inheritance: 0, weapon: { lvl: 1, rar: 0, plus: 0 } },   // a hero arrives with his own common weapon
    goldLossOnDeath: 1,
    targets: { firstHeroLevel: [10, 15], runMinutes: [45, 90], deathsPerHourAt20: 0.5, dodge: K.dodge },
    hazard: { early: 0.7, late: 0.5 },   // expected deaths per hour of play (levels < 20 / 20+) for a player who dodges 40 % — the simulation checks these
    hallLine: ['hero', 'name', 'lvl', 'killer', 'at', 'played'],
    notes: 'A run is one hero from level 1 to his death. A careful first hero reaches level 10–15 in about an hour before a likely death; from level 20 a 40 %-dodger dies about once in two hours. Potions are the survival resource: most deaths happen with an empty belt, so the belt (5) and the town trips to refill it are the loop. Fleeing (sprint) is always possible. Level 60 is a legend, not a plan: at 0.5 deaths an hour the odds of 40 hours alive are near zero.' };
  R.data.balance = B;
  if (R.bus && R.bus.emit) R.bus.emit('balance', B);
  if (typeof module !== 'undefined' && module.exports) module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
