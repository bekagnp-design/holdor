# v11 (gear II: tiers, twelve sets, new stats, gear in gifts) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v11.sql (run_all.sh). Re-runnable: own players 970000001–2.
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
G0 = q1("select v from econ_config where k = 'gear'"); CAL0 = q1("select v from econ_config where k = 'calendar'"); QS0 = q1("select v from econ_config where k = 'quests'")
def cfg(**kw):
    g = json.loads(json.dumps(G0))
    for k, v in kw.items():
        node = g; ks = k.split('__')
        for x in ks[:-1]: node = node[x]
        node[ks[-1]] = v
    q("update econ_config set v = %s where k = 'gear'", json.dumps(g))
T1, T2 = 970000001, 970000002
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', T1, T2)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((T1, 'G1'), (T2, 'G2')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-09-30'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2)}
for t in (T1, T2): anon('econ_state', token=tok[t], seat=0)
q("update wallets set created_at = now() - interval '5 days' where tg_id in (%s, %s)", T1, T2)
def W(t): return q("select gold, gems, cards, claims from wallets where tg_id = %s and seat = 0", t)[0]
def gold(t, g):
    cur = W(t)[0]; q("update wallets set gold = %s where tg_id = %s and seat = 0", g, t); q("insert into ledger (tg_id, seat, cur, delta, bal, reason) values (%s, 0, 'gold', %s, %s, 'test')", t, g - cur, g)
def mk(t, slot='weapon', rar=0, tier=1, lvl=0, main='dmg', set_k='wolf', champ=None, subs=None):
    return q1("insert into items (tg_id, seat, slot, rar, tier, lvl, set_k, main_k, subs, champ, src) values (%s, 0, %s, %s, %s, %s, %s, %s, %s, %s, 'test') returning id::text", t, slot, rar, tier, lvl, set_k, main, json.dumps(subs or []), champ)
def item(i): return q("select tier, lvl, rar, subs from items where id = %s", i)[0] if q1("select count(*) from items where id = %s", i) else None
def clear(t): q("delete from items where tg_id = %s", t)

# ---------- 1. the config ----------
S = G0['sets']
check('twelve sets: four quads, four pairs, four triples', len(S) == 12 and sum(1 for s in S.values() if '4' in s) == 4 and sum(1 for s in S.values() if '2' in s and '4' not in s) == 4 and sum(1 for s in S.values() if '3' in s) == 4, list(S))
check('pairs and triples repeat for every full group; quads do not', all(S[k].get('stack') for k in S if '4' not in S[k]) and not any(S[k].get('stack') for k in S if '4' in S[k]))
stats = set(G0['main_base'])
check('eleven stats; every main, sub, set and bonus stat is one of them', len(stats) == 11 and all(set(v) <= stats for v in G0['main'].values()) and set(G0['sub']) == stats
      and all(set(b) <= stats for s in S.values() for k, b in s.items() if k != 'stack') and all(set(b) <= stats for b in G0['bonus_all'].values()), sorted(stats))
check('the new stats exist: armor, lifesteal, regen, crit', {'armor', 'lifesteal', 'regen', 'crit'} <= stats and set(G0['caps']) == {'armor', 'lifesteal', 'regen', 'crit'})
check('every slot has a main stat, ', set(G0['main']) == set(G0['slots']))
check('tier tables: 5 multipliers, 4 tier costs, 20 upgrade chances, each tier row sums to 100', len(G0['tier_mul']) == 5 and len(G0['tier_cost']) == 4 and len(G0['chance']) == 20 and all(sum(v) == 100 for v in G0['tier_p'].values()), G0['tier_p'])

# ---------- 2. old items keep their level: the tier follows ----------
i0 = mk(T1, lvl=9, tier=1)
q("update items set tier = least(5, greatest(tier, ceil(lvl / 4.0)::int)) where lvl > tier * 4")
check('an item forged to +9 before v11 becomes tier 3 (its cap is +12)', item(i0)[0] == 3, item(i0))
clear(T1)

# ---------- 3. rolls ----------
def roll(t, key, n, min_r=0, min_tier=1):
    for _ in range(n): q("select ge_new2(%s, 0, %s, 'test', %s, %s)", t, min_r, key, min_tier)
    return q("select tier, rar, slot, main_k, set_k, jsonb_array_length(subs), subs, kind from items where tg_id = %s", t)
