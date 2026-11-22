#!/usr/bin/env node
/* HOLDOR RPG — balance simulation (A39). No browser: it requires src/rpg/js/80_balance.js and plays a knight from level 1 to 60.
   node src/rpg/tools/balance_sim.js [--dodge 0.4] [--seed 7] [--fights 4000] [--runs 4000] [--all] [--md] [--quick]
     --all     also the 0.2 / 0.6 dodgers (hazard + run length by skill)       --md  the markdown table for docs/rpg-balance.md
     --quick   fewer fights per level (the test uses it)                        --fights N  minimum fights per level for the hazard estimate
   Two layers:
     1. a level: fights of the hero against generic packs (hit-level, event-driven) until the level's xp is done → minutes at that level,
        hits to kill, gold in / out, potions, and the per-fight death hazard (after a death the "ghost" is reset and the fights go on,
        so every level gets a hazard estimate, as if the hero had survived);
     2. runs: a Monte Carlo of one PERMADEATH hero over the level table with those hazards → run length median / p90, level reached.
   Everything the hero owns comes from the balance formulas; the sim's own behaviour assumptions are in SIM below.
   Other agents' data files (12_mobs.js, 22_skills.js) are loaded if present and summarised in one line, never used for the numbers. */
'use strict';
const path = require('path');
const B = require(path.join(__dirname, '..', 'js', '80_balance.js'));
const K = B.K;
const SIM = {
  dodge: K.dodge,            // share of telegraphed (heavy) hits the player dodges — the "skill" knob
  fleeAt: 0.25, fleeP: 0.75, fleeRetry: 2,          // flee when hp < 25 % with an empty belt; sprint beats every mob, but the mobs get one more swing
  restBelow: 0.6, restTo: 0.9,                      // a careful player waits for regen before the next pack
  townSec: 30, townWhenPotions: 2, innWhenHp: 0.7,  // a town trip costs 30 s (fast travel to a found castle); refill when < 2 potions left; the inn heals when below 70 %
  upgradeTo: 3, reservePotions: 5,                  // every new item is taken to +3 when the purse allows (the "reasonable wants"), keeping gold for 5 potions
  bossEvery: 6,                                     // a region boss at the start of levels 6, 12, 18 …, with a full belt
  travelPerFight: 2.5,                              // seconds walking to the next pack, plus K.overheadSec per kill (loot, target)
  kindHp: [0.7, 1, 1.4], kindAtk: [1.2, 1, 0.9],    // three generic mob kinds: archer-like, swordsman, brute
  approach: [0.8, 2.0], atkJitter: [0.85, 1.15], firstHit: 0.3, skillStagger: 0.4, maxFightSec: 240,
};
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (rng, w) => { const t = w.reduce((a, b) => a + b, 0); let x = rng() * t, i = 0; while (i < w.length - 1 && x >= w[i]) { x -= w[i]; i++; } return i; };
const quant = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

/* ---- the hero: stats from the balance curves + the gear he has found (null slot = nothing) ---- */
const gearStat = (slot, fn) => slot ? fn(slot.lvl, slot.rar, slot.plus) : 0;
function heroStats(L, gear, cls) {
  const s = B.statsAt(L, cls), g = B.gear;
  return { lvl: L, hpMax: B.hp(L, s.vit) + gearStat(gear.a, g.armorHp),
    atk: B.atkOf(L, s, cls) + gearStat(gear.w, g.weaponAtk) + gearStat(gear.t, g.trinketAtk),
    def: B.def(L, s.vit) + gearStat(gear.a, g.armorDef), crit: B.critChance(s.agi) + (gear.t ? g.trinketCrit(gear.t.rar) : 0),
    nSk: B.skills.unlockAt.filter(u => L >= u).length };
}
const typicalGear = L => { const g = B.ref.gearAt(L); return { w: { ...g }, a: { ...g }, t: { ...g } }; };
function mkMob(L, kind, elite, boss) {
  const e = K.elite, b = K.boss;
  return { hp: B.mob.hp(L) * SIM.kindHp[kind] * (elite ? e.hpMul : 1) * (boss ? b.hpMul : 1), atk: B.mob.atk(L) * SIM.kindAtk[kind] * (elite ? e.atkMul : 1) * (boss ? b.atkMul : 1),
    def: B.mob.def(L), elite: !!elite, boss: !!boss, heavy: boss ? b.heavyShare : 1 - K.light.share, next: 0 };
}
function rollPack(L, rng) {
  const n = Math.min(B.aggro.maxPack(L), pick(rng, B.aggro.packW(L)) + 1), pack = [];
  for (let i = 0; i < n; i++) pack.push(mkMob(L, pick(rng, [1, 1, 1]), false));
  if (rng() < B.mob.eliteChance(L)) pack[pack.length - 1] = mkMob(L, 1, true);
  return pack;
}

