# v8 (champions: stars, books, the summon) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v8.sql (run_all.sh). Re-runnable: own players 940000001–2.
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
def anon_err(fn, **kw):
    try: anon(fn, **kw); return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
def op(r, **kw): return dict(id=str(uuid.uuid4()), r=r, **kw)
def sync(tok, *ops): return anon('econ_sync', token=tok, seat=0, ops=list(ops))
C = q1("select v from econ_config where k = 'cards'"); TV = q1("select v from econ_config where k = 'tavern'")
T1, T2 = 940000001, 940000002
for t in ('summons', 'econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', T1, T2)
# T1: a Stark seat from before v5 with 30 stages held (Robb, Bran, Sansa, Ned open; Arya and Jon sealed)
seat1 = {'house': 'stark', 'langI': 0, 'made': '2026-09-20', 'gold': 5000, 'gems': 500, 'campaign': {str(i): 3 for i in range(1, 31)},
         'cards': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'D1', 'stark', 0, %s, 1)", T1, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat1, None, None]}))
q("insert into econ_legacy (tg_id, seat, made) values (%s, 0, '2026-09-20/stark')", T1)
seat2 = {'house': 'martell', 'langI': 0, 'made': '2026-09-29', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'D2', 'martell', 0, %s, 1)", T2, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat2, None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2)}
anon('econ_state', token=tok[T1], seat=0); anon('econ_state', token=tok[T2], seat=0)
def setw(t, **kw):
    for k, v in kw.items(): q(f"update wallets set {k} = %s where tg_id = %s and seat = 0", json.dumps(v) if isinstance(v, (dict, list)) else v, t)
def setgold(t, g):   # through the ledger, so ledger = wallet stays true
    cur = q1("select gold from wallets where tg_id = %s and seat = 0", t)
    q("update wallets set gold = %s where tg_id = %s and seat = 0", g, t)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) values (%s, 0, 'gold', %s, %s, 'test')", t, g - cur, g)
def setgems(t, g):
    cur = q1("select gems from wallets where tg_id = %s and seat = 0", t)
    q("update wallets set gems = %s where tg_id = %s and seat = 0", g, t)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) values (%s, 0, 'gems', %s, %s, 'test')", t, g - cur, g)
def W(t): return q("select levels, cards, gold, gems, claims from wallets where tg_id = %s and seat = 0", t)[0]

# ---------- 1. rarity by opening order ----------
check('rarity: Brienne/Robb Common, Bran Uncommon, Sansa/Ned Rare, Arya Epic, Jon Legendary',
      [C['champs'][k]['rar'] for k in ('brienne', 'robb', 'bran', 'sansa', 'ned', 'arya', 'jon')] == [0, 0, 1, 2, 2, 3, 4], [C['champs'][k]['rar'] for k in ('brienne', 'robb', 'bran', 'sansa', 'ned', 'arya', 'jon')])
check('five shares of copies', C['mul'] == [1, 0.7, 0.5, 0.25, 0.1], C['mul'])
check('max champion level 60', q1("select v->>'c' from econ_config where k = 'max'") == '60')

# ---------- 2. the star caps the level ----------
setgold(T1, 200000)
setw(T1, levels={'c:robb': 10, 'c:ned': 15}, cards={'c:robb': 500, 'c:brienne': 40, 'c:jaime': 99, 'c:ned': 500})
r = sync(tok[T1], op('card', k='c:robb', to=11))
check('★1 stops at level 10', not r['results'][0]['ok'] and 'star allows level 10' in r['results'][0]['why'], r['results'])
r = sync(tok[T1], op('card', k='c:ned', to=16))
check('a seat from before: level 15 counts as ★2 (no star bought)', r['results'][0]['ok'], r['results'])
# ---------- 3. raising a star ----------
bad = [op('asc', k='robb', f='jaime', to=2), op('asc', k='robb', f='robb', to=2), op('asc', k='robb', f='brienne', to=3), op('asc', k='bran', f='brienne', to=2)]
r = sync(tok[T1], *bad)
check('refused: another house, himself, a skipped star, below the cap', [x['ok'] for x in r['results']] == [False] * 4, [x.get('why') for x in r['results']])
g0 = W(T1)[2]
r = sync(tok[T1], op('asc', k='robb', f='brienne', to=2))
lv, cd, g1 = W(T1)[0], W(T1)[1], W(T1)[2]
check('★1 → ★2: 20 Brienne cards burnt, 1500 gold', r['results'][0]['ok'] and lv.get('st:robb') == 2 and cd['c:brienne'] == 20 and g0 - g1 == 1500, (r['results'], lv, cd, g0 - g1))
r = sync(tok[T1], op('card', k='c:robb', to=11))
check('after the star: level 11', r['results'][0]['ok'] and W(T1)[0]['c:robb'] == 11, r['results'])
setw(T1, levels=dict(W(T1)[0], **{'c:robb': 20}), cards=dict(W(T1)[1], **{'c:brienne': 10}))
r = sync(tok[T1], op('asc', k='robb', f='brienne', to=3))
check('★2 → ★3 needs 40 Brienne cards: 10 are refused', not r['results'][0]['ok'] and 'not enough cards to burn' in r['results'][0]['why'], r['results'])
setw(T1, cards=dict(W(T1)[1], **{'c:sansa': 20}))
r = sync(tok[T1], op('asc', k='robb', f='sansa', to=3))
check('a Rare to burn counts double: 20 Sansa cards are 40', r['results'][0]['ok'] and W(T1)[1]['c:sansa'] == 0, (r['results'], W(T1)[1]))
check('the app sees the star', anon('econ_state', token=tok[T1], seat=0)['levels'].get('st:robb') == 3)

