-- ============================================================
--  HEAVY GOLD backend g2 (2026-11-23) — wave 5 of the arena game (src/gold/GOLD.md, "Wave 5 → Server"): world and country
--  chat, the country ladder with weekly duels, the champion's crown, the share card for Telegram Stories.
--  Run after holdor_g1.sql. Additive and safe to re-run: new tables (create if not exists) and new functions; of g1 only
--  hg_board and hg_profile_get are replaced, with the same signatures and bodies apart from `crown` (hg_board: the `champ`
--  variable and a crown key on each player row; hg_profile_get: crown: true for the champion only). Rounds use g1's
--  hg_rounds.country (stamped by hg_round_submit); rounds without one are filled from the profile once. An earlier draft's
--  trigger hg_rounds_country / hg_round_country() is dropped if present. Every function: search_path = public, pg_temp
--  (or '' where it needs none), so a caller's temp table never stands in for one of ours.
--  Re-running g1 alone after g2 would put back the g1 hg_board / hg_profile_get without crowns: re-run g2 right after it.
--  Same session and token rules as g1 (sessions.token from tg_login). Errors come back as {error: ...}, never as an exception.
--
--  Chat         hg_chat_send / hg_chat_list / hg_chat_block / hg_chat_report. Channels 'world' and 'c:XX' (XX = the caller's
--               own profile country, for sending and for reading). The body: line breaks and tabs become a space, control
--               characters and the invisible format characters (soft hyphen, zero-width space, bidi marks / embeddings /
--               isolates, word joiner, BOM) are removed, the joiners U+200C / U+200D are kept (emoji sequences, Persian and
--               Indic text need them), the ends trimmed; 1–200 characters ('empty' also for a body of spaces and joiners
--               only; 'too_long'; a raw body over 2000 characters is too_long without being cleaned). One message per 2 s
--               and 10 a minute per player (all channels), serialised by advisory lock 7102. A channel keeps its newest 500.
--               The name and the country shown are the author's current profile. Blocks are by name, stored by player, so a
--               rename does not escape them. A message reported by 3 different players is hidden for everyone.
--  Ladder       hg_ladder(token): the persistent order of countries (hg_ladder) and the weekly duels, Monday 00:00 UTC to
--               Monday. Pairs by position, alternating weekly: on even weeks (1-2) (3-4)…, on odd weeks (2-3) (4-5)… and #1
--               rests; an unpaired last country rests too. A week's parity counts weeks from 2026-11-23 (ISO week 48, even):
--               every week of 2026 keeps its ISO parity, and the weeks keep alternating across the new year (ISO parity
--               would give 2026's week 53 and 2027's week 1 the same pairs). Score = gold banked that week by the country's
--               real players / max(5, real active members) (real members: players with at least one round that week for
--               that country; a round counts for the country stored on it by g1's hg_round_submit, so a later change of
--               country moves nothing); the bots fill a country to 5 members and never add gold. Scores are shown and
--               stored rounded to 2 decimals; the winner is decided on the exact values. The
--               higher score wins, a tie keeps the higher position, the winner takes the higher position. A country enters
--               at the bottom in the first week one of its players banks a round (several in one week: by their first round,
--               then the code);
--               in the open week it is shown at the bottom and stored when the week closes. The first hg_ladder call after
--               Monday 00:00 UTC closes every pending week under advisory lock 7103 and stores the duels (hg_ladder_duels).
--               The ladder starts at the week of the oldest round (the current week when there is none).
--               `bots` = max(0, 5 - real): filler members the client names bot1…botN; members, never gold.
--  Crowns       the champion = last week's #1 player (the 'last' board: Monday 00:00 UTC whatever the session TimeZone).
--               hg_board rows carry crown (true for him), hg_profile_get adds crown: true for him only, chat messages carry
--               crown, hg_ladder marks pos 1 (crown). hg_chat_list answers {msgs: []} before looking for the champion when
--               the channel has nothing new for the caller (the client polls it).
--  Share card   hg_card_put(token, png base64) → {ok, id, url}; at most 400 KB decoded, a PNG's frame (the signature, the
--               IHDR chunk first, the IEND chunk last), 6 an hour per player (advisory lock 7104). Storage is capped, since
--               Telegram reads the card when the story editor opens: a card lives one day (older ones are deleted on the
--               next put), a player keeps the image of his newest 3 cards (an older card's image is emptied; its row stays
--               for the hourly count until the day is over), and a put that would take all cards past 50 MB is refused as
--               'rate'. The Edge Function `hg-card` (backend/edge/hg-card/index.ts) serves GET ?id=<uuid> as image/png
--               through hg_card_get, which only service_role may execute (an emptied or deleted card: 404).
--  Row level security is on with no policies and anon / authenticated have no table rights: every access goes through the
--  security definer functions below. The internal helpers are closed (hg_champion returns a tg_id). No answer holds a tg_id.
--  Test (local Postgres only, never a Supabase project): python3 backend/test/g2_test.py  (README: backend/test/README.md).
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;   -- Supabase has it; only for the local copy
end $$;

