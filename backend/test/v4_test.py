# v4 backend checks against the local database (see README): every call runs as the anon role, like the app.
# Needs: holdor_supabase.sql, holdor_fix1.sql, holdor_v2.sql, holdor_stats.sql, test/prod_like.sql, holdor_v3.sql,
# holdor_v4.sql loaded in that order. Re-runnable: it reloads prod_like.sql + v3 + v4 itself first.
import os, json, subprocess, datetime
import psycopg2
HERE = os.path.dirname(os.path.abspath(__file__)); BACK = os.path.dirname(HERE)
def psql_file(*files):
    sql = ''.join(open(os.path.join(BACK, f), encoding='utf-8').read() + '\n' for f in files)
    r = subprocess.run(['su', 'postgres', '-c', 'psql -q -v ON_ERROR_STOP=1 -o /dev/null'], input=sql, capture_output=True, text=True)
    if r.returncode: raise SystemExit('load failed: ' + r.stderr[-800:])
psql_file('test/prod_like.sql', 'holdor_v3.sql', 'holdor_v4.sql', 'holdor_v5.sql', 'holdor_econ_data.sql')
subprocess.run(['su', 'postgres', '-c', 'psql -q -c "delete from players where tg_id in (777000123, 555)"'], check=True)  # the browser tests' users

db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
def anon(fn, **kw):
    """call an RPC the way PostgREST does: as anon, named arguments"""
    with db.cursor() as c:
        c.execute('set role anon')
        try:
            args = ', '.join(f'{k} := %({k})s' for k in kw)
            c.execute(f'select {fn}({args})', {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in kw.items()})
            return c.fetchone()[0]
        finally:
            c.execute('reset role')
def anon_err(sql):
    with db.cursor() as c:
        c.execute('set role anon')
        try: c.execute(sql); return 'no error: ' + str(c.fetchall())[:80]
        except Exception as e: return str(e).split('\n')[0]
        finally: c.execute('reset role')
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, info if not cond or os.environ.get('V') else '')
    if not cond: fails.append(name)
def rows(tg):
    return [tuple(r) for r in q('select seat, realm, house, stars, gates, waves, kills from scores where tg_id = %s order by seat', tg)]
P1, P2, P3 = 900000001, 900000002, 900000003
today = q("select (now() at time zone 'utc')::date")[0][0]

# ---------- 1. the migration: one honest row per seat ----------
check('P1 rows', rows(P1) == [(0, 2, 'targaryen', 0, 0, 0, 0), (1, 0, 'stark', 0, 0, 0, 0)], rows(P1))
check('P2 rows', rows(P2) == [(0, 0, 'targaryen', 17, 11, 15, 890), (1, 11, 'greyjoy', 24, 16, 12, 940), (2, 3, 'targaryen', 49, 34, 26, 5045)], rows(P2))
check('P3 rows', rows(P3) == [(0, 3, 'stark', 17, 6, 13, 5783)], rows(P3))
check('old Hold days on their seats',
      q('select day::text, seat from daily_scores where tg_id = %s order by day', P2) ==
      [('2026-09-14', 2), ('2026-09-15', 0), ('2026-09-17', 1), ('2026-09-18', 2), ('2026-09-19', 2), ('2026-09-22', 2), ('2026-09-26', 2)])
lb = anon('leaderboard')
check('totals', (lb['total'], lb['players'], lb['countries']) == (6, 3, 4), (lb['total'], lb['players'], lb['countries']))
R = {r['realm']: r for r in lb['realms']}
check('realm order', [r['realm'] for r in lb['realms']] == [3, 0, 11, 2], [r['realm'] for r in lb['realms']])
check('Germany', (R[3]['players'], R[3]['seats'], R[3]['waves'], R[3]['stars'], R[3]['kills']) == (2, 2, 39, 66, 10828), R[3])
check('Georgia', (R[0]['players'], R[0]['seats'], R[0]['waves'], R[0]['stars'], R[0]['kills']) == (2, 2, 15, 17, 890), R[0])
check('Russia', (R[11]['players'], R[11]['waves'], R[11]['stars']) == (1, 12, 24), R[11])
check('China', (R[2]['players'], R[2]['waves'], R[2]['stars']) == (1, 0, 0), R[2])
check('no stars counted twice', sum(r['stars'] for r in lb['realms']) == 17 + 24 + 49 + 17)

