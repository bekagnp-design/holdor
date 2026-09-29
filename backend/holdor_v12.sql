-- ============================================================
--  HOLDOR backend v12 (2026-09-30) — gear III: 54 kinds of item and special effects (game v1.0.63)
--  Run AFTER holdor_v11.sql. Safe to re-run (the kinds config is replaced; items keep the kind they were given).
--  * Every slot has several KINDS (Sword, Axe, Spear, Bow, Crossbow, Staff, Dagger, Warhammer, Halberd, Flail; Shield, Buckler, Tome, Torch …;
--    54 in all). A kind decides which main stats an item can roll and which special effects it can carry.
--  * PERKS: an item of rarity Uncommon (sometimes) / Rare carries one special effect, Epic and Legendary two — one of the kind's pool.
--    A perk is one of the game's skill mechanics (Bleed, Thorns, Storm, Execute, Frostbite, Tribute …) granted by the item; its strength
--    is the item's power: rank = ⌈(rarity + tier) / 2⌉ (1–5). The champion gets the best rank of each perk he wears.
--  * The kinds and their pools are written by backend/gear_kinds.py between the KINDS markers below. Older items get a kind of their slot once.
-- ============================================================
alter table items add column if not exists kind smallint;
alter table items add column if not exists perks jsonb not null default '[]'::jsonb;
update items i set kind = floor(random() * jsonb_array_length(econ_cfg('gear')->'kinds'->i.slot))::int where i.kind is null and econ_cfg('gear') ? 'kinds';

-- KINDS-BEGIN
update econ_config set v = v || '{"kinds":{"weapon":[{"n":"Sword","main":["dmg","rate"],"perks":["bleed","sunder","parry","blood"]},{"n":"Axe","main":["dmg","crit"],"perks":["bleed","execute","warhammer","blood"]},{"n":"Spear","main":["dmg","range"],"perks":["knock","duelist","pierce","momentum"]},{"n":"Bow","main":["rate","range"],"perks":["multishot","pierce","volley","keepback"]},{"n":"Crossbow","main":["dmg","range"],"perks":["pierce","sunder","duelist","chain"]},{"n":"Staff","main":["cdr","dmg"],"perks":["storm","burn","howl","quickstudy"]},{"n":"Dagger","main":["crit","rate"],"perks":["execute","poison","viper","waitstrike"]},{"n":"Warhammer","main":["dmg","hp"],"perks":["stun","warhammer","knock","sunder"]},{"n":"Halberd","main":["dmg","range"],"perks":["cleave","chain","duelist","knock"]},{"n":"Flail","main":["dmg","rate"],"perks":["bleed","stun","charm","drownaura"]}],"offhand":[{"n":"Shield","main":["armor","hp"],"perks":["discipline","thorns","parry","whatisdead"]},{"n":"Buckler","main":["armor","rate"],"perks":["parry","keepback","thorns","contempt"]},{"n":"Kite shield","main":["hp","armor"],"perks":["discipline","contempt","shield","rally"]},{"n":"Tome","main":["cdr","hp"],"perks":["quickstudy","rations","heal","storm"]},{"n":"Torch","main":["dmg","hp"],"perks":["burn","drownaura","howl","slowaura"]},{"n":"Orb","main":["cdr","dmg"],"perks":["storm","poison","frostbite","charm"]}],"helmet":[{"n":"Helm","main":["hp","armor"],"perks":["contempt","whatisdead","shield","thorns"]},{"n":"Hood","main":["crit","cdr"],"perks":["viper","howl","slowaura","waitstrike"]},{"n":"Crown","main":["gold","hp"],"perks":["tribute","goldtouch","hand","drill"]},{"n":"Coif","main":["armor","regen"],"perks":["thorns","shield","rations","discipline"]},{"n":"Mask","main":["crit","lifesteal"],"perks":["viper","poison","execute","bleed"]},{"n":"Horned helm","main":["dmg","hp"],"perks":["blood","stun","knock","bleed"]}],"armor":[{"n":"Mail","main":["armor","hp"],"perks":["thorns","discipline","whatisdead","contempt"]},{"n":"Plate","main":["armor","hp"],"perks":["contempt","shield","parry","thorns"]},{"n":"Robe","main":["cdr","regen"],"perks":["rations","heal","quickstudy","storm"]},{"n":"Jerkin","main":["spd","hp"],"perks":["keepback","momentum","favour","reave"]},{"n":"Cloak","main":["spd","crit"],"perks":["howl","slowaura","viper","waitstrike"]},{"n":"Brigandine","main":["armor","rate"],"perks":["drill","bleed","sunder","discipline"]}],"gloves":[{"n":"Gauntlets","main":["rate","armor"],"perks":["stun","warhammer","parry","knock"]},{"n":"Gloves","main":["rate","crit"],"perks":["poison","viper","chain","bleed"]},{"n":"Bracers","main":["dmg","armor"],"perks":["thorns","sunder","shield","parry"]},{"n":"Mitts","main":["rate","regen"],"perks":["frostbite","burn","charm","storm"]}],"boots":[{"n":"Boots","main":["spd"],"perks":["momentum","keepback","reave","trap"]},{"n":"Greaves","main":["spd","armor"],"perks":["thorns","contempt","knock","shield"]},{"n":"Sandals","main":["spd","regen"],"perks":["waitstrike","howl","favour","rations"]},{"n":"Spurs","main":["spd","dmg"],"perks":["momentum","bleed","cleave","drill"]}],"ring":[{"n":"Ring","main":["dmg","rate","cdr","lifesteal"],"perks":["poison","burn","frostbite","reave"]},{"n":"Signet","main":["gold","cdr"],"perks":["goldtouch","tribute","hand","quickstudy"]},{"n":"Band","main":["crit","rate"],"perks":["execute","viper","chain","stun"]},{"n":"Seal","main":["armor","hp"],"perks":["whatisdead","thorns","parry","shield"]},{"n":"Loop","main":["lifesteal","regen"],"perks":["reave","rations","heal","sunaura"]},{"n":"Claw ring","main":["dmg","crit"],"perks":["bleed","sunder","duelist","momentum"]}],"amulet":[{"n":"Amulet","main":["hp","cdr","gold","lifesteal"],"perks":["whatisdead","quickstudy","tribute","reave"]},{"n":"Pendant","main":["regen","armor"],"perks":["heal","rations","discipline","sunaura"]},{"n":"Talisman","main":["crit","cdr"],"perks":["storm","waitstrike","viper","quickstudy"]},{"n":"Charm","main":["gold","spd"],"perks":["tribute","goldtouch","trap","favour"]},{"n":"Fang","main":["dmg","lifesteal"],"perks":["reave","bleed","blood","poison"]},{"n":"Relic","main":["hp","armor"],"perks":["whatisdead","shield","thorns","contempt"]}],"banner":[{"n":"Banner","main":["range","cdr","gold","regen"],"perks":["rally","forge","siegecraft","drill"]},{"n":"Standard","main":["range","hp"],"perks":["rally","siegecraft","favour","discipline"]},{"n":"Pennant","main":["spd","cdr"],"perks":["rally","hand","howl","drill"]},{"n":"War horn","main":["cdr","gold"],"perks":["howl","rally","favour","tribute"]},{"n":"Totem","main":["regen","hp"],"perks":["sunaura","heal","rations","bloodmagic"]},{"n":"Sigil","main":["crit","range"],"perks":["forge","siegecraft","sunder","hand"]}]},"perk_p":[0,40,100,100,100],"perk2_p":[0,0,0,100,100]}'::jsonb where k = 'gear';
-- KINDS-END

