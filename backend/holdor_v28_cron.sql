-- ============================================================
--  HOLDOR v28 — the schedule of the channel digests (run once on Supabase, AFTER holdor_v28.sql and after the channels are set:
--    insert into app_secrets (k, v) values ('channel_en', '@holdor_news'), ('channel_ka', '@holdor_ge') on conflict (k) do update set v = excluded.v;
--  and the bot is an admin of both channels). Not part of the local test chain (pg_cron / pg_net live on Supabase).
--  Every day 06:05 UTC: yesterday's Hold top-10. Every Monday 06:10 UTC: last week's realm war. Safe to re-run (it replaces the jobs).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(j.jobid) from cron.job j where j.jobname in ('holdor-digest-day', 'holdor-digest-war');
select cron.schedule('holdor-digest-day', '5 6 * * *', $job$
  select net.http_post(url := 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/stars', headers := '{"Content-Type":"application/json"}'::jsonb,
                       body := jsonb_build_object('op', 'digest', 'kind', 'day', 'code', (select v from public.app_secrets where k = 'digest_code')));
$job$);
select cron.schedule('holdor-digest-war', '10 6 * * 1', $job$
  select net.http_post(url := 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/stars', headers := '{"Content-Type":"application/json"}'::jsonb,
                       body := jsonb_build_object('op', 'digest', 'kind', 'war', 'code', (select v from public.app_secrets where k = 'digest_code')));
$job$);
