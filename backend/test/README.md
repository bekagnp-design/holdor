# Local backend test (Supabase emulation)

Every SQL file is verified here before it goes to Supabase: a local PostgreSQL 16 laid out like Supabase
(pgcrypto in an `extensions` schema, roles `anon` / `authenticated`) and a tiny PostgREST-like shim.

1. `service postgresql start`, then as the `postgres` user (password `pg` for the shim):
   ```sql
   create role anon nologin; create role authenticated nologin;
   create schema if not exists extensions; create extension if not exists pgcrypto schema extensions;
   ```
2. Load the backend in order, with the placeholder token replaced by the TEST token (never the real one):
   `sed 's/PASTE_BOT_TOKEN_HERE/123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz/' ../holdor_supabase.sql | psql`,
   then `holdor_fix1.sql`, `holdor_v2.sql`, `holdor_stats.sql`, `test/prod_like.sql` (the production data, pseudonymised), `holdor_v3.sql`, `holdor_v4.sql`, `holdor_v5.sql`, `holdor_econ_data.sql`, `holdor_v6.sql`, `holdor_v7.sql`, `holdor_v8.sql`, `holdor_v9.sql`, `holdor_v10.sql`.
3. `pip install psycopg2-binary playwright` and `python3 fakerest.py &` (serves `POST /rest/v1/rpc/<fn>` on :8787, apikey `TESTANONKEY_1234567890abcdef`, runs every call as `anon`).
4. `python3 src/build.py && python3 backend/test/prepare.py` — writes `index_test.html` + a freshly signed `init.txt` (`tg_check` rejects initData older than 7 days).
5. `python3 backend/test/seat_test.py` — seeds its own rows (test user 777000123 with two seats from before v5, second player "B K" 555), then: two seats → two rows, Hold runs through `battle_start` / `battle_finish`, ranks, wipe, second device. Re-runnable. `v3_*.sql` are older SQL-level checks (`v3_test.sql` seeds, `v3_calls.sql` / `v3_wipe.sql` call).
6. `python3 backend/test/v4_test.py` — v4 at SQL level on the production-shaped data (52 checks: the rebuilt seat rows, the old app's
   calls without a seat, stale saves, new / deleted / re-created seats, garbage save values, what anon may call). Re-runnable.
7. `python3 backend/test/old_app_test.py` — the live build (root `index.html`) against the current backend in a browser (an older app must keep working).
8. `python3 backend/test/realms_test.py` — the beta build's realm screens against the SQL: every number shown equals the database.
9. `python3 backend/test/v5_test.py` — v5 (the server economy) at SQL level: legacy import, every operation, dedupe, deals, battles, chests, tampered saves, seats replaced / deleted, ledger = balance, anon denials.
10. `python3 backend/test/econ_test.py` — the beta build on a managed seat with real taps (new seat, tutorial gift, wins and refused wins, purchases, a tampered balance, shop, chests, energy, offline queue, Hold, reload): the app's numbers always equal the server's.
11. `python3 backend/test/v6_test.py` / `gear_test.py` — gear (v6) at SQL level, and the forge in the app with taps.
12. `python3 backend/test/v7_test.py` — card copies on the server (v7): import and cleaning, levels with and without copies, chest stacks, first wins, deals.
13. `python3 backend/test/v8_test.py` — champions (v8): rarities, the star cap, raising a star (refusals too), skill ranks with books, chest books, book deals, the summon, ledger = wallet.
14. `python3 backend/test/tavern_test.py` — the tavern in the app on a managed seat with taps: a star, a level past the old cap, a skill rank with books, ten summons, a chest with books — the app's numbers equal the server's.
15. `python3 backend/test/v9_test.py` / `stars_test.py` — Telegram Stars (v9): the payment SQL through the local Edge Function (`node backend/test/edge_shim.mjs` serves the function on :8788 and a fake Telegram on :8789; `fakerest.py` forwards `/functions/v1/*` to it and knows a service key), then the app buying with taps. `run_all.sh` starts both.

16. `python3 backend/test/v10_test.py` / `daily_test.py` — the login calendar and quests (v10) at SQL level, then in the app with taps.

Or everything at once, from an empty database: `CHROMIUM_PATH=/path/to/chrome bash backend/test/run_all.sh`
(the browser tests take `CHROMIUM_PATH` like the Playwright suites in `tests/`). If `holdor_v3.sql` is ever re-run, run `holdor_v4.sql` (and then `holdor_v5.sql` + `holdor_econ_data.sql`) right after it.
