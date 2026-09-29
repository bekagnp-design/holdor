# v10 (login calendar + quests) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v10.sql (run_all.sh). Re-runnable: own players 960000001–3.
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
CAL = q1("select v from econ_config where k = 'calendar'"); QS = q1("select v from econ_config where k = 'quests'")
T1, T2, T3 = 960000001, 960000002, 960000003
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s, %s)', T1, T2, T3)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm, h in ((T1, 'Q1', 'stark'), (T2, 'Q2', 'lannister'), (T3, 'Q3', 'stark')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, %s, 0, %s, 1)", t, nm, h, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat(h, '2026-09-29'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2, T3)}
for t in (T1, T2, T3): anon('econ_state', token=tok[t], seat=0)
q("update wallets set created_at = now() - interval '40 days' where tg_id in (%s, %s, %s)", T1, T2, T3)   # seats made a while ago: their earlier battles count
def W(t): return q("select gold, gems, cards, claims from wallets where tg_id = %s and seat = 0", t)[0]
def cards(t): return W(t)[2]

# ---------- 0. the config the server pays from ----------
check('the calendar has 30 days, every day pays something', len(CAL['days']) == 30 and all(d for d in CAL['days']), len(CAL['days']))
check('three quest periods with quests', all(QS[k] for k in ('daily', 'weekly', 'monthly')) and sum(len(QS[k]) for k in QS) == 11)
for f in ('qs_window(text)', 'qs_metric(bigint,integer,timestamptz,timestamptz,text)', 'qs_pay(wallets,jsonb,text,text)', 'qs_state(wallets)'):
    ok_ = q1("select has_function_privilege('anon', %s::regprocedure, 'execute')", f)
    if ok_: check('anon cannot call ' + f, False)
check('the helpers are closed to anon', not any(q1("select has_function_privilege('anon', %s::regprocedure, 'execute')", f) for f in ('qs_window(text)', 'qs_metric(bigint,integer,timestamptz,timestamptz,text)', 'qs_pay(wallets,jsonb,text,text)', 'qs_state(wallets)')))

# ---------- 1. the calendar ----------
s = anon('quest_state', token=tok[T1], seat=0)
check('a new seat: day 1, claimable', s['login']['n'] == 0 and s['login']['day'] == 1 and s['login']['can'] is True and s['login']['special_in'] == 30, s['login'])
g0, m0 = W(T1)[0], W(T1)[1]
r = anon('login_claim', token=tok[T1], seat=0)
check('day 1 paid: the calendar reward, on the server, once', r['ok'] and r['reward'] == CAL['days'][0] and W(T1)[1] - m0 == CAL['days'][0].get('gems', 0) and W(T1)[0] - g0 == CAL['days'][0].get('gold', 0), (r['reward'], W(T1)))
check('the ledger says why (login, day 1)', q("select reason, ref from ledger where tg_id = %s and reason = 'login'", T1) == [('login', '1')])
check('the answer carries the new balances and the calendar', r['state']['gems'] == W(T1)[1] and r['quests']['login']['can'] is False and r['quests']['login']['n'] == 1)
check('a second claim the same day is refused', err('login_claim', token=tok[T1], seat=0) == 'already claimed today')
check('nothing was paid twice', q1("select count(*) from ledger where tg_id = %s and reason = 'login'", T1) == 1)
# a missed day changes nothing: the next claim is day 2, whenever it comes
q("update wallets set claims = jsonb_set(claims, '{login,last}', '\"2026-09-01\"') where tg_id = %s and seat = 0", T1)
r = anon('login_claim', token=tok[T1], seat=0)
check('after a long break the calendar goes on with day 2', r['day'] == 2 and r['reward'] == CAL['days'][1], r['day'])
# a book day
q("update wallets set claims = jsonb_set(claims, '{login}', '{\"n\": 2, \"last\": \"2026-09-01\"}') where tg_id = %s and seat = 0", T1)
b0 = cards(T1).get('b:c', 0)
r = anon('login_claim', token=tok[T1], seat=0)
check('day 3: two Common books into the wallet (and an item since v11)', r['reward'] == CAL['days'][2] and r['reward']['books'] == {'b:c': 2} and cards(T1).get('b:c', 0) - b0 == 2, (r['reward'], cards(T1)))
# the round wraps
q("update wallets set claims = jsonb_set(claims, '{login}', '{\"n\": 29, \"last\": \"2026-09-01\"}') where tg_id = %s and seat = 0", T1)
s = anon('quest_state', token=tok[T1], seat=0)
check('at 29 claimed days: day 30 is next, and it is special', s['login']['day'] == 30 and s['login']['special_in'] == 1, s['login'])
open_before = q1("select claims->'copen' from wallets where tg_id = %s and seat = 0", T1)
r = anon('login_claim', token=tok[T1], seat=0)
check('day 30: the reward and the next sealed champion of the house (Robb, opening at stage 5)', r['day'] == 30 and r['champ'] == 'robb' and q1("select claims->'copen'->>'robb' from wallets where tg_id = %s and seat = 0", T1) == '1', (r['champ'], r['reward']))
check('the app is told who joined (state.copen)', r['state']['copen'].get('robb') == 1, r['state']['copen'])
q("update wallets set claims = jsonb_set(claims, '{login,last}', '\"2026-09-01\"') where tg_id = %s and seat = 0", T1)
s = anon('quest_state', token=tok[T1], seat=0)
check('after day 30 a new round starts at day 1', s['login']['n'] == 30 and s['login']['day'] == 1 and s['login']['special_in'] == 30, s['login'])
# day 60 with every champion open → dragonglass instead
for i in range(1, 51): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", T1, i)
q("update wallets set claims = jsonb_set(claims, '{login}', '{\"n\": 59, \"last\": \"2026-09-01\"}') where tg_id = %s and seat = 0", T1)
m1 = W(T1)[1]; r = anon('login_claim', token=tok[T1], seat=0)
check('day 60 with nothing sealed: the special dragonglass', r['champ'] is None and W(T1)[1] - m1 == CAL['days'][29].get('gems', 0) + CAL['special_gems'], (r['champ'], W(T1)[1] - m1))
check('a bad session is refused', err('login_claim', token=str(uuid.uuid4()), seat=0) == 'bad session')
check('no seat: refused', err('login_claim', token=tok[T1], seat=2) is not None)
check('another player is not affected', W(T2)[3].get('login') is None and W(T2)[1] == 80)

