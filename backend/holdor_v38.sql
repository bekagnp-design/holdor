-- ============================================================
--  HOLDOR backend v38 (2026-10-30) — Trials rewards for server-managed seats (game v1.4.1)
--  Run AFTER holdor_v37.sql. Safe to re-run. Additive: no existing function is replaced.
--  trials_start(token, seat)        stamps the start of a run (wallets.claims.trials.start)
--  trials_claim(token, seat, waves) books a SMALL reward for the run that was started: gold per wave held and a wooden chest per 5 waves.
--  Chests are not an inventory on the server (chest_open rolls and books at once), so the claim rolls the wooden chest itself from
--  econ_config 'chests'->'wood' (gold + dragonglass; no cards) and books it as 'trials' / 'chest' in the ledger.
--  Bounds (econ_config 'trials'): waves capped at 60; a run of N waves needs N*20 s since trials_start; one claim per start;
--  one claim per UTC hour and at least 5 minutes between claims; a daily cap on gold (wave gold + chest gold); starts at least 10 s apart.
-- ============================================================
insert into econ_config (k, v) values ('trials', '{"gold_per_wave":12,"max_waves":60,"chest_every":5,"max_chests":4,"secs_per_wave":20,"min_gap_s":300,"start_gap_s":10,"day_gold":600}'::jsonb)
  on conflict (k) do update set v = excluded.v;

create or replace function trials_start(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('trials'); t jsonb; st timestamptz;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  t := coalesce(w.claims->'trials', '{}'::jsonb);
  st := (t->>'start')::timestamptz;
  if st is not null and extract(epoch from now() - st) < ec_i(cfg, 'start_gap_s') then raise exception 'wait a little before a new run'; end if;
  t := jsonb_set(t, '{start}', to_jsonb(now()));
  w.claims := jsonb_set(w.claims, '{trials}', t);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'at', now());
end $$;

create or replace function trials_claim(token uuid, seat int, waves int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('trials'); wc jsonb := econ_cfg('chests')->'wood'; t jsonb; st timestamptz; lc timestamptz;
        n int; need numeric; today text := ec_day(); used bigint; room bigint; base bigint; nch int; i int; g int; m int; cg bigint := 0; cm bigint := 0; opened int := 0; granted bigint;
begin
  pid := ec_session(token); w := ec_wallet(pid, seat);
  if waves is null or waves < 1 then raise exception 'no waves to claim'; end if;
  n := least(waves, ec_i(cfg, 'max_waves')::int);
  t := coalesce(w.claims->'trials', '{}'::jsonb);
  st := (t->>'start')::timestamptz;
  if st is null then raise exception 'no run was started'; end if;
  need := n * ec_i(cfg, 'secs_per_wave');
  if extract(epoch from now() - st) < need then raise exception 'the run was too short for % waves', n; end if;
  lc := (t->>'last')::timestamptz;
  if lc is not null then
    if extract(epoch from now() - lc) < ec_i(cfg, 'min_gap_s') then raise exception 'a claim was made a moment ago'; end if;
    if date_trunc('hour', lc at time zone 'utc') = date_trunc('hour', now() at time zone 'utc') then raise exception 'one claim per hour'; end if;
  end if;
  used := case when t->>'d' = today then ec_i(t, 'g') else 0 end;
  room := ec_i(cfg, 'day_gold') - used;
  if room <= 0 then raise exception 'the daily Trials reward is used up'; end if;
  base := least(n * ec_i(cfg, 'gold_per_wave'), room);
  w := ec_book(w, 'gold', base, 'trials', 'waves:' || n);
  room := room - base;
  nch := least(n / ec_i(cfg, 'chest_every')::int, ec_i(cfg, 'max_chests')::int);
  for i in 1 .. nch loop
    exit when room < jint(wc->'gold'->>0);
    g := jint(wc->'gold'->>0) + floor(random() * (least(jint(wc->'gold'->>1), room) - jint(wc->'gold'->>0) + 1))::int;
    m := jint(wc->'gems'->>0) + floor(random() * (jint(wc->'gems'->>1) - jint(wc->'gems'->>0) + 1))::int;
    w := ec_book(w, 'gold', g, 'trials', 'chest');
    w := ec_book(w, 'gems', m, 'trials', 'chest');
    cg := cg + g; cm := cm + m; room := room - g; opened := opened + 1;
  end loop;
  granted := base + cg;
  t := jsonb_build_object('last', now(), 'd', today, 'g', used + granted);   -- the start is spent: one claim per run
  w.claims := jsonb_set(w.claims, '{trials}', t);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'waves', n, 'gold', base, 'chests', opened, 'chest_gold', cg, 'chest_gems', cm,
                            'day_left', ec_i(cfg, 'day_gold') - used - granted, 'state', ec_state(w));
end $$;

revoke all on function trials_start(uuid, int), trials_claim(uuid, int, int) from public;
grant execute on function trials_start(uuid, int), trials_claim(uuid, int, int) to anon, authenticated;
