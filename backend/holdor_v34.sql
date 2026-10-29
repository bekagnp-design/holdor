-- ============================================================
--  HOLDOR backend v34 (2026-10-29) — three new cards: the spells Long Night and Gate repair (game v1.2.1) and the tower Rookery (v1.2.2)
--  Run AFTER holdor_v33.sql. Safe to re-run. Config only: no function or table changes.
--  They are cards like the others: they open at a stage and drop from chests by rarity (econ_config 'cards' → spells / towers).
--  Level keys 's:night', 's:repair' and 't:rook' need nothing else: the card operations take any 's:<id>' / 't:<id>' key.
-- ============================================================
update econ_config
   set v = jsonb_set(jsonb_set(jsonb_set(v, '{spells,night}', '{"open":8,"rar":3}'::jsonb, true), '{spells,repair}', '{"open":12,"rar":2}'::jsonb, true),
                     '{towers,rook}', '{"open":13,"rar":3}'::jsonb, true)
 where k = 'cards';
select v->'spells' as spells, v->'towers' as towers from econ_config where k = 'cards';