update items i set kind = floor(random() * jsonb_array_length(econ_cfg('gear')->'kinds'->i.slot))::int where i.kind is null;
alter table items alter column kind set default 0;
alter table items alter column kind set not null;

-- the rank of an item's perks from its rarity and tier
create or replace function ge_perk_rank(r int, t int) returns int language sql immutable set search_path = '' as $$
  select least(5, greatest(1, ceil((r + t) / 2.0)::int)) $$;

-- a new item: the kind, the main stat from the kind, perks from the kind's pool
create or replace function ge_new2(pid bigint, st int, min_r int, src text, tier_key text, min_tier int) returns items
language plpgsql security definer set search_path = public as $$
declare g jsonb := econ_cfg('gear'); it items; x double precision; r int := 0; t int := 1; acc double precision := 0; slot text; mk text; sk text; ks text[]; n int; subs jsonb := '[]'::jsonb; i int; tp jsonb;
        kn int; kd jsonb; perks jsonb := '[]'::jsonb; pool text[]; p text;
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
  kn := floor(random() * jsonb_array_length(g->'kinds'->slot))::int;
  kd := g->'kinds'->slot->kn;
  mk := kd->'main'->>floor(random() * jsonb_array_length(kd->'main'))::int;
  select array_agg(k order by random()) into ks from jsonb_object_keys(g->'sub') k where k <> mk;
  n := (g->'subs_n'->>r)::int;
  for i in 1 .. n loop
    sk := ks[i];
    subs := subs || jsonb_build_array(jsonb_build_object('k', sk, 'v',
      (g->'sub'->sk->>0)::int + floor(random() * ((g->'sub'->sk->>1)::int - (g->'sub'->sk->>0)::int + 1))::int));
  end loop;
  -- perks: one with the chance for the rarity, a second with its own chance, never the same twice
  select array_agg(e order by random()) into pool from jsonb_array_elements_text(kd->'perks') e;
  if random() * 100 < (g->'perk_p'->>r)::numeric and pool is not null then
    perks := jsonb_build_array(pool[1]);
    if random() * 100 < (g->'perk2_p'->>r)::numeric and array_length(pool, 1) > 1 then perks := perks || jsonb_build_array(pool[2]); end if;
  end if;
  insert into items (tg_id, seat, slot, kind, rar, tier, set_k, main_k, subs, perks, src)
    values (pid, st, slot, kn, r, t, (select k from jsonb_object_keys(g->'sets') k order by random() limit 1), mk, subs, perks, src)
    returning * into it;
  return it;
end $$;

create or replace function ge_json(it items) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', it.id, 'slot', it.slot, 'kind', it.kind, 'r', it.rar, 'tier', it.tier, 'cap', it.tier * 4, 'set', it.set_k, 'lvl', it.lvl, 'champ', it.champ, 'src', it.src,
    'main', jsonb_build_object('k', it.main_k, 'v', round(((econ_cfg('gear')->'main_base'->>it.main_k)::numeric * (econ_cfg('gear')->'rar_mul'->>it.rar)::numeric
                                                  * (econ_cfg('gear')->'tier_mul'->>(it.tier - 1))::numeric * (1 + (econ_cfg('gear')->>'lvl_mul')::numeric * it.lvl))::numeric, 1)),
    'subs', it.subs, 'perks', it.perks, 'pr', ge_perk_rank(it.rar, it.tier), 'at', it.created_at) $$;

create or replace view v_items as
  select i.created_at, i.tg_id, p.name, i.seat, i.slot, i.rar, i.set_k, i.main_k, i.lvl, i.champ, i.src, i.tier, i.kind, i.perks
    from items i left join players p on p.tg_id = i.tg_id order by i.created_at desc;
revoke all on v_items from anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['ge_perk_rank(integer,integer)', 'ge_new2(bigint,integer,integer,text,text,integer)', 'ge_json(items)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
