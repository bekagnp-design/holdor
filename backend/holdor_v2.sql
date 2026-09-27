-- ============================================================
--  HOLDOR backend v2 (2026-09-14) — daily Hold standings + house standings
--  Run AFTER holdor_supabase.sql and holdor_fix1.sql. Safe to re-run.
--  Paste into Supabase → SQL Editor → New query → Run.
-- ============================================================

-- one row per player per UTC day: the best run of that day
create table if not exists daily_scores (
  day        date   not null,
  tg_id      bigint not null references players(tg_id) on delete cascade,
  name       text   not null default '',
  house      text,
  realm      int    not null default 0,
  waves      int    not null default 0,
  kills      int    not null default 0,
  runs       int    not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, tg_id)
);
create index if not exists daily_scores_day_idx on daily_scores (day, waves desc, kills desc);
alter table daily_scores enable row level security;
revoke all on daily_scores from anon, authenticated;

-- 4) hold_result: called when a daily Hold run ends. Keeps the best run of the day.
create or replace function hold_result(token uuid, day date, waves int, kills int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id bigint; nm text; hs text; rl int; d date;
begin
  select s.tg_id into id from sessions s where s.token = hold_result.token;
  if id is null then raise exception 'bad session'; end if;
  d := coalesce(hold_result.day, (now() at time zone 'utc')::date);
  if d < (now() at time zone 'utc')::date - 1 or d > (now() at time zone 'utc')::date then raise exception 'bad day'; end if;
  if hold_result.waves < 0 or hold_result.waves > 500 or hold_result.kills < 0 or hold_result.kills > 100000 then raise exception 'bad score'; end if;
  select p.name, p.house, p.realm into nm, hs, rl from players p where p.tg_id = id;
  insert into daily_scores (day, tg_id, name, house, realm, waves, kills, runs)
    values (d, id, coalesce(nm,''), hs, coalesce(rl,0), hold_result.waves, hold_result.kills, 1)
    on conflict on constraint daily_scores_pkey do update set
      name = excluded.name, house = excluded.house, realm = excluded.realm,
      waves = greatest(daily_scores.waves, excluded.waves),
      kills = greatest(daily_scores.kills, excluded.kills),
      runs = daily_scores.runs + 1, updated_at = now();
  -- all-time score row too (same as save_progress would do)
  insert into scores (tg_id, name, house, realm, waves, kills)
    values (id, coalesce(nm,''), hs, coalesce(rl,0), hold_result.waves, hold_result.kills)
    on conflict (tg_id) do update set
      waves = greatest(scores.waves, excluded.waves), kills = greatest(scores.kills, excluded.kills), updated_at = now();
  return jsonb_build_object('ok', true, 'day', d,
    'rank', (select count(*) + 1 from daily_scores o where o.day = d and (o.waves > hold_result.waves or (o.waves = hold_result.waves and o.kills > hold_result.kills))));
end $$;

-- 3) leaderboard v2: + today (daily top 25 + my daily rank) + houses (all-time totals per house)
create or replace function leaderboard(realm int default null, me bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare realms jsonb; top jsonb; mine jsonb; total int; today jsonb; myday jsonb; houses jsonb; d date;
begin
  d := (now() at time zone 'utc')::date;
  select count(*) into total from scores;
  select coalesce(jsonb_agg(r order by r.waves desc, r.stars desc), '[]'::jsonb) into realms from (
    select s.realm, count(*) as players, sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills
      from scores s group by s.realm) r;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into top from (
    select s.tg_id, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
           row_number() over (order by s.stars desc, s.waves desc, s.kills desc) as rank
      from scores s
      where leaderboard.realm is null or s.realm = leaderboard.realm
      order by s.stars desc, s.waves desc, s.kills desc limit 25) t;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into today from (
    select x.tg_id, x.name, x.house, x.realm, x.waves, x.kills, x.runs,
           row_number() over (order by x.waves desc, x.kills desc) as rank
      from daily_scores x where x.day = d
      order by x.waves desc, x.kills desc limit 25) t;
  select coalesce(jsonb_agg(h order by h.waves desc, h.stars desc), '[]'::jsonb) into houses from (
    select s.house, count(*) as players, sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills,
           (select coalesce(sum(x.waves),0) from daily_scores x where x.day = d and x.house = s.house) as today
      from scores s where s.house is not null group by s.house) h;
  if me is not null then
    select to_jsonb(t) into mine from (
      select s.tg_id, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
             (select count(*) + 1 from scores o where (leaderboard.realm is null or o.realm = leaderboard.realm)
                and (o.stars > s.stars or (o.stars = s.stars and o.waves > s.waves)
                     or (o.stars = s.stars and o.waves = s.waves and o.kills > s.kills))) as rank
        from scores s where s.tg_id = me) t;
    select to_jsonb(t) into myday from (
      select x.waves, x.kills, x.runs,
             (select count(*) + 1 from daily_scores o where o.day = d and (o.waves > x.waves or (o.waves = x.waves and o.kills > x.kills))) as rank
        from daily_scores x where x.day = d and x.tg_id = me) t;
  end if;
  return jsonb_build_object('total', total, 'realms', realms, 'top', top, 'me', mine,
                            'today', today, 'myday', myday, 'houses', houses, 'day', d, 'at', now());
end $$;

revoke all on function hold_result(uuid, date, int, int) from public, anon, authenticated;
grant execute on function hold_result(uuid, date, int, int) to anon, authenticated;
grant execute on function leaderboard(int, bigint) to anon, authenticated;

-- self-check
select leaderboard();
