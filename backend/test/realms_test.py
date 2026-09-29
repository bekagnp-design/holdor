# v1.0.55 realm statistics end to end: the beta build against the local backend (v4) with the production-shaped data.
# Every number on the realm screens must equal what the database says. Needs fakerest.py running (see README).
# Run: python3 src/build.py && python3 backend/test/prepare.py && python3 backend/test/realms_test.py
import os, json, subprocess
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); BACK = os.path.dirname(HERE); ROOT = os.path.dirname(BACK)
SHOTS = os.path.join(ROOT, '.shots'); os.makedirs(SHOTS, exist_ok=True)
sql = ''.join(open(os.path.join(BACK, f), encoding='utf-8').read() + '\n' for f in ('test/prod_like.sql', 'holdor_v3.sql', 'holdor_v4.sql', 'holdor_v5.sql', 'holdor_econ_data.sql', 'holdor_v6.sql', 'holdor_v7.sql', 'holdor_v8.sql', 'holdor_v9.sql', 'holdor_v10.sql', 'holdor_v11.sql', 'holdor_v12.sql', 'holdor_v13.sql', 'holdor_v14.sql', 'holdor_v15.sql', 'holdor_v16.sql', 'holdor_v17.sql', 'holdor_v18.sql'))
sql += "delete from players where tg_id in (777000123, 555);\n"
r = subprocess.run(['su', 'postgres', '-c', 'psql -q -v ON_ERROR_STOP=1 -o /dev/null'], input=sql, capture_output=True, text=True)
if r.returncode: raise SystemExit('load failed: ' + r.stderr[-600:])
def q(s): return subprocess.run(['su', 'postgres', '-c', f'psql -qtA -F "|" -c "{s}"'], capture_output=True, text=True).stdout.strip()
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
    pg.add_init_script(MOCK); pg.goto('file://' + HERE + '/index_test.html'); pg.wait_for_timeout(2500)
    import re as _re
    want = _re.search(r"const VERSION='([^']+)';\", 1", open(os.path.join(ROOT, 'src', 'parts', '01_version.py')).read()).group(1)
    check('beta logs in', pg.evaluate("HOLDOR.CLOUD.on && HOLDOR.VERSION===" + json.dumps(want)), want)
    # the test user: seat I in Georgia (Stark, 3 stages)
    pg.evaluate("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.holdTut=1;a.holdIntro=1;
      a.tours={win:1,battle:1,coll:1,shop:1,hold:1,events:1};a.learn={chest:1,hold:1,champ:1};
      a.campaign={1:3,2:3,3:3};a.stats.kills=500;H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();})()""")
    pg.wait_for_timeout(4200)
    check('test seat saved', q("select realm, stars from scores where tg_id=777000123") == '0|9')
    db_players = dict(tuple(map(int, l.split('|'))) for l in q("select realm, count(distinct tg_id) from scores group by realm").splitlines())
    db_tot = q("select count(*), count(distinct tg_id), count(distinct realm) from scores")
    # ---- the global realm screen ----
    pg.evaluate("HOLDOR.fetchLeaderboard(true)"); pg.wait_for_timeout(1200)
    pg.evaluate("HOLDOR.showRealms(false)"); pg.wait_for_timeout(1500)
    shown = pg.evaluate("""[...document.querySelectorAll('#card .rrow')].map(b=>[+b.dataset.j,+b.querySelector('.pp b').innerText.replace(/,/g,'')])""")
    check('193 realm rows', len(shown) == 193, len(shown))
    check('players per realm = database', all(db_players.get(j, 0) == n for j, n in shown), [x for x in shown if db_players.get(x[0], 0) != x[1]][:5])
    st = pg.evaluate("document.querySelector('#card .sub').innerText")
    tot, ppl, cty = db_tot.split('|')
    check('status line totals', f'{ppl} players · {cty} countries · {tot} defenders' in st, st)
    order = pg.evaluate("[...document.querySelectorAll('#card .rrow')].slice(0,5).map(b=>b.querySelector('.nm b').innerText.toLowerCase())")
    check('realm order by waves', order[:4] == ['germany', 'georgia', 'russia', 'china'], order)
    pg.screenshot(path=SHOTS + '/rl_realms.png')
    # ---- tap Germany → the realm card ----
    pg.locator('#card .rrow[data-j="3"]').tap(); pg.wait_for_timeout(1500)
    card = pg.evaluate("document.querySelector('#card').innerText")
    g = [int(x.replace(',', '')) for x in pg.evaluate("[...document.querySelectorAll('#card .statbox .gr b')].map(b=>b.innerText)")[:6]]
    dbg = [int(x) for x in q("select count(distinct tg_id), count(*), count(distinct tg_id) filter (where updated_at > now() - interval '7 days'), sum(waves), sum(stars), sum(kills) from scores where realm=3").split('|')]
    check('Germany card = database', g == dbg, f'{g} vs {dbg}')
    check('Germany houses', 'House Targaryen' in card and 'House Stark' in card, card[:300].replace('\n', ' | '))
    top = pg.evaluate("[...document.querySelectorAll('#card .lbrow .nm')].map(e=>{const c=e.cloneNode(true);c.querySelectorAll('svg').forEach(x=>x.remove());return c.textContent.trim();})")
    check('Germany best defenders', top == ['P2 III', 'P3'], top)
    check('card is live', 'Live · updated' in card)
    pg.screenshot(path=SHOTS + '/rl_card_germany.png', full_page=True)
    pg.locator('#bRcBack').tap(); pg.wait_for_timeout(600)
    check('back to realms', pg.evaluate("HOLDOR.CLOUD.screen") == 'realms')
    # ---- my realm (Georgia) from the statbox ----
    pg.locator('#bMyRealm').tap(); pg.wait_for_timeout(1500)
    g = [int(x.replace(',', '')) for x in pg.evaluate("[...document.querySelectorAll('#card .statbox .gr b')].map(b=>b.innerText)")[:6]]
    dbg = [int(x) for x in q("select count(distinct tg_id), count(*), count(distinct tg_id) filter (where updated_at > now() - interval '7 days'), sum(waves), sum(stars), sum(kills) from scores where realm=0").split('|')]
    check('Georgia card = database', g == dbg, f'{g} vs {dbg}')
    me = pg.evaluate("[...document.querySelectorAll('#card .lbrow.me .nm')].map(e=>{const c=e.cloneNode(true);c.querySelectorAll('svg').forEach(x=>x.remove());return c.textContent.trim();})")
    check('me marked in my realm', me == ['ტესტი K'], me)
    pg.screenshot(path=SHOTS + '/rl_card_georgia.png', full_page=True)
    # ---- an empty realm ----
    pg.evaluate("HOLDOR_REALMS.showRealmCard(150)"); pg.wait_for_timeout(1500)
    card = pg.evaluate("document.querySelector('#card').innerText")
    check('empty realm card', 'no defender yet' in card and 'No house holds' in card, card[:200].replace('\n', ' | '))
    # ---- Events → Realms ----
    pg.evaluate("HOLDOR.showHub('events')"); pg.wait_for_timeout(1500)
    rows = pg.evaluate("""[...document.querySelectorAll('.rlink')].map(b=>[+b.dataset.j,b.querySelector('.nm small').innerText])""")
    check('events: only realms with defenders', sorted(j for j, _ in rows) == sorted(db_players), rows)
    check('events: players per realm', all(t == '👥 ' + str(db_players[j]) for j, t in rows), rows)
    pills = pg.evaluate("[...document.querySelectorAll('.rcsum span')].map(e=>e.innerText)")
    check('events: totals', pills == [f'👥 {ppl} players', f'🌍 {cty} countries', f'🛡️ {tot} defenders'], pills)
    pg.screenshot(path=SHOTS + '/rl_events.png')
    pg.locator('.rlink[data-j="11"]').tap(); pg.wait_for_timeout(1500)
    check('events → Russia card', pg.evaluate("HOLDOR.CLOUD.screen") == 'realm:11' and 'Russia' in pg.evaluate("document.querySelector('#card').innerText"))
    pg.locator('#bBack').tap(); pg.wait_for_timeout(800)
    check('card ✖ back to events', pg.evaluate("HOLDOR.CLOUD.screen") == 'hub:events')
    pg.evaluate("HOLDOR.showHub('events','houses')"); pg.wait_for_timeout(800)
    hs = pg.evaluate("[...document.querySelectorAll('.hpanel .standrow .nm small')].map(e=>e.innerText)")
    check('events: houses count players and defenders', any('players' in h or 'player' in h for h in hs) and all('defender' in h for h in hs), hs)
    check('no page errors', not errs, errs)
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
