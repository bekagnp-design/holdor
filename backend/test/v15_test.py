# v15 (Duel: async 1v1 on the Hold map) checks against the local database, every app call as the anon role.
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
q("update battles set finished_at = finished_at - interval '30 days' where kind = 'hold' and tg_id not in (991000001, 991000002, 991000003, 991000004)")
A, B, C, G = 991000001, 991000002, 991000003, 991000004
ALL = (A, B, C, G)
for t in ('duels', 'ratings', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where ' + ('a' if t == 'duels' else 'tg_id') + ' in (%s, %s, %s, %s)', *ALL)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((A, 'Ann'), (B, 'Bob'), (C, 'Cid'), (G, 'Ghost')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-09-30'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in ALL}
for t in ALL: anon('econ_state', token=tok[t], seat=0)
def hold(t, waves, kills, ago='0 seconds'):
    q("insert into battles (tg_id, seat, kind, status, waves, kills, steps, started_at, finished_at) values (%s, 0, 'hold', 'done', %s, %s, 5000, now() - interval '20 minutes', now() - interval %s)", t, waves, kills, ago)
def W(t): return q("select gold, gems from wallets where tg_id = %s and seat = 0", t)[0]

check('a player with no stage cleared cannot duel', err('duel_start', token=tok[A], seat=0, kind='ai') == 'clear a stage first')
for t in (A, B, C): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', 1, 3)", t)
check('a bad kind is refused', err('duel_start', token=tok[A], seat=0, kind='pvp') == 'bad duel')
st = anon('duel_state', token=tok[A], seat=0)
check('a fresh seat: rating 1000, Bronze, 5 ranked duels left, no duels', st['rating'] == 1000 and st['league'] == 'Bronze' and st['rank_left'] == 5 and st['duels'] == [], st)

# ---- practice against the bot ----
r = anon('duel_start', token=tok[A], seat=0, kind='ai')
d = r['duel']
check('practice: a bot opponent, marked, its run set by the rating (6 waves at 1000)', d['kind'] == 'ai' and d['opponent'] == 'Bot' and d['them']['waves'] == 6 and d['status'] == 'open', d)
check('a second open practice is refused', 'already have an open ai' in (err('duel_start', token=tok[A], seat=0, kind='ai') or ''))
check('no run yet: still open', anon('duel_state', token=tok[A], seat=0)['duels'][0]['status'] == 'open')
hold(A, 3, 200, '2 days')  # before the duel: does not count
check('a run from before the duel does not count', anon('duel_state', token=tok[A], seat=0)['duels'][0]['status'] == 'open')
g0 = W(A)[0]; hold(A, 8, 300)
st = anon('duel_state', token=tok[A], seat=0); d = st['duels'][0]
check('a better run wins the practice: closed, a win, only 100 gold, no rating change', d['status'] == 'done' and d['result'] == 'win' and W(A)[0] == g0 + 100 and st['rating'] == 1000 and d['me']['waves'] == 8, (d, W(A)[0] - g0))
check('settling is idempotent (no second gift)', anon('duel_state', token=tok[A], seat=0) and W(A)[0] == g0 + 100)

# ---- ranked: no ghost -> a bot; then a real ghost ----
q("delete from battles where tg_id = %s", A)
r = anon('duel_start', token=tok[B], seat=0, kind='rank'); d = r['duel']
check('ranked with nobody to match: a bot of your level (marked as such)', d['kind'] == 'ai' and d['opponent'] == 'Bot', d)
q("delete from duels where a = %s", B)
hold(G, 8, 300, '2 hours')
r = anon('duel_start', token=tok[B], seat=0, kind='rank'); d = r['duel']
check('a ghost is picked: Ghost with waves 8, kills 300, score 8300', d['kind'] == 'rank' and d['opponent'] == 'Ghost' and d['them']['score'] == 8300, d)
check('the ghost is not touched', q1("select count(*) from ratings where tg_id = %s", G) == 0)
check('only one open ranked duel', 'already have an open rank' in (err('duel_start', token=tok[B], seat=0, kind='rank') or ''))
hold(B, 5, 100)
d = anon('duel_state', token=tok[B], seat=0)['duels'][0]
check('a weaker run closes the duel as a loss', d['status'] == 'done' and d['result'] == 'loss', d)
st = anon('duel_state', token=tok[B], seat=0)
check('a loss at equal rating: −16, still Bronze, the record 0–1', st['rating'] == 984 and st['losses'] == 1 and st['duels'][0]['delta'] == -16, (st['rating'], st['duels'][0]['delta']))
check('a loss still pays 100 gold, once', q1("select count(*) from ledger where tg_id = %s and reason = 'duel'", B) == 1)
# five ranked a day
for i in range(4):
    q("update duels set status = 'expired' where a = %s and status = 'open'", B); anon('duel_start', token=tok[B], seat=0, kind='rank')