# ---------- 2. quests: progress only from the server's records ----------
def battle(t, kind='camp', stage=1, status='won', stars=3, kills=50, waves=10, mins_ago=1, seat_=0):
    return q1("insert into battles (tg_id, seat, kind, stage, status, stars, kills, waves, started_at, finished_at) values (%s, %s, %s, %s, %s, %s, %s, %s, now() - make_interval(mins => %s + 5), now() - make_interval(mins => %s)) returning id::text",
              t, seat_, kind, stage, status, stars, kills, waves, mins_ago, mins_ago)
s = anon('quest_state', token=tok[T2], seat=0)
check('a seat with no battles: all quests at zero, none claimed', all(x['cur'] == 0 and not x['claimed'] for k in s['periods'] for x in s['periods'][k]['q']) and s['periods']['daily']['q'][0]['need'] == 1)
r = err('quest_claim', token=tok[T2], seat=0, quest='d_win1')
check('a quest not done cannot be claimed', r is not None and 'not done yet' in r, r)
battle(T2, status='lost', kills=120)
s = anon('quest_state', token=tok[T2], seat=0); d = {x['id']: x for x in s['periods']['daily']['q']}
check('a lost battle counts kills, not wins', d['d_win1']['cur'] == 0 and d['d_kill']['cur'] == 120, d)
battle(T2, kills=100); battle(T2, kills=100)
s = anon('quest_state', token=tok[T2], seat=0); d = {x['id']: x for x in s['periods']['daily']['q']}
check('two wins and 320 kills: win-1 and kills are done, win-3 is at 2/3', d['d_win1']['cur'] == 1 and d['d_kill']['cur'] == 300 and d['d_win3']['cur'] == 2, d)
battle(T2, status='rejected', kills=9999)
battle(T2, status='open', kills=9999)
s = anon('quest_state', token=tok[T2], seat=0); d = {x['id']: x for x in s['periods']['daily']['q']}
check('rejected and open battles count for nothing', d['d_kill']['cur'] == 300 and d['d_win3']['cur'] == 2, d)
g0 = W(T2)[0]
r = anon('quest_claim', token=tok[T2], seat=0, quest='d_win1')
check('claim: 300 gold on the server', r['ok'] and W(T2)[0] - g0 == 300 and r['reward'] == {'gold': 300}, (r['reward'], W(T2)[0] - g0))
check('the answer shows it claimed', {x['id']: x for x in r['quests']['periods']['daily']['q']}['d_win1']['claimed'] is True and r['state']['gold'] == W(T2)[0])
check('the same quest twice is refused', err('quest_claim', token=tok[T2], seat=0, quest='d_win1') == 'already claimed')
m0 = W(T2)[1]; anon('quest_claim', token=tok[T2], seat=0, quest='d_kill')
check('the kills quest pays 8 dragonglass', W(T2)[1] - m0 == 8)
check('a quest that does not exist is refused', err('quest_claim', token=tok[T2], seat=0, quest='x_nope') == 'no such quest')
check('win-3 at 2/3 is refused', 'not done yet' in (err('quest_claim', token=tok[T2], seat=0, quest='d_win3') or ''))
battle(T2, kills=10)
b0 = cards(T2).get('b:c', 0); anon('quest_claim', token=tok[T2], seat=0, quest='d_win3')
check('win-3 done: two Common books', cards(T2).get('b:c', 0) - b0 == 2)
check('ledger = wallet (gold and gems)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T2) == W(T2)[0] and q1("select sum(delta) from ledger where tg_id = %s and cur = 'gems'", T2) == W(T2)[1])
# yesterday's battles do not count for today, but count this week
battle(T2, mins_ago=60 * 24 + 30, kills=100); battle(T2, mins_ago=60 * 24 + 40, kills=100)
s = anon('quest_state', token=tok[T2], seat=0)
check('daily counts today only', {x['id']: x for x in s['periods']['daily']['q']}['d_win1']['cur'] == 1)
# weekly / monthly
w = {x['id']: x for x in s['periods']['weekly']['q']}; mo = {x['id']: x for x in s['periods']['monthly']['q']}
today_dow = q1("select extract(isodow from now() at time zone 'utc')::int")
check('weekly wins never below the day\'s wins and monthly never below weekly', w['w_win10']['cur'] >= 4 and mo['m_win60']['cur'] >= w['w_win10']['cur'], (w['w_win10'], mo['m_win60']))
check('different days played counts days, not battles', w['w_days4']['cur'] in (1, 2) and w['w_days4']['cur'] == (2 if today_dow > 1 else 1), (w['w_days4'], today_dow))
# hold and stars
battle(T2, kind='hold', stage=None, status='done', stars=None, kills=400, waves=27)
battle(T2, kind='hold', stage=None, status='done', stars=None, kills=100, waves=8)
battle(T2, kind='hold', stage=None, status='done', stars=None, kills=100, waves=12)
s = anon('quest_state', token=tok[T2], seat=0); w = {x['id']: x for x in s['periods']['weekly']['q']}; mo = {x['id']: x for x in s['periods']['monthly']['q']}
check('Hold: three runs this week, best wave 27 this month', w['w_hold3']['cur'] == 3 and mo['m_hold25']['cur'] == 25 and mo['m_hold25']['need'] == 25, (w['w_hold3'], mo['m_hold25']))
check('stars count only from won stage battles', w['w_stars15']['cur'] == min(15, 3 * w['w_win10']['cur']), (w['w_stars15'], w['w_win10']))
for i in (1, 2, 3): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 2)", T2, i)
s = anon('quest_state', token=tok[T2], seat=0)
check('new stages come from the server\'s progress rows', {x['id']: x for x in s['periods']['monthly']['q']}['m_new10']['cur'] == 3)
r = anon('quest_claim', token=tok[T2], seat=0, quest='w_hold3')
check('the weekly Hold quest pays 30 dragonglass', r['reward'] == {'gems': 30})
# claims are kept per period and old ones are dropped
c = W(T2)[3]['quests']
check('claims are stored under the period keys only', all(k.startswith(('W', 'M', '20')) for k in c) and len(c) == 2, c)
q("update wallets set claims = jsonb_set(claims, '{quests}', claims->'quests' || '{\"2020-01-01\": [\"d_win1\"], \"W2020-01\": [\"w_win10\"]}'::jsonb) where tg_id = %s and seat = 0", T2)
for _ in range(6): battle(T2, kills=1)
r = anon('quest_claim', token=tok[T2], seat=0, quest='w_win10')
c = W(T2)[3]['quests']
check('a claim clears the finished periods and keeps the current ones', '2020-01-01' not in c and 'W2020-01' not in c and len(c) == 2 and 'w_win10' in json.dumps(c) and r['reward'] == next(x for x in QS['weekly'] if x['id'] == 'w_win10')['r'], c)

