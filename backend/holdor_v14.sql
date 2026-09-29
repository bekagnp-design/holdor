-- ============================================================
--  HOLDOR backend v14 (2026-09-30) — invitations (game v1.0.65)
--  Run AFTER holdor_v13.sql. Safe to re-run.
--  * Every player has a short invite code (players.ref_code). A new player who opens the game from an invite link joins with ref_join.
--  * When the invited player has cleared 5 campaign stages, BOTH sides can claim a gift (ref_claim): the inviter's gift per friend, the
--    friend's own once. Gifts are paid by the server (qs_pay, reason 'referral'); there is no percentage of anyone's purchases.
--  * A player can be invited once, only while new (no stage cleared yet) and not by himself; one inviter is paid for at most `cap` friends.
--  * econ_config 'referral': need (stages), cap, inviter gift, invitee gift.
-- ============================================================
alter table players add column if not exists ref_code text;
update players set ref_code = substr(md5(random()::text || tg_id::text), 1, 8) where ref_code is null;
alter table players alter column ref_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 8);
create unique index if not exists players_ref_code_idx on players (ref_code);

create table if not exists referrals (
  invitee bigint primary key references players(tg_id) on delete cascade,
  inviter bigint not null references players(tg_id) on delete cascade,
  created_at timestamptz not null default now(),
  inviter_paid boolean not null default false, invitee_paid boolean not null default false,
  check (invitee <> inviter));
create index if not exists referrals_inviter_idx on referrals (inviter);
alter table referrals enable row level security;
revoke all on referrals from anon, authenticated;

insert into econ_config (k, v) values ('referral', '{"need":5,"cap":20,"inviter":{"gems":60,"books":{"b:r":1}},"invitee":{"gems":100,"gold":2000}}'::jsonb)
on conflict (k) do update set v = excluded.v;

-- the most campaign stages this player has cleared on any of his seats
create or replace function ref_stages(pid bigint) returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(c), 0)::int from (select count(*) as c from progress p where p.tg_id = pid and p.mode = 'c' group by p.seat) x $$;

create or replace function ref_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; cfg jsonb := econ_cfg('referral'); need int; me record; inv jsonb; mine jsonb := null; paid int;
begin
  pid := ec_session(token);
  perform ec_wallet(pid, seat);
  need := ec_i(cfg, 'need')::int;
  select p.ref_code into me from players p where p.tg_id = pid;
  select coalesce(jsonb_agg(jsonb_build_object('who', r.invitee, 'name', p.name, 'stages', least(need, ref_stages(r.invitee)), 'done', ref_stages(r.invitee) >= need, 'claimed', r.inviter_paid) order by r.created_at), '[]'::jsonb)
    into inv from referrals r join players p on p.tg_id = r.invitee where r.inviter = pid;
  select jsonb_build_object('name', p.name, 'stages', least(need, ref_stages(pid)), 'done', ref_stages(pid) >= need, 'claimed', r.invitee_paid) into mine
    from referrals r join players p on p.tg_id = r.inviter where r.invitee = pid;
  select count(*) into paid from referrals r where r.inviter = pid and r.inviter_paid;
  return jsonb_build_object('code', me.ref_code, 'need', need, 'cap', ec_i(cfg, 'cap'), 'paid', paid, 'inviter_gift', cfg->'inviter', 'invitee_gift', cfg->'invitee', 'invited', inv, 'mine', mine);
end $$;

-- the new player joins through a friend's code (once, only while new)
create or replace function ref_join(token uuid, code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; inv bigint;
begin
  pid := ec_session(token);
  select p.tg_id into inv from players p where p.ref_code = lower(trim(code));
  if inv is null then raise exception 'no such invitation'; end if;
  if inv = pid then raise exception 'not your own invitation'; end if;
  if exists (select 1 from referrals r where r.invitee = pid) then raise exception 'already invited'; end if;
  if ref_stages(pid) > 0 or exists (select 1 from battles b where b.tg_id = pid and b.status in ('won', 'lost')) then raise exception 'only a new player can join'; end if;
  insert into referrals (invitee, inviter) values (pid, inv);
  return jsonb_build_object('ok', true, 'by', (select p.name from players p where p.tg_id = inv));
end $$;

-- a gift: other = null → the friend's own gift (I was invited); other = a friend's id → my gift for that friend
create or replace function ref_claim(token uuid, seat int, other bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('referral'); r referrals; gift jsonb; n int;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  if other is null then
    select * into r from referrals x where x.invitee = pid for update;
    if not found then raise exception 'you were not invited'; end if;
    if r.invitee_paid then raise exception 'already claimed'; end if;
    if ref_stages(pid) < ec_i(cfg, 'need') then raise exception 'clear % stages first', ec_i(cfg, 'need'); end if;
    gift := cfg->'invitee';
    update referrals x set invitee_paid = true where x.invitee = pid;
    w := qs_pay(w, gift, 'referral', 'invitee');
  else
    select * into r from referrals x where x.invitee = other and x.inviter = pid for update;
    if not found then raise exception 'not your friend'; end if;
    if r.inviter_paid then raise exception 'already claimed'; end if;
    if ref_stages(other) < ec_i(cfg, 'need') then raise exception 'your friend has not cleared % stages yet', ec_i(cfg, 'need'); end if;
    select count(*) into n from referrals x where x.inviter = pid and x.inviter_paid;
    if n >= ec_i(cfg, 'cap') then raise exception 'the limit of % rewarded friends is reached', ec_i(cfg, 'cap'); end if;
    gift := cfg->'inviter';
    update referrals x set inviter_paid = true where x.invitee = other;
    w := qs_pay(w, gift, 'referral', other::text);
  end if;
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', gift, 'state', ec_state(w), 'friends', ref_state(token, seat));
end $$;

-- the owner's dashboard: invitations, and how many reached the goal
create or replace view v_referrals as
  select date_trunc('day', r.created_at)::date as day, count(*) as invited, count(*) filter (where ref_stages(r.invitee) >= 5) as reached_goal,
         count(*) filter (where r.inviter_paid) as inviter_paid, count(*) filter (where r.invitee_paid) as invitee_paid
    from referrals r group by 1 order by 1 desc;
revoke all on v_referrals from anon, authenticated;

revoke all on function ref_stages(bigint) from public, anon, authenticated;
revoke all on function ref_state(uuid, int), ref_join(uuid, text), ref_claim(uuid, int, bigint) from public;
grant execute on function ref_state(uuid, int), ref_join(uuid, text), ref_claim(uuid, int, bigint) to anon, authenticated;
