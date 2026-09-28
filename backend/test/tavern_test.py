# v1.0.59 end to end: the tavern on a managed seat (the beta build against the local backend v8), real taps.
# A star raised by burning another champion's cards, a level past the old cap, a skill rank paid with books,
# ten summons through the portal, a chest that brings books — every number equals the server's.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/tavern_test.py   (fakerest.py running)
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
    # the server's side: 30 stages held, Robb at level 10 (★1 cap), 40 Brienne cards, 3 Common books, gold and dragonglass
    for i in range(1, 31): q("insert into progress (tg_id, seat, mode, stage, stars) values (%s, 0, 'c', %s, 3) on conflict do nothing", TG, i)
    setw(levels={'c:robb': 10}, cards={'c:brienne': 40, 'c:robb': 100, 'b:c': 3})
    book('gold', 20000); book('gems', 1000)
    ev("HOLDOR_ECON.ecoRefresh()"); settle()
    ev("HOLDOR_TAVERN.showHeroRoom('robb')"); pg.wait_for_timeout(500)
    check('the tavern shows the star box at the cap', ev("!!document.querySelector('.ascbox')"))
    pg.screenshot(path=SHOTS + '/tavern_asc.png')
    g0 = W()[2]
    tap('.ascgo', 500); settle()
    lv, cd = W()[0], W()[1]
    check('★2 on the server, 20 Brienne cards burnt, 1500 gold', lv.get('st:robb') == 2 and cd.get('c:brienne') == 20 and g0 - W()[2] == 1500, (lv, cd, g0 - W()[2]))
    check('the app shows ★2', ev("HOLDOR_TAVERN.cstar('robb')") == 2 and ev("HOLDOR.ACC.gold") == W()[2])
    ev("HOLDOR_TAVERN.showHeroRoom('robb')"); pg.wait_for_timeout(300)
    tap('#clist button[data-a="lvl"]', 400); settle()
    check('level 11 on the server', W()[0].get('c:robb') == 11, W()[0])
    ev("HOLDOR_TAVERN.showHeroRoom('robb')"); pg.wait_for_timeout(300)
    tap('#clist button[data-a="sk"][data-i="0"]', 400); settle()
    check('a skill rank: rank 2 and one Common book used', W()[0].get('sk:robb:0') == 2 and W()[1].get('b:c') == 2, (W()[0], W()[1]))
    check('the app counts the same books', ev("HOLDOR.ACC.cards['b:c']") == 2)
    # the portal: ten summons
    gm = W()[3]
    ev("HOLDOR_TAVERN.showHeroRoom('robb')"); pg.wait_for_timeout(300)
    tap('.tvsum button[data-a="s10"]', 600); settle()
    check('ten summons: 540 dragonglass on the server, one row', gm - W()[3] == 540 and q1("select count(*) from summons where tg_id = %s", TG) == 1, (gm - W()[3],))
    check('the portal shows ten champions', ev("document.querySelectorAll('#ecoModal .smc').length") == 10)
    pg.screenshot(path=SHOTS + '/tavern_summon.png')
    rolls = q1("select rolls from summons where tg_id = %s", TG)
    new = [x['c'] for x in rolls if x['new']]
    check('who joined is open in the app too', all(ev(f"HOLDOR_CH52.unlocked(null,HOLDOR_CH52.CBY['{c}'])") for c in new), new)
    check('the copies match the server', all(ev(f"HOLDOR.ACC.cards['c:{k[2:]}']||0") == v for k, v in W()[1].items() if k.startswith('c:')), W()[1])
    ev("document.querySelector('#ecoModal').className=''")
    # a chest brings books
    b0 = dict(W()[1])
    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(500)
    tap('[data-buy="valyrian"]', 600); settle()
    b1 = W()[1]
    check('valyrian chest: 2 Common + 1 Rare books on the server', b1.get('b:c', 0) - b0.get('b:c', 0) == 2 and b1.get('b:r', 0) - b0.get('b:r', 0) == 1, (b0, b1))
    tap('#cch', 200); pg.wait_for_timeout(11000)
    check('the chest shows the books', 'book' in (ev("(document.querySelector('#crw')||{}).textContent||''") or ''), ev("(document.querySelector('#crw')||{}).textContent"))
    pg.screenshot(path=SHOTS + '/tavern_chest.png')
    check('ledger = wallet', q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gold'", TG) == W()[2] and q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gems'", TG) == W()[3])
    check('no refusals', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0, q("select kind, detail from econ_flags where tg_id = %s", TG))
    check('no page errors', not errs, errs[:3])
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
