-- ============================================================
--  HOLDOR backend v10 (2026-09-29) — the 30-day login calendar and quests (game v1.0.61)
--  Run AFTER holdor_v9.sql and holdor_econ_data.sql (which now carries econ_config 'calendar' and 'quests'). Safe to re-run.
--  Every reward is paid here; progress comes only from the server's own records (battles the server opened and closed, stages it recorded).
--  * Login calendar: 30 days, all rewards visible ahead. A day is claimed once per UTC day; a missed day changes nothing — the calendar
--    goes on from where the seat left it (claims.login = {n: days claimed, last: date}). Day 30, 60 and 90 also open the next champion
--    of the house that is still sealed.
--  * Quests: Daily (UTC day), Weekly (ISO week, from Monday), Monthly (UTC month). Progress = counts over the seat's battles / stages
--    in the period (only battles fought since this seat was made). A quest is claimed once per period (claims.quests).
--  * quest_state / login_claim / quest_claim are called by the app with its session token.
-- ============================================================
-- the current period of a kind: its key, its start and its end (UTC)
create or replace function qs_window(kind text, out k text, out t0 timestamptz, out t1 timestamptz) language plpgsql stable set search_path = '' as $$
declare n timestamp := now() at time zone 'utc';
begin
  if kind = 'daily' then t0 := date_trunc('day', n) at time zone 'utc'; t1 := t0 + interval '1 day'; k := to_char(t0 at time zone 'utc', 'YYYY-MM-DD');
  elsif kind = 'weekly' then t0 := date_trunc('week', n) at time zone 'utc'; t1 := t0 + interval '7 days'; k := 'W' || to_char(t0 at time zone 'utc', 'IYYY-IW');
  elsif kind = 'monthly' then t0 := date_trunc('month', n) at time zone 'utc'; t1 := (date_trunc('month', n) + interval '1 month') at time zone 'utc'; k := 'M' || to_char(t0 at time zone 'utc', 'YYYY-MM');
  else raise exception 'bad period'; end if;
end $$;

-- one count over a seat's records in a window (battles fought before the seat was made do not count)
create or replace function qs_metric(pid bigint, st int, since timestamptz, until_ timestamptz, metric text) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare v bigint := 0; c timestamptz;
begin
  select w.created_at into c from wallets w where w.tg_id = pid and w.seat = st;
  if c is null then return 0; end if;
  since := greatest(since, c);
  if metric = 'wins' then select count(*) into v from battles b where b.tg_id = pid and b.seat = st and b.kind in ('camp', 'hard') and b.status = 'won' and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'hard_wins' then select count(*) into v from battles b where b.tg_id = pid and b.seat = st and b.kind = 'hard' and b.status = 'won' and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'battles' then select count(*) into v from battles b where b.tg_id = pid and b.seat = st and b.kind in ('camp', 'hard') and b.status in ('won', 'lost') and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'kills' then select coalesce(sum(b.kills), 0) into v from battles b where b.tg_id = pid and b.seat = st and b.status in ('won', 'lost', 'done') and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'stars' then select coalesce(sum(b.stars), 0) into v from battles b where b.tg_id = pid and b.seat = st and b.kind in ('camp', 'hard') and b.status = 'won' and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'hold_runs' then select count(*) into v from battles b where b.tg_id = pid and b.seat = st and b.kind = 'hold' and b.status = 'done' and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'hold_waves' then select coalesce(max(b.waves), 0) into v from battles b where b.tg_id = pid and b.seat = st and b.kind = 'hold' and b.status = 'done' and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'days' then select count(distinct (b.finished_at at time zone 'utc')::date) into v from battles b where b.tg_id = pid and b.seat = st and b.status in ('won', 'lost', 'done') and b.finished_at >= since and b.finished_at < until_;
  elsif metric = 'new_stages' then select count(*) into v from progress p where p.tg_id = pid and p.seat = st and p.at >= since and p.at < until_;
  else raise exception 'bad metric'; end if;
  return coalesce(v, 0);
end $$;

