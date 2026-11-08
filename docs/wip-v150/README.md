# v1.5.0 polish batch — unfinished parts (2026-11-08)

Sixteen agents worked in parallel on the v1.5.0 polish batch. Three finished and are in v1.5.0 (champion demo animations II,
the tower/spell rooms' head row, the card-need rounding fix). The other thirteen were stopped by the account's usage limit
mid-work; their uncommitted changes are kept here as plain `git diff` patches against commit `b12d7ea` (v1.4.9), **unverified**
(tests not run to the end, screenshots not reviewed). Apply one with `git apply --3way docs/wip-v150/<name>.patch`, finish it,
test it, then delete the patch.

| Patch | What it was doing | State when stopped |
|---|---|---|
| `home150.patch` | Home: one dominant "⚔ BATTLE · Stage N" button, ready badges, "what opens next"; `home150.js/.css`, part `98zc_home150.py`, `t_home150.js` | tour text in onboard99.js next, not built |
| `flow150.patch` | Battle tab → prepare sheet → result: "⚔ TO BATTLE", "NEXT STAGE ›" on the first screen; `flow150.js/.css`, prepare124/build135 edits | tests being written |
| `shop150.patch` | Shop: pinned balance, "For you today" timer, green BUY / grey "Need N more"; `shop150.js/.css`, part `98zc_shop.py`, `t_shop150.js` | signed-in look worked, test being written |
| `ui150.patch` | Design tokens + role rules for buttons/headings/cards, ≥ 44 px taps; `ui150.css`, part `98zz_ui150.py`, `t_ui150.js`, audit scripts | build + screenshots pending |
| `deck150.patch` | Loadout deck + Army strip on 360×740: captions, banner above the tab bar, back returns to the deck; `t_deck150.js` | measurements passed, screenshots not reviewed |
| `trials150.patch` | Trials tab: primary button states, record line, reward breakdown; `t_trials150.js`, t_trials138 adapted | tests being written |
| `battlefix150.patch` | Battle HUD: enemy pill icon, spell label contrast under cooldown, champion bubble vs build ring; `battlefix150.js/.css`, part `98zc_battlefix.py`, `t_battlefix150.js` | written, not built/tested |
| `chest150.patch` | Chest scene: "All cards owned → gold" fill caption, have/need under a stack; part `98zc_chestfill.py` | no test yet |
| `newplayer150.patch` | New-player flow fixes across coach/story/tut107/trials138/deck144 | no test file, unreviewed — apply with care |
| `tests-hardening.patch` | Date/clock/popup-proof tests, `CORE_RETRY=1` in run_core.js; backend tests click "Later" | suites were running |

Not started / nothing to keep: the menu text sweep (Daily tab + Shop unlock label wrapping), the performance audit, the
Bleed/Bloodmagic cap measurement (its bot runs produced no report), the adversarial review beyond the rounding fix.
