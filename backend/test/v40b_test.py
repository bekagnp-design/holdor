# v40b: presence with extreme coordinates, capped boards, rpg_save_if (stale refusal), chat per-minute cap, block + report. Local database.
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
            c.execute(f'select {fn}({args})', kw); return c.fetchone()[0]
        finally: c.execute('reset role')
def refused(fn, **kw):
    try: anon(fn, **kw); return None
    except psycopg2.Error as e: return (e.diag.message_primary or str(e)).strip()
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
here = os.path.dirname(os.path.abspath(__file__))
with db.cursor() as c:
    c.execute(open(os.path.join(here, '..', 'holdor_v40.sql'), encoding='utf-8').read())
    c.execute(open(os.path.join(here, '..', 'holdor_v40b.sql'), encoding='utf-8').read())
A, B, C, D = 994100001, 994100002, 994100003, 994100004
for t in ('rpg_chat', 'rpg_presence', 'rpg_saves', 'chat_blocks', 'chat_mutes', 'sessions'):
    q(f'delete from {t} where tg_id in %s', (A, B, C, D))
q('delete from chat_blocks where blocked in %s', (A, B, C, D)); q('delete from chat_reports where author in %s or reporter in %s', (A, B, C, D), (A, B, C, D))
q('delete from players where tg_id in %s', (A, B, C, D))
for pid, nm, h in ((A, 'Ann', 'stark'), (B, 'Bob', 'lannister'), (C, 'Cat', 'martell'), (D, 'Dan', 'greyjoy')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, %s, 0, '{}', 1)", pid, nm, h)
ta, tb, tc, td = (q1('insert into sessions (tg_id) values (%s) returning token::text', p) for p in (A, B, C, D))
big = 2147483647
# presence: an extreme coordinate is clamped and does not break the others
anon('rpg_presence', token=tb, seat=0, x=big, y=-big, zone='north', lvl=9999, house='lannister', name='Bob')
r = anon('rpg_presence', token=ta, seat=0, x=-big, y=big, zone='north', lvl=3, house='stark', name='Ann')
row = q('select x, y, lvl from rpg_presence where tg_id = %s', B)[0]
check('presence: extreme coordinates are clamped to ±20000 and level to 60', row == (20000, -20000, 60), row)
check('presence: a neighbour with extreme coordinates does not break the query', [p['name'] for p in r['players']] == ['Bob'], r)
# boards cap absurd numbers
st = lambda lvl, best, kills, bosses, hall: json.dumps({'saved': 1, 'p': {'name': 'X', 'lvl': lvl}, 'acc': {'house': 'stark', 'best': {'lvl': best, 'kills': kills}, 'world': {'bosses': {str(i): 1 for i in range(bosses)}}, 'hall': [{}] * hall}})
anon('rpg_save', token=tc, seat=0, state=st(99999, 99999, 10**12, 50, 3))
b = anon('rpg_board', token=ta, kind='kills'); me = [x for x in b['rows'] if x['name'] == 'X']
check('board: kills capped at 1 000 000, level at 60', me and me[0]['v'] == 1000000 and me[0]['lvl'] == 60, me)
b = anon('rpg_board', token=ta, kind='bosses'); me = [x for x in b['rows'] if x['name'] == 'X']
check('board: bosses capped at 20', me and me[0]['v'] == 20, me)
# save_if: a stale base is refused and the stored state is returned; a current base is accepted; null base = no check
anon('rpg_save', token=td, seat=0, state=json.dumps({'saved': 2000, 'p': {'name': 'Dan', 'lvl': 7}}))
r = anon('rpg_save_if', token=td, seat=0, state=json.dumps({'saved': 3000, 'p': {'name': 'Dan', 'lvl': 2}}), base=1000)
check('save_if: refused as stale when the server save is newer than the base, the server state returned', r['ok'] is False and r['stale'] is True and r['state']['p']['lvl'] == 7 and r['saved'] == 2000, r)
check('save_if: the stored save is unchanged after a stale refusal', q1("select (state->'p'->>'lvl')::int from rpg_saves where tg_id = %s", D) == 7)
r = anon('rpg_save_if', token=td, seat=0, state=json.dumps({'saved': 3000, 'p': {'name': 'Dan', 'lvl': 8}}), base=2000)
check('save_if: accepted with the current base', r['ok'] is True and q1("select (state->'p'->>'lvl')::int from rpg_saves where tg_id = %s", D) == 8, r)
r = anon('rpg_save_if', token=td, seat=0, state=json.dumps({'saved': 3500, 'p': {'name': 'Dan', 'lvl': 9}}), base=None)
check('save_if: a null base skips the check (first push of a fresh account)', r['ok'] is True)
check('save_if: oversized state refused', 'too large' in (refused('rpg_save_if', token=td, seat=0, state=json.dumps({'x': 'y' * 210000}), base=None) or ''))
check('save_if: bad session refused', 'bad session' in (refused('rpg_save_if', token=str(uuid.uuid4()), seat=0, state='{}', base=None) or ''))
# chat: per-minute cap (12), block, report → mute after 3 reporters
q("insert into rpg_chat (tg_id, seat, zone, name, body, at) select %s, 0, 'north', 'Ann', 'old', now() - interval '30 seconds' from generate_series(1, 12)", A)
check('chat: the 13th message within a minute is refused', 'too fast' in (refused('rpg_chat_send', token=ta, seat=0, zone='north', body='hello') or ''))
mid = anon('rpg_chat_send', token=tb, seat=0, zone='north', body='hi from bob')['id']
check('chat block: the author of a message is blocked', anon('rpg_chat_block', token=ta, msg=mid)['ok'] and q1('select count(*) from chat_blocks where tg_id = %s and blocked = %s', A, B) == 1)
check('chat block: blocking myself is refused', 'that is you' in (refused('rpg_chat_block', token=tb, msg=mid) or ''))
lst = anon('rpg_chat_list', token=ta, seat=0, zone='north', since=0)
check('chat block: the blocked author disappears from my list', all(m['body'] != 'hi from bob' for m in lst['msgs']), lst)
for t in (ta, tc, td): anon('rpg_chat_report', token=t, msg=mid, reason='rude')
check('chat report: stored with a negative msg id, three reporters mute the author for an hour', q1('select count(*) from chat_reports where msg_id = %s', -mid) == 3 and q1('select until > now() + interval \'50 minutes\' from chat_mutes where tg_id = %s', B) is True)
check('chat report: a muted author cannot send', 'muted' in (refused('rpg_chat_send', token=tb, seat=0, zone='north', body='again') or ''))
check('no anon access to rpg_count', refused('rpg_count', j='{}') is not None)
print('v40b:', 'ALL OK' if not fails else 'FAILED ' + str(len(fails)))
raise SystemExit(1 if fails else 0)
