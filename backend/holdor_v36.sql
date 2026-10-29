-- ============================================================
--  HOLDOR backend v36 (2026-10-29) — the spells Wildfire jars and Beacon as cards (game v1.3.3)
--  Run AFTER holdor_v35.sql. Safe to re-run. Config only: no function or table changes.
--  Cards like the others: Wildfire jars open at stage 15 (Epic), Beacon at stage 20 (Legendary). Level keys 's:jars' and 's:beacon' need nothing else.
-- ============================================================
update econ_config
   set v = jsonb_set(jsonb_set(v, '{spells,jars}', '{"open":15,"rar":2}'::jsonb, true), '{spells,beacon}', '{"open":20,"rar":3}'::jsonb, true)
 where k = 'cards';
select v->'spells' as spells from econ_config where k = 'cards';
