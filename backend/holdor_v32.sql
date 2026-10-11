-- ============================================================
--  HOLDOR backend v32 (2026-10-11) — Houses Clash II: ghosts, leagues, friend links (game v1.1.2)
--  Run AFTER holdor_v31... there is no v31: run AFTER holdor_v30.sql. Safe to re-run.
--  A clash is played on the phone: two lanes, the same waves, the house's soldiers sent at the rival (v1.1.1). The server keeps
--  every finished run as a RECORD (the seed, the input log, the waves held, the door left) and hands records back as GHOSTS:
--  a ranked clash replays the recorded run of a real player near your rating on the top lane (he is not asked and loses nothing).
--  * kind 'rank': the ghost nearest your rating (the ratings table shared with duels: one PvP rating a seat, leagues Bronze → Dragon);
--    Elo K 24 for the side that plays; five a day a seat; a gift of gold for a win or a draw.
--  * kind 'friend': a code/link; the friend joins and both play — each against the other's record when it exists, else the bot;
--    the server compares the two records (waves, then the door) when both are in; no rating, no reward.
--  * kind 'practice': the bot; the record is kept (it may serve as a ghost); 60 gold for a run of two waves or more, five a day.
--  The app's claim (waves, door) is bounded (0–10 waves, 0–100 door, a log of at most 600 actions); the server cannot replay the
--  simulation, so a ranked result is accepted from one side only ever against a ghost, never against a live rival.
-- ============================================================
create table if not exists clash_runs (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  kind text not null check (kind in ('rank', 'friend', 'practice')),
  house text not null, champ text, lvl int not null default 1, army int not null default 1,
  seed bigint not null, bot smallint not null default 0, log jsonb not null default '[]'::jsonb,
  waves int not null check (waves between 0 and 10), door int not null check (door between 0 and 100),
  ghost uuid references clash_runs(id) on delete set null, result text check (result in ('win', 'loss', 'draw')), delta int not null default 0,
  created_at timestamptz not null default now());
create index if not exists clash_runs_me_idx on clash_runs (tg_id, seat, created_at desc);
create index if not exists clash_runs_ghost_idx on clash_runs (kind, waves desc, created_at desc);
alter table clash_runs enable row level security; revoke all on clash_runs from anon, authenticated;

create table if not exists clashes (
  id uuid primary key default gen_random_uuid(), code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  a bigint not null references players(tg_id) on delete cascade, a_seat smallint not null,
  b bigint references players(tg_id) on delete set null, b_seat smallint,
  a_run uuid references clash_runs(id) on delete set null, b_run uuid references clash_runs(id) on delete set null,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '48 hours',
  status text not null default 'open' check (status in ('open', 'done', 'expired')), result text check (result in ('a', 'b', 'draw')));
create index if not exists clashes_a_idx on clashes (a, a_seat, created_at desc);
create index if not exists clashes_b_idx on clashes (b, b_seat, created_at desc);
alter table clashes enable row level security; revoke all on clashes from anon, authenticated;

-- a run as the app sees it (a ghost carries its log; a listing does not)
create or replace function cl_run_json(r clash_runs, whole boolean) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'kind', r.kind, 'house', r.house, 'champ', r.champ, 'lvl', r.lvl, 'army', r.army, 'seed', r.seed, 'bot', r.bot, 'waves', r.waves, 'door', r.door,
    'result', r.result, 'delta', r.delta, 'at', r.created_at, 'name', (select p.name from players p where p.tg_id = r.tg_id), 'rating', coalesce((select x.rating from ratings x where x.tg_id = r.tg_id and x.seat = r.seat), 1000))
    || case when whole then jsonb_build_object('log', r.log) else '{}'::jsonb end $$;

-- waves first, then the door
create or replace function cl_cmp(wa int, da int, wb int, db int) returns text language sql immutable set search_path = '' as $$
  select case when wa > wb then 'a' when wa < wb then 'b' when da > db then 'a' when da < db then 'b' else 'draw' end $$;

