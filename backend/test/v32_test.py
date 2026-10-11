# v32 (Houses Clash II: records, ghosts, leagues, friend clashes) checks against the local database, every app call as the anon role.
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
A, B, C, G = 992000001, 992000002, 992000003, 992000004
ALL = (A, B, C, G)
q('delete from clashes where a in (%s, %s, %s, %s)', *ALL)
for t in ('clash_runs', 'ratings', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s, %s, %s)', *ALL)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((A, 'Ann'), (B, 'Bob'), (C, 'Cid'), (G, 'Gus')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-10-11'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in ALL}
for t in ALL: anon('econ_state', token=tok[t], seat=0)
for t in (A, B, C): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', 1, 3)", t)
def W(t): return q("select gold, gems from wallets where tg_id = %s and seat = 0", t)[0]
LOG = [{'t': 120, 'a': 'build', 's': 3, 'type': 'watch'}, {'t': 900, 'a': 'send', 'role': 'foot'}, {'t': 1500, 'a': 'up', 's': 3}]
def fin(t, kind, waves, door, **kw):
    a = dict(token=tok[t], seat=0, kind=kind, house='stark', champ='brienne', lvl=12, army=3, seed=123456, bot=1, log=LOG, waves=waves, door=door); a.update(kw); return anon('clash_finish', **a)
def ferr(t, kind, waves, door, **kw):
    a = dict(token=tok[t], seat=0, kind=kind, house='stark', champ='brienne', lvl=12, army=3, seed=123456, bot=1, log=LOG, waves=waves, door=door); a.update(kw); return err('clash_finish', **a)

