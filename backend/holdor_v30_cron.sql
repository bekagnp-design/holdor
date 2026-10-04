-- ============================================================
--  HOLDOR v30 — the schedule of the "your friend's gift is ready" message (run once on Supabase, AFTER holdor_v30.sql and the
--  new Edge Function). Every hour at :40 the bot writes to at most 50 inviters whose friends have cleared the stages.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'holdor-refgift';
select cron.schedule('holdor-refgift', '40 * * * *', $job$
  select net.http_post(url := 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/stars', headers := '{"Content-Type":"application/json"}'::jsonb,
                       body := jsonb_build_object('op', 'refgift', 'code', (select v from public.app_secrets where k = 'digest_code')));
$job$);
