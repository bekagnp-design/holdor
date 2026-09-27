-- ============================================================
--  HOLDOR backend v3 (2026-09-26) — every seat is its own defender; all-time standings ordered by trophies
--  Before: one Telegram user = one row, so three seats on one phone shared
--  one leaderboard entry and only the best of them was kept.
--  After: rows are keyed by (tg_id, seat). Seat I keeps the old rows; seats II
--  and III get their own on their next save or Hold run. Old app versions
--  (no "seat" parameter) keep working as seat I.
--  Run AFTER holdor_supabase.sql, holdor_fix1.sql and holdor_v2.sql. Safe to re-run.
--  Paste into Supabase → SQL Editor → New query → Run.
-- ============================================================

-- ---------- 1. the seat column + new primary keys ----------
alter table scores       add column if not exists seat smallint not null default 0;
alter table daily_scores add column if not exists seat smallint not null default 0;

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'scores_pkey'
             and conrelid = 'scores'::regclass and array_length(conkey, 1) = 1) then
    alter table scores drop constraint scores_pkey;
    alter table scores add constraint scores_pkey primary key (tg_id, seat);
  end if;
  if exists (select 1 from pg_constraint where conname = 'daily_scores_pkey'
             and conrelid = 'daily_scores'::regclass and array_length(conkey, 1) = 2) then
    alter table daily_scores drop constraint daily_scores_pkey;
    alter table daily_scores add constraint daily_scores_pkey primary key (day, tg_id, seat);
  end if;
end $$;

-- ---------- 2. save: one score row per seat ----------
drop function if exists save_progress(uuid, jsonb, int, text, int, int, int, int, int);
create or replace function save_progress(token uuid, save jsonb, ver int, house text, realm int,
                                         stars int, gates int, waves int, kills int, seat int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id bigint; cur int; nm text; st int; slots jsonb;
begin
  select s.tg_id into id from sessions s where s.token = save_progress.token;
  if id is null then raise exception 'bad session'; end if;
  if pg_column_size(save) > 300000 then raise exception 'save too big'; end if;
  st := least(coalesce(save_progress.seat, 0), 2);   -- -1 = no seat chosen (nothing to score)
  update sessions set last_seen = now() where sessions.token = save_progress.token;
  select p.save_ver, p.name into cur, nm from players p where p.tg_id = id;
  if ver >= cur then
    update players p set save = save_progress.save, save_ver = ver, house = save_progress.house,
                         realm = coalesce(save_progress.realm, 0), updated_at = now()
      where p.tg_id = id;
    -- a seat deleted in the app leaves the standings (its row and today's run)
    slots := save_progress.save -> 'slots';
    if jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) >= 3 then
      delete from scores sc where sc.tg_id = id and jsonb_typeof(slots -> sc.seat::int) is distinct from 'object';
      delete from daily_scores x where x.tg_id = id and x.day = (now() at time zone 'utc')::date
        and jsonb_typeof(slots -> x.seat::int) is distinct from 'object';
    end if;
  end if;
  if st between 0 and 2 then
    insert into scores (tg_id, seat, name, house, realm, stars, gates, waves, kills)
      values (id, st::smallint, nm, house, coalesce(realm, 0), greatest(0, stars), greatest(0, gates), greatest(0, waves), greatest(0, kills))
      on conflict on constraint scores_pkey do update set
        name = excluded.name, house = coalesce(excluded.house, scores.house), realm = excluded.realm,
        stars = greatest(scores.stars, excluded.stars), gates = greatest(scores.gates, excluded.gates),
        waves = greatest(scores.waves, excluded.waves), kills = greatest(scores.kills, excluded.kills),
        updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'save_ver', greatest(cur, ver));
end $$;

