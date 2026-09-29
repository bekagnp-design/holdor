# v6 (gear + forge) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v6.sql (run_all.sh). Re-runnable: own players 920000001–2. The gear config is changed
# for a few checks (drop 100 % / chance 100 % …) and always put back.
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
    try: return 'no error: ' + json.dumps(anon(fn, **kw))[:120]
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
G0 = q1("select v from econ_config where k = 'gear'")
def cfg(**kw):   # change the gear config for a check (path=value, dotted)
    g = json.loads(json.dumps(G0))
    for path, v in kw.items():
        node = g; keys = path.split('__')
        for k in keys[:-1]: node = node[k]
        node[keys[-1]] = v
    q("update econ_config set v = %s where k = 'gear'", json.dumps(g))
def restore(): q("update econ_config set v = %s where k = 'gear'", json.dumps(G0))
T1, T2 = 920000001, 920000002
for t in ('econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', T1, T2)
today = q1("select to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD')")
for t in (T1, T2):
    seat = {'house': 'stark', 'langI': 0, 'made': today, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'G', 'stark', 0, %s, 1)", t, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat, None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2)}
anon('econ_state', token=tok[T1], seat=0); anon('econ_state', token=tok[T2], seat=0)
def gold(): return q1('select gold from wallets where tg_id = %s and seat = 0', T1)
def setbal(cur, v):   # a test adjustment goes through the ledger, like any change
    d = v - q1(f'select {cur} from wallets where tg_id = %s and seat = 0', T1)
    q(f'update wallets set {cur} = %s where tg_id = %s and seat = 0', v, T1)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) values (%s, 0, %s, %s, %s, 'test')", T1, cur, d, v)
