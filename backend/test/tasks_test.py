# v1.0.76 end to end: the Tasks tab on a managed seat (the beta build against the local backend v20), real taps.
# Quests claimed from the tab, a social link (open → wait → claim), a friend task, the event badge and popup, the JS schedule = the SQL schedule.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/tasks_test.py   (fakerest.py running)
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
FR = 777000124
q('delete from referrals where inviter = %s or invitee = %s', TG, TG); q('delete from task_marks where tg_id = %s', TG)
q('delete from referrals where invitee = %s', FR); q('delete from players where tg_id = %s', FR)
for t in ('payments', 'ad_views', 'duels', 'ratings', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where ' + ('a' if t == 'duels' else 'tg_id') + ' = %s', TG)
CAL = q1("select v from econ_config where k = 'calendar'")
INIT = open(HERE + '/init.txt').read()
MOCK = """window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){},openTelegramLink(u){window.__opened=u},openLink(u){window.__opened=u}}};""" % json.dumps(INIT)
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
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1,earn:1,tasks:1};a.learn={chest:1,hold:1,champ:1,glass:1,keep:1,tier2:1,fire:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    q("update wallets set gold = 5000, gems = 100 where tg_id = %s and seat = 0", TG)
    ev("HOLDOR_ECON.ecoRefresh&&HOLDOR_ECON.ecoRefresh()"); pg.wait_for_timeout(1000); settle()
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(1200); settle()
    check('the bottom bar has Tasks, and no Earn or Events tab', ev("!!document.querySelector('.hubtabs button[data-tab=\"tasks\"]')") and ev("!document.querySelector('.hubtabs button[data-tab=\"earn\"]')") and ev("!document.querySelector('.hubtabs button[data-tab=\"events\"]')") and ev("document.querySelectorAll('.hubtabs button').length") == 5)
    check('a badge for the event on the home screen, with a countdown', wait("!!document.querySelector('#evBadge')", 3000) and ':' in ev("document.querySelector('#evBadge em').textContent"))
    ev("localStorage.removeItem('holdor_ev')"); ev("HOLDOR_EARN.evPopup(true)"); pg.wait_for_timeout(500)
    check('the popup: name of the event, live countdown', ev("!!document.querySelector('#evCd')") and len(ev("document.querySelector('#evCd').textContent")) > 8)
    tap('#ecoModal button[data-i="1"]', 400)
    stamps = ['2026-09-28 00:00+00', '2026-09-29 23:59+00', '2026-09-30 12:00+00', '2026-10-01 23:00+00', '2026-10-02 00:00+00', '2026-10-03 23:59+00', '2026-10-04 12:00+00', '2026-10-05 00:00+00']
    same = True
    for t in stamps:
        srv = q("select kind, active, (extract(epoch from t0) * 1000)::bigint, (extract(epoch from t1) * 1000)::bigint from ev_at(%s)", t)[0]
        js = ev("(t=>{const e=HOLDOR_EARN.evAt(Date.parse(t));return [e.kind,e.active,e.t0,e.t1]})('%s')" % t.replace(' ', 'T').replace('+00', 'Z'))
        if [srv[0], srv[1], srv[2], srv[3]] != js: same = False; print('  schedule differs at', t, srv, js)
    check('the schedule in the app = the server rule (Quest Rush Mon–Tue, Cup Fri–Sat)', same and ev("HOLDOR_EARN.evAt(Date.parse('2026-09-28T12:00Z')).kind") == 'rush')
    # ---- a quest: one won battle finishes "Win a stage" (300 gold, ×2 in Quest Rush)
    q("insert into battles (tg_id, seat, kind, stage, status, stars, kills, waves, started_at, finished_at) values (%s, 0, 'camp', 1, 'won', 3, 40, 8, now() - interval '6 minutes', now())", TG)
    rush = bool(q1("select active from ev_at(now()) where kind = 'rush'"))
    ev("HOLDOR_DAILY.DAILY.at=0")   # the home screen asked the server a moment before the battle row was written
    tap('.hubtabs button[data-tab="tasks"]', 900); settle(); wait("(()=>{const b=document.querySelector('.tkbody button[data-q=\"d_win1\"]');return b&&!b.disabled})()", 8000); pg.wait_for_timeout(600)
    check('Tasks opens on Quests: daily, weekly and monthly sections', ev("document.querySelectorAll('.tksec').length") == 3 and ev("document.querySelector('.subtabs.tks button.on').dataset.tk") == 'quests')
    check('"Win a stage" is ready, the tab carries a red number', not ev("document.querySelector('.tkbody button[data-q=\"d_win1\"]').disabled") and ev("!!document.querySelector('.subtabs.tks button[data-tk=\"quests\"] .dot')"))
    pg.screenshot(path=SHOTS + '/tasks_quests.png')
    g0 = W()[0]
    tap('.tkbody button[data-q="d_win1"]', 900); settle(); pg.wait_for_timeout(500)
    check('claimed by tap: the gold is on the server%s' % (' (×2, Quest Rush)' if rush else ''), W()[0] - g0 == (600 if rush else 300), W()[0] - g0)
    check('the app balance equals the server', ev("HOLDOR.ACC.gold") == W()[0], (ev("HOLDOR.ACC.gold"), W()[0]))
    check('the quest shows done', wait("(()=>{const b=document.querySelector('.tkbody button[data-q=\"d_win1\"]');return b&&b.disabled&&b.textContent.includes('✔')})()", 4000))
    # ---- social: no links yet → only the share task; the owner fills the channel link → it shows up
    tap('.subtabs.tks button[data-tk="social"]', 900); settle(); pg.wait_for_timeout(500)
    check('social: only the share task while the links are empty', ev("document.querySelectorAll('.tkbody button[data-o]').length") == 1 and ev("!!document.querySelector('.tkbody button[data-o=\"share\"]')"))
    q("""update econ_config set v = jsonb_set(v, '{list}', (select jsonb_agg(case when x->>'id' = 'tg_channel' then x || '{"url":"https://t.me/holdor_test"}'::jsonb else x end) from jsonb_array_elements(v->'list') x)) where k = 'tasks'""")
    ev("HOLDOR_TASKS.TASKS.st=null"); ev("HOLDOR.showHub('tasks')"); wait("!!document.querySelector('.tkbody button[data-o=\"tg_channel\"]')", 8000); pg.wait_for_timeout(400)
    check('the channel task shows up with a Go button', ev("!!document.querySelector('.tkbody button[data-o=\"tg_channel\"]')"))
    tap('.tkbody button[data-o="tg_channel"]', 1200); settle(); pg.wait_for_timeout(500)
    check('Go opens the link inside Telegram and the server marks it opened', ev("window.__opened") == 'https://t.me/holdor_test' and q1("select count(*) from task_marks where tg_id = %s and id = 'tg_channel' and opened_at is not null", TG) == 1)
    w1 = ev("(document.querySelector('.tkbody button[data-w]')||{}).textContent||''"); pg.wait_for_timeout(2100)
    w2 = ev("(document.querySelector('.tkbody button[data-w]')||{}).textContent||''")
    check('the button counts down the ten seconds', w1.startswith('⏳') and w2.startswith('⏳') and w1 != w2, (w1, w2))
    pg.screenshot(path=SHOTS + '/tasks_social.png')
    q("update task_marks set opened_at = now() - interval '11 seconds' where tg_id = %s", TG)
    check('after the wait the button turns into Claim by itself', wait("!!document.querySelector('.tkbody button[data-c=\"tg_channel\"]')", 12000))
    m0 = W()[1]
    tap('.tkbody button[data-c="tg_channel"]', 900); settle(); pg.wait_for_timeout(400)
    check('claimed: +50 dragonglass on the server and in the app', W()[1] - m0 == 50 and ev("HOLDOR.ACC.gems") == W()[1], (W()[1] - m0, ev("HOLDOR.ACC.gems")))
    # ---- friends: a friend joined through the link
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, 'Fred', 'stark', 0, '{}', 1)", FR)
    q("insert into referrals (invitee, inviter) values (%s, %s)", FR, TG)
    ev("HOLDOR_TASKS.TASKS.st=null"); tap('.subtabs.tks button[data-tk="friends"]', 1200); settle(); wait("!!document.querySelector('.tkbody button[data-c=\"friend1\"]')", 8000); pg.wait_for_timeout(600)
    check('friends: the friend task is ready and the invitation block is there', ev("!!document.querySelector('.tkbody button[data-c=\"friend1\"]')") and ev("!!document.querySelector('.invbox')"), ev("document.querySelector('.tkbody').innerText")[:200])
    pg.screenshot(path=SHOTS + '/tasks_friends.png')
    m0 = W()[1]
    tap('.tkbody button[data-c="friend1"]', 900); settle(); pg.wait_for_timeout(400)
    check('claimed: +40 dragonglass', W()[1] - m0 == 40)
    check('the estate is gone from the app', ev("typeof window.HOLDOR_EARN.earnCall") == 'undefined' and not ev("!!document.querySelector('.ebld,.collectbox')"))
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(600)
    check('no refusals, no flags', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0)
    check('no page errors', not errs, errs[:3])
    br.close()
q("""update econ_config set v = jsonb_set(v, '{list}', (select jsonb_agg(case when x->>'id' = 'tg_channel' then x || '{"url":""}'::jsonb else x end) from jsonb_array_elements(v->'list') x)) where k = 'tasks'""")
q('delete from referrals where invitee = %s', FR); q('delete from players where tg_id = %s', FR)
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
