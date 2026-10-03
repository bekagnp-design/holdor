# v20 (Tasks instead of the estate, Quest Rush) checks against the local database, every app call as the anon role.
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

A, F1, F2 = 996000001, 996000002, 996000003
def wipe():
    for p in (A, F1, F2):
        q('delete from referrals where invitee = %s or inviter = %s', p, p)
        for t in ('task_marks', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'sessions', 'players'):
            q(f'delete from {t} where tg_id = %s', p)
wipe()
SAVE = json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 0, 'made': '2026-10-03', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, {'house': 'lannister', 'langI': 0, 'made': '2026-10-03', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, None]})
for p, n in ((A, 'Ann'), (F1, 'Fred'), (F2, 'Fay')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", p, n, SAVE)
tok = q1('insert into sessions (tg_id) values (%s) returning token::text', A)
anon('econ_state', token=tok, seat=0); anon('econ_state', token=tok, seat=1)
def W(seat=0): return q("select gold, gems, claims from wallets where tg_id = %s and seat = %s", A, seat)[0]
def item(st, i): return next((x for x in st['items'] if x['id'] == i), None)

# ---------- the events ----------
sched = [tuple(q("select kind, active from ev_at(%s)", t)[0]) for t in ('2026-09-28 00:00+00', '2026-09-29 23:59+00', '2026-09-30 12:00+00', '2026-10-02 00:00+00', '2026-10-03 23:59+00', '2026-10-04 12:00+00')]
check('Mon–Tue is Quest Rush now, Fri–Sat the Duel Cup', sched == [('rush', True), ('rush', True), ('cup', False), ('cup', True), ('cup', True), ('rush', False)], sched)
check('Quest Rush doubles gold, dragonglass and books', q1("""select qs_double('{"gold":300,"gems":20,"books":{"b:r":1}}'::jsonb)""") == {'gold': 600, 'gems': 40, 'books': {'b:r': 2}})
qid = q1("select x->>'id' from jsonb_array_elements(econ_cfg('quests')->'daily') x where x->>'m' = 'days' limit 1") or q1("select x->>'id' from jsonb_array_elements(econ_cfg('quests')->'daily') x limit 1")
qr = q1("select x->'r' from jsonb_array_elements(econ_cfg('quests')->'daily') x where x->>'id' = %s", qid)
qm = q1("select x->>'m' from jsonb_array_elements(econ_cfg('quests')->'daily') x where x->>'id' = %s", qid)
qn = q1("select (x->>'n')::int from jsonb_array_elements(econ_cfg('quests')->'daily') x where x->>'id' = %s", qid)
for i in range(qn):   # finish the quest with real battle rows
    q("insert into battles (tg_id, seat, kind, stage, status, kills, stars, waves, started_at, finished_at) values (%s, 0, 'camp', %s, 'won', 50, 3, 10, now() - interval '5 min', now())", A, i + 1)
if qm == 'new_stages':
    for i in range(qn): q("insert into progress (tg_id, seat, mode, stage, stars, at) values (%s, 0, 'c', %s, 3, now()) on conflict do nothing", A, i + 1)
r = anon('quest_claim', token=tok, seat=0, quest=qid)
rush = q1("select active from ev_at(now()) where kind = 'rush'") or False
check('a quest claim says whether the Rush was on and pays double only then', r['rush'] == rush and r['reward'] == (q1('select qs_double(%s::jsonb)', json.dumps(qr)) if rush else qr), (r['rush'], r['reward'], qr))
q("delete from battles where tg_id = %s", A); q("delete from progress where tg_id = %s", A)

# ---------- the estate is closed and refunded ----------
check('the estate is marked closed', q1("select (v->>'closed')::boolean from econ_config where k = 'estate'") is True)
check('building refuses: the estate is closed', err('estate_build', token=tok, seat=0, bld='farm') == 'the estate is closed')
check('collecting refuses: the estate is closed', err('estate_collect', token=tok, seat=0) == 'the estate is closed')
# a seat that built before the closing: open it for a moment, build two levels, pile up an hour, close, refund
q("update econ_config set v = v || '{\"closed\":false}'::jsonb where k = 'estate'")
q("update wallets set xp = 100000, gold = 10000 where tg_id = %s and seat = 0", A)
anon('estate_build', token=tok, seat=0, bld='farm'); anon('estate_build', token=tok, seat=0, bld='farm')
spent = 10000 - W()[0]
q("update wallets set claims = jsonb_set(claims, '{estate,at}', to_jsonb(now() - interval '1 hour')) where tg_id = %s and seat = 0", A)
pend = q1("select es_pending(w) from wallets w where tg_id = %s and seat = 0", A)
q("update econ_config set v = v || '{\"closed\":true}'::jsonb where k = 'estate'")
n = q1('select es_refund_all()')
g, gems, cl = W()
check('the refund: all the gold spent on buildings comes back, plus what had piled up', n >= 1 and g == 10000 + pend and spent == 2250 and pend > 0, (n, g, spent, pend))
check('the seat is marked refunded and the estate is gone from it', 'estate' not in cl and cl.get('estate_refund') == spent, cl)
check('the refund is booked in the ledger', q1("select sum(delta) from ledger where tg_id = %s and reason = 'estate_refund'", A) == spent)
check('a second run pays nothing', q1('select es_refund_all()') == 0 and W()[0] == g)

# ---------- tasks ----------
# the default list has no metric tasks; two are added for this test (the code supports them)
q('''update econ_config set v = jsonb_set(v, '{list}', (v->'list') || '[{"id":"stages5","kind":"metric","m":"new_stages","e":"🏰","n":"Clear 5 stages","need":5,"r":{"gold":800}},{"id":"stages15","kind":"metric","m":"new_stages","e":"🏰","n":"Clear 15 stages","need":15,"r":{"gems":40}}]'::jsonb) where k = 'tasks' ''')
st = anon('task_state', token=tok, seat=0)
check('links with no url are hidden (only the share task has one now)', [x['id'] for x in st['items'] if x['kind'] == 'link'] == ['share'], [x['id'] for x in st['items']])
check('metric and friend tasks are listed with their need', item(st, 'stages5')['need'] == 5 and item(st, 'friend3')['need'] == 3 and item(st, 'stages5')['st'] == 'new')
q("""update econ_config set v = jsonb_set(v, '{list}', (select jsonb_agg(case when x->>'id' = 'tg_channel' then x || '{"url":"https://t.me/holdor_test"}'::jsonb else x end) from jsonb_array_elements(v->'list') x)) where k = 'tasks'""")
st = anon('task_state', token=tok, seat=0)
check('a filled link shows up', item(st, 'tg_channel') and item(st, 'tg_channel')['url'] == 'https://t.me/holdor_test' and item(st, 'tg_channel')['st'] == 'new')
check('claiming before opening is refused', err('task_claim', token=tok, seat=0, task='tg_channel') == 'open the link first')
r = anon('task_open', token=tok, seat=0, task='tg_channel')
t = item(r['tasks'], 'tg_channel')
check('opened: the task waits about ten seconds', t['st'] == 'wait' and 8 <= t['left'] <= 10, t)
check('claiming at once is refused', err('task_claim', token=tok, seat=0, task='tg_channel') == 'a few more seconds')
anon('task_open', token=tok, seat=0, task='tg_channel')
check('opening again does not restart the clock', q1("select count(*) from task_marks where tg_id = %s", A) == 1)
q("update task_marks set opened_at = now() - interval '11 seconds' where tg_id = %s and id = 'tg_channel'", A)
check('after the wait it is ready', item(anon('task_state', token=tok, seat=0), 'tg_channel')['st'] == 'ready')
g0, gm0, _ = W()
r = anon('task_claim', token=tok, seat=0, task='tg_channel')
check('claimed: +50 dragonglass on the server, the task is done', W()[1] == gm0 + 50 and item(r['tasks'], 'tg_channel')['st'] == 'done' and r['state']['gems'] == gm0 + 50, (W()[1], gm0))
check('a second claim is refused', err('task_claim', token=tok, seat=0, task='tg_channel') == 'already claimed')
check('a link task is once per Telegram account: done on seat II too', item(anon('task_state', token=tok, seat=1), 'tg_channel')['st'] == 'done' and err('task_claim', token=tok, seat=1, task='tg_channel') == 'already claimed')
check('unknown tasks and empty links are refused', err('task_open', token=tok, seat=0, task='nope') == 'no such task' and err('task_open', token=tok, seat=0, task='x') == 'no such task' and err('task_claim', token=tok, seat=0, task='youtube') == 'no such task')
check('a metric task cannot be opened like a link', err('task_open', token=tok, seat=0, task='stages5') == 'no such task')

# a metric task: five stages cleared on seat 0
check('stages5 is not done yet', err('task_claim', token=tok, seat=0, task='stages5') == 'not done yet: 0 of 5')
for i in range(1, 6): q("insert into progress (tg_id, seat, mode, stage, stars, at) values (%s, 0, 'c', %s, 3, now())", A, i)
st = anon('task_state', token=tok, seat=0)
check('five stages: ready, 5 / 5', item(st, 'stages5')['st'] == 'ready' and item(st, 'stages5')['cur'] == 5 and st['ready'] >= 1, item(st, 'stages5'))
g0 = W()[0]; r = anon('task_claim', token=tok, seat=0, task='stages5')
check('claimed: +800 gold', W()[0] == g0 + 800 and 'stages5' in W()[2]['tasks'])
check('metric tasks are per seat: seat II still has 0 of 5', item(anon('task_state', token=tok, seat=1), 'stages5')['cur'] == 0 and item(anon('task_state', token=tok, seat=1), 'stages5')['st'] == 'new')
check('stages15 shows the progress 5 / 15', item(st, 'stages15')['cur'] == 5)

# friends
check('no friend yet', err('task_claim', token=tok, seat=0, task='friend1') == 'not done yet: 0 of 1')
q("insert into referrals (invitee, inviter) values (%s, %s), (%s, %s)", F1, A, F2, A)
st = anon('task_state', token=tok, seat=0)
check('two friends joined: friend1 ready, friend3 at 2 / 3', item(st, 'friend1')['st'] == 'ready' and item(st, 'friend3')['cur'] == 2 and item(st, 'friend3')['st'] == 'new')
gm0 = W()[1]; anon('task_claim', token=tok, seat=0, task='friend1')
check('friend1 paid once per account', W()[1] == gm0 + 40 and err('task_claim', token=tok, seat=1, task='friend1') == 'already claimed')
check('the ledger books every task gift with reason task', q1("select count(*) from ledger where tg_id = %s and reason = 'task'", A) == 3)
check('the owner view counts the tasks', q1("select claimed from v_tasks where id = 'tg_channel'") >= 1)
check('the anon role cannot read task_marks', q1("select has_table_privilege('anon', 'task_marks', 'select')") is False)

q("""update econ_config set v = jsonb_set(v, '{list}', (select jsonb_agg(case when x->>'id' = 'tg_channel' then x || '{"url":""}'::jsonb else x end) from jsonb_array_elements(v->'list') x)) where k = 'tasks'""")
q('''update econ_config set v = jsonb_set(v, '{list}', (select jsonb_agg(x) from jsonb_array_elements(v->'list') x where x->>'kind' <> 'metric')) where k = 'tasks' ''')
wipe()
print('FAILED:' if fails else 'all v20 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