-- pay a reward {gold, gems, books:{b:c:n}} to the wallet (returns the wallet)
create or replace function qs_pay(inout w wallets, r jsonb, reason text, ref text) language plpgsql security definer set search_path = public as $$
declare b record;
begin
  if ec_i(r, 'gold') > 0 then w := ec_book(w, 'gold', ec_i(r, 'gold'), reason, ref); end if;
  if ec_i(r, 'gems') > 0 then w := ec_book(w, 'gems', ec_i(r, 'gems'), reason, ref); end if;
  for b in select e.key as k, jint(e.value #>> '{}') as n from jsonb_each(coalesce(r->'books', '{}'::jsonb)) e loop
    if split_part(b.k, ':', 1) = 'b' and b.n > 0 then w := ec_cards(w, b.k, b.n::int); end if;
  end loop;
end $$;

create or replace function qs_state(w wallets) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cq jsonb := econ_cfg('quests'); cal jsonb := econ_cfg('calendar'); lg jsonb := coalesce(w.claims->'login', '{}'::jsonb); per jsonb := '{}'::jsonb; kind text; win record; items jsonb;
        q jsonb; cur bigint; done jsonb; today text := ec_day(); n int := ec_i(lg, 'n')::int; sp int[] := array[30, 60, 90];
begin
  foreach kind in array array['daily', 'weekly', 'monthly'] loop
    select * into win from qs_window(kind);
    done := coalesce(w.claims->'quests'->win.k, '[]'::jsonb); items := '[]'::jsonb;
    for q in select x from jsonb_array_elements(coalesce(cq->kind, '[]'::jsonb)) x loop
      cur := qs_metric(w.tg_id, w.seat, win.t0, win.t1, q->>'m');
      items := items || jsonb_build_array(jsonb_build_object('id', q->>'id', 'cur', least(cur, ec_i(q, 'n')), 'need', ec_i(q, 'n'), 'claimed', done ? (q->>'id')));
    end loop;
    per := per || jsonb_build_object(kind, jsonb_build_object('key', win.k, 'left', greatest(0, extract(epoch from win.t1 - now())::int), 'q', items));
  end loop;
  return jsonb_build_object('login', jsonb_build_object('n', n, 'day', n % 30 + 1, 'can', lg->>'last' is distinct from today, 'last', lg->>'last',
                              'special_in', (select min(x - n) from unnest(sp) x where x > n), 'cycle', 30), 'periods', per);
end $$;

create or replace function quest_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  return qs_state(w);
end $$;

-- today's calendar reward
create or replace function login_claim(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cal jsonb := econ_cfg('calendar'); lg jsonb; n int; r jsonb; today text := ec_day(); house text; cl int; champ text := null; nx text;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  lg := coalesce(w.claims->'login', '{}'::jsonb); n := ec_i(lg, 'n')::int;
  if lg->>'last' = today then raise exception 'already claimed today'; end if;
  r := cal->'days'->(n % 30);
  if r is null then raise exception 'no calendar'; end if;
  w := qs_pay(w, r, 'login', (n % 30 + 1)::text);
  if (n + 1) in (30, 60, 90) then     -- the special champion: the next one of the house still sealed (or dragonglass when none is)
    select p.save->'slots'->w.seat::int->>'house' into house from players p where p.tg_id = pid;
    select count(*) into cl from progress p where p.tg_id = pid and p.seat = login_claim.seat and p.mode = 'c';
    select e.key into champ from jsonb_each(econ_cfg('cards')->'champs') e
     where e.value->>'house' = house and cl < (e.value->>'open')::int and not coalesce(w.claims->'copen', '{}'::jsonb) ? e.key
     order by (e.value->>'open')::int limit 1;
    if champ is not null then w.claims := jsonb_set(w.claims, '{copen}', coalesce(w.claims->'copen', '{}'::jsonb) || jsonb_build_object(champ, 1));
    else w := ec_book(w, 'gems', ec_i(cal, 'special_gems'), 'login', 'special'); end if;
  end if;
  w.claims := jsonb_set(w.claims, '{login}', jsonb_build_object('n', n + 1, 'last', today));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'day', n % 30 + 1, 'reward', r, 'champ', champ, 'state', ec_state(w), 'quests', qs_state(w));
end $$;

create or replace function quest_claim(token uuid, seat int, quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; kind text; q jsonb; win record; done jsonb; cur bigint; keep jsonb := '{}'::jsonb; k text; r jsonb;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  foreach kind in array array['daily', 'weekly', 'monthly'] loop
    select x into q from jsonb_array_elements(coalesce(econ_cfg('quests')->kind, '[]'::jsonb)) x where x->>'id' = quest;
    exit when q is not null;
  end loop;
  if q is null then raise exception 'no such quest'; end if;
  select * into win from qs_window(kind);
  done := coalesce(w.claims->'quests'->win.k, '[]'::jsonb);
  if done ? quest then raise exception 'already claimed'; end if;
  cur := qs_metric(pid, seat, win.t0, win.t1, q->>'m');
  if cur < ec_i(q, 'n') then raise exception 'not done yet: % of %', cur, ec_i(q, 'n'); end if;
  r := q->'r';
  w := qs_pay(w, r, 'quest', quest);
  -- keep only the current periods' claims
  for k in select unnest(array[(select x.k from qs_window('daily') x), (select x.k from qs_window('weekly') x), (select x.k from qs_window('monthly') x)]) loop
    if w.claims->'quests' ? k then keep := keep || jsonb_build_object(k, w.claims->'quests'->k); end if;
  end loop;
  keep := jsonb_set(keep, array[win.k], coalesce(keep->win.k, '[]'::jsonb) || to_jsonb(quest));
  w.claims := jsonb_set(w.claims, '{quests}', keep);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', r, 'state', ec_state(w), 'quests', qs_state(w));
end $$;

-- the owner's dashboard: how many seats claim the calendar and the quests each day
create or replace view v_daily_claims as
  select (l.at at time zone 'utc')::date as day, l.reason, count(*) as bookings, count(distinct (l.tg_id, l.seat)) as seats
    from ledger l where l.reason in ('login', 'quest') group by 1, 2 order by 1 desc, 2;
revoke all on v_daily_claims from anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['qs_window(text)', 'qs_metric(bigint,integer,timestamptz,timestamptz,text)', 'qs_pay(wallets,jsonb,text,text)', 'qs_state(wallets)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on function quest_state(uuid, int), login_claim(uuid, int), quest_claim(uuid, int, text) from public;
grant execute on function quest_state(uuid, int), login_claim(uuid, int), quest_claim(uuid, int, text) to anon, authenticated;