q("update duels set status = 'expired' where a = %s and status = 'open'", B)
check('five ranked duels a day are the limit', 'limit' in (err('duel_start', token=tok[B], seat=0, kind='rank') or ''))

# ---- a win raises the rating ----
d = anon('duel_start', token=tok[C], seat=0, kind='rank')['duel']
hold(C, 9, 400)
st = anon('duel_state', token=tok[C], seat=0)
check('a win over the ghost at equal rating: +16, 1–0', st['rating'] == 1016 and st['wins'] == 1 and st['duels'][0]['result'] == 'win', (st['rating'], st['duels'][0]))
check('the league follows the rating (Silver from 1100)', q1("select du_league(1099)") == 'Bronze' and q1("select du_league(1100)") == 'Silver' and q1("select du_league(1700)") == 'Dragon')

# ---- a friend duel ----
q("delete from duels where a in (%s, %s)", A, B); q("delete from battles where tg_id in (%s, %s)", A, B)
led0 = q1("select count(*) from ledger where reason = 'duel' and tg_id = %s", A); f = anon('duel_start', token=tok[A], seat=0, kind='friend')['duel']
check('a friend duel starts waiting, with a code', f['waiting'] and f['kind'] == 'friend' and len(f['code']) == 8, f)
check('you cannot join your own', err('duel_join', token=tok[A], seat=0, code=f['code']) == 'this is your own challenge')
check('a wrong code', err('duel_join', token=tok[B], seat=0, code='nonecode') == 'no such duel')
j = anon('duel_join', token=tok[B], seat=0, code=f['code'].upper())
check('the friend joins', j['ok'] and j['duel']['opponent'] == 'Ann' and not j['duel']['waiting'], j)
check('a third cannot join', err('duel_join', token=tok[C], seat=0, code=f['code']) == 'someone has joined already')
hold(A, 7, 100)
check('one side only: still open', anon('duel_state', token=tok[A], seat=0)['duels'][0]['status'] == 'open')
hold(B, 7, 250)
da, db_ = anon('duel_state', token=tok[A], seat=0)['duels'][0], anon('duel_state', token=tok[B], seat=0)['duels'][0]
check('both ran: the higher score (kills break the tie) wins — Bob; each sees his own side', da['status'] == 'done' and da['result'] == 'loss' and db_['result'] == 'win' and da['me']['score'] == 7100 and da['them']['score'] == 7250, (da, db_))
check('a friend duel gives no rating and no gold', anon('duel_state', token=tok[A], seat=0)['rating'] == 1000 and q1("select count(*) from ledger where reason = 'duel' and tg_id = %s", A) == led0)
# expiry
q("delete from duels where a = %s", C)
e = anon('duel_start', token=tok[C], seat=0, kind='friend')['duel']
q("update duels set expires_at = now() - interval '1 minute' where id = %s", e['id'])
check('an unanswered friend duel expires', anon('duel_state', token=tok[C], seat=0)['duels'][0]['status'] == 'expired')

check('no token, no state', err('duel_state', token='00000000-0000-0000-0000-000000000000', seat=0) == 'bad session')
try:
    with db.cursor() as c:
        c.execute('set role anon'); c.execute('select 1 from duels limit 1'); bad = False
except Exception as ex: bad = 'permission denied' in str(ex)
finally: db.cursor().execute('reset role')
check('the tables are closed to the app', bad)
check('the owner view counts duels', q1("select coalesce(sum(duels), 0) from v_duels") >= 1)
for t in ('duels', 'ratings', 'battles', 'ledger', 'items', 'sessions'): q(f'delete from {t} where ' + ('a' if t == 'duels' else 'tg_id') + ' in (%s, %s, %s, %s)', *ALL)
print('FAILED:' if fails else 'all v15 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
