# v17 (sources, retention, funnel) checks against the local database.
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
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
A, B, C, D = 993000001, 993000002, 993000003, 993000004
ALL = (A, B, C, D)
for t in ('referrals', 'payments', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'sessions', 'players'):
    q(f'delete from {t} where ' + ('invitee' if t == 'referrals' else 'tg_id') + ' in (%s, %s, %s, %s)', *ALL)
for t, nm in ((A, 'A'), (B, 'B'), (C, 'C'), (D, 'D')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, '{}', 1)", t, nm)
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in ALL}
check('a source is set once, for a new player', anon('src_set', token=tok[A], code='YT1')['ok'] and q1('select src from players where tg_id = %s', A) == 'yt1')
check('the second call changes nothing', anon('src_set', token=tok[A], code='tg')['ok'] is False and q1('select src from players where tg_id = %s', A) == 'yt1')
check('a bad code is ignored', anon('src_set', token=tok[B], code='a b; drop') == {'ok': False} and q1('select src from players where tg_id = %s', B) is None)
q("update players set created_at = now() - interval '5 days' where tg_id = %s", C)
check('an old player gets no source', anon('src_set', token=tok[C], code='yt1')['ok'] is False)
q("insert into referrals (invitee, inviter) values (%s, %s)", D, A)
check('an invited player is a ref player', q1('select src from players where tg_id = %s', D) == 'ref')
# funnel and sources
for t in (A, B): q("insert into progress (tg_id, seat, mode, stage, stars) select %s, 0, 'c', g, 3 from generate_series(1, %s) g", t, 5 if t == A else 1)
src = {r[0]: r for r in q('select source, players, first_stage, reached_5, payers, stars from v_sources')}
check('v_sources: yt1 has 1 player who reached 5; direct has B (1 stage) and C', src['yt1'][1] == 1 and src['yt1'][3] == 1 and src['direct'][1] >= 2 and src['ref'][1] >= 1, src)
f = q('select arrived, first_stage, five_stages, paid from v_funnel')[0]
check('v_funnel counts arrivals, first stages, five stages', f[0] >= 4 and f[1] >= 2 and f[2] >= 1, f)
# retention: A joined 8 days ago, fought on day 0, day 1 and day 7
q("update players set created_at = now() - interval '8 days' where tg_id = %s", A)
for ago in (8, 7, 1):
    q("insert into battles (tg_id, seat, kind, status, waves, kills, started_at, finished_at) values (%s, 0, 'hold', 'done', 3, 10, now() - (%s || ' days')::interval - interval '5 minutes', now() - (%s || ' days')::interval)", A, ago, ago)
r = q("select players, day0, d1, d7, d30 from v_retention where day = (now() - interval '8 days')::date")[0]
check('v_retention: the day-8 cohort has A, back on day 0, day 1 and day 7, not day 30', r[0] >= 1 and r[1] >= 1 and r[2] >= 1 and r[3] >= 1 and r[4] == 0, r)
try:
    with db.cursor() as c:
        c.execute('set role anon'); c.execute('select 1 from v_sources'); bad = False
except Exception as e: bad = 'permission denied' in str(e)
finally: db.cursor().execute('reset role')
check('the views are closed to the app', bad)
try:
    anon('src_set', token='00000000-0000-0000-0000-000000000000', code='yt1'); e = ''
except Exception as ex: e = str(ex)
check('no token, no source', 'bad session' in e)
for t in ('referrals', 'payments', 'battles', 'progress', 'sessions', 'players'):
    q(f'delete from {t} where ' + ('invitee' if t == 'referrals' else 'tg_id') + ' in (%s, %s, %s, %s)', *ALL)
print('FAILED:' if fails else 'all v17 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