# ---------- 2. the old app (v1.0.48): no seat, mixed numbers ----------
tok = {t: q('insert into sessions (tg_id) values (%s) returning token::text', t)[0][0] for t in (P1, P2, P3)}
sv2 = q('select save from players where tg_id = %s', P2)[0][0]
before = {r[0]: r[1] for r in q('select seat, updated_at from scores where tg_id = %s', P2)}
sv2['slots'][2]['campaign']['35'] = 1; sv2['slots'][2]['stats']['kills'] = 5145; sv2['ver'] = 456
r = anon('save_progress', token=tok[P2], save=sv2, ver=456, house='targaryen', realm=3, stars=50, gates=35, waves=26, kills=6975)
check('old save ok', r == {'ok': True, 'save_ver': 456}, r)
check('old save: seat III from the save', rows(P2)[2] == (2, 3, 'targaryen', 50, 35, 26, 5145), rows(P2))
check('old save: seats I/II untouched', rows(P2)[:2] == [(0, 0, 'targaryen', 17, 11, 15, 890), (1, 11, 'greyjoy', 24, 16, 12, 940)], rows(P2))
after = {r[0]: r[1] for r in q('select seat, updated_at from scores where tg_id = %s', P2)}
check('old save: only the played seat is "active"', after[0] == before[0] and after[1] == before[1] and after[2] > before[2])
r = anon('hold_result', token=tok[P2], day=str(today), waves=31, kills=700)
check('old Hold run ok', r and r.get('ok'), r)
check('old Hold run on seat III', q('select seat, realm, house, waves from daily_scores where tg_id = %s and day = %s', P2, today) == [(2, 3, 'targaryen', 31)])
check('old Hold run: seat III best 31, seat I unchanged', rows(P2)[2][5] == 31 and rows(P2)[0][5] == 15, rows(P2))
lb = anon('leaderboard', realm=None, me=P2)
check('old leaderboard: me = the seat being played', lb['me'] and lb['me']['seat'] == 2 and lb['me']['realm'] == 3, lb['me'])
check('old leaderboard: myday', lb['myday'] and lb['myday']['waves'] == 31, lb['myday'])
check('realm today', {r['realm']: (r['today'], r['today_players']) for r in lb['realms']}.get(3) == (31, 1))
# a save that arrives late (older version) changes nothing
sv_old = json.loads(json.dumps(sv2)); sv_old['slots'][2]['campaign'] = {}; sv_old['ver'] = 400
anon('save_progress', token=tok[P2], save=sv_old, ver=400, house='targaryen', realm=3, stars=0, gates=0, waves=0, kills=0)
check('stale save ignored', rows(P2)[2] == (2, 3, 'targaryen', 50, 35, 31, 5145), rows(P2))
# the next save carries the run: stays 31 (the server's record), never drops
sv2['slots'][2]['stats']['onlineBest'] = 31; sv2['ver'] = 457
anon('save_progress', token=tok[P2], save=sv2, ver=457, house='targaryen', realm=3, stars=50, gates=35, waves=31, kills=6975)
check('save after the run', rows(P2)[2][5] == 31, rows(P2))

