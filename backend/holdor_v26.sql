-- ============================================================
--  HOLDOR backend v26 (2026-10-04) — the realm war rewards (game v1.0.94)
--  Run AFTER holdor_v25.sql. Safe to re-run.
--  The war of LAST week (Monday–Sunday UTC) is settled by whoever asks: a player who played on 3+ days of that week claims once
--  (per player and week, not per seat — the reward goes to the seat that claims):
--    his realm finished 1st / 2nd / 3rd  → 3000 gold + 50 dragonglass / 2000 + 30 / 1000 + 15;
--    any other realm                     → 300 gold for taking part.
--  The settings are in econ_config 'war' (the owner can change them without a new version). A week that is not claimed by the
--  end of the following week is lost: only the last finished week can be claimed.
-- ============================================================
insert into econ_config (k, v) values ('war', '{"min_days":3,"top":[{"gold":3000,"gems":50},{"gold":2000,"gems":30},{"gold":1000,"gems":15}],"part":{"gold":300}}'::jsonb)
on conflict (k) do update set v = excluded.v;
create table if not exists war_claims (
  tg_id bigint not null references players(tg_id) on delete cascade, week date not null, seat smallint not null, realm int, pos int, reward jsonb not null,
  at timestamptz not null default now(), primary key (tg_id, week));
alter table war_claims enable row level security;

-- the standings of any week (v25's helper, now with the week as a parameter), and the current week's wrapper
create or replace function realm_war_rows_at(wk date) returns table (realm int, players int, active int, avg50 numeric, total int, score numeric, pos int)
language sql stable security definer set search_path = public as $$
  with w as (select wk as w0),
  pw as (select d.realm, d.tg_id, sum(d.waves)::int pts, count(*)::int days from daily_scores d, w where d.day >= w.w0 and d.day < w.w0 + 7 and d.waves > 0 and d.realm between 0 and 192 group by d.realm, d.tg_id),
  rk as (select pw.*, row_number() over (partition by pw.realm order by pw.pts desc, pw.tg_id) rn from pw),
  rs as (select rk.realm, count(*)::int players, (count(*) filter (where rk.days >= 3))::int active, round(avg(rk.pts) filter (where rk.rn <= 50), 1) avg50, sum(rk.pts)::int total from rk group by rk.realm),
  sc as (select rs.*, round(coalesce(rs.avg50, 0) + 0.5 * least(rs.active, 40), 1) score from rs)
  select sc.realm, sc.players, sc.active, sc.avg50, sc.total, sc.score, (rank() over (order by sc.score desc, sc.total desc, sc.realm))::int from sc;
$$;
revoke all on function realm_war_rows_at(date) from public, anon, authenticated;
create or replace function realm_war_rows() returns table (realm int, players int, active int, avg50 numeric, total int, score numeric, pos int)
language sql stable security definer set search_path = public as $$
  select * from realm_war_rows_at(date_trunc('week', (now() at time zone 'utc'))::date);
$$;
revoke all on function realm_war_rows() from public, anon, authenticated;

-- what one player gets for last week (read-only)
create or replace function war_last(pid bigint) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w0 date := date_trunc('week', (now() at time zone 'utc'))::date - 7; cfg jsonb := econ_cfg('war'); mr int; days int; pts int; r record; rew jsonb; el boolean; why text; nreal int; cl boolean;
begin
  select d.realm into mr from daily_scores d where d.tg_id = pid and d.day >= w0 and d.day < w0 + 7 and d.waves > 0 order by d.day desc limit 1;
  select coalesce(sum(d.waves), 0)::int, (count(*) filter (where d.waves > 0))::int into pts, days from daily_scores d where d.tg_id = pid and d.day >= w0 and d.day < w0 + 7;
  select x.pos, x.score into r from realm_war_rows_at(w0) x where x.realm = mr;
  select count(*)::int into nreal from realm_war_rows_at(w0);
  cl := exists (select 1 from war_claims c where c.tg_id = pid and c.week = w0);
  el := mr is not null and days >= ec_i(cfg, 'min_days');
  if mr is null then why := 'no Hold run last week';
  elsif days < ec_i(cfg, 'min_days') then why := 'play on ' || ec_i(cfg, 'min_days') || ' days of a week to qualify'; end if;
  if el then rew := case when r.pos <= 3 then cfg->'top'->(r.pos - 1) else cfg->'part' end; end if;
  return jsonb_build_object('week_start', w0, 'realm', mr, 'pos', r.pos, 'score', r.score, 'realms', nreal, 'points', pts, 'days', days, 'eligible', el, 'why', why, 'reward', rew, 'claimed', cl);
end $$;
revoke all on function war_last(bigint) from public, anon, authenticated;

create or replace function war_state(token uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin return jsonb_build_object('last', war_last(ec_session(token))); end $$;

create or replace function war_claim(token uuid, seat int) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); l jsonb; w wallets; rew jsonb;
begin
  l := war_last(pid);
  if not (l->>'eligible')::boolean then raise exception '%', coalesce(l->>'why', 'not eligible'); end if;
  if (l->>'claimed')::boolean then raise exception 'already claimed'; end if;
  rew := l->'reward';
  w := ec_wallet(pid, seat); w := ec_energy(w);
  insert into war_claims (tg_id, week, seat, realm, pos, reward) values (pid, (l->>'week_start')::date, seat, (l->>'realm')::int, (l->>'pos')::int, rew);
  w := qs_pay(w, rew, 'war', l->>'week_start');
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', rew, 'state', ec_state(w), 'last', war_last(pid));
end $$;
revoke all on function war_state(uuid), war_claim(uuid, int) from public;
grant execute on function war_state(uuid), war_claim(uuid, int) to anon, authenticated;

-- the owner's view: what was paid for the weeks
create or replace view v_war_paid as
  select c.week, c.pos, c.realm, count(*) as players, sum((c.reward->>'gold')::int) as gold, sum(coalesce((c.reward->>'gems')::int, 0)) as gems from war_claims c group by 1, 2, 3 order by 1 desc, 2;
revoke all on v_war_paid from anon, authenticated;
