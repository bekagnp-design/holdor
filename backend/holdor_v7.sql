-- ============================================================
--  HOLDOR backend v7 (2026-09-28) — card copies on the server (game v1.0.58)
--  Run AFTER holdor_v6.sql and holdor_econ_data.sql (which now carries the card rules: econ_config 'cards'). Safe to re-run.
--  Until now a seat's card copies were counted in the app. From here the server keeps them (wallets.cards) and:
--  * a card level (econ_sync 'card') needs the copies and uses them up;
--  * chest_open rolls the card stacks too (what the seat can get, by rarity, copies by chest); a slot with nothing to give
--    is 100 gold on the server;
--  * the first win of a stage gives a few copies (trigger on progress);
--  * a card deal adds its copies here.
--  Seats from before bring their save's copies once (capped); the ones already on the server get them now.
--  Older apps keep working; their own card counting just stops mattering.
-- ============================================================
alter table wallets add column if not exists cards jsonb not null default '{}'::jsonb;

-- the card's rarity (0 Common … 3 Legendary), null for a key that is no card of this game
create or replace function ec_card_rar(k text) returns int language sql stable set search_path = public as $$
  select (econ_cfg('cards')->(case split_part(k, ':', 1) when 'c' then 'champs' when 't' then 'towers' when 's' then 'spells' end)->split_part(k, ':', 2)->>'rar')::int $$;
-- copies to go from level lvl to lvl + 1 (the game: CARD_NEED[min(l-1, …)] × CARD_MUL[rarity], at least 1)
create or replace function ec_card_need(k text, lvl int) returns int language sql stable set search_path = public as $$
  select greatest(1, round((econ_cfg('cards')->'need'->>(least(lvl, jsonb_array_length(econ_cfg('cards')->'need')) - 1))::numeric
                           * (econ_cfg('cards')->'mul'->>ec_card_rar(k))::numeric))::int $$;
-- copies in and out: the wallet in memory and the table (a trigger may have added copies meanwhile, so the table gets a delta)
create or replace function ec_cards(inout w wallets, k text, d int) language plpgsql security definer set search_path = public as $$
begin
  w.cards := jsonb_set(coalesce(w.cards, '{}'::jsonb), array[k], to_jsonb(greatest(0, ec_i(w.cards, k) + d)));
  update wallets x set cards = jsonb_set(x.cards, array[k], to_jsonb(greatest(0, ec_i(x.cards, k) + d))) where x.tg_id = w.tg_id and x.seat = w.seat;
end $$;
-- what the seat can get cards of: its house's open champions, open towers and spells, none at the top level
create or replace function ec_pool(w wallets) returns table (k text, r int) language sql stable security definer set search_path = public as $$
  with a as (select p.save->'slots'->w.seat::int as a from players p where p.tg_id = w.tg_id),
       cl as (select count(*) as n from progress p where p.tg_id = w.tg_id and p.seat = w.seat and p.mode = 'c'),
       cf as (select econ_cfg('cards') as c, econ_cfg('max') as mx)
  select 'c:' || e.key, (e.value->>'rar')::int from cf, a, cl, jsonb_each(cf.c->'champs') e
   where e.value->>'house' = a.a->>'house' and (cl.n >= (e.value->>'open')::int or coalesce(w.claims->'copen', '{}'::jsonb) ? e.key)
     and ec_i(w.levels, 'c:' || e.key, 1) < ec_i(cf.mx, 'c')
  union all
  select 't:' || e.key, (e.value->>'rar')::int from cf, cl, jsonb_each(cf.c->'towers') e
   where cl.n >= (e.value->>'open')::int and ec_i(w.levels, 't:' || e.key, 1) < ec_i(cf.mx, 't')
  union all
  select 's:' || e.key, (e.value->>'rar')::int from cf, cl, jsonb_each(cf.c->'spells') e
   where cl.n >= (e.value->>'open')::int and ec_i(w.levels, 's:' || e.key, 1) < ec_i(cf.mx, 's') $$;
