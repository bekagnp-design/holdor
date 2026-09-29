# v1.0.72 — the marketing version: share buttons (a win, a duel), the source of a new player (`startapp=s_<code>`), backend v17.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('market.js').rstrip('\n') + '\n' + s[i:]
rep("""<button class="btn sec" id="bRetry">🔁 Replay</button><button class="btn sec" id="bUp">⬆️ Upgrades</button><button class="btn sec" id="bMap">🗺️ Map</button></div>`);""",
    """<button class="btn sec" id="bRetry">🔁 Replay</button><button class="btn sec" id="bUp">⬆️ Upgrades</button><button class="btn sec" id="bMap">🗺️ Map</button><button class="btn sec" id="bShare">📨 Share</button></div>`);""", 1, 'share-win-button')
rep("$('#bUp').addEventListener('click',()=>win?showUpgrades():showTowerRoom());$('#bMap').addEventListener('click',()=>showCampaign());",
    "$('#bUp').addEventListener('click',()=>win?showUpgrades():showTowerRoom());$('#bMap').addEventListener('click',()=>showCampaign());const bsh=$('#bShare');if(bsh)bsh.addEventListener('click',()=>{SFX.play('tap',60);shareWin(L.id,stars);});", 1, 'share-win-bind')
# where a new player came from
rep("if(!sp||!/^r_[0-9a-f]{8}$/i.test(sp)||!CLOUD.token)return;", "if(sp&&/^s_[a-z0-9_]{2,16}$/i.test(sp)&&CLOUD.token){const k0='holdor_src';if(localStorage.getItem(k0)===sp)return;localStorage.setItem(k0,sp);sbRpc('src_set',{token:CLOUD.token,code:sp.slice(2)},{timeout:8000}).catch(()=>{});return;}if(!sp||!/^r_[0-9a-f]{8}$/i.test(sp)||!CLOUD.token)return;", 1, 'src-set')
