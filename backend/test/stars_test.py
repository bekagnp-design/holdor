# v1.0.60 end to end: paying with Telegram Stars on a managed seat (the beta build → the local Edge Function → local backend v9), real taps.
# Telegram is played by this script: the app's openInvoice is a mock; "Telegram" then sends pre_checkout_query and successful_payment
# to the function, exactly as it would, and tells the app "paid". Every number equals the server's.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/stars_test.py   (fakerest.py + edge_shim.mjs running)
import os, json, uuid, urllib.request, psycopg2
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SHOTS = os.path.join(ROOT, '.shots'); os.makedirs(SHOTS, exist_ok=True)
TG = 777000123
FN = 'http://127.0.0.1:8787/functions/v1/stars'
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c:
        c.execute(sql, a or None); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return (r[0][0] if len(r[0]) == 1 else r[0]) if r else None
for t in ('payments', 'econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', TG)
HOOK = q1("select v from app_secrets where k = 'webhook_secret'")
n = [0]
def tg_send(body):
    n[0] += 1
    rq = urllib.request.Request(FN, data=json.dumps(dict(update_id=n[0], **body)).encode(), headers={'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': HOOK}, method='POST')
    return urllib.request.urlopen(rq, timeout=20).status
def telegram_takes_the_stars(link, stars):   # what Telegram does after the buyer taps Pay
    oid = link.split('$test_')[1]
    tg_send({'pre_checkout_query': {'id': 'q%d' % n[0], 'from': {'id': TG}, 'currency': 'XTR', 'total_amount': stars, 'invoice_payload': oid}})
    tg_send({'message': {'from': {'id': TG}, 'successful_payment': {'currency': 'XTR', 'total_amount': stars, 'invoice_payload': oid, 'telegram_payment_charge_id': 'charge_' + uuid.uuid4().hex}}})
