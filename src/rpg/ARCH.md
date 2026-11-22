# HOLDOR RPG — architecture contract (v2.0.0, 2026-11-22)

HOLDOR becomes an action RPG: one player character + companion champions on an open map of Westeros, real-time
combat (joystick, attack, dodge, three skills), levels / gear / quests, other players visible on the map, a zone chat.
Tower defense is gone. The old game's enemies (wights, walkers, giants, wildlings, …), the seven houses and the 49
champions stay — as mobs, factions and companions. Sword Art Online is a MECHANICS reference only (open world, levels,
boss gates, skills, parties): no SAO names, art, music or text. Game of Thrones places and house names are already the
game's theme; write original lines, never quotes from the books or the show.

## Build
- `python3 src/build_rpg.py` → `beta/index.html` (or the path given). It reads `src/rpg/index.tpl.html`, inlines every
  `src/rpg/css/*.css` (sorted by name) before `</style>` and every `src/rpg/assets/*.js` then `src/rpg/js/*.js` (sorted
  by name) before `</script>`. **File names start with a two-digit order prefix** (see ownership below). The build never
  fails on a missing optional file; a module must not throw at load time if another module is absent (guard with
  `R.data.x && …`, `R.sys.x && …`).
- Tests: Playwright, real taps, `tests/rpg/*.js`, run with `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_x.js`.
  Expose test hooks on `window.R` (the whole game object is public in the build; keep it that way).

## One global: `R`
Every module is an IIFE that only touches `R` (defined in `js/00_core.js`):
```
R.VERSION            // '2.0.0'
R.bus.on(ev, fn) / R.bus.off / R.bus.emit(ev, ...args)      // events: see list below
R.data.<name>        // static data registered by data modules (world, mobs, items, skills, quests, story, classes, bosses, shops, achievements, events)
R.sys[name] = {order, update(dt), draw(ctx)}                  // systems; R.sysList sorted by order each registration
R.screens[name] = {open(arg), close(), el?}                   // full-screen UIs (intro, map, inventory, quests, chat, shop, settings, dialog, death, levelup)
R.ui.open(name,arg) / R.ui.close() / R.ui.toast(txt, col) / R.ui.cur   // one screen at a time over the canvas; the game pauses while a screen is open unless screen.live
R.state              // the SAVE (JSON): see below.  R.save() debounced (localStorage 'holdor_rpg' + R.net.save when logged in).  R.load()
R.t, R.dt            // game seconds, last step dt (fixed 1/60).  R.step() runs one fixed step (tests call it); R.running
R.cam = {x,y,z}      // world point at the screen centre, zoom (1 = 1 world unit per CSS px).  R.w2s(x,y) → {x,y} screen; R.s2w
R.ents               // array of live entities; R.spawn(e) → e (assigns id), R.kill(e) (emits 'kill' for mobs); R.find(fn); R.near(x,y,r,filter)
R.player             // the player entity (kind 'player'), created by core from R.state.p
R.hit(src, tgt, dmg, o)   // combat API (js/20_combat.js): applies def, crit, emits 'hit' {src,tgt,dmg,crit}, numbers via R.fx.num; o:{knock, stun, dot, kind:'phys'|'fire'|'ice'|'holy'}
R.fx.num(x,y,txt,col,big) / R.fx.spawn(kind,x,y,o) / R.fx.shake(px,s)   // js/60_vfx.js
R.sfx.play(name, vol)      // js/61_sfx.js (WebAudio synth, no files)
R.net                // js/70_net.js: login(), rpc(name, params), save(), load(), presence(), chat.send(txt), chat.list(); R.net.on (bool), R.net.token
R.draw.sprite(key, x, y, o) / R.draw.champ(id, x, y, o) / R.draw.hero(x,y,o)   // js/05_sprites.js: the old game's art (assets) + the code-drawn player
R.world              // runtime world helpers (js/10_world.js): regionAt(x,y), poiAt(x,y,r), blocked(x,y) (sea / mountains from the mask), roadNear, spawnAround(x,y)
R.rng(seed?)         // seeded PRNG for deterministic tests
```
Events: `kill(mob, byEnt)`, `hit(info)`, `levelup(lvl)`, `xp(n)`, `gold(n)`, `loot(item)`, `quest(id, state)`, `enter(regionId)`, `poi(poiId)`,
`dialog(npcId)`, `death()`, `respawn()`, `boss(id, phase)`, `screen(name|null)`, `tick1s`, `save`.

