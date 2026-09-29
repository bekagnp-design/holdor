# v13 (account levels to 60 + milestone gifts) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v13.sql (run_all.sh). Re-runnable: own players 980000001–2.
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
T1, T2 = 980000001, 980000002
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', T1, T2)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((T1, 'M1'), (T2, 'M2')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-09-30'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2)}
for t in (T1, T2): anon('econ_state', token=tok[t], seat=0)
def need(l): return sum(15 + 8 * k + k * k for k in range(1, l))   # xp to stand at level l
def setxp(t, xp): q("update wallets set xp = %s where tg_id = %s and seat = 0", xp, t)
MS = q1("select v from econ_config where k = 'milestones'")

check('the account level goes on to 60 and stops there', [q1('select xp_level(%s)', need(l)) for l in (1, 10, 40, 41, 60)] == [1, 10, 40, 41, 60] and q1('select xp_level(%s)', need(60) * 5) == 60 and q1('select xp_level(%s)', need(60) - 1) == 59)
check('six milestones at 10, 20 … 60, each a real gift', sorted(int(k) for k in MS) == [10, 20, 30, 40, 50, 60] and all(set(v) <= {'gems', 'gold', 'books', 'gear'} for v in MS.values()))
check('bigger levels give more dragonglass', [MS[str(l)]['gems'] for l in (10, 20, 30, 40, 50, 60)] == sorted(MS[str(l)]['gems'] for l in (10, 20, 30, 40, 50, 60)))

st = anon('milestone_state', token=tok[T1], seat=0)
check('a fresh seat: level 1, six items, none ready or claimed', st['level'] == 1 and len(st['items']) == 6 and not any(i['ready'] or i['claimed'] for i in st['items']), st)
check('too low a level is refused', 'level 1 of 10' in (err('milestone_claim', token=tok[T1], seat=0, lvl=10) or ''))
check('a level that is no milestone is refused', err('milestone_claim', token=tok[T1], seat=0, lvl=15) == 'no such milestone')

setxp(T1, need(10)); g0 = q1("select gems from wallets where tg_id = %s and seat = 0", T1); c0 = q1("select coalesce((cards->>'b:c')::int, 0) from wallets where tg_id = %s and seat = 0", T1); i0 = q1("select count(*) from items where tg_id = %s", T1)
st = anon('milestone_state', token=tok[T1], seat=0)
check('at level 10 the first is ready, the rest not', st['level'] == 10 and [i['ready'] for i in st['items']] == [True, False, False, False, False, False], st)
r = anon('milestone_claim', token=tok[T1], seat=0, lvl=10)
new = q("select rar, tier, src from items where tg_id = %s", T1)
check('level 10: 30 dragonglass, 3 Common books, one item Rare+ ★2+', r['ok'] and q1("select gems from wallets where tg_id = %s and seat = 0", T1) == g0 + 30
      and q1("select (cards->>'b:c')::int from wallets where tg_id = %s and seat = 0", T1) == c0 + 3 and len(new) == i0 + 1 and new[-1][0] >= 2 and new[-1][1] >= 2 and new[-1][2] == 'milestone:10', (r['reward'], new))
check('the ledger says why', q1("select count(*) from ledger where tg_id = %s and reason = 'milestone' and ref = '10'", T1) >= 1)
check('the state now shows it claimed, not ready', [(i['claimed'], i['ready']) for i in r['milestones']['items']][0] == (True, False))
check('a second claim is refused', err('milestone_claim', token=tok[T1], seat=0, lvl=10) == 'already claimed')
check('level 20 is still closed', 'level 10 of 20' in (err('milestone_claim', token=tok[T1], seat=0, lvl=20) or ''))

setxp(T1, need(60)); g1 = q1("select gems from wallets where tg_id = %s and seat = 0", T1)
for l in (20, 30, 40, 50, 60): anon('milestone_claim', token=tok[T1], seat=0, lvl=l)
check('all the rest at level 60: the gems add up to the table', q1("select gems from wallets where tg_id = %s and seat = 0", T1) == g1 + sum(MS[str(l)]['gems'] for l in (20, 30, 40, 50, 60)))
check('level 60 gives two ★5 Legendary-grade items (Epic+)', len(q("select 1 from items where tg_id = %s and src = 'milestone:60' and tier = 5 and rar >= 4", T1)) == 2)
check('six claims in all, nothing left ready', anon('milestone_state', token=tok[T1], seat=0)['items'] == [dict(i, ready=False, claimed=True) for i in anon('milestone_state', token=tok[T1], seat=0)['items']])

check('another player cannot claim with his token for a seat that is not high enough', 'level 1 of 10' in (err('milestone_claim', token=tok[T2], seat=0, lvl=10) or ''))
check('no token, no state', err('milestone_state', token='00000000-0000-0000-0000-000000000000', seat=0) == 'bad session')
try:
    with db.cursor() as c:
        c.execute('set role anon'); c.execute('select ms_state(w) from wallets w limit 1'); bad = False
except Exception as e: bad = 'permission denied' in str(e)
finally: db.rollback() if not db.autocommit else None; db.cursor().execute('reset role')
check('the internal ms_state is not callable by the app', bad)
for t in ('items', 'ledger', 'sessions'): q(f'delete from {t} where tg_id in (%s, %s)', T1, T2)
print('FAILED:' if fails else 'all v13 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
