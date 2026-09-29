-- ============================================================
--  HOLDOR backend v15 (2026-09-30) — Duel: asynchronous 1v1 on the Hold map (game v1.0.67)
--  Run AFTER holdor_v14.sql. Safe to re-run.
--  A duel compares two Hold runs on the same map (the day's Hold map is the same for everybody). Nothing is played "live": each side
--  fights its own run, and the server compares what it recorded itself (battles of kind 'hold' finished inside the duel's window —
--  never a number the app sends). A run's score is waves × 1000 + kills (kills capped at 999).
--  * kind 'rank': the opponent is the recorded best run of a real player near your rating (a "ghost" — he is not asked and loses
--    nothing); with nobody to match, a bot of your level. Elo (K 32) for the side that plays; up to 5 ranked duels a day per seat.
--  * kind 'friend': a link/code; the friend joins and both play; whoever scores higher wins; no rating, no reward.
--  * kind 'ai': practice against a bot, always marked, no rating; a small gold gift only.
--  * Leagues by rating: Bronze < 1100, Silver < 1300, Gold < 1500, Crystal < 1700, Dragon ≥ 1700.
--  Hold attempts are shared with the Hold tab (a duel run is a Hold run).
-- ============================================================
create table if not exists ratings (
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  rating int not null default 1000, wins int not null default 0, losses int not null default 0, draws int not null default 0,
  primary key (tg_id, seat));
alter table ratings enable row level security; revoke all on ratings from anon, authenticated;

create table if not exists duels (
  id uuid primary key default gen_random_uuid(), code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  kind text not null check (kind in ('rank', 'friend', 'ai')),
  a bigint not null references players(tg_id) on delete cascade, a_seat smallint not null,
  b bigint references players(tg_id) on delete set null, b_seat smallint,
  b_name text, b_rating int not null default 1000, b_waves int, b_kills int, b_score int,
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done', 'expired')),
  a_waves int, a_kills int, a_score int, result text check (result in ('a', 'b', 'draw')), a_delta int, settled_at timestamptz);
create index if not exists duels_a_idx on duels (a, a_seat, created_at desc);
create index if not exists duels_b_idx on duels (b, b_seat, created_at desc);
alter table duels enable row level security; revoke all on duels from anon, authenticated;

create or replace function du_league(r int) returns text language sql immutable set search_path = '' as $$
  select case when r < 1100 then 'Bronze' when r < 1300 then 'Silver' when r < 1500 then 'Gold' when r < 1700 then 'Crystal' else 'Dragon' end $$;

-- a player's best Hold run in a window: score, waves, kills
create or replace function du_best(pid bigint, st int, t0 timestamptz, t1 timestamptz, out score int, out waves int, out kills int)
language sql stable security definer set search_path = public as $$
  select (b.waves * 1000 + least(coalesce(b.kills, 0), 999))::int, b.waves, coalesce(b.kills, 0)
    from battles b where b.tg_id = pid and b.seat = st and b.kind = 'hold' and b.status = 'done' and b.waves is not null and b.finished_at >= t0 and b.finished_at < t1
   order by b.waves * 1000 + least(coalesce(b.kills, 0), 999) desc limit 1 $$;

-- the bot: a run that gets better with the player's rating
create or replace function du_bot(r int, out waves int, out kills int) language sql immutable set search_path = '' as $$
  select greatest(4, 6 + (r - 1000) / 100)::int, (greatest(4, 6 + (r - 1000) / 100) * 22)::int $$;

create or replace function ec_rating(pid bigint, st int) returns ratings language plpgsql security definer set search_path = public as $$
declare r ratings;
begin
  insert into ratings (tg_id, seat) values (pid, st) on conflict do nothing;
  select * into r from ratings x where x.tg_id = pid and x.seat = st;
  return r;
end $$;

-- compare a duel's runs and close it when it can be closed (the caller's wallet pays the ranked / practice gift)
create or replace function du_settle(d duels, w wallets) returns duels language plpgsql security definer set search_path = public as $$
declare sa record; sb record; res text; ra ratings; e double precision; delta int; gift jsonb;
begin
  if d.status <> 'open' then return d; end if;
  if now() >= d.expires_at then
    if d.kind = 'friend' and d.b is not null then      -- a friend duel that ended: compare what there is
      select * into sa from du_best(d.a, d.a_seat, d.created_at, d.expires_at);
      select * into sb from du_best(d.b, d.b_seat, d.created_at, d.expires_at);
      if sa.score is not null or sb.score is not null then
        res := case when coalesce(sa.score, -1) > coalesce(sb.score, -1) then 'a' when coalesce(sa.score, -1) < coalesce(sb.score, -1) then 'b' else 'draw' end;
        update duels x set status = 'done', result = res, a_waves = sa.waves, a_kills = sa.kills, a_score = sa.score, b_waves = sb.waves, b_kills = sb.kills, b_score = sb.score, settled_at = now() where x.id = d.id returning * into d;
        return d;
      end if;
    end if;
    update duels x set status = 'expired', settled_at = now() where x.id = d.id returning * into d;
    return d;
  end if;
  select * into sa from du_best(d.a, d.a_seat, d.created_at, d.expires_at);
  if d.kind in ('rank', 'ai') then
    if sa.score is null then return d; end if;
    res := case when sa.score > d.b_score then 'a' when sa.score < d.b_score then 'b' else 'draw' end;
    delta := 0;
    if d.kind = 'rank' then
      ra := ec_rating(d.a, d.a_seat);
      e := 1 / (1 + power(10, (d.b_rating - ra.rating) / 400.0));
      delta := round(32 * ((case res when 'a' then 1 when 'draw' then 0.5 else 0 end) - e))::int;
      update ratings x set rating = greatest(0, x.rating + delta), wins = x.wins + (res = 'a')::int, losses = x.losses + (res = 'b')::int, draws = x.draws + (res = 'draw')::int
       where x.tg_id = d.a and x.seat = d.a_seat;
    end if;
    gift := case when d.kind = 'ai' then '{"gold":100}'::jsonb else case res when 'a' then '{"gems":15,"gold":500}'::jsonb when 'draw' then '{"gold":250}'::jsonb else '{"gold":100}'::jsonb end end;
    if w.tg_id = d.a and w.seat = d.a_seat then w := qs_pay(w, gift, 'duel', d.id::text); perform ec_save(w); end if;
    update duels x set status = 'done', result = res, a_waves = sa.waves, a_kills = sa.kills, a_score = sa.score, a_delta = delta, settled_at = now() where x.id = d.id returning * into d;
  else
    if d.b is null then return d; end if;
    select * into sb from du_best(d.b, d.b_seat, d.created_at, d.expires_at);
    if sa.score is null or sb.score is null then return d; end if;
    res := case when sa.score > sb.score then 'a' when sa.score < sb.score then 'b' else 'draw' end;
    update duels x set status = 'done', result = res, a_waves = sa.waves, a_kills = sa.kills, a_score = sa.score, b_waves = sb.waves, b_kills = sb.kills, b_score = sb.score, settled_at = now() where x.id = d.id returning * into d;
  end if;
  return d;