/* ---- one fight, event-driven: the hero's basic hits + skills vs every mob's swings; potion at 35 %, flee at 25 % with an empty belt ---- */
function fight(P, pack, st, rng, o) {
  o = o || {}; const dodge = o.dodge != null ? o.dodge : SIM.dodge, useSkills = o.skills !== false;
  const mobs = pack.map(m => ({ ...m, next: SIM.approach[0] + rng() * (SIM.approach[1] - SIM.approach[0]) }));
  const sk = useSkills ? B.skills.unlockAt.slice(0, P.nSk).map((_, i) => SIM.firstHit + SIM.skillStagger * (i + 1)) : [];
  let t = 0, nextA = SIM.firstHit, potCd = 0, fleeAt = -9, hits = 0, kills = 0, dmg = 0, used = 0, died = false, fled = false;
  const alive = () => mobs.filter(m => m.hp > 0);
  const hitMob = (m, mul) => { let d = B.dmg(P.atk * mul, m.def); if (rng() < P.crit) d = Math.round(d * K.crit.mul); m.hp -= d; if (mul === 1) hits++; };
  while (t < SIM.maxFightSec) {
    const live = alive(); if (!live.length) break;
    let tM = Infinity, who = null; for (const m of live) if (m.next < tM) { tM = m.next; who = m; }
    let tS = Infinity, si = -1; for (let i = 0; i < sk.length; i++) if (sk[i] < tS) { tS = sk[i]; si = i; }
    t = Math.min(nextA, tS, tM);
    if (t === nextA) { hitMob(live[0], 1); nextA += K.atkTime; }
    else if (t === tS) { if (si === 1) for (const m of live) hitMob(m, B.skills.aoeMul); else hitMob(live[0], B.skills.mul); sk[si] = t + B.skills.cd; }
    else { const heavy = rng() < who.heavy; if (!(heavy && rng() < dodge)) { const d = B.dmg(who.atk * (heavy ? K.heavy.mul : K.light.mul), P.def); st.hp -= d; dmg += d; }
      who.next += K.mobAtkTime * (SIM.atkJitter[0] + rng() * (SIM.atkJitter[1] - SIM.atkJitter[0])); }
    for (const m of mobs) if (m.hp <= 0 && !m.counted) { m.counted = true; kills++; }
    if (st.hp <= 0) { died = true; break; }
    if (st.hp < B.potion.useAt * P.hpMax && st.potions > 0 && t >= potCd) { st.hp = Math.min(P.hpMax, st.hp + B.potion.s * P.hpMax); st.potions--; used++; potCd = t + B.potion.cd; }
    else if (st.hp < SIM.fleeAt * P.hpMax && st.potions === 0 && t - fleeAt > SIM.fleeRetry && alive().length) {
      fleeAt = t;   // the mobs get one more swing while the hero turns and sprints
      for (const m of alive()) { const heavy = rng() < m.heavy; if (!(heavy && rng() < dodge)) { const d = B.dmg(m.atk * (heavy ? K.heavy.mul : K.light.mul), P.def); st.hp -= d; dmg += d; } }
      if (st.hp <= 0) { died = true; break; }
      if (rng() < SIM.fleeP) { fled = true; break; }
    }
  }
  return { t, hits, kills, killed: mobs.filter(m => m.counted), dmg, used, died, fled, n: pack.length, elite: pack.some(m => m.elite), boss: pack.some(m => m.boss) };
}

