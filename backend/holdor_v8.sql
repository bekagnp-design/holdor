-- ============================================================
--  HOLDOR backend v8 (2026-09-29) — champions: stars, books, the summon (game v1.0.59)
--  Run AFTER holdor_v7.sql and holdor_econ_data.sql (which now carries econ_config 'tavern' and the five rarities). Safe to re-run.
--  * Rarity by opening order: 1–2 Common, 3 Uncommon, 4–5 Rare, 6 Epic, 7 Legendary (econ_config 'cards').
--  * Stars ★1–6: a champion's level stays ≤ 10 × its star (levels 'st:<champ>'; a seat from before counts
--    ⌈level / 10⌉). econ_sync 'asc' raises a star: the level at the cap, gold, and the cards of another champion
--    of the house burnt.
--  * A skill rank needs books of the champion's rarity (wallet cards 'b:c' 'b:r' 'b:e' 'b:l'); chests roll books,
--    the deals sell them.
--  * champ_summon: dragonglass for a champion of the seat's house — a sealed one opens (claims.copen), an open one
--    brings cards. Every summon is kept in the summons table.
--  Apply it together with the v1.0.59 release: the older apps level skills without books and would be refused.
-- ============================================================
create table if not exists summons (
  id bigserial primary key, tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  n int not null, gems int not null, rolls jsonb not null, at timestamptz not null default now());
create index if not exists summons_idx on summons (tg_id, seat, at desc);
alter table summons enable row level security;
revoke all on summons from anon, authenticated;
revoke all on sequence summons_id_seq from anon, authenticated;

-- a champion's rarity (null = no champion of this game), its skill book, and a seat's star for it
create or replace function ec_champ_rar(cid text) returns int language sql stable set search_path = public as $$
  select (econ_cfg('cards')->'champs'->cid->>'rar')::int $$;
create or replace function ec_champ_book(cid text) returns text language sql stable set search_path = public as $$
  select 'b:' || (econ_cfg('tavern')->'book_of'->>ec_champ_rar(cid)) $$;
create or replace function ec_star(w wallets, cid text) returns int language sql stable set search_path = public as $$
  select least(ec_i(econ_cfg('tavern'), 'st_max', 6)::int,
               greatest(ec_i(w.levels, 'st:' || cid, 1)::int, ceil(ec_i(w.levels, 'c:' || cid, 1) / 10.0)::int)) $$;

-- ---------- v7 functions with the stars, books and rarities added (generated from holdor_v7.sql) ----------
create or replace function ec_card_stack(w wallets, tier text, minr int, used text[]) returns table (k text, n int)
language plpgsql security definer set search_path = public as $$
declare c jsonb := econ_cfg('cards'); ks text[]; rs int[]; tot numeric := 0; x numeric; i int; wt numeric; lo int; hi int;
begin
  select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p where not (p.k = any(used)) and p.r >= minr;
  if ks is null then select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p where not (p.k = any(used)); end if;
  if ks is null then select array_agg(p.k), array_agg(p.r) into ks, rs from ec_pool(w) p; end if;
  if ks is null then return; end if;
  for i in 1 .. array_length(ks, 1) loop tot := tot + (array[10, 8, 6, 3, 1])[rs[i] + 1]; end loop;
  x := random() * tot;
  for i in 1 .. array_length(ks, 1) loop
    wt := (array[10, 8, 6, 3, 1])[rs[i] + 1]; x := x - wt;
    if x <= 0 or i = array_length(ks, 1) then
      lo := (c->'pack'->tier->>0)::int; hi := (c->'pack'->tier->>1)::int;
      k := ks[i]; n := greatest(1, round((lo + floor(random() * (hi - lo + 1))) * (c->'mul'->>rs[i])::numeric))::int;
      return next; return;
    end if;
  end loop;
end $$;

create or replace function ec_op(inout w wallets, op jsonb) language plpgsql security definer set search_path = public as $$
declare r text := op->>'r'; k text := op->>'k'; id uuid := (op->>'id')::uuid; tlvl int; cur int; price bigint; mx int;
        t text; cid text; need int; have int; bk text; f text; tv jsonb := econ_cfg('tavern'); si int; g jsonb; pgold bigint; pgems bigint; dwin bigint; dk text; deal jsonb; i int; today text := ec_day(); hold jsonb; rf jsonb; tbl jsonb; ec jsonb;
