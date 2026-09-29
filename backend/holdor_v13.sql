-- ============================================================
--  HOLDOR backend v13 (2026-09-30) — account levels up to 60 and milestone gifts (game v1.0.65)
--  Run AFTER holdor_v12.sql. Safe to re-run.
--  * xp_level: the account level goes on to 60 (the XP curve is the same formula, 15 + 8·L + L² per level).
--  * Milestones at levels 10, 20 … 60: a gift (dragonglass, gold, books, gear) claimed once per seat through milestone_claim; the server
--    checks the level from the seat's own XP. The table is econ_config 'milestones' (the app shows exactly what the server sends).
-- ============================================================
create or replace function xp_level(xp bigint) returns int language plpgsql immutable set search_path = '' as $$
declare l int := 1; x bigint := greatest(coalesce(xp, 0), 0);
begin
  while l < 60 and x >= 15 + 8 * l + l * l loop x := x - (15 + 8 * l + l * l); l := l + 1; end loop;
  return l;
end $$;

insert into econ_config (k, v) values ('milestones', '{"10":{"gems":30,"books":{"b:c":3},"gear":{"n":1,"min_r":2,"min_tier":2}},
  "20":{"gems":60,"books":{"b:r":2},"gear":{"n":1,"min_r":2,"min_tier":3}},
  "30":{"gems":90,"gold":10000,"books":{"b:e":1},"gear":{"n":1,"min_r":3,"min_tier":3}},
  "40":{"gems":150,"gold":25000,"books":{"b:e":2},"gear":{"n":2,"min_r":3,"min_tier":3}},
  "50":{"gems":250,"gold":50000,"books":{"b:l":1},"gear":{"n":1,"min_r":4,"min_tier":4}},
  "60":{"gems":500,"gold":100000,"books":{"b:l":2},"gear":{"n":2,"min_r":4,"min_tier":5}}}'::jsonb)
on conflict (k) do update set v = excluded.v;

create or replace function ms_state(w wallets) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := econ_cfg('milestones'); lv int := xp_level(w.xp); done jsonb := coalesce(w.claims->'milestones', '[]'::jsonb); items jsonb := '[]'::jsonb; e record;
begin
  for e in select k, v from jsonb_each(cfg) as t(k, v) order by k::int loop
    items := items || jsonb_build_array(jsonb_build_object('lvl', e.k::int, 'reward', e.v, 'ready', lv >= e.k::int and not done ? e.k, 'claimed', done ? e.k));
  end loop;
  return jsonb_build_object('level', lv, 'items', items);
end $$;

create or replace function milestone_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  return ms_state(w);
end $$;

create or replace function milestone_claim(token uuid, seat int, lvl int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; r jsonb; done jsonb;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  r := econ_cfg('milestones')->(lvl::text);
  if r is null then raise exception 'no such milestone'; end if;
  if xp_level(w.xp) < lvl then raise exception 'level % of %', xp_level(w.xp), lvl; end if;
  done := coalesce(w.claims->'milestones', '[]'::jsonb);
  if done ? lvl::text then raise exception 'already claimed'; end if;
  w := qs_pay(w, r, 'milestone', lvl::text);
  w.claims := jsonb_set(w.claims, '{milestones}', done || to_jsonb(lvl::text));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', r, 'state', ec_state(w), 'milestones', ms_state(w));
end $$;

revoke all on function ms_state(wallets) from public, anon, authenticated;
revoke all on function milestone_state(uuid, int), milestone_claim(uuid, int, int) from public;
grant execute on function milestone_state(uuid, int), milestone_claim(uuid, int, int) to anon, authenticated;
