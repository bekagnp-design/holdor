# HOLDOR 2.0 — design document (action RPG)

2026-11-22. The decisions here are MR B's; the technical contract every module follows is `src/rpg/ARCH.md` (read it first,
including its **Addendum 2** of 15:10, which overrides the older text where they differ; where this document and ARCH.md
differ, ARCH.md wins and this file is corrected). English is the working language of the code and of this file; the
owner reads `docs/roadmap.md` and `docs/todo-mr-b.md` in Georgian.

## 1. Vision
HOLDOR is a Game of Thrones–themed action RPG in one HTML file, opened as a Telegram Mini App. The player **is one of his
champions**: Jon, Arya, Robb, … — the 49 champions of the old game, unlocked one by one. He walks a 3D Westeros built from
the game's own map art, seen from a third-person camera behind the hero, and the land grows harder with distance from his
house's seat: through the home region to the Wall and beyond it to the Lands of Always Winter. Combat is real time on a
phone (joystick, attack, dodge, three skills); the old enemies are the mobs and the bosses; other players are visible on
the same map with a chat per zone. **Death is permanent for the hero:** his gold, gems, gear and level die with him, his
name goes to the Hall of the Fallen, and the player picks the next hero — but what the account has found, opened and
turned in on the map stays. Sword Art Online is a mechanics reference only (an open world with level gates, boss doors,
skills, permadeath stakes); nothing is copied from it, and no line of the books or the show is quoted. Every number the
player sees is real: his save or the server.

## 2. The owner's decisions (2026-11-22)
Morning:
1. **Real-time action combat** — the player moves and fights himself; no waves, no placing, no auto-battle.
2. **Tower defense removed** — stages, towers, spells, Mastery, Trials, Houses Clash and the Hold are gone from the client.
   Their sources stay in `src/` as an archive (see §13).
3. **Open map, gated by level** — one continuous Westeros; regions have level bands and a gate order; nothing is a "stage".
4. **Other players on the map + a zone chat** — presence (position, hero, level, title) and a chat per region, via Supabase.
5. **Gold, gems and champions carry over** — the old wallet and the unlocked champions are imported once at the first login.
6. **Release straight to Telegram** — v2.0.0 goes to the root `index.html` after the test suite, like every release.

Addendum 2 (15:10), overriding the morning's "own character + companions":
7. **3D world.** A three.js terrain (MIT, vendored as `src/rpg/vendor/three.min.js`): a heightmap from the Westeros art,
   textured with the map art and roads; a third-person camera behind the hero (yaw by a right-side drag, pitch ~35°,
   distance 420 units, pinch to zoom 300–700). Heroes, mobs, NPCs and other players are billboard sprites of the old art;
   POIs are low-poly meshes (castle = towers + walls + a banner in the house colour, camp = tents + fire, shrine = a
   weirwood). The WebGL canvas `#gl` sits under the 2D canvas `#c`, which stays the overlay for VFX, numbers, name tags,
   telegraphs and the minimap; `R.w2s(x, y, z = 0)` becomes the 3D projection so every 2D module keeps working.
8. **One hero, no companions. Heroes = champions.** The player is one of his unlocked champions; a new account starts
   with its house's first champion. Class from the champion's type: melee → knight, ranged → ranger, mage → maester. The
   hero's sprite is the champion's stance / attack sheets.
9. **Permadeath.** When the hero dies the run ends: a line in the Hall of the Fallen (name, level, killer, time), titles
   and achievements stay, the player picks the next hero from the unlocked champions (new ones come from rescue quests
   and bosses). Gold, gems, gear, level and XP die with the hero. World progress — regions discovered, gates opened,
   quests turned in, POIs found — belongs to the **account** and stays.
10. **The old wallet funds the first hero** (its gold and gems) and unlocks the champions it had.
11. **Open-source code** may be copied only under MIT / BSD / Apache licences, with the licence header kept.
12. The owner's UI rule holds everywhere: one dominant primary button per screen, readable in one glance, ≥ 44 px
    targets, no walls of text, English UI text, dark fantasy palette with the house colour as the accent.

