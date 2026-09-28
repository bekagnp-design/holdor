# The app Telegram opens today (root index.html — whatever version is live; v1.0.48 sent no seat and the best-of-all-seats
# numbers) against the local backend (v3 … v5): every seat must still get its own honest row.
# Needs fakerest.py running and init.txt from prepare.py (see README). Run: python3 backend/test/old_app_test.py
import os, re, json, subprocess
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
s2 = re.sub(r"const SB=\{url:'[^']*',key:'[^']*'\};", "const SB={url:'http://127.0.0.1:8787',key:'TESTANONKEY_1234567890abcdef'};", s, count=1)
assert s2 != s, 'SB line not found'
open(os.path.join(HERE, 'index_old_test.html'), 'w', encoding='utf-8').write(s2)
INIT = open(HERE + '/init.txt').read()
MOCK = """window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){}}};""" % json.dumps(INIT)
def q(sql): return subprocess.run(['su', 'postgres', '-c', f'psql -qtA -F "|" -c "{sql}"'], capture_output=True, text=True).stdout.strip()
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, info)
    if not cond: fails.append(name)
FIXTURE = """
delete from players where tg_id in (777000123, 555) or tg_id between 900000001 and 900000003;
insert into players (tg_id,name,username,house,realm,save,save_ver) values (555,'B K','bk','lannister',3,'{"v":4,"cur":0,"slots":[{"house":"lannister","langI":3,"made":"2026-09-20","campaign":{"1":3,"2":2},"stats":{"kills":120,"onlineBest":7}},null,null]}',3);
select sync_seats(555);
"""
r = subprocess.run(['su', 'postgres', '-c', 'psql -q -v ON_ERROR_STOP=1 -o /dev/null'], input=FIXTURE, capture_output=True, text=True)
if r.returncode: raise SystemExit('fixture failed: ' + r.stderr)
check('fixture B K', q("select seat, realm, house, stars, gates, waves, kills from scores where tg_id=555") == '0|3|lannister|5|2|7|120')
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    pg = br.new_context(viewport={'width': 412, 'height': 860}).new_page(); errs = []
    pg.on('pageerror', lambda x: errs.append(str(x)))
    pg.add_init_script(MOCK); pg.goto('file://' + HERE + '/index_old_test.html'); pg.wait_for_timeout(2500)
    st = pg.evaluate("({on:HOLDOR.CLOUD.on,tg:HOLDOR.CLOUD.tg_id,v:HOLDOR.VERSION})")
    check('live app logs in', st['on'] and st['tg'] == 777000123, str(st))
    # seat I: Georgia / Stark, 3 stages
    pg.evaluate("""(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.holdTut=1;a.holdIntro=1;
      a.campaign={1:3,2:3,3:3};a.stats.kills=500;H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();})()""")
    pg.wait_for_timeout(4200)
    check('seat I row', q("select seat, realm, house, stars, gates, waves, kills from scores where tg_id=777000123 order by seat") == '0|0|stark|9|3|0|500',
          q("select seat, realm, house, stars, gates, waves, kills from scores where tg_id=777000123 order by seat"))
    # seat III: Germany / Targaryen, 6 stages — the old app now sends max stars 18, kills 500 + 2000, realm Germany, no seat
    pg.evaluate("""(()=>{const H=HOLDOR;const a=H.newAccount('targaryen',3,'knight');a.tut=1;a.intro=1;a.holdTut=1;a.holdIntro=1;
      a.campaign={1:3,2:3,3:3,4:3,5:3,6:3};a.stats.kills=2000;H.SAVE.slots[2]=a;H.SAVE.cur=2;H.setAcc(a);H.persist();})()""")
    pg.wait_for_timeout(4200)
    sent = pg.evaluate("HOLDOR.scoreSummary()")
    mixed = st['v'] == '1.0.48'   # before v1.0.49: best of all seats, kills summed
    check('live app sends ' + ('the mixed numbers' if mixed else 'the seat\'s numbers'), sent == ({'stars': 18, 'gates': 6, 'waves': 0, 'kills': 2500} if mixed else {'stars': 18, 'gates': 6, 'waves': 0, 'kills': 2000}), str(sent))
    got = q("select seat, realm, house, stars, gates, waves, kills from scores where tg_id=777000123 order by seat")
    check('each seat its own row (seat I not overwritten)', got == '0|0|stark|9|3|0|500\n2|3|targaryen|18|6|0|2000', got)
    # Hold run in seat III. Before v1.0.56: hold_result (no seat before v1.0.49). From v1.0.56 the live app is managed:
    # the run is opened and closed on the server (the seat counts as one from before v5, so its save's stars come along).
    managed = tuple(map(int, st['v'].split('.'))) >= (1, 0, 56)
    if managed:
        subprocess.run(['su', 'postgres', '-c', "psql -q -c \"delete from econ_legacy where tg_id=777000123; insert into econ_legacy (tg_id,seat,made) values (777000123,2,to_char((now() at time zone 'utc')::date,'YYYY-MM-DD')||'/targaryen')\""], capture_output=True)
    pg.evaluate("HOLDOR.startGame({mode:'online'})"); pg.wait_for_timeout(700)
    if managed:
        bid = None
        for _ in range(100):
            bid = pg.evaluate("HOLDOR.G.state==='play'&&HOLDOR.G.bid")
            if bid: break
            pg.wait_for_timeout(100)
        subprocess.run(['su', 'postgres', '-c', f"psql -q -c \"update battles set started_at=now()-interval '20 minutes' where id='{bid}'\""], capture_output=True)
        pg.evaluate("HOLDOR.G.tick=12000")
    pg.evaluate("(()=>{const H=HOLDOR;H.G.wave=21;H.G.kills=333;H.gameOver();})()"); pg.wait_for_timeout(3000)
    d = q("select seat, realm, house, waves, kills from daily_scores where tg_id=777000123 and day=(now() at time zone 'utc')::date")
    check('old Hold run lands on seat III', d == '2|3|targaryen|20|333', d)
    got = q("select seat, waves from scores where tg_id=777000123 order by seat")
    check('seat III best 20, seat I still 0', got == '0|0\n2|20', got)
    pg.wait_for_timeout(4200)  # the save that carries onlineBest
    got = q("select seat, realm, stars, waves, kills from scores where tg_id=777000123 order by seat")
    check("after the next save (the run's kills join the seat)", got == '0|0|9|0|500\n2|3|18|20|2333', got)
    lb = pg.evaluate("HOLDOR.CLOUD.lb")
    check('old app reads the new leaderboard', lb and lb.get('me') and lb['me']['seat'] == 2 and lb.get('players') == 2 and lb.get('countries') == 2,
          json.dumps({k: lb.get(k) for k in ('total', 'players', 'countries', 'me')}) if lb else 'no lb')
    R = {r['realm']: r for r in (lb or {}).get('realms', [])}
    check('realms in the old app', R.get(3, {}).get('players') == 2 and R.get(3, {}).get('waves') == 27 and R.get(0, {}).get('players') == 1, json.dumps(R))
    pg.evaluate("HOLDOR.showRealms(false)"); pg.wait_for_timeout(1200)
    txt = pg.evaluate("document.querySelector('#card').innerText").lower()
    check('old realm screen renders', 'germany' in txt and 'georgia' in txt, txt[:160].replace('\n', ' | '))
    pg.evaluate("HOLDOR.showHub('events')"); pg.wait_for_timeout(1200)
    txt = pg.evaluate("document.querySelector('#hub')?document.querySelector('#hub').innerText:document.body.innerText")
    check('old events tab renders', 'Germany' in txt, txt[:200].replace('\n', ' | '))
    check('no page errors', not errs, str(errs))
    br.close()
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
