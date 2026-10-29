-- ============================================================
--  HOLDOR backend v34 (2026-10-29) — two new spells: Long Night and Gate repair (game v1.2.1)
--  Run AFTER holdor_v33.sql. Safe to re-run. Config only: no function or table changes.
--  The spells are cards like the others: they open at a stage and drop from chests by rarity (econ_config 'cards' → spells).
--  Level keys 's:night' and 's:repair' need nothing else: the card operations take any 's:<id>' key.
-- ============================================================
update econ_config
   set v = jsonb_set(jsonb_set(v, '{spells,night}', '{"open":8,"rar":3}'::jsonb, true), '{spells,repair}', '{"open":12,"rar":2}'::jsonb, true)
 where k = 'cards';
select v->'spells' as spells from econ_config where k = 'cards';
