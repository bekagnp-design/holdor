-- ============================================================
--  HOLDOR backend v39 (2026-11-04) — no wasted cards from chests (game v1.4.9)
--  Run AFTER holdor_v38.sql. Safe to re-run. Replaces one function: ec_pool (what a chest stack can be).
--  Before: a card left the pool only at its top level. Now a tower or a spell also leaves it once the copies already held
--  cover every level still to buy (no copy from a chest would ever be used). Champions keep the old rule: their copies
--  also feed another champion's ascension.
-- ============================================================
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
     and ec_i(w.cards, 't:' || e.key) < (select coalesce(sum(ec_card_need('t:' || e.key, l)), 0)
                                           from generate_series(ec_i(w.levels, 't:' || e.key, 1)::int, ec_i(cf.mx, 't')::int - 1) l)
  union all
  select 's:' || e.key, (e.value->>'rar')::int from cf, cl, jsonb_each(cf.c->'spells') e
   where cl.n >= (e.value->>'open')::int and ec_i(w.levels, 's:' || e.key, 1) < ec_i(cf.mx, 's')
     and ec_i(w.cards, 's:' || e.key) < (select coalesce(sum(ec_card_need('s:' || e.key, l)), 0)
                                           from generate_series(ec_i(w.levels, 's:' || e.key, 1)::int, ec_i(cf.mx, 's')::int - 1) l) $$;
