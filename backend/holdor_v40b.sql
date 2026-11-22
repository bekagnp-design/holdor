-- ============================================================
--  HOLDOR backend v40b (2026-11-22) — hardening of v40 after the review of game v2.0.0. Run AFTER holdor_v40.sql. Safe to re-run.
--  rpg_presence  coordinates clamped to ±20 000 and the level to 1..60; distances computed in bigint before subtracting
--                (an extreme x/y no longer overflows int and breaks presence for everyone near).
--  rpg_board     the numbers a client writes into its save are capped (level 60, best level 60, kills 1 000 000, bosses 20,
--                fallen 10 000) so an edited save cannot hold the boards with absurd values.
--  rpg_chat_send one message per 2 seconds AND at most 12 per minute, serialised per player (no race under parallel calls).
--  rpg_save_if   (new) the save with a base: refused with {ok:false, stale:true, state, saved} when the stored save is newer than
--                the base the client last synced (the save's own 'saved' stamp), so a slow phone never overwrites newer progress.
--  rpg_chat_block / rpg_chat_report  (new) block or report the author of a zone-chat message (v23's tables; reports of the RPG
--                chat are stored with msg_id = −id so they never collide with the realm chat's ids; 3 reporters in 24 h mute 1 h).
-- ============================================================
create or replace function rpg_presence(token uuid, seat int, x int, y int, zone text, lvl int, house text, name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); st int := seat; px bigint := greatest(-20000, least(20000, coalesce(x, 0))); py bigint := greatest(-20000, least(20000, coalesce(y, 0)));
        zn text := left(coalesce(zone, ''), 40); lv int := greatest(1, least(60, coalesce(lvl, 1))); hs text := left(coalesce(house, ''), 16); nm text := left(chat_clean(name), 24);
begin
  if st < 0 or st > 2 then raise exception 'bad seat'; end if;
  insert into rpg_presence as p (tg_id, seat, name, house, lvl, x, y, zone, at) values (pid, st, nm, hs, lv, px::int, py::int, zn, now())
    on conflict on constraint rpg_presence_pkey do update set name = excluded.name, house = excluded.house, lvl = excluded.lvl, x = excluded.x, y = excluded.y, zone = excluded.zone, at = now();
  if random() < 0.02 then delete from rpg_presence p where p.at < now() - interval '1 day'; end if;
  return jsonb_build_object('players', coalesce((
    select jsonb_agg(jsonb_build_object('name', o.name, 'house', o.house, 'lvl', o.lvl, 'x', o.x, 'y', o.y, 'zone', o.zone, 'seat', o.seat) order by o.d, o.lvl desc)
    from (select q.name, q.house, least(60, greatest(1, q.lvl)) as lvl, q.x, q.y, q.zone, q.seat, (q.x::bigint - px) * (q.x::bigint - px) + (q.y::bigint - py) * (q.y::bigint - py) as d
            from rpg_presence q
           where q.tg_id <> pid and q.at > now() - interval '90 seconds'
             and (q.zone = zn or (q.x::bigint - px) * (q.x::bigint - px) + (q.y::bigint - py) * (q.y::bigint - py) <= 1500 * 1500)
           order by d, q.lvl desc limit 40) o), '[]'::jsonb));
end $$;

create or replace function rpg_board(token uuid, kind text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid bigint := ec_session(token);
begin
  if kind not in ('lvl', 'best', 'kills', 'bosses', 'fallen') then raise exception 'bad board'; end if;
  return jsonb_build_object('kind', kind, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('name', r.name, 'house', r.house, 'lvl', r.lvl, 'v', r.v, 'mine', r.tg_id = pid) order by r.v desc, r.lvl desc, r.saved_at)
    from (select s.tg_id, left(chat_clean(s.state->'p'->>'name'), 24) as name, left(coalesce(s.state->'acc'->>'house', s.state->'p'->>'house'), 16) as house,
                 least(60, greatest(0, coalesce(jbig(s.state->'p'->>'lvl'), 0))) as lvl, s.saved_at,
                 case kind
                   when 'lvl' then least(60, greatest(0, coalesce(jbig(s.state->'p'->>'lvl'), 0)))
                   when 'best' then least(60, greatest(0, coalesce(jbig(s.state->'acc'->'best'->>'lvl'), 0)))
                   when 'kills' then least(1000000, greatest(0, coalesce(jbig(s.state->'acc'->'best'->>'kills'), 0)))
                   when 'bosses' then least(20, rpg_count(s.state->'acc'->'world'->'bosses'))
                   else least(10000, rpg_count(s.state->'acc'->'hall'))
                 end as v
            from rpg_saves s
           order by v desc, lvl desc, s.saved_at limit 50) r), '[]'::jsonb));
end $$;

