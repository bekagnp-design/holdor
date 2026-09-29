# v18 (Earn: the estate and the two-day events) checks against the local database, every app call as the anon role.
import os, json
import psycopg2
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return r[0][0] if r else None
def anon(fn, **kw):
    with db.cursor() as c:
        c.execute('set role anon')
        try:
            args = ', '.join(f'{k} := %({k})s' for k in kw)
            c.execute(f'select {fn}({args})', {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in kw.items()})
            return c.fetchone()[0]
        finally: c.execute('reset role')
def err(fn, **kw):
    try: anon(fn, **kw); return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
A = 994000001
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', A)
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Ann', 'stark', 0, %s, 1)", A, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 0, 'made': '2026-09-30', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, None, None]}))
tok = q1('insert into sessions (tg_id) values (%s) returning token::text', A); anon('econ_state', token=tok, seat=0)
CFG = q1("select v from econ_config where k = 'estate'"); B = {b['id']: b for b in CFG['buildings']}
def need(l): return sum(15 + 8 * k + k * k for k in range(1, l))
def setxp(l): q("update wallets set xp = %s where tg_id = %s and seat = 0", need(l), A)
def setgold(g): q("update wallets set gold = %s where tg_id = %s and seat = 0", g, A)
def W(): return q("select gold, claims from wallets where tg_id = %s and seat = 0", A)[0]
def back(hours): q("update wallets set claims = jsonb_set(claims, '{estate,at}', to_jsonb(now() - make_interval(secs => %s))) where tg_id = %s and seat = 0", hours * 3600, A)
def expect_pending(rate, hours):
    m0, now = q("select date_trunc('week', now() at time zone 'utc') at time zone 'utc', now()")[0]
    from datetime import timedelta
    hrs = min(3.0, hours); st = now - timedelta(hours=hrs); end = min(now, m0 + timedelta(days=2)); begin = max(st, m0)
    ov = max(0.0, (end - begin).total_seconds() / 3600.0)
    return int(rate * (hrs + ov * 0.5))

check('nine buildings, each opens at a higher account level and costs more', len(CFG['buildings']) == 9 and [b['unlock'] for b in CFG['buildings']] == sorted(b['unlock'] for b in CFG['buildings']) and [b['cost'] for b in CFG['buildings']] == sorted(b['cost'] for b in CFG['buildings']))
check('the first level pays back in about 40 hours for every building', all(abs(b['cost'] / b['income'] - 40) < 0.5 for b in CFG['buildings']), [(b['id'], b['cost'] / b['income']) for b in CFG['buildings']])
paybacks = {b['id']: [q1('select es_cost(%s::jsonb, %s::jsonb, %s)', json.dumps(CFG), json.dumps(b), n) / q1('select es_income(%s::jsonb, %s::jsonb, %s)', json.dumps(CFG), json.dumps(b), n) for n in (1, 5, 10)] for b in CFG['buildings']}
check('upgrades pay back slower and slower (level 5 ≥ 3× level 1, level 10 ≥ 10×)', all(p[1] >= 3 * p[0] and p[2] >= 10 * p[0] for p in paybacks.values()), paybacks['farm'])
check('level costs: farm 800, 1450, 2600 (×1.8, rounded to 50); income 20, 30, 40', [q1('select es_cost(%s::jsonb, %s::jsonb, %s)', json.dumps(CFG), json.dumps(B['farm']), n) for n in (1, 2, 3)] == [800, 1450, 2600] and [q1('select es_income(%s::jsonb, %s::jsonb, %s)', json.dumps(CFG), json.dumps(B['farm']), n) for n in (1, 2, 3)] == [20, 30, 40])
top = sum(q1('select es_income(%s::jsonb, %s::jsonb, 10)', json.dumps(CFG), json.dumps(b)) for b in CFG['buildings'])
check('even everything at level 10 is capped by the 3-hour pile: one collection is at most 3 × the hourly rate', CFG['cap_h'] == 3, top)

