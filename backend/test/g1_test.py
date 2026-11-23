# g1 (Heavy Gold): profiles (name rules, case-insensitive uniqueness, country), rounds (bounds, the 120 s rule, no profile,
# parallel submits serialised), the boards (week / last / all: order, mine, me, countries, totals, boundaries, no Telegram id,
# the null token), rights (RLS, no table access, internal helpers closed) and re-running the file. Local database only.
import os, json, uuid, threading, datetime
import psycopg2
DSN = dict(host='127.0.0.1', dbname='postgres', user='postgres', password='pg')
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
check('a refused name stores nothing', pget(tc) == {})
GOOD = {'Ab1': 'Ab1', 'x' * 16: 'x' * 16, 'Jürgen_1-x': 'Jürgen_1-x', 'Bo    Bo': 'Bo Bo', '名前です': '名前です',
        'Иван 2': 'Иван 2', '١٢٣': '١٢٣'}
wrong = [(n, r) for n, want in GOOD.items() if (r := pset(td, n, 'GE')) != {'ok': True, 'name': want, 'country': 'GE'}]
check('good names accepted: 3 and 16 characters, letters of any script, digits, _ and -, inner spaces collapsed', not wrong, wrong)
q('delete from hg_profiles where tg_id = %s', D)   # D plays the player without a profile below
r = pset(tb, 'ბექა', 'GE')
check('a Georgian name', r == {'ok': True, 'name': 'ბექა', 'country': 'GE'}, r)
wrong = [n for n in ('ANN', 'ann', ' aNn ') if pset(tc, n, 'US') != {'error': 'name_taken'}]
check('a taken name, ignoring case, is refused', not wrong, wrong)
check('a refused taken name stores nothing', pget(tc) == {})
check('a name taken in another script ignores case too (Cyrillic)', pset(te, 'Иван', 'US')['ok'] and pset(tc, 'иван', 'US') == {'error': 'name_taken'})
check('my own name in another case is mine to keep', pset(ta, 'ANN', 'GE') == {'ok': True, 'name': 'ANN', 'country': 'GE'} and pget(ta)['name'] == 'ANN')
check('changing my name back', pset(ta, 'Ann', 'GE')['ok'] and pget(ta) == {'name': 'Ann', 'country': 'GE'})
check('a rename frees the old name', pset(te, 'Eve', 'US')['ok'] and pset(tc, 'ИВАН', 'US')['ok'] and pset(tc, 'Cat', 'US')['ok'])
wrong = [c for c in ('ge', 'GEO', 'G1', 'G', '', None, 'g e', 'ÄÖ') if pset(ta, 'Ann', c) != {'error': 'bad_country'}]
check('bad countries refused (lowercase, three letters, digit, one letter, empty, null, non-ASCII)', not wrong, wrong)
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
R0 = {'god': 'thor', 'banked': 300, 'rank': 1, 'heroes': 8, 'robs': 3, 'lost': 40, 'minted': 1200, 'day': '2026-11-23'}
DROP = object()
def rnd(**ch):
    r = dict(R0); r.update(ch); return {k: v for k, v in r.items() if v is not DROP}
def sub(t, r): return P('hg_round_submit', token=t, r=None if r is None else json.dumps(r))
def back(pid, s): q(f"update hg_rounds set at = at - interval '{s} seconds' where tg_id = %s", pid)
check('submit with an unknown token: auth', sub(BAD, rnd()) == {'error': 'auth'})
check('submit without a profile: no_profile', sub(td, rnd()) == {'error': 'no_profile'})
BADR = [rnd(banked=1201), rnd(banked=-1), rnd(minted=0, banked=0), rnd(minted=1501, banked=10), rnd(rank=0), rnd(rank=9),
        rnd(heroes=1, rank=1), rnd(heroes=33, rank=1), rnd(robs=-1), rnd(lost=-1), rnd(robs=10 ** 12), rnd(god='zeus'), rnd(god='Thor'),
        rnd(god=DROP), rnd(god=5), rnd(banked=1.5), rnd(banked='300'), rnd(banked=None), rnd(banked=DROP), rnd(rank=True),
        rnd(minted=DROP), rnd(heroes=DROP), rnd(lost=DROP), rnd(day='x' * 17), rnd(day=20261123), rnd(day=['x'])]
