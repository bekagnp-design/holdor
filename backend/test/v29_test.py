# v29 (one reminder for those who started the bot and never played) checks against the local database.
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
B = 997700000
def wipe():
    q('delete from bot_starts where tg_id between %s and %s', B, B + 99); q('delete from players where tg_id between %s and %s', B, B + 99)
wipe()
svc("select bot_seen(%s, 'ka', 's_yt1')", B + 1)
row = q("select lang, start, reminded_at, blocked from bot_starts where tg_id = %s", B + 1)
check('/start is noted: language and payload, not reminded, not blocked', row == [('ka', 's_yt1', None, False)], row)
svc("select bot_seen(%s, 'en', 's_x')", B + 1)
check('a second /start keeps the first payload and the first time, updates the language', q("select lang, start from bot_starts where tg_id = %s", B + 1) == [('en', 's_yt1')])
def ago(tg, hours): q("update bot_starts set first_at = now() - make_interval(hours => %s) where tg_id = %s", hours, tg)
for i, h in [(2, 30), (3, 10), (4, 80), (5, 30), (6, 30)]: svc("select bot_seen(%s, 'en', null)", B + i); ago(B + i, h)
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Played', 'stark', 0, '{}', 1)", B + 5)   # he opened the game
svc("select bot_reminded(%s, false)", B + 6)                                                                              # already reminded
ago(B + 1, 30)
due = [d['tg'] for d in svc("select bot_remind_due(50)") if B <= d['tg'] < B + 100]
check('due: started 24–72 h ago, never opened the game, never reminded (not 10 h, not 80 h, not the one who played, not twice)', sorted(due) == [B + 1, B + 2], due)
check('the language comes with it', [d['lang'] for d in svc("select bot_remind_due(50)") if d['tg'] == B + 1] == ['en'])
svc("select bot_reminded(%s, true)", B + 2)
check('a blocked bot is marked and never due again', q1("select blocked from bot_starts where tg_id = %s", B + 2) is True and B + 2 not in [d['tg'] for d in svc("select bot_remind_due(50)")])
check('at most the limit per run', len(svc("select bot_remind_due(1)")) <= 1)
check('the owner\'s view counts started, opened, reminded, blocked', q1("select sum(started) from v_bot_starts") >= 6 and q1("select sum(blocked) from v_bot_starts") >= 1)
check('the app (anon) can call none of it and cannot read the table', all(err('anon', s) is not None for s in ("select bot_seen(1, 'en', null)", "select bot_remind_due(5)", "select bot_reminded(1, false)", "select * from bot_starts")))
wipe()
print('FAILED:' if fails else 'all v29 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