## Coordinates and the world
World units = pixels of the Westeros map art (`src/assets/westeros_1200.webp`, 1200×2048) × **6** → the world is 7200×12288 units.
North is up. `R.data.world` (js/11_world_data.js) holds regions (polygons in world units, a level band, a biome), POIs
(castles, towns, camps, dungeons, shrines — real Game of Thrones places at their map positions), roads (polylines), spawn
tables per region, and the region gate order. Nine regions, south to north and back is NOT the order: the player starts at
his house's seat (`HOUSES[h].seat`) at level 1 and the regions around it are low level; the order of difficulty is by
distance from the seats toward the Wall and then beyond it (the last region: the Lands of Always Winter, level 50+).
Movement speed: player 170 u/s (sprint 240), mobs 90–160. Camera zoom 1.0 on a 390-px-wide phone shows 390×844 world units.
Sea, lakes and mountain ridges block movement (`R.world.blocked` from a coarse mask the world-data module provides as a
60×102 grid string, '#' = blocked).

## Entities
`{id, kind:'player'|'companion'|'mob'|'boss'|'npc'|'drop'|'portal', x, y, r (hit radius), face (±1), vx, vy, team (0 player side, 1 enemies, 2 neutral),
 hp, hpMax, atk, def, spd, lvl, name, type (mob/champ key), ai (state object), cd {skill:untilT}, status {stun, slow, burn, bleed, shield} , anim ('idle'|'walk'|'attack'|'hurt'|'die'), animT, dead, loot?, quest?, dialog? }`
Mobs use the old enemy keys (`axe, sword, archer, hound, walker, giant, …` — `R.data.mobs` lists them with sprite key, stats per level,
behaviour: melee / ranged / caster / summoner / fly / boss). Companions are champions (`R.data.champs`, ids as before: jon, arya, robb, …, 49) and
follow the player, fight with one basic attack + one signature skill mapped from their old kit (`R.data.champKits`).

## The save (`R.state`)
```
{ v:1, p:{ name, house, cls:'knight'|'ranger'|'maester', lvl, xp, hp, gold, gems, pos:{x,y}, stats:{str,agi,int,vit}, pts, skills:{id:rank}, bar:[skillId x3],
   gear:{weapon,armor,trinket}, inv:[item], potions:{hp,mana}, comps:[champId x2], champs:{id:{lvl}}, quests:{id:{st:'open'|'done'|'turned', n}}, flags:{},
   found:[poiIds], killed:{mobType:n}, bosses:{id:killedN}, ach:[ids], title, created, played },
  wallet:{imported:bool, gold0, gems0}, opts:{sfx:1, haptic:1, lang:'en'} }
```
Items: `{id, kind:'weapon'|'armor'|'trinket'|'potion'|'mat', name, rar:0..4, lvl, stats:{atk,def,hp,spd,crit}, set?, icon}` (js/30_items.js has the tables and `R.items.roll(lvl, rar)`).

## Progression
XP to next level: `80 + 45·L + 6·L²` (L 1..60). Each level: +3 stat points (auto by class unless the player assigns), hp = 120 + 18·L + 6·vit,
atk = 10 + 2·L + 1.5·str (ranger agi, maester int), def = 4 + 1.2·L + 0.6·vit. Mob stats scale from the region's level band (js/12_mobs.js). Gold from
mobs 2–8 × level; gems only from bosses, chests and quests. The old wallet's gold / gems / unlocked champions are imported once at first login
(js/70_net.js, `R.state.wallet.imported`).

## Controls (js/02_input.js)
Left half of the screen: a floating virtual joystick (appears where the thumb lands). Right side: ATTACK (big), DODGE, three skill buttons with
cooldown rings, a potion button. Tap an NPC / portal / drop when close: INTERACT button appears. `R.input = {move:{x,y}, pressed(name), down(name)}`.
Keyboard for tests and desktop: WASD/arrows, J attack, K dodge, 1-2-3 skills, E interact.

## UI rule (the owner's)
One dominant primary button per screen, everything readable in one glance, ≥ 44 px targets, no walls of text, every number real.
English UI text. Dark fantasy palette, the house colour as the accent (`R.data.houses[h].col`).