-- ---------- 3. hold_result: the best run of the day, per seat ----------
drop function if exists hold_result(uuid, date, int, int);
create or replace function hold_result(token uuid, day date, waves int, kills int,
                                       seat int default 0, house text default null, realm int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id bigint; nm text; hs text; rl int; d date; st smallint;
begin
  select s.tg_id into id from sessions s where s.token = hold_result.token;
  if id is null then raise exception 'bad session'; end if;
  d := coalesce(hold_result.day, (now() at time zone 'utc')::date);
  if d < (now() at time zone 'utc')::date - 1 or d > (now() at time zone 'utc')::date then raise exception 'bad day'; end if;
  if hold_result.waves < 0 or hold_result.waves > 500 or hold_result.kills < 0 or hold_result.kills > 100000 then raise exception 'bad score'; end if;
  st := least(greatest(coalesce(hold_result.seat, 0), 0), 2);
  select p.name, p.house, p.realm into nm, hs, rl from players p where p.tg_id = id;
  hs := coalesce(hold_result.house, hs); rl := coalesce(hold_result.realm, rl, 0);
  insert into daily_scores (day, tg_id, seat, name, house, realm, waves, kills, runs)
    values (d, id, st, coalesce(nm,''), hs, rl, hold_result.waves, hold_result.kills, 1)
    on conflict on constraint daily_scores_pkey do update set
      name = excluded.name, house = excluded.house, realm = excluded.realm,
      waves = greatest(daily_scores.waves, excluded.waves),
      kills = greatest(daily_scores.kills, excluded.kills),
      runs = daily_scores.runs + 1, updated_at = now();
  insert into scores (tg_id, seat, name, house, realm, waves, kills)
    values (id, st, coalesce(nm,''), hs, rl, hold_result.waves, hold_result.kills)
    on conflict on constraint scores_pkey do update set
      house = coalesce(excluded.house, scores.house), realm = excluded.realm,
      waves = greatest(scores.waves, excluded.waves), kills = greatest(scores.kills, excluded.kills), updated_at = now();
  return jsonb_build_object('ok', true, 'day', d,
    'rank', (select count(*) + 1 from daily_scores o where o.day = d and (o.waves > hold_result.waves or (o.waves = hold_result.waves and o.kills > hold_result.kills))));
end $$;

-- ---------- 4. leaderboard: rows per seat; "me" is (tg_id, seat); all-time order = trophies (stars + 2 × best waves) ----------
drop function if exists leaderboard(int, bigint);
create or replace function leaderboard(realm int default null, me bigint default null, seat int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare realms jsonb; top jsonb; mine jsonb; total int; today jsonb; myday jsonb; houses jsonb; d date; st smallint;
begin
  d := (now() at time zone 'utc')::date;
  st := least(greatest(coalesce(leaderboard.seat, 0), 0), 2);
  select count(*) into total from scores;
  select coalesce(jsonb_agg(r order by r.waves desc, r.stars desc), '[]'::jsonb) into realms from (
    select s.realm, count(distinct s.tg_id) as players, count(*) as seats, sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills
      from scores s group by s.realm) r;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into top from (
    select s.tg_id, s.seat, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
           row_number() over (order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc) as rank
      from scores s
      where leaderboard.realm is null or s.realm = leaderboard.realm
      order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc limit 25) t;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into today from (
    select x.tg_id, x.seat, x.name, x.house, x.realm, x.waves, x.kills, x.runs,
           row_number() over (order by x.waves desc, x.kills desc) as rank
      from daily_scores x where x.day = d
      order by x.waves desc, x.kills desc limit 25) t;
  select coalesce(jsonb_agg(h order by h.waves desc, h.stars desc), '[]'::jsonb) into houses from (
    select s.house, count(distinct s.tg_id) as players, count(*) as seats, sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills,
           (select coalesce(sum(x.waves),0) from daily_scores x where x.day = d and x.house = s.house) as today
      from scores s where s.house is not null group by s.house) h;
  if me is not null then
    select to_jsonb(t) into mine from (
      select s.tg_id, s.seat, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
             (select count(*) + 1 from scores o where (leaderboard.realm is null or o.realm = leaderboard.realm)
                and ((o.stars + 2 * o.waves) > (s.stars + 2 * s.waves)
                     or ((o.stars + 2 * o.waves) = (s.stars + 2 * s.waves) and o.stars > s.stars)
                     or ((o.stars + 2 * o.waves) = (s.stars + 2 * s.waves) and o.stars = s.stars and o.kills > s.kills))) as rank
        from scores s where s.tg_id = me and s.seat = st) t;
    select to_jsonb(t) into myday from (
      select x.waves, x.kills, x.runs,
             (select count(*) + 1 from daily_scores o where o.day = d and (o.waves > x.waves or (o.waves = x.waves and o.kills > x.kills))) as rank
        from daily_scores x where x.day = d and x.tg_id = me and x.seat = st) t;
  end if;
  return jsonb_build_object('total', total, 'realms', realms, 'top', top, 'me', mine,
                            'today', today, 'myday', myday, 'houses', houses, 'day', d, 'at', now());
end $$;

-- ---------- 5. rebuild the all-time rows from the saves already on the server (one per seat) ----------
-- Seat I keeps its row (values can only go up); seats II/III appear now instead of after their next save.
insert into scores (tg_id, seat, name, house, realm, stars, gates, waves, kills)
  select p.tg_id, (s.ord - 1)::smallint, p.name, s.a->>'house', coalesce((s.a->>'langI')::int, 0),
         coalesce((select sum(v.value::int) from jsonb_each_text(coalesce(s.a->'campaign','{}'::jsonb)) v), 0)
           + coalesce((select sum(v.value::int) from jsonb_each_text(coalesce(s.a->'hard','{}'::jsonb)) v), 0),
         coalesce((select count(*) from jsonb_object_keys(coalesce(s.a->'campaign','{}'::jsonb))), 0),
         coalesce((s.a->'stats'->>'onlineBest')::int, 0),
         coalesce((s.a->'stats'->>'kills')::int, 0)
    from players p
    cross join lateral jsonb_array_elements(coalesce(p.save->'slots','[]'::jsonb)) with ordinality as s(a, ord)
   where jsonb_typeof(s.a) = 'object' and s.ord <= 3
  on conflict on constraint scores_pkey do update set
    house = coalesce(excluded.house, scores.house), realm = excluded.realm,
    stars = greatest(scores.stars, excluded.stars), gates = greatest(scores.gates, excluded.gates),
    waves = greatest(scores.waves, excluded.waves), kills = greatest(scores.kills, excluded.kills),
    updated_at = now();

-- ---------- 6. the app may call only these ----------
revoke all on function save_progress(uuid, jsonb, int, text, int, int, int, int, int, int) from public;
revoke all on function hold_result(uuid, date, int, int, int, text, int) from public;
revoke all on function leaderboard(int, bigint, int) from public;
grant execute on function save_progress(uuid, jsonb, int, text, int, int, int, int, int, int) to anon, authenticated;
grant execute on function hold_result(uuid, date, int, int, int, text, int) to anon, authenticated;
grant execute on function leaderboard(int, bigint, int) to anon, authenticated;

-- self-check: every seat now has its own row
select tg_id, seat, name, house, stars, gates, waves, kills from scores order by tg_id, seat;
