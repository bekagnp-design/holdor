-- ============================================================
--  HOLDOR backend v9 (2026-09-29) — Telegram Stars payments (game v1.0.60)
--  Run AFTER holdor_v8.sql and holdor_econ_data.sql (which now carries econ_config 'stars': the items and their prices). Safe to re-run.
--  Money only moves here, on Telegram's word. The app asks for an invoice (Edge Function `stars`); Telegram takes the Stars and tells
--  the function (pre_checkout_query, successful_payment); the function calls these functions with the service key. The app never
--  credits anything: it waits until the server says "paid" and then reads its balance.
--  * payments: one row per invoice (pending → paid | failed | orphan | refunded), the Telegram charge id is unique (a payment counts once).
--  * pay_create / pay_precheck / pay_confirm / pay_refund / pay_secret: service role only.
--  * pay_shop / pay_status: the app reads them with its session token.
--  * A payment that does not match (wrong payer, wrong amount, a seat that has been replaced) is not credited: it is marked and goes to
--    econ_flags, and Stars are given back by hand (refundStarPayment). A refund takes back what is still in the wallet.
--  * v_revenue: the owner's dashboard (no app access).
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;   -- Supabase has it; only for the local copy
end $$;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null, made text not null,
  sku text not null, stars int not null check (stars > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'orphan', 'refunded')),
  charge_id text unique,
  created_at timestamptz not null default now(), paid_at timestamptz, refunded_at timestamptz);
create index if not exists payments_seat_idx on payments (tg_id, seat, status);
alter table payments enable row level security;
revoke all on payments from anon, authenticated;

