-- ============================================================
--  HOLDOR backend v23 (2026-10-04) — the realm chat (game v1.0.91)
--  Run AFTER holdor_v22.sql. Safe to re-run.
--  One chat per realm (country). A defender speaks as one of his seats (name and house from `scores`); nobody's Telegram id ever
--  leaves the server. Rules: 200 characters; links, @handles and a word list are cleaned; at most one message per 2 seconds and 15 per
--  minute; the same text twice within 30 seconds is refused; the newest 300 messages of a realm are kept. A player can block an
--  author or report a message (from the message itself); three different reporters in a day mute the author for an hour.
--  The word list (chat_words) is the owner's to extend (Georgian words too): insert into chat_words values ('...').
-- ============================================================
create table if not exists chat_msgs (
  id bigserial primary key, realm int not null, tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null default 0,
  name text not null default '', house text, body text not null, at timestamptz not null default now());
create index if not exists chat_msgs_realm_idx on chat_msgs (realm, id desc);
create index if not exists chat_msgs_author_idx on chat_msgs (tg_id, at desc);
create table if not exists chat_blocks (tg_id bigint not null references players(tg_id) on delete cascade, blocked bigint not null references players(tg_id) on delete cascade, at timestamptz not null default now(), primary key (tg_id, blocked));
create table if not exists chat_reports (id bigserial primary key, msg_id bigint, reporter bigint not null, author bigint not null, reason text, body text, at timestamptz not null default now(), unique (msg_id, reporter));
create table if not exists chat_mutes (tg_id bigint primary key references players(tg_id) on delete cascade, until timestamptz not null, reason text);
create table if not exists chat_words (w text primary key);
insert into chat_words (w) values ('fuck'), ('shit'), ('bitch'), ('cunt'), ('asshole'), ('nigger'), ('nigga'), ('faggot') on conflict do nothing;
alter table chat_msgs enable row level security; alter table chat_blocks enable row level security; alter table chat_reports enable row level security;
alter table chat_mutes enable row level security; alter table chat_words enable row level security;

-- text → what may be shown: control characters out, spaces collapsed, links / handles / listed words hidden, 200 characters
create or replace function chat_clean(t text) returns text language plpgsql stable set search_path = public as $$
declare r text := coalesce(t, ''); w text;
begin
  r := regexp_replace(r, '[[:cntrl:]]', ' ', 'g');
  r := regexp_replace(r, '\s+', ' ', 'g');
  r := btrim(r);
  r := regexp_replace(r, '(https?://|www\.|t\.me/|tg://)\S*', '•••', 'gi');
  r := regexp_replace(r, '\S+\.(com|net|org|io|me|ge|ru|gg|xyz|link|app|co|ly|tv|info|club|site|online)(/\S*)?(\s|$)', '••• ', 'gi');
  r := regexp_replace(r, '@[A-Za-z0-9_]{3,}', '•••', 'g');
  for w in select c.w from chat_words c loop r := regexp_replace(r, regexp_replace(w, '([^[:alnum:]])', '\\\1', 'g'), '***', 'gi'); end loop;
  return btrim(left(r, 200));
end $$;

-- the realm and the name of one of my seats
create or replace function chat_seat(pid bigint, seat int, out realm int, out name text, out house text) language plpgsql stable security definer set search_path = public as $$
begin
  select s.realm, s.name, s.house into realm, name, house from scores s where s.tg_id = pid and s.seat = chat_seat.seat;
  if realm is null then raise exception 'play a battle first: the chat opens for defenders'; end if;
end $$;

