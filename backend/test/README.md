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
   then `holdor_fix1.sql`, `holdor_v2.sql`, `holdor_stats.sql`, `test/prod_like.sql` (the production data, pseudonymised), `holdor_v3.sql`, `holdor_v4.sql`.
3. `pip install psycopg2-binary playwright` and `python3 fakerest.py &` (serves `POST /rest/v1/rpc/<fn>` on :8787, apikey `TESTANONKEY_1234567890abcdef`, runs every call as `anon`).
4. `python3 src/build.py && python3 backend/test/prepare.py` — writes `index_test.html` + a freshly signed `init.txt` (`tg_check` rejects initData older than 7 days).
5. `python3 backend/test/seat_test.py` — seeds its own rows (test user 777000123, second player "B K" 555), then: two seats → two rows, ranks, wipe, second device. Re-runnable. `v3_*.sql` are older SQL-level checks (`v3_test.sql` seeds, `v3_calls.sql` / `v3_wipe.sql` call).
6. `python3 backend/test/v4_test.py` — v4 at SQL level on the production-shaped data (52 checks: the rebuilt seat rows, the old app's
   calls without a seat, stale saves, new / deleted / re-created seats, garbage save values, what anon may call). Re-runnable.
7. `python3 backend/test/old_app_test.py` — the live build (root `index.html`, v1.0.48) against v3 + v4 in a browser.
8. `python3 backend/test/realms_test.py` — the beta build's realm screens against the SQL: every number shown equals the database.

Or everything at once, from an empty database: `CHROMIUM_PATH=/path/to/chrome bash backend/test/run_all.sh`
(the browser tests take `CHROMIUM_PATH` like the Playwright suites in `tests/`). If `holdor_v3.sql` is ever re-run, run `holdor_v4.sql` right after it.
