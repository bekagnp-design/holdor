# v39 (no wasted cards from chests): a tower or spell whose held copies cover every level left is out of the chest pool;
# a maxed one too; champions keep the old rule. Local database.
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
            c.execute(f'select {fn}({args})', kw); return c.fetchone()[0]
        finally: c.execute('reset role')
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
# realms_test reloads the chain up to v30 (and so v7's ec_pool): load v39 again first
with db.cursor() as c: c.execute(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'holdor_v39.sql'), encoding='utf-8').read())
A = 993900001
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', A)
seat = {'house': 'stark', 'langI': 0, 'made': '2026-11-04', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Ann', 'stark', 0, %s, 1)", A, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat, None, None]}))
tok = q1('insert into sessions (tg_id) values (%s) returning token::text', A)
anon('econ_state', token=tok, seat=0)
for i in range(1, 51):
    q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", A, i)
smax = q1("select (v->>'s')::int from econ_config where k = 'max'")
tmax = q1("select (v->>'t')::int from econ_config where k = 'max'")
def pool(): return [r[0] for r in q("select p.k from wallets w, ec_pool(w) p where w.tg_id = %s and w.seat = 0", A)]
def need(k, frm, to): return q1("select sum(ec_card_need(%s, l)) from generate_series(%s, %s) l", k, frm, to - 1)
def setw(levels, cards): q("update wallets set levels = %s, cards = %s where tg_id = %s and seat = 0", json.dumps(levels), json.dumps(cards), A)
setw({}, {})
p0 = pool()
check('all spells and towers are in the pool at the start', 's:arrows' in p0 and 's:fire' in p0 and 't:watch' in p0 and any(k.startswith('c:') for k in p0), str(p0))
n = need('s:arrows', 1, smax)
setw({}, {'s:arrows': n - 1})
check('one copy short of covering all levels: still in the pool', 's:arrows' in pool(), n)
setw({}, {'s:arrows': n})
check('copies cover every level left: out of the pool', 's:arrows' not in pool() and 's:fire' in pool(), n)
setw({'s:fire': smax}, {})
check('a maxed spell: out of the pool', 's:fire' not in pool())
setw({'s:fire': smax - 1}, {'s:fire': need('s:fire', smax - 1, smax)})
check('one level left and its copies held: out', 's:fire' not in pool())
nt = need('t:watch', 3, tmax)
setw({'t:watch': 3}, {'t:watch': nt})
check('a tower covered from level 3: out', 't:watch' not in pool() and 't:scorp' in pool(), nt)
setw({'t:watch': tmax}, {})
check('a maxed tower: out', 't:watch' not in pool())
champ = next(k for k in p0 if k.startswith('c:'))
setw({}, {champ: 100000})
check('a champion with a huge stack stays (ascension uses copies)', champ in pool(), champ)
# chests never give a covered spell
cov = {}
for k in [x for x in p0 if x[0] == 's']: cov[k] = need(k, 1, smax)
setw({}, cov)
got = set()
for _ in range(25):
    q("update wallets set cards = %s where tg_id = %s and seat = 0", json.dumps(cov), A)
    for st in q("select s.k from wallets w, ec_card_stack(w, 'dragon', 0, array[]::text[]) s where w.tg_id = %s and w.seat = 0", A): got.add(st[0])
check('25 dragon stacks with every spell covered: no spell card', got and not any(k.startswith('s:') for k in got), str(sorted(got)))
print('FAILS:', fails) if fails else print('all v39 checks OK')
raise SystemExit(1 if fails else 0)