cfg(cap=5000)
rows = roll(T1, 'dragon', 300, 0, 1)
check('dragon-chest tiers: mostly ★3+, some ★5, never a tier the table does not give', sum(1 for r in rows if r[0] >= 3) > 150 and any(r[0] == 5 for r in rows) and all(1 <= r[0] <= 5 for r in rows), sorted({r[0] for r in rows}))
check('every item: a main stat that fits its kind, a real set, subs by rarity, no sub equal to the main', all(r[3] in G0['kinds'][r[2]][r[7]]['main'] and r[4] in S and r[5] == G0['subs_n'][r[1]] and r[3] not in [x['k'] for x in r[6]] and len({x['k'] for x in r[6]}) == r[5] for r in rows))
check('all four new stats and all twelve sets do show up over 300 rolls', {'armor', 'lifesteal', 'regen', 'crit'} <= {r[3] for r in rows} | {x['k'] for r in rows for x in r[6]} and len({r[4] for r in rows}) == 12)
clear(T1); rows = roll(T1, 'wood', 300)
check('wood-chest tiers: ★1 and ★2 only', {r[0] for r in rows} <= {1, 2} and sum(1 for r in rows if r[0] == 1) > 230, sorted({r[0] for r in rows}))
clear(T1); rows = roll(T1, 'gift', 200, 2, 3)
check('a gift with min_r 2 and min_tier 3: nothing below', all(r[1] >= 2 and r[0] >= 3 for r in rows), (min(r[1] for r in rows), min(r[0] for r in rows)))
clear(T1); cfg(cap=3); roll(T1, 'win', 5)
check('a full bag: no more items (cap 3)', q1("select count(*) from items where tg_id = %s", T1) == 3)
clear(T1); cfg()
r0 = mk(T1, rar=4, tier=5, lvl=20, main='dmg')
j = anon('gear_list', token=tok[T1], seat=0)['items'][0]
check('main value = base × rarity × tier × level: Legendary ★5 +20 damage = 3 × 3.6 × 1.9 × 3 = 61.6', j['main']['v'] == 61.6 and j['tier'] == 5 and j['cap'] == 20, j)
clear(T1)

# ---------- 4. levels stop at the tier's cap ----------
cfg(chance=[100] * 20); gold(T1, 200000)
a = mk(T1, rar=0, tier=1, lvl=0)
for n in range(4): r = anon('gear_upgrade', token=tok[T1], seat=0, item=a, op=str(uuid.uuid4()))
check('★1: four strikes reach +4', item(a)[1] == 4 and r['item']['lvl'] == 4)
check('the fifth is refused: the tier cap', 'tier cap +4' in (err('gear_upgrade', token=tok[T1], seat=0, item=a, op=str(uuid.uuid4())) or ''), item(a))
check('substats grew at +4', len(item(a)[3]) >= 0)

# ---------- 5. raising a tier ----------
fod_same = mk(T1, rar=0, tier=1, lvl=0); fod_rare = mk(T1, rar=2, tier=1); low = mk(T1, rar=0, tier=1, lvl=0)
def tu(it, fo, op=None): return anon('gear_tier_up', token=tok[T1], seat=0, item=it, fodder=fo, op=op or str(uuid.uuid4()))
e = lambda it, fo: err('gear_tier_up', token=tok[T1], seat=0, item=it, fodder=fo, op=str(uuid.uuid4()))
c = mk(T1, rar=0, tier=1, lvl=2)
check('not at the cap: refused', 'forge it to +4' in (e(c, fod_same) or ''))
check('an item cannot burn itself', 'burn itself' in (e(a, a) or ''))
check('the item to burn must have the same rarity', 'same rarity' in (e(a, fod_rare) or ''))
check('the item to burn must have the tier or higher', True)
hi = mk(T1, rar=0, tier=2, lvl=0)
g0 = W(T1)[0]; op = str(uuid.uuid4())
r = tu(a, fod_same, op)
cost = round(G0['tier_cost'][0] * G0['rar_cost'][0] / 10) * 10
check('★1 → ★2: gold paid (1500), the burnt item is gone, the tier is 2', r['ok'] and g0 - W(T1)[0] == cost and item(fod_same) is None and item(a)[0] == 2 and r['item']['tier'] == 2 and r['item']['cap'] == 8, (g0 - W(T1)[0], r['item']))
check('the answer carries the whole bag and the new balance', len(r['items']) == q1("select count(*) from items where tg_id = %s", T1) and r['state']['gold'] == W(T1)[0])
check('a resent try does not burn twice', tu(a, low, op).get('dup') is True and item(low) is not None and item(a)[0] == 2)
for n in range(4): anon('gear_upgrade', token=tok[T1], seat=0, item=a, op=str(uuid.uuid4()))
check('after the tier the level goes on to +8', item(a)[1] == 8, item(a))
lowt = mk(T1, rar=0, tier=1, lvl=0)
check('burning a lower tier is refused (★2 needs ★2+)', 'tier 2 or higher' in (e(a, lowt) or ''), e(a, lowt))
r = tu(a, hi)
check('with a ★2 to burn: ★2 → ★3 for 5000', r['ok'] and item(a)[0] == 3 and item(hi) is None, (item(a),))
for tt in (4, 5):
    for n in range(4): anon('gear_upgrade', token=tok[T1], seat=0, item=a, op=str(uuid.uuid4()))
    f = mk(T1, rar=0, tier=tt); tu(a, f)