def items(t=T1): return anon('gear_list', token=tok[t], seat=0)['items']
try:
    # ---------- 1. rolls: rarity odds, structure ----------
    cfg(cap=100000)
    q('select ge_new(%s, 0, 0, %s) from generate_series(1, 20000)', T1, 'test')
    dist = dict(q("select rar, count(*) from items where tg_id = %s and src = 'test' group by rar", T1))
    pct = {r: 100.0 * dist.get(r, 0) / 20000 for r in range(5)}
    check('rarity odds ≈ 70 / 22 / 6.5 / 1.4 / 0.1', abs(pct[0] - 70) < 1.5 and abs(pct[1] - 22) < 1.2 and abs(pct[2] - 6.5) < 0.7 and abs(pct[3] - 1.4) < 0.35 and pct[4] < 0.35, pct)
    g = G0; bad = []
    for slot, rar, mk, subs, kd in q("select slot, rar, main_k, subs, kind from items where tg_id = %s and src = 'test' limit 3000", T1):
        ks = [s['k'] for s in subs]
        if mk not in g['kinds'][slot][kd]['main'] or len(ks) != g['subs_n'][rar] or len(set(ks)) != len(ks) or mk in ks \
           or any(not (g['sub'][s['k']][0] <= s['v'] <= g['sub'][s['k']][1]) for s in subs): bad.append((slot, rar, mk, subs))
    check('every item: main stat of its kind, subs by rarity, distinct, within range', not bad, bad[:2])
    check('all 9 slots and every set appear (12 sets since v11, 4 before)', q1("select count(distinct slot) from items where tg_id = %s", T1) == 9 and q1("select count(distinct set_k) from items where tg_id = %s", T1) == len(g['sets']))
    q("delete from items where tg_id = %s", T1); restore()
    check('a full bag gets nothing', (cfg(cap=0), q1("select (ge_new(%s, 0, 0, 'x')).id is null", T1))[1] is True); restore()

    # ---------- 2. drops: a won battle, a refused one, the Hold, chests ----------
    cfg(drop__win=100)
    b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=1)['battle']
    q("update battles set started_at = now() - interval '20 minutes' where id = %s", b)
    anon('battle_finish', token=tok[T1], battle=b, won=True, stars=3, steps=6000, waves=8, kills=100)
    it = items()
    check('won battle drops an item (drop 100 %)', len(it) == 1 and it[0]['src'] == 'camp:1', it)
    check('the app sees the main value by rarity and level', it and it[0]['main']['v'] == round(G0['main_base'][it[0]['main']['k']] * G0['rar_mul'][it[0]['r']], 1), it and it[0]['main'])
    b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=2)['battle']
    anon('battle_finish', token=tok[T1], battle=b, won=True, stars=3, steps=100, waves=8, kills=10)
    check('a refused battle drops nothing', len(items()) == 1)
    cfg(drop__win=0)
    b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=2)['battle']
    q("update battles set started_at = now() - interval '20 minutes' where id = %s", b)
    anon('battle_finish', token=tok[T1], battle=b, won=True, stars=1, steps=7000, waves=8, kills=100)
    check('drop 0 %: a win drops nothing', len(items()) == 1); restore()
    for waves, want in ((9, 0), (10, 1)):
        n0 = len(items()); q("update wallets set claims = jsonb_set(claims, '{hold}', jsonb_build_object('d', %s, 'left', 3)) where tg_id = %s", today, T1)
        b = anon('battle_start', token=tok[T1], seat=0, kind='hold')['battle']
        q("update battles set started_at = now() - interval '60 minutes' where id = %s", b)
        anon('battle_finish', token=tok[T1], battle=b, won=False, steps=20000, waves=waves, kills=100)
        check(f'Hold {waves} waves: {want} item', len(items()) - n0 == want)
    setbal('gems', 1000)
    n0 = len(items()); anon('chest_open', token=tok[T1], seat=0, tier='dragon', source='shop')
    new = [x for x in items()][n0:]
    check('dragon chest: always an item, Rare or better (v11: and a second one)', len(new) >= 1 and max(x['r'] for x in new) >= 2 and all(x['src'] == 'chest:dragon' for x in new), new)

    # ---------- 3. the forge: cost, chance, milestones, a resend, +16 ----------
    setbal('gold', 100000)
    it = items()[0]; iid = it['id']
    q("update items set tier = 4 where id = %s", iid); it = items()[0]   # v11: a ★4 item keeps the old +16 road of this test
    cfg(chance=[100] * 20)
    g0 = gold(); opid = str(uuid.uuid4())
    r = anon('gear_upgrade', token=tok[T1], seat=0, item=iid, op=opid)
    cost = round((G0['cost_base'] + G0['cost_step'] * 0) * G0['rar_cost'][it['r']] / 10) * 10
    check('+1: gold paid, level up', r['ok'] and r['item']['lvl'] == 1 and gold() == g0 - cost, (r['ok'], r['item']['lvl'], g0 - gold(), cost))
    r2 = anon('gear_upgrade', token=tok[T1], seat=0, item=iid, op=opid)
    check('a resend of the same try: no second try, no second charge', r2.get('dup') and r2['item']['lvl'] == 1 and gold() == g0 - cost)
    n_subs = len(it['subs']); tot0 = sum(s['v'] for s in it['subs'])
    for _ in range(3): r = anon('gear_upgrade', token=tok[T1], seat=0, item=iid, op=str(uuid.uuid4()))
    subs = r['item']['subs']
    check('+4: a substat appears (fewer than 4) or one grows', r['item']['lvl'] == 4 and (len(subs) == n_subs + 1 if n_subs < 4 else sum(s['v'] for s in subs) > tot0), subs)
    check('main stat grows with the level', r['item']['main']['v'] == round(G0['main_base'][it['main']['k']] * G0['rar_mul'][it['r']] * G0['tier_mul'][3] * 1.4, 1), r['item']['main'])
    cfg(chance=[0] * 20)
    g0 = gold(); r = anon('gear_upgrade', token=tok[T1], seat=0, item=iid, op=str(uuid.uuid4()))
    check('a failed try: gold lost, the item stays', r['ok'] is False and r['item']['lvl'] == 4 and gold() < g0 and q1("select count(*) from items where id = %s", iid) == 1)
    cfg(chance=[100] * 20)
    for _ in range(12): anon('gear_upgrade', token=tok[T1], seat=0, item=iid, op=str(uuid.uuid4()))
    check('up to +16, then refused', items()[0]['lvl'] == 16 and 'tier cap +16' in anon_err('gear_upgrade', token=tok[T1], seat=0, item=iid, op=str(uuid.uuid4())))
    check('4 substats at +16', len(items()[0]['subs']) == 4)
    restore()
    setbal('gold', 0)
    other = items()[1]['id']
    check('no gold: refused, nothing changes', 'not enough gold' in anon_err('gear_upgrade', token=tok[T1], seat=0, item=other, op=str(uuid.uuid4())) and items()[1]['lvl'] == 0)
    check('forge pays account XP', q1("select coalesce(sum(delta),0) from ledger where tg_id = %s and cur = 'xp' and reason = 'forge'", T1) > 0)

    # ---------- 4. equip, swap, unequip; strangers ----------
    cfg(cap=100000); q("delete from items where tg_id = %s", T1)
    q("select ge_new(%s, 0, 0, 'test') from generate_series(1, 200)", T1); restore()
    w = [x['id'] for x in items() if x['slot'] == 'weapon'][:2]
    anon('gear_equip', token=tok[T1], seat=0, item=w[0], champ='jon')
    anon('gear_equip', token=tok[T1], seat=0, item=w[1], champ='jon')
    eq = {x['id']: x['champ'] for x in items() if x['id'] in w}
    check('a second weapon on Jon sends the first back to the bag', eq[w[0]] is None and eq[w[1]] == 'jon', eq)
    anon('gear_equip', token=tok[T1], seat=0, item=w[1], champ=None)
    check('unequip', all(x['champ'] is None for x in items() if x['id'] == w[1]))
    check('a bad champion name is refused', 'bad champion' in anon_err('gear_equip', token=tok[T1], seat=0, item=w[0], champ="x'; drop"))
    check("another player's item is refused", 'no such item' in anon_err('gear_equip', token=tok[T2], seat=0, item=w[0], champ='jon')
          and 'no such item' in anon_err('gear_sell', token=tok[T2], seat=0, item=w[0]) and 'no such item' in anon_err('gear_upgrade', token=tok[T2], seat=0, item=w[0], op=str(uuid.uuid4())))

    # ---------- 5. sell; a full bag; the books ----------
    it = items()[0]; g0 = gold()
    r = anon('gear_sell', token=tok[T1], seat=0, item=it['id'])
    want = round(G0['sell'] * G0['rar_cost'][it['r']] * (1 + it['lvl']) * (1 + 0.5 * (it['tier'] - 1)))   # v11: a higher tier sells for more
    check('sell: gold by rarity and level, item gone', r['gold'] == want and gold() == g0 + want and all(x['id'] != it['id'] for x in r['items']), (r['gold'], want))
    q("select ge_new(%s, 0, 0, 'test')", T1)   # back to 200 (the cap)
    cfg(drop__win=100, cap=200)   # (the cap is 300 since v11; this test fills 200)
    b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=3)['battle']
    q("update battles set started_at = now() - interval '20 minutes' where id = %s", b)
    anon('battle_finish', token=tok[T1], battle=b, won=True, stars=3, steps=7000, waves=8, kills=100); restore()
    check('a full bag (200): the win still counts, no item', len(items()) == 200 and q1("select status from battles where id = %s", b) == 'won')
    check('ledger = wallet', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T1) == gold())

    # ---------- 6. a replaced seat takes its items; who may call what ----------
    sv = q1('select save from players where tg_id = %s', T2)
    anon('gear_list', token=tok[T2], seat=0); q("select ge_new(%s, 0, 0, 'test')", T2)
    sv['slots'][0]['house'] = 'lannister'
    q('update players set save = %s where tg_id = %s', json.dumps(sv), T2)
    anon('econ_state', token=tok[T2], seat=0)
    check('a new seat in the same place starts with an empty bag', items(T2) == [])
    with db.cursor() as c:
        c.execute('set role anon')
        try: c.execute('select count(*) from items'); denied = False
        except Exception: denied = True
        finally: c.execute('reset role')
    check('anon cannot read items', denied)
    check('anon cannot call ge_new', 'permission denied' in anon_err('ge_new', pid=T1, st=0, min_r=4, src='x'))
    check('bad token', 'bad session' in anon_err('gear_list', token=str(uuid.uuid4()), seat=0))
finally:
    restore()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
