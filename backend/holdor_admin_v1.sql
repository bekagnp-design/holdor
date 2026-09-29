-- ============================================================
--  HOLDOR admin views v1 (2026-09-28) — where players stop, energy, what they buy (dashboard only)
--  Views over the server's own records (battles, ledger, progress, sessions). No app access. Safe to re-run.
--  Read them in Supabase → Table editor, or ask Claude to read them through the connector.
-- ============================================================

-- every stage: who tried it, how battles ended, how long they took — the stage where players stall shows here
create or replace view v_stage_funnel as
  select b.kind, b.stage,
         count(distinct (b.tg_id, b.seat)) as seats_tried,
         count(*) as battles,
         count(*) filter (where b.status = 'won') as won,
         count(*) filter (where b.status = 'lost') as lost,
         count(*) filter (where b.status = 'rejected') as rejected,
         count(*) filter (where b.status in ('open', 'expired')) as left_unfinished,
         round(100.0 * count(*) filter (where b.status = 'won') / nullif(count(*) filter (where b.status in ('won', 'lost')), 0), 1) as win_pct,
         round(avg(extract(epoch from b.finished_at - b.started_at)) filter (where b.status in ('won', 'lost')))::int as avg_secs,
         round(avg(b.stars) filter (where b.status = 'won'), 2) as avg_stars,
         (select count(*) from progress p where p.mode = case b.kind when 'hard' then 'h' else 'c' end and p.stage = b.stage) as seats_cleared
    from battles b where b.kind in ('camp', 'hard')
   group by b.kind, b.stage order by b.kind, b.stage;

-- the last stage each seat has cleared: how far the players get
create or replace view v_progress_depth as
  select coalesce(max_stage, 0) as last_stage, count(*) as seats
    from (select w.tg_id, w.seat, (select max(p.stage) from progress p where p.tg_id = w.tg_id and p.seat = w.seat and p.mode = 'c') as max_stage from wallets w) s
   group by 1 order by 1;

-- energy per UTC day: spent on battles, bought back with dragonglass, and seats sitting on a full bar right now
create or replace view v_energy_daily as
  select (l.at at time zone 'utc')::date as day,
         -sum(l.delta) filter (where l.cur = 'energy' and l.reason = 'battle') as energy_spent,
         count(*) filter (where l.cur = 'energy' and l.reason = 'refill') as refills,
         count(distinct (l.tg_id, l.seat)) filter (where l.cur = 'energy' and l.reason = 'battle') as seats_playing,
         (select count(*) from wallets w where w.energy >= ec_i(econ_cfg('energy'), 'max')) as seats_full_now
    from ledger l group by 1 order by 1 desc;

-- gold and dragonglass per UTC day and reason: where the economy's money comes from and goes to
create or replace view v_econ_daily as
  select (l.at at time zone 'utc')::date as day, l.cur, l.reason,
         sum(l.delta) filter (where l.delta > 0) as earned, -sum(l.delta) filter (where l.delta < 0) as spent, count(*) as bookings
    from ledger l where l.cur in ('gold', 'gems') and l.reason not in ('legacy', 'start')
   group by 1, 2, 3 order by 1 desc, 2, 4 desc nulls last;

-- the first thing each seat spent gold or dragonglass on
create or replace view v_first_spend as
  select reason as first_spend, count(*) as seats
    from (select distinct on (l.tg_id, l.seat) l.reason from ledger l where l.delta < 0 and l.cur in ('gold', 'gems') order by l.tg_id, l.seat, l.id) f
   group by 1 order by 2 desc;

-- players per UTC day: logins, seats that fought, new players
create or replace view v_active_daily as
  with d as (select distinct (s.last_seen at time zone 'utc')::date as day from sessions s
             union select distinct (b.started_at at time zone 'utc')::date from battles b)
  select d.day,
         (select count(distinct s.tg_id) from sessions s where (s.last_seen at time zone 'utc')::date = d.day or (s.created_at at time zone 'utc')::date = d.day) as players_seen,
         (select count(distinct (b.tg_id, b.seat)) from battles b where (b.started_at at time zone 'utc')::date = d.day) as seats_fought,
         (select count(*) from players p where (p.created_at at time zone 'utc')::date = d.day) as new_players
    from d order by d.day desc;

revoke all on v_stage_funnel, v_progress_depth, v_energy_daily, v_econ_daily, v_first_spend, v_active_daily from anon, authenticated;
