# HOLDOR v2 launch pack (English only)

The game: an action RPG inside Telegram. One hero — one of the 49 champions of the seven houses — on a whole continent in 3D, with a
third-person camera behind the shoulder. Real-time combat (move, strike, dodge, three skills). Nine regions, a boss at every region gate,
three instanced dungeons. **Permadeath:** when the hero falls, the run ends, the Hall of the Fallen writes a line (name, level, killer,
time) and your house sends the next champion. Gold, gems, gear and level die with the hero; the world you opened, your titles and
achievements stay. Other players walk your map; every zone has a chat. Free, nothing to install.

The hook (the owner's words): **Every death is a story. Your house remembers.**

Rules, allowed words, the facts list and the images note: `docs/store-texts.md` (top). Short form: English, funny, intriguing; no book or
show quotes; no franchise words, character or castle names (the heroes are "champions", never named in a post); every number real and
checked in the build; no player counts, awards, dates, prizes or money. Not in this version, so never claimed: companions, respawn, revive,
parties, PvP, trading, guilds. The source of every claim here is `src/rpg/ARCH.md` + Addendum 2 — if a module shipped less, the post says less.

Tracking links (one code per channel; `v_sources` shows where players come from — confirm the first click lands before posting a day's worth):
- Channel: `https://t.me/HoldorTDBot/play?startapp=s_tg`
- X: `https://t.me/HoldorTDBot/play?startapp=s_x1`
- TikTok / Shorts / Reels: `…?startapp=s_tt1` / `s_yt1` / `s_ig` (link in bio)
- Telegram groups: `…?startapp=s_tgen` · DMs: `…?startapp=s_dm1` · friends (the referral line): `…?startapp=s_fr`

Video (`docs/marketing/trailer-script-v2.md`): `holdor_rpg_trailer_20s.mp4` (720×1280), `holdor_rpg_square_20s.mp4` (1080×1080), `holdor_rpg_tiktok_8s.mp4` (720×1280).

---

## (a) 8 channel posts — launch week, one per day (link: `s_tg`)

Post in the evening of the audience's time zone. Each post: one picture or clip from the real build, one link. Answer every comment.

### Day 1 — the open map (pinned)
```
HOLDOR v2 is live, and the towers are gone.

What is there instead: a whole continent in 3D, on your phone, inside Telegram. Nine regions, roads, castles flying your house's banner, camps, shrines, three dungeons and a Wall. The camera sits behind your hero's shoulder — drag to look around, pinch to step back.

You start at your house's seat, level 1, one hero. The fog hides every place you have not walked to yet; the map remembers every place you have — longer than your hero will.

Move with one thumb, strike with the other. Dodge when the ground draws a circle.

Free, inside Telegram, nothing to install:
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Attach: the 20 s trailer, or the 3D view of a castle with the banner and the hero in front of it.

### Day 2 — the first boss
```
Every region ends in a boss. The boss ends in you. Permanently, the first few times.

Here is the trick, free of charge: a boss draws its hit on the ground before it lands. The circle is not decoration. Leave the circle. Then hit the thing that drew it.

Nine bosses, nine gates. No boss, no next region — not for gold, not for gems, not for asking nicely. But a gate you open stays open for your house, whoever you send through it next.

Which one wrote your hero's last line? Tell us below; we will pretend to be surprised.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Attach: a 10 s clip — telegraph circle, dodge out, the hit back, the boss bar dropping.

### Day 3 — the Hall of the Fallen
```
Every death is a story. Your house remembers.

When your hero falls, the run is over. No respawn, no shrine, no walking back. The Hall of the Fallen gets one more line — name, level, what killed them, when — and your house sends the next champion.

What dies with the hero: gold, gems, gear, level. What stays with you: every region discovered, every gate opened, every quest turned in, every place found, every title. The map remembers. The hero does not.

Your house starts with one champion. The others are out there — in rescue quests and behind bosses. 49 in all, across seven houses. Nobody meets them all on the first try.

Read your Hall. Then post the line you are proudest of.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Attach: the Hall of the Fallen screen from your own account (real lines only). Players may name their champions in comments; the post does not.

### Day 4 — the zone chat: you are not alone
```
You are not alone out there.

That figure on the ridge with a name over its head is a player. The one without a name is a wight. Check in that order; you only get one hero at a time.

Every zone has its own chat. Ask where the shrine is, say where you are standing, warn people about the thing by the river. Nobody sees your Telegram handle — only the name you chose and your house colour.

Open the map: everyone in your zone is on it.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Attach: the map screen with two real players on it (your two accounts; never a painted tag), or the chat panel with your own message.
Keep true: the name tag and the chat show the chosen name only (`js/71_presence.js`, `backend/holdor_v40.sql`). If that changes, this post changes first.

### Day 5 — dungeons
```
Three dungeons. Each one is yours alone.

A portal on the map, waves of things that resent you, a mini-boss who resents you professionally, and a chest at the end that does not. No other player walks into your copy; the footprints are all yours. So is the exit, if you reach it.

Bring potions. Bring a plan. Bring a will.

Found all three portals? The fog hides them until you walk there.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Attach: portal → inside → chest, 10 s.

### Day 6 — the Wall
```
The further north you walk, the bigger the numbers over the monsters' heads.

Near your house's seat they are small and polite. By the Wall they stop being numbers you like. Past it the snow does not stop, the levels start at 50, and the last region waits for the houses that got through the other eight.

This is where Halls of the Fallen get long. Nobody has to go. Everybody will.

How far north did your hero get? Screenshot the map.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Attach: snow, dark tint, the Wall on the 3D terrain.

### Day 7 — player spotlight (template)
```
Player of the week: [name]

Heroes fallen: [hall] · best level in one life: [best_lvl] · most kills in one life: [best_kills] · bosses down: [bosses] · places found: [found] · title: "[title]"

Last line in their Hall: "a [class] of their house · level [lvl] · killed by [killer]"

[One sentence about what they did — something you saw in the data or they told you themselves.]

Want a line of your own? Walk north.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
Data: `rpg_saves` → `acc.hall` (its length; the last entry's `lvl` and `killer`), `acc.best.lvl`, `acc.best.kills`, the sum of `acc.world.bosses`,
the length of `acc.world.found`, `acc.title`; `[class]` from the fallen champion's type (knight / ranger / maester).
Rules: a number you did not read from the table is not posted; ask the player before naming them; the champion's name and the house stay
out of the post until the lawyer answers (`docs/marketing-plan.md` §2).

### Day 8 — what's next (template)
```
Week one is done. Here is what changes next.

[version]: [one line per change — real, from docs/build-backlog.md]

We build in the open: every version gets one line here, including the ones that go wrong. What do you want first — [option A] or [option B]? Vote below.
https://t.me/HoldorTDBot/play?startapp=s_tg
```
The options are two real items from `docs/roadmap.md`. No dates.

---

## (b) 10 X posts (each ≤ 240 chars with the link; at most two hashtags; link: `s_x1`)

1.
```
We removed the towers. All of them. It is now you, one hero, a continent in 3D and things that walk straight at you. When the hero falls, your house sends the next one.
HOLDOR, free in Telegram:
https://t.me/HoldorTDBot/play?startapp=s_x1
```
2.
```
Every region ends in a boss. The boss draws a circle on the ground before it hits. Standing in the circle is a choice. There is no respawn, so choose.
HOLDOR, free in Telegram:
https://t.me/HoldorTDBot/play?startapp=s_x1
```
3.
```
Every death is a story. Your house remembers.
The Hall of the Fallen keeps one line per hero: name, level, what killed them. Yours will not say "old age".
HOLDOR, free in Telegram:
https://t.me/HoldorTDBot/play?startapp=s_x1
```
4.
```
The figure on the hill with a name over its head is another player. The one without a name is a wight. Check in that order; you get one hero at a time.
HOLDOR: https://t.me/HoldorTDBot/play?startapp=s_x1
#telegramgames #actionrpg
```
5.
```
Three classes, decided by the champion you send. The knight hits things. The ranger shoots things. The maester reads things at them until they fall over. All three dodge.
HOLDOR: https://t.me/HoldorTDBot/play?startapp=s_x1
```
6.
```
No app store. No download. One link, a Telegram chat, and a continent in 3D that does not fit on one screen or in one evening.
HOLDOR: https://t.me/HoldorTDBot/play?startapp=s_x1
#indiegame #miniapp
```
7.
```
The further north you walk, the bigger the numbers over the monsters' heads, and the shorter the line that will be written about you.
HOLDOR, an action RPG in Telegram, free:
https://t.me/HoldorTDBot/play?startapp=s_x1
```
8.
```
What dies with your hero: gold, gems, gear, level. What stays: every gate you opened, every place you found, every title. The map remembers. The hero does not.
HOLDOR, free: https://t.me/HoldorTDBot/play?startapp=s_x1
```
9.
```
Played the old HOLDOR? Your gold, gems and champions are waiting for your first hero. Your towers are not. We looked everywhere.
Action RPG now, still free:
https://t.me/HoldorTDBot/play?startapp=s_x1
```
10.
```
Three dungeons, each one yours alone. Waves, a mini-boss, a chest, and an exit you reach on the first try or not at all.
HOLDOR — free, inside Telegram, no install:
https://t.me/HoldorTDBot/play?startapp=s_x1
#telegramgames #permadeath
```
Attach: 1, 7 the 20 s square video; 2, 10 a 10 s cut (the boss, the dungeon); 3, 8 the Hall of the Fallen screen (your own, real lines); 4 the map screen; the rest a real screenshot.

---

## (c) 3 short-video captions (TikTok / Shorts / Reels; video `holdor_rpg_tiktok_8s.mp4`; link in bio)

1. `They took the towers away and left me one hero and a continent in 3D. The hero is no longer with us. Free inside Telegram, link in bio. #actionrpg #telegramgames #permadeath #indiegame #mobilegames`
2. `POV: the boss draws a circle, you are standing in it, and there is no respawn. Nine bosses, nine gates. Link in bio. #actionrpg #bossfight #telegramgames #permadeath #indiegame`
3. `Every death is a story. Your house remembers. The Hall of the Fallen, inside a free Telegram RPG. Link in bio. #actionrpg #telegramgames #permadeath #indiegame #mobilegames`

---

## (d) 6 reply templates for comments

1. **"Is it free?"**
   `Yes. Free to play, nothing to install, it opens inside Telegram. Gems drop from bosses, chests and quests — and they die with your hero, so no, nobody is selling you power.`
2. **"Which class should I pick?"**
   `You do not pick a class, you pick a champion: melee ones fight as knights, ranged as rangers, mages as maesters. The knight hits things, the ranger prefers the monster over there, the maester reads at it until it falls over. All three dodge — the dodge is the real class.`
3. **"The boss killed me five times."**
   `It draws a circle before it hits. Be elsewhere when the circle fills, then hit back. A gate you open stays open for your house, so the next hero never meets the boss you already beat. Which one wrote the line? We keep a list of grudges.`
4. **"Found a bug / it crashed."**
   `Thank you — that is the most useful comment under this post. Reply with your phone model, what you were doing and what the screen showed, and it goes into the next version.`
5. **"Can I play with my friends?"**
   `Yes: you share the map. Open it, find their name, walk over — or fast-travel to a castle you have both found. Every zone has a chat to say where you stand. No party system in this version; standing next to each other and hitting the same giant works fine.`
6. **"Permadeath? Seriously?"**
   `Seriously. When the hero falls the run ends and the Hall of the Fallen writes it down: name, level, killer, time. You keep the world — the gates, the places, the titles — and your house sends the next champion. It is the point, not the punishment.`

---

## (e) The referral line (source: `docs/store-texts.md` §5)
```
I'm standing at [place], level [lvl], still alive. Come see how long that lasts: https://t.me/HoldorTDBot/play?startapp=s_fr
```
No reward is promised, because none exists in this version.

---

## (f) FAQ — 10 questions, paste-ready (channel pinned comment, group rules, bot /help)

1. **Is it free?**
   Yes. Free to play, nothing to install. Gems drop from bosses, chests and quests; the gem shop sells convenience, not a key to the next region — and gems die with the hero like everything else in the pocket.
2. **Is it Telegram only?**
   Yes — it is a Telegram Mini App. Open `t.me/HoldorTDBot/play` in Telegram and tap Play. No app store, no download. It is built for a phone; in a desktop browser the keyboard works too (WASD or arrows to move, J strike, K dodge, 1–2–3 skills, E interact).
3. **What data do you keep?**
   What Telegram hands every Mini App at login: your Telegram id, first name and username. Plus your house, your save (the hero, level, gear, position, quests, the Hall of the Fallen) and the messages you write in the zone chat. No phone number, no contacts, no card numbers — Telegram handles payments, we never see them. Other players see the name you chose and your house colour, nothing else.
4. **Is it pay-to-win?**
   No. Every region is gated by its boss, and a boss checks your timing, level and gear, not your wallet. Gems come from bosses, chests and quests, nothing in the shop opens a gate, and whatever you carry dies with the hero.
5. **I played the tower defense. What carried over?**
   Your gold and gems go to your first hero, and the champions you had unlocked are unlocked as heroes — imported once, at your first login. Towers, stage stars and Hold records do not carry over; there is nothing left to attach them to. The enemies, the seven houses and the 49 champions are the same people — you now play the champion instead of placing them.
6. **How do I find my friends on the map?**
   Open the map: every player in your zone is a dot with a name. Say where you stand in the zone chat, agree on a castle, walk — or fast-travel if you have both found that castle. The share button in the menu sends a friend a link that opens the game.
7. **What happens when I die?**
   The run ends. The Hall of the Fallen writes one line — name, level, what killed you, when — and you pick the next hero from the champions you have unlocked. Gold, gems, gear, level and xp are gone with the hero. The world stays: every region discovered, every gate opened, every quest turned in, every place found, every title and achievement.
8. **Which hero should I pick?**
   The class comes with the champion: melee ones fight as knights (strength, take hits, hit back), ranged as rangers (agility, from a distance), mages as maesters (intellect, spells). Each class has six skills and three slots on the bar. Every hero dodges, and the dodge makes you untouchable for a moment — learn it before anything else. New champions are unlocked by rescue quests and by bosses.
9. **How big is it?**
   A whole continent in 3D, nine regions, from your house's seat to beyond the Wall. Levels 1 to 60 in one life; the last region starts at level 50. Nine bosses, three dungeons, a main quest chain and side quests at the castles, towns and camps.
10. **Can we play together? Is there PvP?**
   You share the map and the zone chat with everyone in your region, so you can stand next to a friend and fight the same horde. There is no party system and no PvP in this version. If that changes, this answer changes.

---

## (g) Launch week, day by day

Evening of the audience's time zone. Every day: answer every reply within a few hours; in the evening read `rpg_saves` (how many new
players, how long their first hero lived, where it stopped) and write the number next to the channel in your notes before planning the next day.

| Day | Channel (`s_tg`) | X (`s_x1`) | Short video (`s_tt1`) | DMs / groups |
|---|---|---|---|---|
| 1 | Post 1, the open map + the 20 s trailer; pin it | X 1 + the square video | Caption 1, the 8 s cut | 5 DMs to close friends: the referral line, by hand |
| 2 | Post 2, the first boss + the boss clip | X 2 + the boss cut | — | one Telegram group (ask the admin first) |
| 3 | Post 3, the Hall of the Fallen (your own real lines) | X 3 + the Hall screen | Caption 3 | 5 DMs |
| 4 | Post 4, the zone chat | X 4 + the map screen | — | one group |
| 5 | Post 5, dungeons + clip | X 5 and X 6 | Caption 2, re-cut with a new first second | 5 DMs |
| 6 | Post 6, the Wall | X 7 + screenshot | — | ask the players who answered for one friend each |
| 7 | Post 7, spotlight (real numbers only, the player asked first) | X 8 and X 9 | — | one group |
| 8 | Post 8, what's next + the vote | X 10 + the dungeon cut | — | thank everyone |

Stop rule: if most first heroes fall before the first boss and the players do not send a second one, the week pauses, the game gets fixed,
and the next post is about the fix.
