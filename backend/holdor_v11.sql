-- ============================================================
--  HOLDOR backend v11 (2026-09-30) — gear II: tiers, twelve sets, four new stats, gear in gifts (game v1.0.62)
--  Run AFTER holdor_v10.sql. Safe to re-run (the gear config is replaced by this file's version).
--  * Item tiers ★1–5: a tier sets the level cap (+4 per tier: ★1 = +4 … ★5 = +20) and multiplies the main stat. A tier is raised at the
--    cap for gold and by burning another item of the same rarity (tier equal or higher). Items that were already forged keep their level:
--    their tier is set to what that level needs.
--  * Twelve sets: four quads (2 + 4 pieces, as before), four pairs and four triples (a pair / triple bonus repeats for every full group worn),
--    plus two collection bonuses: one item of each rarity worn (Rainbow), all nine slots filled (Full kit).
--  * Four new stats: armor (damage taken −%), lifesteal (% of damage dealt healed), regen (% of max health per 10 s), crit (% chance of a double blow).
--  * Gear drops more often, and comes in gifts: chests roll a second item, and the login calendar / quest rewards can carry an item
--    (reward key 'gear': {n, min_r, min_tier}). Where a drop's tier comes from: econ_config gear.tier_p.
-- ============================================================
alter table items add column if not exists tier smallint not null default 1;
alter table items drop constraint if exists items_lvl_check;
alter table items add constraint items_lvl_check check (lvl between 0 and 20);
alter table items drop constraint if exists items_tier_check;
alter table items add constraint items_tier_check check (tier between 1 and 5);
update items set tier = least(5, greatest(tier, ceil(lvl / 4.0)::int)) where lvl > tier * 4;

insert into econ_config (k, v) values ('gear', '{
  "ver":2,
  "slots":["weapon","offhand","helmet","armor","gloves","boots","ring","amulet","banner"],
  "main":{"weapon":["dmg","crit"],"offhand":["hp","armor"],"helmet":["hp","regen"],"armor":["armor","hp"],"gloves":["rate","crit"],"boots":["spd"],
          "ring":["dmg","rate","cdr","lifesteal"],"amulet":["hp","cdr","gold","lifesteal"],"banner":["range","cdr","gold","regen"]},
  "main_base":{"dmg":3,"hp":4,"rate":2,"spd":4,"cdr":2,"gold":4,"range":3,"armor":3,"lifesteal":1.5,"regen":1,"crit":2},
  "rar_mul":[1,1.5,2.1,2.8,3.6], "tier_mul":[1,1.15,1.35,1.6,1.9], "lvl_mul":0.1,
  "sub":{"dmg":[1,3],"hp":[1,3],"rate":[1,2],"spd":[2,4],"cdr":[1,2],"gold":[2,4],"range":[1,3],"armor":[1,3],"lifesteal":[1,2],"regen":[1,2],"crit":[1,3]},
  "caps":{"armor":60,"lifesteal":40,"regen":30,"crit":60},
  "subs_n":[1,2,3,4,4],
  "rar_p":[70,22,6.5,1.4,0.1],
  "sets":{
    "wolf":{"2":{"hp":8},"4":{"dmg":12}}, "lion":{"2":{"gold":10},"4":{"rate":10}}, "dragon":{"2":{"dmg":8},"4":{"cdr":10}}, "kraken":{"2":{"spd":10},"4":{"range":8}},
    "stag":{"2":{"hp":10},"stack":1}, "rose":{"2":{"regen":3},"stack":1}, "sun":{"2":{"crit":6},"stack":1}, "anvil":{"2":{"armor":6},"stack":1},
    "wall":{"3":{"armor":14,"hp":6},"stack":1}, "blood":{"3":{"lifesteal":8},"stack":1}, "raven":{"3":{"cdr":12,"spd":6},"stack":1}, "hunt":{"3":{"crit":10,"dmg":6},"stack":1}},
  "bonus_all":{"rainbow":{"dmg":6,"hp":6,"armor":5},"full":{"dmg":4,"hp":4,"regen":2,"armor":3}},
  "chance":[100,95,90,85,80,70,60,50,45,40,35,30,25,20,15,10,8,6,5,4],
  "cost_base":50, "cost_step":30, "rar_cost":[1,1.5,2.2,3.2,4.5], "tier_cost":[1500,5000,14000,36000],
  "sell":20, "cap":300,
  "drop":{"win":40,"hard":55,"hold_waves":10,"chest":{"wood":45,"iron":80,"valyrian":100,"dragon":100},"chest_min":{"valyrian":1,"dragon":2},"chest_extra":{"valyrian":40,"dragon":100}},
  "tier_p":{"win":[85,15,0,0,0],"hard":[50,40,10,0,0],"hold":[40,40,20,0,0],"wood":[90,10,0,0,0],"iron":[60,35,5,0,0],"valyrian":[25,45,25,5,0],"dragon":[5,25,45,20,5],"gift":[50,35,15,0,0]}
}'::jsonb) on conflict (k) do update set v = excluded.v;

-- a new item (tier_key: which row of gear.tier_p rolls its tier; min_tier: the least tier it may have). null when the bag is full.
create or replace function ge_new2(pid bigint, st int, min_r int, src text, tier_key text, min_tier int) returns items
language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear'); it items; x double precision; r int := 0; t int := 1; acc double precision := 0; slot text; mk text; sk text; ks text[]; n int; subs jsonb := '[]'::jsonb; i int; tp jsonb;
begin
  if (select count(*) from items where tg_id = pid and seat = st) >= ec_i(g, 'cap') then return null; end if;
  x := random() * 100;
  for i in reverse 4 .. 0 loop    -- from Legendary down: the rarest band sits at the top of the roll
    acc := acc + (g->'rar_p'->>i)::numeric;
    if x >= 100 - acc then r := i; exit; end if;
  end loop;
  r := greatest(r, coalesce(min_r, 0));
  tp := coalesce(g->'tier_p'->tier_key, g->'tier_p'->'win'); x := random() * 100; acc := 0;
  for i in 0 .. 4 loop
    acc := acc + (tp->>i)::numeric;
    if x < acc then t := i + 1; exit; end if;
  end loop;
  t := least(5, greatest(t, coalesce(min_tier, 1)));
  slot := g->'slots'->>floor(random() * jsonb_array_length(g->'slots'))::int;
  mk := g->'main'->slot->>floor(random() * jsonb_array_length(g->'main'->slot))::int;
  select array_agg(k order by random()) into ks from jsonb_object_keys(g->'sub') k where k <> mk;
  n := (g->'subs_n'->>r)::int;
  for i in 1 .. n loop
    sk := ks[i];
    subs := subs || jsonb_build_array(jsonb_build_object('k', sk, 'v',
      (g->'sub'->sk->>0)::int + floor(random() * ((g->'sub'->sk->>1)::int - (g->'sub'->sk->>0)::int + 1))::int));
  end loop;
  insert into items (tg_id, seat, slot, rar, tier, set_k, main_k, subs, src)
    values (pid, st, slot, r, t, (select k from jsonb_object_keys(g->'sets') k order by random() limit 1), mk, subs, src)
    returning * into it;
  return it;
end $$;
create or replace function ge_new(pid bigint, st int, min_r int, src text) returns items
language plpgsql security definer set search_path = public as $$
begin return ge_new2(pid, st, min_r, src, 'win', 1); end $$;

create or replace function ge_json(it items) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', it.id, 'slot', it.slot, 'r', it.rar, 'tier', it.tier, 'cap', it.tier * 4, 'set', it.set_k, 'lvl', it.lvl, 'champ', it.champ, 'src', it.src,
    'main', jsonb_build_object('k', it.main_k, 'v', round(((econ_cfg('gear')->'main_base'->>it.main_k)::numeric * (econ_cfg('gear')->'rar_mul'->>it.rar)::numeric
                                                  * (econ_cfg('gear')->'tier_mul'->>(it.tier - 1))::numeric * (1 + (econ_cfg('gear')->>'lvl_mul')::numeric * it.lvl))::numeric, 1)),
    'subs', it.subs, 'at', it.created_at) $$;