-- a friend clash settles when both records are in (or when it ends with one)
create or replace function cl_settle(c clashes) returns clashes language plpgsql security definer set search_path = public as $$
declare ra clash_runs; rb clash_runs; res text;
begin
  if c.status <> 'open' then return c; end if;
  if c.a_run is not null then select * into ra from clash_runs where id = c.a_run; end if;
  if c.b_run is not null then select * into rb from clash_runs where id = c.b_run; end if;
  if c.a_run is not null and c.b_run is not null then
    res := cl_cmp(ra.waves, ra.door, rb.waves, rb.door);
    update clashes x set status = 'done', result = res where x.id = c.id returning * into c;
    update clash_runs x set result = case when res = 'draw' then 'draw' when res = 'a' then 'win' else 'loss' end where x.id = c.a_run;
    update clash_runs x set result = case when res = 'draw' then 'draw' when res = 'b' then 'win' else 'loss' end where x.id = c.b_run;
  elsif now() >= c.expires_at then
    if c.a_run is not null or c.b_run is not null then
      res := case when c.a_run is not null then 'a' else 'b' end;
      update clashes x set status = 'done', result = res where x.id = c.id returning * into c;
    else update clashes x set status = 'expired' where x.id = c.id returning * into c; end if;
  end if;
  return c;
end $$;

create or replace function cl_clash_json(c clashes, me bigint, st int) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mine boolean := c.a = me and c.a_seat = st; ra clash_runs; rb clash_runs; oname text;
begin
  if c.a_run is not null then select * into ra from clash_runs where id = c.a_run; end if;
  if c.b_run is not null then select * into rb from clash_runs where id = c.b_run; end if;
  select p.name into oname from players p where p.tg_id = case when mine then c.b else c.a end;
  return jsonb_build_object('id', c.id, 'code', c.code, 'status', c.status, 'mine', mine, 'left', greatest(0, extract(epoch from c.expires_at - now())::int),
    'waiting', c.b is null, 'opponent', coalesce(oname, '…'),
    'me', case when mine then jsonb_build_object('played', c.a_run is not null, 'waves', ra.waves, 'door', ra.door) else jsonb_build_object('played', c.b_run is not null, 'waves', rb.waves, 'door', rb.door) end,
    'them', case when mine then jsonb_build_object('played', c.b_run is not null, 'waves', rb.waves, 'door', rb.door) else jsonb_build_object('played', c.a_run is not null, 'waves', ra.waves, 'door', ra.door) end,
    'result', case when c.result is null then null when c.result = 'draw' then 'draw' when (c.result = 'a') = mine then 'win' else 'loss' end);
end $$;

create or replace function cl_state(w wallets) returns jsonb language plpgsql security definer set search_path = public as $$
declare r ratings; c clashes; runs jsonb; cls jsonb := '[]'::jsonb; today int;
begin
  r := ec_rating(w.tg_id, w.seat);
  for c in select x.* from clashes x where ((x.a = w.tg_id and x.a_seat = w.seat) or (x.b = w.tg_id and x.b_seat = w.seat)) and x.created_at > now() - interval '14 days' order by x.created_at desc limit 10 loop
    c := cl_settle(c); cls := cls || jsonb_build_array(cl_clash_json(c, w.tg_id, w.seat));
  end loop;
  select coalesce(jsonb_agg(cl_run_json(x, false) order by x.created_at desc), '[]'::jsonb) into runs from (select * from clash_runs y where y.tg_id = w.tg_id and y.seat = w.seat order by y.created_at desc limit 12) x;
  select count(*) into today from clash_runs x where x.tg_id = w.tg_id and x.seat = w.seat and x.kind = 'rank' and x.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return jsonb_build_object('rating', r.rating, 'league', du_league(r.rating), 'wins', r.wins, 'losses', r.losses, 'draws', r.draws, 'rank_left', greatest(0, 5 - today),
    'cw', (select count(*) from clash_runs x where x.tg_id = w.tg_id and x.seat = w.seat and x.result = 'win'), 'cl', (select count(*) from clash_runs x where x.tg_id = w.tg_id and x.seat = w.seat and x.result = 'loss'),
    'runs', runs, 'clashes', cls);
end $$;

create or replace function clash_state(token uuid, seat int) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  return cl_state(w) || jsonb_build_object('state', ec_state(w));
end $$;

