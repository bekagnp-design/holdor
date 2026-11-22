# HOLDOR RPG — balance (v2.0.0, A39)

`R.data.balance` (`src/rpg/js/80_balance.js`) is the one place for the numbers: the player's curves, mob scaling, drop rates, prices,
the time table, sprint / regen / aggro, and the permadeath run. Every module reads it **at use time** (it loads after the data modules):

```js
const B = R.data.balance; const hp = B ? B.mob.hp(L) * kind.hpK : 95 * (1 + 0.3 * (L - 1));   // keep a crude fallback for a partial build
```

`src/rpg/tools/balance_sim.js` plays a knight from level 1 to 60 with these numbers (no browser) and prints the table below.
`tests/rpg/t_balance.js` checks the curves, the sim against the targets, this doc, and the built page.

## Targets

| target | result (sim, dodge 40 %) |
|---|---|
| level 10 at ~40 min, 30 at ~6 h, 60 at ~40 h of play | 45 min / 5.6 h / 35.3 h (−7 % … +13 %) |
| a same-level mob dies in 4–6 hits | 5.0 typical gear, 4.6 with found gear, 6.1 with none |
| six same-level mobs at once are survivable with one potion | 90–92 % with the three skills (0 % with basic attacks only: the skills are not optional) |
| gold income ≈ 1.3 × the expected sinks | 1.2–1.45 depending on the seed (potions ≈ 45 %, upgrades ≈ 55 % of the sinks) |
| permadeath: a careful first hero reaches 10–15 before a likely death (~1 h) | 65 % reach 10, 47 % reach 15; level at death median 12 |
| deaths per hour at level 20+ ≈ 0.5 for a 40 %-dodger | 0.49 (levels 1–9: 0.69, 10–19: 0.36) |
| an average run 45–90 min | median 70 min, p90 5.4 h, mean 2.2 h (a long tail of heroes that live past 20) |
| potions matter | 17 % of deaths with an empty belt; 45 % of all gold goes to potions |

## The rules behind the numbers

1. **The player** is the ARCH: xp to next = `80 + 45 L + 6 L² + 0.15 (L − 1)³` (xp(1) = 131; 944 758 xp to reach 60 — the cubic term is
   there so that a mob's xp keeps rising under the 40-hour target), hp = `120 + 18 L + 6 vit`, atk = `10 + 2 L + 1.5 main`,
   def = `4 + 1.2 L + 0.6 vit`; +3 points a level, auto by class (knight str 2 / vit 1, ranger agi, maester int).
   Damage = `atk² / (atk + def)`, at least 1; crit 5 % + 0.2 %/agi, ×1.6.
2. **A mob** of level L has the HP of **5 hits** by the reference player (a knight with typical gear: three levels behind, uncommon, +1)
   and `def = 0.6 ×` the bare knight's; `mob.hpMul(L)` / `atkMul(L)` are these numbers over level 1 (1 → 16.8 and 1 → 10.9).
3. **A mob's hit** is sized so that six mobs at once cost 100 % of (hp + one small potion) while they die one by one with the skills in
   use and 40 % of the heavy hits dodged (≈ 4.9 % of the reference hp per base hit; light hits ×0.6, heavy ×1.5). Levels 1–8 get
   ×0.9 → 1 (one skill, no armour) and packs are capped at 2 / 3 / 4 / 5 / 6 mobs by level (`aggro.maxPack`). Six chasers at most.
4. **Mob xp** is what makes level L take `time.levelMinutes[L]`: 75 % of the level's xp from kills at one kill per 6 s (3 s of fighting
   with skills, 4 s walking / looting), the rest from quests. 5 xp at level 1, 32 at 60. Gold 2–8 × level a kill (ARCH).
5. **Prices are minutes of farming at that level**: small potion 0.6 min, large 1.5, inn 0.4, selling a common item 0.15 (×2 per
   rarity). An upgrade is a share of the **level's** income: +1 = 8 %, each further + ×1.45 (+1…+3 ≈ 36 % of a level, +5 ≈ 1 level).
6. **Elites** (hp ×3.5, atk ×2, xp ×4, gold ×3) appear in 8 % + 0.4 %/level of packs; **bosses** hp ×15, atk ×1.8, 80 % heavy
   (dodgeable) hits: about half a minute and the whole belt, one hero in five dies at the first boss.
7. **Drops**: potion 5 %, gear 6 % (rarity 70 / 22 / 6.5 / 1.3 / 0.2 %), material 25 %; elites drop uncommon+ half the time, bosses
   rare+ and 3–8 gems; chests 1–3 gems, quests 1–5. `drops.heroUnlock = 0`: heroes come only from rescue quests and bosses.
