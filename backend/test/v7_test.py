# v7 (card copies on the server) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v7.sql (run_all.sh). Re-runnable: own players 930000001–2.
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
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
def op(r, **kw): return dict(id=str(uuid.uuid4()), r=r, **kw)
def sync(tok, *ops): return anon('econ_sync', token=tok, seat=0, ops=list(ops))
C = q1("select v from econ_config where k = 'cards'")
T1, T2 = 930000001, 930000002
for t in ('econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', T1, T2)
today = q1("select to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD')")
dwin = q1("select floor(extract(epoch from now()) / 21600)::bigint")
# T1: a Stark seat from before v5 with copies in its save (one unknown key, one too many, one negative) and 12 stages
seat1 = {'house': 'stark', 'langI': 0, 'made': '2026-09-20', 'gold': 5000, 'gems': 500, 'campaign': {str(i): 3 for i in range(1, 13)},
         'cards': {'t:watch': 40, 'c:robb': 9999, 'x:nope': 50, 'c:jon': -3, 's:fire': 7}, 'copen': {'arya': 1, 'nobody': 1},
         'tlv': {'watch': 3}, 'stats': {'kills': 0, 'onlineBest': 0}}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'C1', 'stark', 0, %s, 1)", T1, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat1, None, None]}))
q("insert into econ_legacy (tg_id, seat, made) values (%s, 0, '2026-09-20/stark')", T1)
seat2 = {'house': 'lannister', 'langI': 0, 'made': today, 'campaign': {}, 'cards': {'t:watch': 500}, 'stats': {'kills': 0, 'onlineBest': 0}}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'C2', 'lannister', 0, %s, 1)", T2, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat2, None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2)}

# ---------- 1. import: a seat from before brings its copies once, cleaned; a new seat brings none ----------
s = anon('econ_state', token=tok[T1], seat=0)
check('legacy copies, cleaned (unknown key gone, 5000 cap, no negatives)', s['cards'] == {'t:watch': 40, 'c:robb': 5000, 's:fire': 7}, s['cards'])
check('early-opened champions kept (known ones only)', q1("select claims->'copen' from wallets where tg_id = %s", T1) == {'arya': 1})
s2 = anon('econ_state', token=tok[T2], seat=0)
check('a new seat starts with no copies (its save does not count)', s2['cards'] == {}, s2['cards'])
check('ledger unaffected', q1("select count(*) from ledger where tg_id = %s and reason = 'legacy'", T1) == 2)

# ---------- 2. a card level needs the copies, and uses exactly the game's number ----------
need = max(1, round(C['need'][2] * C['mul'][C['towers']['watch']['rar']]))   # watch level 3 → 4
r = sync(tok[T1], op('card', k='t:watch', to=4))
check('level with copies: accepted, copies used', r['results'][0]['ok'] and r['state']['cards']['t:watch'] == 40 - need and r['state']['levels']['t:watch'] == 4, (r['results'], r['state']['cards']))
r = sync(tok[T2], op('card', k='t:watch', to=2))
check('level without copies: refused', not r['results'][0]['ok'] and 'not enough cards' in r['results'][0]['why'], r['results'])
check('refused: nothing paid, level unchanged', r['state']['levels'].get('t:watch', 1) == 1 and r['state']['gold'] == 150)
q("update wallets set cards = '{\"c:robb\": 2}' where tg_id = %s", T1)
r = sync(tok[T1], op('card', k='c:robb', to=2), op('card', k='c:robb', to=3))
check('two levels in one batch: the second finds too few copies', [x['ok'] for x in r['results']] == [True, False] and r['state']['cards']['c:robb'] == 0, (r['results'], r['state']['cards']))

