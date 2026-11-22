# HOLDOR v2 trailer — 20 seconds, shot by shot

Master: 9:16, 720×1280, 30 fps, 20.0 s — `holdor_rpg_trailer_20s.mp4`. Cuts: 1:1 1080×1080 (`holdor_rpg_square_20s.mp4`) and the 8 s
TikTok cut (`holdor_rpg_tiktok_8s.mp4`), both from the same frames. Files are not committed (`docs/marketing/trailer/.gitignore`).

The promise of the film, in order: **a hero dies and is remembered → a continent in 3D → real-time fights → bosses gate the regions →
dungeons → the north → other players → free, in Telegram.** The hook is the death, because the hook of the game is the death.

Rules: English only; funny, intriguing; no quotes from the books or the show; no franchise words, character or castle names on screen
(the Hall line in shot 1 shows whatever the build wrote — if it names the champion, blur the name or crop the line to "level · killer";
the caption carries the meaning). Nothing in the film that the build cannot do: record real play, never paint a frame. If a shot's
feature is not in the build yet, drop the shot and stretch its neighbours — the film says less, never more.

## Recording (adapt `docs/marketing/trailer/make_trailer.js` + `build_trailer.sh` + `audio.py` to the RPG build; drive `window.R`, not `HOLDOR`)
- Build `beta/index.html` with `python3 src/build_rpg.py`; record from a file URL or a local server, never from the root `index.html`.
- Playwright Chromium, viewport 390×844 CSS px, `deviceScaleFactor` 2 → 780×1688, downscale to 720×1280 (the game's own phone look; no letterbox).
  WebGL in headless Chromium needs the software GL flags (ANGLE / SwiftShader); if a frame comes out black, that is the first thing to check.
- Deterministic frames: pause the loop, call `R.step()` twice per video frame (60 steps per game second, 30 fps), screenshot each frame; seed with `R.rng(seed)`.
- Drive the hero with the keyboard the game already accepts (WASD/arrows move, J strike, K dodge, 1–2–3 skills, E interact). The camera:
  set `R.cam.yaw` per frame for the smooth spin in shot 2, and the pinch distance (300–700) for the pull-back.
- Place the hero with the save (`R.state.p.pos`) at the POI each shot needs; spawn the mobs you need with the world helper (`R.world.spawnAround`)
  from the region's own spawn table; a boss by its id. Let the HUD stay — the joystick and the buttons are part of the pitch.
- The death in shot 1 is a real death: let the mob kill the hero. The Hall line is whatever the game writes. Do not type one.
- The other players in shot 7 are your own two accounts (the phone + the test seat). Never a painted tag, never another player's name without asking.
- Hide nothing but the version label if it overlaps a caption; keep everything else exactly as the player sees it.

## Captions
One line, at most five words, white with a 2 px dark edge, in the bottom 20 % of the frame, never over the skill buttons or the joystick.
The accent (a thin rule under the caption, the CTA button) is the recording house's colour (`R.data.houses[h].col`).
The last card uses the logo from `docs/marketing/tools/make_logo.js`.

## Sound
The game's own synth (`R.sfx`): swings, hits, the death drum, the boss drums, UI clicks — recorded with the frames, then the
`audio.py` pattern on top: one low drum on every caption change, a long tail into silence on the last card. No music (no licence to use any).

## Shot list

| # | Time | What to record (in the game) | On screen | Caption | Sound |
|---|---|---|---|---|---|
| 1 | 0.0–2.0 | **The hook.** Level-1 hero at the edge of a camp, one giant (or the strongest nearby mob) already mid-swing. Camera at distance 300, slightly behind the shoulder. The hero takes the hit, the death animation plays, the screen darkens and the Hall of the Fallen writes its line (level · killer · time). Cut at the moment the line finishes typing. | the fall, then one typed line on black | `Every death is a story.` | the hit, the death drum, then silence while the line types |
| 2 | 2.0–4.0 | The hero-select card: the house's unlocked champions, one chosen; cut to the new hero standing in front of the house's seat, the banner in the house colour on the low-poly castle. Spin the camera 90° around the hero in 2 s (`R.cam.yaw`), then pull the distance 300 → 700 so the terrain and the road show. | the next champion steps out; the castle, the banner, the land behind | `Your house remembers.` | one drum on the cut; wind |
| 3 | 4.0–7.0 | Walk the road out of the seat (joystick visible on the left), camera at 420 behind the shoulder, a hill in front, the sea at one edge; keep walking while the fog line retreats on the minimap. Daytime. | third-person 3D, roads, hills, the fog edge on the minimap | `A whole continent. In 3D.` | footsteps, birds |
| 4 | 7.0–10.0 | A camp of five: three basic strikes (J J J), skill 1 on the group, damage numbers, one crit in gold, two kills, a loot burst; dodge (K) through a swing so the whiff is visible. | numbers, slashes, the dodge i-frame, loot | `Real-time. Dodge or die.` | swings, hits, the crit ping |
| 5 | 10.0–13.0 | The region boss: the telegraph circle grows under the hero, the hero dodges out as it fills, the hit lands on empty ground, the hero strikes back, the boss bar drops a notch, the phase changes. | the circle, the escape, the boss bar | `Nine bosses. Nine gates.` | the boss drums, the telegraph hum, the slam |
| 6 | 13.0–15.0 | A dungeon portal on the map; step through (E); inside: one wave down, the mini-boss falls, the chest opens with a gold-and-gem burst. Cut fast: three beats of one second. | portal, fight, chest | `Three dungeons. Yours alone.` | the portal, the chest |
| 7 | 15.0–17.0 | The map screen: the full continent, the fog, found castles lit, your dot and the second account's dot with its name tag; tap it; cut to the 3D view where the second hero stands on a ridge with the name over its head; the zone chat panel opens with the message you typed yourself ("anyone near the shrine?"). | the map, another real player, the chat | `You are not alone.` | the UI click, wind |
| 8 | 17.0–18.5 | The north: snow falling, the dark blue tint, the Wall on the terrain ahead, a mob with a level in the 50s over its head (spawn from the last region's own table; if no mob there carries a level that high yet, keep the snow and cut the number). The hero very small against the Wall. | snow, the Wall, big numbers | `Past the Wall: level 50+.` | the wind rising, one low drum |
| 9 | 18.5–20.0 | **The CTA card.** Black; the HOLDOR logo; under it two lines in white: `Free action RPG inside Telegram` and `t.me/HoldorTDBot/play`; a ▶ Play free button in the house colour. Hold 1.5 s. | the logo, the link, the button | `Free. In Telegram. Tap Play.` | the tail of the drum into silence |

Checks before export: every number on screen came from the build; no champion name legible (shot 1 cropped if needed); the captions
never cover a button; the first two seconds work with the sound off (the fall + the typed line must read on mute, because most feeds are mute).

## The 8 s TikTok cut (`holdor_rpg_tiktok_8s.mp4`)
| Time | From shot | Caption |
|---|---|---|
| 0.0–2.0 | 1, the fall and the Hall line | `Every death is a story.` |
| 2.0–4.5 | 5, the boss circle, the dodge, the hit back | `No respawn. Dodge.` |
| 4.5–6.5 | 2, the camera spin around the castle and the pull-back | `A continent in 3D.` |
| 6.5–8.0 | 9, the CTA card | `Free. In Telegram.` |
The caption for the post itself: launch pack (c) 1 or 3.

## The 1:1 cut (`holdor_rpg_square_20s.mp4`, for X)
Same timing as the master; centre-crop 780×780 from the 780×1688 frames so the hero stays in the middle; the captions move to the bottom
10 % because the HUD buttons sit lower in the square; the CTA card is re-laid for the square (logo above, link below, button in the middle).

## What to re-record when the build changes
A new hero sprite set → shots 1–4. A new boss → shot 5 (the first region boss is the right one: the viewer will meet it first).
The Hall of the Fallen screen redesigned → shot 1's line and the Day 3 channel post's screenshot. The 3D terrain retextured → shots 2, 3, 8.
