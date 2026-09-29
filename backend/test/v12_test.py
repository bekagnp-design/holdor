# v12 (gear III: 54 kinds, perks) checks against the local database. Needs the chain up to holdor_v12.sql (run_all.sh).
import os, json
import psycopg2
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return r[0][0] if r else None
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
G = q1("select v from econ_config where k = 'gear'")
K = G['kinds']; stats = set(G['sub'])
check('54 kinds over 9 slots', set(K) == set(G['slots']) and sum(len(v) for v in K.values()) == 54, {s: len(v) for s, v in K.items()})
check('every kind main stat is a stat with a base value', all(set(k['main']) <= stats and set(k['main']) <= set(G['main_base']) for v in K.values() for k in v))
check('every kind has a name, main stats and 4+ perks', all(k['n'] and k['main'] and len(k['perks']) >= 4 for v in K.values() for k in v))
check('perk chances by rarity', G['perk_p'] == [0, 40, 100, 100, 100] and G['perk2_p'] == [0, 0, 0, 100, 100])
check('ge_perk_rank: 1..5 by rarity+tier', [q1('select ge_perk_rank(%s,%s)', r, t) for r, t in ((0, 1), (2, 2), (3, 3), (4, 5), (4, 1))] == [1, 2, 3, 5, 3])
T = 970000101
for t in ('items', 'players'): q(f'delete from {t} where tg_id = %s', T)
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'K', 'stark', 0, '{}', 1)", T)
q("update econ_config set v = jsonb_set(v, '{cap}', '5000') where k = 'gear'")
N = 3000
q("select ge_new2(%s, 0, 0, 'test', 'win', 1) from generate_series(1, %s)", T, N)
rows = q("select slot, kind, rar, main_k, perks from items where tg_id = %s", T)
check('all rolled', len(rows) == N, len(rows))
bad = [r for r in rows if r[1] >= len(K[r[0]]) or r[3] not in K[r[0]][r[1]]['main'] or not set(r[4]) <= set(K[r[0]][r[1]]['perks']) or len(set(r[4])) != len(r[4])]
check('each item: a kind of its slot, a main from the kind, distinct perks from the kind pool', not bad, bad[:3])
want = lambda r: [0, 1, 1, 2, 2][r]
check('perk count: Common 0, Uncommon 0–1, Rare 1, Epic/Legendary 2 (pool permitting)',
      all((len(r[4]) == 0) if r[2] == 0 else (len(r[4]) <= 1) if r[2] == 1 else len(r[4]) == want(r[2]) if r[2] >= 2 else True for r in rows) and all(len(r[4]) == 1 for r in rows if r[2] == 2))
check('every kind rolls', len({(r[0], r[1]) for r in rows}) == 54, len({(r[0], r[1]) for r in rows}))
j = q1("select ge_json(i) from items i where tg_id = %s and rar = 4 limit 1", T)
check('ge_json carries kind, perks and rank', 'kind' in j and len(j['perks']) == 2 and 1 <= j['pr'] <= 5, j)
q("update econ_config set v = jsonb_set(v, '{cap}', '300') where k = 'gear'")
for t in ('items', 'players'): q(f'delete from {t} where tg_id = %s', T)
print('FAILED:' if fails else 'all v12 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
