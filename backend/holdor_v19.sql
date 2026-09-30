-- ============================================================
--  HOLDOR backend v19 (2026-09-30) — duel fixes (game v1.0.75). Run AFTER holdor_v18.sql (it only needs v15). Safe to re-run.
--  * A ranked duel with nobody to match fell back to a bot duel, and every tap opened one more (MR B's seat had 10 in two minutes):
--    the fallback now reuses the open practice duel.
--  * The duplicates already open are closed (the newest one per seat stays).
-- ============================================================
create or replace function duel_start(token uuid, seat int, kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid bigint; w wallets; r ratings; g record; d duels; today int; bot record; hours int := 24;
begin
  pid := ec_session(token);
  w := ec_wallet(pid, seat); w := ec_energy(w);
  if kind not in ('rank', 'friend', 'ai') then raise exception 'bad duel'; end if;
  if not exists (select 1 from progress p where p.tg_id = pid and p.seat = duel_start.seat) then raise exception 'clear a stage first'; end if;
  perform du_state(w);      -- settles what can be settled
  if exists (select 1 from duels x where x.a = pid and x.a_seat = duel_start.seat and x.status = 'open' and x.kind = duel_start.kind and x.expires_at > now()) then
    raise exception 'you already have an open % duel', kind; end if;
  r := ec_rating(pid, seat);
  if kind = 'rank' then
    select count(*) into today from duels x where x.a = pid and x.a_seat = duel_start.seat and x.kind = 'rank' and x.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    if today >= 5 then raise exception 'five ranked duels a day are the limit'; end if;
    select h.tg_id, h.seat, h.waves, h.kills, coalesce(rt.rating, 1000) as rating, p.name into g
      from (select distinct on (b.tg_id, b.seat) b.tg_id, b.seat, b.waves, coalesce(b.kills, 0) as kills from battles b
             where b.kind = 'hold' and b.status = 'done' and b.waves is not null and b.finished_at > now() - interval '7 days' and b.tg_id <> pid
             order by b.tg_id, b.seat, b.waves * 1000 + least(coalesce(b.kills, 0), 999) desc) h
      join players p on p.tg_id = h.tg_id left join ratings rt on rt.tg_id = h.tg_id and rt.seat = h.seat
     order by abs(coalesce(rt.rating, 1000) - r.rating), random() limit 1;
    if g.tg_id is not null then
      insert into duels (kind, a, a_seat, b, b_seat, b_name, b_rating, b_waves, b_kills, b_score, expires_at)
        values ('rank', pid, seat, g.tg_id, g.seat, g.name || case when g.seat > 0 then ' ' || (array['', 'II', 'III'])[g.seat + 1] else '' end, g.rating, g.waves, g.kills, g.waves * 1000 + least(g.kills, 999), now() + interval '24 hours') returning * into d;
    else kind := 'ai'; end if;
  end if;
  if kind = 'ai' then
    -- a ranked duel with nobody to match falls back to the bot: reuse an open practice duel instead of opening one more every tap
    select * into d from duels x where x.a = pid and x.a_seat = duel_start.seat and x.kind = 'ai' and x.status = 'open' and x.expires_at > now() order by x.created_at desc limit 1;
    if d.id is null then
      select * into bot from du_bot(r.rating);
      insert into duels (kind, a, a_seat, b_name, b_rating, b_waves, b_kills, b_score, expires_at)
        values ('ai', pid, seat, 'Bot', r.rating, bot.waves, bot.kills, bot.waves * 1000 + least(bot.kills, 999), now() + interval '24 hours') returning * into d;
    end if;
  elsif kind = 'friend' then
    insert into duels (kind, a, a_seat, expires_at) values ('friend', pid, seat, now() + interval '48 hours') returning * into d;
  end if;
  return jsonb_build_object('ok', true, 'duel', du_json(d, pid, seat)) || jsonb_build_object('duels', du_state(w));
end $$;


update duels d set status = 'expired', settled_at = now()
 where d.kind = 'ai' and d.status = 'open'
   and exists (select 1 from duels n where n.a = d.a and n.a_seat = d.a_seat and n.kind = 'ai' and n.status = 'open' and n.created_at > d.created_at);
revoke all on function duel_start(uuid, int, text) from public;
grant execute on function duel_start(uuid, int, text) to anon, authenticated;
