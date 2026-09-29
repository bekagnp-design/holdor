# v14 (invitations) checks against the local database, every app call as the anon role.
# Needs the chain up to holdor_v14.sql (run_all.sh). Re-runnable: own players 990000001–4.
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
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
A, B, C, D = 990000001, 990000002, 990000003, 990000004
ALL = (A, B, C, D)
for t in ('referrals', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where ' + ('invitee' if t == 'referrals' else 'tg_id') + ' in (%s, %s, %s, %s)', *ALL)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((A, 'Ann'), (B, 'Bob'), (C, 'Cid'), (D, 'Dee')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-09-30'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in ALL}
for t in ALL: anon('econ_state', token=tok[t], seat=0)
def code(t): return q1('select ref_code from players where tg_id = %s', t)
def clear(t, n):
    for s in range(1, n + 1): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", t, s)
def W(t): return q("select gold, gems, cards from wallets where tg_id = %s and seat = 0", t)[0]
CFG = q1("select v from econ_config where k = 'referral'")

check('everyone has a short unique code, new players get one too', len({code(t) for t in ALL}) == 4 and all(code(t) and len(code(t)) == 8 for t in ALL))
q("delete from players where tg_id = 990000009"); q("insert into players (tg_id, name, house, realm, save, save_ver) values (990000009, 'New', 'stark', 0, '{}', 1)")
check('a player made after v14 gets a code from the default', len(q1('select ref_code from players where tg_id = 990000009') or '') == 8); q("delete from players where tg_id = 990000009")
check('the config: 5 stages, a cap, both gifts', CFG['need'] == 5 and CFG['cap'] >= 1 and CFG['inviter'] and CFG['invitee'])

check('a wrong code is refused', err('ref_join', token=tok[B], code='deadbeef') == 'no such invitation')
check('one cannot invite himself', err('ref_join', token=tok[A], code=code(A)) == 'not your own invitation')
r = anon('ref_join', token=tok[B], code=code(A).upper() + ' ')
check('a new player joins by the code (upper case and spaces do not matter)', r['ok'] and r['by'] == 'Ann', r)
check('only once', err('ref_join', token=tok[B], code=code(C)) == 'already invited')
clear(C, 1)
check('a player who has already played cannot join', err('ref_join', token=tok[C], code=code(A)) == 'only a new player can join')
anon('ref_join', token=tok[D], code=code(A))

st = anon('ref_state', token=tok[A], seat=0)
check('the inviter sees her two friends with their progress, none done', st['need'] == 5 and [(x['name'], x['stages'], x['done'], x['claimed']) for x in st['invited']] == [('Bob', 0, False, False), ('Dee', 0, False, False)] and st['code'] == code(A), st)
stb = anon('ref_state', token=tok[B], seat=0)
check('the friend sees who invited him', stb['mine']['name'] == 'Ann' and not stb['mine']['done'], stb['mine'])
check('no gift before the goal, on either side', 'clear 5 stages' in (err('ref_claim', token=tok[B], seat=0) or '') and 'has not cleared 5' in (err('ref_claim', token=tok[A], seat=0, other=B) or ''))
check('a stranger is not the inviter\'s friend', err('ref_claim', token=tok[C], seat=0, other=B) == 'not your friend')

clear(B, 4)
check('4 stages: still not', 'has not cleared 5' in (err('ref_claim', token=tok[A], seat=0, other=B) or ''))
clear(B, 5)
st = anon('ref_state', token=tok[A], seat=0)
check('5 stages: the friend is done for the inviter', st['invited'][0]['done'] and st['invited'][0]['stages'] == 5 and not st['invited'][0]['claimed'])
a0, b0 = W(A), W(B)
ra = anon('ref_claim', token=tok[A], seat=0, other=B)
check('the inviter gets her gift once (60 dragonglass + a Rare book)', ra['ok'] and W(A)[1] == a0[1] + 60 and W(A)[2].get('b:r', 0) == a0[2].get('b:r', 0) + 1, ra['reward'])
check('a second claim for the same friend is refused', err('ref_claim', token=tok[A], seat=0, other=B) == 'already claimed')
rb = anon('ref_claim', token=tok[B], seat=0)
check('the friend gets his gift (100 dragonglass + 2000 gold)', rb['ok'] and W(B)[1] == b0[1] + 100 and W(B)[0] == b0[0] + 2000, rb['reward'])
check('the friend cannot claim twice', err('ref_claim', token=tok[B], seat=0) == 'already claimed')
check('both gifts are in the ledger with the reason', q1("select count(*) from ledger where reason = 'referral' and tg_id in (%s, %s)", A, B) >= 3)
check('the friend\'s state shows it claimed; the inviter sees 1 rewarded', anon('ref_state', token=tok[B], seat=0)['mine']['claimed'] and anon('ref_state', token=tok[A], seat=0)['paid'] == 1)
check('the second friend (0 stages) is still waiting', [x['claimed'] for x in anon('ref_state', token=tok[A], seat=0)['invited']] == [True, False])

# the cap
q("update econ_config set v = jsonb_set(v, '{cap}', '1') where k = 'referral'"); clear(D, 5)
check('the cap: a second rewarded friend is refused', 'limit of 1 rewarded' in (err('ref_claim', token=tok[A], seat=0, other=D) or ''))
q("update econ_config set v = jsonb_set(v, '{cap}', '20') where k = 'referral'")
check('the friend of a capped inviter still gets his own gift', anon('ref_claim', token=tok[D], seat=0)['ok'])
check('the raise of the cap lets the inviter claim', anon('ref_claim', token=tok[A], seat=0, other=D)['ok'])

check('no token, no state', err('ref_state', token='00000000-0000-0000-0000-000000000000', seat=0) == 'bad session')
try:
    with db.cursor() as c:
        c.execute('set role anon'); c.execute('select 1 from referrals limit 1'); bad = False
except Exception as e: bad = 'permission denied' in str(e)
finally: db.cursor().execute('reset role')
check('the table is closed to the app', bad)
check('the owner view counts', q1("select coalesce(sum(invited), 0) from v_referrals") >= 2)
for t in ('referrals', 'items', 'ledger', 'sessions'): q(f'delete from {t} where ' + ('invitee' if t == 'referrals' else 'tg_id') + ' in (%s, %s, %s, %s)', *ALL)
print('FAILED:' if fails else 'all v14 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