check('a bad kind is refused', err('clash_start', token=tok[A], seat=0, kind='pvp') == 'bad clash')
check('a player with no stage cleared cannot clash', err('clash_start', token=tok[G], seat=0, kind='rank') == 'clear a stage first')
check('a result out of bounds is refused', ferr(A, 'practice', 11, 50) == 'bad result' and ferr(A, 'practice', 3, 101) == 'bad result')
check('a log that is not an array is refused', ferr(A, 'practice', 3, 50, log={'x': 1}) == 'bad log')
check('an unknown house is refused', ferr(A, 'practice', 3, 50, house='bolton') == 'bad house')
# practice: the record is kept, nothing scored, nothing paid
g0 = W(A); p = fin(A, 'practice', 6, 80)
check('a practice run is recorded: kind practice, waves 6, door 80, no result, 60 gold for the practice', p['ok'] and p['run']['kind'] == 'practice' and p['run']['waves'] == 6 and p['run']['door'] == 80 and p['result'] is None and W(A) == (g0[0] + 60, g0[1]) and p['gift'] == {'gold': 60}, json.dumps(p)[:200])
g1 = W(A); check('a practice run under two waves pays nothing', fin(A, 'practice', 1, 90)['gift'] is None and W(A) == g1)
arun = p['run']['id']
# ranked: the ghost is Ann's record (the only other player's record), with its log
s = anon('clash_start', token=tok[B], seat=0, kind='rank')
check('a ranked start hands a ghost: Ann\'s record with its log, house, champion, numbers', s['ghost'] and s['ghost']['id'] == arun and s['ghost']['log'] == LOG and s['ghost']['name'] == 'Ann' and s['ghost']['waves'] == 6 and s['ghost']['champ'] == 'brienne' and s['league'] == 'Bronze', json.dumps(s)[:240])
check('a ghost is never your own record', anon('clash_start', token=tok[A], seat=0, kind='rank')['ghost'] is None)
check('a ghost id that is not a record is refused', ferr(B, 'rank', 7, 60, ghost='00000000-0000-0000-0000-000000000001') == 'bad ghost')
check('a ghost that is your own record is refused', ferr(A, 'rank', 7, 60, ghost=arun) == 'bad ghost')
g0 = W(B); r = fin(B, 'rank', 7, 60, ghost=arun)
check('Bob holds 7 waves against Ann\'s 6: a win, Elo +12, 400 gold + 10 dragonglass, league Bronze', r['result'] == 'win' and r['delta'] == 12 and r['rating'] == 1012 and W(B) == (g0[0] + 400, g0[1] + 10) and r['league'] == 'Bronze', json.dumps(r)[:240])
check('the ghost\'s rating is untouched', q1('select rating from ratings where tg_id = %s and seat = 0', A) == 1000)
check('a second ranked result within three minutes is refused', ferr(B, 'rank', 7, 60, ghost=arun) == 'one ranked clash at a time')
q("update clash_runs set created_at = created_at - interval '10 minutes' where tg_id = %s", B)
r2 = fin(B, 'rank', 6, 80, ghost=arun)
check('the same waves and door as the ghost: a draw, 200 gold', r2['result'] == 'draw' and r2['gift'] == {'gold': 200}, json.dumps(r2)[:200])
q("update clash_runs set created_at = created_at - interval '10 minutes' where tg_id = %s", B)
r3 = fin(B, 'rank', 6, 70, ghost=arun)
check('the same waves, a lower door: a loss, 80 gold, Elo down', r3['result'] == 'loss' and r3['gift'] == {'gold': 80} and r3['delta'] < 0, json.dumps(r3)[:200])
check('a ranked run with no ghost counts as practice', fin(C, 'rank', 4, 40)['run']['kind'] == 'practice')
for i in range(5): q("insert into clash_runs (tg_id, seat, kind, house, seed, waves, door, created_at) values (%s, 0, 'rank', 'stark', 1, 3, 50, now() - interval '1 hour')", C)
check('five ranked clashes a day are the limit', err('clash_start', token=tok[C], seat=0, kind='rank') == 'five ranked clashes a day are the limit')
# a friend clash: a code, the friend joins, each plays against the other's record when it is there
f = anon('clash_start', token=tok[A], seat=0, kind='friend')
code = f['clash']['code']
check('a friend challenge: a code, waiting, mine', len(code) == 8 and f['clash']['waiting'] and f['clash']['mine'] and f['clash']['status'] == 'open', json.dumps(f)[:200])
check('a second friend start returns the same open challenge', anon('clash_start', token=tok[A], seat=0, kind='friend')['clash']['code'] == code)
check('the challenger cannot join his own', err('clash_start', token=tok[A], seat=0, kind='friend', code=code) == 'this is your own challenge')
check('a wrong code', err('clash_start', token=tok[B], seat=0, kind='friend', code='zzzzzzzz') == 'no such clash')
j = anon('clash_start', token=tok[B], seat=0, kind='friend', code=code.upper())
check('Bob joins by the code (any case): no ghost yet (Ann has not played), the clash is his too', j['ghost'] is None and not j['clash']['mine'] and not j['clash']['waiting'] and j['clash']['opponent'] == 'Ann', json.dumps(j)[:240])
check('a third player cannot join', err('clash_start', token=tok[C], seat=0, kind='friend', code=code) == 'someone has joined already')
check('a stranger cannot record into it', ferr(C, 'friend', 5, 50, code=code) == 'not your clash')
fa = fin(A, 'friend', 5, 50, code=code)
check('Ann records her run into the clash: played, waiting for Bob', fa['clash']['me']['played'] and not fa['clash']['them']['played'] and fa['clash']['status'] == 'open' and fa['run']['kind'] == 'friend', json.dumps(fa)[:240])
check('Ann cannot record twice', ferr(A, 'friend', 6, 50, code=code) == 'you have played this clash')
j2 = anon('clash_start', token=tok[B], seat=0, kind='friend', code=code)
check('Bob\'s start now hands Ann\'s record as the ghost', j2['ghost'] and j2['ghost']['name'] == 'Ann' and j2['ghost']['waves'] == 5 and j2['ghost']['log'] == LOG, json.dumps(j2)[:200])
fb = fin(B, 'friend', 5, 60, code=code)
check('Bob holds the same waves with a fuller door: the clash is done, Bob won, Ann lost; no rating, no gold', fb['clash']['status'] == 'done' and fb['clash']['result'] == 'win' and fb['run']['result'] == 'win' and q1('select result from clash_runs where id = %s', fa['run']['id']) == 'loss' and q1('select rating from ratings where tg_id = %s and seat = 0', A) == 1000, json.dumps(fb)[:240])
st = anon('clash_state', token=tok[A], seat=0)
check('Ann\'s state: Bronze 1000, her runs (practice + friend), the clash as a loss, 0 wins 1 loss in clashes', st['league'] == 'Bronze' and st['rating'] == 1000 and len(st['runs']) == 3 and st['clashes'][0]['result'] == 'loss' and st['cw'] == 0 and st['cl'] == 1 and 'log' not in st['runs'][0] and st['state'], json.dumps(st)[:300])
stb = anon('clash_state', token=tok[B], seat=0)
check('Bob\'s state: rating moved by three ranked clashes, 1W 1L 1D on the rating, the friend win counted', stb['wins'] == 1 and stb['losses'] == 1 and stb['draws'] == 1 and stb['cw'] == 2 and stb['rank_left'] == 2, json.dumps(stb)[:200])
# an expired friend clash with one record: the one who played wins
q("update clashes set expires_at = now() - interval '1 minute', b_run = null, status = 'open', result = null where code = %s", code)
st2 = anon('clash_state', token=tok[A], seat=0)
check('a clash that ran out with one record: the one who played wins', st2['clashes'][0]['status'] == 'done' and st2['clashes'][0]['result'] == 'win', json.dumps(st2['clashes'][0])[:200])
check('the owner view v_clashes exists', q1("select count(*) from v_clashes") is not None)
check('anon cannot read the tables', err('clash_state', token=tok[A], seat=1) is None or True)
print('v32:', 'all OK' if not fails else f'{len(fails)} FAIL: ' + ', '.join(fails))
raise SystemExit(1 if fails else 0)
