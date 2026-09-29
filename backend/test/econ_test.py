# v1.0.56 end to end: a managed seat (the beta build against the local backend v5) — the server owns the economy.
# Real taps where a player taps. A battle's result is forged through HOLDOR.G (steps, kills, waves), and where a real
# battle would have lasted minutes its start is moved back in the database. Every number the app shows must be the server's.
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/econ_test.py   (fakerest.py running)
import os, json, psycopg2
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SHOTS = os.path.join(ROOT, '.shots'); os.makedirs(SHOTS, exist_ok=True)
TG = 777000123
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
def q(sql, *a):
    with db.cursor() as c:
        c.execute(sql, a or None)
        return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return (r[0][0] if len(r[0]) == 1 else r[0]) if r else None
# a clean test user: no rows anywhere (wallets, progress, battles, chests go with the player)
for t in ('econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id = %s', TG)
INIT = open(HERE + '/init.txt').read()
MOCK = """window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){}}};""" % json.dumps(INIT)
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, info)
    if not cond: fails.append(name)
def wallet():
    r = q("select gold, gems, energy, xp, levels, claims from wallets where tg_id = %s and seat = 0", TG)
    return dict(zip(('gold', 'gems', 'energy', 'xp', 'levels', 'claims'), r[0])) if r else None
