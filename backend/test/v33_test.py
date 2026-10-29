# v33 (Mastery: two paths after a tower's last level) at SQL level on the local database, every app call as the anon role.
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
A, B = 993000001, 993000002
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'chests', 'items', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s)', A, B)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((A, 'Ann'), (B, 'Bob')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-10-29'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (A, B)}
for t in (A, B): anon('econ_state', token=tok[t], seat=0)
cfg = q1("select v from econ_config where k = 'mastery'")
check('the Mastery config is there: prices 20k / 40k / 80k, switching 10k, 30 stages, two towers', cfg['gold'] == [20000, 40000, 80000] and cfg['swap'] == 10000 and cfg['need_stages'] == 30 and cfg['towers'] == ['watch', 'scorp'], json.dumps(cfg))
def give(t, gold, lvl=16, stages=30, m=None):
    q("update wallets set gold = %s, levels = levels || %s::jsonb where tg_id = %s and seat = 0", gold, json.dumps({'t:watch': lvl, 't:scorp': lvl, **({'m:watch': m} if m is not None else {})}), t)
    q("delete from progress where tg_id = %s", t)
    for i in range(1, stages + 1): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3)", t, i)
def W(t): return q("select gold from wallets where tg_id = %s and seat = 0", t)[0][0]
def M(t): return q("select coalesce((levels->>'m:watch')::int, 0) from wallets where tg_id = %s and seat = 0", t)[0][0]
buy = lambda t, tw, p: err('mastery_buy', token=tok[t], seat=0, tower=tw, path=p)
# refusals
give(A, 500000, lvl=15)
check('a tower below the last level cannot be mastered', 'last level' in (buy(A, 'watch', 'a') or ''), buy(A, 'watch', 'a'))
give(A, 500000, stages=29)
check('under 30 stages is refused', 'clear 30 stages' in (buy(A, 'watch', 'a') or ''), buy(A, 'watch', 'a'))
give(A, 500000)
check('a tower without Mastery (Wildfire) is refused', 'no mastery' in (buy(A, 'wild', 'a') or ''))
check('a bad path is refused', 'bad path' in (buy(A, 'watch', 'c') or ''))
check('a wrong session is refused', 'bad session' in (err('mastery_buy', token='00000000-0000-0000-0000-000000000000', seat=0, tower='watch', path='a') or ''))
check('nothing changed: gold 500 000, no step', W(A) == 500000 and M(A) == 0)
# path A, three steps
r = anon('mastery_buy', token=tok[A], seat=0, tower='watch', path='a')
check('step 1 of path A costs 20 000 and is stored as 1', r['step'] == 1 and r['paid'] == 20000 and W(A) == 480000 and M(A) == 1, json.dumps({k: r[k] for k in ('step', 'paid')}))
check('the answer carries the state with the new level key', r['state']['levels'].get('m:watch') == 1 and r['state']['gold'] == 480000)
check('the other path is refused until a switch', 'switch the path first' in (buy(A, 'watch', 'b') or ''))
anon('mastery_buy', token=tok[A], seat=0, tower='watch', path='a'); anon('mastery_buy', token=tok[A], seat=0, tower='watch', path='a')
check('steps 2 and 3: 40 000 + 80 000 more, stored as 3', M(A) == 3 and W(A) == 360000, f'{M(A)} {W(A)}')
check('a fourth step is refused', 'already mastered' in (buy(A, 'watch', 'a') or ''))
led = q("select reason, delta, ref from ledger where tg_id = %s and reason = 'mastery' order by id", A)
check('the ledger has three Mastery rows that sum to -140 000', len(led) == 3 and sum(x[1] for x in led) == -140000, str(led))
# switching
check('switching costs 10 000 and clears the steps', anon('mastery_reset', token=tok[A], seat=0, tower='watch')['paid'] == 10000 and M(A) == 0 and W(A) == 350000)
r = anon('mastery_buy', token=tok[A], seat=0, tower='watch', path='b')
check('after the switch path B starts at step 1, stored as 11', M(A) == 11 and r['step'] == 1, M(A))
anon('mastery_buy', token=tok[A], seat=0, tower='watch', path='b'); anon('mastery_buy', token=tok[A], seat=0, tower='watch', path='b')
check('path B step 3 is stored as 13', M(A) == 13)
check('a reset with no steps is refused', 'nothing to switch' in (err('mastery_reset', token=tok[B], seat=0, tower='watch') or ''))
# money
give(B, 15000)
check('not enough gold is refused and nothing is stored', buy(B, 'watch', 'a') is not None and M(B) == 0 and W(B) == 15000, buy(B, 'watch', 'a'))
# anon rights
check('anon may call mastery_buy and mastery_reset', q1("select has_function_privilege('anon', 'mastery_buy(uuid,int,text,text)', 'execute') and has_function_privilege('anon', 'mastery_reset(uuid,int,text)', 'execute')"))
print('FAILS', fails); raise SystemExit(1 if fails else 0)
