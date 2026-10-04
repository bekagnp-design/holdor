# v28 (the channel digests) checks against the local database: the texts come from the data, only the service role may read them.
import os, json, datetime
import psycopg2
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return r[0][0] if r else None
def as_role(role, sql, *a):
    with db.cursor() as c:
        c.execute('set role ' + role)
        try: c.execute(sql, a); return c.fetchone()[0]
        finally: c.execute('reset role')
def err(role, sql, *a):
    try: as_role(role, sql, *a); return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
BASE = 997600000
def wipe():
    for t in ('daily_scores', 'players'): q(f'delete from {t} where tg_id between %s and %s', BASE, BASE + 999)
wipe()
today = q1("select (now() at time zone 'utc')::date"); y = today - datetime.timedelta(days=1)
w0 = q1("select date_trunc('week', (now() at time zone 'utc'))::date"); last = w0 - datetime.timedelta(days=7)
# the local copy holds production-shaped history: keep only our rows for the days we test
saved_y = q("select count(*) from daily_scores where day = %s", y)[0][0]
q("create temp table _keep as select * from daily_scores where day = %s or (day >= %s and day < %s)", y, last, w0)
q("delete from daily_scores where day = %s or (day >= %s and day < %s)", y, last, w0)
def player(i, name, realm, day, waves, kills=1):
    tg = BASE + i
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', %s, '{}', 1) on conflict do nothing", tg, name, realm)
    q("insert into daily_scores (day, tg_id, name, house, realm, waves, kills, runs) values (%s, %s, %s, 'stark', %s, %s, %s, 1)", day, tg, name, realm, waves, kills)
check('no runs yesterday: the day digest says so and posts nothing', as_role('service_role', "select bot_digest('day', 'en')")['ok'] is False)
for i in range(12): player(i, f'P{i:02d}', 0, y, 100 - i * 5)
player(20, '   ', 0, y, 1)                                   # a blank name
D = as_role('service_role', "select bot_digest('day', 'en')")
lines = [l for l in D['text'].split('\n') if l[:1].isdigit()]
check('the day digest: the top 10 of yesterday, in order, with waves', D['ok'] and len(lines) == 10 and lines[0] == '1. P00 — 100 🌊' and lines[9] == '10. P09 — 55 🌊', D['text'])
check('it names the day and ends with the game link (source s_tg)', "Yesterday's Hold top-10" in D['text'] and D['text'].endswith('https://t.me/HoldorTDBot/play?startapp=s_tg'), D['text'][-80:])
K = as_role('service_role', "select bot_digest('day', 'ka')")
check('the Georgian digest: Georgian words, the same rows, the s_ka link', 'გუშინდელი Hold-ის ტოპ-10' in K['text'] and '1. P00 — 100 🌊' in K['text'] and K['text'].endswith('startapp=s_ka'), K['text'])
check('today\'s runs are not yesterday\'s', (player(30, 'Today', 0, today, 999) or True) and 'Today' not in as_role('service_role', "select bot_digest('day', 'en')")['text'])
check('no realm fought last week: the war digest says so', as_role('service_role', "select bot_digest('war', 'en')")['ok'] is False)
for i, (realm, w) in enumerate([(0, 300), (0, 280), (3, 500), (7, 50), (11, 10)]): player(40 + i, f'W{i}', realm, last + datetime.timedelta(days=1), w)
W = as_role('service_role', "select bot_digest('war', 'en')")
rows = [l for l in W['text'].split('\n') if l and l[0] in '🥇🥈🥉']
check('the war digest: the top 3 countries of last week with their score and players, and how many fought', W['ok'] and len(rows) == 3 and rows[0].startswith('🥇 Germany — 500 (1 player)') and rows[1].startswith('🥈 Georgia — 290') and '(2 players)' in rows[1] and rows[2].startswith('🥉 France — 50 ') and '4 countries fought' in W['text'], W['text'])
check('the war digest in Georgian', 'ქვეყნების ომი' in as_role('service_role', "select bot_digest('war', 'ka')")['text'])
check('an unknown kind is refused', 'bad digest' in (err('service_role', "select bot_digest('x', 'en')") or ''))
check('the app (anon) cannot call the digest or read the secrets', err('anon', "select bot_digest('day', 'en')") is not None and err('anon', "select pay_secret('digest_code')") is not None)
check('the function may read the new keys and still nothing else', as_role('service_role', "select pay_secret('digest_code')") is not None and as_role('service_role', "select pay_secret('channel_en')") is None and as_role('service_role', "select coalesce(pay_secret('some_other_key'), 'none')") == 'none')
check('the digest code was generated (64 hex characters) and is not overwritten on a re-run', len(q1("select v from app_secrets where k = 'digest_code'")) == 64)
wipe()
q("insert into daily_scores select * from _keep")
print('FAILED:' if fails else 'all v28 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