8. **The run** (`balance.run`): one hero until he dies. Level, xp, gold, gems, gear, potions and skills die with him; the account keeps
   the world (found places, flags, quests, bosses), the unlocked heroes, the Hall, titles, achievements. A hero starts at level 1 with
   3 small potions, 0 gold and his common weapon; no revive in gold or gems (`prices.revive = null`). Gold and gem sinks are therefore
   per run: consumables and upgrades of gear that is lost anyway — never permanent progress.

Time table: minutes at level L follow a cubic through 2 min at level 1 and the cumulative targets 40 min / 360 min / 2400 min
(`time.cubic`): 2.0 → 4.4 (5) → 7.6 (10) → 15.7 (20) → 28.8 (30) → 64.9 (45) → 82.8 (50) → 124 (59). The brief's "25 min at level 50"
is incompatible with 40 hours to 60 and was dropped in favour of the cumulative targets.

## The simulated table

`node src/rpg/tools/balance_sim.js --fights 5000` (dodge 0.4; a knight with the gear he finds, potions at 50 %, flees at 25 % with an
empty belt, rests below 60 %, refills in town under 2 potions, upgrades every new item to +3, a region boss every 6 levels):

| level | minutes at level (sim) | table | hours to reach (sim) | target | hits to kill (typical / found gear) | deaths per hour | income / sinks |
|---|---|---|---|---|---|---|---|
| 1 | 2.5 | 2 | 0.00 | — | 5.0 / 5.3 | 0.53 | 5.94 |
| 5 | 4.5 | 4.4 | 0.27 | — | 5.0 / 4.4 | 0.10 | 1.23 |
| 10 | 7.6 | 7.6 | 0.75 | 0.67 | 5.0 / 4.9 | 0.46 | 1.23 |
| 15 | 10.1 | 11.2 | 1.45 | — | 5.0 / 4.6 | 0.04 | 1.56 |
| 20 | 13.8 | 15.7 | 2.44 | — | 5.0 / 4.2 | 0.30 | 5.54 |
| 30 | 26.3 | 28.8 | 5.57 | 6.00 | 5.0 / 4.6 | 0.67 | 1.43 |
| 45 | 57.9 | 64.9 | 15.30 | — | 5.0 / 4.7 | 0.48 | 1.15 |
| 60 | cap | — | 35.26 | 40.00 | — | — | — |

Runs (4000 permadeath heroes, dodge 0.4): minutes median 69.9, p90 325.9, mean 131.8; level at death median 12, p90 29;
reach L10 65 %, L15 47 %, L20 36 %, L30 9 %, L45 0 %, L60 0 %; gold earned 159 220 / sunk 88 650, gems 8.8 per run.

What kills (782 deaths): an elite in the pack 86 %, a boss 13 %, a pack of 5–6 72 %, entered hurt (< 90 %) 25 %, a chained pull 24 %,
empty belt at the moment of death 17 %. Boss death rate: level 6 14 %, 12 13 %, 24 13 %, later 4–8 % (found gear).

Skill is the stat: a 20 %-dodger dies ≈ 1.9 times an hour (median run 20 min, 17 % reach level 10); a 60 %-dodger ≈ 0.08 times an
hour (median run ≈ 10 h, 70 % reach 30, 7 % reach 60). Level 60 is a legend, not a plan.

## Reading the API

```
B.xp(L) B.xpTotal(L) B.hp(L,vit) B.atk(L,main) B.def(L,vit) B.statsAt(L,cls) B.atkOf(L,stats,cls) B.critChance(agi) B.dmg(atk,def) B.xpLevelMul(mobL−L)
B.mob.{hp,atk,def,xp,hpMul,atkMul,gold(L,r),goldMean,eliteChance,elite,boss,bossXp,bossGold,spd}   B.hitsToKill(L, player?)
B.gear.{weaponAtk,armorDef,armorHp,trinketAtk}(lvl,rar,plus) B.gear.trinketCrit(rar) B.gear.{rarMul,plusPct,maxPlus,score}
B.time.{levelMinutes[L],minutesTo(L),hoursTo(L),targets}   B.econ.{incomePerMin,levelIncome,killsPerMin,killsPerLevel}
B.prices.{potionS,potionL,inn}(L?) B.prices.upgrade(L,plus) B.prices.sell(lvl,rar) B.prices.gems   B.nice(n)
B.drops.{potion,gear,mat,rarW,rar(r,min),gearLvl(mobL,r),eliteGearRarMin,bossGearRarMin,bossGemsRange,chestGemsRange,questGemsRange,heroUnlock}
B.skills B.potion B.regen B.sprint B.dodge B.aggro.{radius,leash,packRadius,maxChasers,maxPack(L),packW(L),chain}   B.sinks B.run   B.K (the raw knobs)
```