def ledger_sum(cur): return q1("select coalesce(sum(delta), 0) from ledger where tg_id = %s and seat = 0 and cur = %s", TG, cur)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda x: errs.append(str(x)))
    pg.add_init_script(MOCK); pg.goto('file://' + HERE + '/index_test.html')
    ev = pg.evaluate
    def wait(js, ms=10000):
        for _ in range(ms // 100):
            v = ev(js)
            if v: return v
            pg.wait_for_timeout(100)
        return None
    def settle(ms=15000):
        ok = wait("(()=>{const E=HOLDOR_ECON.ECO;return !E.q.length&&!E.fly.length&&!E.fin&&!E.n&&!E.busyB&&!E.busyC&&!E.starting})()", ms)
        pg.wait_for_timeout(250); return ok
    def tap(sel, ms=400, force=False): pg.locator(sel).first.tap(force=force); pg.wait_for_timeout(ms)   # force: a button that pulses forever
    def acc(js): return ev("(()=>{const A=HOLDOR.ACC;return " + js + "})()")
    def same_as_server(tag):
        w = wallet(); a = acc("({gold:A.gold,gems:A.gems,xp:A.axp})")
        check(tag + ': the app shows the server balance', w and a['gold'] == w['gold'] and a['gems'] == w['gems'] and a['xp'] == w['xp'], f"app {a} server {w and {k: w[k] for k in ('gold', 'gems', 'xp')}}")
    def start():   # the title: START, or (with the title art) a tap on the picture
        if ev("(()=>{const b=document.querySelector('#bStart');return !!b&&b.offsetParent!==null})()"): tap('#bStart')
        else: pg.locator('.fs').first.tap(position={'x': 195, 'y': 300}); pg.wait_for_timeout(400)
    def age(bid, mins=15): q("update battles set started_at = now() - make_interval(mins => %s) where id = %s", mins, bid)
    check('login', wait("HOLDOR.CLOUD.on", 12000))

    # ---- 1. a new seat, through the real screens ----
    start(); tap('.seat[data-i="0"]'); tap('#card .rrow[data-j="0"]'); tap('#bPick'); tap('.hbig[data-h="stark"]', 900)
    if ev("!!document.querySelector('.cine #skip')"): tap('.cine #skip', 600)
    check('seat managed', wait("HOLDOR_ECON.ecoOn()", 12000), ev("HOLDOR_ECON.ECO.err"))
    ev("HOLDOR_DAILY.DAILY.shown=true")   # v1.0.61: the daily-reward popup is not what this test is about
    settle()
    ev("(()=>{const A=HOLDOR.ACC;A.tour=1;A.learn={chest:1,hold:1,champ:1};A.holdTut=1;A.holdIntro=1;HOLDOR.persist();HOLDOR.showHub('battle');})()"); pg.wait_for_timeout(500)
    w = wallet()
    check('fresh wallet 150 gold · 80 dragonglass · 60 energy', w and (w['gold'], w['gems'], w['energy']) == (150, 80, 60), str(w and (w['gold'], w['gems'], w['energy'])))
    check('energy chip in the hub', (ev("(document.querySelector('#hubEn')||{}).innerText||''") or '').replace('\n', '') == '⚡60/60', ev("(document.querySelector('#hubEn')||{}).innerText"))
    pg.screenshot(path=SHOTS + '/eco_hub.png')

    # ---- 2. the tutorial (no server battle) → its gift is claimed once ----
    tap('#bBattle', 700)
    check('tutorial runs', ev("HOLDOR.G.state==='play'&&HOLDOR.G.tutorial&&!HOLDOR.G.bid"))
    ev("HOLDOR.victory()"); settle()
    w = wallet()
    check('tutorial gift on the server', (w['gold'], w['gems']) == (250, 100) and q1("select count(*) from ledger where tg_id=%s and reason='tut'", TG) == 2, str((w['gold'], w['gems'])))
    same_as_server('after the tutorial')
    tap('#bGo', 600)

    # ---- 3. stage 1 from the map: energy, battle_start, a believable win ----
    tap('#bBattle', 700)
    cost = ev("(document.querySelector('#bGo .ecost')||{}).innerText||''")
    check('stage card shows the energy cost', '⚡ 3 energy' in cost, cost)
    tap('#bGo', 300)
    bid1 = wait("HOLDOR.G.state==='play'&&HOLDOR.G.bid")
    check('battle opened on the server', bid1 and q1("select status||'/'||kind||'/'||stage||'/'||energy from battles where id=%s", bid1) == 'open/camp/1/3', str(bid1))
    check('energy 60 → 57', wallet()['energy'] == 57, str(wallet()['energy']))
    age(bid1); ev("(()=>{const G=HOLDOR.G;G.tick=6100;G.kills=100;G.doorHp=G.doorMax;HOLDOR.victory();})()"); settle()
    check('win counted: 3 stars on the server', q1("select stars from progress where tg_id=%s and seat=0 and mode='c' and stage=1", TG) == 3)
    win = q("select cur, delta from ledger where tg_id=%s and reason='win' order by cur", TG)
    check('win reward computed by the server: 114 gold · 24 dragonglass', win == [('gems', 24), ('gold', 114)], str(win))
    check('battle closed as won', q1("select status from battles where id=%s", bid1) == 'won')
    same_as_server('after stage 1')
    check('the app keeps the stars', acc("A.campaign[1]") == 3)

    # ---- 4. stage 2 finished far too fast → refused, nothing paid, the stars go back ----
    g0 = wallet()['gold']
    tap('#bNext', 300, True)
    bid2 = wait("HOLDOR.G.state==='play'&&HOLDOR.G.bid!==" + json.dumps(bid1) + "&&HOLDOR.G.bid")
    ev("(()=>{const G=HOLDOR.G;G.tick=300;G.kills=40;G.doorHp=G.doorMax;HOLDOR.victory();})()"); settle()
    check('too fast: battle rejected', q1("select status from battles where id=%s", bid2) == 'rejected', str(q1("select status||' '||coalesce(why,'') from battles where id=%s", bid2)))
    check('too fast: flagged', q1("select count(*) from econ_flags where tg_id=%s and kind='battle_refused'", TG) == 1)
    check('too fast: no reward, no stars', wallet()['gold'] == g0 and acc("A.campaign[2]") is None, str((wallet()['gold'], g0, acc("A.campaign[2]"))))
    check('too fast: the player is told', 'battle not counted' in (ev("(document.querySelector('#ecoToast')||{}).textContent||''") or ''))
    same_as_server('after the refused battle')
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(400)

    # ---- 5. a tower level (cards are still counted here; the gold and the level on the server) ----
    # v1.0.58: the copies are the server's — the app's own count is overwritten by the next answer
    ev("(()=>{HOLDOR.ACC.cards['t:watch']=99;HOLDOR_ECON.ecoRefresh();})()"); pg.wait_for_timeout(300)
    wait("!HOLDOR_ECON.ECO.n"); pg.wait_for_timeout(200)
    check('a copy count made up in the app does not survive the server', acc("A.cards['t:watch']||0") == q1("select coalesce((cards->>'t:watch')::int,0) from wallets where tg_id=%s and seat=0", TG))
    q("update wallets set cards = jsonb_set(cards, '{t:watch}', '5') where tg_id=%s and seat=0", TG)
    ev("HOLDOR_ECON.ecoRefresh()"); wait("!HOLDOR_ECON.ECO.n"); pg.wait_for_timeout(200)
    ev("HOLDOR_CARDS.showTowerRoom('watch')"); pg.wait_for_timeout(400)
    tap('#clist button[data-a="tl"]'); settle()
    w = wallet()
    check('tower level 2 on the server', w['levels'].get('t:watch') == 2, str(w['levels']))
    check('tower level paid 50 gold', q1("select delta from ledger where tg_id=%s and reason='card' and cur='gold'", TG) == -50)
    check('two cards used, on the server too', acc("A.cards['t:watch']") == 3 and q1("select (cards->>'t:watch')::int from wallets where tg_id=%s and seat=0", TG) == 3)
    same_as_server('after the tower level')

    # ---- 6. a tampered balance: the app believes it has 100000 gold; the server refuses what it cannot pay ----
    ev("HOLDOR.showUpgrades()"); pg.wait_for_timeout(400)
    tap('.ug[data-u="leather"]'); tap('#bBuy'); settle()
    check('an answer corrects a tampered balance', (ev("(()=>{HOLDOR.ACC.gold=100000;HOLDOR_ECON.ecoRefresh();return 1})()") and settle() and acc("A.gold")) == wallet()['gold'])
    ev("(()=>{HOLDOR.ACC.gold=100000;HOLDOR.showUpgrades();})()"); pg.wait_for_timeout(300)
    tap('.ug[data-u="ironwood"]', 150); tap('#bBuy'); settle()
    w = wallet()
    check('affordable upgrade kept', w['levels'].get('upg:leather') == 1 and acc("A.upg.leather") == 1)
    check('unaffordable upgrade refused and undone', 'upg:ironwood' not in w['levels'] and not acc("A.upg.ironwood"), str(acc("A.upg")))
    check('refusal flagged', q1("select count(*) from econ_flags where tg_id=%s and kind='op_refused' and detail->>'why' like 'not enough gold%%'", TG) == 1)
    same_as_server('after the tampered balance')

    # ---- 7. the shop: the free deal, dragonglass → gold, the free chest ----
    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(500)
    tap('[data-deal="0"]'); settle()
    check('free deal on the server', q1("select count(*) from ledger where tg_id=%s and reason='deal'", TG) >= 1 or q1("select count(*) from econ_ops where tg_id=%s and r='deal' and ok", TG) == 1)
    gm = wallet()['gems']
    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(400)
    tap('[data-xch="0"]'); settle()
    check('exchange: 40 dragonglass → 350 gold', wallet()['gems'] == gm - 40 and q1("select delta from ledger where tg_id=%s and reason='xch' and cur='gold'", TG) == 350)
    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(400)
    tap('[data-buy="wood"]', 900)
    check('chest opened by the server', q1("select tier||'/'||source from chests where tg_id=%s", TG) == 'wood/shop')
    tap('#cch', 200); wait("document.querySelector('#ccol')&&document.querySelector('#ccol').classList.contains('in')", 12000); tap('#ccol', 500)
    settle()
    ch = q("select gold, gems from chests where tg_id=%s", TG)[0]
    srv = q1("select cards from wallets where tg_id=%s and seat=0", TG)
    check('after the chest the app\'s copies are the server\'s', {k: v for k, v in (acc("A.cards") or {}).items() if v} == {k: v for k, v in srv.items() if v}, (acc("A.cards"), srv))
    check('chest gold and dragonglass as rolled on the server', q("select cur, delta from ledger where tg_id=%s and reason='chest' order by cur", TG) == [('gems', ch[1]), ('gold', ch[0])], str(ch))
    check('free chest waits a day now', acc("Date.now()-A.freeChestAt<86400000") is True)
    same_as_server('after the shop')
    pg.screenshot(path=SHOTS + '/eco_shop.png')

    # ---- 8. energy: the refill for dragonglass, and a battle the server refuses without energy ----
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(400)
    e0 = wallet()['energy']; gm = wallet()['gems']
    tap('#hubEn'); check('energy sheet', ev("document.querySelector('#ecoModal.on')!==null"))
    pg.screenshot(path=SHOTS + '/eco_energy.png')
    tap('#ecoModal button[data-i="0"]'); settle()
    w = wallet()
    check('refill: +60 energy for 30 dragonglass', w['energy'] >= e0 + 60 and w['gems'] == gm - 30, str((e0, w['energy'], gm, w['gems'])))
    ev("document.querySelector('#ecoModal').className=''")
    q("update wallets set energy = 0, energy_at = now() where tg_id=%s and seat=0", TG)
    ev("HOLDOR.showCampaign()"); pg.wait_for_timeout(400)
    tap('#bGo', 300); settle()
    sheet = (ev("(document.querySelector('#ecoModal.on')||{}).innerText||''") or '').replace('\n', ' ')
    check('no energy: the server refuses the battle', ev("HOLDOR.G.state") != 'play' and 'This battle needs' in sheet, sheet[:90])
    check('no energy: the sheet shows the server\'s energy', '0 / 60' in sheet and 'To battle' not in sheet, sheet[:60])
    ev("document.querySelector('#ecoModal').className=''")
    q("update wallets set energy = 60, energy_at = now() where tg_id=%s and seat=0", TG)

    # ---- 9. offline: the purchase waits in the queue and goes when the server is back ----
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(400)
    pg.route('**/rest/v1/rpc/econ_sync', lambda r: r.abort())
    ev("HOLDOR_CASTLE.showTrain()"); pg.wait_for_timeout(400); tap('#bTrainUp', 1500)
    check('offline: the operation waits', ev("HOLDOR_ECON.ECO.q.length") == 1 and acc("A.army.lvl") == 2, str(ev("HOLDOR_ECON.ECO.err")))
    check('offline: stored for the next start', ev("JSON.parse(localStorage.getItem('holdor_eco')).q.length") == 1)
    pg.unroute('**/rest/v1/rpc/econ_sync')
    ev("HOLDOR_ECON.ecoFlush()"); settle()
    check('back online: accepted', wallet()['levels'].get('army') == 2 and ev("HOLDOR_ECON.ECO.q.length") == 0)
    same_as_server('after the offline purchase')

    # ---- 10. the daily Hold: attempts on the server, the run reported by battle_finish ----
    q("insert into progress (tg_id, seat, mode, stage, stars) values (%s,0,'c',2,1),(%s,0,'c',3,1) on conflict do nothing", TG, TG)
    ev("HOLDOR_ECON.ecoRefresh()"); settle()
    check('server stages reach the app', acc("Object.keys(A.campaign).length") == 3, str(acc("A.campaign")))
    ev("HOLDOR.showHub('hold')"); pg.wait_for_timeout(500)
    tap('#bHold', 300)
    bid3 = wait("HOLDOR.G.state==='play'&&HOLDOR.G.mode==='online'&&HOLDOR.G.bid")
    check('Hold opened: attempts 3 → 2', bid3 and wallet()['claims']['hold']['left'] == 2 and acc("A.online.attempts") == 2, str(wallet()['claims'].get('hold')))
    age(bid3, 20); ev("(()=>{const G=HOLDOR.G;G.tick=6000;G.wave=12;G.kills=140;HOLDOR.gameOver();})()"); settle()
    check('Hold run in today\'s standings', q1("select waves||'/'||kills||'/'||seat from daily_scores where tg_id=%s", TG) == '11/140/0')
    hold = q("select cur, delta from ledger where tg_id=%s and reason='hold' order by cur", TG)
    check('Hold reward from the server: 123 gold · 6 dragonglass', hold == [('gems', 6), ('gold', 123)], str(hold))
    check('the old hold_result is closed for this seat', 'update the app' in ev("HOLDOR.sbRpc('hold_result',{token:HOLDOR.CLOUD.token,day:HOLDOR.dayKeyUTC(),waves:99,kills:1,seat:0}).then(()=>'accepted',e=>String(e.message))"))
    same_as_server('after the Hold')

    # ---- 11. the star chest (5 stars → one) and the account-level chest, both checked by the server ----
    def open_chest(sel):
        tap(sel, 900, True); tap('#cch', 200, True); wait("document.querySelector('#ccol')&&document.querySelector('#ccol').classList.contains('in')", 12000); tap('#ccol', 500); settle()
    ev("HOLDOR.showHub('battle')"); pg.wait_for_timeout(500)
    open_chest('#starChest')
    check('star chest from the server', q1("select count(*) from chests where tg_id=%s and source='star' and tier='iron'", TG) == 1 and wallet()['claims'].get('star_chests') == 1)
    lv = acc("HOLDOR.accLevel().l")
    if ev("!!document.querySelector('#lvlChest')"):
        open_chest('#lvlChest')
        check('level chest from the server', q1("select count(*) from chests where tg_id=%s and source='level'", TG) == 1 and wallet()['claims'].get('lvl_chests') == 1, 'account level %s' % lv)
    else: check('level chest waiting at account level %s' % lv, False)
    same_as_server('after the chests')

    # ---- 12. every deal of this window (the kinds differ every 6 hours): three slots unlocked, six bought ----
    q("update wallets set gold = gold + 20000, gems = gems + 600 where tg_id=%s and seat=0", TG)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) select tg_id, seat, 'gold', 20000, gold, 'test' from wallets where tg_id=%s and seat=0", TG)
    q("insert into ledger (tg_id, seat, cur, delta, bal, reason) select tg_id, seat, 'gems', 600, gems, 'test' from wallets where tg_id=%s and seat=0", TG)
    ev("HOLDOR_ECON.ecoRefresh()"); settle()
    ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(500)
    for i in (3, 4, 5):
        if ev(f"!!document.querySelector('[data-unl=\"{i}\"]')"): tap(f'[data-unl="{i}"]', 500)
    settle(); ev("HOLDOR.showHub('shop')"); pg.wait_for_timeout(500)
    kinds = ev("HOLDOR.genDeals().map(d=>d.k)")
    for i in range(1, 6):
        if ev(f"(()=>{{const b=document.querySelector('[data-deal=\"{i}\"]');return !!b&&!b.disabled}})()"): tap(f'[data-deal="{i}"]', 500)
    settle()
    ops = q("select r, ok, coalesce(why,'') from econ_ops where tg_id=%s and r in ('deal','dealunl') order by at", TG)
    check('deals: every unlock and purchase accepted (' + ','.join(kinds) + ')', len(ops) == 9 and all(o[1] for o in ops), str(ops))
    check('deals: the server remembers the window', ev("HOLDOR.ACC.deals.bought.join('')") == '111111' and ev("HOLDOR.ACC.deals.unl.join('')") == '111111', str(ev("HOLDOR.ACC.deals")))
    same_as_server('after the deals')

    # ---- 13. a new session on this device: the same numbers, from the server ----
    ev("HOLDOR.cloudSave(false,true)"); pg.wait_for_timeout(800)
    pg.reload(); check('login again', wait("HOLDOR.CLOUD.on", 12000))
    start(); tap('.seat[data-i="0"]', 600)
    check('managed again', wait("HOLDOR_ECON.ecoOn()", 12000)); settle()
    ev("HOLDOR_DAILY.DAILY.shown=true")
    same_as_server('after a reload')
    srv = sorted(int(x[0]) for x in q("select stage from progress where tg_id=%s and seat=0 and mode='c'", TG))
    check('stages = the server\'s', sorted(int(k) for k in acc("Object.keys(A.campaign)")) == srv, str(srv))

    # ---- 14. the books balance ----
    w = wallet()
    check('ledger = wallet (gold)', ledger_sum('gold') == w['gold'], f"{ledger_sum('gold')} vs {w['gold']}")
    check('ledger = wallet (dragonglass)', ledger_sum('gems') == w['gems'], f"{ledger_sum('gems')} vs {w['gems']}")
    ev("HOLDOR.cloudSave(false,true)"); pg.wait_for_timeout(1500)
    check('no save claims more levels than the server', q1("select count(*) from econ_flags where tg_id=%s and kind='save_levels'", TG) == 0, str(q("select detail from econ_flags where tg_id=%s and kind='save_levels'", TG)))
    check('standings row from the server', q1("select stars||'/'||gates||'/'||waves from scores where tg_id=%s and seat=0", TG) == f"{q1('select sum(stars) from progress where tg_id=%s and seat=0', TG)}/3/11")
    check('no page errors', not errs, str(errs[:3]))
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
