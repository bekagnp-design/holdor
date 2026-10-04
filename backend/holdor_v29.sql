-- ============================================================
--  HOLDOR backend v29 (2026-10-04) — one reminder for those who pressed /start but never opened the game
--  Run AFTER holdor_v28.sql. Safe to re-run. The schedule is holdor_v29_cron.sql (Supabase only).
--  The bot (Edge Function `stars`) notes every /start in a private chat: bot_seen(tg, lang, start). Once an hour the schedule asks for
--  the people who started the bot 24–72 hours ago, never opened the game (no `players` row: opening it inside Telegram signs you in),
--  and were never reminded; each gets ONE message with a ▶ Play button, and is marked. Someone who blocked the bot is marked too and
--  never written to again. Only the service key may call these; the app sees nothing of it.
-- ============================================================
create table if not exists bot_starts (
  tg_id bigint primary key, lang text, start text, first_at timestamptz not null default now(), last_at timestamptz not null default now(),
  reminded_at timestamptz, blocked boolean not null default false);
alter table bot_starts enable row level security;

create or replace function bot_seen(tg bigint, lang text default null, start text default null) returns void language sql security definer set search_path = public as $$
  insert into bot_starts as b (tg_id, lang, start) values (tg, left(lang, 8), left(start, 64))
  on conflict (tg_id) do update set last_at = now(), lang = coalesce(excluded.lang, b.lang);
$$;

create or replace function bot_remind_due(lim int default 50) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('tg', b.tg_id, 'lang', coalesce(b.lang, 'en')) order by b.first_at), '[]'::jsonb) from (
    select * from bot_starts s
     where s.reminded_at is null and not s.blocked
       and s.first_at < now() - interval '24 hours' and s.first_at > now() - interval '72 hours'
       and not exists (select 1 from players p where p.tg_id = s.tg_id)
     order by s.first_at limit greatest(1, least(coalesce(lim, 50), 200))) b;
$$;

create or replace function bot_reminded(tg bigint, blocked boolean default false) returns void language sql security definer set search_path = public as $$
  update bot_starts set reminded_at = now(), blocked = bot_starts.blocked or bot_reminded.blocked where tg_id = tg;
$$;

revoke all on function bot_seen(bigint, text, text), bot_remind_due(int), bot_reminded(bigint, boolean) from public, anon, authenticated;
grant execute on function bot_seen(bigint, text, text), bot_remind_due(int), bot_reminded(bigint, boolean) to service_role;

-- the owner's view: how many started the bot, how many opened the game, how many were reminded and came back
create or replace view v_bot_starts as
  select date_trunc('day', s.first_at)::date as day, count(*) as started,
         count(*) filter (where exists (select 1 from players p where p.tg_id = s.tg_id)) as opened,
         count(*) filter (where s.reminded_at is not null) as reminded,
         count(*) filter (where s.reminded_at is not null and exists (select 1 from players p where p.tg_id = s.tg_id and p.created_at > s.reminded_at)) as came_back,
         count(*) filter (where s.blocked) as blocked
    from bot_starts s group by 1 order by 1 desc;
revoke all on v_bot_starts from anon, authenticated;