-- the secrets the function needs (the bot token stays in app_secrets; only the function may read it)
insert into app_secrets (k, v) values
  ('webhook_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('setup_code', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (k) do nothing;
create or replace function pay_secret(k text) returns text language sql stable security definer set search_path = public as $$
  select s.v from app_secrets s where s.k = pay_secret.k and s.k in ('bot_token', 'webhook_secret', 'setup_code') $$;
create or replace function pay_setup_done() returns void language sql security definer set search_path = public as $$
  delete from app_secrets where k = 'setup_code' $$;

-- an invoice for one item on one seat
create or replace function pay_create(token uuid, seat int, sku text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; it jsonb := econ_cfg('stars')->'skus'->sku; pid2 uuid; n int;
begin
  pid := ec_session(token);
  if it is null then raise exception 'bad item'; end if;
  w := ec_wallet(pid, seat);
  if coalesce((it->>'once')::boolean, false) and exists (select 1 from payments p where p.tg_id = pid and p.seat = pay_create.seat and p.made = w.made and p.sku = pay_create.sku and p.status = 'paid') then
    raise exception 'already bought'; end if;
  select count(*) into n from payments p where p.tg_id = pid and p.status = 'pending' and p.created_at > now() - interval '1 hour';
  if n >= 20 then raise exception 'too many open invoices'; end if;
  insert into payments (tg_id, seat, made, sku, stars) values (pid, pay_create.seat, w.made, pay_create.sku, (it->>'stars')::int) returning id into pid2;
  return jsonb_build_object('id', pid2, 'sku', sku, 'stars', (it->>'stars')::int, 'title', it->>'title', 'description', it->>'desc');
end $$;

-- Telegram asks "may I take the Stars?" — yes only for an open invoice of this payer, this amount, in Stars
create or replace function pay_precheck(id uuid, tg bigint, stars int, currency text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p payments; it jsonb;
begin
  select * into p from payments x where x.id = pay_precheck.id;
  if not found then
    insert into econ_flags (tg_id, kind, detail) values (tg, 'pay_unknown', jsonb_build_object('id', id, 'stars', stars));
    return jsonb_build_object('ok', false, 'why', 'unknown order'); end if;
  if p.tg_id <> tg or p.stars <> stars or currency <> 'XTR' then
    insert into econ_flags (tg_id, seat, kind, detail) values (p.tg_id, p.seat, 'pay_mismatch', jsonb_build_object('id', id, 'payer', tg, 'stars', stars, 'currency', currency, 'expected', p.stars));
    return jsonb_build_object('ok', false, 'why', 'order does not match'); end if;
  if p.status <> 'pending' then return jsonb_build_object('ok', false, 'why', 'order is closed'); end if;
  it := econ_cfg('stars')->'skus'->p.sku;
  if it is null then return jsonb_build_object('ok', false, 'why', 'item gone'); end if;
  if coalesce((it->>'once')::boolean, false) and exists (select 1 from payments q where q.tg_id = p.tg_id and q.seat = p.seat and q.made = p.made and q.sku = p.sku and q.status = 'paid') then
    return jsonb_build_object('ok', false, 'why', 'already bought'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- the Stars are taken: credit the seat once (the charge id is unique, a repeated message changes nothing)
create or replace function pay_confirm(id uuid, tg bigint, stars int, currency text, charge text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p payments; w wallets; it jsonb := null; b record; g bigint; m bigint;
begin
  if charge is null or charge = '' then raise exception 'no charge id'; end if;
  select * into p from payments x where x.id = pay_confirm.id for update;
  if not found then
    insert into econ_flags (tg_id, kind, detail) values (tg, 'pay_unknown', jsonb_build_object('id', id, 'stars', stars, 'charge', charge));
    return jsonb_build_object('ok', false, 'why', 'unknown order'); end if;
  if p.status = 'paid' and p.charge_id = charge then return jsonb_build_object('ok', true, 'dup', true); end if;
  if p.status <> 'pending' or exists (select 1 from payments q where q.charge_id = charge) then
    insert into econ_flags (tg_id, seat, kind, detail) values (p.tg_id, p.seat, 'pay_repeat', jsonb_build_object('id', id, 'charge', charge, 'status', p.status));
    return jsonb_build_object('ok', false, 'why', 'order is closed'); end if;
  if p.tg_id <> tg or p.stars <> stars or currency <> 'XTR' then
    update payments set status = 'failed', charge_id = charge where payments.id = p.id;
    insert into econ_flags (tg_id, seat, kind, detail) values (p.tg_id, p.seat, 'pay_mismatch', jsonb_build_object('id', id, 'payer', tg, 'stars', stars, 'currency', currency, 'expected', p.stars, 'charge', charge));
    return jsonb_build_object('ok', false, 'why', 'order does not match'); end if;
  it := econ_cfg('stars')->'skus'->p.sku;
  w := ec_wallet(p.tg_id, p.seat);
  if it is null or w.made <> p.made then     -- the item is gone or another seat now sits in this place: nothing is credited, the owner refunds the Stars
    update payments set status = 'orphan', charge_id = charge where payments.id = p.id;
    insert into econ_flags (tg_id, seat, kind, detail) values (p.tg_id, p.seat, 'pay_orphan', jsonb_build_object('id', id, 'sku', p.sku, 'charge', charge, 'stars', stars));
    return jsonb_build_object('ok', false, 'why', 'orphan'); end if;
  if ec_i(it, 'gems') > 0 then w := ec_book(w, 'gems', ec_i(it, 'gems'), 'stars', charge); end if;
  if ec_i(it, 'gold') > 0 then w := ec_book(w, 'gold', ec_i(it, 'gold'), 'stars', charge); end if;
  for b in select e.key as k, jint(e.value #>> '{}') as n from jsonb_each(coalesce(it->'books', '{}'::jsonb)) e loop
    if split_part(b.k, ':', 1) = 'b' and b.n > 0 then w := ec_cards(w, b.k, b.n::int); end if;
  end loop;
  perform ec_save(w);
  update payments set status = 'paid', charge_id = charge, paid_at = now() where payments.id = p.id;
  return jsonb_build_object('ok', true, 'sku', p.sku);
end $$;

-- Telegram gave the Stars back: what the seat still holds of the item is taken back (never below zero)
create or replace function pay_refund(charge text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p payments; w wallets; it jsonb; g bigint; d bigint;
begin
  select * into p from payments x where x.charge_id = charge for update;
  if not found then
    insert into econ_flags (kind, detail) values ('pay_refund_unknown', jsonb_build_object('charge', charge));
    return jsonb_build_object('ok', false); end if;
  if p.status = 'refunded' then return jsonb_build_object('ok', true, 'dup', true); end if;
  if p.status = 'paid' then
    it := econ_cfg('stars')->'skus'->p.sku;
    w := ec_wallet(p.tg_id, p.seat);
    if it is not null and w.made = p.made then
      d := least(ec_i(it, 'gems'), w.gems);  if d > 0 then w := ec_book(w, 'gems', -d, 'stars_refund', charge); end if;
      d := least(ec_i(it, 'gold'), w.gold);  if d > 0 then w := ec_book(w, 'gold', -d, 'stars_refund', charge); end if;
      perform ec_save(w);
    end if;
  end if;
  update payments set status = 'refunded', refunded_at = now() where payments.id = p.id;
  insert into econ_flags (tg_id, seat, kind, detail) values (p.tg_id, p.seat, 'pay_refunded', jsonb_build_object('id', p.id, 'sku', p.sku, 'charge', charge, 'was', p.status));
  return jsonb_build_object('ok', true);
end $$;

-- what the app reads: is the Starter pack already bought on this seat, and the state of one invoice
create or replace function pay_shop(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  return jsonb_build_object('starter', exists (select 1 from payments p where p.tg_id = pid and p.seat = pay_shop.seat and p.made = w.made and p.sku = 'starter' and p.status = 'paid'));
end $$;
create or replace function pay_status(token uuid, id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; p payments;
begin
  pid := ec_session(token);
  select * into p from payments x where x.id = pay_status.id and x.tg_id = pid;
  if not found then raise exception 'no order'; end if;
  return jsonb_build_object('status', p.status);
end $$;

-- the owner's dashboard: paid orders per UTC day and item (the Stars the player paid, not what Telegram pays out)
create or replace view v_revenue as
  select (p.paid_at at time zone 'utc')::date as day, p.sku, count(*) as orders, sum(p.stars) as stars, count(distinct p.tg_id) as payers
    from payments p where p.status = 'paid' group by 1, 2 order by 1 desc, 2;
revoke all on v_revenue from anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['pay_secret(text)', 'pay_setup_done()', 'pay_create(uuid,integer,text)', 'pay_precheck(uuid,bigint,integer,text)',
                           'pay_confirm(uuid,bigint,integer,text,text)', 'pay_refund(text)', 'pay_shop(uuid,integer)', 'pay_status(uuid,uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function pay_secret(text), pay_setup_done(), pay_create(uuid, int, text), pay_precheck(uuid, bigint, int, text),
                          pay_confirm(uuid, bigint, int, text, text), pay_refund(text) to service_role;
grant execute on function pay_shop(uuid, int), pay_status(uuid, uuid) to anon, authenticated, service_role;