end $$;

create or replace function du_json(d duels, me bigint, st int) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mine boolean := d.a = me and d.a_seat = st; sa record; sb record; oname text;
begin
  select * into sa from du_best(case when d.status = 'open' then d.a end, d.a_seat, d.created_at, d.expires_at);
  select * into sb from du_best(case when d.status = 'open' and d.kind = 'friend' then d.b end, d.b_seat, d.created_at, d.expires_at);
  select coalesce((select p.name from players p where p.tg_id = case when mine then d.b else d.a end), d.b_name) into oname;
  return jsonb_build_object('id', d.id, 'code', d.code, 'kind', d.kind, 'status', d.status, 'mine', mine, 'left', greatest(0, extract(epoch from d.expires_at - now())::int),
    'opponent', case when d.kind = 'ai' then 'Bot' when mine then coalesce(d.b_name, oname, '…') else coalesce(oname, '…') end,
    'me', case when mine then jsonb_build_object('score', coalesce(d.a_score, sa.score), 'waves', coalesce(d.a_waves, sa.waves), 'kills', coalesce(d.a_kills, sa.kills))
               else jsonb_build_object('score', coalesce(d.b_score, sb.score), 'waves', coalesce(d.b_waves, sb.waves), 'kills', coalesce(d.b_kills, sb.kills)) end,
    'them', case when d.kind in ('rank', 'ai') then jsonb_build_object('score', d.b_score, 'waves', d.b_waves, 'kills', d.b_kills)
                 when mine then jsonb_build_object('score', coalesce(d.b_score, sb.score), 'waves', coalesce(d.b_waves, sb.waves), 'kills', coalesce(d.b_kills, sb.kills))
                 else jsonb_build_object('score', coalesce(d.a_score, sa.score), 'waves', coalesce(d.a_waves, sa.waves), 'kills', coalesce(d.a_kills, sa.kills)) end,
    'result', case when d.result is null then null when d.result = 'draw' then 'draw' when (d.result = 'a') = mine then 'win' else 'loss' end,
    'delta', case when mine then d.a_delta end, 'waiting', d.kind = 'friend' and d.b is null);
end $$;

create or replace function du_state(w wallets) returns jsonb language plpgsql security definer set search_path = public as $$
declare r ratings; d duels; out jsonb := '[]'::jsonb; today int;
begin
  perform ec_rating(w.tg_id, w.seat);
  for d in select x.* from duels x where ((x.a = w.tg_id and x.a_seat = w.seat) or (x.b = w.tg_id and x.b_seat = w.seat)) and x.created_at > now() - interval '14 days' order by x.created_at desc limit 12 loop
    d := du_settle(d, w);
    out := out || jsonb_build_array(du_json(d, w.tg_id, w.seat));
  end loop;
  r := ec_rating(w.tg_id, w.seat);
  select count(*) into today from duels x where x.a = w.tg_id and x.a_seat = w.seat and x.kind = 'rank' and x.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return jsonb_build_object('rating', r.rating, 'league', du_league(r.rating), 'wins', r.wins, 'losses', r.losses, 'draws', r.draws,
    'rank_left', greatest(0, 5 - today), 'duels', out);
