-- ============================================================
--  HOLDOR backend v25 (2026-10-04) — the weekly realm war, standings (game v1.0.93)
--  Run AFTER holdor_v24.sql. Safe to re-run. Read-only: it only reads `daily_scores` (the Hold runs), nothing is written.
--  A week is Monday 00:00 → Sunday 24:00 UTC. A player's week = the sum of his daily Hold waves. A realm's score =
--    the average weekly waves of its top 50 players (so a small realm is not drowned by a big one)
--    + 0.5 for every player who played on 3 or more days of the week (at most 40 players count: +20 at most).
--  The answer carries no Telegram id: the realms in order, and — when a session token is given — the caller's own week.
-- ============================================================
-- the realms of this week, ranked (a helper: the app cannot call it)
create or replace function realm_war_rows() returns table (realm int, players int, active int, avg50 numeric, total int, score numeric, pos int)
language sql stable security definer set search_path = public as $$
  with w as (select date_trunc('week', (now() at time zone 'utc'))::date as w0),
  pw as (select d.realm, d.tg_id, sum(d.waves)::int pts, count(*)::int days from daily_scores d, w where d.day >= w.w0 and d.day < w.w0 + 7 and d.waves > 0 and d.realm between 0 and 192 group by d.realm, d.tg_id),
  rk as (select pw.*, row_number() over (partition by pw.realm order by pw.pts desc, pw.tg_id) rn from pw),
  rs as (select rk.realm, count(*)::int players, (count(*) filter (where rk.days >= 3))::int active, round(avg(rk.pts) filter (where rk.rn <= 50), 1) avg50, sum(rk.pts)::int total from rk group by rk.realm),
  sc as (select rs.*, round(coalesce(rs.avg50, 0) + 0.5 * least(rs.active, 40), 1) score from rs)
  select sc.realm, sc.players, sc.active, sc.avg50, sc.total, sc.score, (rank() over (order by sc.score desc, sc.total desc, sc.realm))::int from sc;
$$;
revoke all on function realm_war_rows() from public, anon, authenticated;

create or replace function realm_war(token uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w0 date := date_trunc('week', (now() at time zone 'utc'))::date; pid bigint; res jsonb; mine jsonb; mr int; mp int; md int;
begin
  if token is not null then pid := ec_session(token); end if;
  select coalesce(jsonb_agg(jsonb_build_object('realm', r.realm, 'players', r.players, 'active', r.active, 'avg50', r.avg50, 'total', r.total, 'score', r.score, 'pos', r.pos) order by r.pos), '[]'::jsonb)
    into res from (select * from realm_war_rows() order by pos limit 30) r;
  if pid is not null then
    select d.realm into mr from daily_scores d where d.tg_id = pid order by d.day desc limit 1;
    select coalesce(sum(d.waves), 0)::int, (count(*) filter (where d.waves > 0))::int into mp, md from daily_scores d where d.tg_id = pid and d.day >= w0 and d.day < w0 + 7;
    mine := jsonb_build_object('realm', mr, 'points', mp, 'days', md, 'pos', (select r.pos from realm_war_rows() r where r.realm = mr), 'score', (select r.score from realm_war_rows() r where r.realm = mr));
  end if;
  return jsonb_build_object('week_start', w0, 'ends_at', (w0 + 7)::timestamp at time zone 'utc', 'realms', res, 'mine', mine);
end $$;
revoke all on function realm_war(uuid) from public;
grant execute on function realm_war(uuid) to anon, authenticated;
