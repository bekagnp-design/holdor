-- ============================================================
--  HOLDOR: Hold the Door — Supabase backend  (v1, 2026-09-13)
--  Paste the WHOLE file into  Supabase → SQL Editor → New query → Run.
--  Before running: replace  PASTE_BOT_TOKEN_HERE  (one place, near the top)
--  with the token BotFather gave you for @HoldorTDBot
--  (BotFather → /mybots → HoldorTDBot → API Token). Keep the quotes.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;  -- Supabase keeps extensions here

-- ---------- secrets (never readable from the app) ----------
create table if not exists app_secrets (k text primary key, v text not null);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;
insert into app_secrets (k, v) values ('bot_token', 'PASTE_BOT_TOKEN_HERE')
  on conflict (k) do update set v = excluded.v;

-- ---------- tables ----------
create table if not exists players (
  tg_id      bigint primary key,
  name       text not null default '',
  username   text,
  house      text,
  realm      int  not null default 0,
  save       jsonb,
  save_ver   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists sessions (
  token      uuid primary key default gen_random_uuid(),
  tg_id      bigint not null references players(tg_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create table if not exists scores (
  tg_id      bigint primary key references players(tg_id) on delete cascade,
  name       text not null default '',
  house      text,
  realm      int  not null default 0,
  stars      int  not null default 0,   -- campaign stars (all gates, all stages)
  gates      int  not null default 0,   -- gates held (1..10)
  waves      int  not null default 0,   -- best endless run
  kills      int  not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists scores_realm_idx on scores (realm, stars desc, waves desc);
create index if not exists sessions_tg_idx  on sessions (tg_id);

-- RLS on, no policies: the app can only go through the functions below
alter table players  enable row level security;
alter table sessions enable row level security;
alter table scores   enable row level security;
revoke all on players, sessions, scores from anon, authenticated;

-- ---------- helpers ----------
create or replace function tg_url_decode(p text) returns text
language plpgsql immutable as $$
declare b bytea := ''::bytea; i int := 1; n int := length(p); c text;
begin
  while i <= n loop
    c := substr(p, i, 1);
    if c = '%' and i + 2 <= n then
      b := b || decode(substr(p, i + 1, 2), 'hex'); i := i + 3;
    elsif c = '+' then
      b := b || ' '::bytea; i := i + 1;
    else
      b := b || convert_to(c, 'UTF8'); i := i + 1;
    end if;
  end loop;
  return convert_from(b, 'UTF8');
end $$;

-- Validates Telegram Mini App initData (HMAC-SHA256, see core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
-- and returns the "user" object as jsonb. Raises on any problem.
create or replace function tg_check(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  tok text; kv text; k text; v text; h text;
  ks text[] := '{}'; vs text[] := '{}';
  dcs text; secret bytea; calc text; u jsonb; ad bigint;
begin
  select s.v into tok from app_secrets s where s.k = 'bot_token';
  if tok is null or length(tok) < 30 or position(':' in tok) = 0 then raise exception 'bot token not set'; end if;
  if init_data is null or length(init_data) < 20 or length(init_data) > 8000 then raise exception 'bad init data'; end if;
  foreach kv in array string_to_array(init_data, '&') loop
    k := split_part(kv, '=', 1);
    v := tg_url_decode(substr(kv, length(k) + 2));
    if k = 'hash' then h := v;
    else ks := ks || k; vs := vs || v; end if;
  end loop;
  if h is null then raise exception 'no hash'; end if;
  select string_agg(x.k || '=' || x.v, E'\n' order by x.k) into dcs
    from unnest(ks, vs) as x(k, v);
  secret := hmac(convert_to(tok, 'UTF8'), convert_to('WebAppData', 'UTF8'), 'sha256');
  calc   := encode(hmac(convert_to(dcs, 'UTF8'), secret, 'sha256'), 'hex');
  if calc <> lower(h) then raise exception 'bad hash'; end if;
  select x.v::bigint into ad from unnest(ks, vs) as x(k, v) where x.k = 'auth_date';
  if ad is null or ad < extract(epoch from now()) - 86400 * 7 then raise exception 'expired'; end if;
  select x.v::jsonb into u from unnest(ks, vs) as x(k, v) where x.k = 'user';
  if u is null or (u->>'id') is null then raise exception 'no user'; end if;
  return u;
end $$;

-- ---------- API ----------
-- 1) login: validates initData, creates/updates the player, returns a session token + the cloud save
create or replace function tg_login(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; id bigint; nm text; t uuid; p players%rowtype;
begin
  u  := tg_check(init_data);
  id := (u->>'id')::bigint;
  nm := left(trim(coalesce(u->>'first_name', '') || ' ' || coalesce(u->>'last_name', '')), 40);
  if nm = '' then nm := coalesce(u->>'username', 'Defender'); end if;
  insert into players (tg_id, name, username) values (id, nm, u->>'username')
    on conflict (tg_id) do update set name = excluded.name, username = excluded.username, updated_at = now();
  delete from sessions where tg_id = id and created_at < now() - interval '120 days';
  insert into sessions (tg_id) values (id) returning token into t;
  select * into p from players where tg_id = id;
  return jsonb_build_object('token', t, 'tg_id', id, 'name', nm, 'save', p.save, 'save_ver', p.save_ver);
end $$;

-- 2) save: stores the whole save file (if not older than what we have) and updates the score row
create or replace function save_progress(token uuid, save jsonb, ver int, house text, realm int,
                                         stars int, gates int, waves int, kills int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id bigint; cur int; nm text;
begin
  select s.tg_id into id from sessions s where s.token = save_progress.token;
  if id is null then raise exception 'bad session'; end if;
  if pg_column_size(save) > 300000 then raise exception 'save too big'; end if;
  update sessions set last_seen = now() where sessions.token = save_progress.token;
  select p.save_ver, p.name into cur, nm from players p where p.tg_id = id;
  if ver >= cur then
    update players p set save = save_progress.save, save_ver = ver, house = save_progress.house,
                         realm = coalesce(save_progress.realm, 0), updated_at = now()
      where p.tg_id = id;
  end if;
  insert into scores (tg_id, name, house, realm, stars, gates, waves, kills)
    values (id, nm, house, coalesce(realm, 0), greatest(0, stars), greatest(0, gates), greatest(0, waves), greatest(0, kills))
    on conflict (tg_id) do update set
      name = excluded.name, house = excluded.house, realm = excluded.realm,
      stars = greatest(scores.stars, excluded.stars), gates = greatest(scores.gates, excluded.gates),
      waves = greatest(scores.waves, excluded.waves), kills = greatest(scores.kills, excluded.kills),
      updated_at = now();
  return jsonb_build_object('ok', true, 'save_ver', greatest(cur, ver));
end $$;

-- 3) leaderboard: realm table + top defenders (no login needed)
create or replace function leaderboard(realm int default null, me bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare realms jsonb; top jsonb; mine jsonb; total int;
begin
  select count(*) into total from scores;
  select coalesce(jsonb_agg(r order by r.waves desc, r.stars desc), '[]'::jsonb) into realms from (
    select s.realm, count(*) as players, sum(s.waves) as waves, sum(s.stars) as stars, sum(s.kills) as kills
      from scores s group by s.realm) r;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into top from (
    select s.tg_id, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
           row_number() over (order by s.stars desc, s.waves desc, s.kills desc) as rank
      from scores s
      where leaderboard.realm is null or s.realm = leaderboard.realm
      order by s.stars desc, s.waves desc, s.kills desc limit 25) t;
  if me is not null then
    select to_jsonb(t) into mine from (
      select s.tg_id, s.name, s.house, s.realm, s.stars, s.gates, s.waves, s.kills,
             (select count(*) + 1 from scores o where (leaderboard.realm is null or o.realm = leaderboard.realm)
                and (o.stars > s.stars or (o.stars = s.stars and o.waves > s.waves)
                     or (o.stars = s.stars and o.waves = s.waves and o.kills > s.kills))) as rank
        from scores s where s.tg_id = me) t;
  end if;
  return jsonb_build_object('total', total, 'realms', realms, 'top', top, 'me', mine, 'at', now());
end $$;

-- the app (anon key) may only call these three
revoke all on function tg_url_decode(text) from public, anon, authenticated;
revoke all on function tg_check(text) from public, anon, authenticated;
grant execute on function tg_login(text) to anon, authenticated;
grant execute on function save_progress(uuid, jsonb, int, text, int, int, int, int, int) to anon, authenticated;
grant execute on function leaderboard(int, bigint) to anon, authenticated;

-- done. Quick self-check (should return a row with total = 0 the first time):
select leaderboard();