-- the ghost nearest the rating: another player's record of at least 2 waves from the last 30 days; the newest of the five nearest
create or replace function cl_ghost(pid bigint, r int) returns clash_runs language sql stable security definer set search_path = public as $$
  select z.* from clash_runs z where z.id in (
    select y.id from clash_runs y left join ratings rt on rt.tg_id = y.tg_id and rt.seat = y.seat
     where y.tg_id <> pid and y.waves >= 2 and y.created_at > now() - interval '30 days' and y.kind in ('rank', 'practice', 'friend')
     order by abs(coalesce(rt.rating, 1000) - r), y.created_at desc limit 5) order by random() limit 1 $$;

-- start: 'rank' hands a ghost (or none: the bot, and the run counts as practice); 'friend' with no code makes a challenge, with a code joins one
create or replace function clash_start(token uuid, seat int, kind text, code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; r ratings; g clash_runs; c clashes; today int; opp clash_runs;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  if kind not in ('rank', 'friend', 'practice') then raise exception 'bad clash'; end if;
  if not exists (select 1 from progress p where p.tg_id = pid and p.seat = clash_start.seat) then raise exception 'clear a stage first'; end if;
  r := ec_rating(pid, seat);
  if kind = 'rank' then
    select count(*) into today from clash_runs x where x.tg_id = pid and x.seat = clash_start.seat and x.kind = 'rank' and x.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    if today >= 5 then raise exception 'five ranked clashes a day are the limit'; end if;
    g := cl_ghost(pid, r.rating);
    return jsonb_build_object('ok', true, 'kind', 'rank', 'ghost', case when g.id is null then null else cl_run_json(g, true) end, 'rating', r.rating, 'league', du_league(r.rating));
  elsif kind = 'friend' and code is null then
    if exists (select 1 from clashes x where x.a = pid and x.a_seat = clash_start.seat and x.status = 'open' and x.b is null and x.expires_at > now()) then
      select * into c from clashes x where x.a = pid and x.a_seat = clash_start.seat and x.status = 'open' and x.b is null and x.expires_at > now() order by x.created_at desc limit 1;
    else insert into clashes (a, a_seat) values (pid, seat) returning * into c; end if;
    return jsonb_build_object('ok', true, 'kind', 'friend', 'clash', cl_clash_json(c, pid, seat));
  elsif kind = 'friend' then
    select * into c from clashes x where x.code = lower(trim(clash_start.code)) for update;
    if not found then raise exception 'no such clash'; end if;
    if c.a = pid then raise exception 'this is your own challenge'; end if;
    if c.status <> 'open' or now() >= c.expires_at then raise exception 'this clash is over'; end if;
    if c.b is not null and not (c.b = pid and c.b_seat = seat) then raise exception 'someone has joined already'; end if;
    if c.b is null then update clashes x set b = pid, b_seat = seat where x.id = c.id returning * into c; end if;
    if c.a_run is not null then select * into opp from clash_runs where id = c.a_run; end if;
    return jsonb_build_object('ok', true, 'kind', 'friend', 'clash', cl_clash_json(c, pid, seat), 'ghost', case when opp.id is null then null else cl_run_json(opp, true) end);
  end if;
  return jsonb_build_object('ok', true, 'kind', 'practice');
end $$;

-- the record of a finished clash; a ranked one against a ghost is scored here (Elo K 24, the ghost unchanged); a friend one joins its challenge
create or replace function clash_finish(token uuid, seat int, kind text, house text, champ text, lvl int, army int, seed bigint, bot int, log jsonb, waves int, door int, ghost uuid default null, code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; r ratings; g clash_runs; run clash_runs; c clashes; res text; e double precision; dlt int := 0; gift jsonb := null;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  if kind not in ('rank', 'friend', 'practice') then raise exception 'bad clash'; end if;
  if waves is null or waves < 0 or waves > 10 or door is null or door < 0 or door > 100 then raise exception 'bad result'; end if;
  if jsonb_typeof(log) <> 'array' or jsonb_array_length(log) > 600 then raise exception 'bad log'; end if;
  if house is null or house not in ('stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell') then raise exception 'bad house'; end if;
  if kind = 'rank' then
    if ghost is null then kind := 'practice';
    else
      select * into g from clash_runs where id = clash_finish.ghost;
      if g.id is null or g.tg_id = pid then raise exception 'bad ghost'; end if;
      if exists (select 1 from clash_runs x where x.tg_id = pid and x.seat = clash_finish.seat and x.kind = 'rank' and x.created_at > now() - interval '3 minutes') then raise exception 'one ranked clash at a time'; end if;
    end if;
  end if;
  insert into clash_runs (tg_id, seat, kind, house, champ, lvl, army, seed, bot, log, waves, door, ghost)
    values (pid, seat, kind, house, champ, greatest(1, coalesce(lvl, 1)), greatest(1, coalesce(army, 1)), seed, coalesce(bot, 0), log, waves, door, case when kind = 'rank' then ghost end) returning * into run;
  if kind = 'rank' then
    res := case cl_cmp(waves, door, g.waves, g.door) when 'a' then 'win' when 'b' then 'loss' else 'draw' end;
    r := ec_rating(pid, seat);
    e := 1 / (1 + power(10, (coalesce((select x.rating from ratings x where x.tg_id = g.tg_id and x.seat = g.seat), 1000) - r.rating) / 400.0));
    dlt := round(24 * ((case res when 'win' then 1 when 'draw' then 0.5 else 0 end) - e))::int;
    update ratings x set rating = greatest(0, x.rating + dlt), wins = x.wins + (res = 'win')::int, losses = x.losses + (res = 'loss')::int, draws = x.draws + (res = 'draw')::int where x.tg_id = pid and x.seat = clash_finish.seat;
    gift := case res when 'win' then '{"gold":400,"gems":10}'::jsonb when 'draw' then '{"gold":200}'::jsonb else '{"gold":80}'::jsonb end;
    w := qs_pay(w, gift, 'clash', run.id::text); perform ec_save(w);
    update clash_runs x set result = res, delta = dlt where x.id = run.id returning * into run;
  elsif kind = 'friend' and code is not null then
    select * into c from clashes x where x.code = lower(trim(clash_finish.code)) for update;
    if c.id is null then raise exception 'no such clash'; end if;
    if c.status <> 'open' then raise exception 'this clash is over'; end if;
    if c.a = pid and c.a_seat = seat then
      if c.a_run is not null then raise exception 'you have played this clash'; end if;
      update clashes x set a_run = run.id where x.id = c.id returning * into c;
    elsif c.b = pid and c.b_seat = seat then
      if c.b_run is not null then raise exception 'you have played this clash'; end if;
      update clashes x set b_run = run.id where x.id = c.id returning * into c;
    else raise exception 'not your clash'; end if;
    c := cl_settle(c);
    select * into run from clash_runs where id = run.id;
    return jsonb_build_object('ok', true, 'run', cl_run_json(run, false), 'clash', cl_clash_json(c, pid, seat), 'state', ec_state(ec_wallet(pid, seat)));
  end if;
  if kind = 'practice' and waves >= 2 and (select count(*) from clash_runs x where x.tg_id = pid and x.seat = clash_finish.seat and x.kind = 'practice' and x.waves >= 2 and x.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') <= 5 then
    gift := '{"gold":60}'::jsonb; w := qs_pay(w, gift, 'clash', run.id::text); perform ec_save(w);     -- practice: 60 gold for a run of two waves or more, five a day
  end if;
  r := ec_rating(pid, seat);
  return jsonb_build_object('ok', true, 'run', cl_run_json(run, false), 'result', run.result, 'delta', dlt, 'gift', gift, 'rating', r.rating, 'league', du_league(r.rating), 'state', ec_state(ec_wallet(pid, seat)));
end $$;

revoke all on function cl_run_json(clash_runs, boolean), cl_cmp(int, int, int, int), cl_settle(clashes), cl_clash_json(clashes, bigint, int), cl_state(wallets), cl_ghost(bigint, int) from public, anon, authenticated;
revoke all on function clash_state(uuid, int), clash_start(uuid, int, text, text), clash_finish(uuid, int, text, text, text, int, int, bigint, int, jsonb, int, int, uuid, text) from public;
grant execute on function clash_state(uuid, int), clash_start(uuid, int, text, text), clash_finish(uuid, int, text, text, text, int, int, bigint, int, jsonb, int, int, uuid, text) to anon, authenticated;

create or replace view v_clashes as
  select date_trunc('day', r.created_at)::date as day, r.kind, count(*) as runs, count(distinct r.tg_id) as players, round(avg(r.waves), 1) as waves, round(avg(r.door)) as door,
         count(*) filter (where r.result = 'win') as wins from clash_runs r group by 1, 2 order by 1 desc, 2;
revoke all on v_clashes from anon, authenticated;
