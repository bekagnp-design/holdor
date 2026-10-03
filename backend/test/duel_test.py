# v1.0.67 end to end: the Duel screen on a managed seat (the beta build against the local backend v15), real taps.
# Ranked / practice / friend duels, the league, results counted from the server's own Hold battles.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/daily_test.py   (fakerest.py running)
import os, json, psycopg2
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SHOTS = os.path.join(ROOT, '.shots'); os.makedirs(SHOTS, exist_ok=True)
TG = 777000123
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c:
        c.execute(sql, a or None); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return (r[0][0] if len(r[0]) == 1 else r[0]) if r else None
for t in ('duels', 'ratings', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where ' + ('a' if t == 'duels' else 'tg_id') + ' = %s', TG)
CAL = q1("select v from econ_config where k = 'calendar'")
INIT = open(HERE + '/init.txt').read()
MOCK = """window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){}}};""" % json.dumps(INIT)
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, info)
    if not cond: fails.append(name)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    pg = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True).new_page(); errs = []
    pg.on('pageerror', lambda x: errs.append(str(x)))
    pg.add_init_script(MOCK); pg.goto('file://' + HERE + '/index_test.html')
    ev = pg.evaluate
    def wait(js, ms=10000):
        for _ in range(ms // 100):
            v = ev(js)
            if v: return v
            pg.wait_for_timeout(100)
        return None
    def settle():
        ok = wait("(()=>{const E=HOLDOR_ECON.ECO;return !E.q.length&&!E.fly.length&&!E.fin&&!E.n&&!E.busyB&&!E.busyC&&!E.starting&&!document.querySelector('#ecoWait.on')})()", 15000)
        pg.wait_for_timeout(300); return ok
    def tap(sel, ms=400): pg.locator(sel).first.tap(force=True); pg.wait_for_timeout(ms)
    def W(): return q("select gold, gems, cards from wallets where tg_id = %s and seat = 0", TG)[0]
    check('login', wait("HOLDOR.CLOUD.on", 12000))
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1,earn:1,hold:1};a.learn={chest:1,hold:1,champ:1,glass:1,keep:1,tier2:1,fire:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    q("update wallets set created_at = now() - interval '3 days' where tg_id = %s and seat = 0", TG)

    ev("HOLDOR_DAILY.DAILY.shown=true")
    for st in range(1, 5): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", TG, st)
    q("update battles set finished_at = finished_at - interval '30 days' where kind = 'hold' and tg_id <> %s", TG)
    ev("HOLDOR_ECON.ecoRefresh&&HOLDOR_ECON.ecoRefresh()"); pg.wait_for_timeout(800); settle()
    ev("HOLDOR.ACC.campaign={1:3,2:3,3:3,4:3}"); ev("HOLDOR.showHub('events')"); pg.wait_for_timeout(600)
    check('the Events tab has a Duel card, live', wait("!!document.querySelector('.evcard[data-ev=\"duel\"]')", 4000) and 'LIVE' in ev("document.querySelector('.evcard[data-ev=\"duel\"] .st').textContent"))
    tap('.evcard[data-ev="duel"]', 800); settle(); ev("HOLDOR_DUEL.DUEL.st=null"); ev("HOLDOR_DUEL.showDuel()"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(400)
    check('the Duel screen: Bronze, 1000, three ways to duel, ranked 5 left', 'Bronze' in ev("document.querySelector('.lg').textContent") and '1000' in ev("document.querySelector('.lg').textContent") and '5 left' in ev("document.querySelector('#bRank').textContent"))
    pg.screenshot(path=SHOTS + '/duel_home.png')
    tap('#bAi', 700); settle(); pg.wait_for_timeout(500)
    check('practice vs a bot: an open duel marked as a bot, 6 waves to beat', ev("document.querySelectorAll('.duelrow').length") == 1 and 'Bot' in ev("document.querySelector('.duelrow').textContent") and '6 🌊' in ev("document.querySelector('.duelrow').textContent") and ev("!!document.querySelector('[data-play]')"))
    pg.screenshot(path=SHOTS + '/duel_open.png')
    g0 = W()[0]
    q("insert into battles (tg_id, seat, kind, status, waves, kills, steps, started_at, finished_at) values (%s, 0, 'hold', 'done', 9, 150, 5000, now() - interval '10 minutes', now())", TG)
    ev("HOLDOR_DUEL.DUEL.st=null"); ev("HOLDOR_DUEL.showDuel()"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(400)
    check('a Hold run of 9 waves beats the bot: a WIN, 100 gold from the server', 'WIN' in ev("document.querySelector('.duelrow').textContent") and W()[0] - g0 == 100, W()[0] - g0)
    check('the app balance equals the server', ev("HOLDOR.ACC.gold") == W()[0], (ev("HOLDOR.ACC.gold"), W()[0]))
    tap('#bFriend', 700); settle(); pg.wait_for_timeout(500)
    check('a friend challenge: a link with startapp=d_ and a share button', 'startapp=d_' in ev("document.querySelector('.reflink').textContent") and ev("!!document.querySelector('[data-share]')"))
    pg.screenshot(path=SHOTS + '/duel_friend.png')
    check('rating is untouched by practice and friends', q1("select count(*) from ratings where tg_id = %s and rating <> 1000", TG) == 0)
    # a challenge link opened by the player himself is remembered until a seat is open
    ev("HOLDOR_DUEL.DUEL.pending='0123abcd'"); ev("HOLDOR_DUEL.showDuel()"); pg.wait_for_timeout(1200)
    check('a pending challenge is tried once and the answer shows (unknown code → a toast, no crash)', ev("HOLDOR_DUEL.DUEL.pending") is None)
    # ---- v1.0.75: a friend's link (the case MR B could not play) ----
    FR = 777000125
    for t in ('duels', 'ratings', 'battles', 'progress', 'sessions', 'ledger', 'wallets', 'players'):
        q(f'delete from {t} where ' + ('a' if t == 'duels' else 'tg_id') + ' = %s', FR)
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Friend', 'stark', 0, %s, 1)", FR, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [{'house': 'stark', 'langI': 0, 'made': '2026-09-30', 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}, None, None]}))
    ftok = q1("insert into sessions (tg_id) values (%s) returning token::text", FR)
    q("select econ_state(%s::uuid, 0)", ftok); q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', 1, 3)", FR)
    code = q1("select (duel_start(%s::uuid, 0, 'friend'))->'duel'->>'code'", ftok)
    ev("HOLDOR_DUEL.DUEL.pending=%s; HOLDOR_DUEL.DUEL.st=null" % json.dumps(code)); ev("HOLDOR.showHub('battle')")
    check('the link opens the Duel screen by itself and joins the friend', wait("HOLDOR.CLOUD.screen==='duel'", 6000) is not None and wait("!HOLDOR_DUEL.DUEL.pending", 3000) is not None, ev("HOLDOR.CLOUD.screen"))
    settle(); ev("HOLDOR_DUEL.DUEL.st=null"); ev("HOLDOR_DUEL.showDuel()"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(400)
    check('the server has me as the friend\'s opponent', q1("select b from duels where code = %s", code) == TG)
    row = ev("[...document.querySelectorAll('.duelrow')].map(r=>r.innerText).find(t=>/Friend/.test(t))||''")
    check('the row says what each side still has to do: me — play a Hold run, the friend — not played yet', 'play a Hold run' in row and 'not played yet' in row, row.replace('\n', ' | ')[:200])
    pg.screenshot(path=SHOTS + '/duel_friend_joined.png')
    check('the "Play my Hold run" button is there', ev("!!document.querySelector('[data-play]')"))
    tap('[data-play]', 1500); settle()
    check('it starts the Hold run on the server (a hold battle is open)', wait("HOLDOR.G.mode==='online'", 5000) is not None and q1("select count(*) from battles where tg_id = %s and kind = 'hold' and status = 'open'", TG) >= 1, ev("HOLDOR.G.mode"))
    ev("HOLDOR.G.state='over'"); q("update battles set status = 'done', waves = 7, kills = 90, finished_at = now() where tg_id = %s and kind = 'hold' and status = 'open'", TG)
    q("insert into battles (tg_id, seat, kind, status, waves, kills, steps, started_at, finished_at) values (%s, 0, 'hold', 'done', 5, 60, 5000, now() - interval '5 minutes', now())", FR)
    ev("HOLDOR_DUEL.DUEL.st=null"); ev("HOLDOR_DUEL.showDuel()"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(400)
    row = ev("[...document.querySelectorAll('.duelrow')].map(r=>r.innerText).find(t=>/Friend/.test(t))||''")
    check('both played: 7 waves beat 5 — a WIN for me', 'WIN' in row and '7 🌊' in row and '5 🌊' in row, row.replace('\n', ' | ')[:200])
    ev("HOLDOR.showHub('hold')"); pg.wait_for_timeout(700)
    check('the Hold tab has a Duel card that opens the Duel screen', ev("!!document.querySelector('#bDuelCard')"))
    ev("document.querySelector('#bDuelCard').click()")
    check('...and it does', wait("HOLDOR.CLOUD.screen==='duel'", 4000) is not None, ev("HOLDOR.CLOUD.screen"))
    for t in ('duels', 'battles', 'progress', 'sessions', 'ledger', 'wallets', 'players'):
        q(f'delete from {t} where ' + ('a' if t == 'duels' else 'tg_id') + ' = %s', FR)
    check('no refusals, no flags', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0)
    check('no page errors', not errs, errs[:3])
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
