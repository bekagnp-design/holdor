# v35 (the tower Siege maul as a card) at SQL level on the local database, every app call as the anon role.
import os, json, uuid
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
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', A)
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Ann', 'stark', 0, %s, 1)", A, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 0, 'made': '2026-10-29', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, None, None]}))
tok = q1('insert into sessions (tg_id) values (%s) returning token::text', A)
anon('econ_state', token=tok, seat=0)
tw = q1("select v->'towers' from econ_config where k = 'cards'")
check('the Siege maul is an eighth tower card: opens at 18, Epic', len(tw) == 8 and tw['maul'] == {'open': 18, 'rar': 2}, json.dumps(tw))
q("update wallets set gold = 100000, cards = cards || %s::jsonb where tg_id = %s and seat = 0", json.dumps({'t:maul': 40}), A)
r = anon('econ_sync', token=tok, seat=0, ops=[{'r': 'card', 'k': 't:maul', 'to': 2, 'id': str(uuid.uuid4())}])
check('a level for t:maul through the normal card operation', q1("select (levels->>'t:maul')::int from wallets where tg_id = %s and seat = 0", A) == 2, json.dumps(r)[:200])
check('the cards were spent and the gold booked', q1("select gold from wallets where tg_id = %s and seat = 0", A) < 100000)
check('no refusals flagged', q1("select count(*) from econ_flags where tg_id = %s", A) == 0)
print('FAILS', fails); raise SystemExit(1 if fails else 0)