# ---------- 3. a seat replaced by a new one starts from zero ----------
battle(T3, kills=500); battle(T3, kills=500)
s = anon('quest_state', token=tok[T3], seat=0)
check('T3 has two wins today', {x['id']: x for x in s['periods']['daily']['q']}['d_win1']['cur'] == 1 and {x['id']: x for x in s['periods']['daily']['q']}['d_win3']['cur'] == 2)
q("update players set save = jsonb_set(save, '{slots,0,made}', '\"2026-10-01\"') where tg_id = %s", T3)
s = anon('quest_state', token=tok[T3], seat=0)
check('a new seat in the same place: none of the old battles count', all(x['cur'] == 0 for k in s['periods'] for x in s['periods'][k]['q']), s['periods']['daily'])
check('and its calendar starts at day 1', s['login']['n'] == 0 and s['login']['can'] is True)

# ---------- 4. the dashboard and permissions ----------
check('v_daily_claims counts the bookings', q1("select sum(bookings) from v_daily_claims where reason = 'login'") >= 1 and q1("select sum(bookings) from v_daily_claims where reason = 'quest'") >= 3)
check('anon cannot read the dashboard', q1("select has_table_privilege('anon', 'v_daily_claims', 'select')") is False)
check('a bad session on quest_state is refused', err('quest_state', token=str(uuid.uuid4()), seat=0) == 'bad session')
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
