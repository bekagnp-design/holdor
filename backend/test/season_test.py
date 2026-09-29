# v1.0.71 end to end: the Season screen (Pass, VIP, tiers) on a managed seat (the beta build against the local backend v16), real taps.
# Points from the server's own battles, free and premium claims, the Pass and VIP after a (simulated) Telegram payment.
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
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1,earn:1};a.learn={chest:1,hold:1,champ:1,glass:1,keep:1,tier2:1,fire:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    q("update wallets set created_at = now() - interval '3 days' where tg_id = %s and seat = 0", TG)

    ev("HOLDOR_DAILY.DAILY.shown=true")
    q("update wallets set created_at = now() - interval '40 days' where tg_id = %s and seat = 0", TG)
    def wins(n):
        for _ in range(n): q("insert into battles (tg_id, seat, kind, stage, status, stars, kills, waves, started_at, finished_at) values (%s, 0, 'camp', 1, 'won', 3, 10, 5, now() - interval '1 minute', now())", TG)
    wins(25)
    ev("HOLDOR_SEASON.SEASON.st=null"); ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(1200); settle()
    check('the Battle tab has a Season button beside City', wait("!!document.querySelector('#bSeason') && !!document.querySelector('#bCity')", 4000))
    tap('#bSeason', 900); settle(); pg.wait_for_timeout(600)
    check('the Season screen: tier 2 of 20 (25 points), no Pass, no VIP, 20 rows', 'Tier 2 / 20' in ev("document.querySelector('.sbox').textContent") and ev("document.querySelectorAll('.srow').length") == 20 and ev("document.querySelectorAll('[data-buy]').length") == 2, ev("document.querySelector('.sbox').textContent"))
    pg.screenshot(path=SHOTS + '/season_home.png')
    g0 = W()[0]
    tap('.srow:nth-child(1) button[data-k="free"]', 500); settle()
    check('free tier 1 claimed by tap: 250 gold on the server', W()[0] - g0 == 250, W()[0] - g0)
    tap('#ecoModal button[data-i="0"]', 400)
    check('the row shows it done, and the app balance equals the server', ev("document.querySelector('.srow:nth-child(1) .scell.done')!==null") and ev("HOLDOR.ACC.gold") == W()[0], (ev("HOLDOR.ACC.gold"), W()[0]))
    check('premium is locked without the Pass (the button is off)', ev("document.querySelector('.srow:nth-child(2) button[data-k=\"prem\"]').disabled"))
    # a Telegram payment for the Pass and for VIP, confirmed the way the Edge Function would
    tok = q1("select token::text from sessions where tg_id = %s order by created_at desc limit 1", TG)
    def pay(sku, charge):
        pid = q1("select (pay_create(%s::uuid, 0, %s))->>'id'", tok, sku)
        q("select pay_confirm(%s::uuid, %s, %s, 'XTR', %s)", pid, TG, q1("select stars from payments where id = %s", pid), charge)
    pay('pass', 'ch_e2e_pass'); pay('vip', 'ch_e2e_vip')
    ev("HOLDOR_SEASON.SEASON.st=null"); ev("HOLDOR_SEASON.showSeason()"); pg.wait_for_timeout(1300); settle(); pg.wait_for_timeout(500)
    check('the Pass and VIP are on: both boxes say active, +25% points (31), the VIP gift is ready', 'active' in ev("document.querySelectorAll('.vipbox')[0].textContent") and 'VIP' in ev("document.querySelectorAll('.vipbox')[1].textContent") and 'Tier 3 / 20' in ev("document.querySelector('.sbox').textContent") and ev("!document.querySelector('#bVip').disabled"), ev("document.querySelector('.sbox').textContent"))
    pg.screenshot(path=SHOTS + '/season_pass.png')
    m0 = W()[1]
    tap('.srow:nth-child(2) button[data-k="prem"]', 500); settle()
    check('premium tier 2 claimed by tap: dragonglass on the server', W()[1] - m0 == q1("select ((v->'rewards'->1)->'prem'->>'gems')::int from econ_config where k = 'season'"), W()[1] - m0)
    tap('#ecoModal button[data-i="0"]', 400)
    m1 = W()[1]
    tap('#bVip', 500); settle()
    check('the VIP gift: 25 dragonglass, and the button says it is claimed', W()[1] - m1 == 25, W()[1] - m1)
    tap('#ecoModal button[data-i="0"]', 400)
    check('the VIP button is off for today', ev("document.querySelector('#bVip').disabled"))
    check('the app balance equals the server (gold and dragonglass)', ev("HOLDOR.ACC.gold") == W()[0] and ev("HOLDOR.ACC.gems") == W()[1], (ev("HOLDOR.ACC.gems"), W()[1]))
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(900)
    check('no refusals, no flags', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0)
    check('no page errors', not errs, errs[:3])
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