INIT = open(HERE + '/init.txt').read()
MOCK = """window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){},
  openInvoice(url,cb){window.__inv={url,cb};}}};""" % json.dumps(INIT)
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
        ok = wait("(()=>{const E=HOLDOR_ECON.ECO;return !E.q.length&&!E.fly.length&&!E.fin&&!E.n&&!E.busyB&&!E.busyC&&!E.starting&&!document.querySelector('#ecoWait.on')})()", 25000)
        pg.wait_for_timeout(300); return ok
    def tap(sel, ms=400): pg.locator(sel).first.tap(force=True); pg.wait_for_timeout(ms)
    def W(): return q("select gems, gold, cards from wallets where tg_id = %s and seat = 0", TG)[0]
    def toast(): return ev("(document.querySelector('#ecoToast')||{}).textContent||''")
    check('login', wait("HOLDOR.CLOUD.on", 12000))
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};a.learn={chest:1,hold:1,champ:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()

    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(800)
    check('the shop sells three dragonglass packs for Stars, enabled', ev("['gems_s','gems_m','gems_l'].every(k=>{const b=document.querySelector('[data-stars=\"'+k+'\"]');return b&&!b.disabled})"))
    check('the Starter pack is offered (the server says it is not bought)', wait("!!document.querySelector('[data-stars=\"starter\"]')", 6000))
    pg.screenshot(path=SHOTS + '/stars_shop.png')
    check('prices in Stars', ev("[...document.querySelectorAll('[data-stars]')].map(b=>b.dataset.stars+':'+b.textContent.trim()).join('|')") == 'starter:⭐ 75|gems_s:⭐ 50|gems_m:⭐ 125|gems_l:⭐ 350')

    # ---- a pack: tap → invoice → Telegram takes the Stars → the app waits for the server → the balance ----
    g0 = W()[0]
    tap('[data-stars="gems_m"]', 900)
    inv = wait("window.__inv&&window.__inv.url", 8000)
    check('the invoice link came from the server and Telegram was asked to open it', bool(inv) and inv.startswith('https://t.me/$test_'), inv)
    order = inv.split('$test_')[1]
    check('the order is pending on the server (nothing credited yet)', q1("select status from payments where id = %s", order) == 'pending' and W()[0] == g0)
    telegram_takes_the_stars(inv, 125)
    ev("window.__inv.cb('paid')"); settle()
    check('+400 dragonglass on the server', W()[0] - g0 == 400, W()[0] - g0)
    check('the app shows the server balance', ev("HOLDOR.ACC.gems") == W()[0], (ev("HOLDOR.ACC.gems"), W()[0]))
    check('the player is thanked', 'Thank you' in toast() and '400' in toast(), toast())
    check('ledger entry: reason stars', q("select delta, reason from ledger where tg_id = %s and reason = 'stars'", TG) == [(400, 'stars')])
    check('the pending list is cleared', ev("JSON.parse(localStorage.getItem('holdor_pay')||'[]').length") == 0)

    # ---- "paid" reaches the app before the server has heard from Telegram: the app waits, then credits ----
    ev("window.__inv=null"); g1 = W()[0]
    tap('[data-stars="gems_s"]', 900)
    inv2 = wait("window.__inv&&window.__inv.url", 8000)
    ev("window.__inv.cb('paid')"); pg.wait_for_timeout(2600)
    check('while Telegram is slow: still nothing credited, the app is waiting', W()[0] == g1 and ev("!!document.querySelector('#ecoWait.on')"))
    telegram_takes_the_stars(inv2, 50); settle()
    check('then +150 dragonglass, once', W()[0] - g1 == 150 and ev("HOLDOR.ACC.gems") == W()[0], (W()[0] - g1, ev("HOLDOR.ACC.gems")))

    # ---- cancelled: nothing happens ----
    ev("window.__inv=null"); g2 = W()[0]
    tap('[data-stars="gems_l"]', 900)
    inv3 = wait("window.__inv&&window.__inv.url", 8000)
    ev("window.__inv.cb('cancelled')"); pg.wait_for_timeout(500)
    check('cancelled: no credit, the order is left pending and forgotten by the app', W()[0] == g2 and q1("select status from payments where id = %s", inv3.split('$test_')[1]) == 'pending' and ev("JSON.parse(localStorage.getItem('holdor_pay')||'[]').length") == 0 and 'cancel' in toast().lower(), toast())

    # ---- the Starter pack, once ----
    ev("window.__inv=null"); w0 = W()
    tap('[data-stars="starter"]', 900)
    inv4 = wait("window.__inv&&window.__inv.url", 8000)
    telegram_takes_the_stars(inv4, 75); ev("window.__inv.cb('paid')"); settle()
    w1 = W()
    check('Starter: +300 dragonglass, +5000 gold, 3 Rare books — on the server', w1[0] - w0[0] == 300 and w1[1] - w0[1] == 5000 and w1[2].get('b:r') == 3, (w1[0] - w0[0], w1[1] - w0[1], w1[2]))
    check('the app has them too', ev("HOLDOR.ACC.gold") == w1[1] and ev("HOLDOR.ACC.gems") == w1[0] and ev("HOLDOR.ACC.cards['b:r']") == 3, (ev("HOLDOR.ACC.gold"), ev("HOLDOR.ACC.cards['b:r']")))
    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(600)
    check('the Starter pack is gone from the shop', ev("!document.querySelector('[data-stars=\"starter\"]')"))
    pg.screenshot(path=SHOTS + '/stars_after.png')

    # ---- an invoice paid while the app was closed: the app finds out when the seat is entered ----
    ev("window.__inv=null"); g3 = W()[0]
    tap('[data-stars="gems_s"]', 900)
    inv5 = wait("window.__inv&&window.__inv.url", 8000)
    ev("window.__inv=null")                         # the player closes the app right there (no callback ever comes)
    telegram_takes_the_stars(inv5, 50)
    check('paid on the server, the app has not heard yet', W()[0] - g3 == 150 and ev("HOLDOR.ACC.gems") == g3)
    ev("HOLDOR_ECON.ecoRefresh()"); settle()
    ev("HOLDOR_STARS.starsWait({id:%s,sku:'gems_s',seat:0,t:Date.now()},true)" % json.dumps(inv5.split('$test_')[1])); settle()
    check('starsResume: the balance arrives', ev("HOLDOR.ACC.gems") == W()[0], (ev("HOLDOR.ACC.gems"), W()[0]))

    check('ledger = wallet (gems and gold)', q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gems'", TG) == W()[0] and q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gold'", TG) == W()[1])
    check('no refusals, no flags', q1("select count(*) from econ_flags where tg_id = %s", TG) == 0, q("select kind from econ_flags where tg_id = %s", TG))
    check('no page errors', not errs, errs[:3])
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
