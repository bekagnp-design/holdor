-- ============================================================
--  HOLDOR backend v18 (2026-09-30) — Earn: the estate (hourly income from buildings) and the two-day events (game v1.0.74)
--  Run AFTER holdor_v17.sql. Safe to re-run.
--  * The estate: nine buildings that open with the ACCOUNT LEVEL and are built and upgraded with gold. Each level costs 1.8× the one before and
--    adds only +50 % of the first level's income, so upgrades pay back slowly (the first level in ~40 hours, level 5 in ~140 h). Income is
--    collected by hand and stops piling up after `cap_h` hours (3), so it is a small extra, never the main way to earn.
--    Building or upgrading collects what has piled up first. Level n of a building needs account level unlock + 2·(n − 1).
--  * Events: two windows a week, both two days (UTC): Mon–Tue "Builders' Boom" (estate income +50 % for the hours that fall inside it) and
--    Fri–Sat "Duel Cup" (ranked duel gifts doubled). ev_at(ts) is the schedule; the app draws the countdown from the same rule.
-- ============================================================
create or replace function ev_at(ts timestamptz, out kind text, out active boolean, out t0 timestamptz, out t1 timestamptz)
language plpgsql stable set search_path = '' as $$
declare d timestamp := ts at time zone 'utc'; dow int := extract(isodow from d)::int; day0 timestamp := date_trunc('day', d);
begin
  if dow in (1, 2) then kind := 'boom'; active := true; t0 := (day0 - make_interval(days => dow - 1)) at time zone 'utc';
  elsif dow in (5, 6) then kind := 'cup'; active := true; t0 := (day0 - make_interval(days => dow - 5)) at time zone 'utc';
  elsif dow in (3, 4) then kind := 'cup'; active := false; t0 := (day0 + make_interval(days => 5 - dow)) at time zone 'utc';
  else kind := 'boom'; active := false; t0 := (day0 + make_interval(days => 1)) at time zone 'utc'; end if;
  t1 := t0 + interval '2 days';
end $$;

insert into econ_config (k, v) values ('estate', '{"cap_h":3,"max":10,"cost_mul":1.8,"income_step":0.5,"unlock_step":2,"boom_pct":50,
  "buildings":[
   {"id":"farm","n":"Farm","e":"🌾","unlock":3,"cost":800,"income":20},
   {"id":"lumber","n":"Lumberyard","e":"🪵","unlock":6,"cost":1400,"income":35},
   {"id":"quarry","n":"Quarry","e":"⛏️","unlock":10,"cost":2200,"income":55},
   {"id":"mine","n":"Iron mine","e":"⚒️","unlock":15,"cost":3200,"income":80},
   {"id":"market","n":"Market stalls","e":"🏪","unlock":20,"cost":4400,"income":110},
   {"id":"harbor","n":"Harbor","e":"⚓","unlock":27,"cost":6000,"income":150},
   {"id":"scriptorium","n":"Scriptorium","e":"📜","unlock":35,"cost":8000,"income":200},
   {"id":"vault","n":"Vault","e":"🏦","unlock":45,"cost":10400,"income":260},
   {"id":"crown","n":"Crown lands","e":"👑","unlock":55,"cost":13600,"income":340}]}'::jsonb)
on conflict (k) do update set v = excluded.v;

create or replace function es_cost(cfg jsonb, b jsonb, n int) returns bigint language sql immutable set search_path = '' as $$
  select (round(((b->>'cost')::numeric * power((cfg->>'cost_mul')::numeric, n - 1)) / 50) * 50)::bigint $$;
create or replace function es_income(cfg jsonb, b jsonb, n int) returns int language sql immutable set search_path = '' as $$
  select case when n <= 0 then 0 else round((b->>'income')::numeric * (1 + (cfg->>'income_step')::numeric * (n - 1)))::int end $$;
create or replace function es_need(cfg jsonb, b jsonb, n int) returns int language sql immutable set search_path = '' as $$
  select (b->>'unlock')::int + (cfg->>'unlock_step')::int * (n - 1) $$;
-- gold per hour of everything built
create or replace function es_rate(cfg jsonb, lv jsonb) returns int language sql immutable set search_path = public as $$
  select coalesce(sum(es_income(cfg, b, coalesce((lv->>(b->>'id'))::int, 0))), 0)::int from jsonb_array_elements(cfg->'buildings') b $$;

-- what has piled up since the last collection (at most cap_h hours; the Boom adds its share for the hours inside it)
create or replace function es_pending(w wallets) returns int language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := econ_cfg('estate'); e jsonb := coalesce(w.claims->'estate', '{}'::jsonb); at timestamptz := (e->>'at')::timestamptz; rate int := es_rate(cfg, coalesce(e->'b', '{}'::jsonb));
        hrs double precision; st timestamptz; m0 timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc'; ov double precision;
