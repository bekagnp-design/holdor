-- ============================================================
--  HOLDOR backend v40 (2026-11-22) — the action RPG's server side (game v2.0.0)
--  Run AFTER holdor_v39.sql. Safe to re-run. Adds three tables and six functions; touches nothing older.
--  rpg_saves     one save (the whole R.state JSON, ≤ 200 KB) per seat; rpg_save upserts, rpg_load returns it with the old wallet
--                (gold, gems, the champion levels `c:<id>` of `wallets.levels`) so the client imports it once.
--  rpg_presence  where each player stands (x, y, zone, level, name, house); rpg_presence upserts mine and returns the others seen in
--                the last 90 seconds in my zone or within 1500 world units, nearest first, at most 40 — never a Telegram id.
--  rpg_chat      one chat per zone: 160 characters through chat_clean (v23), one message per 2 seconds, mutes and blocks of v23 respected,
--                the newest 300 of a zone kept; rpg_chat_list gives the last 40 after `since`.
--  rpg_board     top 50 saves — names from the saves, no ids. The save is v2: the current hero in `p` (permadeath: heroes die, the account
--                stays) and the account in `acc` (house, best:{lvl,kills}, hall = the fallen heroes, world.bosses, champs). Kinds: 'lvl' the
--                hero's level, 'best' acc.best.lvl, 'kills' acc.best.kills, 'bosses' the keys of acc.world.bosses, 'fallen' the length of acc.hall.
--  Row level security is on with no policies: every access goes through the security definer functions below (as the rest of the schema).
-- ============================================================
create table if not exists rpg_saves (
  tg_id bigint not null references players(tg_id) on delete cascade,
  seat smallint not null default 0,
  state jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (tg_id, seat));
create table if not exists rpg_presence (
  tg_id bigint not null references players(tg_id) on delete cascade,
  seat smallint not null default 0,
  name text not null default '', house text, lvl int not null default 1,
  x int not null default 0, y int not null default 0, zone text,
  at timestamptz not null default now(),
  primary key (tg_id, seat));
create index if not exists rpg_presence_at_idx on rpg_presence (at desc);
create table if not exists rpg_chat (
  id bigserial primary key,
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null default 0,
  zone text not null default '', name text not null default '', house text, body text not null,
  at timestamptz not null default now());
create index if not exists rpg_chat_zone_idx on rpg_chat (zone, id);
create index if not exists rpg_chat_author_idx on rpg_chat (tg_id, at desc);
alter table rpg_saves enable row level security; alter table rpg_presence enable row level security; alter table rpg_chat enable row level security;

-- the save of one seat + the old wallet (zeros when the seat never had one): {state, wallet:{gold, gems, champs:{<id>: lvl}}}
create or replace function rpg_load(token uuid, seat int) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid bigint := ec_session(token); st jsonb; w wallets;
begin
  select s.state into st from rpg_saves s where s.tg_id = pid and s.seat = rpg_load.seat;
  select * into w from wallets x where x.tg_id = pid and x.seat = rpg_load.seat;
  return jsonb_build_object('state', st,
    'wallet', jsonb_build_object('gold', coalesce(w.gold, 0), 'gems', coalesce(w.gems, 0),
      'champs', coalesce((select jsonb_object_agg(substr(e.key, 3), ec_i(w.levels, e.key, 1)) from jsonb_each(coalesce(w.levels, '{}'::jsonb)) e where e.key like 'c:%'), '{}'::jsonb)));
end $$;

-- the whole save, replaced; 200 KB at most
create or replace function rpg_save(token uuid, seat int, state jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token);
begin
  if seat < 0 or seat > 2 then raise exception 'bad seat'; end if;
  if state is null or jsonb_typeof(state) <> 'object' then raise exception 'bad state'; end if;
  if octet_length(state::text) > 200 * 1024 then raise exception 'state too large'; end if;
  insert into rpg_saves (tg_id, seat, state, saved_at) values (pid, seat, state, now())
    on conflict on constraint rpg_saves_pkey do update set state = excluded.state, saved_at = now();
  return jsonb_build_object('ok', true, 'saved_at', now());
end $$;

-- where I am (upsert) → the others around me: same zone or within 1500 units, seen in the last 90 seconds, nearest first, at most 40
create or replace function rpg_presence(token uuid, seat int, x int, y int, zone text, lvl int, house text, name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); st int := seat; px int := coalesce(x, 0); py int := coalesce(y, 0);
        zn text := left(coalesce(zone, ''), 40); lv int := coalesce(lvl, 1); hs text := left(coalesce(house, ''), 16); nm text := left(chat_clean(name), 24);
