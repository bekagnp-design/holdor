#!/usr/bin/env bash
# Every local backend check, from an empty LOCAL database (su postgres → the local socket; never a Supabase project):
# the production history (v1 → fix1 → v2 → stats), the production-shaped data (prod_like.sql), v3, v4, v5 + econ data, then the tests.
# Needs: service postgresql start, README step 1 done once (roles, pgcrypto), pip install psycopg2-binary playwright,
# CHROMIUM_PATH pointing at a Chromium for the browser tests.   Run: bash backend/test/run_all.sh
set -uo pipefail
T="$(cd "$(dirname "$0")" && pwd)"; B="$(dirname "$T")"; R="$(dirname "$B")"
load() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -o /dev/null" || { echo "load failed: $1"; exit 1; }; }
load reset <<'SQL'
drop table if exists bot_starts, war_claims, chat_reports, chat_blocks, chat_mutes, chat_msgs, chat_words, task_marks, daily_scores, scores, sessions, players, app_secrets, econ_config, wallets, ledger, econ_ops, battles, progress, chests, econ_flags, battle_limits, econ_legacy, items, summons, payments, referrals, ratings, duels, ad_views cascade;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  loop execute 'drop function ' || f.sig || ' cascade'; end loop; end $$;
SQL
sed 's/PASTE_BOT_TOKEN_HERE/123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz/' "$B/holdor_supabase.sql" | load holdor_supabase.sql
for f in holdor_fix1.sql holdor_v2.sql holdor_stats.sql test/prod_like.sql holdor_v3.sql holdor_v4.sql holdor_v5.sql holdor_econ_data.sql holdor_v6.sql holdor_v7.sql holdor_v8.sql holdor_v9.sql holdor_v10.sql holdor_v11.sql holdor_v12.sql holdor_v13.sql holdor_v14.sql holdor_v15.sql holdor_v16.sql holdor_v17.sql holdor_v18.sql holdor_v19.sql holdor_v20.sql holdor_v21.sql holdor_v22.sql holdor_v23.sql holdor_v24.sql holdor_v25.sql holdor_v26.sql holdor_v27.sql holdor_v28.sql holdor_v29.sql holdor_v30.sql; do load "$f" < "$B/$f"; done
echo "loaded: v1 → fix1 → v2 → stats → prod_like → v3 → v4 → v5 → econ data → v6 → v7 → v8 → v9 → v10 → v11 → v12 → v13 → v14 → v15 → v16 → v17 → v18 → v19 → v20 → v21 → v22 → v23 → v24 → v25 → v26 → v27 → v28 → v29 → v30"
pkill -f "backend/test/fakerest.py" 2>/dev/null; pkill -f "backend/test/edge_shim.mjs" 2>/dev/null; sleep 1
python3 "$T/fakerest.py" >/dev/null 2>&1 &
node "$T/edge_shim.mjs" >/dev/null 2>&1 &
sleep 1.5
python3 "$R/src/build.py" >/dev/null && python3 "$T/prepare.py" >/dev/null
bad=0
# order matters: v4_test leaves Hold runs for today, which would move seat_test's expected ranks; v5_test uses its own players;
# econ_test (the app on a managed seat) cleans the test user first
for t in realms_test.py seat_test.py old_app_test.py v4_test.py v5_test.py v6_test.py v7_test.py v8_test.py v9_test.py v10_test.py v11_test.py v12_test.py v13_test.py v14_test.py v15_test.py v16_test.py v17_test.py v18_test.py v20_test.py v21_test.py v22_test.py v23_test.py v24_test.py v25_test.py v26_test.py v27_test.py v28_test.py v29_test.py v30_test.py econ_test.py duel_test.py season_test.py tasks_test.py gear_test.py tavern_test.py stars_test.py daily_test.py; do
  if python3 "$T/$t" > "/tmp/holdor_$t.log" 2>&1; then echo "OK   $t"; else echo "FAIL $t  (see /tmp/holdor_$t.log)"; grep -E "^FAIL" "/tmp/holdor_$t.log" | head -5; bad=$((bad+1)); fi
done
# the bot's own messages (/start, /play, /help): no database, a fake Telegram
if node "$T/bot_test.mjs" > /tmp/holdor_bot_test.log 2>&1; then echo "OK   bot_test.mjs"; else echo "FAIL bot_test.mjs  (see /tmp/holdor_bot_test.log)"; grep -E "^FAIL" /tmp/holdor_bot_test.log | head -5; bad=$((bad+1)); fi
[ $bad -eq 0 ] && echo "all backend checks OK" || echo "$bad backend check(s) failed"
exit $bad
