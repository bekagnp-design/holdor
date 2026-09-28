# v5 (server economy) checks against the local database, every call as the anon role like the app.
# Needs the chain up to holdor_v5.sql + holdor_econ_data.sql loaded (run_all.sh does it). Re-runnable: own players 910000001–3.
import os, json, uuid, subprocess, datetime
import psycopg2
HERE = os.path.dirname(os.path.abspath(__file__)); BACK = os.path.dirname(HERE)
ECON = json.load(open(os.path.join(BACK, 'econ.json'))); LIM = json.load(open(os.path.join(BACK, 'limits.json')))
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
    except Exception as e: db.rollback() if not db.autocommit else None; return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
def op(r, **kw): return dict(id=str(uuid.uuid4()), r=r, **kw)
def sync(tok, seat, *ops): return anon('econ_sync', token=tok, seat=seat, ops=list(ops))
def oks(res): return [x['ok'] for x in res['results']]
def age(bid, secs): q("update battles set started_at = now() - make_interval(secs => %s) where id = %s", secs, bid)
today = q1("select to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD')")
dwin = q1("select floor(extract(epoch from now()) / 21600)::bigint")
T1, T2, T3 = 910000001, 910000002, 910000003
q('delete from players where tg_id in (%s, %s, %s)', T1, T2, T3)
q('delete from econ_legacy where tg_id in (%s, %s, %s)', T1, T2, T3)
q('delete from econ_flags where tg_id in (%s, %s, %s)', T1, T2, T3)
q('delete from ledger where tg_id in (%s, %s, %s)', T1, T2, T3)
q('delete from battles where tg_id in (%s, %s, %s)', T1, T2, T3)
q('delete from chests where tg_id in (%s, %s, %s)', T1, T2, T3)
q('delete from econ_ops where tg_id in (%s, %s, %s)', T1, T2, T3)
camp34 = {str(i): (3 if i in (1, 9, 11, 16, 18, 19, 34) else 2 if i == 21 else 1) for i in range(1, 35)}
seat1 = {'house': 'targaryen', 'langI': 3, 'made': '2026-09-14', 'gold': 4117, 'gems': 257, 'axp': 2290, 'tutGift': 1,
         'champs': {'dany': {'lvl': 19, 'sk': [5, 5, 5], 'tal': 0}, 'jon': {'lvl': 1, 'sk': [1, 1, 1], 'tal': 0}},
         'tlv': {'keep': 10, 'glass': 6}, 'slv': {'fire': 6}, 'upg': {'coin': 1}, 'army': {'lvl': 3},
         'online': {'date': today, 'attempts': 1, 'doorBonus': 300, 'goldBonus': 60, 'runs': []},
         'lvlChests': 14, 'starChests': 16, 'cards': {'t:keep': 100, 'c:dany': 3}, 'freeChestAt': 1790403094092, 'ach': {'first': 1},
         'campaign': camp34, 'hard': {}, 'stats': {'kills': 5045, 'onlineBest': 26},
         'deals': {'k': dwin, 'bought': [1, 0, 0, 0, 0, 0], 'unl': [1, 1, 1, 0, 0, 0]}}
save1 = {'v': 4, 'cur': 0, 'ver': 5, 'slots': [seat1, None, None]}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'T1', 'targaryen', 3, %s, 5)", T1, json.dumps(save1))
q("insert into econ_legacy (tg_id, seat, made) values (%s, 0, '2026-09-14/targaryen')", T1)          # a seat from before v5
seat2 = {'house': 'stark', 'langI': 0, 'made': today, 'gold': 999999, 'gems': 99999, 'campaign': {str(i): 3 for i in range(1, 51)}, 'stats': {'kills': 0, 'onlineBest': 0}}
q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'T2', 'stark', 0, %s, 1)", T2, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat2, None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2)}

