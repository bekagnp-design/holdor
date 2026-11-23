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
    `r = {god, banked, rank, heroes, robs, lost, minted, day}`. The server refuses a round less than 120 s after the same player's previous one,
    and refuses `banked` outside 0..min(minted, 1500).
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
