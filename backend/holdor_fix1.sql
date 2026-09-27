-- HOLDOR — fix #1 (2026-09-13): "function hmac(bytea, bytea, unknown) does not exist"
-- On Supabase the pgcrypto extension lives in the "extensions" schema; the login check
-- could not see it. Paste into SQL Editor → Run. Nothing else changes.
create extension if not exists pgcrypto with schema extensions;
alter function tg_check(text)  set search_path = public, extensions;
alter function tg_login(text)  set search_path = public, extensions;
-- self-check: must say "bad init data" (the check now runs; it just rejects a fake string)
do $$ begin
  begin perform tg_check('x'); exception when others then raise notice 'tg_check → %', sqlerrm; end;
end $$;