begin
  if st < 0 or st > 2 then raise exception 'bad seat'; end if;
  insert into rpg_presence as p (tg_id, seat, name, house, lvl, x, y, zone, at) values (pid, st, nm, hs, lv, px, py, zn, now())
    on conflict on constraint rpg_presence_pkey do update set name = excluded.name, house = excluded.house, lvl = excluded.lvl, x = excluded.x, y = excluded.y, zone = excluded.zone, at = now();
  if random() < 0.02 then delete from rpg_presence p where p.at < now() - interval '1 day'; end if;
  return jsonb_build_object('players', coalesce((
    select jsonb_agg(jsonb_build_object('name', o.name, 'house', o.house, 'lvl', o.lvl, 'x', o.x, 'y', o.y, 'zone', o.zone, 'seat', o.seat) order by o.d, o.lvl desc)
    from (select q.name, q.house, q.lvl, q.x, q.y, q.zone, q.seat, (q.x - px)::bigint * (q.x - px) + (q.y - py)::bigint * (q.y - py) as d
            from rpg_presence q
           where q.tg_id <> pid and q.at > now() - interval '90 seconds'
             and (q.zone = zn or (q.x - px)::bigint * (q.x - px) + (q.y - py)::bigint * (q.y - py) <= 1500 * 1500)
           order by d, q.lvl desc limit 40) o), '[]'::jsonb));
end $$;

-- one message to my zone: cleaned (v23's rules), 160 characters, one per 2 seconds; name and house from my presence, else my save, else the account
create or replace function rpg_chat_send(token uuid, seat int, zone text, body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); zn text := left(coalesce(zone, ''), 40); txt text; mu timestamptz; nm text; hs text; mid bigint;
begin
  if zn = '' then raise exception 'no zone'; end if;
  select m.until into mu from chat_mutes m where m.tg_id = pid and m.until > now();
  if mu is not null then raise exception 'you are muted for % more minutes', ceil(extract(epoch from mu - now()) / 60); end if;
  txt := left(chat_clean(body), 160);
  if txt = '' then raise exception 'empty message'; end if;
  if exists (select 1 from rpg_chat c where c.tg_id = pid and c.at > now() - interval '2 seconds') then raise exception 'too fast'; end if;
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

-- the newest 40 messages of a zone after `since`, oldest first; authors I blocked or who are muted are left out; no Telegram ids
create or replace function rpg_chat_list(token uuid, seat int, zone text, since bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid bigint := ec_session(token); zn text := left(coalesce(zone, ''), 40);
begin
  return jsonb_build_object('zone', zn, 'msgs', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'house', x.house, 'body', x.body, 'at', x.at, 'mine', x.tg_id = pid) order by x.id)
    from (select m.* from rpg_chat m where m.zone = zn and m.id > coalesce(since, 0)
            and not exists (select 1 from chat_blocks b where b.tg_id = pid and b.blocked = m.tg_id)
            and not exists (select 1 from chat_mutes u where u.tg_id = m.tg_id and u.until > now())
          order by m.id desc limit 40) x), '[]'::jsonb));
end $$;

-- how many: the keys of an object, the length of an array, else 0 (a missing key counts 0)
create or replace function rpg_count(j jsonb) returns bigint language sql immutable set search_path = public as $$
  select case jsonb_typeof(j) when 'object' then (select count(*) from jsonb_object_keys(j)) when 'array' then jsonb_array_length(j) else 0 end $$;

-- top 50 saves: 'lvl' the current hero's level (p.lvl), 'best' acc.best.lvl, 'kills' acc.best.kills, 'bosses' the keys of acc.world.bosses,
-- 'fallen' the length of acc.hall; name from p, house from acc (else p); a missing key counts 0; {rows:[{name, house, lvl, v, mine}]}
create or replace function rpg_board(token uuid, kind text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid bigint := ec_session(token);
begin
  if kind not in ('lvl', 'best', 'kills', 'bosses', 'fallen') then raise exception 'bad board'; end if;
  return jsonb_build_object('kind', kind, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('name', r.name, 'house', r.house, 'lvl', r.lvl, 'v', r.v, 'mine', r.tg_id = pid) order by r.v desc, r.lvl desc, r.saved_at)
    from (select s.tg_id, left(chat_clean(s.state->'p'->>'name'), 24) as name, left(coalesce(s.state->'acc'->>'house', s.state->'p'->>'house'), 16) as house,
                 coalesce(jbig(s.state->'p'->>'lvl'), 0) as lvl, s.saved_at,
                 case kind
                   when 'lvl' then coalesce(jbig(s.state->'p'->>'lvl'), 0)
                   when 'best' then coalesce(jbig(s.state->'acc'->'best'->>'lvl'), 0)
                   when 'kills' then coalesce(jbig(s.state->'acc'->'best'->>'kills'), 0)
                   when 'bosses' then rpg_count(s.state->'acc'->'world'->'bosses')
                   else rpg_count(s.state->'acc'->'hall')
                 end as v
            from rpg_saves s
           order by v desc, lvl desc, s.saved_at limit 50) r), '[]'::jsonb));
end $$;

revoke all on function rpg_count(jsonb) from public, anon, authenticated;
revoke all on function rpg_load(uuid, int), rpg_save(uuid, int, jsonb), rpg_presence(uuid, int, int, int, text, int, text, text),
  rpg_chat_send(uuid, int, text, text), rpg_chat_list(uuid, int, text, bigint), rpg_board(uuid, text) from public;
grant execute on function rpg_load(uuid, int), rpg_save(uuid, int, jsonb), rpg_presence(uuid, int, int, int, text, int, text, text),
  rpg_chat_send(uuid, int, text, text), rpg_chat_list(uuid, int, text, bigint), rpg_board(uuid, text) to anon, authenticated;