/* ---- loot and shops ---- */
function loot(L, killed, st, rng, rec) {
  for (const m of killed) {
    const g = B.mob.gold(L, rng()) * (m.elite ? K.elite.goldMul : 1); st.gold += g; rec.goldIn.mobs += g;
    const q = Math.round(g * K.goldShare.quests); st.gold += q; rec.goldIn.quests += q;   // quests pay a steady share on top
    rec.xp += B.mob.xp(L) * (m.elite ? K.elite.xpMul : 1) / K.xpShare.mobs;   // quests pay their share of the xp alongside the kills
    if (rng() < B.drops.potion && st.potions < B.potion.max) { st.potions++; rec.potFound++; }
    if (rng() < B.drops.gear || (m.elite && rng() < B.drops.eliteGear)) {
      const it = { lvl: B.drops.gearLvl(L, rng()), rar: B.drops.rar(rng(), m.elite ? B.drops.eliteGearRarMin : 0), plus: 0 }, slot = 'wat'[pick(rng, [1, 1, 1])], cur = st.gear[slot];
      if (!cur || B.gear.score(it.lvl, it.rar) > B.gear.score(cur.lvl, cur.rar)) { if (cur) sell(cur, st, rec); st.gear[slot] = it; rec.gearChanged = true; } else sell(it, st, rec);
    }
  }
}
function sell(it, st, rec) { const v = B.prices.sell(it.lvl, it.rar); st.gold += v; rec.goldIn.sells += v; }
function town(L, st, P, rec, sec) {
  rec.t += sec == null ? SIM.townSec : sec;
  const price = B.prices.potionS(L); while (st.potions < B.potion.max && st.gold >= price) { st.gold -= price; st.potions++; rec.goldOut.potions += price; rec.potBought++; }
  if (st.hp < SIM.innWhenHp * P.hpMax && st.gold >= B.prices.inn(L)) { st.gold -= B.prices.inn(L); rec.goldOut.inn += B.prices.inn(L); st.hp = P.hpMax; }
}
function upgrade(L, st, rec) {
  const reserve = SIM.reservePotions * B.prices.potionS(L);
  for (let plus = 1; plus <= SIM.upgradeTo; plus++) for (const s of 'wat') { const it = st.gear[s]; if (!it || it.plus >= plus) continue; const c = B.prices.upgrade(L, plus); if (st.gold - c < reserve) continue; st.gold -= c; rec.goldOut.upgrades += c; it.plus = plus; rec.gearChanged = true; }
}
const newRec = () => ({ t: 0, xp: 0, kills: 0, fights: 0, deaths: 0, deathsNoPotion: 0, fled: 0, hits: 0, potUsed: 0, potBought: 0, potFound: 0, dmg: 0, goldIn: { mobs: 0, quests: 0, sells: 0, boss: 0 }, goldOut: { potions: 0, inn: 0, upgrades: 0 }, gems: 0, bossDeaths: 0, bossFights: 0, gearChanged: false, causes: [] });

