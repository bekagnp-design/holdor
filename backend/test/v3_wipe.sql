set role anon;
-- seat -1 (no seat chosen): save accepted, no score row touched
select save_progress('11111111-1111-1111-1111-111111111111'::uuid, '{"v":4,"cur":-1,"slots":[{"house":"targaryen","campaign":{}},{"house":"stark","campaign":{}},{"house":"martell","campaign":{}}]}'::jsonb, 20, null, null, 0, 0, 0, 0, -1);
reset role;
select 'after seat -1', tg_id, seat, house, stars, waves from scores where tg_id=555 order by seat;
set role anon;
-- seat III wiped in the app -> its row disappears; a malformed slots array must not delete anything
select save_progress('11111111-1111-1111-1111-111111111111'::uuid, '{"v":4,"cur":0,"slots":[]}'::jsonb, 21, 'targaryen', 0, 9, 3, 21, 710, 0);
reset role;
select 'after empty slots (kept)', count(*) from scores where tg_id=555;
set role anon;
select save_progress('11111111-1111-1111-1111-111111111111'::uuid, '{"v":4,"cur":0,"slots":[{"house":"targaryen","campaign":{}},{"house":"stark","campaign":{}},null]}'::jsonb, 22, 'targaryen', 0, 9, 3, 21, 710, 0);
reset role;
select 'after wipe III', tg_id, seat, house, stars, waves from scores where tg_id=555 order by seat;
-- an old save (lower ver) never deletes
set role anon;
select save_progress('11111111-1111-1111-1111-111111111111'::uuid, '{"v":4,"cur":0,"slots":[null,null,null]}'::jsonb, 3, 'targaryen', 0, 1, 1, 1, 1, 0);
reset role;
select 'after stale save', count(*) from scores where tg_id=555;