# ---------- 3. chests: stacks rolled on the server, from what the seat can get ----------
q("update wallets set cards = '{}', gems = 5000 where tg_id = %s", T1)
r = anon('chest_open', token=tok[T1], seat=0, tier='dragon', source='shop')
keys = [x['k'] for x in r['stacks']]
pool = {x[0] for x in q("select k from ec_pool((select w from wallets w where tg_id = %s and seat = 0))", T1)}
check('dragon chest: 4 stacks, all different', len(r['stacks']) == 4 and len(set(keys)) == 4 and r['fills'] == 0, r['stacks'])
check('every stack is a card the seat can get (Stark, open, below the top)', all(k in pool for k in keys) and all(not k.startswith('c:') or C['champs'][k[2:]]['house'] == 'stark' for k in keys), keys)
check('the copies are in the wallet and in the answer', {k: v for k, v in r['state']['cards'].items() if not k.startswith('b:')} == {x['k']: x['n'] for x in r['stacks']}, (r['state']['cards'], r['stacks']))
rar = {x[0]: x[1] for x in q("select k, r from ec_pool((select w from wallets w where tg_id = %s and seat = 0))", T1)}
check('the rare slots hold rarer cards when there are some', all(rar[k] >= min(4, 2 + i) for i, k in enumerate(keys[:3]) if any(v >= min(4, 2 + i) for v in rar.values())), [(k, rar[k]) for k in keys])   # five rarities since v8
lo, hi = C['pack']['dragon']
check('stack sizes within the chest × rarity share', all(max(1, round(lo * C['mul'][rar[x['k']]])) <= x['n'] <= max(1, round(hi * C['mul'][rar[x['k']]])) for x in r['stacks']), r['stacks'])
# everything at the top level: nothing to give → 100 gold a slot, on the server
top = {}
for k in C['champs']:
    if C['champs'][k]['house'] == 'lannister': top['c:' + k] = int(q1("select v->>'c' from econ_config where k = 'max'"))   # 20 before v8, 60 after
for k in C['towers']: top['t:' + k] = 16
for k in C['spells']: top['s:' + k] = 10
q("update wallets set levels = %s, gems = 5000 where tg_id = %s", json.dumps(top), T2)
g0 = q1('select gold from wallets where tg_id = %s', T2)
r = anon('chest_open', token=tok[T2], seat=0, tier='valyrian', source='shop')
check('nothing left to give: every slot is 100 gold', r['stacks'] == [] and r['fills'] == 3 and r['state']['gold'] == g0 + r['gold'] + 300, (r['stacks'], r['fills'], r['state']['gold'] - g0 - r['gold']))
check('the chest row says filled', q1('select filled from chests where id = %s', r['chest']) == 3)

# ---------- 4. the first win of a stage gives copies once; a replay and an import do not ----------
q("update wallets set cards = '{}' where tg_id = %s", T1)
b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=13)['battle']
q("update battles set started_at = now() - interval '20 minutes' where id = %s", b)
r = anon('battle_finish', token=tok[T1], battle=b, won=True, stars=2, steps=8000, waves=10, kills=100)
got = r['state']['cards']
check('first win of stage 13: a few copies of one card', len(got) == 1 and list(got.values())[0] >= 1, got)
b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=13)['battle']
q("update battles set started_at = now() - interval '20 minutes' where id = %s", b)
r = anon('battle_finish', token=tok[T1], battle=b, won=True, stars=3, steps=8000, waves=10, kills=100)
check('a better replay gives no copies', r['state']['cards'] == got, r['state']['cards'])
check('the imported 12 stages gave none', q1("select count(*) from progress where tg_id = %s", T1) == 13)

# ---------- 5. a card deal adds its copies on the server ----------
q("update wallets set cards = '{}', gold = 10000 where tg_id = %s", T1)
r = sync(tok[T1], op('deal', i=1, w=dwin, g={'k': 'cards', 'key': 't:watch', 'cnt': 12}, p={'gold': 300}))
check('card deal: copies added', r['results'][0]['ok'] and r['state']['cards'] == {'t:watch': 12}, (r['results'], r['state']['cards']))
r = sync(tok[T1], op('deal', i=2, w=dwin, g={'k': 'cards', 'key': 'x:bad', 'cnt': 5}, p={'gold': 300}))
check('a deal for no real card is refused', not r['results'][0]['ok'], r['results'])
check('ledger = wallet', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T1) is not None)
with db.cursor() as c:
    c.execute('set role anon')
    try: c.execute("select ec_pool(null::wallets)"); denied = False
    except Exception: denied = True
    finally: c.execute('reset role')
check('anon cannot call the card helpers', denied)
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
