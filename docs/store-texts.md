# HOLDOR — ready texts (bot, channels, X, video bios)

HOLDOR v2 is an **action RPG inside Telegram**: one hero on a 3D continent, real-time combat, a boss at every region gate,
**permadeath** — when your hero falls, the run ends and your house sends the next champion; the **Hall of the Fallen** keeps every
death. Other players walk your map; every zone has a chat. The hook, in the owner's words: **"Every death is a story. Your house
remembers."** Everything below is written for that game; the tower-defense texts live in git history only.
Posts, X, video captions, reply templates and the FAQ: `docs/marketing/launch-pack-en.md`. The trailer: `docs/marketing/trailer-script-v2.md`.

## Rules for every text (the owner's)
- **English only.** Funny and intriguing. No quotes from the books or the show. No SAO names, art or text (SAO is a mechanics reference only).
- **Trademark rule** (`docs/marketing-plan.md` §2, until the lawyer answers): in public text, names, hashtags and ads we do not write
  *Game of Thrones / GoT / HBO / Westeros / Hodor*, character names or castle names. Allowed: the Wall, the North, the dead, wights,
  giants, wildlings, "seven houses", "the realm", "your house's seat", "the continent". The heroes are "the 49 champions" — never by name,
  even though the Hall of the Fallen shows the name in the game; a public post says "a ranger of your house", not the name.
- **Every number is real.** The design numbers below come from `src/rpg/ARCH.md` + Addendum 2 (2026-11-22). Before you post one, check
  it in the build (`R.data.bosses`, `R.data.champs`, `R.data.world.regions`, …). If a module shipped fewer, the post says fewer.
- No player counts, no ratings, no "most popular", no release dates, no prizes, no money.

**Facts we may state:** free, inside Telegram, nothing to install · the whole continent as 3D terrain on the phone, a third-person
camera behind the hero (drag to look around, pinch to zoom) · one hero at a time — one of the 49 champions of the seven houses; a new
account starts with its house's first champion · the class comes from the champion (melee → knight, ranged → ranger, mage → maester),
6 skills each, 3 on the bar · real-time combat: joystick, strike, dodge, three skills, a potion · **permadeath**: when the hero falls the
run ends; the Hall of the Fallen gets a line (name, level, killer, time); gold, gems, gear, level and xp die with the hero; titles,
achievements and the world (regions discovered, gates opened, quests turned in, places found) stay with the account; the next hero is
picked from the unlocked champions; new champions are unlocked by rescue quests and bosses · nine regions, from your house's seat to
beyond the Wall (the last region starts at level 50) · 9 region bosses with phases and telegraphs, each one gates a region · 3 instanced
dungeons (waves, a mini-boss, a chest) behind portals · levels 1–60 in one life · gear in 3 slots, 5 rarities, sets · a main quest chain
plus side quests at the castles, towns and camps · other players drawn on your map with name tags · one chat per zone · day and night,
snow in the north, rain, sand · the old wallet's gold and gems go to the first hero; the champions it had are unlocked.

**Not in this version (do not claim):** companions, respawn, revive, parties, PvP, trading, guilds.

**Images:** `bot_banner_*.png`, `card_*.png`, `x_header_*.png` and `shots/*.png` in `docs/marketing/` are **tower-defense
screenshots**. Re-shoot them from the RPG build before uploading anything (`docs/marketing/tools/make_card.js` + `compose_card.js`
take new shots; the 3D camera behind a hero at a castle with the house banner is the picture). `avatar_640.png` (the door symbol) still
reads as a logo; keep it or redraw it, your call.

## 1. BotFather (in your chat with BotFather; the token is never sent to anyone)
| Command | What to paste |
|---|---|
| `/setname` | `HOLDOR` — the subtitle "Hold the Door" belonged to a game with a door. The RPG has a Wall and a Hall. Keep the pun only if you and the lawyer want it. |
| `/setabouttext` (≤ 120) | §1.1 (114 chars) |
| `/setdescription` (≤ 512) | §1.2 (497 chars) |
| `/setdescriptionpic` | a new 640×360 from the RPG build (the 3D camera behind a hero, a castle with the house banner, a fight; no big portrait of a recognisable face) |
| `/setuserpic` | `avatar_640.png` |
| `/setmenubutton` | button text `▶ Play free` · URL `https://bekagnp-design.github.io/holdor/` (as now) |
| `/setcommands` | `start - Start playing` · `play - Open the game` · `help - How it works` (the Edge Function `stars` answers all three) |

### 1.1 About (`/setabouttext`, ≤ 120)
```
Free action RPG inside Telegram. One hero on a 3D continent, real-time fights, permadeath. Every death is a story.
```