# ---------- 3. the new app (v1.0.49+): seats II and III of their own ----------
sv3 = q('select save from players where tg_id = %s', P3)[0][0]
sv3['slots'][1] = {'house': 'lannister', 'langI': 4, 'made': str(today), 'campaign': {'1': 2}, 'hard': {'1': 1}, 'stats': {'kills': 40, 'onlineBest': 0}}
sv3['cur'] = 1; sv3['ver'] = 177
anon('save_progress', token=tok[P3], save=sv3, ver=177, house='lannister', realm=4, stars=3, gates=1, waves=0, kills=40, seat=1)
check('new seat II row', rows(P3) == [(0, 3, 'stark', 17, 6, 13, 5783), (1, 4, 'lannister', 3, 1, 0, 40)], rows(P3))
anon('hold_result', token=tok[P3], day=str(today), waves=9, kills=88, seat=1, house='lannister', realm=4)
card = anon('realm_card', realm=4, me=P3, seat=1)
check('realm_card Japan', (card['players'], card['seats'], card['waves'], card['stars'], card['today'], card['today_players'], card['active']) == (1, 1, 9, 3, 9, 1, 1), card)
check('realm_card me', card['me'] and card['me']['rank'] == 1 and card['me']['seat'] == 1, card['me'])
check('realm_card houses', card['houses'] == [{'house': 'lannister', 'players': 1, 'seats': 1, 'waves': 9, 'stars': 3}], card['houses'])
card = anon('realm_card', realm=3, me=P2)
check('realm_card Germany', (card['players'], card['seats'], card['waves'], card['stars']) == (2, 2, 31 + 13, 50 + 17), card)
check('realm_card Germany top', [(t['tg_id'], t['seat'], t['rank']) for t in card['top']] == [(P2, 2, 1), (P3, 0, 2)], card['top'])
check('realm_card me (old app, no seat)', card['me'] and card['me']['seat'] == 2 and card['me']['rank'] == 1, card['me'])
check('realm_card houses order', [(h['house'], h['seats'], h['waves']) for h in card['houses']] == [('targaryen', 1, 31), ('stark', 1, 13)], card['houses'])
empty = anon('realm_card', realm=150)
check('realm_card empty realm', (empty['players'], empty['seats'], empty['waves'], empty['top'], empty['houses'], empty['me']) == (0, 0, 0, [], [], None), empty)
check('realm_card bad realm', 'bad realm' in anon_err('select realm_card(999)'))
# deleting seat II takes it out of the standings (and out of today's Hold)
sv3['slots'][1] = None; sv3['cur'] = 0; sv3['ver'] = 178
anon('save_progress', token=tok[P3], save=sv3, ver=178, house='stark', realm=3, stars=17, gates=6, waves=13, kills=5783, seat=0)
check('deleted seat gone', rows(P3) == [(0, 3, 'stark', 17, 6, 13, 5783)], rows(P3))
check('deleted seat gone from today', q('select count(*) from daily_scores where tg_id = %s and day = %s', P3, today)[0][0] == 0)
check('Japan empty again', 4 not in {r['realm'] for r in anon('leaderboard')['realms']})
# a new seat in the same place does not inherit the old seat's Hold record
q("insert into daily_scores (day, tg_id, seat, name, house, realm, waves, kills, runs) values (%s, %s, 2, 'P3', 'martell', 8, 40, 400, 1)", today - datetime.timedelta(days=5), P3)
sv3['slots'][2] = {'house': 'martell', 'langI': 8, 'made': str(today), 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}; sv3['ver'] = 179
anon('save_progress', token=tok[P3], save=sv3, ver=179, house='stark', realm=3, stars=17, gates=6, waves=13, kills=5783, seat=0)
check('recreated seat starts clean', rows(P3)[1:] == [(2, 8, 'martell', 0, 0, 0, 0)], rows(P3))

# ---------- 4. bad input never breaks a save ----------
sv1 = q('select save from players where tg_id = %s', P1)[0][0]
sv1['slots'][0] = {'house': 'Targaryen<script>', 'langI': 'abc', 'made': '2026-99-99', 'campaign': {'1': 'x', '2': 99, '3': -4, '4': 2.5}, 'hard': [1, 2],
                   'stats': {'kills': 'lots', 'onlineBest': -5}}
sv1['slots'][1]['langI'] = 400; sv1['ver'] = 16
r = anon('save_progress', token=tok[P1], save=sv1, ver=16, house='stark', realm=0, stars=0, gates=0, waves=0, kills=0)
check('garbage save accepted', r == {'ok': True, 'save_ver': 16}, r)
check('garbage save values', rows(P1) == [(0, 0, 'targaryen', 3, 4, 0, 0), (1, 0, 'stark', 0, 0, 0, 0)], rows(P1))
check('hold_result bad realm param', anon('hold_result', token=tok[P1], day=str(today), waves=3, kills=5, seat=1, realm=999)['ok'] and
      q('select realm from daily_scores where tg_id = %s and day = %s and seat = 1', P1, today) == [(0,)])
check('hold_result bad score', 'bad score' in anon_err(f"select hold_result('{tok[P1]}', current_date, 501, 5)"))
check('bad session', 'bad session' in anon_err("select save_progress('00000000-0000-0000-0000-000000000000', '{}'::jsonb, 1, null, 0, 0, 0, 0, 0)"))

# ---------- 5. who may call what ----------
for sql in ["select sync_seats(900000001)", "select jint('1')", "select jday('2026-01-01')", "select seat_stats('{}'::jsonb)",
            "select realm_name(0)", "select * from v_realm_stats", "select * from v_accounts", "select * from scores", "select * from players"]:
    e = anon_err(sql)
    check('anon denied: ' + sql, 'permission denied' in e, e)
check('anon may read standings', isinstance(anon('leaderboard'), dict) and isinstance(anon('realm_card', realm=0), dict))
print('FAILS:', len(fails), fails if fails else '')
raise SystemExit(1 if fails else 0)