-- drops: a battle closed as won (campaign/Hard), a Hold run of hold_waves+ waves, a chest (a second item sometimes, always in the best chests)
create or replace function ge_battle_drop() returns trigger language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear'); p int;
begin
  if old.status <> 'open' then return new; end if;
  if new.status = 'won' then
    p := ec_i(g->'drop', case when new.kind = 'hard' then 'hard' else 'win' end);
    if random() * 100 < p then perform ge_new2(new.tg_id, new.seat, 0, new.kind || ':' || new.stage, case when new.kind = 'hard' then 'hard' else 'win' end, 1); end if;
  elsif new.status = 'done' and new.kind = 'hold' and coalesce(new.waves, 0) >= ec_i(g->'drop', 'hold_waves') then
    perform ge_new2(new.tg_id, new.seat, case when new.waves >= 30 then 1 else 0 end, 'hold:' || new.waves, 'hold', 1);
  end if;
  return new;
end $$;
create or replace function ge_chest_drop() returns trigger language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear');
begin
  if random() * 100 < ec_i(g->'drop'->'chest', new.tier) then
    perform ge_new2(new.tg_id, new.seat, ec_i(g->'drop'->'chest_min', new.tier)::int, 'chest:' || new.tier, new.tier, 1);
    if random() * 100 < ec_i(g->'drop'->'chest_extra', new.tier) then perform ge_new2(new.tg_id, new.seat, 0, 'chest:' || new.tier, new.tier, 1); end if;
  end if;
  return new;
