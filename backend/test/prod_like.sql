-- The production data as it stood on 2026-09-27 (before v3), pseudonymised: fake ids/names, and each save cut down
-- to the fields the backend reads (house, langI, made, campaign, hard, stats, cur). Load it into the local database
-- right after holdor_stats.sql, then run holdor_v3.sql and holdor_v4.sql and check with v4_test.py.
-- P1 — two empty seats (China, Georgia); plays seat II.
-- P2 — three seats: Georgia (Targaryen), Russia (Greyjoy), Germany (Targaryen); plays seat III. The old app wrote
--      one row for all three: best stars 49, best gates 34, best waves 26, kills 890 + 940 + 5045 = 6875, realm Germany.
-- P3 — one seat (Germany, Stark). Its row says 26 stars: an older app also counted the per-difficulty "stg" stars
--      (17 campaign + 9), which today's app no longer counts.
delete from daily_scores where tg_id between 900000001 and 900000003;
delete from scores where tg_id between 900000001 and 900000003;
delete from sessions where tg_id between 900000001 and 900000003;
delete from players where tg_id between 900000001 and 900000003;

insert into players (tg_id, name, username, house, realm, save, save_ver, created_at, updated_at) values
(900000001, 'P1', null, 'stark', 0, '{"v":4,"cur":1,"ver":15,"slots":[
  {"house":"targaryen","langI":2,"made":"2026-09-13","campaign":{},"stats":{"kills":0,"onlineBest":0}},
  {"house":"stark","langI":0,"made":"2026-09-19","campaign":{},"stats":{"kills":0,"onlineBest":0}},
  null]}', 15, '2026-09-19 17:10:14+00', '2026-09-19 17:13:26+00'),
(900000002, 'P2', null, 'targaryen', 3, '{"v":4,"cur":2,"ver":455,"slots":[
  {"house":"targaryen","langI":0,"made":"2026-09-15","hard":{},
   "campaign":{"1":3,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":3,"10":1,"11":3},
   "stats":{"kills":890,"onlineBest":12}},
  {"house":"greyjoy","langI":11,"made":"2026-09-17","hard":{},
   "campaign":{"1":3,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":3,"10":1,"11":3,"12":1,"13":1,"14":1,"15":1,"16":3},
   "stats":{"kills":940,"onlineBest":8}},
  {"house":"targaryen","langI":3,"made":"2026-09-14","hard":{},
   "campaign":{"1":3,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":3,"10":1,"11":3,"12":1,"13":1,"14":1,"15":1,"16":3,"17":1,
               "18":3,"19":3,"20":1,"21":2,"22":1,"23":1,"24":1,"25":1,"26":1,"27":1,"28":1,"29":1,"30":1,"31":1,"32":1,"33":1,"34":3},
   "stats":{"kills":5045,"onlineBest":26}}]}', 455, '2026-09-14 16:49:17+00', '2026-09-26 23:34:38+00'),
(900000003, 'P3', null, 'stark', 3, '{"v":4,"cur":0,"ver":176,"slots":[
  {"house":"stark","langI":3,"made":"2026-09-15","campaign":{"1":3,"2":3,"3":3,"4":3,"5":3,"6":2},
   "stg":{"1":{"2":1,"3":3},"2":{"2":1,"3":2},"3":{"2":2}},"stats":{"kills":5783,"onlineBest":13}},
  null, null]}', 176, '2026-09-15 20:56:58+00', '2026-09-22 20:52:52+00');

insert into scores (tg_id, name, house, realm, stars, gates, waves, kills, updated_at) values
(900000001, 'P1', 'stark', 0, 0, 0, 0, 0, '2026-09-19 17:13:26+00'),
(900000002, 'P2', 'targaryen', 3, 49, 34, 26, 6875, '2026-09-26 23:34:38+00'),
(900000003, 'P3', 'stark', 3, 26, 6, 13, 5783, '2026-09-22 20:52:52+00');

insert into daily_scores (day, tg_id, name, house, realm, waves, kills, runs, updated_at) values
('2026-09-14', 900000002, 'P2', 'targaryen', 3, 16, 275, 2, '2026-09-14 20:27:44+00'),
('2026-09-15', 900000002, 'P2', 'targaryen', 0, 15, 189, 3, '2026-09-15 22:14:51+00'),
('2026-09-17', 900000002, 'P2', 'greyjoy', 11, 12, 136, 2, '2026-09-17 19:58:37+00'),
('2026-09-18', 900000002, 'P2', 'targaryen', 3, 26, 542, 1, '2026-09-18 05:06:19+00'),
('2026-09-19', 900000002, 'P2', 'targaryen', 3, 15, 206, 1, '2026-09-19 16:34:46+00'),
('2026-09-19', 900000003, 'P3', 'stark', 3, 12, 143, 4, '2026-09-19 17:11:10+00'),
('2026-09-21', 900000003, 'P3', 'stark', 3, 12, 140, 3, '2026-09-21 09:37:25+00'),
('2026-09-22', 900000002, 'P2', 'targaryen', 3, 21, 337, 1, '2026-09-22 20:56:37+00'),
('2026-09-22', 900000003, 'P3', 'stark', 3, 13, 170, 2, '2026-09-22 20:49:09+00'),
('2026-09-26', 900000002, 'P2', 'targaryen', 3, 24, 466, 3, '2026-09-26 23:34:35+00');