## 3. The loop
- **One minute:** walk a road, meet a pack of two to four mobs, fight (attack, dodge the telegraphed blow, a skill when it
  is up), pick up the drops and the gold, read the numbers (XP, gold, an item card), drink a potion if low, move on. The
  quest tracker on the HUD says where the next thing is; the camera is turned with the right thumb when the road bends.
- **One session (10–20 minutes):** one or two steps of a quest chain, one place found (a castle, a camp, a shrine), one
  level or two, a shop or inn visit, perhaps a dungeon run or a world event, a line in the zone chat. The save is written
  on every change and at the end.
- **One run (a hero's life):** from the hero pick to his death. Early runs are short and teach the regions; a long run is
  the achievement. Death costs the hero's gold, gems, gear and level, never the map: the next hero starts at level 1 at
  the house's seat with the account's gates already open, found castles on the map and turned-in quests not repeated.
- **One week:** a new region's gate opened (level reached + its boss killed), a new champion rescued, a gear set
  completed on the living hero, titles earned, a longer line in the Hall, a place on the leaderboard (best level, kills);
  world events rotate on their timers; the main story moves one region further north.

## 4. Systems
Each section follows the module(s) that own it in ARCH.md. Numbers that tune the game live in one place,
`js/80_balance.js` (`R.data.balance`), and the other modules read them from there.

### 4.1 World (`10_world.js`, `11_world_data.js`, `08_render.js`, `62_ambience.js`)
- World units = pixels of `src/assets/westeros_1200.webp` (1200×2048) × 6 → 7200×12288 units on the ground plane; north
  is up. Entities keep 2D coordinates (x, y); the renderer reads the terrain height.
- Terrain: a heightmap built from the map art (sea 0, lowlands, hills; the Vale, the Frostfangs and the Red Mountains
  high; snow in the north), textured with the map art + roads. Sea, lakes and mountain ridges block movement (a 60×102
  mask, `#` = blocked) — the mask and the heightmap agree.
- Nine regions as polygons with a level band and a biome; the hero starts at `HOUSES[h].seat`; the regions around the
  seats are low level; difficulty grows with distance toward the Wall and beyond it (the last region, the Lands of Always
  Winter, level 50+). A region's gate opens at its level with its boss killed — on the account, once.
- POIs are real Game of Thrones places at their map positions: castles, towns, camps, dungeons (portals), shrines, drawn
  as low-poly meshes. Roads are polylines; mobs spawn from per-region tables around the hero (`R.world.spawnAround`).
- Undiscovered land is under fog; a POI is "found" when the hero reaches it (account-wide), and fast travel to found
  castles opens on the map screen.
- Day/night cycle, weather by biome (snow north, rain, sand), biome tint, fireflies; display only.

### 4.2 Combat (`20_combat.js`, `13_bosses.js`, `60_vfx.js`, `61_sfx.js`)
- Fixed 60 steps per game second (`R.step()`); the camera follows the hero (`R.cam.yaw`, pitch fixed, distance zoomable).
  Hero speed 170 u/s (sprint 240), mobs 90–160.
- `R.hit(src, tgt, dmg, o)` applies defence and crit, emits `hit`, shows the number; damage kinds phys / fire / ice /
  holy; options knockback, stun, dot. Status effects: stun, slow, burn, bleed, shield.
- Mobs are the old enemy keys (axe, sword, archer, hound, walker, giant, …) with behaviour melee / ranged / caster /
  summoner / fly / boss; AI state machine idle → patrol → chase → attack → flee; aggro by distance and damage; ranged
  projectiles; death drops loot and emits `kill`.
- Dodge gives i-frames; the hero's attack is a short combo; every skill has a cooldown ring. With permadeath the
  telegraphs are generous and readable: nothing kills from full HP without a visible wind-up.
- Nine region bosses with phases and telegraphed attacks (circles / lines drawn on the overlay before the blow) and a
  boss bar; a boss kill opens the region gate on the account and counts in `acc.world.bosses`.
- Visual feedback on the 2D overlay: damage numbers, slashes, auras, blood/ash, screen shake, telegraph circles; audio is
  WebAudio synth only (no files): hits, swings, spells, UI, ambience per biome, boss drums.

### 4.3 Progression (`21_player.js`, `80_balance.js`, `55_levelup.js`)
- Per hero: levels 1–60, XP to the next level `80 + 45·L + 6·L²`, +3 stat points per level (str / agi / int / vit; auto
  by class unless assigned in the level-up popup). hp = 120 + 18·L + 6·vit; atk = 10 + 2·L + 1.5·(str | agi for the
  ranger | int for the maester); def = 4 + 1.2·L + 0.6·vit. Mob stats scale from the region's level band.
- Per account: titles, achievements, the Hall of the Fallen, world progress, `acc.best` (best level, most kills). The
  leaderboard ranks accounts by these, never a dead hero's gold.
- Death (`56_death.js`): the run ends; the death screen shows the killer and the hero's line as it enters the Hall, then
  the hero picker. No gold-loss respawn, no revive in v2.0.0.

### 4.4 Skills (`22_skills.js`)
- Three classes × six skills (knight: melee and shields; ranger: bows, traps, speed; maester: fire, ice, holy). The
  class comes from the champion's type. Three skills on the bar; a new skill unlocks by level through the level-up card;
  ranks come from skill points (`p.spts`) and quest rewards. Every skill: cooldown, effect, telegraph; no mana in v2.0.0.

### 4.5 Heroes (`14_champs.js`, `52_intro.js`, `56_death.js`; replaces the companions of the morning plan)
- The 49 champions (ids as before: jon, arya, robb, …) are the playable heroes; `acc.champs[id]` holds unlocked and runs.
  A new account starts with its house's first champion; others are unlocked by rescue quests (an NPC champion held in a
  camp or dungeon) and by bosses. Unlocks are account-wide and permanent.