create table if not exists hg_chat (
  id      bigserial primary key,
  tg_id   bigint not null references hg_profiles(tg_id) on delete cascade,
  channel text not null,
  body    text not null,
  at      timestamptz not null default now(),
  hidden  boolean not null default false);
create index if not exists hg_chat_channel_idx on hg_chat (channel, id);
create index if not exists hg_chat_player_idx on hg_chat (tg_id, at);
create table if not exists hg_chat_blocks (
  tg_id   bigint not null references players(tg_id) on delete cascade,
  blocked bigint not null references players(tg_id) on delete cascade,
  at      timestamptz not null default now(),
  primary key (tg_id, blocked));
create table if not exists hg_chat_reports (
  msg_id   bigint not null references hg_chat(id) on delete cascade,
  reporter bigint not null references players(tg_id) on delete cascade,
  at       timestamptz not null default now(),
  primary key (msg_id, reporter));
create table if not exists hg_ladder (
  country char(2) primary key,
  pos     int not null,
  since   date not null,
  constraint hg_ladder_pos_key unique (pos) deferrable initially immediate);   -- checked per statement: a swap is one update
create table if not exists hg_ladder_state (
  id   int primary key check (id = 1),
  week date not null);   -- the open week's Monday (UTC); every week before it is closed
create table if not exists hg_ladder_duels (
  week     date not null,     -- the Monday (UTC) of the closed week
  pos      int not null,      -- a's position that week; b (if any) was pos + 1
  a        char(2) not null,
  b        char(2),           -- null: a rested
  a_score  numeric not null,
  b_score  numeric,
  a_real   int not null,
  b_real   int,
  a_rounds int not null,
  b_rounds int,
  winner   char(2),           -- null for a rest
  primary key (week, pos));
create table if not exists hg_cards (
  id    uuid primary key default gen_random_uuid(),
  tg_id bigint not null references players(tg_id) on delete cascade,
  png   bytea not null,
  at    timestamptz not null default now());
create index if not exists hg_cards_player_idx on hg_cards (tg_id, at);
create index if not exists hg_cards_at_idx on hg_cards (at);
alter table hg_chat enable row level security;
alter table hg_chat_blocks enable row level security;
alter table hg_chat_reports enable row level security;
alter table hg_ladder enable row level security;
alter table hg_ladder_state enable row level security;
alter table hg_ladder_duels enable row level security;
alter table hg_cards enable row level security;
revoke all on hg_chat, hg_chat_blocks, hg_chat_reports, hg_ladder, hg_ladder_state, hg_ladder_duels, hg_cards from anon, authenticated;
revoke all on sequence hg_chat_id_seq from anon, authenticated;

-- g1 stamps every round with its player's country in hg_round_submit. The trigger an earlier draft of g2 used for that is
-- dropped where it exists; rounds stored without a country (none on a fresh g1) are filled once from the profile, so a later
-- change of country moves none of them on the ladder.
drop trigger if exists hg_rounds_country on hg_rounds;
drop function if exists hg_round_country();
update hg_rounds x set country = p.country from hg_profiles p where p.tg_id = x.tg_id and x.country is null;

