-- a second player with three seats in the save (like the user's phone)
insert into players (tg_id,name,username,house,realm,save,save_ver) values
 (555,'B K','bk','targaryen',0,'{"v":4,"cur":1,"slots":[{"house":"targaryen","langI":0,"campaign":{"1":3,"2":3,"3":2},"hard":{},"stats":{"kills":700,"onlineBest":21}},{"house":"stark","langI":0,"campaign":{"1":2},"stats":{"kills":90,"onlineBest":12}},{"house":"martell","langI":5,"campaign":{},"stats":{"kills":3,"onlineBest":0}}]}',7)
 on conflict (tg_id) do update set save=excluded.save, save_ver=excluded.save_ver;
insert into scores (tg_id,seat,name,house,realm,stars,gates,waves,kills) values (555,0,'B K','targaryen',0,8,3,21,700) on conflict on constraint scores_pkey do nothing;
insert into daily_scores (day,tg_id,seat,name,house,realm,waves,kills,runs) values ((now() at time zone 'utc')::date,555,0,'B K','targaryen',0,21,300,2) on conflict on constraint daily_scores_pkey do nothing;
insert into sessions (token,tg_id) values ('11111111-1111-1111-1111-111111111111',555) on conflict do nothing;