end $$;

-- one try at +1 (the cap is four levels a tier); the gold is paid either way; op = the app's uuid for this try
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
  if it.lvl >= it.tier * 4 then raise exception 'at the tier cap +%: raise the tier first', it.tier * 4; end if;
  cost := ge_cost(it);
  w := ec_book(w, 'gold', -cost, 'forge', it.id::text || ':' || (it.lvl + 1), op);
  w := ec_book(w, 'xp', round(cost / 10.0)::bigint, 'forge', null, op);
  ok := random() * 100 < (g->'chance'->>it.lvl)::numeric;
  if ok then
    it.lvl := it.lvl + 1;
    if it.lvl % 4 = 0 then
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

-- raise a tier: the item is at its cap, gold, and another item of the same rarity (tier equal or higher) is burnt
create or replace function gear_tier_up(token uuid, seat int, item uuid, fodder uuid, op uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; it items; fo items; g jsonb := econ_cfg('gear'); cost int; prev econ_ops;
begin
  pid := ec_session(token);
  if op is null then raise exception 'bad id'; end if;
  select * into prev from econ_ops where op_id = op;
  if found then
    select * into it from items x where x.id = item and x.tg_id = pid;
    return jsonb_build_object('ok', prev.ok, 'dup', true, 'item', case when it.id is not null then ge_json(it) end, 'state', ec_state(ec_wallet(pid, seat))) || ge_state(pid, seat);
  end if;
  w := ec_wallet(pid, seat); w := ec_energy(w);
  if item = fodder then raise exception 'an item cannot burn itself'; end if;
  select * into it from items x where x.id = item and x.tg_id = pid and x.seat = gear_tier_up.seat for update;
  if not found then raise exception 'no such item'; end if;
  select * into fo from items x where x.id = fodder and x.tg_id = pid and x.seat = gear_tier_up.seat for update;
  if not found then raise exception 'no such item to burn'; end if;
  if it.tier >= 5 then raise exception 'already tier 5'; end if;
  if it.lvl < it.tier * 4 then raise exception 'forge it to +% first', it.tier * 4; end if;
  if fo.rar <> it.rar then raise exception 'the item to burn must have the same rarity'; end if;
  if fo.tier < it.tier then raise exception 'the item to burn needs tier % or higher', it.tier; end if;
  cost := (round((g->'tier_cost'->>(it.tier - 1))::numeric * (g->'rar_cost'->>it.rar)::numeric / 10) * 10)::int;
  w := ec_book(w, 'gold', -cost, 'forge_tier', it.id::text || ':' || (it.tier + 1), op);
  w := ec_book(w, 'xp', round(cost / 10.0)::bigint, 'forge_tier', null, op);
  delete from items x where x.id = fo.id;
  update items x set tier = it.tier + 1 where x.id = it.id returning * into it;
  insert into econ_ops (op_id, tg_id, seat, r, ok) values (op, pid, gear_tier_up.seat, 'forge_tier', true);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'cost', cost, 'item', ge_json(it), 'state', ec_state(w)) || ge_state(pid, seat);
