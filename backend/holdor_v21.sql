-- ============================================================
--  HOLDOR backend v21 (2026-10-03) — lucky chests (game v1.0.84)
--  Run AFTER holdor_v20.sql. Safe to re-run.
--  Like Clash Royale's lucky drops: a chest is opened with three taps, and each tap may raise it one tier
--  (wood → iron → valyrian → dragon). The server rolls the taps here, pays the final tier, and returns the taps so the app
--  only plays them back. The chance depends on the tier the chest has reached (econ_config 'lucky').
--  The source rules (free chest once a day, paid chests, level and star chests) still check the tier that was asked for.
-- ============================================================
insert into econ_config (k, v) values ('lucky', '{"taps":3,"p":{"wood":35,"iron":20,"valyrian":8,"dragon":0}}'::jsonb)
on conflict (k) do update set v = excluded.v;
alter table chests add column if not exists asked text;   -- the tier the chest started as (tier = where the taps took it)

create or replace function chest_open(token uuid, seat int, tier text, source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; T jsonb := econ_cfg('chests')->tier; lk jsonb := econ_cfg('lucky'); ord text[] := array['wood','iron','valyrian','dragon']; ft text := tier; taps jsonb := '[]'::jsonb; hit boolean; fc timestamptz; lv int; n int; stars int; g int; m int; cid uuid; used text[] := '{}'; st jsonb := '[]'::jsonb; s record; fills int := 0; i int; b jsonb; bks jsonb := '[]'::jsonb;
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
  -- v21 lucky taps: each tap may raise the chest one tier (rolled here; the app only plays them back)
  for i in 1 .. coalesce(ec_i(lk, 'taps')::int, 0) loop
    hit := random() * 100 < coalesce((lk->'p'->>ft)::numeric, 0);
    taps := taps || to_jsonb(hit);
    if hit then ft := ord[array_position(ord, ft) + 1]; end if;
  end loop;
  T := econ_cfg('chests')->ft;
  g := jint(T->'gold'->>0) + floor(random() * (jint(T->'gold'->>1) - jint(T->'gold'->>0) + 1))::int;
  m := jint(T->'gems'->>0) + floor(random() * (jint(T->'gems'->>1) - jint(T->'gems'->>0) + 1))::int;
  insert into chests (tg_id, seat, tier, source, gold, gems, cards, asked) values (pid, chest_open.seat, ft, source, g, m, ec_i(T, 'cards'), tier) returning id into cid;
  w := ec_book(w, 'gold', g, 'chest', ft || ':' || source);
  w := ec_book(w, 'gems', m, 'chest', ft || ':' || source);
  for i in 0 .. ec_i(T, 'cards')::int - 1 loop
    select * into s from ec_card_stack(w, ft, case when i < ec_i(econ_cfg('cards')->'rare', ft) then least(4, 2 + i) else 0 end, used);
    if s.k is null then fills := fills + 1;
    else used := used || s.k; w := ec_cards(w, s.k, s.n); st := st || jsonb_build_array(jsonb_build_object('k', s.k, 'n', s.n)); end if;
  end loop;
  if fills > 0 then
    update chests set filled = fills where id = cid;
    w := ec_book(w, 'gold', 100 * fills, 'chestfill', cid::text);
  end if;
  -- books (v8): each of the chest's book lines drops with its chance
  for b in select x from jsonb_array_elements(coalesce(econ_cfg('tavern')->'book_drop'->ft, '[]'::jsonb)) x loop
    if random() * 100 < (b->>2)::numeric then
      w := ec_cards(w, 'b:' || (b->>0), (b->>1)::int);
      bks := bks || jsonb_build_array(jsonb_build_object('k', 'b:' || (b->>0), 'n', (b->>1)::int));
    end if;
  end loop;
  perform ec_save(w);
  return jsonb_build_object('chest', cid, 'from', tier, 'tier', ft, 'taps', taps, 'gold', g, 'gems', m, 'cards', ec_i(T, 'cards'), 'stacks', st, 'fills', fills, 'books', bks, 'state', ec_state(w));
end $$;

revoke all on function chest_open(uuid, int, text, text) from public;
grant execute on function chest_open(uuid, int, text, text) to anon, authenticated;

-- the owner's dashboard: how often chests went up
create or replace view v_lucky as
  select date_trunc('day', c.at)::date as day, c.source, coalesce(c.asked, c.tier) as asked, c.tier, count(*) as chests
    from chests c group by 1, 2, 3, 4 order by 1 desc, 2, 3, 4;
revoke all on v_lucky from anon, authenticated;
