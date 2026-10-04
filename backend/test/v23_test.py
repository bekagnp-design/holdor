# v23 (the realm chat) checks against the local database, every app call as the anon role.
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
P = [997100001, 997100002, 997100003, 997100004, 997100005]
def wipe():
    for p in P:
        q('delete from chat_reports where author = %s or reporter = %s', p, p); q('delete from chat_blocks where tg_id = %s or blocked = %s', p, p)
        for t in ('chat_mutes', 'chat_msgs', 'scores', 'sessions', 'players'): q(f'delete from {t} where tg_id = %s', p)
wipe()
tok = {}
for i, p in enumerate(P):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, '{}', 1)", p, f'P{i}')
    # P0..P2 fight for realm 3 (P2 with a second seat in realm 5), P3 for realm 5, P4 has no scores row at all
    if i < 3: q("insert into scores (tg_id, seat, name, house, realm) values (%s, 0, %s, 'stark', 3)", p, f'Defender{i}')
    if i == 2 or i == 3: q("insert into scores (tg_id, seat, name, house, realm) values (%s, %s, %s, 'lannister', 5)", p, 1 if i == 2 else 0, f'Other{i}')
    tok[p] = q1('insert into sessions (tg_id) values (%s) returning token::text', p)
def say(p, text, seat=0): return anon('chat_send', token=tok[p], seat=seat, body=text)
def slow(): q("update chat_msgs set at = at - interval '5 seconds' where tg_id = any(%s)", (P,))
a = say(P[0], '  Hello   realm  '); slow()
check('a message is stored in my realm, spaces collapsed', q1("select body||'/'||realm from chat_msgs where id = %s", a['id']) == 'Hello realm/3' and a['realm'] == 3)
check('no seat on the server, no chat (the chat opens for defenders)', 'play a battle first' in (err('chat_send', token=tok[P[4]], seat=0, body='hi') or ''))
check('a bad token is refused', 'bad session' in (err('chat_send', token='00000000-0000-0000-0000-000000000000', seat=0, body='x') or ''))
cases = {'see https://evil.example/x now': 'see ••• now', 'join t.me/scam_group please': 'join ••• please', 'visit evil.com today': 'visit ••• today', 'ask @someone_here': 'ask •••', 'FUCK this': '*** this'}
got = {k: q1("select chat_clean(%s)", k) for k in cases}
check('links, @handles and listed words are hidden', all(got[k].strip() == v for k, v in cases.items()), got)
check('200 characters at most', len(q1("select chat_clean(%s)", 'x' * 500)) == 200)
check('an empty or all-space message is refused', 'empty message' in (err('chat_send', token=tok[P[0]], seat=0, body='   ') or ''))
say(P[0], 'one'); e = err('chat_send', token=tok[P[0]], seat=0, body='two')
check('a second message within 2 seconds is refused ("slow down")', e and 'slow down' in e, e); slow()
e = err('chat_send', token=tok[P[0]], seat=0, body='one')
check('the same text twice within 30 seconds is refused', e and 'just said' in e, e); slow()
q("delete from chat_msgs where tg_id = %s", P[0])
for i in range(15): q("insert into chat_msgs (realm, tg_id, seat, name, body, at) values (3, %s, 0, 'x', %s, now() - interval '10 seconds')", P[0], f'm{i}')
e = err('chat_send', token=tok[P[0]], seat=0, body='sixteenth')
check('15 messages a minute at most', e and 'too many' in e, e)
q("delete from chat_msgs where tg_id = %s", P[0])
say(P[0], 'from realm three'); say(P[3], 'from realm five'); slow()
l0 = anon('chat_list', token=tok[P[1]], seat=0); l3 = anon('chat_list', token=tok[P[3]], seat=0)
check('a realm sees only its own chat', [m['body'] for m in l0['msgs']] == ['from realm three'] and [m['body'] for m in l3['msgs']] == ['from realm five'] and l0['realm'] == 3 and l3['realm'] == 5, (l0, l3))
l2 = anon('chat_list', token=tok[P[2]], seat=1)
check('each seat chats in its own realm (P2: seat 0 → realm 3, seat 1 → realm 5)', l2['realm'] == 5 and anon('chat_list', token=tok[P[2]], seat=0)['realm'] == 3)
m = l0['msgs'][0]
check('a message shows name, house, time and "mine", and no Telegram id anywhere', set(m) == {'id', 'name', 'house', 'body', 'at', 'mine'} and m['mine'] is False and 'tg_id' not in json.dumps(l0) and anon('chat_list', token=tok[P[0]], seat=0)['msgs'][0]['mine'] is True)
say(P[1], 'second one'); slow()
check('since = the last id: only newer messages', [x['body'] for x in anon('chat_list', token=tok[P[0]], seat=0, since=m['id'])['msgs']] == ['second one'])
bid = anon('chat_list', token=tok[P[0]], seat=0)['msgs'][-1]['id']
anon('chat_block', token=tok[P[0]], msg=bid)
check('blocking an author hides his messages for me only', 'second one' not in [x['body'] for x in anon('chat_list', token=tok[P[0]], seat=0)['msgs']] and 'second one' in [x['body'] for x in anon('chat_list', token=tok[P[2]], seat=0)['msgs']])
check('I cannot block or report myself', 'that is you' in (err('chat_block', token=tok[P[0]], msg=m['id']) or '') and 'that is you' in (err('chat_report', token=tok[P[0]], msg=m['id']) or ''))
check('unblock all brings them back', anon('chat_unblock_all', token=tok[P[0]])['n'] == 1 and 'second one' in [x['body'] for x in anon('chat_list', token=tok[P[0]], seat=0)['msgs']])
anon('chat_report', token=tok[P[0]], msg=bid, reason='spam'); anon('chat_report', token=tok[P[0]], msg=bid, reason='again')
check('one reporter counts once', q1("select count(*) from chat_reports where author = %s", P[1]) == 1 and q1("select count(*) from chat_mutes where tg_id = %s", P[1]) == 0)
q("insert into chat_reports (msg_id, reporter, author, reason) values (%s, %s, %s, 'x')", bid, P[3], P[1])
anon('chat_report', token=tok[P[2]], msg=bid, reason='third')
check('three different reporters mute the author for an hour', q1("select until > now() + interval '55 minutes' from chat_mutes where tg_id = %s", P[1]) is True)
check('a muted author cannot speak and his messages are hidden', 'muted' in (err('chat_send', token=tok[P[1]], seat=0, body='hello?') or '') and 'second one' not in [x['body'] for x in anon('chat_list', token=tok[P[0]], seat=0)['msgs']])
check('the owner\'s view lists the reports with the text', q1("select count(*) from v_chat_reports where author = %s and body = 'second one'", P[1]) >= 2)
check('the word list is the owner\'s: a new word is hidden at once', (q("insert into chat_words values ('qqqword') on conflict do nothing") or True) and q1("select chat_clean('say qqqword now')") == 'say *** now')
q("delete from chat_words where w = 'qqqword'")
check('the tables and the helpers are closed to the app', all(err(f, **kw) is not None for f, kw in (('chat_clean', {'t': 'x'}),)) and q1("select has_table_privilege('anon', 'chat_msgs', 'select')") is False)
wipe()
print('FAILED:' if fails else 'all v23 checks OK', fails or ''); raise SystemExit(1 if fails else 0)