end $$;

-- gifts can carry an item: reward key 'gear' = {n, min_r, min_tier} (the calendar and the quests pay through this)
create or replace function qs_pay(inout w wallets, r jsonb, reason text, ref text) language plpgsql security definer set search_path = public as $$
declare b record; gi jsonb := r->'gear'; i int; it items;
begin
  if ec_i(r, 'gold') > 0 then w := ec_book(w, 'gold', ec_i(r, 'gold'), reason, ref); end if;
  if ec_i(r, 'gems') > 0 then w := ec_book(w, 'gems', ec_i(r, 'gems'), reason, ref); end if;
  for b in select e.key as k, jint(e.value #>> '{}') as n from jsonb_each(coalesce(r->'books', '{}'::jsonb)) e loop
    if split_part(b.k, ':', 1) = 'b' and b.n > 0 then w := ec_cards(w, b.k, b.n::int); end if;
  end loop;
  if gi is not null then
    for i in 1 .. greatest(1, least(3, coalesce(ec_i(gi, 'n', 1), 1)))::int loop
      it := ge_new2(w.tg_id, w.seat, ec_i(gi, 'min_r')::int, reason || ':' || ref, 'gift', greatest(1, ec_i(gi, 'min_tier', 1))::int);
    end loop;
  end if;
end $$;

-- selling: a higher tier is worth more (+50% of the base per tier above the first)
create or replace function gear_sell(token uuid, seat int, item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; it items; g jsonb := econ_cfg('gear'); gold int;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  delete from items x where x.id = item and x.tg_id = pid and x.seat = gear_sell.seat returning * into it;
  if not found then raise exception 'no such item'; end if;
  gold := round(ec_i(g, 'sell') * (g->'rar_cost'->>it.rar)::numeric * (1 + it.lvl) * (1 + 0.5 * (it.tier - 1)))::int;
  w := ec_book(w, 'gold', gold, 'sell', it.id::text);
  perform ec_save(w);
  return jsonb_build_object('gold', gold, 'state', ec_state(w)) || ge_state(pid, seat);
end $$;

create or replace view v_items as
  select i.created_at, i.tg_id, p.name, i.seat, i.slot, i.rar, i.set_k, i.main_k, i.lvl, i.champ, i.src, i.tier
    from items i left join players p on p.tg_id = i.tg_id order by i.created_at desc;
revoke all on v_items from anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['ge_new(bigint,integer,integer,text)', 'ge_new2(bigint,integer,integer,text,text,integer)', 'ge_json(items)', 'ge_battle_drop()', 'ge_chest_drop()', 'qs_pay(wallets,jsonb,text,text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on function gear_sell(uuid, int, uuid) from public;
grant execute on function gear_sell(uuid, int, uuid) to anon, authenticated;
revoke all on function gear_upgrade(uuid, int, uuid, uuid) from public;
revoke all on function gear_tier_up(uuid, int, uuid, uuid, uuid) from public;
grant execute on function gear_upgrade(uuid, int, uuid, uuid) to anon, authenticated;
grant execute on function gear_tier_up(uuid, int, uuid, uuid, uuid) to anon, authenticated;