## File ownership (one agent per line; touch ONLY your files + your test)
```
js/00_core.js              core: R, bus, loop, step, entities, camera, save/load, R.ui shell, pause            (A01)
js/02_input.js  css/02_input.css   joystick + buttons                                                       (A02)
js/05_sprites.js           drawWalking port for mob + champion sprites, player drawing hooks, z-sort helpers  (A03)
assets/*.js                extracted art: A_ENEMY (ENEMY_ART+META+CFG), A_CHAMP (CHAMP_ART), A_MAP (map webp), A_GATE, A_ICONS (A04)
js/06_hero_art.js          code-drawn player character per class and house colour (idle/walk/attack/hurt/die)  (A37)
js/08_render.js            background (map art + fog of undiscovered), roads, POI markers, entity draw loop, culling, day/night tint hook (A05)
js/10_world.js             runtime helpers (regionAt, blocked, spawnAround, poi proximity, region gates)        (A06)
js/11_world_data.js        R.data.world: regions, POIs (real places), roads, spawn tables, blocked mask, gates   (A07)
js/12_mobs.js              R.data.mobs: every old enemy key → sprite, stats by level, behaviour, loot table      (A08)
js/13_bosses.js            R.data.bosses + boss AI (9 region bosses, phases, telegraphs) + boss bar              (A09)
js/14_champs.js            R.data.champs/champKits: 49 champions → companion stats + one signature skill        (A10)
js/20_combat.js            R.hit, status effects, aggro, mob AI state machine (idle/patrol/chase/attack/flee), ranged projectiles, death + loot drop (A11)
js/21_player.js            player stats/levels/xp, classes, dodge i-frames, sprint, potions, death/respawn       (A12)
js/22_skills.js  css/22_skills.css  R.data.skills: 3 classes × 6 skills, effects, cooldown UI binding           (A13)
js/23_companions.js        companion AI (follow, assist, revive), swapping companions UI card                   (A14)
js/30_items.js             item tables, rarity, roll, sets, sell prices, R.items                                 (A15)
js/31_inventory.js css/31_inventory.css  character sheet + inventory + equip screen                              (A16)
js/32_loot.js              drops on the ground, pickup radius, chest objects, gold/gem bursts                     (A17)
js/40_quests.js  css/40_quests.css  quest model, tracker HUD, quest log screen, turn-in                           (A18)
js/41_story.js             R.data.story + R.data.quests: main chain across the regions + side quests per POI, NPC lines (A19)
js/42_dialog.js  css/42_dialog.css  NPC dialog screen (portrait, typed text, choices), R.ui.open('dialog', npc)   (A20)
js/43_towns.js   css/43_towns.css  shops (gear/potions for gold, premium for gems), inn (heal), smith (upgrade)   (A21)
js/44_dungeons.js          3 instanced dungeons (layout, waves, chest, mini-boss), portals on the map             (A22)
js/45_events.js            world events on timers (wight horde, dragon shadow, merchant caravan) + banner         (A23)
js/46_achievements.js      achievements + titles, R.data.achievements, toast on unlock                            (A24)
js/50_hud.js     css/50_hud.css  HP/XP bars, level, gold/gems, minimap, quest tracker slot, skill bar frame, boss bar slot (A25)
js/51_map.js     css/51_map.css  world map screen (full map art, fog, POIs, you + other players, fast travel to found castles) (A26)
js/52_intro.js   css/52_intro.css  title, house pick, name, class pick, prologue scene, first spawn               (A27)
js/53_tutorial.js          first 3 minutes: move → attack → skill → loot → first quest → first companion            (A28)
js/54_menu.js    css/54_menu.css  pause/settings (sfx, haptics), Telegram (expand, BackButton, haptics, MainButton), share link (A29)
js/55_levelup.js css/55_levelup.css  level-up popup, stat points, skill unlock card                                 (A30)
js/56_death.js   css/56_death.css  death screen (respawn at the last shrine/castle, gold loss), revive by companion  (A31)
js/60_vfx.js               damage numbers, slashes, auras, blood/ash, screen shake, telegraph circles              (A32)
js/61_sfx.js               WebAudio synth: hits, swings, spells, UI, ambient per biome, boss drums                   (A33)
js/62_ambience.js          day/night cycle, weather (snow north, rain, sand), biome tint, fireflies               (A34)
js/70_net.js               Supabase: login (Telegram initData → existing `login` RPC), rpc, save/load, wallet import, presence poll, chat (A35)
backend/holdor_v40.sql + backend/test/v40_test.py   tables rpg_saves, rpg_presence, rpg_chat (+ RPCs, RLS off / security definer like the rest) (A36)
js/71_presence.js css/71_presence.css  other players drawn on the map + name tags + zone chat panel + leaderboard screen (A38)
js/80_balance.js           R.data.balance: xp curve, mob scaling, drop rates, gold sinks — one place, used by others via R.data.balance (A39)
js/90_main.js              boot: assets ready → intro or load → spawn → start loop; error overlay; version label     (A01)
tests/rpg/t_smoke.js       Playwright: boot, move, kill, xp, save/load, intro, map, chat UI opens                   (A40)
docs/rpg-design.md, docs/build-backlog.md section, docs/roadmap.md, CLAUDE.md rewrite                             (A41)
docs/store-texts.md + docs/marketing: new texts, trailer script                                                   (A42)
```
Dependencies at runtime are soft: a system checks what it needs exists. Data modules register synchronously at load. The boot (90_main.js)
waits for `R.assets.ready` (A04's loader) then calls `R.ui.open('intro')` for a new save or `R.start()` for an existing one.

## Non-negotiables
- Never touch root `index.html`; the release copies `beta/index.html` there after the tests.
- No Telegram bot token anywhere; the client has only `SB.url` + the publishable key (copy them from `src/base/index.v1.0.44.html`).
- Every number a player sees is real (the save or the server). No fake player counts.
- Keep the old `src/`, `tests/`, `backend/` files; the new game lives in `src/rpg/`, `tests/rpg/`, `backend/holdor_v40.sql`.