-- one chest stack (the game's cardStack): rarer cards weigh less, a stack is a chest's copies × the rarity's share
create or replace function ec_card_stack(w wallets, tier text, minr int, used text[]) returns table (k text, n int)
language plpgsql security definer set search_path = public as $$
declare c jsonb := econ_cfg('cards'); ks text[]; rs int[]; tot numeric := 0; x numeric; i int; wt numeric; lo int; hi int;
begin
  select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p where not (p.k = any(used)) and p.r >= minr;
  if ks is null then select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p where not (p.k = any(used)); end if;
  if ks is null then select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p; end if;
  if ks is null then return; end if;
  for i in 1 .. array_length(ks, 1) loop tot := tot + (array[10, 6, 3, 1])[rs[i] + 1]; end loop;
  x := random() * tot;
  for i in 1 .. array_length(ks, 1) loop
    wt := (array[10, 6, 3, 1])[rs[i] + 1]; x := x - wt;
    if x <= 0 or i = array_length(ks, 1) then
      lo := (c->'pack'->tier->>0)::int; hi := (c->'pack'->tier->>1)::int;
      k := ks[i]; n := greatest(1, round((lo + floor(random() * (hi - lo + 1))) * (c->'mul'->>rs[i])::numeric))::int;
      return next; return;
    end if;
  end loop;
end $$;

-- the first win of a stage: a few copies of something the seat owns (only for a stage won in a server battle, not an import)
create or replace function ec_first_clear() returns trigger language plpgsql security definer set search_path = public as $$
declare w wallets; vk text := case new.mode when 'h' then 'hard' else 'camp' end; ks text[]; rs int[]; i int; n int;
begin
  if not exists (select 1 from battles b where b.tg_id = new.tg_id and b.seat = new.seat and b.kind = vk and b.stage = new.stage and b.status = 'open') then return new; end if;
  select * into w from wallets x where x.tg_id = new.tg_id and x.seat = new.seat;
  if not found then return new; end if;
  select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p;
  if ks is null then return new; end if;
  i := 1 + floor(random() * array_length(ks, 1))::int;
  n := greatest(1, round((3 + floor(random() * 4)) * (econ_cfg('cards')->'mul'->>rs[i])::numeric))::int;
  perform ec_cards(w, ks[i], n);
  return new;
end $$;
drop trigger if exists progress_first_clear on progress;
create trigger progress_first_clear after insert on progress for each row execute function ec_first_clear();

-- a save's copies, cleaned (only this game's cards, 0…5000 each) and its early-opened champions
create or replace function ec_save_cards(a jsonb) returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(e.key, ec_clamp(jint(e.value #>> '{}'), 0, 5000)), '{}'::jsonb)
    from jsonb_each(case when jsonb_typeof(a->'cards') = 'object' then a->'cards' else '{}'::jsonb end) e
   where ec_card_rar(e.key) is not null and jint(e.value #>> '{}') > 0 $$;
create or replace function ec_save_copen(a jsonb) returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(e.key, 1), '{}'::jsonb)
    from jsonb_each(case when jsonb_typeof(a->'copen') = 'object' then a->'copen' else '{}'::jsonb end) e
   where econ_cfg('cards')->'champs' ? e.key $$;
-- a seat from before v5 brings its copies with the rest of its save (once, when its wallet is made)
create or replace function ec_wallet_cards() returns trigger language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  if coalesce(new.claims->>'legacy', '') <> 'true' then return new; end if;
  select p.save->'slots'->new.seat::int into a from players p where p.tg_id = new.tg_id;
  new.cards := ec_save_cards(a);
  new.claims := new.claims || jsonb_build_object('copen', ec_save_copen(a));
  return new;
end $$;
drop trigger if exists wallets_cards on wallets;
create trigger wallets_cards before insert on wallets for each row execute function ec_wallet_cards();

-- ---------- v5 functions with the copies added (generated from holdor_v5.sql, the card lines marked by what they do) ----------
create or replace function ec_op(inout w wallets, op jsonb) language plpgsql security definer set search_path = public as $$
declare r text := op->>'r'; k text := op->>'k'; id uuid := (op->>'id')::uuid; tlvl int; cur int; price bigint; mx int;
        t text; cid text; need int; have int; si int; g jsonb; pgold bigint; pgems bigint; dwin bigint; dk text; deal jsonb; i int; today text := ec_day(); hold jsonb; rf jsonb; tbl jsonb; ec jsonb;
begin
  if r = 'card' then                        -- a level for a champion (c:), tower (t:) or spell (s:) card
    t := split_part(k, ':', 1); tlvl := jint(op->>'to');
    if t not in ('c', 't', 's') or split_part(k, ':', 2) = '' then raise exception 'bad card'; end if;
    mx := ec_i(econ_cfg('max'), t); cur := ec_i(w.levels, k, 1);
    if tlvl is distinct from cur + 1 or tlvl > mx then raise exception 'card level % → % (max %)', cur, tlvl, mx; end if;
    price := jint(econ_cfg('card_gold')->t->>(cur - 1));
    if price is null then raise exception 'no price'; end if;
    need := ec_card_need(k, cur); have := ec_i(w.cards, k);
    if have < need then raise exception 'not enough cards: % of %', have, need; end if;
    w := ec_cards(w, k, -need);
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
        if ec_card_rar(g->>'key') is null then raise exception 'bad card'; end if;
        w := ec_cards(w, g->>'key', ec_i(g, 'cnt')::int);
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

create or replace function chest_open(token uuid, seat int, tier text, source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; T jsonb := econ_cfg('chests')->tier; fc timestamptz; lv int; n int; stars int; g int; m int; cid uuid; used text[] := '{}'; st jsonb := '[]'::jsonb; s record; fills int := 0; i int;
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
  for i in 0 .. ec_i(T, 'cards')::int - 1 loop
    select * into s from ec_card_stack(w, tier, case when i < ec_i(econ_cfg('cards')->'rare', tier) then least(3, 1 + i) else 0 end, used);
    if s.k is null then fills := fills + 1;
    else used := used || s.k; w := ec_cards(w, s.k, s.n); st := st || jsonb_build_array(jsonb_build_object('k', s.k, 'n', s.n)); end if;
  end loop;
  if fills > 0 then
    update chests set filled = fills where id = cid;
    w := ec_book(w, 'gold', 100 * fills, 'chestfill', cid::text);
  end if;
  perform ec_save(w);
  return jsonb_build_object('chest', cid, 'gold', g, 'gems', m, 'cards', ec_i(T, 'cards'), 'stacks', st, 'fills', fills, 'state', ec_state(w));
end $$;

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
    'cards', coalesce((select x.cards from wallets x where x.tg_id = w.tg_id and x.seat = w.seat), '{}'::jsonb),
    'cfg', jsonb_build_object('energy', ec), 'at', now());
end $$;

-- the seats already on the server take their save's copies now (once: only while they still have none)
update wallets w set cards = ec_save_cards(p.save->'slots'->w.seat::int),
                     claims = w.claims || jsonb_build_object('copen', ec_save_copen(p.save->'slots'->w.seat::int))
  from players p where p.tg_id = w.tg_id and w.cards = '{}'::jsonb;

do $$ declare f text; begin
  foreach f in array array['ec_card_rar(text)','ec_card_need(text,integer)','ec_cards(wallets,text,integer)','ec_pool(wallets)','ec_card_stack(wallets,text,integer,text[])',
                           'ec_first_clear()','ec_save_cards(jsonb)','ec_save_copen(jsonb)','ec_wallet_cards()','ec_op(wallets,jsonb)','ec_state(wallets)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on function chest_open(uuid, int, text, text) from public;
grant execute on function chest_open(uuid, int, text, text) to anon, authenticated;
