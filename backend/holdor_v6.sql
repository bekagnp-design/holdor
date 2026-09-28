-- ============================================================
--  HOLDOR backend v6 (2026-09-28) — gear and the forge (game v1.0.57)
--  Run AFTER holdor_v5.sql + holdor_econ_data.sql. Safe to re-run.
--  Every roll is made here: whether an item drops, its rarity, slot, set, main stat, substats, and every upgrade.
--  The app only asks. Drops come from triggers (a battle closed as won / a Hold run of 10+ waves, a chest opened),
--  so battle_finish and chest_open of v5 stay as they are.
--  9 slots · Common 70 · Uncommon 22 · Rare 6.5 · Epic 1.4 · Legendary 0.1 (%) · +1…+16 with a chance, a failed
--  try keeps the item and loses the gold · 1–4 substats, one grows (or a new one appears) at +4/+8/+12/+16 · 4 sets.
-- ============================================================

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  slot text not null, rar smallint not null check (rar between 0 and 4), set_k text not null,
  main_k text not null, subs jsonb not null default '[]'::jsonb,     -- [{"k":"hp","v":3}, …]
  lvl smallint not null default 0 check (lvl between 0 and 16),
  champ text,                                                        -- the champion wearing it (null = in the bag)
  src text not null, created_at timestamptz not null default now());
create index if not exists items_seat_idx on items (tg_id, seat);
alter table items enable row level security;
revoke all on items from anon, authenticated;

insert into econ_config (k, v) values ('gear', '{
  "slots":["weapon","offhand","helmet","armor","gloves","boots","ring","amulet","banner"],
  "main":{"weapon":["dmg"],"offhand":["hp"],"helmet":["hp"],"armor":["hp"],"gloves":["rate"],"boots":["spd"],"ring":["dmg","rate","cdr"],"amulet":["hp","cdr","gold"],"banner":["range","cdr","gold"]},
  "main_base":{"dmg":3,"hp":4,"rate":2,"spd":4,"cdr":2,"gold":4,"range":3},
  "rar_mul":[1,1.5,2.1,2.8,3.6], "lvl_mul":0.1,
  "sub":{"dmg":[1,3],"hp":[1,3],"rate":[1,2],"spd":[2,4],"cdr":[1,2],"gold":[2,4],"range":[1,3]},
  "subs_n":[1,2,3,4,4],
  "rar_p":[70,22,6.5,1.4,0.1],
  "sets":{"wolf":{"2":{"hp":8},"4":{"dmg":12}},"lion":{"2":{"gold":10},"4":{"rate":10}},"dragon":{"2":{"dmg":8},"4":{"cdr":10}},"kraken":{"2":{"spd":10},"4":{"range":8}}},
  "chance":[100,95,90,85,80,70,60,50,45,40,35,30,25,20,15,10],
  "cost_base":50, "cost_step":30, "rar_cost":[1,1.5,2.2,3.2,4.5],
  "sell":20, "cap":200,
  "drop":{"win":25,"hard":35,"hold_waves":10,"chest":{"wood":20,"iron":50,"valyrian":100,"dragon":100},"chest_min":{"valyrian":1,"dragon":2}}
}'::jsonb) on conflict (k) do nothing;

-- a new item for a seat (min_r: the least rarity it may have). null when the bag is full.
create or replace function ge_new(pid bigint, st int, min_r int, src text) returns items
language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear'); it items; x double precision; r int := 0; acc double precision := 0; slot text; mk text; sk text; ks text[]; n int; subs jsonb := '[]'::jsonb; i int;
begin
  if (select count(*) from items where tg_id = pid and seat = st) >= ec_i(g, 'cap') then return null; end if;
  x := random() * 100;
  for i in reverse 4 .. 0 loop    -- from Legendary down: the rarest band sits at the top of the roll
    acc := acc + (g->'rar_p'->>i)::numeric;
    if x >= 100 - acc then r := i; exit; end if;
  end loop;
  r := greatest(r, coalesce(min_r, 0));
  slot := g->'slots'->>floor(random() * jsonb_array_length(g->'slots'))::int;
  mk := g->'main'->slot->>floor(random() * jsonb_array_length(g->'main'->slot))::int;
  select array_agg(k order by random()) into ks from jsonb_object_keys(g->'sub') k where k <> mk;
  n := (g->'subs_n'->>r)::int;
  for i in 1 .. n loop
    sk := ks[i];
    subs := subs || jsonb_build_array(jsonb_build_object('k', sk, 'v',
      (g->'sub'->sk->>0)::int + floor(random() * ((g->'sub'->sk->>1)::int - (g->'sub'->sk->>0)::int + 1))::int));
  end loop;
  insert into items (tg_id, seat, slot, rar, set_k, main_k, subs, src)
    values (pid, st, slot, r, (select k from jsonb_object_keys(g->'sets') k order by random() limit 1), mk, subs, src)
    returning * into it;
  return it;
