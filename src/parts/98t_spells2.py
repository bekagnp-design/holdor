# v1.3.3 — Wildfire jars and Beacon. src/mod/spells133.js
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('spells133.js').rstrip('\n') + '\n' + s[i:]
rep("G.powerCd={arrows:0,fire:20,reinf:0,night:0,repair:0};G.powerMax={arrows:26,fire:UP('cache')?42:60,reinf:30,night:45,repair:90};",
    "G.powerCd={arrows:0,fire:20,reinf:0,night:0,repair:0,jars:0,beacon:0};G.powerMax={arrows:26,fire:UP('cache')?42:60,reinf:30,night:45,repair:90,jars:35,beacon:50};G.beaconUntil=0;", 1, 'power-init2')
rep("if(k==='arrows'||k==='fire'){if(G.powerCd[k]>0)return;", "if(k==='arrows'||k==='fire'||k==='jars'){if(G.powerCd[k]>0)return;", 1, 'aim-jars')
rep("if(t.webbed>G.time)rate*=0.72;", "if(t.webbed>G.time)rate*=0.72;if(G.beaconUntil>G.time)rate*=(G.beaconMul||1.3);", 1, 'beacon-rate')
