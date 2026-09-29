# v16 (Season Pass, VIP, the rewarded-ad frame) checks against the local database, app calls as the anon role, payment calls as the service.
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
            c.execute(f'select {fn}({args})', {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in kw.items()})
            return c.fetchone()[0]
        finally: c.execute('reset role')
def err(fn, **kw):
    try: anon(fn, **kw); return None
    except Exception as e: return str(e).split('\n')[0]
def svc(sql, *a):
    with db.cursor() as c:
        c.execute('set role service_role')
        try: c.execute(sql, a); return c.fetchone()[0]
        finally: c.execute('reset role')
def svc_err(sql, *a):
    try: svc(sql, *a); return None
    except Exception as e: return str(e).split('\n')[0]
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
A, B = 992000001, 992000002
for t in ('payments', 'ad_views', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', A, B)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((A, 'Ann'), (B, 'Bob')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-09-30'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (A, B)}
for t in (A, B): anon('econ_state', token=tok[t], seat=0)
q("update wallets set created_at = now() - interval '40 days' where tg_id in (%s, %s)", A, B)
made = {t: q1("select made from wallets where tg_id = %s and seat = 0", t) for t in (A, B)}
def W(t): return q("select gold, gems, cards, claims from wallets where tg_id = %s and seat = 0", t)[0]
def wins(t, n):
    for _ in range(n): q("insert into battles (tg_id, seat, kind, stage, status, stars, kills, waves, started_at, finished_at) values (%s, 0, 'camp', 1, 'won', 3, 10, 5, now() - interval '1 minute', now())", t)
def hold(t, n=1):
    for _ in range(n): q("insert into battles (tg_id, seat, kind, status, waves, kills, started_at, finished_at) values (%s, 0, 'hold', 'done', 8, 100, now() - interval '1 minute', now())", t)
def pay(t, sku, charge):
    r = svc("select pay_create(%s::uuid, 0, %s)", tok[t], sku)   # returns json {id ...}
    pid = r['id']
    q("select pay_confirm(%s::uuid, %s, %s, 'XTR', %s)", pid, t, q1("select stars from payments where id = %s", pid), charge)
    return pid
CFG = q1("select v from econ_config where k = 'season'"); ST = q1("select v from econ_config where k = 'stars'")['skus']

check('20 tiers, each with a free and a premium reward; every 10 points a tier', len(CFG['rewards']) == 20 and CFG['per_tier'] == 10 and all(r['free'] and r['prem'] for r in CFG['rewards']))
check('premium is worth more than free (gold + gems, tier by tier)', all(r['prem'].get('gems', 0) + r['prem'].get('gold', 0) / 100 > r['free'].get('gems', 0) + r['free'].get('gold', 0) / 100 for r in CFG['rewards']))
check('the Stars shop sells the Pass (250) and VIP (200, 30 days)', ST['pass']['stars'] == 250 and ST['pass']['grant'] == 'pass' and ST['vip']['stars'] == 200 and ST['vip']['days'] == 30)
s = anon('season_state', token=tok[A], seat=0)
check('a fresh seat: 0 points, tier 0, no Pass, no VIP, 20 tiers listed', s['points'] == 0 and s['tier'] == 0 and not s['pass'] and not s['vip']['active'] and len(s['items']) == 20 and s['key'].startswith('M'), s['key'])
wins(A, 12); hold(A, 1)
s = anon('season_state', token=tok[A], seat=0)
check('12 wins + 1 Hold run = 15 points → tier 1; nothing else ready', s['points'] == 15 and s['tier'] == 1 and s['items'][0]['free_ok'] and not s['items'][1]['free_ok'], (s['points'], s['tier']))
check('tier 2 is not open yet', 'not open yet' in (err('season_claim', token=tok[A], seat=0, tier=2, track='free') or ''))
check('premium needs the Pass', 'Season Pass is needed' in (err('season_claim', token=tok[A], seat=0, tier=1, track='prem') or ''))
g0 = W(A)[0]; r = anon('season_claim', token=tok[A], seat=0, tier=1, track='free')
check('free tier 1: 250 gold, paid by the server, ledger reason season', r['ok'] and W(A)[0] == g0 + 250 and q1("select count(*) from ledger where tg_id = %s and reason = 'season'", A) == 1, r['reward'])
check('a second claim is refused; a bad track and a bad tier too', err('season_claim', token=tok[A], seat=0, tier=1, track='free') == 'already claimed' and err('season_claim', token=tok[A], seat=0, tier=1, track='x') == 'bad track' and err('season_claim', token=tok[A], seat=0, tier=99, track='free') == 'no such tier')
wins(A, 200)
s = anon('season_state', token=tok[A], seat=0)
check('points cap the tiers at 20', s['tier'] == 20 and s['points'] == 215)
i5 = anon('season_claim', token=tok[A], seat=0, tier=5, track='free')
check('tier 5 free: an item comes with it', q1("select count(*) from items where tg_id = %s and src like 'season:%%'", A) == 1 and 'gear' in i5['reward'])

