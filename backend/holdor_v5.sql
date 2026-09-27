-- ============================================================
--  HOLDOR backend v5 (2026-09-28) — the server owns the economy
--  Run AFTER holdor_v4.sql, then holdor_econ_data.sql (the game's price tables). Safe to re-run.
--
--  For a seat played by the app v1.0.56+ ("managed" — it has a row in wallets):
--  * gold, dragonglass, energy and account XP live here; the app shows its copy and sends every change as an
--    operation (econ_sync). The server checks balance, price (the game's own tables) and level, and answers with
--    the true balance. Nothing is ever deleted from the ledger.
--  * every battle is opened (battle_start: energy, is the stage open, Hold attempts) and closed (battle_finish:
--    at least the fastest possible number of steps, no faster than 4× real time, kills within reach, ≤ 3 stars).
--    The reward is computed here. Stage stars and Hold waves for the standings come only from here.
--  * chests (chest_open) are checked against their source and rolled here.
--  * anything refused goes to econ_flags (an airdrop snapshot leaves those accounts out).
--  Older apps keep working on their seats as before (v4), except hold_result, which a managed seat no longer accepts.
-- ============================================================

-- ---------- 1. tables (no app access: RLS on, no policies, grants revoked) ----------
create table if not exists econ_config (k text primary key, v jsonb not null);
create table if not exists wallets (
  tg_id bigint not null references players(tg_id) on delete cascade,
  seat smallint not null,
  made text not null default '',                 -- the seat's identity (made/house): a new seat in the same place starts fresh
  gold bigint not null default 0 check (gold >= 0),
  gems bigint not null default 0 check (gems >= 0),
  energy int not null default 0 check (energy >= 0),
  energy_at timestamptz not null default now(),
  xp bigint not null default 0,
  kills bigint not null default 0,
  levels jsonb not null default '{}'::jsonb,     -- server copy: c:<champ> t:<tower> s:<spell> sk:<champ>:<i> upg:<id> army hold_door hold_bank
  claims jsonb not null default '{}'::jsonb,     -- tut, ach, lvl_chests, star_chests, free_chest_at, hold, deals, refills, legacy_best, legacy
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tg_id, seat));
create table if not exists ledger (
  id bigserial primary key,
  tg_id bigint not null, seat smallint not null,
  cur text not null, delta bigint not null, bal bigint not null,
  reason text not null, ref text, op_id uuid, battle_id uuid,
  at timestamptz not null default now());
create index if not exists ledger_seat_idx on ledger (tg_id, seat, at desc);
create table if not exists econ_ops (
  op_id uuid primary key, tg_id bigint not null, seat smallint not null,
  r text, ok boolean not null, why text, at timestamptz not null default now());
create table if not exists battles (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  kind text not null, stage int, energy int not null default 0,
  started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null default 'open',           -- open | won | lost | done | rejected | expired
  steps int, stars int, waves int, kills int, why text, reward jsonb);
create index if not exists battles_seat_idx on battles (tg_id, seat, started_at desc);
create table if not exists progress (
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  mode char(1) not null,                          -- c = Easy campaign, h = Hard
  stage int not null, stars smallint not null check (stars between 1 and 3),
  at timestamptz not null default now(),
  primary key (tg_id, seat, mode, stage));
create table if not exists chests (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null, tier text not null, source text not null,
  gold int not null, gems int not null, cards int not null, filled int not null default 0,
  at timestamptz not null default now());
create table if not exists econ_flags (
  id bigserial primary key, tg_id bigint, seat smallint, kind text not null, detail jsonb, at timestamptz not null default now());
create index if not exists econ_flags_idx on econ_flags (tg_id, at desc);
create table if not exists battle_limits (kind text not null, n int not null, min_steps int not null, max_kills int not null, primary key (kind, n));
-- the seats that existed before v5: they bring their save's gold, stars and levels once, the first time the new app opens them
create table if not exists econ_legacy (tg_id bigint not null, seat smallint not null, made text not null, used_at timestamptz, primary key (tg_id, seat));

do $$ declare t text; begin
  foreach t in array array['econ_config','wallets','ledger','econ_ops','battles','progress','chests','econ_flags','battle_limits','econ_legacy'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence ledger_id_seq, econ_flags_id_seq from anon, authenticated;

-- tunables (holdor_econ_data.sql adds the game's price tables; a re-run of this file keeps values changed in the dashboard)
insert into econ_config (k, v) values
  ('energy', '{"max":60,"regen_s":150,"cost":[3,4,5,6,7],"per":10,"hard_extra":2,"refill_gems":30,"refill_amount":60,"refills_per_day":3}'),
  ('limits', '{"speed_max":4,"tol":0.9,"battles_per_hour":90,"ops_per_call":100,"kills_mul":1.5,"open_hours":3}'),
  ('start', '{"gold":150,"gems":80}'),
  ('legacy_cap', '{"gold":60000,"gems":5000,"xp":27365}'),
  ('hold_attempts', '3')
on conflict (k) do nothing;

-- the seats before v5 (one row each; re-running adds only seats not seen yet — they were made before this file ran)
insert into econ_legacy (tg_id, seat, made)
  select p.tg_id, (s.ord - 1)::smallint, coalesce(s.a->>'made', '') || '/' || coalesce(s.a->>'house', '')
    from players p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.save->'slots') = 'array' then p.save->'slots' else '[]'::jsonb end) with ordinality as s(a, ord)
   where jsonb_typeof(s.a) = 'object' and s.ord <= 3
     and not exists (select 1 from wallets w where w.tg_id = p.tg_id and w.seat = s.ord - 1)
on conflict do nothing;

-- ---------- 2. small helpers ----------
create or replace function econ_cfg(key text) returns jsonb language sql stable set search_path = public as $$
  select v from econ_config where k = key $$;
create or replace function jbig(t text) returns bigint language sql immutable set search_path = '' as $$
  select case when t ~ '^-?[0-9]{1,18}$' then t::bigint end $$;
create or replace function ec_i(j jsonb, key text, dflt bigint default 0) returns bigint language sql immutable set search_path = public as $$
  select coalesce(jbig(j->>key), dflt) $$;
create or replace function ec_clamp(v bigint, lo bigint, hi bigint) returns bigint language sql immutable set search_path = '' as $$
  select least(greatest(coalesce(v, lo), lo), hi) $$;
-- account level from XP (the game: xpNeed(n) = 15 + 8n + n², level cap 40)
create or replace function xp_level(xp bigint) returns int language plpgsql immutable set search_path = '' as $$
declare l int := 1; x bigint := greatest(coalesce(xp, 0), 0);
begin
  while l < 40 and x >= 15 + 8 * l + l * l loop x := x - (15 + 8 * l + l * l); l := l + 1; end loop;
  return l;
end $$;
create or replace function ec_day() returns text language sql stable set search_path = '' as $$ select to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD') $$;
create or replace function ec_deal_window() returns bigint language sql stable set search_path = '' as $$ select floor(extract(epoch from now()) / 21600)::bigint $$;
create or replace function ec_lvl_tier(l int) returns text language sql immutable set search_path = '' as $$
  select case when l % 10 = 0 then 'dragon' when l % 5 = 0 then 'valyrian' when l < 8 then 'wood' else 'iron' end $$;
create or replace function ec_session(token uuid) returns bigint language plpgsql stable security definer set search_path = public as $$
declare id bigint;
begin
  select s.tg_id into id from sessions s where s.token = ec_session.token;
  if id is null then raise exception 'bad session'; end if;
  return id;
end $$;
-- the levels a save claims, in the server's key format
create or replace function ec_save_levels(a jsonb) returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select 'c:' || c.key as k, ec_clamp(ec_i(c.value, 'lvl', 1), 1, 20) as v
      from jsonb_each(case when jsonb_typeof(a->'champs') = 'object' then a->'champs' else '{}'::jsonb end) c where jsonb_typeof(c.value) = 'object'
    union all
    select 'sk:' || c.key || ':' || (x.ord - 1), ec_clamp(jint(x.v #>> '{}'), 1, 5)
      from jsonb_each(case when jsonb_typeof(a->'champs') = 'object' then a->'champs' else '{}'::jsonb end) c
      cross join lateral jsonb_array_elements(case when jsonb_typeof(c.value->'sk') = 'array' then c.value->'sk' else '[]'::jsonb end) with ordinality as x(v, ord)
     where x.ord <= 3
    union all
    select 't:' || t.key, ec_clamp(jint(t.value #>> '{}'), 1, 16) from jsonb_each(case when jsonb_typeof(a->'tlv') = 'object' then a->'tlv' else '{}'::jsonb end) t
    union all
    select 's:' || t.key, ec_clamp(jint(t.value #>> '{}'), 1, 10) from jsonb_each(case when jsonb_typeof(a->'slv') = 'object' then a->'slv' else '{}'::jsonb end) t
    union all
    select 'upg:' || u.key, 1 from jsonb_each(case when jsonb_typeof(a->'upg') = 'object' then a->'upg' else '{}'::jsonb end) u where coalesce(u.value #>> '{}', '0') not in ('0', 'false', 'null', '')
    union all
    select 'army', ec_clamp(ec_i(a->'army', 'lvl', 1), 1, 10) where jsonb_typeof(a->'army') = 'object'
    union all
    select 'hold_door', ec_clamp(ec_i(a->'online', 'doorBonus', 0), 0, 5000) where ec_i(a->'online', 'doorBonus', 0) > 0
    union all
    select 'hold_bank', ec_clamp(ec_i(a->'online', 'goldBonus', 0), 0, 5000) where ec_i(a->'online', 'goldBonus', 0) > 0
  ) q $$;

-- ---------- 3. the wallet: create (legacy import or fresh), energy, bookings ----------
create or replace function ec_wallet(pid bigint, st int) returns wallets
language plpgsql security definer set search_path = public as $$
declare w wallets; sv jsonb; a jsonb; ident text; lg econ_legacy; cap jsonb; ec jsonb; stt jsonb; cl jsonb; o jsonb; today text;
begin
  if st is null or st < 0 or st > 2 then raise exception 'bad seat'; end if;
  select p.save into sv from players p where p.tg_id = pid;
  a := sv -> 'slots' -> st;
  if jsonb_typeof(a) is distinct from 'object' then raise exception 'no seat'; end if;
  ident := coalesce(a->>'made', '') || '/' || coalesce(a->>'house', '');
  select * into w from wallets where tg_id = pid and seat = st for update;
  if found and w.made = ident then return w; end if;
  if found then   -- another seat now sits in this place
    delete from wallets where tg_id = pid and seat = st; delete from progress where tg_id = pid and seat = st;
  end if;
  ec := econ_cfg('energy'); stt := econ_cfg('start'); cap := econ_cfg('legacy_cap'); today := ec_day();
  select * into lg from econ_legacy where tg_id = pid and seat = st for update;
  if found and lg.used_at is null and lg.made = ident then
    -- a seat from before v5: its save's numbers are taken once, within sane limits
    o := coalesce(a->'online', '{}'::jsonb);
    cl := jsonb_build_object('legacy', true,
      'tut', coalesce((a->>'tutGift') in ('1', 'true'), false),
      'ach', coalesce((select jsonb_object_agg(k.key, 1) from jsonb_each(case when jsonb_typeof(a->'ach') = 'object' then a->'ach' else '{}'::jsonb end) k), '{}'::jsonb),
      'lvl_chests', ec_clamp(ec_i(a, 'lvlChests', 0), 0, 40), 'star_chests', ec_clamp(ec_i(a, 'starChests', 0), 0, 100),
      'free_chest_at', case when ec_i(a, 'freeChestAt', 0) > 0 then to_jsonb(to_timestamp(ec_i(a, 'freeChestAt', 0) / 1000.0)) end,
      'hold', jsonb_build_object('d', today, 'left', case when o->>'date' = today then ec_clamp(ec_i(o, 'attempts', 3), 0, 20) else econ_cfg('hold_attempts')::int end),
      'legacy_best', ec_clamp(ec_i(a->'stats', 'onlineBest', 0), 0, 500),
      'deals', case when jsonb_typeof(a->'deals') = 'object' and jint(a->'deals'->>'k') is not null
                    then jsonb_build_object(a->'deals'->>'k', jsonb_build_object('b', coalesce(a->'deals'->'bought', '[0,0,0,0,0,0]'::jsonb), 'u', coalesce(a->'deals'->'unl', '[1,1,1,0,0,0]'::jsonb)))
                    else '{}'::jsonb end);
    insert into wallets (tg_id, seat, made, gold, gems, energy, energy_at, xp, kills, levels, claims)
      values (pid, st, ident, ec_clamp(ec_i(a, 'gold', 0), 0, ec_i(cap, 'gold')), ec_clamp(ec_i(a, 'gems', 0), 0, ec_i(cap, 'gems')),
              ec_i(ec, 'max'), now(), ec_clamp(ec_i(a, 'axp', 0), 0, ec_i(cap, 'xp')), ec_clamp(ec_i(a->'stats', 'kills', 0), 0, 100000000),
              ec_save_levels(a), cl)
      returning * into w;
    insert into progress (tg_id, seat, mode, stage, stars)
      select pid, st, m.mode, jint(x.key)::int, ec_clamp(jint(x.value #>> '{}'), 1, 3)::smallint
        from (values ('c', a->'campaign'), ('h', a->'hard')) as m(mode, j)
        cross join lateral jsonb_each(case when jsonb_typeof(m.j) = 'object' then m.j else '{}'::jsonb end) x
       where jint(x.key) between 1 and 50 and coalesce(jint(x.value #>> '{}'), 0) >= 1
    on conflict do nothing;
    update econ_legacy set used_at = now() where tg_id = pid and seat = st;
    insert into ledger (tg_id, seat, cur, delta, bal, reason) values (pid, st, 'gold', w.gold, w.gold, 'legacy'), (pid, st, 'gems', w.gems, w.gems, 'legacy');
  else
    insert into wallets (tg_id, seat, made, gold, gems, energy, energy_at, claims)
      values (pid, st, ident, ec_i(stt, 'gold'), ec_i(stt, 'gems'), ec_i(ec, 'max'), now(),
              jsonb_build_object('hold', jsonb_build_object('d', today, 'left', econ_cfg('hold_attempts')::int)))
      returning * into w;
    insert into ledger (tg_id, seat, cur, delta, bal, reason) values (pid, st, 'gold', w.gold, w.gold, 'start'), (pid, st, 'gems', w.gems, w.gems, 'start');
  end if;
  return w;
end $$;

-- energy refills over time (never above max by itself; refills and level-ups may go over)
create or replace function ec_energy(inout w wallets) language plpgsql stable set search_path = public as $$
declare ec jsonb := econ_cfg('energy'); mx int; rg int; n int;
begin
  mx := ec_i(ec, 'max'); rg := greatest(ec_i(ec, 'regen_s'), 1);
  if w.energy >= mx then w.energy_at := now(); return; end if;
  n := floor(extract(epoch from now() - w.energy_at) / rg)::int;
  if n <= 0 then return; end if;
  if w.energy + n >= mx then w.energy := mx; w.energy_at := now();
  else w.energy := w.energy + n; w.energy_at := w.energy_at + make_interval(secs => n * rg); end if;
end $$;

-- one booking: the balance moves and the ledger remembers why (a negative result refuses the whole operation)
create or replace function ec_book(inout w wallets, cur text, delta bigint, reason text, ref text default null, op uuid default null, battle uuid default null)
language plpgsql security definer set search_path = public as $$
declare bal bigint; lv0 int;
begin
  if delta = 0 then return; end if;
  if cur = 'gold' then w.gold := w.gold + delta; bal := w.gold;
  elsif cur = 'gems' then w.gems := w.gems + delta; bal := w.gems;
  elsif cur = 'energy' then w.energy := w.energy + delta; bal := w.energy;
  elsif cur = 'xp' then lv0 := xp_level(w.xp); w.xp := w.xp + delta; bal := w.xp;
    -- a new account level refills energy
    if xp_level(w.xp) > lv0 then w.energy := greatest(w.energy, ec_i(econ_cfg('energy'), 'max')); end if;
  else raise exception 'bad currency %', cur; end if;
  if bal < 0 then raise exception 'not enough %', case cur when 'gems' then 'dragonglass' else cur end; end if;
  insert into ledger (tg_id, seat, cur, delta, bal, reason, ref, op_id, battle_id) values (w.tg_id, w.seat, cur, delta, bal, reason, ref, op, battle);
end $$;

create or replace function ec_save(w wallets) returns void language sql security definer set search_path = public as $$
  update wallets set gold = w.gold, gems = w.gems, energy = w.energy, energy_at = w.energy_at, xp = w.xp, kills = w.kills,
                     levels = w.levels, claims = w.claims, updated_at = now()
   where tg_id = w.tg_id and seat = w.seat $$;

create or replace function ec_flag(pid bigint, st int, kind text, detail jsonb) returns void language sql security definer set search_path = public as $$
  insert into econ_flags (tg_id, seat, kind, detail) values (pid, st, kind, detail) $$;

-- what the app shows
create or replace function ec_state(w wallets) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ec jsonb := econ_cfg('energy'); lv int; nst int; hold jsonb; today text := ec_day(); fc timestamptz; rf jsonb; dw bigint := ec_deal_window();
begin
  lv := xp_level(w.xp);
  select coalesce(sum(p.stars), 0) into nst from progress p where p.tg_id = w.tg_id and p.seat = w.seat;
  hold := coalesce(w.claims->'hold', '{}'::jsonb);
  if hold->>'d' is distinct from today then hold := jsonb_build_object('d', today, 'left', econ_cfg('hold_attempts')::int); end if;
  fc := (w.claims->>'free_chest_at')::timestamptz;
  rf := coalesce(w.claims->'refills', '{}'::jsonb);
  return jsonb_build_object(
    'gold', w.gold, 'gems', w.gems, 'xp', w.xp, 'level', lv, 'kills', w.kills,
    'energy', w.energy, 'energy_max', ec_i(ec, 'max'),
    'energy_next', case when w.energy >= ec_i(ec, 'max') then 0 else greatest(0, ceil(ec_i(ec, 'regen_s') - extract(epoch from now() - w.energy_at)))::int end,
    'refills_left', ec_i(ec, 'refills_per_day') - case when rf->>'d' = today then ec_i(rf, 'n') else 0 end,
    'levels', w.levels,
    'progress', jsonb_build_object(
       'c', coalesce((select jsonb_object_agg(p.stage::text, p.stars) from progress p where p.tg_id = w.tg_id and p.seat = w.seat and p.mode = 'c'), '{}'::jsonb),
       'h', coalesce((select jsonb_object_agg(p.stage::text, p.stars) from progress p where p.tg_id = w.tg_id and p.seat = w.seat and p.mode = 'h'), '{}'::jsonb)),
    'stars', nst,
    'lvl_chests', ec_i(w.claims, 'lvl_chests'), 'star_chests', ec_i(w.claims, 'star_chests'),
    'free_chest_in', case when fc is null then 0 else greatest(0, ceil(86400 - extract(epoch from now() - fc)))::int end,
    'hold_day', hold->>'d', 'hold_left', ec_i(hold, 'left'),
    'deal_window', dw, 'deals', coalesce(w.claims->'deals'->(dw::text), '{"b":[0,0,0,0,0,0],"u":[1,1,1,0,0,0]}'::jsonb),
    'tut', coalesce((w.claims->>'tut')::boolean, false), 'ach', coalesce(w.claims->'ach', '{}'::jsonb),
    'cfg', jsonb_build_object('energy', ec), 'at', now());
end $$;

-- ---------- 4. the app's calls ----------
create or replace function econ_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  perform ec_save(w);
  return ec_state(w);
end $$;

-- one operation from the app (inside econ_sync, each in its own savepoint)
create or replace function ec_op(inout w wallets, op jsonb) language plpgsql security definer set search_path = public as $$
declare r text := op->>'r'; k text := op->>'k'; id uuid := (op->>'id')::uuid; tlvl int; cur int; price bigint; mx int;
        t text; cid text; si int; g jsonb; pgold bigint; pgems bigint; dwin bigint; dk text; deal jsonb; i int; today text := ec_day(); hold jsonb; rf jsonb; tbl jsonb; ec jsonb;
begin
  if r = 'card' then                        -- a level for a champion (c:), tower (t:) or spell (s:) card
    t := split_part(k, ':', 1); tlvl := jint(op->>'to');
    if t not in ('c', 't', 's') or split_part(k, ':', 2) = '' then raise exception 'bad card'; end if;
    mx := ec_i(econ_cfg('max'), t); cur := ec_i(w.levels, k, 1);
    if tlvl is distinct from cur + 1 or tlvl > mx then raise exception 'card level % → % (max %)', cur, tlvl, mx; end if;
    price := jint(econ_cfg('card_gold')->t->>(cur - 1));
    if price is null then raise exception 'no price'; end if;
    w := ec_book(w, 'gold', -price, 'card', k || ':' || tlvl, id);
    w := ec_book(w, 'xp', round(price / 10.0)::bigint, 'card', k, id);
    w.levels := jsonb_set(w.levels, array[k], to_jsonb(tlvl));
  elsif r = 'sk' then                       -- a skill rank (key champ:index)
    cid := split_part(k, ':', 1); si := jint(split_part(k, ':', 2)); tlvl := jint(op->>'to');
    if cid = '' or si is null or si not between 0 and 2 then raise exception 'bad skill'; end if;
    cur := ec_i(w.levels, 'sk:' || k, 1);
    if tlvl is distinct from cur + 1 or tlvl > ec_i(econ_cfg('max'), 'sk') then raise exception 'skill rank % → %', cur, tlvl; end if;
    if cur >= (select count(*) from jsonb_array_elements_text(econ_cfg('sk_cap')) as c(v) where ec_i(w.levels, 'c:' || cid, 1) >= c.v::int) then
      raise exception 'champion level too low for rank %', tlvl; end if;
    price := jint(econ_cfg('sk_cost')->>(cur - 1));
    w := ec_book(w, 'gold', -price, 'sk', k || ':' || tlvl, id);
    w := ec_book(w, 'xp', round(price / 10.0)::bigint, 'sk', k, id);
    w.levels := jsonb_set(w.levels, array['sk:' || k], to_jsonb(tlvl));
  elsif r = 'upg' then                      -- an armory upgrade (once)
    price := jint(econ_cfg('upg')->>k);
    if price is null then raise exception 'bad upgrade'; end if;
    if ec_i(w.levels, 'upg:' || k) > 0 then raise exception 'already owned'; end if;
    w := ec_book(w, 'gold', -price, 'upg', k, id);
    w := ec_book(w, 'xp', round(price / 10.0)::bigint, 'upg', k, id);
    w.levels := jsonb_set(w.levels, array['upg:' || k], '1');
  elsif r = 'army' then                     -- a Train level
    cur := ec_i(w.levels, 'army', 1); tlvl := jint(op->>'to');
    if tlvl is distinct from cur + 1 or tlvl > ec_i(econ_cfg('max'), 'army') then raise exception 'army level % → %', cur, tlvl; end if;
    price := jint(econ_cfg('army_cost')->>(cur - 1));
    w := ec_book(w, 'gold', -price, 'army', tlvl::text, id);
    w := ec_book(w, 'xp', round(price / 10.0)::bigint, 'army', null, id);
    w.levels := jsonb_set(w.levels, '{army}', to_jsonb(tlvl));
  elsif r = 'pack' then                     -- a spell-shop item for the pack
    price := jint(econ_cfg('pack')->>k);
    if price is null then raise exception 'bad item'; end if;
    w := ec_book(w, 'gold', -price, 'pack', k, id);
  elsif r = 'xch' then                      -- dragonglass → gold at the shop's rates
    tbl := econ_cfg('exchange')->(jint(op->>'i'));
    if tbl is null then raise exception 'bad exchange'; end if;
    w := ec_book(w, 'gems', -jint(tbl->>0), 'xch', op->>'i', id);
    w := ec_book(w, 'gold', jint(tbl->>1), 'xch', op->>'i', id);
  elsif r = 'att' then                      -- one more Hold run today
    w := ec_book(w, 'gems', -40, 'att', null, id);
    hold := coalesce(w.claims->'hold', '{}'::jsonb);
    if hold->>'d' is distinct from today then hold := jsonb_build_object('d', today, 'left', econ_cfg('hold_attempts')::int); end if;
    w.claims := jsonb_set(w.claims, '{hold}', jsonb_build_object('d', today, 'left', ec_i(hold, 'left') + 1));
  elsif r = 'energy' then                   -- refill with dragonglass (a few times a day)
    ec := econ_cfg('energy'); rf := coalesce(w.claims->'refills', '{}'::jsonb);
    if rf->>'d' is distinct from today then rf := jsonb_build_object('d', today, 'n', 0); end if;
    if ec_i(rf, 'n') >= ec_i(ec, 'refills_per_day') then raise exception 'no refills left today'; end if;
    w := ec_book(w, 'gems', -ec_i(ec, 'refill_gems'), 'energy', null, id);
    w := ec_book(w, 'energy', ec_i(ec, 'refill_amount'), 'refill', null, id);
    w.claims := jsonb_set(w.claims, '{refills}', jsonb_build_object('d', today, 'n', ec_i(rf, 'n') + 1));
  elsif r = 'ach' then                      -- an achievement's dragonglass (once each)
    price := jint(econ_cfg('ach')->>k);
    if price is null then raise exception 'bad achievement'; end if;
    if coalesce(w.claims->'ach'->k, 'null'::jsonb) <> 'null'::jsonb then raise exception 'already claimed'; end if;
    w := ec_book(w, 'gems', price, 'ach', k, id);
    w.claims := jsonb_set(w.claims, '{ach}', coalesce(w.claims->'ach', '{}'::jsonb) || jsonb_build_object(k, 1));
  elsif r = 'tut' then                      -- the first battle's gift (once)
    if coalesce((w.claims->>'tut')::boolean, false) then raise exception 'already claimed'; end if;
    w := ec_book(w, 'gold', 100, 'tut', null, id);
    w := ec_book(w, 'gems', 20, 'tut', null, id);
    w.claims := jsonb_set(w.claims, '{tut}', 'true');
  elsif r = 'chestfill' then                -- a chest card slot with nothing to give becomes 100 gold
    update chests c set filled = c.filled + jint(op->>'n')
     where c.id = (op->>'k')::uuid and c.tg_id = w.tg_id and c.seat = w.seat and jint(op->>'n') between 1 and 4 and c.filled + jint(op->>'n') <= c.cards;
    if not found then raise exception 'bad chest fill'; end if;
    w := ec_book(w, 'gold', 100 * jint(op->>'n'), 'chestfill', op->>'k', id);
  elsif r in ('deal', 'dealunl') then       -- the shop's six deals every 6 hours
    dwin := jint(op->>'w'); i := jint(op->>'i');
    if dwin is null or abs(dwin - ec_deal_window()) > 1 then raise exception 'deal window gone'; end if;
    if i is null or i not between 0 and 5 then raise exception 'bad deal slot'; end if;
    dk := dwin::text;
    deal := coalesce(w.claims->'deals'->dk, '{"b":[0,0,0,0,0,0],"u":[1,1,1,0,0,0]}'::jsonb);
    if r = 'dealunl' then
      if jint(deal->'u'->>i) = 1 then raise exception 'already open'; end if;
      w := ec_book(w, 'gems', -jint(econ_cfg('deal_unlock')->>i), 'dealunl', dk || ':' || i, id);
      deal := jsonb_set(deal, array['u', i::text], '1');
    else
      if jint(deal->'u'->>i) is distinct from 1 then raise exception 'deal slot locked'; end if;
      if jint(deal->'b'->>i) = 1 then raise exception 'deal already bought'; end if;
      g := coalesce(op->'g', '{}'::jsonb);
      pgold := ec_i(op->'p', 'gold'); pgems := ec_i(op->'p', 'gems');
      if pgold < 0 or pgems < 0 or (pgold > 0 and pgems > 0) then raise exception 'bad price'; end if;
      if i = 0 and (pgold > 0 or pgems > 0) then raise exception 'slot 1 is free'; end if;
      if g->>'k' = 'gold' then
        if (i = 0 and not (ec_i(g, 'gold') between 100 and 200 and ec_i(g, 'gold') % 10 = 0))
           or (i > 0 and not (ec_i(g, 'gold') between 300 and 1400 and ec_i(g, 'gold') % 100 = 0 and pgems >= round(ec_i(g, 'gold') / 17.0) and pgold = 0)) then
          raise exception 'bad gold deal'; end if;
        w := ec_book(w, 'gold', ec_i(g, 'gold'), 'deal', dk || ':' || i, id);
      elsif g->>'k' = 'gems' then
        if (i = 0 and not ec_i(g, 'gems') between 4 and 9) or (i > 0 and not (ec_i(g, 'gems') between 12 and 24 and pgold = 28 * ec_i(g, 'gems'))) then
          raise exception 'bad dragonglass deal'; end if;
        w := ec_book(w, 'gems', ec_i(g, 'gems'), 'deal', dk || ':' || i, id);
      elsif g->>'k' = 'cards' then
        if not ec_i(g, 'cnt') between 1 and 16 or (i > 0 and pgold < 25 * ec_i(g, 'cnt')) then raise exception 'bad card deal'; end if;
      elsif g->>'k' = 'sk' then
        k := (g->>'c') || ':' || ec_i(g, 'i', -1); cur := ec_i(w.levels, 'sk:' || k, 1);
        if ec_i(g, 'i', -1) not between 0 and 2 or cur >= ec_i(econ_cfg('max'), 'sk')
           or cur >= (select count(*) from jsonb_array_elements_text(econ_cfg('sk_cap')) as c(v) where ec_i(w.levels, 'c:' || (g->>'c'), 1) >= c.v::int)
           or pgold <> round(jint(econ_cfg('sk_cost')->>(cur - 1)) * 0.6 / 10.0) * 10 then raise exception 'bad skill deal'; end if;
        w.levels := jsonb_set(w.levels, array['sk:' || k], to_jsonb(cur + 1));
      elsif g->>'k' = 'upg' then
        price := jint(econ_cfg('upg')->>(g->>'u'));
        if price is null or ec_i(w.levels, 'upg:' || (g->>'u')) > 0 or pgold <> round(price * 0.65 / 10.0) * 10 then raise exception 'bad upgrade deal'; end if;
        w.levels := jsonb_set(w.levels, array['upg:' || (g->>'u')], '1');
      elsif g->>'k' = 'att' then
        if pgems <> 25 then raise exception 'bad attempt deal'; end if;
        hold := coalesce(w.claims->'hold', '{}'::jsonb);
        if hold->>'d' is distinct from today then hold := jsonb_build_object('d', today, 'left', econ_cfg('hold_attempts')::int); end if;
        w.claims := jsonb_set(w.claims, '{hold}', jsonb_build_object('d', today, 'left', ec_i(hold, 'left') + 1));
      elsif g->>'k' = 'door' then
        if pgems <> 40 then raise exception 'bad gate deal'; end if;
        w.levels := jsonb_set(w.levels, '{hold_door}', to_jsonb(ec_i(w.levels, 'hold_door') + 100));
      elsif g->>'k' = 'bank' then
        if pgems <> 35 then raise exception 'bad bank deal'; end if;
        w.levels := jsonb_set(w.levels, '{hold_bank}', to_jsonb(ec_i(w.levels, 'hold_bank') + 60));
      else raise exception 'bad deal'; end if;
      if pgold > 0 then w := ec_book(w, 'gold', -pgold, 'dealbuy', dk || ':' || i, id); end if;
      if pgems > 0 then w := ec_book(w, 'gems', -pgems, 'dealbuy', dk || ':' || i, id); end if;
      deal := jsonb_set(deal, array['b', i::text], '1');
    end if;
    -- keep only the last three windows
    w.claims := jsonb_set(w.claims, '{deals}',
      coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(w.claims->'deals', '{}'::jsonb)) e where jint(e.key) >= ec_deal_window() - 2), '{}'::jsonb)
      || jsonb_build_object(dk, deal));
  else
    raise exception 'unknown operation %', r;
  end if;
end $$;

create or replace function econ_sync(token uuid, seat int, ops jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; w0 wallets; op jsonb; res jsonb := '[]'::jsonb; oid uuid; prev econ_ops; lim jsonb := econ_cfg('limits'); n int := 0;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  if jsonb_typeof(ops) is distinct from 'array' then raise exception 'bad ops'; end if;
  if jsonb_array_length(ops) > ec_i(lim, 'ops_per_call') then raise exception 'too many operations'; end if;
  for op in select * from jsonb_array_elements(ops) loop
    n := n + 1;
    begin oid := (op->>'id')::uuid; exception when others then oid := null; end;
    if oid is null then res := res || jsonb_build_object('id', op->>'id', 'ok', false, 'why', 'bad id'); continue; end if;
    select * into prev from econ_ops where op_id = oid;
    if found then res := res || jsonb_build_object('id', oid, 'ok', prev.ok, 'why', prev.why, 'dup', true); continue; end if;
    w0 := w;
    begin
      w := ec_op(w, op);
      insert into econ_ops (op_id, tg_id, seat, r, ok) values (oid, pid, econ_sync.seat, op->>'r', true);
      res := res || jsonb_build_object('id', oid, 'ok', true);
    exception when others then
      w := w0;
      insert into econ_ops (op_id, tg_id, seat, r, ok, why) values (oid, pid, econ_sync.seat, op->>'r', false, sqlerrm);
      perform ec_flag(pid, econ_sync.seat, 'op_refused', jsonb_build_object('op', op, 'why', sqlerrm));
      res := res || jsonb_build_object('id', oid, 'ok', false, 'why', sqlerrm);
    end;
  end loop;
  perform ec_save(w);
  return jsonb_build_object('results', res, 'state', ec_state(w));
end $$;

-- ---------- 5. battles ----------
create or replace function battle_start(token uuid, seat int, kind text, stage int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; ec jsonb := econ_cfg('energy'); lim jsonb := econ_cfg('limits'); cost int := 0; md char(1); hold jsonb; today text := ec_day(); bid uuid;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  if (select count(*) from battles b where b.tg_id = pid and b.started_at > now() - interval '1 hour') >= ec_i(lim, 'battles_per_hour') then
    raise exception 'too many battles — rest a while';
  end if;
  if kind in ('camp', 'hard') then
    if stage is null or not exists (select 1 from battle_limits l where l.kind = 'stage' and l.n = stage) then raise exception 'bad stage'; end if;
    md := case kind when 'hard' then 'h' else 'c' end;
    if kind = 'hard' and (select count(*) from progress p where p.tg_id = pid and p.seat = battle_start.seat and p.mode = 'c') < 50 then
      raise exception 'Hard opens after all 50 stages'; end if;
    if stage > 1 and not exists (select 1 from progress p where p.tg_id = pid and p.seat = battle_start.seat and p.mode = md and p.stage = battle_start.stage - 1) then
      raise exception 'stage % is locked', stage; end if;
    cost := jint((ec->'cost')->>(least((stage - 1) / greatest(ec_i(ec, 'per'), 1), jsonb_array_length(ec->'cost') - 1))::int)
            + case kind when 'hard' then ec_i(ec, 'hard_extra') else 0 end;
    if w.energy < cost then raise exception 'not enough energy'; end if;
    w := ec_book(w, 'energy', -cost, 'battle', kind || ':' || stage);
  elsif kind = 'hold' then
    hold := coalesce(w.claims->'hold', '{}'::jsonb);
    if hold->>'d' is distinct from today then hold := jsonb_build_object('d', today, 'left', econ_cfg('hold_attempts')::int); end if;
    if ec_i(hold, 'left') <= 0 then raise exception 'no Hold attempts left today'; end if;
    w.claims := jsonb_set(w.claims, '{hold}', jsonb_build_object('d', today, 'left', ec_i(hold, 'left') - 1));
  else
    raise exception 'bad kind';
  end if;
  update battles b set status = 'expired', finished_at = now() where b.tg_id = pid and b.seat = battle_start.seat and b.status = 'open';
  insert into battles (tg_id, seat, kind, stage, energy) values (pid, battle_start.seat, kind, stage, cost) returning id into bid;
  perform ec_save(w);
  return jsonb_build_object('battle', bid, 'state', ec_state(w));
end $$;

create or replace function battle_finish(token uuid, battle uuid, won boolean, stars int default 0, steps int default 0, waves int default 0, kills int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; b battles; w wallets; lim jsonb := econ_cfg('limits'); bl battle_limits; el double precision; vwhy text; md char(1); prev int;
        gold bigint := 0; gems bigint := 0; hard boolean; tail jsonb; need bigint; maxk bigint; a jsonb; nm text; hs text; rl int; d date; st int; vrank int;
begin
  pid := ec_session(token);
  select * into b from battles x where x.id = battle and x.tg_id = pid for update;
  if not found then raise exception 'no battle'; end if;
  if b.status <> 'open' then
    return jsonb_build_object('ok', b.status in ('won', 'lost', 'done'), 'dup', true, 'status', b.status, 'why', b.why, 'reward', b.reward);
  end if;
  st := b.seat;
  w := ec_wallet(pid, st);
  w := ec_energy(w);
  el := extract(epoch from now() - b.started_at);
  steps := greatest(coalesce(steps, 0), 0); kills := greatest(coalesce(kills, 0), 0); waves := greatest(coalesce(waves, 0), 0); stars := coalesce(stars, 0);
  if el > ec_i(lim, 'open_hours') * 3600 then vwhy := 'battle too old';
  elsif b.kind in ('camp', 'hard') then
    select * into bl from battle_limits l where l.kind = 'stage' and l.n = b.stage;
    if not found then vwhy := 'no limits for this stage';
    elsif won then
      if stars not between 1 and 3 then vwhy := 'bad stars';
      elsif steps < bl.min_steps then vwhy := format('faster than possible: %s steps < %s', steps, bl.min_steps);
      elsif el < steps / (60.0 * ec_i(lim, 'speed_max')) * (lim->>'tol')::numeric then vwhy := format('faster than real time: %ss for %s steps', round(el::numeric, 1), steps);
      elsif kills > bl.max_kills * (lim->>'kills_mul')::numeric then vwhy := format('more kills than enemies: %s', kills);
      end if;
    elsif kills > bl.max_kills * (lim->>'kills_mul')::numeric then vwhy := 'more kills than enemies';
    end if;
  else  -- hold
    if waves > 500 or kills > 100000 then vwhy := 'bad score';
    else
      select * into bl from battle_limits l where l.kind = 'hold' and l.n = waves;
      if found then need := bl.min_steps; maxk := bl.max_kills;
      else tail := econ_cfg('hold_tail');
        select * into bl from battle_limits l where l.kind = 'hold' and l.n = ec_i(tail, 'last');
        need := bl.min_steps + (waves - ec_i(tail, 'last')) * ec_i(tail, 'step_gap'); maxk := bl.max_kills + (waves - ec_i(tail, 'last') + 1) * ec_i(tail, 'kill_gap');
      end if;
      if need is null then vwhy := 'no limits for Hold';
      elsif steps < need then vwhy := format('faster than possible: %s steps < %s for %s waves', steps, need, waves);
      elsif el < steps / (60.0 * ec_i(lim, 'speed_max')) * (lim->>'tol')::numeric then vwhy := format('faster than real time: %ss for %s steps', round(el::numeric, 1), steps);
      elsif kills > maxk * (lim->>'kills_mul')::numeric + 10 then vwhy := format('more kills than enemies: %s', kills);
      end if;
    end if;
  end if;
  if vwhy is not null then
    update battles x set status = 'rejected', why = vwhy, finished_at = now(), steps = battle_finish.steps, stars = battle_finish.stars,
                         waves = battle_finish.waves, kills = battle_finish.kills where x.id = b.id;
    perform ec_flag(pid, st, 'battle_refused', jsonb_build_object('battle', b.id, 'kind', b.kind, 'stage', b.stage, 'why', vwhy, 'secs', round(el::numeric, 1), 'steps', steps, 'kills', kills, 'waves', waves));
    perform ec_save(w);
    return jsonb_build_object('ok', false, 'why', vwhy, 'state', ec_state(w));
  end if;
  if b.kind in ('camp', 'hard') and won then
    hard := b.kind = 'hard'; md := case when hard then 'h' else 'c' end;
    select p.stars into prev from progress p where p.tg_id = pid and p.seat = st and p.mode = md and p.stage = b.stage;
    prev := coalesce(prev, 0);
    gold := round((60 + 9 * b.stage + 15 * stars) * (case when stars > prev then 1 else 0.35 end) * (case when hard then 1.4 else 1 end));
    gems := greatest(0, stars - prev) * (case when hard then 12 else 8 end);
    insert into progress (tg_id, seat, mode, stage, stars) values (pid, st, md, b.stage, stars)
      on conflict (tg_id, seat, mode, stage) do update set stars = greatest(progress.stars, excluded.stars), at = case when excluded.stars > progress.stars then now() else progress.at end;
    w := ec_book(w, 'gold', gold, 'win', b.kind || ':' || b.stage, null, b.id);
    w := ec_book(w, 'gems', gems, 'win', b.kind || ':' || b.stage, null, b.id);
  elsif b.kind = 'hold' then
    gold := waves * 8 + floor(kills / 4.0); gems := 4 + floor(waves / 5.0);
    w := ec_book(w, 'gold', gold, 'hold', waves::text, null, b.id);
    w := ec_book(w, 'gems', gems, 'hold', waves::text, null, b.id);
    -- today's standings, like hold_result did
    select p.name, p.save into nm, a from players p where p.tg_id = pid;
    a := a->'slots'->st;
    hs := case when a->>'house' ~ '^[a-z]{2,16}$' then a->>'house' end;
    rl := case when jint(a->>'langI') between 0 and 192 then jint(a->>'langI') else 0 end;
    d := (now() at time zone 'utc')::date;
    insert into daily_scores (day, tg_id, seat, name, house, realm, waves, kills, runs)
      values (d, pid, st, coalesce(nm, ''), hs, rl, waves, kills, 1)
      on conflict on constraint daily_scores_pkey do update set
        name = excluded.name, house = excluded.house, realm = excluded.realm,
        waves = greatest(daily_scores.waves, excluded.waves), kills = greatest(daily_scores.kills, excluded.kills),
        runs = daily_scores.runs + 1, updated_at = now();
    select count(*) + 1 into vrank from daily_scores o where o.day = d and (o.waves > battle_finish.waves or (o.waves = battle_finish.waves and o.kills > battle_finish.kills));
  end if;
  w.kills := w.kills + kills;
  update battles x set status = case when b.kind = 'hold' then 'done' when won then 'won' else 'lost' end, finished_at = now(),
         steps = battle_finish.steps, stars = case when won then battle_finish.stars end, waves = battle_finish.waves, kills = battle_finish.kills,
         reward = jsonb_build_object('gold', gold, 'gems', gems)
   where x.id = b.id;
  perform ec_save(w);
  perform sync_seats(pid);
  return jsonb_build_object('ok', true, 'reward', jsonb_build_object('gold', gold, 'gems', gems), 'prev', prev, 'rank', vrank, 'state', ec_state(w));
end $$;

-- ---------- 6. chests: the source is checked, the gold and dragonglass are rolled here ----------
create or replace function chest_open(token uuid, seat int, tier text, source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; T jsonb := econ_cfg('chests')->tier; fc timestamptz; lv int; n int; stars int; g int; m int; cid uuid;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  if T is null then raise exception 'bad chest'; end if;
  if source = 'shop' then
    if tier = 'wood' then
      fc := (w.claims->>'free_chest_at')::timestamptz;
      if fc is not null and now() < fc + interval '24 hours' then raise exception 'the free chest is not ready'; end if;
      w.claims := jsonb_set(w.claims, '{free_chest_at}', to_jsonb(now()));
    else
      w := ec_book(w, 'gems', -ec_i(T, 'price'), 'chest', tier);
    end if;
  elsif source = 'level' then
    lv := xp_level(w.xp); n := ec_i(w.claims, 'lvl_chests');
    if lv - 1 - n <= 0 then raise exception 'no level chest waiting'; end if;
    if tier <> ec_lvl_tier(n + 2) then raise exception 'wrong level chest'; end if;
    w.claims := jsonb_set(w.claims, '{lvl_chests}', to_jsonb(n + 1));
  elsif source = 'star' then
    select coalesce(sum(p.stars), 0) into stars from progress p where p.tg_id = pid and p.seat = chest_open.seat;
    n := ec_i(w.claims, 'star_chests');
    if stars / 3 - n <= 0 then raise exception 'no star chest waiting'; end if;
    if tier <> 'iron' then raise exception 'wrong star chest'; end if;
    w.claims := jsonb_set(w.claims, '{star_chests}', to_jsonb(n + 1));
  else
    raise exception 'bad source';
  end if;
  g := jint(T->'gold'->>0) + floor(random() * (jint(T->'gold'->>1) - jint(T->'gold'->>0) + 1))::int;
  m := jint(T->'gems'->>0) + floor(random() * (jint(T->'gems'->>1) - jint(T->'gems'->>0) + 1))::int;
  insert into chests (tg_id, seat, tier, source, gold, gems, cards) values (pid, chest_open.seat, tier, source, g, m, ec_i(T, 'cards')) returning id into cid;
  w := ec_book(w, 'gold', g, 'chest', tier || ':' || source);
  w := ec_book(w, 'gems', m, 'chest', tier || ':' || source);
  perform ec_save(w);
  return jsonb_build_object('chest', cid, 'gold', g, 'gems', m, 'cards', ec_i(T, 'cards'), 'state', ec_state(w));
end $$;

-- ---------- 7. standings: a managed seat's row comes from the server's own records ----------
create or replace function sync_seats(pid bigint, at timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare sv jsonb; nm text; slots jsonb; i int; a jsonb; r record; best int; n int := 0; w wallets; ident text; sl jsonb; bad jsonb;
begin
  select p.save, p.name into sv, nm from players p where p.tg_id = pid;
  slots := sv -> 'slots';
  if jsonb_typeof(slots) is distinct from 'array' then return 0; end if;
  if jsonb_array_length(slots) >= 3 then
    delete from scores sc where sc.tg_id = pid and jsonb_typeof(slots -> sc.seat::int) is distinct from 'object';
    delete from wallets x where x.tg_id = pid and jsonb_typeof(slots -> x.seat::int) is distinct from 'object';
    delete from progress x where x.tg_id = pid and jsonb_typeof(slots -> x.seat::int) is distinct from 'object';
  end if;
  for i in 0 .. least(jsonb_array_length(slots), 3) - 1 loop
    a := slots -> i;
    continue when jsonb_typeof(a) is distinct from 'object';
    select * into r from seat_stats(a);
    ident := coalesce(a->>'made', '') || '/' || coalesce(a->>'house', '');
    select * into w from wallets x where x.tg_id = pid and x.seat = i;
    if found and w.made <> ident then   -- another seat now sits here: the old one's server records go
      delete from wallets x where x.tg_id = pid and x.seat = i; delete from progress x where x.tg_id = pid and x.seat = i; w := null;
    end if;
    if w.tg_id is not null then
      -- managed: stars and stages from progress, waves from the server's Hold records, kills from the wallet
      select coalesce(sum(p.stars), 0)::int, count(*) filter (where p.mode = 'c')::int into r.stars, r.gates from progress p where p.tg_id = pid and p.seat = i;
      select max(x.waves) into best from daily_scores x where x.tg_id = pid and x.seat = i and (r.made is null or x.day >= r.made - 1);
      r.waves := greatest(coalesce(best, 0), ec_i(w.claims, 'legacy_best'));
      r.kills := least(w.kills, 100000000)::int;
      -- a save claiming more than the server gave is noted (once a day per seat)
      sl := ec_save_levels(a);
      select coalesce(jsonb_object_agg(e.key, jsonb_build_array(e.value, coalesce(w.levels->e.key, '1'::jsonb))), '{}'::jsonb) into bad
        from jsonb_each(sl) e where jint(e.value #>> '{}') > coalesce(jint(w.levels->>e.key), case when e.key like 'upg:%' or e.key like 'hold_%' then 0 else 1 end);
      if bad <> '{}'::jsonb and not exists (select 1 from econ_flags f where f.tg_id = pid and f.seat = i and f.kind = 'save_levels' and f.at > now() - interval '1 day') then
        perform ec_flag(pid, i, 'save_levels', bad);
      end if;
    else
      select max(x.waves) into best from daily_scores x where x.tg_id = pid and x.seat = i and (r.made is null or x.day >= r.made - 1);
      r.waves := greatest(r.waves, coalesce(best, 0));
    end if;
    insert into scores as sc (tg_id, seat, name, house, realm, stars, gates, waves, kills, updated_at)
      values (pid, i::smallint, coalesce(nm, ''), r.house, r.realm, r.stars, r.gates, r.waves, r.kills, at)
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

-- the old Hold report: a managed seat reports through battle_finish only (an old app on another device gets an error)
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
  if exists (select 1 from wallets w where w.tg_id = id and w.seat = st) then raise exception 'update the app — this seat reports through battle_finish'; end if;
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
  insert into scores as sc (tg_id, seat, name, house, realm, waves, kills)
    values (id, st, coalesce(nm, ''), hs, rl, hold_result.waves, hold_result.kills)
    on conflict on constraint scores_pkey do update set
      waves = greatest(sc.waves, excluded.waves), updated_at = now();
  return jsonb_build_object('ok', true, 'day', d,
    'rank', (select count(*) + 1 from daily_scores o where o.day = d and (o.waves > hold_result.waves or (o.waves = hold_result.waves and o.kills > hold_result.kills))));
end $$;

-- ---------- 8. admin views (dashboard only) ----------
create or replace view v_econ_flags as
  select f.at, f.tg_id, p.name, f.seat, f.kind, f.detail from econ_flags f left join players p on p.tg_id = f.tg_id order by f.at desc;
create or replace view v_wallets as
  select w.tg_id, p.name, w.seat, w.gold, w.gems, w.energy, w.xp, xp_level(w.xp) as level, w.kills,
         (select count(*) from progress x where x.tg_id = w.tg_id and x.seat = w.seat) as stages,
         (select count(*) from econ_flags f where f.tg_id = w.tg_id) as flags, w.updated_at
    from wallets w join players p on p.tg_id = w.tg_id order by w.updated_at desc;
create or replace view v_battles as
  select b.started_at, b.tg_id, p.name, b.seat, b.kind, b.stage, b.status, b.why, b.stars, b.waves, b.kills, b.steps,
         round(extract(epoch from coalesce(b.finished_at, now()) - b.started_at)::numeric, 1) as secs, b.reward
    from battles b left join players p on p.tg_id = b.tg_id order by b.started_at desc;

-- ---------- 9. who may call what ----------
do $$ declare f text; begin
  foreach f in array array['econ_cfg(text)','jbig(text)','ec_i(jsonb,text,bigint)','ec_clamp(bigint,bigint,bigint)','xp_level(bigint)','ec_day()','ec_deal_window()',
                           'ec_lvl_tier(integer)','ec_session(uuid)','ec_save_levels(jsonb)','ec_wallet(bigint,integer)','ec_energy(wallets)',
                           'ec_book(wallets,text,bigint,text,text,uuid,uuid)','ec_save(wallets)','ec_flag(bigint,integer,text,jsonb)','ec_state(wallets)',
                           'ec_op(wallets,jsonb)','sync_seats(bigint,timestamptz)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on v_econ_flags, v_wallets, v_battles from anon, authenticated;
revoke all on function econ_state(uuid, int) from public;
revoke all on function econ_sync(uuid, int, jsonb) from public;
revoke all on function battle_start(uuid, int, text, int) from public;
revoke all on function battle_finish(uuid, uuid, boolean, int, int, int, int) from public;
revoke all on function chest_open(uuid, int, text, text) from public;
revoke all on function hold_result(uuid, date, int, int, int, text, int) from public;
grant execute on function econ_state(uuid, int) to anon, authenticated;
grant execute on function econ_sync(uuid, int, jsonb) to anon, authenticated;
grant execute on function battle_start(uuid, int, text, int) to anon, authenticated;
grant execute on function battle_finish(uuid, uuid, boolean, int, int, int, int) to anon, authenticated;
grant execute on function chest_open(uuid, int, text, text) to anon, authenticated;
grant execute on function hold_result(uuid, date, int, int, int, text, int) to anon, authenticated;

-- self-check: the seats that will bring their save once
select tg_id, seat, made, used_at from econ_legacy order by tg_id, seat;