# ---------- 1. a seat from before v5 brings its save once, a new seat starts fresh ----------
s = anon('econ_state', token=tok[T1], seat=0)
check('legacy balances', (s['gold'], s['gems'], s['xp']) == (4117, 257, 2290), s)
check('legacy level', s['level'] == q1('select xp_level(2290)') and s['level'] > 1, s['level'])
L = s['levels']
check('legacy levels', (L['c:dany'], L['sk:dany:0'], L['t:keep'], L['s:fire'], L['upg:coin'], L['army'], L['hold_door'], L['hold_bank']) == (19, 5, 10, 6, 1, 3, 300, 60), L)
check('legacy progress', len(s['progress']['c']) == 34 and s['stars'] == sum(camp34.values()), (len(s['progress']['c']), s['stars']))
check('legacy claims', (s['lvl_chests'], s['star_chests'], s['hold_left'], s['tut'], s['ach']) == (14, 16, 1, True, {'first': 1}), s)
check('legacy free chest time', s['free_chest_in'] == 0 or s['free_chest_in'] > 0)
check('legacy deals', s['deals']['b'][0] == 1, s['deals'])
check('energy full', (s['energy'], s['energy_max']) == (60, 60), s)
q("update players set save = jsonb_set(save, '{slots,0,gold}', '999999') where tg_id = %s", T1)
check('legacy taken once', anon('econ_state', token=tok[T1], seat=0)['gold'] == 4117)
s2 = anon('econ_state', token=tok[T2], seat=0)
check('fresh seat ignores its save', (s2['gold'], s2['gems'], len(s2['progress']['c']), s2['level']) == (150, 80, 0, 1), s2)
check('no seat', 'no seat' in anon_err('econ_state', token=tok[T2], seat=1))
check('bad session', 'bad session' in anon_err('econ_state', token='00000000-0000-0000-0000-000000000000', seat=0))

# ---------- 2. operations: price, level and balance are the server's ----------
g0 = 4117; c = ECON['card_gold']['t'][9]
r = sync(tok[T1], 0, op('card', k='t:keep', to=11))
check('card level', oks(r) == [True] and r['state']['gold'] == g0 - c and r['state']['levels']['t:keep'] == 11 and r['state']['xp'] == 2290 + round(c / 10), r['state']['gold'])
o = op('card', k='t:keep', to=13)
r = sync(tok[T1], 0, o)
check('card level skip refused', oks(r) == [False] and 'card level' in r['results'][0]['why'], r['results'])
r = sync(tok[T1], 0, o)
check('same op id answers the same', r['results'][0].get('dup') and r['results'][0]['ok'] is False)
ok_op = op('card', k='t:keep', to=12); r1 = sync(tok[T1], 0, ok_op); r2 = sync(tok[T1], 0, ok_op)
check('op applied once', r1['state']['gold'] == r2['state']['gold'] and r2['results'][0].get('dup'), (r1['state']['gold'], r2['state']['gold']))
check('card max', not oks(sync(tok[T1], 0, op('card', k='s:fire', to=11)))[0])
check('bad card type', not oks(sync(tok[T1], 0, op('card', k='x:keep', to=2)))[0])
check('skill at max refused', not oks(sync(tok[T1], 0, op('sk', k='dany:0', to=6)))[0])
r = sync(tok[T1], 0, op('sk', k='jon:0', to=2))
check('skill needs champion level', not oks(r)[0] and 'too low' in r['results'][0]['why'], r['results'])
gb = sync(tok[T1], 0)['state']['gold']
r = sync(tok[T1], 0, op('upg', k='coin'), op('upg', k='leather'), op('army', to=4), op('pack', k='slow'))
check('upgrade owned / new / army / pack', oks(r) == [False, True, True, True] and r['state']['gold'] == gb - ECON['upg']['leather'] - ECON['army_cost'][2] - ECON['pack']['slow'], (oks(r), r['state']['gold']))
check('army level wrong', not oks(sync(tok[T1], 0, op('army', to=6)))[0])
st = r['state']
r = sync(tok[T1], 0, op('xch', i=0), op('att'), op('energy'))
check('exchange / attempt / refill', oks(r) == [True, True, True] and r['state']['gems'] == st['gems'] - 40 - 40 - 30 and r['state']['gold'] == st['gold'] + 350
      and r['state']['hold_left'] == st['hold_left'] + 1 and r['state']['energy'] == 120, r['state'])
