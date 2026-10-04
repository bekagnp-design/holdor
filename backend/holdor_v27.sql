-- ============================================================
--  HOLDOR backend v27 (2026-10-04) — the public boards no longer carry Telegram ids (game v1.0.95)
--  Run AFTER holdor_v26.sql. Safe to re-run.
--  The leaderboard (top, today, me) and the realm card (top, me) used to return `tg_id` for every defender they listed: anyone could
--  collect the Telegram ids of the top players. Now a row carries `mine` (true for the caller's own seat) instead of an id; the
--  caller says who he is with the same `me` argument as before, which only decides that flag. Nothing else about the answers changes.
-- ============================================================
create or replace function leaderboard(realm int default null, me bigint default null, seat int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare realms jsonb; top jsonb; mine jsonb; total int; nplayers int; ncountries int; today jsonb; myday jsonb; houses jsonb; d date; st smallint;
begin
  d := (now() at time zone 'utc')::date;
  st := least(greatest(coalesce(leaderboard.seat,
          (select jint(p.save->>'cur') from players p where p.tg_id = leaderboard.me), 0), 0), 2);
  select count(*), count(distinct s.tg_id), count(distinct s.realm) into total, nplayers, ncountries from scores s;
  select coalesce(jsonb_agg(r order by r.waves desc, r.stars desc, r.players desc, r.realm), '[]'::jsonb) into realms from (
    select s.realm, count(distinct s.tg_id) as players, count(*) as seats,
           sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills,
           count(distinct s.tg_id) filter (where s.updated_at > now() - interval '7 days') as active,
           coalesce(max(t.waves), 0) as today, coalesce(max(t.players), 0) as today_players
      from scores s
      left join (select x.realm, sum(x.waves) as waves, count(distinct x.tg_id) as players
                   from daily_scores x where x.day = d group by x.realm) t on t.realm = s.realm
     group by s.realm) r;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into top from (
    select coalesce(s.tg_id = leaderboard.me and s.seat = st, false) as mine, s.seat, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
           row_number() over (order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc) as rank
      from scores s
      where leaderboard.realm is null or s.realm = leaderboard.realm
      order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc limit 25) t;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into today from (
    select coalesce(x.tg_id = leaderboard.me and x.seat = st, false) as mine, x.seat, x.name, x.house, x.realm, x.waves, x.kills, x.runs,
           row_number() over (order by x.waves desc, x.kills desc) as rank
      from daily_scores x where x.day = d
      order by x.waves desc, x.kills desc limit 25) t;
  select coalesce(jsonb_agg(h order by h.waves desc, h.stars desc), '[]'::jsonb) into houses from (
    select s.house, count(distinct s.tg_id) as players, count(*) as seats, sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills,
           (select coalesce(sum(x.waves),0) from daily_scores x where x.day = d and x.house = s.house) as today
      from scores s where s.house is not null group by s.house) h;
  if me is not null then
    select to_jsonb(t) into mine from (
      select true as mine, s.seat, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
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
  return jsonb_build_object('total', total, 'players', nplayers, 'countries', ncountries, 'realms', realms, 'top', top, 'me', mine,
                            'today', today, 'myday', myday, 'houses', houses, 'day', d, 'at', now());
end $$;

create or replace function realm_card(realm int, me bigint default null, seat int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rl int; d date; st smallint; head jsonb; houses jsonb; top jsonb; mine jsonb;
begin
  rl := realm_card.realm;
  if rl is null or rl < 0 or rl > 192 then raise exception 'bad realm'; end if;
  d := (now() at time zone 'utc')::date;
  st := least(greatest(coalesce(realm_card.seat,
          (select jint(p.save->>'cur') from players p where p.tg_id = realm_card.me), 0), 0), 2);
  select jsonb_build_object(
           'players', count(distinct s.tg_id), 'seats', count(*),
           'waves', coalesce(sum(s.waves), 0), 'stars', coalesce(sum(s.stars), 0), 'kills', coalesce(sum(s.kills), 0),
           'gates', coalesce(sum(s.gates), 0), 'best', coalesce(max(s.waves), 0),
           'active', count(distinct s.tg_id) filter (where s.updated_at > now() - interval '7 days'),
           'today', (select coalesce(sum(x.waves), 0) from daily_scores x where x.day = d and x.realm = rl),
           'today_players', (select count(distinct x.tg_id) from daily_scores x where x.day = d and x.realm = rl))
    into head from scores s where s.realm = rl;
  select coalesce(jsonb_agg(h order by h.seats desc, h.waves desc, h.house), '[]'::jsonb) into houses from (
    select s.house, count(distinct s.tg_id) as players, count(*) as seats, sum(s.waves) as waves, sum(s.stars) as stars
      from scores s where s.realm = rl and s.house is not null group by s.house) h;
  select coalesce(jsonb_agg(t order by t.rank), '[]'::jsonb) into top from (
    select coalesce(s.tg_id = realm_card.me and s.seat = st, false) as mine, s.seat, s.name, s.house, s.stars, s.gates, s.waves, s.kills,
           row_number() over (order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc, s.tg_id, s.seat) as rank
      from scores s where s.realm = rl
      order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc, s.tg_id, s.seat limit 10) t;
  if realm_card.me is not null then
    select to_jsonb(t) into mine from (
      select true as mine, s.seat, s.name, s.house, s.stars, s.gates, s.waves, s.kills,
             (select count(*) + 1 from scores o where o.realm = rl
                and ((o.stars + 2 * o.waves) > (s.stars + 2 * s.waves)
                     or ((o.stars + 2 * o.waves) = (s.stars + 2 * s.waves) and o.stars > s.stars)
                     or ((o.stars + 2 * o.waves) = (s.stars + 2 * s.waves) and o.stars = s.stars and o.kills > s.kills))) as rank
        from scores s where s.tg_id = realm_card.me and s.seat = st and s.realm = rl) t;
  end if;
  return head || jsonb_build_object('realm', rl, 'houses', houses, 'top', top, 'me', mine, 'day', d, 'at', now());
end $$;

revoke all on function leaderboard(int, bigint, int) from public;
revoke all on function realm_card(int, bigint, int) from public;
grant execute on function leaderboard(int, bigint, int) to anon, authenticated;
grant execute on function realm_card(int, bigint, int) to anon, authenticated;
