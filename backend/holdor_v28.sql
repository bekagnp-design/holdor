-- ============================================================
--  HOLDOR backend v28 (2026-10-04) — the channel digests (the bot posts real results into the Telegram channels)
--  Run AFTER holdor_v27.sql. Safe to re-run. The schedule (pg_cron + pg_net) is a separate file, holdor_v28_cron.sql.
--  bot_digest(kind, lang) builds the text of one post from the database, nothing invented:
--    'day' — yesterday's (UTC) Hold top-10: name and waves;
--    'war' — last week's realm war: the top 3 countries with their score and players, and how many countries fought.
--  Only the Edge Function `stars` (the service key) may call it; it sends the text as plain text (no markup) to the channels named in
--  app_secrets ('channel_en', 'channel_ka': a @username or a numeric chat id — not secrets, but kept with the bot's settings), when
--  the call carries the code in app_secrets 'digest_code'. pay_secret may now read those three keys too (and still nothing else).
-- ============================================================
insert into app_secrets (k, v) values ('digest_code', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (k) do nothing;

create or replace function pay_secret(k text) returns text language sql stable security definer set search_path = public as $$
  select s.v from app_secrets s where s.k = pay_secret.k and s.k in ('bot_token', 'webhook_secret', 'setup_code', 'digest_code', 'channel_en', 'channel_ka') $$;

create or replace function bot_digest(kind text, lang text default 'en') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ka boolean := lang = 'ka'; d date := (now() at time zone 'utc')::date - 1; w0 date := date_trunc('week', (now() at time zone 'utc'))::date - 7;
        body text; n int; link text := 'https://t.me/HoldorTDBot/play?startapp=' || case when lang = 'ka' then 's_ka' else 's_tg' end;
begin
  if kind = 'day' then
    select string_agg(format('%s. %s — %s 🌊', t.rn, t.nm, t.waves), E'\n' order by t.rn), count(*) into body, n from (
      select row_number() over (order by x.waves desc, x.kills desc, x.updated_at) as rn, coalesce(nullif(btrim(x.name), ''), 'Defender') as nm, x.waves
        from daily_scores x where x.day = d and x.waves > 0 order by x.waves desc, x.kills desc, x.updated_at limit 10) t;
    if coalesce(n, 0) = 0 then return jsonb_build_object('ok', false, 'why', 'no Hold runs yesterday'); end if;
    return jsonb_build_object('ok', true, 'text',
      case when ka then '⚔️ გუშინდელი Hold-ის ტოპ-' || n || ' (' || to_char(d, 'DD.MM') || E')\n\n' || body || E'\n\nდღეს შენი ჯერია ▶ ' || link
           else '⚔️ Yesterday''s Hold top-' || n || ' (' || to_char(d, 'Mon DD') || E')\n\n' || body || E'\n\nYour turn today ▶ ' || link end);
  elsif kind = 'war' then
    select string_agg(format('%s %s — %s (%s %s)', case r.pos when 1 then '🥇' when 2 then '🥈' else '🥉' end, realm_name(r.realm), regexp_replace(r.score::text, '\.0$', ''),
                             r.players, case when ka then 'მოთამაშე' when r.players = 1 then 'player' else 'players' end), E'\n' order by r.pos)
      into body from realm_war_rows_at(w0) r where r.pos <= 3;
    select count(*) into n from realm_war_rows_at(w0);
    if coalesce(n, 0) = 0 then return jsonb_build_object('ok', false, 'why', 'no realm fought last week'); end if;
    return jsonb_build_object('ok', true, 'text',
      case when ka then '🏆 ქვეყნების ომი, კვირა ' || to_char(w0, 'DD.MM') || E'\n\n' || body || E'\n\nიბრძოდა ' || n || E' ქვეყანა. ახალი კვირა დაიწყო — შენი ქვეყნისთვის ▶ ' || link
           else '🏆 Realm war, week of ' || to_char(w0, 'Mon DD') || E'\n\n' || body || E'\n\n' || n || ' ' || case when n = 1 then 'country' else 'countries' end || E' fought. A new week has begun — fight for yours ▶ ' || link end);
  end if;
  raise exception 'bad digest';
end $$;
revoke all on function bot_digest(text, text), pay_secret(text) from public, anon, authenticated;
grant execute on function bot_digest(text, text), pay_secret(text) to service_role;