s = anon('estate_state', token=tok, seat=0)
check('a fresh seat: nothing built, no income, nine cards, none open', s['per_hour'] == 0 and s['pending'] == 0 and len(s['items']) == 9 and not any(i['open'] for i in s['items']) and s['level'] == 1, s['level'])
check('the farm needs account level 3', err('estate_build', token=tok, seat=0, bld='farm') == 'account level 3 is needed')
setxp(3); setgold(700)
check('level 3 but not enough gold: refused', 'not enough' in (err('estate_build', token=tok, seat=0, bld='farm') or '').lower())
setgold(5000)
r = anon('estate_build', token=tok, seat=0, bld='farm')
check('the farm is built: 800 gold, 20 an hour, the clock starts', r['ok'] and r['lvl'] == 1 and W()[0] == 4200 and r['estate']['per_hour'] == 20 and r['estate']['at'] is not None, r['estate']['per_hour'])
check('nothing to collect at once', err('estate_collect', token=tok, seat=0) == 'nothing to collect yet')
check('level 2 of the farm needs account level 5', err('estate_build', token=tok, seat=0, bld='farm') == 'account level 5 is needed')
check('an unknown building', err('estate_build', token=tok, seat=0, bld='castle') == 'no such building')
setxp(5); back(1)
g0 = W()[0]; r = anon('estate_build', token=tok, seat=0, bld='farm')
check('upgrade to 2 costs 1450, pays the hour that had piled up first (at the old rate), and raises the income to 30', r['lvl'] == 2 and r['cost'] == 1450 and r['collected'] == expect_pending(20, 1.0) and W()[0] == g0 + r['collected'] - 1450 and r['estate']['per_hour'] == 30, (r['collected'], expect_pending(20, 1.0)))
back(2); s = anon('estate_state', token=tok, seat=0)
check('2 hours later: the pile is 2 × 30 (+ the Boom share on Monday–Tuesday)', s['pending'] == expect_pending(30, 2.0), (s['pending'], expect_pending(30, 2.0)))
g0 = W()[0]; r = anon('estate_collect', token=tok, seat=0)
check('collected: the gold is in the wallet, the ledger says estate_income', r['ok'] and W()[0] == g0 + r['gold'] and r['gold'] == expect_pending(30, 2.0) and q1("select count(*) from ledger where tg_id = %s and reason = 'estate_income'", A) >= 2)
check('a second collection at once is refused', err('estate_collect', token=tok, seat=0) == 'nothing to collect yet')
back(10); s = anon('estate_state', token=tok, seat=0)
check('10 hours away: the pile stops at 3 hours', s['pending'] == expect_pending(30, 10.0) and s['pending'] <= int(30 * 3 * 1.5), s['pending'])
# the Boom
ev = s['event']; boom_now = ev['kind'] == 'boom' and ev['active']
check('the state carries the event: kind, whether it is on, start and end (two days)', ev['kind'] in ('boom', 'cup') and (ev['ends'] > ev['starts']) and ev['boom_pct'] == 50, ev)
check('the schedule: Mon–Tue Boom, Wed–Thu the Cup is next, Fri–Sat Cup, Sun the Boom is next', [tuple(q("select kind, active from ev_at(%s)", t)[0]) for t in ('2026-09-28 00:00+00', '2026-09-29 23:59+00', '2026-09-30 12:00+00', '2026-10-01 12:00+00', '2026-10-02 00:00+00', '2026-10-03 23:59+00', '2026-10-04 12:00+00')] == [('boom', True), ('boom', True), ('cup', False), ('cup', False), ('cup', True), ('cup', True), ('boom', False)])
check('an event lasts two days', all(q1("select extract(epoch from t1 - t0) from ev_at(%s)", t) == 172800 for t in ('2026-09-28 12:00+00', '2026-10-02 12:00+00', '2026-10-01 12:00+00', '2026-10-04 12:00+00')))
check('the Cup doubles ranked duel gifts (the settling code knows it)', 'cup' in q1("select prosrc from pg_proc where proname = 'du_settle'"))
# upgrades to the top and the account-level rule
q("update wallets set claims = jsonb_set(claims, '{estate,b,farm}', '10') where tg_id = %s and seat = 0", A); setgold(10**9)
check('at level 10 there is no next level', err('estate_build', token=tok, seat=0, bld='farm') == 'already at the top level')
setxp(20); q("update wallets set claims = jsonb_set(claims, '{estate,b,farm}', '3') where tg_id = %s and seat = 0", A)
setxp(8)
check('level 4 of the farm needs account level 9 (3 + 2·3)', err('estate_build', token=tok, seat=0, bld='farm') == 'account level 9 is needed')
setxp(9)
check('...and at account level 9 it is built', anon('estate_build', token=tok, seat=0, bld='farm')['lvl'] == 4)
check('no token, no estate', err('estate_state', token='00000000-0000-0000-0000-000000000000', seat=0) == 'bad session')
try:
    with db.cursor() as c:
        c.execute('set role anon'); c.execute('select es_state(w) from wallets w limit 1'); bad = False
except Exception as e: bad = 'permission denied' in str(e)
finally: db.cursor().execute('reset role')
check('the internals are closed to the app; the owner view counts', bad and q1("select count(*) from v_estate") >= 1)
for t in ('ledger', 'sessions'): q(f'delete from {t} where tg_id = %s', A)
q('delete from players where tg_id = %s', A)
print('FAILED:' if fails else 'all v18 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
