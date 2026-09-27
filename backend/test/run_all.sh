#!/usr/bin/env bash
# Every local backend check, from an empty LOCAL database (su postgres → the local socket; never a Supabase project):
# the production history (v1 → fix1 → v2 → stats), the production-shaped data (prod_like.sql), v3, v4, then the tests.
# Needs: service postgresql start, README step 1 done once (roles, pgcrypto), pip install psycopg2-binary playwright,
# CHROMIUM_PATH pointing at a Chromium for the browser tests.   Run: bash backend/test/run_all.sh
set -uo pipefail
T="$(cd "$(dirname "$0")" && pwd)"; B="$(dirname "$T")"; R="$(dirname "$B")"
load() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -o /dev/null" || { echo "load failed: $1"; exit 1; }; }
load reset <<'SQL'
drop table if exists daily_scores, scores, sessions, players, app_secrets cascade;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  loop execute 'drop function ' || f.sig || ' cascade'; end loop; end $$;
SQL
sed 's/PASTE_BOT_TOKEN_HERE/123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz/' "$B/holdor_supabase.sql" | load holdor_supabase.sql
for f in holdor_fix1.sql holdor_v2.sql holdor_stats.sql test/prod_like.sql holdor_v3.sql holdor_v4.sql; do load "$f" < "$B/$f"; done
echo "loaded: v1 → fix1 → v2 → stats → prod_like → v3 → v4"
pgrep -f "backend/test/fakerest.py" >/dev/null || { python3 "$T/fakerest.py" >/dev/null 2>&1 & sleep 1; }
python3 "$R/src/build.py" >/dev/null && python3 "$T/prepare.py" >/dev/null
bad=0
# order matters: v4_test leaves Hold runs for today, which would move seat_test's expected ranks
for t in realms_test.py seat_test.py old_app_test.py v4_test.py; do
  if python3 "$T/$t" > "/tmp/holdor_$t.log" 2>&1; then echo "OK   $t"; else echo "FAIL $t  (see /tmp/holdor_$t.log)"; grep -E "^FAIL" "/tmp/holdor_$t.log" | head -5; bad=$((bad+1)); fi
done
[ $bad -eq 0 ] && echo "all backend checks OK" || echo "$bad backend check(s) failed"
exit $bad
