# Heavy Gold — module contract

The core game is `src/gold/index.tpl.html`, owned by the integrator. Modules are `src/gold/js/NN_name.js`, one plain script each, and
talk to the core only through `window.G`. `python3 src/build_gold.py [out]` inlines every module, sorted by name, into one HTML file
(default `beta/index.html`). Each module is wrapped in a try/catch, so a module that throws shows in `#err` and the game still runs.
The tests are `tests/gold/t_*.js` (Playwright, `GOLD_HTML` = the built file; Chromium at `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`).
In a test, route `/telegram\.org|supabase\.co/` to abort unless the test mocks it. `t_gold.js` must stay ALL OK.

## The game (rules the owner chose, 2026-11-23)
- 8 heroes: you and 7 bots. Bots are always labelled "bot" and are never counted as players.
- The map is 4000×4000. A round is 150 s.
- Coins appear one a second, worth 8, then 4 after 50 s, then 2 after 100 s.
- On contact the lighter hero robs the heavier one: 35% of the victim's carry, half to the thief, half spilled.
- 2 vaults move every 20 s. Standing 1.5 s in one banks your carry, and a hero in a vault cannot be robbed. Only banked gold scores.
- Gods: Hermes (dash), Thor (thunder: richer rivals in reach spill), Loki (vanish + decoy), Amirani (chains: unrobbable 3 s).
- Gold is conserved: `G.total() === G.S.minted` at all times. A module that moves gold must keep that true (spill gold as coins, never delete it).

