import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json,time,subprocess
from playwright.sync_api import sync_playwright
INIT=open(HERE+'/init.txt').read()
MOCK="""window.Telegram={WebApp:{platform:'android',version:'8.0',initData:%s,ready(){},expand(){},onEvent(){},isVersionAtLeast(){return true},requestFullscreen(){},disableVerticalSwipes(){},lockOrientation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){}}};"""%json.dumps(INIT)
def q(sql): return subprocess.run(['su','postgres','-c',f'psql -qtA -c "{sql}"'],capture_output=True,text=True).stdout.strip()
with sync_playwright() as p:
    br=p.chromium.launch()
    # ---- device A: fresh, cloud has ver 3 ----
    ctxA=br.new_context(viewport={'width':412,'height':860});pgA=ctxA.new_page();errs=[];pgA.on('pageerror',lambda x:errs.append(str(x)))
    pgA.add_init_script(MOCK);pgA.goto('file://'+HERE+'/index_test.html');pgA.wait_for_timeout(2500)
    print('A after load:',pgA.evaluate("({on:HOLDOR.CLOUD.on,name:HOLDOR.CLOUD.name,ver:HOLDOR.SAVE.ver,pulled:HOLDOR.CLOUD.pulled,acc:HOLDOR.ACC&&HOLDOR.ACC.house,err:HOLDOR.CLOUD.lastErr})"))
    # play: modify progress and persist
    pgA.evaluate("(()=>{const H=HOLDOR;const a=H.newAccount('stark',0,'knight');a.tut=1;a.intro=1;H.SAVE.slots[0]=a;H.SAVE.cur=0;H.setAcc(a);a.campaign={1:3,2:2};a.stats.kills=999;a.stats.onlineBest=41;H.persist();})()")
    pgA.wait_for_timeout(4000)
    print('A after persist:',pgA.evaluate("({ver:HOLDOR.SAVE.ver,cver:HOLDOR.CLOUD.ver,dirty:HOLDOR.CLOUD.dirty,err:HOLDOR.CLOUD.lastErr,savedAt:!!HOLDOR.CLOUD.savedAt})"))
    print('DB:',q("select save_ver, save->'slots'->0->'campaign' from players where tg_id=777000123"),'|',q("select stars,gates,waves,kills from scores where tg_id=777000123"))
    # realm screen
    pgA.evaluate("HOLDOR.showRealms(true)");pgA.wait_for_timeout(1500)
    pgA.screenshot(path=HERE+'/realms.png')
    txt=pgA.evaluate("document.querySelector('#overlay').innerText")
    print('REALMS TEXT:',txt[:400].replace('\n',' | '))
    # settings
    pgA.evaluate("HOLDOR.showSettings()");pgA.wait_for_timeout(300);print('SETTINGS:',pgA.evaluate("document.querySelector('#overlay').innerText").split('Cloud:')[1][:60] if 'Cloud:' in pgA.evaluate("document.querySelector('#overlay').innerText") else 'no cloud line')
    verA=pgA.evaluate("HOLDOR.SAVE.ver")
    # ---- device B: fresh again -> should pull A's save ----
    ctxB=br.new_context(viewport={'width':412,'height':860});pgB=ctxB.new_page();pgB.on('pageerror',lambda x:errs.append(str(x)))
    pgB.add_init_script(MOCK);pgB.goto('file://'+HERE+'/index_test.html');pgB.wait_for_timeout(2500)
    print('B after load:',pgB.evaluate("({ver:HOLDOR.SAVE.ver,pulled:HOLDOR.CLOUD.pulled,camp:JSON.stringify(HOLDOR.ACC.campaign),kills:HOLDOR.ACC.stats.kills})"),'A ver',verA)
    # ---- device C: local newer than cloud -> pushes ----
    ctxC=br.new_context(viewport={'width':412,'height':860});pgC=ctxC.new_page();pgC.on('pageerror',lambda x:errs.append(str(x)))
    pgC.add_init_script(MOCK+"localStorage.setItem('holdor_save_v4',JSON.stringify({v:4,cur:0,ver:9999,slots:[{house:'martell',langI:1,diff:'knight',made:'x',intro:1,tut:1,won:{},campaign:{1:1},champs:{},sel:'oberyn',gems:5,upg:{},ach:{},stats:{kills:5,builds:0,calls:0,gold:0,fires:0,three:0,king:0,cleared:0,onlineBest:2,waves:0},online:{date:'',attempts:1,doorBonus:0,goldBonus:0,runs:[]}},null,null]}));")
    pgC.goto('file://'+HERE+'/index_test.html');pgC.wait_for_timeout(5000)
    print('C:',pgC.evaluate("({ver:HOLDOR.SAVE.ver,pulled:HOLDOR.CLOUD.pulled,house:HOLDOR.ACC.house,dirty:HOLDOR.CLOUD.dirty,err:HOLDOR.CLOUD.lastErr})"))
    print('DB after C:',q("select save_ver, save->'slots'->0->>'house', realm from players where tg_id=777000123"),'|',q("select stars,gates,waves,kills,realm,house from scores where tg_id=777000123"))
    # ---- guest (no Telegram): leaderboard read-only ----
    ctxD=br.new_context(viewport={'width':412,'height':860});pgD=ctxD.new_page();pgD.on('pageerror',lambda x:errs.append(str(x)))
    pgD.goto('file://'+HERE+'/index_test.html');pgD.wait_for_timeout(1500)
    pgD.evaluate("HOLDOR.showRealms(true)");pgD.wait_for_timeout(1500)
    t=pgD.evaluate("document.querySelector('#overlay').innerText");print('GUEST realms:',('Top defenders' in t),'| cloud on:',pgD.evaluate("HOLDOR.CLOUD.on"),'|',t.split('\n')[-1][:90])
    print('ERRS',errs);br.close()
print(open(HERE+'/fakerest.log').read()[-500:])