- The hero's stats are the class formulas plus the champion's own bias from its old kit (`R.data.champs`); its signature
  skill from the old kit is its fourth, class-independent skill candidate. The hero draws from the champion's stance /
  attack sheets (`R.draw.champ`); the code-drawn hero of `06_hero_art.js` is the fallback when a sheet is missing.
- There are no companions in v2.0.0 (`23_companions.js` is not part of the build); co-op with other players is v2.1.

### 4.6 Items (`30_items.js`, `31_inventory.js`, `32_loot.js`)
- Kinds: weapon, armor, trinket, potion, mat. Rarity 0–4, an item level, stats {atk, def, hp, spd, crit}, optional set.
  `R.items.roll(lvl, rar)` makes drops; sell prices by rarity and level.
- Gear slots: weapon, armor, trinket. Inventory + character sheet in one screen (equip, sell, compare). Everything in
  `p.inv` and `p.gear` dies with the hero.
- Drops lie on the ground with a pickup radius; chests are objects (dungeons, hidden places); gold and gems burst toward
  the hero.

### 4.7 Quests, story, dialog (`40_quests.js`, `41_story.js`, `42_dialog.js`)
- A main chain across the regions (the house against the long night, original lines) + side quests per POI; rescue
  quests unlock champions. States: open → done → turned (turn-in at the NPC). Types: kill N, collect N, reach, talk to.
- Quest state is the account's (`acc.world.quests`): a new hero continues where the last one died, but an open kill /
  collect count may restart since its items died with the hero.
- A tracker slot on the HUD shows the active quest and its count; the quest log screen lists all. NPC dialog: portrait,
  typed text, choices; `R.ui.open('dialog', npc)`.