begin
  if at is null or rate = 0 then return 0; end if;
  hrs := least((cfg->>'cap_h')::double precision, greatest(0, extract(epoch from now() - at) / 3600.0));
  st := now() - make_interval(secs => hrs * 3600);
  ov := greatest(0, extract(epoch from least(now(), m0 + interval '2 days') - greatest(st, m0)) / 3600.0);
  return floor(rate * (hrs + ov * (cfg->>'boom_pct')::double precision / 100.0))::int;
end $$;

create or replace function es_state(w wallets) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := econ_cfg('estate'); e jsonb := coalesce(w.claims->'estate', '{}'::jsonb); lv jsonb := coalesce(e->'b', '{}'::jsonb); acc int := xp_level(w.xp);
        items jsonb := '[]'::jsonb; b jsonb; n int; mx int := (cfg->>'max')::int; nx int; ev record;
begin
  for b in select x from jsonb_array_elements(cfg->'buildings') x loop
    n := coalesce((lv->>(b->>'id'))::int, 0); nx := n + 1;
    items := items || jsonb_build_array(jsonb_build_object('id', b->>'id', 'n', b->>'n', 'e', b->>'e', 'lvl', n, 'max', mx, 'income', es_income(cfg, b, n),
      'next_income', case when n < mx then es_income(cfg, b, nx) end, 'cost', case when n < mx then es_cost(cfg, b, nx) end,
      'need', case when n < mx then es_need(cfg, b, nx) end, 'open', n < mx and acc >= es_need(cfg, b, nx), 'unlock', (b->>'unlock')::int));
  end loop;
  select * into ev from ev_at(now());
  return jsonb_build_object('level', acc, 'per_hour', es_rate(cfg, lv), 'pending', es_pending(w), 'cap_h', (cfg->>'cap_h')::int, 'at', e->>'at', 'items', items,
    'event', jsonb_build_object('kind', ev.kind, 'active', ev.active, 'starts', ev.t0, 'ends', ev.t1, 'boom_pct', (cfg->>'boom_pct')::int));
end $$;

create or replace function estate_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  return es_state(w);
end $$;

create or replace function estate_collect(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; p int; e jsonb;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  p := es_pending(w);
  if p <= 0 then raise exception 'nothing to collect yet'; end if;
  w := ec_book(w, 'gold', p, 'estate_income', null);
  e := coalesce(w.claims->'estate', '{}'::jsonb) || jsonb_build_object('at', now());
  w.claims := jsonb_set(w.claims, '{estate}', e);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'gold', p, 'state', ec_state(w), 'estate', es_state(w));
end $$;

create or replace function estate_build(token uuid, seat int, bld text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('estate'); b jsonb; e jsonb; lv jsonb; n int; cost bigint; p int;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  select x into b from jsonb_array_elements(cfg->'buildings') x where x->>'id' = bld;
  if b is null then raise exception 'no such building'; end if;
  e := coalesce(w.claims->'estate', '{}'::jsonb); lv := coalesce(e->'b', '{}'::jsonb);
  n := coalesce((lv->>bld)::int, 0) + 1;
  if n > (cfg->>'max')::int then raise exception 'already at the top level'; end if;
  if xp_level(w.xp) < es_need(cfg, b, n) then raise exception 'account level % is needed', es_need(cfg, b, n); end if;
  p := es_pending(w);
  if p > 0 then w := ec_book(w, 'gold', p, 'estate_income', null); end if;      -- what has piled up is paid first, at the old rate
  cost := es_cost(cfg, b, n);
  w := ec_book(w, 'gold', -cost, 'estate', bld || ':' || n);
  lv := jsonb_set(lv, array[bld], to_jsonb(n));
  w.claims := jsonb_set(w.claims, '{estate}', jsonb_build_object('b', lv, 'at', now()));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'lvl', n, 'cost', cost, 'collected', p, 'state', ec_state(w), 'estate', es_state(w));
end $$;

revoke all on function ev_at(timestamptz), es_cost(jsonb, jsonb, int), es_income(jsonb, jsonb, int), es_need(jsonb, jsonb, int), es_rate(jsonb, jsonb), es_pending(wallets), es_state(wallets) from public, anon, authenticated;
grant execute on function ev_at(timestamptz) to anon, authenticated;
revoke all on function estate_state(uuid, int), estate_collect(uuid, int), estate_build(uuid, int, text) from public;
grant execute on function estate_state(uuid, int), estate_collect(uuid, int), estate_build(uuid, int, text) to anon, authenticated;

-- Duel Cup: the settling of a ranked duel doubles its gift on Fridays and Saturdays (UTC)
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
    if d.kind = 'rank' and exists (select 1 from ev_at(now()) e where e.kind = 'cup' and e.active) then      -- Duel Cup: ranked gifts doubled
      gift := (select jsonb_object_agg(x.k, ((x.v #>> '{}')::int * 2)) from jsonb_each(gift) x(k, v));
    end if;
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

create or replace view v_estate as
  select l.reason, date_trunc('day', l.at)::date as day, count(*) as bookings, count(distinct (l.tg_id, l.seat)) as seats, sum(l.delta) as gold
    from ledger l where l.reason in ('estate', 'estate_income') group by 1, 2 order by 2 desc, 1;
revoke all on v_estate from anon, authenticated;
