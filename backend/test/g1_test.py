# g1 (Heavy Gold): profiles (name rules: NFKC look-alikes, Hangul fillers, separators only, Latin mixed with Greek / Cyrillic,
# the owner's word list, combining marks of Indic / Thai / Tibetan / Myanmar / Khmer names, the 64-character cap; case-insensitive
# uniqueness; ISO countries equal to the client's list), rounds (what the game can produce: 8 heroes, the 812 / Freya 1218 cap,
# banked x rank <= minted; the 140 s rule, 100 a day, no profile, parallel submits serialised, the round's country stored),
# the boards (week / last / all: order, mine, me, countries by the round's country, totals, boundaries, the session TimeZone,
# the running all-time totals under insert / update / delete / truncate, no Telegram id, the null token), rights (RLS, no table
# access, internal helpers closed, search_path with pg_temp last against temp-table stand-ins) and re-running the file.
# Local database only (HG_DB picks another local database); it also passes on a database where holdor_g2.sql is loaded
# (g2 adds functions and tables, no trigger).
import os, re, json, uuid, threading, datetime, atexit
import psycopg2
DSN = dict(host='127.0.0.1', dbname=os.environ.get('HG_DB', 'postgres'), user='postgres', password='pg')
db = psycopg2.connect(**DSN); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
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
def refused(fn, **kw):
    """the error message when anon's call is refused, else None"""
    try: anon(fn, **kw); return None
    except psycopg2.Error as e: return (e.diag.message_primary or str(e)).strip()
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
here = os.path.dirname(os.path.abspath(__file__))
SQL = open(os.path.join(here, '..', 'holdor_g1.sql'), encoding='utf-8').read()
def load():
    with db.cursor() as c: c.execute(SQL)
load()

BASE = 995300000
A, B, C, D, E, F = (BASE + i for i in range(1, 7))
FILL = [BASE + 100 + i for i in range(18)]
ALL = [A, B, C, D, E, F] + FILL
q('delete from hg_rounds'); q('delete from hg_profiles')   # the hg_ tables belong to this file alone (local database)
q('delete from sessions where tg_id in %s', tuple(ALL)); q('delete from players where tg_id in %s', tuple(ALL))
for pid in ALL: q('insert into players (tg_id, name) values (%s, %s)', pid, f'tg{pid}')
tok = {pid: q1('insert into sessions (tg_id) values (%s) returning token::text', pid) for pid in ALL}
ta, tb, tc, td, te, tf = (tok[p] for p in (A, B, C, D, E, F))
BAD = str(uuid.uuid4())
# chat_words is the owner's list (v23). The name checks need two of its words: add them only if missing, and remove only those.
added = [r[0] for w in ('nigger', 'faggot') for r in q('insert into chat_words (w) values (%s) on conflict do nothing returning w', w)]
atexit.register(lambda: q("delete from chat_words where w = any(%s) or w = 'zorkgrim'", added))
seen = []   # every JSON the functions returned: no Telegram id may be in any of them
def P(fn, **kw):
    r = anon(fn, **kw); seen.append(r); return r
def pset(t, name, country): return P('hg_profile_set', token=t, name=name, country=country)
def pget(t): return P('hg_profile_get', token=t)

