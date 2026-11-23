# g2 (Heavy Gold, wave 5): chat (send / list / block / report, cleaning with the joiners kept, limits, the rate rules serialised,
# hiding at 3 reports), the share card (hg_card_put: base64, size, the PNG frame, 6 an hour serialised, the storage caps: a day,
# 3 images per player, 50 MB in all; hg_card_get for the service role only) and the hg-card Edge Function (index.ts imported
# under Node against a fake REST server on this database), the country ladder (lazy weekly close under a lock, pairs alternating
# weekly over 3 fixed weeks + the rollover and across 2026's week 53, score = gold / max(5, real members) (the bots are members
# without gold), the winner on exact values with the scores stored rounded, a round counting for the country g1 stored on it,
# ties, countries joining), crowns (boards, profile, chat, ladder), g1 compatibility (the fixed g1 is loaded first; g2's hg_board
# and hg_profile_get answer as g1's plus crown, the countries by the round's country, the same weeks under any session TimeZone),
# no Telegram id in any answer, rights (search_path with pg_temp), and re-running g1 + g2. Local database only (HG_DB picks
# another local database).
import os, re, json, uuid, zlib, base64, struct, hashlib, threading, datetime, subprocess, tempfile, http.server
import psycopg2
DSN = dict(host='127.0.0.1', dbname=os.environ.get('HG_DB', 'postgres'), user='postgres', password='pg')
db = psycopg2.connect(**DSN); db.autocommit = True
def q(sql, *a):   # bytea comes back as bytes (psycopg2's memoryview does not compare equal to bytes)
    with db.cursor() as c:
        c.execute(sql, a)
        return [tuple(bytes(v) if isinstance(v, memoryview) else v for v in r) for r in c.fetchall()] if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return r[0][0] if r else None
def call(role, fn, **kw):
    with db.cursor() as c:
        c.execute(f'set role {role}')
        try:
            args = ', '.join(f'{k} := %({k})s' for k in kw)
            c.execute(f'select {fn}({args})', kw); return c.fetchone()[0]
        finally: c.execute('reset role')
def anon(fn, **kw): return call('anon', fn, **kw)
def refused(fn, role='anon', **kw):
    """the error message when the role's call is refused, else None"""
    try: call(role, fn, **kw); return None
    except psycopg2.Error as e: return (e.diag.message_primary or str(e)).strip()
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
here = os.path.dirname(os.path.abspath(__file__))
SQL1 = open(os.path.join(here, '..', 'holdor_g1.sql'), encoding='utf-8').read()
SQL2 = open(os.path.join(here, '..', 'holdor_g2.sql'), encoding='utf-8').read()
TS = os.path.abspath(os.path.join(here, '..', 'edge', 'hg-card', 'index.ts'))
def load(*sqls):
    for s in sqls:
        with db.cursor() as c: c.execute(s)
load(SQL1, SQL2)
dd = datetime.timedelta
UTC = datetime.timezone.utc

# --- players: the hg_ tables belong to the g1 / g2 tests alone (local database)
BASE = 995400000
NAMES = dict(A=('Ann', 'GE'), B=('Bek', 'GE'), C=('Cat', 'US'), E=('Eve', 'FR'), F=('Fox', 'FR'), G=('Gus', 'DE'), H=('Hana', 'JP'),
             I=('Ivo', 'IT'), J=('Jon', 'ES'), K=('Kim', 'GE'), L=('Lea', 'US'), M=('Max', 'FR'), O=('Ola', 'FR'), P=('Pia', 'FR'),
             Q=('Quin', 'FR'), N=(None, None))
PID = {k: BASE + i + 1 for i, k in enumerate(NAMES)}
ALL = list(PID.values())
for t in ('hg_cards', 'hg_ladder_duels', 'hg_ladder_state', 'hg_ladder', 'hg_chat_reports', 'hg_chat_blocks', 'hg_chat', 'hg_rounds', 'hg_profiles'):
    q(f'delete from {t}')
q('delete from sessions where tg_id in %s', tuple(ALL)); q('delete from players where tg_id in %s', tuple(ALL))
for pid in ALL: q('insert into players (tg_id, name) values (%s, %s)', pid, f'tg{pid}')
TOK = {k: q1('insert into sessions (tg_id) values (%s) returning token::text', PID[k]) for k in NAMES}
ta, tb, tc, te, tf, tg, th, ti, tj, tk, tl, tm, tn = (TOK[k] for k in 'ABCEFGHIJKLMN')
BAD = str(uuid.uuid4())
seen = []   # every JSON the functions returned: no Telegram id may be in any of them
def P(fn, **kw):
    r = anon(fn, **kw); seen.append(r); return r
for k, (nm, cc) in NAMES.items():
    if nm: assert P('hg_profile_set', token=TOK[k], name=nm, country=cc).get('ok'), k