wrong = [r for r in BADR if sub(ta, r) != {'error': 'bad_round'}]
check(f'bad rounds refused ({len(BADR)}: bounds, rank > heroes, unknown god, not whole numbers, strings, missing fields, long day)', not wrong, wrong)
wrong = [r for r in (None, [1, 2], 'round', 7) if sub(ta, r) != {'error': 'bad_round'}]
check('a round that is not an object is refused', not wrong, wrong)
check('refused rounds store nothing', q1('select count(*) from hg_rounds') == 0)
r = sub(ta, rnd())
check('submit ok, with my week after the round', r == {'ok': True, 'week': {'total': 300, 'best': 300, 'rounds': 1, 'rank': 1}}, r)
row = q('select god, banked, rank, heroes, robs, lost, minted, day from hg_rounds where tg_id = %s', A)
check('the stored round is what was sent', row == [('thor', 300, 1, 8, 3, 40, 1200, '2026-11-23')], row)
check('a second round at once: too_fast', sub(ta, rnd(banked=100)) == {'error': 'too_fast'})
back(A, 110)
check('110 s later: still too_fast', sub(ta, rnd(banked=100)) == {'error': 'too_fast'})
back(A, 11)
r = sub(ta, rnd(banked=100, god='hermes', day=DROP, minted=100, rank=8))
wk = q("select sum(banked), max(banked), count(*) from hg_rounds where tg_id = %s and at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc'", A)[0]
check('121 s later: ok, the week sums both rounds', r == {'ok': True, 'week': {'total': wk[0], 'best': wk[1], 'rounds': wk[2], 'rank': 1}} and wk[2] >= 1, (r, wk))
check('banked equal to minted is fine, a missing day is stored as null', q('select banked, minted, day from hg_rounds where tg_id = %s order by id desc limit 1', A) == [(100, 100, None)])
check('too_fast counts from the newest round', sub(ta, rnd()) == {'error': 'too_fast'})
back(A, 121)
check('a null day, 32 heroes, rank 32, the 1500 cap', sub(ta, rnd(day=None, heroes=32, rank=32, minted=1500, banked=1500, god='amirani')).get('ok') is True)
back(A, 121)
check('loki, nothing banked', sub(ta, rnd(god='loki', banked=0, robs=0, lost=0)).get('ok') is True)
check('every accepted round is one row', q1('select count(*) from hg_rounds where tg_id = %s', A) == 4)
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

# --- boards: rounds placed this week, last week (Monday to Monday, UTC) and two weeks ago, by moving `at`
q('delete from hg_rounds')
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
for pid, bk, at, _ in rows:
    q("insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted, day, at) values (%s, 'thor', %s, 1, 8, 0, 0, 1500, null, %s)", pid, bk, at)
def expect(scope, me):
    agg = {}
    for pid, bk, _, b in rows:
        if scope == 'all' or b == scope:
            t = agg.setdefault(pid, [0, 0, 0]); t[0] += bk; t[1] = max(t[1], bk); t[2] += 1
    order = sorted(agg, key=lambda p: (-agg[p][0], -agg[p][1], prof[p][0].lower()))
    players = [{'name': prof[p][0], 'country': prof[p][1], 'total': agg[p][0], 'best': agg[p][1], 'rounds': agg[p][2], 'mine': p == me} for p in order[:20]]
    mine = {'rank': order.index(me) + 1, 'total': agg[me][0], 'best': agg[me][1], 'rounds': agg[me][2]} if me in agg else None
    cs = {}
    for p in order:
        t = cs.setdefault(prof[p][1], [0, 0, 0]); t[0] += 1; t[1] += agg[p][2]; t[2] += agg[p][0]
    countries = [{'country': c, 'players': v[0], 'rounds': v[1], 'gold': v[2]} for c, v in sorted(cs.items(), key=lambda x: (-x[1][2], -x[1][0], x[0]))]
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
b = board(tok[FILL[17]], 'week')
check('me beyond the top 20: rank 23, no row marked mine', b['me'] == {'rank': 23, 'total': 5, 'best': 5, 'rounds': 1} and not any(x['mine'] for x in b['players']), b['me'])
for t, what in ((None, 'a null token'), (BAD, 'an unknown token')):
    for sc in ('week', 'last', 'all'):
        b = board(t, sc)
        check(f'board {sc} with {what}: me null, nothing mine, the same list', b['me'] is None and not any(x['mine'] for x in b['players'])
              and [dict(x, mine=False) for x in got[sc]['players']] == b['players'] and b['countries'] == got[sc]['countries'], b['me'])
