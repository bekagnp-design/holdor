-- ============================================================
--  HOLDOR v29 — the schedule of the one-time reminder (run once on Supabase, AFTER holdor_v29.sql, holdor_v28_cron.sql and the
--  new Edge Function). Every hour at :20 the bot writes to at most 50 people who started it 24–72 hours ago and never opened the game.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'holdor-remind';
select cron.schedule('holdor-remind', '20 * * * *', $job$
  select net.http_post(url := 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/stars', headers := '{"Content-Type":"application/json"}'::jsonb,
                       body := jsonb_build_object('op', 'remind', 'code', (select v from public.app_secrets where k = 'digest_code')));
$job$);
