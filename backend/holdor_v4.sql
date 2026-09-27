-- ============================================================
--  HOLDOR backend v4 (2026-09-27) — realm (country) statistics for everyone; every seat row read from the save
--  Run AFTER holdor_v3.sql. Safe to re-run.
--
--  Why:
--  * v3 kept the old one-row-per-player values on seat I. That row was the best of ALL seats (the app before
--    v1.0.49 sent max stars / max gates / max waves / the sum of kills, with the realm of the seat being played),
--    so seat I showed another seat's results and the same stars and waves counted in two realms.
--  * The app in Telegram (v1.0.48) still sends those mixed numbers and no seat. With v3 alone it would keep
--    writing them into seat I.
--  Now the server reads each seat's numbers straight from the save it is sent (the same save the player loads),
--  so every app version produces the same, honest rows:
--    stars = campaign + Hard stars · gates = stages cleared · kills = the seat's kills ·
--    waves = the seat's best Hold run (its save, or the best run the server itself recorded for that seat).
--  A Hold run without a seat (old app) counts for the seat the save says is being played.
--  New: realm_card(realm) — one country's standings for the in-game realm screen; the leaderboard's realm list
--  carries players / defenders / active this week / today's waves; the admin views count players and seats apart.
-- ============================================================

-- ---------- 1. parsers for values that come from a save (bad input gives null instead of an error) ----------
create or replace function jint(t text) returns int
language sql immutable set search_path = '' as $$
  select case when t ~ '^-?[0-9]{1,9}$' then t::int end
$$;

create or replace function jday(t text) returns date
language plpgsql stable set search_path = '' as $$
begin
  if t is null or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  return t::date;
exception when others then return null;
end $$;

-- one seat of a save → its standings numbers
create or replace function seat_stats(a jsonb, out house text, out realm int, out stars int, out gates int,
                                      out waves int, out kills int, out made date)
language sql stable set search_path = public as $$
  select case when a->>'house' ~ '^[a-z]{2,16}$' then a->>'house' end,
         case when jint(a->>'langI') between 0 and 192 then jint(a->>'langI') else 0 end,
         (coalesce((select sum(least(greatest(coalesce(jint(v.value), 0), 0), 3))
                      from jsonb_each_text(case when jsonb_typeof(a->'campaign') = 'object' then a->'campaign' else '{}'::jsonb end) v), 0)
          + coalesce((select sum(least(greatest(coalesce(jint(v.value), 0), 0), 3))
                      from jsonb_each_text(case when jsonb_typeof(a->'hard') = 'object' then a->'hard' else '{}'::jsonb end) v), 0))::int,
         (select count(*) from jsonb_object_keys(case when jsonb_typeof(a->'campaign') = 'object' then a->'campaign' else '{}'::jsonb end))::int,
         least(greatest(coalesce(jint(a->'stats'->>'onlineBest'), 0), 0), 500),
         least(greatest(coalesce(jint(a->'stats'->>'kills'), 0), 0), 100000000),
         jday(a->>'made')
$$;