end $$;

-- one item as the app shows it (the main stat's value follows rarity and level)
create or replace function ge_json(it items) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', it.id, 'slot', it.slot, 'r', it.rar, 'set', it.set_k, 'lvl', it.lvl, 'champ', it.champ, 'src', it.src,
    'main', jsonb_build_object('k', it.main_k, 'v', round(((econ_cfg('gear')->'main_base'->>it.main_k)::numeric * (econ_cfg('gear')->'rar_mul'->>it.rar)::numeric
                                                  * (1 + (econ_cfg('gear')->>'lvl_mul')::numeric * it.lvl))::numeric, 1)),
    'subs', it.subs, 'at', it.created_at) $$;

create or replace function ge_cost(it items) returns int language sql stable set search_path = public as $$
  select (round((ec_i(econ_cfg('gear'), 'cost_base') + ec_i(econ_cfg('gear'), 'cost_step') * it.lvl) * (econ_cfg('gear')->'rar_cost'->>it.rar)::numeric / 10) * 10)::int $$;

create or replace function ge_state(pid bigint, st int) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('items', coalesce((select jsonb_agg(ge_json(i) order by i.created_at) from items i where i.tg_id = pid and i.seat = st), '[]'::jsonb),
                            'cfg', econ_cfg('gear')) $$;

-- drops: a battle closed as won (campaign/Hard), a Hold run of hold_waves+ waves, a chest
create or replace function ge_battle_drop() returns trigger language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear'); p int;
begin
  if old.status <> 'open' then return new; end if;
  if new.status = 'won' then
    p := ec_i(g->'drop', case when new.kind = 'hard' then 'hard' else 'win' end);
    if random() * 100 < p then perform ge_new(new.tg_id, new.seat, 0, new.kind || ':' || new.stage); end if;
  elsif new.status = 'done' and new.kind = 'hold' and coalesce(new.waves, 0) >= ec_i(g->'drop', 'hold_waves') then
    perform ge_new(new.tg_id, new.seat, case when new.waves >= 30 then 1 else 0 end, 'hold:' || new.waves);
  end if;
  return new;
end $$;
drop trigger if exists battles_gear_drop on battles;
create trigger battles_gear_drop after update of status on battles for each row execute function ge_battle_drop();

create or replace function ge_chest_drop() returns trigger language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear');
begin
  if random() * 100 < ec_i(g->'drop'->'chest', new.tier) then
    perform ge_new(new.tg_id, new.seat, ec_i(g->'drop'->'chest_min', new.tier)::int, 'chest:' || new.tier);
  end if;
  return new;
end $$;
drop trigger if exists chests_gear_drop on chests;
create trigger chests_gear_drop after insert on chests for each row execute function ge_chest_drop();

