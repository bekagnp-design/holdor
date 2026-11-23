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
  - end screen: `#endExtra`;
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
  - **Pairs:** each week the countries are paired by position. On even ISO weeks the pairs are (1-2) (3-4)…; on odd weeks (2-3) (4-5)…, and position 1 rests.
    So a country meets the one above it one week and the one below it the next. It cannot reach #1 without beating #1.
  - **Score** = the average banked gold per active real member that week (a member who submitted at least one round). Bots never add gold.
  - **Winner:** the higher score wins. If they tie, the higher position stays. The winner takes the higher of the two positions.
  - **Rollover:** the week closes lazily: the first `hg_ladder` call after Monday 00:00 UTC closes every pending week, under an advisory lock, and stores the results.
  - `hg_ladder(token uuid) → {week_start, week_end, ladder:[{pos, country, real, bots, score, rounds, opp, opp_score, side}], mine:{country, pos, opp, score, opp_score, ends_at} | null, last:[{week, a, b, a_score, b_score, winner}]}`.
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
    It reads with the service role from the table `hg_cards(id uuid, tg_id, png bytea, at)`. Cards older than 30 days may be deleted.
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