# ---------- 4. skill ranks need books ----------
r = sync(tok[T1], op('sk', k='robb:0', to=2))
check('no book: refused', not r['results'][0]['ok'] and 'not enough books' in r['results'][0]['why'], r['results'])
setw(T1, cards=dict(W(T1)[1], **{'b:c': 3, 'b:l': 9}))
r = sync(tok[T1], op('sk', k='robb:0', to=2), op('sk', k='robb:0', to=3), op('sk', k='robb:0', to=4))
check('Common books: 1 + 1, then 2 missing', [x['ok'] for x in r['results']] == [True, True, False] and W(T1)[1]['b:c'] == 1, (r['results'], W(T1)[1]))
check('a Legendary book does not count for Robb', W(T1)[1]['b:l'] == 9)

# ---------- 5. chests roll books ----------
setgems(T1, 5000)
r = anon('chest_open', token=tok[T1], seat=0, tier='dragon', source='shop')
bk = {x['k']: x['n'] for x in r['books']}
check('dragon chest: 3 Common, 2 Rare, 1 Epic books (+ a Legendary 25%)', bk.get('b:c') == 3 and bk.get('b:r') == 2 and bk.get('b:e') == 1 and bk.get('b:l', 1) == 1, r['books'])
check('the books are in the wallet', r['state']['cards']['b:c'] == 1 + 3 and r['state']['cards']['b:r'] == 2, r['state']['cards'])

# ---------- 6. deals sell books ----------
dwin = q1("select floor(extract(epoch from now()) / 21600)::bigint")
r = sync(tok[T1], op('deal', i=1, w=dwin, g={'k': 'books', 'key': 'b:e', 'cnt': 1}, p={'gold': 900}),
         op('deal', i=2, w=dwin, g={'k': 'books', 'key': 'b:e', 'cnt': 1}, p={'gold': 800}),
         op('deal', i=2, w=dwin, g={'k': 'books', 'key': 'b:x', 'cnt': 1}, p={'gold': 900}),
         op('deal', i=2, w=dwin, g={'k': 'books', 'key': 'b:c', 'cnt': 4}, p={'gold': 900}))
check('book deal: the right price only', [x['ok'] for x in r['results']] == [True, False, False, False] and W(T1)[1]['b:e'] == 2, [x.get('why') for x in r['results']])
setw(T1, cards=dict(W(T1)[1], **{'b:r': 0}))
r = sync(tok[T1], op('deal', i=2, w=dwin, g={'k': 'sk', 'c': 'ned', 'i': 1}, p={'gold': 90}))
check('the old cheap skill deal needs its books too', not r['results'][0]['ok'], r['results'])

# ---------- 7. the summon ----------
setgems(T1, 1000)
cop0 = W(T1)[4].get('copen') or {}
r = anon('champ_summon', token=tok[T1], seat=0, n=10)
rolls = r['rolls']
check('ten summons: 540 dragonglass, ten Stark champions', len(rolls) == 10 and r['state']['gems'] == 460 and all(C['champs'][x['c']]['house'] == 'stark' for x in rolls), (len(rolls), r['state']['gems']))
check('ten hold a Rare or better', any(x['r'] >= 2 for x in rolls), rolls)
check('every roll has its rarity', all(C['champs'][x['c']]['rar'] == x['r'] for x in rolls))
new = [x['c'] for x in rolls if x['new']]
check('a sealed one joins (Arya or Jon), an open one brings cards', all(x in ('arya', 'jon') for x in new) and all(x['n'] == max(1, round(10 * C['mul'][x['r']])) for x in rolls if not x['new']), rolls)
check('the app sees who joined', all(x in r['state']['copen'] for x in new), r['state']['copen'])
check('kept in the summons table', q1("select count(*) from summons where tg_id = %s", T1) == 1)
e = anon_err('champ_summon', token=tok[T1], seat=0, n=5)
check('5 at once: refused', e is not None and 'bad summon' in e, e)
setgems(T1, 10)
e = anon_err('champ_summon', token=tok[T1], seat=0, n=1)
check('not enough dragonglass: refused', e is not None, e)
check('ledger = wallet (gems)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gems'", T1) == W(T1)[3], (q1("select sum(delta) from ledger where tg_id = %s and cur = 'gems'", T1), W(T1)[3]))
check('ledger = wallet (gold)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T1) == W(T1)[2])
# a Martell seat summons Martell champions
setgems(T2, 100)
r = anon('champ_summon', token=tok[T2], seat=0, n=1)
check('a Martell seat: a Martell champion', len(r['rolls']) == 1 and C['champs'][r['rolls'][0]['c']]['house'] == 'martell', r['rolls'])
with db.cursor() as c:
    c.execute('set role anon')
    try: c.execute("select ec_star(null::wallets, 'robb')"); denied = False
    except Exception: denied = True
    finally: c.execute('reset role')
check('anon cannot call the star helper', denied)
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