# --- profiles
check('profile get before any profile: {}', pget(ta) == {})
check('profile get with an unknown token: auth', pget(BAD) == {'error': 'auth'})
check('profile set with an unknown token: auth', pset(BAD, 'Ghost', 'GE') == {'error': 'auth'})
r = pset(ta, '  Ann  ', 'GE')
check('profile set: ok, the name trimmed', r == {'ok': True, 'name': 'Ann', 'country': 'GE'}, r)
check('profile get returns it', pget(ta) == {'name': 'Ann', 'country': 'GE'})
BADNAMES = ['ab', 'x' * 17, '', '   ', None, 'a<b>c', 'ann!', 'a.b.c', 'ann\U0001F600', 'tab\tbed', 'new\nline', '@handle', 'http://x', "o'neil", 'a/b']
wrong = [n for n in BADNAMES if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('bad names refused (short, long, empty, blank, null, symbols, emoji, tab, newline, handle, link)', not wrong, wrong)
FILLERS = ['Annㅤ', 'ㅤㅤㅤ', 'Annᅟ', 'Anᅠn', 'Aﾠnn', 'ᅟᅟᅟ', 'ᅠᅠᅠ']
wrong = [n for n in FILLERS if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('Hangul fillers refused: a copy of Ann with an invisible letter, a blank name (U+115F, U+1160, U+3164, U+FFA0)', not wrong, wrong)
wrong = [n for n in ('- -', '___', '_-_', 'a__', '-a-') if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('a name of separators, or with one letter only, is refused (at least two letters or digits)', not wrong, wrong)
wrong = [n for n in ('Аnn', 'Bоb', 'Αnna', 'Paрa') if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('Latin mixed with Cyrillic or Greek look-alikes is refused (Cyrillic A + nn, Greek Alpha + nna)', not wrong, wrong)
wrong = [n for n in ('Nigger', 'xFAGGOTx', 'Nig ger', 'N_i_g_g_e_r', 'Fa-ggot', 'NIG-GER 1') if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('a word of the owner\'s list (chat_words) is refused, in any case, with separators in between', not wrong, wrong)
wrong = [n for n in ('B͏ob', 'Bob឴', 'Bo​b', 'Bob‮', 'a؜b') if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('invisible marks and controls refused (grapheme joiner, Khmer inherent vowel, zero-width space, bidi controls)', not wrong, wrong)
wrong = [n for n in ('्््', '́abc', '้abc', '្abc', '྄abc') if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('a name that starts with a mark is refused (virama x3, a lone acute, a Thai tone mark, Khmer coeng, Tibetan halanta)', not wrong, wrong)
wrong = [n for n in (' ' * 61 + 'Abcd', 'Abcd' + ' ' * 61, ' ' * 32 + 'Abcd' + ' ' * 32, 'a' * 65, 'a  ' * 300000) if pset(tc, n, 'US') != {'error': 'bad_name'}]
check('raw input over 64 characters is refused before the trim (even when it would trim to a good name), and so is a 900 kB name', not wrong, wrong)
check('a long name with an unknown token is still auth', pset(BAD, 'a  ' * 300000, 'US') == {'error': 'auth'})
check('a refused name stores nothing', pget(tc) == {})
GOOD = {'Ab1': 'Ab1', 'x' * 16: 'x' * 16, 'Jürgen_1-x': 'Jürgen_1-x', 'Bo    Bo': 'Bo Bo', '名前です': '名前です',
        'Иван 2': 'Иван 2', '١٢٣': '١٢٣', '한국어': '한국어', 'محمد': 'محمد', 'Neo2026': 'Neo2026', 'Player12345': 'Player12345'}
INDIC = ['कृष्ण', 'अक्षय', 'लक्ष्मी', 'శ్రీను', 'ಕೃಷ್ಣ', 'കൃഷ്ണൻ', 'முருகன்', 'শ্রাবন্তী', 'ਗੁਰਪ੍ਰੀਤ', 'પ્રિયા', 'ଶ୍ରୀ', 'ශ්රී',
         'น้อง', 'สมชาย', 'မောင်', 'བཀྲ་ཤིས', 'ចន្ទ្រា']
GOOD.update({n: n for n in INDIC})
GOOD.update({'abcé': 'abcé',                                         # NFD in, composed out
             'Ｊｏｅ': 'Joe', '\U0001d40a\U0001d41a\U0001d42d': 'Kat',    # fullwidth and math bold become plain letters
             'Bo　Ka': 'Bo Ka', 'An  n': 'An n', ' Liv ': 'Liv',   # odd spaces become one space, then trimmed
             ' ' * 30 + 'Abcd' + ' ' * 30: 'Abcd'})                                   # 64 characters before the trim is fine
wrong = [(n, r) for n, want in GOOD.items() if (r := pset(td, n, 'GE')) != {'ok': True, 'name': want, 'country': 'GE'}]
check(f'good names accepted ({len(GOOD)}): 3 and 16 characters, letters of any script, digits, _ and -, inner spaces collapsed', not wrong, wrong)
wrong = [n for n in INDIC if pset(td, n, 'GE').get('ok') is not True or q1('select name from hg_profiles where tg_id = %s', D) != n]
check('names with combining marks are stored as sent (Devanagari, Telugu, Kannada, Malayalam, Tamil, Bengali, Gurmukhi, Gujarati, '
      'Oriya, Sinhala, Thai, Myanmar, Tibetan, Khmer)', not wrong, wrong)
q("insert into chat_words (w) values ('zorkgrim') on conflict do nothing")
r1 = pset(td, 'Zork Grim', 'GE'); q("delete from chat_words where w = 'zorkgrim'"); r2 = pset(td, 'Zork Grim', 'GE')
check('the word list is read on every call: a word the owner adds refuses a name at once, removing it frees the name',
      r1 == {'error': 'bad_name'} and r2 == {'ok': True, 'name': 'Zork Grim', 'country': 'GE'}, (r1, r2))
q('delete from hg_profiles where tg_id = %s', D)   # D plays the player without a profile below
r = pset(tb, 'ბექა', 'GE')
check('a Georgian name', r == {'ok': True, 'name': 'ბექა', 'country': 'GE'}, r)
wrong = [n for n in ('ANN', 'ann', ' aNn ') if pset(tc, n, 'US') != {'error': 'name_taken'}]
check('a taken name, ignoring case, is refused', not wrong, wrong)
LOOK = ['Ａnn', 'ＡＮＮ', '\U0001d400\U0001d427\U0001d427', '\U0001d504\U0001d52b\U0001d52b', 'ⒶⓃⓃ',
        'Ann　', 'Ann ', ' Ann', ' Ann ']
wrong = [n for n in LOOK if pset(tc, n, 'US') != {'error': 'name_taken'}]
check('compatibility look-alikes of a taken name are taken (fullwidth, math bold, fraktur, circled, odd spaces)', not wrong, wrong)
check('a refused taken name stores nothing', pget(tc) == {})
check('a name taken in another script ignores case too (Cyrillic)', pset(te, 'Иван', 'US')['ok'] and pset(tc, 'иван', 'US') == {'error': 'name_taken'})
check('my own name in another case is mine to keep', pset(ta, 'ANN', 'GE') == {'ok': True, 'name': 'ANN', 'country': 'GE'} and pget(ta)['name'] == 'ANN')
check('my own name in fullwidth is stored as plain letters', pset(ta, 'ａｎｎ', 'GE') == {'ok': True, 'name': 'ann', 'country': 'GE'})
check('changing my name back', pset(ta, 'Ann', 'GE')['ok'] and pget(ta) == {'name': 'Ann', 'country': 'GE'})
check('a rename frees the old name', pset(te, 'Eve', 'US')['ok'] and pset(tc, 'ИВАН', 'US')['ok'] and pset(tc, 'Cat', 'US')['ok'])
wrong = [c for c in ('ge', 'GEO', 'G1', 'G', '', None, 'g e', 'ÄÖ', 'XX', 'ZZ', 'QQ', 'AA', 'UN', 'EU', 'UK', 'XK') if pset(ta, 'Ann', c) != {'error': 'bad_country'}]
check('bad countries refused (lowercase, three letters, digit, one letter, empty, null, non-ASCII, codes outside ISO 3166-1)', not wrong, wrong)
js = open(os.path.join(here, '..', '..', 'src', 'gold', 'js', '20_profile.js'), encoding='utf-8').read()
CLIENT = {s[:2] for s in ''.join(re.findall(r"'([^']*)'", re.search(r'const RAW = (.*?);', js, re.S).group(1))).split('|') if s}
AZ = [chr(65 + i) for i in range(26)]
taken = {a + b for a in AZ for b in AZ if anon('hg_profile_set', token=tc, name='Cat', country=a + b).get('ok')}
check(f'the server takes exactly the client\'s {len(CLIENT)} countries (G.COUNTRIES in src/gold/js/20_profile.js) of all 676 pairs of capitals',
      taken == CLIENT and len(CLIENT) == 249, sorted(taken ^ CLIENT))
check('a country with spaces around is trimmed', pset(tc, 'Cat', ' US ') == {'ok': True, 'name': 'Cat', 'country': 'US'})
check('a refused country changes nothing', pget(ta) == {'name': 'Ann', 'country': 'GE'})
check('changing my country', pset(ta, 'Ann', 'US')['country'] == 'US' and pset(ta, 'Ann', 'GE')['country'] == 'GE')
check('one profile row per player', q1('select count(*) from hg_profiles where tg_id = %s', A) == 1)
# two players take the same name at the same time: the second insert waits on the unique index, then reads as name_taken
c1 = psycopg2.connect(**DSN)
k1 = c1.cursor(); k1.execute('set role anon'); k1.execute('select hg_profile_set(%s, %s, %s)', (td, 'Race', 'GE')); first = k1.fetchone()[0]
out = {}
def racer():
    c2 = psycopg2.connect(**DSN); c2.autocommit = True
    with c2.cursor() as k:
        k.execute('set role anon'); k.execute('select hg_profile_set(%s, %s, %s)', (tok[FILL[0]], 'RACE', 'FR')); out['r'] = k.fetchone()[0]
    c2.close()
th = threading.Thread(target=racer); th.start(); th.join(1.5); waited = th.is_alive()
c1.commit(); c1.close(); th.join(15)
check('a name raced by two players: the first gets it, the second waits and gets name_taken, no row for it',
      first.get('ok') is True and waited and out.get('r') == {'error': 'name_taken'} and pget(tok[FILL[0]]) == {}, (first, waited, out))
q('delete from hg_profiles where tg_id = %s', D)
pset(tf, 'Fox', 'DE')
for i, pid in enumerate(FILL): pset(tok[pid], f'Filler{i + 1:02d}', 'FR' if i % 2 == 0 else 'JP')
prof = {pid: (nm, cc) for pid, nm, cc in q('select tg_id, name, country from hg_profiles')}
check('profiles ready', [prof[p][0] for p in (A, B, C, E, F)] == ['Ann', 'ბექა', 'Cat', 'Eve', 'Fox'] and len(prof) == 23, prof)

# --- rounds
R0 = {'god': 'thor', 'banked': 300, 'rank': 1, 'heroes': 8, 'robs': 3, 'lost': 40, 'minted': 812, 'day': '2026-11-23'}
DROP = object()
def rnd(**ch):
    r = dict(R0); r.update(ch); return {k: v for k, v in r.items() if v is not DROP}
def sub(t, r): return P('hg_round_submit', token=t, r=None if r is None else json.dumps(r))
def back(pid, s): q(f"update hg_rounds set at = at - interval '{s} seconds' where tg_id = %s", pid)
check('submit with an unknown token: auth', sub(BAD, rnd()) == {'error': 'auth'})
check('submit without a profile: no_profile', sub(td, rnd()) == {'error': 'no_profile'})
FREYA_NOW = q1("select 5 in (extract(isodow from now() at time zone 'utc'), extract(isodow from (now() - interval '15 minutes') at time zone 'utc'))")
BADR = [rnd(banked=813), rnd(banked=-1), rnd(minted=0, banked=0), rnd(minted=813, banked=10), rnd(minted=1500, banked=10), rnd(rank=0), rnd(rank=9),
        rnd(heroes=1, rank=1), rnd(heroes=2, rank=1), rnd(heroes=7, rank=1), rnd(heroes=9, rank=1), rnd(heroes=33, rank=1),
        rnd(heroes=32, rank=32, minted=1500, banked=1500), rnd(heroes=2, rank=2, minted=1500, banked=1500), rnd(heroes=DROP), rnd(heroes=None),
        rnd(rank=3), rnd(banked=812, rank=2), rnd(banked=102, rank=8),     # banked x rank > minted: the heroes above you banked as much
        rnd(day='thor', minted=1218, banked=10), rnd(day='Freya', minted=1218, banked=10), rnd(day='freya', minted=1219, banked=10),
        rnd(robs=-1), rnd(lost=-1), rnd(robs=10 ** 12), rnd(god='zeus'), rnd(god='Thor'),
        rnd(god=DROP), rnd(god=5), rnd(banked=1.5), rnd(banked='300'), rnd(banked=None), rnd(banked=DROP), rnd(rank=True),
        rnd(minted=DROP), rnd(lost=DROP), rnd(day='x' * 17), rnd(day=20261123), rnd(day=['x'])]
if not FREYA_NOW: BADR.append(rnd(day='freya', minted=1218, banked=10))   # Freya's cap outside Friday (UTC) and its 15 minutes
wrong = [r for r in BADR if sub(ta, r) != {'error': 'bad_round'}]
check(f'bad rounds refused ({len(BADR)}: bounds, heroes not 8, rank > heroes, banked x rank > minted, the 812 cap, Freya\'s 1218 only on her day, '
      'unknown god, not whole numbers, strings, missing fields, long day)', not wrong, wrong)
wrong = [r for r in (None, [1, 2], 'round', 7) if sub(ta, r) != {'error': 'bad_round'}]
check('a round that is not an object is refused', not wrong, wrong)
check('refused rounds store nothing', q1('select count(*) from hg_rounds') == 0)
r = sub(ta, rnd())
check('submit ok, with my week after the round', r == {'ok': True, 'week': {'total': 300, 'best': 300, 'rounds': 1, 'rank': 1}}, r)
row = q('select god, banked, rank, heroes, robs, lost, minted, day, country from hg_rounds where tg_id = %s', A)
check('the stored round is what was sent, with my country at submit time', row == [('thor', 300, 1, 8, 3, 40, 812, '2026-11-23', 'GE')], row)
check('a second round at once: too_fast', sub(ta, rnd(banked=100)) == {'error': 'too_fast'})
back(A, 130)
check('130 s later: still too_fast', sub(ta, rnd(banked=100)) == {'error': 'too_fast'})
back(A, 11)
r = sub(ta, rnd(banked=100, god='hermes', day=DROP, minted=100, rank=1))
wk = q("select sum(banked), max(banked), count(*) from hg_rounds where tg_id = %s and at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc'", A)[0]
check('141 s later: ok, the week sums both rounds', r == {'ok': True, 'week': {'total': wk[0], 'best': wk[1], 'rounds': wk[2], 'rank': 1}} and wk[2] >= 1, (r, wk))
check('banked equal to minted is fine, a missing day is stored as null', q('select banked, minted, day from hg_rounds where tg_id = %s order by id desc limit 1', A) == [(100, 100, None)])
check('too_fast counts from the newest round', sub(ta, rnd()) == {'error': 'too_fast'})
back(A, 141)
check('a null day, rank 8 with nothing banked, the 812 cap', sub(ta, rnd(day=None, rank=8, banked=0, minted=812, god='amirani', robs=0, lost=0)).get('ok') is True)
back(A, 141)
check('rank 3 with 270 banked (3 x 270 <= 812)', sub(ta, rnd(rank=3, banked=270, god='loki')).get('ok') is True)
back(A, 141)
check('every coin of the round banked at rank 1 (812)', sub(ta, rnd(banked=812, day='mani')).get('ok') is True)
check('every accepted round is one row', q1('select count(*) from hg_rounds where tg_id = %s', A) == 5)
# Freya's day: hg_round_submit's own body with now() read from a setting, in a transaction that is rolled back
fri = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).date()
fri += datetime.timedelta(days=(4 - fri.weekday()) % 7)   # the Friday two to eight days from now: no real round is near it
at = lambda days, hm: (datetime.datetime.combine(fri, datetime.time(0, 0), datetime.timezone.utc) + datetime.timedelta(days=days, hours=hm[0], minutes=hm[1])).isoformat()
FR = {'day': 'freya', 'minted': 1218, 'banked': 600, 'rank': 2}
CASES = [(at(-1, (23, 59)), FR, 'bad_round', 'Thursday 23:59: no Freya'), (at(0, (12, 0)), dict(FR, day='thor'), 'bad_round', 'Friday, another day key: 812'),
         (at(0, (12, 0)), dict(FR, minted=1219), 'bad_round', 'Friday: 1219 is over 1218'), (at(0, (12, 0)), FR, 'ok', 'Friday 12:00: 1218'),
         (at(0, (12, 1)), FR, 'too_fast', 'Friday 12:01: one minute later'), (at(1, (0, 3)), FR, 'ok', 'Saturday 00:03: a Friday round ending after midnight'),
         (at(1, (0, 16)), FR, 'bad_round', 'Saturday 00:16: Freya is over'), (at(1, (0, 16)), dict(FR, minted=812, banked=400), 'ok', 'Saturday 00:16: 812'),
         (at(3, (12, 0)), FR, 'bad_round', 'Monday: no Freya')]
src = q1("select pg_get_functiondef('hg_round_submit(uuid, jsonb)'::regprocedure)")
cx = psycopg2.connect(**DSN); got_fr = []
try:
    with cx.cursor() as k:
        k.execute(src.replace('now()', "current_setting('hg.now')::timestamptz"))
        for t, ch, _, _ in CASES:
            k.execute("select set_config('hg.now', %s, true)", (t,)); k.execute('set local role anon')
            k.execute('select hg_round_submit(%s, %s)', (tok[FILL[2]], json.dumps(rnd(**ch)))); x = k.fetchone()[0]
            got_fr.append('ok' if x.get('ok') else x.get('error')); k.execute('reset role')
finally: cx.rollback(); cx.close()
check('hg_round_submit reads the clock only through now() (6 places) and carries no test hook', src.count('now()') == 6 and 'hg.now' not in src)
check("Freya's day: 1218 only with day 'freya' on a UTC Friday or the 15 minutes after it; 812 any day",
      got_fr == [c[2] for c in CASES], [(c[3], g) for c, g in zip(CASES, got_fr) if g != c[2]])
check('the pinned-clock rounds are gone with their transaction', q1('select count(*) from hg_rounds where tg_id = %s', FILL[2]) == 0)
# at most 100 rounds in 24 h: 99 already in the last day, the 100th passes, the 101st is too_fast; a day later the count is free again
P1 = FILL[1]
q("insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted, day, at) "
  "select %s, 'thor', 10, 1, 8, 0, 0, 812, null, now() - interval '150 seconds' * (i + 1) from generate_series(1, 99) i", P1)
r1 = sub(tok[P1], rnd(banked=10)); back(P1, 150); r2 = sub(tok[P1], rnd(banked=10)); back(P1, 86400); r3 = sub(tok[P1], rnd(banked=10))
check('the daily cap: with 99 rounds in 24 h the 100th passes, the 101st is too_fast, 24 h later it passes again',
      r1.get('ok') is True and r2 == {'error': 'too_fast'} and r3.get('ok') is True, (r1, r2, r3))
# two submits at the same time: the second waits for the first (the advisory lock), then sees its round and is too_fast
c1 = psycopg2.connect(**DSN)
k1 = c1.cursor(); k1.execute('set role anon'); k1.execute('select hg_round_submit(%s, %s)', (tb, json.dumps(rnd()))); first = k1.fetchone()[0]
out = {}
def second():
    c2 = psycopg2.connect(**DSN); c2.autocommit = True
    with c2.cursor() as k:
        k.execute('set role anon'); k.execute('select hg_round_submit(%s, %s)', (tb, json.dumps(rnd(banked=50)))); out['r'] = k.fetchone()[0]
    c2.close()
th = threading.Thread(target=second); th.start(); th.join(1.5); waited = th.is_alive()
c1.commit(); c1.close(); th.join(15)
check('parallel submits: the first passes', first.get('ok') is True, first)
check('parallel submits: the second waits while the first is open', waited)
check('parallel submits: the second is too_fast once the first commits', out.get('r') == {'error': 'too_fast'}, out)
check('parallel submits: one row stored', q1('select count(*) from hg_rounds where tg_id = %s', B) == 1)
SAME = ("select (select coalesce(jsonb_agg(t order by t.tg_id, t.country), '[]') from (select x.tg_id, coalesce(x.country, '') as country, "
        "sum(x.banked) as total, max(x.banked) as best, count(*) as rounds from hg_rounds x group by 1, 2) t) "
        "= (select coalesce(jsonb_agg(t order by t.tg_id, t.country), '[]') from (select tg_id, country, total, best, rounds from hg_alltime) t)")
check('the all-time totals equal the rounds after submits and direct inserts', q1(SAME) is True and q1('select count(*) from hg_alltime') > 0)

# --- boards: rounds placed this week, last week (Monday to Monday, UTC) and two weeks ago, by moving `at`
q('delete from hg_rounds')
check('deleting every round empties the all-time totals', q1('select count(*) from hg_alltime') == 0)
mon = q1("select date_trunc('week', now() at time zone 'utc') at time zone 'utc'")
now = q1('select now()')
dd = datetime.timedelta
WEEK, LAST, OLD = 'week', 'last', 'old'
rows = [(A, 300, now, WEEK), (A, 200, now, WEEK), (B, 500, now, WEEK), (C, 250, now, WEEK), (C, 250, now, WEEK), (E, 100, now, WEEK),
        (F, 100, mon, WEEK),                       # exactly Monday 00:00 UTC: this week, not last
        (F, 1000, mon - dd(days=7), LAST),         # exactly the Monday before: last week
        (C, 400, mon - dd(microseconds=1), LAST),  # the last moment of last week
        (A, 400, mon - dd(days=3), LAST), (A, 50, mon - dd(days=3), LAST), (E, 400, mon - dd(days=2), LAST),
        (B, 700, mon - dd(days=10), OLD),          # two weeks ago: only in 'all'
        (E, 30, mon - dd(days=7, microseconds=1), OLD)]
rows += [(pid, 90 - 5 * i, now, WEEK) for i, pid in enumerate(FILL)]
for pid, bk, at_, _ in rows:
    q("insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted, day, at) values (%s, 'thor', %s, 1, 8, 0, 0, 1500, null, %s)", pid, bk, at_)
rows = [(pid, bk, at_, b, None) for pid, bk, at_, b in rows]   # the round's country: None = none stored, the profile's counts
def expect(scope, me):
    agg = {}
    for pid, bk, _, b, _ in rows:
        if scope == 'all' or b == scope:
            t = agg.setdefault(pid, [0, 0, 0]); t[0] += bk; t[1] = max(t[1], bk); t[2] += 1
    order = sorted(agg, key=lambda p: (-agg[p][0], -agg[p][1], prof[p][0].lower()))
    players = [{'name': prof[p][0], 'country': prof[p][1], 'total': agg[p][0], 'best': agg[p][1], 'rounds': agg[p][2], 'mine': p == me} for p in order[:20]]
    mine = {'rank': order.index(me) + 1, 'total': agg[me][0], 'best': agg[me][1], 'rounds': agg[me][2]} if me in agg else None
    cs = {}
    for pid, bk, _, b, rc in rows:
        if scope == 'all' or b == scope:
            t = cs.setdefault(rc or prof[pid][1], [set(), 0, 0]); t[0].add(pid); t[1] += 1; t[2] += bk
    countries = [{'country': c, 'players': len(v[0]), 'rounds': v[1], 'gold': v[2]} for c, v in sorted(cs.items(), key=lambda x: (-x[1][2], -len(x[1][0]), x[0]))]
    return players, mine, countries, {'players': len(agg), 'rounds': sum(v[2] for v in agg.values())}
iso = lambda t: t.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
SINCE = {'week': (iso(mon), None), 'last': (iso(mon - dd(days=7)), iso(mon)), 'all': (None, None)}
def board(t, scope): return P('hg_board', token=t, scope=scope)
KEYS = {'scope', 'since', 'until', 'players', 'me', 'countries', 'totals'}
got = {}
for sc in ('week', 'last', 'all'):
    b = got[sc] = board(ta, sc); players, me, countries, totals = expect(sc, A)
    check(f'board {sc}: the shape', set(b) == KEYS and b['scope'] == sc and all(set(x) == {'name', 'country', 'total', 'best', 'rounds', 'mine'} for x in b['players']), b)
    check(f'board {sc}: since / until', (b['since'], b['until']) == SINCE[sc], (b['since'], b['until']))
    check(f'board {sc}: the top 20 by gold, then best, then name', b['players'] == players, json.dumps(b['players'], ensure_ascii=False))
    check(f'board {sc}: mine marks my row only', [x['name'] for x in b['players'] if x['mine']] == ['Ann'])
    check(f'board {sc}: me is my rank among everyone', b['me'] == me, (b['me'], me))
    check(f'board {sc}: every country with its players, rounds and gold, gold first', b['countries'] == countries, (b['countries'], countries))
    check(f'board {sc}: totals', b['totals'] == totals, (b['totals'], totals))
w, l, a = got['week'], got['last'], got['all']
nm = lambda b: [x['name'] for x in b['players']]
tot = lambda b, n: next((x['total'] for x in b['players'] if x['name'] == n), None)
check('week: the tie on gold goes to the better best round (ბექა 500, Ann 300, Cat 250), then the name (Eve before Fox)',
      nm(w)[:5] == ['ბექა', 'Ann', 'Cat', 'Eve', 'Fox'], nm(w)[:5])
check('week: 23 players, the list stops at 20', len(w['players']) == 20 and w['totals']['players'] == 23 and nm(w)[-1] == 'Filler15')
check('week: last week\'s rounds are absent (Fox 100, not 1100; Ann 500)', tot(w, 'Fox') == 100 and tot(w, 'Ann') == 500)
check('last: the rounds moved into last week show (Fox 1000, Ann 450, Cat 400, Eve 400)', nm(l) == ['Fox', 'Ann', 'Cat', 'Eve'] and [x['total'] for x in l['players']] == [1000, 450, 400, 400], l['players'])
check('last: a round from two weeks ago is absent (ბექა\'s 700, Eve\'s 30 a microsecond before last Monday)', 'ბექა' not in nm(l) and tot(l, 'Eve') == 400)
check('last: the round at this Monday 00:00 is this week\'s, the one a microsecond before is last week\'s', tot(l, 'Fox') == 1000 and tot(l, 'Cat') == 400 and tot(w, 'Cat') == 500)
check('last: the same order as week (a tie on gold and best goes to the name: Cat before Eve)', nm(l)[2:] == ['Cat', 'Eve'])
check('last: totals and countries of last week only', l['totals'] == {'players': 4, 'rounds': 5} and [c['country'] for c in l['countries']] == ['DE', 'US', 'GE'], (l['totals'], l['countries']))
check('all: every round (ბექა 1200 with the 700 of two weeks ago, then Fox 1100)', nm(a)[:2] == ['ბექა', 'Fox'] and tot(a, 'ბექა') == 1200
      and tot(a, 'Fox') == 1100 and a['totals']['rounds'] == len(rows), (nm(a)[:2], a['totals']))
check('all: the running totals equal the rounds', q1(SAME) is True)
# the session TimeZone (PostgREST's Prefer: timezone) with a DST change inside last week: 'last' still starts Monday 00:00 UTC
sun = mon.astimezone(datetime.timezone.utc) - dd(days=1)
zone = f'HGA0HGB,M{sun.month}.{(sun.day - 1) // 7 + 1}.0/1,M{(sun.month + 5) % 12 + 1}.1.0'   # summer time from last Sunday 01:00
q("select set_config('timezone', %s, false)", zone)
try:
    shift = q1('select extract(timezone from %s::timestamptz) - extract(timezone from %s::timestamptz)', mon, mon - dd(days=7))
    tz = {sc: board(ta, sc) for sc in ('week', 'last', 'all')}
finally: q('reset timezone')
check(f'a session TimeZone with a DST change last Sunday ({zone}): week, last and all are the same boards, last since Monday 00:00 UTC',
      shift == 3600 and tz == got and tz['last']['since'] == SINCE['last'][0], (shift, tz['last']['since'], tz['last']['players'] == got['last']['players']))
b = board(tok[FILL[17]], 'week')
check('me beyond the top 20: rank 23, no row marked mine', b['me'] == {'rank': 23, 'total': 5, 'best': 5, 'rounds': 1} and not any(x['mine'] for x in b['players']), b['me'])
for t, what in ((None, 'a null token'), (BAD, 'an unknown token')):
    for sc in ('week', 'last', 'all'):
        b = board(t, sc)
        check(f'board {sc} with {what}: me null, nothing mine, the same list', b['me'] is None and not any(x['mine'] for x in b['players'])
              and [dict(x, mine=False) for x in got[sc]['players']] == b['players'] and b['countries'] == got[sc]['countries'], b['me'])
check('board for a player without a profile: me null', board(td, 'week')['me'] is None)
pset(td, 'Dan', 'GE'); prof[D] = ('Dan', 'GE')
check('board for a player with a profile and no rounds: me null (week, last, all)', all(board(td, sc)['me'] is None for sc in ('week', 'last', 'all')))
b = board(ta, 'month')
check('an unknown scope reads as week', b['scope'] == 'week' and b['players'] == w['players'] and b['since'] == iso(mon))
check('a null scope reads as week, ALL in capitals as all', board(ta, None)['scope'] == 'week' and board(ta, 'ALL')['players'] == a['players'])
r = sub(td, rnd(banked=95))
check('submit: my week equals my row on the week board', r.get('ok') is True and r['week'] == board(td, 'week')['me'] and r['week']['rank'] == 6, (r, board(td, 'week')['me']))
rows.append((D, 95, now, WEEK, 'GE'))
check('submit stores the country of my profile on the round', q('select country from hg_rounds where tg_id = %s', D) == [('GE',)])
# a round counts for the country it was played for: Ann's closed week was played for GE (stored), then Ann and Dan move country
q("update hg_rounds set country = 'GE' where tg_id = %s and at < %s", A, mon)
rows = [(pid, bk, at_, b, 'GE' if pid == A and b == LAST else rc) for pid, bk, at_, b, rc in rows]
pset(ta, 'Ann', 'US'); pset(td, 'Dan', 'FR'); prof[A] = ('Ann', 'US'); prof[D] = ('Dan', 'FR')
moved = {sc: board(None, sc) for sc in ('week', 'last', 'all')}
pset(ta, 'Ann', 'GE'); pset(td, 'Dan', 'GE'); prof[A] = ('Ann', 'GE'); prof[D] = ('Dan', 'GE')
for sc in ('week', 'last', 'all'):
    prof[A], prof[D] = ('Ann', 'US'), ('Dan', 'FR'); players, _, countries, _ = expect(sc, None); prof[A], prof[D] = ('Ann', 'GE'), ('Dan', 'GE')
    check(f'board {sc} after a change of country: the rows show the country now, the countries count each round where it was played',
          moved[sc]['players'] == players and moved[sc]['countries'] == countries, (moved[sc]['countries'], countries))
lc = {c['country']: c for c in moved['last']['countries']}
check('last: a closed week keeps its countries when a player moves (GE keeps Ann\'s 450, US does not gain it)',
      lc.get('GE', {}).get('gold') == 450 and lc.get('US', {}).get('gold') == 800, lc)
wc = {c['country']: c for c in moved['week']['countries']}
check('week: Dan\'s submitted 95 stays with GE (ბექა 500 + Dan 95), FR does not gain it, Ann\'s rounds without a country follow her to US',
      wc.get('GE') == {'country': 'GE', 'players': 2, 'rounds': 2, 'gold': 595} and wc.get('FR', {}).get('gold') == 450
      and wc.get('US', {}).get('gold') == 500 + 500 + 100, wc)
b = call('authenticated', 'hg_board', token=ta, scope='week')
check('authenticated may call the board too', b['me']['rank'] == 2)
# moderation: the all-time totals follow an update, a delete, a move to another player and a truncate (rolled back)
pre_all = board(ta, 'all'); cx = psycopg2.connect(**DSN); mod = {}
try:
    with cx.cursor() as k:
        def kq(sql, *a): k.execute(sql, a); return k.fetchone()[0]
        kb = lambda: kq("select hg_board(null, 'all')")
        k.execute('update hg_alltime set total = total + 1000000 where tg_id = %s', (E,)); mod['reads'] = kb()['players'][0]['name']
        k.execute('update hg_alltime set total = total - 1000000 where tg_id = %s', (E,))
        k.execute('delete from hg_rounds where tg_id = %s', (B,)); mod['del'] = (kq(SAME), 'ბექა' in [x['name'] for x in kb()['players']])
        k.execute('update hg_rounds set banked = banked + 1 where tg_id = %s', (C,)); mod['upd'] = (kq(SAME), next(x['total'] for x in kb()['players'] if x['name'] == 'Cat'))
        k.execute('update hg_rounds set tg_id = %s where tg_id = %s', (E, F)); mod['move'] = (kq(SAME), 'Fox' in [x['name'] for x in kb()['players']])
        k.execute('delete from hg_profiles where tg_id = %s', (E,)); mod['cascade'] = (kq(SAME), kq('select count(*) from hg_alltime where tg_id = %s', E))
        k.execute('truncate hg_rounds'); mod['trunc'] = (kq('select count(*) from hg_alltime'), kb()['totals'])
finally: cx.rollback(); cx.close()
check('all reads the running totals (hg_alltime), not every round', mod.get('reads') == 'Eve', mod.get('reads'))
check('moderation: a deleted player\'s rounds leave the all-time board', mod.get('del') == (True, False), mod.get('del'))
check('moderation: an edited round recounts the player', mod.get('upd') == (True, 500 + 400 + 3), mod.get('upd'))
check('moderation: rounds moved to another player recount both', mod.get('move') == (True, False), mod.get('move'))
check('a deleted profile takes its totals with it', mod.get('cascade') == (True, 0), mod.get('cascade'))
check('truncate empties the all-time totals', mod.get('trunc') == (0, {'players': 0, 'rounds': 0}), mod.get('trunc'))
check('the rolled-back moderation left everything as it was', q1(SAME) is True and board(ta, 'all') == pre_all)

# --- no Telegram id anywhere
blob = json.dumps(seen, ensure_ascii=False)
check(f'no Telegram id in any of the {len(seen)} answers', 'tg_id' not in blob and not any(str(p) in blob for p in ALL))

# --- rights
TABLES = ['hg_profiles', 'hg_rounds', 'hg_alltime', 'chat_words']
check('anon and authenticated hold no right on the tables (chat_words too)', q1("select bool_or(has_table_privilege(r, t, p)) from unnest(array['anon', 'authenticated']) r, "
      "unnest(%s) t, unnest(array['select', 'insert', 'update', 'delete']) p", TABLES) is False)
def denied(sql, role='anon'):
    with db.cursor() as c:
        c.execute(f'set role {role}')
        try: c.execute(sql); return False
        except psycopg2.Error: return True
        finally: c.execute('reset role')
check('anon and authenticated cannot read or write the tables', all(denied(s, role) for role in ('anon', 'authenticated') for s in (
    'select * from hg_profiles', 'select * from hg_rounds', 'select * from hg_alltime', 'select * from chat_words',
    f"insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted) values ({A}, 'thor', 1, 1, 8, 0, 0, 1)",
    f"update hg_profiles set name = 'x' where tg_id = {A}", f'delete from hg_alltime where tg_id = {A}', "delete from chat_words",
    "select nextval('hg_rounds_id_seq')")))
check('the internal helpers are closed to anon (hg_ranked holds tg_id)', 'permission denied' in (refused('hg_ranked', t0='-infinity', t1='infinity') or '')
      and 'permission denied' in (refused('hg_int', j='{"a": 1}', k='a') or ''))
fx = q("select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute') "
       "from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hg\\_%%' order by 1")
api = {r[0]: r[1:] for r in fx}
PATH = ['search_path=public, pg_temp']
check('the four calls: security definer, search_path = public, pg_temp, execute for anon and authenticated',
      all(api.get(f) == (True, PATH, True, True) for f in ('hg_board', 'hg_profile_get', 'hg_profile_set', 'hg_round_submit')), api)
check('the internal helpers: no execute for anon or authenticated; hg_ranked and hg_alltime_sync with pg_temp last, hg_int with an empty path',
      api.get('hg_ranked') == (False, PATH, False, False) and api.get('hg_alltime_sync') == (False, PATH, False, False)
      and api.get('hg_int') == (False, ['search_path=""'], False, False), api)
check('RLS on, no policies', q("select bool_and(relrowsecurity) from pg_class where relname = any(%s)", TABLES) == [(True,)]
      and q1("select count(*) from pg_policies where tablename = any(%s)", TABLES) == 0)
# a temp table must never stand in for one of ours: a fresh anon session (no cached plans) shadows sessions, hg_profiles, hg_rounds
# and hg_alltime with fakes (a made-up token that points at Ann, a fake player with 999999 gold)
FAKE = str(uuid.uuid4()); before_all = board(None, 'all'); before_week = board(None, 'week')
cx = psycopg2.connect(**DSN); cx.autocommit = True; sh = {}
try:
    with cx.cursor() as k:
        k.execute('set role anon')
        def kq(sql, *a):   # an exception (the call reached a temp table) counts as a failure, not a crash
            try: k.execute(sql, a); return k.fetchone()[0]
            except psycopg2.Error as e: return 'raised: ' + (e.diag.message_primary or str(e))
        k.execute('create temp table sessions (token uuid, tg_id bigint)'); k.execute('insert into sessions values (%s, %s)', (FAKE, A))
        k.execute('create temp table hg_profiles (tg_id bigint, name text, country char(2), created_at timestamptz default now(), updated_at timestamptz default now())')
        k.execute("insert into hg_profiles (tg_id, name, country) values (%s, 'Ann', 'GE'), (1, 'FAKE', 'ZZ')", (A,))
        k.execute('create temp table hg_rounds (id bigint, tg_id bigint, god text, banked int, rank int, heroes int, robs int, lost int, minted int, day text, at timestamptz, country char(2))')
        k.execute("insert into hg_rounds values (1, 1, 'thor', 999999, 1, 8, 0, 0, 999999, null, now(), 'ZZ')")
        k.execute('create temp table hg_alltime (tg_id bigint, country char(2), total bigint, best int, rounds int)')
        k.execute("insert into hg_alltime values (1, 'ZZ', 999999, 999999, 1)")
        sh = {'get': kq('select hg_profile_get(%s)', FAKE), 'set': kq('select hg_profile_set(%s, %s, %s)', FAKE, 'Hijacked', 'US'),
              'sub': kq('select hg_round_submit(%s, %s)', FAKE, json.dumps(rnd())), 'all': kq("select hg_board(null, 'all')"), 'week': kq("select hg_board(null, 'week')")}
        k.execute('drop table if exists pg_temp.sessions, pg_temp.hg_profiles, pg_temp.hg_rounds, pg_temp.hg_alltime')
finally: cx.close()
check('temp tables of the caller never stand in for ours: a made-up token is auth for get, set and submit, the boards are the real ones',
      sh.get('get') == {'error': 'auth'} and sh.get('set') == {'error': 'auth'} and sh.get('sub') == {'error': 'auth'}
      and sh.get('all') == before_all and sh.get('week') == before_week and pget(ta) == {'name': 'Ann', 'country': 'GE'}, sh)

# --- re-running the file changes nothing
snap = lambda: (q('select tg_id, name, country, created_at from hg_profiles order by tg_id'), q('select * from hg_rounds order by id'),
                q('select * from hg_alltime order by tg_id, country'), board(ta, 'all'), board(ta, 'last'), board(ta, 'week'))
before = snap()
load(); load()
after = snap()
check('re-running the file twice keeps every profile, round, all-time total and board', before == after)
check('re-running: one function per name, the same indexes and triggers', [r[0] for r in fx] == [r[0] for r in q("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hg\\_%%' order by 1")]
      and {'hg_int', 'hg_alltime_sync', 'hg_ranked', 'hg_profile_get', 'hg_profile_set', 'hg_round_submit', 'hg_board'} <= {r[0] for r in fx}
      and q1("select count(*) from pg_indexes where tablename = 'hg_profiles'") == 2 and q1("select count(*) from pg_indexes where tablename = 'hg_rounds'") == 3
      and q1("select count(*) from pg_indexes where tablename = 'hg_alltime'") == 1
      and q1("select count(*) from pg_trigger where tgrelid = 'hg_rounds'::regclass and not tgisinternal") == 2
      and q1("select count(*) from information_schema.columns where table_name = 'hg_rounds' and column_name = 'country'") == 1)
back(A, 300)
check('re-running: the calls still work', sub(ta, rnd(banked=10)).get('ok') is True and pget(ta) == {'name': 'Ann', 'country': 'GE'} and q1(SAME) is True)
print('g1:', 'ALL OK' if not fails else 'FAILED ' + str(len(fails)))
raise SystemExit(1 if fails else 0)