check('board for a player without a profile: me null', board(td, 'week')['me'] is None)
pset(td, 'Dan', 'GE')
check('board for a player with a profile and no rounds: me null (week, last, all)', all(board(td, sc)['me'] is None for sc in ('week', 'last', 'all')))
b = board(ta, 'month')
check('an unknown scope reads as week', b['scope'] == 'week' and b['players'] == w['players'] and b['since'] == iso(mon))
check('a null scope reads as week, ALL in capitals as all', board(ta, None)['scope'] == 'week' and board(ta, 'ALL')['players'] == a['players'])
r = sub(td, rnd(banked=95))
check('submit: my week equals my row on the week board', r.get('ok') is True and r['week'] == board(td, 'week')['me'] and r['week']['rank'] == 6, (r, board(td, 'week')['me']))
b = call('authenticated', 'hg_board', token=ta, scope='week')
check('authenticated may call the board too', b['me']['rank'] == 2)

# --- no Telegram id anywhere
blob = json.dumps(seen, ensure_ascii=False)
check(f'no Telegram id in any of the {len(seen)} answers', 'tg_id' not in blob and not any(str(p) in blob for p in ALL))

# --- rights
check('anon and authenticated hold no right on the tables', q1("select bool_or(has_table_privilege(r, t, p)) from unnest(array['anon', 'authenticated']) r, "
      "unnest(array['hg_profiles', 'hg_rounds']) t, unnest(array['select', 'insert', 'update', 'delete']) p") is False)
def denied(sql, role='anon'):
    with db.cursor() as c:
        c.execute(f'set role {role}')
        try: c.execute(sql); return False
        except psycopg2.Error: return True
        finally: c.execute('reset role')
check('anon and authenticated cannot read or write the tables', all(denied(s, role) for role in ('anon', 'authenticated') for s in (
    'select * from hg_profiles', 'select * from hg_rounds', f"insert into hg_rounds (tg_id, god, banked, rank, heroes, robs, lost, minted) values ({A}, 'thor', 1, 1, 8, 0, 0, 1)",
    f"update hg_profiles set name = 'x' where tg_id = {A}", "select nextval('hg_rounds_id_seq')")))
check('the internal helpers are closed to anon (hg_ranked holds tg_id)', 'permission denied' in (refused('hg_ranked', t0='-infinity', t1='infinity') or '')
      and 'permission denied' in (refused('hg_int', j='{"a": 1}', k='a') or ''))
fx = q("select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute') "
       "from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hg\\_%%' order by 1")
api = {r[0]: r[1:] for r in fx}
check('the four calls: security definer, search_path = public, execute for anon and authenticated',
      all(api.get(f) == (True, ['search_path=public'], True, True) for f in ('hg_board', 'hg_profile_get', 'hg_profile_set', 'hg_round_submit')), api)
check('RLS on, no policies', q("select bool_and(relrowsecurity) from pg_class where relname in ('hg_profiles', 'hg_rounds')") == [(True,)]
      and q1("select count(*) from pg_policies where tablename in ('hg_profiles', 'hg_rounds')") == 0)

# --- re-running the file changes nothing
before = (q('select tg_id, name, country, created_at from hg_profiles order by tg_id'), q('select * from hg_rounds order by id'), board(ta, 'all'), board(ta, 'last'))
load(); load()
after = (q('select tg_id, name, country, created_at from hg_profiles order by tg_id'), q('select * from hg_rounds order by id'), board(ta, 'all'), board(ta, 'last'))
check('re-running the file twice keeps every profile, round and board', before == after)
check('re-running: one function per name, the same indexes', [r[0] for r in fx] == [r[0] for r in q("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'hg\\_%%' order by 1")]
      and len(fx) == 6 and q1("select count(*) from pg_indexes where tablename = 'hg_profiles'") == 2 and q1("select count(*) from pg_indexes where tablename = 'hg_rounds'") == 3)
back(A, 300)
check('re-running: the calls still work', sub(ta, rnd(banked=10)).get('ok') is True and pget(ta) == {'name': 'Ann', 'country': 'GE'})
print('g1:', 'ALL OK' if not fails else 'FAILED ' + str(len(fails)))
raise SystemExit(1 if fails else 0)
