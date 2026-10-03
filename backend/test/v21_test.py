# v21 (lucky chests) checks against the local database, every app call as the anon role.
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
A = 997000001
def wipe():
    for t in ('items', 'chests', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'sessions', 'players'):
        q(f'delete from {t} where tg_id = %s', A)
wipe()
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Lucky', 'stark', 0, %s, 1)", A, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 0, 'made': '2026-10-03', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, None, None]}))
tok = q1('insert into sessions (tg_id) values (%s) returning token::text', A); anon('econ_state', token=tok, seat=0)
L = q1("select v from econ_config where k = 'lucky'"); CH = q1("select v from econ_config where k = 'chests'")
ORD = ['wood', 'iron', 'valyrian', 'dragon']
check('three taps; chances wood 35, iron 20, valyrian 8, dragon 0', L['taps'] == 3 and L['p'] == {'wood': 35, 'iron': 20, 'valyrian': 8, 'dragon': 0}, L)
q("update wallets set gems = 1000000 where tg_id = %s and seat = 0", A)
N = 600; res = []
for i in range(N): res.append(anon('chest_open', token=tok, seat=0, tier='iron', source='shop'))
ok_shape = all(r['from'] == 'iron' and len(r['taps']) == 3 for r in res)
check('every answer says where it started, where it ended and the three taps', ok_shape)
cons = all(ORD.index(r['tier']) - ORD.index('iron') == sum(1 for t in r['taps'] if t) for r in res)
check('the final tier is the start + one step for every lucky tap', cons)
# the first tap from iron hits with p 20%: 600 chests → expect ~120 (±4σ ≈ ±40)
first = sum(1 for r in res if r['taps'][0]); check('the first tap from iron hits about 20% of the time', 80 <= first <= 160, first)
up = {t: sum(1 for r in res if r['tier'] == t) for t in ORD}
check('most iron chests stay iron, some reach valyrian, a few dragon, none drop', up['wood'] == 0 and up['iron'] > N * 0.4 and up['valyrian'] > 0 and up['iron'] + up['valyrian'] + up['dragon'] == N, up)
inrange = all(CH[r['tier']]['gold'][0] <= r['gold'] <= CH[r['tier']]['gold'][1] and CH[r['tier']]['gems'][0] <= r['gems'] <= CH[r['tier']]['gems'][1] for r in res)
check('gold and dragonglass come from the final tier', inrange)
rows = q("select tier, asked, count(*) from chests where tg_id = %s group by 1, 2", A)
check('the chest rows keep the final tier and the asked one', {(t, a): n for t, a, n in rows} == {(t, 'iron'): n for t, n in up.items() if n}, rows)
price = CH['iron']['price']
spent = -q1("select sum(delta) from ledger where tg_id = %s and reason = 'chest' and cur = 'gems' and delta < 0", A)
check('the price is the asked chest\'s price (iron, %d each)' % price, spent == price * N, (spent, price * N))
d = anon('chest_open', token=tok, seat=0, tier='dragon', source='shop')
check('a dragon chest cannot go higher: three misses', d['tier'] == 'dragon' and d['taps'] == [False, False, False], d['taps'])
# the free chest: still once a day, and it may still climb
w = anon('chest_open', token=tok, seat=0, tier='wood', source='shop')
check('the free wooden chest opens and may climb', w['from'] == 'wood' and w['tier'] in ORD and len(w['taps']) == 3, w['tier'])
check('a second free chest the same day is refused', err('chest_open', token=tok, seat=0, tier='wood', source='shop') == 'the free chest is not ready')
check('the owner view counts by asked and final tier', q1("select sum(chests) from v_lucky where asked = 'iron'") >= N)
check('the app cannot read the view', q1("select has_table_privilege('anon', 'v_lucky', 'select')") is False)
wipe()
print('FAILED:' if fails else 'all v21 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
