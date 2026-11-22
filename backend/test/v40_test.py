# v40 (the RPG's server side): save/load round trip with the old wallet imported, presence by zone / distance / freshness,
# the zone chat (clean, 160 chars, one per 2 s, blocks), the three boards, bad sessions and oversized saves refused. Local database.
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
    """the error message when anon's call is refused, else None"""
    try: anon(fn, **kw); return None
    except psycopg2.Error as e: return (e.diag.message_primary or str(e)).strip()
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
# realms_test reloads the chain up to v30: load v40 again first (re-runnable)
with db.cursor() as c: c.execute(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'holdor_v40.sql'), encoding='utf-8').read())

A, B, C, D = 994000001, 994000002, 994000003, 994000004
for t in ('rpg_chat', 'rpg_presence', 'rpg_saves', 'chat_blocks', 'wallets', 'sessions'):
    q(f'delete from {t} where tg_id in %s', (A, B, C, D))
q('delete from chat_blocks where blocked in %s', (A, B, C, D))
q('delete from players where tg_id in %s', (A, B, C, D))
for pid, nm, h in ((A, 'Ann', 'stark'), (B, 'Bob', 'lannister'), (C, 'Cat', 'martell'), (D, 'Dan', 'greyjoy')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, %s, 0, '{}', 1)", pid, nm, h)
ta, tb, tc, td = (q1('insert into sessions (tg_id) values (%s) returning token::text', p) for p in (A, B, C, D))

# --- sessions
check('bad session refused', 'bad session' in (refused('rpg_load', token=str(uuid.uuid4()), seat=0) or ''))

# --- load before any save, no wallet
r = anon('rpg_load', token=ta, seat=0)
check('empty load: state null, wallet zeros', r['state'] is None and r['wallet'] == {'gold': 0, 'gems': 0, 'champs': {}}, json.dumps(r))

# --- the old wallet comes along: gold, gems, the champion levels only
q("insert into wallets (tg_id, seat, gold, gems, levels) values (%s, 0, 1234, 56, %s)", A, json.dumps({'c:jon': 5, 'c:arya': 3, 't:watch': 4, 's:fire': 2, 'army': 7}))
r = anon('rpg_load', token=ta, seat=0)
check('wallet import shape', r['wallet'] == {'gold': 1234, 'gems': 56, 'champs': {'jon': 5, 'arya': 3}}, json.dumps(r['wallet']))

# --- save / load round trip
sA = {'v': 1, 'p': {'name': 'Ann40', 'house': 'stark', 'lvl': 12, 'bosses': {'b_riv': 2, 'b_vale': 1}, 'killed': {'axe': 30, 'hound': 12}, 'pos': {'x': 1000, 'y': 1000}}}
r = anon('rpg_save', token=ta, seat=0, state=json.dumps(sA))
check('save ok', r.get('ok') is True and r.get('saved_at'), json.dumps(r))
r = anon('rpg_load', token=ta, seat=0)
check('load returns the saved state and the wallet', r['state'] == sA and r['wallet']['gold'] == 1234, json.dumps(r)[:200])
t1 = q1('select saved_at from rpg_saves where tg_id = %s and seat = 0', A)
q('update rpg_saves set saved_at = saved_at - interval \'1 hour\' where tg_id = %s', A)
sA['p']['lvl'] = 13
anon('rpg_save', token=ta, seat=0, state=json.dumps(sA))
t2 = q1('select saved_at from rpg_saves where tg_id = %s and seat = 0', A)
check('re-save replaces the state and moves saved_at', anon('rpg_load', token=ta, seat=0)['state']['p']['lvl'] == 13 and t2 >= t1, f'{t1} {t2}')
check('one row per seat', q1('select count(*) from rpg_saves where tg_id = %s', A) == 1)
check('another seat is its own save', anon('rpg_load', token=ta, seat=1)['state'] is None)

# --- refusals on saves
big = dict(sA); big['blob'] = 'x' * (205 * 1024)
check('oversized state refused', 'too large' in (refused('rpg_save', token=ta, seat=0, state=json.dumps(big)) or ''))
check('a non-object state refused', 'bad state' in (refused('rpg_save', token=ta, seat=0, state=json.dumps([1, 2])) or ''))
check('bad seat refused', 'bad seat' in (refused('rpg_save', token=ta, seat=7, state=json.dumps(sA)) or ''))
check('save with a bad session refused', 'bad session' in (refused('rpg_save', token=str(uuid.uuid4()), seat=0, state=json.dumps(sA)) or ''))
check('the oversized save changed nothing', anon('rpg_load', token=ta, seat=0)['state'] == sA)