begin
  if r = 'card' then                        -- a level for a champion (c:), tower (t:) or spell (s:) card
    t := split_part(k, ':', 1); tlvl := jint(op->>'to');
    if t not in ('c', 't', 's') or split_part(k, ':', 2) = '' then raise exception 'bad card'; end if;
    mx := ec_i(econ_cfg('max'), t); cur := ec_i(w.levels, k, 1);
    if tlvl is distinct from cur + 1 or tlvl > mx then raise exception 'card level % → % (max %)', cur, tlvl, mx; end if;
    if t = 'c' and tlvl > 10 * ec_star(w, split_part(k, ':', 2)) then raise exception 'the star allows level % at most', 10 * ec_star(w, split_part(k, ':', 2)); end if;
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
    bk := ec_champ_book(cid); need := jint(tv->'book_need'->>(cur - 1)); have := ec_i(w.cards, bk);
    if bk is null or need is null then raise exception 'bad champion'; end if;
    if have < need then raise exception 'not enough books: % of %', have, need; end if;
    w := ec_cards(w, bk, -need);
    w := ec_book(w, 'gold', -price, 'sk', k || ':' || tlvl, id);
    w := ec_book(w, 'xp', round(price / 10.0)::bigint, 'sk', k, id);
    w.levels := jsonb_set(w.levels, array['sk:' || k], to_jsonb(tlvl));
  elsif r = 'asc' then                      -- a star: level at the star's cap, gold, another champion of the house burnt
    cid := k; f := op->>'f'; tlvl := jint(op->>'to'); cur := ec_star(w, cid);
    if ec_champ_rar(cid) is null or ec_champ_rar(f) is null or f = cid
       or (econ_cfg('cards')->'champs'->cid->>'house') is distinct from (econ_cfg('cards')->'champs'->f->>'house') then raise exception 'bad star'; end if;
    if tlvl is distinct from cur + 1 or tlvl > ec_i(tv, 'st_max') then raise exception 'star % → %', cur, tlvl; end if;
    if ec_i(w.levels, 'c:' || cid, 1) < 10 * cur then raise exception 'level % is below the star''s cap %', ec_i(w.levels, 'c:' || cid, 1), 10 * cur; end if;
    need := greatest(1, round(jint(tv->'asc_burn'->>(cur - 1)) * (econ_cfg('cards')->'mul'->>ec_champ_rar(f))::numeric))::int; have := ec_i(w.cards, 'c:' || f);
    if have < need then raise exception 'not enough cards to burn: % of %', have, need; end if;
    price := jint(tv->'asc_gold'->>(cur - 1));
    w := ec_cards(w, 'c:' || f, -need);
    w := ec_book(w, 'gold', -price, 'asc', cid || ':' || tlvl, id);
    w := ec_book(w, 'xp', round(price / 10.0)::bigint, 'asc', cid, id);
    w.levels := jsonb_set(w.levels, array['st:' || cid], to_jsonb(tlvl));
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
      elsif g->>'k' = 'books' then
        bk := g->>'key';
        if split_part(bk, ':', 1) <> 'b' or tv->'book_price'->split_part(bk, ':', 2) is null or not ec_i(g, 'cnt') between 1 and 3
           or pgold < jint(tv->'book_price'->>split_part(bk, ':', 2)) * ec_i(g, 'cnt') then raise exception 'bad book deal'; end if;
        w := ec_cards(w, bk, ec_i(g, 'cnt')::int);
      elsif g->>'k' = 'sk' then
        k := (g->>'c') || ':' || ec_i(g, 'i', -1); cur := ec_i(w.levels, 'sk:' || k, 1);
        if ec_i(g, 'i', -1) not between 0 and 2 or cur >= ec_i(econ_cfg('max'), 'sk')
           or cur >= (select count(*) from jsonb_array_elements_text(econ_cfg('sk_cap')) as c(v) where ec_i(w.levels, 'c:' || (g->>'c'), 1) >= c.v::int)
           or pgold <> round(jint(econ_cfg('sk_cost')->>(cur - 1)) * 0.6 / 10.0) * 10 then raise exception 'bad skill deal'; end if;
        bk := ec_champ_book(g->>'c'); need := jint(tv->'book_need'->>(cur - 1));
        if bk is null or ec_i(w.cards, bk) < need then raise exception 'not enough books'; end if;
        w := ec_cards(w, bk, -need);
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
declare pid bigint; w wallets; T jsonb := econ_cfg('chests')->tier; fc timestamptz; lv int; n int; stars int; g int; m int; cid uuid; used text[] := '{}'; st jsonb := '[]'::jsonb; s record; fills int := 0; i int; b jsonb; bks jsonb := '[]'::jsonb;
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
    select * into s from ec_card_stack(w, tier, case when i < ec_i(econ_cfg('cards')->'rare', tier) then least(4, 2 + i) else 0 end, used);
    if s.k is null then fills := fills + 1;
    else used := used || s.k; w := ec_cards(w, s.k, s.n); st := st || jsonb_build_array(jsonb_build_object('k', s.k, 'n', s.n)); end if;
  end loop;
  if fills > 0 then
    update chests set filled = fills where id = cid;
    w := ec_book(w, 'gold', 100 * fills, 'chestfill', cid::text);
  end if;
  -- books (v8): each of the chest's book lines drops with its chance
  for b in select x from jsonb_array_elements(coalesce(econ_cfg('tavern')->'book_drop'->tier, '[]'::jsonb)) x loop
    if random() * 100 < (b->>2)::numeric then
      w := ec_cards(w, 'b:' || (b->>0), (b->>1)::int);
      bks := bks || jsonb_build_array(jsonb_build_object('k', 'b:' || (b->>0), 'n', (b->>1)::int));
    end if;
  end loop;
  perform ec_save(w);
  return jsonb_build_object('chest', cid, 'gold', g, 'gems', m, 'cards', ec_i(T, 'cards'), 'stacks', st, 'fills', fills, 'books', bks, 'state', ec_state(w));
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
    'copen', coalesce(w.claims->'copen', '{}'::jsonb),
    'cards', coalesce((select x.cards from wallets x where x.tg_id = w.tg_id and x.seat = w.seat), '{}'::jsonb),
    'cfg', jsonb_build_object('energy', ec), 'at', now());
