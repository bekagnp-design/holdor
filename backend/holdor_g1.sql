-- ============================================================
--  HEAVY GOLD backend g1 (2026-11-23) — the arena game's server side (src/gold/GOLD.md, section "Server").
--  Needs only `players` + `sessions` of holdor_supabase.sql (login stays the existing tg_login → a session token).
--  Run after holdor_v40b.sql (any order after v1 works). Additive and safe to re-run: two new tables, five new functions,
--  nothing older is dropped or changed.
--  hg_profiles   one public profile per Telegram account: a name (3–16 letters of any script, digits, space, _ or -; unique
--                ignoring case) and a country (ISO 3166-1 alpha-2). The board shows these, never a Telegram id.
--  hg_rounds     one row per finished round: god, banked (the score), rank among the round's heroes, robs, lost, minted, day.
--                The server refuses a round outside the rules' bounds (banked 0..min(minted, 1500), minted 1..1500, rank
--                1..heroes, heroes 2..32), a round less than 120 s after the same player's previous one, and a player without a
--                profile. Submits are serialised per player (advisory lock 7101) so two parallel calls cannot both pass.
--  hg_board      the top 20 by gold banked (then best round, then name), the caller's own rank, every country, the totals.
--                Scopes: 'week' (since Monday 00:00 UTC), 'last' (the previous full week, Monday to Monday), 'all'.
--  Errors come back as {error: 'auth' | 'bad_name' | 'name_taken' | 'bad_country' | 'bad_round' | 'too_fast' | 'no_profile'},
--  never as an exception, so the client reads one JSON shape. Only hg_board takes a null or unknown token (me = null).
--  Row level security is on with no policies and anon / authenticated have no table rights: every access goes through the
--  security definer functions below. hg_int / hg_ranked are internal (no execute for anon / authenticated: hg_ranked holds tg_id).
--  Test (local Postgres only, never a Supabase project): python3 backend/test/g1_test.py  (README: backend/test/README.md).
-- ============================================================
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
  at      timestamptz not null default now());
create index if not exists hg_rounds_player_idx on hg_rounds (tg_id, at);
create index if not exists hg_rounds_at_idx on hg_rounds (at);
alter table hg_profiles enable row level security;
alter table hg_rounds enable row level security;
revoke all on hg_profiles, hg_rounds from anon, authenticated;
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

-- internal: every player with rounds in [t0, t1), with name, country, total, best, rounds and the board position
-- (gold banked desc, then best round desc, then name ignoring case). The one place the order is defined.
create or replace function hg_ranked(t0 timestamptz, t1 timestamptz)
returns table (tg_id bigint, name text, country text, total bigint, best int, rounds int, pos int)
language sql stable set search_path = public as $$
  select a.tg_id, p.name, p.country::text, a.total, a.best, a.rounds,
         (row_number() over (order by a.total desc, a.best desc, lower(p.name), a.tg_id))::int
    from (select x.tg_id, sum(x.banked)::bigint as total, max(x.banked) as best, count(*)::int as rounds
            from hg_rounds x where x.at >= $1 and x.at < $2 group by x.tg_id) a
    join hg_profiles p on p.tg_id = a.tg_id
$$;

