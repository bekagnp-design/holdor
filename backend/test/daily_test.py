# v1.0.61 end to end: the login calendar and quests on a managed seat (the beta build against the local backend v10), real taps.
# The popup on entering the castle, the claim, the calendar screen, the quests counted from the server's battles, every number = the server's.
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
for t in ('econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', TG)
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
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};a.learn={chest:1,hold:1,champ:1,glass:1,keep:1,tier2:1,fire:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    q("update wallets set created_at = now() - interval '3 days' where tg_id = %s and seat = 0", TG)
    def battle(kind='camp', status='won', kills=50, stars=3): q("insert into battles (tg_id, seat, kind, stage, status, stars, kills, waves, started_at, finished_at) values (%s, 0, %s, 1, %s, %s, %s, 10, now() - interval '20 minutes', now() - interval '10 minutes')", TG, kind, status, stars, kills)
    ev("HOLDOR_DAILY.DAILY.st=null;HOLDOR_DAILY.DAILY.shown=false")

    # ---- the popup when the castle opens ----
    ev("HOLDOR.showHub('battle')")
    check('the Daily button is on the Battle tab', wait("!!document.querySelector('#bDaily')", 4000))
    check('a popup: day 1 of 30 with its reward', wait("/Day 1 of 30/.test((document.querySelector('#ecoModal.on')||{}).textContent||'')", 6000))
    pg.screenshot(path=SHOTS + '/daily_popup.png')
    m0 = W()[1]
    tap('#ecoModal button[data-i="0"]', 500); settle()
    check('claimed: the reward is on the server (day 1: 10 dragonglass)', W()[1] - m0 == CAL['days'][0]['gems'], (W()[1] - m0))
    check('the app shows the server balance', ev("HOLDOR.ACC.gems") == W()[1], (ev("HOLDOR.ACC.gems"), W()[1]))
    check('a thank-you with the reward', wait("(document.querySelector('#ecoModal.on')||{}).textContent.includes('Day 1')", 3000))
    tap('#ecoModal button[data-i="0"]', 400)
    check('ledger: login, day 1', q("select reason, ref, delta from ledger where tg_id = %s and reason = 'login'", TG) == [('login', '1', 10)])

    # ---- the screen ----
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(500)
    tap('#bDaily', 700)
    check('the calendar: 30 tiles, day 1 done, day 2 is today', ev("document.querySelectorAll('.cday').length") == 30 and ev("document.querySelector('.cday.done b').textContent") == '1' and ev("document.querySelector('.cday.today b').textContent") == '2')
    check('today\'s reward is already claimed (the button says so and is disabled)', ev("document.querySelector('#bLogin').disabled") and 'claimed' in ev("document.querySelector('#bLogin').textContent"))
    pg.screenshot(path=SHOTS + '/daily_calendar.png')
    # ---- quests, counted from the server's battles ----
    battle(kills=120); battle(kills=120); battle(kills=100); battle(status='lost', kills=5); battle(kind='hold', status='done', kills=10)
    tap('.subtabs button[data-t="daily"]', 300); ev("HOLDOR_DAILY.dailyLoad(true)"); settle(); ev("HOLDOR_DAILY.showDaily('daily')"); pg.wait_for_timeout(400)
    rows = ev("[...document.querySelectorAll('.qrow')].map(r=>r.querySelector('b').textContent+'|'+r.querySelector('em').textContent+'|'+(r.classList.contains('ready')?'ready':'-'))")
    check('daily quests from the server: win 1 (1/1), 300 kills (355 → 300/300), win 3 (3/3)', rows == ['Win a stage|1 / 1|ready', 'Defeat 300 of the dead|300 / 300|ready', 'Win 3 stages|3 / 3|ready'], rows)
    pg.screenshot(path=SHOTS + '/daily_quests.png')
    g0 = W()[0]
    tap('.qrow button[data-q="d_win1"]', 500); settle()
    check('a quest claimed: 300 gold on the server', W()[0] - g0 == 300, W()[0] - g0)
    tap('#ecoModal button[data-i="0"]', 400)
    check('the row shows it done and the button is off', ev("document.querySelector('.qrow.done b').textContent") == 'Win a stage' and ev("document.querySelector('.qrow.done button').disabled"))
    check('the app balance equals the server', ev("HOLDOR.ACC.gold") == W()[0], (ev("HOLDOR.ACC.gold"), W()[0]))
    b0 = W()[2].get('b:c', 0)
    tap('.qrow button[data-q="d_win3"]', 500); settle(); tap('#ecoModal button[data-i="0"]', 400)
    check('win-3 pays two Common books, in the app too', W()[2].get('b:c', 0) - b0 == 2 and ev("HOLDOR.ACC.cards['b:c']||0") == W()[2].get('b:c', 0), W()[2])
    tap('.subtabs button[data-t="weekly"]', 500)
    check('weekly quests are listed with a reset time', ev("document.querySelectorAll('.qrow').length") == 4 and 'Resets in' in ev("document.querySelector('.m').textContent"))
    # ---- the Battle tab tells how many are waiting ----
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(600); ev("HOLDOR_DAILY.dailyLoad(true)"); settle(); ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(700)
    check('the button shows what is ready (a red number: the kills quest)', ev("(document.querySelector('#bDaily .dot')||{}).textContent") == '1', ev("document.querySelector('#bDaily').textContent"))
    check('ledger = wallet (gold and gems)', q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gold'", TG) == W()[0] and q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gems'", TG) == W()[1])
    # ---- v1.0.65: the Levels tab (milestone gifts) ----
    need10 = sum(15 + 8 * k + k * k for k in range(1, 10))
    q("update wallets set xp = %s where tg_id = %s and seat = 0", need10, TG); ev("HOLDOR_DAILY.DAILY.ms=null"); ev("HOLDOR_DAILY.showDaily('levels')"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(500)
    rows = ev("[...document.querySelectorAll('.qrow')].map(r=>r.querySelector('b').textContent+'|'+(r.classList.contains('ready')?'ready':'-'))")
    check('Levels tab: six milestones from the server, level 10 ready, the rest closed', len(rows) == 6 and rows[0] == 'Account level 10|ready' and all(r.endswith('|-') for r in rows[1:]), rows)
    pg.screenshot(path=SHOTS + '/levels_tab.png')
    g1, i1 = W()[1], q1("select count(*) from items where tg_id = %s", TG)
    tap('.qrow button[data-m="10"]', 500); settle()
    check('level 10 claimed: 30 dragonglass and one item on the server', W()[1] - g1 == 30 and q1("select count(*) from items where tg_id = %s", TG) == i1 + 1, (W()[1] - g1))
    tap('#ecoModal button[data-i="0"]', 400)
    check('the row is done and the app balance equals the server', ev("document.querySelector('.qrow.done b').textContent") == 'Account level 10' and ev("HOLDOR.ACC.gems") == W()[1], (ev("HOLDOR.ACC.gems"), W()[1]))
    # ---- v1.0.74: the invitations, in the Earn tab ----
    FR = 777000124
    q("delete from referrals where invitee = %s", FR); q("delete from progress where tg_id = %s", FR); q("delete from players where tg_id = %s", FR)
    ev("HOLDOR_DAILY.DAILY.fr=null"); ev("HOLDOR_EARN.EARN.st=null"); ev("HOLDOR.showHub('earn')"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(500)
    mycode = q1("select ref_code from players where tg_id = %s", TG)
    check('Earn tab, Invite friends: the box is there, my code is the server\'s, nobody has joined', ev("!!document.querySelector('.invbox')") and ev("HOLDOR_DAILY.DAILY.fr.code") == mycode and 'Nobody has joined' in ev("document.querySelector('.invbox').innerText") and ev("!!document.querySelector('#bInvShare')"))
    pg.screenshot(path=SHOTS + '/invite_tab.png')
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Friend', 'stark', 0, '{}', 1)", FR)
    q("insert into referrals (invitee, inviter) values (%s, %s)", FR, TG)
    for st in range(1, 4): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3)", FR, st)
    ev("HOLDOR_DAILY.DAILY.fr=null"); ev("HOLDOR_EARN.EARN.st=null"); ev("HOLDOR.showHub('earn')"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(500)
    check('a friend with 3 of 5 stages: a progress bar, no claim yet', 'Friend' in ev("document.querySelector('.qrow b').textContent") and '3 / 5' in ev("document.querySelector('.qrow em').textContent") and ev("document.querySelector('.qrow button').disabled"))
    for st in (4, 5): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3)", FR, st)
    ev("HOLDOR_DAILY.DAILY.fr=null"); ev("HOLDOR_EARN.EARN.st=null"); ev("HOLDOR.showHub('earn')"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(500)
    g2, r2 = W()[1], W()[2].get('b:r', 0)
    tap('.qrow button[data-f]', 500); settle()
    check('5 of 5: the claim pays 60 dragonglass and a Rare book, once', W()[1] - g2 == 60 and W()[2].get('b:r', 0) - r2 == 1, (W()[1] - g2))
    tap('#ecoModal button[data-i="0"]', 400)
    check('the row is done', ev("document.querySelector('.qrow.done button').disabled"))
    check('the app balance equals the server (gems and gold)', ev("HOLDOR.ACC.gems") == W()[1] and ev("HOLDOR.ACC.gold") == W()[0])
    q("delete from referrals where invitee = %s", FR); q("delete from progress where tg_id = %s", FR); q("delete from players where tg_id = %s", FR)
    check('no refusals, no flags', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0)
    check('no page errors', not errs, errs[:3])
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