end $$;

create or replace function duel_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; s jsonb;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  s := du_state(w);
  return s || jsonb_build_object('state', ec_state(ec_wallet(pid, seat)));
end $$;

-- start a duel: kind 'rank' (a ghost or a bot near your rating), 'ai' (practice), 'friend' (a code to send)
create or replace function duel_start(token uuid, seat int, kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; r ratings; g record; d duels; today int; bot record; hours int := 24;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  if kind not in ('rank', 'friend', 'ai') then raise exception 'bad duel'; end if;
  if not exists (select 1 from progress p where p.tg_id = pid and p.seat = duel_start.seat) then raise exception 'clear a stage first'; end if;
  perform du_state(w);      -- settles what can be settled
  if exists (select 1 from duels x where x.a = pid and x.a_seat = duel_start.seat and x.status = 'open' and x.kind = duel_start.kind and x.expires_at > now()) then
    raise exception 'you already have an open % duel', kind; end if;
  r := ec_rating(pid, seat);
  if kind = 'rank' then
    select count(*) into today from duels x where x.a = pid and x.a_seat = duel_start.seat and x.kind = 'rank' and x.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    if today >= 5 then raise exception 'five ranked duels a day are the limit'; end if;
    select h.tg_id, h.seat, h.waves, h.kills, coalesce(rt.rating, 1000) as rating, p.name into g
      from (select distinct on (b.tg_id, b.seat) b.tg_id, b.seat, b.waves, coalesce(b.kills, 0) as kills from battles b
             where b.kind = 'hold' and b.status = 'done' and b.waves is not null and b.finished_at > now() - interval '7 days' and b.tg_id <> pid
             order by b.tg_id, b.seat, b.waves * 1000 + least(coalesce(b.kills, 0), 999) desc) h
      join players p on p.tg_id = h.tg_id left join ratings rt on rt.tg_id = h.tg_id and rt.seat = h.seat
     order by abs(coalesce(rt.rating, 1000) - r.rating), random() limit 1;
    if g.tg_id is not null then
      insert into duels (kind, a, a_seat, b, b_seat, b_name, b_rating, b_waves, b_kills, b_score, expires_at)
        values ('rank', pid, seat, g.tg_id, g.seat, g.name || case when g.seat > 0 then ' ' || (array['', 'II', 'III'])[g.seat + 1] else '' end, g.rating, g.waves, g.kills, g.waves * 1000 + least(g.kills, 999), now() + interval '24 hours') returning * into d;
    else kind := 'ai'; end if;
  end if;
  if kind = 'ai' then
    select * into bot from du_bot(r.rating);
    insert into duels (kind, a, a_seat, b_name, b_rating, b_waves, b_kills, b_score, expires_at)
      values ('ai', pid, seat, 'Bot', r.rating, bot.waves, bot.kills, bot.waves * 1000 + least(bot.kills, 999), now() + interval '24 hours') returning * into d;
  elsif kind = 'friend' then
    insert into duels (kind, a, a_seat, expires_at) values ('friend', pid, seat, now() + interval '48 hours') returning * into d;
  end if;
  return jsonb_build_object('ok', true, 'duel', du_json(d, pid, seat)) || jsonb_build_object('duels', du_state(w));
end $$;

-- the friend joins by code
create or replace function duel_join(token uuid, seat int, code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; d duels;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  select * into d from duels x where x.code = lower(trim(duel_join.code)) for update;
  if not found then raise exception 'no such duel'; end if;
  if d.kind <> 'friend' then raise exception 'not a friend duel'; end if;
  if d.a = pid then raise exception 'this is your own challenge'; end if;
  if d.status <> 'open' or now() >= d.expires_at then raise exception 'this duel is over'; end if;
  if d.b is not null then raise exception 'someone has joined already'; end if;
  if not exists (select 1 from progress p where p.tg_id = pid and p.seat = duel_join.seat) then raise exception 'clear a stage first'; end if;
  update duels x set b = pid, b_seat = seat, b_name = null where x.id = d.id returning * into d;
  return jsonb_build_object('ok', true, 'duel', du_json(d, pid, seat));
end $$;

revoke all on function du_league(int), du_best(bigint, int, timestamptz, timestamptz), du_bot(int), ec_rating(bigint, int), du_settle(duels, wallets), du_json(duels, bigint, int), du_state(wallets) from public, anon, authenticated;
revoke all on function duel_state(uuid, int), duel_start(uuid, int, text), duel_join(uuid, int, text) from public;
grant execute on function duel_state(uuid, int), duel_start(uuid, int, text), duel_join(uuid, int, text) to anon, authenticated;

create or replace view v_duels as
  select date_trunc('day', d.created_at)::date as day, d.kind, count(*) as duels, count(*) filter (where d.status = 'done') as finished,
         count(*) filter (where d.result = 'a') as a_wins, count(distinct d.a) as players
    from duels d group by 1, 2 order by 1 desc, 2;
revoke all on v_duels from anon, authenticated;