create or replace function rpg_chat_send(token uuid, seat int, zone text, body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); zn text := left(coalesce(zone, ''), 40); txt text; mu timestamptz; nm text; hs text; mid bigint;
begin
  if zn = '' then raise exception 'no zone'; end if;
  perform pg_advisory_xact_lock(4040, (pid % 2000000000)::int);   -- one send at a time per player: the limits below cannot race
  select m.until into mu from chat_mutes m where m.tg_id = pid and m.until > now();
  if mu is not null then raise exception 'you are muted for % more minutes', ceil(extract(epoch from mu - now()) / 60); end if;
  txt := left(chat_clean(body), 160);
  if txt = '' then raise exception 'empty message'; end if;
  if exists (select 1 from rpg_chat c where c.tg_id = pid and c.at > now() - interval '2 seconds') then raise exception 'too fast'; end if;
  if (select count(*) from rpg_chat c where c.tg_id = pid and c.at > now() - interval '60 seconds') >= 12 then raise exception 'too fast'; end if;
  select p.name, p.house into nm, hs from rpg_presence p where p.tg_id = pid and p.seat = rpg_chat_send.seat;
  if nm is null or nm = '' then
    select left(chat_clean(s.state->'p'->>'name'), 24), left(coalesce(s.state->'acc'->>'house', s.state->'p'->>'house'), 16) into nm, hs
      from rpg_saves s where s.tg_id = pid and s.seat = rpg_chat_send.seat;
  end if;
  if nm is null or nm = '' then select left(chat_clean(pl.name), 24), coalesce(hs, pl.house) into nm, hs from players pl where pl.tg_id = pid; end if;
  insert into rpg_chat (tg_id, seat, zone, name, house, body) values (pid, seat, zn, coalesce(nm, ''), hs, txt) returning rpg_chat.id into mid;
  if random() < 0.05 then   -- keep the newest 300 of this zone
    delete from rpg_chat c where c.zone = zn and c.id < (select min(x.id) from (select m.id from rpg_chat m where m.zone = zn order by m.id desc limit 300) x);
  end if;
  return jsonb_build_object('ok', true, 'id', mid);
end $$;

-- the save with a base: base = the 'saved' stamp of the server save this client last pulled or pushed (null = no check)
create or replace function rpg_save_if(token uuid, seat int, state jsonb, base bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); cur jsonb; cs bigint;
begin
  if seat < 0 or seat > 2 then raise exception 'bad seat'; end if;
  if state is null or jsonb_typeof(state) <> 'object' then raise exception 'bad state'; end if;
  if octet_length(state::text) > 200 * 1024 then raise exception 'state too large'; end if;
  perform pg_advisory_xact_lock(4041, ((pid * 3 + seat) % 2000000000)::int);
  select s.state into cur from rpg_saves s where s.tg_id = pid and s.seat = rpg_save_if.seat;
  cs := coalesce(jbig(cur->>'saved'), 0);
  if cur is not null and base is not null and cs > base then
    return jsonb_build_object('ok', false, 'stale', true, 'saved', cs, 'state', cur);
  end if;
  insert into rpg_saves (tg_id, seat, state, saved_at) values (pid, seat, state, now())
    on conflict on constraint rpg_saves_pkey do update set state = excluded.state, saved_at = now();
  return jsonb_build_object('ok', true, 'saved_at', now(), 'saved', coalesce(jbig(state->>'saved'), 0));
end $$;

create or replace function rpg_chat_block(token uuid, msg bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); a bigint;
begin
  select m.tg_id into a from rpg_chat m where m.id = msg;
  if a is null then raise exception 'no such message'; end if;
  if a = pid then raise exception 'that is you'; end if;
  insert into chat_blocks (tg_id, blocked) values (pid, a) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function rpg_chat_report(token uuid, msg bigint, reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); a bigint; b text; n int;
begin
  select m.tg_id, m.body into a, b from rpg_chat m where m.id = msg;
  if a is null then raise exception 'no such message'; end if;
  if a = pid then raise exception 'that is you'; end if;
  insert into chat_reports (msg_id, reporter, author, reason, body) values (-msg, pid, a, left('rpg: ' || coalesce(reason, ''), 80), b) on conflict do nothing;
  select count(distinct r.reporter) into n from chat_reports r where r.author = a and r.at > now() - interval '24 hours';
  if n >= 3 then
    insert into chat_mutes (tg_id, until, reason) values (a, now() + interval '1 hour', 'reports') on conflict (tg_id) do update set until = excluded.until, reason = excluded.reason;
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function rpg_save_if(uuid, int, jsonb, bigint), rpg_chat_block(uuid, bigint), rpg_chat_report(uuid, bigint, text) from public;
grant execute on function rpg_save_if(uuid, int, jsonb, bigint), rpg_chat_block(uuid, bigint), rpg_chat_report(uuid, bigint, text) to anon, authenticated;
