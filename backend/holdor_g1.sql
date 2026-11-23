-- ============================================================
--  HEAVY GOLD backend g1 (2026-11-23) — the arena game's server side (src/gold/GOLD.md, section "Server").
--  Needs `players` + `sessions` of holdor_supabase.sql (login stays the existing tg_login → a session token) and reads the
--  owner's word list `chat_words` of holdor_v23.sql (created empty here when v23 is absent; a no-op where it is applied).
--  Run after holdor_v40b.sql (any order after v1 works). Additive and safe to re-run: three new tables, seven new functions,
--  two triggers; nothing older is dropped (the only older object touched: anon / authenticated lose table rights on chat_words).
--  hg_profiles   one public profile per Telegram account: a name and a country (ISO 3166-1 alpha-2, the client's list in
--                src/gold/js/20_profile.js). The board shows these, never a Telegram id. The name is NFKC-normalised, trimmed
--                and inner runs of spaces collapsed (raw input over 64 characters is refused before any of that), then:
--                3–16 characters of letters (any script, with the combining marks Indic, Thai, Lao, Tibetan, Myanmar and Khmer
--                names need), digits, space, _ or -; not starting with a mark; at least two letters or digits; no Hangul filler
--                (they draw nothing); no Latin mixed with Greek or Cyrillic; no word of chat_words, separators ignored;
--                unique ignoring case (NFKC first, so fullwidth / math look-alikes of a taken name read as taken).
--  hg_rounds     one row per finished round: god, banked (the score), rank among the round's heroes, robs, lost, minted, day,
--                and the player's country at submit time (the country boards count the round there, not the profile's today).
--                The server refuses a round the game cannot produce: heroes must be 8 (you + 7 bots), minted 1..812
--                (14×8 start coins + 50×8 + 50×4 + 50×2; 1218 with day 'freya' on a UTC Friday or the 15 minutes after it),
--                banked 0..minted, rank 1..8 and banked × rank ≤ minted (gold is conserved). It also refuses a round less than
--                140 s after the same player's previous one (a round lasts 150 s), a 101st round within 24 h, and a player
--                without a profile. Submits are serialised per player (advisory lock 7101) so two parallel calls cannot both pass.
--  hg_alltime    the all-time totals per player and round country, kept by a trigger on hg_rounds (insert adds the round;
--                update / delete / truncate recount), so the 'all' board costs the number of players, not of rounds.
--  hg_board      the top 20 by gold banked (then best round, then name), the caller's own rank, every country, the totals.
--                Scopes: 'week' (since Monday 00:00 UTC), 'last' (the previous full week, Monday to Monday), 'all'.
--  Errors come back as {error: 'auth' | 'bad_name' | 'name_taken' | 'bad_country' | 'bad_round' | 'too_fast' | 'no_profile'},
--  never as an exception, so the client reads one JSON shape. Only hg_board takes a null or unknown token (me = null).
--  Row level security is on with no policies and anon / authenticated have no table rights: every access goes through the
--  security definer functions below, each with search_path = public, pg_temp (a caller's temp table never stands in for one
--  of ours). hg_int / hg_ranked / hg_alltime_sync are internal (no execute for anon / authenticated: hg_ranked holds tg_id).
--  Test (local Postgres only, never a Supabase project): python3 backend/test/g1_test.py  (README: backend/test/README.md).
-- ============================================================
create table if not exists chat_words (w text primary key);   -- the owner's word list (v23): insert into chat_words values ('...')
alter table chat_words enable row level security;
revoke all on chat_words from anon, authenticated;

