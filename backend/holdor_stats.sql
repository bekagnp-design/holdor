-- ============================================================
--  HOLDOR — admin statistics  (run once in Supabase → SQL Editor → Run)
--  Creates read-only VIEWS for the dashboard. After this, open
--  Table Editor → schema "public" → the views below show live numbers.
--  Safe: every view is revoked from the app (anon / authenticated),
--  only you (dashboard) can read them.
--
--  Realm index → country: same order as the in-game list (v1.0.39: all 193 UN members;
--  0 Georgia · 1 United States · 2 China · … the first 21 are unchanged from v1.0.38).
--  Re-running this file is safe (create or replace).
-- ============================================================

create or replace function realm_name(i int) returns text language sql immutable as $$
  select (array['Georgia','United States','China','Germany','Japan','India','United Kingdom','France','Italy','Canada','Brazil','Russia','South Korea','Australia','Mexico','Spain','Indonesia','Türkiye','Netherlands','Saudi Arabia','Switzerland','Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Central African Republic','Chad','Chile','Colombia','Comoros','Congo','DR Congo','Costa Rica','Côte d''Ivoire','Croatia','Cuba','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','Gabon','Gambia','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','Iran','Iraq','Ireland','Israel','Jamaica','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','São Tomé and Príncipe','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Sri Lanka','Sudan','Suriname','Sweden','Syria','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','Uruguay','Uzbekistan','Vanuatu','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'])[coalesce(i,0)+1]
$$;
revoke all on function realm_name(int) from public, anon, authenticated;

-- 1) every save slot of every player, flattened (one row per account the player created)
create or replace view v_accounts as
  select p.tg_id, p.name, p.username, p.created_at as player_since, p.updated_at as last_save,
         (s.ord - 1)               as slot,
         s.a->>'house'             as house,
         (s.a->>'langI')::int      as realm,
         realm_name((s.a->>'langI')::int) as country,
         s.a->>'made'              as made_on,
         s.a->>'diff'              as difficulty,
         coalesce((select count(*) from jsonb_object_keys(coalesce(s.a->'campaign','{}'::jsonb))),0) as gates_held,
         coalesce((select sum(v.value::int) from jsonb_each_text(coalesce(s.a->'campaign','{}'::jsonb)) v),0) as stars,
         coalesce((s.a->'stats'->>'kills')::int,0)      as kills,
         coalesce((s.a->'stats'->>'onlineBest')::int,0) as best_endless,
         coalesce((s.a->'gems')::int,0)                 as gems,
         (s.a->>'tut')::int = 1                          as tutorial_done
    from players p
    cross join lateral jsonb_array_elements(coalesce(p.save->'slots','[]'::jsonb)) with ordinality as s(a, ord)
   where jsonb_typeof(s.a) = 'object';

-- 2) HOUSES — accounts created per house, and how strong each house is
create or replace view v_house_stats as
  select house,
         count(*)                         as accounts,
         count(distinct tg_id)            as players,
         sum(stars)                       as stars,
         sum(gates_held)                  as gates_held,
         sum(kills)                       as kills,
         max(best_endless)                as best_endless,
         round(avg(stars),1)              as avg_stars_per_account,
         count(*) filter (where last_save > now() - interval '7 days') as active_7d
    from v_accounts
   where house is not null
   group by house
   order by accounts desc, stars desc;

-- 3) REALMS (countries) — players per realm and totals (same numbers the game shows, plus more)
create or replace view v_realm_stats as
  select s.realm, realm_name(s.realm) as country,
         count(*)                         as players,
         sum(s.stars) as stars, sum(s.gates) as gates, sum(s.waves) as waves, sum(s.kills) as kills,
         count(*) filter (where s.updated_at > now() - interval '7 days')  as active_7d,
         count(*) filter (where s.updated_at > now() - interval '1 day')   as active_24h
    from scores s
   group by s.realm
   order by players desc, stars desc;

-- 4) HOUSE × REALM — which house is popular in which country
create or replace view v_house_by_realm as
  select country, realm, house, count(*) as accounts, sum(stars) as stars
    from v_accounts
   where house is not null
   group by country, realm, house
   order by country, accounts desc;

-- 5) GROWTH — new players per day, and how many of them came back
create or replace view v_daily as
  select date_trunc('day', p.created_at)::date as day,
         count(*)                                                        as new_players,
         count(*) filter (where p.updated_at > p.created_at + interval '1 day') as returned_later,
         count(*) filter (where p.save is not null)                       as saved_at_least_once
    from players p
   group by 1
   order by 1 desc;

-- 6) ACTIVITY — who played recently (last 30 days), for sanity checks / spotting your brother
create or replace view v_recent_players as
  select p.tg_id, p.name, p.username, p.house, realm_name(p.realm) as country,
         sc.stars, sc.gates, sc.waves, sc.kills,
         p.created_at, p.updated_at as last_save,
         (select max(last_seen) from sessions x where x.tg_id = p.tg_id) as last_seen
    from players p
    left join scores sc on sc.tg_id = p.tg_id
   where p.updated_at > now() - interval '30 days'
   order by p.updated_at desc;

-- 7) ONE-LINE OVERVIEW
create or replace view v_overview as
  select (select count(*) from players)                                            as players_total,
         (select count(*) from players where created_at > now() - interval '1 day') as new_24h,
         (select count(*) from players where updated_at > now() - interval '1 day') as active_24h,
         (select count(*) from players where updated_at > now() - interval '7 days') as active_7d,
         (select count(*) from v_accounts)                                          as accounts_total,
         (select count(distinct house) from v_accounts where house is not null)    as houses_in_use,
         (select count(distinct realm) from scores)                                 as realms_in_use,
         (select coalesce(sum(kills),0) from scores)                                as kills_total,
         (select coalesce(max(waves),0) from scores)                                as best_endless_run;

-- the app must not be able to read any of this
revoke all on v_accounts, v_house_stats, v_realm_stats, v_house_by_realm, v_daily, v_recent_players, v_overview
  from public, anon, authenticated;

-- self-check (empty tables → zeros / no rows, that is fine)
select * from v_overview;
select * from v_house_stats;
select * from v_realm_stats;