### 4.8 Towns (`43_towns.js`)
- At castles and towns: the shop (gear and potions for gold, a premium tab for gems), the inn (heal for gold, a save
  point), the smith (upgrade an item's level for gold and mats). Stock is by region level and seeded daily.

### 4.9 Dungeons (`44_dungeons.js`)
- Three instanced dungeons entered by portals: a layout, waves, a chest, a mini-boss. Level-banded; the first clear is
  an account milestone, later clears pay the hero. Solo in v2.0.0 (co-op is v2.1).

### 4.10 Events (`45_events.js`)
- World events on timers with a banner: a wight horde marching on a road, a dragon's shadow (a chase and a chest), a
  merchant caravan (rare stock). Client-timed in v2.0.0; a calendar on the server is v2.4.

### 4.11 Achievements (`46_achievements.js`)
- Kills by type, bosses, places found, levels reached, gold earned, quests turned, runs survived past N minutes, heroes
  lost; each grants a title shown in the name tag; a toast on unlock. Account-wide (`acc.ach`, `acc.titles`, `acc.title`).

### 4.12 Presence and chat (`70_net.js`, `71_presence.js`, `backend/holdor_v40.sql`)
- Login with Telegram `initData` through the existing `login` RPC. The save (`v:2`, `acc` + `p`) goes to `rpg_saves`
  (debounced; also `localStorage 'holdor_rpg'` for guests and offline). Presence: a periodic ping with position, hero,
  level and title; the others in the region are drawn as billboards with name tags (positions only — no shared combat).
- Zone chat: one channel per region, the same rules as the old realm chat (block / report / mute, banned words, **no
  Telegram ids on anything public**). A leaderboard screen (best level, kills, titles) marks the player's own row as
  `mine`, never by id.
- Backend v40 adds tables `rpg_saves`, `rpg_presence`, `rpg_chat` and their RPCs (save/load, presence ping + list, chat
  send + list), security definer like the rest, tested first in `backend/test/` (`v40_test.py`). Additive: nothing of
  v1–v39 is dropped.

### 4.13 Telegram (`54_menu.js`, `70_net.js`)
- `telegram-web-app.js`: expand, BackButton closes the current screen, haptics on hits and UI, MainButton where a screen
  has one action, a share link (`startapp=`) for inviting; `?v=N` on the URL is bumped by the owner in BotFather.
- The client carries only the Supabase URL and the publishable key (copied from `src/base/index.v1.0.44.html`). No bot
  token anywhere.

## 5. Economy
- **Gold sources (per hero):** mobs (2–8 × level), quest rewards, selling items, chests, the caravan event.
- **Gold sinks:** shop gear and potions, the inn, smith upgrades, (fast travel if balance enables a fee) — and death,
  which takes everything the hero carried. Gold therefore never piles up on an account; spending it well is the game.
- **Gems** (the old dragonglass, imported 1:1 to the first hero): only from bosses, chests and quests; spent in the
  premium tab (rare stock, potion bundles). Gems die with the hero too. Gems buy nothing a patient player cannot earn.
- **Account value** that survives death: unlocked champions, titles, achievements, the Hall, world progress.
- **Telegram Stars — later, nothing implemented in v2.0.0.** The v9 packs and the Edge Function `stars` stay on the
  server untouched and the RPG client does not show them. v2.3 may sell with Stars: cosmetics (skins, name colours,
  titles), inventory slots, and at most one capped second chance per run if the owner decides it fits permadeath.
  **No pay-to-win:** no power, items, gold or champions for Stars.
- The imported wallet is recorded once (`R.state.wallet.imported`) so the import can never run twice.

## 6. Deliberately out of v2.0.0
- **PvP** — v2.2 (an arena in the Crownlands); until then players never damage each other.
- **Guilds and co-op** — v2.1; presence is positions and chat only.
- **Trading between players** — not planned (inflation and fraud, and gold dies with the hero); items go to the shop.
- **Companions** — the owner's Addendum 2: one hero, nobody beside him; a party is v2.1.
- Also out: direct messages, more languages (English UI only), auctions, a live world calendar (v2.4), rewarded ads,
  any revive or gold-loss respawn.

## 7. Module map (from ARCH.md; one agent per line, each touches only its files + its test)
| Files | What | Agent |
|---|---|---|
| `js/00_core.js`, `js/90_main.js` | `R`, bus, loop, step, entities, camera, save/load (`v:2`, `R.acc()`), `R.ui` shell, pause; boot, error overlay, version label | A01 |
| `js/02_input.js` + css | floating joystick + ATTACK / DODGE / 3 skills / potion / INTERACT; right-side drag turns the camera; keyboard for tests | A02 |
| `js/05_sprites.js` | the old walking-sprite port for mobs and champions as billboards, `R.draw.frame`, z-sort | A03 |
| `assets/*.js` | extracted art: `A_ENEMY`, `A_CHAMP`, `A_MAP`, `A_GATE`, `A_ICONS`; `R.assets.ready` | A04 |
| `js/08_render.js` | the 3D renderer: terrain from the map art, `#gl` under `#c`, third-person camera, billboards, POI meshes, fog, `R.w2s` override, culling, day/night hook | A05 |
| `js/10_world.js` | regionAt, blocked, spawnAround, POI proximity, region gates | A06 |
| `js/11_world_data.js` | `R.data.world`: regions, POIs, roads, spawn tables, blocked mask, gates | A07 |
| `js/12_mobs.js` | `R.data.mobs`: every old enemy key → sprite, stats by level, behaviour, loot | A08 |
| `js/13_bosses.js` | `R.data.bosses` + boss AI (9 bosses, phases, telegraphs) + boss bar | A09 |
| `js/14_champs.js` | `R.data.champs` / `champKits`: 49 champions → hero stats bias, class by type, one signature skill | A10 |
| `js/20_combat.js` | `R.hit`, status effects, aggro, mob AI, projectiles, death + loot drop | A11 |
| `js/21_player.js` | hero stats / levels / XP, classes, dodge i-frames, sprint, potions, death → run end | A12 |
| `js/22_skills.js` + css | `R.data.skills`: 3 classes × 6 skills, effects, cooldown UI | A13 |
| `js/23_companions.js` | retired by Addendum 2 (no companions); not included in the v2.0.0 build | A14 |
| `js/30_items.js` | item tables, rarity, roll, sets, sell prices | A15 |
| `js/31_inventory.js` + css | character sheet + inventory + equip | A16 |
| `js/32_loot.js` | drops, pickup radius, chests, gold / gem bursts | A17 |
| `js/40_quests.js` + css | quest model (account state), tracker, log, turn-in | A18 |
| `js/41_story.js` | `R.data.story` + `R.data.quests`: main chain + side and rescue quests, NPC lines | A19 |
| `js/42_dialog.js` + css | NPC dialog screen | A20 |
| `js/43_towns.js` + css | shop, inn, smith | A21 |
| `js/44_dungeons.js` | 3 instanced dungeons, portals | A22 |
| `js/45_events.js` | world events on timers + banner | A23 |
| `js/46_achievements.js` | achievements + titles (account) | A24 |
| `js/50_hud.js` + css | HP / XP bars, level, gold / gems, minimap, tracker slot, skill bar frame, boss bar slot | A25 |
| `js/51_map.js` + css | world map screen: fog, POIs, you + others, fast travel | A26 |
| `js/52_intro.js` + css | title, house, the hero pick (first champion), name, prologue, first spawn | A27 |
| `js/53_tutorial.js` | first 3 minutes: move → camera → attack → skill → loot → first quest | A28 |
| `js/54_menu.js` + css | pause / settings, Telegram integration, share link | A29 |
| `js/55_levelup.js` + css | level-up popup, stat points, skill unlock card | A30 |
| `js/56_death.js` + css | death screen: the killer, the Hall of the Fallen line, the next-hero picker | A31 |
| `js/60_vfx.js` | numbers, slashes, auras, blood / ash, shake, telegraphs (2D overlay) | A32 |
| `js/61_sfx.js` | WebAudio synth | A33 |
| `js/62_ambience.js` | day / night, weather, biome tint | A34 |
| `js/70_net.js` | Supabase: login, rpc, save / load, wallet import to the first hero, presence poll, chat | A35 |
| `backend/holdor_v40.sql`, `backend/test/v40_test.py` | `rpg_saves`, `rpg_presence`, `rpg_chat` + RPCs | A36 |
| `js/06_hero_art.js` | code-drawn hero per class and house colour — the fallback when a champion sheet is missing | A37 |
| `js/71_presence.js` + css | others on the map, name tags, zone chat panel, leaderboard | A38 |
| `js/80_balance.js` | `R.data.balance`: XP curve, mob scaling, drop rates, gold sinks | A39 |
| `tests/rpg/t_smoke.js` | boot, move, kill, XP, save / load, death → Hall → next hero, map, chat UI | A40 |
| `docs/rpg-design.md`, backlog, roadmap, `CLAUDE.md`, `todo-mr-b.md` | this document and the owner's docs | A41 |
| `docs/store-texts.md`, `docs/marketing/` | new texts, trailer script | A42 |
| `vendor/three.min.js` | three.js (MIT, licence header kept), included by the build before `assets/` | integrator |

Runtime dependencies are soft: a system checks that what it needs exists (`R.data.x && …`, `R.sys.x && …`) and never
throws at load because another module is missing. Data modules register synchronously; `90_main.js` waits for
`R.assets.ready`, then opens the intro for a new save or calls `R.start()` for an existing one.

## 8. Test strategy
- Playwright with real taps on a 390×844 viewport, `tests/rpg/t_*.js`; `node tests/rpg/run_rpg.js` runs every suite and
  each line must say OK. `CHROMIUM_PATH` points at an installed Chromium when the download is blocked; headless Chromium
  gets WebGL from its software renderer, so the 3D canvas works in tests.
- `window.R` is the test surface: tests call `R.step()` for exact timing (60 steps = one game second), seed `R.rng`,
  spawn entities, read `R.state`, open screens with `R.ui.open`. Keyboard controls (WASD, J, K, 1-2-3, E) drive the
  hero where a tap is not the point.
- Every module owner ships one test for his module; `t_smoke.js` covers the whole path (boot → intro → move → kill → XP
  → save → reload → death → Hall → next hero → map → chat UI). The red `#err` overlay must stay hidden in every test; a
  console error fails it.
- The backend is tested on the local Postgres copy first (`bash backend/test/run_all.sh` + `v40_test.py`); function
  hashes are compared with the file after the Supabase migration.
- Balance (how long a careful run lasts in each region) is measured with a headless bot in v2.0.1, not in the release suite.

## 9. Release procedure
1. `python3 src/build_rpg.py` → `beta/index.html` (the only build target of a PR; vendor → assets → js, by name).
2. `node tests/rpg/run_rpg.js` — all OK; fix or drop nothing silently.
3. One PR per version touching only `src/rpg/`, `tests/rpg/`, `backend/`, `docs/`, `beta/`. MR B merges; Pages serves
   `https://bekagnp-design.github.io/holdor/beta/` a minute or two later; he tests it on his phone (checklist in
   `docs/todo-mr-b.md`).
4. On "release": apply the version's Supabase file as a named migration (`holdor_v40_rpg`) with a `holdor_backup` copy
   first and the function hashes checked against the file — SQL before the client that needs it.
5. A separate PR `vX.Y.Z` copies `beta/index.html` → `index.html` and nothing else; MR B merges it.
6. MR B bumps `?v=N` in BotFather if Telegram shows an old build. Never an untested build in the root.

## 10. Versions after v2.0.0 (see `docs/roadmap.md`)
v2.0.1 hotfixes from the first day → v2.1 guilds + co-op boss raids → v2.2 PvP duels in the Crownlands arena →
v2.3 Stars shop (cosmetics, inventory, a capped second chance; no pay-to-win) → v2.4 seasons + an events calendar.

## 11. What carries over from the tower defense
The art (enemies, champions, the Westeros map, the gate, the icons) as `assets/*.js`, now billboards on a 3D terrain
built from that same map; the seven houses and their colours; the 49 champions as the playable heroes; the wallet (gold,
dragonglass → gems) and the unlocked champions by a one-time import into the first hero and the account; the Supabase
project with its `login` RPC and the public-board privacy rule (v27); the Telegram Mini App and the bot; the synth-audio
approach; the owner's UI rule and release procedure.

## 12. What is removed from the client
Stages, waves, towers, spells, Mastery, the deck / Loadout, Trials, Houses Clash, Duel, the Hold, the realm war, the
card economy and its chests, the TD tutorial and films, the city, and the morning plan's companions. Their server objects
(v1–v39) are not dropped in v40; the old client's data stays readable for a later import if the owner wants it.

## 13. The archive
The TD game's sources stay in `src/` (`build.py`, `base/`, `parts/`, `mod/`, `hub.js`, `stages.py`, `layouts.json`,
`mults.json`, `story/`, `tools/`) and `tests/` (`run_core.js`, `t_*.js`). It is still buildable with
`python3 src/build.py <path>` to a path of your choice — **never `beta/`**, which belongs to the RPG — and is not
developed further. Its design papers (`docs/design-v2.md`, `docs/plan-v2-simple.md`, `docs/wip-v150/`) are history.