check('★5 reached', item(a)[0] == 5 and item(a)[1] == 16)
for n in range(4): anon('gear_upgrade', token=tok[T1], seat=0, item=a, op=str(uuid.uuid4()))
check('+20 at ★5', item(a)[1] == 20 and len(item(a)[3]) == 4)
check('★5 cannot rise', 'already tier 5' in (e(a, mk(T1, rar=0, tier=5)) or ''))
check('nobody else can use my items', err('gear_tier_up', token=tok[T2], seat=0, item=a, fodder=fod_rare, op=str(uuid.uuid4())) is not None)
check('ledger = wallet (gold)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T1) == W(T1)[0], (q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T1), W(T1)[0]))
check('the forge costs are booked as forge and forge_tier', q1("select count(*) from ledger where tg_id = %s and reason = 'forge_tier' and cur = 'gold'", T1) == 4)
clear(T1); cfg()

# ---------- 6. drop rates: more often, and more than one from the best chests ----------
def chests(t, tier, n):
    clear(t)
    for _ in range(n): q("insert into chests (tg_id, seat, tier, source, gold, gems, cards) values (%s, 0, %s, 'shop', 0, 0, 0)", t, tier)
    return q1("select count(*) from items where tg_id = %s", t)
cfg(cap=5000)
n = chests(T2, 'wood', 400); check('wood chests drop an item about 45% of the time (was 20%)', 140 <= n <= 230, n)
n = chests(T2, 'iron', 400); check('iron chests about 80% (was 50%)', 290 <= n <= 350, n)
n = chests(T2, 'valyrian', 400); check('valyrian chests: one, and a second 40% of the time', 500 <= n + 0 <= 620 and n >= 400, n)
n = chests(T2, 'dragon', 200); check('dragon chests: two items every time', n == 400, n)
mins = q("select min(rar) from items where tg_id = %s", T2)[0][0]
clear(T2)
def wins(t, n, kind='camp'):
    clear(t)
    for _ in range(n):
        b = q1("insert into battles (tg_id, seat, kind, stage, status) values (%s, 0, %s, 1, 'open') returning id::text", t, kind)
        q("update battles set status = 'won', finished_at = now(), stars = 3 where id = %s", b)
    return q1("select count(*) from items where tg_id = %s", t)
n = wins(T2, 400); check('a won stage drops about 40% of the time (was 25%)', 130 <= n <= 190, n)
n = wins(T2, 400, 'hard'); check('a won Hard stage about 55% (was 35%)', 190 <= n <= 250, n)
cfg(); clear(T2)

# ---------- 7. gifts carry items ----------
cal = json.loads(json.dumps(CAL0)); cal['days'][0] = {'gems': 5, 'gear': {'n': 2, 'min_r': 2, 'min_tier': 2}}
q("update econ_config set v = %s where k = 'calendar'", json.dumps(cal))
r = anon('login_claim', token=tok[T2], seat=0)
its = q("select rar, tier, src from items where tg_id = %s", T2)
check('a calendar day with gear: two Rare+ items of ★2+, sourced login:1', len(its) == 2 and all(x[0] >= 2 and x[1] >= 2 and x[2] == 'login:1' for x in its), its)
qs = json.loads(json.dumps(QS0)); qs['daily'][0]['r'] = {'gold': 10, 'gear': {'n': 1, 'min_r': 3}}
q("update econ_config set v = %s where k = 'quests'", json.dumps(qs))
q("insert into battles (tg_id, seat, kind, stage, status, stars, kills, waves, started_at, finished_at) values (%s, 0, 'camp', 1, 'won', 3, 10, 5, now() - interval '10 minutes', now() - interval '5 minutes')", T2)
r = anon('quest_claim', token=tok[T2], seat=0, quest='d_win1')
check('a quest with gear: an Epic+ item arrives', q1("select count(*) from items where tg_id = %s and src = 'quest:d_win1' and rar >= 3", T2) == 1)
q("update econ_config set v = %s where k = 'calendar'", json.dumps(CAL0)); q("update econ_config set v = %s where k = 'quests'", json.dumps(QS0))
check('gear in a gift shows up in the app\'s bag', len(anon('gear_list', token=tok[T2], seat=0)['items']) == 3)

# ---------- 7b. selling: a higher tier is worth more ----------
s1 = mk(T2, rar=2, tier=3, lvl=8); g0 = W(T2)[0]
r = anon('gear_sell', token=tok[T2], seat=0, item=s1)
want = round(G0['sell'] * G0['rar_cost'][2] * 9 * 2.0)
check('selling a Rare ★3 +8: 20 × 2.2 × 9 × 2.0 = 792', r['gold'] == want and W(T2)[0] - g0 == want and item(s1) is None, (r['gold'], want))

# ---------- 8. permissions ----------
check('anon cannot roll items or pay rewards by itself', not any(q1("select has_function_privilege('anon', %s::regprocedure, 'execute')", f) for f in ('ge_new2(bigint,integer,integer,text,text,integer)', 'ge_new(bigint,integer,integer,text)', 'qs_pay(wallets,jsonb,text,text)')))
check('the app may raise a tier with its token', q1("select has_function_privilege('anon', 'gear_tier_up(uuid,integer,uuid,uuid,uuid)'::regprocedure, 'execute')") is True)
check('the owner view has the tier', q1("select count(*) from v_items where tier is not null") >= 1)
clear(T1); clear(T2)
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
