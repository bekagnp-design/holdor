# v22 (the gear kinds grow from 54 to 224) checks against the local database. Needs the chain up to holdor_v22.sql (run_all.sh).
# The first 54 kinds keep their places, names, main stats and perks (every item already rolled keeps its kind); the new ones are
# valid; the app's list (src/gear_kinds.json) has the same names in the same order; items roll the new kinds; old items are untouched.
import os, re, json
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
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); R = os.path.dirname(B)
old = json.loads(re.search(r"-- KINDS-BEGIN\nupdate econ_config set v = v \|\| '(.*?)'::jsonb", open(os.path.join(B, 'holdor_v12.sql')).read(), re.S).group(1))['kinds']
app = json.load(open(os.path.join(R, 'src', 'gear_kinds.json')))
G = q1("select v from econ_config where k = 'gear'"); K = G['kinds']; stats = set(G['sub']) & set(G['main_base'])
n = {s: len(v) for s, v in K.items()}
check('224 kinds over the 9 slots', sum(n.values()) == 224 and set(K) == set(G['slots']), n)
check('every slot has at least 16 kinds', min(n.values()) >= 16, n)
check('the first 54 are the v12 kinds, unchanged and in place', all(K[s][:len(old[s])] == old[s] for s in old), [s for s in old if K[s][:len(old[s])] != old[s]])
check('names are unique within a slot', all(len({k['n'] for k in v}) == len(v) for v in K.values()))
pool = {p for v in old.values() for k in v for p in k['perks']}
check('every new kind: 1–4 main stats with a base value, 4 perks from the known perks', all(1 <= len(k['main']) <= 4 and set(k['main']) <= stats and len(set(k['perks'])) == 4 and set(k['perks']) <= pool for v in K.values() for k in v))
check('the app lists the same names in the same order', {s: [x[0] for x in v] for s, v in app.items()} == {s: [k['n'] for k in v] for s, v in K.items()})
T = 970000122
for t in ('items', 'players'): q(f'delete from {t} where tg_id = %s', T)
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'K22', 'stark', 0, '{}', 1)", T)
q("update econ_config set v = jsonb_set(v, '{cap}', '5000') where k = 'gear'")
q("select ge_new2(%s, 0, 2, 'test', 'win', 1) from generate_series(1, 2000)", T)
rows = q("select slot, kind, main_k, perks from items where tg_id = %s", T)
newk = [r for r in rows if r[1] >= len(old[r[0]])]
check('items roll the new kinds (about three in four)', 0.6 < len(newk) / len(rows) < 0.9, (len(newk), len(rows)))
bad = [r for r in rows if r[1] >= n[r[0]] or r[2] not in K[r[0]][r[1]]['main'] or not set(r[3]) <= set(K[r[0]][r[1]]['perks'])]
check('each: a kind of its slot, its main and perks from that kind', not bad, bad[:3])
q("update econ_config set v = jsonb_set(v, '{cap}', '300') where k = 'gear'")
for t in ('items', 'players'): q(f'delete from {t} where tg_id = %s', T)
print('FAILED:' if fails else 'all v22 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