/* ---- one pass through level L (xp 0 → xp(L)); st carries hp / potions / gold / gear; after a death the ghost resets and goes on ---- */
function levelPass(L, st, rng, o) {
  const rec = newRec(); let P = heroStats(L, st.gear, o.cls);
  const refresh = () => { if (rec.gearChanged) { const hpF = st.hp / P.hpMax; P = heroStats(L, st.gear, o.cls); st.hp = Math.min(P.hpMax, hpF * P.hpMax); rec.gearChanged = false; } };
  st.hp = Math.min(st.hp, P.hpMax);
  const onDeath = (f, hp0, pot0, chained) => { rec.deaths++; if (st.potions === 0) rec.deathsNoPotion++; rec.causes.push({ n: f.n, elite: f.elite, boss: f.boss, hurt: hp0 < 0.9, chained, pot0 }); st.hp = P.hpMax; st.potions = Math.max(st.potions, B.potion.start); };
  if (L % SIM.bossEvery === 0) {   // the region boss: full belt first, then the fight
    town(L, st, P, rec); const f = fight(P, [mkMob(L, 1, false, true)], st, rng, o); rec.t += f.t; rec.fights++; rec.bossFights++; rec.dmg += f.dmg; rec.potUsed += f.used;
    if (f.died) { onDeath(f, 1, st.potions + f.used, false); rec.bossDeaths++; } else if (!f.fled) { rec.xp += B.mob.bossXp(L); const g = B.mob.bossGold(L); st.gold += g; rec.goldIn.boss += g; rec.gems += B.drops.bossGemsRange[0] + Math.floor(rng() * (B.drops.bossGemsRange[1] - B.drops.bossGemsRange[0] + 1)); rec.kills++; }
    rec.t += SIM.townSec;
  }
  const need = B.xp(L); let chained = false;
  while (rec.xp < need) {
    if (st.potions < SIM.townWhenPotions && st.gold >= B.prices.potionS(L)) town(L, st, P, rec);
    if (st.hp < SIM.restBelow * P.hpMax) { const w = (SIM.restTo * P.hpMax - st.hp) / (B.regen.pct * P.hpMax) + B.regen.delay; rec.t += w; st.hp = SIM.restTo * P.hpMax; }
    const hp0 = st.hp / P.hpMax, pot0 = st.potions, wasChained = chained; chained = false;
    const f = fight(P, rollPack(L, rng), st, rng, o);
    rec.t += f.t; rec.fights++; rec.hits += f.hits; rec.kills += f.kills; rec.dmg += f.dmg; rec.potUsed += f.used; if (f.fled) rec.fled++;
    loot(L, f.killed, st, rng, rec); if (rec.gearChanged) upgrade(L, st, rec); refresh();
    if (f.died) onDeath(f, hp0, pot0, wasChained);
    else if (rng() < B.aggro.chain) { rec.t += K.overheadSec * f.kills * 0.5; chained = true; }   // the next pack is already on him: no rest
    else { const T = SIM.travelPerFight + K.overheadSec * f.kills; rec.t += T; st.hp = Math.min(P.hpMax, st.hp + Math.max(0, T - B.regen.delay) * B.regen.pct * P.hpMax); }
  }
  rec.P = P; return rec;
}

