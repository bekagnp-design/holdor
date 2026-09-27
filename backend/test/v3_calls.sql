set role anon;
-- old client (no seat) still works -> seat 0
select save_progress('11111111-1111-1111-1111-111111111111'::uuid, '{"v":4,"cur":0,"slots":[]}'::jsonb, 8, 'targaryen', 0, 9, 3, 21, 710);
-- new client, seat 1 saves its own numbers
select save_progress('11111111-1111-1111-1111-111111111111'::uuid, '{"v":4,"cur":1,"slots":[]}'::jsonb, 9, 'stark', 0, 2, 1, 12, 95, 1);
-- seat 1 plays the daily Hold: 11 waves (old style call for seat 0 first: 21 already there)
select hold_result('11111111-1111-1111-1111-111111111111'::uuid, null, 11, 140, 1, 'stark', 0);
select hold_result('11111111-1111-1111-1111-111111111111'::uuid, null, 5, 40);
reset role;
select tg_id, seat, name, house, stars, gates, waves, kills from scores order by tg_id, seat;
select day, tg_id, seat, house, waves, kills, runs from daily_scores order by tg_id, seat;
set role anon;
select jsonb_pretty(leaderboard(null, 555, 1) - 'realms' - 'houses' - 'at');
select (leaderboard(null, 555) -> 'myday') as seat0_myday, (leaderboard(null,555)->'me'->>'rank') as seat0_rank;
select jsonb_pretty(leaderboard() -> 'realms');
reset role;
