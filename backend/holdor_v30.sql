-- ============================================================
--  HOLDOR backend v30 (2026-10-04) — the bot tells an inviter that a friend's gift is ready
--  Run AFTER holdor_v29.sql. Safe to re-run. The schedule is holdor_v30_cron.sql (Supabase only).
--  When a friend who joined by your link (referrals, v14) has cleared the `need` stages, your gift for him can be claimed (ref_claim).
--  Once an hour the schedule asks for those friends; the inviter gets ONE message per run (all his ready friends by name, a ▶ Play button)
--  and each friend is marked, so nobody is written to twice about the same friend. Already claimed gifts are not announced. An inviter who
--  blocked the bot (bot_starts.blocked, v29) is skipped and the friend marked. Only the service key may call these; the app sees nothing.
-- ============================================================
alter table referrals add column if not exists notified_at timestamptz;

create or replace function bot_ref_due(lim int default 50) returns jsonb language sql stable security definer set search_path = public as $$
  with ready as (
    select r.inviter, r.invitee, r.created_at, p.name from referrals r join players p on p.tg_id = r.invitee
     where r.notified_at is null and not r.inviter_paid
       and ref_stages(r.invitee) >= ec_i(econ_cfg('referral'), 'need')
       and not exists (select 1 from bot_starts s where s.tg_id = r.inviter and s.blocked)),
  per as (
    select x.inviter, jsonb_agg(x.invitee order by x.created_at) as friends,
           jsonb_agg(coalesce(nullif(left(regexp_replace(x.name, '[\r\n\t]+', ' ', 'g'), 24), ''), 'a friend') order by x.created_at) as names,
           min(x.created_at) as t0
      from ready x group by x.inviter order by min(x.created_at) limit greatest(1, least(coalesce(lim, 50), 200)))
  select coalesce(jsonb_agg(jsonb_build_object('tg', per.inviter, 'lang', coalesce((select s.lang from bot_starts s where s.tg_id = per.inviter), 'en'),
                                               'friends', per.friends, 'names', per.names) order by per.t0), '[]'::jsonb)
    from per;
$$;

-- after the message (or when the inviter blocked the bot): these friends are never announced again
create or replace function bot_ref_notified(tg bigint, friends bigint[], blocked boolean default false) returns void language plpgsql security definer set search_path = public as $$
begin
  update referrals set notified_at = now() where inviter = tg and invitee = any(friends) and notified_at is null;
  if blocked then
    update bot_starts set blocked = true where tg_id = tg;   -- only someone who started the bot has a row; no new row is made here
  end if;
end $$;

revoke all on function bot_ref_due(int), bot_ref_notified(bigint, bigint[], boolean) from public, anon, authenticated;
grant execute on function bot_ref_due(int), bot_ref_notified(bigint, bigint[], boolean) to service_role;