sync(tok[T1], 0, op('energy'), op('energy'))
r = sync(tok[T1], 0, op('energy'))
check('refills a day', not oks(r)[0] and 'no refills' in r['results'][0]['why'], r['results'])
r = sync(tok[T1], 0, op('ach', k='first'), op('ach', k='watch'), op('ach', k='watch'), op('ach', k='nope'), op('tut'))
check('achievements once, tut once', oks(r) == [False, True, False, False, False], oks(r))
r = sync(tok[T2], 0, op('tut'), op('tut'))
check('fresh tut gift', oks(r) == [True, False] and (r['state']['gold'], r['state']['gems']) == (250, 100), r['state'])
r = sync(tok[T2], 0, op('upg', k='coin'), op('upg', k='leather'))
check('not enough gold', oks(r) == [False, False] and 'not enough gold' in r['results'][0]['why'] and r['state']['gold'] == 250, r['results'])
check('unknown op', not oks(sync(tok[T2], 0, op('gem1')))[0])
check('bad op id', sync(tok[T2], 0, {'id': 'x', 'r': 'tut'})['results'][0]['why'] == 'bad id')
check('too many ops', 'too many' in anon_err('econ_sync', token=tok[T2], seat=0, ops=[op('tut') for _ in range(101)]))

# deals (the six slots every 6 hours)
st = sync(tok[T1], 0)['state']
D = lambda i, g, p=None, w=dwin: op('deal', i=i, w=w, g=g, p=p or {})
r = sync(tok[T1], 0, D(0, {'k': 'gold', 'gold': 150}), D(1, {'k': 'gold', 'gold': 800}, {'gems': 47}), D(2, {'k': 'gems', 'gems': 20}, {'gold': 560}),
         D(3, {'k': 'upg', 'u': 'horse'}, {'gold': 200}), op('dealunl', i=3, w=dwin), D(3, {'k': 'upg', 'u': 'horse'}, {'gold': 200}),
         D(4, {'k': 'door'}, {'gems': 40}))
check('deals: bought / priced / locked / unlocked / upgrade', oks(r) == [False, True, True, False, True, True, False], oks(r))
check('deal balances', r['state']['gold'] == st['gold'] + 800 - 560 - 200 and r['state']['gems'] == st['gems'] - 47 + 20 - 20 and r['state']['levels']['upg:horse'] == 1, r['state'])
q("update wallets set gems = gems + 500 where tg_id = %s", T1); q("insert into ledger (tg_id, seat, cur, delta, bal, reason) select %s, 0, 'gems', 500, gems, 'test' from wallets where tg_id = %s", T1, T1)
r = sync(tok[T1], 0, op('dealunl', i=4, w=dwin), D(4, {'k': 'door'}, {'gems': 40}), D(5, {'k': 'gold', 'gold': 1400}, {'gems': 10}), D(1, {'k': 'gold', 'gold': 800}, {'gems': 47}),
         D(2, {'k': 'gold', 'gold': 300}, {'gems': 18}, w=dwin - 5))
check('deals: gate / cheap refused / twice refused / old window', oks(r) == [True, True, False, False, False] and r['state']['levels']['hold_door'] == 400, (oks(r), r['state']['levels'].get('hold_door')))