## UI rules (the owner, 2026-11-23: "too much text")
Every screen must read in one glance. These rules hold for the core and for every module.
- **Icons and numbers, not sentences.** A label is 1–3 words. No line explains a rule (the core's Rules screen does that, once).
  No breakdowns, no "why" lines, no repeated facts (the map number, the bots, the round length are not repeated on every screen).
- **One dominant primary button per screen** (`.pri`). Other actions are icon buttons.
- **Icon buttons** in the link rows (`#titleLinks` on the title, `#endLinks` on the end screen):
  `<button class="ib"><i>ICON</i><span>Word</span></button>`: one emoji or symbol, one word under it, ≥ 52 px. `.ib.on` = a toggle that is on.
  No `.sec` text buttons in those rows. A module may add a dot or a small number badge to its icon.
- **Toasts** ≤ 6 words and start with the number or an icon: `+12 from Ares`, `−20 · Odin robbed you`, `🏦 +40`, `⚡ −8 · Thor`,
  `Vaults move · 3 s`, `Halving · a coin is worth 4`, `20 s left · bank it or lose it`, `No richer rival near`.
- **The end screen**: `#eRank` (#2 of 8), `#eGold` (🏦 banked, big), `#eLines` (three tiles: robs, stolen, unbanked, and the winner line).
  A module adds at most **one short line** to `#endExtra` (e.g. `Week #3 · 240 🪙`, an XP bar), or an icon to `#endLinks`.
- **Server state** in one short line: `Offline · saved on this phone`, never a paragraph.
- **A module's own screen** (boards, ladder, chat, card, online lobby): a 1–2 word title, the rows (flag, name, number), one primary
  button or Close, at most one short hint line.
- **HUD**: `#hTL` 💰 carry / 🏦 banked; `#hTC` the clock, the coin's worth (`.coin`) and `½ in N s`; `#hTR` the top 4; `#sk` the god's
  sign (a canvas) with the seconds left while it recharges. A HUD chip says at most 2 words.
- Core elements: `#gdesc` (the picked god's one line), `#help` (the Rules screen) opened by `#helpB` (the last icon of `#titleLinks`),
  `#endLinks` (the core's `#share` "Invite" and `#change` "God" icons; modules may append), `.coin`, `.tiles` / `.tile`, `.ib`.
  The first 3 rounds show two tips (`hg_tips` in localStorage), later rounds none.

## window.G
- State: `G.S` (round state: `t, ps[], me, coins[], vaults[], minted, over`; a hero has `name, god, bot, x, y, carry, bank, robs, lost, cd, imm, inv`),
  `G.god` (the picked god), `G.GODS` (`{n, c, sk, d, cd}` by key), `G.WORLD`, `G.ROUND`, `G.HALVE_T`, `G.BANK_T`, `G.ROB`, `G.BOTS`, `G.W` / `G.H` (viewport).
- Calls: `G.start(god)`, `G.step(n)` (n fixed 1/60 s steps, for tests), `G.useSkill(p)`, `G.toast(text, ms)`, `G.haptic(kind)`, `G.sym(ctx, god, x, y, size)`,
  `G.radius(p)`, `G.dist(a, b)`, `G.nearestVault(p)`, `G.fx({kind:'ring'|'text', x, y, r|s, c, life})`, `G.total()`, `G.rnd()`, `G.$(id)`, `G.showErr(msg)`, `G.TG` (Telegram.WebApp or null).
- `G.profile = { name, country }`: the profile module fills it in; `country` is an ISO 3166-1 alpha-2 code.
- `G.beforePlay = () => false` holds PLAY back (the profile module uses it until a name and a country are chosen).
- Events, `G.on(event, fn)`:
  - `start(S)`, `step(dt)` (every fixed step), `pickup(p, coin)`, `rob(thief, victim, take, loss)`, `bank(p, amount)`, `skill(p)`;
  - `end(S, res)`, where `res = {rank, of, bank, god, robs, lost, carry, minted, best}`;
  - `draw(ctx, k, ox, oy)`: world drawing; world→screen is `x*k + ox`;
  - `hud(S)` (10 times a second during a round), `title()` (the title screen shows again).
- Modifiers, `G.addMod(name, (p, value) => newValue)`:
  - per hero: `speed`, `cd` (skill cooldown s), `dash` (s), `thorR` (radius), `thorShare`, `lokiT` (s), `chainT` (s), `rob` (the share a victim loses), `bankT` (s);
  - `coinValue` (p = null; the worth of the next coin);
  - `view` (p = me; camera scale).
- Slots, empty `<div>`s you may fill:
  - title screen: `#titleExtra` (above PLAY), `#titleLinks` (below PLAY: put `.sec` buttons there);
  - end screen: `#endExtra` (one short line per module) and `#endLinks` (icon buttons);
  - HUD: `#hudExtra` (an absolutely positioned layer; give your element `pointer-events:auto` only if it is tapped).
- Screens: a module that needs a full screen adds its own `<div class="scr">` to `document.body` and toggles `.on`. Use the core classes
  `.pri` (one per screen), `.sec`, `.small`, `.big`, `.lines`. The UI is English, every target is ≥ 44 px, and the palette is dark with gold `#e8b84a`.

## Server (Supabase, `backend/holdor_g1.sql`)
- Project URL: `https://acimxvnupgpronpohheb.supabase.co`. Publishable key: `sb_publishable_IdiZ6FC3GwAEZ8AkBeBg0g_doDtulMB`.
- Call a function with `POST {url}/rest/v1/rpc/{name}`, headers `apikey` and `Authorization: Bearer {key}`, a JSON body.
- Login: the existing `tg_login(init_data text) → {token, tg_id, ...}`, with `init_data` = `Telegram.WebApp.initData`. Without Telegram the game is offline: everything local, and the boards say "Open in Telegram".
- New functions:
  - `hg_profile_get(token uuid) → {name, country}`, or `{}` when there is no profile yet.
  - `hg_profile_set(token uuid, name text, country text) → {ok:true, name, country}`, or `{error: 'bad_name'|'name_taken'|'bad_country'}`.
    The name is 3–16 characters: letters (any script), digits, space, `_` or `-`. It is unique ignoring case.
  - `hg_round_submit(token uuid, r jsonb) → {ok:true, week:{total, best, rounds, rank}}`, or `{error:'too_fast'|'bad_round'|'no_profile'}`.
    `r = {god, banked, rank, heroes, robs, lost, minted, day}`. The server refuses:
    - a round less than 140 s after the same player's previous one, or a 101st round within 24 h;
    - heroes other than 8;
    - minted above 812 (1218 with day 'freya' on a UTC Friday);
    - banked outside 0..minted, or banked × rank > minted.
    Names are NFKC-normalised, with no invisible fillers, no Latin mixed with Cyrillic or Greek, and no word from `chat_words`. The country must be in the ISO list.
  - `hg_board(token uuid, scope text) → {scope, since, players:[{name, country, total, best, rounds, mine}], me:{rank, total, best, rounds} | null,
    countries:[{country, players, rounds, gold}], totals:{players, rounds}}`.
    `scope` is `'week'` (since Monday 00:00 UTC), `'last'` (the previous full week, Monday to Monday UTC, with `until`) or `'all'`. The list holds the top 20 players by total banked, and every country. The token may be null, giving `me` = null.
- The owner's request: the title screen shows LAST WEEK'S CHAMPIONS, the top 3 players big, each with the flag next to the name. It falls back to "THIS WEEK SO FAR", and shows nothing when there are no rounds.
- Never show a Telegram id. Every number shown is real server data or the player's own save; nothing is invented.

## Ownership
| Module | Files |
|---|---|
| core | `src/gold/index.tpl.html`, `src/build_gold.py`, `tests/gold/t_gold.js` (integrator) |
| backend | `backend/holdor_g1.sql`, `backend/test/g1_test.py` |
| net + profile + boards | `src/gold/js/10_net.js`, `src/gold/js/20_profile.js`, `src/gold/js/30_board.js`, `tests/gold/t_profile.js`, `tests/gold/t_board.js` |
| day god | `src/gold/js/40_daygod.js`, `tests/gold/t_daygod.js` |
| training | `src/gold/js/50_training.js`, `tests/gold/t_training.js` |
| sound + minimap | `src/gold/js/60_sfx.js`, `src/gold/js/70_minimap.js`, `tests/gold/t_sfx_minimap.js` |

## Wave 5 (the owner's answers, 2026-11-23)
The owner chose:
- a share card with Telegram Stories;
- the daily map (done in the core: `G.mapNo`, `G.setMap(n)`; `res.map` in the `end` event);
- a country ladder with weekly duels;
- world and country chat;
- a champion's crown in the game and on the boards;
- online play over Supabase Realtime, with PLAY ONLINE matching players automatically;
- Telegram login only;
- bot notifications later, not now.

### Server (`backend/holdor_g2.sql`, additive on top of g1; the same session and token rules)
- **Chat:**
  - `hg_chat_send(token uuid, channel text, body text) → {ok:true, msg}`, or `{error:'auth'|'no_profile'|'bad_channel'|'too_long'|'empty'|'rate'}`.
  - `channel` is `'world'` or `'c:XX'`, and XX must be the caller's own profile country.
  - The body is trimmed, 1–200 characters, with control characters removed.
  - Rate limit: 10 messages a minute and 1 per 2 s per player, serialised with an advisory lock.
  - `hg_chat_list(token uuid, channel text, since bigint default 0) → {msgs:[{id, name, country, body, at, mine, crown}]}`: the last 50 with id > since, oldest first.
    The caller's blocked names are hidden. A country channel can only be read by its own members.
  - `hg_chat_block(token uuid, name text) → {ok}`, and `hg_chat_report(token uuid, id bigint) → {ok}`. A message with 3 or more reports from different players is hidden for everyone.
- **Country ladder:** weekly duels, Monday 00:00 UTC to Monday.
  - **The ladder** is a persistent order of countries.
  - **Joining:** a country enters at the bottom the first week one of its players banks a round.
  - **Pairs:** each week the countries are paired by position. Weeks alternate, counted from Monday 2026-11-23 (ISO week 48, even): on even weeks the pairs are (1-2) (3-4)…; on odd weeks (2-3) (4-5)…, and position 1 rests.
    So a country meets the one above it one week and the one below it the next. It cannot reach #1 without beating #1.
  - **Score** = gold banked that week by the country's real players ÷ max(5, active real members). Bots count as members but never add gold. Shown and stored at 2 decimals; the winner is decided on exact values.
  - **Winner:** the higher score wins. If they tie, the higher position stays. The winner takes the higher of the two positions.
  - **Rollover:** the week closes lazily: the first `hg_ladder` call after Monday 00:00 UTC closes every pending week, under an advisory lock, and stores the results.
  - `hg_ladder(token uuid) → {iso_week, week_start, week_end, ladder:[{pos, country, real, bots, score, rounds, opp, opp_score, side}], mine:{country, pos, opp, score, opp_score, ends_at} | null, last:[{week, a, b, a_score, b_score, winner}]}`.
    - `side` is `'up'`, `'down'` or `'rest'`.
    - `bots` = the filler members shown with the country: `max(0, 5 - real)`, named `bot1`…`botN` by the client. They count as members but never as gold.
- **Crowns:**
  - The champion is last week's #1 player (the `'last'` board).
  - `hg_board` rows gain `crown: true` for him. `hg_profile_get` gains `crown: true` when the caller is the champion.
  - `hg_ladder` marks pos 1 as the champion country.
- **Share card:**
  - `hg_card_put(token uuid, png text) → {id, url}`, or `{error:'auth'|'too_big'|'rate'|'bad_png'}`.
    `png` is base64 PNG data, at most 400 KB decoded, and must start with the PNG signature. Limit: 6 an hour per player.
  - The Edge Function `hg-card` (in `backend/edge/hg-card/index.ts`): `GET /functions/v1/hg-card?id=<uuid>` returns `image/png` (cache 1 day, 404 when missing).
    It reads with the service role from the table `hg_cards(id uuid, tg_id, png bytea, at)`. A card lives 1 day; a player keeps the images of his newest 3; all cards together stay under 50 MB (a put past that answers 'rate'); the PNG frame (IHDR first, IEND last) is checked.
    `url` is that public function URL. Telegram's `shareToStory(url, {text, widget_link})` needs a public https image.
- **Online:** no tables. The game uses Supabase Realtime broadcast and presence channels with the publishable key (public channels).
  Results still go through `hg_round_submit`, with `r.mode = 'online'` and `r.map`; the server ignores keys it does not know.

### Client modules (wave 5)
| Module | Files |
|---|---|
| chat | `src/gold/js/35_chat.js`, `tests/gold/t_chat.js` |
| ladder + crowns | `src/gold/js/36_ladder.js`, `tests/gold/t_ladder.js`; may also change `src/gold/js/30_board.js` (crowns in rows, the podium) |
| share card | `src/gold/js/80_card.js`, `tests/gold/t_card.js` |
| online | `src/gold/js/90_online.js`, `tests/gold/t_online.js`; may change the core `src/gold/index.tpl.html` only to add hooks for remote heroes (documented in this file) |
| backend | `backend/holdor_g2.sql`, `backend/test/g2_test.py`, `backend/edge/hg-card/index.ts` |

### Online hooks (the core, for `90_online.js`)
Solo play is unchanged: `G.start(god)` with no second argument builds the same round as before, and `t_gold.js` passes as it is.
- **`G.start(god, o)`**, with `o = {seats, client, map}`, starts an online round.
  - `seats` = `[{u, name, god, flag, me}]`: the real players first. The hero id is the seat index. The rest are filled with the same 7 bots as in solo (`BOTN`, `GK[(i+1)%4]`).
  - A hero gets `p.u` (the player's id in the room), `p.flag` (an emoji) and `p.net` (true for every real player who is not me).
  - `map` is the host's map number, for this round only (`G.setMap` is not touched). Spawns and vaults come from it, so every page starts alike.
  - `client: true` sets `S.client`, and `S.online` is set either way.
- **On a client (`S.client`)** the core step:
  - still runs the clock, the halving and 20-second toasts, the hero's own movement, and the push-apart between the hero and the others (no `contact()`), then emits `step`;
  - does **not** mint coins, move vaults, run bots or decoys, pick up coins, bank, rob, or end the round. The module brings all of that from the host's state and ends the round with **`G.finish()`**;
  - a client gets no start coins and has `S.minted = 0` until the first state.
- **`useSkill(me)` on a client** sets the cooldown and the local feel: Hermes's dash moves him, Loki's `inv` and Amirani's `imm` show at once, and a ring is drawn. It emits `skill`, and the module sends the press to the host, which runs the real skill.
- **The host** runs the core as in solo. Remote heroes (`p.net`) are not moved by the core (the module places them from their inputs). A touch with a remote hero counts **`NET_REACH` = 12** units farther than the bodies' edge, because a remote position is a little old. The push itself starts only at the edge, as in solo.
- **A new event:** `thunder(thor, victim, loss)`, once for each rival that Thor's strike hits.
- **`end` / `res`:** in an online round `res` also has `mode: 'online'` and `players` (the real players).
  - The end lines name a winner as "(bot)" only when he is a bot, and say "N other players and M bots".
  - The winner's name and the HUD board names are HTML-escaped (`esc`), because online names come from other players.
  - The HUD board marks bots "(bot)" in an online round and shows the players' flags.
- **Drawing:** a hero's label is `flag + name`, then `· bot` for a bot or `· <p.tag>` (the module sets `p.tag = 'left'` for a player who has gone).
- **Also on `G`:** `finish`, `NET_REACH`, `VAULT_MOVE`, `VAULT_WARN`, `COIN_T`.

### Online play (`90_online.js`, over Supabase Realtime)
- **The socket:**
  - The URL is `wss://acimxvnupgpronpohheb.supabase.co/realtime/v1/websocket?apikey=<publishable key>&vsn=1.0.0`. `G.online.url` (or `window.HG_ONLINE_URL`) overrides it for tests.
  - It speaks Phoenix JSON (`topic, event, payload, ref, join_ref`): `phx_join` with `config {broadcast:{self:false, ack:false}, presence:{enabled, key}, postgres_changes:[], private:false}`, broadcast, presence track, and a heartbeat on `phoenix` every 20 s.
  - It reconnects after 1, 2, 5 and 10 s, then rejoins every channel and tracks again.
  - `phx_error` / `phx_close` count only for the channel's current join ref (Phoenix closes the old join of a duplicate with the old ref); a channel then rejoins once, 1.5 s later.
  - It is opened only after PLAY ONLINE is tapped and closed after the round.
- **The channels:**
  - `hg-lobby`: presence. Only the host of a forming room tracks there, with `{r: code, n, o: 1, e: deadline}`.
  - `hg-r-<code>`: the room. Presence holds one key per player, `0|1 + time36 + uid`, with the meta `{u, n, c, g}`. Broadcasts: `room` (the countdown), `go` (the seats), `s` (the state), `hold`, `mv`.
  - `hg-u-<code>-<uid>`: a player's own inputs (`i`). Only the host joins it, so an input costs 2 messages instead of N.
- **The host** is the lowest key that is not passed over. It changes only when the host leaves the presence or is silent (no `room` message for 4.5 s while waiting, no state for 2.5 s during play).
  - Messages carry `{hk, ep}`. A newer epoch wins; in the same epoch the lower key wins. A host that hears a newer one steps down to a client.
  - The next host goes on from its last state. Its coins come from the coin map, and every carry, bank and `minted` from the same message, so the gold stays conserved. If a lost message opened a gap, the missing gold is kept as one coin, never invented.
- **The state** goes out 4 times a second: `{t, mi, vn, p: [[id, x, y, vx, vy, carry, bank, robs, lost, best, imm, inv, bankT, flags]], v, d, e, ca/cr | cf, seats, map, fin}`.
  - Coins go as deltas, with a full list every 8th state.
  - The events: `r` robbery, `b` bank, `k` skill, `t` thunder, `m` Thor missed, `l` lightning.
  - Clients draw the others 0.3 s in the past. A client's own coin pickups hide at once, and their gold counts in his carry until the host decides, so `G.total() === G.S.minted` holds on a client too.
- **Inputs** are `{sq, x, y, vx, vy, sk, m}`: 5 a second while moving (4 a second with 6 or more players) and 1 a second standing still.
  - `m` holds the player's own numbers (his day god and his training) for the host's `cd`, `thorR`, `thorShare`, `lokiT`, `chainT`, `rob`, `bankT`, clamped there to the legal range for his god:
    `cd` 0.595–1 × the god's, `thorR` 170–195.5, `thorShare` 0.25–0.28, `lokiT` and `chainT` 3–3.45, `rob` 0.3185–0.5, `bankT` 0.6375–1.5 (the day god's ×0.7 / ×0.5 / 0.5 with training's ±15 %).
  - `sk` is the player's running count of skill presses. The host plays one skill each time it grows; a new host adopts it from the first input it hears, so no press is replayed after a hand-over.
  - The host clamps the positions to the map and caps the move: a budget that fills at 1100 units a second up to 1200 (about the fastest legal hero, Hermes's dash on Sol's day with training), so a console edit cannot teleport a hero.
- **The round submit:** `G.net.rpc` is wrapped so that `hg_round_submit` for a round that ended online carries `r.mode = 'online'` and `r.map`.
- **The UI:**
  - PLAY ONLINE is a gold-edged `.sec`, first in `#titleLinks`, shown only when `G.net.on` inside Telegram. PLAY stays the one primary button. In a short landscape window it shares one row with the other title links.
  - PLAY ONLINE keeps PLAY's profile gate: a name and a country, and no name the server refused (`G.profileUI.needFix`).
  - Robbery and thunder toasts from the host's events name a bot "(bot)".
  - The wait screen `#hgOn` shows the countdown, the players (flag and name, YOU) and "N bots fill the empty seats". INVITE A FRIEND is the primary button; Start now (the host, 2 or more players) and Leave are secondary.
  - INVITE A FRIEND opens `t.me/share/url` with `https://t.me/HoldorTDBot/play?startapp=room_<code>` and holds the room 45 s longer (90 s at most).
  - The HUD chip `#onChip`, bottom left, says "ONLINE · N players" (or "waiting for the host…").
  - After an online round PLAY AGAIN becomes PLAY ONLINE AGAIN.
- **The Free plan:** 200 connections, 100 messages a second, 2 M messages a month, 5 presence calls per client per 30 s, 20 presence messages a second.
  - With N real players a round costs about 4N + 10(N−1) messages a second: 18 for 2 players, 46 for 4, and about 88 for 8 with the slower inputs.
  - A round of 2 costs about 2,700 messages, so 2 M a month is about 740 such rounds.
  - A player alone sends nothing during the round.