# --- presence
P = dict(seat=0, lvl=5, house='lannister', name='Bob http://spam.example.com @bobby')
r = anon('rpg_presence', token=tb, x=1800, y=1000, zone='north', **P)
check('first presence: nobody else yet', r == {'players': []}, json.dumps(r))
r = anon('rpg_presence', token=tc, seat=0, x=5000, y=9000, zone='south', lvl=9, house='martell', name='Cat')
r = anon('rpg_presence', token=ta, seat=0, x=1000, y=1000, zone='north', lvl=12, house='stark', name='Ann')
names = [p['name'] for p in r['players']]
check('I see the other in my zone, not the one far away in another zone', len(r['players']) == 1 and names[0].startswith('Bob'), json.dumps(r))
check('I am not in my own list', 'Ann' not in names)
check('the name is cleaned, no link, no handle', 'spam' not in names[0] and '@' not in names[0] and names[0].startswith('Bob'), names[0])
check('no Telegram id in presence rows', all('tg_id' not in p and not any(str(v) == str(B) for v in p.values()) for p in r['players']), json.dumps(r))
check('presence row fields', set(r['players'][0]) == {'name', 'house', 'lvl', 'x', 'y', 'zone', 'seat'} and r['players'][0]['x'] == 1800 and r['players'][0]['lvl'] == 5, json.dumps(r))
# another zone but within 1500 units: seen
anon('rpg_presence', token=tc, seat=0, x=1000, y=2400, zone='riverlands', lvl=9, house='martell', name='Cat')
r = anon('rpg_presence', token=ta, seat=0, x=1000, y=1000, zone='north', lvl=12, house='stark', name='Ann')
names = [p['name'].split(' ')[0] for p in r['players']]
check('another zone within 1500 units is seen, nearest first', names == ['Bob', 'Cat'], json.dumps(names))
# another zone beyond 1500 units: not seen
anon('rpg_presence', token=tc, seat=0, x=1000, y=2600, zone='riverlands', lvl=9, house='martell', name='Cat')
r = anon('rpg_presence', token=ta, seat=0, x=1000, y=1000, zone='north', lvl=12, house='stark', name='Ann')
check('another zone beyond 1500 units is not seen', [p['name'].split(' ')[0] for p in r['players']] == ['Bob'], json.dumps(r))
# stale: older than 90 seconds
q("update rpg_presence set at = now() - interval '100 seconds' where tg_id = %s", B)
r = anon('rpg_presence', token=ta, seat=0, x=1000, y=1000, zone='north', lvl=12, house='stark', name='Ann')
check('a presence older than 90 seconds is gone', r['players'] == [], json.dumps(r))
check('presence upsert: one row per seat', q1('select count(*) from rpg_presence where tg_id = %s', A) == 1)
check('my stored presence is what I sent', q('select x, y, zone, lvl, house, name from rpg_presence where tg_id = %s', A) == [(1000, 1000, 'north', 12, 'stark', 'Ann')])