-- internal: the champion's tg_id = the #1 of the 'last' board (the previous full week, Monday to Monday UTC), or null
create or replace function hg_champion() returns bigint
language sql stable set search_path = public, pg_temp as $$
  select k.tg_id from hg_ranked((date_trunc('week', now() at time zone 'utc') - interval '7 days') at time zone 'utc',
                                date_trunc('week', now() at time zone 'utc') at time zone 'utc') k
   where k.pos = 1
$$;

-- ---------------------------------------------------------------- crowns on the g1 calls
-- my profile: {name, country} (+ crown: true when I am the champion), {} before the first hg_profile_set, {error:'auth'}
create or replace function hg_profile_get(token uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pid bigint; pr hg_profiles; res jsonb;
begin
  select s.tg_id into pid from sessions s where s.token = hg_profile_get.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select * into pr from hg_profiles p where p.tg_id = pid;
  if pr.tg_id is null then return '{}'::jsonb; end if;
  res := jsonb_build_object('name', pr.name, 'country', pr.country::text);
  if hg_champion() = pid then res := res || jsonb_build_object('crown', true); end if;
  return res;
end $$;

-- the boards, as in g1 (scope 'week' / 'last' / 'all', anything else reads as 'week'; the countries list counts each round for
-- the country stored on it, 'all' reads hg_alltime), every row with crown (the champion). Keep this body equal to g1's hg_board
-- apart from `champ` and the crown key (g2_test checks the answers).
-- → {scope, since, until, players:[{name, country, total, best, rounds, mine, crown}] (top 20), me:{rank, total, best, rounds} | null,
--    countries:[{country, players, rounds, gold}], totals:{players, rounds}}. Never a Telegram id.
create or replace function hg_board(token uuid, scope text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pid bigint; sc text := lower(btrim(coalesce(hg_board.scope, '')));
        mon timestamp := date_trunc('week', now() at time zone 'utc');   -- this Monday 00:00 as UTC wall-clock time: the
        t0 timestamptz; t1 timestamptz;                                   -- arithmetic below never sees the session TimeZone
        iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"'; res jsonb; champ bigint := hg_champion();
begin
  if hg_board.token is not null then select s.tg_id into pid from sessions s where s.token = hg_board.token; end if;
  if sc = 'all' then t0 := '-infinity'; t1 := 'infinity';
  elsif sc = 'last' then t0 := (mon - interval '7 days') at time zone 'utc'; t1 := mon at time zone 'utc';
  else sc := 'week'; t0 := mon at time zone 'utc'; t1 := 'infinity';
  end if;
  with k as (select * from hg_ranked(t0, t1))
  select jsonb_build_object(
    'scope', sc,
    'since', case when sc = 'all' then null else to_char(t0 at time zone 'utc', iso) end,
    'until', case when sc = 'last' then to_char(t1 at time zone 'utc', iso) end,
    'players', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'country', x.country, 'total', x.total, 'best', x.best,
                                                             'rounds', x.rounds, 'mine', x.tg_id is not distinct from pid,
                                                             'crown', x.tg_id is not distinct from champ) order by x.pos)
                           from k x where x.pos <= 20), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', x.pos, 'total', x.total, 'best', x.best, 'rounds', x.rounds) from k x where x.tg_id = pid),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country', c.country, 'players', c.players, 'rounds', c.rounds, 'gold', c.gold)
                                            order by c.gold desc, c.players desc, c.country)
                             from (select y.country, count(distinct y.tg_id)::int as players, sum(y.rounds)::int as rounds, sum(y.gold)::bigint as gold
                                     from (select coalesce(x.country, p.country)::text as country, x.tg_id, 1 as rounds, x.banked::bigint as gold
                                             from hg_rounds x join hg_profiles p on p.tg_id = x.tg_id
                                            where sc <> 'all' and x.at >= t0 and x.at < t1
                                           union all
                                           select coalesce(nullif(s.country, ''), p.country::text), s.tg_id, s.rounds, s.total
                                             from hg_alltime s join hg_profiles p on p.tg_id = s.tg_id where sc = 'all') y
                                    group by y.country) c), '[]'::jsonb),
    'totals', (select jsonb_build_object('players', count(*), 'rounds', coalesce(sum(x.rounds), 0)) from k x))
  into res;
  return res;
