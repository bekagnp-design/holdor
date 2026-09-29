# v1.0.74 end to end: the Earn tab (the estate) and the two-day events on a managed seat (the beta build against the local backend v18), real taps.
# Build and upgrade with gold, collect the pile, the account-level gate, the event badge and popup, the JS schedule = the SQL schedule.
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
for t in ('payments', 'ad_views', 'duels', 'ratings', 'econ_flags', 'econ_ops', 'ledger', 'battles', 'progress', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
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
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};a.learn={chest:1,hold:1,champ:1,glass:1,keep:1,tier2:1,fire:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    def need(l): return sum(15 + 8 * k + k * k for k in range(1, l))
    q("update wallets set xp = %s, gold = 5000 where tg_id = %s and seat = 0", need(3), TG)
    ev("HOLDOR_EARN.EARN.st=null"); ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(1200); settle()
    check('the bottom bar has Earn and no Events tab', ev("!!document.querySelector('.hubtabs button[data-tab=\"earn\"]')") and ev("!document.querySelector('.hubtabs button[data-tab=\"events\"]')") and ev("document.querySelectorAll('.hubtabs button').length") == 5)
    check('a badge for the event on the home island, with a countdown', wait("!!document.querySelector('#evBadge')", 3000) and ':' in ev("document.querySelector('#evBadge em').textContent"))
    ev("localStorage.removeItem('holdor_ev')"); ev("HOLDOR_EARN.evPopup(true)"); pg.wait_for_timeout(500)
    check('the popup: name of the event, live countdown, a button to go, Later', ev("!!document.querySelector('#evCd')") and len(ev("document.querySelector('#evCd').textContent")) > 8)
    c1 = ev("document.querySelector('#evCd').textContent"); pg.wait_for_timeout(2200)
    check('the countdown runs', ev("document.querySelector('#evCd').textContent") != c1, c1)
    pg.screenshot(path=SHOTS + '/event_popup.png')
    tap('#ecoModal button[data-i="1"]', 400)
    # the schedule in the app equals the schedule on the server
    stamps = ['2026-09-28 00:00+00', '2026-09-29 23:59+00', '2026-09-30 12:00+00', '2026-10-01 23:00+00', '2026-10-02 00:00+00', '2026-10-03 23:59+00', '2026-10-04 12:00+00', '2026-10-05 00:00+00']
    same = True
    for t in stamps:
        srv = q("select kind, active, (extract(epoch from t0) * 1000)::bigint, (extract(epoch from t1) * 1000)::bigint from ev_at(%s)", t)[0]
        js = ev("(t=>{const e=HOLDOR_EARN.evAt(new Date(t).getTime());return [e.kind,e.active,e.t0,e.t1]})('%s')" % t.replace(' ', 'T').replace('+00', ':00Z') if False else "(t=>{const e=HOLDOR_EARN.evAt(Date.parse(t));return [e.kind,e.active,e.t0,e.t1]})('%s')" % t.replace(' ', 'T').replace('+00', 'Z'))
        if [srv[0], srv[1], srv[2], srv[3]] != js: same = False; print('  schedule differs at', t, srv, js)
    check('the schedule in the app = the server rule (8 moments)', same)
    tap('.hubtabs button[data-tab="earn"]', 900); settle(); pg.wait_for_timeout(700)
    check('the Earn tab: nine buildings, the farm is open (account level 3), the rest are locked', ev("document.querySelectorAll('.ebld').length") == 9 and ev("!document.querySelector('.ebld[data-b=\"farm\"]').classList.contains('lock')") and ev("document.querySelectorAll('.ebld.lock').length") == 8)
    check('nothing to collect yet', ev("document.querySelector('#bCollect').disabled"))
    pg.screenshot(path=SHOTS + '/earn_tab.png')
    tap('.ebld[data-b="quarry"]', 400)
    check('a locked building only says so (no modal)', not ev("!!document.querySelector('#ecoModal.on')"))
    g0 = W()[0]
    tap('.ebld[data-b="farm"]', 500)
    check('the confirm sheet says the cost (800) and how long it takes to pay back (40 h)', '800' in ev("document.querySelector('#ecoModal').innerText") and '40 hours' in ev("document.querySelector('#ecoModal').innerText"), ev("document.querySelector('#ecoModal').innerText")[:120])
    pg.screenshot(path=SHOTS + '/earn_build.png')
    tap('#ecoModal button[data-i="0"]', 700); settle(); pg.wait_for_timeout(600)
    check('built: 800 gold left the wallet on the server, the farm is level 1 with +20/h', g0 - W()[0] == 800 and 'Lv 1' in ev("document.querySelector('.ebld[data-b=\"farm\"]').innerText") and '+20/h' in ev("document.querySelector('.ebld[data-b=\"farm\"]').innerText"), (g0 - W()[0]))
    check('the app balance equals the server', ev("HOLDOR.ACC.gold") == W()[0], (ev("HOLDOR.ACC.gold"), W()[0]))
    q("update wallets set claims = jsonb_set(claims, '{estate,at}', to_jsonb(now() - interval '2 hours')) where tg_id = %s and seat = 0", TG)
    ev("HOLDOR_EARN.EARN.st=null"); ev("HOLDOR.showHub('earn')"); pg.wait_for_timeout(1200); settle(); pg.wait_for_timeout(500)
    pile = int(''.join(ch for ch in ev("document.querySelector('.collectbox b').textContent") if ch.isdigit()))
    check('two hours later the pile is at least 2 × 20 (more inside the Boom)', pile >= 40, pile)
    g1 = W()[0]
    tap('#bCollect', 600); settle()
    check('collected by tap: the gold is on the server and in the app', W()[0] - g1 == pile and ev("HOLDOR.ACC.gold") == W()[0], (W()[0] - g1, pile))
    check('the button is off again', ev("document.querySelector('#bCollect').disabled"))
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(600)
    check('no refusals, no flags', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0)
    check('no page errors', not errs, errs[:3])
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
