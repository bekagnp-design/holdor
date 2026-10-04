# v30 (the bot tells an inviter that a friend's gift is ready) checks against the local database.
import os, json
import psycopg2
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return r[0][0] if r else None
def svc(sql, *a):
    with db.cursor() as c:
        c.execute('set role service_role')
        try: c.execute(sql, a); r = c.fetchall() if c.description else []; return r[0][0] if r else None
        finally: c.execute('reset role')
def err(role, sql):
    try:
        with db.cursor() as c:
            c.execute('set role ' + role)
            try: c.execute(sql)
            finally: c.execute('reset role')
        return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
B = 997710000
def wipe():
    q('delete from referrals where inviter between %s and %s or invitee between %s and %s', B, B + 99, B, B + 99)
    q('delete from progress where tg_id between %s and %s', B, B + 99)
    q('delete from bot_starts where tg_id between %s and %s', B, B + 99); q('delete from players where tg_id between %s and %s', B, B + 99)
wipe()
def player(t, name): q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, '{}', 1)", t, name)
def stages(t, n):
    for s in range(1, n + 1): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", t, s)
A, C, X = B + 1, B + 2, B + 3                     # two inviters; X blocked the bot
for t, n in [(A, 'Arya'), (C, 'Cat'), (X, 'Xan'), (B + 11, 'Bob'), (B + 12, 'Dee\nline'), (B + 13, 'Ed'), (B + 21, 'Fay'), (B + 31, 'Gus')]: player(t, n)
for f, i in [(B + 11, A), (B + 12, A), (B + 13, A), (B + 21, C), (B + 31, X)]: q("insert into referrals (invitee, inviter) values (%s, %s)", f, i)
svc("select bot_seen(%s, 'ka', null)", A); svc("select bot_seen(%s, 'en', null)", X); svc("select bot_reminded(%s, true)", X)
stages(B + 11, 5); stages(B + 12, 6); stages(B + 13, 4); stages(B + 21, 5); stages(B + 31, 5)
def due(): return [d for d in svc("select bot_ref_due(50)") if B <= d['tg'] < B + 100]
d = due()
check('due: one entry per inviter, only friends with 5+ stages, the blocked inviter skipped', sorted(x['tg'] for x in d) == [A, C], d)
a = [x for x in d if x['tg'] == A][0]
check('the friends come by id and by a clean name (no line breaks), in join order', a['friends'] == [B + 11, B + 12] and a['names'] == ['Bob', 'Dee line'], a)
check('the inviter\'s language comes from his /start; without one it is English', a['lang'] == 'ka' and [x for x in d if x['tg'] == C][0]['lang'] == 'en')
svc("select bot_ref_notified(%s, %s::bigint[], false)", A, [B + 11, B + 12])
check('after the message these friends are never announced again', [x['tg'] for x in due()] == [C])
stages(B + 13, 5)
check('a third friend who reaches the goal later is announced by himself', [x['friends'] for x in due() if x['tg'] == A] == [[B + 13]])
q("update referrals set inviter_paid = true where invitee = %s", B + 13)
check('a gift already claimed is not announced', A not in [x['tg'] for x in due()])
svc("select bot_ref_notified(%s, %s::bigint[], true)", C, [B + 21])
check('an inviter who never started the bot: the friend is marked, no bot_starts row is made', due() == [] and q1("select count(*) from bot_starts where tg_id = %s", C) == 0)
check('only the inviter\'s own friends are marked', q1("select count(*) from referrals where inviter = %s and notified_at is null", X) == 1)
check('at most the limit per run', len(svc("select bot_ref_due(1)")) <= 1)
check('the app (anon) can call none of it', all(err('anon', s) is not None for s in ("select bot_ref_due(5)", "select bot_ref_notified(1, array[2]::bigint[], false)")))
wipe()
print('FAILED:' if fails else 'all v30 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