/* ---- layer 1: every level, repeated until the hazard estimate rests on ≥ minFights fights ---- */
function simLevels(o) {
  o = Object.assign({ dodge: SIM.dodge, seed: 7, minFights: 4000, cls: 'knight' }, o || {});
  const rng = mulberry(o.seed); const rows = []; let st = { hp: 1e9, potions: B.run.start.potions, gold: B.run.start.gold, gear: { w: { ...B.run.start.weapon } } };
  for (let L = 1; L < K.maxLvl; L++) {
    const recs = []; let fights = 0, carry = null, passes = 0;
    while (fights < o.minFights || passes < 2) { const s = JSON.parse(JSON.stringify(st)); if (s.hp > 1e8) s.hp = heroStats(L, s.gear, o.cls).hpMax; const r = levelPass(L, s, rng, o); recs.push(r); fights += r.fights; passes++; if (!carry) carry = s; if (passes > 5000) break; }
    const avg = f => mean(recs.map(f)), sec = recs.reduce((a, r) => a + r.t, 0), deaths = recs.reduce((a, r) => a + r.deaths, 0);
    const P = recs[0].P, typ = heroStats(L, typicalGear(L), o.cls);
    const gIn = avg(r => r.goldIn.mobs + r.goldIn.quests + r.goldIn.sells + r.goldIn.boss), gOut = avg(r => r.goldOut.potions + r.goldOut.inn + r.goldOut.upgrades);
    const bossFights = recs.reduce((a, r) => a + r.bossFights, 0);
    rows.push({ lvl: L, causes: [].concat(...recs.map(r => r.causes)), bossDeathRate: bossFights ? recs.reduce((a, r) => a + r.bossDeaths, 0) / bossFights : null, minutes: avg(r => r.t) / 60, kills: avg(r => r.kills), fights: avg(r => r.fights), passes, deathsPerHour: deaths / (sec / 3600), pDeath: deaths / fights,
      noPotionShare: deaths ? recs.reduce((a, r) => a + r.deathsNoPotion, 0) / deaths : 0, bossShare: deaths ? recs.reduce((a, r) => a + r.bossDeaths, 0) / deaths : 0,
      hitsTypical: B.hitsToKill(L, typ), hitsSim: B.mob.hp(L) / B.dmg(P.atk, B.mob.def(L)), hitsBare: B.mob.hp(L) / B.dmg(B.atk(L, B.statsAt(L, o.cls)[B.mainStat(o.cls)]), B.mob.def(L)),
      potUsed: avg(r => r.potUsed), potBought: avg(r => r.potBought), potFound: avg(r => r.potFound), fled: avg(r => r.fled), goldIn: gIn, goldOut: gOut,
      out: { potions: avg(r => r.goldOut.potions), inn: avg(r => r.goldOut.inn), upgrades: avg(r => r.goldOut.upgrades) }, gems: avg(r => r.gems), gold: carry.gold, gear: carry.gear, P });
    st = carry;
  }
  return rows;
}

