# v1.5.0 polish batch — what is left (2026-11-08)

Sixteen agents worked in parallel on the v1.5.0 polish batch. Three finished and are in v1.5.0 (champion demo animations II,
the tower/spell rooms' head row, the card-need rounding fix). The other thirteen were stopped by the account's usage limit
mid-work; their uncommitted changes are kept here as plain `git diff` patches against commit `b12d7ea` (v1.4.9), **unverified**
(tests not run to the end, screenshots not reviewed). Apply one with `git apply --3way docs/wip-v150/<name>.patch`, finish it,
test it, then delete the patch.

| Patch | What it was doing | State |
|---|---|---|
| `ui150.patch` | Design tokens + role rules for buttons/headings/cards, >= 44 px taps; `ui150.css`, part `98zz_ui150.py`, `t_ui150.js`, audit scripts | tried on top of v1.5.1: its own test fails 7 assertions written against the old screens and it shrinks 16 Shop texts under 13 px - needs a rewrite against the new Home / Shop / Trials, not an apply |
| `newplayer150.patch` | New-player flow fixes across coach/story/tut107/trials138/deck144 | no test file, unreviewed - apply with care, one hunk at a time |

Applied and finished in v1.5.1: home150, flow150, shop150, deck150, trials150, battlefix150 (fixes 1-3; the CALL WAVE pad-avoidance was dropped), chest150, tests-hardening.

Not started / nothing to keep: the menu text sweep (Daily tab + Shop unlock label wrapping), the performance audit, the
Bleed/Bloodmagic cap measurement (its bot runs produced no report), the adversarial review beyond the rounding fix.
