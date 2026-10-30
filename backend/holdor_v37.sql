-- ============================================================
--  HOLDOR backend v37 (2026-10-30) — the founder number (game v1.3.7)
--  Run AFTER holdor_v36.sql. Safe to re-run. One read-only function.
--  founder_no(token): the player's place in the order of signing up (1 = the first player ever), only for the first 100; otherwise null.
--  It is real: it counts the rows of `players` created before and at the player's own row. Nothing is stored and nothing is changed.
-- ============================================================
create or replace function founder_no(token uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare pid bigint; n int;
begin
  pid := ec_session(token);
  select count(*)::int into n from players p where (p.created_at, p.tg_id) <= (select (q.created_at, q.tg_id) from players q where q.tg_id = pid);
  return case when n between 1 and 100 then n else null end;
end $$;
revoke all on function founder_no(uuid) from public;
grant execute on function founder_no(uuid) to anon, authenticated;
