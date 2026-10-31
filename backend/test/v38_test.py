# v38 (Trials rewards for managed seats) at SQL level on the local database, every app call as the anon role.
import os, json
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
A, B = 993800001, 993800002
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', A, B)
def seat(house): return {'house': house, 'langI': 0, 'made': '2026-10-30', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((A, 'Ann'), (B, 'Bob')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (A, B)}
for t in (A, B): anon('econ_state', token=tok[t], seat=0)
cfg = q1("select v from econ_config where k = 'trials'")
check('the config is there', cfg['gold_per_wave'] == 12 and cfg['max_waves'] == 60 and cfg['secs_per_wave'] == 20 and cfg['day_gold'] == 600, json.dumps(cfg))
def tr(t): return q("select claims->'trials' from wallets where tg_id = %s and seat = 0", t)[0][0]
def back(t, start=None, last=None):   # move the stamps into the past
    if start is not None: q("update wallets set claims = jsonb_set(claims, '{trials,start}', to_jsonb(now() - make_interval(secs => %s))) where tg_id = %s and seat = 0", start, t)
    if last is not None: q("update wallets set claims = jsonb_set(claims, '{trials,last}', to_jsonb(now() - make_interval(secs => %s))) where tg_id = %s and seat = 0", last, t)
def G(t): return q("select gold, gems from wallets where tg_id = %s and seat = 0", t)[0]
start = lambda t: err('trials_start', token=tok[t], seat=0)
claim = lambda t, n: err('trials_claim', token=tok[t], seat=0, waves=n)
# refusals
check('a claim without a start is refused', 'no run was started' in (claim(A, 5) or ''), claim(A, 5))
check('a wrong session is refused', 'bad session' in (err('trials_claim', token='00000000-0000-0000-0000-000000000000', seat=0, waves=5) or ''))
check('0 waves is refused', 'no waves' in (claim(A, 0) or ''))
check('anon may call both', q1("select has_function_privilege('anon', 'trials_start(uuid,int)', 'execute') and has_function_privilege('anon', 'trials_claim(uuid,int,int)', 'execute')"))
check('a start works', start(A) is None and tr(A)['start'] is not None)
check('a second start at once is refused (spam)', 'wait a little' in (start(A) or ''))
check('a claim right after the start is too short', 'too short for 10 waves' in (claim(A, 10) or ''))
g0, m0 = G(A)
# plausibility: 7 waves need 140 s
back(A, start=139)
check('139 s is not enough for 7 waves', 'too short' in (claim(A, 7) or ''))
back(A, start=141)
r = anon('trials_claim', token=tok[A], seat=0, waves=7)
check('7 waves after 141 s: 84 gold, one chest', r['gold'] == 84 and r['chests'] == 1 and r['waves'] == 7, json.dumps({k: r[k] for k in ('gold', 'chests', 'chest_gold', 'chest_gems')}))
g1, m1 = G(A)
check('the wallet moved by exactly the answer', g1 - g0 == 84 + r['chest_gold'] and m1 - m0 == r['chest_gems'] and r['state']['gold'] == g1 and 80 <= r['chest_gold'] <= 150 and 3 <= r['chest_gems'] <= 8, f'{g1-g0} {m1-m0}')
led = q("select cur, delta, ref from ledger where tg_id = %s and reason = 'trials' order by id", A)
check('the ledger has the rows (waves, chest gold, chest gems)', [x[2] for x in led] == ['waves:7', 'chest', 'chest'] and sum(x[1] for x in led if x[0] == 'gold') == g1 - g0, str(led))
check('the start is spent: another claim is refused', 'no run was started' in (claim(A, 7) or ''))
# spacing
back(A, last=120)
check('a new start is allowed', start(A) is None)
back(A, start=5000)
check('within 5 minutes of the last claim: refused', 'a moment ago' in (claim(A, 5) or ''))
back(A, last=400)
h = q1("select (date_trunc('hour', now() at time zone 'utc') = date_trunc('hour', (now() at time zone 'utc') - interval '400 seconds'))")
check('over 5 minutes but the same UTC hour: refused (when the clock allows it)', (not h) or 'one claim per hour' in (claim(A, 5) or ''), claim(A, 5))
back(A, last=7200)
# caps: 99 waves -> 60; 60*12 = 720 > what is left of 600
q("update wallets set claims = jsonb_set(claims, '{trials,start}', to_jsonb(now() - interval '5000 seconds')) where tg_id = %s and seat = 0", A)
r = anon('trials_claim', token=tok[A], seat=0, waves=99)
check('99 waves count as 60; the day cap 600 leaves only what is left', r['waves'] == 60 and r['gold'] + r['chest_gold'] <= 600 - 84, json.dumps({k: r[k] for k in ('waves', 'gold', 'chests', 'chest_gold', 'day_left')}))
check('the cap is spent: day_left 0 and the day total in claims', r['day_left'] == 0 and tr(A)['g'] == 600, json.dumps(tr(A)))
back(A, last=7200)
q("update wallets set claims = jsonb_set(claims, '{trials,start}', to_jsonb(now() - interval '5000 seconds')) where tg_id = %s and seat = 0", A)
check('after the cap a claim is refused', 'used up' in (claim(A, 5) or ''))
# a new day starts the cap again
q("update wallets set claims = jsonb_set(claims, '{trials,d}', '\"2000-01-01\"') where tg_id = %s and seat = 0", A)
r = anon('trials_claim', token=tok[A], seat=0, waves=20)
check('a new UTC day: 240 gold + chests (max 4, the 600 cap may stop the last)', r['gold'] == 240 and 2 <= r['chests'] <= 4 and r['gold'] + r['chest_gold'] <= 600,json.dumps({k: r[k] for k in ('gold', 'chests', 'chest_gold', 'day_left')}))
# another player is independent; 4 waves = no chest
start(B); back(B, start=100)
r = anon('trials_claim', token=tok[B], seat=0, waves=4)
check('4 waves: 48 gold, no chest', r['gold'] == 48 and r['chests'] == 0, json.dumps({k: r[k] for k in ('gold', 'chests')}))
check('the chests table is untouched', q1("select count(*) from chests where tg_id in (%s, %s)", A, B) == 0)
print('FAILS', fails); raise SystemExit(1 if fails else 0)