create or replace function chat_send(token uuid, seat int, body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); s record; txt text; mu timestamptz; n int; id bigint;
begin
  select * into s from chat_seat(pid, seat);
  select m.until into mu from chat_mutes m where m.tg_id = pid and m.until > now();
  if mu is not null then raise exception 'you are muted for % more minutes', ceil(extract(epoch from mu - now()) / 60); end if;
  txt := chat_clean(body);
  if txt = '' then raise exception 'empty message'; end if;
  if exists (select 1 from chat_msgs c where c.tg_id = pid and c.at > now() - interval '2 seconds') then raise exception 'slow down'; end if;
  select count(*) into n from chat_msgs c where c.tg_id = pid and c.at > now() - interval '1 minute';
  if n >= 15 then raise exception 'too many messages, wait a minute'; end if;
  if exists (select 1 from chat_msgs c where c.tg_id = pid and c.body = txt and c.at > now() - interval '30 seconds') then raise exception 'you just said that'; end if;
  insert into chat_msgs (realm, tg_id, seat, name, house, body) values (s.realm, pid, seat, left(coalesce(s.name, ''), 30), s.house, txt) returning chat_msgs.id into id;
  if random() < 0.05 then   -- keep the newest 300 of this realm
    delete from chat_msgs c where c.realm = s.realm and c.id < (select min(x.id) from (select m.id from chat_msgs m where m.realm = s.realm order by m.id desc limit 300) x);
  end if;
  return jsonb_build_object('id', id, 'realm', s.realm);
end $$;

-- the newest messages of my realm (after `since`), oldest first; authors I blocked or who are muted are left out; no Telegram ids
create or replace function chat_list(token uuid, seat int, since bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid bigint := ec_session(token); s record;
begin
  select * into s from chat_seat(pid, seat);
  return jsonb_build_object('realm', s.realm, 'msgs', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'house', x.house, 'body', x.body, 'at', x.at, 'mine', x.tg_id = pid) order by x.id)
    from (select m.* from chat_msgs m where m.realm = s.realm and m.id > coalesce(since, 0)
            and not exists (select 1 from chat_blocks b where b.tg_id = pid and b.blocked = m.tg_id)
            and not exists (select 1 from chat_mutes u where u.tg_id = m.tg_id and u.until > now())
          order by m.id desc limit 50) x), '[]'::jsonb));
end $$;

create or replace function chat_block(token uuid, msg bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); a bigint;
begin
  select m.tg_id into a from chat_msgs m where m.id = msg;
  if a is null then raise exception 'no such message'; end if;
  if a = pid then raise exception 'that is you'; end if;
  insert into chat_blocks (tg_id, blocked) values (pid, a) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function chat_unblock_all(token uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); n int;
begin delete from chat_blocks b where b.tg_id = pid; get diagnostics n = row_count; return jsonb_build_object('ok', true, 'n', n); end $$;

create or replace function chat_report(token uuid, msg bigint, reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); a bigint; b text; n int;
begin
  select m.tg_id, m.body into a, b from chat_msgs m where m.id = msg;
  if a is null then raise exception 'no such message'; end if;
  if a = pid then raise exception 'that is you'; end if;
  insert into chat_reports (msg_id, reporter, author, reason, body) values (msg, pid, a, left(reason, 80), b) on conflict do nothing;
  select count(distinct r.reporter) into n from chat_reports r where r.author = a and r.at > now() - interval '24 hours';
  if n >= 3 then
    insert into chat_mutes (tg_id, until, reason) values (a, now() + interval '1 hour', 'reports') on conflict (tg_id) do update set until = excluded.until, reason = excluded.reason;
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function chat_clean(text), chat_seat(bigint, int) from public, anon, authenticated;
revoke all on function chat_send(uuid, int, text), chat_list(uuid, int, bigint), chat_block(uuid, bigint), chat_unblock_all(uuid), chat_report(uuid, bigint, text) from public;
grant execute on function chat_send(uuid, int, text), chat_list(uuid, int, bigint), chat_block(uuid, bigint), chat_unblock_all(uuid), chat_report(uuid, bigint, text) to anon, authenticated;

-- the owner's view: the reports of the last week, with the text that was reported
create or replace view v_chat_reports as
  select r.at, r.msg_id, r.author, p.name as author_name, r.reporter, r.reason, r.body from chat_reports r left join players p on p.tg_id = r.author where r.at > now() - interval '7 days' order by r.at desc;
revoke all on v_chat_reports from anon, authenticated;