### 1.2 Description (`/setdescription`, ≤ 512)
```
HOLDOR — an action RPG that lives inside Telegram

No towers. No second chances. One hero, a whole continent in 3D, and things that walk straight at you.

⚔️ Real-time combat: move, strike, dodge, three skills
🧭 Nine regions, a boss at every gate, a Wall in the north
💀 Permadeath: when your hero falls, your house sends the next one
📜 The Hall of the Fallen keeps every death
💬 Real players on your map, a chat for every zone

Free to play. Tap PLAY. Every death is a story; your house remembers.
```

### 1.3 /start greeting — three variants (bot code; each comes with the ▶ Play free button that passes the source code)
Pick one, or rotate them; the bot shows one per user.

**A — the honest one**
```
🗺️ Welcome to HOLDOR.

Somebody took down all the towers and left you one hero, a sword and a continent in 3D. The dead walk straight at you. When your hero falls, that is it for them: your house sends the next champion, and the Hall of the Fallen writes down how it went.

Tap PLAY. Level 1, your house's seat, nobody watching. Yet.
```
**B — the short one**
```
⚔️ HOLDOR: an action RPG inside Telegram.

One hero. Nine regions. A boss at every gate. No respawn.
Other players are already on the map. The ones with names over their heads are friendly. Probably.

Tap PLAY — nothing to install, the first fight is a minute away.
```
**C — the intriguing one**
```
💀 Every death is a story. Your house remembers.

The further north you walk, the bigger the numbers over the monsters' heads — and the shorter the line that will be written about you.

HOLDOR — free, inside Telegram, nothing to download. Tap PLAY and pick a house.
```

## 2. Telegram channel and group
| | Text |
|---|---|
| Channel name | `HOLDOR News` |
| Channel description (≤ 255) | `Patch notes, boss tips, the week's best lines from the Hall of the Fallen and the real numbers behind HOLDOR — the free action RPG inside Telegram. Play: t.me/HoldorTDBot/play` (175) |
| Group name | `HOLDOR Realm` (`@holdor_chat`) |
| Group description (≤ 255) | `Players of HOLDOR, between heroes. Where are you on the map, which boss ate you, what should we build next. Be kind; the wights are rude enough.` (144) |
| Avatar | `avatar_640.png` |
| Link in the channel | `https://t.me/HoldorTDBot/play?startapp=s_tg` |
| Pinned post | launch pack, channel post 1 (the open map) |

## 3. X
- **Name:** `HOLDOR` · **avatar:** `avatar_640.png` · **header:** re-shoot `x_header_1500x500.png` from the RPG build
- **Bio (≤ 160):** `An action RPG that lives inside Telegram. One hero, a 3D continent, real-time fights, permadeath. Every death is a story. Free, nothing to install.` (147)
- **Link in bio:** `https://t.me/HoldorTDBot/play?startapp=s_x1`
- **Location:** `Telegram` (or empty)
- **Hashtags (only these, at most two per post):** `#telegramgames #actionrpg #permadeath #indiegame #miniapp #gamedev` — never a franchise tag.

## 4. YouTube / TikTok / Instagram
- **Name:** `HOLDOR` · **handle:** `@playholdor` everywhere
- **Bio:** `Free action RPG inside Telegram. One hero, a 3D continent, permadeath. Every death is a story. Link ↓` (101)
- **Links:** `https://t.me/HoldorTDBot/play?startapp=s_yt1` (YouTube), `…s_tt1` (TikTok), `…s_ig` (Instagram)
- **Clip shape (8–25 s, vertical):** 0–2 s a hook with a caption (a hero falls, the Hall line types in), then the fight, then
  "Free in Telegram — link in bio". Shot list: `docs/marketing/trailer-script-v2.md`; tools in `docs/marketing/trailer/`.

## 5. The referral line
What a player pastes to a friend, and the text behind the menu's share button (`js/54_menu.js` fills `[place]` and `[lvl]` from the save):
```
I'm standing at [place], level [lvl], still alive. Come see how long that lasts: https://t.me/HoldorTDBot/play?startapp=s_fr
```
No reward is promised in this line, because none exists in this version. If one is added later, the line changes with it — not before.

## 6. Tracking links (one code per channel, so `v_sources` shows where players come from)
`s_tg` channel · `s_x1` X · `s_tt1` TikTok · `s_yt1` YouTube · `s_ig` Instagram · `s_dm1` DMs · `s_tgen` Telegram groups · `s_fr` friends.
The source view takes any `s_<code>`; the RPG login (`js/70_net.js`) must still pass `startapp` to the `login` RPC — confirm in
`v_sources` that the first click shows up before you spend a day posting.
