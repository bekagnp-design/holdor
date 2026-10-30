# v37 (founder_no) at SQL level on the local database, every app call as the anon role.
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
BASE = 995000000
for i in range(3):
    for t in ('sessions', 'players'): q(f'delete from {t} where tg_id = %s', BASE + i)
q("delete from sessions where tg_id >= %s", BASE)
rows = q("select count(*) from players where created_at < '2000-01-01'")
# three players that are older than every other row: they are #1, #2 and #3
for i in range(3):
    q("insert into players (tg_id, name, house, realm, save, save_ver, created_at) values (%s, %s, 'stark', 0, %s, 1, %s)", BASE + i, f'Fo{i}', json.dumps({'v': 4}), f'1999-01-0{i + 1}')
toks = [q1('insert into sessions (tg_id) values (%s) returning token::text', BASE + i) for i in range(3)]
check('the oldest players are founders #1, #2, #3', [anon('founder_no', token=t) for t in toks] == [1, 2, 3], str([anon('founder_no', token=t) for t in toks]))
q("insert into players (tg_id, name, house, realm, save, save_ver, created_at) select 996000000 + g, 'x', 'stark', 0, '{}'::jsonb, 1, '2000-01-01'::timestamptz + g * interval '1 hour' from generate_series(1, 100) g on conflict do nothing")
q("insert into players (tg_id, name, house, realm, save, save_ver, created_at) values (997000000, 'late', 'stark', 0, '{}'::jsonb, 1, '2000-06-01') on conflict do nothing")
tl = q1("insert into sessions (tg_id) values (997000000) returning token::text")
check('player number 104 is not a founder', anon('founder_no', token=tl) is None)
q("delete from sessions where tg_id >= 995000000"); q("delete from players where tg_id >= 995000000")
print('FAILS', fails); raise SystemExit(1 if fails else 0)