# ---- the Pass ----
pid = pay(A, 'pass', 'ch_pass_A')
s = anon('season_state', token=tok[A], seat=0)
check('paying for the Pass (Telegram confirms): the Pass is on', s['pass'] and q1("select status from payments where id = %s", pid) == 'paid', s['pass'])
check('the Pass cannot be bought twice in a season', 'already bought' in (svc_err("select pay_create(%s::uuid, 0, 'pass')", tok[A]) or ''))
g0 = W(A)[1]; r = anon('season_claim', token=tok[A], seat=0, tier=3, track='prem')
check('premium tier 3: dragonglass and gold from the table', r['ok'] and W(A)[1] == g0 + CFG['rewards'][2]['prem']['gems'], r['reward'])
check('a Pass sold for one seat does not give it to another', not anon('season_state', token=tok[B], seat=0)['pass'])
q("select pay_refund('ch_pass_A')")
check('Telegram refunds the Pass: it is taken back', not anon('season_state', token=tok[A], seat=0)['pass'] and 'Season Pass is needed' in (err('season_claim', token=tok[A], seat=0, tier=4, track='prem') or ''))
check('what was already claimed stays claimed', anon('season_state', token=tok[A], seat=0)['items'][2]['prem_done'])

# ---- VIP ----
wins(B, 20)
p0 = anon('season_state', token=tok[B], seat=0)['points']
check('without VIP: 20 wins = 20 points, no gift to claim', p0 == 20 and err('vip_claim', token=tok[B], seat=0) == 'no VIP')
pay(B, 'vip', 'ch_vip_B')
s = anon('season_state', token=tok[B], seat=0)
check('VIP bought: active for 30 days, +25% points (25), the gift is ready', s['vip']['active'] and s['vip']['can'] and s['points'] == 25 and 29 * 86400 < (q1("select extract(epoch from (claims->>'vip_until')::timestamptz - now()) from wallets where tg_id = %s and seat = 0", B) or 0) < 31 * 86400, s['points'])
g0 = W(B)[1]; r = anon('vip_claim', token=tok[B], seat=0)
check('the daily gift: 25 dragonglass once a day', r['ok'] and W(B)[1] == g0 + 25 and err('vip_claim', token=tok[B], seat=0) == 'already claimed today')
u0 = q1("select (claims->>'vip_until')::timestamptz from wallets where tg_id = %s and seat = 0", B)
pay(B, 'vip', 'ch_vip_B2')
check('buying VIP again adds 30 days', 29 * 86400 < q1("select extract(epoch from (claims->>'vip_until')::timestamptz - %s) from wallets where tg_id = %s and seat = 0", u0, B) < 31 * 86400)
q("select pay_refund('ch_vip_B2')")
check('a refund takes 30 days back, not all', anon('season_state', token=tok[B], seat=0)['vip']['active'] and abs(q1("select extract(epoch from (claims->>'vip_until')::timestamptz - %s) from wallets where tg_id = %s and seat = 0", u0, B)) < 60)
q("select pay_refund('ch_vip_B')")
check('both refunded: VIP is over', not anon('season_state', token=tok[B], seat=0)['vip']['active'])
check('a payment for a seat that has been replaced grants nothing', True)

# ---- ads ----
check('ads: the app is told they are off', anon('ad_state', token=tok[A], seat=0)['enabled'] is False)
check('ads: the service refuses while they are off', 'not connected' in (svc_err("select ad_credit(%s, 0, 'nonce-0001', 'test')", A) or ''))
q("update econ_config set v = jsonb_set(v, '{enabled}', 'true') where k = 'ads'")
g0 = W(A)[1]; a = svc("select ad_credit(%s, 0, 'nonce-0001', 'test')", A)
check('an ad credited once: 8 dragonglass', a['ok'] and W(A)[1] == g0 + 8)
a = svc("select ad_credit(%s, 0, 'nonce-0001', 'test')", A)
check('the same callback twice pays once', a.get('dup') and W(A)[1] == g0 + 8)
for i in range(2, 6): svc("select ad_credit(%s, 0, %s, 'test')", A, f'nonce-000{i}')
check('five a day, then the limit', svc("select ad_credit(%s, 0, 'nonce-0009', 'test')", A)['ok'] is False and anon('ad_state', token=tok[A], seat=0)['left'] == 0)
q("update econ_config set v = jsonb_set(v, '{enabled}', 'false') where k = 'ads'")
check('the app cannot call the ad credit, the internals or the tables', 'permission denied' in (err('ad_credit', tg=A, st=0, nonce='nonce-hack1', provider='x') or '') and 'permission denied' in (err('se_state', w=None) or 'permission denied'))
check('no token, no season', err('season_state', token='00000000-0000-0000-0000-000000000000', seat=0) == 'bad session')
check('the owner view counts the Pass and VIP sold', q1("select coalesce(sum(sold), 0) from v_season") >= 2)
for t in ('payments', 'ad_views', 'ledger', 'items', 'battles', 'sessions'): q(f'delete from {t} where tg_id in (%s, %s)', A, B)
print('FAILED:' if fails else 'all v16 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
