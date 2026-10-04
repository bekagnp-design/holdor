-- ============================================================
--  HOLDOR backend v24 (2026-10-04) — Legendary drops are announced in the realm chat (game v1.0.92)
--  Run AFTER holdor_v23.sql. Safe to re-run.
--  Whenever a defender's seat gets a Legendary item (from any source: win, chest, gift, Hold), the server writes one line into the chat
--  of that seat's realm: kind 'drop', the author is the player, the text is "slot:kind:set" (built by the server, nothing typed by anyone,
--  so there is nothing to filter and nothing to report). Drop lines do not count against the sender's rate limits, cannot be reported
--  (a muted author's lines are hidden like his messages), and the app draws them as a gold banner with the item's picture.
-- ============================================================
alter table chat_msgs add column if not exists kind text not null default 'say';

create or replace function chat_send(token uuid, seat int, body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); s record; txt text; mu timestamptz; n int; id bigint;
begin
  select * into s from chat_seat(pid, seat);
  select m.until into mu from chat_mutes m where m.tg_id = pid and m.until > now();
  if mu is not null then raise exception 'you are muted for % more minutes', ceil(extract(epoch from mu - now()) / 60); end if;
  txt := chat_clean(body);
  if txt = '' then raise exception 'empty message'; end if;
  if exists (select 1 from chat_msgs c where c.tg_id = pid and c.kind = 'say' and c.at > now() - interval '2 seconds') then raise exception 'slow down'; end if;
  select count(*) into n from chat_msgs c where c.tg_id = pid and c.kind = 'say' and c.at > now() - interval '1 minute';
  if n >= 15 then raise exception 'too many messages, wait a minute'; end if;
  if exists (select 1 from chat_msgs c where c.tg_id = pid and c.kind = 'say' and c.body = txt and c.at > now() - interval '30 seconds') then raise exception 'you just said that'; end if;
  insert into chat_msgs (realm, tg_id, seat, name, house, body) values (s.realm, pid, seat, left(coalesce(s.name, ''), 30), s.house, txt) returning chat_msgs.id into id;
  if random() < 0.05 then   -- keep the newest 300 of this realm
    delete from chat_msgs c where c.realm = s.realm and c.id < (select min(x.id) from (select m.id from chat_msgs m where m.realm = s.realm order by m.id desc limit 300) x);
  end if;
  return jsonb_build_object('id', id, 'realm', s.realm);
end $$;

create or replace function chat_list(token uuid, seat int, since bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid bigint := ec_session(token); s record;
begin
  select * into s from chat_seat(pid, seat);
  return jsonb_build_object('realm', s.realm, 'msgs', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'house', x.house, 'body', x.body, 'kind', x.kind, 'at', x.at, 'mine', x.tg_id = pid) order by x.id)
    from (select m.* from chat_msgs m where m.realm = s.realm and m.id > coalesce(since, 0)
            and not exists (select 1 from chat_blocks b where b.tg_id = pid and b.blocked = m.tg_id)
            and not exists (select 1 from chat_mutes u where u.tg_id = m.tg_id and u.until > now())
          order by m.id desc limit 50) x), '[]'::jsonb));
end $$;

create or replace function chat_report(token uuid, msg bigint, reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid bigint := ec_session(token); a bigint; b text; n int;
begin
  select m.tg_id, m.body into a, b from chat_msgs m where m.id = msg and m.kind = 'say';
  if a is null then raise exception 'no such message'; end if;
  if a = pid then raise exception 'that is you'; end if;
  insert into chat_reports (msg_id, reporter, author, reason, body) values (msg, pid, a, left(reason, 80), b) on conflict do nothing;
  select count(distinct r.reporter) into n from chat_reports r where r.author = a and r.at > now() - interval '24 hours';
  if n >= 3 then
    insert into chat_mutes (tg_id, until, reason) values (a, now() + interval '1 hour', 'reports') on conflict (tg_id) do update set until = excluded.until, reason = excluded.reason;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function chat_drop() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select sc.realm, sc.name, sc.house into s from scores sc where sc.tg_id = new.tg_id and sc.seat = new.seat;
  if found then
    insert into chat_msgs (realm, tg_id, seat, name, house, body, kind)
      values (s.realm, new.tg_id, new.seat, left(coalesce(s.name, ''), 30), s.house, new.slot || ':' || coalesce(new.kind, 0) || ':' || new.set_k, 'drop');
  end if;
  return new;
end $$;
revoke all on function chat_drop() from public, anon, authenticated;
drop trigger if exists chat_drop_t on items;
create trigger chat_drop_t after insert on items for each row when (new.rar = 4) execute function chat_drop();

revoke all on function chat_send(uuid, int, text), chat_list(uuid, int, bigint), chat_report(uuid, bigint, text) from public;
grant execute on function chat_send(uuid, int, text), chat_list(uuid, int, bigint), chat_report(uuid, bigint, text) to anon, authenticated;