# --- chat
q('delete from rpg_chat where zone in (%s, %s)', 'north', 'south')
r = anon('rpg_chat_send', token=ta, seat=0, zone='north', body='hello  www.spam.example.com @handle fuck all')
check('chat send ok', r.get('ok') is True and isinstance(r.get('id'), int), json.dumps(r))
id1 = r['id']
body = q1('select body from rpg_chat where id = %s', id1)
check('body cleaned: no link, no handle, no listed word, spaces collapsed', 'spam' not in body and '@handle' not in body and 'fuck' not in body and '  ' not in body and body.startswith('hello'), body)
check('the author name comes from my presence', q('select name, house from rpg_chat where id = %s', id1) == [('Ann', 'stark')])
check('a second message within 2 seconds: too fast', 'too fast' in (refused('rpg_chat_send', token=ta, seat=0, zone='north', body='again') or ''))
q("update rpg_chat set at = at - interval '3 seconds' where tg_id = %s", A)
r = anon('rpg_chat_send', token=ta, seat=0, zone='north', body='a' * 300)
check('after 2 seconds it goes; 160 characters at most', r.get('ok') is True and len(q1('select body from rpg_chat where id = %s', r['id'])) == 160)
id2 = r['id']
check('empty message refused', 'empty' in (refused('rpg_chat_send', token=tb, seat=0, zone='north', body='   \n ') or ''))
check('no zone refused', 'no zone' in (refused('rpg_chat_send', token=tb, seat=0, zone='', body='hi') or ''))
q('delete from rpg_presence where tg_id = %s', B)   # no presence, no save: the account's name and house
r = anon('rpg_chat_send', token=tb, seat=0, zone='north', body='hi from Bob')
id3 = r['id']
check('the name of an author without presence falls back to the account', q('select name, house from rpg_chat where id = %s', id3) == [('Bob', 'lannister')], str(q('select name, house from rpg_chat where id = %s', id3)))
anon('rpg_chat_send', token=tc, seat=0, zone='south', body='far away')
L = anon('rpg_chat_list', token=tb, seat=0, zone='north')
check('list: the zone\'s messages oldest first, mine flags', [m['id'] for m in L['msgs']] == [id1, id2, id3] and [m['mine'] for m in L['msgs']] == [False, False, True], json.dumps(L)[:300])
check('list fields, no ids', all(set(m) == {'id', 'name', 'house', 'body', 'at', 'mine'} for m in L['msgs']) and 'tg_id' not in json.dumps(L), json.dumps(L)[:300])
L = anon('rpg_chat_list', token=ta, seat=0, zone='north', since=id1)
check('since: only newer messages, mine true for my own', [m['id'] for m in L['msgs']] == [id2, id3] and L['msgs'][0]['mine'] is True and L['msgs'][1]['mine'] is False, json.dumps(L)[:300])
check('another zone sees its own messages only', [m['body'] for m in anon('rpg_chat_list', token=ta, seat=0, zone='south')['msgs']] == ['far away'])
check('an empty zone lists nothing', anon('rpg_chat_list', token=ta, seat=0, zone='nowhere')['msgs'] == [])
q('insert into chat_blocks (tg_id, blocked) values (%s, %s)', B, A)
L = anon('rpg_chat_list', token=tb, seat=0, zone='north')
check('blocked authors are left out of my list', [m['id'] for m in L['msgs']] == [id3], json.dumps(L)[:300])
q('delete from chat_blocks where tg_id = %s', B)
check('the block was only mine', [m['id'] for m in anon('rpg_chat_list', token=tc, seat=0, zone='north')['msgs']] == [id1, id2, id3])
check('chat list with a bad session refused', 'bad session' in (refused('rpg_chat_list', token=str(uuid.uuid4()), seat=0, zone='north') or ''))
# at most 40
for i in range(45):
    q("insert into rpg_chat (tg_id, seat, zone, name, house, body, at) values (%s, 0, 'north', 'Cat', 'martell', %s, now() - interval '1 minute')", C, f'm{i}')
L = anon('rpg_chat_list', token=ta, seat=0, zone='north')
check('the last 40 only', len(L['msgs']) == 40 and L['msgs'][-1]['body'] == 'm44' and L['msgs'][0]['body'] == 'm5', len(L['msgs']))

# --- boards: the v2 save — the current hero in p, the account in acc (house, best, hall = the fallen heroes, world.bosses)
sA2 = {'v': 2, 'p': {'name': 'Ann40', 'house': 'stark', 'lvl': 13}, 'acc': {'house': 'stark', 'best': {'lvl': 25, 'kills': 420},
       'hall': [{'name': 'Ann I', 'lvl': 25}, {'name': 'Ann II', 'lvl': 9}], 'world': {'bosses': {'b_riv': 1, 'b_vale': 1, 'b_north': 1}}, 'champs': {'jon': 5}}}
sB = {'v': 2, 'p': {'name': 'Bob40 t.me/x', 'lvl': 20}, 'acc': {'house': 'lannister', 'best': {'lvl': 20, 'kills': 50}, 'hall': [], 'world': {'bosses': {'b_riv': 1}}}}
sC = {'v': 2, 'p': {'name': 'Cat40', 'lvl': 7}, 'acc': {'house': 'martell', 'best': {'lvl': 31, 'kills': 900}, 'hall': [{}, {}, {}, {}, {}],
      'world': {'bosses': {'b_riv': 2, 'b_vale': 1, 'b_north': 1, 'b_wall': 1, 'b_beyond': 1}}}}
sD = {'v': 2, 'acc': {'house': 'greyjoy', 'best': {'lvl': 8, 'kills': 10}, 'hall': [{'name': 'Dag'}]}}   # between heroes: no p, no world
for tok, s in ((ta, sA2), (tb, sB), (tc, sC), (td, sD)): anon('rpg_save', token=tok, seat=0, state=json.dumps(s))
mine = ('Ann40', 'Bob40', 'Cat40')
def board(kind, tok=ta):
    r = anon('rpg_board', token=tok, kind=kind)
    rows = [x for x in r['rows'] if x['name'].split(' ')[0] in mine]
    return r, rows, [x['name'].split(' ')[0] for x in rows], [x['v'] for x in rows]
