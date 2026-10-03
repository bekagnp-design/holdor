-- ============================================================
--  DRAFT (paused 2026-10-03 at the owner's word): not applied, not in run_all.sh, untested end to end. Do not apply before the Tasks client exists.
--  HOLDOR backend v20 (2026-10-03) — Tasks instead of the estate (game v1.0.76)
--  Run AFTER holdor_v19.sql. Safe to re-run.
--  * Tasks: one-time jobs with a gift, in three kinds.
--      link   — open a link (the HOLDOR channel, the chat, X, YouTube, TikTok) or share the game; the gift can be claimed
--               `wait` seconds after the server saw the link opened (task_open). One per Telegram account, on any seat.
--               A task whose url is empty is not shown (the owner fills the links in econ_config 'tasks').
--      ref    — invite friends who join through your link (the referrals table, v14). One per Telegram account.
--      metric — lifetime progress of this seat (stages cleared, wins, kills, stars, Hold runs; the quest metrics of v10). One per seat.
--  * The estate is closed: estate_build / estate_collect refuse (econ_config estate.closed). Every seat that built something gets
--    what has piled up plus ALL the gold it spent on buildings back (ledger reasons estate_income / estate_refund), once.
--  * The Mon–Tue event is now "Quest Rush" (kind 'rush'): quest rewards are doubled while it runs. Fri–Sat "Duel Cup" stays.
-- ============================================================

-- ---------- the two-day events: Mon–Tue Quest Rush, Fri–Sat Duel Cup ----------
create or replace function ev_at(ts timestamptz, out kind text, out active boolean, out t0 timestamptz, out t1 timestamptz)
language plpgsql stable set search_path = '' as $$
declare d timestamp := ts at time zone 'utc'; dow int := extract(isodow from d)::int; day0 timestamp := date_trunc('day', d);
begin
  if dow in (1, 2) then kind := 'rush'; active := true; t0 := (day0 - make_interval(days => dow - 1)) at time zone 'utc';
  elsif dow in (5, 6) then kind := 'cup'; active := true; t0 := (day0 - make_interval(days => dow - 5)) at time zone 'utc';
  elsif dow in (3, 4) then kind := 'cup'; active := false; t0 := (day0 + make_interval(days => 5 - dow)) at time zone 'utc';
  else kind := 'rush'; active := false; t0 := (day0 + make_interval(days => 1)) at time zone 'utc'; end if;
  t1 := t0 + interval '2 days';
end $$;

-- a reward doubled (gold, dragonglass, books)
create or replace function qs_double(r jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare o jsonb := '{}'::jsonb; b jsonb := '{}'::jsonb; e record;
begin
  if ec_i(r, 'gold') > 0 then o := o || jsonb_build_object('gold', ec_i(r, 'gold') * 2); end if;
  if ec_i(r, 'gems') > 0 then o := o || jsonb_build_object('gems', ec_i(r, 'gems') * 2); end if;
  for e in select key, value from jsonb_each(coalesce(r->'books', '{}'::jsonb)) loop b := b || jsonb_build_object(e.key, jint(e.value #>> '{}') * 2); end loop;
  if b <> '{}'::jsonb then o := o || jsonb_build_object('books', b); end if;
  return o;
end $$;

create or replace function quest_claim(token uuid, seat int, quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; kind text; q jsonb; win record; done jsonb; cur bigint; keep jsonb := '{}'::jsonb; k text; r jsonb; rush boolean;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  w := ec_energy(w);
  foreach kind in array array['daily', 'weekly', 'monthly'] loop
    select x into q from jsonb_array_elements(coalesce(econ_cfg('quests')->kind, '[]'::jsonb)) x where x->>'id' = quest;
    exit when q is not null;
  end loop;
  if q is null then raise exception 'no such quest'; end if;
  select * into win from qs_window(kind);
  done := coalesce(w.claims->'quests'->win.k, '[]'::jsonb);
  if done ? quest then raise exception 'already claimed'; end if;
  cur := qs_metric(pid, seat, win.t0, win.t1, q->>'m');
  if cur < ec_i(q, 'n') then raise exception 'not done yet: % of %', cur, ec_i(q, 'n'); end if;
  r := q->'r';
  rush := exists (select 1 from ev_at(now()) e where e.kind = 'rush' and e.active);
  if rush then r := qs_double(r); end if;                                   -- Quest Rush: everything doubled
  w := qs_pay(w, r, 'quest', quest);
  for k in select unnest(array[(select x.k from qs_window('daily') x), (select x.k from qs_window('weekly') x), (select x.k from qs_window('monthly') x)]) loop
    if w.claims->'quests' ? k then keep := keep || jsonb_build_object(k, w.claims->'quests'->k); end if;
  end loop;
  keep := jsonb_set(keep, array[win.k], coalesce(keep->win.k, '[]'::jsonb) || to_jsonb(quest));
  w.claims := jsonb_set(w.claims, '{quests}', keep);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', r, 'rush', rush, 'state', ec_state(w), 'quests', qs_state(w));
end $$;

-- ---------- the estate is closed ----------
update econ_config set v = v || '{"closed":true}'::jsonb where k = 'estate';

create or replace function estate_collect(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; p int; e jsonb;
begin
  pid := ec_session(token);
  if coalesce((econ_cfg('estate')->>'closed')::boolean, false) then raise exception 'the estate is closed'; end if;
  w := ec_wallet(pid, seat); w := ec_energy(w);
  p := es_pending(w);
  if p <= 0 then raise exception 'nothing to collect yet'; end if;
  w := ec_book(w, 'gold', p, 'estate_income', null);
  e := coalesce(w.claims->'estate', '{}'::jsonb) || jsonb_build_object('at', now());
  w.claims := jsonb_set(w.claims, '{estate}', e);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'gold', p, 'state', ec_state(w), 'estate', es_state(w));
end $$;

create or replace function estate_build(token uuid, seat int, bld text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; cfg jsonb := econ_cfg('estate'); b jsonb; e jsonb; lv jsonb; n int; cost bigint; p int;
begin
  pid := ec_session(token);
  if coalesce((cfg->>'closed')::boolean, false) then raise exception 'the estate is closed'; end if;
  w := ec_wallet(pid, seat); w := ec_energy(w);
  select x into b from jsonb_array_elements(cfg->'buildings') x where x->>'id' = bld;
  if b is null then raise exception 'no such building'; end if;
  e := coalesce(w.claims->'estate', '{}'::jsonb); lv := coalesce(e->'b', '{}'::jsonb);
  n := coalesce((lv->>bld)::int, 0) + 1;
  if n > (cfg->>'max')::int then raise exception 'already at the top level'; end if;
  if xp_level(w.xp) < es_need(cfg, b, n) then raise exception 'account level % is needed', es_need(cfg, b, n); end if;
  p := es_pending(w);
  if p > 0 then w := ec_book(w, 'gold', p, 'estate_income', null); end if;
  cost := es_cost(cfg, b, n);
  w := ec_book(w, 'gold', -cost, 'estate', bld || ':' || n);
  lv := jsonb_set(lv, array[bld], to_jsonb(n));
  w.claims := jsonb_set(w.claims, '{estate}', jsonb_build_object('b', lv, 'at', now()));
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'lvl', n, 'cost', cost, 'collected', p, 'state', ec_state(w), 'estate', es_state(w));
end $$;

-- the refund: what has piled up + every gold piece spent on buildings, once per seat (claims.estate_refund marks it)
create or replace function es_refund_all() returns int language plpgsql security definer set search_path = public as $$
declare w wallets; s bigint; p int; n int := 0;
begin
  for w in select * from wallets x where x.claims ? 'estate' and not (x.claims ? 'estate_refund') for update loop
    p := es_pending(w);
    if p > 0 then w := ec_book(w, 'gold', p, 'estate_income', 'closing'); end if;
    select coalesce(-sum(l.delta), 0) into s from ledger l where l.tg_id = w.tg_id and l.seat = w.seat and l.reason = 'estate' and l.cur = 'gold';
    if s > 0 then w := ec_book(w, 'gold', s, 'estate_refund', null); end if;
    w.claims := (w.claims - 'estate') || jsonb_build_object('estate_refund', s);
    perform ec_save(w);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function es_refund_all() from public, anon, authenticated;
select es_refund_all();

-- ---------- tasks ----------
create table if not exists task_marks (
  tg_id bigint not null references players(tg_id) on delete cascade,
  id text not null,
  opened_at timestamptz,
  claimed_at timestamptz, seat int,
  primary key (tg_id, id));
alter table task_marks enable row level security;
revoke all on task_marks from anon, authenticated;

insert into econ_config (k, v) values ('tasks', '{"wait":10,"list":[
  {"id":"tg_channel","kind":"link","e":"📣","n":"Join the HOLDOR channel","url":"","r":{"gems":50}},
  {"id":"tg_chat","kind":"link","e":"💬","n":"Join the players'' chat","url":"","r":{"gems":30}},
  {"id":"x","kind":"link","e":"✖️","n":"Follow HOLDOR on X","url":"","r":{"gems":30}},
  {"id":"youtube","kind":"link","e":"▶️","n":"Subscribe on YouTube","url":"","r":{"gems":30}},
  {"id":"tiktok","kind":"link","e":"🎵","n":"Follow HOLDOR on TikTok","url":"","r":{"gems":30}},
  {"id":"share","kind":"link","e":"📨","n":"Share HOLDOR with a friend","url":"share","r":{"gold":500}},
  {"id":"friend1","kind":"ref","e":"🤝","n":"A friend joins through your link","need":1,"r":{"gems":40}},
  {"id":"friend3","kind":"ref","e":"👥","n":"Three friends join","need":3,"r":{"gems":120,"books":{"b:r":1}}},
  {"id":"stages5","kind":"metric","m":"new_stages","e":"🏰","n":"Clear 5 stages","need":5,"r":{"gold":800}},
  {"id":"stages15","kind":"metric","m":"new_stages","e":"🏰","n":"Clear 15 stages","need":15,"r":{"gems":40}},
  {"id":"stages30","kind":"metric","m":"new_stages","e":"🏯","n":"Clear 30 stages","need":30,"r":{"gems":80,"books":{"b:r":1}}},
  {"id":"stages50","kind":"metric","m":"new_stages","e":"👑","n":"Clear all 50 stages","need":50,"r":{"gems":200,"books":{"b:e":1}}},
  {"id":"wins25","kind":"metric","m":"wins","e":"⚔️","n":"Win 25 battles","need":25,"r":{"gold":2000}},
  {"id":"stars60","kind":"metric","m":"stars","e":"⭐","n":"Earn 60 stars","need":60,"r":{"gems":60}},
  {"id":"kills2k","kind":"metric","m":"kills","e":"💀","n":"Put down 2,000 of the dead","need":2000,"r":{"gold":1500}},
  {"id":"kills20k","kind":"metric","m":"kills","e":"☠️","n":"Put down 20,000 of the dead","need":20000,"r":{"gems":100}},
  {"id":"hold5","kind":"metric","m":"hold_runs","e":"🚪","n":"Play 5 Hold runs","need":5,"r":{"gems":40}},
  {"id":"days7","kind":"metric","m":"days","e":"📅","n":"Fight on 7 different days","need":7,"r":{"gems":70}}
]}'::jsonb) on conflict (k) do update set v = jsonb_set(excluded.v, '{list}',
  -- keep the links the owner has already filled in
  (select jsonb_agg(case when x->>'kind' = 'link' and coalesce(o->>'url', '') <> '' then x || jsonb_build_object('url', o->>'url') else x end order by i)
     from jsonb_array_elements(excluded.v->'list') with ordinality as t(x, i)
     left join lateral (select y as o from jsonb_array_elements(econ_config.v->'list') y where y->>'id' = x->>'id') z on true));

create or replace function tk_cur(w wallets, t jsonb) returns bigint language plpgsql stable security definer set search_path = public as $$
begin
  if t->>'kind' = 'ref' then return (select count(*) from referrals r where r.inviter = w.tg_id); end if;
  if t->>'kind' = 'metric' then return qs_metric(w.tg_id, w.seat, '-infinity'::timestamptz, 'infinity'::timestamptz, t->>'m'); end if;
  return 0;
end $$;

create or replace function tk_state(w wallets) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := econ_cfg('tasks'); t jsonb; items jsonb := '[]'::jsonb; m task_marks; cur bigint; need bigint; st text; wait int := ec_i(cfg, 'wait')::int; left_ int;
begin
  for t in select x from jsonb_array_elements(cfg->'list') x loop
    if t->>'kind' = 'link' and coalesce(t->>'url', '') = '' then continue; end if;
    m := null; cur := 0; need := greatest(1, ec_i(t, 'need')); left_ := 0;
    if t->>'kind' = 'metric' then
      st := case when coalesce(w.claims->'tasks', '[]'::jsonb) ? (t->>'id') then 'done' else null end;
    else
      select * into m from task_marks x where x.tg_id = w.tg_id and x.id = t->>'id';
      st := case when m.claimed_at is not null then 'done' else null end;
    end if;
    if st is null then
      if t->>'kind' = 'link' then
        if m.opened_at is null then st := 'new';
        else left_ := greatest(0, wait - floor(extract(epoch from now() - m.opened_at))::int); st := case when left_ > 0 then 'wait' else 'ready' end; end if;
        cur := case when st = 'ready' then 1 else 0 end;
      else cur := tk_cur(w, t); st := case when cur >= need then 'ready' else 'new' end; end if;
    else cur := need; end if;
    items := items || jsonb_build_array(jsonb_build_object('id', t->>'id', 'kind', t->>'kind', 'e', t->>'e', 'n', t->>'n', 'url', t->>'url',
      'r', t->'r', 'cur', least(cur, need), 'need', need, 'st', st, 'left', left_));
  end loop;
  return jsonb_build_object('items', items, 'wait', wait, 'ready', (select count(*) from jsonb_array_elements(items) x where x->>'st' = 'ready'));
end $$;

create or replace function task_state(token uuid, seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  return tk_state(w);
end $$;

create or replace function task_open(token uuid, seat int, task text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; t jsonb;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat);
  select x into t from jsonb_array_elements(econ_cfg('tasks')->'list') x where x->>'id' = task;
  if t is null or t->>'kind' <> 'link' or coalesce(t->>'url', '') = '' then raise exception 'no such task'; end if;
  insert into task_marks (tg_id, id, opened_at) values (pid, task, now()) on conflict (tg_id, id) do nothing;   -- the first opening counts
  return jsonb_build_object('ok', true, 'tasks', tk_state(w));
end $$;

create or replace function task_claim(token uuid, seat int, task text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; t jsonb; cfg jsonb := econ_cfg('tasks'); m task_marks; cur bigint;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  select x into t from jsonb_array_elements(cfg->'list') x where x->>'id' = task;
  if t is null or (t->>'kind' = 'link' and coalesce(t->>'url', '') = '') then raise exception 'no such task'; end if;
  if t->>'kind' = 'metric' then
    if coalesce(w.claims->'tasks', '[]'::jsonb) ? task then raise exception 'already claimed'; end if;
    cur := tk_cur(w, t);
    if cur < ec_i(t, 'need') then raise exception 'not done yet: % of %', cur, ec_i(t, 'need'); end if;
    w.claims := jsonb_set(w.claims, '{tasks}', coalesce(w.claims->'tasks', '[]'::jsonb) || to_jsonb(task));
  else
    select * into m from task_marks x where x.tg_id = pid and x.id = task for update;
    if m.claimed_at is not null then raise exception 'already claimed'; end if;
    if t->>'kind' = 'link' then
      if m.opened_at is null then raise exception 'open the link first'; end if;
      if now() - m.opened_at < make_interval(secs => ec_i(cfg, 'wait')) then raise exception 'a few more seconds'; end if;
      update task_marks set claimed_at = now(), seat = task_claim.seat where tg_id = pid and id = task;
    else
      cur := tk_cur(w, t);
      if cur < ec_i(t, 'need') then raise exception 'not done yet: % of %', cur, ec_i(t, 'need'); end if;
      insert into task_marks (tg_id, id, claimed_at, seat) values (pid, task, now(), task_claim.seat)
        on conflict (tg_id, id) do update set claimed_at = now(), seat = excluded.seat;
    end if;
  end if;
  w := qs_pay(w, t->'r', 'task', task);
  perform ec_save(w);
  return jsonb_build_object('ok', true, 'reward', t->'r', 'state', ec_state(w), 'tasks', tk_state(w));
end $$;

revoke all on function qs_double(jsonb), tk_cur(wallets, jsonb), tk_state(wallets) from public, anon, authenticated;
revoke all on function task_state(uuid, int), task_open(uuid, int, text), task_claim(uuid, int, text) from public;
grant execute on function task_state(uuid, int), task_open(uuid, int, text), task_claim(uuid, int, text) to anon, authenticated;

-- the owner's dashboard: tasks opened and claimed
create or replace view v_tasks as
  select t.id, count(*) filter (where t.opened_at is not null) as opened, count(*) filter (where t.claimed_at is not null) as claimed
    from task_marks t group by 1
  union all
  select l.ref, null, count(*) from ledger l where l.reason = 'task' and l.ref not in (select id from task_marks) group by 1;
revoke all on v_tasks from anon, authenticated;
