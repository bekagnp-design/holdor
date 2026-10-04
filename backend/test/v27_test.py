# v27 (the public boards carry no Telegram ids) checks against the local database, every app call as the anon role.
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
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
BASE = 997500000
def wipe():
    for t in ('daily_scores', 'scores', 'players'): q(f'delete from {t} where tg_id between %s and %s', BASE, BASE + 999)
wipe()
ids = [BASE + i for i in range(1, 6)]
SAVE = lambda cur: json.dumps({'v': 4, 'cur': cur, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 150, 'made': '2026-10-03'}, {'house': 'lannister', 'langI': 150, 'made': '2026-10-03'}, None]})
today = q1("select (now() at time zone 'utc')::date")
for i, tg in enumerate(ids):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 150, %s, 1)", tg, f'B{i}', SAVE(0))
    q("insert into scores (tg_id, seat, name, house, realm, stars, gates, waves, kills) values (%s, 0, %s, 'stark', 150, %s, 1, %s, 5)", tg, f'B{i}', 1000000 - i * 1000, 500000 - i * 100)   # ahead of anything else
    q("insert into daily_scores (day, tg_id, seat, name, house, realm, waves, kills, runs) values (%s, %s, 0, %s, 'stark', 150, %s, 5, 1)", today, tg, f'B{i}', 9000000 - i)
# the first player also has a second seat
q("insert into scores (tg_id, seat, name, house, realm, stars, gates, waves, kills) values (%s, 1, 'B0 II', 'lannister', 150, 1, 1, 1, 1)", ids[0])
L = anon('leaderboard', me=ids[2], seat=0); LB = json.dumps(L)
check('the leaderboard answer holds no seeded Telegram id (top, today, me)', not any(str(t) in LB for t in ids) and '"tg_id"' not in LB, [t for t in ids if str(t) in LB])
check('the top rows are the seeded defenders in order, with names, houses and ranks', [r['name'] for r in L['top'][:5]] == [f'B{i}' for i in range(5)] and [r['rank'] for r in L['top'][:5]] == [1, 2, 3, 4, 5] and all('seat' in r and 'waves' in r for r in L['top']))
check('only the caller\'s row is "mine" in the top (player 3), and the "me" row is mine with its rank', [r['name'] for r in L['top'] if r['mine']] == ['B2'] and L['me']['mine'] is True and L['me']['rank'] == 3 and L['me']['name'] == 'B2', (L['me'], [r['name'] for r in L['top'] if r['mine']]))
check('the day\'s board: the same, no ids, one "mine"', '"tg_id"' not in json.dumps(L['today']) and [r['name'] for r in L['today'] if r['mine']] == ['B2'] and L['myday']['rank'] == 3, [r['name'] for r in L['today'] if r['mine']])
L0 = anon('leaderboard'); check('without "me" nobody is mine (a visitor sees the board too)', not any(r['mine'] for r in L0['top']) and L0['me'] is None and '"tg_id"' not in json.dumps(L0))
L1 = anon('leaderboard', me=ids[0], seat=1)
check('a second seat is its own defender: seat 1 of player 1 is "mine" only on its own row', [(r['name']) for r in L1['top'] if r['mine']] == [] or all(r['seat'] == 1 for r in L1['top'] if r['mine']))
Lr = anon('leaderboard', realm=150, me=ids[2], seat=0)
check('a realm board is filtered to the realm and still carries no ids', all(r['realm'] == 150 for r in Lr['top']) and '"tg_id"' not in json.dumps(Lr) and [r['name'] for r in Lr['top'] if r['mine']] == ['B2'])
C = anon('realm_card', realm=150, me=ids[2], seat=0); CJ = json.dumps(C)
check('the realm card holds no seeded id either', not any(str(t) in CJ for t in ids) and '"tg_id"' not in CJ, [t for t in ids if str(t) in CJ])
check('the card\'s top-10 has the defenders in order and exactly one "mine"; its "me" row is mine', [r['name'] for r in C['top'][:5]] == [f'B{i}' for i in range(5)] and [r['name'] for r in C['top'] if r['mine']] == ['B2'] and C['me']['mine'] is True, (C['top'][:2], C['me']))
check('the realm\'s totals are unchanged (players, seats)', C['players'] == 5 and C['seats'] == 6, (C['players'], C['seats']))
wipe()
print('FAILED:' if fails else 'all v27 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