# ---------- 3. battles ----------
check('stage 2 locked', 'locked' in anon_err('battle_start', token=tok[T2], seat=0, kind='camp', stage=2))
check('hard locked', 'Hard opens' in anon_err('battle_start', token=tok[T2], seat=0, kind='hard', stage=1))
b = anon('battle_start', token=tok[T2], seat=0, kind='camp', stage=1)
check('battle start costs energy', b['state']['energy'] == 57, b['state']['energy'])
ms = LIM['stages']['1']['min_steps']
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=True, stars=3, steps=ms + 400, kills=100)
check('too fast for real time', r['ok'] is False and 'real time' in r['why'], r)
check('refused battle is flagged', q1("select count(*) from econ_flags where tg_id = %s and kind = 'battle_refused'", T2) == 1)
b = anon('battle_start', token=tok[T2], seat=0, kind='camp', stage=1); age(b['battle'], 60)
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=True, stars=3, steps=ms - 1, kills=100)
check('fewer steps than possible', r['ok'] is False and 'faster than possible' in r['why'], r)
b = anon('battle_start', token=tok[T2], seat=0, kind='camp', stage=1); age(b['battle'], 60)
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=True, stars=3, steps=ms + 400, kills=int(LIM['stages']['1']['kills'] * 1.5) + 1)
check('more kills than enemies', r['ok'] is False and 'kills' in r['why'], r)
b = anon('battle_start', token=tok[T2], seat=0, kind='camp', stage=1); age(b['battle'], 60)
g1 = sync(tok[T2], 0)['state']
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=True, stars=3, steps=ms + 400, kills=110)
check('won stage 1: reward from the server', r['ok'] and r['reward'] == {'gold': 114, 'gems': 24} and r['state']['progress']['c'] == {'1': 3}, r)
check('balances after the win', (r['state']['gold'], r['state']['gems']) == (g1['gold'] + 114, g1['gems'] + 24))
r2 = anon('battle_finish', token=tok[T2], battle=b['battle'], won=True, stars=3, steps=ms + 400, kills=110)
check('finish twice pays once', r2.get('dup') and r2['ok'], r2)
b = anon('battle_start', token=tok[T2], seat=0, kind='camp', stage=1); age(b['battle'], 60)
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=True, stars=2, steps=ms + 400, kills=110)
check('replay: 35% gold, no gems, stars kept', r['reward'] == {'gold': 35, 'gems': 0} and r['state']['progress']['c'] == {'1': 3}, r['reward'])
b = anon('battle_start', token=tok[T2], seat=0, kind='camp', stage=2); age(b['battle'], 60)
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=False, stars=0, steps=900, kills=20)
check('lost: nothing', r['ok'] and r['reward'] == {'gold': 0, 'gems': 0} and '2' not in r['state']['progress']['c'], r)
for (stg, stars, first, want) in ECON['win']:
    if stg == 1: continue
    q('delete from progress where tg_id = %s and seat = 0', T3 if False else T1)  # T1 gets exactly the progress this check needs
    q("insert into progress (tg_id, seat, mode, stage, stars) select %s, 0, 'c', g, 3 from generate_series(1, %s) g", T1, stg - 1)
    if not first: q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3)", T1, stg)
    q("update wallets set energy = 60 where tg_id = %s", T1)
    b = anon('battle_start', token=tok[T1], seat=0, kind='camp', stage=stg); age(b['battle'], 200)
    r = anon('battle_finish', token=tok[T1], battle=b['battle'], won=True, stars=stars, steps=LIM['stages'][str(stg)]['min_steps'] + 10, kills=10)
    check(f'win formula stage {stg} ★{stars} first={first}', r['ok'] and r['reward']['gold'] == want, (r.get('reward'), want))
