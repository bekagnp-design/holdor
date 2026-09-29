# v1.0.57 end to end: the forge on a managed seat (the beta build against the local backend v6), real taps.
# A won battle drops an item (the drop set to 100 % for the test), the forge puts it on, strikes it, sells it;
# the champion's stats in battle follow what it wears; every number equals the server's.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/gear_test.py   (fakerest.py running)
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
for t in ('econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', TG)
G0 = q1("select v from econ_config where k = 'gear'")
def cfg(**kw):
    g = json.loads(json.dumps(G0))
    for k, v in kw.items():
        node = g; ks = k.split('__')
        for x in ks[:-1]: node = node[x]
        node[ks[-1]] = v
    q("update econ_config set v = %s where k = 'gear'", json.dumps(g))
INIT = open(HERE + '/init.txt').read()
MOCK = """window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){}}};""" % json.dumps(INIT)
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, info)
    if not cond: fails.append(name)
try:
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
    def tap(sel, ms=400, force=False): pg.locator(sel).first.tap(force=force); pg.wait_for_timeout(ms)
    def items(): return q("select id::text, slot, rar, main_k, lvl, champ from items where tg_id = %s and seat = 0 order by created_at", TG)
    def wgold(): return q1("select gold from wallets where tg_id = %s and seat = 0", TG)
    check('login', wait("HOLDOR.CLOUD.on", 12000))
    ev("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.tour=1;a.learn={chest:1,hold:1,champ:1};a.holdTut=1;a.holdIntro=1;
      H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();H.afterLoad();})()""")
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    check('an empty bag at the start', ev("HOLDOR_GEAR.gearItems().length") == 0 and items() == [])

    # ---- a won battle drops an item; the player is told ----
    cfg(drop__win=100)
    ev("HOLDOR.startGame({mode:'campaign',level:HOLDOR.LEVELS[0]})")
    bid = wait("HOLDOR.G.state==='play'&&HOLDOR.G.bid")
    q("update battles set started_at = now() - interval '15 minutes' where id = %s", bid)
    ev("(()=>{const G=HOLDOR.G;G.tick=6100;G.kills=100;G.doorHp=G.doorMax;HOLDOR.victory();})()"); settle()
    q("update econ_config set v = %s where k = 'gear'", json.dumps(G0))
    check('the win dropped an item on the server', len(items()) == 1 and items()[0][5] is None, items())
    check('the app has it', ev("HOLDOR_GEAR.gearItems().length") == 1)
    check('the player is told', 'New gear' in (ev("(document.querySelector('#ecoToast')||{}).textContent||''") or ''), ev("(document.querySelector('#ecoToast')||{}).textContent"))

    # ---- a known Legendary weapon (+10.8 % damage) through the forge's taps ----
    wid = q1("insert into items (tg_id, seat, slot, rar, set_k, main_k, subs, src) values (%s, 0, 'weapon', 4, 'wolf', 'dmg', '[]', 'test') returning id::text", TG)
    ev("HOLDOR_GEAR.gearLoad()"); settle()
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(500)
    tap('#bForge', 600)
    check('forge: 9 slots, the bag', ev("document.querySelectorAll('.gslot').length") == 9 and ev("document.querySelectorAll('.gitem').length") == 2)
    pg.screenshot(path=SHOTS + '/gear_forge.png')
    dmg0 = ev("HOLDOR.makeHero().dmg")
    tap(f'.gitem[data-i="{wid}"]', 500)
    pg.screenshot(path=SHOTS + '/gear_sheet.png')
    tap('#ecoModal button[data-i="1"]', 300); settle()
    sel = ev("HOLDOR.ACC.sel")
    check('put on: the server has it on the champion', q1("select champ from items where id = %s", wid) == sel, q1("select champ from items where id = %s", wid))
    check('the weapon slot shows it', ev(f"!!document.querySelector('.gslot[data-i=\"{wid}\"]')"))
    check('stats: +10.8 % damage', ev(f"HOLDOR_GEAR.gearStats('{sel}').dmg") == 10.8, ev(f"HOLDOR_GEAR.gearStats('{sel}')"))
    dmg1 = ev("HOLDOR.makeHero().dmg")
    check('the champion hits 10.8 % harder in battle', abs(dmg1 / dmg0 - 1.108) < 1e-6, (dmg0, dmg1))

    # ---- a strike (chance set to 100 % for the test), then a failed one (0 %) ----
    q("update wallets set gold = gold + 5000 where tg_id = %s and seat = 0", TG)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) select tg_id, seat, 'gold', 5000, gold, 'test' from wallets where tg_id = %s and seat = 0", TG)
    ev("HOLDOR_ECON.ecoRefresh()"); settle()
    cfg(chance=[100] * 16)
    g0 = wgold(); cost = ev(f"HOLDOR_GEAR.gearCost(HOLDOR_GEAR.gearItems().find(x=>x.id==='{wid}'))")
    tap(f'.gslot[data-i="{wid}"]', 500); tap('#ecoModal button[data-i="0"]', 300); settle()
    check('strike: +1 on the server, gold paid', q1("select lvl from items where id = %s", wid) == 1 and wgold() == g0 - cost, (q1("select lvl from items where id = %s", wid), g0 - wgold(), cost))
    check('the app shows the server gold', ev("HOLDOR.ACC.gold") == wgold(), (ev("HOLDOR.ACC.gold"), wgold()))
    ev("document.querySelector('#ecoModal').className=''")
    cfg(chance=[0] * 16)
    g0 = wgold(); tap(f'.gslot[data-i="{wid}"]', 500); tap('#ecoModal button[data-i="0"]', 300); settle()
    check('a failed strike: gold gone, item kept at +1', q1("select lvl from items where id = %s", wid) == 1 and wgold() < g0 and 'failed' in (ev("(document.querySelector('#ecoToast')||{}).textContent||''") or ''))
    q("update econ_config set v = %s where k = 'gear'", json.dumps(G0))
    ev("document.querySelector('#ecoModal').className=''")

    # ---- sell the dropped item ----
    other = [i for i in items() if i[0] != wid][0]
    g0 = wgold(); price = ev(f"HOLDOR_GEAR.gearSellPrice(HOLDOR_GEAR.gearItems().find(x=>x.id==='{other[0]}'))")
    tap(f'.gitem[data-i="{other[0]}"]', 500); tap('#ecoModal button[data-i="2"]', 400); tap('#ecoModal button[data-i="0"]', 300); settle()
    check('sold: gone on the server, gold added', q1("select count(*) from items where id = %s", other[0]) == 0 and wgold() == g0 + price, (wgold() - g0, price))
    check('ledger = wallet', q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gold'", TG) == wgold())
    # ---- gear II: a tier through the forge, with taps ----
    q("update wallets set gold = gold + 60000 where tg_id = %s and seat = 0", TG)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) select tg_id, seat, 'gold', 60000, gold, 'test' from wallets where tg_id = %s and seat = 0", TG)
    def ins(rar, tier, lvl): return q1("insert into items (tg_id, seat, slot, rar, tier, lvl, set_k, main_k, subs, src) values (%s, 0, 'boots', %s, %s, %s, 'stag', 'spd', '[]', 'test') returning id::text", TG, rar, tier, lvl)
    ta, tf = ins(0, 1, 4), ins(0, 1, 0)
    ev("HOLDOR_GEAR.gearLoad()"); settle(); ev("HOLDOR_GEAR.showForge(HOLDOR.ACC.sel)"); pg.wait_for_timeout(400)
    tap(f'.gitem[data-i="{ta}"]', 500)
    check('the sheet of an item at its cap offers a tier, not a strike', ev("[...document.querySelectorAll('#ecoModal button')].some(b=>/^⬆ Tier 2/.test(b.textContent))") and not ev("[...document.querySelectorAll('#ecoModal button')].some(b=>/Strike/.test(b.textContent))"))
    pg.screenshot(path=SHOTS + '/gear62_tier_sheet.png')
    g0 = wgold()
    ev("[...document.querySelectorAll('#ecoModal button')].find(b=>/^⬆ Tier 2/.test(b.textContent)).click()"); pg.wait_for_timeout(400)
    check('the burn picker lists the other Common item', ev("[...document.querySelectorAll('#ecoModal .gpk')].map(b=>b.dataset.f).join()") == tf)
    pg.screenshot(path=SHOTS + '/gear62_tier_pick.png')
    tap(f'#ecoModal .gpk[data-f="{tf}"]', 400)
    ev("[...document.querySelectorAll('#ecoModal button')].find(b=>/Burn/.test(b.textContent)).click()"); pg.wait_for_timeout(300); settle()
    check('★2 on the server, the burnt item gone, 1500 gold paid', q1("select tier from items where id = %s", ta) == 2 and q1("select count(*) from items where id = %s", tf) == 0 and g0 - wgold() == 1500, (q1("select tier from items where id = %s", ta), g0 - wgold()))
    check('the app shows the server\'s tier and gold', ev(f"HOLDOR_GEAR.gearItems().find(x=>x.id==='{ta}').tier") == 2 and ev("HOLDOR.ACC.gold") == wgold())
    check('ledger = wallet after the tier (gold)', q1("select sum(delta) from ledger where tg_id = %s and seat = 0 and cur = 'gold'", TG) == wgold())
    check('no page errors', not errs, errs[:3])
    br.close()
finally:
    q("update econ_config set v = %s where k = 'gear'", json.dumps(G0))
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
