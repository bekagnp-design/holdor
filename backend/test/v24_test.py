# v24 (Legendary drops announced in the realm chat) checks against the local database, every app call as the anon role.
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
            c.execute(f'select {fn}({args})', kw)
            return c.fetchone()[0]
        finally: c.execute('reset role')
def err(fn, **kw):
    try: anon(fn, **kw); return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
P = [997200001, 997200002, 997200003]
def wipe():
    for p in P:
        q('delete from chat_reports where author = %s or reporter = %s', p, p); q('delete from chat_blocks where tg_id = %s or blocked = %s', p, p)
        for t in ('chat_mutes', 'chat_msgs', 'items', 'scores', 'sessions', 'players'): q(f'delete from {t} where tg_id = %s', p)
wipe()
tok = {}
for i, p in enumerate(P):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, '{}', 1)", p, f'P{i}')
    if i < 2: q("insert into scores (tg_id, seat, name, house, realm) values (%s, 0, %s, 'targaryen', 7)", p, f'Dragon{i}')
    tok[p] = q1('insert into sessions (tg_id) values (%s) returning token::text', p)
def item(p, rar, kind=11, seat=0, slot='weapon', st='dragon'):
    return q1("insert into items (tg_id, seat, slot, rar, tier, set_k, main_k, subs, src, kind) values (%s, %s, %s, %s, 1, %s, 'dmg', '[]', 'test', %s) returning id::text", p, seat, slot, rar, st, kind)
item(P[0], 3); item(P[0], 0)
check('an Epic or lower item says nothing', q1("select count(*) from chat_msgs where tg_id = %s", P[0]) == 0)
item(P[0], 4)
rows = q("select realm, name, house, body, kind from chat_msgs where tg_id = %s", P[0])
check('a Legendary item writes one drop line in the seat\'s realm: slot:kind:set', rows == [(7, 'Dragon0', 'targaryen', 'weapon:11:dragon', 'drop')], rows)
item(P[2], 4)
check('a seat the server does not know in `scores` says nothing', q1("select count(*) from chat_msgs where tg_id = %s", P[2]) == 0)
l = anon('chat_list', token=tok[P[1]], seat=0)['msgs]'] if False else anon('chat_list', token=tok[P[1]], seat=0)['msgs']
check('everyone in the realm sees it, with kind "drop" and no Telegram id', len(l) == 1 and l[0]['kind'] == 'drop' and l[0]['name'] == 'Dragon0' and l[0]['body'] == 'weapon:11:dragon' and 'tg_id' not in json.dumps(l), l)
anon('chat_send', token=tok[P[0]], seat=0, body='look at that')
check('a drop line does not count against the 2-second limit: he can speak right after it', q1("select count(*) from chat_msgs where tg_id = %s and kind = 'say'", P[0]) == 1)
q("update chat_msgs set at = at - interval '5 seconds'")
for i in range(3): item(P[0], 4, kind=i)
for i in range(14): q("insert into chat_msgs (realm, tg_id, seat, name, body, at) values (7, %s, 0, 'x', %s, now() - interval '10 seconds')", P[0], f'm{i}')
e = err('chat_send', token=tok[P[0]], seat=0, body='sixteenth')
check('the minute limit counts only what he typed (15 says → refused; the 4 drop lines do not add)', e and 'too many' in e, e)
q("delete from chat_msgs where tg_id = %s and kind = 'say'", P[0]); q("delete from chat_msgs where tg_id = %s", P[0])
did = q1("select id from chat_msgs where tg_id = %s limit 1", P[0]) or (item(P[0], 4), q1("select id from chat_msgs where tg_id = %s limit 1", P[0]))[1]
check('a drop line cannot be reported', 'no such message' in (err('chat_report', token=tok[P[1]], msg=did, reason='x') or ''))
q("insert into chat_mutes (tg_id, until) values (%s, now() + interval '1 hour')", P[0])
check('a muted author\'s drop lines are hidden like his messages', anon('chat_list', token=tok[P[1]], seat=0)['msgs'] == [])
q("delete from chat_mutes where tg_id = %s", P[0])
check('the helper is closed to the app', err('chat_drop') is not None)
wipe()
print('FAILED:' if fails else 'all v24 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