/* ---- layer 2: permadeath runs over the level table — one hero until he dies (or reaches 60) ---- */
function simRuns(rows, o) {
  o = Object.assign({ runs: 4000, seed: 11, noise: 0.2 }, o || {});
  const rng = mulberry(o.seed), mins = [], lvls = [], gold = [], gems = [], sunk = [];
  const gauss = () => { const u = 1 - rng(), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  for (let i = 0; i < o.runs; i++) {
    let t = 0, lvl = K.maxLvl, g = 0, gm = 0, sk = 0;
    for (const r of rows) {
      const m = r.minutes * Math.exp(o.noise * gauss()), lam = r.deathsPerHour / 60, td = lam > 0 ? -Math.log(1 - rng()) / lam : Infinity;
      if (td < m) { t += td; lvl = r.lvl; const f = td / m; g += r.goldIn * f; gm += r.gems * f; sk += r.goldOut * f; break; }
      t += m; g += r.goldIn; gm += r.gems; sk += r.goldOut;
    }
    mins.push(t); lvls.push(lvl); gold.push(g); gems.push(gm); sunk.push(sk);
  }
  const reach = L => lvls.filter(x => x >= L).length / lvls.length;
  return { runs: o.runs, minutes: { median: quant(mins, 0.5), p90: quant(mins, 0.9), mean: mean(mins), p10: quant(mins, 0.1) }, level: { median: quant(lvls, 0.5), p90: quant(lvls, 0.9) },
    reach: Object.fromEntries([10, 15, 20, 30, 45, 60].map(L => [L, reach(L)])), gold: { earned: mean(gold), sunk: mean(sunk) }, gems: mean(gems) };
}

/* ---- the six-mob rule: a typical hero, one potion, six same-level swordsmen at once ---- */
function sixMob(L, o) {
  o = Object.assign({ trials: 400, seed: 3, skills: false, dodge: SIM.dodge }, o || {});
  const rng = mulberry(o.seed), P = heroStats(L, typicalGear(L), 'knight'); let ok = 0, hpLeft = 0;
  for (let i = 0; i < o.trials; i++) { const st = { hp: P.hpMax, potions: 1 }; const f = fight(P, [0, 1, 2, 3, 4, 5].map(() => mkMob(L, 1, false)), st, rng, { skills: o.skills, dodge: o.dodge }); if (!f.died && !f.fled) { ok++; hpLeft += st.hp / P.hpMax; } }
  return { lvl: L, survive: ok / o.trials, hpLeft: ok ? hpLeft / ok : 0 };
}

/* ---- summaries ---- */
const band = (rows, a, b) => rows.filter(r => r.lvl >= a && r.lvl <= b);
const hazardOf = rs => { const sec = rs.reduce((s, r) => s + r.minutes * 60 * r.passes, 0), d = rs.reduce((s, r) => s + r.deathsPerHour * r.minutes * 60 * r.passes / 3600, 0); return d / (sec / 3600); };
function summary(rows) {
  const cum = L => rows.filter(r => r.lvl < L).reduce((s, r) => s + r.minutes, 0);
  const gIn = rows.reduce((s, r) => s + r.goldIn, 0), gOut = rows.reduce((s, r) => s + r.goldOut, 0);
  const causes = [].concat(...rows.map(r => r.causes)), share = f => causes.length ? causes.filter(f).length / causes.length : 0;
  return { minutesTo: { 10: cum(10), 30: cum(30), 60: cum(60) }, targets: { 10: B.time.minutesTo(10), 30: B.time.minutesTo(30), 60: B.time.minutesTo(60) },
    causes: { n: causes.length, elite: share(c => c.elite), boss: share(c => c.boss), big: share(c => c.n >= 5), hurt: share(c => c.hurt), chained: share(c => c.chained), noPot: share(c => c.pot0 === 0), plain: share(c => !c.elite && !c.boss && c.n < 5 && !c.hurt && c.pot0 > 0) },
    hazard: { '1-9': hazardOf(band(rows, 1, 9)), '10-19': hazardOf(band(rows, 10, 19)), '20-39': hazardOf(band(rows, 20, 39)), '40-59': hazardOf(band(rows, 40, 59)), '20+': hazardOf(band(rows, 20, 59)) },
    noPotionShare: mean(rows.map(r => r.noPotionShare)), bossShare: mean(rows.map(r => r.bossShare)), bossDeathRate: Object.fromEntries(rows.filter(r => r.bossDeathRate != null).map(r => [r.lvl, r.bossDeathRate])),
    hits: { typical: mean(rows.map(r => r.hitsTypical)), sim: mean(rows.map(r => r.hitsSim)), bare: mean(rows.map(r => r.hitsBare)) },
    gold: { in: gIn, out: gOut, ratio: gIn / gOut, shares: { potions: rows.reduce((s, r) => s + r.out.potions, 0) / gOut, inn: rows.reduce((s, r) => s + r.out.inn, 0) / gOut, upgrades: rows.reduce((s, r) => s + r.out.upgrades, 0) / gOut } } };
}
function run(o) {
  o = o || {}; const rows = simLevels(o), s = summary(rows), runs = simRuns(rows, o);
  const six = [8, 10, 20, 30, 45, 60].map(L => ({ ...sixMob(L, { skills: false }), full: sixMob(L, { skills: true }).survive }));   // from level 8 a pack can be six
  return { rows, summary: s, runs, six };
}

/* ---- printing ---- */
const f1 = x => (Math.round(x * 10) / 10).toFixed(1), f2 = x => (Math.round(x * 100) / 100).toFixed(2), pc = x => Math.round(x * 100) + ' %';
function printTable(rows, every) {
  console.log('lvl  min/lvl  cum h   kills  hits(typ/sim/bare)  deaths/h  p(death)/fight  noPot  pot used/bought  gold in   gold out  ratio  gear');
  let cum = 0;
  for (const r of rows) { cum += r.minutes; if (every || [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 59].includes(r.lvl))
    console.log(String(r.lvl).padStart(3), f1(r.minutes).padStart(8), f1(cum / 60).padStart(6), String(Math.round(r.kills)).padStart(7), (f1(r.hitsTypical) + '/' + f1(r.hitsSim) + '/' + f1(r.hitsBare)).padStart(19),
      f2(r.deathsPerHour).padStart(9), (100 * r.pDeath).toFixed(2).padStart(10) + ' %', pc(r.noPotionShare).padStart(6), (f1(r.potUsed) + '/' + f1(r.potBought)).padStart(16), String(Math.round(r.goldIn)).padStart(9), String(Math.round(r.goldOut)).padStart(9), f2(r.goldIn / (r.goldOut || 1)).padStart(6),
      '  ' + 'wat'.split('').map(s => r.gear[s] ? r.gear[s].lvl + 'r' + r.gear[s].rar + '+' + r.gear[s].plus : '-').join(' ')); }
}
function printSummary(res, label) {
  const s = res.summary, r = res.runs;
  console.log(`\n== ${label} ==`);
  console.log('time to reach   L10 %s min (target %s)   L30 %s h (target %s)   L60 %s h (target %s)', f1(s.minutesTo[10]), s.targets[10], f1(s.minutesTo[30] / 60), f1(s.targets[30] / 60), f1(s.minutesTo[60] / 60), f1(s.targets[60] / 60));
  console.log('hits to kill    typical %s   sim (found gear) %s   bare %s', f2(s.hits.typical), f2(s.hits.sim), f2(s.hits.bare));
  console.log('deaths / hour   L1-9 %s   L10-19 %s   L20-39 %s   L40-59 %s   (20+ %s)   deaths with an empty belt %s, at a boss %s', f2(s.hazard['1-9']), f2(s.hazard['10-19']), f2(s.hazard['20-39']), f2(s.hazard['40-59']), f2(s.hazard['20+']), pc(s.noPotionShare), pc(s.bossShare));
  const c = s.causes; console.log('what killed     %d deaths: with an elite %s, a boss %s, a pack of 5-6 %s, entered hurt (< 90 %%) %s, a chained pull %s, empty belt at the start %s, none of these %s', c.n, pc(c.elite), pc(c.boss), pc(c.big), pc(c.hurt), pc(c.chained), pc(c.noPot), pc(c.plain));
  console.log('boss fights     death rate by level ' + Object.entries(s.bossDeathRate).map(([l, p]) => 'L' + l + ' ' + pc(p)).join('  '));
  console.log('gold            in %s   out %s   income / sinks %s   (potions %s, inn %s, upgrades %s of the sinks)', Math.round(s.gold.in), Math.round(s.gold.out), f2(s.gold.ratio), pc(s.gold.shares.potions), pc(s.gold.shares.inn), pc(s.gold.shares.upgrades));
  console.log('runs (%d)      minutes median %s  p90 %s  mean %s  p10 %s   level at death median %d p90 %d   reach L10 %s  L15 %s  L20 %s  L30 %s  L45 %s  L60 %s', r.runs, f1(r.minutes.median), f1(r.minutes.p90), f1(r.minutes.mean), f1(r.minutes.p10), r.level.median, r.level.p90, pc(r.reach[10]), pc(r.reach[15]), pc(r.reach[20]), pc(r.reach[30]), pc(r.reach[45]), pc(r.reach[60]));
  console.log('per run         gold earned %s  sunk %s  gems %s', Math.round(r.gold.earned), Math.round(r.gold.sunk), f1(r.gems));
  console.log('six at once     ' + res.six.map(x => `L${x.lvl} ${pc(x.survive)} (hp left ${pc(x.hpLeft)}; with skills ${pc(x.full)})`).join('   '));
}
function markdown(res) {
  const rows = res.rows, s = res.summary, r = res.runs, L = [1, 5, 10, 15, 20, 30, 45, 60];
  const cum = l => rows.filter(x => x.lvl < l).reduce((a, x) => a + x.minutes, 0);
  const out = ['| level | minutes at level (sim) | table | hours to reach (sim) | target | hits to kill (typical / found gear) | deaths per hour | income / sinks |', '|---|---|---|---|---|---|---|---|'];
  for (const l of L) { const x = rows.find(y => y.lvl === l) || rows[rows.length - 1]; const tgt = { 10: 40, 30: 360, 60: 2400 }[l];
    out.push(`| ${l} | ${l === 60 ? 'cap' : f1(x.minutes)} | ${l === 60 ? '—' : B.time.levelMinutes[l]} | ${f2(cum(l) / 60)} | ${tgt ? f2(tgt / 60) : '—'} | ${l === 60 ? '—' : f1(x.hitsTypical) + ' / ' + f1(x.hitsSim)} | ${l === 60 ? '—' : f2(x.deathsPerHour)} | ${l === 60 ? '—' : f2(x.goldIn / (x.goldOut || 1))} |`); }
  out.push('', `Runs (${r.runs} permadeath heroes, dodge ${SIM.dodge}): minutes median ${f1(r.minutes.median)}, p90 ${f1(r.minutes.p90)}, mean ${f1(r.minutes.mean)}; level at death median ${r.level.median}, p90 ${r.level.p90}; ` +
    `reach L10 ${pc(r.reach[10])}, L15 ${pc(r.reach[15])}, L20 ${pc(r.reach[20])}, L30 ${pc(r.reach[30])}, L45 ${pc(r.reach[45])}, L60 ${pc(r.reach[60])}; gold earned ${Math.round(r.gold.earned)} / sunk ${Math.round(r.gold.sunk)}, gems ${f1(r.gems)} per run.`,
    `Deaths per hour: L1–9 ${f2(s.hazard['1-9'])}, L10–19 ${f2(s.hazard['10-19'])}, L20+ ${f2(s.hazard['20+'])}; ${pc(s.noPotionShare)} of deaths with an empty belt, ${pc(s.bossShare)} at a boss. Income / sinks over the whole table ${f2(s.gold.ratio)}.`,
    `Six same-level mobs at once with one potion (basic attacks only): ` + res.six.map(x => `L${x.lvl} ${pc(x.survive)}`).join(', ') + '.');
  return out.join('\n');
}
function tryLoad() {   // other agents' data files, if this worktree has them: one line, never used for the numbers
  const g = globalThis; g.window = g.window || g; const R = g.R = g.R || {}; R.data = R.data || {}; R.bus = R.bus || { on() {}, off() {}, emit() {} }; R.addSys = R.addSys || (() => ({}));
  const notes = [];
  for (const f of ['12_mobs.js', '22_skills.js']) { const p = path.join(__dirname, '..', 'js', f); try { require(p); notes.push(f + ': loaded'); } catch (e) { notes.push(f + ': ' + (e.code === 'MODULE_NOT_FOUND' ? 'absent' : 'not loadable in Node (' + String(e.message).slice(0, 40) + ')')); } }
  if (R.data.mobs) notes.push('R.data.mobs: ' + Object.keys(R.data.mobs).length + ' kinds'); if (R.data.skills) notes.push('R.data.skills: ' + Object.keys(R.data.skills).length + ' entries');
  return notes.join('; ');
}
module.exports = { run, simLevels, simRuns, sixMob, summary, markdown, fight, heroStats, mkMob, SIM };

if (require.main === module) {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? +a[i + 1] : d; }, flag = k => a.includes('--' + k);
  const quick = flag('quick'), o = { dodge: arg('dodge', SIM.dodge), seed: arg('seed', 7), minFights: arg('fights', quick ? 800 : 4000), runs: arg('runs', quick ? 1000 : 4000) };
  const t0 = Date.now(); console.log('HOLDOR RPG balance sim — balance %s, dodge %s, ≥ %d fights per level, %d runs   [%s]', B.VERSION, o.dodge, o.minFights, o.runs, tryLoad());
  const res = run(o);
  if (flag('md')) { console.log(markdown(res)); } else { printTable(res.rows, flag('every')); printSummary(res, `dodge ${o.dodge}`); }
  if (flag('all')) for (const d of [0.2, 0.6]) { const r2 = run({ ...o, dodge: d }); printSummary(r2, `dodge ${d}`); }
  console.log('\n%d s', Math.round((Date.now() - t0) / 1000));
}