r, rows, names, vals = board('lvl')
check('board lvl: the current hero\'s level', names == ['Bob40', 'Ann40', 'Cat40'] and vals == [20, 13, 7], json.dumps(rows))
check('board row fields, mine on my row, no ids', all(set(x) == {'name', 'house', 'lvl', 'v', 'mine'} for x in rows) and [x['mine'] for x in rows] == [False, True, False] and 'tg_id' not in json.dumps(r), json.dumps(rows))
check('board names are cleaned', rows[0]['name'] == 'Bob40 •••', rows[0]['name'])
check('the house comes from the account', [x['house'] for x in rows] == ['lannister', 'stark', 'martell'], json.dumps(rows))
r, rows, names, vals = board('best', tb)
check('board best: acc.best.lvl, mine for the caller', names == ['Cat40', 'Ann40', 'Bob40'] and vals == [31, 25, 20] and [x['mine'] for x in rows] == [False, False, True], json.dumps(rows))
check('board best: lvl stays the current hero\'s', [x['lvl'] for x in rows] == [7, 13, 20], json.dumps(rows))
r, rows, names, vals = board('kills')
check('board kills: acc.best.kills', names == ['Cat40', 'Ann40', 'Bob40'] and vals == [900, 420, 50], json.dumps(rows))
r, rows, names, vals = board('bosses')
check('board bosses: the keys of acc.world.bosses', names == ['Cat40', 'Ann40', 'Bob40'] and vals == [5, 3, 1], json.dumps(rows))
r, rows, names, vals = board('fallen')
check('board fallen: the length of acc.hall', names == ['Cat40', 'Ann40', 'Bob40'] and vals == [5, 2, 0], json.dumps(rows))
dan = [x for x in r['rows'] if x['house'] == 'greyjoy' and x['name'] == '']
check('an account between heroes is on the board: no name, lvl 0, its fallen counted', len(dan) == 1 and dan[0]['lvl'] == 0 and dan[0]['v'] == 1, json.dumps(dan))
r = anon('rpg_board', token=td, kind='bosses')
dan = [x for x in r['rows'] if x['house'] == 'greyjoy' and x['mine']]
check('a missing key counts 0 (no acc.world)', len(dan) == 1 and dan[0]['v'] == 0, json.dumps(dan))
r = anon('rpg_board', token=td, kind='best')
dan = [x for x in r['rows'] if x['house'] == 'greyjoy' and x['mine']]
check('best without a living hero', len(dan) == 1 and dan[0]['v'] == 8 and dan[0]['lvl'] == 0, json.dumps(dan))
sB1 = {'v': 1, 'p': {'name': 'Bob40', 'house': 'tully', 'lvl': 4}}   # an old v1 save: no acc at all
anon('rpg_save', token=tb, seat=0, state=json.dumps(sB1))
r, rows, names, vals = board('kills')
check('a v1 save without acc: still listed, 0, the house from p', dict(zip(names, vals)).get('Bob40') == 0 and [x['house'] for x in rows if x['name'] == 'Bob40'] == ['tully'], json.dumps(rows))
anon('rpg_save', token=tb, seat=0, state=json.dumps(sB))
check('at most 50 rows', len(r['rows']) <= 50)
check('a bad board kind refused', 'bad board' in (refused('rpg_board', token=ta, kind='gold') or ''))
check('board with a bad session refused', 'bad session' in (refused('rpg_board', token=str(uuid.uuid4()), kind='lvl') or ''))

# --- a chat author with no presence but a save speaks under the save's name
q('delete from rpg_presence where tg_id = %s', C)
q("update rpg_chat set at = at - interval '3 seconds' where tg_id = %s", C)
r = anon('rpg_chat_send', token=tc, seat=0, zone='south', body='from the save')
check('the chat name falls back to the save before the account', q('select name, house from rpg_chat where id = %s', r['id']) == [('Cat40', 'martell')], str(q('select name, house from rpg_chat where id = %s', r['id'])))

# --- the tables themselves stay closed to the client roles: RLS on, no policies → anon sees no row (or is refused outright)
def anon_rows(sql):
    with db.cursor() as c:
        c.execute('set role anon')
        try: c.execute(sql); return c.fetchone()[0]
        except psycopg2.Error: return 'refused'
        finally: c.execute('reset role')
for t in ('rpg_saves', 'rpg_presence', 'rpg_chat'):
    check(f'{t}: RLS on, no policies, anon reads nothing',
          q1("select relrowsecurity from pg_class where relname = %s", t) is True and q1('select count(*) from pg_policies where tablename = %s', t) == 0
          and anon_rows(f'select count(*) from {t}') in (0, 'refused'), str(anon_rows(f'select count(*) from {t}')))

print('FAILS:', fails) if fails else print('all v40 checks OK')
raise SystemExit(1 if fails else 0)
