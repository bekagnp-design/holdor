-- ============================================================
--  HOLDOR backend v16 (2026-09-30) — Season Pass, VIP and the rewarded-ad frame (game v1.0.71)
--  Run AFTER holdor_v15.sql and holdor_econ_data.sql (which carries econ_config 'stars' with the SKUs pass and vip). Safe to re-run.
--  * Season = a UTC calendar month (qs_window('monthly')). Points come only from the server's own records: +1 per won stage,
--    +3 per finished Hold run in the season (× 1.25 with VIP, rounded down). Every 10 points open a tier (20 tiers).
--    Each tier has a FREE reward for everybody and a PREMIUM one for the owner of the Pass; claimed once per season.
--  * The Pass (SKU 'pass') and VIP (SKU 'vip', 30 days, buying again adds 30 days) are sold for Telegram Stars through the same payments
--    pipeline (v9). A trigger on payments grants them when a payment turns 'paid' and takes them back when Telegram refunds it;
--    a Pass already owned for this season cannot be bought twice.
--  * VIP: 25 dragonglass a day (vip_claim, once per UTC day) and +25 % season points.
--  * Rewarded ads: only the frame — table ad_views, ad_state for the app, ad_credit for the service role (an Edge Function that
--    checks the ad partner's signed callback will call it). Off until econ_config 'ads'.enabled is true; no ad partner is connected yet.
-- ============================================================
insert into econ_config (k, v) select 'season', jsonb_build_object('per_tier', 10, 'tiers', 20, 'vip_bonus', 25,
  'points', jsonb_build_object('win', 1, 'hold_run', 3),
  'rewards', (select jsonb_agg(jsonb_build_object(
      'free', jsonb_build_object('gold', 200 + 50 * t)
              || case when t % 2 = 0 then '{"gems":5}'::jsonb else '{}'::jsonb end
              || case when t % 5 = 0 then jsonb_build_object('gear', jsonb_build_object('n', 1, 'min_r', least(3, t / 5))) else '{}'::jsonb end
              || case when t = 10 then '{"books":{"b:r":1}}'::jsonb when t = 20 then '{"books":{"b:e":1}}'::jsonb else '{}'::jsonb end,
      'prem', jsonb_build_object('gems', 10 + 2 * t, 'gold', 300 + 100 * t)
              || case when t = 20 then '{"books":{"b:l":1}}'::jsonb when t in (10, 15) then '{"books":{"b:e":1}}'::jsonb when t % 3 = 0 then '{"books":{"b:c":2}}'::jsonb else '{}'::jsonb end
              || case when t = 20 then '{"gear":{"n":2,"min_r":4,"min_tier":4}}'::jsonb when t in (10, 15) then '{"gear":{"n":1,"min_r":3,"min_tier":3}}'::jsonb when t = 5 then '{"gear":{"n":1,"min_r":2,"min_tier":2}}'::jsonb else '{}'::jsonb end
    ) order by t) from generate_series(1, 20) t))
on conflict (k) do update set v = excluded.v;
insert into econ_config (k, v) values ('vip', '{"daily_gems":25,"days":30}'::jsonb) on conflict (k) do update set v = excluded.v;
insert into econ_config (k, v) values ('ads', '{"enabled":false,"per_day":5,"gems":8}'::jsonb) on conflict (k) do nothing;

-- the Pass and VIP as items of the Stars shop (the app's table is the source: holdor_econ_data.sql; this keeps a bare v9 database working too)
update econ_config set v = jsonb_set(jsonb_set(v, '{skus,pass}',
  '{"stars":250,"gems":0,"gold":0,"books":{},"once":false,"grant":"pass","title":"Season Pass","desc":"Premium rewards on every tier of this month''s season, for your seat."}'::jsonb),
  '{skus,vip}', '{"stars":200,"gems":0,"gold":0,"books":{},"once":false,"grant":"vip","days":30,"title":"VIP · 30 days","desc":"25 dragonglass a day and 25% more season points for 30 days, for your seat."}'::jsonb)
 where k = 'stars' and not (v->'skus' ? 'pass');

create table if not exists ad_views (
  nonce text primary key, tg_id bigint not null references players(tg_id) on delete cascade, seat smallint not null,
  provider text not null, at timestamptz not null default now());
create index if not exists ad_views_idx on ad_views (tg_id, seat, at desc);
alter table ad_views enable row level security; revoke all on ad_views from anon, authenticated;

-- points this season
create or replace function se_points(w wallets) returns int language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := econ_cfg('season'); win record; base bigint; vip boolean := coalesce((w.claims->>'vip_until')::timestamptz, 'epoch') > now();
begin
  select * into win from qs_window('monthly');
  base := qs_metric(w.tg_id, w.seat, win.t0, win.t1, 'wins') * ec_i(cfg->'points', 'win') + qs_metric(w.tg_id, w.seat, win.t0, win.t1, 'hold_runs') * ec_i(cfg->'points', 'hold_run');
  return (base * case when vip then 100 + ec_i(cfg, 'vip_bonus') else 100 end / 100)::int;
end $$;

create or replace function se_state(w wallets) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := econ_cfg('season'); win record; pts int := se_points(w); tier int; pass boolean; done jsonb; items jsonb := '[]'::jsonb; r jsonb; t int := 0; vu timestamptz := (w.claims->>'vip_until')::timestamptz;
begin
  select * into win from qs_window('monthly');
  tier := least(ec_i(cfg, 'tiers')::int, pts / ec_i(cfg, 'per_tier')::int);
  pass := coalesce((w.claims->>'pass') = win.k, false);
  done := coalesce(w.claims->'season'->win.k, '{}'::jsonb);
  for r in select x from jsonb_array_elements(cfg->'rewards') x loop
    t := t + 1;
    items := items || jsonb_build_array(jsonb_build_object('t', t, 'free', r->'free', 'prem', r->'prem',
      'free_ok', t <= tier and not coalesce(done->'f', '[]'::jsonb) ? t::text, 'prem_ok', pass and t <= tier and not coalesce(done->'p', '[]'::jsonb) ? t::text,
      'free_done', coalesce(done->'f', '[]'::jsonb) ? t::text, 'prem_done', coalesce(done->'p', '[]'::jsonb) ? t::text));
  end loop;
  return jsonb_build_object('key', win.k, 'left', greatest(0, extract(epoch from win.t1 - now())::int), 'points', pts, 'tier', tier, 'per_tier', ec_i(cfg, 'per_tier'),
    'tiers', ec_i(cfg, 'tiers'), 'pass', pass, 'items', items,
    'vip', jsonb_build_object('active', coalesce(vu, 'epoch') > now(), 'until', vu, 'can', coalesce(vu, 'epoch') > now() and (w.claims->>'vip_day') is distinct from ec_day(),
                              'daily_gems', ec_i(econ_cfg('vip'), 'daily_gems'), 'bonus', ec_i(cfg, 'vip_bonus')));
end $$;

create or replace function season_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  return se_state(w);
end $$;

create or replace function season_claim(token uuid, seat int, tier int, track text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('season'); win record; st jsonb; r jsonb; key text; done jsonb; k text; keep jsonb := '{}'::jsonb; tk text;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  if track not in ('free', 'prem') then raise exception 'bad track'; end if;
  r := cfg->'rewards'->(tier - 1);
  if tier is null or tier < 1 or r is null then raise exception 'no such tier'; end if;
  st := se_state(w);
  if tier > (st->>'tier')::int then raise exception 'tier % is not open yet (% points)', tier, st->>'points'; end if;
  if track = 'prem' and not coalesce((st->>'pass')::boolean, false) then raise exception 'the Season Pass is needed for this reward'; end if;
  select * into win from qs_window('monthly');
  tk := case track when 'free' then 'f' else 'p' end;
  done := coalesce(w.claims->'season'->win.k, '{}'::jsonb);
  if coalesce(done->tk, '[]'::jsonb) ? tier::text then raise exception 'already claimed'; end if;
  w := qs_pay(w, r->track, 'season', win.k || ':' || tier || ':' || track);
  done := jsonb_set(done, array[tk], coalesce(done->tk, '[]'::jsonb) || to_jsonb(tier::text));
  w.claims := jsonb_set(w.claims, '{season}', jsonb_build_object(win.k, done));      -- only this season's claims are kept
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', r->track, 'state', ec_state(w), 'season', se_state(w));
end $$;

create or replace function vip_claim(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; g int := ec_i(econ_cfg('vip'), 'daily_gems')::int;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  if coalesce((w.claims->>'vip_until')::timestamptz, 'epoch') <= now() then raise exception 'no VIP'; end if;
  if (w.claims->>'vip_day') = ec_day() then raise exception 'already claimed today'; end if;
  w := ec_book(w, 'gems', g, 'vip', ec_day());
  w.claims := jsonb_set(w.claims, '{vip_day}', to_jsonb(ec_day()));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', jsonb_build_object('gems', g), 'state', ec_state(w), 'season', se_state(w));
end $$;

-- a payment turns 'paid': the Pass or VIP is granted; 'refunded': taken back
create or replace function pay_grant_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb := econ_cfg('stars')->'skus'->new.sku; w wallets; k text; cur timestamptz; days int;
begin
  if it is null or (it->>'grant') is null then return new; end if;
  select x.k into k from qs_window('monthly') x;
  if new.status = 'paid' and old.status is distinct from 'paid' then
    w := ec_wallet(new.tg_id, new.seat);
    if w.made is distinct from new.made then return new; end if;
    if it->>'grant' = 'pass' then w.claims := jsonb_set(w.claims, '{pass}', to_jsonb(k));
    elsif it->>'grant' = 'vip' then
      cur := greatest(now(), coalesce((w.claims->>'vip_until')::timestamptz, now()));
      w.claims := jsonb_set(w.claims, '{vip_until}', to_jsonb(cur + make_interval(days => coalesce((it->>'days')::int, 30))));
    end if;
    perform ec_save(w);
  elsif new.status = 'refunded' and old.status = 'paid' then
    w := ec_wallet(new.tg_id, new.seat);
    if w.made is distinct from new.made then return new; end if;
    if it->>'grant' = 'pass' and (w.claims->>'pass') = k then w.claims := w.claims - 'pass';
    elsif it->>'grant' = 'vip' and (w.claims->>'vip_until') is not null then
      days := coalesce((it->>'days')::int, 30);
      w.claims := jsonb_set(w.claims, '{vip_until}', to_jsonb(greatest(now(), (w.claims->>'vip_until')::timestamptz - make_interval(days => days))));
    end if;
    perform ec_save(w);
  end if;
  return new;
end $$;
drop trigger if exists payments_grant on payments;
create trigger payments_grant after update of status on payments for each row execute function pay_grant_trg();

-- one Pass per season and seat
create or replace function pay_pass_once() returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb := econ_cfg('stars')->'skus'->new.sku; w wallets; k text;
begin
  if it is null or it->>'grant' is distinct from 'pass' then return new; end if;
  select x.k into k from qs_window('monthly') x;
  w := ec_wallet(new.tg_id, new.seat);
  if (w.claims->>'pass') = k then raise exception 'already bought'; end if;
  return new;
end $$;
drop trigger if exists payments_pass_once on payments;
create trigger payments_pass_once before insert on payments for each row execute function pay_pass_once();

-- rewarded ads: the frame
create or replace function ad_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; cfg jsonb := econ_cfg('ads'); n int;
begin
  pid := ec_session(token);
  perform ec_wallet(pid, seat);
  select count(*) into n from ad_views a where a.tg_id = pid and a.seat = ad_state.seat and a.at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return jsonb_build_object('enabled', coalesce((cfg->>'enabled')::boolean, false), 'left', greatest(0, ec_i(cfg, 'per_day')::int - n), 'gems', ec_i(cfg, 'gems'));
end $$;
-- called by the Edge Function that checked the ad partner's signed callback (service role only)
create or replace function ad_credit(tg bigint, st int, nonce text, provider text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w wallets; cfg jsonb := econ_cfg('ads'); n int;
begin
  if not coalesce((cfg->>'enabled')::boolean, false) then raise exception 'ads are not connected'; end if;
  if nonce is null or length(nonce) < 8 then raise exception 'bad nonce'; end if;
  w := ec_wallet(tg, st);
  select count(*) into n from ad_views a where a.tg_id = tg and a.seat = st and a.at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if n >= ec_i(cfg, 'per_day') then return jsonb_build_object('ok', false, 'why', 'daily limit'); end if;
  insert into ad_views (nonce, tg_id, seat, provider) values (nonce, tg, st, provider) on conflict do nothing;
  if not found then return jsonb_build_object('ok', true, 'dup', true); end if;
  w := ec_book(w, 'gems', ec_i(cfg, 'gems'), 'ad', nonce);
  perform ec_save(w);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function se_points(wallets), se_state(wallets), pay_grant_trg(), pay_pass_once() from public, anon, authenticated;
revoke all on function season_state(uuid, int), season_claim(uuid, int, int, text), vip_claim(uuid, int), ad_state(uuid, int) from public;
grant execute on function season_state(uuid, int), season_claim(uuid, int, int, text), vip_claim(uuid, int), ad_state(uuid, int) to anon, authenticated;
revoke all on function ad_credit(bigint, int, text, text) from public, anon, authenticated;
grant execute on function ad_credit(bigint, int, text, text) to service_role;

create or replace view v_season as
  select p.sku, date_trunc('month', p.paid_at)::date as month, count(*) filter (where p.status = 'paid') as sold, count(*) filter (where p.status = 'refunded') as refunded,
         sum(p.stars) filter (where p.status = 'paid') as stars
    from payments p where p.sku in ('pass', 'vip') group by 1, 2 order by 2 desc, 1;
revoke all on v_season from anon, authenticated;