q("update wallets set energy = 2 where tg_id = %s", T2)
check('no energy', 'not enough energy' in anon_err('battle_start', token=tok[T2], seat=0, kind='camp', stage=1))
q("update wallets set energy = 10, energy_at = now() - interval '310 seconds' where tg_id = %s", T2)
check('energy refills with time', anon('econ_state', token=tok[T2], seat=0)['energy'] == 12)
w = q1("select xp from wallets where tg_id = %s", T2)
q("update wallets set gold = 5000, energy = 5, xp = 20 where tg_id = %s", T2)                 # 3 xp short of level 2
r = sync(tok[T2], 0, op('upg', k='leather'))
check('a new level refills energy', r['state']['level'] == 2 and r['state']['energy'] == 60, (r['state']['level'], r['state']['energy']))
# Hold
q("update wallets set claims = jsonb_set(claims, '{hold}', jsonb_build_object('d', %s::text, 'left', 1)) where tg_id = %s", today, T2)
b = anon('battle_start', token=tok[T2], seat=0, kind='hold')
check('hold attempt used', b['state']['hold_left'] == 0)
check('no attempts left', 'no Hold attempts' in anon_err('battle_start', token=tok[T2], seat=0, kind='hold'))
age(b['battle'], 90)
need = LIM['hold_wave']['21'][0]
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=False, waves=20, kills=266, steps=need - 1)
check('hold faster than possible', r['ok'] is False and 'faster than possible' in r['why'], r)
sync(tok[T2], 0, op('att'))
b = anon('battle_start', token=tok[T2], seat=0, kind='hold'); age(b['battle'], 90)
r = anon('battle_finish', token=tok[T2], battle=b['battle'], won=False, waves=20, kills=266, steps=need + 50)
check('hold reward from the server', r['ok'] and r['reward'] == {'gold': 20 * 8 + 266 // 4, 'gems': 4 + 4} and r['rank'] >= 1, r)
check('hold in today\'s standings', q1("select waves from daily_scores where tg_id = %s and seat = 0 and day = (now() at time zone 'utc')::date", T2) == 20)
check('hold in the seat row', q1("select waves from scores where tg_id = %s and seat = 0", T2) == 20)
check('old hold_result refused for a managed seat', 'update the app' in anon_err('hold_result', token=tok[T2], day=today, waves=99, kills=10))
b = anon('battle_start', token=tok[T1], seat=0, kind='hold'); age(b['battle'], 3000)
r = anon('battle_finish', token=tok[T1], battle=b['battle'], won=False, waves=120, kills=3000, steps=LIM['hold_wave']['81'][0] + 40 * 2700)
check('hold beyond the measured waves', r['ok'] or 'real time' in r.get('why', ''), r.get('why'))
# rate limit
q("insert into battles (tg_id, seat, kind, stage, status) select %s, 0, 'camp', 1, 'lost' from generate_series(1, 90)", T2)
q("update wallets set energy = 60 where tg_id = %s", T2)
check('too many battles an hour', 'too many battles' in anon_err('battle_start', token=tok[T2], seat=0, kind='camp', stage=1))
q("delete from battles where tg_id = %s and status = 'lost' and stage = 1 and steps is null", T2)

# ---------- 4. chests ----------
r = anon('chest_open', token=tok[T2], seat=0, tier='wood', source='shop')
check('free chest', ECON['chests']['wood']['gold'][0] <= r['gold'] <= ECON['chests']['wood']['gold'][1] and r['state']['free_chest_in'] > 86000, r)
check('free chest once a day', 'not ready' in anon_err('chest_open', token=tok[T2], seat=0, tier='wood', source='shop'))
q("update wallets set gems = 100 where tg_id = %s", T2)
r = anon('chest_open', token=tok[T2], seat=0, tier='iron', source='shop')
check('bought chest', r['state']['gems'] == 100 - 60 + r['gems'] and 8 <= r['gems'] <= 16, r)
check('chest price', 'not enough dragonglass' in anon_err('chest_open', token=tok[T2], seat=0, tier='dragon', source='shop'))
rr = sync(tok[T2], 0, op('chestfill', k=r['chest'], n=1), op('chestfill', k=r['chest'], n=2), op('chestfill', k=r['chest'], n=1))
check('chest fill up to its cards', oks(rr) == [True, False, True], oks(rr))
q("update wallets set xp = 5000, claims = jsonb_set(claims, '{lvl_chests}', '14') where tg_id = %s", T1)
lvl = q1('select xp_level(5000)')
r = anon_err('chest_open', token=tok[T1], seat=0, tier='wood', source='level')
check('wrong level chest', 'wrong level chest' in r, r)
r = anon('chest_open', token=tok[T1], seat=0, tier=q1('select ec_lvl_tier(16)'), source='level')
check('level chest', r['state']['lvl_chests'] == 15, r['state']['lvl_chests'])
q("update wallets set claims = jsonb_set(claims, '{lvl_chests}', to_jsonb(%s - 1)) where tg_id = %s", lvl, T1)
check('no level chest waiting', 'no level chest' in anon_err('chest_open', token=tok[T1], seat=0, tier='iron', source='level'))
q("update wallets set claims = jsonb_set(claims, '{star_chests}', '0') where tg_id = %s", T2)
r = anon('chest_open', token=tok[T2], seat=0, tier='iron', source='star')
check('star chest (3 stars)', r['state']['star_chests'] == 1, r['state'])
check('no star chest waiting', 'no star chest' in anon_err('chest_open', token=tok[T2], seat=0, tier='iron', source='star'))

# ---------- 5. the save cannot claim more than the server gave ----------
sv = json.loads(q1('select save::text from players where tg_id = %s', T2))
sv['slots'][0]['tlv'] = {'keep': 16}; sv['slots'][0]['campaign'] = {str(i): 3 for i in range(1, 51)}; sv['ver'] = 9
anon('save_progress', token=tok[T2], save=sv, ver=9, house='stark', realm=0, stars=150, gates=50, waves=500, kills=99999)
row = q("select stars, gates, waves from scores where tg_id = %s and seat = 0", T2)[0]
check('standings from the server, not the save', row == (3, 1, 20), row)
check('save levels flagged', q1("select count(*) from econ_flags where tg_id = %s and kind = 'save_levels'", T2) == 1)
anon('save_progress', token=tok[T2], save=sv, ver=10, house='stark', realm=0, stars=0, gates=0, waves=0, kills=0)
check('flag once a day', q1("select count(*) from econ_flags where tg_id = %s and kind = 'save_levels'", T2) == 1)
sv['slots'][0]['made'] = '2026-10-01'; sv['ver'] = 11
anon('save_progress', token=tok[T2], save=sv, ver=11, house='stark', realm=0, stars=0, gates=0, waves=0, kills=0)
check('a new seat in the same place starts fresh', q1('select count(*) from wallets where tg_id = %s', T2) == 0 and anon('econ_state', token=tok[T2], seat=0)['gold'] == 150)
sv['slots'][0] = None; sv['ver'] = 12
anon('save_progress', token=tok[T2], save=sv, ver=12, house='stark', realm=0, stars=0, gates=0, waves=0, kills=0)
check('a deleted seat leaves its wallet', q1('select count(*) from wallets where tg_id = %s', T2) == 0 and q1('select count(*) from progress where tg_id = %s', T2) == 0)

# ---------- 6. the ledger adds up; nobody else can touch any of it ----------
bad = q("""select w.tg_id, w.seat, w.gold, w.gems, (select coalesce(sum(delta), 0) from ledger l where l.tg_id = w.tg_id and l.seat = w.seat and l.cur = 'gold'),
                  (select coalesce(sum(delta), 0) from ledger l where l.tg_id = w.tg_id and l.seat = w.seat and l.cur = 'gems') from wallets w where w.tg_id in (%s, %s)""", T1, T2)
check('ledger = balance', all(x[2] == x[4] and x[3] == x[5] for x in bad), bad)
def anon_sql(sql):
    with db.cursor() as c:
        c.execute('set role anon')
        try: c.execute(sql); return 'no error'
        except Exception as e: return str(e).split('\n')[0]
        finally: c.execute('reset role')
for sql in ["select * from wallets", "select * from ledger", "select * from battles", "select * from progress", "select * from econ_config", "select * from v_wallets",
            "select * from v_econ_flags", "select ec_wallet(910000001, 0)", "select ec_state(w) from wallets w", "select xp_level(1)", "select sync_seats(910000001)"]:
    e = anon_sql(sql)
    check('anon denied: ' + sql, 'permission denied' in e, e)
print('FAILS:', len(fails), fails if fails else '')
raise SystemExit(1 if fails else 0)