end $$;

-- ---------------------------------------------------------------- chat
-- internal: a message body as stored (see the header); the length rules are the caller's
create or replace function hg_chat_clean(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
           regexp_replace(regexp_replace(coalesce(t, ''), '[\t\n\r\f\v\u0085\u2028\u2029]+', ' ', 'g'),
                          '[[:cntrl:]\u00AD\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF]', '', 'g'),
           '^[[:space:] 　]+|[[:space:] 　]+$', '', 'g')
$$;

-- send: → {ok:true, msg:{id, name, country, body, at, mine, crown}} | {error:'auth'|'no_profile'|'bad_channel'|'too_long'|'empty'|'rate'}
create or replace function hg_chat_send(token uuid, channel text, body text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint; pr hg_profiles; ch text := coalesce(hg_chat_send.channel, ''); txt text; mid bigint; t timestamptz;
begin
  select s.tg_id into pid from sessions s where s.token = hg_chat_send.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select * into pr from hg_profiles p where p.tg_id = pid;
  if pr.tg_id is null then return jsonb_build_object('error', 'no_profile'); end if;
  if ch <> 'world' and ch <> 'c:' || pr.country::text then return jsonb_build_object('error', 'bad_channel'); end if;
  if char_length(coalesce(hg_chat_send.body, '')) > 2000 then return jsonb_build_object('error', 'too_long'); end if;
  txt := hg_chat_clean(hg_chat_send.body);
  if txt !~ '[^[:space:]\u00A0\u3000\u200C\u200D]' then return jsonb_build_object('error', 'empty'); end if;   -- blank, or only joiners
  if char_length(txt) > 200 then return jsonb_build_object('error', 'too_long'); end if;
  perform pg_advisory_xact_lock(7102, (pid % 2000000000)::int);   -- one send at a time per player: the limits cannot race
  if exists (select 1 from hg_chat c where c.tg_id = pid and c.at > now() - interval '2 seconds')
     or (select count(*) from hg_chat c where c.tg_id = pid and c.at > now() - interval '60 seconds') >= 10 then
    return jsonb_build_object('error', 'rate');
  end if;
  insert into hg_chat as m (tg_id, channel, body) values (pid, ch, txt) returning m.id, m.at into mid, t;
  delete from hg_chat c where c.channel = ch
     and c.id <= (select x.id from hg_chat x where x.channel = ch order by x.id desc offset 500 limit 1);   -- keep the newest 500
  return jsonb_build_object('ok', true, 'msg', jsonb_build_object('id', mid, 'name', pr.name, 'country', pr.country::text, 'body', txt,
    'at', to_char(t at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'mine', true, 'crown', coalesce(hg_champion() = pid, false)));
end $$;

-- read: the newest 50 messages with id > since, oldest first; hidden ones and the caller's blocked players left out.
-- 'world' for any player who is logged in, 'c:XX' only for players whose profile country is XX.
-- → {msgs:[{id, name, country, body, at, mine, crown}]} | {error:'auth'|'bad_channel'}
create or replace function hg_chat_list(token uuid, channel text, since bigint default 0) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pid bigint; cc text; ch text := coalesce(hg_chat_list.channel, ''); champ bigint; res jsonb;
begin
  select s.tg_id into pid from sessions s where s.token = hg_chat_list.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  if ch <> 'world' then
    select p.country::text into cc from hg_profiles p where p.tg_id = pid;
    if cc is null or ch <> 'c:' || cc then return jsonb_build_object('error', 'bad_channel'); end if;
  end if;
  if not exists (select 1 from hg_chat m   -- the client polls: nothing new is answered before any other work
                  where m.channel = ch and m.id > greatest(coalesce(hg_chat_list.since, 0), 0) and not m.hidden
                    and not exists (select 1 from hg_chat_blocks b where b.tg_id = pid and b.blocked = m.tg_id)) then
    return jsonb_build_object('msgs', '[]'::jsonb);
  end if;
  champ := hg_champion();
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'country', x.country, 'body', x.body,
                                               'at', to_char(x.at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                               'mine', x.tg_id = pid, 'crown', x.tg_id is not distinct from champ) order by x.id), '[]'::jsonb)
    into res
    from (select m.id, m.tg_id, p.name, p.country::text as country, m.body, m.at
            from hg_chat m join hg_profiles p on p.tg_id = m.tg_id
           where m.channel = ch and m.id > greatest(coalesce(hg_chat_list.since, 0), 0) and not m.hidden
             and not exists (select 1 from hg_chat_blocks b where b.tg_id = pid and b.blocked = m.tg_id)
           order by m.id desc limit 50) x;
  return jsonb_build_object('msgs', res);
