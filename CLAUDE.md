# HOLDOR — notes for Claude Code

**HOLDOR: Hold the Door** — a Game of Thrones–themed tower defense in one HTML file, played as a Telegram Mini App
(`t.me/HoldorTDBot/play`, opens `https://bekagnp-design.github.io/holdor/?v=N`). GitHub Pages serves this repo's root.
Owner: MR B. Talk to him in **Georgian**, direct and analytical, no praise or filler.

## Layout
| Path | What |
|---|---|
| `index.html` | **Production** — what Telegram opens. Changes only on release. |
| `beta/index.html` | Test build → `https://bekagnp-design.github.io/holdor/beta/` (MR B checks it on his phone). |
| `src/build.py` | Builds `src/base/index.v1.0.44.html` + `src/parts/*.py` → `beta/index.html` (or the path given). |
| `src/parts/NN_*.py` | Exact-string patches, run in name order. `rep(old, new, n, label)` asserts the match count; `hrep(...)` patches `src/hub.js` in memory (re-injected by `95_hubinject.py`); `mod('x.js')` reads `src/mod/`. Parts `99_exports*.py` only add `window.HOLDOR_*` test hooks. |
| `src/mod/` | Injected JS/CSS modules (cards, book, rank, castle, champs52/53/54, tutorial, coach, ring, …). |
| `src/stages.py`, `layouts.json`, `mults.json` | The 50 campaign stages, road layouts, tuned difficulty multipliers. |
| `src/tools/` | `gen_layouts.js`, `bot45.js` / `tune45.js` (balance bot), `compute_mults.py`. |
| `tests/` | Playwright suites with real taps. `node tests/run_core.js` runs the core set. Screenshots go to `.shots/`. |
| `backend/` | Supabase SQL, one file per step (`holdor_supabase.sql` → `fix1` → `v2` → `stats` → `v3` → `v4`). Applied through the Supabase connector (project `Holdor`, `acimxvnupgpronpohheb`) as named migrations, or by MR B in SQL Editor. Every file is tested first on the local copy: `backend/test/` = local Postgres + PostgREST-like shim + `prod_like.sql`; `bash backend/test/run_all.sh` runs it all. |
| `docs/` | `roadmap.md` (version plan, Georgian), `build-backlog.md` (what every version did, English), `pvp-interview.md`, art prompts. |
| `.nojekyll` | GitHub Pages serves every file as it is (no Jekyll/Liquid run over `docs/` or `src/`). Keep it. |

## Build, test, release
```
python3 src/build.py                 # → beta/index.html
node tests/run_core.js               # core suites; every line must say OK
node tests/t_champs54.js             # or one suite
```
- Tests need Playwright: `npm i`, then `npx playwright install chromium`; if the network blocks that download, set `CHROMIUM_PATH` to any installed Chromium/Chrome.
- The game runs **60 steps per game second** (`HOLDOR.step()`); write timing checks with that.
- A new version: bump `src/parts/01_version.py`, add one part file (+ `99_exportsNN.py` if tests need hooks), build, add/adapt a test, run the core set, update `docs/build-backlog.md` (one section) and `docs/roadmap.md`.
- One version = one PR that touches only `src/`, `tests/`, `docs/`, `beta/` — never the root `index.html`. MR B merges it,
  Pages serves `https://bekagnp-design.github.io/holdor/beta/` a minute or two later, he tests it on his phone.
- Release only on his word "release": a separate PR titled `vX.Y.Z` that copies `beta/index.html` → `index.html` and nothing else.
  He merges it. Never put an untested build in the root.

## Rules from MR B (do not break)
- Never ask for, paste, echo or commit the Telegram bot token. It lives only in Supabase `app_secrets`. The client carries only the Supabase URL and the publishable key.
- Every statistic shown to players is real server data — nothing invented.
- Manual steps he must do (Supabase SQL, checks) come **one at a time**, each verified before the next. SQL first, then the client that needs it.
- End every reply with the next step and one development idea.
- Kingdom Rush / KR Battles are gameplay references only: no copied names, art, maps, effects, music.
- PvP ("Duel") lives in the **Events** tab as an event card, not as a separate tab.
- Each seat (I/II/III) is its own defender on the server (`tg_id + seat`).

## State (2026-09-27)
- Built: v1.0.55 (realm statistics for everyone), in `beta/index.html`. The root `index.html` (what Telegram opens) is **v1.0.48** (uploaded by hand before this repo had source) until the first release from this repo.
- Supabase: `holdor_v3.sql` and `holdor_v4.sql` applied on 2026-09-27 (migrations `holdor_v3_seats`, `holdor_v4_realm_stats`). Since v4 the server reads every seat's numbers from the save it is sent — the numbers an app sends are ignored — so v1.0.48 and later write the same rows.
- Next: v1.0.56 — Martell kits (Poison Cloud → Ellaria), bot re-balance of all 50 stages with the 49 kits, 3-step talent tree. Then Duel I–III (see `docs/roadmap.md`, `docs/pvp-interview.md` Q29–Q32 still open).
- 42 of 49 champions have unique kits (`KITS52/53/54`); no skill pair or ultimate may repeat — `tests/t_champs54.js` checks it.
- The public leaderboard still returns Telegram ids (`tg_id`) — planned: an opaque id (backend v5).
