-- ============================================================
--  HOLDOR backend v33 (2026-10-29) — Mastery: two paths after a tower's last level (game v1.2.0)
--  Run AFTER holdor_v32.sql. Safe to re-run. Additive: no existing function is replaced.
--  A tower at card level 16 can be mastered: choose path A or B and buy three steps with gold (econ_config 'mastery':
--  the three prices, the price of switching, the stages that must be cleared, the towers that have Mastery).
--  The state lives in wallets.levels under 'm:<tower>': 0 = none, 1..3 = path A step, 11..13 = path B step.
--  Gold is booked through the ledger (reason 'mastery'). Switching the path costs gold and the steps start again.
-- ============================================================
insert into econ_config (k, v) values ('mastery', '{"need_stages":30,"gold":[20000,40000,80000],"swap":10000,"towers":["watch","scorp"]}'::jsonb)
  on conflict (k) do update set v = excluded.v;

create or replace function mastery_buy(token uuid, seat int, tower text, path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('mastery'); cur int; p text; s int; price bigint; nst int; v int;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  if path not in ('a', 'b') then raise exception 'bad path'; end if;
  if not (cfg->'towers') ? tower then raise exception 'no mastery for this tower'; end if;
  if ec_i(w.levels, 't:' || tower, 1) < ec_i(econ_cfg('max'), 't') then raise exception 'the tower is not at its last level'; end if;
  select count(*) into nst from progress pr where pr.tg_id = pid and pr.seat = mastery_buy.seat and pr.mode = 'c';
  if nst < ec_i(cfg, 'need_stages') then raise exception 'clear % stages first', ec_i(cfg, 'need_stages'); end if;
  cur := ec_i(w.levels, 'm:' || tower, 0);
  p := case when cur >= 11 then 'b' when cur >= 1 then 'a' else null end;
  s := case when cur >= 11 then cur - 10 else cur end;
  if p is not null and p <> path then raise exception 'switch the path first'; end if;
  if s >= 3 then raise exception 'already mastered'; end if;
  price := jint(cfg->'gold'->>s);
  w := ec_book(w, 'gold', -price, 'mastery', tower || ':' || path || ':' || (s + 1));
  v := case when path = 'b' then 10 + s + 1 else s + 1 end;
  w.levels := jsonb_set(w.levels, array['m:' || tower], to_jsonb(v));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'tower', tower, 'path', path, 'step', s + 1, 'paid', price, 'state', ec_state(w));
end $$;

create or replace function mastery_reset(token uuid, seat int, tower text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('mastery'); cur int; price bigint;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  if not (cfg->'towers') ? tower then raise exception 'no mastery for this tower'; end if;
  cur := ec_i(w.levels, 'm:' || tower, 0);
  if cur <= 0 then raise exception 'nothing to switch'; end if;
  price := jint(cfg->>'swap');
  w := ec_book(w, 'gold', -price, 'mastery', tower || ':reset');
  w.levels := jsonb_set(w.levels, array['m:' || tower], to_jsonb(0));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'tower', tower, 'paid', price, 'state', ec_state(w));
end $$;

revoke all on function mastery_buy(uuid, int, text, text), mastery_reset(uuid, int, text) from public;
grant execute on function mastery_buy(uuid, int, text, text), mastery_reset(uuid, int, text) to anon, authenticated;
