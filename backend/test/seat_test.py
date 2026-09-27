import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json,subprocess
from playwright.sync_api import sync_playwright
INIT=open(HERE+'/init.txt').read()
MOCK="""window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){}}};"""%json.dumps(INIT)
def q(sql): return subprocess.run(['su','postgres','-c',f'psql -qtA -c "{sql}"'],capture_output=True,text=True).stdout.strip()
fails=[]
def check(name,cond,info=''):
    print(('OK  ' if cond else 'FAIL'),name,info)
    if not cond: fails.append(name)
# Own fixture, so a run never depends on what is already in the database:
# the test user (777000123) starts with no rows; a second player "B K" (555) has 9 waves today.
FIXTURE = """
delete from daily_scores where tg_id in (777000123,555);
delete from scores where tg_id in (777000123,555);
delete from sessions where tg_id in (777000123,555);
delete from players where tg_id in (777000123,555);
insert into players (tg_id,name,username,house,realm,save,save_ver) values (555,'B K','bk','targaryen',0,'{"v":4,"cur":0,"slots":[]}',1);
insert into scores (tg_id,seat,name,house,realm,stars,gates,waves,kills) values (555,0,'B K','targaryen',0,3,1,9,90);
insert into daily_scores (day,tg_id,seat,name,house,realm,waves,kills,runs) values ((now() at time zone 'utc')::date,555,0,'B K','targaryen',0,9,90,1);
"""
r = subprocess.run(['su','postgres','-c','psql -q -v ON_ERROR_STOP=1'], input=FIXTURE, capture_output=True, text=True)
if r.returncode: raise SystemExit('fixture failed: ' + r.stderr)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    ctx=br.new_context(viewport={'width':412,'height':860});pg=ctx.new_page();errs=[];pg.on('pageerror',lambda x:errs.append(str(x)))
    pg.add_init_script(MOCK);pg.goto('file://'+HERE+'/index_test.html');pg.wait_for_timeout(2500)
    st=pg.evaluate("({on:HOLDOR.CLOUD.on,name:HOLDOR.CLOUD.name,tg:HOLDOR.CLOUD.tg_id,err:HOLDOR.CLOUD.lastErr,v:HOLDOR.VERSION||null})")
    check('login',st['on'] and st['tg']==777000123,str(st))
    # seat I: stark, 3 stages cleared -> Hold open
    pg.evaluate("(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;a.holdTut=1;a.holdIntro=1;a.campaign={1:3,2:3,3:3};a.stats.kills=500;H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);H.persist();})()")
    pg.wait_for_timeout(4000)
    check('seat I row',q("select stars||'/'||gates||'/'||waves||'/'||house from scores where tg_id=777000123 and seat=0")=='9/3/0/stark',q("select seat,stars,gates,waves,house from scores where tg_id=777000123 order by seat"))
    # seat I holds 20 waves
    pg.evaluate("(()=>{const H=HOLDOR;H.showHub('hold');})()");pg.wait_for_timeout(1500)
    pg.evaluate("(()=>{const H=HOLDOR;H.startGame({mode:'online'});})()");pg.wait_for_timeout(600)
    pg.evaluate("(()=>{const H=HOLDOR;H.G.wave=21;H.G.kills=333;H.gameOver();})()");pg.wait_for_timeout(2500)
    over=pg.evaluate("document.querySelector('#overlay')?document.querySelector('#overlay').innerText:document.body.innerText")
    check('gate fell screen',('You · run 1' in over) and ('B K' in over),over[:200].replace('\n',' | '))
    check('seat I daily',q("select waves||'/'||kills||'/'||seat from daily_scores where tg_id=777000123 and seat=0")=='20/333/0',q("select day,tg_id,seat,waves from daily_scores order by tg_id,seat"))
    # seat II: targaryen, also open
    pg.evaluate("(()=>{const H=HOLDOR;const a=H.newAccount('targaryen',0,'knight');a.tut=1;a.intro=1;a.holdTut=1;a.holdIntro=1;a.campaign={1:2,2:2,3:1};a.stats.kills=40;H.SAVE.slots[1]=a;H.SAVE.cur=1;H.setAcc(a);H.persist();})()")
    pg.wait_for_timeout(4000)
    check('seat II row',q("select stars||'/'||gates||'/'||house from scores where tg_id=777000123 and seat=1")=='5/3/targaryen',q("select seat,stars,gates,waves,house from scores where tg_id=777000123 order by seat"))
    check('seat I row kept',q("select stars||'/'||waves from scores where tg_id=777000123 and seat=0")=='9/20')
    # the Hold tab on seat II before any run: refetched for seat II, no "your rank" yet
    pg.evaluate("HOLDOR.showHub('hold')");pg.wait_for_timeout(2000)
    hold=pg.evaluate("document.querySelector('#app').innerText")
    lbseat=pg.evaluate("HOLDOR.CLOUD.lb&&HOLDOR.CLOUD.lb._seat")
    check('lb fetched for seat II',lbseat==1,str(lbseat))
    check('no rank before the run','your rank' not in hold)
    # seat II holds 11 waves -> #2 today (I: 20, II: 11, B K: 9)
    pg.evaluate("(()=>{const H=HOLDOR;H.startGame({mode:'online'});})()");pg.wait_for_timeout(600)
    pg.evaluate("(()=>{const H=HOLDOR;H.G.wave=12;H.G.kills=140;H.gameOver();})()");pg.wait_for_timeout(2500)
    over2=pg.evaluate("document.querySelector('#overlay')?document.querySelector('#overlay').innerText:''")
    lines=[l for l in over2.split('\n') if l.strip()]
    check('gate fell II lists seat I as "ტესტი K" and me as run 1',('You · run 1' in over2) and ('ტესტი K' in over2) and ('ტესტი K II' not in over2),' | '.join(lines[:14]))
    pg.evaluate("HOLDOR.showHub('hold')");pg.wait_for_timeout(2500)
    hold2=pg.evaluate("document.querySelector('#app').innerText")
    rows=pg.evaluate("[...document.querySelectorAll('.standrow')].map(r=>(r.classList.contains('me')?'*':'')+r.querySelector('.nm').childNodes[0].textContent.trim()+' '+r.querySelector('.v').textContent.trim())")
    check('hold header seat II rank 2','seat II · your rank #2' in hold2,hold2[hold2.find('defenders'):hold2.find('defenders')+40].replace('\n',' | '))
    check('hold rows order + me',rows[:3]==['ტესტი K 20 🌊','*ტესტი K II 11 🌊','B K 9 🌊'],str(rows))
    check('daily rows per seat',q("select string_agg(seat||':'||waves,',' order by seat) from daily_scores where tg_id=777000123")=='0:20,1:11')
    # Events -> Defenders (all-time) and the realms screen
    pg.evaluate("HOLDOR.showHub('events','defenders')");pg.wait_for_timeout(1500)
    rows2=pg.evaluate("[...document.querySelectorAll('.standrow')].map(r=>(r.classList.contains('me')?'*':'')+[...r.querySelector('.nm').childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()+' '+r.querySelector('.v').textContent.trim())")
    check('events defenders per seat',any(r.startswith('*ტესტი K II') for r in rows2) and any(r.startswith('ტესტი K 49') for r in rows2),str(rows2))
    pg.evaluate("HOLDOR.showRealms(false)");pg.wait_for_timeout(1500)
    rl=pg.evaluate("[...document.querySelectorAll('.lbrow')].map(r=>(r.classList.contains('me')?'*':'')+[...r.querySelector('.nm').childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()+' '+r.querySelector('.sc').textContent.trim())")
    check('realms top per seat',any(r.startswith('*ტესტი K II') for r in rl) and any(r.startswith('ტესტი K 🏆49') for r in rl),str(rl))
    # back to seat I: header says seat I · rank 1, me marker moves
    pg.evaluate("(()=>{const H=HOLDOR;H.SAVE.cur=0;H.setAcc(H.SAVE.slots[0]);H.persist();H.showHub('hold');})()");pg.wait_for_timeout(2500)
    hold3=pg.evaluate("document.querySelector('#app').innerText")
    rows3=pg.evaluate("[...document.querySelectorAll('.standrow')].map(r=>(r.classList.contains('me')?'*':'')+r.querySelector('.nm').childNodes[0].textContent.trim())")
    check('seat I header rank 1','seat I · your rank #1' in hold3)
    check('me marker on seat I',rows3[:2]==['*ტესტი K','ტესტი K II'],str(rows3))
    # the old client's cached standings (no _seat) count as stale
    stale=pg.evaluate("(()=>{const H=HOLDOR;const lb=H.CLOUD.lb;delete lb._seat;const s=HOLDOR_SEATS.lbStale();lb._seat=0;return s;})()")
    check('cache without seat is stale',stale is True)
    # wipe seat II -> its rows leave the server
    pg.evaluate("(()=>{const H=HOLDOR;H.SAVE.slots[1]=null;H.persist();})()");pg.wait_for_timeout(4000)
    check('wiped seat leaves scores',q("select string_agg(seat::text,',') from scores where tg_id=777000123")=='0',q("select seat from scores where tg_id=777000123"))
    check('wiped seat leaves today',q("select string_agg(seat::text,',') from daily_scores where tg_id=777000123")=='0')
    # a second device (fresh storage) pulls the save and lands on seat I with the right seat in the leaderboard call
    ctxB=br.new_context(viewport={'width':412,'height':860});pgB=ctxB.new_page();pgB.on('pageerror',lambda x:errs.append(str(x)))
    pgB.add_init_script(MOCK);pgB.goto('file://'+HERE+'/index_test.html');pgB.wait_for_timeout(2500)
    b=pgB.evaluate("({pulled:HOLDOR.CLOUD.pulled,cur:HOLDOR.SAVE.cur,house:HOLDOR.ACC&&HOLDOR.ACC.house,seat:HOLDOR_SEATS.seatNo()})")
    check('device B pulled seat I',b['pulled'] and b['cur']==0 and b['house']=='stark',str(b))
    print('ERRS',errs)
    br.close()
print('FAILS',fails)