-- my profile: {name, country}, {} before the first hg_profile_set, {error:'auth'} for an unknown token
create or replace function hg_profile_get(token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pid bigint; pr hg_profiles;
begin
  select s.tg_id into pid from sessions s where s.token = hg_profile_get.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select * into pr from hg_profiles p where p.tg_id = pid;
  if pr.tg_id is null then return '{}'::jsonb; end if;
  return jsonb_build_object('name', pr.name, 'country', pr.country::text);
end $$;

-- create or change my profile. The name is trimmed (inner runs of spaces become one), 3–16 characters of letters (any script),
-- digits, space, _ or -, unique ignoring case (my own row excepted, so I may change the case of my own name).
-- The country is two uppercase letters. → {ok:true, name, country} | {error:'auth'|'bad_name'|'name_taken'|'bad_country'}
create or replace function hg_profile_set(token uuid, name text, country text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; nm text := regexp_replace(btrim(coalesce(hg_profile_set.name, '')), ' {2,}', ' ', 'g');
        cc text := btrim(coalesce(hg_profile_set.country, ''));
begin
  select s.tg_id into pid from sessions s where s.token = hg_profile_set.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  if char_length(nm) < 3 or char_length(nm) > 16 or nm !~ '^[[:alnum:] _-]+$' then return jsonb_build_object('error', 'bad_name'); end if;
  if cc !~ '^[A-Z]{2}$' then return jsonb_build_object('error', 'bad_country'); end if;
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
language plpgsql security definer set search_path = public as $$
declare pid bigint; g text; d text; bk bigint; rk bigint; hr bigint; rb bigint; ls bigint; mn bigint; prev timestamptz;
        t0 timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc'; wk jsonb;
begin
  select s.tg_id into pid from sessions s where s.token = hg_round_submit.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  if not exists (select 1 from hg_profiles p where p.tg_id = pid) then return jsonb_build_object('error', 'no_profile'); end if;
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
  if mn is null or mn < 1 or mn > 1500
     or bk is null or bk < 0 or bk > least(mn, 1500)
     or hr is null or hr < 2 or hr > 32
     or rk is null or rk < 1 or rk > hr
     or rb is null or rb < 0 or rb > 1000000
     or ls is null or ls < 0 or ls > 1000000 then
    return jsonb_build_object('error', 'bad_round');
  end if;
  perform pg_advisory_xact_lock(7101, (pid % 2000000000)::int);   -- one submit at a time per player: the 120 s rule cannot race
  select max(x.at) into prev from hg_rounds x where x.tg_id = pid;
  if prev is not null and prev > now() - interval '120 seconds' then return jsonb_build_object('error', 'too_fast'); end if;
  insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted, day, at)
    values (pid, g, bk::int, rk::int, hr::int, rb::int, ls::int, mn::int, d, now());
  select jsonb_build_object('total', k.total, 'best', k.best, 'rounds', k.rounds, 'rank', k.pos) into wk
    from hg_ranked(t0, 'infinity'::timestamptz) k where k.tg_id = pid;
  return jsonb_build_object('ok', true, 'week', wk);
end $$;

-- the boards. scope 'week' = since Monday 00:00 UTC, 'last' = the previous full week (Monday to Monday), 'all' = every round;
-- anything else reads as 'week'. → {scope, since, until, players:[{name, country, total, best, rounds, mine}] (top 20),
-- me:{rank, total, best, rounds} | null (null token, unknown token, or no round in the scope),
-- countries:[{country, players, rounds, gold}] (every country, gold desc), totals:{players, rounds}}. Never a Telegram id.
create or replace function hg_board(token uuid, scope text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pid bigint; sc text := lower(btrim(coalesce(hg_board.scope, '')));
        mon timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc'; t0 timestamptz; t1 timestamptz;
        iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"'; res jsonb;
begin
  if hg_board.token is not null then select s.tg_id into pid from sessions s where s.token = hg_board.token; end if;
  if sc = 'all' then t0 := '-infinity'; t1 := 'infinity';
  elsif sc = 'last' then t0 := mon - interval '7 days'; t1 := mon;
  else sc := 'week'; t0 := mon; t1 := 'infinity';
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
                             from (select x.country, count(*)::int as players, sum(x.rounds)::int as rounds, sum(x.total)::bigint as gold
                                     from k x group by x.country) c), '[]'::jsonb),
    'totals', (select jsonb_build_object('players', count(*), 'rounds', coalesce(sum(x.rounds), 0)) from k x))
  into res;
  return res;
end $$;

revoke all on function hg_int(jsonb, text), hg_ranked(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function hg_profile_get(uuid), hg_profile_set(uuid, text, text), hg_round_submit(uuid, jsonb), hg_board(uuid, text) from public;
grant execute on function hg_profile_get(uuid), hg_profile_set(uuid, text, text), hg_round_submit(uuid, jsonb), hg_board(uuid, text)
  to anon, authenticated;
