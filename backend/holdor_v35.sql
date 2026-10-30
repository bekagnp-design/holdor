-- ============================================================
--  HOLDOR backend v35 (2026-10-29) — the tower Siege maul as a card (game v1.3.1)
--  Run AFTER holdor_v34.sql. Safe to re-run. Config only: no function or table changes.
--  It is a card like the others: it opens at stage 18 and drops from chests as an Epic (rarity 2). The level key 't:maul' needs nothing else.
-- ============================================================
update econ_config
   set v = jsonb_set(v, '{towers,maul}', '{"open":18,"rar":2}'::jsonb, true)
 where k = 'cards';
select v->'towers' as towers from econ_config where k = 'cards';
