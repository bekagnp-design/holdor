-- ============================================================
--  HOLDOR backend v17 (2026-09-30) — where players come from, and whether they stay (game v1.0.72, the marketing version)
--  Run AFTER holdor_v16.sql. Safe to re-run.
--  * players.src: the first source a player arrived from (the `startapp=s_<code>` of a link; players brought by an invitation get 'ref').
--    Set once, only for a player who is still new (made less than 2 days ago); the app calls src_set after login.
--  * Owner views (no app access), all from the server's own records: v_sources (players, reached stage 5, payers, Stars per source),
--    v_retention (D1 / D7 / D30 by first-play day: a player counts as back on day N when a battle of his ended that day),
--    v_funnel (from arrival to first stage, 5 stages, first payment).
-- ============================================================
alter table players add column if not exists src text;
create or replace function src_set(token uuid, code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; c text := lower(trim(coalesce(code, '')));
begin
  pid := ec_session(token);
  if c !~ '^[a-z0-9_]{2,16}$' then return jsonb_build_object('ok', false); end if;
  update players p set src = c where p.tg_id = pid and p.src is null and p.created_at > now() - interval '2 days';
  return jsonb_build_object('ok', found);
end $$;
revoke all on function src_set(uuid, text) from public;
grant execute on function src_set(uuid, text) to anon, authenticated;

-- a player who joined through an invitation is a 'ref' player (unless a source was already set)
create or replace function ref_src_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update players p set src = 'ref' where p.tg_id = new.invitee and p.src is null;
  return new;
end $$;
drop trigger if exists referrals_src on referrals;
create trigger referrals_src after insert on referrals for each row execute function ref_src_trg();
revoke all on function ref_src_trg() from public, anon, authenticated;

create or replace view v_sources as
  select coalesce(p.src, 'direct') as source, count(*) as players,
         count(*) filter (where ref_stages(p.tg_id) >= 1) as first_stage,
         count(*) filter (where ref_stages(p.tg_id) >= 5) as reached_5,
         count(distinct pay.tg_id) as payers, coalesce(sum(pay.stars), 0) as stars,
         round(coalesce(sum(pay.stars), 0)::numeric / nullif(count(*), 0), 2) as stars_per_player
    from players p left join payments pay on pay.tg_id = p.tg_id and pay.status = 'paid'
   group by 1 order by 2 desc;
revoke all on v_sources from anon, authenticated;

create or replace view v_retention as
  with cohort as (select p.tg_id, p.created_at::date as day from players p),
       act as (select distinct b.tg_id, b.finished_at::date as d from battles b where b.finished_at is not null and b.status in ('won', 'lost', 'done'))
  select c.day, count(*) as players,
         count(*) filter (where exists (select 1 from act a where a.tg_id = c.tg_id and a.d = c.day)) as day0,
         count(*) filter (where exists (select 1 from act a where a.tg_id = c.tg_id and a.d = c.day + 1)) as d1,
         count(*) filter (where exists (select 1 from act a where a.tg_id = c.tg_id and a.d = c.day + 7)) as d7,
         count(*) filter (where exists (select 1 from act a where a.tg_id = c.tg_id and a.d = c.day + 30)) as d30
    from cohort c group by c.day order by c.day desc;
revoke all on v_retention from anon, authenticated;

create or replace view v_funnel as
  select count(*) as arrived,
         count(*) filter (where ref_stages(p.tg_id) >= 1) as first_stage,
         count(*) filter (where ref_stages(p.tg_id) >= 5) as five_stages,
         count(*) filter (where ref_stages(p.tg_id) >= 20) as twenty_stages,
         count(*) filter (where exists (select 1 from payments y where y.tg_id = p.tg_id and y.status = 'paid')) as paid
    from players p;
revoke all on v_funnel from anon, authenticated;