end $$;

-- the portal: n = 1 or 10 summons of a champion of the seat's house (ten always hold a Rare or better)
create or replace function champ_summon(token uuid, seat int, n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; tv jsonb := econ_cfg('tavern'); cc jsonb := econ_cfg('cards'); price int; house text; cl int;
        out jsonb := '[]'::jsonb; i int; k int; x numeric; r int; best int := 0; cid text; cnt int;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  if n is null or n not in (1, 10) then raise exception 'bad summon'; end if;
  select p.save->'slots'->seat::int->>'house' into house from players p where p.tg_id = pid;
  if house is null then raise exception 'no seat'; end if;
  price := case when n = 10 then ec_i(tv->'summon', 'ten') else ec_i(tv->'summon', 'one') end;
  w := ec_book(w, 'gems', -price, 'summon', n::text);
  select count(*) into cl from progress p where p.tg_id = pid and p.seat = champ_summon.seat and p.mode = 'c';
  for i in 1 .. n loop
    x := random() * 100; r := 4;
    for k in 0 .. 4 loop x := x - (tv->'summon'->'odds'->>k)::numeric; if x < 0 then r := k; exit; end if; end loop;
    if n = 10 and i = n and best < 2 then r := 2; end if;
    cid := null;
    select e.key into cid from jsonb_each(cc->'champs') e where e.value->>'house' = house and (e.value->>'rar')::int = r order by random() limit 1;
    if cid is null then continue; end if;
    best := greatest(best, r);
    if cl >= (cc->'champs'->cid->>'open')::int or coalesce(w.claims->'copen', '{}'::jsonb) ? cid then
      cnt := greatest(1, round(ec_i(tv->'summon', 'copies') * (cc->'mul'->>r)::numeric))::int;
      w := ec_cards(w, 'c:' || cid, cnt);
      out := out || jsonb_build_array(jsonb_build_object('c', cid, 'r', r, 'new', false, 'n', cnt));
    else
      w.claims := jsonb_set(w.claims, '{copen}', coalesce(w.claims->'copen', '{}'::jsonb) || jsonb_build_object(cid, 1));
      out := out || jsonb_build_array(jsonb_build_object('c', cid, 'r', r, 'new', true, 'n', 0));
    end if;
  end loop;
  insert into summons (tg_id, seat, n, gems, rolls) values (pid, champ_summon.seat, n, price, out);
  perform ec_save(w);
  return jsonb_build_object('rolls', out, 'state', ec_state(w));
end $$;

do $$ declare f text; begin
  foreach f in array array['ec_champ_rar(text)','ec_champ_book(text)','ec_star(wallets,text)','ec_card_stack(wallets,text,integer,text[])','ec_op(wallets,jsonb)','ec_state(wallets)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on function chest_open(uuid, int, text, text) from public;
grant execute on function chest_open(uuid, int, text, text) to anon, authenticated;
revoke all on function champ_summon(uuid, int, int) from public;
grant execute on function champ_summon(uuid, int, int) to anon, authenticated;
