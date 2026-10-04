# v25 (the weekly realm war, standings) checks against the local database, every app call as the anon role.
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
BASE = 997300000
IDS = [BASE + i for i in range(1, 80)]
def wipe():
    q('delete from daily_scores where tg_id between %s and %s', BASE, BASE + 999); q('delete from sessions where tg_id between %s and %s', BASE, BASE + 999); q('delete from players where tg_id between %s and %s', BASE, BASE + 999)
wipe()
# the week boundary comes from the server's own clock
w0 = q1("select date_trunc('week', (now() at time zone 'utc'))::date")
prev = w0 - datetime.timedelta(days=1)
def player(i, realm, waves_by_day):
    tg = BASE + i
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', %s, '{}', 1)", tg, f'W{i}', realm)
    for d, w in waves_by_day: q("insert into daily_scores (day, tg_id, name, house, realm, waves, kills, runs) values (%s, %s, %s, 'stark', %s, %s, 10, 1)", d, tg, f'W{i}', realm, w)
    return tg
day = lambda k: w0 + datetime.timedelta(days=k)
# realm 101: a big realm, 60 players with 10 waves on one day (average of the top 50 = 10, nobody active 3 days)
for i in range(1, 61): player(i, 101, [(day(0), 10)])
# realm 102: a small realm, 3 players: 40, 30 and 20 waves, the first on 3 different days (active), the others on one day
a = player(61, 102, [(day(0), 20), (day(1), 10), (day(2), 10)]); b = player(62, 102, [(day(0), 30)]); c = player(63, 102, [(day(0), 20)])
# realm 103: last week's waves only (they must not count)
player(64, 103, [(prev, 500)])
# realm 104: one player, 3 days of 1 wave: active
d4 = player(65, 104, [(day(0), 1), (day(1), 1), (day(2), 1)])
q("insert into sessions (tg_id) values (%s)", a); tok = q1("select token::text from sessions where tg_id = %s", a)
r = anon('realm_war')
by = {x['realm']: x for x in r['realms']}
check('the answer has the week, its end and the realms ranked', r['week_start'] == str(w0) and r['ends_at'] and [x['pos'] for x in r['realms']] == sorted(x['pos'] for x in r['realms']), (r['week_start'], r['realms'][:3]))
check('a big realm: the average of its top 50 (10) and no activity bonus', by[101]['avg50'] == 10 and by[101]['players'] == 60 and by[101]['active'] == 0 and by[101]['score'] == 10, by.get(101))
check('a small realm: avg of 3 players (40+30+20)/3 = 30, one active player → +0.5 → 30.5', by[102]['avg50'] == 30 and by[102]['active'] == 1 and by[102]['score'] == 30.5 and by[102]['total'] == 90, by.get(102))
check('last week does not count: a realm with only old waves is absent', 103 not in by)
check('three days of play = active: 3 waves (1+1+1) + 0.5', by[104]['avg50'] == 3 and by[104]['active'] == 1 and by[104]['score'] == 3.5, by.get(104))
check('ranking by score: the small realm (30.5) beats the big one (10)', by[102]['pos'] < by[101]['pos'])
anon_mine = r['mine']
check('without a token there is no personal block', anon_mine is None)
m = anon('realm_war', token=tok)['mine']
check('with a token: my realm, my week\'s waves and days, my realm\'s rank and score', m['realm'] == 102 and m['points'] == 40 and m['days'] == 3 and m['pos'] == by[102]['pos'] and m['score'] == 30.5, m)
check('a bad token is refused', 'bad session' in (err('realm_war', token='00000000-0000-0000-0000-000000000000') or ''))
check('no Telegram id anywhere in the answer', 'tg_id' not in json.dumps(r) and str(BASE) not in json.dumps(r))
check('the helper is closed to the app', err('realm_war_rows') is not None)
# the activity bonus is capped at 40 players (+20)
q('delete from daily_scores where tg_id between %s and %s', BASE, BASE + 999)
for i in range(1, 51): player(200 + i, 105, [(day(0), 4), (day(1), 4), (day(2), 4)])
check('the bonus counts at most 40 active players (+20): 12 avg + 20 = 32', {x['realm']: x for x in anon('realm_war')['realms']}[105]['score'] == 32, {x['realm']: x for x in anon('realm_war')['realms']}.get(105))
wipe()
print('FAILED:' if fails else 'all v25 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