-- ---------- 2. rebuild one player's seat rows from the save on the server ----------
-- A row's updated_at moves only when its numbers change (or a Hold run is recorded), so "active this week" means played.
create or replace function sync_seats(pid bigint, at timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare sv jsonb; nm text; slots jsonb; i int; a jsonb; r record; best int; n int := 0;
begin
  select p.save, p.name into sv, nm from players p where p.tg_id = pid;
  slots := sv -> 'slots';
  if jsonb_typeof(slots) is distinct from 'array' then return 0; end if;
  -- a seat deleted in the app leaves the standings (the app always keeps three places; a shorter array proves nothing)
  if jsonb_array_length(slots) >= 3 then
    delete from scores sc where sc.tg_id = pid and jsonb_typeof(slots -> sc.seat::int) is distinct from 'object';
  end if;
  for i in 0 .. least(jsonb_array_length(slots), 3) - 1 loop
    a := slots -> i;
    continue when jsonb_typeof(a) is distinct from 'object';
    select * into r from seat_stats(a);
    -- the best run the server recorded for this seat since it was made (a day of slack for time zones)
    select max(x.waves) into best from daily_scores x
     where x.tg_id = pid and x.seat = i and (r.made is null or x.day >= r.made - 1);
    insert into scores as sc (tg_id, seat, name, house, realm, stars, gates, waves, kills, updated_at)
      values (pid, i::smallint, coalesce(nm, ''), r.house, r.realm, r.stars, r.gates, greatest(r.waves, coalesce(best, 0)), r.kills, at)
      on conflict on constraint scores_pkey do update set
        name = excluded.name, house = coalesce(excluded.house, sc.house), realm = excluded.realm,
        stars = excluded.stars, gates = excluded.gates, waves = excluded.waves, kills = excluded.kills,
        updated_at = case when (sc.house, sc.realm, sc.stars, sc.gates, sc.waves, sc.kills)
                               is distinct from (coalesce(excluded.house, sc.house), excluded.realm, excluded.stars, excluded.gates, excluded.waves, excluded.kills)
                          then excluded.updated_at else sc.updated_at end;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- 3. save: the numbers the app sends are no longer trusted — the seats are read from the save ----------
-- (the parameters stay, so every app version can call it)
create or replace function save_progress(token uuid, save jsonb, ver int, house text, realm int,
                                         stars int, gates int, waves int, kills int, seat int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id bigint; cur int; slots jsonb;
begin
  select s.tg_id into id from sessions s where s.token = save_progress.token;
  if id is null then raise exception 'bad session'; end if;
  if pg_column_size(save) > 300000 then raise exception 'save too big'; end if;
  update sessions set last_seen = now() where sessions.token = save_progress.token;
  select p.save_ver into cur from players p where p.tg_id = id;
  if ver >= cur then
    update players p set save = save_progress.save, save_ver = ver, house = save_progress.house,
                         realm = coalesce(save_progress.realm, 0), updated_at = now()
      where p.tg_id = id;
    -- a seat deleted in the app also leaves today's Hold standings
    slots := save_progress.save -> 'slots';
    if jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) >= 3 then
      delete from daily_scores x where x.tg_id = id and x.day = (now() at time zone 'utc')::date
        and jsonb_typeof(slots -> x.seat::int) is distinct from 'object';
    end if;
    perform sync_seats(id);
  end if;
  return jsonb_build_object('ok', true, 'save_ver', greatest(cur, ver));
end $$;

-- ---------- 4. hold_result: a run without a seat (old app) counts for the seat being played ----------
create or replace function hold_result(token uuid, day date, waves int, kills int,
                                       seat int default null, house text default null, realm int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id bigint; nm text; sv jsonb; hs text; rl int; d date; st smallint; a jsonb; r record;
begin
  select s.tg_id into id from sessions s where s.token = hold_result.token;
  if id is null then raise exception 'bad session'; end if;
  d := coalesce(hold_result.day, (now() at time zone 'utc')::date);
  if d < (now() at time zone 'utc')::date - 1 or d > (now() at time zone 'utc')::date then raise exception 'bad day'; end if;
  if hold_result.waves < 0 or hold_result.waves > 500 or hold_result.kills < 0 or hold_result.kills > 100000 then raise exception 'bad score'; end if;
  select p.name, p.house, p.realm, p.save into nm, hs, rl, sv from players p where p.tg_id = id;
  st := least(greatest(coalesce(hold_result.seat, jint(sv->>'cur'), 0), 0), 2);
  a := sv -> 'slots' -> st::int;
  if jsonb_typeof(a) = 'object' then
    select * into r from seat_stats(a);
    hs := coalesce(r.house, hs); rl := r.realm;
  end if;
  hs := coalesce(hold_result.house, hs);
  rl := case when hold_result.realm between 0 and 192 then hold_result.realm else coalesce(rl, 0) end;
  insert into daily_scores (day, tg_id, seat, name, house, realm, waves, kills, runs)
    values (d, id, st, coalesce(nm, ''), hs, rl, hold_result.waves, hold_result.kills, 1)
    on conflict on constraint daily_scores_pkey do update set
      name = excluded.name, house = excluded.house, realm = excluded.realm,
      waves = greatest(daily_scores.waves, excluded.waves),
      kills = greatest(daily_scores.kills, excluded.kills),
      runs = daily_scores.runs + 1, updated_at = now();
  -- the seat's all-time best; realm, house, stars and kills stay as the save says
  insert into scores as sc (tg_id, seat, name, house, realm, waves, kills)
    values (id, st, coalesce(nm, ''), hs, rl, hold_result.waves, hold_result.kills)
    on conflict on constraint scores_pkey do update set
      waves = greatest(sc.waves, excluded.waves), updated_at = now();
  return jsonb_build_object('ok', true, 'day', d,
    'rank', (select count(*) + 1 from daily_scores o where o.day = d and (o.waves > hold_result.waves or (o.waves = hold_result.waves and o.kills > hold_result.kills))));
end $$;

-- ---------- 5. leaderboard: + players / countries; realm rows carry defenders, active this week and today ----------
-- "me" without a seat (old app) = the seat the save says is being played
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
  return jsonb_build_object('total', total, 'players', nplayers, 'countries', ncountries, 'realms', realms, 'top', top, 'me', mine,
                            'today', today, 'myday', myday, 'houses', houses, 'day', d, 'at', now());
end $$;

-- ---------- 6. realm_card: one country for the realm screen (anyone can read it, like the leaderboard) ----------
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
    select s.tg_id, s.seat, s.name, s.house, s.stars, s.gates, s.waves, s.kills,
           row_number() over (order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc, s.tg_id, s.seat) as rank
      from scores s where s.realm = rl
      order by (s.stars + 2 * s.waves) desc, s.stars desc, s.kills desc, s.tg_id, s.seat limit 10) t;
  if realm_card.me is not null then
    select to_jsonb(t) into mine from (
      select s.tg_id, s.seat, s.name, s.house, s.stars, s.gates, s.waves, s.kills,
             (select count(*) + 1 from scores o where o.realm = rl
                and ((o.stars + 2 * o.waves) > (s.stars + 2 * s.waves)
                     or ((o.stars + 2 * o.waves) = (s.stars + 2 * s.waves) and o.stars > s.stars)
                     or ((o.stars + 2 * o.waves) = (s.stars + 2 * s.waves) and o.stars = s.stars and o.kills > s.kills))) as rank
        from scores s where s.tg_id = realm_card.me and s.seat = st and s.realm = rl) t;
  end if;
  return head || jsonb_build_object('realm', rl, 'houses', houses, 'top', top, 'me', mine, 'day', d, 'at', now());
end $$;

-- ---------- 7. one time: put the old Hold days on the seat that played them, then rebuild every seat row ----------
-- Before v3 a Hold day had no seat (v3 put every one on seat I). A day moves to the one seat whose realm and house
-- match it and which already existed that day; anything ambiguous stays where it is.
update daily_scores x set seat = m.i
  from (select x2.day, x2.tg_id, min(s.ord - 1)::smallint as i, count(*) as n
          from daily_scores x2
          join players p on p.tg_id = x2.tg_id
          cross join lateral jsonb_array_elements(case when jsonb_typeof(p.save->'slots') = 'array' then p.save->'slots' else '[]'::jsonb end)
                     with ordinality as s(a, ord)
         where x2.seat = 0 and jsonb_typeof(s.a) = 'object' and s.ord <= 3
           and (select ss.realm from seat_stats(s.a) ss) = x2.realm
           and s.a->>'house' = x2.house
           and (jday(s.a->>'made') is null or jday(s.a->>'made') - 1 <= x2.day)
         group by x2.day, x2.tg_id) m
 where x.day = m.day and x.tg_id = m.tg_id and x.seat = 0 and m.n = 1 and m.i <> 0
   and not exists (select 1 from daily_scores y where y.day = x.day and y.tg_id = x.tg_id and y.seat = m.i);

select sync_seats(p.tg_id, p.updated_at) from players p;

-- "active this week" starts honest: a seat was last active on its last Hold day, or when it was made;
-- the seat being played was active at the player's last save.
update scores sc set updated_at = least(p.updated_at, greatest(
         coalesce((select max(x.updated_at) from daily_scores x where x.tg_id = sc.tg_id and x.seat = sc.seat), '-infinity'::timestamptz),
         coalesce(jday(p.save->'slots'->sc.seat::int->>'made')::timestamptz, '-infinity'::timestamptz),
         case when jint(p.save->>'cur') = sc.seat then p.updated_at else '-infinity'::timestamptz end))
  from players p
 where p.tg_id = sc.tg_id
   and greatest(
         coalesce((select max(x.updated_at) from daily_scores x where x.tg_id = sc.tg_id and x.seat = sc.seat), '-infinity'::timestamptz),
         coalesce(jday(p.save->'slots'->sc.seat::int->>'made')::timestamptz, '-infinity'::timestamptz),
         case when jint(p.save->>'cur') = sc.seat then p.updated_at else '-infinity'::timestamptz end) > '-infinity'::timestamptz;

-- ---------- 8. admin views (dashboard only): the full realm list, players and seats counted apart ----------
create or replace function realm_name(i int) returns text language sql immutable set search_path = '' as $$
  select (array['Georgia','United States','China','Germany','Japan','India','United Kingdom','France','Italy','Canada','Brazil','Russia','South Korea','Australia','Mexico','Spain','Indonesia','Türkiye','Netherlands','Saudi Arabia','Switzerland','Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Central African Republic','Chad','Chile','Colombia','Comoros','Congo','DR Congo','Costa Rica','Côte d''Ivoire','Croatia','Cuba','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','Gabon','Gambia','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','Iran','Iraq','Ireland','Israel','Jamaica','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','São Tomé and Príncipe','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Sri Lanka','Sudan','Suriname','Sweden','Syria','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','Uruguay','Uzbekistan','Vanuatu','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'])[coalesce(i,0)+1]
$$;
alter function tg_url_decode(text) set search_path = '';

drop view if exists v_realm_stats;
create view v_realm_stats as
  select s.realm, realm_name(s.realm) as country,
         count(distinct s.tg_id)          as players,
         count(*)                         as seats,
         sum(s.stars) as stars, sum(s.gates) as gates, sum(s.waves) as waves, sum(s.kills) as kills,
         count(distinct s.tg_id) filter (where s.updated_at > now() - interval '7 days')  as active_7d,
         count(distinct s.tg_id) filter (where s.updated_at > now() - interval '1 day')   as active_24h
    from scores s
   group by s.realm
   order by waves desc, stars desc, players desc;

-- ---------- 9. who may call what ----------
revoke all on function jint(text) from public, anon, authenticated;
revoke all on function jday(text) from public, anon, authenticated;
revoke all on function seat_stats(jsonb) from public, anon, authenticated;
revoke all on function sync_seats(bigint, timestamptz) from public, anon, authenticated;
revoke all on function realm_name(int) from public, anon, authenticated;
revoke all on v_realm_stats from anon, authenticated;
revoke all on function save_progress(uuid, jsonb, int, text, int, int, int, int, int, int) from public;
revoke all on function hold_result(uuid, date, int, int, int, text, int) from public;
revoke all on function leaderboard(int, bigint, int) from public;
revoke all on function realm_card(int, bigint, int) from public;
grant execute on function save_progress(uuid, jsonb, int, text, int, int, int, int, int, int) to anon, authenticated;
grant execute on function hold_result(uuid, date, int, int, int, text, int) to anon, authenticated;
grant execute on function leaderboard(int, bigint, int) to anon, authenticated;
grant execute on function realm_card(int, bigint, int) to anon, authenticated;

-- self-check: one row per seat, straight from the saves; then the realms
select tg_id, seat, realm_name(realm) as country, house, stars, gates, waves, kills, updated_at from scores order by tg_id, seat;
select * from v_realm_stats;
