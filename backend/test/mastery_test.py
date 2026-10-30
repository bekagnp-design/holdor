# v1.2.0 end to end: Mastery on a managed seat (the beta build against the local backend v33), real taps in the tower room.
# Path A step 1, the refusals (too little gold), the second step, a switch of path; every number equals the server's and the ledger.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/mastery_test.py   (fakerest.py running)

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
for t in ('summons', 'econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', TG)
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
    def W(): return q("select levels, cards, gold, gems, claims from wallets where tg_id = %s and seat = 0", TG)[0]
    def setw(**kw):
        for k, v in kw.items(): q(f"update wallets set {k} = %s where tg_id = %s and seat = 0", json.dumps(v) if isinstance(v, (dict, list)) else v, TG)
    def book(cur, amount):
        q(f"update wallets set {cur} = {cur} + %s where tg_id = %s and seat = 0", amount, TG)
        q(f"insert into ledger (tg_id, seat, cur, delta, bal, reason) select tg_id, seat, %s, %s, {cur}, 'test' from wallets where tg_id = %s and seat = 0", cur, amount, TG)
    check('login', wait("HOLDOR.CLOUD.on", 12000))
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};a.learn={chest:1,hold:1,champ:1};a.holdTut=1;a.holdIntro=1;
      for(let i=1;i<=30;i++)a.campaign[i]=3;H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    for i in range(1, 31): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", TG, i)
    setw(levels={'t:watch': 16, 't:scorp': 15})
    book('gold', 70000)
    def later():
        try: pg.get_by_text('Later', exact=True).first.click(timeout=1500)   # the daily calendar of a new day may open over the room
        except Exception: pass
    ev("HOLDOR_ECON.ecoRefresh()"); settle(); later()
    ev("HOLDOR_ARMY.showTowerRoom('watch')"); pg.wait_for_timeout(500)
    check('the Watchtower room shows two Mastery paths with a big button each', ev("document.querySelectorAll('[data-mb]').length") == 2)
    pg.screenshot(path=SHOTS + '/mastery_managed.png')
    check('the Scorpion (level 15) is still locked', (ev("HOLDOR_ARMY.showTowerRoom('scorp'),document.querySelector('#card').innerText") or '').find('opens at the last level') >= 0)
    later(); ev("HOLDOR_ARMY.showTowerRoom('watch')"); pg.wait_for_timeout(400)
    g0 = W()[2]
    tap('[data-mb="a"]', 900); settle()
    lv = W()[0]
    check('a tap buys step 1: 20 000 gold left the server wallet and levels carry m:watch = 1', g0 - W()[2] == 20000 and lv.get('m:watch') == 1, f'{g0} -> {W()[2]} {lv}')
    check('the app shows the same: gold and the step', ev("HOLDOR.ACC.gold") == W()[2] and ev("HOLDOR_MST.mstState('watch').s") == 1 and ev("HOLDOR_MST.mstState('watch').p") == 'a', ev("HOLDOR.ACC.gold"))
    tap('[data-mb="a"]', 900); settle()
    check('step 2 costs 40 000', W()[0].get('m:watch') == 2 and g0 - W()[2] == 60000, f'{W()[0]} {g0 - W()[2]}')
    tap('[data-mb="a"]', 900); settle()
    check('step 3 needs 80 000 and the wallet has 10 000: refused, nothing changes', W()[0].get('m:watch') == 2 and W()[2] == g0 - 60000, f'{W()[0]} {W()[2]}')
    book('gold', 120000); ev("HOLDOR_ECON.ecoRefresh()"); settle(); later(); ev("HOLDOR_ARMY.showTowerRoom('watch')"); pg.wait_for_timeout(400)
    tap('[data-mb="a"]', 900); settle()
    check('with enough gold step 3 is bought: mastered', W()[0].get('m:watch') == 3 and 'MASTERED' in ev("document.querySelector('#card').innerText"))
    g1 = W()[2]
    tap('[data-mreset]', 300); tap('[data-mreset]', 900); settle()
    check('switching: two taps, 10 000 gold, the steps are gone', g1 - W()[2] == 10000 and W()[0].get('m:watch') == 0 and ev("HOLDOR_MST.mstState('watch').p") is None, f'{g1 - W()[2]} {W()[0]}')
    tap('[data-mb="b"]', 900); settle()
    check('path B starts again at step 1 (stored 11)', W()[0].get('m:watch') == 11)
    led = q("select count(*), coalesce(sum(delta), 0) from ledger where tg_id = %s and reason = 'mastery'", TG)[0]
    check('the ledger holds every Mastery payment (4 steps + 1 switch: -(20k+40k+80k+10k+20k))', led[0] == 5 and led[1] == -170000, str(led))
    check('no refusals flagged by the server', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0)
    check('no page errors', not errs, str(errs))
    br.close()
print('FAILS', fails); raise SystemExit(1 if fails else 0)
