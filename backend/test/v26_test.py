# v26 (the realm war rewards) checks against the local database, every app call as the anon role.
import os, json, datetime
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
def err(fn, **kw):
    try: anon(fn, **kw); return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
BASE = 997400000
SAVE = json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 0, 'made': '1026-10-03', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, {'house': 'lannister', 'langI': 0, 'made': '1026-10-03', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, None]})
def wipe():
    for t in ('war_claims', 'daily_scores', 'ledger', 'wallets', 'sessions', 'players'): q(f'delete from {t} where tg_id between %s and %s', BASE, BASE + 999)
wipe()
w0 = q1("select date_trunc('week', (now() at time zone 'utc'))::date"); last = w0 - datetime.timedelta(days=7)
dl = lambda k: last + datetime.timedelta(days=k)
tok = {}
def player(i, realm, days_waves, week_days=None):
    tg = BASE + i
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', %s, %s, 1)", tg, f'W{i}', realm, SAVE)
    for k, w in days_waves: w = w * 1000; q("insert into daily_scores (day, tg_id, name, house, realm, waves, kills, runs) values (%s, %s, %s, 'stark', %s, %s, 1, 1)", dl(k), tg, f'W{i}', realm, w)
    tok[tg] = q1('insert into sessions (tg_id) values (%s) returning token::text', tg)
    anon('econ_state', token=tok[tg], seat=0)
    return tg
# last week: realm 101 (score 50+0.5 = 50.5: two players, one active), 102 (30), 103 (20), 104 (10), 105 (5)
a1 = player(1, 101, [(0, 40), (1, 5), (2, 5)]); a2 = player(2, 101, [(0, 50)])         # avg (50+50)/2 = 50, +0.5 (a1 active) = 50.5
b1 = player(3, 102, [(0, 10), (1, 10), (2, 10)])                                         # 30 + 0.5 = 30.5
c1 = player(4, 103, [(0, 7), (1, 7), (2, 6)])                                            # 20 + 0.5
d1 = player(5, 104, [(0, 4), (1, 3), (2, 3)])                                            # 10 + 0.5
e1 = player(6, 105, [(0, 5)])                                                            # 5 (not active: 1 day)
f1 = player(7, 105, [(0, 1), (1, 1)])                                                    # avg of 5 and 2 = 3.5; 2 days only
g1 = player(8, 0, [])                                                                    # never played
cfg = q1("select v from econ_config where k = 'war'")
check('the settings: 3 days, top-3 rewards, a participation reward', cfg['min_days'] == 3 and [t['gold'] for t in cfg['top']] == [3000, 2000, 1000] and cfg['part'] == {'gold': 300}, cfg)
L = {t: anon('war_state', token=tok[t])['last'] for t in (a1, a2, b1, c1, d1, e1, f1, g1)}
check('last week\'s realm ranking: 101, 102, 103, 104, 105', [L[t]['pos'] for t in (a1, b1, c1, d1, e1)] == [1, 2, 3, 4, 5] and L[a1]['realms'] >= 5, [L[t]['pos'] for t in (a1, b1, c1, d1, e1)])
check('the first realm: 3000 gold + 50 dragonglass; the second: 2000 + 30; the third: 1000 + 15', L[a1]['reward'] == {'gold': 3000, 'gems': 50} and L[b1]['reward'] == {'gold': 2000, 'gems': 30} and L[c1]['reward'] == {'gold': 1000, 'gems': 15}, (L[a1]['reward'], L[b1]['reward'], L[c1]['reward']))
check('another realm that played 3 days: 300 gold for taking part', L[d1]['reward'] == {'gold': 300} and L[d1]['pos'] == 4)
check('he must have played on 3+ days himself (a2: one day, f1: two days) even in a winning realm', L[a2]['eligible'] is False and L[a2]['pos'] == 1 and 'days' in L[a2]['why'] and L[f1]['eligible'] is False and L[a2]['reward'] is None, (L[a2], L[f1]))
check('no Hold run last week: not eligible, no realm', L[g1]['eligible'] is False and L[g1]['realm'] is None and 'no Hold run' in L[g1]['why'])
check('nothing is claimed yet; his week points and days are real', L[a1]['claimed'] is False and L[a1]['points'] == 50000 and L[a1]['days'] == 3)
g0 = q1("select gold from wallets where tg_id = %s and seat = 0", a1); m0 = q1("select gems from wallets where tg_id = %s and seat = 0", a1)
r = anon('war_claim', token=tok[a1], seat=0)
check('the claim pays the reward on the server (gold, dragonglass) and says so', r['ok'] and r['reward'] == {'gold': 3000, 'gems': 50} and q1("select gold from wallets where tg_id = %s and seat = 0", a1) == g0 + 3000 and q1("select gems from wallets where tg_id = %s and seat = 0", a1) == m0 + 50 and r['state'] is not None, r['reward'])
check('both books are in the ledger with the reason "war"', q("select cur, delta from ledger where tg_id = %s and reason = 'war' order by cur", a1) == [('gems', 50), ('gold', 3000)])
check('after the claim the week reads "claimed"', r['last']['claimed'] is True and anon('war_state', token=tok[a1])['last']['claimed'] is True)
e = err('war_claim', token=tok[a1], seat=0)
check('a second claim for the same week is refused', e and 'already claimed' in e, e)
e2 = err('war_claim', token=tok[a1], seat=1)
check('and so is a claim from another seat of the same player', e2 and 'already claimed' in e2, e2)
e3 = err('war_claim', token=tok[a2], seat=0)
check('an ineligible player is refused with the reason', e3 and 'days' in e3, e3)
r2 = anon('war_claim', token=tok[d1], seat=0)
check('a participant gets 300 gold and no dragonglass', r2['reward'] == {'gold': 300} and q1("select count(*) from ledger where tg_id = %s and reason = 'war' and cur = 'gems'", d1) == 0)
check('the owner\'s view lists what was paid', q1("select count(*) from v_war_paid") == 2 and q1("select sum(gold) from v_war_paid") == 3300)
check('a bad token is refused; the helpers and the table are closed to the app', 'bad session' in (err('war_state', token='00000000-0000-0000-0000-000000000000') or '') and err('war_last', pid=a1) is not None and q1("select has_table_privilege('anon', 'war_claims', 'select')") is False)
# this week's rows are separate from last week's
q("insert into daily_scores (day, tg_id, name, house, realm, waves, kills, runs) values (%s, %s, 'W1', 'stark', 101, 9, 1, 1)", w0, a1)
cur = {x['realm']: x for x in anon('realm_war')['realms']}
check('the current week shows only this week (realm 101: 9 waves) while last week stays settled', cur[101]['total'] == 9 and 102 not in cur and anon('war_state', token=tok[b1])['last']['pos'] == 2)
wipe()
print('FAILED:' if fails else 'all v26 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