def pget(t): return P('hg_profile_get', token=t)
def board(t, scope): return P('hg_board', token=t, scope=scope)
ISO = re.compile(r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$')

# ================================================================ chat
def send(t, ch, body): return P('hg_chat_send', token=t, channel=ch, body=body)
def lst(t, ch, since=None, use_default=False):
    return P('hg_chat_list', token=t, channel=ch) if use_default else P('hg_chat_list', token=t, channel=ch, since=since)
def cback(k, s): q("update hg_chat set at = at - %s * interval '1 second' where tg_id = %s", s, PID[k])
def nmsg(): return q1('select count(*) from hg_chat')
check('send with an unknown token: auth', send(BAD, 'world', 'hi') == {'error': 'auth'})
check('send without a profile: no_profile', send(tn, 'world', 'hi') == {'error': 'no_profile'})
wrong = [c for c in ('', None, 'World', 'WORLD', ' world', 'c:US', 'c:ge', 'c:GEO', 'c:', 'c:GE ', 'GE', 'c:G1', 'country')
         if send(ta, c, 'hi') != {'error': 'bad_channel'}]
check('bad channels refused (empty, null, case, spaces, another country, lowercase, three letters, no code)', not wrong, wrong)
EMPTY = ['', '   ', None, '\n\t\r ', '\x01\x02\x7f', '\u200b\u202e\u2066', '\u00a0 \u3000', '\ufeff\u00ad', '\u200d', '\u200c\u200d \u200d', '\u200d\u00a0\u200c',
         '\u2028\u2029\u0085', '\u061c\u200e\u200f\u206f']
wrong = [b for b in EMPTY if send(ta, 'world', b) != {'error': 'empty'}]
check('empty bodies refused (blank, null, whitespace, control and format characters only, joiners only)', not wrong, wrong)
wrong = [len(b) for b in ('x' * 201, 'é' * 201, 'x' * 2001, '\x01' * 2001 + 'hi') if send(ta, 'world', b) != {'error': 'too_long'}]
check('too long: 201 characters (any script), a raw body over 2000 characters', not wrong, wrong)
check('refused messages store nothing', nmsg() == 0)
r = send(ta, 'world', '  Hello\nworld\t!  ')
m1 = r.get('msg') or {}
check('send ok: trimmed, newline and tab become a space', r.get('ok') is True and m1.get('body') == 'Hello world !', r)
check('the message: id, name, country, body, at, mine, crown', set(m1) == {'id', 'name', 'country', 'body', 'at', 'mine', 'crown'}
      and m1['name'] == 'Ann' and m1['country'] == 'GE' and m1['mine'] is True and m1['crown'] is False and ISO.match(m1['at'] or ''), m1)
check('the stored row', q('select tg_id, channel, body, hidden from hg_chat where id = %s', m1.get('id')) == [(PID['A'], 'world', 'Hello world !', False)])
check('a second message at once: rate', send(ta, 'world', 'again') == {'error': 'rate'} and nmsg() == 1)
cback('A', 1.5)
check('1.5 s later: still rate', send(ta, 'world', 'again') == {'error': 'rate'})
cback('A', 0.6)
r = send(ta, 'world', 'a\u202eb\x07c\u200bd')
check('2.1 s later: ok; control and bidi / zero-width characters removed', r.get('ok') is True and r['msg']['body'] == 'abcd', r)
for body, want in (('<b>hi</b> & <script>x</script>', '<b>hi</b> & <script>x</script>'), ('x' * 200, 'x' * 200), ('გამარჯობა 🙂', 'გამარჯობა 🙂'),
                   ('a  \n\n  b', 'a     b')):   # inner spaces are kept: a line break becomes one space
    cback('A', 2.1); r = send(ta, 'world', body)
    check(f'stored as text, unchanged: {body[:24]!r}', r.get('ok') is True and r['msg']['body'] == want, r)
cback('A', 61)   # a new minute: the 10-a-minute rule is checked further down
# the joiners U+200C / U+200D stay (emoji sequences, Persian / Indic text); the other format characters go; U+2028 / U+2029 / NEL
# are line breaks (a space)
for body, want in (('\U0001F468‍\U0001F469‍\U0001F467 \U0001F926‍♂️', '\U0001F468‍\U0001F469‍\U0001F467 \U0001F926‍♂️'),
                   ('می‌خواهم', 'می‌خواهم'),
                   ('क्‍ष', 'क्‍ष'),
                   ('a​b‮c؜d⁦e⁯f‎g', 'abcdefg'), ('x y z\u0085w', 'x y z w')):
    cback('A', 2.1); r = send(ta, 'world', body)
    check(f'joiners kept, other format characters removed: {body[:12]!r}', r.get('ok') is True and r['msg']['body'] == want, r)
cback('A', 2.1)
check('a refused message does not count for the rate (empty, then ok)', send(ta, 'world', ' ') == {'error': 'empty'} and send(ta, 'world', 'ok').get('ok') is True)
# 10 a minute, every channel together: clear Ann's messages, send 10 (world and country in turn) 2.5 s apart (25 s in all);
# the 11th is refused until the oldest is a minute old
q('delete from hg_chat where tg_id = %s', PID['A'])
oks = []
for i in range(10):
    oks.append(send(ta, 'world' if i % 2 == 0 else 'c:GE', f'm{i}').get('ok')); cback('A', 2.5)
check('ten messages in 25 s are fine (world and country in turn)', oks == [True] * 10)
check('the 11th within the minute: rate (the limit counts every channel), nothing stored', send(ta, 'world', 'm10') == {'error': 'rate'}
      and send(ta, 'c:GE', 'm10') == {'error': 'rate'} and q1('select count(*) from hg_chat where tg_id = %s', PID['A']) == 10)
cback('A', 34)   # the oldest is now 59 s old
check('59 s after the first: still rate', send(ta, 'world', 'm10') == {'error': 'rate'})
cback('A', 2)    # 61 s: one leaves the minute
check('61 s after the first: ok (9 in the last minute)', send(ta, 'world', 'm10').get('ok') is True)
check('the 2 s rule counts every channel too', send(ta, 'c:GE', 'x') == {'error': 'rate'})
# two sends at the same time: the second waits for the first (advisory lock 7102) and is then rate
c1 = psycopg2.connect(**DSN)
k1 = c1.cursor(); k1.execute('set role anon'); k1.execute('select hg_chat_send(%s, %s, %s)', (tb, 'world', 'one')); first = k1.fetchone()[0]
out = {}
def second():
    c2 = psycopg2.connect(**DSN); c2.autocommit = True
    with c2.cursor() as k:
        k.execute('set role anon'); k.execute('select hg_chat_send(%s, %s, %s)', (tb, 'world', 'two')); out['r'] = k.fetchone()[0]
    c2.close()
th_ = threading.Thread(target=second); th_.start(); th_.join(1.5); waited = th_.is_alive()
c1.commit(); c1.close(); th_.join(15)
check('parallel sends: the first passes, the second waits, then rate; one row', first.get('ok') is True and waited and out.get('r') == {'error': 'rate'}
      and q1('select count(*) from hg_chat where tg_id = %s', PID['B']) == 1, (first, waited, out))

# country channels
q('delete from hg_chat')
r = send(tk, 'c:GE', 'Gamarjoba')
check('a country message from a member', r.get('ok') is True and r['msg']['country'] == 'GE')
check('another country\'s channel: bad_channel for sending', send(tc, 'c:GE', 'hi') == {'error': 'bad_channel'})
check('list with an unknown token: auth', lst(BAD, 'world') == {'error': 'auth'})
wrong = [(t, c) for t, c in ((tc, 'c:GE'), (tn, 'c:GE'), (ta, 'c:US'), (ta, 'x'), (ta, ''), (ta, None), (ta, 'c:ge'))
         if lst(t, c) != {'error': 'bad_channel'}]
check('a country channel is read by its members only (another country, no profile, unknown, lowercase)', not wrong, wrong)
g = lst(ta, 'c:GE')
check('a member reads it; mine is the author\'s only', [(x['body'], x['mine']) for x in g['msgs']] == [('Gamarjoba', False)]
      and [x['mine'] for x in lst(tk, 'c:GE')['msgs']] == [True], g)
check('a logged-in player without a profile may read the world', lst(tn, 'world') == {'msgs': []})
check('a country message is not in the world channel', lst(ta, 'world') == {'msgs': []})
# order, the newest 50, since: 60 messages placed directly (no rate limit for the database owner)
for i in range(60): q("insert into hg_chat (tg_id, channel, body) values (%s, 'world', %s)", PID['C' if i % 2 else 'E'], f'n{i}')
ids = [r[0] for r in q("select id from hg_chat where channel = 'world' order by id")]
w = lst(tb, 'world')
check('list: the newest 50, oldest first', [x['id'] for x in w['msgs']] == ids[-50:] and [x['body'] for x in w['msgs']][:2] == ['n10', 'n11'], [x['id'] for x in w['msgs']][:3])
check('list rows: id, name, country, body, at, mine, crown', all(set(x) == {'id', 'name', 'country', 'body', 'at', 'mine', 'crown'} and ISO.match(x['at'])
      and x['mine'] is False and x['crown'] is False for x in w['msgs']) and {(x['name'], x['country']) for x in w['msgs']} == {('Cat', 'US'), ('Eve', 'FR')})
check('since: only newer ids', [x['id'] for x in lst(tb, 'world', ids[-10])['msgs']] == ids[-9:] and lst(tb, 'world', ids[-1]) == {'msgs': []})
check('since omitted, null, 0 or negative: from the start', lst(tb, 'world', use_default=True) == w and lst(tb, 'world', None) == w
      and lst(tb, 'world', 0) == w and lst(tb, 'world', -5) == w)
r = send(tb, 'world', 'mine now')
check('the sent message equals its row in the list (mine for the author)', r.get('ok') and lst(tb, 'world', ids[-1])['msgs'] == [r['msg']], r)
check('… and mine is false for others', [x['mine'] for x in lst(tc, 'world', ids[-1])['msgs']] == [False])
P('hg_profile_set', token=te, name='Evelyn', country='FR')
check('a rename shows on the old messages (the name is the profile\'s)', {x['name'] for x in lst(tb, 'world', ids[-6])['msgs'] if x['country'] == 'FR'} == {'Evelyn'})
P('hg_profile_set', token=te, name='Eve', country='FR')
# a channel keeps its newest 500
for i in range(520): q("insert into hg_chat (tg_id, channel, body) values (%s, 'c:FR', %s)", PID['M'], f'fr{i}')
cback('E', 61)   # Eve's directly placed world messages are not a minute old yet
nworld = q1("select count(*) from hg_chat where channel = 'world'")
r = send(te, 'c:FR', 'the newest')
check('a channel keeps its newest 500 messages, the other channels untouched',
      r.get('ok') and q1("select count(*) from hg_chat where channel = 'c:FR'") == 500 and q1("select max(id) from hg_chat where channel = 'c:FR'") == r['msg']['id']
      and q1("select count(*) from hg_chat where channel = 'c:FR' and body in ('fr0', 'fr20')") == 0 and q1("select count(*) from hg_chat where body = 'fr21'") == 1 and q1("select count(*) from hg_chat where channel = 'world'") == nworld)

# blocks
q("delete from hg_chat where channel = 'world'")
for k in 'AC':
    cback(k, 3); assert send(TOK[k], 'world', f'from {k}').get('ok')
def wnames(t): return [x['name'] for x in lst(t, 'world')['msgs']]
check('block with an unknown token: auth', P('hg_chat_block', token=BAD, name='Ann') == {'error': 'auth'})
check('block an unknown name: not_found', P('hg_chat_block', token=tk, name='Nobody') == {'error': 'not_found'}
      and P('hg_chat_block', token=tk, name=None) == {'error': 'not_found'})
check('block myself: self', P('hg_chat_block', token=tk, name='kim') == {'error': 'self'})
check('block by the name, ignoring case and outer spaces: ok, twice', P('hg_chat_block', token=tk, name='  aNN ') == {'ok': True}
      and P('hg_chat_block', token=tk, name='Ann') == {'ok': True} and q1('select count(*) from hg_chat_blocks where tg_id = %s', PID['K']) == 1)
check('the blocked player\'s messages are gone for the blocker only', wnames(tk) == ['Cat'] and wnames(tb) == ['Ann', 'Cat'])
P('hg_profile_set', token=ta, name='Anna', country='GE')
check('a rename does not escape a block', wnames(tk) == ['Cat'] and wnames(tb) == ['Anna', 'Cat'])
P('hg_profile_set', token=ta, name='Ann', country='GE')
check('a player without a profile may block (and read the world without the blocked)', P('hg_chat_block', token=tn, name='Cat') == {'ok': True} and wnames(tn) == ['Ann'])
cback('A', 3); r = send(ta, 'c:GE', 'country hello')
check('a block hides the country channel too', r.get('ok') and 'country hello' not in [x['body'] for x in lst(tk, 'c:GE')['msgs']]
      and 'country hello' in [x['body'] for x in lst(tb, 'c:GE')['msgs']])

# reports
cback('A', 3); x_id = send(ta, 'world', 'report me')['msg']['id']
ge_id = q1("select id from hg_chat where channel = 'c:GE' and tg_id = %s order by id desc limit 1", PID['A'])
def rep(t, i): return P('hg_chat_report', token=t, id=i)
def visible(t, i, ch='world'): return i in [x['id'] for x in lst(t, ch)['msgs']]
check('report with an unknown token: auth', rep(BAD, x_id) == {'error': 'auth'})
check('report an unknown message: not_found', rep(tb, 10 ** 15) == {'error': 'not_found'} and rep(tb, None) == {'error': 'not_found'})
check('report my own message: self', rep(ta, x_id) == {'error': 'self'})
check('report a country message I cannot read: not_found (another country, no profile)', rep(tc, ge_id) == {'error': 'not_found'} and rep(tn, ge_id) == {'error': 'not_found'})
check('two reports, one of them twice: still visible to everyone', rep(tb, x_id) == {'ok': True} and rep(tb, x_id) == {'ok': True} and rep(tc, x_id) == {'ok': True}
      and q1('select count(*) from hg_chat_reports where msg_id = %s', x_id) == 2 and all(visible(t, x_id) for t in (ta, tb, tc, tl)))
check('the third player reports: hidden for everyone, the author too', rep(tl, x_id) == {'ok': True} and not any(visible(t, x_id) for t in (ta, tb, tc, tl, tn))
      and q1('select hidden from hg_chat where id = %s', x_id) is True)
check('a report on a hidden message is fine and changes nothing', rep(tm, x_id) == {'ok': True} and not visible(tb, x_id))
check('a country message can be reported by its members', rep(tb, ge_id) == {'ok': True})
check('hidden messages do not count as visible ones (the other messages stay)', 'from C' in [x['body'] for x in lst(tb, 'world')['msgs']])
# a third report racing a second: the reports of one message are serialised, so the message is hidden either way
cback('A', 3); y_id = send(ta, 'world', 'race me')['msg']['id']
rep(tb, y_id)
c1 = psycopg2.connect(**DSN)
k1 = c1.cursor(); k1.execute('set role anon'); k1.execute('select hg_chat_report(%s, %s)', (tc, y_id)); first = k1.fetchone()[0]
out = {}
def third():
    c2 = psycopg2.connect(**DSN); c2.autocommit = True
    with c2.cursor() as k:
        k.execute('set role anon'); k.execute('select hg_chat_report(%s, %s)', (tl, y_id)); out['r'] = k.fetchone()[0]
    c2.close()
th_ = threading.Thread(target=third); th_.start(); th_.join(1.5); waited = th_.is_alive()
c1.commit(); c1.close(); th_.join(15)
check('parallel reports: the third waits for the second, then hides the message', first == {'ok': True} and waited and out.get('r') == {'ok': True}
      and q1('select hidden from hg_chat where id = %s', y_id) is True, (first, waited, out))
check('no champion yet: every crown false, no crown in the profile', not any(x['crown'] for x in lst(tb, 'world')['msgs']) and pget(tc) == {'name': 'Cat', 'country': 'US'})

# ================================================================ the share card
SIGB = b'\x89PNG\r\n\x1a\n'
def chunk(kind, data): return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
IHDR = chunk(b'IHDR', struct.pack('>IIBBBBB', 1080, 1920, 8, 6, 0, 0, 0))   # 25 bytes
IEND = chunk(b'IEND', b'')                                                   # 12 bytes: 0000000049454e44ae426082
def mk(n, seed=1):   # n bytes framed as a PNG: the signature, IHDR first, filler where the image data would be, IEND last
    return SIGB + IHDR + bytes(((i * 7 + seed) % 256) for i in range(n - 45)) + IEND
def b64(b): return base64.b64encode(b).decode()
def card(t, png): return P('hg_card_put', token=t, png=png)
def ncards(k): return q1('select count(*) from hg_cards where tg_id = %s', PID[k])
def nheld(k): return q1('select count(*) from hg_cards where tg_id = %s and octet_length(png) > 0', PID[k])   # rows that still hold an image
def kback(k, s): q("update hg_cards set at = at - %s * interval '1 second' where tg_id = %s", s, PID[k])
small = mk(1000)
check('card with an unknown token: auth', card(BAD, b64(small)) == {'error': 'auth'})
BADP = [None, '', '   ', '!!!!', 'abc', 'AA==AA==', 'data:image/png;base64,', b64(b'GIF89a' + bytes(100)), b64(b'\xff\xd8\xff\xe0' + bytes(100)), b64(SIGB[:7]),
        b64(b'\x89PNG\r\n\x1a\x00' + bytes(10)), 'data:image/jpeg;base64,' + b64(small),
        b64(SIGB + bytes(1000)), b64(SIGB + bytes(992) + IEND), b64(small[:-12]), b64(small + b'PK\x05\x06' + bytes(18)), b64(SIGB + chunk(b'tEXt', b'x' * 13) + bytes(100) + IEND),
        b64(small[:-1] + b'\x00'), b64(mk(56))]
wrong = [i for i, p in enumerate(BADP) if card(tc, p) != {'error': 'bad_png'}]
check(f'bad PNGs refused ({len(BADP)}: null, empty, not base64, bad padding, GIF, JPEG, a short or wrong signature, another data URL, '
      'the signature + junk, no IHDR first, no IEND last, data after IEND, another chunk first, a bad IEND CRC, 56 bytes)', not wrong, wrong)
check('the smallest frame passes: 57 bytes (signature, IHDR, a 12-byte chunk, IEND)', card(tc, b64(mk(57))).get('ok') is True)
q('delete from hg_cards')
check('too big: 409 601 bytes decoded, or more than 600 000 characters', card(tc, b64(mk(409601))) == {'error': 'too_big'} and card(tc, 'A' * 600001) == {'error': 'too_big'})
check('refused cards store nothing', q1('select count(*) from hg_cards') == 0)
big = mk(409600, 3)
r = card(tc, b64(big))
check('exactly 400 KB is fine: {ok, id, url}', r.get('ok') is True and set(r) == {'ok', 'id', 'url'} and str(uuid.UUID(r['id'])) == r['id']
      and r['url'] == 'https://acimxvnupgpronpohheb.supabase.co/functions/v1/hg-card?id=' + r['id'], r)
card_big = r.get('id')
check('the stored card is the bytes sent, for its player', q('select tg_id, png from hg_cards where id = %s', card_big) == [(PID['C'], big)])
wrapped = 'data:image/png;base64,' + base64.encodebytes(small).decode()
r = card(tc, wrapped)
check('a data URL with line breaks is fine', r.get('ok') is True and q1('select png from hg_cards where id = %s', r['id']) == small, r)
card_small = r.get('id')
got = call('service_role', 'hg_card_get', id=card_small)
check('hg_card_get (service role): base64 without line breaks, the same bytes', isinstance(got, str) and '\n' not in got and base64.b64decode(got) == small)
check('hg_card_get of an unknown id: null', call('service_role', 'hg_card_get', id=str(uuid.uuid4())) is None)
check('anon and authenticated may not call hg_card_get', all('permission denied' in (refused('hg_card_get', role=ro, id=card_small) or '') for ro in ('anon', 'authenticated')))
c3 = card(tc, b64(mk(100))).get('id')
check('a third card: all three images kept', ncards('C') == 3 and nheld('C') == 3)
c4 = card(tc, b64(mk(101))).get('id')
check('a fourth card empties the oldest image (a player keeps his newest 3); the row stays for the hourly count, hg_card_get gives null',
      ncards('C') == 4 and nheld('C') == 3 and q1('select octet_length(png) from hg_cards where id = %s', card_big) == 0
      and call('service_role', 'hg_card_get', id=card_big) is None and base64.b64decode(call('service_role', 'hg_card_get', id=card_small)) == small)
for i in range(2): assert card(tc, b64(mk(102 + i))).get('ok')
check('six cards in an hour, the seventh: rate, nothing stored; the newest 3 hold their images',
      ncards('C') == 6 and card(tc, b64(small)) == {'error': 'rate'} and ncards('C') == 6 and nheld('C') == 3
      and [r[0] for r in q('select octet_length(png) > 0 from hg_cards where tg_id = %s order by at, id', PID['C'])] == [False] * 3 + [True] * 3)
check('a bad card is still bad_png while rate-limited (checked first)', card(tc, 'xx') == {'error': 'bad_png'})
kback('C', 3540)
check('59 minutes later: still rate', card(tc, b64(small)) == {'error': 'rate'})
kback('C', 61)
check('an hour later: ok again; the day\'s rows stay, 3 images', card(tc, b64(small)).get('ok') is True and ncards('C') == 7 and nheld('C') == 3)
check('the images kept per player are at most 3 (1.2 MB at 400 KB each)', q1('select max(n) from (select count(*) n from hg_cards where octet_length(png) > 0 group by tg_id) z') == 3)
# two puts at the same time: the second waits (advisory lock 7104), then counts the first
for i in range(5): assert card(te, b64(mk(200 + i))).get('ok')
c1 = psycopg2.connect(**DSN)
k1 = c1.cursor(); k1.execute('set role anon'); k1.execute('select hg_card_put(%s, %s)', (te, b64(small))); first = k1.fetchone()[0]
out = {}
def put2():
    c2 = psycopg2.connect(**DSN); c2.autocommit = True
    with c2.cursor() as k:
        k.execute('set role anon'); k.execute('select hg_card_put(%s, %s)', (te, b64(small))); out['r'] = k.fetchone()[0]
    c2.close()
th_ = threading.Thread(target=put2); th_.start(); th_.join(1.5); waited = th_.is_alive()
c1.commit(); c1.close(); th_.join(15)
check('parallel puts at the limit: the sixth passes, the seventh waits and is rate', first.get('ok') is True and waited and out.get('r') == {'error': 'rate'} and ncards('E') == 6, (first, waited, out))
q("update hg_cards set at = now() - interval '25 hours' where id = %s", card_big)
q("update hg_cards set at = now() - interval '23 hours' where id = %s", card_small)
q("update hg_cards set at = now() - interval '25 hours' where id = (select id from hg_cards where tg_id = %s order by at desc limit 1)", PID['E'])
check('the next put (of anyone) deletes the cards older than a day, image or not; a 23-hour card stays', card(tl, b64(small)).get('ok') is True
      and q1('select count(*) from hg_cards where id = %s', card_big) == 0 and q1('select count(*) from hg_cards where id = %s', card_small) == 1
      and ncards('E') == 5)
check('a card needs no profile (a logged-in player)', card(tn, b64(small)).get('ok') is True)
# all cards together stay under 50 MB: a put that would pass it is refused as rate (a big row placed directly by the owner)
LIM = 50 * 1024 * 1024
used = q1('select sum(octet_length(png)) from hg_cards')
q("insert into hg_cards (tg_id, png) values (%s, convert_to(repeat('x', %s), 'UTF8'))", PID['J'], LIM - used - len(small))
check('50 MB in all: a put that reaches the budget exactly passes', card(tk, b64(small)).get('ok') is True and q1('select sum(octet_length(png)) from hg_cards') == LIM)
check('… one that would pass it: rate, nothing stored', card(tm, b64(small)) == {'error': 'rate'} and ncards('M') == 0)
q('delete from hg_cards where tg_id = %s', PID['J'])
check('… and ok again once there is room', card(tm, b64(small)).get('ok') is True and ncards('M') == 1)

# ---------------------------------------------------------------- the Edge Function hg-card (index.ts under Node, a fake REST API here)
SKEY = 'TESTSERVICEKEY_1234567890abcdef'
rest_calls = []
class Rest(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _out(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(n); rest_calls.append(self.path)
        if self.headers.get('apikey') != SKEY or self.headers.get('Authorization') != 'Bearer ' + SKEY: return self._out(401, {'message': 'Invalid API key'})
        if self.path != '/rest/v1/rpc/hg_card_get': return self._out(404, {'message': 'no such function'})
        try:
            con = psycopg2.connect(**DSN); con.autocommit = True
            with con.cursor() as c: c.execute('set role service_role'); c.execute('select hg_card_get(id := %s)', (json.loads(body or b'{}').get('id'),)); v = c.fetchone()[0]
            con.close()
        except psycopg2.Error as e: return self._out(400, {'message': (e.diag.message_primary or '').strip()})
        self._out(200, v)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Rest)
threading.Thread(target=srv.serve_forever, daemon=True).start()
RURL = f'http://127.0.0.1:{srv.server_address[1]}'
ENV = {'url': RURL, 'key': SKEY}
FN = 'https://x.supabase.co/functions/v1/hg-card'
live = q1('select id::text from hg_cards where tg_id = %s order by at desc limit 1', PID['L'])
live_png = q1('select png from hg_cards where id = %s', live)
CASES = [('get', ENV, 'GET', f'{FN}?id={live}'), ('path', ENV, 'GET', f'{FN}/{live.upper()}.png'), ('head', ENV, 'HEAD', f'{FN}?id={live}'),
         ('missing', ENV, 'GET', f'{FN}?id={uuid.uuid4()}'), ('garbage', ENV, 'GET', f'{FN}?id=not-a-uuid'), ('noid', ENV, 'GET', FN),
         ('sqlish', ENV, 'GET', f"{FN}?id={live}'%20or%201=1"), ('options', ENV, 'OPTIONS', f'{FN}?id={live}'), ('post', ENV, 'POST', f'{FN}?id={live}'),
         ('wrongkey', {'url': RURL, 'key': 'wrong'}, 'GET', f'{FN}?id={live}'), ('down', {'url': 'http://127.0.0.1:9', 'key': SKEY}, 'GET', f'{FN}?id={live}'),
         ('gone', ENV, 'GET', f'{FN}?id={card_small}')]
NODE = r'''
import { createHash } from 'node:crypto';
const cfg = JSON.parse(process.argv[2]);
const { makeHandler } = await import(cfg.mod);
const out = {};
for (const [name, env, method, url] of cfg.cases) {
  const r = await makeHandler(env)(new Request(url, { method }));
  const buf = Buffer.from(await r.arrayBuffer());
  const h = k => r.headers.get(k);
  out[name] = { status: r.status, type: h('content-type'), cache: h('cache-control'), acao: h('access-control-allow-origin'), clen: h('content-length'), nosniff: h('x-content-type-options'),
                len: buf.length, sha: createHash('sha256').update(buf).digest('hex'), text: /^text\//.test(h('content-type') || '') ? buf.toString() : null };
}
console.log(JSON.stringify(out));
'''
with tempfile.TemporaryDirectory() as tmp:
    js = os.path.join(tmp, 'edge_run.mjs'); open(js, 'w').write(NODE)
    try:
        pr = subprocess.run(['node', '--experimental-strip-types', '--no-warnings', js, json.dumps({'mod': 'file://' + TS, 'cases': CASES})],
                            capture_output=True, text=True, timeout=90)
        E = json.loads(pr.stdout.strip().splitlines()[-1]) if pr.returncode == 0 and pr.stdout.strip() else {}
    except Exception as e: pr, E = None, {}
check('the Edge Function loads under Node without starting a server', bool(E), (pr.stderr[-800:] if pr else 'node missing'))
srv.shutdown()
if E:
    g_ = E['get']
    check('edge GET ?id=: 200 image/png, the stored bytes, cached a day, CORS open', g_['status'] == 200 and g_['type'] == 'image/png'
          and g_['sha'] == hashlib.sha256(live_png).hexdigest() and g_['len'] == len(live_png) and g_['clen'] == str(len(live_png))
          and g_['cache'] == 'public, max-age=86400, immutable' and g_['acao'] == '*' and g_['nosniff'] == 'nosniff', g_)
    check('edge GET /hg-card/<ID>.png (path form, upper case): the same card', E['path']['status'] == 200 and E['path']['sha'] == g_['sha'], E['path'])
    check('edge HEAD: 200, no body', E['head']['status'] == 200 and E['head']['len'] == 0 and E['head']['type'] == 'image/png', E['head'])
    check('edge: an unknown card, an emptied card, a bad id, no id, an injection attempt: 404, not cached',
          all(E[k]['status'] == 404 and E[k]['cache'] == 'no-store' and E[k]['acao'] == '*' for k in ('missing', 'gone', 'garbage', 'noid', 'sqlish')), {k: E[k]['status'] for k in ('missing', 'gone', 'garbage', 'noid', 'sqlish')})
    check('edge: every answer says nosniff', all(E[k]['nosniff'] == 'nosniff' for k in E), {k: E[k]['nosniff'] for k in E})
    check('edge OPTIONS: 204 with CORS; POST: 405', E['options']['status'] == 204 and E['options']['acao'] == '*' and E['post']['status'] == 405)
    check('edge: the REST API refuses the key → 502, the upstream is down → 503, the text says nothing more',
          E['wrongkey']['status'] == 502 and E['down']['status'] == 503 and E['wrongkey']['text'] == 'unavailable' and E['down']['text'] == 'unavailable', (E['wrongkey'], E['down']))
    check('edge: a bad id never reaches the REST API (6 lookups for the 6 well-formed ids that reach it)', len(rest_calls) == 6, rest_calls)
src = open(TS, encoding='utf-8').read()
check('index.ts holds no key (env only) and serves only under Deno', 'SUPABASE_SERVICE_ROLE_KEY' in src and not re.search(r'eyJ[A-Za-z0-9_-]{10,}|sb_secret_|sb_publishable_', src))

# ================================================================ the country ladder
def lad(t): return P('hg_ladder', token=t)
mon = q1("select (date_trunc('week', now() at time zone 'utc'))::date")
def iso(d): return datetime.datetime(d.year, d.month, d.day, tzinfo=UTC).strftime('%Y-%m-%dT%H:%M:%SZ')
def weven(monday): return ((monday - datetime.date(2026, 11, 23)).days // 7) % 2 == 0   # weeks from ISO 2026-W48 (even), alternating
def popp(pos, n, monday):   # the reference rule: even week (1-2) (3-4)…, odd (2-3) (4-5)… with #1 resting
    even = weven(monday)
    d = pos + 1 if (pos % 2 == 1) == even else pos - 1
    return d if 1 <= d <= n else None
def order(): return [r[0] for r in q('select country from hg_ladder order by pos')]
def duels(wk): return [(p, a, b, None if sa is None else round(float(sa), 2), None if sb is None else round(float(sb), 2), ra, rb, na, nb, w)
                       for p, a, b, sa, sb, ra, rb, na, nb, w in q('select pos, a, b, a_score, b_score, a_real, b_real, a_rounds, b_rounds, winner '
                                                                     'from hg_ladder_duels where week = %s order by pos', wk)]
LKEYS = {'week_start', 'week_end', 'iso_week', 'ladder', 'mine', 'last'}
RKEYS = {'pos', 'country', 'real', 'bots', 'score', 'rounds', 'opp', 'opp_score', 'side', 'crown'}
# the opponent rule itself, on fixed weeks: 2026's weeks keep their ISO parity (46 and 48 even, 47 and 49 odd, 52 even, 53 odd),
# and the weeks keep alternating across the new year (2027's week 1 is even here; by ISO parity it would repeat week 53's pairs)
OPP = {(datetime.date(2026, 11, 23), 5): [2, 1, 4, 3, None], (datetime.date(2026, 11, 30), 5): [None, 3, 2, 5, 4],
       (datetime.date(2026, 11, 30), 4): [None, 3, 2, None], (datetime.date(2026, 11, 23), 4): [2, 1, 4, 3],
       (datetime.date(2026, 11, 9), 3): [2, 1, None], (datetime.date(2026, 11, 16), 3): [None, 3, 2], (datetime.date(2026, 12, 21), 3): [2, 1, None],
       (datetime.date(2026, 12, 28), 3): [None, 3, 2], (datetime.date(2027, 1, 4), 3): [2, 1, None], (datetime.date(2027, 1, 11), 3): [None, 3, 2],
       (datetime.date(2026, 11, 23), 1): [None]}
wrong = [(wk, n) for (wk, n), want in OPP.items() if [q1('select hg_ladder_opp(%s, %s, %s)', p, n, wk) for p in range(1, n + 1)] != want
         or want != [popp(p, n, wk) for p in range(1, n + 1)]]
check('pairs alternate weekly: even (1-2) (3-4), odd (2-3) (4-5) with #1 resting, an unpaired last rests (weeks 46-49, 52, 53, 2027\'s 1 and 2)', not wrong, wrong)
check('2026\'s weeks keep their ISO parity (weeks 1-53), and the weeks alternate from 2021 to 2031',
      all(weven(d) == (d.isocalendar()[1] % 2 == 0) for d in (datetime.date(2025, 12, 29) + dd(days=7 * i) for i in range(53)))
      and all(q1('select hg_ladder_opp(1, 2, %s)', d) == (2 if weven(d) else None) and weven(d) != weven(d + dd(days=7))
              for d in (datetime.date(2021, 1, 4) + dd(days=7 * i) for i in range(0, 570, 7))))
# no round at all: the ladder starts this week, empty
L0 = lad(ta)
check('no round yet: an empty ladder starting this week', L0 == {'week_start': iso(mon), 'week_end': iso(mon + dd(days=7)), 'iso_week': mon.isocalendar()[1],
                                                                  'ladder': [], 'mine': None, 'last': []} and q1('select week from hg_ladder_state') == mon, L0)
# three fixed weeks: 2026-10-26 (ISO 44, even), 2026-11-02 (45, odd), 2026-11-09 (46, even). Rounds go through hg_round_submit,
# then their `at` is moved back into the week.
q('delete from hg_ladder_state')
R0 = {'god': 'thor', 'rank': 1, 'heroes': 8, 'robs': 0, 'lost': 0, 'minted': 812, 'day': None}   # g1's cap without Freya
def play(k, banked, at=None):   # a round through hg_round_submit; with `at`, moved back to that moment
    r = P('hg_round_submit', token=TOK[k], r=json.dumps(dict(R0, banked=banked)))
    assert r.get('ok'), (k, r)
    if at: q('update hg_rounds set at = %s where id = (select max(id) from hg_rounds where tg_id = %s)', at, PID[k])
W44, W45, W46 = datetime.date(2026, 10, 26), datetime.date(2026, 11, 2), datetime.date(2026, 11, 9)
def at(wk, day, hour): return datetime.datetime(wk.year, wk.month, wk.day, hour, tzinfo=UTC) + dd(days=day)
# score = gold / max(5, real members): a country under 5 players is filled with bots that count as members and bank nothing.
# W44: US, GE, FR join in the order of their first round. US 300 / 5 = 60 vs GE (100 + 200) / 5 = 60: a tie, US keeps #1
# (by the average per real player GE would have 150 against 300). FR rests (3 of 3), 500 / 5 = 100.
play('C', 300, at(W44, 1, 10)); play('A', 100, at(W44, 2, 10)); play('B', 200, at(W44, 2, 11)); play('E', 500, at(W44, 3, 10))
# W45 (odd): DE joins (#4). US rests (its 800 counts for nothing). GE (100 + 100) / 5 = 40 vs FR 300 / 5 = 60: FR wins; Fox played
# no round, so he is one of FR's 5 like a bot. DE rests (4 of 4).
play('G', 50, at(W45, 0, 8)); play('A', 100, at(W45, 1, 9)); play('B', 100, at(W45, 1, 10)); play('E', 300, at(W45, 2, 9)); play('C', 800, at(W45, 3, 9))
# W46 (even): JP joins (#5). US 200 / 5 = 40 vs FR (300 + 100 + 100) / 5 = 100: FR takes #1 by beating #1. GE (no round: 0) vs DE 10 / 5 = 2:
# DE up. JP rests.
play('C', 200, at(W46, 1, 9)); play('E', 300, at(W46, 1, 10)); play('F', 100, at(W46, 2, 9)); play('F', 100, at(W46, 3, 9)); play('G', 10, at(W46, 2, 10))
play('H', 800, at(W46, 4, 9))
L1 = lad(ta)
check('the first call closes every week since the oldest round (lazily, once)', q1('select week from hg_ladder_state') == mon
      and q1('select min(week) from hg_ladder_duels') == W44 and q1('select count(distinct week) from hg_ladder_duels') == (mon - W44).days // 7)
check('W44 (even): US-GE 60:60 (300 / 5, 300 / 5: the bots are members) a tie, the higher position stays; FR rests',
      duels(W44) == [(1, 'US', 'GE', 60, 60, 1, 2, 1, 2, 'US'), (3, 'FR', None, 100, None, 1, None, 1, None, None)], duels(W44))
check('W45 (odd): #1 US rests; GE-FR 40:60 (gold / 5), FR wins; DE (joined) rests',
      duels(W45) == [(1, 'US', None, 160, None, 1, None, 1, None, None), (2, 'GE', 'FR', 40, 60, 2, 1, 2, 1, 'FR'), (4, 'DE', None, 10, None, 1, None, 1, None, None)], duels(W45))
check('W46 (even): US-FR 40:100 FR takes #1; GE-DE 0:2 DE up; JP (joined) rests',
      duels(W46) == [(1, 'US', 'FR', 40, 100, 1, 2, 1, 3, 'FR'), (3, 'GE', 'DE', 0, 2, 0, 1, 0, 1, 'DE'), (5, 'JP', None, 160, None, 1, None, 1, None, None)], duels(W46))
check('the ladder after three weeks: FR, US, DE, GE, JP', order() == ['FR', 'US', 'DE', 'GE', 'JP'], order())
check('a country enters at the bottom in the week of its first round', q('select country, since from hg_ladder order by pos')
      == [('FR', W44), ('US', W44), ('DE', W45), ('GE', W44), ('JP', W46)])
quiet = [wk for wk in (W46 + dd(days=7 * i) for i in range(1, (mon - W46).days // 7))]
wrong = [wk for wk in quiet if any(d[3] != 0 or (d[4] not in (0, None)) or d[9] not in (d[1], None) for d in duels(wk))
         or [d[0] for d in duels(wk)] != [p for p in range(1, 6) if (popp(p, 5, wk) or 6) > p]]
check(f'the weeks without rounds since ({len(quiet)}): every pair 0:0, the higher stays, nothing moves', not wrong and quiet, wrong)
ex = [p for p in range(1, 6) if popp(p, 5, mon) is not None]
check('this week, nobody played yet: every country with 0, 5 bots, the pairs of this week\'s parity',
      set(L1) == LKEYS and [x['country'] for x in L1['ladder']] == ['FR', 'US', 'DE', 'GE', 'JP'] and all(set(x) == RKEYS for x in L1['ladder'])
      and all(x['real'] == 0 and x['bots'] == 5 and x['score'] == 0 and x['rounds'] == 0 for x in L1['ladder'])
      and [x['opp'] for x in L1['ladder']] == [None if popp(p, 5, mon) is None else ['FR', 'US', 'DE', 'GE', 'JP'][popp(p, 5, mon) - 1] for p in range(1, 6)], L1)
lw = mon - dd(days=7)
want_last = [{'week': lw.isoformat(), 'a': d[1], 'b': d[2], 'a_score': 0, 'b_score': 0, 'winner': d[1]} for d in duels(lw) if d[2]]
check('last: the previous week\'s duels (0:0 here), rests left out', L1['last'] == want_last and len(want_last) == 2, L1['last'])
# this week, live: IT joins (shown at the bottom, not stored before the week closes)
# FR has 6 real players this week (Eve, Fox, Max, Ola, Pia, Quin): 101 / 6 = 16.8333, shown 16.83; the others divide by 5
for k, b in (('E', 100), ('F', 0), ('M', 0), ('O', 1), ('P', 0), ('Q', 0), ('C', 400), ('L', 101), ('A', 30), ('H', 50), ('I', 70)): play(k, b)
L2 = lad(ta)
cs = ['FR', 'US', 'DE', 'GE', 'JP', 'IT']
SC = {'FR': (16.83, 6, 6), 'US': (100.2, 2, 2), 'DE': (0, 0, 0), 'GE': (6, 1, 1), 'JP': (10, 1, 1), 'IT': (14, 1, 1)}
want = []
for p, c in enumerate(cs, 1):
    o = popp(p, 6, mon)
    want.append({'pos': p, 'country': c, 'real': SC[c][1], 'bots': max(0, 5 - SC[c][1]), 'score': SC[c][0], 'rounds': SC[c][2],
                 'opp': cs[o - 1] if o else None, 'opp_score': SC[cs[o - 1]][0] if o else None, 'side': 'rest' if not o else ('up' if o < p else 'down'), 'crown': p == 1})
check('this week live: score = gold / max(5, real) (FR 101 / 6 = 16.83 with no bot, US 501 / 5 = 100.2 with 3 bots), real, bots = max(0, 5 - real), rounds',
      L2['ladder'] == want, json.dumps(L2['ladder']))
check('this week live: IT shown at the bottom, not stored yet', L2['ladder'][-1]['country'] == 'IT' and 'IT' not in order())
even = weven(mon)
check('this week\'s sides: ' + ('even, FR-US DE-GE JP-IT' if even else 'odd, FR rests, US-DE GE-JP, IT rests'),
      [(x['country'], x['opp'], x['side']) for x in L2['ladder']] == ([('FR', 'US', 'down'), ('US', 'FR', 'up'), ('DE', 'GE', 'down'), ('GE', 'DE', 'up'), ('JP', 'IT', 'down'), ('IT', 'JP', 'up')]
      if even else [('FR', None, 'rest'), ('US', 'DE', 'down'), ('DE', 'US', 'up'), ('GE', 'JP', 'down'), ('JP', 'GE', 'up'), ('IT', None, 'rest')]))
ge = next(x for x in want if x['country'] == 'GE')
check('mine: my country, position, opponent, scores, side, the end of the week',
      L2['mine'] == {'country': 'GE', 'pos': 4, 'opp': ge['opp'], 'score': 6, 'opp_score': ge['opp_score'], 'side': ge['side'], 'ends_at': iso(mon + dd(days=7))}, L2['mine'])
check('mine of IT (shown, not stored yet)', lad(ti)['mine']['pos'] == 6)
check('mine null: a null token, an unknown token, no profile, a country not on the ladder (ES)', all(lad(t)['mine'] is None for t in (None, BAD, tn, tj)))
check('the same ladder for every caller', all(lad(t)['ladder'] == L2['ladder'] for t in (None, BAD, tb, tn)))
check('crown on #1 only', [x['country'] for x in L2['ladder'] if x['crown']] == ['FR'])
check('every round carries its player\'s country (stored by g1\'s hg_round_submit)', q1('select count(*) from hg_rounds') > 0
      and q1('select count(*) from hg_rounds x join hg_profiles p on p.tg_id = x.tg_id where x.country is distinct from p.country') == 0)
# the rollover: this week's rounds move back a week, the week is opened again, and two callers arrive at once. Before the
# close, Ann (GE's only player that week, 30) moves to US: her round still counts for GE (by the profile, GE would have no
# member and US would get (400 + 101 + 30) / 5)
q("update hg_rounds set at = at - interval '7 days' where at >= %s", datetime.datetime(mon.year, mon.month, mon.day, tzinfo=UTC))
q('delete from hg_ladder_duels where week = %s', lw); q('update hg_ladder_state set week = %s', lw)
assert P('hg_profile_set', token=ta, name='Ann', country='US').get('ok')
c1 = psycopg2.connect(**DSN)
k1 = c1.cursor(); k1.execute('set role anon'); k1.execute('select hg_ladder(%s)', (ta,)); first = k1.fetchone()[0]
out = {}
def lad2():
    c2 = psycopg2.connect(**DSN); c2.autocommit = True
    with c2.cursor() as k:
        k.execute('set role anon'); k.execute('select hg_ladder(%s)', (tb,)); out['r'] = k.fetchone()[0]
    c2.close()
th_ = threading.Thread(target=lad2); th_.start(); th_.join(1.5); waited = th_.is_alive()
c1.commit(); c1.close(); th_.join(15)
seen.extend([first, out.get('r')])
L3 = out.get('r') or {}
check('rollover: the second caller waits for the closer, then finds the week closed (no second close)', waited and L3.get('ladder') == first.get('ladder')
      and L3.get('last') == first.get('last') and q1('select week from hg_ladder_state') == mon, (waited, first, L3))
ev = weven(lw)
if ev:   # FR 16.83 - US 100.2: US up; DE 0 - GE 6: GE up; JP 10 - IT 14: IT up
    wd = [(1, 'FR', 'US', 16.83, 100.2, 6, 2, 6, 2, 'US'), (3, 'DE', 'GE', 0, 6, 0, 1, 0, 1, 'GE'), (5, 'JP', 'IT', 10, 14, 1, 1, 1, 1, 'IT')]
    wo = ['US', 'FR', 'GE', 'DE', 'IT', 'JP']
else:    # FR rests; US 100.2 - DE 0: US stays; GE 6 - JP 10: JP up; IT rests
    wd = [(1, 'FR', None, 16.83, None, 6, None, 6, None, None), (2, 'US', 'DE', 100.2, 0, 2, 0, 2, 0, 'US'), (4, 'GE', 'JP', 6, 10, 1, 1, 1, 1, 'JP'),
          (6, 'IT', None, 14, None, 1, None, 1, None, None)]
    wo = ['FR', 'US', 'DE', 'JP', 'GE', 'IT']
check(f'rollover week ({"even" if ev else "odd"}): the duels stored once, IT joined at the bottom; a change of country after the week moves nothing', duels(lw) == wd, duels(lw))
check('rollover: the stored score is rounded to 2 decimals (FR 101 / 6 stored as 16.83)',
      q1("select a_score::text from hg_ladder_duels where week = %s and a = 'FR'", lw) == '16.83')
check('rollover: the new order', order() == wo and q1("select since from hg_ladder where country = 'IT'") == lw, order())
check('rollover: last = the duels just closed', L3.get('last') == [{'week': lw.isoformat(), 'a': d[1], 'b': d[2], 'a_score': d[3], 'b_score': d[4], 'winner': d[9]} for d in wd if d[2]], L3.get('last'))
check('rollover: the new week starts at 0 for everyone', [x['country'] for x in L3['ladder']] == wo and all(x['score'] == 0 and x['real'] == 0 for x in L3['ladder']))
n_duels = q1('select count(*) from hg_ladder_duels')
check('more calls change nothing', lad(tc)['ladder'] == L3['ladder'] and q1('select count(*) from hg_ladder_duels') == n_duels and order() == wo)
# a move during the week: the round before it counts for the old country, the round after it for the new one
play('A', 60)   # Ann is in US now (her last round is a week old)
q("update hg_rounds set at = at - interval '141 seconds' where tg_id = %s and at >= %s", PID['A'], datetime.datetime(mon.year, mon.month, mon.day, tzinfo=UTC))
assert P('hg_profile_set', token=ta, name='Ann', country='GE').get('ok')
play('A', 40)
L4 = {x['country']: x for x in lad(None)['ladder']}
check('a move during the week: 60 for US (before the move back), 40 for GE (after it), Ann a member of both (60 / 5, 40 / 5)',
      (L4['US']['real'], L4['US']['score'], L4['GE']['real'], L4['GE']['score']) == (1, 12, 1, 8), (L4['US'], L4['GE']))
# the winner on exact values: BE 131 / 13 = 10.0769 (#1) against NL 121 / 12 = 10.0833 (#2), both shown and stored as 10.08;
# NL wins (on the rounded scores it would be a tie, which keeps BE). On a fresh ladder in a rolled-back transaction, week 2026-10-12
# (6 weeks before 2026-11-23: even, 1-2).
WX = datetime.date(2026, 10, 12)
cx = psycopg2.connect(**DSN); xs = {}
try:
    with cx.cursor() as k:
        k.execute('delete from hg_ladder')
        k.execute("insert into hg_ladder (country, pos, since) values ('BE', 1, %s), ('NL', 2, %s)", (WX, WX))
        for i in range(25):
            pid, cc = BASE + 100 + i, ('BE' if i < 13 else 'NL')
            k.execute('insert into players (tg_id, name) values (%s, %s)', (pid, f'tg{pid}'))
            k.execute('insert into hg_profiles (tg_id, name, country) values (%s, %s, %s)', (pid, f'Zed{i:02d}', cc))
            k.execute("insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted, at, country) values (%s, 'thor', %s, 1, 8, 0, 0, 812, %s, %s)",
                      (pid, 10 + (1 if i in (0, 13) else 0), at(WX, 2, 10 + i % 10), cc))
        k.execute('select hg_ladder_close(%s)', (WX,))
        k.execute('select pos, a, b, a_score::text, b_score::text, a_real, b_real, winner from hg_ladder_duels where week = %s order by pos', (WX,)); xs['d'] = k.fetchall()
        k.execute('select country from hg_ladder order by pos'); xs['o'] = [r[0] for r in k.fetchall()]
finally: cx.rollback(); cx.close()
check('the winner is decided on exact scores: BE 10.0769 vs NL 10.0833, both stored as 10.08, NL wins and moves up',
      xs.get('d') == [(1, 'BE', 'NL', '10.08', '10.08', 13, 12, 'NL')] and xs.get('o') == ['NL', 'BE'], xs)
check('... rolled back: the ladder unchanged', order() == wo and q1('select count(*) from hg_ladder_duels where week = %s', WX) == 0)

# ================================================================ crowns: the champion is last week's #1 (Cat, 400)
lb = board(ta, 'last')
check('the champion is the #1 of the last board', lb['players'][0]['name'] == 'Cat' and [x['name'] for x in lb['players'] if x['crown']] == ['Cat'])
play('C', 5); play('E', 7)
for sc in ('week', 'last', 'all'):
    b = board(tb, sc)
    check(f'board {sc}: every row has crown, true for the champion only', all(isinstance(x.get('crown'), bool) for x in b['players'])
          and [x['name'] for x in b['players'] if x['crown']] == ['Cat'], [(x['name'], x['crown']) for x in b['players']])
check('board with a null token: the crown too', [x['name'] for x in board(None, 'week')['players'] if x['crown']] == ['Cat'])
check('profile: crown true for the champion, no crown key for others', pget(tc) == {'name': 'Cat', 'country': 'US', 'crown': True}
      and pget(ta) == {'name': 'Ann', 'country': 'GE'} and pget(tn) == {} and pget(BAD) == {'error': 'auth'})
cback('C', 61); cm = send(tc, 'world', 'the champion speaks')
check('chat: the champion\'s message carries the crown, in the answer and in the list (old messages too)', cm.get('msg', {}).get('crown') is True
      and {x['name']: x['crown'] for x in lst(tb, 'world')['msgs']} == {'Ann': False, 'Cat': True}, lst(tb, 'world'))
check('ladder: #1 has the crown', [x['country'] for x in lad(None)['ladder'] if x['crown']] == [wo[0]])

# ================================================================ g1 compatibility: g2's hg_board / hg_profile_get = g1's + crown
CALLS = [('hg_board', dict(token=t, scope=s)) for t in (ta, tc, None, BAD, tn) for s in ('week', 'last', 'all', 'month', None)] + \
        [('hg_profile_get', dict(token=t)) for t in (ta, tc, tn, BAD, tj)]
def snap(): return [P(fn, **kw) for fn, kw in CALLS]
def strip(r):
    r = json.loads(json.dumps(r))
    if isinstance(r, dict):
        r.pop('crown', None)
        for x in r.get('players') or []: x.pop('crown', None)
    return r
g2v = snap(); load(SQL1); g1v = snap(); load(SQL2)
check('g1 keys kept: hg_board and hg_profile_get answer exactly as in g1, plus crown', [strip(x) for x in g2v] == g1v and g2v != g1v)
check('re-running g2 after g1 brings the crowns back', snap() == g2v)
# the countries list counts each round for the country stored on it: Ann's 60 this week was played for US, her profile is GE again
check('a round stored for another country than the player\'s profile today (Ann: US round, GE profile)',
      q1("select count(*) from hg_rounds x join hg_profiles p on p.tg_id = x.tg_id where x.country <> p.country and x.at >= %s",
         datetime.datetime(mon.year, mon.month, mon.day, tzinfo=UTC)) == 1 and pget(ta).get('country') == 'GE')
def want_countries(t0, t1):
    return [{'country': c, 'players': n, 'rounds': r, 'gold': g} for c, n, r, g in q(
        'select coalesce(x.country, p.country)::text c, count(distinct x.tg_id)::int n, count(*)::int r, sum(x.banked)::bigint g '
        'from hg_rounds x join hg_profiles p on p.tg_id = x.tg_id where x.at >= %s and x.at < %s group by 1 order by g desc, n desc, c', t0, t1)]
MON = datetime.datetime(mon.year, mon.month, mon.day, tzinfo=UTC)
FAR0, FAR1 = datetime.datetime(1970, 1, 1, tzinfo=UTC), datetime.datetime(2999, 1, 1, tzinfo=UTC)
WC = {'week': want_countries(MON, FAR1), 'last': want_countries(MON - dd(days=7), MON), 'all': want_countries(FAR0, FAR1)}
got = {sc: board(ta, sc)['countries'] for sc in WC}
check('board countries, all three scopes: every round counted for its stored country (week, last, all = hg_alltime)', got == WC, (got, WC))
us = next((c for c in got['week'] if c['country'] == 'US'), {})
check('… this week US counts Ann\'s round (Ann and Cat: 2 players, 60 + 5), GE only her later 40', us == {'country': 'US', 'players': 2, 'rounds': 2, 'gold': 65}
      and next((c for c in got['week'] if c['country'] == 'GE'), {}) == {'country': 'GE', 'players': 1, 'rounds': 1, 'gold': 40}, got['week'])
# the session TimeZone never moves a week: the same answers under UTC+14 and UTC-8
TZC = CALLS + [('hg_ladder', dict(token=ta)), ('hg_chat_list', dict(token=tb, channel='world', since=0))]
def tzsnap(): return [P(fn, **kw) for fn, kw in TZC]
base = tzsnap(); tzv = {}
for tz in ('Pacific/Kiritimati', 'America/Los_Angeles'):
    q('set timezone = %s', tz); tzv[tz] = tzsnap(); q('reset timezone')
check('hg_board, hg_profile_get, hg_ladder, hg_chat_list: the same answers with TimeZone Pacific/Kiritimati and America/Los_Angeles',
      all(v == base for v in tzv.values()), {tz: [i for i, (a, b) in enumerate(zip(v, base)) if a != b] for tz, v in tzv.items()})
check('… the week boundaries are Monday 00:00 UTC', board(ta, 'week')['since'] == iso(mon) and board(ta, 'last')['since'] == iso(mon - dd(days=7))
      and board(ta, 'last')['until'] == iso(mon))

# ================================================================ no Telegram id anywhere
blob = json.dumps(seen, ensure_ascii=False)
check(f'no Telegram id in any of the {len(seen)} answers', 'tg_id' not in blob and not any(str(p) in blob for p in ALL))

# ================================================================ rights
T2 = ['hg_chat', 'hg_chat_blocks', 'hg_chat_reports', 'hg_ladder', 'hg_ladder_state', 'hg_ladder_duels', 'hg_cards']
check('anon and authenticated hold no right on the g2 tables', q1("select bool_or(has_table_privilege(r, t, p)) from unnest(array['anon', 'authenticated']) r, "
      "unnest(%s) t, unnest(array['select', 'insert', 'update', 'delete']) p", T2) is False)
def denied(sql, role='anon'):
    with db.cursor() as c:
        c.execute(f'set role {role}')
        try: c.execute(sql); return False
        except psycopg2.Error: return True
        finally: c.execute('reset role')
check('anon and authenticated cannot read or write them', all(denied(s, role) for role in ('anon', 'authenticated') for s in
      [f'select * from {t}' for t in T2] + [f"insert into hg_chat (tg_id, channel, body) values ({PID['A']}, 'world', 'x')", "update hg_chat set hidden = false",
       "delete from hg_ladder", "update hg_ladder_state set week = '2020-01-06'", "select nextval('hg_chat_id_seq')", "select png from hg_cards"]))
INTERNAL = [('hg_champion', {}), ('hg_chat_clean', dict(t='x')), ('hg_country_week', dict(t0='-infinity', t1='infinity')),
            ('hg_ladder_opp', dict(pos=1, n=2, wk='2026-11-23')), ('hg_ladder_close', dict(wk='2026-11-23')), ('hg_card_get', dict(id=str(uuid.uuid4())))]
check('the internal helpers are closed to anon and authenticated (hg_champion returns a tg_id)',
      all('permission denied' in (refused(fn, role=ro, **kw) or '') for fn, kw in INTERNAL for ro in ('anon', 'authenticated')))
fx = q("select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute'), "
       "has_function_privilege('service_role', p.oid, 'execute') from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
       "where n.nspname = 'public' and p.proname like 'hg\\_%%' order by 1")
api = {r[0]: r[1:] for r in fx}
API = ('hg_board', 'hg_profile_get', 'hg_profile_set', 'hg_round_submit', 'hg_chat_send', 'hg_chat_list', 'hg_chat_block', 'hg_chat_report', 'hg_ladder', 'hg_card_put')
PATH = ['search_path=public, pg_temp']
check('the calls (g1 and g2): security definer, search_path = public, pg_temp, execute for anon and authenticated',
      all(api.get(f, (None,) * 5)[:4] == (True, PATH, True, True) for f in API), {f: api.get(f) for f in API})
check('hg_card_get: security definer, for service_role only', api.get('hg_card_get') == (True, PATH, False, False, True), api.get('hg_card_get'))
G2F = ('hg_champion', 'hg_board', 'hg_profile_get', 'hg_chat_clean', 'hg_chat_send', 'hg_chat_list', 'hg_chat_block', 'hg_chat_report',
       'hg_country_week', 'hg_ladder_opp', 'hg_ladder_close', 'hg_ladder', 'hg_card_put', 'hg_card_get')
cfg = q("select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any(%s)", list(G2F))
nopt = [r for r in cfg if not any(c.startswith('search_path=') and ('pg_temp' in c or c == 'search_path=""') for c in (r[1] or []))]
check('no g2 function has a search_path without pg_temp (an empty one only for hg_chat_clean and hg_ladder_opp)', not nopt and len(cfg) == len(G2F)
      and {r[0] for r in cfg if r[1] == ['search_path=""']} == {'hg_chat_clean', 'hg_ladder_opp'}, (nopt, cfg))
check('the old trigger function hg_round_country is gone', 'hg_round_country' not in api)
check('RLS on, no policies, on every g2 table', q1("select bool_and(relrowsecurity) from pg_class where relname = any(%s) and relkind = 'r'", T2) is True
      and q1("select count(*) from pg_class where relname = any(%s) and relkind = 'r'", T2) == len(T2) and q1('select count(*) from pg_policies where tablename = any(%s)', T2) == 0)

# ================================================================ re-running both files changes nothing
def state():
    return ([q(f'select * from {t} order by 1, 2') for t in T2 + ['hg_profiles', 'hg_rounds']],
            lad(ta), lst(tb, 'world'), lst(ta, 'c:GE'), board(ta, 'all'), board(ta, 'last'), pget(tc))
q('update hg_rounds set country = null where tg_id = %s', PID['C'])   # rounds stored before g2: no country yet
load(SQL2)
check('g2 fills the country of older rounds from the profile', q1('select count(*) from hg_rounds where country is null') == 0
      and {r[0] for r in q('select country from hg_rounds where tg_id = %s', PID['C'])} == {'US'})
before = state()
load(SQL1, SQL2); load(SQL1, SQL2)
check('re-running g1 + g2 twice keeps every row, the ladder, the chat, the boards and the crowns', state() == before)
fx2 = q("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hg\\_%%' order by 1")
IDX = {'hg_chat': 3, 'hg_chat_blocks': 1, 'hg_chat_reports': 1, 'hg_ladder': 2, 'hg_ladder_state': 1, 'hg_ladder_duels': 1, 'hg_cards': 3}
check('re-running: one function per name (7 of g1 + 12 of g2), the same indexes, only g1\'s two triggers on hg_rounds', [r[0] for r in fx] == [r[0] for r in fx2] and len(fx2) == 19
      and {r[0] for r in q("select tgname from pg_trigger where tgrelid = 'hg_rounds'::regclass and not tgisinternal")} == {'hg_rounds_alltime', 'hg_rounds_alltime_truncate'}
      and all(q1('select count(*) from pg_indexes where tablename = %s', t) == n for t, n in IDX.items()), (len(fx2), {t: q1('select count(*) from pg_indexes where tablename = %s', t) for t in IDX}))
cback('A', 61); kback('L', 7200)
check('re-running: the calls still work', send(ta, 'world', 'after').get('ok') is True and card(tl, b64(small)).get('ok') is True
      and lad(ta)['ladder'] == before[1]['ladder'] and pget(tc).get('crown') is True)
print('g2:', 'ALL OK' if not fails else 'FAILED ' + str(len(fails)))
raise SystemExit(1 if fails else 0)