end $$;

-- block a player by the name shown (ignoring case; inner runs of spaces read as one): his messages disappear for me
-- → {ok:true} | {error:'auth'|'not_found'|'self'}
create or replace function hg_chat_block(token uuid, name text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint; who bigint; nm text := regexp_replace(btrim(coalesce(hg_chat_block.name, '')), ' {2,}', ' ', 'g');
begin
  select s.tg_id into pid from sessions s where s.token = hg_chat_block.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select p.tg_id into who from hg_profiles p where lower(p.name) = lower(nm);
  if who is null then return jsonb_build_object('error', 'not_found'); end if;
  if who = pid then return jsonb_build_object('error', 'self'); end if;
  insert into hg_chat_blocks (tg_id, blocked) values (pid, who) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- report a message I can see; at 3 reports from different players it is hidden for everyone (the reports of one message
-- are serialised on its row, so parallel reports cannot both miss the third). → {ok:true} | {error:'auth'|'not_found'|'self'}
create or replace function hg_chat_report(token uuid, id bigint) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint; cc text; m hg_chat;
begin
  select s.tg_id into pid from sessions s where s.token = hg_chat_report.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  select * into m from hg_chat x where x.id = hg_chat_report.id for update;
  if m.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if m.channel <> 'world' then
    select p.country::text into cc from hg_profiles p where p.tg_id = pid;
    if cc is null or m.channel <> 'c:' || cc then return jsonb_build_object('error', 'not_found'); end if;
  end if;
  if m.tg_id = pid then return jsonb_build_object('error', 'self'); end if;
  insert into hg_chat_reports (msg_id, reporter) values (m.id, pid) on conflict do nothing;
  if not m.hidden and (select count(*) from hg_chat_reports r where r.msg_id = m.id) >= 3 then
    update hg_chat x set hidden = true where x.id = m.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- the country ladder
-- internal: per country, the rounds of [t0, t1): active members, rounds, gold, the first round. A round counts for the country
-- stamped on it when it was stored (hg_rounds.country; the profile's only for a round without one), so a player who changes
-- country after a week, or during it, moves none of the rounds he already played.
create or replace function hg_country_week(t0 timestamptz, t1 timestamptz)
returns table (country text, members int, rounds int, gold bigint, first_at timestamptz)
language sql stable set search_path = public, pg_temp as $$
  select coalesce(x.country, p.country)::text, count(distinct x.tg_id)::int, count(*)::int, sum(x.banked)::bigint, min(x.at)
    from hg_rounds x join hg_profiles p on p.tg_id = x.tg_id
   where x.at >= $1 and x.at < $2
   group by 1
$$;

-- internal: the opponent's position for position `pos` of `n` in the week starting `wk` (a Monday), or null for a rest.
-- Even week: (1-2) (3-4)…; odd week: (2-3) (4-5)…, #1 rests. An unpaired last position rests. The parity counts weeks from
-- Monday 2026-11-23 (ISO week 48, even), so the weeks alternate across a 53-week year (the remainder of an earlier week is
-- 0 or -1, which keeps those weeks right too).
create or replace function hg_ladder_opp(pos int, n int, wk date) returns int
language sql immutable set search_path = '' as $$
  select case when z.d between 1 and $2 then z.d end
    from (select case when ($1 % 2 = 1) = ((($3 - date '2026-11-23') / 7) % 2 = 0) then $1 + 1 else $1 - 1 end as d) z
$$;

-- internal: close the week starting `wk` (the caller holds advisory lock 7103): the new countries enter at the bottom, the
-- pairs play, the duels are stored, a winner from below takes the higher position. Score = gold / max(5, real members) (the
-- bots are members without gold). The winner is decided on the exact scores; the scores are stored rounded to 2 decimals,
-- as hg_ladder shows them, so a duel may read 10.08 : 10.08 with the lower country winning on the third decimal.
create or replace function hg_ladder_close(wk date) returns void
language plpgsql set search_path = public, pg_temp as $$
declare t0 timestamptz := wk::timestamp at time zone 'utc'; t1 timestamptz := (wk + 7)::timestamp at time zone 'utc'; n int;
begin
  select coalesce(max(l.pos), 0) into n from hg_ladder l;
  insert into hg_ladder (country, pos, since)
    select s.country, n + (row_number() over (order by s.first_at, s.country))::int, wk
      from hg_country_week(t0, t1) s
     where not exists (select 1 from hg_ladder l where l.country = s.country);
  select count(*) into n from hg_ladder;
  insert into hg_ladder_duels (week, pos, a, b, a_score, b_score, a_real, b_real, a_rounds, b_rounds, winner)
    with s as (select * from hg_country_week(t0, t1)),
         v as (select l.pos, l.country::text as country, coalesce(s.members, 0) as mem, coalesce(s.rounds, 0) as rounds,
                      coalesce(s.gold, 0)::numeric / greatest(5, coalesce(s.members, 0)) as exact
                 from hg_ladder l left join s on s.country = l.country::text)
    select wk, a.pos, a.country, b.country, trim_scale(round(a.exact, 2)), trim_scale(round(b.exact, 2)), a.mem, b.mem, a.rounds, b.rounds,
           case when b.country is null then null when b.exact > a.exact then b.country else a.country end
      from v a left join v b on b.pos = hg_ladder_opp(a.pos, n, wk)
     where coalesce(hg_ladder_opp(a.pos, n, wk), n + 1) > a.pos;   -- the higher of each pair, and every rest
  update hg_ladder l set pos = case when l.country = d.a then d.pos + 1 else d.pos end
    from hg_ladder_duels d
   where d.week = wk and d.b is not null and d.winner = d.b and l.country in (d.a, d.b);
end $$;

-- the ladder: closes every finished week first (lazily, once), then the open week live.
-- → {week_start, week_end, iso_week, ladder:[{pos, country, real, bots, score, rounds, opp, opp_score, side, crown}],
--    mine:{country, pos, opp, score, opp_score, side, ends_at} | null, last:[{week, a, b, a_score, b_score, winner}]}
-- side: 'up' (the opponent is above), 'down' (below) or 'rest'. score: gold / max(5, real), 2 decimals at most.
-- mine is null for a null or unknown token, a player without a profile, or a country not on the ladder yet.
-- last: the duels of the previous week (rests left out), by position.
create or replace function hg_ladder(token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint; cc text; st date; n int; res jsonb;
        mon date := (date_trunc('week', now() at time zone 'utc'))::date;
        t0 timestamptz := mon::timestamp at time zone 'utc'; t1 timestamptz := (mon + 7)::timestamp at time zone 'utc';
        iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"';
begin
  select l.week into st from hg_ladder_state l where l.id = 1;
  if st is null or st < mon then
    perform pg_advisory_xact_lock(7103, 0);   -- one closer; a second caller waits, then finds the weeks closed
    select l.week into st from hg_ladder_state l where l.id = 1;
    if st is null then
      st := least(mon, coalesce((select (date_trunc('week', min(x.at) at time zone 'utc'))::date from hg_rounds x), mon));
      insert into hg_ladder_state (id, week) values (1, st);
    end if;
    while st < mon loop
      perform hg_ladder_close(st);
      st := st + 7;
      update hg_ladder_state l set week = st where l.id = 1;
    end loop;
  end if;
  if hg_ladder.token is not null then select s.tg_id into pid from sessions s where s.token = hg_ladder.token; end if;
  if pid is not null then select p.country::text into cc from hg_profiles p where p.tg_id = pid; end if;
  select coalesce(max(l.pos), 0) into n from hg_ladder l;
  with s as (select * from hg_country_week(t0, t1)),
       v as (select l.pos, l.country::text as country from hg_ladder l
             union all
             select n + (row_number() over (order by s.first_at, s.country))::int, s.country from s
              where not exists (select 1 from hg_ladder l where l.country::text = s.country)),
       r as (select v.pos, v.country, coalesce(s.members, 0) as mem, coalesce(s.rounds, 0) as rounds,
                    trim_scale(round(coalesce(s.gold, 0)::numeric / greatest(5, coalesce(s.members, 0)), 2)) as score,
                    hg_ladder_opp(v.pos, (select count(*)::int from v), mon) as op
               from v left join s on s.country = v.country),
       f as (select r.*, o.country as opp, o.score as opp_score,
                    case when r.op is null then 'rest' when r.op < r.pos then 'up' else 'down' end as side
               from r left join r o on o.pos = r.op)
  select jsonb_build_object(
    'week_start', to_char(t0 at time zone 'utc', iso),
    'week_end', to_char(t1 at time zone 'utc', iso),
    'iso_week', extract(week from mon)::int,
    'ladder', coalesce((select jsonb_agg(jsonb_build_object('pos', f.pos, 'country', f.country, 'real', f.mem, 'bots', greatest(0, 5 - f.mem),
                                                            'score', f.score, 'rounds', f.rounds, 'opp', f.opp, 'opp_score', f.opp_score,
                                                            'side', f.side, 'crown', f.pos = 1) order by f.pos) from f), '[]'::jsonb),
    'mine', (select jsonb_build_object('country', f.country, 'pos', f.pos, 'opp', f.opp, 'score', f.score, 'opp_score', f.opp_score,
                                       'side', f.side, 'ends_at', to_char(t1 at time zone 'utc', iso)) from f where f.country = cc),
    'last', coalesce((select jsonb_agg(jsonb_build_object('week', to_char(d.week, 'YYYY-MM-DD'), 'a', d.a::text, 'b', d.b::text,
                                                          'a_score', trim_scale(round(d.a_score, 2)), 'b_score', trim_scale(round(d.b_score, 2)),
                                                          'winner', d.winner::text) order by d.pos)
                        from hg_ladder_duels d where d.week = mon - 7 and d.b is not null), '[]'::jsonb))
  into res;
  return res;
end $$;

-- ---------------------------------------------------------------- the share card
-- png: base64 PNG data (a data:image/png;base64, prefix and whitespace are allowed), at most 400 KB decoded, framed as a PNG
-- (the signature, the 25-byte IHDR chunk first, the 12-byte IEND chunk last, at least 57 bytes: room for one chunk between
-- them, as a PNG needs an IDAT); 6 an hour per player. Storage: a card lives a day, a player keeps the images of his newest
-- 3 cards (older ones are emptied: the row still counts for the hourly limit), and all cards together stay under 50 MB
-- ('rate' when this one would pass it; parallel puts of different players may pass it by a card or two).
-- → {ok:true, id, url} | {error:'auth'|'too_big'|'rate'|'bad_png'}
create or replace function hg_card_put(token uuid, png text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid bigint; b64 text; bin bytea; cid uuid;
begin
  select s.tg_id into pid from sessions s where s.token = hg_card_put.token;
  if pid is null then return jsonb_build_object('error', 'auth'); end if;
  if hg_card_put.png is null then return jsonb_build_object('error', 'bad_png'); end if;
  if char_length(hg_card_put.png) > 600000 then return jsonb_build_object('error', 'too_big'); end if;
  b64 := regexp_replace(regexp_replace(hg_card_put.png, '^data:image/png;base64,', '', 'i'), '[[:space:]]+', '', 'g');
  if b64 = '' or char_length(b64) % 4 <> 0 or b64 !~ '^[A-Za-z0-9+/]+={0,2}$' then return jsonb_build_object('error', 'bad_png'); end if;
  if char_length(b64) > 546136 then return jsonb_build_object('error', 'too_big'); end if;   -- 4 * ceil(409600 / 3)
  begin
    bin := decode(b64, 'base64');
  exception when others then
    return jsonb_build_object('error', 'bad_png');
  end;
  if octet_length(bin) > 409600 then return jsonb_build_object('error', 'too_big'); end if;
  if octet_length(bin) < 57 or substring(bin from 1 for 8) <> '\x89504e470d0a1a0a'::bytea   -- 8 signature + 25 IHDR + 12 (a chunk) + 12 IEND
     or substring(bin from 9 for 8) <> '\x0000000d49484452'::bytea                          -- the IHDR chunk first (13 data bytes)
     or substring(bin from octet_length(bin) - 11 for 12) <> '\x0000000049454e44ae426082'::bytea then   -- the IEND chunk last
    return jsonb_build_object('error', 'bad_png');
  end if;
  perform pg_advisory_xact_lock(7104, (pid % 2000000000)::int);   -- one put at a time per player: the hourly limit cannot race
  if (select count(*) from hg_cards c where c.tg_id = pid and c.at > now() - interval '1 hour') >= 6 then
    return jsonb_build_object('error', 'rate');
  end if;
  delete from hg_cards c where c.at < now() - interval '1 day';   -- Telegram reads a card when the story editor opens
  update hg_cards c set png = ''::bytea                           -- keep the images of my newest 2 (+ this one = 3)
   where c.tg_id = pid and octet_length(c.png) > 0
     and c.id not in (select x.id from hg_cards x where x.tg_id = pid and octet_length(x.png) > 0 order by x.at desc limit 2);
  if (select coalesce(sum(octet_length(c.png)), 0) from hg_cards c) + octet_length(bin) > 52428800 then   -- 50 MB for all cards
    return jsonb_build_object('error', 'rate');
  end if;
  insert into hg_cards as c (tg_id, png) values (pid, bin) returning c.id into cid;
  return jsonb_build_object('ok', true, 'id', cid, 'url', 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/hg-card?id=' || cid::text);
end $$;

-- for the Edge Function hg-card only (service_role): a card as base64 text without line breaks, or null (no such card, or
-- its image was emptied)
create or replace function hg_card_get(id uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select translate(encode(c.png, 'base64'), E'\n', '') from hg_cards c where c.id = $1 and octet_length(c.png) > 0
$$;

revoke all on function hg_champion(), hg_chat_clean(text), hg_country_week(timestamptz, timestamptz), hg_ladder_opp(int, int, date),
  hg_ladder_close(date), hg_card_get(uuid) from public, anon, authenticated;
grant execute on function hg_card_get(uuid) to service_role;
revoke all on function hg_profile_get(uuid), hg_board(uuid, text), hg_chat_send(uuid, text, text), hg_chat_list(uuid, text, bigint),
  hg_chat_block(uuid, text), hg_chat_report(uuid, bigint), hg_ladder(uuid), hg_card_put(uuid, text) from public;
grant execute on function hg_profile_get(uuid), hg_board(uuid, text), hg_chat_send(uuid, text, text), hg_chat_list(uuid, text, bigint),
  hg_chat_block(uuid, text), hg_chat_report(uuid, bigint), hg_ladder(uuid), hg_card_put(uuid, text) to anon, authenticated;