create table if not exists hg_profiles (
  tg_id      bigint primary key references players(tg_id) on delete cascade,
  name       text not null,
  country    char(2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create unique index if not exists hg_profiles_name_idx on hg_profiles (lower(name));
create table if not exists hg_rounds (
  id      bigserial primary key,
  tg_id   bigint not null references hg_profiles(tg_id) on delete cascade,
  god     text not null,
  banked  int not null,
  rank    int not null,
  heroes  int not null,
  robs    int not null,
  lost    int not null,
  minted  int not null,
  day     text,
  at      timestamptz not null default now(),
  country char(2));
alter table hg_rounds add column if not exists country char(2);   -- the player's country when the round was submitted
create index if not exists hg_rounds_player_idx on hg_rounds (tg_id, at);
create index if not exists hg_rounds_at_idx on hg_rounds (at);
create table if not exists hg_alltime (
  tg_id   bigint not null references hg_profiles(tg_id) on delete cascade,
  country text not null,   -- the rounds' country; '' = rounds stored without one, which count for the profile's country
  total   bigint not null,
  best    int not null,
  rounds  int not null,
  primary key (tg_id, country));
alter table hg_profiles enable row level security;
alter table hg_rounds enable row level security;
alter table hg_alltime enable row level security;
revoke all on hg_profiles, hg_rounds, hg_alltime from anon, authenticated;
revoke all on sequence hg_rounds_id_seq from anon, authenticated;

-- internal: an integer field of a JSON object, or null when it is missing, not a number, not whole, or beyond ±1e9
create or replace function hg_int(j jsonb, k text) returns bigint language plpgsql immutable set search_path = '' as $$
declare n numeric;
begin
  if j is null or jsonb_typeof(j) <> 'object' or jsonb_typeof(j -> k) is distinct from 'number' then return null; end if;
  n := (j ->> k)::numeric;
  if n <> trunc(n) or abs(n) > 1000000000 then return null; end if;
  return n::bigint;
end $$;

-- internal: keeps hg_alltime equal to hg_rounds. Insert: add the round to (player, round country). Update / delete
-- (moderation): recount that player. Truncate: empty. A round stored without a country goes under '' (the board reads the
-- profile's country for it, as it does for 'week' and 'last').
create or replace function hg_alltime_sync() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare pid bigint;
begin
  if tg_op = 'TRUNCATE' then delete from hg_alltime; return null; end if;
  if tg_op = 'INSERT' then
    insert into hg_alltime as s (tg_id, country, total, best, rounds) values (new.tg_id, coalesce(new.country, ''), new.banked, new.banked, 1)
      on conflict (tg_id, country) do update set total = s.total + excluded.total, best = greatest(s.best, excluded.best), rounds = s.rounds + 1;
    return null;
  end if;
  foreach pid in array case when tg_op = 'UPDATE' and new.tg_id <> old.tg_id then array[old.tg_id, new.tg_id] else array[old.tg_id] end loop
    delete from hg_alltime s where s.tg_id = pid;
    insert into hg_alltime (tg_id, country, total, best, rounds)
      select x.tg_id, coalesce(x.country, ''), sum(x.banked), max(x.banked), count(*) from hg_rounds x where x.tg_id = pid group by 1, 2;
  end loop;
  return null;
end $$;
drop trigger if exists hg_rounds_alltime on hg_rounds;
create trigger hg_rounds_alltime after insert or update or delete on hg_rounds for each row execute function hg_alltime_sync();
drop trigger if exists hg_rounds_alltime_truncate on hg_rounds;
create trigger hg_rounds_alltime_truncate after truncate on hg_rounds for each statement execute function hg_alltime_sync();
lock table hg_rounds in share mode;   -- the file runs as one transaction (migration / SQL Editor / the test): no round lands mid-rebuild
delete from hg_alltime;
insert into hg_alltime (tg_id, country, total, best, rounds)
  select x.tg_id, coalesce(x.country, ''), sum(x.banked), max(x.banked), count(*) from hg_rounds x group by 1, 2;

-- internal: every player with rounds in [t0, t1), with name, country, total, best, rounds and the board position
-- (gold banked desc, then best round desc, then name ignoring case). The one place the order is defined.
-- (-infinity, infinity) reads the running totals of hg_alltime; any other range sums its rounds (one week: the time index).
create or replace function hg_ranked(t0 timestamptz, t1 timestamptz)
returns table (tg_id bigint, name text, country text, total bigint, best int, rounds int, pos int)
language sql stable set search_path = public, pg_temp as $$
  select a.tg_id, p.name, p.country::text, a.total, a.best, a.rounds,
         (row_number() over (order by a.total desc, a.best desc, lower(p.name), a.tg_id))::int
    from (select x.tg_id, sum(x.banked)::bigint as total, max(x.banked) as best, count(*)::int as rounds
            from hg_rounds x where not ($1 = '-infinity' and $2 = 'infinity') and x.at >= $1 and x.at < $2 group by x.tg_id
          union all
          select s.tg_id, sum(s.total)::bigint, max(s.best), sum(s.rounds)::int
            from hg_alltime s where $1 = '-infinity' and $2 = 'infinity' group by s.tg_id) a
    join hg_profiles p on p.tg_id = a.tg_id
$$;

-- my profile: {name, country}, {} before the first hg_profile_set, {error:'auth'} for an unknown token
create or replace function hg_profile_get(token uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pid bigint; pr hg_profiles;
begin
  select s.tg_id into pid from sessions s where s.token = hg_profile_get.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select * into pr from hg_profiles p where p.tg_id = pid;
  if pr.tg_id is null then return '{}'::jsonb; end if;
  return jsonb_build_object('name', pr.name, 'country', pr.country::text);
end $$;

-- create or change my profile. The name: raw input over 64 characters is refused before any regex work; then NFKC (fullwidth,
-- math and other compatibility forms become plain letters, odd spaces become spaces), trimmed, inner runs of spaces made one;
-- then the rules of the header. Unique ignoring case (my own row excepted, so I may change the case of my own name).
-- The country is an ISO 3166-1 alpha-2 code of the client's list (src/gold/js/20_profile.js: change both together).
-- → {ok:true, name, country} | {error:'auth'|'bad_name'|'name_taken'|'bad_country'}
create or replace function hg_profile_set(token uuid, name text, country text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint;
        nm text := case when char_length(hg_profile_set.name) <= 64
                        then regexp_replace(btrim(normalize(hg_profile_set.name, NFKC)), ' {2,}', ' ', 'g') else '' end;
        cc text := btrim(coalesce(hg_profile_set.country, ''));
        iso2 constant text[] := '{AD,AE,AF,AG,AI,AL,AM,AO,AQ,AR,AS,AT,AU,AW,AX,AZ, BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,
          CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ, DE,DJ,DK,DM,DO,DZ, EC,EE,EG,EH,ER,ES,ET, FI,FJ,FK,FM,FO,FR,
          GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY, HK,HM,HN,HR,HT,HU, ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT, JE,JM,JO,JP,
          KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ, LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY, MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,
          NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ, OM, PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY, QA, RE,RO,RS,RU,RW,
          SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ, TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,
          UA,UG,UM,US,UY,UZ, VA,VC,VE,VG,VI,VN,VU, WF,WS, YE,YT, ZA,ZM,ZW}';
begin
  select s.tg_id into pid from sessions s where s.token = hg_profile_set.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  -- The character class: [[:alnum:]] (glibc: letters of every script, digits), space, _ and -, plus the combining marks that
  -- glibc leaves out but names need, as \u escapes (never literal marks in this file): U+0300–034E, U+0350–036F accents
  -- (not U+034F, the invisible grapheme joiner); U+0900–0DFF the Indic blocks, Devanagari to Sinhala (viramas, nuktas);
  -- U+0E47–0E4E Thai tone marks; U+0EBA, U+0EC8–0ECD Lao; U+0F0B, U+0F35–0F39, U+0F3E–0F3F, U+0F84–0F87 Tibetan;
  -- U+1037–103A Myanmar; U+17C9–17D3, U+17DD Khmer (not U+17B4 / U+17B5, invisible).
  if char_length(nm) < 3 or char_length(nm) > 16
     or nm !~ '^[[:alnum:] _\u0300-\u034E\u0350-\u036F\u0900-\u0DFF\u0E47-\u0E4E\u0EBA\u0EC8-\u0ECD\u0F0B\u0F35-\u0F39\u0F3E\u0F3F\u0F84-\u0F87\u1037-\u103A\u17C9-\u17D3\u17DD-]+$'
     or nm !~ '^[[:alnum:]_-]'                                    -- not a mark first
     or nm !~ '[[:alnum:]].*[[:alnum:]]'                          -- at least two letters or digits ('- -', '___')
     or nm ~ '[\u115F\u1160\u3164\uFFA0]'                         -- Hangul fillers: letters that draw nothing
     or (nm ~ '[A-Za-z]' and nm ~ '[\u0370-\u03FF\u0400-\u052F]')   -- Latin mixed with Greek / Cyrillic look-alikes
     or exists (select 1 from chat_words w                        -- the owner's word list, separators ignored ('Nig ger')
                 where translate(lower(w.w), ' _-', '') <> ''
                   and strpos(translate(lower(nm), ' _-', ''), translate(lower(w.w), ' _-', '')) > 0) then
    return jsonb_build_object('error', 'bad_name');
  end if;
  if cc !~ '^[A-Z]{2}$' or not cc = any (iso2) then return jsonb_build_object('error', 'bad_country'); end if;
  if exists (select 1 from hg_profiles p where lower(p.name) = lower(nm) and p.tg_id <> pid) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  begin
    insert into hg_profiles as p (tg_id, name, country) values (pid, nm, cc)
      on conflict on constraint hg_profiles_pkey do update set name = excluded.name, country = excluded.country, updated_at = now();
  exception when unique_violation then   -- another player took the name between the check and the insert
    return jsonb_build_object('error', 'name_taken');
  end;
  return jsonb_build_object('ok', true, 'name', nm, 'country', cc);
end $$;

-- one finished round: r = {god, banked, rank, heroes, robs, lost, minted, day}
-- → {ok:true, week:{total, best, rounds, rank}} (my standing this week after the round) | {error:'auth'|'no_profile'|'bad_round'|'too_fast'}
create or replace function hg_round_submit(token uuid, r jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint; cc text; g text; d text; bk bigint; rk bigint; hr bigint; rb bigint; ls bigint; mn bigint; cap int; prev timestamptz;
        t0 timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc'; wk jsonb;
begin
  select s.tg_id into pid from sessions s where s.token = hg_round_submit.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select p.country::text into cc from hg_profiles p where p.tg_id = pid;
  if cc is null then return jsonb_build_object('error', 'no_profile'); end if;
  if r is null or jsonb_typeof(r) <> 'object' or jsonb_typeof(r -> 'god') is distinct from 'string' then
    return jsonb_build_object('error', 'bad_round');
  end if;
  g := r ->> 'god';
  if g not in ('hermes', 'thor', 'loki', 'amirani') then return jsonb_build_object('error', 'bad_round'); end if;
  if jsonb_typeof(r -> 'day') = 'string' then d := r ->> 'day';
  elsif coalesce(jsonb_typeof(r -> 'day'), 'null') <> 'null' then return jsonb_build_object('error', 'bad_round');
  end if;
  if char_length(d) > 16 then return jsonb_build_object('error', 'bad_round'); end if;
  mn := hg_int(r, 'minted'); bk := hg_int(r, 'banked'); hr := hg_int(r, 'heroes'); rk := hg_int(r, 'rank');
  rb := hg_int(r, 'robs'); ls := hg_int(r, 'lost');
  -- the most gold one round can mint: 14x8 + 50x8 + 50x4 + 50x2 = 812 (index.tpl.html START_COINS, coinValue);
  -- on Freya's day (40_daygod.js, x1.5, the start coins too) 14x12 + 50x12 + 50x6 + 50x3 = 1218.
  -- A round started on a Friday (UTC) may end just after midnight, so Freya's cap still holds 15 minutes into Saturday.
  cap := case when d = 'freya' and 5 in (extract(isodow from now() at time zone 'utc'),
                                         extract(isodow from (now() - interval '15 minutes') at time zone 'utc')) then 1218 else 812 end;
  if mn is null or mn < 1 or mn > cap
     or bk is null or bk < 0 or bk > mn
     or hr is distinct from 8                       -- you + 7 bots (G.BOTS)
     or rk is null or rk < 1 or rk > hr
     or bk * rk > mn                                -- gold is conserved: the rk-1 heroes above you banked at least as much
     or rb is null or rb < 0 or rb > 1000000
     or ls is null or ls < 0 or ls > 1000000 then
    return jsonb_build_object('error', 'bad_round');
  end if;
  perform pg_advisory_xact_lock(7101, (pid % 2000000000)::int);   -- one submit at a time per player: the pace rules cannot race
  select max(x.at) into prev from hg_rounds x where x.tg_id = pid;
  if prev is not null and prev > now() - interval '140 seconds' then   -- a round is 150 s; 10 s for a slow previous submit
    return jsonb_build_object('error', 'too_fast');
  end if;
  if (select count(*) from hg_rounds x where x.tg_id = pid and x.at > now() - interval '1 day') >= 100 then
    return jsonb_build_object('error', 'too_fast');   -- the daily cap; 100 is the owner's number to choose
  end if;
  insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted, day, at, country)
    values (pid, g, bk::int, rk::int, hr::int, rb::int, ls::int, mn::int, d, now(), cc);
  select jsonb_build_object('total', k.total, 'best', k.best, 'rounds', k.rounds, 'rank', k.pos) into wk
    from hg_ranked(t0, 'infinity'::timestamptz) k where k.tg_id = pid;
  return jsonb_build_object('ok', true, 'week', wk);
end $$;

-- the boards. scope 'week' = since Monday 00:00 UTC, 'last' = the previous full week (Monday to Monday), 'all' = every round;
-- anything else reads as 'week'. → {scope, since, until, players:[{name, country, total, best, rounds, mine}] (top 20),
-- me:{rank, total, best, rounds} | null (null token, unknown token, or no round in the scope),
-- countries:[{country, players, rounds, gold}] (every country, gold desc), totals:{players, rounds}}. Never a Telegram id.
-- A player's row shows his country today; the countries list counts each round for the country it was played for.
create or replace function hg_board(token uuid, scope text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pid bigint; sc text := lower(btrim(coalesce(hg_board.scope, '')));
        mon timestamp := date_trunc('week', now() at time zone 'utc');   -- this Monday 00:00 as UTC wall-clock time: the
        t0 timestamptz; t1 timestamptz;                                   -- arithmetic below never sees the session TimeZone
        iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"'; res jsonb;
begin
  if hg_board.token is not null then select s.tg_id into pid from sessions s where s.token = hg_board.token; end if;
  if sc = 'all' then t0 := '-infinity'; t1 := 'infinity';
  elsif sc = 'last' then t0 := (mon - interval '7 days') at time zone 'utc'; t1 := mon at time zone 'utc';
  else sc := 'week'; t0 := mon at time zone 'utc'; t1 := 'infinity';
  end if;
  with k as (select * from hg_ranked(t0, t1))
  select jsonb_build_object(
    'scope', sc,
    'since', case when sc = 'all' then null else to_char(t0 at time zone 'utc', iso) end,
    'until', case when sc = 'last' then to_char(t1 at time zone 'utc', iso) end,
    'players', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'country', x.country, 'total', x.total, 'best', x.best,
                                                             'rounds', x.rounds, 'mine', x.tg_id is not distinct from pid) order by x.pos)
                           from k x where x.pos <= 20), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', x.pos, 'total', x.total, 'best', x.best, 'rounds', x.rounds) from k x where x.tg_id = pid),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country', c.country, 'players', c.players, 'rounds', c.rounds, 'gold', c.gold)
                                            order by c.gold desc, c.players desc, c.country)
                             from (select y.country, count(distinct y.tg_id)::int as players, sum(y.rounds)::int as rounds, sum(y.gold)::bigint as gold
                                     from (select coalesce(x.country, p.country)::text as country, x.tg_id, 1 as rounds, x.banked::bigint as gold
                                             from hg_rounds x join hg_profiles p on p.tg_id = x.tg_id
                                            where sc <> 'all' and x.at >= t0 and x.at < t1
                                           union all
                                           select coalesce(nullif(s.country, ''), p.country::text), s.tg_id, s.rounds, s.total
                                             from hg_alltime s join hg_profiles p on p.tg_id = s.tg_id where sc = 'all') y
                                    group by y.country) c), '[]'::jsonb),
    'totals', (select jsonb_build_object('players', count(*), 'rounds', coalesce(sum(x.rounds), 0)) from k x))
  into res;
  return res;
end $$;

revoke all on function hg_int(jsonb, text), hg_ranked(timestamptz, timestamptz), hg_alltime_sync() from public, anon, authenticated;
revoke all on function hg_profile_get(uuid), hg_profile_set(uuid, text, text), hg_round_submit(uuid, jsonb), hg_board(uuid, text) from public;
grant execute on function hg_profile_get(uuid), hg_profile_set(uuid, text, text), hg_round_submit(uuid, jsonb), hg_board(uuid, text)
  to anon, authenticated;