-- ---------- the app's calls ----------
create or replace function gear_list(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  pid := ec_session(token);
  perform ec_wallet(pid, seat);
  return ge_state(pid, seat);
end $$;

-- one try at +1: the gold is paid either way; op = the app's uuid for this try (a resend does not try twice)
create or replace function gear_upgrade(token uuid, seat int, item uuid, op uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; it items; g jsonb := econ_cfg('gear'); cost int; ok boolean; prev econ_ops; subs jsonb; ks text[]; sk text; j int;
begin
  pid := ec_session(token);
  if op is null then raise exception 'bad id'; end if;
  select * into prev from econ_ops where op_id = op;
  if found then
    select * into it from items x where x.id = item and x.tg_id = pid;
    return jsonb_build_object('ok', prev.ok, 'dup', true, 'item', case when it.id is not null then ge_json(it) end, 'state', ec_state(ec_wallet(pid, seat)));
  end if;
  w := ec_wallet(pid, seat); w := ec_energy(w);
  select * into it from items x where x.id = item and x.tg_id = pid and x.seat = gear_upgrade.seat for update;
  if not found then raise exception 'no such item'; end if;
  if it.lvl >= 16 then raise exception 'already +16'; end if;
  cost := ge_cost(it);
  w := ec_book(w, 'gold', -cost, 'forge', it.id::text || ':' || (it.lvl + 1), op);
  w := ec_book(w, 'xp', round(cost / 10.0)::bigint, 'forge', null, op);
  ok := random() * 100 < (g->'chance'->>it.lvl)::numeric;
  if ok then
    it.lvl := it.lvl + 1;
    if it.lvl % 4 = 0 then   -- +4/+8/+12/+16: a new substat while there are fewer than 4, else one grows
      subs := it.subs;
      if jsonb_array_length(subs) < 4 then
        select array_agg(k order by random()) into ks from jsonb_object_keys(g->'sub') k
         where k <> it.main_k and not exists (select 1 from jsonb_array_elements(subs) e where e->>'k' = k);
        sk := ks[1];
        subs := subs || jsonb_build_array(jsonb_build_object('k', sk, 'v', (g->'sub'->sk->>0)::int + floor(random() * ((g->'sub'->sk->>1)::int - (g->'sub'->sk->>0)::int + 1))::int));
      else
        j := floor(random() * 4)::int; sk := subs->j->>'k';
        subs := jsonb_set(subs, array[j::text, 'v'], to_jsonb((subs->j->>'v')::int + (g->'sub'->sk->>0)::int + floor(random() * ((g->'sub'->sk->>1)::int - (g->'sub'->sk->>0)::int + 1))::int));
      end if;
      it.subs := subs;
    end if;
    update items set lvl = it.lvl, subs = it.subs where id = it.id;
  end if;
  insert into econ_ops (op_id, tg_id, seat, r, ok, why) values (op, pid, gear_upgrade.seat, 'forge', ok, case when ok then null else 'the forge failed' end);
  perform ec_save(w);
  return jsonb_build_object('ok', ok, 'cost', cost, 'item', ge_json(it), 'state', ec_state(w));
end $$;

-- put an item on a champion (champ null = back to the bag); the slot's other item on that champion goes back to the bag
create or replace function gear_equip(token uuid, seat int, item uuid, champ text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; it items;
begin
  pid := ec_session(token);
  perform ec_wallet(pid, seat);
  if champ is not null and champ !~ '^[a-z0-9_]{2,24}$' then raise exception 'bad champion'; end if;
  select * into it from items x where x.id = item and x.tg_id = pid and x.seat = gear_equip.seat for update;
  if not found then raise exception 'no such item'; end if;
  if champ is not null then
    update items x set champ = null where x.tg_id = pid and x.seat = gear_equip.seat and x.champ = gear_equip.champ and x.slot = it.slot and x.id <> it.id;
  end if;
  update items x set champ = gear_equip.champ where x.id = it.id;
  return ge_state(pid, seat);
end $$;

create or replace function gear_sell(token uuid, seat int, item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; it items; g jsonb := econ_cfg('gear'); gold int;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  delete from items x where x.id = item and x.tg_id = pid and x.seat = gear_sell.seat returning * into it;
  if not found then raise exception 'no such item'; end if;
  gold := round(ec_i(g, 'sell') * (g->'rar_cost'->>it.rar)::numeric * (1 + it.lvl))::int;
  w := ec_book(w, 'gold', gold, 'sell', it.id::text);
  perform ec_save(w);
  return jsonb_build_object('gold', gold, 'state', ec_state(w)) || ge_state(pid, seat);
end $$;

-- a seat replaced or deleted takes its items with it (like its wallet)
create or replace function ge_wallet_gone() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from items where tg_id = old.tg_id and seat = old.seat;
  return old;
end $$;
drop trigger if exists wallets_gear_gone on wallets;
create trigger wallets_gear_gone after delete on wallets for each row execute function ge_wallet_gone();

create or replace view v_items as
  select i.created_at, i.tg_id, p.name, i.seat, i.slot, i.rar, i.set_k, i.main_k, i.lvl, i.champ, i.src from items i left join players p on p.tg_id = i.tg_id order by i.created_at desc;
revoke all on v_items from anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['ge_new(bigint,integer,integer,text)','ge_json(items)','ge_cost(items)','ge_state(bigint,integer)','ge_battle_drop()','ge_chest_drop()','ge_wallet_gone()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on function gear_list(uuid, int) from public;
revoke all on function gear_upgrade(uuid, int, uuid, uuid) from public;
revoke all on function gear_equip(uuid, int, uuid, text) from public;
revoke all on function gear_sell(uuid, int, uuid) from public;
grant execute on function gear_list(uuid, int) to anon, authenticated;
grant execute on function gear_upgrade(uuid, int, uuid, uuid) to anon, authenticated;
grant execute on function gear_equip(uuid, int, uuid, text) to anon, authenticated;
grant execute on function gear_sell(uuid, int, uuid) to anon, authenticated;
